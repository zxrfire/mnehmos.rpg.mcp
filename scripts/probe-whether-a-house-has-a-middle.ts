/**
 * Does a house have a middle, and does it still have one in a century?
 *
 * The rank ladder had an empty middle in every house in the world: 60 of 245
 * rungs stood with nobody on them and they were rungs 2 to 5.
 * `probe-how-many-people-a-house-is-worth-modelling.ts` recorded that a deeper
 * roll did not touch it, and said why - `rosterByRung`'s taper, not the roll.
 *
 * This measures the placement rather than the headcount:
 *
 *   the rungs    how many rank slots anybody stands on, and which ones do not.
 *   the elders   every person on an elder rung, BY NAME, so a change of shape
 *                that quietly re-derives who runs a house is visible.
 *   the roll     unchanged by construction; asserted here rather than assumed.
 *   the order    `power_ordinal` per house and the standing order it produces.
 *   the decay    the same counts at 25 and 100 years, because a shape that only
 *                holds on day one is worth very little.
 *
 * TWO ARMS, TWO RUNS. Both arms of the roll probe run in one process because
 * `rollWorthModelling: 0` turns the pass off from the outside. There is no such
 * switch on the SHAPE of the ladder, so the control arm here is the same script
 * run on the tree before the change, with `PROBE_OUT` naming the file:
 *
 *   PROBE_OUT=before npx tsx scripts/probe-whether-a-house-has-a-middle.ts
 *   ...change rosterByRung...
 *   PROBE_OUT=after  npx tsx scripts/probe-whether-a-house-has-a-middle.ts
 *
 * The JSON it drops beside the log is what the elder-by-name comparison is
 * done off; the console half is for reading.
 *
 * ── WHAT IT SAID, FIVE SEEDS AT WORLD OPEN ───────────────────────────────
 *
 *                                       before          after
 *   rank slots with nobody on them      298/1225    ->  9/1225
 *     per world                         60/245      ->  1-3/245
 *     which rungs, summed over seeds    2:52 3:31 4:100 5:115  ->  2:5 3:1 4:1 5:2
 *   ELDER slots with nobody on them     45/110      ->  0-2/110
 *   people on an elder rung, per world  73          ->  124-127
 *   roll per house, MED / max           15 / 22     ->  15 / 22, and the living
 *                                                       count is identical
 *   power_ordinal moved                 0 of 38 houses, every seed
 *   standing order moved                0 places, every seed
 *   elders by name, 386 rows            313 stand on the same rung, 47 move UP
 *                                       within the elder rungs, 5 move down one
 *                                       rung and stay elders, 266 are new
 *
 * The five that move down are the grand elder's one seat being taken by
 * somebody stronger: a curated First Sword at realm 16 now stands at the elder
 * rung under a house member at 18. Nobody stops being an elder.
 *
 * NINE SLOTS STILL STAND EMPTY and both reasons are somebody else's: four are
 * rungs where a row on the roll is not alive - `assignFactionRoles` builds its
 * view from every row with a `factionId` whatever their status, so a dead
 * member holds a chair - and five are one house, the Nine Peaks Ascetic Order,
 * whose curated ranks skip Inner Ascetic and whose curated rank is honoured as
 * a floor. The catalog says nobody there is an Inner Ascetic.
 *
 * ── OVER TIME, AND THE TWO ARMS CONVERGE ─────────────────────────────────
 *
 *   rank slots empty     @0y          @25y           @100y
 *     before             59-60/245 -> 18-23/254-262  37-58/242-304
 *     after               1-2/245  -> 19-23/260-262  45-47/272-298
 *   ELDER slots empty
 *     before             45/110    ->  5-7/114-117   14-27/109-137
 *     after               0-2/110  ->  5-8/117       17-20/123-134
 *
 * THE EMPTY MIDDLE IS A SEED-TIME DEFECT AND THE RUNTIME ALREADY REPAIRED IT,
 * which is worth knowing before anybody builds anything: `applyPromotions` runs
 * off `promotion-inside-a-house.ts`, whose `seatsAtRank` is a SECOND authority
 * on how many people a rung holds - and it floors every middle rung at one,
 * which is the same rule `rosterByRung` now has. So by 25 years the two arms
 * are the same world, and the change matters for the world as it opens and for
 * the first decades of play.
 *
 * What neither arm holds is the century: a fifth to a sixth of every ladder
 * stands empty by 100 years, ELDER rungs included, and that erosion is present
 * with or without this change. `seatsAtRank` returns ZERO seats for the top
 * rung on purpose - the head is a succession rather than a promotion - and
 * nothing routes a post whose holder died to anybody. See the report.
 */
import { writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { isElderRank } from '../src/engine/cultivation/leadership.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,afford-c,roster-d,roster-e').split(',');
const DECAY_SEEDS = (process.env.PROBE_DECAY_SEEDS ?? 'afford-a,afford-b').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '25,100').split(',').map(Number);
const OUT = process.env.PROBE_OUT ?? 'arm';
const DIR = process.env.PROBE_DIR
    ?? 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';

interface ElderRow {
    factionId: string;
    rung: number;
    rankTitle: string;
    id: string;
    name: string;
    curated: boolean;
    realmOrdinal: number;
}

interface Reading {
    houses: number;
    rolls: number[];
    slots: number;
    filled: number;
    emptyByRung: number[];
    /** Rank slots on an elder rung, and how many of them anybody stands on. */
    officeSlots: number;
    officeFilled: number;
    elders: ElderRow[];
    power: [string, number][];
    order: string[];
    living: number;
}

function read(state: WorldState): Reading {
    const living = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const bucket = living.get(npc.factionId);
        if (bucket) bucket.push(npc); else living.set(npc.factionId, [npc]);
    }
    const out: Reading = {
        houses: 0, rolls: [], slots: 0, filled: 0, emptyByRung: new Array(10).fill(0),
        officeSlots: 0, officeFilled: 0, elders: [], power: [], order: [],
        living: state.npcs.filter(n => n.status === 'alive').length
    };
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        if (faction.seatLocationId === null) continue;
        const roll = living.get(faction.id) ?? [];
        if (roll.length === 0) continue;
        out.houses++;
        out.rolls.push(roll.length);
        const held = new Set(roll.map(p => p.factionRankIndex));
        const ladder = faction.ranks.length;
        out.slots += ladder;
        for (let r = 0; r < ladder; r++) {
            if (held.has(r)) out.filled++;
            else if (r < out.emptyByRung.length) out.emptyByRung[r]++;
            if (isElderRank(r, ladder)) {
                out.officeSlots++;
                if (held.has(r)) out.officeFilled++;
            }
        }
        for (const p of roll) {
            if (!isElderRank(p.factionRankIndex, ladder)) continue;
            out.elders.push({
                factionId: faction.id,
                rung: p.factionRankIndex,
                rankTitle: faction.ranks[p.factionRankIndex] ?? '',
                id: p.id,
                name: p.name,
                curated: p.tags.some(t => t.startsWith('catalog:')),
                realmOrdinal: p.cultivation.realmOrdinal
            });
        }
        out.power.push([faction.id, Number(faction.resources.power_ordinal ?? -1)]);
    }
    out.rolls.sort((a, b) => a - b);
    out.elders.sort((a, b) => a.factionId.localeCompare(b.factionId) || a.id.localeCompare(b.id));
    out.power.sort((a, b) => a[0].localeCompare(b[0]));
    out.order = [...out.power].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id);
    return out;
}

function quantile(sorted: readonly number[], q: number): number {
    if (sorted.length === 0) return 0;
    const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
    return sorted[at]!;
}

function say(label: string, r: Reading): void {
    const mean = (xs: readonly number[]) => xs.reduce((s, n) => s + n, 0) / Math.max(1, xs.length);
    console.log(
        `  ${label.padEnd(16)} houses ${String(r.houses).padStart(2)} living ${String(r.living).padStart(4)}  `
        + `rank slots filled ${r.filled}/${r.slots}  empty by rung [${r.emptyByRung.slice(0, 7).join(',')}]  `
        + `elder rungs filled ${r.officeFilled}/${r.officeSlots}  elders ${r.elders.length}`
    );
    console.log(
        `  ${' '.repeat(16)} roll: min ${r.rolls[0]} p10 ${quantile(r.rolls, 0.1)} MED ${quantile(r.rolls, 0.5)} `
        + `p90 ${quantile(r.rolls, 0.9)} max ${r.rolls[r.rolls.length - 1]} mean ${mean(r.rolls).toFixed(1)}  `
        + `under 5 ${r.rolls.filter(n => n < 5).length}  10-20 ${r.rolls.filter(n => n >= 10 && n <= 20).length}`
    );
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const dump: Record<string, Reading> = {};

    let slots = 0;
    let filled = 0;
    const empty = new Array(10).fill(0);
    for (const seed of SEEDS) {
        const { state } = seedWorld({ seed, catalog });
        const r = read(state);
        dump[`open:${seed}`] = r;
        slots += r.slots; filled += r.filled;
        r.emptyByRung.forEach((n, i) => { empty[i] += n; });
        console.log(seed);
        say('world open', r);
        console.log('');
    }
    console.log(`WORLD OPEN over ${SEEDS.length} seeds: rank slots filled ${filled}/${slots} `
        + `(${slots - filled} empty), empty by rung [${empty.slice(0, 7).join(',')}]`);
    console.log('');

    for (const seed of DECAY_SEEDS) {
        const { state } = seedWorld({ seed, catalog });
        console.log(`${seed} over time`);
        say('@0y', read(state));
        let at = 0;
        for (const horizon of HORIZONS) {
            advanceWorldYears(state, horizon - at, { stopOnInterrupt: false });
            at = horizon;
            const r = read(state);
            dump[`y${horizon}:${seed}`] = r;
            say(`@${horizon}y`, r);
        }
        console.log('');
    }

    const path = `${DIR}/house-middle-${OUT}.json`;
    writeFileSync(path, JSON.stringify(dump, null, 1), 'utf8');
    console.log(`wrote ${path}`);
}

void main();
