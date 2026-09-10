/**
 * Every settlement sentence in the language reached nothing, and one of them
 * spent years.
 *
 * FOUND BY PLAYING, in the social sweep. Measured against the real parser:
 *
 *     "I pay him back"       -> UNCLEAR
 *     "I repay what I owe"   -> UNCLEAR
 *     "I clear the debt"     -> UNCLEAR
 *     "I forgive the debt"   -> UNCLEAR
 *     "I settle my debt"     -> cultivate, and it sat the player down
 *
 * The last is covered by its own test next door. The other four are a blank
 * look on the second half of the oldest lever in the genre: the ledger could
 * already be READ in nine phrasings and could not be ACTED on in any.
 *
 * ── AND THE ENGINE'S ANSWER TO THEM HAD NO CALLER ────────────────────────
 *
 * `whatWouldCloseIt` is the function that says what would discharge one row -
 * `repaid` and `forgiven` for a debt, a longer list for a grudge - and outside
 * its own test nothing in the repo had ever called it. So the ledger could say
 * what was open and never what would end it, which is the only thing a player
 * asking *what do I owe* wants to know next.
 *
 * ── THEY ARE ANSWERED AND NOT PERFORMED, WHICH IS A RULING ───────────────
 *
 * A debt in this world has no number on it. The row that opens when somebody
 * does a thing for you carries terms that read *Unstated, and that is the
 * point. It is called in when it is worth calling in, and not before.* There is
 * no sum to move, and inventing one would be the engine making up a price the
 * record deliberately refuses to carry.
 *
 * What the engine does know is what would END it. So the sentence gets a true
 * answer that names the act - giving back what was given, or whoever is
 * carrying it deciding to let it go - and doing it is the ordinary verbs.
 *
 * ── AND THE LINE DOES NOT CLAIM TO BE THE WHOLE OF IT ────────────────────
 *
 * `whatWouldCloseIt` asks its caller for four facts about the two parties, and
 * one of them - whether the two houses have people who could be bound to each
 * other - is a fact the engine does not hold. The caller passes `false`, which
 * under-reports the heaviest discharge on a heavy account. That is the safe
 * direction to be wrong in only for as long as the line does not say it is
 * exhaustive, so it reads *What would close it: ...* and not *and by nothing
 * else*.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';
import {
    theLedgerAsLines,
    whatStandsBetweenYouAndEverybody
} from '../../src/web/what-stands-between-you-and-everybody';
import {
    whatWouldCloseIt
} from '../../src/engine/social-leverage/what-would-settle-an-account-this-heavy';
import type { ObligationRecord } from '../../src/engine/social/grudges';

const ME = 'me';
const THEM = 'npc-them';

function aRow(over: Partial<ObligationRecord> = {}): ObligationRecord {
    return {
        id: 'ob-1',
        kind: 'debt',
        holderId: ME,
        subjectId: THEM,
        cause: 'other',
        severity: 'serious',
        incurredOnDay: 10,
        triggeringEventId: null,
        description: 'They did it, and kept what it cost to ask.',
        participants: [ME, THEM],
        tags: [],
        terms: 'Unstated, and that is the point.',
        dueOnDay: null,
        status: 'open',
        settlement: null,
        inheritance: [],
        generation: 0,
        originHolderId: ME,
        fromBelief: false,
        recordedOnDay: 10,
        ...over
    } as ObligationRecord;
}

const asAPlayerReadsIt = (rows: readonly ObligationRecord[]): string =>
    theLedgerAsLines(
        whatStandsBetweenYouAndEverybody({
            rows,
            meId: ME,
            nameOf: id => (id === ME ? 'You' : 'Shen Liefeng'),
            whatWouldCloseIt: record => whatWouldCloseIt(record, {
                holderIsAHouse: false,
                subjectIsAHouse: false,
                principalIsStillHere: true,
                couldBeBound: false
            })
        }),
        null
    ).join('\n');

describe('meaning to do something about what you owe', () => {
    it.each([
        'I pay him back',
        'I pay her back',
        'I repay what I owe',
        'I repay my debt',
        'I clear the debt',
        'I clear my debts',
        'I settle my debt',
        'I settle up my account',
        'I discharge my obligation',
        'I forgive the debt',
        'I write off what he owes',
        'I cancel his debt'
    ])('%j reaches the ledger rather than nothing', said => {
        const parsed = parseIntent(said);
        expect(parsed?.action).toBe('oath');
        expect(parsed?.intent).toBe('read');
    });

    /**
     * AND THE WORDS THAT ARE NOT ABOUT AN ACCOUNT. Every verb above is a
     * payment word in one idiom and something else in another, which is why
     * each pattern requires an account noun after it.
     */
    it.each([
        'I clear the path',
        'I clear the rubble',
        'I settle down to cultivate',
        'I square my shoulders',
        'I pay the toll',
        'I pay for the pill'
    ])('%j is not a settlement', said => {
        const parsed = parseIntent(said);
        expect(
            parsed?.action === 'oath' && parsed?.intent === 'read'
        ).toBe(false);
    });
});

describe('and the read says what would close each row', () => {
    it('names the two things that close a debt you carry', () => {
        const said = asAPlayerReadsIt([aRow()]);
        expect(said).toContain('What would close it');
        expect(said).toContain('giving back what was given');
        expect(said).toContain('deciding to let it go');
    });

    it('names something heavier for something heavier', () => {
        const said = asAPlayerReadsIt([
            aRow({ kind: 'grudge', holderId: THEM, subjectId: ME, severity: 'slight' })
        ]);
        expect(said).toContain('somebody acting on it');
    });

    /**
     * IT DOES NOT CLAIM TO BE THE WHOLE LIST, for the reason in the header:
     * one of the four party facts is not known here and is passed false.
     */
    it('does not tell the player there is no other way out of it', () => {
        const said = asAPlayerReadsIt([aRow()]);
        expect(said).not.toContain('nothing else');
    });

    /**
     * AND A ROW THE CALLER ASKS NOTHING ABOUT READS AS IT ALWAYS DID. The hook
     * is optional, so every other caller of this module is untouched.
     */
    it('leaves the line alone where the caller supplies no closings', () => {
        const plain = theLedgerAsLines(
            whatStandsBetweenYouAndEverybody({
                rows: [aRow()],
                meId: ME,
                nameOf: id => (id === ME ? 'You' : 'Shen Liefeng')
            }),
            null
        ).join('\n');
        expect(plain).not.toContain('What would close it');
        expect(plain).toContain('Owed by you to Shen Liefeng');
    });
});

/**
 * ASKING SOMEBODY FOR A THING, SAID TO THEIR FACE.
 *
 * Found in the same sweep and next door to the above, because `give me the
 * manual` parsed as a GIFT with `me` as the recipient - the player handing
 * themselves the manual - and once that was vetoed it reached nothing.
 *
 * `requestPutToSomebody` wants an asking verb and a person, so "I ask him for
 * the manual" worked and always did. The commonest way anybody asks for a thing
 * is to say it to the person's face, with no `ask` in it and no name, because
 * they are already standing there. `askWeightOf` has had `give me` and `lend`
 * on its list of real favours since the request verb was written; the weight
 * was ready and no sentence could get to it.
 */
describe('asking for a thing without saying the word ask', () => {
    it.each([
        ['give me the manual', 'manual'],
        ['hand me the flask', 'flask'],
        ['lend me twenty stones', 'twenty stones'],
        ['can you give me the manual', 'manual'],
        ['spare me a few stones', 'a few stones']
    ])('%j asks for %j', (said, wanted) => {
        const parsed = parseIntent(said);
        expect(parsed?.action).toBe('request');
        expect(parsed?.topic).toBe(wanted);
    });

    /**
     * AND NAMES NOBODY, on purpose. The person is whoever is being spoken to,
     * which `somebodyAtHand` resolves off the last-addressed flag and the
     * nearest face - the same thing an absent target means to `interact` and to
     * `give`. Naming somebody the sentence did not name would be a guess.
     */
    it('names nobody the sentence did not name', () => {
        expect(parseIntent('give me the manual')?.target).toBeUndefined();
    });

    it('is still a gift when it goes the other way', () => {
        expect(parseIntent('I give him the manual')?.action).toBe('give');
        expect(parseIntent('I hand over the stones')?.action).toBe('give');
    });

    /**
     * AND A PRICE MAKES IT A TRADE, which is the guard the gift branch above
     * already carries and this shape has to carry too.
     */
    it('is not a request once a price is named', () => {
        expect(parseIntent('give me the manual for ten stones')?.action).not.toBe('request');
    });
});
