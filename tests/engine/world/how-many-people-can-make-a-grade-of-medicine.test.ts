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
 * Measured while writing this file: `seedWorld` returned an identical realm
 * histogram for every seed tried. 587 alive, and the same count at every rung
 * from 17 to 44, on `medicine-supply-a`, `medicine-supply-b` and `zzz`. So the
 * second arm was a determinism guard rather than a second observation, and
 * nothing here could be reported as a spread. `AGENTS.md`: a control arm at one
 * seed is two samples, not a control - and two arms that cannot differ are one
 * sample twice.
 *
 * THAT IS NO LONGER TRUE BELOW THE TOP OF THE LADDER, and the log has to be
 * read accordingly. `a-house-raises-its-own.ts` has each house raise its own
 * rank and file, which fills by a count depending on who the seed already put
 * on its roll, so the headcount now varies by seed: 610 / 610 / 610 became
 * 857 / 849 / 850. The rungs above what the derived population reaches are
 * still identical at every seed, because those people are placed from the
 * catalog - so the shape claim this file rests on is intact and the arms are
 * now a small sample at the bottom and a determinism guard at the top. Two
 * seeds is still not a spread worth quoting; see the guard below for which
 * half is which.
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

/**
 * At the time of writing: 587 alive, 587 / 89 / 30 / 0 / 0 by grade.
 * After `a-house-raises-its-own.ts`: 857 / 849 alive, and 101 / 33 / 0 / 0
 * above mortal on both seeds. The rank and file a house raises stand at the
 * bottom of the ladder, so what moved is the mortal band and the near edge of
 * earth; heaven and above are the catalog's people and did not move at all.
 */

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

    it('fixes the top of the ladder at every seed, and lets the bottom be a population', () => {
        // ── THIS WAS A DETERMINISM GUARD AND IS NO LONGER ONE ────────────
        //
        // It used to assert that every seed gave the same world, because every
        // house the seeder placed from filled the same way at every seed. Two
        // passes have since made a house's roll seed-dependent on purpose: the
        // Orchid Court, a second house that takes one sex, made the affiliation
        // draw reject differently per seed (one person of drift, 594 against
        // 595), and `a-house-raises-its-own.ts` now has each house raise its
        // own rank and file up to what it is worth modelling, which fills by a
        // count that depends on who the seed already put on its roll.
        //
        // MEASURED, THREE SEEDS, BOTH ARMS, ONE COMMAND
        // (`rollWorthModelling: 0` is the world without the rank-and-file pass):
        //
        //                         without              with
        //   alive                 610, 610, 610   ->   857, 849, 850
        //   mortal makers         610, 610, 610   ->   857, 849, 850
        //   earth makers           96,  96,  95   ->   101, 101,  97
        //   heaven makers          33,  33,  33   ->    33,  33,  33
        //   immortal / chaos        0,   0,   0   ->     0,   0,   0
        //
        // So the drift is now eight people and it has reached the earth band,
        // which are the two conditions the old comment named for taking this
        // file's own advice instead of loosening a bound - and loosening one to
        // today's figure is the move AGENTS.md names outright. The claim is
        // rewritten to what is actually true rather than renegotiated.
        //
        // WHAT IS TRUE: the top of the ladder is placed from the catalog and
        // does not move with the seed. The bottom is a POPULATION, and a
        // population varies - that is what makes it a population. So the bands
        // no living derived person reaches are still asserted exactly, and the
        // two the population does reach are pooled by the test below rather
        // than compared between seeds.
        const first = RUNS[0];
        const FIXED_BY_THE_CATALOG: readonly TechniqueGrade[] = ['heaven', 'immortal', 'chaos'];
        for (const run of RUNS.slice(1)) {
            for (const grade of FIXED_BY_THE_CATALOG) {
                expect(run.by.get(grade) ?? 0, `${run.seed} ${grade} makers differ`)
                    .toBe(first.by.get(grade) ?? 0);
            }
        }
        // And the bands that do vary vary by a POPULATION's worth and not by a
        // ladder's: a seed may not change which rung the supply thins out at.
        // Asserted as a share so it cannot be quietly widened into meaning
        // nothing the way an absolute headcount could.
        for (const run of RUNS.slice(1)) {
            for (const grade of ['mortal', 'earth'] as const) {
                const mine = run.by.get(grade) ?? 0;
                const theirs = first.by.get(grade) ?? 0;
                expect(Math.abs(mine - theirs) / Math.max(1, theirs),
                    `${run.seed} ${grade} makers moved by more than a population's worth`)
                    .toBeLessThan(0.1);
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
