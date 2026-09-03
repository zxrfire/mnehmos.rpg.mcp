/**
 * Being hunted is a state somebody is in, derived, rather than a row in a
 * table nothing writes.
 */

import {
    createObligation,
    settleObligation,
    type ObligationRecord,
    type Severity
} from '../../../src/engine/social/grudges';
import {
    whoIsComingForYou,
    type AHolder
} from '../../../src/engine/social-leverage/being-hunted';

const ME = 'cultivator-me';

function against(input: {
    holder: string;
    severity?: Severity;
    kind?: 'grudge' | 'blood_feud';
    day?: number;
}): ObligationRecord {
    return createObligation({
        kind: input.kind ?? 'grudge',
        holderId: input.holder,
        subjectId: ME,
        cause: 'robbery',
        severity: input.severity ?? 'grave',
        onDay: input.day ?? 100,
        description: 'They took something.',
        triggeringEventId: `event-${input.holder}-${input.day ?? 100}`
    });
}

function holder(id: string, ordinal: number, houseId: string | null = null): AHolder {
    return { id, name: `Holder ${id}`, ordinal, houseId };
}

describe('nobody holding anything', () => {
    it('is not being hunted', () => {
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 10, backing: 'none' },
            ledger: [],
            holders: new Map()
        });
        expect(read.hunted).toBe(false);
        expect(read.coming).toHaveLength(0);
        expect(read.namesWithNothingBehindThem).toHaveLength(0);
    });
});

describe('a house that can reach them', () => {
    it('is coming', () => {
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 18, backing: 'none' },
            ledger: [against({ holder: 'house-a' })],
            holders: new Map([['house-a', holder('house-a', 20)]])
        });
        expect(read.hunted).toBe(true);
        expect(read.coming).toHaveLength(1);
        expect(read.coming[0]!.bother).toBe('worth_mounting');
        expect(read.coming[0]!.acting).toBe('they_can_act');
    });

    it('orders the heaviest first and is stable', () => {
        const ledger = [
            against({ holder: 'a', severity: 'slight', day: 5 }),
            against({ holder: 'b', severity: 'unforgivable', day: 9 }),
            against({ holder: 'c', severity: 'serious', day: 7 })
        ];
        const holders = new Map(['a', 'b', 'c'].map(id => [id, holder(id, 20)]));
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 18, backing: 'none' },
            ledger,
            holders
        });
        expect(read.coming.map(p => p.holderId)).toEqual(['b', 'c', 'a']);
    });
});

describe('a house that cannot', () => {
    /**
     * The owner's other half - *"or too powerful for them to touch you"* - and
     * the record still stands, which is the part that is not nothing.
     */
    it('has the name written down and nothing behind it', () => {
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 30, backing: 'none' },
            ledger: [against({ holder: 'house-a', severity: 'unforgivable' })],
            holders: new Map([['house-a', holder('house-a', 12)]])
        });
        expect(read.hunted).toBe(false);
        expect(read.coming).toHaveLength(0);
        expect(read.namesWithNothingBehindThem).toHaveLength(1);
        expect(read.namesWithNothingBehindThem[0]!.bother).toBe('beyond_them');
        // The account did not go away. It is open, it is at full weight, and it
        // is inheritable - only the gap is temporary.
        expect(read.namesWithNothingBehindThem[0]!.severity).toBe('unforgivable');
    });

    it('is contempt rather than mercy at the other end of the ladder', () => {
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 2, backing: 'none' },
            ledger: [against({ holder: 'house-a' })],
            holders: new Map([['house-a', holder('house-a', 30)]])
        });
        expect(read.hunted).toBe(false);
        expect(read.namesWithNothingBehindThem[0]!.bother).toBe('beneath_notice');
    });

    /**
     * The first axis, and it can remove the other two: an elder whose own house
     * would pay for what they start does not come for you in person.
     */
    it('does not come when their own house would pay for it', () => {
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 18, backing: 'backed' },
            ledger: [against({ holder: 'elder' })],
            holders: new Map([['elder', holder('elder', 20, 'house-theirs')]])
        });
        expect(read.hunted).toBe(false);
        expect(read.namesWithNothingBehindThem[0]!.acting).toBe('it_goes_to_your_house');
    });

    /** And somebody who has stopped caring what it costs comes anyway. */
    it('comes when the holder has stopped caring', () => {
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 18, backing: 'backed' },
            ledger: [against({ holder: 'elder' })],
            holders: new Map([[
                'elder',
                { ...holder('elder', 20, 'house-theirs'), hasStoppedCaring: true }
            ]])
        });
        expect(read.hunted).toBe(true);
    });
});

describe('what it will not invent', () => {
    it('leaves out a holder the caller cannot place', () => {
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 18, backing: 'none' },
            ledger: [against({ holder: 'a-name-nobody-knows' })],
            holders: new Map()
        });
        expect(read.coming).toHaveLength(0);
        expect(read.namesWithNothingBehindThem).toHaveLength(0);
    });

    it('ignores a settled account', () => {
        const open = against({ holder: 'house-a' });
        const closed = settleObligation(open, {
            resolution: 'forgiven', onDay: 500, note: 'Let go of.'
        });
        const holders = new Map([['house-a', holder('house-a', 20)]]);
        const quarry = { id: ME, ordinal: 18, backing: 'none' as const };
        expect(whoIsComingForYou({ quarry, ledger: [open], holders }).hunted).toBe(true);
        expect(whoIsComingForYou({ quarry, ledger: [closed], holders }).hunted).toBe(false);
    });

    it('ignores favours and oaths, which are not somebody after you', () => {
        const ledger = (['favor', 'oath', 'debt', 'leverage'] as const).map((kind, i) =>
            createObligation({
                kind, holderId: 'house-a', subjectId: ME, cause: 'other',
                severity: 'unforgivable', onDay: i, description: 'x'
            }));
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 18, backing: 'none' },
            ledger,
            holders: new Map([['house-a', holder('house-a', 20)]])
        });
        expect(read.hunted).toBe(false);
        expect(read.namesWithNothingBehindThem).toHaveLength(0);
    });
});

describe('a blood feud says so on the row', () => {
    it('is marked as carried rather than settled', () => {
        const read = whoIsComingForYou({
            quarry: { id: ME, ordinal: 18, backing: 'none' },
            ledger: [against({ holder: 'kin', kind: 'blood_feud', severity: 'unforgivable' })],
            holders: new Map([['kin', holder('kin', 19)]])
        });
        expect(read.coming[0]!.carriedRatherThanSettled).toBe(true);
    });
});
