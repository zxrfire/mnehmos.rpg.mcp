/**
 * A house may fall; the ladder may not - the long walk out of
 * `demography.test.ts`, in a file of its own so the rest of that file runs
 * beside it rather than behind it. Fifteen hundred years of one seed is the
 * longest single walk in the suite and cannot be split, only started early.
 */

import { describe, it, expect } from 'vitest';
import { soakedWorld } from '../../support/soaked-world.js';

/**
 * A HOUSE MAY FALL. THE LADDER MAY NOT.
 *
 * ── WHAT THIS REPLACES ───────────────────────────────────────────────────
 *
 * There used to be a test in the block above called *"still lets the world
 * decline, because decline is correct"*, and it asserted that fewer than a dozen
 * people were left standing above ordinal 30 after five centuries. That licensed
 * the wrong thing twice over. It passes at zero - a world with nobody above
 * ordinal 30 at all satisfies it - and it treated a HOUSE declining and the
 * WORLD declining as the same fact. They are not the same fact, and only one of
 * them is wanted.
 *
 * A house falling is the setting working. Houses lose their ground, fail to
 * replace an elder, are destroyed in a war. Measured across six seeds at fifteen
 * hundred years, 21 to 26 of the 32 the world starts with have ended, and that
 * is correct and must stay possible.
 *
 * ── WHAT THE OLD TEST WAS LETTING THROUGH ────────────────────────────────
 *
 * Measured on this seed before the fix this test was written for, and the shape
 * is why five centuries was the wrong horizon to ask at - it looks survivable at
 * 500 and is plainly not by 1500:
 *
 *              at or below   Foundation   Core   Nascent   Deity
 *               Qi Cond.
 *      500y            89%           26      6         5       6
 *     1000y            93%           21      3         0       1
 *     1500y            94%           21      3         0       0
 *     3000y            96%           13      3         1       1
 *
 * A floor and a ceiling with nothing between them. Every person in the bands
 * above the middle was a survivor of the seeding rather than somebody who
 * climbed, so the world was not in a Late Age, it was running out of people and
 * calling the shortage an era.
 *
 * THE CAUSE was that literacy was seeded once and never manufactured again.
 * `manualsOf` reads `teaches` off the content catalog keyed by the id of a house
 * somebody wrote by hand, so every house the world FOUNDS for itself read back
 * an empty shelf and could teach nobody anything for as long as it stood. Houses
 * standing went 32 -> 47 over three thousand years while houses holding a shelf
 * went 30 -> 5. With no reachable ceiling nobody crosses, and a distribution
 * with no inflow can only erode toward the rung people enter at. See `shelfOf`
 * and `librariesCarriedOutBy`.
 *
 * The same run after the fix: 75% at or below Qi Condensation, and 60 / 40 / 12
 * / 7 across the four bands, of whom 121 of 126 were born after the seeding.
 */
describe('a house may fall; the ladder may not', () => {
    // Deliberately longer than the block above. The collapse this pins is a
    // long-horizon shape and five hundred years does not show it - the middle
    // bands are still holding the last of the seeded cohort at that point.
    const HORIZON_YEARS = 1500;

    const REALMS: [string, number, number, number][] = [
        // name, lo, hi, and the floor this world has to keep occupied. Measured
        // across six seeds after the fix: 53-74, 21-40, 8-12, 1-8. The bars are
        // set below every one of those and above every pre-fix figure, so this
        // fails on the defect and does not fail on ordinary seed variance.
        ['Foundation Establishment', 13, 16, 20],
        ['Core Formation', 17, 20, 10],
        ['Nascent Soul', 21, 24, 3],
        ['Deity Transformation', 25, 28, 1]
    ];

    it('lets its houses fall without letting its ladder collapse', async () => {
        const seeded = await soakedWorld('drift-guard', { years: 0 });
        // Who and what the world started with, so a later count can tell a
        // survivor from an arrival. A band held entirely by people placed there
        // at seeding is a band that is dying, whatever its headcount reads.
        const seededNpcIds = new Set(seeded.npcs.map(n => n.id));
        const seededFactionIds = seeded.factions.map(f => f.id);
        // The five hundred years `demography.test.ts` keeps, first, so this waits
        // on that walk rather than repeating it.
        await soakedWorld('drift-guard', { years: 500 });
        const state = await soakedWorld('drift-guard', { years: HORIZON_YEARS });
        const alive = state.npcs.filter(n => n.status === 'alive');

        // ── Decline, at the level decline belongs to. ──────────────────────
        const fallen = seededFactionIds.filter(
            id => state.factions.find(f => f.id === id)?.dissolvedOnDay != null
        );
        expect(
            fallen.length,
            `${fallen.length} of the ${seededFactionIds.length} houses the world started with `
            + `have ended in ${HORIZON_YEARS} years. Houses have to be able to fall.`
        ).toBeGreaterThan(0);

        // ── And the thing that must not decline. ───────────────────────────
        const bottom = alive.filter(n => n.cultivation.realmOrdinal <= 12).length;
        expect(
            bottom / alive.length,
            `${Math.round((bottom / alive.length) * 100)}% of the living world stands at or `
            + 'below Qi Condensation, which is a floor rather than a distribution'
        ).toBeLessThan(0.85);

        // The exact symptom in the complaint: consecutive empty bands in the
        // middle of the ladder. A realm nobody is standing in is a realm nobody
        // crossed, and four of those in a row is not a Late Age.
        const counts = REALMS.map(([, lo, hi]) => alive.filter(
            n => n.cultivation.realmOrdinal >= lo && n.cultivation.realmOrdinal <= hi).length);
        const reads = REALMS.map(([n], i) => `${n} ${counts[i]}`).join(', ');
        REALMS.forEach(([name, , , floor], i) => {
            expect(counts[i], `${name} holds ${counts[i]}. The ladder reads ${reads}`)
                .toBeGreaterThanOrEqual(floor);
        });
        // And it has to narrow. A flat middle is not a pyramid either, and the
        // apex staying rare is the half of this that must not be fixed away.
        expect(counts[0], `the ladder reads ${reads}`).toBeGreaterThan(counts[3]);

        // ── Turnover of identity, which is what makes the middle alive. ────
        //
        // The half a headcount cannot see. A band held by the seeded cohort
        // empties the moment they run out of lifespan, so a world can read
        // healthy on the day and be finished. This is the measure that told the
        // two apart, and it is worth keeping even though the collapse above is
        // what has the teeth.
        const high = alive.filter(n => n.cultivation.realmOrdinal >= 13);
        const risen = high.filter(n => !seededNpcIds.has(n.id));
        expect(
            risen.length / Math.max(1, high.length),
            `${risen.length} of ${high.length} people above Qi Condensation were born since `
            + 'the seeding. The rest of the ladder is inherited rather than climbed.'
        ).toBeGreaterThan(0.5);
    }, 600_000);
});
