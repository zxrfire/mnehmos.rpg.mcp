/**
 * Fit is assessed on every acquisition, including graves and transmission.
 * Encounter tags classify possible finds; they never gate acquisition assessment.
 *
 * Design guards for the acquisition funnel.
 *
 * Partial transmission was removed: live teaching passes a whole art through
 * couldWriteOutACopy. Its possession, mastery, root and interrupted-lesson
 * coverage lives in tests/web/a-cultivator-can-be-the-one-teaching.test.ts.
 *
 * The single property these exist to protect: a player must never acquire
 * something and find out later. Every reason a manual can fail somebody has to
 * arrive in one response, each carrying its own attributable cause.
 */

import { describe, it, expect } from 'vitest';

import {
    assessAcquisition,
    extensionOption,
    findFromManual,
    type ManualLike
} from '../../../src/engine/encounters/acquisition.js';
import { assessFit, mayHoldAFit, type Seeker } from '../../../src/engine/encounters/suitability.js';
import { ENCOUNTERS } from '../../../src/data/cultivation/encounters.js';
import { daoOf } from '../../../src/engine/cultivation/dao.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import type { Insight, InsightDegree } from '../../../src/schema/cultivation.js';

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

function insight(subject: string, domain: Insight['domain'], degree: InsightDegree): Insight {
    return {
        id: `${domain}-${subject}-${degree}`,
        domain,
        subject,
        degree,
        // PROVENANCE IS AN ACCOUNT, NOT A WORD. This held the string 'earned',
        // which is the shape the field had before an insight was required to
        // name the event that produced it.
        provenance: {
            achievementId: `achievement-${domain}-${subject}`,
            achievementKind: 'profound_principle',
            onDay: 1,
            deepenedBy: [],
            account: `Comprehended ${subject}.`
        }
    };
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
        const asDerived = findFromManual({ ...FIRE_MANUAL, notDerivableReason: null, opening: null });
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
        expect(report.refusals).toContain('ruined');
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
// ─────────────────────────────────────────────────────────────────────────
describe('derivation offered through the same funnel', () => {
    it('extension is available by DEFAULT - the allowlist was the wrong model', () => {
        // Inverted deliberately. Writing the next stage is something a
        // cultivator does to the book in front of them, not a property an
        // author blesses certain rows with. So an ordinary manual carrying no
        // stated objection is extendable, and the refusal a cultivator without
        // a road gets is about THEM rather than about the book.
        expect(extensionOption(NO_DAO, FIRE_MANUAL).reason).toBe('no_matching_dao');
        expect(extensionOption(FIRE_DAO, FIRE_MANUAL).permitted).toBe(true);
    });

    it('a manual with a stated reason it cannot be extended still refuses', () => {
        // The opt-OUT, and the half of the old model worth keeping: the
        // interesting refusals, where "you cannot write the next stage" is a
        // fact about the book rather than about the reader. Read verbatim.
        const sealed = {
            ...FIRE_MANUAL,
            notDerivableReason:
                'It is written for a condition the reader is not in and cannot simulate.'
        };
        const check = extensionOption(FIRE_DAO, sealed);
        expect(check.permitted).toBe(false);
        expect(check.reason).toBe('not_extendable');
        expect(check.detail).toContain('a condition the reader is not in');
    });

    it('is available to somebody with no resources at all', () => {
        // The point of route 7: this is the one door money cannot open, and the
        // corollary is that being penniless does not close it.
        const derivable = TECHNIQUES.find(t => t.derivable);
        expect(derivable).toBeDefined();
        const check = extensionOption(
            daoOf([insight('water', 'element', 4), insight('tides', 'element', 2)]),
            {
                id: derivable!.id, name: derivable!.name,
                requiredOrdinal: derivable!.requiredOrdinal, cap: derivable!.cap,
                grade: derivable!.grade, element: derivable!.element,
                subjects: derivable!.element === null ? null : [derivable!.element],
                category: derivable!.category,
                derivable: derivable!.derivable
            }
        );
        // Either it opens or it refuses on the ROAD - never on resources,
        // rank, standing in a house, or anything that can be bought.
        expect(['wrong_dao', null]).toContain(check.reason);
    });
});
