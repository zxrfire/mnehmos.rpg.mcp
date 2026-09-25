/**
 * The player is given their house's robes and token at its seat, and not before.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `issueTo` had no caller on the played side. No player ever carried a token or
 * had a lamp lit for them, and the gate passed a player on the strength of the
 * roll alone - so somebody who joined a house a province away walked through its
 * gate with nothing to show, and somebody who left it kept nothing they could
 * hand back because they had never been given anything.
 *
 * The ruling: *"technically you do join, you just don't get your ID and ID plate
 * till you get there, so you don't really have proof. You don't get your uniform
 * either."*
 *
 * AND THE HOUSE HAS TO EXPECT THEM. The design owner's later ruling: whoever took
 * somebody on reports it to the Internal Affairs Elder, and somebody never
 * entered is let in at the gate when the house expects them and they can say who
 * took them on. See `a-house-expects-somebody-it-took-on.test.ts`.
 *
 * ── WHAT THIS PINS, PLAYED ───────────────────────────────────────────────
 *
 * Joined away from the seat with nobody's word: nothing, and stopped at the gate
 * with no token to read and nobody told to expect them. Once the house has the
 * word: let in, and entered at the seat - robes, a token, a lamp burning -
 * read by the same `whatTheHouseGivesThem` the world's own recruits are. After
 * that the gate reads the token. Promoted onto the token rung at the seat: a
 * token. Joining at the seat in front of somebody of the house out looking for
 * disciples: that person took them on, told the house there and then, and they
 * are entered on the turn.
 * Leaving: both go back, and the gate turns them away.
 *
 * Preconditions are arranged (a place on the roll, a rung, a report already made
 * where the test is not about how it travelled), which `AGENTS.md` permits; the
 * arrivals and the join are played, and the issuing is the turn's own.
 *
 * Red-checked by removing the post-turn call in `turn-engine.ts`: every claim
 * about what the player carries goes red, and so does the gate passing them
 * once entered. By removing `whoTookYouOn` from the join: the join test goes red.
 * And by entering anybody at the seat whatever the house's word: the first test
 * goes red, entered on nobody's word.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import {
    couldLightALamp,
    theHouseTheirTokenNames,
    THE_INTERNAL_AFFAIRS_ELDER,
    whoHasALampBurningIn
} from '../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token';
import { holdsTheRobesOf, wearsTheRobesOf } from '../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house';
import {
    doesTheHouseExpect,
    theHouseExpects,
    theyOweTheHouseAReport
} from '../../src/engine/world/a-house-expects-somebody-it-took-on';
import { isTheWorldsToMove } from '../../src/engine/world/npc-state';
import { theHouseWhoseGateThisIs, whatTheGateOfThisHouseSays } from '../../src/web/walking-up-to-a-house';
import type { FactionRecord, WorldState } from '../../src/engine/world/world-state';
import { howManyAHouseReallyHas } from '../../src/engine/social/how-a-house-reads-a-face';
import { A_ROLL_A_PLAYER_COULD_KNOW } from '../../src/engine/world/a-house-raises-its-own';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { createDebt } from '../../src/engine/social/grudges';
import { getSect } from '../../src/data/cultivation/sects';
import { SENDING_REASONS } from '../../src/data/cultivation/why-a-house-puts-a-party-on-the-road';

const WORLD = 'a-house-you-can-walk-to';

/** A seated house somebody in can light lamps, asked of the world rather than named. */
function aHouseThatLightsLamps(world: WorldState) {
    for (const faction of world.factions) {
        if (faction.dissolvedOnDay !== null || faction.seatLocationId === null) continue;
        const seat = world.locations.find(l => l.id === faction.seatLocationId);
        if (!seat) continue;
        const cuts = world.npcs.some(n =>
            n.factionId === faction.id && n.status === 'alive' && couldLightALamp(n.cultivation.realmOrdinal));
        if (cuts) return { faction, seat };
    }
    return null;
}

const tokenOf = (world: WorldState, id: string) => theHouseTheirTokenNames(
    world.objects, id, memberId => world.npcs.some(n => n.id === memberId && n.status === 'alive'));

type Game = Awaited<ReturnType<typeof makeGameInWorld>>['game'];

/**
 * ARRANGED: somebody of the house took them on and the word has reached its
 * Internal Affairs office, however it travelled, and the player knows who.
 */
function theHouseHasTheWord(
    game: Game,
    person: { id: string; name: string },
    faction: FactionRecord
): string {
    const world = game.atHand!;
    const recruiter = world.npcs.find(n =>
        n.status === 'alive' && n.factionId === faction.id && isTheWorldsToMove(n))!;
    const day = Math.floor(world.currentDay);
    theyOweTheHouseAReport(world, recruiter.id, { houseId: faction.id, person, placeId: null, onDay: day });
    theHouseExpects(world, {
        houseId: faction.id,
        person,
        recruiter: { id: recruiter.id, name: recruiter.name },
        where: null,
        takenOnDay: day,
        reportedBy: { id: recruiter.id },
        onDay: day,
        addressedTo: THE_INTERNAL_AFFAIRS_ELDER
    });
    game.knowledge.learnIfNew({
        holderId: person.id, kind: 'cultivator', id: recruiter.id, name: recruiter.name,
        onDay: day, sourceKind: 'witnessed', stage: 'encountered'
    });
    game.theWorldMoved();
    return recruiter.name;
}

describe('your house issues you its robes and token at its seat', () => {
    it('stops somebody who joined elsewhere at the gate, lets them in on the house\'s word, and enters them there', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'issued-at-the-seat', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Recruit');
        const found = aHouseThatLightsLamps((await game.loadWorld())!);
        expect(found, 'this world has no seated house that can light a lamp').not.toBeNull();
        const { faction, seat } = found!;

        // On the roll, at a rung that carries a token, and a province away.
        repos.sects.addMember(faction.id, cultivator.id, 1);
        await game.act('I look around');
        let world = game.atHand!;
        expect(holdsTheRobesOf(world.objects, cultivator.id, faction.id), 'robed before arriving').toBe(false);
        expect(tokenOf(world, cultivator.id), 'a token before arriving').toBeNull();

        // NOBODY'S WORD: stopped, and not entered.
        const turn = await game.act(`I travel to the ${faction.name}`);
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(seat.name);
        const prose = turn.narration ?? '';
        expect(prose, 'the gate did not ask for a token').toMatch(/no token to read/);
        expect(prose, 'the gate did not say it had no word of them').toMatch(/Nobody at the gate was told to expect you/);
        world = game.atHand!;
        expect(holdsTheRobesOf(world.objects, cultivator.id, faction.id), 'entered on nobody\'s word').toBe(false);

        // THE HOUSE'S WORD: the gate lets them in, and the seat enters them.
        const recruiter = theHouseHasTheWord(game, { id: cultivator.id, name: cultivator.name }, faction);
        const house = theHouseWhoseGateThisIs(game.atHand!, seat.name)!;
        const letIn = whatTheGateOfThisHouseSays(game, repos.cultivators.getById(cultivator.id)!, house);
        expect(letIn.way).toBe('on the roll');
        expect(letIn.facts.join(' ')).toContain(`You say ${recruiter} took you on`);

        const entered = await game.act('I look around');
        expect(entered.narration ?? '', 'being entered was not said').toMatch(/Entered on the roll/);
        world = game.atHand!;
        // Handed over, not put on: "they give you the item and YOU change".
        expect(holdsTheRobesOf(world.objects, cultivator.id, faction.id)).toBe(true);
        expect(wearsTheRobesOf(world.objects, cultivator.id, faction.id)).toBe(false);
        expect(tokenOf(world, cultivator.id)).toBe(faction.id);
        expect(whoHasALampBurningIn(world.objects, faction.id).has(cultivator.id)).toBe(true);
        expect(doesTheHouseExpect(world.factions.find(f => f.id === faction.id)!, cultivator.id),
            'still expected once entered').toBeNull();

        // AND NOW THE GATE READS THE TOKEN.
        const current = repos.cultivators.getById(cultivator.id)!;
        expect(whatTheGateOfThisHouseSays(game, current, house).way).toBe('on the roll');

        // LEAVING HANDS IT BACK.
        repos.sects.removeMember(faction.id, cultivator.id);
        const left = await game.act('I look around');
        world = game.atHand!;
        expect(holdsTheRobesOf(world.objects, cultivator.id, faction.id)).toBe(false);
        expect(tokenOf(world, cultivator.id)).toBeNull();
        expect(left.narration ?? '').toMatch(/went back to it/);
        expect(whatTheGateOfThisHouseSays(game, repos.cultivators.getById(cultivator.id)!, house).way)
            .toBe('turned away');
    }, 240_000);

    it('cuts a token for somebody promoted onto the rung while at the seat', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'promoted-at-the-seat', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Servant');
        const { faction, seat } = aHouseThatLightsLamps((await game.loadWorld())!)!;

        repos.sects.addMember(faction.id, cultivator.id, 0);
        theHouseHasTheWord(game, { id: cultivator.id, name: cultivator.name }, faction);
        await game.act(`I travel to the ${faction.name}`);
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(seat.name);
        let world = game.atHand!;
        expect(holdsTheRobesOf(world.objects, cultivator.id, faction.id), 'robes at the seat').toBe(true);
        expect(tokenOf(world, cultivator.id), 'a token below the rung that carries one').toBeNull();

        repos.sects.setRank(faction.id, cultivator.id, 1);
        await game.act('I look around');
        world = game.atHand!;
        expect(tokenOf(world, cultivator.id)).toBe(faction.id);
    }, 240_000);

    /**
     * BELOW THE TOKEN RUNG, BY FACE. Rung 0 carries no token and every new
     * disciple starts there, so the gate reads the face: a large house does not
     * know a new arrival's, and somebody at the gate who has dealt with them
     * does. The account written is the ordinary one, and `openLedgerBetween` is
     * one of the two things the trust read counts as having dealt with somebody.
     */
    it('stops a rung-0 disciple in robes whose face nobody at a large house knows, and passes them once somebody does', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'known-by-face', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Servant');
        const opened = (await game.loadWorld())!;

        // A large house - more than one person can hold the faces of - with the
        // most of its own standing at its gate, asked of the world.
        const large = opened.factions
            .filter(f => f.dissolvedOnDay === null && f.seatLocationId !== null)
            .filter(f => howManyAHouseReallyHas(opened, f.id) > A_ROLL_A_PLAYER_COULD_KNOW)
            .map(f => ({
                faction: f,
                seat: opened.locations.find(l => l.id === f.seatLocationId)!,
                atTheGate: opened.npcs.filter(n =>
                    n.status === 'alive' && n.factionId === f.id && n.locationId === f.seatLocationId).length
            }))
            .filter(row => row.seat !== undefined)
            .sort((a, b) => b.atTheGate - a.atTheGate)[0];
        expect(large, 'this world has no large seated house').toBeTruthy();
        const { faction, seat } = large!;

        // Walked there first, so the arrangement is made in the world the read sees.
        await game.act(`I travel to the ${faction.name}`);
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(seat.name);
        repos.sects.addMember(faction.id, cultivator.id, 0);
        theHouseHasTheWord(game, { id: cultivator.id, name: cultivator.name }, faction);
        await game.act('I look around');
        expect(holdsTheRobesOf(game.atHand!.objects, cultivator.id, faction.id), 'entered at the seat').toBe(true);
        await game.act('I put on the robes');
        const world = game.atHand!;
        expect(wearsTheRobesOf(world.objects, cultivator.id, faction.id), 'in the robes').toBe(true);
        expect(tokenOf(world, cultivator.id), 'rung 0 carries a token').toBeNull();

        const current = repos.cultivators.getById(cultivator.id)!;
        const witness = game.present(current).find(row => row.sectId === faction.id);
        expect(witness, 'nobody of the house is at its gate to read a face').toBeTruthy();
        const house = theHouseWhoseGateThisIs(world, seat.name)!;

        const unknown = whatTheGateOfThisHouseSays(game, current, house);
        expect(unknown.way).toBe('stopped and asked');
        expect(unknown.facts.join(' ')).toContain('nobody at the gate knows your face');

        writeOneObligation(repos.db as any, createDebt({
            holderId: witness!.id,
            subjectId: cultivator.id,
            cause: 'saved_life',
            severity: 'serious',
            onDay: 0,
            description: 'Somebody at the gate who has dealt with you.'
        }));
        const known = whatTheGateOfThisHouseSays(game, current, house);
        expect(known.way).toBe('on the roll');
        expect(known.facts.join(' ')).toMatch(/knows your face/);
    }, 240_000);

    it('enters somebody taken on at the seat by one of the house out looking for disciples, on that turn', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'joined-at-the-seat', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Walk-up');
        const opened = (await game.loadWorld())!;
        const ordinal = repos.cultivators.getById(cultivator.id)!.realmOrdinal;

        // A house that would take them, with its own people at its gate.
        const house = opened.factions
            .filter(f => f.dissolvedOnDay === null && f.seatLocationId !== null)
            .filter(f => (getSect(f.id)?.admissionOrdinal ?? Infinity) <= ordinal)
            .map(f => ({
                faction: f,
                seat: opened.locations.find(l => l.id === f.seatLocationId)!,
                atTheGate: opened.npcs.filter(n =>
                    n.status === 'alive' && n.factionId === f.id && n.locationId === f.seatLocationId).length
            }))
            .filter(row => row.seat !== undefined && row.atTheGate > 0)
            .sort((a, b) => b.atTheGate - a.atTheGate)[0];
        expect(house, 'this world has no house that would take them with anybody at its gate').toBeTruthy();
        const { faction, seat } = house!;

        await game.act(`I travel to the ${faction.name}`);
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(seat.name);
        let world = game.atHand!;
        expect(holdsTheRobesOf(world.objects, cultivator.id, faction.id), 'robed off the roll').toBe(false);

        // ARRANGED: one of the house at the gate is out looking for disciples.
        // Nobody joins a house out of thin air; see
        // `nobody-joins-a-house-out-of-thin-air.test.ts`.
        const here = game.worldPlaceOf(repos.cultivators.getById(cultivator.id)!);
        const beside = game.present(repos.cultivators.getById(cultivator.id)!)
            .find(row => row.sectId === faction.id);
        const at = world.npcs.findIndex(n => n.id === beside?.id);
        expect(at, 'nobody of the house is at its gate').toBeGreaterThanOrEqual(0);
        const recruiting = SENDING_REASONS.find(r => r.id === 'sending-to-recruit')!.name.toLowerCase();
        world.npcs[at] = {
            ...world.npcs[at]!,
            locationId: here,
            activity: {
                kind: 'out_with_a_party', note: `Out for the ${faction.name} on ${recruiting}.`, withIds: [],
                sinceDay: Math.floor(world.currentDay), untilDay: Math.floor(world.currentDay) + 150,
                returnTo: here
            }
        };
        game.theWorldMoved();

        const joined = await game.act(`I join the ${faction.name}`);
        expect(repos.sects.getMembership(cultivator.id)?.sectId, 'the join did not take').toBe(faction.id);
        const said = joined.narration ?? '';
        expect(said, 'who took them on was not said').toMatch(/took you on for/);
        expect(said, 'being entered was not said').toMatch(/Entered on the roll/);
        world = game.atHand!;
        expect(holdsTheRobesOf(world.objects, cultivator.id, faction.id)).toBe(true);
    }, 240_000);
});
