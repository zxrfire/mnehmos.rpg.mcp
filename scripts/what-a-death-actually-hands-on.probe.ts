/**
 * WHAT A DEATH ACTUALLY HANDS ON, AND TO HOW MANY.
 *
 * `a-death-passes-something-on.test.ts` floors one ratio: accounts passed over
 * deaths settled, measured at 2.52 and 2.40 per death when it was written, and
 * reading 0.92 on 23 September. **That ratio cannot say why it moved**, and a
 * number that cannot name its own cause is not worth a run.
 *
 * Its numerator counts ties written onto the PRIMARY HEIR ONLY, at the death.
 * So a death whose estate scatters across three people contributes the first
 * one's rows and nothing else, and the ratio falls identically whether:
 *
 *   ESTATES MOVE LESS      deaths hand on fewer accounts than they used to, or
 *   HEIRS ARE FOUND LESS   the estates are intact and fewer deaths resolve to a
 *                          primary heir at all.
 *
 * Those are different findings with different owners, and the ratio conflates
 * them. This measures the two numbers that separate them:
 *
 *   heirFound / settled    the share of resolved deaths that found a primary
 *                          heir - the handoff's reach
 *   tiesAll / settled      accounts inherited across EVERY heir rather than the
 *                          first - what the estate actually moved
 *
 * If the reach fell while `tiesAll` held, the handoff is narrowing and the
 * estates are fine. If both fell, estates are moving less. Either is a finding;
 * the ratio alone was neither.
 *
 * ── THE SHAPE THIS IS AN INSTANCE OF ─────────────────────────────────────
 *
 * A total that cannot say TO HOW MANY is a number with a hypothesis hidden
 * inside it. The vein count said 120 and hid *one edge*; this numerator says
 * *ties passed* and hides *to the first heir only*. In both cases the aggregate
 * was not merely incomplete - it was confidently answering a question nobody had
 * asked. See `AGENTS.md`, *How often, and on whom*.
 *
 * ── IT MIRRORS THE TEST'S HARNESS ON PURPOSE ─────────────────────────────
 *
 * Same seeds, same span, same hook. A probe that measures a slightly different
 * world cannot be compared with the assertion it is diagnosing, and comparing it
 * anyway is how a harness artefact becomes a finding. If the test's SEEDS or
 * YEARS change, change them here and say so.
 *
 *     npx vitest run --config vitest.probe.config.ts scripts/what-a-death-actually-hands-on.probe.ts
 *
 * Name the file: that config's include is the whole of `scripts`.
 */

import { describe, it } from 'vitest';

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

/** Mirrors `a-death-passes-something-on.test.ts`. */
const SEEDS = ['pass-a', 'pass-b'];
const YEARS = 200;

describe('what a death hands on', () => {
    it('separates the estate from the heir', async () => {
        const catalog = await loadCultivationCatalog();
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            let settled = 0;
            let heirFound = 0;
            let tiesPrimary = 0;
            let tiesAll = 0;

            advanceWorldForPlay(state, {
                days: YEARS * 365,
                stopOnInterrupt: false,
                onDeath: handoff => {
                    settled++;
                    // EVERY heir, not the first. `inheritedFromId` is written on
                    // whoever received the row, so the estate is counted wherever
                    // it landed rather than only where the test looks.
                    for (const npc of state.npcs) {
                        const from = npc.relationships.filter(
                            tie => tie.inheritedFromId === handoff.deceasedId
                        ).length;
                        if (from === 0) continue;
                        tiesAll += from;
                        if (npc.id === handoff.primaryHeirId) tiesPrimary += from;
                    }
                    if (handoff.primaryHeirId !== null) heirFound++;
                }
            });

            const per = (n: number) => (settled > 0 ? (n / settled).toFixed(3) : 'n/a');
            // eslint-disable-next-line no-console
            console.log(
                `${seed}: settled ${settled}, heirFound ${heirFound} (${per(heirFound)} per death), `
                + `tiesPrimary ${tiesPrimary} (${per(tiesPrimary)}), tiesAll ${tiesAll} (${per(tiesAll)})`
            );
        }
        // eslint-disable-next-line no-console
        console.log(
            '\ntiesPrimary per death is the figure the test floors at 1.'
            + '\nRead it beside heirFound per death: a fall in one and not the other is the'
            + '\nhandoff narrowing; a fall in both is estates moving less.'
        );
    }, 6 * 60 * 60_000);
});
