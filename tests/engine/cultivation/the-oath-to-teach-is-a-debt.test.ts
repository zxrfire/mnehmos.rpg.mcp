/**
 * The oath to teach counts as a debt, and it weighs on the master.
 *
 * The design owner: *"the oath to teach counts as a debt. It affects the
 * master's breakthroughs and his dao heart."* Pinned here:
 *
 *   A DEBT      an open `teaching_term` oath the asked person swore about the
 *               asker counts in the resolver's `owed` term the way a debt does,
 *               and no other oath does.
 *   NO CLOCK    the design owner: *"the master neglect thing, get rid of it.
 *               Either they terminate the relationship or they don't."* A bond
 *               that is still standing weighs NOTHING at a crossing, however
 *               many centuries have passed with no lesson given. What weighs is
 *               ending it, which is an act on the ledger.
 *
 * Red-checked: dropping `theySworeToTeachYou` from `owedYourWay` fails the debt
 * block, and counting a standing teaching oath as an unfinished account fails
 * the no-clock block.
 */

import { describe, expect, it } from 'vitest';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { oddsOf, type AttemptInput, type Party } from '../../../src/engine/social-leverage/index.js';
import { createDebt, createOath } from '../../../src/engine/social/grudges.js';
import { whatACrossingAsksOfTheDaoHeart } from '../../../src/engine/cultivation/what-a-crossing-asks-of-the-dao-heart.js';

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

describe('and a bond that is still standing weighs nothing at a crossing', () => {
    it('charges a master nothing for an oath to teach, however many centuries have passed', () => {
        // The neglect clock is gone. A master who has taught nobody for three
        // hundred years still has an OPEN oath, not a broken one, and a wall
        // asks about what was left unfinished, not about what is under way.
        const oath = theOath(0);
        for (const asOfDay of [300, 30 * 365 + 1, 300 * 365]) {
            const master = whatACrossingAsksOfTheDaoHeart({ personId: 'master', ledger: [oath], asOfDay });
            expect(master.share, `charged at day ${asOfDay}`).toBe(0);
            expect(master.open).toBe(0);
        }
        expect(whatACrossingAsksOfTheDaoHeart({ personId: 'disciple', ledger: [oath], asOfDay: 300 * 365 }).share).toBe(0);
    });

    it('and still charges the master for an ordinary open account', () => {
        // The teaching oath is skipped by cause, not by person: everything else
        // on the same master's ledger still reads.
        const debt = createDebt({
            holderId: 'master', subjectId: 'disciple', cause: 'saved_life', severity: 'serious',
            onDay: 0, description: 'a debt'
        });
        const read = whatACrossingAsksOfTheDaoHeart({ personId: 'master', ledger: [theOath(0), debt], asOfDay: 300 * 365 });
        expect(read.open).toBe(1);
        expect(read.share).toBeGreaterThan(0);
    });
});

