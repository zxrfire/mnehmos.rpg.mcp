import { settleHallService } from './the-people-posted-to-a-houses-halls.js';
/** A funded clinical course rests one real member for the catalog's month. */
import { getPrice, DAYS_PER_MONTH } from '../../data/cultivation/mortal-world.js';
import { treatWorstInjuries, untreatedInjuryCount } from '../cultivation/injuries.js';
import { medicineReaches } from '../cultivation/what-grade-of-medicine-a-wound-needs.js';
import { isPermanentWound } from '../../data/cultivation/wounds.js';
import { LOCAL_WALK_DAYS } from './local-walking-cost.js';
import { isAwayOnSomething, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { locationOfNpcOnItsJourney, whenTheyReachTheirPost } from './places-on-the-way.js';
import { roomForHouseWork } from './where-a-house-does-its-work.js';
import { appointHouseHealer, whoTendsTheSick, medicalGradeOf } from './who-is-actually-seeing-to-wounds.js';
import { getRegion, HOME_REGION_ID } from '../../data/cultivation/regions.js';
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
    const atHallPost = patient.activity?.kind === 'stationed'
        && state.locations.some(place => place.id === patient.locationId && place.data.factionId === patient.factionId)
        && locationOfNpcOnItsJourney(state, patient, day) === patient.locationId;
    if (!patient.factionId || !isTheWorldsToMove(patient) || patient.status !== 'alive'
        || patient.activity?.houseCareFactId || patient.activity?.thingId || patient.activity?.withIds.length
        || patient.activity?.redirect || (patient.activity && isAwayOnSomething(patient.activity.kind) && !atHallPost)) return false;
    const house = state.factions.find(row => row.id === patient.factionId && row.dissolvedOnDay === null);
    const room = house && roomForHouseWork(state.locations, house.id, 'infirmary');
    const ground = locationOfNpcOnItsJourney(state, patient, day);
    if (!house || !room || (!atHallPost && ![house.seatLocationId, room.id].includes(ground))) return false;
    appointHouseHealer(state, house.id, day);
    const healer = whoTendsTheSick(state, house.id, day);
    if (!healer || medicalGradeOf(healer) === null || healer.id === patient.id || healer.activity!.withIds.length) return false;
    const reachable = patient.cultivation.injuries.filter(wound => !wound.treated && !isPermanentWound(wound.woundType)
        && medicineReaches('mortal', wound.severity, patient.cultivation.realmOrdinal))
        .sort((a, b) => ['minor', 'serious', 'crippling'].indexOf(b.severity)
            - ['minor', 'serious', 'crippling'].indexOf(a.severity));
    if (!reachable.length) return false;
    const provinceId = theProvinceAround(state.locations, room.id);
    const province = state.locations.find(place => place.id === provinceId);
    const regionId = typeof province?.data.catalogRegionId === 'string' ? province.data.catalogRegionId : HOME_REGION_ID;
    const groundPrice = priceMultiplierInArea(state.statuses, state.locations, room.id, Math.floor(day),
        getPrice(PHYSICIAN_COURSE_PRICE)!.category);
    const quote = carePricesOnThisGround(getRegion(regionId) ? regionId : null, groundPrice);
    const purse = Number(house.resources.spirit_stones ?? 0);
    const courses = Math.min(reachable.length, Math.floor(purse / quote.perWound));
    if (courses === 0) return false;
    const price = Math.max(quote.restingPrice, courses * quote.perWound);
    if (purse < price) return false;
    const injuryIds = reachable.slice(0, courses).map(injury => injury.id);
    const approach = atHallPost ? { ...patient, locationId: room.id, activity: {
        ...patient.activity!, kind: 'stationed' as const, sinceDay: day,
        fromLocationId: ground === room.id ? null : ground, untilDay: null } } : null;
    const begins = approach ? whenTheyReachTheirPost(state.locations, approach)
        : day + (ground === room.id ? 0 : LOCAL_WALK_DAYS);
    if (begins === null) return false;
    const until = begins + DAYS_PER_MONTH;
    settleHallService(state, day, new Set([patient.id]));
    patient = state.npcs[patientAt]!;
    const fact = appendWorldFact(state, makeFact({ day, kind: 'gathering', locationId: room.id,
        factionIds: [house.id], visibility: 'faction', causes: [healer.activity!.houseWorkFactId!],
        actors: [{ id: healer.id, name: healer.name, role: 'clinician' },
            { id: patient.id, name: patient.name, role: 'patient' }],
        summary: `${house.name} paid ${healer.name} ${price} spirit stones for ${patient.name}'s course of care.`,
        data: { houseClinicalCare: true, houseId: house.id, healerId: healer.id,
            patientId: patient.id, injuryIds: JSON.stringify(injuryIds), beginsOnDay: begins, untilDay: until, stones: price,
            ...(atHallPost ? { previousHallPost: JSON.stringify(patient.activity),
                previousPostLocationId: patient.locationId! } : {}) } }),
        { bystanders: false, recur: false });
    house.resources.spirit_stones = purse - price;
    const clinicianAt = state.npcs.findIndex(person => person.id === healer.id);
    state.npcs[clinicianAt] = { ...healer, spiritStones: healer.spiritStones + price,
        activity: { ...healer.activity!, withIds: [patient.id], houseCareProviderFactId: fact.id } };
    state.npcs[patientAt] = { ...patient, ...(approach ? { locationId: room.id } : {}),
        activity: { ...patient.activity, ...(approach ? approach.activity : {}),
            kind: approach ? 'stationed' : 'idle', note: 'Receiving a course of care.',
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
        const stayed = patient.status === 'alive' && !!house && !!room && ([house.seatLocationId, room.id].includes(ground)
                || patientHeld && patient.activity?.kind === 'stationed' && day < Number(fact.data.beginsOnDay));
        const provider = healer?.activity;
        const legacy = provider?.houseCareProviderFactId === undefined && provider?.kind === 'the_work_of_their_rank'
            && houseAppointment(state, healer!)?.data.job === 'tending_the_sick'
            && provider.withIds.length === 1 && provider.withIds[0] === patient.id;
        const ownWork = !!provider && (provider.houseCareProviderFactId === fact.id || legacy)
            && provider.kind === 'the_work_of_their_rank'
            && (fact.causes.length === 0 || fact.causes.includes(provider.houseWorkFactId ?? ''));
        const stillServing = stayed && patientHeld && ownWork && healer?.status === 'alive' && house && room
            && healer.activity?.withIds.includes(patient.id)
            && [house.seatLocationId, room.id].includes(locationOfNpcOnItsJourney(state, healer, day));
        const done = typeof fact.data.untilDay === 'number' && day >= fact.data.untilDay;
        if (stillServing && patient.status === 'alive' && !done) continue;
        let injuries = patient.cultivation.injuries;
        if (stillServing && stayed && done) {
            const ids: string[] = typeof fact.data.injuryIds === 'string' ? JSON.parse(fact.data.injuryIds)
                : typeof fact.data.injuryId === 'string' ? [fact.data.injuryId] : [];
            const targets = injuries.filter(wound => ids.includes(wound.id) && !isPermanentWound(wound.woundType));
            const treated = treatWorstInjuries(targets, targets.length,
                severity => medicineReaches('mortal', severity, patient.cultivation.realmOrdinal));
            const after = new Map(treated.injuries.map(wound => [wound.id, wound]));
            injuries = injuries.map(wound => after.get(wound.id) ?? wound);
            closed += treated.treatedCount;
        }
        const appointment = patientHeld && patient.status === 'alive' ? houseAppointment(state, patient) : null;
        let resumed: NpcRecord['activity'] = appointment ? { kind: 'the_work_of_their_rank' as const,
            note: String(appointment.data.job).replaceAll('_', ' ') + '.', withIds: [], sinceDay: day,
            untilDay: null, houseWorkFactId: appointment.id } : null;
        let resumedLocation = patient.locationId;
        if (patientHeld && patient.status === 'alive' && typeof fact.data.previousHallPost === 'string'
            && typeof fact.data.previousPostLocationId === 'string') {
            const post = JSON.parse(fact.data.previousHallPost) as NonNullable<NpcRecord['activity']>;
            if (post.untilDay == null || post.untilDay > day) {
                resumedLocation = fact.data.previousPostLocationId;
                resumed = { ...post, sinceDay: day, fromLocationId: ground,
                    houseWorkPayFactId: undefined };
            } else resumed = null;
        }
        state.npcs[at] = { ...patient, locationId: resumedLocation, activity: patientHeld ? resumed : patient.activity, cultivation: { ...patient.cultivation, injuries,
            untreatedInjuries: untreatedInjuryCount(injuries) } };
        if (healer && provider && (provider.houseCareProviderFactId === fact.id || legacy)) {
            const continuing = { ...provider };
            if (ownWork) continuing.withIds = provider.withIds.filter(id => id !== patient.id);
            delete continuing.houseCareProviderFactId;
            state.npcs[healerAt] = { ...healer, activity: continuing };
        }
        appendWorldFact(state, makeFact({ day, kind: 'gathering', locationId: ground, visibility: 'faction',
            factionIds: [String(fact.data.houseId)], causes: [fact.id], actors: fact.actors,
            summary: stillServing && stayed && done ? `${patient.name}'s course of care ended.`
                : `${patient.name}'s course of care was interrupted.`,
            data: { houseClinicalCareEnded: fact.id, completed: !!(stillServing && stayed && done) } }),
            { bystanders: false, recur: false });
    }
    return closed;
}
