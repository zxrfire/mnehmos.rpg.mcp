/**
 * What a disaster can end, and how the top of the world dies.
 *
 * The load-bearing assertions, in the order they matter:
 *   - a catastrophe can destroy a sect or a court and cannot kill an apex head
 *   - nobody is invincible: the routes are hard, not closed
 *   - the sealed ceilings the conspiracy reasons over are read off the sect
 *     catalog rather than restated, so a change there cannot silently make the
 *     arithmetic in the prose wrong
 *   - and the courts under a fallen apex all have the same claim
 */

import fs from 'node:fs';

import { THE_ANCESTOR_WHO_MIGHT_ANSWER } from '../../src/data/cultivation/crossings.js';
import {
    describe,
    it,
    expect } from 'vitest';

import {
    CATASTROPHE_EXPOSURE,
    DISASTER_RESPONSES,
    UNTOUCHED_BY_DISASTER_ORDINAL,
    couldDieToADisaster,
    exposureOf,
    factionsADisasterCouldDestroy,
    WHAT_FALLS_ON_THOSE_BELOW,
} from '../../src/data/cultivation/catastrophe.js';
import {
    DEATHS_AVAILABLE,
    OPENLY_OR_IN_SECRET,
    THE_COURTS_BELOW,
    conspiracyArithmetic,
    housesThatCouldJoinAConspiracy,
    WHY_THE_HEAD_IS_PINNED,
    ARTIFACT_MARGIN,
    THE_STALL,
    THE_SHADOW_CONSPIRACY,
    WHO_HOLDS_A_KEY,
    THE_HOLLOW_COURT_COULD,
    THE_REVOLT
} from '../../src/data/cultivation/standoff.js';
import { ARTIFACTS, artifactPowerOf, artifactsOwnedBy } from '../../src/data/cultivation/artifacts.js';
import { MEMBERS } from '../../src/data/cultivation/members.js';
import { APEX_INSTITUTIONS, COURTS } from '../../src/data/cultivation/hierarchy.js';
import { SECT_ANCESTRY, sectThreat, sectsWithASealedCeiling } from '../../src/data/cultivation/sects.js';
import {
    MAX_ORDINAL,
    REALM_TIERS,
    BREATHS_IN_THE_LOWER_REALM,
    FALSE_IMMORTAL_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    isExpelledFromBelow
} from '../../src/engine/cultivation/realms.js';

describe('what a catastrophe can end', () => {
    it('covers all three tiers and escalates the right way', () => {
        expect(CATASTROPHE_EXPOSURE).toHaveLength(3);
        expect(exposureOf('sect').worstCase).toBe('destroyed');
        expect(exposureOf('court').worstCase).toBe('destroyed');
        // The whole point: an apex loses everything except the person.
        expect(exposureOf('apex').worstCase).toBe('reduced_to_its_head');
        for (const e of CATASTROPHE_EXPOSURE) {
            expect(e.reason.length, `${e.tier} needs a real reason`).toBeGreaterThan(120);
        }
    });

    it('draws the line at the realm where a body stops having a seam', () => {
        const grandAscension = REALM_TIERS.find(t => t.key === 'grand_ascension')!;
        expect(UNTOUCHED_BY_DISASTER_ORDINAL).toBe(grandAscension.ordinalStart);
        expect(couldDieToADisaster(UNTOUCHED_BY_DISASTER_ORDINAL - 1)).toBe(true);
        expect(couldDieToADisaster(UNTOUCHED_BY_DISASTER_ORDINAL)).toBe(false);
    });

    it('puts every apex head above that line, and every court below its own protection', () => {
        for (const apex of APEX_INSTITUTIONS) {
            expect(couldDieToADisaster(apex.powerOrdinal), `${apex.name} head`).toBe(false);
        }
        // A court's seniors walk out; the institution still ends, because the
        // arterial is the thing that moved.
        for (const court of COURTS) {
            expect(couldDieToADisaster(court.powerOrdinal), `${court.name} head`).toBe(false);
        }
        expect(factionsADisasterCouldDestroy().some(f => f.tier === 'court')).toBe(true);
    });

    it('offers war, aid and watching, and charges for all three', () => {
        const responses = DISASTER_RESPONSES.map(r => r.response);
        expect(responses).toEqual(expect.arrayContaining(['war', 'aid', 'watch']));
        for (const r of DISASTER_RESPONSES) {
            expect(r.cost.length, `${r.response} must cost something`).toBeGreaterThan(80);
        }
    });
});

describe('why the head is pinned, which is what the sealed ancestors are about', () => {
    it('ties the head to the object, and says neither half works alone', () => {
        expect(WHY_THE_HEAD_IS_PINNED.theObjectDoesNotTravel).toMatch(/does not travel|sits where/i);
        expect(WHY_THE_HEAD_IS_PINNED.andNeitherHalfWorksAlone).toMatch(/stealable/i);
        expect(WHY_THE_HEAD_IS_PINNED.andNeitherHalfWorksAlone).toMatch(/found, reached and lied to/i);
    });

    it('pins every apex head, whatever else the house has at that realm', () => {
        // The pin is about the object, so it is one person per house however
        // many the house has up there. Counting pins and counting people is
        // not the same thing, and conflating them cost the Azure Cloud
        // Pavilion its second at the last realm in every power reading in the
        // setting - see the note on its lastRealm block.
        for (const apex of APEX_INSTITUTIONS) {
            const lastRealm = (apex as { lastRealm?: { count: number; pinned: boolean } }).lastRealm;
            expect(lastRealm?.pinned, apex.name + ' must be pinned').toBe(true);
            expect(lastRealm?.count ?? 0, apex.name).toBeGreaterThanOrEqual(1);
        }
    });

    it('charges the pinning to the person holding it', () => {
        expect(WHY_THE_HEAD_IS_PINNED.andTheCostIsTheirOwnClimb).toMatch(/stopped climbing/i);
    });
});

describe('how somebody at the top of an apex dies', () => {
    it('is not by disaster, and says so', () => {
        expect(DEATHS_AVAILABLE.whyNotADisaster).toMatch(/nothing unaimed/i);
    });

    it('offers two routes, one of which needs no ancestors at all', () => {
        // The correction that matters: an earlier draft called the conspiracy
        // the only way, which treated a very hard thing as an impossible one.
        expect(DEATHS_AVAILABLE.theFirstRoute).toMatch(/two people of their own realm/i);
        expect(DEATHS_AVAILABLE.theSecondRoute).toMatch(/sealed ancestors/i);
    });

    it('never claims anybody is invincible', () => {
        const text = JSON.stringify(DEATHS_AVAILABLE) + JSON.stringify(OPENLY_OR_IN_SECRET);
        expect(text, 'nobody is invincible').not.toMatch(/cannot be killed at all|invincible|unkillable(?! -)/i);
        expect(DEATHS_AVAILABLE.soItIsMegaHardRatherThanImpossible).toMatch(/not unkillable/i);
        expect(OPENLY_OR_IN_SECRET.soNeitherIsImpossible).toMatch(/[Nn]either route is impossible/);
    });

    it('makes the artifact the reason it is hard, and names all three', () => {
        const a = DEATHS_AVAILABLE.andThenTheArtifact;
        expect(a).toMatch(/Deep Survey/);
        expect(a).toMatch(/Long Cut/);
        expect(a).toMatch(/Azure Cloud/);
        expect(a, 'they are weapons that do not strike').toMatch(/not one of them is a sword/i);
    });

    it('gives enemies a reason to sit in one room: the object is indivisible', () => {
        const why = DEATHS_AVAILABLE.whichIsWhyEnemiesWouldStudyItTogether;
        expect(why).toMatch(/not divisible|cannot be split/i);
        expect(why).toMatch(/studied/i);
    });
});

describe('the conspiracy arithmetic is read off the catalog, not asserted', () => {
    it('takes its ceilings from the sects that actually hold a seal', () => {
        const arithmetic = conspiracyArithmetic();
        const fromCatalog = sectsWithASealedCeiling()
            .map(s => sectThreat(s.id)?.ceiling ?? 0)
            .filter(c => c > 0)
            .sort((a, b) => b - a);
        expect(arithmetic.availableCeilings).toEqual(fromCatalog);
        expect(arithmetic.availableCeilings.length).toBeGreaterThanOrEqual(3);
    });

    it('takes its targets from the real apex institutions', () => {
        const arithmetic = conspiracyArithmetic();
        expect(arithmetic.apexHeads.map(h => h.ordinal).sort())
            .toEqual(APEX_INSTITUTIONS.map(a => a.powerOrdinal).sort());
    });

    it('finds at least one ceiling that outranks an apex head alone', () => {
        const arithmetic = conspiracyArithmetic();
        const weakestHead = Math.min(...arithmetic.apexHeads.map(h => h.ordinal));
        expect(arithmetic.housesThatAloneOutrank(weakestHead)).toBeGreaterThanOrEqual(1);
    });

    it('needs more than one house against the strongest head', () => {
        const arithmetic = conspiracyArithmetic();
        const strongestHead = Math.max(...arithmetic.apexHeads.map(h => h.ordinal));
        // Exactly one house in the world holds a ceiling clear of the top head;
        // everybody else needs a partner, which is what makes it a conspiracy.
        expect(arithmetic.housesThatAloneOutrank(strongestHead)).toBeLessThanOrEqual(1);
        expect(arithmetic.housesNeededAgainst(strongestHead)).toBeGreaterThanOrEqual(1);
    });

    it('lists only houses whose ceiling could matter to an apex at all', () => {
        const weakestHead = Math.min(...APEX_INSTITUTIONS.map(a => a.powerOrdinal));
        for (const house of housesThatCouldJoinAConspiracy()) {
            expect(house.ceiling, `${house.id}`).toBeGreaterThanOrEqual(weakestHead);
        }
    });
});

describe('an alliance is visible, and a warned apex mobilises', () => {
    it('trades surprise against warning, in both directions', () => {
        expect(OPENLY_OR_IN_SECRET.theAllianceIsVisible).toMatch(/harder thing to hide|noticed/i);
        expect(OPENLY_OR_IN_SECRET.soTheApexGetsToMobilise).toMatch(/courts/i);
    });

    it('keeps the client ancestor an ask rather than an order', () => {
        expect(OPENLY_OR_IN_SECRET.theAskThatMayNotBeAnswered).toMatch(/not an order/i);
    });

    it('names the number that points both ways', () => {
        // The strongest ceiling in the region belongs to a client of the apex
        // whose head it outranks. Nothing enforces which way it points.
        const ceilings = conspiracyArithmetic().availableCeilings;
        const strongestHead = Math.max(...APEX_INSTITUTIONS.map(a => a.powerOrdinal));
        expect(Math.max(...ceilings)).toBeGreaterThan(strongestHead);
        expect(OPENLY_OR_IN_SECRET.andTheNumberThatMakesItInteresting).toMatch(/forty-four/);
        expect(OPENLY_OR_IN_SECRET.andTheNumberThatMakesItInteresting).toMatch(/forty-three/);
    });
});

describe('the courts below claim the succession', () => {
    it('has every court claim it, with the same case', () => {
        expect(THE_COURTS_BELOW.theyClaimTheLegitimacy).toMatch(/continuation/i);
        expect(THE_COURTS_BELOW.andTheyAllClaimItAtOnce).toMatch(/more than one/i);
    });

    it('settles it in ledgers rather than in a battle', () => {
        expect(THE_COURTS_BELOW.whatSettlesIt).toMatch(/who honours whose paper/i);
        expect(THE_COURTS_BELOW.whatSettlesIt, 'the losers are not destroyed')
            .toMatch(/not destroyed|simply courts again/i);
    });

    it('lets the artifact end the argument early, which ties it to the killing', () => {
        expect(THE_COURTS_BELOW.andTheArtifactDecidesFaster).toMatch(/cannot use it without announcing/i);
    });

    it('has more than one court under at least one apex, or the claim is trivial', () => {
        const byApex = new Map<string, number>();
        for (const c of COURTS) byApex.set(c.apexId, (byApex.get(c.apexId) ?? 0) + 1);
        expect(Math.max(...byApex.values())).toBeGreaterThanOrEqual(2);
    });
});

describe('the fighting system decides this, not this file', () => {
    it('keeps every artifact in one catalog, ordered by power', () => {
        const powers = ARTIFACTS.map(a => a.power ?? 0);
        expect([...powers].sort((x, y) => y - x), 'ARTIFACTS must stay sorted').toEqual(powers);
        expect(ARTIFACTS.length).toBeGreaterThanOrEqual(10);
    });

    it('puts the strongest and the weakest object in the same table', () => {
        // The design claim, made checkable: no separate immortal tier.
        // Artifacts AND manuals, in one table. The claim is not that every
        // object is the same kind of thing - it is that there is no separate
        // tier for the important ones, so a scattered chaos-grade canon and a
        // notched sabre are rows in the same array, read by the same code.
        const kinds = new Set(ARTIFACTS.map(a => a.kind));
        expect(kinds).toEqual(new Set(['artifact', 'manual']));
        expect(Math.max(...ARTIFACTS.map(a => a.power ?? 0))).toBeGreaterThanOrEqual(44);
        expect(Math.min(...ARTIFACTS.map(a => a.power ?? 0))).toBeLessThanOrEqual(6);
        // And they are ordinary records: an owner, a possessor, a description.
        for (const a of ARTIFACTS) {
            expect(a.description.length, a.name).toBeGreaterThan(80);
            expect(a.claims, a.name).toEqual([]);
        }
    });

    it('arms every apex with an object rather than with a rule', () => {
        for (const apex of APEX_INSTITUTIONS) {
            const sentDown = (apex as { sentDown?: { id: string } }).sentDown;
            expect(sentDown, apex.name).toBeDefined();
            const object = ARTIFACTS.find(a => a.id === sentDown!.id);
            expect(object, `${apex.name}: ${sentDown!.id} must be in ARTIFACTS`).toBeDefined();
            expect(object!.power, object!.name).toBeGreaterThanOrEqual(41);
        }
    });

    it('gives apex heads no special logic in either direction', () => {
        // The rule the user set: they die like anybody else. Nothing in the
        // lore layer may carry an apex-only combat rule, so the helpers that
        // once did must stay gone - including the ones I wrote.
        const source = fs.readFileSync('src/data/cultivation/catastrophe.ts', 'utf8');
        for (const banned of [
            'export function breaksTheMargin',
            'export const MARGIN_ABSORBED',
            'export function assaultWeight',
            'export function assaultRequirement',
            'export function apexStanding',
            'export function whoHoldsRatedPower'
        ]) {
            expect(source, `${banned} is a special case and must not come back`)
                .not.toContain(banned);
        }
        expect(ARTIFACT_MARGIN.absorbs).toMatch(/outcome rather than a rule/i);
    });

    it('leaves an artifact-less head as an ordinary cultivator', () => {
        // Everything a head is worth beyond their own rung is a row in a
        // catalog with an ownerId on it. Change the ownerId and the strength
        // moves; there is no residue anywhere else.
        for (const apex of APEX_INSTITUTIONS) {
            const held = artifactPowerOf(apex.id);
            const named = (apex as { sentDown?: { id: string } }).sentDown!;
            const object = ARTIFACTS.find(a => a.id === named.id)!;
            const ownedByTheApex = held.length > 0 || object.ownerId !== apex.id;
            expect(ownedByTheApex, apex.name).toBe(true);
            expect(apex.powerOrdinal).toBeLessThanOrEqual(MAX_ORDINAL);
        }
    });
});

describe('the stall, which is why two is not the number', () => {
    it('says the head is lasting rather than winning', () => {
        expect(THE_STALL.whatTheHeadIsActuallyDoing).toMatch(/not winning\. lasting/i);
        expect(THE_STALL.soTwoIsNotTheNumber).toMatch(/two is what the weapon eats/i);
    });

    it('makes the reinforcement the courts, and counts them off the catalog', () => {
        const countFor = (name: string) => {
            const apex = APEX_INSTITUTIONS.find(a => a.name === name)!;
            return COURTS.filter(c => c.apexId === apex.id).length;
        };
        // The Third Sill went to the Long Cut, which is why these are not
        // what they were: see WHY_NOBODY_MOVES.andItHasHappenedOnce.
        expect(countFor('The Deep Survey')).toBe(1);
        expect(countFor('The Long Cut')).toBe(2);
        // The Pavilion has a court now: the Azure Mist, which was filed as
        // a feeder for three centuries on a power figure that stopped being
        // true in the second one.
        expect(countFor('The Azure Cloud Pavilion')).toBe(1);
        expect(THE_STALL.andTheAnswerIsSealed).toMatch(/court/i);
    });
});

describe('the shadow conspiracy, which is the only assembly that solves both', () => {
    it('takes courts by appointment rather than by conquest', () => {
        expect(THE_SHADOW_CONSPIRACY.howYouGetACourt).toMatch(/succession/i);
        expect(THE_SHADOW_CONSPIRACY.howYouGetACourt).toMatch(/without an hour of fighting/i);
    });

    it('has the courts arrive on the wrong side, in the target\'s own livery', () => {
        expect(THE_SHADOW_CONSPIRACY.andItBuysTheSealsToo).toMatch(/livery/i);
        expect(THE_SHADOW_CONSPIRACY.andItBuysTheSealsToo).toMatch(/target's own reserve power/i);
    });

    it('keeps a failure mode, so it is a plan rather than a guarantee', () => {
        expect(THE_SHADOW_CONSPIRACY.andTheFailureMode).toMatch(/warned an apex/i);
        expect(THE_SHADOW_CONSPIRACY.andTheFailureMode).toMatch(/record rather than a law/i);
    });

    it('has real courts to suborn, with real officers in them', () => {
        // The plot is appointments, so the appointments have to exist.
        expect(COURTS.length).toBeGreaterThanOrEqual(3);
        for (const court of COURTS) {
            const roster = (court as { roster?: unknown[] }).roster ?? [];
            expect(roster.length, `${court.name} needs officers to place`).toBeGreaterThanOrEqual(3);
        }
    });
});

describe('the Hollow Court could, and does not', () => {
    it('out-holds every apex, and the fact falls straight out of the catalog', () => {
        const hollow = artifactPowerOf('sect-hollow-court');
        expect(hollow).toHaveLength(4);

        for (const apex of APEX_INSTITUTIONS) {
            const named = (apex as { sentDown?: { id: string } }).sentDown!;
            const object = ARTIFACTS.find(a => a.id === named.id)!;
            expect(hollow.length, `vs ${apex.name}`).toBeGreaterThan(1);
            expect(hollow[0], `vs ${object.name}`).toBeGreaterThanOrEqual(object.power ?? 0);
        }

        // Four Seats, not one pinned head - read off the sect's own record.
        const seats = sectThreat('sect-hollow-court')?.withdrawn?.seats ?? [];
        expect(seats).toHaveLength(4);
        expect(Math.max(...seats.map(s => s.ordinal)))
            .toBeGreaterThanOrEqual(Math.max(...APEX_INSTITUTIONS.map(a => a.powerOrdinal)));
    });

    it('has its four carried by people, where the apex objects sit in vaults', () => {
        const held = artifactsOwnedBy('sect-hollow-court');
        expect(held).toHaveLength(4);
        for (const a of held) {
            // A PERSON, named by the id the catalog holds people under - which
            // is what `artifact-placement.ts` joins to a world row, and the
            // whole reason these four reach anybody's hands. A positional key
            // that resolves to nobody reads exactly like this assertion
            // passing, which is why it is the roll that is asked and not the
            // shape of the string.
            const carrier = MEMBERS.find(m => m.id === a.possessorId);
            expect(carrier, `${a.name} is on nobody the roll holds`).toBeDefined();
            expect(carrier!.factionId, `${a.name}`).toBe('sect-hollow-court');
            expect(carrier!.rank, `${a.name}`).toBe('Seat');
            expect(a.tags, a.name).toContain('carried');
        }
        for (const apex of APEX_INSTITUTIONS) {
            const named = (apex as { sentDown?: { id: string } }).sentDown!;
            const object = ARTIFACTS.find(a => a.id === named.id)!;
            expect(object.tags, object.name).toContain('never-carried');
        }
    });

    it('gives disinterest as the reason, not incapacity', () => {
        expect(THE_HOLLOW_COURT_COULD.soWhyHasNobodyDiedOfIt).toMatch(/want nothing an apex has/i);
        expect(THE_HOLLOW_COURT_COULD.whichIsAStrongerDefenceThanTheWeapon)
            .toMatch(/not interested/i);
        // And it must stay playable rather than becoming a law of the setting.
        expect(THE_HOLLOW_COURT_COULD.andIfItEverChanged).toMatch(/playable rather than unthinkable/i);
    });

    it('corrects the count of two rather than contradicting it', () => {
        expect(WHO_HOLDS_A_KEY.theCountAmongTheHouses)
            .toMatch(/among the houses that would ever want to/i);
    });
});

describe('what it costs the people underneath', () => {
    it('starts with paper rather than with violence', () => {
        expect(WHAT_FALLS_ON_THOSE_BELOW.theGrantsGoQuiet).toMatch(/grants stop being honoured/i);
        expect(WHAT_FALLS_ON_THOSE_BELOW.theGrantsGoQuiet)
            .toMatch(/not fall because somebody attacked them/i);
    });

    it('puts the bill on the disciples and says so', () => {
        expect(WHAT_FALLS_ON_THOSE_BELOW.andTheDisciplesPayForIt).toMatch(/first line cut/i);
        expect(WHAT_FALLS_ON_THOSE_BELOW.andTheOnesWhoLeave).toMatch(/rogue cultivators/i);
    });

    it('states the asymmetry: the seniors are fine', () => {
        const text = WHAT_FALLS_ON_THOSE_BELOW.andTheSeniorsAreFine;
        expect(text).toMatch(/the elders walk out/i);
        expect(text).toMatch(/the bill goes down/i);
        // Consistent with the disaster line: above Grand Ascension is safe.
        expect(couldDieToADisaster(UNTOUCHED_BY_DISASTER_ORDINAL)).toBe(false);
    });
});

describe('the revolt, which is the cheapest way to kill an apex', () => {
    it('says the hard part of a conspiracy is the part a revolt does not have', () => {
        expect(THE_REVOLT.whatItIs).toMatch(/no approach march|no concealment problem/i);
        expect(THE_REVOLT.andTheNumbersAreNotClose).toMatch(/ninety-five times in a hundred/i);
    });

    it('answers why it has not happened with an interest rather than a virtue', () => {
        expect(THE_REVOLT.soWhyHasNobodyDoneIt).toMatch(/not loyalty/i);
        expect(THE_REVOLT.whichIsTheRealAnswerToTheApexQuestion)
            .toMatch(/something they would lose/i);
    });

    it('makes the object the deciding factor rather than the rung', () => {
        expect(THE_REVOLT.andTheOneThatWouldNotWork).toMatch(/Ninth Nail/);
        expect(THE_REVOLT.andTheOneThatWouldNotWork).toMatch(/not their rung/i);
    });
});

describe('the deterrent nobody can price', () => {
    it('keeps the retaliation unknowable rather than guaranteed', () => {
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.andItIsNeverACERTAINTY).toMatch(/never a certainty/i);
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.andItIsNeverACERTAINTY).toMatch(/most who cross do not look back/i);
    });

    it('gives everybody a decent idea, which is what makes it work', () => {
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.butPeopleHaveADecentIdea).toMatch(/decent idea is enough/i);
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.butPeopleHaveADecentIdea).toMatch(/nobody publishes a figure/i);
    });

    it('rests it on a claim that is true and can be shown to be', () => {
        const records = SECT_ANCESTRY['sect-azure-cloud-pavilion'];
        expect(records.claimsLivingAncestor, 'the Pavilion claims one').toBe(true);
        expect(records.claimIsTrue, 'and the claim is true').toBe(true);
        const ascended = records.ancestors.find(a => a.fate === 'ascended');
        expect(ascended?.afterCrossing, 'she is still above').toBe('still_above');
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.whichIsWhyTheCLAIMBeingTrueMatters).toMatch(/nobody discounts/i);
    });

    it('states the rule generally rather than about one person', () => {
        // It used to be named for Ru Anjing, which made a rule about anybody
        // who crossed read as a fact about one woman. Any house whose claim to
        // a living ascended ancestor is true holds this, and the catalog has
        // the two fields that decide which houses those are.
        const text = JSON.stringify(THE_ANCESTOR_WHO_MIGHT_ANSWER);
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.theThingNobodyWantsToTest).not.toMatch(/Ru Anjing|Ru Anwei/);
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.andItIsNeverACERTAINTY).not.toMatch(/Ru Anjing|Ru Anwei/);
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.theClearestInstance).toMatch(/Ru Anjing/);
        expect(text).toMatch(/claimsLivingAncestor/);

        // And more than one house claims one, or the rule has no field to key on.
        const claiming = Object.values(SECT_ANCESTRY).filter(r => r.claimsLivingAncestor);
        expect(claiming.length).toBeGreaterThan(1);
        expect(claiming.some(r => !r.claimIsTrue), 'some claims must be false').toBe(true);
    });

    it('files it as the same instrument as a seal, with the uncertainty inverted', () => {
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.andItIsTheSameShapeAsASEAL).toMatch(/uncertainty inverted/i);
    });
});

describe('nothing above the Lid can stay below it', () => {
    it('expels the rung above a False Immortal and not the False Immortal', () => {
        // The entire practical difference between forty-five and forty-six,
        // and the reason the world has False Immortals living in it.
        expect(isExpelledFromBelow(FALSE_IMMORTAL_ORDINAL)).toBe(false);
        expect(isExpelledFromBelow(TRUE_IMMORTAL_ORDINAL)).toBe(true);
        expect(isExpelledFromBelow(FALSE_IMMORTAL_ORDINAL - 1)).toBe(false);
    });

    it('measures the visit in breaths rather than in days', () => {
        expect(BREATHS_IN_THE_LOWER_REALM.min).toBe(10);
        expect(BREATHS_IN_THE_LOWER_REALM.max).toBe(15);
        expect(BREATHS_IN_THE_LOWER_REALM.min).toBeLessThan(BREATHS_IN_THE_LOWER_REALM.max);
    });

    it('makes the largest threat an answer rather than a conquest', () => {
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.andItLastsFifteenBreaths)
            .toMatch(/ten to fifteen breaths/i);
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.andItLastsFifteenBreaths)
            .toMatch(/takes what you are carrying with it/i);
        expect(THE_ANCESTOR_WHO_MIGHT_ANSWER.soItIsAnANSWERAndNotAConquest)
            .toMatch(/cannot be turned into an empire/i);
    });
});
