/**
 * A house's answer is the people in it, and the player is told which of them.
 *
 * The design owner:
 *
 *   > the thing about sects applies to every organization. Sects are an
 *   > amalgamation of what their upper echelon thinks. same for families, some
 *   > can pressure or sell off their daughter, some won't.
 *
 * And on what makes it playable:
 *
 *   > obviously then this makes the bribery systems work. also when you promote
 *   > into those positions it gives you gameplay.
 *
 * ── WHY THIS FILE IS PLAYED RATHER THAN UNIT ─────────────────────────────
 *
 * `whatTheBodyWants` has its own unit tests and they pass whether or not
 * anything calls it. This one types the sentence a player types, and asserts
 * that the three parts of the answer worth more than its scalar SURVIVE THE
 * BOUNDARY:
 *
 *   whoMovedIt   the name of the person it turned on, so a player can go and
 *                deal with them
 *   moved        what their own history with this asker did to it, UNCLAMPED,
 *                so somebody past what a favour can buy is told so
 *   against      who was overruled, so a costly disagreement is not a free one
 *
 * AGENTS.md's most-repeated defect is a value computed and never printed, and
 * the second-most is a module nothing calls. This asserts against both.
 */

import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { makeGameInWorld } from './harness';

/** Everybody the world has standing at a place. */
function npcsAt(world: { npcs: { locationId: string | null; factionId: string | null; name: string; id: string }[] }, locationId: string) {
    return world.npcs.filter(n => n.locationId === locationId);
}

/**
 * Somewhere with somebody on a house's roll standing in it.
 *
 * A match put to somebody who answers to nobody is a real case and it is the
 * WRONG case for this file: with no house there is no room, and the sentence
 * the module returns is correctly "there is nobody to ask". So the target is
 * chosen for having a house, the way a player looking for a match into one
 * would choose.
 */
function aPlaceWithAHousedPerson(world: {
    locations: { id: string; name: string }[];
    npcs: { locationId: string | null; factionId: string | null; name: string; id: string }[];
}) {
    const byPlace = world.locations
        .map(l => ({ location: l, people: npcsAt(world, l.id).filter(n => n.factionId) }))
        .filter(p => p.people.length > 0)
        .sort((a, b) => b.people.length - a.people.length);
    return byPlace[0] ?? null;
}

describe('asking a house what a match would take', () => {
    it('names the person in it the answer turned on, and what moved them', async () => {
        resetCultivationWorlds();
        const { game } = await makeGameInWorld({
            seed: 'the-room', worldSeed: 'world-the-room'
        });
        await game.newRun('Ke Yan');

        const world = (await game.loadWorld())!;
        const spot = aPlaceWithAHousedPerson(world);
        expect(spot, 'no housed person anywhere in the world to propose to').toBeTruthy();

        await game.act(`I travel to ${spot!.location.name}`);
        const here = aPlaceWithAHousedPerson((await game.loadWorld())!);
        const somebody = (here?.location.id === spot!.location.id ? here : spot)!.people[0];

        const result = await game.act(`I propose a match to ${somebody.name}`);
        const said = JSON.stringify(result);

        // ── THE ENGINE'S OWN RECORD ──────────────────────────────────────
        //
        // The mechanical channel carries the whole reading, so a bad narration
        // is a narration bug rather than a lost number.
        expect(said, 'the room never reached the mechanical channel')
            .toMatch(/The room: \d+ deciding, settled by /);
        expect(said, 'the answer did not carry the person it turned on')
            .toMatch(/Turned on .+ \(rung \d+, weight \d+, base -?\d/);
        expect(said, 'moved was computed and dropped').toMatch(/moved -?\d+\.\d+/);
        expect(said, 'who was overruled was not reported').toMatch(/Overruled: /);

        // ── AND THE PLAYER'S OWN SENTENCE ────────────────────────────────
        //
        // Not the same assertion twice: the record is ids and numbers, and this
        // is the half a person reads. One of the three tiers has to have been
        // said in words.
        expect(said, 'the room was recorded but never said to the player').toMatch(
            /the one the room turned on|holds the seat, settled it anyway|every other elder are on the same side/
        );
    }, 120_000);

    it('says there is nobody to ask rather than going quiet, for somebody on no roll', async () => {
        resetCultivationWorlds();
        const { game } = await makeGameInWorld({
            seed: 'no-room', worldSeed: 'world-no-room'
        });
        await game.newRun('Ke Yan');

        const world = (await game.loadWorld())!;
        const loose = world.npcs.find(n => !n.factionId && n.locationId);
        expect(loose, 'nobody unaffiliated anywhere').toBeTruthy();

        const place = world.locations.find(l => l.id === loose!.locationId);
        expect(place, 'their location is not a place').toBeTruthy();
        await game.act(`I travel to ${place!.name}`);

        const result = await game.act(`I propose a match to ${loose!.name}`);
        const said = JSON.stringify(result);
        // Null is not neutrality. A body nobody decides in has to say so.
        expect(said).toMatch(/nobody to ask|no roll|nobody stands|does not decide|no house/i);
    }, 120_000);
});
