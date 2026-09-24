/**
 * Somebody taken in from outside above the bottom rung clears more than an
 * insider promoted to it.
 *
 * Ruled by the design owner: *"the bar for hiring an external elder is higher
 * than an internal promotion."* An insider is promoted at the rung's bar with
 * the rung's merit behind them; an outsider has served this house not at all,
 * so they stand `AN_OUTSIDER_STANDS_PAST_THE_BAR_BY` past the same bar. Before
 * this, a house that wanted somebody badly offered them two rungs over the
 * ordinary offer whatever they stood at.
 *
 * Measured over every catalog house at ordinals 0 to 44 (1,710 asks): the
 * ordinary offer, one under the house's own people, is never lowered by it. A
 * house leaning 0.3 towards the asker had 353 offers lowered, by one rung each;
 * leaning 0.8, 402, by 1.86 rungs on average.
 */

import { describe, expect, it } from 'vitest';

import { getSect, SECTS } from '../../../src/data/cultivation/sects';
import { rankRealmBand } from '../../../src/data/cultivation/members';
import { offerAtTheDoorOf } from '../../../src/engine/social-leverage/entry-offer';
import {
    AN_OUTSIDER_STANDS_PAST_THE_BAR_BY,
    theHighestRungAnOutsiderClears,
    whatAnOutsiderMustStandAt
} from '../../../src/engine/world/promotion-inside-a-house';

const HOUSE = SECTS.find(s => s.recruits && s.ranks.length >= 6 && rankRealmBand(s.id, 1) !== undefined)!;

describe('the bar somebody from outside clears', () => {
    it('is the insider bar and a named margin past it, at every rung above the bottom', () => {
        expect(AN_OUTSIDER_STANDS_PAST_THE_BAR_BY).toBeGreaterThan(0);
        for (let rank = 1; rank < HOUSE.ranks.length; rank++) {
            const insider = rankRealmBand(HOUSE.id, rank)!.minOrdinal;
            expect(whatAnOutsiderMustStandAt(
                HOUSE.id, rank, HOUSE.ranks.length, HOUSE.admissionOrdinal, HOUSE.powerOrdinal
            )).toBe(insider + AN_OUTSIDER_STANDS_PAST_THE_BAR_BY);
        }
    });

    it('asks nothing at the bottom rung, where everybody from outside starts', () => {
        expect(whatAnOutsiderMustStandAt(
            HOUSE.id, 0, HOUSE.ranks.length, HOUSE.admissionOrdinal, HOUSE.powerOrdinal
        )).toBe(0);
    });

    it('seats somebody standing exactly at an insider bar one rung lower than an insider would be', () => {
        const rank = 2;
        const atTheBar = rankRealmBand(HOUSE.id, rank)!.minOrdinal;
        expect(theHighestRungAnOutsiderClears(
            HOUSE.id, atTheBar, rank, HOUSE.ranks.length, HOUSE.admissionOrdinal, HOUSE.powerOrdinal
        )).toBeLessThan(rank);
        expect(theHighestRungAnOutsiderClears(
            HOUSE.id, atTheBar + AN_OUTSIDER_STANDS_PAST_THE_BAR_BY, rank,
            HOUSE.ranks.length, HOUSE.admissionOrdinal, HOUSE.powerOrdinal
        )).toBe(rank);
    });
});

describe('what a house offers at its door', () => {
    it('never offers above the highest rung the asker clears from outside, however warm', () => {
        for (const sect of SECTS) {
            for (let ordinal = 0; ordinal <= 44; ordinal++) {
                const offer = offerAtTheDoorOf(sect.id, ordinal, 0.8)!;
                if (offer.offered === null || offer.offered === 0) continue;
                const needed = whatAnOutsiderMustStandAt(
                    sect.id, offer.offered, sect.ranks.length, sect.admissionOrdinal, sect.powerOrdinal);
                expect(ordinal, `${sect.id} seated ordinal ${ordinal} at rank ${offer.offered}`)
                    .toBeGreaterThanOrEqual(needed);
            }
        }
    });

    it('says so when the bar is what lowered it', () => {
        const sect = getSect(HOUSE.id)!;
        let said = false;
        for (let ordinal = 0; ordinal <= 44 && !said; ordinal++) {
            const offer = offerAtTheDoorOf(sect.id, ordinal, 0.8)!;
            if (offer.line.includes('asks more of somebody from outside')) said = true;
        }
        expect(said).toBe(true);
    });
});
