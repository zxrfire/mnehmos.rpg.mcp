/**
 * Two ruins, both shut, and the record could not tell you which kind of shut.
 *
 * `sealed` has carried two states since ruins existed: a door nobody has ever
 * opened, which `ruin_opened` unseals once and tags `emptied`, and a door on an
 * `OpeningCycle` that shuts and unshuts on its own schedule. Everything read it
 * as "nobody gets in now", which is true of both and enough for every consumer
 * there was - so the gap only shows when something wants to WAIT for a door,
 * and waiting is the whole of what a cycle is worth to a player.
 *
 * The discriminator is the cycle, and the cycle turned out to be unreadable
 * where it mattered. `nextOpeningDay` answers null for anything sealed, which
 * is right where `sealed` means a door nobody has opened and wrong where it
 * means the closed half of a schedule - and every seeded ruin carrying a cycle
 * is sealed. Measured over twelve pinned worlds, both arms in one run:
 *
 *                  ruins   with a cycle   open   shut till a season   spent
 *   day 0            144             72      9                   72       0
 *   200 years        445             72    264                   72     217
 *
 *   the old expression could name a day for 3 of those 72 at day 0 and 33 of
 *   72 at two hundred years. It was silent about the rest.
 *
 * And the pass that was supposed to be running them was not running at all.
 * `applyConvergences` reads `nextOpeningDay` on exactly the sealed rows, gets
 * null, and opens nothing; the `open_now` tag it would add is also the gate on
 * the half that shuts them again, so both halves were unreachable. Across the
 * same twelve worlds over two hundred years each, the world opened or shut
 * **zero** doors on its own. That is a separate defect, in
 * `the-world-changing-on-its-own.ts`, and it is not fixed here.
 *
 * What is asserted below is the DISTINCTION and the day, never the counts: the
 * counts are a property of the seed and are recorded here as provenance.
 */

import { describe, it, expect } from 'vitest';
import {
    makeLocation,
    makeThresholds,
    type LocationRecord
} from '../../../src/engine/world/locations.js';
import {
    howThisGroundIsShut,
    SPENT
} from '../../../src/engine/world/a-door-that-closes-is-not-a-door-nobody-opened.js';

const YEAR = 365;

function ruin(opts: Partial<LocationRecord> = {}): LocationRecord {
    return makeLocation({
        id: 'loc-ruin-1',
        name: 'Cold Spring',
        kind: 'ruin',
        qiDensity: 80,
        thresholds: makeThresholds(4, 8, 14, 20),
        sealed: true,
        ...opts
    });
}

/** A door that comes round every forty years and stands open for thirty days. */
const EVERY_FORTY_YEARS = { periodDays: 40 * YEAR, openDays: 30, phaseDay: 0 };

describe('a door that closes is not a door nobody opened', () => {
    it('tells the two apart when the records differ in nothing but the cycle', () => {
        const day = 100 * YEAR + 5;
        const neverOpened = howThisGroundIsShut(ruin(), day);
        const onASchedule = howThisGroundIsShut(ruin({ cycle: EVERY_FORTY_YEARS }), day);

        expect(neverOpened.howItIsShut).toBe('shut_until_somebody_opens_it');
        expect(onASchedule.howItIsShut).toBe('shut_until_its_season');
        expect(neverOpened.howItIsShut).not.toBe(onASchedule.howItIsShut);
    });

    it('says when the next door opens, and how long it stands open', () => {
        const day = 100 * YEAR + 5;
        const read = howThisGroundIsShut(ruin({ cycle: EVERY_FORTY_YEARS }), day);

        expect(read.opensOnDay).not.toBeNull();
        expect(read.opensOnDay!).toBeGreaterThan(day);
        expect(read.daysUntilItOpens).toBe(read.opensOnDay! - day);
        // Within one period, because a schedule that comes round every forty
        // years is never more than forty years away.
        expect(read.daysUntilItOpens!).toBeLessThanOrEqual(EVERY_FORTY_YEARS.periodDays);
        expect(read.openDays).toBe(30);
    });

    it('names no day for the door nobody has opened, because nothing is due', () => {
        const read = howThisGroundIsShut(ruin(), 100 * YEAR);
        expect(read.opensOnDay).toBeNull();
        expect(read.daysUntilItOpens).toBeNull();
        expect(read.openDays).toBe(0);
    });

    it('is a reading of the day and not a state on the record', () => {
        // The same record, twice, and the answer moves because the world moved.
        const site = ruin({ cycle: EVERY_FORTY_YEARS });
        const early = howThisGroundIsShut(site, 41 * YEAR);
        const late = howThisGroundIsShut(site, 79 * YEAR);
        expect(early.daysUntilItOpens!).toBeGreaterThan(late.daysUntilItOpens!);
        expect(site.sealed).toBe(true);
    });

    it('a door standing open reads open whichever kind it is', () => {
        expect(howThisGroundIsShut(ruin({ sealed: false }), 0).howItIsShut).toBe('open');
        expect(howThisGroundIsShut(
            ruin({ sealed: false, cycle: EVERY_FORTY_YEARS }), 5
        ).howItIsShut).toBe('open');
    });

    it('a ruin somebody has already been through is open and says it is spent', () => {
        const read = howThisGroundIsShut(
            ruin({ sealed: false, tags: ['ruin', SPENT] }), 0
        );
        expect(read.howItIsShut).toBe('open');
        expect(read.spent).toBe(true);
        // And an untouched one is not, which is the half that makes it useful.
        expect(howThisGroundIsShut(ruin({ sealed: false }), 0).spent).toBe(false);
    });

    it('a schedule that never comes round is the same fact as no schedule', () => {
        const read = howThisGroundIsShut(
            ruin({ cycle: { periodDays: 0, openDays: 0, phaseDay: 0 } }), 10
        );
        expect(read.howItIsShut).toBe('shut_until_somebody_opens_it');
    });
});
