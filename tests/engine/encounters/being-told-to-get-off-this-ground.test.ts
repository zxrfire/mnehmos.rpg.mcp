/**
 * Somebody is already on this ground, and they tell you to get off it.
 *
 * The owner: *"they tell the guy to get out of their ruin or dao ground, he says
 * yes or no, if no then fight"*, *"I mean even an unowned ruin"*, and telling
 * people to get lost is ordinary - so what is pinned is that the demand is made
 * on ground worth being first on and nowhere else, that nobody makes it to
 * somebody well above them, and that what refusing looks like is read off the
 * same distribution the world's own year draws from.
 *
 * RED-CHECKED. Reading the ground off a mastery threshold again turns the town
 * case red;
 * dropping `WHAT_MAKES_THEM_THINK_BETTER_OF_IT` turns the strong-arrival case
 * red; reading the demand off one person rather than their numbers turns the
 * refusing case red.
 */
import { describe, it, expect } from 'vitest';

import { makeLocation } from '../../../src/engine/world/locations.js';
import {
    theyTellYouToLeave,
    whatRefusingLooksLike,
    whatGoingCosts,
    type SomebodyStandingThere
} from '../../../src/engine/encounters/being-told-to-get-off-this-ground.js';

const ruin = makeLocation({ id: 'loc-the-fallen-wall', name: 'Fallen Rampart', kind: 'ruin' });
// A town, and a rich one: the mastery threshold on a market square is what let
// a player be told to clear off the ground they opened the game standing on.
const town = makeLocation({
    id: 'loc-green-water', name: 'Emerald Water City', kind: 'settlement',
    thresholds: { entry: 0, survival: 0, operational: 0, mastery: 32 }
});
const vein = makeLocation({ id: 'loc-the-deep-vein', name: 'The Deep Vein', kind: 'vein' });
const daoGround = makeLocation({
    id: 'loc-dao-ground-tomb-slash-ice', name: 'Tomb-Slash Ice', kind: 'wilds', tags: ['dao-ground']
});

function person(id: string, ordinal: number, factionId: string | null = null): SomebodyStandingThere {
    return { id, name: id, ordinal, factionId, factionName: factionId === null ? null : 'Azure Cloud Pavilion' };
}

describe('whether they say anything at all', () => {
    const arrival = person('the arrival', 14);

    it('is said on ground somebody would be first on, and the claim is being there', () => {
        const demand = theyTellYouToLeave({
            here: [person('first', 16), person('second', 12)], arrival, place: ruin
        });
        expect(demand).not.toBeNull();
        expect(demand!.saidBy.id).toBe('first');
        expect(demand!.theirSide).toHaveLength(2);
        expect(demand!.line).toContain('Fallen Rampart');
        expect(demand!.line).toContain('here first');
    });

    it('is not said in a town, whatever the square is worth', () => {
        expect(theyTellYouToLeave({ here: [person('a', 16)], arrival, place: town })).toBeNull();
    });

    it('is said on a vein and on a dao ground, which are things people work', () => {
        expect(theyTellYouToLeave({ here: [person('a', 16)], arrival, place: vein })).not.toBeNull();
        expect(theyTellYouToLeave({ here: [person('a', 16)], arrival, place: daoGround })).not.toBeNull();
    });

    it('is not said to somebody well above them, and is said to somebody who is not', () => {
        expect(theyTellYouToLeave({ here: [person('a', 12)], arrival: person('big', 30), place: ruin })).toBeNull();
        expect(theyTellYouToLeave({ here: [person('a', 12)], arrival: person('near', 13), place: ruin })).not.toBeNull();
    });

    it('is not said by nobody', () => {
        expect(theyTellYouToLeave({ here: [arrival], arrival, place: ruin })).toBeNull();
    });
});

describe('what refusing looks like', () => {
    const arrival = person('the arrival', 14);

    it('reads their numbers, not just their best', () => {
        const alone = theyTellYouToLeave({ here: [person('a', 16)], arrival, place: ruin })!;
        const crowd = theyTellYouToLeave({
            here: [person('a', 16), person('b', 15), person('c', 14), person('d', 13)], arrival, place: ruin
        })!;
        const one = whatRefusingLooksLike({ demand: alone, arrival, place: ruin, peopleNearby: false });
        const many = whatRefusingLooksLike({ demand: crowd, arrival, place: ruin, peopleNearby: false });
        expect(many.theirHeight).toBeGreaterThan(one.theirHeight);
        // AND NUMBERS DO NOT ONLY MEAN A KILLING. Four people with somebody at
        // their mercy mostly take what they carry and let them walk - the
        // shakedown branch - so what rises with numbers is the two together.
        expect(many.mix.killed + many.mix.shakedown).toBeGreaterThan(one.mix.killed + one.mix.shakedown);
        expect(many.mix.shakedown).toBeGreaterThan(one.mix.shakedown);
        expect(many.line).toContain('4 of them');
    });

    it('says it in figures and predicts nothing', () => {
        const demand = theyTellYouToLeave({ here: [person('a', 16)], arrival, place: ruin })!;
        const read = whatRefusingLooksLike({ demand, arrival, place: ruin, peopleNearby: true });
        expect(read.mix.killed + read.mix.shakedown + read.mix.bothWounded
            + read.mix.fled + read.mix.publicBrawl + read.mix.brokeOff).toBeCloseTo(1, 5);
        expect(read.line).toMatch(/times in a hundred/);
    });

    it('costs the one who goes a slight, and nothing else', () => {
        expect(whatGoingCosts().standing).toBeLessThan(0);
        expect(whatGoingCosts().standing).toBeGreaterThan(-0.2);
    });
});
