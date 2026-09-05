/**
 * The world's news, in the mouths of people who mostly were not there.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import type { EventScale, HistoricalFact } from './history.js';
import { getFaction, getLocation, getNpc, type WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

const DAYS_PER_YEAR = 365;

/**
 * How much fidelity one hand costs.
 */
export const HAND_DECAY = 0.4;

/** Years of age after which a fact has been retold enough to have drifted. */
export const YEARS_PER_HAND = 30;

/** How many rumours one asking can turn up, however many facts are circulating. */
export const MOST_A_MARKET_HOLDS = 3;

/**
 * The realm gap at which somebody is not a peer but a rumour in their own right.
 */
export const OUT_OF_REACH_GAP = 12;

/** Scales, in the order of how far the telling of one travels. */
const SCALE_REACH: Record<EventScale, number> = {
    personal: 0,
    local: 1,
    regional: 2,
    continental: 4,
    world: 5
};

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which part of a rumour came off in the telling.
 */
export type RumourDistortion =
    /** It happened, to those people, there, then, at that size. */
    | 'intact'
    /** It happened. It is being told as though it were still the case. */
    | 'stale'
    /** It happened, and it has grown. */
    | 'inflated'
    /** It happened. The wrong person is being named for it. */
    | 'misattributed'
    /** It happened. Somewhere else. */
    | 'misplaced'
    /** It did not happen. Two things that did have been run together. */
    | 'invented';

/** Everything in a rumour worth a knowledge record. */
export interface RumouredName {
    kind: 'person' | 'faction' | 'place';
    id: string;
    name: string;
}

export interface Rumour {
    /**
     * The ledger row this descends from, or null when nothing in the world happened
     * as described.
     */
    factId: string | null;
    distortion: RumourDistortion;
    /** 0..1. What survived. Never a probability of anything. */
    fidelity: number;
    /** How many people it passed through to get here. At least one. */
    hands: number;
    /** What the teller actually says. Composed from fields, right or wrong. */
    text: string;
    named: RumouredName[];
    /**
     * Everybody the sentence puts a name to, doer first, as ids.
     */
    spokenOfIds: string[];
    /** The highest rung anybody in the rumour stands at, as told. */
    subjectOrdinal: number;
    scale: EventScale;
}

export interface TellerStanding {
    id: string;
    name: string;
    realmOrdinal: number;
    /** Region id, for whether this happened anywhere near them. */
    regionId: string | null;
    factionId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS IN THE AIR
// ─────────────────────────────────────────────────────────────────────────

/**
 * The facts people would actually repeat, best first.
 */
export function circulating(
    state: WorldState,
    teller: TellerStanding,
    onDay: number,
    limit = 24
): HistoricalFact[] {
    const scored: { fact: HistoricalFact; weight: number }[] = [];
    for (const fact of state.history.facts) {
        if (fact.visibility === 'secret') continue;
        if (fact.day > onDay) continue;
        const weight = airtimeOf(state, fact, teller, onDay);
        if (weight <= 0) continue;
        scored.push({ fact, weight });
    }
    scored.sort((a, b) => b.weight - a.weight || (a.fact.id < b.fact.id ? -1 : 1));
    return scored.slice(0, limit).map(s => s.fact);
}

/**
 * How much a fact gets said out loud.
 *
 * Four terms, and the second is the one the design turns on.
 */
function airtimeOf(
    state: WorldState,
    fact: HistoricalFact,
    teller: TellerStanding,
    onDay: number
): number {
    // How big the world thought it was when it happened.
    let weight = 0.4 + fact.magnitude + SCALE_REACH[fact.scale] * 0.5;

    // How far above the teller the people in it stand. This is the term that
    // makes the market talk about the top of the world.
    const gap = highestOrdinalIn(state, fact) - teller.realmOrdinal;
    if (gap >= OUT_OF_REACH_GAP) weight += 2.2;
    else if (gap >= 6) weight += 1.1;
    else if (gap >= 0) weight += 0.3;

    // A thing that nearly happened is better gossip than a thing that did.
    if (fact.nearMiss) weight += 0.6;

    // And it goes quiet. Not to zero - the oldest stories are the ones
    // everybody can tell - but a century of being repeated is a century of
    // being repeated less often.
    const years = Math.max(0, (onDay - fact.day) / DAYS_PER_YEAR);
    weight -= Math.min(1.5, years / 400);

    return weight;
}

/** The tallest person named on a fact, as the world currently holds them. */
function highestOrdinalIn(state: WorldState, fact: HistoricalFact): number {
    let best = 0;
    for (const actor of fact.actors) {
        const npc = getNpc(state, actor.id);
        if (npc && npc.cultivation.realmOrdinal > best) best = npc.cultivation.realmOrdinal;
    }
    for (const id of fact.factionIds) {
        const faction = getFaction(state, id);
        const ordinal = Number(faction?.resources.power_ordinal ?? 0);
        if (ordinal > best) best = ordinal;
    }
    return best;
}

// ─────────────────────────────────────────────────────────────────────────
// HOW FAR IT CAME
// ─────────────────────────────────────────────────────────────────────────

/**
 * How many people this passed through before it reached this teller.
 */
export function handsItPassedThrough(
    state: WorldState,
    fact: HistoricalFact,
    teller: TellerStanding,
    onDay: number
): number {
    if (fact.witnessIds.includes(teller.id)) return 1;
    if (fact.actors.some(a => a.id === teller.id)) return 1;

    let hands = 1;

    const years = Math.max(0, (onDay - fact.day) / DAYS_PER_YEAR);
    hands += Math.min(3, Math.floor(years / YEARS_PER_HAND));

    const where = regionOf(state, fact.locationId);
    if (where !== null && teller.regionId !== null && where !== teller.regionId) hands += 1;

    const gap = highestOrdinalIn(state, fact) - teller.realmOrdinal;
    if (gap >= OUT_OF_REACH_GAP) hands += 2;
    else if (gap >= 6) hands += 1;

    // A house's own business reaches an outsider through somebody who should
    // not have said it, and it is bent by the time it does.
    if (fact.visibility === 'faction'
        && (teller.factionId === null || !fact.factionIds.includes(teller.factionId))) {
        hands += 1;
    }

    return hands;
}

/** What survives `hands` retellings. */
export function fidelityAfter(hands: number): number {
    return 1 / (1 + Math.max(0, hands - 1) * HAND_DECAY);
}

/** The province-level container a place sits in. Null when unknown. */
export function regionOf(state: WorldState, locationId: string | null): string | null {
    if (!locationId) return null;
    let at = getLocation(state, locationId);
    const seen = new Set<string>();
    while (at && at.parentId && !seen.has(at.id)) {
        seen.add(at.id);
        const up = getLocation(state, at.parentId);
        if (!up) break;
        at = up;
    }
    return at?.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// THE TELLING
// ─────────────────────────────────────────────────────────────────────────

/**
 * One teller's version of one fact. Deterministic, and stable per teller.
 */
export function retell(
    state: WorldState,
    fact: HistoricalFact,
    teller: TellerStanding,
    onDay: number
): Rumour {
    const hands = handsItPassedThrough(state, fact, teller, onDay);
    const fidelity = fidelityAfter(hands);
    const rng = forStream(state.seed, 'rumour', fact.id, teller.id);

    const distortion = drawDistortion(state, fact, teller, fidelity, onDay, rng);
    const told = bend(state, fact, teller, distortion, onDay);

    return {
        factId: distortion === 'invented' ? null : fact.id,
        distortion,
        fidelity,
        hands,
        text: told.text,
        named: told.named,
        spokenOfIds: told.spokenOfIds,
        subjectOrdinal: highestOrdinalIn(state, fact),
        scale: fact.scale
    };
}

/**
 * Which part comes off.
 */
function drawDistortion(
    state: WorldState,
    fact: HistoricalFact,
    teller: TellerStanding,
    fidelity: number,
    onDay: number,
    rng: CultivationRNG
): RumourDistortion {
    if (rng.chance(fidelity)) return 'intact';

    const years = (onDay - fact.day) / DAYS_PER_YEAR;
    const offered: RumourDistortion[] = ['inflated', 'misattributed', 'misplaced'];
    if (years >= YEARS_PER_HAND) offered.push('stale');
    // The bottom of the spectrum, and it stays rare on purpose. A world where
    // half of what you hear never happened is a world where listening is not
    // worth doing, which is the opposite of the point.
    if (fidelity < 0.4 && fact.actors.length > 0) offered.push('invented');

    const truth = bend(state, fact, teller, 'intact', onDay).text;
    const bag = offered.filter(d => bend(state, fact, teller, d, onDay).text !== truth);

    // Nothing this event can be got wrong about while still being this event.
    // An intact telling is the honest answer, not a fallback.
    return bag.length === 0 ? 'intact' : rng.pick(bag);
}

interface Told {
    text: string;
    named: RumouredName[];
    /** Who the sentence spoke of, doer first. See `Rumour.spokenOfIds`. */
    spokenOfIds: string[];
}

/**
 * Compose the sentence from whatever fields the distortion left standing.
 */
function bend(
    state: WorldState,
    fact: HistoricalFact,
    teller: TellerStanding,
    distortion: RumourDistortion,
    onDay: number
): Told {
    const rng = forStream(state.seed, 'rumour-bend', fact.id, teller.id, distortion);
    let actors = fact.actors;
    let locationId = fact.locationId;
    let place = fact.place;
    let kind = fact.kind;
    let years = Math.max(0, (onDay - fact.day) / DAYS_PER_YEAR);
    let size = fact.magnitude;
    let houseId = fact.factionIds[0] ?? null;

    if (distortion === 'misattributed') {
        const other = someoneElseIn(state, fact);
        if (other) actors = [{ ...actors[0], id: other.id, name: other.name }, ...actors.slice(1)];
        // The house has to move with the person, because several of the
        // sentences below name the house and not the person - and a distortion
        // that swaps a field the rendering never reads is a distortion that did
        // nothing. Found by reading the output: "The Hollow Court has opened
        // the Gate Frame" came back identical under `intact` and under
        // `misattributed`, with only the invisible actor list differing.
        const instead = anotherHouse(state, fact);
        if (instead) houseId = instead;
    } else if (distortion === 'misplaced') {
        const other = somewhereElseIn(state, fact);
        if (other) { locationId = other.id; place = other.name; }
    } else if (distortion === 'stale') {
        // Told as though the ink were still wet. The event is right and the
        // listener will act on a world that has moved on since.
        years = 0;
    } else if (distortion === 'inflated') {
        size = Math.min(1, size + 0.35);
    } else if (distortion === 'invented') {
        // Two real things crossed. The people are real, the kind of event is
        // real, and the pairing never happened - which is what a fabricated
        // rumour is when you take one apart.
        const other = anotherFact(state, fact, rng);
        if (other) {
            kind = other.kind;
            size = other.magnitude;
        }
    }

    const named: RumouredName[] = [];
    for (const actor of actors.slice(0, 2)) {
        if (getNpc(state, actor.id)) named.push({ kind: 'person', id: actor.id, name: actor.name });
    }
    const house = houseId ? getFaction(state, houseId) : null;
    if (house) named.push({ kind: 'faction', id: house.id, name: house.name });
    if (locationId) {
        const at = getLocation(state, locationId);
        if (at) named.push({ kind: 'place', id: at.id, name: at.name });
    }

    return {
        spokenOfIds: actors.slice(0, 2).map(a => a.id),
        text: sentenceFor({
            kind,
            // Read off the fact, so a distortion cannot invent an author for a
            // wrong that never had one. `misattributed` still swaps who is
            // NAMED, and a fact with nobody in the doer slot has nobody to swap.
            authorless: fact.data.deedNamesNobody === true,
            who: actors[0]?.name ?? null,
            other: actors[1]?.name ?? null,
            house: house?.name ?? null,
            where: place ?? (locationId ? getLocation(state, locationId)?.name ?? null : null),
            years,
            size
        }),
        named
    };
}

/** Somebody the ledger already holds who could be named for this instead. */
function someoneElseIn(state: WorldState, fact: HistoricalFact): { id: string; name: string } | null {
    const taken = new Set(fact.actors.map(a => a.id));
    // The nearest thing in standing to whoever it really was, because that is
    // how a name gets swapped: two people of about the same size get confused
    // for one another, and nobody ever mistakes a farmhand for a patriarch.
    const target = highestOrdinalIn(state, fact);
    let best: { id: string; name: string } | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const npc of state.npcs) {
        if (taken.has(npc.id)) continue;
        if (npc.status !== 'alive') continue;
        const gap = Math.abs(npc.cultivation.realmOrdinal - target);
        if (gap < bestGap || (gap === bestGap && best !== null && npc.id < best.id)) {
            bestGap = gap;
            best = { id: npc.id, name: npc.name };
        }
    }
    return best;
}

/**
 * A place the world holds that this could be said to have happened at.
 */
function somewhereElseIn(state: WorldState, fact: HistoricalFact): { id: string; name: string } | null {
    const here = fact.locationId ? getLocation(state, fact.locationId) : null;
    let fallback: { id: string; name: string } | null = null;
    for (const at of state.locations) {
        if (at.id === fact.locationId) continue;
        if (at.layer !== 'mortal') continue;
        if (here && at.kind === here.kind) return { id: at.id, name: at.name };
        fallback ??= { id: at.id, name: at.name };
    }
    return fallback;
}

/** A house the world holds that could be named for this instead. */
function anotherHouse(state: WorldState, fact: HistoricalFact): string | null {
    const taken = new Set(fact.factionIds);
    const target = highestOrdinalIn(state, fact);
    let best: string | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const faction of state.factions) {
        if (taken.has(faction.id) || faction.dissolvedOnDay !== null) continue;
        const gap = Math.abs(Number(faction.resources.power_ordinal ?? 0) - target);
        if (gap < bestGap) { bestGap = gap; best = faction.id; }
    }
    return best;
}

/** Another thing that really happened, to be crossed with this one. */
function anotherFact(
    state: WorldState,
    fact: HistoricalFact,
    rng: CultivationRNG
): HistoricalFact | null {
    const others = state.history.facts.filter(f => f.id !== fact.id && f.visibility !== 'secret');
    return others.length === 0 ? null : rng.pick(others);
}

// ─────────────────────────────────────────────────────────────────────────
// SAYING IT
// ─────────────────────────────────────────────────────────────────────────

interface Saying {
    kind: HistoricalFact['kind'];
    /**
     * The fact names nobody for it.
     */
    authorless: boolean;
    who: string | null;
    other: string | null;
    house: string | null;
    where: string | null;
    years: number;
    size: number;
}

/** How long ago, in the register somebody repeating a story uses. */
function whenPhrase(years: number): string {
    if (years < 1) return 'this season';
    if (years < 4) return 'a year or two back';
    if (years < 25) return 'a while back';
    if (years < 100) return 'before most people here were born';
    if (years < 400) return 'generations back';
    return 'a long time ago, if it happened at all';
}

/**
 * The word for how big, which is the field `inflated` moves.
 */
function sizePhrase(size: number): string {
    if (size >= 0.85) return 'and nothing has been the same since';
    if (size >= 0.6) return 'and people are still working out what it costs';
    if (size >= 0.35) return 'and it has been talked about since';
    return 'and nobody thinks much of it';
}

/**
 * The sentence. Composed from fields, never from `fact.summary`.
 */
function sentenceFor(s: Saying): string {
    const who = s.who ?? 'somebody';
    const other = s.other;
    const house = s.house;
    const where = s.where;
    const at = where ? ` at ${where}` : '';
    const when = whenPhrase(s.years);
    const size = sizePhrase(s.size);

    // Nobody is named for it, and the one name in it is the person it happened
    // to. Said this way whatever kind of event it was, because what the teller
    // has is exactly this and no more: it was done, it was done to them, and
    // that is where the account of it stops.
    if (s.authorless) {
        return other
            ? `Something was done to ${who} and ${other}${at}, ${when}, ${size}.`
            : `Something was done to ${who}${at}, ${when}, ${size}.`;
    }

    switch (s.kind) {
        case 'ruin_opened':
            return `${house ?? who} has opened ${where ?? 'ground that was shut'}, ${when}, ${size}.`;
        case 'ruin_sealed':
            return `${house ?? who} has shut ${where ?? 'that ground'} again, ${when}, ${size}.`;
        case 'grudge_opened':
            return other
                ? `${who} wanted something off ${other} and was refused${at}, ${when}, ${size}.`
                : `${who} asked for something and was told no in front of people${at}, ${when}.`;
        case 'grudge_settled':
            return other
                ? `${who} and ${other} settled it${at}, ${when}, ${size}.`
                : `${who} settled an old account${at}, ${when}.`;
        case 'war':
            return other
                ? `${who} and ${other} are at each other${at}, ${when}, ${size}.`
                : `${house ?? who} is at war${at}, ${when}, ${size}.`;
        case 'ascension':
            return `${who} went up${at}, ${when}, ${size}.`;
        case 'realm_crossing':
            return `${who} came through a wall${at}, ${when}, ${size}.`;
        case 'death':
            return `${who} is dead${at}, ${when}, ${size}.`;
        case 'gathering':
            return `${house ?? who} held something${at} and the placings went round afterwards, ${when}.`;
        case 'betrayal':
            return other
                ? `${who} turned on ${other}${at}, ${when}, ${size}.`
                : `${who} turned on their own${at}, ${when}, ${size}.`;
        case 'faction_fallen':
            return `${house ?? who} is finished${at}, ${when}, ${size}.`;
        case 'faction_founded':
            return `${house ?? who} has put a gate up${at}, ${when}, ${size}.`;
        case 'catastrophe':
            return `Something went wrong${at || ' somewhere west'}, ${when}, ${size}.`;
        case 'treasure_found':
            return `${who} came out of${at || ' somewhere'} carrying something, ${when}, ${size}.`;
        case 'technique_lost':
            return `${house ?? who} lost the last of a road nobody else holds, ${when}, ${size}.`;
        case 'succession':
            return `${house ?? who} has somebody new in the chair, ${when}, ${size}.`;
        case 'expulsion':
            return `${house ?? who} put ${who} out of the gate, ${when}, ${size}.`;
        default:
            return other
                ? `${who} and ${other} had business${at}, ${when}, ${size}.`
                : `${who} did something${at} that people are still repeating, ${when}, ${size}.`;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A MARKET SAYS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Everything one teller would repeat, best first.
 */
export function whatTheySay(
    state: WorldState,
    teller: TellerStanding,
    onDay: number,
    limit = MOST_A_MARKET_HOLDS
): Rumour[] {
    const pool = circulating(state, teller, onDay);
    const out: Rumour[] = [];
    const seen = new Set<string>();
    for (const fact of pool) {
        if (out.length >= limit) break;
        const rumour = retell(state, fact, teller, onDay);
        if (seen.has(rumour.text)) continue;
        seen.add(rumour.text);
        out.push(rumour);
    }
    return out;
}
