/** Paid, dated cultivation at home; a shut door is not a disappearance. */
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { STONES_PER_YEAR_OF_SECLUSION } from '../cultivation/origin.js';
import { isRealmBoundary } from '../cultivation/realms.js';
import { forStream } from '../cultivation/rng.js';
import { drawBackgroundIncidents, isPlayerInvolved } from './background-incident-draw.js';
import { isAwayOnSomething, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { theLodgingsOfAHouse, whichRoomARungGets } from './the-room-a-house-gives-you.js';
import { whoHoldsThisPlace } from './somewhere-that-is-theirs.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { whatTheyHold } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import type { WorldState } from './world-state.js';

export function inClosedDoorCultivation(person: Pick<NpcRecord, 'activity'>, day: number): boolean {
    return person.activity?.kind === 'closed_door_cultivation'
        && person.activity.untilDay != null && day < person.activity.untilDay;
}

/** The accepted residence must already belong to this person; no journey or key is invented. */
export function beginClosedDoorCultivation(state: WorldState, id: string, day: number, days: number): boolean {
    const at = state.npcs.findIndex(person => person.id === id), person = state.npcs[at];
    if (!person || !isTheWorldsToMove(person) || person.status !== 'alive' || person.cultivation.realmOrdinal <= 0
        || !Number.isFinite(days) || days < 1 || day + days > person.cultivation.lifespanEndsOnDay
        || isAwayOnSomething(person.activity?.kind ?? 'idle')
        || person.activity?.untilDay != null && person.activity.untilDay > day
        || person.activity?.withIds.length) return false;
    const cost = days * STONES_PER_YEAR_OF_SECLUSION / DAYS_PER_YEAR;
    if (person.spiritStones < cost) return false;
    const house = state.factions.find(row => row.id === person.factionId && row.dissolvedOnDay === null);
    const own = state.locations.find(place => place.id === person.locationId && whoHoldsThisPlace(place) === id);
    const home = house && (person.locationId === house.seatLocationId
        || state.locations.some(place => place.id === person.locationId && place.controllingFactionId === house.id))
        ? whichRoomARungGets(theLodgingsOfAHouse(state, house.id), person.factionRankIndex)?.locationId : own?.id;
    if (!home) return false;
    state.npcs[at] = { ...person, spiritStones: person.spiritStones - cost, updatedOnDay: day,
        activity: { kind: 'closed_door_cultivation', sinceDay: day, untilDay: day + days,
            standingIn: home, withIds: [], note: 'In closed-door cultivation.' } };
    appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: house ? 'faction' : 'secret', locationId: person.locationId,
        actors: [{ id, name: person.name, role: 'cultivator' }], factionIds: house ? [house.id] : [],
        summary: `${person.name} entered closed-door cultivation until day ${day + days}.`,
        data: { closedDoorCultivation: true, endsOnDay: day + days, stones: cost } }), { bystanders: false });
    return true;
}

/** The callback is the world's existing advancement and death writer. */
export function settleClosedDoorCultivation(state: WorldState, day: number,
    review: (id: string, onDay: number) => void, ids?: ReadonlySet<string>): number {
    let settled = 0;
    for (let at = 0; at < state.npcs.length; at++) {
        const person = state.npcs[at], activity = person.activity;
        if (ids && !ids.has(person.id) || person.status !== 'alive' || activity?.kind !== 'closed_door_cultivation'
            || activity.untilDay == null || activity.untilDay > day) continue;
        const due = activity.untilDay;
        state.npcs[at] = { ...person, updatedOnDay: due, activity: null };
        review(person.id, due);
        appendWorldFact(state, makeFact({ day: due, kind: 'opportunity', visibility: 'secret', locationId: person.locationId,
            actors: [{ id: person.id, name: person.name, role: 'cultivator' }],
            summary: `${person.name}'s closed-door cultivation ended.`,
            data: { closedDoorCultivationEnded: true } }), { bystanders: false });
        settled++;
    }
    return settled;
}

/** An actual attack on their own house is word worth opening the door for. */
export function interruptClosedDoorCultivation(state: WorldState, houseId: string, day: number, causeId: string): number {
    let interrupted = 0;
    for (let at = 0; at < state.npcs.length; at++) {
        const person = state.npcs[at], activity = person.activity;
        if (person.factionId !== houseId || person.status !== 'alive' || !inClosedDoorCultivation(person, day)) continue;
        const refund = (activity!.untilDay! - day) * STONES_PER_YEAR_OF_SECLUSION / DAYS_PER_YEAR;
        state.npcs[at] = { ...person, spiritStones: person.spiritStones + refund, activity: null, updatedOnDay: day };
        appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'faction', causes: [causeId],
            factionIds: [houseId], locationId: person.locationId,
            actors: [{ id: person.id, name: person.name, role: 'called_out' }],
            summary: `${person.name}'s house called them out of closed-door cultivation.`,
            data: { closedDoorCultivationInterrupted: true, refundedStones: refund } }), { bystanders: false });
        interrupted++;
    }
    return interrupted;
}

/** Entry is an annual rate on available people, with bounded distant decisions. */
export function closedDoorCultivationThisYear(state: WorldState, year: number, day: number): string[] {
    const offices = new Set<string>();
    for (const house of state.factions.filter(row => row.dissolvedOnDay === null)) {
        const roll = state.npcs.filter(person => person.status === 'alive' && person.factionId === house.id);
        const postings = portfoliosIn({ locations: state.locations, sectId: house.id,
            roll: roll.map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex })), rankCount: house.ranks.length });
        for (const person of roll) if (whatTheyHold(postings, person.id).length)
            offices.add(person.id);
    }
    const candidates = state.npcs.filter(person => isTheWorldsToMove(person) && person.status === 'alive'
        && person.cultivation.realmOrdinal > 0 && !isAwayOnSomething(person.activity?.kind ?? 'idle')
        && !(person.activity?.untilDay != null && person.activity.untilDay > day) && !person.activity?.withIds.length);
    const rate = (person: NpcRecord) => isRealmBoundary(person.cultivation.realmOrdinal) ? 0.18
        : person.factionRankIndex >= 3 && !offices.has(person.id) ? 0.12 : 0.02;
    const selected = [...candidates.filter(person => isPlayerInvolved(state, person)
        && forStream(state.seed, 'closed-door-entry', year, person.id).chance(rate(person))),
        ...drawBackgroundIncidents(candidates.filter(person => !isPlayerInvolved(state, person))
            .map(value => ({ value, rate: rate(value) })), forStream(state.seed, 'closed-door-background', year), 8)];
    const started: string[] = [];
    for (const person of selected) {
        const yearsLeft = (person.cultivation.lifespanEndsOnDay - day) / DAYS_PER_YEAR;
        const years = Math.max(0.25, yearsLeft * forStream(state.seed, 'closed-door-span', year, person.id).next() * 0.01);
        const days = Math.min(years * DAYS_PER_YEAR, person.spiritStones / STONES_PER_YEAR_OF_SECLUSION * DAYS_PER_YEAR);
        if (beginClosedDoorCultivation(state, person.id, day, days)) started.push(person.id);
    }
    return started;
}
