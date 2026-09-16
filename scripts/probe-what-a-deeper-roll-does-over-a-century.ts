/**
 * The same two arms as `scratch-roster-two-arms-at-world-open.ts`, carried out
 * to the horizons the party-size and gate rulings were measured at - because
 * both of those are things the world DOES rather than things the seeder sets.
 *
 * Both arms in one process off one tree. `rollWorthModelling: 0` is the world
 * without the rank-and-file pass.
 *
 * ── WHAT IT SAID, THREE SEEDS, 1 AND 100 YEARS ───────────────────────────
 *
 *                            before            after
 *   party size, mean @100y   3.38 3.49 3.37 -> 4.65 4.36 4.25
 *   party size, p50 @100y    3    3    3    -> 5    4    4
 *   roll MED @100y           7    6    7    -> 8    9    9
 *   houses under 5 @100y     9/42 11/46 12/42 -> 8/43 5/46 9/41
 *   rank rungs empty @1y     74   68   75   -> 50   46   51
 *   gate-unanswerable @100y  21/42 20/46 21/42 -> 17/43 20/46 22/41
 *   living @100y             547  549  530  -> 733  755  752
 *
 * THE PARTY IS THE RESULT. `whoTheHouseCanSend` takes the errand's `hands` off
 * whoever the house can spare, so a thin roll was what the bound was biting -
 * and 3 out of 15 is the errand the design owner called ordinary.
 *
 * THE GATE IS NOT, and the roster cannot reach it. By a century most houses
 * have nobody at the seat for reasons that are not errands at all: people put
 * on town postings and never recalled. `a-house-keeps-somebody-at-its-own-gate`
 * already recorded that, and this confirms a deeper roll does not fix it.
 *
 * Run: npx tsx scripts/probe-what-a-deeper-roll-does-over-a-century.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { couldHostAGuest } from '../src/engine/world/standing-at-the-gate-of-a-house.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,afford-c').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '1,100').split(',').map(Number);

function quantile(sorted: readonly number[], q: number): number {
    if (sorted.length === 0) return 0;
    const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
    return sorted[at]!;
}

function say(state: WorldState, label: string, year: number): void {
    const living = new Map<string, NpcRecord[]>();
    let alive = 0;
    let rogues = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        alive++;
        if (!npc.factionId) { rogues++; continue; }
        const bucket = living.get(npc.factionId);
        if (bucket) bucket.push(npc); else living.set(npc.factionId, [npc]);
    }
    const rolls: number[] = [];
    let seated = 0;
    let gateUnanswerable = 0;
    let nobodyAtHome = 0;
    let emptyRungs = 0;
    let totalRungs = 0;
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        if (faction.seatLocationId === null) continue;
        const roll = living.get(faction.id) ?? [];
        if (roll.length === 0) continue;
        seated++;
        rolls.push(roll.length);
        totalRungs += faction.ranks.length;
        emptyRungs += faction.ranks.length - new Set(roll.map(p => p.factionRankIndex)).size;
        const here = roll.filter(p => p.locationId === faction.seatLocationId);
        if (here.length === 0) nobodyAtHome++;
        if (!here.some(p => couldHostAGuest(p.factionRankIndex, faction.ranks.length))) {
            gateUnanswerable++;
        }
    }
    rolls.sort((a, b) => a - b);
    const parties = state.history.facts
        .map(f => f.actors.filter(a => a.role === 'sent' || a.role === 'lost').length)
        .filter(n => n > 0)
        .sort((a, b) => a - b);
    const mean = (xs: readonly number[]) => xs.reduce((s, n) => s + n, 0) / Math.max(1, xs.length);

    console.log(
        `  ${label.padEnd(7)} @${String(year).padStart(3)}y living ${String(alive).padStart(4)} `
        + `rogue ${String(Math.round(100 * rogues / Math.max(1, alive))).padStart(2)}%  seated ${seated}  `
        + `roll: min ${rolls[0]} p10 ${quantile(rolls, 0.1)} MED ${quantile(rolls, 0.5)} `
        + `p90 ${quantile(rolls, 0.9)} max ${rolls[rolls.length - 1]} mean ${mean(rolls).toFixed(1)}`
    );
    console.log(
        `             under 5 ${rolls.filter(n => n < 5).length}/${rolls.length}  `
        + `rank rungs empty ${emptyRungs}/${totalRungs}  `
        + `gate-unanswerable ${gateUnanswerable}/${seated}  nobody-at-home ${nobodyAtHome}`
    );
    console.log(
        `             parties n=${parties.length} p10/p50/p90 ${quantile(parties, 0.1)}/`
        + `${quantile(parties, 0.5)}/${quantile(parties, 0.9)} mean ${mean(parties).toFixed(2)}`
    );
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    for (const seed of SEEDS) {
        console.log(seed);
        for (const arm of [0, undefined]) {
            const label = arm === 0 ? 'before' : 'after';
            const { state } = seedWorld({ seed, catalog, rollWorthModelling: arm });
            let at = 0;
            for (const horizon of HORIZONS) {
                advanceWorldYears(state, horizon - at, { stopOnInterrupt: false });
                at = horizon;
                say(state, label, horizon);
            }
        }
        console.log('');
    }
}

void main();
