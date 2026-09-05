/**
 * Tool-level tests for `combat_manage`.
 *
 * What is under test is the authority boundary, not the arithmetic - the
 * engine's own suite covers the numbers. Here the questions are: can a caller
 * assert an outcome (no), does the database end up holding what the tool said
 * happened (yes), and does the tool refuse a confrontation the setting says is
 * not one (yes).
 */

import {
    CombatManageTool,
    handleCombatManage
} from '../../../src/server/consolidated/combat-manage.js';
import { handleCultivationManage } from '../../../src/server/consolidated/cultivation-manage.js';
import { handleTechniqueManage } from '../../../src/server/consolidated/technique-manage.js';
import { ConsolidatedTools } from '../../../src/server/consolidated/index.js';
import { closeDb, getDb } from '../../../src/storage/index.js';
import { CultivatorRepository } from '../../../src/storage/repos/cultivator.repo.js';
import { CombatRepository } from '../../../src/storage/repos/combat.repo.js';
import { TechniqueRepository } from '../../../src/storage/repos/technique.repo.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import { REAL_OPTIONS } from '../../../src/engine/cultivation/combat.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';

const ctx = { sessionId: 'combat-test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    if (match) return JSON.parse(match[1]);
    return JSON.parse(text);
}

const combat = async (args: Record<string, unknown>) => payload(await handleCombatManage(args, ctx));
const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));
const technique = async (args: Record<string, unknown>) =>
    payload(await handleTechniqueManage(args, ctx));

function realmStart(key: string): number {
    return REALM_TIERS.find(t => t.key === key)!.ordinalStart;
}

async function newCultivator(name = 'Shen Yue', seed = 'combat-seed') {
    const created = await cultivation({ action: 'create_cultivator', name, seed, location: 'Burnt Earth' });
    expect(created.error).toBeUndefined();
    return created;
}

/** Put a cultivator at a rank without going through a breakthrough, for setup. */
function setRank(db: ReturnType<typeof getDb>, id: string, ordinal: number, extra: Record<string, unknown> = {}) {
    const repo = new CultivatorRepository(db);
    const current = repo.getById(id)!;
    repo.update(id, {
        realmOrdinal: ordinal,
        hp: 200,
        maxHp: 200,
        qi: 400,
        maxQi: 400,
        ...extra
    } as never);
    return repo.getById(id) ?? current;
}

describe('combat_manage', () => {
    let db: ReturnType<typeof getDb>;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('registration', () => {
        it('is registered as a full contract with the rest of the surface', () => {
            const contract = ConsolidatedTools.find(c => c.name === 'combat_manage');
            expect(contract).toBeDefined();
            expect(contract!.metadata.name).toBe('combat_manage');
            expect(contract!.metadata.category).toBe('combat');
            expect(contract!.metadata.description).toBe(CombatManageTool.description);
            expect(contract!.schema).toBe(contract!.inputSchema);
            expect(contract!.actionSchemas).toBeDefined();
            expect(typeof contract!.handler).toBe('function');
        });

        it('offers no action that lets a caller declare a result', () => {
            const actions = Object.keys(CombatManageTool.actionSchemas);
            for (const forbidden of ['declare', 'set_outcome', 'win', 'kill_target', 'apply_damage']) {
                expect(actions).not.toContain(forbidden);
            }
            expect(actions.sort()).toEqual(
                ['advance', 'assess', 'create', 'end', 'flee', 'get', 'history', 'resolve', 'strike'].sort()
            );
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('assess', () => {
        it('prices both sides and shows its working', async () => {
            const created = await newCultivator();
            const result = await combat({
                action: 'assess',
                opponent: { name: 'a bandit', realmOrdinal: 2 }
            });

            expect(result.error).toBeUndefined();
            expect(result.self.factors.length).toBeGreaterThan(5);

            // The factors multiply, in listed order, to exactly the total the
            // fight would be decided by. Rounded for transport, so compare loosely.
            let product = result.self.realmBase;
            for (const factor of result.self.factors) product *= factor.factor;
            expect(product).toBeCloseTo(result.self.total, 1);

            expect(result.cultivator.id).toBe(created.cultivator.id);
        });

        it('refuses to call two major realms a fight, and says what would work', async () => {
            await newCultivator();
            const result = await combat({
                action: 'assess',
                opponent: { name: 'an elder', realmOrdinal: realmStart('nascent_soul') }
            });

            expect(result.gap.verdict).toBe('helpless');
            expect(result.gap.options).toEqual([...REAL_OPTIONS]);
            expect(result.note).toContain('refuse');
        });

        it('states what the edges carried are worth against what evening it would take', async () => {
            await newCultivator();
            const bare = await combat({
                action: 'assess',
                opponent: { name: 'a rival', realmOrdinal: 6 }
            });
            const armed = await combat({
                action: 'assess',
                opponent: { name: 'a rival', realmOrdinal: 6 },
                edges: ['ambush', 'terrain']
            });

            expect(bare.edges.multiplier).toBe(1);
            expect(armed.edges.multiplier).toBeGreaterThan(bare.edges.multiplier);
            expect(armed.edges.requiredToEven).toBeGreaterThan(0);
            expect(typeof armed.edges.sufficient).toBe('boolean');
        });

        it('changes nothing at all', async () => {
            const created = await newCultivator();
            const repo = new CultivatorRepository(db);
            const before = repo.getById(created.cultivator.id)!;

            await combat({ action: 'assess', opponent: { name: 'x', realmOrdinal: 4 } });

            const after = repo.getById(created.cultivator.id)!;
            expect(after.hp).toBe(before.hp);
            expect(after.qi).toBe(before.qi);
            expect(after.injuries.length).toBe(before.injuries.length);
        });

        it('needs a rank rather than guessing one', async () => {
            await newCultivator();
            const result = await combat({ action: 'assess', opponent: { name: 'someone' } });
            expect(result.error).toBe('opponent_not_specified');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('strike', () => {
        it('refuses an art the cultivator does not know', async () => {
            await newCultivator();
            const result = await combat({
                action: 'strike',
                techniqueId: 'ember-palm',
                opponent: { name: 'a bandit', realmOrdinal: 1 }
            });
            expect(['technique_not_known', 'unknown_technique']).toContain(result.error);
        });

        it('spends qi and starts the cooldown when it lands', async () => {
            const created = await newCultivator();
            const id = created.cultivator.id;

            const available = await technique({ action: 'list_available', cultivatorId: id });
            const art = available.compatible.find((t: any) => t.qiCost > 0 && t.category === 'attack')
                ?? available.compatible[0];
            expect(art).toBeDefined();
            await technique({ action: 'learn', techniqueId: art.id, cultivatorId: id });

            const repo = new CultivatorRepository(db);
            repo.update(id, { qi: 400, maxQi: 400 } as never);
            const before = repo.getById(id)!;

            const result = await combat({
                action: 'strike',
                techniqueId: art.id,
                opponent: { name: 'a bandit', realmOrdinal: 1 }
            });

            expect(result.error).toBeUndefined();
            expect(result.struck).toBe(true);
            const after = repo.getById(id)!;
            expect(after.qi).toBe(before.qi - art.qiCost);
            expect(result.qiRemaining).toBe(after.qi);
        });

        it('will not aim an elemental art at a soul', async () => {
            const created = await newCultivator();
            const id = created.cultivator.id;

            // Elemental qi has to travel through flesh to arrive, so the art is
            // chosen for its element rather than for the root that holds it.
            const elemental = [...TECHNIQUES]
                .filter(t => t.element !== null)
                .sort((a, b) => a.requiredOrdinal - b.requiredOrdinal)[0];
            expect(elemental).toBeDefined();
            setRank(db, id, Math.max(elemental.requiredOrdinal, 1));
            const techniques = new TechniqueRepository(db);
            techniques.upsert(elemental);
            techniques.learn(id, elemental.id, 0.5);

            const result = await combat({
                action: 'strike',
                techniqueId: elemental.id,
                vector: 'soul',
                opponent: { name: 'a rival', realmOrdinal: 1 }
            });
            expect(result.error).toBe('art_cannot_reach_a_soul');
        });

        it('refuses to resolve a strike across a categorical gap', async () => {
            const created = await newCultivator();
            const id = created.cultivator.id;
            const available = await technique({ action: 'list_available', cultivatorId: id });
            await technique({ action: 'learn', techniqueId: available.compatible[0].id, cultivatorId: id });
            new CultivatorRepository(db).update(id, { qi: 400, maxQi: 400 } as never);

            const result = await combat({
                action: 'strike',
                techniqueId: available.compatible[0].id,
                opponent: { name: 'an elder', realmOrdinal: realmStart('deity_transformation') }
            });

            expect(result.struck).toBe(false);
            expect(result.refused).toBe('helpless');
            expect(result.gap.options.length).toBeGreaterThan(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('resolve', () => {
        it('writes the wounds it reported into the database', async () => {
            const created = await newCultivator();
            const id = created.cultivator.id;
            setRank(db, id, realmStart('foundation_establishment'));

            const result = await combat({
                action: 'resolve',
                goal: 'kill',
                fightToTheEnd: true,
                opponent: { name: 'a rival', realmOrdinal: realmStart('foundation_establishment'), maxHp: 200 }
            });

            expect(result.error).toBeUndefined();
            const stored = new CultivatorRepository(db).getById(id)!;
            expect(stored.injuries.length).toBe(result.injuries.self.length);
            for (const injury of result.injuries.self) {
                expect(stored.injuries.some(i => i.id === injury.id)).toBe(true);
            }
        });

        it('records the confrontation and counts it as experience', async () => {
            const created = await newCultivator();
            const id = created.cultivator.id;
            setRank(db, id, realmStart('core_formation'));

            await combat({
                action: 'resolve',
                goal: 'humiliate',
                opponent: { name: 'a rival', realmOrdinal: 4 }
            });

            const stored = new CultivatorRepository(db).getById(id)!;
            expect(stored.battlesSurvived).toBe(1);
            expect(stored.battlesWon).toBe(1);

            const records = new CombatRepository(db).listRecords(id);
            expect(records).toHaveLength(1);
            expect(records[0].outcome).toBe('humiliation');
            expect(records[0].opponentName).toBe('a rival');
        });

        it('produces a standing feud rather than only a corpse', async () => {
            const created = await newCultivator();
            const id = created.cultivator.id;
            setRank(db, id, realmStart('core_formation'));

            const result = await combat({
                action: 'resolve',
                goal: 'humiliate',
                opponent: { name: 'Wen Sho', realmOrdinal: 4 }
            });

            expect(result.outcome).toBe('humiliation');
            expect(result.died).toBe(false);
            expect(result.obligations).toHaveLength(1);
            expect(result.obligations[0].cause).toBe('humiliation');
            expect(result.obligations[0].subjectId).toBe(id);
        });

        it('destroys a high Drawn cultivator\'s body without calling it a death', async () => {
            const created = await newCultivator('Attacker');
            const attackerId = created.cultivator.id;
            setRank(db, attackerId, 40);

            const victim = await cultivation({
                action: 'create_cultivator',
                name: 'Elder Rong',
                seed: 'victim-seed'
            });
            // Two runs cannot both be active, so the victim is used as a described
            // opponent at their real rank rather than as a live cultivator row.
            expect(victim).toBeDefined();

            const result = await combat({
                action: 'resolve',
                cultivatorId: attackerId,
                goal: 'kill',
                opponent: {
                    name: 'Elder Rong',
                    realmOrdinal: realmStart('nascent_soul'),
                    traditionId: 'tradition-drawn'
                }
            });

            expect(result.outcome).toBe('body_destroyed');
            expect(result.finished).toBe(false);
            expect(result.remnant).toBe('soul');
            expect(result.killRequirement.bodyIsEnough).toBe(false);
        });

        it('leaves a carver a seam rather than a soul', async () => {
            const created = await newCultivator('Attacker');
            setRank(db, created.cultivator.id, 40);

            const result = await combat({
                action: 'resolve',
                goal: 'kill',
                opponent: {
                    name: 'a carver',
                    realmOrdinal: 4,
                    traditionId: 'tradition-cut'
                }
            });

            expect(result.outcome).toBe('body_destroyed');
            expect(result.remnant).toBe('seam');
            expect(result.killRequirement.soulAttackWorks).toBe(false);
        });

        it('refuses across a categorical gap and hurts nobody doing it', async () => {
            const created = await newCultivator();
            const id = created.cultivator.id;
            const repo = new CultivatorRepository(db);
            const before = repo.getById(id)!;

            const result = await combat({
                action: 'resolve',
                goal: 'kill',
                opponent: { name: 'an ancestor', realmOrdinal: realmStart('void_refinement') }
            });

            expect(result.outcome).toBe('no_contest');
            expect(result.exchanges).toEqual([]);
            expect(repo.getById(id)!.hp).toBe(before.hp);
        });

        it('advances the run turn exactly once', async () => {
            const created = await newCultivator();
            setRank(db, created.cultivator.id, realmStart('core_formation'));
            const before = created.run.turn;

            const result = await combat({
                action: 'resolve',
                goal: 'drive_off',
                opponent: { name: 'a rival', realmOrdinal: 6 }
            });

            expect(result.cultivator.run.turn).toBe(before + 1);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('flee', () => {
        it('itemises the odds and costs something either way', async () => {
            const created = await newCultivator();
            const id = created.cultivator.id;
            const repo = new CultivatorRepository(db);
            const before = repo.getById(id)!;

            const result = await combat({
                action: 'flee',
                opponent: { name: 'a pursuer', realmOrdinal: 8 }
            });

            expect(typeof result.escaped).toBe('boolean');
            const sum = result.modifiers.reduce((total: number, m: any) => total + m.delta, 0);
            expect(sum).toBeCloseTo(result.chance, 3);
            expect(result.damage).toBeGreaterThan(0);
            expect(repo.getById(id)!.hp).toBeLessThan(before.hp);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('history', () => {
        it('reports nothing before anything has happened', async () => {
            await newCultivator();
            const result = await combat({ action: 'history' });
            expect(result.records).toEqual([]);
            expect(result.battlesSurvived).toBe(0);
        });

        it('reads back what was actually resolved', async () => {
            const created = await newCultivator();
            setRank(db, created.cultivator.id, realmStart('core_formation'));
            await combat({ action: 'resolve', goal: 'subdue', opponent: { name: 'Bo', realmOrdinal: 3 } });

            const result = await combat({ action: 'history' });
            expect(result.records).toHaveLength(1);
            expect(result.records[0].opponent).toBe('Bo');
            expect(result.records[0].outcome).toBe('capture');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('encounters', () => {
        it('rolls an order dominated by rank, and advances through it', async () => {
            const created = await combat({
                action: 'create',
                seed: 'encounter-seed',
                participants: [
                    { id: 'mortal', name: 'A Farmhand', realmOrdinal: 0 },
                    { id: 'elder', name: 'An Elder', realmOrdinal: realmStart('core_formation') }
                ]
            });

            expect(created.error).toBeUndefined();
            expect(created.turnOrder[0].id).toBe('elder');
            expect(created.currentTurn.id).toBe('elder');

            const advanced = await combat({ action: 'advance', encounterId: created.encounterId });
            expect(advanced.currentTurn.id).toBe('mortal');
            expect(advanced.round).toBe(1);

            const wrapped = await combat({ action: 'advance', encounterId: created.encounterId });
            expect(wrapped.currentTurn.id).toBe('elder');
            expect(wrapped.round).toBe(2);

            const state = await combat({ action: 'get', encounterId: created.encounterId });
            expect(state.round).toBe(2);
            expect(state.status).toBe('active');

            const ended = await combat({ action: 'end', encounterId: created.encounterId });
            expect(ended.status).toBe('ended');
        });

        it('says so plainly when there is no encounter', async () => {
            const result = await combat({ action: 'advance' });
            expect(result.error).toBe('no_encounter');
        });
    });
});
