/**
 * Do the world's own people join a house the way a player does, and what does
 * that do to the houses?
 *
 * Per seed, per century, over the world's own people (the player's row is not in
 * these worlds):
 *
 *   joins            people onto a roll they were not on the year before, split
 *                    by who they are: newborns (a year old on the roll), taken
 *                    back from fostering, raised by their own house, and everyone
 *                    else (the recruitment pass)
 *   roll             alive members per live house that takes people, median
 *                    and the smallest tenth
 *   short            live catalog houses whose roll is under what is worth
 *                    modelling (`aRollWorthModelling`)
 *   fallen           catalog houses dissolved so far
 *   on sect ground   share of the living standing on a seat
 *
 * Run: npx tsx scripts/probe-do-npcs-join-the-way-a-player-does.ts
 *      PROBE_OUT names the arm.
 */
import { writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { getSect } from '../src/data/cultivation/sects.js';
import { aRollWorthModelling } from '../src/engine/world/a-house-raises-its-own.js';
import { npcsAt, type WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'demography,afford-a,afford-b,roster-d').split(',');
const CENTURIES = Number(process.env.PROBE_CENTURIES ?? 3);
const OUT = process.env.PROBE_OUT ?? 'arm';
const DIR = process.env.PROBE_DIR
    ?? 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';

function quantile(xs: number[], q: number): number {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.round((s.length - 1) * q))]!;
}

function houses(state: WorldState, day: number) {
    const count = new Map<string, number>();
    for (const n of state.npcs) {
        if (n.status !== 'alive' || !n.factionId) continue;
        count.set(n.factionId, (count.get(n.factionId) ?? 0) + 1);
    }
    const rolls: number[] = [];
    let short = 0;
    let fallen = 0;
    for (const f of state.factions) {
        const cf = getSect(f.id);
        if (f.dissolvedOnDay !== null) { if (cf) fallen++; continue; }
        if (!f.tags.includes('recruits')) continue;
        const here = count.get(f.id) ?? 0;
        rolls.push(here);
        if (!cf) continue;
        const worth = aRollWorthModelling({
            rankCount: f.ranks.length, powerOrdinal: cf.powerOrdinal, admissionOrdinal: cf.admissionOrdinal,
            recruits: cf.recruits,
            yearsStanding: f.foundedOnDay === null ? Number.POSITIVE_INFINITY : (day - f.foundedOnDay) / 365
        });
        if (here < worth) short++;
    }
    let onSeat = 0;
    for (const l of state.locations) if (l.kind === 'sect_seat') onSeat += npcsAt(state, l.id).length;
    const alive = state.npcs.filter(n => n.status === 'alive').length;
    return {
        liveRecruiting: rolls.length, rollMedian: quantile(rolls, 0.5), rollP10: quantile(rolls, 0.1),
        short, fallen, onSectGround: +(onSeat / Math.max(1, alive)).toFixed(3), alive
    };
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const dump: Record<string, unknown> = {};
    for (const seed of SEEDS) {
        const { state } = seedWorld({ seed, catalog });
        const t0 = Date.now();
        for (let c = 1; c <= CENTURIES; c++) {
            const joins = { newborn: 0, fosterReturn: 0, raised: 0, recruited: 0 };
            for (let y = 0; y < 100; y++) {
                const before = new Map(state.npcs.map(n => [n.id, n.factionId]));
                advanceWorldYears(state, 1, { stopOnInterrupt: false });
                for (const n of state.npcs) {
                    if (n.status !== 'alive' || !n.factionId) continue;
                    const was = before.get(n.id);
                    if (was === n.factionId) continue;
                    if (was === undefined) {
                        if (n.tags.some(t => t.startsWith('raised:'))) joins.raised++;
                        else joins.newborn++;
                    } else if (n.tags.some(t => t.startsWith('assessed:returned'))) joins.fosterReturn++;
                    else joins.recruited++;
                }
            }
            const row = { joins, ...houses(state, state.currentDay) };
            dump[`${seed}@${c * 100}`] = row;
            console.log(seed, c * 100, JSON.stringify(row), `${Math.round((Date.now() - t0) / 1000)}s`);
            writeFileSync(`${DIR}/probe-npc-join-${OUT}.json`, JSON.stringify(dump, null, 2));
        }
    }
}

main().catch(e => { console.error(e); process.exit(1); });
