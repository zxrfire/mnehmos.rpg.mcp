/**
 * Standing somewhere is standing in one area of it, and an area holds three of the world's people
 * at most: the street, a market, the inn, outside a house's gate or in its forecourt.
 *
 * Measured before this on `road-world`: a run opened on intro-2 stood in Cloud Gate with 28 people
 * around it, every one of them "here". The owner: "AT MOST 3 people per room, 3 NPCs", and a
 * house's gate "ALWAYS has a disciple of that house on watch"; somebody the gate turned away is
 * outside it, not in the grounds.
 *
 * What is pinned, in the words a player would use:
 *
 *   OPENING        a run opens in an area of its town, among the faces it knows first, three at most
 *   WALKING IN     "I go to the inn" puts the player in the inn and the people in it in front of
 *                  them, and spends no day; "I go back out to the street" brings them back
 *   LEAVING        any change of place clears where they stood in the last one
 *   THE GATE       a stranger arriving at a house stands outside its gate with the one on watch,
 *                  and the arrival says who that is; somebody of the house the gate lets in
 *                  stands in the forecourt
 *
 * Red-checked: with `othersPresent` reading the whole row again, the first assertion fails on
 * the whole of Cloud Gate standing where the run opened.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { npcsAt } from '../../src/engine/world/world-state';
import { npcsInTheArea, theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { worldLocationFor } from '../../src/web/entities';
import { THE_INTERNAL_AFFAIRS_ELDER } from '../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token';
import { theHouseExpects, theyOweTheHouseAReport } from '../../src/engine/world/a-house-expects-somebody-it-took-on';
import { isTheWorldsToMove } from '../../src/engine/world/npc-state';
import { thePeopleHere } from '../../src/web/the-narrator-plays-the-world';

const ids = (rows: readonly { id: string }[]) => rows.map(row => row.id).sort();
const GATE_WORLD = 'a-house-you-can-walk-to';
/** The owner's number, stated here rather than imported. */
const AT_MOST_IN_AN_AREA = 3;

/** The first seated house, asked of the world rather than named. */
function aSeatedHouse(world: { locations: any[]; factions: any[] }) {
    for (const faction of world.factions) {
        const seat = world.locations.find(row => row.kind === 'sect_seat' && row.data?.factionId === faction.id);
        if (seat && faction.dissolvedOnDay === null) return { faction, seat };
    }
    return null;
}

describe('a place is read into areas of at most three', () => {
    it('opens a run among the people of its town, and walks it to the inn and out to the street without spending a day', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'intro-2', worldSeed: 'road-world' });
        const { cultivator } = await game.newRun('Walker');
        const world = (await game.loadWorld())!;
        const town = worldLocationFor(world, cultivator.location)!;
        expect(town.kind).toBe('settlement');
        const { areas } = theAreasOf(world, town);
        const inn = areas.find(area => area.name === 'the inn')!;
        const street = areas.find(area => area.name === 'the street')!;

        const whole = npcsAt(world, town.id).length;
        const opened = areas.find(area => area.id === cultivator.standingIn)!;
        expect(opened, 'the run opened in no area of its town').toBeDefined();
        const whereItOpened = game.present(cultivator);
        console.log(`[areas] ${town.name}: ${whole} in the town, ${whereItOpened.length} in ${opened.name}`);
        expect(whereItOpened.length).toBeGreaterThan(0);
        expect(whereItOpened.length).toBeLessThanOrEqual(AT_MOST_IN_AN_AREA);
        expect(ids(whereItOpened)).toEqual(ids(npcsInTheArea(world, opened.id)));
        expect(opened.id, 'the test walks to the inn from somewhere else').not.toBe(inn.id);

        const day = world.currentDay;
        const walked = await game.act('I go to the inn');
        expect(walked.toolCalls.map(call => call.name)).toContain('world.walkAcrossThePlace');
        const inside = repos.cultivators.getById(cultivator.id)!;
        expect(inside.standingIn).toBe(inn.id);
        expect(inside.location).toBe(cultivator.location);
        expect(ids(game.present(inside))).toEqual(ids(npcsInTheArea(world, inn.id)));
        expect((await game.loadWorld())!.currentDay).toBe(day);

        await game.act('I go back out to the street');
        const out = repos.cultivators.getById(cultivator.id)!;
        expect(out.standingIn).toBe(street.id);
        expect(ids(game.present(out))).toEqual(ids(npcsInTheArea(world, street.id)));
    }, 300_000);

    /**
     * Played by the owner on `wander-world`: arriving in Emerald Water City put "24 people whose
     * faces the player cannot place" in front of them and not one card, so there was nobody to ask
     * the way. Arriving now is arriving in one area of it, and every face there is a card.
     */
    it('arrives in a city among three at most, each of them somebody to walk up to', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'wander-1', worldSeed: 'wander-world', adminMode: true });
        const { cultivator } = await game.newRun('Lu Ming');
        // The owner typed "ok then im heading to green water citty", which a model parses; the verb table
        // is given the plain sentence.
        await game.act('I travel to Emerald Water City');
        const me = repos.cultivators.getById(cultivator.id)!;
        expect(me.location).toBe('Emerald Water City');
        const world = (await game.loadWorld())!;
        const city = worldLocationFor(world, me.location)!;
        const company = game.company(me);
        console.log(`[areas] ${city.name}: ${npcsAt(world, city.id).length} in the city, ${company.total} where they arrived`);
        expect(company.total).toBeGreaterThan(0);
        expect(company.total).toBeLessThanOrEqual(AT_MOST_IN_AN_AREA);
        const said = thePeopleHere(company, me.realmOrdinal, [], null).join('\n');
        const cards = said.split('\n').filter(line => /^- A face with no name to it|^- [A-Z]/.test(line)).length;
        expect(cards, `somebody here is not a card:\n${said}`).toBeGreaterThanOrEqual(company.total);
    }, 300_000);

    it('forgets where somebody stood in a place once they change place', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'intro-2', worldSeed: 'road-world' });
        const { cultivator } = await game.newRun('Leaver');
        await game.act('I go to the inn');
        expect(repos.cultivators.getById(cultivator.id)!.standingIn).toContain('#table#');

        const somewhereElse = (await game.loadWorld())!.locations
            .find(row => row.kind === 'settlement' && row.name !== cultivator.location)!;
        repos.cultivators.update(cultivator.id, { location: somewhereElse.name });
        repos.cultivators.update(cultivator.id, { location: cultivator.location });
        expect(repos.cultivators.getById(cultivator.id)!.standingIn ?? null).toBeNull();
    }, 300_000);

    it('stands a stranger outside a house\'s gate with the one on watch, and says who is on watch', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'gate-stranger', worldSeed: GATE_WORLD });
        const { cultivator } = await game.newRun('Stranger');
        const { faction, seat } = aSeatedHouse((await game.loadWorld())!)!;

        const turn = await game.act(`I travel to the ${faction.name}`);
        const me = repos.cultivators.getById(cultivator.id)!;
        expect(me.location).toBe(seat.name);
        expect(me.standingIn, 'the gate turned them away and put them inside').toContain('#gate#');

        const said = [turn.narration ?? '', ...turn.toolCalls.map(call => call.summary)].join('\n');
        const here = game.present(me);
        expect(here.length).toBeLessThanOrEqual(AT_MOST_IN_AN_AREA);
        const onWatch = here.find(row => row.sectId === faction.id);
        expect(onWatch, 'nobody of the house was at its gate').toBeDefined();
        expect(said).toContain(`${onWatch!.name}, a disciple of ${faction.name}, is on watch at the gate.`);
    }, 300_000);

    it('lets somebody of the house the gate knows into the forecourt', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'gate-member-word', worldSeed: GATE_WORLD });
        const { cultivator } = await game.newRun('Recruit');
        const world = (await game.loadWorld())!;
        const { faction, seat } = aSeatedHouse(world)!;
        repos.sects.addMember(faction.id, cultivator.id, 1);

        // ARRANGED: the house has word of them, however it travelled, and they know who took them on.
        const recruiter = world.npcs.find(n => n.status === 'alive' && n.factionId === faction.id && isTheWorldsToMove(n))!;
        const day = Math.floor(world.currentDay);
        const person = { id: cultivator.id, name: cultivator.name };
        theyOweTheHouseAReport(world, recruiter.id, { houseId: faction.id, person, placeId: null, onDay: day });
        theHouseExpects(world, {
            houseId: faction.id, person, recruiter: { id: recruiter.id, name: recruiter.name }, where: null,
            takenOnDay: day, reportedBy: { id: recruiter.id }, onDay: day, addressedTo: THE_INTERNAL_AFFAIRS_ELDER
        });
        game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'cultivator', id: recruiter.id, name: recruiter.name,
            onDay: day, sourceKind: 'witnessed', stage: 'encountered'
        });
        game.theWorldMoved();

        await game.act(`I travel to the ${faction.name}`);
        const me = repos.cultivators.getById(cultivator.id)!;
        expect(me.location).toBe(seat.name);
        expect(me.standingIn, 'the gate let them in and left them outside').toContain('#forecourt#');
    }, 300_000);
});
