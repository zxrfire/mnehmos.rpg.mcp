/**
 * A count and the noun behind it, where the noun arrived at runtime.
 *
 * The assertions run over the REAL rank lists and the REAL conveyance catalog,
 * because the defect this closes was not a bad rule - it was a rule applied to
 * words its author never saw. A test written against invented nouns would have
 * passed on the day the game printed "3 core disciple".
 */

import { describe, expect, it } from 'vitest';
import { howMany, pluralOf } from '../../src/utils/a-count-agrees-with-what-it-counts.js';
import { SECTS } from '../../src/data/cultivation/sects.js';
import { CONVEYANCES } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';

const EVERY_RANK = [...new Set(SECTS.flatMap(sect => sect.ranks))];

describe('one of it, and more than one of it', () => {
    it('agrees with the number in front of it', () => {
        expect(howMany(1, 'core disciple')).toBe('1 core disciple');
        expect(howMany(3, 'core disciple')).toBe('3 core disciples');
    });

    it('agrees with the head noun, not the last word', () => {
        expect(howMany(2, 'Keeper of Names')).toBe('2 Keepers of Names');
        expect(howMany(2, 'Elder of the Hour')).toBe('2 Elders of the Hour');
        expect(howMany(2, 'Under-Warden of the Weir')).toBe('2 Under-Wardens of the Weir');
    });

    it('replaces the article a catalog name carries', () => {
        expect(howMany(1, 'A shod carriage')).toBe('1 shod carriage');
        expect(howMany(5, 'A shod carriage')).toBe('5 shod carriages');
    });

    it('leaves a word that is already however many there are', () => {
        expect(howMany(3, 'Chosen')).toBe('3 Chosen');
        expect(howMany(3, 'Bound')).toBe('3 Bound');
        expect(howMany(3, 'folk')).toBe('3 folk');
    });

    it('knows a Witness is one person', () => {
        expect(pluralOf('Witness')).toBe('Witnesses');
        expect(pluralOf('Pass')).toBe('Passes');
        expect(pluralOf('disciples')).toBe('disciples');
    });

    it('takes the plural no rule makes', () => {
        expect(howMany(2, 'person')).toBe('2 people');
        expect(howMany(2, 'Waterman')).toBe('2 Watermen');
    });
});

describe('over the catalogs the game actually prints from', () => {
    it('never puts an ending on the word behind a preposition', () => {
        for (const rank of EVERY_RANK) {
            const tail = /\s(?:of|among|amongst|in|on)\s+(.*)$/i.exec(rank)?.[1];
            if (tail === undefined) continue;
            expect(pluralOf(rank), rank).toContain(tail);
        }
    });

    it('leaves the title as its house writes it, but for the head', () => {
        for (const rank of EVERY_RANK) {
            expect(pluralOf(rank), rank).toMatch(/^[A-Z]/);
            expect(pluralOf(rank).split(' ').length, rank).toBe(rank.split(' ').length);
        }
    });

    it('is stable: pluralising a plural changes nothing further', () => {
        for (const rank of EVERY_RANK) {
            expect(pluralOf(pluralOf(rank)), rank).toBe(pluralOf(rank));
        }
        for (const conveyance of CONVEYANCES) {
            const many = pluralOf(conveyance.name);
            expect(pluralOf(many), conveyance.name).toBe(many);
        }
    });
});
