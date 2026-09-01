/**
 * What a member is entitled to on their house ground, as a caller would read it
 * for the player.
 *
 * The world computes ground time for every NPC and the player could not ask
 * for, see or use any of it - the mirror image of the defect AGENTS.md records
 * as "the world rules must bind the player too". This checks that the
 * entitlement reads as an entitlement: a room, a number of days, what it is
 * worth, and what the next rung up would get instead.
 *
 * Run: npx tsx scripts/probe-what-does-my-rank-get-me-on-the-vein.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { groundEntitlementFor, roomsHeldBy } from '../src/engine/world/the-ground-somebody-is-actually-standing-on.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'entitlement', catalog });
const alive = (state.npcs as any[]).filter(n => n.status === 'alive');

for (const factionId of ['sect-azure-cloud-pavilion', 'sect-hollow-court', 'sect-sixmile-wardens']) {
    const faction = (state.factions as any[]).find(f => f.id === factionId);
    if (!faction) continue;
    const members = alive.filter(n => n.factionId === factionId);
    const rooms = roomsHeldBy(state.locations as any, factionId);
    if (members.length === 0) continue;

    console.log(`\n${factionId}   ${members.length} members, ${rooms.length} rooms`);
    const shown = [...members].sort((a, b) => a.factionRankIndex - b.factionRankIndex);
    for (const m of [shown[0], shown[shown.length - 1]]) {
        const e = groundEntitlementFor(
            m, factionId, members, rooms, 1, faction.ranks.length);
        const rank = faction.ranks[m.factionRankIndex] ?? `rank ${m.factionRankIndex}`;
        console.log(`  ${rank} (ord ${m.cultivation.realmOrdinal})`);
        console.log(`     room        ${e.room ? `${e.room.name} - ${e.room.band}(${e.room.density})` : 'none'}`);
        console.log(`     entitled to ${e.daysPerYear} days a year`);
        console.log(`     worth       x${e.effectiveRate.toFixed(2)} against x${e.fallbackRate.toFixed(2)} off it`);
        console.log(`     next rung   ${e.atNextRank
            ? `${e.atNextRank.daysPerYear} days, x${e.atNextRank.effectiveRate.toFixed(2)}`
            : '(top of the house)'}`);
    }
}
