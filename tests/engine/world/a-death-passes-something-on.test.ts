/**
 * Every death settles, including the two that did not.
 *
 * `markDead` stops a heart. `settleNpcDeath` is what passes the goals and the
 * accounts down to whoever is left - a grudge thins by a generation and does not
 * go away, which is most of what makes this world's history feel owned by
 * somebody.
 *
 * Two death sites called the first and not the second, and they were the two
 * highest-ordinal ways to die in the world: at a WALL, and at the LAST CROSSING.
 * So the deaths most likely to leave heirs and accounts worth inheriting were
 * exactly the deaths that left nothing. A grudge that took a century to earn
 * ended with the person holding it.
 *
 * Rates over lived worlds. No seed is pinned to a count.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RATE TEST WAS MEASURING SURVIVAL AND CALLING IT INHERITANCE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Rewritten when `theWorldForgetsTheMortalDead` landed, which deletes a mortal
 * who died and the memory of them with it. The last test in this file read
 * `inheritedTies / theDead` and wanted more than 0.5; it came back 0.414, and
 * the reason turned out to be two separate defects in how it was finding its
 * number rather than anything about the world.
 *
 * **MISSING IS NOT DEAD, AND IT WAS 40% OF THE DENOMINATOR.** `theDead` asked
 * `status !== 'alive'`, which `isUnadjudicated` says outright is wrong:
 * `missing` and `unknown` are the states in which the engine *does not know
 * what happened*. Somebody who walked into the hills has not died, never
 * settles, and can never pass anything on, so every one of them was a
 * guaranteed miss in the denominator. Measured on `pass-a` at 200 years: 362
 * rows not alive, of which **143 are missing and 219 are actually dead**. The
 * sweep did not create this - it exposed it, by removing the 800-odd dead
 * mortals the missing had been hiding behind. Ask the right question and the
 * original claim holds, at the original figure:
 *
 *     ties / rows not alive    0.414   0.368   0.452      (what it asked)
 *     ties / rows actually dead 0.685   0.531   0.698      (pass-a, -b, -c)
 *
 * **AND THE RATIO IS A SURVIVAL FIGURE, NOT A RATE.** Whatever the
 * denominator, counting ties still standing at the end of two centuries
 * measures how much inheritance SURVIVED, not how much happened - an heir who
 * dies, is forgotten, or is overwritten takes their inherited tie out of the
 * count. Caught at the moment of death instead, where nothing downstream can
 * move it, the real figure is six times larger:
 *
 *     ties passed per settled death   2.52 (pass-a)   2.40 (pass-b)
 *       of a person the world keeps   1.87            1.59
 *       of a person it forgets        2.67            2.57
 *
 * So the file now asserts both, and they are different claims: the RATE says
 * inheritance is proportionate to dying, and the SURVIVAL ratio is what would
 * fall if a high-ordinal death path stopped settling - which is the regression
 * this file exists for, and those deaths are exactly the rows the sweep keeps.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import type { WorldState } from '../../../src/engine/world/world-state';

/**
 * The height at which a death stops being a nothingburger.
 *
 * The design owner's line all evening: a low ordinal cultivator dying is
 * nothing, a patriarch or a empyrean court seat dying is earth shaking. 29 is
 * where the bands the world reads as senior begin.
 */
const A_DEATH_THAT_SHOULD_LEAVE_SOMETHING = 29;

const SEEDS = ['pass-a', 'pass-b'];
const YEARS = 200;

/** What one lived world left, and what it passed on while it was living. */
interface Lived {
    state: WorldState;
    /** Deaths that reached `settleNpcDeath`. */
    settled: number;
    /** Accounts written onto a primary heir, counted as each death happened. */
    tiesPassed: number;
    /** Deaths at or above `A_DEATH_THAT_SHOULD_LEAVE_SOMETHING`. */
    tall: number;
    /** Of those, the ones that resolved with nobody to inherit. */
    tallWithNobody: number;
}

let cached: Lived[] | null = null;

async function worldsLived(): Promise<Lived[]> {
    if (cached) return cached;
    const catalog = await loadCultivationCatalog();
    cached = SEEDS.map(seed => {
        const { state } = seedWorld({ seed, catalog });
        let settled = 0;
        let tiesPassed = 0;
        let tall = 0;
        let tallWithNobody = 0;
        advanceWorldForPlay(state, {
            days: YEARS * 365,
            stopOnInterrupt: false,
            // AT THE DEATH, not at the end. `onDeath` fires once per death with
            // the heirs and goals already resolved, so the heir's rows carry
            // whatever this death just handed them and nothing later - a
            // forgetting, a re-inheritance, the heir's own death - can move it.
            onDeath: handoff => {
                settled++;
                const who = state.npcs.find(npc => npc.id === handoff.deceasedId);
                if ((who?.cultivation.realmOrdinal ?? 0) >= A_DEATH_THAT_SHOULD_LEAVE_SOMETHING) {
                    tall++;
                    if (handoff.primaryHeirId === null) tallWithNobody++;
                }
                // ── COUNTED ON EVERY HEIR, NOT ON THE FIRST ──────────────
                //
                // This asked the PRIMARY heir what it had just received, which
                // was the whole estate while `settleNpcDeath` handed everything
                // to `heirs[0]`. That was a constant index rather than a choice
                // and it is now a deal: the senior claim takes the weightiest
                // account and the rest go round the other heirs.
                //
                // So the primary's share fell and the estate did not. Measured
                // across both seeds: ties per death on the primary went 0.92 to
                // 0.76, while the total inherited held - 293 and 198 became 259
                // and 274, with carriers rising 71 and 47 to 83 and 83. The
                // number moved because the world got better, and an assertion
                // counting only the first heir was measuring a thing the world
                // had deliberately stopped doing.
                for (const npc of state.npcs) {
                    tiesPassed += npc.relationships
                        .filter(tie => tie.inheritedFromId === handoff.deceasedId).length;
                }
            }
        });
        return { state, settled, tiesPassed, tall, tallWithNobody };
    });
    return cached;
}

function inheritedTies(state: WorldState): number {
    let n = 0;
    for (const npc of state.npcs) {
        for (const tie of npc.relationships) if (tie.inheritedFromId) n++;
    }
    return n;
}

function inheritedGoals(state: WorldState): number {
    let n = 0;
    for (const npc of state.npcs) {
        for (const goal of npc.goals) {
            if ((goal as { inheritedFromId?: string | null }).inheritedFromId) n++;
        }
    }
    return n;
}

/**
 * People who died, and not people the world cannot account for.
 *
 * `status !== 'alive'` is the wrong question and was 40% wrong here - see the
 * header. It is also the predicate `a-dead-npc-leaves-their-things-somewhere.ts`
 * had to correct for the same reason: 74 of the rows it first flagged as
 * corpses still holding their purse were people who went into the hills.
 */
function theDead(state: WorldState): number {
    return state.npcs.filter(n => n.status === 'physically_dead').length;
}

describe('what a death leaves behind', () => {
    it('leaves something, over any span long enough to have deaths in it', async () => {
        for (const { state } of await worldsLived()) {
            expect(theDead(state)).toBeGreaterThan(0);
            expect(inheritedTies(state)).toBeGreaterThan(0);
            expect(inheritedGoals(state)).toBeGreaterThan(0);
        }
    });

    it('and an inherited account names who it came from', async () => {
        for (const { state } of await worldsLived()) {
            const byId = new Map(state.npcs.map(n => [n.id, n]));
            for (const npc of state.npcs) {
                for (const tie of npc.relationships) {
                    if (!tie.inheritedFromId) continue;
                    // The person it came from is somebody the world held, and
                    // they are not the person now holding it.
                    expect(tie.inheritedFromId).not.toBe(npc.id);
                    // AND THEY ARE STILL A ROW. This used to be written as an
                    // `||` with `length > 0` on the other side, which is true of
                    // every id there has ever been, so it asserted nothing. It
                    // can be asked properly now: `theWorldForgetsTheMortalDead`
                    // nulls this field when the person it names is forgotten,
                    // precisely so that an id here is always answerable. A
                    // dangling one is the sweep having missed a table.
                    expect(
                        byId.has(tie.inheritedFromId),
                        `${npc.id} holds an account inherited from `
                        + `${tie.inheritedFromId}, who is not in the world`
                    ).toBe(true);
                }
            }
        }
    });

    it('never hands somebody an account against themselves', async () => {
        for (const { state } of await worldsLived()) {
            for (const npc of state.npcs) {
                for (const tie of npc.relationships) {
                    expect(tie.targetId).not.toBe(npc.id);
                }
            }
        }
    });

    /**
     * THE RATE, caught at the death. See the header for why this is not the
     * ratio that used to be here.
     *
     * Pooled over the seeds rather than asserted on each, because the claim is
     * about deaths and not about a world. Measured: 2,666 accounts over 1,058
     * deaths and 2,576 over 1,075, so 2.52 and 2.40 per death. Floored at 1 -
     * an account moving on every death is still an order of magnitude above a
     * trickle, and leaves room for the heir rules to be tightened without this
     * failing for it.
     */
    /**
     * THE ONE DEATH THAT MUST LEAVE SOMETHING, AND WHY THE OTHER 60% NEED NOT.
     *
     * Two in five deaths resolve with nobody to inherit, and that figure is
     * correct. Measured over 200 years on `pass-a`, the deaths that found no
     * heir split three ways and each way is the world working:
     *
     *   ~35%  in no lineage at all - the unbound, who are invisible among the
     *         living and over-represented among the dead
     *   ~30%  in a lineage with no heir-kind edge: 208 of 249 died between 100
     *         and 200 years old, 248 of 249 below ordinal 20, NOT ONE at 29 or
     *         above. Somebody's junior who died before they became anybody, and
     *         the genre agrees they leave nothing
     *   ~36%  edges existed and returned nobody - and 282 of those were people
     *         who died as somebody's CHILD, which `heirsOf` answers correctly
     *         because an estate descends
     *
     * SO DO NOT TUNE THE 40%. A target of 18-22% carriers was set against it
     * and then abandoned, because a number somebody invented does not outrank a
     * mechanism that is behaving. What is asserted here instead is the rule the
     * rate is a consequence of, and it is the only thing in that chain nothing
     * else guarantees: a death high enough to matter must find somebody.
     *
     * A nobody dying and leaving nothing is the world working. A Seat dying
     * with no successor is not.
     */
    it('lets nobodies die empty-handed, and never the people who matter', async () => {
        const lived = await worldsLived();
        const tall = lived.reduce((n, w) => n + w.tall, 0);
        const empty = lived.reduce((n, w) => n + w.tallWithNobody, 0);

        // FLOOR THE POPULATION FIRST. Without this the assertion passes
        // vacuously on a world where nobody senior died, which is the
        // inert-selection defect wearing a test's clothes: green because
        // nothing happened rather than because the rule held.
        expect(
            tall,
            'two centuries of world had no deaths at or above ordinal '
            + `${A_DEATH_THAT_SHOULD_LEAVE_SOMETHING}, so this asserts nothing`
        ).toBeGreaterThan(0);

        expect(
            empty,
            `${empty} of ${tall} deaths at or above ordinal `
            + `${A_DEATH_THAT_SHOULD_LEAVE_SOMETHING} found nobody to inherit`
        ).toBe(0);
    });

    it('and inherits at a rate that is a fact about deaths, not a trickle', async () => {
        const lived = await worldsLived();
        const settled = lived.reduce((n, w) => n + w.settled, 0);
        const passed = lived.reduce((n, w) => n + w.tiesPassed, 0);

        expect(settled, 'two centuries of world had deaths in it').toBeGreaterThan(100);
        expect(
            passed / settled,
            `${passed} accounts passed over ${settled} deaths; measured at 2.52 and 2.40`
        ).toBeGreaterThan(1);
    });

    /**
     * AND WHAT IS STILL STANDING AT THE END, which is the regression this file
     * was written for.
     *
     * The two sites that stopped settling were a WALL and the LAST CROSSING -
     * both high-ordinal deaths, and therefore both rows the world keeps. So this
     * ratio is now better aimed than when it was pooled over everybody: if a
     * death path of that kind stops settling, the dead rows keep arriving and
     * the accounts do not.
     *
     * Measured over three worlds at 200 years: 0.685, 0.531, 0.698, pooled
     * 0.609. The floor sits below the lowest world rather than below the pooled
     * figure, so one unlucky world does not fail it - and a death path that has
     * stopped settling does not produce 0.4, it produces something near zero.
     */
    it('and the deaths the world still holds are deaths that settled', async () => {
        const lived = await worldsLived();
        const dead = lived.reduce((n, w) => n + theDead(w.state), 0);
        const ties = lived.reduce((n, w) => n + inheritedTies(w.state), 0);

        expect(dead).toBeGreaterThan(0);
        expect(
            ties / dead,
            `${ties} accounts still standing against ${dead} dead; measured pooled at 0.609`
        ).toBeGreaterThan(0.4);
    });
});
