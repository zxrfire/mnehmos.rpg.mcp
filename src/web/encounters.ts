/**
 * The turn loop's adapter onto `src/engine/encounters/`.
 *
 * The engine layer is pure - it takes plain records and returns deltas - so
 * something has to read the database, the world and the knowledge gate and
 * build those records. That is all this file is. It holds no rules: every
 * decision about what happens to anybody is made in `src/engine/encounters/`,
 * and if you find yourself adding a predicate here, it belongs there.
 *
 * ── How a caller uses it ─────────────────────────────────────────────────
 *
 * Four calls, in this order, and the order is the whole contract:
 *
 *   1. `encountersFor(...)`      BEFORE anything is spent. Rolls the window.
 *   2. `daysActuallySpent(...)`  truncate the span at the first interruption,
 *                                and buy provisions for THAT many days.
 *   3. `withEncounterDeltas(...)` fold what the engine settled into the
 *                                cultivator handed to `simulateTimeSkip`.
 *   4. `recordEncounters(...)`   AFTER `applyTimeSkip`, to write the knowledge
 *                                grants AND the relationship rows, and get the
 *                                events and lines back. Pass `repos` or the
 *                                ties do not accumulate.
 *
 * And one that is not optional and is not in that sequence:
 *
 *   `consumeArrivals(...)` after every window. An arrival is rolled once per
 *   FACT and the answer is stable for ever, so a caller that keeps handing back
 *   a fact which already arrived sees it arrive again in every window.
 *
 * Step 1 must come before step 2 because provisioning is priced per day: a
 * seclusion cut short in year eight should not have been provisioned for
 * twenty. Step 4 must come after `applyTimeSkip` because a knowledge record
 * is written in phase 2, where writes belong, so that phase 3 only ever gets a
 * licence to mention something that is already true.
 *
 * ── Why the truncation is legal ──────────────────────────────────────────
 *
 * Every roll in the engine layer is keyed to an ABSOLUTE DAY, so cutting a
 * window at its first interruption and rolling the remainder afterwards gives
 * the surviving days exactly what they were always going to give. Asserted in
 * `tests/engine/encounters/window.test.ts`.
 */

import {
    rollEncounters,
    arrivableFromUnheard,
    assessFit,
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT A VERB IS, AS FAR AS THE WORLD IS CONCERNED
// ─────────────────────────────────────────────────────────────────────────

/**
 * The web layer's verbs, coarsened to the seven things the world can reach.
 *
 * A lookup rather than a branch, so a new verb is one line here and inherits
 * every rate, every reach rule and every bias without anybody deciding
 * anything about it. Anything unlisted is `labour`, which is the least
 * eventful non-zero row and therefore the safe default.
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
 *
 * A constant, and that is the point: a run has exactly one player, `seed` is
 * already the first component of every stream, and mixing in anything else
 * that is not derived from the seed makes the run irreproducible. Two
 * cultivators in one world cannot both be this, because there are never two.
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
     *
     * `window.ts` mixes `cultivator.id` into seven streams, which is right for
     * its own purpose - two cultivators standing in one world must not draw the
     * same encounters - and WRONG as a default for a played run, because a
     * cultivator's row id is a `randomUUID()` and is not derived from the seed.
     * Two runs created from the same seed therefore rolled different
     * encounters, which broke the project's own rule that runs are reproducible
     * from their seed. Measured: `requestedDays` 1215 on one run and 3650 on
     * the next, same seed, same cultivator, same everything a caller supplies.
     *
     * Callers with a genuinely stable id (an NPC out of the catalog, a fixture)
     * should leave this alone and get the old behaviour. A caller whose id is
     * random must pass something seed-stable instead.
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
 *
 * Three cases, and the middle one is the default because it is the ordinary
 * one: a cave somebody could find if they tried.
 *
 *   known    they are on their own house's ground, or somewhere inhabited.
 *            A senior sister knows which cave. So does everybody else
 *   private  a place that is on the map and is nobody's in particular
 *   hidden   undiscovered ground. Nobody knows to look, and nobody comes if
 *            it goes wrong
 *
 * Read off columns the world layer already maintains - `controllingFactionId`,
 * `discovered`, and the location's kind - so a new place inherits an answer
 * without anybody deciding one for it.
 */
export function locatabilityFor(deps: EncounterDeps, cultivator: Cultivator): Locatability {
    const record = deps.world ? worldLocationFor(deps.world, cultivator.location) : null;
    if (!record) return 'private';

    // Undiscovered ground is ground nobody has a name for.
    if (record.discovered === false) return 'hidden';

    const membership = deps.repos.sects.getMembership(cultivator.id);
    if (membership && record.controllingFactionId === membership.sectId) return 'known';

    // Somewhere people live is somewhere people notice who is about.
    if (record.kind === 'settlement' || record.kind === 'sect_seat') return 'known';

    // Deep wilds and sealed places are where somebody goes not to be found.
    if (record.kind === 'wilds' || record.kind === 'sealed_domain' ||
        record.kind === 'forbidden_zone' || record.kind === 'secret_realm') {
        return 'hidden';
    }

    return 'private';
}

/**
 * Where they are standing, as the encounter layer reads it.
 *
 * Falls back to the cultivator's free-text location when the world is not
 * loaded. A place with no record is `wilds` at middling danger, which is a
 * guess and is honest about being one - it never invents a kind that would
 * bias the pool toward anything in particular.
 */
export function placeFor(world: WorldState | null, cultivator: Cultivator): EncounterPlace {
    const name = (cultivator.location ?? 'somewhere').trim() || 'somewhere';
    const record: LocationRecord | null = world ? worldLocationFor(world, cultivator.location) : null;
    if (!record) {
        return { id: name.toLowerCase(), name, kind: 'wilds', danger: 0.25 };
    }
    return {
        id: record.id,
        name: record.name,
        kind: record.kind,
        danger: record.environment.danger,
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
 *
 * The owner's rule needs a denominator - "people / people in seclusion" - and
 * nothing in the world records whether an individual NPC is behind a door. What
 * the world does record is what the place IS, and that carries the same fact
 * for free: a mountain grown up around a sect is people in seclusion, a market
 * town is people moving. It is exactly the owner's own pair of examples, and it
 * needs no new state on anybody.
 *
 * Stated as a proxy rather than smuggled in as a measurement. When an NPC
 * seclusion flag exists this should read it instead, and this table should go.
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
 *
 * The promotion seam. A place holds people who are nobody in particular until
 * something makes one of them a person; `known` is what tells the encounter
 * layer which of them is already one, and the grant that comes back is what
 * promotes the rest. This is the same population `othersPresent` gives the
 * hearsay layer, deliberately - one crowd, three doors onto it.
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
 * Names the summary is permitted to draw on, flagged with whether this player
 * has heard them.
 *
 * The engine layer composes no proper nouns at all, so this is the only place a
 * faction name can enter a summary from - which is what makes the discovery
 * rule structural rather than a discipline somebody has to remember.
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
 *
 * `advanceWorldForCultivator` returns both the world's own facts and the
 * player's digest; the difference between them is everything that reached them
 * by no channel at all, which in a live five-year seclusion was thirty-five
 * events. Those are the candidates.
 *
 * `consequenceText` must be `unattributedTextOf` from `engine/world/digest.js`,
 * passed in rather than imported so this module does not have to know the
 * shape of a `HistoricalFact`.
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
 *
 * There are two truncations in a seclusion and only one of them was being
 * applied. `rollEncounters` cuts its own window at its own first interrupt, and
 * `daysActuallySpent` reads that day - but then `simulateTimeSkip` runs and
 * stops WHERE IT LIKES: a wound, a deviation threshold, a major encounter of
 * its own, a death. Everything between the day the skip stopped and the day the
 * encounter layer expected to stop is a span the cultivator never reached, and
 * every occurrence sitting in it was being recorded, narrated, and consumed off
 * the pending-arrivals list anyway.
 *
 * Three independent playtests found it, at three different scales:
 *
 *     broke at day 163   ...  contact filed at day 853
 *                             plague at day 2983, marked INTERRUPTS
 *     seclusion 1 year   ...  a combat narrated at day 7590, for a 17-year-old
 *     died on day 5      ...  a mission board read at day 2995
 *
 * A dead cultivator reading a notice board 2,990 days after their own funeral
 * is the clearest statement of the bug there is.
 *
 * Legal because every roll in `window.ts` is keyed to an ABSOLUTE day - its own
 * header says a caller may compute a window and re-cut it without any surviving
 * day changing what it was going to produce. So this drops; it never re-rolls.
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
 *
 * `withEncounterDeltas` is applied BEFORE the skip, because the skip needs a
 * starting HP - so by the time the lived span is known, the deltas of things
 * that never happened are already folded in. Returning them lets the caller
 * hand them back rather than leaving the sheet disagreeing with the account the
 * player just read.
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
 *
 * Only non-interrupting occurrences carry deltas - an interruption is a
 * decision point and the engine does not help itself to the outcome - so this
 * is a small number applied to a copy, never a mutation of the input.
 *
 * A known imprecision, stated rather than hidden: these are applied at the
 * START of the span rather than on the day they happened, because
 * `applyTimeSkip` computes its writes from `before` plus the skip. The
 * alternative is a hook inside `time-skip.ts`. See the note at the bottom of
 * this file.
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
 *
 * Required, not optional. An arrival is rolled once per FACT - the stream is
 * keyed to the fact's own id, so the answer for a given event never changes -
 * which gives each thing that happened exactly one lifetime chance of reaching
 * anybody. That is the property that makes a quiet decade quiet. It also means
 * a caller that keeps handing back a fact which already arrived will see it
 * arrive again in every subsequent window, so the caller owns the list and must
 * take the used ones out of it.
 *
 * Candidates that never arrive are kept: a consequence that reached nobody in
 * year three can still reach them in year nine, and things arriving late is
 * what a consequence is.
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
 *
 * `valence=bad` and `stance=above` are column values. The structure channel is
 * read by a player as well as by an operator, and `above` in particular is the
 * single most consequential thing this layer can say - it is the difference
 * between a fight that was lost and a fight that was never offered - so it says
 * it rather than filing the key.
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
 *
 * Call AFTER `applyTimeSkip`, with the cultivator it returned. `learnIfNew`
 * is idempotent, so calling twice for one span costs a lookup and changes
 * nothing.
 */
export function recordEncounters(
    knowledge: KnowledgeGate,
    cultivator: Cultivator,
    onDay: number,
    roll: EncounterRoll,
    /**
     * Supply this and ordinary contact with the house is written to
     * `relationships` and `relationship_events`. Omit it and the contacts still
     * HAPPEN - the lines and the events are the same - and nothing accumulates,
     * so the twelfth meeting is another first. Optional only so that a caller
     * with no database (an odds harness, a design guard) can still read a roll.
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
     *
     * The inspector reports what HAPPENED, which is why the cut roll is what
     * gets mapped - an occurrence dated after the stretch ended is not a thing
     * the engine did, and printing it there is how the defect was found in the
     * first place. But a roll that produced six things and lived none of them
     * still happened, and a developer reading an empty inspector cannot tell
     * that from a roll that was never made. So the drop gets a row of its own.
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
     * What was on the wall and is not being put to this person, with the
     * engine's own line about why.
     *
     * An empty board and a board full of work beneath somebody are different
     * facts, and a player standing in front of the second one should be told
     * which it is. `regard.reaction` already says exactly how far below them a
     * thing is pitched, so nothing here composes an excuse.
     */
    refusals: { entryId: string; name: string; reason: string }[];
}

/**
 * What a cultivator standing in front of a mission board can see.
 *
 * Narrowed by rung exactly as every other catalog draw is. Works without a
 * membership: a rogue can take contract work and is paid in stones, and the
 * only thing they cannot be paid in is contribution, because there is no
 * ledger they are on. That difference IS the membership.
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
 *
 * `window.ts` builds exactly this shape when the house sends for somebody, and
 * a duty TAKEN OFF THE WALL is the same object arrived at by a different route
 * - so it is assembled here rather than a second time in the caller, and the
 * two paths cannot drift into disagreeing about what a duty is.
 *
 * Nothing is decided here. Every field is `terms`, the membership, or the day;
 * `spokenBy` is null because nobody spoke - the difference between being
 * summoned and reading a wall is precisely that there is no mouth.
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
 *
 * Every column is read defensively. The catalog grew `domain`, `rootGrades`
 * and `domainDegree` after this shape existed, and a row written before they
 * did should read as "asks for nothing in particular" rather than throw.
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
 *
 * There is no obligations repository yet - the tables have existed since the
 * social migration and nothing has ever written to them - so the insert lives
 * here beside its only caller. It wants lifting into
 * `src/storage/repos/obligation.repo.ts` by whoever owns that directory, at
 * which point this function becomes a call to it and nothing else changes.
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
 *
 * An oath, held by the person who swore it, about the party it is owed to -
 * which is the direction `migrations.social.ts` documents. `dueOnDay` is what
 * makes it findable later: "oaths and debts coming due" is an indexed query
 * and this is the first thing in the game to put a row in it.
 *
 * Nothing is paid here. Payment is `completeDuty`, and the gap between the two
 * is what makes accepting a decision rather than free money.
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
 *
 * Settles the oath as fulfilled and pays, in that order and in one transaction:
 * a payout without the settlement leaves an oath standing that has already been
 * kept, and the ledger is the thing people read in forty years.
 *
 * Contribution is credited through `sects.addContribution`, which is the column
 * that had no earner. Stones go through the ordinary delta path.
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
 *
 * One function for both, because the ledger does not distinguish them and
 * should not: a house that was counted on and was not there does not care
 * which day you decided. `outcome` only changes the description.
 *
 * The record is held BY the house ABOUT the cultivator, which is the same
 * direction `combat-manage.ts` writes a feud in - the aggrieved party holds it.
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
 *
 * Returns empty without a membership, which is correct and is the whole of the
 * rogue case: nobody drops in on somebody who belongs to nothing.
 *
 * The `standing` field is what makes repeated contact accumulate rather than
 * reset. It is read per person from the relationships table, so the twelfth
 * meeting knows about the previous eleven.
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
 *
 * Read, apply, write back - which is what makes the twelfth meeting the
 * twelfth rather than another first. `createRelationship` derives a stable id
 * from the pair, so the row for a given pair is always the same row and there
 * is no lookup by anything but the pair.
 *
 * The relationship is written from the CULTIVATOR's side only. The other
 * direction is a separate row with its own attitude, and asserting what a
 * sect-mate thinks of the player is not something this layer knows.
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
 *
 * `resolveAttempt` takes a `ledger` and reads two things off it: what this
 * person owes you, and what they hold against you. Both are worth a real amount
 * - three open favours are 0.24 on the odds, a grave grudge more than that
 * against you - and no caller in the web layer has ever supplied one, so both
 * terms have read zero for every attempt a player has ever made.
 *
 * That is not a tuning problem, it is the cheapest lever in the game being
 * unreachable. `asking.md`: *"What you have done for someone counts for more
 * than either... Small, cheap, repeated things work: a round, a gift, a favour,
 * turning up twice. This is the cheapest lever in the game and it is available
 * to a cultivator with nothing."* A refusal that says "what would change it is
 * being owed something" is a lie for as long as nothing reads what is owed.
 *
 * Open records only, because a settled one is settled. Both directions, because
 * the resolver decides which of them is which and this must not pre-judge it.
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

interface ObligationRow {
    id: string;
    kind: string;
    holder_id: string;
    subject_id: string;
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
 *
 * The table has been here the whole time and only `recordContact` wrote to it,
 * from the player's side only. `resolveAttempt` wants the OTHER side - "their
 * view of you, not yours of them", the heaviest term after standing - and got
 * nothing, so every approach in the game was made by a stranger however many
 * times the two of them had dealt with each other.
 *
 * Directed, and the direction is the mechanic: `relationships.ts` stores
 * `from -> to` as two rows precisely so the two can disagree.
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
 *
 * `AttemptMarks.tie` is the resolver saying what the world is now carrying that
 * it was not before, and its own header names the shape it is writing: *"he
 * thinks they are friends; she has been waiting nine years for an opening."*
 * Nothing persisted it, so the asymmetry the whole module is built around
 * existed for exactly one function call and was then thrown away.
 *
 * Strengths ACCUMULATE onto whatever is already there, which is what makes the
 * twelfth approach the twelfth rather than another first - the same reasoning
 * `recordContact` gives for reading before it writes.
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
