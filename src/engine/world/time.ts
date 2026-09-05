/**
 * Time.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { rankName } from '../cultivation/realms.js';
import {
    classifyForObserver,
    concurrentEventsFor,
    makeFact,
    type EventScale,
    type HistoricalEventKind,
    type HistoricalFact,
    type Observer
} from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
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
    markDead,
    upsertRelationship,
    type NpcGoal,
    type NpcRecord,
    type RelationshipKind
} from './npc-state.js';
import { heirsOf, type HeirRef } from './lineage.js';
import {
    missedWindowsFor,
    nextWindow,
    windowsBetween,
    type MissedWindow,
    type OpportunityWindow
} from './opportunities.js';
import {
    cloneWorld,
    getActor,
    lineageOf,
    upsertActor,
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

export interface ProcessOutcome {
    processId: string;
    actorId: string;
    /** Days the process was actually running inside the advanced span. */
    days: number;
    /** Net resource change applied to the actor. */
    deltas: Record<string, number>;
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
    | 'actor_involved';

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
    processOutcomes: ProcessOutcome[];
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

    // ── 2. Durable processes, as a rate times a span. ────────────────────
    const processOutcomes: ProcessOutcome[] = [];
    for (const process of state.processes) {
        const start = Math.max(process.startedOnDay, fromDay);
        const end = Math.min(process.endsOnDay ?? target, target);
        const span = end - start;
        if (span <= 0) continue;

        const actor = getActor(state, process.actorId);
        if (!actor) continue;

        const deltas: Record<string, number> = {};
        const resources = { ...actor.resources };
        for (const key of Object.keys(process.perDay).sort()) {
            const delta = process.perDay[key] * span;
            if (delta === 0) continue;
            const before = resources[key] ?? 0;
            const after = Math.max(0, before + delta);
            resources[key] = after;
            deltas[key] = after - before;
            changes.push({
                entity: 'actor', entityId: actor.actorId, field: `resources.${key}`,
                from: before, to: after
            });
        }
        if (Object.keys(deltas).length > 0) {
            upsertActorInPlace(state, { ...actor, resources, updatedOnDay: target });
        }
        processOutcomes.push({ processId: process.id, actorId: process.actorId, days: span, deltas });
    }

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
        const dead = markDead(
            npc,
            onDay,
            `Lifespan exhausted at ${rank}. Died of old age.`
        );
        state.npcs[i] = dead;
        appendWorldFact(state, makeFact({
            day: onDay,
            kind: 'death',
            scale: 'personal',
            actors: [{ id: npc.id, name: npc.name, role: 'deceased' }],
            locationId: npc.locationId,
            factionIds: npc.factionId ? [npc.factionId] : [],
            summary: `${npc.name}, ${rank}, reached the end of their lifespan and died of old age.`,
            visibility: npc.cultivation.realmOrdinal >= 13 ? 'regional' : 'faction',
            magnitude: Math.min(1, 0.15 + npc.cultivation.realmOrdinal * 0.025)
        }));
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
        processOutcomes,
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
    if (!wantOpen && !wantClose) return null;
    const locations = new Set(policy.locationIds ?? []);
    let best: WorldInterrupt | null = null;

    for (const opp of state.opportunities) {
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
        const at = state.npcs.findIndex(n => n.id === primary.id);
        if (at >= 0) {
            if (goals.length > 0) {
                const before = state.npcs[at].goals.length;
                state.npcs[at] = inheritGoals(state.npcs[at], goals, deceased.id, onDay);
                inherited = state.npcs[at].goals.slice(before);
            }
            // And the accounts, in BOTH directions.
            for (const account of deceased.relationships) {
                if (account.standing > GRUDGE_STANDING && account.standing < FRIENDSHIP_STANDING) {
                    continue;
                }
                if (account.targetId === primary.id) continue;
                if (state.npcs[at].relationships.some(r => r.targetId === account.targetId)) continue;
                state.npcs[at] = upsertRelationship(state.npcs[at], {
                    targetId: account.targetId,
                    targetName: account.targetName,
                    kind: inheritedKind(account.kind, account.standing),
                    // It thins by a generation, and it does not go away.
                    standing: account.standing * 0.85,
                    note: account.note,
                    factIds: account.factIds,
                    inheritedFromId: deceased.id
                }, onDay);
            }
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

/** Convenience for the common phrasing. */
export function advanceYears(
    state: WorldState,
    years: number,
    opts: AdvanceTimeOptions = {}
): TimeAdvanceResult {
    return advanceTime(state, Math.round(years * DAYS_PER_YEAR), opts);
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
    const effect: ScheduledEffect = {
        id: `e${state.nextEffectSeq}`,
        kind: 'concurrent_event',
        dueOnDay: input.onDay,
        summary: input.summary,
        actorIds: input.actorIds ?? [],
        locationId: input.locationId ?? null,
        factionId: input.factionId ?? null,
        repeatDays: null,
        interrupts: false,
        chance: input.chance ?? 1,
        fired: false,
        firedOnDay: null,
        data: {
            scale: input.scale ?? 'regional',
            magnitude: input.magnitude ?? 0.6
        }
    };
    return {
        state: {
            ...state,
            schedule: state.schedule.concat(effect),
            nextEffectSeq: state.nextEffectSeq + 1
        },
        effectId: effect.id
    };
}

/**
 * How an observer stands in relation to everything in a window.
 */
export function classifyWindow(
    state: WorldState,
    observer: Observer,
    fromDay: number,
    toDay: number
): { fact: HistoricalFact; relation: ReturnType<typeof classifyForObserver> }[] {
    return state.history.facts
        .filter(f => f.day >= fromDay && f.day < toDay)
        .map(f => ({ fact: f, relation: classifyForObserver(f, observer) }));
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function upsertActorInPlace(state: WorldState, actor: ReturnType<typeof getActor>): void {
    if (!actor) return;
    const at = state.actors.findIndex(a => a.actorId === actor.actorId);
    if (at >= 0) state.actors[at] = actor;
    else state.actors.push(actor);
}

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
export { upsertNpc, upsertActor };
export type { LocationRecord, NpcRecord, OpportunityWindow, MissedWindow, HeirRef };
