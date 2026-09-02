import { describe, expect, it } from 'vitest';

import {
    couldHoldAChildAtZero,
    doorsOf,
    housesWithTwoDoors,
    howAChildAtZeroGetsIn,
    placementsAWordWouldOpen,
    spendAWord,
    wasPlaced,
    whatTheNameReaches,
    whoCanHoldAChildAtZero
} from '../../../src/engine/birth/spending-a-word-to-place-a-child.js';
import { ORIGIN_TIERS, placementsWithinReach, type PlacementCandidate } from '../../../src/engine/cultivation/origin.js';
import { SECTS } from '../../../src/data/cultivation/sects.js';

const HOUSES: PlacementCandidate[] = SECTS.map(s => ({
    id: s.id,
    powerOrdinal: s.powerOrdinal,
    admissionOrdinal: s.admissionOrdinal
}));

const PAVILION = 'sect-azure-cloud-pavilion';

describe('the Pavilion has two doors and only one of them is the door', () => {
    it('keeps membership and probation apart', () => {
        const doors = doorsOf(PAVILION)!;
        expect(doors.guestFromOrdinal, 'the real door stands at the floor').toBe(0);
        expect(
            doors.membershipOrdinal,
            'membership is a different and higher bar, and it has never moved'
        ).toBeGreaterThan(0);
        expect(doors.lowestDoor).toBe(0);
    });

    it('is the only house in the world with a second door', () => {
        expect(housesWithTwoDoors().map(d => d.factionId)).toEqual([PAVILION]);
    });

    it('is already open, so a word buys nothing there', () => {
        expect(howAChildAtZeroGetsIn(PAVILION)).toBe('walks up');
        for (const tier of ORIGIN_TIERS) {
            expect(
                placementsAWordWouldOpen(tier.key, 0, HOUSES).map(h => h.id),
                'a word never opens the Pavilion, because it needs no opening'
            ).not.toContain(PAVILION);
        }
        expect(spendAWord({
            askerId: 'asker', childId: 'child', houseId: PAVILION,
            askedOfId: 'friend', onDay: 1
        })).toBe('already open');
    });

    it('stands above every origin\'s reach, so nobody is ever placed there', () => {
        const pavilion = SECTS.find(s => s.id === PAVILION)!;
        for (const tier of ORIGIN_TIERS) {
            expect(
                pavilion.powerOrdinal,
                `${tier.key} cannot reach the Pavilion, so it is walked up to or not entered`
            ).toBeGreaterThan(tier.placement.reach);
        }
    });
});

describe('a child at ordinal zero, and the tally the catalog owns', () => {
    it('partitions the whole sect catalog with nothing left over', () => {
        const { walksUp, needsAWord, barWillNotMove, noDoorToSkip } = whoCanHoldAChildAtZero();
        const total =
            walksUp.length + needsAWord.length + barWillNotMove.length + noDoorToSkip.length;
        expect(total, 'every sect has exactly one answer').toBe(SECTS.length);
        expect(couldHoldAChildAtZero().length).toBe(walksUp.length + needsAWord.length);
    });

    it('has more houses reachable with a word than without one', () => {
        const { walksUp, needsAWord } = whoCanHoldAChildAtZero();
        expect(
            needsAWord.length,
            'if this were not so the mechanic would buy nothing'
        ).toBeGreaterThan(walksUp.length);
    });

    it('names both postings, and only one of them is a sect', () => {
        // The correction. There are two bodies with no door at all - the Root
        // Sill Court and the Kiln Court - but they live in different catalogs,
        // so a tally that reports two postings against the sect catalog is off
        // by one. `sect-kiln-wardens` IS the Root Sill Court, despite the id.
        expect(howAChildAtZeroGetsIn('sect-kiln-wardens')).toBe('no door to skip');
        expect(howAChildAtZeroGetsIn('court-kiln')).toBe('no door to skip');
        expect(
            whoCanHoldAChildAtZero().noDoorToSkip,
            'the Kiln Court is in COURTS, not in SECTS, so it is not in this list'
        ).toEqual(['sect-kiln-wardens']);
        expect(SECTS.some(s => s.id === 'court-kiln')).toBe(false);
    });
});

describe('what a great name is actually worth at seven years old', () => {
    // The greatest NAME in the table, derived rather than taken off the end of
    // it. Since the top row split into three routes the last row is a child
    // placed at a house on somebody's word, who has no name of their own to
    // use and no word left to spend - so "the last tier" and "the biggest
    // name" stopped being the same row.
    const top = ORIGIN_TIERS.reduce(
        (a, b) => (b.placement.reach > a.placement.reach ? b : a)
    );

    it('without a word, resolves to houses that take anybody', () => {
        // This is the defect `docs/world/houses/origin.md` used to describe as
        // "a good allied sect at an age when it matters". Every house a Dao
        // house's name reaches at ordinal zero admits at the floor, so the
        // greatest name in the province buys what an afternoon's walk buys.
        const qualified = placementsWithinReach(top.key, 0, HOUSES);
        expect(qualified.length).toBeGreaterThan(0);
        for (const house of qualified) {
            expect(
                howAChildAtZeroGetsIn(house.id),
                `${house.id} would have taken a farmer's child that morning`
            ).toBe('walks up');
        }
    });

    it('with a word, reaches houses standing alone does not', () => {
        const opened = placementsAWordWouldOpen(top.key, 0, HOUSES);
        expect(opened.length).toBeGreaterThan(0);
        const qualifiedIds = new Set(placementsWithinReach(top.key, 0, HOUSES).map(h => h.id));
        for (const house of opened) {
            expect(qualifiedIds.has(house.id), 'the two lists are disjoint').toBe(false);
            expect(house.admissionOrdinal).toBeGreaterThan(0);
        }
    });

    it('is worth nothing at all to a family with no standing', () => {
        const farm = ORIGIN_TIERS[0];
        expect(farm.placement.reach).toBe(0);
        expect(placementsAWordWouldOpen(farm.key, 0, HOUSES)).toEqual([]);
        expect(whatTheNameReaches(farm.key, 0, HOUSES).vouchers).toBe(0);
    });

    it('reports capacity and what that capacity reaches together', () => {
        const reaches = whatTheNameReaches(top.key, 0, HOUSES);
        expect(reaches.vouchers).toBeGreaterThan(0);
        expect(reaches.wordWouldOpen.length).toBeGreaterThan(0);
        expect(reaches.reach).toBe(top.placement.reach);
    });
});

describe('spending one on your own child', () => {
    const ask = {
        askerId: 'seat-of-the-hollow-court',
        childId: 'the-child',
        askedOfId: 'a-friend-of-two-centuries',
        onDay: 4_000
    };

    it('refuses where the bar does not move, whoever is asking', () => {
        expect(spendAWord({ ...ask, houseId: 'sect-hollow-court' })).toBe('bar will not move');
        expect(spendAWord({ ...ask, houseId: 'sect-frostmirror-court' })).toBe('bar will not move');
    });

    it('refuses where there is no door, because a word is the wrong instrument', () => {
        expect(spendAWord({ ...ask, houseId: 'sect-kiln-wardens' })).toBe('no door to skip');
        expect(spendAWord({ ...ask, houseId: 'court-kiln' })).toBe('no door to skip');
    });

    it('refuses a house the catalog has never heard of', () => {
        expect(spendAWord({ ...ask, houseId: 'sect-invented' })).toBe('no such house');
    });

    it('refuses where the child already qualifies, because there is nothing to buy', () => {
        const doors = doorsOf('house-ninefold-ledger')!;
        expect(spendAWord({
            ...ask,
            houseId: 'house-ninefold-ledger',
            childOrdinal: doors.lowestDoor
        })).toBe('child already qualifies');
    });

    it('writes a receipt held by the person asked, about the person who asked', () => {
        const result = spendAWord({ ...ask, houseId: 'house-ninefold-ledger' });
        expect(wasPlaced(result)).toBe(true);
        if (!wasPlaced(result)) return;

        expect(result.obligation.kind).toBe('favor');
        expect(result.obligation.holderId).toBe(ask.askedOfId);
        expect(result.obligation.subjectId).toBe(ask.askerId);
        expect(result.obligation.cause).toBe('sponsored_admission');
        expect(result.obligation.status).toBe('open');
        expect(
            result.obligation.terms,
            'naming a price makes it a transaction that ends, and this one does not'
        ).toBeNull();
        expect(result.obligation.dueOnDay).toBeNull();
        expect(result.obligation.participants).toContain(ask.childId);
    });

    it('is visible to exactly one other person, and never to the public', () => {
        const result = spendAWord({ ...ask, houseId: 'house-ninefold-ledger' });
        if (!wasPlaced(result)) throw new Error('expected a placement');

        expect(result.told).toHaveLength(1);
        expect(result.told[0].holderId).toBe(ask.askedOfId);
        expect(result.told[0].holderKind).toBe('character');
        for (const row of result.told) {
            expect(row.holderKind, 'a word is never spent in public').not.toBe('public');
            expect(row.holderId, 'and the child is not told').not.toBe(ask.childId);
        }
    });

    it('confers no rank and no ordinal, only the bar', () => {
        const result = spendAWord({ ...ask, houseId: 'house-ninefold-ledger' });
        if (!wasPlaced(result)) throw new Error('expected a placement');
        const shape = JSON.stringify(result);
        for (const forbidden of ['realmOrdinal', 'rankIndex', 'cultivationProgress', 'foundation']) {
            expect(shape, `a word must not carry ${forbidden}`).not.toContain(forbidden);
        }
    });

    it('ties the asker to the person asked, in one direction only', () => {
        const result = spendAWord({ ...ask, houseId: 'house-ninefold-ledger' });
        if (!wasPlaced(result)) throw new Error('expected a placement');
        expect(result.tie.fromId).toBe(ask.askerId);
        expect(result.tie.toId).toBe(ask.askedOfId);
        expect(result.tie.roles).toContain('owes_a_favour');
    });
});
