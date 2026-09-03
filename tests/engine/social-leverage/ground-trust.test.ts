/**
 * What the ground does to being believed.
 *
 * Four claims, and they are the four ways this could have been built wrong:
 *
 *   1. The ordering is recourse, not virtue. Somewhere with a house that
 *      answers for what happens on it beats somewhere with one that does not,
 *      and BOTH beat ground nobody holds - which is the catalog's own argument
 *      in `THE_BLOWN_GROUND.whatItMakesTrue` and the opposite of what a
 *      righteous/demonic reading would produce.
 *   2. It is a term and never a gate. Nowhere makes an ask certain and nowhere
 *      makes one impossible, and the ground never outweighs standing or a tie.
 *   3. It is about STRANGERS. Somebody who already knows you reads you the same
 *      wherever the two of you are standing.
 *   4. Nothing branches on a house's name, so a house added tomorrow gets the
 *      behaviour off its own alignment column with no code.
 */

import { describe, it, expect } from 'vitest';

import {
    GROUND_MAX,
    groundTrustWeight,
    theGroundUnderYou
} from '../../../src/engine/social-leverage/ground-trust';
import { oddsOf, type AttemptInput, type Party } from '../../../src/engine/social-leverage/an-attempt-to-move-somebody';
import { makeAreaStatus } from '../../../src/engine/world/what-is-true-of-a-place-right-now';
import { makeLocation } from '../../../src/engine/world/locations';
import { whoHoldsTheGround } from '../../../src/engine/world/ground-holder';
import { forStream } from '../../../src/engine/cultivation/rng';

function held(factionId: string | null, holding: 'held' | 'no_holder_of_record' = 'held') {
    const ground = makeLocation({
        id: 'g', name: 'somewhere', kind: 'settlement', controllingFactionId: factionId
    });
    const read = whoHoldsTheGround([ground], 'g');
    return theGroundUnderYou(
        factionId ? read : { ...read, holding, why: 'Nobody holds this.' }
    );
}

function party(over: Partial<Party> = {}): Party {
    return {
        id: 'p', name: 'P', ordinal: 10, charm: 2, factionId: null, alignment: null, ...over
    };
}

function attempt(over: Partial<AttemptInput> = {}): AttemptInput {
    return {
        actor: party({ id: 'actor', ordinal: 10 }),
        subject: party({ id: 'subject', ordinal: 10 }),
        onDay: 0,
        ask: 'a_real_favour',
        rng: forStream('ground', 'test'),
        ...over
    };
}

const RIGHTEOUS = 'sect-sweptground-temple';
const NEUTRAL = 'sect-gleaners-company';
const DEMONIC = 'sect-storm-tyrant-court';

describe('the ground under two people', () => {
    it('orders on recourse, so unheld ground sits below a demonic house', () => {
        const ask = 'a_real_favour' as const;
        const w = (g: ReturnType<typeof held>) => groundTrustWeight({ ground: g, ask });

        const righteous = w(held(RIGHTEOUS));
        const neutral = w(held(NEUTRAL));
        const demonic = w(held(DEMONIC));
        const unheld = w(held(null));

        expect(righteous).toBeGreaterThan(neutral);
        expect(neutral).toBeGreaterThan(demonic);
        // The catalog's ruling: a house that eats its own disciples is still a
        // house that answers a letter.
        expect(demonic).toBeGreaterThan(unheld);
    });

    it('weighs nothing at all when the caller does not know where this is', () => {
        expect(groundTrustWeight({ ground: null, ask: 'a_real_favour' })).toBe(0);
        expect(groundTrustWeight({ ground: undefined, ask: 'a_courtesy' })).toBe(0);
    });

    it('is a term and not a gate: nowhere is certain and nowhere is impossible', () => {
        for (const faction of [RIGHTEOUS, NEUTRAL, DEMONIC, null]) {
            const odds = oddsOf(attempt({ where: held(faction) })).odds;
            expect(odds).toBeGreaterThan(0);
            expect(odds).toBeLessThan(1);
        }
    });

    it('never outweighs standing, a tie, a purse or who somebody is', () => {
        // 0.30 for a realm of standing, 0.30 for a tie at full strength,
        // 0.20 for a purse and 0.18 for a disposition.
        expect(GROUND_MAX).toBeLessThan(0.18);
    });

    it('reads a stranger and stops mattering to somebody who knows you', () => {
        const strangerGap =
            oddsOf(attempt({ where: held(RIGHTEOUS) })).terms.ground
            - oddsOf(attempt({ where: held(null) })).terms.ground;

        const tie = { active: true, strength: 1 };
        const knownGap =
            oddsOf(attempt({ where: held(RIGHTEOUS), theirTie: tie })).terms.ground
            - oddsOf(attempt({ where: held(null), theirTie: tie })).terms.ground;

        expect(strangerGap).toBeGreaterThan(0);
        expect(knownGap).toBe(0);
    });

    it('reaches an ordinary favour and barely reaches a betrayal', () => {
        const ground = held(null);
        expect(Math.abs(groundTrustWeight({ ground, ask: 'a_real_favour' })))
            .toBeGreaterThan(Math.abs(groundTrustWeight({ ground, ask: 'a_betrayal' })));
    });

    it('counts a place in trouble once, however much is running on it', () => {
        const quiet = held(NEUTRAL);
        const one = theGroundUnderYou(
            whoHoldsTheGround(
                [makeLocation({ id: 'g', name: 'somewhere', kind: 'settlement', controllingFactionId: NEUTRAL })],
                'g'
            ),
            [
                status('famine', { priceMultiplier: 4 }),
                status('beast_tide', { dangerDelta: 0.35 }),
                status('war', { stops: ['passage'] })
            ]
        );
        expect(one.underDuress).toBe(true);
        expect(quiet.underDuress).toBe(false);
        expect(groundTrustWeight({ ground: one, ask: 'a_real_favour' }))
            .toBeLessThan(groundTrustWeight({ ground: quiet, ask: 'a_real_favour' }));
    });

    it('reads a status by what it does and never by what it is called', () => {
        // A kind nobody has written and a `stops` list nobody has matched.
        const invented = theGroundUnderYou(
            whoHoldsTheGround(
                [makeLocation({ id: 'g', name: 'somewhere', kind: 'settlement', controllingFactionId: NEUTRAL })],
                'g'
            ),
            [status('a-kind-nobody-has-written', { stops: ['saffron'] })]
        );
        expect(invented.underDuress).toBe(true);

        // And a status that does nothing at all is not a place in trouble.
        const inert = theGroundUnderYou(
            whoHoldsTheGround(
                [makeLocation({ id: 'g', name: 'somewhere', kind: 'settlement', controllingFactionId: NEUTRAL })],
                'g'
            ),
            [status('a-notice-nobody-acted-on')]
        );
        expect(inert.underDuress).toBe(false);
    });

    it('names the route rather than only producing a lower number', () => {
        const there = held(DEMONIC);
        expect(there.why.length).toBeGreaterThan(60);
        expect(held(null).why).toMatch(/nobody|Nobody/);
    });
});

function status(
    kind: string,
    over: { stops?: string[]; priceMultiplier?: number; dangerDelta?: number } = {}
) {
    return makeAreaStatus({
        id: `status-${kind}`,
        areaId: 'g',
        kind,
        statement: 'Something is true of this place.',
        cause: { what: 'something', decidedById: null, factId: null },
        beganOnDay: 0,
        reviewOnDay: 100,
        // A status that stops nothing, costs nothing and endangers nobody
        // changes nothing, which the last case below relies on.
        ...over
    });
}
