/**
 * Somebody taken in from outside as an elder clears the bar an insider is held
 * to, and no higher.
 *
 * THE RULING MOVED, AND THIS FILE MOVED WITH IT. It was written for the design
 * owner's *"the bar for hiring an external elder is higher than an internal
 * promotion"*: an outsider stood four ordinals past the insider's bar
 * (`AN_OUTSIDER_STANDS_PAST_THE_BAR_BY`). Measured when that landed, over every
 * catalog house at ordinals 0 to 44, it lowered 353 offers from a house leaning
 * 0.3 and 402 at 0.8. The owner has since ruled: *"it ought to be the same bar
 * as internal elder, just external."* So the door's elder seat and the world's
 * own houses both ask `whatAnInsiderMustStandAt` of the lowest elder rung; at
 * the Azure Cloud Pavilion that is the bar its own Sword Elders are held to.
 */

import { describe, expect, it } from 'vitest';

import { getSect, SECTS } from '../../../src/data/cultivation/sects';
import { offerAtTheDoorOf } from '../../../src/engine/social-leverage/entry-offer';
import { whatAnInsiderMustStandAt } from '../../../src/engine/world/promotion-inside-a-house';
import { elderRungOf } from '../../../src/engine/cultivation/leadership';
import { theRealmARungAsks } from '../../../src/server/consolidated/sect-manage';

describe('the bar somebody from outside clears', () => {
    it('is the bar an insider is held to at the house\'s lowest elder rung, at every recruiting house', () => {
        for (const sect of SECTS.filter(s => s.recruits)) {
            const door = offerAtTheDoorOf(sect.id, 0)!;
            if (door.elderRung === null) continue;
            expect(door.elderBar, sect.id).toBe(theRealmARungAsks(sect, door.elderRung));
            expect(door.elderBar, sect.id).toBe(whatAnInsiderMustStandAt(
                sect.id, door.elderRung, sect.ranks.length, sect.admissionOrdinal, sect.powerOrdinal));
        }
    });

    it('seats somebody standing exactly at it as an elder, and one under it at the bottom', () => {
        const sect = getSect('sect-azure-cloud-pavilion')!;
        const rung = elderRungOf(sect.ranks.length);
        const bar = theRealmARungAsks(sect, rung);
        expect(offerAtTheDoorOf(sect.id, bar)!.offered).toBe(rung);
        expect(offerAtTheDoorOf(sect.id, bar - 1)!.offered).toBe(0);
    });
});

describe('what a house offers at its door', () => {
    it('never seats anybody above the bottom who does not clear the insider\'s bar, however warm', () => {
        for (const sect of SECTS) {
            for (let ordinal = 0; ordinal <= 44; ordinal++) {
                const offer = offerAtTheDoorOf(sect.id, ordinal, 0.8)!;
                if (offer.offered === null || offer.offered === 0) continue;
                expect(ordinal, `${sect.id} seated ordinal ${ordinal} at rank ${offer.offered}`)
                    .toBeGreaterThanOrEqual(theRealmARungAsks(sect, offer.offered));
            }
        }
    });

    it('says what the elder\'s seat asks when it is not given', () => {
        const sect = getSect('sect-azure-cloud-pavilion')!;
        const offer = offerAtTheDoorOf(sect.id, sect.admissionOrdinal, 0.8)!;
        expect(offer.offered).toBe(0);
        expect(offer.line).toContain('An elder from outside is taken in as');
        expect(offer.line).toContain(`from ordinal ${offer.elderBar}`);
    });
});

describe('and somebody who clears it may still come in at the bottom', () => {
    it('takes the bottom rung when they ask for it, and says they cleared the elder\'s bar', () => {
        const sect = getSect('sect-azure-cloud-pavilion')!;
        const bar = offerAtTheDoorOf(sect.id, 0)!.elderBar!;
        const asked = offerAtTheDoorOf(sect.id, bar + 5, 0, true)!;
        expect(asked.band).toBe('outer_disciple');
        expect(asked.offered).toBe(0);
        expect(asked.line).toContain('asked for the bottom rung instead');
        // And a closed door stays closed whatever they ask for.
        expect(offerAtTheDoorOf(sect.id, bar + 5, -0.9, true)!.offered).toBeNull();
    });
});
