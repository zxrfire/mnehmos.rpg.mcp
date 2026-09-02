/**
 * Consolidated Combat Tool - `combat_manage`
 *
 * Confrontation, as a cultivation world has it.
 *
 * THE FIRST THING THIS TOOL DOES IS REFUSE
 * ----------------------------------------
 * `assess` exists so a narrator can find out, before anything is committed,
 * that what they were about to describe is not a fight. Two major realms apart
 * and the engine returns `no_contest` and a list of the things that would
 * actually work: flee, hide, negotiate, seek protection, exploit terrain, find
 * the specialised counter, manipulate a third party, prepare, or simply not be
 * found. Those are not consolations. They are the encounter.
 *
 * AUTHORITY BOUNDARY
 * ------------------
 * - No action accepts an outcome. Callers supply intent - who, against whom,
 *   with which art, aiming at what, carrying which advantages - and never a
 *   result. There is no `action: 'declare_victory'` and there must never be.
 * - Every draw comes from `forStream(run.seed, ...)`. The same call against the
 *   same state returns the same fight, and a player who died can replay it.
 * - `edges` are claims about the world that the caller must have earned
 *   elsewhere: an ambush is a position, a formation is weeks of work and a
 *   fortune in stones, an artifact is an inventory row. This tool prices them;
 *   it does not grant them.
 * - Nothing here declares anyone dead. The engine reports damage, injuries and
 *   whether the finishing requirement was met; `survival.ts` decides death and
 *   the persistence step asks it.
 *
 * THE TRADITIONS
 * --------------
 * `strike` and `resolve` consult `killRequirement` at the moment a killing blow
 * would land. A soul-directed art against a Cut cultivator is nullified outright
 * - not reduced, nullified - and a body-directed killing of a Drawn cultivator
 * above Nascent Soul destroys a body and does not end a person. Both results are
 * reported plainly, because the winner walking away with the wrong belief is
 * exactly how a feud outlives a funeral.
 */

import { z } from 'zod';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import { PubSub } from '../../engine/pubsub.js';
import {
    ALL_EDGES,
    MAX_EDGE_MULTIPLIER,
    assessEdges,
    assessGap,
    assessPower,
    attemptFlight,
    canDirectAtSoul,
    canUseTechnique,
    evaluateDeathConditions,
    forStream,
    maxHpForOrdinal,
    maxQiForOrdinal,
    rankName,
    resolveConfrontation,
    resolveExchange,
    rollInitiative,
    integrateInsight,
    recordAchievement,
    whatAFightTaught,
    type CombatantInput,
    type Edge,
    type InsightCandidate
} from '../../engine/cultivation/index.js';
import { describeDeath } from '../../engine/cultivation/survival.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { CombatRepository } from '../../storage/repos/combat.repo.js';
import { AgentRepository } from '../../storage/repos/agent.repo.js';
import { getAgentRuntime, buildAgentRuntime } from '../../agent/runtime/deps.js';
import { invokeAgent } from '../../agent/runtime/invoke.js';
import { ProviderFactory } from '../../agent/provider/factory.js';
import {
    currentAmbient,
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    resolveActiveRun,
    round2,
    round4,
    summariseInjury,
    type CultivationRepos,
    type GuidingErrorBody
} from './cultivation-support.js';
import { PLAYER_ROLL_IDENTITY } from '../../web/encounters.js';
import type { Cultivator, Run } from '../../schema/cultivation.js';

const ACTIONS = [
    'assess', 'strike', 'resolve', 'flee', 'history',
    'create', 'get', 'advance', 'end'
] as const;
type CombatAction = typeof ACTIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// PUBSUB
// Mirrors setWorldPubSub: wired once at server startup so a confrontation can
// be streamed to a watching client without this module owning a transport.
// ═══════════════════════════════════════════════════════════════════════════

let pubsub: PubSub | null = null;

export function setCombatPubSub(instance: PubSub): void {
    pubsub = instance;
}

function publish(topic: string, payload: Record<string, unknown>): void {
    try {
        pubsub?.publish(topic, payload);
    } catch {
        // A watching client failing must never break a resolution.
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const EdgeSchema = z.enum(ALL_EDGES as unknown as [Edge, ...Edge[]]);

const OpponentSchema = z.object({
    /** An existing cultivator to fight. Preferred: the engine reads their real state. */
    cultivatorId: z.string().optional(),
    /** Or describe one. Used for NPCs the world has not written down yet. */
    name: z.string().optional(),
    realmOrdinal: z.number().int().min(0).optional(),
    traditionId: z.enum(['tradition-drawn', 'tradition-cut']).optional(),
    might: z.number().int().min(1).max(3).optional(),
    insight: z.number().int().min(1).max(4).optional(),
    hp: z.number().int().min(1).optional(),
    maxHp: z.number().int().min(1).optional(),
    artifactGrade: z.number().min(0).max(5).optional(),
    battlesSurvived: z.number().int().min(0).optional(),
    /** Untreated injuries they are already carrying. The commonest real edge. */
    untreatedInjuries: z.number().int().min(0).max(10).optional()
});

const AssessSchema = z.object({
    action: z.literal('assess'),
    cultivatorId: z.string().optional(),
    opponent: OpponentSchema,
    techniqueId: z.string().optional().describe('The art they would fight with'),
    edges: z.array(EdgeSchema).optional().default([])
        .describe('Advantages actually held. The engine prices them; it does not grant them.')
});

const StrikeSchema = z.object({
    action: z.literal('strike'),
    cultivatorId: z.string().optional(),
    opponent: OpponentSchema,
    techniqueId: z.string().describe('Catalog id of the art being used'),
    vector: z.enum(['body', 'soul']).optional().default('body')
        .describe('Where the strike is aimed. A soul-directed art needs to be able to reach one.'),
    edges: z.array(EdgeSchema).optional().default([]),
    opponentEdges: z.array(EdgeSchema).optional().default([])
});

const ResolveSchema = z.object({
    action: z.literal('resolve'),
    cultivatorId: z.string().optional(),
    opponent: OpponentSchema,
    goal: z.enum(['kill', 'subdue', 'drive_off', 'humiliate', 'coerce']).optional().default('drive_off')
        .describe(
            'What the cultivator is trying to achieve. Decides which endings are reachable. '
            + '`coerce` is force applied to get compliance rather than to end anybody: it wants them '
            + 'complying and still standing, and it reaches `submission` when they yield.'
        ),
    techniqueId: z.string().optional(),
    vector: z.enum(['body', 'soul']).optional().default('body'),
    edges: z.array(EdgeSchema).optional().default([]),
    opponentEdges: z.array(EdgeSchema).optional().default([]),
    /** Whether the loser breaks off rather than be finished. Usually true. */
    fightToTheEnd: z.boolean().optional().default(false),
    // Optional with NO default on purpose. A zod default makes the field
    // REQUIRED on the inferred output type, and every existing caller
    // constructs this object as that type - so a default here is a compile
    // error in somebody else's file for a field they have no opinion about.
    // Absent reads as `open` at the one place that consults it.
    opening: z.enum(['open', 'from_concealment']).optional()
        .describe(
            'How the fight was opened. From concealment the opening exchange carries the ambush '
            + 'edge and the target does not swing back in it. Nothing about what a blow does to a '
            + 'body changes.'
        ),
    /**
     * Whether the beaten party yields, read by the CALLER off who they are.
     *
     * The engine holds no will-to-submit number and must not: whether somebody
     * kneels is a fact about their wants and their standing, or about a beast's
     * own nature, and those live in the layer that holds the records. Omitted
     * reads as the ordinary case, which is that they do.
     */
    submission: z.object({
        yields: z.boolean(),
        because: z.string().min(1)
            .describe('The record the reading was taken off. Stated, never inferred.')
    }).optional()
});

const FleeSchema = z.object({
    action: z.literal('flee'),
    cultivatorId: z.string().optional(),
    opponent: OpponentSchema,
    movementTechniqueId: z.string().optional().describe('A qinggong art, if one is ready'),
    edges: z.array(EdgeSchema).optional().default([])
});

const HistorySchema = z.object({
    action: z.literal('history'),
    cultivatorId: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional().default(25)
});

const CreateSchema = z.object({
    action: z.literal('create'),
    runId: z.string().optional(),
    seed: z.string().optional(),
    location: z.string().optional(),
    participants: z.array(z.object({
        id: z.string(),
        name: z.string(),
        cultivatorId: z.string().optional(),
        realmOrdinal: z.number().int().min(0).optional(),
        initiativeBonus: z.number().optional()
    })).min(1)
});

const GetSchema = z.object({
    action: z.literal('get'),
    encounterId: z.string().optional()
});

const AdvanceSchema = z.object({
    action: z.literal('advance'),
    encounterId: z.string().optional()
});

const EndSchema = z.object({
    action: z.literal('end'),
    encounterId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Who a stream is drawn FOR, said in a way that survives leaving the process.
 *
 * ── THE BUG THIS EXISTS TO CLOSE ─────────────────────────────────────────
 *
 * Every draw in this file comes from `forStream(run.seed, ...)`, and the file
 * header promises that "the same call against the same state returns the same
 * fight, and a player who died can replay it". It did not. The three combat
 * streams mixed in `cultivator.id` and `opponent.id`, and EVERY cultivator row
 * id in this engine is a `randomUUID()` - `game.ts` mints the player's,
 * `cultivation-manage` mints a created one, `admin-manage` mints a staged
 * opponent's. So the id is stable within a process and meaningless across one,
 * and the same seed, the same sentence and the same starting state produced a
 * different fight from one run to the next: measured at 2188 HP against 2325
 * HP on seed `probe-seed`, with the row id as the only differing input.
 *
 * That is the same defect `oneCrowd` in `hearsay.ts` was written to fix, one
 * layer further in. There the crowd's ORDER was unstated and the opponent it
 * handed to `resolve` moved; here the opponent was right and the STREAM moved.
 * `resolveConfrontation` was byte-identical the whole time in both cases.
 *
 * ── WHAT REPLACES THEM ───────────────────────────────────────────────────
 *
 * The acting cultivator is `PLAYER_ROLL_IDENTITY`, on exactly the reasoning
 * `cultivation-manage` already records for the time-skip: these handlers reach
 * their subject through `resolveActiveRun`, which resolves a RUN, and a run has
 * exactly one player. The "two cultivators must not draw alike" case that
 * justifies a per-cultivator component cannot arise.
 *
 * An opponent is named rather than identified, because a name and a rung are
 * the only things about a combatant that a replay of the same seed reproduces.
 * A described opponent already had a stable id built this way; a real row's id
 * never was, and reading its name instead makes both populations behave the
 * same. Collisions are harmless: the turn number is already in every stream and
 * increments on every resolve, so two people cannot draw the same stream in one
 * run however alike they are.
 */
function opponentRollIdentity(opponent: CombatantInput): string {
    const name = opponent.name.trim().toLowerCase().replace(/\s+/g, '-');
    return `${name.length > 0 ? name : 'unnamed'}@${opponent.realmOrdinal}`;
}

/**
 * Build the engine's view of the acting cultivator from real persisted state.
 *
 * Nothing is invented here. Artifact grade is deliberately absent because this
 * engine has no artifact catalog yet, and the honest value for "what are they
 * carrying that helps" is zero rather than a guess.
 */
function combatantFromCultivator(
    cultivator: Cultivator,
    repos: CultivationRepos,
    techniqueId?: string
): CombatantInput {
    const known = techniqueId ? repos.techniques.getKnown(cultivator.id, techniqueId) : null;
    return {
        id: cultivator.id,
        name: cultivator.name,
        realmOrdinal: cultivator.realmOrdinal,
        immortalStatus: cultivator.immortalStatus,
        traditionId: cultivator.traditionId,
        spiritRoot: cultivator.spiritRoot,
        attributes: cultivator.attributes,
        injuries: cultivator.injuries,
        insights: cultivator.insights,
        foundationQuality: cultivator.foundationQuality,
        soulState: cultivator.soulState,
        hp: cultivator.hp,
        maxHp: cultivator.maxHp,
        qi: cultivator.qi,
        maxQi: cultivator.maxQi,
        battlesSurvived: cultivator.battlesSurvived,
        technique: known ?? (techniqueId ? getTechnique(techniqueId) ?? null : null),
        techniqueMastery: known?.mastery ?? 0
    };
}

/**
 * Build the engine's view of an opponent.
 *
 * Prefers a real cultivator row. When the caller describes one instead, every
 * unstated field takes the honest neutral value rather than something flattering
 * to either side: a described opponent is an ordinary person at the stated rank.
 */
function combatantFromOpponent(
    spec: z.infer<typeof OpponentSchema>,
    repos: CultivationRepos
): CombatantInput | GuidingErrorBody {
    if (spec.cultivatorId) {
        const row = repos.cultivators.getById(spec.cultivatorId);
        if (!row) {
            return guidingError('unknown_opponent', `No cultivator with id ${spec.cultivatorId}.`, {
                hint: 'Omit cultivatorId and describe the opponent instead, or cultivation_manage({ action: "list" }).'
            });
        }
        return combatantFromCultivator(row, repos);
    }

    if (spec.realmOrdinal === undefined) {
        return guidingError(
            'opponent_not_specified',
            'An opponent needs either a cultivatorId or a realmOrdinal. Rank is the one thing this engine will not guess.',
            { hint: 'opponent: { name: "...", realmOrdinal: 14 }' }
        );
    }

    const might = spec.might ?? 2;
    const insight = spec.insight ?? 2;
    // The same curve every stored cultivator is built on - `realms.ts`, "what a
    // rung buys in body". A described opponent had its own formula, so the
    // person standing in front of the player was priced differently from the
    // identical person with a row in the table, and the two numbers the
    // narrator reads out came off two different ladders.
    const maxHp = spec.maxHp ?? Math.max(10, maxHpForOrdinal(might, spec.realmOrdinal));
    const maxQi = Math.max(1, maxQiForOrdinal(insight, spec.realmOrdinal));
    const untreated = spec.untreatedInjuries ?? 0;

    return {
        id: `opponent:${(spec.name ?? 'unnamed').toLowerCase().replace(/\s+/g, '-')}`,
        name: spec.name ?? 'the other one',
        realmOrdinal: spec.realmOrdinal,
        traditionId: spec.traditionId,
        spiritRoot: 'muddled_five_element',
        attributes: { might, insight, fortune: 1, charm: 2 },
        injuries: Array.from({ length: untreated }, (_, i) => ({
            id: `described-injury-${i}`,
            severity: 'serious' as const,
            source: 'combat' as const,
            description: 'A wound they were already carrying when this started.',
            sustainedOnTurn: 0,
            treated: false,
            cultivationPenalty: 0.25,
            breakthroughPenalty: 0.12,
            // An opponent described rather than stored: the caller gave a
            // count, so there is no authored wound to name here.
            woundType: null
        })),
        hp: spec.hp ?? maxHp,
        maxHp,
        qi: maxQi,
        maxQi,
        artifactGrade: spec.artifactGrade ?? 0,
        battlesSurvived: spec.battlesSurvived ?? 0,
        technique: null,
        techniqueMastery: 0
    };
}

function projectPower(power: ReturnType<typeof assessPower>): Record<string, unknown> {
    return {
        rank: power.rank,
        realm: power.realmKey,
        ordinal: power.ordinal,
        tradition: power.tradition,
        realmBase: round2(power.realmBase),
        total: round2(power.total),
        factors: power.factors.map(f => ({
            source: f.source,
            factor: round4(f.factor),
            note: f.note
        })),
        killRequirement: power.kill
    };
}

/** Turn an outcome into the honest one-line verdict a narrator renders from. */
function outcomeLine(outcome: string): string {
    switch (outcome) {
        case 'no_contest': return 'Not a fight.';
        case 'withdrawal': return 'Broken off.';
        case 'capture': return 'Taken alive.';
        case 'humiliation': return 'Beaten and let go.';
        case 'crippled': return 'Crippled.';
        case 'body_destroyed': return 'Body destroyed. Not necessarily ended.';
        case 'lethal': return 'Finished.';
        case 'submission': return 'Beaten, alive, and yielding.';
        case 'stalemate': return 'Neither could finish it.';
        default: return outcome;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAssess(args: z.infer<typeof AssessSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const opponent = combatantFromOpponent(args.opponent, repos);
    if (isGuidingErrorBody(opponent)) return opponent;

    const day = Math.floor(run.elapsedDays);
    const ambient = currentAmbient(repos.db, run, cultivator.location, day);
    const self = combatantFromCultivator(cultivator, repos, args.techniqueId);

    const selfPower = assessPower(self, { ambient });
    const opponentPower = assessPower(opponent, { ambient });
    const gap = assessGap(selfPower, opponentPower);
    const edges = assessEdges(args.edges ?? []);

    // What the edges actually buy, stated against the gap they would have to
    // close. This is the number a player needs before they commit, and it is
    // the reason `assess` exists as its own action.
    const needed = opponentPower.total / Math.max(selfPower.total, 1e-9);

    return {
        cultivator: { id: cultivator.id, name: cultivator.name },
        self: projectPower(selfPower),
        opponent: { id: opponent.id, name: opponent.name, ...projectPower(opponentPower) },
        gap: {
            verdict: gap.verdict,
            realmGap: gap.realmGap,
            powerRatio: round2(gap.powerRatio),
            summary: gap.summary,
            options: gap.options
        },
        edges: {
            held: edges.edges,
            multiplier: round2(edges.multiplier),
            capped: edges.capped,
            cap: MAX_EDGE_MULTIPLIER,
            requiredToEven: round2(needed),
            sufficient: edges.multiplier >= needed,
            note: edges.capped
                ? `Everything carried is worth ${round2(edges.multiplier)}x, which is the cap. Stacking more changes nothing: advantages are not a realm.`
                : `Everything carried is worth ${round2(edges.multiplier)}x. Evening this would take ${round2(needed)}x.`
        },
        ambient,
        note:
            gap.verdict === 'helpless'
                ? 'The engine will refuse a direct confrontation here. The listed options are what the world actually permits.'
                : 'Nothing has happened yet. This is a reading, not a resolution.'
    };
}

export async function handleStrike(args: z.infer<typeof StrikeSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const opponent = combatantFromOpponent(args.opponent, repos);
    if (isGuidingErrorBody(opponent)) return opponent;

    const known = repos.techniques.getKnown(cultivator.id, args.techniqueId);
    const technique = known ?? getTechnique(args.techniqueId) ?? null;
    if (!technique) {
        return guidingError('unknown_technique', `No art with id ${args.techniqueId} exists.`, {
            hint: 'technique_manage({ action: "list_available" })'
        });
    }
    if (!known) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${technique.name}.`,
            { hint: 'technique_manage({ action: "learn", techniqueId }) first.' }
        );
    }

    const usable = canUseTechnique(cultivator, technique, known.cooldownRemaining);
    if (!usable.usable) {
        return guidingError('technique_unusable', `${technique.name} cannot be used: ${usable.reason}.`, {
            reason: usable.reason,
            qi: cultivator.qi,
            qiCost: technique.qiCost,
            cooldownRemaining: known.cooldownRemaining
        });
    }

    if (args.vector === 'soul' && !canDirectAtSoul(technique)) {
        return guidingError(
            'art_cannot_reach_a_soul',
            `${technique.name} cannot be aimed at a soul. Elemental qi has to travel through a body to arrive, and soul arts proper do not exist below Nascent Soul.`,
            { element: technique.element, requiredOrdinal: technique.requiredOrdinal }
        );
    }

    const day = Math.floor(run.elapsedDays);
    const ambient = currentAmbient(repos.db, run, cultivator.location, day);
    const self = combatantFromCultivator(cultivator, repos, args.techniqueId);
    const selfPower = assessPower(self, { ambient });
    const opponentPower = assessPower(opponent, { ambient });

    const gap = assessGap(selfPower, opponentPower);
    if (gap.verdict === 'helpless') {
        return {
            struck: false,
            refused: 'helpless',
            gap: { verdict: gap.verdict, realmGap: gap.realmGap, summary: gap.summary, options: gap.options },
            note: 'The strike was not resolved because there is nothing to resolve. Pick one of the options.'
        };
    }

    const nextTurn = run.turn + 1;
    const result = resolveExchange(selfPower, opponentPower, opponent.maxHp, {
        // Not the row ids. See `opponentRollIdentity`: both are `randomUUID()`
        // and keying on them made the same seed produce a different fight.
        rng: forStream(
            run.seed, 'combat_strike', nextTurn,
            PLAYER_ROLL_IDENTITY, opponentRollIdentity(opponent)
        ),
        ambient,
        turn: nextTurn,
        vector: args.vector,
        attackerEdges: args.edges ?? [],
        defenderEdges: args.opponentEdges ?? []
    });

    // Persist what the strike actually cost the striker, and what it did to a
    // real opponent when the opponent is a real row.
    // ── WHY THERE IS NO DEATH GATE IN THIS HANDLER ───────────────────────
    //
    // Checked rather than assumed, because `resolve` was missing half of one.
    // Neither party can die here and neither should:
    //
    //   THE STRIKER   nothing takes their HP. A strike costs qi and a cooldown,
    //                 so there is no bar to empty and no ending to record.
    //   THE STRUCK    a strike is ONE EXCHANGE. `resolve` can end somebody
    //                 because it takes a `goal` and `finishOutcome` says which
    //                 endings that goal reaches; `strike` takes no goal and
    //                 `resolveExchange` has no `finished` to return, so there
    //                 is no engine word here for "that was the end of them".
    //                 Killing somebody with repeated strikes is a real gap and
    //                 the fix is a finishing intent on this action, not a gate
    //                 that reads an empty bar and infers one.
    const persist = repos.db.transaction(() => {
        repos.cultivators.applyDeltas(cultivator.id, { qi: -technique.qiCost });
        repos.techniques.markUsed(cultivator.id, technique.id, nextTurn);
        repos.runs.incrementTurn(run.id, 1);

        if (args.opponent.cultivatorId && !result.nullified) {
            repos.cultivators.applyDeltas(args.opponent.cultivatorId, { hp: -result.damage });
            if (result.injury) {
                repos.cultivators.addInjury(args.opponent.cultivatorId, {
                    id: result.injury.id,
                    severity: result.injury.severity,
                    source: result.injury.source,
                    description: result.injury.description,
                    sustainedOnTurn: result.injury.sustainedOnTurn,
                    woundType: result.injury.woundType,
                    cultivationPenalty: result.injury.cultivationPenalty,
                    breakthroughPenalty: result.injury.breakthroughPenalty
                });
            }
        }
    });
    persist();

    const after = repos.cultivators.getById(cultivator.id)!;
    publish('combat.strike', {
        cultivatorId: cultivator.id,
        opponentId: opponent.id,
        damage: result.damage,
        nullified: result.nullified
    });

    return {
        struck: true,
        technique: { id: technique.id, name: technique.name, qiSpent: technique.qiCost },
        vector: result.vector,
        nullified: result.nullified,
        nullifiedReason: result.nullifiedReason,
        damage: result.damage,
        injury: result.injury ? summariseInjury(result.injury) : null,
        advantage: round2(result.advantage),
        roll: round4(result.roll),
        modifiers: result.modifiers.map(m => ({ source: m.source, factor: round4(m.factor) })),
        opponent: {
            id: opponent.id,
            name: opponent.name,
            rank: rankName(opponent.realmOrdinal),
            tradition: opponentPower.tradition,
            killRequirement: opponentPower.kill
        },
        qiRemaining: after.qi,
        narrationHint: result.narrationHint,
        note: 'One exchange. The engine rolled it from the run seed; narrate the number it returned.'
    };
}

export async function handleResolve(args: z.infer<typeof ResolveSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const opponent = combatantFromOpponent(args.opponent, repos);
    if (isGuidingErrorBody(opponent)) return opponent;

    const technique = args.techniqueId
        ? repos.techniques.getKnown(cultivator.id, args.techniqueId)
        : null;
    if (args.techniqueId && !technique) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${args.techniqueId}.`
        );
    }
    if (args.vector === 'soul' && !canDirectAtSoul(technique)) {
        return guidingError(
            'art_cannot_reach_a_soul',
            'Nothing this cultivator is bringing can be aimed at a soul.',
            { hint: 'A soul-directed art is elementless and needs Nascent Soul or above.' }
        );
    }

    const day = Math.floor(run.elapsedDays);
    const ambient = currentAmbient(repos.db, run, cultivator.location, day);
    const self = combatantFromCultivator(cultivator, repos, args.techniqueId);
    const nextTurn = run.turn + 1;

    const result = resolveConfrontation(self, opponent, {
        // Not the row ids. See `opponentRollIdentity`: both are `randomUUID()`
        // and keying on them made the same seed produce a different fight.
        rng: forStream(
            run.seed, 'combat_resolve', nextTurn,
            PLAYER_ROLL_IDENTITY, opponentRollIdentity(opponent)
        ),
        ambient,
        turn: nextTurn,
        vector: args.vector,
        attackerEdges: args.edges ?? [],
        defenderEdges: args.opponentEdges ?? [],
        intent: {
            goal: args.goal,
            willWithdraw: !(args.fightToTheEnd ?? false),
            opening: args.opening,
            ...(args.submission
                ? {
                    yields: {
                        willYield: args.submission.yields,
                        because: args.submission.because
                    }
                }
                : {})
        }
    });

    // ── WHAT THE FIGHT TAUGHT ────────────────────────────────────────────
    //
    // Design owner: "Fighting should give you comprehension of your art (and
    // your cultivation too, to some extent)."
    //
    // Read AFTER the resolution and applied below, so the lesson is about the
    // fight that actually happened rather than the one that was intended.
    // `what-a-fight-teaches.ts` decides how much and whether at all; nothing
    // here has an opinion about the numbers.
    //
    // ITS OWN STREAM, and that is not a stylistic choice. Adding a draw to
    // `combat_resolve` would shift every later draw on it and change fights
    // that have nothing to do with this - AGENTS.md, a new RNG draw is a
    // regression until proved otherwise. Seeded on the same parts as the fight
    // so a replay of a run produces the same lesson.
    const lesson = whatAFightTaught({
        yourOrdinal: cultivator.realmOrdinal,
        theirOrdinal: opponent.realmOrdinal,
        // Exchanges this cultivator was actually IN. A fight the resolver ran
        // between two other people would teach them nothing, and neither does
        // one the gap ended before anybody moved.
        exchanges: result.exchanges.filter(
            x => x.attackerId === cultivator.id || x.defenderId === cultivator.id
        ).length,
        outcome: result.outcome,
        // The art actually swung. Somebody who fought bare learned nothing
        // about the sword they left at home.
        subject: technique?.subject ?? null,
        element: technique?.element ?? null,
        cultivationProgress: cultivator.cultivationProgress
    });
    const teachingRng = forStream(
        run.seed, 'fight_teaches', nextTurn,
        PLAYER_ROLL_IDENTITY, opponentRollIdentity(opponent)
    );
    const comprehended = lesson.about !== null
        && lesson.comprehensionChance > 0
        && teachingRng.next() < lesson.comprehensionChance;

    // ── Persistence. One transaction: a confrontation that recorded the wounds
    // and not the outcome, or the outcome and not the wounds, is the drift this
    // engine exists to make impossible. ──
    const combat = new CombatRepository(repos.db);
    let death: { cause: string; description: string } | null = null;
    let opponentDeath: { cause: string; description: string } | null = null;
    let learned: { name: string; degree: number; deepened: boolean } | null = null;

    const persist = repos.db.transaction(() => {
        const selfHpDelta = result.hp[cultivator.id] - cultivator.hp;
        if (selfHpDelta !== 0) {
            repos.cultivators.applyDeltas(cultivator.id, { hp: selfHpDelta });
        }
        for (const injury of result.injuries[cultivator.id] ?? []) {
            repos.cultivators.addInjury(cultivator.id, {
                id: injury.id,
                severity: injury.severity,
                source: injury.source,
                description: injury.description,
                sustainedOnTurn: injury.sustainedOnTurn,
                woundType: injury.woundType,
                cultivationPenalty: injury.cultivationPenalty,
                breakthroughPenalty: injury.breakthroughPenalty
            });
        }

        // ── AN OPPONENT WITH NO ROW IS NOT WRITTEN TO AT ALL ─────────────
        //
        // Not a wound, not a point of HP, and now not a death either. Worth
        // knowing because it is the case the PLAYED layer almost always hits:
        // most of the people standing in a square exist only in world state,
        // `game.ts` describes them to this tool rather than passing an id
        // (there is no row to pass), and everything the resolver decided about
        // them evaporates when this block declines to run.
        //
        // Closing that means this tool learning to write to the world, which it
        // does not do today and which is a boundary decision rather than a bug
        // fix. The gate below is the half that can be closed here.
        if (args.opponent.cultivatorId) {
            const opponentRow = repos.cultivators.getById(args.opponent.cultivatorId);
            if (opponentRow) {
                const delta = result.hp[opponent.id] - opponentRow.hp;
                if (delta !== 0) {
                    repos.cultivators.applyDeltas(opponentRow.id, { hp: delta });
                }
                for (const injury of result.injuries[opponent.id] ?? []) {
                    repos.cultivators.addInjury(opponentRow.id, {
                        id: injury.id,
                        severity: injury.severity,
                        source: injury.source,
                        description: injury.description,
                        sustainedOnTurn: injury.sustainedOnTurn,
                        woundType: injury.woundType,
                        cultivationPenalty: injury.cultivationPenalty,
                        breakthroughPenalty: injury.breakthroughPenalty
                    });
                }

                // ── THE OTHER HALF OF THE DEATH GATE ─────────────────────
                //
                // The gate below is asked about the cultivator whose run this
                // is and, until now, about NOBODY ELSE. So an opponent driven
                // to nothing was AT nothing rather than dead: the player could
                // not kill anybody on record, every system that answers a
                // killing was unreachable from the player's side, and the
                // world's rules bound the player and not the world.
                //
                // ── WHY THIS IS NOT "ASK THE GATE ABOUT BOTH PARTIES" ────
                //
                // Because that would make every ordinary fight start killing
                // people. The bar reaches zero in bouts nobody meant to be
                // fatal, and `evaluateDeathConditions` reads an empty bar as
                // `combat_defeat` by default - so widening the gate would turn
                // a spar into a homicide and a mugging into a murder.
                //
                // The answer was already in the resolver and did not need
                // inventing. `finishOutcome` reads the aggressor's `goal`:
                // `subdue` ends at `capture`, `humiliate` at `humiliation`,
                // `drive_off` at `withdrawal`, and ONLY `kill` against a body
                // the tradition says is enough returns `lethal` - which is
                // exactly what `result.finished` means. So a bout that empties
                // somebody's bar without meaning to leaves them beaten, and a
                // killing is a killing because the killer went there.
                //
                // What is NOT decided here: this asks `survival.ts` and obeys
                // it, the same as the player's half, because nothing in this
                // file may declare anybody dead. And `forcingCombat` is
                // deliberately absent - that flag prices the recklessness of
                // walking into a fight half-dead, and it belongs to whoever
                // chose the fight, never to the person who was swung at.
                //
                // `body_destroyed` is left alone on purpose. The body went and
                // the person did not; what becomes of the remnant is the
                // existence layer's ruling and not a death to record here.
                if (result.finished && result.loserId === opponent.id) {
                    const beaten = repos.cultivators.getById(opponentRow.id)!;
                    const theirCause = evaluateDeathConditions(beaten);
                    if (theirCause) {
                        opponentDeath = {
                            cause: theirCause,
                            description: describeDeath(theirCause, beaten)
                        };
                        repos.cultivators.markDead(
                            opponentRow.id, theirCause, nextTurn, opponentDeath.description
                        );
                    }
                }
            }
        }

        // ── WHAT THE FIGHT TAUGHT, WRITTEN DOWN ──────────────────────────
        //
        // In the same transaction as the wounds, for the reason the block above
        // gives: a fight that recorded what it cost and not what it taught is
        // the same drift in the other direction.
        //
        // Zero for most fights, and zero always for a fight against somebody
        // four or more rungs below - `what-a-fight-teaches.ts` reads that off
        // REGARD_BANDS and there is no branch here that could disagree with it.
        if (lesson.progress > 0) {
            repos.cultivators.applyDeltas(cultivator.id, {
                cultivationProgress: lesson.progress
            });
        }
        if (comprehended && lesson.about !== null) {
            const holder = repos.cultivators.getById(cultivator.id)!;
            // The achievement is a record of an EVENT and the insight's id is
            // derived from it, which is what makes a comprehension bought in a
            // fight as traceable as one bought under lightning. `formInsight`
            // is the only constructor and it takes the achievement by value.
            const achievement = recordAchievement({
                kind: 'survived_extraordinary',
                onDay: day,
                turn: nextTurn,
                summary:
                    `Used ${technique?.name ?? 'their art'} against ${opponent.name} `
                    + `(${rankName(opponent.realmOrdinal)}) and was still standing after. `
                    + lesson.why,
                detail: {
                    opponent: opponent.name,
                    band: lesson.band,
                    gap: lesson.gap,
                    outcome: result.outcome
                }
            }, teachingRng);
            const candidate: InsightCandidate = {
                domain: lesson.about.domain,
                subject: lesson.about.subject,
                // `phenomenon`, and it is the honest kind: it happened TO them.
                // That is also why it is always suited - a fight you were in is
                // not a manual that might not fit you.
                access: {
                    kind: 'phenomenon',
                    label: `a real fight with ${opponent.name}`
                },
                opening:
                    `${lesson.about.subject}, used against somebody who could answer `
                    + `(${lesson.band})`
            };
            const integrated = integrateInsight(holder.insights, candidate, achievement);
            repos.cultivators.update(cultivator.id, {
                insights: integrated.insights,
                achievements: [...holder.achievements, achievement]
            });
            learned = {
                name: `${integrated.insight.subject} degree ${integrated.insight.degree}`,
                degree: integrated.insight.degree,
                deepened: integrated.deepened
            };
        }

        // A standing feud is one of the ordinary outputs, so it is written down
        // rather than left to be remembered. Direction matters: the record is
        // held BY the loser ABOUT the winner.
        for (const seed of result.obligations) {
            if (seed.holderId === cultivator.id) {
                const feuds = new Set(repos.cultivators.getById(cultivator.id)?.feuds ?? []);
                feuds.add(seed.subjectId);
                repos.cultivators.update(cultivator.id, { feuds: [...feuds] });
            }
        }

        combat.recordBattle({
            cultivatorId: cultivator.id,
            opponentId: args.opponent.cultivatorId ?? null,
            opponentName: opponent.name,
            opponentOrdinal: opponent.realmOrdinal,
            outcome: result.outcome,
            won: result.winnerId === cultivator.id,
            realmGap: result.gap.realmGap,
            edges: args.edges ?? [],
            onDay: run.elapsedDays,
            turn: nextTurn,
            summary: result.narrationHint
        });

        repos.runs.incrementTurn(run.id, 1);

        // The death gate. Combat produced damage; survival.ts decides whether
        // that was an ending, and nothing else in this file may.
        const after = repos.cultivators.getById(cultivator.id)!;
        const cause = evaluateDeathConditions(after, { forcingCombat: true });
        if (cause) {
            death = { cause, description: describeDeath(cause, after) };
            repos.cultivators.markDead(cultivator.id, cause, nextTurn, death.description);
        }
    });
    persist();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;

    publish('combat.resolved', {
        cultivatorId: cultivator.id,
        opponentId: opponent.id,
        outcome: result.outcome
    });

    return {
        outcome: result.outcome,
        verdict: outcomeLine(result.outcome),
        winnerId: result.winnerId,
        loserId: result.loserId,
        gap: {
            verdict: result.gap.verdict,
            realmGap: result.gap.realmGap,
            powerRatio: round2(result.gap.powerRatio),
            summary: result.gap.summary,
            options: result.gap.options
        },
        self: projectPower(result.aggressor),
        opponent: { id: opponent.id, name: opponent.name, ...projectPower(result.defender) },
        exchanges: result.exchanges.map(x => ({
            index: x.index,
            attackerId: x.attackerId,
            defenderId: x.defenderId,
            damage: x.result.damage,
            nullified: x.result.nullified,
            advantage: round2(x.result.advantage),
            defenderHpAfter: x.defenderHpAfter,
            injury: x.result.injury ? summariseInjury(x.result.injury) : null
        })),
        injuries: {
            self: (result.injuries[cultivator.id] ?? []).map(summariseInjury),
            opponent: (result.injuries[opponent.id] ?? []).map(summariseInjury)
        },
        finished: result.finished,
        killRequirement: result.killRequirement,
        remnant: result.remnant,
        obligations: result.obligations,
        // ── WHAT THE FIGHT TAUGHT ────────────────────────────────────────
        //
        // Reported whether or not anything landed, and the `why` is the whole
        // point of reporting the empty case: a player who fought somebody far
        // below them and learned nothing is owed the sentence saying so, or
        // the mechanic is invisible and reads as not existing.
        taught: {
            band: lesson.band,
            gap: lesson.gap,
            comprehensionChance: round4(lesson.comprehensionChance),
            comprehended: learned !== null,
            insight: learned,
            progress: round2(lesson.progress),
            why: lesson.why
        },
        died: death !== null,
        death,
        // Kept as separate fields rather than folded into `died`, which has
        // always meant THE PLAYER and is read that way by callers. Both are the
        // survival layer's answer; they are only about different people.
        opponentDied: opponentDeath !== null,
        opponentDeath,
        narrationHint: result.narrationHint,
        cultivator: describeCultivator(repos, after, runAfter),
        note:
            'Death is decided by the survival layer, not by this tool. `finished` says the finishing ' +
            'requirement was met; `died` says the engine recorded the player\'s death and ' +
            '`opponentDied` the opponent\'s. An opponent dies only where the goal was `kill` and ' +
            'the tradition allows a body to be enough; a bout that empties somebody\'s bar without ' +
            'meaning to leaves them beaten. An opponent with no cultivator row is not written to ' +
            'at all - see the note on the persistence block.'
    };
}

export async function handleFlee(args: z.infer<typeof FleeSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const opponent = combatantFromOpponent(args.opponent, repos);
    if (isGuidingErrorBody(opponent)) return opponent;

    const day = Math.floor(run.elapsedDays);
    const ambient = currentAmbient(repos.db, run, cultivator.location, day);
    const selfPower = assessPower(combatantFromCultivator(cultivator, repos), { ambient });
    const opponentPower = assessPower(opponent, { ambient });

    const movement = args.movementTechniqueId
        ? repos.techniques.getKnown(cultivator.id, args.movementTechniqueId)
        : null;
    if (args.movementTechniqueId && !movement) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${args.movementTechniqueId}.`
        );
    }

    const nextTurn = run.turn + 1;
    const result = attemptFlight(selfPower, opponentPower, {
        // Not the row ids. See `opponentRollIdentity`: both are `randomUUID()`
        // and keying on them made the same seed produce a different escape.
        rng: forStream(
            run.seed, 'combat_flee', nextTurn,
            PLAYER_ROLL_IDENTITY, opponentRollIdentity(opponent)
        ),
        turn: nextTurn,
        maxHp: cultivator.maxHp,
        movementTechnique: movement,
        movementMastery: movement?.mastery,
        edges: args.edges ?? []
    });

    let death: { cause: string; description: string } | null = null;
    const persist = repos.db.transaction(() => {
        repos.cultivators.applyDeltas(cultivator.id, { hp: -result.damage });
        if (result.injury) {
            repos.cultivators.addInjury(cultivator.id, {
                id: result.injury.id,
                severity: result.injury.severity,
                source: result.injury.source,
                description: result.injury.description,
                sustainedOnTurn: result.injury.sustainedOnTurn,
                woundType: result.injury.woundType,
                cultivationPenalty: result.injury.cultivationPenalty,
                breakthroughPenalty: result.injury.breakthroughPenalty
            });
        }
        if (movement) repos.techniques.markUsed(cultivator.id, movement.id, nextTurn);
        repos.runs.incrementTurn(run.id, 1);

        const after = repos.cultivators.getById(cultivator.id)!;
        const cause = evaluateDeathConditions(after);
        if (cause) {
            death = { cause, description: describeDeath(cause, after) };
            repos.cultivators.markDead(cultivator.id, cause, nextTurn, death.description);
        }
    });
    persist();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;

    return {
        escaped: result.escaped,
        chance: round4(result.chance),
        roll: round4(result.roll),
        modifiers: result.modifiers.map(m => ({ source: m.source, delta: round4(m.delta) })),
        damage: result.damage,
        injury: result.injury ? summariseInjury(result.injury) : null,
        died: death !== null,
        death,
        narrationHint: result.narrationHint,
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

export async function handleHistory(args: z.infer<typeof HistorySchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { cultivator } = resolved;
    const combat = new CombatRepository(repos.db);
    const records = combat.listRecords(cultivator.id, args.limit ?? 25);

    return {
        cultivator: { id: cultivator.id, name: cultivator.name, rank: rankName(cultivator.realmOrdinal) },
        battlesSurvived: cultivator.battlesSurvived,
        battlesWon: cultivator.battlesWon,
        records: records.map(r => ({
            outcome: r.outcome,
            won: r.won,
            opponent: r.opponentName,
            opponentRank: rankName(r.opponentOrdinal),
            realmGap: r.realmGap,
            edges: r.edges,
            onDay: round2(r.onDay),
            turn: r.turn,
            summary: r.summary
        })),
        note:
            'Experience is a form of power in this world and it is counted, not remembered. ' +
            'These rows are what `assess` prices as battle experience.'
    };
}

// ── ENCOUNTER LIFECYCLE ──────────────────────────────────────────────────

export async function handleCreateEncounter(
    args: z.infer<typeof CreateSchema>
): Promise<object> {
    const repos = ensureCultivationDb();
    const combat = new CombatRepository(repos.db);

    // A run is preferred but not required: an encounter can be staged for
    // testing or for NPCs before a player run exists.
    let run: Run | null = null;
    if (args.runId) {
        run = repos.runs.getById(args.runId);
    } else {
        run = repos.runs.getActiveRun();
    }

    const seed = args.seed ?? run?.seed ?? 'encounter';
    const order = rollInitiative(
        args.participants.map(p => ({
            id: p.id,
            name: p.name,
            ordinal: p.realmOrdinal ?? (p.cultivatorId
                ? repos.cultivators.getById(p.cultivatorId)?.realmOrdinal ?? 0
                : 0),
            bonus: p.initiativeBonus
        })),
        forStream(seed, 'combat_initiative', run?.turn ?? 0)
    );

    const encounter = combat.createEncounter({
        runId: run?.id ?? null,
        seed,
        location: args.location ?? null,
        ambient: run ? currentAmbient(repos.db, run, args.location ?? null, Math.floor(run.elapsedDays)) : 'normal',
        participants: order.map(entry => {
            const source = args.participants.find(p => p.id === entry.id)!;
            return {
                participantId: entry.id,
                name: entry.name,
                cultivatorId: source.cultivatorId ?? null,
                ordinal: entry.ordinal,
                initiative: entry.initiative
            };
        })
    });

    const participants = combat.listParticipants(encounter.id);
    const current = combat.currentParticipant(encounter.id);

    publish('combat.created', { encounterId: encounter.id });

    return {
        encounterId: encounter.id,
        round: encounter.round,
        ambient: encounter.ambient,
        turnOrder: participants.map(p => ({
            id: p.participantId,
            name: p.name,
            rank: rankName(p.ordinal),
            initiative: round2(p.initiative)
        })),
        currentTurn: current ? { id: current.participantId, name: current.name } : null,
        note:
            'Initiative is decided by rank first and a seeded sample second. In this world, who moves ' +
            'first is mostly answered by who is further up the ladder.'
    };
}

function resolveEncounterId(combat: CombatRepository, encounterId?: string): string | null {
    if (encounterId) return encounterId;
    return combat.activeEncounter()?.id ?? null;
}

export async function handleGetEncounter(args: z.infer<typeof GetSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const combat = new CombatRepository(repos.db);
    const id = resolveEncounterId(combat, args.encounterId);
    if (!id) {
        return guidingError('no_encounter', 'There is no active encounter.', {
            hint: 'combat_manage({ action: "create", participants: [...] })'
        });
    }

    const encounter = combat.getEncounter(id);
    if (!encounter) {
        return guidingError('unknown_encounter', `No encounter with id ${id}.`);
    }

    const participants = combat.listParticipants(id);
    const current = combat.currentParticipant(id);

    return {
        encounterId: encounter.id,
        status: encounter.status,
        round: encounter.round,
        ambient: encounter.ambient,
        location: encounter.location,
        turnOrder: participants.map(p => ({
            id: p.participantId,
            name: p.name,
            rank: rankName(p.ordinal),
            initiative: round2(p.initiative),
            active: p.active
        })),
        currentTurn: current ? { id: current.participantId, name: current.name } : null
    };
}

export async function handleAdvance(
    args: z.infer<typeof AdvanceSchema>,
    ctx?: SessionContext
): Promise<object> {
    const repos = ensureCultivationDb();
    const combat = new CombatRepository(repos.db);
    const id = resolveEncounterId(combat, args.encounterId);
    if (!id) {
        return guidingError('no_encounter', 'There is no active encounter to advance.');
    }
    if (!combat.getEncounter(id)) {
        return guidingError('unknown_encounter', `No encounter with id ${id}.`);
    }

    const { encounter, current } = combat.advanceTurn(id);

    const data: Record<string, unknown> = {
        encounterId: encounter.id,
        round: encounter.round,
        currentTurn: current ? { id: current.participantId, name: current.name } : null
    };

    // ── The auto-invoke hook. ──
    // An NPC bound to an agent with autoOnTurn speaks for itself when its turn
    // comes up. Failures are surfaced in the payload and never break the turn:
    // the encounter state is authoritative and a provider timing out is not
    // allowed to corrupt it.
    if (current) {
        try {
            const runtime = getAgentRuntime() ?? buildAgentRuntime(repos.db, new ProviderFactory());
            const agentRepo = new AgentRepository(repos.db);
            const agent = agentRepo.findByCharacterId(current.participantId);
            if (agent && agent.autoOnTurn && agent.status === 'active') {
                const result = await invokeAgent(
                    {
                        agentId: agent.id,
                        situation: `It is your turn in encounter ${encounter.id}, round ${encounter.round}.`,
                        encounterId: encounter.id,
                        round: encounter.round,
                        requestId: ctx?.sessionId
                    },
                    runtime
                );
                data.agentResponse = {
                    status: result.status,
                    reason: result.reason,
                    characterName: result.characterName,
                    response: result.response,
                    callId: result.callId,
                    promptTokens: result.promptTokens,
                    completionTokens: result.completionTokens
                };
            }
        } catch (err) {
            data.agentResponse = {
                status: 'error',
                reason: `auto_invoke_threw: ${err instanceof Error ? err.message : String(err)}`
            };
        }
    }

    publish('combat.advanced', { encounterId: encounter.id, round: encounter.round });
    return data;
}

export async function handleEndEncounter(args: z.infer<typeof EndSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const combat = new CombatRepository(repos.db);
    const id = resolveEncounterId(combat, args.encounterId);
    if (!id) {
        return guidingError('no_encounter', 'There is no active encounter to end.');
    }

    const ended = combat.endEncounter(id);
    if (!ended) {
        return guidingError('unknown_encounter', `No encounter with id ${id}.`);
    }

    publish('combat.ended', { encounterId: ended.id });
    return {
        encounterId: ended.id,
        status: ended.status,
        rounds: ended.round,
        note: 'The encounter is closed. Wounds, feuds and the record of it are not.'
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<CombatAction, ActionDefinition> = {
    assess: {
        schema: AssessSchema,
        handler: handleAssess,
        aliases: ['read', 'size_up', 'evaluate', 'compare'],
        description: 'Price both sides and read the gap BEFORE committing to anything'
    },
    strike: {
        schema: StrikeSchema,
        handler: handleStrike,
        aliases: ['attack', 'hit', 'use'],
        description: 'One exchange with a named art'
    },
    resolve: {
        schema: ResolveSchema,
        handler: handleResolve,
        aliases: ['fight', 'confront', 'duel', 'engage'],
        description: 'Resolve a whole confrontation to an outcome'
    },
    flee: {
        schema: FleeSchema,
        handler: handleFlee,
        aliases: ['escape', 'run', 'withdraw', 'disengage'],
        description: 'Break off and try to get away'
    },
    history: {
        schema: HistorySchema,
        handler: handleHistory,
        aliases: ['record', 'battles', 'past'],
        description: 'What this cultivator has survived, and against whom'
    },
    create: {
        schema: CreateSchema,
        handler: handleCreateEncounter,
        aliases: ['start', 'begin', 'open'],
        description: 'Open a multi-party encounter and roll the order of action'
    },
    get: {
        schema: GetSchema,
        handler: handleGetEncounter,
        aliases: ['state', 'status'],
        description: 'Read the encounter: order, round, whose move it is'
    },
    advance: {
        schema: AdvanceSchema,
        handler: handleAdvance,
        aliases: ['next', 'next_turn', 'advance_turn'],
        description: 'Pass the turn to the next actor in the order'
    },
    end: {
        schema: EndSchema,
        handler: handleEndEncounter,
        aliases: ['close', 'finish', 'stop'],
        description: 'Close the encounter'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

export const CombatManageTool = {
    name: 'combat_manage',
    description: `Confrontation in a world where realm gaps are categorical.

- assess    price both sides, read the gap, and find out whether this is a fight at all. Call this
            FIRST. Two major realms apart and the engine will refuse a direct confrontation and hand
            back the options that actually work: flee, hide, negotiate, seek protection, exploit
            terrain, a specialised counter, a third party, preparation, or not being found.
- strike    one exchange with a named art. Spends qi, starts the cooldown, rolls from the run seed.
- resolve   a whole confrontation, to one of eight outcomes. Death is one of them and not the
            usual one: withdrawal, capture, humiliation, a crippling wound and a standing feud are.
- flee      break off. Itemised odds; a movement art is worth more here than anything else.
- history   what this cultivator has survived. Experience is counted, and it is priced.
- create / get / advance / end   multi-party encounters with a rolled order of action.

POWER IS COMPOSITE. Realm is the spine and never the whole: body, soul, comprehension, technique
mastery, artifacts, battle experience, environment and current condition each appear as their own
line, and the lines multiply to the number the fight was decided by.

UPSETS ARE POSSIBLE AND EXCEPTIONAL. \`edges\` prices what a weaker cultivator actually brought -
superior technique, an artifact, preparation, terrain, an ambush, poison, a formation, numbers, or
a wound the other one was already carrying. Their product is capped at ${MAX_EDGE_MULTIPLIER}x, which is enough to
overturn one realm and nowhere near enough for two.

TRADITIONS DIFFER ABOUT DYING. A soul-directed art does nothing at all to a Cut cultivator, at any
rank. Destroying the body of a Drawn cultivator at Nascent Soul or above is an expense, not a
death. The engine reports both plainly; the winner does not necessarily know.

Actions: ${ACTIONS.join(', ')}
Aliases: size_up->assess, attack->strike, fight/duel->resolve, escape->flee`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        opponent: z.record(z.any()).optional().describe('cultivatorId, or a described opponent with realmOrdinal'),
        techniqueId: z.string().optional(),
        movementTechniqueId: z.string().optional(),
        vector: z.enum(['body', 'soul']).optional(),
        goal: z.enum(['kill', 'subdue', 'drive_off', 'humiliate']).optional(),
        edges: z.array(z.string()).optional(),
        opponentEdges: z.array(z.string()).optional(),
        fightToTheEnd: z.boolean().optional(),
        encounterId: z.string().optional(),
        runId: z.string().optional(),
        seed: z.string().optional(),
        location: z.string().optional(),
        participants: z.array(z.any()).optional(),
        limit: z.number().optional()
    })
};

export async function handleCombatManage(
    args: unknown,
    ctx?: SessionContext
): Promise<McpResponse> {
    const response = await router(args as Record<string, unknown>, ctx);
    try {
        const jsonText = response.content[0]?.text;
        if (!jsonText) return response;
        const data = JSON.parse(jsonText);

        let output = '';
        if (data.error === true || typeof data.error === 'string') {
            output = RichFormatter.header('Combat Error', '❌');
            output += RichFormatter.alert(data.message || 'Unknown error', 'error');
            if (data.hint) output += `\n*${data.hint}*\n`;
        } else if (data.gap && data.self && !data.outcome) {
            output = RichFormatter.header('Reading the Gap', '⚖️');
            output += RichFormatter.keyValue({
                'You': `${data.self.rank} (power ${data.self.total})`,
                'Them': `${data.opponent?.rank} (power ${data.opponent?.total})`,
                'Verdict': data.gap.verdict,
                'Realm gap': data.gap.realmGap,
                'Edges': `${data.edges?.multiplier}x of ${data.edges?.requiredToEven}x needed`
            });
            output += `\n${data.gap.summary}\n`;
            if (data.gap.options?.length) {
                output += RichFormatter.section('What actually works');
                output += RichFormatter.list(data.gap.options);
            }
        } else if (data.outcome) {
            output = RichFormatter.header(`Confrontation: ${data.verdict}`, '⚔️');
            output += RichFormatter.keyValue({
                'Outcome': data.outcome,
                'Exchanges': data.exchanges?.length ?? 0,
                'Finished': data.finished ? 'yes' : 'no',
                'Died': data.died ? 'yes' : 'no'
            });
            output += `\n${data.narrationHint}\n`;
        } else if (data.struck) {
            output = RichFormatter.header(`Strike: ${data.technique?.name}`, '⚔️');
            output += RichFormatter.keyValue({
                'Damage': data.nullified ? 'none' : data.damage,
                'Advantage': data.advantage,
                'Vector': data.vector
            });
            output += `\n${data.narrationHint}\n`;
        } else if (typeof data.escaped === 'boolean') {
            output = RichFormatter.header(data.escaped ? 'Broke Away' : 'Did Not Get Clear', '🏃');
            output += RichFormatter.keyValue({ 'Chance': data.chance, 'Roll': data.roll, 'Cost': data.damage });
        } else if (data.turnOrder) {
            output = RichFormatter.header('Encounter', '⚔️');
            output += RichFormatter.table(
                ['Name', 'Rank', 'Initiative'],
                data.turnOrder.map((p: Record<string, unknown>) => [
                    String(p.name), String(p.rank), String(p.initiative)
                ])
            );
        } else {
            output = RichFormatter.header('Combat', '⚔️');
            output += JSON.stringify(data, null, 2) + '\n';
        }

        output += RichFormatter.embedJson(data, 'COMBAT_MANAGE');
        return { content: [{ type: 'text', text: output }] };
    } catch {
        return response;
    }
}
