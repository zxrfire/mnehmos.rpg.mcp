/**
 * The shape of the population across the nine realms, and the guard against
 * inflating it from the bottom up.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A TEST AND NOT A PROBE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `AMBIENT_QI_RATE_MULTIPLIER` runs 0.5x on thin ground to 4x in a spirit tide.
 * Anything that lifts the floor of that range lifts EVERY cultivator in the
 * world at once, and the damage does not show up where people look for it. The
 * top of the ladder is not made scarce by anything at the top; it is made
 * scarce by how few people get out of the bottom. So a change that "makes the
 * ceiling reachable" by raising the ambient rate does not add a few people at
 * the summit - it moves the whole distribution up, and a world where
 * Tribulation Transcendence is ordinary has lost the only thing that made it
 * worth reaching.
 *
 * The design owner's constraint, in their own words, is that we must not blow
 * the world up with Tribulation Transcendence cultivators. This file is that
 * sentence with numbers in it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BASELINE, MEASURED - AND IT IS A LOG, NOT A CONSTANT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `scripts/probe-the-pyramid.ts`, five seeds at 500 years, share of the
 * living. The 200-year figures this test uses are within a point of these,
 * which is itself worth knowing - the shape is stable over time as well as
 * over seeds.
 *
 * KEEP THE OLD ROWS. Every re-take stays here with what moved it, because the
 * bars below cannot catch what this log is for. See the drift note.
 *
 * Two horizons, because they are not interchangeable and the first two columns
 * are the only pair that is a controlled comparison:
 *
 *                              200y, 2 seeds        200y, 2 seeds     500y, 5 seeds
 *                              WITHOUT root cond.   WITH (current)    WITH (current)
 *     qi_condensation           66.47 .. 67.67      59.88 .. 66.40    59.81 .. 67.98
 *     foundation_establishment  13.25 .. 14.79      14.60 .. 19.37    13.36 .. 17.06
 *     core_formation             7.30 ..  7.63       6.60 ..  8.61     6.85 .. 12.04
 *     nascent_soul               5.02 ..  5.52       6.00 ..  6.65     4.56 ..  7.53
 *     deity_transformation       2.76 ..  3.21       2.15 ..  2.80     2.18 ..  3.69
 *     void_refinement            0.99 ..  1.00       0.98 ..  1.20     0.78 ..  1.38
 *     body_integration           1.38 ..  1.41       1.57 ..  1.60     1.17 ..  1.59
 *     grand_ascension            0.39 ..  0.40       0.39 ..  0.40     0.39 ..  0.40
 *     tribulation_transcendence  0.39 ..  0.40       0.39 ..  0.40     0.39 ..  0.40
 *
 * What separates the first two columns: root conditioning in `5ccbaab`, so a
 * seeded house member's root now follows from the road their house teaches.
 * Measured here back-to-back in one command - `seeding.ts` and `catalog.ts`
 * checked out at `5ccbaab^`, run, restored, run - it is worth -3.93 points of
 * mean Qi Condensation, redistributed upward. Its author measured -2.49 pooled
 * over five seeds at 500 years with the living population unchanged at 2556 vs
 * 2557, so it is redistribution rather than growth, and the mechanism is the
 * obvious one: members who fit their house's road can read its books, so more
 * of them get out of the bottom band.
 *
 * ── AND THE FIRST FIGURES IN THIS FILE WERE CONTAMINATED ─────────────────
 *
 * The baseline originally committed here as the pre-change reading was not one.
 * It was taken off a working tree that already held the root-conditioning edits
 * UNCOMMITTED - `git status` showed `M src/engine/world/seeding.ts` at the time
 * and I noted the file was another agent's and did not think through what that
 * meant for a number I was reading out of it. So the "before" and "after" I
 * would have quoted differed by nothing, because both were after.
 *
 * This is the hazard AGENTS.md states as "a number taken across a gap is
 * worthless while other agents are committing", and the lesson is sharper than
 * the version I had internalised: it is not only about the gap BETWEEN two
 * measurements. A single measurement off a shared tree is already a
 * measurement of somebody else's unfinished work, and it does not announce
 * itself - the figures looked entirely reasonable and sat in a committed test
 * as the authority. The control arm above is the first clean "without" reading
 * this file has ever had.
 *
 * ── THE DRIFT THESE BARS CANNOT CATCH ────────────────────────────────────
 *
 * That change moved Qi Condensation by between two and a half and four points,
 * depending on horizon, and NOTHING here went red - which is correct and is
 * also the hazard. The bars have roughly a factor of two of headroom because
 * they are built to catch a regime change in one step. Four separate changes of
 * that size, each individually reasonable and each individually green, walk Qi
 * Condensation from 67 to 51 and the suite says nothing until the last of them.
 *
 * There is no bar that fixes this. Tightening these until they caught two
 * points would put them red on every content pass, which is the failure the
 * loose bars exist to avoid. What catches drift is the LOG above: re-take the
 * baseline when something lands that plausibly touches the climb, write the new
 * row next to the old one, and say what moved it. A single step is noise; three
 * rows leaning the same way is a finding.
 *
 * As a number to argue with rather than a bar to trip: Qi Condensation below
 * 55, or the share above Void Refinement above 3, is not a red test and IS a
 * conversation to have before the next change lands on top of it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THE THING THE TABLE SAYS THAT NOBODY ASKED IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It is a pyramid up to Void Refinement and a FOSSIL above it. Body Integration
 * (1.57%) is larger than the Void Refinement band beneath it, which a
 * population that flows cannot do, and Grand Ascension and Tribulation
 * Transcendence read 0.39% on every seed and at every horizon - the same
 * handful of people the seeder placed, still standing there, never added to and
 * never replaced. That is the same fact as "nobody arrives above ordinal 32",
 * seen from the population's side instead of from the individual's.
 *
 * Which is why the bars below are ceilings rather than floors above Void
 * Refinement. The upper bands being TOO SMALL is a known, separate, documented
 * defect about transmission - roads reaching people - and the fix for it is not
 * a faster climb for everybody. If a change makes the middle of this table
 * climb, it is the wrong fix even when it does raise the ceiling.
 *
 * The bars are deliberately loose. This is a guard against a regime change, not
 * a pin on a tuning table, and a test that pinned the shares would go red every
 * time somebody added content. Each has roughly a factor of two of headroom.
 */
import { describe, expect, it } from 'vitest';

import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { realmForOrdinal, type RealmKey } from '../../../src/engine/cultivation/realms.js';

const YEARS = 200;
const SEEDS = ['pyr-a', 'pyr-b'] as const;

const catalog = await loadCultivationCatalog();

/** Share of the living standing in each realm, after the world has run. */
function pyramid(seed: string): { share: Record<string, number>; alive: number } {
    const { state } = seedWorld({ seed, catalog });
    const after = advanceWorldYears(state, YEARS).state;
    const counts = new Map<RealmKey, number>();
    let alive = 0;
    for (const npc of after.npcs) {
        if (npc.status !== 'alive') continue;
        alive++;
        const key = realmForOrdinal(npc.cultivation.realmOrdinal).key;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const share: Record<string, number> = {};
    for (const [k, n] of counts) share[k] = (100 * n) / alive;
    return { share, alive };
}

const RUNS = SEEDS.map(s => ({ seed: s, ...pyramid(s) }));

const at = (share: Record<string, number>, ...keys: RealmKey[]): number =>
    keys.reduce((sum, k) => sum + (share[k] ?? 0), 0);

describe('the pyramid holds its shape', () => {
    it('keeps a world in it at all', () => {
        for (const run of RUNS) {
            expect(run.alive, `${run.seed} has no living population`).toBeGreaterThan(100);
        }
    });

    it('keeps the bottom of the ladder the overwhelming majority', () => {
        // Baseline 59.9 - 66.4, against 66.5 - 67.7 before root conditioning,
        // so this band has already absorbed one real change. The floor is what
        // stops an ambient change draining Qi Condensation into the bands above
        // it, which is what "inflating from the bottom up" looks like in one
        // number.
        for (const run of RUNS) {
            expect(
                at(run.share, 'qi_condensation'),
                `${run.seed}: Qi Condensation is ${at(run.share, 'qi_condensation').toFixed(2)}%`
            ).toBeGreaterThan(50);
        }
    });

    it('keeps nine in ten people below Deity Transformation', () => {
        // Baseline 94%. The single most sensitive number to a rate change,
        // because every band above it is fed through these four.
        for (const run of RUNS) {
            const bottom = at(
                run.share,
                'qi_condensation', 'foundation_establishment', 'core_formation', 'nascent_soul'
            );
            expect(bottom, `${run.seed}: below Deity Transformation is ${bottom.toFixed(2)}%`)
                .toBeGreaterThan(85);
        }
    });

    it('does not let the world fill with the last three realms', () => {
        // Baseline 2.35 - 2.40 with root conditioning, 2.17 - 2.21 without.
        // THE owner's constraint, stated as a number.
        // Bodies at Body Integration and above are meant to be countable by a
        // person who cares, not a demographic.
        for (const run of RUNS) {
            const high = at(
                run.share,
                'body_integration', 'grand_ascension', 'tribulation_transcendence', 'immortal'
            );
            expect(high, `${run.seed}: above Void Refinement is ${high.toFixed(2)}%`)
                .toBeLessThan(5);
        }
    });

    it('keeps Tribulation Transcendence a rounding error', () => {
        // Baseline 0.39 - 0.40, i.e. two people in five hundred. A world where
        // this reads several per cent is the failure the whole file exists for.
        for (const run of RUNS) {
            const tt = at(run.share, 'tribulation_transcendence', 'immortal');
            expect(tt, `${run.seed}: Tribulation Transcendence and above is ${tt.toFixed(2)}%`)
                .toBeLessThan(1.5);
        }
    });

    it('never puts a realm above Core Formation ahead of Core Formation itself', () => {
        // The pyramid has to stay a pyramid where it is still flowing. Above
        // Void Refinement it demonstrably is not - see the header - so this
        // asks the question only of the bands that are still a population.
        for (const run of RUNS) {
            const core = at(run.share, 'core_formation');
            for (const k of ['nascent_soul', 'deity_transformation', 'void_refinement'] as RealmKey[]) {
                expect(
                    at(run.share, k),
                    `${run.seed}: ${k} is ${at(run.share, k).toFixed(2)}% against Core Formation ${core.toFixed(2)}%`
                ).toBeLessThanOrEqual(core);
            }
        }
    });
});
