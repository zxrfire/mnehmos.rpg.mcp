/**
 * Design guards for the acquisition funnel.
 *
 * The single property these exist to protect: a player must never acquire
 * something and find out later. Every reason a manual can fail somebody has to
 * arrive in one response, each carrying its own attributable cause.
 */

import { describe, it, expect } from 'vitest';

import {
    assessAcquisition,
    bestAcquisition,
    canTransmit,
    derivationOption,
    findFromManual,
    type ManualLike,
    type Transmitter
} from '../../../src/engine/encounters/acquisition.js';
import { mayHoldAFit, assessFit, type Seeker } from '../../../src/engine/encounters/suitability.js';
import { daoOf } from '../../../src/engine/cultivation/dao.js';
import { ENCOUNTERS } from '../../../src/data/cultivation/encounters.js';
import { TECHNIQUES, classOf } from '../../../src/data/cultivation/techniques.js';
import type { Insight } from '../../../src/schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────

const FIRE_MANUAL: ManualLike = {
    id: 'molten',
    name: 'Molten Core Refinement Scripture',
    requiredOrdinal: 17,
    cap: 21,
    grade: 'earth',
    element: 'fire'
};

const fireSeeker: Seeker = {
    ordinal: 17,
    elements: ['fire'],
    rootGrade: 'single',
    insights: {}
};

const waterSeeker: Seeker = {
    ordinal: 17,
    elements: ['water'],
    rootGrade: 'single',
    insights: {}
};

function insight(subject: string, domain: Insight['domain'], degree: number): Insight {
    return { id: `${domain}-${subject}-${degree}`, domain, subject, degree, provenance: 'earned' } as Insight;
}

const FIRE_DAO = daoOf([insight('fire', 'element', 4), insight('heat', 'element', 2)]);
const NO_DAO = daoOf([]);

// ─────────────────────────────────────────────────────────────────────────
describe('E6 - one Find builder', () => {
    it('reads the fields that were authored so the axes could fire', () => {
        // `rootGrades` and `domain` were populated precisely so the root and
        // comprehension axes stop being dead. A builder that drops them puts
        // the catalog back to every miss reading as an element miss.
        const manual: ManualLike = {
            ...FIRE_MANUAL,
            rootGrades: ['mutated'],
            domain: 'void',
            domainDegree: 3
        };
        const find = findFromManual(manual);
        expect(find.kind).toBe('manual');
        expect(find.gradeOrdinal).toBe(17);
        expect(find.elements).toEqual(['fire']);
        expect(find.rootGrades).toEqual(['mutated']);
        expect(find.domain).toBe('void');
        expect(find.domainDegree).toBe(3);
    });

    it('builds the same Find for a catalog row and a derived manual', () => {
        // The whole point of one builder: the three acquisition paths cannot
        // disagree about what a manual demands. A derived book is not a catalog
        // row and must still go through the same door.
        const fromCatalog = findFromManual(FIRE_MANUAL);
        const asDerived = findFromManual({ ...FIRE_MANUAL, derivable: true, opening: null });
        expect(asDerived).toEqual(fromCatalog);
    });

    it('agrees with assessFit called directly - there is no second judgement', () => {
        expect(assessAcquisition({ manual: FIRE_MANUAL, seeker: waterSeeker, route: 'found' }).suitability)
            .toEqual(assessFit(findFromManual(FIRE_MANUAL), waterSeeker));
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('E4 - fit reported on every acquisition route', () => {
    it('a miss arrives as a complete sentence, immediately, on every route', () => {
        // The emotional core of the loop, and the thing an interface most
        // easily gets wrong. Finding something excellent and useless TO YOU is
        // a real outcome and it must be said out loud on every path, not only
        // on an encounter find.
        for (const route of ['taught', 'found', 'volume', 'trial', 'corpse', 'grave', 'taken'] as const) {
            const report = assessAcquisition({ manual: FIRE_MANUAL, seeker: waterSeeker, route });
            expect(report.usable, route).toBe(false);
            expect(report.refusals, route).toContain('unsuited');
            expect(report.headline, route).toContain('it is sound');
            expect(report.headline, route).toContain('however long they sit');
        }
    });

    it('the miss is identical whatever route it came in by', () => {
        // A grave prize, a bought volume and a house's shelf must not disagree
        // about whether a book suits somebody.
        const viaGrave = assessAcquisition({ manual: FIRE_MANUAL, seeker: waterSeeker, route: 'grave' });
        const viaShelf = assessAcquisition({ manual: FIRE_MANUAL, seeker: waterSeeker, route: 'taught' });
        expect(viaGrave.suitability).toEqual(viaShelf.suitability);
        expect(viaGrave.techniqueCap).toBe(viaShelf.techniqueCap);
    });

    it('never collapses "not for you" into "too strong for you yet"', () => {
        // The two verdicts must never merge. "Too strong yet" is a schedule;
        // "sound, and not for you" is the game.
        const unsuited = assessAcquisition({ manual: FIRE_MANUAL, seeker: waterSeeker, route: 'found' });
        const outOfReach = assessAcquisition({
            manual: { ...FIRE_MANUAL, requiredOrdinal: 40 },
            seeker: { ...fireSeeker, ordinal: 2 },
            route: 'found'
        });
        expect(unsuited.refusals).toContain('unsuited');
        expect(unsuited.refusals).not.toContain('out_of_reach');
        expect(outOfReach.refusals).toContain('out_of_reach');
        expect(outOfReach.refusals).not.toContain('unsuited');
    });

    it('reports every reason at once rather than one at a time', () => {
        // A book that is unsuited AND already exhausted AND gated must say all
        // three. Discovering the second reason after acting on the first is the
        // failure this funnel exists to prevent.
        const report = assessAcquisition({
            manual: { ...FIRE_MANUAL, cap: 17 },
            seeker: waterSeeker,
            route: 'found',
            dao: NO_DAO
        });
        expect(report.refusals).toContain('unsuited');
        expect(report.refusals).toContain('already_past_its_cap');
        expect(report.lines.length).toBeGreaterThanOrEqual(2);
    });

    it('an unevaluated standing gate is reported as unevaluated, never as a pass', () => {
        const report = assessAcquisition({ manual: FIRE_MANUAL, seeker: fireSeeker, route: 'found' });
        expect(report.standing).toBeNull();
        expect(report.refusals).toContain('standing_not_assessed');
    });

    it('a suited, in-band, ungated manual is usable and says so plainly', () => {
        const report = assessAcquisition({
            manual: FIRE_MANUAL, seeker: fireSeeker, route: 'taught', dao: FIRE_DAO
        });
        expect(report.usable).toBe(true);
        expect(report.techniqueCap).toBe(21);
        expect(report.raisesTheCeiling).toBe(true);
        expect(report.headline).toContain('it fits this cultivator');
    });

    it('surfaces the ceiling BEFORE the decade, not after', () => {
        // "Never hide the cap." A player must be able to read that the book in
        // their hands ends at a named rank before committing years to it.
        const report = assessAcquisition({
            manual: { ...FIRE_MANUAL, cap: 21 }, seeker: { ...fireSeeker, ordinal: 21 }, route: 'found'
        });
        expect(report.raisesTheCeiling).toBe(false);
        expect(report.lines.join(' ')).toContain('it is not slower there, it is stopped');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('route 1b through the funnel - a partial set is honestly reported', () => {
    const scattered: ManualLike = {
        id: 'heaven-conversing', name: 'Heaven-Conversing Primordial Canon',
        requiredOrdinal: 37, cap: 41, grade: 'chaos', element: null,
        volumes: ['a', 'b', 'c']
    };
    const seeker: Seeker = { ordinal: 37, elements: ['fire'], rootGrade: 'single', insights: {} };

    it('holding one volume of three lowers the ceiling and says by how much', () => {
        const report = assessAcquisition({
            manual: scattered, seeker, route: 'volume', heldVolumeIds: ['a']
        });
        expect(report.techniqueCap).toBe(39);
        expect(report.lines.join(' ')).toContain('Finding another volume raises it');
    });

    it('holding none of them is a refusal, not a quiet zero', () => {
        const report = assessAcquisition({ manual: scattered, seeker, route: 'volume', heldVolumeIds: [] });
        expect(report.refusals).toContain('no_volumes_in_hand');
        expect(report.usable).toBe(false);
    });

    it('the bitter outcome is stated: three quarters of a book you cannot read', () => {
        // "You now own three quarters of a thing you cannot read - which is a
        // legitimate and quite bitter outcome, and the interface must say so
        // plainly." Both facts, in one response.
        const report = assessAcquisition({
            manual: { ...scattered, element: 'ice' },
            seeker,
            route: 'volume',
            heldVolumeIds: ['a', 'b']
        });
        expect(report.refusals).toContain('unsuited');
        expect(report.lines.join(' ')).toContain('however long they sit');
        expect(report.lines.join(' ')).toContain('rung of ceiling');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('bestAcquisition - the honest read on a haul', () => {
    it('returns null for an empty haul, which is a real result', () => {
        expect(bestAcquisition([], { seeker: fireSeeker, route: 'grave' })).toBeNull();
    });

    it('never promotes an unsuited book over a suited one for having a higher ceiling', () => {
        // The interface must not tell a player to sit with something that will
        // teach them nothing just because it is rated higher.
        const suitedButShort: ManualLike = {
            id: 'short', name: 'A Short Fire Manual', requiredOrdinal: 17, cap: 21,
            grade: 'earth', element: 'fire'
        };
        const magnificentAndWrong: ManualLike = {
            id: 'wrong', name: 'A Magnificent Ice Canon', requiredOrdinal: 17, cap: 33,
            grade: 'immortal', element: 'ice'
        };
        const best = bestAcquisition([magnificentAndWrong, suitedButShort], {
            seeker: fireSeeker, route: 'grave', dao: FIRE_DAO
        });
        expect(best?.suitability.fit).toBe('suited');
        expect(best?.techniqueCap).toBe(21);
    });

    it('an all-unsuited haul returns an unsuited best rather than flattering', () => {
        const best = bestAcquisition([FIRE_MANUAL], { seeker: waterSeeker, route: 'grave' });
        expect(best?.usable).toBe(false);
        expect(best?.suitability.fit).toBe('unsuited');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('E5 - mayHoldAFit reads the routes that were invisible to it', () => {
    it('a grave and a corpse hold a fit', () => {
        expect(mayHoldAFit(['grave'])).toBe(true);
        expect(mayHoldAFit(['corpse'])).toBe(true);
    });

    it('a living teacher is an access route too', () => {
        expect(mayHoldAFit(['transmission'])).toBe(true);
    });

    it('a market stall and a bandit still do not', () => {
        expect(mayHoldAFit(['trade', 'social'])).toBe(false);
        expect(mayHoldAFit(['hostile', 'beast'])).toBe(false);
    });

    it('the grave rows in the live catalog are now visible to it', () => {
        // Five rows carried `grave` and none of them were being read. If this
        // ever returns zero, either the tag was renamed or route 3 has gone
        // invisible again.
        const graves = ENCOUNTERS.filter(e => e.tags.includes('grave'));
        expect(graves.length).toBeGreaterThan(0);
        for (const row of graves) expect(mayHoldAFit(row.tags), row.id).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the living teacher', () => {
    const master: Transmitter = {
        id: 'elder-yun', name: 'Elder Yun', ordinal: 25, transmits: ['molten']
    };
    const student = { seeker: fireSeeker, dao: FIRE_DAO };

    it('a teacher who does not hold it cannot give it', () => {
        const check = canTransmit({ ...master, transmits: [] }, FIRE_MANUAL, student);
        expect(check.permitted).toBe(false);
        expect(check.reason).toBe('does_not_hold_it');
    });

    it('unwillingness is a social problem and is named as one', () => {
        const check = canTransmit({ ...master, willing: false }, FIRE_MANUAL, student);
        expect(check.reason).toBe('unwilling');
        expect(check.detail).toContain('no amount of cultivation answers it');
    });

    it('you cannot be shown further than the teacher went', () => {
        // The honest limit on this route, and why a house's best elder is not a
        // substitute for the house's library.
        const shallow: Transmitter = { ...master, ordinal: 19 };
        const check = canTransmit(shallow, FIRE_MANUAL, student);
        expect(check.permitted).toBe(true);
        expect(check.cap).toBe(19);
        expect(check.detail).toContain('the limit is the teacher, not the book');
    });

    it('a teacher at or below the student can hand over pages and show nothing', () => {
        const peer: Transmitter = { ...master, ordinal: 17 };
        const check = canTransmit(peer, FIRE_MANUAL, student);
        expect(check.permitted).toBe(false);
        expect(check.reason).toBe('went_no_further');
        expect(check.guidance).toBe(1);
        expect(check.detail).toContain('sends a student away');
    });

    it('reads the same suitability machinery as a shelf, and is not a discount', () => {
        // A beloved master handing over their life's work can still be handing
        // over something that will teach the student nothing.
        const check = canTransmit(master, FIRE_MANUAL, { seeker: waterSeeker, dao: FIRE_DAO });
        expect(check.permitted).toBe(true);
        expect(check.acquisition?.usable).toBe(false);
        expect(check.acquisition?.refusals).toContain('unsuited');
        expect(check.detail).toContain('however long they sit');
    });

    it('is an access route AND a rate term, and reports both', () => {
        const check = canTransmit(master, FIRE_MANUAL, student);
        expect(check.permitted).toBe(true);
        expect(check.cap).toBe(21);
        expect(check.guidance).toBeGreaterThan(1);
        expect(check.acquisition?.route).toBe('transmitted');
    });

    it('a teacher with a partial set transmits a partial set', () => {
        // The same `shardPower` arithmetic, through a person. A master with two
        // thirds of a canon teaches two thirds of a canon.
        const scattered: ManualLike = {
            id: 'canon', name: 'A Scattered Canon', requiredOrdinal: 17, cap: 21,
            grade: 'chaos', element: 'fire', volumes: ['a', 'b', 'c']
        };
        const partial: Transmitter = {
            id: 'm', name: 'A Master', ordinal: 30, transmits: ['canon'], volumesHeld: ['a', 'b']
        };
        expect(canTransmit(partial, scattered, student).cap).toBe(20);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('derivation offered through the same funnel', () => {
    it('is refused for the right reason and in the right vocabulary', () => {
        expect(derivationOption(NO_DAO, FIRE_MANUAL).reason).toBe('not_derivable');
        const derivable = { ...FIRE_MANUAL, derivable: true };
        expect(derivationOption(NO_DAO, derivable).reason).toBe('no_matching_dao');
        expect(derivationOption(FIRE_DAO, derivable).permitted).toBe(true);
    });

    it('is available to somebody with no resources at all', () => {
        // The point of route 7: this is the one door money cannot open, and the
        // corollary is that being penniless does not close it.
        const derivable = TECHNIQUES.find(t => t.derivable && classOf(t) === 'cultivation');
        expect(derivable).toBeDefined();
        const check = derivationOption(
            daoOf([insight('water', 'element', 4), insight('tides', 'element', 2)]),
            {
                id: derivable!.id, name: derivable!.name,
                requiredOrdinal: derivable!.requiredOrdinal, cap: derivable!.cap,
                grade: derivable!.grade, element: derivable!.element,
                subject: derivable!.element, category: derivable!.category,
                derivable: derivable!.derivable
            }
        );
        // Either it opens or it refuses on the ROAD - never on resources,
        // rank, standing in a house, or anything that can be bought.
        expect(['wrong_dao', null]).toContain(check.reason);
    });
});
