import { describe, expect, it } from 'vitest';
import { MEMBERS } from '../../../src/data/cultivation/members.js';
import { RESERVED_SURNAMES, SURNAMES, surnameOf } from '../../../src/engine/world/history.js';
import {
    housesWithALineNamed,
    isInTheCommonPool,
    lineageNameOf,
    linesOnTheRollOf,
    readALineageOffAName,
    readTheRollFor
} from '../../../src/engine/world/reading-a-lineage-off-a-name.js';

describe('what counts as a name at all', () => {
    it('reads the family name off a name the world could have generated', () => {
        expect(lineageNameOf('Ru Anwei')).toBe('Ru');
        expect(lineageNameOf('Xu Shizhen')).toBe('Xu');
    });

    it('declines a seat, an office or a by-name rather than inventing a family', () => {
        // Every one of these is a real row in MEMBERS, and surnameOf answers a
        // word that is not a surname for all of them.
        for (const title of ['The Abbot', 'First Seat', 'Fourth Seat', 'The Storm Tyrant', 'Nine Boards Qiu']) {
            expect(lineageNameOf(title), title).toBeNull();
        }
        // The defect this guards, stated: surnameOf on its own says otherwise.
        expect(surnameOf('First Seat')).toBe('First');
    });

    it('never puts an article or an ordinal on any house roll', () => {
        for (const [, lines] of MEMBERS.map(m => [m.factionId, linesOnTheRollOf(m.factionId)] as const)) {
            for (const line of lines) {
                expect(/^(?:The|First|Second|Third|Fourth)$/.test(line), line).toBe(false);
            }
        }
    });
});

describe('a common surname proves nothing, and that is the rule', () => {
    it('Gu and Cao are house lines and are also names a stranger may be born with', () => {
        for (const name of ['Gu', 'Cao']) {
            expect(isInTheCommonPool(name), name).toBe(true);
            expect(housesWithALineNamed(name).length, name).toBeGreaterThan(0);
            const reading = readALineageOffAName(`${name} Anrou`);
            expect(reading.reading).toBe('shared');
            expect(reading.settles).toBe(false);
            expect(reading.corroborates).toBe(true);
            expect(reading.houseItCarriesOnItsOwn).toBeNull();
        }
    });

    it('only a reserved name settles anything on its own', () => {
        const ru = readALineageOffAName('Ru Anwei');
        expect(ru.reading).toBe('reserved');
        expect(ru.settles).toBe(true);
        expect(ru.houseItCarriesOnItsOwn).toBe('Azure Cloud Pavilion');
        expect(ru.houseIdItCarriesOnItsOwn).toBe('sect-azure-cloud-pavilion');

        // And the reserved set is tiny on purpose: everything else is common.
        const settling = [...new Set(MEMBERS.map(m => lineageNameOf(m.name)).filter((s): s is string => s !== null))]
            .filter(s => readALineageOffAName(`${s} Anwei`).settles);
        expect(settling.length).toBeLessThanOrEqual(RESERVED_SURNAMES.size);
    });

    it('no reserved surname is reachable from the generator pool', () => {
        for (const name of RESERVED_SURNAMES.keys()) expect(isInTheCommonPool(name)).toBe(false);
        expect(SURNAMES.length).toBeGreaterThan(0);
    });
});

describe('Xu is the worked example of why names sit low', () => {
    it('is carried by more than one house, so it identifies none of them', () => {
        const houses = housesWithALineNamed('Xu');
        expect(houses.length).toBeGreaterThan(1);
        expect(houses).toContain('house-anchorhold');
        const reading = readALineageOffAName('Xu Shizhen');
        expect(reading.settles).toBe(false);
        expect(reading.corroborates).toBe(true);
    });

    it('corroborates against each house that carries it and settles against none', () => {
        for (const house of housesWithALineNamed('Xu')) {
            const roll = readTheRollFor('Xu Shizhen', house);
            expect(roll.worth, house).toBe('corroborates');
            expect(roll.settles, house).toBe(false);
        }
    });
});

describe('an absent name is a question, not a verdict', () => {
    it('a lineage name missing from a roll is somewhere to ask, never a finding', () => {
        const roll = readTheRollFor('Ru Anwei', 'sect-lantern-hall');
        // Reserved elsewhere, so this one is the single negative a name gives.
        expect(roll.worth).toBe('contradicts');

        const ordinary = readTheRollFor('Yun Shan', 'sect-lantern-hall');
        expect(ordinary.worth).toBe('a_question_to_ask');
        expect(ordinary.settles).toBe(false);
        // And it still says what IS on the roll, so the question has a subject.
        expect(ordinary.standingOnThatRoll.length).toBeGreaterThan(0);
    });

    it('the Meng line stands on nobody roll, which is the ordinary case and not a catastrophe', () => {
        // Meng is reserved to the Nine Peaks Ascetic Order on the strength of a
        // sealed patriarch. Nothing named Meng is on any LIVING roll, so the
        // roll reads the line as gone - and the reserved map still settles it,
        // which is exactly the two checks disagreeing in the way trust.md says
        // they should: the name carries the house, and the roll cannot confirm it.
        expect(RESERVED_SURNAMES.get('Meng')).toBe('Nine Peaks Ascetic Order');
        expect(housesWithALineNamed('Meng')).toEqual([]);
        expect(readTheRollFor('Meng Da', 'sect-nine-peaks-ascetic-order').worth).toBe('settles_it');
        expect(linesOnTheRollOf('sect-nine-peaks-ascetic-order')).not.toContain('Meng');
    });
});

describe('the roll is the living roll', () => {
    it('is built out of the roster and is not empty', () => {
        const houses = new Set(MEMBERS.map(m => m.factionId));
        const withLines = [...houses].filter(h => linesOnTheRollOf(h).length > 0);
        expect(withLines.length).toBeGreaterThan(20);
    });

    it('reads a supermajority of the roster and declines the rest rather than guessing', () => {
        const read = MEMBERS.filter(m => lineageNameOf(m.name) !== null).length;
        // Measured at 145 of 186 when this was written. The bar is on the shape
        // of the failure, not the exact figure: most of the roster reads, and
        // the remainder is declined instead of being given an invented family.
        expect(read / MEMBERS.length).toBeGreaterThan(0.7);
        expect(read).toBeLessThan(MEMBERS.length);
    });
});
