/**
 * A ruin on a cycle shuts itself, and the schedule is the only thing that says so.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * A cycled ruin carried `cycle` AND `sealed`, and both claimed to answer "is
 * the door open". The schedule runs forever; the column is written once by
 * whoever touched the row last. When the world's `ruin_opened` pass went
 * through a cycled ruin it wrote `sealed: false` and tagged it `emptied`, and
 * nothing anywhere re-shut it: the site then read `shut_until_its_season` to
 * everything that asked the schedule, and stood permanently open - with the
 * full usable qi the seal had been hiding - to everything that read the column.
 * That is the second copy this repo keeps paying for, on one row, with the two
 * halves in plain disagreement.
 *
 * MEASURED by putting the old filter and the old patch back and running three
 * seeded worlds three hundred years each:
 *
 *             cycled ruins   emptied   still shut by the schedule   open anyway
 *   alpha               14        13                          13             2
 *   bravo                9         9                           9             3
 *   charlie             15        13                          13             4
 *
 *   so the world went through nearly every door on a season inside three
 *   centuries, and two to four per world came out of it permanently unsealed at
 *   full usable qi - 1.00, 0.93, 0.80 against the 0.05 a shut pocket offers -
 *   against a schedule that said shut. The rest were re-shut only by accident,
 *   when the convergence pass happened to own their next window.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * The ruin closes itself. The formation closes, the season turns, the stars
 * fall out of line. Nothing a player does opens one for good and nothing has to
 * go and re-shut it by hand, so the SCHEDULE is the stored fact and `sealed` is
 * a reading of it. `isOpenOn` and `nextOpeningDay` ignore the column wherever a
 * cycle exists, which is what makes it a reading rather than a promise.
 *
 * And the half that followed from it: ground the engine uncovers at runtime
 * used to get no cycle at all - only catalog `Ruin` rows did, through
 * `locationFromRuin` -> `cycleForRuin` - so every door in the world that ever
 * opened was a door somebody had authored. Shutting itself is a fact about
 * ground rather than about which table the row came from, so found ground is
 * put on a schedule by the same derivation and the same share.
 *
 * WHAT IS ASSERTED is the authority and the reading, never a count: which
 * ruins draw a schedule is a property of the seed.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { applyPressure } from '../../../src/engine/world/pressure.js';
import {
    evaluateAccess,
    isOpenOn,
    makeLocation,
    makeThresholds,
    qiFraction,
    type LocationRecord
} from '../../../src/engine/world/locations.js';
import {
    WHAT_SHUTS_IT,
    howThisGroundIsShut,
    whatShutsThisDoor
} from '../../../src/engine/world/a-door-that-closes-is-not-a-door-nobody-opened.js';
import {
    FOUND_BY_PROSPECTING_TAG,
    applyRuinProspecting
} from '../../../src/engine/world/how-the-world-keeps-finding-more-ruins.js';
import { CYCLE_YEARS } from '../../../src/engine/world/how-long-a-door-stays-shut.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

/** A door that comes round every sixty years and stands open thirty days. */
const EVERY_SIXTY_YEARS = { periodDays: 60 * YEAR, openDays: 30, phaseDay: 0 };

function ruin(opts: Partial<LocationRecord> = {}): LocationRecord {
    return makeLocation({
        id: 'loc-ruin-on-a-cycle',
        name: 'Cold Spring',
        kind: 'ruin',
        qiDensity: 80,
        thresholds: makeThresholds(4, 8, 14, 20),
        hazards: ['formation'],
        sealed: true,
        cycle: EVERY_SIXTY_YEARS,
        ...opts
    });
}

/** A day inside a window, and a day outside the same one. */
const OPEN_DAY = 60 * YEAR + 3;
const SHUT_DAY = 60 * YEAR + 40;

/** Somebody who could live there with room to spare, so power is never the bar. */
const STRONG_ENOUGH = { realmOrdinal: 30 };

function world(seed: string): WorldState {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population: 250 }).state;
}

describe('a ruin on a cycle shuts itself', () => {
    it('lets the day decide, whatever the column on the row says', () => {
        // THE TWO-ANSWERS CASE, both ways round. The first row is what the old
        // `ruin_opened` left behind: unsealed for good, against a schedule that
        // says shut. The second is every seeded cycled ruin there is.
        const unsealedForGood = ruin({ sealed: false });
        const seededAndSealed = ruin({ sealed: true });

        expect(isOpenOn(unsealedForGood, SHUT_DAY)).toBe(false);
        expect(isOpenOn(seededAndSealed, OPEN_DAY)).toBe(true);
        expect(isOpenOn(unsealedForGood, OPEN_DAY)).toBe(isOpenOn(seededAndSealed, OPEN_DAY));
        expect(isOpenOn(unsealedForGood, SHUT_DAY)).toBe(isOpenOn(seededAndSealed, SHUT_DAY));
    });

    it('refuses and admits on the schedule, so the door is not two answers', () => {
        const shut = evaluateAccess(ruin({ sealed: false }), { ...STRONG_ENOUGH, onDay: SHUT_DAY });
        const open = evaluateAccess(ruin({ sealed: true }), { ...STRONG_ENOUGH, onDay: OPEN_DAY });

        expect(shut.closed).toBe(true);
        expect(open.closed).toBe(false);
    });

    it('is refused as shut on this day rather than as something somebody sealed', () => {
        // A door on a season sends nobody looking for a way through a seal.
        // There is no way through; there is a date.
        const shut = evaluateAccess(ruin(), { ...STRONG_ENOUGH, onDay: SHUT_DAY });
        expect(shut.reason).toContain('not open on this day');
        expect(shut.reason).not.toContain('sealed');

        const sealedForGood = evaluateAccess(
            ruin({ cycle: null }), { ...STRONG_ENOUGH, onDay: SHUT_DAY }
        );
        expect(sealedForGood.reason).toContain('sealed');
    });

    it('says what shuts it, off the row rather than one sentence for every ruin', () => {
        const withAFormation = whatShutsThisDoor(ruin());
        const shortWait = whatShutsThisDoor(ruin({ hazards: [] }));
        const longWait = whatShutsThisDoor(ruin({
            hazards: [],
            cycle: { ...EVERY_SIXTY_YEARS, periodDays: CYCLE_YEARS.long * YEAR }
        }));

        expect(withAFormation).toBe('the_formation');
        expect(shortWait).toBe('the_season');
        expect(longWait).toBe('the_stars');
        expect(new Set([
            WHAT_SHUTS_IT[withAFormation!],
            WHAT_SHUTS_IT[shortWait!],
            WHAT_SHUTS_IT[longWait!]
        ]).size).toBe(3);

        // Nothing that does not shut itself has an answer, and a non-answer is
        // not a sentence.
        expect(whatShutsThisDoor(ruin({ cycle: null }))).toBeNull();
    });

    it('keeps the reading a reading: the record does not move when the day does', () => {
        const site = ruin();
        expect(howThisGroundIsShut(site, OPEN_DAY).howItIsShut).toBe('open');
        expect(howThisGroundIsShut(site, SHUT_DAY).howItIsShut).toBe('shut_until_its_season');
        expect(site.sealed).toBe(true);
    });

    it('never comes out of three centuries of world open against its own schedule', () => {
        // The world's `ruin_opened` pass used to take the seal off a door on a
        // season and tag it spent, and nothing re-shut it. Somebody may still go
        // through one - while it is standing open, which is the whole difficulty
        // - and what they cannot do is leave it open.
        const state = world('nothing-opens-a-season-for-good');
        const from = state.currentDay;
        applyPressure(state, from, from + 300 * YEAR, { maxEvents: 1_000_000 });
        const day = Math.floor(state.currentDay);

        const cycled = state.locations.filter(l => l.kind === 'ruin' && l.cycle);
        expect(cycled.length).toBeGreaterThan(0);
        for (const site of cycled) {
            if (isOpenOn(site, day)) continue;
            expect(site.sealed).toBe(true);
            expect(site.environment.spiritualDensity).toBeLessThan(qiFraction(site.qiDensity));
        }
    });

    it('puts ground the world uncovers on a schedule too, not only authored ground', () => {
        // Only catalog rows drew a cycle before this, so every door that ever
        // opened had been written by hand. Asked over enough years that the
        // 40% share has something to land on.
        const state = world('found-ground-shuts-itself');
        const startYear = Math.floor(state.currentDay / YEAR);
        for (let y = 1; y <= 400; y++) {
            applyRuinProspecting(state, startYear + y, state.currentDay + y * YEAR);
        }

        const found = state.locations.filter(l =>
            l.kind === 'ruin' && l.tags.includes(FOUND_BY_PROSPECTING_TAG));
        expect(found.length).toBeGreaterThan(0);

        const onASchedule = found.filter(l => l.cycle !== null);
        expect(onASchedule.length).toBeGreaterThan(0);
        // And not all of it. Most of the map stays ground somebody has to go and
        // open, which is the share the derivation already draws.
        expect(onASchedule.length).toBeLessThan(found.length);

        for (const site of onASchedule) {
            // Finding is not opening. A find with a door is still shut, and what
            // opens it is its own season.
            expect(site.discovered).toBe(true);
            expect(site.sealed).toBe(true);
            expect(site.cycle!.openDays).toBeGreaterThan(0);
            expect(site.cycle!.periodDays).toBeGreaterThan(site.cycle!.openDays);
            // WHEN it is next due is a reading with its own gate, the same one a
            // catalog ruin carries. Without it a find would hand the day to
            // anybody who walked past.
            expect(site.data.scheduleKey).toBe(`cycles:${site.id}`);
            expect(Number(site.data.scheduleReadOrdinal)).toBeGreaterThan(0);
        }
        for (const site of found.filter(l => l.cycle === null)) {
            expect(site.data.scheduleKey).toBeUndefined();
        }
    });
});
