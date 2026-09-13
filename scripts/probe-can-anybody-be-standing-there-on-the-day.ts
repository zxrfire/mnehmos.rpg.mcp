/**
 * A door opens for a week. Can anybody be standing at it?
 *
 * The arithmetic the whole convergence design rests on, done rather than
 * asserted. For every ancient site on a schedule, in every pinned world:
 *
 *   the wait        years between openings.
 *   the window      days it stands open.
 *   the crossing    walking days from the nearest house seated in its own
 *                   province, over `travelDays` on the location links. Dijkstra
 *                   over the real graph, not a straight line.
 *   what is left    window minus crossing, and then minus the walk back out,
 *                   which is what `expeditionBudget` actually spends.
 *
 * Then the three verdicts a player would feel:
 *
 *   WALKABLE        a party on foot arrives with window left and gets back out.
 *   NEEDS A ROAD    the crossing eats the window. Somebody at Void Tribulation
 *                   folds them in, or a junior burns a way-out talisman.
 *   NOBODY          the crossing is longer than the window however it is done.
 *
 * The point is the SPREAD. An average over these hides exactly the cases the
 * two roads exist for.
 *
 *   npx esbuild scripts/probe-can-anybody-be-standing-there-on-the-day.ts \
 *       --bundle --platform=node --format=esm --external:better-sqlite3 \
 *       --outfile=probe.mjs && node probe.mjs
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { whereTheOpenGroundIs } from '../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import {
    FOLD_FLOOR_ORDINAL,
    foldRangeInWalkingDays
} from '../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import type { LocationRecord } from '../src/engine/world/locations.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const YEAR = 365;

function line(s = ''): void { process.stdout.write(s + '\n'); }

/** Walking days from one place to every place reachable from it. */
function walkingDaysFrom(
    locations: readonly LocationRecord[],
    startId: string
): Map<string, number> {
    const byId = new Map(locations.map(l => [l.id, l]));
    const best = new Map<string, number>([[startId, 0]]);
    // Small graphs. A sorted frontier costs less than a heap here and the
    // measurement is not on the hot path.
    const frontier: { id: string; days: number }[] = [{ id: startId, days: 0 }];
    while (frontier.length > 0) {
        frontier.sort((a, b) => a.days - b.days);
        const here = frontier.shift()!;
        if ((best.get(here.id) ?? Infinity) < here.days) continue;
        const node = byId.get(here.id);
        if (!node) continue;
        for (const link of node.links) {
            if (!link.open) continue;
            const days = here.days + Math.max(1, link.travelDays);
            if (days < (best.get(link.toLocationId) ?? Infinity)) {
                best.set(link.toLocationId, days);
                frontier.push({ id: link.toLocationId, days });
            }
        }
        // A place inside another is a walk of nothing: a ruin hangs off its
        // parent rather than off a road, and treating the containment as
        // impassable reports half the world unreachable.
        if (node.parentId !== null && !best.has(node.parentId)) {
            best.set(node.parentId, here.days);
            frontier.push({ id: node.parentId, days: here.days });
        }
        for (const child of locations) {
            if (child.parentId === node.id && !best.has(child.id)) {
                best.set(child.id, here.days);
                frontier.push({ id: child.id, days: here.days });
            }
        }
    }
    return best;
}

interface Row {
    seed: string;
    name: string;
    waitYears: number;
    windowDays: number;
    /** Walking days from the nearest house seat anywhere in the world. */
    nearestSeatDays: number | null;
    /** Walking days from the median house seat. What a house picked at random faces. */
    medianSeatDays: number | null;
    /** Walking days from the farthest house seat that can reach it at all. */
    farthestSeatDays: number | null;
    /** Share of the world's houses that could WALK somebody in inside the window. */
    shareWhoCanWalkIt: number;
    /**
     * Share that could not walk it but are inside the reach of a fold at the
     * rung folding starts. Escort, or a way-out slip cut by a hand at that rung.
     */
    shareWhoNeedAFold: number;
    /** Share nobody gets there from, on foot or on one fold. */
    shareNobodyMakes: number;
}

function rowsFor(state: WorldState, seed: string): Row[] {
    const seats = state.factions
        .filter(f => f.dissolvedOnDay === null && isBelowTheLid(f) && f.seatLocationId !== null)
        .map(f => f.seatLocationId as string);
    const foldAtTheFloor = foldRangeInWalkingDays(FOLD_FLOOR_ORDINAL);

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
        if (days.length === 0) {
            out.push({
                seed, name: site.name, waitYears, windowDays,
                nearestSeatDays: null, medianSeatDays: null, farthestSeatDays: null,
                shareWhoCanWalkIt: 0, shareWhoNeedAFold: 0, shareNobodyMakes: 1
            });
            continue;
        }
        // Out AND back inside the window is what an expedition actually costs,
        // which is why the bar is half the window rather than all of it.
        const walkable = days.filter(d => d * 2 < windowDays).length;
        const foldable = days.filter(d => d * 2 >= windowDays && d <= foldAtTheFloor).length;
        out.push({
            seed, name: site.name, waitYears, windowDays,
            nearestSeatDays: days[0],
            medianSeatDays: days[Math.floor(days.length / 2)],
            farthestSeatDays: days[days.length - 1],
            shareWhoCanWalkIt: walkable / seats.length,
            shareWhoNeedAFold: foldable / seats.length,
            shareNobodyMakes: (seats.length - walkable - foldable) / seats.length
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
    for (const seed of seeds) {
        const state = seedWorld({ seed, catalog, presentYear: 1000, population: 250 }).state;
        if (firstRoads === '') firstRoads = roadReport(state);
        all.push(...rowsFor(state, seed));
    }

    line(`THE MAP ITSELF: ${firstRoads}`);
    line();
    line('EVERY SCHEDULED SITE, ONE WORLD (the ruin roll is catalog-fixed; the rest repeat it)');
    line('  wait  window  nearest  median  farthest   walk%  fold%  none%  site');
    for (const r of all.filter(r => r.seed === seeds[0])) {
        line(`  ${String(r.waitYears).padStart(4)}y `
            + `${String(r.windowDays).padStart(6)}d `
            + `${String(r.nearestSeatDays ?? '-').padStart(7)}d `
            + `${String(r.medianSeatDays ?? '-').padStart(6)}d `
            + `${String(r.farthestSeatDays ?? '-').padStart(8)}d `
            + `${(r.shareWhoCanWalkIt * 100).toFixed(0).padStart(6)}%`
            + `${(r.shareWhoNeedAFold * 100).toFixed(0).padStart(6)}%`
            + `${(r.shareNobodyMakes * 100).toFixed(0).padStart(6)}%  ${r.name}`);
    }
    line();

    const tally = (key: (r: Row) => string): string => {
        const m = new Map<string, number>();
        for (const r of all) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
        return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join('  ');
    };
    const mean = (of: (r: Row) => number): string =>
        (all.reduce((s, r) => s + of(r), 0) / all.length * 100).toFixed(1) + '%';

    line(`POOLED over ${seeds.length} worlds, ${all.length} scheduled sites`);
    line(`  wait   ${tally(r => `${r.waitYears}y`)}`);
    line(`  window ${tally(r => `${r.windowDays}d`)}`);
    const near = all.map(r => r.nearestSeatDays).filter((d): d is number => d !== null)
        .sort((a, b) => a - b);
    const far = all.map(r => r.farthestSeatDays).filter((d): d is number => d !== null)
        .sort((a, b) => a - b);
    line(`  nearest seat(walking days):  min ${near[0]} median ${near[Math.floor(near.length / 2)]} max ${near[near.length - 1]}`);
    line(`  farthest seat(walking days): min ${far[0]} median ${far[Math.floor(far.length / 2)]} max ${far[far.length - 1]}`);
    line(`  of the world's houses, per site: walk in and out ${mean(r => r.shareWhoCanWalkIt)}`
        + `, need a fold ${mean(r => r.shareWhoNeedAFold)}`
        + `, nobody makes it ${mean(r => r.shareNobodyMakes)}`);
    line(`  a fold at the floor (${FOLD_FLOOR_ORDINAL}) covers `
        + `${foldRangeInWalkingDays(FOLD_FLOOR_ORDINAL)} walking days; `
        + `at 40 it covers ${foldRangeInWalkingDays(40).toFixed(0)}`);
}

void main();
