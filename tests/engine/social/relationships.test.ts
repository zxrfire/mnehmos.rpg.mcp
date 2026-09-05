/**
 * Relationships as durable, directed, non-scalar state.
 *
 * The properties under test are storage properties: a tie survives decades
 * untouched, both directions are independent, ended ties are kept, and
 * importance is a stored fact rather than anything derived from cultivation.
 */

import {
    RelationshipLedger,
    createRelationship,
    endRelationship,
    recordRelationshipEvent,
    updateRelationship
} from '../../../src/engine/social/relationships.js';
import { daysForYears } from '../../../src/engine/social/common.js';

const DAY_ZERO = 0;

describe('createRelationship', () => {
    it('stores the several fields a relationship is made of, not one number', () => {
        const rel = createRelationship({
            fromId: 'yun_qi',
            toId: 'elder_shan',
            type: 'former_disciple',
            onDay: DAY_ZERO,
            strength: 0.9,
            significance: 'defining',
            attitude: 'cautious trust, badly dented',
            roles: ['owes_a_favour', 'shares_a_secret'],
            history: 'Eleven years under him. Left without a word.'
        });

        expect(rel.type).toBe('former_disciple');
        expect(rel.strength).toBe(0.9);
        expect(rel.significance).toBe('defining');
        expect(rel.attitude).toBe('cautious trust, badly dented');
        expect(rel.roles).toEqual(['owes_a_favour', 'shares_a_secret']);
        expect(rel.history).toContain('Eleven years');
        expect(rel.active).toBe(true);
    });

    it('gives the same id for the same pair, so a record round-trips', () => {
        const a = createRelationship({ fromId: 'a', toId: 'b', type: 'rival', onDay: 0 });
        const b = createRelationship({ fromId: 'a', toId: 'b', type: 'enemy', onDay: 900 });
        expect(a.id).toBe(b.id);
    });
});

describe('directedness', () => {
    it('keeps the two halves of a tie independent and lets them disagree', () => {
        const ledger = new RelationshipLedger();
        ledger.put(
            createRelationship({
                fromId: 'bo_lan',
                toId: 'mei',
                type: 'friend',
                onDay: 0,
                attitude: 'warm, uncomplicated'
            })
        );
        ledger.put(
            createRelationship({
                fromId: 'mei',
                toId: 'bo_lan',
                type: 'rival',
                onDay: 0,
                attitude: 'has been waiting nine years for an opening'
            })
        );

        const { forward, reverse } = ledger.mutual('bo_lan', 'mei');
        expect(forward?.type).toBe('friend');
        expect(reverse?.type).toBe('rival');
        // Nothing reconciles them. The mismatch is the whole point.
        expect(forward?.attitude).not.toBe(reverse?.attitude);
    });

    it('indexes NPC-to-NPC ties exactly like any other, with no player concept', () => {
        const ledger = new RelationshipLedger();
        ledger.put(createRelationship({ fromId: 'elder_shan', toId: 'elder_ru', type: 'faction_rival', onDay: 0 }));
        ledger.put(createRelationship({ fromId: 'elder_ru', toId: 'elder_shan', type: 'faction_rival', onDay: 0 }));
        ledger.put(createRelationship({ fromId: 'yun_qi', toId: 'elder_shan', type: 'disciple', onDay: 0 }));

        expect(ledger.incoming('elder_shan').map(r => r.fromId).sort()).toEqual([
            'elder_ru',
            'yun_qi'
        ]);
        expect(ledger.outgoing('elder_ru')).toHaveLength(1);
    });
});

describe('surviving decades', () => {
    it('is unchanged after forty years of world time with nothing written to it', () => {
        const ledger = new RelationshipLedger();
        const original = createRelationship({
            fromId: 'yun_qi',
            toId: 'grandmother_pei',
            type: 'kin',
            onDay: 0,
            significance: 'defining',
            strength: 1,
            attitude: 'the only person who knew him before'
        });
        ledger.put(original);

        const fortyYearsOn = daysForYears(40);
        const found = ledger.between('yun_qi', 'grandmother_pei');

        // No decay, no sweep, no aging. Storage means storage.
        expect(found).toEqual(original);
        expect(found!.strength).toBe(1);
        expect(found!.significance).toBe('defining');
        expect(ledger.all({ asOfDay: fortyYearsOn })).toHaveLength(1);
    });

    it('accumulates events across a century and keeps every one', () => {
        let rel = createRelationship({ fromId: 'yun_qi', toId: 'elder_shan', type: 'disciple', onDay: 0 });
        rel = recordRelationshipEvent(rel, {
            onDay: daysForYears(3),
            kind: 'taught',
            summary: 'Shown the second form of Borrowed Breath.',
            significance: 'notable'
        });
        rel = recordRelationshipEvent(rel, {
            onDay: daysForYears(11),
            kind: 'abandoned',
            summary: 'Left the sect without a word after the Burnt Earth affair.',
            significance: 'defining',
            tags: ['estrangement']
        });
        rel = recordRelationshipEvent(rel, {
            onDay: daysForYears(97),
            kind: 'returned',
            summary: 'Came back. Neither of them mentioned it.',
            significance: 'defining'
        });

        expect(rel.events).toHaveLength(3);
        expect(rel.events.map(e => e.kind)).toEqual(['taught', 'abandoned', 'returned']);
        expect(rel.lastUpdatedOnDay).toBe(daysForYears(97));

        const ledger = new RelationshipLedger();
        ledger.put(rel);
        expect(ledger.historyBetween('yun_qi', 'elder_shan')).toHaveLength(3);
    });

    it('keeps the old account when the attitude changes', () => {
        let rel = createRelationship({
            fromId: 'yun_qi',
            toId: 'elder_shan',
            type: 'disciple',
            onDay: 0,
            attitude: 'unquestioning',
            history: 'Took him in off the road.'
        });
        rel = updateRelationship(rel, {
            onDay: daysForYears(11),
            type: 'former_disciple',
            attitude: 'quiet resentment',
            appendHistory: 'The Burnt Earth affair. He chose the sect.'
        });

        expect(rel.attitude).toBe('quiet resentment');
        // "He was not always like this" stays answerable from the record alone.
        expect(rel.history).toContain('Took him in off the road.');
        expect(rel.history).toContain('The Burnt Earth affair.');
    });

    it('keeps ended ties rather than deleting them', () => {
        const ledger = new RelationshipLedger();
        const rel = createRelationship({ fromId: 'yun_qi', toId: 'elder_shan', type: 'disciple', onDay: 0 });
        ledger.put(endRelationship(rel, 'death', daysForYears(60)));

        // A dead master is still a master.
        expect(ledger.between('yun_qi', 'elder_shan')!.active).toBe(false);
        expect(ledger.outgoing('yun_qi')).toHaveLength(0);
        expect(ledger.outgoing('yun_qi', { includeEnded: true })).toHaveLength(1);
        expect(ledger.outgoing('yun_qi', { includeEnded: true })[0].endedReason).toBe('death');
    });
});

describe('importance is stored, never derived from power', () => {
    it('lets a mortal outrank a cultivator in the only ledger that matters', () => {
        const ledger = new RelationshipLedger();
        ledger.put(
            createRelationship({
                fromId: 'yun_qi',
                toId: 'grandmother_pei',
                type: 'kin',
                onDay: 0,
                significance: 'defining',
                strength: 1
            })
        );
        ledger.put(
            createRelationship({
                fromId: 'yun_qi',
                toId: 'lord_hai',
                type: 'acquaintance',
                onDay: 0,
                significance: 'incidental',
                strength: 0.1
            })
        );

        const defining = ledger.outgoing('yun_qi', { significance: 'defining' });
        expect(defining).toHaveLength(1);
        expect(defining[0].toId).toBe('grandmother_pei');
    });

    it('keeps a surpassed master defining, which is the point of storing it', () => {
        const ledger = new RelationshipLedger();
        ledger.put(
            createRelationship({
                fromId: 'yun_qi',
                toId: 'elder_shan',
                type: 'former_master',
                onDay: 0,
                significance: 'defining',
                roles: ['keeper_of_old_knowledge'],
                attitude: 'still asks him things'
            })
        );
        // The disciple has long since surpassed him. Nothing in the record
        // knows or cares, because nothing in it references cultivation.
        const found = ledger.outgoing('yun_qi', { roles: ['keeper_of_old_knowledge'] });
        expect(found).toHaveLength(1);
        expect(found[0].significance).toBe('defining');
    });
});

describe('queries', () => {
    it('filters by type, role and as-of day, and orders deterministically', () => {
        const ledger = new RelationshipLedger();
        ledger.put(createRelationship({ fromId: 'a', toId: 'b', type: 'sect_mate', onDay: 10 }));
        ledger.put(createRelationship({ fromId: 'a', toId: 'c', type: 'creditor', onDay: 500, roles: ['owed'] }));
        ledger.put(createRelationship({ fromId: 'a', toId: 'd', type: 'sect_mate', onDay: 900 }));

        expect(ledger.outgoing('a', { type: 'sect_mate' })).toHaveLength(2);
        expect(ledger.outgoing('a', { roles: ['owed'] }).map(r => r.toId)).toEqual(['c']);
        expect(ledger.outgoing('a', { asOfDay: 100 })).toHaveLength(1);

        const first = ledger.outgoing('a').map(r => r.id);
        const second = ledger.outgoing('a').map(r => r.id);
        expect(first).toEqual(second);
    });
});
