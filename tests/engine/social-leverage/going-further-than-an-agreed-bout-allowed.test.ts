/**
 * The price of going further than an agreed bout allowed.
 *
 * The measurement that made this necessary: a spar and a duel were the same
 * event to every line of code downstream of the parser. "I spar with him" and
 * "I pin him" both came out as `subdue`, `seedObligations` keys on the outcome
 * alone, and a killing seeded nothing at all - the resolver is right that the
 * dead hold nothing, and nobody else was ever asked - so a house could lose a
 * member in a friendly bout and the ledger would not contain the fact.
 *
 * Every test here is about MEANING. Not one of them touches a wound, and the
 * first one exists to keep it that way.
 */

import {
    whatFollowsFromTheBout,
    type WhatTheBoutCameTo
} from '../../../src/engine/social-leverage/going-further-than-an-agreed-bout-allowed';

const RIGHTEOUS = { alignment: 'righteous' as const, ranked: true };

function bout(over: Partial<WhatTheBoutCameTo> = {}): WhatTheBoutCameTo {
    return {
        terms: 'agreed',
        outcome: 'capture',
        loserDied: false,
        witnesses: 0,
        theirHouse: RIGHTEOUS,
        ...over
    };
}

describe('the agreement changes nothing about the fight', () => {
    /**
     * The ruling, as a test. The function is handed what the resolver decided
     * and returns what follows; there is no path by which it can report a
     * different outcome, a different death or a different wound, because it
     * returns none of those things.
     */
    it('reports only who holds what, and never what happened', () => {
        const followed = whatFollowsFromTheBout(bout({ outcome: 'crippled' }));
        expect(Object.keys(followed).sort())
            .toEqual(['against', 'brokenPromise', 'howFar', 'note', 'ownHouseCost']);
    });

    /**
     * A bout that stayed inside what was agreed owes nobody anything. Somebody
     * yielded, which is what a bout is for.
     */
    it('charges nothing for a bout that ended the way a bout ends', () => {
        const followed = whatFollowsFromTheBout(bout({ outcome: 'capture' }));
        expect(followed.howFar).toBe('kept');
        expect(followed.against).toBeNull();
        expect(followed.ownHouseCost).toBe(0);
        expect(followed.brokenPromise).toBe(false);
    });

    /**
     * And a withdrawal is a withdrawal whoever agreed to what. Both of them are
     * worse than they were; neither is owed for it.
     */
    it('charges nothing for breaking off', () => {
        for (const terms of ['agreed', 'open'] as const) {
            expect(whatFollowsFromTheBout(bout({ terms, outcome: 'withdrawal' })).howFar)
                .toBe('kept');
        }
    });
});

describe('the same wound, and a different bill', () => {
    /**
     * The requirement in one assertion: identical outcome, identical wound,
     * identical everything the resolver produced, and the agreed bout is worse
     * for the person who did it.
     */
    it('prices a killing in an agreed bout above a killing in an open one', () => {
        const agreed = whatFollowsFromTheBout(bout({ terms: 'agreed', loserDied: true }));
        const open = whatFollowsFromTheBout(bout({ terms: 'open', loserDied: true }));

        expect(agreed.against?.severity).toBe('unforgivable');
        expect(open.against?.severity).toBe('grave');
        expect(agreed.ownHouseCost).toBeGreaterThan(open.ownHouseCost);
        expect(agreed.brokenPromise).toBe(true);
        expect(open.brokenPromise).toBe(false);
    });

    /**
     * `grudges.ts` keeps a blood feud as its own kind rather than as a severe
     * grudge because it is held between lines and expected to be inherited.
     * Both are true of this and of nothing else here.
     */
    it('opens a killing in an agreed bout between lines rather than between people', () => {
        expect(whatFollowsFromTheBout(bout({ loserDied: true })).against?.kind)
            .toBe('blood_feud');
        expect(whatFollowsFromTheBout(bout({ terms: 'open', loserDied: true })).against?.kind)
            .toBe('grudge');
        expect(whatFollowsFromTheBout(bout({ outcome: 'crippled' })).against?.kind)
            .toBe('grudge');
    });

    /** And the same step for a ruining, which is the rung a bout reaches. */
    it('prices a crippling in an agreed bout above a crippling in an open one', () => {
        expect(whatFollowsFromTheBout(bout({ outcome: 'crippled' })).against?.severity)
            .toBe('grave');
        expect(
            whatFollowsFromTheBout(bout({ terms: 'open', outcome: 'crippled' })).against?.severity
        ).toBe('serious');
    });

    /**
     * A death is heavier than a ruining under either set of terms. The scale
     * does not fold at the top.
     */
    it('keeps a killing above a ruining whatever was agreed', () => {
        const order = ['slight', 'serious', 'grave', 'unforgivable'];
        for (const terms of ['agreed', 'open'] as const) {
            const ruined = whatFollowsFromTheBout(bout({ terms, outcome: 'crippled' }));
            const killed = whatFollowsFromTheBout(bout({ terms, loserDied: true }));
            expect(order.indexOf(killed.against!.severity))
                .toBeGreaterThan(order.indexOf(ruined.against!.severity));
        }
    });
});

describe('what the resolver said, read and not reinterpreted', () => {
    /**
     * A destroyed body is not a death and must not enter the ledger as one.
     * The resolver is explicit that the person can still be in the world and
     * that anyone who walks away believing it was a killing is wrong - putting
     * that belief in as a fact is the drift `fromBelief` exists to keep out.
     */
    it('does not read a destroyed body as a killing', () => {
        const followed = whatFollowsFromTheBout(bout({ outcome: 'body_destroyed' }));
        expect(followed.howFar).toBe('ruined');
        expect(followed.against?.cause).toBe('crippled');
    });

    /** A killing is a killing however the outcome was labelled. */
    it('reads the death the survival layer recorded', () => {
        const followed = whatFollowsFromTheBout(bout({ outcome: 'capture', loserDied: true }));
        expect(followed.howFar).toBe('killed');
        expect(followed.against?.cause).toBe('killed_kin');
    });
});

describe('who is left to hold it', () => {
    /**
     * A wanderer answers to nobody, which is most of what being a wanderer is
     * worth - and it is the cheapest version of this in the world. The note
     * says so as a fact about who they were rather than as a discount.
     */
    it('opens nothing where the dead answered to nobody', () => {
        const followed = whatFollowsFromTheBout(bout({ loserDied: true, theirHouse: null }));
        expect(followed.against).toBeNull();
        expect(followed.brokenPromise).toBe(true);
        // The actor's own house still has an opinion. They arranged a bout and
        // came back alone, and that is true whoever the other one was.
        expect(followed.ownHouseCost).toBeGreaterThan(0);
    });

    /** Somebody the house pays by the season is not somebody it invested in. */
    it('opens nothing where the house had nothing invested', () => {
        expect(whatFollowsFromTheBout(bout({
            loserDied: true,
            theirHouse: { alignment: 'righteous', ranked: false }
        })).against).toBeNull();
    });

    /**
     * The alignment split is `whenItIsDoneToOneOfOurs`'s, with one departure
     * this file argues for: a demonic house has no judgement available about a
     * member who was killed after being told the blades were blunted, so what
     * it holds is an ordinary account rather than a verdict on the member.
     */
    it('gives every house something to hold when a promise was broken', () => {
        for (const alignment of ['righteous', 'demonic', 'neutral'] as const) {
            const followed = whatFollowsFromTheBout(bout({
                loserDied: true,
                theirHouse: { alignment, ranked: true }
            }));
            expect(followed.against, alignment).not.toBeNull();
            expect(followed.against!.severity, alignment).toBe('unforgivable');
        }
    });

    /**
     * Take the alignment column away and the file has nothing to say, which is
     * the test AGENTS.md sets for whether something is a real system. The
     * houses genuinely differ about an ordinary fight.
     */
    it('lets the houses disagree about a fight nobody agreed to', () => {
        const notes = (['righteous', 'demonic', 'neutral'] as const).map(alignment =>
            whatFollowsFromTheBout(bout({
                terms: 'open',
                loserDied: true,
                theirHouse: { alignment, ranked: true }
            })).note
        );
        expect(new Set(notes).size).toBe(3);
    });
});

describe('who was standing there', () => {
    /**
     * The load-bearing asymmetry. An arrangement names the actor by itself -
     * the dead one's people know who they went to meet - so an empty courtyard
     * is no protection, and the account opens at full weight with nobody
     * watching. What a crowd changes is what the actor's own house has to have
     * a position on, and that is a secondary cost.
     */
    it('opens the account at full weight with nobody watching', () => {
        const alone = whatFollowsFromTheBout(bout({ loserDied: true, witnesses: 0 }));
        const seen = whatFollowsFromTheBout(bout({ loserDied: true, witnesses: 5 }));
        expect(alone.against?.severity).toBe(seen.against?.severity);
        expect(alone.against?.description).toMatch(/knew who they had gone to meet/);
        expect(seen.ownHouseCost).toBeGreaterThan(alone.ownHouseCost);
    });

    /** Witnesses are priced and capped, not counted without limit. */
    it('does not let a crowd grow without bound', () => {
        const six = whatFollowsFromTheBout(bout({ loserDied: true, witnesses: 6 }));
        const forty = whatFollowsFromTheBout(bout({ loserDied: true, witnesses: 40 }));
        expect(forty.ownHouseCost).toBe(six.ownHouseCost);
    });

    /**
     * A house does not dock a member for winning a duel. Winning duels is most
     * of what it wants from them.
     */
    it('charges the actor\'s own house nothing for a fight nobody agreed to', () => {
        expect(whatFollowsFromTheBout(bout({
            terms: 'open', loserDied: true, witnesses: 6
        })).ownHouseCost).toBe(0);
    });
});

describe('the record a descendant inherits', () => {
    /**
     * The terms come first in the account, because the terms are the content:
     * a reader three generations later inherits this sentence and nothing else,
     * and "they had agreed it was a bout" is the whole reason it is as heavy as
     * it is.
     */
    it('states what was agreed before it states what happened', () => {
        const agreed = whatFollowsFromTheBout(bout({ loserDied: true })).against!;
        expect(agreed.description).toMatch(/agreed to a bout/);
        expect(agreed.tags).toContain('agreed');

        const open = whatFollowsFromTheBout(bout({ terms: 'open', loserDied: true })).against!;
        expect(open.description).toMatch(/neither of them pretended was friendly/);
        expect(open.tags).toContain('open');
    });
});
