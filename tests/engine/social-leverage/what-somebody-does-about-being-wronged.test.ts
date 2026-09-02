/**
 * The wrongs a person can answer, and the four decisions in here that live only
 * as numbers.
 *
 * WHAT IS PINNED AND WHY
 * ----------------------
 *   THE ORDERING FALLS OUT      Robbery, maiming and murder are not three
 *                               numbers somebody chose. They are three answers
 *                               to who ends up holding the record and whether
 *                               it can ever be settled, and the ordering is a
 *                               consequence. If a future edit reintroduces a
 *                               hand-typed weight table, these break.
 *   `unforgivable` IS REACHABLE The severity vocabulary's top value was
 *                               unreachable from the deed table, which is the
 *                               tell that the table stopped short of what
 *                               people do to each other.
 *   THE MAIMING BAND IS         Nothing here restates a wound. `permanent` on
 *   `wounds.ts`                 the row is the whole of the distinction.
 *   WHAT A DETONATION REACHES   Five numbers, and the asymmetry between them is
 *                               the mechanic.
 */

import { describe, expect, it } from 'vitest';

import {
    howToWriteTheDeed,
    severityOfTheWrong,
    shapeOf,
    weighTheWrong,
    whatADetonationCosts,
    whatTheyDoAboutBeingWronged,
    whoEndsUpHoldingIt,
    type Wrong
} from '../../../src/engine/social-leverage/what-somebody-does-about-being-wronged.js';
import { SEVERITY_ORDER } from '../../../src/engine/social/grudges.js';
import { isPermanentWound } from '../../../src/data/cultivation/wounds.js';

const QI_CONDENSATION = 5;
const CORE_FORMATION = 18;
const VOID_REFINEMENT = 30;

function answer(over: Partial<Parameters<typeof whatTheyDoAboutBeingWronged>[0]> = {}) {
    return whatTheyDoAboutBeingWronged({
        wrong: 'robbed',
        landed: true,
        inPublic: false,
        theirOrdinal: CORE_FORMATION,
        yourOrdinal: CORE_FORMATION,
        alignment: 'neutral',
        theirName: 'Bai Rong',
        yourName: 'Shen Yue',
        ...over
    });
}

describe('the ordering comes from the shape, not from a number', () => {
    const weigh = (wrong: Wrong, woundKey?: string) =>
        weighTheWrong({ wrong, landed: true, inPublic: false, ...(woundKey ? { woundKey } : {}) });

    it('puts robbery above a threat and maiming above robbery', () => {
        expect(weigh('threatened')).toBeLessThan(weigh('robbed'));
        expect(weigh('robbed')).toBeLessThan(weigh('wounded', 'severed-meridian'));
    });

    it('puts murder at the top, and for a structural reason', () => {
        expect(weigh('killed')).toBeGreaterThan(weigh('wounded', 'severed-meridian'));
        // The reason, stated as the two facts rather than the figure.
        expect(shapeOf('killed').theySurviveToHoldIt).toBe(false);
        expect(shapeOf('killed').canBeGivenBack).toBe(false);
    });

    it('is worse to maim than to rob because fewer discharges remain', () => {
        expect(shapeOf('robbed').canBeGivenBack).toBe(true);
        expect(shapeOf('wounded', 'severed-meridian').canBeGivenBack).toBe(false);
        // And that is the field `whatItWasWorth` already had and no wrong set.
        expect(howToWriteTheDeed('wounded', 'severed-meridian').irreversible).toBe(true);
        expect(howToWriteTheDeed('robbed').irreversible).toBe(false);
    });

    it('leaves the four original weights exactly where they were', () => {
        // The coercion verbs are load-bearing for the live caller in game.ts.
        expect(weighTheWrong({ wrong: 'deceived', landed: false, inPublic: false })).toBe(1);
        expect(weighTheWrong({ wrong: 'interrogated', landed: false, inPublic: false })).toBe(1);
        expect(weighTheWrong({ wrong: 'threatened', landed: false, inPublic: false })).toBe(2);
        expect(weighTheWrong({ wrong: 'robbed', landed: false, inPublic: false })).toBe(3);
    });
});

describe('who ends up holding the record', () => {
    it('leaves it with the person for everything except a killing', () => {
        for (const wrong of ['threatened', 'robbed', 'deceived', 'interrogated', 'wounded', 'violated', 'interfered_with_a_crossing'] as Wrong[]) {
            expect(whoEndsUpHoldingIt(wrong)).toBe('the person it was done to');
        }
        expect(whoEndsUpHoldingIt('killed')).toBe('whoever was theirs');
    });

    it('hands the routing to the field what-a-deed-leaves already reads', () => {
        expect(howToWriteTheDeed('killed').principalCannotHoldIt).toBe(true);
        expect(howToWriteTheDeed('robbed').principalCannotHoldIt).toBe(false);
    });
});

describe('the severity vocabulary can reach its own top value', () => {
    it('writes a killing as unforgivable', () => {
        expect(severityOfTheWrong('killed')).toBe(SEVERITY_ORDER[SEVERITY_ORDER.length - 1]);
        expect(answer({ wrong: 'killed' }).grudge.severity).toBe('unforgivable');
    });

    it('writes the wrong at what was done, not at what the victim managed back', () => {
        // A farmer robbed by somebody far above can only say so. The record is
        // still a robbery.
        const helpless = answer({
            wrong: 'robbed',
            theirOrdinal: QI_CONDENSATION,
            yourOrdinal: VOID_REFINEMENT
        });
        expect(helpless.response).toBe('warned');
        expect(helpless.grudge.severity).toBe('serious');
    });

    it('puts grave bodily violation in the vocabulary at the maiming shape', () => {
        expect(severityOfTheWrong('violated')).toBe('grave');
        expect(shapeOf('violated').theySurviveToHoldIt).toBe(true);
        expect(shapeOf('violated').canBeGivenBack).toBe(false);
    });
});

describe('the maiming band is wounds.ts and is not restated here', () => {
    it('reads canBeGivenBack straight off the row permanent flag', () => {
        for (const key of ['torn-meridians', 'severed-meridian', 'cracked-core', 'scorched-channels']) {
            expect(shapeOf('wounded', key).canBeGivenBack).toBe(!isPermanentWound(key));
        }
    });

    it('treats a wound with no key as an ordinary one of its severity', () => {
        expect(shapeOf('wounded', null).canBeGivenBack).toBe(true);
        expect(shapeOf('wounded').canBeGivenBack).toBe(true);
    });

    it('makes a permanent wound outrank a closable one without a second table', () => {
        expect(severityOfTheWrong('wounded', 'cracked-core')).toBe('grave');
        expect(severityOfTheWrong('wounded', 'torn-meridians')).toBe('serious');
    });
});

describe('reaching into a crossing is grave and deniable', () => {
    it('weighs as heavily as a maiming and cannot be given back', () => {
        expect(severityOfTheWrong('interfered_with_a_crossing')).toBe('grave');
        expect(shapeOf('interfered_with_a_crossing').canBeGivenBack).toBe(false);
    });

    it('caps somebody who only suspects, and writes the record on a belief', () => {
        const unsure = answer({
            wrong: 'interfered_with_a_crossing',
            certain: false,
            theirOrdinal: VOID_REFINEMENT,
            yourOrdinal: QI_CONDENSATION
        });
        expect(unsure.response).toBe('warned');
        expect(unsure.grudge.fromBelief).toBe(true);
        // Held hard, though. A belief is not a discount.
        expect(unsure.grudge.severity).toBe('grave');
    });

    it('is the only wrong deniability applies to, and defaults to certain', () => {
        expect(shapeOf('robbed').theyMayNeverBeCertain).toBe(false);
        expect(answer({ wrong: 'interfered_with_a_crossing' }).grudge.fromBelief).toBe(false);
    });
});

describe('spending themselves, which is the answer that reaches upward', () => {
    const farBelow = {
        wrong: 'violated' as Wrong,
        theirOrdinal: CORE_FORMATION,
        yourOrdinal: VOID_REFINEMENT
    };

    it('is available where nothing else was, and not where something was', () => {
        expect(answer(farBelow).spentThemselves).toBe(true);
        // Level with them, they can answer it in the body and do.
        expect(answer({ ...farBelow, theirOrdinal: VOID_REFINEMENT }).spentThemselves).toBe(false);
    });

    it('is not available for a wrong that can be settled', () => {
        expect(answer({
            wrong: 'robbed',
            theirOrdinal: QI_CONDENSATION,
            yourOrdinal: VOID_REFINEMENT
        }).spentThemselves).toBe(false);
    });

    it('is not available to somebody who is dead', () => {
        expect(answer({
            wrong: 'killed',
            theirOrdinal: QI_CONDENSATION,
            yourOrdinal: VOID_REFINEMENT
        }).spentThemselves).toBe(false);
    });

    it('scales on the detonator own rung, which is the whole mechanic', () => {
        expect(whatADetonationCosts(0)).toBe(1);
        expect(whatADetonationCosts(1)).toBe(0.6);
        expect(whatADetonationCosts(2)).toBe(0.3);
        expect(whatADetonationCosts(3)).toBe(0.12);
        expect(whatADetonationCosts(5)).toBe(0.05);
        // Core Formation against Void Refinement is three realms: a real bite.
        expect(answer(farBelow).hpFraction).toBe(0.12);
        // Qi Condensation against the same person is five: a scene.
        expect(answer({ ...farBelow, theirOrdinal: QI_CONDENSATION }).hpFraction).toBe(0.05);
    });

    it('travels because it is extraordinary, and is not written as admirable', () => {
        const spent = answer(farBelow);
        expect(spent.howFarItTravels).toBeGreaterThan(answer({ wrong: 'robbed' }).howFarItTravels);
        expect(spent.line).toContain('There is nothing left of them');
        expect(spent.line).not.toMatch(/brave|noble|heroic|justice/i);
    });
});
