/**
 * What the top of the craft ladder is made of, and where a world keeps it.
 *
 * Four questions off the same worlds:
 *
 *   the bill          every ingredient the immortal and chaos formulas name,
 *                     and how anybody comes by it today.
 *   the ground        sealed pocket ground per world, by kind and by how deep
 *                     it was calibrated - which is what decides whether it can
 *                     hold anything at this height.
 *   the stands        what `seedWhatSealedPocketsStillGrow` actually put in.
 *   can one be filled whether a world's whole standing stock fills any one
 *                     formula, which is the scarcity claim stated as a number.
 *
 *   npx esbuild scripts/probe-what-is-standing-in-the-sealed-ground.ts \
 *       --bundle --platform=node --format=esm --external:better-sqlite3 \
 *       --outfile=probe.mjs && node probe.mjs
 *
 * SEEDS overrides the default six.
 */

import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import { aSealHereMeansAnUndrawnPocket } from '../src/engine/world/locations.js';
import {
    A_STAND_IN_SEALED_GROUND,
    WHAT_THE_TOP_OF_THE_LADDER_NEEDS,
    aPocketWorthSixCenturies,
    isAnUndrawnPocket
} from '../src/engine/world/what-a-sealed-pocket-still-grows.js';
import { RECIPES } from '../src/data/cultivation/recipes.js';
import { getPill } from '../src/data/cultivation/pills.js';
import { getHerb, isExtinct } from '../src/data/cultivation/herbs.js';
import { theHeightAHouseWorksAt } from '../src/engine/world/where-the-pills-actually-are.js';
import type { WorldState } from '../src/engine/world/world-state.js';

function line(s = ''): void { process.stdout.write(s + '\n'); }

/** Every recipe the lower realm cannot supply, with its bill. */
function topFormulas(): { id: string; name: string; grade: string; bill: string }[] {
    return RECIPES.flatMap(r => {
        const grade = getPill(r.producesPillId)?.grade;
        if (grade !== 'immortal' && grade !== 'chaos') return [];
        const bill = r.ingredients.map(i => {
            const h = getHerb(i.itemId);
            return h
                ? `${h.name} x${i.quantity} [${h.grade} ${h.biome} @${h.harvestOrdinal}`
                  + `${isExtinct(h.id) ? ' EXTINCT' : ''}]`
                : `${i.itemId} x${i.quantity} [NOT A HERB]`;
        }).join(', ');
        return [{ id: r.id, name: r.name, grade, bill }];
    });
}

function stands(state: WorldState): { herbId: string; at: string }[] {
    return state.objects
        .filter(o => o.tags.includes(A_STAND_IN_SEALED_GROUND))
        .map(o => ({ herbId: String(o.data.materialId), at: String(o.locationId) }));
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeds = (process.env.SEEDS ?? 'alpha,bravo,charlie,delta,echo,foxtrot').split(',');

    line('THE BILL - every formula the lower realm cannot supply');
    for (const f of topFormulas()) line(`  ${f.grade.padEnd(8)} ${f.name}\n      ${f.bill}`);
    line();
    line(`WHAT A SEALED POCKET CAN HOLD (${WHAT_THE_TOP_OF_THE_LADDER_NEEDS.length} rows, `
        + 'derived off the bill)');
    for (const h of WHAT_THE_TOP_OF_THE_LADDER_NEEDS) {
        line(`  ${h.grade.padEnd(8)} ${h.name.padEnd(36)} ${h.biome.padEnd(12)} `
            + `needs ordinal ${h.harvestOrdinal}`);
    }
    line();

    let pockets = 0, deepEnough = 0, totalStands = 0, ms = 0;
    const perHerb = new Map<string, number>();
    let worldsThatFillOne = 0;

    for (const seed of seeds) {
        const t0 = Date.now();
        const state = seedWorld({ seed, catalog, presentYear: 1000, population: 250 }).state;
        ms += Date.now() - t0;

        const sealed = state.locations.filter(l => aSealHereMeansAnUndrawnPocket(l.kind));
        const undrawn = sealed.filter(isAnUndrawnPocket);
        const deep = undrawn.filter(aPocketWorthSixCenturies);
        pockets += undrawn.length;
        deepEnough += deep.length;

        const held = stands(state);
        totalStands += held.length;
        const count = new Map<string, number>();
        for (const s of held) {
            count.set(s.herbId, (count.get(s.herbId) ?? 0) + 1);
            perHerb.set(s.herbId, (perHerb.get(s.herbId) ?? 0) + 1);
        }

        // Could the whole world's standing stock fill one formula, ignoring
        // every other obstacle - the rung, the door, the road, the odds?
        const fillable = topFormulas().filter(f => {
            const recipe = RECIPES.find(r => r.id === f.id)!;
            return recipe.ingredients.every(i => {
                const h = getHerb(i.itemId);
                if (!h) return false;
                if (isExtinct(h.id)) return false;
                // Anything below the immortal band is got the ordinary way.
                if (h.grade !== 'immortal' && h.grade !== 'chaos') return true;
                return (count.get(h.id) ?? 0) >= i.quantity;
            });
        });
        if (fillable.length > 0) worldsThatFillOne++;

        const houses = state.factions.filter(f => f.dissolvedOnDay === null);
        const tallest = houses.reduce((t, h) => Math.max(t, theHeightAHouseWorksAt(h)), 0);

        line(`SEED ${seed}  undrawn pockets ${undrawn.length} of ${sealed.length} sealed `
            + `| worth six centuries ${deep.length} `
            + `| stands ${held.length}`);
        line(`  ${[...count].sort().map(([id, n]) => `${getHerb(id)?.name ?? id} x${n}`).join(', ')
            || '(nothing)'}`);
        line(`  pockets holding one: ${deep.map(l =>
            `${l.kind}/qi${l.qiDensity}/hoard${Number(l.data.techniqueCount ?? 0)
                + Number(l.data.treasureCount ?? 0)}/entry${l.thresholds.entry}`
            + `/surv${l.thresholds.survival}/mast${l.thresholds.mastery}`
            + `${l.cycle ? '/season' : '/shut'}`).sort().join(' ')}`);
        line(`  tallest house works at ${tallest}  `
            + `| formulas this world's whole stock could fill: `
            + `${fillable.map(f => f.name).join(', ') || 'none'}`);
    }

    line();
    line('POOLED');
    line(`  worlds ${seeds.length}  undrawn pockets ${pockets} = `
        + `${(pockets / seeds.length).toFixed(1)} per world`);
    line(`  of those, worth six centuries: ${deepEnough} = `
        + `${(deepEnough / seeds.length).toFixed(1)} per world `
        + `(${(deepEnough / Math.max(1, pockets) * 100).toFixed(1)}%)`);
    line(`  stands seeded ${totalStands} = ${(totalStands / seeds.length).toFixed(1)} per world`);
    line(`  by material ${[...perHerb].sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `${getHerb(id)?.name ?? id} ${n}`).join('  ') || '(nothing)'}`);
    line(`  worlds whose whole standing stock fills any one formula: `
        + `${worldsThatFillOne}/${seeds.length}`);
    line(`  seeding ${(ms / seeds.length).toFixed(0)} ms per world (one pass, never per year)`);
}

void main();
