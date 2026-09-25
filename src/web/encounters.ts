/**
 * The turn loop's adapter onto `src/engine/encounters/`.
 */

import { ledgerAbout, writeOneObligation } from '../storage/repos/obligation.repo.js';
import { aDeliveryAsAnOffer, whatAHouseSendsItsSisters } from '../engine/world/what-a-house-sends-its-sisters.js';
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
    type AnAccountComingDue,
    type ArrivableFact,
    type Duty,
    type EncounterActivity,
    type Contact,
    type TieChange,
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
import { theRung } from './facts.js';
import { howAHouseStandsForMoney } from '../engine/world/the-world-changing-on-its-own.js';
import {
    aMissionAsAnOffer,
    theMissionsAHousePosts,
    theReasonBehind,
    whatAHouseHasOnItsBoard
} from '../engine/encounters/what-a-house-has-on-its-board.js';
import { dutyTermsAtAMonthlyRate, dutyTermsFor, takeableOffAWall } from '../engine/encounters/duties.js';
import { aContractAsAnOffer, contractsPostedAt } from '../engine/encounters/paper-on-a-town-wall.js';
import { standingOf } from '../server/consolidated/where-a-cultivator-is-standing.js';
import {
    howAnAskReaches,
    whyItIsNotOnTheWall,
    whyYouCannotBePostedThere
} from '../engine/encounters/how-an-ask-reaches-somebody.js';
import { thereIsNoDoorAt } from '../data/cultivation/a-favour-skips-the-admission-bar.js';
import { whoCouldNominateInto } from '../engine/social-leverage/who-can-put-your-name-up-for-a-posting.js';
import { isSealedOn } from '../engine/world/what-ground-a-place-is.js';
import type { InterruptPolicy } from '../engine/world/time.js';
import {
    aFindThisHouseCouldSendFor,
    forbiddenGroundInTheProvinceOf,
    groundAPartyCanBeSentTo,
    whatAHousesOwnErrandsBringBack,
    whatAnybodyCouldHaveOfTheGround,
    whatStandingOnItGives,
    whatTheAirCarriesOfTheGround,
    whereASendingGoes,
    groundTheseHousesHold,
    whereTheOpenGroundIs,
    whichHousesAReasonIsAbout,
    type AFindThisHouseHas,
    type WhereTheOpenGroundIs,
    type HouseAsItStands
} from '../engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import {
    itsCommunicationTalismansRunLow,
    whatCuttingForTheHouseLands,
    whatCuttingPays
} from '../engine/world/what-a-house-hears-from-its-people-away.js';
import type { SendingReason } from '../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { forStream } from '../engine/cultivation/rng.js';
// The one answer to who a house would sit down with. The world holds its own
// gatherings off this same reading, so a visit and a friendly competition are
// offered to exactly the houses the world would have put in a room together.
import { circleCandidatesFor } from '../engine/world/gatherings.js';
import type { Cultivator, SimEvent } from '../schema/cultivation.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import type { FactionRecord, WorldState } from '../engine/world/world-state.js';
import { npcsStandingIn } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import { dangerDeltaInArea } from '../engine/world/what-is-true-of-a-place-right-now.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { KnowingStage } from '../engine/social/discovery.js';
import type { KnowledgeGate } from './knowledge.js';
import { createGrudge, createOath, settleObligation } from '../engine/social/grudges.js';
import {
    createRelationship,
    endRelationship,
    recordRelationshipEvent,
    theOtherHalfOf,
    updateRelationship,
    type Relationship,
    type RelationshipType
} from '../engine/social/relationships.js';
import { getMembersOf } from '../data/cultivation/members.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import type { ObligationRecord } from '../engine/social/grudges.js';
import type { TheDoorTheySitBehind } from '../engine/encounters/at-a-sealed-door.js';
import { othersPresent } from './hearsay.js';
import { worldLocationFor } from './entities.js';
import { theProvinceAround } from '../engine/world/ground-holder.js';
import {
    isInTheAirFor,
    regionOf,
    whereThisPersonIsStanding,
    type TellerStanding
} from '../engine/world/what-people-are-saying.js';
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
    /** Holders who may come to settle an account. See `accountsComingDue`. */
    comingForYou?: readonly AnAccountComingDue[];
    /** The door a sealed sitter shut. See `the-door-you-sit-behind.ts`. */
    door?: TheDoorTheySitBehind | null;
    /** An operator forcing somebody stopped at that door to wait outside it. */
    waitingIsForced?: boolean;
}

/** Roll the window. Call this BEFORE provisioning or simulating anything. */
export function encountersFor(deps: EncounterDeps, request: EncounterRequest): EncounterRoll {
    const { cultivator } = request;
    const membership = request.membership ?? membershipFor(deps, cultivator);
    // The same reading the board takes, so what the house would post and what
    // it would send for are one account of the house rather than two.
    const standing = theHouseAsItStands(deps, cultivator, membership);
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
        comingForYou: request.comingForYou,
        ...(request.door ? { door: request.door } : {}),
        ...(request.waitingIsForced ? { waitingIsForced: true } : {}),
        membership,
        house: standing?.house ?? null,
        ...(standing === null ? {} : {
            reachOfTheHouse: standing.reach,
            reachOfTheRest: standing.reachOfTheRest
        }),
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
        // The schedule, not the column: `sealed` is refreshed at a year
        // boundary and on ground with a season it can be a year stale.
        sealed: isSealedOn(record, world?.currentDay ?? null),
        company: {
            heads: npcsStandingIn(world!, record.id).length + 1,
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT CUT A SPAN SHORT
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the world lets reach somebody spending a span here.
 *
 * A fact about where they are sitting, not a policy about what they may type.
 * The one thing that changes it is the door: a sealed sitting is not reached by
 * the ordinary business of the place, which is the entire reason a house builds
 * halls - but somebody who comes for YOU by name still gets through one, and so
 * does anything the world flagged as interrupting on its own account.
 */
export function whatReachesSomebodySpendingASpanHere(where: {
    actorId: string;
    /**
     * Where they are standing AND every place that contains it.
     *
     * A place is inside a region and the region is inside a layer, and the
     * world writes at all three scales: measured on a fixture world, every
     * located opportunity sat on a REGION id while a played cultivator stands
     * on a site inside one, so an exact match found nothing anywhere ever.
     * Somebody sitting on Silver Island is in the Drowned Reach, and something
     * that happens to the Drowned Reach happens where they are sitting.
     */
    locationIds: readonly string[];
    factionIds: readonly string[];
    /** A closed door. Not emptiness - see `seclusion-verbs.ts`. */
    behindAShutDoor: boolean;
}): InterruptPolicy {
    return {
        actorId: where.actorId,
        locationIds: where.behindAShutDoor ? [] : where.locationIds,
        // A SHUT DOOR KEEPS OUT THE HOUSE'S ORDINARY BUSINESS TOO. The vein
        // assessments a sect runs every twelve years are exactly what a door is
        // for; somebody who comes for you by name is exactly what it is not, and
        // that is `onActorInvolved`, which stays on either way.
        factionIds: where.behindAShutDoor ? [] : where.factionIds,
        onScheduledInterrupt: true,
        onActorInvolved: true,
        onLocalEvents: !where.behindAShutDoor,
        // Both default false and both stay false. An opportunity opening
        // somewhere is not somebody knocking on the door, and a window shutting
        // unclaimed is something a player learns about afterwards rather than
        // something that stands them up mid-sentence. They reach the player
        // through the digest, which is where a thing you were not there for
        // belongs.
        onOpportunityOpens: false,
        onOpportunityCloses: false
    };
}

/**
 * Which of the three things that can end a span early actually did.
 *
 * THREE SYSTEMS, ONE ANSWER. A span can be cut by somebody arriving (the
 * encounter window, which decides before a day is spent), by the world (a
 * scheduled consequence at this place, or one naming this person), or by the
 * body (the skip's own stop - a wound, an empty pack, a wall). Until this
 * existed all three were live and none of them was reported as the reason,
 * because nothing asked.
 *
 * `null` when the span ran to the end, and null is the common case.
 *
 * Note the guard on zero: a span that ran in full still sets `interrupted` when
 * the last chunk carried a warning, and announcing a loss of no days beside two
 * identical figures is the defect `facts.ts` already fixed once at the other end
 * of the same pipe.
 */
export interface SpanCutShort {
    /** What the sentence asked for. */
    askedDays: number;
    /** What was lived before something ended it. */
    livedDays: number;
    cause: 'somebody_arrived' | 'an_encounter' | 'the_world' | 'the_body';
    /** What cut in, stated. Not narrated - the narrator writes the prose. */
    what: string;
    /** The encounter's own summary, for the engine channel only. */
    detail?: string;
}

/**
 * What stopped a span, in plain words from the encounter's kind. Played: the
 * catalog summary reached the player whole - "Severity: serious. Cause: an
 * unpaid toll", a day on another clock, and "during cultivation" on a road -
 * and "toll" read as a road fee rather than the Toll at a realm boundary.
 */
const WHAT_STOPPED_IT: Readonly<Record<string, string>> = {
    bandits: 'bandits stopped the way',
    rival_cultivator: 'another cultivator stopped you',
    spirit_beast: 'a spirit beast stopped you',
    ruin: 'you came on a ruin',
    grave: 'you came on a grave',
    dao_house: 'you came on a dao house\'s ground',
    opportunity: 'you came on something worth stopping for',
    commerce: 'you stopped to trade',
    sect_event: 'a house\'s business stopped you',
    misfortune: 'something went wrong with you and you had to stop'
};

export function whatCutTheSpanShort(span: {
    /** What the player's sentence asked for. */
    asked: number;
    /** What the span was cut to before the skip ran. */
    lived: number;
    skip: { requestedDays: number; simulatedDays: number; interrupted: boolean; interruptReason: string | null; died: boolean };
    /** The arrival window, if one was rolled. Days are in the RUN's frame. */
    arrival: {
        firstInterruptDay: number | null;
        /** What the window produced, so the one that stopped the span can be named. */
        occurrences?: ReadonlyArray<{
            interrupts: boolean; absoluteDay: number; kind: string; event: { summary: string; kind?: string };
        }>;
    } | null;
    /**
     * What the world said it would do, if it was asked.
     *
     * DAYS FROM THE START OF THE SPAN, never a world day. The run clock and the
     * world clock are joined at the advance and not before it, so an absolute
     * day out of one frame compared against an absolute day out of the other
     * decides the cause by whatever drift is between them.
     */
    world: { inDays: number; summary: string } | null;
    /** Absolute day the span began, in the run's frame. */
    startDay: number;
}): SpanCutShort | null {
    const asked = Math.max(0, Math.floor(span.asked));
    const livedDays = Math.max(0, Math.floor(span.skip.simulatedDays));
    if (livedDays >= asked) return null;
    // A death is not an interruption. The run ended; there is no next sentence
    // to make from where they are standing, and every other surface says so.
    if (span.skip.died) return null;

    // THE BODY FIRST, because it is the innermost and the most specific: the
    // skip was handed `lived` days and did not finish them, which no arrival and
    // no world event can explain.
    if (span.skip.simulatedDays < span.skip.requestedDays) {
        return {
            askedDays: asked,
            livedDays,
            cause: 'the_body',
            what: span.skip.interruptReason?.replace(/[_:]/g, ' ')
                ?? 'the stretch could not be carried to the end'
        };
    }

    // Then whichever of the two OUTER cuts landed first. Both are decided before
    // a day is spent, so the earlier one is the one that actually decided.
    // Both as days from the start of the span, which is the one frame they
    // share.
    const arrivedIn = span.arrival?.firstInterruptDay === null
        || span.arrival?.firstInterruptDay === undefined
        ? null
        : span.arrival.firstInterruptDay - span.startDay;
    const worldIn = span.world?.inDays ?? null;
    const arrivalWins = arrivedIn !== null && (worldIn === null || arrivedIn <= worldIn);
    if (arrivalWins) {
        // WHAT STOPPED IT, SAID AS WHAT IT WAS. Played: a grave found on the
        // road was reported as "somebody reached you". A find is not a person.
        const stopper = span.arrival?.occurrences?.find(o =>
            o.interrupts && o.absoluteDay === span.arrival!.firstInterruptDay);
        const somebody = stopper === undefined || stopper.kind === 'arrival' || stopper.kind === 'contact';
        const plain = stopper?.event.kind === 'qi_deviation'
            ? 'your qi turned against you'
            : stopper === undefined ? undefined : WHAT_STOPPED_IT[stopper.kind];
        return {
            askedDays: asked,
            livedDays,
            cause: somebody ? 'somebody_arrived' : 'an_encounter',
            what: plain ?? (somebody ? 'somebody reached you' : 'something on the way stopped you'),
            ...(stopper ? { detail: stopper.event.summary } : {})
        };
    }
    if (span.world !== null) {
        return {
            askedDays: asked,
            livedDays,
            cause: 'the_world',
            what: span.world.summary
        };
    }
    return null;
}

/**
 * The span was cut short, stated for the player. One sentence, no inference.
 */
export function sayingWhatEndedTheSpan(cut: SpanCutShort, humanise: (days: number) => string): string {
    return `After ${humanise(cut.livedDays)} of ${humanise(cut.askedDays)}, ${cut.what}.`;
}

/**
 * The same, for the engine channel.
 *
 * Filed on EVERY span that was cut, not only on one that lost a later clause.
 * `engine.planCutShort` is the plan layer's row and only exists where there was
 * a plan; this is the span's own, and it is what makes the three causes
 * countable without reading prose. Shaped for `ToolCallRecord` without importing
 * it, for the reason `encounterCalls` gives.
 */
export function theRowForASpanCutShort(
    action: string,
    cut: SpanCutShort
): { name: string; action: string; summary: string; ok: boolean } {
    return {
        name: 'engine.spanCutShort',
        action,
        summary: `${cut.livedDays} of the ${cut.askedDays} day(s) asked for were spent. `
            + `Cut short by ${cut.cause}: ${cut.what}.`
            + (cut.detail ? ` Encounter: ${cut.detail}` : ''),
        // The span ran and what it reached came off. Nothing failed.
        ok: true
    };
}

/**
 * What the world said it would do to this span, whether or not it got to.
 *
 * The world shortens the span BEFORE the skip runs, and the skip can then stop
 * earlier still - so the world can decide something and never be the reason.
 * Without this row that decision is invisible: an operator reading a stretch cut
 * at day fifty by a wound cannot tell whether the world had also ended it at
 * day twelve hundred, and the two are different worlds to be playing in.
 *
 * Engine channel only. Nothing here reaches the player: a forecast the world
 * did not get to keep is exactly the sort of thing the narrator must never be
 * handed as an observation.
 */
export function theRowForWhatTheWorldWouldHaveDone(
    action: string,
    asked: number,
    cut: { days: number; interrupt: { cause: string; summary: string } }
): { name: string; action: string; summary: string; ok: boolean } {
    return {
        name: 'engine.theWorldWouldCutIn',
        action,
        summary: `The world would end this span after ${cut.days} of the ${asked} day(s) asked `
            + `for (${cut.interrupt.cause}: ${cut.interrupt.summary}), so that is what the span `
            + 'was cut to before anything was spent. What actually ended it may still be nearer.',
        ok: true
    };
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
                  + `${theRung(o.confrontation.threatOrdinal)}, and what they land on this `
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
    // AND WHAT THE HOUSE ITSELF NEEDS DOING. The catalogue is a fixed list with
    // ordinal windows on it, and measured through this very function it holds
    // ONE offer at the bottom rung and NOTHING AT ALL from Core Formation
    // upward. A house's own postings are pitched at whoever is reading the
    // board, so the board does not run out - and they are the sendings that
    // house was going to make anyway, so nothing here is invented. See
    // `what-a-house-has-on-its-board.ts`.
    const wall = whatTheHouseItselfNeedsDone(deps, cultivator, membership);
    const paper = theContractsOnTheWallHere(cultivator, membership);

    const offers = [
        ...commissionBoard(cultivator.realmOrdinal, membership),
        ...wall.offers,
        ...paper.offers
    ].sort((a, b) => b.terms.contribution - a.terms.contribution ||
            b.terms.stones - a.terms.stones ||
            (a.entry.id < b.entry.id ? -1 : 1));

    return {
        membership,
        offers,
        refusals: [
            ...boardRefusals(cultivator.realmOrdinal, membership).map(row => ({
                entryId: row.entry.id,
                name: row.entry.name,
                reason: row.regard.reaction
            })),
            ...wall.refusals,
            ...paper.refusals
        ]
    };
}

/**
 * The contracts up on the wall where this person is standing, and the ones
 * pitched too far above them to be handed over.
 *
 * Anybody may take one, on a roll or off it: a rogue takes a contract for the
 * money, and a disciple may take one on their own time, which credits their
 * house nothing. See `paper-on-a-town-wall.ts`.
 */
function theContractsOnTheWallHere(cultivator: Cultivator, membership: Membership | null): TheWall {
    const wall: TheWall = { offers: [], refusals: [] };
    for (const contract of contractsPostedAt(standingOf(cultivator).settlementKind)) {
        const entry = aContractAsAnOffer(contract);
        const terms = dutyTermsAtAMonthlyRate({
            entry,
            cashPerMonth: contract.cashPerMonth,
            days: contract.days,
            ordinal: cultivator.realmOrdinal,
            membership,
            creditsTheHouse: false
        });
        if (takeableOffAWall(terms.regard.band)) wall.offers.push({ entry, terms, weight: entry.weight });
        else wall.refusals.push({ entryId: entry.id, name: entry.name, reason: terms.regard.reaction });
    }
    return wall;
}

/**
 * Whether this house knows of open ground near it worth sending for.
 *
 * Asked rather than decided here, exactly as the two readings beside it are, so
 * the wall a player reads and the world's own sendings cannot come to different
 * conclusions about what this house has.
 *
 * THE ROLL IS EVERYBODY IN THE HOUSE, the player's mirror row included. What one
 * of its people knows is what the house knows, and the player is one of its
 * people the moment they are on the roll.
 */
interface HowTheGroundIsKnown {
    knowsTheGround: (holderId: string, locationId: string) => KnowingStage;
    cameBack: (factionId: string, locationId: string) => KnowingStage;
}

/**
 * The three ways a house's people could have come by the ground near them,
 * built once for a whole walk.
 *
 * ONE BUILDER, because the world's own sendings compose exactly these three and
 * a wall that composed two of them would quietly say a house had not heard of
 * something the world had already sent it after.
 */
function howTheGroundIsKnownIn(world: WorldState): HowTheGroundIsKnown {
    const standingOnIt = whatStandingOnItGives(world.history.facts);
    const day = Math.floor(world.currentDay);
    const region = new Map<string | null, string | null>();
    const regionFor = (locationId: string | null): string | null => {
        const had = region.get(locationId);
        if (had !== undefined) return had;
        const found = regionOf(world, locationId);
        region.set(locationId, found);
        return found;
    };
    const tellers = new Map<string, TellerStanding | null>();
    const tellerAt = (holderId: string): TellerStanding | null => {
        const had = tellers.get(holderId);
        if (had !== undefined) return had;
        const npc = world.npcs.find(n => n.id === holderId) ?? null;
        const built = npc ? whereThisPersonIsStanding(world, npc, regionFor) : null;
        tellers.set(holderId, built);
        return built;
    };
    return {
        knowsTheGround: whatAnybodyCouldHaveOfTheGround(
            standingOnIt,
            whatTheAirCarriesOfTheGround({
                facts: world.history.facts,
                inTheAirFor: (fact, holderId) => {
                    const teller = tellerAt(holderId);
                    return teller !== null && isInTheAirFor(world, fact, teller, day);
                }
            })
        ),
        cameBack: whatAHousesOwnErrandsBringBack(world.history.facts)
    };
}

function aFindThisHouseKnowsOf(
    world: WorldState,
    faction: FactionRecord,
    openGround: WhereTheOpenGroundIs,
    known: HowTheGroundIsKnown
): AFindThisHouseHas | null {
    return aFindThisHouseCouldSendFor({
        ground: openGround,
        houseId: faction.id,
        seatLocationId: faction.seatLocationId,
        roll: world.npcs
            .filter(npc => npc.factionId === faction.id && npc.status === 'alive')
            .map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex })),
        rankCount: faction.ranks.length,
        stageFor: known.knowsTheGround,
        errands: known.cameBack
    });
}

export interface TheHouseAndItsReach {
    house: HouseAsItStands;
    /** The highest rung this house has anybody standing on. */
    reach: number;
    /**
     * The same, counting everybody EXCEPT the reader. What the wall is written
     * for: the reader is not one of the people a notice is aimed at.
     */
    reachOfTheRest: number;
    /** Where its gate is, so a posting can be sent anywhere but home. */
    seatLocationId: string | null;
    /**
     * The open ground it knows of, kept rather than reduced to a yes.
     *
     * `house.hasAFind` IS this being non-null - see the reasons the board
     * offers - and the errand a house opens BECAUSE it knows of a door has to
     * be able to say which door, or it sends the party somewhere else.
     */
    find: AFindThisHouseHas | null;
}

/**
 * The house whose wall this is, and how far it can send anybody.
 *
 * The reader's own house where they have one, and otherwise whoever holds the
 * ground they are standing on - because a wall in a town is that town's holder's
 * wall, and somebody who is on nobody's roll can still read it. The design
 * owner: *"the board is never empty, you just aren't qualified to take a job
 * from the missions elder."*
 *
 * ONE JOIN, READ TWICE. The board a member walks up to and the ask that arrives
 * at their door are the same rows, so they take the same reading of the house -
 * a second projection here would be two opinions about whether the house is at
 * war.
 *
 * AND THE PERSON BEING ASKED IS ON THE ROLL. The reach was taken off the NPCs
 * alone, which is right for a stranger reading a stall and wrong for a member:
 * an elder standing at a rung nobody else in their house has reached IS the
 * person the house would send, and clamping the pitch to the strongest NPC left
 * every posting ten or more rungs beneath them, which is the band `summonable`
 * drops. So the board went empty at exactly the rung that made somebody worth
 * sending. The design owner's rule is unchanged - *sects only offer work they
 * have disciples able to reach* - and this counts a disciple the roll already
 * holds.
 */
export function theHouseAsItStands(
    deps: EncounterDeps,
    cultivator: Cultivator,
    membership: Membership | null
): TheHouseAndItsReach | null {
    if (!deps.world || !membership) return null;
    const faction = deps.world.factions.find(f => f.id === membership.factionId);
    if (!faction || faction.dissolvedOnDay !== null) return null;

    // The reader counts toward the reach only when the reader is on the roll.
    // A stranger reading somebody else's wall is not one of the people that
    // house could send, however high they stand.
    //
    // AND THE REST OF THE HOUSE IS COUNTED APART, because the two numbers
    // answer two questions. What the house could send this person on reads the
    // first; where its WALL tops out reads the second, and a wall pitched off a
    // reach the reader themselves supplied is a wall written for one person.
    let reachOfTheRest = 0;
    for (const npc of deps.world.npcs) {
        if (npc.factionId !== faction.id || npc.status !== 'alive') continue;
        if (npc.cultivation.realmOrdinal > reachOfTheRest) {
            reachOfTheRest = npc.cultivation.realmOrdinal;
        }
    }
    const reach = Math.max(reachOfTheRest, membership ? cultivator.realmOrdinal : 0);

    // What THIS house has standing open, asked rather than decided here: the
    // world's own sendings read the same function, so the board and the world
    // cannot disagree about whether it has one - or about which one it is.
    const find = aFindThisHouseKnowsOf(
        deps.world,
        faction,
        whereTheOpenGroundIs(deps.world.locations),
        howTheGroundIsKnownIn(deps.world)
    );

    return {
        house: {
            id: faction.id,
            name: faction.name,
            holdsGround: deps.world.locations.some(l => l.controllingFactionId === faction.id),
            standing: faction.standing,
            hasAFind: find !== null,
            // WHO THIS HOUSE WOULD SIT DOWN WITH, and it is asked rather than
            // decided here: a visit and a friendly competition both need a body
            // on the other end, and the world already answers that question when
            // it decides who it holds a gathering between.
            sitsDownWith: circleCandidatesFor(deps.world, faction).map(f => f.id),
            standsNearForbiddenGround:
                forbiddenGroundInTheProvinceOf(deps.world.locations, faction.seatLocationId),
            // Its communication talismans, off the reading the world's own board takes.
            itsCommunicationTalismansRunLow: itsCommunicationTalismansRunLow(
                deps.world, faction.id,
                deps.world.npcs.filter(n => n.factionId === faction.id && n.status === 'alive').length),
            // WHAT ITS PURSE SAYS, off the world's own reading rather than a
            // second one. A house that could not pay its people this year posts
            // an errand nobody else in the world has, and a player standing at
            // the wall is the person who finds out first.
            ...howAHouseStandsForMoney(deps.world, faction)
        },
        reach,
        reachOfTheRest,
        seatLocationId: faction.seatLocationId,
        find
    };
}

/**
 * What the house has on its wall, split into what this person may take and what
 * they may only read.
 *
 * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING NOTHING.
 * The gate decides what may be TAKEN; it must not decide what may be KNOWN
 * ABOUT. Both halves of that were broken here and both were silent: a reader on
 * no roll got an empty array, and a member who did not clear a posting's band
 * had it dropped with a bare `continue`. So above the rung the catalogue runs
 * out at, the wall said nothing at all - which reads as a world with nothing in
 * it rather than as a world that has not opened to you yet.
 *
 * A refusal carries what is actually there, why it is not yours, and what would
 * change that. An empty list carries none of the three.
 */
interface TheWall {
    offers: DutyCandidate[];
    refusals: { entryId: string; name: string; reason: string }[];
}

/**
 * Every house whose wall this is: your own where you have one, and otherwise
 * the houses SEATED where you are standing.
 *
 * IN THE SAME PROVINCE, and the two readings that are not it are both measured.
 *
 * `whoHoldsTheGround` answers *whose ground is this* by walking UPWARD from
 * where you stand looking for a holder. Right inside a compound, wrong in a
 * town: 988 of 1063 location records on a pinned world carry a holder and NONE
 * of the twelve places a player's `location` can be does, because the held ones
 * are the compounds nested under those names.
 *
 * Nesting the other way does not work either. `seedFactions` hangs a house's
 * seat off the REGION rather than off a settlement - `seedSectGround(state, cf,
 * region, ...)` - so a sect's ground is a sibling of the towns and not inside
 * one, and asking which houses sit within this town answers none, everywhere.
 *
 * So the province is the join, which is also the one the recruiting wall
 * already uses: a notice board in a market town carries the work of the houses
 * whose gates are in that province, and that is what a notice board is for.
 */
function theHousesWhoseWallThisIs(
    deps: EncounterDeps,
    cultivator: Cultivator,
    membership: Membership | null
): TheHouseAndItsReach[] {
    const own = theHouseAsItStands(deps, cultivator, membership);
    if (own) return [own];
    if (!deps.world) return [];

    const here = worldLocationFor(deps.world, cultivator.location);
    const province = theProvinceAround(deps.world.locations, here?.id);
    if (province === null) return [];

    // Both built once for the whole walk. The reading below is per house per
    // ruin, and each half of it walks something long: the ledger of a
    // long-lived world, and every location in it.
    const known = howTheGroundIsKnownIn(deps.world);
    const openGround = whereTheOpenGroundIs(deps.world.locations);

    const out: TheHouseAndItsReach[] = [];
    for (const faction of deps.world.factions) {
        if (faction.dissolvedOnDay !== null) continue;
        if (theProvinceAround(deps.world.locations, faction.seatLocationId) !== province) continue;
        let reach = 0;
        for (const npc of deps.world.npcs) {
            if (npc.factionId !== faction.id || npc.status !== 'alive') continue;
            if (npc.cultivation.realmOrdinal > reach) reach = npc.cultivation.realmOrdinal;
        }
        const find = aFindThisHouseKnowsOf(deps.world, faction, openGround, known);
        out.push({
            house: {
                id: faction.id,
                name: faction.name,
                holdsGround: faction.controlledLocationIds.length > 0,
                standing: faction.standing,
                hasAFind: find !== null,
                sitsDownWith: circleCandidatesFor(deps.world, faction).map(f => f.id),
                standsNearForbiddenGround:
                    forbiddenGroundInTheProvinceOf(deps.world.locations, faction.seatLocationId),
                ...howAHouseStandsForMoney(deps.world, faction)
            },
            reach,
            // Nobody off the roll is counted into a house's reach, so a
            // stranger's reading of the wall is the whole house either way.
            reachOfTheRest: reach,
            seatLocationId: faction.seatLocationId,
            find
        });
    }
    return out;
}

/**
 * Where each posting on a wall would send whoever took it, by name.
 *
 * WHY A NOTICE SAID NOTHING ABOUT WHERE IT WENT. `aPostingAsAnOffer` has taken
 * a `placeName` since it was written and nothing anywhere passed one, so every
 * line on every board in the game read "An escort, for the Azure Cloud
 * Pavilion" - the house, the work, and no destination.
 *
 * `whereASendingGoes` is the world's own answer and is asked rather than
 * repeated: which houses a reason is about, the ground the house knows of, and
 * everywhere a party can be put down. So a wall and the world's own errands
 * cannot send the same party to two different places.
 *
 * NEVER AN ID. A location the world cannot name comes back null and the notice
 * goes up without a destination, which is what it did before. A row id printed
 * where a name belongs is the defect `an-ask-is-called-what-it-is-and-never-its-row`
 * was written against.
 *
 * The draw is keyed to the house and the reason rather than to a run, because
 * the notice's own id is, and a wall that names a different village each time
 * it is read is a wall with nothing on it.
 */
function whereAPostingWouldSendThem(
    world: WorldState,
    standing: TheHouseAndItsReach
): (reason: SendingReason) => string | null {
    const elsewhere = groundAPartyCanBeSentTo(world.locations);
    const seatOf = (houseId: string): string | null =>
        world.factions.find(f => f.id === houseId && f.dissolvedOnDay === null)
            ?.seatLocationId ?? null;

    return reason => {
        const goingTo = whereASendingGoes({
            needs: reason.needs,
            fromLocationId: standing.seatLocationId,
            theFind: standing.find?.locationId ?? null,
            seatsInPlay: whichHousesAReasonIsAbout(reason.needs, standing.house)
                .map(seatOf)
                .filter((id): id is string => id !== null),
            groundNearThem: groundTheseHousesHold(
                world.locations,
                whichHousesAReasonIsAbout(reason.needs, standing.house)
            ),
            elsewhere,
            pick: count => forStream(standing.house.id, 'posting_destination', reason.id)
                .int(0, Math.max(0, count - 1))
        });
        if (goingTo === null) return null;
        return world.locations.find(l => l.id === goingTo)?.name ?? null;
    };
}

/** Whether somebody standing at this place is at this house's seat, or inside it. */
function standsAtItsSeat(world: WorldState, where: string | null, houseId: string): boolean {
    const seat = world.factions.find(faction => faction.id === houseId)?.seatLocationId ?? null;
    const named = (where ?? '').trim().toLowerCase();
    if (seat === null || named.length === 0) return false;
    const byId = new Map(world.locations.map(row => [row.id, row]));
    let row = world.locations.find(location => location.name.toLowerCase() === named);
    for (let steps = 0; row && steps < 8; steps++, row = row.parentId ? byId.get(row.parentId) : undefined) {
        if (row.id === seat) return true;
    }
    return false;
}

function whatTheHouseItselfNeedsDone(
    deps: EncounterDeps,
    cultivator: Cultivator,
    membership: Membership | null
): TheWall {
    const wall: TheWall = { offers: [], refusals: [] };

    for (const standing of theHousesWhoseWallThisIs(deps, cultivator, membership)) {
        const world = deps.world;
        // A ROLL IS NOT ALWAYS A ROAD. Two bodies in this world admit nobody,
        // so "earn a place on the roll" is a road that does not exist and the
        // honest answer names the nomination instead. And the road is named
        // with names on it: which bodies the apex takes names from is the
        // province's own arrangement rather than anybody's secret, but it is
        // still a thing somebody had to be told, so it is filtered through what
        // this reader knows.
        const offTheRoll = (): string => thereIsNoDoorAt(standing.house.id)
            ? whyYouCannotBePostedThere(standing.house.name, {
                bodyId: standing.house.id,
                ordinal: cultivator.realmOrdinal,
                houseId: null,
                namesTheyKnow: whoCouldNominateInto(standing.house.id)
                    .map(c => c.nominatorId)
                    .filter(id => deps.knowledge.isAwareOf(cultivator.id, 'sect', id))
            })
            : `${standing.house.name} posts this to its own. Nobody off the roll is handed `
              + `one, and a place on ${standing.house.name}'s roll is what changes that.`;
        for (const entry of whatAHouseHasOnItsBoard({
            house: standing.house,
            ordinal: cultivator.realmOrdinal,
            reachOfTheHouse: standing.reach,
            // What the wall itself carries, which is not the same list as what
            // the house would send this reader on. See `reachOfTheRest`.
            reachOfTheRest: standing.reachOfTheRest,
            ...(world === null || world === undefined
                ? {}
                : { placeFor: whereAPostingWouldSendThem(world, standing) })
        })) {
            const terms = dutyTermsFor(entry, cultivator.realmOrdinal, membership, 'commission');
            // THE BOARD IS FOR DISCIPLES AND AN ELDER IS TOLD. The generator is
            // the same rows either way; what differs is the road they come by.
            // Read before the roll and the band, because a thing that was never
            // wall work is not a thing this reader failed to qualify for.
            const reaches = howAnAskReaches({
                pitchOrdinal: terms.pitchOrdinal,
                reachOfTheHouse: standing.reach
            });
            const why = reaches === 'word_of_mouth'
                ? whyItIsNotOnTheWall(standing.house.name)
                : membership === null
                    ? offTheRoll()
                    // AND A WALL DOES NOT DECIDE WHO IS WORTH ITS WORK. What
                    // `summonable` answers is whether the HOUSE would spend
                    // this person on this, which is the question when the house
                    // is choosing. Off paper the person is choosing, and the
                    // design owner ruled it plainly: an elder can read the
                    // board and could take from it, met with an eyebrow.
                    // `takeableOffAWall` keeps the refusal for what is pitched
                    // above them and drops it for what is pitched under them.
                    : takeableOffAWall(terms.regard.band)
                        ? null
                        : terms.regard.reaction;
            if (why === null) {
                wall.offers.push({ entry, terms, weight: entry.weight });
                continue;
            }
            wall.refusals.push({ entryId: entry.id, name: entry.name, reason: why });
        }

        // AND THE STANDING WORK IT SENDS ITS OWN ON, at the rate it pays: a disciple is sent on a
        // mission. Posted to the house's own, and a reader off the roll is told so in the words
        // every other posting uses. See `what-a-house-posts-for-its-own.ts`.
        for (const mission of theMissionsAHousePosts(standing.house, standing.reach)) {
            const entry = aMissionAsAnOffer(mission, standing.house);
            const terms = dutyTermsAtAMonthlyRate({
                entry,
                cashPerMonth: mission.cashPerMonth,
                days: mission.days,
                ordinal: cultivator.realmOrdinal,
                membership,
                creditsTheHouse: true
            });
            const why = membership === null
                ? offTheRoll()
                : takeableOffAWall(terms.regard.band) ? null : terms.regard.reaction;
            if (why === null) wall.offers.push({ entry, terms, weight: entry.weight });
            else wall.refusals.push({ entryId: entry.id, name: entry.name, reason: why });
        }

        // AND WHAT THE HOUSE IS SENDING ITS SISTERS, which anybody may carry: "you can take any
        // job, you figure out how to do it". Contribution is for its own; the stones are for
        // anybody. See `what-a-house-sends-its-sisters.ts`.
        // Posted at the sending house's own seat, where the goods are: they are picked up there.
        if (world !== null && world !== undefined && standsAtItsSeat(world, cultivator.location, standing.house.id)) {
            for (const consignment of whatAHouseSendsItsSisters(world, standing.house.id, Math.floor(world.currentDay))) {
                const entry = aDeliveryAsAnOffer(consignment, cultivator.realmOrdinal);
                const terms = {
                    ...dutyTermsFor(entry, cultivator.realmOrdinal, membership, 'commission'),
                    days: consignment.days,
                    contribution: membership?.factionId === consignment.fromHouseId ? consignment.contribution : 0,
                    stones: consignment.stones,
                    cohort: 0
                };
                wall.offers.push({ entry, terms, weight: entry.weight });
            }
        }
    }
    return wall;
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
        // A wall does not ask anybody anything, and nobody takes a line off one
        // on somebody else's behalf. Both are the summons path's business.
        spokenBy: null,
        takingOut: []
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
    /**
     * The day the oath row was WRITTEN, when that is not `onDay`.
     *
     * FOUND BY PLAYING BLIND, and it poisoned the ledger every time a duty was
     * finished. An obligation's id is derived by `createObligation` from
     * `stableId(kind, holder, subject, cause, onDay, ...)` - the DAY is part of
     * it - and `completeDuty` re-derived the oath from the settlement day while
     * `acceptDuty` had written it on the acceptance day. Two different ids, so
     * the settled row was a SECOND row and the accepted one was never touched:
     *
     *     > I put my name down for A Bounty at the Old Price
     *     Completed. 94 spirit stones paid.
     *
     *     > what oaths do i have
     *     Owed by you to unaffiliated: service term... Due on day 20, which is
     *     already past.
     *
     * Paid in full and overdue on the same run. Every duty a player has ever
     * finished left one of these behind, and the oath read is the screen the
     * whole social engine is read through.
     *
     * So the settlement carries the day the row was written and settles THAT
     * row. Optional because a caller settling on the day it accepted is already
     * correct without it.
     */
    acceptedOnDay?: number;
    /** Catalog row this duty was read off, for the description. */
    entryId: string;
    /** What the situation was, factually. Usually the occurrence summary. */
    what: string;
    /**
     * The world, where the settlement should land what the work made. A duty
     * taken off a house's board that makes something - cutting communication
     * talismans - lands it through the same function the world's own close
     * does. Absent, nothing lands.
     */
    world?: WorldState | null;
}

/**
 * The word already given for this posting, when there is one.
 *
 * A term broken off before its days were served leaves its oath OPEN - see
 * `aTermCutShort` in `turn-engine.ts` - and the way to close it is to take the
 * posting up again. That second acceptance has to land on the SAME row: an
 * obligation's id is derived from the day it was sworn, so accepting afresh
 * would open a second word for one posting and settling would close only the
 * newer of them. Which is the defect `acceptedOnDay` was written for, arriving
 * by a different road.
 *
 * So a resumption is swearing the same word again rather than a new one, and
 * the due day stays the day it was always due.
 */
export function aStandingDutyOath(
    repos: DutyLedgerInput['repos'],
    cultivatorId: string,
    entryId: string
): ObligationRecord | null {
    const held = ledgerAbout(repos.db as unknown as DatabaseHandle, cultivatorId);
    return held.find(row =>
        row.kind === 'oath'
        && row.status === 'open'
        && row.holderId === cultivatorId
        && row.tags.includes('duty')
        && row.tags.includes(entryId)) ?? null;
}

/** The tag prefix days already served are written under. See `daysServedOn`. */
const SERVED = 'served:';

/**
 * Days of this term already behind the cultivator.
 *
 * A term is interrupted for reasons that are not the player walking off - a
 * person arriving, news reaching them, and above all the provisions warning,
 * which `time-skip.ts` fires DELIBERATELY so that *"the skip must not be the one
 * place a player dies without a decision."* Losing fifty days of a sixty-day
 * escort to the engine being helpful is not a cost anybody agreed to, so what
 * was served is kept and a resumption serves the remainder.
 *
 * Written on the oath's own tag list, which `grudges.ts` calls *"free handles
 * for querying"* and which already carries `duty`, the origin and the catalog
 * row. No new column, and the number travels with the word it belongs to.
 */
export function daysServedOn(record: ObligationRecord): number {
    const tag = record.tags.find(t => t.startsWith(SERVED));
    const n = tag ? Number.parseInt(tag.slice(SERVED.length), 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Write what has been served so far onto the standing word. */
export function recordDaysServed(
    repos: DutyLedgerInput['repos'],
    record: ObligationRecord,
    served: number
): ObligationRecord {
    const kept = record.tags.filter(t => !t.startsWith(SERVED));
    const updated: ObligationRecord = {
        ...record,
        tags: [...kept, `${SERVED}${Math.max(0, Math.floor(served))}`]
    };
    writeOneObligation(repos.db as unknown as DatabaseHandle, updated);
    return updated;
}

/**
 * Taking it on.
 */
export function acceptDuty(input: DutyLedgerInput): ObligationRecord {
    const { duty, cultivator } = input;
    return writeOneObligation(input.repos.db as unknown as DatabaseHandle, createOath({
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
    /** How many of what the work makes went into the house's stock. */
    landed: number;
    /** Engine-authored, for `facts.lines`. */
    line: string;
}

/**
 * Finishing it.
 */
export function completeDuty(input: DutyLedgerInput): DutySettlementResult {
    const { duty, cultivator, repos } = input;
    // THE DAY THE ROW WAS WRITTEN, NOT THE DAY IT IS BEING CLOSED. The id is
    // derived from it. See `acceptedOnDay`.
    const acceptedOn = input.acceptedOnDay ?? input.onDay;
    const oath = createOath({
        holderId: cultivator.id,
        subjectId: duty.factionId ?? 'unaffiliated',
        cause: duty.origin === 'summons' ? 'sect_vow' : 'service_term',
        severity: duty.refusal.severity,
        onDay: acceptedOn,
        description: `${input.what} Accepted on day ${acceptedOn}.`,
        // AND THE TERMS, WHICH `acceptDuty` WROTE AND THIS DROPPED. A settled
        // row with `terms: null` is a row that cannot say what was agreed, and
        // the oath read prints the terms verbatim.
        terms: `${duty.days} days. Paid on completion: `
            + `${duty.contribution} contribution, ${duty.stones} spirit stones.`,
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
        writeOneObligation(repos.db as unknown as DatabaseHandle, settled);
        if (duty.factionId && duty.contribution > 0) {
            repos.sects.addContribution(duty.factionId, cultivator.id, duty.contribution);
            credited = duty.contribution;
        }
        if (duty.stones > 0) {
            repos.cultivators.applyDeltas(cultivator.id, { spiritStones: duty.stones });
        }
    })();

    // AND WHAT THE WORK MADE. A notice whose reason makes a thing lands it
    // through the one landing the world's own close uses, with the player as
    // the maker and the days from the word given to the day it was done.
    const makes = theReasonBehind(input.entryId)?.makes ?? null;
    const landed = input.world && makes !== null
        ? whatCuttingForTheHouseLands(input.world, {
            alive: cultivator.alive,
            houseId: duty.factionId ?? null,
            ordinal: cultivator.realmOrdinal
        }, { thingId: makes, sinceDay: acceptedOn, untilDay: input.onDay })
        : 0;
    // PAID FOR WHAT LANDED. A notice that makes something pays no stones up
    // front (`dutyTermsFor`), and what it made is paid at its worth.
    const paidForWhatLanded = whatCuttingPays(landed, cultivator.realmOrdinal);
    if (paidForWhatLanded > 0) {
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: paidForWhatLanded });
    }
    const stones = duty.stones + paidForWhatLanded;

    // THE EYEBROW IS NOT STATED HERE ANY MORE, and where it moved to is the
    // point. This line rode the settlement, which put "posted eleven rungs
    // under you" at COMPLETION and addressed it to nobody. The design owner:
    // *"the eyebrow is raised by the mission elder... to take a mission YOU
    // HAVE TO REPORT IT TO SOMEONE."* So it belongs at the taking, in front of
    // the person the report was made to - `pitchedWellBeneath` is now said in
    // `duty()` beside `whoTakesAReportAt`.
    return {
        obligation: settled,
        contribution: credited,
        stones,
        landed,
        line: (credited > 0
            ? `Completed. ${credited} contribution credited with `
              + `${duty.factionName ?? 'the house'}, and ${stones} spirit stones paid.`
            : `Completed. ${stones} spirit stones paid, and nothing on anybody's ledger.`)
            + (landed > 0 ? ` ${landed} went into the house's stores.` : '')
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

    writeOneObligation(input.repos.db as unknown as DatabaseHandle, record);

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

    // ONE STANDING PER PERSON, out of however many kinds stand between them.
    // The strongest row names the tie - a master who is also an uncle shows as
    // whichever of the two this person actually carries - and the occasions are
    // summed, because they all happened.
    const out = new Map<string, { type: string; strength: number; times: number }>();
    for (const row of rows) {
        const held = out.get(row.to_character_id);
        if (held === undefined) {
            out.set(row.to_character_id, { type: row.type, strength: row.strength, times: row.times });
            continue;
        }
        out.set(row.to_character_id, {
            type: Math.abs(row.strength) > Math.abs(held.strength) ? row.type : held.type,
            strength: Math.abs(row.strength) > Math.abs(held.strength) ? row.strength : held.strength,
            times: held.times + row.times
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
    // The row OF THIS KIND. Several kinds can stand between two people, so a
    // contact moves the one it is about and leaves the rest where they are.
    const existing = readRelationship(db, cultivator.id, contact.person.id, contact.tie.type as RelationshipType);

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

    // AND THE OTHER END. Every relationship runs both ways: they were in the
    // same room too, and hold the other half of the type (`theOtherHalfOf`),
    // moved by the same contact, on their own row.
    const theirType = theOtherHalfOf(contact.tie.type as RelationshipType);
    const theirs = readRelationship(db, contact.person.id, cultivator.id, theirType);
    const theirBase = theirs ?? createRelationship({
        fromId: contact.person.id,
        toId: cultivator.id,
        type: theirType,
        onDay,
        strength: 0,
        significance: contact.tie.significance,
        attitude: contact.tie.attitude
    });
    const theirSide = recordRelationshipEvent(updateRelationship(theirBase, {
        onDay,
        type: theirType,
        strength: theirBase.strength + contact.tie.strengthDelta,
        significance: contact.tie.significance,
        attitude: contact.tie.attitude,
        appendHistory: contact.tie.eventSummary
    }), {
        onDay,
        kind: contact.tie.eventKind,
        summary: contact.tie.eventSummary,
        significance: contact.tie.significance === 'defining' ? 'defining' : 'notable'
    });

    repos.db.transaction(() => {
        for (const side of [withEvent, theirSide]) {
            writeRelationship(db, side);
            const event = side.events[side.events.length - 1];
            if (event) writeRelationshipEvent(db, side.id, event);
        }
    })();

    return withEvent;
}


/**
 * One end of a tie moved: how THEY stand toward the player, and nothing about
 * how the player stands toward them. For a reaction that is theirs alone -
 * being recognised for something pleases or stings the one recognised.
 */
export function moveTheirSideOnly(
    repos: CultivationRepos,
    them: { id: string },
    cultivatorId: string,
    onDay: number,
    tie: TieChange
): void {
    const db = repos.db as unknown as DatabaseHandle;
    const type = tie.type as RelationshipType;
    const held = readRelationship(db, them.id, cultivatorId, type);
    const base = held ?? createRelationship({
        fromId: them.id, toId: cultivatorId, type, onDay, strength: 0,
        significance: tie.significance, attitude: tie.attitude
    });
    const moved = recordRelationshipEvent(updateRelationship(base, {
        onDay,
        type,
        strength: base.strength + tie.strengthDelta,
        significance: tie.significance,
        attitude: tie.attitude,
        roles: [...new Set([...base.roles, ...tie.roles])],
        appendHistory: tie.eventSummary
    }), {
        onDay,
        kind: tie.eventKind,
        summary: tie.eventSummary,
        significance: tie.significance === 'defining' ? 'defining' : 'notable'
    });
    repos.db.transaction(() => {
        writeRelationship(db, moved);
        const event = moved.events[moved.events.length - 1];
        if (event) writeRelationshipEvent(db, moved.id, event);
    })();
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
 * The children this cultivator has raised, oldest tie first.
 *
 * `haveAChild` files the tie under `child_<parent>_<other>_<day>`, and it is
 * the only writer of one. `placeAChild` composed a SECOND convention,
 * `child_of_<parent>`, commented as "the id the household tie already carries"
 * - which nothing had ever written, and which nothing checked against the
 * first. So a player who had never used the `child` verb could place a child
 * that did not exist, and a player who HAD raised one got a placement record
 * pointing at an id no row carries, which that record's own comment calls "the
 * only route a placed child has back to their own story".
 *
 * The rows are the answer to both halves, so this reads them.
 */
export function theChildrenTheyRaised(
    repos: CultivationRepos,
    parentId: string
): { id: string; sinceDay: number }[] {
    return (repos.db as unknown as DatabaseHandle).prepare(
        'SELECT to_character_id AS id, established_on_day AS sinceDay '
        + "FROM relationships WHERE from_character_id = ? AND type = 'child' AND active = 1 "
        + 'ORDER BY established_on_day ASC'
    ).all(parentId) as { id: string; sinceDay: number }[];
}

/**
 * A bond sworn between two people, written down on both sides.
 *
 * The owner's standing rule is that every relationship runs both ways. The
 * resolver reads these rows (`theirTie`, `yourTie`), so a bond that exists only
 * as a flag is a near-stranger to every ask that follows it - measured, a master
 * who had taken the player on agreed to watch them sit 2.0% of the time. The
 * TYPE is set rather than accumulated and the strength is raised to at least
 * what was sworn, never lowered: kneeling does not undo a tie that was already
 * deeper than a new bond starts.
 */
/**
 * A tie of one kind between these two, ended: kept on the row, marked inactive,
 * with the day and the reason on it.
 *
 * Ended ties are never deleted here - *"a dead master is still a master"* - and
 * with rows keyed by the pair AND the kind, ending one says which one ended:
 * a disciple who walks out stops being a disciple and does not stop being a
 * nephew.
 */
export function endTheTieOfAKind(
    repos: CultivationRepos,
    fromId: string,
    toId: string,
    type: RelationshipType,
    reason: string,
    onDay: number
): boolean {
    const db = repos.db as unknown as DatabaseHandle;
    const held = readRelationship(db, fromId, toId, type);
    if (held === null || !held.active) return false;
    writeRelationship(db, endRelationship(held, reason, onDay));
    return true;
}

export function recordABondBothWays(
    repos: CultivationRepos,
    sides: readonly { fromId: string; toId: string; type: RelationshipType; strength: number }[],
    onDay: number,
    summary: string
): void {
    const db = repos.db as unknown as DatabaseHandle;
    repos.db.transaction(() => {
        for (const side of sides) {
            const existing = readRelationship(db, side.fromId, side.toId, side.type);
            const base = existing ?? createRelationship({
                fromId: side.fromId,
                toId: side.toId,
                type: side.type,
                onDay,
                strength: side.strength,
                significance: 'defining'
            });
            const updated = updateRelationship(base, {
                onDay,
                type: side.type,
                strength: Math.max(base.strength, side.strength),
                significance: 'defining',
                appendHistory: summary
            });
            const withEvent = recordRelationshipEvent(updated, {
                onDay,
                kind: 'bond_sworn',
                summary,
                significance: 'defining'
            });
            writeRelationship(db, withEvent);
            const event = withEvent.events[withEvent.events.length - 1];
            if (event) writeRelationshipEvent(db, withEvent.id, event);
        }
    })();
}

/**
 * Whoever this cultivator knelt to, off their own side of the bond, or null.
 *
 * The one read of "my master", replacing a flag that held a name and a rung
 * beside the tie. Most recent active bond first, so a second master taken after
 * the first is the one answered.
 */
export function theMastersTheyKneltTo(repos: CultivationRepos, cultivatorId: string): string[] {
    const rows = (repos.db as unknown as DatabaseHandle).prepare(
        'SELECT to_character_id AS id FROM relationships '
        + "WHERE from_character_id = ? AND type = 'master' AND active = 1 "
        + 'ORDER BY established_on_day DESC'
    ).all(cultivatorId) as { id: string }[];
    return rows.map(row => row.id);
}

/**
 * The most recent master, for callers that want one. The design owner: *"you
 * often have more than one master, and that's okay"* - so this is the latest of
 * however many, never the only one. Anything that names them to the player, or
 * decides which one an ask is put to, should read `theMastersTheyKneltTo`.
 */
export function theMasterTheyKneltTo(repos: CultivationRepos, cultivatorId: string): string | null {
    const row = (repos.db as unknown as DatabaseHandle).prepare(
        'SELECT to_character_id AS id FROM relationships '
        + "WHERE from_character_id = ? AND type = 'master' AND active = 1 "
        + 'ORDER BY established_on_day DESC LIMIT 1'
    ).get(cultivatorId) as { id: string } | undefined;
    return row?.id ?? null;
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
            const existing = readRelationship(db, fromId, toId, side.type as RelationshipType);
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

/**
 * One of the rows standing between these two: the named kind where the caller
 * asks for one, and otherwise the most recently written.
 *
 * The design owner: *"marriages and master relationships ought to be separately
 * tracked, they aren't the same thing."* Rows here are keyed by the pair AND the
 * type (`idx_relationships_pair_kind`), so a wife who is also a fellow disciple
 * holds two and writing one never rewrites the other.
 */
function readRelationship(
    db: DatabaseHandle,
    fromId: string,
    toId: string,
    type?: RelationshipType
): Relationship | null {
    const row = (type === undefined
        ? db.prepare(
            'SELECT * FROM relationships WHERE from_character_id = ? AND to_character_id = ? '
            + 'ORDER BY last_updated_on_day DESC, rowid DESC'
        ).get(fromId, toId)
        : db.prepare(
            'SELECT * FROM relationships WHERE from_character_id = ? AND to_character_id = ? AND type = ?'
        ).get(fromId, toId, type)) as RelationshipRow | undefined;
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
