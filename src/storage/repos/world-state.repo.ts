import Database from 'better-sqlite3';
import type {
    ActorWorldState,
    DurableProcess,
    FactionRecord,
    InventoryItem,
    ScheduledEffect,
    WorldState
} from '../../engine/world/world-state.js';
import type { Era, HistoricalFact, HistoryLedger } from '../../engine/world/history.js';
import type { LocationChange, LocationRecord } from '../../engine/world/locations.js';
import type { NpcGoal, NpcRecord, NpcRelationship } from '../../engine/world/npc-state.js';
import type { MemoryRecord, MemoryStore } from '../../engine/world/memory.js';
import type { LineageEdge, LineageRecord } from '../../engine/world/lineage.js';
import type { OpportunityWindow } from '../../engine/world/opportunities.js';
import type { ObjectRecord, OwnershipClaim, ProvenanceEntry } from '../../engine/world/possessions.js';
import type { WorldRun } from '../../engine/world/legacy.js';
import { runSeedFor } from '../../engine/world/legacy.js';
import { makeAscensionRecord, toLayerKey, type AscensionRecord } from '../../engine/world/layers.js';
import { yearOfDay } from '../../engine/world/history.js';
import { DEFAULT_ORIGIN, isOriginTierKey } from '../../engine/cultivation/origin.js';
import type { Injury } from '../../schema/cultivation.js';

/**
 * Persistence for the world layer.
 *
 * ── WHY THIS IS NOT `world.repo.ts` ──────────────────────────────────────
 *
 * `repos/world.repo.ts` is already taken by the base schema's
 * `WorldRepository`, which owns the `worlds` table and is imported by four
 * files under `src/server/`. Overwriting it would have been the same collision
 * `migrations.world.ts` documents in its own header - the one that renamed
 * `worlds` to `world_runtime` and `world_facts` to `world_chronicle`. So this
 * is `world-state.repo.ts`, mirroring `engine/world/world-state.ts` and the
 * `world_` table prefix.
 *
 * ── WHAT IT PERSISTS ─────────────────────────────────────────────────────
 *
 * A whole `WorldState`, clock included, so a restart resumes rather than
 * reseeds. `enshrineRun` mutates the world in place, so everything legacy.ts
 * writes - the grave as a real location, the chronicle facts, the ancestral
 * hall count on the faction, the inherited goals, the remembrance
 * relationships - is inside `WorldState` and is covered by saving it. There is
 * no separate legacy write path, and there should not be one: two ways to
 * persist a consequence is two ways to persist half of it.
 *
 * ── ON ZOD ───────────────────────────────────────────────────────────────
 *
 * The other repos here round-trip through Zod because their domains have Zod
 * schemas. The world layer does not: it is plain TypeScript interfaces across
 * ~14k lines, and mirroring them in Zod would create a second source of truth
 * that drifts from the first and must be updated in lockstep forever. Instead
 * the boundary is defended by `assertLoadable` and `assertNoResurrection`,
 * which check the invariants that actually break - a missing world, a row that
 * lost its id, and the dead coming back - and throw rather than repair, the
 * same way the cultivator repo treats an untraceable insight.
 *
 * ── WHAT IS WRITTEN WHEN ─────────────────────────────────────────────────
 *
 * See `saveWorld` and `appendWorld`.
 */
export class WorldStateRepository {
    private readonly upsertRuntimeStmt: Database.Statement;
    private readonly selectRuntimeStmt: Database.Statement;
    private readonly listRuntimeStmt: Database.Statement;
    private readonly deleteRuntimeStmt: Database.Statement;

    private readonly insertEraStmt: Database.Statement;
    private readonly insertFactStmt: Database.Statement;
    private readonly insertFactActorStmt: Database.Statement;
    private readonly insertLocationStmt: Database.Statement;
    private readonly insertLocationChangeStmt: Database.Statement;
    private readonly insertFactionStmt: Database.Statement;
    private readonly insertNpcStmt: Database.Statement;
    private readonly insertGoalStmt: Database.Statement;
    private readonly insertRelationshipStmt: Database.Statement;
    private readonly insertActorStmt: Database.Statement;
    private readonly insertInventoryStmt: Database.Statement;
    private readonly insertMemoryStmt: Database.Statement;
    private readonly insertMemoryActorStmt: Database.Statement;
    private readonly insertEffectStmt: Database.Statement;
    private readonly insertProcessStmt: Database.Statement;
    private readonly insertLineageStmt: Database.Statement;
    private readonly insertLineageEdgeStmt: Database.Statement;
    private readonly insertRunStmt: Database.Statement;
    private readonly insertAscensionStmt: Database.Statement;
    private readonly insertOpportunityStmt: Database.Statement;
    private readonly insertObjectStmt: Database.Statement;
    private readonly insertClaimStmt: Database.Statement;
    private readonly insertProvenanceStmt: Database.Statement;

    private readonly selectErasStmt: Database.Statement;
    private readonly selectFactsStmt: Database.Statement;
    private readonly selectLocationsStmt: Database.Statement;
    private readonly selectLocationChangesStmt: Database.Statement;
    private readonly selectFactionsStmt: Database.Statement;
    private readonly selectNpcsStmt: Database.Statement;
    private readonly selectGoalsStmt: Database.Statement;
    private readonly selectRelationshipsStmt: Database.Statement;
    private readonly selectActorsStmt: Database.Statement;
    private readonly selectInventoryStmt: Database.Statement;
    private readonly selectMemoriesStmt: Database.Statement;
    private readonly selectEffectsStmt: Database.Statement;
    private readonly selectProcessesStmt: Database.Statement;
    private readonly selectLineagesStmt: Database.Statement;
    private readonly selectLineageEdgesStmt: Database.Statement;
    private readonly selectRunsStmt: Database.Statement;
    private readonly selectAscensionsStmt: Database.Statement;
    private readonly selectOpportunitiesStmt: Database.Statement;
    private readonly selectObjectsStmt: Database.Statement;
    private readonly selectClaimsStmt: Database.Statement;
    private readonly selectProvenanceStmt: Database.Statement;

    private readonly deadNpcIdsStmt: Database.Statement;
    private readonly maxFactSeqStmt: Database.Statement;
    private readonly maxMemorySeqStmt: Database.Statement;
    private readonly countFactsStmt: Database.Statement;

    constructor(private db: Database.Database) {
        this.upsertRuntimeStmt = db.prepare(`
            INSERT INTO world_runtime (
                id, seed, current_day, version,
                next_npc_seq, next_effect_seq, next_process_seq,
                next_fact_seq, next_memory_seq, population_target, updated_at
            ) VALUES (
                @id, @seed, @currentDay, @version,
                @nextNpcSeq, @nextEffectSeq, @nextProcessSeq,
                @nextFactSeq, @nextMemorySeq, @populationTarget, datetime('now')
            )
            ON CONFLICT(id) DO UPDATE SET
                seed = excluded.seed,
                current_day = excluded.current_day,
                version = excluded.version,
                next_npc_seq = excluded.next_npc_seq,
                next_effect_seq = excluded.next_effect_seq,
                next_process_seq = excluded.next_process_seq,
                next_fact_seq = excluded.next_fact_seq,
                next_memory_seq = excluded.next_memory_seq,
                population_target = excluded.population_target,
                updated_at = datetime('now')
        `);
        this.selectRuntimeStmt = db.prepare('SELECT * FROM world_runtime WHERE id = ?');
        this.listRuntimeStmt = db.prepare('SELECT * FROM world_runtime ORDER BY created_at ASC, id ASC');
        this.deleteRuntimeStmt = db.prepare('DELETE FROM world_runtime WHERE id = ?');

        this.insertEraStmt = db.prepare(`
            INSERT OR REPLACE INTO world_eras (id, world_id, name, start_day, end_day, qi_density, note)
            VALUES (@id, @worldId, @name, @startDay, @endDay, @qiDensity, @note)
        `);

        this.insertFactStmt = db.prepare(`
            INSERT OR REPLACE INTO world_chronicle (
                id, world_id, day, era_id, kind, scale, summary,
                location_id, place, visibility, fidelity, cause_known,
                truth, claimed_outcomes, near_miss, near_miss_note, magnitude,
                actors, witness_ids, faction_ids, causes, location_change_ids,
                consequences, data
            ) VALUES (
                @id, @worldId, @day, @eraId, @kind, @scale, @summary,
                @locationId, @place, @visibility, @fidelity, @causeKnown,
                @truth, @claimedOutcomes, @nearMiss, @nearMissNote, @magnitude,
                @actors, @witnessIds, @factionIds, @causes, @locationChangeIds,
                @consequences, @data
            )
        `);

        this.insertFactActorStmt = db.prepare(`
            INSERT OR REPLACE INTO world_chronicle_actors (world_id, fact_id, actor_id, role, witnessed)
            VALUES (@worldId, @factId, @actorId, @role, @witnessed)
        `);

        this.insertLocationStmt = db.prepare(`
            INSERT OR REPLACE INTO world_locations (
                id, world_id, name, kind, layer, parent_id, description,
                ambient, qi_density,
                threshold_entry, threshold_survival, threshold_operational, threshold_mastery,
                hazards, affinities,
                env_spiritual_density, env_danger, env_resources, env_climate,
                env_political_control, env_special_rules, env_known_secrets, env_historical_scars,
                links, cycle_period_days, cycle_open_days, cycle_phase_day,
                sealed, sealed_on_day, discovered, discovered_on_day,
                controlling_faction_id, origin_fact_id,
                origin_kind, origin_name, origin_description, origin_ambient, origin_qi_density,
                origin_thresholds, origin_hazards, origin_affinities, origin_environment, origin_from_day,
                next_change_seq, tags, data, updated_at
            ) VALUES (
                @id, @worldId, @name, @kind, @layer, @parentId, @description,
                @ambient, @qiDensity,
                @thresholdEntry, @thresholdSurvival, @thresholdOperational, @thresholdMastery,
                @hazards, @affinities,
                @envSpiritualDensity, @envDanger, @envResources, @envClimate,
                @envPoliticalControl, @envSpecialRules, @envKnownSecrets, @envHistoricalScars,
                @links, @cyclePeriodDays, @cycleOpenDays, @cyclePhaseDay,
                @sealed, @sealedOnDay, @discovered, @discoveredOnDay,
                @controllingFactionId, @originFactId,
                @originKind, @originName, @originDescription, @originAmbient, @originQiDensity,
                @originThresholds, @originHazards, @originAffinities, @originEnvironment, @originFromDay,
                @nextChangeSeq, @tags, @data, datetime('now')
            )
        `);

        this.insertLocationChangeStmt = db.prepare(`
            INSERT OR REPLACE INTO world_location_changes (
                id, world_id, location_id, on_day, kind, summary,
                cause_fact_id, cause_known, attributed_causes, fidelity, witnessed, patch
            ) VALUES (
                @id, @worldId, @locationId, @onDay, @kind, @summary,
                @causeFactId, @causeKnown, @attributedCauses, @fidelity, @witnessed, @patch
            )
        `);

        this.insertFactionStmt = db.prepare(`
            INSERT OR REPLACE INTO world_factions (
                id, world_id, name, kind, layer, alignment, seat_location_id,
                controlled_location_ids, ranks, standing, resources, description,
                founded_on_day, dissolved_on_day, tags
            ) VALUES (
                @id, @worldId, @name, @kind, @layer, @alignment, @seatLocationId,
                @controlledLocationIds, @ranks, @standing, @resources, @description,
                @foundedOnDay, @dissolvedOnDay, @tags
            )
        `);

        this.insertNpcStmt = db.prepare(`
            INSERT OR REPLACE INTO world_npcs (
                id, world_id, name,
                born_on_day, origin_tier, occupation, titles, aliases, description,
                realm_ordinal, spirit_root, attributes, foundation, untreated_injuries,
                wounds, technique_ids, specialties, lifespan_ends_on_day, last_advanced_on_day,
                accumulating_since_day,
                location_id, layer, faction_id, faction_rank_index, spirit_stones,
                status, body_id, soul_state, identity_continuity, died_on_day, end_note,
                last_confirmed_on_day, updated_on_day, next_goal_seq, tags,
                history_fact_ids, memory_ids
            ) VALUES (
                @id, @worldId, @name,
                @bornOnDay, @origin, @occupation, @titles, @aliases, @description,
                @realmOrdinal, @spiritRoot, @attributes, @foundation, @untreatedInjuries,
                @wounds, @techniqueIds, @specialties, @lifespanEndsOnDay, @lastAdvancedOnDay,
                @accumulatingSinceDay,
                @locationId, @layer, @factionId, @factionRankIndex, @spiritStones,
                @status, @bodyId, @soulState, @identityContinuity, @diedOnDay, @endNote,
                @lastConfirmedOnDay, @updatedOnDay, @nextGoalSeq, @tags,
                @historyFactIds, @memoryIds
            )
        `);

        this.insertGoalStmt = db.prepare(`
            INSERT OR REPLACE INTO world_npc_goals (
                id, world_id, npc_id, kind, text, priority, progress, obstacles,
                deadline_on_day, status, target_id, opened_on_day, closed_on_day, note,
                inherited_from_id, origin_holder_id, generation
            ) VALUES (
                @id, @worldId, @npcId, @kind, @text, @priority, @progress, @obstacles,
                @deadlineOnDay, @status, @targetId, @openedOnDay, @closedOnDay, @note,
                @inheritedFromId, @originHolderId, @generation
            )
        `);

        this.insertRelationshipStmt = db.prepare(`
            INSERT OR REPLACE INTO world_relationships (
                world_id, owner_id, target_id, target_name, kind, standing, note,
                since_day, last_changed_day, fact_ids, inherited_from_id
            ) VALUES (
                @worldId, @ownerId, @targetId, @targetName, @kind, @standing, @note,
                @sinceDay, @lastChangedDay, @factIds, @inheritedFromId
            )
        `);

        this.insertActorStmt = db.prepare(`
            INSERT OR REPLACE INTO world_actors (
                world_id, actor_id, location_id, layer, faction_id, faction_rank_index,
                resources, key_ids, updated_on_day, history_fact_ids, memory_ids
            ) VALUES (
                @worldId, @actorId, @locationId, @layer, @factionId, @factionRankIndex,
                @resources, @keyIds, @updatedOnDay, @historyFactIds, @memoryIds
            )
        `);

        this.insertInventoryStmt = db.prepare(`
            INSERT OR REPLACE INTO world_actor_inventory
                (world_id, actor_id, item_id, name, kind, quantity, note)
            VALUES (@worldId, @actorId, @itemId, @name, @kind, @quantity, @note)
        `);

        this.insertMemoryStmt = db.prepare(`
            INSERT OR REPLACE INTO world_memories (
                id, world_id, owner_id, kind, summary, detail, on_day,
                actor_ids, location_id, faction_ids, salience, tags,
                source_fact_ids, compressed_from, compressed, created_on_day, updated_on_day
            ) VALUES (
                @id, @worldId, @ownerId, @kind, @summary, @detail, @onDay,
                @actorIds, @locationId, @factionIds, @salience, @tags,
                @sourceFactIds, @compressedFrom, @compressed, @createdOnDay, @updatedOnDay
            )
        `);

        this.insertMemoryActorStmt = db.prepare(`
            INSERT OR REPLACE INTO world_memory_actors (world_id, memory_id, actor_id)
            VALUES (@worldId, @memoryId, @actorId)
        `);

        this.insertEffectStmt = db.prepare(`
            INSERT OR REPLACE INTO world_scheduled_effects (
                id, world_id, kind, due_on_day, summary, actor_ids,
                location_id, faction_id, repeat_days, interrupts, chance,
                fired, fired_on_day, data
            ) VALUES (
                @id, @worldId, @kind, @dueOnDay, @summary, @actorIds,
                @locationId, @factionId, @repeatDays, @interrupts, @chance,
                @fired, @firedOnDay, @data
            )
        `);

        this.insertProcessStmt = db.prepare(`
            INSERT OR REPLACE INTO world_processes
                (id, world_id, actor_id, kind, started_on_day, ends_on_day, per_day, note)
            VALUES (@id, @worldId, @actorId, @kind, @startedOnDay, @endsOnDay, @perDay, @note)
        `);

        this.insertLineageStmt = db.prepare(`
            INSERT OR REPLACE INTO world_lineages (
                id, world_id, surname, founder_id, founded_on_day, member_ids,
                traits, reputation, holdings, obligation_ids, inherited_enemy_ids,
                extinct_on_day, tags
            ) VALUES (
                @id, @worldId, @surname, @founderId, @foundedOnDay, @memberIds,
                @traits, @reputation, @holdings, @obligationIds, @inheritedEnemyIds,
                @extinctOnDay, @tags
            )
        `);

        this.insertLineageEdgeStmt = db.prepare(`
            INSERT OR REPLACE INTO world_lineage_edges
                (world_id, lineage_id, parent_id, child_id, relation, on_day, note)
            VALUES (@worldId, @lineageId, @parentId, @childId, @relation, @onDay, @note)
        `);

        this.insertRunStmt = db.prepare(`
            INSERT OR REPLACE INTO world_runs (
                id, world_id, run_index, seed, cultivator_id, cultivator_name,
                started_on_day, ended_on_day, outcome, peak_ordinal,
                grave_location_id, successor_relation
            ) VALUES (
                @id, @worldId, @runIndex, @seed, @cultivatorId, @cultivatorName,
                @startedOnDay, @endedOnDay, @outcome, @peakOrdinal,
                @graveLocationId, @successorRelation
            )
        `);

        // Reaching ordinal 46 is a transition, not an ending, so this is a
        // table of its own rather than a column on world_runs: the run may be
        // closed by the ascension or continue after it, and the person stays
        // in world_npcs either way, on the same lineage edges, owed the same
        // debts. Nothing about the row resets anything.
        this.insertAscensionStmt = db.prepare(`
            INSERT OR REPLACE INTO world_ascensions (
                id, world_id, resident_id, resident_name, ascended_on_day,
                from_location_id, from_faction_id, run_id, to_location_id,
                below_fact_id, after_crossing, died_above_on_day, end_note_above,
                inheritance_location_id, parting_gift_object_id
            ) VALUES (
                @id, @worldId, @residentId, @residentName, @ascendedOnDay,
                @fromLocationId, @fromFactionId, @runId, @toLocationId,
                @belowFactId, @afterCrossing, @diedAboveOnDay, @endNoteAbove,
                @inheritanceLocationId, @partingGiftObjectId
            )
        `);

        this.insertOpportunityStmt = db.prepare(`
            INSERT OR REPLACE INTO world_opportunities (
                id, world_id, kind, name, summary, location_id, faction_ids,
                opens_on_day, duration_days, recurrence_days, remaining_occurrences,
                ends_after_day, requirements, claimed, claimed_by_id, claimed_on_day,
                missed_windows, known_to_ids, tags, data
            ) VALUES (
                @id, @worldId, @kind, @name, @summary, @locationId, @factionIds,
                @opensOnDay, @durationDays, @recurrenceDays, @remainingOccurrences,
                @endsAfterDay, @requirements, @claimed, @claimedById, @claimedOnDay,
                @missedWindows, @knownToIds, @tags, @data
            )
        `);

        this.insertObjectStmt = db.prepare(`
            INSERT OR REPLACE INTO world_objects (
                id, world_id, name, kind, significance, description, power,
                possessor_id, owner_id, owner_name, known_ownership_by,
                location_id, tags, data, next_claim_seq
            ) VALUES (
                @id, @worldId, @name, @kind, @significance, @description, @power,
                @possessorId, @ownerId, @ownerName, @knownOwnershipBy,
                @locationId, @tags, @data, @nextClaimSeq
            )
        `);

        this.insertClaimStmt = db.prepare(`
            INSERT OR REPLACE INTO world_object_claims (
                id, world_id, object_id, claimant_id, claimant_name, basis,
                asserted_on_day, strength, acknowledged_by_ids, evidence_fact_ids, note, active
            ) VALUES (
                @id, @worldId, @objectId, @claimantId, @claimantName, @basis,
                @assertedOnDay, @strength, @acknowledgedByIds, @evidenceFactIds, @note, @active
            )
        `);

        this.insertProvenanceStmt = db.prepare(`
            INSERT OR REPLACE INTO world_object_provenance (
                world_id, object_id, seq, on_day, holder_id, holder_name, how, source,
                previous_holder_id, previous_holder_name, fact_id, note
            ) VALUES (
                @worldId, @objectId, @seq, @onDay, @holderId, @holderName, @how, @source,
                @previousHolderId, @previousHolderName, @factId, @note
            )
        `);

        // Reads. Ordering is explicit everywhere a list round-trips, because
        // "identical after reload" is a test this repo has to pass and SQLite
        // makes no promise about unordered row order.
        this.selectErasStmt = db.prepare('SELECT * FROM world_eras WHERE world_id = ? ORDER BY start_day ASC, id ASC');
        this.selectFactsStmt = db.prepare('SELECT * FROM world_chronicle WHERE world_id = ? ORDER BY rowid ASC');
        this.selectLocationsStmt = db.prepare('SELECT * FROM world_locations WHERE world_id = ? ORDER BY rowid ASC');
        this.selectLocationChangesStmt = db.prepare(
            'SELECT * FROM world_location_changes WHERE world_id = ? ORDER BY location_id ASC, on_day ASC, rowid ASC'
        );
        this.selectFactionsStmt = db.prepare('SELECT * FROM world_factions WHERE world_id = ? ORDER BY rowid ASC');
        this.selectNpcsStmt = db.prepare('SELECT * FROM world_npcs WHERE world_id = ? ORDER BY rowid ASC');
        this.selectGoalsStmt = db.prepare('SELECT * FROM world_npc_goals WHERE world_id = ? ORDER BY rowid ASC');
        this.selectRelationshipsStmt = db.prepare('SELECT * FROM world_relationships WHERE world_id = ? ORDER BY rowid ASC');
        this.selectActorsStmt = db.prepare('SELECT * FROM world_actors WHERE world_id = ? ORDER BY rowid ASC');
        this.selectInventoryStmt = db.prepare('SELECT * FROM world_actor_inventory WHERE world_id = ? ORDER BY rowid ASC');
        this.selectMemoriesStmt = db.prepare('SELECT * FROM world_memories WHERE world_id = ? ORDER BY rowid ASC');
        this.selectEffectsStmt = db.prepare('SELECT * FROM world_scheduled_effects WHERE world_id = ? ORDER BY rowid ASC');
        this.selectProcessesStmt = db.prepare('SELECT * FROM world_processes WHERE world_id = ? ORDER BY rowid ASC');
        this.selectLineagesStmt = db.prepare('SELECT * FROM world_lineages WHERE world_id = ? ORDER BY rowid ASC');
        this.selectLineageEdgesStmt = db.prepare('SELECT * FROM world_lineage_edges WHERE world_id = ? ORDER BY rowid ASC');
        this.selectRunsStmt = db.prepare('SELECT * FROM world_runs WHERE world_id = ? ORDER BY run_index ASC');
        this.selectAscensionsStmt = db.prepare(
            'SELECT * FROM world_ascensions WHERE world_id = ? ORDER BY ascended_on_day ASC, id ASC'
        );
        this.selectOpportunitiesStmt = db.prepare('SELECT * FROM world_opportunities WHERE world_id = ? ORDER BY rowid ASC');
        this.selectObjectsStmt = db.prepare('SELECT * FROM world_objects WHERE world_id = ? ORDER BY rowid ASC');
        this.selectClaimsStmt = db.prepare('SELECT * FROM world_object_claims WHERE world_id = ? ORDER BY rowid ASC');
        this.selectProvenanceStmt = db.prepare(
            'SELECT * FROM world_object_provenance WHERE world_id = ? ORDER BY object_id ASC, seq ASC'
        );

        // The no-resurrection guard reads only ids and needs no row bodies.
        this.deadNpcIdsStmt = db.prepare(`
            SELECT id, status, died_on_day FROM world_npcs
            WHERE world_id = ? AND status != 'alive'
        `);

        // High-water marks for the append-only fast path.
        this.maxFactSeqStmt = db.prepare('SELECT COUNT(*) AS n FROM world_chronicle WHERE world_id = ?');
        this.maxMemorySeqStmt = db.prepare('SELECT COUNT(*) AS n FROM world_memories WHERE world_id = ?');
        this.countFactsStmt = this.maxFactSeqStmt;
    }

    // ── SAVE ─────────────────────────────────────────────────────────────

    /**
     * Write a whole world.
     *
     * One transaction, delete-then-insert per table. The delete is what makes
     * it a snapshot rather than a merge: a location that was removed from the
     * state, a claim that was withdrawn and dropped, an effect that fired and
     * was pruned all have to disappear, and an upsert-only save would leave
     * them behind to be loaded back next time. Correctness first; the cost is
     * measured rather than assumed, and the numbers are in the test.
     *
     * Use this at checkpoints - world creation, run start, run end, and
     * whenever the player saves. Use `appendWorld` on the per-tick path.
     */
    saveWorld(state: WorldState): void {
        const write = this.db.transaction((s: WorldState) => {
            this.assertNoResurrection(s);
            this.upsertRuntimeStmt.run(runtimeParams(s));
            this.clearWorld(s.id);
            this.writeAll(s);
        });
        write(state);
    }

    /**
     * Write only what a tick can have changed.
     *
     * The append-only bulk - chronicle facts, memories, location changes,
     * object provenance - is skipped below its high-water mark: those tables
     * are never rewritten in place, so a row already stored is a row already
     * correct. A 500-year advance writes ~2818 facts once and then never
     * touches them again, and re-writing them on every subsequent save is the
     * single biggest avoidable cost in this layer.
     *
     * Everything genuinely mutable - the clock, locations, factions, NPCs and
     * their goals, actors, opportunities, objects, effects, processes - is
     * upserted, because any of it can change without changing its id, and
     * there is no dirty flag in the engine to narrow it further. The engine is
     * pure data with no change log, and inventing one here would mean this
     * repo silently disagreeing with a mutation somebody adds later.
     *
     * Rows removed from the state are NOT pruned by this path; that is what
     * makes it cheap, and it is why `saveWorld` exists. Removal is rare and
     * belongs to a checkpoint.
     */
    appendWorld(state: WorldState): void {
        const write = this.db.transaction((s: WorldState) => {
            this.assertNoResurrection(s);
            this.upsertRuntimeStmt.run(runtimeParams(s));

            const storedFacts = (this.countFactsStmt.get(s.id) as { n: number }).n;
            const storedMemories = (this.maxMemorySeqStmt.get(s.id) as { n: number }).n;

            this.writeEras(s);
            // Facts and memories are append-only and id-ordered by construction
            // (`f1..fN`, `m1..mN`), so a count is a valid high-water mark.
            this.writeFacts(s, s.history.facts.slice(storedFacts));
            this.writeMemories(s, s.memories.records.slice(storedMemories));
            this.writeLocations(s);
            this.writeFactions(s);
            this.writeNpcs(s);
            this.writeActors(s);
            this.writeEffects(s);
            this.writeProcesses(s);
            this.writeLineages(s);
            this.writeRuns(s);
            this.writeOpportunities(s);
            this.writeObjects(s);
        });
        write(state);
    }

    // ── LOAD ─────────────────────────────────────────────────────────────

    /** The whole world, clock included, or null when the id is unknown. */
    loadWorld(worldId: string): WorldState | null {
        const runtime = this.selectRuntimeStmt.get(worldId) as RuntimeRow | undefined;
        if (!runtime) return null;

        const changesByLocation = groupBy(
            this.selectLocationChangesStmt.all(worldId) as LocationChangeRow[],
            row => row.location_id
        );
        const goalsByNpc = groupBy(this.selectGoalsStmt.all(worldId) as GoalRow[], row => row.npc_id);
        const relationshipsByOwner = groupBy(
            this.selectRelationshipsStmt.all(worldId) as RelationshipRow[],
            row => row.owner_id
        );
        const inventoryByActor = groupBy(
            this.selectInventoryStmt.all(worldId) as InventoryRow[],
            row => row.actor_id
        );
        const edgesByLineage = groupBy(
            this.selectLineageEdgesStmt.all(worldId) as LineageEdgeRow[],
            row => row.lineage_id
        );
        const claimsByObject = groupBy(this.selectClaimsStmt.all(worldId) as ClaimRow[], row => row.object_id);
        const provenanceByObject = groupBy(
            this.selectProvenanceStmt.all(worldId) as ProvenanceRow[],
            row => row.object_id
        );

        const history: HistoryLedger = {
            eras: (this.selectErasStmt.all(worldId) as EraRow[]).map(rowToEra),
            facts: (this.selectFactsStmt.all(worldId) as FactRow[]).map(rowToFact),
            nextFactSeq: runtime.next_fact_seq
        };

        const memories: MemoryStore = {
            records: (this.selectMemoriesStmt.all(worldId) as MemoryRow[]).map(rowToMemory),
            nextSeq: runtime.next_memory_seq
        };

        const state: WorldState = {
            id: runtime.id,
            seed: runtime.seed,
            currentDay: runtime.current_day,
            locations: (this.selectLocationsStmt.all(worldId) as LocationRow[]).map(row =>
                rowToLocation(row, (changesByLocation.get(row.id) ?? []).map(rowToLocationChange))
            ),
            factions: (this.selectFactionsStmt.all(worldId) as FactionRow[]).map(rowToFaction),
            npcs: (this.selectNpcsStmt.all(worldId) as NpcRow[]).map(row =>
                rowToNpc(
                    row,
                    (goalsByNpc.get(row.id) ?? []).map(rowToGoal),
                    (relationshipsByOwner.get(row.id) ?? []).map(rowToRelationship)
                )
            ),
            actors: (this.selectActorsStmt.all(worldId) as ActorRow[]).map(row =>
                rowToActor(
                    row,
                    (inventoryByActor.get(row.actor_id) ?? []).map(rowToInventoryItem),
                    (relationshipsByOwner.get(row.actor_id) ?? []).map(rowToRelationship)
                )
            ),
            schedule: (this.selectEffectsStmt.all(worldId) as EffectRow[]).map(rowToEffect),
            processes: (this.selectProcessesStmt.all(worldId) as ProcessRow[]).map(rowToProcess),
            lineages: (this.selectLineagesStmt.all(worldId) as LineageRow[]).map(row =>
                rowToLineage(row, (edgesByLineage.get(row.id) ?? []).map(rowToLineageEdge))
            ),
            opportunities: (this.selectOpportunitiesStmt.all(worldId) as OpportunityRow[]).map(rowToOpportunity),
            objects: (this.selectObjectsStmt.all(worldId) as ObjectRow[]).map(row =>
                rowToObject(
                    row,
                    (claimsByObject.get(row.id) ?? []).map(rowToClaim),
                    (provenanceByObject.get(row.id) ?? []).map(rowToProvenance)
                )
            ),
            runs: (this.selectRunsStmt.all(worldId) as RunRow[]).map(rowToRun),
            ascensions: (this.selectAscensionsStmt.all(worldId) as AscensionRow[]).map(rowToAscension),
            history,
            memories,
            populationTarget: runtime.population_target,
            nextNpcSeq: runtime.next_npc_seq,
            nextEffectSeq: runtime.next_effect_seq,
            nextProcessSeq: runtime.next_process_seq,
            version: runtime.version
        };

        assertLoadable(state);
        return state;
    }

    listWorlds(): { id: string; seed: string; currentDay: number; version: number }[] {
        return (this.listRuntimeStmt.all() as RuntimeRow[]).map(row => ({
            id: row.id,
            seed: row.seed,
            currentDay: row.current_day,
            version: row.version
        }));
    }

    /** Cascades through every world_ table by foreign key. */
    deleteWorld(worldId: string): boolean {
        return this.deleteRuntimeStmt.run(worldId).changes > 0;
    }

    // ── RUNS ─────────────────────────────────────────────────────────────

    /**
     * Record that a life was lived here.
     *
     * Upsert rather than insert: a run is written when it starts and rewritten
     * when it ends, and the second write must not be a duplicate-key error at
     * exactly the moment a player has just died.
     */
    recordRun(worldId: string, run: WorldRun): void {
        this.insertRunStmt.run(runParams(worldId, run));
    }

    runsOf(worldId: string): WorldRun[] {
        return (this.selectRunsStmt.all(worldId) as RunRow[]).map(rowToRun);
    }

    /**
     * The index and seed the next run in this world gets.
     *
     * Derived from the world seed and the run index through the engine's own
     * `runSeedFor`, never stored independently and never generated fresh: the
     * same world must always produce the same third run, and starting a new one
     * must not perturb any stream the world has already drawn from.
     */
    nextRunSeed(worldId: string): { index: number; seed: string } | null {
        const runtime = this.selectRuntimeStmt.get(worldId) as RuntimeRow | undefined;
        if (!runtime) return null;

        const index = (this.selectRunsStmt.all(worldId) as RunRow[]).length;
        return { index, seed: runSeedFor(runtime.seed, index) };
    }

    // ── WRITE HELPERS ────────────────────────────────────────────────────

    private clearWorld(worldId: string): void {
        // Ordered child-first for readability; every table is world-scoped and
        // none of these have inter-table foreign keys, so order is not load
        // bearing here - it is documentation.
        for (const table of [
            'world_chronicle_actors', 'world_chronicle', 'world_eras',
            'world_location_changes', 'world_locations',
            'world_npc_goals', 'world_relationships', 'world_npcs',
            'world_actor_inventory', 'world_actors',
            'world_memory_actors', 'world_memories',
            'world_scheduled_effects', 'world_processes',
            'world_lineage_edges', 'world_lineages',
            'world_opportunities',
            'world_object_claims', 'world_object_provenance', 'world_objects',
            'world_factions', 'world_runs', 'world_ascensions'
        ]) {
            this.db.prepare(`DELETE FROM ${table} WHERE world_id = ?`).run(worldId);
        }
    }

    private writeAll(s: WorldState): void {
        this.writeEras(s);
        this.writeFacts(s, s.history.facts);
        this.writeMemories(s, s.memories.records);
        this.writeLocations(s);
        this.writeFactions(s);
        this.writeNpcs(s);
        this.writeActors(s);
        this.writeEffects(s);
        this.writeProcesses(s);
        this.writeLineages(s);
        this.writeRuns(s);
        this.writeAscensions(s);
        this.writeOpportunities(s);
        this.writeObjects(s);
    }

    private writeEras(s: WorldState): void {
        for (const era of s.history.eras) {
            this.insertEraStmt.run({
                id: era.id,
                worldId: s.id,
                name: era.name,
                startDay: era.startDay,
                endDay: era.endDay,
                qiDensity: era.qiDensity,
                note: era.note
            });
        }
    }

    private writeFacts(s: WorldState, facts: readonly HistoricalFact[]): void {
        for (const fact of facts) {
            this.insertFactStmt.run({
                id: fact.id,
                worldId: s.id,
                day: fact.day,
                eraId: fact.eraId,
                kind: fact.kind,
                scale: fact.scale,
                summary: fact.summary,
                locationId: fact.locationId,
                place: fact.place,
                visibility: fact.visibility,
                fidelity: fact.fidelity,
                causeKnown: fact.causeKnown ? 1 : 0,
                truth: fact.truth,
                claimedOutcomes: JSON.stringify(fact.claimedOutcomes),
                nearMiss: fact.nearMiss ? 1 : 0,
                nearMissNote: fact.nearMissNote,
                magnitude: fact.magnitude,
                actors: JSON.stringify(fact.actors),
                witnessIds: JSON.stringify(fact.witnessIds),
                factionIds: JSON.stringify(fact.factionIds),
                causes: JSON.stringify(fact.causes),
                locationChangeIds: JSON.stringify(fact.locationChangeIds),
                consequences: fact.consequences ? JSON.stringify(fact.consequences) : null,
                data: JSON.stringify(fact.data)
            });

            // The join table exists for the "what happened to her" query, which
            // belongs to callers rather than to this repo; loading a world reads
            // the ordered JSON mirror on the fact row instead, because that is
            // what has to come back byte-identical.
            const witnesses = new Set(fact.witnessIds);
            for (const actor of fact.actors) {
                this.insertFactActorStmt.run({
                    worldId: s.id,
                    factId: fact.id,
                    actorId: actor.id,
                    role: actor.role,
                    witnessed: witnesses.has(actor.id) ? 1 : 0
                });
            }
        }
    }

    private writeMemories(s: WorldState, records: readonly MemoryRecord[]): void {
        for (const memory of records) {
            this.insertMemoryStmt.run({
                id: memory.id,
                worldId: s.id,
                ownerId: memory.ownerId,
                kind: memory.kind,
                summary: memory.summary,
                detail: memory.detail,
                onDay: memory.onDay,
                actorIds: JSON.stringify(memory.actorIds),
                locationId: memory.locationId,
                factionIds: JSON.stringify(memory.factionIds),
                salience: memory.salience,
                tags: JSON.stringify(memory.tags),
                sourceFactIds: JSON.stringify(memory.sourceFactIds),
                compressedFrom: JSON.stringify(memory.compressedFromIds),
                compressed: memory.compressed ? 1 : 0,
                createdOnDay: memory.createdOnDay,
                updatedOnDay: memory.updatedOnDay
            });

            for (const actorId of memory.actorIds) {
                this.insertMemoryActorStmt.run({ worldId: s.id, memoryId: memory.id, actorId });
            }
        }
    }

    private writeLocations(s: WorldState): void {
        for (const location of s.locations) {
            this.insertLocationStmt.run({
                id: location.id,
                worldId: s.id,
                name: location.name,
                kind: location.kind,
                parentId: location.parentId,
                description: location.description,
                ambient: location.ambient,
                qiDensity: location.qiDensity,
                thresholdEntry: location.thresholds.entry,
                thresholdSurvival: location.thresholds.survival,
                thresholdOperational: location.thresholds.operational,
                thresholdMastery: location.thresholds.mastery,
                hazards: JSON.stringify(location.hazards),
                affinities: JSON.stringify(location.affinities),
                envSpiritualDensity: location.environment.spiritualDensity,
                envDanger: location.environment.danger,
                envResources: JSON.stringify(location.environment.resources),
                envClimate: location.environment.climate,
                envPoliticalControl: location.environment.politicalControl,
                envSpecialRules: JSON.stringify(location.environment.specialRules),
                envKnownSecrets: JSON.stringify(location.environment.knownSecrets),
                envHistoricalScars: JSON.stringify(location.environment.historicalScars),
                links: JSON.stringify(location.links),
                cyclePeriodDays: location.cycle?.periodDays ?? null,
                cycleOpenDays: location.cycle?.openDays ?? null,
                layer: location.layer,
                cyclePhaseDay: location.cycle?.phaseDay ?? null,
                sealed: location.sealed ? 1 : 0,
                sealedOnDay: location.sealedOnDay,
                discovered: location.discovered ? 1 : 0,
                discoveredOnDay: location.discoveredOnDay,
                controllingFactionId: location.controllingFactionId,
                originFactId: location.originFactId,
                originKind: location.origin.kind,
                originName: location.origin.name,
                originDescription: location.origin.description,
                originAmbient: location.origin.ambient,
                originQiDensity: location.origin.qiDensity,
                originThresholds: JSON.stringify(location.origin.thresholds),
                originHazards: JSON.stringify(location.origin.hazards),
                originAffinities: JSON.stringify(location.origin.affinities),
                originEnvironment: JSON.stringify(location.origin.environment),
                originFromDay: location.origin.fromDay,
                nextChangeSeq: location.nextChangeSeq,
                tags: JSON.stringify(location.tags),
                data: JSON.stringify(location.data)
            });

            for (const change of location.changes) {
                this.insertLocationChangeStmt.run({
                    id: change.id,
                    worldId: s.id,
                    locationId: location.id,
                    onDay: change.onDay,
                    kind: change.kind,
                    summary: change.summary,
                    causeFactId: change.causeFactId,
                    causeKnown: change.causeKnown ? 1 : 0,
                    attributedCauses: JSON.stringify(change.attributedCauses),
                    fidelity: change.fidelity,
                    witnessed: change.witnessed ? 1 : 0,
                    patch: JSON.stringify(change.patch)
                });
            }
        }
    }

    private writeFactions(s: WorldState): void {
        for (const faction of s.factions) {
            this.insertFactionStmt.run({
                id: faction.id,
                worldId: s.id,
                name: faction.name,
                kind: faction.kind,
                layer: faction.layer,
                alignment: faction.alignment,
                seatLocationId: faction.seatLocationId,
                controlledLocationIds: JSON.stringify(faction.controlledLocationIds),
                ranks: JSON.stringify(faction.ranks),
                standing: JSON.stringify(faction.standing),
                resources: JSON.stringify(faction.resources),
                description: faction.description,
                foundedOnDay: faction.foundedOnDay,
                dissolvedOnDay: faction.dissolvedOnDay,
                tags: JSON.stringify(faction.tags)
            });
        }
    }

    private writeNpcs(s: WorldState): void {
        for (const npc of s.npcs) {
            this.insertNpcStmt.run({
                id: npc.id,
                worldId: s.id,
                name: npc.name,
                bornOnDay: npc.identity.bornOnDay,
                origin: npc.identity.origin,
                occupation: npc.identity.occupation,
                titles: JSON.stringify(npc.identity.titles),
                aliases: JSON.stringify(npc.identity.aliases),
                description: npc.identity.description,
                realmOrdinal: npc.cultivation.realmOrdinal,
                spiritRoot: npc.cultivation.spiritRoot,
                attributes: JSON.stringify(npc.cultivation.attributes),
                foundation: npc.cultivation.foundation,
                untreatedInjuries: npc.cultivation.untreatedInjuries,
                wounds: JSON.stringify(npc.cultivation.injuries),
                techniqueIds: JSON.stringify(npc.cultivation.techniqueIds),
                specialties: JSON.stringify(npc.cultivation.specialties),
                lifespanEndsOnDay: npc.cultivation.lifespanEndsOnDay,
                lastAdvancedOnDay: npc.cultivation.lastAdvancedOnDay,
                accumulatingSinceDay: npc.cultivation.accumulatingSinceDay,
                locationId: npc.locationId,
                layer: npc.layer,
                factionId: npc.factionId,
                factionRankIndex: npc.factionRankIndex,
                spiritStones: npc.spiritStones,
                status: npc.status,
                bodyId: npc.bodyId,
                soulState: npc.soulState,
                identityContinuity: npc.identityContinuity,
                diedOnDay: npc.diedOnDay,
                endNote: npc.endNote,
                lastConfirmedOnDay: npc.lastConfirmedOnDay,
                updatedOnDay: npc.updatedOnDay,
                nextGoalSeq: npc.nextGoalSeq,
                tags: JSON.stringify(npc.tags),
                historyFactIds: JSON.stringify(npc.historyFactIds),
                memoryIds: JSON.stringify(npc.memoryIds)
            });

            for (const goal of npc.goals) {
                this.insertGoalStmt.run(goalParams(s.id, npc.id, goal));
            }
            for (const relationship of npc.relationships) {
                this.insertRelationshipStmt.run(relationshipParams(s.id, npc.id, relationship));
            }
        }
    }

    private writeActors(s: WorldState): void {
        for (const actor of s.actors) {
            this.insertActorStmt.run({
                worldId: s.id,
                actorId: actor.actorId,
                locationId: actor.locationId,
                layer: actor.layer,
                factionId: actor.factionId,
                factionRankIndex: actor.factionRankIndex,
                resources: JSON.stringify(actor.resources),
                keyIds: JSON.stringify(actor.keyIds),
                updatedOnDay: actor.updatedOnDay,
                historyFactIds: JSON.stringify(actor.historyFactIds),
                memoryIds: JSON.stringify(actor.memoryIds)
            });

            for (const item of actor.inventory) {
                this.insertInventoryStmt.run({
                    worldId: s.id,
                    actorId: actor.actorId,
                    itemId: item.itemId,
                    name: item.name,
                    kind: item.kind,
                    quantity: item.quantity,
                    note: item.note
                });
            }
            for (const relationship of actor.relationships) {
                this.insertRelationshipStmt.run(relationshipParams(s.id, actor.actorId, relationship));
            }
        }
    }

    private writeEffects(s: WorldState): void {
        for (const effect of s.schedule) {
            this.insertEffectStmt.run({
                id: effect.id,
                worldId: s.id,
                kind: effect.kind,
                dueOnDay: effect.dueOnDay,
                summary: effect.summary,
                actorIds: JSON.stringify(effect.actorIds),
                locationId: effect.locationId,
                factionId: effect.factionId,
                repeatDays: effect.repeatDays,
                interrupts: effect.interrupts ? 1 : 0,
                chance: effect.chance,
                fired: effect.fired ? 1 : 0,
                firedOnDay: effect.firedOnDay,
                data: JSON.stringify(effect.data)
            });
        }
    }

    private writeProcesses(s: WorldState): void {
        for (const process of s.processes) {
            this.insertProcessStmt.run({
                id: process.id,
                worldId: s.id,
                actorId: process.actorId,
                kind: process.kind,
                startedOnDay: process.startedOnDay,
                endsOnDay: process.endsOnDay,
                perDay: JSON.stringify(process.perDay),
                note: process.note
            });
        }
    }

    private writeLineages(s: WorldState): void {
        for (const lineage of s.lineages) {
            this.insertLineageStmt.run({
                id: lineage.id,
                worldId: s.id,
                surname: lineage.surname,
                founderId: lineage.founderId,
                foundedOnDay: lineage.foundedOnDay,
                memberIds: JSON.stringify(lineage.memberIds),
                traits: JSON.stringify(lineage.traits),
                reputation: lineage.reputation,
                holdings: JSON.stringify(lineage.holdings),
                obligationIds: JSON.stringify(lineage.obligationIds),
                inheritedEnemyIds: JSON.stringify(lineage.inheritedEnemyIds),
                extinctOnDay: lineage.extinctOnDay,
                tags: JSON.stringify(lineage.tags)
            });

            for (const edge of lineage.edges) {
                this.insertLineageEdgeStmt.run({
                    worldId: s.id,
                    lineageId: lineage.id,
                    parentId: edge.parentId,
                    childId: edge.childId,
                    relation: edge.relation,
                    onDay: edge.onDay,
                    note: edge.note
                });
            }
        }
    }

    private writeRuns(s: WorldState): void {
        for (const run of s.runs) {
            this.insertRunStmt.run(runParams(s.id, run));
        }
    }

    private writeAscensions(s: WorldState): void {
        for (const record of s.ascensions ?? []) {
            this.insertAscensionStmt.run({
                id: record.id,
                worldId: s.id,
                residentId: record.residentId,
                residentName: record.residentName,
                ascendedOnDay: record.ascendedOnDay,
                fromLocationId: record.fromLocationId,
                fromFactionId: record.fromFactionId,
                runId: record.runId,
                toLocationId: record.toLocationId,
                belowFactId: record.belowFactId,
                afterCrossing: record.afterCrossing,
                diedAboveOnDay: record.diedAboveOnDay,
                endNoteAbove: record.endNoteAbove,
                inheritanceLocationId: record.inheritanceLocationId,
                partingGiftObjectId: record.partingGiftObjectId
            });
        }
    }

    private writeOpportunities(s: WorldState): void {
        for (const opportunity of s.opportunities) {
            this.insertOpportunityStmt.run({
                id: opportunity.id,
                worldId: s.id,
                kind: opportunity.kind,
                name: opportunity.name,
                summary: opportunity.summary,
                locationId: opportunity.locationId,
                factionIds: JSON.stringify(opportunity.factionIds),
                opensOnDay: opportunity.opensOnDay,
                durationDays: opportunity.durationDays,
                recurrenceDays: opportunity.recurrenceDays,
                remainingOccurrences: opportunity.remainingOccurrences,
                endsAfterDay: opportunity.endsAfterDay,
                requirements: JSON.stringify(opportunity.requirements),
                claimed: opportunity.claimed ? 1 : 0,
                claimedById: opportunity.claimedById,
                claimedOnDay: opportunity.claimedOnDay,
                missedWindows: opportunity.missedWindows,
                knownToIds: JSON.stringify(opportunity.knownToIds),
                tags: JSON.stringify(opportunity.tags),
                data: JSON.stringify(opportunity.data)
            });
        }
    }

    private writeObjects(s: WorldState): void {
        for (const object of s.objects) {
            this.insertObjectStmt.run({
                id: object.id,
                worldId: s.id,
                name: object.name,
                kind: object.kind,
                significance: object.significance,
                description: object.description,
                power: object.power,
                possessorId: object.possessorId,
                ownerId: object.ownerId,
                ownerName: object.ownerName,
                knownOwnershipBy: JSON.stringify(object.knownOwnershipBy),
                locationId: object.locationId,
                tags: JSON.stringify(object.tags),
                data: JSON.stringify(object.data),
                nextClaimSeq: object.nextClaimSeq
            });

            for (const claim of object.claims) {
                this.insertClaimStmt.run({
                    id: claim.id,
                    worldId: s.id,
                    objectId: object.id,
                    claimantId: claim.claimantId,
                    claimantName: claim.claimantName,
                    basis: claim.basis,
                    assertedOnDay: claim.assertedOnDay,
                    strength: claim.strength,
                    acknowledgedByIds: JSON.stringify(claim.acknowledgedByIds),
                    evidenceFactIds: JSON.stringify(claim.evidenceFactIds),
                    note: claim.note,
                    active: claim.active ? 1 : 0
                });
            }

            // Provenance has no id of its own; the chain position is the key,
            // which is also what keeps it append-only and ordered on reload.
            object.provenance.forEach((entry, seq) => {
                this.insertProvenanceStmt.run({
                    worldId: s.id,
                    objectId: object.id,
                    seq,
                    onDay: entry.onDay,
                    holderId: entry.holderId,
                    holderName: entry.holderName,
                    how: entry.how,
                    source: entry.source,
                    previousHolderId: entry.previousHolderId,
                    previousHolderName: entry.previousHolderName,
                    factId: entry.factId,
                    note: entry.note
                });
            });
        }
    }

    /**
     * Refuse to write a living NPC over a stored dead one.
     *
     * There is no path in the engine that sets `alive` back, and this is the
     * boundary that keeps it that way when a caller hands over a stale world
     * loaded before somebody died. A dead cultivator stays dead and only their
     * consequences continue - the grave, the inherited goal, the sect that
     * remembers - and a save that quietly reanimated them would take the whole
     * feature with it. Rejecting rather than repairing, because the repair
     * would be to decide which of two disagreeing worlds is real, and this
     * layer does not get to decide that.
     */
    private assertNoResurrection(s: WorldState): void {
        const stored = this.deadNpcIdsStmt.all(s.id) as { id: string; status: string; died_on_day: number | null }[];
        if (stored.length === 0) return;

        const deadById = new Map(stored.map(row => [row.id, row]));
        const raised: string[] = [];
        for (const npc of s.npcs) {
            const dead = deadById.get(npc.id);
            if (dead && npc.status === 'alive') {
                raised.push(`${npc.id} (stored as ${dead.status} on day ${dead.died_on_day ?? 'unknown'})`);
            }
        }

        if (raised.length > 0) {
            throw new Error(
                `Refusing to save world ${s.id}: ${raised.length} NPC(s) would be resurrected - ` +
                `${raised.slice(0, 5).join('; ')}${raised.length > 5 ? '; ...' : ''}. ` +
                'Nothing in this engine sets a dead record back to alive; this world is stale.'
            );
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// PARAMETER BUILDERS
// Shared by the full save and the append path so the two cannot drift.
// ─────────────────────────────────────────────────────────────────────────

function runtimeParams(s: WorldState): Record<string, unknown> {
    return {
        id: s.id,
        seed: s.seed,
        currentDay: s.currentDay,
        version: s.version,
        nextNpcSeq: s.nextNpcSeq,
        nextEffectSeq: s.nextEffectSeq,
        nextProcessSeq: s.nextProcessSeq,
        nextFactSeq: s.history.nextFactSeq,
        nextMemorySeq: s.memories.nextSeq,
        populationTarget: s.populationTarget
    };
}

function runParams(worldId: string, run: WorldRun): Record<string, unknown> {
    return {
        id: run.id,
        worldId,
        runIndex: run.index,
        seed: run.seed,
        cultivatorId: run.cultivatorId,
        cultivatorName: run.cultivatorName,
        startedOnDay: run.startedOnDay,
        endedOnDay: run.endedOnDay,
        outcome: run.outcome,
        peakOrdinal: run.peakOrdinal,
        graveLocationId: run.graveLocationId,
        successorRelation: run.successorRelation
    };
}

function goalParams(worldId: string, npcId: string, goal: NpcGoal): Record<string, unknown> {
    return {
        id: goal.id,
        worldId,
        npcId,
        kind: goal.kind,
        text: goal.text,
        priority: goal.priority,
        progress: goal.progress,
        obstacles: JSON.stringify(goal.obstacles),
        deadlineOnDay: goal.deadlineOnDay,
        status: goal.status,
        targetId: goal.targetId,
        // The date that makes a three-hundred-year-old goal legible as three
        // hundred years old. Preserved verbatim across every handoff; nothing
        // in this layer re-stamps it to the day of the inheritance.
        openedOnDay: goal.openedOnDay,
        closedOnDay: goal.closedOnDay,
        note: goal.note,
        inheritedFromId: goal.inheritedFromId,
        originHolderId: goal.originHolderId,
        generation: goal.generation
    };
}

function relationshipParams(
    worldId: string,
    ownerId: string,
    relationship: NpcRelationship
): Record<string, unknown> {
    return {
        worldId,
        ownerId,
        targetId: relationship.targetId,
        targetName: relationship.targetName,
        kind: relationship.kind,
        standing: relationship.standing,
        note: relationship.note,
        // Survives every later change, so a forty-year friendship that turns
        // hostile is still forty years old.
        sinceDay: relationship.sinceDay,
        lastChangedDay: relationship.lastChangedDay,
        factIds: JSON.stringify(relationship.factIds),
        inheritedFromId: relationship.inheritedFromId
    };
}

// ─────────────────────────────────────────────────────────────────────────
// ROW MAPPING
// ─────────────────────────────────────────────────────────────────────────

function parseArray<T>(json: string): T[] {
    return JSON.parse(json) as T[];
}

function parseRecord<T>(json: string): Record<string, T> {
    return JSON.parse(json) as Record<string, T>;
}

/**
 * Wound rows off a row written before the column existed.
 *
 * The ALTER defaults to '[]', so this only has to be defensive about a save
 * that predates the ALTER entirely and hands back undefined. An absent list is
 * not "no wounds" - `woundsCarriedBy` reads the count beside it and
 * reconstructs generic rows for the shortfall.
 */
function parseWounds(json: string | null | undefined): Injury[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed as Injury[] : [];
    } catch {
        return [];
    }
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
    const out = new Map<string, T[]>();
    for (const row of rows) {
        const k = key(row);
        const bucket = out.get(k);
        if (bucket) bucket.push(row);
        else out.set(k, [row]);
    }
    return out;
}

function rowToEra(row: EraRow): Era {
    return {
        id: row.id,
        name: row.name,
        startDay: row.start_day,
        endDay: row.end_day,
        qiDensity: row.qi_density,
        note: row.note
    };
}

function rowToFact(row: FactRow): HistoricalFact {
    return {
        id: row.id,
        day: row.day,
        // Derived, never stored: the table keeps one clock so the two cannot
        // drift out of agreement.
        year: yearOfDay(row.day),
        eraId: row.era_id,
        kind: row.kind as HistoricalFact['kind'],
        scale: row.scale as HistoricalFact['scale'],
        actors: parseArray(row.actors),
        witnessIds: parseArray(row.witness_ids),
        locationId: row.location_id,
        place: row.place,
        factionIds: parseArray(row.faction_ids),
        summary: row.summary,
        causes: parseArray(row.causes),
        locationChangeIds: parseArray(row.location_change_ids),
        visibility: row.visibility as HistoricalFact['visibility'],
        fidelity: row.fidelity as HistoricalFact['fidelity'],
        causeKnown: row.cause_known === 1,
        magnitude: row.magnitude,
        consequences: row.consequences ? JSON.parse(row.consequences) : null,
        nearMiss: row.near_miss === 1,
        nearMissNote: row.near_miss_note,
        truth: row.truth as HistoricalFact['truth'],
        claimedOutcomes: parseArray(row.claimed_outcomes),
        data: parseRecord(row.data)
    };
}

function rowToLocation(row: LocationRow, changes: LocationChange[]): LocationRecord {
    return {
        id: row.id,
        name: row.name,
        kind: row.kind as LocationRecord['kind'],
        layer: toLayerKey(row.layer),
        parentId: row.parent_id,
        description: row.description,
        ambient: row.ambient as LocationRecord['ambient'],
        qiDensity: row.qi_density,
        thresholds: {
            entry: row.threshold_entry,
            survival: row.threshold_survival,
            operational: row.threshold_operational,
            mastery: row.threshold_mastery
        },
        hazards: parseArray(row.hazards),
        affinities: parseArray(row.affinities),
        environment: {
            spiritualDensity: row.env_spiritual_density,
            danger: row.env_danger,
            resources: parseArray(row.env_resources),
            climate: row.env_climate,
            politicalControl: row.env_political_control,
            specialRules: parseArray(row.env_special_rules),
            knownSecrets: parseArray(row.env_known_secrets),
            historicalScars: parseArray(row.env_historical_scars)
        },
        links: parseArray(row.links),
        // All three columns move together or the cycle is absent; a partial
        // cycle is not a state the engine can express.
        cycle: row.cycle_period_days === null
            ? null
            : {
                periodDays: row.cycle_period_days,
                openDays: row.cycle_open_days ?? 0,
                phaseDay: row.cycle_phase_day ?? 0
            },
        sealed: row.sealed === 1,
        sealedOnDay: row.sealed_on_day,
        discovered: row.discovered === 1,
        discoveredOnDay: row.discovered_on_day,
        controllingFactionId: row.controlling_faction_id,
        originFactId: row.origin_fact_id,
        origin: {
            kind: row.origin_kind as LocationRecord['kind'],
            name: row.origin_name,
            description: row.origin_description,
            ambient: row.origin_ambient as LocationRecord['ambient'],
            qiDensity: row.origin_qi_density,
            thresholds: JSON.parse(row.origin_thresholds),
            hazards: parseArray(row.origin_hazards),
            affinities: parseArray(row.origin_affinities),
            environment: JSON.parse(row.origin_environment),
            fromDay: row.origin_from_day
        },
        changes,
        nextChangeSeq: row.next_change_seq,
        tags: parseArray(row.tags),
        data: parseRecord(row.data)
    };
}

function rowToLocationChange(row: LocationChangeRow): LocationChange {
    return {
        id: row.id,
        onDay: row.on_day,
        kind: row.kind as LocationChange['kind'],
        summary: row.summary,
        causeFactId: row.cause_fact_id,
        causeKnown: row.cause_known === 1,
        attributedCauses: parseArray(row.attributed_causes),
        fidelity: row.fidelity as LocationChange['fidelity'],
        witnessed: row.witnessed === 1,
        patch: JSON.parse(row.patch)
    };
}

function rowToFaction(row: FactionRow): FactionRecord {
    return {
        id: row.id,
        name: row.name,
        kind: row.kind,
        layer: toLayerKey(row.layer),
        alignment: row.alignment as FactionRecord['alignment'],
        seatLocationId: row.seat_location_id,
        controlledLocationIds: parseArray(row.controlled_location_ids),
        ranks: parseArray(row.ranks),
        standing: parseRecord(row.standing),
        resources: parseRecord(row.resources),
        description: row.description,
        foundedOnDay: row.founded_on_day,
        dissolvedOnDay: row.dissolved_on_day,
        tags: parseArray(row.tags)
    };
}

function rowToNpc(row: NpcRow, goals: NpcGoal[], relationships: NpcRelationship[]): NpcRecord {
    return {
        id: row.id,
        name: row.name,
        identity: {
            bornOnDay: row.born_on_day,
            origin: isOriginTierKey(row.origin_tier) ? row.origin_tier : DEFAULT_ORIGIN,
            occupation: row.occupation,
            titles: parseArray(row.titles),
            aliases: parseArray(row.aliases),
            description: row.description
        },
        cultivation: {
            realmOrdinal: row.realm_ordinal,
            spiritRoot: row.spirit_root as NpcRecord['cultivation']['spiritRoot'],
            attributes: JSON.parse(row.attributes),
            foundation: row.foundation,
            untreatedInjuries: row.untreated_injuries,
            injuries: parseWounds(row.wounds),
            techniqueIds: parseArray(row.technique_ids),
            specialties: parseArray(row.specialties),
            lifespanEndsOnDay: row.lifespan_ends_on_day,
            lastAdvancedOnDay: row.last_advanced_on_day,
            // Zero means the column predates the two clocks being told apart.
            accumulatingSinceDay:
                row.accumulating_since_day || row.last_advanced_on_day
        },
        locationId: row.location_id,
        layer: toLayerKey(row.layer),
        factionId: row.faction_id,
        factionRankIndex: row.faction_rank_index,
        spiritStones: row.spirit_stones ?? 0,
        goals,
        relationships,
        historyFactIds: parseArray(row.history_fact_ids),
        memoryIds: parseArray(row.memory_ids),
        status: row.status as NpcRecord['status'],
        bodyId: row.body_id,
        soulState: row.soul_state as NpcRecord['soulState'],
        identityContinuity: row.identity_continuity,
        diedOnDay: row.died_on_day,
        endNote: row.end_note,
        lastConfirmedOnDay: row.last_confirmed_on_day,
        updatedOnDay: row.updated_on_day,
        tags: parseArray(row.tags),
        nextGoalSeq: row.next_goal_seq
    };
}

function rowToGoal(row: GoalRow): NpcGoal {
    return {
        id: row.id,
        kind: row.kind as NpcGoal['kind'],
        text: row.text,
        priority: row.priority,
        progress: row.progress,
        obstacles: parseArray(row.obstacles),
        deadlineOnDay: row.deadline_on_day,
        status: row.status as NpcGoal['status'],
        targetId: row.target_id,
        openedOnDay: row.opened_on_day,
        closedOnDay: row.closed_on_day,
        note: row.note,
        inheritedFromId: row.inherited_from_id,
        originHolderId: row.origin_holder_id,
        generation: row.generation
    };
}

function rowToRelationship(row: RelationshipRow): NpcRelationship {
    return {
        targetId: row.target_id,
        targetName: row.target_name,
        kind: row.kind as NpcRelationship['kind'],
        standing: row.standing,
        note: row.note,
        sinceDay: row.since_day,
        lastChangedDay: row.last_changed_day,
        factIds: parseArray(row.fact_ids),
        inheritedFromId: row.inherited_from_id
    };
}

function rowToActor(
    row: ActorRow,
    inventory: InventoryItem[],
    relationships: NpcRelationship[]
): ActorWorldState {
    return {
        actorId: row.actor_id,
        locationId: row.location_id,
        layer: toLayerKey(row.layer),
        factionId: row.faction_id,
        factionRankIndex: row.faction_rank_index,
        inventory,
        resources: parseRecord(row.resources),
        relationships,
        memoryIds: parseArray(row.memory_ids),
        historyFactIds: parseArray(row.history_fact_ids),
        keyIds: parseArray(row.key_ids),
        updatedOnDay: row.updated_on_day
    };
}

function rowToInventoryItem(row: InventoryRow): InventoryItem {
    return {
        itemId: row.item_id,
        name: row.name,
        kind: row.kind,
        quantity: row.quantity,
        note: row.note
    };
}

function rowToMemory(row: MemoryRow): MemoryRecord {
    return {
        id: row.id,
        ownerId: row.owner_id,
        kind: row.kind as MemoryRecord['kind'],
        summary: row.summary,
        detail: row.detail,
        onDay: row.on_day,
        actorIds: parseArray(row.actor_ids),
        locationId: row.location_id,
        factionIds: parseArray(row.faction_ids),
        salience: row.salience,
        tags: parseArray(row.tags),
        sourceFactIds: parseArray(row.source_fact_ids),
        compressedFromIds: parseArray(row.compressed_from),
        compressed: row.compressed === 1,
        createdOnDay: row.created_on_day,
        updatedOnDay: row.updated_on_day
    };
}

function rowToEffect(row: EffectRow): ScheduledEffect {
    return {
        id: row.id,
        kind: row.kind as ScheduledEffect['kind'],
        dueOnDay: row.due_on_day,
        summary: row.summary,
        actorIds: parseArray(row.actor_ids),
        locationId: row.location_id,
        factionId: row.faction_id,
        repeatDays: row.repeat_days,
        interrupts: row.interrupts === 1,
        chance: row.chance,
        fired: row.fired === 1,
        firedOnDay: row.fired_on_day,
        data: parseRecord(row.data)
    };
}

function rowToProcess(row: ProcessRow): DurableProcess {
    return {
        id: row.id,
        actorId: row.actor_id,
        kind: row.kind as DurableProcess['kind'],
        startedOnDay: row.started_on_day,
        endsOnDay: row.ends_on_day,
        perDay: parseRecord(row.per_day),
        note: row.note
    };
}

function rowToLineage(row: LineageRow, edges: LineageEdge[]): LineageRecord {
    return {
        id: row.id,
        surname: row.surname,
        founderId: row.founder_id,
        foundedOnDay: row.founded_on_day,
        memberIds: parseArray(row.member_ids),
        edges,
        traits: parseArray(row.traits),
        reputation: row.reputation,
        holdings: parseRecord(row.holdings),
        obligationIds: parseArray(row.obligation_ids),
        inheritedEnemyIds: parseArray(row.inherited_enemy_ids),
        extinctOnDay: row.extinct_on_day,
        tags: parseArray(row.tags)
    };
}

function rowToLineageEdge(row: LineageEdgeRow): LineageEdge {
    return {
        parentId: row.parent_id,
        childId: row.child_id,
        relation: row.relation as LineageEdge['relation'],
        onDay: row.on_day,
        note: row.note
    };
}

function rowToRun(row: RunRow): WorldRun {
    return {
        id: row.id,
        seed: row.seed,
        index: row.run_index,
        cultivatorId: row.cultivator_id,
        cultivatorName: row.cultivator_name,
        startedOnDay: row.started_on_day,
        endedOnDay: row.ended_on_day,
        outcome: row.outcome as WorldRun['outcome'],
        peakOrdinal: row.peak_ordinal,
        graveLocationId: row.grave_location_id,
        successorRelation: row.successor_relation as WorldRun['successorRelation']
    };
}

/**
 * The engine's own answer to what became of somebody who crossed.
 *
 * "after_crossing" round-trips because the engine is allowed to know things
 * the world cannot. Nothing that renders to a player may read it: below the
 * Lid there is no signal at all, and a house whose channel has gone quiet
 * knows exactly as much as one whose ancestor is standing up there ignoring it.
 */
function rowToAscension(row: AscensionRow): AscensionRecord {
    return makeAscensionRecord({
        id: row.id,
        residentId: row.resident_id,
        residentName: row.resident_name,
        ascendedOnDay: row.ascended_on_day,
        fromLocationId: row.from_location_id,
        fromFactionId: row.from_faction_id,
        runId: row.run_id,
        toLocationId: row.to_location_id,
        belowFactId: row.below_fact_id,
        afterCrossing: row.after_crossing === 'died_above' ? 'died_above' : 'still_above',
        diedAboveOnDay: row.died_above_on_day,
        endNoteAbove: row.end_note_above,
        inheritanceLocationId: row.inheritance_location_id,
        partingGiftObjectId: row.parting_gift_object_id
    });
}

function rowToOpportunity(row: OpportunityRow): OpportunityWindow {
    return {
        id: row.id,
        kind: row.kind as OpportunityWindow['kind'],
        name: row.name,
        summary: row.summary,
        locationId: row.location_id,
        factionIds: parseArray(row.faction_ids),
        opensOnDay: row.opens_on_day,
        durationDays: row.duration_days,
        recurrenceDays: row.recurrence_days,
        remainingOccurrences: row.remaining_occurrences,
        endsAfterDay: row.ends_after_day,
        requirements: JSON.parse(row.requirements),
        claimed: row.claimed === 1,
        claimedById: row.claimed_by_id,
        claimedOnDay: row.claimed_on_day,
        missedWindows: row.missed_windows,
        knownToIds: parseArray(row.known_to_ids),
        tags: parseArray(row.tags),
        data: parseRecord(row.data)
    };
}

function rowToObject(
    row: ObjectRow,
    claims: OwnershipClaim[],
    provenance: ProvenanceEntry[]
): ObjectRecord {
    return {
        id: row.id,
        name: row.name,
        kind: row.kind as ObjectRecord['kind'],
        significance: row.significance as ObjectRecord['significance'],
        description: row.description,
        power: row.power,
        possessorId: row.possessor_id,
        ownerId: row.owner_id,
        ownerName: row.owner_name,
        claims,
        provenance,
        knownOwnershipBy: parseArray(row.known_ownership_by),
        locationId: row.location_id,
        tags: parseArray(row.tags),
        data: parseRecord(row.data),
        nextClaimSeq: row.next_claim_seq
    };
}

function rowToClaim(row: ClaimRow): OwnershipClaim {
    return {
        id: row.id,
        claimantId: row.claimant_id,
        claimantName: row.claimant_name,
        basis: row.basis as OwnershipClaim['basis'],
        assertedOnDay: row.asserted_on_day,
        strength: row.strength,
        acknowledgedByIds: parseArray(row.acknowledged_by_ids),
        evidenceFactIds: parseArray(row.evidence_fact_ids),
        note: row.note,
        active: row.active === 1
    };
}

function rowToProvenance(row: ProvenanceRow): ProvenanceEntry {
    return {
        onDay: row.on_day,
        holderId: row.holder_id,
        holderName: row.holder_name,
        how: row.how as ProvenanceEntry['how'],
        source: row.source,
        previousHolderId: row.previous_holder_id,
        previousHolderName: row.previous_holder_name,
        factId: row.fact_id,
        note: row.note
    };
}

/**
 * Fail loudly on a world that came back structurally wrong.
 *
 * The world layer has no Zod schemas to parse through, so this is the
 * equivalent boundary: the checks that catch a migration that stopped matching
 * the shape, rather than a general-purpose validator. Sequence counters are
 * the load-bearing ones - ids are minted from them (`f7`, `m7`, `e7`), so a
 * counter that came back below what is already stored would mint a duplicate
 * id on the next write and silently overwrite history.
 */
function assertLoadable(state: WorldState): void {
    const problems: string[] = [];

    if (state.history.nextFactSeq <= state.history.facts.length) {
        problems.push(
            `nextFactSeq ${state.history.nextFactSeq} is not past the ${state.history.facts.length} ` +
            'facts already stored; the next fact written would reuse an id'
        );
    }
    if (state.memories.nextSeq <= state.memories.records.length) {
        problems.push(
            `memories.nextSeq ${state.memories.nextSeq} is not past the ${state.memories.records.length} ` +
            'records already stored; the next memory written would reuse an id'
        );
    }
    for (const npc of state.npcs) {
        if (!npc.id || !npc.name) {
            problems.push(`an NPC row loaded without an id or name (id: ${npc.id || '<empty>'})`);
            break;
        }
    }
    for (const location of state.locations) {
        if (!location.id) {
            problems.push('a location row loaded without an id');
            break;
        }
    }

    if (problems.length > 0) {
        throw new Error(
            `World ${state.id} did not load cleanly: ${problems.join('; ')}. ` +
            'This is schema drift between migrations.world.ts and engine/world, not bad data.'
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────
// ROW SHAPES
// Declared explicitly so a column rename in the migration fails compilation
// here rather than producing `undefined` at the boundary.
// ─────────────────────────────────────────────────────────────────────────

interface RuntimeRow {
    id: string;
    seed: string;
    current_day: number;
    version: number;
    next_npc_seq: number;
    next_effect_seq: number;
    next_process_seq: number;
    next_fact_seq: number;
    next_memory_seq: number;
    population_target: number;
}

interface EraRow {
    id: string;
    name: string;
    start_day: number;
    end_day: number | null;
    qi_density: number;
    note: string;
}

interface FactRow {
    id: string;
    day: number;
    era_id: string;
    kind: string;
    scale: string;
    summary: string;
    location_id: string | null;
    place: string | null;
    visibility: string;
    fidelity: string;
    cause_known: number;
    truth: string;
    claimed_outcomes: string;
    near_miss: number;
    near_miss_note: string;
    magnitude: number;
    actors: string;
    witness_ids: string;
    faction_ids: string;
    causes: string;
    location_change_ids: string;
    consequences: string | null;
    data: string;
}

interface AscensionRow {
    id: string;
    resident_id: string;
    resident_name: string;
    ascended_on_day: number;
    from_location_id: string | null;
    from_faction_id: string | null;
    run_id: string | null;
    to_location_id: string;
    below_fact_id: string | null;
    after_crossing: string;
    died_above_on_day: number | null;
    end_note_above: string;
    inheritance_location_id: string | null;
    parting_gift_object_id: string | null;
}

interface LocationRow {
    id: string;
    name: string;
    kind: string;
    layer: string;
    parent_id: string | null;
    description: string;
    ambient: string;
    qi_density: number;
    threshold_entry: number;
    threshold_survival: number;
    threshold_operational: number;
    threshold_mastery: number;
    hazards: string;
    affinities: string;
    env_spiritual_density: number;
    env_danger: number;
    env_resources: string;
    env_climate: string;
    env_political_control: string;
    env_special_rules: string;
    env_known_secrets: string;
    env_historical_scars: string;
    links: string;
    cycle_period_days: number | null;
    cycle_open_days: number | null;
    cycle_phase_day: number | null;
    sealed: number;
    sealed_on_day: number | null;
    discovered: number;
    discovered_on_day: number | null;
    controlling_faction_id: string | null;
    origin_fact_id: string | null;
    origin_kind: string;
    origin_name: string;
    origin_description: string;
    origin_ambient: string;
    origin_qi_density: number;
    origin_thresholds: string;
    origin_hazards: string;
    origin_affinities: string;
    origin_environment: string;
    origin_from_day: number | null;
    next_change_seq: number;
    tags: string;
    data: string;
}

interface LocationChangeRow {
    id: string;
    location_id: string;
    on_day: number;
    kind: string;
    summary: string;
    cause_fact_id: string | null;
    cause_known: number;
    attributed_causes: string;
    fidelity: string;
    witnessed: number;
    patch: string;
}

interface FactionRow {
    id: string;
    name: string;
    kind: string;
    layer: string;
    alignment: string;
    seat_location_id: string | null;
    controlled_location_ids: string;
    ranks: string;
    standing: string;
    resources: string;
    description: string;
    founded_on_day: number | null;
    dissolved_on_day: number | null;
    tags: string;
}

interface NpcRow {
    id: string;
    name: string;
    born_on_day: number;
    origin_tier: string;
    occupation: string;
    titles: string;
    aliases: string;
    description: string;
    realm_ordinal: number;
    spirit_root: string;
    attributes: string;
    foundation: string;
    untreated_injuries: number;
    wounds: string;
    technique_ids: string;
    specialties: string;
    lifespan_ends_on_day: number;
    last_advanced_on_day: number;
    accumulating_since_day: number;
    location_id: string | null;
    layer: string;
    faction_id: string | null;
    faction_rank_index: number;
    spirit_stones: number;
    status: string;
    body_id: string | null;
    soul_state: string;
    identity_continuity: number;
    died_on_day: number | null;
    end_note: string;
    last_confirmed_on_day: number;
    updated_on_day: number;
    next_goal_seq: number;
    tags: string;
    history_fact_ids: string;
    memory_ids: string;
}

interface GoalRow {
    id: string;
    npc_id: string;
    kind: string;
    text: string;
    priority: number;
    progress: string;
    obstacles: string;
    deadline_on_day: number | null;
    status: string;
    target_id: string | null;
    opened_on_day: number;
    closed_on_day: number | null;
    note: string;
    inherited_from_id: string | null;
    origin_holder_id: string;
    generation: number;
}

interface RelationshipRow {
    owner_id: string;
    target_id: string;
    target_name: string;
    kind: string;
    standing: number;
    note: string;
    since_day: number;
    last_changed_day: number;
    fact_ids: string;
    inherited_from_id: string | null;
}

interface ActorRow {
    actor_id: string;
    location_id: string | null;
    layer: string;
    faction_id: string | null;
    faction_rank_index: number;
    resources: string;
    key_ids: string;
    updated_on_day: number;
    history_fact_ids: string;
    memory_ids: string;
}

interface InventoryRow {
    actor_id: string;
    item_id: string;
    name: string;
    kind: string;
    quantity: number;
    note: string;
}

interface MemoryRow {
    id: string;
    owner_id: string;
    kind: string;
    summary: string;
    detail: string;
    on_day: number;
    actor_ids: string;
    location_id: string | null;
    faction_ids: string;
    salience: number;
    tags: string;
    source_fact_ids: string;
    compressed_from: string;
    compressed: number;
    created_on_day: number;
    updated_on_day: number;
}

interface EffectRow {
    id: string;
    kind: string;
    due_on_day: number;
    summary: string;
    actor_ids: string;
    location_id: string | null;
    faction_id: string | null;
    repeat_days: number | null;
    interrupts: number;
    chance: number;
    fired: number;
    fired_on_day: number | null;
    data: string;
}

interface ProcessRow {
    id: string;
    actor_id: string;
    kind: string;
    started_on_day: number;
    ends_on_day: number | null;
    per_day: string;
    note: string;
}

interface LineageRow {
    id: string;
    surname: string;
    founder_id: string;
    founded_on_day: number;
    member_ids: string;
    traits: string;
    reputation: number;
    holdings: string;
    obligation_ids: string;
    inherited_enemy_ids: string;
    extinct_on_day: number | null;
    tags: string;
}

interface LineageEdgeRow {
    lineage_id: string;
    parent_id: string;
    child_id: string;
    relation: string;
    on_day: number;
    note: string;
}

interface RunRow {
    id: string;
    run_index: number;
    seed: string;
    cultivator_id: string;
    cultivator_name: string;
    started_on_day: number;
    ended_on_day: number | null;
    outcome: string;
    peak_ordinal: number;
    grave_location_id: string | null;
    successor_relation: string | null;
}

interface OpportunityRow {
    id: string;
    kind: string;
    name: string;
    summary: string;
    location_id: string | null;
    faction_ids: string;
    opens_on_day: number;
    duration_days: number;
    recurrence_days: number | null;
    remaining_occurrences: number | null;
    ends_after_day: number | null;
    requirements: string;
    claimed: number;
    claimed_by_id: string | null;
    claimed_on_day: number | null;
    missed_windows: number;
    known_to_ids: string;
    tags: string;
    data: string;
}

interface ObjectRow {
    id: string;
    name: string;
    kind: string;
    significance: string;
    description: string;
    power: number | null;
    possessor_id: string | null;
    owner_id: string | null;
    owner_name: string;
    known_ownership_by: string;
    location_id: string | null;
    tags: string;
    data: string;
    next_claim_seq: number;
}

interface ClaimRow {
    id: string;
    object_id: string;
    claimant_id: string;
    claimant_name: string;
    basis: string;
    asserted_on_day: number;
    strength: number;
    acknowledged_by_ids: string;
    evidence_fact_ids: string;
    note: string;
    active: number;
}

interface ProvenanceRow {
    object_id: string;
    seq: number;
    on_day: number;
    holder_id: string | null;
    holder_name: string;
    how: string;
    source: string;
    previous_holder_id: string | null;
    previous_holder_name: string | null;
    fact_id: string | null;
    note: string;
}
