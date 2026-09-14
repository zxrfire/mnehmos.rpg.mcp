/**
 * A door opens for a week. Can anybody be standing at it?
 *
 * For every ancient site on a schedule, in every pinned world:
 *
 *   the wait        years between openings.
 *   the window      days it stands open.
 *   the crossing    walking days from each house seated anywhere, over
 *                   `travelDays` on the location links. Dijkstra over the real
 *                   graph, not a straight line.
 *
 * ── THE BAR IS ASKED OF THE ENGINE, NOT RESTATED HERE ────────────────────
 *
 * The first cut of this probe scored `crossingDays * 2 < windowDays` - walk
 * there AND back inside the window - and reported 62.1% of houses unable to
 * reach a door. That is not what an expedition costs and it is not what the
 * engine charges. `beingAtADoorOnTheDayItOpens` already splits the two cases:
 *
 *   knows the date    sets out to ARRIVE. The road comes out of the years
 *                     before the window, not out of the window, and what the
 *                     window has to cover is the depth in and back out.
 *   hears it is open  starts late, so the whole crossing comes out of the
 *                     window and what is left buys half its own length in depth.
 *
 * Scoring everybody as the second was measuring the world as if nobody could
 * read a calendar, and the gap between the two arms is the whole information
 * edge a house trades on. So the verdicts below are `onFoot.works`,
 * `behindASenior.works` and `onASlip.works` off the engine function itself,
 * asked twice with the same rows and two parties who differ in nothing but
 * whether they can read the schedule.
 *
 *   npx esbuild scripts/probe-can-anybody-be-standing-there-on-the-day.ts \
 *       --bundle --platform=node --format=esm --external:better-sqlite3 \
 *       --outfile=probe.mjs && node probe.mjs
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { beingAtADoorOnTheDayItOpens } from '../src/engine/world/being-at-a-door-on-the-day-it-opens.js';
import { SCHEDULE_READ_ORDINAL } from '../src/engine/world/convergence.js';
import type { CapabilityActor } from '../src/engine/world/capability.js';
import {
    FOLD_FLOOR_ORDINAL,
    foldRangeInWalkingDays
} from '../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { walkingDaysFrom, type LocationRecord } from '../src/engine/world/locations.js';
import { wingsOf } from '../src/engine/world/provenance.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const YEAR = 365;

function line(s = ''): void { process.stdout.write(s + '\n'); }

/** Shares of the world's houses, per site, under one arm. */
interface Verdicts {
    walk: number;
    fold: number;
    none: number;
}

interface Row {
    seed: string;
    name: string;
    waitYears: number;
    windowDays: number;
    /** How far in the deepest wing is. What "the end of it" costs. */
    depthDays: number;
    nearestSeatDays: number | null;
    medianSeatDays: number | null;
    farthestSeatDays: number | null;
    knowsTheDate: Verdicts;
    hearsItIsOpen: Verdicts;
}

/**
 * Two parties who differ in nothing but whether they can read the schedule.
 *
 * A key drops the requirement to nothing and a rung meets it outright, so the
 * arm that knows the date is given both and the arm that does not is given
 * neither. `readSchedule` is the only thing in the priced reading that looks at
 * the party at all.
 */
function partyThatKnowsTheDate(site: LocationRecord): CapabilityActor {
    const key = site.data.scheduleKey == null ? null : String(site.data.scheduleKey);
    return {
        id: 'knows-the-date',
        realmOrdinal: SCHEDULE_READ_ORDINAL,
        knowledgeIds: key === null ? [] : [key]
    };
}

const PARTY_THAT_HEARS_IT_IS_OPEN: CapabilityActor = {
    id: 'hears-it-is-open',
    realmOrdinal: 0
};

function verdictsFor(
    site: LocationRecord,
    day: number,
    crossings: readonly number[],
    depthWanted: number,
    party: CapabilityActor
): Verdicts {
    let walk = 0;
    let fold = 0;
    for (const crossingDays of crossings) {
        const reading = beingAtADoorOnTheDayItOpens({
            location: site,
            day,
            party,
            crossingDays,
            depthWanted,
            // The two roads the design owner named, both at the rung folding
            // starts, which is the cheapest either of them can be bought at.
            escortOrdinal: FOLD_FLOOR_ORDINAL,
            slipCutAtOrdinal: FOLD_FLOOR_ORDINAL
        });
        if (reading.onFoot.works) walk++;
        else if (reading.behindASenior?.works || reading.onASlip?.works) fold++;
    }
    return { walk, fold, none: crossings.length - walk - fold };
}

/**
 * Ruins with no door at all: tombs and legacies, standing open and always have.
 *
 * Counted apart and never priced. Everything this probe measures is about a
 * window, and these have none - running them through it would report a wait of
 * nothing and a window of nought, which is a false answer rather than a missing
 * one. What stops somebody at one is the trial inside, which is
 * `evaluateAccess`'s question.
 */
function groundWithNoDoor(state: WorldState): number {
    return state.locations.filter(l =>
        l.kind === 'ruin' && l.cycle === null && !l.sealed).length;
}

function rowsFor(state: WorldState, seed: string): Row[] {
    const seats = state.factions
        .filter(f => f.dissolvedOnDay === null && isBelowTheLid(f) && f.seatLocationId !== null)
        .map(f => f.seatLocationId as string);
    const day = Math.floor(state.currentDay);

    const out: Row[] = [];
    for (const site of state.locations) {
        if (!site.cycle || site.kind !== 'ruin') continue;
        // Links are written both ways, so distance is symmetric and one walk
        // from the site answers every seat at once.
        const reach = walkingDaysFrom(state.locations, site.id);
        const days = seats
            .map(seat => reach.get(seat))
            .filter((d): d is number => d !== undefined)
            .sort((a, b) => a - b);
        const windowDays = site.cycle.openDays;
        const waitYears = Math.round(site.cycle.periodDays / YEAR);
        const depthDays = wingsOf(site).reduce((deep, wing) => Math.max(deep, wing.depthDays), 0);
        const unreachable = seats.length - days.length;
        const none = { walk: 0, fold: 0, none: seats.length };
        if (days.length === 0) {
            out.push({
                seed, name: site.name, waitYears, windowDays, depthDays,
                nearestSeatDays: null, medianSeatDays: null, farthestSeatDays: null,
                knowsTheDate: none, hearsItIsOpen: none
            });
            continue;
        }
        const add = (v: Verdicts): Verdicts => ({ ...v, none: v.none + unreachable });
        out.push({
            seed, name: site.name, waitYears, windowDays, depthDays,
            nearestSeatDays: days[0],
            medianSeatDays: days[Math.floor(days.length / 2)],
            farthestSeatDays: days[days.length - 1],
            knowsTheDate: add(verdictsFor(site, day, days, depthDays, partyThatKnowsTheDate(site))),
            hearsItIsOpen: add(
                verdictsFor(site, day, days, depthDays, PARTY_THAT_HEARS_IT_IS_OPEN)
            )
        });
    }
    return out;
}

/** What the map's own roads cost, so a crossing figure can be read against it. */
function roadReport(state: WorldState): string {
    const tally = new Map<number, number>();
    let links = 0;
    for (const l of state.locations) {
        for (const link of l.links) {
            links++;
            tally.set(link.travelDays, (tally.get(link.travelDays) ?? 0) + 1);
        }
    }
    const contained = state.locations.filter(l => l.parentId !== null).length;
    return `links ${links} (${[...tally].sort((a, b) => a[0] - b[0])
        .map(([d, n]) => `${d}d=${n}`).join(' ')}), `
        + `places ${state.locations.length}, of them inside another ${contained}`;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeds = (process.env.SEEDS
        ?? 'alpha,bravo,charlie,delta,echo,foxtrot,golf,hotel,india,juliet,kilo,lima').split(',');

    const all: Row[] = [];
    let firstRoads = '';
    let seatCount = 0;
    let ruins = 0;
    let noDoor = 0;
    for (const seed of seeds) {
        const state = seedWorld({ seed, catalog, presentYear: 1000, population: 250 }).state;
        ruins += state.locations.filter(l => l.kind === 'ruin').length;
        noDoor += groundWithNoDoor(state);
        if (firstRoads === '') {
            firstRoads = roadReport(state);
            seatCount = state.factions.filter(f =>
                f.dissolvedOnDay === null && isBelowTheLid(f) && f.seatLocationId !== null).length;
        }
        all.push(...rowsFor(state, seed));
    }

    line(`THE MAP ITSELF: ${firstRoads}, house seats ${seatCount}`);
    line();
    line('EVERY SCHEDULED SITE, ONE WORLD (the ruin roll is catalog-fixed; the rest repeat it)');
    line('  wait  window  depth  nearest  median  farthest   knows the date      hears it is open');
    line('                                                   walk  fold  none    walk  fold  none');
    for (const r of all.filter(r => r.seed === seeds[0])) {
        const share = (v: Verdicts, of: number): string =>
            `${(v.walk / of * 100).toFixed(0).padStart(5)}%`
            + `${(v.fold / of * 100).toFixed(0).padStart(5)}%`
            + `${(v.none / of * 100).toFixed(0).padStart(5)}%`;
        const of = r.knowsTheDate.walk + r.knowsTheDate.fold + r.knowsTheDate.none;
        line(`  ${String(r.waitYears).padStart(4)}y `
            + `${String(r.windowDays).padStart(6)}d `
            + `${String(r.depthDays).padStart(5)}d `
            + `${String(r.nearestSeatDays ?? '-').padStart(7)}d `
            + `${String(r.medianSeatDays ?? '-').padStart(6)}d `
            + `${String(r.farthestSeatDays ?? '-').padStart(8)}d  `
            + `${share(r.knowsTheDate, of)}   ${share(r.hearsItIsOpen, of)}  ${r.name}`);
    }
    line();

    const tally = (key: (r: Row) => string): string => {
        const m = new Map<string, number>();
        for (const r of all) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
        return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join('  ');
    };
    const mean = (of: (r: Row) => number): string =>
        (all.reduce((s, r) => s + of(r), 0) / all.length * 100).toFixed(1) + '%';
    const arm = (pick: (r: Row) => Verdicts): string => {
        const total = (r: Row): number => {
            const v = pick(r);
            return v.walk + v.fold + v.none;
        };
        return `walk in and out ${mean(r => pick(r).walk / total(r))}`
            + `, need a fold ${mean(r => pick(r).fold / total(r))}`
            + `, nobody makes it ${mean(r => pick(r).none / total(r))}`;
    };

    line(`POOLED over ${seeds.length} worlds, ${all.length} scheduled sites`);
    line(`  wait   ${tally(r => `${r.waitYears}y`)}`);
    line(`  window ${tally(r => `${r.windowDays}d`)}`);
    line(`  depth  ${tally(r => `${r.depthDays}d`)}`);
    const near = all.map(r => r.nearestSeatDays).filter((d): d is number => d !== null)
        .sort((a, b) => a - b);
    const far = all.map(r => r.farthestSeatDays).filter((d): d is number => d !== null)
        .sort((a, b) => a - b);
    line(`  nearest seat(walking days):  min ${near[0]} median ${near[Math.floor(near.length / 2)]} max ${near[near.length - 1]}`);
    line(`  farthest seat(walking days): min ${far[0]} median ${far[Math.floor(far.length / 2)]} max ${far[far.length - 1]}`);
    line(`  of the world's houses, per site, KNOWING THE DATE: ${arm(r => r.knowsTheDate)}`);
    line(`  of the world's houses, per site, HEARING IT IS OPEN: ${arm(r => r.hearsItIsOpen)}`);
    line(`  ruins ${ruins}, of them scheduled ${all.length} and standing open with no `
        + `door at all ${noDoor} - those have no window and are not a reachability `
        + 'question at all; what stops anybody at one is the trial inside.');
    line(`  a fold at the floor (${FOLD_FLOOR_ORDINAL}) covers `
        + `${foldRangeInWalkingDays(FOLD_FLOOR_ORDINAL)} walking days; `
        + `at 40 it covers ${foldRangeInWalkingDays(40).toFixed(0)}`);
}

void main();
