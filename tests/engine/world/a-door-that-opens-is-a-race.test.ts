/**
 * A door opens and the province goes, or does not, and the window decides which.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * The design owner, on the world consuming cycled ruins on its own: sometimes
 * it is just you, and other times the door stands open thirty days and the
 * houses all go at once. So the LENGTH OF THE WINDOW is what makes a door a
 * private find or a race, and the world has to behave accordingly.
 *
 * The old shape could not: `ruin_opened` fired on a day drawn at random and
 * happened to catch a door open, which is why it used to eat doors that were
 * shut. The opening is an event the world already computes, so the sending
 * hangs off `applyConvergences` and asks the reachability read that already
 * exists (`beingAtADoorOnTheDayItOpens`) once per house seat.
 *
 * ── WHAT IS ASSERTED, AND THE MEASUREMENT BEHIND IT ──────────────────────
 *
 * That the window scales it, never a count. Measured over six pinned worlds
 * run three hundred years each, houses sent per opening against the window,
 * out of 38 house seats:
 *
 *   7d 0.00   10d 0.00   14d 0.00   18d 8.62   21d 13.36
 *   30d 14.06   40d 32.14   60d 29.88
 *
 * A week reaches nobody, which is the fastest-to-close case and is meant to be
 * whoever is standing there. Forty days reaches most of the world.
 *
 * THE FIRST CUT OFFERED THE ESCORT ROAD and the window then decided nothing:
 * a fold at ordinal 40 covers 64 walking days against a map whose farthest seat
 * is under thirty, so every house holding anybody at the folding rungs reached every door
 * whatever its window - 18 of 38 houses at an EIGHTEEN day door, 4 at a seven
 * day one. A house sends people who walk; the fold is a favour a person does a
 * person and stays in the player's hands.
 *
 * AND THE GROUND IS NOT SPENT. On the cut that tagged a door `emptied` when a
 * party finished, 63 of 73 cycled ruins were spent inside three centuries and
 * there was nothing left for anybody to walk to. A door on a season comes round.
 */

import { describe, it, expect } from 'vitest';

import {
    makeLocation,
    makeThresholds,
    type LocationRecord
} from '../../../src/engine/world/locations.js';
import {
    theErrandADoorIs,
    whoSendsWhenADoorOpens,
    type AHouseThatCouldGo
} from '../../../src/engine/world/a-door-that-opens-is-a-race.js';
import { whatADoorAdmits } from '../../../src/engine/world/a-door-with-a-count-on-it.js';
import { wingsOf } from '../../../src/engine/world/provenance.js';
import { whatTheDoorOfThisRuinSays } from '../../../src/web/walking-up-to-a-door-that-closes.js';

const YEAR = 365;

/** Open on day 0 for as long as it is given, then shut for sixty years. */
function doorOpenFor(openDays: number): LocationRecord {
    return makeLocation({
        id: 'loc-ruin-that-opens',
        name: 'Cold Spring',
        kind: 'ruin',
        qiDensity: 80,
        thresholds: makeThresholds(4, 8, 14, 20),
        sealed: true,
        cycle: { periodDays: 60 * YEAR, openDays, phaseDay: 0 }
    });
}

/** A house whose people can live at the door, seated `days` of road away. */
function houseAt(id: string, days: number): AHouseThatCouldGo & { days: number } {
    return {
        id,
        name: `The ${id} Sect`,
        seatLocationId: `seat-${id}`,
        roster: [10, 12, 14, 16, 18, 20].map((ordinal, i) => ({
            id: `${id}-${i}`, name: `${id} ${i}`, ordinal
        })),
        days
    };
}

const THE_PROVINCE = [
    houseAt('near', 1),
    houseAt('middling', 8),
    houseAt('far', 20),
    houseAt('further', 30)
];

function whoGoes(door: LocationRecord, onDay = 0): readonly string[] {
    const walking = new Map(THE_PROVINCE.map(h => [h.seatLocationId!, h.days]));
    return whoSendsWhenADoorOpens({
        door,
        onDay,
        houses: THE_PROVINCE,
        walkingDaysTo: id => walking.get(id)
    }).map(h => h.houseId);
}

describe('a door that opens is a race', () => {
    it('reaches nobody on the window that is meant to be a private find', () => {
        // The deepest wing is days in and the same again out, so a week buys
        // nobody the end of it however close they are seated.
        const week = doorOpenFor(7);
        expect(wingsOf(week).length).toBeGreaterThan(0);
        expect(whoGoes(week)).toEqual([]);
    });

    it('reaches more of the province the longer it stands open', () => {
        const counts = [7, 30, 90, 180].map(days => whoGoes(doorOpenFor(days)).length);
        // Never fewer as the window grows. The scaling is the read's, not a
        // threshold here, so what is pinned is the direction.
        for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
        }
        expect(counts[0]).toBe(0);
        expect(counts[counts.length - 1]).toBe(THE_PROVINCE.length);
    });

    it('sends nobody to a door that is shut', () => {
        // The whole shape of the old defect: an errand that fires on a day of
        // its own and finds the door closed.
        const door = doorOpenFor(180);
        expect(whoGoes(door, 0).length).toBeGreaterThan(0);
        expect(whoGoes(door, 200)).toEqual([]);
    });

    it('hands them over nearest seat first, which is arrival order', () => {
        const going = whoGoes(doorOpenFor(180));
        expect(going).toEqual(['near', 'middling', 'far', 'further']);
    });

    it('gives the errand the window as its term, never the reason\'s own', () => {
        const reason = theErrandADoorIs();
        const walking = new Map(THE_PROVINCE.map(h => [h.seatLocationId!, h.days]));
        const short = whoSendsWhenADoorOpens({
            door: doorOpenFor(30), onDay: 0, houses: THE_PROVINCE,
            walkingDaysTo: id => walking.get(id)
        });
        expect(short.length).toBeGreaterThan(0);
        // A party cannot be out on a find for longer than the door is open: it
        // takes the ground back when it shuts, whatever anybody has finished.
        for (const house of short) expect(house.posting.days).toBe(30);
        expect(reason.days).toBeGreaterThan(30);

        const long = whoSendsWhenADoorOpens({
            door: doorOpenFor(365), onDay: 0, houses: THE_PROVINCE,
            walkingDaysTo: id => walking.get(id)
        });
        // And where the window is longer than the errand, the errand is the
        // errand. The window is a ceiling on the term, not a replacement for it.
        for (const house of long) expect(house.posting.days).toBe(reason.days);
    });

    it('lets a player standing at a busy door find out who else is here', () => {
        // The visible half of the ruling, and it is read off who is actually in
        // the square rather than off anybody's plan: the world walks the parties
        // to the door and they stand there until it shuts. A house's people are
        // marked as its people, so naming them says nothing the eye cannot reach.
        const door = doorOpenFor(180);
        const busy = whatTheDoorOfThisRuinSays({
            site: door,
            day: 0,
            party: { id: 'player', realmOrdinal: 12 },
            crossingDays: 0,
            escort: null,
            slip: null,
            housesStandingHere: ['The Ninefold Court', 'The Stone Vein Sect']
        });
        expect(busy.lines.join(' '))
            .toContain('The Ninefold Court and The Stone Vein Sect all have people standing here');

        // And an empty door says nothing about anybody, rather than saying
        // nobody is here - which is a different claim and a false one.
        const quiet = whatTheDoorOfThisRuinSays({
            site: door,
            day: 0,
            party: { id: 'player', realmOrdinal: 12 },
            crossingDays: 0,
            escort: null,
            slip: null
        });
        expect(quiet.lines.join(' ')).not.toContain('standing here');
    });

    /**
     * ── A DOOR SOMEBODY DOLES OUT IS NOT A RACE ──────────────────────────
     *
     * Found by wiring the conclaves through. `a-year-at-the-doors.ts` deals the
     * places at a held, counted door and a house then ranks a field of its own
     * people for them; this pass asked nothing at all about who held the ground,
     * so on the same opening day the whole province turned up anyway. The
     * disciple who won a place and the three who were passed over for it stood
     * in the same doorway, which makes the grudge about nothing.
     *
     * The door table already had the reading - `doled_out` is the one cell of
     * four with a count in a house's hand, and its own account says *there is no
     * going anyway*. This asks it rather than stating a second rule.
     */
    it('sends nobody racing to a door whose places a house is handing out', () => {
        const open = doorOpenFor(180);
        expect(whoGoes(open).length).toBeGreaterThan(0);

        const doled = { ...open, controllingFactionId: 'house-that-holds-it' };
        expect(whatADoorAdmits({ ruin: doled }).cell).toBe('doled_out');
        expect(whoGoes(doled)).toEqual([]);
    });

    /**
     * And the other three cells are still a race. Held ground with no count on
     * it hands out nothing, so turning up is not a thing anybody has to beat.
     */
    it('still races to held ground that has no count on it', () => {
        const uncounted = { ...doorOpenFor(180), cycle: null, sealed: false,
            controllingFactionId: 'house-that-holds-it' };
        expect(whatADoorAdmits({ ruin: uncounted }).cell).not.toBe('doled_out');
    });

    it('leaves out a house nothing connects to the door', () => {
        const door = doorOpenFor(180);
        const going = whoSendsWhenADoorOpens({
            door, onDay: 0, houses: THE_PROVINCE,
            // Nowhere is reachable. A distance the map cannot answer is not a
            // distance of zero.
            walkingDaysTo: () => undefined
        });
        expect(going).toEqual([]);
    });
});
