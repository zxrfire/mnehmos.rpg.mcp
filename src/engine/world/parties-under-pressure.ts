/**
 * A cascade: parties under pressure, choosing, until the world is different.
 *
 * `pressure.ts` fires single events - a vein changes hands, an elder dies - and
 * each one is complete on its own. That is the right shape for institutional
 * churn and the wrong shape for the thing this module is for:
 *
 *   a house is destroyed
 *     -> the survivors have four things they could do, and one of them is the
 *        gravest thing a house can do
 *     -> they unseal what was under the hall
 *     -> the woken one has three things IT could do, and one of them spends it
 *     -> it spends itself on the ground of the house that did this
 *     -> and that ground is permanently different, three centuries later, to
 *        somebody who was not born when any of it happened
 *
 * Five decisions, four parties, one permanent change to the map. What makes it
 * a cascade rather than an event is that each step's OPTIONS are produced by the
 * state the previous step left behind, so nothing is scripted and the chain can
 * stop at any link - which it usually does, because `yield` is on every table
 * and is usually the heaviest entry on it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS BESPOKE, AND THE TEST IS EASY TO RUN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * There is no branch anywhere in this file on a faction id, a tier, a title or
 * an importance. A self-detonating protector is not a special case: it is
 * `expend`, which is the generic option "spend the whole of an asset at a
 * target for a one-time effect", available to any party holding an asset that
 * can be spent, priced off the asset's own ordinal by the same arithmetic that
 * prices everything else.
 *
 * The pricing reads five numbers, all of which already existed:
 *
 *   members alive          `state.npcs` filtered by faction
 *   treasury               `resources.spirit_stones`
 *   what they hold asleep  `resources.sealed_ceiling_ordinal`
 *   who is above them      `standing` toward a live, solvent faction
 *   who did this to them   the aggressor the precipitant named
 *
 * ── The exposure is derived, not restated ────────────────────────────────
 *
 * `catastrophe.ts` says a sect is destroyed outright, a court is destroyed, and
 * an apex is reduced to its head, because nothing unaimed reaches somebody past
 * Grand Ascension. This module does not read that table and does not branch on
 * tier. It asks `couldDieToADisaster` of each person actually standing there
 * and lets the answer fall out: a house whose strongest survivor is above the
 * bar is reduced to its head, and one whose strongest is below it is destroyed.
 * That AGREES with the table by construction rather than by maintenance, and if
 * the two ever disagree the table is what is wrong.
 *
 * ── Determinism ──────────────────────────────────────────────────────────
 *
 * One stream per cascade, keyed on the precipitating day and the party that
 * started it, so the same world produces the same chain however many advances
 * it took to reach that day.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import { clampOrdinal, rankName } from '../cultivation/realms.js';
import { UNTOUCHED_BY_DISASTER_ORDINAL, couldDieToADisaster } from '../../data/cultivation/catastrophe.js';
import { QI_DENSITY_MIN } from './qi-scale.js';
import { isBelowTheLid } from './layers.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { applyLocationChange, forbidZone, type LocationRecord } from './locations.js';
import { createNpc, markDead, markMissing, setRealm, type NpcRecord } from './npc-state.js';
import { settleNpcDeath, type DeathHandoff } from './time.js';
import type { FactionRecord, WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The options a party under pressure has.
 *
 * Seven, and every one of them is available to more than one kind of party.
 * There is no option here that exists for a single actor, and adding one would
 * be the bespoke path.
 */
export type CascadeOption =
    /** Do nothing. Always available, and usually the answer. */
    | 'yield'
    /** The roster disperses. What is left of the house stops being a house. */
    | 'scatter'
    /** Ask somebody above. They answer, or they file it and watch. */
    | 'call_patron'
    /** Spend the seal. The gravest thing a house can do to itself. */
    | 'unseal'
    /** The woken one stays, and becomes what the house has now. */
    | 'hold'
    /** The woken one leaves. The house woke it and got nothing. */
    | 'depart'
    /** The asset is spent entirely, at a target, once. */
    | 'expend';

/** A priced option, kept so the chain can be audited rather than believed. */
export interface WeighedOption {
    option: CascadeOption;
    weight: number;
    /** The state that produced the weight, in one factual line. */
    because: string;
}

export interface CascadeStep {
    depth: number;
    /** 'house' when an institution chose; 'woken' when a spent asset did. */
    partyKind: 'house' | 'woken';
    partyId: string;
    partyName: string;
    chosen: CascadeOption;
    /** Everything that was on the table, with what priced it. */
    considered: WeighedOption[];
    summary: string;
    factId: string | null;
    locationChangeIds: string[];
    touched: { factions: string[]; locations: string[]; npcs: string[] };
    deaths: DeathHandoff[];
}

export interface CascadeResult {
    steps: CascadeStep[];
    facts: HistoricalFact[];
    /** True when the map itself is permanently different afterwards. */
    reshapedTheLandscape: boolean;
    touched: { factions: string[]; locations: string[]; npcs: string[] };
    deaths: DeathHandoff[];
}

/**
 * What started it.
 *
 * A cascade never invents its own precipitant: something already happened to
 * `strickenId`, and `aggressorId` is whoever did it when anybody did. A
 * disaster with no author is a legitimate precipitant and leaves `aggressorId`
 * null, which removes `expend` from the table for want of a target - and that
 * is correct rather than a gap.
 */
export interface Precipitant {
    strickenId: string;
    aggressorId: string | null;
    day: number;
    /** Fact id of the thing that happened, for the chain's `causes`. */
    causeFactId: string | null;
    /** 0..1. How much of the stricken house is already gone. */
    severity: number;
}

/** Depth cap. Five is one more than the worked example needs. */
export const MAX_CASCADE_DEPTH = 5;

/**
 * Standing at which a house counts as having somebody above it.
 *
 * The mirror of `rivalsOf`'s -0.3 in `pressure.ts`, deliberately the same
 * number from the other side: a relationship that is worth going to war over
 * in one direction is worth asking for help in the other.
 */
export const PATRON_STANDING = 0.3;

/** What a patron has to have on hand before the ask is worth making. */
export const PATRON_SOLVENCY = 2_000;

// ─────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Run a chain of forced choices out to its end.
 *
 * Mutates `state` in place, writes a fact per step, and returns the chain. An
 * empty chain never happens: the first party always chooses something, and
 * `yield` is a choice with a fact attached, because "the house did nothing" is
 * information a player can act on.
 */
export function runCascade(
    state: WorldState,
    precipitant: Precipitant,
    rng: CultivationRNG
): CascadeResult {
    const steps: CascadeStep[] = [];
    const facts: HistoricalFact[] = [];
    const touched = { factions: [] as string[], locations: [] as string[], npcs: [] as string[] };
    const deaths: DeathHandoff[] = [];
    let reshaped = false;

    const stricken = state.factions.find(f => f.id === precipitant.strickenId) ?? null;
    if (!stricken) {
        return { steps, facts, reshapedTheLandscape: false, touched, deaths };
    }

    let cause = precipitant.causeFactId;
    // The asset the chain is spending, once a house has woken it. Null until.
    let woken: NpcRecord | null = null;

    for (let depth = 0; depth < MAX_CASCADE_DEPTH; depth++) {
        const step: CascadeStep | null = woken
            ? stepAsWoken(state, precipitant, stricken, woken, cause, depth, rng)
            : stepAsHouse(state, precipitant, stricken, cause, depth, rng);
        if (!step) break;

        steps.push(step);
        if (step.factId) {
            const fact = state.history.facts.find(f => f.id === step.factId);
            if (fact) { facts.push(fact); cause = fact.id; }
        }
        for (const id of step.touched.factions) if (!touched.factions.includes(id)) touched.factions.push(id);
        for (const id of step.touched.locations) if (!touched.locations.includes(id)) touched.locations.push(id);
        for (const id of step.touched.npcs) if (!touched.npcs.includes(id)) touched.npcs.push(id);
        deaths.push(...step.deaths);
        if (step.locationChangeIds.length > 0 && step.chosen === 'expend') reshaped = true;

        if (step.chosen === 'unseal') {
            woken = state.npcs.find(n => n.id === step.touched.npcs[0]) ?? null;
            if (!woken) break;
            continue;
        }
        // Every other option is terminal. A house that scattered has no second
        // decision, and a woken one that held, left or was spent is done.
        break;
    }

    return { steps, facts, reshapedTheLandscape: reshaped, touched, deaths };
}

// ─────────────────────────────────────────────────────────────────────────
// THE HOUSE'S TURN
// ─────────────────────────────────────────────────────────────────────────

function stepAsHouse(
    state: WorldState,
    precipitant: Precipitant,
    house: FactionRecord,
    cause: string | null,
    depth: number,
    rng: CultivationRNG
): CascadeStep | null {
    const members = membersOf(state, house.id);
    const stones = Number(house.resources.spirit_stones ?? 0);
    const ceiling = Number(house.resources.sealed_ceiling_ordinal ?? 0);
    const spent = house.tags.includes('seal_spent');
    const patron = patronFor(state, house);

    const considered: WeighedOption[] = [];

    // Doing nothing is always on the table and is weighted by what the house
    // still has to lose by escalating. A house with people and money has
    // reasons to sit still; a ruined one has none.
    considered.push({
        option: 'yield',
        weight: 1 + members.length * 0.05 + Math.min(3, stones / 4_000),
        because: `${members.length} left, ${stones} stones in the treasury.`
    });

    // People walk. Weighted by how many there are to walk and how little is
    // left to keep them - which is `WHAT_FALLS_ON_THOSE_BELOW` as arithmetic.
    if (members.length > 0) {
        considered.push({
            option: 'scatter',
            weight: 0.4 + members.length * 0.08 + precipitant.severity * 2,
            because: `${members.length} disciples and ${stones} stones against a `
                + `${Math.round(precipitant.severity * 100)}% loss.`
        });
    }

    // Somebody above, if there is somebody above and they can afford it.
    if (patron) {
        considered.push({
            option: 'call_patron',
            weight: 1.5 + (house.standing[patron.id] ?? 0) * 2
                + Number(patron.resources.power_ordinal ?? 0) * 0.04,
            because: `the ${patron.name} stands at `
                + `${(house.standing[patron.id] ?? 0).toFixed(2)} and holds `
                + `${Number(patron.resources.spirit_stones ?? 0)} stones.`
        });
    }

    // And the seal, when they have one and have not already spent it.
    //
    // Weighted by how much worse everything else is: severity squared, times
    // how far the sealed ancestor outranks whoever did this. A house with a working
    // patron and half its roster does not wake anybody. A house with neither
    // has one thing left and knows exactly what it is.
    if (ceiling > 0 && !spent) {
        const aggressor = precipitant.aggressorId
            ? state.factions.find(f => f.id === precipitant.aggressorId) ?? null
            : null;
        const advantage = Math.max(0, ceiling - Number(aggressor?.resources.power_ordinal ?? 0));
        considered.push({
            option: 'unseal',
            weight: precipitant.severity * precipitant.severity * (2 + advantage * 0.25)
                / (1 + members.length * 0.1 + (patron ? 2 : 0)),
            because: `${rankName(ceiling)} under the hall, `
                + `${advantage} rungs over what came for them, `
                + `${patron ? 'a patron who has not answered' : 'nobody above them'}.`
        });
    }

    const chosen = draw(considered, rng);
    if (!chosen) return null;

    switch (chosen) {
        case 'scatter': return applyScatter(state, precipitant, house, members, considered, cause, depth);
        case 'call_patron': return applyCallPatron(state, precipitant, house, patron!, considered, cause, depth);
        case 'unseal': return applyUnseal(state, precipitant, house, ceiling, considered, cause, depth);
        default: return applyYield(state, precipitant, house, considered, cause, depth);
    }
}

function applyYield(
    state: WorldState,
    precipitant: Precipitant,
    house: FactionRecord,
    considered: WeighedOption[],
    cause: string | null,
    depth: number
): CascadeStep {
    const summary = `The ${house.name} did not answer what was done to it.`;
    const fact = emit(state, {
        day: precipitant.day,
        kind: 'faction_fallen',
        scale: 'local',
        summary,
        factionIds: [house.id],
        causes: cause ? [cause] : [],
        visibility: 'faction',
        magnitude: 0.35,
        data: { cascade: 'yield', depth },
        unattributed: 'The compound is still there and nothing has come out of it.'
    });
    return step(depth, 'house', house, 'yield', considered, summary, fact, [], { factions: [house.id] }, []);
}

function applyScatter(
    state: WorldState,
    precipitant: Precipitant,
    house: FactionRecord,
    members: NpcRecord[],
    considered: WeighedOption[],
    cause: string | null,
    depth: number
): CascadeStep {
    for (const npc of members) {
        replaceNpc(state, {
            ...npc,
            factionId: null,
            factionRankIndex: -1,
            updatedOnDay: precipitant.day
        });
    }
    house.tags = Array.from(new Set(house.tags.concat('scattered')));
    house.resources.members = 0;

    const summary = `${members.length} of the ${house.name} left and did not come back. `
        + 'Nobody dissolved it; there is simply nobody in it.';
    const fact = emit(state, {
        day: precipitant.day,
        kind: 'migration',
        scale: 'regional',
        summary,
        factionIds: [house.id],
        causes: cause ? [cause] : [],
        visibility: 'public',
        magnitude: 0.55,
        data: { cascade: 'scatter', depth, count: members.length },
        unattributed: 'There are more people on the road than there were, and several of '
            + 'them are carrying sect robes they are not wearing.'
    });
    return step(
        depth, 'house', house, 'scatter', considered, summary, fact, [],
        { factions: [house.id], npcs: members.map(n => n.id) }, []
    );
}

function applyCallPatron(
    state: WorldState,
    precipitant: Precipitant,
    house: FactionRecord,
    patron: FactionRecord,
    considered: WeighedOption[],
    cause: string | null,
    depth: number
): CascadeStep {
    // Whether the patron answers is priced off what it costs them against what
    // the relationship is worth. Nothing here reasons about their motives; it
    // is a solvency check and a standing check, both already stored.
    const cost = Math.round(Math.max(500, precipitant.severity * 6_000));
    const answers = Number(patron.resources.spirit_stones ?? 0) >= cost
        && (house.standing[patron.id] ?? 0) >= PATRON_STANDING;

    let summary: string;
    if (answers) {
        patron.resources.spirit_stones = Math.max(0, Number(patron.resources.spirit_stones ?? 0) - cost);
        house.resources.spirit_stones = Number(house.resources.spirit_stones ?? 0) + cost;
        house.standing[patron.id] = Math.min(1, (house.standing[patron.id] ?? 0) + 0.2);
        patron.standing[house.id] = Math.min(1, (patron.standing[house.id] ?? 0) + 0.1);
        house.tags = Array.from(new Set(house.tags.concat('was_carried')));
        summary = `The ${patron.name} carried the ${house.name} through it, at ${cost} stones. `
            + 'Everyone local now knows the ' + patron.name + ' had that spare.';
    } else {
        house.standing[patron.id] = Math.max(-1, (house.standing[patron.id] ?? 0) - 0.5);
        house.tags = Array.from(new Set(house.tags.concat('was_watched')));
        summary = `The ${house.name} asked the ${patron.name} and the ${patron.name} watched.`;
    }

    const fact = emit(state, {
        day: precipitant.day,
        // Answering opens a debt; watching is a bond not honoured. Both are
        // kinds the ledger already has, and neither needed inventing.
        kind: answers ? 'debt_incurred' : 'betrayal',
        scale: 'regional',
        summary,
        factionIds: [house.id, patron.id],
        causes: cause ? [cause] : [],
        visibility: 'faction',
        magnitude: answers ? 0.5 : 0.6,
        data: { cascade: 'call_patron', depth, answered: answers, cost },
        unattributed: answers
            ? 'A very large convoy went up the valley and came back empty.'
            : 'Somebody rode out and came back alone, and has not been seen since.'
    });
    return step(
        depth, 'house', house, 'call_patron', considered, summary, fact, [],
        { factions: [house.id, patron.id] }, []
    );
}

/**
 * The seal comes off.
 *
 * What comes out is an ORDINARY NPC at an ordinary ordinal, created by the
 * ordinary factory, standing in an ordinary location. Take the ordinal away and
 * nothing is left over, which is the test this project applies to every piece
 * of lore that looks special. The `woken` tag is a label the digest can read,
 * not a rule anything branches on.
 *
 * It is spent on the way out: `sealed_ceiling_ordinal` goes to zero and the
 * house is tagged. There is exactly one of these per house, ever.
 */
function applyUnseal(
    state: WorldState,
    precipitant: Precipitant,
    house: FactionRecord,
    ceiling: number,
    considered: WeighedOption[],
    cause: string | null,
    depth: number
): CascadeStep {
    const id = `npc-${state.nextNpcSeq++}`;
    const ordinal = clampOrdinal(ceiling);
    // Old enough to have been sealed for a very long time, and the number is
    // read off the house rather than chosen: it went under when the house was
    // founded, which is the only date the world stores about it.
    const sealedForDays = Math.max(0, precipitant.day - (house.foundedOnDay ?? 0));

    let npc = createNpc(state.seed, {
        id,
        bornOnDay: (house.foundedOnDay ?? 0) - 365 * 200,
        onDay: precipitant.day,
        locationId: house.seatLocationId,
        occupation: 'sealed',
        factionId: house.id,
        factionRankIndex: Math.max(0, house.ranks.length - 1),
        takenNames: new Set(state.npcs.map(n => n.name)),
        tags: ['woken']
    });
    npc = setRealm(npc, ordinal, precipitant.day);
    state.npcs.push(npc);

    house.resources.sealed_ceiling_ordinal = 0;
    house.resources.power_ordinal = Math.max(Number(house.resources.power_ordinal ?? 0), ordinal);
    house.tags = Array.from(new Set(house.tags.concat('seal_spent')));

    const changeIds: string[] = [];
    const seat = house.seatLocationId
        ? state.locations.find(l => l.id === house.seatLocationId) ?? null : null;
    if (seat) {
        const changed = applyLocationChange(seat, {
            onDay: precipitant.day,
            kind: 'unsealed',
            summary: `The floor of the ${house.name}'s hall was opened from underneath.`,
            causeFactId: cause,
            causeKnown: true,
            witnessed: true,
            patch: { addTags: ['seal_broken'] }
        });
        replaceLocation(state, changed.location);
        changeIds.push(changed.change.id);
    }

    const summary = `The ${house.name} broke its own seal after `
        + `${Math.floor(sealedForDays / 365)} years. ${npc.name}, ${rankName(ordinal)}, is awake.`;
    const fact = emit(state, {
        day: precipitant.day,
        // The ledger's own vocabulary for a seal coming off something.
        kind: 'ruin_opened',
        scale: 'regional',
        summary,
        actors: [{ id: npc.id, name: npc.name, role: 'woken' }],
        locationId: seat?.id ?? null,
        factionIds: [house.id],
        locationChangeIds: changeIds,
        causes: cause ? [cause] : [],
        visibility: 'public',
        magnitude: 0.9,
        data: { cascade: 'unseal', depth, ordinal },
        unattributed: 'Every bird in the valley went up at once and the ones that came down '
            + 'came down dead. That was a month ago and the sky has not been the same colour since.'
    });

    return step(
        depth, 'house', house, 'unseal', considered, summary, fact, changeIds,
        // The woken one FIRST, because the caller reads `npcs[0]` to continue
        // the chain. Order is load-bearing here and nowhere else.
        { factions: [house.id], locations: seat ? [seat.id] : [], npcs: [npc.id] }, []
    );
}

// ─────────────────────────────────────────────────────────────────────────
// THE WOKEN ONE'S TURN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Three options, priced off what is left rather than off a personality.
 *
 * There is no motive model here and there must not be. What decides it is the
 * arithmetic the world already holds: whether the house that woke them still
 * exists in any meaningful sense, and whether whoever did this is reachable and
 * above what the survivors could ever answer.
 */
function stepAsWoken(
    state: WorldState,
    precipitant: Precipitant,
    house: FactionRecord,
    woken: NpcRecord,
    cause: string | null,
    depth: number,
    rng: CultivationRNG
): CascadeStep | null {
    const survivors = membersOf(state, house.id).filter(n => n.id !== woken.id);
    const aggressor = precipitant.aggressorId
        ? state.factions.find(f => f.id === precipitant.aggressorId && f.dissolvedOnDay === null) ?? null
        : null;
    // A REGION IS A CONTAINER AND MUST NEVER BE THE TARGET.
    //
    // This was measured, not reasoned about. `faction_founded` seats a splinter
    // at its founder's location, which for a splinter formed on a region node IS
    // the region - so `expend` was forbidding whole provinces. `birthplacesIn`
    // then found nowhere habitable, `applyDemography` found no regions at all,
    // births stopped dead, and the world aged out: 486 living at year 400, 250
    // at 450, 1 at 500, with the roster frozen at 3,207 people of whom 3,206
    // were dead. The drift audit caught it on the first run.
    //
    // `zone_forbidden` has always filtered to `wilds` and `vein` for exactly
    // this reason. The same care, stated once, at the point of consumption.
    const seat = aggressor?.seatLocationId
        ? state.locations.find(l => l.id === aggressor.seatLocationId) ?? null : null;
    const target = seat && seat.kind !== 'region' ? seat : null;

    const considered: WeighedOption[] = [];
    const ordinal = woken.cultivation.realmOrdinal;

    // Staying is worth what there is left to stay for.
    considered.push({
        option: 'hold',
        weight: 0.5 + survivors.length * 0.15,
        because: `${survivors.length} of the house still standing.`
    });

    // Leaving is worth what there is not.
    considered.push({
        option: 'depart',
        weight: 1 + (survivors.length === 0 ? 3 : 0) + precipitant.severity * 1.5,
        because: survivors.length === 0
            ? 'nobody who woke them is alive to have woken them.'
            : `${Math.round(precipitant.severity * 100)}% of the house is gone.`
    });

    // Spending is worth what the survivors could never do themselves. The
    // strongest survivor is the comparison, because the question the arithmetic
    // is asking is whether this is the only way it gets answered at all.
    if (aggressor && target) {
        const best = survivors.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);
        const theirs = Number(aggressor.resources.power_ordinal ?? 0);
        const unanswerable = Math.max(0, theirs - best);
        considered.push({
            option: 'expend',
            weight: precipitant.severity * (0.5 + unanswerable * 0.3)
                * (1 + Math.max(0, ordinal - theirs) * 0.1),
            because: `${rankName(theirs)} at the ${aggressor.name}, `
                + `${unanswerable} rungs past anything the survivors have, `
                + `${rankName(ordinal)} awake and spendable once.`
        });
    }

    const chosen = draw(considered, rng);
    if (!chosen) return null;

    if (chosen === 'expend' && aggressor && target) {
        return applyExpend(state, precipitant, house, woken, aggressor, target, considered, cause, depth);
    }
    if (chosen === 'depart') {
        return applyDepart(state, precipitant, house, woken, considered, cause, depth);
    }
    return applyHold(state, precipitant, house, woken, considered, cause, depth);
}

function applyHold(
    state: WorldState,
    precipitant: Precipitant,
    house: FactionRecord,
    woken: NpcRecord,
    considered: WeighedOption[],
    cause: string | null,
    depth: number
): CascadeStep {
    const summary = `${woken.name} stayed. The ${house.name} has a `
        + `${rankName(woken.cultivation.realmOrdinal)} in the hall and nothing else it had before.`;
    const fact = emit(state, {
        day: precipitant.day,
        kind: 'faction_founded',
        scale: 'regional',
        summary,
        actors: [{ id: woken.id, name: woken.name, role: 'woken' }],
        locationId: woken.locationId,
        factionIds: [house.id],
        causes: cause ? [cause] : [],
        visibility: 'public',
        magnitude: 0.75,
        data: { cascade: 'hold', depth },
        unattributed: 'Nobody is collecting at that gate any more, and the people who used '
            + 'to have not explained why they stopped.'
    });
    return step(
        depth, 'woken', house, 'hold', considered, summary, fact, [],
        { factions: [house.id], npcs: [woken.id] }, []
    );
}

function applyDepart(
    state: WorldState,
    precipitant: Precipitant,
    house: FactionRecord,
    woken: NpcRecord,
    considered: WeighedOption[],
    cause: string | null,
    depth: number
): CascadeStep {
    replaceNpc(state, markMissing(
        woken, precipitant.day,
        'Walked out of the opened hall and did not stop.'
    ));
    const summary = `${woken.name} was woken by the ${house.name} and left. `
        + 'The house spent the only thing it had and got nothing.';
    const fact = emit(state, {
        day: precipitant.day,
        kind: 'death',
        scale: 'regional',
        summary,
        actors: [{ id: woken.id, name: woken.name, role: 'departed' }],
        locationId: woken.locationId,
        factionIds: [house.id],
        causes: cause ? [cause] : [],
        visibility: 'faction',
        truth: 'unresolved',
        claimedOutcomes: [
            'went looking for the house that did it',
            'went back to sleep somewhere else',
            'did not recognise the world and walked into the hills',
            'is still on the road'
        ],
        causeKnown: false,
        fidelity: 'rumour',
        magnitude: 0.6,
        data: { cascade: 'depart', depth },
        unattributed: 'Somebody walked the length of the valley without stopping and every '
            + 'dog in every village went quiet as they passed.'
    });
    return step(
        depth, 'woken', house, 'depart', considered, summary, fact, [],
        { factions: [house.id], npcs: [woken.id] }, []
    );
}

/**
 * The asset is spent, and the map is different afterwards.
 *
 * Three consequences, all of them computed and all of them permanent:
 *
 *   THE GROUND   `forbidZone` at the target, with the survival bar set from the
 *                spent ordinal. The place stops being a seat and becomes
 *                geography - a scar somebody can stand in three centuries later
 *                and read the change history of.
 *   THE PEOPLE   everybody there dies who `couldDieToADisaster`, which is
 *                `catastrophe.ts`'s own predicate, applied per person. Anybody
 *                past Grand Ascension walks out, which is how the exposure
 *                table's three tiers reproduce themselves without being read.
 *   THE ASSET    spent. `markDead`, and the house's ceiling was already zeroed
 *                at the unsealing. There is no second one anywhere.
 */
function applyExpend(
    state: WorldState,
    precipitant: Precipitant,
    house: FactionRecord,
    woken: NpcRecord,
    aggressor: FactionRecord,
    target: LocationRecord,
    considered: WeighedOption[],
    cause: string | null,
    depth: number
): CascadeStep {
    const ordinal = woken.cultivation.realmOrdinal;
    const day = precipitant.day;

    // ── The ground ───────────────────────────────────────────────────────
    // The bar is the spent ordinal less the same four rungs `pressure.ts`
    // already treats as the edge of what anybody can give away, so what is left
    // is survivable only by people at the height of whatever did it.
    const { location: forbidden, change } = forbidZone(target, {
        onDay: day,
        summary: `${target.name} stopped being a place. ${woken.name} was spent on it.`,
        survivalOrdinal: Math.max(0, ordinal - 4),
        operationalOrdinal: ordinal,
        hazards: ['corrosive', 'thin_qi', 'pressure'],
        causeFactId: cause,
        causeKnown: true,
        witnessed: true,
        attributedCauses: []
    });
    // And the qi went with it. A place spent at this height does not recover;
    // `locationFromScar` says the same thing about tribulation ground, in the
    // same fields, which is the point - this is the ordinary way ground dies.
    const { location: scarred, change: scarChange } = applyLocationChange(forbidden, {
        onDay: day,
        kind: 'spiritual_conditions_changed',
        summary: `The ground at ${target.name} does not hold qi and has not since.`,
        causeFactId: cause,
        causeKnown: true,
        witnessed: false,
        patch: {
            qiDensity: QI_DENSITY_MIN,
            ambient: 'thin',
            controllingFactionId: null,
            environment: {
                spiritualDensity: 0,
                politicalControl: 'nobody, and nobody wants it',
                specialRules: ['the qi does not return here'],
                historicalScars: ['spent at close range']
            },
            addTags: ['scar', 'permanent']
        }
    });
    replaceLocation(state, scarred);

    // ── The people ───────────────────────────────────────────────────────
    const present = state.npcs.filter(
        n => n.status === 'alive' && isBelowTheLid(n) && n.locationId === target.id
    );
    const deaths: DeathHandoff[] = [];
    const killedIds: string[] = [];
    let strongestSurvivor = -1;
    for (const npc of present) {
        if (couldDieToADisaster(npc.cultivation.realmOrdinal)) {
            replaceNpc(state, markDead(npc, day, `Was at ${target.name}.`));
            deaths.push(settleNpcDeath(state, npc, day));
            killedIds.push(npc.id);
        } else {
            strongestSurvivor = Math.max(strongestSurvivor, npc.cultivation.realmOrdinal);
        }
    }

    // ── The house it was spent on ────────────────────────────────────────
    //
    // Derived, never looked up. If nobody who was there is above the bar the
    // institution is gone; if somebody is, it is one person and a name, which
    // is `reduced_to_its_head` arrived at from the roster instead of the table.
    const survivedIntact = strongestSurvivor >= UNTOUCHED_BY_DISASTER_ORDINAL;
    if (survivedIntact) {
        aggressor.resources.veins = 0;
        aggressor.resources.spirit_stones = 0;
        aggressor.controlledLocationIds = [];
        aggressor.seatLocationId = null;
        aggressor.tags = Array.from(new Set(aggressor.tags.concat('reduced_to_its_head')));
    } else {
        aggressor.dissolvedOnDay = day;
        for (const npc of membersOf(state, aggressor.id)) {
            replaceNpc(state, {
                ...npc, factionId: null, factionRankIndex: -1, updatedOnDay: day
            });
        }
    }

    // ── The asset ────────────────────────────────────────────────────────
    replaceNpc(state, markDead(woken, day, `Was spent on ${target.name}.`));
    deaths.push(settleNpcDeath(state, woken, day));

    const summary =
        `${woken.name}, ${rankName(ordinal)}, was spent on ${target.name}. `
        + `${killedIds.length} dead. `
        + (survivedIntact
            ? `The ${aggressor.name} is one person and a name.`
            : `The ${aggressor.name} does not exist.`)
        + ' The ground is not ground any more.';

    const fact = emit(state, {
        day,
        kind: 'catastrophe',
        scale: 'regional',
        summary,
        actors: [{ id: woken.id, name: woken.name, role: 'spent' }],
        locationId: target.id,
        factionIds: [house.id, aggressor.id],
        locationChangeIds: [change.id, scarChange.id],
        causes: cause ? [cause] : [],
        visibility: 'public',
        magnitude: 1,
        data: {
            cascade: 'expend', depth, ordinal,
            killed: killedIds.length,
            reducedToItsHead: survivedIntact
        },
        unattributed:
            'Whatever happened on the far side of the range was visible from here, at '
            + 'night, for a week. Nothing has come down that road since and the people who '
            + 'went to look did not come back.'
    });

    return step(
        depth, 'woken', house, 'expend', considered, summary, fact,
        [change.id, scarChange.id],
        {
            factions: [house.id, aggressor.id],
            locations: [target.id],
            npcs: [woken.id, ...killedIds]
        },
        deaths
    );
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function membersOf(state: WorldState, factionId: string): NpcRecord[] {
    return state.npcs.filter(
        n => n.factionId === factionId && n.status === 'alive' && isBelowTheLid(n)
    );
}

/** The best-placed live faction that stands above this one, or nobody. */
function patronFor(state: WorldState, house: FactionRecord): FactionRecord | null {
    let best: FactionRecord | null = null;
    for (const f of state.factions) {
        if (f.id === house.id || f.dissolvedOnDay !== null || !isBelowTheLid(f)) continue;
        if ((house.standing[f.id] ?? 0) < PATRON_STANDING) continue;
        if (Number(f.resources.spirit_stones ?? 0) < PATRON_SOLVENCY) continue;
        if (!best || Number(f.resources.power_ordinal ?? 0) > Number(best.resources.power_ordinal ?? 0)) {
            best = f;
        }
    }
    return best;
}

/** Weighted draw over priced options. Returns null on an empty table. */
function draw(options: readonly WeighedOption[], rng: CultivationRNG): CascadeOption | null {
    const usable = options.filter(o => o.weight > 0);
    if (usable.length === 0) return null;
    const total = usable.reduce((s, o) => s + o.weight, 0);
    let cursor = rng.next() * total;
    for (const o of usable) {
        cursor -= o.weight;
        if (cursor < 0) return o.option;
    }
    return usable[usable.length - 1].option;
}

function replaceNpc(state: WorldState, next: NpcRecord): void {
    const at = state.npcs.findIndex(n => n.id === next.id);
    if (at >= 0) state.npcs[at] = next;
}

function replaceLocation(state: WorldState, next: LocationRecord): void {
    const at = state.locations.findIndex(l => l.id === next.id);
    if (at >= 0) state.locations[at] = next;
}

type EmitInput = Omit<Parameters<typeof makeFact>[0], 'data'> & {
    data?: Record<string, string | number | boolean | null>;
    /** What somebody who can name none of the parties notices instead. */
    unattributed: string;
};

function emit(state: WorldState, input: EmitInput): HistoricalFact {
    const { unattributed, data, ...rest } = input;
    return appendWorldFact(state, makeFact({
        ...rest,
        data: { ...(data ?? {}), unattributed }
    }));
}

function step(
    depth: number,
    partyKind: CascadeStep['partyKind'],
    house: FactionRecord,
    chosen: CascadeOption,
    considered: WeighedOption[],
    summary: string,
    fact: HistoricalFact | null,
    locationChangeIds: string[],
    touched: Partial<CascadeStep['touched']>,
    deaths: DeathHandoff[]
): CascadeStep {
    return {
        depth,
        partyKind,
        partyId: house.id,
        partyName: house.name,
        chosen,
        considered,
        summary,
        factId: fact?.id ?? null,
        locationChangeIds,
        touched: {
            factions: touched.factions ?? [],
            locations: touched.locations ?? [],
            npcs: touched.npcs ?? []
        },
        deaths
    };
}
