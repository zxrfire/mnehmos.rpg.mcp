/**
 * Consolidated Run Tool - `run_manage`
 *
 * The unit of permadeath.
 *
 * A run carries the seed every stochastic system in the game derives from, the
 * turn counter, the in-world clock, and - once it ends - the row in the death
 * ledger that says how this one finished.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * There is no `resume`, `revive`, `reload`, `rollback`, `restore` or
 * `set_status` action, and none may ever be added. `RunRepository.endRun` only
 * writes over an ACTIVE run, so even a caller that reached past this tool could
 * not reopen a closed one. Permadeath is not a rule the narrator is asked to
 * respect; it is a state machine with no edge back.
 *
 * `seed_info` exposes the seed and the stream derivation because reproducibility
 * is a feature of this engine: the same seed and the same inputs produce the
 * same run, which is what makes "you cannot reroll" checkable rather than
 * merely asserted.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import {
    DAYS_PER_YEAR,
    canEndRunVoluntarily,
    deriveSeed,
    getSpiritRoot,
    rankName
} from '../../engine/cultivation/index.js';
import {
    adminRunIds,
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isAdminRun,
    isGuidingErrorBody,
    resolveActiveRun,
    round2
} from './cultivation-support.js';

const ACTIONS = ['start', 'current', 'end', 'ledger', 'seed_info'] as const;
type RunAction = typeof ACTIONS[number];

/** Sub-streams a run derives. Listed so `seed_info` documents itself. */
const KNOWN_STREAMS = [
    'spirit_root', 'attributes', 'ambient', 'breakthrough', 'deviation',
    'deviation_resolve', 'encounter', 'opportunity', 'skip_injury',
    'technique_learn', 'technique_practise', 'alchemy', 'pill_toxicity',
    'admin_site', 'admin_encounter'
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// ACTION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const StartSchema = z.object({
    action: z.literal('start'),
    cultivatorId: z.string().describe('The cultivator this run belongs to'),
    seed: z.string().min(1).optional()
        .describe('Reproducibility seed. Omit to mint one. It does not select outcomes; it fixes them.')
});

const CurrentSchema = z.object({
    action: z.literal('current'),
    cultivatorId: z.string().optional(),
    runId: z.string().optional()
});

const EndSchema = z.object({
    action: z.literal('end'),
    runId: z.string().optional(),
    reason: z.string().max(500).optional()
        .describe('Why the run is being closed. Recorded verbatim in the ledger.')
});

const LedgerSchema = z.object({
    action: z.literal('ledger'),
    limit: z.number().int().min(1).max(200).optional().default(20),
    includeAdminRuns: z.boolean().optional().default(false)
        .describe('Admin-flagged runs are excluded by default; they are not balance data.')
});

const SeedInfoSchema = z.object({
    action: z.literal('seed_info'),
    runId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleStart(args: z.infer<typeof StartSchema>): Promise<object> {
    const repos = ensureCultivationDb();

    const cultivator = repos.cultivators.getById(args.cultivatorId);
    if (!cultivator) {
        return guidingError('unknown_cultivator', `No cultivator with id ${args.cultivatorId}.`, {
            hint: 'cultivation_manage({ action: "create_cultivator", name }) creates one and opens its run.'
        });
    }
    if (!cultivator.alive) {
        return guidingError(
            'cultivator_dead',
            `${cultivator.name} is dead (${cultivator.deathCause ?? 'unknown cause'}). A dead cultivator never runs again.`,
            {
                hint: 'Create a new cultivator. There is no continuation of a finished life in this engine.'
            }
        );
    }

    const existingForCultivator = repos.runs.getActiveRun(cultivator.id);
    if (existingForCultivator) {
        return guidingError(
            'run_already_active',
            `${cultivator.name} is already on run ${existingForCultivator.id}.`,
            { runId: existingForCultivator.id }
        );
    }

    const finished = repos.runs.listByCultivator(cultivator.id).filter(r => r.status !== 'active');
    if (finished.length > 0) {
        return guidingError(
            'run_already_finished',
            `${cultivator.name} has already finished a run (${finished[0].status}). Permadeath: a life is played once.`,
            {
                previousRunId: finished[0].id,
                status: finished[0].status,
                deathCause: finished[0].deathCause
            }
        );
    }

    const run = repos.runs.startRun({
        cultivatorId: cultivator.id,
        seed: args.seed ?? randomUUID(),
        peakOrdinal: cultivator.realmOrdinal
    });

    return {
        started: true,
        run: projectRun(run, false),
        cultivator: describeCultivator(repos, repos.cultivators.getById(cultivator.id)!, run)
    };
}

export async function handleCurrent(args: z.infer<typeof CurrentSchema>): Promise<object> {
    const repos = ensureCultivationDb();

    if (args.runId) {
        const run = repos.runs.getById(args.runId);
        if (!run) return guidingError('unknown_run', `No run with id ${args.runId}.`);
        const cultivator = repos.cultivators.getById(run.cultivatorId);
        return {
            run: projectRun(run, isAdminRun(repos.db, run.id)),
            cultivator: cultivator ? describeCultivator(repos, cultivator, run) : null
        };
    }

    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    return {
        run: projectRun(resolved.run, isAdminRun(repos.db, resolved.run.id)),
        cultivator: describeCultivator(repos, resolved.cultivator, resolved.run)
    };
}

export async function handleEnd(args: z.infer<typeof EndSchema>): Promise<object> {
    const repos = ensureCultivationDb();

    const run = args.runId ? repos.runs.getById(args.runId) : repos.runs.getActiveRun();
    if (!run) {
        return guidingError(
            args.runId ? 'unknown_run' : 'no_active_run',
            args.runId ? `No run with id ${args.runId}.` : 'There is no active run to end.'
        );
    }
    if (run.status !== 'active') {
        return guidingError(
            'run_already_ended',
            `Run ${run.id} already ended (${run.status}). A finished run is never reopened or re-closed.`,
            {
                runId: run.id,
                status: run.status,
                deathCause: run.deathCause,
                endedAt: run.endedAt
            }
        );
    }

    const cultivator = repos.cultivators.getById(run.cultivatorId);
    if (!cultivator) {
        return guidingError('unknown_cultivator', `Run ${run.id} has no cultivator record.`);
    }

    // ── The one door out that is not a death. ──
    //
    // A run ends when the cultivator dies. The single exception is a True
    // Immortal, who punched a hole in the sky to earn the choice: they may
    // settle their affairs, step off the ladder, and close the run by
    // ascension. Everyone else - including a Grand Ascension cultivator, and
    // including a False Immortal who survived the last crossing and did not
    // complete it - plays until something kills them.
    //
    // Deliberately NOT generalised into a quit action. There is no honourable
    // retirement at Core Formation, and offering one would make permadeath a
    // setting rather than the shape of the game.
    const eligibility = canEndRunVoluntarily(cultivator);
    if (!eligibility.legal) {
        return guidingError('voluntary_end_not_permitted', eligibility.detail, {
            reason: eligibility.reason,
            runId: run.id,
            cultivatorId: cultivator.id,
            rank: rankName(cultivator.realmOrdinal),
            immortalStatus: cultivator.immortalStatus,
            hint:
                'A run ends by dying. Nothing here abandons, retires or quits one, and reaching the ' +
                'top of the ladder is not enough on its own - only a True Immortal may step off it.'
        });
    }

    const description =
        args.reason ??
        'Settled their affairs and stepped off the ladder. Ended by ascension rather than by death.';

    const ended = repos.db.transaction(() =>
        repos.runs.endRun(run.id, null, description, 'ascended')
    )();

    if (!ended) {
        return guidingError('run_already_ended', `Run ${run.id} could not be closed; it is no longer active.`);
    }

    return {
        ended: true,
        endedBy: 'ascension',
        run: projectRun(ended, isAdminRun(repos.db, ended.id)),
        cultivator: describeCultivator(repos, cultivator, ended),
        note: eligibility.detail,
        permadeath: 'This run is closed permanently. No action in this engine reopens it.'
    };
}

export async function handleLedger(args: z.infer<typeof LedgerSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const includeAdmin = args.includeAdminRuns ?? false;

    // Over-fetch, then filter: admin runs are excluded from the ledger by
    // design, and a limit applied before filtering would silently return short.
    const raw = repos.runs.deathLedger(includeAdmin ? (args.limit ?? 20) : (args.limit ?? 20) * 4);
    const adminIds = adminRunIds(repos.db);
    const filtered = includeAdmin ? raw : raw.filter(r => !adminIds.has(r.id));
    const rows = filtered.slice(0, args.limit ?? 20);

    const causes = new Map<string, number>();
    for (const run of rows) {
        const key = run.deathCause ?? (run.status === 'ascended' ? 'ascended' : 'closed');
        causes.set(key, (causes.get(key) ?? 0) + 1);
    }

    return {
        count: rows.length,
        excludedAdminRuns: includeAdmin ? 0 : raw.length - filtered.length,
        entries: rows.map(run => {
            const cultivator = repos.cultivators.getById(run.cultivatorId);
            return {
                runId: run.id,
                name: cultivator?.name ?? '(cultivator record gone)',
                spiritRoot: cultivator ? getSpiritRoot(cultivator.spiritRoot).name : null,
                status: run.status,
                deathCause: run.deathCause,
                deathDescription: run.deathDescription,
                peakOrdinal: run.peakOrdinal,
                peakRank: rankName(run.peakOrdinal),
                turns: run.turn,
                elapsedDays: round2(run.elapsedDays),
                elapsedYears: round2(run.elapsedDays / DAYS_PER_YEAR),
                ageAtDeath: cultivator ? round2(cultivator.age) : null,
                startedAt: run.startedAt,
                endedAt: run.endedAt
            };
        }),
        causeBreakdown: Object.fromEntries(causes),
        note: 'Finished runs only. Admin-flagged runs are excluded unless asked for: they lifted content gates and are not balance data.'
    };
}

export async function handleSeedInfo(args: z.infer<typeof SeedInfoSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const run = args.runId ? repos.runs.getById(args.runId) : repos.runs.getActiveRun();
    if (!run) {
        return guidingError(
            args.runId ? 'unknown_run' : 'no_active_run',
            args.runId ? `No run with id ${args.runId}.` : 'There is no active run.'
        );
    }

    const day = Math.floor(run.elapsedDays);
    return {
        runId: run.id,
        seed: run.seed,
        status: run.status,
        turn: run.turn,
        elapsedDays: round2(run.elapsedDays),
        adminFlagged: isAdminRun(repos.db, run.id),
        streams: KNOWN_STREAMS.map(name => ({
            stream: name,
            exampleAtToday: deriveSeed(run.seed, name, day)
        })),
        note:
            'Every stochastic system draws from a NAMED SUB-STREAM keyed to an absolute day or ordinal, ' +
            'never from one sequential generator. Adding a system therefore cannot perturb an existing ' +
            'replay, and a roll for day 900 is the same number whether the simulation reached it in one ' +
            'jump or three hundred.'
    };
}

function projectRun(
    run: {
        id: string; cultivatorId: string; seed: string; status: string; turn: number;
        elapsedDays: number; startedAt: string; endedAt: string | null;
        deathCause: string | null; deathDescription: string | null; peakOrdinal: number;
    },
    adminFlagged: boolean
): Record<string, unknown> {
    return {
        id: run.id,
        cultivatorId: run.cultivatorId,
        seed: run.seed,
        status: run.status,
        turn: run.turn,
        elapsedDays: round2(run.elapsedDays),
        elapsedYears: round2(run.elapsedDays / DAYS_PER_YEAR),
        peakOrdinal: run.peakOrdinal,
        peakRank: rankName(run.peakOrdinal),
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        deathCause: run.deathCause,
        deathDescription: run.deathDescription,
        adminFlagged,
        reopenable: false
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<RunAction, ActionDefinition> = {
    start: {
        schema: StartSchema,
        handler: handleStart,
        aliases: ['begin', 'open', 'new'],
        description: 'Open a run for an existing cultivator'
    },
    current: {
        schema: CurrentSchema,
        handler: handleCurrent,
        aliases: ['get', 'active', 'status'],
        description: 'The live run and its cultivator'
    },
    end: {
        schema: EndSchema,
        handler: handleEnd,
        aliases: ['close', 'finish', 'ascend', 'step_off'],
        description: 'A True Immortal closes the run by ascension; refused for anyone else'
    },
    ledger: {
        schema: LedgerSchema,
        handler: handleLedger,
        aliases: ['deaths', 'death_ledger', 'history'],
        description: 'How previous cultivators died'
    },
    seed_info: {
        schema: SeedInfoSchema,
        handler: handleSeedInfo,
        aliases: ['seed', 'streams', 'reproducibility'],
        description: 'The run seed and the sub-streams derived from it'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

export const RunManageTool = {
    name: 'run_manage',
    description: `The permadeath run: seed, clock, and the death ledger.

A run is one life. When it ends it is over - there is no resume, revive, reload, rollback or
restore action in this tool, and none will be added. Do not tell the player otherwise.

A run ends when the cultivator DIES. The single exception is a True Immortal, who may step off
the ladder deliberately - and who had to punch a hole in the sky to earn the choice. There is no
quit at Qi Condensation and no honourable retirement at Core Formation.

- start     open a run for an existing cultivator (creating a cultivator normally does this for you)
- current   the live run plus full cultivator state
- end       a True Immortal steps off the ladder and closes the run by ascension. This is the
            ONLY way a run ends other than dying, it is refused for everybody else, and there is
            no abandon, retire or quit anywhere in this tool.
- ledger    how previous cultivators died; admin-flagged runs excluded by default
- seed_info the seed and the named sub-streams every roll derives from

Actions: ${ACTIONS.join(', ')}
Aliases: begin/open->start, get/active->current, close/finish->end, deaths->ledger, seed->seed_info`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        runId: z.string().optional(),
        cultivatorId: z.string().optional(),
        seed: z.string().optional(),
        reason: z.string().optional(),
        limit: z.number().int().optional(),
        includeAdminRuns: z.boolean().optional()
    })
};

export async function handleRunManage(
    args: unknown,
    _ctx?: SessionContext
): Promise<McpResponse> {
    const response = await router(args as Record<string, unknown>);
    try {
        const jsonText = response.content[0]?.text;
        if (!jsonText) return response;
        const data = JSON.parse(jsonText);

        let output = '';
        if (data.error === true || typeof data.error === 'string') {
            output = RichFormatter.header('Run Error', '❌');
            output += RichFormatter.alert(data.message || 'Unknown error', 'error');
            if (data.hint) output += `\n*${data.hint}*\n`;
        } else if (data.entries) {
            output = RichFormatter.header(`Death Ledger (${data.count})`, '⚰️');
            output += RichFormatter.table(
                ['Name', 'Root', 'Peak', 'Cause', 'Years'],
                data.entries.map((e: {
                    name: string; spiritRoot: string | null; peakRank: string;
                    deathCause: string | null; status: string; elapsedYears: number;
                }) => [
                    e.name, e.spiritRoot ?? '-', e.peakRank, e.deathCause ?? e.status,
                    String(e.elapsedYears)
                ])
            );
            output += RichFormatter.section('Causes');
            output += RichFormatter.keyValue(data.causeBreakdown ?? {});
        } else if (data.run) {
            output = RichFormatter.header(
                data.ended ? 'Run Closed' : data.started ? 'Run Opened' : 'Run',
                data.ended ? '⚰️' : '🎲'
            );
            output += RichFormatter.keyValue({
                'ID': data.run.id,
                'Status': data.run.status,
                'Turn': data.run.turn,
                'Elapsed': `${data.run.elapsedDays} days (${data.run.elapsedYears} years)`,
                'Peak': data.run.peakRank,
                'Admin flagged': data.run.adminFlagged,
                'Reopenable': data.run.reopenable
            });
        } else if (data.streams) {
            output = RichFormatter.header('Run Seed', '🌱');
            output += RichFormatter.keyValue({
                'Run': data.runId,
                'Seed': data.seed,
                'Turn': data.turn,
                'Admin flagged': data.adminFlagged
            });
        } else {
            output = RichFormatter.header('Run', '🎲');
            output += JSON.stringify(data, null, 2) + '\n';
        }

        output += RichFormatter.embedJson(data, 'RUN_MANAGE');
        return { content: [{ type: 'text', text: output }] };
    } catch {
        return response;
    }
}
