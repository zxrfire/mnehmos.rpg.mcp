/**
 * A member hands a thing in to their own house, and the house says what it
 * makes of it.
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * The engine half, with no door. `whatTheHouseMakesOf` and `turnItInToTheHouse`
 * in `what-a-house-gives-merit-for.ts` priced and moved a thing the world's own
 * people handed in, and measured through `parseIntent`:
 *
 *     I hand this core in to the sect        unclear
 *     I turn in the manual                   unclear
 *     I give the treasury the jade           sect/donate
 *     I give the core to the sect            sect/donate
 *
 * So a player holding a heaven-grade core their house has none of had two
 * answers: a blank look, or the machinery for paying MONEY in, which buys no
 * contribution by the owner's ruling and names no thing.
 *
 * ── THE RULINGS THIS PINS, IN THE OWNER'S TERMS ──────────────────────────
 *
 *   a house credits what it cannot simply buy with its own treasury, as
 *   contribution, at what the engine's valuation says
 *   the want fills: it wants no more of what it already holds
 *   what it does not want stays with the player, and the answer says why
 *   money is still a donation, and a donation still buys nothing
 *
 * And one this door adds, which is a fact about the world rather than a rule
 * of ours: a thing is handed to somebody of the house - inside its walls, or
 * one of its people standing there - and anywhere else nobody takes it.
 *
 * NOT PINNED BY PLAYING, and said rather than faked: nothing a player can buy
 * is heaven grade, so the wanted case is arranged with `addToPouch`. The
 * not-wanted case is a stall herb, which is the state a player buying one is in.
 *
 * Red-checked: with the `hand_in` row out of the pattern table every test that
 * types a sentence goes red; with the row made for a pouch stack never put into
 * the world, the house holds nothing afterwards and the saturation test goes
 * red; with the somebody-of-the-house check dropped the far-away test goes red.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import { addToPouch } from '../../src/server/consolidated/cultivation-support.js';
import { everyIngredientThatIs } from '../../src/engine/cultivation/what-a-cauldron-will-take.js';
import { whatTheHouseMakesOf } from '../../src/engine/world/what-a-house-gives-merit-for.js';
import { whatTheyCouldHandIn } from '../../src/web/handing-a-thing-in-to-your-house.js';
import type { WorldState } from '../../src/engine/world/world-state.js';

const WORLD = 'a-thing-handed-in';

describe('the sentences', () => {
    it('reach handing a thing in, with the thing named', () => {
        for (const [said, thing] of [
            ['I hand this core in to the sect', 'core'],
            ['I turn in the manual', 'manual'],
            ['I give the treasury the jade', 'jade'],
            ['I give the core to the sect', 'core'],
            ['I hand over the manual to the sect', 'manual']
        ] as const) {
            expect(parseIntent(said), said).toMatchObject({ action: 'sect', intent: 'hand_in', target: thing });
        }
    });

    it('leave money a donation, and going to bed nothing at all', () => {
        expect(parseIntent('I give the sect 500 stones')).toMatchObject({ action: 'sect', intent: 'donate' });
        expect(parseIntent('I give the sect some of my stones')).toMatchObject({ action: 'sect', intent: 'donate' });
        expect(parseIntent('I donate to the house')).toMatchObject({ action: 'sect', intent: 'donate' });
        expect(parseIntent('I turn in for the night').intent).not.toBe('hand_in');
        expect(parseIntent('I give the herb to Elder Fang').action).toBe('give');
    });
});

/** A player on the roll of a house, standing at its seat. */
async function aMemberAtTheirSeat(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Giver');
    const world = (await harness.game.loadWorld())!;
    const house = world.factions.find(f =>
        f.dissolvedOnDay === null && f.seatLocationId !== null && harness.repos.sects.getById(f.id) !== null)!;
    harness.repos.sects.addMember(house.id, cultivator.id, 1);
    const seat = world.locations.find(l => l.id === house.seatLocationId)!;
    harness.repos.cultivators.update(cultivator.id, { location: seat.name });
    return { ...harness, cultivator, house, world, seat };
}

/** Put one of a herb in the pouch, and read it back the way the door will. */
function oneInThePouch(
    h: Awaited<ReturnType<typeof aMemberAtTheirSeat>>,
    herbId: string
) {
    addToPouch(h.db, h.cultivator.id, herbId, 'herb', 1);
    const today = Math.floor(h.world.currentDay);
    return whatTheyCouldHandIn(h.db, h.world, { id: h.cultivator.id, name: h.cultivator.name }, today)
        .find(t => t.pouchItemId === herbId)!;
}

/** The first herb of a grade the engine says this about, asked of the engine. */
function aHerbTheHouse(
    h: Awaited<ReturnType<typeof aMemberAtTheirSeat>>,
    grade: 'mortal' | 'heaven',
    wants: boolean
): { id: string; name: string; merit: number; why: string } {
    const today = Math.floor(h.world.currentDay);
    for (const herb of everyIngredientThatIs({ grade, from: 'a_growing_thing' })) {
        addToPouch(h.db, h.cultivator.id, herb.id, 'herb', 1);
        const row = whatTheyCouldHandIn(h.db, h.world, { id: h.cultivator.id, name: h.cultivator.name }, today)
            .find(t => t.pouchItemId === herb.id)!;
        h.db.prepare('DELETE FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?').run(h.cultivator.id, herb.id);
        const made = whatTheHouseMakesOf(h.world as WorldState, h.house.id, row.row);
        if (made.wanted === wants) return { id: herb.id, name: herb.name, merit: made.merit, why: made.why };
    }
    throw new Error(`no ${grade} herb the house ${wants ? 'wants' : 'does not want'}`);
}

const pouchCount = (h: Awaited<ReturnType<typeof aMemberAtTheirSeat>>, id: string) =>
    (h.db.prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
        .get(h.cultivator.id, id) as { quantity: number } | undefined)?.quantity ?? 0;

const contribution = (h: Awaited<ReturnType<typeof aMemberAtTheirSeat>>) =>
    h.repos.sects.getMembership(h.cultivator.id)!.contribution;

describe('a thing the house wants', () => {
    it('is taken, credited at the engine\'s price, and the house holds it', async () => {
        const h = await aMemberAtTheirSeat('hand-in-wanted');
        const herb = aHerbTheHouse(h, 'heaven', true);
        oneInThePouch(h, herb.id);
        const before = contribution(h);

        const turn = await h.game.act(`I hand the ${herb.name} in to the sect`);

        expect(turn.toolCalls.some(c => c.action === 'sect' && c.ok)).toBe(true);
        expect(pouchCount(h, herb.id)).toBe(0);
        expect(contribution(h) - before).toBe(herb.merit);
        expect(herb.merit).toBeGreaterThan(0);
        const held = h.game.atHand!.objects.filter(o => o.ownerId === h.house.id && o.data?.materialId === herb.id);
        expect(held, 'the house holds one now').toHaveLength(1);
        expect(held[0]!.data.turnedInBy).toBe(h.cultivator.id);
        expect(turn.narration).toContain(String(herb.merit));
    });

    it('is wanted once: a second is not, and stays with the player', async () => {
        const h = await aMemberAtTheirSeat('hand-in-saturates');
        const herb = aHerbTheHouse(h, 'heaven', true);
        addToPouch(h.db, h.cultivator.id, herb.id, 'herb', 2);

        await h.game.act(`I hand the ${herb.name} in to the sect`);
        const after = contribution(h);
        const second = await h.game.act(`I hand the ${herb.name} in to the sect`);

        expect(pouchCount(h, herb.id)).toBe(1);
        expect(contribution(h)).toBe(after);
        expect(second.toolCalls.some(c => c.action === 'sect' && !c.ok)).toBe(true);
        expect(second.narration.toLowerCase()).toContain('already holds');
    });
});

describe('a thing the house does not want', () => {
    it('stays with the player, and the answer says the house buys its own', async () => {
        const h = await aMemberAtTheirSeat('hand-in-a-stall-herb');
        const herb = aHerbTheHouse(h, 'mortal', false);
        expect(herb.why).toBe('it_buys_its_own');
        oneInThePouch(h, herb.id);
        const before = contribution(h);

        const turn = await h.game.act(`I hand the ${herb.name} in to the sect`);

        expect(pouchCount(h, herb.id)).toBe(1);
        expect(contribution(h)).toBe(before);
        expect(turn.narration.toLowerCase()).toContain('buys its own');
    });
});

describe('where it can be handed in', () => {
    it('is to somebody of the house: far from it and nobody of it there, nothing moves', async () => {
        const h = await aMemberAtTheirSeat('hand-in-far-away');
        const herb = aHerbTheHouse(h, 'heaven', true);
        oneInThePouch(h, herb.id);
        const elsewhere = h.world.locations.find(l =>
            l.kind === 'settlement' && !h.world.npcs.some(n => n.locationId === l.id && n.factionId === h.house.id))!;
        h.repos.cultivators.update(h.cultivator.id, { location: elsewhere.name });
        const before = contribution(h);

        const turn = await h.game.act(`I hand the ${herb.name} in to the sect`);

        expect(turn.toolCalls.some(c => c.action === 'sect' && !c.ok)).toBe(true);
        expect(pouchCount(h, herb.id)).toBe(1);
        expect(contribution(h)).toBe(before);
    });

    it('is to a house they are on the roll of', async () => {
        const harness = await makeGameInWorld({ seed: 'hand-in-no-house', worldSeed: WORLD });
        await harness.game.newRun('Rogue');
        const turn = await harness.game.act('I hand the manual in to the sect');
        expect(turn.toolCalls.some(c => c.action === 'sect' && !c.ok)).toBe(true);
        expect(turn.narration.toLowerCase()).toContain('no house');
    });
});
