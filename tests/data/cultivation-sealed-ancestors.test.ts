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
        expect(contingenciesHeldBy('sect-frostmirror-court')).toContain(mirror);
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
