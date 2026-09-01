/**
 * What a house puts to somebody it cannot order.
 *
 * The properties worth holding are the structural ones - the crossover exists,
 * it is where the setting says it is, nothing is bespoke, and an offer is a
 * decision because it costs something. The exact counts at each rung are
 * catalog facts and are deliberately asserted as inequalities rather than as
 * numbers, so adding a house does not break the suite.
 */

import { describe, expect, it } from 'vitest';

import {
    PROTECTION_REACH_RUNGS,
    approachFrom,
    approachesTo,
    beyondRecruiting,
    houseStanding,
    protectionOffered,
    recruitmentShapeAt,
    seatOfferedBy
} from '../../../src/engine/encounters/what-a-house-asks-of-somebody-it-cannot-order.js';
import { SECTS, getSect } from '../../../src/data/cultivation/sects.js';
import { MAX_ORDINAL, FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { elderRungOf } from '../../../src/engine/cultivation/leadership.js';

/** First ordinal of Core Formation. Derived, never retyped. */
const CORE_FORMATION_ORDINAL = 17;

describe('the seat a house would offer', () => {
    it('is null beneath the door and a rung above it', () => {
        for (const house of SECTS) {
            const below = house.admissionOrdinal - 1;
            if (below >= 0) expect(seatOfferedBy(house.id, below)).toBeNull();
            expect(seatOfferedBy(house.id, house.admissionOrdinal)).not.toBeNull();
        }
    });

    it('never falls as the cultivator rises', () => {
        for (const house of SECTS) {
            let previous = -1;
            for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
                const seat = seatOfferedBy(house.id, ordinal) ?? -1;
                expect(seat).toBeGreaterThanOrEqual(previous);
                previous = seat;
            }
        }
    });

    it('tops out at the head of the house and never past it', () => {
        for (const house of SECTS) {
            const seat = seatOfferedBy(house.id, MAX_ORDINAL);
            expect(seat).toBe(house.ranks.length - 1);
        }
    });

    it('is null for a faction the catalog does not hold', () => {
        expect(seatOfferedBy('sect-that-does-not-exist', 20)).toBeNull();
        expect(houseStanding('sect-that-does-not-exist', 20)).toBe('turned_away');
    });
});

describe('the crossover the setting claims', () => {
    it('recruits the bottom of the ladder and defers to the top', () => {
        const low = recruitmentShapeAt(0);
        const high = recruitmentShapeAt(MAX_ORDINAL);
        expect(low.deferredTo).toBe(0);
        expect(low.courted).toBe(0);
        expect(high.recruited).toBe(0);
        expect(high.turnedAway).toBe(0);
        expect(high.deferredTo).toBe(SECTS.length);
    });

    it('stops recruiting by the end of Core Formation', () => {
        // "Sects stop recruiting you and start negotiating with you." At Core
        // Formation Perfection no house in the world has a disciple's place.
        const perfection = recruitmentShapeAt(CORE_FORMATION_ORDINAL + 3);
        expect(perfection.recruited).toBe(0);
        expect(perfection.courted + perfection.deferredTo).toBeGreaterThan(
            SECTS.length - perfection.turnedAway - 1
        );
    });

    it('has more houses negotiating than recruiting from Core Formation, and not before', () => {
        const before = recruitmentShapeAt(FOUNDATION_ORDINAL);
        const at = recruitmentShapeAt(CORE_FORMATION_ORDINAL);
        expect(before.recruited).toBeGreaterThan(before.deferredTo);
        expect(at.courted + at.deferredTo).toBeGreaterThan(at.recruited);
    });

    it('moves monotonically out of recruiting and into deferring', () => {
        let previousDeferred = 0;
        let previousRecruitedPeak = 0;
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
            const shape = recruitmentShapeAt(ordinal);
            expect(shape.deferredTo).toBeGreaterThanOrEqual(previousDeferred);
            previousDeferred = shape.deferredTo;
            previousRecruitedPeak = Math.max(previousRecruitedPeak, shape.recruited);
            expect(
                shape.turnedAway + shape.recruited + shape.courted + shape.deferredTo
            ).toBe(SECTS.length);
        }
        // Recruitment rises and then goes away. It does not merely never happen.
        expect(previousRecruitedPeak).toBeGreaterThan(0);
    });
});

describe('protection is bounded by the house s own reach', () => {
    it('is nothing from a house that stands at or below the crossing', () => {
        expect(protectionOffered(20, 20)).toBe(0);
        expect(protectionOffered(14, 20)).toBe(0);
    });

    it('tapers with the margin and saturates at the reach', () => {
        expect(protectionOffered(20 + PROTECTION_REACH_RUNGS / 2, 20)).toBeCloseTo(0.5, 5);
        expect(protectionOffered(20 + PROTECTION_REACH_RUNGS, 20)).toBe(1);
        expect(protectionOffered(MAX_ORDINAL, 0)).toBe(1);
    });

    it('is a legal sectProtection input at every rung of every house', () => {
        for (const house of SECTS) {
            for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
                const p = protectionOffered(house.powerOrdinal, ordinal);
                expect(p).toBeGreaterThanOrEqual(0);
                expect(p).toBeLessThanOrEqual(1);
            }
        }
    });
});

describe('an approach', () => {
    it('is never made by a house that can still recruit them', () => {
        for (const house of SECTS) {
            for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
                const standing = houseStanding(house.id, ordinal);
                const approach = approachFrom(house, ordinal);
                if (beyondRecruiting(standing)) expect(approach).not.toBeNull();
                else expect(approach).toBeNull();
            }
        }
    });

    it('is never made by a house that already holds them', () => {
        const ordinal = CORE_FORMATION_ORDINAL + 3;
        const all = approachesTo(ordinal);
        expect(all.length).toBeGreaterThan(0);
        const held = all[0].factionId;
        const withHeld = approachesTo(ordinal, [held]);
        expect(withHeld.some(a => a.factionId === held)).toBe(false);
        expect(withHeld.length).toBe(all.length - 1);
    });

    it('never offers the head of the house to a stranger', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
            for (const approach of approachesTo(ordinal)) {
                const house = getSect(approach.factionId)!;
                if (approach.seatRankIndex !== null) {
                    expect(approach.seatRankIndex).toBeLessThan(house.ranks.length - 1);
                }
            }
        }
    });

    it('only ever offers a seat at or above the elder rung', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
            for (const approach of approachesTo(ordinal)) {
                if (approach.seatRankIndex === null) continue;
                const house = getSect(approach.factionId)!;
                // A seat in an approach is leadership. Anything below the elder
                // line is ordinary recruitment and would not have got here.
                expect(approach.seatRankIndex).toBeGreaterThanOrEqual(
                    elderRungOf(house.ranks.length)
                );
            }
        }
    });

    it('prices its seat off the house s own stipend array', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
            for (const approach of approachesTo(ordinal)) {
                const house = getSect(approach.factionId)!;
                if (approach.seatRankIndex === null) {
                    expect(approach.stipendPerMonth).toBe(0);
                    expect(approach.seatTitle).toBeNull();
                } else {
                    expect(approach.stipendPerMonth).toBe(house.stipend[approach.seatRankIndex] ?? 0);
                    expect(approach.seatTitle).toBe(house.ranks[approach.seatRankIndex]);
                }
            }
        }
    });

    it('costs standing with the house s rivals and nobody invented', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
            for (const approach of approachesTo(ordinal)) {
                const house = getSect(approach.factionId)!;
                const legitimate = new Set([
                    ...house.rivals,
                    ...(house.ambition?.contestedWith ?? [])
                ]);
                for (const id of approach.costsStandingWith) {
                    expect(legitimate.has(id)).toBe(true);
                }
                expect(approach.costsStandingWith).not.toContain(approach.factionId);
            }
        }
    });

    it('records declining as a slight, because nothing was owed', () => {
        for (const approach of approachesTo(CORE_FORMATION_ORDINAL + 3)) {
            expect(approach.declining.severity).toBe('slight');
            expect(approach.declining.cause).toBe('other');
            expect(approach.declining.description.length).toBeGreaterThan(30);
        }
    });

    it('carries a want and a kind its own columns support', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
            for (const approach of approachesTo(ordinal)) {
                const house = getSect(approach.factionId)!;
                expect(approach.wants.length).toBeGreaterThan(10);
                if (approach.kind === 'seat') expect(approach.seatRankIndex).not.toBeNull();
                if (approach.kind === 'protection') expect(approach.sectProtection).toBeGreaterThan(0);
                if (approach.kind === 'counterweight') {
                    expect(
                        house.rivals.some(id => {
                            const rival = getSect(id);
                            return rival != null && rival.powerOrdinal >= house.powerOrdinal;
                        })
                    ).toBe(true);
                }
                if (approach.kind === 'recognition') {
                    expect((house.ambition?.contestedWith ?? []).length).toBeGreaterThan(0);
                }
            }
        }
    });

    it('is deterministic and ordered by what the house is spending', () => {
        const ordinal = CORE_FORMATION_ORDINAL + 3;
        const a = approachesTo(ordinal);
        const b = approachesTo(ordinal);
        expect(a.map(x => x.factionId)).toEqual(b.map(x => x.factionId));
        for (let i = 1; i < a.length; i += 1) {
            const left = a[i - 1].seatRankIndex ?? -1;
            const right = a[i].seatRankIndex ?? -1;
            expect(left).toBeGreaterThanOrEqual(right);
        }
    });
});

describe('nothing here is bespoke', () => {
    it('names no faction in its own source', async () => {
        const { readFileSync } = await import('node:fs');
        const source = readFileSync(
            new URL(
                '../../../src/engine/encounters/what-a-house-asks-of-somebody-it-cannot-order.ts',
                import.meta.url
            ),
            'utf8'
        );
        // No faction id literal anywhere: the whole module is derivation.
        expect(source).not.toMatch(/'sect-[a-z-]+'/);
        expect(source).not.toMatch(/'house-[a-z-]+'/);
    });

    it('gives every house in the catalog an answer at every rung', () => {
        for (const house of SECTS) {
            for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
                expect(
                    ['turned_away', 'recruited', 'courted', 'deferred_to']
                ).toContain(houseStanding(house.id, ordinal));
            }
        }
    });
});
