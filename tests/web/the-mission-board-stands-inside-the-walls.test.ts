/**
 * A house's mission board stands in one area inside its seat, and is read and taken from there.
 *
 * The owner: the board is "there, inside the sect", "almost an NPC, you can't talk to an npc not
 * in your area", and a higher rung takes a lower rung's missions but not the other way round.
 * So: somebody inside the walls is walked over to it; a member takes their own rung's missions and
 * every rung's below, and is told which rung a higher one is posted to; somebody who got in
 * without being on the roll reads it and is told it is for the house's own; and from a town it is
 * not there at all.
 *
 * Arranged: a place on the roll at a rung, the realm, and where they stand. Played: every read and
 * every take.
 */

import { describe, expect, it } from 'vitest';
import { REGIONS, HOME_REGION_ID } from '../../src/data/cultivation/regions';
import { theFirstRungOf } from '../../src/engine/encounters/what-a-house-has-on-its-board';
import { theAreasOf, type WhatAnAreaIsFor } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { HOUSE_MISSIONS, type MissionRung } from '../../src/data/cultivation/what-a-house-posts-for-its-own';
import { whatAHouseSendsItsSisters } from '../../src/engine/world/what-a-house-sends-its-sisters';
import { makeGameInWorld } from './harness';

const A_HOUSE = 'sect-azure-cloud-pavilion';
const A_MARKET_TOWN = REGIONS.find(region => region.id === HOME_REGION_ID)!
    .places.find(place => place.kind === 'market_town')!.name;

const outerMissionIn = (read: string): boolean =>
    HOUSE_MISSIONS.filter(m => m.rung === 'outer').some(m => read.includes(m.said));

async function standingAt(seed: string, where: WhatAnAreaIsFor | 'a town', opts: { rung?: MissionRung; ordinal: number }) {
    const { game, repos, db } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator } = await game.newRun('Ke Yan');
    const world = (await game.loadWorld())!;
    const house = world.factions.find(f => f.id === A_HOUSE)!;
    const seat = world.locations.find(l => l.id === house.seatLocationId)!;
    const ladder = repos.sects.getById(A_HOUSE)!.ranks;
    db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?').run(opts.ordinal, cultivator.id);
    if (opts.rung) repos.sects.addMember(A_HOUSE, cultivator.id, theFirstRungOf(opts.rung, ladder.length)!);
    if (where === 'a town') {
        repos.cultivators.update(cultivator.id, { location: A_MARKET_TOWN });
    } else {
        repos.cultivators.update(cultivator.id, { location: seat.name });
        repos.cultivators.standIn(cultivator.id, theAreasOf(world, seat).areas.find(a => a.for === where)!.id);
    }
    const standing = () => repos.cultivators.getById(cultivator.id)!.standingIn ?? '';
    const days = () => game.state().run.elapsedDays;
    return { game, ladder, standing, days };
}

describe('the mission board inside a house', () => {
    it('walks a member over to it, shows their rung and below, and refuses a rung above by name', async () => {
        const { game, ladder, standing, days } = await standingAt('board-outer', 'forecourt', { rung: 'outer', ordinal: 8 });
        const read = (await game.act('what missions are there')).narration ?? '';
        expect(read).toContain('You walk over to the mission board.');
        expect(standing()).toContain('#board#');
        expect(outerMissionIn(read), 'no outer mission read out').toBe(true);
        expect(read).toMatch(/Azure Cloud Pavilion .*for the next \d+ (?:days|months)/);
        expect(read, 'a rung above theirs was read out').not.toMatch(/pass watch/);

        const refused = (await game.act('I take the pass watch')).narration ?? '';
        expect(refused).toContain(`posts this to ${ladder[theFirstRungOf('inner', ladder.length)!]} and above`);
        expect(days()).toBe(0);
    }, 240_000);

    it('lets a rung above take a rung below\'s mission', async () => {
        const { game, days } = await standingAt('board-inner', 'forecourt', { rung: 'inner', ordinal: 8 });
        const took = await game.act('I take the chores');
        expect(took.toolCalls.map(call => call.name).join(', ')).toMatch(/completeDuty|recordDaysServed/);
        expect(days()).toBeGreaterThan(0);
    }, 240_000);

    it('keeps each rung\'s missions on an elder\'s board rather than cutting them off by pay', async () => {
        const { game } = await standingAt('board-elder', 'board', { rung: 'elder', ordinal: 20 });
        const read = (await game.act('what missions are there')).narration ?? '';
        const shown = (handles: readonly string[]) => handles.some(said => read.includes(said));
        expect(shown(HOUSE_MISSIONS.filter(m => m.rung === 'outer').map(m => m.said)), 'no outer mission').toBe(true);
        expect(shown(HOUSE_MISSIONS.filter(m => m.rung === 'inner').map(m => m.said)), 'no inner mission').toBe(true);
        expect(read).toMatch(/And \d+ more missions?\./);
        // And a delivery the house is sending, which pays least and used to fall off the end.
        const world = game.atHand!;
        const sending = whatAHouseSendsItsSisters(world, A_HOUSE, Math.floor(world.currentDay));
        expect(sending.length, 'this house sends nothing this season').toBeGreaterThan(0);
        expect(shown(sending.map(consignment => consignment.goods)), 'no delivery').toBe(true);
    }, 240_000);

    it('is read by somebody inside who is not on the roll, and taken from by nobody but the house\'s own', async () => {
        const { game, days } = await standingAt('board-intruder', 'board', { ordinal: 8 });
        const read = (await game.act('what missions are there')).narration ?? '';
        expect(outerMissionIn(read), 'the board was not read').toBe(true);
        const refused = (await game.act('I take the chores')).narration ?? '';
        expect(refused).toContain('Azure Cloud Pavilion posts this for its own');
        expect(days()).toBe(0);
    }, 240_000);

    it('is not there from outside the gate', async () => {
        const { game, standing } = await standingAt('board-gate', 'gate', { ordinal: 8 });
        const read = (await game.act('what missions are there')).narration ?? '';
        expect(outerMissionIn(read)).toBe(false);
        expect(standing()).toContain('#gate#');
    }, 240_000);

    it('is not there from a town, even for a member', async () => {
        const { game, days } = await standingAt('board-town', 'a town', { rung: 'outer', ordinal: 8 });
        const read = (await game.act('what missions are there')).narration ?? '';
        expect(outerMissionIn(read)).toBe(false);
        const refused = (await game.act('I take the chores')).narration ?? '';
        expect(refused).toContain('hang on the mission board inside its walls');
        expect(days()).toBe(0);
    }, 240_000);
});

describe('acting as dao protector, with nobody named', () => {
    it('walks an elder inside their own walls over to the board and takes the post', async () => {
        const { game, standing } = await standingAt('dao-inside', 'forecourt', { rung: 'elder', ordinal: 20 });
        const said = (await game.act('I act as dao protector')).narration ?? '';
        expect(said).toContain('You walk over to the mission board.');
        expect(said).toContain('You take up the post: Act as dao protector for the outer disciples of Azure Cloud Pavilion');
        expect(standing()).toContain('#board#');
    }, 240_000);

    it('is the guard verb\'s own answer outside the walls', async () => {
        const { game } = await standingAt('dao-outside', 'a town', { rung: 'elder', ordinal: 20 });
        const said = (await game.act('I act as dao protector')).narration ?? '';
        expect(said).not.toContain('mission board');
        expect(said).not.toContain('You take up the post');
    }, 240_000);
});
