/**
 * THE STONES A SIPHON TOOK CAME FROM NOWHERE.
 *
 * The design owner: *"ensure each sect has their own treasury of items and
 * spirit stones, separate from people's own stuff."*
 *
 * Most of it existed. `resources.spirit_stones` is on every faction record, is
 * seeded, is what `gatherings.ts` pays a circle out of, and is what
 * `parties-under-pressure.ts` calls the treasury in as many words. A house's
 * THINGS are the rows in the one possessions table with its id on them, which
 * is also already true.
 *
 * The one thing that never touched any of it was the player taking from it.
 * `handleSiphon` prices the crime off `baseReservesFor(stipend)` - a formula on
 * the payroll - writes a flag saying how much THIS cultivator has taken, and
 * credits them. So:
 *
 *   - The stones were created. The house's pot did not move, and the world went
 *     on spending from a number the player could not affect.
 *   - Two members could each drain "the reserves" in full and neither would
 *     find the other had been there.
 *   - A house could be robbed to nothing and still pay for a gathering.
 *
 * ── WHAT CHANGED, AND WHAT DELIBERATELY DID NOT ──────────────────────────
 *
 * The formula STAYS. It is the shape of the crime - how much a house of this
 * payroll can be bled before the hole shows - and the discovery odds are built
 * on it. What is added is that the hole is now in something.
 *
 * And the two figures are allowed to disagree, because they answer different
 * questions: what a house of this ladder ought to be holding, and what this
 * house actually has. A player told "six per cent of it is gone" while half the
 * pot went has been told the wrong thing, so the treasury's own movement goes
 * on the mechanical channel beside it.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../src/data/cultivation/index';
import { parseIntent } from '../../src/web/actions';
import {
    putIntoTheHouse,
    takeFromTheHouse
} from '../../src/engine/world/a-house-holds-its-own';
import { makeGameInWorld } from './harness';

/** A house that takes people on, so somebody can be seated high enough to steal. */
const A_HOUSE = SECTS.find(sect => sect.recruits)!;

function treasuryOf(game: unknown, factionId: string): number {
    const world = (game as { atHand: { factions: {
        id: string; resources: Record<string, number>;
    }[] } | null }).atHand;
    const house = world?.factions.find(row => row.id === factionId);
    return Number(house?.resources.spirit_stones ?? 0);
}

async function anOfficerWhoCanReachTheReserves(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await harness.game.newRun('Thief');
    await harness.game.act('I look around');
    harness.repos.sects.addMember(A_HOUSE.id, cultivator.id, A_HOUSE.ranks.length - 1);
    harness.repos.cultivators.update(cultivator.id, {
        realmOrdinal: 30, sectId: A_HOUSE.id, sectName: A_HOUSE.name
    });
    return { harness, id: cultivator.id };
}

describe('the arithmetic', () => {
    /** A house cannot be overdrawn. There is no credit in this world. */
    it('never takes past empty, and says it came up short', () => {
        const short = takeFromTheHouse(500, 800, 'siphoned');
        expect(short.after).toBe(0);
        expect(short.moved).toBe(500);
        expect(short.cameUpShort).toBe(true);
    });

    it('is the same store in both directions', () => {
        const paid = putIntoTheHouse(takeFromTheHouse(1_000, 400, 'stipend').after, 400, 'donation');
        expect(paid.after).toBe(1_000);
    });
});

describe('paying in, which is the same pot', () => {
    /**
     * THE PROSE ALREADY SAID SO. `donate` has printed "into the house's
     * coffers" since it was written, and nothing put anything there: the
     * player's purse went down and the treasury did not move. The exact mirror
     * of the siphon, which took stones out of a house that never had them.
     */
    it('puts the stones into the house the line says they went to', async () => {
        const harness = await makeGameInWorld({
            seed: 'donate-in', worldSeed: 'world-donate-in'
        });
        const { cultivator } = await harness.game.newRun('Giver');
        await harness.game.act('I look around');
        harness.repos.sects.addMember(A_HOUSE.id, cultivator.id, 0);
        harness.repos.cultivators.update(cultivator.id, {
            realmOrdinal: 10, sectId: A_HOUSE.id, sectName: A_HOUSE.name, spiritStones: 5_000
        });

        const before = treasuryOf(harness.game, A_HOUSE.id);
        await harness.game.act('I donate 2000 spirit stones to the sect');

        expect(treasuryOf(harness.game, A_HOUSE.id) - before).toBe(2_000);
        expect(harness.repos.cultivators.getById(cultivator.id)!.spiritStones).toBe(3_000);
    }, 200_000);

    /**
     * AND GIVING IS NEVER READ AS TAKING. `SECT_THEFT_PATTERN` matches on the
     * NOUNS - treasury, coffers, reserves - so a sentence that plainly pays in
     * was answered as a robbery for having the word in it. The confident
     * opposite, arriving by a different route than the one
     * `questions-a-sentence-cannot-carry.ts` guards.
     */
    it('never reads a payment into the treasury as a theft from it', () => {
        for (const sentence of [
            'I give 2000 stones to the sect treasury',
            'I pay 500 stones into the coffers',
            'I hand over 300 spirit stones to the sect treasury'
        ]) {
            expect(parseIntent(sentence).intent, sentence).toBe('donate');
        }
    });

    /** And the theft phrasings are exactly where they were. */
    it('leaves every way of saying the crime alone', () => {
        for (const sentence of [
            'I siphon from the sect treasury',
            'I steal from the sect treasury',
            'I skim from the coffers',
            'what do the sect reserves hold'
        ]) {
            expect(parseIntent(sentence).intent, sentence).toBe('siphon');
        }
    });

    /**
     * THE FIGURE CARRIES, WHICH IT DID NOT. `parseCount` reads at most three
     * digits - right for a span of days, wrong for money - so every donation of
     * a thousand or more arrived carrying nothing and was answered with the
     * rate table instead of the payment.
     */
    it('carries a figure of any size, in every way somebody says it', () => {
        for (const sentence of [
            'I donate 2000 spirit stones to the sect',
            'I donate 2000 stones',
            'I donate 2000 to the sect',
            'I contribute 2000 spirit stones'
        ]) {
            const plan = parseIntent(sentence) as { intent?: string; days?: number };
            expect(plan.intent, sentence).toBe('donate');
            expect(plan.days, sentence).toBe(2_000);
        }
    });
});

describe('played, robbing your own house', () => {
    /**
     * THE WHOLE OF IT: the pot goes down by what the thief went up by. Before
     * this the first number never moved.
     */
    it('takes the stones out of the house that lost them', async () => {
        const { harness, id } = await anOfficerWhoCanReachTheReserves('siphon-drains');
        const before = {
            house: treasuryOf(harness.game, A_HOUSE.id),
            thief: harness.repos.cultivators.getById(id)!.spiritStones
        };
        expect(before.house, 'the house was seeded holding nothing').toBeGreaterThan(0);

        // CAREFULLY, AND FOR A SEASON. The span is what gets somebody caught -
        // a year of it is noticed and reconciled, and the house takes back
        // everything. Measured on this fixture: twelve months at any pace gains
        // nothing, three careful months gains about five thousand.
        //
        // Said out loud rather than left to a bare "I siphon", which was this
        // test hoping rather than setting up. It read as flaky for a long time
        // because the player's id is minted at random and the discovery roll
        // reads it, so the same sentence was a different crime every run.
        await harness.game.act('I siphon carefully from the sect treasury for 3 months');

        const after = {
            house: treasuryOf(harness.game, A_HOUSE.id),
            thief: harness.repos.cultivators.getById(id)!.spiritStones
        };
        const gained = after.thief - before.thief;
        expect(gained, 'nothing was taken at all').toBeGreaterThan(0);
        expect(before.house - after.house).toBe(gained);
    }, 200_000);

    /**
     * AND THE TREASURY'S OWN MOVEMENT IS ON THE RECORD, because the tool's
     * percentage is off the payroll formula and the two legitimately differ.
     */
    it('says what the pot actually holds, beside the figure off the payroll', async () => {
        const { harness } = await anOfficerWhoCanReachTheReserves('siphon-says');
        // The same conditions as above, and for the same reason.
        const answer = await harness.game.act(
            'I siphon carefully from the sect treasury for 3 months'
        );
        const structure = ((answer as { toolCalls?: { name: string; summary: string }[] })
            .toolCalls ?? []).map(c => `${c.name} ${c.summary}`).join(' ');
        expect(structure).toMatch(/The treasury itself/);
        expect(structure).toMatch(/not the payroll figure/);
    }, 200_000);

    /**
     * A HOUSE AT ZERO IS A REAL STATE, AND THE INVARIANT IS THE POINT.
     *
     * Nothing conjures stones the world does not have. Driven through the game
     * rather than by writing a figure into the world by hand: the world is
     * reloaded between turns, so a treasury poked in memory is not the treasury
     * the next turn reads, and a test that pokes one is testing its own mock.
     */
    it('never lets a thief end up holding more than the house ever had', async () => {
        const { harness, id } = await anOfficerWhoCanReachTheReserves('siphon-empty');
        const held = treasuryOf(harness.game, A_HOUSE.id);
        const before = harness.repos.cultivators.getById(id)!.spiritStones;

        // Long enough to want more than is there, at the greediest pace.
        for (let round = 0; round < 6; round++) {
            await harness.game.act('I siphon from the sect treasury greedily for 48 months');
        }

        const gained = harness.repos.cultivators.getById(id)!.spiritStones - before;
        expect(treasuryOf(harness.game, A_HOUSE.id)).toBeGreaterThanOrEqual(0);
        expect(gained, 'the thief took out more than the house ever held')
            .toBeLessThanOrEqual(held);
    }, 300_000);
});
