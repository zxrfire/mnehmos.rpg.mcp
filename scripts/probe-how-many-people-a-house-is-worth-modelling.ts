/**
 * The rank-and-file pass, measured against the same world seeded without it.
 *
 * BOTH ARMS RUN IN ONE PROCESS off one tree, which is the only kind of control
 * arm AGENTS.md accepts: `rollWorthModelling: 0` seeds the identical world with
 * `seedThePeopleAHouseRaised` doing nothing.
 *
 * Reports, per seed, per arm:
 *   the roll        living members per seated house - the DISTRIBUTION.
 *   the rank rungs  how many of a house's rank rows anybody stands on, and
 *                   WHICH ones are empty, aggregated over all houses.
 *   the realm rungs how many distinct realm ordinals anybody in a house stands
 *                   at - the other reading of "the ladder has gaps".
 *   the gate        houses where nobody at the seat could host a guest.
 *   the order       `power_ordinal` per house, and whether the ordering moved.
 *
 * ── WHAT IT SAID, FIVE SEEDS ─────────────────────────────────────────────
 *
 *   living roll per seated house    before              after
 *     min / p10 / MED / p90 / max   4 / 5 / 7-8 / 11-12 / 15-22
 *                                -> 5 / 9-11 / 14-15 / 17-18 / 22
 *     houses under 5                3-4    ->  0
 *     houses at 10-20               9-13   ->  30-33
 *   distinct realms on a roll, MED  6-7    ->  9
 *   rank rungs with nobody on them  60/245 -> 60/245, UNCHANGED by the roll,
 *                                   and the empty ones were rungs 2-5. Closed
 *                                   since, by the posts/bands split in
 *                                   `rosterByRung`: 2/245 at world open. See
 *                                   the note at the foot of this file.
 *   power_ordinal moved             0 houses of 38, every seed
 *
 * Run: npx tsx scripts/probe-how-many-people-a-house-is-worth-modelling.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { couldHostAGuest } from '../src/engine/world/standing-at-the-gate-of-a-house.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,afford-c,roster-d,roster-e').split(',');

function quantile(sorted: readonly number[], q: number): number {
    if (sorted.length === 0) return 0;
    const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
    return sorted[at]!;
}

interface Arm {
    rolls: number[];
    houses: number;
    emptyRankRungs: number;
    totalRankRungs: number;
    emptyByRung: number[];
    realmRungsHeld: number[];
    gateAnswerable: number;
    power: Map<string, number>;
    order: string[];
    living: number;
    rows: number;
}

function read(state: WorldState): Arm {
    const living = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const bucket = living.get(npc.factionId);
        if (bucket) bucket.push(npc); else living.set(npc.factionId, [npc]);
    }
    const arm: Arm = {
        rolls: [], houses: 0, emptyRankRungs: 0, totalRankRungs: 0,
        emptyByRung: new Array(10).fill(0), realmRungsHeld: [],
        gateAnswerable: 0, power: new Map(), order: [],
        living: state.npcs.filter(n => n.status === 'alive').length,
        rows: state.npcs.length
    };
    const seated = state.factions.filter(f =>
        f.dissolvedOnDay === null && isBelowTheLid(f) && f.seatLocationId !== null);
    for (const faction of seated) {
        const roll = living.get(faction.id) ?? [];
        if (roll.length === 0) continue;
        arm.houses++;
        arm.rolls.push(roll.length);
        const held = new Set(roll.map(p => p.factionRankIndex));
        arm.totalRankRungs += faction.ranks.length;
        for (let r = 0; r < faction.ranks.length; r++) {
            if (!held.has(r)) { arm.emptyRankRungs++; arm.emptyByRung[r]++; }
        }
        arm.realmRungsHeld.push(new Set(roll.map(p => p.cultivation.realmOrdinal)).size);
        const here = roll.filter(p => p.locationId === faction.seatLocationId);
        if (here.some(p => couldHostAGuest(p.factionRankIndex, faction.ranks.length))) {
            arm.gateAnswerable++;
        }
        arm.power.set(faction.id, faction.resources.power_ordinal ?? -1);
    }
    arm.rolls.sort((a, b) => a - b);
    arm.realmRungsHeld.sort((a, b) => a - b);
    arm.order = [...arm.power.entries()]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .map(([id]) => id);
    return arm;
}

function say(label: string, a: Arm): void {
    const mean = (xs: readonly number[]) => xs.reduce((s, n) => s + n, 0) / Math.max(1, xs.length);
    console.log(
        `  ${label.padEnd(8)} rows ${String(a.rows).padStart(4)} living ${String(a.living).padStart(4)}  `
        + `houses ${a.houses}  roll: min ${a.rolls[0]} p10 ${quantile(a.rolls, 0.1)} `
        + `p25 ${quantile(a.rolls, 0.25)} MED ${quantile(a.rolls, 0.5)} p75 ${quantile(a.rolls, 0.75)} `
        + `p90 ${quantile(a.rolls, 0.9)} max ${a.rolls[a.rolls.length - 1]} mean ${mean(a.rolls).toFixed(1)}`
    );
    console.log(
        `           under 5: ${a.rolls.filter(n => n < 5).length}  5-9: ${a.rolls.filter(n => n >= 5 && n < 10).length}  `
        + `10-20: ${a.rolls.filter(n => n >= 10 && n <= 20).length}  over 20: ${a.rolls.filter(n => n > 20).length}`
    );
    console.log(
        `           rank rungs empty ${a.emptyRankRungs}/${a.totalRankRungs} `
        + `by rung [${a.emptyByRung.slice(0, 7).join(',')}]   `
        + `realm rungs held per house: MED ${quantile(a.realmRungsHeld, 0.5)} `
        + `p90 ${quantile(a.realmRungsHeld, 0.9)} mean ${mean(a.realmRungsHeld).toFixed(1)}`
    );
    console.log(`           gate answerable ${a.gateAnswerable}/${a.houses}`);
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    let movedTotal = 0;
    let orderMovesTotal = 0;
    for (const seed of SEEDS) {
        const before = read(seedWorld({ seed, catalog, rollWorthModelling: 0 }).state);
        const after = read(seedWorld({ seed, catalog }).state);
        console.log(seed);
        say('before', before);
        say('after', after);

        let moved = 0;
        const movers: string[] = [];
        for (const [id, p] of after.power) {
            const was = before.power.get(id);
            if (was === undefined) continue;
            if (was !== p) { moved++; movers.push(`${id} ${was}->${p}`); }
        }
        const posBefore = new Map(before.order.map((id, i) => [id, i]));
        let orderMoves = 0;
        after.order.forEach((id, i) => { if (posBefore.get(id) !== i) orderMoves++; });
        movedTotal += moved;
        orderMovesTotal += orderMoves;
        console.log(`           power_ordinal moved on ${moved} houses`
            + `${movers.length > 0 ? ': ' + movers.join(', ') : ''};`
            + ` houses at a different position in the standing order: ${orderMoves}`);
        console.log('');
    }
    console.log(`TOTAL over ${SEEDS.length} seeds: power_ordinal moved ${movedTotal} times, `
        + `standing order moved ${orderMovesTotal} times.`);
}

void main();

// ─────────────────────────────────────────────────────────────────────────
// THE RANK RUNGS DID NOT FILL, AND THE ROLL IS NOT WHY
//
// A deeper roll moved the REALM ladder - a house's people stand at 9 distinct
// ordinals where they stood at 6 or 7 - and left the RANK ladder exactly where
// it was: 60 of 245 rungs with nobody on them, before and after, and the empty
// ones are rungs 2 to 5 of a seven-rung house.
//
// That is arithmetic about `rosterByRung`'s taper rather than about the roll.
// At ROSTER_TAPER 0.4 on a seven-rung ladder, rung 3 gets its first seat at a
// roll of 26 and rung 5 at a roll of 162, so NO roll a player could hold in
// their head fills those rungs. What occupies them today is catalog figures
// whose curated rank the role pass honours as a floor; everybody else the taper
// did not reach is dropped to rung 0, which is why a house of fifteen has ten
// people standing at its door and nobody between them and the elders.
//
// Closing it is a change to how `assignFactionRoles` places people, not to how
// many there are, and it would move who is an elder in every house in the
// world - which reaches the sending pass, the gate, and who may order whom. It
// is deliberately NOT done here.
//
// ── IT HAS SINCE BEEN CLOSED, AND IT WAS NOT THE CURVE ───────────────────
//
// `rosterByRung` was tapering a POST the way it tapers a band. A rank ladder
// holds both: bands, where a taper is right, and posts - the elder's chair, the
// grand elder, the head - which are chairs somebody sits in and do not grow
// with the house. `sects.ts` already said so in its own header, and said
// `elderRungOf` is the authority on where the posts start and that nothing
// should re-derive it from a fraction. The taper was the fraction.
//
// Same five seeds, same rolls, world open: rank rungs with nobody on them
// 60/245 -> 2/245, and the ELDER rungs among them 45/110 empty -> 1. Nobody's
// `power_ordinal` moved and nobody's place in the standing order moved. What it
// cost, and it is the only thing it cost: four or five catalog figures a world
// stand one rung lower inside the elder tier, because the grand elder's seat is
// one spot and somebody stronger now stands in it.
//
// `probe-whether-a-house-has-a-middle.ts` is the measurement, and it carries
// the decay at 25 and 100 years as well.
