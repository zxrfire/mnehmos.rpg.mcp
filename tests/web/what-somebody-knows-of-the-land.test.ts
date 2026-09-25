/**
 * What somebody knows of the land goes by distance and by standing, and nobody knows less than a
 * villager does. The owner: "people in a town know where the nearest city is", "people in a city
 * know where the provincial capitals are", "townsfolk have probably never left their town ... they
 * would only know names", "inner disciples know more than outer", "AT LEAST 1 PERSON OUGHT TO
 * KNOW THE WAY", and "going further to the provincial capital will basically guarantee it".
 */
import { describe, expect, it } from 'vitest';

import { PLACE } from '../../src/data/cultivation/place-names.js';
import { stageRank } from '../../src/engine/social/discovery.js';
import {
    PROVINCIAL_CAPITALS,
    howFarTheirKnowledgeReaches,
    whatKindOfPlace,
    whatSomebodyKnowsOfTheLand,
    whoAmongThemKnowsTheWay,
    whoAmongThemKnowsTheWayToAPlace,
    type WhoTheyAre
} from '../../src/engine/world/what-somebody-knows-of-the-land.js';
import { parseIntent } from '../../src/web/actions.js';
import { makeGameInWorld } from './harness.js';

describe('what kind of place it is', () => {
    it('reads a village, a town, a city and a provincial capital', () => {
        expect(whatKindOfPlace(PLACE.CLOUD_GATE)).toBe('provincial capital');
        expect(whatKindOfPlace(PLACE.THREE_WALLS)).toBe('city');
        expect(whatKindOfPlace('Autumn Gate')).toBe('town');
        expect(whatKindOfPlace('Old River Village')).toBe('village');
        expect(whatKindOfPlace('the Jade Gorge vein')).toBeNull();
    });
});

describe('what somebody knows of the land', () => {
    it('widens with the place, the road, the realm and the rank, and never narrows', async () => {
        const { game } = await makeGameInWorld({ seed: 'the-land', worldSeed: 'a-xianxia-run' });
        await game.newRun('Ke Yan');
        const world = game.atHand!;
        const who = (from: string, more: Partial<WhoTheyAre> = {}): WhoTheyAre => ({ id: 'npc-x', from, ordinal: 0, ...more });
        const known = (person: WhoTheyAre) => whatSomebodyKnowsOfTheLand(world, person);
        const placed = (land: ReturnType<typeof known>) =>
            new Set(land.places.filter(place => place.stage === 'placed').map(place => place.name));

        const villager = known(who('Old River Village'));
        const cityFolk = known(who(PLACE.THREE_WALLS));
        const house = world.factions.find(faction => faction.ranks.length >= 4 && faction.seatLocationId)!;
        const outer = who('Old River Village', { house: { id: house.id, rankIndex: 1 } });
        const inner = who('Old River Village', { house: { id: house.id, rankIndex: 2 } });
        const elder = known(who('Old River Village', { ordinal: 29, house: { id: house.id, rankIndex: house.ranks.length - 2 } }));

        // A village knows its capital and the nearest city, and a house or two by name.
        expect(placed(villager).has(PLACE.CLOUD_GATE)).toBe(true);
        expect(villager.houses.length).toBeGreaterThanOrEqual(1);
        expect(villager.houses.length).toBeLessThanOrEqual(2);
        // A city knows where every capital is; a village does not.
        for (const capital of Object.values(PROVINCIAL_CAPITALS)) expect(placed(cityFolk).has(capital)).toBe(true);
        expect(placed(villager).has(PLACE.SILVER_ISLE)).toBe(false);
        // Rank on a roll widens it: an inner disciple past an outer one.
        expect(howFarTheirKnowledgeReaches(world, inner)).toBeGreaterThan(howFarTheirKnowledgeReaches(world, outer));
        // An elder of standing has at least heard of every house.
        const seated = world.factions.filter(faction => faction.dissolvedOnDay === null && faction.seatLocationId
            && world.locations.find(row => row.id === faction.seatLocationId)?.kind === 'sect_seat');
        expect(elder.houses.length).toBe(seated.length);

        // Nobody knows less: everything the villager knows, the others know at least as well.
        for (const wider of [cityFolk, elder]) {
            const theirs = new Map(wider.places.map(place => [place.name, place.stage]));
            for (const place of villager.places) {
                expect(stageRank(theirs.get(place.name) ?? 'unaware')).toBeGreaterThanOrEqual(stageRank(place.stage));
            }
        }
    }, 180_000);

    it('has somebody in a town crowd know the way to a house of its province, and nothing promised in a village', async () => {
        const { game } = await makeGameInWorld({ seed: 'the-land-crowd', worldSeed: 'a-xianxia-run' });
        await game.newRun('Ke Yan');
        const world = game.atHand!;
        const jade = world.factions.filter(faction => faction.dissolvedOnDay === null && faction.seatLocationId
            && world.locations.find(row => row.id === faction.seatLocationId)?.kind === 'sect_seat'
            && world.locations.find(row => row.id === faction.seatLocationId)?.parentId === 'loc-region-low-fall');
        expect(jade.length).toBeGreaterThan(2);
        const crowd = (from: string): WhoTheyAre[] =>
            [1, 2, 3].map(n => ({ id: `npc-crowd-${n}`, from, ordinal: 0 }));

        // A town: somebody knows the way to any ordinary house of its own province.
        const ordinary = jade.filter(house => house.kind !== 'court');
        for (const house of ordinary.slice(0, 6)) {
            const found = whoAmongThemKnowsTheWay(world, 'Clear River Ford', crowd('Clear River Ford'), house.id);
            if (found < 0) {
                // Only an apex may be out of a town's reach.
                expect(whoAmongThemKnowsTheWay(world, PLACE.GREEN_FALL, crowd(PLACE.GREEN_FALL), house.id)).toBeGreaterThanOrEqual(0);
            }
        }
        // A village guarantees nothing: there is a house of the province none of them could find.
        const villagers = crowd('Plum Village');
        expect(jade.some(house => whoAmongThemKnowsTheWay(world, 'Plum Village', villagers, house.id) === -1)).toBe(true);
        // And the capital is the surest place to ask.
        for (const house of jade) {
            expect(whoAmongThemKnowsTheWay(world, PLACE.GREEN_FALL, crowd(PLACE.GREEN_FALL), house.id)).toBeGreaterThanOrEqual(0);
        }
    }, 180_000);

    it('finds somebody in a capital who knows the road to any province, and nobody owes it in a village', async () => {
        const { game } = await makeGameInWorld({ seed: 'the-land-far-off', worldSeed: 'a-xianxia-run' });
        await game.newRun('Ke Yan');
        const world = game.atHand!;
        const crowd = (from: string): WhoTheyAre[] => [1, 2, 3].map(n => ({ id: `npc-far-${n}`, from, ordinal: 0 }));
        // Two borders off, over the Jade Gorge: a provincial capital's roads come from everywhere.
        expect(whoAmongThemKnowsTheWayToAPlace(world, PLACE.IRON_GATE, crowd(PLACE.IRON_GATE), 'The White Stair')).toBeGreaterThanOrEqual(0);
        expect(whoAmongThemKnowsTheWayToAPlace(world, 'Willow Village', crowd('Willow Village'), 'The White Stair')).toBe(-1);
        // A province is found by the road toward it: anybody knows the way to the one next door.
        const villager = whatSomebodyKnowsOfTheLand(world, { id: 'npc-far-v', from: 'Willow Village', ordinal: 0 });
        expect(villager.places.find(place => place.name === 'The Jade Gorge')?.stage).toBe('placed');
    }, 180_000);

    it('reads the way put to a crowd however it is said', () => {
        for (const said of [
            'anyone know the way to the white stairs? the mountain province',
            'does anybody know how to get to the white stair',
            'can someone tell me how to get to the white stair',
            'any of u guys know the road to the white stair'
        ]) {
            expect(parseIntent(said), said).toMatchObject({ action: 'interact', intent: 'talk', topic: expect.stringMatching(/^the way to (?:the )?white stairs?$/) });
        }
    });

    it('answers the way when the crowd is asked, with the provinces the road crosses', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'the-land-asked', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        repos.cultivators.update(cultivator.id, { location: PLACE.IRON_GATE });
        const turn = await game.act('anyone know the way to the white stairs?');
        expect(turn.narration).toMatch(/gives the way to The White Stair: .*days on the road through The Jade Gorge/);
        expect(stageRank(game.knowledge.stageOf(cultivator.id, 'place', 'The White Stair'))).toBeGreaterThanOrEqual(stageRank('placed'));
        // Inside one province the answer is the walk itself, in days.
        const near = await game.act('does anybody know how to get to willow village');
        expect(near.narration).toMatch(/gives the way to Willow Village: in this province, \d+ days? on the road/);
    }, 180_000);

    it('widens as the player goes: a capital signs its roads to the next provinces', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'the-land-goes-further', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        repos.cultivators.update(cultivator.id, { location: PLACE.CLOUD_GATE });
        await game.act('I look around');
        const stageOf = (name: string) => stageRank(game.knowledge.stageOf(cultivator.id, 'place', name));
        // Its own province's settlements, heard of at least.
        expect(stageOf(PLACE.THREE_WALLS)).toBeGreaterThanOrEqual(stageRank('named'));
        expect(stageOf('Old River Village')).toBeGreaterThanOrEqual(stageRank('named'));
        // And the capitals next door, which a capital's roads are signed for.
        expect(stageOf(PLACE.GREEN_FALL)).toBeGreaterThanOrEqual(stageRank('placed'));
        expect(stageOf(PLACE.SILVER_ISLE)).toBeGreaterThanOrEqual(stageRank('placed'));
    }, 180_000);

    it('starts the player knowing the way to a house they can walk to, and where their life had taken them', async () => {
        const { game } = await makeGameInWorld({ seed: 'the-land-player', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const houses = game.knowledge.awareness(cultivator.id, 'sect')
            .filter(row => stageRank(row.stage) >= stageRank('placed'));
        expect(houses.length).toBeGreaterThanOrEqual(1);
        // And the road goes there: walking to it is a journey, not a refusal.
        const turn = await game.act(`I go to the ${houses[0]!.name}`);
        expect(turn.toolCalls.some(call => call.action === 'move' && call.ok)).toBe(true);
        const been = game.knowledge.awareness(cultivator.id, 'place')
            .filter(row => stageRank(row.stage) >= stageRank('encountered'));
        expect(been.length).toBeGreaterThanOrEqual(1);
    }, 180_000);
});
