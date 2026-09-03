/**
 * The three axes of a house's answer, and the decisions in it that live only as
 * numbers.
 *
 * WHAT IS PINNED HERE AND WHY IT HAS TO BE
 * ----------------------------------------
 * Three of these are design rulings that would otherwise exist as a constant
 * nobody reads twice, which AGENTS.md is explicit about:
 *
 *   THE TERM OF YEARS      10 / 30 / 60, read off what the deed was worth and
 *                          never off who caught you. A term of years is a
 *                          number, and a number is what gets silently retuned.
 *   THE CALIBRATION        A Core Formation cultivator who offends a Void
 *                          Refinement elder is worth answering; a Qi
 *                          Condensation nobody is not. That is the owner's own
 *                          example, and it lands on the existing REGARD_BANDS
 *                          windows rather than on anything chosen here - so a
 *                          change to those windows should fail HERE, loudly.
 *   ALIGNMENT IS NOT A     Righteous, neutral and demonic differ in the KIND of
 *   SEVERITY DIAL          answer and in what the years are for. They must not
 *                          differ in how heavy it is.
 */

import { describe, expect, it } from 'vitest';

import {
    AGAINST_THEIR_OWN,
    ifCaughtAtSomethingTheHousePunishes,
    isYourOwnHouseHoldingIt,
    whatYourOwnHouseOpensAboutYou,
    bandAfterWorth,
    canTheyBeMadeToPayForActing,
    hasSomethingToLose,
    theStructureTheyHave,
    whatTheHouseDoesAboutIt,
    whatTheHouseTakes,
    whetherYouAreWorthTheTrouble,
    type Backing
} from '../../../src/engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import {
    WHAT_THE_END_OF_A_TERM_LEAVES,
    WHY_AN_INDENTURE_IS_TAKEN,
    YEARS_OF_A_TERM,
    isHeldWithoutEnd,
    termOfYearsFor
} from '../../../src/data/cultivation/what-an-indenture-is-and-what-happens-when-it-ends.js';
import { getWoundType } from '../../../src/data/cultivation/wounds.js';
import {
    whatADeedLeaves,
    type Deed,
    type Party
} from '../../../src/engine/social-leverage/what-a-deed-leaves.js';
import type { KnowingStage } from '../../../src/engine/social/discovery.js';
import type { SectAlignment } from '../../../src/schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────

const QI_CONDENSATION = 5;
const CORE_FORMATION = 18;
const VOID_REFINEMENT = 30;

function party(over: Partial<Party> & { id: string; name: string }): Party {
    return {
        houseId: null,
        houseName: null,
        alignment: null,
        ranked: false,
        ...over
    };
}

function aDeed(over: Partial<Deed> = {}): Deed {
    return {
        cause: 'robbery',
        paidBy: 'subject',
        // A real cost and it does not come back: two steps, which is `grave`.
        cost: 0.5,
        irreversible: true,
        onDay: 1000,
        description: 'They took it and it is not coming back.',
        ...over
    };
}

function placed(...ids: string[]): ReadonlyMap<string, KnowingStage> {
    return new Map(ids.map(id => [id, 'placed' as KnowingStage]));
}

function catchThem(over: {
    alignment?: SectAlignment | null;
    backing?: Backing;
    theirOrdinal?: number;
    yourOrdinal?: number;
    worth?: Parameters<typeof whetherYouAreWorthTheTrouble>[0]['worth'];
    stages?: ReadonlyMap<string, KnowingStage>;
    answeringHouseId?: string | null;
    hasStoppedCaring?: boolean;
    deed?: Deed;
} = {}) {
    const houseId = over.answeringHouseId === undefined ? 'sect-a' : over.answeringHouseId;
    return whatTheHouseDoesAboutIt({
        deed: over.deed ?? aDeed(),
        offender: party({ id: 'them', name: 'Shen Yue' }),
        answering: {
            ...party({
                id: 'elder',
                name: 'Elder Ruan',
                houseId,
                houseName: 'the Kang Hall',
                alignment: over.alignment === undefined ? 'neutral' : over.alignment,
                ranked: true
            }),
            houseId,
            ...(over.hasStoppedCaring === undefined ? {} : { hasStoppedCaring: over.hasStoppedCaring })
        },
        backing: over.backing ?? 'none',
        stages: over.stages ?? placed('elder'),
        theirOrdinal: over.theirOrdinal ?? VOID_REFINEMENT,
        yourOrdinal: over.yourOrdinal ?? CORE_FORMATION,
        ...(over.worth ? { worth: over.worth } : {}),
        onDay: 1000
    });
}

// ─────────────────────────────────────────────────────────────────────────

describe('the gate is being able to point at somebody', () => {
    it('answers nothing at all when nobody has reached placed', () => {
        const answer = catchThem({ stages: new Map([['elder', 'named' as KnowingStage]]) });
        expect(answer.knownTo).toHaveLength(0);
        expect(answer.takes).toBe('nothing');
        expect(answer.indenture).toBeNull();
        expect(answer.cripples).toBeNull();
    });

    it('is not a witness system: a stage the caller supplies is the whole of it', () => {
        // `named` is knowing the thing happened with no name attached, and
        // `placed` is the rung where a name arrives. One step, and the whole
        // difference between deniable and answerable.
        expect(catchThem({ stages: new Map([['elder', 'named' as KnowingStage]]) }).takes)
            .toBe('nothing');
        expect(catchThem({ stages: placed('elder') }).takes).not.toBe('nothing');
    });
});

describe('axis 1 - whether the offended party can be made to pay for acting', () => {
    it('sends a complaint over your head when acting would cost them', () => {
        const answer = catchThem({ backing: 'backed' });
        expect(answer.acting).toBe('it_goes_to_your_house');
        expect(answer.reach).toBe('answerable');
        // Nothing lands on the person. That is the point of it.
        expect(answer.cripples).toBeNull();
        expect(answer.indenture).toBeNull();
    });

    it('lets somebody with nothing to lose act, whatever backs the offender', () => {
        const rogue = catchThem({ backing: 'backed', answeringHouseId: null });
        expect(rogue.acting).toBe('they_can_act');
        expect(rogue.reach).toBe('unbacked');
    });

    it('reads somebody who has stopped caring as a rogue would be read', () => {
        // The dangerous case: they are on a roll, so they read as backed right
        // up until they act.
        const answer = catchThem({ backing: 'backed', hasStoppedCaring: true });
        expect(answer.acting).toBe('they_can_act');
        expect(hasSomethingToLose({ houseId: 'sect-a', hasStoppedCaring: true })).toBe(false);
    });

    it('is worth nothing to be backed against somebody who has nothing', () => {
        const amongInstitutions = canTheyBeMadeToPayForActing({
            aggrieved: { houseId: 'sect-b' },
            backing: 'backed'
        });
        const onAnEmptyRoad = canTheyBeMadeToPayForActing({
            aggrieved: { houseId: null },
            backing: 'backed'
        });
        expect(amongInstitutions).toBe('it_goes_to_your_house');
        expect(onAnEmptyRoad).toBe('they_can_act');
    });

    it('gives an unclaimable attachment the worst of both', () => {
        // Visible enough to be worth a reprisal, unbacked enough to receive it.
        expect(canTheyBeMadeToPayForActing({
            aggrieved: { houseId: 'sect-b' },
            backing: 'unclaimable'
        })).toBe('they_can_act');
    });
});

describe("axis 2 - the owner's calibration, read off the existing bands", () => {
    it('answers a Core Formation offender and not a Qi Condensation one', () => {
        expect(whetherYouAreWorthTheTrouble({
            theirOrdinal: VOID_REFINEMENT,
            yourOrdinal: CORE_FORMATION
        })).toBe('worth_mounting');
        expect(whetherYouAreWorthTheTrouble({
            theirOrdinal: VOID_REFINEMENT,
            yourOrdinal: QI_CONDENSATION
        })).toBe('beneath_notice');
    });

    it('reads being beneath notice as contempt, and says nothing was mounted', () => {
        const answer = catchThem({ yourOrdinal: QI_CONDENSATION });
        expect(answer.bother).toBe('beneath_notice');
        expect(answer.takes).toBe('nothing');
        expect(answer.line).toContain('not worth the rice');
        // And it must not read as leniency.
        expect(answer.line).toContain('not mercy');
    });

    it('lifts somebody worth looking at, and never past matched', () => {
        expect(whetherYouAreWorthTheTrouble({
            theirOrdinal: VOID_REFINEMENT,
            yourOrdinal: QI_CONDENSATION,
            worth: { promising: true }
        })).toBe('worth_mounting');
        // Worth does not make somebody standing above the house smaller.
        expect(bandAfterWorth('unreachable', 3)).toBe('unreachable');
        expect(bandAfterWorth('overmatched', 3)).toBe('overmatched');
        expect(bandAfterWorth('dismissed', 1)).toBe('beneath');
        expect(bandAfterWorth('dismissed', 9)).toBe('matched');
    });

    it('mounts nothing against somebody standing above the house', () => {
        const answer = catchThem({ theirOrdinal: CORE_FORMATION, yourOrdinal: VOID_REFINEMENT });
        expect(answer.bother).toBe('beyond_them');
        expect(answer.takes).toBe('nothing');
    });
});

describe('axis 3 - alignment decides the kind and never the severity', () => {
    const forEachAlignment = (['righteous', 'neutral', 'demonic'] as const).map(alignment =>
        catchThem({ alignment, worth: { promising: true } })
    );

    it('gives every house the same weight for the same deed', () => {
        const weights = new Set(forEachAlignment.map(a => a.weight));
        expect(weights.size).toBe(1);
        expect([...weights][0]).toBe('grave');
    });

    it('takes somebody at every alignment, because every house has a reason', () => {
        for (const answer of forEachAlignment) {
            expect(answer.takes).toBe('the years');
            expect(answer.indenture).not.toBeNull();
        }
    });

    it('gives three genuinely different reasons that cannot be swapped', () => {
        const reasons = Object.values(WHY_AN_INDENTURE_IS_TAKEN).map(r => r.whatTheYearsAreFor);
        expect(new Set(reasons).size).toBe(3);
        expect(WHY_AN_INDENTURE_IS_TAKEN.righteous.whatTheYearsAreFor).toContain('right');
        expect(WHY_AN_INDENTURE_IS_TAKEN.neutral.whatTheYearsAreFor).toContain('cost');
    });

    it('states a term at two of the three, and no term is not a heavier term', () => {
        expect(isHeldWithoutEnd('righteous')).toBe(false);
        expect(isHeldWithoutEnd('neutral')).toBe(false);
        expect(isHeldWithoutEnd('demonic')).toBe(true);
        // The righteous term is not shorter than the neutral one. If a future
        // edit makes alignment shorten or lengthen a term, this is the guard.
        expect(termOfYearsFor('righteous', 'grave')).toBe(termOfYearsFor('neutral', 'grave'));
    });
});

describe('the term of years, which is a decision that lives only as a number', () => {
    it('is 10, 30 and 60, read off what the deed was worth', () => {
        expect(YEARS_OF_A_TERM.slight).toBeNull();
        expect(YEARS_OF_A_TERM.serious).toBe(10);
        expect(YEARS_OF_A_TERM.grave).toBe(30);
        expect(YEARS_OF_A_TERM.unforgivable).toBe(60);
    });

    it('takes nobody over a slight, because feeding them would cost more', () => {
        // A cheap, reversible, unpromised deed weighs `slight`.
        const petty = aDeed({ cost: 0.05, irreversible: false });
        const answer = catchThem({ deed: petty, worth: { promising: true } });
        expect(answer.weight).toBe('slight');
        expect(answer.takes).not.toBe('the years');
    });

    it('writes the due day off the term and leaves it open where there is none', () => {
        const held = catchThem({ alignment: 'neutral', worth: { promising: true } });
        expect(held.indenture?.termYears).toBe(30);
        expect(held.indenture?.dueOnDay).toBeGreaterThan(1000);
        const open = catchThem({ alignment: 'demonic', worth: { promising: true } });
        expect(open.indenture?.termYears).toBeNull();
        expect(open.indenture?.dueOnDay).toBeNull();
    });
});

describe('the indenture is the contract shape the ledger already has', () => {
    const answer = catchThem({ worth: { promising: true } });

    it('is an oath with cause service_term, held by the person bound', () => {
        const oath = answer.indenture!.oath;
        expect(oath.kind).toBe('oath');
        expect(oath.cause).toBe('service_term');
        expect(oath.holderId).toBe('them');
        expect(oath.subjectId).toBe('sect-a');
        // As heavy as what it is answering, or walking out would be the cheap move.
        expect(oath.severity).toBe(answer.weight);
    });

    it('names a witness, which is what makes the contract bind anybody', () => {
        expect(answer.indenture!.witnessFactionId).toBe('house-bound-word');
    });

    it('has no premier witness for the one house the oathwright refuses', () => {
        const severed = catchThem({
            answeringHouseId: 'sect-the-severed',
            alignment: 'demonic',
            worth: { promising: true }
        });
        expect(severed.indenture!.witnessFactionId).toBeNull();
        expect(severed.indenture!.oath.tags).toContain('unwitnessed_by_the_oathwright');
    });

    it('says the difference from a servant is not the work', () => {
        expect(answer.indenture!.oath.terms).toContain('a servant chose it and may leave');
        expect(answer.indenture!.oath.terms).toContain('below every floor');
    });

    it('answers what the day it ends leaves, rather than leaving it open', () => {
        expect(WHAT_THE_END_OF_A_TERM_LEAVES.standing).toContain('not a rank');
        expect(WHAT_THE_END_OF_A_TERM_LEAVES.whetherAnybodyTakesThem)
            .toContain('servant bar');
        expect(WHAT_THE_END_OF_A_TERM_LEAVES.theRecord).toContain('closed');
    });
});

describe('the crippling is the state that already exists', () => {
    it('takes the structure of the offender own realm, and it is a real row', () => {
        const answer = catchThem({ worth: { wouldBeMissed: true } });
        expect(answer.takes).toBe('the capability');
        const wound = getWoundType(answer.cripples!.woundKey);
        expect(wound).not.toBeNull();
        expect(wound!.permanent).toBe(true);
        expect(wound!.severities).toContain('crippling');
        // Core Formation, so it is the core that will not open again.
        expect(answer.cripples!.woundKey).toBe('cracked-core');
    });

    it('derives one status per realm from the crossing behind them', () => {
        expect(theStructureTheyHave(QI_CONDENSATION)).toBeNull();
        expect(theStructureTheyHave(14)).toBe('broken-foundation');
        expect(theStructureTheyHave(CORE_FORMATION)).toBe('cracked-core');
        expect(theStructureTheyHave(22)).toBe('crippled-nascent-soul');
        expect(theStructureTheyHave(VOID_REFINEMENT)).toBe('partial-refinement');
    });

    it('takes nothing off somebody who built nothing', () => {
        // The owner's rule: removing the cultivation of a Qi Condensation
        // cultivator gains a house nothing, because there was nothing there.
        expect(whatTheHouseTakes({
            weight: 'grave',
            yourOrdinal: QI_CONDENSATION,
            worth: { wouldBeMissed: true }
        })).toBe('nothing');
    });

    it('falls to the capability where the answering party has no house to hold a term', () => {
        const loneElder = catchThem({ answeringHouseId: null, worth: { promising: true } });
        expect(loneElder.takes).toBe('the capability');
        expect(loneElder.indenture).toBeNull();
    });
});

describe('a reprisal is a deed, and the loop closes with no rule for it', () => {
    it('prices the reprisal through the same scoring function', () => {
        const answer = catchThem({ worth: { wouldBeMissed: true } });
        const reprisal = answer.theReprisalAsADeed!;
        expect(reprisal.paidBy).toBe('subject');
        expect(reprisal.irreversible).toBe(true);

        const leaves = whatADeedLeaves({
            deed: { ...reprisal, knownTo: ['them'] },
            actor: party({ id: 'elder', name: 'Elder Ruan', houseId: 'sect-a', houseName: 'the Kang Hall', alignment: 'neutral', ranked: true }),
            subject: party({ id: 'them', name: 'Shen Yue' })
        });
        // The person it was done to holds a record about the house afterwards.
        expect(leaves.opens[0].holderId).toBe('them');
        expect(leaves.opens[0].subjectId).toBe('elder');
    });
});

describe('a house catching one of its own', () => {
    it('is the same switch ifCaughtPractising always ran', () => {
        expect(ifCaughtAtSomethingTheHousePunishes({
            theirsToPunish: true, alignment: 'demonic'
        })).toBe('killed');
        expect(ifCaughtAtSomethingTheHousePunishes({
            theirsToPunish: true, alignment: 'righteous'
        })).toBe('questioned_about_the_source');
        expect(ifCaughtAtSomethingTheHousePunishes({
            theirsToPunish: true, alignment: 'neutral'
        })).toBe('priced');
    });

    it('punishes nothing the house has no claim on, whatever it thinks of you', () => {
        expect(ifCaughtAtSomethingTheHousePunishes({
            theirsToPunish: false, alignment: 'demonic'
        })).toBe('nothing');
    });

    it('does NOT let a demonic house shrug at what was done to one of its own', () => {
        // The design owner: a demonic sect punishes you anyway, because you did
        // it to one of theirs. Demonic is a position about who you may hurt
        // OUTSIDE the house; it has never meant the house is lawless inside.
        const demonic = ifCaughtAtSomethingTheHousePunishes({
            theirsToPunish: true, alignment: 'demonic'
        });
        const righteous = ifCaughtAtSomethingTheHousePunishes({
            theirsToPunish: true, alignment: 'righteous'
        });
        expect(demonic).toBe('killed');
        // Less forgiving, not more.
        expect(demonic).not.toBe(righteous);
        expect(demonic).not.toBe('nothing');
    });

    it('opens the record with the house as holder and the member as subject', () => {
        const row = whatYourOwnHouseOpensAboutYou({
            houseId: 'sect-somewhere',
            memberId: 'their-own-member',
            cause: 'betrayal',
            severity: 'unforgivable',
            onDay: 40,
            description: 'They arranged the death of somebody on this roll.',
            doing: 'killed'
        });
        expect(row).not.toBeNull();
        // The party with a claim on you is the party you serve.
        expect(row!.holderId).toBe('sect-somewhere');
        expect(row!.subjectId).toBe('their-own-member');
        expect(isYourOwnHouseHoldingIt(row!)).toBe(true);
    });

    it('reads differently from an ordinary grudge at a glance', () => {
        const own = whatYourOwnHouseOpensAboutYou({
            houseId: 'sect-somewhere', memberId: 'them', cause: 'betrayal',
            severity: 'grave', onDay: 1, description: 'x', doing: 'priced'
        });
        expect(own!.tags).toContain(AGAINST_THEIR_OWN);
        expect(isYourOwnHouseHoldingIt({ tags: ['ordinary'] })).toBe(false);
    });

    it('opens nothing where the house has no claim - disapproval is not a record', () => {
        expect(whatYourOwnHouseOpensAboutYou({
            houseId: 'h', memberId: 'm', cause: 'betrayal', severity: 'grave',
            onDay: 1, description: 'x', doing: 'nothing'
        })).toBeNull();
    });
});
