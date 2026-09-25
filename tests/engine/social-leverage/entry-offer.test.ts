/**
 * WHERE A HOUSE SEATS SOMEBODY JOINING IT.
 *
 * THE RULING THIS FILE PINS NOW, from the design owner, on every house alike,
 * the top ones included: *"same lore. join as outer disciple or external elder.
 * if you're overqualified you promote FAST cuz you can take merit missions and
 * do them easily."* Two seats: the bottom rung, or the house's lowest elder
 * rung for somebody who clears the bar an insider is held to there
 * (`whatAnInsiderMustStandAt`; the owner: *"it ought to be the same bar as
 * internal elder, just external"*). Nothing between, and nobody seated by
 * their standing - and somebody who clears it may still ask for the bottom.
 *
 * WHAT IT REPLACED, AND WHY THAT IS RECORDED RATHER THAN DELETED. This file
 * used to pin a different ruling of the owner's: *"they might offer something
 * one rung below what their own cultivators have at 29... or if you are
 * renowned they might offer sword elder regardless"*. A newcomer was seated one
 * rung under the house's own people at their height, and a renowned one level
 * with or above them. It was measured against the lookup before it (442 probes
 * across the catalog, the lookup above the peer offer in 234, mean overshoot
 * 0.89 ranks) and it was a real improvement on that lookup. The new ruling
 * removes seating by standing altogether, so the peer reference, the renown
 * bands and the silent-roster cases went with it, and so did the old lookup
 * (`entryRankIndexFor`) and the catalog's `arrivalStateFor`, which said the
 * bottom-rung rule of the apexes alone and had no caller. Renown still decides
 * one thing, whether the door opens at all.
 *
 * AND WHY THE OVERQUALIFIED ARE NOT HELD BACK BY IT: the board offers work by
 * the strength of whoever takes it, not by their rung, and pays by that
 * strength. `a-newcomer-rises-by-merit.test.ts` measures how fast.
 */

import { describe, expect, it } from 'vitest';

import { SECTS, getSect } from '../../../src/data/cultivation/sects';
import { ARRIVAL_RULES } from '../../../src/data/cultivation/governance-and-water-rights';
import { elderRungOf } from '../../../src/engine/cultivation/leadership';
import { whatAnInsiderMustStandAt } from '../../../src/engine/world/promotion-inside-a-house';
import {
    entryOfferFor,
    offerAtTheDoorOf,
    renownReading
} from '../../../src/engine/social-leverage/entry-offer';

const RECRUITING = SECTS.filter(s => s.recruits);

// ─────────────────────────────────────────────────────────────────────────
// THE TWO SEATS
// ─────────────────────────────────────────────────────────────────────────

describe('the seat a newcomer is given', () => {
    it('is the bottom rung or the elder\'s seat, at every house and every height, and nothing between', () => {
        let bottom = 0;
        let elder = 0;
        for (const sect of RECRUITING) {
            for (let ordinal = 0; ordinal <= 44; ordinal++) {
                const offer = offerAtTheDoorOf(sect.id, ordinal)!;
                expect(offer.offered === ARRIVAL_RULES.entryRankIndex || offer.offered === offer.elderRung,
                    `${sect.id} seated ordinal ${ordinal} at ${offer.offered}`).toBe(true);
                if (offer.offered === ARRIVAL_RULES.entryRankIndex) bottom++; else elder++;
            }
        }
        // Both seats are reached, or this asserts one of them away.
        expect(bottom).toBeGreaterThan(0);
        expect(elder).toBeGreaterThan(0);
    });

    it('does not seat anybody by their standing: below the elder\'s bar, the strongest starts where the weakest does', () => {
        for (const sect of RECRUITING) {
            const door = offerAtTheDoorOf(sect.id, 0)!;
            const ceiling = door.elderBar ?? 45;
            for (let ordinal = sect.admissionOrdinal; ordinal < ceiling; ordinal++) {
                expect(offerAtTheDoorOf(sect.id, ordinal)!.offered, `${sect.id} at ${ordinal}`)
                    .toBe(ARRIVAL_RULES.entryRankIndex);
            }
        }
    });

    it('takes in somebody at the insider\'s elder bar as an elder, with no merit in it', () => {
        const sect = getSect('sect-azure-cloud-pavilion')!;
        const rung = elderRungOf(sect.ranks.length);
        const bar = whatAnInsiderMustStandAt(
            sect.id, rung, sect.ranks.length, sect.admissionOrdinal, sect.powerOrdinal);

        const under = offerAtTheDoorOf(sect.id, bar - 1)!;
        const past = offerAtTheDoorOf(sect.id, bar)!;
        expect(under.band).toBe('outer_disciple');
        expect(under.offered).toBe(ARRIVAL_RULES.entryRankIndex);
        expect(past.band).toBe('external_elder');
        expect(past.offered).toBe(rung);
        expect(past.line).toContain('with no merit in it');
    });

    it('never seats anybody at the head of a house', () => {
        for (const sect of RECRUITING) {
            const offer = offerAtTheDoorOf(sect.id, 45, 1)!;
            expect(offer.offered!).toBeLessThan(sect.ranks.length - 1);
        }
    });

    it('says the seat and the elder\'s bar on the mechanical channel', () => {
        const bar = offerAtTheDoorOf('sect-azure-cloud-pavilion', 0)!.elderBar!;
        const offer = offerAtTheDoorOf('sect-azure-cloud-pavilion', bar - 1)!;
        expect(offer.line).toContain('Nobody from outside is seated by what they stand at');
        expect(offer.line).toContain(`from ordinal ${offer.elderBar}`);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// HOW BADLY THEY WANT YOU DECIDES THE DOOR, AND ONLY THE DOOR
// ─────────────────────────────────────────────────────────────────────────

describe('how badly they want you', () => {
    const house = { ranks: ['a', 'b', 'c', 'd', 'e', 'head'], askerOrdinal: 20, elderBar: 30 };

    it('shuts the door on somebody they do not want', () => {
        const offer = entryOfferFor({ ...house, leaning: -0.9 });
        expect(offer.band).toBe('closed_door');
        expect(offer.offered).toBeNull();
        expect(offer.line).toContain('the door does not open');
    });

    it('shuts it just as firmly on somebody they BARELY want', () => {
        // A house does not carry a stranger it is lukewarm about, so a mild
        // dislike is a refusal rather than a lesser offer.
        const offer = entryOfferFor({ ...house, leaning: -0.3 });
        expect(offer.band).toBe('closed_door');
        expect(offer.offered).toBeNull();
    });

    it('opens it with no council read, and on no opinion', () => {
        expect(entryOfferFor(house).offered).toBe(0);
        expect(entryOfferFor({ ...house, leaning: 0 }).offered).toBe(0);
    });

    it('seats a name that travelled exactly where it seats a stranger', () => {
        // The seat was once raised for renown; the owner's "same lore" took
        // that out. Renown is a door, not a rung.
        for (const leaning of [0, 0.3, 0.9, 1]) {
            expect(entryOfferFor({ ...house, leaning }).offered).toBe(0);
            expect(entryOfferFor({ ...house, askerOrdinal: 30, leaning }).offered).toBe(3);
        }
    });

    it('shuts the door on somebody past the elder\'s bar just the same', () => {
        const offer = entryOfferFor({ ...house, askerOrdinal: 40, leaning: -0.9 });
        expect(offer.offered).toBeNull();
    });

    it('has no elder\'s door on a ladder too short to hold one below its head', () => {
        const offer = entryOfferFor({ ranks: ['a', 'b', 'head'], askerOrdinal: 44, elderBar: 0 });
        expect(offer.elderRung).toBeNull();
        expect(offer.offered).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// RENOWN
// ─────────────────────────────────────────────────────────────────────────

describe('renown as a reading rather than a score', () => {
    it('reads zero for a decider the name never reached', () => {
        const read = renownReading([
            { deciderId: 'a', heard: 0, saidToBe: 'nothing said' }
        ]);
        expect(read('a')).toBe(0);
        // And for somebody not on the list at all, which is the common case.
        expect(read('nobody')).toBe(0);
    });

    it('separates a name that travelled well from one that travelled badly', () => {
        const read = renownReading([
            { deciderId: 'a', heard: 3, saidToBe: 'well spoken of' },
            { deciderId: 'b', heard: 3, saidToBe: 'ill spoken of' }
        ]);
        expect(read('a')).toBe(1);
        expect(read('b')).toBe(-1);
    });

    it('does not make a story stronger by being repeated', () => {
        // Repetition is how slander gets its confidence, so volume must not
        // become weight - `what-is-said-about-somebody.ts` is emphatic that
        // nothing upgrades a telling by being retold.
        const once = renownReading([{ deciderId: 'a', heard: 1, saidToBe: 'ill spoken of' }]);
        const often = renownReading([{ deciderId: 'a', heard: 40, saidToBe: 'ill spoken of' }]);
        expect(once('a')).toBe(often('a'));
    });
});
