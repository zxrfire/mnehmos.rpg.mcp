/**
 * Does a house keep its shape over a long time, and what moves people on and
 * off each rung of it?
 *
 * A census, not an assertion. Every year it diffs the roll of every live house
 * below the Lid and files each change under the thing that caused it: who came
 * onto a rung (born onto a roll, recruited, promoted, fostered, won upward at a
 * gathering, came back from missing) and who left one (each death note, lost,
 * walked out, house dissolved, crossed the Lid, promoted off it). Cause is read
 * off the row itself - `endNote`, tags, whether the row existed last year - so
 * the probe needs no hook inside the passes.
 *
 * It keeps two decays apart. Presence (standing at the seat) is not measured
 * here at all; this is roster only - whether anybody holds a rung.
 *
 * Output, written as it goes so a long run never has to be repeated to be read:
 *   <OUT>.series.jsonl  every SAMPLE years: per house, head count per rung,
 *                       and how many one rung down already meet the rung's bar
 *   <OUT>.flows.jsonl   every century: per house, `kind|rung/rungs` -> count
 *   <OUT>.notes.json    end notes no bucket recognised, so a bucket can be checked
 *   <OUT>.state.json    the world at the end, when PROBE_DUMP=1, for PROBE_RESUME
 *
 * Run: npx tsx scripts/probe-does-a-house-keep-its-shape.ts
 *   PROBE_SEED     world seed
 *   PROBE_YEARS    years to run from where the world stands
 *   PROBE_SAMPLE   years between series samples (default 10)
 *   PROBE_OUT      path prefix for the files above
 *   PROBE_RESUME   a .state.json to continue from instead of seeding
 *   PROBE_DUMP     1 to write the state at the end
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceTime } from '../src/engine/world/time.js';
import { applyPressure } from '../src/engine/world/pressure.js';
import { advanceImmortalLayer } from '../src/engine/world/immortal-world.js';
import {
    applyAbsence,
    openAbsencesForTheUnaccountedFor
} from '../src/engine/world/when-somebody-does-not-come-back.js';
import { theWorldForgetsTheMortalDead } from '../src/engine/world/world-state.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { rankRealmBand } from '../src/data/cultivation/members.js';
import { assessPromotions, ordinalExpectedAt } from '../src/engine/world/promotion-inside-a-house.js';
import { theRoomsThisHouseHas } from '../src/engine/social-leverage/authority-for-an-order.js';
import { roomAuthorityOf } from '../src/engine/world/architecture.js';
import { isElderRank } from '../src/engine/cultivation/leadership.js';
import { theSpeciesItIs } from '../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { canReproduce, copyCount, manualIdOf } from '../src/engine/world/manuals.js';
import { LEFT_IN_THE_GROUND } from '../src/engine/world/what-a-ruin-has-on-its-shelves.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEED = process.env.PROBE_SEED ?? 'shape-a';
const YEARS = Number(process.env.PROBE_YEARS ?? '100');
const SAMPLE = Number(process.env.PROBE_SAMPLE ?? '10');
const OUT = process.env.PROBE_OUT ?? `shape-${SEED}`;
const RESUME = process.env.PROBE_RESUME ?? null;
const DUMP = process.env.PROBE_DUMP === '1';

interface Seat {
    houseId: string;
    rung: number;
    rungs: number;
}

interface Before {
    seat: Seat | null;
    status: string;
    tags: string[];
    merit: number;
}

/** Read off the row rather than through the module, so a control arm without it still runs. */
function meritOf(npc: NpcRecord): number {
    const m = (npc as { merit?: { houseId: string; points: number } | null }).merit;
    return m && m.houseId === npc.factionId ? m.points : 0;
}

function quantiles(xs: number[]): number[] {
    if (xs.length === 0) return [];
    const v = xs.slice().sort((a, b) => a - b);
    const at = (q: number) => v[Math.min(v.length - 1, Math.floor(q * v.length))];
    return [v.length, at(0.25), at(0.5), at(0.75), v[v.length - 1]];
}

function liveHouses(state: WorldState): Map<string, number> {
    const out = new Map<string, number>();
    for (const f of state.factions) {
        if (f.dissolvedOnDay !== null || !isBelowTheLid(f) || f.ranks.length === 0) continue;
        out.set(f.id, f.ranks.length);
    }
    return out;
}

function seatOf(npc: NpcRecord, houses: Map<string, number>): Seat | null {
    if (npc.status !== 'alive' || npc.factionId === null || npc.factionRankIndex < 0) return null;
    if (!isBelowTheLid(npc)) return null;
    const rungs = houses.get(npc.factionId);
    if (rungs === undefined) return null;
    return { houseId: npc.factionId, rung: Math.min(npc.factionRankIndex, rungs - 1), rungs };
}

const DEATH_NOTES: [RegExp, string][] = [
    [/^Lifespan exhausted/, 'died:lifespan'],
    [/^Died of age\./, 'died:elder_died_age'],
    [/^Died of an old wound/, 'died:elder_died_wound'],
    [/^Died of a breakthrough/, 'died:elder_died_breakthrough'],
    [/^Called down the tribulation|^The crossing out of/, 'died:wall'],
    [/^Did not survive the last crossing/, 'died:last_crossing'],
    [/^Killed by .* at .*\.$/, 'died:killed_at_a_place'],
    [/^Killed by /, 'died:killed'],
    [/^Killed when the /, 'died:house_attacked'],
    [/^Taken when /, 'died:beast_raid'],
    [/friendly bout/, 'died:bout'],
    [/^Was at /, 'died:party_under_pressure'],
    [/^Was spent on /, 'died:spent'],
    [/^Went out for .* and did not come back/, 'lost:sending'],
    [/^Went into .* and did not come back/, 'lost:door'],
    [/^Walked out of .* did not come out/, 'lost:walked_out_into_ground'],
    [/^Went out and did not come back\./, 'lost:art_holder'],
    [/^Went into the hills/, 'lost:disappearance']
];

const unknownNotes: Record<string, number> = {};

function whyGone(npc: NpcRecord): string {
    const note = npc.endNote ?? '';
    for (const [re, kind] of DEATH_NOTES) if (re.test(note)) return kind;
    const prefix = npc.status === 'missing' ? 'lost' : npc.status === 'physically_dead' ? 'died' : npc.status;
    const key = `${npc.status}: ${note.slice(0, 70)}`;
    unknownNotes[key] = (unknownNotes[key] ?? 0) + 1;
    return `${prefix}:other`;
}

function barFor(state: WorldState, houseId: string, rung: number, rungs: number): number {
    const house = state.factions.find(f => f.id === houseId)!;
    const admission = Number(house.resources.admission_ordinal ?? 0);
    const power = Number(house.resources.power_ordinal ?? admission);
    return rankRealmBand(houseId, rung)?.minOrdinal
        ?? ordinalExpectedAt(rung, rungs, admission, power);
}

type Flows = Map<string, Map<string, number>>;

function bump(flows: Flows, houseId: string, kind: string, rung: number, rungs: number, n = 1): void {
    let h = flows.get(houseId);
    if (!h) { h = new Map(); flows.set(houseId, h); }
    const key = `${kind}|${rung}/${rungs}`;
    h.set(key, (h.get(key) ?? 0) + n);
}

function sample(state: WorldState, year: number): unknown {
    const houses = liveHouses(state);
    const out: Record<string, unknown> = {};
    const byHouse = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        const seat = seatOf(npc, houses);
        if (!seat) continue;
        const list = byHouse.get(seat.houseId);
        if (list) list.push(npc); else byHouse.set(seat.houseId, [npc]);
    }
    for (const [id, rungs] of houses) {
        const members = byHouse.get(id) ?? [];
        const counts = new Array(rungs).fill(0);
        const qualified = new Array(rungs).fill(0);
        const bestOrdinal = new Array(rungs).fill(-1);
        const merit: number[][] = Array.from({ length: rungs }, () => []);
        for (const m of members) {
            const r = Math.min(m.factionRankIndex, rungs - 1);
            counts[r]++;
            bestOrdinal[r] = Math.max(bestOrdinal[r], m.cultivation.realmOrdinal);
            merit[r].push(meritOf(m));
        }
        const offices = theRoomsThisHouseHas(state.locations, id)
            .filter(p => roomAuthorityOf(p).office).length;
        const elders = members.filter(m => isElderRank(m.factionRankIndex, rungs)).length;
        for (let r = 1; r < rungs; r++) {
            const bar = barFor(state, id, r, rungs);
            qualified[r] = members.filter(m => m.factionRankIndex === r - 1
                && m.cultivation.realmOrdinal >= bar).length;
        }
        const f = state.factions.find(x => x.id === id)!;
        out[id] = {
            rungs, counts, qualified, bestOrdinal, merit, offices, elders,
            noOfficeElders: offices > 0 ? Math.max(0, elders - offices) : null,
            seated: f.seatLocationId !== null,
            recruits: f.tags.includes('recruits')
        };
    }
    const blocked: Record<string, number> = {};
    const assessed = assessPromotions(state);
    for (const b of assessed.blocked) blocked[b.reason] = (blocked[b.reason] ?? 0) + 1;
    // Read loosely, so a control arm whose promotions carry neither field still runs.
    for (const p of assessed.promotions as { decidedBy?: string; withoutAnOffice?: boolean }[]) {
        const key = `decided:${p.decidedBy ?? 'unrecorded'}${p.withoutAnOffice ? ':no-office' : ''}`;
        blocked[key] = (blocked[key] ?? 0) + 1;
    }
    return {
        year, living: state.npcs.filter(n => n.status === 'alive').length, rows: state.npcs.length,
        blocked,
        top: theTopOfThePopulation(state), roads: theHighRoads(state),
        attention: theAttentionBeingGiven(state), houses: out
    };
}

/** Sets of people being taught right now, closed (a master's) and open (a hall). */
function theAttentionBeingGiven(state: WorldState): Record<string, number> {
    const out = { closedSets: 0, closedListeners: 0, openSets: 0, openListeners: 0 };
    for (const n of state.npcs) {
        const a = n.activity;
        if (n.status !== 'alive' || a === null || a.kind !== 'teaching' || a.withIds.length === 0) continue;
        if (a.untilDay !== undefined && a.untilDay !== null && a.untilDay <= state.currentDay - 365) continue;
        if (a.note.startsWith('giving a lecture')) { out.openSets++; out.openListeners += a.withIds.length; }
        else { out.closedSets++; out.closedListeners += a.withIds.length; }
    }
    return out;
}

/** People only: a beast row climbs by sitting and is not the ladder being asked about. */
function theTopOfThePopulation(state: WorldState): Record<string, number> {
    const ords: number[] = [];
    let aboveTheLid = 0;
    for (const n of state.npcs) {
        if (n.status !== 'alive' || theSpeciesItIs(n) !== null) continue;
        if (!isBelowTheLid(n)) { aboveTheLid++; continue; }
        ords.push(n.cultivation.realmOrdinal);
    }
    ords.sort((a, b) => a - b);
    const at = (p: number) => ords.length ? ords[Math.min(ords.length - 1, Math.floor(p * ords.length))] : -1;
    return {
        people: ords.length, max: ords.length ? ords[ords.length - 1] : -1,
        p99: at(0.99), p90: at(0.9), p50: at(0.5),
        over29: ords.filter(o => o > 29).length,
        over35: ords.filter(o => o > 35).length,
        over41: ords.filter(o => o > 41).length,
        aboveTheLid
    };
}

const BANDS: [string, number, number][] = [['cap22-29', 22, 29], ['cap30-36', 30, 36], ['cap37-40', 37, 40], ['cap41-44', 41, 44], ['cap45+', 45, 99]];

function bandOf(cap: number): string | null {
    for (const [name, lo, hi] of BANDS) if (cap >= lo && cap <= hi) return name;
    return null;
}

/**
 * Per band of how high a road reaches: the living who hold one, the living who
 * could write one out, and the paper - still in a ruin, or on somebody's shelf,
 * and how much of that was ever carried out of the ground.
 */
function theHighRoads(state: WorldState): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const [name] of BANDS) out[name] = { holders: 0, canWriteOut: 0, distinctTaught: 0, inTheGround: 0, onAShelf: 0, everCarriedOut: 0 };
    const taught = new Map<string, Set<string>>();
    for (const n of state.npcs) {
        if (n.status !== 'alive' || !isBelowTheLid(n)) continue;
        const seen = new Set<string>();
        for (const id of n.cultivation.techniqueIds) {
            const cap = Number(getTechnique(id)?.cap ?? NaN);
            const band = Number.isFinite(cap) ? bandOf(cap) : null;
            if (band === null) continue;
            if (!seen.has(band)) { out[band].holders++; seen.add(band); }
            if (canReproduce(n, id)) {
                out[band].canWriteOut++;
                const set = taught.get(band) ?? new Set<string>();
                set.add(id); taught.set(band, set);
            }
        }
    }
    for (const [band, set] of taught) out[band].distinctTaught = set.size;
    // AND BY GRADE, because a heaven, immortal or chaos book spends a use when
    // the player reads it, and whether the world's own readers spend one is
    // the question: a holder count that grows past the uses in the world is
    // the leak.
    const graded: Record<string, number> = { heldHeaven: 0, heldImmortal: 0, heldChaos: 0, booksHeaven: 0, booksImmortal: 0, booksChaos: 0 };
    for (const n of state.npcs) {
        if (n.status !== 'alive' || !isBelowTheLid(n)) continue;
        for (const id of n.cultivation.techniqueIds) {
            const g = getTechnique(id)?.grade;
            if (g === 'heaven') graded.heldHeaven++;
            else if (g === 'immortal') graded.heldImmortal++;
            else if (g === 'chaos') graded.heldChaos++;
        }
    }
    for (const o of state.objects) {
        const id = manualIdOf(o);
        const g = id === null ? undefined : getTechnique(id)?.grade;
        if (g === 'heaven') graded.booksHeaven += copyCount(o);
        else if (g === 'immortal') graded.booksImmortal += copyCount(o);
        else if (g === 'chaos') graded.booksChaos += copyCount(o);
    }
    out.byGrade = graded;
    for (const o of state.objects) {
        const id = manualIdOf(o);
        if (id === null) continue;
        const cap = Number(getTechnique(id)?.cap ?? NaN);
        const band = Number.isFinite(cap) ? bandOf(cap) : null;
        if (band === null) continue;
        if (o.tags.includes(LEFT_IN_THE_GROUND)) out[band].inTheGround += copyCount(o);
        else out[band].onAShelf += copyCount(o);
        if (o.data?.carriedOutOf !== undefined) out[band].everCarriedOut++;
    }
    return out;
}

/**
 * One slice of `advanceWorldForPlay`, in its order, stopping short of
 * `theWorldForgetsTheMortalDead`. The forgetting deletes a mortal who died this
 * year before the diff can read their end note, and every one of them would
 * otherwise file as a removed row with no cause. The caller forgets once the
 * year is read, so the world steps exactly as the driver steps it.
 */
function theYearWithoutTheForgetting(state: WorldState): void {
    const before = state.currentDay;
    const time = advanceTime(state, 365, { inPlace: true, stopOnInterrupt: false });
    applyPressure(state, before, time.toDay);
    advanceImmortalLayer(state, before, time.toDay);
    openAbsencesForTheUnaccountedFor(state, state.currentDay);
    for (const absence of state.absences ?? []) applyAbsence(state, absence, state.currentDay);
}

async function main(): Promise<void> {
    let state: WorldState;
    if (RESUME) {
        state = JSON.parse(readFileSync(RESUME, 'utf8')) as WorldState;
    } else {
        const catalog = await loadCultivationCatalog();
        state = seedWorld({ seed: SEED, catalog }).state;
        writeFileSync(`${OUT}.series.jsonl`, '', 'utf8');
        writeFileSync(`${OUT}.flows.jsonl`, '', 'utf8');
    }
    const startYear = Math.floor(state.currentDay / 365);
    if (!RESUME) appendFileSync(`${OUT}.series.jsonl`, JSON.stringify(sample(state, startYear)) + '\n');

    let flows: Flows = new Map();
    let meritAtPromotion: Record<string, number[]> = {};
    const started = Date.now();
    for (let y = 1; y <= YEARS; y++) {
        const housesBefore = liveHouses(state);
        const before = new Map<string, Before>();
        for (const npc of state.npcs) {
            before.set(npc.id, { seat: seatOf(npc, housesBefore), status: npc.status, tags: npc.tags, merit: meritOf(npc) });
        }

        theYearWithoutTheForgetting(state);

        const housesAfter = liveHouses(state);
        const after = new Map<string, NpcRecord>(state.npcs.map(n => [n.id, n]));

        for (const [id, was] of before) {
            if (!was.seat) continue;
            const s = was.seat;
            const npc = after.get(id);
            if (!npc) { bump(flows, s.houseId, 'out:row_removed', s.rung, s.rungs); continue; }
            const now = seatOf(npc, housesAfter);
            if (now && now.houseId === s.houseId) {
                if (now.rung > s.rung) {
                    for (let r = s.rung; r < now.rung; r++) {
                        bump(flows, s.houseId, 'out:promoted_off', r, s.rungs);
                        bump(flows, s.houseId, 'in:promoted_onto', r + 1, s.rungs);
                        (meritAtPromotion[`${r + 1}/${s.rungs}`] ??= []).push(was.merit);
                    }
                } else if (now.rung < s.rung) {
                    bump(flows, s.houseId, 'out:demoted', s.rung, s.rungs);
                    bump(flows, s.houseId, 'in:demoted_onto', now.rung, s.rungs);
                }
                continue;
            }
            let kind: string;
            if (npc.status !== 'alive') kind = whyGone(npc);
            else if (!isBelowTheLid(npc)) kind = 'crossed_the_lid';
            else if (!housesAfter.has(s.houseId)) kind = 'house_dissolved';
            else if (npc.factionId === null) {
                // Counted, not looked up: somebody who walked out once, joined
                // another house and walks out again for the same reason carries
                // the same tag twice.
                const count = (tags: readonly string[], t: string) => tags.filter(x => x === t).length;
                const walked = npc.tags.find(t => t.startsWith('walked-out:')
                    && count(npc.tags, t) > count(was.tags, t));
                kind = walked ? `walked_out:${walked.slice('walked-out:'.length)}` : 'released';
            } else if (npc.factionId !== s.houseId) {
                kind = housesBefore.has(npc.factionId) ? 'moved_house' : 'splintered_off';
            } else kind = 'unseated_other';
            bump(flows, s.houseId, `out:${kind}`, s.rung, s.rungs);
        }

        for (const npc of state.npcs) {
            const now = seatOf(npc, housesAfter);
            if (!now) continue;
            const was = before.get(npc.id);
            if (was?.seat && was.seat.houseId === now.houseId) continue;
            let kind: string;
            if (!was) {
                kind = npc.tags.includes('woken') ? 'woken'
                    : npc.tags.includes('fostered') ? 'born_and_fostered' : 'born_onto_the_roll';
            } else if (was.status !== 'alive') kind = `came_back_from_${was.status}`;
            else if (was.seat) kind = housesBefore.has(now.houseId) ? 'moved_from_another_house' : 'founded_or_splintered';
            else if (npc.tags.some(t => t === 'assessed:returned') && !was.tags.includes('assessed:returned')) kind = 'fosterage_return';
            else if (npc.tags.includes('fostered') && !was.tags.includes('fostered')) kind = 'fostered';
            else if (!housesBefore.has(now.houseId)) kind = 'founded_or_splintered';
            else kind = 'recruited';
            bump(flows, now.houseId, `in:${kind}`, now.rung, now.rungs);
        }

        const year = Math.floor(state.currentDay / 365);
        if (y % SAMPLE === 0 || y === YEARS) {
            appendFileSync(`${OUT}.series.jsonl`, JSON.stringify(sample(state, year)) + '\n');
        }
        theWorldForgetsTheMortalDead(state);
        if (y % 100 === 0 || y === YEARS) {
            const dump: Record<string, Record<string, number>> = {};
            const promoted: Record<string, number[]> = {};
            for (const [k, v] of Object.entries(meritAtPromotion)) promoted[k] = quantiles(v);
            for (const [h, m] of flows) dump[h] = Object.fromEntries(m);
            appendFileSync(`${OUT}.flows.jsonl`, JSON.stringify({ toYear: year, span: y % 100 === 0 ? 100 : y % 100, flows: dump, meritAtPromotion: promoted }) + '\n');
            flows = new Map();
            meritAtPromotion = {};
            writeFileSync(`${OUT}.notes.json`, JSON.stringify(unknownNotes, null, 1), 'utf8');
            const secs = Math.round((Date.now() - started) / 1000);
            console.log(`year ${year}  rows ${state.npcs.length}  living ${state.npcs.filter(n => n.status === 'alive').length}  facts ${state.history.facts.length}  ${secs}s`);
        }
    }
    if (DUMP) writeFileSync(`${OUT}.state.json`, JSON.stringify(state), 'utf8');
}

void main();
