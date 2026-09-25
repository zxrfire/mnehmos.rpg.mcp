/**
 * A conclave seat is held against the pool, and the pool settles it in a
 * tournament.
 *
 * `docs/world/houses/offices-and-succession.md`: conclave is *"held against the
 * pool, not awarded once"* - five inner disciples worth watching, three places,
 * and the three are not the same three forever - while inner is for life. The
 * comparison was written down and nothing ran it: once somebody reached the
 * conclave rung, only death moved them off it.
 *
 * The design owner ruled HOW it is settled: *"the thing that rotates is the
 * conclave. They settle it with a tournament on a fixed schedule, different per
 * sect, depending on the cultivation level of their conclave disciples."*
 *
 * ── WHAT RUNS ────────────────────────────────────────────────────────────
 *
 * The house's own field, ranked by `rankAField` - the same ranking a gathering
 * and a door conclave use, so no second opinion about who is better exists.
 * Everybody at the conclave rung stands in it, and so does everybody at the
 * rung below who clears the conclave rung's own realm bar. The seats are the
 * seats (`seatsAtRank`), the top of the board takes them, and a holder who is
 * beaten goes back to inner. No disgrace: the document says it is the count.
 * What they learned standing on the board is paid by `creditWhatTheyLearned`,
 * like any other contest.
 *
 * INNER IS FOR LIFE, so nobody falls past it: the rung below the conclave is
 * the floor of this whole mechanism.
 *
 * ── THE SCHEDULE, AND WHY IT IS ONE FUNCTION AND NOT A TABLE ─────────────
 *
 * *"Different per sect"*, off *"the cultivation level of their conclave
 * disciples"*: a contest every few years means nothing where the people in it
 * take two centuries to move. So the interval is a share of the years the
 * ladder itself credits at that height before it reads somebody as finished
 * (`stagnationYearsForOrdinal`, the same figure `howFinishedTheyLook` measures
 * a career against), taken at the middle of the conclave rung's own realm band.
 *
 * A QUARTER of it: four contests inside the span a disciple can stand at that
 * rung without the house writing them off, which is often enough that a rising
 * inner disciple gets a shot while they are rising and rare enough that the
 * seats are not a revolving door. Measured over the shipped catalog: 13 years
 * for the thirty-odd houses whose conclave rung sits in Qi Condensation or
 * Foundation, 25 for the six that sit in Core Formation, and 500 for the Empyrean
 * Court, whose Inner Disciples stand at Body Integration and above.
 *
 * The year each house holds it in is its own, drawn once off the seed and the
 * house, so two houses in a province do not hold theirs in the same spring.
 *
 * MEASURED over 500 years on `shape-a` and `shape-b`, with the intervals the
 * catalog produces (13 years for 28 houses, 25 for 8, 100 for one and 500 for
 * the Empyrean Court): 622 and 673 places won, 333 and 339 holders beaten for
 * one - so a place changes hands about nine times a house a century, and the
 * rest of the wins are seats that stood empty. The rungs stayed bottom-heavy
 * ({0:174, 1:138, 2:73, 3:64, 4:77, 5:34, 6:25} on `shape-a`), which is the
 * thing to watch: a contest that emptied the rungs under the conclave would be
 * this pass promoting rather than choosing.
 */

import { rankRealmBand } from '../../data/cultivation/members.js';
import { forStream } from '../cultivation/rng.js';
import { elderRungOf } from '../cultivation/leadership.js';
import { stagnationYearsForOrdinal } from '../../schema/cultivation.js';
import { creditWhatTheyLearned, rankAField, type GatheringPlacing } from './gatherings.js';
import { isBelowTheLid } from './layers.js';
import { isAwayOnSomething, isTheWorldsToMove } from './npc-state.js';
import { abundanceOf, ordinalExpectedAt, seatsAtRank } from './promotion-inside-a-house.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { FactionRecord, WorldState } from './world-state.js';

/**
 * Share of the years a rung credits that passes between two contests for it.
 * See the header for why a quarter.
 */
export const A_CONTEST_EVERY = 1 / 4;

/** The shortest a house's cycle may be, so nothing turns into a season. */
export const NEVER_OFTENER_THAN_YEARS = 5;

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
    const credited = stagnationYearsForOrdinal(theHeightItIsContestedAt(house, rung));
    return Math.max(NEVER_OFTENER_THAN_YEARS, Math.round(credited * A_CONTEST_EVERY));
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
            if (!isTheWorldsToMove(npc)) return false;
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
        const scored = rankAField(state, standing.map(i => state.npcs[i]!), rng, placings);
        creditWhatTheyLearned(state, placings, day);

        const order = [...scored].sort((a, b) => b.score - a.score
            || (a.npc.id < b.npc.id ? -1 : a.npc.id > b.npc.id ? 1 : 0));
        const winners = new Set(order.slice(0, seats).map(s => s.npc.id));
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
