/**
 * Does being held back in a house walk anybody out of it, and what does that do
 * to the top of the world?
 *
 * Its two arms were taken in one process off a temporary switch, since removed;
 * the figures are in `being-held-back-in-a-house.ts`. Per seed, at each horizon:
 *
 *   walk-outs          people who left a live house's roll with a `walked-out:`
 *                      tag, per century, by where they stood: the bottom rung,
 *                      the middle, the elder rungs, and of those how many were
 *                      held back when they went
 *   elders per house   living people on an elder rung, over live seated houses
 *   above 29 / 35 / 41 living people below the Lid, not beasts, strictly above
 *                      (`probe-does-a-house-keep-its-shape.ts`'s reading)
 *   empty elder rung   live seated houses with any elder rung nobody holds
 *
 * Run: npx tsx scripts/probe-does-being-held-back-walk-anybody-out.ts
 *   PROBE_SEEDS  PROBE_YEARS (horizons)  PROBE_OUT
 */
import { writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { isElderRank } from '../src/engine/cultivation/leadership.js';
import { theSpeciesItIs } from '../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { whereTheyAreHeldBack } from '../src/engine/world/being-held-back-in-a-house.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,shape-a,demography').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '100,300,500').split(',').map(Number);
const OUT = process.env.PROBE_OUT ?? 'arm';
const DIR = 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';

type Where = 'bottom' | 'middle' | 'elder';

function read(state: WorldState) {
    const houses = state.factions.filter(f => f.dissolvedOnDay === null && f.seatLocationId !== null && isBelowTheLid(f));
    let elders = 0, emptyElderRung = 0, onRolls = 0;
    for (const house of houses) {
        const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
        onRolls += roll.length;
        const n = house.ranks.length;
        elders += roll.filter(m => isElderRank(m.factionRankIndex, n)).length;
        for (let r = 0; r < n; r++) {
            if (!isElderRank(r, n)) continue;
            if (!roll.some(m => m.factionRankIndex === r)) { emptyElderRung++; break; }
        }
    }
    const ords = state.npcs
        .filter(n => n.status === 'alive' && isBelowTheLid(n) && theSpeciesItIs(n) === null)
        .map(n => n.cultivation.realmOrdinal);
    return {
        houses: houses.length, onRolls, elders,
        eldersPerHouse: Number((elders / Math.max(1, houses.length)).toFixed(2)),
        over29: ords.filter(o => o > 29).length,
        over35: ords.filter(o => o > 35).length,
        over41: ords.filter(o => o > 41).length,
        emptyElderRung,
        heldBackNow: state.npcs.filter(n => n.status === 'alive' && whereTheyAreHeldBack(n) !== null).length
    };
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const dump: Record<string, unknown> = {};
    const arm = 'now';
    {
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            dump[`${arm}:y0:${seed}`] = read(state);
            console.log(`${arm} ${seed} @0 ${JSON.stringify(read(state))}`);
            const walked: Record<Where, number> = { bottom: 0, middle: 0, elder: 0 };
            let walkedHeldBack = 0;
            let walkedHeldBackElders = 0;
            let y = 0;
            for (const horizon of HORIZONS) {
                for (; y < horizon; y++) {
                    const before = new Map(state.npcs
                        .filter(n => n.status === 'alive' && n.factionId !== null)
                        .map(n => {
                            const house = state.factions.find(f => f.id === n.factionId);
                            return [n.id, {
                                rank: n.factionRankIndex, ranks: house?.ranks.length ?? 0,
                                heldBack: whereTheyAreHeldBack(n) !== null
                            }] as const;
                        }));
                    advanceWorldYears(state, 1, { stopOnInterrupt: false });
                    for (const n of state.npcs) {
                        const was = before.get(n.id);
                        if (!was || n.factionId !== null) continue;
                        if (!n.tags.some(t => t.startsWith('walked-out:')) || n.updatedOnDay < state.currentDay - 365) continue;
                        const where: Where = isElderRank(was.rank, was.ranks) ? 'elder' : was.rank <= 0 ? 'bottom' : 'middle';
                        walked[where]++;
                        if (was.heldBack) { walkedHeldBack++; if (where === 'elder') walkedHeldBackElders++; }
                    }
                }
                const r = { ...read(state), walkedPerCentury: {
                    bottom: Number((walked.bottom * 100 / horizon).toFixed(1)),
                    middle: Number((walked.middle * 100 / horizon).toFixed(1)),
                    elder: Number((walked.elder * 100 / horizon).toFixed(1)),
                    heldBack: Number((walkedHeldBack * 100 / horizon).toFixed(1)),
                    heldBackElders: Number((walkedHeldBackElders * 100 / horizon).toFixed(1))
                } };
                dump[`${arm}:y${horizon}:${seed}`] = r;
                console.log(`${arm} ${seed} @${horizon} ${JSON.stringify(r)}`);
            }
        }
    }
    writeFileSync(`${DIR}/held-back-${OUT}.json`, JSON.stringify(dump, null, 1), 'utf8');
}
void main();
