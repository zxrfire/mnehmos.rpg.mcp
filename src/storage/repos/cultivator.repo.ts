import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
    Cultivator,
    CultivatorSchema,
    DeathCause,
    Injury,
    InjurySchema,
    InjurySeverity,
    InjurySource,
    INJURY_WEIGHTS,
    SATIETY_MAX
} from '../../schema/cultivation.js';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';

/**
 * Row shape of `cultivators`. Declared explicitly rather than inferred so a
 * column rename in the migration fails compilation here instead of silently
 * producing `undefined` at the schema boundary.
 */
interface CultivatorRow {
    id: string;
    run_id: string | null;
    name: string;
    kind: string;
    spirit_root: string;
    attributes: string;
    realm_ordinal: number;
    cultivation_progress: number;
    hp: number;
    max_hp: number;
    qi: number;
    max_qi: number;
    satiety: number;
    starvation_turns: number;
    age: number;
    years_at_current_realm: number;
    spirit_stones: number;
    sect_id: string | null;
    sect_rank: string | null;
    feuds: string;
    known_techniques: string;
    alive: number;
    death_cause: string | null;
    died_on_turn: number | null;
    created_at: string;
    updated_at: string;
}

interface InjuryRow {
    id: string;
    cultivator_id: string;
    severity: string;
    source: string;
    description: string;
    sustained_on_turn: number;
    treated: number;
    cultivation_penalty: number;
    breakthrough_penalty: number;
    treated_on_turn: number | null;
    created_at: string;
}

/** Creation input: schema defaults fill everything not supplied. */
export type CreateCultivatorInput = Omit<Partial<Cultivator>, 'id' | 'name' | 'spiritRoot' | 'attributes' | 'hp' | 'maxHp' | 'qi' | 'maxQi'>
    & Pick<Cultivator, 'id' | 'name' | 'spiritRoot' | 'attributes' | 'hp' | 'maxHp' | 'qi' | 'maxQi'>;

/**
 * A new injury. Penalties are optional: when omitted they are derived from
 * INJURY_WEIGHTS, so callers cannot accidentally invent a severity curve of
 * their own and diverge from the balance table.
 */
export interface AddInjuryInput {
    id?: string;
    severity: InjurySeverity;
    source: InjurySource;
    description: string;
    sustainedOnTurn: number;
    cultivationPenalty?: number;
    breakthroughPenalty?: number;
    treated?: boolean;
}

/**
 * Signed adjustments to the vitals the engine moves every turn. Every field is
 * a delta, not a target: two systems that both spend qi in the same turn must
 * compose, and read-modify-write from separate call sites does not.
 */
export interface CultivatorDeltas {
    hp?: number;
    qi?: number;
    satiety?: number;
    starvationTurns?: number;
    spiritStones?: number;
    cultivationProgress?: number;
    age?: number;
    yearsAtCurrentRealm?: number;
}

export interface ListCultivatorsFilter {
    runId?: string;
    sectId?: string;
    kind?: Cultivator['kind'];
    alive?: boolean;
}

/**
 * Persistence for cultivators and their injuries.
 *
 * Every read maps back through CultivatorSchema and every write validates
 * before touching the database, so a row that has drifted out of contract
 * fails loudly at the boundary instead of poisoning a breakthrough
 * calculation forty tool calls later.
 *
 * Statements are prepared once per repository instance. That requires
 * migrate() to have run before construction, which is true everywhere a repo
 * is built (getDb() migrates on open).
 */
export class CultivatorRepository {
    private readonly insertStmt: Database.Statement;
    private readonly updateStmt: Database.Statement;
    private readonly selectByIdStmt: Database.Statement;
    private readonly deleteStmt: Database.Statement;
    private readonly insertInjuryStmt: Database.Statement;
    private readonly selectInjuriesStmt: Database.Statement;
    private readonly selectUntreatedInjuriesStmt: Database.Statement;
    private readonly countUntreatedStmt: Database.Statement;
    private readonly treatInjuryStmt: Database.Statement;
    private readonly selectInjuryByIdStmt: Database.Statement;

    constructor(private db: Database.Database) {
        this.insertStmt = db.prepare(`
            INSERT INTO cultivators (
                id, run_id, name, kind, spirit_root, attributes,
                realm_ordinal, cultivation_progress,
                hp, max_hp, qi, max_qi, satiety, starvation_turns,
                age, years_at_current_realm,
                spirit_stones, sect_id, sect_rank, feuds, known_techniques,
                alive, death_cause, died_on_turn,
                created_at, updated_at
            ) VALUES (
                @id, @runId, @name, @kind, @spiritRoot, @attributes,
                @realmOrdinal, @cultivationProgress,
                @hp, @maxHp, @qi, @maxQi, @satiety, @starvationTurns,
                @age, @yearsAtCurrentRealm,
                @spiritStones, @sectId, @sectRank, @feuds, @knownTechniques,
                @alive, @deathCause, @diedOnTurn,
                @createdAt, @updatedAt
            )
        `);

        this.updateStmt = db.prepare(`
            UPDATE cultivators SET
                run_id = @runId, name = @name, kind = @kind,
                spirit_root = @spiritRoot, attributes = @attributes,
                realm_ordinal = @realmOrdinal, cultivation_progress = @cultivationProgress,
                hp = @hp, max_hp = @maxHp, qi = @qi, max_qi = @maxQi,
                satiety = @satiety, starvation_turns = @starvationTurns,
                age = @age, years_at_current_realm = @yearsAtCurrentRealm,
                spirit_stones = @spiritStones, sect_id = @sectId, sect_rank = @sectRank,
                feuds = @feuds, known_techniques = @knownTechniques,
                alive = @alive, death_cause = @deathCause, died_on_turn = @diedOnTurn,
                updated_at = @updatedAt
            WHERE id = @id
        `);

        this.selectByIdStmt = db.prepare('SELECT * FROM cultivators WHERE id = ?');
        this.deleteStmt = db.prepare('DELETE FROM cultivators WHERE id = ?');

        this.insertInjuryStmt = db.prepare(`
            INSERT INTO cultivator_injuries (
                id, cultivator_id, severity, source, description,
                sustained_on_turn, treated, cultivation_penalty, breakthrough_penalty,
                treated_on_turn, created_at
            ) VALUES (
                @id, @cultivatorId, @severity, @source, @description,
                @sustainedOnTurn, @treated, @cultivationPenalty, @breakthroughPenalty,
                @treatedOnTurn, @createdAt
            )
        `);

        // Chronological order matters: the narration reads like a history, and
        // "the oldest untreated injury" is the one a single pill should clear.
        this.selectInjuriesStmt = db.prepare(`
            SELECT * FROM cultivator_injuries
            WHERE cultivator_id = ?
            ORDER BY sustained_on_turn ASC, rowid ASC
        `);
        this.selectUntreatedInjuriesStmt = db.prepare(`
            SELECT * FROM cultivator_injuries
            WHERE cultivator_id = ? AND treated = 0
            ORDER BY sustained_on_turn ASC, rowid ASC
        `);
        this.countUntreatedStmt = db.prepare(`
            SELECT COUNT(*) AS n FROM cultivator_injuries
            WHERE cultivator_id = ? AND treated = 0
        `);
        this.treatInjuryStmt = db.prepare(`
            UPDATE cultivator_injuries
            SET treated = 1, treated_on_turn = @treatedOnTurn
            WHERE id = @id AND treated = 0
        `);
        this.selectInjuryByIdStmt = db.prepare('SELECT * FROM cultivator_injuries WHERE id = ?');
    }

    // ── CRUD ─────────────────────────────────────────────────────────────

    /**
     * Insert a cultivator plus any injuries it was born with (a corpse
     * recovered mid-run, an NPC defined as already crippled). The write is a
     * transaction: a cultivator whose injuries half-inserted would understate
     * its own death clock.
     */
    create(input: CreateCultivatorInput): Cultivator {
        const now = new Date().toISOString();
        const valid = CultivatorSchema.parse({
            ...input,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now
        });

        const insertAll = this.db.transaction((c: Cultivator) => {
            this.insertStmt.run(this.toParams(c));
            for (const injury of c.injuries) {
                this.insertInjuryStmt.run(this.injuryToParams(c.id, injury, now));
            }
        });
        insertAll(valid);

        return valid;
    }

    /** The cultivator, injuries included, or null when the id is unknown. */
    getById(id: string): Cultivator | null {
        const row = this.selectByIdStmt.get(id) as CultivatorRow | undefined;
        if (!row) return null;
        return this.rowToCultivator(row);
    }

    list(filter: ListCultivatorsFilter = {}): Cultivator[] {
        const clauses: string[] = [];
        const params: unknown[] = [];

        if (filter.runId !== undefined) {
            clauses.push('run_id = ?');
            params.push(filter.runId);
        }
        if (filter.sectId !== undefined) {
            clauses.push('sect_id = ?');
            params.push(filter.sectId);
        }
        if (filter.kind !== undefined) {
            clauses.push('kind = ?');
            params.push(filter.kind);
        }
        if (filter.alive !== undefined) {
            clauses.push('alive = ?');
            params.push(filter.alive ? 1 : 0);
        }

        const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
        const rows = this.db
            .prepare(`SELECT * FROM cultivators${where} ORDER BY created_at ASC, id ASC`)
            .all(...params) as CultivatorRow[];

        return rows.map(row => this.rowToCultivator(row));
    }

    /**
     * Patch fields on an existing cultivator. Talent (spiritRoot, attributes)
     * is accepted by the type but is permanent by design — the engine simply
     * never passes it.
     */
    update(id: string, updates: Partial<Cultivator>): Cultivator | null {
        const existing = this.getById(id);
        if (!existing) return null;

        const merged = CultivatorSchema.parse({
            ...existing,
            ...updates,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        });

        this.updateStmt.run(this.toParams(merged));
        return merged;
    }

    delete(id: string): boolean {
        return this.deleteStmt.run(id).changes > 0;
    }

    // ── DOMAIN OPERATIONS ────────────────────────────────────────────────

    /**
     * Apply signed deltas, clamped to the bounds the schema would otherwise
     * reject. Clamping rather than throwing is deliberate: overkill damage and
     * over-feeding are ordinary events, and the engine should not have to
     * pre-clamp every arithmetic result at every call site.
     */
    applyDeltas(id: string, deltas: CultivatorDeltas): Cultivator | null {
        const existing = this.getById(id);
        if (!existing) return null;
        this.assertMutable(existing);

        const maxHp = existing.maxHp;
        const maxQi = existing.maxQi;

        const next: Cultivator = {
            ...existing,
            hp: clampInt(existing.hp + (deltas.hp ?? 0), 0, maxHp),
            qi: clampInt(existing.qi + (deltas.qi ?? 0), 0, maxQi),
            satiety: clampInt(existing.satiety + (deltas.satiety ?? 0), 0, SATIETY_MAX),
            starvationTurns: Math.max(0, Math.round(existing.starvationTurns + (deltas.starvationTurns ?? 0))),
            spiritStones: Math.max(0, Math.round(existing.spiritStones + (deltas.spiritStones ?? 0))),
            cultivationProgress: Math.max(0, existing.cultivationProgress + (deltas.cultivationProgress ?? 0)),
            age: Math.max(0, existing.age + (deltas.age ?? 0)),
            yearsAtCurrentRealm: Math.max(0, existing.yearsAtCurrentRealm + (deltas.yearsAtCurrentRealm ?? 0)),
            updatedAt: new Date().toISOString()
        };

        const valid = CultivatorSchema.parse(next);
        this.updateStmt.run(this.toParams(valid));
        return valid;
    }

    /**
     * Move up the ladder. The repo owns only the bookkeeping — clamping to
     * MAX_ORDINAL, clearing accumulated progress, and restarting the
     * stagnation clock that kills cultivators who sit at one realm for fifty
     * years. Whether the breakthrough *succeeded* is the engine's call.
     */
    advanceRealm(id: string, ranks = 1): Cultivator | null {
        const existing = this.getById(id);
        if (!existing) return null;
        this.assertMutable(existing);

        const target = Math.min(MAX_ORDINAL, Math.max(0, existing.realmOrdinal + Math.round(ranks)));

        const valid = CultivatorSchema.parse({
            ...existing,
            realmOrdinal: target,
            cultivationProgress: 0,
            yearsAtCurrentRealm: 0,
            updatedAt: new Date().toISOString()
        });

        const advance = this.db.transaction((c: Cultivator) => {
            this.updateStmt.run(this.toParams(c));
            // The ledger's peak must survive the cultivator's later decline
            // (and death), so it is stamped at the moment the rank is reached.
            if (c.runId) {
                this.db
                    .prepare('UPDATE runs SET peak_ordinal = ? WHERE id = ? AND peak_ordinal < ?')
                    .run(c.realmOrdinal, c.runId, c.realmOrdinal);
            }
        });
        advance(valid);

        return valid;
    }

    /**
     * End a cultivator. Terminal and one-way: no revival, no reload. The
     * attached run is closed in the same transaction so the ledger can never
     * show a live run whose cultivator is a corpse.
     */
    markDead(id: string, cause: DeathCause, turn: number, description?: string): Cultivator | null {
        const existing = this.getById(id);
        if (!existing) return null;
        if (!existing.alive) return existing;

        const valid = CultivatorSchema.parse({
            ...existing,
            alive: false,
            deathCause: cause,
            diedOnTurn: Math.max(0, Math.round(turn)),
            updatedAt: new Date().toISOString()
        });

        const kill = this.db.transaction((c: Cultivator) => {
            this.updateStmt.run(this.toParams(c));
            if (c.runId) {
                this.db.prepare(`
                    UPDATE runs
                    SET status = 'dead',
                        ended_at = @endedAt,
                        death_cause = @deathCause,
                        death_description = COALESCE(@deathDescription, death_description),
                        turn = MAX(turn, @turn)
                    WHERE id = @id AND status = 'active'
                `).run({
                    id: c.runId,
                    endedAt: c.updatedAt,
                    deathCause: cause,
                    deathDescription: description ?? null,
                    turn: c.diedOnTurn
                });
            }
        });
        kill(valid);

        return valid;
    }

    // ── INJURIES ─────────────────────────────────────────────────────────

    /** Record a new meridian injury. Returns the stored, validated injury. */
    addInjury(cultivatorId: string, input: AddInjuryInput): Injury {
        const existing = this.getById(cultivatorId);
        if (!existing) {
            throw new Error(`Cannot injure unknown cultivator: ${cultivatorId}`);
        }
        this.assertMutable(existing);

        const weights = INJURY_WEIGHTS[input.severity];
        const injury = InjurySchema.parse({
            id: input.id ?? randomUUID(),
            severity: input.severity,
            source: input.source,
            description: input.description,
            sustainedOnTurn: input.sustainedOnTurn,
            treated: input.treated ?? false,
            cultivationPenalty: input.cultivationPenalty ?? weights.cultivationPenalty,
            breakthroughPenalty: input.breakthroughPenalty ?? weights.breakthroughPenalty
        });

        this.insertInjuryStmt.run(
            this.injuryToParams(cultivatorId, injury, new Date().toISOString())
        );
        return injury;
    }

    /**
     * Treat one injury. Returns the treated injury, or null when the id is
     * unknown or the injury was already treated — the caller consuming a pill
     * needs to know the difference between "healed" and "wasted".
     */
    treatInjury(injuryId: string, treatedOnTurn?: number): Injury | null {
        const result = this.treatInjuryStmt.run({
            id: injuryId,
            treatedOnTurn: treatedOnTurn ?? null
        });
        if (result.changes === 0) return null;

        const row = this.selectInjuryByIdStmt.get(injuryId) as InjuryRow | undefined;
        return row ? rowToInjury(row) : null;
    }

    listInjuries(cultivatorId: string, options: { untreatedOnly?: boolean } = {}): Injury[] {
        const stmt = options.untreatedOnly
            ? this.selectUntreatedInjuriesStmt
            : this.selectInjuriesStmt;
        const rows = stmt.all(cultivatorId) as InjuryRow[];
        return rows.map(rowToInjury);
    }

    /** Untreated injury count — the number LETHAL_UNTREATED_INJURIES is compared against. */
    countUntreatedInjuries(cultivatorId: string): number {
        const row = this.countUntreatedStmt.get(cultivatorId) as { n: number };
        return row.n;
    }

    // ── MAPPING ──────────────────────────────────────────────────────────

    private toParams(c: Cultivator): Record<string, unknown> {
        return {
            id: c.id,
            runId: c.runId ?? null,
            name: c.name,
            kind: c.kind,
            spiritRoot: c.spiritRoot,
            attributes: JSON.stringify(c.attributes),
            realmOrdinal: c.realmOrdinal,
            cultivationProgress: c.cultivationProgress,
            hp: c.hp,
            maxHp: c.maxHp,
            qi: c.qi,
            maxQi: c.maxQi,
            satiety: c.satiety,
            starvationTurns: c.starvationTurns,
            age: c.age,
            yearsAtCurrentRealm: c.yearsAtCurrentRealm,
            spiritStones: c.spiritStones,
            sectId: c.sectId ?? null,
            sectRank: c.sectRank ?? null,
            feuds: JSON.stringify(c.feuds),
            knownTechniques: JSON.stringify(c.knownTechniques),
            alive: c.alive ? 1 : 0,
            deathCause: c.deathCause ?? null,
            diedOnTurn: c.diedOnTurn ?? null,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt
        };
    }

    private injuryToParams(cultivatorId: string, injury: Injury, createdAt: string): Record<string, unknown> {
        return {
            id: injury.id,
            cultivatorId,
            severity: injury.severity,
            source: injury.source,
            description: injury.description,
            sustainedOnTurn: injury.sustainedOnTurn,
            treated: injury.treated ? 1 : 0,
            cultivationPenalty: injury.cultivationPenalty,
            breakthroughPenalty: injury.breakthroughPenalty,
            treatedOnTurn: null,
            createdAt
        };
    }

    private rowToCultivator(row: CultivatorRow): Cultivator {
        const injuries = (this.selectInjuriesStmt.all(row.id) as InjuryRow[]).map(rowToInjury);

        return CultivatorSchema.parse({
            id: row.id,
            runId: row.run_id ?? undefined,
            name: row.name,
            kind: row.kind,
            spiritRoot: row.spirit_root,
            attributes: JSON.parse(row.attributes),
            realmOrdinal: row.realm_ordinal,
            cultivationProgress: row.cultivation_progress,
            hp: row.hp,
            maxHp: row.max_hp,
            qi: row.qi,
            maxQi: row.max_qi,
            satiety: row.satiety,
            starvationTurns: row.starvation_turns,
            age: row.age,
            yearsAtCurrentRealm: row.years_at_current_realm,
            injuries,
            spiritStones: row.spirit_stones,
            sectId: row.sect_id,
            sectRank: row.sect_rank,
            feuds: JSON.parse(row.feuds),
            knownTechniques: JSON.parse(row.known_techniques),
            alive: row.alive === 1,
            deathCause: row.death_cause,
            diedOnTurn: row.died_on_turn,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }

    /**
     * Death is the end of the run, not a status effect. Anything that would
     * mutate a corpse is a bug upstream, so it fails here rather than quietly
     * animating the dead.
     */
    private assertMutable(c: Cultivator): void {
        if (!c.alive) {
            throw new Error(
                `Cultivator ${c.id} is dead (${c.deathCause ?? 'unknown cause'}) and cannot be modified.`
            );
        }
    }
}

function rowToInjury(row: InjuryRow): Injury {
    return InjurySchema.parse({
        id: row.id,
        severity: row.severity,
        source: row.source,
        description: row.description,
        sustainedOnTurn: row.sustained_on_turn,
        treated: row.treated === 1,
        cultivationPenalty: row.cultivation_penalty,
        breakthroughPenalty: row.breakthrough_penalty
    });
}

function clampInt(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)));
}
