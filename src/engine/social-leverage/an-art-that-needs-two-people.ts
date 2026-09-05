/**
 * An art that cannot be practised alone. `runsOn: 'the_others'` is a DRAIN - one
 * draws, the rest supply and gain nothing, the genre's furnace. `runsOn:
 * 'everyone'` is a PARTNERSHIP. Both live here because they share one eligibility
 * test and because a reader who finds the drain must find the alternative in the
 * same place.
 */

import type { Sex } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import { canBeTheTwoParentsOf } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import { type DaoAssessment, daoDistance } from '../cultivation/dao.js';
import type { InsightDomain } from '../../schema/cultivation.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationInput } from '../social/grudges.js';

/**
 * Whether an art of this kind could work between two people, on sex alone.
 * Consulted for `category: 'dual_cultivation'` and nothing else - a paired sword
 * form is `requiresPeople: 2` under `attack` and has no such requirement.
 */
export const worksBetween: (a: Sex, b: Sex) => boolean = canBeTheTwoParentsOf;

/**
 * What kind of use this was. Reported, not rolled. `coerced` is used only once a
 * `submission` has been reached elsewhere; nothing here checks that it was.
 */
export type FurnaceUseType = 'offered' | 'coerced';

/** The one drawing. */
export interface TheOneDrawing {
    personId: string;
    name: string;
    sex: Sex;
}

/**
 * One person being drawn off. The samples are per PERSON, not per use: two
 * furnaces in one rite conceive or die independently, and one shared sample
 * would make them a single coin flip wearing two names.
 */
export interface OneBeingDrawnOff {
    personId: string;
    name: string;
    sex: Sex;
    /** `[0,1)`, its own named draw so it never shifts anything else on the stream. */
    conceptionSample: number;
    /** `[0,1)`. Read only when the use is `coerced`; otherwise never touched. */
    deathSample: number;
    /**
     * What THIS body is worth to draw on, a multiplier on the figures below.
     * Omitted reads as 1. In the played world it is
     * `drawnOffMultiplierOf(physiqueOrNull(...))`, and this file is deliberately
     * not told which physique produced it - a field naming a body's kind here would
     * be the branch that catalog forbids.
     */
    drawnOff?: number;
}

/** One actor, and everybody the rite is worked on. */
export interface FurnaceUseInput {
    actor: TheOneDrawing;
    subjects: readonly OneBeingDrawnOff[];
    onDay: DayIndex;
    type: FurnaceUseType;
}

/** Base chance a single use conceives, once the art has worked. One number, here. */
export const FURNACE_CONCEPTION_CHANCE = 0.15;

/**
 * What the actor draws off the subject on a willing use, in days of the ACTOR's
 * own rate - the unit `accrueProgress` takes. The subject loses the same figure
 * off theirs: the willing case is willing about who is spent, not the amount.
 */
export const FURNACE_DAYS_STOLEN_WILLING = 60;

/**
 * What the actor draws off a coerced use. More than the willing figure: nothing
 * is being managed for the furnace's sake once consent is gone.
 */
export const FURNACE_DAYS_STOLEN_COERCED = 150;

/**
 * Chance a coerced draw kills the furnace outright. Never rolled on a willing
 * use: an actor who wants the same furnace twice has a reason to keep them alive.
 */
export const FURNACE_COERCED_DEATH_CHANCE = 0.1;

/** What the rite did to one of the people it was worked on. */
export interface WhatItDidToOneOfThem {
    personId: string;
    name: string;
    /** False when the art cannot work between this person and the actor. */
    eligible: boolean;
    /**
     * Days this one body gave up, at the actor's rate. Zero where the art could
     * not work on them. Subtract THIS from this subject, never
     * `daysStolen / worked.length` - that division charges an ordinary body for
     * what an extraordinary one gave.
     */
    daysGivenUp: number;
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
     * One row per subject, in the order given, INCLUDING the ones the art could
     * not work on: a missing row and a refused one are different facts, and a
     * list that drops refusals cannot be counted against the list handed in.
     */
    each: readonly WhatItDidToOneOfThem[];
    /**
     * Total days moved, at the ACTOR's rate, summed over everybody it worked on.
     * Add to the actor; take each subject's share from `daysGivenUp`, not from
     * this figure divided by anything.
     */
    daysStolen: number;
    /**
     * One grudge per coerced subject it worked on, empty on a willing use. Still
     * written for somebody who died: the account opens with nobody left alive to
     * hold it, which is what `grudges.ts`' inheritance machinery is for.
     */
    grudges: readonly ObligationInput[];
    /** Engine truth, one line. Never narration. */
    line: string;
}

/** What one body is worth to draw on. Absent or nonsense reads as ordinary. */
function worthOfABody(drawnOff: number | undefined): number {
    if (drawnOff === undefined || !Number.isFinite(drawnOff) || drawnOff < 0) return 1;
    return drawnOff;
}

/**
 * Work a furnace technique, on however many people it takes. Pure: the caller
 * writes the grudges, applies the days, runs the death pipeline and hands a
 * `conceived` to `birth.ts`.
 */
export function useAFurnaceTechnique(input: FurnaceUseInput): FurnaceUseResult {
    const coerced = input.type === 'coerced';

    // Eligibility is PER PERSON. A rite worked on four that answers between
    // three is three-quarters of a rite, not a refusal - one ineligible body
    // silently voiding the circle would be a rule nobody wrote.
    const perPerson = coerced ? FURNACE_DAYS_STOLEN_COERCED : FURNACE_DAYS_STOLEN_WILLING;

    const each: WhatItDidToOneOfThem[] = input.subjects.map(who => {
        const eligible = worksBetween(input.actor.sex, who.sex);
        const died = eligible && coerced && who.deathSample < FURNACE_COERCED_DEATH_CHANCE;
        return {
            personId: who.personId,
            name: who.name,
            eligible,
            // Conception is a fact about a body that lived past the draw.
            conceived: eligible && !died && who.conceptionSample < FURNACE_CONCEPTION_CHANCE,
            died,
            // A dead furnace still gave up what it gave up. Not a refund.
            daysGivenUp: eligible ? perPerson * worthOfABody(who.drawnOff) : 0
        };
    });

    const worked = each.filter(row => row.eligible);

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
        daysStolen: worked.reduce((sum, row) => sum + row.daysGivenUp, 0),
        grudges,
        line: theLineFor(input, worked)
    };
}

/**
 * One sentence of engine truth. One subject gets a sentence about a person; more
 * than one gets a sentence about a count.
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


/**
 * THE OTHER ROAD: A DAO PARTNER. `runsOn: 'everyone'` is not a drain. Four
 * conditions, all of them or it is an ordinary marriage: the art works between
 * them, the same house, married, and `daoDistance` at `same_subject`. Only the dao
 * is decided here; the rest are reported by the caller.
 */

/**
 * Days of bonus progress each of two LEVEL partners gets, at their own rate.
 * Small on purpose: two people at the same rung teach each other nothing.
 */
export const DAO_PARTNER_DAYS_BONUS = 2;

/**
 * How many rungs of a gap the one behind can draw on. A cap and not a taper: a
 * partnership paying out on the whole of a twenty-rung gap would be
 * `useAFurnaceTechnique` with the consent question quietly removed. Eight rungs
 * is two realms, as far apart as two people can be and still do the same thing.
 */
export const DAO_PARTNER_RUNGS_DRAWN_ON = 8;

/**
 * Chance the one behind takes an insight out of a shared sitting. Never rolled
 * for the one ahead: there is nothing on this road they have not seen.
 */
export const DAO_PARTNER_INSIGHT_CHANCE = 0.2;

/**
 * One side of a partnership. `dao` is the whole assessment because `daoDistance`
 * takes one; a smaller shape here would be a second answer to "one road".
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
    /** Both on one house's roll. Reported off the roster. */
    sameHouse: boolean;
    /** The tie carries `married`. Reported off the tie table. */
    married: boolean;
    /** `[0,1)`. Read only where one is behind the other; otherwise never touched. */
    insightSample: number;
}

/** Which of the four conditions failed, for a caller that has to say so. */
export type WhyTheyAreNotDaoPartners = 'the_art' | 'the_house' | 'the_marriage' | 'the_dao';

export interface DaoPartnershipResult {
    /** True only when all four conditions hold. */
    areDaoPartners: boolean;
    /**
     * The first condition that failed, or null. ORDERED mechanism first and
     * paperwork last - art, house, marriage, dao - so a caller reporting one
     * reason reports the one furthest from being fixable.
     */
    missing: WhyTheyAreNotDaoPartners | null;
    /**
     * Days of bonus progress at each person's OWN rate, keyed by `personId`.
     * Keyed rather than positional: a `one`/`other` pair can be read backwards.
     */
    daysBonus: Readonly<Record<string, number>>;
    /** The insight the one behind took, or null. Turning it into an `Insight`
     * row at a degree is the insight layer's job, not this file's. */
    insight: { forPersonId: string; subject: string; domain: InsightDomain } | null;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Sit the same art with your dao partner. Pure: the caller applies `daysBonus`
 * through `sharedPracticeBonus` and hands any `insight` to the insight layer.
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

    // `daoDistance` and not a subject-string equality. Both sides need a road:
    // `standing: 'none'` is somebody who has not started walking one, and two
    // people with nothing to compare are merely both cultivating.
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

    const ahead = one.reachesTo >= other.reachesTo ? one : other;
    const behind = ahead === one ? other : one;
    const gap = Math.min(
        ahead.reachesTo - behind.reachesTo,
        DAO_PARTNER_RUNGS_DRAWN_ON
    );

    // Level with each other: equal and slight, and nobody is taught anything.
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
        // Read off the one AHEAD: the subjects are equal by `same_subject`, and
        // the domain that matters is the one somebody carried further.
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
