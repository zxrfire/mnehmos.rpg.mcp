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
 *   5. WHAT A CHEST BURNS, AND WHAT DOES NOT BURN AT ALL. The design owner:
 *      spirit boats are fuelled by spirit stones, and a house sends as often as
 *      its treasury allows. Nothing in the engine consumed anything before
 *      this - no `fuel`, no charge, no stones on the row - while `prompt.ts`
 *      had been telling the narrator stones were fuel the whole time, so the
 *      prose was promising a mechanic that did not exist. The figure is
 *      `STONES_BURNED_PER_HEAD_PER_DAY`, the sea's own, unchanged: a hull over
 *      dead ground is buying the same absent vein a hull over water buys. What
 *      is asserted here is the three things that do NOT burn - a beast eats, a
 *      carriage is standing on a vein, and an art is somebody's own qi - because
 *      those are what a later reader will want to "fix" into a ladder of
 *      expense.
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
    burnsStonesUnderWay,
    headDaysUnderWay,
    priceJourney,
    realmsAboveTheTrackedFloor,
    whatTheChestBurns,
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
import {
    CUSTOMARY_PROVISIONING_MARGIN,
    STONES_BURNED_PER_HEAD_PER_DAY
} from '../../../src/engine/world/what-a-sea-crossing-costs.js';
import { OBJECT_CEILING_BELOW_THE_LID } from '../../../src/engine/cultivation/realms.js';
import { refiningOrdinalFor } from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { TECHNIQUES, getTechnique } from '../../../src/data/cultivation/techniques.js';
import { isOnRoad, primaryRoadOf } from '../../../src/schema/cultivation.js';
import { techniqueEffectiveness } from '../../../src/engine/cultivation/understanding.js';

const SWORD_ARTS = TECHNIQUES
    .filter(t => isOnRoad(t, 'sword'))
    .sort((a, b) => a.requiredOrdinal - b.requiredOrdinal || (a.id < b.id ? -1 : 1));
const isSwordArt = (id: string) => SWORD_ARTS.some(t => t.id === id);

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
        // Void Tribulation runs 29..32, so the first step is at 33.
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

describe('what a journey burns', () => {
    it('charges nothing to anything with ground under it', () => {
        for (const c of CONVEYANCES.filter(c => !c.crossesGroundThatCannotBeWalked)) {
            expect(burnsStonesUnderWay(c)).toBe(false);
            expect(priceJourney({ walkingDays: 20, conveyance: c, heads: 4 }).stonesBurned)
                .toBe(0);
        }
        // The row that would otherwise read as the top of a ladder of expense.
        expect(burnsStonesUnderWay(CARRIAGE_HEAVEN)).toBe(false);
    });

    it('charges nothing to somebody holding themselves up on their own art', () => {
        expect(FLIGHT.crossesGroundThatCannotBeWalked).toBe(true);
        expect(FLIGHT.holding).toBe('personal');
        expect(burnsStonesUnderWay(FLIGHT)).toBe(false);
        expect(priceJourney({ walkingDays: 20, conveyance: FLIGHT, heads: 1 }).stonesBurned)
            .toBe(0);
    });

    it('charges a hull the same stone the sea charges, per head per day', () => {
        expect(burnsStonesUnderWay(BOAT)).toBe(true);
        const journey = priceJourney({ walkingDays: 30, conveyance: BOAT, heads: 8 });
        expect(journey.stonesBurned).toBe(Math.ceil(
            headDaysUnderWay(journey.daysOneWay, 8, journey.trips)
            * STONES_BURNED_PER_HEAD_PER_DAY
        ));
        expect(journey.stonesBurned).toBeGreaterThan(0);
    });

    it('costs more for more people and more for more loads', () => {
        const few = priceJourney({ walkingDays: 30, conveyance: BOAT, heads: 4 });
        const many = priceJourney({ walkingDays: 30, conveyance: BOAT, heads: BOAT.heads });
        expect(many.stonesBurned).toBeGreaterThan(few.stonesBurned);

        // Past what it holds, the craft goes back for the rest and the empty
        // leg burns too - but the first load is not charged again for it.
        const twoLoads = priceJourney({
            walkingDays: 30, conveyance: BOAT, heads: BOAT.heads + 1
        });
        expect(twoLoads.trips).toBe(2);
        expect(twoLoads.stonesBurned).toBeGreaterThan(many.stonesBurned);
        expect(twoLoads.stonesBurned).toBeLessThan(many.stonesBurned * 2);
    });

    it('costs less on a better craft, because grade is days rather than a rate', () => {
        // The same hull rated higher covers the road in fewer days and is
        // therefore under way for fewer of them. No running-cost table decides
        // this and none could disagree with the speed table.
        const plain = priceJourney({ walkingDays: 40, conveyance: BOAT, heads: 10 });
        const rated = priceJourney({
            walkingDays: 40, conveyance: BOAT, heads: 10, power: OBJECT_CEILING_BELOW_THE_LID
        });
        expect(rated.daysOneWay).toBeLessThan(plain.daysOneWay);
        expect(rated.stonesBurned).toBeLessThan(plain.stonesBurned);
    });

    it('prices a craft out of reach of a purse that cannot cover the burn', () => {
        const available = CONVEYANCES.map(c => ({ conveyance: c, power: null }));
        const crossing = { walkingDays: 30, heads: 12 };
        const rich = bestForThisRoad(
            available, crossing.walkingDays, crossing.heads, true, 100_000);
        expect(rich).not.toBeNull();
        expect(rich!.conveyance.id).toBe(BOAT.id);

        // An empty chest cannot run the hull. It is NOT stranded: the other
        // row that crosses dead ground is somebody's own art, which burns
        // their qi and not a purse - so a sword house too poor for a chest
        // still gets over the water one head at a time, slowly, which is
        // exactly what the sword-flight row already says of itself.
        const broke = bestForThisRoad(
            available, crossing.walkingDays, crossing.heads, true, 0);
        expect(broke).not.toBeNull();
        expect(broke!.conveyance.id).toBe(FLIGHT.id);
        expect(broke!.conveyance.id).not.toBe(BOAT.id);
        expect(priceJourney({
            walkingDays: crossing.walkingDays,
            conveyance: broke!.conveyance,
            heads: crossing.heads
        }).trips).toBe(crossing.heads);
        // And with no purse in hand nothing is priced out, which is what every
        // caller that has never held one keeps getting.
        expect(bestForThisRoad(available, crossing.walkingDays, crossing.heads, true))
            .not.toBeNull();
    });

    it('leaves a walking party alone however empty the purse is', () => {
        const available = CONVEYANCES.map(c => ({ conveyance: c, power: null }));
        const chosen = bestForThisRoad(available, 20, 6, false, 0);
        expect(chosen).not.toBeNull();
        expect(burnsStonesUnderWay(chosen!.conveyance)).toBe(false);
    });

    /**
     * THE FIGURE THE CATALOG PRODUCES, PINNED WHERE SOMEBODY WILL SEE IT.
     *
     * `whatTheChestBurns` was exported, reached through `priceJourney` and
     * never called directly by a test, so the one number this whole mechanic
     * exists to produce was asserted only as a side effect. It is worth
     * stating outright, because it is what makes the design owner's rule - a
     * house sends as often as it can afford to - a real constraint rather than
     * a sentence.
     *
     * A sending to open an inheritance is 120 walking days with six hands. A
     * spirit boat at heaven grade is under way 24 of those days, so six heads
     * crossing once is 144 stones, against a seeded purse of 200 to 1,400 and
     * a payroll of 45 a member a year. A poor house gets one crossing and then
     * cannot make payroll.
     *
     * Nothing here is a chosen number: the rate is the sea crossing's own
     * constant, the days come off the grade, and the heads come off the
     * errand.
     */
    it('charges a hundred and forty-four stones for the crossing the catalog describes', () => {
        const daysOneWay = daysByConveyance(120, BOAT);
        expect(daysOneWay, 'the boat is no longer 24 days over 120 walking ones').toBe(24);
        expect(whatTheChestBurns({
            conveyance: BOAT, daysOneWay, heads: 6, trips: 1
        })).toBe(144);

        // And the same crossing on something standing on a vein costs nothing
        // at all, however finely made - which is the half a reader is most
        // likely to try to "fix" into a ladder of expense.
        const carriage = CONVEYANCES.find(c => !c.crossesGroundThatCannotBeWalked)!;
        expect(whatTheChestBurns({
            conveyance: carriage, daysOneWay: 40, heads: 6, trips: 1
        })).toBe(0);
    });
});
