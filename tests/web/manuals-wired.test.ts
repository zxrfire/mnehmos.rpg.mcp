/**
 * The manual, the master, and the ground.
 *
 * Three terms `computeCultivationRate` reads that the web layer supplied on
 * none of its six skip paths. Two of them were merely inert; the first was
 * actively inverted, and the inversion defeated the whole progression design.
 */

import { describe, it, expect } from 'vitest';
import { makeGame } from './harness';
import { computeCultivationRate } from '../../src/engine/cultivation/cultivation';
import { fitOf } from '../../src/web/encounters';
import { TECHNIQUES } from '../../src/data/cultivation/index';
import { getSpiritRoot } from '../../src/engine/cultivation/spirit-roots';

describe('no manual is a ceiling of zero, not an absent ceiling', () => {
    /**
     * The measurement that found it, kept as the guard.
     *
     * `techniqueExhausted(x, null)` is FALSE, so passing null for somebody
     * practising nothing gave them an unlimited climb. At ordinal 28: no
     * manual -> perDay 24.0, cap 13 -> perDay 0.0. Learning your first book
     * made you strictly worse off, and the optimal play at any cap was to
     * forget it.
     */
    it('is arithmetically worse to hold a spent manual than to hold none, in the ENGINE', () => {
        const who = { spiritRoot: 'single_wood', injuries: [], realmOrdinal: 28 } as never;
        const uncapped = computeCultivationRate(who, 'normal', {});
        const spent = computeCultivationRate(who, 'normal', { techniqueCap: 13 });
        const none = computeCultivationRate(who, 'normal', { techniqueCap: 0 });

        // The inversion, stated as arithmetic: holding a spent book stops you
        // dead and holding no book at all does not, unless the caller says so.
        expect(spent.perDay).toBe(0);
        expect(uncapped.perDay).toBeGreaterThan(0);
        // And the fix: zero is the number that means "no method".
        expect(none.perDay).toBe(0);
    });

    it('so a cultivator with no book gains nothing, however long they sit', async () => {
        const { db, game } = makeGame({ seed: 'cap-guard-a' });
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare('UPDATE cultivators SET spirit_stones = 200000 WHERE id = ?').run(cultivator.id);
        expect(game.state().cultivator.knownTechniques).toEqual([]);

        await game.cultivate(1800).catch(() => undefined);
        const after = game.state().cultivator;
        expect(after.realmOrdinal).toBe(0);
        expect(after.cultivationProgress).toBe(0);
    });

    it('and the first book is genuinely reachable, so the gate costs a sentence', async () => {
        // Measured 30 out of 30 fresh lives. If this ever stops being true the
        // hard ceiling above becomes a soft lock on turn one.
        let learned = 0;
        for (let i = 0; i < 8; i++) {
            const { game } = makeGame({ seed: `reach-${i}` });
            await game.newRun('Wen Shu');
            await game.act('I learn the Lesser Qi-Gathering Manual');
            if (game.state().cultivator.knownTechniques.length > 0) learned++;
        }
        expect(learned).toBe(8);
    });

    it('and with the book the same decade buys something', async () => {
        const { db, game } = makeGame({ seed: 'cap-guard-b' });
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare('UPDATE cultivators SET spirit_stones = 200000 WHERE id = ?').run(cultivator.id);
        await game.act('I learn the Lesser Qi-Gathering Manual');
        await game.cultivate(1800).catch(() => undefined);
        const after = game.state().cultivator;
        expect(after.realmOrdinal > 0 || after.cultivationProgress > 0).toBe(true);
    });
});

describe('where the manual stops, said before the decade is spent', () => {
    it('names the rung a cultivation manual carries to, in the listing', async () => {
        const { game } = makeGame({ seed: 'cap-shown' });
        await game.newRun('Wen Shu');
        const listed = await game.act('what arts can I learn');
        // The whole point: a ceiling nobody can see before committing to it is
        // a trap rather than a difficulty curve.
        expect(listed.narration).toMatch(/carries a cultivator (as far as|the whole way)/);
    });

    it('says plainly that an art is not a road', async () => {
        const { game } = makeGame({ seed: 'cap-shown-2' });
        await game.newRun('Wen Shu');
        const listed = await game.act('what arts can I learn');
        expect(listed.narration).toContain('it is an art, not a road');
    });
});

describe('whether a thing is for you, said out loud', () => {
    it('reports the miss in the engine\'s own words rather than as slowness', async () => {
        const { game, repos } = makeGame({ seed: 'fit-guard' });
        const { cultivator } = await game.newRun('Wen Shu');
        const row = repos.cultivators.getById(cultivator.id)!;
        const draws = getSpiritRoot(row.spiritRoot).elements;
        const wrong = TECHNIQUES.find(t => t.element && !draws.includes(t.element));
        expect(wrong).toBeTruthy();

        const fit = fitOf(row, wrong as never);
        expect(fit.fit).not.toBe('suited');
        // The sentence the whole suitability layer exists to deliver. Without
        // it players learn to sit LONGER rather than to go somewhere else,
        // which is the exact inversion it was built to prevent.
        expect(fit.line).toContain('written for');
        expect(fit.line.toLowerCase()).toContain('however long they sit');
    });

    it('reaches a player in the same breath as the learning', async () => {
        const { game } = makeGame({ seed: 'fit-inline' });
        await game.newRun('Wen Shu');
        const result = await game.act('I learn the Lesser Qi-Gathering Manual');
        expect(result.toolCalls.some(c => c.name === 'encounters.assessFit')).toBe(true);
        expect(result.narration).toMatch(/pitched at rung/);
    });
});
