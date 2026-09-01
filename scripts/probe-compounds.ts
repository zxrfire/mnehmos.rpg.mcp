/**
 * What the compounds actually came out as.
 *
 * Reads the seeded state, never prose. Answers the three questions the
 * architecture layer has to answer honestly:
 *
 *   1. Is there depth, and how much of it is real rather than a wrapper?
 *   2. Are thirty-two compounds thirty-two SHAPES, or one shape thirty-two
 *      times with the names swapped?
 *   3. Does the archaeology asymmetry fall out - is a single-root house
 *      identifiable from its architecture and an ordinary one not?
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import {
    attributionField,
    houseStyleOf,
    pathTo,
    reachThrough,
    roomStageFor,
    styleTagsOf,
    survivingTags,
    type HouseStyle
} from '../src/engine/world/architecture.js';

const catalog = await loadCultivationCatalog();

const t0 = Date.now();
const { state } = seedWorld({ seed: 'places-probe', catalog });
const seedMs = Date.now() - t0;

const locs = state.locations;
const byId = new Map(locs.map(l => [l.id, l]));
const depth = (l: typeof locs[number]): number => {
    let d = 0;
    let cursor = l.parentId;
    const seen = new Set<string>();
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
        seen.add(cursor);
        d++;
        cursor = byId.get(cursor)!.parentId;
    }
    return d;
};

console.log(`seedWorld: ${seedMs} ms, ${locs.length} locations`);
const kinds = new Map<string, number>();
const depths = new Map<number, number>();
for (const l of locs) {
    kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + 1);
    const d = depth(l);
    depths.set(d, (depths.get(d) ?? 0) + 1);
}
console.log('kinds:', [...kinds].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join(', '));
console.log('depth:', [...depths].sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d}: ${n}`).join(', '));

// ── 2. SHAPES ───────────────────────────────────────────────────────────
const styles = new Map<string, HouseStyle>();
for (const f of catalog.factions) {
    styles.set(f.id, houseStyleOf({
        factionId: f.id,
        alignment: f.alignment,
        governance: f.governance,
        production: f.production,
        formationIntegrity: f.formationIntegrity,
        inherited: f.compoundInherited,
        powerOrdinal: f.powerOrdinal,
        admissionOrdinal: f.admissionOrdinal,
        preferredRoots: f.preferredRoots,
        teachesElements: f.teachesElements
    }));
}

const shapes = new Map<string, string[]>();
for (const f of catalog.factions) {
    const rooms = locs
        .filter(l => l.data.factionId === f.id && typeof l.data.purpose === 'string')
        .map(l => String(l.data.purpose))
        .filter(p => p !== 'precinct' && p !== 'formation_node')
        .sort();
    const key = `${rooms.join('+')}|${styles.get(f.id)!.tags.join('+')}`;
    const list = shapes.get(key) ?? [];
    list.push(f.id);
    shapes.set(key, list);
}
console.log(`\ndistinct compound shapes: ${shapes.size} across ${catalog.factions.length} houses`);
const collisions = [...shapes.values()].filter(v => v.length > 1);
console.log(`houses sharing a shape with another: ${collisions.reduce((n, v) => n + v.length, 0)}`);
for (const c of collisions.slice(0, 5)) console.log('  collision:', c.join(', '));

// Room-count and precinct-count spread.
const roomCounts = catalog.factions.map(f =>
    locs.filter(l => l.data.factionId === f.id && l.tags.includes('interior')).length);
console.log(`rooms per compound: min ${Math.min(...roomCounts)}, max ${Math.max(...roomCounts)}, `
    + `mean ${(roomCounts.reduce((a, b) => a + b, 0) / roomCounts.length).toFixed(1)}`);

// ── 3. ARCHAEOLOGY ──────────────────────────────────────────────────────
const all = [...styles.values()];
const intensity = [...styles].map(([id, s]) => ({ id, s }))
    .sort((a, b) => b.s.elementalIntensity - a.s.elementalIntensity);

const bands = { absolutist: 0, coloured: 0, neutral: 0 };
for (const { s } of intensity) {
    if (s.elementalIntensity >= 0.66) bands.absolutist++;
    else if (s.elementalIntensity >= 0.28) bands.coloured++;
    else bands.neutral++;
}
console.log(`\nelemental bands: absolutist ${bands.absolutist}, coloured ${bands.coloured}, `
    + `neutral ${bands.neutral}`);

for (const age of ['new', 'old', 'ancient'] as const) {
    const fields = all.map(s => attributionField(survivingTags(s.tags, age), all).field);
    console.log(`attribution field, ${age.padEnd(7)} ruin: min ${Math.min(...fields)}, `
        + `max ${Math.max(...fields)}, mean ${(fields.reduce((a, b) => a + b, 0) / fields.length).toFixed(1)}`);
}

console.log('ancient ruins, hardest and easiest to attribute:');
const ranked = all
    .map(s => ({ s, field: attributionField(survivingTags(s.tags, 'ancient'), all).field }))
    .sort((a, b) => a.field - b.field);
for (const { s, field } of [...ranked.slice(0, 3), ...ranked.slice(-3)]) {
    console.log(`  ${s.factionId.padEnd(34)} intensity ${s.elementalIntensity.toFixed(2)} `
        + `${String(s.element ?? '-').padEnd(9)} -> ${field} candidate(s)`);
}

// ── 4. THE CHAIN ────────────────────────────────────────────────────────
const azure = catalog.factions.find(f => f.id === 'sect-azure-cloud-pavilion')!;
const vault = locs.find(l => l.data.factionId === azure.id && l.kind === 'vault');
if (vault) {
    const path = pathTo(locs, vault.id);
    console.log(`\npath to ${vault.name}:`);
    console.log('  ' + path.map(p => `${p.name.replace(/^.*: /, '')} [e${p.thresholds.entry}]`).join(' -> '));
    for (const ordinal of [0, 12, 24, 40]) {
        const r = reachThrough(path, { realmOrdinal: ordinal });
        const stopped = r.stoppedAt ? byId.get(r.stoppedAt)!.name.replace(/^.*: /, '') : 'nothing';
        console.log(`  ordinal ${String(ordinal).padStart(2)}: ${r.level.padEnd(11)} stopped at ${stopped}`);
    }
}

// The same room reached two ways: through the gate, and through a hole.
const dark = locs.filter(l => l.data.factionId === azure.id && l.tags.includes('dark'));
for (const node of dark) {
    const into = byId.get(String(node.data.opensOnto));
    if (!into) continue;
    const inside = locs.find(l => l.parentId === into.id && l.kind !== 'vault');
    if (!inside) continue;
    const front = reachThrough(pathTo(locs, inside.id), { realmOrdinal: 12 });
    const back = reachThrough([node, into, inside], { realmOrdinal: 12 }, { enteredAt: into.id });
    console.log(`  ${inside.name.replace(/^.*: /, '').padEnd(28)}`
        + ` via the gate: ${front.level.padEnd(11)} via the dark ${String(node.name).replace(/^.*: /, '')}: ${back.level}`);
}

// ── 5. WHO KNOWS THE BACK STAIR ─────────────────────────────────────────
const archive = locs.find(l => l.data.factionId === azure.id && l.data.purpose === 'archive');
const yard = locs.find(l => l.data.factionId === azure.id && l.data.purpose === 'practice_yard');
if (archive && yard) {
    const cases: [string, Parameters<typeof roomStageFor>[1]][] = [
        ['visiting elder, 0 years, outsider', { rankIndex: 4, rankCount: azure.ranks.length, yearsInHouse: 0, member: false }],
        ['own outer disciple, 20 years', { rankIndex: 1, rankCount: azure.ranks.length, yearsInHouse: 20, member: true }],
        ['own sword elder, 2 years', { rankIndex: 4, rankCount: azure.ranks.length, yearsInHouse: 2, member: true }]
    ];
    console.log('\nknowledge of two rooms:');
    for (const [who, v] of cases) {
        console.log(`  ${who.padEnd(34)} yard=${roomStageFor(yard, v).padEnd(11)} archive=${roomStageFor(archive, v)}`);
    }
}

// ── 6. STYLE TAGS REACHED STORAGE ───────────────────────────────────────
const tagged = locs.filter(l => styleTagsOf(l).length > 0).length;
console.log(`\nlocations carrying a readable style fingerprint: ${tagged}`);
