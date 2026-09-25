/**
 * Does taking work off the board move merit, and what does it do to the ladder?
 *
 * The arms were taken in one process off temporary switches, since removed; the
 * figures are in `a-disciple-takes-work-off-the-board.ts` and
 * `what-a-house-gives-merit-for.ts`. Per seed, at each horizon:
 *
 *   outer >=100 / >0   share of living rung-0 members of live houses whose
 *                      merit with their house is at least 100, and above 0
 *   held back          living people carrying a held-back tag
 *   walk-outs          people who left a live roll with a `walked-out:` tag,
 *                      per century, by where they stood
 *   elders per house   living elder-rung members over live seated houses
 *   above 29/35/41     living people below the Lid, not beasts
 *   empty elder rung   live seated houses with an elder rung nobody holds
 *   ranks              living members by rung index, summed
 *   goods              material and pill rows, by holder and tracked grade
 *   turn-ins           turn-in facts and their merit, per century, and the
 *                      promotions a century whose merit gate the turn-in merit
 *                      was needed to clear
 *
 * Run: npx tsx scripts/probe-do-disciples-take-work-off-the-board.ts
 *   PROBE_SEEDS  PROBE_YEARS (horizons)  PROBE_ARM (a label)  PROBE_OUT
 */
import { writeFileSync, appendFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { isElderRank } from '../src/engine/cultivation/leadership.js';
import { theSpeciesItIs } from '../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { whereTheyAreHeldBack } from '../src/engine/world/being-held-back-in-a-house.js';
import { meritWith } from '../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { meritNeededFor } from '../src/engine/world/promotion-inside-a-house.js';
import { howAGradeIsStored } from '../src/engine/world/possessions.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'shape-a,afford-a,demography').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '100,300,500').split(',').map(Number);
const ARMS = [{ name: process.env.PROBE_ARM ?? 'now' }];
const OUT = process.env.PROBE_OUT ?? 'board';
const DIR = 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';
const LOG = `${DIR}/probe-${OUT}.log`;

type Where = 'bottom' | 'middle' | 'elder';

function read(state: WorldState) {
    const houses = state.factions.filter(f => f.dissolvedOnDay === null && f.seatLocationId !== null && isBelowTheLid(f));
    let elders = 0, emptyElderRung = 0, outer = 0, outer100 = 0, outerAny = 0;
    const ranks: Record<number, number> = {};
    for (const house of houses) {
        const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
        const n = house.ranks.length;
        elders += roll.filter(m => isElderRank(m.factionRankIndex, n)).length;
        for (let r = 0; r < n; r++) {
            if (!isElderRank(r, n)) continue;
            if (!roll.some(m => m.factionRankIndex === r)) { emptyElderRung++; break; }
        }
        for (const m of roll) {
            ranks[m.factionRankIndex] = (ranks[m.factionRankIndex] ?? 0) + 1;
            if (m.factionRankIndex !== 0) continue;
            outer++;
            const merit = meritWith(m, house.id);
            if (merit >= 100) outer100++;
            if (merit > 0) outerAny++;
        }
    }
    const ords = state.npcs
        .filter(n => n.status === 'alive' && isBelowTheLid(n) && theSpeciesItIs(n) === null)
        .map(n => n.cultivation.realmOrdinal);
    return {
        houses: houses.length,
        eldersPerHouse: Number((elders / Math.max(1, houses.length)).toFixed(2)),
        emptyElderRung,
        outer,
        outer100: Number((outer100 / Math.max(1, outer)).toFixed(3)),
        outerAny: Number((outerAny / Math.max(1, outer)).toFixed(3)),
        heldBack: state.npcs.filter(n => n.status === 'alive' && whereTheyAreHeldBack(n) !== null).length,
        over29: ords.filter(o => o > 29).length,
        over35: ords.filter(o => o > 35).length,
        over41: ords.filter(o => o > 41).length,
        onBoardWork: state.npcs.filter(n => n.status === 'alive' && n.tags.some(t => t.startsWith('board-work|'))).length,
        goods: goodsIn(state),
        ranks
    };
}

/** Material and pill rows in the world, by who holds them and whether their grade is tracked. */
function goodsIn(state: WorldState) {
    const out = { houseTracked: 0, houseCounted: 0, peopleTracked: 0, peopleCounted: 0, groundTracked: 0, groundCounted: 0, fromRuins: 0 };
    const houses = new Set(state.factions.map(f => f.id));
    for (const o of state.objects) {
        if (o.kind !== 'material' && o.kind !== 'pill') continue;
        const grade = String(o.data.grade ?? o.tags.find(t => t.startsWith('grade:'))?.slice(6) ?? 'mortal');
        const tracked = ['heaven', 'immortal', 'chaos'].includes(grade) && howAGradeIsStored(grade as 'heaven') === 'tracked';
        if (o.id.includes('-goods-')) out.fromRuins++;
        const where = o.ownerId === null ? 'ground' : houses.has(o.ownerId) ? 'house' : 'people';
        const key = `${where}${tracked ? 'Tracked' : 'Counted'}` as keyof typeof out;
        out[key]++;
    }
    return out;
}

function say(line: string): void {
    console.log(line);
    appendFileSync(LOG, `${line}\n`, 'utf8');
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const dump: Record<string, unknown> = {};
    writeFileSync(LOG, '', 'utf8');
    for (const seed of SEEDS) {
        for (const arm of ARMS) {
            const turnedInBy = new Map<string, number>();
            const seenFacts = new Set<string>();
            let turnIns = 0, turnInMerit = 0, promotions = 0, promotionsFromTurnIns = 0;
            const started = Date.now();
            const { state } = seedWorld({ seed, catalog });
            say(`${arm.name} ${seed} @0 ${JSON.stringify(read(state))}`);
            const walked: Record<Where, number> = { bottom: 0, middle: 0, elder: 0 };
            let y = 0;
            for (const horizon of HORIZONS) {
                for (; y < horizon; y++) {
                    const before = new Map(state.npcs
                        .filter(n => n.status === 'alive' && n.factionId !== null)
                        .map(n => [n.id, {
                            rank: n.factionRankIndex,
                            ranks: state.factions.find(f => f.id === n.factionId)?.ranks.length ?? 0
                        }] as const));
                    advanceWorldYears(state, 1, { stopOnInterrupt: false });
                    for (const f of state.history.facts) {
                        if (f.data?.turnedIn !== true || seenFacts.has(f.id)) continue;
                        seenFacts.add(f.id);
                        const who = f.actors[0]?.id;
                        const merit = Number(f.data.merit ?? 0);
                        turnIns++;
                        turnInMerit += merit;
                        if (who) turnedInBy.set(who, (turnedInBy.get(who) ?? 0) + merit);
                    }
                    for (const n of state.npcs) {
                        const was = before.get(n.id);
                        if (!was || n.status !== 'alive' || n.factionId === null || n.factionRankIndex <= was.rank) continue;
                        promotions++;
                        const fromTurnIns = turnedInBy.get(n.id) ?? 0;
                        if (fromTurnIns > 0 && meritWith(n, n.factionId) - fromTurnIns < meritNeededFor(n.factionRankIndex)) {
                            promotionsFromTurnIns++;
                        }
                    }
                    for (const n of state.npcs) {
                        const was = before.get(n.id);
                        if (!was || n.factionId !== null) continue;
                        if (!n.tags.some(t => t.startsWith('walked-out:')) || n.updatedOnDay < state.currentDay - 365) continue;
                        const where: Where = isElderRank(was.rank, was.ranks) ? 'elder' : was.rank <= 0 ? 'bottom' : 'middle';
                        walked[where]++;
                    }
                }
                const r = {
                    ...read(state),
                    walkedPerCentury: {
                        bottom: Number((walked.bottom * 100 / horizon).toFixed(1)),
                        middle: Number((walked.middle * 100 / horizon).toFixed(1)),
                        elder: Number((walked.elder * 100 / horizon).toFixed(1))
                    },
                    turnInsPerCentury: Number((turnIns * 100 / horizon).toFixed(1)),
                    turnInMeritPerCentury: Math.round(turnInMerit * 100 / horizon),
                    promotionsPerCentury: Number((promotions * 100 / horizon).toFixed(1)),
                    promotionsFromTurnInsPerCentury: Number((promotionsFromTurnIns * 100 / horizon).toFixed(1)),
                    minutes: Number(((Date.now() - started) / 60000).toFixed(1))
                };
                dump[`${arm.name}:y${horizon}:${seed}`] = r;
                say(`${arm.name} ${seed} @${horizon} ${JSON.stringify(r)}`);
                writeFileSync(`${DIR}/probe-${OUT}.json`, JSON.stringify(dump, null, 1), 'utf8');
            }
        }
    }
}
void main();
