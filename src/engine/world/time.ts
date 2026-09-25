/**
 * Time.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { rankName } from '../cultivation/realms.js';
import { settleEstate, whereTheyFell } from './estate-at-death.js';
import {
    concurrentEventsFor,
    makeFact,
    type EventScale,
    type HistoricalEventKind,
    type HistoricalFact,
    type Observer
} from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { theWakeOfADeath, whatADeathIsWorth, whatTheyHeldUp } from './what-a-death-at-this-height-is-worth.js';
import { recordMasterLost } from './recording-where-somebody-stands-in-a-house.js';
import { openingsBetween, type LocationRecord } from './locations.js';
// The two standings at which the world calls a tie something. Imported from
// where they are defined rather than retyped here: `gatherings.ts` states in
// its own comment that `FRIENDSHIP_STANDING` is the bar `settleNpcDeath` uses
// read from the other end, and that sentence is only true if it is one number.
import { FRIENDSHIP_STANDING, GRUDGE_STANDING } from './gatherings.js';
import {
    inheritGoals,
    isTheWorldsToMove,
    legacyGoals,
    theWorldEnds,
    theTieBecomes,
    upsertRelationship,
    type NpcGoal,
    type NpcRecord,
    type RelationshipKind
} from './npc-state.js';
import { andTheOtherEnd } from './a-tie-has-two-ends.js';
import { heirsOf, type HeirRef } from './lineage.js';
import {
    isAStackOfCommunicationTalismans,
    theirSlipsBreak
} from './a-communication-talisman-carries-word-home.js';
import { theirJadeBreaks } from './a-pair-of-communication-jade.js';
import {
    isOpportunityOpen,
    missedWindowsFor,
    nextWindow,
    windowsBetween,
    type MissedWindow,
    type OpportunityWindow
} from './opportunities.js';
import {
    indexById,
    cloneWorld,
    lineageOf,
    schedule,
    upsertNpc,
    type ScheduledEffect,
    type ScheduledEffectKind,
    type StateChange,
    type WorldState
} from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// RESULT
// ─────────────────────────────────────────────────────────────────────────

export interface FiredEffect {
    effect: ScheduledEffect;
    /** Whether the effect's `chance` came up. A scheduled thing may not happen. */
    landed: boolean;
    onDay: number;
    /** Fact appended when it landed. Null when it did not. */
    factId: string | null;
}

export interface LifespanDeath {
    npcId: string;
    name: string;
    onDay: number;
    /** Realm at death, for the record. */
    rank: string;
}

export interface LocationOpening {
    locationId: string;
    name: string;
    opensOnDay: number;
    closesOnDay: number;
}

/**
 * Why an in-progress long action was handed back to the player.
 */
export type InterruptCause =
    | 'scheduled_interrupt'
    | 'local_event'
    | 'faction_event'
    | 'opportunity_opens'
    | 'opportunity_closes'
    | 'actor_involved'
    /**
     * The ground where they are standing did something it will not do again in
     * their lifetime. See {@link theOnlyOneTheyWillGet}.
     */
    | 'window_not_coming_again';

export interface WorldInterrupt {
    onDay: number;
    cause: InterruptCause;
    summary: string;
    /** The scheduled effect or opportunity that caused it. */
    sourceId: string;
    locationId: string | null;
}

/**
 * What should stop a long action.
 */
export interface InterruptPolicy {
    /** The action being run, for the digest. */
    actionKind?: string;
    /** The actor whose long action this is. */
    actorId?: string;
    /** Locations whose events reach them. Usually where they are sitting. */
    locationIds?: readonly string[];
    /** Factions whose business reaches them. */
    factionIds?: readonly string[];
    /** Stop when an effect flagged `interrupts` lands. Default true. */
    onScheduledInterrupt?: boolean;
    /** Stop when any event lands at one of `locationIds`. Default true. */
    onLocalEvents?: boolean;
    /** Stop when an opportunity at one of `locationIds` opens. Default false. */
    onOpportunityOpens?: boolean;
    /** Stop when an opportunity they know about closes unclaimed. Default false. */
    onOpportunityCloses?: boolean;
    /** Stop when a scheduled effect names the actor. Default true. */
    onActorInvolved?: boolean;
}

export interface TimeDigest {
    fromDay: number;
    toDay: number;
    fromYear: number;
    toYear: number;
    daysAdvanced: number;
    yearsAdvanced: number;
    /** Effects that fired and landed, chronologically. */
    happened: { onDay: number; year: number; summary: string; kind: ScheduledEffectKind }[];
    /** Things that happened while the observer was elsewhere. */
    missed: { id: string; year: number; summary: string; scale: EventScale }[];
    deaths: LifespanDeath[];
    openings: LocationOpening[];
    /** Opportunity windows that opened and shut without the observer. */
    missedOpportunities: MissedWindow[];
    /** Why the long action stopped, if it did. */
    interrupts: WorldInterrupt[];
    /** One-line account for the narrator to open on. */
    headline: string;
}

export interface TimeAdvanceResult {
    state: WorldState;
    fromDay: number;
    toDay: number;
    daysRequested: number;
    daysAdvanced: number;
    interrupted: boolean;
    interruptReason: string | null;
    interruptEffectId: string | null;
    fired: FiredEffect[];
    deaths: LifespanDeath[];
    openings: LocationOpening[];
    /** Facts in the span the observer was alive for and not present at. */
    concurrentEvents: HistoricalFact[];
    /** Windows that opened and closed unobserved, including ones never known. */
    missedOpportunities: MissedWindow[];
    /** World events that should hand control back to an in-progress action. */
    interrupts: WorldInterrupt[];
    /** Estates to settle. Handed to the social layer; see `onDeath`. */
    deathHandoffs: DeathHandoff[];
    changes: StateChange[];
    digest: TimeDigest;
}

/**
 * Everything one death hands on.
 */
export interface DeathHandoff {
    deceasedId: string;
    deceasedName: string;
    onDay: number;
    heirs: HeirRef[];
    /** Goals passed to the primary heir. Empty when there was nobody to take them. */
    goalsInherited: NpcGoal[];
    primaryHeirId: string | null;
}

export interface AdvanceTimeOptions {
    /**
     * Stop at the first interrupting effect that lands. Default true. A player
     * sealed in a cave for thirty years passes false, and then genuinely misses
     * whatever knocked on the door.
     */
    stopOnInterrupt?: boolean;
    /**
     * Whose point of view the digest's `missed` list is built for. Omit and the
     * list is empty - nobody was there to miss anything.
     */
    observer?: Observer;
    /** Cap on reported openings per location. */
    openingLimit?: number;
    /** Minimum magnitude for a fact to appear in `missed`. */
    minMissedMagnitude?: number;
    /** Cap on the `missed` list. */
    missedLimit?: number;
    /** What should hand control back to an in-progress long action. */
    interruptPolicy?: InterruptPolicy;
    /**
     * Mutate the given state instead of deep-copying it first.
     */
    inPlace?: boolean;
    /**
     * Called once per death, after heirs and goals have been resolved.
     */
    onDeath?: (handoff: DeathHandoff) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// ADVANCE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Advance the world clock by `days`.
 */
export function advanceTime(
    stateIn: WorldState,
    days: number,
    opts: AdvanceTimeOptions = {}
): TimeAdvanceResult {
    const state = opts.inPlace ? stateIn : cloneWorld(stateIn);
    const fromDay = state.currentDay;
    const daysRequested = Math.max(0, Math.floor(Number.isFinite(days) ? days : 0));
    const requestedTarget = fromDay + daysRequested;
    const stopOnInterrupt = opts.stopOnInterrupt ?? true;

    const changes: StateChange[] = [];
    const fired: FiredEffect[] = [];
    const interrupts: WorldInterrupt[] = [];
    const deathHandoffs: DeathHandoff[] = [];
    let interrupted = false;
    let interruptReason: string | null = null;
    let interruptEffectId: string | null = null;
    let target = requestedTarget;

    // A long action is stopped by the EARLIEST qualifying world event, which may
    // be an opportunity window rather than a scheduled effect. The opportunity
    // scan runs first because it is closed-form and cannot be affected by
    // anything the effects do.
    const policy = opts.interruptPolicy;
    const opportunityInterrupt = policy
        ? earliestOpportunityInterrupt(state, policy, fromDay, requestedTarget)
        : null;
    if (opportunityInterrupt) target = Math.min(target, opportunityInterrupt.onDay);

    // ── 1. Scheduled consequences, in date order. ────────────────────────
    // O(effects due), not O(days). An empty book means a century costs nothing.
    // A work queue rather than a snapshot: a repeating effect that fires and
    // reschedules inside the span has to be examined again, or an annual
    // recruitment would fire once across three hundred years.
    const due = state.schedule
        .filter(e => !e.fired && e.dueOnDay > fromDay && e.dueOnDay <= requestedTarget)
        .sort((a, b) => a.dueOnDay - b.dueOnDay || (a.id < b.id ? -1 : 1));

    let guard = 0;
    while (due.length > 0 && guard++ < 100_000) {
        const effect = due.shift()!;
        if (effect.dueOnDay > target) break;

        // The engine decides whether the scheduled thing actually happened.
        const rng = forStream(state.seed, 'schedule', effect.id, effect.dueOnDay);
        const landed = effect.chance >= 1 ? true : rng.chance(effect.chance);

        let factId: string | null = null;
        if (landed) {
            const fact = appendWorldFact(state, makeFact({
                day: effect.dueOnDay,
                kind: factKindFor(effect.kind),
                scale: scaleFor(effect),
                summary: effect.summary,
                actors: effect.actorIds.map(id => ({ id, name: nameFor(state, id), role: 'involved' })),
                witnessIds: [],
                locationId: effect.locationId,
                factionIds: effect.factionId ? [effect.factionId] : [],
                visibility: effect.kind === 'concurrent_event' ? 'regional' : 'faction',
                magnitude: Number(effect.data.magnitude ?? 0.4) || 0.4,
                data: { ...effect.data, scheduledEffectId: effect.id }
            }));
            factId = fact.id;
        }

        // Repeat or retire.
        const at = state.schedule.findIndex(e => e.id === effect.id);
        if (at >= 0) {
            if (effect.repeatDays && effect.repeatDays > 0) {
                const next = {
                    ...effect,
                    dueOnDay: effect.dueOnDay + effect.repeatDays,
                    firedOnDay: effect.dueOnDay
                };
                state.schedule[at] = next;
                if (next.dueOnDay <= requestedTarget) {
                    // Re-enter the queue in date order.
                    let i = 0;
                    while (i < due.length && due[i].dueOnDay <= next.dueOnDay) i++;
                    due.splice(i, 0, next);
                }
            } else {
                state.schedule[at] = { ...effect, fired: true, firedOnDay: effect.dueOnDay };
            }
        }
        fired.push({ effect, landed, onDay: effect.dueOnDay, factId });
        changes.push({
            entity: 'schedule', entityId: effect.id, field: 'fired',
            from: false, to: landed
        });

        if (!landed) continue;

        const cause = interruptCauseFor(effect, policy);
        if (cause && stopOnInterrupt) {
            interrupts.push({
                onDay: effect.dueOnDay,
                cause,
                summary: effect.summary,
                sourceId: effect.id,
                locationId: effect.locationId
            });
            interrupted = true;
            interruptReason = effect.summary;
            interruptEffectId = effect.id;
            target = effect.dueOnDay;
            break;
        }
    }

    // The opportunity window wins only if nothing earlier stopped us first.
    if (opportunityInterrupt && opportunityInterrupt.onDay <= target && stopOnInterrupt) {
        if (!interrupted || opportunityInterrupt.onDay < target) {
            interrupts.push(opportunityInterrupt);
            interrupted = true;
            interruptReason = opportunityInterrupt.summary;
            target = opportunityInterrupt.onDay;
        }
    }

    const daysAdvanced = Math.max(0, target - fromDay);

    // ── 3. Lifespans. A death date is a stored number, so this is one pass
    //       over the roster rather than anything that has to be simulated. ──
    const deaths: LifespanDeath[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        // Only the living run out of lifespan. A missing cultivator is not
        // adjudicated by the clock, and a sealed one is not ageing.
        if (npc.status !== 'alive') continue;
        // And the player's own death is not the world clock's to declare. It
        // belongs to the survival layer, on the sheet that actually holds their
        // years; the mirror row this pass can see is a projection of that sheet
        // and killing it would append a death to the chronicle mid-run.
        if (!isTheWorldsToMove(npc)) continue;
        if (npc.cultivation.lifespanEndsOnDay > target) continue;
        const onDay = Math.max(fromDay, npc.cultivation.lifespanEndsOnDay);
        const rank = rankName(npc.cultivation.realmOrdinal);
        const dead = theWorldEnds(
            npc,
            onDay,
            `Lifespan exhausted at ${rank}. Died of old age.`
        );
        // A guard that stops a murder and shrugs at time is not a guard, it is
        // a delay: old age is the one pass certain to fire eventually, and it is
        // also the pass the Old River catalog has spoken about most directly -
        // the span is the whole of what it says the ancestor carries.
        if (!dead) continue;
        state.npcs[i] = dead;
        // HOW FAR IT CARRIES IS NOT DECIDED HERE, AND THE WORLD MOVES.
        //
        // This is the commonest death in the world and, once the `elder_died`
        // pass stopped inventing an earlier version of it, the one most people
        // at height will ever have. It was also the one death that dropped
        // nothing: the house went on being read at the strength of somebody who
        // is not on it any more, the oaths they swore stood with nobody to keep
        // them, and a chair at the top of a house emptied in silence. Two calls,
        // both of them the ones `elder_died` already makes - one authority on
        // what a death at this rung is worth, and one on what the world does
        // about it. See `what-a-death-at-this-height-is-worth.ts`.
        const worth = whatADeathIsWorth(
            npc, state.factions.find(f => f.id === npc.factionId) ?? null,
            whatTheyHeldUp(state, npc));
        appendWorldFact(state, makeFact({
            day: onDay,
            kind: 'death',
            scale: worth.scale,
            actors: [{ id: npc.id, name: npc.name, role: 'deceased' }],
            locationId: npc.locationId,
            factionIds: npc.factionId ? [npc.factionId] : [],
            summary: `${npc.name}, ${rank}, reached the end of their lifespan and died of old age.`,
            visibility: worth.visibility,
            magnitude: worth.magnitude
        }));
        theWakeOfADeath(state, state.npcs[i]!, onDay, 'Their span ran out.');
        // The back-link used to be written here, unguarded, and `appendWorldFact`
        // now does it - the deceased is an actor on their own death. Two writes
        // was harmless only while every fact had a fresh id; once a recurring
        // statement became one row that absorbs later occurrences, the second
        // write started putting the same id onto the same person again and
        // again. Removed rather than guarded, because one writer is the point.
        deaths.push({ npcId: npc.id, name: npc.name, onDay, rank });
        changes.push({
            entity: 'npc', entityId: npc.id, field: 'status',
            from: 'alive', to: 'physically_dead'
        });
        deathHandoffs.push(settleNpcDeath(state, npc, onDay));
    }

    // Deaths the caller caused elsewhere in the span still need settling, so the
    // hook fires once per handoff after every death is known.
    if (opts.onDeath) {
        for (const handoff of deathHandoffs) opts.onDeath(handoff);
    }

    // ── 4. Sealed places that opened or closed while nobody was looking. ──
    const openings: LocationOpening[] = [];
    const openingLimit = opts.openingLimit ?? 4;
    for (const location of state.locations) {
        if (!location.cycle || location.sealed) continue;
        for (const w of openingsBetween(location, fromDay, target, openingLimit)) {
            openings.push({
                locationId: location.id,
                name: location.name,
                opensOnDay: w.opensOnDay,
                closesOnDay: w.closesOnDay
            });
        }
    }
    openings.sort((a, b) => a.opensOnDay - b.opensOnDay || (a.locationId < b.locationId ? -1 : 1));

    // Windows that opened and shut in the span. `unknown: true` is the honest
    // and common case: the player can miss things they never heard about.
    const observerId = opts.observer?.id ?? null;
    const missedOpportunities: MissedWindow[] = [];
    for (const opp of state.opportunities) {
        missedOpportunities.push(...missedWindowsFor(opp, fromDay, target, observerId, 4));
    }
    missedOpportunities.sort(
        (a, b) => a.closesOnDay - b.closesOnDay || (a.opportunityId < b.opportunityId ? -1 : 1)
    );
    for (const miss of missedOpportunities) {
        const at = state.opportunities.findIndex(o => o.id === miss.opportunityId);
        if (at >= 0) {
            state.opportunities[at] = {
                ...state.opportunities[at],
                missedWindows: state.opportunities[at].missedWindows + 1
            };
        }
    }

    state.currentDay = target;
    changes.push({ entity: 'world', entityId: state.id, field: 'currentDay', from: fromDay, to: target });

    // ── 5. What the observer missed. ─────────────────────────────────────
    const concurrentEvents = opts.observer
        ? concurrentEventsFor(state.history, opts.observer, fromDay + 1, target + 1, {
            minMagnitude: opts.minMissedMagnitude ?? 0.3
        })
        : [];

    const digest = buildDigest(
        fromDay, target, daysAdvanced, fired, deaths, openings, concurrentEvents,
        missedOpportunities, interrupts, opts.missedLimit ?? 40
    );

    return {
        state,
        fromDay,
        toDay: target,
        daysRequested,
        daysAdvanced,
        interrupted,
        interruptReason,
        interruptEffectId,
        fired,
        deaths,
        openings,
        concurrentEvents,
        missedOpportunities,
        interrupts,
        deathHandoffs,
        changes,
        digest
    };
}

// ─────────────────────────────────────────────────────────────────────────
// INTERRUPTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether this effect should hand control back, and why.
 */
function interruptCauseFor(
    effect: ScheduledEffect,
    policy: InterruptPolicy | undefined
): InterruptCause | null {
    if (!policy) return effect.interrupts ? 'scheduled_interrupt' : null;
    if ((policy.onScheduledInterrupt ?? true) && effect.interrupts) return 'scheduled_interrupt';
    if (
        (policy.onActorInvolved ?? true) &&
        policy.actorId &&
        effect.actorIds.includes(policy.actorId)
    ) {
        return 'actor_involved';
    }
    if (
        (policy.onLocalEvents ?? true) &&
        effect.locationId &&
        (policy.locationIds ?? []).includes(effect.locationId)
    ) {
        return 'local_event';
    }
    if (
        effect.factionId &&
        (policy.factionIds ?? []).includes(effect.factionId)
    ) {
        return 'faction_event';
    }
    return null;
}

/**
 * Whether this window is the only one of its kind this person will get.
 *
 * THE RULE THAT LETS THE WORLD REACH SOMEBODY IN NO HOUSE, and the one place
 * the two legitimate limiters meet: a fact about the world - how often this
 * ground opens - read against a fact about the body - how much span is left to
 * wait with. Nothing here is a constant, and nothing here is a rule about how a
 * sentence may be shaped.
 *
 * Measured on three fixture worlds, and the reason a rarity rule here is a
 * chasm rather than a knife edge: of 49 opportunities per world, 43 come round
 * annually or oftener and 6 come round every 46 to 116 years, with nothing in
 * between. The annual ones are one ripening per region - the ordinary business
 * of a place, which is what a shut door and the digest are both for.
 *
 * It reads differently at the three heights, which is the point rather than a
 * side effect: sixty years is the only chance a Qi Condensation cultivator will
 * see, and it is weather to somebody carrying thirty thousand.
 *
 * A null lifespan is nobody by that id on the roster, and then the rule cannot
 * be applied and claims nothing.
 */
function theOnlyOneTheyWillGet(
    opp: OpportunityWindow,
    opensOnDay: number,
    lifespanEndsOnDay: number | null
): boolean {
    if (lifespanEndsOnDay === null || lifespanEndsOnDay <= opensOnDay) return false;
    if (opp.recurrenceDays === null || opp.recurrenceDays <= 0) return true;
    // From the day it opens, not from today. A cycle shorter than a whole
    // lifespan can still have its next turn fall past the end of one when the
    // opening is late, and asking from today gets that case wrong in the
    // direction that matters - it is exactly the person with one chance left.
    return opensOnDay + opp.recurrenceDays > lifespanEndsOnDay;
}

/** The day this person's span runs out, or null when the world has no row for them. */
function whenTheirSpanRunsOut(state: WorldState, actorId: string | undefined): number | null {
    if (!actorId) return null;
    const npc = state.npcs.find(n => n.id === actorId);
    return npc ? npc.cultivation.lifespanEndsOnDay : null;
}

/**
 * The first opportunity window in the span that should stop a long action.
 *
 * Closed-form: `nextWindow` and `windowsBetween` do not iterate days, so this
 * is affordable across a three-hundred-year advance.
 */
function earliestOpportunityInterrupt(
    state: WorldState,
    policy: InterruptPolicy,
    fromDay: number,
    toDay: number
): WorldInterrupt | null {
    const wantOpen = policy.onOpportunityOpens ?? false;
    const wantClose = policy.onOpportunityCloses ?? false;
    const locations = new Set(policy.locationIds ?? []);
    // A window that will not come again is not governed by either flag above.
    // `onOpportunityOpens` is about being told a door is open SOMEWHERE and
    // stays false; this is about the ground under their feet. It enters by the
    // door every other local event enters by - an explicit match on where they
    // are standing, which `whatReachesSomebodySpendingASpanHere` empties when a
    // door is shut - so sealing yourself in still costs you the ruin opening.
    const endsOn = whenTheirSpanRunsOut(state, policy.actorId);
    const wantOnlyOne = (policy.onLocalEvents ?? true) && locations.size > 0 && endsOn !== null;
    if (!wantOpen && !wantClose && !wantOnlyOne) return null;
    let best: WorldInterrupt | null = null;

    for (const opp of state.opportunities) {
        if (
            wantOnlyOne &&
            opp.locationId !== null &&
            locations.has(opp.locationId) &&
            // Already standing open when they sat down is not the world cutting
            // in - it is something they walked past. Only an opening INSIDE the
            // span stops anybody.
            !isOpportunityOpen(opp, fromDay)
        ) {
            const w = nextWindow(opp, fromDay + 1);
            if (
                w && w.opensOnDay > fromDay && w.opensOnDay <= toDay &&
                theOnlyOneTheyWillGet(opp, w.opensOnDay, endsOn)
            ) {
                if (!best || w.opensOnDay < best.onDay) {
                    best = {
                        onDay: w.opensOnDay,
                        cause: 'window_not_coming_again',
                        summary:
                            `${opp.name} is open. The next opening is past the end of this lifespan.`,
                        sourceId: opp.id,
                        locationId: opp.locationId
                    };
                }
            }
        }
        if (locations.size > 0 && (!opp.locationId || !locations.has(opp.locationId))) continue;
        if (wantOpen) {
            const w = nextWindow(opp, fromDay + 1);
            if (w && w.opensOnDay > fromDay && w.opensOnDay <= toDay) {
                if (!best || w.opensOnDay < best.onDay) {
                    best = {
                        onDay: w.opensOnDay,
                        cause: 'opportunity_opens',
                        summary: `${opp.name} is open.`,
                        sourceId: opp.id,
                        locationId: opp.locationId
                    };
                }
            }
        }
        if (wantClose && (!policy.actorId || opp.knownToIds.includes(policy.actorId))) {
            for (const w of windowsBetween(opp, fromDay, toDay, 4)) {
                if (w.closesOnDay > fromDay && w.closesOnDay <= toDay) {
                    if (!best || w.closesOnDay < best.onDay) {
                        best = {
                            onDay: w.closesOnDay,
                            cause: 'opportunity_closes',
                            summary: `${opp.name} is closing.`,
                            sourceId: opp.id,
                            locationId: opp.locationId
                        };
                    }
                    break;
                }
            }
        }
    }
    return best;
}

/**
 * When the world would hand control back inside this span, WITHOUT moving it.
 *
 * `advanceTime` has always known how to stop. What it cannot do is answer the
 * question the play loop asks BEFORE anything is spent: how many of these days
 * does this person get? The play loop settles a span in one direction - the
 * window decides how long it runs, the skip runs exactly that, and the world is
 * then moved exactly as far as the body went - so moving the world first would
 * commit days a wound on day four means nobody reaches, and moving it twice
 * would fire the same year twice. Hence a READ.
 *
 * Deterministic against the advance that follows, by construction: whether an
 * effect lands is `forStream(seed, 'schedule', id, day)`, minted fresh from
 * those four things. And the rule about WHICH effects stop somebody is not
 * restated - `interruptCauseFor` is the one copy, and this calls it.
 *
 * It cannot see an effect the span itself puts on the books; the pressure layer
 * schedules as it goes. A span is only ever cut by this and never lengthened,
 * so the worst case is that such an effect reaches the player through the
 * ordinary digest instead of through the span.
 */
export function whenTheWorldWouldInterrupt(
    state: WorldState,
    policy: InterruptPolicy,
    fromDay: number,
    days: number
): WorldInterrupt | null {
    const span = Math.max(0, Math.floor(days));
    if (span <= 0) return null;
    const target = fromDay + span;

    let best: WorldInterrupt | null =
        earliestOpportunityInterrupt(state, policy, fromDay, target);

    for (const effect of state.schedule) {
        if (effect.fired) continue;
        const cause = interruptCauseFor(effect, policy);
        if (cause === null) continue;
        // Never past what something else already found. A repeating effect can
        // be due a thousand times in three hundred years and only the first of
        // them can stop anybody.
        const until = best === null ? target : Math.min(target, best.onDay);
        for (const day of whenThisFallsDue(effect, fromDay, until)) {
            // The same two lines `advanceTime` runs, in the same order: the
            // stream is keyed on the day it is due, and a certainty does not
            // draw from it at all.
            const landed = effect.chance >= 1
                || forStream(state.seed, 'schedule', effect.id, day).chance(effect.chance);
            if (!landed) continue;
            const earlier = best === null
                || day < best.onDay
                // `advanceTime` breaks a tie by id, because that is the order
                // it sorted the queue in. Same tie, same winner.
                || (day === best.onDay && effect.id < best.sourceId);
            if (earlier) {
                best = {
                    onDay: day,
                    cause,
                    summary: effect.summary,
                    sourceId: effect.id,
                    locationId: effect.locationId
                };
            }
            break;
        }
    }
    return best;
}

/** Every day inside `(fromDay, toDay]` this effect falls due on. */
function* whenThisFallsDue(
    effect: ScheduledEffect,
    fromDay: number,
    toDay: number
): Generator<number> {
    const repeat = effect.repeatDays ?? 0;
    if (repeat <= 0) {
        if (effect.dueOnDay > fromDay && effect.dueOnDay <= toDay) yield effect.dueOnDay;
        return;
    }
    let day = effect.dueOnDay;
    if (day <= fromDay) {
        // Closed form, not a walk: an annual effect first written four hundred
        // years ago must not cost four hundred iterations to skip past.
        day += Math.ceil((fromDay + 1 - day) / repeat) * repeat;
    }
    let guard = 0;
    while (day <= toDay && guard++ < 100_000) {
        yield day;
        day += repeat;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// DEATH
// ─────────────────────────────────────────────────────────────────────────

/**
 * Settle one death: heirs, and the goals that outlive their holder.
 */
export function settleNpcDeath(state: WorldState, deceased: NpcRecord, onDay: number): DeathHandoff {
    const lineage = lineageOf(state, deceased.id);
    const alive = (id: string) => {
        const npc = state.npcs.find(n => n.id === id);
        return npc != null && (npc.status === 'alive' || npc.status === 'soul_preserved');
    };
    const heirs = lineage ? heirsOf(lineage, deceased.id, alive) : [];
    const primary = heirs[0] ?? null;

    const goals = legacyGoals(deceased);
    let inherited: NpcGoal[] = [];
    if (primary) {
        const at = indexById(state.npcs, primary.id);
        if (at >= 0) {
            if (goals.length > 0) {
                const before = state.npcs[at].goals.length;
                state.npcs[at] = inheritGoals(state.npcs[at], goals, deceased.id, onDay);
                inherited = state.npcs[at].goals.slice(before);
            }
            // ── AND THE ACCOUNTS, IN BOTH DIRECTIONS, DEALT ROUND ────────
            //
            // Every account went to `primary`, which is `heirs[0]` - a constant
            // index and not a choice, so nothing in a run could spread it and
            // one person collected a dead master's whole list. Measured over 200
            // years on two worlds: 293 inherited ties on 71 living people, 37 of
            // them holding four or more, in a world where 92% carried nothing.
            // A few collectors rather than a texture.
            //
            // THE ORDER IS MEANINGFUL AND IS KEPT. `heirsOf` walks a priority -
            // descendant, successor, disciple, clan, sworn sibling - and within
            // each, oldest edge first. So the senior claim takes the weightiest
            // account and the rest are dealt round in that order: a master's
            // unfinished business splitting among the disciples, which is the
            // genre's answer as well as the distribution's.
            //
            // THE DAMPER SURVIVES AND MATTERS MORE NOW. An heir who already
            // knows the target inherits nothing about them, and with one taker
            // that swallowed the account entirely. Dealt round, an account one
            // heir would have swallowed can land cleanly on the next - so this
            // may move the numbers further than the dealing does.
            const takers = heirs
                .map(heir => indexById(state.npcs, heir.id))
                .filter(index => index >= 0);
            const dealt = deceased.relationships
                .filter(account => account.standing <= GRUDGE_STANDING
                    || account.standing >= FRIENDSHIP_STANDING)
                .sort((a, b) => a.standing - b.standing);
            for (const [n, account] of dealt.entries()) {
                for (let step = 0; step < takers.length; step++) {
                    const to = takers[(n + step) % takers.length]!;
                    const heir = state.npcs[to]!;
                    if (account.targetId === heir.id) continue;
                    if (heir.relationships.some(r => r.targetId === account.targetId)) continue;
                    state.npcs[to] = upsertRelationship(heir, {
                        targetId: account.targetId,
                        targetName: account.targetName,
                        kind: inheritedKind(account.kind, account.standing),
                        // It thins by a generation, and it does not go away.
                        standing: account.standing * 0.85,
                        note: account.note,
                        factIds: account.factIds,
                        inheritedFromId: deceased.id
                    }, onDay);
                    andTheOtherEnd(state.npcs, state.npcs[to], { targetId: account.targetId, kind: inheritedKind(account.kind, account.standing), standing: 0 }, onDay);
                    break;
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // AND THE THINGS THEY WERE HOLDING
    // ═══════════════════════════════════════════════════════════════════
    //
    // This function moved goals and relationships and touched NO OBJECT AND NO
    // STONE. Two hundred years of NPC deaths left zero loot and zero graves,
    // and every grave in the repo was hand-authored. The comment forty lines
    // down already said *"an estate that went somewhere is a fact about the
    // world, and it is the one a descendant three centuries later is standing
    // on"* - and then wrote only the fact.
    //
    // So the world had a one-way object economy. `settleEstate` existed, was
    // tested, and had exactly one caller: the player's own death, in
    // `src/web/`. Every rule about what happens to a dead cultivator's things
    // had already been ruled on and was reachable by one person in the world.
    //
    // WHO GOES THROUGH THE BODY IS THE CALLER'S DECISION, and `settleEstate`
    // takes the first name on the list. The order here is the ruling.
    //
    // THE HEIR FIRST, IF THEY ARE ACTUALLY STANDING THERE. An heir who is not
    // does not get a look-in, and that is deliberate: the field is documented
    // as *"people close enough to go through the body"*, and a cultivator who
    // dies alone in a ruin is looted by whoever finds them however many sons
    // they have. It is what makes dying at home different from dying out.
    //
    // AND AFTER THEM IT IS CHANCE, NOT ALPHABETICAL. A first cut sorted the
    // rest by id, which is deterministic and wrong in a way that only showed up
    // when the world was lived: the same NPC is first by id at that location
    // every time, so ONE person went through every body that fell there for two
    // hundred years. Measured, the richest NPC in a 600-person world came out
    // on 45,934 stones - not a rich cultivator, a serial looter created by a
    // sort order.
    //
    // Drawn on its own named stream keyed to the deceased, so it is reproducible
    // for a given world and cannot shift anything else's draws.
    const reachedFirst = forStream(state.seed, 'who-reached-the-body', deceased.id, onDay);
    const overTheBody = state.npcs
        .filter(n => n.id !== deceased.id
            && n.locationId === deceased.locationId
            && (n.status === 'alive' || n.status === 'soul_preserved'))
        .map(n => ({ npc: n, draw: reachedFirst.next() }))
        .sort((a, b) => (a.npc.id === primary?.id ? -1 : b.npc.id === primary?.id ? 1 : 0)
            || a.draw - b.draw)
        .map(row => ({ id: row.npc.id, name: row.npc.name }));

    // THEIR SLIPS BREAK WITH THEIR LAMP. A communication talisman sends word as
    // the person it is keyed to, so both halves of their pairs go when they do,
    // here and before anybody goes through the body: there is nothing for a
    // looter to take. See `theirSlipsBreak`.
    theirSlipsBreak(state.objects, deceased.id);
    // And any pair of communication jade they were half of, both halves, which
    // answer to nothing once one end of them is gone and are collected rather
    // than left in the world's things. Before the estate, so nobody inherits
    // half of a pair that cannot be spoken into.
    theirJadeBreaks(state.objects, deceased.id, onDay);

    const estate = settleEstate({
        dead: { id: deceased.id, name: deceased.name },
        onDay,
        locationId: deceased.locationId,
        // The ground they hit, which is what marks what comes off them. An NPC
        // has no grave row of its own, so this is the same place - and it is
        // still read as the SITE rather than assumed, because the player path
        // settles onto a grave whose danger is a different fact.
        fell: whereTheyFell(state.locations.find(l => l.id === deceased.locationId)),
        seed: state.seed,
        // NPCs carry stones and no counted stock. An empty stack list is not a
        // placeholder for one that should exist: `NpcRecord` has no pack, and
        // inventing stacks here would be this file asserting an inventory
        // nothing else in the world reads or writes.
        counted: { spiritStones: deceased.spiritStones, stock: [] },
        tracked: state.objects
            .filter(o => o.possessorId === deceased.id && !isAStackOfCommunicationTalismans(o))
            .map(o => ({
                itemId: o.id,
                name: o.name,
                kind: o.kind,
                significance: o.significance,
                power: o.power,
                description: o.description,
                worldRow: o
            })),
        standingOver: overTheBody,
        causeNote: `${deceased.name} died in the world's own time.`
    });

    // The rows the settlement rewrote go back where they came from, matched by
    // id: `settleEstate` is pure and returns what SHOULD be true, and putting
    // it back is the caller's - which is this.
    for (const moved of estate.objects) {
        const at = state.objects.findIndex(o => o.id === moved.id);
        if (at >= 0) state.objects[at] = moved;
        else state.objects.push(moved);
    }

    // AND THE PURSE ACTUALLY MOVES. The dead hold nothing; whoever went through
    // the body is that much richer. Where nobody did, the stones are in the
    // ground with them and are simply gone from circulation - which is the
    // honest answer and the reason a world can lose wealth at all.
    if (estate.taken !== null && estate.taker !== null) {
        const at = indexById(state.npcs, estate.taker!.id);
        if (at >= 0) {
            state.npcs[at] = {
                ...state.npcs[at],
                spiritStones: state.npcs[at].spiritStones + estate.taken.spiritStones,
                updatedOnDay: onDay
            };
        }
    }
    {
        const at = indexById(state.npcs, deceased.id);
        if (at >= 0) state.npcs[at] = { ...state.npcs[at], spiritStones: 0, updatedOnDay: onDay };
    }

    // AND THE BONDS THEY HELD ARE BONDS THAT ENDED. `former_master` and
    // `former_disciple` are the ledger's own words for a bond that is over, and
    // death ends one: without this the master of somebody who died went on
    // reading as their master for the rest of their own life.
    //
    // `theTieBecomes` and not a write, because rows are keyed by the pair AND
    // the kind: writing `former_master` beside a live `master` row would leave
    // both standing, and everything else between the two - a marriage, a blood
    // tie - is untouched either way.
    const ENDED_BY_DEATH: Readonly<Partial<Record<string, 'former_master' | 'former_disciple'>>> = {
        master: 'former_master', disciple: 'former_disciple'
    };
    for (let i = 0; i < state.npcs.length; i++) {
        const other = state.npcs[i]!;
        if (other.id === deceased.id) continue;
        for (const held of other.relationships.filter(r => r.targetId === deceased.id)) {
            const ended = ENDED_BY_DEATH[held.kind];
            if (ended === undefined) continue;
            state.npcs[i] = theTieBecomes(state.npcs[i]!, deceased.id, held.kind, ended, onDay);
        }
    }

    // A teaching line that ended today.
    for (const tie of deceased.relationships) {
        if (tie.kind !== 'disciple') continue;
        const student = state.npcs.find(n => n.id === tie.targetId);
        if (!student || student.status !== 'alive') continue;
        recordMasterLost(state, student, deceased, 'died', onDay);
    }

    // An estate that went somewhere is a fact about the world, and it is the
    // one a descendant three centuries later is standing on.
    if (primary && (inherited.length > 0 || heirs.length > 0)) {
        const heir = state.npcs.find(n => n.id === primary.id);
        appendWorldFact(state, makeFact({
            day: onDay,
            kind: 'inheritance',
            scale: 'personal',
            actors: [
                { id: deceased.id, name: deceased.name, role: 'deceased' },
                { id: primary.id, name: heir?.name ?? primary.id, role: 'heir' }
            ],
            locationId: deceased.locationId,
            factionIds: deceased.factionId ? [deceased.factionId] : [],
            summary:
                `${heir?.name ?? primary.id} took what ${deceased.name} left` +
                (inherited.length > 0
                    ? `, including ${inherited.length} unfinished piece${inherited.length === 1 ? '' : 's'} of business`
                    : '') + '.',
            visibility: 'faction',
            magnitude: 0.2,
            data: {
                unattributed: 'A holding up the valley has changed hands within a family.',
                goalsInherited: inherited.length
            }
        }));
    }

    return {
        deceasedId: deceased.id,
        deceasedName: deceased.name,
        onDay,
        heirs,
        goalsInherited: inherited,
        primaryHeirId: primary ? primary.id : null
    };
}

/**
 * What a tie becomes in the next pair of hands.
 */
function inheritedKind(kind: RelationshipKind, standing: number): RelationshipKind {
    if (standing < 0) return kind;
    switch (kind) {
        case 'spouse':
        case 'parent':
        case 'child':
        case 'kin':
        case 'master':
        case 'disciple':
            return 'ally';
        default:
            return kind;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// CONCURRENT EVENTS
// ─────────────────────────────────────────────────────────────────────────

export interface ConcurrentEventInput {
    /** Absolute day it happens. May be far in the future. */
    onDay: number;
    summary: string;
    scale?: EventScale;
    locationId?: string | null;
    factionId?: string | null;
    actorIds?: string[];
    /** Probability it actually comes off. Resolved by the engine, not the LLM. */
    chance?: number;
    magnitude?: number;
}

/**
 * Put a major event on the books for a date the player may or may not be around
 * for.
 */
export function scheduleConcurrentEvent(
    state: WorldState,
    input: ConcurrentEventInput
): { state: WorldState; effectId: string } {
    // Booked through `schedule()`, whose contract this is.
    const booked = schedule(state, {
        kind: 'concurrent_event',
        dueOnDay: input.onDay,
        summary: input.summary,
        actorIds: input.actorIds ?? [],
        locationId: input.locationId ?? null,
        factionId: input.factionId ?? null,
        chance: input.chance ?? 1,
        data: {
            scale: input.scale ?? 'regional',
            magnitude: input.magnitude ?? 0.6
        }
    });
    return { state: booked.state, effectId: booked.effect.id };
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function nameFor(state: WorldState, id: string): string {
    return state.npcs.find(n => n.id === id)?.name ?? id;
}

function factKindFor(kind: ScheduledEffectKind): HistoricalEventKind {
    switch (kind) {
        case 'lifespan_end': return 'death';
        case 'seal_opens': return 'realm_opened';
        case 'seal_closes': return 'ruin_sealed';
        case 'debt_due': return 'debt_incurred';
        case 'promise_due': return 'oath_sworn';
        case 'war_resolves': return 'war';
        // An assessment on the books is a grant on a vein coming up for
        // renewal. Filing it as 'promotion' made that kind the third-heaviest
        // in the ledger with nothing in it about anybody.
        case 'assessment': return 'grant_renewed';
        case 'construction_finishes': return 'territory_changed';
        case 'concurrent_event': return 'catastrophe';
        case 'meeting':
        case 'recovery_finishes':
        case 'custom':
        default:
            return 'opportunity';
    }
}

function scaleFor(effect: ScheduledEffect): EventScale {
    const declared = effect.data.scale;
    if (typeof declared === 'string') {
        if (
            declared === 'personal' || declared === 'local' || declared === 'regional' ||
            declared === 'continental' || declared === 'world'
        ) {
            return declared;
        }
    }
    return effect.kind === 'concurrent_event' ? 'regional' : 'personal';
}

function buildDigest(
    fromDay: number,
    toDay: number,
    daysAdvanced: number,
    fired: readonly FiredEffect[],
    deaths: readonly LifespanDeath[],
    openings: readonly LocationOpening[],
    concurrent: readonly HistoricalFact[],
    missedOpportunities: readonly MissedWindow[],
    interrupts: readonly WorldInterrupt[],
    missedLimit: number
): TimeDigest {
    const fromYear = Math.floor(fromDay / DAYS_PER_YEAR);
    const toYear = Math.floor(toDay / DAYS_PER_YEAR);
    const happened = fired
        .filter(f => f.landed)
        .map(f => ({
            onDay: f.onDay,
            year: Math.floor(f.onDay / DAYS_PER_YEAR),
            summary: f.effect.summary,
            kind: f.effect.kind
        }));

    const missed = concurrent
        .slice()
        .sort((a, b) => b.magnitude - a.magnitude || a.day - b.day)
        .slice(0, missedLimit)
        .map(f => ({ id: f.id, year: f.year, summary: f.summary, scale: f.scale }))
        .sort((a, b) => a.year - b.year || (a.id < b.id ? -1 : 1));

    const years = (toDay - fromDay) / DAYS_PER_YEAR;
    const interruptNote = interrupts.length > 0
        ? ` Stopped early: ${interrupts[0].summary}`
        : '';
    const missedNote = missedOpportunities.length > 0
        ? ` ${missedOpportunities.length} opportunit${missedOpportunities.length === 1 ? 'y' : 'ies'} came and went.`
        : '';
    const headline =
        years >= 1
            ? `${years.toFixed(years >= 10 ? 0 : 1)} years passed. ` +
              `${happened.length} scheduled thing${happened.length === 1 ? '' : 's'} came due, ` +
              `${deaths.length} died of old age, ` +
              `${missed.length} thing${missed.length === 1 ? '' : 's'} happened elsewhere.` +
              missedNote + interruptNote
            : `${daysAdvanced} day${daysAdvanced === 1 ? '' : 's'} passed. ` +
              `${happened.length} scheduled thing${happened.length === 1 ? '' : 's'} came due.` +
              missedNote + interruptNote;

    return {
        fromDay,
        toDay,
        fromYear,
        toYear,
        daysAdvanced,
        yearsAdvanced: Number(years.toFixed(4)),
        happened,
        missed,
        deaths: deaths.slice(),
        openings: openings.slice(),
        missedOpportunities: missedOpportunities.slice(),
        interrupts: interrupts.slice(),
        headline
    };
}

// Re-exported so callers driving the clock do not have to reach into two
// modules to set up the things it fires.
export { upsertNpc };
export type { LocationRecord, NpcRecord, OpportunityWindow, MissedWindow, HeirRef };
