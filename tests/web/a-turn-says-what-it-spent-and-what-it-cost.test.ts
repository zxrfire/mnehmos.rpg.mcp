/**
 * What a turn owes the player about the span it spent and the price it charged.
 *
 * Every block is one thing found by playing with no model in front of the
 * engine, and every one of them reads identically with a model in front of it,
 * because a model narrates the facts the composer built and cannot narrate one
 * the composer dropped. `AGENTS.md`, "It has to play as a game, not as a
 * command line": you are told what happened.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { maxHpForOrdinal, maxQiForOrdinal } from '../../src/engine/cultivation/realms';

const WORLD = 'a-turn-says-what-it-spent';

describe('a span says the span the player asked for', () => {
    /**
     * PLAYED, and it is the reason `shortSkip` now carries `askedForDays`:
     *
     *   > I wait a year
     *   "Hollowmarket. The qi is thin here; it always has been. Shen Wu sat
     *    down anyway. Waiting of 4 months was intended."
     *   ... and fifty days were spent.
     *
     * `parseIntent` returns `days: 365`. The encounter layer cut the span to
     * four months before `simulateTimeSkip` ever saw it, so the skip's own
     * `requestedDays` was the truncated figure and `factsForTimeSkip` fell back
     * to it - reporting the engine's arithmetic as the player's intention.
     *
     * The second half is worse than the misreport. `asked > requestedDays` is
     * the condition on the paragraph that exists to say *something was already
     * coming that would end it early*, and with the two equal that paragraph
     * could never fire on any of the seven verbs this path serves.
     */
    it('says a year when a year was asked for, and says what shortened it', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'asked-for-a-year' });
        await h.game.newRun('Shen Wu');

        const { narration } = await h.game.act('I wait a year');

        expect(narration).toContain('Waiting of 1 year was intended');
        expect(narration).not.toMatch(/Waiting of \d+ months was intended/);
        // And the correction to the player's own sentence, which could not
        // print while `asked` was being read off the truncated span.
        expect(narration).toContain('It was never going to be 1 year');
    }, 60_000);
});

describe('a crossing enlarges the vessel, and says which of the two it was', () => {
    /**
     * PLAYED: six crossings on command, ordinal 0 to 6, `maxHp` 40 the whole
     * way and `maxQi` 25 the whole way. The same six taken inside a seclusion
     * grow both, because `applyTimeSkip` goes through `advanceRealm` - so the
     * two ways of climbing one ladder produced two different bodies, and the
     * one a player reaches by typing "I break through" produced a newborn's.
     *
     * `advanceRealm` calls itself "the one function every rank change in the
     * codebase passes through" and `strikeBarrier` deliberately is not one,
     * because `advanceRealm` zeroes accumulated progress and a successful
     * attempt has to keep the overflow. What was missing was the half of it
     * about the BODY.
     */
    it('grows the pool on the path a player actually types', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'a-crossing' });
        const opened = await h.game.newRun('Shen Wu');
        const id = opened.cultivator.id;

        const start = h.game.state().cultivator;
        let crossed = 0;
        for (let i = 0; i < 6 && crossed < 2; i++) {
            h.repos.cultivators.update(id, { cultivationProgress: 100_000 } as never);
            const before = h.game.state().cultivator.realmOrdinal;
            await h.game.act('I break through');
            if (h.game.state().cultivator.realmOrdinal > before) crossed++;
        }

        const now = h.game.state().cultivator;
        expect(now.realmOrdinal, 'the run climbed').toBeGreaterThan(start.realmOrdinal);
        expect(now.maxHp, 'the vessel grew with the rung').toBeGreaterThan(start.maxHp);
        expect(now.maxQi).toBeGreaterThan(start.maxQi);
        // And it is not a heal. The share carried, not the number.
        expect(now.hp).toBeLessThanOrEqual(now.maxHp);
    }, 60_000);

    /**
     * "40 of 1280 left in the body" reads as a terrible wound and is the vessel
     * growing. It is the one number on the screen that moved and no sentence
     * anywhere said which of the two it was.
     */
    it('says the vessel grew, in the same breath as what is standing in it', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'a-crossing-said' });
        const opened = await h.game.newRun('Shen Wu');
        const id = opened.cultivator.id;

        for (let i = 0; i < 6; i++) {
            const before = h.game.state().cultivator;
            h.repos.cultivators.update(id, { cultivationProgress: 100_000 } as never);
            const { narration } = await h.game.act('I break through');
            const after = h.game.state().cultivator;
            if (after.maxHp > before.maxHp) {
                expect(narration).toContain('larger than it was');
                expect(narration).toContain(`${before.maxHp} before`);
                expect(narration).toContain(`${after.maxHp} now`);
                return;
            }
        }
        throw new Error('no crossing enlarged the pool in six attempts');
    }, 60_000);

    /**
     * `realms.ts` states the invariant against this exact line - "`maxHpForOrdinal
     * (might, 0)` must equal what the birth path writes" - and the birth path
     * kept its own copy of the formula, in step by hand across two files.
     */
    it('opens a life on the ladder\'s own arithmetic', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'a-birth' });
        const opened = await h.game.newRun('Shen Wu');
        const born = opened.cultivator;

        expect(born.maxHp).toBe(maxHpForOrdinal(born.attributes.might, 0));
        expect(born.maxQi).toBe(maxQiForOrdinal(born.attributes.insight, 0));
    }, 60_000);
});

describe('the listings say what you are holding', () => {
    /**
     * PLAYED, after buying and learning the manual:
     *
     *   > what arts do I know
     *   "What a root like yours could take up: Cross-Meridian Strike ...
     *    Swallow-Skimming Step ... Azure Dew Gathering Canon ..."
     *
     * Every phrasing of the question reaches `listTechniques`, which filters
     * `known !== true` - so the art the player is practising is the one row
     * guaranteed to be absent, and no sentence anywhere in the game named it.
     */
    it('names the method being practised', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'held-arts' });
        await h.game.newRun('Shen Wu');
        await h.game.act('I buy the Lesser Qi-Gathering Manual');
        await h.game.act('I learn the Lesser Qi-Gathering Manual');

        // The phrasings the PATTERN TABLE reaches, so this measures the
        // listing rather than the embedding tier - the vectors beside the model
        // are a build artifact and a stale one would turn a defect in the
        // answer into a green test, or a green answer into a red one. The
        // phrasings that need the tier ("what arts do I know", "what am I
        // practising") reach the same surface and are its business.
        for (const asked of [
            'what can I learn',
            'what arts can I learn',
            'list techniques',
            'what techniques are there'
        ]) {
            const { narration } = await h.game.act(asked);
            expect(narration, asked).toContain('What you are practising');
            expect(narration, asked).toContain('Lesser Qi-Gathering Manual');
        }
    }, 120_000);

    /**
     * PLAYED: the purchase debits the purse, writes the provenance and says so
     * well - and then `what do I have` answered "Nothing in the pouch at all".
     * The same shape as the artifact defect this read was already fixed for:
     * `recordACopyHeld` writes to the knowledge table, and the alchemy pouch
     * reader cannot see one however long it looks.
     */
    it('shows a bought book to the verb whose job is saying what you have', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'held-books' });
        await h.game.newRun('Shen Wu');

        const bought = await h.game.act('I buy the Lesser Qi-Gathering Manual');
        expect(bought.narration, 'the stall sold one').toContain('the copy is yours');

        const { narration } = await h.game.act('what do I have');
        expect(narration).not.toContain('Nothing in the pouch at all');
        expect(narration).toContain('Lesser Qi-Gathering Manual');
    }, 60_000);
});

describe('a word the game itself uses is a word the game accepts', () => {
    /**
     * PLAYED: `what can I gather here` came back "Shen Wu has never heard of
     * \"here\"" - about the ground under their feet, in a word the game prints
     * in almost every sentence. And behind it, once `here` resolved, the
     * assessment of a PLACE had no branch in `summariseToolBody` at all and
     * came back as "It is done. Nothing about it drew attention." - the eighth
     * verb to land on that shrug.
     */
    it('assesses the ground somebody is standing on', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'here-is-a-place' });
        const opened = await h.game.newRun('Shen Wu');
        const where = opened.cultivator.location;

        const { narration } = await h.game.act('what can I gather here');

        expect(narration).not.toContain('has never heard of');
        expect(narration).not.toContain('Nothing about it drew attention');
        expect(narration).toContain(where!);
    }, 60_000);
});
