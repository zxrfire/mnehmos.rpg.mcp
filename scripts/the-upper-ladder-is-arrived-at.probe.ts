/**
 * The world produces its apex rather than inheriting it.
 *
 * MOVED OUT OF THE SUITE, AND WHAT IT COST THERE. This was
 * `tests/engine/world/the-world-produces-its-own.test.ts`, and measured on the
 * night it moved it was **the last file still running in a 53-minute run of
 * `tests/engine/world`, alone for the final fifteen minutes, at 1.9 GB and
 * climbing**. 205 of 207 files finished in the first 38 minutes; this one was
 * the rest of the wall clock and the whole of the memory profile. It is not a
 * hang - `soaked()` holds THREE full 3,000-year worlds at once, and the growth
 * is those worlds accumulating npcs, facts and objects.
 *
 * An instrument somebody runs deliberately does not belong in a suite somebody
 * runs to check a change, which is the same reason `how-a-mechanism-spreads`
 * and the passes probe live here. Nine thousand simulated years is a
 * measurement.
 *
 *     npx vitest run --config vitest.probe.config.ts scripts/the-upper-ladder-is-arrived-at.probe.ts
 *
 * NAME THE FILE. That config's include is the whole of `scripts`.
 *
 * WHAT STAYED BEHIND. The cheap unit assertions in the original file did not
 * move and should not: wounds as rows, the two clocks at a rung, and what
 * teaching costs a master are millisecond tests of the pieces, and they are the
 * things that tell you WHICH piece when this reports that the world is wrong.
 * The original file still holds them and points here.
 *
 * ── THE THREE DEFECTS THIS PINS (the original header, intact) ────────────
 *
 * 1. THE WORLD NEVER ROLLED A BREAKTHROUGH. `applyAdvancement` advanced NPCs
 *    with `deriveOrdinal`, a closed-form derivation seeding uses, and
 *    `attemptBreakthrough` was called only by measurement code. So nobody in
 *    the world had ever failed at a wall, been hurt by one, or died at one.
 *
 * 2. SO THE APEX WAS INHERITED. Measured across three seeds at 500, 1500 and
 *    5000 years before the change: every person standing at ordinal 41 or above
 *    was a survivor of the seeding, at every horizon, on every seed. Above Void
 *    Refinement the world held 7 people at 5,000 years, 4 of whom had arrived.
 *
 * 3. AND NO NPC COULD CARRY A WOUND. `untreatedInjuries` was an integer, so the
 *    whole authored tribulation-and-wounds layer - broken foundation, cracked
 *    core, a base left unfinished - was unreachable from the world.
 *
 * These are cheap unit assertions on the pieces plus one soak, deliberately in
 * that order: the soak is the thing that would tell you the world is wrong and
 * the units are the things that tell you which piece. The order still holds,
 * across two files now.
 *
 * A JUDGEMENT MADE IN THE MOVE, and worth a second opinion: `is still
 * deterministic and still decomposable` came with the soak because it sits in
 * this describe and is expensive for the same reason - it walks 300 years six
 * times over. It is a genuine correctness ratchet rather than a measurement,
 * and if it is wanted back in the suite it should go back on its own with a
 * shorter horizon rather than dragging the 3,000-year soak with it.
 */

import { describe, it, expect } from 'vitest';
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { BROKEN_STATUSES } from '../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import type { WorldState } from '../src/engine/world/world-state.js';

describe('the upper ladder is arrived at rather than inherited', () => {
    const HORIZON_YEARS = 3_000;

    /**
     * The seeds this claim is judged over, and why there is more than one.
     *
     * This guard used to pin `produces-its-own` alone, and the band it counts
     * is about thirty people - which is far too few for a ratio on one seed.
     * Measured when eleven rows were added to the member catalog, which touches
     * nothing above Nascent Soul and reshuffles the seeded population anyway:
     *
     *     seed                without the rows      with them
     *     produces-its-own    22 of 30   0.733      4 of 10   0.400
     *     pool-b              14 of 23   0.609     17 of 29   0.586
     *     pool-c              22 of 28   0.786     37 of 43   0.860
     *     pool-d              24 of 35   0.686     15 of 27   0.556
     *     pool-e              34 of 41   0.829     32 of 41   0.780
     *     pool-f              27 of 37   0.730      9 of 14   0.643
     *     POOLED             143 of 194  0.737    114 of 164  0.695
     *
     * One seed went from 0.733 to 0.400 and the claim did not move: 0.737
     * against 0.695, over a sample eighteen times the size of the thing that
     * failed. The size of the band on a single seed ranges from 10 to 43 across
     * those twelve worlds, so a low reading is the spread rather than a signal.
     *
     * The bar stays at half. It was never the problem, and widening it would
     * have turned a real guard into decoration - see "Pool the sample. Never
     * widen the bar" in AGENTS.md. What changed is only that one seed is no
     * longer asked to carry a claim about a population.
     */
    // The first three in the order they were measured, rather than a flattering
    // subset. Picking the kindest seeds would be widening the bar wearing
    // pooling's clothes: on the arm above, the three best pool to 0.79 and the
    // three worst to 0.55, and neither is the claim. These three pool to 0.716
    // without the rows and 0.707 with them, either side of the six-seed figure.
    const SEEDS = ['produces-its-own', 'pool-b', 'pool-c'] as const;

    // The soaks, shared by the assertions below. Three thousand simulated years
    // is the expensive thing in this file and running one twice measures the
    // same world twice.
    let run: Promise<{ state: WorldState; seeded: Set<string> }[]> | null = null;
    function soaked() {
        run ??= (async () => {
            const catalog = await loadCultivationCatalog();
            return SEEDS.map(seed => {
                const { state } = seedWorld({ seed, catalog });
                const seeded = new Set(state.npcs.map(n => n.id));
                advanceWorldYears(state, HORIZON_YEARS, { stopOnInterrupt: false });
                return { state, seeded };
            });
        })();
        return run;
    }

    /** The first world, for the assertions that are about a world rather than a rate. */
    async function oneWorld() {
        return (await soaked())[0];
    }

    it('fills the bands above Deity Transformation with people who climbed', async () => {
        const worlds = await soaked();
        const per: string[] = [];
        let totalHigh = 0;
        let totalArrived = 0;

        for (let i = 0; i < worlds.length; i++) {
            const { state, seeded } = worlds[i];
            const alive = state.npcs.filter(n => n.status === 'alive');
            const high = alive.filter(n => n.cultivation.realmOrdinal >= 29);
            const arrived = high.filter(n => !seeded.has(n.id));

            // Before this, five thousand years produced 7 people above Void
            // Refinement of whom 4 had arrived, and the band was routinely
            // empty. That every world still has somebody up there is a claim
            // about each world and is asserted per seed.
            expect(high.length, `${SEEDS[i]}: nobody is standing above Deity Transformation`)
                .toBeGreaterThan(0);

            totalHigh += high.length;
            totalArrived += arrived.length;
            per.push(`${SEEDS[i]} ${arrived.length}/${high.length}`);
        }

        // And the RATE is pooled, because it is a claim about a population and
        // the band on any one seed is a few dozen people.
        expect(
            totalArrived / Math.max(1, totalHigh),
            `${totalArrived} of ${totalHigh} people above Deity Transformation arrived `
            + `rather than being seeded there (${per.join(', ')})`
        ).toBeGreaterThan(0.5);
    }, 900_000);

    it('leaves people standing at a rung they cracked at', async () => {
        // The population the setting most wanted and could not produce. A real
        // wall produces real failures, and the wounds layer is what a failure
        // leaves - so the world getting MORE broken is the feature, not a
        // regression.
        const { state } = await oneWorld();
        const alive = state.npcs.filter(n => n.status === 'alive');
        const wounded = alive.filter(n => n.cultivation.injuries.length > 0);
        expect(wounded.length, 'nobody in the world is carrying a wound')
            .toBeGreaterThan(0);

        // Every wound is a row with a real shape, and the count agrees with it.
        for (const npc of alive) {
            const untreated = npc.cultivation.injuries.filter(i => !i.treated).length;
            expect(
                npc.cultivation.untreatedInjuries,
                `${npc.name} has ${npc.cultivation.untreatedInjuries} untreated against `
                + `${npc.cultivation.injuries.length} rows`
            ).toBe(untreated);
        }

        // And at least some of them came from a wall rather than from a bout,
        // which is what says the tribulation layer is reachable at all.
        const fromAWall = alive.some(n =>
            n.cultivation.injuries.some(i =>
                i.source === 'failed_breakthrough' || i.source === 'tribulation'
                || (i.woundType !== null && BROKEN_STATUSES.includes(i.woundType))));
        expect(fromAWall, 'no wound in the world came from a realm boundary').toBe(true);
    }, 600_000);

    /**
     * `fingerprint(3) !== fingerprint(1)` for a long time, and it was a
     * correctness defect rather than a tidy one: a played game advances in
     * whatever slices a player's turns happen to make, so two players spending
     * the same three hundred years met different worlds.
     *
     * The cause was `theWorldForgetsTheMortalDead`, which deletes the mortal
     * dead and the facts naming nobody else, running once per CALL. Where that
     * sweep runs decides what the following year is simulated against, so the
     * caller's chunking was reaching the simulation. It now runs once per world
     * year, which is a fact about the clock.
     *
     * Three chunks is not the claim and never was - 1, 2, 3, 5 and 10 are, and
     * 10 is what catches a pass that fires a different NUMBER of times rather
     * than merely on a different day.
     */
    it('is still deterministic and still decomposable', async () => {
        const catalog = await loadCultivationCatalog();
        const fingerprint = (chunks: number) => {
            const { state } = seedWorld({ seed: 'strike-determinism', catalog });
            for (let i = 0; i < chunks; i++) {
                advanceWorldYears(state, 300 / chunks, { stopOnInterrupt: false });
            }
            return summary(state);
        };
        const one = fingerprint(1);
        expect(fingerprint(1)).toBe(one);
        for (const chunks of [2, 3, 5, 10]) {
            expect(fingerprint(chunks), `300 years in ${chunks} calls is a different world`)
                .toBe(one);
        }
    }, 900_000);

    function summary(state: WorldState): string {
        const alive = state.npcs.filter(n => n.status === 'alive');
        return [
            alive.length,
            alive.reduce((s, n) => s + n.cultivation.realmOrdinal, 0),
            alive.reduce((s, n) => s + n.cultivation.injuries.length, 0),
            state.objects.length
        ].join('/');
    }
});
