/**
 * A house's conclave places are held against its own pool, settled on a fixed calendar.
 * The owner's calendar ruling moves the earlier life-span-derived cycles into
 * `competition-calendars.ts`. The old catalog measured 13, 25, 100 and 500 years;
 * those choices remain, independently of future changes to a person's span.
 * Entrants stand at the grounds. Realm boards receive their share of seats
 * before ranking their own entrants; inner remains the floor for a beaten holder.
 */
import { COMPETITION_CALENDARS } from '../../data/cultivation/competition-calendars.js';
import { rankRealmBand } from '../../data/cultivation/members.js';
import { forStream } from '../cultivation/rng.js';
import { elderRungOf } from '../cultivation/leadership.js';
import { creditWhatTheyLearned, rankAField, type GatheringPlacing } from './gatherings.js';
import { isBelowTheLid } from './layers.js';
import { isAwayOnSomething, isTheWorldsToMove } from './npc-state.js';
import { abundanceOf, ordinalExpectedAt, seatsAtRank } from './promotion-inside-a-house.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** The rung a house's conclave stands on: the one under its lowest elder rung. */
export function theConclaveRungOf(rankCount: number): number {
    if (rankCount < 3) return 0;
    return Math.max(0, elderRungOf(rankCount) - 1);
}

/** The middle of the realm band this house's conclave rung stands in. */
function theHeightItIsContestedAt(house: Pick<FactionRecord, 'id' | 'ranks' | 'resources'>, rung: number): number {
    const band = rankRealmBand(house.id, rung);
    if (band) return Math.round((band.minOrdinal + band.maxOrdinal) / 2);
    const admission = Number(house.resources.admission_ordinal ?? 0);
    const power = Number(house.resources.power_ordinal ?? admission);
    return Math.round(ordinalExpectedAt(rung, house.ranks.length, admission, power));
}

/** Years between this house's conclave tournaments. */
export function yearsBetweenConclaveContestsIn(house: Pick<FactionRecord, 'id' | 'ranks' | 'resources'>): number {
    const rung = theConclaveRungOf(house.ranks.length);
    if (rung <= 0) return 0;
    return COMPETITION_CALENDARS.find(row => row.houseId === house.id && row.purpose === 'conclave')?.everyYears ?? 13;
}

/** Whether this house holds its tournament in this year. */
export function itsContestFallsIn(seed: string, house: Pick<FactionRecord, 'id' | 'ranks' | 'resources'>, year: number): boolean {
    const every = yearsBetweenConclaveContestsIn(house);
    if (every <= 0) return false;
    const phase = forStream(seed, 'conclave-contest', house.id).int(0, every - 1);
    return ((year % every) + every) % every === phase;
}

/** What one house's tournament did. */
export interface WhatTheContestSettled {
    houseId: string;
    rung: number;
    seats: number;
    entrants: number;
    /** Raised off the rung below by winning a place. */
    raised: string[];
    /** Holders beaten for their place, back at inner. */
    stepped: string[];
}

/**
 * The year's conclave tournaments. Mutates `state` in place.
 */
export function theConclavesAreContested(state: WorldState, year: number, day: number): WhatTheContestSettled[] {
    const rolls = new Map<string, number[]>();
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (npc.status !== 'alive' || npc.factionId === null || !isBelowTheLid(npc)) continue;
        const roll = rolls.get(npc.factionId);
        if (roll) roll.push(i); else rolls.set(npc.factionId, [i]);
    }

    const settled: WhatTheContestSettled[] = [];
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house)) continue;
        const rankCount = house.ranks.length;
        const rung = theConclaveRungOf(rankCount);
        if (rung <= 0) continue;
        if (!itsContestFallsIn(state.seed, house, year)) continue;
        const roll = rolls.get(house.id) ?? [];
        if (roll.length === 0) continue;

        const bar = rankRealmBand(house.id, rung)?.minOrdinal
            ?? theHeightItIsContestedAt(house, rung);
        const standing = roll.filter(i => {
            const npc = state.npcs[i]!;
            if (!isTheWorldsToMove(npc) || npc.locationId !== house.seatLocationId) return false;
            if (npc.activity && isAwayOnSomething(npc.activity.kind)) return false;
            if (npc.factionRankIndex === rung) return true;
            // The pool it is held against: the rung below, tall enough to stand
            // on the board. A contest nobody could win is not a contest.
            return npc.factionRankIndex === rung - 1 && npc.cultivation.realmOrdinal >= bar;
        });
        const holders = standing.filter(i => state.npcs[i]!.factionRankIndex === rung);
        if (standing.length <= holders.length) continue;

        const seats = Math.max(1, seatsAtRank(rung, rankCount, roll.length, abundanceOf(house)));
        const placings: GatheringPlacing[] = [];
        const rng = forStream(state.seed, 'conclave-tournament', house.id, year);
        rankAField(state, standing.map(i => state.npcs[i]!), rng, placings);
        creditWhatTheyLearned(state, placings, day);

        // Seats go to realm boards before ranking; scores never cross a realm.
        const boards = [...new Set(placings.map(p => p.bracket))].map(bracket => {
            const field = placings.filter(p => p.bracket === bracket).sort((a, b) => a.place - b.place);
            const share = seats * field.length / standing.length;
            return { field, quota: Math.floor(share), remainder: share % 1 };
        });
        const unfilled = seats - boards.reduce((sum, board) => sum + board.quota, 0);
        boards.sort((a, b) => b.remainder - a.remainder || a.field[0]!.bracket.localeCompare(b.field[0]!.bracket));
        for (let i = 0; i < unfilled; i++) boards[i % boards.length]!.quota++;
        const winners = new Set(boards.flatMap(board => board.field.slice(0, board.quota).map(p => p.npcId)));
        const row: WhatTheContestSettled = {
            houseId: house.id, rung, seats, entrants: standing.length, raised: [], stepped: []
        };

        for (const i of standing) {
            const npc = state.npcs[i]!;
            const won = winners.has(npc.id);
            if (won && npc.factionRankIndex === rung - 1) {
                state.npcs[i] = { ...npc, factionRankIndex: rung, updatedOnDay: day };
                row.raised.push(npc.id);
                // WRITTEN HERE AND NOT BY `recordPromotion`, which files the
                // upper half of a ladder only (`worthRecordingRank`): a contest
                // for a place is an event at the rung it is held at, and
                // recording the loss without the win would be half a story.
                appendWorldFact(state, makeFact({
                    day,
                    kind: 'promotion',
                    scale: 'local',
                    summary: `${npc.name} won a place at the `
                        + `${house.name.replace(/^[Tt]he\s+/, '')}'s contest and stands as `
                        + `${house.ranks[rung] ?? 'one of its conclave'}.`,
                    actors: [{ id: npc.id, name: npc.name, role: 'raised' }],
                    locationId: npc.locationId,
                    factionIds: [house.id],
                    visibility: 'faction',
                    magnitude: 0.35,
                    causeKnown: true,
                    data: { fromRank: rung - 1, toRank: rung, rankCount, contested: true }
                }), { recur: false });
            } else if (!won && npc.factionRankIndex === rung) {
                // BACK TO INNER, WHICH IS FOR LIFE. Nobody falls past it.
                state.npcs[i] = { ...npc, factionRankIndex: Math.max(0, rung - 1), updatedOnDay: day };
                row.stepped.push(npc.id);
                appendWorldFact(state, makeFact({
                    day,
                    kind: 'promotion',
                    scale: 'local',
                    summary: `${npc.name} was beaten for their place at the `
                        + `${house.name.replace(/^[Tt]he\s+/, '')}'s contest and went back to `
                        + `${house.ranks[Math.max(0, rung - 1)] ?? 'the rung below'}.`,
                    actors: [{ id: npc.id, name: npc.name, role: 'stepped_back' }],
                    locationId: npc.locationId,
                    factionIds: [house.id],
                    visibility: 'faction',
                    magnitude: 0.3,
                    causeKnown: true,
                    data: { fromRank: rung, toRank: Math.max(0, rung - 1), rankCount, contested: true }
                }), { recur: false });
            }
        }
        if (row.raised.length > 0 || row.stepped.length > 0) settled.push(row);
    }
    return settled;
}
