/**
 * Might makes right. The owner: "a demonic house doesn't reward harm done. they reward personal
 * power regardless of the means". So a demonic reader measures the rung and a wrong left
 * standing, never the harm done to others; and a demonic house supports its own method.
 */
import { describe, expect, it } from 'vitest';

import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    backingWeight,
    mightWeight,
    oddsOf,
    type AttemptInput,
    type Party
} from '../../../src/engine/social-leverage/an-attempt-to-move-somebody.js';
import { whatTheStrongMakeOfYou } from '../../../src/engine/social-leverage/what-the-strong-make-of-you.js';
import type { ObligationRecord, Severity } from '../../../src/engine/social/grudges.js';

const row = (holderId: string, subjectId: string, severity: Severity, id: string): ObligationRecord => ({
    id,
    kind: 'grudge',
    holderId,
    originHolderId: holderId,
    subjectId,
    cause: 'theft',
    severity,
    incurredOnDay: 1,
    triggeringEventId: id,
    description: '',
    participants: [],
    tags: [],
    terms: null,
    dueOnDay: null,
    status: 'open',
    settlement: null
} as unknown as ObligationRecord);

const read = (over: Partial<Parameters<typeof whatTheStrongMakeOfYou>[0]> = {}) => whatTheStrongMakeOfYou({
    observerAlignment: 'demonic',
    observerOrdinal: 10,
    aboutId: 'you',
    aboutOrdinal: 10,
    ledger: [],
    ...over
});

describe('what somebody on the demonic path makes of you', () => {
    it('is nothing to a righteous or neutral reader, or somebody with no house', () => {
        for (const observerAlignment of ['righteous', 'neutral', null] as const) {
            expect(read({ observerAlignment })).toBeNull();
        }
    });

    it('defers to somebody above them, however they got there', () => {
        const heinous = [row('a', 'you', 'unforgivable', 'd1'), row('b', 'you', 'grave', 'd2')];
        expect(read({ aboutOrdinal: 12 })!.regard).toBe('defers');
        expect(read({ aboutOrdinal: 12, ledger: heinous })!.regard).toBe('defers');
    });

    it('does not count harm done to others, for or against', () => {
        const heinous = [row('a', 'you', 'unforgivable', 'd1'), row('b', 'you', 'grave', 'd2')];
        expect(read({ ledger: heinous })!.regard).toBe('nothing_either_way');
    });

    it('thinks the less of a wrong left standing, unless you stand above them', () => {
        const robbed = [row('you', 'thief', 'serious', 'w1')];
        expect(read({ ledger: robbed })!.regard).toBe('contempt');
        expect(read({ ledger: robbed, aboutOrdinal: 11 })!.regard).toBe('defers');
    });
});

const party = (over: Partial<Party>): Party =>
    ({ id: 'p', name: 'P', ordinal: 6, charm: 2, factionId: null, alignment: null, ...over });

const attempt = (over: Partial<AttemptInput> = {}): AttemptInput => ({
    actor: party({ id: 'actor' }),
    subject: party({ id: 'subject' }),
    onDay: 1000,
    ask: 'a_real_favour',
    rng: forStream('seed', 'test', 1),
    ...over
});

describe('might makes right in an attempt to move somebody', () => {
    it('counts the rung gap twice for a demonic subject, and not for anybody else', () => {
        const strong = party({ id: 'actor', ordinal: 10 });
        const demonic = oddsOf(attempt({ actor: strong, subject: party({ id: 'subject', alignment: 'demonic' }) }));
        const righteous = oddsOf(attempt({ actor: strong, subject: party({ id: 'subject', alignment: 'righteous' }) }));
        expect(demonic.terms.might).toBe(demonic.terms.standing);
        expect(demonic.terms.might).toBeGreaterThan(0);
        expect(righteous.terms.might).toBe(0);
        expect(demonic.odds).toBeGreaterThan(righteous.odds);
    });

    it('costs a demonic subject\'s regard when the actor let a wrong stand', () => {
        const input = attempt({
            subject: party({ id: 'subject', alignment: 'demonic' }),
            actorsRecord: [row('actor', 'thief', 'serious', 'w1')]
        });
        expect(mightWeight(input, 0)).toBeLessThan(0);
    });

    it('adds the house\'s weight when a demonic house supplies the method, and only then', () => {
        const heavy = { leverage: 'attachment' } as AttemptInput['approach'];
        expect(backingWeight(attempt({
            actor: party({ id: 'actor', alignment: 'demonic' }), ask: 'a_betrayal', approach: heavy
        }))).toBeGreaterThan(0);
        expect(backingWeight(attempt({
            actor: party({ id: 'actor', alignment: 'righteous' }), ask: 'a_betrayal', approach: heavy
        }))).toBe(0);
        expect(backingWeight(attempt({ actor: party({ id: 'actor', alignment: 'demonic' }) }))).toBe(0);
    });
});
