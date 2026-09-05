/**
 * What the ground does to being believed.
 *
 * Five claims, and they are the five ways this could have been built wrong:
 *
 *   1. The ordering is recourse, not virtue. Somewhere with a house that
 *      answers for what happens on it beats somewhere with one that does not,
 *      and BOTH beat ground nobody holds at all - which is the catalog's own
 *      argument in `THE_BLOWN_GROUND.whatItMakesTrue` and the opposite of what
 *      a righteous/demonic reading would produce.
 *   2. **There are four ways to be without a holder and only one of them is a
 *      vacuum.** `GroundHolding` resolves four answers and pricing three of
 *      them as the floor invents a vacuum out of a missing row, which that
 *      type's own docstring names as the defect. Clear River Ford is not eleven days
 *      of sand, and a ruin the survey never described is not either.
 *   3. It is a term and never a gate. Nowhere makes an ask certain and nowhere
 *      makes one impossible, and the ground never outweighs standing or a tie.
 *   4. It is about STRANGERS. Somebody who already knows you reads you the same
 *      wherever the two of you are standing.
 *   5. Nothing branches on a house's name, so a house added tomorrow gets the
 *      behaviour off its own alignment column with no code.
 */

import { describe, it, expect } from 'vitest';

import {
    GROUND_MAX,
    groundWeight,
    theGroundUnderYou
} from '../../../src/engine/social-leverage/ground-trust';
import { oddsOf, type AttemptInput, type Party } from '../../../src/engine/social-leverage/an-attempt-to-move-somebody';
import { makeAreaStatus } from '../../../src/engine/world/what-is-true-of-a-place-right-now';
import { makeLocation, type LocationRecord } from '../../../src/engine/world/locations';
import { whoHoldsTheGround } from '../../../src/engine/world/ground-holder';
import { forStream } from '../../../src/engine/cultivation/rng';

// ─────────────────────────────────────────────────────────────────────────
// THE FOUR GROUNDS, READ THROUGH THE REAL CHAIN
// ─────────────────────────────────────────────────────────────────────────
//
// Every one of these goes through `whoHoldsTheGround` against real records
// rather than through a hand-built reading, because the whole subject of this
// file is that the four answers are different and a fixture that fabricates
// one of them cannot show that.

function reading(locations: readonly LocationRecord[], id: string) {
    return theGroundUnderYou(whoHoldsTheGround(locations, id));
}

/** Held, and the holder's alignment decides what happens to somebody wronged. */
function held(factionId: string) {
    return reading(
        [makeLocation({ id: 'g', name: 'somewhere', kind: 'settlement', controllingFactionId: factionId })],
        'g'
    );
}

/** The vacuum. A region that declares nobody holds it - the Drowned Sea. */
function noAuthority() {
    return reading(
        [
            makeLocation({ id: 'r', name: 'The Drowned Sea', kind: 'region', data: { politics: 'no_authority' } }),
            makeLocation({ id: 'g', name: 'Bronze Bell Cliff', kind: 'settlement', parentId: 'r' })
        ],
        'g'
    );
}

/** Clear River Ford: on the register with nobody's name against it, inside a province. */
function noHolderOfRecord() {
    return reading(
        [
            makeLocation({ id: 'r', name: 'The Jade Gorge', kind: 'region' }),
            makeLocation({ id: 'g', name: 'Clear River Ford', kind: 'settlement', parentId: 'r' })
        ],
        'g'
    );
}

/** The survey does not describe it. Ignorance, not a vacuum. */
function unrecorded() {
    return reading(
        [
            makeLocation({ id: 'r', name: 'Somewhere', kind: 'region' }),
            makeLocation({ id: 'g', name: 'A Place Nobody Registered', kind: 'settlement', parentId: 'r' })
        ],
        'g'
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
    it('orders on recourse, so a vacuum sits below a demonic house', () => {
        const ask = 'a_real_favour' as const;
        const w = (g: ReturnType<typeof held>) => groundWeight({ ground: g, ask });

        const righteous = w(held(RIGHTEOUS));
        const neutral = w(held(NEUTRAL));
        const demonic = w(held(DEMONIC));
        const vacuum = w(noAuthority());

        expect(righteous).toBeGreaterThan(neutral);
        expect(neutral).toBeGreaterThan(demonic);
        // The catalog's ruling, and it is a comparison with a VACUUM and not
        // with unheld ground generally: a house that eats its own disciples is
        // still a house that answers a letter, keeps a fixed address and can
        // be arbitrated against. Eleven days of sand is none of those.
        expect(demonic).toBeGreaterThan(vacuum);
    });

    /**
     * THE DEFECT THIS EXISTS TO PIN.
     *
     * `theGroundUnderYou` used to pass `ranked: holding === 'held'` and nothing
     * else, so `no_authority`, `no_holder_of_record` and `unrecorded` all
     * arrived at `whenItIsDoneToOneOfOurs` as an unranked nobody and came back
     * `none`. Measured before the fix: byte-identical `why`, and -0.12 / -0.12
     * / -0.06 / -0.024 across the four asks for all three.
     */
    it('does not price four kinds of unheld ground as one', () => {
        const ask = 'a_real_favour' as const;
        const vacuum = groundWeight({ ground: noAuthority(), ask });
        const noName = groundWeight({ ground: noHolderOfRecord(), ask });
        const silent = groundWeight({ ground: unrecorded(), ask });

        expect(new Set([vacuum, noName, silent]).size).toBe(3);
        expect(noAuthority().why).not.toBe(noHolderOfRecord().why);
        expect(noHolderOfRecord().why).not.toBe(unrecorded().why);
    });

    /**
     * Clear River Ford is inside a province with a survey, a bench and a register, and
     * somebody with no title keeps the fords open. A demonic house has
     * published that it will not answer for its own. Both beat the vacuum;
     * they do not beat it by the same amount, and they are not in that order.
     */
    it('puts ground with no name against it above a house that answers for nobody', () => {
        const ask = 'a_real_favour' as const;
        expect(groundWeight({ ground: noHolderOfRecord(), ask }))
            .toBeGreaterThan(groundWeight({ ground: held(DEMONIC), ask }));
        expect(groundWeight({ ground: held(DEMONIC), ask }))
            .toBeGreaterThan(groundWeight({ ground: noAuthority(), ask }));
    });

    /**
     * A MISSING ROW IS NOT EVIDENCE, SO IT MOVES NOTHING.
     *
     * `AttemptInput.where` already rules this one level up - a caller that does
     * not know where it is weighs nothing - and `GroundHolding`'s own docstring
     * says a caller that reads `unrecorded` as unheld "has invented a vacuum
     * out of a missing row". Zero here is that ruling and not a midpoint.
     */
    it('charges nothing at all for ground the record merely does not describe', () => {
        for (const ask of ['a_courtesy', 'a_real_favour', 'against_their_interest', 'a_betrayal'] as const) {
            expect(groundWeight({ ground: unrecorded(), ask })).toBe(0);
        }
        expect(groundWeight({ ground: unrecorded(), ask: 'a_real_favour' }))
            .toBe(groundWeight({ ground: null, ask: 'a_real_favour' }));
    });

    /**
     * `whoHoldsTheGround` returns a null alignment for a holder the sect
     * catalog cannot place, and says in as many words that this degradation
     * must read as "somebody holds this and I cannot say what kind of house
     * they are" rather than as unheld. Asking `whenItIsDoneToOneOfOurs` about a
     * null alignment answers `none`, which is the floor, which is exactly what
     * that comment forbids.
     */
    it('does not read a holder it cannot place as a vacuum', () => {
        const g = held('sect-a-house-renamed-since-this-world-was-written');
        expect(groundWeight({ ground: g, ask: 'a_real_favour' }))
            .toBeGreaterThan(groundWeight({ ground: noAuthority(), ask: 'a_real_favour' }));
    });

    /** A place in trouble still bites on ground the record says nothing about. */
    it('still counts a bad year where the holder is unknown', () => {
        const troubled = theGroundUnderYou(
            whoHoldsTheGround(
                [
                    makeLocation({ id: 'r', name: 'Somewhere', kind: 'region' }),
                    makeLocation({ id: 'g', name: 'A Place Nobody Registered', kind: 'settlement', parentId: 'r' })
                ],
                'g'
            ),
            [status('famine', { priceMultiplier: 4 })]
        );
        expect(troubled.underDuress).toBe(true);
        expect(groundWeight({ ground: troubled, ask: 'a_real_favour' })).toBeLessThan(0);
    });

    it('weighs nothing at all when the caller does not know where this is', () => {
        expect(groundWeight({ ground: null, ask: 'a_real_favour' })).toBe(0);
        expect(groundWeight({ ground: undefined, ask: 'a_courtesy' })).toBe(0);
    });

    it('is a term and not a gate: nowhere is certain and nowhere is impossible', () => {
        const everywhere = [
            held(RIGHTEOUS), held(NEUTRAL), held(DEMONIC),
            noAuthority(), noHolderOfRecord(), unrecorded()
        ];
        for (const where of everywhere) {
            const odds = oddsOf(attempt({ where })).odds;
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
            - oddsOf(attempt({ where: noAuthority() })).terms.ground;

        const tie = { active: true, strength: 1 };
        const knownGap =
            oddsOf(attempt({ where: held(RIGHTEOUS), theirTie: tie })).terms.ground
            - oddsOf(attempt({ where: noAuthority(), theirTie: tie })).terms.ground;

        expect(strangerGap).toBeGreaterThan(0);
        expect(knownGap).toBe(0);
    });

    it('reaches an ordinary favour and barely reaches a betrayal', () => {
        const ground = noAuthority();
        expect(Math.abs(groundWeight({ ground, ask: 'a_real_favour' })))
            .toBeGreaterThan(Math.abs(groundWeight({ ground, ask: 'a_betrayal' })));
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
        expect(groundWeight({ ground: one, ask: 'a_real_favour' }))
            .toBeLessThan(groundWeight({ ground: quiet, ask: 'a_real_favour' }));
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
        expect(noAuthority().why).toMatch(/nobody|Nobody/);
        // And every one of the four says a different thing, which is half of
        // what the player is owed: a route, not only a lower number.
        const whys = [held(NEUTRAL), noAuthority(), noHolderOfRecord(), unrecorded()]
            .map(g => g.why);
        expect(new Set(whys).size).toBe(4);
        for (const why of whys) expect(why.length).toBeGreaterThan(60);
    });
});

/**
 * WHETHER RECOURSE PROTECTS THE ASKER OR THE TARGET.
 *
 * The design owner: *"I agree, the more lawless somewhere is, the more credible
 * the threat."* One property read two ways rather than two properties - trust
 * asks whether anybody would make a liar pay, a threat asks whether anybody
 * would make the threatener pay, and the answer to both is recourse.
 *
 * Four claims, and they are the four ways this could have been built wrong:
 *
 *   1. It keys on the LEVERAGE, never on a verb. `force` reads one way and
 *      everything else reads the other, through the same field the world
 *      simulation already fills for every NPC manoeuvre.
 *   2. It is not the trust reading negated. A demonic house still DETERS force,
 *      because declining to avenge a member who was outwitted is a statement
 *      about deception; and Clear River Ford is worth less to a threatener than it
 *      costs a stranger.
 *   3. It is still a term. Lawless ground makes a threat more credible and
 *      never certain.
 *   4. A missing row is not evidence in either direction.
 */
describe('the ground under a threat', () => {
    const ask = 'a_real_favour' as const;
    const trust = (g: ReturnType<typeof held>) => groundWeight({ ground: g, ask });
    const threat = (g: ReturnType<typeof held>) =>
        groundWeight({ ground: g, ask, leverage: 'force' });

    it('flips the sign where nobody holds the ground', () => {
        // The vacuum: worst place to be believed, best place to be threatened.
        expect(trust(noAuthority())).toBeLessThan(0);
        expect(threat(noAuthority())).toBeGreaterThan(0);
        // And a house that answers for what happens on it runs the other way.
        expect(trust(held(RIGHTEOUS))).toBeGreaterThan(0);
        expect(threat(held(RIGHTEOUS))).toBeLessThan(0);
    });

    it('reads the leverage and never the verb', () => {
        // Everything that is a claim to be believed reads as trust, including
        // the ones a careless table would have called coercive.
        for (const leverage of
            ['none', 'coin', 'favour', 'debt', 'name', 'sect', 'secret', 'attachment'] as const) {
            expect(groundWeight({ ground: noAuthority(), ask, leverage }), leverage)
                .toBe(trust(noAuthority()));
        }
        // And force alone reads the other way.
        expect(threat(noAuthority())).not.toBe(trust(noAuthority()));
        // Absent leverage is the trust reading, which is what every existing
        // caller relies on.
        expect(groundWeight({ ground: noAuthority(), ask })).toBe(trust(noAuthority()));
    });

    /**
     * THE TWO ROWS A MIRROR WOULD HAVE GOT WRONG.
     */
    it('is not the trust reading with a minus sign in front of it', () => {
        // A demonic house does not avenge a member who was WORKED. That says
        // nothing about force, and the house still holds ground and is still
        // dangerous to cross - so it deters a threat rather than inviting one.
        expect(trust(held(DEMONIC))).toBeLessThan(0);
        expect(threat(held(DEMONIC))).toBeLessThan(0);

        // Clear River Ford: the un-appointed keepers of an unheld ford have more
        // reason to move against violence than to vouch for a stranger.
        expect(threat(noHolderOfRecord())).toBeGreaterThan(0);
        expect(Math.abs(threat(noHolderOfRecord())))
            .toBeLessThan(Math.abs(trust(noHolderOfRecord())));
    });

    it('charges nothing for a missing row in either direction', () => {
        expect(trust(unrecorded())).toBe(0);
        expect(threat(unrecorded())).toBe(0);
    });

    /**
     * The tie damper is about being READ. What makes a threat credible is what
     * would happen to the person making it, and thirty years of acquaintance
     * does not change that.
     */
    it('damps trust with an existing tie and does not damp a threat', () => {
        const known = { ground: noAuthority(), ask, theirTieStrength: 1 };
        expect(groundWeight(known)).toBe(0);
        expect(groundWeight({ ...known, leverage: 'force' as const }))
            .toBe(threat(noAuthority()));
    });

    it('is a term and not a gate, in both directions', () => {
        for (const where of [noAuthority(), held(RIGHTEOUS), noHolderOfRecord()]) {
            for (const leverage of ['force', 'coin'] as const) {
                const odds = oddsOf(attempt({
                    where, approach: { leverage }
                })).odds;
                expect(odds).toBeGreaterThan(0);
                expect(odds).toBeLessThan(1);
            }
        }
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
