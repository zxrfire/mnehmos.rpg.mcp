/**
 * Is the rank block a closed loop, or merely a narrow door?
 *
 * Three quarters of everybody stuck in this world is stuck on rank: their house
 * shelves a book that would carry them further, they can read it, their root
 * does not fight it, and their rank does not reach far enough up the shelf for
 * it to be handed over. The account that would make that a DEADLOCK is:
 *
 *     you need the book to reach the rung, and the rung to be given the book
 *
 * That has to be established rather than assumed, because a bottleneck and a
 * deadlock want completely different fixes. Two things separate them.
 *
 * THE STRUCTURAL TEST, which needs no individual. For each rank of each house,
 * compare the promotion bar against the deepest book somebody at the rank BELOW
 * can actually be given. If the bar is higher than that cap, nobody at that rank
 * can ever qualify by cultivating, and the loop is closed by arithmetic. If the
 * bar is at or under it, the door is open and the question is only how many get
 * through it.
 *
 * THE POPULATION TEST. `assessPromotions` only records `blocked` for people who
 * ALREADY MEET THE BAR - candidates are filtered on realmOrdinal >= bar before
 * anything else - so somebody below the bar appears in no list at all. The two
 * populations are completely different problems:
 *
 *     qualified, no seat   the house is full. A death opens it.
 *     below the bar        they cannot climb to it. Nothing opens it.
 *
 * Run: npx tsx scripts/probe-is-the-rank-block-a-deadlock.ts [years]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import {
    shelfOf, shelfReach, suitsRoot, reachableCeilingFor, manualCeilingOf, BOOKLESS_CEILING
} from '../src/engine/world/manuals.js';
import {
    assessPromotions, seatsAtRank, abundanceOf, ordinalExpectedAt
} from '../src/engine/world/promotion-inside-a-house.js';
import { rankRealmBand } from '../src/data/cultivation/members.js';

const YEARS = Number(process.argv[2] ?? 300);
const catalog = await loadCultivationCatalog();

/** `barFor` is private to the promotion module; this is the same two lines. */
function barFor(
    factionId: string, rankIndex: number, rankCount: number,
    admission: number, power: number
): number {
    return rankRealmBand(factionId, rankIndex)?.minOrdinal
        ?? ordinalExpectedAt(rankIndex, rankCount, admission, power);
}

const { state } = seedWorld({ seed: 'deadlock', catalog });
const after = advanceWorldYears(state, YEARS).state as any;
const alive = (after.npcs as any[]).filter(n => n.status === 'alive');

// ── 1. THE STRUCTURAL TEST ──────────────────────────────────────────────
console.log('RANK STEPS WHERE THE BAR IS ABOVE ANYTHING THE RANK BELOW CAN BE GIVEN');
console.log('house                        r  bar  books  deepest');
console.log('-'.repeat(72));
let closed = 0;
let open = 0;
for (const house of after.factions as any[]) {
    if (house.dissolvedOnDay !== null) continue;
    const shelf = shelfOf(after, house.id);
    if (shelf.length === 0) continue;
    const rankCount = (house.ranks ?? []).length;
    if (rankCount < 2) continue;
    const admission = Number(house.resources.admission_ordinal ?? 0);
    const power = Number(house.resources.power_ordinal ?? admission);
    for (let r = 1; r <= rankCount - 1; r++) {
        const bar = barFor(house.id, r, rankCount, admission, power);
        const reach = shelfReach(r - 1, rankCount, shelf.length);
        const books = shelf.slice(0, reach);
        const deepest = books.length ? Math.max(...books.map(m => m.cap)) : BOOKLESS_CEILING;
        if (bar > deepest) {
            closed++;
            console.log(
                house.id.padEnd(28), String(r).padStart(2), String(bar).padStart(4),
                String(books.length).padStart(6), String(deepest).padStart(8)
            );
        } else {
            open++;
        }
    }
}
console.log(`\nrank steps arithmetically CLOSED: ${closed}`);
console.log(`rank steps open:                  ${open}`);

// ── 2. THE POPULATION TEST ──────────────────────────────────────────────
const { blocked } = assessPromotions(after);
const noSeatIds = new Set(blocked.filter(b => b.reason === 'no_seat').map(b => b.npcId));
const outrankedIds = new Set(blocked.filter(b => b.reason === 'outranked').map(b => b.npcId));

/** Stuck at ceiling, house has something deeper, rank does not reach it. */
function rankStuck(npc: any): boolean {
    const ordinal = npc.cultivation.realmOrdinal;
    const ceiling = reachableCeilingFor(after, npc) || BOOKLESS_CEILING;
    if (ceiling > ordinal) return false;
    if (manualCeilingOf(npc) === 0 || !npc.factionId) return false;
    const shelf = shelfOf(after, npc.factionId);
    if (shelf.filter(m => m.cap > ordinal).length === 0) return false;
    const house = (after.factions as any[]).find(f => f.id === npc.factionId);
    const rankCount = Math.max(1, house?.ranks.length ?? 1);
    const reach = npc.tags.includes('chosen')
        ? shelf.length
        : shelfReach(npc.factionRankIndex, rankCount, shelf.length);
    const within = shelf.slice(0, reach).filter(m => m.cap > ordinal);
    if (within.length === 0) return true;
    return within.some(m => suitsRoot(npc.cultivation.spiritRoot, m.element));
}

const stuck = alive.filter(rankStuck);
const band1320 = stuck.filter(n => n.cultivation.realmOrdinal >= 13 && n.cultivation.realmOrdinal <= 20);
console.log(`\nrank-stuck people: ${stuck.length}   in band 13-20: ${band1320.length}`);

let meetsBar = 0;
let belowBar = 0;
let atTop = 0;
const roomWhereQualified: string[] = [];
for (const npc of stuck) {
    const house = (after.factions as any[]).find(f => f.id === npc.factionId);
    if (!house) continue;
    const rankCount = Math.max(1, house.ranks.length);
    const next = npc.factionRankIndex + 1;
    if (next > rankCount - 1) { atTop++; continue; }
    const admission = Number(house.resources.admission_ordinal ?? 0);
    const power = Number(house.resources.power_ordinal ?? admission);
    const bar = barFor(house.id, next, rankCount, admission, power);
    if (npc.cultivation.realmOrdinal >= bar) {
        meetsBar++;
        const members = alive.filter(n => n.factionId === house.id);
        const seats = seatsAtRank(next, rankCount, members.length, abundanceOf(house));
        const sitting = members.filter(n => n.factionRankIndex === next).length;
        const room = seats === Number.MAX_SAFE_INTEGER ? 999 : Math.max(0, seats - sitting);
        roomWhereQualified.push(
            `${house.id} r${npc.factionRankIndex}->${next}: bar ${bar}, ord ` +
            `${npc.cultivation.realmOrdinal}, seats ${seats === Number.MAX_SAFE_INTEGER ? 'inf' : seats}, ` +
            `sitting ${sitting}, room ${room}` +
            (noSeatIds.has(npc.id) ? ', no_seat' : outrankedIds.has(npc.id) ? ', outranked' : ', NOT IN blocked')
        );
    } else {
        belowBar++;
    }
}
console.log(`   meet the bar for their next rank : ${meetsBar}`);
console.log(`   BELOW the bar                    : ${belowBar}`);
console.log(`   already at the top rank          : ${atTop}`);
console.log(`\nassessPromotions blocked totals: no_seat ${noSeatIds.size}, outranked ${outrankedIds.size}`);
for (const line of roomWhereQualified.slice(0, 20)) console.log(`   ${line}`);

// ── 3. HOW MANY ESCAPE, AND BY WHAT ROUTE ───────────────────────────────
// Re-run from the same seed and watch rank actually change, which is the only
// honest way to answer "does anybody get out" - a snapshot cannot.
console.log('\nDOES ANYBODY GET PROMOTED OUT OF BAND 13-20 OVER THE RUN?');
const fresh = seedWorld({ seed: 'deadlock', catalog }).state as any;
const rankAt0 = new Map<string, number>();
for (const n of fresh.npcs as any[]) rankAt0.set(n.id, n.factionRankIndex);
const ordAt0 = new Map<string, number>();
for (const n of fresh.npcs as any[]) ordAt0.set(n.id, n.cultivation.realmOrdinal);
const run = advanceWorldYears(fresh, YEARS).state as any;
let promoted = 0;
let demotedOrSame = 0;
let climbed = 0;
for (const n of run.npcs as any[]) {
    if (n.status !== 'alive') continue;
    const was = rankAt0.get(n.id);
    const wasOrd = ordAt0.get(n.id);
    if (was === undefined || wasOrd === undefined) continue;      // born during the run
    if (wasOrd < 13 || wasOrd > 20) continue;                     // not in the band at the start
    if (n.factionRankIndex > was) promoted++; else demotedOrSame++;
    if (n.cultivation.realmOrdinal > wasOrd) climbed++;
}
console.log(`  seeded people who began the run in band 13-20 and are still alive: ${promoted + demotedOrSame}`);
console.log(`    promoted at least one rank : ${promoted}`);
console.log(`    never promoted             : ${demotedOrSame}`);
console.log(`    gained at least one ordinal: ${climbed}`);
