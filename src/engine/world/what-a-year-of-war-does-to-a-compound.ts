/**
 * WHAT A YEAR OF WAR DOES TO A COMPOUND, AND WHAT PUTTING IT BACK COSTS.
 *
 * The design owner: *"so a declaration at a sect at ordinal 44 might actually
 * be flattening their buildings [...] and then they'd have to pay spirit stones
 * and rebuild."*
 *
 * Wars were already fought. `war-melee.ts` puts the two rosters in front of the
 * melee resolver every year, `what-a-confrontation-does-to-somebody-the-world-
 * holds.ts` writes the bodies and the grudges, and `war-spoils.ts` moves what
 * was in the hold when it ends. What none of it touched was the GROUND: a house
 * could lose a war for a decade and its halls were exactly as they had been.
 *
 * ── IT IS THE WINNER'S REACH AGAINST THE LOSER'S STACK, AND NOTHING ELSE ─
 *
 * Not the melee's margin, not a die. `whatBringingItDownWouldTake` already
 * answers this question for a declaration - what is standing over that ground,
 * and can this reach beat it - and the same read decides what a year of
 * actually being there does. So the sentence a declaration prints and the thing
 * that later happens are the same arithmetic, and a house told its compound
 * would come down is a house whose compound comes down.
 *
 * A year that nobody won does nothing to anybody's ground. A war is not a siege
 * engine; what flattens a compound is one side being able to walk in and the
 * other not being able to stop them.
 *
 * ── THE WARD GOES FIRST, WHICH IS WHY IT WAS WORTH PAYING FOR ────────────
 *
 * What comes down first is the thing that was keeping people out. A ward that
 * has been beaten is spent - it is `ruin`ed on the row, the way every other
 * broken thing in this world is - and the compound behind it is ordinary stone
 * from that day. That is what a house loses when it loses: not a building, the
 * reason it had buildings.
 *
 * ── AND THE BILL LANDS ON THE TREASURY THAT EXISTS ───────────────────────
 *
 * `resources.spirit_stones`, the same pot a gathering is paid out of and a
 * siphon comes out of. A house that can afford it puts its halls back up in the
 * same year. A house that cannot leaves them down, which is a real state and is
 * how a beaten house stays beaten.
 */

import {
    WHAT_ONE_BUILDING_COSTS_TO_RAISE,
    howMuchComesDown,
    takeFromTheHouse,
    whatRebuildingWouldCost
} from './a-house-holds-its-own.js';
import { makeFact, type HistoricalFact } from './history.js';
import { isRuined } from './possessions.js';
import { aBreakingEntersTheWorld } from './a-thing-somebody-ended-is-a-fact.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import {
    whatAHouseIsMadeOf,
    whatBringingItDownWouldTake
} from './what-a-house-is-made-of-and-what-brings-it-down.js';
import type { FactionRecord, WorldState } from './world-state.js';

/**
 * How many buildings a seated house has.
 *
 * One figure for every house, for the reason the masonry is one figure: what
 * makes a great house's seat impressive is its ward and its people, and a count
 * per house would be a second wealth model beside the treasury. What varies is
 * what a house can afford to put back up, which is the treasury and is already
 * per-house.
 */
export const HOW_MANY_HALLS_A_COMPOUND_IS = 12;

/**
 * Where a house records how much of its own compound is currently down.
 *
 * On `resources`, beside the treasury and the vein count, because that is
 * where a house's durable counts live and a second table for one number is how
 * two records of one fact start disagreeing.
 *
 * WITHOUT IT A WAR RE-FLATTENS RUBBLE. Measured: a house that lost its compound
 * in year one had all twelve halls come down again in year two and again in
 * year three, because nothing remembered that they were already gone. What is
 * standing is what can fall.
 */
export const HALLS_DOWN = 'halls_down';

export interface WhatTheYearDidToTheGround {
    loserId: string;
    loserName: string;
    winnerId: string;
    /** The ward that was beaten, or null where there was none left to beat. */
    wardBroken: string | null;
    buildingsDown: number;
    /** Stones the house paid to put them back up. */
    paidToRebuild: number;
    /** Buildings still down at the end of the year, for want of stones. */
    leftDown: number;
    fact: HistoricalFact;
}

/**
 * What one year of losing a war did to the loser's seat.
 *
 * Null where nothing happened to it, which is most years of most wars: a
 * stalemate does nothing, and a winner who cannot beat what is standing over
 * that ground does nothing either.
 */
export function whatTheYearDidToTheGround(
    state: WorldState,
    input: {
        winner: FactionRecord;
        loser: FactionRecord;
        /** What the winning house can actually put in a room. */
        winnerReach: number;
        day: number;
    }
): WhatTheYearDidToTheGround | null {
    const seatId = input.loser.seatLocationId;
    if (seatId === null) return null;

    const seat = whatAHouseIsMadeOf(state.objects, seatId, input.day);
    const could = whatBringingItDownWouldTake({ seat, theirReach: input.winnerReach });
    if (!could.couldFlattenIt) return null;

    // ── THE WARD, WHICH IS THE THING THAT WAS KEEPING THEM OUT ───────────
    let wardBroken: string | null = null;
    if (seat.formationStandsAt !== null) {
        for (let at = 0; at < state.objects.length; at++) {
            const row = state.objects[at]!;
            if (row.kind !== 'formation' || row.locationId !== seatId) continue;
            if (isRuined(row)) continue;
            // Through the world's own breaking door, so a ward beaten down in
            // a siege reaches the record the same way anything else broken
            // does. `ruin` was called straight here with no `factId`, and a
            // house losing the formation over its own seat was known only to
            // the engagement report.
            aBreakingEntersTheWorld(state, {
                actor: { id: input.winner.id, name: input.winner.name, role: 'brought it down' },
                object: row,
                day: input.day,
                locationId: seatId,
                factionIds: [input.winner.id, input.loser.id],
                how:
                    `beaten in the field year of the war with ${input.winner.name}, who could `
                    + 'reach past it. What it was keeping out is inside.'
            });
            wardBroken = row.name;
        }
    }

    // ── AND THE HALLS, OF WHICH ONLY THE STANDING ONES CAN FALL ──────────
    const alreadyDown = Math.max(
        0,
        Math.min(HOW_MANY_HALLS_A_COMPOUND_IS, Number(input.loser.resources[HALLS_DOWN] ?? 0))
    );
    const standing = HOW_MANY_HALLS_A_COMPOUND_IS - alreadyDown;
    const down = standing === 0 ? 0 : howMuchComesDown({
        buildings: standing,
        theirReach: input.winnerReach,
        buildingsStandAt: seat.buildingsStandAt
    });

    // The bill is for everything down, not only for what fell this year: a
    // house spends what it has on whatever is lying in its own courtyard.
    const owing = alreadyDown + down;
    const held = Number(input.loser.resources.spirit_stones ?? 0);
    const bill = whatRebuildingWouldCost({ buildingsDown: owing, treasuryHolds: held });
    const paid = takeFromTheHouse(held, bill.stones, 'rebuilding');
    input.loser.resources.spirit_stones = paid.after;
    const raised = Math.floor(paid.moved / WHAT_ONE_BUILDING_COSTS_TO_RAISE);
    const leftDown = Math.max(0, owing - raised);
    input.loser.resources[HALLS_DOWN] = leftDown;

    const fact = appendWorldFact(state, makeFact({
        day: input.day,
        kind: 'war',
        scale: 'local',
        summary:
            `${input.winner.name} reached the ${input.loser.name} compound. `
            + (wardBroken === null
                ? 'There was nothing over it. '
                : `${wardBroken.charAt(0).toUpperCase()}${wardBroken.slice(1)} is spent. `)
            + (down === 0
                ? 'There was nothing left standing in it to bring down.'
                : `${down} of its halls came down.`)
            + (leftDown === 0
                ? ` Everything is up again inside the year, at ${paid.moved} stones.`
                : raised === 0
                    ? ` ${leftDown} lie where they fell, and the house has nothing to raise `
                      + 'them with.'
                    : ` ${raised} raised again at ${paid.moved} stones, and ${leftDown} still `
                      + 'down.'),
        actors: [
            { id: input.winner.id, name: input.winner.name, role: 'reached it' },
            { id: input.loser.id, name: input.loser.name, role: 'lost the ground' }
        ],
        locationId: seatId
    }));

    return {
        loserId: input.loser.id,
        loserName: input.loser.name,
        winnerId: input.winner.id,
        wardBroken,
        buildingsDown: down,
        paidToRebuild: paid.moved,
        leftDown,
        fact
    };
}
