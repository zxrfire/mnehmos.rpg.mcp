/**
 * What closes an account, and what walking out of the closing costs.
 *
 * The guard that matters most is the negative one: a binding must be ONE
 * discharge among several, not the answer to every heavy record, or a rule has
 * been written that applies to exactly one situation.
 */

import { describe, expect, it } from 'vitest';
import {
    couldBeSettledByABinding,
    settleItWithABinding,
    whatWalkingOutOfItCosts,
    whatWouldCloseIt
} from '../../../src/engine/social-leverage/what-would-settle-an-account-this-heavy.js';
import { createGrudge, createOath, type ObligationRecord } from '../../../src/engine/social/grudges.js';

const bothSidesHavePeople = {
    holderIsAHouse: true, subjectIsAHouse: true,
    principalIsStillHere: true, couldBeBound: true
};

function graveBetweenHouses(): ObligationRecord {
    return createGrudge({
        holderId: 'house_a', subjectId: 'house_b', cause: 'violated',
        severity: 'grave', onDay: 100,
        description: 'One of theirs, and the name on it is a house.'
    });
}

describe('what an account this heavy can be closed with', () => {
    it('will not take money for something grave', () => {
        expect(whatWouldCloseIt(graveBetweenHouses(), bothSidesHavePeople))
            .not.toContain('compensated');
    });

    it('takes money for something slight', () => {
        const slight = { ...graveBetweenHouses(), severity: 'slight' as const };
        expect(whatWouldCloseIt(slight, bothSidesHavePeople)).toContain('compensated');
    });

    it('has nobody to forgive it when the holder is a house', () => {
        expect(whatWouldCloseIt(
            { ...graveBetweenHouses(), severity: 'serious' }, bothSidesHavePeople
        )).not.toContain('forgiven');
    });

    it('leaves acting on it available at every weight, which is the point of the ledger', () => {
        for (const severity of ['slight', 'serious', 'grave', 'unforgivable'] as const) {
            expect(whatWouldCloseIt({ ...graveBetweenHouses(), severity }, bothSidesHavePeople))
                .toContain('avenged');
        }
    });

    it('offers a binding only where the account is heavy AND there are people to bind', () => {
        expect(couldBeSettledByABinding(graveBetweenHouses(), bothSidesHavePeople)).toBe(true);
        expect(couldBeSettledByABinding(
            graveBetweenHouses(), { ...bothSidesHavePeople, couldBeBound: false })).toBe(false);
        expect(couldBeSettledByABinding(
            { ...graveBetweenHouses(), severity: 'serious' }, bothSidesHavePeople)).toBe(false);
    });

    it('never offers one for a favour or a debt', () => {
        const owed = { ...graveBetweenHouses(), kind: 'favor' as const };
        expect(couldBeSettledByABinding(owed, bothSidesHavePeople)).toBe(false);
        expect(whatWouldCloseIt(owed, bothSidesHavePeople)).toEqual(['repaid', 'forgiven']);
    });

    it('offers nothing at all for a record already settled', () => {
        expect(whatWouldCloseIt(
            { ...graveBetweenHouses(), status: 'settled' }, bothSidesHavePeople)).toEqual([]);
    });
});

describe('the bargain', () => {
    it('writes an oath exactly as heavy as what it closed', () => {
        const record = graveBetweenHouses();
        const bargain = settleItWithABinding({
            record, boundId: 'the_son', boundName: 'The son',
            toId: 'the_daughter', toName: 'The daughter',
            owedToHouseId: 'house_a', onDay: 200
        });
        expect(bargain.binding.severity).toBe(record.severity);
        expect(bargain.binding.cause).toBe('marriage_pact');
        expect(bargain.settled.resolution).toBe('renounced');
        // The relationship is the point, and the record says what it is like.
        expect(bargain.tie).toMatch(/did not choose/);
    });
});

describe('walking out of it', () => {
    const binding = createOath({
        holderId: 'the_son', subjectId: 'house_a', cause: 'marriage_pact',
        severity: 'grave', onDay: 200, description: 'Bound.'
    });

    it('reopens the original at its original date and its original weight', () => {
        const closed = graveBetweenHouses();
        const out = whatWalkingOutOfItCosts({
            binding, closed, leaverId: 'the_son', leaverName: 'The son', onDay: 300
        });
        expect(out.reopened).not.toBeNull();
        expect(out.reopened?.onDay).toBe(closed.incurredOnDay);
        expect(out.reopened?.severity).toBe(closed.severity);
        expect(out.reopened?.cause).toBe(closed.cause);
    });

    it('opens a second account, and this one names the person rather than a house', () => {
        const out = whatWalkingOutOfItCosts({
            binding, closed: graveBetweenHouses(),
            leaverId: 'the_son', leaverName: 'The son', onDay: 300
        });
        expect(out.opened.subjectId).toBe('the_son');
        expect(out.opened.cause).toBe('broken_oath');
        expect(out.opened.holderId).toBe('house_a');
    });

    it('costs the broken word and nothing else when the arrangement settled nothing', () => {
        // Most arranged marriages are not settlements of anything, and most
        // people who leave one simply did not want it.
        const out = whatWalkingOutOfItCosts({
            binding, leaverId: 'the_son', leaverName: 'The son', onDay: 300
        });
        expect(out.reopened).toBeNull();
        expect(out.opened.cause).toBe('broken_oath');
        expect(out.note).toMatch(/nothing behind it/);
    });
});
