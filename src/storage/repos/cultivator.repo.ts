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
    CRIPPLING_UNTREATED_INJURIES,
    SATIETY_MAX
} from '../../schema/cultivation.js';
import {
    MAX_ORDINAL,
    maxHpForOrdinal,
    maxQiForOrdinal
} from '../../engine/cultivation/realms.js';
import { isTraceable } from '../../engine/cultivation/understanding.js';

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
    origin_tier: string;
    sex: string;
    tradition_id: string;
    attributes: string;
    realm_ordinal: number;
    cultivation_progress: number;
    foundation_quality: string;
    immortal_status: string;
    hp: number;
    max_hp: number;
    qi: number;
    max_qi: number;
    satiety: number;
    starvation_turns: number;
    bleeding_turns: number;
    age: number;
    years_at_current_realm: number;
    spirit_stones: number;
    sect_id: string | null;
    sect_rank: string | null;
    location: string | null;
    feuds: string;
    known_techniques: string;
    insights: string;
    achievements: string;
    battles_survived: number;
    battles_won: number;
    alive: number;
    existence_state: string;
    soul_state: string;
    identity_continuity: number;
    body_id: string | null;
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
    wound_type: string | null;
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
    /**
     * Which authored wound this is, as a key into `data/cultivation/wounds.ts`.
     *
     * Pass it through wherever the engine minted one. `resolveDeviation` and
     * the crossing path have both been setting it since `ordinaryWoundFor`
     * landed, and this layer had nowhere to put it - so every wound a player
     * carried came back unnamed. A live qi-deviation injury read
     * `woundType: null` and nothing could say what it was.
     *
     * Null still means an ordinary wound of its severity, which is what every
     * row written before the column was.
     */
    woundType?: string | null;
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
    bleedingTurns?: number;
    spiritStones?: number;
    cultivationProgress?: number;
    age?: number;
    yearsAtCurrentRealm?: number;
}

/**
 * One row of the admin roster: every cultivator in the world, flattened
 * against their sect and their injury count.
 *
 * Deliberately *not* a Cultivator. This is a read-only projection for a
 * listing screen, and returning full domain objects would mean loading every
 * injury of every cultivator to render a column that only needs a number.
 *
 * Display fields derived from these values - rankName, realmName,
 * spiritRootName, lifespanYears, isPlayer - are the web layer's job. The repo
 * ships the facts; presentation is not persistence.
 */
export interface RosterEntry {
    id: string;
    name: string;
    kind: Cultivator['kind'];
    spiritRoot: Cultivator['spiritRoot'];
    /**
     * Carried so that somebody can be asked about themselves.
     *
     * A plain fact a person holds about their own body, which is exactly the
     * class of question `asked.ts` must not route through the could-they-know
     * gate. Nothing on this projection branches on it.
     */
    sex: Cultivator['sex'];
    realmOrdinal: number;
    location: string | null;
    sectId: string | null;
    sectName: string | null;
    sectRank: string | null;
    age: number;
    alive: boolean;
    /**
     * Authoritative. `alive` is the convenience boolean beside it, and the two
     * genuinely differ: a `soul_preserved` cultivator is not alive and is
     * still playing, a `missing` one has no resolved answer either way. The
     * roster is the one screen a player would ever see those on, so it ships
     * the real state rather than collapsing everything into a checkbox.
     */
    existenceState: Cultivator['existenceState'];
    soulState: Cultivator['soulState'];
    identityContinuity: number;
    deathCause: string | null;
    spiritStones: number;
    untreatedInjuries: number;
    feuds: string[];
}

interface RosterRow {
    id: string;
    name: string;
    kind: string;
    spirit_root: string;
    sex: string;
    realm_ordinal: number;
    location: string | null;
    sect_id: string | null;
    sect_name: string | null;
    sect_rank: string | null;
    age: number;
    alive: number;
    existence_state: string;
    soul_state: string;
    identity_continuity: number;
    death_cause: string | null;
    spirit_stones: number;
    untreated_injuries: number;
    feuds: string;
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
    private readonly clearBleedClockStmt: Database.Statement;
    private readonly selectInjuryByIdStmt: Database.Statement;
    private readonly rosterStmt: Database.Statement;

    constructor(private db: Database.Database) {
        this.insertStmt = db.prepare(`
            INSERT INTO cultivators (
                id, run_id, name, kind, spirit_root, origin_tier, sex, tradition_id, attributes,
                realm_ordinal, cultivation_progress, foundation_quality, immortal_status,
                hp, max_hp, qi, max_qi, satiety, starvation_turns, bleeding_turns,
                age, years_at_current_realm,
                spirit_stones, sect_id, sect_rank, location, feuds, known_techniques,
                insights, achievements, battles_survived, battles_won,
                existence_state, soul_state, identity_continuity, body_id,
                alive, death_cause, died_on_turn,
                created_at, updated_at
            ) VALUES (
                @id, @runId, @name, @kind, @spiritRoot, @origin, @sex, @traditionId, @attributes,
                @realmOrdinal, @cultivationProgress, @foundationQuality, @immortalStatus,
                @hp, @maxHp, @qi, @maxQi, @satiety, @starvationTurns, @bleedingTurns,
                @age, @yearsAtCurrentRealm,
                @spiritStones, @sectId, @sectRank, @location, @feuds, @knownTechniques,
                @insights, @achievements, @battlesSurvived, @battlesWon,
                @existenceState, @soulState, @identityContinuity, @bodyId,
                @alive, @deathCause, @diedOnTurn,
                @createdAt, @updatedAt
            )
        `);

        this.updateStmt = db.prepare(`
            UPDATE cultivators SET
                run_id = @runId, name = @name, kind = @kind,
                spirit_root = @spiritRoot, origin_tier = @origin, sex = @sex,
                tradition_id = @traditionId, attributes = @attributes,
                realm_ordinal = @realmOrdinal, cultivation_progress = @cultivationProgress,
                foundation_quality = @foundationQuality, immortal_status = @immortalStatus,
                hp = @hp, max_hp = @maxHp, qi = @qi, max_qi = @maxQi,
                satiety = @satiety, starvation_turns = @starvationTurns,
                bleeding_turns = @bleedingTurns,
                age = @age, years_at_current_realm = @yearsAtCurrentRealm,
                spirit_stones = @spiritStones, sect_id = @sectId, sect_rank = @sectRank,
                location = @location, feuds = @feuds, known_techniques = @knownTechniques,
                insights = @insights, achievements = @achievements,
                battles_survived = @battlesSurvived, battles_won = @battlesWon,
                existence_state = @existenceState, soul_state = @soulState,
                identity_continuity = @identityContinuity, body_id = @bodyId,
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
                treated_on_turn, wound_type, created_at
            ) VALUES (
                @id, @cultivatorId, @severity, @source, @description,
                @sustainedOnTurn, @treated, @cultivationPenalty, @breakthroughPenalty,
                @treatedOnTurn, @woundType, @createdAt
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
        // Treatment clears the open-channel counter. Written as its own
        // statement rather than through update(), because it must run inside
        // treatInjury's own transaction and must not touch any other column.
        this.clearBleedClockStmt = db.prepare(
            'UPDATE cultivators SET bleeding_turns = 0 WHERE id = @id'
        );

        // One query, no N+1. The admin panel renders a few hundred rows, and a
        // per-cultivator sect lookup plus a per-cultivator injury count would
        // be 2N+1 round trips for a screen that is pure listing.
        //
        // The injury count is a correlated subquery rather than a
        // GROUP BY join: grouping would require every selected column in the
        // GROUP BY clause, and the subquery hits idx_injuries_untreated
        // directly. LEFT JOIN on sects so unaffiliated (and orphaned)
        // cultivators still appear - an admin view that hides rogue
        // cultivators is worse than useless.
        this.rosterStmt = db.prepare(`
            SELECT
                c.id, c.name, c.kind, c.spirit_root, c.sex, c.realm_ordinal, c.location,
                c.sect_id, s.name AS sect_name, c.sect_rank,
                c.age, c.alive, c.existence_state, c.soul_state, c.identity_continuity,
                c.death_cause, c.spirit_stones, c.feuds,
                (
                    SELECT COUNT(*) FROM cultivator_injuries i
                    WHERE i.cultivator_id = c.id AND i.treated = 0
                ) AS untreated_injuries
            FROM cultivators c
            LEFT JOIN sects s ON s.id = c.sect_id
            ORDER BY c.alive DESC, c.realm_ordinal DESC, c.name ASC
        `);
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
     * Every cultivator in the world - player and NPCs alike, living and dead -
     * with rank, location, and sect standing, for the read-only admin panel.
     *
     * Alive first, then deepest cultivation, then by name: an operator scanning
     * this list is looking for who currently matters, and the dead are history.
     */
    roster(): RosterEntry[] {
        const rows = this.rosterStmt.all() as RosterRow[];
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            kind: row.kind as Cultivator['kind'],
            spiritRoot: row.spirit_root as Cultivator['spiritRoot'],
            sex: row.sex as Cultivator['sex'],
            realmOrdinal: row.realm_ordinal,
            location: row.location,
            sectId: row.sect_id,
            sectName: row.sect_name,
            sectRank: row.sect_rank,
            age: row.age,
            alive: row.alive === 1,
            existenceState: row.existence_state as Cultivator['existenceState'],
            soulState: row.soul_state as Cultivator['soulState'],
            identityContinuity: row.identity_continuity,
            deathCause: row.death_cause,
            spiritStones: row.spirit_stones,
            untreatedInjuries: row.untreated_injuries,
            feuds: JSON.parse(row.feuds) as string[]
        }));
    }

    /**
     * Patch fields on an existing cultivator. Talent (spiritRoot, attributes)
     * is accepted by the type but is permanent by design - the engine simply
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
            bleedingTurns: Math.max(0, Math.round(existing.bleedingTurns + (deltas.bleedingTurns ?? 0))),
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
     * Lay the foundation established at the 12 -> 13 crossing.
     *
     * Separate from `update` because a foundation is laid ONCE and is the thing
     * every realm above it is built on. Refusing to overwrite an existing one
     * here means no later write - a bulk update, a location change, a future
     * caller that did not know - can quietly upgrade a cracked foundation into
     * a flawless one. Returns null when the id is unknown or a foundation was
     * already laid.
     */
    establishFoundation(id: string, quality: Cultivator['foundationQuality']): Cultivator | null {
        const existing = this.getById(id);
        if (!existing) return null;
        this.assertMutable(existing);
        if (existing.foundationQuality !== 'none') return null;

        const valid = CultivatorSchema.parse({
            ...existing,
            foundationQuality: quality,
            updatedAt: new Date().toISOString()
        });
        this.updateStmt.run(this.toParams(valid));
        return valid;
    }

    /**
     * Record the result of the last crossing.
     *
     * Separate from `update` for the same reason `establishFoundation` is: both
     * non-'none' values are permanent and load-bearing. A 'false_immortal' is
     * what bars every further attempt, and refusing to overwrite it here means
     * no later write can quietly clear the bar and let the Lid open twice for
     * the same name. Returns null when the id is unknown or a status is already
     * recorded.
     */
    recordImmortalStatus(
        id: string,
        status: Cultivator['immortalStatus']
    ): Cultivator | null {
        const existing = this.getById(id);
        if (!existing) return null;
        this.assertMutable(existing);
        if (existing.immortalStatus !== 'none') return null;

        const valid = CultivatorSchema.parse({
            ...existing,
            immortalStatus: status,
            updatedAt: new Date().toISOString()
        });
        this.updateStmt.run(this.toParams(valid));
        return valid;
    }

    /**
     * Move up the ladder. The repo owns only the bookkeeping - clamping to
     * MAX_ORDINAL, clearing accumulated progress, and restarting the
     * stagnation clock that kills cultivators who sit at one realm for fifty
     * years. Whether the breakthrough *succeeded* is the engine's call.
     *
     * `foundationQuality` is deliberately untouched: it is carried through by
     * the spread, because the foundation survives every later advance and is
     * never re-laid.
     *
     * ── THE POOLS ARE RE-DERIVED HERE, AND THIS IS THE ONLY PLACE ────────
     *
     * `maxHp` and `maxQi` are a function of the attributes and the rung, and
     * the rung is the half that moves - so a stored pool is a value nothing
     * maintains and it goes stale the moment anybody climbs. It did: a played
     * run reached False Immortal holding 50 HP and 30 qi, a newborn's body,
     * while the world's NPCs were built with the ordinal in the formula.
     *
     * This is the one function every rank change in the codebase passes
     * through - the played layer, the MCP tool surface and the admin panel all
     * land here - which is what makes it the place the derivation can be
     * enforced for everybody at once rather than repeated at four call sites
     * that will disagree.
     *
     * Current HP and qi are carried across and clamped, never refilled. A
     * crossing enlarges the vessel; it does not fill it, and it is emphatically
     * not a heal. Going DOWN the ladder shrinks the vessel, which is why the
     * clamp is not optional.
     */
    advanceRealm(id: string, ranks = 1): Cultivator | null {
        const existing = this.getById(id);
        if (!existing) return null;
        this.assertMutable(existing);

        const target = Math.min(MAX_ORDINAL, Math.max(0, existing.realmOrdinal + Math.round(ranks)));
        const maxHp = maxHpForOrdinal(existing.attributes.might, target);
        const maxQi = maxQiForOrdinal(existing.attributes.insight, target);

        const valid = CultivatorSchema.parse({
            ...existing,
            realmOrdinal: target,
            maxHp,
            maxQi,
            hp: Math.min(existing.hp, maxHp),
            qi: Math.min(existing.qi, maxQi),
            cultivationProgress: 0,
            yearsAtCurrentRealm: 0,
            updatedAt: new Date().toISOString()
        });

        const advance = this.db.transaction((c: Cultivator) => {
            this.updateStmt.run(this.toParams(c));
            // The ledger's peak must survive the cultivator's later decline
            // (and death), so it is stamped at the moment the rank is reached.
            //
            // ONLY THE PLAYER'S OWN PEAK. A run's peak is how high THAT LIFE
            // got, and every cultivator sharing the run's id was stamping it:
            // `admin_manage.spawn_encounter` builds its opponent with the
            // player's `runId` and then advances it up the ladder the ordinary
            // way, so standing one person at ordinal 29 in front of a Qi
            // Condensation player wrote "peak: Void Refinement First Tempering"
            // onto that player's run. Measured in play: a run whose cultivator
            // had never been above 17 reported a peak of 29, and the same road
            // is taken by every NPC the world advances inside a run.
            //
            // Gated on kind rather than on the caller, because the caller is
            // not the thing that is wrong - an enemy really did advance a rank,
            // and it is simply not the life this run is a record of.
            if (c.runId && c.kind === 'pc') {
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
            breakthroughPenalty: input.breakthroughPenalty ?? weights.breakthroughPenalty,
            woundType: input.woundType ?? null
        });

        this.insertInjuryStmt.run(
            this.injuryToParams(cultivatorId, injury, new Date().toISOString())
        );
        return injury;
    }

    /**
     * Treat one injury. Returns the treated injury, or null when the id is
     * unknown or the injury was already treated - the caller consuming a pill
     * needs to know the difference between "healed" and "wasted".
     *
     * Closing a wound that drops the untreated count back under
     * CRIPPLING_UNTREATED_INJURIES also clears `bleeding_turns` - how long the
     * channels have been open - in the same transaction. Nothing dies of that
     * counter any more, but it is still a claim about the body's current state
     * rather than its history, and a counter that kept running after the wound
     * was closed would be the database disagreeing with the engine about
     * whether somebody is still carrying anything.
     */
    treatInjury(injuryId: string, treatedOnTurn?: number): Injury | null {
        const treat = this.db.transaction((): InjuryRow | undefined => {
            const result = this.treatInjuryStmt.run({
                id: injuryId,
                treatedOnTurn: treatedOnTurn ?? null
            });
            if (result.changes === 0) return undefined;

            const row = this.selectInjuryByIdStmt.get(injuryId) as InjuryRow | undefined;
            if (row && this.countUntreatedInjuries(row.cultivator_id) < CRIPPLING_UNTREATED_INJURIES) {
                this.clearBleedClockStmt.run({ id: row.cultivator_id });
            }
            return row;
        });

        const row = treat();
        return row ? rowToInjury(row) : null;
    }

    listInjuries(cultivatorId: string, options: { untreatedOnly?: boolean } = {}): Injury[] {
        const stmt = options.untreatedOnly
            ? this.selectUntreatedInjuriesStmt
            : this.selectInjuriesStmt;
        const rows = stmt.all(cultivatorId) as InjuryRow[];
        return rows.map(rowToInjury);
    }

    /** Untreated injury count - what CRIPPLING_UNTREATED_INJURIES is compared against. */
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
            origin: c.origin,
            sex: c.sex,
            traditionId: c.traditionId,
            attributes: JSON.stringify(c.attributes),
            realmOrdinal: c.realmOrdinal,
            cultivationProgress: c.cultivationProgress,
            foundationQuality: c.foundationQuality,
            immortalStatus: c.immortalStatus,
            hp: c.hp,
            maxHp: c.maxHp,
            qi: c.qi,
            maxQi: c.maxQi,
            satiety: c.satiety,
            starvationTurns: c.starvationTurns,
            bleedingTurns: c.bleedingTurns,
            age: c.age,
            yearsAtCurrentRealm: c.yearsAtCurrentRealm,
            spiritStones: c.spiritStones,
            sectId: c.sectId ?? null,
            sectRank: c.sectRank ?? null,
            location: c.location ?? null,
            feuds: JSON.stringify(c.feuds),
            insights: JSON.stringify(c.insights),
            achievements: JSON.stringify(c.achievements),
            battlesSurvived: c.battlesSurvived,
            battlesWon: c.battlesWon,
            existenceState: c.existenceState,
            soulState: c.soulState,
            identityContinuity: c.identityContinuity,
            bodyId: c.bodyId ?? null,
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
            woundType: injury.woundType ?? null,
            createdAt
        };
    }

    private rowToCultivator(row: CultivatorRow): Cultivator {
        const injuries = (this.selectInjuriesStmt.all(row.id) as InjuryRow[]).map(rowToInjury);

        const cultivator = CultivatorSchema.parse({
            id: row.id,
            runId: row.run_id ?? undefined,
            name: row.name,
            kind: row.kind,
            spiritRoot: row.spirit_root,
            origin: row.origin_tier,
            sex: row.sex,
            traditionId: row.tradition_id,
            attributes: JSON.parse(row.attributes),
            realmOrdinal: row.realm_ordinal,
            cultivationProgress: row.cultivation_progress,
            foundationQuality: row.foundation_quality,
            immortalStatus: row.immortal_status,
            hp: row.hp,
            maxHp: row.max_hp,
            qi: row.qi,
            maxQi: row.max_qi,
            satiety: row.satiety,
            starvationTurns: row.starvation_turns,
            bleedingTurns: row.bleeding_turns,
            age: row.age,
            yearsAtCurrentRealm: row.years_at_current_realm,
            injuries,
            spiritStones: row.spirit_stones,
            sectId: row.sect_id,
            sectRank: row.sect_rank,
            location: row.location,
            feuds: JSON.parse(row.feuds),
            knownTechniques: JSON.parse(row.known_techniques),
            insights: JSON.parse(row.insights),
            achievements: JSON.parse(row.achievements),
            battlesSurvived: row.battles_survived,
            battlesWon: row.battles_won,
            alive: row.alive === 1,
            existenceState: row.existence_state,
            soulState: row.soul_state,
            identityContinuity: row.identity_continuity,
            bodyId: row.body_id,
            deathCause: row.death_cause,
            diedOnTurn: row.died_on_turn,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });

        assertTraceableInsights(cultivator);
        return cultivator;
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

/**
 * Reject, do not repair, an insight that cannot say where it came from.
 *
 * `InsightSchema` already refuses a missing provenance - it has no default and
 * no `.optional()` - so what survives parse and still fails here is the
 * structural check: `formInsight` DERIVES an insight's id from its origin
 * achievement, so an id that no longer contains its own `achievementId` means
 * the provenance was swapped out after the fact.
 *
 * Repairing that would be worse than failing on it. The only repairs available
 * are inventing an achievement (fabricating history the simulation never
 * produced) or dropping the provenance (which the schema forbids precisely
 * because an insight with no history behind it is, in the design's own words,
 * a bug). An untraceable insight arriving from the database is a corruption
 * signal about the writer, and quietly normalising it would hide the writer
 * while leaving a cultivator holding comprehension nothing ever earned.
 */
function assertTraceableInsights(cultivator: Cultivator): void {
    if (isTraceable(cultivator.insights)) return;

    const untraceable = cultivator.insights
        .filter(insight => !isTraceable([insight]))
        .map(insight => `${insight.id} (claims achievement ${insight.provenance.achievementId})`);

    throw new Error(
        `Cultivator ${cultivator.id} has untraceable insights, which cannot be repaired: ` +
        `${untraceable.join('; ')}. An insight's id is derived from the achievement that ` +
        'produced it, so this row was written by something that did not use formInsight.'
    );
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
        breakthroughPenalty: row.breakthrough_penalty,
        woundType: row.wound_type ?? null
    });
}

function clampInt(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)));
}
