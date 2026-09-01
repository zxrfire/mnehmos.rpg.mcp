/**
 * Things a ruin does that are not damage.
 *
 * The test every entry in this module passes, and the reason it is a module
 * rather than a hazard list:
 *
 *   > A ruin mechanic changes the terms of engagement. It does not add a
 *   > number. It changes WHAT THE PLAYER KNOWS, WHAT THEY ARE, or WHAT THE
 *   > RULES OF THE PLACE ARE.
 *
 * A trap is a subtraction from hit points and the encounter layer already
 * prices those. Everything here instead makes a familiar quantity behave
 * differently: knowledge that is real and insufficient, an identity that is not
 * yours, a light source that is the thing you came to collect.
 *
 * All four are ENGINE-RESOLVED AND DETERMINISTIC. Same seed, same maze, same
 * routine, same era. A narrator describes what these return and never decides
 * any of it - `auditNarration` exists because one was caught doing exactly that.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { clampOrdinal, rankName } from '../cultivation/realms.js';
import type { LocationRecord } from './locations.js';
import { ageOf, comprehensionTagsFor, wingsOf } from './provenance.js';

// ═════════════════════════════════════════════════════════════════════════
// 1. THE MAP RECORDS ROOMS, NOT THE RELATIONSHIPS BETWEEN ROOMS
//
// The sharpest of the four, and the one that explains a great deal else.
//
// Knowledge of a site is a SET OF NODES WITH NO RELIABLE TOPOLOGY. Somebody's
// map tells you what chambers exist and what was in them. It cannot tell you
// how they connect, because that is not a thing anybody can establish from
// inside: the fog does not lift, the halls do not hold a bearing, and two
// parties who both got to the archive did not get there the same way.
//
// The map is NOT LYING and the ruin is NOT SHUFFLING. Both of those would be
// worse: a liar makes research worthless and a shuffling maze makes it
// meaningless. The topology is fixed, deterministic and unknowable, which is a
// different and much better thing - and it stays reproducible under a seed.
//
// Three consequences, and they are why the whole ruin picture holds together:
//
//   A MUCH-VISITED SITE IS NEVER SOLVED. Everybody learns the nodes; nobody
//   learns the edges. That is why the shallows are stripped - people kept
//   reaching the same first chambers, not because anybody mapped the place.
//
//   THE CLOCK BITES. Navigating badly costs days, and days are what kills you
//   when the convergence shuts. Every wrong turn is paid for twice, in and out.
//
//   RESEARCH IS WORTH DOING AND DOES NOT TRIVIALISE ANYTHING. Buying a map is a
//   real purchase with a bounded return, which is exactly the shape the
//   archaeology work wants.
// ═════════════════════════════════════════════════════════════════════════

/** A chamber and the ways out of it. The truth, which nobody holds. */
export interface Chamber {
    id: string;
    name: string;
    depthDays: number;
    /** Chamber ids reachable in one move. Fixed, deterministic, unrecordable. */
    exits: string[];
}

/**
 * The real shape of the place.
 *
 * Derived from the site's own id, so it is the same every time anybody asks and
 * the same across a save, a reload and a five-century soak. Built as a spanning
 * chain plus a deterministic scatter of cross-links, which is what makes it a
 * maze rather than a corridor: every chamber is reachable, and the short way is
 * not the obvious way.
 */
export function trueTopology(location: LocationRecord): Chamber[] {
    const wings = wingsOf(location);
    const rng = forStream('topology', location.id);
    const chambers: Chamber[] = wings.map(w => ({
        id: w.id,
        name: w.name,
        depthDays: w.depthDays,
        exits: [] as string[]
    }));

    const link = (a: number, b: number): void => {
        if (a === b || a < 0 || b < 0 || a >= chambers.length || b >= chambers.length) return;
        if (!chambers[a].exits.includes(chambers[b].id)) chambers[a].exits.push(chambers[b].id);
        if (!chambers[b].exits.includes(chambers[a].id)) chambers[b].exits.push(chambers[a].id);
    };

    // A spine, so nothing is unreachable.
    for (let i = 1; i < chambers.length; i++) link(i - 1, i);
    // And cross-links, so the spine is not the only route and depth order is
    // not the same as walking order.
    for (let i = 0; i < chambers.length; i++) {
        if (rng.chance(0.45)) link(i, rng.int(0, chambers.length - 1));
    }
    return chambers;
}

/**
 * What somebody actually holds about a site.
 *
 * Nodes only, and the type says so: there is no `edges` field and none may be
 * added. `knownChamberIds` is what a bought map, an archive entry or a previous
 * expedition's notes amount to.
 */
export interface SiteMap {
    knownChamberIds: string[];
    /** Where it came from, for a narrator that wants to say. */
    source: string;
}

/** The empty map. What somebody walking in cold is holding. */
export function noMap(): SiteMap {
    return { knownChamberIds: [], source: 'nothing' };
}

/**
 * A map of everything, which is still not a map of the way.
 *
 * The strongest map obtainable, and it is worth having: it removes every trip
 * to a chamber that does not exist or holds nothing. It removes no wandering,
 * because wandering is the edges.
 */
export function completeMap(location: LocationRecord, source: string): SiteMap {
    return { knownChamberIds: trueTopology(location).map(c => c.id), source };
}

export interface NavigationResult {
    reached: boolean;
    /** Days spent getting there. The number the convergence clock consumes. */
    days: number;
    /** Chambers actually walked through, in order. */
    route: string[];
    /** Days that were wasted, as against a route somebody who knew would take. */
    wasted: number;
    /** What the map was worth here, in days saved. Never the whole gap. */
    mapSaved: number;
}

/**
 * Walk from one chamber toward another, in fog.
 *
 * The model is one honest sentence: you can see the doors of the room you are
 * in and nothing beyond them, so at each chamber you pick an exit. A map does
 * not tell you which exit; it tells you which chambers are worth arriving at,
 * so you stop spending days walking into rooms that hold nothing. That is where
 * `mapSaved` comes from and it is deliberately bounded.
 *
 * Deterministic given the rng the caller passes, which the world layer keys on
 * the expedition rather than on the wall clock.
 */
export function navigate(
    location: LocationRecord,
    input: { fromChamberId: string; toChamberId: string; map: SiteMap },
    rng: CultivationRNG
): NavigationResult {
    const chambers = trueTopology(location);
    const byId = new Map(chambers.map(c => [c.id, c]));
    const from = byId.get(input.fromChamberId);
    const target = byId.get(input.toChamberId);
    if (!from || !target) {
        return { reached: false, days: 0, route: [], wasted: 0, mapSaved: 0 };
    }

    const known = new Set(input.map.knownChamberIds);
    const route: string[] = [from.id];
    let days = 0;
    let cursor = from;
    const visits = new Map<string, number>([[from.id, 1]]);

    // Bounded by the size of the place times a small constant, because a
    // wandering walk on a connected graph terminates and an unbounded loop in a
    // five-century soak does not.
    const cap = chambers.length * 8;
    for (let step = 0; step < cap && cursor.id !== target.id; step++) {
        const exits = cursor.exits.map(id => byId.get(id)).filter((c): c is Chamber => c != null);
        if (exits.length === 0) break;

        // Prefer a door that leads somewhere the map says is worth arriving at,
        // and among those the one least walked. Nothing here reads the target's
        // position, because nobody in the fog can.
        const worth = exits.filter(c => known.has(c.id) && (visits.get(c.id) ?? 0) === 0);
        const pool = worth.length > 0 ? worth : exits;
        const next = pool[rng.int(0, pool.length - 1)];

        days += Math.max(1, Math.abs(next.depthDays - cursor.depthDays));
        visits.set(next.id, (visits.get(next.id) ?? 0) + 1);
        route.push(next.id);
        cursor = next;
    }

    const ideal = idealDays(chambers, from.id, target.id);
    return {
        reached: cursor.id === target.id,
        days,
        route,
        wasted: Math.max(0, days - ideal),
        // What the map bought: every re-entry it prevented, priced at a day.
        // It is never the whole gap, because the edges stay unknown.
        mapSaved: known.size === 0
            ? 0
            : Math.min(Math.max(0, days - ideal), known.size)
    };
}

/** Days a route would take if somebody could know the way. Breadth-first. */
function idealDays(chambers: readonly Chamber[], fromId: string, toId: string): number {
    const byId = new Map(chambers.map(c => [c.id, c]));
    const cost = new Map<string, number>([[fromId, 0]]);
    const queue = [fromId];
    while (queue.length > 0) {
        const id = queue.shift()!;
        if (id === toId) return cost.get(id) ?? 0;
        const here = byId.get(id);
        if (!here) continue;
        for (const exit of here.exits) {
            if (cost.has(exit)) continue;
            const there = byId.get(exit);
            if (!there) continue;
            cost.set(exit, (cost.get(id) ?? 0) + Math.max(1, Math.abs(there.depthDays - here.depthDays)));
            queue.push(exit);
        }
    }
    return cost.get(toId) ?? 0;
}

// ═════════════════════════════════════════════════════════════════════════
// 2. WEARING SOMEBODY ELSE'S NAME, IN THEIR OWN ERA
//
// Each person takes a body and lives the site as whoever that was, when it
// worked. You are not exploring the place. You are in it, with a name, a rank
// and obligations that are not yours.
//
// This is not only a set piece. It is one of the documented ways anybody ever
// gets at a material-gated ancient art: the route that goes back rather than
// digging. What is learned or carried out of it is the whole point, and the
// engine has to be exact about what may come back, because "the past" is a
// place a narrator could otherwise hand over anything from.
//
// THE RULE ON WHAT COMES BACK:
//
//   COMPREHENSION DOES.  It is in the person, not in their hands, and nothing
//                        about the crossing touches it. This is the route.
//   OBJECTS DO NOT.      The body is not yours and does not come with you. An
//                        item picked up in the past is in the past's hands.
//   THE IDENTITY DOES    which is the cost. `identityContinuity` falls, and it
//   NOT COME OFF CLEAN.  is the same field a possession or a remnant uses.
// ═════════════════════════════════════════════════════════════════════════

export interface WornIdentity {
    corpseId: string;
    /** What they were called when the place worked. */
    name: string;
    /** The rung they stood at, which is what the era's doors were cut for. */
    realmOrdinal: number;
    /** Their standing in the house, as a rank index. */
    rankIndex: number;
    /** What was expected of them. The reason the era is playable at all. */
    obligations: string[];
    /** In-world year the wearer is standing in. */
    year: number;
}

export interface PossessionOffer {
    available: boolean;
    identity: WornIdentity | null;
    /** What can be brought back out, stated exactly. */
    carriesBack: { comprehension: string[]; objects: never[] };
    /** What it costs the wearer, on the field that already means this. */
    continuityCost: number;
    refusal: string | null;
}

/** How much of themselves a wearer does not get back. */
export const CONTINUITY_COST_PER_WEARING = 0.08;

/**
 * Take an identity out of the site's own past.
 *
 * The identity is DERIVED FROM THE SITE, not invented: the era is the year the
 * place was sealed, the rung is what its trials were calibrated for, and the
 * obligations are the halls the house actually had. So two people wearing two
 * bodies in the same ruin are in the same era with the same duties, and a
 * different ruin is a different life.
 *
 * Refuses on a new site, and the refusal is the interesting part: there is no
 * past to stand in that anybody alive was not already there for.
 */
export function offerPossession(
    location: LocationRecord,
    input: { corpseId: string; onDay: number }
): PossessionOffer {
    const age = ageOf(location, input.onDay);
    if (age === 'new') {
        return {
            available: false,
            identity: null,
            carriesBack: { comprehension: [], objects: [] },
            continuityCost: 0,
            refusal: 'There is nothing here old enough to stand inside. People who were '
                + 'in this building are still alive and can simply be asked.'
        };
    }

    const wings = wingsOf(location);
    const rng = forStream('worn', location.id, input.corpseId);
    const sealedDay = Number(location.data.sealedYear ?? 0) * 365;
    const year = Math.floor((sealedDay > 0 ? sealedDay : (location.origin.fromDay ?? 0)) / 365);
    const ordinal = clampOrdinal(
        Math.max(0, location.thresholds.mastery - rng.int(2, 10))
    );

    return {
        available: true,
        identity: {
            corpseId: input.corpseId,
            name: `${rankName(ordinal)} of ${location.name}`,
            realmOrdinal: ordinal,
            rankIndex: Math.max(0, wings.length - 1 - rng.int(0, Math.max(0, wings.length - 1))),
            obligations: wings.map(w => `answer for ${w.name}`),
            year
        },
        carriesBack: {
            // The route. Everything this site could ever teach, because being
            // in it when it worked is the most direct access there is.
            comprehension: comprehensionTagsFor(location, input.onDay),
            objects: []
        },
        continuityCost: CONTINUITY_COST_PER_WEARING,
        refusal: null
    };
}

// ═════════════════════════════════════════════════════════════════════════
// 3. THE ONLY LIGHT IS YOUR OWN QI
//
// The rule of the place, and it turns the resource into the cost. Exploring
// depletes exactly what the expedition came to gather, so going deeper is paid
// for in the currency of going at all - and a cultivator who spends everything
// getting to the vault has nothing left to take it out with.
// ═════════════════════════════════════════════════════════════════════════

/** Qi burned per day of depth, as a share of a full pool. */
export const LIGHT_COST_PER_DAY = 0.06;

export interface LightBudget {
    /** Days of depth the pool covers, at this rate. */
    daysOfLight: number;
    /** Share of the pool a round trip to this depth would cost, 0..1+. */
    shareForRoundTrip: number;
    /** True when the pool does not cover getting back to the door. */
    strandedInTheDark: boolean;
}

export function lightBudget(
    input: { qi: number; maxQi: number; depthDays: number }
): LightBudget {
    const pool = Math.max(0, input.maxQi) === 0 ? 0 : input.qi / input.maxQi;
    const share = input.depthDays * 2 * LIGHT_COST_PER_DAY;
    return {
        daysOfLight: Number((pool / LIGHT_COST_PER_DAY).toFixed(2)),
        shareForRoundTrip: Number(share.toFixed(3)),
        strandedInTheDark: share > pool
    };
}

// ═════════════════════════════════════════════════════════════════════════
// 4. THE DEAD ARE STILL KEEPING TO A ROUTINE, AND THE PLACE REMEMBERS
//
// Two rules of the same kind. Neither is a fight: what fails is interrupting,
// and what the place does about a returning visitor is recognise them.
//
// The routine is a function of the DAY, which is what makes it a routine rather
// than an encounter. The same hall is being swept at the same hour every year,
// and a party that knows the hour can walk through it. Nothing rolls.
// ═════════════════════════════════════════════════════════════════════════

export interface Routine {
    chamberId: string;
    /** What is happening in there right now. Factual, from the site's halls. */
    doing: string;
    /** True while walking in would interrupt it. */
    occupied: boolean;
    /** Day the chamber is next clear. */
    clearOnDay: number;
}

/** Days in the routine's own cycle. A year, because they kept a year. */
export const ROUTINE_PERIOD_DAYS = DAYS_PER_YEAR;

/**
 * What the dead are doing today, and where.
 *
 * Wholly determined by the day and the site: no rng at the call site at all, so
 * a party can observe it once and rely on it, which is the entire point of a
 * routine as against a patrol.
 */
export function routineAt(location: LocationRecord, day: number): Routine[] {
    const wings = wingsOf(location);
    if (wings.length === 0) return [];
    const phase = ((day % ROUTINE_PERIOD_DAYS) + ROUTINE_PERIOD_DAYS) % ROUTINE_PERIOD_DAYS;
    const slot = Math.floor((phase / ROUTINE_PERIOD_DAYS) * wings.length);

    return wings.map((w, i) => ({
        chamberId: w.id,
        doing: i === slot ? `the round is being kept in ${w.name}` : `${w.name} is empty`,
        occupied: i === slot,
        clearOnDay: i === slot
            ? day + Math.ceil(ROUTINE_PERIOD_DAYS / wings.length)
            : day
    }));
}

export interface Recognition {
    known: boolean;
    /** How many times this person has been in here before. */
    priorVisits: number;
    /** What the place does about it, stated factually. */
    greeting: string;
}

/**
 * The place remembers who has been in it.
 *
 * Read off the visitor ids the site's own change history already records, so it
 * cannot claim a visit that did not happen - and it is the one thing in this
 * module that gets MORE unsettling the more competent the player has been.
 */
export function recognises(location: LocationRecord, visitorName: string): Recognition {
    let visits = 0;
    for (const change of location.changes) {
        if (change.summary.startsWith(`${visitorName} `)) visits++;
    }
    return {
        known: visits > 0,
        priorVisits: visits,
        greeting: visits === 0
            ? 'Nothing acknowledges the door opening.'
            : `Something in the dark says the name ${visitorName} without being told it, `
                + `and gets the count right: ${visits}.`
    };
}
