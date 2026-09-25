/**
 * Where the middle of a house is stuck: seats or merit, rung by rung.
 *
 * The world as it runs, board work on. Per rung index (0 is the bottom), pooled
 * over the seeds and read every year to the horizon:
 *
 *   held back          people carrying a held-back tag at that rung, averaged
 *                      over samples every 50 years from year 100, by reason
 *   merit short        for `not_enough_merit`, the rung's price minus what they
 *                      hold (median, p90), and that gap in years at the board
 *                      pay a board worker on that rung actually drew
 *   merit a year       per person-year on the rung, by source: board work
 *                      (the settled terms on a closing `board-work|` tag),
 *                      sendings and postings (a closing away term, priced by
 *                      `whatServiceIsWorth`), turn-ins (the fact's own merit),
 *                      and the rest, which is teaching and anything else
 *   wait               years at a rung before promotion out of it, for people
 *                      seen arriving at it (median, p90)
 *   walk-outs          per century, by the rung left from
 *
 * Rung indices mix houses with six and seven rungs; `elder share` says how much
 * of a rung's population stood on an elder rung of their own house.
 *
 * Run: npx tsx scripts/probe-where-the-middle-of-a-house-is-stuck.ts
 *   PROBE_SEEDS  PROBE_YEARS (horizon)
 */
import { writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isElderRank } from '../src/engine/cultivation/leadership.js';
import { whereTheyAreHeldBack } from '../src/engine/world/being-held-back-in-a-house.js';
import { meritWith, whatServiceIsWorth } from '../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { meritNeededFor } from '../src/engine/world/promotion-inside-a-house.js';
import { theBoardWorkTheyAreOn } from '../src/engine/world/a-disciple-takes-work-off-the-board.js';
import { isAwayOnSomething, type NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'shape-a,afford-a,demography').split(',');
const YEARS = Number(process.env.PROBE_YEARS ?? 500);
const DIR = 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';
const RUNGS = 7;

const row = () => ({
    heldSamples: 0,
    held: {} as Record<string, number>,
    shortBy: [] as number[],
    personYears: 0,
    elderPersonYears: 0,
    board: 0, sendings: 0, turnIns: 0, rest: 0,
    boardPaidYears: 0,
    waits: [] as number[],
    walked: 0
});
const rungs = Array.from({ length: RUNGS }, row);
let samples = 0;

function quantile(xs: number[], q: number): number | null {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]!;
}

function ranksOf(state: WorldState, npc: NpcRecord): number {
    return state.factions.find(f => f.id === npc.factionId)?.ranks.length ?? 0;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    for (const seed of SEEDS) {
        const { state } = seedWorld({ seed, catalog });
        const arrivedOnRung = new Map<string, { rank: number; day: number | null }>();
        for (const n of state.npcs) {
            if (n.status === 'alive' && n.factionId !== null) arrivedOnRung.set(n.id, { rank: n.factionRankIndex, day: null });
        }
        const seenFacts = new Set(state.history.facts.map(f => f.id));

        for (let y = 1; y <= YEARS; y++) {
            const before = new Map(state.npcs
                .filter(n => n.status === 'alive' && n.factionId !== null && n.factionRankIndex >= 0)
                .map(n => [n.id, {
                    house: n.factionId!, rank: n.factionRankIndex, ranks: ranksOf(state, n),
                    merit: meritWith(n, n.factionId), ordinal: n.cultivation.realmOrdinal,
                    activity: n.activity, tags: n.tags
                }] as const));

            advanceWorldYears(state, 1, { stopOnInterrupt: false });
            const today = state.currentDay;

            const turnedIn = new Map<string, number>();
            for (const f of state.history.facts) {
                if (seenFacts.has(f.id)) continue;
                seenFacts.add(f.id);
                if (f.data?.turnedIn !== true) continue;
                const who = f.actors[0]?.id;
                if (who) turnedIn.set(who, (turnedIn.get(who) ?? 0) + Number(f.data.merit ?? 0));
            }

            for (const n of state.npcs) {
                const was = before.get(n.id);
                if (!was || was.rank >= RUNGS) continue;
                const r = rungs[was.rank]!;

                // Walked out of the house this year, from the rung they stood on.
                if (n.factionId === null && n.tags.some(t => t.startsWith('walked-out:')) && n.updatedOnDay >= today - 365) {
                    r.walked++;
                    continue;
                }
                if (n.status !== 'alive' || n.factionId !== was.house) continue;

                r.personYears++;
                if (isElderRank(was.rank, was.ranks)) r.elderPersonYears++;
                const delta = meritWith(n, n.factionId) - was.merit;

                // What closed this year, off the activity they were on before it.
                let board = 0, sendings = 0;
                const doing = was.activity;
                const closed = doing !== null && doing.untilDay != null && doing.untilDay <= today
                    && (n.activity === null || n.activity.sinceDay !== doing.sinceDay || n.activity.kind !== doing.kind);
                if (closed) {
                    const terms = theBoardWorkTheyAreOn({ tags: was.tags }, doing.untilDay);
                    if (terms !== null) board = terms.contribution;
                    else if (isAwayOnSomething(doing.kind) && doing.kind !== 'travelling') {
                        sendings = Math.round(whatServiceIsWorth(was.ordinal, doing.untilDay! - doing.sinceDay));
                    }
                }
                const turnIn = turnedIn.get(n.id) ?? 0;
                r.board += board;
                if (board > 0) r.boardPaidYears++;
                r.sendings += sendings;
                r.turnIns += turnIn;
                r.rest += Math.max(0, delta - board - sendings - turnIn);

                // Promoted out of this rung.
                const arrival = arrivedOnRung.get(n.id);
                if (n.factionRankIndex > was.rank) {
                    if (arrival && arrival.rank === was.rank && arrival.day !== null) {
                        r.waits.push((today - arrival.day) / 365);
                    }
                    arrivedOnRung.set(n.id, { rank: n.factionRankIndex, day: today });
                } else if (!arrival || arrival.rank !== n.factionRankIndex) {
                    arrivedOnRung.set(n.id, { rank: n.factionRankIndex, day: today });
                }
            }
            // Joined this year: arrival seen.
            for (const n of state.npcs) {
                if (n.status === 'alive' && n.factionId !== null && !arrivedOnRung.has(n.id)) {
                    arrivedOnRung.set(n.id, { rank: n.factionRankIndex, day: today });
                }
            }

            if (y >= 100 && y % 50 === 0) {
                samples++;
                for (const n of state.npcs) {
                    if (n.status !== 'alive' || n.factionId === null) continue;
                    const held = whereTheyAreHeldBack(n);
                    if (held === null || held.atRank < 0 || held.atRank >= RUNGS) continue;
                    const r = rungs[held.atRank]!;
                    r.held[held.reason] = (r.held[held.reason] ?? 0) + 1;
                    if (held.reason === 'not_enough_merit') {
                        r.shortBy.push(meritNeededFor(held.atRank + 1) - meritWith(n, n.factionId));
                    }
                }
            }
        }
        console.log(`${seed} done`);
    }

    const out: string[] = [];
    const reasons = ['no_seat', 'outranked', 'not_yet', 'not_enough_merit', 'no_room_without_office'];
    out.push(`Seeds ${SEEDS.join(', ')}; ${YEARS} years; board work on. Held back is the mean per sample (${samples} samples, every 50 years from 100, summed over seeds).`);
    out.push('');
    out.push('| rung | people (mean) | elder share | held back: ' + reasons.join(' / ') + ' | merit short, median / p90 | years of board pay | merit a person-year: board / sendings+postings / turn-ins / teaching+other | board pay a paid year | wait before promotion, median / p90 years (n) | walk-outs a century |');
    out.push('|---|---|---|---|---|---|---|---|---|---|');
    for (let i = 0; i < RUNGS; i++) {
        const r = rungs[i]!;
        if (r.personYears === 0) continue;
        const py = r.personYears;
        const perSample = (k: string) => ((r.held[k] ?? 0) / Math.max(1, samples)).toFixed(1);
        const boardPay = r.boardPaidYears > 0 ? r.board / r.boardPaidYears : 0;
        const med = quantile(r.shortBy, 0.5), p90 = quantile(r.shortBy, 0.9);
        const yrs = (x: number | null) => x === null || boardPay === 0 ? '-' : (x / boardPay).toFixed(1);
        const wm = quantile(r.waits, 0.5), w90 = quantile(r.waits, 0.9);
        out.push(`| ${i} | ${(py / YEARS).toFixed(0)} | ${(r.elderPersonYears / py * 100).toFixed(0)}% | `
            + `${reasons.map(perSample).join(' / ')} | ${med ?? '-'} / ${p90 ?? '-'} | ${yrs(med)} / ${yrs(p90)} | `
            + `${(r.board / py).toFixed(1)} / ${(r.sendings / py).toFixed(1)} / ${(r.turnIns / py).toFixed(1)} / ${(r.rest / py).toFixed(1)} | `
            + `${boardPay.toFixed(0)} | ${wm === null ? '-' : wm.toFixed(0)} / ${w90 === null ? '-' : w90.toFixed(0)} (${r.waits.length}) | `
            + `${(r.walked * 100 / YEARS).toFixed(1)} |`);
    }
    const text = out.join('\n');
    console.log(text);
    writeFileSync(`${DIR}/probe-where-the-middle-is-stuck.md`, text, 'utf8');
    writeFileSync(`${DIR}/probe-where-the-middle-is-stuck.json`, JSON.stringify(rungs, null, 1), 'utf8');
}
void main();
