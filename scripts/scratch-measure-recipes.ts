/**
 * Scratch. How generous the recipes are, and whether anybody holds the stuff.
 * Run: npx tsx scripts/scratch-measure-recipes.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import {
    WHAT_AN_ARTIFACT_IS_MADE_OF,
    theBenchIsReady,
    whatWouldFill
} from '../src/data/cultivation/what-an-artifact-is-made-of.js';
import { whatThisHouseHolds } from '../src/engine/world/what-a-house-keeps-in-its-treasury.js';
import { ARTIFACTS } from '../src/data/cultivation/artifacts.js';
import { sectThreat } from '../src/data/cultivation/sects.js';
import { refiningOrdinalFor } from '../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';

const line = (s = '') => console.log(s);

async function main(): Promise<void> {
    line('=== SLOT BREADTH ===');
    for (const grade of ['earth', 'heaven'] as const) {
        line(`${grade}: ${WHAT_AN_ARTIFACT_IS_MADE_OF[grade].length} slots`);
        for (const slot of WHAT_AN_ARTIFACT_IS_MADE_OF[grade]) {
            const fills = whatWouldFill(slot);
            const grown = fills.filter(r => r.from === 'a_growing_thing').length;
            line(`   ${fills.length} fill "${slot.what}"  (${grown} grown, ${fills.length - grown} taken)`);
        }
    }

    const catalog = await loadCultivationCatalog();
    const state = seedWorld({ seed: 'recipe-measure', catalog }).state;

    line();
    line('=== WHAT HOUSES HOLD ===');
    const houses = state.factions.filter(f => f.dissolvedOnDay === null);
    let anyMaterial = 0;
    const complete = { earth: 0, heaven: 0 };
    const ceilingCount = { mortal: 0, earth: 0, heaven: 0 };
    for (const house of houses) {
        const acting = sectThreat(house.id)?.acting ?? 0;
        const ceiling = acting >= refiningOrdinalFor('heaven')
            ? 'heaven' : acting >= refiningOrdinalFor('earth') ? 'earth' : 'mortal';
        ceilingCount[ceiling]++;
        const held = whatThisHouseHolds(state.objects, house.id)
            .filter(o => o.kind === 'material')
            .map(o => String(o.data.materialId));
        if (held.length > 0) anyMaterial++;
        if (theBenchIsReady('earth', held)) complete.earth++;
        if (theBenchIsReady('heaven', held)) complete.heaven++;
    }
    line(`houses standing: ${houses.length}`);
    line(`  ceilings: mortal ${ceilingCount.mortal}, earth ${ceilingCount.earth}, heaven ${ceilingCount.heaven}`);
    line(`  holding any material at all: ${anyMaterial}`);
    line(`  could complete an EARTH recipe from own stock: ${complete.earth}`);
    line(`  could complete a HEAVEN recipe from own stock: ${complete.heaven}`);

    const materialRows = state.objects.filter(o => o.kind === 'material');
    const byGrade = new Map<string, number>();
    for (const row of materialRows) {
        const g = String(row.data.grade ?? row.tags.find(t => t.startsWith('grade:')) ?? '?');
        byGrade.set(g, (byGrade.get(g) ?? 0) + 1);
    }
    line(`  material rows in the world: ${materialRows.length}  ${[...byGrade].map(([g, n]) => `${g}=${n}`).join(' ')}`);

    line();
    line('=== ARTIFACT CATALOG, BY THE RUNG IT STANDS AT ===');
    const earthGate = refiningOrdinalFor('earth');
    const heavenGate = refiningOrdinalFor('heaven');
    let below = 0, atEarth = 0, atHeaven = 0, aboveTheCeiling = 0, noOrdinal = 0;
    for (const a of ARTIFACTS) {
        if (a.power === null) { noOrdinal++; continue; }
        if (a.power < earthGate) below++;
        else if (a.power < heavenGate) atEarth++;
        else if (a.power <= 41) atHeaven++;
        else aboveTheCeiling++;
    }
    line(`rows: ${ARTIFACTS.length}`);
    line(`  below the earth gate (${earthGate}): ${below}`);
    line(`  earth band (${earthGate}..${heavenGate - 1}): ${atEarth}`);
    line(`  heaven band (${heavenGate}..41): ${atHeaven}`);
    line(`  above the forge ceiling (42+, sent down or carried): ${aboveTheCeiling}`);
    line(`  no ordinal (manuals): ${noOrdinal}`);
}

main().catch(e => { console.error(e); process.exit(1); });
