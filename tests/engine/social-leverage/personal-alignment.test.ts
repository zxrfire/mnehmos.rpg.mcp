/**
 * A cultivator is what they have done, not whose roll they are on.
 *
 * Every assertion here is on state - the word that comes back and the two
 * numbers behind it - and none is on prose.
 */

import {
    createObligation,
    settleObligation,
    type ObligationRecord,
    type Severity
} from '../../../src/engine/social/grudges';
import {
    whatTheirRecordMakesThem,
    WHAT_A_RECORD_COUNTS_FOR,
    WHAT_MAKES_IT_A_METHOD
} from '../../../src/engine/social-leverage/personal-alignment';

const ME = 'cultivator-me';

function wrong(input: {
    holder: string;
    severity: Severity;
    day?: number;
    event?: string | null;
    subject?: string;
}): ObligationRecord {
    return createObligation({
        kind: 'grudge',
        holderId: input.holder,
        subjectId: input.subject ?? ME,
        cause: 'robbery',
        severity: input.severity,
        onDay: input.day ?? 10,
        description: 'They took something.',
        triggeringEventId: input.event ?? null
    });
}

function kindness(input: {
    subject: string;
    severity: Severity;
    day?: number;
    holder?: string;
}): ObligationRecord {
    return createObligation({
        kind: 'favor',
        // `grudges.ts`: a favour is owed TO the holder, so the holder paid.
        holderId: input.holder ?? ME,
        subjectId: input.subject,
        cause: 'saved_life',
        severity: input.severity,
        onDay: input.day ?? 10,
        description: 'They paid for somebody.'
    });
}

describe('an empty life', () => {
    it('is neutral and not righteous', () => {
        const read = whatTheirRecordMakesThem({ personId: ME, ledger: [] });
        expect(read.alignment).toBe('neutral');
        expect(read.nothingEitherWay).toBe(true);
        expect(read.taken).toBe(0);
        expect(read.paid).toBe(0);
        expect(read.worst).toBeNull();
    });

    /**
     * The whole of the defect this replaces: a person with no house had NO
     * alignment at all, because it was read as `mySect?.alignment ?? null`.
     * There is no null here and no way to produce one.
     */
    it('never answers null', () => {
        const read = whatTheirRecordMakesThem({ personId: 'nobody-at-all', ledger: [] });
        expect(read.alignment).not.toBeNull();
        expect(['righteous', 'neutral', 'demonic']).toContain(read.alignment);
    });
});

describe('what makes somebody demonic', () => {
    it('takes a method rather than an incident', () => {
        const one = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [wrong({ holder: 'a', severity: 'grave', event: 'e1' })]
        });
        expect(one.taken).toBe(WHAT_A_RECORD_COUNTS_FOR.grave);
        expect(one.alignment).toBe('neutral');

        const two = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [
                wrong({ holder: 'a', severity: 'grave', event: 'e1' }),
                wrong({ holder: 'b', severity: 'grave', event: 'e2', day: 40 })
            ]
        });
        expect(two.taken).toBeGreaterThanOrEqual(WHAT_MAKES_IT_A_METHOD);
        expect(two.alignment).toBe('demonic');
        expect(two.worst).toBe('grave');
    });

    it('gets there in one on something unforgivable', () => {
        const read = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [wrong({ holder: 'a', severity: 'unforgivable', event: 'e1' })]
        });
        expect(read.alignment).toBe('demonic');
    });

    it('does not get there on a lifetime of nuisance alone', () => {
        const ledger = Array.from({ length: 20 }, (_, i) =>
            wrong({ holder: `p${i}`, severity: 'slight', event: `e${i}`, day: i }));
        const read = whatTheirRecordMakesThem({ personId: ME, ledger });
        expect(read.wrongs).toBe(20);
        expect(read.alignment).toBe('neutral');
    });
});

describe('what makes somebody righteous', () => {
    it('is paid for, on the identical arithmetic', () => {
        const read = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [
                kindness({ subject: 'a', severity: 'grave', day: 1 }),
                kindness({ subject: 'b', severity: 'grave', day: 2 })
            ]
        });
        expect(read.paid).toBeGreaterThanOrEqual(WHAT_MAKES_IT_A_METHOD);
        expect(read.alignment).toBe('righteous');
    });

    /**
     * One scoring function, both directions. The two sides of this pair are the
     * same severities in the two directions and they cross at the same figure.
     */
    it('crosses at exactly the same weight the wrongs do', () => {
        const good = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [kindness({ subject: 'a', severity: 'unforgivable' })]
        });
        const bad = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [wrong({ holder: 'a', severity: 'unforgivable', event: 'e1' })]
        });
        expect(good.paid).toBe(bad.taken);
        expect(good.alignment).toBe('righteous');
        expect(bad.alignment).toBe('demonic');
    });

    /** A favour somebody else did FOR them says nothing about them. */
    it('does not count kindnesses they received', () => {
        const read = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [
                kindness({ holder: 'a', subject: ME, severity: 'unforgivable', day: 1 }),
                kindness({ holder: 'b', subject: ME, severity: 'unforgivable', day: 2 })
            ]
        });
        expect(read.paid).toBe(0);
        expect(read.alignment).toBe('neutral');
    });
});

describe('the two directions do not net off', () => {
    /**
     * The design owner's own case: a righteous house's art in the hands of
     * somebody evil. Charity does not answer for what was taken, and the
     * ordering rather than a subtraction is what says so.
     */
    it('a murderer who also gives generously is demonic and generous', () => {
        const read = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [
                wrong({ holder: 'victim', severity: 'unforgivable', event: 'e1', day: 5 }),
                kindness({ subject: 'a', severity: 'unforgivable', day: 6 }),
                kindness({ subject: 'b', severity: 'unforgivable', day: 7 }),
                kindness({ subject: 'c', severity: 'unforgivable', day: 8 })
            ]
        });
        expect(read.alignment).toBe('demonic');
        expect(read.paid).toBeGreaterThan(read.taken);
    });
});

describe('one deed is counted once', () => {
    /**
     * `whatADeedLeaves` opens a record for the victim, one for each of their
     * kin at the same weight, and one for their house. Counting rows would
     * price the victim's family size as the actor's character.
     */
    it('collapses the copies a single deed opens', () => {
        const copies = ['victim', 'brother', 'sister', 'house-x'].map(holder =>
            wrong({ holder, severity: 'grave', event: 'the-one-event' }));
        const read = whatTheirRecordMakesThem({ personId: ME, ledger: copies });
        expect(read.wrongs).toBe(1);
        expect(read.taken).toBe(WHAT_A_RECORD_COUNTS_FOR.grave);
        expect(read.alignment).toBe('neutral');
    });

    it('still separates two deeds that share a holder', () => {
        const read = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [
                wrong({ holder: 'victim', severity: 'grave', event: 'e1', day: 3 }),
                wrong({ holder: 'victim', severity: 'grave', event: 'e2', day: 9 })
            ]
        });
        expect(read.wrongs).toBe(2);
        expect(read.alignment).toBe('demonic');
    });
});

describe('the road back is the ledger\'s own', () => {
    it('a settled account stops counting, and nothing else does', () => {
        const first = wrong({ holder: 'a', severity: 'unforgivable', event: 'e1' });
        expect(whatTheirRecordMakesThem({ personId: ME, ledger: [first] }).alignment)
            .toBe('demonic');

        const answered = settleObligation(first, {
            resolution: 'avenged',
            onDay: 400,
            note: 'They got it back.'
        });
        const after = whatTheirRecordMakesThem({ personId: ME, ledger: [answered] });
        expect(after.alignment).toBe('neutral');
        expect(after.taken).toBe(0);
    });

    it('does not forget on its own with time', () => {
        const old = wrong({ holder: 'a', severity: 'unforgivable', event: 'e1', day: 1 });
        const read = whatTheirRecordMakesThem({
            personId: ME,
            ledger: [old],
            asOfDay: 900_000
        });
        expect(read.alignment).toBe('demonic');
    });
});

describe('what it will not read', () => {
    /**
     * The owner's explicit example: practising a house's art must not make you
     * anything. There is nowhere in the signature to put a technique, a
     * faction, a rung or a realm, which is how it is guaranteed rather than
     * remembered - the same shape
     * `how-freely-somebody-parts-with-what-they-have.ts` uses to keep an
     * alignment out of a disposition.
     */
    it('has no place to put a house, a rung or an art', () => {
        const source = whatTheirRecordMakesThem.toString();
        expect(source).not.toMatch(/faction|technique|realm|ordinal|alignment\s*:/i);
    });

    /**
     * `grudges.ts`: the cause list is data, and a switch on one is the bug.
     * Two records identical but for the cause read identically.
     */
    it('does not read the cause', () => {
        const a = createObligation({
            kind: 'grudge', holderId: 'h', subjectId: ME, cause: 'killed_kin',
            severity: 'grave', onDay: 1, description: 'x', triggeringEventId: 'e1'
        });
        const b = createObligation({
            kind: 'grudge', holderId: 'h', subjectId: ME, cause: 'slander',
            severity: 'grave', onDay: 1, description: 'x', triggeringEventId: 'e1'
        });
        const read = (r: ObligationRecord) =>
            whatTheirRecordMakesThem({ personId: ME, ledger: [r] });
        expect(read(a).taken).toBe(read(b).taken);
        expect(read(a).alignment).toBe(read(b).alignment);
    });

    /** Positions rather than deeds. None of them is a transfer anybody made. */
    it('ignores debts, oaths and leverage', () => {
        const ledger = (['debt', 'oath', 'leverage'] as const).map((kind, i) =>
            createObligation({
                kind, holderId: ME, subjectId: 'other', cause: 'other',
                severity: 'unforgivable', onDay: i, description: 'x'
            }));
        const read = whatTheirRecordMakesThem({ personId: ME, ledger });
        expect(read.alignment).toBe('neutral');
        expect(read.nothingEitherWay).toBe(true);
    });
});

describe('it is the same call for anybody', () => {
    it('answers about an NPC off the same rows', () => {
        const npc = 'npc-41';
        const ledger = [
            wrong({ holder: 'a', severity: 'unforgivable', event: 'e1', subject: npc })
        ];
        expect(whatTheirRecordMakesThem({ personId: npc, ledger }).alignment).toBe('demonic');
        // And the same rows say nothing about the player, who was not in them.
        expect(whatTheirRecordMakesThem({ personId: ME, ledger }).alignment).toBe('neutral');
    });
});
