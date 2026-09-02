/**
 * A question about an action is not the action.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FOUR INSTANCES OF ONE DEFECT, ALL FOUND BY PLAYING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The parser treated a stated desire, and then a stated question, as an
 * accomplished fact - so every obstacle the game so carefully described
 * evaporated the moment a player named it. Verbatim, from a fresh run as Lin
 * Baoqing, Qi Condensation Layer 1, thirty spirit stones, no sect, no arts:
 *
 *   "can I leave my sect"
 *       LEFT THE SECT, permanently, and reported "Contribution does not
 *       travel. Whatever was earned here stays here." A player asking what
 *       their options were was punished for asking.
 *
 *   "I want to learn the Lesser Qi-Gathering Manual"
 *       "Lesser Qi-Gathering Manual is held now... There is nothing standing
 *       between them and it except the work." Verified after: technique held,
 *       thirty stones untouched, no teacher, no time passed, no sect. One
 *       input earlier the game had refused to cultivate with one of the best
 *       sentences in it - "what is missing is not years and not discipline, it
 *       is a book, or somebody willing to teach them one."
 *
 *   "I want to join a sect"
 *       "Taken on by Azure Dew Sect, ranked Dew Servant. No journey was
 *       involved and none is implied." The line before, the game had answered
 *       "which sects would accept me" correctly: "Knowing a name is not an
 *       introduction. Somebody would have to put you in front of them."
 *
 *   "how do I treat my injuries"
 *       Bought four courses of care, spent twenty spirit stones, and lay still
 *       for thirty days. Asking HOW to do a thing did it, four times over.
 *
 * The last of those is why this file is not only about interrogatives. The
 * test is not the word at the front of the sentence; it is whether the player
 * has DECIDED. "How do I X" and "what would it take to X" are somebody working
 * out what X involves.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND WHAT THIS FILE IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Not a ban. `AGENTS.md`: the correct answer to "may I" is always "yes, and
 * here is what it costs", and a refusal with no cost attached is a smaller
 * world than one that says yes and then charges for it. Every verb below is
 * still reachable by the sentence that commands it, and the commanding forms
 * are asserted here beside the asking ones so that a future fix to one cannot
 * quietly delete the other.
 */

import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';
import { makeGame, cultivatorRow } from './harness';
import { parseIntent } from '../../src/web/actions';
import {
    isSoldAtAStall,
    manualsAStallCarries,
    stallPriceStones
} from '../../src/engine/world/what-a-copy-of-a-manual-costs-at-a-stall';

const PRIMER = 'lesser-qi-gathering-manual';

const sectOf = (db: Database.Database, id: string) =>
    (db.prepare('SELECT sect_id FROM cultivators WHERE id = ?').get(id) as
        { sect_id: string | null } | undefined)?.sect_id ?? null;

/**
 * Get into a house, the way the refusal says to.
 *
 * Walking up is an attempt now, so a fixture that needs a member cannot assume
 * the first ask lands. The refusal is keyed on the DAY - asking twice in one
 * afternoon gets the same answer word for word - so the retry is time passing
 * rather than a reroll, which is exactly what the engine tells the player. A
 * fixture that looped on the same day would hang forever, and that it does not
 * is itself worth knowing.
 */
async function intoAHouse(
    db: Database.Database,
    game: { act(text: string): Promise<unknown> },
    id: string
): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
        await game.act('I join the Azure Dew Sect');
        const held = sectOf(db, id);
        if (held !== null) return held;
        await game.act('I wait a day');
    }
    throw new Error('twelve days of asking and the house never once looked up');
}

describe('a question never changes state', () => {
    /**
     * INSTANCE 3, AND THE WORST OF THE FOUR.
     *
     * A question about whether something is possible performed the
     * irreversible thing it asked about, and the forfeiture is permanent:
     * contribution does not travel, and the seat cap means it cannot be
     * bought back by re-entering.
     */
    it('does not resign a membership when asked whether one could', async () => {
        const { db, game } = makeGame({ seed: 'asked-to-leave', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);

        const inAHouse = await intoAHouse(db, game, cultivator.id);

        for (const question of [
            'can I leave my sect',
            'could I leave the sect',
            'what would it cost to leave the sect',
            'should I leave the sect',
            'is it possible to leave my sect',
            'what happens if I leave the sect'
        ]) {
            await game.act(question);
            expect(sectOf(db, cultivator.id), `"${question}" resigned the membership`)
                .toBe(inAHouse);
        }
    }, 120_000);

    /** And the sentence that DECIDES still decides. Never a ban. */
    it('still leaves when told to', async () => {
        const { db, game } = makeGame({ seed: 'told-to-leave', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);

        await intoAHouse(db, game, cultivator.id);

        await game.act('I leave the sect');
        expect(sectOf(db, cultivator.id)).toBeNull();
    }, 120_000);

    /**
     * INSTANCE 4. Asking HOW spent stones and a month.
     *
     * Checked on the raw row rather than on the narration, because the
     * narration is exactly what was convincing about the bug: it described a
     * purchase in perfect detail and the purchase had happened.
     */
    it('does not buy a course of care when asked how care is got', async () => {
        const { db, game } = makeGame({ seed: 'asked-how-to-treat', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');

        const before = cultivatorRow(db, cultivator.id);
        const daysBefore = game.state().run.elapsedDays;

        for (const question of [
            'how do I treat my injuries',
            'what would it take to treat my injuries',
            'where can I get my injuries treated',
            'how much would it cost to treat my injuries'
        ]) {
            await game.act(question);
        }

        const after = cultivatorRow(db, cultivator.id);
        expect(after.spirit_stones, 'asking how bought it').toBe(before.spirit_stones);
        expect(game.state().run.elapsedDays, 'asking how spent time')
            .toBe(daysBefore);
    }, 120_000);

    /** Asking whether the ground will take them does not spend a month on it. */
    it('does not spend a month when asked whether cultivating here would work', async () => {
        const { game } = makeGame({ seed: 'asked-to-cultivate', worldEnabled: true });
        await game.newRun('Lin Baoqing');
        const before = game.state().run.elapsedDays;

        await game.act('can I cultivate here');
        await game.act('should I cultivate here');

        expect(game.state().run.elapsedDays).toBe(before);
    });

    /**
     * The routing itself, asserted directly, because the four above can only
     * cover the verbs they happen to touch and the guard is general.
     *
     * `assess` is the default landing for anything not named in the table, and
     * it is in `READ_ONLY_ACTIONS`, so a verb added after this was written is
     * answered inertly by construction rather than by somebody remembering.
     */
    it('routes every asking form to a read and every commanding form to the verb', () => {
        const asked: Array<[string, string]> = [
            ['can I leave my sect', 'sect'],
            ['how do I treat my injuries', 'market'],
            ['what would it take to learn the Lesser Qi-Gathering Manual', 'list_techniques'],
            ['is it possible to learn the Lesser Qi-Gathering Manual', 'list_techniques'],
            ['could I learn the Lesser Qi-Gathering Manual', 'list_techniques'],
            ['can I cultivate here', 'ceiling'],
            ['where can I buy a manual', 'market']
        ];
        for (const [sentence, action] of asked) {
            expect(parseIntent(sentence).action, sentence).toBe(action);
        }

        // A question about leaving reaches the member's own standing, never
        // the resignation.
        expect(parseIntent('can I leave my sect').intent).toBe('standing');
        expect(parseIntent('I leave my sect').intent).toBe('leave');

        const commanded: Array<[string, string]> = [
            ['I leave the sect', 'sect'],
            ['I learn the Lesser Qi-Gathering Manual', 'learn_technique'],
            ['I buy the Lesser Qi-Gathering Manual', 'buy'],
            ['I cultivate for ten years', 'cultivate'],
            ['I get my injuries treated', 'treat']
        ];
        for (const [sentence, action] of commanded) {
            expect(parseIntent(sentence).action, sentence).toBe(action);
        }
    });

    /**
     * And the reads a player already had must not be swallowed by the guard.
     * Every one of these contains a modal next to "I" and every one of them
     * already answered correctly.
     */
    it('leaves the reads that already worked exactly where they were', () => {
        const unchanged: Array<[string, string]> = [
            ['what arts can I learn', 'list_techniques'],
            ['where can I go', 'destinations'],
            ['who can teach me', 'teacher'],
            ['what can I buy', 'market'],
            ['how long can I live', 'status'],
            ['what should I do', 'ceiling'],
            ['what can I refine', 'refine']
        ];
        for (const [sentence, action] of unchanged) {
            expect(parseIntent(sentence).action, sentence).toBe(action);
        }
    });
});

describe('a manual costs what a manual costs', () => {
    /**
     * INSTANCE 2. Naming the book was the whole of acquiring it.
     *
     * `manuals.ts` has modelled books as objects with holders and counts for
     * the entire world from the beginning, and the player was not in it -
     * which is the defect `AGENTS.md` opens its "the world's rules must bind
     * the player too" section with, using books as the worked example.
     */
    it('does not hand over a road for naming it', async () => {
        const { db, game } = makeGame({ seed: 'named-is-not-held', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        const before = cultivatorRow(db, cultivator.id);

        const result = await game.act('I want to learn the Lesser Qi-Gathering Manual');

        expect(game.state().cultivator.knownTechniques, 'free for the asking').toEqual([]);
        expect(cultivatorRow(db, cultivator.id).spirit_stones).toBe(before.spirit_stones);
        // A refusal must name what would work. `AGENTS.md`, and it is the best
        // thing in this build.
        expect(result.narration).toMatch(/stall|spirit stone|sold/i);
    }, 120_000);

    /**
     * And the correct verb was the one that did not work: "buy a manual" was
     * refused with the look people give somebody asking for a thing that is
     * not sold, and then listed millet, inns and ferry crossings.
     */
    it('answers "buy a manual" with what the stall has, and charges nothing to look', async () => {
        const { db, game } = makeGame({ seed: 'stall-listing', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        const before = cultivatorRow(db, cultivator.id);

        const result = await game.act('buy a manual');

        expect(result.narration, 'the stall still refuses to exist')
            .not.toMatch(/thing that is not sold/i);
        expect(result.narration).toMatch(/Lesser Qi-Gathering Manual/);
        expect(cultivatorRow(db, cultivator.id).spirit_stones).toBe(before.spirit_stones);
    }, 120_000);

    /** The purchase itself: stones out, copy held, and the road then open. */
    it('sells the copy for stones, and the copy is what opens the road', async () => {
        const { db, game } = makeGame({ seed: 'buy-then-learn', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        const purse = Number(cultivatorRow(db, cultivator.id).spirit_stones);
        const asking = stallPriceStones(PRIMER)!;
        expect(asking, 'the primer has no price').toBeGreaterThan(0);
        expect(asking, 'a beginner cannot afford the only road they have')
            .toBeLessThanOrEqual(purse);

        await game.act('I buy the Lesser Qi-Gathering Manual');
        const spent = purse - Number(cultivatorRow(db, cultivator.id).spirit_stones);
        expect(spent, 'the book was free').toBeGreaterThan(0);
        // Buying is not reading. Two separate facts, two separate sentences.
        expect(game.state().cultivator.knownTechniques).toEqual([]);

        await game.act('I learn the Lesser Qi-Gathering Manual');
        expect(game.state().cultivator.knownTechniques).toContain(PRIMER);
    }, 120_000);

    /**
     * The line the stall sits on, checked against the catalog rather than
     * against a list written here.
     *
     * `items.md`: below the line things have prices; above it cash is not the
     * medium, and that refusal is correct and good writing and stays. A house
     * book carrying no further than the market primer is still that house's -
     * the Azure Dew Sect's canon opens at 0 and stops at 13 exactly as the
     * block-printed one does, and four hundred years of Dew teachers wrote
     * into it. That is what somebody sweeps a courtyard for.
     */
    it('carries the widely-copied books and none of anybody\'s own', () => {
        const stock = manualsAStallCarries().map(m => m.id);
        expect(stock).toContain(PRIMER);
        expect(stock, 'a stall is selling a house its own recruitment pitch')
            .not.toContain('azure-dew-gathering-canon');
        expect(isSoldAtAStall('single-road-treatise'), 'a treasure went on a market stall')
            .toBe(false);
        for (const id of stock) expect(stallPriceStones(id)).toBeGreaterThan(0);
    });

    /** And the thing above the line keeps its refusal, now naming a route. */
    it('still refuses to sell what nobody sells, and says what would work', async () => {
        const { db, game } = makeGame({ seed: 'not-for-sale', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        const before = cultivatorRow(db, cultivator.id);

        const result = await game.act('I buy the Azure Dew Gathering Canon');

        expect(cultivatorRow(db, cultivator.id).spirit_stones).toBe(before.spirit_stones);
        expect(result.narration).toMatch(/teach|house|stall/i);
    }, 120_000);
});

describe('a house takes somebody on, or it does not', () => {
    /**
     * INSTANCE 1. A category resolved to a specific house and enrolled the
     * player in it, one line after the game had said knowing a name is not an
     * introduction.
     */
    it('does not enrol anybody who asked about sects in general', async () => {
        const { db, game } = makeGame({ seed: 'a-sect-in-general', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');

        for (const sentence of [
            'I want to join a sect',
            'I join a sect',
            'I apply to a sect',
            'should I join a sect'
        ]) {
            await game.act(sentence);
            expect(sectOf(db, cultivator.id), `"${sentence}" enrolled somebody`).toBeNull();
        }
    }, 120_000);

    /**
     * Walking up on your own is an ATTEMPT, and attempts have both outcomes.
     *
     * Pooled across seeds rather than pinned to one, because a single seed
     * proves only what that seed did - `AGENTS.md`, "pool the sample" - and
     * because what is being asserted is that the door is neither automatic nor
     * shut. Both halves are load-bearing: an automatic yes is the defect, and
     * a door nobody gets through is the ban the design forbids.
     */
    it('is neither an automatic yes nor a wall', async () => {
        let taken = 0;
        const seeds = 24;
        for (let i = 0; i < seeds; i++) {
            const { db, game } = makeGame({ seed: `door-${i}`, worldEnabled: true });
            const { cultivator } = await game.newRun('Lin Baoqing');
            await game.act('I join the Azure Dew Sect');
            if (sectOf(db, cultivator.id) !== null) taken++;
        }
        expect(taken, 'nobody walked up and got in').toBeGreaterThan(0);
        expect(taken, 'every stranger who asked was taken, with nobody speaking for them')
            .toBeLessThan(seeds);
    }, 300_000);
});
