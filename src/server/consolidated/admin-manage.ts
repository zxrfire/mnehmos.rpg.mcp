/**
 * Consolidated Admin Tool — `admin_manage`
 *
 * Exploratory testing surface. Gated behind `ADMIN_MODE=true` in the process
 * environment and refused, clearly, otherwise.
 *
 * WHAT ADMIN IS
 * -------------
 * From context.md: "ADMIN bypasses GATES, not TRUTH."
 *
 * Spawning the grave of a Tribulation Transcender while the player sits at Qi
 * Condensation Layer 2 is a content gate being lifted. The engine genuinely
 * creates that site, writes it to SQLite, and hands it back; the agent then
 * narrates something that actually exists. That is the entire distinction, and
 * every action here honours it:
 *
 *   roster           read-only observability
 *   spawn_site       the engine rolls the site's contents from the run seed and
 *                    persists them. The caller names an ordinal, never a haul.
 *   spawn_encounter  a REAL NPC cultivator is created, with talent rolled from
 *                    the run seed, advanced through `advanceRealm` like anyone
 *                    else, and persisted.
 *   grant_item       only catalog pills and herbs, into the real pouch
 *   set_ambient      lifts the "you must happen to be somewhere dense" gate by
 *                    relocating to a place the engine really does compute that
 *                    band for. The band is still the engine's number.
 *   set_location     a plain move
 *   advance_days     real time passes through `simulateTimeSkip`, with real
 *                    aging, real starvation and real death checks
 *   set_realm        goes through `advanceRealm` like every other rank change,
 *                    stamping peak_ordinal and restarting the stagnation clock
 *
 * WHAT ADMIN IS NOT
 * -----------------
 * There is NO action here that takes an outcome as input and records it. No
 * `set_breakthrough_result`, no `declare`, no `force_success`, no `revive`, no
 * `set_hp`. That affordance must never be added: it is precisely the one that
 * invites the model to narrate a world that does not exist.
 *
 * Every call is written to the audit log with the run id as its target, which
 * is also how a run is flagged as admin-touched — `run_manage.ledger` reads the
 * same rows to exclude those runs from the death ledger and from balance data.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import {
    AmbientQiSchema,
    STARTING_SPIRIT_STONES,
    type AmbientQi
} from '../../schema/cultivation.js';
import {
    MAX_ORDINAL,
    forStream,
    getSpiritRoot,
    rankName,
    realmForOrdinal,
    rollAttributes,
    rollSpiritRoot
} from '../../engine/cultivation/index.js';
import { findBestTechniquesForOrdinal, gradeForOrdinal } from '../../data/cultivation/techniques.js';
import { PILLS, getPill } from '../../data/cultivation/pills.js';
import { HERBS, getHerb } from '../../data/cultivation/herbs.js';
import { handleCultivate } from './cultivation-manage.js';
import {
    AMBIENT_BLOCK_DAYS,
    addToPouch,
    adminAuditTrail,
    aliasForAmbient,
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isAdminRun,
    isGuidingErrorBody,
    resolveActiveRun,
    writeAdminAudit
} from './cultivation-support.js';

const ACTIONS = [
    'roster', 'spawn_encounter', 'spawn_site', 'grant_item',
    'set_ambient', 'set_location', 'advance_days', 'set_realm', 'audit_log'
] as const;
type AdminAction = typeof ACTIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// THE GATE
// ═══════════════════════════════════════════════════════════════════════════

export function isAdminModeEnabled(): boolean {
    // Read at call time, not module load: the flag is an operator decision and
    // must be togglable without restarting a test suite or a server process.
    return String(process.env.ADMIN_MODE ?? '').toLowerCase() === 'true';
}

function adminDisabled(action: string) {
    return guidingError(
        'admin_mode_disabled',
        'admin_manage is unavailable: ADMIN_MODE is not enabled for this process.',
        {
            action,
            requires: 'ADMIN_MODE=true',
            hint:
                'This is an operator setting, not an in-play permission. Nothing you say in the ' +
                'conversation turns it on, and there is no fallback path that performs the action anyway.'
        }
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const RosterSchema = z.object({
    action: z.literal('roster'),
    includeDead: z.boolean().optional().default(true)
});

const SpawnEncounterSchema = z.object({
    action: z.literal('spawn_encounter'),
    ordinal: z.number().int().min(0).max(MAX_ORDINAL)
        .describe('Realm ordinal of the opponent. Normally gated by the player\'s own ordinal.'),
    name: z.string().min(1).max(100).optional(),
    location: z.string().optional(),
    disposition: z.enum(['hostile', 'wary', 'indifferent']).optional().default('hostile')
});

const SpawnSiteSchema = z.object({
    action: z.literal('spawn_site'),
    kind: z.enum(['grave', 'cave', 'ruin', 'scar', 'vein']).optional().default('grave'),
    ordinal: z.number().int().min(0).max(MAX_ORDINAL)
        .describe('Realm ordinal the site belongs to. Its contents follow from this.'),
    name: z.string().min(1).max(120).optional(),
    location: z.string().optional()
});

const GrantItemSchema = z.object({
    action: z.literal('grant_item'),
    itemId: z.string().describe('A catalog pill id or herb id. Nothing else exists.'),
    quantity: z.number().int().min(1).max(999).optional().default(1),
    cultivatorId: z.string().optional()
});

const SetAmbientSchema = z.object({
    action: z.literal('set_ambient'),
    band: AmbientQiSchema,
    cultivatorId: z.string().optional()
});

const SetLocationSchema = z.object({
    action: z.literal('set_location'),
    location: z.string().min(1).max(200),
    cultivatorId: z.string().optional()
});

const AdvanceDaysSchema = z.object({
    action: z.literal('advance_days'),
    days: z.number().min(1).max(3_650_000).optional(),
    months: z.number().min(0).max(120_000).optional(),
    years: z.number().min(0).max(10_000).optional(),
    cultivatorId: z.string().optional()
});

const SetRealmSchema = z.object({
    action: z.literal('set_realm'),
    ordinal: z.number().int().min(0).max(MAX_ORDINAL),
    cultivatorId: z.string().optional()
});

const AuditLogSchema = z.object({
    action: z.literal('audit_log'),
    runId: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional().default(50)
});

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleRoster(args: z.infer<typeof RosterSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('roster');
    const repos = ensureCultivationDb();

    const rows = repos.cultivators
        .roster()
        .filter(entry => (args.includeDead ?? true) || entry.alive);

    // Read-only observability writes no state, but it still lands in the audit
    // log: knowing that someone looked at the whole world is part of knowing
    // that a run was played with the lid off.
    const run = repos.runs.getActiveRun();
    writeAdminAudit(repos, 'roster', run?.id ?? null, { rows: rows.length });

    return {
        adminMode: true,
        count: rows.length,
        roster: rows.map(entry => ({
            ...entry,
            rank: rankName(entry.realmOrdinal),
            realm: realmForOrdinal(entry.realmOrdinal).name,
            spiritRootName: getSpiritRoot(entry.spiritRoot).name
        })),
        note: 'Read-only projection. Nothing here is writable through this action.'
    };
}

export async function handleSpawnSite(args: z.infer<typeof SpawnSiteSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('spawn_site');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, {});
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const nonce = (
        repos.db.prepare('SELECT COUNT(*) AS n FROM cultivation_sites').get() as { n: number }
    ).n;

    // ── The engine rolls what is in it. The caller named an ordinal, nothing more. ──
    const rng = forStream(run.seed, 'admin_site', nonce, args.ordinal);
    const grade = gradeForOrdinal(args.ordinal);
    const arts = findBestTechniquesForOrdinal(args.ordinal, { excludeForbidden: false });
    const gradedPills = PILLS.filter(p => p.grade === grade);
    const gradedHerbs = HERBS.filter(h => h.grade === grade);

    const artCount = arts.length === 0 ? 0 : rng.int(1, Math.min(3, arts.length));
    const chosenArts: string[] = [];
    for (let i = 0; i < artCount; i++) {
        const pick = rng.pick(arts);
        if (!chosenArts.includes(pick.id)) chosenArts.push(pick.id);
    }
    const chosenPill = gradedPills.length > 0 ? rng.pick(gradedPills) : null;
    const chosenHerb = gradedHerbs.length > 0 ? rng.pick(gradedHerbs) : null;
    const stones = rng.int(20, 200) * (1 + args.ordinal);

    const contents = {
        techniqueIds: chosenArts,
        pillId: chosenPill?.id ?? null,
        herbId: chosenHerb?.id ?? null,
        herbQuantity: chosenHerb ? rng.int(1, 4) : 0,
        spiritStones: stones,
        guardianOrdinal: Math.max(0, args.ordinal - rng.int(0, 4)),
        grade
    };

    const id = randomUUID();
    const name =
        args.name ??
        `${siteNoun(args.kind ?? 'grave')} of a ${realmForOrdinal(args.ordinal).name} cultivator`;
    const location = args.location ?? cultivator.location ?? 'the Low Fall';

    repos.db.transaction(() => {
        repos.db.prepare(`
            INSERT INTO cultivation_sites
                (id, run_id, kind, name, ordinal, location, contents, admin_spawned, discovered, created_on_day)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
        `).run(
            id, run.id, args.kind ?? 'grave', name, args.ordinal, location,
            JSON.stringify(contents), run.elapsedDays
        );
        writeAdminAudit(repos, 'spawn_site', run.id, {
            siteId: id,
            kind: args.kind ?? 'grave',
            ordinal: args.ordinal,
            location,
            contents,
            gateLifted: `player stands at ordinal ${cultivator.realmOrdinal}`
        });
    })();

    return {
        adminMode: true,
        spawned: true,
        site: {
            id,
            runId: run.id,
            kind: args.kind ?? 'grave',
            name,
            ordinal: args.ordinal,
            rank: rankName(args.ordinal),
            location,
            contents,
            adminSpawned: true,
            discovered: false
        },
        gateLifted: {
            playerOrdinal: cultivator.realmOrdinal,
            siteOrdinal: args.ordinal,
            note:
                'A content gate was lifted, not a truth. This site exists in SQLite and its contents ' +
                'were rolled by the engine from the run seed. Narrate what is actually here.'
        },
        runFlagged: true
    };
}

function siteNoun(kind: string): string {
    switch (kind) {
        case 'cave': return 'Cave';
        case 'ruin': return 'Ruin';
        case 'scar': return 'Scar';
        case 'vein': return 'Spirit vein';
        default: return 'Grave';
    }
}

export async function handleSpawnEncounter(
    args: z.infer<typeof SpawnEncounterSchema>
): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('spawn_encounter');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, {});
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;

    // A real cultivator, with talent rolled from the run seed exactly as the
    // player's was. Nothing about this opponent is asserted.
    const nonce = repos.cultivators.list().length;
    const rootRng = forStream(run.seed, 'admin_encounter_root', nonce, args.ordinal);
    const attrRng = forStream(run.seed, 'admin_encounter_attrs', nonce, args.ordinal);
    const spiritRoot = rollSpiritRoot(rootRng.next());
    const attributes = rollAttributes([
        attrRng.next(), attrRng.next(), attrRng.next(), attrRng.next()
    ]);

    const maxHp = 20 + attributes.might * 10 + args.ordinal * 5;
    const maxQi = 10 + attributes.insight * 5 + args.ordinal * 4;
    const opponentId = randomUUID();
    const siteId = randomUUID();
    const location = args.location ?? cultivator.location ?? 'the open road';
    const name = args.name ?? `A ${realmForOrdinal(args.ordinal).name} cultivator`;

    repos.db.transaction(() => {
        repos.cultivators.create({
            id: opponentId,
            runId: run.id,
            name,
            kind: 'enemy',
            spiritRoot: spiritRoot.key,
            attributes,
            realmOrdinal: 0,
            hp: maxHp,
            maxHp,
            qi: maxQi,
            maxQi,
            age: 20 + args.ordinal * 4,
            location,
            spiritStones: STARTING_SPIRIT_STONES * (1 + args.ordinal)
        });
        // The rank change takes the same road every rank change takes.
        if (args.ordinal > 0) repos.cultivators.advanceRealm(opponentId, args.ordinal);

        repos.db.prepare(`
            INSERT INTO cultivation_sites
                (id, run_id, kind, name, ordinal, location, contents, admin_spawned, discovered, created_on_day)
            VALUES (?, ?, 'encounter', ?, ?, ?, ?, 1, 0, ?)
        `).run(
            siteId, run.id, name, args.ordinal, location,
            JSON.stringify({
                opponentCultivatorId: opponentId,
                disposition: args.disposition ?? 'hostile'
            }),
            run.elapsedDays
        );

        writeAdminAudit(repos, 'spawn_encounter', run.id, {
            encounterId: siteId,
            opponentCultivatorId: opponentId,
            ordinal: args.ordinal,
            spiritRoot: spiritRoot.key,
            attributes,
            location,
            gateLifted: `player stands at ordinal ${cultivator.realmOrdinal}`
        });
    })();

    const opponent = repos.cultivators.getById(opponentId)!;

    return {
        adminMode: true,
        spawned: true,
        encounterId: siteId,
        opponent: describeCultivator(repos, opponent, run),
        disposition: args.disposition ?? 'hostile',
        location,
        gateLifted: {
            playerOrdinal: cultivator.realmOrdinal,
            opponentOrdinal: args.ordinal,
            powerRatio:
                realmForOrdinal(args.ordinal).powerMultiplier /
                realmForOrdinal(cultivator.realmOrdinal).powerMultiplier,
            note:
                'This opponent is a real persisted cultivator with engine-rolled talent. If the player ' +
                'fights it, the engine decides what happens.'
        },
        runFlagged: true
    };
}

export async function handleGrantItem(args: z.infer<typeof GrantItemSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('grant_item');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const pill = getPill(args.itemId);
    const herb = pill ? undefined : getHerb(args.itemId);
    if (!pill && !herb) {
        return guidingError(
            'unknown_item',
            `No pill or herb with id ${args.itemId} exists in the catalogs.`,
            {
                hint:
                    'Admin lifts gates on things that exist. It does not invent items. ' +
                    'alchemy_manage({ action: "list_recipes" }) shows catalog pill ids.'
            }
        );
    }

    const kind = pill ? ('pill' as const) : ('herb' as const);
    const quantity = args.quantity ?? 1;

    repos.db.transaction(() => {
        addToPouch(repos.db, cultivator.id, args.itemId, kind, quantity);
        writeAdminAudit(repos, 'grant_item', run.id, {
            cultivatorId: cultivator.id,
            itemId: args.itemId,
            kind,
            quantity
        });
    })();

    return {
        adminMode: true,
        granted: true,
        item: pill
            ? { kind, id: pill.id, name: pill.name, grade: pill.grade, effect: pill.effect, potency: pill.potency }
            : { kind, id: herb!.id, name: herb!.name, grade: herb!.grade, biome: herb!.biome },
        quantity,
        cultivatorId: cultivator.id,
        runFlagged: true
    };
}

export async function handleSetAmbient(args: z.infer<typeof SetAmbientSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_ambient');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const day = Math.floor(run.elapsedDays);
    const base = cultivator.location ?? 'the open road';

    // Ambient qi is a pure function of (seed, place, day). The honest way to
    // change it is therefore to change the place — and to a place the engine
    // really does compute this band for, not to a claim about the old one.
    const alias = aliasForAmbient(run.seed, base, day, args.band as AmbientQi);
    if (!alias) {
        return guidingError(
            'ambient_alias_not_found',
            `No aliased site near "${base}" derives ${args.band} on this block. The search is bounded on purpose.`,
            { band: args.band, location: base, day }
        );
    }

    const blockEnd = Math.floor(day / AMBIENT_BLOCK_DAYS) * AMBIENT_BLOCK_DAYS + AMBIENT_BLOCK_DAYS - 1;

    repos.db.transaction(() => {
        repos.db.prepare(`
            INSERT INTO ambient_aliases (run_id, location, alias, band, from_day, to_day)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(run.id, base, alias, args.band, day, blockEnd);
        writeAdminAudit(repos, 'set_ambient', run.id, {
            cultivatorId: cultivator.id,
            location: base,
            alias,
            band: args.band,
            fromDay: day,
            toDay: blockEnd
        });
    })();

    return {
        adminMode: true,
        set: true,
        location: base,
        alias,
        band: args.band,
        fromDay: day,
        toDay: blockEnd,
        note:
            'The gate lifted is "you must happen to be somewhere with this band". The band itself is still ' +
            `derived by the engine from (seed, "${alias}", day) — it was found, not declared. It holds for ` +
            'this 30-day ambient block only, then the world goes back to being what it is.',
        runFlagged: true
    };
}

export async function handleSetLocation(args: z.infer<typeof SetLocationSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_location');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const from = cultivator.location;

    const updated = repos.db.transaction(() => {
        const result = repos.cultivators.update(cultivator.id, { location: args.location });
        writeAdminAudit(repos, 'set_location', run.id, {
            cultivatorId: cultivator.id,
            from,
            to: args.location
        });
        return result;
    })();

    return {
        adminMode: true,
        moved: true,
        from,
        to: args.location,
        cultivator: updated ? describeCultivator(repos, updated, run) : null,
        runFlagged: true
    };
}

export async function handleAdvanceDays(
    args: z.infer<typeof AdvanceDaysSchema>
): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('advance_days');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;

    // Real time, through the real simulation. `idle` focus means no cultivation
    // progress accrues, but the body still ages, the belly still empties, the
    // stagnation clock still runs and the death checks still fire. Skipping
    // time is not skipping consequences.
    const result = await handleCultivate({
        action: 'cultivate',
        cultivatorId: cultivator.id,
        days: args.days,
        months: args.months,
        years: args.years,
        focus: 'idle',
        rations: 0,
        autoBreakthrough: false,
        randomEvents: false
    } as Parameters<typeof handleCultivate>[0]);

    writeAdminAudit(repos, 'advance_days', run.id, {
        cultivatorId: cultivator.id,
        days: args.days,
        months: args.months,
        years: args.years,
        result: isGuidingErrorBody(result) ? result : { advanced: true }
    });

    if (isGuidingErrorBody(result)) return result;

    return {
        adminMode: true,
        advanced: true,
        ...result,
        note:
            'Time was advanced through simulateTimeSkip at idle focus: no cultivation progress, but real ' +
            'aging, real hunger, real stagnation and real death checks. Nothing was skipped except the gain.',
        runFlagged: true
    };
}

export async function handleSetRealm(args: z.infer<typeof SetRealmSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_realm');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const from = cultivator.realmOrdinal;
    const delta = args.ordinal - from;

    if (delta === 0) {
        return guidingError(
            'already_at_ordinal',
            `${cultivator.name} already stands at ${rankName(from)}.`,
            { ordinal: from }
        );
    }

    const updated = repos.db.transaction(() => {
        // The same road every rank change takes: peak_ordinal is stamped,
        // accumulated progress is cleared, the stagnation clock restarts.
        const result = repos.cultivators.advanceRealm(cultivator.id, delta);
        writeAdminAudit(repos, 'set_realm', run.id, {
            cultivatorId: cultivator.id,
            fromOrdinal: from,
            toOrdinal: args.ordinal,
            delta,
            via: 'CultivatorRepository.advanceRealm'
        });
        return result;
    })();

    const runAfter = repos.runs.getById(run.id)!;

    return {
        adminMode: true,
        set: true,
        fromOrdinal: from,
        fromRank: rankName(from),
        toOrdinal: args.ordinal,
        toRank: rankName(args.ordinal),
        progressCleared: true,
        stagnationClockReset: true,
        peakOrdinal: runAfter.peakOrdinal,
        cultivator: updated ? describeCultivator(repos, updated, runAfter) : null,
        runFlagged: true,
        note:
            'No breakthrough was rolled and none is claimed. This is a bookkeeping write through ' +
            'advanceRealm, it is in the audit log, and this run is now excluded from the death ledger.'
    };
}

export async function handleAuditLog(args: z.infer<typeof AuditLogSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('audit_log');
    const repos = ensureCultivationDb();
    const run = args.runId ? repos.runs.getById(args.runId) : repos.runs.getActiveRun();

    return {
        adminMode: true,
        runId: run?.id ?? null,
        runFlagged: run ? isAdminRun(repos.db, run.id) : false,
        entries: adminAuditTrail(repos.db, run?.id ?? null, args.limit ?? 50),
        note: 'These rows are the admin flag. run_manage.ledger reads them to exclude these runs.'
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<AdminAction, ActionDefinition> = {
    roster: {
        schema: RosterSchema,
        handler: handleRoster,
        aliases: ['world', 'everyone', 'all_cultivators'],
        description: 'Every cultivator in the world, read-only'
    },
    spawn_encounter: {
        schema: SpawnEncounterSchema,
        handler: handleSpawnEncounter,
        aliases: ['encounter', 'spawn_enemy'],
        description: 'Instantiate a real opponent at a normally-gated realm ordinal'
    },
    spawn_site: {
        schema: SpawnSiteSchema,
        handler: handleSpawnSite,
        aliases: ['site', 'spawn_grave', 'grave'],
        description: 'Instantiate a real site whose contents the engine rolls from the run seed'
    },
    grant_item: {
        schema: GrantItemSchema,
        handler: handleGrantItem,
        aliases: ['grant', 'give_item', 'give'],
        description: 'Put a catalog pill or herb into the real pouch'
    },
    set_ambient: {
        schema: SetAmbientSchema,
        handler: handleSetAmbient,
        aliases: ['ambient', 'set_qi'],
        description: 'Relocate to a place the engine derives the requested ambient band for'
    },
    set_location: {
        schema: SetLocationSchema,
        handler: handleSetLocation,
        aliases: ['move', 'teleport', 'relocate'],
        description: 'Move the cultivator'
    },
    advance_days: {
        schema: AdvanceDaysSchema,
        handler: handleAdvanceDays,
        aliases: ['advance', 'skip_time', 'fast_forward'],
        description: 'Advance real in-world time with real consequences and no cultivation gain'
    },
    set_realm: {
        schema: SetRealmSchema,
        handler: handleSetRealm,
        aliases: ['realm', 'set_ordinal', 'set_rank'],
        description: 'Move the cultivator on the ladder through advanceRealm; logged and flagged'
    },
    audit_log: {
        schema: AuditLogSchema,
        handler: handleAuditLog,
        aliases: ['audit', 'log', 'trail'],
        description: 'The admin audit trail for a run — the rows that flag it'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

export const AdminManageTool = {
    name: 'admin_manage',
    description: `ADMIN — exploratory testing surface. Requires ADMIN_MODE=true in the environment;
every other call is refused with a clear error and no fallback path.

ADMIN LIFTS GATES, NOT TRUTH. Spawning a Tribulation Transcender's grave for a Qi Condensation
player is a content gate being lifted: the engine really creates the site, really rolls its
contents from the run seed, and really writes it to SQLite. You narrate something that exists.

There is NO action here — and there must never be one — that takes an outcome as input and
records it. No declare, no force_success, no set_hp, no revive. Every action below performs a real
deterministic mutation and returns what the engine actually did.

- roster           every cultivator in the world with rank, location, sect, standing (read-only)
- spawn_site       grave/cave/ruin/scar/vein at any ordinal; contents rolled by the engine
- spawn_encounter  a REAL persisted NPC cultivator with engine-rolled talent at any ordinal
- grant_item       catalog pills and herbs only, into the real pouch
- set_ambient      relocates to a place the engine genuinely derives that band for, this block only
- set_location     move the cultivator
- advance_days     real time through simulateTimeSkip: real aging, hunger, stagnation, death
- set_realm        goes through advanceRealm like any other rank change; logged and flagged
- audit_log        the admin trail for this run

Every call is audited, and the run is flagged so it is excluded from the death ledger and from
balance statistics.

Actions: ${ACTIONS.join(', ')}`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        runId: z.string().optional(),
        ordinal: z.number().int().optional(),
        kind: z.enum(['grave', 'cave', 'ruin', 'scar', 'vein']).optional(),
        name: z.string().optional(),
        location: z.string().optional(),
        disposition: z.enum(['hostile', 'wary', 'indifferent']).optional(),
        itemId: z.string().optional(),
        quantity: z.number().int().optional(),
        band: AmbientQiSchema.optional(),
        days: z.number().optional(),
        months: z.number().optional(),
        years: z.number().optional(),
        includeDead: z.boolean().optional(),
        limit: z.number().int().optional()
    })
};

export async function handleAdminManage(
    args: unknown,
    _ctx?: SessionContext
): Promise<McpResponse> {
    const response = await router(args as Record<string, unknown>);
    try {
        const jsonText = response.content[0]?.text;
        if (!jsonText) return response;
        const data = JSON.parse(jsonText);

        let output = '';
        if (data.error === 'admin_mode_disabled') {
            output = RichFormatter.header('Admin Mode Disabled', '🔒');
            output += RichFormatter.alert(data.message, 'error');
            output += `\n*${data.hint}*\n`;
        } else if (data.error === true || typeof data.error === 'string') {
            output = RichFormatter.header('Admin Error', '❌');
            output += RichFormatter.alert(data.message || 'Unknown error', 'error');
            if (data.hint) output += `\n*${data.hint}*\n`;
        } else if (data.roster) {
            output = RichFormatter.header(`World Roster (${data.count})`, '🗺️');
            output += RichFormatter.table(
                ['Name', 'Kind', 'Rank', 'Root', 'Sect', 'Location', 'Alive'],
                data.roster.map((r: Record<string, unknown>) => [
                    String(r.name), String(r.kind), String(r.rank), String(r.spiritRootName),
                    String(r.sectName ?? '-'), String(r.location ?? '-'), r.alive ? 'yes' : 'no'
                ])
            );
        } else if (data.site) {
            output = RichFormatter.header(`Site Spawned: ${data.site.name}`, '⛏️');
            output += RichFormatter.keyValue({
                'ID': data.site.id,
                'Kind': data.site.kind,
                'Ordinal': `${data.site.ordinal} (${data.site.rank})`,
                'Location': data.site.location,
                'Spirit stones': data.site.contents?.spiritStones,
                'Arts': (data.site.contents?.techniqueIds ?? []).join(', ') || '-'
            });
            output += RichFormatter.alert('Content gate lifted. The site is real and persisted.', 'warning');
        } else if (data.encounterId) {
            output = RichFormatter.header('Encounter Spawned', '⚔️');
            output += RichFormatter.keyValue({
                'Encounter': data.encounterId,
                'Opponent': data.opponent?.name,
                'Rank': data.opponent?.realm?.name,
                'Power ratio': data.gateLifted?.powerRatio,
                'Disposition': data.disposition
            });
        } else {
            output = RichFormatter.header('Admin', '🔧');
            output += RichFormatter.keyValue({
                'Action performed': Object.keys(data).find(k =>
                    ['granted', 'moved', 'set', 'advanced', 'spawned'].includes(k)
                ) ?? 'read',
                'Run flagged': data.runFlagged ?? false
            });
            if (data.note) output += `\n*${data.note}*\n`;
        }

        output += RichFormatter.embedJson(data, 'ADMIN_MANAGE');
        return { content: [{ type: 'text', text: output }] };
    } catch {
        return response;
    }
}
