/**
 * Validation for the wandering figures.
 *
 * The assertions that matter are the ones that stop him becoming a shortcut or
 * a plot device:
 *
 *   - unknown to exist, so his name may not be spoken to a starting cultivator
 *   - unreliable in enumerated ways, on the record
 *   - bounded by an interest above the Lid rather than by anything below it,
 *     and the boundary is drawn by whose interest an act crosses
 *   - his gifts have ruined somebody, and he did not find out
 *   - the isolation is logistical, and nowhere does the catalog call him lonely
 */

import { describe, it, expect } from 'vitest';

import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    rankName
} from '../../src/engine/cultivation/realms.js';
import { getSect } from '../../src/data/cultivation/sects.js';
import { getEncounter } from '../../src/data/cultivation/encounters.js';
import { getImmortalItem, getHoldingsOf } from '../../src/data/cultivation/immortal-items.js';
import { mayBeNamed } from '../../src/data/cultivation/hierarchy.js';
import {
    WANDERERS,
    WandererSchema,
    getWanderer,
    getWanderersAffiliatedWith,
    legendsOf,
    accurateLegendOf,
    mayBeNamedTo
} from '../../src/data/cultivation/wanderers.js';

const LU_SHENG = 'wanderer-lu-sheng';

describe('wandering figures', () => {
    it('parses, and there are almost none of them', () => {
        expect(WANDERERS.length).toBeGreaterThanOrEqual(1);
        expect(WANDERERS.length, 'a wanderer stops being rare if there is a roster')
            .toBeLessThanOrEqual(3);
        for (const w of WANDERERS) {
            expect(() => WandererSchema.parse(w), w.id).not.toThrow();
        }
        expect(getWanderer(LU_SHENG)).toBeDefined();
        expect(getWanderer('wanderer-nobody')).toBeUndefined();
    });

    it('is unknown to exist, not merely hard to find', () => {
        for (const w of WANDERERS) {
            expect(w.startingAwareness).toBe('unaware');
            expect(mayBeNamedTo(w.startingAwareness), `${w.id} may not be named to a beginner`)
                .toBe(false);
            expect(mayBeNamedTo('whisper')).toBe(false);
            expect(mayBeNamedTo('named')).toBe(true);
            // Same rule the apex institutions use, so narration cannot leak.
            expect(mayBeNamedTo(w.startingAwareness)).toBe(mayBeNamed(w.startingAwareness));
            expect(w.awarenessSources.length, `${w.id} is unlearnable`).toBeGreaterThanOrEqual(3);
        }
    });

    it('is a False Immortal, permanently barred, with a countable lifespan', () => {
        const w = getWanderer(LU_SHENG)!;
        expect(w.crossingOutcome).toBe('false_immortal');
        // On the ladder, not beside it: he holds the lower rung of the
        // Immortal realm and sorts into the ordinary power table there.
        expect(w.lastOrdinal).toBe(FALSE_IMMORTAL_ORDINAL);
        expect(w.lastOrdinal).toBeGreaterThan(LAST_CROSSING_ORDINAL);
        expect(rankName(w.lastOrdinal)).toBe('False Immortal');
        expect(w.crossingYearsAgo).toBeGreaterThan(100);
        // Vast, finite, and he knows the number.
        expect(w.lifespanYearsRemaining).toBeGreaterThan(1_000);
        expect(w.lifespanNote).toMatch(/finite|knows the number|to the year/i);
        // Incomplete in one specific way, and never explained.
        expect(w.incompleteIsUnexplained).toBe(true);
        expect(w.incomplete.length).toBeGreaterThan(80);
        expect(`${w.incomplete} ${w.whatHappened}`).not.toMatch(/because|the reason is|which is why/i);
    });

    it('is affiliated with the Court in a way that amounts to nothing', () => {
        const w = getWanderer(LU_SHENG)!;
        expect(getSect(w.affiliation.factionId), 'affiliated with an unknown faction').toBeDefined();
        expect(w.affiliation.factionId).toBe('sect-hollow-court');
        // The rank he holds is deliberately NOT one of the four rungs. Guest of
        // the Court is honorary and sits outside the ladder, which is what lets
        // it be held by somebody the Court could not promote if it wanted to -
        // and is the whole reason the affiliation amounts to nothing.
        expect(getSect(w.affiliation.factionId)!.ranks).not.toContain(w.affiliation.rankHeld);
        expect(w.affiliation.rankHeld).toBe('Guest of the Court');
        expect(w.affiliation.whatItAmountsTo).toMatch(/empty|never used|no obligation/i);
        expect(getWanderersAffiliatedWith('sect-hollow-court').map(x => x.id)).toContain(LU_SHENG);
        expect(getWanderersAffiliatedWith('sect-azure-cloud-pavilion')).toEqual([]);
        // And the logic of why he is not there.
        expect(w.whyNotWithThem).toMatch(/barred|nothing.*to do|permanently/i);
    });

    it('is honest because of position, not virtue, and is not a shortcut', () => {
        const w = getWanderer(LU_SHENG)!;
        expect(w.whyHeIsHonest).toMatch(/not virtue|nothing.*can do|no sect|no title/i);
        expect(w.unreliability.length, 'he must be unreliable in stated ways')
            .toBeGreaterThanOrEqual(4);
        const unreliability = w.unreliability.join(' ');
        expect(unreliability).toMatch(/out of date|centuries/i);
        expect(unreliability).toMatch(/wrong/i);
        expect(unreliability).toMatch(/ignore|second question/i);
        // What he wants cannot be supplied by anybody below.
        expect(w.wants).toMatch(/nobody below|cannot|no arrangement/i);
    });
});

describe('the ceiling on his behaviour', () => {
    it('draws the line by whose interest an act crosses, not by damage', () => {
        const r = getWanderer(LU_SHENG)!.restraint;
        expect(r.principle).toMatch(/whose interest|never by the size|not by how much/i);
        expect(r.willDo.length).toBeGreaterThanOrEqual(3);
        expect(r.willNotDo.length).toBeGreaterThanOrEqual(3);
        // The pill is the Pavilion's problem; collapsing it is hers.
        expect(r.willDo.join(' ')).toMatch(/take something irreplaceable|sect.s problem|no recourse|can do nothing/i);
        expect(r.willNotDo.join(' ')).toMatch(/Ru Anjing|Standing Edge/);
    });

    it('is bounded by uncertainty rather than by a named enemy', () => {
        const r = getWanderer(LU_SHENG)!.restraint;
        // Something would come down. He does not know who, what, or how many.
        expect(r.theDeterrent).toMatch(/something would come down|not who|not what/i);
        expect(r.theDeterrent).toMatch(/declined to find out|different thing from being afraid/i);
        // He does not know what is above the Lid either.
        expect(r.whatHeDoesNotKnow).toMatch(/does not know|no idea/i);
        expect(r.whatHeDoesNotKnow).toMatch(/door/i);
        // The price is real and paid by whoever comes, which is what binds him.
        expect(r.deterrentPrice).toMatch(/cultivation condensed|ages|body|do not come back/i);
        expect(r.deterrentPrice).toMatch(/willing to spend|does not wish to meet/i);
        // Not a calculation against a known punishment: the naming is hedged.
        expect(r.theDeterrent).toMatch(/does not know that she would come|not whether it would be/i);
        // He knows, and there is a dated occasion rather than a policy.
        expect(r.howHeKnows).toMatch(/\d|years ago|came down/i);
        expect(r.howHeKnows).toMatch(/does not know what it was|did not understand/i);
        expect(r.theOccasion.yearsAgo).toBeGreaterThan(0);
        expect(r.theOccasion.whereHeStopped.length).toBeGreaterThan(100);
        expect(r.theOccasion.whoNoticed.length).toBeGreaterThan(60);
    });

    it('leaves the apex institutions alone for no reason at all', () => {
        const r = getWanderer(LU_SHENG)!.restraint;
        expect(r.noMotiveNote).toMatch(/no reason|nothing against|boring|not caution/i);
        expect(r.willNotDo.join(' ')).toMatch(/Deep Survey|Long Cut/);
    });

    it('keeps the occasion consistent with the Pavilion holding three', () => {
        const r = getWanderer(LU_SHENG)!.restraint;
        // He took one of four, which is why the catalog says three.
        expect(r.theOccasion.what).toMatch(/four/i);
        // He took one of four that day. The count has risen since, because the
        // channel keeps sending - which is why the theft cannot be read off it.
        const holding = getHoldingsOf('sect-azure-cloud-pavilion')
            .find(h => h.itemId === 'immortal-unearned-step')!;
        expect(holding.count).toBeGreaterThan(3);
        expect(r.theOccasion.what).toMatch(/holds seven now|keeps arriving/i);
        expect(getImmortalItem('immortal-unearned-step')).toBeDefined();
    });

    it('looks arbitrary from below and is readable from above', () => {
        const r = getWanderer(LU_SHENG)!.restraint;
        expect(r.looksArbitraryFromBelow).toMatch(/arbitrar|mad|cannot|none of them/i);
        expect(r.readableBy).toMatch(/above the Lid|constituency/i);
        // And the player is explicitly not covered by any of it.
        expect(r.playerIsNotProtected).toMatch(/stolen|knows precisely who|wandered off/i);
    });
});

describe('what his attention costs other people', () => {
    it('has ruined somebody with a gift, and he never found out', () => {
        const w = getWanderer(LU_SHENG)!;
        expect(w.incidents.length).toBeGreaterThanOrEqual(3);
        const unlearned = w.incidents.filter(i => i.heNeverLearned);
        expect(unlearned.length, 'nothing has escaped his notice').toBeGreaterThanOrEqual(2);
        // One of them is a gift that cost the recipient badly.
        const gift = w.incidents.find(i => /gave it to her|gave it to him|handed/i.test(i.what));
        expect(gift, 'no gift incident on record').toBeDefined();
        expect(gift!.heNeverLearned, 'he should not have found out').toBe(true);
        expect(gift!.consequence.length).toBeGreaterThan(200);
        expect(gift!.consequence).toMatch(/stolen|audit|refused her|ruin/i);
    });

    it('states the consequence of being noticed, which he does not track', () => {
        const w = getWanderer(LU_SHENG)!;
        expect(w.attentionConsequence).toMatch(/does not intend|does not track|not there/i);
        expect(w.attentionConsequence).toMatch(/weather|reorganis/i);
        // Incidents are small: nothing here is a deed.
        for (const i of w.incidents) {
            expect(i.what.length).toBeGreaterThan(100);
            expect(i.consequence.length).toBeGreaterThan(80);
        }
    });

    it('circulates in incompatible versions, mostly wrong', () => {
        const legends = legendsOf(LU_SHENG);
        expect(legends.length).toBeGreaterThanOrEqual(3);
        const wrong = legends.filter(l => !l.accurate);
        expect(wrong.length, 'most versions must be wrong').toBeGreaterThanOrEqual(2);
        for (const l of wrong) expect(l.whatIsWrong.length).toBeGreaterThan(40);
        // Exactly one is right, and it is the least circulated.
        const right = legends.filter(l => l.accurate);
        expect(right.length).toBe(1);
        expect(accurateLegendOf(LU_SHENG)!.calledBy).toBe(right[0].calledBy);
        // The names disagree with each other, which is the point.
        expect(new Set(legends.map(l => l.calledBy)).size).toBe(legends.length);
    });
});

describe('why he is wandering', () => {
    it('is logistical rather than tragic, and never says so', () => {
        const iso = getWanderer(LU_SHENG)!.isolation;
        // Enemies dead of unrelated things; friends merely unavailable.
        expect(iso.enemies).toMatch(/outlived|dead|nothing to do with him/i);
        expect(iso.friendsInSeclusion.expectedOutInYears).toBeGreaterThanOrEqual(10);
        expect(iso.friendsInSeclusion.note).toMatch(/not available|seclusion|fallen out/i);
        expect(iso.whyHeTalksToStrangers).toMatch(/only conversation|nobody else/i);
        // The catalog must not editorialise him as lonely or sad.
        const w = getWanderer(LU_SHENG)!;
        const prose = [
            w.before, w.whatHappened, w.wants, w.whyHeIsHonest, w.firstImpression,
            iso.enemies, iso.whyHeTalksToStrangers, iso.theAsymmetry
        ].join(' ');
        for (const banned of [/\blonely\b/i, /\btragic\b/i, /\bbrooding\b/i, /\bcursed\b/i, /\bbitter\b/i]) {
            expect(banned.test(prose), `the catalog calls him ${banned}`).toBe(false);
        }
    });

    it('names a specific last friend and a specific last conversation', () => {
        const iso = getWanderer(LU_SHENG)!.isolation;
        expect(iso.lastFriendWhoDied.name.length).toBeGreaterThan(2);
        expect(iso.lastFriendWhoDied.yearsAgo).toBeGreaterThan(0);
        expect(iso.lastFriendWhoDied.yearsAgo).toBeLessThan(200);
        // Not a great figure: the specificity is what matters.
        expect(iso.lastFriendWhoDied.whatTheyWere).toMatch(/not a cultivator|boatman|never asked/i);
        expect(iso.friendsInSeclusion.lastSpokeYearsAgo).toBeGreaterThan(0);
    });

    it('turns up in the same few places, unrecognised', () => {
        const regulars = getWanderer(LU_SHENG)!.isolation.regulars;
        expect(regulars.length).toBeGreaterThanOrEqual(1);
        const innkeeper = regulars.find(r => r.yearsThere >= 40)!;
        expect(innkeeper, 'somebody should have served him for decades').toBeDefined();
        expect(innkeeper.timesServed).toBeGreaterThanOrEqual(5);
        expect(innkeeper.timesServed).toBeLessThan(innkeeper.yearsThere);
        expect(innkeeper.whatTheyThinkHeIs).not.toMatch(/immortal|cultivator of|Court/i);
        expect(innkeeper.note).toMatch(/no idea|would not believe|good company|looks forward/i);
    });

    it('dislikes one of the four, pettily, and it has stayed petty', () => {
        const d = getWanderer(LU_SHENG)!.theOneHeAvoids;
        expect(d.reasonYearsAgo).toBeGreaterThanOrEqual(500);
        // Trivial, and it would sound absurd said aloud.
        expect(d.reason).toMatch(/corrected|pronunciation|river/i);
        expect(d.forgottenPart).toMatch(/not entirely certain|vague|not worth/i);
        expect(d.mutual).toBe('unknown');
        expect(d.mutualNote).toMatch(/never asked|possibly/i);
        // Consequences no larger than the pettiness deserves.
        expect(d.consequences.length).toBeGreaterThanOrEqual(3);
        expect(d.consequences.join(' ')).toMatch(/does not go|times.*visits|somewhere else/i);
        expect(d.consequences.join(' ')).toMatch(/nothing else|nothing has escalated/i);
        expect(d.whyNeitherExplains).toMatch(/how small|not secrecy|admitting/i);
        // Explicitly not a feud, and explicitly not about the refusal.
        expect(d.whatItIsNot).toMatch(/not a feud/i);
        expect(d.whatItIsNot).toMatch(/refusal/i);
    });
});

describe('meeting him', () => {
    it('is reachable as a rare encounter that does not announce itself', () => {
        const enc = getEncounter('enc-unremarkable-man-at-an-inn')!;
        expect(enc, 'he must be reachable in play').toBeDefined();
        // Rare.
        expect(enc.weight).toBeLessThanOrEqual(4);
        // Available at any realm, because recognising him is the hard part.
        expect(enc.minOrdinal).toBe(0);
        expect(enc.maxOrdinal).toBe(44);
        // Not obviously important at the time: no interrupt, no threat.
        expect(enc.interrupts).toBe(false);
        expect(enc.threatOrdinal).toBeNull();
        // And the summary must not name him or hint at what he is.
        expect(enc.summaryTemplate).not.toMatch(/Lu Sheng|Guest|immortal|Court/i);
        expect(enc.summaryTemplate).toMatch(/unremarkable|no obvious age|good company/i);
    });
});

describe('a man who already settled his estate', () => {
    it('divested completely before a crossing he did not complete', () => {
        const e = getWanderer(LU_SHENG)!.estate;
        expect(e.divestedYearsAgo).toBeGreaterThan(getWanderer(LU_SHENG)!.crossingYearsAgo - 20);
        expect(e.whatHeDid).toMatch(/sold|gave away|buried|sealed|inheritances/i);
        expect(e.whyObjectsDoNotRegister).toMatch(/finished|completed|before/i);
        // Never written as pathos.
        expect(e.notPathetic).toMatch(/does not experience|puzzled|pleased/i);
        for (const banned of [/\bsad\b/i, /\bpitiful\b/i, /\bempty life\b/i]) {
            expect(banned.test(`${e.whatHeDid} ${e.whyObjectsDoNotRegister} ${e.notPathetic}`)).toBe(false);
        }
    });

    it('keeps inheritances that refill and cannot be mapped', () => {
        const inheritances = getWanderer(LU_SHENG)!.inheritances;
        expect(inheritances.length).toBeGreaterThanOrEqual(1);
        for (const inh of inheritances) {
            expect(inh.refills).toBe(true);
            expect(inh.mobile).toBe(true);
            expect(inh.refillNote).toMatch(/only category|restocks|maintained/i);
            expect(inh.mobilityNote).toMatch(/not a place|not a site|worthless/i);
            // Accounts contradict each other without anybody lying.
            expect(inh.contradictoryAccounts.length).toBeGreaterThanOrEqual(3);
        }
        // And the contradiction is one of the circulating legends.
        expect(legendsOf(LU_SHENG).some(l => /refills|moving/i.test(`${l.calledBy} ${l.version}`)))
            .toBe(true);
    });

    it('picks inheritors by a fate that actually delivers', () => {
        const inh = getWanderer(LU_SHENG)!.inheritors;
        // Unpredictable from outside, and no method to build.
        expect(inh.chosenBy).toMatch(/fate|whoever was standing|ran into/i);
        expect(inh.noPatternToExploit).toMatch(/no method|cannot search|invisible in advance/i);
        // But there is always something there.
        expect(inh.fateDelivers).toMatch(/not a figure of speech|delivers/i);
        expect(inh.whatTheyHave).toMatch(/every single one|something real/i);
        expect(inh.notLegible).toMatch(/latent|not visible/i);
        // The catalog must not claim they share nothing.
        const prose = `${inh.whatTheyHave} ${inh.notLegible} ${inh.noPatternToExploit}`;
        expect(/they share nothing|nothing there/i.test(prose)).toBe(false);
        // The inheritance is exposure, which is what makes it matter.
        expect(inh.inheritanceIsExposure).toMatch(/access|exposure|absent/i);
        // Every named inheritor has a real latent thing, mostly unknown to them.
        expect(inh.people.length).toBeGreaterThanOrEqual(2);
        for (const person of inh.people) {
            expect(person.latentThing.length).toBeGreaterThan(80);
        }
        expect(inh.people.some(x => !x.theyKnow), 'somebody should not know').toBe(true);
        // And one is dead without his having noticed.
        const dead = inh.people.find(x => x.status === 'dead')!;
        expect(dead, 'one inheritor should have died').toBeDefined();
        expect(dead.heKnows).toBe(false);
    });

    it('binds inheritors to silence, with nothing as the penalty', () => {
        const sec = getWanderer(LU_SHENG)!.secrecy;
        expect(sec.theOath).toMatch(/no ceremony|once|do not go telling/i);
        expect(sec.permittedToTell.length).toBe(2);
        expect(sec.permittedToTell.join(' ')).toMatch(/other inheritors/i);
        expect(sec.permittedToTell.join(' ')).toMatch(/Court|Ledger/);
        expect(sec.motive).toMatch(/not fear|gossip|preference/i);
        // The breach costs nothing, which is the frightening part.
        expect(sec.breachConsequence).toMatch(/Nothing\.|does not retaliate/i);
        expect(sec.breachConsequence).toMatch(/simply does not come back|never restocked|never seen/i);
        // One inheritor talked and nothing happened to them.
        expect(sec.theOneWhoTalked.whatDidNotHappen).toMatch(/no retaliation|nothing taken back/i);
        expect(sec.theOneWhoTalked.howLongTheyDidNotKnow).toMatch(/died not knowing|years/i);
        // The permitted network barely functions.
        expect(sec.networkBarelyFunctions).toMatch(/never introduced|pass each other|almost never/i);
        // It uses the engine's own secret vocabulary rather than a new one.
        for (const status of sec.outsiderStatuses) {
            expect(['unknown', 'suspected', 'discovered', 'stolen', 'traded', 'leaked',
                'suppressed', 'falsified', 'misunderstood']).toContain(status);
        }
        expect(sec.outsiderStatuses).toContain('suspected');
        expect(sec.outsiderStatuses).toContain('misunderstood');
    });

    it('explains why the legends are incoherent by who is silent', () => {
        const sec = getWanderer(LU_SHENG)!.secrecy;
        expect(sec.whyLegendsAreIncoherent).toMatch(/accurate sources|not talking|outer ring/i);
        // Every wrong version is from the outer ring, not from an insider.
        for (const legend of legendsOf(LU_SHENG)) {
            if (legend.accurate) continue;
            expect(legend.toldAmong).not.toMatch(/inheritor/i);
        }
    });
});

describe('who knows what', () => {
    it('keeps the full picture to the Court and the inheritors', () => {
        const k = getWanderer(LU_SHENG)!.whoKnowsWhat;
        expect(k.fullTruth.length).toBe(2);
        expect(k.fullTruth.join(' ')).toMatch(/Hollow Court|Seats/);
        expect(k.fullTruth.join(' ')).toMatch(/inheritors/);
        expect(k.fragments).toMatch(/outer ring|incompatible/i);
        expect(k.nothing).toMatch(/everybody else|no archive/i);
        expect(k.whatItIsWorth).toMatch(/Deep Survey does not have|dangerous/i);
    });

    it('confirms the category and cannot resolve the instance', () => {
        const blind = getWanderer(LU_SHENG)!.whoKnowsWhat.apexBlindSpot;
        expect(blind.categoryConfirmed).toMatch(/know|not disputed|independently/i);
        expect(blind.theOpenQuestion).toMatch(/same one|continuity|four, in sequence/i);
        expect(blind.bothConcluded).toMatch(/cannot tell|not being incompetent|uncertainty/i);
        expect(blind.theAnomaly).toMatch(/anomalous|sealed|does not usually produce/i);
        // The candidate list is a real artefact with the right shape.
        expect(blind.candidateNames.length).toBeGreaterThanOrEqual(4);
        const dead = blind.candidateNames.filter(c => c.status === 'verifiably_dead');
        expect(dead.length, 'at least two verifiably dead with scars').toBeGreaterThanOrEqual(2);
        for (const d of dead) expect(d.whatTheRecordHas).toMatch(/scar/i);
        expect(blind.candidateNames.some(c => c.status === 'never_a_person')).toBe(true);
        const live = blind.candidateNames.filter(c => c.status === 'live');
        expect(live.length, 'his name is on the list, exactly once').toBe(1);
        expect(live[0].name).toBe('Lu Sheng');
        // And nothing marks it out.
        expect(live[0].whatTheRecordHas).toMatch(/nothing marks|indistinguishable/i);
        expect(blind.candidateListNote).toMatch(/misfiled|indistinguishable|noise/i);
    });

    it('cannot settle identity because he does not hold still', () => {
        const nf = getWanderer(LU_SHENG)!.notFixed;
        // A property of what he is, not a listed capability.
        expect(nf.howItReads).toMatch(/not a technique|no name|property/i);
        expect(nf.casualNotTactical).toMatch(/not hiding|no scheme|suits him/i);
        // Whim has no pattern, which is worse for a register than deception.
        expect(nf.whyItDefeatsARegister).toMatch(/pattern/i);
        expect(nf.whyItDefeatsARegister).toMatch(/nothing to model|neither be linked|cannot even say/i);
        // His inheritors could tell, because they know him rather than his face.
        expect(nf.whoCouldTell).toMatch(/inheritors/i);
        // Somebody has met him repeatedly without knowing.
        const innkeeper = getWanderer(LU_SHENG)!.isolation.regulars.find(r => r.yearsThere >= 40)!;
        expect(innkeeper.note).toMatch(/different customers|nine different|does not know it is the same/i);
    });

    it('makes the four disagree about him, including one who cannot stand him', () => {
        const opinions = getWanderer(LU_SHENG)!.courtOpinions;
        expect(opinions.length).toBe(4);
        const stances = new Set(opinions.map(o => o.stance));
        expect(stances.size, 'four beings who have not moved should not agree')
            .toBeGreaterThanOrEqual(3);
        expect(stances.has('dislikes')).toBe(true);
        for (const o of opinions) expect(o.note.length).toBeGreaterThan(100);
        // The one who dislikes him is the one he avoids, and it is familiarity.
        const dislikes = opinions.find(o => o.stance === 'dislikes')!;
        expect(getWanderer(LU_SHENG)!.theOneHeAvoids.who).toContain('Third Seat');
        expect(dislikes.who).toContain('Third Seat');
        expect(dislikes.note).toMatch(/knows exactly|watched/i);
    });

    it('keeps the dislike trivial on the surface and familiar underneath', () => {
        const d = getWanderer(LU_SHENG)!.theOneHeAvoids;
        expect(d.theShapeUnderneath).toMatch(/familiarity|close range/i);
        expect(d.theShapeUnderneath).toMatch(/not earned|would mean explaining/i);
        // The surface stays a remark about a river.
        expect(d.reason).toMatch(/river/i);
    });
});
