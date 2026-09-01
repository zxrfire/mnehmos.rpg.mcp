/**
 * With the dao gate LIVE, does the world still produce an apex?
 *
 * The gate in `breakthrough.ts` refuses a realm crossing to anybody holding
 * fewer comprehension domains than the rung asks for. It shipped switched off
 * because nothing in the world supplied comprehension to an NPC at all, and the
 * measured cost of switching it on regardless was total:
 *
 *     band            people   mean roads   needed   would pass
 *     Core 17-20          28      1.18          1      28 / 28
 *     Nascent 21-24       20      1.30          2       5 / 20
 *     Deity 25-28          7      1.86          3       0 / 7
 *     Void 29-32           2      2.50          4       0 / 2
 *     Grand 37-40          1      3.00          6       0 / 1
 *
 * Nothing crossed ordinal 28 again. This probe re-runs exactly that table
 * against the supply added by `how-a-cultivator-comes-by-a-road.ts`, and adds
 * the two things the original could not report:
 *
 *   1. WHERE THE ROADS CAME FROM. A table that only counts roads cannot tell a
 *      world that supplies them from one that has had them handed out, and the
 *      difference is the whole of whether the gate is a wall or a formality.
 *   2. WHETHER THE BAND IS A BUCKET OR A FLUSH. A band held entirely by people
 *      who were there at seeding is a dying band however healthy its headcount,
 *      and a band that is 90-95% new arrivals every window is one being flushed.
 *      Both are failures and they look identical in a histogram, so arrivals are
 *      counted separately from survivors.
 *
 *   npx tsx scripts/probe-can-the-world-feed-the-dao-gate.ts
 *   YEARS=1500 SEEDS=5 npx tsx scripts/probe-can-the-world-feed-the-dao-gate.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { REALM_TIERS, realmForOrdinal } from '../src/engine/cultivation/realms.js';
import {
    DAO_GATE_ENFORCED,
    daoRequirementCurve,
    daoRequirementFor,
    roadsWalked
} from '../src/engine/cultivation/breakthrough.js';
import {
    daoGroundsInReachOf,
    roadsBoughtWithMaterialsBy,
    roadsInReachOf,
    DAO_GROUND_TAG
} from '../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import { roadsWalkedBy } from '../src/engine/world/an-npc-striking-at-the-next-wall.js';
import { isUnspent } from '../src/engine/world/single-use-dao-comprehension-materials.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const catalog = await loadCultivationCatalog();
const YEARS = Number(process.env.YEARS ?? 800);
const SEED_COUNT = Number(process.env.SEEDS ?? 3);
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => `dao-feed-${'abcdefgh'[i] ?? i}`);

const line = (s = '') => console.log(s);
const pct = (n: number, d: number) => (d === 0 ? '   -  ' : `${((100 * n) / d).toFixed(1)}%`.padStart(6));

line();
line(`  THE DAO GATE IS ${DAO_GATE_ENFORCED ? 'LIVE' : 'INERT'}`);
line();
line('  crossing at          into                        curve   enforced');
line('  ' + '-'.repeat(70));
for (const ordinal of [12, 16, 20, 24, 28, 32, 36, 40, 44]) {
    const into = ordinal >= 44 ? 'the last crossing' : realmForOrdinal(ordinal + 1).name;
    line('  ' + `${realmForOrdinal(ordinal).name} ${ordinal}`.padEnd(34)
        + into.padEnd(22)
        + String(daoRequirementCurve(ordinal)).padStart(5)
        + String(daoRequirementFor(ordinal)).padStart(11));
}
line();

// ── The bands the acceptance table is stated in ──────────────────────────
// Named for the realm somebody is standing IN, and the requirement quoted is
// the one they will meet at the top of it - which is the number that decides
// whether this band can ever produce the next.
const BANDS: { name: string; lo: number; hi: number }[] = [
    { name: 'Core 17-20', lo: 17, hi: 20 },
    { name: 'Nascent 21-24', lo: 21, hi: 24 },
    { name: 'Deity 25-28', lo: 25, hi: 28 },
    { name: 'Void 29-32', lo: 29, hi: 32 },
    { name: 'Body 33-36', lo: 33, hi: 36 },
    { name: 'Grand 37-40', lo: 37, hi: 40 },
    { name: 'Trib 41-44', lo: 41, hi: 44 }
];

interface Row {
    people: number;
    roads: number;
    pass: number;
    /** Alive at the end and not alive at seeding: the inflow. */
    arrived: number;
    fromPractice: number;
    fromGround: number;
    fromMaterial: number;
    /** How many hold at least k roads, k = 1..8. THE SUPPLY CEILING. */
    atLeast: number[];
}

function emptyRows(): Row[] {
    return BANDS.map(() => ({
        people: 0, roads: 0, pass: 0, arrived: 0,
        fromPractice: 0, fromGround: 0, fromMaterial: 0,
        atLeast: Array.from({ length: 9 }, () => 0)
    }));
}

function measure(state: WorldState, seededIds: Set<string>, rows: Row[]): void {
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        const ordinal = npc.cultivation.realmOrdinal;
        const at = BANDS.findIndex(b => ordinal >= b.lo && ordinal <= b.hi);
        if (at < 0) continue;
        const row = rows[at];
        const roads = roadsInReachOf(state, npc);
        const held = roadsWalked(roads);
        // The requirement they will meet at the TOP of their band, which is the
        // wall between this band and the next one.
        const needed = daoRequirementCurve(BANDS[at].hi);
        row.people++;
        row.roads += held;
        if (held >= needed) row.pass++;
        if (!seededIds.has(npc.id)) row.arrived++;
        row.fromPractice += roadsWalked(roadsWalkedBy(npc));
        row.fromGround += daoGroundsInReachOf(state, npc).length;
        row.fromMaterial += roadsBoughtWithMaterialsBy(state, npc.id).length;
        for (let k = 1; k <= 8; k++) if (held >= k) row.atLeast[k]++;
    }
}

const rows = emptyRows();
let totalAlive = 0;
let groundsOpen = 0, groundsBuried = 0, materialsLeft = 0, materialsSpent = 0;
const ceilings: number[] = [];

for (const seed of SEEDS) {
    const seeded = seedWorld({ seed, catalog });
    const seededIds = new Set(seeded.state.npcs.map(n => n.id));
    const { state } = advanceWorldYears(seeded.state, YEARS);
    measure(state, seededIds, rows);
    totalAlive += state.npcs.filter(n => n.status === 'alive').length;
    ceilings.push(Math.max(...state.npcs.filter(n => n.status === 'alive')
        .map(n => n.cultivation.realmOrdinal), 0));
    for (const l of state.locations) {
        if (!l.tags.includes(DAO_GROUND_TAG)) continue;
        if (l.data.daoAccess === 'buried' && !l.discovered) groundsBuried++;
        else groundsOpen++;
    }
    for (const o of state.objects) {
        if (o.kind !== 'material' || !o.tags.includes('single-use')) continue;
        if (isUnspent(o)) materialsLeft++;
        else materialsSpent++;
    }
}

line(`  ${SEEDS.length} SEEDS x ${YEARS} YEARS, ${totalAlive} living at the end`);
line();
line('  band            people   mean roads   needed   would pass    arrivals');
line('  ' + '-'.repeat(72));
for (let i = 0; i < BANDS.length; i++) {
    const row = rows[i];
    const needed = daoRequirementCurve(BANDS[i].hi);
    line('  ' + BANDS[i].name.padEnd(16)
        + String(row.people).padStart(6)
        + (row.people ? (row.roads / row.people).toFixed(2) : '-').padStart(13)
        + String(needed).padStart(9)
        + `${row.pass} / ${row.people}`.padStart(13)
        + pct(row.arrived, row.people).padStart(12));
}
line();
line('  WHERE THE ROADS CAME FROM (roads per person in band, by channel)');
line();
line('  band            practice    ground   material');
line('  ' + '-'.repeat(48));
for (let i = 0; i < BANDS.length; i++) {
    const row = rows[i];
    if (row.people === 0) continue;
    line('  ' + BANDS[i].name.padEnd(16)
        + (row.fromPractice / row.people).toFixed(2).padStart(8)
        + (row.fromGround / row.people).toFixed(2).padStart(10)
        + (row.fromMaterial / row.people).toFixed(2).padStart(11));
}
line();
line('  THE SUPPLY CEILING: share of each band holding at least k roads');
line();
line('  band              >=1    >=2    >=3    >=4    >=5    >=6    >=7');
line('  ' + '-'.repeat(66));
for (let i = 0; i < BANDS.length; i++) {
    const row = rows[i];
    if (row.people === 0) continue;
    line('  ' + BANDS[i].name.padEnd(16)
        + [1, 2, 3, 4, 5, 6, 7].map(k => pct(row.atLeast[k], row.people)).join(' '));
}
line();
line(`  dao grounds standing open ${groundsOpen}, still buried ${groundsBuried}`);
line(`  single-use materials unspent ${materialsLeft}, spent ${materialsSpent}`);
line(`  highest living ordinal per seed: ${ceilings.join(', ')}`);
line();
line('  Bands above Deity Transformation with nobody in them is the failure the');
line('  gate was held back for. A band at 90%+ arrivals is the other failure.');
line();
line('  ' + REALM_TIERS.map(t => t.name.slice(0, 6).padStart(7)).join(''));
