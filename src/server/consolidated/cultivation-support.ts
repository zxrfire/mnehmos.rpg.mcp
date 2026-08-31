/**
 * Shared plumbing for the cultivation MCP tool surface.
 *
 * THE AUTHORITY BOUNDARY
 * ----------------------
 * Everything in this file exists to keep one rule true: the narrating agent may
 * describe an outcome only after the engine has already decided it and SQLite
 * has already recorded it. Concretely that means:
 *
 *   - No tool accepts an outcome. Callers supply intent (who, how long, which
 *     recipe) and never a result (succeeded, gained, died).
 *   - Every stochastic draw comes from `forStream(run.seed, ...)`. There is no
 *     `Math.random()` anywhere in the cultivation tools, so two identical calls
 *     against the same run state produce identical results.
 *   - Multi-write operations run inside one better-sqlite3 transaction, so a
 *     half-applied breakthrough cannot exist.
 *
 * TABLES CREATED HERE
 * -------------------
 * A handful of small tables the cultivation migration does not yet define are
 * created lazily, following the precedent set by `PoiRepository`, which builds
 * its own table in its constructor. These belong in
 * `src/storage/migrations.cultivation.ts` once that file's owner can take them:
 *
 *   cultivator_flags     durable per-cultivator scalars (pending pill, grain
 *                        abstinence expiry, accumulated pill toxicity, ...)
 *   cultivator_pouch     pills and herbs a cultivator carries. `inventory_items`
 *                        cannot be reused: its character_id has a foreign key to
 *                        `characters`, and a cultivator is not a character.
 *   cultivation_sites    graves, caves and encounters the engine has instantiated
 *   ambient_aliases      admin ambient-qi gate lifts (see `aliasForAmbient`)
 *   cultivation_tolls    what the Vault took at each realm boundary, and why
 */

import Database from 'better-sqlite3';
import { getDb } from '../../storage/index.js';
import { AuditRepository } from '../../storage/audit.repo.js';
import { CultivatorRepository } from '../../storage/repos/cultivator.repo.js';
import { RunRepository } from '../../storage/repos/run.repo.js';
import { SectRepository } from '../../storage/repos/sect.repo.js';
import { TechniqueRepository } from '../../storage/repos/technique.repo.js';
import {
    LETHAL_UNTREATED_INJURIES,
    STARVATION_TURNS,
    type AmbientQi,
    type Cultivator,
    type FoundationQuality,
    type Injury,
    type InjurySeverity,
    type InjurySource,
    type Run,
    type SimEvent,
    type TimeSkipResult,
    type TollCandidate,
    type TollResult
} from '../../schema/cultivation.js';
import {
    DAYS_PER_YEAR,
    ambientForBlock,
    ambientBlockStart,
    AMBIENT_REFRESH_DAYS,
    defaultInjuryDescription,
    getSpiritRoot,
    progressRequiredForOrdinal,
    progressRemaining,
    rankName,
    realmForOrdinal,
    lifespanForOrdinal,
    isBreakthroughEligible,
    isRealmBoundary,
    untreatedInjuryCount
} from '../../engine/cultivation/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// REPOSITORIES
// ═══════════════════════════════════════════════════════════════════════════

export interface CultivationRepos {
    db: Database.Database;
    cultivators: CultivatorRepository;
    runs: RunRepository;
    sects: SectRepository;
    techniques: TechniqueRepository;
    audit: AuditRepository;
}

export function ensureCultivationDb(): CultivationRepos {
    const db = getDb();
    ensureAuxiliaryTables(db);
    return {
        db,
        cultivators: new CultivatorRepository(db),
        runs: new RunRepository(db),
        sects: new SectRepository(db),
        techniques: new TechniqueRepository(db),
        audit: new AuditRepository(db)
    };
}

const ensuredDatabases = new WeakSet<Database.Database>();

function ensureAuxiliaryTables(db: Database.Database): void {
    if (ensuredDatabases.has(db)) return;
    db.exec(`
        CREATE TABLE IF NOT EXISTS cultivator_flags (
            cultivator_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (cultivator_id, key),
            FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS cultivator_pouch (
            cultivator_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            item_kind TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (cultivator_id, item_id),
            FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS cultivation_sites (
            id TEXT PRIMARY KEY,
            run_id TEXT,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            ordinal INTEGER NOT NULL DEFAULT 0,
            location TEXT,
            contents TEXT NOT NULL DEFAULT '{}',
            admin_spawned INTEGER NOT NULL DEFAULT 0,
            discovered INTEGER NOT NULL DEFAULT 0,
            created_on_day REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_cultivation_sites_run ON cultivation_sites(run_id);

        CREATE TABLE IF NOT EXISTS ambient_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            location TEXT NOT NULL,
            alias TEXT NOT NULL,
            band TEXT NOT NULL,
            from_day REAL NOT NULL,
            to_day REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_ambient_aliases_run ON ambient_aliases(run_id, location);

        -- The toll ledger. "You can look at the ledger and see the shape of who
        -- you used to be" is a design requirement, not a flourish: every
        -- instalment the Vault charges is recorded here with what it took, why,
        -- and the odds it was charged at.
        CREATE TABLE IF NOT EXISTS cultivation_tolls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            cultivator_id TEXT NOT NULL,
            from_ordinal INTEGER NOT NULL,
            to_ordinal INTEGER NOT NULL,
            boundary_index INTEGER NOT NULL,
            outcome TEXT NOT NULL,
            risk REAL NOT NULL,
            roll REAL NOT NULL,
            taken_kind TEXT,
            taken_id TEXT,
            taken_label TEXT,
            taken_reason TEXT,
            narration_hint TEXT NOT NULL DEFAULT '',
            charged_on_day REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_cultivation_tolls_cultivator
            ON cultivation_tolls(cultivator_id);
    `);
    ensuredDatabases.add(db);
}

// ═══════════════════════════════════════════════════════════════════════════
// GUIDING ERRORS
// House style: handlers RETURN a structured error object rather than throwing,
// so the caller gets a machine-readable code and an actionable hint instead of
// a stack trace.
// ═══════════════════════════════════════════════════════════════════════════

export interface GuidingErrorBody {
    error: string;
    message: string;
    hint?: string;
    [key: string]: unknown;
}

export function guidingError(
    code: string,
    message: string,
    extra: Record<string, unknown> = {}
): GuidingErrorBody {
    return { error: code, message, ...extra };
}

export function isGuidingErrorBody(value: unknown): value is GuidingErrorBody {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { error?: unknown }).error === 'string'
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN + CULTIVATOR RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

export interface ResolvedRun {
    run: Run;
    cultivator: Cultivator;
}

/**
 * Resolve the run and cultivator a tool call is about.
 *
 * Both ids are optional: with neither, the single live run is used, which is
 * what a single-player deployment always wants and removes an entire class of
 * "the agent invented an id" failures.
 */
export function resolveActiveRun(
    repos: CultivationRepos,
    args: { runId?: string; cultivatorId?: string }
): ResolvedRun | GuidingErrorBody {
    let run: Run | null = null;

    if (args.runId) {
        run = repos.runs.getById(args.runId);
        if (!run) {
            return guidingError('unknown_run', `No run with id ${args.runId}.`, {
                hint: 'Call run_manage({ action: "current" }) to find the live run.'
            });
        }
    } else if (args.cultivatorId) {
        run = repos.runs.getActiveRun(args.cultivatorId);
        if (!run) {
            return guidingError(
                'no_active_run',
                `Cultivator ${args.cultivatorId} has no active run.`,
                { hint: 'Start one with run_manage({ action: "start", cultivatorId }).' }
            );
        }
    } else {
        run = repos.runs.getActiveRun();
        if (!run) {
            return guidingError('no_active_run', 'There is no active run in this campaign.', {
                hint: 'Create a cultivator with cultivation_manage({ action: "create_cultivator", name }); that opens the run.'
            });
        }
    }

    if (run.status !== 'active') {
        return guidingError(
            'run_ended',
            `Run ${run.id} ended (${run.status}${run.deathCause ? `: ${run.deathCause}` : ''}). Death is permanent; a finished run is never reopened.`,
            {
                runId: run.id,
                status: run.status,
                deathCause: run.deathCause,
                hint: 'Start a new run with a new cultivator. There is no revive, reload or rollback in this engine.'
            }
        );
    }

    const cultivatorId = args.cultivatorId ?? run.cultivatorId;
    const cultivator = repos.cultivators.getById(cultivatorId);
    if (!cultivator) {
        return guidingError('unknown_cultivator', `No cultivator with id ${cultivatorId}.`, {
            hint: 'Call cultivation_manage({ action: "list" }).'
        });
    }
    if (!cultivator.alive) {
        return guidingError(
            'cultivator_dead',
            `${cultivator.name} is dead (${cultivator.deathCause ?? 'unknown cause'}) and cannot act.`,
            {
                cultivatorId: cultivator.id,
                deathCause: cultivator.deathCause,
                hint: 'Permadeath. Nothing in this engine brings a cultivator back.'
            }
        );
    }

    return { run, cultivator };
}

// ═══════════════════════════════════════════════════════════════════════════
// FLAGS — durable per-cultivator scalars
// ═══════════════════════════════════════════════════════════════════════════

export const FLAG_GRAIN_ABSTINENCE_UNTIL = 'grain_abstinence_until_day';
export const FLAG_PENDING_PILL = 'pending_pill';
export const FLAG_RANKS_THIS_TURN = 'ranks_this_turn';
export const FLAG_PILL_TOXICITY = 'pill_toxicity';
export const FLAG_STIPEND_PAID_DAY = 'stipend_paid_day';
/**
 * The foundation laid at the 12 -> 13 crossing.
 *
 * `BreakthroughResult.foundationEstablished` is documented as something "the
 * caller must persist onto the cultivator", and `CultivatorSchema` has the
 * `foundationQuality` field — but `cultivators` has no column for it yet and
 * `CultivatorRepository` neither writes nor reads it. Held here so the engine's
 * decision is not silently dropped; move it to the column the moment the
 * storage layer grows one.
 */
export const FLAG_FOUNDATION_QUALITY = 'foundation_quality';
/** The Vault took the name. People have to be told it, every time. */
export const FLAG_NAME_TAKEN = 'name_taken';

export function readFlag(db: Database.Database, cultivatorId: string, key: string): string | null {
    const row = db
        .prepare('SELECT value FROM cultivator_flags WHERE cultivator_id = ? AND key = ?')
        .get(cultivatorId, key) as { value: string } | undefined;
    return row ? row.value : null;
}

export function writeFlag(
    db: Database.Database,
    cultivatorId: string,
    key: string,
    value: string
): void {
    db.prepare(`
        INSERT INTO cultivator_flags (cultivator_id, key, value, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(cultivator_id, key) DO UPDATE SET
            value = excluded.value, updated_at = excluded.updated_at
    `).run(cultivatorId, key, value);
}

export function clearFlag(db: Database.Database, cultivatorId: string, key: string): void {
    db.prepare('DELETE FROM cultivator_flags WHERE cultivator_id = ? AND key = ?')
        .run(cultivatorId, key);
}

export function readNumberFlag(
    db: Database.Database,
    cultivatorId: string,
    key: string,
    fallback = 0
): number {
    const raw = readFlag(db, cultivatorId, key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function readJsonFlag<T>(
    db: Database.Database,
    cultivatorId: string,
    key: string
): T | null {
    const raw = readFlag(db, cultivatorId, key);
    if (raw === null) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

/** A pill consumed for its breakthrough boost, held until the next attempt. */
export interface PendingPill {
    pillId: string;
    name: string;
    potency: number;
}

/**
 * Whether the cultivator is currently on grain abstinence.
 *
 * Stored as an absolute in-world day rather than a boolean so a pill with a
 * finite duration expires by the passage of time and not by anyone remembering
 * to clear a flag.
 */
export function isOnGrainAbstinence(
    db: Database.Database,
    cultivatorId: string,
    currentDay: number
): boolean {
    return readNumberFlag(db, cultivatorId, FLAG_GRAIN_ABSTINENCE_UNTIL, -1) > currentDay;
}

/** Ranks already gained on this turn. Enforces MAX_RANKS_PER_TURN across calls. */
export function ranksGainedThisTurn(
    db: Database.Database,
    cultivatorId: string,
    turn: number
): number {
    const record = readJsonFlag<{ turn: number; count: number }>(
        db,
        cultivatorId,
        FLAG_RANKS_THIS_TURN
    );
    if (!record || record.turn !== turn) return 0;
    return Math.max(0, Math.floor(record.count));
}

export function recordRankGained(
    db: Database.Database,
    cultivatorId: string,
    turn: number,
    gained: number
): void {
    const current = ranksGainedThisTurn(db, cultivatorId, turn);
    writeFlag(
        db,
        cultivatorId,
        FLAG_RANKS_THIS_TURN,
        JSON.stringify({ turn, count: current + Math.max(0, gained) })
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// POUCH — pills and herbs a cultivator carries
// ═══════════════════════════════════════════════════════════════════════════

export type PouchItemKind = 'pill' | 'herb';

export interface PouchEntry {
    itemId: string;
    kind: PouchItemKind;
    quantity: number;
}

export function listPouch(db: Database.Database, cultivatorId: string): PouchEntry[] {
    const rows = db
        .prepare(`
            SELECT item_id, item_kind, quantity FROM cultivator_pouch
            WHERE cultivator_id = ? AND quantity > 0
            ORDER BY item_kind ASC, item_id ASC
        `)
        .all(cultivatorId) as { item_id: string; item_kind: string; quantity: number }[];
    return rows.map(r => ({
        itemId: r.item_id,
        kind: r.item_kind as PouchItemKind,
        quantity: r.quantity
    }));
}

export function pouchQuantity(
    db: Database.Database,
    cultivatorId: string,
    itemId: string
): number {
    const row = db
        .prepare('SELECT quantity FROM cultivator_pouch WHERE cultivator_id = ? AND item_id = ?')
        .get(cultivatorId, itemId) as { quantity: number } | undefined;
    return row ? row.quantity : 0;
}

export function addToPouch(
    db: Database.Database,
    cultivatorId: string,
    itemId: string,
    kind: PouchItemKind,
    quantity: number
): void {
    const amount = Math.max(0, Math.floor(quantity));
    if (amount === 0) return;
    db.prepare(`
        INSERT INTO cultivator_pouch (cultivator_id, item_id, item_kind, quantity, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(cultivator_id, item_id) DO UPDATE SET
            quantity = cultivator_pouch.quantity + excluded.quantity,
            updated_at = excluded.updated_at
    `).run(cultivatorId, itemId, kind, amount);
}

/** Remove stock. Returns false and writes nothing when the pouch is short. */
export function removeFromPouch(
    db: Database.Database,
    cultivatorId: string,
    itemId: string,
    quantity: number
): boolean {
    const amount = Math.max(0, Math.floor(quantity));
    if (amount === 0) return true;
    const held = pouchQuantity(db, cultivatorId, itemId);
    if (held < amount) return false;
    db.prepare(`
        UPDATE cultivator_pouch SET quantity = quantity - ?, updated_at = datetime('now')
        WHERE cultivator_id = ? AND item_id = ?
    `).run(amount, cultivatorId, itemId);
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// AMBIENT QI
//
// Ambient qi is a pure function of (seed, location, day) inside the engine, and
// `simulateTimeSkip` recomputes it internally from the location id it is given.
// The only way to change what a cultivator breathes without lying about it is
// therefore to change WHERE they are — which is exactly what an ambient gate
// lift means in the fiction. `aliasForAmbient` searches for a place name whose
// engine-computed band is the requested one, so the number the engine returns
// afterwards is one the engine genuinely derived.
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_LOCATION = 'the open road';

export interface AmbientAlias {
    location: string;
    alias: string;
    band: AmbientQi;
    fromDay: number;
    toDay: number;
}

export function activeAmbientAlias(
    db: Database.Database,
    runId: string,
    location: string,
    day: number
): AmbientAlias | null {
    const row = db
        .prepare(`
            SELECT location, alias, band, from_day, to_day FROM ambient_aliases
            WHERE run_id = ? AND location = ? AND from_day <= ? AND to_day >= ?
            ORDER BY id DESC LIMIT 1
        `)
        .get(runId, location, day, day) as
        | { location: string; alias: string; band: string; from_day: number; to_day: number }
        | undefined;
    if (!row) return null;
    return {
        location: row.location,
        alias: row.alias,
        band: row.band as AmbientQi,
        fromDay: row.from_day,
        toDay: row.to_day
    };
}

/**
 * The location id every cultivation call should hand the engine.
 *
 * Normally the cultivator's own location. While an admin gate lift is in force
 * it is the aliased place the engine really does compute the desired band for.
 */
export function effectiveLocationId(
    db: Database.Database,
    runId: string,
    location: string | null,
    day: number
): string {
    const base = location ?? DEFAULT_LOCATION;
    const alias = activeAmbientAlias(db, runId, base, day);
    return alias ? alias.alias : base;
}

export function currentAmbient(
    db: Database.Database,
    run: Run,
    location: string | null,
    day: number
): AmbientQi {
    return ambientForBlock(run.seed, effectiveLocationId(db, run.id, location, day), day);
}

/**
 * Find a place name of the form `${location}#${n}` whose engine-derived band on
 * the block containing `day` is `band`.
 *
 * Bounded: `thin` and `normal` land within a couple of tries, `dense` (5% of
 * the distribution) within a few dozen. Returns null rather than looping if the
 * search is somehow unlucky, and the caller reports that honestly.
 */
export function aliasForAmbient(
    seed: string,
    location: string,
    day: number,
    band: AmbientQi,
    maxAttempts = 20_000
): string | null {
    const blockStart = ambientBlockStart(day);
    for (let n = 0; n < maxAttempts; n++) {
        const candidate = `${location}#${n}`;
        if (ambientForBlock(seed, candidate, blockStart) === band) return candidate;
    }
    return null;
}

export const AMBIENT_BLOCK_DAYS = AMBIENT_REFRESH_DAYS;

// ═══════════════════════════════════════════════════════════════════════════
// TIME-SKIP PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

export interface ReconstructedInjury {
    severity: InjurySeverity;
    source: InjurySource;
    description: string;
    sustainedOnTurn: number;
    /** True when the engine's digest did not state the severity outright. */
    inferred: boolean;
}

const SEVERITY_IN_TEXT = /\b(minor|serious|crippling)\b/i;
const STRIKES_HOME = /(\d+)\s+struck home/i;

/**
 * Rebuild the injury records a time-skip produced from its own event digest.
 *
 * `TimeSkipResult` reports `deltas.injuriesGained` as a count but does not carry
 * the `Injury` objects, so the digest is the only channel through which the
 * wounds reach persistence. Every branch below reads a fact the ENGINE wrote —
 * `data.severity` on a deviation, the severity word the engine put in its own
 * narration hint, the known-crippling injury a fatal breakthrough always mints,
 * the strike count of a tribulation — so nothing here is the tool inventing a
 * wound. The count is reconciled against `injuriesGained` by the caller.
 *
 * (The clean fix is one line in the engine: have `TimeSkipResult` carry
 * `injuriesSustained: Injury[]`. Flagged to that module's owner.)
 */
export function reconstructSkipInjuries(
    result: TimeSkipResult,
    turnBase: number
): ReconstructedInjury[] {
    const injuries: ReconstructedInjury[] = [];

    const stampTurn = (event: SimEvent): number =>
        Math.max(0, Math.floor(turnBase + Math.floor(event.dayOffset)));

    for (const event of result.events) {
        if (event.kind === 'qi_deviation') {
            const severity = asSeverity(event.data?.severity) ?? 'serious';
            injuries.push({
                severity,
                source: 'qi_deviation',
                description: defaultInjuryDescription(severity, 'qi_deviation'),
                sustainedOnTurn: stampTurn(event),
                inferred: asSeverity(event.data?.severity) === null
            });
            continue;
        }

        if (event.kind === 'breakthrough_failure') {
            const outcome = typeof event.data?.outcome === 'string' ? event.data.outcome : null;
            if (outcome === 'failure_stable') continue;

            // The fatal branch of `resolveFailure` always mints a crippling
            // injury; that is a constant of the engine, not a guess.
            const isDeath = outcome === null && result.died;
            const source: InjurySource =
                outcome === 'failure_deviation' ? 'qi_deviation' : 'failed_breakthrough';
            const matched = SEVERITY_IN_TEXT.exec(event.summary);
            const severity: InjurySeverity = isDeath
                ? 'crippling'
                : (matched ? (matched[1].toLowerCase() as InjurySeverity) : 'serious');
            injuries.push({
                severity,
                source,
                description: defaultInjuryDescription(severity, source),
                sustainedOnTurn: stampTurn(event),
                inferred: !isDeath && matched === null
            });
            continue;
        }

        if (event.kind === 'breakthrough_success') {
            // Only tribulation breakthroughs wound on success, one injury per
            // strike that landed, the last of them crippling.
            const tribulation = event.data?.tribulation as { strikes: number } | null | undefined;
            if (!tribulation) continue;
            const landed = STRIKES_HOME.exec(event.summary);
            const failedStrikes = landed ? Number(landed[1]) : 0;
            const count = Math.min(failedStrikes, LETHAL_UNTREATED_INJURIES);
            for (let i = 1; i <= count; i++) {
                const severity: InjurySeverity =
                    i >= LETHAL_UNTREATED_INJURIES ? 'crippling' : 'serious';
                injuries.push({
                    severity,
                    source: 'tribulation',
                    description: `Heavenly lightning, strike ${i} of ${tribulation.strikes}, struck home.`,
                    sustainedOnTurn: stampTurn(event),
                    inferred: landed === null
                });
            }
        }
    }

    return injuries;
}

function asSeverity(value: unknown): InjurySeverity | null {
    return value === 'minor' || value === 'serious' || value === 'crippling' ? value : null;
}

/**
 * Absolute end-state the caller must write so that persistence and simulation
 * agree exactly.
 *
 * `TimeSkipResult.deltas` omits `yearsAtCurrentRealm` and `starvationTurns`, so
 * both are derived here from the digest — the last `breakthrough_success` event
 * dates the stagnation clock's reset, and the `starvation_warning` event dates
 * the moment the belly emptied. Both are engine-emitted facts.
 */
export interface SkipEndState {
    hp: number;
    qi: number;
    satiety: number;
    starvationTurns: number;
    spiritStones: number;
    cultivationProgress: number;
    age: number;
    yearsAtCurrentRealm: number;
    realmOrdinal: number;
}

export function skipEndState(before: Cultivator, result: TimeSkipResult): SkipEndState {
    const d = result.deltas;

    let lastAdvanceDay: number | null = null;
    let emptyBellyDay: number | null = null;
    for (const event of result.events) {
        if (event.kind === 'breakthrough_success') lastAdvanceDay = event.dayOffset;
        if (event.kind === 'starvation_warning') emptyBellyDay = event.dayOffset;
    }

    const satiety = clampInt(before.satiety + d.satiety, 0, 100);
    const yearsAtCurrentRealm =
        lastAdvanceDay === null
            ? before.yearsAtCurrentRealm + result.simulatedDays / DAYS_PER_YEAR
            : (result.simulatedDays - lastAdvanceDay) / DAYS_PER_YEAR;

    let starvationTurns = 0;
    if (result.deathCause === 'starvation') {
        starvationTurns = STARVATION_TURNS;
    } else if (satiety === 0 && emptyBellyDay !== null) {
        starvationTurns = Math.max(
            0,
            Math.min(STARVATION_TURNS, Math.floor(result.simulatedDays - emptyBellyDay))
        );
    } else if (satiety === 0) {
        starvationTurns = before.starvationTurns;
    }

    return {
        hp: clampInt(before.hp + d.hp, 0, before.maxHp),
        qi: clampInt(before.qi + d.qi, 0, before.maxQi),
        satiety,
        starvationTurns,
        spiritStones: Math.max(0, Math.round(before.spiritStones + d.spiritStones)),
        cultivationProgress: Math.max(0, before.cultivationProgress + d.cultivationProgress),
        age: Math.max(0, before.age + d.age),
        yearsAtCurrentRealm: Math.max(0, roundYears(yearsAtCurrentRealm)),
        realmOrdinal: before.realmOrdinal + d.realmOrdinal
    };
}

function clampInt(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)));
}

function roundYears(years: number): number {
    return Math.round(years * 1e6) / 1e6;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE VAULT'S TOLL
//
// "The cultivator does not choose what is taken. The engine chooses,
// deterministically, from what the run has actually accumulated: real bonds
// with real NPCs, real memories, real techniques in the database."
//
// The engine layer holds no database, so assembling those candidates from real
// rows is this layer's job — and so is deleting exactly the row the engine
// named afterwards. A toll the engine charged that the database does not show
// is the same failure as a breakthrough the narrator invented.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What this run has that the Vault could take.
 *
 * Everything here is a real row with a real id, so `persistToll` can delete
 * precisely what was named. Weights say how much a thing MATTERED — the Vault
 * takes what mattered, so higher is more likely to go.
 */
export function tollCandidatesFor(
    repos: CultivationRepos,
    cultivator: Cultivator
): TollCandidate[] {
    const candidates: TollCandidate[] = [];

    // Techniques: a mastered art weighs more than one half-read, because
    // losing it costs more.
    for (const known of repos.techniques.listKnown(cultivator.id)) {
        candidates.push({
            kind: 'technique',
            id: known.id,
            label: known.name,
            weight: 1 + known.mastery * 2
        });
    }

    // Bonds: people in this run who know this cultivator. A sect brother is a
    // real row; when the Vault takes one, they stop knowing you.
    if (cultivator.runId) {
        for (const other of repos.cultivators.list({ runId: cultivator.runId })) {
            if (other.id === cultivator.id || !other.alive) continue;
            if (other.kind === 'enemy') continue;
            const sameSect =
                cultivator.sectId !== null && other.sectId === cultivator.sectId;
            candidates.push({
                kind: 'bond',
                id: other.id,
                label: other.name,
                weight: sameSect ? 2 : 1
            });
        }
    }

    return candidates;
}

/** Conditions the crossing is made under, all read from persisted state. */
export function tollConditionsFor(
    repos: CultivationRepos,
    cultivator: Cultivator
): {
    candidates: TollCandidate[];
    sectProtection: number;
    nameAlreadyTaken: boolean;
} {
    const membership = repos.sects.getMembership(cultivator.id);
    // A sect spends on a crossing in proportion to how much it has invested in
    // the disciple, which is what rank actually measures.
    const sectProtection = membership ? Math.min(0.3, 0.06 * (membership.rankIndex + 1)) : 0;

    return {
        candidates: tollCandidatesFor(repos, cultivator),
        sectProtection,
        nameAlreadyTaken: readFlag(repos.db, cultivator.id, FLAG_NAME_TAKEN) === '1'
    };
}

/**
 * Write down what the Vault took, and actually take it.
 *
 * MUST be called inside the caller's transaction: the rank advance and the toll
 * are one event, and a crossing that recorded the rank but not the price would
 * be exactly the drift this engine exists to prevent.
 */
export function persistToll(
    repos: CultivationRepos,
    run: Run,
    cultivatorId: string,
    toll: TollResult
): void {
    repos.db.prepare(`
        INSERT INTO cultivation_tolls (
            run_id, cultivator_id, from_ordinal, to_ordinal, boundary_index,
            outcome, risk, roll, taken_kind, taken_id, taken_label, taken_reason,
            narration_hint, charged_on_day
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        run.id, cultivatorId, toll.fromOrdinal, toll.toOrdinal, toll.boundaryIndex,
        toll.outcome, toll.risk, toll.roll,
        toll.taken?.kind ?? null, toll.taken?.id ?? null,
        toll.taken?.label ?? null, toll.taken?.reason ?? null,
        toll.narrationHint, run.elapsedDays
    );

    if (toll.outcome !== 'taken' || !toll.taken) return;

    switch (toll.taken.kind) {
        case 'technique':
            // Gone as if never learned. The join row is deleted and the
            // denormalised list on the cultivator is resynced with it.
            if (toll.taken.id) repos.techniques.forget(cultivatorId, toll.taken.id);
            break;
        case 'name':
            // The name is not a row that can be deleted, so it is marked taken.
            // Thereafter people have to be told it, every time.
            writeFlag(repos.db, cultivatorId, FLAG_NAME_TAKEN, '1');
            break;
        case 'bond':
        case 'memory':
            // Bonds and memories have no table of their own yet; the ledger row
            // above is the record, and it names exactly which one went.
            break;
    }
}

export interface TollLedgerEntry {
    fromOrdinal: number;
    toOrdinal: number;
    boundaryIndex: number;
    outcome: string;
    risk: number;
    roll: number;
    taken: { kind: string; id: string | null; label: string; reason: string } | null;
    narrationHint: string;
    chargedOnDay: number;
}

/** Everything the Vault has charged this cultivator, oldest first. */
export function listTolls(db: Database.Database, cultivatorId: string): TollLedgerEntry[] {
    const rows = db
        .prepare(`
            SELECT * FROM cultivation_tolls WHERE cultivator_id = ? ORDER BY id ASC
        `)
        .all(cultivatorId) as Array<Record<string, any>>;

    return rows.map(row => ({
        fromOrdinal: row.from_ordinal,
        toOrdinal: row.to_ordinal,
        boundaryIndex: row.boundary_index,
        outcome: row.outcome,
        risk: row.risk,
        roll: row.roll,
        taken: row.taken_kind
            ? {
                kind: row.taken_kind,
                id: row.taken_id,
                label: row.taken_label,
                reason: row.taken_reason
            }
            : null,
        narrationHint: row.narration_hint,
        chargedOnDay: row.charged_on_day
    }));
}

/**
 * Record the foundation the engine laid.
 *
 * Interim home: see FLAG_FOUNDATION_QUALITY. Written unconditionally so the
 * value is durable the moment the engine produces it.
 */
export function persistFoundation(
    db: Database.Database,
    cultivatorId: string,
    quality: FoundationQuality
): void {
    writeFlag(db, cultivatorId, FLAG_FOUNDATION_QUALITY, quality);
}

export function readFoundation(
    db: Database.Database,
    cultivatorId: string
): FoundationQuality {
    return (readFlag(db, cultivatorId, FLAG_FOUNDATION_QUALITY) ?? 'none') as FoundationQuality;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT + ADMIN RUN FLAGGING
//
// context.md: "Every admin action is written to the audit log, and runs that
// used admin are flagged so they are excluded from the death ledger."
//
// The audit row IS the flag. `target_id` carries the run id, so "did this run
// use admin" is a single indexed-ish lookup with no schema change and no way
// for the flag to drift out of step with the log that justifies it.
// ═══════════════════════════════════════════════════════════════════════════

export const ADMIN_AUDIT_PREFIX = 'admin_manage.';

export function writeAdminAudit(
    repos: CultivationRepos,
    action: string,
    runId: string | null,
    details: Record<string, unknown>
): void {
    repos.audit.create({
        action: `${ADMIN_AUDIT_PREFIX}${action}`,
        actorId: 'admin',
        targetId: runId,
        details,
        timestamp: new Date().toISOString()
    });
}

export function isAdminRun(db: Database.Database, runId: string): boolean {
    const row = db
        .prepare(`
            SELECT 1 AS hit FROM audit_logs
            WHERE target_id = ? AND action LIKE ? LIMIT 1
        `)
        .get(runId, `${ADMIN_AUDIT_PREFIX}%`) as { hit: number } | undefined;
    return row !== undefined;
}

export function adminRunIds(db: Database.Database): Set<string> {
    const rows = db
        .prepare(`
            SELECT DISTINCT target_id AS id FROM audit_logs
            WHERE action LIKE ? AND target_id IS NOT NULL
        `)
        .all(`${ADMIN_AUDIT_PREFIX}%`) as { id: string }[];
    return new Set(rows.map(r => r.id));
}

export function adminAuditTrail(
    db: Database.Database,
    runId: string | null,
    limit = 50
): Array<{ action: string; timestamp: string; details: unknown }> {
    const rows = (
        runId
            ? db
                .prepare(`
                    SELECT action, timestamp, details FROM audit_logs
                    WHERE action LIKE ? AND target_id = ?
                    ORDER BY id DESC LIMIT ?
                `)
                .all(`${ADMIN_AUDIT_PREFIX}%`, runId, limit)
            : db
                .prepare(`
                    SELECT action, timestamp, details FROM audit_logs
                    WHERE action LIKE ? ORDER BY id DESC LIMIT ?
                `)
                .all(`${ADMIN_AUDIT_PREFIX}%`, limit)
    ) as { action: string; timestamp: string; details: string | null }[];

    return rows.map(row => ({
        action: row.action,
        timestamp: row.timestamp,
        details: row.details ? safeParse(row.details) : null
    }));
}

function safeParse(json: string): unknown {
    try {
        return JSON.parse(json);
    } catch {
        return json;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTIONS
// Every read-side shape the narrator sees. Derived, never stored, so a
// projection can never drift from the row it describes.
// ═══════════════════════════════════════════════════════════════════════════

export function describeCultivator(
    repos: CultivationRepos,
    cultivator: Cultivator,
    run: Run | null
): Record<string, unknown> {
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    const root = getSpiritRoot(cultivator.spiritRoot);
    const untreated = untreatedInjuryCount(cultivator.injuries);
    const day = run ? Math.floor(run.elapsedDays) : 0;
    const ambient = run
        ? currentAmbient(repos.db, run, cultivator.location, day)
        : null;

    return {
        id: cultivator.id,
        name: cultivator.name,
        kind: cultivator.kind,
        alive: cultivator.alive,
        deathCause: cultivator.deathCause,
        realm: {
            ordinal: cultivator.realmOrdinal,
            name: rankName(cultivator.realmOrdinal),
            realm: realmForOrdinal(cultivator.realmOrdinal).name,
            hanzi: realmForOrdinal(cultivator.realmOrdinal).hanzi,
            nextIsRealmBoundary: isRealmBoundary(cultivator.realmOrdinal),
            lifespanYears: lifespanForOrdinal(cultivator.realmOrdinal)
        },
        talent: {
            spiritRoot: cultivator.spiritRoot,
            spiritRootName: root.name,
            grade: root.grade,
            elements: root.elements,
            cultivationSpeed: root.cultivationSpeed,
            attributes: cultivator.attributes,
            note: 'Rolled once from the run seed at creation. Permanent; no tool changes it.'
        },
        progress: {
            current: round2(cultivator.cultivationProgress),
            required,
            remaining: round2(progressRemaining(cultivator)),
            fraction: required > 0 ? round4(cultivator.cultivationProgress / required) : 1,
            breakthroughEligible: isBreakthroughEligible(cultivator)
        },
        vitals: {
            hp: cultivator.hp,
            maxHp: cultivator.maxHp,
            qi: cultivator.qi,
            maxQi: cultivator.maxQi,
            satiety: cultivator.satiety,
            starvationTurns: cultivator.starvationTurns,
            onGrainAbstinence: isOnGrainAbstinence(repos.db, cultivator.id, day)
        },
        mortality: {
            age: round2(cultivator.age),
            lifespanRemaining: round2(
                lifespanForOrdinal(cultivator.realmOrdinal) - cultivator.age
            ),
            yearsAtCurrentRealm: round2(cultivator.yearsAtCurrentRealm),
            untreatedInjuries: untreated,
            lethalInjuryThreshold: LETHAL_UNTREATED_INJURIES,
            atLethalInjuryThreshold: untreated >= LETHAL_UNTREATED_INJURIES
        },
        injuries: cultivator.injuries.map(summariseInjury),
        standing: {
            spiritStones: cultivator.spiritStones,
            sectId: cultivator.sectId,
            sectRank: cultivator.sectRank,
            location: cultivator.location,
            feuds: cultivator.feuds
        },
        knownTechniques: cultivator.knownTechniques,
        ambient,
        run: run
            ? {
                id: run.id,
                status: run.status,
                turn: run.turn,
                elapsedDays: round2(run.elapsedDays),
                elapsedYears: round2(run.elapsedDays / DAYS_PER_YEAR),
                peakOrdinal: run.peakOrdinal
            }
            : null
    };
}

export function summariseInjury(injury: Injury): Record<string, unknown> {
    return {
        id: injury.id,
        severity: injury.severity,
        source: injury.source,
        description: injury.description,
        treated: injury.treated,
        sustainedOnTurn: injury.sustainedOnTurn,
        cultivationPenalty: injury.cultivationPenalty,
        breakthroughPenalty: injury.breakthroughPenalty
    };
}

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
    return Math.round(n * 10_000) / 10_000;
}

// ═══════════════════════════════════════════════════════════════════════════
// DURATION
// ═══════════════════════════════════════════════════════════════════════════

export interface DurationInput {
    days?: number;
    months?: number;
    years?: number;
}

/** In-world month. 365/12 would put a "three month" skip on a fractional day. */
export const DAYS_PER_MONTH = 30;

/**
 * Total days for a duration expressed in any mix of days, months and years.
 * "I cultivate for three months" and "for ten years" are the same call.
 */
export function totalDays(input: DurationInput): number {
    const days = safeNonNegative(input.days);
    const months = safeNonNegative(input.months);
    const years = safeNonNegative(input.years);
    return Math.floor(days + months * DAYS_PER_MONTH + years * DAYS_PER_YEAR);
}

function safeNonNegative(n: number | undefined): number {
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}
