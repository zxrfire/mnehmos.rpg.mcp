/**
 * Rarity read off the world, rather than written down beside it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A TEST AND NOT A PARAGRAPH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The design owner's ruling is that a cultivator cannot work with materials
 * above their realm and that THIS is what makes the higher grades rare - not
 * price, not a quota, not anybody choosing a small number. `items.md` states
 * the same discipline from the other side: *"how many of something exist is a
 * fact you should be able to read off the world, not a number somebody chose."*
 *
 * A ruling of that shape is only true if the number it implies is actually
 * there to be counted. So this file counts it: seed a world, ask every living
 * cultivator which grades their rung lets them work, and read the supply of
 * each grade off the population pyramid.
 *
 * ── WHAT IS ASSERTED, AND WHY IT NEEDS NO CALIBRATION ────────────────────
 *
 * The ORDERING, and nothing else. Each grade is made by fewer people than the
 * grade below it, and the top two by nobody at all. That is scale-free, it
 * survives any content pass that does not change the regime, and it needs no
 * bar anybody could be tempted to widen - which is the failure mode
 * `AGENTS.md` records for exactly this kind of guard.
 *
 * The COUNTS are printed rather than asserted. Sizes drift with every change to
 * seeding, ground, teaching or the ladder, and a fixed figure here would be a
 * number to renegotiate rather than a fact to read. They are logged so that a
 * pass which flattens the production pyramid is visible in the output before it
 * would ever go red.
 *
 * ── AND THIS IS WHERE THE COUNTED/TRACKED LINE COMES FROM ────────────────
 *
 * `items.md` opens on the counted/tracked decision and `buying-and-bartering-
 * pills.ts` computes a cash/barter line from years of income, and neither knows
 * about the other or about this file. The three agree, and the reason is here:
 * only the bottom of the ladder has a population large enough to produce
 * indefinitely. A mortal-grade pill is a count on a holder because tens of
 * thousands of hands can make one; a heaven-grade pill is a row with a history
 * because the hands that could have made it are few enough to name.
 *
 * ── MEASURED OFF A SEEDED WORLD, NOT AN ADVANCED ONE ─────────────────────
 *
 * Deliberately. The claim is about the standing population's SHAPE, which the
 * seeder establishes and `the-pyramid.test.ts` is the acceptance test for. Not
 * advancing keeps this cheap and keeps it measuring the thing it is about
 * rather than the driver.
 */

import { describe, expect, it } from 'vitest';

import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import {
    canRefineGrade,
    madeBelowTheLid,
    refiningOrdinalFor
} from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import type { TechniqueGrade } from '../../../src/schema/cultivation.js';

/** Ascending, which is the order the claim is made in. */
const GRADES: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'];

/**
 * Two seeds, and they are NOT a sample - said plainly because the log looks
 * like one and would be quoted as one.
 *
 * Measured while writing this file: `seedWorld` returns an identical realm
 * histogram for every seed tried. 587 alive, and the same count at every rung
 * from 17 to 44, on `medicine-supply-a`, `medicine-supply-b` and `zzz`. The
 * standing population's SHAPE is fixed by the catalog the seeder places from;
 * the seed varies who and where, not how many stand how high. Variation enters
 * when the world is advanced, which is what `the-pyramid.test.ts` measures and
 * this file deliberately does not.
 *
 * So the second arm is a determinism guard rather than a second observation,
 * and nothing here may be reported as a spread. `AGENTS.md`: a control arm at
 * one seed is two samples, not a control - and two arms that cannot differ are
 * one sample twice.
 */
const SEEDS = ['medicine-supply-a', 'medicine-supply-b'] as const;

const catalog = await loadCultivationCatalog();

function makersIn(seed: string): { by: Map<TechniqueGrade, number>; alive: number } {
    const { state } = seedWorld({ seed, catalog });
    const by = new Map<TechniqueGrade, number>(GRADES.map(g => [g, 0]));
    let alive = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        alive++;
        for (const grade of GRADES) {
            if (canRefineGrade(grade, npc.cultivation.realmOrdinal)) {
                by.set(grade, (by.get(grade) ?? 0) + 1);
            }
        }
    }
    return { by, alive };
}

const RUNS = SEEDS.map(seed => ({ seed, ...makersIn(seed) }));
const pooled = (grade: TechniqueGrade): number =>
    RUNS.reduce((sum, run) => sum + (run.by.get(grade) ?? 0), 0);

/** Measured at the time of writing: 587 alive, 587 / 89 / 30 / 0 / 0 by grade. */

describe('who can actually make each grade of medicine', () => {
    it('prints the supply side of the ladder', () => {
        const lines = GRADES.map(grade => {
            const each = RUNS.map(r => r.by.get(grade) ?? 0).join(', ');
            return `  ${grade.padEnd(9)} rung ${String(refiningOrdinalFor(grade)).padStart(2)}  `
                + `${String(pooled(grade)).padStart(5)} pooled  (${each})`;
        });
        // eslint-disable-next-line no-console
        console.log(
            `\nliving cultivators: ${RUNS.map(r => r.alive).join(', ')}\n${lines.join('\n')}\n`
        );
        expect(RUNS.every(r => r.alive > 100)).toBe(true);
    });

    it('is the same world at every seed, which is why the log is one reading', () => {
        // The finding that keeps the numbers above honest. If seeding ever
        // starts varying the HISTOGRAM, this goes red and the file needs real
        // pooling rather than a determinism guard. That half is still exact
        // and is the half the log rests on.
        //
        // THE HEADCOUNT IS NO LONGER EXACT, BY ONE, AND THE REASON IS KNOWN.
        // It was exact because every house the seeder placed from filled the
        // same way at every seed. Adding the Orchid Court - a second house
        // that takes one sex - made the affiliation draw reject differently
        // per seed, and a house's own roll fills by a seed-dependent count, so
        // two worlds now differ by a person. Measured: 594 against 595.
        //
        // WHERE IT SHOWS, measured rather than assumed: the mortal band and
        // nowhere else. Everybody alive can make mortal grade, so one more
        // person alive is one more mortal-grade maker; earth, heaven, immortal
        // and chaos are identical across both arms, which means the drift is a
        // headcount at the bottom rather than the shape of the ladder moving.
        //
        // The claim this file makes is about SHAPE - "the seed varies who and
        // where, not how many stand how high" - and that claim survives
        // exactly. So the bound is loosened to what it actually needs rather
        // than the file being converted to pooling for one person of drift. If
        // it ever widens past a handful, or reaches a band above mortal, take
        // the file's own advice and pool it properly.
        const first = RUNS[0];
        const DRIFT = 2;
        for (const run of RUNS.slice(1)) {
            expect(Math.abs(run.alive - first.alive), `${run.seed} population differs`)
                .toBeLessThanOrEqual(DRIFT);
            for (const grade of GRADES) {
                const mine = run.by.get(grade) ?? 0;
                const theirs = first.by.get(grade) ?? 0;
                // Mortal may drift by the headcount above it. Every band that
                // says something about the shape of the ladder stays exact.
                if (grade === 'mortal') {
                    expect(Math.abs(mine - theirs), `${run.seed} mortal makers drifted`)
                        .toBeLessThanOrEqual(DRIFT);
                } else {
                    expect(mine, `${run.seed} ${grade} makers differ`).toBe(theirs);
                }
            }
        }
    });

    it('narrows at every step, which is what makes the higher grades rare', () => {
        for (let i = 1; i < GRADES.length; i++) {
            const lower = pooled(GRADES[i - 1]);
            const upper = pooled(GRADES[i]);
            expect(upper, `${GRADES[i]} is not rarer than ${GRADES[i - 1]}`)
                .toBeLessThanOrEqual(lower);
        }
        // And the narrowing is real rather than a tie all the way up. The three
        // grades made on this side are strictly ordered.
        expect(pooled('earth')).toBeLessThan(pooled('mortal'));
        expect(pooled('heaven')).toBeLessThan(pooled('earth'));
    });

    it('finds nobody at all who can make what is only sent down', () => {
        for (const grade of GRADES.filter(g => !madeBelowTheLid(g))) {
            expect(pooled(grade), `somebody in the world refines ${grade} grade`).toBe(0);
        }
    });

    it('leaves the bottom of the ladder open to everybody alive', () => {
        // The guard against the ruling being applied as a way to delete
        // medicine. Every living cultivator can work mortal-grade materials.
        for (const run of RUNS) {
            expect(run.by.get('mortal')).toBe(run.alive);
        }
    });
});
