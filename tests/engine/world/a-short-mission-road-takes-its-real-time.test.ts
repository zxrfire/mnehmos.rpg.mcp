/**
 * Native mission walking rounded every road up to a whole day in the quote
 * and both leg starters. A real 0.1-day road therefore took a day. NPCs pay
 * the same physical time as the player; this arranges that road and checks
 * the quote and actual outward/service/home course, met and in the background.
 * The service is explicitly a quarter day and is not shortened to fix travel.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { sendHouseMission, advancePublicCapitalMission }
    from '../../../src/engine/world/capital-missions-and-calendar';

describe('a native short road has its real duration', () => {
    for (const met of [false, true]) it(met ? 'the met party uses the actual road' : 'the background party uses the actual road', () => {
        const seed = `short-native-road-${met}`;
        const world = createWorld({ seed, regionCount: 0, skipPriorAges: true });
        const day = 10000;
        world.currentDay = day; world.currentHour = 0;
        const from = makeLocation({ id: 'short-road-home', name: 'Reed Court', kind: 'settlement' });
        const to = makeLocation({ id: 'short-road-visit', name: 'Stone Court', kind: 'settlement' });
        linkLocations(from, to, 'road', 0.1);
        world.locations = [from, to];
        const house = makeFaction({ id: 'short-road-house', name: 'Reed House', seatLocationId: from.id,
            resources: { spirit_stones: 12 } });
        world.factions = [house];
        const traveller = createNpc(seed, { id: 'short-road-traveller', locationId: from.id,
            factionId: house.id, factionRankIndex: 0, onDay: day, bornOnDay: day - 25 * 365 });
        // The native foreground contract reads the same explicit player-row
        // marker as existing mission controls; the played SQL follower is
        // covered separately in a-party-follower-has-a-real-stored-body.
        if (met) traveller.tags.push(PLAYER_ROW_TAG);
        world.npcs = [traveller];
        const mission = sendHouseMission(world, house, to, [traveller], 'an agreed visit', day, { days: 0.25 });
        expect(mission).not.toBeNull();
        expect(Number(mission!.data.publicServiceEnd) - day).toBeCloseTo(0.35);
        expect(Number(mission!.data.plannedReturnDay) - day).toBeCloseTo(0.45);
        const actual = () => world.npcs.find(person => person.id === traveller.id)!;
        expect(actual().activity!.untilDay! - actual().activity!.sinceDay).toBeCloseTo(0.1);
        world.currentDay = actual().activity!.untilDay!;
        expect(advancePublicCapitalMission(world, traveller.id, world.currentDay)).toBe(true);
        expect(actual().locationId).toBe(to.id);
        expect(actual().activity!.untilDay! - actual().activity!.sinceDay).toBeCloseTo(0.25);
        world.currentDay = actual().activity!.untilDay!;
        expect(advancePublicCapitalMission(world, traveller.id, world.currentDay)).toBe(true);
        expect(actual().activity!.untilDay! - actual().activity!.sinceDay).toBeCloseTo(0.1);
        world.currentDay = actual().activity!.untilDay!;
        expect(advancePublicCapitalMission(world, traveller.id, world.currentDay)).toBe(false);
        expect(actual().locationId).toBe(from.id);
        expect(world.currentDay - day).toBeCloseTo(0.45);
        expect(house.resources.spirit_stones).toBe(12);
    });
});
