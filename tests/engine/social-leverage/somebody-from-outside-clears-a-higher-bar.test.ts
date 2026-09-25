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
 * Measured when it landed, over every catalog house at ordinals 0 to 44 (1,710
 * asks): a house leaning 0.3 towards the asker had 353 offers lowered by it, by
 * one rung each; leaning 0.8, 402, by 1.86 rungs on average. Since the owner's
 * later ruling - *"join as outer disciple or external elder"* - the door asks
 * it of one rung only, the house's lowest elder rung, and seats everybody who
 * does not clear it at the bottom (`entry-offer.test.ts`). The
 * highest-rung-cleared read that capped the old offer went with the offer.
 */

import { describe, expect, it } from 'vitest';

import { getSect, SECTS } from '../../../src/data/cultivation/sects';
import { rankRealmBand } from '../../../src/data/cultivation/members';
import { offerAtTheDoorOf } from '../../../src/engine/social-leverage/entry-offer';
import {
    AN_OUTSIDER_STANDS_PAST_THE_BAR_BY,
    whatAnOutsiderMustStandAt
} from '../../../src/engine/world/promotion-inside-a-house';
import { elderRungOf } from '../../../src/engine/cultivation/leadership';

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

    it('seats somebody standing exactly at the insider bar of the elder rung at the bottom, not as an elder', () => {
        const rung = elderRungOf(HOUSE.ranks.length);
        const atTheBar = rankRealmBand(HOUSE.id, rung)!.minOrdinal;
        expect(offerAtTheDoorOf(HOUSE.id, atTheBar)!.offered).toBe(0);
        expect(offerAtTheDoorOf(HOUSE.id, atTheBar + AN_OUTSIDER_STANDS_PAST_THE_BAR_BY)!.offered).toBe(rung);
    });
});

describe('what a house offers at its door', () => {
    it('never seats anybody above the bottom who does not clear the bar from outside, however warm', () => {
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

    it('says what the elder\'s seat asks when it is not given', () => {
        const sect = getSect(HOUSE.id)!;
        const offer = offerAtTheDoorOf(sect.id, sect.admissionOrdinal, 0.8)!;
        expect(offer.offered).toBe(0);
        expect(offer.line).toContain(`An elder from outside is taken in as`);
        expect(offer.line).toContain(`from ordinal ${offer.elderBar}`);
    });
});
