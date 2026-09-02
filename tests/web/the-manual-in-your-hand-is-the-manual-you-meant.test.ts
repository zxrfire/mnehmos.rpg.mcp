/**
 * A bare noun means the thing the player is holding, not a row in a catalog.
 *
 * ── THE TURN THIS WAS FOUND ON ───────────────────────────────────────────
 *
 * A player at Qi Condensation Layer 1 held one thing in the world: the Lesser
 * Qi-Gathering Manual, bought two turns earlier. They typed *"I open the manual
 * and start learning it"*. The ruling:
 *
 *     Azure Dew Gathering Canon: refused.
 *     The engine declined, and the reason it filed is no copy of this book.
 *
 * The refusal was then perfectly reasoned about the wrong object - *"There is
 * no such book to be found on any stall in the market; it is a thing kept in
 * private houses"* - and the only way through was to type the exact catalog
 * title of the thing in their own pouch.
 *
 * That is the you-must-know-a-string failure `AGENTS.md` rules out, sitting on
 * the most load-bearing turn in the game. The whole opening is one blocker:
 * *"What is missing is not years and not discipline. It is a book, or somebody
 * willing to teach them one."* A first-time player is told that every turn,
 * works out they need a manual, buys one, and then cannot take it up.
 *
 * ── AND WHY THE FIX IS AN ORDER RATHER THAN A BETTER MATCHER ─────────────
 *
 * A matcher will always find something plausible in a catalog of hundreds, and
 * plausible is exactly how a book nobody had seen beat the copy in the pouch.
 * The design owner's ruling is precedence: what the player HOLDS, then what is
 * standing in front of them, then the catalog. This file pins the first and
 * third, which is what a book has.
 */

import { describe, expect, it } from 'vitest';

import { makeGame, engineCalls } from './harness';
import { resolveTechnique } from '../../src/web/entities';
import { recordACopyHeld } from '../../src/server/consolidated/technique-manage';
import { TECHNIQUES } from '../../src/data/cultivation';

/** A book whose name is not the one a bare "manual" would otherwise reach. */
const HELD = TECHNIQUES.find(t => /manual/i.test(t.name) && t.requiredOrdinal === 0)
    ?? TECHNIQUES.find(t => /manual/i.test(t.name))!;

describe('the manual in your hand is the manual you meant', () => {
    it('resolves a bare noun to the copy the cultivator holds', async () => {
        const { db, game, repos } = makeGame({ seed: 'the-manual' });
        const { cultivator } = await game.newRun('Wen Shu');
        recordACopyHeld(db, cultivator.id, HELD.id);

        expect(resolveTechnique(repos, 'the manual', cultivator.id)?.id).toBe(HELD.id);
        expect(resolveTechnique(repos, 'manual', cultivator.id)?.id).toBe(HELD.id);
    });

    it('reaches it by typing the sentence a player types', async () => {
        // The property is only worth anything at the point somebody meets it,
        // and this is the sentence that was measured failing.
        const { db, game } = makeGame({ seed: 'the-manual-played' });
        const { cultivator } = await game.newRun('Wen Shu');
        recordACopyHeld(db, cultivator.id, HELD.id);

        const result = await game.act('I learn the manual');
        const resolved = engineCalls(result).find(c => c.name === 'engine.resolveTechnique');
        // Either it resolved (no refusal row at all) or it refused something -
        // and if it refused, it must not have refused a book nobody named.
        expect(resolved?.summary ?? '').not.toMatch(/No art called/);
        expect(result.narration).toContain(HELD.name);
    });

    it('still reaches the catalog for a book nobody is holding', async () => {
        // The order is a precedence, not a restriction. Naming a book by its
        // own name has to keep working whether or not the player owns one -
        // that is how somebody asks what a thing they have heard of is.
        const { game, repos } = makeGame({ seed: 'the-manual-catalog' });
        const { cultivator } = await game.newRun('Wen Shu');
        const notHeld = TECHNIQUES.find(t => t.id !== HELD.id)!;

        expect(resolveTechnique(repos, notHeld.name, cultivator.id)?.id).toBe(notHeld.id);
    });

    it('does not turn every bare noun into whatever is held', async () => {
        // The held set is searched first, not preferred unconditionally: a
        // query that matches nothing held and nothing in the catalog still
        // resolves to nothing, which is what lets a refusal name a route.
        const { db, game, repos } = makeGame({ seed: 'the-manual-miss' });
        const { cultivator } = await game.newRun('Wen Shu');
        recordACopyHeld(db, cultivator.id, HELD.id);

        expect(resolveTechnique(repos, 'the ferryman', cultivator.id)).toBeNull();
    });
});
