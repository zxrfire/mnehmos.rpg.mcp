/**
 * Tool-level tests for the cultivation MCP surface.
 *
 * The thing under test is not "does the engine compute the right number" — that
 * is the engine's own suite. It is the AUTHORITY BOUNDARY: that the caller
 * cannot assert an outcome, that whatever the engine decided is what SQLite
 * ends up holding, and that a closed run stays closed.
 */

import { randomUUID } from 'crypto';
import {
    CultivationManageTool,
    handleCultivationManage
} from '../../src/server/consolidated/cultivation-manage.js';
import { RunManageTool, handleRunManage } from '../../src/server/consolidated/run-manage.js';
import {
    TechniqueManageTool,
    handleTechniqueManage
} from '../../src/server/consolidated/technique-manage.js';
import {
    AlchemyManageTool,
    handleAlchemyManage
} from '../../src/server/consolidated/alchemy-manage.js';
import { SectManageTool, handleSectManage } from '../../src/server/consolidated/sect-manage.js';
import { AdminManageTool, handleAdminManage } from '../../src/server/consolidated/admin-manage.js';
import { ConsolidatedTools } from '../../src/server/consolidated/index.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { RunRepository } from '../../src/storage/repos/run.repo.js';
import { SectRepository } from '../../src/storage/repos/sect.repo.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import {
    addToPouch,
    ensureCultivationDb,
    listTolls,
    tollCandidatesFor
} from '../../src/server/consolidated/cultivation-support.js';
import { GRAIN_ABSTINENCE_PILL_ID, MINOR_HEALING_PILL_ID } from '../../src/data/cultivation/pills.js';
import {
    DAYS_PER_YEAR,
    forStream,
    rollSpiritRoot,
    progressRequiredForOrdinal
} from '../../src/engine/cultivation/index.js';

const ctx = { sessionId: 'test' };

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** The cultivation tools return rich text with the payload embedded. Dig it out. */
function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    if (match) return JSON.parse(match[1]);
    // Un-decorated responses (a formatter throw) still carry raw JSON.
    return JSON.parse(text);
}

const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));
const run = async (args: Record<string, unknown>) => payload(await handleRunManage(args, ctx));
const technique = async (args: Record<string, unknown>) =>
    payload(await handleTechniqueManage(args, ctx));
const alchemy = async (args: Record<string, unknown>) => payload(await handleAlchemyManage(args, ctx));
const sect = async (args: Record<string, unknown>) => payload(await handleSectManage(args, ctx));
const admin = async (args: Record<string, unknown>) => payload(await handleAdminManage(args, ctx));

/**
 * A seed whose first talent draw satisfies `predicate`.
 *
 * Deterministic by construction: the scan order is fixed and the draw mirrors
 * `rollTalent`'s first stream exactly, so this returns the same seed on every
 * machine and every run.
 */
function seedWhereRoot(predicate: (grade: string) => boolean, nonce = 0): string {
    for (let i = 0; i < 5_000; i++) {
        const seed = `seed-${i}`;
        const root = rollSpiritRoot(forStream(seed, 'spirit_root', nonce).next());
        if (predicate(root.grade)) return seed;
    }
    throw new Error('No seed produced the requested spirit-root grade');
}

/** A clean single root: deviationRisk 0, so long skips are not noise. */
const SINGLE_ROOT_SEED = seedWhereRoot(grade => grade === 'single');

async function newRun(seed = SINGLE_ROOT_SEED, name = 'Shen Yue') {
    const created = await cultivation({
        action: 'create_cultivator',
        name,
        seed,
        location: 'Sweptground'
    });
    expect(created.error).toBeUndefined();
    return created;
}

/** Put a pill in the pouch without going through admin, for setup only. */
function grantPill(cultivatorId: string, pillId: string, quantity = 1) {
    const repos = ensureCultivationDb();
    addToPouch(repos.db, cultivatorId, pillId, 'pill', quantity);
}

/**
 * The invariant this whole suite exists for: what the tool SAID happened is
 * what the database HOLDS.
 */
function assertPersistenceMatchesSimulation(result: any, db: ReturnType<typeof getDb>) {
    const cultivators = new CultivatorRepository(db);
    const runs = new RunRepository(db);
    const stored = cultivators.getById(result.cultivator.id)!;
    const storedRun = runs.getById(result.run.id)!;

    expect(stored.realmOrdinal).toBe(result.cultivator.realm.ordinal);
    expect(stored.cultivationProgress).toBeCloseTo(result.cultivator.progress.current, 1);
    expect(stored.age).toBeCloseTo(result.cultivator.mortality.age, 1);
    expect(stored.alive).toBe(!result.died);
    expect(stored.injuries.length).toBe(result.cultivator.injuries.length);
    expect(storedRun.elapsedDays).toBeCloseTo(result.run.elapsedDays, 1);
    if (result.died) {
        expect(storedRun.status).toBe('dead');
        expect(stored.deathCause).toBe(result.deathCause);
    } else {
        expect(storedRun.status).toBe('active');
    }
}

// ═══════════════════════════════════════════════════════════════════════════

describe('cultivation MCP tool surface', () => {
    let db: ReturnType<typeof getDb>;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
        delete process.env.ADMIN_MODE;
    });

    afterEach(() => {
        delete process.env.ADMIN_MODE;
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('registry', () => {
        it('registers all six cultivation tools as full contracts', () => {
            const names = ConsolidatedTools.map(c => c.name);
            for (const name of [
                'cultivation_manage', 'run_manage', 'technique_manage',
                'alchemy_manage', 'sect_manage', 'admin_manage'
            ]) {
                expect(names).toContain(name);
                const contract = ConsolidatedTools.find(c => c.name === name)!;
                expect(contract.metadata.name).toBe(name);
                expect(contract.metadata.description).toBe(contract.description);
                expect(contract.schema).toBe(contract.inputSchema);
                expect(contract.actionSchemas).toBeDefined();
                expect(typeof contract.handler).toBe('function');
            }
        });

        it('names every action in each tool description', () => {
            for (const [tool, actions] of [
                [CultivationManageTool, ['create_cultivator', 'cultivate', 'breakthrough', 'status', 'ladder']],
                [RunManageTool, ['start', 'current', 'end', 'ledger', 'seed_info']],
                [TechniqueManageTool, ['list_available', 'learn', 'practise', 'use', 'forget']],
                [AlchemyManageTool, ['list_recipes', 'refine', 'consume_pill', 'inventory']],
                [SectManageTool, ['join', 'leave', 'promote', 'stipend', 'standing']],
                [AdminManageTool, ['roster', 'spawn_encounter', 'spawn_site', 'grant_item', 'set_realm']]
            ] as Array<[{ description: string }, string[]]>) {
                for (const action of actions) {
                    expect(tool.description).toContain(action);
                }
            }
        });

        it('exposes no action anywhere that reopens a run or asserts an outcome', () => {
            const forbidden = [
                'revive', 'resurrect', 'reload', 'rollback', 'restore', 'reopen',
                'set_hp', 'set_outcome', 'declare', 'force_success', 'set_result'
            ];
            for (const tool of [
                CultivationManageTool, RunManageTool, TechniqueManageTool,
                AlchemyManageTool, SectManageTool, AdminManageTool
            ]) {
                for (const name of forbidden) {
                    expect(Object.keys(tool.actionSchemas)).not.toContain(name);
                }
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('talent is never caller-chosen', () => {
        it('rejects a caller-supplied spirit root instead of silently ignoring it', async () => {
            const result = await cultivation({
                action: 'create_cultivator',
                name: 'Would-be Prodigy',
                spiritRoot: 'mutated_lightning'
            });
            expect(result.error).toBe('validation_error');
            expect(JSON.stringify(result.issues)).toContain('spiritRoot');
            expect(JSON.stringify(result.issues)).toContain('rolled server-side');
            expect(new CultivatorRepository(db).list()).toHaveLength(0);
        });

        it.each([
            ['attributes', { might: 3, insight: 4, fortune: 3, charm: 3 }],
            ['fortune', 3],
            ['realmOrdinal', 20],
            ['cultivationProgress', 99999]
        ])('rejects caller-supplied %s', async (key, value) => {
            const result = await cultivation({
                action: 'create_cultivator',
                name: 'Would-be Prodigy',
                [key]: value
            });
            expect(result.error).toBe('validation_error');
            expect(JSON.stringify(result.issues)).toContain(key);
        });

        it('starts every cultivator with no foundation laid', async () => {
            const created = await newRun();
            expect(created.cultivator.foundation).toBe('none');
            const stored = new CultivatorRepository(db).getById(created.cultivator.id)!;
            expect(stored.foundationQuality).toBe('none');
        });

        it('rolls talent from the run seed, identically for the same seed', async () => {
            const first = await newRun('fixed-seed-alpha', 'A');
            closeDb();
            db = getDb(':memory:');
            const second = await newRun('fixed-seed-alpha', 'B');

            expect(first.talentRoll.spiritRoot).toBe(second.talentRoll.spiritRoot);
            expect(first.talentRoll.attributes).toEqual(second.talentRoll.attributes);
            expect(first.talentRoll.locked).toBe(true);
        });

        it('refuses a second player cultivator while a run is live, so talent cannot be rerolled', async () => {
            await newRun();
            const second = await cultivation({ action: 'create_cultivator', name: 'Reroll Attempt' });
            expect(second.error).toBe('active_run_exists');
            expect(new CultivatorRepository(db).list()).toHaveLength(1);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('cultivate — long simulation in one call', () => {
        it('resolves ten years in a single call and persists a consistent end state', async () => {
            const created = await newRun();
            const id = created.cultivator.id;
            grantPill(id, GRAIN_ABSTINENCE_PILL_ID);
            await alchemy({ action: 'consume_pill', pillId: GRAIN_ABSTINENCE_PILL_ID });

            const result = await cultivation({
                action: 'cultivate',
                years: 10,
                focus: 'idle',          // no progress, so nothing interrupts; the clock is the subject
                autoBreakthrough: false,
                randomEvents: false
            });

            expect(result.error).toBeUndefined();
            expect(result.requestedDays).toBe(10 * DAYS_PER_YEAR);
            expect(result.simulatedDays).toBe(10 * DAYS_PER_YEAR);
            expect(result.stoppedEarly).toBe(false);
            expect(result.died).toBe(false);
            expect(result.cultivator.mortality.age).toBeCloseTo(26, 1);
            expect(result.run.elapsedDays).toBe(10 * DAYS_PER_YEAR);
            assertPersistenceMatchesSimulation(result, db);
        });

        it('accepts months and years and converts them to days', async () => {
            await newRun();
            const result = await cultivation({
                action: 'cultivate',
                months: 3,
                focus: 'idle',
                autoBreakthrough: false,
                randomEvents: false
            });
            expect(result.requestedDays).toBe(90);
        });

        it('accrues progress, and the database agrees with the digest', async () => {
            const created = await newRun();
            grantPill(created.cultivator.id, GRAIN_ABSTINENCE_PILL_ID);
            await alchemy({ action: 'consume_pill', pillId: GRAIN_ABSTINENCE_PILL_ID });

            const result = await cultivation({
                action: 'cultivate',
                days: 200,
                autoBreakthrough: false,
                randomEvents: false
            });

            expect(result.error).toBeUndefined();
            expect(result.rate.perDay).toBeGreaterThan(0);
            expect(result.deltas.cultivationProgress).toBeGreaterThan(0);
            assertPersistenceMatchesSimulation(result, db);
        });

        it('returns identical results for identical calls on identical run state', async () => {
            const runOnce = async () => {
                closeDb();
                db = getDb(':memory:');
                const created = await newRun('determinism-seed');
                grantPill(created.cultivator.id, GRAIN_ABSTINENCE_PILL_ID);
                await alchemy({ action: 'consume_pill', pillId: GRAIN_ABSTINENCE_PILL_ID });
                return cultivation({ action: 'cultivate', years: 3 });
            };

            const a = await runOnce();
            const b = await runOnce();

            expect(b.simulatedDays).toBe(a.simulatedDays);
            expect(b.interruptReason).toBe(a.interruptReason);
            expect(b.deltas).toEqual(a.deltas);
            expect(b.events.map((e: any) => [e.kind, e.dayOffset]))
                .toEqual(a.events.map((e: any) => [e.kind, e.dayOffset]));
        });

        it('stops the clock at a death mid-skip and closes the run there', async () => {
            await newRun();

            // No provisions and no grain abstinence: a full belly covers 50
            // turn-actions and five turns past empty is fatal, so a decade of
            // seclusion ends around day 55 rather than on day 3650.
            const result = await cultivation({
                action: 'cultivate',
                years: 10,
                rations: 0,
                autoBreakthrough: false,
                randomEvents: false
            });

            expect(result.died).toBe(true);
            expect(result.deathCause).toBe('starvation');
            expect(result.simulatedDays).toBeLessThan(365);
            expect(result.run.elapsedDays).toBe(result.simulatedDays);
            expect(result.run.status).toBe('dead');

            const storedRun = new RunRepository(db).getById(result.run.id)!;
            expect(storedRun.status).toBe('dead');
            expect(storedRun.deathCause).toBe('starvation');
            expect(storedRun.elapsedDays).toBe(result.simulatedDays);
            expect(storedRun.elapsedDays).toBeLessThan(10 * DAYS_PER_YEAR);
            assertPersistenceMatchesSimulation(result, db);
        });

        it('refuses a zero duration with a guiding error', async () => {
            await newRun();
            const result = await cultivation({ action: 'cultivate' });
            expect(result.error).toBe('no_duration');
            expect(result.hint).toContain('days');
        });

        it('charges spirit stones for rations rather than accepting free provisions', async () => {
            await newRun();
            const result = await cultivation({ action: 'cultivate', days: 10, rations: 500 });
            expect(result.error).toBe('insufficient_stones');
            expect(result.held).toBe(30);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('breakthrough', () => {
        /** Cultivate until the next rank is legally attemptable. */
        async function makeEligible(cultivatorId: string) {
            grantPill(cultivatorId, GRAIN_ABSTINENCE_PILL_ID);
            await alchemy({ action: 'consume_pill', pillId: GRAIN_ABSTINENCE_PILL_ID });
            for (let i = 0; i < 30; i++) {
                const result = await cultivation({
                    action: 'cultivate',
                    days: 120,
                    autoBreakthrough: false,
                    randomEvents: false
                });
                if (result.died) return false;
                if (result.cultivator.progress.breakthroughEligible) return true;
            }
            return false;
        }

        it('refuses an attempt without the progress, and states the shortfall', async () => {
            await newRun();
            const result = await cultivation({ action: 'breakthrough' });
            expect(result.error).toBe('breakthrough_insufficient_progress');
            expect(result.progressRequired).toBe(progressRequiredForOrdinal(0));
            expect(result.progressRemaining).toBeGreaterThan(0);
        });

        it('returns the full itemised modifier breakdown and the raw roll', async () => {
            const created = await newRun();
            expect(await makeEligible(created.cultivator.id)).toBe(true);

            const result = await cultivation({ action: 'breakthrough' });
            expect(result.error).toBeUndefined();
            expect(result.odds.modifiers.length).toBeGreaterThanOrEqual(5);
            expect(result.odds.roll).toBeGreaterThanOrEqual(0);
            expect(result.odds.roll).toBeLessThan(1);
            // The engine's invariant: the itemised deltas sum to the final chance.
            expect(result.odds.modifierSum).toBeCloseTo(result.odds.finalChance, 3);
            const sources = result.odds.modifiers.map((m: any) => m.source);
            expect(sources.some((s: string) => s.startsWith('base:'))).toBe(true);
            expect(sources).toContain('insight');
            expect(sources).toContain('fortune');
        });

        it('persists exactly what the engine returned, injuries included', async () => {
            // Deterministic seed scan: the first run in this fixed order whose
            // first breakthrough fails with a wound. No randomness anywhere.
            let injuriousFailureSeen = false;

            for (let i = 0; i < 40 && !injuriousFailureSeen; i++) {
                closeDb();
                db = getDb(':memory:');
                const created = await newRun(`bt-seed-${i}`, `Candidate ${i}`);
                if (!(await makeEligible(created.cultivator.id))) continue;

                const before = new CultivatorRepository(db)
                    .getById(created.cultivator.id)!;
                const result = await cultivation({ action: 'breakthrough' });
                if (result.error) continue;

                const stored = new CultivatorRepository(db).getById(created.cultivator.id)!;

                // Whatever the engine said, the row says the same.
                expect(stored.injuries.length).toBe(
                    before.injuries.length + result.injuriesSustained.length
                );
                for (const injury of result.injuriesSustained) {
                    const persisted = stored.injuries.find(i => i.id === injury.id);
                    expect(persisted).toBeDefined();
                    expect(persisted!.severity).toBe(injury.severity);
                    expect(persisted!.source).toBe(injury.source);
                    expect(persisted!.breakthroughPenalty).toBe(injury.breakthroughPenalty);
                }

                if (result.outcome === 'success') {
                    expect(stored.realmOrdinal).toBe(result.toOrdinal);
                    expect(stored.cultivationProgress).toBe(0);
                } else {
                    expect(stored.realmOrdinal).toBe(result.fromOrdinal);
                }

                if (result.injuriesSustained.length > 0) injuriousFailureSeen = true;
            }

            expect(injuriousFailureSeen).toBe(true);
        });

        it('spends a persisted breakthrough pill rather than accepting an asserted bonus', async () => {
            const created = await newRun();
            expect(await makeEligible(created.cultivator.id)).toBe(true);

            // Find any boost_breakthrough pill in the catalog and put it in the pouch.
            const { PILLS } = await import('../../src/data/cultivation/pills.js');
            const boost = PILLS.find(p => p.effect === 'boost_breakthrough')!;
            grantPill(created.cultivator.id, boost.id);

            const consumed = await alchemy({ action: 'consume_pill', pillId: boost.id });
            expect(consumed.pendingBreakthroughPill.pillId).toBe(boost.id);

            const result = await cultivation({ action: 'breakthrough' });
            const pillModifier = result.odds.modifiers.find((m: any) =>
                String(m.source).startsWith('pill:')
            );
            expect(pillModifier).toBeDefined();
            expect(result.odds.pillApplied.name).toBe(boost.name);

            // Spent, whatever the outcome.
            const status = await cultivation({ action: 'status' });
            expect(status.pendingBreakthroughPill).toBeNull();
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe("the Vault's toll", () => {
        it('offers the engine real rows as candidates, never invented ones', async () => {
            const created = await newRun();
            const available = await technique({ action: 'list_available' });
            await technique({ action: 'learn', techniqueId: available.compatible[0].id });

            const repos = ensureCultivationDb();
            const cultivator = repos.cultivators.getById(created.cultivator.id)!;
            const candidates = tollCandidatesFor(repos, cultivator);

            expect(candidates.length).toBeGreaterThan(0);
            for (const candidate of candidates) {
                expect(candidate.id).toBeTruthy();
                if (candidate.kind === 'technique') {
                    expect(repos.techniques.knows(cultivator.id, candidate.id)).toBe(true);
                } else if (candidate.kind === 'bond') {
                    expect(repos.cultivators.getById(candidate.id)).not.toBeNull();
                }
            }
        });

        it('charges the toll at a realm boundary and really takes what it named', async () => {
            // Deterministic scan: the first seed in this fixed order whose
            // 12 -> 13 crossing succeeds. Reaching a boundary honestly costs
            // decades, so the realm gate is lifted through admin and the
            // progress is bought with a real catalog pill.
            let sawBoundaryCrossing = false;

            for (let i = 0; i < 40 && !sawBoundaryCrossing; i++) {
                closeDb();
                db = getDb(':memory:');
                process.env.ADMIN_MODE = 'true';
                const created = await newRun(`toll-seed-${i}`, `Climber ${i}`);

                const available = await technique({ action: 'list_available' });
                await technique({ action: 'learn', techniqueId: available.compatible[0].id });

                await admin({ action: 'set_realm', ordinal: 12 });
                await admin({ action: 'grant_item', itemId: 'pill-condensed-century' });
                await alchemy({ action: 'consume_pill', pillId: 'pill-condensed-century' });

                const status = await cultivation({ action: 'status' });
                if (!status.breakthroughEligible) continue;

                const result = await cultivation({ action: 'breakthrough' });
                if (result.error || result.outcome !== 'success') continue;

                sawBoundaryCrossing = true;

                // A successful realm-boundary crossing is always charged.
                expect(result.toll).not.toBeNull();
                expect(result.toll.boundaryIndex).toBe(0);
                expect(['clean', 'taken', 'nothing_left', 'prepaid'])
                    .toContain(result.toll.outcome);
                expect(result.foundationEstablished).not.toBeNull();

                // The ledger holds it, exactly as returned.
                const ledger = listTolls(db, created.cultivator.id);
                expect(ledger).toHaveLength(1);
                expect(ledger[0].outcome).toBe(result.toll.outcome);
                expect(ledger[0].fromOrdinal).toBe(12);
                expect(ledger[0].toOrdinal).toBe(13);

                // And what it named is genuinely gone.
                if (result.toll.outcome === 'taken' && result.toll.taken?.kind === 'technique') {
                    const repos = ensureCultivationDb();
                    expect(repos.techniques.knows(created.cultivator.id, result.toll.taken.id))
                        .toBe(false);
                }

                const after = await cultivation({ action: 'status' });
                expect(after.foundation).toBe(result.foundationEstablished);
                expect(after.tollsPaid).toHaveLength(1);

                // Persisted on the cultivator row, not in a side table.
                const row = db
                    .prepare('SELECT foundation_quality FROM cultivators WHERE id = ?')
                    .get(created.cultivator.id) as { foundation_quality: string };
                expect(row.foundation_quality).toBe(result.foundationEstablished);
                expect(new CultivatorRepository(db).getById(created.cultivator.id)!.foundationQuality)
                    .toBe(result.foundationEstablished);

                // A foundation is laid once and never re-laid.
                const relaid = new CultivatorRepository(db)
                    .establishFoundation(created.cultivator.id, 'flawless');
                expect(relaid).toBeNull();
            }

            expect(sawBoundaryCrossing).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('permadeath', () => {
        async function killTheRun() {
            await newRun();
            const result = await cultivation({
                action: 'cultivate', years: 10, rations: 0,
                autoBreakthrough: false, randomEvents: false
            });
            expect(result.died).toBe(true);
            return result;
        }

        it('cannot be undone by any action on any tool', async () => {
            const dead = await killTheRun();
            const cultivatorId = dead.cultivator.id;
            const runId = dead.run.id;

            for (const call of [
                () => cultivation({ action: 'cultivate', days: 1 }),
                () => cultivation({ action: 'breakthrough' }),
                () => cultivation({ action: 'status' }),
                () => technique({ action: 'learn', techniqueId: 'anything' }),
                () => alchemy({ action: 'consume_pill', pillId: MINOR_HEALING_PILL_ID }),
                () => sect({ action: 'stipend' }),
                () => run({ action: 'start', cultivatorId })
            ]) {
                const result = await call();
                expect(typeof result.error).toBe('string');
            }

            const storedRun = new RunRepository(db).getById(runId)!;
            expect(storedRun.status).toBe('dead');
            const stored = new CultivatorRepository(db).getById(cultivatorId)!;
            expect(stored.alive).toBe(false);
        });

        it('refuses to re-close an already closed run', async () => {
            const dead = await killTheRun();
            const result = await run({ action: 'end', runId: dead.run.id });
            expect(result.error).toBe('run_already_ended');
        });

        it('refuses to start a second run for a cultivator whose run finished', async () => {
            await newRun();
            const ended = await run({ action: 'end' });
            expect(ended.ended).toBe(true);
            const restart = await run({ action: 'start', cultivatorId: ended.run.cultivatorId });
            expect(restart.error).toBe('run_already_finished');
        });

        it('reports the run as non-reopenable and records the cause in the ledger', async () => {
            const dead = await killTheRun();
            const ledger = await run({ action: 'ledger' });
            expect(ledger.count).toBe(1);
            expect(ledger.entries[0].runId).toBe(dead.run.id);
            expect(ledger.entries[0].deathCause).toBe('starvation');
            expect(ledger.causeBreakdown.starvation).toBe(1);
        });

        it('exposes the seed and its named sub-streams for replay', async () => {
            await newRun('replay-seed');
            const info = await run({ action: 'seed_info' });
            expect(info.seed).toBe('replay-seed');
            expect(info.adminFlagged).toBe(false);
            expect(info.streams.map((s: any) => s.stream)).toContain('breakthrough');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('technique_manage', () => {
        it('gates the catalog by realm ordinal and spirit-root compatibility', async () => {
            await newRun();
            const result = await technique({ action: 'list_available' });
            expect(result.error).toBeUndefined();
            expect(result.counts.gatedByRealm).toBeGreaterThan(0);
            for (const art of result.compatible) {
                expect(art.requiredOrdinal).toBeLessThanOrEqual(result.realmOrdinal);
                expect(art.rootMatch).not.toBe('conflicting');
            }
            for (const art of result.conflicting) {
                expect(art.rootMatch).toBe('conflicting');
                expect(art.deviationRiskPerCheck).toBeGreaterThan(0);
            }
        });

        it('refuses an art above the cultivator\'s realm', async () => {
            await newRun();
            const available = await technique({ action: 'list_available' });
            const compatibleId = available.compatible[0]?.id;
            expect(compatibleId).toBeDefined();

            const { TECHNIQUES } = await import('../../src/data/cultivation/techniques.js');
            const highGrade = TECHNIQUES.find(t => t.requiredOrdinal > 20)!;
            const result = await technique({ action: 'learn', techniqueId: highGrade.id });
            expect(result.error).toBe('realm_too_low');
        });

        it('learns a compatible art and raises mastery only through practise', async () => {
            const created = await newRun();
            grantPill(created.cultivator.id, GRAIN_ABSTINENCE_PILL_ID);
            await alchemy({ action: 'consume_pill', pillId: GRAIN_ABSTINENCE_PILL_ID });

            const available = await technique({ action: 'list_available' });
            const art = available.compatible[0];
            const learned = await technique({ action: 'learn', techniqueId: art.id });
            expect(learned.learned).toBe(true);
            expect(learned.technique.mastery).toBe(0);

            const practised = await technique({
                action: 'practise', techniqueId: art.id, days: 100
            });
            expect(practised.masteryAfter).toBeGreaterThan(practised.masteryBefore);
            expect(practised.masteryPerDay).toBeGreaterThan(0);
        });

        it('routes a conflicting-element art through the deviation engine', async () => {
            // A dual root holds two elements that fight each other, so every art
            // of its own elements conflicts — a guaranteed conflicting case.
            // The catalog's elemental arts start at ordinal 1, so lift the realm
            // gate to reach one; that path is itself engine-resolved and audited.
            const dualSeed = seedWhereRoot(grade => grade === 'dual');
            const created = await newRun(dualSeed, 'Two Minds');
            process.env.ADMIN_MODE = 'true';
            await admin({ action: 'set_realm', ordinal: 4 });
            grantPill(created.cultivator.id, GRAIN_ABSTINENCE_PILL_ID);
            await alchemy({ action: 'consume_pill', pillId: GRAIN_ABSTINENCE_PILL_ID });

            const available = await technique({ action: 'list_available' });
            expect(available.conflicting.length).toBeGreaterThan(0);

            const art = available.conflicting[0];
            const learned = await technique({ action: 'learn', techniqueId: art.id });
            expect(learned.elementConflict).toBe(true);
            expect(learned.deviation).not.toBeNull();
            expect(learned.deviation.risk).toBeGreaterThan(0);
            expect(typeof learned.deviation.deviated).toBe('boolean');

            // Whatever the deviation roll said, the database says the same.
            const stored = new CultivatorRepository(db).getById(created.cultivator.id)!;
            expect(stored.injuries.length).toBe(learned.deviation.injuries.length);
        });

        it('forgets an art and loses its mastery', async () => {
            await newRun();
            const available = await technique({ action: 'list_available' });
            const art = available.compatible[0];
            await technique({ action: 'learn', techniqueId: art.id });
            const forgotten = await technique({ action: 'forget', techniqueId: art.id });
            expect(forgotten.forgotten).toBe(true);
            expect(forgotten.knownTechniques).not.toContain(art.id);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('alchemy_manage', () => {
        it('refuses a refinement with an empty pouch instead of inventing ingredients', async () => {
            await newRun();
            const recipes = await alchemy({ action: 'list_recipes' });
            expect(recipes.count).toBeGreaterThan(0);

            const result = await alchemy({ action: 'refine', recipeId: recipes.recipes[0].id });
            expect(result.error).toBe('missing_ingredients');
            expect(result.missing.length).toBeGreaterThan(0);
        });

        it('rolls the refinement in the engine and burns ingredients either way', async () => {
            const created = await newRun();
            const repos = ensureCultivationDb();
            const recipes = await alchemy({ action: 'list_recipes' });
            const recipe = recipes.recipes.find((r: any) => r.withinReach)!;
            for (const ingredient of recipe.ingredients) {
                addToPouch(repos.db, created.cultivator.id, ingredient.itemId, 'herb', ingredient.required);
            }

            const result = await alchemy({ action: 'refine', recipeId: recipe.id });
            expect(result.error).toBeUndefined();
            expect(typeof result.succeeded).toBe('boolean');
            expect(result.odds.roll).toBeGreaterThanOrEqual(0);
            expect(result.odds.modifiers.map((m: any) => m.source)).toContain('recipe_base');

            const inventory = await alchemy({ action: 'inventory' });
            for (const ingredient of recipe.ingredients) {
                const held = inventory.herbs.find((h: any) => h.id === ingredient.itemId);
                expect(held?.quantity ?? 0).toBe(0);
            }
            if (result.succeeded) {
                expect(inventory.pills.some((p: any) => p.id === result.produced.id)).toBe(true);
            }
        });

        it('applies a pill through the engine and refuses one that is not held', async () => {
            const created = await newRun();
            const notHeld = await alchemy({ action: 'consume_pill', pillId: MINOR_HEALING_PILL_ID });
            expect(notHeld.error).toBe('pill_not_held');

            grantPill(created.cultivator.id, MINOR_HEALING_PILL_ID);
            const consumed = await alchemy({ action: 'consume_pill', pillId: MINOR_HEALING_PILL_ID });
            expect(consumed.consumed).toBe(true);
            expect(consumed.pill.effect).toBe('heal_hp');
            expect(consumed.toxicity.after).toBeGreaterThan(0);
        });

        it('accumulates pill toxicity into a real persisted poison injury', async () => {
            const created = await newRun();
            grantPill(created.cultivator.id, MINOR_HEALING_PILL_ID, 40);

            let poisonSeen = false;
            for (let i = 0; i < 40 && !poisonSeen; i++) {
                const result = await alchemy({ action: 'consume_pill', pillId: MINOR_HEALING_PILL_ID });
                if (result.error) break;
                if (result.toxicity.crossedThreshold) poisonSeen = true;
            }

            expect(poisonSeen).toBe(true);
            const stored = new CultivatorRepository(db).getById(created.cultivator.id)!;
            expect(stored.injuries.some(i => i.source === 'poison')).toBe(true);
        });

        it('records a grain-abstinence pill as durable state the time-skip reads', async () => {
            const created = await newRun();
            grantPill(created.cultivator.id, GRAIN_ABSTINENCE_PILL_ID);
            await alchemy({ action: 'consume_pill', pillId: GRAIN_ABSTINENCE_PILL_ID });

            const status = await cultivation({ action: 'status' });
            expect(status.onGrainAbstinence).toBe(true);

            const result = await cultivation({
                action: 'cultivate', years: 5, rations: 0,
                autoBreakthrough: false, randomEvents: false, focus: 'idle'
            });
            expect(result.deathCause).not.toBe('starvation');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('sect_manage', () => {
        /** A recruiting sect from the catalog whose admission this run can meet. */
        function openDoorSect() {
            return SECTS.find(entry =>
                entry.recruits &&
                entry.admissionOrdinal === 0 &&
                getSect(entry.id)!.id === entry.id
            )!;
        }

        it('seeds the sects table from the catalog on first touch, idempotently', async () => {
            await newRun();

            const listed = await sect({ action: 'list' });
            expect(listed.count).toBe(SECTS.length);
            expect(listed.note).toBeUndefined();

            const names = listed.sects.map((entry: any) => entry.name);
            for (const canon of [
                'Ashwright Consortium', 'Lantern Hall', 'The Severed',
                'The Hollow Court', 'Kiln Wardens'
            ]) {
                expect(names).toContain(canon);
            }

            // Listing again must not duplicate rows.
            await sect({ action: 'list' });
            const stored = new SectRepository(db).list();
            expect(stored).toHaveLength(SECTS.length);
        });

        it('carries the catalog facts the database does not store', async () => {
            await newRun();
            const listed = await sect({ action: 'list' });
            const entry = listed.sects.find((s: any) => s.id === 'sect-lantern-hall');

            expect(entry.territory).toBeTruthy();
            expect(entry.compound.inherited).toBe(true);
            expect(entry.compound.formationNodesLit)
                .toBeLessThanOrEqual(entry.compound.formationNodesTotal);
            expect(entry.compound.formationIntegrity).toBeLessThanOrEqual(1);
            expect(Array.isArray(entry.teaches)).toBe(true);
            expect(entry.admission.requirement).toBeTruthy();
        });

        it('refuses the two powers that take no applicants at all', async () => {
            await newRun();
            for (const sectId of ['sect-hollow-court', 'sect-kiln-wardens']) {
                expect(getSect(sectId)!.recruits).toBe(false);
                const result = await sect({ action: 'join', sectId });
                expect(result.error).toBe('sect_does_not_recruit');
                expect(result.hint).toContain('Not a gate that can be met');
            }
            expect(new SectRepository(db).getMembership(
                (await run({ action: 'current' })).cultivator.id
            )).toBeNull();
        });

        it('enforces the admission ordinal', async () => {
            await newRun();
            const gated = SECTS.find(entry => entry.recruits && entry.admissionOrdinal >= 6)!;
            const result = await sect({ action: 'join', sectId: gated.id });
            expect(result.error).toBe('below_admission_ordinal');
            expect(result.shortBy).toBe(gated.admissionOrdinal);
        });

        it('enforces the catalog attribute minimums, which never rise', async () => {
            // Sweptground Temple asks nothing; find a seed whose innate Insight
            // is below Lantern Hall's minimum of 3 and try the Hall instead.
            const hall = getSect('sect-lantern-hall')!;
            expect(hall.admissionOrdinal).toBeGreaterThan(0);

            let refused = false;
            for (let i = 0; i < 60 && !refused; i++) {
                closeDb();
                db = getDb(':memory:');
                process.env.ADMIN_MODE = 'true';
                const created = await newRun(`admission-seed-${i}`, `Applicant ${i}`);
                if (created.talentRoll.attributes.insight >= 3) continue;

                await admin({ action: 'set_realm', ordinal: hall.admissionOrdinal });
                const result = await sect({ action: 'join', sectId: hall.id });
                expect(result.error).toBe('admission_requirements_unmet');
                expect(result.unmet[0].attribute).toBe('insight');
                expect(result.hint).toContain('never rise');
                refused = true;
            }
            expect(refused).toBe(true);
        });

        it('admits, then refuses promotion until realm and contribution allow it', async () => {
            await newRun();
            const target = openDoorSect();
            const joined = await sect({ action: 'join', sectId: target.id });
            expect(joined.joined).toBe(true);
            expect(joined.sect.territory).toBeTruthy();

            const promotion = await sect({ action: 'promote' });
            expect(promotion.error).toBe('promotion_requirements_unmet');
            expect(promotion.requiredContribution).toBeGreaterThan(0);
        });

        it('pays only the stipend that has accrued from the in-world clock', async () => {
            const created = await newRun();
            const target = openDoorSect();
            await sect({ action: 'join', sectId: target.id });

            const immediately = await sect({ action: 'stipend' });
            expect(immediately.error).toBe('nothing_accrued');

            grantPill(created.cultivator.id, GRAIN_ABSTINENCE_PILL_ID);
            await alchemy({ action: 'consume_pill', pillId: GRAIN_ABSTINENCE_PILL_ID });
            await cultivation({
                action: 'cultivate', days: 90, focus: 'idle',
                autoBreakthrough: false, randomEvents: false
            });

            const paid = await sect({ action: 'stipend' });
            expect(paid.paid).toBe(true);
            expect(paid.monthsPaid).toBe(3);
            expect(paid.spiritStonesPaid).toBe(3 * target.stipend[0]);

            const again = await sect({ action: 'stipend' });
            expect(again.error).toBe('nothing_accrued');
        });

        it('reports standing with the exact next-rank requirements', async () => {
            await newRun();
            const target = openDoorSect();
            await sect({ action: 'join', sectId: target.id });
            const standing = await sect({ action: 'standing' });
            expect(standing.member).toBe(true);
            expect(standing.sect.compound).toBeDefined();
            expect(standing.nextRank.requiredContribution).toBeGreaterThan(0);
            expect(standing.nextRank.ordinalShortfall).toBeGreaterThan(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('admin_manage', () => {
        it('refuses every action when ADMIN_MODE is unset, and writes nothing', async () => {
            await newRun();
            const before = new CultivatorRepository(db).list().length;

            for (const call of [
                { action: 'roster' },
                { action: 'spawn_site', ordinal: 44 },
                { action: 'spawn_encounter', ordinal: 44 },
                { action: 'grant_item', itemId: MINOR_HEALING_PILL_ID },
                { action: 'set_ambient', band: 'dense' },
                { action: 'set_location', location: 'Scarwater' },
                { action: 'advance_days', days: 10 },
                { action: 'set_realm', ordinal: 30 },
                { action: 'audit_log' }
            ]) {
                const result = await admin(call);
                expect(result.error).toBe('admin_mode_disabled');
                expect(result.requires).toBe('ADMIN_MODE=true');
            }

            expect(new CultivatorRepository(db).list().length).toBe(before);
            const sites = db.prepare('SELECT COUNT(*) AS n FROM cultivation_sites').get() as { n: number };
            expect(sites.n).toBe(0);
        });

        it('refuses even when the caller insists, with no fallback path', async () => {
            process.env.ADMIN_MODE = 'false';
            await newRun();
            const result = await admin({ action: 'set_realm', ordinal: 40 });
            expect(result.error).toBe('admin_mode_disabled');
            const stored = new CultivatorRepository(db).list()[0];
            expect(stored.realmOrdinal).toBe(0);
        });

        it('spawns a real, persisted site whose contents the engine rolled', async () => {
            process.env.ADMIN_MODE = 'true';
            await newRun();

            const result = await admin({ action: 'spawn_site', ordinal: 44, kind: 'grave' });
            expect(result.spawned).toBe(true);
            expect(result.site.ordinal).toBe(44);
            expect(result.gateLifted.playerOrdinal).toBe(0);
            expect(result.site.contents.spiritStones).toBeGreaterThan(0);

            const row = db
                .prepare('SELECT * FROM cultivation_sites WHERE id = ?')
                .get(result.site.id) as any;
            expect(row).toBeDefined();
            expect(row.admin_spawned).toBe(1);
            expect(JSON.parse(row.contents).spiritStones).toBe(result.site.contents.spiritStones);
        });

        it('spawns an encounter as a real cultivator with engine-rolled talent', async () => {
            process.env.ADMIN_MODE = 'true';
            await newRun();

            const result = await admin({ action: 'spawn_encounter', ordinal: 30 });
            expect(result.spawned).toBe(true);
            expect(result.opponent.realm.ordinal).toBe(30);

            const stored = new CultivatorRepository(db).getById(result.opponent.id)!;
            expect(stored.realmOrdinal).toBe(30);
            expect(stored.kind).toBe('enemy');
            expect(stored.spiritRoot).toBeDefined();
        });

        it('grants only catalog items', async () => {
            process.env.ADMIN_MODE = 'true';
            await newRun();

            const invented = await admin({ action: 'grant_item', itemId: 'pill-of-plot-armour' });
            expect(invented.error).toBe('unknown_item');

            const real = await admin({
                action: 'grant_item', itemId: MINOR_HEALING_PILL_ID, quantity: 3
            });
            expect(real.granted).toBe(true);
            const inventory = await alchemy({ action: 'inventory' });
            expect(inventory.pills.find((p: any) => p.id === MINOR_HEALING_PILL_ID).quantity).toBe(3);
        });

        it('sets ambient by relocating to a place the engine derives that band for', async () => {
            process.env.ADMIN_MODE = 'true';
            await newRun();

            const result = await admin({ action: 'set_ambient', band: 'spirit_tide' });
            expect(result.set).toBe(true);
            expect(result.alias).toContain('Sweptground#');

            const status = await cultivation({ action: 'status' });
            expect(status.ambient).toBe('spirit_tide');
        });

        it('moves a realm through advanceRealm, logs it, and flags the run', async () => {
            process.env.ADMIN_MODE = 'true';
            const created = await newRun();

            const result = await admin({ action: 'set_realm', ordinal: 17 });
            expect(result.set).toBe(true);
            expect(result.toOrdinal).toBe(17);
            expect(result.runFlagged).toBe(true);

            const stored = new CultivatorRepository(db).getById(created.cultivator.id)!;
            expect(stored.realmOrdinal).toBe(17);
            expect(stored.cultivationProgress).toBe(0);
            expect(stored.yearsAtCurrentRealm).toBe(0);

            const storedRun = new RunRepository(db).getById(created.run.id)!;
            expect(storedRun.peakOrdinal).toBe(17);
        });

        it('audits every admin call and excludes the run from the death ledger', async () => {
            process.env.ADMIN_MODE = 'true';
            await newRun();
            await admin({ action: 'set_realm', ordinal: 5 });
            await admin({ action: 'grant_item', itemId: MINOR_HEALING_PILL_ID });

            const trail = await admin({ action: 'audit_log' });
            expect(trail.runFlagged).toBe(true);
            const actions = trail.entries.map((e: any) => e.action);
            expect(actions).toContain('admin_manage.set_realm');
            expect(actions).toContain('admin_manage.grant_item');

            const rows = db
                .prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action LIKE 'admin_manage.%'")
                .get() as { n: number };
            expect(rows.n).toBeGreaterThanOrEqual(2);

            // The audit row justifies the flag; the column indexes it. Both.
            const flag = db
                .prepare('SELECT admin FROM runs WHERE id = ?')
                .get((await run({ action: 'current' })).run.id) as { admin: number };
            expect(flag.admin).toBe(1);

            const ended = await run({ action: 'end' });
            expect(ended.ended).toBe(true);
            expect(ended.run.adminFlagged).toBe(true);

            const ledger = await run({ action: 'ledger' });
            expect(ledger.count).toBe(0);
            expect(ledger.excludedAdminRuns).toBe(1);

            const withAdmin = await run({ action: 'ledger', includeAdminRuns: true });
            expect(withAdmin.count).toBe(1);
        });

        it('advances time through the real simulation, with real consequences', async () => {
            process.env.ADMIN_MODE = 'true';
            const created = await newRun();
            grantPill(created.cultivator.id, GRAIN_ABSTINENCE_PILL_ID);
            await alchemy({ action: 'consume_pill', pillId: GRAIN_ABSTINENCE_PILL_ID });

            const result = await admin({ action: 'advance_days', years: 5 });
            expect(result.advanced).toBe(true);
            // Idle focus: real ageing, no cultivation gain.
            expect(result.cultivator.mortality.age).toBeCloseTo(21, 1);
            expect(result.deltas.cultivationProgress).toBe(0);

            const stored = new CultivatorRepository(db).getById(created.cultivator.id)!;
            expect(stored.age).toBeCloseTo(21, 1);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('routing and guiding errors (house pattern)', () => {
        it('fuzzy-matches aliases on every tool', async () => {
            await newRun();

            expect((await cultivation({ action: 'ranks' })).ranks).toBeDefined();
            expect((await cultivation({ action: 'sheet' })).rank).toBeDefined();
            expect((await run({ action: 'active' })).run).toBeDefined();
            expect((await technique({ action: 'available' })).compatible).toBeDefined();
            expect((await alchemy({ action: 'formulas' })).recipes).toBeDefined();
            expect((await sect({ action: 'sects' })).sects).toBeDefined();
        });

        it('tolerates a near-miss action name', async () => {
            await newRun();
            const result = await cultivation({ action: 'cultivat', days: 1, focus: 'idle' });
            expect(result.error).toBeUndefined();
            expect(result.cultivated).toBe(true);
        });

        it('returns a structured guiding error for an unknown action, not a stack trace', async () => {
            const result = await cultivation({ action: 'transcend_reality' });
            expect(typeof result.error).toBe('string');
            expect(result.message ?? result.error).toBeTruthy();
            expect(JSON.stringify(result)).not.toContain('    at ');
        });

        it('guides when there is no active run at all', async () => {
            const result = await cultivation({ action: 'status' });
            expect(result.error).toBe('no_active_run');
            expect(result.hint).toContain('create_cultivator');
        });

        it('routes every declared action of every tool without throwing', async () => {
            await newRun();
            const tools: Array<[any, string[]]> = [
                [handleCultivationManage, Object.keys(CultivationManageTool.actionSchemas)],
                [handleRunManage, Object.keys(RunManageTool.actionSchemas)],
                [handleTechniqueManage, Object.keys(TechniqueManageTool.actionSchemas)],
                [handleAlchemyManage, Object.keys(AlchemyManageTool.actionSchemas)],
                [handleSectManage, Object.keys(SectManageTool.actionSchemas)],
                [handleAdminManage, Object.keys(AdminManageTool.actionSchemas)]
            ];

            for (const [handler, actions] of tools) {
                for (const action of actions) {
                    const response = await handler({ action }, ctx);
                    expect(response.content[0].text).toBeTruthy();
                    // Missing required parameters must surface as a validation
                    // error, never as an exception escaping the handler.
                    expect(() => payload(response)).not.toThrow();
                }
            }
        });
    });
});
