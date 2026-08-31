/**
 * Validation for sealed ancestors, the asymmetry law they all follow, and the worked
 * contingency that falls out of two unrelated catalog entries.
 *
 * The load-bearing assertions:
 *   - the law is stated once and the entries conclude from it rather than
 *     re-arguing it
 *   - every held sealed ancestor is pointed at an absence, never at a seated party
 *   - exactly one holder publishes, and exactly one holder is wrong about what
 *     they have
 *   - the unowned ones are unmaintained, unattributed and nobody's problem
 */

import { describe, it, expect } from 'vitest';

import { getSect, SECT_ANCESTRY } from '../../src/data/cultivation/sects.js';
import { getApexInstitution } from '../../src/data/cultivation/hierarchy.js';
import {
    THE_ASYMMETRY,
    HELD_INSTRUMENTS,
    HeldInstrumentSchema,
    UNOWNED_ANCESTORS,
    UnownedAncestorSchema,
    SEALED_ANCESTOR_PATTERN,
    SealedAncestorKindSchema,
    THE_BINDING_CONSTRAINT,
    AGE_IS_NOT_MENACE,
    SEALING_LAW,
    THE_LINEAGE_CLAIM,
    WHAT_SHE_DOES_WITH_THE_TIME,
    WHEN_ONE_WAKES,
    LOST_RECORDS,
    getHeldInstrument,
    instrumentHeldBy,
    bluffs,
    unmaintainedSeals
} from '../../src/data/cultivation/sealed-ancestors.js';
import {
    CONTINGENCIES,
    ContingencySchema,
    VAULT_CONTENTS,
    OTHERS_WHO_NOTICED,
    getContingency,
    contingenciesHeldBy,
    contingenciesAgainst
} from '../../src/data/cultivation/contingencies.js';

describe('the asymmetry', () => {
    it('states the law once, with its number and its consequences', () => {
        // The corrected law: convert versus obstruct, not seated versus not.
        expect(THE_ASYMMETRY.law).toMatch(/must convert loses/i);
        expect(THE_ASYMMETRY.law).toMatch(/merely obstruct wins/i);
        expect(THE_ASYMMETRY.law).toMatch(/still be in the way/i);
        // One in a hundred, and the one is the defender erring.
        expect(THE_ASYMMETRY.theNumber).toMatch(/one in a hundred/i);
        expect(THE_ASYMMETRY.theNumber).toMatch(/defender making a catastrophic error|erring/i);
        expect(THE_ASYMMETRY.theNumber).toMatch(/desperate/i);
        expect(THE_ASYMMETRY.consequences.length).toBeGreaterThanOrEqual(4);
        const consequences = THE_ASYMMETRY.consequences.join(' ');
        expect(consequences).toMatch(/weak on offence against anything attended/i);
        // A defensive waking inherits the good side of the asymmetry.
        expect(consequences).toMatch(/woken DEFENSIVELY|inherits the good side/i);
        expect(THE_ASYMMETRY.theStall).toMatch(/showing her a sum that no longer works|priced the objective again/i);
        expect(consequences).toMatch(/presence is the strongest defence/i);
        expect(consequences).toMatch(/cannot be spent profitably/i);
        // And the pattern file cites it rather than restating it.
        expect(SEALED_ANCESTOR_PATTERN.theLaw).toMatch(/THE_ASYMMETRY/);
    });

    it('points every held sealed ancestor at an absence rather than at a rival', () => {
        for (const h of HELD_INSTRUMENTS) {
            // No held instrument may be aimed at somebody seated and present.
            expect(h.privateContingency, `${h.id} is aimed at a seated party`)
                .not.toMatch(/seated defender|somebody sitting|while they are there/i);
        }
        // The worked case is explicitly aimed at an empty chair.
        const mirror = getHeldInstrument('sealed-the-mirror')!;
        expect(mirror.privateContingency).toMatch(/absence|nobody is sitting|cannot leave/i);
    });
});

describe('held instruments', () => {
    it('parses, and there are very few of them', () => {
        expect(HELD_INSTRUMENTS.length).toBeGreaterThanOrEqual(3);
        expect(HELD_INSTRUMENTS.length).toBeLessThanOrEqual(6);
        for (const h of HELD_INSTRUMENTS) {
            expect(() => HeldInstrumentSchema.parse(h), h.id).not.toThrow();
            expect(getSect(h.holderFactionId), `${h.id} held by unknown faction`).toBeDefined();
            expect(h.dormantYears).toBeGreaterThanOrEqual(100);
        }
        // One instrument per holder, at most.
        const holders = HELD_INSTRUMENTS.map(h => h.holderFactionId);
        expect(new Set(holders).size).toBe(holders.length);
    });

    it('separates what the holder publishes from what it is actually saving it for', () => {
        for (const h of HELD_INSTRUMENTS) {
            expect(h.privateContingency.length).toBeGreaterThan(200);
            if (h.publishedCondition !== null) {
                expect(h.publishedCondition).not.toBe(h.privateContingency);
            }
        }
        // Exactly one publishes, and it does so as a deterrent.
        const publishers = HELD_INSTRUMENTS.filter(h => h.strategy === 'deterrent_by_publication');
        expect(publishers.length, 'publication is a strategy, not the norm').toBe(1);
        expect(publishers[0].publishedCondition).not.toBeNull();
        expect(publishers[0].awareness).toBe('published');
        // The rest keep silence, and say why silence rather than publication.
        for (const h of HELD_INSTRUMENTS.filter(x => x.strategy === 'silence')) {
            expect(h.publishedCondition).toBeNull();
            expect(h.strategyNote.length).toBeGreaterThan(150);
        }
    });

    it('has exactly one holder who is wrong about what they hold', () => {
        const wrong = bluffs();
        expect(wrong.length, 'somebody must be saving something that is gone').toBe(1);
        const [dead] = wrong;
        expect(dead.condition).toBe('dead');
        expect(dead.holderBelieves).toBe('live');
        // And it is the oldest published one, whose whole posture rests on it.
        expect(dead.strategy).toBe('deterrent_by_publication');
        expect(dead.conditionNote).toMatch(/nobody checks|indistinguishable from spending/i);
    });

    it('agrees with the dormant ancestors already in the sect catalog', () => {
        for (const h of HELD_INSTRUMENTS) {
            const records = SECT_ANCESTRY[h.holderFactionId];
            expect(records, `${h.holderFactionId} has no ancestral records`).toBeDefined();
            expect(records.dormant, `${h.holderFactionId} has no dormant ancestor`).not.toBeNull();
            expect(records.dormant!.dormantYears, `${h.id} disagrees with the sect catalog`)
                .toBe(h.dormantYears);
        }
    });

    it('records the one case where a sealed ancestor was actually spent', () => {
        const c = SEALED_ANCESTOR_PATTERN.theOneCaseWhereItWasSpent;
        expect(c.yearsAgo).toBeGreaterThan(500);
        expect(c.whatItBought.length).toBeGreaterThan(150);
        expect(c.whatItCost.length).toBeGreaterThan(150);
        // It worked. That is the point.
        expect(c.whatItBought).toMatch(/ceased to exist|everything it asked/i);
        // And the sect was eaten afterwards.
        expect(c.whatItCost).toMatch(/absorbed|forty years|itself/i);
        expect(c.theLessonEverybodyTook).toMatch(/not that it fails|works and then you are food/i);
    });

    it('says how a waking would look from outside, concretely', () => {
        expect(SEALED_ANCESTOR_PATTERN.whatWakingLooksLikeFromOutside.length).toBeGreaterThanOrEqual(4);
        const symptoms = SEALED_ANCESTOR_PATTERN.whatWakingLooksLikeFromOutside.join(' ');
        // Region-scale and physical, so a player could recognise it unprompted.
        expect(symptoms).toMatch(/animals|beasts/i);
        expect(symptoms).toMatch(/formation/i);
        expect(symptoms).toMatch(/weather|season/i);
        for (const s of SEALED_ANCESTOR_PATTERN.whatWakingLooksLikeFromOutside) {
            expect(s.length).toBeGreaterThan(60);
        }
    });

    it('enumerates how anybody knows one is there', () => {
        expect(SEALED_ANCESTOR_PATTERN.howAnybodyKnows.length).toBeGreaterThanOrEqual(4);
        const known = SEALED_ANCESTOR_PATTERN.howAnybodyKnows.join(' ');
        for (const kind of ['published', 'rumoured', 'holder only', 'unknown to the holder', 'forgotten']) {
            expect(known.toLowerCase()).toContain(kind);
        }
        expect(SEALED_ANCESTOR_PATTERN.theOneThatWillNotWake).toMatch(/already gone|dead|will not wake/i);
    });
});

describe('unowned sealed ancestors', () => {
    it('parses, and none of them is anybody\'s to manage', () => {
        expect(UNOWNED_ANCESTORS.length).toBeGreaterThanOrEqual(3);
        for (const u of UNOWNED_ANCESTORS) {
            expect(() => UnownedAncestorSchema.parse(u), u.id).not.toThrow();
            expect(u.hazard.length).toBeGreaterThan(150);
            expect(u.opportunity.length).toBeGreaterThan(120);
            expect(u.nobodyIsResponsible.length).toBeGreaterThan(120);
        }
        // None of them is maintained, which is the definition of the category.
        expect(unmaintainedSeals().length).toBe(UNOWNED_ANCESTORS.length);
    });

    it('includes one under an institution that does not know', () => {
        const blind = UNOWNED_ANCESTORS.filter(u => u.awareness === 'unknown_to_holder');
        expect(blind.length).toBeGreaterThanOrEqual(1);
        expect(blind[0].whoKnows).toMatch(/story|does not believe|folklore|tradition/i);
    });

    it('includes one sealed by a party that no longer exists', () => {
        const orphaned = UNOWNED_ANCESTORS.filter(u => u.sealerFactionId === null);
        expect(orphaned.length).toBeGreaterThanOrEqual(1);
        const tally = UNOWNED_ANCESTORS.find(u => /Tally Court/i.test(u.sealedBy));
        expect(tally, 'a destroyed house should have left a seal').toBeDefined();
        expect(tally!.sealMaintained).toBe(false);
        expect(tally!.lastChecked).toMatch(/centuries|not in|never/i);
    });

    it('distinguishes sealed BY something from sealed FOR something', () => {
        const sealedFor = UNOWNED_ANCESTORS.filter(u => u.sealedFor !== null);
        const sealedBy = UNOWNED_ANCESTORS.filter(u => u.sealedFor === null);
        expect(sealedFor.length).toBeGreaterThanOrEqual(1);
        expect(sealedBy.length, 'some were sealed by an event, not a purpose')
            .toBeGreaterThanOrEqual(1);
    });
});

describe('the worked contingency', () => {
    it('parses, and is held by a party against a target', () => {
        expect(CONTINGENCIES.length).toBeGreaterThanOrEqual(1);
        for (const c of CONTINGENCIES) {
            expect(() => ContingencySchema.parse(c), c.id).not.toThrow();
            expect(getSect(c.heldBy), `${c.id} held by unknown faction`).toBeDefined();
            const target = getSect(c.targetFactionId) ?? getApexInstitution(c.targetFactionId);
            expect(target, `${c.id} aimed at unknown faction`).toBeDefined();
        }
        const mirror = getContingency('contingency-cold-hall-for-a-vault')!;
        expect(contingenciesHeldBy('sect-frostmirror-sect')).toContain(mirror);
        expect(contingenciesAgainst('apex-deep-survey')).toContain(mirror);
        // The holder does not name the target in its own records.
        expect(mirror.namesTheTarget).toBe(false);
        expect(mirror.inTheirWords).not.toMatch(/Deep Survey/);
    });

    it('reaches the target by arithmetic rather than by valuation', () => {
        const c = getContingency('contingency-cold-hall-for-a-vault')!;
        // The Lamp is not the target because the fight cannot be won.
        expect(c.theArithmetic).toMatch(/one in a hundred|ninety-nine/i);
        expect(c.theArithmetic).toMatch(/seated|still be there/i);
        expect(c.theArithmetic).toMatch(/one-shot|window|convert/i);
        expect(c.theArithmetic).toMatch(/the sum said no|went looking/i);
        // The accumulation is second best, chosen structurally.
        expect(c.whyThisPrize).toMatch(/second best|worth (materially )?less/i);
        expect(c.whyThisPrize).toMatch(/no fight|nobody to beat|absence to exploit/i);
    });

    it('makes one presence defend both prizes', () => {
        const c = getContingency('contingency-cold-hall-for-a-vault')!;
        expect(c.trigger).toMatch(/one event rather than two|single body|one person/i);
        expect(c.trigger).toMatch(/takes everything|Lamp included/i);
        expect(c.trigger).toMatch(/never the Lamp|was never the Lamp/i);
        // The vault entry agrees rather than contradicting it.
        expect(VAULT_CONTENTS.whatTheyWouldLeave).toMatch(/nothing, if the seat is empty/i);
        // And fungibility is demoted to the second consideration.
        expect(VAULT_CONTENTS.theSecondaryReason).toMatch(/second one|after they have answered|chair is occupied/i);
    });

    it('records whether they have considered manufacturing the trigger', () => {
        const c = getContingency('contingency-cold-hall-for-a-vault')!;
        expect(c.manufacturingTheTrigger).toMatch(/thought about it|costed it/i);
        // And what stopped them: not means, not nerve.
        expect(c.manufacturingTheTrigger).toMatch(/not means|not nerve/i);
        expect(c.manufacturingTheTrigger).toMatch(/worthless|no longer has a market/i);
        // It stays a plan.
        expect(c.manufacturingTheTrigger).toMatch(/stays a plan|cannot arrange/i);
    });

    it('keeps the intelligence gap and the watching', () => {
        const c = getContingency('contingency-cold-hall-for-a-vault')!;
        expect(c.intelligenceState).toMatch(/worked it out|sideways/i);
        expect(c.intelligenceState).toMatch(/told nobody|spends it/i);
        expect(c.theWatching).toMatch(/never advances|resident/i);
        // The Survey has the observation and not the conclusion.
        expect(c.targetAwareness).toMatch(/observation and not the conclusion|anomaly/i);
        expect(c.targetAwareness).toMatch(/most dangerous thing it does not know/i);
    });

    it('lists parties with the observation and no means', () => {
        expect(OTHERS_WHO_NOTICED.length).toBeGreaterThanOrEqual(2);
        for (const o of OTHERS_WHO_NOTICED) {
            expect(getSect(o.factionId), `${o.factionId} is unknown`).toBeDefined();
            expect(o.whatTheyLack.length).toBeGreaterThan(60);
        }
        // At least one reached the wrong conclusion, and one turned it into rumour.
        const all = OTHERS_WHO_NOTICED.map(o => o.whatTheyDoWithIt).join(' ');
        expect(all).toMatch(/discretion/i);
        expect(all).toMatch(/inns|joke|repeat/i);
    });
});


// ─────────────────────────────────────────────────────────────────────────
// THEY ARE PEOPLE
// The catalog is written by institutions that call them instruments. These
// assertions are the corrective, and they are the reason the file exists in
// the shape it does.
// ─────────────────────────────────────────────────────────────────────────

describe('age is not menace', () => {
    it('states the default reading once, and it is not threat', () => {
        expect(AGE_IS_NOT_MENACE.principle).toMatch(/not menace/i);
        expect(AGE_IS_NOT_MENACE.principle).toMatch(/young once/i);
        expect(AGE_IS_NOT_MENACE.whereThreatIsReal).toMatch(/specific/i);
        // The institutional vocabulary is named as the holders speaking.
        expect(AGE_IS_NOT_MENACE.theTest).toMatch(/holders speaking/i);
    });

    it('carries the correction into the pattern block', () => {
        expect(SEALED_ANCESTOR_PATTERN.theyArePeople).toMatch(/AGE_IS_NOT_MENACE/);
        expect(SEALED_ANCESTOR_PATTERN.theyArePeople).toMatch(/other two are better/i);
    });

    it('gives every unowned one a person rather than only a hazard', () => {
        for (const u of UNOWNED_ANCESTORS) {
            expect(u.ifSheWakes.length, `${u.id} has no person in it`).toBeGreaterThan(200);
        }
        // And at least two of them do something kind with the hours.
        const generous = UNOWNED_ANCESTORS.filter(u => /teach|hand down|give|generous/i.test(u.ifSheWakes));
        expect(generous.length, 'no woken ancestor in the catalog does anything kind').toBeGreaterThanOrEqual(2);
    });

    it('keeps at least one waking that goes badly for reasons of character', () => {
        const bad = UNOWNED_ANCESTORS.filter(u => /vain|grievance|dangerous/i.test(u.ifSheWakes));
        expect(bad.length, 'they cannot all be kind, or the selection effect is doing no work').toBeGreaterThanOrEqual(1);
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theyVary).toMatch(/sealed-the-sorting-yard/);
        // And the skew is explained rather than assumed.
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theSelectionEffect).toMatch(/does not trust/i);
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theSelectionEffect).toMatch(/can simply have been wrong/i);
    });
});

describe('the binding constraint', () => {
    it('is about presence rather than power, at every scale', () => {
        expect(THE_BINDING_CONSTRAINT.principle).toMatch(/who is standing there/i);
        expect(THE_BINDING_CONSTRAINT.atEveryScale.length).toBe(3);
        // The seated defender needs no capability at all, which is the point.
        expect(THE_BINDING_CONSTRAINT.atEveryScale[2]).toMatch(/no capability/i);
    });
});

describe('the law of sealing', () => {
    it('borrows the node law: keepable, repairable, never remakeable', () => {
        expect(SEALING_LAW.theLaw).toMatch(/cannot make a new seal/i);
        expect(SEALING_LAW.theLaw).toMatch(/maintain, repair and read/i);
        expect(SEALING_LAW.theLaw).toMatch(/history/);
    });

    it('leaves no lost-key dead end anywhere in the catalog', () => {
        expect(SEALING_LAW.wakingIsAlwaysPossible).toMatch(/no lost-key dead end/i);
        expect(SEALING_LAW.theConstraintIsKnowledge).toMatch(/knowledge/i);
        // And the catalog obeys it: nobody is unable to open their own chamber.
        const corpus = [
            ...HELD_INSTRUMENTS.map(h => `${h.wakeCost} ${h.strategyNote} ${h.conditionNote}`),
            ...UNOWNED_ANCESTORS.map(u => `${u.hazard} ${u.opportunity} ${u.ifSheWakes}`)
        ].join(' ');
        expect(corpus).not.toMatch(/cannot be opened|cannot wake|lost art of/i);
    });

    it('makes reading a seal the scarce skill, and decay the likeliest event', () => {
        expect(SEALING_LAW.readingIsAScarceSkill).toMatch(/Anchorhold/);
        expect(SEALING_LAW.readingIsAScarceSkill).toMatch(/Deep Survey/);
        expect(SEALING_LAW.sealsDoNotCheckWhoIsStanding).toMatch(/outsider/i);
        expect(SEALING_LAW.unmaintainedSealsDecay).toMatch(/erodes|degrades/i);
        // Every unowned one is under that decay, by construction.
        expect(unmaintainedSeals().length).toBe(UNOWNED_ANCESTORS.length);
    });
});

describe('what she does with the time', () => {
    it('offers three outcomes of equal standing', () => {
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theThreeOutcomes.length).toBe(3);
        const [does, gives, leaves] = WHAT_SHE_DOES_WITH_THE_TIME.theThreeOutcomes;
        expect(does).toMatch(/one of three/i);
        expect(gives).toMatch(/hand down|world has lost/i);
        expect(leaves).toMatch(/sun go down|see the sky/i);
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theyAreEqual).toMatch(/assumed an answer/i);
    });

    it('makes the gift the mechanism by which a Dao re-enters the world', () => {
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theGift).toMatch(/living teacher/i);
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theGift).toMatch(/exposure/i);
        expect(WHAT_SHE_DOES_WITH_THE_TIME.aDaoCanReEnterTheWorld).toMatch(/accident/i);
        expect(WHAT_SHE_DOES_WITH_THE_TIME.itMayBeAPersonRatherThanTheInstitution).toMatch(/wanderers/);
    });

    it('treats the refusal as a refusal rather than a rejection', () => {
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theRefusalThatIsNotARejection).toMatch(/nobody did anything wrong/i);
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theRefusalThatIsNotARejection).toMatch(/allowed to want it/i);
    });

    it('rates the free gift above the discharged duty', () => {
        expect(WHAT_SHE_DOES_WITH_THE_TIME.andSheMayHelpAnyway).toMatch(/no obligation is not the same as no kindness/i);
        expect(WHAT_SHE_DOES_WITH_THE_TIME.andSheMayHelpAnyway).toMatch(/worth more than the obligated version/i);
        // And the two categories are not a safe one and a dangerous one.
        expect(WHAT_SHE_DOES_WITH_THE_TIME.andSheMayHelpAnyway)
            .toMatch(/unowned case is not the dangerous case/i);
    });

    it('routes the duty question to the claim rather than to drift', () => {
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theClaimDecidesTheDuty).toMatch(/THE_LINEAGE_CLAIM/);
        expect(WHAT_SHE_DOES_WITH_THE_TIME.theClaimDecidesTheDuty).toMatch(/drift is expected/i);
        expect(WHEN_ONE_WAKES.andSheMayNotDoIt).toMatch(/WHAT_SHE_DOES_WITH_THE_TIME/);
    });
});

describe('the lineage claim', () => {
    it('frames the relationship as a claim, with the properties a claim has', () => {
        expect(THE_LINEAGE_CLAIM.thePrinciple).toMatch(/by what right/i);
        expect(THE_LINEAGE_CLAIM.whatAClaimIs.length).toBeGreaterThanOrEqual(4);
        const all = THE_LINEAGE_CLAIM.whatAClaimIs.join(' ');
        expect(all).toMatch(/disputed/i);
        expect(all).toMatch(/possession is not legitimacy/i);
        expect(all).toMatch(/unfalsifiable/i);
    });

    it('makes her the only authority who can settle it', () => {
        expect(THE_LINEAGE_CLAIM.sheIsTheOnlyAuthority).toMatch(/single adjudicator/i);
        expect(THE_LINEAGE_CLAIM.sheIsTheOnlyAuthority).toMatch(/Ninefold Ledger/);
        expect(THE_LINEAGE_CLAIM.theVerdictMayBeNeither).toMatch(/neither|nobody expected/i);
    });

    it('gives a second reason instruments go unspent, separate from the arithmetic', () => {
        expect(THE_LINEAGE_CLAIM.theSecondReasonInstrumentsGoUnspent).toMatch(/not cost, not risk/i);
        expect(THE_LINEAGE_CLAIM.theSecondReasonInstrumentsGoUnspent).toMatch(/probably is not good enough/i);
        expect(SEALED_ANCESTOR_PATTERN.theSecondReasonNobodyWakes).toMatch(/THE_LINEAGE_CLAIM/);
    });

    it('prices the lie: viable, and annihilating if she sees it', () => {
        expect(THE_LINEAGE_CLAIM.theLieIsViable).toMatch(/cannot go and check/i);
        expect(THE_LINEAGE_CLAIM.andIfSheWorksItOut).toMatch(/kills them all/i);
        expect(THE_LINEAGE_CLAIM.andIfSheWorksItOut).toMatch(/defraud/i);
        expect(THE_LINEAGE_CLAIM.theTwoQuestions.length).toBe(2);
        expect(THE_LINEAGE_CLAIM.theTwoQuestions[0]).toMatch(/know this ancestor/i);
        expect(THE_LINEAGE_CLAIM.theTwoQuestions[1]).toMatch(/should be defending/i);
        expect(THE_LINEAGE_CLAIM.theTwoQuestionsNote).toMatch(/not the hall, the sect/i);
    });

    it('keeps the gamble live rather than suicidal', () => {
        expect(THE_LINEAGE_CLAIM.theCruelAsymmetry).toMatch(/liars know they are lying/i);
        expect(THE_LINEAGE_CLAIM.sheMayNotCare).toMatch(/helps anyway|leaves without comment/i);
        expect(THE_LINEAGE_CLAIM.preparationIsVisible).toMatch(/rehearse/i);
        expect(THE_LINEAGE_CLAIM.theSabotage).toMatch(/believed for one sentence/i);
        expect(THE_LINEAGE_CLAIM.whichAssetYouActuallyHold).toMatch(/only as a fraud/i);
    });

    it('names cases the claim already bites, and they are real sects', () => {
        expect(THE_LINEAGE_CLAIM.whereItAlreadyBites.length).toBeGreaterThanOrEqual(3);
        for (const line of THE_LINEAGE_CLAIM.whereItAlreadyBites) {
            const id = line.split(':')[0]!;
            expect(getSect(id), `${id} is unknown`).toBeDefined();
        }
    });
});

describe('the two kinds', () => {
    it('offers terminal, protector and unknown', () => {
        expect(SealedAncestorKindSchema.options).toEqual(['terminal', 'protector', 'unknown']);
    });

    it('holds one of each correctly and one wrongly', () => {
        const kinds = HELD_INSTRUMENTS.map(h => h.kind);
        expect(kinds).toContain('terminal');
        expect(kinds).toContain('protector');
        const wrong = HELD_INSTRUMENTS.filter(h => h.kind !== h.holderBelievesKind);
        expect(wrong.length, 'exactly one holder should be wrong about the kind').toBe(1);
        // And it is the worst possible direction: they think they have a keeper.
        expect(wrong[0]!.holderBelievesKind).toBe('protector');
        expect(wrong[0]!.kind).toBe('terminal');
        expect(wrong[0]!.kindNote).toMatch(/good faith/i);
    });

    it('explains the protector as a position rather than a grave', () => {
        const protector = HELD_INSTRUMENTS.find(h => h.kind === 'protector')!;
        expect(protector.kindNote).toMatch(/at strength|position/i);
        expect(protector.kindNote).toMatch(/real time|future/i);
        // A protector does not burn out, so its holder is genuinely hard to attack.
        expect(SEALED_ANCESTOR_PATTERN.theTwoKinds).toMatch(/does not burn out/i);
    });

    it('ties the wrong kind to the one that is already dead', () => {
        const wrong = HELD_INSTRUMENTS.find(h => h.kind !== h.holderBelievesKind)!;
        expect(wrong.condition).toBe('dead');
        expect(wrong.kindNote).toMatch(/A protector keeps/i);
    });
});

describe('when the record is lost', () => {
    it('separates every losable part, and opening is not one of them', () => {
        expect(LOST_RECORDS.whatIsLosableSeparately.length).toBeGreaterThanOrEqual(5);
        const all = LOST_RECORDS.whatIsLosableSeparately.join(' ');
        expect(all).toMatch(/terminal or protector/i);
        expect(all).toMatch(/occupied one from an empty one/i);
        expect(all).toMatch(/lineage/i);
        // The wake condition is a trigger, not a key.
        expect(all).toMatch(/never lost and never at issue/i);
    });

    it('turns lost records into a lost claim rather than a lost asset', () => {
        expect(LOST_RECORDS.theClaimProblem).toMatch(/no claim/i);
        expect(LOST_RECORDS.theClaimProblem).toMatch(/gift rather than a duty/i);
        expect(LOST_RECORDS.theClaimProblem).not.toMatch(/hostile to them/i);
    });

    it('lets an outsider know more than the holder, by archives rather than power', () => {
        expect(LOST_RECORDS.somebodyElseMayKnow).toMatch(/Deep Survey/);
        expect(LOST_RECORDS.somebodyElseMayKnow).toMatch(/no strength at all/i);
    });

    it('merges the two categories for a forgotten one', () => {
        expect(LOST_RECORDS.categoryCollapse).toMatch(/not a held instrument/i);
        expect(LOST_RECORDS.categoryCollapse).toMatch(/inhabited building|congregation/i);
        const forgotten = UNOWNED_ANCESTORS.filter(u => u.awareness === 'forgotten');
        expect(forgotten.length, 'the merged category needs an instance').toBe(1);
        expect(forgotten[0]!.sealMaintained).toBe(false);
    });

    it('writes the accidental waking as a gift rather than a horror', () => {
        expect(LOST_RECORDS.theAccidentalWaking).toMatch(/reasonable people doing competent work/i);
        expect(LOST_RECORDS.theAccidentalWaking).toMatch(/not a disaster released/i);
        expect(LOST_RECORDS.theAccidentalWaking).toMatch(/give something away/i);
        const hall = UNOWNED_ANCESTORS.find(u => u.id === 'unowned-under-the-spring-hall')!;
        expect(hall.hazard).toMatch(/no malice/i);
        expect(hall.ifSheWakes).toMatch(/teaching/i);
    });
});
