/**
 * Ordinary invitations previously wrote a season-long road term; local rooms
 * had no way to end a visit. Played requests now interrupt an activity until
 * night, dismissal or the host leaving the room, and then resume its routine.
 * Expiry applies to active people; it cannot move a body away from its death.
 * A scripted phase-one plan exercises the same company request as a model.
 *
 * After the native fractional clock was wired, the original six controls gave
 * three failures: the return was still walking at night, booking after inviting
 * spent the remaining daylight, and currentDay included the hour fraction.
 * These fixtures now wait for the actual return deadline, book two paid nights
 * before the next morning's visit, and compare the canonical clock. None of
 * those changes lengthens an invitation or makes a journey instantaneous.
 * Later counter staffing requires a real keeper: the private visit starts at
 * an actual staffed inn, rather than demanding an inn in the birth place.
 * The sister's area is reread after arranging the fixture, and the model plan
 * addresses that known, present sister instead of an ambiguous pronoun.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { parseIntent } from '../../src/web/actions';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { worldLocationFor } from '../../src/web/entities';
import { routineOf, routineTime } from '../../src/engine/world/npc-routines';
import { invitationsDue } from '../../src/web/routine-invitations';
import { whereTheyAreStanding, whereCompoundsAre } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { peopleInThisPlace } from '../../src/web/hearsay';
import { anInnIsKeptHere } from '../../src/web/a-room-at-an-inn';
import { theCounterWorkersHere } from '../../src/web/who-keeps-a-counter-here';

async function arrange(visit = false, sect = false, dismiss = false) {
    const script = { plans: [...(visit ? [
        JSON.stringify({ action: 'buy', target: 'a room at the inn', days: 2 }),
        JSON.stringify({ action: 'wait' })
    ] : []), JSON.stringify({ action: 'request', intent: 'company', target: 'her',
        ...(visit ? { topic: 'my room' } : {}) }), ...(dismiss ? [JSON.stringify({action:'request', intent:'end_company',target:'her'})] : [...(sect || visit ? [] : [JSON.stringify({ action: 'buy', target: 'a room at the inn' })]),
        JSON.stringify({ action: 'move', target: 'my room' }), ...(visit ? [JSON.stringify({ action: 'look', intent: 'around' }),
        JSON.stringify({ action: 'move', target: 'the street' })] : [JSON.stringify({ action: 'wait' }),
        ...(sect ? [JSON.stringify({ action: 'wait' })] : [])])])], narrations: ['The opening.', 'The answer.'] };
    const provider = new ScriptedProvider(script);
    const harness = await makeGameInWorld({ seed: 'routine-visit', worldSeed: 'road-world', provider });
    const { game, repos } = harness;
    const { cultivator } = await game.newRun('Visitor');
    if (visit) {
        const initialWorld = (await game.loadWorld())!;
        const staffed = initialWorld.locations.filter(place=>place.kind==='settlement').map(place=>{
            const read=theAreasOf(initialWorld,place), inn=read.areas.find(area=>area.for==='table');
            if(!inn || !anInnIsKeptHere({...cultivator,location:place.name}))return null;
            const keeper=theCounterWorkersHere(game,{...cultivator,location:place.name,standingIn:inn.id}).get('inn');
            const female=initialWorld.npcs.some(n=>n.status==='alive' && n.identity.sex==='female' && read.whereIs.has(n.id));
            return keeper && female ? {place,inn} : null;
        }).find(row=>row!==null);
        expect(staffed,'The private visit needs an actual staffed inn and local sister.').toBeDefined();
        repos.cultivators.update(cultivator.id,{location:staffed!.place.name});
        repos.cultivators.standIn(cultivator.id,staffed!.inn.id);
        const booking = await game.act('I take a room at the inn for two nights');
        expect(booking.toolCalls.some(c => c.name === 'engine.takeARoom' && c.ok),JSON.stringify({
            said:booking.narration,calls:booking.toolCalls,body:game.currentRun().cultivator
        })).toBe(true);
        await game.act('I wait until morning');
    }
    const world = (await game.loadWorld())!;
    let place = worldLocationFor(world, game.currentRun().cultivator.location)!;
    let read = theAreasOf(world, place);
    const sister = sect ? world.npcs.find(n => n.identity.sex === 'female' && n.status === 'alive' && n.factionId !== null && n.factionRankIndex === 1
        && n.locationId !== null && whereCompoundsAre(world).bySeat.has(n.locationId)
        && routineOf({ ...world, currentHour: 22 }, n).home)!
        : world.npcs.find(n => n.identity.sex === 'female' && read.whereIs.has(n.id))!;
    if (sect) {
        repos.sects.addMember(sister.factionId!, cultivator.id, 0);
        place = world.locations.find(l => l.id === whereTheyAreStanding(world, whereCompoundsAre(world), sister, new Set(world.npcs.map(n => n.id))))!;
        repos.cultivators.update(cultivator.id, { location: place.name, realmOrdinal: sister.cultivation.realmOrdinal });
        read = theAreasOf(world, place);
    }
    expect(sister).toBeDefined();
    repos.cultivators.standIn(cultivator.id, read.whereIs.get(sister.id)!);
    game.knowledge.learnIfNew({ holderId: cultivator.id, kind: 'cultivator', id: sister.id, name: sister.name,
        onDay: 0, stage: 'encountered', sourceKind: 'witnessed' });
    // Leave the addressed woman alone in this area's fixture.
    for (const row of world.npcs.filter(n => n.id !== sister.id && read.whereIs.get(n.id) === read.whereIs.get(sister.id))) {
        row.locationId = null;
    }
    game.theWorldMoved();
    const arranged = peopleInThisPlace(repos,game.currentRun().cultivator,world,place);
    expect(arranged.whereIs.has(sister.id),'The sister left the arranged place.').toBe(true);
    repos.cultivators.standIn(cultivator.id,arranged.whereIs.get(sister.id)!);
    expect(game.present(game.currentRun().cultivator).map(row=>row.id),'The addressed sister must actually be present.').toContain(sister.id);
    script.plans[visit ? 2 : 0] = JSON.stringify({action:'request',intent:'company',target:sister.name,
        ...(visit ? {topic:'my room'} : {})});
    return { ...harness, sister, place };
}

describe('routines and invitations in play', () => {
    it('routes follow, joining the party, private visits and dismissal through existing requests', () => {
        expect(parseIntent('Follow me')).toMatchObject({ action: 'request', intent: 'company' });
        expect(parseIntent('Join my party')).toMatchObject({ action: 'request', intent: 'company' });
        expect(parseIntent('I invite her to my room')).toMatchObject({ action: 'request', intent: 'company' });
        expect(parseIntent('I ask her to come see this artifact in my room')).toMatchObject({ action: 'request', intent: 'company' });
        expect(parseIntent('I dismiss her from my party')).toMatchObject({ action: 'request', intent: 'end_company' });
    });

    it('an invited senior sister follows and returns to her own quarters at night', async () => {
        const { game, repos, sister } = await arrange(false, true);
        const ask = await withTheAttemptLanding('request', () => game.act('I ask her to come with me'));
        expect(ask.result.toolCalls.some(c => c.name === 'world.takeThemWithYou' && c.ok)).toBe(true);
        const me = repos.cultivators.getById(game.state().cultivator.id)!;
        expect(game.whoIsWithYouOnTheRoad(me).map(n => n.id)).toContain(sister.id);
        const seat = game.atHand!.locations.find(l => l.kind === 'sect_seat' && l.data.factionId === sister.factionId)!;
        repos.cultivators.update(me.id, { location: seat.name });
        game.theyArrivedWithYou(repos.cultivators.getById(me.id)!, seat.name);
        const entered = await game.act('I go to my room');
        expect(game.present(repos.cultivators.getById(me.id)!).map(n => n.id), JSON.stringify({
            said:entered.narration, calls:entered.toolCalls, body:repos.cultivators.getById(me.id),
            sister:game.atHand!.npcs.find(n=>n.id===sister.id), hour:game.atHand!.currentHour
        })).toContain(sister.id);
        await game.act('I wait until night');
        expect(game.whoIsWithYouOnTheRoad(repos.cultivators.getById(me.id)!)).toHaveLength(0);
        expect((await game.loadWorld())?.currentHour).toBeCloseTo(21);
        const returning = game.atHand!.npcs.find(n => n.id === sister.id)!;
        if (returning.activity?.kind === 'travelling') {
            expect(returning.activity.untilDay).not.toBeNull();
            const hours = (returning.activity.untilDay! - routineTime(game.atHand!)) * 24;
            expect(hours).toBeGreaterThan(0);
            await game.act(`I wait for ${hours} hours`);
        }
        const npc = game.atHand!.npcs.find(n => n.id === sister.id)!;
        const home = whereTheyAreStanding(game.atHand!, whereCompoundsAre(game.atHand!), npc, new Set(game.atHand!.npcs.map(n => n.id)))!;
        const quarters = game.atHand!.locations.find(l => l.id === home)!;
        expect(['dormitory', 'residence']).toContain(quarters.data.purpose);
        expect(theAreasOf(game.atHand!, quarters).whereIs.get(sister.id)).toContain('#room#');
    }, 180_000);

    it('dismissal ends the actual invitation addressed by a pronoun', async () => {
        const { game, sister } = await arrange(false, false, true);
        await withTheAttemptLanding('request', () => game.act('I ask her to come with me'));
        expect(game.whoIsWithYouOnTheRoad(game.state().cultivator).map(n => n.id)).toContain(sister.id);
        await game.act('I dismiss her from my party');
        expect(game.whoIsWithYouOnTheRoad(game.state().cultivator)).toHaveLength(0);
        expect(game.atHand!.npcs.find(n => n.id === sister.id)!.activity?.redirect).toBeUndefined();
    }, 180_000);

    it('an expired invitation cannot send a dead companion home', async () => {
        const { game, sister } = await arrange();
        await withTheAttemptLanding('request', () => game.act('I ask her to come with me'));
        const world = game.atHand!;
        const npc = world.npcs.find(n => n.id === sister.id)!;
        expect(npc.activity?.redirect).toBeDefined();
        const invitation = structuredClone(npc.activity);
        const elsewhere = world.locations.find(place => place.kind === 'settlement'
            && place.id !== npc.locationId && place.id !== npc.activity?.returnTo)!;
        npc.locationId = elsewhere.id;
        world.currentDay += 2;
        world.currentHour = 22;
        // This fixture must actually return a living companion at this hour.
        invitationsDue(game, game.state().cultivator);
        expect(npc.locationId !== elsewhere.id || npc.activity?.kind === 'travelling').toBe(true);
        npc.locationId = elsewhere.id;
        npc.activity = invitation;
        npc.status = 'physically_dead';
        invitationsDue(game, game.state().cultivator);
        expect(npc.locationId).toBe(elsewhere.id);
        expect(npc.activity?.kind).not.toBe('travelling');
        expect(game.whoIsWithYouOnTheRoad(game.state().cultivator).map(n => n.id)).not.toContain(npc.id);
    }, 180_000);

    it('the street changes at three hours on each of two played days', async () => {
        const provider = new ScriptedProvider({plans:[JSON.stringify({action:'wait'})],narrations:['The hour.']});
        const {game,repos} = await makeGameInWorld({seed:'routine-street',worldSeed:'road-world',provider});
        const {cultivator} = await game.newRun('Walker');
        const world=(await game.loadWorld())!;
        const town=world.locations.filter(l=>l.kind==='settlement').sort((a,b)=>
            world.npcs.filter(n=>n.status==='alive'&&n.locationId===b.id).length
            -world.npcs.filter(n=>n.status==='alive'&&n.locationId===a.id).length)[0]!;
        repos.cultivators.update(cultivator.id,{location:town.name});
        repos.cultivators.standIn(cultivator.id,theAreasOf(world,town).areas[0]!.id);
        const openingDay=world.currentDay;
        const scenes: string[]=[];
        for(const word of ['morning','midday','night','morning','midday','night']) {
            const turn=await game.act(`I wait until ${word}`);
            expect(turn.toolCalls.some(c=>c.name==='world.waitForHour'&&c.ok)).toBe(true);
            scenes.push(game.present(game.state().cultivator).map(n=>n.id).sort().join(','));
        }
        expect(new Set(scenes).size).toBeGreaterThan(1);
        expect(routineTime(game.atHand!)).toBe(routineTime({ currentDay: openingDay + 2, currentHour: 21 }));
    },180_000);

    it('a private visit lasts in the room and ends when its host leaves', async () => {
        const { game, repos, sister } = await arrange(true);
        const ask = await withTheAttemptLanding('request', () => game.act('I invite her to my room'));
        expect(ask.result.toolCalls.some(c => c.name === 'world.takeThemWithYou' && c.ok),ask.result.narration).toBe(true);
        await game.act('I go to my room');
        const me = repos.cultivators.getById(game.state().cultivator.id)!;
        expect(game.present(me).map(n => n.id)).toContain(sister.id);
        await game.act('I look around');
        expect(game.present(repos.cultivators.getById(me.id)!).map(n => n.id)).toContain(sister.id);
        await game.act('I go to the street');
        expect(game.whoIsWithYouOnTheRoad(repos.cultivators.getById(me.id)!)).toHaveLength(0);
        expect(game.atHand!.npcs.find(n => n.id === sister.id)!.activity?.redirect).toBeUndefined();
    }, 180_000);
});
