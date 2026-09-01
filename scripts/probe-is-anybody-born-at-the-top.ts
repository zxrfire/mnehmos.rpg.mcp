/**
 * Is anybody born into an apex house, and are they standing on apex ground?
 *
 * The setting describes somebody born in an apex sect with an apex sect's qi
 * and everything that comes with it. Three multipliers are supposed to compound
 * for that person - the origin their birth funds, the ground they are raised on,
 * and a teaching chain - and measured, the fastest climbers in the world are
 * overwhelmingly in runtime-founded splinter sects rather than in any apex.
 *
 * Before connecting birth to the climb it is worth knowing whether the world
 * ever produces the person at all. Three questions, all placement rather than
 * rate:
 *
 *   Is anybody drawn into the apex origin bracket?
 *   Are those people IN an apex house, or somewhere else entirely?
 *   Is the ground under them any good? Ground is the largest term in the model
 *   at x8 from thin to spirit tide, and another measurement puts reaching
 *   ordinal 29 at 317 years on ordinary ground against 79 on a sealed vein.
 *
 * Run: npx tsx scripts/probe-is-anybody-born-at-the-top.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { ordinaryBandFor } from '../src/engine/world/qi-scale.js';
import { tierOf } from '../src/data/cultivation/governance-and-water-rights.js';

const catalog = await loadCultivationCatalog();
const APEXES = new Set(['sect-azure-cloud-pavilion', 'sect-hollow-court']);
const RICH = new Set(['apex_sect_members_child', 'dao_house_bloodline', 'fostered_on_a_word']);

for (const seed of ['born-a', 'born-b', 'born-c']) {
    const { state } = seedWorld({ seed, catalog });
    const alive = (state.npcs as any[]).filter(n => n.status === 'alive');
    const locById = new Map((state.locations as any[]).map(l => [l.id, l]));

    const origins = new Map<string, number>();
    for (const n of alive) {
        const o = String(n.identity?.origin ?? 'MISSING');
        origins.set(o, (origins.get(o) ?? 0) + 1);
    }
    const apexBorn = alive.filter(n => n.identity?.origin === 'apex_sect_members_child');
    const richBorn = alive.filter(n => RICH.has(String(n.identity?.origin)));
    const inApex = alive.filter(n => APEXES.has(String(n.factionId)));

    console.log(`\nseed ${seed}   population ${alive.length}`);
    console.log(`  born apex_sect_members_child : ${apexBorn.length}` +
        `  (${(100 * apexBorn.length / alive.length).toFixed(2)}%)`);
    console.log(`  born into any rich bracket   : ${richBorn.length}` +
        `  (${(100 * richBorn.length / alive.length).toFixed(2)}%)`);
    console.log(`  standing in an apex house    : ${inApex.length}`);

    // Where are the apex-born actually standing?
    const placed = new Map<string, number>();
    for (const n of apexBorn) placed.set(String(n.factionId ?? '(none)'),
        (placed.get(String(n.factionId ?? '(none)')) ?? 0) + 1);
    console.log(`  apex-born, by house they are actually in:`);
    for (const [f, c] of [...placed].sort((a, b) => b[1] - a[1])) {
        console.log(`     ${String(c).padStart(3)}  ${f}` +
            (APEXES.has(f) ? '   <- an apex' : f === '(none)' ? '' : `   tier ${tierOf(f)}`));
    }

    // And what ground is under them?
    const groundOf = (n: any): string => {
        const l = locById.get(n.locationId);
        const d = l?.qiDensity;
        return typeof d === 'number' ? ordinaryBandFor(d) : 'unknown';
    };
    const bandCount = (people: any[]) => {
        const m = new Map<string, number>();
        for (const p of people) m.set(groundOf(p), (m.get(groundOf(p)) ?? 0) + 1);
        return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
    };
    console.log(`  ground under the apex-born   : ${bandCount(apexBorn) || '(nobody)'}`);
    console.log(`  ground under everybody       : ${bandCount(alive)}`);
}
