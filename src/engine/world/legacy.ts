/**
 * The world outlives the run.
 *
 * Permadeath is enforced per cultivator - a life is played once - and until now
 * the world died with them, which is the wrong half to reset. A run is a LIFE
 * LIVED INSIDE a persistent world, not a container for one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE LATE AGE IS MADE OF OTHER PEOPLE'S FAILED RUNS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * That is the whole thesis, and this module is what converts it from a line of
 * setting prose into state. When a cultivator dies:
 *
 *   - their grave goes on the map, at the place they died, holding what they
 *     were carrying, gated by what they were;
 *   - the sect that protected them remembers what the crossing cost, and
 *     remembers them - as a fact and as an entry in an ancestral hall, or not,
 *     depending on what they managed;
 *   - their unfinished goal becomes somebody's active goal, through the
 *     lineage edge and `DeathHandoff` that already exist;
 *   - their grudges are inherited, by whoever inherits;
 *   - the vein they died over has already changed hands, and whoever took it is
 *     still holding it.
 *
 * The next run then starts in that world. The ruins the new character digs
 * through are the previous character's, and the bones in them have a name the
 * world can still produce.
 *
 * ── Nothing resurrects ───────────────────────────────────────────────────
 *
 * The previous cultivator stays dead. `enshrineRun` writes consequences and
 * never revives: there is deliberately no path here that sets `alive`, and the
 * grave it produces is a location with an inventory, not a person.
 *
 * ── Determinism across runs ──────────────────────────────────────────────
 *
 * The WORLD seed persists. A run seed is derived from it and the run's index,
 * so run three of world `abc` is always the same run three - and starting a
 * fresh run does not disturb the world's own streams, because none of them are
 * keyed on the run.
 */

import { deriveSeed, forStream } from '../cultivation/rng.js';
import { rankName } from '../cultivation/realms.js';
import { appendFact, makeFact, type HistoricalFact } from './history.js';
import { makeEnvironment, makeLocation, makeThresholds, type LocationRecord } from './locations.js';
import { heirsOf, type HeirRef } from './lineage.js';
import {
    inheritGoals,
    legacyGoals,
    markDead,
    upsertRelationship,
    type NpcRecord
} from './npc-state.js';
import { storeMemory } from './memory.js';
import { makeObject, transferPossession, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// RUNS INSIDE A WORLD
// ─────────────────────────────────────────────────────────────────────────

export type RunOutcome = 'died' | 'ascended' | 'abandoned' | 'active';

/**
 * A life lived in this world.
 *
 * Stored on the world rather than the other way round. `runs` in the
 * cultivation schema owns the cultivator's own ledger; this is the world's
 * record that the life happened here, and it is what makes the next run's
 * starting position a consequence rather than a reset.
 */
export interface WorldRun {
    id: string;
    /** Derived from the world seed. Never independent of it. */
    seed: string;
    /** Ordinal position among this world's runs. Run one, run two, run three. */
    index: number;
    cultivatorId: string;
    cultivatorName: string;
    startedOnDay: number;
    endedOnDay: number | null;
    outcome: RunOutcome;
    /** Highest realm they reached. What the world remembers them for. */
    peakOrdinal: number;
    /** Grave location id, when they left a body somewhere. */
    graveLocationId: string | null;
    /** How the next run is related to this one, if at all. */
    successorRelation: SuccessorRelation | null;
}

/**
 * How a new cultivator stands to the last one.
 *
 * A descendant inherits the name, the account and the enemies. A disciple
 * inherits the goal and the technique. A stranger inherits the ruins, which is
 * the commonest case and the one the setting is actually about.
 */
export type SuccessorRelation = 'descendant' | 'disciple' | 'stranger';

/**
 * Derive a run's seed from the world's.
 *
 * The world seed persists; run seeds hang off it. So the same world always
 * produces the same third run, and starting a new run cannot perturb anything
 * the world has already decided.
 */
export function runSeedFor(worldSeed: string, index: number): string {
    return deriveSeed(worldSeed, 'run', index);
}

// ─────────────────────────────────────────────────────────────────────────
// ENSHRINING A DEAD RUN
// ─────────────────────────────────────────────────────────────────────────

export interface EnshrineInput {
    /** The dead cultivator's world record. Must already be in `state.npcs`. */
    npcId: string;
    onDay: number;
    /** How it ended, in the engine's words. Never softened. */
    causeNote: string;
    /** What they were carrying when they died. Goes into the grave. */
    carried?: { itemId: string; name: string; kind: string; quantity: number }[];
    /** Spirit stones on the body. */
    spiritStones?: number;
    /**
     * Whether the body is findable. A tribulation failure leaves a scar and no
     * body; most other deaths leave something.
     */
    leavesBody?: boolean;
}

export interface EnshrineResult {
    state: WorldState;
    grave: LocationRecord | null;
    /** Objects placed in the grave, with the dead cultivator in their provenance. */
    goods: ObjectRecord[];
    heirs: HeirRef[];
    /** Goals that are now somebody else's problem. */
    goalsPassed: number;
    /** Facts written. The world's memory of the life. */
    facts: HistoricalFact[];
    /** Ids of NPCs who now remember them. */
    rememberedBy: string[];
}

/**
 * Turn a finished run into the world's inheritance.
 *
 * Mutates the world in place and returns what it produced. Everything here is a
 * state change: the grave is a real location with real contents and real
 * thresholds, the remembrance is a real relationship row, and the inherited
 * goal is on a real heir with its original opening date intact.
 */
export function enshrineRun(state: WorldState, input: EnshrineInput): EnshrineResult {
    const facts: HistoricalFact[] = [];
    const goods: ObjectRecord[] = [];
    const rememberedBy: string[] = [];

    const at = state.npcs.findIndex(n => n.id === input.npcId);
    if (at < 0) {
        return { state, grave: null, goods, heirs: [], goalsPassed: 0, facts, rememberedBy };
    }
    const deceased = state.npcs[at];
    const onDay = input.onDay;

    // Dead, and staying dead.
    state.npcs[at] = markDead(deceased, onDay, input.causeNote);

    // ── The grave ────────────────────────────────────────────────────────
    let grave: LocationRecord | null = null;
    if (input.leavesBody ?? true) {
        const site = deceased.locationId
            ? state.locations.find(l => l.id === deceased.locationId) ?? null
            : null;
        const graveId = `loc-grave-${deceased.id}`;
        if (!state.locations.some(l => l.id === graveId)) {
            grave = makeLocation({
                id: graveId,
                name: `the grave of ${deceased.name}`,
                kind: 'grave',
                parentId: site?.id ?? null,
                description:
                    `${deceased.name}, ${rankName(deceased.cultivation.realmOrdinal)}. ` +
                    input.causeNote,
                ambient: site?.ambient ?? 'thin',
                qiDensity: site?.qiDensity ?? 0.3,
                // A grave is easy to walk up to and not easy to rob: whatever
                // they were is still, faintly, in the way.
                thresholds: makeThresholds(
                    0,
                    0,
                    Math.max(0, deceased.cultivation.realmOrdinal - 4),
                    deceased.cultivation.realmOrdinal
                ),
                hazards: deceased.cultivation.realmOrdinal >= 13 ? ['formation'] : [],
                environment: makeEnvironment({
                    spiritualDensity: site?.environment.spiritualDensity ?? 0.2,
                    danger: 0.3,
                    resources: [],
                    politicalControl: 'nobody',
                    historicalScars: [`${deceased.name} died here.`]
                }),
                discovered: false,
                tags: ['grave', 'previous_run'],
                data: {
                    occupantId: deceased.id,
                    occupantName: deceased.name,
                    peakOrdinal: deceased.cultivation.realmOrdinal,
                    diedOnDay: onDay
                }
            });
            grave.origin.fromDay = onDay;
            state.locations.push(grave);
        }

        // What they were carrying. Provenance names them, so a sect can
        // recognise its own missing property three centuries later.
        for (const item of input.carried ?? []) {
            const object = transferPossession(
                makeObject({
                    id: `obj-grave-${deceased.id}-${item.itemId}`,
                    name: item.name,
                    kind: item.kind as ObjectRecord['kind'],
                    significance: 'significant',
                    locationId: grave?.id ?? null
                }),
                {
                    onDay,
                    toHolderId: null,
                    toHolderName: 'nobody',
                    how: 'lost',
                    source: `the grave of ${deceased.name}`,
                    note: 'Went into the ground with them.'
                }
            );
            state.objects.push(object);
            goods.push(object);
        }
        if (input.spiritStones && input.spiritStones > 0 && grave) {
            grave.data.spiritStones = input.spiritStones;
        }
    }

    // ── The record ───────────────────────────────────────────────────────
    facts.push(appendFact(state.history, makeFact({
        day: onDay,
        kind: 'death',
        scale: deceased.cultivation.realmOrdinal >= 17 ? 'regional' : 'local',
        actors: [{ id: deceased.id, name: deceased.name, role: 'deceased' }],
        locationId: grave?.id ?? deceased.locationId,
        factionIds: deceased.factionId ? [deceased.factionId] : [],
        summary:
            `${deceased.name}, ${rankName(deceased.cultivation.realmOrdinal)}. ${input.causeNote}`,
        visibility: deceased.factionId ? 'faction' : 'regional',
        magnitude: Math.min(0.9, 0.25 + deceased.cultivation.realmOrdinal * 0.03),
        data: {
            unattributed: 'Somebody was buried up the valley and the marker has no name on it yet.',
            peakOrdinal: deceased.cultivation.realmOrdinal
        }
    })));

    // ── The sect remembers what it spent ─────────────────────────────────
    if (deceased.factionId) {
        const faction = state.factions.find(f => f.id === deceased.factionId);
        if (faction) {
            const notable = deceased.cultivation.realmOrdinal >= 13;
            faction.resources.ancestral_names = (faction.resources.ancestral_names ?? 0) + (notable ? 1 : 0);
            facts.push(appendFact(state.history, makeFact({
                day: onDay,
                kind: notable ? 'inheritance' : 'expulsion',
                scale: 'local',
                actors: [{ id: deceased.id, name: deceased.name, role: 'remembered' }],
                factionIds: [faction.id],
                locationId: faction.seatLocationId,
                summary: notable
                    ? `${deceased.name}'s name was entered in the ancestral hall of the ${faction.name}. ` +
                      `What the sect spent keeping them alive is entered beside it.`
                    : `${deceased.name} was struck from the rolls of the ${faction.name}. ` +
                      `They did not get far enough to be written down anywhere else.`,
                visibility: 'faction',
                magnitude: notable ? 0.4 : 0.15,
                data: {
                    unattributed: 'A name was read out at a compound gate and then not read out again.',
                    entered: notable
                }
            })));

            // The people who were there remember them. This is the row a later
            // run runs into when it asks the sect about the name on the grave.
            const survivors = state.npcs
                .filter(n => n.factionId === faction.id && n.status === 'alive' && n.id !== deceased.id)
                .slice(0, 6);
            for (const survivor of survivors) {
                const idx = state.npcs.findIndex(n => n.id === survivor.id);
                if (idx < 0) continue;
                state.npcs[idx] = upsertRelationship(state.npcs[idx], {
                    targetId: deceased.id,
                    targetName: deceased.name,
                    kind: 'acquaintance',
                    standing: notable ? 0.3 : 0.05,
                    note: notable
                        ? 'Was there when it cost the sect something.'
                        : 'Remembers the name, barely.'
                }, onDay);
                storeMemory(state.memories, {
                    ownerId: survivor.id,
                    kind: 'loss',
                    summary: `${deceased.name} died. ${input.causeNote}`,
                    onDay,
                    actorIds: [deceased.id],
                    locationId: grave?.id ?? deceased.locationId,
                    factionIds: [faction.id],
                    salience: notable ? 0.7 : 0.35
                });
                rememberedBy.push(survivor.id);
            }
        }
    }

    // ── The unfinished business ──────────────────────────────────────────
    const lineage = state.lineages.find(l => l.memberIds.includes(deceased.id));
    const alive = (id: string) => {
        const npc = state.npcs.find(n => n.id === id);
        return npc != null && npc.status === 'alive';
    };
    const heirs = lineage ? heirsOf(lineage, deceased.id, alive) : [];
    const goals = legacyGoals(deceased);
    let goalsPassed = 0;

    if (heirs.length > 0 && goals.length > 0) {
        const heirAt = state.npcs.findIndex(n => n.id === heirs[0].id);
        if (heirAt >= 0) {
            const before = state.npcs[heirAt].goals.length;
            state.npcs[heirAt] = inheritGoals(state.npcs[heirAt], goals, deceased.id, onDay);
            goalsPassed = state.npcs[heirAt].goals.length - before;

            // And what they were owed, and owed for.
            for (const grudge of deceased.relationships.filter(r => r.standing <= -0.4)) {
                state.npcs[heirAt] = upsertRelationship(state.npcs[heirAt], {
                    targetId: grudge.targetId,
                    targetName: grudge.targetName,
                    kind: grudge.kind,
                    standing: Math.max(-1, grudge.standing * 0.85),
                    note: grudge.note,
                    factIds: grudge.factIds,
                    inheritedFromId: deceased.id
                }, onDay);
            }

            if (goalsPassed > 0) {
                facts.push(appendFact(state.history, makeFact({
                    day: onDay,
                    kind: 'grudge_inherited',
                    scale: 'personal',
                    actors: [
                        { id: state.npcs[heirAt].id, name: state.npcs[heirAt].name, role: 'heir' },
                        { id: deceased.id, name: deceased.name, role: 'deceased' }
                    ],
                    summary:
                        `${state.npcs[heirAt].name} took up what ${deceased.name} did not finish: ` +
                        `${goalsPassed} thing${goalsPassed === 1 ? '' : 's'}, and the accounts that came with them.`,
                    visibility: 'secret',
                    magnitude: 0.3,
                    data: { unattributed: 'Somebody has started asking the questions somebody else used to ask.' }
                })));
            }
        }
    }

    return { state, grave, goods, heirs, goalsPassed, facts, rememberedBy };
}

// ─────────────────────────────────────────────────────────────────────────
// STARTING THE NEXT RUN
// ─────────────────────────────────────────────────────────────────────────

export interface NextRunInput {
    /** Index of the new run within this world. */
    index: number;
    onDay: number;
    /** The previous run, when there was one. */
    previous?: WorldRun | null;
    /**
     * How the new cultivator is related to the last.
     *
     * Omit and it is drawn from the world seed, weighted toward `stranger` -
     * because most people who dig up a grave are not related to whoever is in
     * it, and the setting is more interesting when the connection has to be
     * discovered rather than assumed.
     */
    relation?: SuccessorRelation;
}

export interface NextRunPlan {
    runId: string;
    seed: string;
    index: number;
    relation: SuccessorRelation;
    /** The NPC the new cultivator descends from or studied under, when any. */
    predecessorId: string | null;
    /** The previous run's grave, if it left one. Findable, not given. */
    graveLocationId: string | null;
    /** What the new cultivator starts already knowing, and why. */
    inheritedGoalTexts: string[];
    note: string;
}

/**
 * Plan the next life in this world.
 *
 * Returns a plan rather than mutating: creating the cultivator belongs to the
 * cultivation layer, and this only decides what the world contributes to it -
 * the seed, the relation, the grave, and whatever the last life left unfinished.
 */
export function planNextRun(
    state: WorldState,
    input: NextRunInput
): NextRunPlan {
    const rng = forStream(state.seed, 'next-run', input.index);
    const previous = input.previous ?? null;

    const relation: SuccessorRelation = input.relation ?? rng.weighted({
        // Most people are nobody's heir. The connection is the exception, and
        // is better when the player finds it rather than being handed it.
        stranger: 70,
        descendant: 18,
        disciple: 12
    });

    let predecessorId: string | null = null;
    const inheritedGoalTexts: string[] = [];

    if (previous && relation !== 'stranger') {
        const dead = state.npcs.find(n => n.id === previous.cultivatorId) ?? null;
        if (dead) {
            predecessorId = dead.id;
            for (const goal of legacyGoals(dead)) inheritedGoalTexts.push(goal.text);
        }
    }

    return {
        runId: `run-${state.id}-${input.index}`,
        seed: runSeedFor(state.seed, input.index),
        index: input.index,
        relation,
        predecessorId,
        graveLocationId: previous?.graveLocationId ?? null,
        inheritedGoalTexts,
        note: noteFor(relation, previous)
    };
}

function noteFor(relation: SuccessorRelation, previous: WorldRun | null): string {
    if (!previous) return 'The first life recorded in this world.';
    switch (relation) {
        case 'descendant':
            return `Descended from ${previous.cultivatorName}, who reached ${rankName(previous.peakOrdinal)} ` +
                `and did not come back. The name carries what the name carries.`;
        case 'disciple':
            return `Studied under what ${previous.cultivatorName} left behind. ` +
                `Never met them; they were already dead.`;
        case 'stranger':
        default:
            return `No connection to ${previous.cultivatorName} at all. ` +
                `The bones in the hill are somebody else's problem until they are not.`;
    }
}

/**
 * Record a run against the world.
 *
 * The join that makes a world outlive its runs: the world holds the list, and
 * each entry is a life that happened inside it.
 */
export function recordRun(state: WorldState, run: WorldRun): WorldState {
    const at = state.runs.findIndex(r => r.id === run.id);
    if (at >= 0) state.runs[at] = run;
    else state.runs.push(run);
    return state;
}

/** Runs recorded against this world, oldest first. */
export function worldRuns(state: WorldState): WorldRun[] {
    return state.runs;
}

/** The most recent finished run, which is what the next one inherits from. */
export function lastFinishedRun(state: WorldState): WorldRun | null {
    const finished = worldRuns(state).filter(r => r.outcome !== 'active');
    return finished.length > 0 ? finished[finished.length - 1] : null;
}

/** Graves left by previous runs. What a new cultivator can dig up. */
export function previousRunGraves(state: WorldState): LocationRecord[] {
    return state.locations.filter(l => l.kind === 'grave' && l.tags.includes('previous_run'));
}

/** A dead run's NPC record. Dead, and it stays that way. */
export function predecessorOf(state: WorldState, run: WorldRun): NpcRecord | null {
    return state.npcs.find(n => n.id === run.cultivatorId) ?? null;
}
