/**
 * Validation for the consumables that came down from above.
 *
 * The assertions that matter here are the ones that keep the design honest
 * rather than the ones that keep the data tidy:
 *
 *   - no price, anywhere, in any form
 *   - the world counts are tiny, exact, and equal to the sum of the holdings
 *   - the two effects are declared as engine gaps rather than implemented in
 *     the catalog, and neither is expressible by the existing PillEffect set
 *   - exactly one holder can be persuaded; the other two are arithmetic
 *   - a good case was refused, on the record, and it cost the refuser anyway
 */

import { describe, it, expect } from 'vitest';

import { PillEffectSchema } from '../../src/schema/cultivation.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import { getApexInstitution } from '../../src/data/cultivation/hierarchy.js';
import { PILLS } from '../../src/data/cultivation/pills.js';
import { PRICES } from '../../src/data/cultivation/mortal-world.js';
import {
    IMMORTAL_ITEMS,
    ImmortalItemSchema,
    IMMORTAL_HOLDINGS,
    HoldingSchema,
    worldCountByGrade,
    totalHeldBy,
    gradeCeilingOf,
    RecordedRefusalSchema,
    ENGINE_GAPS,
    getImmortalItem,
    getHoldingsOf,
    getHoldersOf,
    worldCountOf,
    persuadableHolders,
    recordedRefusals,
    getEngineGap,
    THE_LAST_REALM_IS_UNBUYABLE,
    THE_STEP_AND_THE_BOUNDARY,
    ONCE_IN_A_LIFE,
    THE_TWO_CLAIMS,
    WHAT_SERVICE_ACTUALLY_BUYS
} from '../../src/data/cultivation/immortal-items.js';
import { rankName, realmForOrdinal, isRealmBoundary } from '../../src/engine/cultivation/realms.js';
import { MAX_RANKS_PER_TURN } from '../../src/schema/cultivation.js';
import { getSectAdmission } from '../../src/data/cultivation/sects.js';
import { AZURE_CLOUD_INTAKE } from '../../src/data/cultivation/hierarchy.js';
import { FACTION_CHARACTER } from '../../src/data/cultivation/faction-character.js';

describe('items from above', () => {
    it('parses, and there are almost none of them', () => {
        expect(IMMORTAL_ITEMS.length).toBeLessThanOrEqual(3);
        for (const item of IMMORTAL_ITEMS) {
            expect(() => ImmortalItemSchema.parse(item), item.id).not.toThrow();
            expect(item.id.startsWith('immortal-'), `${item.id} needs the immortal- prefix`).toBe(true);
            // Tiny and explicit, never "a few".
            expect(item.knownCount).toBeGreaterThan(0);
            expect(item.knownCount).toBeLessThanOrEqual(20);
            expect(item.everKnown, `${item.id} cannot have fewer ever than exist now`)
                .toBeGreaterThanOrEqual(item.knownCount);
        }
        expect(new Set(IMMORTAL_ITEMS.map(i => i.id)).size).toBe(IMMORTAL_ITEMS.length);
    });

    it('has no price, in stones or otherwise', () => {
        // The economy does not reach these, and a number would imply it did.
        for (const item of IMMORTAL_ITEMS) {
            const record = item as unknown as Record<string, unknown>;
            for (const field of ['value', 'price', 'cash', 'stones', 'cost']) {
                expect(record[field], `${item.id} carries a ${field}`).toBeUndefined();
            }
            expect(item.notForSale.length).toBeGreaterThan(120);
        }
        // And nothing in the purchasable catalogs refers to them.
        for (const price of PRICES) {
            expect(price.id.includes('immortal'), `${price.id} prices an immortal item`).toBe(false);
        }
        for (const pill of PILLS) {
            expect(pill.id.startsWith('immortal-'), `${pill.id} is in the buyable pill catalog`).toBe(false);
        }
    });

    it('states a provenance that admits no alternative, and a shrinking supply', () => {
        for (const item of IMMORTAL_ITEMS) {
            expect(item.provenance).toMatch(/came down/i);
            expect(item.cannotBeMade.length).toBeGreaterThan(150);
            // Somebody has tried, or it is stated that there is nothing to try.
            expect(item.cannotBeMade).toMatch(/tried|attempt|no theory|would not know/i);
            // Ruins are the rarest case and never a supply.
            expect(item.ruinAvailability).toMatch(/grave|rarest|never|no cache|forger/i);
            expect(item.ruinAvailability).toMatch(/supply|cache/i);
        }
    });

    it('writes the root-change like something that should not exist', () => {
        const dealing = IMMORTAL_ITEMS.find(i => i.effect === 'change_spirit_root')!;
        expect(dealing, 'the world-historic exception is missing').toBeDefined();
        // Rarer than the pill, by construction.
        const step = IMMORTAL_ITEMS.find(i => i.effect === 'promote_realm')!;
        expect(dealing.knownCount).toBeLessThan(step.knownCount);
        // The world-historic object is the HIGHER grade, and there is one.
        expect(dealing.knownByGrade.higher).toBe(1);
        expect(dealing.grades.higher).toMatch(/should not exist|exactly one/i);
        // It states the rule it breaks rather than quietly breaking it.
        expect(`${dealing.effectNote} ${dealing.description}`)
            .toMatch(/dealt once|permanent|impossible|should not/i);
    });
});

describe('who holds them', () => {
    it('every holding resolves to a real faction and a real item', () => {
        for (const h of IMMORTAL_HOLDINGS) {
            expect(() => HoldingSchema.parse(h), `${h.factionId}/${h.itemId}`).not.toThrow();
            const holder = getSect(h.factionId) ?? getApexInstitution(h.factionId);
            expect(holder, `holding by unknown faction ${h.factionId}`).toBeDefined();
            expect(getImmortalItem(h.itemId), `holding of unknown item ${h.itemId}`).toBeDefined();
            expect(h.count).toBeGreaterThan(0);
            expect(h.count).toBeLessThanOrEqual(9);
        }
        // Three holders in the whole world, and no more.
        const holders = new Set(IMMORTAL_HOLDINGS.map(h => h.factionId));
        expect(holders.size).toBe(3);
        expect(holders.has('sect-azure-cloud-pavilion')).toBe(true);
        // The other two are the administrators of the world, not sects.
        expect(holders.has('apex-deep-survey')).toBe(true);
        expect(holders.has('apex-long-cut')).toBe(true);
        // Nobody else holds anything.
        for (const sect of SECTS) {
            if (holders.has(sect.id)) continue;
            expect(getHoldingsOf(sect.id), `${sect.id} should hold nothing`).toEqual([]);
        }
    });

    it('makes the world count the sum of the holdings, exactly', () => {
        for (const item of IMMORTAL_ITEMS) {
            expect(worldCountOf(item.id), `${item.id} count disagrees with its holders`)
                .toBe(item.knownCount);
            expect(getHoldersOf(item.id).length).toBeGreaterThan(0);
        }
    });

    it('names the count rather than describing it as small', () => {
        for (const h of IMMORTAL_HOLDINGS) {
            expect(h.countIsKnownTo.length, `${h.factionId} hides its own count`).toBeGreaterThan(60);
            // The people who hold them know the number.
            expect(h.countIsKnownTo).toMatch(/know|number|it is (one|two|three|four)|plainly/i);
        }
    });

    it('gives exactly one holder somebody who can be convinced', () => {
        const persuadable = persuadableHolders();
        // One faction, both its holdings: exactly one door in the world opens
        // on persuasion, and everything behind it is lower grade.
        expect(new Set(persuadable.map(h => h.factionId)).size,
            'there should be one door that opens on persuasion').toBe(1);
        expect(persuadable[0].factionId).toBe('sect-azure-cloud-pavilion');
        expect(persuadable.every(h => !h.anyoneMayRefuse)).toBe(true);
        expect(persuadable.every(h => h.byGrade.higher === 0)).toBe(true);
        // Instructions exist, so an office can act on them.
        expect(persuadable[0].decidedBy).toMatch(/Pavilion Master/i);
        expect(persuadable[0].sufficientReason.length).toBeGreaterThan(120);
        // And saying yes costs them something internally.
        expect(persuadable[0].costOfSayingYes).toMatch(/one of three|named|doctrine|petition/i);
    });

    it('makes the other holders arithmetic, with nobody able to release one', () => {
        const collective = IMMORTAL_HOLDINGS.filter(h => h.releaseMode === 'collective_consent');
        expect(collective.length).toBeGreaterThanOrEqual(3);
        for (const h of collective) {
            // A body, not an office, and any member ends it.
            expect(h.anyoneMayRefuse, `${h.factionId} has a single decider`).toBe(true);
            expect(h.decidedBy.length).toBeGreaterThan(80);
            expect(h.decidedBy, `${h.factionId} names an office rather than a body`)
                .toMatch(/all four|unanimous|body|together|Keepers/i);
            // Saving the institution is not a transaction.
            expect(h.savingTheSect, `${h.factionId} should say what saving it does`).not.toBeNull();
            expect(h.savingTheSect!).toMatch(/does not buy|not a transaction|indefensible|acknowledg|category error|receipt/i);
        }
        // The Hollow Court has no patriarch to appeal over.
        // Rank does not help: a Surveyor asking is one voice among four.
        const survey = collective.find(h => h.factionId === 'apex-deep-survey')!;
        expect(survey.decidedBy).toMatch(/no office above|one voice/i);
        // And the bureaucracies have a form, which has been submitted.
        for (const h of collective) {
            expect(h.theForm, `${h.factionId} has no instrument`).not.toBeNull();
            expect(h.theForm!.length).toBeGreaterThan(120);
        }
        expect(collective.some(h => /submitted/i.test(h.theForm!))).toBe(true);
    });

    it('records a good case that was refused, and what refusing cost', () => {
        const refusals = recordedRefusals();
        expect(refusals.length, 'nobody has ever been told no on the record')
            .toBeGreaterThanOrEqual(2);
        for (const { holding, refusal } of refusals) {
            expect(() => RecordedRefusalSchema.parse(refusal), holding.factionId).not.toThrow();
            expect(refusal.yearsAgo).toBeGreaterThan(0);
            // The case was genuinely good.
            expect(refusal.theCase.length).toBeGreaterThan(120);
            // A named refuser, and the reason given at the time.
            expect(refusal.refusedBy.length).toBeGreaterThan(60);
            // The sect was probably right, said without softening.
            expect(refusal.probablyRight).toMatch(/right|correct/i);
            // And it cost them anyway, which is the point of recording it.
            expect(refusal.costAnyway.length).toBeGreaterThan(80);
        }
        // Only collective holders refuse on the record; the Pavilion decides.
        for (const { holding } of refusals) {
            expect(holding.releaseMode).toBe('collective_consent');
        }
    });
});

describe('engine gaps', () => {
    it('declares both effects as gaps rather than inventing a mechanic', () => {
        const effects = new Set(IMMORTAL_ITEMS.map(i => i.effect));
        for (const effect of effects) {
            const gap = getEngineGap(effect);
            expect(gap, `${effect} is not declared as a gap`).toBeDefined();
            expect(gap!.missing.length).toBeGreaterThan(100);
            expect(gap!.blockedBy.length).toBeGreaterThan(80);
            expect(gap!.note.length).toBeGreaterThan(80);
        }
        expect(ENGINE_GAPS.length).toBe(effects.size);
    });

    it('confirms neither effect is expressible by the current PillEffect set', () => {
        const pillEffects = PillEffectSchema.options as readonly string[];
        for (const item of IMMORTAL_ITEMS) {
            expect(pillEffects.includes(item.effect),
                `${item.effect} is now a PillEffect - the gap note needs updating`).toBe(false);
        }
        // The nearest existing effect is named, so the difference is on record.
        expect(getEngineGap('promote_realm')!.missing).toMatch(/advance_progress/);
        // And the permanence rule the root change breaks is cited, not implied.
        expect(getEngineGap('change_spirit_root')!.missing).toMatch(/spiritRoot|permanent|never editable/i);
    });

    it('leaves the root change deliberately unresolvable', () => {
        const gap = getEngineGap('change_spirit_root')!;
        expect(gap.note).toMatch(/deliberately|should not be the place|ceremony/i);
        expect(gap.blockedBy).toMatch(/cultivation rate|deviation|derived|recalculation/i);
    });
});

describe('what happens afterwards', () => {
    it('says what the world does about a visible use', () => {
        for (const item of IMMORTAL_ITEMS) {
            expect(item.socialConsequence.length, `${item.id} social consequence`).toBeGreaterThan(200);
            // Named institutions react, rather than "people talk".
            expect(item.socialConsequence).toMatch(/Ledger|Held Names|Narrow Hour|Quiet Cut|Frostmirror|Storm Tyrant/);
        }
        const step = IMMORTAL_ITEMS.find(i => i.effect === 'promote_realm')!;
        // A jumped realm is arithmetic anybody can do.
        expect(step.socialConsequence).toMatch(/arithmetic|accumulation was not there|audit/i);
        // And the recipient is not admired for it.
        expect(step.socialConsequence).toMatch(/not admired|could not be given/i);

        const dealing = IMMORTAL_ITEMS.find(i => i.effect === 'change_spirit_root')!;
        // The register is the loudest signal in the world for this.
        expect(dealing.socialConsequence).toMatch(/register/i);
        // And the two sects with an intake problem are the danger.
        expect(dealing.socialConsequence).toMatch(/Frostmirror/);
        expect(dealing.socialConsequence).toMatch(/Storm Tyrant/);
    });
});

describe('three grades, and the comparison they make', () => {
    it('grades every item and every holding, consistently', () => {
        for (const item of IMMORTAL_ITEMS) {
            for (const grade of ['higher', 'middle', 'lower'] as const) {
                expect(item.grades[grade].length, `${item.id} ${grade}`).toBeGreaterThan(120);
            }
            // The world counts by grade sum to the headline count.
            const sum = item.knownByGrade.higher + item.knownByGrade.middle + item.knownByGrade.lower;
            expect(sum, `${item.id} grade counts disagree with knownCount`).toBe(item.knownCount);
            // And they agree with what the holders actually hold.
            expect(worldCountByGrade(item.id)).toEqual(item.knownByGrade);
        }
        for (const h of IMMORTAL_HOLDINGS) {
            const sum = h.byGrade.higher + h.byGrade.middle + h.byGrade.lower;
            expect(sum, `${h.factionId}/${h.itemId} grades disagree with count`).toBe(h.count);
        }
    });

    it('keeps the higher grade almost nonexistent', () => {
        const higher = IMMORTAL_ITEMS.reduce((n, i) => n + i.knownByGrade.higher, 0);
        expect(higher, 'the top of the range must stay vanishing').toBeLessThanOrEqual(2);
        // One each to the two ancient channels, and none to the fresh one.
        expect(gradeCeilingOf('apex-deep-survey')).toBe('higher');
        expect(gradeCeilingOf('apex-long-cut')).toBe('higher');
        expect(gradeCeilingOf('sect-azure-cloud-pavilion')).toBe('lower');
    });

    it('inverts the table: the Pavilion is deepest and worst', () => {
        const pavilion = totalHeldBy('sect-azure-cloud-pavilion');
        const survey = totalHeldBy('apex-deep-survey');
        const longCut = totalHeldBy('apex-long-cut');
        // Most in total, by a distance.
        expect(pavilion.total).toBeGreaterThan(survey.total + longCut.total - 2);
        expect(pavilion.total).toBeGreaterThan(survey.total);
        expect(pavilion.total).toBeGreaterThan(longCut.total);
        // And nothing above the bottom of the range.
        expect(pavilion.higher).toBe(0);
        expect(pavilion.middle).toBe(0);
        // While the apexes are thin and good.
        expect(survey.higher + longCut.higher).toBe(2);
        expect(survey.total).toBeLessThan(pavilion.total);
        expect(longCut.total).toBeLessThan(pavilion.total);
    });

    it('says why the Pavilion stock is all lower, and that it is rising', () => {
        const holdings = getHoldingsOf('sect-azure-cloud-pavilion');
        expect(holdings.length).toBe(2);
        const text = holdings.map(h => `${h.countIsKnownTo} ${h.costOfSayingYes}`).join(' ');
        expect(text).toMatch(/revised upward|income|again inside a decade/i);
    });
});


// ---------------------------------------------------------------------------
// THE BALANCE PASS
// One boundary, from the top, once in a life, and never into the last realm.
// ---------------------------------------------------------------------------

describe('the last realm is unbuyable', () => {
    it('states the absolute and matches the live ladder', () => {
        expect(THE_LAST_REALM_IS_UNBUYABLE.theAbsolute).toMatch(/ordinal 41 or above/i);
        expect(THE_LAST_REALM_IS_UNBUYABLE.theAbsolute).toMatch(/walked to or it is not reached/i);
        // The three ceilings are real realm boundaries on the real ladder.
        expect(rankName(24)).toBe('Nascent Soul Perfection');
        expect(rankName(25)).toBe('Deity Transformation Early');
        expect(rankName(28)).toBe('Deity Transformation Perfection');
        expect(rankName(29)).toBe('Void Refinement Early');
        expect(rankName(36)).toBe('Body Integration Perfection');
        expect(rankName(37)).toBe('Grand Ascension Early');
        // Each clean-case departure rung is a realm boundary: advancing from it
        // crosses into a new realm, which is exactly what the Step pays for.
        for (const departure of [24, 28, 36]) {
            expect(isRealmBoundary(departure), `${departure} is not a boundary`).toBe(true);
            expect(realmForOrdinal(departure).key).not.toBe(realmForOrdinal(departure + 1).key);
        }
        // And 41 is the realm nothing reaches.
        expect(realmForOrdinal(41).name).toBe('Tribulation Transcendence');
    });

    it('caps the destination realm rather than the distance travelled', () => {
        expect(THE_LAST_REALM_IS_UNBUYABLE.gradeCapsDestinationNotDistance)
            .toMatch(/same single crossing/i);
        expect(THE_LAST_REALM_IS_UNBUYABLE.gradeCapsDestinationNotDistance)
            .toMatch(/spent for nothing/i);
        const ceilings = THE_LAST_REALM_IS_UNBUYABLE.theCeilings.join(' ');
        expect(ceilings).toMatch(/lower.*Deity Transformation.*24 to 25/is);
        expect(ceilings).toMatch(/middle.*Void Refinement.*28 to 29/is);
        expect(ceilings).toMatch(/higher.*Grand Ascension.*36 to 37/is);
    });

    it('ties the rule to the admission bar and to bought inputs', () => {
        expect(THE_LAST_REALM_IS_UNBUYABLE.whyItStopsThere).toMatch(/Void Refinement floor/i);
        expect(THE_LAST_REALM_IS_UNBUYABLE.whyItStopsThere).toMatch(/origin\.md/);
        expect(THE_LAST_REALM_IS_UNBUYABLE.whyItStopsThere).toMatch(/privilege buys inputs and never rank/i);
        expect(THE_LAST_REALM_IS_UNBUYABLE.whatItProtects).toMatch(/they walked/i);
        expect(THE_LAST_REALM_IS_UNBUYABLE.theConsequenceForHolders).toMatch(/could not manufacture a peer/i);
    });
});

describe('the step and the boundary', () => {
    it('crosses one boundary into Early of the next realm', () => {
        expect(THE_STEP_AND_THE_BOUNDARY.theRule).toMatch(/exactly one realm boundary/i);
        expect(THE_STEP_AND_THE_BOUNDARY.theRule).toMatch(/Early of the next realm/i);
        expect(THE_STEP_AND_THE_BOUNDARY.perfectionIsTheCleanCase).toMatch(/ordinary foundation/i);
    });

    it('permits taking it early, and never calls that a waste', () => {
        expect(THE_STEP_AND_THE_BOUNDARY.takingItEarlyIsAvailable).toMatch(/not a waste/i);
        expect(THE_STEP_AND_THE_BOUNDARY.takingItEarlyIsAvailable).toMatch(/gave up is ceiling/i);
        expect(THE_STEP_AND_THE_BOUNDARY.whyPeopleDoIt.length).toBe(2);
        expect(THE_STEP_AND_THE_BOUNDARY.whyPeopleDoIt[0]).toMatch(/running out of life/i);
        expect(THE_STEP_AND_THE_BOUNDARY.whyPeopleDoIt[1]).toMatch(/do not care/i);
        expect(THE_STEP_AND_THE_BOUNDARY.whatItCosts).toMatch(/foundationQuality/);
        // The phrase that was cut must not come back anywhere in the file.
        const corpus = [
            THE_STEP_AND_THE_BOUNDARY.takingItEarlyIsAvailable,
            THE_STEP_AND_THE_BOUNDARY.whatItCosts,
            THE_STEP_AND_THE_BOUNDARY.theOrdinaryCase,
            ONCE_IN_A_LIFE.whyItMattersForTheStep
        ].join(' ');
        expect(corpus).not.toMatch(/wasted forever/i);
    });

    it('makes the disciplined case the rare one', () => {
        expect(THE_STEP_AND_THE_BOUNDARY.theOrdinaryCase).toMatch(/disciplined version.*rare/is);
        expect(THE_STEP_AND_THE_BOUNDARY.theOrdinaryCase).toMatch(/frightened person with a deadline/i);
        expect(THE_STEP_AND_THE_BOUNDARY.holdingSomebodyAtPerfection).toMatch(/luxury/i);
        expect(THE_STEP_AND_THE_BOUNDARY.theCompensationThatIsNotOne).toMatch(/pay in rank/i);
    });

    it('leaves a visible population who were carried rather than climbed', () => {
        expect(THE_STEP_AND_THE_BOUNDARY.thePopulation).toMatch(/permanently stalled/i);
        expect(THE_STEP_AND_THE_BOUNDARY.thePopulation).toMatch(/not uniformly shameful/i);
        expect(THE_STEP_AND_THE_BOUNDARY.thePopulation).toMatch(/never had a deadline/i);
    });
});

describe('once in a life', () => {
    it('applies to both objects and does not stack', () => {
        expect(ONCE_IN_A_LIFE.theRule).toMatch(/One Unearned Step per person, ever/i);
        expect(ONCE_IN_A_LIFE.theRule).toMatch(/One Second Dealing per person, ever/i);
        expect(ONCE_IN_A_LIFE.theRule).toMatch(/do not stack/i);
        expect(ONCE_IN_A_LIFE.whatItProtects).toMatch(/one rung and one root/i);
    });

    it('bites hardest on the grade that looked safest', () => {
        expect(ONCE_IN_A_LIFE.whyItBitesHardestOnTheLowerDealing).toMatch(/permanently bounded/i);
        expect(ONCE_IN_A_LIFE.whyItBitesHardestOnTheLowerDealing).toMatch(/three to a two/i);
        expect(ONCE_IN_A_LIFE.theHardestVersion).toMatch(/do nothing for them at all/i);
    });
});

describe('the two claims', () => {
    it('requires past service and future usefulness, and decides on the second', () => {
        expect(THE_TWO_CLAIMS.theTest).toMatch(/necessary and it is not sufficient/i);
        expect(THE_TWO_CLAIMS.theTest).toMatch(/continued living must be of use/i);
        expect(THE_TWO_CLAIMS.theQuestionIsForwardLooking).toMatch(/gratitude is not an answer/i);
        expect(THE_TWO_CLAIMS.theQuestionIsForwardLooking).toMatch(/does not move the object/i);
        // The framing that was cut.
        const corpus = Object.values(THE_TWO_CLAIMS)
            .map(v => typeof v === 'string' ? v : JSON.stringify(v))
            .join(' ');
        expect(corpus).not.toMatch(/payment on a debt/i);
    });

    it('lets the elders understand the calculation exactly', () => {
        expect(THE_TWO_CLAIMS.theEldersKnowThis).toMatch(/not deceived/i);
        expect(THE_TWO_CLAIMS.theEldersKnowThis).toMatch(/assessment is the correct one/i);
        expect(THE_TWO_CLAIMS.soMostOfThemDie).toMatch(/rare even among the deserving/i);
        expect(THE_TWO_CLAIMS.soMostOfThemDie).toMatch(/nobody opens the box/i);
    });

    it('makes both claims forward-looking and therefore comparable', () => {
        expect(THE_TWO_CLAIMS.bothClaimsAreForwardLooking).toMatch(/not debt against potential/i);
        expect(THE_TWO_CLAIMS.bothClaimsAreForwardLooking).toMatch(/old one is nearly always lower/i);
    });

    it('has one who was kept and one who was refused', () => {
        expect(THE_TWO_CLAIMS.theOneWhoWasKept.theReason).toMatch(/instrumental/i);
        expect(THE_TWO_CLAIMS.theOneWhoWasKept.sheKnowsIt).toMatch(/not honoured/i);
        expect(THE_TWO_CLAIMS.theOneWhoWasKept.sheKnowsIt).toMatch(/kept/i);
        expect(THE_TWO_CLAIMS.theOneWhoWasRefused.theReasoning).toMatch(/nothing further she could offer/i);
        // The grievance is agreement rather than injustice.
        expect(THE_TWO_CLAIMS.theOneWhoWasRefused.theGrievance).toMatch(/the Pavilion was right/i);
        expect(THE_TWO_CLAIMS.theOneWhoWasRefused.theGrievance).toMatch(/can only be agreed with/i);
        expect(THE_TWO_CLAIMS.theOnesWhoDoNotAsk).toMatch(/declined to raise it/i);
        expect(THE_TWO_CLAIMS.itKeysToUnitOfValue).toMatch(/faction-character/);
    });
});

describe('the engine contract', () => {
    it('states what promote_realm must do, and agrees with the turn cap', () => {
        const step = ENGINE_GAPS.find(g => g.effect === 'promote_realm')!;
        expect(step.contract.length).toBeGreaterThanOrEqual(5);
        const all = step.contract.join(' ');
        expect(all).toMatch(/exactly one realm boundary/i);
        expect(all).toMatch(/Once per cultivator for life/i);
        expect(all).toMatch(/foundationQuality/);
        expect(all).toMatch(/41 and above is unreachable/i);
        // One rank granted, one rank permitted per turn.
        expect(MAX_RANKS_PER_TURN).toBe(1);
        expect(step.blockedBy).toMatch(/agree rather than collide/i);
    });

    it('states the root transitions precisely enough to wire', () => {
        const root = ENGINE_GAPS.find(g => g.effect === 'change_spirit_root')!;
        const all = root.contract.join(' ');
        expect(all).toMatch(/never better than two/i);
        expect(all).toMatch(/never a single root/i);
        expect(all).toMatch(/luck at use time/i);
        expect(all).toMatch(/single mutated root/i);
        expect(all).toMatch(/Once per cultivator for life/i);
    });
});

describe('the Pavilion position after the buff', () => {
    it('holds seven lower Steps and cannot spend them for want of people', () => {
        const holding = IMMORTAL_HOLDINGS.find(
            h => h.factionId === 'sect-azure-cloud-pavilion' && h.itemId === 'immortal-unearned-step'
        )!;
        expect(holding.count).toBe(7);
        expect(holding.byGrade.lower).toBe(7);
        expect(AZURE_CLOUD_INTAKE.theOtherReason).toMatch(/seven lower Unearned Steps/i);
        expect(AZURE_CLOUD_INTAKE.theOtherReason).toMatch(/Nascent Soul Perfection/);
        expect(AZURE_CLOUD_INTAKE.theOtherReason).toMatch(/not medicine and never was\. It is people/i);
        expect(AZURE_CLOUD_INTAKE.theBottleneckIsPeople).toMatch(/only work on members it does not have/i);
        expect(AZURE_CLOUD_INTAKE.theBottleneckIsPeople).toMatch(/waiting/i);
    });

    it('keeps the world counts exactly where they were before the buff', () => {
        const step = getImmortalItem('immortal-unearned-step')!;
        expect(step.knownCount).toBe(13);
        expect(step.knownByGrade).toEqual({ higher: 1, middle: 3, lower: 9 });
        const dealing = getImmortalItem('immortal-second-dealing')!;
        expect(dealing.knownCount).toBe(4);
        expect(dealing.knownByGrade).toEqual({ higher: 1, middle: 1, lower: 2 });
        // And the admission bar the ceiling rule leans on is unchanged.
        expect(getSectAdmission('sect-hollow-court')!.minOrdinal).toBe(29);
    });
});


// ---------------------------------------------------------------------------
// WHAT SERVICE BUYS
// The correction that keeps the refusal from reading as ingratitude.
// ---------------------------------------------------------------------------

describe('what service actually buys', () => {
    it('separates rewarding service from spending an immortal medicine', () => {
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theyDoReward).toMatch(/pays enormously/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theyDoReward).toMatch(/genuinely honoured/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theLine).toMatch(/Replaceability/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theLine).toMatch(/can get more of/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theLine).toMatch(/outside the reward economy/i);
        // The claim it must never collapse into.
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theyDoReward).toMatch(/Read nothing in this file as sects being ungrateful/i);
    });

    it('lists what a sect can actually replace, including a vein cave', () => {
        expect(WHAT_SERVICE_ACTUALLY_BUYS.whatIsOnOffer.length).toBeGreaterThanOrEqual(6);
        const all = WHAT_SERVICE_ACTUALLY_BUYS.whatIsOnOffer.join(' ');
        expect(all).toMatch(/rank/i);
        expect(all).toMatch(/stipend/i);
        expect(all).toMatch(/technique access/i);
        expect(all).toMatch(/cave on a real vein/i);
        expect(all).toMatch(/protection/i);
        expect(all).toMatch(/opens doors/i);
    });

    it('makes generational security the largest reward on the list', () => {
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theFamily).toMatch(/generational security/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theFamily).toMatch(/taken in, kept, placed, educated, fed and not forgotten/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theFamily).toMatch(/whether or not any of them can cultivate/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theFamily).toMatch(/costs the sect a great deal/i);
    });

    it('makes it a real motive for somebody from a thin county', () => {
        expect(WHAT_SERVICE_ACTUALLY_BUYS.whyItIsTheRealMotivation).toMatch(/thin county/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.whyItIsTheRealMotivation).toMatch(/stop being poor/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.whyItIsTheRealMotivation).toMatch(/nothing to do with power/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.whyItIsTheRealMotivation).toMatch(/never see ordinal 20/i);
    });

    it('runs the same principle down to the poorest institution in the world', () => {
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theSameAtEveryScale).toMatch(/Gleaners/);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.theSameAtEveryScale).toMatch(/not being kind/i);
        // And the claim matches what the Gleaners entry actually says.
        const gleaners = FACTION_CHARACTER['sect-gleaners-company']!;
        expect(gleaners.unitOfValue).toMatch(/share goes to their family/i);
        expect(gleaners.unitOfValue).toMatch(/never once defaulted/i);
    });

    it('narrows the refusal to the one irreplaceable category', () => {
        expect(WHAT_SERVICE_ACTUALLY_BUYS.soTheRefusalIsNarrow).toMatch(/Nobody deserving is turned away with nothing/i);
        expect(WHAT_SERVICE_ACTUALLY_BUYS.soTheRefusalIsNarrow).toMatch(/harder thing to be angry about/i);
        expect(THE_TWO_CLAIMS.itIsNotThatServiceGoesUnrewarded).toMatch(/WHAT_SERVICE_ACTUALLY_BUYS/);
        expect(THE_TWO_CLAIMS.itIsNotThatServiceGoesUnrewarded).toMatch(/frequently do/i);
        expect(THE_TWO_CLAIMS.theEldersKnowThis).toMatch(/not bitter about a supply problem/i);
    });

    it('gives the refused elder everything except the one object', () => {
        const refused = THE_TWO_CLAIMS.theOneWhoWasRefused;
        expect(refused.whatSheWasGivenInstead).toMatch(/none of it grudgingly/i);
        expect(refused.whatSheWasGivenInstead).toMatch(/cave on the gorge vein/i);
        expect(refused.whatSheWasGivenInstead).toMatch(/four generations/i);
        expect(refused.whatSheWasGivenInstead).toMatch(/cannot cultivate at all still hold posts/i);
        expect(refused.whatSheWasGivenInstead).toMatch(/refused one object/i);
        // Her people know exactly what they were given, which is why it stings.
        expect(refused.theGrievance).toMatch(/still living on some of it/i);
        expect(refused.theGrievance).toMatch(/hands you everything it can/i);
        // And the declining is of real generosity, repeatedly.
        expect(refused.howLongItHasLasted).toMatch(/real generosity/i);
        expect(refused.howLongItHasLasted).toMatch(/good faith/i);
    });
});
