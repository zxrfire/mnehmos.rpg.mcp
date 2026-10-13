/**
 * The identity token and life lamp used to stay in the world after death; only their
 * readers said they were broken. The owner ruled on 2026-10-10 that these made tokens
 * physically crumble, with the keyed communication slips, before the estate is opened.
 * The existing member rows are the roll. Actual witnesses know the hour; an unwitnessed
 * death reaches a staffed hall through its next daily roll check, derived without ticks.
 * Ending the clerk's post used to erase that knowledge. An ordinary check event keeps
 * the finding after the clerk leaves or dies; it is not routine paperwork to sweep.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, markDead, setRealm } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { issueTo, lampIdFor, tokenIdFor, whatTheLampSays, theTokenStillAnswers } from '../../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { addToTheStack, keepTheTwins } from '../../../src/engine/world/a-communication-talisman-carries-word-home.js';
import { settleNpcDeath } from '../../../src/engine/world/time.js';
import { readTheRollAgainstTheHall, whenTheHallKnowsTheirLampIsGone } from '../../../src/engine/world/what-the-roll-and-the-lamps-say.js';
import { theOneBeingPlayedLeavesThePost } from '../../../src/engine/world/a-house-posts-the-one-being-played.js';
import { keepTheBusinessStillOnTheBooks } from '../../../src/engine/world/the-business-the-world-still-keeps.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';

const HOUSE = 'house';
const HALL = 'hall';
const DAY = 50.25;

function build(staff: 'none' | 'present' | 'at-a-meal' = 'none'): WorldState {
    const world = createWorld({ seed: 'physical-lamp-and-roll', skipPriorAges: true, regionCount: 0 });
    world.currentDay = DAY;
    world.locations.push(makeLocation({ id: 'seat', name: 'Spring House', kind: 'sect_seat', data: { factionId: HOUSE } }),
        makeLocation({ id: HALL, name: 'Life Lamp Hall', kind: 'hall', parentId: 'seat', tags: ['interior'],
            data: { factionId: HOUSE, purpose: 'life_lamp_hall' } }),
        makeLocation({ id: 'refectory', name: 'Refectory', kind: 'hall', parentId: 'seat', tags: ['interior'],
            data: { factionId: HOUSE, purpose: 'refectory' } }),
        makeLocation({ id: 'away', name: 'Far Ford', kind: 'settlement' }));
    world.factions.push(makeFaction({ id: HOUSE, name: 'Spring House', seatLocationId: 'seat', foundedOnDay: 0,
        ranks: ['Servant', 'Disciple', 'Elder', 'Head'] }));
    const member = setRealm(createNpc(world.seed, { id: 'member', bornOnDay: -10_000, onDay: 0,
        locationId: 'away', occupation: 'disciple' }), 14, 0);
    world.npcs.push({ ...member, factionId: HOUSE, factionRankIndex: 1, activity: null });
    const issued = issueTo({ memberId: member.id, memberName: member.name, houseId: HOUSE,
        houseName: 'Spring House', lampRoomId: HALL, onDay: 0 });
    world.objects.push(issued.token, issued.lamp);
    addToTheStack(world.objects, { houseId: HOUSE, houseName: 'Spring House', holderId: member.id, count: 2 });
    keepTheTwins(world.objects, { houseId: HOUSE, houseName: 'Spring House', senderId: member.id,
        count: 2, hallLocationId: HALL });
    if (staff !== 'none') {
        const clerk = createNpc(world.seed, { id: 'clerk', bornOnDay: -10_000, onDay: 0,
            locationId: HALL, occupation: 'disciple' });
        const posting = { kind: 'stationed' as const, note: 'Reading the roll each day.', withIds: [],
            sinceDay: 0, untilDay: 100, returnTo: 'seat' };
        world.npcs.push({ ...clerk, factionId: HOUSE, factionRankIndex: 1,
            activity: staff === 'present' ? posting : { ...posting, redirect: {
                until: 51, previous: posting, standingIn: 'refectory', returnDays: 0 } } });
    }
    return world;
}

function die(world: WorldState): void {
    world.npcs[0] = markDead(world.npcs[0]!, DAY, 'Died away from the house.');
    settleNpcDeath(world, world.npcs[0]!, DAY);
}

describe('a dead disciple\'s made tokens go to dust', () => {
    it('deletes the token, lamp and both keyed slip stacks wherever they were carried', () => {
        const world = build();
        const carrier = createNpc(world.seed, { id: 'carrier', bornOnDay: -10_000, onDay: 0,
            locationId: 'away', occupation: 'merchant' });
        world.npcs.push(carrier);
        const token = world.objects.find(object => object.id === tokenIdFor('member'))!;
        token.possessorId = carrier.id;
        const lamp = world.objects.find(object => object.id === lampIdFor('member'))!;
        lamp.possessorId = carrier.id;
        lamp.locationId = 'away';
        const before = world.objects.map(object => object.id);
        die(world);
        expect(world.objects.some(object => before.includes(object.id))).toBe(false);
        expect(world.objects.some(object => object.id === lampIdFor('member'))).toBe(false);
        expect(theTokenStillAnswers(false)).toBe(false);
        expect(whatTheLampSays(false)).toBe('they_are_dead');
        expect(readTheRollAgainstTheHall(world, HOUSE, { checkedNow: true })[0]?.reading).toBe('they_are_dead');
    });

    it('keeps an unwitnessed empty hall ignorant until somebody actually checks the roll', () => {
        const world = build();
        die(world);
        expect(whenTheHallKnowsTheirLampIsGone(world, HOUSE, world.npcs[0]!, 99)).toBeNull();
        expect(world.history.facts.some(fact => fact.data.lifeLamp === true)).toBe(false);
        expect(readTheRollAgainstTheHall(world, HOUSE, { day: 99, checkedNow: true })[0]?.reading).toBe('they_are_dead');
    });

    it('derives the next staffed daily check without a daily event or an exact death hour', () => {
        const world = build('at-a-meal');
        die(world);
        expect(world.history.facts.some(fact => fact.data.lifeLamp === true)).toBe(false);
        expect(whenTheHallKnowsTheirLampIsGone(world, HOUSE, world.npcs[0]!, DAY)).toBeNull();
        expect(whenTheHallKnowsTheirLampIsGone(world, HOUSE, world.npcs[0]!, 99)).toBe(51);
        expect(readTheRollAgainstTheHall(world, HOUSE, { day: 99 })[0]?.reading).toBe('they_are_dead');
        expect(world.history.facts.some(fact => fact.data.lampRollCheck === true)).toBe(false);
    });

    it('gives a person actually in the hall the witnessed hour through the ordinary fact', () => {
        const world = build('present');
        die(world);
        const witnessed = world.history.facts.find(fact => fact.data.lifeLamp === true)!;
        expect(witnessed.day).toBe(DAY);
        expect(witnessed.locationId).toBe(HALL);
        expect(witnessed.witnessIds).toContain('clerk');
        expect(whenTheHallKnowsTheirLampIsGone(world, HOUSE, world.npcs[0]!, DAY)).toBe(DAY);
    });

    it('preserves the burning lamp of a living but missing member', () => {
        const world = build();
        const reading = readTheRollAgainstTheHall(world, HOUSE, { day: 100,
            unseenSince: new Map([['member', 0]]) })[0]!;
        expect(reading.reading).toBe('somebody_has_them');
        expect(world.objects.some(object => object.id === lampIdFor('member'))).toBe(true);
    });

    it('keeps what the staffed roll check found after the clerk leaves and dies', () => {
        const world = build('at-a-meal');
        die(world);
        world.currentDay = 99;
        expect(theOneBeingPlayedLeavesThePost(world, { playerId: 'clerk', today: 99 })).toBe(true);
        expect(world.npcs[1]!.activity).toBeNull();
        const check = world.history.facts.find(fact => fact.data.lampRollCheck === true)!;
        expect(check).toBeDefined();
        expect(check.day).toBe(51);
        expect(check.summary).toContain(world.npcs[0]!.name);
        expect(check.witnessIds).toEqual(['clerk']);
        expect(whenTheHallKnowsTheirLampIsGone(world, HOUSE, world.npcs[0]!, 99)).toBe(51);
        world.npcs[1] = markDead(world.npcs[1]!, 100, 'Died later.');
        world.currentDay = 800;
        appendWorldFact(world, makeFact({ day: 0, kind: 'gathering', summary: 'A gate registration expired.',
            data: { gateRegistration: true } }), { recur: false });
        keepTheBusinessStillOnTheBooks(world);
        expect(world.history.facts.some(fact => fact.id === check.id)).toBe(true);
        expect(whenTheHallKnowsTheirLampIsGone(world, HOUSE, world.npcs[0]!, 800)).toBe(51);
    });

    it('does not invent a daily check when the clerk leaves before the next check day', () => {
        const world = build('at-a-meal');
        die(world);
        world.currentDay = 50.5;
        expect(theOneBeingPlayedLeavesThePost(world, { playerId: 'clerk', today: 50.5 })).toBe(true);
        expect(world.history.facts.some(fact => fact.data.lampRollCheck === true)).toBe(false);
        expect(whenTheHallKnowsTheirLampIsGone(world, HOUSE, world.npcs[0]!, 99)).toBeNull();
    });

    it('a fallen house has no daily hall work', () => {
        const world = build('at-a-meal');
        die(world);
        world.factions[0]!.dissolvedOnDay = 50.5;
        expect(whenTheHallKnowsTheirLampIsGone(world, HOUSE, world.npcs[0]!, 99)).toBeNull();
    });
});
