/**
 * What a conveyance does to a journey.
 *
 * The decisions pinned here, each of which lives only as a number or a branch
 * and would otherwise be silently reverted by the next person who finds it
 * surprising:
 *
 *   1. THE SPEED TABLE. Two, three, five walking days per day by grade, plus
 *      one per realm a tracked craft stands above the floor. The shape being
 *      defended is that the ordinary rungs are genuinely worth having and none
 *      of them is worth a boat.
 *   2. THE TOP OF THE TABLE MUST NOT DELETE THE SEA. `what-a-sea-crossing-
 *      costs.ts` is a whole subsystem whose stakes are a lane running longer
 *      than it was provisioned for. The best hull in the world still has to be
 *      provisioned for the longest lane, and this asserts it.
 *   3. RANGE COSTS IN BOTH DIRECTIONS. Taking too little is slow and taking too
 *      much is loud, and neither is a refusal.
 *   4. FLIGHT BELONGS TO SWORD SCHOOLS. Ruled by the design owner. An
 *      exclusivity rule is exactly the decision AGENTS.md says needs a test.
 */

import { describe, it, expect } from 'vitest';
import {
    ON_FOOT_SPEED,
    REACH_IN_WALKING_DAYS,
    WALKING_DAYS_PER_DAY_BY_GRADE,
    bestForThisRoad,
    couldArriveUnremarked,
    couldFlyOnTheirOwnBlade,
    daysByConveyance,
    priceJourney,
    realmsAboveTheTrackedFloor,
    unsuitedFor,
    walkingDaysPerDay,
    whatArrivingOnThisSays,
    type Conveyance
} from '../../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import {
    CONVEYANCES,
    requireConveyance
} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { SEA_LANES } from '../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { CUSTOMARY_PROVISIONING_MARGIN } from '../../../src/engine/world/what-a-sea-crossing-costs.js';
import { OBJECT_CEILING_BELOW_THE_LID } from '../../../src/engine/cultivation/realms.js';
import { refiningOrdinalFor } from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { getTechnique, isSwordArt, SWORD_ARTS } from '../../../src/data/cultivation/techniques.js';
import { primaryRoadOf } from '../../../src/schema/cultivation.js';
import { techniqueEffectiveness } from '../../../src/engine/cultivation/understanding.js';

const FOOT = requireConveyance('conv-on-foot');
const MOUNT = requireConveyance('conv-mount-mortal');
const CARRIAGE_EARTH = requireConveyance('conv-carriage-earth');
const CARRIAGE_HEAVEN = requireConveyance('conv-carriage-heaven');
const BOAT = requireConveyance('conv-spirit-boat');
const FLIGHT = requireConveyance('conv-sword-flight');

describe('speed', () => {
    // RULING 1.
    it('measures everything in walking days, and walking is one', () => {
        expect(ON_FOOT_SPEED).toBe(1);
        expect(walkingDaysPerDay(FOOT)).toBe(1);
        expect(daysByConveyance(11, FOOT)).toBe(11);
    });

    it('rises with the grade and never falls', () => {
        expect(WALKING_DAYS_PER_DAY_BY_GRADE.mortal).toBeLessThan(WALKING_DAYS_PER_DAY_BY_GRADE.earth);
        expect(WALKING_DAYS_PER_DAY_BY_GRADE.earth).toBeLessThan(WALKING_DAYS_PER_DAY_BY_GRADE.heaven);
        expect(walkingDaysPerDay(MOUNT)).toBe(2);
        expect(walkingDaysPerDay(CARRIAGE_EARTH)).toBe(3);
    });

    it('steps by realm rather than by rung, so it is not a second opinion about the ladder', () => {
        const floor = refiningOrdinalFor('heaven');
        expect(realmsAboveTheTrackedFloor(floor)).toBe(0);
        expect(realmsAboveTheTrackedFloor(floor - 1)).toBe(0);
        // Void Refinement runs 29..32, so the first step is at 33.
        expect(realmsAboveTheTrackedFloor(floor + 3)).toBe(0);
        expect(realmsAboveTheTrackedFloor(floor + 4)).toBe(1);
        expect(realmsAboveTheTrackedFloor(OBJECT_CEILING_BELOW_THE_LID)).toBeGreaterThan(1);
    });

    it('reads the ordinal only for a tracked craft, because nothing else has one', () => {
        expect(walkingDaysPerDay(CARRIAGE_EARTH, 44)).toBe(walkingDaysPerDay(CARRIAGE_EARTH));
        expect(walkingDaysPerDay(BOAT, 38)).toBeGreaterThan(walkingDaysPerDay(BOAT, 29));
    });

    it('never returns a fraction of a day, because arriving is a day either way', () => {
        for (const c of CONVEYANCES) {
            expect(Number.isInteger(daysByConveyance(7, c, 38))).toBe(true);
            expect(daysByConveyance(1, c, 45)).toBe(1);
        }
        expect(daysByConveyance(0, BOAT, 38)).toBe(0);
    });

    /**
     * RULING 2. The top of the table must not delete the sea.
     *
     * A hull at the object ceiling over the longest lane in the world still has
     * to be provisioned, which means the sum somebody does ashore still has to
     * be right and `what-a-sea-crossing-costs.ts` still has stakes. If the speed
     * table is ever raised far enough for this to go red, the crossing
     * subsystem has been quietly switched off for whoever owns a boat, and that
     * is a design decision somebody has to take rather than a tuning change.
     */
    it('leaves the longest lane long enough that a hull can still be under-provisioned', () => {
        const longest = SEA_LANES.reduce((a, b) => (a.expectedDays > b.expectedDays ? a : b));
        const best = daysByConveyance(longest.expectedDays, BOAT, OBJECT_CEILING_BELOW_THE_LID);
        expect(best, 'the best hull in the world crosses instantly, so the sea is decoration').toBeGreaterThan(1);
        // And the customary margin is still a margin that a bad run eats into.
        expect(Math.ceil(best * (1 + CUSTOMARY_PROVISIONING_MARGIN))).toBeGreaterThan(best);
    });
});

describe('range', () => {
    // RULING 3.
    it('says nothing when the choice was reasonable', () => {
        expect(unsuitedFor(CARRIAGE_EARTH, 11)).toBeNull();
        expect(unsuitedFor(FOOT, 2)).toBeNull();
    });

    it('charges for taking too little, without refusing it', () => {
        const note = unsuitedFor(CARRIAGE_HEAVEN, 30);
        expect(note).not.toBeNull();
        expect(note).toContain('arrive late');
    });

    it('charges for taking too much, which is the mistake a rich house makes', () => {
        const note = unsuitedFor(BOAT, 2);
        expect(note).not.toBeNull();
        expect(note).toContain('loud');
    });

    it('stops at the bank when the ground does', () => {
        expect(unsuitedFor(CARRIAGE_HEAVEN, 10, true)).toContain('ground under it');
        expect(unsuitedFor(BOAT, 10, true)).toBeNull();
    });

    it('gives the district rung a reach a district actually is', () => {
        expect(REACH_IN_WALKING_DAYS.district).toBeLessThan(REACH_IN_WALKING_DAYS.province);
        expect(REACH_IN_WALKING_DAYS.province).toBeLessThan(REACH_IN_WALKING_DAYS.crossing);
    });
});

describe('what a witness reads', () => {
    it('reads walking as information rather than as an absence', () => {
        expect(whatArrivingOnThisSays(FOOT)).toContain('walked');
    });

    it('reads a tracked craft as a cost nobody could fake', () => {
        const said = whatArrivingOnThisSays(BOAT, 38);
        expect(said).toContain('38');
        expect(said).toContain('faking');
    });

    it('lets the ordinary rungs pass unremarked, and never lets a hull', () => {
        expect(couldArriveUnremarked(MOUNT)).toBe(true);
        expect(couldArriveUnremarked(CARRIAGE_EARTH)).toBe(true);
        expect(
            couldArriveUnremarked(BOAT),
            'a hull that can arrive quietly is a signal with no cost attached'
        ).toBe(false);
    });
});

describe('putting a party on the road', () => {
    it('counts the trips a conveyance too small for the party costs', () => {
        const one = priceJourney({ walkingDays: 11, conveyance: CARRIAGE_EARTH, heads: 6 });
        expect(one.trips).toBe(1);
        expect(one.daysForEverybody).toBe(one.daysOneWay);

        const three = priceJourney({ walkingDays: 11, conveyance: CARRIAGE_EARTH, heads: 15 });
        expect(three.trips).toBe(3);
        // Out, back, out, back, out: five legs for three loads.
        expect(three.daysForEverybody).toBe(three.daysOneWay * 5);
    });

    it('reports what was saved, which is the figure that makes a rung legible', () => {
        const walked = priceJourney({ walkingDays: 11, conveyance: FOOT, heads: 4 });
        const rode = priceJourney({ walkingDays: 11, conveyance: CARRIAGE_EARTH, heads: 4 });
        expect(walked.daysSavedAgainstWalking).toBe(0);
        expect(rode.daysSavedAgainstWalking).toBeGreaterThan(0);
        expect(rode.daysOneWay).toBeLessThan(walked.daysOneWay);
    });

    it('takes the carriage across the district and the hull across the water', () => {
        const held = [
            { conveyance: BOAT, power: 38 },
            { conveyance: CARRIAGE_HEAVEN, power: 31 },
            { conveyance: FOOT, power: null }
        ];
        // Nothing to cross, and eight people: the boat is not faster enough
        // over two days to beat the thing meant for it on any tiebreak that
        // matters, and the carriage carries them in one load.
        const shortRun = bestForThisRoad(held, 2, 8);
        expect(shortRun).not.toBeNull();
        expect(shortRun!.conveyance.range).toBe('district');

        // Water, and only one thing crosses it.
        const overWater = bestForThisRoad(held, 34, 20, true);
        expect(overWater!.conveyance.id).toBe('conv-spirit-boat');
    });

    it('has nothing to offer when the water has to be crossed and no hull is held', () => {
        const poor = [{ conveyance: CARRIAGE_EARTH, power: null }, { conveyance: FOOT, power: null }];
        expect(bestForThisRoad(poor, 34, 8, true)).toBeNull();
    });
});

/**
 * RULING 4. Flight belongs to sword schools.
 *
 * Ruled by the design owner: flight on one's own sword is not a rung anybody
 * with a metal root reaches at Foundation. Before this the art gated on
 * `requiredOrdinal` 15 and an element and on nothing else. The gate is now
 * `subject` on the technique row, which the schema always carried and
 * `daoMatches` always read.
 */
describe('flight on one\'s own blade', () => {
    // The row plus the road it stands on, which is what the caller passes and
    // what the gate now reads instead of a `'sword'` constant. A catalog row
    // carries `subjects` and the gate takes the scalar, the same way
    // `whatTheyCouldRide` does.
    const FLIGHT_ART = {
        ...getTechnique('gale-riding-sword-flight')!,
        subject: primaryRoadOf(getTechnique('gale-riding-sword-flight')!)
    };
    const OTHER_SWORD_ART = SWORD_ARTS.find(a => a.id !== FLIGHT_ART.id)!;

    it('is the one conveyance that is nobody\'s property', () => {
        expect(FLIGHT.holding).toBe('personal');
        expect(CONVEYANCES.filter(c => c.holding === 'personal').length).toBe(1);
        expect(FLIGHT.heads, 'a technique cannot move a party').toBe(1);
    });

    it('marks the sword arts and nothing else', () => {
        expect(SWORD_ARTS.length).toBeGreaterThanOrEqual(3);
        expect(isSwordArt('gale-riding-sword-flight')).toBe(true);
        expect(isSwordArt('lesser-qi-gathering-manual')).toBe(false);
        // Sword is the PRIMARY road on every one of them, which is what makes
        // `primaryRoadOf` safe for the flight gate now that an art may be on
        // more than one road: two of these also carry 'formation', after it.
        for (const art of SWORD_ARTS) expect(art.subjects[0]).toBe('sword');
    });

    /**
     * The gate has to speak the vocabulary the insight layer already speaks,
     * and before these five rows it did not.
     *
     * `understanding.ts` mints `{ domain: 'weapon', subject: 'sword' }` from a
     * sword tomb and from an origin's outer library, and `SUBJECT_DOMAINS`
     * maps `sword` to the weapon domain. `SUBJECT_BY_CATEGORY` defaults every
     * attack art to the subject `'weapon'`, which is a DOMAIN name and matches
     * no insight in the world - so `techniqueMultiplier`, which matches an
     * insight to an art on `insight.subject === technique.subject`, gave a
     * cultivator who understood the sword nothing at all on the sword arts.
     *
     * If somebody later renames the insight subject, this goes red and the two
     * halves get renamed together instead of drifting apart in silence.
     */
    it('uses the same word for the road that the insight layer mints', () => {
        const understandsTheSword = {
            spiritRoot: 'single_metal',
            insights: [{
                id: 'insight-sword-tomb',
                domain: 'weapon' as const,
                subject: 'sword',
                degree: 2,
                provenance: 'site' as const
            }]
        };
        const flight = getTechnique('gale-riding-sword-flight')!;
        const art = { element: flight.element, subjects: flight.subjects, mastery: 1 };
        const withIt = techniqueEffectiveness(understandsTheSword as never, art);
        const without = techniqueEffectiveness(
            { spiritRoot: 'single_metal', insights: [] } as never,
            art
        );
        expect(
            withIt.fromUnderstanding,
            'understanding the sword still buys nothing on a sword art'
        ).toBeGreaterThan(without.fromUnderstanding);
    });

    it('is closed to somebody who has never been shown it', () => {
        const r = couldFlyOnTheirOwnBlade({
            realmOrdinal: 30,
            known: [{ id: OTHER_SWORD_ART.id, subject: 'sword' }],
            flightArt: FLIGHT_ART
        });
        expect(r.can).toBe(false);
        expect(r.reason).toBe('does_not_know_it');
    });

    it('is closed to somebody holding one page out of a school they are not in', () => {
        const r = couldFlyOnTheirOwnBlade({
            realmOrdinal: 30,
            known: [{ id: FLIGHT_ART.id, subject: 'sword' }],
            flightArt: FLIGHT_ART,
            daoSubject: 'fire'
        });
        expect(r.can).toBe(false);
        expect(r.reason).toBe('not_of_the_school');
    });

    it('opens to a disciple of a sword house who holds another of its arts', () => {
        const r = couldFlyOnTheirOwnBlade({
            realmOrdinal: FLIGHT_ART.requiredOrdinal,
            known: [
                { id: FLIGHT_ART.id, subject: 'sword' },
                { id: OTHER_SWORD_ART.id, subject: 'sword' }
            ],
            flightArt: FLIGHT_ART
        });
        expect(r.can).toBe(true);
    });

    it('opens to somebody whose road is the sword even with nothing else on the shelf', () => {
        const r = couldFlyOnTheirOwnBlade({
            realmOrdinal: 40,
            known: [{ id: FLIGHT_ART.id, subject: 'sword' }],
            flightArt: FLIGHT_ART,
            daoSubject: 'sword'
        });
        expect(r.can).toBe(true);
    });

    it('still refuses somebody of the school who has not reached the rung', () => {
        const r = couldFlyOnTheirOwnBlade({
            realmOrdinal: FLIGHT_ART.requiredOrdinal - 1,
            known: [
                { id: FLIGHT_ART.id, subject: 'sword' },
                { id: OTHER_SWORD_ART.id, subject: 'sword' }
            ],
            flightArt: FLIGHT_ART
        });
        expect(r.can).toBe(false);
        expect(r.reason).toBe('rung_too_low');
    });
});

describe('the catalog and the engine agree', () => {
    it('prices every row in the catalog without a special case', () => {
        for (const c of CONVEYANCES as readonly Conveyance[]) {
            const priced = priceJourney({ walkingDays: 11, conveyance: c, heads: 4, power: 33 });
            expect(priced.daysOneWay).toBeGreaterThan(0);
            expect(priced.arrivalReads.length).toBeGreaterThan(40);
        }
    });
});
