/**
 * Working on a person, and what it leaves behind.
 *
 * The guards here are the design claims, not the arithmetic. Three of them are
 * load-bearing enough that breaking one means the subsystem has stopped being
 * the thing it was asked for:
 *
 *   1. Charm works everywhere. No alignment, no faction and no institution
 *      changes the roll.
 *   2. Romance and using somebody diverge only in the numbers, and the
 *      divergence is whether you ever came back without wanting something.
 *   3. Being turned down and being found out are different injuries, and the
 *      severity written on each says so.
 */

import { describe, expect, it } from 'vitest';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    LEVERAGE_ATTEMPT_CONSTANTS,
    PATIENCE_RUNS_OUT_AFTER_ASKS,
    oddsOf,
    resolveAttempt,
    severityWithHouse,
    whenItIsDoneToOneOfOurs,
    whatTheyDoAboutIt,
    willTheHouseBackThis,
    oddsOfWorkingItOut,
    type AttemptInput,
    type Party
} from '../../../src/engine/social-leverage/index.js';
import { earningsPerYear } from '../../../src/engine/cultivation/origin.js';
import { severityRank } from '../../../src/engine/social/grudges.js';
import type { SectAlignment } from '../../../src/schema/cultivation.js';

function party(over: Partial<Party> = {}): Party {
    return {
        id: 'a',
        name: 'Somebody',
        ordinal: 6,
        charm: 2,
        factionId: null,
        alignment: null,
        ...over
    };
}

function attempt(over: Partial<AttemptInput> = {}): AttemptInput {
    return {
        actor: party({ id: 'actor', name: 'The Asker' }),
        subject: party({ id: 'subject', name: 'The Asked' }),
        onDay: 1000,
        ask: 'a_real_favour',
        rng: forStream('seed', 'test', 1),
        ...over
    };
}

// ─────────────────────────────────────────────────────────────────────────

describe('the attempt is not gated by anybody\'s house', () => {
    it('gives the same odds against every alignment, all else equal', () => {
        const alignments: (SectAlignment | null)[] = ['righteous', 'neutral', 'demonic', null];
        const odds = alignments.map(alignment =>
            oddsOf(attempt({
                subject: party({ id: 'subject', factionId: 'f', alignment })
            })).odds
        );
        expect(new Set(odds).size).toBe(1);
    });

    it('never reads a faction id either', () => {
        const withHouse = oddsOf(attempt({
            subject: party({ id: 'subject', factionId: 'sect-azure-cloud', ranked: true })
        })).odds;
        const without = oddsOf(attempt({ subject: party({ id: 'subject' }) })).odds;
        expect(withHouse).toBe(without);
    });

    it('leaves a door open at both ends - nothing is certain and nothing is impossible', () => {
        const hopeless = oddsOf(attempt({
            actor: party({ id: 'actor', ordinal: 0, charm: 1 }),
            subject: party({ id: 'subject', ordinal: 40 }),
            ask: 'a_betrayal'
        })).odds;
        expect(hopeless).toBeGreaterThanOrEqual(LEVERAGE_ATTEMPT_CONSTANTS.ODDS_FLOOR);

        const stacked = oddsOf(attempt({
            actor: party({ id: 'actor', ordinal: 40, charm: 3 }),
            subject: party({ id: 'subject', ordinal: 0 }),
            ask: 'a_courtesy',
            theirTie: { active: true, strength: 1 },
            theyWantSomethingFromYou: true
        })).odds;
        expect(stacked).toBeLessThanOrEqual(LEVERAGE_ATTEMPT_CONSTANTS.ODDS_CEILING);
    });
});

describe('what is being asked is what makes it hard', () => {
    it('prices a betrayal well below a courtesy from the same person', () => {
        const courtesy = oddsOf(attempt({ ask: 'a_courtesy' })).odds;
        const betrayal = oddsOf(attempt({ ask: 'a_betrayal' })).odds;
        expect(betrayal).toBeLessThan(courtesy);
    });

    it('reads standing off regard, so a nobody asking upward is worse placed', () => {
        const upward = oddsOf(attempt({
            actor: party({ id: 'actor', ordinal: 1 }),
            subject: party({ id: 'subject', ordinal: 20 })
        }));
        const downward = oddsOf(attempt({
            actor: party({ id: 'actor', ordinal: 20 }),
            subject: party({ id: 'subject', ordinal: 1 })
        }));
        expect(upward.terms.standing).toBeLessThan(downward.terms.standing);
    });

    it('does not let discreet leverage survive a hall, and does not touch the open kind', () => {
        const coinAlone = oddsOf(attempt({ approach: { leverage: 'coin', audience: 'alone' } }));
        const coinSeen = oddsOf(attempt({ approach: { leverage: 'coin', audience: 'peers' } }));
        expect(coinSeen.terms.room).toBeLessThan(coinAlone.terms.room);

        const nameAlone = oddsOf(attempt({ approach: { leverage: 'name', audience: 'alone' } }));
        const nameSeen = oddsOf(attempt({ approach: { leverage: 'name', audience: 'peers' } }));
        expect(nameSeen.terms.room).toBe(nameAlone.terms.room);
    });
});

/**
 * Money on the table used to be named, refused without a figure, and debited
 * on a take - and it did not appear in the odds at all. The player spent stones
 * and bought nothing, which is the invisible kind of softening: the world's
 * answer was identical whether they put down a purse or nothing.
 *
 * The claims below are `docs/world/things/items.md` and `docs/world/things/economy.md` stated
 * as arithmetic rather than as tuning bars.
 */
describe('what a purse buys, and what it does not', () => {
    /** Coin on the table, alone, against somebody well inside cash's reach. */
    function bribe(stones: number, over: Partial<AttemptInput> = {}) {
        return oddsOf(attempt({
            ask: 'a_courtesy',
            approach: { leverage: 'coin', audience: 'alone' },
            stonesOffered: stones,
            ...over
        }));
    }

    it('moves the odds at all, which is the whole defect', () => {
        expect(bribe(600).odds).toBeGreaterThan(bribe(0).odds);
        expect(bribe(600).terms.purse).toBeGreaterThan(0);
        expect(bribe(0).terms.purse).toBe(0);
    });

    it('is on the table only when coin is what is on the table', () => {
        // The same figure in the same sentence behind a different lever is not
        // a sum anybody put down, and `stonesSpent` agrees: stones are only
        // ever charged on a coin approach.
        expect(oddsOf(attempt({
            ask: 'a_courtesy', approach: { leverage: 'name' }, stonesOffered: 5000
        })).terms.purse).toBe(0);
    });

    it('saturates, because past a point the problem is not the price', () => {
        const theirYear = earningsPerYear(6);
        const one = bribe(Math.round(theirYear)).terms.purse;
        const ten = bribe(Math.round(theirYear * 10)).terms.purse;
        const thousand = bribe(Math.round(theirYear * 1000)).terms.purse;

        // A year of their own income is half the ceiling, by construction.
        expect(one).toBeCloseTo(LEVERAGE_ATTEMPT_CONSTANTS.PURSE_MAX / 2, 3);
        // Ten years is worth a good deal more than one. A thousand is worth
        // barely more than ten, and nothing can pass the ceiling.
        expect(ten).toBeGreaterThan(one);
        expect(thousand - ten).toBeLessThan(ten - one);
        expect(thousand).toBeLessThan(LEVERAGE_ATTEMPT_CONSTANTS.PURSE_MAX);
    });

    it('is worth less to somebody who earns more, at the same figure', () => {
        const guard = bribe(600, { subject: party({ id: 'subject', ordinal: 2 }) }).terms.purse;
        const elder = bribe(600, { subject: party({ id: 'subject', ordinal: 40 }) }).terms.purse;
        expect(elder).toBeLessThan(guard);
    });

    it('never outweighs who somebody is', () => {
        // The ceiling on the whole term is under one realm of standing
        // (RUNG_CLAMP * PER_RUNG) and under an existing tie at full strength
        // (TIE_WEIGHT). A purse is a term and is never THE term, which is the
        // line between a world where money helps and a world that is bought.
        expect(LEVERAGE_ATTEMPT_CONSTANTS.PURSE_MAX).toBeLessThan(0.3);
    });

    it('buys the ordinary favour, and does not buy a betrayal', () => {
        const enormous = 1_000_000;
        const byAsk = (['a_courtesy', 'a_real_favour', 'against_their_interest', 'a_betrayal'] as const)
            .map(ask => bribe(enormous, { ask }).terms.purse);

        // Strictly decreasing: what money reaches shrinks as what is being
        // asked stops being the kind of thing money is the medium for.
        for (let i = 1; i < byAsk.length; i++) {
            expect(byAsk[i]).toBeLessThan(byAsk[i - 1]);
        }
        // At the far end it is a door left open rather than a price. An
        // unlimited purse is worth about one point of a percent, because
        // "typically does not" is not "never".
        expect(byAsk[3]).toBeGreaterThan(0);
        expect(byAsk[3]).toBeLessThan(0.02);
    });

    it('cannot turn a betrayal into a formality at any figure', () => {
        function stacked(stonesOffered?: number) {
            return oddsOf(attempt({
                actor: party({ id: 'actor', ordinal: 40, charm: 3 }),
                subject: party({ id: 'subject', ordinal: 0 }),
                ask: 'a_betrayal',
                approach: { leverage: 'coin', audience: 'alone' },
                theirTie: { active: true, strength: 1 },
                theyWantSomethingFromYou: true,
                ...(stonesOffered === undefined ? {} : { stonesOffered })
            })).odds;
        }
        // Everything else that helps, plus every stone in the world, and the
        // money is worth about a percent of it.
        expect(stacked(10_000_000) - stacked()).toBeLessThan(0.011);
    });
});

describe('a failure leaves a mark somebody can read', () => {
    function forceFailure(over: Partial<AttemptInput> = {}) {
        // Hopeless on purpose: the odds floor is 2%, so a first roll above it
        // fails deterministically whatever the stream produces after.
        return resolveAttempt(attempt({
            actor: party({ id: 'actor', name: 'The Asker', ordinal: 0, charm: 1 }),
            subject: party({
                id: 'subject', name: 'The Asked', ordinal: 40,
                factionId: 'f', alignment: 'righteous', ranked: true
            }),
            ask: 'a_betrayal',
            rng: forStream('seed', 'fail', 7),
            ...over
        }));
    }

    it('leaves them knowing exactly what was tried', () => {
        const result = forceFailure();
        expect(['refused', 'reported']).toContain(result.outcome);
        expect(result.marks.theyKnowWhatYouTried).toBe(true);
    });

    // ── A REFUSAL IS NOT AUTOMATICALLY AN OFFENCE ────────────────────────
    //
    // Ruled by the design owner. These four tests used to assert the opposite
    // and were measuring the defect: every refused approach wrote a -0.1
    // grudge, which takes a COURTESY - the act the refusal advises - from
    // about 29% to about 9%. Being told no once made the cheapest lever in the
    // game three times harder, for good.

    it('leaves nothing behind when the asking was fine and the answer was no', () => {
        // Asked well, asked once, nothing on the table but the asking.
        expect(forceFailure().marks.obligation).toBeNull();
    });

    it('opens the grudge on the AGGRIEVED side when the ASK was the wrong thing to do', () => {
        // Money for a betrayal. `items.md`: above the line cash is not the
        // medium, and offering it reads as not understanding what you are
        // looking at.
        const result = forceFailure({ approach: { leverage: 'coin' } });
        expect(result.marks.obligation!.holderId).toBe('subject');
        expect(result.marks.obligation!.subjectId).toBe('actor');
    });

    it('reads coercion as an offence whatever was asked for', () => {
        for (const leverage of ['force', 'secret'] as const) {
            expect(forceFailure({ approach: { leverage } }).marks.obligation).not.toBeNull();
        }
        // And an attachment put down and turned away is not one.
        expect(forceFailure({ approach: { leverage: 'attachment' } }).marks.obligation).toBeNull();
    });

    it('lets patience run out from repetition rather than from the first no', () => {
        expect(forceFailure({ timesAskedBefore: 1 }).marks.obligation).toBeNull();
        expect(forceFailure({ timesAskedBefore: PATIENCE_RUNS_OUT_AFTER_ASKS }).marks.obligation)
            .not.toBeNull();
    });

    // ── AND THE OTHER WAY: THE REFUSAL CAN BE THE WRONG THING ────────────

    const pressingAndBound = {
        askersNeedIsPressing: true,
        theirHoldOnItIsMerelyReserved: true,
        theirTie: { active: true, strength: 0.4 }
    } as const;

    it('the asker holds the grudge when a bound refuser kept back what could not wait', () => {
        const result = forceFailure(pressingAndBound);
        expect(result.marks.obligation!.holderId).toBe('actor');
        expect(result.marks.obligation!.subjectId).toBe('subject');
        expect(result.marks.obligation!.tags).toContain('refused_a_present_need');
    });

    it('needs all of pressing, reserved and bound - any one missing is an ordinary no', () => {
        expect(forceFailure({ ...pressingAndBound, askersNeedIsPressing: false })
            .marks.obligation).toBeNull();
        expect(forceFailure({ ...pressingAndBound, theirHoldOnItIsMerelyReserved: false })
            .marks.obligation).toBeNull();
        // Bound is read off rows: no shared house, no tie, no open ledger.
        expect(forceFailure({ ...pressingAndBound, theirTie: null }).marks.obligation).toBeNull();
    });

    it('is no wrong at all where the answer was never theirs to give', () => {
        // `immortal-items.ts`: arithmetic rather than a lever. A body that
        // needs a quorum to release one has not wronged anybody.
        expect(forceFailure({ ...pressingAndBound, theAnswerWasTheirsToGive: false })
            .marks.obligation).toBeNull();
    });

    it('writes a refusal no heavier than serious - it is an embarrassment, not an injury', () => {
        for (const leverage of ['coin', 'force', 'secret'] as const) {
            const result = forceFailure({ approach: { leverage } });
            expect(severityRank(result.marks.obligation!.severity))
                .toBeLessThanOrEqual(severityRank('serious'));
        }
    });

    it('records a description a stranger could still read in two centuries', () => {
        const result = forceFailure({ approach: { leverage: 'coin' } });
        expect(result.marks.obligation!.description).toContain('The Asker');
        expect(result.marks.obligation!.description).toContain('The Asked');
        expect(result.marks.obligation!.description).toContain('money on the table');
    });

    it('costs time whether or not it lands', () => {
        expect(forceFailure().days).toBeGreaterThan(1);
    });
});

describe('an attachment is a tie, and its two halves are allowed to disagree', () => {
    /**
     * The first seed on which the attempt lands cleanly.
     *
     * Stacked in the actor's favour and then swept, rather than pinned to one
     * seed: the tie is what is under test, and a test that breaks because a
     * term moved by a hundredth is measuring the tuning table instead.
     */
    function landed(over: Partial<AttemptInput> = {}) {
        for (let seed = 0; seed < 200; seed++) {
            const result = resolveAttempt(attempt({
                actor: party({ id: 'actor', name: 'The Asker', ordinal: 30, charm: 3 }),
                subject: party({ id: 'subject', name: 'The Asked', ordinal: 2 }),
                approach: { leverage: 'attachment', audience: 'alone' },
                theirTie: { active: true, strength: 0.5 },
                theyWantSomethingFromYou: true,
                ...over,
                rng: forStream('seed', 'land', seed)
            }));
            if (result.outcome === 'taken') return result;
        }
        throw new Error('the attempt never landed in two hundred seeds');
    }

    it('writes a real relationship rather than a flag', () => {
        const result = landed({ ask: 'a_courtesy' });
        expect(result.marks.tie).not.toBeNull();
        expect(result.marks.tie!.theirs.strength).toBeGreaterThan(0.5);
        expect(result.marks.tie!.event.onDay).toBe(1000);
    });

    it('grows only their side when something was asked of it', () => {
        const asked = landed({ ask: 'against_their_interest', yourTie: { active: true, strength: 0.1 } });
        expect(asked.marks.tie!.theirs.strength).toBeGreaterThan(0.5);
        expect(asked.marks.tie!.yours.strength).toBe(0.1);
    });

    it('grows your side too when you asked for nothing - which is the whole difference', () => {
        const courted = landed({ ask: 'a_courtesy', yourTie: { active: true, strength: 0.1 } });
        expect(courted.marks.tie!.yours.strength).toBeGreaterThan(0.1);
    });

    it('marks the one-way version as something discoverable later', () => {
        const used = landed({ ask: 'against_their_interest', yourTie: { active: true, strength: 0 } });
        expect(used.marks.unspoken).not.toBeNull();
        expect(used.marks.unspoken!.theirStrength)
            .toBeGreaterThan(used.marks.unspoken!.yourStrength);
    });

    it('does not mark a mutual one', () => {
        const mutual = landed({ ask: 'a_courtesy', yourTie: { active: true, strength: 0.6 } });
        expect(mutual.marks.unspoken).toBeNull();
    });
});

describe('being used and finding out is the heavier injury', () => {
    it('can reach grave and unforgivable, which a refusal never does', () => {
        const heavy = whatTheyDoAboutIt({
            truth: {
                heldById: 'actor', aboutId: 'subject',
                theirStrength: 0.9, yourStrength: 0,
                ask: 'a_betrayal', audience: 'alone', formedOnDay: 0
            },
            onDay: 4000,
            actorName: 'The Asker',
            subjectName: 'The Asked',
            subjectAlignment: null,
            subjectRanked: false,
            subjectFactionId: null
        });
        expect(heavy.grudge.severity).toBe('unforgivable');
        expect(heavy.grudge.cause).toBe('betrayal');
        expect(heavy.grudge.holderId).toBe('subject');
    });

    it('says how many years it had been running, in the record itself', () => {
        const out = whatTheyDoAboutIt({
            truth: {
                heldById: 'actor', aboutId: 'subject',
                theirStrength: 0.7, yourStrength: 0.1,
                ask: 'against_their_interest', audience: 'few', formedOnDay: 0
            },
            onDay: 365 * 11,
            actorName: 'The Asker',
            subjectName: 'The Asked',
            subjectAlignment: 'righteous',
            subjectRanked: true,
            subjectFactionId: 'f'
        });
        expect(out.grudge.description).toMatch(/11 years/);
    });

    it('rises with time and jumps when the attachment is actually spent', () => {
        const base = {
            truth: {
                heldById: 'a', aboutId: 'b', theirStrength: 0.8, yourStrength: 0.1,
                ask: 'a_real_favour' as const, audience: 'few' as const, formedOnDay: 0
            },
            onDay: 0,
            rng: forStream('s', 'd', 1)
        };
        const oneYear = oddsOfWorkingItOut({ ...base, daysElapsed: 365 });
        const twentyYears = oddsOfWorkingItOut({ ...base, daysElapsed: 365 * 20 });
        const spent = oddsOfWorkingItOut({ ...base, daysElapsed: 365, justSpent: true });

        expect(twentyYears).toBeGreaterThan(oneYear);
        expect(spent).toBeGreaterThan(oneYear);
        // And it never becomes certain. Somebody dying still wrong about it is
        // a legitimate outcome and the commonest one.
        expect(twentyYears).toBeLessThan(1);
    });

    it('is likelier when the attachment was never returned', () => {
        const shared = { onDay: 0, daysElapsed: 365 * 5, rng: forStream('s', 'd', 1) };
        const unreturned = oddsOfWorkingItOut({
            ...shared,
            truth: {
                heldById: 'a', aboutId: 'b', theirStrength: 0.9, yourStrength: 0,
                ask: 'a_real_favour', audience: 'few', formedOnDay: 0
            }
        });
        const returned = oddsOfWorkingItOut({
            ...shared,
            truth: {
                heldById: 'a', aboutId: 'b', theirStrength: 0.9, yourStrength: 0.9,
                ask: 'a_real_favour', audience: 'few', formedOnDay: 0
            }
        });
        expect(unreturned).toBeGreaterThan(returned);
    });
});

describe('the houses differ in what they do, not in what they allow', () => {
    it('a righteous house will not put its hand to the instrument, and will to a purse', () => {
        expect(willTheHouseBackThis('righteous', 'attachment', 'a_betrayal')).toBe('forbidden');
        expect(willTheHouseBackThis('righteous', 'secret', 'a_real_favour')).toBe('forbidden');
        expect(willTheHouseBackThis('righteous', 'coin', 'a_betrayal')).toBe('tolerated');
    });

    it('a demonic house funds exactly what a righteous one refuses', () => {
        expect(willTheHouseBackThis('demonic', 'attachment', 'a_betrayal')).toBe('supplied');
        expect(willTheHouseBackThis('demonic', 'secret', 'against_their_interest')).toBe('supplied');
    });

    it('a neutral house prices it instead of taking a position', () => {
        expect(willTheHouseBackThis('neutral', 'attachment', 'a_betrayal')).toBe('priced');
    });

    it('and the two answers do not have to match: demonic prices its own victim', () => {
        const demonic = whenItIsDoneToOneOfOurs({
            alignment: 'demonic', ranked: true, wasAnAttachment: true, ask: 'a_betrayal'
        });
        expect(demonic.response).toBe('the_member_is_priced');
        expect(demonic.houseIsAParty).toBe(false);
        expect(demonic.severityFloor).toBeNull();

        const righteous = whenItIsDoneToOneOfOurs({
            alignment: 'righteous', ranked: true, wasAnAttachment: true, ask: 'a_betrayal'
        });
        expect(righteous.response).toBe('taken_up');
        expect(righteous.houseIsAParty).toBe(true);
        expect(righteous.severityFloor).toBe('grave');
    });

    it('a body with no interest in private business does nothing at all', () => {
        expect(whenItIsDoneToOneOfOurs({
            alignment: null, ranked: false, wasAnAttachment: true, ask: 'a_betrayal'
        }).response).toBe('none');
        // Nor for somebody its house has nothing invested in.
        expect(whenItIsDoneToOneOfOurs({
            alignment: 'righteous', ranked: false, wasAnAttachment: true, ask: 'a_betrayal'
        }).response).toBe('none');
    });

    it('a house floor only ever raises a severity, never lowers one', () => {
        expect(severityWithHouse('unforgivable', 'serious')).toBe('unforgivable');
        expect(severityWithHouse('slight', 'grave')).toBe('grave');
        expect(severityWithHouse('serious', null)).toBe('serious');
    });
});

describe('the bribe that buys somebody who then owns you back', () => {
    it('writes a debt pointing the other way when the attempt is turned', () => {
        // Somebody far above, asked for a betrayal: the turn odds are high.
        let turned = null;
        for (let seed = 0; seed < 60 && !turned; seed++) {
            const result = resolveAttempt(attempt({
                actor: party({ id: 'actor', name: 'The Asker', ordinal: 4 }),
                subject: party({ id: 'subject', name: 'The Asked', ordinal: 24 }),
                ask: 'a_betrayal',
                approach: { leverage: 'coin' },
                theirTie: { active: true, strength: 0.9 },
                theyWantSomethingFromYou: true,
                rng: forStream('seed', 'turn', seed)
            }));
            if (result.outcome === 'turned') turned = result;
        }
        expect(turned, 'no turned outcome in sixty seeds').not.toBeNull();
        expect(turned!.marks.counterObligation).not.toBeNull();
        // The ACTOR carries it. A debt is owed by its holder.
        expect(turned!.marks.counterObligation!.holderId).toBe('actor');
        expect(turned!.marks.counterObligation!.kind).toBe('debt');
        expect(turned!.marks.theyKnowWhatYouTried).toBe(true);
    });
});

describe('it is deterministic, which is the rule that outranks all of this', () => {
    it('gives byte-identical results from the same seed and the same state', () => {
        const once = resolveAttempt(attempt({ rng: forStream('run', 'x', 1) }));
        const twice = resolveAttempt(attempt({ rng: forStream('run', 'x', 1) }));
        expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
    });
});
