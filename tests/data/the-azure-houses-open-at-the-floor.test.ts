import { describe, it, expect } from 'vitest';
import { SECTS } from '../../src/data/cultivation/sects.js';

/**
 * All three Azure houses admit from the floor, on purpose.
 *
 * The Pavilion is the one that keeps getting this wrong, so it is worth being
 * exact: it has ONE door and it stands at the bottom of the ladder. What people
 * quote as its bar is not a second door - it is what PASSING costs. Everybody
 * enters the same way, as a guest disciple on a long probation drawing none of
 * the house's resources, and the thing that has never moved for anybody is that
 * test rather than the doorway.
 *
 * That is why this is pinned. The Pavilion's number was 3 while two separate
 * passages of catalog prose described a door at the floor, and nothing caught
 * it, because an admission bar is a number nobody reads twice. I then read the
 * prose, set it to 0, was told the house had two doors, reverted it, and was
 * told it has one. A test is cheaper than that sequence.
 *
 * It also carries weight for a new player: thirteen houses admit at rung 2 or
 * below while a fresh life knows exactly one house by name, so a door that is
 * open by design is worth keeping open by test.
 */
const OPEN_AT_THE_FLOOR = ['Azure Cloud Pavilion', 'Azure Dew Sect', 'Azure Mist Court'] as const;

describe('the Azure houses', () => {
    it('names exactly three, so the rule has no silent exception', () => {
        const named = SECTS.filter(s => s.name.startsWith('Azure')).map(s => s.name).sort();
        expect(named).toEqual([...OPEN_AT_THE_FLOOR]);
    });

    it('all admit from ordinal 0', () => {
        const bars = OPEN_AT_THE_FLOOR.map(name => {
            const sect = SECTS.find(s => s.name === name);
            expect(sect, `${name} is missing from the catalog`).toBeDefined();
            return [name, sect!.admissionOrdinal] as const;
        });
        expect(Object.fromEntries(bars)).toEqual({
            'Azure Cloud Pavilion': 0,
            'Azure Dew Sect': 0,
            'Azure Mist Court': 0
        });
    });
});
