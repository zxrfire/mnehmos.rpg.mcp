/**
 * The person who made it, reconstructed from state.
 *
 * "Can we make it to 44-46 without the pyramid collapsing" is answered by a
 * name or it is not answered. This follows the seed on which somebody crossed
 * and prints who they were, where they started, what carried them, and how long
 * it took - all read off fields, nothing authored.
 *
 * Run: npx tsx scripts/probe-who-got-to-the-top.ts [years]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { FALSE_IMMORTAL_ORDINAL } from '../src/engine/cultivation/realms.js';
import { ageInYears } from '../src/engine/world/npc-state.js';
import { groundEntitlementFor, roomsHeldBy } from '../src/engine/world/the-ground-somebody-is-actually-standing-on.js';

const YEARS = Number(process.argv[2] ?? 6000);
const STEP = 50;
const catalog = await loadCultivationCatalog();
let state = seedWorld({ seed: 'last-crossing', catalog }).state as any;

const track = new Map<string, { first: number; ord: number }[]>();
const climbers = new Set<string>();

for (let y = 0; y <= YEARS; y += STEP) {
    if (y > 0) state = advanceWorldYears(state, STEP).state;
    for (const n of state.npcs as any[]) {
        if (n.status !== 'alive') continue;
        if (n.cultivation.realmOrdinal >= 37) climbers.add(n.id);
        if (!climbers.has(n.id)) continue;
        const t = track.get(n.id) ?? [];
        if (t.length === 0 || t[t.length - 1].ord !== n.cultivation.realmOrdinal) {
            t.push({ first: y, ord: n.cultivation.realmOrdinal });
        }
        track.set(n.id, t);
    }
}

const alive = (state.npcs as any[]).filter(n => n.status === 'alive');
const crossed = (state.npcs as any[]).filter(n => n.cultivation.realmOrdinal >= FALSE_IMMORTAL_ORDINAL);
const at44 = alive.filter(n => n.cultivation.realmOrdinal >= 41);

const show = (n: any, label: string) => {
    console.log(`\n${label}: ${n.name}  (${n.id})`);
    console.log(`  ordinal ${n.cultivation.realmOrdinal}   status ${n.status}   age ${ageInYears(n, state.currentDay)}`);
    console.log(`  born      ${n.identity.origin}`);
    console.log(`  root      ${n.cultivation.spiritRoot}`);
    console.log(`  attributes ${JSON.stringify(n.cultivation.attributes)}`);
    console.log(`  house     ${n.factionId ?? '(none)'}  rank ${n.factionRankIndex}`);
    console.log(`  roads     ${(n.cultivation.techniqueIds ?? []).length} held`);
    if (n.factionId) {
        const members = alive.filter((m: any) => m.factionId === n.factionId);
        const rooms = roomsHeldBy(state.locations, n.factionId);
        const e = groundEntitlementFor(n, n.factionId, members, rooms, 1, 6);
        console.log(`  ground    ${e.room ? `${e.room.band}(${e.room.density})` : 'none'}, ` +
            `${e.daysPerYear} days a year, effective x${e.effectiveRate.toFixed(2)}`);
    }
    const t = track.get(n.id);
    if (t && t.length) {
        console.log(`  climb     ${t.map(s => `${s.ord}@y${s.first}`).join('  ')}`);
    }
};

for (const n of crossed) show(n, 'CROSSED THE LID');
console.log(`\n--- standing at 41 or above at ${YEARS}y: ${at44.length} ---`);
for (const n of at44) show(n, 'AT THE LAST REALM');
