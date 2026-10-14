/** A funded clinical course rests one real member for the catalog's month. */
import { getPrice, DAYS_PER_MONTH } from '../../data/cultivation/mortal-world.js';
import { treatWorstInjuries, untreatedInjuryCount } from '../cultivation/injuries.js';
import { medicineReaches } from '../cultivation/what-grade-of-medicine-a-wound-needs.js';
import { isPermanentWound } from '../../data/cultivation/wounds.js';
import { LOCAL_WALK_DAYS } from './local-walking-cost.js';
import { isAwayOnSomething, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { roomForHouseWork } from './where-a-house-does-its-work.js';
import { appointHouseHealer, whoTendsTheSick, medicalGradeOf } from './who-is-actually-seeing-to-wounds.js';
import { HOME_REGION_ID } from '../../data/cultivation/regions.js';
import { theProvinceAround } from './ground-holder.js';
import { priceMultiplierInArea } from './what-is-true-of-a-place-right-now.js';
import { carePricesOnThisGround, PHYSICIAN_COURSE_PRICE } from './what-a-physicians-care-costs.js';
import { houseAppointment } from './internal-affairs-puts-somebody-to-the-work.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithData, factsWithDataValue } from './witness-reaction-index.js';
import type { WorldState } from './world-state.js';

export function beginHouseCare(state: WorldState, patient: NpcRecord, day: number,
    onDue?: (personId: string, day: number) => void): boolean {
    const patientAt = state.npcs.findIndex(person => person.id === patient.id);
    if (patientAt < 0) return false;
    patient = state.npcs[patientAt]!;
    if (!patient.factionId || !isTheWorldsToMove(patient) || patient.status !== 'alive'
        || patient.activity?.houseCareFactId || patient.activity?.thingId || patient.activity?.withIds.length
        || patient.activity?.redirect || (patient.activity && isAwayOnSomething(patient.activity.kind))) return false;
    const house = state.factions.find(row => row.id === patient.factionId && row.dissolvedOnDay === null);
    const room = house && roomForHouseWork(state.locations, house.id, 'infirmary');
    const ground = locationOfNpcOnItsJourney(state, patient, day);
    if (!house || !room || ![house.seatLocationId, room.id].includes(ground)) return false;
    appointHouseHealer(state, house.id, day);
    const healer = whoTendsTheSick(state, house.id, day);
    if (!healer || medicalGradeOf(healer) === null || healer.id === patient.id || healer.activity!.withIds.length) return false;
    const injury = patient.cultivation.injuries.filter(wound => !wound.treated && !isPermanentWound(wound.woundType)
        && medicineReaches('mortal', wound.severity, patient.cultivation.realmOrdinal))
        .sort((a, b) => ['minor', 'serious', 'crippling'].indexOf(b.severity)
            - ['minor', 'serious', 'crippling'].indexOf(a.severity))[0];
    if (!injury) return false;
    const provinceId = theProvinceAround(state.locations, room.id);
    const province = state.locations.find(place => place.id === provinceId);
    const regionId = typeof province?.data.catalogRegionId === 'string' ? province.data.catalogRegionId : HOME_REGION_ID;
    const groundPrice = priceMultiplierInArea(state.statuses, state.locations, room.id, Math.floor(day),
        getPrice(PHYSICIAN_COURSE_PRICE)!.category);
    const price = carePricesOnThisGround(regionId, groundPrice).perWound;
    const purse = Number(house.resources.spirit_stones ?? 0);
    if (purse < price) return false;
    const begins = day + (ground === room.id ? 0 : LOCAL_WALK_DAYS);
    const until = begins + DAYS_PER_MONTH;
    const fact = appendWorldFact(state, makeFact({ day, kind: 'gathering', locationId: room.id,
        factionIds: [house.id], visibility: 'faction',
        actors: [{ id: healer.id, name: healer.name, role: 'clinician' },
            { id: patient.id, name: patient.name, role: 'patient' }],
        summary: `${house.name} paid ${healer.name} ${price} spirit stones for ${patient.name}'s course of care.`,
        data: { houseClinicalCare: true, houseId: house.id, healerId: healer.id,
            patientId: patient.id, injuryId: injury.id, beginsOnDay: begins, untilDay: until, stones: price } }),
        { bystanders: false, recur: false });
    house.resources.spirit_stones = purse - price;
    const clinicianAt = state.npcs.findIndex(person => person.id === healer.id);
    state.npcs[clinicianAt] = { ...healer, spiritStones: healer.spiritStones + price,
        activity: { ...healer.activity!, withIds: [patient.id] } };
    state.npcs[patientAt] = { ...patient, activity: { ...patient.activity, kind: 'idle', note: 'Receiving a course of care.',
        withIds: [healer.id], sinceDay: day, untilDay: until, houseCareFactId: fact.id } };
    onDue?.(patient.id, until);
    return true;
}

/** The same real endpoint is settled for a background body or one being met. */
export function settleHouseCare(state: WorldState, day: number): number {
    let closed = 0;
    const ended = new Set(factsWithData(state, 'houseClinicalCareEnded')
        .map(fact => fact.data.houseClinicalCareEnded));
    for (const fact of factsWithDataValue(state, 'houseClinicalCare', true)) {
        if (ended.has(fact.id)) continue;
        const at = state.npcs.findIndex(person => person.id === fact.data.patientId);
        const patient = state.npcs[at];
        if (!patient) continue;
        const healerAt = state.npcs.findIndex(person => person.id === fact.data.healerId);
        const healer = state.npcs[healerAt];
        const room = typeof fact.locationId === 'string' ? state.locations.find(place => place.id === fact.locationId) : null;
        const house = state.factions.find(row => row.id === fact.data.houseId && row.dissolvedOnDay === null);
        const patientHeld = patient.activity?.houseCareFactId === fact.id;
        const ground = locationOfNpcOnItsJourney(state, patient, day);
        const stayed = patient.status === 'alive' && !!house && !!room && [house.seatLocationId, room.id].includes(ground);
        const stillServing = stayed && patientHeld && healer?.status === 'alive' && house && room
            && healer.activity?.withIds.includes(patient.id)
            && [house.seatLocationId, room.id].includes(locationOfNpcOnItsJourney(state, healer, day));
        const done = typeof fact.data.untilDay === 'number' && day >= fact.data.untilDay;
        if (stillServing && patient.status === 'alive' && !done) continue;
        let injuries = patient.cultivation.injuries;
        if (stillServing && stayed && done) {
            const target = injuries.find(wound => wound.id === fact.data.injuryId);
            const treated = target && !isPermanentWound(target.woundType) ? treatWorstInjuries([target], 1,
                severity => medicineReaches('mortal', severity, patient.cultivation.realmOrdinal)) : null;
            if (treated?.treatedCount) { injuries = injuries.map(wound => wound.id === target!.id ? treated.injuries[0]! : wound); closed++; }
        }
        const appointment = patientHeld && patient.status === 'alive' ? houseAppointment(state, patient) : null;
        const resumed = appointment ? { kind: 'the_work_of_their_rank' as const,
            note: String(appointment.data.job).replaceAll('_', ' ') + '.', withIds: [], sinceDay: day,
            untilDay: null, houseWorkFactId: appointment.id } : null;
        state.npcs[at] = { ...patient, activity: patientHeld ? resumed : patient.activity, cultivation: { ...patient.cultivation, injuries,
            untreatedInjuries: untreatedInjuryCount(injuries) } };
        if (healer?.activity?.withIds.includes(patient.id)) state.npcs[healerAt] = { ...healer,
            activity: { ...healer.activity, withIds: healer.activity.withIds.filter(id => id !== patient.id) } };
        appendWorldFact(state, makeFact({ day, kind: 'gathering', locationId: ground, visibility: 'faction',
            factionIds: [String(fact.data.houseId)], causes: [fact.id], actors: fact.actors,
            summary: stillServing && stayed && done ? `${patient.name}'s course of care ended.`
                : `${patient.name}'s course of care was interrupted.`,
            data: { houseClinicalCareEnded: fact.id, completed: !!(stillServing && stayed && done) } }),
            { bystanders: false, recur: false });
    }
    return closed;
}
