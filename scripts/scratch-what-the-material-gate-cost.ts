/**
 * Scratch. Both arms in one command: how many commissions that the rung gate
 * alone would have agreed to are now refused for want of material.
 *
 * The two arms are the SAME call with and without `materialsToHand`, which is
 * exactly what the gate's "omitted is not empty" contract means - omit it and
 * you get the engine as it behaved before the gate existed. So no stash, no
 * second tree, and no chance of measuring somebody else's uncommitted work.
 *
 * Run: npx tsx scripts/scratch-what-the-material-gate-cost.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { askingSomebodyToMakeYouSomething } from '../src/engine/social-leverage/index.js';
import { whatTheyWereAskedToMake } from '../src/web/what-somebody-was-asked-to-make.js';
import { whatAnIngredientIs } from '../src/engine/cultivation/what-a-cauldron-will-take.js';
import { canRefineGrade } from '../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import type { ObjectRecord } from '../src/engine/world/possessions.js';

const SEEDS = ['gate-cost-1', 'gate-cost-2', 'gate-cost-3'];
const GRADES = ['mortal', 'earth', 'heaven'] as const;

/** What one person is carrying that a recipe could use, one entry per unit. */
function carried(objects: readonly ObjectRecord[], personId: string): string[] {
    const out: string[] = [];
    for (const row of objects) {
        if (row.possessorId !== personId || row.kind !== 'material') continue;
        const id = typeof row.data.materialId === 'string' ? row.data.materialId : null;
        if (id === null || whatAnIngredientIs(id) === null) continue;
        const n = typeof row.data.quantity === 'number' ? row.data.quantity : 1;
        for (let i = 0; i < Math.min(Math.max(1, n), 8); i++) out.push(id);
    }
    return out;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const tally: Record<string, { rungOpen: number; shortNow: number }> = {};
    for (const grade of GRADES) tally[grade] = { rungOpen: 0, shortNow: 0 };
    let makers = 0;
    let carryingAnything = 0;

    for (const seed of SEEDS) {
        const state = seedWorld({ seed, catalog }).state;
        const living = state.npcs.filter(n => n.status === 'alive');
        for (const maker of living) {
            makers++;
            const bench = carried(state.objects, maker.id);
            if (bench.length > 0) carryingAnything++;
            for (const grade of GRADES) {
                if (!canRefineGrade(grade, maker.cultivation.realmOrdinal)) continue;
                const ask = whatTheyWereAskedToMake(`a ${grade} grade talisman`);
                const shared = {
                    ask,
                    askerId: 'the-asker',
                    maker: { id: maker.id, ordinal: maker.cultivation.realmOrdinal },
                    onDay: 0
                };
                // ARM A: the engine before the gate - no bench named at all.
                const before = askingSomebodyToMakeYouSomething(shared);
                // ARM B: the same call, told what is actually within reach.
                const after = askingSomebodyToMakeYouSomething({
                    ...shared, materialsToHand: bench
                });
                if (before.hands.theyCan) tally[grade].rungOpen++;
                if (before.hands.theyCan && !after.hands.theyCan) tally[grade].shortNow++;
            }
        }
    }

    console.log(`seeds: ${SEEDS.join(', ')}`);
    console.log(`makers asked: ${makers}`);
    console.log(`of whom carry ANY material at all: ${carryingAnything}`);
    for (const grade of GRADES) {
        const row = tally[grade];
        const pct = row.rungOpen === 0 ? 0 : Math.round((row.shortNow / row.rungOpen) * 100);
        console.log(
            `  ${grade.padEnd(7)} the rung alone would have allowed ${row.rungOpen}; `
            + `${row.shortNow} of those (${pct}%) are now short of material`
        );
    }
}

main().catch(e => { console.error(e); process.exit(1); });
