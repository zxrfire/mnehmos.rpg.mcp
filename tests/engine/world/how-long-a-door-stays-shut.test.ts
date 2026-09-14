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
 * ── AND THE WINDOW HAD THE WAIT BACKWARDS ────────────────────────────────
 *
 * The window used to be read off the seal ALONE, descending 90/60/30/14/7 by
 * danger tier, and the two figures were kept deliberately apart so that one
 * axis did not wear two names. Crossed with the wait, that produced the one
 * door in the world nobody can use: the richest, fiercest site waited six
 * centuries and stood open SEVEN DAYS, and seven days was the mode at 32 of 72
 * scheduled sites.
 *
 * The ruling it contradicted was attached to a SIXTY year cycle - *"open for as
 * short as a week and closed for the next 59 years and 51 weeks"* - and named
 * as the fastest-to-close case rather than the exemplar. A door that comes round
 * once in six centuries is a date the province has known for generations.
 *
 * So the window is now the WAIT's band, with the seal picking a place inside it,
 * and a week is the floor of the shortest wait. Measured over the same twelve
 * pinned worlds with `probe-can-anybody-be-standing-there-on-the-day.ts`, both
 * arms through `beingAtADoorOnTheDayItOpens` and both charging the depth of the
 * deepest wing:
 *
 *                          walk in and out   need a fold   nobody makes it
 *   old window, knows the date       30.0%          5.0%             65.0%
 *   new window, knows the date       75.0%          8.3%             16.7%
 *   old window, hears it is open     23.2%          6.3%             70.6%
 *   new window, hears it is open     43.9%         17.8%             38.2%
 *
 * WHAT THESE ASSERT is which record each figure comes off and how they relate:
 *
 *   the wait     what is behind the door - its qi band and the size of the
 *                hoard sealed in with it. Unchanged.
 *   the window   the wait's own band, and then the rung the trials were
 *                calibrated for picking a place inside that band.
 *
 * The counts above are provenance, not assertions. Nothing here pins a seed.
 */

import { describe, it, expect } from 'vitest';
import {
    A_HOARD_WORTH_WAITING_FOR,
    CYCLE_YEARS,
    SHORTEST_WINDOW_DAYS,
    WINDOW_DAYS_BY_WAIT,
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

    it('reads the wait off the hoard and the window off the wait and then the seal', () => {
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

        // Same seal, poorer ground: the wait shortens and the window comes down
        // with it. A shorter wait is a smaller band, which is the correction -
        // a door that comes round every sixty years does not have to stand open
        // as long as one the world gets once in six centuries.
        const poor = scheduleForAnAncientSite({
            id: onASchedule, qiDensity: ORDINARY, dangerOrdinal: A_MILD_SEAL,
            hoardCount: 0, sealedYear: 400
        });
        expect(poor).not.toBeNull();
        expect(poor!.periodDays).toBeLessThan(mild!.periodDays);
        expect(poor!.openDays).toBeLessThan(mild!.openDays);
    });

    it('gives the fiercest ground the shortest window of its own band', () => {
        for (const wait of [CYCLE_YEARS.short, CYCLE_YEARS.middling, CYCLE_YEARS.long]) {
            expect(windowDaysFor(wait, A_FIERCE_SEAL))
                .toBeLessThan(windowDaysFor(wait, A_MILD_SEAL));
            // Descending the whole way inside a band. A tier that bought MORE
            // window would make the fiercest ground the easiest to be standing
            // at, which was the original defect and is still one.
            const band = WINDOW_DAYS_BY_WAIT[wait];
            for (let i = 1; i < band.length; i++) {
                expect(band[i]).toBeLessThan(band[i - 1]);
            }
        }
    });

    it('never lets a longer wait buy a shorter window than a shorter one', () => {
        // The defect this table was rewritten against: the six-century door
        // stood open seven days because danger alone decided the window, so the
        // one opening the whole world would converge on reached nobody.
        for (const seal of [A_MILD_SEAL, 14, 18, 22, A_FIERCE_SEAL]) {
            expect(windowDaysFor(CYCLE_YEARS.long, seal))
                .toBeGreaterThan(windowDaysFor(CYCLE_YEARS.middling, seal));
            expect(windowDaysFor(CYCLE_YEARS.middling, seal))
                .toBeGreaterThan(windowDaysFor(CYCLE_YEARS.short, seal));
        }
    });

    it('puts the week on the shortest wait and lets nothing go below it', () => {
        expect(windowDaysFor(CYCLE_YEARS.short, A_FIERCE_SEAL)).toBe(SHORTEST_WINDOW_DAYS);
        for (const wait of [CYCLE_YEARS.short, CYCLE_YEARS.middling, CYCLE_YEARS.long]) {
            for (const seal of [0, A_MILD_SEAL, 14, 18, 22, A_FIERCE_SEAL, 46]) {
                expect(windowDaysFor(wait, seal)).toBeGreaterThanOrEqual(SHORTEST_WINDOW_DAYS);
            }
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
