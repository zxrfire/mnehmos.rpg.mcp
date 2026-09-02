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
 * SCHEMA AND SEEDING
 * ------------------
 * Every table this module reads is declared in
 * `src/storage/migrations.cultivation.ts` and created by `migrate()` when the
 * database is opened: `cultivator_flags`, `cultivator_pouch`,
 * `cultivation_sites`, `ambient_aliases` and `cultivation_tolls`, alongside the
 * cultivator, run, injury, technique, alchemy and sect tables.
 *
 * What this module does own is CONTENT SEEDING. The sect catalog is compiled-in
 * data; the `sects` table is state. `ensureSectsSeeded` copies one into the
 * other, idempotently, on first touch - so a fresh world has the nineteen sects
 * of the region in it without anyone having to remember a setup step, and an
 * existing world is refreshed rather than duplicated.
 */

import Database from 'better-sqlite3';
import { getDb } from '../../storage/index.js';
import { AuditRepository } from '../../storage/audit.repo.js';
import {
    endRelationship,
    recordKnowledge,
    type KnowledgeInput,
    type Relationship
} from '../../engine/social/index.js';
import { SECTS, getSect, getSectAdmission } from '../../data/cultivation/sects.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { getArtifact } from '../../data/cultivation/artifacts.js';
import {
    hostilityReasonFor,
    ordinaryBandFor,
    standingConsequence,
    type LocationRecord,
    type StandingConsequence
} from '../../engine/world/locations.js';
import type { WorldState } from '../../engine/world/world-state.js';
import { worldForRun } from '../state/cultivation-world.js';
import { placeKey } from '../../web/knowledge.js';
import {
    DEGREE_NAMES,
    insightName,
    type DiscoveryContext,
    type ExposureInput
} from '../../engine/cultivation/understanding.js';
import { CultivatorRepository } from '../../storage/repos/cultivator.repo.js';
import { RunRepository } from '../../storage/repos/run.repo.js';
import { SectRepository } from '../../storage/repos/sect.repo.js';
import { TechniqueRepository } from '../../storage/repos/technique.repo.js';
import {
    CRIPPLING_UNTREATED_INJURIES,
    SATIETY_MAX,
    type Achievement,
    type AmbientQi,
    type Cultivator,
    type Insight,
    type FoundationQuality,
    type ImmortalStatus,
    type Injury,
    type Run,
    type TechniqueGrade,
    type TimeSkipResult,
    type TollCandidate,
    type TollResult,
    type TollTaken,
    type VisionSeed
} from '../../schema/cultivation.js';
import { declaredAmbientAt, regionIdOfPlace } from '../../data/cultivation/regions.js';
import { daoGroundNamed, daoGroundsIn } from '../../data/cultivation/places-that-teach-a-dao.js';
import {
    groundFromCatalogRow,
    howARoadCameFrom,
    howSomebodyStandsToAGround,
    type SomebodyStanding
} from '../../engine/world/how-a-cultivator-comes-by-a-road.js';
import {
    DAYS_PER_YEAR,
    ambientForBlock,
    ambientBlockStart,
    AMBIENT_REFRESH_DAYS,
    densityForBand,
    getSpiritRoot,
    openingPosition,
    originDiscoveryContext,
    provisionedYears,
    withOriginAccess,
    progressRequiredForOrdinal,
    progressRemaining,
    rankName,
    realmForOrdinal,
    lifespanForOrdinal,
    isBreakthroughEligible,
    isRealmBoundary,
    untreatedInjuryCount,
    aggregateInjuryPenalties
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
    const repos: CultivationRepos = {
        db,
        cultivators: new CultivatorRepository(db),
        runs: new RunRepository(db),
        sects: new SectRepository(db),
        techniques: new TechniqueRepository(db),
        audit: new AuditRepository(db)
    };
    ensureSectsSeeded(repos);
    return repos;
}

/**
 * Copy the compiled-in sect catalog into the `sects` table.
 *
 * Idempotent twice over: guarded per database handle so it runs once per
 * process, and built on `SectRepository.upsert`, so running it again on a world
 * that already has sects refreshes their rows rather than duplicating them. A
 * disciple's membership survives, because `sect_members` keys on the sect id
 * and the ids are stable catalog constants.
 *
 * `SectSchema.parse` inside `upsert` strips the content-side fields - what a
 * sect teaches, who it feuds with, the state of its inherited compound - which
 * stay in the catalog and are read from there at request time. The database
 * holds what changes; the catalog holds what does not.
 */
export function ensureSectsSeeded(repos: CultivationRepos): void {
    if (seededDatabases.has(repos.db)) return;
    const seed = repos.db.transaction(() => {
        for (const sect of SECTS) repos.sects.upsert(sect);
    });
    seed();
    seededDatabases.add(repos.db);
}

const seededDatabases = new WeakSet<Database.Database>();

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
// FLAGS - durable per-cultivator scalars
// ═══════════════════════════════════════════════════════════════════════════

export const FLAG_GRAIN_ABSTINENCE_UNTIL = 'grain_abstinence_until_day';
export const FLAG_PENDING_PILL = 'pending_pill';
export const FLAG_RANKS_THIS_TURN = 'ranks_this_turn';
export const FLAG_PILL_TOXICITY = 'pill_toxicity';
/**
 * Breakthrough pills swallowed in this life, ever.
 *
 * Separate from toxicity, which decays against a tolerance and is about the
 * body. This is the count `pillToleranceDecay` reads, and it never goes down:
 * the fifth pill is worth less than the first for the rest of a life.
 */
export const FLAG_BREAKTHROUGH_PILLS_TAKEN = 'breakthrough_pills_taken';
export const FLAG_STIPEND_PAID_DAY = 'stipend_paid_day';
/** The crossing took the name. People have to be told it, every time. */
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
    /**
     * The catalog row's grade.
     *
     * THE input that matters to `attemptBreakthrough`: it selects the real
     * graded curve - base multiplier and the realm band the pill was made for -
     * instead of the legacy flat `potency` path. Optional so a record written
     * before this existed still loads, and so a synthesised pill with no
     * catalog row behind it stays honest about having none.
     */
    grade?: TechniqueGrade;
    /**
     * How many breakthrough pills this cultivator had already taken when this
     * one was swallowed.
     *
     * Drives permanent tolerance. Stamped at CONSUMPTION rather than read at
     * the attempt, because the tolerance a pill is subject to is a fact about
     * the body that swallowed it on the day it swallowed it - and a pill held
     * for twenty years through four other pills should not quietly become
     * weaker in the pouch.
     */
    priorPillsTaken?: number;
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
// POUCH - what a cultivator carries
//
// Pills and herbs are COUNTED stock: a holder and a number, and nobody cares
// which one you took. An artifact is not. `docs/world/things/items.md` draws the line
// on whether this specific object moving is an event somebody should be able to
// find out about two centuries later, and for a rated object it always is.
//
// It is in the same table anyway, and that is deliberate rather than lazy: the
// pouch is the only store the played game has for "what is on this person", and
// a second one beside it would be the parallel-catalog mistake AGENTS.md
// forbids. What the row does NOT carry is provenance - `world_objects` owns
// that, and an artifact reaching a player through the world rather than through
// ADMIN should be written there too. See `carriedArtifact` below for what reads
// this, which today is less than it should be.
// ═══════════════════════════════════════════════════════════════════════════

export type PouchItemKind = 'pill' | 'herb' | 'artifact';

export interface PouchEntry {
    itemId: string;
    kind: PouchItemKind;
    quantity: number;
}

/**
 * The COUNTED stock in a pouch: pills and herbs, and nothing else.
 *
 * ── WHY THIS FILTERS ─────────────────────────────────────────────────────
 *
 * Every existing reader of this function was written when there were exactly
 * two kinds, and two of them branch on `pill` and treat EVERYTHING ELSE as a
 * herb - `projectPouch` in `alchemy-manage.ts` does it in one `else`, and
 * `pouchNames` in `entities.ts` falls back to the raw item id. Widening the
 * kind without widening this made a granted artifact print as
 * "Herbs: 1 x hollow-unwritten-length" in the player's own pouch listing, which
 * is the surface lying about a write it really performed.
 *
 * So the counted list stays counted, every existing caller behaves exactly as
 * it did, and a rated object is reached through {@link listCarriedArtifacts}
 * instead. It IS in the table, `carriedArtifact` reads it back by name, and it
 * is deliberately out of the sale quote as well - `items.md` is explicit that
 * above the line cash is not the medium.
 *
 * AND THE LISTING NOW EXISTS. The `inventory` verb in `game.ts` reads
 * `listCarriedArtifacts` alongside the medicine, because for a while a granted
 * rated object was in this table and invisible to every sentence a player could
 * type - `what am I carrying` answered "Nothing in the pouch at all" over a
 * row that was really there, which is indistinguishable from the write never
 * having happened. It is read there rather than inside `handleInventory`
 * because that handler is the ALCHEMY tool and the filter above is right: what
 * was missing was a reader for the other kind, not a wider counted list.
 */
export function listPouch(db: Database.Database, cultivatorId: string): PouchEntry[] {
    return allPouchRows(db, cultivatorId).filter(
        entry => entry.kind === 'pill' || entry.kind === 'herb'
    );
}

/** Rated objects being carried. Not counted stock; see {@link listPouch}. */
export function listCarriedArtifacts(db: Database.Database, cultivatorId: string): PouchEntry[] {
    return allPouchRows(db, cultivatorId).filter(entry => entry.kind === 'artifact');
}

function allPouchRows(db: Database.Database, cultivatorId: string): PouchEntry[] {
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

/**
 * The best rated object this cultivator is carrying, or null for none.
 *
 * "Best" is highest `power`, which is the artifact catalog's own ordering and
 * the only ordering it has. Two objects do not stack: `CombatantInput.artifactOrdinal`
 * is documented as A SINGLE object priced as a second body of that rank, and
 * summing two of them would be inventing a rule the catalog does not have.
 *
 * ── WHAT READS THIS, AND WHAT DOES NOT ───────────────────────────────────
 *
 * `combatantFromCultivator` in `combat-manage.ts` is the one place the played
 * game prices the player for a fight, and at the time of writing it passes no
 * `artifactOrdinal` at all. Nor does anything else: `grep -rn artifactOrdinal
 * src/` finds the field's definition and its use inside `assessPower`, and no
 * producer anywhere - not for the player, and not for an NPC through
 * `gatherings.ts` either. So a rated object is currently worth nothing in a
 * confrontation to ANYBODY, which makes this the shape AGENTS.md records under
 * "a module nothing calls is not a feature" rather than the player-versus-NPC
 * one. It is stated here rather than left to be discovered, because an absence
 * nobody wrote down gets mistaken for a design decision, and
 * `admin_manage.grant_item` says the same thing in its own response.
 */
export function carriedArtifact(
    db: Database.Database,
    cultivatorId: string
): { id: string; name: string; power: number } | null {
    const held = listCarriedArtifacts(db, cultivatorId);
    let best: { id: string; name: string; power: number } | null = null;
    for (const entry of held) {
        const record = getArtifact(entry.itemId);
        if (!record || record.power === null) continue;
        if (best === null || record.power > best.power) {
            best = { id: record.id, name: record.name, power: record.power };
        }
    }
    return best;
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
// therefore to change WHERE they are - which is exactly what an ambient gate
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

/**
 * The band the ground gives today, anchored to the ground it actually is.
 *
 * `ambientForLocationOnDay` takes a `density` and says of it: "This is the
 * CENTRE the month's weather varies around. Omit it only when the location
 * genuinely is not known." This call omitted it always, so every square in the
 * game fell through to `impliedDensityFor` - a hash of the run seed and the
 * location string. The catalog has declared a band for every named settlement
 * since it was written and nothing read it here.
 *
 * Found by playing. Nine Peaks is "the deepest vein anyone has kept, and the
 * Ascetic Order sitting on it", and standing in it was arithmetically
 * indistinguishable from standing in a thin market town - which makes the
 * choice of where to cultivate, one of the few real decisions a low cultivator
 * has, into noise.
 *
 * Unknown places still get the guess, and that is correct rather than a
 * fallback: a compound, a site or an admin alias genuinely has no declared
 * ground, and `aliasForAmbient` depends on the implied path continuing to work.
 */
export function currentAmbient(
    db: Database.Database,
    run: Run,
    location: string | null,
    day: number
): AmbientQi {
    const where = effectiveLocationId(db, run.id, location, day);
    const declared = declaredAmbientAt(where);
    return ambientForBlock(
        run.seed,
        where,
        day,
        declared ? { density: densityForBand(declared) } : {}
    );
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
// THE GROUND THEY ARE STANDING ON
//
// `locations.ts` has carried four thresholds - entry, survival, operational,
// mastery - since it was written, calibrated across every place in the world,
// and nothing read them at the point where a cultivator was actually standing
// somewhere. Measured: an ordinal 0 cultivator inside a compound whose survival
// bar is 19 cultivated for seven months, gained a rank, and was never touched.
//
// This is the join. The engine holds no map, so the map layer prices the gap
// and hands the time skip two numbers and a reason.
// ═══════════════════════════════════════════════════════════════════════════

export interface GroundStanding {
    location: LocationRecord;
    consequence: StandingConsequence;
    /** Ready to pass straight into `simulateTimeSkip`. Null when harmless. */
    hostility: { dailyHpFraction: number; inert: boolean; reason: string } | null;
}

/**
 * What the world says about the ground under this cultivator, if it knows the
 * place at all.
 *
 * Null when the world is not running or the location is a road, a hillside or
 * anywhere else the gazetteer does not name - which is the honest answer and
 * exactly the behaviour every caller had before this existed.
 */
export async function groundStandingFor(
    run: Run,
    cultivator: Cultivator
): Promise<GroundStanding | null> {
    const needle = placeKey(cultivator.location ?? '');
    if (needle.length === 0) return null;

    let world: WorldState;
    try {
        world = await worldForRun(run);
    } catch {
        // A run with no world is a run in a game the world layer is not part
        // of. Not an error, and not a reason to fail a seclusion.
        return null;
    }

    const location = world.locations.find(
        l => placeKey(l.name) === needle || l.id === (cultivator.location ?? '')
    );
    if (!location) return null;

    const consequence = standingConsequence(location, {
        realmOrdinal: cultivator.realmOrdinal,
        profile: { specialties: getSpiritRoot(cultivator.spiritRoot).elements.slice() },
        onDay: Math.floor(run.elapsedDays)
    });

    const hostile = consequence.dailyHpFraction > 0 || !consequence.canAct;
    return {
        location,
        consequence,
        hostility: hostile
            ? {
                dailyHpFraction: consequence.dailyHpFraction,
                // Below the operational bar the ground gives up nothing. Alive,
                // standing in the vault, unable to open anything.
                inert: !consequence.canAct,
                reason: hostilityReasonFor(location, consequence)
            }
            : null
    };
}

/** The whole standing, flattened for a tool result. Facts, never a decision. */
export function describeGround(standing: GroundStanding): Record<string, unknown> {
    const { location, consequence } = standing;
    return {
        locationId: location.id,
        name: location.name,
        kind: location.kind,
        qiDensity: location.qiDensity,
        ordinaryBand: ordinaryBandFor(location.qiDensity),
        usableDensity: round4(location.environment.spiritualDensity),
        sealed: location.sealed,
        controllingFactionId: location.controllingFactionId,
        thresholds: consequence.assessment.base,
        // What the bars are AFTER what this cultivator is and is carrying. The
        // affinity system moves survival and operational, so a matching
        // specialist genuinely stands where a generalist dies - and that is
        // only worth having if somebody can see it happen.
        effectiveThresholds: consequence.assessment.effective,
        thresholdsMovedBy: consequence.assessment.applied.map(m => ({
            label: m.label,
            tier: m.tier,
            ordinals: m.offset,
            via: m.via
        })),
        level: consequence.level,
        admitted: consequence.admitted,
        canAct: consequence.canAct,
        rungsShortOfSurvival: consequence.shortOfSurvival,
        dailyHpFraction: round4(consequence.dailyHpFraction),
        environmentMultiplier: round4(consequence.assessment.environmentMultiplier),
        reason: consequence.reason
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// TIME-SKIP PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Absolute end-state the caller must write so that persistence and simulation
 * agree exactly.
 *
 * Three of these fields come from `result.endState` rather than from a delta,
 * and that distinction is load-bearing. `starvationTurns`, `bleedingTurns` and
 * `yearsAtCurrentRealm` all RESET mid-skip - the starvation clock clears the
 * moment there is food again, the bleed clock clears the moment the untreated
 * count drops back under the lethal threshold, the stagnation clock returns to
 * zero on any rank advance - so a delta against the starting value is not
 * merely imprecise, it is uninvertible. The engine reports where they actually
 * ended and this writes that straight down.
 *
 * Everything else is a genuine accumulation and is applied as a delta.
 */
export interface SkipEndState {
    hp: number;
    qi: number;
    satiety: number;
    starvationTurns: number;
    bleedingTurns: number;
    spiritStones: number;
    cultivationProgress: number;
    age: number;
    yearsAtCurrentRealm: number;
    realmOrdinal: number;
}

export function skipEndState(before: Cultivator, result: TimeSkipResult): SkipEndState {
    const d = result.deltas;

    return {
        hp: clampInt(before.hp + d.hp, 0, before.maxHp),
        qi: clampInt(before.qi + d.qi, 0, before.maxQi),
        satiety: clampInt(before.satiety + d.satiety, 0, SATIETY_MAX),
        spiritStones: Math.max(0, Math.round(before.spiritStones + d.spiritStones)),
        cultivationProgress: Math.max(0, before.cultivationProgress + d.cultivationProgress),
        age: Math.max(0, before.age + d.age),
        realmOrdinal: before.realmOrdinal + d.realmOrdinal,
        // Absolute, from the engine. Not derived, not inferred.
        starvationTurns: Math.max(0, Math.round(result.endState.starvationTurns)),
        bleedingTurns: Math.max(0, Math.round(result.endState.bleedingTurns)),
        yearsAtCurrentRealm: Math.max(0, roundYears(result.endState.yearsAtCurrentRealm))
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
// rows is this layer's job - and so is deleting exactly the row the engine
// named afterwards. A toll the engine charged that the database does not show
// is the same failure as a breakthrough the narrator invented.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The claim key a holder's knowledge ABOUT a cultivator is filed under.
 *
 * A convention rather than a schema constraint, because `claim_key` is free
 * text by design. Anything filed here, plus anything whose underlying fact
 * names the cultivator as a subject, is "what this person knows about you" -
 * and that is exactly the set a taken bond removes.
 */
export function cultivatorClaimKey(cultivatorId: string): string {
    return `person:${cultivatorId}`;
}

/** How much a tie mattered, from the stored significance. Never computed from stats. */
const BOND_SIGNIFICANCE_WEIGHT: Record<string, number> = {
    incidental: 1,
    notable: 2,
    defining: 3
};

interface BondRow {
    id: string;
    from_character_id: string;
    to_character_id: string;
    strength: number;
    significance: string;
    type: string;
    label: string;
    holder_name: string | null;
}

/**
 * Everyone who currently knows this cultivator, as real `relationships` rows.
 *
 * Direction matters and is the whole point: these are ties held BY other people
 * ABOUT the cultivator (`to_character_id = cultivator`). The world bible's
 * phrasing is "a person who knew you stops knowing you", so what the crossing
 * reaches for is somebody else's hold on you, not your feelings about them.
 *
 * The holder's display name is resolved across both `cultivators` and
 * `characters`, because a bond may be held by either and the ledger has to be
 * able to say whose it was.
 */
function bondCandidates(db: Database.Database, cultivatorId: string): TollCandidate[] {
    const rows = db
        .prepare(`
            SELECT r.id, r.from_character_id, r.to_character_id, r.strength,
                   r.significance, r.type, r.label,
                   COALESCE(cu.name, ch.name) AS holder_name
            FROM relationships r
            LEFT JOIN cultivators cu ON cu.id = r.from_character_id
            LEFT JOIN characters  ch ON ch.id = r.from_character_id
            WHERE r.to_character_id = ? AND r.active = 1
            ORDER BY r.id ASC
        `)
        .all(cultivatorId) as BondRow[];

    return rows.map(row => ({
        kind: 'bond' as const,
        id: row.id,
        label: `${row.holder_name ?? row.from_character_id}, ${row.label || row.type}`,
        // Significance is a stored word; strength is how consequential the tie
        // is. Both are written by whoever recorded the bond and neither is
        // derived from anyone's realm.
        weight: (BOND_SIGNIFICANCE_WEIGHT[row.significance] ?? 1) * (0.5 + row.strength)
    }));
}

interface MemoryRow {
    id: string;
    statement: string;
    confidence: number;
    source_kind: string;
    claim_key: string;
}

/**
 * Memories the cultivator is actually holding, as real `knowledge_records`.
 *
 * Restricted to positive first-person stances held by a character: `ignorant`
 * is the absence of a memory rather than one, and a `public` holder is a body
 * of opinion, not somebody's recollection. A witnessed memory weighs more than
 * a reported one because being there is what makes it yours.
 */
function memoryCandidates(db: Database.Database, cultivatorId: string): TollCandidate[] {
    const rows = db
        .prepare(`
            SELECT id, statement, confidence, source_kind, claim_key
            FROM knowledge_records
            WHERE holder_id = ?
              AND holder_kind = 'character'
              AND superseded = 0
              AND stance IN ('knows', 'believes')
            ORDER BY id ASC
        `)
        .all(cultivatorId) as MemoryRow[];

    return rows.map(row => ({
        kind: 'memory' as const,
        id: row.id,
        label: row.statement.length > 120 ? `${row.statement.slice(0, 117)}...` : row.statement,
        weight: 0.5 + row.confidence + (row.source_kind === 'witnessed' ? 0.5 : 0)
    }));
}

/**
 * What this run has that a realm boundary could take.
 *
 * Every candidate is a real row with a real id, so `persistToll` can act on
 * precisely what was named. Weights say how much a thing MATTERED - the price
 * is paid in what mattered, so higher is more likely to go.
 *
 * All three kinds are drawn from tables: `cultivator_techniques` for arts,
 * `relationships` for bonds, `knowledge_records` for memories. A run that has
 * accumulated none of them offers nothing, and the engine correctly returns
 * `nothing_left` - the Hollow Court condition, arriving early.
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

    candidates.push(...bondCandidates(repos.db, cultivator.id));
    candidates.push(...memoryCandidates(repos.db, cultivator.id));

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

// ─────────────────────────────────────────────────────────────────────────
// TAKING IT
//
// These are direct writes against the social layer's tables because that layer
// has no repository yet. They belong in a `social.repo.ts` the moment one
// exists; the SQL is kept small and the transitions are computed by the social
// engine's own functions so the behaviour moves across unchanged.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sever a bond: the person who knew this cultivator stops knowing them.
 *
 * Two writes, because the setting is specific about which half goes.
 *
 * 1. THE KNOWLEDGE IS DELETED. Every positive-stance thing the holder held
 *    about the cultivator is removed, and a single `ignorant` row is written in
 *    its place - the knowledge layer's own documented way to say "has no idea",
 *    as distinct from having no record at all. This is the honest
 *    representation of "a person who knew you stops knowing you": what the
 *    crossing takes is their hold on you, and the row that used to carry it is
 *    genuinely gone.
 *
 * 2. THE TIE IS ENDED, NOT DELETED, via the social engine's own
 *    `endRelationship`. `relationships.ts` is explicit that ended ties are
 *    kept - "a dead master is still a master" - and here that contract does
 *    real work: the record stays, referring to somebody the holder can no
 *    longer account for. That residue is the point. The bond itself is gone:
 *    the row is inactive, reasoned `toll`, and no longer answers any live query.
 *
 * The world's `world_facts` are untouched throughout. The thing still happened;
 * this person simply no longer holds it. The world remembers and they do not,
 * which is the shape of the whole setting.
 */
export function severBond(
    db: Database.Database,
    cultivatorId: string,
    cultivatorName: string,
    relationshipId: string,
    onDay: number
): { holderId: string; knowledgeRowsDeleted: number; relationshipEnded: boolean } | null {
    const row = db
        .prepare(`
            SELECT id, from_character_id, active, ended_reason, ended_on_day, last_updated_on_day
            FROM relationships WHERE id = ?
        `)
        .get(relationshipId) as
        | {
            id: string;
            from_character_id: string;
            active: number;
            ended_reason: string | null;
            ended_on_day: number | null;
            last_updated_on_day: number;
        }
        | undefined;
    if (!row) return null;

    const holderId = row.from_character_id;

    // The transition is the social engine's to compute, not this layer's.
    const ended = endRelationship(
        {
            active: row.active === 1,
            endedReason: row.ended_reason,
            endedOnDay: row.ended_on_day,
            lastUpdatedOnDay: row.last_updated_on_day
        } as Relationship,
        'toll',
        onDay
    );

    db.prepare(`
        UPDATE relationships
        SET active = ?, ended_reason = ?, ended_on_day = ?, last_updated_on_day = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(
        ended.active ? 1 : 0,
        ended.endedReason,
        ended.endedOnDay,
        ended.lastUpdatedOnDay,
        relationshipId
    );

    // Everything this holder held about the cultivator: filed under the
    // person's claim key, or hanging off a fact that names them as a subject.
    const deleted = db
        .prepare(`
            DELETE FROM knowledge_records
            WHERE holder_id = @holderId
              AND stance != 'ignorant'
              AND (
                claim_key = @claimKey
                OR fact_id IN (
                    SELECT fact_id FROM world_fact_subjects WHERE character_id = @subjectId
                )
              )
        `)
        .run({
            holderId,
            claimKey: cultivatorClaimKey(cultivatorId),
            subjectId: cultivatorId
        }).changes;

    // The positive assertion that they no longer know, rather than a silent
    // absence. `ignorant` exists precisely so this is writable.
    const forgetting = recordKnowledge({
        holderId,
        claimKey: cultivatorClaimKey(cultivatorId),
        stance: 'ignorant',
        statement: `Does not know who ${cultivatorName} is.`,
        onDay,
        source: {
            kind: 'assumed',
            note: 'The crossing took this bond at a realm boundary. There is no memory of it to draw on.'
        },
        confidence: 1,
        tags: ['toll', 'taken_bond']
    });

    db.prepare(`
        INSERT INTO knowledge_records (
            id, holder_id, holder_kind, claim_key, fact_id, stance, statement, detail,
            source_kind, source_from_holder_id, source_via_record_id, source_note,
            acquired_on_day, confidence, tags, superseded
        ) VALUES (
            @id, @holderId, @holderKind, @claimKey, NULL, @stance, @statement, @detail,
            @sourceKind, NULL, NULL, @sourceNote,
            @acquiredOnDay, @confidence, @tags, 0
        )
        ON CONFLICT(id) DO NOTHING
    `).run({
        id: forgetting.id,
        holderId: forgetting.holderId,
        holderKind: forgetting.holderKind,
        claimKey: forgetting.claimKey,
        stance: forgetting.stance,
        statement: forgetting.statement,
        detail: JSON.stringify(forgetting.detail),
        sourceKind: forgetting.source.kind,
        sourceNote: forgetting.source.note ?? '',
        acquiredOnDay: forgetting.acquiredOnDay,
        confidence: forgetting.confidence,
        tags: JSON.stringify(forgetting.tags)
    });

    return { holderId, knowledgeRowsDeleted: deleted, relationshipEnded: true };
}

/**
 * Take a memory: the record is deleted outright.
 *
 * No tombstone and no `superseded` flag, because superseding is for changing
 * your mind and this is not that. The underlying `world_facts` row survives
 * untouched - the thing still happened, and the cultivator simply no longer
 * holds it. Anyone else who witnessed it still does, which is how the player
 * finds out what they lost.
 */
export function forgetMemory(db: Database.Database, knowledgeRecordId: string): boolean {
    const changes = db
        .prepare('DELETE FROM knowledge_records WHERE id = ?')
        .run(knowledgeRecordId).changes;
    return changes > 0;
}

/**
 * Write down what the crossing took, and actually take it.
 *
 * THE INVARIANT: if the ledger says it was taken, it is gone from the database.
 * A ledger entry claiming somebody's brother was taken while nothing was
 * removed is an outcome asserted without a state change, which is the one thing
 * this engine exists to make impossible.
 *
 * `takenAll` is the authoritative list and the ONLY field this reads. `taken`
 * is a convenience view of `takenAll[0]` and using it to decide what to delete
 * would silently under-report the ascension crossing, which collects the
 * cultivator's whole remaining ledger at once rather than one instalment. Every
 * entry is applied, every application is reported, and an entry that could not
 * be applied is surfaced rather than swallowed - an unapplied take is a bug,
 * not a game outcome.
 *
 * MUST be called inside the caller's transaction: the rank advance and the
 * price are one event, and a crossing that recorded the rank but not the cost
 * would be exactly the drift this guards against.
 */
export interface TollApplication {
    /** True when every entry in `takenAll` was actually removed or ended. */
    applied: boolean;
    /** One entry per thing taken, in the order the engine listed them. */
    details: Array<Record<string, unknown>>;
    /**
     * Back-compat single view, mirroring the engine's own `taken`/`takenAll`
     * pairing: `details[0] ?? null`. Never use it to decide what happened.
     */
    detail: Record<string, unknown> | null;
}

export function persistToll(
    repos: CultivationRepos,
    run: Run,
    cultivatorId: string,
    toll: TollResult
): TollApplication {
    const onDay = Math.floor(run.elapsedDays);

    // One ledger row per thing taken, so the ledger reads as an itemised
    // account rather than a summary. A charge that took nothing still gets a
    // row: "nothing was taken at this boundary" is worth being able to
    // look up years later.
    const entries = toll.takenAll.length > 0 ? toll.takenAll : [null];
    for (const taken of entries) {
        repos.db.prepare(`
            INSERT INTO cultivation_tolls (
                run_id, cultivator_id, from_ordinal, to_ordinal, boundary_index,
                outcome, risk, roll, taken_kind, taken_id, taken_label, taken_reason,
                narration_hint, charged_on_day
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            run.id, cultivatorId, toll.fromOrdinal, toll.toOrdinal, toll.boundaryIndex,
            toll.outcome, toll.risk, toll.roll,
            taken?.kind ?? null, taken?.id ?? null,
            taken?.label ?? null, taken?.reason ?? null,
            toll.narrationHint, run.elapsedDays
        );
    }

    if (toll.takenAll.length === 0) {
        return { applied: true, details: [], detail: null };
    }

    const details: Array<Record<string, unknown>> = [];
    let allApplied = true;

    for (const taken of toll.takenAll) {
        const outcome = applyOneTake(repos, cultivatorId, taken, onDay);
        if (!outcome.applied) allApplied = false;
        details.push(outcome.detail);
    }

    return { applied: allApplied, details, detail: details[0] ?? null };
}

/** Remove exactly one named thing. Every branch is a real write. */
function applyOneTake(
    repos: CultivationRepos,
    cultivatorId: string,
    taken: TollTaken,
    onDay: number
): { applied: boolean; detail: Record<string, unknown> } {
    switch (taken.kind) {
        case 'technique': {
            // Gone as if never learned. The join row is deleted and the
            // denormalised list on the cultivator is resynced with it.
            if (!taken.id) {
                return { applied: false, detail: { kind: 'technique', missingId: true } };
            }
            const forgotten = repos.techniques.forget(cultivatorId, taken.id);
            return {
                applied: forgotten,
                detail: { kind: 'technique', techniqueId: taken.id, label: taken.label, forgotten }
            };
        }

        case 'bond': {
            if (!taken.id) {
                return { applied: false, detail: { kind: 'bond', missingId: true } };
            }
            const subject = repos.cultivators.getById(cultivatorId);
            const severed = severBond(
                repos.db,
                cultivatorId,
                subject?.name ?? 'them',
                taken.id,
                onDay
            );
            return {
                applied: severed !== null,
                detail: severed
                    ? { kind: 'bond', relationshipId: taken.id, label: taken.label, ...severed }
                    : { kind: 'bond', relationshipId: taken.id, label: taken.label, missing: true }
            };
        }

        case 'memory': {
            if (!taken.id) {
                return { applied: false, detail: { kind: 'memory', missingId: true } };
            }
            const removed = forgetMemory(repos.db, taken.id);
            return {
                applied: removed,
                detail: { kind: 'memory', knowledgeRecordId: taken.id, label: taken.label, removed }
            };
        }

        case 'name': {
            // A name is not a row that can be deleted, so it is marked taken.
            // Thereafter people have to be told it, every time - and the engine
            // will not charge it twice, because `nameAlreadyTaken` reads this.
            writeFlag(repos.db, cultivatorId, FLAG_NAME_TAKEN, '1');
            return { applied: true, detail: { kind: 'name', label: taken.label, nameTaken: true } };
        }
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

/** Every price this cultivator has paid, oldest first. */
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
 * Record the foundation the engine laid, on the cultivator row itself.
 *
 * `BreakthroughResult.foundationEstablished` is documented as something the
 * caller must persist, and this is that. `establishFoundation` refuses to
 * overwrite an existing foundation, so a repeated or out-of-order write cannot
 * upgrade a cracked foundation into a flawless one.
 */
/**
 * Record the result of the last crossing.
 *
 * Both non-'none' values are permanent and load-bearing, so
 * `recordImmortalStatus` refuses to overwrite an existing one: a
 * 'false_immortal' is precisely what bars any further attempt, and a write that
 * could clear it would let the Lid open twice for the same name.
 */
export function persistImmortalStatus(
    repos: CultivationRepos,
    cultivatorId: string,
    status: ImmortalStatus
): void {
    repos.cultivators.recordImmortalStatus(cultivatorId, status);
}

export function persistFoundation(
    repos: CultivationRepos,
    cultivatorId: string,
    quality: FoundationQuality
): void {
    repos.cultivators.establishFoundation(cultivatorId, quality);
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

/**
 * Record an admin action and flag its run.
 *
 * The audit row is written FIRST and is the authoritative justification: it
 * says what was done, to what, with what arguments. `runs.admin` is then set as
 * an index over that fact, so the ledger's exclusion is a single indexed read
 * rather than a LIKE scan across every audit row in the campaign. Both happen
 * in one transaction, so a flagged run always has the log entry that explains
 * it, and a logged action always leaves its run flagged.
 */
export function writeAdminAudit(
    repos: CultivationRepos,
    action: string,
    runId: string | null,
    details: Record<string, unknown>
): void {
    const write = repos.db.transaction(() => {
        repos.audit.create({
            action: `${ADMIN_AUDIT_PREFIX}${action}`,
            actorId: 'admin',
            targetId: runId,
            details,
            timestamp: new Date().toISOString()
        });
        if (runId) {
            // Deliberately not gated on status: a run that used admin stays
            // flagged after it closes, which is the entire point.
            repos.db.prepare('UPDATE runs SET admin = 1 WHERE id = ?').run(runId);
        }
    });
    write();
}

export function isAdminRun(db: Database.Database, runId: string): boolean {
    const row = db.prepare('SELECT admin FROM runs WHERE id = ?').get(runId) as
        | { admin: number }
        | undefined;
    return row !== undefined && row.admin === 1;
}

export function adminRunIds(db: Database.Database): Set<string> {
    const rows = db.prepare('SELECT id FROM runs WHERE admin = 1').all() as { id: string }[];
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
        // The third dealt thing. What the family put behind this life, stated
        // as a position rather than an assessment of it.
        origin: {
            ...openingPosition(cultivator.origin),
            provisionedYears: round2(provisionedYears(cultivator.spiritStones)),
            note: 'Where this life started. It confers no realm, no rank, no admission and no progress.'
        },
        foundation: cultivator.foundationQuality,
        immortalStatus: cultivator.immortalStatus,
        progress: {
            current: round2(cultivator.cultivationProgress),
            required,
            remaining: required === null ? null : round2(progressRemaining(cultivator)),
            fraction: required !== null && required > 0
                ? round4(cultivator.cultivationProgress / required)
                : 1,
            breakthroughEligible: isBreakthroughEligible(cultivator)
        },
        vitals: {
            hp: cultivator.hp,
            maxHp: cultivator.maxHp,
            qi: cultivator.qi,
            maxQi: cultivator.maxQi,
            satiety: cultivator.satiety,
            starvationTurns: cultivator.starvationTurns,
            bleedingTurns: cultivator.bleedingTurns,
            onGrainAbstinence: isOnGrainAbstinence(repos.db, cultivator.id, day)
        },
        mortality: {
            age: round2(cultivator.age),
            lifespanRemaining: round2(
                lifespanForOrdinal(cultivator.realmOrdinal) - cultivator.age
            ),
            yearsAtCurrentRealm: round2(cultivator.yearsAtCurrentRealm),
            untreatedInjuries: untreated,
            // NOT a mortality figure any more, and it is left in this block
            // because the panel is where a narrator looks for "what is wrong
            // with this person". A channel wound is a torn muscle: it impairs
            // and it does not kill. See `docs/world/climbing/injuries.md`.
            crippledInjuryThreshold: CRIPPLING_UNTREATED_INJURIES,
            atCrippledInjuryThreshold: untreated >= CRIPPLING_UNTREATED_INJURIES,
            // How long the channels have been open, replacing a countdown to a
            // death that no longer happens. A narrator handed a countdown will
            // write a countdown.
            daysChannelsOpen: Math.max(0, Math.round(cultivator.bleedingTurns)),
            injuryRatePenalty: round4(
                aggregateInjuryPenalties(cultivator.injuries).cultivationPenalty
            )
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
        breakthroughPenalty: injury.breakthroughPenalty,
        // The field that says WHICH wound this is, and the only one the summary
        // used to drop. Two things wanted it back. A narrator handed a
        // `severity` and a sentence was being asked to describe a severed
        // meridian without being told it was one, when the catalog has a name, a
        // permanence and a stated treatment for it. And a summary missing this
        // is not a wound any more - it is a wound of its severity, which is
        // exactly the reconstruction-from-a-count that `woundsCarriedBy` exists
        // to apologise for - so nothing downstream could put a resolver's wound
        // onto a record without inventing the half that had been thrown away.
        // With it, this projection is lossless and `InjurySchema` parses it.
        woundType: injury.woundType
    };
}

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
    return Math.round(n * 10_000) / 10_000;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTS
// The row is the state; the catalog is the world. Both are read at request
// time and neither is copied into the other beyond the seeding step.
// ═══════════════════════════════════════════════════════════════════════════

/** Catalog facts about a sect that the `sects` table does not store. */
export function sectCatalogFacts(sectId: string): Record<string, unknown> | null {
    const entry = getSect(sectId);
    if (!entry) return null;
    const admission = getSectAdmission(sectId);
    const compound = entry.compound;

    return {
        territory: entry.territory,
        recruits: entry.recruits,
        specialities: entry.specialities,
        teaches: entry.teaches,
        signatureTechniqueId: entry.signatureTechniqueId,
        rivals: entry.rivals,
        compound: {
            ...compound,
            // The fraction of its own inheritance a sect can still operate.
            // The clearest single number for how late this age is.
            formationIntegrity:
                compound.formationNodesTotal === 0
                    ? 0
                    : round4(compound.formationNodesLit / compound.formationNodesTotal)
        },
        admission: admission
            ? {
                minOrdinal: admission.minOrdinal,
                minMight: admission.minMight ?? null,
                minInsight: admission.minInsight ?? null,
                minCharm: admission.minCharm ?? null,
                preferredRoots: admission.preferredRoots,
                requirement: admission.requirement
            }
            : null
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// UNDERSTANDING: ACCESS ASSEMBLED FROM REAL ROWS
//
// `discoverableInsights` is a hard filter, not a modifier: a comprehension with
// no access behind it never enters the candidate set, so it can never be
// rolled. The engine holds no library and no map, which means the whole of that
// filter is decided HERE, by what the database actually shows. A caller that
// omits the context gets a cultivator who can reach their own root and nothing
// else - which is correct for a hermit and wrong for an inner disciple, so the
// assembly has to be shared rather than repeated per tool.
//
// Nothing in this section consults affinity. Affinity is the slope and access
// is the filter; see `dao.ts` for why the two must never be joined.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Site kinds that have something to teach, and what they open.
 *
 * The keys on the right are `understanding.ts`'s own LOCATION_OPENINGS tags.
 * Mapping is one-way and explicit rather than free-text, so a site kind that
 * teaches nothing teaches nothing rather than quietly matching a tag.
 */
const SITE_KIND_TAGS: Readonly<Record<string, string>> = {
    grave: 'sealed_tomb',
    cave: 'deep_cave',
    ruin: 'ancient_battlefield',
    scar: 'tribulation_scar'
};

/**
 * Tags on the ground the cultivator is standing on.
 *
 * Only DISCOVERED sites count. A ruin nobody has found is not something you are
 * standing near enough to comprehend; it is a ruin nobody has found.
 */
export function siteTagsAt(
    db: Database.Database,
    runId: string | null,
    location: string | null
): string[] {
    if (!location) return [];
    const rows = db
        .prepare(`
            SELECT DISTINCT kind FROM cultivation_sites
            WHERE discovered = 1 AND location = ?
              AND (run_id IS NULL OR run_id = ?)
        `)
        .all(location, runId ?? null) as { kind: string }[];

    const tags: string[] = [];
    for (const row of rows) {
        const tag = SITE_KIND_TAGS[row.kind];
        if (tag && !tags.includes(tag)) tags.push(tag);
    }
    return tags;
}

export interface DiscoveryAssembly {
    /** Shaped for `simulateTimeSkip`'s `understanding` context. */
    context: UnderstandingContext;
    /** What each source is, so a tool can say where a comprehension came from. */
    sources: { kind: string; label: string; id: string | null }[];
}

/** The subset of `DiscoveryContext` a time skip accepts. */
type UnderstandingContext = Omit<DiscoveryContext, 'survived'>;

/**
 * Everything this cultivator is currently near enough to comprehend, assembled
 * from rows that exist.
 *
 * Manuals are the arts they have actually learned - a text on the shelf they
 * cannot read is not listed here and grants nothing. A teacher is a sect that
 * has admitted them and has a signature art to pass on. A site is ground
 * somebody has already found.
 */
export function discoveryContextFor(
    repos: CultivationRepos,
    cultivator: Cultivator,
    options: { runId?: string | null; practisingTechniqueId?: string | null } = {}
): DiscoveryAssembly {
    const sources: DiscoveryAssembly['sources'] = [];

    const readableManuals: ExposureInput[] = [];
    for (const techniqueId of cultivator.knownTechniques) {
        const catalog = getTechnique(techniqueId);
        if (!catalog || catalog.element === null) continue;
        readableManuals.push({
            element: catalog.element,
            label: catalog.name,
            id: catalog.id
        });
        sources.push({ kind: 'manual', label: catalog.name, id: catalog.id });
    }

    const teachers: ExposureInput[] = [];
    const membership = repos.sects.getMembership(cultivator.id);
    if (membership) {
        const entry = getSect(membership.sectId);
        const signature = entry?.signatureTechniqueId
            ? getTechnique(entry.signatureTechniqueId)
            : undefined;
        if (entry && signature && signature.element !== null) {
            const label = `${entry.name}, ${membership.rankTitle}`;
            teachers.push({ element: signature.element, label, id: entry.id });
            sources.push({ kind: 'teacher', label, id: entry.id });
        }
    }

    const locationTags = siteTagsAt(
        repos.db,
        options.runId ?? cultivator.runId ?? null,
        cultivator.location
    );
    for (const tag of locationTags) {
        sources.push({ kind: 'site', label: tag.replace(/_/g, ' '), id: tag });
    }

    // ── GROUND THAT TEACHES A ROAD, for the player ──
    //
    // Twenty authored grounds each teach one domain. The world layer reaches
    // them through `roadsInReachOf`; the player reached none of them, because
    // this function built its location exposure from `siteTagsAt` - the
    // `cultivation_sites` table - and a dao ground is a place in the region
    // catalog. So the dao gate could be satisfied by every NPC in the world
    // and by nobody holding the controller, which is the split this repo keeps
    // finding and AGENTS.md now names first.
    //
    // Reachability is `howSomebodyStandsToAGround`, which is the WORLD'S OWN
    // rule and not a second copy of it. It used to be a second copy - the
    // floor, the membership check and the standing check were written out again
    // here against the catalog while `daoGroundsInReachOf` ran the same three
    // against the location table - and two copies of a rule is how the world's
    // answer and the player's drift apart. Now the refusal a player reads, the
    // exposure they get and the roads an NPC walks all come off one function.
    const daoGrounds: NonNullable<DiscoveryContext['daoGrounds']>[number][] = [];
    // ── WHICH PROVINCE THEY ARE ACTUALLY STANDING IN ─────────────────────
    //
    // `regionIdOfPlace` reads the region gazetteer, and A DAO GROUND IS NOT IN
    // IT: the seeder plants these as world locations under a region node, so
    // the catalog has never heard of "The Glass Field". A cultivator who had
    // walked to one therefore resolved to no province at all and got NOTHING -
    // the one place in the world guaranteed to teach them was the one place
    // that could not. The catalog's own rows answer for themselves.
    const standingRegion = regionIdOfPlace(cultivator.location)
        ?? daoGroundNamed(cultivator.location)?.regionId;
    if (standingRegion) {
        const house = cultivator.sectId ? getSect(cultivator.sectId) : undefined;
        const who: SomebodyStanding = {
            ordinal: cultivator.realmOrdinal,
            regionCatalogId: standingRegion,
            factionId: cultivator.sectId,
            // A rank INDEX, from the house's own ladder, because
            // `standingRequired` is an index and `sectRank` is the title.
            factionRankIndex: house && cultivator.sectRank
                ? house.ranks.indexOf(cultivator.sectRank)
                : -1
        };

        for (const ground of daoGroundsIn(standingRegion)) {
            // A buried ground reads as unfound from here, which is the honest
            // answer for a caller holding no `WorldState`: this surface cannot
            // see whether the world has dug one out. The played game asks the
            // location table, where `discovered` actually lives.
            const stands = howSomebodyStandsToAGround(
                groundFromCatalogRow(ground),
                who
            );
            if (!stands.inReach) continue;
            daoGrounds.push({
                domain: ground.domain,
                subject: ground.subject,
                label: ground.name,
                id: ground.id,
                // HOW they got at it, which is what the road costs them in
                // years - see `what-a-road-in-reach-costs-to-walk.ts`. A
                // carving is a text and is cheap; a cliff nobody is explaining
                // is not. Without this every place a player can reach priced as
                // open ground, which is the dearest, and the three carvings
                // would have been forty-year sits instead of readings.
                how: howARoadCameFrom(ground.access)
            });
            sources.push({ kind: 'site', label: ground.name, id: ground.id });
        }
    }

    const practised = options.practisingTechniqueId
        ? getTechnique(options.practisingTechniqueId)
        : undefined;

    // Where they were born, folded into the same set. An origin has no access
    // mechanism of its own: it contributes teachers, readable manuals and at
    // most one tradition to the context that already exists, and every one of
    // them becomes an ordinary AccessSource with a real label. Nine births in
    // ten contribute nothing at all, and those cultivators reach their own
    // spirit root and nothing else however long they sit.
    const context = withOriginAccess(cultivator.origin, {
        readableManuals,
        teachers,
        locationTags,
        ...(daoGrounds.length > 0 ? { daoGrounds } : {}),
        techniqueElement: practised?.element ?? null
    });
    const born = originDiscoveryContext(cultivator.origin);
    for (const teacher of born.teachers ?? []) {
        sources.push({ kind: 'teacher', label: teacher.label, id: teacher.id ?? null });
    }
    for (const manual of born.readableManuals ?? []) {
        sources.push({ kind: 'manual', label: manual.label, id: manual.id ?? null });
    }
    if (born.tradition) {
        sources.push({
            kind: 'tradition',
            label: born.tradition.label,
            id: born.tradition.id ?? null
        });
    }

    return { context, sources };
}

/**
 * Write comprehension back.
 *
 * The one place understanding is persisted. `insights` and `achievements` are
 * whole-array columns on the cultivator row, so the caller hands the merged
 * arrays the engine produced rather than a delta - and the schema's provenance
 * requirement fails loudly at this boundary if anything untraceable got in.
 */
export function persistUnderstanding(
    repos: CultivationRepos,
    cultivatorId: string,
    gained: readonly Insight[],
    achievements: readonly Achievement[]
): { insights: number; achievements: number } {
    if (gained.length === 0 && achievements.length === 0) {
        return { insights: 0, achievements: 0 };
    }
    const existing = repos.cultivators.getById(cultivatorId);
    if (!existing) return { insights: 0, achievements: 0 };

    // Keyed by (domain, subject): a repeat is a deepening, not a duplicate.
    // The engine already merged them; this only has to reconcile the row it
    // was handed against the row as it stands now.
    const merged = [...existing.insights];
    for (const insight of gained) {
        const index = merged.findIndex(
            i => i.domain === insight.domain && i.subject === insight.subject
        );
        if (index === -1) merged.push(insight);
        else merged[index] = insight;
    }

    const knownAchievements = new Set(existing.achievements.map(a => a.id));
    const mergedAchievements = [
        ...existing.achievements,
        ...achievements.filter(a => !knownAchievements.has(a.id))
    ];

    repos.cultivators.update(cultivatorId, {
        insights: merged,
        achievements: mergedAchievements
    });

    return {
        insights: merged.length - existing.insights.length,
        achievements: mergedAchievements.length - existing.achievements.length
    };
}

/**
 * File a temporal phenomenon as a belief.
 *
 * A vision has no fact behind it and may never have one, so it is written to
 * the knowledge layer with `fact_id` NULL and a `divined` source. Nothing reads
 * these back as a bonus: they grant information and never capability, so
 * dropping them would silently delete content rather than silently grant it -
 * which is why they are written here rather than left to the caller.
 */
export function persistVisions(
    db: Database.Database,
    visions: readonly VisionSeed[]
): number {
    return persistBeliefs(db, visions);
}

/**
 * Write beliefs to the knowledge layer.
 *
 * The one insert path for anything a cultivator comes to hold outside the
 * existence gate in `web/knowledge.ts`. Ids are stable and derived from the
 * content, so re-recording the same belief on the same day is idempotent and
 * a genuinely new acquisition is a new row - which is correct, because how
 * somebody came to hold something twice is worth keeping.
 */
export function persistBeliefs(
    db: Database.Database,
    beliefs: readonly KnowledgeInput[]
): number {
    if (beliefs.length === 0) return 0;
    const insert = db.prepare(`
        INSERT INTO knowledge_records (
            id, holder_id, holder_kind, claim_key, fact_id, stance, statement, detail,
            source_kind, source_from_holder_id, source_via_record_id, source_note,
            acquired_on_day, confidence, tags, superseded
        ) VALUES (
            @id, @holderId, @holderKind, @claimKey, NULL, @stance, @statement, @detail,
            @sourceKind, NULL, NULL, @sourceNote,
            @acquiredOnDay, @confidence, @tags, 0
        )
        ON CONFLICT(id) DO NOTHING
    `);

    let written = 0;
    for (const seed of beliefs) {
        const record = recordKnowledge(seed);
        const result = insert.run({
            id: record.id,
            holderId: record.holderId,
            holderKind: record.holderKind,
            claimKey: record.claimKey,
            stance: record.stance,
            statement: record.statement,
            detail: JSON.stringify(record.detail),
            sourceKind: record.source.kind,
            sourceNote: record.source.note ?? '',
            acquiredOnDay: record.acquiredOnDay,
            confidence: record.confidence,
            tags: JSON.stringify(record.tags)
        });
        written += result.changes;
    }
    return written;
}

/** Compact, narrator-facing view of one comprehension. */
export function summariseInsight(insight: Insight): Record<string, unknown> {
    return {
        id: insight.id,
        name: insightName(insight),
        domain: insight.domain,
        subject: insight.subject,
        degree: insight.degree,
        degreeName: DEGREE_NAMES[insight.degree],
        // Provenance is the point: a comprehension that cannot say where it
        // came from is not supposed to be representable.
        account: insight.provenance.account,
        onDay: insight.provenance.onDay,
        deepenedBy: insight.provenance.deepenedBy.length
    };
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
