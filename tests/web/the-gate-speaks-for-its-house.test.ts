/**
 * The disciple on a house's gate speaks for it to a stranger asking after its work.
 *
 * The owner: "a sects board is internal", "the board is INSIDE", "they are outside", "they post
 * NOTICES for external", "you can ask the disciple at the gates about this too", "they'd know, of
 * course", "they represent the sect to outsiders". Played blind at the Azure Dew Sect's gate:
 * "what's on your notice board then? any jobs an outsider can do?" was answered with the mortal
 * work list, and the house said nothing.
 */
import { describe, expect, it } from 'vitest';

import { theOneOnWatchAtTheGate } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { makeGameInWorld } from './harness';
import { asksTheWay } from '../../src/web/asking-the-way';

async function aStrangerAtAGate(seed: string) {
    const { game, repos } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator } = await game.newRun('Ke Yan');
    const world = game.atHand!;
    const at = world.factions
        .filter(house => house.dissolvedOnDay === null && house.seatLocationId)
        .map(house => {
            const seat = world.locations.find(row => row.id === house.seatLocationId && row.kind === 'sect_seat');
            return { house, seat, watch: seat ? theOneOnWatchAtTheGate(world, seat) : null };
        })
        .find(row => row.seat && row.watch && row.house.id !== cultivator.sectId);
    expect(at, 'no house in this world has anybody on its gate').toBeDefined();
    repos.cultivators.update(cultivator.id, { location: at!.seat!.name });
    return { game, repos, cultivator, house: at!.house, seat: at!.seat!, watch: at!.watch! };
}

const THE_BOARD_IS_INSIDE = /says the board is inside the walls and is for .*'s own/;

describe('the gate speaks for its house', () => {
    it('answers the board asked for at the gate: it is inside, and the notices are on the town walls', async () => {
        const at = await aStrangerAtAGate('gate-board');
        const read = await at.game.act('what duties are there');
        expect(read.narration).toMatch(THE_BOARD_IS_INSIDE);
        expect(read.narration).toContain(at.house.name);
        // Nothing of the board itself reaches somebody outside it.
        expect(read.narration).not.toMatch(/posts this to its own|is not being put to you/);
        expect(read.narration).toMatch(/names what .* has up for outsiders now, on the wall below the gate and on the town walls|has nothing up for outsiders/);
    }, 240_000);

    it('answers the watch asked by name, and the watch asked by what they are', async () => {
        const at = await aStrangerAtAGate('gate-asked');
        const byName = await at.game.act(`${at.watch.name}, any work for outsiders?`);
        expect(byName.narration).toMatch(THE_BOARD_IS_INSIDE);
        const byWhatTheyAre = await at.game.act('the disciple on watch, any work for outsiders?');
        expect(byWhatTheyAre.narration).toMatch(THE_BOARD_IS_INSIDE);
    }, 240_000);

    it('never offers a stranger a delivery, on the board or on the paper', async () => {
        const at = await aStrangerAtAGate('gate-no-delivery');
        const read = await at.game.act('any jobs an outsider can do?');
        expect(read.narration).not.toMatch(/^\s*Deliver /m);
    }, 240_000);

    it('says the town below the wall, its inn and market, on a look from outside the gate', async () => {
        const at = await aStrangerAtAGate('gate-look');
        const looked = await at.game.act('I look around');
        expect(looked.narration).toMatch(/Outside the wall there is a .*the grain and salt market, the inn/);
    }, 240_000);

    it('leaves the house own on its board', async () => {
        const at = await aStrangerAtAGate('gate-own');
        at.repos.sects.addMember(at.house.id, at.cultivator.id, 0);
        at.repos.cultivators.update(at.cultivator.id, { sectId: at.house.id, location: at.seat.name });
        const read = await at.game.act('what duties are there');
        expect(read.narration).not.toMatch(THE_BOARD_IS_INSIDE);
    }, 240_000);
});

/**
 * Played blind at the Azure Dew gate: "i came all the way from sweet spring island. i want to join
 * the azure dew sect, how do i get in?" was asked as the way to "coming from sweet spring island".
 */
describe('getting in at a gate is joining, not the way', () => {
    it('reads "how do i get in" as no question of the road, and "how do i get to" as one', () => {
        expect(asksTheWay('i want to join the azure dew sect, how do i get in?')).toBe(false);
        expect(asksTheWay('how do i get to the azure dew sect?')).toBe(true);
        expect(asksTheWay('how do we get there from here')).toBe(true);
        expect(asksTheWay('where is the azure dew sect')).toBe(true);
    });
});
