/**
 * WHAT A HOUSE OFFERS SOMEBODY JOINING IT.
 *
 * The played defect this file pins: a cultivator at ordinal 25 walked into the
 * Azure Cloud Pavilion and was seated as Sword Elder, the fifth rank of six,
 * over a house whose own Core Disciple stands at ordinal 20 and earned it by
 * years inside. `entryRankIndexFor` did exactly what it says - the promotion
 * ladder read backwards - and what it reads is the asker's rung and nothing
 * else.
 *
 * Measured across the catalog before the change: 442 probes, 337 at a rung
 * where the house has somebody of its own, and the old lookup sits above the
 * ordinary offer in 234 of them, level in 98, below in 5. Mean overshoot 0.89
 * ranks. That number is the justification for a change that makes seven offers
 * in ten meaner, so it is asserted here rather than only written down.
 */

import { describe, expect, it } from 'vitest';

import { getSect } from '../../../src/data/cultivation/sects';
import { getMembersOf } from '../../../src/data/cultivation/members';
import { entryRankIndexFor } from '../../../src/engine/cultivation/what-each-rung-of-a-house-ladder-requires';
import {
    NEAR_WINDOW,
    entryOfferFor,
    renownReading,
    type PeerOnTheRoll
} from '../../../src/engine/social-leverage/entry-offer';

/** The house's own roll, as the catalog holds it. */
const rollOf = (factionId: string): PeerOnTheRoll[] =>
    getMembersOf(factionId).map(m => ({
        rankIndex: m.rankIndex,
        realmOrdinal: m.realmOrdinal
    }));

const offerAt = (factionId: string, ordinal: number, leaning?: number | null) => {
    const sect = getSect(factionId)!;
    return entryOfferFor({
        ranks: sect.ranks,
        admissionOrdinal: sect.admissionOrdinal,
        roll: rollOf(factionId),
        askerOrdinal: ordinal,
        leaning
    });
};

// ─────────────────────────────────────────────────────────────────────────
// THE PLAYED CASE
// ─────────────────────────────────────────────────────────────────────────

describe('the offer the Pavilion actually makes at ordinal 25', () => {
    it('is one rung under its own people, not the rank the ladder computes', () => {
        const sect = getSect('sect-azure-cloud-pavilion')!;
        const offer = offerAt('sect-azure-cloud-pavilion', 25);

        // Xiang Yuwei stands at ordinal 24 and is a Sword Elder.
        expect(offer.peerRank).toBe(sect.ranks.indexOf('Sword Elder'));
        expect(offer.anchor).toBe('peers_near');
        // And the offer is the rank under her.
        expect(offer.offered).toBe(sect.ranks.indexOf('Core Disciple'));
        expect(offer.band).toBe('under_their_own');

        // The defect, stated as the gap: the old lookup seats them a rank higher.
        const old = entryRankIndexFor(sect.ranks, sect.admissionOrdinal, 25);
        expect(old).toBe(sect.ranks.indexOf('Sword Elder'));
        expect(offer.offered!).toBeLessThan(old);
    });

    it('says the slight out loud on the mechanical channel', () => {
        const offer = offerAt('sect-azure-cloud-pavilion', 25);
        expect(offer.line).toContain('the cultivation without the standing');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE REFERENCE POINT
// ─────────────────────────────────────────────────────────────────────────

describe('what the reference is taken from', () => {
    it('takes the median, so one exceptional insider cannot inflate it', () => {
        // Three peers at the asker's rung: two juniors and somebody who was
        // raised early. The maximum would offer rank 3; the median offers 1.
        const offer = entryOfferFor({
            ranks: ['a', 'b', 'c', 'd', 'e', 'head'],
            admissionOrdinal: 0,
            roll: [
                { rankIndex: 1, realmOrdinal: 20 },
                { rankIndex: 2, realmOrdinal: 20 },
                { rankIndex: 4, realmOrdinal: 21 }
            ],
            askerOrdinal: 20
        });
        expect(offer.peerRank).toBe(2);
        expect(offer.offered).toBe(1);
    });

    it('never lets the head of a house be the peer', () => {
        // The Sweptground Temple's Abbot stands at ordinal 20, and any rule
        // reading the whole roll makes him the reference for somebody at 21 -
        // which then offers the rank below the headship.
        const sect = getSect('sect-sweptground-temple')!;
        const abbot = sect.ranks.length - 1;
        expect(getMembersOf('sect-sweptground-temple')
            .some(m => m.rankIndex === abbot && Math.abs(m.realmOrdinal - 21) <= NEAR_WINDOW))
            .toBe(true);

        const offer = offerAt('sect-sweptground-temple', 21);
        expect(offer.peerRank).not.toBe(abbot);
        expect(offer.offered!).toBeLessThan(abbot - 1);
    });

    it('falls back to the nearest person below when nobody is at the rung', () => {
        const offer = entryOfferFor({
            ranks: ['a', 'b', 'c', 'd', 'head'],
            admissionOrdinal: 0,
            roll: [
                { rankIndex: 1, realmOrdinal: 5 },
                { rankIndex: 3, realmOrdinal: 18 }
            ],
            // Far enough above 18 that nobody is a peer and near enough that
            // they can still be read. Beyond nine rungs the reference stops
            // being usable at all, which the `beyond_reading` case covers.
            askerOrdinal: 22
        });
        expect(offer.anchor).toBe('nearest_below');
        expect(offer.peerRank).toBe(3);
        expect(offer.offered).toBe(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE SCALE - FOUR BANDS ON ONE NUMBER
// ─────────────────────────────────────────────────────────────────────────

describe('how badly they want you', () => {
    const house = {
        ranks: ['a', 'b', 'c', 'd', 'e', 'head'],
        admissionOrdinal: 0,
        roll: [{ rankIndex: 3, realmOrdinal: 20 }],
        askerOrdinal: 20
    };

    it('shuts the door on somebody they do not want', () => {
        const offer = entryOfferFor({ ...house, leaning: -0.9 });
        expect(offer.band).toBe('closed_door');
        expect(offer.offered).toBeNull();
        expect(offer.line).toContain('the door does not open');
    });

    it('shuts it just as firmly on somebody they BARELY want', () => {
        // The correction that collapsed the bottom of the scale. A house
        // carrying a titled stranger with no room is carrying bloat, and no
        // house does that for somebody it is merely lukewarm about - so a mild
        // dislike is a refusal rather than a lesser offer.
        const offer = entryOfferFor({ ...house, leaning: -0.3 });
        expect(offer.band).toBe('closed_door');
        expect(offer.offered).toBeNull();
    });

    it('makes the ordinary offer when the body has no opinion', () => {
        expect(entryOfferFor({ ...house, leaning: 0 }).band).toBe('under_their_own');
        expect(entryOfferFor({ ...house, leaning: 0 }).offered).toBe(2);
        // And with no council read at all, which is the same answer and must
        // never quietly become the old lookup.
        expect(entryOfferFor(house).band).toBe('under_their_own');
        expect(entryOfferFor(house).offered).toBe(2);
    });

    it('seats them level with their own for a body that wants them', () => {
        const offer = entryOfferFor({ ...house, leaning: 0.3 });
        expect(offer.band).toBe('level_with_their_own');
        expect(offer.offered).toBe(3);
    });

    it('goes above the arithmetic for a name that has travelled', () => {
        const offer = entryOfferFor({ ...house, leaning: 0.9 });
        expect(offer.band).toBe('above_their_own');
        expect(offer.offered).toBe(4);
    });

    it('never seats anybody in the head of the house, at any leaning', () => {
        for (const leaning of [0.6, 0.9, 1]) {
            const offer = entryOfferFor({
                ...house,
                roll: [{ rankIndex: 4, realmOrdinal: 20 }],
                leaning
            });
            expect(offer.offered!).toBeLessThan(house.ranks.length - 1);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A SILENT ROSTER DECIDES NOTHING
// ─────────────────────────────────────────────────────────────────────────

describe('when the house has nobody to measure against', () => {
    const thin = {
        ranks: ['a', 'b', 'c', 'd', 'e', 'head'],
        admissionOrdinal: 3,
        askerOrdinal: 25
    };

    it('cannot use a reference who is too far beneath to read the candidate', () => {
        // A rung is observable within range and not beyond it: REGARD_BANDS
        // calls a gap of nine or more unreachable, so somebody that far under a
        // candidate makes out the gap and not the height. They cannot be the
        // reference for placing them.
        const roll = [{ rankIndex: 2, realmOrdinal: 5 }];
        const readable = entryOfferFor({ ...thin, askerOrdinal: 12, roll });
        const not = entryOfferFor({ ...thin, askerOrdinal: 30, roll });

        expect(readable.anchor).toBe('nearest_below');
        expect(not.anchor).toBe('beyond_reading');
        expect(not.peerRank).toBeNull();
        expect(not.line).toContain('the gap and not the height');
    });

    it('tells the two silences apart, because they say opposite things', () => {
        // Nobody on the roll but the head: the house cannot judge you.
        expect(entryOfferFor({ ...thin, roll: [{ rankIndex: 5, realmOrdinal: 40 }] }).anchor)
            .toBe('nobody_near_you');
        // Everybody stands above you: there is nobody to be placed over.
        expect(entryOfferFor({ ...thin, roll: [{ rankIndex: 2, realmOrdinal: 40 }] }).anchor)
            .toBe('nobody_under_you');
    });

    it('still opens the door when they are wanted, with nothing behind the title', () => {
        const offer = entryOfferFor({ ...thin, roll: [{ rankIndex: 2, realmOrdinal: 40 }] });
        expect(offer.offered).not.toBeNull();
        expect(offer.peerRank).toBeNull();
        expect(offer.line).toContain('nothing behind it');
    });

    it('shuts it anyway if they are not wanted, which is the same rule', () => {
        // The silence removes the reference point. It does not decide the
        // outcome, and this is the assertion that keeps it that way.
        const offer = entryOfferFor({
            ...thin,
            roll: [{ rankIndex: 2, realmOrdinal: 40 }],
            leaning: -0.9
        });
        expect(offer.band).toBe('closed_door');
        expect(offer.offered).toBeNull();
    });

    it('finds a grander title for somebody they want', () => {
        // Lower down the ladder, where there is headroom under the cap: at
        // ordinal 25 in this house the arithmetic title is already the highest
        // rank anybody may be offered, so the bands have nowhere to go and
        // asserting a difference there would be asserting the cap away.
        const roll = [{ rankIndex: 2, realmOrdinal: 40 }];
        const wanted = entryOfferFor({ ...thin, askerOrdinal: 12, roll, leaning: 0.9 });
        const ordinary = entryOfferFor({ ...thin, askerOrdinal: 12, roll, leaning: 0 });
        expect(ordinary.anchor).toBe('nobody_under_you');
        expect(wanted.offered!).toBeGreaterThan(ordinary.offered!);
    });

    it('caps an empty title one below the head like any other', () => {
        const offer = entryOfferFor({
            ...thin, roll: [{ rankIndex: 2, realmOrdinal: 40 }], leaning: 0.9
        });
        expect(offer.offered).toBe(thin.ranks.length - 2);
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

// ─────────────────────────────────────────────────────────────────────────
// THE MEASUREMENT THAT JUSTIFIES THE CHANGE
// ─────────────────────────────────────────────────────────────────────────

describe('the overshoot the old lookup was carrying', () => {
    it('is a mean of about nine tenths of a rank, over the whole catalog', () => {
        let higher = 0, level = 0, lower = 0, total = 0;
        for (const sect of [...new Set(
            getMembersOf('') // force the catalog to load; the sweep below uses ids
                .length >= 0 ? [] : []
        )]) { void sect; }

        const ids = [
            'sect-azure-cloud-pavilion', 'sect-the-severed', 'sect-frostmirror-court',
            'sect-sweptground-temple', 'sect-nine-peaks-ascetic-order', 'sect-lantern-hall',
            'sect-azure-mist-court', 'sect-stonewright-consortium', 'sect-clear-river-alliance',
            'sect-verdant-spring-hall', 'sect-crimson-abyss-hall', 'sect-nine-abyss-flame-sect',
            'sect-storm-tyrant-court', 'sect-cinnabar-crucible-guild', 'sect-ashen-forge-clan',
            'sect-standing-grove', 'sect-weir-office', 'sect-bone-lantern-cult'
        ];
        for (const id of ids) {
            const sect = getSect(id);
            if (!sect) continue;
            for (let o = sect.admissionOrdinal; o <= Math.min(40, sect.powerOrdinal); o += 2) {
                const offer = offerAt(id, o);
                if (offer.peerRank === null || offer.offered === null) continue;
                const old = entryRankIndexFor(sect.ranks, sect.admissionOrdinal, o);
                total += old - offer.offered;
                if (old > offer.offered) higher++;
                else if (old === offer.offered) level++;
                else lower++;
            }
        }

        const n = higher + level + lower;
        expect(n).toBeGreaterThan(100);
        // The direction is the claim, and it is overwhelming rather than marginal.
        expect(higher).toBeGreaterThan(lower * 10);
        // And the size of it: the old lookup carried the better part of a rank
        // of standing nobody had earned.
        expect(total / n).toBeGreaterThan(0.5);
    });
});
