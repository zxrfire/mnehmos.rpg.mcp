/**
 * Who has heard that a thing exists, when the thing is not on any counter.
 *
 * A verdict of "nothing can be done" is honest when the person giving it has
 * never heard of the one medicine that would answer. The wound rows in
 * `wounds.ts` stay the state of the art either way - they are what is true, not
 * what anybody says - and what changes per holder is how much of that truth
 * reaches them.
 *
 * ── TWO QUESTIONS, AND ONLY THE SECOND IS A GATE ────────────────────────
 *
 *   IS THERE A CLAIM TO HOLD    A thing on open sale is a thing anybody
 *                               standing in a market has been shown, and there
 *                               is nothing to have been told. `resolvePrice`
 *                               already says this of the board in those words -
 *                               *"Not gated: the player was shown it"* - and
 *                               the cash line is where that stops being true.
 *                               {@link aThingOnOpenSale}.
 *
 *   HAS THIS HOLDER HEARD IT    `KnowledgeGate`, and nothing else. The reading
 *                               below is what the gate composes for one of the
 *                               world's own people, exactly as it already does
 *                               for a house, a place, a person and an event. It
 *                               is not a second answer beside the table; it is
 *                               the same answer the other four kinds get, and
 *                               a stored row still wins where one exists.
 *
 * ── NOTHING IS AUTHORED PER PERSON ──────────────────────────────────────
 *
 * Who holds it falls out of two numbers the world already stores: the rung
 * somebody stands at, and the reach of the house whose roll they are on.
 * `seedPillStock` already writes the second of those - a house holds a barter
 * pill only where `reach + 8 >= band`, because a house working near the height
 * a thing is for is this repo's expression of "these are the people who would
 * know". That 8 is {@link WORKING_KNOWLEDGE_MARGIN}, which is why the literal
 * there is now this import, and why there is one margin rather than two.
 *
 * AND BEING ON A ROLL IS NOT ENOUGH. A hall that refines immortal-grade
 * medicine is a body that holds the claim; the outer disciples sweeping its
 * steps are not, or being able to reach somebody who knows stops being the hard
 * part. `isElderRank` is the repo's one answer to who in a house speaks for it,
 * and it is asked rather than restated.
 */

import { PILLS } from '../../data/cultivation/pills.js';
import type { Pill } from '../../schema/cultivation.js';
import { pillBandOrdinal } from './breakthrough.js';
import { pillTradeTier } from './buying-and-bartering-pills.js';
import { isElderRank } from './leadership.js';
import type { KnowingStage } from '../social/discovery.js';

/**
 * How far above their own standing a person's working knowledge reaches.
 *
 * Moved here from `web/lore.ts`, which re-exports it, for the reason that file
 * records about its own earlier move: the number belongs beside the rule that
 * reads it, and the engine cannot import from `web/`. Two callers below the
 * `web/` line want it - this file and `seedPillStock` - and both of them mean
 * the same thing by it.
 */
export const WORKING_KNOWLEDGE_MARGIN = 8;

/** Whether a rung is close enough to a height for its name to have come down. */
export function withinWorkingKnowledge(ordinal: number, band: number): boolean {
    return ordinal + WORKING_KNOWLEDGE_MARGIN >= band;
}

/**
 * Whether a counter anywhere quotes a figure for this. Nobody needs to have
 * been told about a thing they can walk in and buy.
 */
export function aThingOnOpenSale(pill: Pill): boolean {
    return pillTradeTier(pill) === 'commodity';
}

/**
 * The rung a catalog thing is pitched at, or null where the catalogs do not
 * name one.
 *
 * PILLS TODAY AND NOT PILLS BY DESIGN. The claim this answers - that a thing
 * exists - is the same claim for an art, an artifact or a material, and each of
 * those has a rung in its own row. What they do not yet have is a reason for
 * anybody to be refused the name, so nothing here reaches for them; when one
 * does, it is another lookup in this function rather than another kind.
 */
export function theHeightAThingIsPitchedAt(thingId: string): number | null {
    const pill = PILLS.find(row => row.id === thingId);
    return pill ? pillBandOrdinal(pill.grade) : null;
}

/** Where somebody stands relative to a thing they may or may not have heard of. */
export interface WhereTheyStandToIt {
    /** The catalog id of the thing. */
    thingId: string;
    /** The rung the holder stands at. */
    ordinal: number;
    /** The house whose roll they are on, where they are on one. */
    house: {
        /** The height the house works at. `theHeightAHouseWorksAt` reads it. */
        reach: number;
        /** Their index into that house's own ladder. -1 when unaffiliated. */
        rankIndex: number;
        rankCount: number;
    } | null;
}

/**
 * How far up the ladder of knowing somebody stands on a thing, derived and
 * never stored.
 *
 * `named` and not a rung above it, by any of the three routes. Knowing that a
 * medicine exists and roughly what it answers is the whole of what falls out of
 * standing where they stand; where one is, who holds it and what it would take
 * are separate facts, and they are what asking is for.
 *
 * ASKED OF THE PLAYER TOO, AND FROM A DIFFERENT DOORWAY. `KnowledgeGate`
 * composes this for everybody the WORLD holds a row for, alongside the stored
 * rows and under `highestStage`. The played cultivator has no world row - that
 * is stated in `what-one-of-the-worlds-own-people-knows.ts` and is deliberate -
 * so their rung never reaches the gate, and the one surface that has it asks
 * this same function directly rather than growing a second rule.
 */
export function whoWouldHaveHeardOfIt(input: WhereTheyStandToIt): KnowingStage {
    const pill = PILLS.find(row => row.id === input.thingId);
    if (!pill) return 'unaware';
    // Sold openly, so there is nothing to have been told. Above the ladder
    // rather than on it: a villager who has never left the county can name what
    // is on the counter behind them.
    if (aThingOnOpenSale(pill)) return 'named';

    const band = pillBandOrdinal(pill.grade);
    if (withinWorkingKnowledge(input.ordinal, band)) return 'named';
    const house = input.house;
    if (house !== null
        && withinWorkingKnowledge(house.reach, band)
        && isElderRank(house.rankIndex, house.rankCount)) {
        return 'named';
    }
    return 'unaware';
}
