/**
 * What was everybody in the world born as, and does it depend on where they sit?
 *
 * The read the design owner actually did: pull the members of the Dao houses and
 * the courts off the register and look at their origins. It came back
 * `thin_county` all the way down, which is a house whose entire aristocracy was
 * born on farms.
 *
 * Three populations are reported separately, because three different rules are
 * supposed to produce them and reporting one number hides which rule fired:
 *
 *   PLACED AT SEEDING   people the catalogs put into a seat. Their origin should
 *                       follow from the seat.
 *   DERIVED AT SEEDING  the ordinary provincial population. Origin comes FIRST
 *                       here and the ladder spends it, so this must stay a
 *                       blind draw or the causality inverts.
 *   BORN IN PLAY        anybody the simulation produced afterwards. The weighted
 *                       lottery, untouched, and where the rarity lives.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { ORIGIN_TIERS, type OriginTierKey } from '../src/engine/cultivation/origin.js';
import { HOUSEHOLD_ORIGINS } from '../src/engine/world/how-many-of-the-broken-are-ever-mended.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';

const catalog = await loadCultivationCatalog();
const seeds = ['a', 'b', 'c', 'd', 'e'];
const KEYS = ORIGIN_TIERS.map(t => t.key);
const SHORT: Record<OriginTierKey, string> = {
    thin_county: 'thin', market_town: 'town', minor_clan: 'minor',
    sect_retainer: 'retain', established_clan: 'clan',
    dao_house_bloodline: 'blood', apex_sect_members_child: 'apexkid',
    fostered_on_a_word: 'fosterd'
};

/** Standing bands, read off `powerOrdinal` - the catalog's own measure of a body. */
const TIERS: [string, number, number][] = [
    ['apex 37+', 37, 99], ['great 29-36', 29, 36],
    ['middling 21-28', 21, 28], ['minor <=20', 0, 20]
];

function tally(rows: NpcRecord[]): Map<OriginTierKey, number> {
    const m = new Map<OriginTierKey, number>();
    for (const k of KEYS) m.set(k, 0);
    for (const n of rows) m.set(n.identity.origin, (m.get(n.identity.origin) ?? 0) + 1);
    return m;
}
function pct(m: Map<OriginTierKey, number>, n: number): string {
    if (n === 0) return KEYS.map(() => '-'.padStart(8)).join('');
    return KEYS.map(k => {
        const v = (m.get(k) ?? 0) / n * 100;
        return (v === 0 ? '.' : v < 0.05 ? '<.1' : v.toFixed(1)).padStart(8);
    }).join('');
}
function highShare(rows: NpcRecord[]): number {
    if (rows.length === 0) return 0;
    return rows.filter(n => HOUSEHOLD_ORIGINS.includes(n.identity.origin)).length / rows.length * 100;
}

const header = 'population'.padEnd(24) + 'n'.padStart(7) + KEYS.map(k => SHORT[k].padStart(8)).join('') + 'high%'.padStart(9);

// ── Aggregate across seeds ────────────────────────────────────────────────
const buckets = new Map<string, NpcRecord[]>();
const add = (k: string, rows: NpcRecord[]) => buckets.set(k, (buckets.get(k) ?? []).concat(rows));

const YEARS = Number(process.argv[2] ?? 300);

const placed = (n: NpcRecord) => n.tags.some(t => t.startsWith('catalog:'));

for (const seed of seeds) {
    const seeded = seedWorld({ seed: `orig-${seed}`, catalog });
    const atSeed = new Set(seeded.state.npcs.map(n => n.id));
    const powerById = new Map(catalog.factions.map(f => [f.id, f.powerOrdinal]));

    // ── The world as the register is read on the day it is created ────────
    const day0 = seeded.state.npcs.filter(n => n.status === 'alive');
    add('YEAR 0 placed', day0.filter(placed));
    add('YEAR 0 derived', day0.filter(n => !placed(n)));
    add('YEAR 0 whole world', day0);

    // Year 0 is the acceptance read on its own, and it needs no driver - which
    // also lets this probe run while somebody else has the pressure layer open.
    const state = YEARS > 0 ? advanceWorldYears(seeded.state, YEARS).state : seeded.state;
    const alive = state.npcs.filter(n => n.status === 'alive');

    const seededNpcs = state.npcs.filter(n => atSeed.has(n.id));
    add('SEEDED placed', seededNpcs.filter(placed));
    add('SEEDED derived', seededNpcs.filter(n => !placed(n)));
    add('BORN IN PLAY', state.npcs.filter(n => !atSeed.has(n.id)));
    add('WHOLE WORLD alive', alive);

    // By the standing of the body they are in - the read that found the bug.
    // Split seeded from arrived, because a body's membership after three
    // centuries is mostly people who walked in afterwards and were correctly
    // born from the ordinary lottery. Aggregating the two measures turnover.
    for (const [label, lo, hi] of TIERS) {
        const rows = alive.filter(n => {
            if (!n.factionId) return false;
            const p = powerById.get(n.factionId);
            return p != null && p >= lo && p <= hi;
        });
        add(`  in a body ${label}`, rows);
    }
    add('  no body at all', alive.filter(n => !n.factionId));

    // Who actually holds the senior seats, at year 0 and now. This is the read
    // the design owner did: Elder Holders and Convergence Masters.
    const seniorsOf = (rows: NpcRecord[], st: typeof state) => rows.filter(n => {
        if (!n.factionId) return false;
        const p = powerById.get(n.factionId);
        if (p == null || p < 37) return false;
        const f = st.factions.find(x => x.id === n.factionId);
        return f != null && n.factionRankIndex >= f.ranks.length - 3;
    });
    add('  apex seniors, year 0', seniorsOf(day0, seeded.state));
    const later = seniorsOf(alive, state);
    add(`  apex seniors, yr ${YEARS}`, later);
    add(`    of those, seeded`, later.filter(n => atSeed.has(n.id)));
    add(`    of those, arrived`, later.filter(n => !atSeed.has(n.id)));
}

console.log(`\nWorlds: ${seeds.length}, each advanced ${YEARS} years.\n`);
console.log(header);
console.log('-'.repeat(header.length));
for (const [label, rows] of buckets) {
    if (label.startsWith('  ')) continue;
    console.log(label.padEnd(24) + String(rows.length).padStart(7)
        + pct(tally(rows), rows.length) + highShare(rows).toFixed(2).padStart(9));
}
console.log('\nBY THE STANDING OF THE BODY THEY ARE IN (living population)');
console.log('-'.repeat(header.length));
for (const [label, rows] of buckets) {
    if (!label.startsWith('  ')) continue;
    console.log(label.padEnd(24) + String(rows.length).padStart(7)
        + pct(tally(rows), rows.length) + highShare(rows).toFixed(2).padStart(9));
}

// ── A handful of named people, read the way the register is read ──────────
console.log('\nREAD OFF THE REGISTER (seed orig-a, the world as created)');
const powerById = new Map(catalog.factions.map(f => [f.id, f.powerOrdinal]));
const st = seedWorld({ seed: 'orig-a', catalog }).state;
const picks: [string, (n: NpcRecord) => boolean][] = [
    ['a Dao house senior', n => {
        const f = st.factions.find(x => x.id === n.factionId);
        return f != null && (powerById.get(f.id) ?? 0) >= 37 && n.factionRankIndex >= f.ranks.length - 2;
    }],
    ['a great-house officer', n => {
        const f = st.factions.find(x => x.id === n.factionId);
        const p = powerById.get(n.factionId ?? '') ?? 0;
        return f != null && p >= 29 && p < 37 && n.factionRankIndex >= f.ranks.length - 3;
    }],
    ['a sect outer disciple', n => {
        const p = powerById.get(n.factionId ?? '') ?? -1;
        return p >= 0 && p <= 28 && n.factionRankIndex === 0;
    }],
    ['a rogue, no house', n => n.factionId == null]
];
for (const [label, pred] of picks) {
    const found = st.npcs.filter(n => n.status === 'alive' && pred(n)).slice(0, 4);
    for (const n of found) {
        const f = st.factions.find(x => x.id === n.factionId);
        const title = f ? `${f.ranks[n.factionRankIndex] ?? '?'} of the ${f.name}` : 'no house';
        console.log(`  ${label.padEnd(24)} ${n.name.padEnd(16)} ${title.padEnd(52)} [born: ${n.identity.origin}]`);
    }
}
