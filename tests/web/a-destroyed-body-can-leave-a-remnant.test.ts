/**
 * Violent death used to write physically_dead without asking the existence
 * resolver. From Nascent Soul, an unprepared destruction can leave an imprint.
 * It is not the original person: the run ends and the estate passes on, while
 * the world preserves the remnant through settlement and a database reload.
 * Old age never draws this survival. The same rule applies to a destroyed NPC body.
 */
import { expect, it } from 'vitest';
import { NASCENT_SOUL_ORDINAL, resolveBodilyDestruction, isTheSamePerson } from '../../src/engine/cultivation/existence';
import { forStream } from '../../src/engine/cultivation/rng';
import { addGoal, createNpc, markDead } from '../../src/engine/world/npc-state';
import { getNpc } from '../../src/engine/world/world-state';
import { whatTheConfrontationDidToThem } from '../../src/engine/world/what-a-confrontation-does-to-somebody-the-world-holds';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo';
import { settleWhatTheyWereCarrying } from '../../src/web/estate-settlement';
import { LegacyLedger } from '../../src/web/leaving-things-for-the-next-life';
import { makeCultivator } from '../engine/cultivation/fixtures';
import { makeGameInWorld } from './harness';

it('stores a player remnant, closes the life, and preserves the imprint through its estate', async () => {
    const h = await makeGameInWorld({ worldSeed: 'a-body-left-an-imprint', seed: 'remnant' });
    const { cultivator, run } = await h.game.newRun('Shen Ke');
    const world = (await h.game.loadWorld())!;
    const before = h.repos.cultivators.update(cultivator.id, {
        realmOrdinal: NASCENT_SOUL_ORDINAL, injuries: [], soulState: 'intact'
    })!;
    const turn = Array.from({ length: 100 }, (_, i) => i).find(i =>
        resolveBodilyDestruction(before, {}, forStream(before.id, 'bodily-destruction', i)).state === 'remnant');
    expect(turn, 'the existence resolver can leave an unprepared remnant').toBeDefined();
    const ended = h.repos.cultivators.markDead(before.id, 'combat_defeat', turn!, 'Killed in a fight.', true)!;
    expect(ended.existenceState).toBe('remnant');
    expect(isTheSamePerson(ended)).toBe(false);
    expect(h.repos.runs.getById(run.id)?.status).toBe('dead');
    expect(h.repos.runs.getById(run.id)?.deathDescription).toContain('remnant remains');

    const deps = {
        db: h.db, world, ledger: new LegacyLedger(h.db), cultivator: ended,
        runId: run.id, causeNote: 'Killed in a fight.', standingOver: [], leavesBody: false
    };
    settleWhatTheyWereCarrying(deps);
    settleWhatTheyWereCarrying(deps);
    const stored = new WorldStateRepository(h.db);
    stored.saveWorld(world);
    const remembered = getNpc(stored.loadWorld(world.id)!, ended.id)!;
    expect(remembered.status).toBe('remnant');
    expect(remembered.identityContinuity).toBe(ended.identityContinuity);
    expect(remembered.soulState).toBe(ended.soulState);

    const old = h.repos.cultivators.create(makeCultivator({ id: 'old-life', realmOrdinal: NASCENT_SOUL_ORDINAL }));
    expect(h.repos.cultivators.markDead(old.id, 'lifespan_exhausted', turn!)?.existenceState).toBe('physically_dead');
}, 120_000);

it('leaves an NPC remnant through the live confrontation consequence and ends its old goals', async () => {
    const h = await makeGameInWorld({ worldSeed: 'an-npc-left-an-imprint', seed: 'remnant' });
    await h.game.newRun('Shen Ke');
    const world = (await h.game.loadWorld())!;
    const onDay = world.currentDay;
    const npc = Array.from({ length: 100 }, (_, i) => createNpc(world.seed, {
        id: `subject-${i}`, name: 'A test cultivator', onDay, bornOnDay: onDay - 365 * 100,
        cultivation: { realmOrdinal: NASCENT_SOUL_ORDINAL }
    })).find(n => resolveBodilyDestruction({
        realmOrdinal: n.cultivation.realmOrdinal, cultivationProgress: 0, injuries: [], soulState: n.soulState
    }, {}, forStream(n.id, 'bodily-destruction', onDay)).state === 'remnant')!;
    expect(npc).toBeDefined();
    const withGoal = addGoal(npc, { kind: 'cultivation', text: 'Cultivate further.' }, onDay);
    world.npcs.push(withGoal);
    const result = whatTheConfrontationDidToThem(world, {
        npcId: npc.id, byId: 'killer', byName: 'The attacker', day: onDay,
        wounds: [], outcome: 'body_destroyed', lost: true, finished: false
    });
    expect(result.died).toBe(true);
    const after = getNpc(world, npc.id)!;
    expect(after.status).toBe('remnant');
    expect(isTheSamePerson({ existenceState: after.status, identityContinuity: after.identityContinuity })).toBe(false);
    expect(after.goals.length).toBeGreaterThan(0);
    expect(after.goals.every(goal => goal.status === 'impossible')).toBe(true);
    expect(markDead(withGoal, onDay, 'The soul was ended.').status).toBe('physically_dead');
}, 120_000);
