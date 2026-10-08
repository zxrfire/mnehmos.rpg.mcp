/**
 * Actual model rooms07 asked a member's name and where a new member takes work
 * in one greeting. Topic normalization clipped the input to forty characters;
 * fixing that alone still left askAround answering only its first self-fact.
 * The full questions must reach their existing authorities in order, with one
 * ordinary conversation cost and registration. Work direction names only the
 * actual public mission room, never a fictional posting, assignment or wage.
 *
 * The operator fixture arranges membership/standing beside an actual seeded
 * rank worker; admission and door entry are not under test. The played actor is
 * checked again at the persisted clock/area before the act. Scripted model prose
 * supplies no outcomes. Personal work and nonexistent facilities remain outside
 * the public-direction authority; other requested acts remain separate clauses.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider, refusedCall } from './harness';
import { ProviderNarrator } from '../../src/web/narrator';
import { whereCompoundsAre } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs';
import { aWorkDirectionQuestion } from '../../src/web/what-a-local-speaker-knows-of-the-mechanics';
import { informationQuestionsOf } from '../../src/web/one-information-exchange';
import { theClausesOf } from '../../src/web/a-sentence-can-be-more-than-one-call';

async function besideTheirMissionWorker() {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['They answer.'] });
    const h = await makeGameInWorld({ seed: 'one-mission-conversation', worldSeed: 'road-world',
        narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 }) });
    const { cultivator: me, run } = await h.game.newRun('Asker');
    const world = (await h.game.loadWorld())!;
    const compounds = whereCompoundsAre(world);
    let selected: { houseId: string; roomId: string; npcId: string; areaId: string; hour: number } | null = null;
    for (let hour = 0; hour < 24 && selected === null; hour++) {
        world.currentHour = hour;
        for (const compound of compounds.bySeat.values()) {
            const room = compound.rooms.get('mission_hall');
            if (!room || !h.repos.sects.getById(compound.houseId)) continue;
            const read = theAreasOf(world, room, compounds);
            const npc = world.npcs.find(person => person.status === 'alive'
                && person.factionId === compound.houseId
                && person.activity?.kind === 'the_work_of_their_rank'
                && read.whereIs.has(person.id)
                && read.areas.find(area => area.id === read.whereIs.get(person.id))?.for !== 'room');
            if (npc) {
                selected = { houseId: compound.houseId, roomId: room.id, npcId: npc.id,
                    areaId: read.whereIs.get(npc.id)!, hour };
                break;
            }
        }
    }
    expect(selected, 'an actual seeded mission-room rank worker at an ordinary hour').not.toBeNull();
    const room = world.locations.find(place => place.id === selected!.roomId)!;
    h.repos.sects.addMember(selected!.houseId, me.id, 0);
    h.repos.cultivators.update(me.id, { location: room.name });
    h.repos.cultivators.standIn(me.id, selected!.areaId);
    h.game.atHand = world;
    h.game.theWorldMoved();
    h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?')
        .run(Math.floor(run.elapsedDays) + selected!.hour / 24, run.id);
    const playedWorld = (await h.game.loadWorld())!;
    const visitor = h.repos.cultivators.getById(me.id)!;
    const speaker = h.game.present(visitor).find(person => person.id === selected!.npcId)!;
    expect(speaker, 'the same actual worker must remain beside the played body').toBeDefined();
    expect(speaker.sectId).toBe(selected!.houseId);
    expect(visitor.standingIn).toBe(selected!.areaId);
    expect(playedWorld.currentHour).toBe(selected!.hour);
    return { ...h, plans, provider, room, speaker, visitor };
}

describe('one conversation answers all its information questions', () => {
    it('gives an actual member name and public mission-room direction once, with one lesser cost and no accepted work', async () => {
        const h = await besideTheirMissionWorker();
        // The human supplied this real visible person's name. The resolver must
        // not treat the supplied word as a witnessed encounter or introduction.
        const input = `I greet ${h.speaker.name}. May I ask your name, and where a new member goes to take work?`;
        h.plans.push(JSON.stringify({ action: 'interact', intent: 'talk', target: h.speaker.name, topic: input }));
        const before = h.game.state();
        const answered = await h.game.act(input);
        expect(refusedCall(answered)).toBeNull();
        const questions = answered.toolCalls.filter(call => call.name === 'engine.askedAbout');
        expect(questions).toHaveLength(2);
        expect(questions[0]!.summary).toContain('their own name');
        expect(questions[1]!.summary).toContain('where a new member goes to take work');
        expect(questions[1]!.summary).toContain('Reach: answers');
        const shown = JSON.stringify(h.provider.calls.at(-1));
        expect(shown).toContain(`${h.speaker.name} gives their name`);
        expect(shown).toContain(`posts its work at ${h.room.name}`);
        const after = h.game.state();
        expect(after.run.elapsedDays - before.run.elapsedDays).toBeCloseTo(LESSER_ACTION_DAYS.interact);
        expect(after.run.turn - before.run.turn).toBe(1);
        expect(after.cultivator.location).toBe(before.cultivator.location);
        expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(answered.toolCalls.some(call => /acceptDuty|takeMission/.test(call.name))).toBe(false);
        expect(answered.toolCalls.filter(call => call.name === 'engine.step' && call.action === 'interact').length)
            .toBeLessThanOrEqual(1);
    }, 180_000);

    it('keeps personal/private work and an absent mission room outside the public direction read', async () => {
        const h = await besideTheirMissionWorker();
        const world = h.game.atHand!;
        expect(aWorkDirectionQuestion('where a new member goes to take work', h.speaker, world))
            .toMatchObject({ name: h.room.name });
        for (const topic of ['where do you work', 'where are your assignments', 'where is your private office']) {
            expect(aWorkDirectionQuestion(topic, h.speaker, world)).toBeNull();
        }
        expect(aWorkDirectionQuestion('where can I take work', { ...h.speaker, sectId: null }, world)).toBeNull();
        const noRoom = { ...world, locations: world.locations.filter(place => place.id !== h.room.id) };
        expect(aWorkDirectionQuestion('where can I take work', h.speaker, noRoom)).toBeNull();
    }, 180_000);

    it('leaves purchases, treatment and walking as separate decisions rather than information subreads', () => {
        const exchange = 'I greet the member. May I ask your name, and where a new member goes to take work?';
        for (const act of ['I buy medicine', 'treat me', 'I go to the mission hall']) {
            const input = `${exchange} and then ${act}`;
            expect(informationQuestionsOf(input)).toEqual([]);
            expect(theClausesOf(input)).toEqual([exchange, act]);
        }
    });
});
