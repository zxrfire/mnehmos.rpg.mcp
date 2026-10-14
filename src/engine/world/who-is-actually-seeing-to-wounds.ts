import { appointHouseWorker, houseAppointment } from './internal-affairs-puts-somebody-to-the-work.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { refiningOrdinalFor } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
/** Care is offered by a living person doing that work, on the ground where they do it. */
import { getOccupation, MORTAL_PHYSICIAN_JOB } from '../../data/cultivation/mortal-world.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { roomForHouseWork } from './where-a-house-does-its-work.js';
import { createNpc, type NpcRecord } from './npc-state.js';
import { routineOf } from './npc-routines.js';
import { whoIsAtAClosedLesson } from './where-a-master-takes-their-own-disciples.js';
import type { WorldState } from './world-state.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { whatTheyHold } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import type { LocationRecord } from './locations.js';
import { ordinarySettlementKind } from './the-work-an-ordinary-mortal-does.js';

export { MORTAL_PHYSICIAN_JOB };
export function mortalPhysicianJob() { return getOccupation(MORTAL_PHYSICIAN_JOB)!; }
type CareRead = Pick<WorldState, 'locations' | 'npcs' | 'factions' | 'currentDay' | 'seed' | 'currentHour'> & Partial<Pick<WorldState, 'history'>>;

/** The catalog's clinical ground remains a place after its practitioner leaves. */
export function townHasAClinic(town: Pick<LocationRecord, 'kind' | 'tags'>): boolean {
    const kind = ordinarySettlementKind(town);
    return kind !== null && mortalPhysicianJob().settlements.includes(kind);
}

export function isAMortalPhysician(npc: NpcRecord): boolean {
    return npc.identity.occupation === mortalPhysicianJob().name && npc.cultivation.realmOrdinal === 0;
}

/** One ordinary practitioner where the occupation catalog says its work exists. */
export function seedTownPhysicians(state: WorldState, onDay: number): NpcRecord[] {
    const job = mortalPhysicianJob();
    const made: NpcRecord[] = [];
    const names = new Set(state.npcs.map(n => n.name));
    for (const town of state.locations) {
        if (!townHasAClinic(town)) continue;
        const id = `npc-${town.id}-${job.id}`;
        if (state.npcs.some(n => n.id === id)) continue;
        const npc = createNpc(state.seed, { id, bornOnDay: onDay - 30 * DAYS_PER_YEAR, onDay,
            locationId: town.id, occupation: job.name, cultivation: { realmOrdinal: 0 },
            takenNames: names });
        names.add(npc.name);
        state.npcs.push(npc);
        made.push(npc);
    }
    return made;
}

/** Opening activities are written after the ordinary life has been made. */
export function givePhysiciansTheirOpeningWork(state: WorldState, onDay: number): void {
    for (const npc of state.npcs) {
        if (!isAMortalPhysician(npc)) continue;
        npc.activity = { kind: 'the_work_of_their_rank', note: 'Seeing to patients.',
            withIds: [], sinceDay: onDay, untilDay: null };
    }
}

export function physicianIsWorking(state: CareRead, npc: NpcRecord): boolean {
    const appointed = houseAppointment(state, npc)?.data.job === 'tending_the_sick' && medicalGradeOf(npc) !== null;
    if (npc.status !== 'alive' || (!isAMortalPhysician(npc) && !appointed)) return false;
    const routine = routineOf(state, npc);
    return !routine.home && routine.activity?.kind === 'the_work_of_their_rank'
        && routine.activity.withIds.length === 0 && !routine.activity.thingId && !npc.activity?.redirect;
}

/** A duty is a reading of the current roll and work; no second staff roster is stored. */
export function whoDispensesAtTheHouse(state: CareRead, houseId: string): NpcRecord | null {
    const house = state.factions.find(h => h.id === houseId && h.dissolvedOnDay === null);
    if (!house?.seatLocationId) return null;
    const inside = new Set(state.locations.filter(l => l.controllingFactionId === houseId
        || l.data.factionId === houseId).map(l => l.id));
    const careRoom = roomForHouseWork(state.locations, houseId, 'infirmary');
    if (!careRoom) return null;
    const lessons = whoIsAtAClosedLesson(state, { seatId: house.seatLocationId, inside,
        day: Math.floor(state.currentDay) });
    const offices = portfoliosIn({ npcs: state.npcs, locations: state.locations, sectId: houseId,
        rankCount: house.ranks.length, roll: state.npcs.filter(n => n.status === 'alive' && n.factionId === houseId)
            .map(n => ({ id: n.id, rankIndex: n.factionRankIndex })) });
    return state.npcs.filter(npc => {
        if (npc.status !== 'alive' || npc.factionId !== houseId || npc.factionRankIndex < 0
            || npc.locationId === null || (npc.locationId !== house.seatLocationId && !inside.has(npc.locationId))
            || npc.activity?.redirect || lessons.has(npc.id) || whatTheyHold(offices, npc.id).length > 0) return false;
        const routine = routineOf(state, npc);
        // A stored room keeps its physical claim. Only seat-derived duty, or work
        // already on clinical ground, can be read as dispensing medicine.
        return !routine.home && routine.locationId !== null
            && (routine.locationId === house.seatLocationId || routine.locationId === careRoom.id)
            && routine.activity?.kind === 'the_work_of_their_rank'
            && !routine.activity.thingId && routine.activity.withIds.length === 0;
    }).sort((a, b) => a.factionRankIndex - b.factionRankIndex || a.id.localeCompare(b.id))[0] ?? null;
}

/** Clinical suitability comes from the occupation or the arts they actually know. */
export function medicalGradeOf(person: NpcRecord): TechniqueGrade | null {
    let grade: TechniqueGrade | null = person.identity.occupation === mortalPhysicianJob().name ? 'mortal' : null;
    for (const id of person.cultivation.techniqueIds) {
        const art = getTechnique(id);
        if (!art || art.category !== 'support' || !art.subjects.includes('alchemy')
            || art.requiredOrdinal > person.cultivation.realmOrdinal) continue;
        if (grade === null || refiningOrdinalFor(art.grade) > refiningOrdinalFor(grade)) grade = art.grade;
    }
    return grade;
}

export function appointHouseHealer(state: WorldState, houseId: string, day: number): NpcRecord | null {
    const room = roomForHouseWork(state.locations, houseId, 'infirmary');
    return room ? appointHouseWorker(state, { houseId, day, room, job: 'tending_the_sick',
        suitable: person => medicalGradeOf(person) !== null }) : null;
}

/** Reading care never appoints somebody or recalls an absent worker. */
export function whoTendsTheSick(state: WorldState, houseId: string, day: number): NpcRecord | null {
    const house = state.factions.find(row => row.id === houseId && row.dissolvedOnDay === null);
    const room = roomForHouseWork(state.locations, houseId, 'infirmary');
    if (!house || !room) return null;
    return state.npcs.find(person => person.status === 'alive' && person.factionId === houseId
        && houseAppointment(state, person)?.data.job === 'tending_the_sick'
        && !person.activity?.redirect
        && [house.seatLocationId, room.id].includes(locationOfNpcOnItsJourney(state, person, day))
        && routineOf(state, person).activity?.houseWorkFactId === person.activity?.houseWorkFactId
        && !routineOf(state, person).home) ?? null;
}
