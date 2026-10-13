/** One outbreak lands on real bodies; distant infections are rate draws, never daily person ticks. */
import type { WorldState } from './world-state.js';
import { getLocation } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { isTheWorldsToMove, woundsCarriedBy, maxBodyOf, bodyStandingOn, markDead } from './npc-state.js';
import { activePlague, plagueSusceptibility, plagueCourse, contractPlague, plagueHealthCeiling,
    plagueHasBecomeFatal, treatPlague, PLAGUE_EXPOSURE_RATE, PLAGUE_COURSE_DAYS } from '../cultivation/plague.js';
import { forStream } from '../cultivation/rng.js';
import { drawBackgroundIncidents, isPlayerInvolved, playerAtTheContact } from './background-incident-draw.js';
import { makeAreaStatus, isStatusRunningOn, liftStatus, type AreaStatus } from './what-is-true-of-a-place-right-now.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { routineLocationOf } from './npc-routines.js';
import { privatePeopleCanSpeak } from './private-requests.js';
import { whetherTheyGiveItAway } from './what-somebody-standing-here-would-part-with.js';
import { theyHaveOutgrownTheFind } from './private-party-finds.js';
import { createObligation } from '../social/grudges.js';
import { isRuined } from './possessions.js';
import { woundMedicineIn } from './house-wound-medicine.js';
import { swallow } from './where-the-pills-actually-are.js';
import { settleNpcDeath } from './time.js';
import type { PressureEvent } from './the-world-changing-on-its-own.js';
import type { PlagueState } from '../../schema/cultivation.js';
import { physicianIsWorking } from './who-is-actually-seeing-to-wounds.js';

export interface PlagueAppointment { key: string; day: number; run(): void }
const APPOINTMENTS = new WeakMap<WorldState, { due(appointment: PlagueAppointment): void; event(event: PressureEvent): void }>();

/** A transient calendar adapter; the body and area status alone retain every real date. */
export function withPlagueAppointments<T>(state: WorldState, due: (appointment: PlagueAppointment) => void,
    event: (event: PressureEvent) => void, resolve: () => T): T {
    const before = APPOINTMENTS.get(state);
    APPOINTMENTS.set(state, { due, event });
    try { return resolve(); } finally { if (before) APPOINTMENTS.set(state, before); else APPOINTMENTS.delete(state); }
}

function publish(state: WorldState, fact: HistoricalFact, people: string[] = [], deaths: PressureEvent['deaths'] = []): void {
    APPOINTMENTS.get(state)?.event({ kind: 'plague', onDay: fact.day, fact,
        touched: { npcs: people, locations: fact.locationId ? [fact.locationId] : [], factions: [] }, deaths });
}

function bodyOf(person: NpcRecord) { return { realmOrdinal: person.cultivation.realmOrdinal,
    plague: person.cultivation.plague, injuries: woundsCarriedBy(person) }; }
function atThePlace(state: WorldState, person: NpcRecord, areaId: string, day: number): boolean {
    const clock = { ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 };
    const seen = new Set<string>();
    let place = getLocation(state, routineLocationOf(clock, person) ?? '');
    while (place && !seen.has(place.id)) {
        if (place.id === areaId) return true;
        seen.add(place.id); place = place.parentId ? getLocation(state, place.parentId) : null;
    }
    return false;
}

export function plagueHere(state: WorldState, placeId: string | null, day: number): AreaStatus | null {
    const seen = new Set<string>();
    let place = getLocation(state, placeId ?? '');
    while (place && !seen.has(place.id)) {
        const plague = state.statuses.find(status => status.areaId === place!.id && status.kind === 'plague' && isStatusRunningOn(status, day));
        if (plague) return plague;
        seen.add(place.id); place = place.parentId ? getLocation(state, place.parentId) : null;
    }
    return null;
}

function personAppointments(state: WorldState, person: NpcRecord): PlagueAppointment[] {
    const course = person.cultivation.plague;
    if (!course || person.status !== 'alive' || !isTheWorldsToMove(person)) return [];
    return [...new Set([course.endsOnDay, ...(course.fatalOnDay === null ? [] : [course.fatalOnDay])])]
        .map(day => ({ key: `plague-person:${person.id}:${day}`, day, run: () => settleNativePlague(state, person.id, day) }));
}
function outbreakAppointments(state: WorldState, outbreak: AreaStatus): PlagueAppointment[] {
    if (outbreak.kind !== 'plague' || outbreak.liftedOnDay !== null) return [];
    const rows: PlagueAppointment[] = [];
    for (let day = outbreak.beganOnDay + PLAGUE_COURSE_DAYS; day <= outbreak.reviewOnDay; day += PLAGUE_COURSE_DAYS)
        rows.push({ key: `plague-place:${outbreak.id}:${day}`, day, run: () => {
            if (day >= outbreak.reviewOnDay) endPlagueOutbreak(state, outbreak.id, day);
            else exposePeopleToPlague(state, outbreak.id, day);
        } });
    return rows;
}
export function plagueAppointments(state: WorldState, fromDay: number, toDay: number): PlagueAppointment[] {
    return [...state.statuses.flatMap(status => outbreakAppointments(state, status)),
        ...state.npcs.flatMap(person => personAppointments(state, person))].filter(row => row.day >= fromDay && row.day <= toDay);
}

export function beginPlagueOutbreak(state: WorldState, areaId: string, day: number, causeFactId: string | null = null): AreaStatus | null {
    const existing = plagueHere(state, areaId, day), place = getLocation(state, areaId);
    if (existing || !place) return existing;
    const fact = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'public', locationId: place.id,
        causes: causeFactId ? [causeFactId] : [], summary: `Plague began at ${place.name}.`, data: { plagueOutbreak: true } }), { recur: false });
    const outbreak = makeAreaStatus({ id: `plague:${place.id}:${day}`, areaId: place.id, kind: 'plague',
        statement: 'Plague is present here.', cause: { what: 'plague', decidedById: null, factId: fact.id },
        signs: ['People here report plague.'], causeKnownLocally: true, beganOnDay: day, reviewOnDay: day + 3 * PLAGUE_COURSE_DAYS });
    state.statuses.push(outbreak); publish(state, fact);
    for (const appointment of outbreakAppointments(state, outbreak)) APPOINTMENTS.get(state)?.due(appointment);
    exposePeopleToPlague(state, outbreak.id, day);
    return outbreak;
}

/** Explicit exact contact shares the same monthly exposure stream as the selected named background body. */
export function exposeOneToPlague(state: WorldState, personId: string, outbreakId: string, day: number): boolean {
    const person = state.npcs.find(person => person.id === personId), outbreak = state.statuses.find(status => status.id === outbreakId);
    if (!person || !outbreak || !isTheWorldsToMove(person) || person.status !== 'alive'
        || !isStatusRunningOn(outbreak, day) || !atThePlace(state, person, outbreak.areaId, day)) return false;
    const window = Math.floor((day - outbreak.beganOnDay) / PLAGUE_COURSE_DAYS);
    if (person.cultivation.plague?.outbreakId === outbreakId
        && person.cultivation.plague.contractedOnDay >= outbreak.beganOnDay + window * PLAGUE_COURSE_DAYS) return false;
    const course = contractPlague(bodyOf(person), outbreak.id, day, outbreak.reviewOnDay,
        forStream(state.seed, 'plague-exposure', outbreak.id, person.id, window),
        forStream(state.seed, 'plague-course', outbreak.id, person.id, window));
    if (!course) return false;
    infectPerson(state, person, course, day); return true;
}

function infectPerson(state: WorldState, person: NpcRecord, course: PlagueState, day: number): void {
    const at = state.npcs.findIndex(row => row.id === person.id), current = state.npcs[at];
    state.npcs[at] = { ...current, cultivation: { ...current.cultivation, plague: course,
        hp: Math.min(bodyStandingOn(current, day), plagueHealthCeiling(maxBodyOf(current), { ...bodyOf(current), plague: course }, day)),
        bodyOnDay: day }, updatedOnDay: day };
    const fact = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: current.locationId,
        actors: [{ id: current.id, name: current.name, role: 'stricken' }], summary: `${current.name} contracted plague.`,
        data: { plagueInfection: true, outbreakId: course.outbreakId, personId: current.id } }), { recur: false, bystanders: false });
    publish(state, fact, [current.id]);
    for (const appointment of personAppointments(state, state.npcs.find(row => row.id === current.id)!)) APPOINTMENTS.get(state)?.due(appointment);
    treatNativePlagueWithMedicine(state, current.id, current.id, day);
    if (activePlague(bodyOf(state.npcs[at]), day)) seekNativePlagueMedicine(state, current.id, day);
}

/** Only a selected stricken person seeks help; background people are never walked each day. */
export function seekNativePlagueMedicine(state: WorldState, patientId: string, day: number): boolean {
    const patient = state.npcs.find(person => person.id === patientId);
    if (!patient || !activePlague(bodyOf(patient), day)) return false;
    const holders = new Set(state.objects.filter(object => object.kind === 'pill' && !isRuined(object)
        && object.possessorId && woundMedicineIn(object)).map(object => object.possessorId));
    const clock = { ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 };
    const providers = state.npcs.filter(person => person.id !== patientId && isTheWorldsToMove(person)
        && person.status === 'alive' && holders.has(person.id) && privatePeopleCanSpeak(clock, patient, person, day))
        .sort((a, b) => Number(physicianIsWorking(clock, b)) - Number(physicianIsWorking(clock, a))
            || (patient.relationships.find(tie => tie.targetId === b.id)?.standing ?? 0)
                - (patient.relationships.find(tie => tie.targetId === a.id)?.standing ?? 0));
    for (const provider of providers) if (treatNativePlagueWithMedicine(state, patientId, provider.id, day)) return true;
    return false;
}

export function exposePeopleToPlague(state: WorldState, outbreakId: string, day: number): void {
    const outbreak = state.statuses.find(status => status.id === outbreakId);
    if (!outbreak || !isStatusRunningOn(outbreak, day)) return;
    const window = Math.floor((day - outbreak.beganOnDay) / PLAGUE_COURSE_DAYS);
    const pool = state.npcs.filter(person => isTheWorldsToMove(person) && person.status === 'alive'
        && atThePlace(state, person, outbreak.areaId, day) && !activePlague(bodyOf(person), day)
        && !(person.cultivation.plague?.outbreakId === outbreakId
            && person.cultivation.plague.contractedOnDay >= outbreak.beganOnDay + window * PLAGUE_COURSE_DAYS)
        && plagueSusceptibility(bodyOf(person)) > 0);
    for (const person of pool.filter(person => isPlayerInvolved(state, person))) exposeOneToPlague(state, person.id, outbreakId, day);
    for (const person of drawBackgroundIncidents(pool.filter(person => !isPlayerInvolved(state, person))
        .map(value => ({ value, rate: PLAGUE_EXPOSURE_RATE * plagueSusceptibility(bodyOf(value)) })),
        forStream(state.seed, 'plague-background', outbreak.id, window), 8))
        infectPerson(state, person, plagueCourse(outbreak.id, day, outbreak.reviewOnDay,
            forStream(state.seed, 'plague-course', outbreak.id, person.id, window)), day);
}

export function settleNativePlague(state: WorldState, personId: string, day: number): void {
    const at = state.npcs.findIndex(person => person.id === personId), person = state.npcs[at];
    if (!person || !isTheWorldsToMove(person) || person.status !== 'alive' || !person.cultivation.plague) return;
    const course = person.cultivation.plague;
    if (plagueHasBecomeFatal(bodyOf(person), day)) {
        const ended = markDead(person, course.fatalOnDay!, 'Died of plague.');
        state.npcs[at] = { ...ended, cultivation: { ...ended.cultivation, plague: null } };
        const died = ended.status === 'physically_dead';
        const fact = appendWorldFact(state, makeFact({ day: course.fatalOnDay!, kind: died ? 'death' : 'opportunity',
            visibility: 'public', locationId: person.locationId,
            actors: [{ id: person.id, name: person.name, role: died ? 'died' : 'lost their body' }],
            summary: died ? `${person.name} died of plague.` : `${person.name}'s body died of plague.`,
            data: { plagueDeath: died, outbreakId: course.outbreakId } }), { recur: false });
        publish(state, fact, [person.id], died ? [settleNpcDeath(state, state.npcs[at], course.fatalOnDay!)] : []);
    } else if (plagueSusceptibility(bodyOf(person)) === 0 || day >= course.endsOnDay) {
        state.npcs[at] = { ...person, cultivation: { ...person.cultivation, plague: null }, updatedOnDay: day };
        const fact = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: person.locationId,
            actors: [{ id: person.id, name: person.name, role: 'recovered' }], summary: `${person.name}'s plague ended.`,
            data: { plagueRecovery: true, outbreakId: course.outbreakId } }), { recur: false, bystanders: false });
        publish(state, fact, [person.id]);
    }
}

/** Actual medicine is spent by its holder; another person's help still needs reach and consent. */
export function treatNativePlagueWithMedicine(state: WorldState, patientId: string, healerId: string, day: number): boolean {
    const patient = state.npcs.find(person => person.id === patientId), healer = state.npcs.find(person => person.id === healerId);
    if (!patient || !healer || patient.status !== 'alive' || healer.status !== 'alive'
        || !isTheWorldsToMove(patient) || !isTheWorldsToMove(healer) || !activePlague(bodyOf(patient), day)) return false;
    const doseAt = state.objects.findIndex(object => object.possessorId === healer.id
        && (object.ownerId === null || object.ownerId === healer.id) && !isRuined(object) && woundMedicineIn(object)
        && treatPlague(bodyOf(patient), woundMedicineIn(object)!, day) !== null);
    if (doseAt < 0 || patient.id !== healer.id && (!privatePeopleCanSpeak(state, patient, healer, day)
        || !whetherTheyGiveItAway({ id: healer.id, name: healer.name, ordinal: healer.cultivation.realmOrdinal,
            factionId: healer.factionId, spiritStones: healer.spiritStones }, {
            outgrown: theyHaveOutgrownTheFind(healer, state.objects[doseAt]),
            recipientStanding: healer.relationships.find(tie => tie.targetId === patient.id)?.standing ?? 0,
            withholdingCostsFace: false, rng: forStream(state.seed, 'plague-medicine-given', healer.id, patient.id,
                patient.cultivation.plague!.outbreakId, patient.cultivation.plague!.contractedOnDay) }))) return false;
    const dose = woundMedicineIn(state.objects[doseAt])!, treated = treatPlague(bodyOf(patient), dose, day);
    if (!treated) return false;
    const object = state.objects[doseAt], quantity = Math.max(1, Math.floor(Number(object.data.quantity ?? 1)));
    state.objects[doseAt] = quantity > 1 ? { ...object, data: { ...object.data, quantity: quantity - 1 } } : swallow(object, patient.id, day);
    const at = state.npcs.findIndex(person => person.id === patient.id), current = state.npcs[at];
    state.npcs[at] = { ...current, cultivation: { ...current.cultivation, plague: treated }, updatedOnDay: day };
    const fact = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: patient.locationId,
        actors: [{ id: patient.id, name: patient.name, role: 'treated' }, { id: healer.id, name: healer.name, role: 'provided medicine' }],
        summary: `${patient.name}'s plague was treated with ${dose.name}.`, data: { plagueTreatment: true, objectId: object.id } }),
        { recur: false, bystanders: false });
    if (patient.id !== healer.id) state.obligations.push(createObligation({ kind: 'favor', holderId: healer.id,
        subjectId: patient.id, cause: 'gifted_resource', severity: 'slight', onDay: day, triggeringEventId: fact.id,
        description: `${healer.name} spent their own medicine on ${patient.name}'s plague.` }));
    publish(state, fact, [patient.id, healer.id]); return true;
}

export function endPlagueOutbreak(state: WorldState, outbreakId: string, day: number): void {
    const at = state.statuses.findIndex(status => status.id === outbreakId), outbreak = state.statuses[at];
    if (!outbreak || outbreak.liftedOnDay !== null) return;
    state.statuses[at] = liftStatus(outbreak, day);
    for (const person of state.npcs) if (person.cultivation.plague?.outbreakId === outbreakId && atThePlace(state, person, outbreak.areaId, day)) {
        settleNativePlague(state, person.id, Math.min(day, person.cultivation.plague.endsOnDay));
        const personAt = state.npcs.findIndex(row => row.id === person.id), current = state.npcs[personAt];
        if (current.status === 'alive') state.npcs[personAt] = { ...current, cultivation: { ...current.cultivation, plague: null } };
    }
    const fact = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'public', locationId: outbreak.areaId,
        summary: 'The local plague outbreak ended.', data: { plagueOutbreakEnded: outbreakId } }), { recur: false });
    publish(state, fact);
}

export function spreadPlagueAfterArrival(state: WorldState, personId: string, day: number, arrivedAt?: string): void {
    const person = state.npcs.find(person => person.id === personId);
    if (!person || !isTheWorldsToMove(person) || person.status !== 'alive' || !activePlague(bodyOf(person), day)) return;
    const placeId = arrivedAt ?? routineLocationOf({ ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 }, person);
    if (placeId && !plagueHere(state, placeId, day)) beginPlagueOutbreak(state, placeId, day);
}

/** Settlement starts are rare annual rates; existing outbreaks have finite monthly appointments. */
export function plagueOutbreaksThisYear(state: WorldState, year: number, day: number): void {
    const susceptiblePlaces = new Set<string>(), involvedPlaces = new Set<string>();
    const addAncestors = (id: string, places: Set<string>) => {
        let place = getLocation(state, id);
        while (place && !places.has(place.id)) {
            places.add(place.id); place = place.parentId ? getLocation(state, place.parentId) : null;
        }
    };
    for (const person of state.npcs) if (person.status === 'alive' && person.locationId) {
        if (isTheWorldsToMove(person) && plagueSusceptibility(bodyOf(person)) > 0) addAncestors(person.locationId, susceptiblePlaces);
        if (isPlayerInvolved(state, person)) addAncestors(person.locationId, involvedPlaces);
    }
    const contact = playerAtTheContact(state);
    if (contact) addAncestors(contact.placeId, involvedPlaces);
    const pool = state.locations.filter(place => place.kind === 'settlement' && !plagueHere(state, place.id, day)
        && susceptiblePlaces.has(place.id));
    for (const place of pool.filter(place => involvedPlaces.has(place.id)))
        if (forStream(state.seed, 'plague-outbreak-exact', place.id, year).chance(0.01)) beginPlagueOutbreak(state, place.id, day);
    for (const place of drawBackgroundIncidents(pool.filter(place => !involvedPlaces.has(place.id)).map(value => ({ value, rate: 0.01 })),
        forStream(state.seed, 'plague-outbreak-starts', year), 2)) beginPlagueOutbreak(state, place.id, day);
}
