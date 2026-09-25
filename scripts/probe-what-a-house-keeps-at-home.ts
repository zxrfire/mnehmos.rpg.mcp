/**
 * What a house keeps at home, and what it costs it when it keeps nothing.
 *
 * A party's size is bounded by the errand's `hands`, the conveyance's `heads`
 * and the purse, and by nothing about what the house can spare. So a house can
 * and does put every living name on its roll on one road at once.
 *
 * Per seated house, at each horizon:
 *
 *   all in one place  every living member standing in one location that is not
 *                     the house's own seat. The whole house on one errand.
 *   nobody at home    nobody living is standing at the seat, whatever the
 *                     reason - which includes people who never lived there.
 *   away with a party the subset of those where somebody is out on an errand
 *                     right now, which is the part a sending rule can reach.
 *   gate unanswerable nobody at the seat could host a guest -
 *                     `couldHostAGuest`, which is what `standingAtTheGateOf`
 *                     filters `theirPeopleHere` through before it can say a
 *                     visitor may be walked in.
 *
 * And the second defect, read off the world's own rows rather than off the
 * ledger: everybody in one party shares a `sinceDay`, so a party member whose
 * own activity names a DIFFERENT party was booked onto a second errand while
 * the first was still running.
 *
 * Run: npx tsx scripts/probe-what-a-house-keeps-at-home.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { couldHostAGuest } from '../src/engine/world/standing-at-the-gate-of-a-house.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,afford-c').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '1,100,300').split(',').map(Number);

function quantile(sorted: readonly number[], q: number): number {
    if (sorted.length === 0) return 0;
    const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
    return sorted[at]!;
}

/** Party members whose own row names a different party. */
function inTwoPartiesAtOnce(state: WorldState): number {
    const byId = new Map<string, NpcRecord>();
    for (const npc of state.npcs) byId.set(npc.id, npc);
    let caught = 0;
    for (const npc of state.npcs) {
        const doing = npc.activity;
        if (npc.status !== 'alive' || !doing || doing.kind !== 'out_with_a_party') continue;
        for (const id of doing.withIds) {
            const other = byId.get(id);
            const theirs = other?.activity;
            if (!other || other.status !== 'alive') continue;
            if (!theirs || theirs.kind !== 'out_with_a_party') continue;
            if (theirs.sinceDay !== doing.sinceDay) caught++;
        }
    }
    return caught;
}

function report(state: WorldState, seed: string, year: number): void {
    const living = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const bucket = living.get(npc.factionId);
        if (bucket) bucket.push(npc); else living.set(npc.factionId, [npc]);
    }

    let seated = 0;
    let allInOnePlace = 0;
    let nobodyAtHome = 0;
    let nobodyAtHomeAndAway = 0;
    let gateUnanswerable = 0;
    const shareAtHome: number[] = [];
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        if (faction.seatLocationId === null) continue;
        const roll = living.get(faction.id) ?? [];
        if (roll.length === 0) continue;
        seated++;
        const here = roll.filter(p => p.locationId === faction.seatLocationId);
        shareAtHome.push(here.length / roll.length);
        const somewhereElse = new Set(roll.map(p => p.locationId));
        if (here.length === 0) {
            nobodyAtHome++;
            if (somewhereElse.size === 1) allInOnePlace++;
            if (roll.some(p => p.activity?.kind === 'out_with_a_party')) nobodyAtHomeAndAway++;
        }
        if (!here.some(p => couldHostAGuest(p.factionRankIndex, faction.ranks.length))) {
            gateUnanswerable++;
        }
    }

    const parties = state.history.facts
        .map(f => f.actors.filter(a => a.role === 'sent' || a.role === 'lost').length)
        .filter(n => n > 0)
        .sort((a, b) => a - b);
    const atHome = [...shareAtHome].sort((a, b) => a - b);

    console.log(
        `${seed} @${year}y  seated=${seated}  all-in-one-place=${allInOnePlace}  `
        + `nobody-at-home=${nobodyAtHome} (of which out with a party now: `
        + `${nobodyAtHomeAndAway})  gate-unanswerable=${gateUnanswerable}`
    );
    console.log(
        `    share of a roll standing at its own seat: p10/p50/p90 = `
        + `${quantile(atHome, 0.1).toFixed(2)}/${quantile(atHome, 0.5).toFixed(2)}/`
        + `${quantile(atHome, 0.9).toFixed(2)}`
    );
    console.log(
        `    parties in the ledger: n=${parties.length} `
        + `p10/p50/p90 = ${quantile(parties, 0.1)}/${quantile(parties, 0.5)}/${quantile(parties, 0.9)} `
        + `mean = ${(parties.reduce((s, n) => s + n, 0) / Math.max(1, parties.length)).toFixed(2)}`
    );
    console.log(`    in two parties at once, right now: ${inTwoPartiesAtOnce(state)}`);
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    for (const seed of SEEDS) {
        const { state } = seedWorld({ seed, catalog });
        let at = 0;
        for (const horizon of HORIZONS) {
            advanceWorldYears(state, horizon - at, { stopOnInterrupt: false });
            at = horizon;
            report(state, seed, horizon);
        }
        console.log('');
    }
}

void main();
