/** The 8210cf97 six-fifty-year setup exceeded900s. The shared precondition
 * is an actual open war with living, killable combatants and surviving kin.
 * The scenario takes that WorldState and spends at most three ordinary years
 * through the played ADMIN surface. An engine-opened arranged war and a real
 * sampled war use the same scenario. Four seeds at 100-500 years sample both
 * transient open wars and living kin; six snapshots on two seeds missed that
 * intersection on 7be5ec6b. The shared predicate and scenario stay unchanged.
 * SQL account, open/severity, deed dedupe and alignment claims remain. Actual
 * battle participants/death dates distinguish war accounts from unrelated bouts. */
import { beforeAll, afterAll } from 'vitest';
import { makeGame } from './harness';
import { activeWorld, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { upsertNpc, type WorldState } from '../../src/engine/world/world-state.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { fixtureCatalog } from '../engine/world/fixtures.js';
import { PRESSURE_TEMPLATES } from '../../src/engine/world/pressure.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { createNpc, upsertRelationship, theWorldMayEnd } from '../../src/engine/world/npc-state.js';
import { areAtWarWithEachOther } from '../../src/engine/world/war-melee.js';
import { sampledWorld } from '../support/sampled-world.js';
import { obligationFromRow } from '../../src/storage/repos/obligation.repo';
import { whatTheirRecordMakesThem } from '../../src/engine/social-leverage/personal-alignment';

function withAdmin(): void {
    const before = process.env.ADMIN_MODE;
    beforeAll(() => { process.env.ADMIN_MODE = 'true'; });
    afterAll(() => {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    });
}

describe('and the world\'s own killers are on the ledger too', () => {
    withAdmin();

    /**
     * The design owner, on a war leaving nothing where a played killing left a
     * grudge: *this is bespoke. a war death is still a grudge. fix it.*
     *
     * Played, because that is the only way this was ever going to be found:
     * the world's wars ran for centuries writing an inherited tie into
     * `WorldState` and nothing at all into the table this reading is over. So
     * the reading measured the player alone, in a world full of killers no
     * record knew about.
     *
     * The span is arranged with ADMIN and nothing else is: the player sits
     * still, and every row asserted on was written by the world fighting its
     * own wars.
     */
    async function warLedgerScenario(startingWorld: WorldState) {
        expect(hasAFightWithPeopleToCarryItsAccounts(startingWorld)).toBe(true);
        const { db, game } = makeGame({ seed: 'war-ledger', adminMode: true, worldEnabled: true });
        new WorldStateRepository(db).saveWorld(startingWorld);
        resetCultivationWorlds();
        const openingDay = startingWorld.currentDay;
        try {
        const { cultivator } = await game.newRun('Bystander');
        // Rations for the span, and a rung that survives it. Arranging.
        db.prepare('UPDATE cultivators SET spirit_stones = 90000000 WHERE id = ?')
            .run(cultivator.id);
        await game.act('ADMIN set_realm 30');

        expect((db.prepare('SELECT COUNT(*) AS n FROM obligations')
            .get() as { n: number }).n).toBe(0);

        for (let i = 0; i < 3; i++) {
            await game.act('ADMIN advance_days days=365 rations=9000');
            await game.act('ADMIN set_realm 30');
        }

        const rows = (db.prepare('SELECT * FROM obligations').all() as never[])
            .map(obligationFromRow);
        const world = (await activeWorld()).state;
        const battles = world.history.facts.filter(fact => fact.kind === 'war' && fact.day > openingDay
            && typeof fact.data.fell === 'number' && Number(fact.data.fell) > 0);
        const warDeeds = new Set(world.history.facts.filter(fact => fact.kind === 'death'
            && fact.day > openingDay && battles.some(battle => battle.day === fact.day
                && fact.actors.every(actor => battle.actors.some(person => person.id === actor.id))))
            .map(fact => fact.id));
        const fromAFight = rows.filter(r => r.tags.includes('bout') && warDeeds.has(r.triggeringEventId ?? ''));
        expect(fromAFight.length).toBeGreaterThan(0);

        // These are open war killings, so every one is priced as the open
        // killing it was - the same band a killing in a square gets.
        for (const row of fromAFight) {
            expect(row.tags).toContain('open');
            expect(row.subjectId).not.toBe(cultivator.id);
            expect(['grave', 'serious']).toContain(row.severity);
        }
        expect(fromAFight.some(r => r.severity === 'grave')).toBe(true);

        // One battle, many dead, and each death ONE deed rather than one row
        // per griever. This is the dedupe the reading depends on: without it a
        // victim's family size would price the killer's character.
        const deeds = new Set(fromAFight.map(r => r.triggeringEventId));
        expect(deeds.size).toBeGreaterThan(0);
        expect(deeds.size).toBeLessThan(fromAFight.length);

        // And the reading answers about them, off the same rows and the same
        // function the player is read with. A world in which only the player
        // has a reputation is a world in which nobody else has done anything.
        // A ledger row can name nobody to answer for it, and nobody has no
        // record to read. Proved non-empty so the two assertions below cannot
        // pass on an empty list.
        const killers = [...new Set(fromAFight.map(r => r.subjectId))]
            .filter((id): id is string => id !== null);
        expect(killers.length, 'no fight row names anybody to answer for it')
            .toBeGreaterThan(0);
        const readings = killers.map(id =>
            whatTheirRecordMakesThem({ personId: id, ledger: rows }));
        expect(readings.some(r => r.alignment === 'demonic')).toBe(true);
        expect(readings.every(r => r.alignment !== 'righteous')).toBe(true);
        } finally { db.close(); }
    }

    const samples = [['demography', 100], ['drift-guard', 100],
        ['demography', 250], ['drift-guard', 250], ['demography', 300], ['drift-guard', 300],
        ['demography', 400], ['drift-guard', 500],
        ['area-occupancy-census-2026-10-01', 100], ['pyr-a', 200]] as const;
    it('reaches the same active-war state in sampled walked worlds', async () => {
        const found: boolean[] = [];
        for (const [seed, years] of samples) found.push(hasAFightWithPeopleToCarryItsAccounts(await sampledWorld(seed, { years })));
        expect(found.some(Boolean)).toBe(true);
    }, 120_000);
    it('writes an arranged war through the actual played SQL account path', async () => {
        const state = seedWorld({ seed: 'arranged-war-ledger', catalog: fixtureCatalog(), population: 250 }).state;
        const opening = PRESSURE_TEMPLATES.find(template => template.kind === 'war_opened')!;
        for (let draw = 0; draw < 64 && !hasAFightWithPeopleToCarryItsAccounts(state); draw++)
            opening.apply(state, state.currentDay, forStream(state.seed, 'arranged-open-war', draw));
        // The small catalog opens wars but does not supply two surviving kin
        // to enough fighters. Those ties are part of the shared predicate;
        // arrange them explicitly through the same person/relationship writers.
        const war = state.schedule.find(effect => effect.data.kind === 'war_resolution'
            && effect.dueOnDay > state.currentDay + 365)!;
        expect(war).toBeDefined();
        for (const houseId of [String(war.data.sideA), String(war.data.sideB)]) {
            const fighters = state.npcs.filter(person => person.status === 'alive'
                && person.factionId === houseId && theWorldMayEnd(person)).slice(0, 3);
            expect(fighters).toHaveLength(3);
            for (const fighter of fighters) {
                let current = fighter;
                for (let count = 0; count < 2; count++) {
                    const kin = createNpc(state.seed, { id: `war-kin-${fighter.id}-${count}`,
                        name: `Kin of ${fighter.name} ${count + 1}`, locationId: fighter.locationId,
                        onDay: state.currentDay, bornOnDay: state.currentDay - 20 * 365 });
                    Object.assign(state, upsertNpc(state, kin));
                    current = upsertRelationship(current, { targetId: kin.id, targetName: kin.name,
                        kind: 'kin', standing: .8, note: 'Their family.', factIds: [] }, state.currentDay);
                }
                Object.assign(state, upsertNpc(state, current));
            }
        }
        expect(hasAFightWithPeopleToCarryItsAccounts(state)).toBe(true);
        await warLedgerScenario(state);
    }, 300_000);
    it('passes a real sampled war into the same played SQL account scenario', async () => {
        for (const [seed, years] of samples) {
            const state = await sampledWorld(seed, { years });
            if (!hasAFightWithPeopleToCarryItsAccounts(state)) continue;
            await warLedgerScenario(state);
            return;
        }
        throw new Error('No sampled state satisfies the shared war predicate.');
    }, 300_000);
});

function hasAFightWithPeopleToCarryItsAccounts(state: WorldState): boolean {
    const alive = new Map(state.npcs.filter(person => person.status === 'alive').map(person => [person.id, person]));
    return state.schedule.some(effect => {
        if (effect.data.kind !== 'war_resolution' || effect.dueOnDay <= state.currentDay + 365) return false;
        const a = String(effect.data.sideA), b = String(effect.data.sideB);
        if (!areAtWarWithEachOther(state, a, b)) return false;
        return [a, b].every(id => [...alive.values()].filter(person => person.factionId === id && theWorldMayEnd(person)
            && person.relationships.filter(tie => ['kin', 'spouse', 'parent', 'child', 'master', 'disciple'].includes(tie.kind)
                && tie.standing > 0 && alive.has(tie.targetId)).length >= 2).length >= 3);
    });
}
