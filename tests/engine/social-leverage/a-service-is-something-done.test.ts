/**
 * The rung of the offer ladder that nothing could stand on.
 *
 * `what-they-will-take-instead-of-money.ts` has run
 * `stones < goods < a favour < a service < a hold` since it was written, and
 * four of its five rungs had a store, a write and a read. `a service` had none
 * of the three: the ladder named it, `whereTheOfferLanded` described it -
 * "something done, by you, that they cannot do themselves" - and nothing
 * anywhere in the engine could record that a service had been done.
 *
 * Measured before this: the one changed beast reachable everywhere in the world
 * is on the service rung 93% of the time, so the most available high-end
 * content in the game asked for a thing the player had no way to do.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * 1. A service and a favour are two rungs apart and are not the same record. A
 *    favour is a `favor` row held by whoever did the kindness and is discharged
 *    by being called in; a service is an `oath` row at `service_term` held by
 *    whoever gave their word, and is discharged by the DAYS BEING SERVED.
 * 2. Saying you will do it is not having done it. An open term stands on
 *    nothing - that is the whole defect the write is here to fix, and a read
 *    that counted an open row would reintroduce it.
 * 3. A service done buys one thing. A favour that bought something is settled
 *    `repaid`; a service cannot be, because it is already settled
 *    `oath_fulfilled`, so what it bought is written on the row and the read
 *    drops it afterwards.
 * 4. The length is derived and not chosen. `ORDINARY_DUTY_DAYS / PURSE_REACH`,
 *    which is the repo's unit of work over how far a purse reaches for an ask
 *    of that weight.
 *
 * Red-checked: with `status === 'settled'` dropped from
 * `servicesYouHaveDoneFor`, "a word given stands on nothing until it is
 * served" fails.
 */

import { describe, it, expect } from 'vitest';

import {
    ASK_WEIGHTS_IN_ORDER,
    aServiceSpentOn,
    howHeavyAServiceIs,
    howLongAServiceRuns,
    howLongThisTermRuns,
    isAService,
    servicesDoneForYou,
    servicesYouHaveDoneFor,
    servicesYouOwe,
    theAskThisServiceIsFor,
    theServiceYouGaveYourWordOn,
    theServiceYouWouldSpend,
    undertakingAService,
    whatThisServiceAlreadyBought,
    whatWouldPutYouOnTheServiceRung
} from '../../../src/engine/social-leverage/a-service-is-something-done';
import { ORDINARY_DUTY_DAYS } from '../../../src/engine/encounters/duties';
import { LEVERAGE_ATTEMPT_CONSTANTS } from '../../../src/engine/social-leverage/an-attempt-to-move-somebody';
import {
    createObligation,
    settleObligation,
    type ObligationRecord
} from '../../../src/engine/social/grudges';

const wordGiven = (over: Partial<Parameters<typeof undertakingAService>[0]> = {}) =>
    createObligation(undertakingAService({
        doerId: 'me',
        forWhomId: 'them',
        forWhomName: 'the one on the ledge',
        what: 'Clear whatever is in the upper gorge.',
        ask: 'a_real_favour',
        onDay: 100,
        ...over
    }));

const served = (record: ObligationRecord, onDay = 133): ObligationRecord =>
    settleObligation(record, {
        resolution: 'oath_fulfilled',
        onDay,
        byId: record.holderId,
        note: 'Served out.'
    });

describe('a service is something done', () => {
    describe('what the row is', () => {
        it('is an oath at service_term, held by whoever has to do it', () => {
            const row = wordGiven();
            expect(row.kind).toBe('oath');
            expect(row.cause).toBe('service_term');
            expect(row.holderId).toBe('me');
            expect(row.subjectId).toBe('them');
            expect(isAService(row)).toBe(true);
        });

        /**
         * THE DISTINCTION THE LADDER RESTS ON. A favour row would satisfy none
         * of these: it is `favor`, it carries no term and no day it is due, and
         * nothing about it says work.
         */
        it('names a span of days and a day it is due, which a favour never does', () => {
            const row = wordGiven();
            expect(row.terms).toContain('days');
            expect(row.dueOnDay).toBe(100 + howLongAServiceRuns('a_real_favour'));
        });

        it('is not a service when the row is an ordinary favour', () => {
            const favour = createObligation({
                kind: 'favor',
                holderId: 'me',
                subjectId: 'them',
                cause: 'saved_life',
                severity: 'serious',
                onDay: 100,
                description: 'Pulled them out of it.'
            });
            expect(isAService(favour)).toBe(false);
        });
    });

    describe('how long it runs', () => {
        /**
         * DERIVED, NOT CHOSEN. The unit of work on a board, divided by how far
         * a purse reaches for an ask of that weight - so where money stops
         * reaching, work is what is left, and the less it reaches the more work
         * it is. Asserted against the two constants rather than against the
         * numbers they currently produce, because a change to either should
         * move this and not fail it.
         */
        it('is the unit of work over how far a purse reaches', () => {
            for (const weight of ASK_WEIGHTS_IN_ORDER) {
                expect(howLongAServiceRuns(weight)).toBe(Math.round(
                    ORDINARY_DUTY_DAYS / LEVERAGE_ATTEMPT_CONSTANTS.PURSE_REACH[weight]
                ));
            }
        });

        it('runs longer the heavier the ask it pays for', () => {
            const lengths = ASK_WEIGHTS_IN_ORDER.map(howLongAServiceRuns);
            for (let at = 1; at < lengths.length; at += 1) {
                expect(lengths[at]).toBeGreaterThan(lengths[at - 1]);
            }
        });

        it('reads its own length back off the row rather than off the deadline', () => {
            const row = wordGiven({ ask: 'against_their_interest' });
            expect(theAskThisServiceIsFor(row)).toBe('against_their_interest');
            // A term picked up again after the due day has gone is still the
            // same length of work. Reading `dueOnDay - onDay` would say zero.
            expect(howLongThisTermRuns(row)).toBe(howLongAServiceRuns('against_their_interest'));
        });

        it('weighs the word as heavily as the ask it is for', () => {
            expect(howHeavyAServiceIs('a_courtesy')).toBe('slight');
            expect(howHeavyAServiceIs('a_betrayal')).toBe('unforgivable');
        });
    });

    describe('saying it is not doing it', () => {
        /**
         * THE DEFECT, AS AN ASSERTION. `asking-verbs.ts` used to label any
         * offer phrase that resolved to nothing in the pouch as `a service`, so
         * the second-highest rung of the ladder was reached by typing a
         * sentence. An open term is a word given and it stands on nothing.
         */
        it('a word given stands on nothing until it is served', () => {
            const ledger = [wordGiven()];
            expect(theServiceYouGaveYourWordOn(ledger, 'me', 'them')).not.toBeNull();
            expect(servicesYouHaveDoneFor(ledger, 'me', 'them')).toHaveLength(0);
            expect(theServiceYouWouldSpend(ledger, 'me', 'them')).toBeNull();
        });

        it('a term served out is what stands', () => {
            const ledger = [served(wordGiven())];
            expect(theServiceYouGaveYourWordOn(ledger, 'me', 'them')).toBeNull();
            expect(servicesYouHaveDoneFor(ledger, 'me', 'them')).toHaveLength(1);
        });

        /**
         * A term walked out of is settled too, and by the wrong resolution. It
         * must not be mistaken for one that was served.
         */
        it('a term renounced is not a term served', () => {
            const walked = settleObligation(wordGiven(), {
                resolution: 'renounced',
                onDay: 110,
                note: 'Walked off it.'
            });
            expect(servicesYouHaveDoneFor([walked], 'me', 'them')).toHaveLength(0);
        });

        it('is done for one person and reaches nobody else', () => {
            const ledger = [served(wordGiven())];
            expect(servicesYouHaveDoneFor(ledger, 'me', 'somebody-else')).toHaveLength(0);
            expect(servicesYouHaveDoneFor(ledger, 'somebody-else', 'them')).toHaveLength(0);
        });
    });

    describe('a service done buys one thing', () => {
        it('stops standing once it has bought something', () => {
            const done = served(wordGiven());
            expect(whatThisServiceAlreadyBought(done)).toBeNull();

            const spent = aServiceSpentOn(done, 'a piece of its own body');
            expect(whatThisServiceAlreadyBought(spent)).toBe('a piece of its own body');
            expect(servicesYouHaveDoneFor([spent], 'me', 'them')).toHaveLength(0);
            // Still fulfilled. What was done was done, and the record of it
            // stays in the ledger for the next forty years.
            expect(spent.status).toBe('settled');
            expect(spent.settlement?.resolution).toBe('oath_fulfilled');
        });

        it('cannot be spent twice', () => {
            const once = aServiceSpentOn(served(wordGiven()), 'the first thing');
            const twice = aServiceSpentOn(once, 'the second thing');
            expect(whatThisServiceAlreadyBought(twice)).toBe('the first thing');
        });

        it('spends the oldest one first', () => {
            const ledger = [served(wordGiven({ onDay: 100 })), served(wordGiven({ onDay: 400 }))];
            expect(theServiceYouWouldSpend(ledger, 'me', 'them')?.incurredOnDay).toBe(100);
        });
    });

    /**
     * AGENTS.md: if the engine can answer "what have you done for them", it has
     * to answer "what has anybody done for you". The half that lets the person
     * being asked see what the asker is standing on.
     */
    describe('read both ways', () => {
        it('says what has been done for somebody, by anybody', () => {
            const ledger = [
                served(wordGiven({ doerId: 'me' })),
                served(wordGiven({ doerId: 'a-third-party' }))
            ];
            expect(servicesDoneForYou(ledger, 'them')).toHaveLength(2);
            expect(servicesDoneForYou(ledger, 'me')).toHaveLength(0);
        });

        it('says what somebody has given their word to do and not done', () => {
            const ledger = [wordGiven(), served(wordGiven({ forWhomId: 'another' }))];
            expect(servicesYouOwe(ledger, 'me')).toHaveLength(1);
        });
    });

    /**
     * A refusal that names the medium and stops there leaves the player holding
     * a fact they cannot act on, which is exactly what this rung did for as
     * long as it existed.
     */
    it('names the road and not only the rung', () => {
        const said = whatWouldPutYouOnTheServiceRung('the one on the ledge');
        expect(said).toContain('the one on the ledge');
        expect(said).toMatch(/go and serve the term out/i);
    });
});
