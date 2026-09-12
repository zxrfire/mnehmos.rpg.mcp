/**
 * Anything the engine can make, a player can break by saying so.
 *
 * WHAT WAS MEASURED, on `a-xianxia-run` at Wind Turn, one fresh run per
 * sentence through `scripts/scratch-can-a-player-break-a-thing.ts`:
 *
 *     I smash the stall          unclear     engine.parseIntent
 *     I set fire to the inn      unclear     engine.parseIntent
 *     I burn the village down    unclear     engine.parseIntent
 *     I smash the pill           consume_pill  storage.listPouch
 *     I destroy the healing pill consume_pill  storage.listPouch
 *     I break my sword           attack      engine.resolveParty
 *
 * Three blank looks, and the other three are worse than blank: smashing a pill
 * was read as SWALLOWING it, and breaking a sword was read as swinging it at
 * somebody. Those are the softening AGENTS.md names as the one failure that
 * cannot be recovered downstream - the engine never learns what was tried.
 *
 * `ruin` in `possessions.ts` has been the destruction primitive the whole time
 * and has seven callers, every one of them the world acting on somebody. The
 * player had no doorway to it. That is the whole of the gap, and this file
 * pins the doorway rather than the mechanism.
 *
 * THE LINE, and it is where the ruling put it: what the engine's making path
 * can produce is what a player can unmake. A pill and a conveyance are the
 * closed set (`RECIPES` under `refine`, `CONVEYANCE_RECIPES` under `craft`),
 * plus the objects the same machinery mints and a player can be holding. A
 * village is not on it, and it has to refuse by saying something TRUE about
 * why rather than by claiming the sentence was unreadable.
 */

import { describe, expect, it } from 'vitest';

import { makeGame, makeGameInWorld } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import { addToPouch } from '../../src/server/consolidated/cultivation-support.js';
import { mintCraft } from '../../src/engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import { getConveyanceRecipe } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { isRuined } from '../../src/engine/world/possessions.js';
import { getPill } from '../../src/data/cultivation/pills.js';

const WORLD = 'a-thing-is-unmade';

/** A pill the refining path actually produces, so the scope claim is real. */
const A_PILL_YOU_CAN_REFINE = 'pill-minor-healing';
/** Typed back exactly as the catalog prints it: a name the game prints, it takes. */
const ITS_NAME = getPill(A_PILL_YOU_CAN_REFINE)!.name;

describe('the sentence reaches a breaking rather than something politer', () => {
    it('reads smashing a pill as breaking it, not as swallowing it', () => {
        expect(parseIntent('I smash the pill').action).toBe('destroy');
        expect(parseIntent('I destroy the healing pill').action).toBe('destroy');
    });

    it('reads breaking a thing you hold as breaking it, not as a fight', () => {
        expect(parseIntent('I break my sword').action).toBe('destroy');
        expect(parseIntent('I smash the spirit boat').action).toBe('destroy');
    });

    it('still reads swallowing as swallowing and a fight as a fight', () => {
        // The rows above must not have eaten their neighbours.
        expect(parseIntent('I swallow a healing pill').action).toBe('consume_pill');
        expect(parseIntent('I attack the bandit').action).toBe('attack');
        expect(parseIntent('I build a carriage').action).toBe('craft');
    });

    it('carries what was named, so the handler has something to resolve', () => {
        expect((parseIntent('I smash the healing pill').target ?? '').toLowerCase())
            .toContain('healing pill');
    });
});

describe('a player can break what they are carrying', () => {
    it('takes the pill out of the pouch and says it is gone', async () => {
        const { game, db } = makeGame({ seed: 'break-a-pill', worldEnabled: false });
        const { cultivator } = await game.newRun('Breaker');
        addToPouch(db, cultivator.id, A_PILL_YOU_CAN_REFINE, 'pill', 1);

        const turn = await game.act(`I smash the ${ITS_NAME}`);

        const held = db
            .prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
            .get(cultivator.id, A_PILL_YOU_CAN_REFINE) as { quantity: number } | undefined;
        expect(held?.quantity ?? 0).toBe(0);
        expect(turn.toolCalls.some(call => call.action === 'destroy' && call.ok)).toBe(true);
    });

    // ── AND THE SAME STATE, REACHED BY PLAYING ───────────────────────────
    //
    // The sibling AGENTS.md asks for. `addToPouch` above is an arrangement;
    // this earns the stones at a job and buys the pill off the stall a player
    // can actually see, so the precondition is a state somebody can occupy
    // rather than one only a test can build.
    //
    // The tracked half has no sibling and cannot have one: a spirit boat is
    // 2,400 days of work for one pair of hands against a bill of heaven-grade
    // cores, which is a lifetime rather than a fixture. Said plainly rather
    // than faked.
    it('is reachable by playing: earn the stones, buy the pill, break it', async () => {
        const harness = await makeGameInWorld({ seed: 'earn-then-break', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Breaker');

        for (let month = 0; month < 6; month++) await harness.game.act('I take work in the town');
        const bought = await harness.game.act(`I buy a ${ITS_NAME}`);
        expect(bought.toolCalls.some(call => call.name === 'storage.addToPouch')).toBe(true);

        await harness.game.act(`I smash the ${ITS_NAME}`);

        const held = harness.db
            .prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
            .get(cultivator.id, A_PILL_YOU_CAN_REFINE) as { quantity: number } | undefined;
        expect(held?.quantity ?? 0).toBe(0);
    });

    it('refuses when the thing named is not something they have', async () => {
        const { game } = makeGame({ seed: 'break-nothing', worldEnabled: false });
        await game.newRun('Breaker');

        const turn = await game.act(`I smash the ${ITS_NAME}`);

        // A refusal, and one that names the real reason: an empty pouch.
        expect(turn.toolCalls.some(call => call.action === 'destroy' && !call.ok)).toBe(true);
        expect(turn.narration.toLowerCase()).not.toContain('does not resolve into anything');
    });
});

describe('a tracked thing keeps its row and the row says it ended', () => {
    it('ruins the craft rather than deleting it', async () => {
        const harness = await makeGameInWorld({ seed: 'break-a-boat', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Wright');
        const world = await harness.game.loadWorld();
        const recipe = getConveyanceRecipe('build-spirit-boat')!;
        const boat = mintCraft(recipe, {
            id: 'obj-craft-own-boat',
            name: recipe.name,
            ownerId: cultivator.id,
            ownerName: cultivator.name,
            wrightId: cultivator.id,
            wrightName: cultivator.name,
            bestHandOrdinal: 30,
            onDay: Math.floor(world.currentDay),
            mooredAt: cultivator.location
        })!;
        world.objects.push(boat);

        await harness.game.act('I smash the spirit boat');

        const after = (await harness.game.loadWorld()).objects
            .find(object => object.id === 'obj-craft-own-boat');
        // The row survives. `items.md` is emphatic that a thing which stops
        // existing must still be answerable for, and `ruin` is what says so.
        expect(after).toBeDefined();
        expect(isRuined(after!)).toBe(true);
        expect(after!.power).toBeNull();
    });
});

describe('what is not a made thing refuses honestly', () => {
    it('says why a village is not on the list rather than shrugging', async () => {
        const harness = await makeGameInWorld({ seed: 'burn-a-village', worldSeed: WORLD });
        await harness.game.newRun('Arsonist');

        const turn = await harness.game.act('I burn the village down');

        // Before this file, all three of these were `unclear`, whose line is
        // "your sentence did not resolve into anything you could do". That is
        // the engine claiming it could not READ the sentence, which is false:
        // it read it perfectly and has no rule for the consequence.
        expect(turn.toolCalls.some(call => call.action === 'unclear')).toBe(false);
        expect(turn.narration.toLowerCase()).not.toContain('does not resolve into anything');
    });

    it('answers the stall and the inn the same way', async () => {
        const harness = await makeGameInWorld({ seed: 'burn-a-stall', worldSeed: WORLD });
        await harness.game.newRun('Arsonist');

        for (const said of ['I smash the stall', 'I set fire to the inn']) {
            const turn = await harness.game.act(said);
            expect(turn.toolCalls.some(call => call.action === 'unclear')).toBe(false);
        }
    });
});
