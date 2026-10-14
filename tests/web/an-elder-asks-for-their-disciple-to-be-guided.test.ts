/**
 * A favour for a pupil must reach a real teacher and start that pupil's actual
 * teaching activity, while the asker's body stays free. The fixture asks the
 * common decision path which ordinary available acquaintance agrees; it does
 * not override the answer or change a seed after a refusal. All candidate people
 * remain in the world. Actual engine consent is replayed on the played request.
 * Both world and run are pinned. Scripted plans test routing, not prose quality.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { createNpc, setRealm, upsertRelationship } from '../../src/engine/world/npc-state';
import { purposeOf } from '../../src/engine/world/architecture';
import { routineTime } from '../../src/engine/world/npc-routines';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { standInTheWorld } from '../../src/web/the-player-as-a-row-the-world-can-invite';
import { askSomebodyForHelp } from '../../src/engine/world/somebody-calls-on-another-for-help';
import { guidanceFor } from '../../src/engine/world/an-npc-striking-at-the-next-wall';
import { faceOf } from '../../src/engine/world/what-a-face-is-worth';
import { openLedgerBetween } from '../../src/web/encounters';
import { parseIntent } from '../../src/web/actions';

async function arranged(provider?: ScriptedProvider, days = 30) {
    const h = await makeGameInWorld({ seed: 'a-pupils-actual-lesson', worldSeed: 'a-pupils-actual-lesson', provider });
    const { cultivator } = await h.game.newRun('Master Shen');
    const world = (await h.game.loadWorld())!;
    const house = world.factions.find(row => row.id === 'sect-azure-cloud-pavilion')!;
    const room = world.locations.find(row => row.data.factionId === house.id && purposeOf(row) === 'lecture_hall')!;
    h.repos.sects.addMember(house.id, cultivator.id, 1);
    h.repos.cultivators.update(cultivator.id, { location: room.name, realmOrdinal: 21 });
    const sheet = h.repos.cultivators.getById(cultivator.id)!;
    const day = routineTime(world);
    const area = theAreasOf(world, room).areas[0]!.id;
    h.repos.cultivators.standIn(cultivator.id, area);
    let pupil = setRealm(createNpc(world.seed, { id: 'a-real-pupil', factionId: house.id,
        factionRankIndex: 1, locationId: room.id, bornOnDay: world.currentDay - 20 * 365, onDay: world.currentDay }), 16, world.currentDay);
    pupil = upsertRelationship(pupil, { targetId: cultivator.id, targetName: cultivator.name, kind: 'master', standing: .8,
        note: 'A personal disciple.' }, world.currentDay);
    pupil.activity = { kind: 'talking', note: 'Waiting to discuss a lesson.', withIds: [], sinceDay: day, untilDay: day + 1, standingIn: area };
    world.npcs.push(pupil);
    const actor = standInTheWorld(world, sheet, { factionId: house.id, rankIndex: 1, contribution: 0 }, day)!;
    let teacher = null as typeof pupil | null;
    for (let i = 0; i < 16; i++) {
        let candidate = setRealm(createNpc(world.seed, { id: `a-real-guidance-teacher-${i}`, factionId: house.id,
            factionRankIndex: 2, locationId: house.seatLocationId, bornOnDay: world.currentDay - 30 * 365, onDay: world.currentDay }), 25, world.currentDay);
        candidate = upsertRelationship(candidate, { targetId: cultivator.id, targetName: cultivator.name, kind: 'ally', standing: .8 }, day);
        world.npcs.push(candidate);
        const preview = structuredClone(world);
        const proposed = preview.npcs.find(person => person.id === candidate.id)!;
        proposed.locationId = room.id;
        proposed.activity = { kind: 'talking', note: 'Discussing cultivation.', withIds: [pupil.id], sinceDay: day, untilDay: day + 1, standingIn: area };
        const proposal = askSomebodyForHelp(preview, { askerId: cultivator.id, beneficiaryId: pupil.id, day,
            work: `guide cultivation for ${days} days`, player: { person: actor, placeId: room.id, present: new Set([candidate.id, pupil.id]), ledger: preview.obligations, rememberFavour: () => {} },
            ability: person => person.id === candidate.id ? 2 : 0, perform: () => true });
        if (!proposal) continue;
        teacher = candidate;
        candidate.locationId = room.id;
        candidate.activity = proposed.activity;
        pupil.activity.withIds = [candidate.id];
        break;
    }
    expect(teacher, 'No actual ordinary acquaintance agreed to the lesson.').toBeTruthy();
    h.game.atHand = world; h.game.theWorldMoved();
    const seen = h.game.present(h.repos.cultivators.getById(cultivator.id)!);
    expect(seen.some(person => person.id === teacher!.id), JSON.stringify({ teacher: teacher!.id, seen: seen.map(person => person.id), area, room: room.id })).toBe(true);
    expect(seen.some(person => person.id === pupil.id)).toBe(true);
    return { ...h, id: cultivator.id, room, pupil, teacher: teacher!, day,
        get world() { return h.game.atHand!; }, person: () => h.repos.cultivators.getById(cultivator.id)! };
}

it('starts the named pupils real lesson while the askers SQL body remains free', async () => {
    const h = await arranged();
    const before = h.game.currentRun().run.elapsedDays;
    const oldFace = faceOf(h.world.npcs.find(person => person.id === h.id)!);
    const phrase = `I ask ${h.teacher.name} to guide my disciple ${h.pupil.name} for 30 days`;
    expect(parseIntent(phrase)).toMatchObject({ action: 'request', intent: 'guidance_for_another', topic: h.pupil.name, days: 30 });
    const turn = await h.game.act(phrase);
    expect(turn.narration).toContain(`agreed to guide ${h.pupil.name}`);
    const teacher = h.world.npcs.find(person => person.id === h.teacher.id)!;
    expect(teacher.activity?.kind).toBe('teaching');
    expect(teacher.activity?.withIds).toContain(h.pupil.id);
    expect(teacher.activity?.withIds).not.toContain(h.id);
    const favour = openLedgerBetween(h.repos, h.id, teacher.id).find(word => word.kind === 'favor'
        && word.holderId === teacher.id && word.subjectId === h.id && word.tags.includes(`beneficiary:${h.pupil.id}`))!;
    expect(favour).toBeTruthy();
    expect(favour.incurredOnDay).toBeCloseTo(before);
    expect(h.world.obligations.some(word => word.id === favour.id)).toBe(false);
    expect(faceOf(h.world.npcs.find(person => person.id === h.id)!)).toBeLessThan(oldFace);
    expect(guidanceFor(h.world.npcs.find(person => person.id === h.pupil.id)!, new Map(h.world.npcs.map(person => [person.id, person])), routineTime(h.world))?.ordinal).toBe(teacher.cultivation.realmOrdinal);
    expect(h.game.currentRun().run.elapsedDays - before).toBeLessThan(30);
    expect(h.game.worldPlaceOf(h.person())).toBe(h.room.id);
    expect(h.world.npcs.find(person => person.id === h.id)?.locationId).toBeNull();
});

it('routes a model-shaped request to the same NPC consent and actual pupil', async () => {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['Debug prose, not model-quality acceptance.'] });
    const h = await arranged(provider);
    plans.push(JSON.stringify({ lane: 'speak', intent: 'ask_them_to_give_or_do_something', target: h.teacher.name,
        topic: h.pupil.name, days: 30 }));
    const turn = await h.game.act(`I ask ${h.teacher.name} to guide my disciple ${h.pupil.name} for 30 days`);
    expect(turn.toolCalls.find(call => call.name === 'narrator.plan')?.source).toBe('model');
    expect(h.world.npcs.find(person => person.id === h.teacher.id)?.activity?.withIds).toContain(h.pupil.id);
    expect(h.game.worldPlaceOf(h.person())).toBe(h.room.id);
});

it('retains the actual fractional start and full requested span on a real teacher', async () => {
    const h = await arranged(undefined, .25);
    h.world.currentHour = 18;
    const since = routineTime(h.world);
    const course = h.game.theyGiveTheirAttention(h.teacher.id, [h.pupil.id], .25, 'Giving a lesson.', h.room.id)!;
    expect(course.sinceDay).toBe(since);
    expect(course.untilDay - course.sinceDay).toBeCloseTo(.25);
});

it('does not move an absent pupil into an agreed lesson', async () => {
    const h = await arranged();
    const pupil = h.world.npcs.find(person => person.id === h.pupil.id)!;
    pupil.locationId = h.world.factions.find(row => row.id === pupil.factionId)!.seatLocationId;
    pupil.activity = null;
    const turn = await h.game.act(`I ask ${h.teacher.name} to guide my disciple ${h.pupil.name} for 30 days`);
    expect(turn.narration).toContain('not here to receive guidance');
    expect(h.world.npcs.find(person => person.id === h.teacher.id)?.activity?.kind).not.toBe('teaching');
    expect(h.world.obligations.some(word => word.tags.includes(`beneficiary:${h.pupil.id}`))).toBe(false);
});
