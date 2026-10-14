/** Hall service previously reached the player only through one unfinished lamp
 * notice. Internal Affairs must actually decide the appointment, the player's
 * real body must reach its room, and small steady pay belongs to SQL membership.
 * A private contractor takes the real work and money; the member remains liable.
 * The fixture places the actual personnel holder at home, retaining the roll
 * and their office. Clock boundaries arrange service without a long-world walk. */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { routineTime } from '../../src/engine/world/npc-routines';
import { getOccupation, MORTAL_PHYSICIAN_JOB } from '../../src/data/cultivation/mortal-world';
import { parseIntent } from '../../src/web/actions';
import { createNpc, markDead, upsertRelationship } from '../../src/engine/world/npc-state';
import { personnelManager } from '../../src/engine/world/internal-affairs-puts-somebody-to-the-work';
import { purposeOf } from '../../src/engine/world/architecture';
import { hallServiceWorth, theHallStaff } from '../../src/engine/world/the-people-posted-to-a-houses-halls';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import type { DatabaseHandle } from '../../src/web/encounters';
import { HALL_SERVICE, postTag, pauseYourHallServiceForCare, resumeYourHallServiceAfterCare, requestHallService, theHallsYourDutiesCallYouTo } from '../../src/web/serving-in-your-houses-hall';
import { hireForYourDuty, leaveTheMissionPost, settleTheMissionPostTheyHold, theMissionPostTheyHold } from '../../src/web/holding-a-mission-post';

async function member(provider?: ScriptedProvider) {
    const h = await makeGameInWorld({ seed: 'real-hall-service', worldSeed: 'real-hall-service', provider });
    const { cultivator } = await h.game.newRun('Hall Member');
    const world = (await h.game.loadWorld())!;
    const house = world.factions.find(row => row.id === 'sect-azure-cloud-pavilion')!;
    const seat = world.locations.find(room => room.id === house.seatLocationId)!;
    h.repos.sects.addMember(house.id, cultivator.id, 1);
    h.repos.cultivators.update(cultivator.id, { location: seat.name, realmOrdinal: 21 });
    let manager = personnelManager(world, house.id)!;
    const reception = theAreasOf(world, seat).areas.find(area => area.for === 'board')!;
    manager = upsertRelationship({ ...manager, locationId: seat.id, activity: { kind: 'stationed',
        note: 'Receiving members for personnel appointments.', withIds: [], sinceDay: world.currentDay, untilDay: null,
        standingIn: reception.id } },
        { targetId: cultivator.id, targetName: cultivator.name, kind: 'ally', standing: 1 }, world.currentDay);
    world.npcs[world.npcs.findIndex(person => person.id === manager.id)] = manager;
    h.repos.cultivators.standIn(cultivator.id, reception.id);
    h.game.atHand = world;
    h.game.theWorldMoved();
    return { ...h, get world() { return h.game.atHand!; }, house, seat, manager, id: cultivator.id,
        person: () => h.repos.cultivators.getById(cultivator.id)!,
        word: () => theMissionPostTheyHold(h.game, cultivator.id)!,
        credit: () => h.repos.sects.getMembership(cultivator.id)!.contribution };
}

function clock(h: Awaited<ReturnType<typeof member>>, day: number) {
    const run = h.game.currentRun().run;
    const difference = day - run.elapsedDays;
    h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(day, run.id);
    h.world.currentDay += difference;
}

it('routes explicit requests without putting personnel work on the board', () => {
    for (const name of ['Internal Affairs Hall duty', 'Scripture Pavilion service', 'chore rota']) {
        expect(parseIntent(`I take ${name}`)).toMatchObject({ action: 'sect', intent: 'duty', target: name });
    }
});

it('takes the real post before service starts, then pays SQL membership once as it is served', async () => {
    const h = await member();
    const original = h.credit();
    const accepted = await h.game.act('I take Internal Affairs Hall duty');
    expect(accepted.narration, JSON.stringify({ reviews: h.game.atHand!.history.facts.filter(f => f.data.housePersonnelReview && f.factionIds.includes(h.house.id)).slice(-2).map(f => f.data), manager: h.game.atHand!.npcs.find(p => p.id === h.manager.id)?.activity, player: h.game.atHand!.npcs.find(p => p.id === h.id)?.activity, day: h.game.atHand!.currentDay, hour: h.game.atHand!.currentHour, run: h.game.currentRun().run.elapsedDays })).toContain('Internal Affairs appoints you');
    expect(h.game.worldPlaceOf(h.person())).toBe(h.seat.id);
    expect(h.credit()).toBe(original);
    const word = h.word();
    expect(word.tags).toContain(HALL_SERVICE);
    const room = h.world.locations.find(row => row.id === postTag(word, 'post-at:'))!;
    expect(purposeOf(room)).toBe('life_lamp_hall');
    expect(word.triggeringEventId).toBeTruthy();
    const reached = await h.game.act(`I travel to ${room.name}`);
    expect(h.game.worldPlaceOf(h.person()), reached.narration).toBe(room.id);
    const serving = h.word();
    expect(postTag(serving, 'post-served-since:')).not.toBeNull();
    const start = Number(postTag(serving, 'post-served-since:'));
    clock(h, start + 15);
    settleTheMissionPostTheyHold(h.game, h.person());
    expect(h.credit() - original).toBe(hallServiceWorth(21, 15));
    settleTheMissionPostTheyHold(h.game, h.person());
    expect(h.credit() - original).toBe(hallServiceWorth(21, 15));
    clock(h, serving.dueOnDay!);
    settleTheMissionPostTheyHold(h.game, h.person());
    expect(h.credit() - original).toBe(hallServiceWorth(21, 30));
    expect(h.word()).toBeNull();
});

it('gives the player the actual alternating rota at its smaller paid rate', async () => {
    const h = await member();
    const accepted = await h.game.act('I take chore rota');
    expect(accepted.narration, JSON.stringify({ reviews: h.game.atHand!.history.facts.filter(f => f.data.housePersonnelReview && f.factionIds.includes(h.house.id)).slice(-2).map(f => f.data), manager: h.game.atHand!.npcs.find(p => p.id === h.manager.id)?.activity, player: h.game.atHand!.npcs.find(p => p.id === h.id)?.activity, day: h.game.atHand!.currentDay, hour: h.game.atHand!.currentHour, run: h.game.currentRun().run.elapsedDays })).toContain('Internal Affairs appoints you');
    const word = h.word();
    expect(JSON.parse(postTag(word, 'post-calendar:')!)).toMatchObject({ periodDays: 2, rota: true });
    const room = h.world.locations.find(row => row.id === postTag(word, 'post-at:'))!;
    h.repos.cultivators.update(h.id, { location: room.name });
    settleTheMissionPostTheyHold(h.game, h.person());
    const started = h.word();
    const before = h.credit();
    clock(h, started.dueOnDay!);
    settleTheMissionPostTheyHold(h.game, h.person());
    expect(h.credit() - before).toBe(hallServiceWorth(21, 30, true));
    expect(h.credit() - before).toBeGreaterThan(0);
    expect(h.credit() - before).toBeLessThan(hallServiceWorth(21, 30));
});

it('can privately pay a real contractor at the hall, without double contribution or moving the member', async () => {
    const h = await member();
    const accepted = await h.game.act('I take Internal Affairs Hall duty');
    expect(accepted.narration, JSON.stringify({ reviews: h.game.atHand!.history.facts.filter(f => f.data.housePersonnelReview && f.factionIds.includes(h.house.id)).slice(-2).map(f => f.data), manager: h.game.atHand!.npcs.find(p => p.id === h.manager.id)?.activity, player: h.game.atHand!.npcs.find(p => p.id === h.id)?.activity, day: h.game.atHand!.currentDay, hour: h.game.atHand!.currentHour, run: h.game.currentRun().run.elapsedDays })).toContain('Internal Affairs appoints you');
    const room = h.world.locations.find(row => row.id === postTag(h.word(), 'post-at:'))!;
    h.repos.cultivators.update(h.id, { location: room.name });
    settleTheMissionPostTheyHold(h.game, h.person());
    const worker = createNpc(h.world.seed, { id: 'hall-contractor', name: 'Available Worker',
        locationId: room.id, bornOnDay: h.world.currentDay - 20 * 365, onDay: h.world.currentDay });
    worker.activity = { kind: 'idle', note: 'Waiting here.', withIds: [], sinceDay: h.world.currentDay, untilDay: h.world.currentDay + 30 };
    h.world.npcs.push(worker);
    h.game.knowledge.learnIfNew({ holderId: h.id, kind: 'cultivator', id: worker.id, name: worker.name,
        onDay: h.game.currentRun().run.elapsedDays, sourceKind: 'witnessed', stage: 'encountered' });
    h.repos.cultivators.standIn(h.id, theAreasOf(h.world, room).whereIs.get(worker.id)!);
    h.repos.cultivators.applyDeltas(h.id, { spiritStones: 10_000 });
    const money = h.person().spiritStones;
    const credit = h.credit();
    const hireDay = routineTime(h.world);
    const remaining = h.word().dueOnDay! - h.game.currentRun().run.elapsedDays;
    const hire = hireForYourDuty(h.game, h.game.currentRun().run, h.person(), worker.name);
    expect(hire.outcome).toBe('executed');
    expect(h.person().spiritStones).toBeLessThan(money);
    const contract = h.world.obligations.find(word => word.tags.includes('hired-duty'))!;
    const contractor = h.world.npcs.find(person => person.id === worker.id)!;
    expect(contract.incurredOnDay).toBe(hireDay);
    expect(contract.dueOnDay! - contract.incurredOnDay).toBeCloseTo(remaining);
    expect(contractor.spiritStones! - (worker.spiritStones ?? 0)).toBe(money - h.person().spiritStones);
    expect(contractor.activity?.houseWorkSchedule).toMatchObject({ shift: 'day', rota: false });
    expect(theHallStaff(h.world, h.house.id, Math.floor(h.world.currentDay) + 1 + 10 / 24).some(post => post.personId === worker.id)).toBe(true);
    expect(h.world.npcs.find(person => person.id === h.id)?.activity).toBeNull();
    expect(theHallsYourDutiesCallYouTo(h.game, h.person()).has(room.id)).toBe(true);
    const next = requestHallService(h.game, h.game.currentRun().run, h.person(), 'Scripture Pavilion duty')!;
    expect(next.facts.lines.join(' ')).toContain('not here');
    expect(next.facts.lines.join(' ')).not.toContain('existing post');
    h.repos.cultivators.update(h.id, { location: h.seat.name });
    clock(h, h.word().dueOnDay!);
    settleTheMissionPostTheyHold(h.game, h.person());
    expect(h.credit() - credit).toBe(hallServiceWorth(21, 30));
    expect(h.world.obligations.find(word => word.id === contract.id)?.settlement?.resolution).toBe('oath_fulfilled');
    expect(ledgerAbout(h.db as unknown as DatabaseHandle, h.id).find(word => word.id === contract.id)?.status).not.toBe('open');
});

it('cannot appoint itself when nobody responsible is available', async () => {
    const h = await member();
    h.world.npcs.find(person => person.id === h.manager.id)!.activity = { kind: 'travelling', note: 'Away on business.', withIds: [], sinceDay: h.world.currentDay,
        untilDay: h.world.currentDay + 30 };
    const answer = await h.game.act('I take Internal Affairs Hall duty');
    expect(answer.narration).toContain('not here to hear your request');
    expect(h.word()).toBeNull();
    expect(h.credit()).toBe(0);
});


it('reports the physical roll check once on the day the player serves it', async () => {
    const h = await member();
    const accepted = await h.game.act('I take Internal Affairs Hall duty');
    expect(accepted.narration).toContain('Internal Affairs appoints you');
    const room = h.world.locations.find(row => row.id === postTag(h.word(), 'post-at:'))!;
    h.repos.cultivators.update(h.id, { location: room.name });
    settleTheMissionPostTheyHold(h.game, h.person());
    const departed = createNpc(h.world.seed, { id: 'missing-lamp-member', name: 'A Departed Disciple',
        locationId: room.id, bornOnDay: h.world.currentDay - 20 * 365, onDay: h.world.currentDay });
    departed.factionId = h.house.id; departed.factionRankIndex = 1;
    h.world.npcs.push(markDead(departed, h.world.currentDay, 'Died before this roll check.'));
    const first = settleTheMissionPostTheyHold(h.game, h.person())!;
    expect(first.lines.some(line => line.includes(departed.name) && line.includes('lamp is absent'))).toBe(true);
    const second = settleTheMissionPostTheyHold(h.game, h.person())!;
    expect(second.lines.some(line => line.includes(departed.name))).toBe(false);
    expect(h.world.history.facts.filter(fact => fact.data.lampRollCheck && fact.actors.some(actor => actor.id === h.id))).toHaveLength(1);
});

it('settles the earned small wage before the player explicitly leaves the post', async () => {
    const h = await member();
    expect((await h.game.act('I take chore rota')).narration).toContain('Internal Affairs appoints you');
    const room = h.world.locations.find(row => row.id === postTag(h.word(), 'post-at:'))!;
    h.repos.cultivators.update(h.id, { location: room.name });
    settleTheMissionPostTheyHold(h.game, h.person());
    const word = h.word();
    const before = h.credit();
    clock(h, Number(postTag(word, 'post-served-since:')) + 15);
    leaveTheMissionPost(h.game, h.game.currentRun().run, h.person());
    expect(h.credit() - before).toBe(hallServiceWorth(21, 15, true));
    expect(h.word()).toBeNull();
    expect(h.world.npcs.find(person => person.id === h.id)?.activity).toBeNull();
});


it('suspends actual hall work and pay during the days spent under clinical care', async () => {
    const h = await member();
    expect((await h.game.act('I take chore rota')).narration).toContain('Internal Affairs appoints you');
    const room = h.world.locations.find(row => row.id === postTag(h.word(), 'post-at:'))!;
    h.repos.cultivators.update(h.id, { location: room.name });
    settleTheMissionPostTheyHold(h.game, h.person());
    const due = h.word().dueOnDay!;
    const since = Number(postTag(h.word(), 'post-served-since:'));
    const before = h.credit();
    clock(h, since + 10);
    settleTheMissionPostTheyHold(h.game, h.person());
    const earned = h.credit();
    const paused = pauseYourHallServiceForCare(h.game, h.person());
    expect(paused).not.toBeNull();
    expect(theHallStaff(h.world, h.house.id, h.world.currentDay).some(post => post.personId === h.id)).toBe(false);
    clock(h, since + 40);
    settleTheMissionPostTheyHold(h.game, h.person());
    expect(h.credit()).toBe(earned);
    resumeYourHallServiceAfterCare(h.game, h.person(), paused);
    expect(h.word().dueOnDay).toBe(due + 30);
    clock(h, h.word().dueOnDay!);
    settleTheMissionPostTheyHold(h.game, h.person());
    expect(h.credit() - before).toBe(hallServiceWorth(21, 30, true));
});


it('the actual physician course pauses the hall wage and uses its actual thirty days', async () => {
    const h = await member();
    expect((await h.game.act('I take Internal Affairs Hall duty')).narration).toContain('Internal Affairs appoints you');
    const room = h.world.locations.find(row => row.id === postTag(h.word(), 'post-at:'))!;
    h.repos.cultivators.update(h.id, { location: room.name });
    settleTheMissionPostTheyHold(h.game, h.person());
    const physician = createNpc(h.world.seed, { id: 'visiting-hall-physician', name: 'Visiting Physician',
        bornOnDay: h.world.currentDay - 30 * 365, onDay: h.world.currentDay, locationId: room.id,
        occupation: getOccupation(MORTAL_PHYSICIAN_JOB)!.name, cultivation: { realmOrdinal: 0 } });
    physician.activity = { kind: 'the_work_of_their_rank', note: 'Seeing to patients.', withIds: [],
        sinceDay: h.world.currentDay, untilDay: h.world.currentDay + 31 };
    h.world.npcs.push(physician);
    h.repos.cultivators.standIn(h.id, theAreasOf(h.world, room).whereIs.get(physician.id)!);
    h.repos.cultivators.update(h.id, { hp: 1, spiritStones: 100_000 });
    h.game.theWorldMoved();
    const due = h.word().dueOnDay!;
    const before = h.credit();
    const turn = await h.game.act('I get my injuries treated');
    expect(turn.toolCalls.some(call => call.name === 'engine.mortalCare' && call.ok), turn.narration).toBe(true);
    expect(h.credit()).toBe(before);
    expect(h.word().dueOnDay).toBeCloseTo(due + 30);
    expect(Number(postTag(h.word(), 'post-paused-days:'))).toBeCloseTo(30);
    expect(h.world.npcs.find(person => person.id === h.id)?.activity?.kind).toBe('stationed');
});


it('ends the actual hall appointment when the member leaves the roll', async () => {
    const h = await member();
    expect((await h.game.act('I take chore rota')).narration).toContain('Internal Affairs appoints you');
    const room = h.world.locations.find(row => row.id === postTag(h.word(), 'post-at:'))!;
    h.repos.cultivators.update(h.id, { location: room.name });
    settleTheMissionPostTheyHold(h.game, h.person());
    h.repos.sects.removeMember(h.house.id, h.id);
    const ended = settleTheMissionPostTheyHold(h.game, h.person())!;
    expect(ended.lines.join(' ')).toContain('appointment has ended');
    expect(h.word()).toBeNull();
    expect(h.world.npcs.find(person => person.id === h.id)?.activity).toBeNull();
});


it('quotes a nonzero contribution even for a short agreed term and pays only after service', async () => {
    const h = await member();
    const before = h.credit();
    requestHallService(h.game, h.game.currentRun().run, h.person(), 'chore rota', 1);
    expect(postTag(h.word(), 'post-pays:')).toBe('1:0');
    expect(h.credit()).toBe(before);
    const room = h.world.locations.find(row => row.id === postTag(h.word(), 'post-at:'))!;
    h.repos.cultivators.update(h.id, { location: room.name });
    settleTheMissionPostTheyHold(h.game, h.person());
    clock(h, h.word().dueOnDay!);
    settleTheMissionPostTheyHold(h.game, h.person());
    expect(h.credit() - before).toBe(1);
});


it('executes the model-shaped house personnel request through the same actual nomination', async () => {
    const h = await member(new ScriptedProvider({ plans: [JSON.stringify({ lane: 'house', intent: 'duties',
        target: 'Internal Affairs Hall', days: 30 })], narrations: ['Debug prose, not model-quality acceptance.'] }));
    const turn = await h.game.act('I ask Internal Affairs for a hall posting.');
    expect(turn.toolCalls.find(call => call.name === 'narrator.plan')?.source, JSON.stringify(turn.toolCalls.filter(call => call.name.startsWith('narrator.')))).toBe('model');
    expect(h.word()?.tags).toContain(HALL_SERVICE);
    expect(h.word().triggeringEventId).toBeTruthy();
    expect(h.game.worldPlaceOf(h.person())).toBe(h.seat.id);
    expect(h.credit()).toBe(0);
});


it('cannot ask an absent personnel holder through the compound walls', async () => {
    const h = await member();
    const room = h.world.locations.find(place => place.data.factionId === h.house.id && purposeOf(place) === 'life_lamp_hall')!;
    h.repos.cultivators.update(h.id, { location: room.name });
    h.repos.cultivators.standIn(h.id, null);
    const before = h.world.history.facts.filter(fact => fact.data.housePersonnelReview).length;
    const refused = requestHallService(h.game, h.game.currentRun().run, h.person(), 'Internal Affairs Hall duty')!;
    expect(refused.facts.lines.join(' ')).toContain('not here');
    expect(h.word()).toBeNull();
    expect(h.world.history.facts.filter(fact => fact.data.housePersonnelReview).length).toBe(before);
});
