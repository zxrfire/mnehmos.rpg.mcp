/**
 * A compound's rooms are places people are.
 *
 * Every seated house was cut a gatehouse, a forecourt, precincts and rooms, and
 * every one of its people was written at the seat. So the lecture hall was
 * empty, calling for help inside the walls reached nobody, the discipline hall
 * was a name, and being put out did not move anybody.
 *
 * What is pinned, each in the words a player would use:
 *
 *   PEOPLE IN ROOMS   somebody of the house at a thing a room is cut for is in
 *                     that room; everybody else is at the seat. Nobody is lost
 *                     or counted twice between the two readings.
 *   WALKING IN        "I go to the lecture hall" moves the player into it and
 *                     puts the people in it in front of them. "I go back out to
 *                     the forecourt" brings them back to the seat.
 *   A ROOM ELSEWHERE  another house's room is not a road.
 *   PUT OUT           a stranger seen in a room is walked out through the gate
 *                     and is standing at the seat afterwards.
 *   THE SHOUT         reaches the house's people in its other rooms.
 *
 * Red-checked: reading `npcsAt` in `othersPresent` again leaves the lecture
 * hall empty to a player standing in it.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { purposeOf } from '../../src/engine/world/architecture';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import {
    npcsStandingIn,
    npcsWithin,
    whereCompoundsAre,
    type ACompound,
    type WhereCompoundsAre
} from '../../src/engine/world/where-inside-a-house-somebody-is-standing';
import type { LocationRecord } from '../../src/engine/world/locations';
import type { WorldState } from '../../src/engine/world/world-state';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { whetherYouAreWorthTheTrouble } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { heightAloneWouldHideThem } from '../../src/engine/social/presence-recognition';

const WORLD = 'a-xianxia-run';

const adminBefore = process.env.ADMIN_MODE;
beforeAll(() => { process.env.ADMIN_MODE = 'true'; });
afterAll(() => {
    if (adminBefore === undefined) delete process.env.ADMIN_MODE;
    else process.env.ADMIN_MODE = adminBefore;
});

type Turn = { narration: string; toolCalls: { name: string; summary: string; ok: boolean }[] };
const everythingSaid = (turn: Turn) =>
    [turn.narration, ...turn.toolCalls.map(call => call.summary)].join('\n');

/**
 * A house with a lecture hall that has people in it, and the player at its gate.
 *
 * `andAlso` narrows which house, for a test that needs more of one.
 */
async function atTheGateOfAHouseWithATalkOn(
    seed: string,
    andAlso: (world: WorldState, compounds: WhereCompoundsAre, compound: ACompound, hall: LocationRecord) => boolean
        = () => true
) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD, adminMode: true });
    await harness.game.newRun('Prober');
    await harness.game.act('I buy a year of provisions');
    const world = (await harness.game.loadWorld())!;
    const compounds = whereCompoundsAre(world);
    const found = [...compounds.bySeat.values()]
        .sort((a, b) => (a.seat.id < b.seat.id ? -1 : 1))
        .map(compound => ({ compound, hall: compound.rooms.get('lecture_hall') }))
        .find(({ compound, hall }) => hall !== undefined
            && npcsStandingIn(world, hall.id, compounds).length >= 2
            && andAlso(world, compounds, compound, hall));
    expect(found, 'no house in this world has a talk on in its lecture hall').toBeDefined();
    const { compound, hall } = found!;
    const me = harness.game.currentRun().cultivator;
    harness.repos.cultivators.update(me.id, { location: compound.seat.name });
    // PAST THE GATE, in the forecourt: somebody the gate stops stands outside it
    // (`where-in-a-place-somebody-is-standing.ts`), and these are about the rooms behind it.
    const forecourt = theAreasOf(world, compound.seat).areas.find(area => area.for === 'forecourt')!;
    harness.repos.cultivators.standIn(me.id, forecourt.id);
    return { harness, world, compounds, seat: compound.seat, hall: hall!, houseId: compound.houseId, me };
}

describe('a house\'s people, read into its rooms', () => {
    it('puts the people at a room\'s work in that room, and loses nobody between the readings', async () => {
        const harness = await makeGameInWorld({ seed: 'rooms-read', worldSeed: WORLD });
        await harness.game.newRun('Prober');
        const world = (await harness.game.loadWorld())!;
        const compounds = whereCompoundsAre(world);

        let within = 0;
        let inRooms = 0;
        const byPurpose = new Map<string, number>();
        for (const [seatId, compound] of compounds.bySeat) {
            within += npcsWithin(world, seatId, compounds).length;
            let read = npcsStandingIn(world, seatId, compounds).length;
            for (const id of compound.inside) {
                const here = npcsStandingIn(world, id, compounds);
                read += here.length;
                inRooms += here.length;
                const purpose = purposeOf(world.locations.find(row => row.id === id)!) ?? 'precinct';
                if (here.length > 0) byPurpose.set(purpose, (byPurpose.get(purpose) ?? 0) + here.length);
                for (const npc of here) expect(npc.factionId).toBe(compound.houseId);
                // A SEALED OFFICE IS KEPT FROM JUST OUTSIDE IT. The design owner:
                // *"yes, just outside it."* Nobody at the work of their rank is
                // read in behind a locked door they hold; they stand in the place
                // it opens from. (Somebody at the shelves of a sealed archive is
                // at the shelves, and the ruling was about the office.)
                const room = world.locations.find(row => row.id === id)!;
                const atTheirOffice = here.filter(npc => npc.activity?.kind === 'the_work_of_their_rank');
                expect(room.sealed && atTheirOffice.length > 0, `${room.name} has its holder inside a locked door`).toBe(false);
            }
            expect(read, `${seatId}: a person was lost or counted twice`).toBe(npcsWithin(world, seatId, compounds).length);
        }
        // The measure, printed: how many of the houses' people stand in a room.
        console.log(`[rooms] ${inRooms} of ${within} in a room; by room: ${
            [...byPurpose.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(', ')}`);
        expect(byPurpose.get('lecture_hall') ?? 0).toBeGreaterThan(0);
        expect(inRooms).toBeGreaterThan(0);
        expect(inRooms).toBeLessThan(within);
    }, 120_000);
});

describe('walking in and out', () => {
    it('meets the people in the lecture hall only by walking into it, and walks back out to the gate', async () => {
        const { harness, world, compounds, seat, hall, houseId, me } = await atTheGateOfAHouseWithATalkOn('walk-in');
        expect(harness.repos.sects.addMember(houseId, me.id, 0), 'the house has no roll row').not.toBeNull();
        const inTheHall = npcsStandingIn(world, hall.id, compounds).map(npc => npc.id);

        const atTheGate = harness.game.present(harness.game.currentRun().cultivator).map(row => row.id);
        expect(atTheGate.filter(id => inTheHall.includes(id))).toEqual([]);

        const before = harness.game.currentRun().run.elapsedDays;
        const walked = await harness.game.act('I go to the lecture hall') as Turn;
        expect(harness.game.currentRun().cultivator.location, everythingSaid(walked)).toBe(hall.name);
        expect(harness.game.currentRun().run.elapsedDays).toBe(before);
        const inside = harness.game.present(harness.game.currentRun().cultivator).map(row => row.id);
        expect(inside).toEqual(expect.arrayContaining(inTheHall));

        const out = await harness.game.act('I go back out to the forecourt') as Turn;
        expect(harness.game.currentRun().cultivator.location, everythingSaid(out)).toBe(seat.name);
    }, 180_000);

    it('does not send anybody down a road to another house\'s room', async () => {
        const harness = await makeGameInWorld({ seed: 'room-elsewhere', worldSeed: WORLD });
        await harness.game.newRun('Prober');
        const before = harness.game.currentRun();
        const turn = await harness.game.act('I go to the lecture hall') as Turn;
        const after = harness.game.currentRun();
        expect(after.cultivator.location, everythingSaid(turn)).toBe(before.cultivator.location);
        expect(after.run.elapsedDays).toBe(before.run.elapsedDays);
    }, 120_000);

    // ── AND WHEN THE SENTENCE REACHES THE OTHER VERB FOR GOING SOMEWHERE ──
    //
    // Played: a model read "I go to the mission hall" as a site rather than a
    // move, and the site verb answered *there is no thing you meant* about a
    // room thirty paces away holding the only two people in reach. The pattern
    // table reads that sentence as `move/travel`, so nothing below the model
    // could have caught it. A room of the compound underfoot is a place, and
    // which verb a reading picked does not decide whether it exists.
    it('answers a room of this compound whichever verb the reading reached', async () => {
        const { harness, seat, hall, houseId, me } = await atTheGateOfAHouseWithATalkOn('site-route');
        expect(harness.repos.sects.addMember(houseId, me.id, 0), 'the house has no roll row').not.toBeNull();
        const { run, cultivator } = harness.game.currentRun();
        expect(cultivator.location).toBe(seat.name);

        const answered = await harness.game.site(
            run, cultivator, 'thin', hall.name.replace(/^.*: /, ''), 'enter'
        );
        expect(
            harness.game.currentRun().cultivator.location,
            answered.facts.lines.join('\n')
        ).toBe(hall.name);
    }, 180_000);

    // The other half of the same branch: a compound underfoot must not swallow
    // a name that is not one of its rooms. "Hall" is in plenty of them.
    it('still refuses a site it cannot name, standing on a house\'s ground', async () => {
        const { harness, seat } = await atTheGateOfAHouseWithATalkOn('site-route-miss');
        const { run, cultivator } = harness.game.currentRun();
        const answered = await harness.game.site(run, cultivator, 'thin', 'the Hall of Nine Winters', 'enter');
        expect(answered.outcome).not.toBe('executed');
        expect(harness.game.currentRun().cultivator.location).toBe(seat.name);
    }, 180_000);
});

describe('a stranger in a room', () => {
    it('is seen, and walked out through the gate to the seat', async () => {
        const { harness, seat, me } = await atTheGateOfAHouseWithATalkOn('put-out');
        const turn = await harness.game.act('I go to the lecture hall') as Turn;
        const text = everythingSaid(turn);
        expect(text).toMatch(/walks you out through the gate/);
        expect(harness.game.currentRun().cultivator.location, text).toBe(seat.name);
        expect(ledgerAbout(harness.db, me.id).some(row => row.tags.includes('trespassed')), text).toBe(true);
    }, 180_000);

    it('has the house send for somebody from its other rooms when nobody in this one can take them', async () => {
        // Past everybody in the hall, and not so far up that the strongest of
        // them does not register the face at all. Both read off the engine.
        const aRungPastTheHall = (hallOrdinals: readonly number[]): number | null => {
            const strongest = Math.max(...hallOrdinals);
            for (let k = strongest + 1; k < 100; k++) {
                if (whetherYouAreWorthTheTrouble({ theirOrdinal: strongest, yourOrdinal: k }) !== 'beyond_them') continue;
                return heightAloneWouldHideThem(k, strongest) ? null : k;
            }
            return null;
        };
        const { harness, world, compounds, seat, hall, houseId } = await atTheGateOfAHouseWithATalkOn(
            'shout',
            (w, c, compound, room) => {
                const inRoom = npcsStandingIn(w, room.id, c);
                const others = npcsWithin(w, compound.seat.id, c)
                    .filter(npc => npc.factionId === compound.houseId && !inRoom.some(one => one.id === npc.id));
                return others.length > 0 && aRungPastTheHall(inRoom.map(npc => npc.cultivation.realmOrdinal)) !== null;
            }
        );
        const inTheHall = npcsStandingIn(world, hall.id, compounds);
        const elsewhere = npcsWithin(world, seat.id, compounds)
            .filter(npc => npc.factionId === houseId && !inTheHall.some(one => one.id === npc.id));
        expect(elsewhere.length, 'nobody of the house is anywhere else inside').toBeGreaterThan(0);
        const ordinal = aRungPastTheHall(inTheHall.map(npc => npc.cultivation.realmOrdinal));
        expect(ordinal, 'no rung is both past the hall and visible in it').not.toBeNull();
        await harness.game.act(`ADMIN set_realm ordinal=${ordinal}`);

        const turn = await harness.game.act('I go to the lecture hall') as Turn;
        const text = everythingSaid(turn);
        const called = /whoAnsweredTheShout over (\d+) inside the compound/.exec(text);
        expect(called, text).not.toBeNull();
        expect(Number(called![1])).toBeGreaterThan(0);
    }, 180_000);
});
