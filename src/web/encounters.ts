/**
 * The turn loop's adapter onto `src/engine/encounters/`.
 */

import {
    rollEncounters,
    arrivableFromUnheard,
    assessFit,
    locatabilityFrom,
    boardRefusals,
    commissionBoard,
    type Find,
    type Seeker,
    type Suitability,
    type DutyCandidate,
    type ArrivableFact,
    type Duty,
    type EncounterActivity,
    type Contact,
    type ContactPerson,
    type Locatability,
    type Membership,
    type EncounterName,
    type EncounterPerson,
    type EncounterPlace,
    type EncounterRoll,
    type EncounterStance,
    type EncounterValence
} from '../engine/encounters/index.js';
import { rungAndOrdinal } from './facts.js';
import type { Cultivator, SimEvent } from '../schema/cultivation.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { npcsAt, type WorldState } from '../engine/world/world-state.js';
import { dangerDeltaInArea } from '../engine/world/what-is-true-of-a-place-right-now.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { KnowledgeGate } from './knowledge.js';
import { createGrudge, createOath, settleObligation } from '../engine/social/grudges.js';
import {
    createRelationship,
    recordRelationshipEvent,
    updateRelationship,
    type Relationship,
    type RelationshipType
} from '../engine/social/relationships.js';
import { getMembersOf } from '../data/cultivation/members.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import type { ObligationRecord } from '../engine/social/grudges.js';
import { othersPresent } from './hearsay.js';
import { worldLocationFor } from './entities.js';
// One direction only. `pending-summons.ts` imports the flag helpers, the house
// arithmetic and the leadership prices, and imports nothing from this file -
// which is what keeps the ledger writers below and the ask above it out of a
// cycle. The refusal itself is composed in `turn-engine.ts`, which has both.
import { rememberSummons } from './pending-summons.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A VERB IS, AS FAR AS THE WORLD IS CONCERNED
// ─────────────────────────────────────────────────────────────────────────

/**
 * The web layer's verbs, coarsened to the seven things the world can reach.
 */
const VERB_ACTIVITY: Readonly<Record<string, EncounterActivity>> = {
    seclude: 'sealed',
    cultivate: 'seclusion',
    move: 'travel',
    travel: 'travel',
    gather: 'gathering',
    forage: 'gathering',
    investigate: 'gathering',
    explore: 'gathering',
    enter: 'gathering',
    look: 'abroad',
    ask: 'abroad',
    interact: 'abroad',
    talk: 'abroad',
    trade: 'abroad',
    buy: 'abroad',
    provision: 'abroad',
    wait: 'labour',
    work: 'labour',
    requisition: 'labour',
    treat: 'convalescence',
    rest: 'convalescence'
};

/**
 * The roll identity for THE player of a run.
 */
export const PLAYER_ROLL_IDENTITY = 'player';

export function activityForVerb(verb: string): EncounterActivity {
    return VERB_ACTIVITY[verb] ?? 'labour';
}

// ─────────────────────────────────────────────────────────────────────────
// BUILDING THE INPUT
// ─────────────────────────────────────────────────────────────────────────

export interface EncounterDeps {
    repos: CultivationRepos;
    knowledge: KnowledgeGate;
    /** The loaded world, when there is one. Null is legal and degrades honestly. */
    world: WorldState | null;
}

export interface EncounterRequest {
    seed: string;
    /** `Math.floor(run.elapsedDays)`. */
    startDay: number;
    days: number;
    activity: EncounterActivity;
    cultivator: Cultivator;
    /** Unheard world facts eligible to arrive. See `arrivableForSpan`. */
    arrivable?: readonly ArrivableFact[];
    /**
     * What the roll's RNG streams are keyed to, beside the seed.
     */
    rollIdentity?: string;
    /** Whether anybody could find them. See `locatabilityFor`. */
    locatability?: Locatability;
    /** Their house, when they have one. See `membershipFor`. */
    membership?: Membership | null;
    /** The house roster. See `rosterFor`. Derived when omitted. */
    roster?: readonly ContactPerson[];
}

/** Roll the window. Call this BEFORE provisioning or simulating anything. */
export function encountersFor(deps: EncounterDeps, request: EncounterRequest): EncounterRoll {
    const { cultivator } = request;
    return rollEncounters({
        seed: request.seed,
        startDay: request.startDay,
        days: request.days,
        activity: request.activity,
        cultivator: {
            // Not necessarily the row id. See `rollIdentity`.
            id: request.rollIdentity ?? cultivator.id,
            realmOrdinal: cultivator.realmOrdinal,
            fortune: cultivator.attributes.fortune,
            maxHp: cultivator.maxHp,
            hp: cultivator.hp,
            spiritStones: cultivator.spiritStones,
            factionId: cultivator.sectId ?? null
        },
        place: placeFor(deps.world, cultivator),
        cast: castFor(deps, cultivator),
        names: namesFor(deps, cultivator),
        arrivable: request.arrivable,
        membership: request.membership ?? membershipFor(deps, cultivator),
        locatability: request.locatability ?? locatabilityFor(deps, cultivator),
        roster: request.roster ?? rosterFor(deps, cultivator)
    });
}

/**
 * Whether anybody could find this cultivator where they are.
 */
export function locatabilityFor(deps: EncounterDeps, cultivator: Cultivator): Locatability {
    const record = deps.world ? worldLocationFor(deps.world, cultivator.location) : null;
    if (!record) return 'private';
    return locatabilityFrom(record, deps.repos.sects.getMembership(cultivator.id)?.sectId ?? null);
}

/**
 * Where they are standing, as the encounter layer reads it.
 */
export function placeFor(world: WorldState | null, cultivator: Cultivator): EncounterPlace {
    const name = (cultivator.location ?? 'somewhere').trim() || 'somewhere';
    const record: LocationRecord | null = world ? worldLocationFor(world, cultivator.location) : null;
    if (!record) {
        return { id: name.toLowerCase(), name, kind: 'wilds', danger: 0.25 };
    }
    const today = Math.floor(world!.currentDay);
    const wrongHere = dangerDeltaInArea(world!.statuses, world!.locations, record.id, today);
    return {
        id: record.id,
        name: record.name,
        kind: record.kind,
        danger: Math.max(0, Math.min(1, record.environment.danger + wrongHere)),
        qiDensity: record.qiDensity,
        hazards: record.hazards,
        controllingFactionId: record.controllingFactionId,
        sealed: record.sealed,
        company: {
            heads: npcsAt(world!, record.id).length + 1,
            settledShare: settledShareOf(record.kind)
        }
    };
}

/**
 * How much of a place's population is sitting rather than moving about.
 */
function settledShareOf(kind: string): number {
    switch (kind) {
        // Ground people go to in order to sit, and nothing else.
        case 'cave':
        case 'vein':
        case 'secret_realm':
        case 'sealed_domain':
            return 0.9;
        // A sect's own mountain: disciples behind doors, and its own people and
        // formations around them. The case that was measured backwards.
        case 'sect_seat':
        case 'precinct':
        case 'chamber':
        case 'vault':
            return 0.75;
        case 'hall':
            return 0.5;
        // Nobody is in seclusion in a market.
        case 'settlement':
            return 0.1;
        default:
            return 0.35;
    }
}

/**
 * Who is standing there, and whether the player can already name them.
 */
export function castFor(deps: EncounterDeps, cultivator: Cultivator): EncounterPerson[] {
    return othersPresent(deps.repos, cultivator, deps.world).map(row => ({
        id: row.id,
        name: row.name,
        realmOrdinal: row.realmOrdinal,
        factionId: row.sectId,
        factionName: row.sectName,
        rank: row.sectRank,
        known: deps.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id)
    }));
}

/**
 * Names the summary is permitted to draw on, flagged with whether this player has
 * heard them.
 */
export function namesFor(deps: EncounterDeps, cultivator: Cultivator): { factions: EncounterName[] } {
    const factions = (deps.world?.factions ?? []).map(faction => ({
        id: faction.id,
        name: faction.name,
        known: deps.knowledge.isAwareOf(cultivator.id, 'sect', faction.id)
    }));
    return { factions };
}

/**
 * The unheard half of a world digest, offered for arrival.
 */
export function arrivableForSpan<F extends { id: string; day: number; magnitude: number; kind?: string }>(
    facts: readonly F[],
    reportedFactIds: readonly string[],
    consequenceText: (fact: F) => string
) {
    return arrivableFromUnheard({ facts, reportedFactIds, consequenceText });
}

// ─────────────────────────────────────────────────────────────────────────
// APPLYING IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * How many days the cultivator actually gets to spend.
 *
 * Always at least one, so a window that interrupts on its own first day still
 * advances the clock and cannot loop.
 */
export function daysActuallySpent(roll: EncounterRoll, startDay: number, requested: number): number {
    if (roll.firstInterruptDay === null) return requested;
    return Math.max(1, Math.min(requested, roll.firstInterruptDay - startDay));
}

/**
 * The roll, cut down to the days that were actually LIVED.
 */
export function cutTo(roll: EncounterRoll, startDay: number, lived: number): EncounterRoll {
    const lastDay = Math.floor(startDay) + Math.max(0, Math.floor(lived));
    const kept = roll.occurrences.filter(o => o.absoluteDay <= lastDay);
    if (kept.length === roll.occurrences.length) return roll;

    const interrupt = kept.find(o => o.interrupts) ?? null;
    return {
        ...roll,
        occurrences: kept,
        firstInterruptDay: interrupt ? interrupt.absoluteDay : null
    };
}

/**
 * What the occurrences this roll no longer contains had already been credited.
 */
export function deltasDroppedBy(full: EncounterRoll, cut: EncounterRoll): { hp: number; spiritStones: number } {
    const survived = new Set(cut.occurrences.map(o => o.id));
    let hp = 0;
    let spiritStones = 0;
    for (const occurrence of full.occurrences) {
        if (survived.has(occurrence.id)) continue;
        hp += occurrence.deltas.hp;
        spiritStones += occurrence.deltas.spiritStones;
    }
    return { hp, spiritStones };
}

/**
 * Fold what the engine settled on its own into the cultivator.
 */
export function withEncounterDeltas(cultivator: Cultivator, roll: EncounterRoll): Cultivator {
    let hp = 0;
    let stones = 0;
    for (const occurrence of roll.occurrences) {
        hp += occurrence.deltas.hp;
        stones += occurrence.deltas.spiritStones;
    }
    if (hp === 0 && stones === 0) return cultivator;
    return {
        ...cultivator,
        hp: Math.max(1, Math.min(cultivator.maxHp, cultivator.hp + hp)),
        spiritStones: Math.max(0, cultivator.spiritStones + stones)
    };
}

/**
 * Drop everything that has now turned up, and keep the rest pending.
 */
export function consumeArrivals(
    pending: readonly ArrivableFact[],
    roll: EncounterRoll
): ArrivableFact[] {
    const arrived = new Set(
        roll.occurrences
            .filter(o => o.source === 'digest')
            .map(o => String(o.event.data.factId))
    );
    return pending.filter(fact => !arrived.has(fact.factId));
}

/**
 * The two encounter enums, resolved to what they name.
 */
const VALENCE_IN_WORDS: Record<EncounterValence, string> = {
    good: 'and it went in this cultivator\'s favour',
    bad: 'and it went against them',
    neutral: 'and it went neither way'
};

const STANCE_IN_WORDS: Record<Exclude<EncounterStance, 'none'>, string> = {
    engaged: 'It was a real fight, and the combat resolver was handed it.',
    above: 'Whatever it was stands far enough above that engagement was never on the table. '
        + 'It did not look up.',
    beneath: 'Whatever it was stands far enough below that it cost nothing. The room '
        + 'rearranged itself around them.'
};

export interface RecordedEncounters {
    /** Merge into `skip.events` and sort by `dayOffset`. */
    events: SimEvent[];
    /** Push onto `facts.lines`. Engine-authored; safe for a narrator. */
    lines: string[];
    /** Push onto `facts.structure`. Operator channel, never narrated. */
    structure: string[];
    /** Names that genuinely entered this player's world this span. */
    learned: string[];
    /** People whose standing with this cultivator moved this span. */
    met: string[];
}

/**
 * Write the knowledge grants and hand back what the narrator may say.
 */
export function recordEncounters(
    knowledge: KnowledgeGate,
    cultivator: Cultivator,
    onDay: number,
    roll: EncounterRoll,
    /**
     * Supply this and ordinary contact with the house is written to `relationships`
     * and `relationship_events`. Omit it and the contacts still HAPPEN - the lines
     * and the events are the same - and nothing accumulates, so the twelfth meeting
     * is another first. Optional only so that a caller with no database (an odds
     * harness, a design guard) can still read a roll.
     */
    repos?: CultivationRepos
): RecordedEncounters {
    const learned: string[] = [];
    const met: string[] = [];

    for (const occurrence of roll.occurrences) {
        // The tie moves BEFORE anything is narrated, for the same reason a
        // knowledge grant does: phase 3 gets a licence to mention something the
        // database already holds, never the other way round.
        if (repos && occurrence.contact) {
            recordContact(repos, cultivator, Math.floor(onDay), occurrence.contact);
            met.push(occurrence.contact.person.name);
        }
        // ── THE ASK IS KEPT, WHICH IS WHAT MAKES IT AN ASK ───────────────
        //
        // `occurrence.duty` had no reader anywhere in `src/web`. A summons
        // interrupted the span, printed its sentence, and was gone by the next
        // turn - so there was nothing to answer and nothing to refuse, and
        // `refuseDuty`'s `'refused'` and `'lapsed'` outcomes had no caller in
        // the repository. `resolveOccurrence` says what that made it: "a
        // summons that a cultivator sat through without noticing is a
        // notification, and the point of the whole mechanism is that it is
        // not one."
        //
        // Written here rather than in the callers for the reason the contact
        // above is: this is the one place a roll's occurrences are consumed,
        // and both player paths through `seclusion-verbs.ts` come through it.
        if (repos && occurrence.duty) {
            rememberSummons(repos, cultivator.id, {
                duty: occurrence.duty,
                // `entryId` is nullable for the occurrences that are not read
                // off a catalog row at all. One carrying a duty always is -
                // `resolveOccurrence` sets `id` and `entryId` from the same
                // `entry.id` - so the fallback is the same value rather than a
                // guess, and it is here to satisfy the type honestly.
                entryId: occurrence.entryId ?? occurrence.id,
                what: occurrence.event.summary,
                spokenOnDay: Math.floor(onDay) + occurrence.dayOffset
            });
        }
        for (const grant of occurrence.grants) {
            const isNew = knowledge.learnIfNew({
                holderId: cultivator.id,
                kind: grant.kind,
                id: grant.id,
                name: grant.name,
                onDay: Math.floor(onDay),
                sourceKind: grant.sourceKind,
                sourceNote: grant.sourceNote,
                stance: grant.stance,
                confidence: grant.confidence,
                statement: grant.statement
            });
            if (isNew) learned.push(grant.name);
        }
    }

    return {
        events: roll.occurrences.map(o => o.event),
        lines: roll.occurrences.map(o => o.event.summary),
        structure: roll.occurrences.map(o =>
            `Day ${o.dayOffset}: ${o.kind.replace(/_/g, ' ')}, ${VALENCE_IN_WORDS[o.valence]} `
            + `(catalog row ${o.id}).`
            + (o.stance === 'none' ? '' : ` ${STANCE_IN_WORDS[o.stance]}`)
            + (o.confrontation
                ? ` ${o.confrontation.count} of them, standing at `
                  + `${rungAndOrdinal(o.confrontation.threatOrdinal)}, and what they land on this `
                  + `cultivator counts ${o.confrontation.damageMultiplier} times over.`
                : '')
            + (o.interrupts
                ? ' It stopped the span where it stood; nothing dated after it was lived.'
                : '')),
        learned,
        met
    };
}

/**
 * Inspector rows, one per thing that happened.
 *
 * Shaped for `ToolCallRecord` without importing it, because `game.ts` imports
 * this module and a value import back the other way would be a cycle.
 */
export function encounterCalls(
    roll: EncounterRoll,
    verb: string,
    /**
     * The roll before {@link cutTo}, when the caller made one.
     */
    rolled?: EncounterRoll
): {
    name: string;
    action: string;
    summary: string;
    ok: boolean;
}[] {
    const rows = roll.occurrences.map(o => ({
        name: 'encounters.rollEncounters',
        action: verb,
        summary: o.event.summary,
        ok: true
    }));

    const dropped = rolled ? rolled.occurrences.length - roll.occurrences.length : 0;
    if (dropped > 0) {
        rows.push({
            name: 'encounters.rollEncounters',
            action: verb,
            summary:
                `The window was rolled and ${dropped} of its ${rolled!.occurrences.length} `
                + 'occurrence(s) fell after the day the stretch actually ended. They did not '
                + 'happen and are not reported: the skip stopped before them.',
            ok: true
        });
    }
    return rows;
}

// ─────────────────────────────────────────────────────────────────────────
// MEMBERSHIP, THE BOARD, AND THE LEDGER
//
// Three writes that between them make a membership mean something. Before
// this, `sect_members.contribution` was a real column with no way whatever to
// earn it, and the `obligations` tables were created by a migration and read
// in exactly one place with nothing ever writing a row. Both were dormant
// systems of the same kind as the encounter catalog: built, correct, and
// unreachable.
// ─────────────────────────────────────────────────────────────────────────

/** What the cultivator belongs to, or null. Reads the two rows that decide it. */
export function membershipFor(deps: EncounterDeps, cultivator: Cultivator): Membership | null {
    const held = deps.repos.sects.getMembership(cultivator.id);
    if (!held) return null;
    const sect = deps.repos.sects.getById(held.sectId);
    if (!sect) return null;
    return {
        factionId: held.sectId,
        factionName: sect.name,
        rankIndex: held.rankIndex,
        // The house's own ladder, so a share of it means the same thing in a
        // four-rung house and a seven-rung one.
        rankCount: Math.max(1, sect.ranks.length),
        contribution: held.contribution
    };
}

export interface SectBoard {
    membership: Membership | null;
    /** What is on offer, best-paying first. */
    offers: DutyCandidate[];
    /**
     * What was on the wall and is not being put to this person, with the engine's
     * own line about why.
     */
    refusals: { entryId: string; name: string; reason: string }[];
}

/**
 * What a cultivator standing in front of a mission board can see.
 */
export function sectBoardFor(deps: EncounterDeps, cultivator: Cultivator): SectBoard {
    const membership = membershipFor(deps, cultivator);
    const offers = commissionBoard(cultivator.realmOrdinal, membership)
        .sort((a, b) => b.terms.contribution - a.terms.contribution ||
            b.terms.stones - a.terms.stones ||
            (a.entry.id < b.entry.id ? -1 : 1));

    return {
        membership,
        offers,
        refusals: boardRefusals(cultivator.realmOrdinal, membership).map(row => ({
            entryId: row.entry.id,
            name: row.entry.name,
            reason: row.regard.reaction
        }))
    };
}

/**
 * A board offer, turned into the settled thing the ledger writes.
 */
export function dutyFromOffer(
    candidate: DutyCandidate,
    membership: Membership | null,
    onDay: number
): Duty {
    const { terms } = candidate;
    return {
        origin: terms.origin,
        posture: terms.posture,
        factionId: membership?.factionId ?? null,
        factionName: membership?.factionName ?? null,
        days: terms.days,
        contribution: terms.contribution,
        stones: terms.stones,
        pitchOrdinal: terms.pitchOrdinal,
        dueOnDay: onDay + terms.days,
        refusal: terms.refusal,
        scale: terms.scale,
        cohort: terms.cohort,
        access: terms.access,
        spokenBy: null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHETHER A THING IS FOR YOU, SAID OUT LOUD
//
// `assessFit` has produced the sentence this whole layer exists to deliver -
// "it is sound. It is written for water. This cultivator draws fire. Sitting
// with it will teach them nothing, however long they sit" - and until now no
// verb returned it. Without it a player who picks up an art that does not suit
// them learns the wrong lesson: that they should sit LONGER, rather than that
// they should go somewhere else. That is the exact inversion the suitability
// system was built to prevent.
//
// Nothing is decided here. Both halves are a join from rows that exist onto the
// shape the engine already reads.
// ─────────────────────────────────────────────────────────────────────────

/** A cultivator as the suitability layer reads them. */
export function seekerFor(cultivator: Cultivator): Seeker {
    const root = getSpiritRoot(cultivator.spiritRoot);
    const insights: Record<string, number> = {};
    for (const insight of cultivator.insights ?? []) {
        const held = insights[insight.domain] ?? 0;
        insights[insight.domain] = Math.max(held, insight.degree);
    }
    return {
        ordinal: cultivator.realmOrdinal,
        elements: root.elements,
        rootGrade: root.grade,
        foundationQuality: cultivator.foundationQuality ?? null,
        insights,
        yearsCultivated: cultivator.yearsAtCurrentRealm
    };
}

/**
 * A catalog art as a thing somebody might or might not be able to use.
 */
export function findFromTechnique(technique: {
    id: string;
    name: string;
    requiredOrdinal: number;
    element?: string | null;
    domain?: string | null;
    domainDegree?: number;
    rootGrades?: readonly string[];
}): Find {
    return {
        id: technique.id,
        name: technique.name,
        kind: 'manual',
        gradeOrdinal: technique.requiredOrdinal,
        elements: technique.element ? [technique.element] : [],
        domain: technique.domain ?? null,
        domainDegree: technique.domainDegree ?? 1,
        rootGrades: technique.rootGrades ?? []
    };
}

/** The engine's own sentence about whether this art is for this person. */
export function fitOf(cultivator: Cultivator, technique: Parameters<typeof findFromTechnique>[0]): Suitability {
    return assessFit(findFromTechnique(technique), seekerFor(cultivator));
}

// -- the ledger -----------------------------------------------------------

/**
 * Write an obligation row.
 */
export function writeObligation(
    db: DatabaseHandle | { prepare: (sql: string) => never },
    record: ObligationRecord
): ObligationRecord {
    return writeObligationRow(db as DatabaseHandle, record);
}

function writeObligationRow(db: DatabaseHandle, record: ObligationRecord): ObligationRecord {
    db.prepare(`
        INSERT OR REPLACE INTO obligations (
            id, kind, holder_id, subject_id, cause, severity, incurred_on_day,
            triggering_event_id, description, participants, tags, terms, due_on_day,
            status, settlement_resolution, settled_on_day, settled_by_id, settlement_note,
            inheritance, generation, origin_holder_id, from_belief, recorded_on_day
        ) VALUES (
            @id, @kind, @holderId, @subjectId, @cause, @severity, @incurredOnDay,
            @triggeringEventId, @description, @participants, @tags, @terms, @dueOnDay,
            @status, @settlementResolution, @settledOnDay, @settledById, @settlementNote,
            @inheritance, @generation, @originHolderId, @fromBelief, @recordedOnDay
        )
    `).run({
        id: record.id,
        kind: record.kind,
        holderId: record.holderId,
        subjectId: record.subjectId,
        cause: record.cause,
        severity: record.severity,
        incurredOnDay: record.incurredOnDay,
        triggeringEventId: record.triggeringEventId,
        description: record.description,
        participants: JSON.stringify(record.participants),
        tags: JSON.stringify(record.tags),
        terms: record.terms,
        dueOnDay: record.dueOnDay,
        status: record.status,
        settlementResolution: record.settlement?.resolution ?? null,
        settledOnDay: record.settlement?.onDay ?? null,
        settledById: record.settlement?.byId ?? null,
        settlementNote: record.settlement?.note ?? null,
        inheritance: JSON.stringify(record.inheritance),
        generation: record.generation,
        originHolderId: record.originHolderId,
        fromBelief: record.fromBelief ? 1 : 0,
        recordedOnDay: record.recordedOnDay
    });
    return record;
}

/** Minimal shape of the handle `repos.db` is. Avoids a value import. */
export interface DatabaseHandle {
    prepare(sql: string): {
        run(params: Record<string, unknown>): unknown;
        get(...params: unknown[]): unknown;
        all(...params: unknown[]): unknown;
    };
}

export interface DutyLedgerInput {
    repos: CultivationRepos;
    cultivator: Cultivator;
    duty: Duty;
    /** Absolute day. `Math.floor(run.elapsedDays)`. */
    onDay: number;
    /** Catalog row this duty was read off, for the description. */
    entryId: string;
    /** What the situation was, factually. Usually the occurrence summary. */
    what: string;
}

/**
 * Taking it on.
 */
export function acceptDuty(input: DutyLedgerInput): ObligationRecord {
    const { duty, cultivator } = input;
    return writeObligation(input.repos.db as unknown as DatabaseHandle, createOath({
        holderId: cultivator.id,
        subjectId: duty.factionId ?? 'unaffiliated',
        cause: duty.origin === 'summons' ? 'sect_vow' : 'service_term',
        severity: duty.refusal.severity,
        onDay: input.onDay,
        description: `${input.what} Accepted on day ${input.onDay}.`,
        terms: `${duty.days} days. Paid on completion: ` +
            `${duty.contribution} contribution, ${duty.stones} spirit stones.`,
        dueOnDay: duty.dueOnDay,
        tags: ['duty', duty.origin, input.entryId]
    }));
}

export interface DutySettlementResult {
    obligation: ObligationRecord;
    /** Contribution actually credited. Zero outside a house. */
    contribution: number;
    stones: number;
    /** Engine-authored, for `facts.lines`. */
    line: string;
}

/**
 * Finishing it.
 */
export function completeDuty(input: DutyLedgerInput): DutySettlementResult {
    const { duty, cultivator, repos } = input;
    const oath = createOath({
        holderId: cultivator.id,
        subjectId: duty.factionId ?? 'unaffiliated',
        cause: duty.origin === 'summons' ? 'sect_vow' : 'service_term',
        severity: duty.refusal.severity,
        onDay: input.onDay,
        description: `${input.what} Accepted on day ${input.onDay}.`,
        terms: null,
        dueOnDay: duty.dueOnDay,
        tags: ['duty', duty.origin, input.entryId]
    });

    const settled = settleObligation(oath, {
        resolution: 'oath_fulfilled',
        onDay: input.onDay,
        byId: cultivator.id,
        note: `Completed by day ${input.onDay}.`
    });

    let credited = 0;
    repos.db.transaction(() => {
        writeObligation(repos.db as unknown as DatabaseHandle, settled);
        if (duty.factionId && duty.contribution > 0) {
            repos.sects.addContribution(duty.factionId, cultivator.id, duty.contribution);
            credited = duty.contribution;
        }
        if (duty.stones > 0) {
            repos.cultivators.applyDeltas(cultivator.id, { spiritStones: duty.stones });
        }
    })();

    return {
        obligation: settled,
        contribution: credited,
        stones: duty.stones,
        line: credited > 0
            ? `Completed. ${credited} contribution credited with ` +
              `${duty.factionName ?? 'the house'}, and ${duty.stones} spirit stones paid.`
            : `Completed. ${duty.stones} spirit stones paid, and nothing on anybody's ledger.`
    };
}

/**
 * Walking away, whether before starting or after.
 */
export function refuseDuty(
    input: DutyLedgerInput & { outcome: 'refused' | 'failed' | 'lapsed' }
): { obligation: ObligationRecord; line: string } {
    const { duty, cultivator } = input;
    const holder = duty.factionId ?? 'unaffiliated';

    const what = input.outcome === 'refused'
        ? 'Declined when asked.'
        : input.outcome === 'failed'
            ? 'Took it on and did not finish it.'
            : `The term ran out on day ${duty.dueOnDay} with nothing done.`;

    const record = createGrudge({
        holderId: holder,
        subjectId: cultivator.id,
        cause: duty.refusal.cause,
        severity: duty.refusal.severity,
        onDay: input.onDay,
        description: `${input.what} ${what} ${duty.refusal.description}`,
        terms: null,
        dueOnDay: null,
        tags: ['duty', duty.origin, input.outcome, input.entryId]
    });

    writeObligation(input.repos.db as unknown as DatabaseHandle, record);

    return {
        obligation: record,
        line: duty.factionName
            ? `${duty.factionName} has recorded it. Severity as written: ${duty.refusal.severity}.`
            : `It was noticed. Severity as written: ${duty.refusal.severity}.`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE PEOPLE YOU LIVE WITH
//
// `members.ts` already holds 164 people with names, rungs, ranks, what they
// want, what they fear, what they will not say, who they have a grievance
// with and what they can teach. The `relationships` and `relationship_events`
// tables have existed since the social migration with nothing writing to them.
// This is the join: the roster becomes a cast, and contact with it accumulates
// into rows instead of being forgotten between turns.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The house's roster, with whatever the record already says about each of them.
 */
export function rosterFor(deps: EncounterDeps, cultivator: Cultivator): ContactPerson[] {
    const membership = membershipFor(deps, cultivator);
    if (!membership) return [];

    const standing = standingsFor(deps.repos.db as unknown as DatabaseHandle, cultivator.id);

    return getMembersOf(membership.factionId).map(member => ({
        id: member.id,
        name: member.name,
        rankIndex: member.rankIndex,
        realmOrdinal: member.realmOrdinal,
        role: member.role,
        wants: member.wants,
        fears: member.fears,
        detail: member.detail,
        goodCompany: member.goodCompany,
        // The catalog states the grievance and what it is over. Reading the
        // first clause here rather than composing one keeps the quarrel the
        // author's rather than the engine's.
        grievance: member.rivalry ? member.rivalry.grievance : null,
        teaches: member.teaching ? member.teaching.knows : null,
        known: deps.knowledge.isAwareOf(cultivator.id, 'cultivator', member.id),
        standing: standing.get(member.id) ?? null
    }));
}

interface StandingRow {
    to_character_id: string;
    type: string;
    strength: number;
    times: number;
}

/** Every tie this cultivator already holds, keyed by the other party. */
function standingsFor(
    db: DatabaseHandle,
    cultivatorId: string
): Map<string, { type: string; strength: number; times: number }> {
    const rows = db.prepare(`
        SELECT r.to_character_id, r.type, r.strength,
               (SELECT COUNT(*) FROM relationship_events e WHERE e.relationship_id = r.id) AS times
        FROM relationships r
        WHERE r.from_character_id = ? AND r.active = 1
    `).all(cultivatorId) as StandingRow[];

    const out = new Map<string, { type: string; strength: number; times: number }>();
    for (const row of rows) {
        out.set(row.to_character_id, {
            type: row.type,
            strength: row.strength,
            times: row.times
        });
    }
    return out;
}

/**
 * Apply what a contact did to the record.
 */
export function recordContact(
    repos: CultivationRepos,
    cultivator: Cultivator,
    onDay: number,
    contact: Contact
): Relationship {
    const db = repos.db as unknown as DatabaseHandle;
    const existing = readRelationship(db, cultivator.id, contact.person.id);

    const base = existing ?? createRelationship({
        fromId: cultivator.id,
        toId: contact.person.id,
        type: contact.tie.type as RelationshipType,
        onDay,
        strength: 0,
        significance: contact.tie.significance,
        attitude: contact.tie.attitude
    });

    const updated = updateRelationship(base, {
        onDay,
        type: contact.tie.type as RelationshipType,
        strength: base.strength + contact.tie.strengthDelta,
        significance: contact.tie.significance,
        attitude: contact.tie.attitude,
        roles: [...new Set([...base.roles, ...contact.tie.roles])],
        appendHistory: contact.tie.eventSummary
    });

    const withEvent = recordRelationshipEvent(updated, {
        onDay,
        kind: contact.tie.eventKind,
        summary: contact.tie.eventSummary,
        significance: contact.tie.significance === 'defining' ? 'defining' : 'notable'
    });

    repos.db.transaction(() => {
        writeRelationship(db, withEvent);
        const event = withEvent.events[withEvent.events.length - 1];
        if (event) writeRelationshipEvent(db, withEvent.id, event);
    })();

    return withEvent;
}


/**
 * THE OPEN LEDGER BETWEEN TWO PEOPLE, IN BOTH DIRECTIONS.
 */
export function openLedgerBetween(
    repos: CultivationRepos,
    oneId: string,
    otherId: string
): ObligationRecord[] {
    const db = repos.db as unknown as DatabaseHandle;
    const rows = db.prepare(`
        SELECT * FROM obligations
        WHERE status = 'open'
          AND ((holder_id = ? AND subject_id = ?) OR (holder_id = ? AND subject_id = ?))
    `).all(oneId, otherId, otherId, oneId) as ObligationRow[];
    return rows.map(obligationFromRow);
}

/**
 * Every open oath this person is answerable for, whoever it is owed to.
 */
/**
 * An oath is sworn TO somebody, so its subject is never absent.
 */
export type OathHeld = ObligationRecord & { subjectId: string };

export function openOathsHeldBy(
    repos: CultivationRepos,
    holderId: string
): OathHeld[] {
    const db = repos.db as unknown as DatabaseHandle;
    const rows = db.prepare(`
        SELECT * FROM obligations
        WHERE status = 'open' AND kind = 'oath' AND holder_id = ?
        ORDER BY incurred_on_day ASC, id ASC
    `).all(holderId) as ObligationRow[];
    // Dropped rather than defaulted. A nameless oath is not an oath to nobody,
    // it is a row that should not exist, and handing it on as one with an empty
    // name is how the two states stop being distinguishable.
    return rows.map(obligationFromRow)
        .filter((record): record is OathHeld => record.subjectId !== null);
}

interface ObligationRow {
    id: string;
    kind: string;
    holder_id: string;
    subject_id: string | null;
    cause: string;
    severity: string;
    incurred_on_day: number;
    triggering_event_id: string | null;
    description: string;
    participants: string;
    tags: string;
    terms: string | null;
    due_on_day: number | null;
    status: string;
    settlement_resolution: string | null;
    settled_on_day: number | null;
    settled_by_id: string | null;
    settlement_note: string | null;
    inheritance: string;
    generation: number;
    origin_holder_id: string;
    from_belief: number;
    recorded_on_day: number;
}

function obligationFromRow(row: ObligationRow): ObligationRecord {
    return {
        id: row.id,
        kind: row.kind as ObligationRecord['kind'],
        holderId: row.holder_id,
        subjectId: row.subject_id,
        cause: row.cause as ObligationRecord['cause'],
        severity: row.severity as ObligationRecord['severity'],
        incurredOnDay: row.incurred_on_day,
        triggeringEventId: row.triggering_event_id,
        description: row.description,
        participants: safeParse(row.participants),
        tags: safeParse(row.tags),
        terms: row.terms,
        dueOnDay: row.due_on_day,
        status: row.status as ObligationRecord['status'],
        settlement: row.settlement_resolution === null ? null : {
            resolution: row.settlement_resolution as NonNullable<ObligationRecord['settlement']>['resolution'],
            onDay: row.settled_on_day ?? 0,
            ...(row.settled_by_id === null ? {} : { byId: row.settled_by_id }),
            note: row.settlement_note ?? ''
        },
        inheritance: safeParse(row.inheritance) as unknown as ObligationRecord['inheritance'],
        generation: row.generation,
        originHolderId: row.origin_holder_id,
        fromBelief: row.from_belief === 1,
        recordedOnDay: row.recorded_on_day
    };
}

/**
 * WHAT ONE PERSON'S SIDE OF A TIE SAYS, READ BACK.
 */
export function tieFrom(
    repos: CultivationRepos,
    fromId: string,
    toId: string
): Relationship | null {
    return readRelationship(repos.db as unknown as DatabaseHandle, fromId, toId);
}

/**
 * The tie an attempt formed, written down - both sides, allowed to disagree.
 */
export function recordTheTieAnAttemptLeft(
    repos: CultivationRepos,
    actorId: string,
    subjectId: string,
    onDay: number,
    tie: {
        theirs: { type: string; strength: number; significance: string; roles: string[] };
        yours: { type: string; strength: number; significance: string; roles: string[] };
        event: { onDay: number; kind: string; summary: string };
    }
): void {
    const db = repos.db as unknown as DatabaseHandle;
    const sides: [string, string, typeof tie.theirs][] = [
        [subjectId, actorId, tie.theirs],
        [actorId, subjectId, tie.yours]
    ];
    repos.db.transaction(() => {
        for (const [fromId, toId, side] of sides) {
            const existing = readRelationship(db, fromId, toId);
            const base = existing ?? createRelationship({
                fromId,
                toId,
                type: side.type as RelationshipType,
                onDay,
                strength: 0,
                significance: side.significance as Relationship['significance']
            });
            const updated = updateRelationship(base, {
                onDay,
                type: side.type as RelationshipType,
                strength: base.strength + side.strength,
                significance: side.significance as Relationship['significance'],
                roles: [...new Set([...base.roles, ...side.roles])],
                appendHistory: tie.event.summary
            });
            const withEvent = recordRelationshipEvent(updated, {
                onDay,
                kind: tie.event.kind,
                summary: tie.event.summary,
                significance: 'notable'
            });
            writeRelationship(db, withEvent);
            const event = withEvent.events[withEvent.events.length - 1];
            if (event) writeRelationshipEvent(db, withEvent.id, event);
        }
    })();
}

interface RelationshipRow {
    id: string;
    from_character_id: string;
    to_character_id: string;
    type: string;
    label: string;
    strength: number;
    significance: string;
    attitude: string;
    roles: string;
    history: string;
    established_on_day: number;
    last_updated_on_day: number;
    active: number;
    ended_reason: string | null;
    ended_on_day: number | null;
}

function readRelationship(db: DatabaseHandle, fromId: string, toId: string): Relationship | null {
    const row = db.prepare(
        'SELECT * FROM relationships WHERE from_character_id = ? AND to_character_id = ?'
    ).get(fromId, toId) as RelationshipRow | undefined;
    if (!row) return null;

    return {
        id: row.id,
        fromId: row.from_character_id,
        toId: row.to_character_id,
        type: row.type as RelationshipType,
        label: row.label,
        strength: row.strength,
        significance: row.significance as Relationship['significance'],
        attitude: row.attitude,
        roles: safeParse(row.roles),
        history: row.history,
        events: [],
        establishedOnDay: row.established_on_day,
        lastUpdatedOnDay: row.last_updated_on_day,
        active: row.active === 1,
        endedReason: row.ended_reason,
        endedOnDay: row.ended_on_day
    };
}

function writeRelationship(db: DatabaseHandle, rel: Relationship): void {
    db.prepare(`
        INSERT OR REPLACE INTO relationships (
            id, from_character_id, to_character_id, type, label, strength, significance,
            attitude, roles, history, established_on_day, last_updated_on_day,
            active, ended_reason, ended_on_day
        ) VALUES (
            @id, @fromId, @toId, @type, @label, @strength, @significance,
            @attitude, @roles, @history, @establishedOnDay, @lastUpdatedOnDay,
            @active, @endedReason, @endedOnDay
        )
    `).run({
        id: rel.id,
        fromId: rel.fromId,
        toId: rel.toId,
        type: rel.type,
        label: rel.label,
        strength: rel.strength,
        significance: rel.significance,
        attitude: rel.attitude,
        roles: JSON.stringify(rel.roles),
        history: rel.history,
        establishedOnDay: rel.establishedOnDay,
        lastUpdatedOnDay: rel.lastUpdatedOnDay,
        active: rel.active ? 1 : 0,
        endedReason: rel.endedReason,
        endedOnDay: rel.endedOnDay
    });
}

function writeRelationshipEvent(
    db: DatabaseHandle,
    relationshipId: string,
    event: Relationship['events'][number]
): void {
    db.prepare(`
        INSERT OR REPLACE INTO relationship_events (
            id, relationship_id, on_day, kind, summary, significance, fact_id, tags
        ) VALUES (@id, @relationshipId, @onDay, @kind, @summary, @significance, @factId, @tags)
    `).run({
        id: event.id,
        relationshipId,
        onDay: event.onDay,
        kind: event.kind,
        summary: event.summary,
        significance: event.significance,
        factId: event.factId ?? null,
        tags: JSON.stringify(event.tags ?? [])
    });
}

function safeParse(json: string): string[] {
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS NOT DONE HERE, AND WHY
//
// A hostile occurrence carries a `Confrontation` - the gap, the count, the
// damage multiplier, whether walking away is available - and this module does
// NOT resolve it. That is deliberate: the player has been handed control back,
// and deciding to fight is a turn. A caller that wants the fight builds
// `CombatantInput`s from `occurrence.confrontation` and calls `resolveMelee`.
//
// Nor is there a hook inside `time-skip.ts`. Encounters are rolled beside the
// skip on the same absolute-day grid rather than inside it, which is what lets
// this land without touching a file the cultivation engine owns. The cost is
// the imprecision noted on `withEncounterDeltas`. If that file ever wants the
// tighter version, the shape is one optional callback on `TimeSkipContext`:
//
//     arrivals?: (absDay: number) => SimEvent | null;
//
// called on the existing `ENCOUNTER_CHECK_DAYS` grid, pushed through the same
// `push(...)` that qi deviation already uses. Everything else here is unchanged
// by that; `rollEncounters` would supply the callback.
// ─────────────────────────────────────────────────────────────────────────
