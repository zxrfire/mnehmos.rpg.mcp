/**
 * How many elders a house seats, and how many of them run a room.
 *
 * `rosterByRung` capped the ELDER RUNG's population at a constant, which caps
 * the RANK. The design owner: *"don't cap the elder rank at 3"*, *"cap the
 * elder with offices rank at the # of offices"*. An elder is a rank and it is
 * not slot-limited; an office is an elder with a posting, and postings are
 * finite.
 *
 * So there are two numbers and they are different, and this measures both
 * beside each other:
 *
 *   elders          everybody standing on an elder rung. Uncapped, and it
 *                   should read like a band: what the slice gives it.
 *   offices         office rooms the house ACTUALLY HAS, off
 *                   `theRoomsThisHouseHas` - the same reader
 *                   `whoIsInChargeOfWhat` is handed.
 *   with an office  distinct holders `whoIsInChargeOfWhat` returns. This is the
 *                   one that must not exceed `offices`.
 *   surplus         elders - with an office. An elder without a room is the
 *                   outcome the doc names, not an error.
 *
 * And three things that must not move, because moving them is a bigger change
 * than the one this probe is for:
 *
 *   elders by name  everybody on an elder rung, so nobody may stop being one.
 *   power_ordinal   per house, and the standing order it produces.
 *   the roll        living count per house.
 *
 * THE AGGREGATE IS THE OTHER HALF. The design owner: *"while the sects are a
 * vertical slice, adding it all up still makes a pyramid"*. So a per-house
 * taper that is steeply pyramidal applies the shape twice. This prints the
 * per-house distribution AND the world total by rung, because the second is
 * what says whether the aggregate is still bottom-heavy once the slice flattens.
 *
 * TWO ARMS, TWO RUNS. There is no switch on the shape of a ladder, so the
 * control arm is this same script run on the tree before the change:
 *
 *   PROBE_OUT=before npx tsx scripts/probe-how-many-elders-a-house-can-seat.ts
 *   ...change rosterByRung...
 *   PROBE_OUT=after  npx tsx scripts/probe-how-many-elders-a-house-can-seat.ts
 */
import { writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { isElderRank, elderRungOf } from '../src/engine/cultivation/leadership.js';
import { roomAuthorityOf } from '../src/engine/world/architecture.js';
import { theRoomsThisHouseHas } from '../src/engine/social-leverage/authority-for-an-order.js';
import { whoIsInChargeOfWhat } from '../src/engine/social-leverage/what-an-elder-is-in-charge-of.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,afford-c,roster-d,roster-e').split(',');
const OUT = process.env.PROBE_OUT ?? 'arm';
const DIR = process.env.PROBE_DIR
    ?? 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';

interface HouseRow {
    factionId: string;
    ladder: number;
    roll: number;
    elderRung: number;
    /** People per rung, bottom first. */
    byRung: number[];
    elders: number;
    offices: number;
    withAnOffice: number;
    surplus: number;
    power: number;
}

interface ElderRow {
    factionId: string;
    rung: number;
    id: string;
    curated: boolean;
    realmOrdinal: number;
}

interface Reading {
    houses: HouseRow[];
    elders: ElderRow[];
    order: string[];
    living: number;
    /** Everybody in the world at each rung index, summed across houses. */
    worldByRung: number[];
    /**
     * Every person on a roll and the rung they stand on.
     *
     * Here because the elder list alone cannot tell a DEMOTION from a person
     * the other arm never seeded: a synthetic id is positional, so a house that
     * raises one fewer drops an id rather than a rank, and reading that as
     * "stopped being an elder" would report a regression that did not happen.
     */
    roll: [string, string, number][];
}

function read(state: WorldState): Reading {
    const living = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const bucket = living.get(npc.factionId);
        if (bucket) bucket.push(npc); else living.set(npc.factionId, [npc]);
    }

    const out: Reading = {
        houses: [], elders: [], order: [],
        living: state.npcs.filter(n => n.status === 'alive').length,
        worldByRung: new Array(10).fill(0),
        roll: []
    };

    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        if (faction.seatLocationId === null) continue;
        const roll = living.get(faction.id) ?? [];
        if (roll.length === 0) continue;

        const ladder = faction.ranks.length;
        const byRung = new Array<number>(ladder).fill(0);
        for (const p of roll) {
            if (p.factionRankIndex >= 0 && p.factionRankIndex < ladder) byRung[p.factionRankIndex]++;
            if (p.factionRankIndex >= 0 && p.factionRankIndex < out.worldByRung.length) {
                out.worldByRung[p.factionRankIndex]++;
            }
        }

        for (const p of roll) out.roll.push([faction.id, p.id, p.factionRankIndex]);

        const onAnElderRung = roll.filter(p => isElderRank(p.factionRankIndex, ladder));
        for (const p of onAnElderRung) {
            out.elders.push({
                factionId: faction.id,
                rung: p.factionRankIndex,
                id: p.id,
                curated: p.tags.some(t => t.startsWith('catalog:')),
                realmOrdinal: p.cultivation.realmOrdinal
            });
        }

        // The office count, off the rooms the house actually has. This is the
        // same reader `whoIsInChargeOfWhat` is handed everywhere else, so the
        // number here is the number the deal uses.
        const rooms = theRoomsThisHouseHas(state.locations, faction.id);
        const offices = rooms.filter(p => roomAuthorityOf(p).office).length;

        const portfolios = whoIsInChargeOfWhat({
            rooms,
            roll: roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
            rankCount: ladder
        });
        const holders = new Set(
            portfolios.map(p => p.holderId).filter((id): id is string => id !== null)
        );

        out.houses.push({
            factionId: faction.id,
            ladder,
            roll: roll.length,
            elderRung: elderRungOf(ladder),
            byRung,
            elders: onAnElderRung.length,
            offices,
            withAnOffice: holders.size,
            surplus: onAnElderRung.length - holders.size,
            power: Number(faction.resources.power_ordinal ?? -1)
        });
    }

    out.houses.sort((a, b) => a.factionId.localeCompare(b.factionId));
    out.roll.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    out.elders.sort((a, b) => a.factionId.localeCompare(b.factionId) || a.id.localeCompare(b.id));
    out.order = [...out.houses]
        .sort((a, b) => b.power - a.power || a.factionId.localeCompare(b.factionId))
        .map(h => h.factionId);
    return out;
}

function histogram(values: readonly number[]): string {
    const counts = new Map<number, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([v, n]) => `${v}:${n}`)
        .join(' ');
}

function say(seed: string, r: Reading): void {
    const elders = r.houses.reduce((s, h) => s + h.elders, 0);
    const offices = r.houses.reduce((s, h) => s + h.offices, 0);
    const held = r.houses.reduce((s, h) => s + h.withAnOffice, 0);
    const over = r.houses.filter(h => h.withAnOffice > h.offices);
    const short = r.houses.filter(h => h.elders < h.offices);
    console.log(seed);
    console.log(
        `  houses ${r.houses.length}  living ${r.living}  elders ${elders}  `
        + `offices ${offices}  with an office ${held}  surplus ${elders - held}`
    );
    console.log(`  elders per house      ${histogram(r.houses.map(h => h.elders))}`);
    console.log(`  offices per house     ${histogram(r.houses.map(h => h.offices))}`);
    console.log(`  with an office        ${histogram(r.houses.map(h => h.withAnOffice))}`);
    console.log(`  surplus elders        ${histogram(r.houses.map(h => h.surplus))}`);
    console.log(`  roll per house        ${histogram(r.houses.map(h => h.roll))}`);
    console.log(`  WORLD TOTAL by rung   [${r.worldByRung.slice(0, 8).join(',')}]`);
    console.log(
        `  holders over offices  ${over.length}`
        + `  houses with fewer elders than offices ${short.length}`
        + (short.length > 0
            ? ` (${short.slice(0, 6).map(h => `${h.factionId} ${h.elders}/${h.offices}`).join(', ')})`
            : '')
    );
    console.log('');
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const dump: Record<string, Reading> = {};
    const worldTotal = new Array(10).fill(0);

    for (const seed of SEEDS) {
        const { state } = seedWorld({ seed, catalog });
        const r = read(state);
        dump[`open:${seed}`] = r;
        r.worldByRung.forEach((n, i) => { worldTotal[i] += n; });
        say(seed, r);
    }

    console.log(`WORLD TOTAL by rung over ${SEEDS.length} seeds: [${worldTotal.slice(0, 8).join(',')}]`);
    const sum = worldTotal.reduce((s, n) => s + n, 0);
    console.log(`  as a share: [${worldTotal.slice(0, 8).map(n => (n / Math.max(1, sum)).toFixed(3)).join(',')}]`);
    const descending = worldTotal.slice(0, 8).every((n, i, xs) => i === 0 || n <= xs[i - 1]!);
    console.log(`  monotonically bottom-heavy: ${descending}`);
    console.log('');

    const path = `${DIR}/elders-and-offices-${OUT}.json`;
    writeFileSync(path, JSON.stringify(dump, null, 1), 'utf8');
    console.log(`wrote ${path}`);
}

void main();
