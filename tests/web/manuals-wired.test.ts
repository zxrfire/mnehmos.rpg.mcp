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
import type Database from 'better-sqlite3';
import { handleLearn } from '../../src/server/consolidated/technique-manage';
import { isGuidingErrorBody } from '../../src/server/consolidated/cultivation-support';

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

    /**
     * THE GATE COSTS STONES NOW, AND IT STILL HAS TO BE PAYABLE.
     *
     * This test used to spend one sentence and it now spends two and a
     * purchase, because naming a book was the whole of acquiring one -
     * measured in a live run, "I want to learn the Lesser Qi-Gathering Manual"
     * left the purse untouched at thirty stones and the technique held. What
     * the test is FOR has not changed by a word: if the first book ever stops
     * being reachable in a fresh life, the hard ceiling at BOOKLESS_CEILING
     * becomes a soft lock on turn one, and a price nobody can pay is that same
     * wall wearing an economy.
     */
    it('and the first book is genuinely reachable, for stones, in every fresh life', async () => {
        let learned = 0;
        for (let i = 0; i < 8; i++) {
            const { game } = makeGame({ seed: `reach-${i}` });
            await game.newRun('Wen Shu');
            await game.act('I buy the Lesser Qi-Gathering Manual');
            await game.act('I learn the Lesser Qi-Gathering Manual');
            if (game.state().cultivator.knownTechniques.length > 0) learned++;
        }
        expect(learned).toBe(8);
    });

    /** And naming it without paying for it does not hand it over. */
    it('and naming it is not acquiring it', async () => {
        const { game } = makeGame({ seed: 'named-not-held' });
        const { cultivator } = await game.newRun('Wen Shu');
        const before = game.state().cultivator.spiritStones;

        const result = await game.act('I want to learn the Lesser Qi-Gathering Manual');

        expect(game.state().cultivator.knownTechniques, 'the book was free for the asking')
            .toEqual([]);
        expect(game.state().cultivator.spiritStones).toBe(before);
        // And the refusal names what would work, in stones.
        expect(result.narration).toMatch(/stall|spirit stone/i);
        expect(cultivator.id).toBeTruthy();
    });

    it('and with the book the same decade buys something', async () => {
        const { db, game } = makeGame({ seed: 'cap-guard-b' });
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare('UPDATE cultivators SET spirit_stones = 200000 WHERE id = ?').run(cultivator.id);
        await game.act('I buy the Lesser Qi-Gathering Manual');
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
        await game.act('I buy the Lesser Qi-Gathering Manual');
        const result = await game.act('I learn the Lesser Qi-Gathering Manual');
        expect(result.toolCalls.some(c => c.name === 'encounters.assessFit')).toBe(true);
        expect(result.narration).toMatch(/pitched at rung/);
    });
});

describe("above the common shelf, a road is somebody's property", () => {
    /**
     * The world ran on the books economy and the player did not.
     *
     * manuals.ts seeds sect libraries, hands copies to members, prices the
     * betrayal of selling one, and caps every NPC at the best book they hold.
     * A player could name any art they had the rung for and simply have it -
     * no copy, no house, no teacher, nothing paid. Seventeen of the catalog's
     * twenty-four roads were open that way; the widest opened at Foundation
     * Establishment and carried twenty rungs.
     *
     * Measured in scripts/probe-who-may-open-a-book.ts, found by playing.
     */
    // Both elementless and both open at thirteen, so the only thing that
    // differs between them is whether a house owns the road. The Treatise is
    // the widest free step the probe found: thirteen to thirty-three.
    const OWNED = 'single-road-treatise';            // req 13, cap 33, few houses
    const COMMON = 'foundation-tempering-scripture'; // req 13, cap 17, widely held

    const standAt = (db: Database.Database, id: string, ordinal: number) =>
        db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?').run(ordinal, id);

    it("refuses a house's road to somebody who serves no house", async () => {
        const { db, game } = makeGame({ seed: 'owned-road-a' });
        const { cultivator } = await game.newRun('Wen Shu');
        standAt(db, cultivator.id, 13);

        const result = await handleLearn({
            action: 'learn', techniqueId: OWNED, cultivatorId: cultivator.id
        });
        expect(isGuidingErrorBody(result)).toBe(true);
        expect((result as { error?: string }).error).toBe('no_road_to_this_book');
    });

    /**
     * The common shelf stays open and that is load-bearing rather than
     * generous. A hard ceiling at six with no way to buy a road past it is a
     * soft lock on turn one, which is why the reachability test above exists.
     */
    it('leaves the widely-held road open at the same rung', async () => {
        const { db, game } = makeGame({ seed: 'owned-road-b' });
        const { cultivator } = await game.newRun('Wen Shu');
        standAt(db, cultivator.id, 13);

        const result = await handleLearn({
            action: 'learn', techniqueId: COMMON, cultivatorId: cultivator.id
        });
        expect(isGuidingErrorBody(result)).toBe(false);
    });

    /**
     * A prize out of a sealed place is IN THE ROOM, which is the whole reason
     * anybody goes into one. The gate stands aside when the caller says where
     * the book came from.
     */
    it('stands aside for a book somebody actually found', async () => {
        const { db, game } = makeGame({ seed: 'owned-road-c' });
        const { cultivator } = await game.newRun('Wen Shu');
        standAt(db, cultivator.id, 13);

        const result = await handleLearn({
            action: 'learn', techniqueId: OWNED, cultivatorId: cultivator.id,
            provenance: 'found_in_place'
        });
        expect(isGuidingErrorBody(result)).toBe(false);
    });

    /**
     * And it never says WHICH houses teach it. Who teaches what is something
     * you find out by asking people; an engine that volunteers the list has
     * answered a question nobody put to it.
     */
    it('says how many houses teach it and never which', async () => {
        const { db, game } = makeGame({ seed: 'owned-road-d' });
        const { cultivator } = await game.newRun('Wen Shu');
        standAt(db, cultivator.id, 13);

        const result = await handleLearn({
            action: 'learn', techniqueId: OWNED, cultivatorId: cultivator.id
        }) as Record<string, unknown>;
        expect(typeof result.housesTeachingIt).toBe('number');
        expect(JSON.stringify(result)).not.toMatch(/Sect|Pavilion|House|Order/);
    });
});
