/**
 * Remote presence had no persisted creation path. These played turns cover each
 * form, the remote area's conversation, a combat loss and a dated return.
 * Body recovery spends real preparations and materials. A retained soul can
 * continue; rebuilding a remnant never restores the ended person's identity.
 * Losing that rebuilt body also cannot recover more identity than it held.
 * NPCs use the same recovery attempt, including resistance from the player's soul.
 * The NPC attempt fixture samples the actual one-day settling clock, including
 * the opening hour; an integer-day preview sampled a different RNG point.
 * The combat controls now finish the held fight, rather than restart it eight
 * times after an escape, and read destruction from its actual remaining body.
 * The reconstruction control stations its actual helper beside the retained
 * remnant, observes the attempt, and compares its price and result with the
 * native attempt on the actual settling clock, without searching for a success.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { parseIntent } from '../../src/web/verb-pattern-table';
import { makeObject } from '../../src/engine/world/possessions';
import { createNpc, setExistence, addGoal, upsertRelationship } from '../../src/engine/world/npc-state';
import { worldLocationFor } from '../../src/web/entities';
import { theAreasOf, whereInThisPlaceTheyStand } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { forStream } from '../../src/engine/cultivation/rng';
import { resolveBodilyDestruction, isTheSamePerson, NASCENT_SOUL_ORDINAL } from '../../src/engine/cultivation/existence';
import { getNpc } from '../../src/engine/world/world-state';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo';
import type { ProviderCallOpts, ProviderCallResult } from '../../src/agent/provider/types';
import type { UnfinishedFight } from '../../src/engine/cultivation/unfinished-fight';
import { recoverABody } from '../../src/engine/world/something-acting-in-your-place';
import { routineTime } from '../../src/engine/world/npc-routines';
import { makeLocation } from '../../src/engine/world/locations';

class SceneProvider extends ScriptedProvider {
    plan = '{"action":"look"}';
    constructor() { super({ narrations: ['A voice answers from the square.'] }); }
    override async call(opts: ProviderCallOpts): Promise<ProviderCallResult> {
        if (!(opts.messages.find(m => m.role === 'system')?.content ?? '').startsWith('You are the intent router')) return super.call(opts);
        this.calls.push(opts);
        return { text: this.plan, raw: this.plan, durationMs: 0 };
    }
    scene(): string {
        return this.calls.filter(c => !(c.messages.find(m => m.role === 'system')?.content ?? '').startsWith('You are the intent router'))
            .at(-1)?.messages.find(m => m.role === 'user')?.content ?? '';
    }
}

async function setup(seed: string, ordinal = 29, worldEnabled = true) {
    const provider = new SceneProvider();
    const h = await makeGameInWorld({ worldSeed: `proxy-world-${seed}`, seed, provider, worldEnabled });
    const { cultivator, run } = await h.game.newRun('Shen Ke');
    const world = (await h.game.loadWorld())!;
    const source = worldLocationFor(world, cultivator.location)!;
    const destination = world.locations.find(p => p.id !== source.id && p.kind === 'settlement')!;
    h.repos.cultivators.advanceRealm(cultivator.id, ordinal);
    const raised = h.repos.cultivators.getById(cultivator.id)!;
    h.repos.cultivators.update(cultivator.id, { hp: raised.maxHp, qi: raised.maxQi });
    for (const n of world.npcs) if ((n.locationId === destination.id || n.locationId === source.id) && n.id !== cultivator.id) n.locationId = null;
    h.game.atHand = world;
    h.game.theWorldMoved();
    const play = async (text: string) => {
        provider.plan = JSON.stringify(parseIntent(text));
        return h.game.act(text);
    };
    const material = (id: string, ownerId = cultivator.id) => {
        world.objects.push(makeObject({ id, name: 'Heaven-grade bone', kind: 'material', possessorId: ownerId,
            ownerId, data: { grade: 'heaven' } }));
        h.game.theWorldMoved();
    };
    const person = (id: string, name: string, ordinal = 0, at = destination.id) => {
        const n = createNpc(world.seed, { id, name, onDay: world.currentDay,
            bornOnDay: world.currentDay - 18 * 365, locationId: at,
            cultivation: { realmOrdinal: ordinal } });
        world.npcs.push(n);
        h.game.knowledge.learn({ holderId: cultivator.id, kind: 'cultivator', id, name,
            onDay: world.currentDay, sourceKind: 'told', stage: 'encountered', stance: 'knows' });
        h.game.theWorldMoved();
        return n;
    };
    const proxy = () => world.objects.find(o => o.tags.includes('acting-proxy') && o.ownerId === cultivator.id)!;
    return { ...h, provider, world, source, destination, cultivator, run, play, material, person, proxy };
}

/** Follow this actual held bout until it settles or the dated presence ends. */
async function finishPresenceFight(h: Awaited<ReturnType<typeof setup>>, presence: ReturnType<typeof makeObject>, target: string) {
    if (typeof presence.data.fight !== 'string') return;
    const opened = JSON.parse(presence.data.fight) as UnfinishedFight;
    for (let turn = 0; turn < opened.roundBudget && typeof presence.data.fight === 'string'
        && presence.data.endedOnDay === undefined; turn++) {
        const before = JSON.parse(presence.data.fight) as UnfinishedFight;
        const acted = await h.play(`I attack ${target}`);
        if (typeof presence.data.fight === 'string' && presence.data.endedOnDay === undefined) {
            const after = JSON.parse(presence.data.fight) as UnfinishedFight;
            expect(after.id, JSON.stringify(acted.toolCalls)).toBe(before.id);
            expect(after.roundsFought, JSON.stringify(acted.toolCalls)).toBeGreaterThan(before.roundsFought);
        }
    }
    expect(presence.data.endedOnDay !== undefined || presence.data.fight == null,
        'the actual held fight must settle within its native budget').toBe(true);
}

describe('acting through a persisted presence', () => {
    it.each(['sword', 'clone', 'soul'] as const)('creates a %s, leaves the body and reloads its dated presence', async kind => {
        const h = await setup(`create-${kind}`);
        const sword = makeObject({ id: 'held-blade', name: 'A carried sword', kind: 'artifact', power: 29,
            ownerId: h.cultivator.id, possessorId: h.cultivator.id, tags: ['sword'] });
        h.world.objects.push(sword);
        h.game.theWorldMoved();
        const sentence = kind === 'sword' ? `I send my sword to ${h.destination.name}`
            : kind === 'clone' ? `I split off a clone at ${h.destination.name}` : `my soul goes to ${h.destination.name}`;
        const acted = await h.play(sentence);
        expect(acted.toolCalls.some(c => c.name === 'world.separatedPresence' && c.ok)).toBe(true);
        expect(acted.state.cultivator.location).toBe(h.source.name);
        const saved = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
        const presence = saved.objects.find(o => o.id === h.proxy().id)!;
        expect(presence.ownerId).toBe(h.cultivator.id);
        expect(presence.locationId).toBe(h.destination.id);
        expect(Number(presence.data.lapsesOnDay)).toBeGreaterThan(saved.currentDay);
        if (kind === 'sword') expect(saved.objects.find(o => o.id === sword.id)?.possessorId).toBeNull();
    }, 120_000);

    it('looks and talks only in the remote area, gives the model that place, and leaves the body in place', async () => {
        const h = await setup('remote-conversation');
        const speaker = h.person('remote-speaker', 'Lan Sheng');
        const elsewhere = h.person('elsewhere-speaker', 'Bo Wen', 0, h.source.id);
        await h.play(`my soul goes to ${h.destination.name}`);
        h.proxy().data.standingIn = theAreasOf(h.world, h.destination).whereIs.get(speaker.id)!;
        h.game.theWorldMoved();
        await h.play('I look around');
        expect(h.provider.scene()).toContain(h.destination.name);
        expect(h.game.present(h.repos.cultivators.getById(h.cultivator.id)!).map(n => n.id)).toContain(speaker.id);
        expect(h.game.present(h.repos.cultivators.getById(h.cultivator.id)!).length).toBeLessThanOrEqual(3);
        const talked = await h.play(`I talk to ${speaker.name}`);
        expect(talked.toolCalls.some(c => c.ok && c.action === 'interact')).toBe(true);
        const absent = await h.play(`I talk to ${elsewhere.name}`);
        expect(absent.toolCalls.some(c => c.ok === false && c.action === 'interact')).toBe(true);
        const ownArea = String(h.proxy().data.standingIn);
        const otherArea = theAreasOf(h.world, h.destination).areas.find(a => a.id !== ownArea)!;
        const moved = await h.play(`I move to ${otherArea.name}`);
        expect(h.proxy().data.standingIn, JSON.stringify(moved.toolCalls)).toBe(otherArea.id);
        const leftBehind = await h.play(`I talk to ${speaker.name}`);
        expect(leftBehind.toolCalls.some(c => c.action === 'interact' && !c.ok)).toBe(true);
        expect(h.repos.cultivators.getById(h.cultivator.id)?.location).toBe(h.source.name);
    }, 120_000);

    it('keeps the sent sword\'s actual fight result without killing the distant body', async () => {
        const h = await setup('proxy-loss', 15);
        h.world.objects.push(makeObject({ id: 'weak-blade', name: 'A carried sword', kind: 'artifact', power: 15,
            ownerId: h.cultivator.id, possessorId: h.cultivator.id, tags: ['sword'] }));
        const defender = h.person('strong-defender', 'Lan Sheng', 20);
        await h.play(`I send my sword to ${h.destination.name}`);
        h.proxy().data.standingIn = theAreasOf(h.world, h.destination).whereIs.get(defender.id)!;
        h.game.theWorldMoved();
        const before = Number(h.proxy().data.hp);
        const fought = await h.play(`I attack ${defender.name}`);
        expect(fought.toolCalls.some(call => call.name === 'world.separatedPresence' && call.action === 'attack' && call.ok),
            JSON.stringify(fought.toolCalls)).toBe(true);
        await finishPresenceFight(h, h.proxy(), defender.name);
        expect(Number(h.proxy().data.hp), 'the sent body must actually bear the fight').toBeLessThan(before);
        const destroyed = Number(h.proxy().data.hp) <= 0;
        expect(h.proxy().data.lost === true, JSON.stringify(fought.toolCalls)).toBe(destroyed);
        expect(h.world.objects.find(o => o.id === 'weak-blade')?.tags.includes('ruined')).toBe(destroyed);
        expect(h.repos.cultivators.getById(h.cultivator.id)?.alive).toBe(true);
    }, 120_000);

    it('returns a lapsed sword on the world clock', async () => {
        const h = await setup('proxy-lapse', 15, true);
        h.world.objects.push(makeObject({ id: 'returning-blade', name: 'A carried sword', kind: 'artifact', power: 15,
            ownerId: h.cultivator.id, possessorId: h.cultivator.id, tags: ['sword'] }));
        h.game.theWorldMoved();
        await h.play(`I send my sword to ${h.destination.name}`);
        await h.play('I wait one day');
        const saved = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
        expect(saved.objects.find(o => o.id === h.proxy().id)?.data.endedOnDay).toBeDefined();
        expect(saved.objects.find(o => o.id === 'returning-blade')?.possessorId).toBe(h.cultivator.id);
    }, 120_000);
});

describe('surviving and recovering a body', () => {
    it('prepares a real anchor, survives destruction conditionally, and possesses a resisted living body', async () => {
        const h = await setup('retained-soul');
        h.repos.cultivators.update(h.cultivator.id, { knownTechniques: ['soul-anchoring-invocation'] });
        h.material('anchor-material');
        await h.play('I prepare my soul anchor');
        const anchor = h.world.objects.find(o => o.tags.includes('soul-anchor'))!;
        expect(anchor).toBeDefined();
        const before = h.repos.cultivators.getById(h.cultivator.id)!;
        const turn = Array.from({ length: 100 }, (_, i) => i).find(i => {
            const outcome = resolveBodilyDestruction(before, { prepared: true, soulAnchor: true }, forStream(before.id, 'bodily-destruction', i));
            return outcome.state === 'soul_preserved' && outcome.identityContinuity >= 0.5;
        })!;
        const retained = h.repos.cultivators.markDead(before.id, 'combat_defeat', turn, 'The body was destroyed.', true)!;
        expect(retained.existenceState).toBe('soul_preserved');
        expect(retained.alive).toBe(true);
        expect(h.repos.runs.getById(h.run.id)?.status).toBe('active');
        const victimId = Array.from({ length: 100 }, (_, i) => `vessel-${i}`).find(id =>
            forStream(h.world.seed, 'body-recovery', before.id, id, h.world.currentDay).next() < 0.9)!;
        const victim = h.person(victimId, 'Lan Sheng', 0, h.source.id);
        const witness = h.person('possession-witness', 'Bo Wen', 0, h.source.id);
        victim.factionId = h.world.factions[0]!.id;
        victim.factionRankIndex = 0;
        witness.factionId = victim.factionId;
        witness.factionRankIndex = 0;
        h.game.theWorldMoved();
        h.repos.cultivators.standIn(before.id, theAreasOf(h.world, h.source).whereIs.get(victim.id)!);
        const possessed = await h.play(`I possess ${victim.name}`);
        const after = h.repos.cultivators.getById(before.id)!;
        expect(after.existenceState, JSON.stringify(possessed.toolCalls)).toBe('possessing');
        expect(after.bodyId).toBe(victim.id);
        expect(isTheSamePerson(after)).toBe(true);
        expect(getNpc(h.world, victim.id)?.status).toBe('physically_dead');
        expect(h.world.history.facts.some(f => f.data.crime === 'possession')).toBe(true);
        expect(h.world.obligations.some(o => o.holderId === victim.factionId && o.subjectId === before.id)).toBe(true);
        const saved = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
        expect(saved.objects.find(o => o.id === anchor.id)?.tags).toContain('ruined');
    }, 120_000);

    it('rebuilds a remnant from real material and a mastered art without restoring the original identity', async () => {
        const h = await setup('rebuild-remnant');
        h.repos.cultivators.update(h.cultivator.id, { knownTechniques: ['spring-returning-life-art'] });
        const actorId = Array.from({ length: 100 }, (_, i) => `remnant-${i}`).find(id =>
            forStream(h.world.seed, 'body-recovery', id, 'rebuild-material', h.world.currentDay).next() < 0.75)!;
        const remnant = h.person(actorId, 'Lan Sheng', NASCENT_SOUL_ORDINAL, h.source.id);
        h.world.npcs[h.world.npcs.findIndex(n => n.id === remnant.id)] = setExistence(remnant, {
            to: 'remnant', onDay: h.world.currentDay, soulState: 'damaged', identityContinuity: 0.35
        });
        h.material('rebuild-material');
        h.repos.cultivators.standIn(h.cultivator.id, whereInThisPlaceTheyStand(h.world, h.source, null, null).id);
        const rebuilt = await h.play(`I rebuild ${remnant.name}'s body`);
        const saved = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
        const after = getNpc(saved, remnant.id)!;
        expect(after.status, JSON.stringify(rebuilt.toolCalls)).toBe('reconstructed');
        expect(after.bodyId).not.toBeNull();
        expect(isTheSamePerson({ existenceState: after.status, identityContinuity: after.identityContinuity })).toBe(false);
        expect(saved.objects.find(o => o.id === 'rebuild-material')?.tags).toContain('ruined');
        expect(saved.objects.some(o => o.id === after.bodyId && o.tags.includes('rebuilt-body'))).toBe(true);
        const escapedAgain = Array.from({ length: 100 }, (_, i) => resolveBodilyDestruction({
            realmOrdinal: after.cultivation.realmOrdinal, cultivationProgress: 0,
            injuries: after.cultivation.injuries, soulState: after.soulState,
            existenceState: after.status, identityContinuity: after.identityContinuity
        }, { prepared: true, soulAnchor: true }, forStream(saved.seed, 'rebuilt-body-destruction', i)))
            .find(outcome => outcome.state === 'soul_preserved');
        expect(escapedAgain).toBeDefined();
        expect(escapedAgain!.identityContinuity).toBeLessThanOrEqual(after.identityContinuity);
    }, 120_000);

    it('lets an NPC pursue the player through a persisted presence', async () => {
        const h = await setup('npc-proxy', 0, true);
        const foe = h.person('distant-foe', 'Lan Sheng', 29);
        const pursuing = addGoal(foe, { kind: 'revenge', text: 'Reach the person who wronged them.', targetId: h.cultivator.id }, h.world.currentDay);
        h.world.npcs[h.world.npcs.findIndex(n => n.id === foe.id)] = pursuing;
        h.game.theWorldMoved();
        await h.play('I wait one day');
        const saved = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
        expect(saved.objects.some(o => o.tags.includes('acting-proxy') && o.ownerId === foe.id && o.locationId === h.source.id),
            JSON.stringify({ npc: getNpc(saved, foe.id), day: saved.currentDay })).toBe(true);
        expect(h.repos.cultivators.getById(h.cultivator.id)?.hp).toBeLessThan(h.cultivator.hp);
        expect(h.provider.scene()).toContain('A separated presence attacked the body.');
    }, 120_000);

    it('lets an NPC soul take the player body and closes the displaced life', async () => {
        const h = await setup('npc-possession', 0);
        const day = routineTime(h.world) + 1;
        const id = Array.from({ length: 1000 }, (_, i) => `taking-soul-${i}`).find(id =>
            forStream(h.world.seed, 'seek-a-body', id, day).chance(0.15)
            && forStream(h.world.seed, 'body-recovery', id, h.cultivator.id, day).next() < 0.9)!;
        const soul = h.person(id, 'Lan Sheng', 29, h.source.id);
        h.world.npcs[h.world.npcs.findIndex(n => n.id === id)] = setExistence(soul, {
            to: 'remnant', onDay: h.world.currentDay, soulState: 'damaged', identityContinuity: 0.35
        });
        h.repos.cultivators.standIn(h.cultivator.id, whereInThisPlaceTheyStand(h.world, h.source, null, null).id);
        h.game.theWorldMoved();
        const waited = await h.play('I wait one day');
        const saved = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
        expect(getNpc(saved, id)?.status, JSON.stringify({ calls: waited.toolCalls, day: saved.currentDay,
            expectedDay: day, npc: getNpc(saved, id), body: h.repos.cultivators.getById(h.cultivator.id) })).toBe('possessing');
        expect(getNpc(saved, id)?.bodyId).toBe(h.cultivator.id);
        expect(h.repos.cultivators.getById(h.cultivator.id)?.alive).toBe(false);
        expect(h.repos.runs.getById(h.run.id)?.status).toBe('dead');
        expect(saved.history.facts.some(f => f.data.crime === 'possession')).toBe(true);
    }, 120_000);

    it('lets an NPC ally attempt reconstruction with its actual price and outcome on the world clock', async () => {
        const h = await setup('npc-reconstruction');
        const place = makeLocation({ id: 'reconstruction-ground', name: 'A cave above the ford', kind: 'cave' });
        h.world.locations.push(place);
        const materialId = 'npc-rebuilding-material';
        const id = 'rebuilding-soul-0';
        const remnant = h.person(id, 'Lan Sheng', 29, place.id);
        h.world.npcs[h.world.npcs.findIndex(n => n.id === id)] = setExistence(remnant, {
            to: 'remnant', onDay: h.world.currentDay, soulState: 'damaged', identityContinuity: 0.35
        });
        const helper = h.person('rebuilding-ally', 'Bo Wen', 29, place.id);
        helper.cultivation.techniqueIds = ['spring-returning-life-art'];
        Object.assign(helper, upsertRelationship(helper, { targetId: id, targetName: remnant.name, kind: 'ally', standing: 0.8 }, h.world.currentDay));
        h.material(materialId, helper.id);
        for (const person of [getNpc(h.world, id)!, helper]) {
            person.activity = { kind: 'idle', note: 'Waiting together for the body to be rebuilt',
                sinceDay: routineTime(h.world), untilDay: routineTime(h.world) + 2,
                withIds: [id, helper.id, h.cultivator.id].filter(other => other !== person.id) };
        }
        const area = theAreasOf(h.world, place).whereIs.get(id)
            ?? whereInThisPlaceTheyStand(h.world, place, null, getNpc(h.world, id)!.factionId).id;
        expect(theAreasOf(h.world, place).whereIs.get(helper.id), 'the actual maker must be beside the remnant')
            .toBe(area);
        helper.activity!.standingIn = area;
        h.repos.cultivators.update(h.cultivator.id, { location: place.name });
        h.repos.cultivators.standIn(h.cultivator.id, area);
        h.game.theWorldMoved();
        const expected = structuredClone(h.world);
        const waited = await h.play('I wait one day');
        const saved = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
        expected.currentDay = saved.currentDay;
        expected.currentHour = saved.currentHour;
        const attempted = recoverABody(expected, getNpc(expected, id)!, 'reconstructed',
            expected.objects.find(object => object.id === materialId)!, getNpc(expected, helper.id)!);
        expect(expected.objects.find(object => object.id === materialId)?.tags,
            `the paired native control must make an actual attempt: ${attempted.line}`).toContain('ruined');
        expect(saved.objects.find(o => o.id === materialId)?.tags,
            JSON.stringify({ calls: waited.toolCalls, remnant: getNpc(saved, id), helper: getNpc(saved, helper.id),
                day: saved.currentDay, hour: saved.currentHour })).toContain('ruined');
        expect(getNpc(saved, id)?.status).toBe(getNpc(expected, id)?.status);
        expect(getNpc(saved, id)?.soulState).toBe(getNpc(expected, id)?.soulState);
        expect(getNpc(saved, id)?.identityContinuity).toBe(getNpc(expected, id)?.identityContinuity);
        expect(isTheSamePerson({ existenceState: getNpc(saved, id)!.status, identityContinuity: getNpc(saved, id)!.identityContinuity })).toBe(false);
    }, 120_000);

    it('talks to an NPC projection and fights its body of qi without hurting its distant maker', async () => {
        const h = await setup('npc-remote-conversation');
        const friend = h.person('distant-speaker', 'Lan Sheng', 21);
        const reaching = addGoal(friend, { kind: 'reunion', text: 'Speak to the person they know.', targetId: h.cultivator.id }, h.world.currentDay);
        h.world.npcs[h.world.npcs.findIndex(n => n.id === friend.id)] = reaching;
        h.game.theWorldMoved();
        await h.play('I wait one day');
        const presence = h.world.objects.find(o => o.tags.includes('acting-proxy') && o.ownerId === friend.id)!;
        expect(presence).toBeDefined();
        const talked = await h.play(`I talk to ${friend.name}`);
        expect(talked.toolCalls.some(c => c.action === 'interact' && c.ok)).toBe(true);
        const makerHp = getNpc(h.world, friend.id)!.cultivation.hp;
        const before = Number(presence.data.hp);
        const fought = await h.play(`I attack ${friend.name}`);
        expect(fought.toolCalls.some(call => call.name === 'world.separatedPresence' && call.action === 'attack' && call.ok),
            JSON.stringify(fought.toolCalls)).toBe(true);
        await finishPresenceFight(h, presence, friend.name);
        expect(Number(presence.data.hp), 'the remote body must actually bear the fight').toBeLessThan(before);
        const destroyed = Number(presence.data.hp) <= 0;
        expect(presence.data.lost === true).toBe(destroyed);
        expect(getNpc(h.world, friend.id)?.cultivation.hp).toBe(makerHp);
        expect(getNpc(h.world, friend.id)?.status).toBe('alive');
        expect(getNpc(h.world, friend.id)?.soulState).toBe(destroyed ? 'damaged' : 'intact');
    }, 120_000);

    it('charges an exposed body the result of an actual assault even when the sword lapses that day', async () => {
        const h = await setup('unguarded-body', 15);
        h.world.objects.push(makeObject({ id: 'exposing-blade', name: 'A carried sword', kind: 'artifact', power: 15,
            possessorId: h.cultivator.id, ownerId: h.cultivator.id, tags: ['sword'] }));
        const enemy = h.person('waiting-enemy', 'Lan Sheng', 20, h.source.id);
        enemy.factionId = h.world.factions[0]!.id;
        enemy.factionRankIndex = 0;
        enemy.activity = { kind: 'stationed', sinceDay: h.world.currentDay,
            untilDay: h.world.currentDay + 100, withIds: [], note: '' };
        Object.assign(enemy, upsertRelationship(enemy, { targetId: h.cultivator.id, targetName: h.cultivator.name,
            kind: 'enemy', standing: -0.8 }, h.world.currentDay));
        h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, h.source).whereIs.get(enemy.id)!);
        h.game.theWorldMoved();
        const before = h.repos.cultivators.getById(h.cultivator.id)!;
        await h.play(`I send my sword to ${h.destination.name}`);
        const waited = await h.play('I wait one day');
        expect(h.repos.cultivators.getById(h.cultivator.id)!.hp, JSON.stringify({ calls: waited.toolCalls,
            enemy: getNpc(h.world, enemy.id), proxy: h.proxy(), body: h.repos.cultivators.getById(h.cultivator.id) })).toBeLessThan(before.hp);
    }, 120_000);
});
