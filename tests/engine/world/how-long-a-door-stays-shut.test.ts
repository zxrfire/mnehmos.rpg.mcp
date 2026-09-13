/**
 * A door's wait and a door's window are two figures, off two records.
 *
 * Both used to be one uniform draw - `rng.int(120, 600)` years between
 * openings and `rng.int(20, 90)` days open - so neither said anything about
 * the ground it belonged to. Measured over twelve pinned worlds, every world
 * carried the SAME six schedules (the ruin roll is catalog-keyed, so the draw
 * was keyed on an id that does not vary): 141, 387, 549, 558, 560 and 583
 * years, windows 34 to 84 days. The best pocket below the Lid was as easy to
 * be standing at as the shallowest one.
 *
 * The ruling: roughly 60 / 120 / 600 years, longest on the biggest sites,
 * derived from the ground's own record rather than authored per ruin. And the
 * window is DAYS, not the interval - the same twelve worlds now read
 * 60x10 120x36 600x26 on the wait and 7d=32 14d=20 30d=9 60d=8 90d=3 on the
 * window.
 *
 * WHAT THESE ASSERT is that the two figures come off DIFFERENT records, which
 * is the property that stops one axis wearing two names:
 *
 *   the wait     what is behind the door - its qi band and the size of the
 *                hoard sealed in with it.
 *   the window   how fiercely it holds itself shut - the rung its trials were
 *                calibrated for, and nothing else.
 *
 * So a rich pocket behind a mild seal stands open a season, and a poor one
 * behind a Spirit Severing formation gives a week. That row is the whole
 * reason the two are kept apart.
 *
 * The counts above are provenance, not assertions. Nothing here pins a seed.
 */

import { describe, it, expect } from 'vitest';
import {
    A_HOARD_WORTH_WAITING_FOR,
    CYCLE_YEARS,
    WINDOW_DAYS_BY_TIER,
    scheduleForAnAncientSite,
    windowDaysFor,
    worthBehindTheDoor,
    yearsBetweenOpeningsFor
} from '../../../src/engine/world/how-long-a-door-stays-shut.js';
import { QI_BAND_FLOORS } from '../../../src/engine/world/qi-scale.js';
import { FOLD_FLOOR_ORDINAL } from '../../../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';

/** The best ground below the Lid. */
const SPIRIT_TIDE = QI_BAND_FLOORS.spirit_tide + 5;
/** Good ground, and not the best. */
const DENSE = QI_BAND_FLOORS.dense + 5;
/** Ordinary ground. */
const ORDINARY = QI_BAND_FLOORS.normal + 5;

/** Trials a Qi Condensation disciple was meant to sit. */
const A_MILD_SEAL = 4;
/** Trials calibrated for somebody who can already fold space. */
const A_FIERCE_SEAL = FOLD_FLOOR_ORDINAL;

/** An id the convergence draw actually puts on a schedule. */
function aSiteThatCarriesASchedule(): string {
    for (let i = 0; i < 500; i++) {
        const id = `ruin-probe-${i}`;
        const drawn = scheduleForAnAncientSite({
            id, qiDensity: SPIRIT_TIDE, dangerOrdinal: A_MILD_SEAL,
            hoardCount: A_HOARD_WORTH_WAITING_FOR, sealedYear: 400
        });
        if (drawn !== null) return id;
    }
    throw new Error('no site in 500 draws carries a schedule');
}

describe('how long a door stays shut', () => {
    it('puts the longest wait on the richest ground with the biggest hoard', () => {
        const greatest = yearsBetweenOpeningsFor({
            qiDensity: SPIRIT_TIDE,
            hoardCount: A_HOARD_WORTH_WAITING_FOR
        });
        const shallow = yearsBetweenOpeningsFor({
            qiDensity: ORDINARY,
            hoardCount: 1
        });

        expect(greatest).toBe(CYCLE_YEARS.long);
        expect(shallow).toBe(CYCLE_YEARS.short);
        expect(greatest).toBeGreaterThan(shallow);
    });

    it('has all three waits reachable, and no fourth one', () => {
        const seen = new Set<number>();
        for (const qiDensity of [ORDINARY, DENSE, SPIRIT_TIDE]) {
            for (const hoardCount of [0, A_HOARD_WORTH_WAITING_FOR]) {
                seen.add(yearsBetweenOpeningsFor({ qiDensity, hoardCount }));
            }
        }
        expect([...seen].sort((a, b) => a - b))
            .toEqual([CYCLE_YEARS.short, CYCLE_YEARS.middling, CYCLE_YEARS.long]);
    });

    it('reads the window off the seal and the wait off the hoard, not one off both', () => {
        // Three fifths of ancient sites draw no schedule at all, and which do
        // is keyed on the id. Asked for rather than hard-coded, so the test
        // survives the draw moving - the rule this file protects is what the
        // two figures are read off, never which site happens to carry one.
        const onASchedule = aSiteThatCarriesASchedule();

        // Same ground, same hoard, different seal: the window moves, the wait
        // does not.
        const mild = scheduleForAnAncientSite({
            id: onASchedule, qiDensity: SPIRIT_TIDE, dangerOrdinal: A_MILD_SEAL,
            hoardCount: A_HOARD_WORTH_WAITING_FOR, sealedYear: 400
        });
        const fierce = scheduleForAnAncientSite({
            id: onASchedule, qiDensity: SPIRIT_TIDE, dangerOrdinal: A_FIERCE_SEAL,
            hoardCount: A_HOARD_WORTH_WAITING_FOR, sealedYear: 400
        });
        expect(mild).not.toBeNull();
        expect(fierce).not.toBeNull();
        expect(mild!.periodDays).toBe(fierce!.periodDays);
        expect(mild!.openDays).toBeGreaterThan(fierce!.openDays);

        // Same seal, different ground: the wait moves, the window does not.
        const poor = scheduleForAnAncientSite({
            id: onASchedule, qiDensity: ORDINARY, dangerOrdinal: A_MILD_SEAL,
            hoardCount: 0, sealedYear: 400
        });
        expect(poor).not.toBeNull();
        expect(poor!.openDays).toBe(mild!.openDays);
        expect(poor!.periodDays).toBeLessThan(mild!.periodDays);
    });

    it('gives the fiercest ground the shortest window', () => {
        expect(windowDaysFor(A_FIERCE_SEAL)).toBeLessThan(windowDaysFor(A_MILD_SEAL));
        expect(windowDaysFor(A_FIERCE_SEAL)).toBe(WINDOW_DAYS_BY_TIER[WINDOW_DAYS_BY_TIER.length - 1]);
        // Descending the whole way. A tier that bought MORE window would make
        // the best ground the easiest to be standing at, which is the defect.
        for (let i = 1; i < WINDOW_DAYS_BY_TIER.length; i++) {
            expect(WINDOW_DAYS_BY_TIER[i]).toBeLessThan(WINDOW_DAYS_BY_TIER[i - 1]);
        }
    });

    it('opens for days and waits for decades, never the other way round', () => {
        // The design owner had to say this twice: opening on a sixty year cycle
        // does not mean open FOR sixty years. A window that approached its own
        // period would be a door that is simply open.
        for (const qiDensity of [ORDINARY, DENSE, SPIRIT_TIDE]) {
            for (const dangerOrdinal of [A_MILD_SEAL, 14, 18, 22, A_FIERCE_SEAL]) {
                const schedule = scheduleForAnAncientSite({
                    id: `ruin-${qiDensity}-${dangerOrdinal}`,
                    qiDensity, dangerOrdinal, hoardCount: 2, sealedYear: 400
                });
                if (schedule === null) continue;
                expect(schedule.openDays).toBeLessThan(schedule.periodDays / 100);
            }
        }
    });

    it('leaves the worth reading on the record rather than on the schedule', () => {
        // Nothing stores how much is behind a door. It is read off the two
        // columns the ground already carries, so it cannot drift from them.
        expect(worthBehindTheDoor({ qiDensity: SPIRIT_TIDE, hoardCount: 9 }))
            .toBeGreaterThan(worthBehindTheDoor({ qiDensity: DENSE, hoardCount: 9 }));
        expect(worthBehindTheDoor({ qiDensity: SPIRIT_TIDE, hoardCount: 9 }))
            .toBeGreaterThan(worthBehindTheDoor({ qiDensity: SPIRIT_TIDE, hoardCount: 0 }));
    });

    it('leaves most ancient sites with no schedule at all', () => {
        let scheduled = 0;
        const sites = 200;
        for (let i = 0; i < sites; i++) {
            const schedule = scheduleForAnAncientSite({
                id: `ruin-spread-${i}`, qiDensity: DENSE, dangerOrdinal: 12,
                hoardCount: 2, sealedYear: 400
            });
            if (schedule !== null) scheduled++;
        }
        // Most of the map is ground somebody has to go and open. A world where
        // every ruin were on a clock would have no doors nobody opened in it.
        expect(scheduled).toBeGreaterThan(0);
        expect(scheduled).toBeLessThan(sites);
    });
});
