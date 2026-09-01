/**
 * Siphoning a sect's reserves.
 *
 * Found by playtesting: betrayal had no route at all. A player could climb to
 * the top rung of a house, hold every key it had, and the only thing the engine
 * would let them do about it was resign. Worse, "I take the sect treasury and
 * leave in the night" matched the word "leave" and quietly processed the
 * resignation without the theft - the player asked to rob the place and got a
 * polite exit interview.
 *
 * These tests are about the shape of the replacement rather than its tuning:
 * that access is the rank, that patience is a real strategy with a real limit,
 * and that nobody drains a house.
 */

import { describe, it, expect } from 'vitest';
import { SECTS, getSect } from '../../../src/data/cultivation/sects.js';
import {
    CERTAIN_DISCOVERY,
    DEPLETION_WEIGHT,
    RESERVE_ACCESS_FRACTION,
    SIPHON_PACES,
    baseReservesFor,
    canReachReserves,
    discoveryChance,
    drawForPeriod,
    noticeFromDraw,
    noticeFromShortfall,
    reservesRemaining,
    resolveDiscovery,
    siphonPeriod,
    type SiphonPace
} from '../../../src/engine/cultivation/embezzlement.js';

const PACES: SiphonPace[] = ['careful', 'steady', 'greedy'];

/** Run a house dry-ish at one pace, and report where it ended. */
function runUntil(
    sectId: string,
    pace: SiphonPace,
    stopAt: number
): { months: number; taken: number; share: number } {
    const sect = getSect(sectId)!;
    const base = baseReservesFor(sect.stipend);
    const top = sect.ranks.length - 1;
    let state = { drawNotice: 0, takenTotal: 0 };
    let months = 0;

    while (months < 5000) {
        const period = siphonPeriod(state, base, pace, top, sect.ranks.length);
        state = { drawNotice: period.drawNotice, takenTotal: period.takenTotal };
        months++;
        if (period.discoveryChance >= stopAt) break;
    }
    return { months, taken: state.takenTotal, share: state.takenTotal / base };
}

describe('access is the rank', () => {
    it('keeps every disciple away from the reserves', () => {
        for (const sect of SECTS) {
            expect(canReachReserves(0, sect.ranks.length), `${sect.id} rung 0`).toBe(false);
        }
    });

    it('opens them to the top rung of every house', () => {
        for (const sect of SECTS) {
            expect(
                canReachReserves(sect.ranks.length - 1, sect.ranks.length),
                `${sect.id} top rung`
            ).toBe(true);
        }
    });

    it('opens at the same relative height whatever the ladder length', () => {
        // Five-rung and six-rung houses must mean the same thing by "senior",
        // which is why the gate is a fraction and not an index.
        for (const rankCount of [3, 4, 5, 6, 8]) {
            const opens = Array.from({ length: rankCount }, (_, i) => i)
                .findIndex(i => canReachReserves(i, rankCount));
            const height = opens / (rankCount - 1);
            expect(height, `ladder of ${rankCount}`).toBeGreaterThanOrEqual(RESERVE_ACCESS_FRACTION - 0.2);
            expect(height, `ladder of ${rankCount}`).toBeLessThanOrEqual(1);
        }
    });

    it('is a crime a house has to promote somebody into', () => {
        // The whole point of the mechanic: it becomes available exactly when
        // the player has spent the run earning the right to commit it.
        const sect = getSect('sect-azure-dew-sect')!;
        const reachable = sect.ranks.filter((_, i) => canReachReserves(i, sect.ranks.length));
        expect(reachable.length).toBeGreaterThan(0);
        expect(reachable.length).toBeLessThan(sect.ranks.length);
    });
});

describe('the reserves are a function of what the house pays out', () => {
    it('gives every sect a reserve, scaled to its stipend ladder', () => {
        for (const sect of SECTS) {
            expect(baseReservesFor(sect.stipend), sect.id).toBeGreaterThan(0);
        }
    });

    it('makes a richer house hold more', () => {
        const dew = baseReservesFor(getSect('sect-azure-dew-sect')!.stipend);
        const pavilion = baseReservesFor(getSect('sect-azure-cloud-pavilion')!.stipend);
        expect(pavilion).toBeGreaterThan(dew);
    });

    it('never reports a negative remainder, however much was taken', () => {
        const stipend = getSect('sect-azure-dew-sect')!.stipend;
        expect(reservesRemaining(stipend, baseReservesFor(stipend) * 10)).toBe(0);
    });
});

describe('patience is a strategy, and it has a limit', () => {
    it('lets a careful thief run far longer before the risk bites', () => {
        const careful = runUntil('sect-azure-dew-sect', 'careful', 0.1);
        const greedy = runUntil('sect-azure-dew-sect', 'greedy', 0.1);
        expect(careful.months).toBeGreaterThan(greedy.months * 5);
    });

    it('pays the careful thief more in the end than the greedy one', () => {
        const careful = runUntil('sect-azure-dew-sect', 'careful', 0.5);
        const greedy = runUntil('sect-azure-dew-sect', 'greedy', 0.5);
        expect(careful.taken).toBeGreaterThan(greedy.taken);
    });

    it('lets nobody drain a house, at any pace', () => {
        // The defect this replaced: with notice charged only on each draw, a
        // patient thief took 99% of the reserves over eighty-nine years and was
        // never caught. Patience beat the system completely, which is not a
        // betrayal, it is a payroll.
        for (const pace of PACES) {
            for (const sectId of ['sect-azure-dew-sect', 'sect-azure-cloud-pavilion']) {
                const run = runUntil(sectId, pace, 0.5);
                expect(run.share, `${sectId} at ${pace}`).toBeLessThan(0.5);
            }
        }
    });

    it('charges the hole itself, however slowly it was made', () => {
        // The term that cannot be outwaited.
        expect(noticeFromShortfall(0, 1000)).toBe(0);
        expect(noticeFromShortfall(500, 1000)).toBeCloseTo(50 * DEPLETION_WEIGHT, 5);
        // Half the reserves gone is on its own past certainty.
        expect(noticeFromShortfall(500, 1000)).toBeGreaterThan(CERTAIN_DISCOVERY);
    });
});

describe('the house notices proportions, and it notices the rung less', () => {
    it('charges more notice for a bigger share of the same reserve', () => {
        const small = noticeFromDraw(10, 1000, 'steady', 3, 5);
        const large = noticeFromDraw(100, 1000, 'steady', 3, 5);
        expect(large).toBeGreaterThan(small);
    });

    it('charges the same share less at a senior rank', () => {
        // The people who audit the reserves report to the person taking them.
        const junior = noticeFromDraw(100, 1000, 'steady', 3, 6);
        const senior = noticeFromDraw(100, 1000, 'steady', 5, 6);
        expect(senior).toBeLessThan(junior);
    });

    it('charges a faster pace more for the same share', () => {
        const careful = noticeFromDraw(100, 1000, 'careful', 4, 5);
        const greedy = noticeFromDraw(100, 1000, 'greedy', 4, 5);
        expect(greedy).toBeGreaterThan(careful);
    });

    it('orders the paces by what they take and what they cost', () => {
        let previousDraw = 0;
        let previousNotice = 0;
        for (const pace of PACES) {
            const draw = drawForPeriod(100_000, pace);
            expect(draw, pace).toBeGreaterThan(previousDraw);
            expect(SIPHON_PACES[pace].noticeMultiplier, pace).toBeGreaterThan(previousNotice);
            previousDraw = draw;
            previousNotice = SIPHON_PACES[pace].noticeMultiplier;
        }
    });
});

describe('discovery', () => {
    it('is impossible at zero suspicion and certain at the ceiling', () => {
        expect(discoveryChance(0)).toBe(0);
        expect(discoveryChance(CERTAIN_DISCOVERY)).toBe(1);
        expect(discoveryChance(CERTAIN_DISCOVERY * 5)).toBe(1);
    });

    it('rises faster than linearly, so stopping early is genuinely safe', () => {
        // At half the suspicion the risk is a quarter, not a half. A thief who
        // stops is safe; one who keeps going past the middle is stalling.
        expect(discoveryChance(CERTAIN_DISCOVERY / 2)).toBeCloseTo(0.25, 5);
        expect(discoveryChance(CERTAIN_DISCOVERY / 2)).toBeLessThan(0.5);
    });

    it('never decays between periods', () => {
        const sect = getSect('sect-azure-dew-sect')!;
        const base = baseReservesFor(sect.stipend);
        let state = { drawNotice: 0, takenTotal: 0 };
        let previous = 0;
        for (let month = 0; month < 40; month++) {
            const period = siphonPeriod(state, base, 'steady', 4, sect.ranks.length);
            expect(period.suspicion).toBeGreaterThanOrEqual(previous);
            previous = period.suspicion;
            state = { drawNotice: period.drawNotice, takenTotal: period.takenTotal };
        }
    });

    it('takes back what is left and not what is spent', () => {
        const outcome = resolveDiscovery(300, 1000, 250);
        expect(outcome.expelled).toBe(true);
        expect(outcome.recovered).toBe(300);
        expect(outcome.contributionForfeited).toBe(250);
        expect(outcome.markedAsThief).toBe(true);

        // A thief who spent it all keeps what they bought.
        expect(resolveDiscovery(0, 1000, 0).recovered).toBe(0);
    });
});

describe('a period is self-consistent', () => {
    it('never takes more than is there, and never goes negative', () => {
        const sect = getSect('sect-azure-dew-sect')!;
        const base = baseReservesFor(sect.stipend);
        let state = { drawNotice: 0, takenTotal: 0 };
        for (let month = 0; month < 500; month++) {
            const period = siphonPeriod(state, base, 'greedy', 4, sect.ranks.length);
            expect(period.taken).toBeGreaterThanOrEqual(0);
            expect(period.reservesAfter).toBeGreaterThanOrEqual(0);
            expect(period.takenTotal).toBeLessThanOrEqual(base);
            expect(period.reservesAfter + period.takenTotal).toBe(base);
            state = { drawNotice: period.drawNotice, takenTotal: period.takenTotal };
        }
    });

    it('takes nothing from a house that has nothing left', () => {
        const period = siphonPeriod({ drawNotice: 0, takenTotal: 1000 }, 1000, 'greedy', 4, 5);
        expect(period.taken).toBe(0);
        expect(period.discoveryChance).toBe(1);
    });
});
