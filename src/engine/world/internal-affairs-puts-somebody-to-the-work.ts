/** Internal Affairs assigns house work through the ordinary decision odds. */
import { oddsOf, type AttemptInput } from '../social-leverage/an-attempt-to-move-somebody.js';
import { forStream } from '../cultivation/rng.js';
import { theInternalAffairsElderIn } from './a-house-expects-somebody-it-took-on.js';
import { relationshipWith, isAwayOnSomething, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { factsWithDataValue, witnessIndexFor } from './witness-reaction-index.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact, type HistoricalFact } from './history.js';
import type { LocationRecord } from './locations.js';
import type { WorldState } from './world-state.js';
import { routeQueriesFor } from './locations.js';
import type { RoomPurpose } from './architecture.js';

export function personnelManager(state: WorldState, houseId: string): NpcRecord | null {
    const house = state.factions.find(row => row.id === houseId && row.dissolvedOnDay === null);
    if (!house) return null;
    const roll = state.npcs.filter(person => person.status === 'alive' && person.factionId === houseId);
    const holder = theInternalAffairsElderIn(state.locations, house,
        roll.map(person => ({ id: person.id, rankIndex: person.factionRankIndex })), state.npcs);
    return roll.find(person => person.id === holder) ?? roll.sort((a, b) =>
        b.factionRankIndex - a.factionRankIndex || b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
        || a.id.localeCompare(b.id))[0] ?? null;
}

/** Current work references its appointment; there is no parallel staff roll. */
export function houseAppointment(state: Partial<Pick<WorldState, 'history'>>, person: NpcRecord): HistoricalFact | null {
    const id = person.activity?.houseWorkFactId;
    const fact = id && state.history ? witnessIndexFor(state as Pick<WorldState, 'history'>).byId.get(id) : null;
    return fact?.data.houseWorkAppointment === true && fact.data.houseId === person.factionId
        && fact.actors.some(actor => actor.id === person.id && actor.role === 'appointed_worker') ? fact : null;
}

export function appointHouseWorker(state: WorldState, input: {
    houseId: string; job: string; room: LocationRecord; day: number;
    suitable: (person: NpcRecord) => boolean;
    /** Hard availability is separate from the manager's opinion of suitability. */
    eligible?: (person: NpcRecord) => boolean;
    /** A resident hall post uses the ordinary passage to its actual room. */
    posted?: boolean;
    /** A player nomination proposes work without writing their body or accepted post. */
    applicant?: NpcRecord;
    initialPlacement?: boolean;
    note?: string;
    calendar?: NonNullable<NpcRecord['activity']>['houseWorkSchedule'];
    purpose?: RoomPurpose;
}): NpcRecord | null {
    const working = state.npcs.find(person => person.status === 'alive' && person.factionId === input.houseId
        && houseAppointment(state, person)?.data.job === input.job);
    if (working && !input.applicant) return working;
    const holder = personnelManager(state, input.houseId);
    const theirOwnDecision = holder?.id === input.applicant?.id && !!holder && !isTheWorldsToMove(holder);
    const manager = theirOwnDecision ? input.applicant! : holder;
    if (!manager || !isTheWorldsToMove(manager) && !theirOwnDecision
        || manager.activity?.untilDay != null && manager.activity.untilDay >= Math.floor(input.day)) return null;
    const inside = new Set(state.locations.filter(place => place.data.factionId === input.houseId
        || place.controllingFactionId === input.houseId).map(place => place.id));
    const house = state.factions.find(row => row.id === input.houseId)!;
    if (house.seatLocationId) inside.add(house.seatLocationId);
    if (!inside.has(locationOfNpcOnItsJourney(state, manager, input.day) ?? '')) return null;
    const party = (person: NpcRecord) => ({ id: person.id, name: person.name,
        ordinal: person.cultivation.realmOrdinal, charm: person.cultivation.attributes.charm,
        factionId: person.factionId, alignment: house.alignment, ranked: true });
    const routes = input.posted ? routeQueriesFor(state.locations) : null;
    const candidates = (input.applicant ? [input.applicant] : state.npcs).filter(person => person.status === 'alive' && (isTheWorldsToMove(person) || person.id === input.applicant?.id)
        && person.factionId === input.houseId && !person.activity?.redirect
        && (!person.activity || !isAwayOnSomething(person.activity.kind))
        && !(person.activity?.untilDay != null && person.activity.untilDay >= Math.floor(input.day))
        && !person.activity?.thingId && !person.activity?.withIds.length
        && !person.activity?.houseWorkFactId
        && (!input.eligible || input.eligible(person))
        && (input.posted
            ? inside.has(locationOfNpcOnItsJourney(state, person, input.day) ?? '')
                && (input.initialPlacement || routes!.treeFrom(locationOfNpcOnItsJourney(state, person, input.day)!).days.has(input.room.id))
            : [house.seatLocationId, input.room.id].includes(locationOfNpcOnItsJourney(state, person, input.day))));
    const review = [input.houseId, input.job, manager.id, Math.floor(input.day / 365),
        candidates.map(person => person.id).sort().join(','), ...(input.applicant ? [input.day] : [])].join(':');
    if (factsWithDataValue(state, 'housePersonnelReview', review).length) return null;
    const proposals = candidates.map(person => {
        const tie = relationshipWith(manager, person.id);
        const attempt: AttemptInput = { actor: party(person), subject: party(manager), onDay: input.day,
            ask: input.suitable(person) ? 'a_courtesy' : 'against_their_interest',
            theirTie: tie ? { active: true, strength: Math.max(0, tie.standing) } : null,
            theyWantSomethingFromYou: input.suitable(person),
            rng: forStream(state.seed, 'house-personnel', review, person.id) };
        return { person, attempt, odds: oddsOf(attempt).odds };
    }).sort((a, b) => b.odds - a.odds || a.person.id.localeCompare(b.person.id));
    // A player personnel holder has already made this choice by requesting their own work.
    const chosen = theirOwnDecision ? candidates[0] : proposals.find(proposal => proposal.attempt.rng.chance(proposal.odds))?.person;
    const fact = appendWorldFact(state, makeFact({ day: input.day, kind: 'gathering',
        locationId: input.room.id, factionIds: [input.houseId], visibility: 'faction',
        actors: [{ id: manager.id, name: manager.name, role: 'personnel_manager' },
            ...(chosen ? [{ id: chosen.id, name: chosen.name, role: 'appointed_worker' }] : [])],
        summary: chosen ? `${manager.name} appointed ${chosen.name} to ${input.calendar?.rota ? 'the chore rota' : input.job.replaceAll('_', ' ')}.`
            : `${manager.name} appointed nobody to ${input.calendar?.rota ? 'the chore rota' : input.job.replaceAll('_', ' ')}.`,
        data: { housePersonnelReview: review, houseWorkAppointment: !!chosen,
            houseId: input.houseId, job: input.job,
            ...(input.purpose ? { workPurpose: input.purpose } : {}),
            ...(chosen ? { serviceOrdinal: chosen.cultivation.realmOrdinal } : {}) } }), { bystanders: false, recur: false });
    if (!chosen) return null;
    const at = state.npcs.findIndex(person => person.id === chosen.id);
    const from = locationOfNpcOnItsJourney(state, chosen, input.day);
    const appointed: NpcRecord = { ...(input.applicant ? chosen : state.npcs[at]!), ...(input.posted ? { locationId: input.room.id } : {}),
        activity: { kind: input.posted ? 'stationed' : 'the_work_of_their_rank',
            note: input.note ?? input.job.replaceAll('_', ' ') + '.', withIds: [], sinceDay: input.day,
            untilDay: null, houseWorkFactId: fact.id,
            ...(input.calendar ? { houseWorkSchedule: input.calendar } : {}),
            ...(input.posted ? { fromLocationId: input.initialPlacement ? null : from, returnTo: house.seatLocationId } : {}) } };
    if (!input.applicant) state.npcs[at] = appointed;
    return appointed;
}
