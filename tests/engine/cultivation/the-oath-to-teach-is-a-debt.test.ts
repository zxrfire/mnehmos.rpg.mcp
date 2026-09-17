/**
 * The oath to teach counts as a debt, and it weighs on the master.
 *
 * The design owner: *"the oath to teach counts as a debt. It affects the
 * master's breakthroughs and his dao heart."* Pinned here:
 *
 *   A DEBT      an open `teaching_term` oath the asked person swore about the
 *               asker counts in the resolver's `owed` term the way a debt does,
 *               and no other oath does.
 *   KEPT        a master who has given attention within
 *               `THE_OATH_TO_TEACH_IS_NEGLECTED_AFTER_DAYS` carries nothing for
 *               the oath at a crossing, from the ledger or from the ties.
 *   NEGLECTED   past it, the oath is an unfinished account on the master's dao
 *               heart, by the same rule for a ledger row and for a world tie.
 *   THE MASTER  the disciple the oath is about carries nothing for it.
 *
 * Red-checked: dropping `theySworeToTeachYou` from `owedYourWay` fails the debt
 * block, and dropping the teaching-term branch from the ledger read fails the
 * kept and disciple arms, because the oath is then counted either way round.
 */

import { describe, expect, it } from 'vitest';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { oddsOf, type AttemptInput, type Party } from '../../../src/engine/social-leverage/index.js';
import { createDebt, createOath } from '../../../src/engine/social/grudges.js';
import {
    THE_OATH_TO_TEACH_IS_NEGLECTED_AFTER_DAYS,
    whatACrossingAsksOfTheDaoHeart,
    whatNeglectedDisciplesAskOfTheDaoHeart,
    whetherTheOathToTeachIsKept
} from '../../../src/engine/cultivation/what-a-crossing-asks-of-the-dao-heart.js';
import { ATTENTION_IS_RECENT_FOR_DAYS } from '../../../src/engine/world/who-is-given-attention-this-year.js';

const party = (id: string, ordinal: number): Party =>
    ({ id, name: id, ordinal, charm: 2, factionId: null, alignment: null });

const asking = (ledger: AttemptInput['ledger']): AttemptInput => ({
    actor: party('disciple', 3),
    subject: party('master', 20),
    onDay: 100,
    ask: 'a_real_favour',
    ledger,
    rng: forStream('seed', 'oath', 1)
});

const theOath = (onDay = 0) => createOath({
    holderId: 'master',
    subjectId: 'disciple',
    cause: 'teaching_term',
    severity: 'serious',
    onDay,
    dueOnDay: onDay + 3650,
    terms: '10 years of teaching owed to disciple.',
    description: 'master took disciple as their own.',
    participants: ['disciple']
});

describe('the oath to teach is a debt the master owes', () => {
    it('counts in the owed term exactly as a debt does', () => {
        const nothing = oddsOf(asking([])).terms.owed;
        const oath = oddsOf(asking([theOath()])).terms.owed;
        const debt = oddsOf(asking([createDebt({
            holderId: 'master', subjectId: 'disciple', cause: 'saved_life', severity: 'serious',
            onDay: 0, description: 'a debt'
        })])).terms.owed;
        expect(nothing).toBe(0);
        expect(oath).toBe(debt);
        expect(oath).toBeGreaterThan(0);
    });

    it('does not count the disciple\'s own term of service as owed to them', () => {
        const service = createOath({
            holderId: 'disciple', subjectId: 'master', cause: 'service_term', severity: 'serious',
            onDay: 0, dueOnDay: 3650, terms: 'service', description: 'knelt', participants: ['master']
        });
        expect(oddsOf(asking([service])).terms.owed).toBe(0);
    });
});

describe('and it weighs on the master\'s dao heart only when it is neglected', () => {
    it('holds neglect at three turns of the world\'s attention pass', () => {
        expect(THE_OATH_TO_TEACH_IS_NEGLECTED_AFTER_DAYS).toBe(3 * ATTENTION_IS_RECENT_FOR_DAYS);
        expect(whetherTheOathToTeachIsKept({ onDay: 1000, swornOnDay: 0, lastAttentionOnDay: 900 })).toBe(true);
        expect(whetherTheOathToTeachIsKept({ onDay: 5000, swornOnDay: 0, lastAttentionOnDay: 900 })).toBe(false);
    });

    it('charges a master neglecting it, spares one keeping it, and never charges the disciple', () => {
        const oath = theOath(0);
        const kept = whatACrossingAsksOfTheDaoHeart({ personId: 'master', ledger: [oath], asOfDay: 300 });
        const neglected = whatACrossingAsksOfTheDaoHeart({
            personId: 'master', ledger: [oath], asOfDay: THE_OATH_TO_TEACH_IS_NEGLECTED_AFTER_DAYS + 1
        });
        const disciple = whatACrossingAsksOfTheDaoHeart({
            personId: 'disciple', ledger: [oath], asOfDay: THE_OATH_TO_TEACH_IS_NEGLECTED_AFTER_DAYS + 1
        });
        expect(kept.share).toBe(0);
        expect(neglected.share).toBeGreaterThan(0);
        expect(neglected.open).toBe(1);
        expect(disciple.share).toBe(0);
    });

    it('reads a world master\'s ties by the same rule and on the same scale', () => {
        const onDay = 10_000;
        const ties = [
            { kind: 'disciple', sinceDay: 0, lastAttentionOnDay: onDay - 100 },
            { kind: 'disciple', sinceDay: 0, lastAttentionOnDay: null },
            { kind: 'friend', sinceDay: 0, lastAttentionOnDay: null }
        ];
        const read = whatNeglectedDisciplesAskOfTheDaoHeart({ ties, onDay });
        const ledgerRead = whatACrossingAsksOfTheDaoHeart({ personId: 'master', ledger: [theOath(0)], asOfDay: onDay });
        expect(read.open).toBe(1);
        expect(read.share).toBe(ledgerRead.share);
        expect(whatNeglectedDisciplesAskOfTheDaoHeart({ ties: ties.slice(0, 1), onDay }).share).toBe(0);
    });
});
