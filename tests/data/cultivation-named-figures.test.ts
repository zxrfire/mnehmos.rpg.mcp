/**
 * Validation for the named-but-not-instantiated population.
 *
 * The load-bearing assertions:
 *   - every faction can be checked for whether it can name its own ancestors,
 *     which is what makes `LOST_RECORDS` a set of facts rather than a rule
 *   - attestation spans its whole range, so a name is never simply known
 *   - the junior answers, everywhere, without exception
 *   - no immortal anywhere in the catalog is written as fallible
 *   - nothing here is instantiable, and nothing here is in `members.ts`
 */

import { describe, it, expect } from 'vitest';

import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import { getApexInstitution } from '../../src/data/cultivation/hierarchy.js';
import { MEMBERS } from '../../src/data/cultivation/members.js';
import { IMMORTAL_CHANNELS } from '../../src/data/cultivation/crossings.js';
import {
    NAMED_FIGURES,
    NamedFigureSchema,
    AttestationSchema,
    IMMORTAL_ANCESTORS,
    SEALED_FIGURE_NAMES,
    FOUNDERS,
    HISTORICAL_FIGURES,
    THE_JUNIOR_ANSWERS,
    THE_DECAY_OF_MEMORY,
    THE_WRONG_QUESTION,
    WHO_HINTS_AND_WHY,
    THE_THRESHING_HALL,
    HELD_QUESTIONS,
    ATTESTATION_IS_USABILITY,
    NAMED_FIGURE_ENGINE_GAP,
    getNamedFigure,
    figuresFor,
    figuresOfKind,
    nameIsUsable,
    whoAnswersFor
} from '../../src/data/cultivation/named-figures.js';

describe('the named figures', () => {
    it('parse, and are uniquely identified', () => {
        for (const f of NAMED_FIGURES) {
            expect(() => NamedFigureSchema.parse(f), `${f.id} fails the schema`).not.toThrow();
        }
        const ids = NAMED_FIGURES.map(f => f.id);
        expect(new Set(ids).size, 'duplicate figure id').toBe(ids.length);
        const names = NAMED_FIGURES.map(f => f.name);
        expect(new Set(names).size, 'two figures share a name').toBe(names.length);
    });

    it('attach to factions that exist, where they attach at all', () => {
        for (const f of NAMED_FIGURES) {
            if (!f.factionId) continue;
            const known = getSect(f.factionId) ?? getApexInstitution(f.factionId);
            expect(known, `${f.id} names unknown faction ${f.factionId}`).toBeDefined();
        }
    });

    it('give every faction in the catalog at least one name to hold', () => {
        for (const s of SECTS) {
            expect(figuresFor(s.id).length, `${s.id} holds no names at all`).toBeGreaterThan(0);
        }
    });

    it('resolve by id, and split into four kinds', () => {
        expect(getNamedFigure('figure-ru-anjing')).toBeDefined();
        expect(getNamedFigure('figure-does-not-exist')).toBeUndefined();
        expect(figuresOfKind('immortal_ancestor').length).toBe(IMMORTAL_ANCESTORS.length);
        expect(figuresOfKind('sealed').length).toBe(SEALED_FIGURE_NAMES.length);
        expect(figuresOfKind('founder').length).toBe(FOUNDERS.length);
        expect(figuresOfKind('historical').length).toBe(HISTORICAL_FIGURES.length);
    });
});

describe('attestation', () => {
    it('uses its whole range, so a name is never simply known', () => {
        const used = new Set(NAMED_FIGURES.map(f => f.attestation));
        for (const state of AttestationSchema.options) {
            expect(used.has(state), `nothing in the catalog is ${state}`).toBe(true);
        }
    });

    it('is not mostly secure, or the records material does no work', () => {
        const secure = NAMED_FIGURES.filter(f => f.attestation === 'secure').length;
        expect(secure / NAMED_FIGURES.length, 'too many names are simply correct').toBeLessThan(0.7);
    });

    it('distinguishes a name a faction can use from one it merely has', () => {
        expect(nameIsUsable(getNamedFigure('figure-ru-anjing')!)).toBe(true);
        // Held and unreadable: the Order owns the answer and cannot pronounce it.
        const stoneBearer = getNamedFigure('figure-the-stone-bearer')!;
        expect(stoneBearer.attestation).toBe('unreadable');
        expect(nameIsUsable(stoneBearer)).toBe(false);
        expect(stoneBearer.attestationNote).toMatch(/Standing hand/);
        // Withheld is a policy rather than a loss, so it stays usable.
        const first = getNamedFigure('figure-shen-yuandao')!;
        expect(first.attestation).toBe('withheld');
        expect(nameIsUsable(first)).toBe(true);
    });

    it('names the dangerous state and puts an institution in it', () => {
        expect(ATTESTATION_IS_USABILITY.theQuietOne).toMatch(/ceremonial/i);
        expect(ATTESTATION_IS_USABILITY.theQuietOne).toMatch(/indistinguishable from `secure`/);
        const mirror = getNamedFigure('figure-lian-suwen')!;
        expect(mirror.attestation).toBe('ceremonial');
        expect(mirror.factionId).toBe('sect-frostmirror-court');
        expect(mirror.attestationNote).toMatch(/four centuries after the sealing/i);
    });
});

describe('the junior answers', () => {
    it('holds for every faction with a line upward', () => {
        for (const channel of IMMORTAL_CHANNELS) {
            const answerer = whoAnswersFor(channel.factionId);
            expect(answerer, `${channel.factionId} has a channel and no named ancestor`).toBeDefined();
            expect(answerer!.juniority, `${channel.factionId} is answered by a senior`).toBe(1);
            expect(answerer!.answers).toBe('answers');
        }
    });

    it('makes the Hollow Court hear from the weakest of six', () => {
        const court = figuresFor('sect-hollow-court').filter(f => f.kind === 'immortal_ancestor');
        expect(court.length).toBeGreaterThanOrEqual(4);
        const answering = court.filter(f => f.answers === 'answers');
        expect(answering.length, 'exactly one voice comes down').toBe(1);
        expect(answering[0]!.name).toBe('Qiu Danzhi');
        expect(answering[0]!.juniority).toBe(1);
        // And she is the most recent to cross, which is the same fact.
        const youngest = court.reduce((a, b) => (a.yearsAgo ?? 0) < (b.yearsAgo ?? 0) ? a : b);
        expect(youngest.id).toBe(answering[0]!.id);
        // Juniority is a strict ordering, not a set of ties.
        const ranks = court.map(f => f.juniority);
        expect(new Set(ranks).size).toBe(court.length);
    });

    it('reads juniority as function rather than as a snub', () => {
        expect(THE_JUNIOR_ANSWERS.theRule).toMatch(/most junior member/i);
        expect(THE_JUNIOR_ANSWERS.itIsNotASnub).toMatch(/functioning institution/i);
        expect(THE_JUNIOR_ANSWERS.itExplainsTheGrades).toMatch(/one reason rather than two/i);
        expect(THE_JUNIOR_ANSWERS.aQuestionCanBeCarriedUpward).toMatch(/discretion/i);
        expect(THE_JUNIOR_ANSWERS.immortalGossip).toMatch(/not private/i);
    });

    it('never lets the transmission be at fault', () => {
        expect(THE_JUNIOR_ANSWERS.theAnswerIsExact).toMatch(/precise/i);
        expect(THE_JUNIOR_ANSWERS.theAnswerIsExact).toMatch(/rather than vagueness/i);
        expect(THE_JUNIOR_ANSWERS.relayingIsAccurate).toMatch(/never a failure of transmission/i);
        expect(THE_JUNIOR_ANSWERS.everyMismatchIsMortal).toMatch(/on the mortal side/i);
    });

    it('forbids writing an immortal as fallible, and obeys itself', () => {
        expect(THE_JUNIOR_ANSWERS.neverWriteThemAsFallible).toMatch(/sloppy, forgetful, confused or mistaken/i);
        expect(THE_JUNIOR_ANSWERS.neverWriteThemAsFallible).toMatch(/not to be spent casually/i);
        const corpus = IMMORTAL_ANCESTORS
            .map(f => `${f.whatTheyWere} ${f.manner ?? ''} ${f.note}`)
            .join(' ');
        expect(corpus).not.toMatch(/confused|mistaken|misremembered|garbled|sloppy|by accident/i);
    });
});

describe('the decay of memory', () => {
    it('makes helpfulness a function of vintage rather than of character', () => {
        expect(THE_DECAY_OF_MEMORY.theRule).toMatch(/less they price mortal constraints/i);
        expect(THE_DECAY_OF_MEMORY.theRule).toMatch(/from distance/i);
        expect(THE_DECAY_OF_MEMORY.whatFadesFirst).toMatch(/cannot see that context is needed/i);
        expect(THE_DECAY_OF_MEMORY.whatANewOneStillKnows).toMatch(/front-load/i);
        expect(THE_DECAY_OF_MEMORY.frontLoadingIsTheAntidote).toMatch(/correct accounting/i);
    });

    it('gives every immortal a vintage and a manner that follows from it', () => {
        for (const f of IMMORTAL_ANCESTORS) {
            expect(f.yearsAgo, `${f.id} has no vintage`).toBeGreaterThan(0);
            expect(f.manner, `${f.id} has no manner`).toBeTruthy();
        }
        // The youngest immortal in the world is the one who front-loads.
        const youngest = IMMORTAL_ANCESTORS.reduce((a, b) => (a.yearsAgo ?? 0) < (b.yearsAgo ?? 0) ? a : b);
        expect(youngest.id).toBe('figure-ru-anjing');
        expect(youngest.manner).toMatch(/front-load/i);
        expect(youngest.manner).toMatch(/no round trip|second exchange/i);
        // And the oldest voices carry no context at all.
        const survey = getNamedFigure('figure-tao-jingwei')!;
        expect(survey.yearsAgo).toBeGreaterThan(youngest.yearsAgo!);
        expect(survey.manner).toMatch(/nothing around it/i);
    });

    it('puts a clock on the Pavilion that nobody there can stop', () => {
        expect(THE_DECAY_OF_MEMORY.theClockOnAzureCloud).toMatch(/will get worse/i);
        expect(THE_DECAY_OF_MEMORY.theClockOnAzureCloud).toMatch(/window rather than a possession/i);
        expect(THE_DECAY_OF_MEMORY.somebodyHasWorkedThisOut).toMatch(/no version of the plan that works/i);
        expect(THE_DECAY_OF_MEMORY.theInversion).toMatch(/technically superior and practically worse/i);
    });
});

describe('the wrong question', () => {
    it('answers what was asked and never what was meant', () => {
        expect(THE_WRONG_QUESTION.theMechanism).toMatch(/do not answer the question you meant/i);
        expect(THE_WRONG_QUESTION.theMechanism).toMatch(/not at fault and the outcome is still a catastrophe/i);
        expect(THE_WRONG_QUESTION.whyTheyDoNotCorrectYou.length).toBeGreaterThanOrEqual(4);
        expect(THE_WRONG_QUESTION.theStakes).toMatch(/worse than wasting it/i);
        expect(THE_WRONG_QUESTION.thisIsTheAskingPrinciple).toMatch(/asking\.md/);
        expect(THE_WRONG_QUESTION.thisIsTheAskingPrinciple).toMatch(/narrower question/i);
    });

    it('ties who hints to vintage and tie rather than to kindness', () => {
        expect(WHO_HINTS_AND_WHY.theRule).toMatch(/neither is temperament/i);
        expect(WHO_HINTS_AND_WHY.theHollowCourtDoesNotHint).toMatch(/not cruel, not contemptuous/i);
        expect(WHO_HINTS_AND_WHY.anInstitutionGetsInstitutionalService).toMatch(/no help whatsoever/i);
        expect(WHO_HINTS_AND_WHY.ruAnjingDoes).toMatch(/living sister/i);
        expect(WHO_HINTS_AND_WHY.ruAnjingDoes).toMatch(/front-load/i);
        expect(WHO_HINTS_AND_WHY.theBitterIrony).toMatch(/worth more in practice/i);
        expect(WHO_HINTS_AND_WHY.theCourtsRealVulnerability).toMatch(/well-drafted sentence/i);
    });
});

describe('the Threshing Hall', () => {
    it('preserves guidance that is correct and was not what they needed', () => {
        expect(THE_THRESHING_HALL.theQuestionAsked).toMatch(/keep the hall/i);
        expect(THE_THRESHING_HALL.theAnswerWasCorrect).toMatch(/the answer was right/i);
        expect(THE_THRESHING_HALL.theAnswerWasCorrect).toMatch(/discharged the obligation perfectly/i);
        expect(THE_THRESHING_HALL.theQuestionWasWrong).toMatch(/They did not want the hall/i);
        expect(THE_THRESHING_HALL.theOutcome).toMatch(/never taken/i);
        expect(THE_THRESHING_HALL.andYetTheSectEnded).toMatch(/no massacre and no defeat/i);
    });

    it('has somebody who went back and reconstructed the wording', () => {
        const r = THE_THRESHING_HALL.theReconstruction;
        expect(getSect(r.by), 'the reconstructing body must exist').toBeDefined();
        expect(r.by).toBe('sect-lantern-hall');
        expect(r.what).toMatch(/exact wording/i);
        expect(r.what).toMatch(/paraphrased/i);
        expect(r.theDocument).toMatch(/no error in it anywhere/i);
        expect(r.howItWasReceived).toMatch(/published it anyway/i);
        expect(THE_THRESHING_HALL.theLesson).toMatch(/noun in your question/i);
    });
});

describe('questions held in reserve', () => {
    it('names real factions and gives each a different posture', () => {
        expect(HELD_QUESTIONS.length).toBeGreaterThanOrEqual(3);
        for (const q of HELD_QUESTIONS) {
            const known = getSect(q.factionId) ?? getApexInstitution(q.factionId);
            expect(known, `${q.factionId} is unknown`).toBeDefined();
            expect(q.whyItIsStillNotSent.length).toBeGreaterThan(120);
        }
        const postures = new Set(HELD_QUESTIONS.map(q => q.drafts === 0 ? 'never' : 'refining'));
        expect(postures.size, 'every apex is doing the same thing').toBeGreaterThan(1);
    });

    it('has one institution refining for centuries and one refusing to ask at all', () => {
        const survey = HELD_QUESTIONS.find(q => q.factionId === 'apex-deep-survey')!;
        expect(survey.heldForYears).toBeGreaterThanOrEqual(400);
        expect(survey.drafts).toBeGreaterThan(20);
        expect(survey.whyItIsStillNotSent).toMatch(/never taking the risk|clock resets/i);
        const cut = HELD_QUESTIONS.find(q => q.factionId === 'apex-long-cut')!;
        expect(cut.drafts).toBe(0);
        expect(cut.whyItIsStillNotSent).toMatch(/correct number of questions.*is zero/i);
        // Everybody who holds a question has read the reconstruction.
        const all = HELD_QUESTIONS.map(q => q.theCurrentWording + q.whyItIsStillNotSent).join(' ');
        expect(all).toMatch(/page six/i);
    });
});

describe('not instantiated', () => {
    it('keeps the named population out of the active roster', () => {
        const memberIds = new Set(MEMBERS.map(m => m.id));
        const memberNames = new Set(MEMBERS.map(m => m.name));
        for (const f of NAMED_FIGURES) {
            expect(memberIds.has(f.id), `${f.id} has leaked into members.ts`).toBe(false);
            expect(memberNames.has(f.name), `${f.name} is in both catalogs`).toBe(false);
        }
    });

    it('carries no realm, rank or location anywhere', () => {
        for (const f of NAMED_FIGURES) {
            const keys = Object.keys(f);
            expect(keys).not.toContain('realmOrdinal');
            expect(keys).not.toContain('rankIndex');
            expect(keys).not.toContain('rank');
            expect(keys).not.toContain('location');
        }
    });

    it('states the schema gap rather than forcing the lift', () => {
        expect(NAMED_FIGURE_ENGINE_GAP.theShape).toMatch(/no realm ordinal/i);
        expect(NAMED_FIGURE_ENGINE_GAP.whatTheEngineWouldNeed.length).toBeGreaterThanOrEqual(3);
        expect(NAMED_FIGURE_ENGINE_GAP.untilThen).toMatch(/nameIsUsable/);
    });
});
