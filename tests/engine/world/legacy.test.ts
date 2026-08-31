import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    enshrineRun,
    lastFinishedRun,
    planNextRun,
    predecessorOf,
    previousRunGraves,
    recordRun,
    runSeedFor,
    worldRuns,
    type WorldRun
} from '../../../src/engine/world/legacy.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { evaluateAccess } from '../../../src/engine/world/locations.js';
import { queryFacts } from '../../../src/engine/world/history.js';
import { searchMemories } from '../../../src/engine/world/memory.js';
import { addGoal, setRealm, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { addLineageEdge, createLineageRecord } from '../../../src/engine/world/lineage.js';
import {
    BELIEVED_REACH,
    believedStatement,
    computeTheoreticalReach,
    ladderOddsReport,
    measureLadderReach
} from '../../../src/engine/world/ladder-odds.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { migrate } from '../../../src/storage/migrations.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

function world(seed = 'leg-a'): WorldState {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population: 200 }).state;
}

/** A cultivator with a sect, a family and an unfinished account. */
function protagonist(state: WorldState) {
    const at = state.npcs.findIndex(n => n.factionId !== null && n.status === 'alive');
    let npc = state.npcs[at];
    npc = setRealm(npc, 15, state.currentDay - 5 * YEAR);
    npc = addGoal(npc, {
        kind: 'revenge',
        text: 'Settle the account at the Weir.',
        priority: 0.9,
        progress: 'Knows who, does not know where.',
        obstacles: ['Not strong enough.']
    }, state.currentDay - 20 * YEAR);
    const enemy = state.npcs.find(n => n.id !== npc.id)!;
    npc = upsertRelationship(npc, {
        targetId: enemy.id,
        targetName: enemy.name,
        kind: 'enemy',
        standing: -0.9,
        note: 'Killed somebody.'
    }, state.currentDay - 20 * YEAR);
    state.npcs[at] = npc;

    // A child, so there is somewhere for it all to go.
    const heir = state.npcs.find(
        n => n.id !== npc.id && n.status === 'alive' &&
            n.identity.bornOnDay > npc.identity.bornOnDay + 18 * YEAR
    )!;
    let lineage = createLineageRecord({
        id: 'lin-protagonist',
        surname: npc.name.split(' ')[0],
        founderId: npc.id,
        foundedOnDay: npc.identity.bornOnDay
    });
    lineage = addLineageEdge(lineage, {
        parentId: npc.id,
        childId: heir.id,
        relation: 'descendant',
        onDay: heir.identity.bornOnDay
    });
    state.lineages.push(lineage);
    return { npc: state.npcs[at], heir };
}

describe('legacy: the world outlives the run', () => {
    it('puts the dead cultivator on the map as a grave holding what they carried', () => {
        const state = world();
        const { npc } = protagonist(state);
        const out = enshrineRun(state, {
            npcId: npc.id,
            onDay: state.currentDay,
            causeNote: 'Failed the crossing into Core Formation. The meridians went.',
            carried: [
                { itemId: 'item-sword', name: 'a plain sword', kind: 'artifact', quantity: 1 },
                { itemId: 'item-manual', name: 'a copied manual', kind: 'manual', quantity: 1 }
            ],
            spiritStones: 412
        });

        expect(out.grave).not.toBeNull();
        expect(out.grave!.kind).toBe('grave');
        expect(out.grave!.data.occupantName).toBe(npc.name);
        expect(out.grave!.data.spiritStones).toBe(412);
        expect(out.goods).toHaveLength(2);
        // Findable, not given: nobody knows it is there yet.
        expect(out.grave!.discovered).toBe(false);
        expect(previousRunGraves(state).map(g => g.id)).toContain(out.grave!.id);

        // Gated by what they were, so robbing it is a real question.
        const weak = evaluateAccess(out.grave!, { realmOrdinal: 2 });
        expect(weak.level).not.toBe('mastered');
        expect(evaluateAccess(out.grave!, { realmOrdinal: 20 }).level).toBe('mastered');

        // The goods carry them in their provenance, so a sect could recognise
        // its own missing property centuries later.
        expect(out.goods[0].provenance[0].source).toContain(npc.name);
    });

    it('never resurrects anybody', () => {
        const state = world();
        const { npc } = protagonist(state);
        enshrineRun(state, { npcId: npc.id, onDay: state.currentDay, causeNote: 'Died.' });
        const after = state.npcs.find(n => n.id === npc.id)!;
        expect(after.status).toBe('physically_dead');
        expect(after.diedOnDay).not.toBeNull();

        // Advancing the world does not bring them back.
        advanceWorldYears(state, 200);
        expect(state.npcs.find(n => n.id === npc.id)!.status).toBe('physically_dead');
    });

    it('makes the sect remember them, and what the crossing cost', () => {
        const state = world();
        const { npc } = protagonist(state);
        const out = enshrineRun(state, {
            npcId: npc.id,
            onDay: state.currentDay,
            causeNote: 'Died crossing, with two elders holding the qi steady.'
        });

        expect(out.rememberedBy.length).toBeGreaterThan(0);
        for (const id of out.rememberedBy) {
            const survivor = state.npcs.find(n => n.id === id)!;
            expect(survivor.relationships.some(r => r.targetId === npc.id)).toBe(true);
            expect(searchMemories(state.memories, { ownerId: id, actorIds: [npc.id] }).length)
                .toBeGreaterThan(0);
        }
        // Foundation Establishment or better gets a name in the hall.
        const faction = state.factions.find(f => f.id === npc.factionId)!;
        expect(faction.resources.ancestral_names).toBe(1);
        expect(queryFacts(state.history, { actorId: npc.id }).length).toBeGreaterThan(0);
    });

    it('hands the unfinished goal and the open account to the heir', () => {
        const state = world();
        const { npc, heir } = protagonist(state);
        const out = enshrineRun(state, {
            npcId: npc.id, onDay: state.currentDay, causeNote: 'Died.'
        });

        expect(out.heirs.map(h => h.id)).toContain(heir.id);
        expect(out.goalsPassed).toBeGreaterThan(0);

        const after = state.npcs.find(n => n.id === heir.id)!;
        const inherited = after.goals.find(g => g.generation > 0)!;
        expect(inherited.text).toContain('Weir');
        expect(inherited.status).toBe('active');
        expect(inherited.originHolderId).toBe(npc.id);
        // The goal is as old as it was, not as old as the handover.
        expect(inherited.openedOnDay).toBe(state.currentDay - 20 * YEAR);

        // And the grudge came with it.
        const grudge = after.relationships.find(r => r.inheritedFromId === npc.id)!;
        expect(grudge).toBeDefined();
        expect(grudge.standing).toBeLessThan(0);
    });

    it('leaves no body when there was none to leave', () => {
        const state = world();
        const { npc } = protagonist(state);
        const out = enshrineRun(state, {
            npcId: npc.id,
            onDay: state.currentDay,
            causeNote: 'Failed tribulation. No body, only a scar.',
            leavesBody: false
        });
        expect(out.grave).toBeNull();
        expect(previousRunGraves(state)).toHaveLength(0);
    });
});

describe('legacy: the next run starts in the world the last one left', () => {
    function finished(state: WorldState, npcId: string, name: string, graveId: string | null): WorldRun {
        return {
            id: `run-${state.id}-1`,
            seed: runSeedFor(state.seed, 1),
            index: 1,
            cultivatorId: npcId,
            cultivatorName: name,
            startedOnDay: state.currentDay - 60 * YEAR,
            endedOnDay: state.currentDay,
            outcome: 'died',
            peakOrdinal: 15,
            graveLocationId: graveId,
            successorRelation: null
        };
    }

    it('derives the run seed from the world seed, and keeps it stable', () => {
        const state = world('leg-seed');
        expect(runSeedFor(state.seed, 1)).toBe(runSeedFor(state.seed, 1));
        expect(runSeedFor(state.seed, 1)).not.toBe(runSeedFor(state.seed, 2));
        // A different world produces a different run one.
        expect(runSeedFor('other', 1)).not.toBe(runSeedFor(state.seed, 1));
    });

    it('records runs against the world and finds the last finished one', () => {
        const state = world();
        const { npc } = protagonist(state);
        const out = enshrineRun(state, { npcId: npc.id, onDay: state.currentDay, causeNote: 'Died.' });
        recordRun(state, finished(state, npc.id, npc.name, out.grave!.id));

        expect(worldRuns(state)).toHaveLength(1);
        const last = lastFinishedRun(state)!;
        expect(last.cultivatorId).toBe(npc.id);
        expect(predecessorOf(state, last)!.status).toBe('physically_dead');
    });

    it('plans a successor who is usually a stranger, and sometimes not', () => {
        const state = world();
        const { npc } = protagonist(state);
        const out = enshrineRun(state, { npcId: npc.id, onDay: state.currentDay, causeNote: 'Died.' });
        const previous = finished(state, npc.id, npc.name, out.grave!.id);
        recordRun(state, previous);

        const stranger = planNextRun(state, { index: 2, onDay: state.currentDay, previous, relation: 'stranger' });
        expect(stranger.relation).toBe('stranger');
        expect(stranger.predecessorId).toBeNull();
        expect(stranger.inheritedGoalTexts).toHaveLength(0);
        // The grave is still there to be found.
        expect(stranger.graveLocationId).toBe(out.grave!.id);
        expect(stranger.note).toContain('bones');

        const descendant = planNextRun(state, {
            index: 3, onDay: state.currentDay, previous, relation: 'descendant'
        });
        expect(descendant.predecessorId).toBe(npc.id);
        expect(descendant.inheritedGoalTexts.length).toBeGreaterThan(0);
        expect(descendant.seed).not.toBe(stranger.seed);
    });

    it('weights the unaided draw toward nobody being anybody special', () => {
        const state = world();
        const { npc } = protagonist(state);
        const out = enshrineRun(state, { npcId: npc.id, onDay: state.currentDay, causeNote: 'Died.' });
        const previous = finished(state, npc.id, npc.name, out.grave!.id);

        const relations = Array.from({ length: 60 }, (_, i) =>
            planNextRun(state, { index: i + 2, onDay: state.currentDay, previous }).relation);
        const strangers = relations.filter(r => r === 'stranger').length;
        expect(strangers / relations.length).toBeGreaterThan(0.5);
        // But not always: the connection exists, it just has to be found.
        expect(relations.some(r => r !== 'stranger')).toBe(true);
    });

    it('carries the world forward across a run boundary, ruins and all', () => {
        const state = world('leg-carry');
        const { npc } = protagonist(state);

        // A life, and then two centuries of the world getting on with it.
        const graveOut = enshrineRun(state, {
            npcId: npc.id, onDay: state.currentDay,
            causeNote: 'Died in the hills.',
            carried: [{ itemId: 'item-x', name: 'a sealed case', kind: 'artifact', quantity: 1 }]
        });
        recordRun(state, finished(state, npc.id, npc.name, graveOut.grave!.id));
        const factsAtDeath = state.history.facts.length;

        advanceWorldYears(state, 200);

        // The grave survived, the world moved, and the record of the life is
        // still in the ledger centuries later.
        expect(previousRunGraves(state).map(g => g.id)).toContain(graveOut.grave!.id);
        expect(state.history.facts.length).toBeGreaterThan(factsAtDeath);
        expect(queryFacts(state.history, { actorId: npc.id }).length).toBeGreaterThan(0);
        expect(state.objects.some(o => o.id === graveOut.goods[0].id)).toBe(true);
    });

    it('has a table for runs in the migrated schema', () => {
        const db = new Database(':memory:');
        migrate(db);
        const cols = new Set(
            (db.prepare('PRAGMA table_info(world_runs)').all() as { name: string }[]).map(c => c.name)
        );
        for (const c of [
            'run_index', 'seed', 'cultivator_id', 'outcome', 'peak_ordinal',
            'grave_location_id', 'successor_relation'
        ]) {
            expect(cols.has(c), `world_runs.${c}`).toBe(true);
        }
        db.prepare('INSERT INTO world_runtime (id, seed) VALUES (?, ?)').run('w1', 'seed');
        db.prepare(
            `INSERT INTO world_runs (id, world_id, run_index, seed, cultivator_id, started_on_day, outcome, peak_ordinal)
             VALUES (?,?,?,?,?,?,?,?)`
        ).run('r1', 'w1', 1, runSeedFor('seed', 1), 'cult-1', 0, 'died', 15);
        const row = db.prepare(
            "SELECT * FROM world_runs WHERE world_id = ? AND outcome != 'active' ORDER BY run_index"
        ).get('w1') as Record<string, unknown>;
        expect(row.cultivator_id).toBe('cult-1');
        db.close();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// LADDER PERCENTILES
// ─────────────────────────────────────────────────────────────────────────

describe('ladder odds: three numbers that are allowed to disagree', () => {
    it('shows the player a vague in-world sentence, never a figure', () => {
        for (const row of BELIEVED_REACH) {
            const said = believedStatement(row.realm);
            expect(said.length).toBeGreaterThan(10);
            // No decimals, no percentages: this is what people say.
            expect(said).not.toMatch(/\d+\.\d|%/);
        }
        expect(believedStatement('foundation_establishment')).toContain('one in forty');
    });

    it('computes what the constants imply, falling monotonically up the ladder', () => {
        const theoretical = computeTheoreticalReach();
        expect(theoretical).toHaveLength(REALM_TIERS.length);
        expect(theoretical[0].share).toBe(1);
        for (let i = 1; i < theoretical.length; i++) {
            expect(theoretical[i].share).toBeLessThan(theoretical[i - 1].share);
        }
    });

    it('measures what the engine actually does, and is reproducible', () => {
        const a = measureLadderReach('sweep-1', { sampleSize: 400 });
        const b = measureLadderReach('sweep-1', { sampleSize: 400 });
        expect(a.tiers.map(t => t.share)).toEqual(b.tiers.map(t => t.share));

        // The shape the setting demands: almost everybody stops in the first
        // realm, and the ladder is monotone.
        expect(a.tiers[0].share).toBe(1);
        expect(a.tiers[1].share).toBeLessThan(0.35);
        for (let i = 1; i < a.tiers.length; i++) {
            expect(a.tiers[i].share).toBeLessThanOrEqual(a.tiers[i - 1].share);
        }
        // And people stop for the reasons the survival layer says they do.
        const total = Object.values(a.outcomes).reduce((x, y) => x + y, 0);
        expect(total).toBe(a.sampleSize);
        expect(a.outcomes.settling + a.outcomes.lifespan).toBeGreaterThan(0);
    });

    it('is harder in thin qi than in dense, which is the whole point of a vein', () => {
        const thin = measureLadderReach('sweep-2', { sampleSize: 300, ambient: 'thin' });
        const dense = measureLadderReach('sweep-2', { sampleSize: 300, ambient: 'dense' });
        expect(dense.meanPeakOrdinal).toBeGreaterThan(thin.meanPeakOrdinal);
    });

    it('reports all three side by side for admin, and names the disagreements', () => {
        const state = world('odds-w');
        const report = ladderOddsReport('sweep-3', { sampleSize: 400, ambient: 'normal' }, state);

        expect(report.rows).toHaveLength(REALM_TIERS.length);
        for (const row of report.rows) {
            expect(row.believedStatement.length).toBeGreaterThan(10);
            expect(row.theoreticalShare).toBeGreaterThanOrEqual(0);
            expect(row.measuredShare).toBeGreaterThanOrEqual(0);
            // The observed column is this world's living population.
            expect(row.observed).not.toBeNull();
        }
        // Foundation is where belief and measurement are most checkable, and in
        // ordinary qi they disagree by roughly five times - which is the
        // designed behaviour, not a defect. See the reachability test below.
        const foundation = report.rows[1];
        expect(foundation.measuredShare).toBeGreaterThan(0);
        expect(foundation.beliefError).toBeGreaterThan(1);
        expect(Array.isArray(report.notableDisagreements)).toBe(true);
    });

    /**
     * The believed figure is a single number and the world is not.
     *
     * "One in forty see Foundation" is what people say everywhere, and it is
     * wrong everywhere: in thin qi - most of the world - the real answer is
     * nobody, and on a rich vein it is closer to two in five. A cultivator who
     * quotes the figure is quoting a tradition that averaged over provinces
     * that have nothing to do with each other.
     *
     * This is exactly the shape the knowledge layer wants, and it is why the
     * player only ever sees the sentence.
     */
    it('is wrong in both directions depending on where you were born', () => {
        const thin = measureLadderReach('sweep-4', { sampleSize: 800, ambient: 'thin' });
        const dense = measureLadderReach('sweep-4', { sampleSize: 800, ambient: 'dense' });
        const believed = BELIEVED_REACH[1].approximateShare;

        expect(thin.tiers[1].share).toBeLessThan(believed);
        expect(dense.tiers[1].share).toBeGreaterThan(believed * 5);
    });

    /**
     * WHERE THE LADDER ACTUALLY STOPS.
     *
     * A measurement, kept as a test so a change to the cultivation constants
     * shows up here rather than in somebody's surprise a month later.
     *
     * The sweep reaches Core Formation and stops. Nothing above it is produced
     * by ordinary cultivation in any ambient band, because `STAGNATION_YEARS`
     * (50) collides with a rank cost growing at 1.35^ordinal: past roughly
     * ordinal 17 a single rank costs more years than settling allows, so every
     * cultivator dies of the clock rather than of the ladder. The outcome mix
     * says the same thing - `lifespan` and `settling` account for essentially
     * all of it, and failed breakthroughs are a rounding error by comparison.
     *
     * That is consistent with the setting, where the upper realms are nearly
     * mythical and nobody has ascended in living memory. It is NOT the same as
     * the theoretical curve, which still gives Nascent Soul one in four
     * thousand - so the two disagree by a factor that is effectively infinite,
     * and the gap is the survival layer, not the breakthrough roll.
     *
     * The assertion is deliberately loose in the reachable direction: it fails
     * if the ladder ever becomes reachable to the top (which would mean the
     * clocks stopped biting) or unreachable below Foundation (which would mean
     * the game has no progression at all).
     */
    it('measures where the ladder actually stops, and it is not the top', () => {
        const sweep = measureLadderReach('sweep-5', { sampleSize: 1500, ambient: 'dense' });
        const reachable = sweep.tiers.filter(t => t.share > 0);
        const highest = reachable[reachable.length - 1];

        expect(reachable.length).toBeGreaterThanOrEqual(2);
        expect(highest.ordinal).toBeGreaterThanOrEqual(13);
        expect(highest.ordinal).toBeLessThan(29);

        // The clocks are what stop people, not the breakthrough roll.
        const { settling, lifespan, died_in_breakthrough } = sweep.outcomes;
        expect(settling + lifespan).toBeGreaterThan(died_in_breakthrough * 2);
    });
});
