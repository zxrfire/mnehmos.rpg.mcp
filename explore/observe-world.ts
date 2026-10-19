/**
 * Exploration reads, outside CI. These are diagnostics, not new engine rules.
 * Use the engine's physical location, roll budget, room and bodily authorities.
 * A budget excess needs review: actual births and family placements can exceed
 * the background intake budget. A retained corpse activity is not proof of action.
 * Every discovered defect needs a small regression before its production fix.
 */
import { getSect } from '../src/data/cultivation/sects.js';
import { PRICES } from '../src/data/cultivation/mortal-world.js';
import { MAX_ORDINAL, realmForOrdinal } from '../src/engine/cultivation/realms.js';
import { stillNeedsToEat } from '../src/engine/cultivation/survival.js';
import { aRollWorthModelling } from '../src/engine/world/a-house-raises-its-own.js';
import { A_SHOPFRONT_HOLDS, shopfrontSitesOf } from '../src/engine/world/a-dao-house-shopfront.js';
import { A_BRANCH_HOLDS, templeBranchesOf } from '../src/engine/world/a-temple-branch.js';
import { exteriorGroundOfDeparture } from '../src/engine/world/departure-approach.js';
import { routeQueriesFor } from '../src/engine/world/locations.js';
import { woundsCarriedBy, type NpcRecord } from '../src/engine/world/npc-state.js';
import { locationOfNpcOnItsJourney } from '../src/engine/world/places-on-the-way.js';
import { theRollItsPostsNeed } from '../src/engine/world/what-a-houses-standing-posts-need.js';
import { publicWatchTargetsOf } from '../src/engine/world/where-a-house-keeps-its-public-watch.js';
import { priceMultiplierInArea } from '../src/engine/world/what-is-true-of-a-place-right-now.js';
import { witnessIndexFor } from '../src/engine/world/witness-reaction-index.js';
import type { HistoricalFact } from '../src/engine/world/history.js';
import type { WorldState } from '../src/engine/world/world-state.js';

export interface Finding {
    rule: string;
    level: 'invariant' | 'review';
    subject: string;
    evidence: string;
    day: number;
}

export const CHECKS = [
    'Unique IDs in each authoritative collection; finite nonnegative purses, faction stock/count resources and counted object quantities. Resource dates and ordinal metadata are not stocks.',
    'Living people have an actual recorded physical place; a standing house member away from its seat has a concrete activity.',
    'Physically dead people have no active goals, and no new buyer/seller/bidder/crafter/traveller act between observations while remaining physically dead.',
    'Unexpired stationed assignments at shopfronts/public watches and temple branches fit their existing staff caps; visiting delegations are not staff.',
    'Recruiting living rolls exceeding the existing intake/post budget are review candidates, because births and family placement can legitimately exceed it.',
    'Living cultivation ordinals and house rank indices are within their actual ladders.',
    'A plague course newly contracted exactly at an observed native boundary requires the existing bodily need for food, including actual wounds.',
    'Location parents exist and form no cycles; quoted area price dials are finite and nonnegative.'
] as const;

function add(counts: Record<string, number>, key: string, amount = 1): void {
    counts[key] = (counts[key] ?? 0) + amount;
}

export function spread(values: readonly number[]): { n: number; min: number | null; median: number | null; max: number | null } {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length, mid = n >> 1;
    return { n, min: sorted[0] ?? null, median: n === 0 ? null : n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
        max: sorted[n - 1] ?? null };
}

export interface Census {
    day: number;
    population: number;
    people: number;
    standingHouses: number;
    objects: number;
    facts: number;
    locations: number;
    statuses: Record<string, number>;
    populationByRealm: Record<string, number>;
    housesByStrongestRealm: Record<string, number>;
    membersByHouseRung: Record<string, number>;
    rollSizes: ReturnType<typeof spread>;
    purses: ReturnType<typeof spread>;
    prices: Record<string, ReturnType<typeof spread>>;
    findings: Finding[];
}

/** Read one settled world without modifying it. No historical acceptance thresholds. */
export function inspectWorld(world: WorldState): Census {
    const findings: Finding[] = [];
    const note = (rule: string, subject: string, evidence: string, level: Finding['level'] = 'invariant'): void => {
        findings.push({ rule, subject, evidence, level, day: world.currentDay });
    };
    const stock = (subject: string, value: number): void => {
        if (!Number.isFinite(value) || value < 0) note('invalid-stock', subject, `balance=${value}`);
    };
    for (const [name, rows] of [['people', world.npcs], ['houses', world.factions], ['objects', world.objects],
        ['locations', world.locations], ['facts', world.history.facts]] as const) {
        const seen = new Set<string>();
        for (const row of rows) {
            if (seen.has(row.id)) note('duplicate-id', `${name}:${row.id}`, 'ID occurs more than once in its collection.');
            seen.add(row.id);
        }
    }
    const places = new Map(world.locations.map(place => [place.id, place]));
    // Memoise only this read; later inspections derive the graph again.
    const finished = new Set<string>();
    for (const place of world.locations) {
        const path = new Set<string>();
        let cursor: string | null = place.id;
        while (cursor !== null && !finished.has(cursor)) {
            if (path.has(cursor)) { note('location-parent-cycle', place.id, `cycle reaches ${cursor}`); break; }
            path.add(cursor);
            const row = places.get(cursor);
            if (!row) { note('missing-location-parent', place.id, `missing ${cursor}`); break; }
            cursor = row.parentId;
        }
        for (const id of path) finished.add(id);
    }

    const routes = routeQueriesFor(world.locations);
    const houses = new Map(world.factions.map(house => [house.id, house]));
    const alive = world.npcs.filter(person => person.status === 'alive');
    const rolls = new Map<string, NpcRecord[]>();
    const populationByRealm: Record<string, number> = {}, membersByHouseRung: Record<string, number> = {};
    const housesByStrongestRealm: Record<string, number> = {}, statuses: Record<string, number> = {};
    for (const person of world.npcs) {
        stock(`${person.id}:spirit-stones`, person.spiritStones);
        if (person.status === 'physically_dead' && person.goals.some(goal => goal.status === 'active'))
            note('dead-active-goal', person.id, 'Physically dead person retains an active goal.');
        if (person.status !== 'alive') continue;
        const ordinal = person.cultivation.realmOrdinal;
        if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal > MAX_ORDINAL)
            note('invalid-realm', person.id, `ordinal=${ordinal}`);
        else add(populationByRealm, realmForOrdinal(ordinal).key);
        const actual = locationOfNpcOnItsJourney(world, person, world.currentDay, routes);
        if (!actual || !places.has(actual)) note('no-physical-place', person.id, `stored=${person.locationId}; actual=${actual}`);
        const house = person.factionId ? houses.get(person.factionId) : null;
        if (!house || house.dissolvedOnDay !== null) continue;
        const roll = rolls.get(house.id) ?? [];
        roll.push(person); rolls.set(house.id, roll);
        add(membersByHouseRung, String(person.factionRankIndex));
        if (!Number.isInteger(person.factionRankIndex) || person.factionRankIndex < 0 || person.factionRankIndex >= house.ranks.length)
            note('invalid-house-rung', person.id, `house=${house.id}; rung=${person.factionRankIndex}; ladder=${house.ranks.length}`);
        if (actual && house.seatLocationId && !person.activity &&
            exteriorGroundOfDeparture(world, actual, routes.places)?.id !== house.seatLocationId)
            note('away-without-reason', person.id, `house=${house.id}; seat=${house.seatLocationId}; actual=${actual}; activity=null`);
    }
    for (const object of world.objects) {
        if (typeof object.data.quantity === 'number') stock(`${object.id}:quantity`, object.data.quantity);
    }
    const index = witnessIndexFor(world);
    for (const house of world.factions) {
        for (const [resource, value] of Object.entries(house.resources)) {
            if (!resource.endsWith('_day') && !resource.endsWith('_ordinal')) stock(`${house.id}:${resource}`, value);
        }
        if (house.dissolvedOnDay !== null) continue;
        const roll = rolls.get(house.id) ?? [];
        add(housesByStrongestRealm, roll.length ? realmForOrdinal(Math.max(...roll.map(n => n.cultivation.realmOrdinal))).key : 'empty');
        const catalog = getSect(house.id);
        if (house.tags.includes('recruits')) {
            const budget = Math.max(aRollWorthModelling({ rankCount: house.ranks.length,
                powerOrdinal: catalog?.powerOrdinal ?? Number(house.resources.power_ordinal ?? 0),
                admissionOrdinal: catalog?.admissionOrdinal ?? Number(house.resources.admission_ordinal ?? 0),
                recruits: true, yearsStanding: house.foundedOnDay === null ? Infinity : (world.currentDay - house.foundedOnDay) / 365 }),
            theRollItsPostsNeed(world, house.id));
            if (roll.length > budget) note('roll-over-intake-budget', house.id,
                `roll=${roll.length}; intake/post budget=${budget}; actual births and family placement may explain excess.`, 'review');
        }
        const staff = new Map<string, number>();
        for (const person of roll) {
            if (person.activity?.kind !== 'stationed' || (person.activity.untilDay != null && person.activity.untilDay <= world.currentDay)) continue;
            const receipt = person.activity.airDutyReceiptId ? index.byId.get(person.activity.airDutyReceiptId) : null;
            const target = typeof receipt?.data.toLocationId === 'string' ? receipt.data.toLocationId : person.locationId;
            if (target) staff.set(target, (staff.get(target) ?? 0) + 1);
        }
        const sites = new Map([...shopfrontSitesOf(world, house.id), ...publicWatchTargetsOf(world, house.id)]
            .map(site => [site.id, A_SHOPFRONT_HOLDS]));
        for (const site of templeBranchesOf(world, house.id)) sites.set(site.id, A_BRANCH_HOLDS);
        for (const [site, cap] of sites) {
            const count = staff.get(site) ?? 0;
            if (count > cap) note('standing-post-over-cap', `${house.id}:${site}`, `unexpired assigned staff=${count}; cap=${cap}`);
        }
    }
    for (const status of world.statuses) {
        if (status.beganOnDay <= world.currentDay && (status.liftedOnDay === null || status.liftedOnDay > world.currentDay)) add(statuses, status.kind);
    }
    const prices: Census['prices'] = {};
    // Each fixed catalog good has its own series, so different units are never pooled.
    for (const price of PRICES) {
        const values = world.locations.filter(place => place.kind === 'settlement').map(place =>
            price.cash * priceMultiplierInArea(world.statuses, world.locations, place.id, world.currentDay, price.category));
        for (const value of values) if (!Number.isFinite(value) || value < 0) note('invalid-area-price', price.id, `cash=${value}`);
        prices[`${price.id} (${price.category}, cash/${price.unit})`] = spread(values);
    }
    return { day: world.currentDay, population: alive.length, people: world.npcs.length,
        standingHouses: world.factions.filter(house => house.dissolvedOnDay === null).length,
        objects: world.objects.length, facts: world.history.facts.length, locations: world.locations.length,
        statuses, populationByRealm, housesByStrongestRealm, membersByHouseRung, prices,
        rollSizes: spread([...rolls.values()].map(roll => roll.length)), purses: spread(alive.map(person => person.spiritStones)), findings };
}

/** Small previous-body projection for detecting new acts, never a second engine store. */
export function bodiesBefore(world: WorldState): Map<string, boolean> {
    return new Map(world.npcs.map(person => [person.id, person.status === 'physically_dead']));
}

export function deadActorsInNewFacts(world: WorldState, before: ReadonlyMap<string, boolean>, fromDay: number,
    facts: readonly HistoricalFact[]): Finding[] {
    const bodies = new Map(world.npcs.map(person => [person.id, person]));
    const actingRoles = new Set(['buyer', 'seller', 'bidder', 'crafter', 'traveller']);
    const findings: Finding[] = [];
    for (const fact of facts) {
        if (fact.day <= fromDay) continue;
        for (const actor of fact.actors) {
            if (before.get(actor.id) && bodies.get(actor.id)?.status === 'physically_dead' && actingRoles.has(actor.role))
                findings.push({ rule: 'dead-person-new-act', level: 'invariant', subject: actor.id, day: fact.day,
                    evidence: `fact=${fact.id}; role=${actor.role}; remained physically dead across this observed interval.` });
        }
    }
    return findings;
}

/** Structural compatibility with incoming plague rows; no new illness authority. */
export function newPlagueWithoutFoodNeed(world: WorldState): Finding[] {
    const findings: Finding[] = [];
    for (const person of world.npcs) {
        const body = person.cultivation as NpcRecord['cultivation'] & { plague?: { contractedOnDay: number; outbreakId: string } | null };
        if (body.plague?.contractedOnDay === world.currentDay && !stillNeedsToEat(body.realmOrdinal, woundsCarriedBy(person)))
            findings.push({ rule: 'new-plague-without-food-need', level: 'invariant', subject: person.id, day: world.currentDay,
                evidence: `new course=${body.plague.outbreakId}; ordinal=${body.realmOrdinal}; actual food need=false` });
    }
    return findings;
}

/** Explicitly heuristic review signals; none is a population or price rule. */
export function distributionReview(first: Census, last: Census): string[] {
    const lines: string[] = [];
    for (const key of ['population', 'standingHouses', 'objects', 'facts'] as const) {
        const before = first[key], after = last[key];
        if (before > 0 && (after >= before * 2 || after <= before / 2))
            lines.push(`${key}: ${before} -> ${after} (${(after / before).toFixed(2)}x); review the series and elapsed horizon.`);
    }
    for (const [good, current] of Object.entries(last.prices)) {
        const earlier = first.prices[good];
        if (earlier?.median && current.median != null && (current.median >= earlier.median * 2 || current.median <= earlier.median / 2))
            lines.push(`${good}: median ${earlier.median} -> ${current.median}; review the area statuses.`);
    }
    return lines;
}
