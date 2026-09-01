import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo';
import { fixtureCatalog } from '../engine/world/fixtures';
import { seedWorld } from '../../src/engine/world/seeding';
import { advanceWorldYears } from '../../src/engine/world/driver';
import { enshrineRun, recordRun, runSeedFor, type WorldRun } from '../../src/engine/world/legacy';
import { addGoal, setRealm, upsertRelationship } from '../../src/engine/world/npc-state';
import { cloneWorld, type WorldState } from '../../src/engine/world/world-state';

const YEAR = 365;

function makeDb(): Database.Database {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    return db;
}

function world(seed = 'repo-a', population = 120): WorldState {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population }).state;
}

/** A cultivator with a sect, an unfinished account, and somebody who hates them. */
function protagonist(state: WorldState): string {
    const at = state.npcs.findIndex(n => n.factionId !== null && n.status === 'alive');
    let npc = state.npcs[at];
    npc = setRealm(npc, 15, state.currentDay - 5 * YEAR);
    npc = addGoal(npc, {
        kind: 'revenge',
        text: 'Settle the account at the Weir.',
        priority: 0.9,
        progress: 'Knows who, does not know where.',
        obstacles: ['Not strong enough.']
    }, state.currentDay - 300 * YEAR);
    const enemy = state.npcs.find(n => n.id !== npc.id && n.status === 'alive')!;
    npc = upsertRelationship(npc, {
        targetId: enemy.id,
        targetName: enemy.name,
        kind: 'enemy',
        standing: -0.9,
        note: 'Killed somebody.'
    }, state.currentDay - 300 * YEAR);
    state.npcs[at] = npc;
    return npc.id;
}

describe('WorldStateRepository', () => {
    describe('whole-world round trip', () => {
        it('saves and reloads a seeded world identically, clock included', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world();

            repo.saveWorld(state);
            const loaded = repo.loadWorld(state.id);

            expect(loaded).not.toBeNull();
            expect(loaded).toEqual(state);
            // The clock in particular: a restart must resume, not reseed.
            expect(loaded!.currentDay).toBe(state.currentDay);
            expect(loaded!.seed).toBe(state.seed);
            expect(loaded!.version).toBe(state.version);

            db.close();
        });

        it('round-trips every collection, not just the ones that happen to be small', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world();
            repo.saveWorld(state);
            const loaded = repo.loadWorld(state.id)!;

            // Each of these was a chance for a table to be silently skipped.
            expect(loaded.locations.length).toBe(state.locations.length);
            expect(loaded.factions.length).toBe(state.factions.length);
            expect(loaded.npcs.length).toBe(state.npcs.length);
            expect(loaded.history.facts.length).toBe(state.history.facts.length);
            expect(loaded.history.eras.length).toBe(state.history.eras.length);
            expect(loaded.lineages.length).toBe(state.lineages.length);
            expect(loaded.opportunities.length).toBe(state.opportunities.length);
            expect(loaded.schedule.length).toBe(state.schedule.length);
            expect(state.npcs.length).toBeGreaterThan(0);
            expect(state.history.facts.length).toBeGreaterThan(0);

            db.close();
        });

        it('preserves the fields that had no column until this change', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world();

            // populationTarget, historyFactIds and memoryIds were on the state
            // and absent from the tables. Zod-style defaults would have hidden
            // it; these assertions are what catches it coming back empty.
            expect(state.populationTarget).toBeGreaterThan(0);
            const withHistory = state.npcs.find(n => n.historyFactIds.length > 0);

            repo.saveWorld(state);
            const loaded = repo.loadWorld(state.id)!;

            expect(loaded.populationTarget).toBe(state.populationTarget);
            if (withHistory) {
                const same = loaded.npcs.find(n => n.id === withHistory.id)!;
                expect(same.historyFactIds).toEqual(withHistory.historyFactIds);
                expect(same.memoryIds).toEqual(withHistory.memoryIds);
            }

            db.close();
        });

        it('preserves where every NPC was born', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world();

            // Same failure mode as the fields above: an origin the seeder rolls
            // and the table has no column for would come back as 'thin_county'
            // for everybody, and the reason a Dao house has the members it
            // does would quietly stop being true across a save.
            const origins = new Map(state.npcs.map(n => [n.id, n.identity.origin]));
            expect(origins.size).toBeGreaterThan(0);

            repo.saveWorld(state);
            const loaded = repo.loadWorld(state.id)!;

            for (const npc of loaded.npcs) {
                expect(npc.identity.origin).toBe(origins.get(npc.id));
            }

            db.close();
        });

        it('returns null for an unknown world rather than throwing', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            expect(repo.loadWorld('no-such-world')).toBeNull();
            expect(repo.nextRunSeed('no-such-world')).toBeNull();
            expect(repo.runsOf('no-such-world')).toEqual([]);
            expect(repo.deleteWorld('no-such-world')).toBe(false);
            db.close();
        });

        it('is a snapshot, not a merge: removed rows do not come back', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world();
            repo.saveWorld(state);

            const droppedId = state.npcs[state.npcs.length - 1].id;
            state.npcs = state.npcs.slice(0, -1);
            repo.saveWorld(state);

            const loaded = repo.loadWorld(state.id)!;
            expect(loaded.npcs.map(n => n.id)).not.toContain(droppedId);
            expect(loaded.npcs.length).toBe(state.npcs.length);

            db.close();
        });

        it('re-saving the same world is idempotent', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world();

            repo.saveWorld(state);
            repo.saveWorld(state);
            repo.saveWorld(state);

            expect(repo.loadWorld(state.id)).toEqual(state);
            expect(repo.listWorlds()).toHaveLength(1);

            db.close();
        });

        it('keeps worlds separate', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const a = world('repo-a');
            const b = world('repo-b');

            repo.saveWorld(a);
            repo.saveWorld(b);

            expect(repo.loadWorld(a.id)).toEqual(a);
            expect(repo.loadWorld(b.id)).toEqual(b);
            expect(repo.listWorlds().map(w => w.id).sort()).toEqual([a.id, b.id].sort());

            repo.deleteWorld(a.id);
            expect(repo.loadWorld(a.id)).toBeNull();
            expect(repo.loadWorld(b.id)).toEqual(b);

            db.close();
        });
    });

    describe('a long advance', () => {
        it('saves and reloads a 500-year advance identically', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-long', 200);

            const advanced = advanceWorldYears(state, 500).state;
            expect(advanced.history.facts.length).toBeGreaterThan(500);

            repo.saveWorld(advanced);
            const loaded = repo.loadWorld(advanced.id)!;

            expect(loaded).toEqual(advanced);
            expect(loaded.history.facts.length).toBe(advanced.history.facts.length);
            expect(loaded.history.nextFactSeq).toBe(advanced.history.nextFactSeq);
            expect(loaded.memories.nextSeq).toBe(advanced.memories.nextSeq);

            db.close();
        });

        it('continues advancing deterministically from where it stopped', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-det', 150);

            const midpoint = advanceWorldYears(state, 200).state;

            // advanceWorldForPlay advances IN PLACE, so the in-memory arm gets
            // its own copy - otherwise the midpoint is already 200 years on by
            // the time it is saved and the comparison is against itself.
            const straightThrough = advanceWorldYears(cloneWorld(midpoint), 200).state;

            repo.saveWorld(midpoint);
            const reloaded = repo.loadWorld(midpoint.id)!;
            const continued = advanceWorldYears(reloaded, 200).state;

            expect(continued.currentDay).toBe(straightThrough.currentDay);
            expect(continued.history.facts.length).toBe(straightThrough.history.facts.length);
            expect(continued.history.nextFactSeq).toBe(straightThrough.history.nextFactSeq);
            expect(continued.npcs.map(n => n.id)).toEqual(straightThrough.npcs.map(n => n.id));
            expect(continued.npcs.map(n => n.status)).toEqual(straightThrough.npcs.map(n => n.status));
            // The whole point of deriving randomness from the stored seed:
            // a reload is not a fork.
            expect(continued).toEqual(straightThrough);

            db.close();
        });

        it('saves a 500-year advance fast enough to be usable', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-perf', 200);
            const advanced = advanceWorldYears(state, 500).state;

            const fullStart = performance.now();
            repo.saveWorld(advanced);
            const fullMs = performance.now() - fullStart;

            const appendStart = performance.now();
            repo.appendWorld(advanced);
            const appendMs = performance.now() - appendStart;

            const loadStart = performance.now();
            repo.loadWorld(advanced.id);
            const loadMs = performance.now() - loadStart;

            // Generous bounds: this asserts "not seconds", which is the actual
            // requirement, without turning CI variance into a red build.
            expect(fullMs).toBeLessThan(3000);
            expect(appendMs).toBeLessThan(3000);
            expect(loadMs).toBeLessThan(3000);

            // The append path skips the append-only bulk, which is the majority
            // of a long advance. It must not be slower than the full save.
            expect(appendMs).toBeLessThanOrEqual(fullMs * 1.5);

            db.close();
        });

        it('appendWorld writes new facts without duplicating stored ones', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-append', 120);

            repo.saveWorld(state);
            const before = repo.loadWorld(state.id)!.history.facts.length;

            const advanced = advanceWorldYears(state, 50).state;
            repo.appendWorld(advanced);

            const loaded = repo.loadWorld(advanced.id)!;
            expect(loaded.history.facts.length).toBe(advanced.history.facts.length);
            expect(loaded.history.facts.length).toBeGreaterThan(before);
            expect(new Set(loaded.history.facts.map(f => f.id)).size).toBe(loaded.history.facts.length);
            expect(loaded.currentDay).toBe(advanced.currentDay);

            db.close();
        });
    });

    describe('a finished run', () => {
        it('survives a reload with the grave, the hall entry and the dates intact', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-legacy', 150);
            const heroId = protagonist(state);
            const hero = state.npcs.find(n => n.id === heroId)!;
            const factionId = hero.factionId!;
            // By text, not by index: the seeding gives NPCs goals of their own,
            // so goals[0] is somebody else's business with a different date.
            const revenge = hero.goals.find(g => g.text === 'Settle the account at the Weir.')!;
            const goalOpenedOn = revenge.openedOnDay;
            expect(goalOpenedOn).toBe(state.currentDay - 300 * YEAR);
            const hallBefore = state.factions.find(f => f.id === factionId)!.resources.ancestral_names ?? 0;

            const result = enshrineRun(state, {
                npcId: heroId,
                onDay: state.currentDay,
                causeNote: 'Torn apart at the Weir, having found the wrong man.',
                carried: [{ itemId: 'jade-token', name: 'A jade token', kind: 'token', quantity: 1 }],
                spiritStones: 400,
                leavesBody: true
            });

            const run: WorldRun = {
                id: 'run-1',
                seed: runSeedFor(state.seed, 0),
                index: 0,
                cultivatorId: heroId,
                cultivatorName: hero.name,
                startedOnDay: state.currentDay - 40 * YEAR,
                endedOnDay: state.currentDay,
                outcome: 'died',
                peakOrdinal: 15,
                graveLocationId: result.grave?.id ?? null,
                successorRelation: 'stranger'
            };
            const withRun = recordRun(result.state, run);

            repo.saveWorld(withRun);
            const loaded = repo.loadWorld(withRun.id)!;

            // The grave is an ordinary location and it is on the map.
            expect(result.grave).not.toBeNull();
            const grave = loaded.locations.find(l => l.id === result.grave!.id);
            expect(grave).toBeDefined();
            expect(grave!.origin.name).toBe(result.grave!.origin.name);

            // The run itself, with the grave still attached.
            expect(loaded.runs).toHaveLength(1);
            expect(loaded.runs[0]).toEqual(run);
            expect(loaded.runs[0].graveLocationId).toBe(result.grave!.id);

            // The ancestral hall entry, which lives on the faction's resources.
            const hallAfter = loaded.factions.find(f => f.id === factionId)!.resources.ancestral_names ?? 0;
            expect(hallAfter).toBeGreaterThanOrEqual(hallBefore);
            expect(hallAfter).toBe(withRun.factions.find(f => f.id === factionId)!.resources.ancestral_names ?? 0);

            // The chronicle facts the life produced.
            expect(result.facts.length).toBeGreaterThan(0);
            for (const fact of result.facts) {
                expect(loaded.history.facts.some(f => f.id === fact.id)).toBe(true);
            }

            // Grave goods, with the dead cultivator in their provenance chain.
            for (const good of result.goods) {
                const stored = loaded.objects.find(o => o.id === good.id);
                expect(stored).toBeDefined();
                expect(stored!.provenance).toEqual(good.provenance);
            }

            // The inherited goal, with its ORIGINAL opening date. A goal opened
            // three hundred years ago and handed on is still three hundred
            // years old, and re-stamping it on inheritance is the bug this
            // assertion exists to catch.
            if (result.goalsPassed > 0) {
                const inherited = loaded.npcs
                    .flatMap(n => n.goals)
                    .filter(g => g.inheritedFromId !== null);
                expect(inherited.length).toBeGreaterThan(0);
                const fromHero = inherited.find(
                    g => g.originHolderId === heroId && g.text === 'Settle the account at the Weir.'
                );
                expect(fromHero).toBeDefined();
                expect(fromHero!.openedOnDay).toBe(goalOpenedOn);
                expect(fromHero!.generation).toBeGreaterThan(0);
            }

            // The survivors who remember them.
            for (const rememberer of result.rememberedBy) {
                const npc = loaded.npcs.find(n => n.id === rememberer);
                expect(npc).toBeDefined();
            }

            db.close();
        });

        it('derives the next run seed from the world seed and does not perturb it', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-runs', 100);
            repo.saveWorld(state);

            const first = repo.nextRunSeed(state.id)!;
            expect(first.index).toBe(0);
            expect(first.seed).toBe(runSeedFor(state.seed, 0));

            repo.recordRun(state.id, {
                id: 'run-1', seed: first.seed, index: 0,
                cultivatorId: 'c1', cultivatorName: 'First',
                startedOnDay: state.currentDay, endedOnDay: state.currentDay + 10,
                outcome: 'died', peakOrdinal: 4,
                graveLocationId: null, successorRelation: 'stranger'
            });

            const second = repo.nextRunSeed(state.id)!;
            expect(second.index).toBe(1);
            expect(second.seed).toBe(runSeedFor(state.seed, 1));
            expect(second.seed).not.toBe(first.seed);

            // The world is untouched by a run starting: same seed, same clock,
            // same everything.
            const reloaded = repo.loadWorld(state.id)!;
            expect(reloaded.seed).toBe(state.seed);
            expect(reloaded.currentDay).toBe(state.currentDay);
            expect(reloaded.history.nextFactSeq).toBe(state.history.nextFactSeq);

            // And the derivation is stable across a reload.
            expect(repo.nextRunSeed(state.id)!.seed).toBe(second.seed);

            db.close();
        });

        it('a run recorded twice updates rather than duplicating', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-rerun', 100);
            repo.saveWorld(state);

            const open: WorldRun = {
                id: 'run-1', seed: runSeedFor(state.seed, 0), index: 0,
                cultivatorId: 'c1', cultivatorName: 'Lives Yet',
                startedOnDay: state.currentDay, endedOnDay: null,
                outcome: 'active', peakOrdinal: 0,
                graveLocationId: null, successorRelation: null
            };
            repo.recordRun(state.id, open);
            repo.recordRun(state.id, { ...open, endedOnDay: state.currentDay + 900, outcome: 'died', peakOrdinal: 14 });

            const runs = repo.runsOf(state.id);
            expect(runs).toHaveLength(1);
            expect(runs[0].outcome).toBe('died');
            expect(runs[0].peakOrdinal).toBe(14);

            db.close();
        });
    });

    describe('nothing resurrects', () => {
        it('keeps the dead dead across a save and reload', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-death', 150);

            const advanced = advanceWorldYears(state, 400).state;
            const dead = advanced.npcs.filter(n => n.status !== 'alive');
            expect(dead.length).toBeGreaterThan(0);

            repo.saveWorld(advanced);
            const loaded = repo.loadWorld(advanced.id)!;

            for (const corpse of dead) {
                const after = loaded.npcs.find(n => n.id === corpse.id)!;
                expect(after.status).toBe(corpse.status);
                expect(after.status).not.toBe('alive');
                expect(after.diedOnDay).toBe(corpse.diedOnDay);
                expect(after.endNote).toBe(corpse.endNote);
            }

            // The count is stable too: nothing came back and nothing appeared.
            expect(loaded.npcs.filter(n => n.status !== 'alive').length).toBe(dead.length);

            db.close();
        });

        it('refuses to save a world that would raise a stored dead NPC', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-raise', 150);
            const advanced = advanceWorldYears(state, 400).state;
            repo.saveWorld(advanced);

            // A stale world: loaded before the death, saved after it. The repo
            // must reject rather than decide which of the two is real.
            const stale = repo.loadWorld(advanced.id)!;
            const corpseIndex = stale.npcs.findIndex(n => n.status !== 'alive');
            expect(corpseIndex).toBeGreaterThanOrEqual(0);
            const corpseId = stale.npcs[corpseIndex].id;
            stale.npcs[corpseIndex] = { ...stale.npcs[corpseIndex], status: 'alive', diedOnDay: null };

            expect(() => repo.saveWorld(stale)).toThrow(/resurrect/i);
            expect(() => repo.appendWorld(stale)).toThrow(/resurrect/i);

            // And the stored world is untouched by the rejected write: the
            // transaction rolled back rather than half-applying.
            const after = repo.loadWorld(advanced.id)!;
            expect(after.npcs.find(n => n.id === corpseId)!.status).not.toBe('alive');
            expect(after.npcs.length).toBe(advanced.npcs.length);

            db.close();
        });

        it('allows an ordinary save of a world whose dead stay dead', () => {
            const db = makeDb();
            const repo = new WorldStateRepository(db);
            const state = world('repo-ok', 120);
            const advanced = advanceWorldYears(state, 300).state;

            repo.saveWorld(advanced);
            const reloaded = repo.loadWorld(advanced.id)!;
            expect(() => repo.saveWorld(reloaded)).not.toThrow();
            expect(() => repo.appendWorld(reloaded)).not.toThrow();

            db.close();
        });
    });
});
