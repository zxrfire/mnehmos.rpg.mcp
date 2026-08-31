import Database from 'better-sqlite3';
import {
    Technique,
    TechniqueCategory,
    TechniqueGrade,
    TechniqueSchema
} from '../../schema/cultivation.js';

interface TechniqueRow {
    id: string;
    name: string;
    category: string;
    grade: string;
    element: string | null;
    required_ordinal: number;
    qi_cost: number;
    damage: string | null;
    mastery: number;
    description: string;
    cooldown: number;
    created_at: string;
}

interface KnownTechniqueRow extends TechniqueRow {
    known_mastery: number;
    cooldown_remaining: number;
    last_used_turn: number | null;
    learned_at: string;
}

/**
 * A technique as *this* cultivator holds it: the catalog art, overlaid with
 * the mastery they have actually earned and the cooldown they are actually
 * sitting on. `mastery` is the per-cultivator value, not the catalog baseline
 * — callers reason about the cultivator's copy, so that is what wins the name.
 */
export interface KnownTechnique extends Technique {
    cooldownRemaining: number;
    lastUsedTurn: number | null;
    learnedAt: string;
}

export interface ListTechniquesFilter {
    category?: TechniqueCategory;
    grade?: TechniqueGrade;
    /** Only arts this ordinal is permitted to begin learning. */
    maxRequiredOrdinal?: number;
}

/**
 * The technique catalog and who knows what.
 *
 * The split is the point: `techniques` is shared world data, and
 * `cultivator_techniques` is the per-cultivator state (mastery, cooldown) that
 * must never be written onto a row two cultivators read.
 */
export class TechniqueRepository {
    private readonly upsertStmt: Database.Statement;
    private readonly selectByIdStmt: Database.Statement;
    private readonly deleteStmt: Database.Statement;
    private readonly learnStmt: Database.Statement;
    private readonly forgetStmt: Database.Statement;
    private readonly selectKnownStmt: Database.Statement;
    private readonly selectOneKnownStmt: Database.Statement;
    private readonly setMasteryStmt: Database.Statement;
    private readonly markUsedStmt: Database.Statement;
    private readonly tickCooldownsStmt: Database.Statement;
    private readonly syncKnownListStmt: Database.Statement;

    constructor(private db: Database.Database) {
        // Upsert rather than insert: the catalog is seeded from data files on
        // every startup, and re-seeding must be a no-op rather than a crash.
        this.upsertStmt = db.prepare(`
            INSERT INTO techniques (
                id, name, category, grade, element, required_ordinal,
                qi_cost, damage, mastery, description, cooldown
            ) VALUES (
                @id, @name, @category, @grade, @element, @requiredOrdinal,
                @qiCost, @damage, @mastery, @description, @cooldown
            )
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                category = excluded.category,
                grade = excluded.grade,
                element = excluded.element,
                required_ordinal = excluded.required_ordinal,
                qi_cost = excluded.qi_cost,
                damage = excluded.damage,
                mastery = excluded.mastery,
                description = excluded.description,
                cooldown = excluded.cooldown
        `);

        this.selectByIdStmt = db.prepare('SELECT * FROM techniques WHERE id = ?');
        this.deleteStmt = db.prepare('DELETE FROM techniques WHERE id = ?');

        this.learnStmt = db.prepare(`
            INSERT INTO cultivator_techniques (cultivator_id, technique_id, mastery)
            VALUES (@cultivatorId, @techniqueId, @mastery)
            ON CONFLICT(cultivator_id, technique_id) DO UPDATE SET
                mastery = MAX(cultivator_techniques.mastery, excluded.mastery),
                updated_at = datetime('now')
        `);

        this.forgetStmt = db.prepare(`
            DELETE FROM cultivator_techniques WHERE cultivator_id = ? AND technique_id = ?
        `);

        this.selectKnownStmt = db.prepare(`
            SELECT t.*,
                   ct.mastery AS known_mastery,
                   ct.cooldown_remaining,
                   ct.last_used_turn,
                   ct.learned_at
            FROM cultivator_techniques ct
            JOIN techniques t ON t.id = ct.technique_id
            WHERE ct.cultivator_id = ?
            ORDER BY ct.learned_at ASC, t.id ASC
        `);

        this.selectOneKnownStmt = db.prepare(`
            SELECT t.*,
                   ct.mastery AS known_mastery,
                   ct.cooldown_remaining,
                   ct.last_used_turn,
                   ct.learned_at
            FROM cultivator_techniques ct
            JOIN techniques t ON t.id = ct.technique_id
            WHERE ct.cultivator_id = ? AND ct.technique_id = ?
        `);

        this.setMasteryStmt = db.prepare(`
            UPDATE cultivator_techniques
            SET mastery = @mastery, updated_at = datetime('now')
            WHERE cultivator_id = @cultivatorId AND technique_id = @techniqueId
        `);

        this.markUsedStmt = db.prepare(`
            UPDATE cultivator_techniques
            SET cooldown_remaining = @cooldown,
                last_used_turn = @turn,
                updated_at = datetime('now')
            WHERE cultivator_id = @cultivatorId AND technique_id = @techniqueId
        `);

        // Clamped at zero in SQL so a long time-skip cannot drive cooldowns
        // negative and hand back a "ready in -40 turns" to the UI.
        this.tickCooldownsStmt = db.prepare(`
            UPDATE cultivator_techniques
            SET cooldown_remaining = MAX(0, cooldown_remaining - @turns)
            WHERE cultivator_id = @cultivatorId AND cooldown_remaining > 0
        `);

        // cultivators.known_techniques is a denormalised mirror kept for the
        // single-row read the agent's context builder does. The join table is
        // authoritative; this keeps the mirror honest after every change.
        this.syncKnownListStmt = db.prepare(`
            UPDATE cultivators SET known_techniques = ?, updated_at = datetime('now') WHERE id = ?
        `);
    }

    // ── CATALOG ──────────────────────────────────────────────────────────

    upsert(technique: Technique): Technique {
        const valid = TechniqueSchema.parse(technique);
        this.upsertStmt.run({
            id: valid.id,
            name: valid.name,
            category: valid.category,
            grade: valid.grade,
            element: valid.element ?? null,
            requiredOrdinal: valid.requiredOrdinal,
            qiCost: valid.qiCost,
            damage: valid.damage ?? null,
            mastery: valid.mastery,
            description: valid.description,
            cooldown: valid.cooldown
        });
        return valid;
    }

    getById(id: string): Technique | null {
        const row = this.selectByIdStmt.get(id) as TechniqueRow | undefined;
        return row ? rowToTechnique(row) : null;
    }

    list(filter: ListTechniquesFilter = {}): Technique[] {
        const clauses: string[] = [];
        const params: unknown[] = [];

        if (filter.category !== undefined) {
            clauses.push('category = ?');
            params.push(filter.category);
        }
        if (filter.grade !== undefined) {
            clauses.push('grade = ?');
            params.push(filter.grade);
        }
        if (filter.maxRequiredOrdinal !== undefined) {
            clauses.push('required_ordinal <= ?');
            params.push(filter.maxRequiredOrdinal);
        }

        const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
        const rows = this.db
            .prepare(`SELECT * FROM techniques${where} ORDER BY required_ordinal ASC, name ASC`)
            .all(...params) as TechniqueRow[];

        return rows.map(rowToTechnique);
    }

    delete(id: string): boolean {
        return this.deleteStmt.run(id).changes > 0;
    }

    // ── PER-CULTIVATOR ───────────────────────────────────────────────────

    /**
     * Learn an art. Re-learning never lowers mastery: a cultivator who reads
     * the same manual twice does not forget what they already understood.
     */
    learn(cultivatorId: string, techniqueId: string, mastery = 0): KnownTechnique | null {
        if (!this.getById(techniqueId)) return null;

        const teach = this.db.transaction(() => {
            this.learnStmt.run({
                cultivatorId,
                techniqueId,
                mastery: clamp01(mastery)
            });
            this.syncKnownList(cultivatorId);
        });
        teach();

        return this.getKnown(cultivatorId, techniqueId);
    }

    forget(cultivatorId: string, techniqueId: string): boolean {
        const drop = this.db.transaction(() => {
            const changed = this.forgetStmt.run(cultivatorId, techniqueId).changes > 0;
            if (changed) this.syncKnownList(cultivatorId);
            return changed;
        });
        return drop();
    }

    listKnown(cultivatorId: string): KnownTechnique[] {
        const rows = this.selectKnownStmt.all(cultivatorId) as KnownTechniqueRow[];
        return rows.map(rowToKnown);
    }

    getKnown(cultivatorId: string, techniqueId: string): KnownTechnique | null {
        const row = this.selectOneKnownStmt.get(cultivatorId, techniqueId) as KnownTechniqueRow | undefined;
        return row ? rowToKnown(row) : null;
    }

    knows(cultivatorId: string, techniqueId: string): boolean {
        return this.getKnown(cultivatorId, techniqueId) !== null;
    }

    /** Set mastery outright. Clamped to 0..1; the schema would reject anything else. */
    setMastery(cultivatorId: string, techniqueId: string, mastery: number): KnownTechnique | null {
        const changed = this.setMasteryStmt.run({
            cultivatorId,
            techniqueId,
            mastery: clamp01(mastery)
        }).changes;
        if (changed === 0) return null;
        return this.getKnown(cultivatorId, techniqueId);
    }

    /** Practice: raise mastery by a delta, saturating at full mastery. */
    addMastery(cultivatorId: string, techniqueId: string, delta: number): KnownTechnique | null {
        const known = this.getKnown(cultivatorId, techniqueId);
        if (!known) return null;
        return this.setMastery(cultivatorId, techniqueId, known.mastery + delta);
    }

    /**
     * Record a use: start the art's cooldown from the catalog value and stamp
     * the turn. The catalog owns the cooldown length; the cultivator owns only
     * how much of it is left.
     */
    markUsed(cultivatorId: string, techniqueId: string, turn: number): KnownTechnique | null {
        const technique = this.getById(techniqueId);
        if (!technique) return null;

        const changed = this.markUsedStmt.run({
            cultivatorId,
            techniqueId,
            cooldown: technique.cooldown,
            turn: Math.max(0, Math.round(turn))
        }).changes;
        if (changed === 0) return null;

        return this.getKnown(cultivatorId, techniqueId);
    }

    /** Burn down every cooldown this cultivator is carrying. Returns rows touched. */
    tickCooldowns(cultivatorId: string, turns = 1): number {
        return this.tickCooldownsStmt.run({
            cultivatorId,
            turns: Math.max(0, Math.round(turns))
        }).changes;
    }

    /** Rewrite the denormalised id list on the cultivator row from the join table. */
    private syncKnownList(cultivatorId: string): void {
        const ids = (this.selectKnownStmt.all(cultivatorId) as KnownTechniqueRow[]).map(r => r.id);
        this.syncKnownListStmt.run(JSON.stringify(ids), cultivatorId);
    }
}

function rowToTechnique(row: TechniqueRow): Technique {
    return TechniqueSchema.parse({
        id: row.id,
        name: row.name,
        category: row.category,
        grade: row.grade,
        element: row.element,
        requiredOrdinal: row.required_ordinal,
        qiCost: row.qi_cost,
        damage: row.damage,
        mastery: row.mastery,
        description: row.description,
        cooldown: row.cooldown
    });
}

function rowToKnown(row: KnownTechniqueRow): KnownTechnique {
    // The catalog mastery is deliberately overwritten by the cultivator's own.
    const base = rowToTechnique(row);
    return {
        ...base,
        mastery: TechniqueSchema.shape.mastery.parse(row.known_mastery),
        cooldownRemaining: row.cooldown_remaining,
        lastUsedTurn: row.last_used_turn,
        learnedAt: row.learned_at
    };
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}
