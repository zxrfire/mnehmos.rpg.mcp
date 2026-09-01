/**
 * Validation for the False Immortal catalog: the legacy paths, the trajectory,
 * the vacant office and the one eligible person who cannot hold it.
 *
 * The load-bearing assertions, in the order they matter:
 *   - no seal anywhere in the world reaches ordinal 45, which is the fact the
 *     whole institution rests on and which nothing else in the repo pins
 *   - no house has a serving protector, and the office is nonetheless open
 *   - the trajectory is ordered, contiguous, and covers the rung's full span
 *   - every historical entry has an end, and none of them is resident now
 *   - the vacancy is supply and has no villain in it
 *   - Lu Sheng is early on the curve and cannot reach the far end of it
 */

import { describe, it, expect } from 'vitest';

import {
    FALSE_IMMORTAL_LIFESPAN_YEARS,
    FALSE_IMMORTAL_ORDINAL
} from '../../src/engine/cultivation/realms.js';
import { FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS } from '../../src/engine/world/ladder-odds.js';
import {
    getSect,
    getDestroyedDaoHouse,
    getDormantAncestors,
    SECT_ANCESTRY
} from '../../src/data/cultivation/sects.js';
import { APEX_INSTITUTIONS } from '../../src/data/cultivation/hierarchy.js';
import { getTechnique } from '../../src/data/cultivation/techniques.js';
import { getWanderer } from '../../src/data/cultivation/wanderers.js';
import {
    FALSE_IMMORTALS,
    FalseImmortalRecordSchema,
    FalseImmortalEndSchema,
    LegacyPathSchema,
    LegacyStateSchema,
    MADNESS_STAGES,
    MadnessStageSchema,
    MAX_RESIDENT_FALSE_IMMORTALS,
    THE_OPEN_AXIS,
    THE_REMAINDER,
    THE_SEAL_CANNOT_REACH_THEM,
    THE_TWO_EXITS,
    THE_OFFICE,
    THE_VACANCY,
    THE_OFFER,
    THE_CANDIDATE_REGISTER,
    IDENTIFYING_A_SEAT,
    marksThatGenerateCandidateLines,
    THE_PRESENT_COUNT,
    CARVING,
    DEPARTURE,
    DEPARTURE_DESTINATIONS,
    RecruitmentSchema,
    residenceIsExceptional,
    byRecruitment,
    madnessStageAt,
    stageIndex,
    canEverReach,
    getFalseImmortal,
    protectorsOf,
    byEnd,
    byPath,
    servingProtectors,
    reachableCarvings,
    techniquesFromCarvings,
    stageAtEndOf
} from '../../src/data/cultivation/false-immortals.js';

// ─────────────────────────────────────────────────────────────────────────
// THE INVARIANT UNDER EVERYTHING
// A seal runs from Void Refinement to Tribulation Transcendence. A False
// Immortal is one rung above the top of it. Nothing in the repo checked this
// before, and the entire office depends on it.
// ─────────────────────────────────────────────────────────────────────────

describe('the seal cannot reach a False Immortal', () => {
    it('holds no sealed ancestor anywhere at or above the False Immortal rung', () => {
        for (const { sectId, dormant } of getDormantAncestors()) {
            expect(
                dormant.realmOrdinal,
                `${sectId} has sealed ${dormant.name} at ordinal ${dormant.realmOrdinal}, ` +
                `which is at or above ordinal ${FALSE_IMMORTAL_ORDINAL}. Nothing in the Late Age ` +
                'was built to hold that, and no sect may bank a False Immortal.'
            ).toBeLessThan(FALSE_IMMORTAL_ORDINAL);
        }
    });

    it('checks every ancestry record and not only the ones with instruments', () => {
        // Belt and braces: getDormantAncestors filters, so walk the raw table too.
        const seen: string[] = [];
        for (const [sectId, records] of Object.entries(SECT_ANCESTRY)) {
            if (!records.dormant) continue;
            seen.push(sectId);
            expect(records.dormant.realmOrdinal, sectId).toBeLessThan(FALSE_IMMORTAL_ORDINAL);
        }
        expect(seen.length, 'the catalog should hold several sealed ancestors').toBeGreaterThanOrEqual(3);
    });

    it('states the band, the gap and the door out of it', () => {
        expect(THE_SEAL_CANNOT_REACH_THEM.theBand).toMatch(/Void Refinement/);
        expect(THE_SEAL_CANNOT_REACH_THEM.theBand).toMatch(/Tribulation Transcendence/);
        expect(THE_SEAL_CANNOT_REACH_THEM.theGap).toMatch(/one rung/i);
        expect(THE_SEAL_CANNOT_REACH_THEM.soNobodyBanksOne).toMatch(/No sect could|no sect could/);
        // The qualifier is a loss rather than a law, with a name and a number.
        expect(THE_SEAL_CANNOT_REACH_THEM.theSpecification.theNinthFamily).toMatch(/ninth/i);
        expect(THE_SEAL_CANNOT_REACH_THEM.theSpecification.theCount).toMatch(/eleven/i);
        expect(THE_SEAL_CANNOT_REACH_THEM.theSpecification.theCount).toMatch(/[Nn]ine are required/);
        expect(THE_SEAL_CANNOT_REACH_THEM.theSpecification.theQualifier).toMatch(/not today/i);
        // And nothing in the world is a sealed False Immortal.
        expect(THE_SEAL_CANNOT_REACH_THEM.theSpecification.nobodyEverBuiltOne)
            .toMatch(/never be written as one|no evidence/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
// ─────────────────────────────────────────────────────────────────────────

describe('the historical False Immortals', () => {
    it('parses, has unique ids, and is small', () => {
        expect(FALSE_IMMORTALS.length).toBeGreaterThanOrEqual(5);
        expect(FALSE_IMMORTALS.length).toBeLessThanOrEqual(12);
        for (const f of FALSE_IMMORTALS) {
            expect(() => FalseImmortalRecordSchema.parse(f), f.id).not.toThrow();
        }
        const ids = FALSE_IMMORTALS.map(f => f.id);
        expect(new Set(ids).size, 'duplicate id in the catalog').toBe(ids.length);
        for (const id of ids) expect(getFalseImmortal(id)?.id).toBe(id);
    });

    it('resolves every house it names against the sect or destroyed-house catalogs', () => {
        for (const f of FALSE_IMMORTALS) {
            const factionId = f.office?.factionId;
            if (factionId === null || factionId === undefined) continue;
            const known = getSect(factionId) ?? getDestroyedDaoHouse(factionId);
            expect(known, `${f.id} names an unknown house: ${factionId}`).toBeDefined();
            expect(protectorsOf(factionId)).toContain(f);
        }
        // And a null house says why, rather than leaving a hole.
        for (const f of FALSE_IMMORTALS) {
            if (f.office && f.office.factionId === null) {
                expect(f.office.factionNote.length, f.id).toBeGreaterThan(80);
            }
        }
    });

    it('records where each of them came from, and holds at least one of each', () => {
        for (const f of FALSE_IMMORTALS) {
            expect(f.office, `${f.id} has no office`).not.toBeNull();
            expect(RecruitmentSchema.options, f.id).toContain(f.office!.recruitment);
            expect(f.office!.recruitmentNote.length, f.id).toBeGreaterThan(120);
        }
        expect(byRecruitment('internal').length, 'the norm should appear at all')
            .toBeGreaterThanOrEqual(1);
        expect(byRecruitment('external').length).toBeGreaterThanOrEqual(1);
        // The catalog is skewed toward external, and the file says why rather
        // than letting a reader take the ratio for the world.
        expect(byRecruitment('external').length).toBeGreaterThan(byRecruitment('internal').length);
        expect(THE_OFFICE.internalIsTheNorm).toMatch(/[Tt]ypically it is one of your own/);
        expect(THE_OFFICE.internalIsTheNorm).toMatch(/possible and it is rare/i);
        expect(THE_OFFICE.whyTheRecordSaysOtherwise).toMatch(/outsiders were written down/i);
        // And an external entry carries the awkwardness rather than smoothing it.
        const awkward = byRecruitment('external')
            .filter(f => /no reason to die for|no history there/i.test(f.office!.recruitmentNote));
        expect(awkward.length, 'no external case carries its own awkwardness').toBeGreaterThanOrEqual(1);
    });

    it('gives every one of them an end and none of them a present tense', () => {
        for (const f of FALSE_IMMORTALS) {
            expect(FalseImmortalEndSchema.options, f.id).toContain(f.end);
            expect(f.endedYearsAgo, `${f.id} has no date for its ending`).toBeGreaterThan(0);
            expect(f.endNote.length, f.id).toBeGreaterThan(200);
            expect(f.servingNow, `${f.id} is recorded as serving`).toBe(false);
        }
    });

    it('is a residence problem rather than a production problem', () => {
        // The design point: most of them leave, and the two exits dominate.
        const left = [...byEnd('went_looking'), ...byEnd('went_mad')];
        expect(
            left.length,
            'the two exits should account for most of the catalog, or the design is not visible'
        ).toBeGreaterThan(FALSE_IMMORTALS.length / 2);
        // Both exits are represented, and so is the honest baseline.
        expect(byEnd('went_looking').length).toBeGreaterThanOrEqual(2);
        expect(byEnd('went_mad').length).toBeGreaterThanOrEqual(2);
        expect(byEnd('ran_out').length).toBeGreaterThanOrEqual(1);
        expect(byEnd('ended_from_above').length).toBeGreaterThanOrEqual(1);
    });

    it('covers all three legacy paths', () => {
        for (const path of LegacyPathSchema.options) {
            expect(byPath(path).length, `no historical entry is on path ${path}`).toBeGreaterThanOrEqual(1);
        }
        for (const f of FALSE_IMMORTALS) {
            expect(f.pathNote.length, f.id).toBeGreaterThan(150);
            expect(LegacyStateSchema.options, f.id).toContain(f.legacyAtEnd);
        }
    });

    it('assigns a real stage wherever the crossing can be dated, and none where it cannot', () => {
        for (const f of FALSE_IMMORTALS) {
            if (f.crossedYearsAgo === null) {
                expect(f.stageAtEndId, `${f.id} dates a stage off an undated crossing`).toBeNull();
                continue;
            }
            expect(f.stageAtEndId, `${f.id} has a datable crossing and no stage`).not.toBeNull();
            const stage = stageAtEndOf(f.id);
            expect(stage, `${f.id} names an unknown stage`).toBeDefined();
            // And the stage agrees with the arithmetic the file itself defines.
            const years = f.crossedYearsAgo - f.endedYearsAgo;
            expect(years, `${f.id} ended before it crossed`).toBeGreaterThan(0);
            expect(
                madnessStageAt(years).id,
                `${f.id} claims ${stage!.id} at ${years} years since crossing`
            ).toBe(stage!.id);
        }
        // At least one entry is honestly undatable.
        expect(FALSE_IMMORTALS.filter(f => f.crossedYearsAgo === null).length).toBeGreaterThanOrEqual(1);
    });

    it('marks where the two exits cannot be told apart', () => {
        const ambiguous = FALSE_IMMORTALS.filter(f => f.whichExitItReallyWas !== null);
        expect(ambiguous.length, 'the record should not be able to separate them everywhere')
            .toBeGreaterThanOrEqual(2);
        expect(THE_TWO_EXITS.andTheyAreOftenTheSameExit).toMatch(/Settled Error/);
        expect(THE_TWO_EXITS.andTheyAreOftenTheSameExit).toMatch(/no test that separates/i);
        // And the terminals are the concrete door.
        expect(THE_TWO_EXITS.theGatesAreWhereTheyGo).toMatch(/terminal/i);
        expect(THE_TWO_EXITS.theThirdThingThatIsNotAnExit).toMatch(/run out|runs out/i);
    });

    it('leaves each of them something a player could actually find', () => {
        for (const f of FALSE_IMMORTALS) {
            expect(f.whatSurvives.length, f.id).toBeGreaterThanOrEqual(1);
            for (const trace of f.whatSurvives) expect(trace.length, f.id).toBeGreaterThan(50);
        }
        // Except one, whose whole point is that nothing survives.
        const traceless = FALSE_IMMORTALS.filter(f => f.carving === null);
        expect(traceless.length, 'somebody should have left no carving at all').toBeGreaterThanOrEqual(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// CARVINGS
// ─────────────────────────────────────────────────────────────────────────

describe('carved dao', () => {
    it('resolves its holders and its yielded arts against the real catalogs', () => {
        for (const f of FALSE_IMMORTALS) {
            const carving = f.carving;
            if (!carving) continue;
            if (carving.heldByFactionId !== null) {
                const holder = getSect(carving.heldByFactionId) ?? getDestroyedDaoHouse(carving.heldByFactionId);
                expect(holder, `${carving.id} held by unknown faction`).toBeDefined();
            }
            for (const techniqueId of carving.yieldedTechniqueIds) {
                expect(getTechnique(techniqueId), `${carving.id} yields unknown art ${techniqueId}`)
                    .toBeDefined();
            }
            expect(carving.builtOnIt.length, carving.id).toBeGreaterThan(150);
        }
    });

    it('has produced at least one art that is already in the world', () => {
        const yielded = techniquesFromCarvings();
        expect(yielded.length, 'no carving has ever yielded anything').toBeGreaterThanOrEqual(1);
        for (const id of yielded) expect(getTechnique(id)).toBeDefined();
    });

    it('spreads across legibility rather than being uniformly mysterious', () => {
        const carvings = FALSE_IMMORTALS.map(f => f.carving).filter(c => c !== null);
        const legibilities = new Set(carvings.map(c => c!.legible));
        expect(legibilities.size, 'every carving fails the same way').toBeGreaterThanOrEqual(3);
        expect(legibilities).toContain('fully');
        // And a fully legible one can still be useless, which is the point.
        const fully = carvings.filter(c => c!.legible === 'fully');
        expect(fully.length).toBeGreaterThanOrEqual(1);
        // Reachable ones exclude the ones nobody has ever seen.
        expect(reachableCarvings().every(c => c.legible !== 'unseen')).toBe(true);
    });

    it('is not the cold curriculum, and says so', () => {
        expect(CARVING.itIsNotTheColdCurriculum).toMatch(/Frostmirror/);
        expect(CARVING.itIsNotTheColdCurriculum).toMatch(/aperture|reader's body/i);
        expect(CARVING.whyMostOfItCannotBeRead).toMatch(/not a cipher|stopped assuming a reader/i);
        expect(CARVING.aRecordThatTheyWereHere).toMatch(/name outlasting/i);
    });

    it('leaves almost every holder unaware of what it is standing over', () => {
        const carvings = FALSE_IMMORTALS.map(f => f.carving).filter(c => c !== null);
        const knowing = carvings.filter(c => c!.holderKnows);
        expect(knowing.length, 'holders should not know what they have').toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TRAJECTORY
// ─────────────────────────────────────────────────────────────────────────

describe('the madness stages', () => {
    it('parses, is ordered, contiguous, and covers the rung\'s whole span', () => {
        expect(MADNESS_STAGES.length).toBeGreaterThanOrEqual(4);
        for (const stage of MADNESS_STAGES) {
            expect(() => MadnessStageSchema.parse(stage), stage.id).not.toThrow();
            expect(stage.toYear, stage.id).toBeGreaterThan(stage.fromYear);
        }
        const ids = MADNESS_STAGES.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        // Contiguous: each band starts exactly where the last one stopped.
        expect(MADNESS_STAGES[0].fromYear).toBe(0);
        for (let i = 1; i < MADNESS_STAGES.length; i++) {
            expect(MADNESS_STAGES[i].fromYear, `gap or overlap before ${MADNESS_STAGES[i].id}`)
                .toBe(MADNESS_STAGES[i - 1].toYear);
        }
        // And the last one ends at the rung's figure, not somewhere arbitrary.
        expect(MADNESS_STAGES[MADNESS_STAGES.length - 1].toYear).toBe(FALSE_IMMORTAL_LIFESPAN_YEARS);
        // stageIndex agrees with array order.
        MADNESS_STAGES.forEach((s, i) => expect(stageIndex(s.id)).toBe(i));
        expect(stageIndex('stage-that-does-not-exist')).toBe(-1);
    });

    it('is driven by the axis rather than by elapsed time, and says so', () => {
        expect(THE_OPEN_AXIS.twoAxesAndOneIsShut).toMatch(/separate axes/i);
        expect(THE_OPEN_AXIS.understandingIsWhatHoldsThemTogether)
            .toMatch(/only thing that keeps them intact|keeps them intact/i);
        expect(THE_OPEN_AXIS.aDaoHasAPeak).toMatch(/event with a date/i);
        expect(THE_OPEN_AXIS.theTwoFailures).toMatch(/failing by succeeding/i);
        expect(THE_OPEN_AXIS.thisIsAlreadyTrueInTheEngine).toMatch(/discoverableInsights/);
        // Every stage says what the axis is doing and what moves them on.
        for (const stage of MADNESS_STAGES) {
            expect(stage.theAxis.length, stage.id).toBeGreaterThan(150);
            expect(stage.whatMovesThemOn.length, stage.id).toBeGreaterThan(120);
        }
    });

    it('advances by exactly one band when the legacy stops holding', () => {
        // Years alone.
        expect(madnessStageAt(0).id).toBe(MADNESS_STAGES[0].id);
        expect(madnessStageAt(640).id).toBe(MADNESS_STAGES[0].id);
        expect(madnessStageAt(MADNESS_STAGES[1].fromYear).id).toBe(MADNESS_STAGES[1].id);
        // A failed or finished legacy walks the same years faster.
        for (let i = 0; i < MADNESS_STAGES.length; i++) {
            const year = MADNESS_STAGES[i].fromYear;
            const expected = Math.min(i + 1, MADNESS_STAGES.length - 1);
            expect(madnessStageAt(year, 'failed').id).toBe(MADNESS_STAGES[expected].id);
            expect(madnessStageAt(year, 'finished').id).toBe(MADNESS_STAGES[expected].id);
            expect(madnessStageAt(year, 'holding').id).toBe(MADNESS_STAGES[i].id);
        }
        // Total and clamped at both ends rather than throwing.
        expect(madnessStageAt(-500).id).toBe(MADNESS_STAGES[0].id);
        expect(madnessStageAt(Number.NaN).id).toBe(MADNESS_STAGES[0].id);
        expect(madnessStageAt(FALSE_IMMORTAL_LIFESPAN_YEARS * 2).id)
            .toBe(MADNESS_STAGES[MADNESS_STAGES.length - 1].id);
    });

    it('never goes backwards as the years increase', () => {
        let last = -1;
        for (let year = 0; year <= FALSE_IMMORTAL_LIFESPAN_YEARS; year += 500) {
            const index = stageIndex(madnessStageAt(year).id);
            expect(index, `regression at year ${year}`).toBeGreaterThanOrEqual(last);
            last = index;
        }
    });

    it('is honest about which stages anybody has actually watched', () => {
        const observed = MADNESS_STAGES.filter(s => s.observed);
        const unobserved = MADNESS_STAGES.filter(s => !s.observed);
        expect(observed.length).toBeGreaterThanOrEqual(3);
        expect(unobserved.length, 'the far end should not be presented as established').toBe(1);
        // And the unobserved one is the last, and admits it may be wrong.
        expect(unobserved[0].id).toBe(MADNESS_STAGES[MADNESS_STAGES.length - 1].id);
        expect(unobserved[0].observedNote).toMatch(/may simply be wrong|reconstructed/i);
    });

    it('gates the far end behind a remainder almost nobody has', () => {
        const last = MADNESS_STAGES[MADNESS_STAGES.length - 1];
        expect(canEverReach(1_000, last.id)).toBe(false);
        expect(canEverReach(FALSE_IMMORTAL_LIFESPAN_YEARS, last.id)).toBe(true);
        expect(canEverReach(1_000, 'stage-that-does-not-exist')).toBe(false);
        expect(THE_REMAINDER.andItDecidesWhetherTheTrajectoryIsEvenReachable)
            .toMatch(/died inside the first stage|never gone anywhere near/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE REMAINDER
// ─────────────────────────────────────────────────────────────────────────

describe('the price of the crossing', () => {
    it('separates the rung\'s grant from what an individual keeps', () => {
        expect(THE_REMAINDER.theRungsFigure).toContain('300,000');
        expect(THE_REMAINDER.whatAnIndividualKeeps).toMatch(/minus/i);
        // Charged once, at the crossing. Not a decline.
        expect(THE_REMAINDER.thisIsThePriceAndNotTheTrajectory).toMatch(/charged once/i);
        expect(THE_REMAINDER.thisIsThePriceAndNotTheTrajectory).toMatch(/not an illness/i);
    });

    it('keeps every recorded remainder well under the rung\'s figure', () => {
        for (const f of FALSE_IMMORTALS) {
            if (f.remainderAtCrossingYears === null) continue;
            expect(f.remainderAtCrossingYears, f.id).toBeLessThan(FALSE_IMMORTAL_LIFESPAN_YEARS);
        }
        // And at least one is honestly unrecorded, because most of them are.
        expect(FALSE_IMMORTALS.filter(f => f.remainderAtCrossingYears === null).length)
            .toBeGreaterThanOrEqual(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE OFFICE, WHICH IS VACANT AND NOT ABOLISHED
// ─────────────────────────────────────────────────────────────────────────

describe('the dao protector office', () => {
    it('has no serving False Immortal holder anywhere in the world', () => {
        expect(servingProtectors(), 'a serving protector has appeared in the catalog').toEqual([]);
        expect(THE_PRESENT_COUNT.servingProtectors).toMatch(/^Zero, in the sense this file counts/);
        // But it does not close the post off, which would harden a vacancy
        // into an abolition and remove the hook.
        expect(THE_PRESENT_COUNT.servingProtectors).toMatch(/open rather than abolished/i);
        // And no faction record anywhere points at a False Immortal as a protector.
        for (const [sectId, records] of Object.entries(SECT_ANCESTRY)) {
            if (!records.dormant) continue;
            expect(records.dormant.realmOrdinal, sectId).toBeLessThan(FALSE_IMMORTAL_ORDINAL);
        }
    });

    it('is tiered: filled by lesser cultivators below, reserved and empty above', () => {
        expect(THE_OFFICE.theWordDoesTwoJobs).toMatch(/Nascent Soul|Core Formation/);
        expect(THE_OFFICE.theWordDoesTwoJobs).toMatch(/filled/i);
        expect(THE_OFFICE.theReservedPost).toMatch(/will not fill it/i);
        // Only a house that produced a crossing can expect one, which is the
        // structural reason the reserved chair sits where it does.
        expect(THE_OFFICE.onlyAHouseThatProducedOneCanHaveOne).toMatch(/crossed and came back/i);
        expect(THE_OFFICE.onlyAHouseThatProducedOneCanHaveOne).toMatch(/produced somebody/i);
        // And the qualifier is the crossing record rather than a rank in a
        // hierarchy, because the house with the most crossings behind it is
        // outside every hierarchy the setting has.
        expect(THE_OFFICE.onlyAHouseThatProducedOneCanHaveOne).toMatch(/crossing record/i);
        expect(
            APEX_INSTITUTIONS.some(a => a.id === 'sect-hollow-court'),
            'the Hollow Court holds from nobody and is not an apex; see hierarchy.ts'
        ).toBe(false);
        // And the empty chair is a monument to success, not to failure.
        const monument = THE_OFFICE.theChairIsEmptyBecauseTheirPeopleGotThrough;
        expect(monument).toMatch(/opposite of failure/i);
        expect(monument).toMatch(/Ru Anjing/);
        expect(monument).toMatch(/First Abbot/);
        expect(monument).toMatch(/First Tyrant/);
        // Those four houses are real and their crossing dates agree with sects.ts.
        for (const sectId of [
            'sect-azure-cloud-pavilion',
            'sect-sweptground-temple',
            'sect-storm-tyrant-court',
            'sect-hollow-court'
        ]) {
            const records = SECT_ANCESTRY[sectId];
            expect(records, `${sectId} has no ancestral records`).toBeDefined();
            expect(
                records.ancestors.some(a => a.fate === 'ascended'),
                `${sectId} is cited as having produced a crossing and has no ascended ancestor`
            ).toBe(true);
        }
    });

    it('is open rather than abolished, with concrete residue to prove it', () => {
        expect(THE_OFFICE.itIsVacantAndNotAbolished).toMatch(/Nobody ended the reserved post/i);
        expect(THE_OFFICE.itIsVacantAndNotAbolished).toMatch(/vacancy rather than a history/i);
        expect(THE_VACANCY.itCouldBeFilledTomorrow).toMatch(/post is live/i);
        expect(THE_VACANCY.whatTheResidueLooksLike.length).toBeGreaterThanOrEqual(4);
        for (const line of THE_VACANCY.whatTheResidueLooksLike) {
            expect(line.length).toBeGreaterThan(60);
        }
        const residue = THE_VACANCY.whatTheResidueLooksLike.join(' ');
        expect(residue).toMatch(/stipend|ledger/i);
        expect(residue).toMatch(/quarters|swept/i);
    });

    it('blames the vacancy on supply, with no villain and no turning point', () => {
        expect(THE_VACANCY.theReason).toMatch(/lack of False Immortals/i);
        expect(THE_VACANCY.theReason).toMatch(/No house broke faith|nothing was decided/i);
        // And the supply shortage is a residence shortage, not a production one.
        expect(THE_VACANCY.andThatIsNotADeclineInProduction).toMatch(/not how many are made/i);
        expect(THE_VACANCY.andThatIsNotADeclineInProduction).toMatch(/THE_TWO_EXITS/);
        // The other scarcity is named and explicitly not the cause.
        expect(THE_VACANCY.thereIsLessOnOfferToo).toMatch(/never be written as the reason/i);
    });

    it('states what the post obliges, which is nothing, and what it cannot ask', () => {
        expect(THE_OFFICE.whatItObliges).toMatch(/[Nn]othing enforceable/);
        expect(THE_OFFICE.whatItObliges).toMatch(/eleven instruments/i);
        expect(THE_OFFICE.whatItCannotAskFor).toMatch(/An order\./);
        expect(THE_OFFICE.whatTheHousePays).toMatch(/[Nn]ot stones/);
        // Two functions, separable, and only one of them needs a promise.
        expect(THE_OFFICE.whatTheHouseGets).toMatch(/two things/i);
        expect(THE_OFFICE.whatTheHouseGets).toMatch(/presence/i);
        expect(THE_OFFICE.whatTheHouseGets).toMatch(/dao/i);
    });

    it('agrees with the catalog about houses that gave an order', () => {
        const ordered = FALSE_IMMORTALS.filter(f => f.office?.theOrderThatWasGiven !== null && f.office);
        expect(ordered.length, 'at least one house should have tried it').toBeGreaterThanOrEqual(1);
        for (const f of ordered) {
            expect(f.office!.theOrderThatWasGiven!.length, f.id).toBeGreaterThan(100);
        }
    });

    it('describes an offer that could actually be made to a player', () => {
        expect(THE_OFFER.howItWouldCome).toMatch(/not as a summons|never as a bid/i);
        expect(THE_OFFER.whatItCouldNotAsk).toMatch(/instruction|writing|exclusive/i);
        expect(THE_OFFER.andWhatItWouldBuy).toMatch(/somebody else can hand you/i);
        expect(THE_OFFER.whatTakingItWouldMean).toMatch(/promise to be somewhere/i);
        // Own house first, elsewhere rare, and the early choice pays late.
        expect(THE_OFFER.theDefaultIsYourOwnHouse).toMatch(/house that raised them/i);
        expect(THE_OFFER.outsideIsPossibleAndRare).toMatch(/happens and is unusual/i);
        expect(THE_OFFER.whichMakesAnEarlyChoiceMatterVeryLate).toMatch(/ordinal three|bottom of the ladder/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// DEPARTURE
// The mechanism the world layer's arithmetic assumes.
// ─────────────────────────────────────────────────────────────────────────

describe('departure', () => {
    it('is what the world layer\'s residence figure is made of', () => {
        expect(DEPARTURE.theArithmeticItServes).toMatch(/mean residence/i);
        expect(DEPARTURE.theArithmeticItServes).toMatch(/five hundred/i);
        // Leaving, never dying of age, which is the misreading to forestall.
        expect(DEPARTURE.theArithmeticItServes).toMatch(/not a lifespan/i);
        expect(DEPARTURE.theHazard).toMatch(/going looking is what kills them/i);
        expect(DEPARTURE.itIsNotSightseeing).toMatch(/path two/i);
    });

    it('leaves nobody below the Lid able to tell a departure from a death', () => {
        expect(DEPARTURE.nobodyBelowCanTellTheDifference).toMatch(/no signal/i);
        expect(DEPARTURE.nobodyBelowCanTellTheDifference).toMatch(/identical evidence|which is none/i);
        // And a departure is reversible, which is where the entrances come from.
        expect(DEPARTURE.theyComeBack).toMatch(/not a death/i);
        expect(DEPARTURE.theyComeBack).toMatch(/Kept Name/);
    });

    it('marks Lu Sheng as the one who stayed rather than the only one ever made', () => {
        expect(DEPARTURE.luShengIsTheOneWhoStayed).toMatch(/not the only False Immortal/i);
        expect(DEPARTURE.luShengIsTheOneWhoStayed).toMatch(/one who did not go|the one who stayed/i);
        // And the arithmetic agrees: he is past the mean and therefore unusual.
        const lu = getWanderer('wanderer-lu-sheng')!;
        expect(residenceIsExceptional(lu.crossingYearsAgo)).toBe(true);
        expect(residenceIsExceptional(100)).toBe(false);
        expect(residenceIsExceptional(FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS)).toBe(false);
    });

    it('names concrete places they go, and what comes back from each', () => {
        expect(DEPARTURE_DESTINATIONS.length).toBeGreaterThanOrEqual(3);
        const ids = DEPARTURE_DESTINATIONS.map(d => d.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const d of DEPARTURE_DESTINATIONS) {
            expect(d.where.length, d.id).toBeGreaterThan(40);
            expect(d.whyThere.length, d.id).toBeGreaterThan(100);
            expect(d.whatComesBack.length, d.id).toBeGreaterThan(80);
        }
        const all = DEPARTURE_DESTINATIONS.map(d => d.where).join(' ');
        expect(all).toMatch(/terminal/i);
        expect(all).toMatch(/arterial/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE OUTER RING
// What the world can actually hold about any of this, which is admissions and
// a list of maybes built out of the marks in the catalog above.
// ─────────────────────────────────────────────────────────────────────────

describe('the register of possible False Immortals', () => {
    it('is built out of marks that are still in the world', () => {
        const marks = marksThatGenerateCandidateLines();
        expect(marks.length, 'nothing in the catalog leaves a noticeable mark')
            .toBeGreaterThanOrEqual(3);
        // Derived, not listed: everything returned is readable or in use.
        for (const f of marks) {
            expect(f.carving, f.id).not.toBeNull();
            const readable = f.carving!.legible === 'fully' || f.carving!.legible === 'partly';
            expect(
                readable || f.carving!.yieldedTechniqueIds.length > 0,
                `${f.id} generates a line off a mark nobody can read or use`
            ).toBe(true);
        }
        // And a carving nobody can read or has ever seen generates nothing,
        // which is why the register is shorter than the catalog.
        expect(marks.length).toBeLessThan(FALSE_IMMORTALS.length);
        expect(THE_CANDIDATE_REGISTER.theMarksAreWhatGeneratesIt).toMatch(/true-distance table/i);
        expect(THE_CANDIDATE_REGISTER.theMarksAreWhatGeneratesIt).toMatch(/guess at who/i);
    });

    it('is mostly dead people, unevenly evidenced, and cannot be closed', () => {
        const r = THE_CANDIDATE_REGISTER;
        expect(r.mostOfItIsDeadPeopleAndTheEntriesAreUneven).toMatch(/list of the dead/i);
        expect(r.mostOfItIsDeadPeopleAndTheEntriesAreUneven).toMatch(/never a name/i);
        // Every line asks the same three questions in the same order.
        expect(r.everyLineHasTheSameShape).toMatch(/Tribulation Transcendence/);
        expect(r.everyLineHasTheSameShape).toMatch(/[Dd]id they attempt/);
        expect(r.everyLineHasTheSameShape).toMatch(/die at it/i);
        // And it inherits the departure problem rather than solving it.
        expect(r.itCannotTellADeathFromADeparture)
            .toMatch(/DEPARTURE\.nobodyBelowCanTellTheDifference/);
        expect(r.itCannotTellADeathFromADeparture).toMatch(/same absence/i);
    });

    it('is maintained and never used, and nobody acts on it', () => {
        const r = THE_CANDIDATE_REGISTER;
        expect(r.itIsMaintainedAndNeverUsed).toMatch(/Nobody has ever acted on it/);
        expect(r.itIsMaintainedAndNeverUsed).toMatch(/no line has been struck/i);
        expect(r.itIsMaintainedAndNeverUsed).toMatch(/none of that is negligence/i);
    });

    it('makes admissions the only public fact and the only source', () => {
        const r = THE_CANDIDATE_REGISTER;
        expect(r.whatIsActuallyPublic).toMatch(/[Aa]dmissions, and nothing after them/);
        expect(r.whatIsActuallyPublic).toMatch(/one open door and no windows/i);
        // Rank and outcome are internal, which is what leaves the maybe.
        expect(r.whatIsActuallyPublic).toMatch(/never been stated by anybody/i);
        // The apexes hold a record of the house, not a file on a person.
        expect(r.soTheApexesHoldAListOfTheHouseAndNotADossier).toMatch(/Void Refinement/);
        expect(r.soTheApexesHoldAListOfTheHouseAndNotADossier).toMatch(/nearly useless/i);
        // His line's emptiness is the document's condition, not a finding.
        expect(r.andOneLineOnItIsAlive).toMatch(/goes blank/i);
        expect(r.andOneLineOnItIsAlive).toMatch(/ordinary way rather than in a pointed one/i);
        expect(r.andOneLineOnItIsAlive).toMatch(/distinguishes that line from the others/i);
    });

    it('never reaches the innermost ring', () => {
        // The chair, the roll, the afternoon and the answer are the Court's and
        // stay the Court's. Nothing in the outer ring may carry any of them.
        const outer = JSON.stringify(THE_CANDIDATE_REGISTER) + JSON.stringify(IDENTIFYING_A_SEAT);
        expect(outer, 'the innermost ring has leaked into the outer one')
            .not.toMatch(/chair|Guest of the Court|protector|deflect|First Seat/i);
    });
});

describe('identifying a Seat of the Hollow Court', () => {
    it('makes admission visible, uneven, and useless past the mountain', () => {
        expect(IDENTIFYING_A_SEAT.admissionIsNotUniform).toMatch(/Void Refinement/);
        expect(IDENTIFYING_A_SEAT.admissionIsNotUniform).toMatch(/already formidable/i);
        expect(IDENTIFYING_A_SEAT.admissionIsNotUniform)
            .toMatch(/stops at exactly the point the mountain starts/i);
    });

    it('runs identification through intimacy rather than analysis', () => {
        const s = IDENTIFYING_A_SEAT;
        expect(s.nobodyWorksOutASeatFromRecords).toMatch(/there are none to work from/i);
        // The same mechanism wanderers.ts gives for recognising Lu Sheng.
        expect(s.nobodyWorksOutASeatFromRecords).toMatch(/second question/i);
        expect(s.nobodyWorksOutASeatFromRecords).toMatch(/not being in a hurry/i);
        const lu = getWanderer('wanderer-lu-sheng')!;
        expect(lu.notFixed.whoCouldTell).toMatch(/second question/i);
        // And it only ever happens because somebody was told.
        expect(s.andOnlyIfTheSeatShowedThem).toMatch(/[Ss]omebody was told/);
        expect(s.andOnlyIfTheSeatShowedThem).toMatch(/opacity is intact/i);
    });

    it('grades the confidence rather than settling it', () => {
        expect(IDENTIFYING_A_SEAT.theConfidenceIsGraded).toMatch(/four in five/i);
        expect(IDENTIFYING_A_SEAT.theConfidenceIsGraded).toMatch(/forty years/i);
        expect(IDENTIFYING_A_SEAT.theConfidenceIsGraded).toMatch(/never get the last fifth/i);
        // The uncertain figure is preferred to the certain one, deliberately.
        expect(IDENTIFYING_A_SEAT.theConfidenceIsGraded)
            .toMatch(/better figure than somebody who knows/i);
    });

    it('puts the answer with people who have no price, and names nobody', () => {
        const s = IDENTIFYING_A_SEAT;
        expect(s.familyDoesNotSell).toMatch(/not one of them trades it/i);
        expect(s.familyDoesNotSell).toMatch(/not naivety/i);
        expect(s.familyDoesNotSell).toMatch(/not virtue/i);
        // The apexes' real problem, stated plainly.
        expect(s.whichIsTheActualProblemTheApexesHave).toMatch(/registers and leverage/i);
        expect(s.whichIsTheActualProblemTheApexesHave).toMatch(/not being sold/i);
        // Not a purchasable lead, and declining to say is a correct ending.
        expect(s.whatItIsForInPlay).toMatch(/[Nn]ot a lead/);
        expect(s.whatItIsForInPlay).toMatch(/cannot be bought/i);
        expect(s.whatItIsForInPlay).toMatch(/correct outcome/i);
        // Selling and talking are different, and the talkers are not fools.
        expect(s.butSellingAndTalkingAreNotTheSameThing).toMatch(/Nobody sells\. Some talk\./);
        expect(s.butSellingAndTalkingAreNotTheSameThing).toMatch(/done nothing wrong/i);
        expect(s.butSellingAndTalkingAreNotTheSameThing).toMatch(/not recording a mistake/i);
        // No Seat is named or resolved, here or anywhere in the file.
        const text = JSON.stringify(IDENTIFYING_A_SEAT);
        expect(text, 'a Seat has been named or resolved')
            .not.toMatch(/Ru Anwei|Ru Anjing|Second Seat|Third Seat|Fourth Seat/);
        // And nothing anywhere in it is venal.
        expect(text, 'the family channel must never become purchasable')
            .not.toMatch(/informant|bribe|paid for|in exchange for/i);
    });

    it('has failed before, historically, and only ever by accident', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        expect(h.itIsInTheRecord).toMatch(/Seats have been identified/);
        expect(h.itIsInTheRecord).toMatch(/dead long enough/i);
        // Two routes, both accidents: a signature art seen, or family talking.
        expect(h.theMechanismWasAlwaysInadvertent).toMatch(/[Nn]ever a purchase/);
        expect(h.theMechanismWasAlwaysInadvertent).toMatch(/signature art/i);
        expect(h.theMechanismWasAlwaysInadvertent).toMatch(/said more than they knew/i);
        expect(h.theMechanismWasAlwaysInadvertent).toMatch(/nobody was bought/i);
        // Which is what makes the register a patient object, not a sad one.
        expect(h.soTheListIsRationalRatherThanSad).toMatch(/paid off before/i);
        expect(h.soTheListIsRationalRatherThanSad).toMatch(/[Pp]atient with evidence/);
    });

    it('makes the wall out of absence, with silencing only as a backstop', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        // The structural answer, and it is the one the file leads with.
        expect(h.whyItIsRareRatherThanCommon).toMatch(/absence rather than security/i);
        expect(h.whyItIsRareRatherThanCommon).toMatch(/decades of absence/i);
        expect(h.whyItIsRareRatherThanCommon).toMatch(/wall is made of the work/i);
        // The same phrase the character catalog uses for the Court's work.
        expect(getWanderer('wanderer-lu-sheng')!.whyNotWithThem).toMatch(/decades of absence/i);
        // The backstop is cold, brief, and explicitly not the mechanism.
        expect(h.theBackstopWhenItDoesHappen).toMatch(/does not walk away holding it/i);
        expect(h.theBackstopWhenItDoesHappen).toMatch(/backstop rather than the mechanism/i);
        expect(h.theBackstopWhenItDoesHappen, 'no relish, no cruelty, no scene')
            .toMatch(/no cruelty in it and no relish/i);
    });

    it('cannot say what caused any historical identification', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        // Two causes, indistinguishable, and no entry is resolved.
        expect(h.andTheRecordDoesNotSayWhichCause).toMatch(/two possible causes/i);
        expect(h.andTheRecordDoesNotSayWhichCause).toMatch(/forced into the open/i);
        expect(h.andTheRecordDoesNotSayWhichCause).toMatch(/never out and simply stopped being a secret/i);
        expect(h.andTheRecordDoesNotSayWhichCause).toMatch(/nothing establishes which/i);
    });

    it('treats the family channel as settled policy, not as a blind spot', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        // They know. It is a decision, and the decision has a name.
        expect(h.theFamilyChannelIsPolicyRatherThanAHole).toMatch(/[Tt]he Court knows families leak/);
        expect(h.theFamilyChannelIsPolicyRatherThanAHole).toMatch(/clean up your own mess/i);
        expect(h.theFamilyChannelIsPolicyRatherThanAHole).toMatch(/does not go near them/i);
        expect(h.theFamilyChannelIsPolicyRatherThanAHole).toMatch(/includes doing nothing/i);
        // Coherent rather than lax, for three stated reasons.
        expect(h.whyThatIsAPositionAndNotLaxity).toMatch(/[Tt]hree things hold it up/);
        expect(h.whyThatIsAPositionAndNotLaxity).toMatch(/adult institution/i);
        expect(h.whyThatIsAPositionAndNotLaxity).toMatch(/cannot afford to lose one/i);
        expect(h.whyThatIsAPositionAndNotLaxity).toMatch(/permission and the responsibility are one object/i);
        // The third support is the arithmetic: there is very little there to
        // manage, so the hands-off position costs the house almost nothing.
        expect(h.whyThatIsAPositionAndNotLaxity).toMatch(/very little there to manage/i);
        expect(h.whyThatIsAPositionAndNotLaxity).toMatch(/andMostOfThemHaveNobodyLeftToTell/);
        // And the register is adults dealing with adults, not indulgence.
        expect(h.whyThatIsAPositionAndNotLaxity)
            .toMatch(/does not need to be told how to handle their own brother/i);
        // They have not audited anything. They know because they made the climb.
        expect(h.whyThatIsAPositionAndNotLaxity, 'the Court must not be written as having run the numbers')
            .toMatch(/nobody there has done the arithmetic/i);
        // The restraint is deliberate, which is the whole point of the entry.
        expect(h.soTheAsymmetryIsDeliberate).toMatch(/tolerated cost/i);
        expect(h.soTheAsymmetryIsDeliberate).toMatch(/decided not to/i);
        // And the house is never written as stupid or as blind here.
        const text = JSON.stringify(IDENTIFYING_A_SEAT);
        expect(text, 'the Court must not be given a blind spot it does not have')
            .not.toMatch(/blind spot|no way of knowing|would not know where to start|never learn/i);
    });

    it('keeps the channel small, because most Seats never open it', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        // Three groups, and the proportions are the point: the permission is
        // wide and almost nobody uses it, which is why four thousand years of
        // it have produced a countable number of leaks.
        expect(h.butMostOfThemNeverTell).toMatch(/say nothing/i);
        expect(h.andManyGiveTheHalfTruth).toMatch(/still out there/i);
        expect(h.soTheWholeTruthIsRare).toMatch(/only very few/i);

        // The half-truth is TRUE, not a lie. That is the whole reason it holds
        // for centuries without anybody maintaining a story.
        expect(h.andManyGiveTheHalfTruth).toMatch(/is true|does not make the rest of it false/i);
        // The entry may say he will not LIE to his mother - that is the point of
        // the half-truth. What it must not do is characterise the half-truth
        // itself as one, because its holding for centuries depends on it being
        // true with the load-bearing part removed.
        expect(h.andManyGiveTheHalfTruth, 'the half-truth must not be called a lie')
            .not.toMatch(/(?:it|which|this|that) is a lie|lying about|a deception|falsehood/i);

        // And the few who tell everything are the entire source of the record.
        expect(h.soTheWholeTruthIsRare).toMatch(/entire origin|every family leak/i);
    });

    it('has a third reason the channel is small: most of them have nobody left', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        const dead = h.andMostOfThemHaveNobodyLeftToTell;

        // The bar is the Court's floor and the climb to it is centuries long,
        // against families on ordinary spans. Both halves have to be present or
        // the fact reads as a mood rather than as arithmetic.
        expect(dead).toMatch(/Void Refinement/);
        expect(dead).toMatch(/hundred years|hundred\b/i);
        expect(dead).toMatch(/parents|brothers and sisters/i);
        expect(dead).toMatch(/ordinary spans/i);
        // The conclusion, stated as a share rather than as a universal.
        expect(dead).toMatch(/nobody to tell/i);
        expect(dead).toMatch(/large share/i);
        // It is a third reason the channel is small, beside the other two.
        expect(dead).toMatch(/third reason the channel is small/i);
        // Structure, not pathos - the file says so about itself.
        expect(dead).toMatch(/structural fact/i);
        expect(dead, 'the cost of the climb must not be written as tragedy')
            .toMatch(/rather than as a sadness/i);
        expect(dead, 'nobody chose this and nobody is to blame for it')
            .toMatch(/never a moment at which that was a choice/i);
        expect(dead, 'the fact must not become grief or bitterness')
            .not.toMatch(/tragic|grief|grieving|mourns|heartbreak|lonely|loneliness/i);
    });

    it('makes the surviving sister rarer than she looks, without softening her', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        const sister = h.whichIsAlsoWhyTheSisterIsRarerThanSheLooks;

        // To be alive at all she had to have climbed too, and the file names
        // the rung rather than gesturing at it.
        expect(sister).toMatch(/familyDoesNotSell/);
        expect(sister).toMatch(/Core Formation/);
        expect(sister).toMatch(/not a woman in a village/i);
        expect(sister).toMatch(/cultivators of some standing/i);
        // Both facts hold at once: she would still not sell, and there are few.
        expect(sister).toMatch(/would not sell/i);
        expect(sister).toMatch(/almost nobody like her/i);
        expect(sister, 'the rarity must not be allowed to cancel familyDoesNotSell')
            .toMatch(/neither softens the other/i);
        // And the underlying rule is untouched.
        expect(IDENTIFYING_A_SEAT.familyDoesNotSell).toMatch(/not one of them trades it/i);
    });

    it('makes the remedy containment rather than killing', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        const remedy = h.andTheRemedyIsContainmentRatherThanTheOtherThing;

        // They live. That is the horrifying part rather than the reassuring one.
        expect(remedy).toMatch(/house arrest/i);
        expect(remedy).toMatch(/rest of their lives/i);
        expect(remedy).toMatch(/fed|housed/i);
        expect(remedy, 'the remedy must not be a killing')
            .not.toMatch(/kill|murder|execut|put to death|silenced/i);

        // The Seat's own act, not the house's, and one option rather than a rule.
        expect(remedy).toMatch(/their own brother|the Seat goes/i);
        expect(remedy).toMatch(/one answer among several|not by the house/i);

        // And it is why permitting anybody to be told is affordable at all.
        expect(remedy).toMatch(/nobody has to die/i);
    });

    it('charges the mess to the Seat, inside the house, and to nobody else', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        // Standing first, the seat itself at the far end - the same escalation
        // shape any house uses on a member who has cost it something.
        expect(h.butTheMessHasAPrice).toMatch(/member in good standing/i);
        expect(h.butTheMessHasAPrice).toMatch(/at the far end the seat itself/i);
        expect(h.butTheMessHasAPrice).toMatch(/short of putting you out/i);
        // The Seat wears it. Never the family, and never an outsider.
        expect(h.butTheMessHasAPrice).toMatch(/never aimed at the family|ever aimed at the family/i);
        expect(h.butTheMessHasAPrice).toMatch(/no outsider is enforced against/i);
    });

    it('leaves the recent silence noticed and unexplained', () => {
        const h = IDENTIFYING_A_SEAT.theOpacityHasFailedBefore;
        expect(h.butNotForSeveralHundredYears).toMatch(/no such incident in centuries/i);
        // Three reasons, no answer.
        expect(h.butNotForSeveralHundredYears).toMatch(/may have got stricter/i);
        expect(h.butNotForSeveralHundredYears).toMatch(/no occasion/i);
        expect(h.butNotForSeveralHundredYears).toMatch(/may all be dead/i);
        expect(h.butNotForSeveralHundredYears).toMatch(/does not pick either/i);
        // Historical accidents and the live channel are one subject, not two.
        expect(h.thePairingRatherThanTheSeparation).toMatch(/not two subjects/i);
        expect(h.thePairingRatherThanTheSeparation).toMatch(/people who love somebody/i);
        // And the quiet is a run, not a wall - unasked rather than unknowable,
        // and not something anybody on those mountains is anxious about.
        expect(h.andTheQuietIsARunOfLuck).toMatch(/run rather than a wall/i);
        expect(h.andTheQuietIsARunOfLuck).toMatch(/the Court does not ask/i);
        expect(h.andTheQuietIsARunOfLuck).toMatch(/nobody there wants it/i);
        expect(h.andTheQuietIsARunOfLuck).toMatch(/not a thing anybody there is anxious about/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE PRESENT
// ─────────────────────────────────────────────────────────────────────────

describe('the present count', () => {
    it('holds at most a small number of resident False Immortals', () => {
        expect(MAX_RESIDENT_FALSE_IMMORTALS).toBeLessThanOrEqual(3);
        // Exactly one that anybody can point to, and he is in the wanderer catalog.
        expect(getWanderer('wanderer-lu-sheng')).toBeDefined();
        expect(THE_PRESENT_COUNT.residentFalseImmortals).toMatch(/One that anybody can point to/i);
        // None of the historical entries is resident, by construction.
        for (const f of FALSE_IMMORTALS) expect(f.servingNow, f.id).toBe(false);
    });

    it('puts Lu Sheng early on the curve and out of reach of the far end', () => {
        const lu = getWanderer('wanderer-lu-sheng')!;
        const stage = madnessStageAt(lu.crossingYearsAgo);
        expect(stage.id, 'Lu Sheng should be in the first stage').toBe(MADNESS_STAGES[0].id);
        // His whole remaining existence ends inside the second band.
        const atDeath = lu.crossingYearsAgo + lu.lifespanYearsRemaining;
        expect(stageIndex(madnessStageAt(atDeath).id)).toBeLessThanOrEqual(1);
        // And he can never reach the third, on the arithmetic rather than by fiat.
        expect(canEverReach(atDeath, MADNESS_STAGES[2].id)).toBe(false);
        expect(THE_REMAINDER.theWandererIsTheWorkedCase).toMatch(/five per cent/i);
        expect(THE_REMAINDER.theWandererIsTheWorkedCase).toMatch(/price of his crossing/i);
    });

    it('explains why the one eligible person holds no post, without resolving the rest', () => {
        const p = THE_PRESENT_COUNT.theOneEligiblePerson;
        // He is eligible. Nobody found him wanting, and the file must not imply it.
        expect(p.heIsEligible).toMatch(/[Ff]ully/);
        expect(p.heIsEligible).toMatch(/failed no test|nothing about him has ever been in doubt/i);
        expect(p.heIsEligible).toMatch(/found him wanting/i);
        // The reason is indifference to the title, not unfitness.
        expect(p.heDoesNotCareForTitles).toMatch(/means nothing to him/i);
        expect(p.heDoesNotCareForTitles).toMatch(/not avoiding the post/i);
        expect(p.whichMakesTheVacancyHisWithoutARefusal).toMatch(/[Nn]obody was turned down/);
        // The unrestrained trait is texture rather than the cause.
        expect(p.theUnrestraintIsTextureRatherThanTheReason).toMatch(/none of it is why/i);
        // Whether an offer was ever made stays unresolved.
        expect(p.whetherItWasEverOffered).toMatch(/[Uu]nknown/);
        expect(p.whetherItWasEverOffered).toMatch(/establishes none of it/i);
        // Overdetermined, deliberately.
        expect(p.threeReasonsAndAllOfThemTrue).toMatch(/not a thing that could happen/i);
        // And the exclusivity, which is not loyalty.
        expect(p.andNowhereElseIsACandidate).toMatch(/not loyalty|never be written as gratitude/i);
    });

    it('has the post informally offered to him, and answered neither way', () => {
        const p = THE_PRESENT_COUNT.theOneEligiblePerson;
        const o = p.theInformalOffer;
        // Something was said, in the shape the file already says an offer takes.
        expect(o.whatWasSaid).toMatch(/the chair was there/i);
        expect(o.whatWasSaid).toMatch(/[Nn]othing was proposed, nothing was asked for/);
        // One Seat heard it, which is the reason the rest is unsettled.
        expect(o.whatWasSaid).toMatch(/One Seat, in person and alone with him/);
        expect(o.whatWasSaid).toMatch(/THE_OFFER\.howItWouldCome/);
        // The deflection, which characterises him and answers nothing.
        expect(o.whatHeSaidBack).toMatch(/too unrestrained/i);
        expect(o.whatHeSaidBack).toMatch(/did not accept, did not decline/i);
        // Nowhere in it does he take the post or turn it down.
        const said = Object.values(o).join(' ');
        expect(said, 'the beat must not resolve into an answer')
            .not.toMatch(/\bhe accepted\b|\bhe declined\b|\bhe refused\b|\bhe took the post\b/i);
        // And the formal register is still empty, which is what makes the
        // informal one the only thing that ever happened.
        expect(p.whetherItWasEverOffered).toMatch(/[Nn]othing formal/);
        expect(p.whetherItWasEverOffered).toMatch(/would have to be answered/i);
    });

    it('leaves every part of that afternoon unresolved', () => {
        const o = THE_PRESENT_COUNT.theOneEligiblePerson.theInformalOffer;
        // Whether the stated reason is the reason.
        expect(o.whatHeSaidBack).toMatch(/not established here/i);
        expect(o.whatHeSaidBack).toMatch(/rather not have the conversation/i);
        // Whether he understood it as an offer at all.
        expect(o.whetherHeHeardItAsAnOffer).toMatch(/^Open/);
        expect(o.whetherHeHeardItAsAnOffer).toMatch(/He may have heard/);
        // Whether the Court considers the matter closed.
        expect(o.nobodyHasRaisedItSince).toMatch(/tact/i);
        expect(o.nobodyHasRaisedItSince).toMatch(/not going to be settled/i);
        expect(o.nobodyHasRaisedItSince).toMatch(/cannot ask for it/i);
        // The line was carried without its occasion, which is the whole of what
        // the file says about how a deflection becomes a refusal.
        expect(o.onlyOneOfThemWasThere).toMatch(/not the deflection/i);
        expect(o.onlyOneOfThemWasThere).toMatch(/does not stay the same shape/i);
        // And it never left the house: one room to another, nothing further.
        expect(o.onlyOneOfThemWasThere).toMatch(/inside the same house/i);
        expect(o.andThisIsTheOnlyHouseWhereNoneOfItGetsOut).toMatch(/answers to nobody/i);
        // And none of it says anything about what he would do in a crisis.
        expect(JSON.stringify(THE_PRESENT_COUNT)).not.toMatch(/wouldDefend/);
    });

    it('carries the rumour as a rumour, with its provenance and no verification', () => {
        const p = THE_PRESENT_COUNT.theOneEligiblePerson;
        expect(p.theRumour).toMatch(/rumour that he declined/i);
        expect(p.theRumour).toMatch(/offhand remark/i);
        expect(p.theRumour).toMatch(/does not remember/i);
        // Presented with a rumour's confidence, and never resolved.
        expect(p.theRumour).toMatch(/might be true/i);
        expect(p.theRumour).toMatch(/[Nn]othing in this catalog says which/);
        expect(p.nobodyCanCheck).toMatch(/does not announce, deny, correct or brief/i);
        // The inconsistency it leaves is deliberate and stays visible.
        expect(p.nobodyCanCheck).toMatch(/not an inconsistency to be tidied/i);
        // It has a population of three and is not in the world at all, because
        // its premise is known to five people. See `whoKnows` in wanderers.ts:
        // a circulating rumour would contradict the character's own entry.
        expect(p.theRumour).toMatch(/population is three/i);
        expect(p.theRumour).toMatch(/not in the world/i);
        expect(p.theRumour, 'the rumour must not be given an outside audience')
            .not.toMatch(/circulates|Ninefold Ledger|in the world at large/i);
        // Three readings, none of them settled.
        expect(p.theRumour).toMatch(/One reads a refusal/);
        expect(p.theRumour).toMatch(/changing the subject/i);
        expect(p.theRumour).toMatch(/no question was ever actually put/i);
        expect(p.nobodyCanCheck).toMatch(/no procedure/i);
    });

    it('keeps him doing the substantive half of the office anyway', () => {
        const p = THE_PRESENT_COUNT.theOneEligiblePerson;
        expect(p.andHeDoesTheOtherHalfAnyway).toMatch(/dao lectures/i);
        expect(p.andHeDoesTheOtherHalfAnyway).toMatch(/no schedule/i);
        expect(p.andHeDoesTheOtherHalfAnyway).toMatch(/no obligation|under no obligation/i);
        expect(p.andHeDoesTheOtherHalfAnyway).toMatch(/wants no name for it/i);
        // And the Third Seat's sermon is still there, unexplained.
        expect(p.theThirdSeat).toMatch(/obligation/i);
        expect(p.theThirdSeat).toMatch(/insufferable/i);
    });

    it('gets the register right: fondness without belonging, and no self-pity', () => {
        const p = THE_PRESENT_COUNT.theOneEligiblePerson;
        expect(p.heUsedToBeOfThem).toMatch(/First Seat/);
        expect(p.heUsedToBeOfThem).toMatch(/does not appear to mind/i);
        expect(p.theRegister).toMatch(/not devoted and he is not bitter/i);
        expect(p.theRegister).toMatch(/shrugging|resigned/i);
        // The one ambiguity worth keeping.
        expect(p.theRegister).toMatch(/not resolved here|costs nothing to leave open/i);
    });

    it('leaves the defence question genuinely open, including to him', () => {
        const d = THE_PRESENT_COUNT.theDefenceQuestionStaysOpen;
        expect(d.whatIsTrue).toMatch(/nothing whatsoever compels him/i);
        expect(d.whatIsNotKnown).toMatch(/unknown to him/i);
        expect(d.itIsTheSameTraitProducingASecondUnknown).toMatch(/do not settle each other/i);
        expect(d.doNotResolveIt).toMatch(/No field anywhere records/i);
        expect(d.andItIsNotADeterrent).toMatch(/deters nobody/i);
        // The prohibition is enforced by there being no such field to find.
        const serialised = JSON.stringify(THE_PRESENT_COUNT);
        expect(serialised).not.toMatch(/wouldDefend/);
    });
});
