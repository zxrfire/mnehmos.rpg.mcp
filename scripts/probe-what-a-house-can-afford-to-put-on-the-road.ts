/**
 * What a house can afford to put on the road, and whether the gap widens.
 *
 * Charging a crossing to the treasury means a rich house sails and a poor one
 * walks. That is the intended difference. The question this answers is whether
 * it COMPOUNDS - a house that sails is a house whose parties arrive, finish and
 * come back with materials, so the obvious worry is a runaway - and the only
 * way to know is to read the same spread at two horizons.
 *
 * Reports, per horizon, per seed:
 *
 *   the roll        how many live people a house holds, which is what a party
 *                   is drawn out of and what payroll is charged on.
 *   the purse       spirit stones after the year's economy.
 *   what it covers  head-days of crossing the purse would buy, at
 *                   STONES_BURNED_PER_HEAD_PER_DAY.
 *   the spread      p10, p50, p90 of the purse, and the ratios. p90/p50 is the
 *                   robust one: p10 goes to zero whenever a world has a house
 *                   that just folded, and p90/p10 then reads as infinity.
 *
 * ── WHAT IT SAID, THREE SEEDS, 100 AND 300 YEARS ─────────────────────────
 *
 * The gap HOLDS. Houses covering a thirty-head crossing over the worked
 * 120-day road: 95/89/97% at a hundred years, 85/97/95% at three hundred.
 * p90/p50 on the purse: 5.5/6.4/5.4 at a hundred, 53.6/6.7/8.7 at three - and
 * the outlier is a world that founded five new houses in that span, which start
 * poor, rather than a rich house running away.
 *
 * THE BURN IS NOT WHAT SEPARATES THEM AT CENTURY SCALE, and that is the finding
 * rather than a disappointment. Thirty heads over that road is 720 stones
 * against a median purse of 140,000. Where it bites is at world open, where a
 * seeded purse is 200 to 1,400 (`seeding.ts`) and the same crossing is a real
 * decision: the house economy compounds and the burn does not.
 *
 * Run: npx tsx scripts/probe-what-a-house-can-afford-to-put-on-the-road.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { requireConveyance } from '../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {
    daysByConveyance,
    whatTheChestBurns
} from '../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { A_STIPEND_PER_MEMBER_PER_YEAR } from '../src/engine/world/the-world-changing-on-its-own.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,afford-c').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '100,300').split(',').map(Number);

/** The worked crossing the ruling is stated against: 120 walking days, by boat. */
const A_CROSSING_IN_WALKING_DAYS = 120;

function quantile(sorted: readonly number[], q: number): number {
    if (sorted.length === 0) return 0;
    const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
    return sorted[at]!;
}

interface Row {
    seed: string;
    year: number;
    houses: number;
    rolls: number[];
    purses: number[];
    /** Houses whose purse covers a boat crossing at the party size given. */
    couldSail: (heads: number) => number;
}

function read(state: WorldState, seed: string, year: number): Row {
    const roll = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        roll.set(npc.factionId, (roll.get(npc.factionId) ?? 0) + 1);
    }
    const rolls: number[] = [];
    const purses: number[] = [];
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        const members = roll.get(faction.id) ?? 0;
        if (members === 0) continue;
        rolls.push(members);
        purses.push(Number(faction.resources.spirit_stones ?? 0));
    }
    const boat = requireConveyance('conv-spirit-boat');
    const daysOneWay = daysByConveyance(A_CROSSING_IN_WALKING_DAYS, boat, 30);
    return {
        seed,
        year,
        houses: rolls.length,
        rolls,
        purses,
        couldSail: heads => {
            const cost = whatTheChestBurns({
                conveyance: boat,
                daysOneWay,
                heads,
                trips: Math.ceil(heads / boat.heads)
            });
            return purses.filter(p => p >= cost).length;
        }
    };
}

/**
 * Party sizes the world actually sent, off the ledger's own actor rows.
 *
 * The subset that reached the ledger rather than every errand - a light
 * finished errand is not news - which is stated rather than corrected for,
 * because the shape of the distribution is what is being read and both arms
 * are filtered identically.
 */
function partiesInTheLedger(state: WorldState): number[] {
    const sizes: number[] = [];
    for (const fact of state.history.facts) {
        const went = fact.actors.filter(a => a.role === 'sent' || a.role === 'lost');
        if (went.length === 0) continue;
        sizes.push(went.length);
    }
    return sizes;
}

/** Craft in the world: counted lines in yards, and tracked hulls with a past. */
function craftInTheWorld(state: WorldState): { counted: number; tracked: number; boats: number } {
    let counted = 0;
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null) continue;
        for (const [key, n] of Object.entries(faction.resources)) {
            if (key.startsWith('conveyance:')) counted += Math.max(0, Math.floor(n));
        }
    }
    const tracked = state.objects.filter(o => typeof o.data.conveyanceId === 'string');
    return {
        counted,
        tracked: tracked.length,
        boats: tracked.filter(o => o.data.conveyanceId === 'conv-spirit-boat').length
    };
}

function report(row: Row, state: WorldState): void {
    const purses = [...row.purses].sort((a, b) => a - b);
    const rolls = [...row.rolls].sort((a, b) => a - b);
    const p10 = quantile(purses, 0.1);
    const p50 = quantile(purses, 0.5);
    const p90 = quantile(purses, 0.9);
    const payroll = rolls.map(r => r * A_STIPEND_PER_MEMBER_PER_YEAR).sort((a, b) => a - b);
    console.log(
        `${row.seed} @${row.year}y  houses=${row.houses}  `
        + `roll p10/p50/p90 = ${quantile(rolls, 0.1)}/${quantile(rolls, 0.5)}/${quantile(rolls, 0.9)}`
    );
    console.log(
        `    purse p10/p50/p90 = ${p10}/${p50}/${p90}  `
        + `p90/p10 = ${p10 > 0 ? (p90 / p10).toFixed(1) : 'inf'}  `
        + `p90/p50 = ${p50 > 0 ? (p90 / p50).toFixed(1) : 'inf'}`
    );
    console.log(
        `    payroll p50 = ${quantile(payroll, 0.5)}  `
        + `broke (purse < payroll) = `
        + `${row.purses.filter((p, i) => p < row.rolls[i]! * A_STIPEND_PER_MEMBER_PER_YEAR).length}`
        + `/${row.houses}`
    );
    for (const heads of [5, 10, 15, 20, 30]) {
        const can = row.couldSail(heads);
        console.log(
            `    a ${String(heads).padStart(2)}-head crossing by boat: `
            + `${can}/${row.houses} houses cover it (${(100 * can / row.houses).toFixed(0)}%)`
        );
    }
    const parties = partiesInTheLedger(state).sort((a, b) => a - b);
    console.log(
        `    parties in the ledger: n=${parties.length} `
        + `p10/p50/p90 = ${quantile(parties, 0.1)}/${quantile(parties, 0.5)}/${quantile(parties, 0.9)} `
        + `mean = ${(parties.reduce((s, n) => s + n, 0) / Math.max(1, parties.length)).toFixed(1)}`
    );
    const craft = craftInTheWorld(state);
    console.log(
        `    craft: counted=${craft.counted} tracked=${craft.tracked} boats=${craft.boats}`
    );
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    for (const seed of SEEDS) {
        const { state } = seedWorld({ seed, catalog });
        let at = 0;
        for (const horizon of HORIZONS) {
            advanceWorldYears(state, horizon - at, { stopOnInterrupt: false });
            at = horizon;
            report(read(state, seed, horizon), state);
        }
        console.log('');
    }
}

void main();
