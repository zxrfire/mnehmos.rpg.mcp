/**
 * WHERE THE PEOPLE WORTH ASKING ACTUALLY STAND.
 *
 * A player's route upward is social - being taught, being introduced, asking
 * somebody for something - and every one of those verbs needs a body in reach.
 * The engine already tells the player so: "5 people in Low Fall stand above Qi
 * Condensation Layer 1 ... you have no name to ask for, which is the whole of
 * what is stopping you."
 *
 * So the question this answers is not "how many high cultivators exist". It is
 * WHERE THEY ARE STANDING, broken out by the kind of location, because a player
 * stands in a settlement and a body on a `region` node is on nothing anybody
 * can walk to.
 *
 * Reported per kind and pooled across seeds. The pyramid histogram is printed
 * alongside, because the population's shape is a law and any change that moves
 * people has to be checked against it in the same command.
 *
 * Run: npx tsx scripts/probe-where-the-high-cultivators-stand.ts [floor] [seeds...]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';

const FLOOR = Number(process.argv[2] ?? 17);
const SEEDS = process.argv.slice(3).length
    ? process.argv.slice(3)
    : ['stand-a', 'stand-b', 'stand-c'];

const catalog = await loadCultivationCatalog();

/** The bands the pyramid law is judged on - the ordinal floor of each realm. */
const BANDS = [0, 13, 17, 21, 25, 29, 33, 37, 41];

const pooledKind = new Map<string, number>();
const pooledBand = new Map<number, number>();
const pooledTag = new Map<string, number>();
let pooledAlive = 0;
let pooledSeats = 0;
let pooledOnSeats = 0;

for (const seed of SEEDS) {
    const { state } = seedWorld({ seed, catalog });
    const kindOf = new Map(state.locations.map(l => [l.id, l.kind]));
    const alive = state.npcs.filter(n => n.status === 'alive');
    pooledAlive += alive.length;
    pooledSeats += state.locations.filter(l => l.kind === 'sect_seat').length;

    const kinds = new Map<string, number>();
    for (const npc of alive) {
        if (npc.cultivation.realmOrdinal < FLOOR) continue;
        const kind = kindOf.get(npc.locationId ?? '') ?? 'nowhere';
        kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
        pooledKind.set(kind, (pooledKind.get(kind) ?? 0) + 1);
        if (kind === 'sect_seat') pooledOnSeats++;
        const tag = npc.tags.find(t => t.startsWith('catalog:')) ?? 'derived';
        pooledTag.set(tag, (pooledTag.get(tag) ?? 0) + 1);
    }
    for (const band of BANDS) {
        const n = alive.filter(a => a.cultivation.realmOrdinal >= band).length;
        pooledBand.set(band, (pooledBand.get(band) ?? 0) + n);
    }

    const rows = [...kinds.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`\n[${seed}] ${alive.length} alive, ${rows.reduce((s, r) => s + r[1], 0)} at >= ${FLOOR}`);
    for (const [kind, n] of rows) console.log(`    ${kind.padEnd(16)} ${n}`);

    // How thinly the stratum is spread. A single seat holding everybody is not
    // reach; it is one door. Reported per province, because that is the unit a
    // player's journey is priced in.
    if (process.env.PER_PLACE) {
        const byPlace = new Map<string, number[]>();
        for (const npc of alive) {
            if (npc.cultivation.realmOrdinal < FLOOR) continue;
            const loc = state.locations.find(l => l.id === npc.locationId);
            const parent = loc?.parentId ? state.locations.find(l => l.id === loc.parentId) : null;
            const key = `${parent?.name ?? '-'} / ${loc?.name ?? npc.locationId}`;
            const list = byPlace.get(key) ?? [];
            list.push(npc.cultivation.realmOrdinal);
            byPlace.set(key, list);
        }
        for (const [key, ords] of [...byPlace.entries()].sort()) {
            console.log(`      ${key}: ${ords.length} (deepest ${Math.max(...ords)})`);
        }
    }
}

console.log(`\n=== POOLED over ${SEEDS.length} seed(s) ===`);
console.log(`alive ${pooledAlive}   sect_seat locations ${pooledSeats}   on a sect seat at >= ${FLOOR}: ${pooledOnSeats}`);
console.log(`\nWHERE THE >= ${FLOOR} STAND`);
for (const [kind, n] of [...pooledKind.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${kind.padEnd(16)} ${n}`);
}
console.log('\nWHO THEY ARE');
for (const [tag, n] of [...pooledTag.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${tag.padEnd(16)} ${n}`);
}
console.log('\nPYRAMID (cumulative at or above each band, pooled)');
console.log('    ' + BANDS.map(b => `${b}:${pooledBand.get(b) ?? 0}`).join('  '));
