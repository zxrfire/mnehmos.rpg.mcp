/**
 * The counted stock a place holds, and the rate it comes back at.
 *
 * ── WHY THE RATES ARE PINNED HERE RATHER THAN ONLY DECLARED ──────────────
 *
 * `REGROWTH_YEARS_BY_GRADE` is a design decision living as five numbers, and
 * AGENTS.md is explicit that a decision which lives only as a number nobody
 * reads twice gets silently reverted by the next person who finds it
 * surprising. So the decisions are asserted as SENTENCES, in test names:
 *
 *   a hillside is green again next spring
 *   a working life strips a district and does not see it back
 *   the top two bands do not come back inside any horizon a run reaches
 *
 * If one of those sentences stops being the design, rewrite the test to say
 * what the design is now. Do not widen the bar until it passes.
 */
import { describe, expect, it } from 'vitest';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { QI_DENSITY_DEFAULT } from '../../../src/engine/world/qi-scale.js';
import {
    BAND_CAPACITY_AT_ORDINARY_GROUND,
    REGROWTH_YEARS_BY_GRADE,
    STOCK_GRADES,
    TAKEN_PER_PERSON_PER_YEAR,
    applyGroundDraw,
    capacityFor,
    drawFromTheGround,
    howTheGroundReads,
    peopleThisGroundCanCarry,
    pressureOverDays,
    shareOfTheYearSpentOn,
    standingStock,
    theOrdinaryAnimalsAreGone,
    whatIsLeftOutThere,
    whatTheGroundStillHas,
    whatThePeopleHereTake,
    whoWorksEachBand
} from '../../../src/engine/world/what-a-place-still-has-in-the-ground.js';

/** Ordinary open ground, which is where almost everybody stands. */
function ordinaryGround() {
    return makeLocation({
        id: 'loc-test-valley',
        name: 'Blackwater Valley',
        kind: 'wilds',
        qiDensity: QI_DENSITY_DEFAULT
    });
}

/** Take `n` out of a band and hand back the place afterwards. */
function take(
    place: ReturnType<typeof ordinaryGround>,
    kind: 'herb' | 'beast_material',
    grade: (typeof STOCK_GRADES)[number],
    n: number,
    onDay: number
) {
    const draw = drawFromTheGround(place, { kind, grade, wanted: n, onDay });
    return { draw, after: applyGroundDraw(place, draw) };
}

/** Strip a band to nothing, however many passes it takes. */
function stripBare(
    place: ReturnType<typeof ordinaryGround>,
    kind: 'herb' | 'beast_material',
    grade: (typeof STOCK_GRADES)[number],
    onDay: number
) {
    const capacity = capacityFor(place, kind, grade);
    return take(place, kind, grade, capacity, onDay);
}

describe('what a place still has in the ground', () => {
    describe('the count is a measurement of the catalog, not a number anybody chose', () => {
        it('reads capacity off the catalog rarity weights', () => {
            // Not transcribed. If a herb is added the world holds more of that
            // band, with nobody editing a constant.
            const place = ordinaryGround();
            for (const grade of STOCK_GRADES) {
                expect(capacityFor(place, 'herb', grade))
                    .toBe(BAND_CAPACITY_AT_ORDINARY_GROUND.herb[grade]);
            }
        });

        it('falls steeply with grade, which is the pyramid seen from the supply side', () => {
            // items.md: only the bottom of the ladder has enough to restock
            // indefinitely. Here that arrives as an ordering rather than a
            // claim, and the counts are large enough that one reading is proof.
            const place = ordinaryGround();
            for (const kind of ['herb', 'beast_material'] as const) {
                const counts = STOCK_GRADES.map(g => capacityFor(place, kind, g));
                for (let i = 1; i < counts.length; i++) {
                    expect(counts[i]).toBeLessThan(counts[i - 1]);
                }
            }
        });

        it('holds one full-time forager at mortal grade and does not at earth', () => {
            // THE ABSOLUTE SCALE, AND THE ARGUMENT FOR IT. The ratios between
            // bands are the catalog's measurement; how big the numbers are in
            // units-a-person-can-carry is a separate decision, and this is it:
            //
            //   a band is sustainable when one hard worker takes less in a year
            //   than the band grows back in a year
            //
            // At mortal grade that holds with room for ten of them, which is
            // why nobody has ever heard of a district running out of hare
            // pelts. At earth grade it does not, which is why a house arguing
            // about where to send a party is having a real argument.
            const place = ordinaryGround();
            // One person's year on the ground: a pass a month, and what a pass
            // yields at the top of the regard band. Read off the module rather
            // than retyped, because the equilibrium this test states and the
            // pressure the world applies have to be the same arithmetic - they
            // were two copies of this figure for exactly as long as nothing
            // wrote the column.
            const A_YEARS_WORK = TAKEN_PER_PERSON_PER_YEAR;
            const grownBackPerYear = (grade: (typeof STOCK_GRADES)[number]) =>
                capacityFor(place, 'herb', grade) / REGROWTH_YEARS_BY_GRADE[grade];

            expect(grownBackPerYear('mortal')).toBeGreaterThan(A_YEARS_WORK * 5);
            expect(grownBackPerYear('earth')).toBeLessThan(A_YEARS_WORK);
        });

        it('scales with the ground, because what grows here is a fact about the vein', () => {
            const thin = makeLocation({ id: 'l1', name: 'Thin', kind: 'wilds', qiDensity: 10 });
            const rich = makeLocation({ id: 'l2', name: 'Rich', kind: 'wilds', qiDensity: 100 });
            expect(capacityFor(rich, 'herb', 'earth'))
                .toBeGreaterThan(capacityFor(thin, 'herb', 'earth'));
        });
    });

    describe('taking reduces it', () => {
        it('takes the amount asked for while the ground has it', () => {
            const place = ordinaryGround();
            const before = standingStock(place, 'herb', 'mortal', 0).remaining;
            const { draw, after } = take(place, 'herb', 'mortal', 40, 0);

            expect(draw.taken).toBe(40);
            expect(draw.shortfall).toBe(0);
            expect(standingStock(after, 'herb', 'mortal', 0).remaining).toBe(before - 40);
        });

        it('accumulates across passes rather than resetting on the last one', () => {
            let place = ordinaryGround();
            const capacity = capacityFor(place, 'herb', 'earth');
            for (let i = 0; i < 5; i++) place = take(place, 'herb', 'earth', 20, 0).after;
            expect(standingStock(place, 'herb', 'earth', 0).remaining).toBe(capacity - 100);
        });

        it('hands back what is there rather than what was asked for, and says so', () => {
            const place = ordinaryGround();
            const capacity = capacityFor(place, 'herb', 'chaos');
            const { draw } = take(place, 'herb', 'chaos', capacity + 50, 0);

            expect(draw.taken).toBe(capacity);
            expect(draw.shortfall).toBe(50);
            // Not silently less. A place that has been worked out says so.
            expect(draw.line).toBeTruthy();
        });

        it('leaves no mark on a place that was walked over and not worked', () => {
            const place = ordinaryGround();
            const { draw, after } = take(place, 'herb', 'mortal', 0, 0);
            expect(draw.taken).toBe(0);
            expect(after.data).toEqual(place.data);
        });

        it('writes only scalars, so the row round-trips as JSON on world_locations.data', () => {
            const { after } = take(ordinaryGround(), 'beast_material', 'earth', 7, 900);
            for (const value of Object.values(after.data)) {
                expect(['string', 'number', 'boolean']).toContain(
                    value === null ? 'string' : typeof value
                );
            }
            expect(JSON.parse(JSON.stringify(after.data))).toEqual(after.data);
        });

        it('stores two numbers per band and nothing else - no ids, no provenance', () => {
            // The whole storage design in one assertion. A counted thing is an
            // amount and a date, and adding a third field here is the change
            // that would turn a bowl of millet into a row with a history.
            const { after } = take(ordinaryGround(), 'herb', 'mortal', 5, 12);
            expect(Object.keys(after.data).sort())
                .toEqual(['ground.herb.mortal.day', 'ground.herb.mortal.drawn']);
        });
    });

    describe('the regrowth rate is a design decision', () => {
        it('a picked-over hillside is green again next spring', () => {
            // MORTAL GRADE: one year, empty to full. This is why the culling
            // trade and the herb stalls work at all, and why nobody has ever
            // heard of a district running out of hare pelts.
            const place = ordinaryGround();
            const { after } = stripBare(place, 'herb', 'mortal', 0);

            expect(standingStock(after, 'herb', 'mortal', 0).reading).toBe('worked_out');
            expect(standingStock(after, 'herb', 'mortal', DAYS_PER_YEAR).share).toBe(1);
            // And halfway through, halfway back.
            expect(standingStock(after, 'herb', 'mortal', DAYS_PER_YEAR / 2).share)
                .toBeCloseTo(0.5, 2);
        });

        it('a working life strips an earth-grade district and does not see it back', () => {
            // EARTH GRADE: twelve years. Long enough that a house arguing about
            // where to send a party is having a real argument, short enough
            // that the district is not lost.
            const { after } = stripBare(ordinaryGround(), 'herb', 'earth', 0);
            const years = (y: number) => standingStock(after, 'herb', 'earth', y * DAYS_PER_YEAR);

            expect(years(1).share).toBeLessThan(0.1);
            expect(years(6).reading).toBe('worked');
            expect(years(REGROWTH_YEARS_BY_GRADE.earth).share).toBe(1);
        });

        it('a heaven-grade bed emptied in your lifetime is emptied for your student\'s', () => {
            const { after } = stripBare(ordinaryGround(), 'herb', 'heaven', 0);
            expect(standingStock(after, 'herb', 'heaven', 80 * DAYS_PER_YEAR).reading)
                .not.toBe('untouched');
            expect(standingStock(after, 'herb', 'heaven',
                REGROWTH_YEARS_BY_GRADE.heaven * DAYS_PER_YEAR).share).toBe(1);
        });

        it('the top two bands do not come back inside any horizon a run reaches', () => {
            // THE LATE AGE, STATED AS A RATE. The acceptance test's horizon is
            // five hundred years. Immortal and chaos stock spent inside a world
            // is spent for the whole of that world's playable life: what is
            // here is what was left behind, and taking it spends principal.
            const ACCEPTANCE_HORIZON_DAYS = 500 * DAYS_PER_YEAR;
            for (const grade of ['immortal', 'chaos'] as const) {
                const { after } = stripBare(ordinaryGround(), 'herb', grade, 0);
                const band = standingStock(after, 'herb', grade, ACCEPTANCE_HORIZON_DAYS);
                // A sixth of an immortal band back after five centuries, and a
                // sixtieth of a chaos one. Not "slow" - gone, for the whole of
                // a world's playable life.
                expect(band.share).toBeLessThan(0.2);
                expect(band.reading).not.toBe('untouched');
            }
        });

        it('nothing stays picked clean forever, which is the bug this rate exists to avoid', () => {
            // A province that is stripped and stays stripped is a worse world
            // than an infinite one. Every band refills eventually, including
            // the two that outlast the run.
            for (const grade of STOCK_GRADES) {
                const { after } = stripBare(ordinaryGround(), 'herb', grade, 0);
                const full = REGROWTH_YEARS_BY_GRADE[grade] * DAYS_PER_YEAR;
                expect(standingStock(after, 'herb', grade, full).share).toBe(1);
            }
        });

        it('grows nothing back on a clock that has not moved or was asked backwards', () => {
            const { after } = stripBare(ordinaryGround(), 'herb', 'mortal', 1_000);
            expect(standingStock(after, 'herb', 'mortal', 1_000).remaining).toBe(0);
            expect(standingStock(after, 'herb', 'mortal', 0).remaining).toBe(0);
        });
    });

    describe('regrowth takes no sample', () => {
        it('is byte-identical across repeated reads of the same day', () => {
            // There is no RNG stream in this module and there must not be one.
            // A draw added here would shift every later draw on whatever stream
            // it borrowed.
            const { after } = stripBare(ordinaryGround(), 'herb', 'earth', 40);
            const reads = Array.from({ length: 5 }, () =>
                JSON.stringify(standingStock(after, 'herb', 'earth', 40 + 900)));
            expect(new Set(reads).size).toBe(1);
        });
    });

    describe('a place that has been worked out says so', () => {
        it('answers what it still has, in prose, without being asked twice', () => {
            const place = ordinaryGround();
            expect(howTheGroundReads(place, 0)).toContain('always carried');

            const { after } = stripBare(place, 'herb', 'earth', 0);
            const said = howTheGroundReads(after, 0);
            expect(said).toContain('worked out');
            expect(said).toContain('earth-grade herbs');
        });

        it('does not report bands this ground never held', () => {
            // Saying "worked out" about ground that never carried anything of a
            // grade is a lie in the shape of a measurement.
            const dead = makeLocation({
                id: 'l3', name: 'The Burn', kind: 'scar', qiDensity: 1
            });
            const bands = whatTheGroundStillHas(dead, 0);
            expect(bands.every(b => b.capacity > 0)).toBe(true);
        });

        it('stays quiet while the ground is holding up', () => {
            // A sentence every turn about a district that is fine is noise, and
            // then the one that matters gets skipped with it.
            const { draw } = take(ordinaryGround(), 'herb', 'mortal', 1, 0);
            expect(draw.line).toBeNull();
        });
    });

    // ── THE DRAW-DOWN IS THE POPULATION, NOT THE POUCH ───────────────────
    //
    // Every one of these is a design decision living as arithmetic, which is
    // the shape AGENTS.md says must be pinned as a sentence. The defect they
    // exist to stop coming back is measured and specific: all three call sites
    // of `drawFromTheGround` ask for ONE unit, mortal herb regrows 44.88 over
    // the seven days a gather takes, so the net of a full-time player's whole
    // career was POSITIVE and mortal stock could not fall by any actor. A
    // thousand world-years produced zero rows.
    describe('what the people standing on it take', () => {
        it('is a whole population, against which one gatherer is a rounding error', () => {
            // The two numbers side by side, because the gap between them is
            // the finding. A pouch does not move a district; a district's
            // people do.
            const place = ordinaryGround();
            const onePass = 1;
            const aVillage = pressureOverDays({
                workers: 20, kind: 'herb', grade: 'mortal', days: DAYS_PER_YEAR
            });
            expect(aVillage / onePass).toBeGreaterThan(1000);
        });

        it('presses on a band only through the people whose own rung opens it', () => {
            // `GRADE_ORDINAL_BANDS` decides which grade a rung works, and this
            // is the whole of the gate. A villager does not compete for
            // earth-grade beds and a Core Formation cultivator does not spend
            // their year among the mortal ones.
            const bands = whoWorksEachBand([0, 4, 12, 13, 20, 21, 29, 37]);
            expect(bands.get('mortal')).toBe(3);
            expect(bands.get('earth')).toBe(2);
            expect(bands.get('heaven')).toBe(1);
            expect(bands.get('immortal')).toBe(1);
            expect(bands.get('chaos')).toBe(1);
        });

        it('divides a year between the two kinds so both reach the line together', () => {
            // Derived from what the ground offers rather than halved, and the
            // property that buys is that "how many people can this ground
            // carry" is ONE number per grade instead of two that drift.
            for (const grade of STOCK_GRADES) {
                const shares = shareOfTheYearSpentOn('herb', grade)
                    + shareOfTheYearSpentOn('beast_material', grade);
                expect(shares).toBeCloseTo(1, 9);
            }
            const place = ordinaryGround();
            for (const grade of STOCK_GRADES) {
                const carry = peopleThisGroundCanCarry(place, grade);
                for (const kind of ['herb', 'beast_material'] as const) {
                    const takenAtTheLine = pressureOverDays({
                        workers: carry, kind, grade, days: DAYS_PER_YEAR
                    });
                    const grownBack = capacityFor(place, kind, grade)
                        / REGROWTH_YEARS_BY_GRADE[grade];
                    expect(takenAtTheLine).toBeCloseTo(grownBack, 6);
                }
            }
        });

        it('carries a village at mortal grade and cannot carry one at earth', () => {
            // THE SHAPE OF THE WHOLE MODEL, and it is the population pyramid
            // arriving on the supply side rather than being restated. Hundreds
            // of people stand in the mortal band and a handful in the heaven
            // one, so ordinary ground holds up under a settlement and the good
            // bands near anywhere people live were picked over generations ago.
            const place = ordinaryGround();
            expect(peopleThisGroundCanCarry(place, 'mortal')).toBeGreaterThan(10);
            expect(peopleThisGroundCanCarry(place, 'earth')).toBeLessThan(1);
            expect(peopleThisGroundCanCarry(place, 'heaven')).toBeLessThan(0.05);
            // And each rung down the ladder carries strictly more people than
            // the rung above it, which is the ordering the whole setting rests
            // on. Nothing chose it: it is the catalogs over the regrowth clock.
            const carry = STOCK_GRADES.map(g => peopleThisGroundCanCarry(place, g));
            for (let i = 1; i < carry.length; i++) {
                expect(carry[i]).toBeLessThan(carry[i - 1]);
            }
        });

        it('takes nothing at all where nobody is standing', () => {
            // The mechanism that keeps the wilds worth walking to. Presence is
            // `NpcRecord.locationId` and a place nobody stands on is pressed
            // on by nobody - which is why going further out is an answer to a
            // district that has been worked out rather than a consolation.
            const place = ordinaryGround();
            const worked = whatThePeopleHereTake(place, {
                ordinals: [], days: DAYS_PER_YEAR, onDay: 0
            });
            expect(worked.draws).toHaveLength(0);
        });

        it('works a district out under a crowd, and says which band went', () => {
            const place = ordinaryGround();
            const crowd = Array.from({ length: 60 }, () => 0);
            const worked = whatThePeopleHereTake(place, {
                ordinals: crowd, days: DAYS_PER_YEAR, onDay: 0
            });
            expect(worked.draws.length).toBeGreaterThan(0);
            expect(worked.workedOut.map(d => `${d.kind}/${d.grade}`).sort())
                .toEqual(['beast_material/mortal', 'herb/mortal']);
        });

        it('takes the same amount over a year however many steps the year came in', () => {
            // A split advance and a single one have to agree, which is the
            // promise `advanceTime` makes about everything else.
            const inOne = pressureOverDays({
                workers: 9, kind: 'herb', grade: 'mortal', days: DAYS_PER_YEAR
            });
            let inTwelve = 0;
            for (let i = 0; i < 12; i++) {
                inTwelve += pressureOverDays({
                    workers: 9, kind: 'herb', grade: 'mortal', days: DAYS_PER_YEAR / 12
                });
            }
            expect(inTwelve).toBeCloseTo(inOne, 9);
        });

        it('lets a band that was pressed and left alone come back on its own clock', () => {
            // Pressure is not a permanent mark. A settlement that empties out
            // gives its ground back, at the rate the grade already states.
            const place = ordinaryGround();
            const worked = whatThePeopleHereTake(place, {
                ordinals: Array.from({ length: 60 }, () => 0), days: DAYS_PER_YEAR, onDay: 0
            });
            let after = place;
            for (const draw of worked.draws) after = applyGroundDraw(after, draw);
            expect(standingStock(after, 'herb', 'mortal', 0).reading).toBe('worked_out');
            expect(standingStock(after, 'herb', 'mortal', DAYS_PER_YEAR).reading)
                .not.toBe('worked_out');
        });
    });

    describe('depletion is a cause', () => {
        it('leaves what was eating them when the ordinary animals are gone', () => {
            const place = ordinaryGround();
            expect(theOrdinaryAnimalsAreGone(place, 0)).toBe(false);
            expect(whatIsLeftOutThere(place, 0)).toBeNull();

            const { after } = stripBare(place, 'beast_material', 'mortal', 0);
            expect(theOrdinaryAnimalsAreGone(after, 0)).toBe(true);
            expect(whatIsLeftOutThere(after, 0)).toContain('what was eating it');
        });

        it('does not fire on a district whose herbs were stripped and whose game was not', () => {
            const { after } = stripBare(ordinaryGround(), 'herb', 'mortal', 0);
            expect(theOrdinaryAnimalsAreGone(after, 0)).toBe(false);
        });

        it('comes back with the ordinary animals, on the mortal band\'s own clock', () => {
            const { after } = stripBare(ordinaryGround(), 'beast_material', 'mortal', 0);
            expect(theOrdinaryAnimalsAreGone(after, DAYS_PER_YEAR)).toBe(false);
        });
    });
});
