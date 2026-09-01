/**
 * Who actually gets days in their house cultivation rooms, and what that does
 * to the two dimensions the allocation is supposed to have.
 *
 * WHICH HOUSE YOU ARE IN SETS YOUR FLOOR: an apex holds more and better ground
 * and has more of it to spare, so its outer disciples should be meaningfully
 * better placed than a village sect outer disciples.
 * YOUR STANDING SETS HOW FAR ABOVE THAT FLOOR YOU SIT.
 *
 * Both have to bite. If only the second does, the fix has produced an internal
 * hierarchy and nothing else. If only the first does, rank stopped mattering.
 *
 * Run: npx tsx scripts/probe-who-gets-time-on-the-good-ground.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { ordinaryBandFor } from '../src/engine/world/qi-scale.js';
import {
    groundTimeShares, roomsHeldBy, groundBudgetOf, groundRateAt, rateOverTheYear, houseFallbackRate
} from '../src/engine/world/the-ground-somebody-is-actually-standing-on.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'ground-time', catalog });
const alive = (state.npcs as any[]).filter(n => n.status === 'alive');

console.log('house                          rooms  best ground     budget  members  demand   floor');
console.log('-'.repeat(96));
const rows: { id: string; shares: Map<string, number>; best: number | null; fb: number }[] = [];
for (const f of (state.factions as any[])) {
    const members = alive.filter(n => n.factionId === f.id);
    if (members.length === 0) continue;
    const rooms = roomsHeldBy(state.locations as any, f.id);
    const budget = groundBudgetOf(rooms);
    const shares = groundTimeShares(members, rooms);
    const best = groundRateAt(rooms[0]);
    rows.push({ id: f.id, shares: new Map(shares), best, fb: houseFallbackRate(rooms, 1) });
    const demand = members.reduce((s, m) => s + (m.cultivation.realmOrdinal >= 0 ? 1 : 0), 0);
    const bestBand = rooms[0] ? `${ordinaryBandFor(rooms[0].qiDensity)}(${rooms[0].qiDensity})` : 'none';
    const floor = shares.size ? [...shares.values()].reduce((a, b) => a + b, 0) / shares.size : 0;
    console.log(
        f.id.padEnd(30), String(rooms.length).padStart(5), bestBand.padEnd(17),
        String(budget).padStart(6), String(members.length).padStart(8),
        String(demand).padStart(7), floor.toFixed(3).padStart(7));
}

// THE TWO DIMENSIONS, side by side.
console.log('\nAN ORDINARY MEMBER AND A SENIOR ONE, PER HOUSE');
console.log('house                          rank0 share  top share   rate rank0   rate top');
for (const r of rows.slice(0, 14)) {
    const members = alive.filter(n => n.factionId === r.id);
    const low = members.filter(m => m.factionRankIndex === 0);
    const top = [...members].sort((a, b) => b.factionRankIndex - a.factionRankIndex)[0];
    const lowShare = low.length
        ? low.reduce((s, m) => s + (r.shares.get(m.id) ?? 0), 0) / low.length : 0;
    const topShare = top ? (r.shares.get(top.id) ?? 0) : 0;
    console.log(
        r.id.padEnd(30),
        lowShare.toFixed(3).padStart(11), topShare.toFixed(3).padStart(11),
        rateOverTheYear(lowShare, r.best, r.fb).toFixed(2).padStart(12),
        rateOverTheYear(topShare, r.best, r.fb).toFixed(2).padStart(10));
}
