/**
 * A player standing in a town can find out that a competition is going to
 * happen, and when.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * `gatherings.ts` has been holding competitions on the yearly line since it was
 * written. Measured while writing this: `Gathering`, `applyGatherings` and every
 * conclave reader had ZERO references anywhere in `src/web/` or `src/server/` -
 * the whole subsystem ran headless. The one channel any of it ever reached the
 * player through is `what-people-are-saying.ts:690`, which says *"held something
 * and the placings went round afterwards, N years ago"*: past tense, no date, no
 * host. So a competition could only be heard about once it was over, and a
 * competition nobody can get to is not a competition.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 * The two halves of reachable, which is the standard this repo already holds:
 *
 *   IT ARRIVES BY TYPING A SENTENCE SOMEBODY WOULD TYPE. Not a new verb.
 *   `what is posted here` already existed and already read the wall, and the
 *   whole reason an open competition is a fourth `TheAsk` rather than a channel
 *   of its own is that `noticesOnTheWall`, `readTheWall`, `billsOnTheWall` and
 *   `whatThereIsToWaitFor` are already wired end to end. A second announcement
 *   channel beside four working ones would be the defect this slice exists to
 *   close, committed on purpose.
 *
 *   AND IT CARRIES A DAY. A notice a player cannot plan a journey around is a
 *   flavour line. The date is held down here against the wall as the player
 *   meets it, and in `a-competition-anybody-may-enter.test.ts` against the
 *   calendar that produced it.
 *
 * ── AND THE REACHABILITY CHECK THAT COULD HAVE SUNK IT ───────────────────
 *
 * The open competition fills a LEFTOVER nail and never takes one off the three
 * standing kinds - the conservative half of an unsettled design question, see
 * `noticesOnTheWall`. That is only worth having if real walls have leftover
 * nails, so the first case below measures it on the shipped catalog rather than
 * assuming it. A fixture built to fill every nail is exactly what made the
 * question visible, and this is the arm that says the shipped world is not one.
 */

import { describe, it, expect } from 'vitest';

import {
    housesWithSomethingToSay,
    openDoorsInTheWorld,
    postingGroundOf,
    provinceOfPlace
} from '../../src/web/what-is-posted-on-the-wall-here.js';
import { noticesOnTheWall } from '../../src/engine/world/houses-that-have-to-advertise-for-disciples.js';
import { A_NOTICE_GOES_UP_DAYS } from '../../src/engine/world/a-competition-anybody-may-enter.js';
import { REGIONS } from '../../src/data/cultivation/regions.js';

/** Every city on the map. Which houses reach which wall is a province question. */
const CITIES = REGIONS.flatMap(r => r.places).filter(p => p.kind === 'city').map(p => p.name);

const SEED = 'competition-wall';

/** The wall at this place on this day, off the shipped catalog. */
function wallAt(place: string, onDay: number) {
    return noticesOnTheWall({
        field: openDoorsInTheWorld(),
        placeName: place,
        ground: postingGroundOf(place),
        placeProvinceId: provinceOfPlace(place),
        onDay,
        seed: SEED,
        speaking: housesWithSomethingToSay()
    });
}

/** Days, cities and the notices that were up, for the measurements below. */
function sweep(days: number) {
    const found: { place: string; onDay: number; readOn: number; house: string }[] = [];
    for (const place of CITIES) {
        for (let day = 0; day < days; day++) {
            for (const notice of wallAt(place, day)) {
                if (notice.kind !== 'open_competition') continue;
                found.push({
                    place, onDay: notice.onDay!, readOn: day, house: notice.houseName
                });
            }
        }
    }
    return found;
}

describe('a competition is announced before it happens', () => {
    /**
     * THE ONE THAT COULD HAVE SUNK THE SLICE. Filling only leftover nails is
     * worthless if the shipped walls have none. Measured over every city on the
     * map across three years: if this is zero, the conservative choice was the
     * wrong one and the design question has to be settled before anything else.
     */
    it('reaches a real city wall on the shipped catalog', () => {
        const found = sweep(365 * 3);
        expect(found.length, 'no city wall in three years had a free nail for a competition')
            .toBeGreaterThan(0);

        // And it is not one freak town. A feature reachable in exactly one
        // province is content most players never meet.
        expect(new Set(found.map(f => f.place)).size).toBeGreaterThan(1);
    });

    /**
     * A player travelling through meets one. The figure is what
     * `AN_OPEN_COMPETITION_EVERY_YEARS` is FOR, and a dial with no measurement
     * beside it is a number the next person assumes is arbitrary.
     *
     * MEASURED, four cities across three years: a competition was pending on
     * 36% of days, and all four cities carried one inside the first year. The
     * first cut of the dial gave 70%, which is a wall that nearly always has a
     * competition coming and therefore teaches a player to stop reading it.
     *
     * The assertion is a floor rather than the figure, because the figure is a
     * property of how many houses a PROVINCE holds - ten calendars pooled - and
     * that is content another agent may legitimately change this afternoon.
     */
    it('is up often enough for somebody living in a province to meet one', () => {
        const days = 365 * 3;
        const found = sweep(days);
        const byPlace = new Map<string, Set<number>>();
        for (const row of found) {
            const held = byPlace.get(row.place) ?? new Set<number>();
            held.add(row.readOn);
            byPlace.set(row.place, held);
        }
        // Share of days on which the wall of a city carries one at all, pooled
        // over every city. Reported apart from the assertion so a later reader
        // can see what moved if this drifts.
        const share = [...byPlace.values()].reduce((n, s) => n + s.size, 0)
            / (CITIES.length * days);
        expect(share, `a competition was on a city wall on ${(share * 100).toFixed(1)}% of days`)
            .toBeGreaterThan(0.02);
    });

    it('says a day, and it is in the future and inside the stated horizon', () => {
        const found = sweep(365);
        expect(found.length).toBeGreaterThan(0);
        for (const row of found) {
            expect(row.onDay).toBeGreaterThanOrEqual(row.readOn);
            expect(row.onDay - row.readOn).toBeLessThanOrEqual(A_NOTICE_GOES_UP_DAYS);
        }
    });

    /**
     * A WALL DOES NOT CHANGE BECAUSE SOMEBODY LOOKED AT IT. The sibling claim
     * `a-house-puts-on-a-wall-what-it-wants-from-strangers` makes for the rest
     * of the wall, made here for the half that carries a date - which is the
     * half where it actually costs the player something if it fails.
     */
    it('names the same day when the same wall is read twice on the same day', () => {
        for (const place of CITIES) {
            for (let day = 0; day < 400; day += 37) {
                const first = wallAt(place, day).filter(n => n.kind === 'open_competition');
                const second = wallAt(place, day).filter(n => n.kind === 'open_competition');
                expect(second.map(n => n.onDay)).toEqual(first.map(n => n.onDay));
            }
        }
    });

    /**
     * The half a blank wall never said. A notice that does not state what
     * reading it fails to buy is the duty board's defect in a new place.
     */
    it('says what standing up does not buy', () => {
        const found = sweep(365 * 2);
        const place = found[0]!;
        const notice = wallAt(place.place, place.readOn)
            .find(n => n.kind === 'open_competition')!;

        expect(notice.saying).toContain(notice.houseName);
        expect(notice.saying.toLowerCase()).toContain('anybody may enter');
        expect(notice.andWhatItIsNot.length).toBeGreaterThan(0);
        expect(notice.andWhatItIsNot).toContain('not a place on the roll');
    });

    /**
     * The owner's requirement, stated on the paper rather than only in the
     * machinery: an entrant is announced by their name AND by who they answer
     * to, INCLUDING nobody. That is what makes a rogue cultivator's placing
     * worth anything, so it is what the advertisement has to promise.
     */
    it('promises that an entrant of no house is announced like anybody else', () => {
        const found = sweep(365 * 2);
        const notice = wallAt(found[0]!.place, found[0]!.readOn)
            .find(n => n.kind === 'open_competition')!;
        expect(notice.saying).toContain('of any house or none');
    });
});
