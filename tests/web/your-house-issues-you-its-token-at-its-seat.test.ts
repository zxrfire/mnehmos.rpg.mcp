/**
 * The player is given their house's robes and token at its seat, and not before.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `issueTo` had no caller on the played side. No player ever carried a token or
 * had a plate hung for them, and the gate passed a player on the strength of the
 * roll alone - so somebody who joined a house a province away walked through its
 * gate with nothing to show, and somebody who left it kept nothing they could
 * hand back because they had never been given anything.
 *
 * The ruling: *"technically you do join, you just don't get your ID and ID plate
 * till you get there, so you don't really have proof. You don't get your uniform
 * either."*
 *
 * ── WHAT THIS PINS, PLAYED ───────────────────────────────────────────────
 *
 * Joined away from the seat: nothing. Arriving: stopped at the gate with no
 * token to read, then entered at the seat - robes, a token, a plate on the wall -
 * read by the same `whatTheHouseGivesThem` the world's own recruits are. After
 * that the gate reads the token and lets them through. Promoted onto the token
 * rung at the seat: a token. Joined while standing at the seat: entered on the
 * turn. Leaving: both go back, and the gate turns them away.
 *
 * Preconditions are arranged (a place on the roll, a rung), which `AGENTS.md`
 * permits; the arrivals are played, and the issuing is the turn's own.
 *
 * Red-checked by removing the post-turn call in `turn-engine.ts`: every claim
 * about what the player carries goes red, and so does the gate passing them
 * once entered.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import {
    couldCutAPlate,
    theHouseTheirTokenNames,
    whoHasAPlateOnTheWallOf
} from '../../src/engine/world/a-house-knows-its-own-by-a-plate-and-a-token';
import { wearsTheRobesOf } from '../../src/engine/world/a-recruit-is-given-their-plate-at-the-house';
import { theHouseWhoseGateThisIs, whatTheGateOfThisHouseSays } from '../../src/web/walking-up-to-a-house';
import type { WorldState } from '../../src/engine/world/world-state';

const WORLD = 'a-house-you-can-walk-to';

/** A seated house somebody in can cut plates, asked of the world rather than named. */
function aHouseThatCutsPlates(world: WorldState) {
    for (const faction of world.factions) {
        if (faction.dissolvedOnDay !== null || faction.seatLocationId === null) continue;
        const seat = world.locations.find(l => l.id === faction.seatLocationId);
        if (!seat) continue;
        const cuts = world.npcs.some(n =>
            n.factionId === faction.id && n.status === 'alive' && couldCutAPlate(n.cultivation.realmOrdinal));
        if (cuts) return { faction, seat };
    }
    return null;
}

const tokenOf = (world: WorldState, id: string) => theHouseTheirTokenNames(
    world.objects, id, memberId => world.npcs.some(n => n.id === memberId && n.status === 'alive'));

describe('your house issues you its robes and token at its seat', () => {
    it('gives nothing to somebody who joined elsewhere, stops them at the gate, and enters them there', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'issued-at-the-seat', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Recruit');
        const found = aHouseThatCutsPlates((await game.loadWorld())!);
        expect(found, 'this world has no seated house that can cut a plate').not.toBeNull();
        const { faction, seat } = found!;

        // On the roll, at a rung that carries a token, and a province away.
        repos.sects.addMember(faction.id, cultivator.id, 1);
        await game.act('I look around');
        let world = game.atHand!;
        expect(wearsTheRobesOf(world.objects, cultivator.id, faction.id), 'robed before arriving').toBe(false);
        expect(tokenOf(world, cultivator.id), 'a token before arriving').toBeNull();

        const turn = await game.act(`I travel to the ${faction.name}`);
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(seat.name);
        const prose = turn.narration ?? '';
        expect(prose, 'the gate did not ask for a token').toMatch(/no token to read/);
        expect(prose, 'being entered was not said').toMatch(/Entered on the roll/);

        world = game.atHand!;
        expect(wearsTheRobesOf(world.objects, cultivator.id, faction.id)).toBe(true);
        expect(tokenOf(world, cultivator.id)).toBe(faction.id);
        expect(whoHasAPlateOnTheWallOf(world.objects, faction.id).has(cultivator.id)).toBe(true);

        // AND NOW THE GATE READS IT.
        const current = repos.cultivators.getById(cultivator.id)!;
        const house = theHouseWhoseGateThisIs(world, seat.name)!;
        expect(whatTheGateOfThisHouseSays(game, current, house).way).toBe('on the roll');

        // LEAVING HANDS IT BACK.
        repos.sects.removeMember(faction.id, cultivator.id);
        const left = await game.act('I look around');
        world = game.atHand!;
        expect(wearsTheRobesOf(world.objects, cultivator.id, faction.id)).toBe(false);
        expect(tokenOf(world, cultivator.id)).toBeNull();
        expect(left.narration ?? '').toMatch(/went back to it/);
        expect(whatTheGateOfThisHouseSays(game, repos.cultivators.getById(cultivator.id)!, house).way)
            .toBe('turned away');
    }, 240_000);

    it('cuts a token for somebody promoted onto the rung while at the seat', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'promoted-at-the-seat', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Servant');
        const { faction, seat } = aHouseThatCutsPlates((await game.loadWorld())!)!;

        repos.sects.addMember(faction.id, cultivator.id, 0);
        await game.act(`I travel to the ${faction.name}`);
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(seat.name);
        let world = game.atHand!;
        expect(wearsTheRobesOf(world.objects, cultivator.id, faction.id), 'robes at the seat').toBe(true);
        expect(tokenOf(world, cultivator.id), 'a token below the rung that carries one').toBeNull();

        repos.sects.setRank(faction.id, cultivator.id, 1);
        await game.act('I look around');
        world = game.atHand!;
        expect(tokenOf(world, cultivator.id)).toBe(faction.id);
    }, 240_000);

    it('enters somebody who joins while already standing at the seat, on that turn', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'joined-at-the-seat', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Walk-up');
        const { faction, seat } = aHouseThatCutsPlates((await game.loadWorld())!)!;

        await game.act(`I travel to the ${faction.name}`);
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(seat.name);
        let world = game.atHand!;
        expect(wearsTheRobesOf(world.objects, cultivator.id, faction.id), 'robed off the roll').toBe(false);

        repos.sects.addMember(faction.id, cultivator.id, 1);
        await game.act('I look around');
        world = game.atHand!;
        expect(wearsTheRobesOf(world.objects, cultivator.id, faction.id)).toBe(true);
        expect(tokenOf(world, cultivator.id)).toBe(faction.id);
    }, 240_000);
});
