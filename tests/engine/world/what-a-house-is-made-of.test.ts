/**
 * WHAT A HOUSE IS MADE OF, AND WHAT BRINGS IT DOWN.
 *
 * The design owner's thread, in his own words:
 *
 *     "you might also wreck the buildings too"
 *     "for simplicity just put every building at ordinal 29 (assume they're
 *      made of ordinary materials)"
 *     "and a sect can construct their own formation [...] which depends on who
 *      made it [...] on top of all their buildings"
 *     "so a declaration at a sect at ordinal 44 might actually be flattening
 *      their buildings"
 *     "and then they'd have to pay spirit stones and rebuild"
 *     "if you can actually flatten a sect they might beg you to stay your hand"
 *
 * ── WHAT THIS PINS, AND WHY EACH IS THE INTERESTING PART ─────────────────
 *
 * THE STACK. Three layers and which one stops you decides everything. The case
 * worth having is the middle one: past the ward and short of the walls is
 * somebody who has opened a compound and cannot flatten it, which is what a
 * raid is.
 *
 * WHO MADE IT. The ward's rung is not a property of the house. It is the lower
 * of the art and the builder, less what imperfect mastery costs - decided by
 * `a-formation-stands-at-the-lower-of-the-art-and-the-builder.ts` and read here
 * rather than restated - so the same compound is hard or soft depending on who
 * happened to be standing in it on the day.
 *
 * AND WHEN. A ward thins. `effectiveWardOrdinal` already models it, so a house
 * that raised something magnificent nine centuries ago and let it go is softer
 * than one that laid a modest ward last decade. That is the whole reason a
 * house keeps paying.
 */

import { describe, expect, it } from 'vitest';

import {
    WHAT_ORDINARY_MATERIALS_STAND_AT,
    whatAHouseDoesAboutSomebodyWhoCanEndIt,
    whatAHouseIsMadeOf,
    whatBringingItDownWouldTake
} from '../../../src/engine/world/what-a-house-is-made-of-and-what-brings-it-down';
import {
    WHAT_ONE_BUILDING_COSTS_TO_RAISE,
    howMuchComesDown,
    putIntoTheHouse,
    takeFromTheHouse,
    whatRebuildingWouldCost
} from '../../../src/engine/world/a-house-holds-its-own';
import {
    raiseFormation
} from '../../../src/engine/world/a-formation-stands-at-the-lower-of-the-art-and-the-builder';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation';

const AT_THE_SEAT = 'loc-the-compound';

/** An art that describes a ward up to a given rung. */
function anArtTo(cap: number) {
    return {
        id: 'art-warding',
        name: 'The Nine Locks',
        subjects: ['formation'],
        requiredOrdinal: 10,
        cap
    };
}

/** A ward standing over the compound, raised by somebody, on a day. */
function aWard(input: { artTo: number; builderAt: number; onDay: number; mastery?: number }) {
    const raised = raiseFormation({
        id: `ward-${input.builderAt}-${input.onDay}`,
        name: 'The Standing Lock',
        art: anArtTo(input.artTo),
        builderId: 'builder',
        builderName: 'Somebody',
        builderOrdinal: input.builderAt,
        mastery: input.mastery ?? 1,
        stance: 'defensive',
        locationId: AT_THE_SEAT,
        onDay: input.onDay
    });
    expect(raised.row, 'the ward was not laid').not.toBeNull();
    return raised.row!;
}

describe('the stack', () => {
    /** A house with nothing raised over it is its walls, and they are the floor. */
    it('is the buildings alone where nothing was ever warded', () => {
        const seat = whatAHouseIsMadeOf([], AT_THE_SEAT, 0);
        expect(seat.formationStandsAt).toBeNull();
        expect(seat.buildingsStandAt).toBe(WHAT_ORDINARY_MATERIALS_STAND_AT);
        expect(seat.theWholeSeatStandsAt).toBe(WHAT_ORDINARY_MATERIALS_STAND_AT);
    });

    /**
     * AND THE WARD IS THE LOWER OF THE ART AND THE BUILDER. The same compound,
     * warded by two different people out of the same book, is two different
     * places - which is the owner's *"depends on who made it"* and is decided
     * by a function this file only reads.
     */
    it('stands where whoever raised it could reach, and no higher', () => {
        const byAGiant = whatAHouseIsMadeOf(
            [aWard({ artTo: 44, builderAt: 44, onDay: 0 })], AT_THE_SEAT, 0
        );
        const byAnOrdinaryHand = whatAHouseIsMadeOf(
            [aWard({ artTo: 44, builderAt: 20, onDay: 0 })], AT_THE_SEAT, 0
        );
        expect(byAGiant.formationWasSetAt).toBe(44);
        // The art reached 44 and the builder did not, so the ward did not.
        expect(byAnOrdinaryHand.formationWasSetAt).toBe(20);
    });

    /**
     * AND IT THINS. The rung it ANSWERS at today is not the rung it was set at,
     * which is why upkeep is a thing a house pays for.
     */
    it('answers lower the longer it has stood', () => {
        const ward = aWard({ artTo: 44, builderAt: 44, onDay: 0 });
        const fresh = whatAHouseIsMadeOf([ward], AT_THE_SEAT, 0);
        const ancient = whatAHouseIsMadeOf([ward], AT_THE_SEAT, DAYS_PER_YEAR * 5_000);

        expect(fresh.formationStandsAt).toBe(44);
        expect(ancient.formationStandsAt!).toBeLessThan(fresh.formationStandsAt!);
        // Set at the same rung either way. Only what it still answers moved.
        expect(ancient.formationWasSetAt).toBe(44);
    });

    /**
     * Two wards, and the compound is protected by whichever is worth more NOW.
     *
     * The half-life is exponential in the rung - `WARD_HALF_LIFE_PER_ORDINAL`
     * to the power of it - so the ward that loses a race like this is a LOW one
     * that has stood a while, not a high one. A ward laid at the top of the
     * ladder is effectively permanent, which is the model saying that what the
     * very strong build does not rot on any timescale a house cares about.
     */
    it('takes the best one still answering', () => {
        const seat = whatAHouseIsMadeOf(
            [
                aWard({ artTo: 16, builderAt: 16, onDay: 0 }),
                aWard({ artTo: 14, builderAt: 14, onDay: DAYS_PER_YEAR * 300 })
            ],
            AT_THE_SEAT,
            DAYS_PER_YEAR * 300
        );
        // The fresh one, because the older and nominally stronger has thinned
        // past it.
        expect(seat.formationWasSetAt).toBe(14);
    });
});

describe('what bringing it down would take', () => {
    const warded = whatAHouseIsMadeOf([aWard({ artTo: 40, builderAt: 40, onDay: 0 })], AT_THE_SEAT, 0);
    const bare = whatAHouseIsMadeOf([], AT_THE_SEAT, 0);

    /** Short of the ward is not a weak attack. It is not an attack on the seat at all. */
    it('stops at the ward, and the buildings are never reached', () => {
        const read = whatBringingItDownWouldTake({ seat: warded, theirReach: 33 });
        expect(read.stoppedBy).toBe('the_formation');
        expect(read.couldGetIn).toBe(false);
        expect(read.couldFlattenIt).toBe(false);
        expect(read.rungsShort).toBe(7);
    });

    /**
     * THE MIDDLE CASE, which is the one the whole layer exists for: in, and
     * unable to bring it down. That is a raid.
     */
    it('lets somebody in who cannot flatten it', () => {
        const read = whatBringingItDownWouldTake({ seat: bare, theirReach: 25 });
        expect(read.stoppedBy).toBe('the_buildings');
        expect(read.couldGetIn).toBe(true);
        expect(read.couldFlattenIt).toBe(false);
        expect(read.rungsShort).toBe(WHAT_ORDINARY_MATERIALS_STAND_AT - 25);
    });

    /** The owner's own case: a declaration by somebody at 44. */
    it('flattens it for somebody who beats both', () => {
        const read = whatBringingItDownWouldTake({ seat: warded, theirReach: 44 });
        expect(read.stoppedBy).toBe('nothing');
        expect(read.couldFlattenIt).toBe(true);
        expect(read.rungsShort).toBe(0);
    });

    /**
     * AND A HOUSE SUES FOR PEACE ONLY WHEN IT CAN BE ENDED. Being robbed is
     * survivable and being ended is not, so the door it opens is the one that
     * follows from the arithmetic rather than from how frightening anybody is.
     */
    it('begs only where the seat actually comes down', () => {
        const against = (seat: typeof warded, reach: number) =>
            whatAHouseDoesAboutSomebodyWhoCanEndIt(
                whatBringingItDownWouldTake({ seat, theirReach: reach })
            );
        expect(against(warded, 20)).toBe('ignores_it');
        expect(against(warded, 44)).toBe('sues_for_peace');
        // The raid is a thing that happens to an UNWARDED house.
        expect(against(bare, 25)).toBe('answers_it');
    });

    /**
     * AND A WARD ABOVE THE WALLS IS ALL OR NOTHING, WHICH IS NOT AN OVERSIGHT.
     *
     * Once the ward answers above `WHAT_ORDINARY_MATERIALS_STAND_AT`, anybody
     * who passes it also beats the masonry by construction - so a properly
     * warded compound has no middle case at all. It is not raided; it is
     * untouched or it is levelled.
     *
     * That falls out rather than being decided, and it is the right shape: it
     * says the ward is the ONE thing that matters for a great house, and that a
     * house whose ward has thinned below its own walls has quietly become an
     * ordinary compound that can be robbed.
     */
    it('has no middle case while the ward answers above the masonry', () => {
        for (let reach = 0; reach <= 46; reach++) {
            const read = whatBringingItDownWouldTake({ seat: warded, theirReach: reach });
            expect(read.stoppedBy, `at ${reach}`).not.toBe('the_buildings');
            expect(read.couldGetIn, `at ${reach}`).toBe(read.couldFlattenIt);
        }
    });
});

describe('what it costs to put back up', () => {
    /** How much comes down is how far past the walls they reached. */
    it('brings down more the further past the walls they are', () => {
        const at = (reach: number) => howMuchComesDown({
            buildings: 20, theirReach: reach, buildingsStandAt: WHAT_ORDINARY_MATERIALS_STAND_AT
        });
        expect(at(WHAT_ORDINARY_MATERIALS_STAND_AT)).toBe(1);
        expect(at(34)).toBeGreaterThan(at(30));
        expect(at(44)).toBe(20);
        // And a compound with nothing standing loses nothing.
        expect(howMuchComesDown({ buildings: 0, theirReach: 44, buildingsStandAt: 29 })).toBe(0);
    });

    it('prices it off one figure for every hall in the world', () => {
        const bill = whatRebuildingWouldCost({ buildingsDown: 3, treasuryHolds: 100_000 });
        expect(bill.stones).toBe(3 * WHAT_ONE_BUILDING_COSTS_TO_RAISE);
        expect(bill.affordable).toBe(true);
        expect(bill.short).toBe(0);
    });

    /** And a house that cannot pay leaves some of it down, which is a real state. */
    it('says what stays down when the treasury is short', () => {
        const bill = whatRebuildingWouldCost({ buildingsDown: 10, treasuryHolds: 1_000 });
        expect(bill.affordable).toBe(false);
        expect(bill.short).toBe(bill.stones - 1_000);
        expect(bill.account).toMatch(/Some of it stays down/i);
    });
});

describe('a house holds its own', () => {
    /** One store. Everything that touches it moves the same number. */
    it('cannot be overdrawn, and says when it came up short', () => {
        const paid = takeFromTheHouse(500, 800, 'rebuilding');
        expect(paid.after).toBe(0);
        expect(paid.moved).toBe(500);
        expect(paid.cameUpShort).toBe(true);

        const enough = takeFromTheHouse(1_000, 800, 'stipend');
        expect(enough.after).toBe(200);
        expect(enough.cameUpShort).toBe(false);
    });

    it('takes payment in, with no ceiling on it', () => {
        const got = putIntoTheHouse(100, 900, 'indemnity');
        expect(got.after).toBe(1_000);
        expect(got.cameUpShort).toBe(false);
    });

    /**
     * THE TWO MOVEMENTS ARE THE SAME NUMBER, which is the whole point of a
     * treasury being a place rather than a per-person allowance: a house that
     * has been bled cannot then pay for its own walls.
     */
    it('leaves a bled house unable to rebuild', () => {
        const bled = takeFromTheHouse(50_000, 49_000, 'siphoned');
        const bill = whatRebuildingWouldCost({ buildingsDown: 2, treasuryHolds: bled.after });
        expect(bill.affordable).toBe(false);
    });
});
