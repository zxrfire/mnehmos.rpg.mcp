/**
 * How many a house puts on one errand, and what the journey takes off its chest.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * A house puts a party on the road once in five years (`SENDINGS_PER_HOUSE_YEAR`
 * is 0.2 and stays 0.2). Asked whether that was too rare, the design owner kept
 * the cadence and moved the party instead: people who live for centuries take
 * one substantial expedition every five years, not four small ones a year, and
 * how substantial it is depends on the treasury.
 *
 * So the party size is not a multiplier chosen to make the figure look right.
 * `reason.hands` is what the WORK asks for and is now a floor; the rest of the
 * party is what the house is travelling on, bounded by what its chest will pay
 * to carry and by how many people it actually has.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `postingFor` took a conveyance, used it for the TERM, and ignored it for the
 * party. A house with a thing that holds thirty sent five and left twenty-five
 * seats empty. And `whatTheChestBurns` had been written, exported and tested
 * for a fortnight with nothing in the world charging it to anybody: every
 * journey in the world was free.
 *
 * ── MEASURED ─────────────────────────────────────────────────────────────
 *
 * Three seeded worlds at a hundred years, party sizes read off the ledger's own
 * actor rows: mean 3.8/4.4/3.9 before, 4.6 after on the first of them. The lift
 * is modest and the reason is worth stating rather than tuning away - a house's
 * roll runs 1 to 29 people with a median of 7, so for most houses in the world
 * the binding constraint is how many people it HAS, not what it can carry. The
 * conveyance decides the party at the four houses that own something big.
 */

import { describe, expect, it } from 'vitest';

import {
    howManyTheChestWillCarry,
    postingFor,
    whoTheHouseCanSend
} from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import {
    SENDING_REASONS,
    getSendingReason
} from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { requireConveyance } from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {
    daysByConveyance,
    whatTheChestBurns
} from '../../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { STONES_BURNED_PER_HEAD_PER_DAY } from '../../../src/engine/world/what-a-sea-crossing-costs.js';

const HOUSE = { id: 'house-a', name: 'The Lone Spring Sect' };
const BOAT = requireConveyance('conv-spirit-boat');
const SHOD = requireConveyance('conv-carriage-earth');
const materials = () => getSendingReason('sending-for-materials')!;

describe('a house sends what it can carry', () => {
    it('sends exactly what the work asks for when it walks', () => {
        const reason = materials();
        const walking = postingFor({ reason, house: HOUSE, pitchOrdinal: 20 });
        expect(walking.hands).toBe(reason.hands);
        expect(walking.conveyanceId).toBeNull();
        expect(walking.stonesBurned).toBe(0);
    });

    it('fills what it is travelling on, and the work is the floor not the answer', () => {
        const reason = materials();
        expect(reason.hands).toBeLessThan(SHOD.heads);
        const posting = postingFor({
            reason, house: HOUSE, pitchOrdinal: 20, conveyance: SHOD
        });
        expect(posting.hands).toBe(SHOD.heads);
    });

    /**
     * A carriage is standing on a vein like everybody else however finely it is
     * made. The row that stops this reading as a ladder of expense, and the
     * reason a poor house is not priced off the road at all.
     */
    it('charges nothing for anything with ground under it', () => {
        const posting = postingFor({
            reason: materials(), house: HOUSE, pitchOrdinal: 20, conveyance: SHOD, purse: 5
        });
        expect(posting.stonesBurned).toBe(0);
        expect(posting.hands).toBe(SHOD.heads);
    });

    it('charges a crossing by the head-day, out of the chest that is paying', () => {
        const reason = materials();
        const posting = postingFor({
            reason, house: HOUSE, pitchOrdinal: 20, conveyance: BOAT, conveyancePower: 38
        });
        expect(posting.hands).toBe(BOAT.heads);
        expect(posting.stonesBurned).toBe(
            posting.days * BOAT.heads * STONES_BURNED_PER_HEAD_PER_DAY
        );
        expect(posting.stonesBurned).toBeGreaterThan(0);
    });

    /**
     * The design owner's second clause, and the one that makes a hull a
     * decision rather than a possession: *"also dependent on their treasury"*.
     */
    it('fills it only as far as the chest will carry', () => {
        const reason = materials();
        const full = postingFor({
            reason, house: HOUSE, pitchOrdinal: 20, conveyance: BOAT, conveyancePower: 38
        });
        const thin = postingFor({
            reason,
            house: HOUSE,
            pitchOrdinal: 20,
            conveyance: BOAT,
            conveyancePower: 38,
            purse: Math.floor(full.stonesBurned / 3)
        });
        expect(thin.hands).toBeLessThan(full.hands);
        expect(thin.hands).toBeGreaterThanOrEqual(reason.hands);
        expect(thin.stonesBurned).toBeLessThanOrEqual(Math.floor(full.stonesBurned / 3));
    });

    /** Never below what the errand needs. A chest does not cancel the work. */
    it('does not shrink the party below the work however empty the chest is', () => {
        const reason = materials();
        const broke = postingFor({
            reason, house: HOUSE, pitchOrdinal: 20, conveyance: BOAT,
            conveyancePower: 38, purse: 0
        });
        expect(broke.hands).toBe(reason.hands);
    });

    /**
     * The defect this caught: a posting is priced before the party is drawn, so
     * a house with a hull and eight people was charged to move thirty.
     */
    it('prices the journey for the people the house actually has', () => {
        const reason = materials();
        const posting = postingFor({
            reason, house: HOUSE, pitchOrdinal: 20, conveyance: BOAT,
            conveyancePower: 38, available: 8
        });
        expect(posting.hands).toBe(8);
        expect(posting.stonesBurned).toBe(whatTheChestBurns({
            conveyance: BOAT, daysOneWay: posting.days, heads: 8, trips: 1
        }));
    });

    /** A count settled elsewhere is neither grown by the craft nor cut by the chest. */
    it('takes a count somebody else already settled', () => {
        const posting = postingFor({
            reason: materials(), house: HOUSE, pitchOrdinal: 20,
            conveyance: BOAT, conveyancePower: 38, purse: 1, hands: 3
        });
        expect(posting.hands).toBe(3);
    });

    /** A war wants forty and the biggest thing in the world holds thirty. */
    it('does not shrink an errand that asks for more than the craft holds', () => {
        const war = SENDING_REASONS.find(r => r.hands > BOAT.heads);
        expect(war, 'no reason asks for more hands than a hull holds').toBeDefined();
        const posting = postingFor({
            reason: war!, house: HOUSE, pitchOrdinal: 20, conveyance: BOAT, conveyancePower: 38
        });
        expect(posting.hands).toBe(war!.hands);
        expect(posting.stonesBurned).toBe(whatTheChestBurns({
            conveyance: BOAT,
            daysOneWay: posting.days,
            heads: war!.hands,
            trips: Math.ceil(war!.hands / BOAT.heads)
        }));
    });

    /** The party is what the posting says, drawn off the roll. */
    it('draws the party the posting was written for', () => {
        const roster = Array.from({ length: 40 }, (_, i) => ({
            id: `npc-${i}`, name: `n${i}`, ordinal: 10
        }));
        const posting = postingFor({
            reason: materials(), house: HOUSE, pitchOrdinal: 20, conveyance: SHOD
        });
        expect(whoTheHouseCanSend(posting, roster)).toHaveLength(SHOD.heads);
    });

    describe('what the chest will carry', () => {
        it('returns the ceiling when nobody holds a purse', () => {
            expect(howManyTheChestWillCarry({
                conveyance: BOAT, daysOneWay: 10, floor: 5, ceiling: 30, purse: null
            })).toBe(30);
        });

        it('is the largest head count the purse actually covers', () => {
            const days = daysByConveyance(120, BOAT, 38);
            const purse = 12 * days * STONES_BURNED_PER_HEAD_PER_DAY;
            const heads = howManyTheChestWillCarry({
                conveyance: BOAT, daysOneWay: days, floor: 5, ceiling: 30, purse
            });
            expect(heads).toBe(12);
            expect(whatTheChestBurns({
                conveyance: BOAT, daysOneWay: days, heads, trips: 1
            })).toBeLessThanOrEqual(purse);
            expect(whatTheChestBurns({
                conveyance: BOAT, daysOneWay: days, heads: heads + 1, trips: 1
            })).toBeGreaterThan(purse);
        });
    });
});
