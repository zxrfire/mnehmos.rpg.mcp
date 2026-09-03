/**
 * An art that cannot be practised alone, and what it does to everybody in it.
 *
 * `requiresPeople` and `runsOn` are the two fields that say what such an art
 * is, and between them they carve out the two roads this file resolves:
 *
 *     runsOn: 'the_others'    a DRAIN. One person draws, and the others supply
 *                             the qi and gain nothing. The genre's furnace.
 *     runsOn: 'everyone'      a PARTNERSHIP. Everybody in the room supplies it
 *                             and everybody in the room gains.
 *
 * **`requiresPeople` is a COUNT, and nothing here is written for two.** A rite
 * worked on four is the same statement as a rite worked on one with a different
 * number in it: {@link FurnaceUseInput.subjects} is a list, every draw is per
 * person, and a pair is a list of length one rather than a case with its own
 * code path. The moment a two-branch appears here, the count has stopped being
 * a count.
 *
 * Both live here rather than in two files, because they share the one
 * eligibility test and because the contrast is the design: a reader who finds
 * the drain has to find the alternative in the same place, or the category
 * reads as though the drain were all it was for. A count and a fuel rather
 * than a boolean naming a trope - see `TechniqueSchema.requiresPeople` and
 * `.runsOn` - so an array worked by nine is the same statement with a
 * different number in it and needs no new axis.
 *
 * ── WHO AN ART OF THIS KIND CAN WORK BETWEEN ────────────────────────────
 *
 * `requiresPeople` says how many, and the CATEGORY says whether it matters who.
 * The two are separate axes and the separation is load-bearing: an art of
 * `category: 'dual_cultivation'` works only between two people of different sex,
 * and a two-person art in any other category has no such requirement and must
 * not acquire one - a paired sword form worked by two disciples is
 * `requiresPeople: 2` under `attack`, and nothing here is asked about it. So
 * `worksBetween` below is consulted for the `dual_cultivation` arts and for
 * nothing else.
 *
 * For those, the sex requirement is not a preference but a mechanism: the art
 * moves qi through a difference that two people of the same sex do not have
 * between them.
 * `canBeTheTwoParentsOf` in
 * `engine/birth/what-sex-somebody-is-and-what-it-is-for.ts` asks the identical
 * structural question for parentage, so {@link worksBetween} is that function
 * under this file's own name rather than a second copy of it. One test read by
 * two callers is the whole of the design: nothing here invents a rule about
 * who may pair with whom, and nothing here is a gender model - see that file's
 * own header for why the distinction is enforced.
 *
 * "Furnace" (or "cauldron") is the genre's own word for the drained side and
 * is kept rather than softened. It names the ROLE and not a person's standing
 * anywhere else, and there is no `deniable` flag on it and there must not be
 * one: a house that teaches the rite knows exactly what it teaches, so the
 * wrong is institutional rather than a secret kept from the house that profits
 * by it. What stays hidden, when it does, is from the OUTSIDE - the subject's
 * own house, the ground it happened on - and that is ordinary witness-based
 * concealment, the same as any other deed.
 *
 * ── WHETHER ANYBODY AGREED IS NOT DECIDED HERE ──────────────────────────
 *
 * Whether the subject agreed, or was forced and could not stop it, is settled
 * before {@link useAFurnaceTechnique} is called - by ordinary agreement between
 * two players, or by a combat resolution that ended in `goal: 'coerce'`
 * reaching `submission` (`engine/cultivation/combat.ts`). That module owns "was
 * somebody made to" and there must not be a second answer to it living here.
 * {@link FurnaceUseInput.type} is a report of what already happened,
 * not a roll - and `sameHouse` and `married` on
 * {@link DaoPartnershipInput} are reported for the same reason.
 *
 * What this file adds on top of a settled `submission` is what nothing else
 * owns: whether the art could work between these two bodies at all, whether it
 * took, and - because a forced use is a wrong done to a person and not merely
 * a technique that fired - the grudge that opens because of it. The grudge is
 * written with `createGrudge`'s existing `'violated'` cause and
 * `'unforgivable'` severity, exactly as any other grave wrong to somebody's
 * person is, and once it is on the ledger the ordinary inheritance machinery in
 * `lineage.ts` and `grudges.ts` (`inheritLedgerOnDeath`) carries it past the
 * act itself: a child born of it and later recognised as an heir inherits the
 * account the same way any heir inherits any open grudge. The trope rides the
 * mechanism that already exists for exactly this reason rather than a second
 * one built beside it.
 *
 * ── CONCEPTION, AND WHAT IT DELIBERATELY DOES NOT DO ────────────────────
 *
 * `conceived` is a single roll on a caller-owned stream, matching
 * `rollSpiritRoot`'s convention: the caller passes a `[0,1)` sample rather
 * than an RNG, so this function stays pure and testable at the seed. It does
 * not create a person, a `Birth` record, or a `LineageEdge` - those are the
 * existing birth and lineage layers' jobs, and a child conceived here is
 * conceived exactly as any other child in this world is: as a fact the caller
 * carries forward into `birth.ts` and `lineage.ts` on its own timeline. What
 * this file hands back is only the one bit those layers need to know to start -
 * that this act, between the actor and this person, on this day, is where it
 * began - and {@link DaoPartnershipResult.insight} is handed back on the same contract
 * for the same reason.
 */

import type { Sex } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import { canBeTheTwoParentsOf } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
// The road already walked, and how close another one is to it. Imported
// rather than compared by hand: `daoDistance` is where this world has already
// ruled on whether two people are on one road, and a second answer to that
// living here is exactly the defect `worksBetween` avoids for sex.
import { type DaoAssessment, daoDistance } from '../cultivation/dao.js';
import type { InsightDomain } from '../../schema/cultivation.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationInput } from '../social/grudges.js';

/**
 * Whether a furnace technique could work between two people, on sex alone.
 *
 * Deliberately `canBeTheTwoParentsOf` and not a reimplementation of it: the
 * two questions - "could this art move between them" and "could a child of
 * theirs be of both their blood" - are the same structural fact about a pair,
 * and giving them separate answers would be two sources of truth for one
 * thing this world has already ruled on once.
 */
export const worksBetween: (a: Sex, b: Sex) => boolean = canBeTheTwoParentsOf;

/**
 * What kind of use this was. Reported, not rolled - see the header.
 *
 * `offered` covers any use everybody agreed to, whatever each of them wanted
 * out of it. `coerced` is used only once a `submission` has been reached
 * elsewhere; nothing here checks that it was.
 *
 * Named for the KIND of thing that happened rather than for whether somebody
 * agreed: the genre's word for this is a furnace, and a house that teaches the
 * rite is choosing between two rites, not filling in a form.
 */
export type FurnaceUseType = 'offered' | 'coerced';

/** The one drawing. */
export interface TheOneDrawing {
    personId: string;
    name: string;
    sex: Sex;
}

/**
 * One person being drawn off, with the two draws that belong to them.
 *
 * The samples are per PERSON rather than per use, because each of them is a
 * separate body: two furnaces in one rite conceive or die independently, and
 * one shared sample would make them a single coin flip wearing two names.
 */
export interface OneBeingDrawnOff {
    personId: string;
    name: string;
    sex: Sex;
    /**
     * `[0,1)`. Caller-owned stream, matching `rollSpiritRoot`'s convention -
     * give conception its own named draw so it never shifts anything else
     * pulling from the same generator.
     */
    conceptionSample: number;
    /**
     * `[0,1)`. Its own named draw, exactly as `conceptionSample` is - read
     * only when the use is `coerced`, so a caller resolving a willing use may
     * pass any finite number and it is never touched.
     */
    deathSample: number;
}

/**
 * One actor, and everybody the rite is worked on.
 *
 * `subjects` is a list because `requiresPeople` is a COUNT: an art worked by
 * nine is the same statement as an art worked by two with a different number
 * in it, and the header says so. A two-person rite is a one-element list and
 * behaves exactly as it did.
 */
export interface FurnaceUseInput {
    actor: TheOneDrawing;
    subjects: readonly OneBeingDrawnOff[];
    onDay: DayIndex;
    type: FurnaceUseType;
}

/**
 * Base chance a single use conceives, once the art has actually worked.
 *
 * One number, read once, here. A cultivator's own fertility, technique
 * mastery, or anything else that might someday shade this is a future input
 * to this same constant's position, not a second place the odds are computed.
 */
export const FURNACE_CONCEPTION_CHANCE = 0.15;

/**
 * What the actor draws off the subject on a willing use, in days of the
 * ACTOR's own cultivation rate - the unit `accrueProgress`
 * (`engine/cultivation/cultivation.ts`) already takes.
 *
 * A furnace technique is a DRAIN, not a shared practice - see the header. The
 * subject loses the same figure off their own rate; the willing case is
 * willing about who is spent, not about the amount. Large, because the
 * genre's own furnace disciple exists to make somebody else's breakthrough
 * cheap, and a boost too small to matter would not be why anybody agrees to
 * be one.
 */
export const FURNACE_DAYS_STOLEN_WILLING = 60;

/**
 * What the actor draws off a coerced use. More than the willing figure -
 * nothing is being managed for the furnace's sake once consent is gone, so
 * the draw runs to what the actor can take rather than to what the subject
 * can sustain. `meridian-devouring-art`'s premise, run through a different
 * channel, and the reason the Crimson Abyss Hall teaches this rather than
 * merely tolerating it: the tithe is real and it is the reason the rite
 * exists.
 */
export const FURNACE_DAYS_STOLEN_COERCED = 150;

/**
 * Chance a coerced draw kills the furnace outright, once it has happened.
 *
 * Never rolled on a willing use: an actor who wants to use the same furnace
 * twice has a reason to keep them alive that a coerced use does not supply.
 * One number, read once, here - see {@link FURNACE_CONCEPTION_CHANCE}'s own
 * comment for why a single constant is the right size for this.
 */
export const FURNACE_COERCED_DEATH_CHANCE = 0.1;

/** What the rite did to one of the people it was worked on. */
export interface WhatItDidToOneOfThem {
    personId: string;
    name: string;
    /** False when the art cannot work between this person and the actor. */
    eligible: boolean;
    /** Rolled only where `eligible`. */
    conceived: boolean;
    /** Always false on a willing use - see {@link FURNACE_COERCED_DEATH_CHANCE}. */
    died: boolean;
}

export interface FurnaceUseResult {
    /** True when the art answers between the actor and at least one subject. */
    eligible: boolean;
    /** True when the art fired on anybody. False whenever `eligible` is false. */
    happened: boolean;
    /**
     * One row per subject, in the order they were given, INCLUDING the ones
     * the art could not work on.
     *
     * A caller resolving a two-person rite reads `each[0]`. A caller resolving
     * nine reads nine rows, and the ones it could not work on are present and
     * say so rather than being silently absent - a missing row and a refused
     * one are different facts, and a list that drops the refusals cannot be
     * counted against the list that was handed in.
     */
    each: readonly WhatItDidToOneOfThem[];
    /**
     * Total days of cultivation this use moves, at the ACTOR's own rate,
     * summed over everybody it worked on.
     *
     * The caller adds this to the actor and subtracts each subject's own share
     * from that subject - which is `daysStolen / the number it worked on`, and
     * is why `each` carries the eligibility: the divisor is the people it
     * actually drew from, not the people who were standing there.
     */
    daysStolen: number;
    /**
     * The grudges this use opens, one per coerced subject it worked on.
     *
     * Empty on a willing use. The caller writes them to each subject's
     * obligation ledger; nothing here touches state. Still written for
     * somebody who died - a killing is exactly the case `grudges.ts`'
     * inheritance machinery exists for, and the account simply opens with
     * nobody left alive to hold it in person.
     */
    grudges: readonly ObligationInput[];
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Work a furnace technique, on however many people it takes.
 *
 * Pure: the people and a day in, a decision out. The caller is the one holding
 * the world - it writes the grudges, applies `daysStolen` to the actor and its
 * share to each subject, runs the death pipeline for anybody who `died`, and
 * decides what a `conceived` becomes in `birth.ts` and `lineage.ts`.
 */
export function useAFurnaceTechnique(input: FurnaceUseInput): FurnaceUseResult {
    const coerced = input.type === 'coerced';

    // Eligibility is PER PERSON, because the art answers between the actor and
    // each of them separately. A rite worked on four where it answers between
    // three of them is three-quarters of a rite, not a refusal: the alternative
    // is that one ineligible body in a circle silently voids the whole thing,
    // which is a rule nobody wrote and nobody could see.
    const each: WhatItDidToOneOfThem[] = input.subjects.map(who => {
        const eligible = worksBetween(input.actor.sex, who.sex);
        const died = eligible && coerced && who.deathSample < FURNACE_COERCED_DEATH_CHANCE;
        return {
            personId: who.personId,
            name: who.name,
            eligible,
            // Somebody who did not survive the draw was not left carrying
            // anything. Conception is a fact about a body that lived past it.
            conceived: eligible && !died && who.conceptionSample < FURNACE_CONCEPTION_CHANCE,
            died
        };
    });

    const worked = each.filter(row => row.eligible);
    const perPerson = coerced ? FURNACE_DAYS_STOLEN_COERCED : FURNACE_DAYS_STOLEN_WILLING;

    if (worked.length === 0) {
        return {
            eligible: false,
            happened: false,
            each,
            daysStolen: 0,
            grudges: [],
            line: input.subjects.length === 1
                ? 'The art does not answer between the two of them. Nothing happened.'
                : 'The art answers between the actor and none of them. Nothing happened.'
        };
    }

    const grudges: ObligationInput[] = coerced
        ? worked.map(row => ({
            kind: 'grudge' as const,
            holderId: row.personId,
            subjectId: input.actor.personId,
            cause: 'violated' as const,
            severity: 'unforgivable' as const,
            onDay: input.onDay,
            description: row.died
                ? `${input.actor.name} used ${row.name} as a furnace by force, and it killed them.`
                : `${input.actor.name} used ${row.name} as a furnace by force.`,
            participants: [input.actor.personId, row.personId],
            tags: ['furnace', 'coerced', ...(row.died ? ['killed'] : [])]
        }))
        : [];

    return {
        eligible: true,
        happened: true,
        each,
        daysStolen: perPerson * worked.length,
        grudges,
        line: theLineFor(input, worked)
    };
}

/**
 * One sentence of engine truth about a rite worked on any number of people.
 *
 * Split out because the two-person wording is the one a reader meets almost
 * always and it must not read like a report about a list. One subject gets a
 * sentence about a person; more than one gets a sentence about a count.
 */
function theLineFor(
    input: FurnaceUseInput,
    worked: readonly WhatItDidToOneOfThem[]
): string {
    const dead = worked.filter(row => row.died).length;
    const took = worked.filter(row => row.conceived).length;
    const forced = input.type === 'coerced';

    if (worked.length === 1) {
        const who = worked[0];
        if (!forced) {
            return who.conceived
                ? `${who.name} was the furnace, willingly, and it took.`
                : `${who.name} was the furnace, willingly.`;
        }
        if (who.died) return `${input.actor.name} forced it on ${who.name}, and it killed them.`;
        return who.conceived
            ? `${input.actor.name} forced it on ${who.name}, and it took.`
            : `${input.actor.name} forced it on ${who.name}.`;
    }

    const many = `${worked.length} of them`;
    if (!forced) {
        return took === 0
            ? `${many} were the furnace, willingly.`
            : `${many} were the furnace, willingly, and it took on ${took}.`;
    }
    const killed = dead === 0 ? '' : ` It killed ${dead}.`;
    const conceived = took === 0 ? '' : ` It took on ${took}.`;
    return `${input.actor.name} forced it on ${many}.${killed}${conceived}`;
}


// ─────────────────────────────────────────────────────────────────────────
// THE OTHER ROAD: A DAO PARTNER
// ─────────────────────────────────────────────────────────────────────────

/**
 * A dual-cultivation art that `runsOn: 'everyone'` is not a drain at all. It is
 * the mechanical half of a dao partnership, and a dao partnership is a narrow
 * thing that this world already has every part of:
 *
 *     the same house      somebody on your own roll, so the two of you are
 *                         actually in the same rooms year after year
 *     the same dao        `daoDistance` at `same_subject`: not two people who
 *                         both cultivate, two people cultivating the SAME
 *                         thing, which is the whole of why it works
 *     married             the tie, with `roles: ['married']` on it
 *
 * All three, or it is an ordinary marriage. That is the point of the
 * distinction and the reason the term exists in the genre at all: a house is
 * full of married couples and almost none of them are dao partners, because
 * two people who married across two roads get exactly what any two people
 * cultivating different arts in one room get, which is company.
 *
 * None of the three is decided here. `sameHouse` and `married` are reported by
 * the caller off the roster and the tie table, in the same way {@link
 * FurnaceUseType} is reported rather than rolled; the dao is compared here,
 * because comparing two dao is a structural question about a pair and
 * `daoDistance` is the one function that answers it.
 *
 * ── AND WHAT IT IS WORTH, WHICH DEPENDS ON THE GAP ───────────────────────
 *
 * Two cases, and they are genuinely different mechanics rather than one
 * mechanic with a coefficient:
 *
 *   level with each other    Both come away slightly ahead of where either
 *                            would have alone, and equally so. Nothing is
 *                            being taught, because neither of them is standing
 *                            anywhere the other has not stood - what the two
 *                            of them get is a better draw off the same ground
 *                            for sitting it together.
 *
 *   one of them behind       The one behind gets considerably more, and gets
 *                            the other thing as well: a dao insight, in the
 *                            subject the two of them share, off somebody who
 *                            is further along that exact road. The one ahead
 *                            still gets the level figure and no insight, and
 *                            that asymmetry is deliberate and is the reason a
 *                            dao partnership is a thing somebody would want
 *                            rather than a thing somebody would be talked
 *                            into.
 *
 * This is the peer term `guidanceMultiplier` cannot express and was never
 * meant to: guidance is worth a great deal from far above and nothing from a
 * peer, so a partner at the same rung reads as zero through it. See
 * `sharedPracticeBonus` in `engine/cultivation/cultivation.ts`, which is where
 * the day figures below are actually spent.
 */

/**
 * Days of bonus progress each of two level partners gets, at their own rate.
 *
 * One number, read once, here - see {@link FURNACE_CONCEPTION_CHANCE}'s own
 * comment for why a single constant is the right size for this. Small on
 * purpose: two people at the same rung teach each other nothing, and what they
 * have is a better draw off one patch of ground.
 */
export const DAO_PARTNER_DAYS_BONUS = 2;

/**
 * How many rungs of a gap the one behind can actually draw on.
 *
 * A cap and not a taper, because the reason for it is a hard one rather than a
 * balance preference: somebody twenty rungs above you is not walking your road
 * any more, whatever the two of you call each other, and a partnership that
 * paid out on the whole of that gap would be `useAFurnaceTechnique` with the
 * consent question quietly removed. Eight rungs is the width of two realms,
 * which is as far apart as two people can be and still be doing the same
 * thing.
 */
export const DAO_PARTNER_RUNGS_DRAWN_ON = 8;

/**
 * Chance the one behind takes an insight out of a single shared sitting.
 *
 * Rolled on a caller-owned `[0,1)` sample, exactly as {@link
 * FurnaceUseInput.conceptionSample} is. Never rolled for the one ahead: there
 * is nothing on this road they have not already seen, which is the same
 * statement `guidanceMultiplier` makes about a master eventually sending a
 * student away.
 */
export const DAO_PARTNER_INSIGHT_CHANCE = 0.2;

/**
 * One side of a partnership, as the caller holds them.
 *
 * `dao` is the whole assessment rather than a subject string, because
 * `daoDistance` takes one and building a second, smaller shape to hand it
 * would be a second answer to "are these two on one road".
 */
export interface ADaoPartner {
    personId: string;
    sex: Sex;
    /** Their rung. `realmOrdinal`, unchanged. */
    reachesTo: number;
    /** From `daoOf(insights)`. `standing: 'none'` is somebody on no road yet. */
    dao: DaoAssessment;
}

export interface DaoPartnershipInput {
    one: ADaoPartner;
    other: ADaoPartner;
    /** The art both of them are practising. Must be the same id for both. */
    sharedTechniqueId: string;
    /** Both on one house's roll. Reported off the roster - see the header. */
    sameHouse: boolean;
    /** The tie carries `married`. Reported off the tie table - see the header. */
    married: boolean;
    /**
     * `[0,1)`. Its own named draw, matching `conceptionSample`'s convention -
     * read only where one of them is behind the other, so a caller resolving a
     * level pair may pass any finite number and it is never touched.
     */
    insightSample: number;
}

/** Which of the four conditions failed, for a caller that has to say so. */
export type WhyTheyAreNotDaoPartners = 'the_art' | 'the_house' | 'the_marriage' | 'the_dao';

export interface DaoPartnershipResult {
    /** True only when all four conditions hold. */
    areDaoPartners: boolean;
    /**
     * The first condition that failed, or null.
     *
     * Ordered mechanism first and paperwork last - `'the_art'` for a pair the
     * art cannot work between at all, then the house, then the marriage, then
     * the dao - so a caller reporting one reason reports the one furthest from
     * being fixable.
     */
    missing: WhyTheyAreNotDaoPartners | null;
    /**
     * Days of bonus progress, at each person's OWN rate, keyed by `personId`.
     *
     * Empty where they are not dao partners. Keyed rather than positional
     * because the caller is playing one side and asking about the other, and a
     * `one`/`other` pair of fields is a thing a caller can read backwards.
     */
    daysBonus: Readonly<Record<string, number>>;
    /**
     * The insight the one behind took out of it, or null.
     *
     * Non-null only where the two of them are dao partners, one is genuinely
     * behind, and the sample landed. The subject and domain are the SHARED
     * road's - there is no other road it could be, which is why nothing here
     * chooses one. Turning this into an `Insight` row at a degree is the
     * insight layer's job and not this file's, exactly as `conceived` is the
     * birth layer's: what comes back is the one bit that layer needs to start.
     */
    insight: { forPersonId: string; subject: string; domain: InsightDomain } | null;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Sit the same art with your dao partner, and see what the two of you get.
 *
 * Pure: two people and a book in, a decision out. The caller applies
 * `daysBonus` through `sharedPracticeBonus`
 * (`engine/cultivation/cultivation.ts`) and hands any `insight` to the insight
 * layer; nothing here touches state.
 */
export function cultivateWithADaoPartner(
    input: DaoPartnershipInput
): DaoPartnershipResult {
    const { one, other } = input;

    const nothing = (
        missing: WhyTheyAreNotDaoPartners,
        line: string
    ): DaoPartnershipResult => ({
        areDaoPartners: false,
        missing,
        daysBonus: {},
        insight: null,
        line
    });

    // The mechanism first, and it is the same one the furnace runs on.
    if (!worksBetween(one.sex, other.sex)) {
        return nothing(
            'the_art',
            'The art does not answer between the two of them. Nothing happened.'
        );
    }
    if (!input.sameHouse) {
        return nothing(
            'the_house',
            'Not on one roll. Whatever else the two of them are, they are not in the same '
            + 'rooms year after year.'
        );
    }
    if (!input.married) {
        return nothing(
            'the_marriage',
            'Not married. What the two of them have is an arrangement about an art.'
        );
    }

    // ── AND THE ONE CONDITION THAT IS A COMPARISON ───────────────────────
    //
    // `daoDistance` and not a subject-string equality, because that function
    // is where this world has already ruled on how close two roads are. Both
    // sides need a road at all: `standing: 'none'` is somebody who has not
    // started walking one, and two people with nothing to compare are not
    // walking the same thing - they are both merely cultivating.
    const onOneRoad =
        one.dao.standing !== 'none'
        && other.dao.standing !== 'none'
        && other.dao.subject !== null
        && other.dao.domain !== null
        && daoDistance(one.dao, { subject: other.dao.subject, domain: other.dao.domain })
            === 'same_subject';

    if (!onOneRoad) {
        return nothing(
            'the_dao',
            'Married, and on one roll, and walking two different roads. It is an ordinary '
            + 'marriage.'
        );
    }

    // ── WHAT THE GAP IS WORTH ────────────────────────────────────────────
    const ahead = one.reachesTo >= other.reachesTo ? one : other;
    const behind = ahead === one ? other : one;
    const gap = Math.min(
        ahead.reachesTo - behind.reachesTo,
        DAO_PARTNER_RUNGS_DRAWN_ON
    );

    // Level with each other. Both come away equally and slightly ahead, and
    // nobody is taught anything - see the header for why that is the whole of
    // this case rather than a degenerate version of the other one.
    if (gap === 0) {
        return {
            areDaoPartners: true,
            missing: null,
            daysBonus: {
                [one.personId]: DAO_PARTNER_DAYS_BONUS,
                [other.personId]: DAO_PARTNER_DAYS_BONUS
            },
            insight: null,
            line: 'Two dao partners at the same rung sat the same art, and both drew better off '
                + 'the ground than either would have alone.'
        };
    }

    const took = input.insightSample < DAO_PARTNER_INSIGHT_CHANCE;
    return {
        areDaoPartners: true,
        missing: null,
        daysBonus: {
            [ahead.personId]: DAO_PARTNER_DAYS_BONUS,
            [behind.personId]: DAO_PARTNER_DAYS_BONUS * (1 + gap)
        },
        // The shared road's, because there is no other road it could be on.
        // Read off the one AHEAD: both subjects are the same by `same_subject`
        // above, and the domain that matters is the one somebody has actually
        // carried further.
        insight: took
            ? {
                forPersonId: behind.personId,
                subject: ahead.dao.subject as string,
                domain: ahead.dao.domain as InsightDomain
            }
            : null,
        line: took
            ? `Two dao partners ${gap} rung${gap === 1 ? '' : 's'} apart sat the same art, and `
              + 'the one behind saw something on the road the one ahead had already passed.'
            : `Two dao partners ${gap} rung${gap === 1 ? '' : 's'} apart sat the same art, and `
              + 'the one behind came away well ahead of where they would have alone.'
    };
}
