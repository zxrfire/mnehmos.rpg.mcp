/**
 * Convergence: a ruin is not a place you can go, it is a place that is
 * periodically reachable.
 *
 * `OpeningCycle` has been on `LocationRecord` since the location layer was
 * written - `periodDays`, `openDays`, `phaseDay`, and `isOpenOn` to read it -
 * and nothing in play has ever consumed it. This module is the consequence
 * half, and it is the single best pressure the exploration loop has:
 *
 *   THE CLOCK IS HARD          the window is short and the site is deep. Every
 *                              day inward is a day you must also spend coming
 *                              out, so the decision is continuous rather than
 *                              made once at the door.
 *   OVERSTAYING IS FATAL       not because something kills you. Because the way
 *                              out closes and this particular site is not
 *                              reachable again for longer than you have left.
 *   NOBODY EVER CLEARS ONE     which is why a ruin can be picked over three
 *                              times and never emptied: the far rooms are not
 *                              guarded, they are out of reach of anybody who
 *                              also intends to leave.
 *
 * That last one is the quiet result and it is worth stating plainly, because it
 * means the depletion axis in `provenance.ts` is BOUNDED BY GEOMETRY rather
 * than by a rule somebody wrote. The sealed wing nobody has opened is often
 * just the one furthest from the door.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ESCAPE HATCH IS SELF-CANCELLING, AND IT ALREADY EXISTED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * There is a way to leave late. `spatial_folding` is a `CapabilityGrant` on the
 * Void Refinement class - "short-range spatial folding" - written long before
 * this module and not touched by it. Two properties of it do all the work here
 * and neither is new:
 *
 *   IT IS HIGH        Void Refinement is ordinal 29. Somebody who can fold
 *                     space is not a person who explores ruins for a living, so
 *                     the way out exists, is real, and is never available to the
 *                     person who needs it.
 *   IT IS SHORT       "short-range" is a bound on distance, and distance is
 *                     what a waning convergence spends. {@link pierceReach}
 *                     scales the reach by how much of the window is left, so it
 *                     narrows exactly as the situation gets worse and is at its
 *                     weakest on the last day.
 *
 * No consumable version of this may be added. An item that folds space on
 * demand is the same mechanic with its teeth pulled.
 *
 * Folding is not only short, and outside this module it is not short at all:
 * `how-far-somebody-can-fold-space-and-what-it-costs.ts` is what the grant is
 * FOR, and its reach grows with the rung. {@link PIERCE_REACH_DAYS} says why
 * this is the one place it does not.
 *
 * ── But somebody else might come ──────────────────────────────────────────
 *
 * The rule above is about your own capability, and it holds. It says nothing
 * about anybody else's. Somebody who IS that high might come and get you, and
 * {@link rescuersFor} is the question "would anyone", answered from the
 * relationship rows that already exist rather than from a new system.
 *
 * Three things keep it honest, and all three are load-bearing:
 *
 *   IT IS LEGIBLE IN ADVANCE   you can ask before you go deeper, which is what
 *                              makes staying one more day a decision instead of
 *                              a gamble. Somebody with no such tie is playing a
 *                              much tighter game and should feel it.
 *   THEY MAY NOT COME          the precondition qualifies them; it does not
 *                              commit them. They can be elsewhere, they can
 *                              decline, and they can be too late - because the
 *                              reach they are crossing is the same waning
 *                              distance, so a late call fails on geometry.
 *   IT COSTS                   a rescue OPENS an obligation rather than closing
 *                              one. Being fetched out of a closing site is not
 *                              a thing that happens to nobodies, and afterwards
 *                              you owe somebody who can reach you anywhere.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { lifespanForOrdinal, rankName } from '../cultivation/realms.js';
import {
    assessCapability,
    isGrantAvailableAt,
    makeRequirements,
    makeSubject,
    type CapabilityActor,
    type CapabilityGrant
} from './capability.js';
import {
    FOLD_GRANT,
    FOLD_RANGE_AT_THE_FLOOR
} from './how-far-somebody-can-fold-space-and-what-it-costs.js';
import { isBelowTheLid } from './layers.js';
import {
    nextClosingDay,
    nextOpeningDay,
    isOpenOn,
    type LocationRecord
} from './locations.js';
import { upsertRelationship, type NpcRecord, type RelationshipKind } from './npc-state.js';
import { wingsOf, type RuinWing } from './provenance.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE WINDOW
// ─────────────────────────────────────────────────────────────────────────

/** What a site's convergence looks like from a given day. */
export interface Convergence {
    /** False when this site has no cycle at all - most of the map. */
    cyclical: boolean;
    open: boolean;
    /** Absolute day the current or next window opens. */
    opensOnDay: number | null;
    /** Absolute day it shuts. */
    closesOnDay: number | null;
    /** How long the window runs, in days. */
    windowDays: number;
    /** Days until it shuts. Zero or negative when it is not open. */
    daysLeft: number;
    /** Years until the one after this. What overstaying actually costs. */
    yearsUntilNext: number;
    /**
     * How much of the window remains, 1 at the moment it opens and 0 at the
     * moment it shuts. Everything that wanes, wanes on this.
     */
    remaining: number;
}

export function convergenceOf(location: LocationRecord, day: number): Convergence {
    if (!location.cycle) {
        return {
            cyclical: false,
            open: !location.sealed,
            opensOnDay: null,
            closesOnDay: null,
            windowDays: 0,
            daysLeft: 0,
            yearsUntilNext: 0,
            remaining: 1
        };
    }
    const open = isOpenOn(location, day);
    const closes = nextClosingDay(location, day);
    const opens = open ? null : nextOpeningDay(location, day);
    const windowDays = Math.max(1, location.cycle.openDays);
    const daysLeft = open && closes !== null ? Math.max(0, closes - day) : 0;
    return {
        cyclical: true,
        open,
        opensOnDay: open ? null : opens,
        closesOnDay: open ? closes : null,
        windowDays,
        daysLeft,
        yearsUntilNext: Math.round(location.cycle.periodDays / DAYS_PER_YEAR),
        remaining: open ? Math.max(0, Math.min(1, daysLeft / windowDays)) : 0
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ESCAPE THAT IS NEVER AVAILABLE TO THE PERSON WHO NEEDS IT
// ─────────────────────────────────────────────────────────────────────────

/** The grant that lets somebody leave late. Void Refinement, and no lower. */
export const PIERCE_GRANT: CapabilityGrant = FOLD_GRANT;

/**
 * Days of depth a full-strength fold covers.
 *
 * Short, because the grant says short. It is a bound on distance and never a
 * substitute for the clock: at the widest it buys about a week of depth, which
 * is less than the deep wings of a large site.
 *
 * It is the fold's reach at the rung where folding starts, read from
 * `how-far-somebody-can-fold-space-and-what-it-costs.ts` rather than restated,
 * because the two were the same physical fact carried in two constants.
 *
 * AND IT DOES NOT GROW WITH THE RUNG HERE, which is the one place in the engine
 * where that is true. Everywhere else a fold reaches further the higher the
 * folder stands. What a waning convergence spends is the site RECEDING, and a
 * receding far end is not a distance on anybody's table - there is nothing to
 * take a fix on, so there is nothing for the ordinal to buy. The reach is the
 * floor for everybody, it wanes with the window, and it is at its weakest on
 * the day it would matter most.
 */
export const PIERCE_REACH_DAYS = FOLD_RANGE_AT_THE_FLOOR;

/**
 * How far somebody could fold, from here, today.
 *
 * Scaled by what is left of the window, because the site is receding: as
 * convergence wanes the distance grows, so the same fold covers less of it.
 * The consequence is the design point - the escape is at its weakest on the
 * day it would matter most, and it reaches zero at the close.
 *
 * Returns zero for anybody who cannot fold at all, which is nearly everybody
 * and certainly everybody who would be in here.
 */
export function pierceReach(
    convergence: Convergence,
    actor: { realmOrdinal: number; heldGrants?: readonly CapabilityGrant[] }
): number {
    if (!isGrantAvailableAt(actor.realmOrdinal, PIERCE_GRANT)) return 0;
    if (!(actor.heldGrants ?? []).includes(PIERCE_GRANT)) return 0;
    return Number((PIERCE_REACH_DAYS * convergence.remaining).toFixed(2));
}

// ─────────────────────────────────────────────────────────────────────────
// HOW DEEP YOU CAN GO AND STILL COME BACK
// ─────────────────────────────────────────────────────────────────────────

export interface ReachableWing {
    wing: RuinWing;
    /** Days in. The same again to come out, unless something covers it. */
    depthDays: number;
    /** In and out inside the window with nothing else needed. */
    reachable: boolean;
    /** Reachable only because a fold covers the return leg. */
    needsPierce: boolean;
    /** In and out is longer than the window however it is done. */
    beyondTheWindow: boolean;
}

export interface ExpeditionBudget {
    convergence: Convergence;
    /** Days of depth that leave room to walk back out. */
    safeDepth: number;
    /** Days of depth a fold would also cover. Zero for almost everybody. */
    piercedDepth: number;
    wings: ReachableWing[];
    /** Wings nobody can reach in one window at all, however strong. */
    unreachableWings: RuinWing[];
    /** The honest sentence for a narrator that wants one. */
    reason: string;
}

/**
 * What this person can actually get to before the way out shuts.
 *
 * The whole model is one division: half the remaining window is the deepest you
 * can be and still walk out, because the walk back costs what the walk in did.
 * A fold adds its reach to the RETURN leg only - it does not make you faster
 * going in, and it does not extend the window.
 */
export function expeditionBudget(
    location: LocationRecord,
    day: number,
    actor: { realmOrdinal: number; heldGrants?: readonly CapabilityGrant[] }
): ExpeditionBudget {
    const convergence = convergenceOf(location, day);
    const wings = wingsOf(location);

    // A site with no cycle is not on a clock. Everything is reachable and the
    // pressure this module supplies simply does not apply, which is correct:
    // most of the map is ordinary ground.
    if (!convergence.cyclical) {
        return {
            convergence,
            safeDepth: Number.POSITIVE_INFINITY,
            piercedDepth: 0,
            wings: wings.map(w => ({
                wing: w, depthDays: w.depthDays,
                reachable: true, needsPierce: false, beyondTheWindow: false
            })),
            unreachableWings: [],
            reason: 'Nothing about this place closes. Take as long as you like.'
        };
    }

    const pierce = pierceReach(convergence, actor);
    const safeDepth = convergence.open ? convergence.daysLeft / 2 : 0;
    const piercedDepth = convergence.open ? (convergence.daysLeft + pierce) / 2 : 0;
    // The most anybody could ever do here, from the moment the window opened.
    const bestEver = convergence.windowDays / 2 + PIERCE_REACH_DAYS / 2;

    const mapped: ReachableWing[] = wings.map(w => ({
        wing: w,
        depthDays: w.depthDays,
        reachable: w.depthDays <= safeDepth,
        needsPierce: w.depthDays > safeDepth && w.depthDays <= piercedDepth,
        beyondTheWindow: w.depthDays > bestEver
    }));

    const reason = !convergence.open
        ? `Shut. It opens again in ${convergence.yearsUntilNext} years, give or take.`
        : `${convergence.daysLeft} days of window left, so ${Math.floor(safeDepth)} days in `
            + `is the deepest anybody walks back out from`
            + (pierce > 0 ? `, and a fold covers ${pierce} more of the way back.` : '.');

    return {
        convergence,
        safeDepth,
        piercedDepth,
        wings: mapped,
        unreachableWings: mapped.filter(w => w.beyondTheWindow).map(w => w.wing),
        reason
    };
}

// ─────────────────────────────────────────────────────────────────────────
// STAYING TOO LONG
// ─────────────────────────────────────────────────────────────────────────

export type OverstayOutcome =
    /** Out before it shut. */
    | 'left'
    /** Shut in, and the next convergence is inside their remaining span. */
    | 'shut_in'
    /** Shut in, and it is not. */
    | 'dies_inside';

export interface Overstay {
    outcome: OverstayOutcome;
    /** Absolute day the way out next exists. */
    reopensOnDay: number | null;
    /** Years they would be in there. */
    yearsShutIn: number;
    /** Years of lifespan they have when the door shuts. */
    yearsRemaining: number;
    /** The factual statement. No prose beyond what the numbers support. */
    summary: string;
}

/**
 * What happens to somebody still inside when it closes.
 *
 * Nothing kills them. The arithmetic does: the site is not reachable again for
 * `periodDays`, and either that fits inside what they have left or it does not.
 * A cultivator high enough for the period to be a nap survives it and comes out
 * into a world that has moved on, which is a good outcome and a rare one.
 */
export function resolveOverstay(
    location: LocationRecord,
    closedOnDay: number,
    actor: { realmOrdinal: number; bornOnDay: number }
): Overstay {
    const cycle = location.cycle;
    if (!cycle) {
        return {
            outcome: 'left',
            reopensOnDay: null,
            yearsShutIn: 0,
            yearsRemaining: 0,
            summary: 'Nothing here closes.'
        };
    }
    const reopens = nextOpeningDay(location, closedOnDay + 1);
    const yearsShutIn = Math.round(((reopens ?? closedOnDay + cycle.periodDays) - closedOnDay) / DAYS_PER_YEAR);
    const ageYears = (closedOnDay - actor.bornOnDay) / DAYS_PER_YEAR;
    const yearsRemaining = Math.max(0, Math.round(lifespanForOrdinal(actor.realmOrdinal) - ageYears));

    const survives = yearsRemaining > yearsShutIn;
    return {
        outcome: survives ? 'shut_in' : 'dies_inside',
        reopensOnDay: reopens,
        yearsShutIn,
        yearsRemaining,
        summary: survives
            ? `Shut in for ${yearsShutIn} years, with ${yearsRemaining} left. `
                + 'They come out into a world that did not wait.'
            : `Shut in for ${yearsShutIn} years, with ${yearsRemaining} left. `
                + `A ${rankName(actor.realmOrdinal)} does not last that long.`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WOULD ANYBODY COME
// ─────────────────────────────────────────────────────────────────────────

/**
 * The ties that would put somebody on the road for you.
 *
 * Read off `RelationshipKind`, which already exists and already means these
 * things. There is no rescue relationship and none may be added: a master comes
 * for a disciple, a creditor comes for what they are owed, a patron comes for
 * an investment, and kin come because they are kin. Each is a different price
 * and the engine does not decide which.
 */
export const RESCUE_PRECONDITIONS: Record<string, { kinds: RelationshipKind[]; minStanding: number; why: string }> = {
    master: {
        kinds: ['master'],
        minStanding: 0.2,
        why: 'A master does not lose a student to a door.'
    },
    kin: {
        kinds: ['kin', 'spouse', 'parent', 'child'],
        minStanding: 0.3,
        why: 'Blood, and nothing else needed.'
    },
    investment: {
        kinds: ['patron', 'client'],
        minStanding: 0.4,
        why: 'A house does not write off something it is still paying for.'
    },
    debt: {
        kinds: ['creditor', 'debtor'],
        minStanding: -1,
        why: 'What is owed does not collect itself out of a sealed room.'
    },
    oath: {
        kinds: ['ally'],
        minStanding: 0.6,
        why: 'Somebody said they would, in front of people.'
    }
};

/** The base odds that somebody who WOULD come actually gets there. */
export const RESCUE_BASE_CHANCE = 0.35;

/** How much of the odds standing is worth on top of the base. */
export const RESCUE_STANDING_WEIGHT = 0.3;

export interface RescuePledge {
    rescuerId: string;
    rescuerName: string;
    ordinal: number;
    /** Which precondition qualifies them. */
    precondition: string;
    why: string;
    standing: number;
    /** Days of depth they could cover today. Wanes with the window. */
    reach: number;
    /** Deep enough for where you are. False is a real and common answer. */
    reachesYou: boolean;
    /** Odds they actually come and arrive in time, 0..1. */
    chance: number;
}

/**
 * Who, if anybody, would come and get this person out - asked in advance.
 *
 * Legible before the decision, which is the whole point: a player who knows the
 * answer is nobody can still go deeper, and is doing it with their eyes open.
 *
 * Every candidate must clear three separate bars, and they are independent:
 * they must be able to fold space at all, they must hold a qualifying tie, and
 * the fold must reach the depth in question TODAY. The third is why calling
 * late fails - the reach is the waning distance, and it shrinks as the window
 * does.
 */
export function rescuersFor(
    state: WorldState,
    input: {
        subject: NpcRecord;
        location: LocationRecord;
        depthDays: number;
        day: number;
    }
): RescuePledge[] {
    const convergence = convergenceOf(input.location, input.day);
    const out: RescuePledge[] = [];

    for (const candidate of state.npcs) {
        if (candidate.id === input.subject.id) continue;
        if (candidate.status !== 'alive' || !isBelowTheLid(candidate)) continue;
        if (!isGrantAvailableAt(candidate.cultivation.realmOrdinal, PIERCE_GRANT)) continue;

        // The tie is read from the RESCUER's row toward the subject. Somebody
        // believing they have a master is not the same fact as the master
        // holding a student, and only the second one puts anybody on a road.
        const tie = candidate.relationships.find(r => r.targetId === input.subject.id);
        if (!tie) continue;

        let matched: string | null = null;
        for (const [name, rule] of Object.entries(RESCUE_PRECONDITIONS)) {
            if (rule.kinds.includes(tie.kind) && tie.standing >= rule.minStanding) {
                matched = name;
                break;
            }
        }
        if (!matched) continue;

        // Somebody at this height holds what their height makes possible; the
        // grant list is potential and this reads it as such, which is the one
        // place in the engine where "could hold it" is the right question -
        // a rescuer is not present to be assessed, and the world does not store
        // acquired grants for NPCs.
        const reach = Number((PIERCE_REACH_DAYS * convergence.remaining).toFixed(2));
        const chance = Math.max(0, Math.min(
            0.85,
            RESCUE_BASE_CHANCE + tie.standing * RESCUE_STANDING_WEIGHT
        ));

        out.push({
            rescuerId: candidate.id,
            rescuerName: candidate.name,
            ordinal: candidate.cultivation.realmOrdinal,
            precondition: matched,
            why: RESCUE_PRECONDITIONS[matched].why,
            standing: tie.standing,
            reach,
            reachesYou: reach >= input.depthDays,
            chance: Number(chance.toFixed(3))
        });
    }

    return out.sort((a, b) => b.chance - a.chance || b.ordinal - a.ordinal);
}

export interface RescueResult {
    came: boolean;
    rescuer: RescuePledge | null;
    /** Why not, when nobody did. Named, never blank. */
    refusal: string | null;
    /** The obligation the rescue opened. Null when nobody came. */
    obligation: { toId: string; toName: string; note: string } | null;
}

/**
 * Somebody is inside, the door is closing, and the call goes out.
 *
 * Mutates `state` on a success, because being fetched out is not free: the
 * subject leaves owing somebody who can reach them anywhere. The row is written
 * as `creditor`, which is exactly what the rescuer now is, and it goes on the
 * subject where every other inherited account already lives - so it outlives
 * them and lands on an heir like any other debt.
 */
export function attemptRescue(
    state: WorldState,
    input: {
        subject: NpcRecord;
        location: LocationRecord;
        depthDays: number;
        day: number;
    },
    rng: CultivationRNG
): RescueResult {
    const pledges = rescuersFor(state, input);
    if (pledges.length === 0) {
        return {
            came: false,
            rescuer: null,
            refusal: 'Nobody who could reach in here has any reason to.',
            obligation: null
        };
    }

    const inReach = pledges.filter(p => p.reachesYou);
    if (inReach.length === 0) {
        return {
            came: false,
            rescuer: null,
            refusal: `${pledges.length} would have come. The site is further out than it `
                + 'was when they set off, and none of them can cover the last of it.',
            obligation: null
        };
    }

    // One attempt per qualifying party, best odds first. They are separate
    // people making separate decisions; nothing here coordinates them.
    for (const pledge of inReach) {
        if (!rng.chance(pledge.chance)) continue;

        const note = `Came into ${input.location.name} for them before it shut.`;
        const at = state.npcs.findIndex(n => n.id === input.subject.id);
        if (at >= 0) {
            state.npcs[at] = upsertRelationship(state.npcs[at], {
                targetId: pledge.rescuerId,
                targetName: pledge.rescuerName,
                kind: 'creditor',
                standing: 0.5,
                note
            }, input.day);
        }
        return {
            came: true,
            rescuer: pledge,
            refusal: null,
            obligation: { toId: pledge.rescuerId, toName: pledge.rescuerName, note }
        };
    }

    return {
        came: false,
        rescuer: null,
        refusal: `${inReach.length} could have. None of them did, and the engine does not `
            + 'record why.',
        obligation: null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE SCHEDULE IS KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────

/**
 * A second scholar, and a different one.
 *
 * Placing the builder tells you what a house like that kept and where. Knowing
 * the cycle tells you WHEN YOU CAN GO, and the two are separate readings held
 * by separate people - which is what makes a properly equipped expedition three
 * people rather than one person with three advantages.
 *
 * Same predicate, same key mechanism, different subject.
 */
export const SCHEDULE_READ_ORDINAL = 10;

export interface ScheduleReading {
    known: boolean;
    /** What they can say, when they can say it. */
    periodYears: number | null;
    lastOpenedOnDay: number | null;
    nextOpensOnDay: number | null;
    windowDays: number | null;
    missing: string | null;
}

export function readSchedule(
    location: LocationRecord,
    actor: CapabilityActor,
    day: number
): ScheduleReading {
    if (!location.cycle) {
        return {
            known: true,
            periodYears: null,
            lastOpenedOnDay: null,
            nextOpensOnDay: null,
            windowDays: null,
            missing: null
        };
    }

    const bar = Number(location.data.scheduleReadOrdinal);
    const key = location.data.scheduleKey == null ? null : String(location.data.scheduleKey);
    const assessment = assessCapability(actor, makeSubject({
        kind: 'inscription',
        id: `${location.id}:schedule`,
        name: `when ${location.name} is next open`,
        requirements: makeRequirements({
            understand: Number.isFinite(bar) ? bar : SCHEDULE_READ_ORDINAL
        }),
        tags: ['schedule'],
        comprehensionKeys: key ? [key] : []
    }));

    if (!assessment.understand.holds) {
        return {
            known: false,
            periodYears: null,
            lastOpenedOnDay: null,
            nextOpensOnDay: null,
            windowDays: null,
            missing: 'It is open sometimes and shut the rest of the time. Working out '
                + 'when takes records going back further than anybody here keeps them.'
        };
    }

    const convergence = convergenceOf(location, day);
    return {
        known: true,
        periodYears: convergence.yearsUntilNext,
        lastOpenedOnDay: location.cycle.phaseDay
            + Math.floor((day - location.cycle.phaseDay) / location.cycle.periodDays)
                * location.cycle.periodDays,
        nextOpensOnDay: convergence.open ? day : convergence.opensOnDay,
        windowDays: location.cycle.openDays,
        missing: null
    };
}
