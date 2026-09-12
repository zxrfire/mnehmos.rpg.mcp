/**
 * Taking somebody as your own, and being taken - a claim on somebody's future
 * held at both ends.
 *
 * `RelationshipKind` carried `master` and `disciple` and nothing in `src/` wrote
 * either; `facts.ts` renders both. `recruit_disciples` added an integer to
 * `ledger.ownFollowing`, and an integer cannot be disappointed in you. So the
 * most characteristic bond in the genre was a type with a reader and no writer,
 * and `GrudgeCause.killed_master` could never fire because nothing had a master.
 *
 * ── WHAT IS DECIDED HERE, WHICH IS ALMOST NOTHING ────────────────────────
 *
 * Take the four borrowed pieces away and no bond system is left over, which is
 * the test AGENTS.md sets for whether a mechanic is bespoke:
 *
 *   regardFor / REGARD_BANDS   HOW FAR APART. The bar for a master is not a new
 *                              number: `assured` begins at a gap of 4 and is the
 *                              first band where a thing "goes quickly, it goes
 *                              well". Somebody two rungs up is a senior brother.
 *   createOath / createGrudge  WHAT IS OWED. `service_term` was already in
 *                              `OathCause` with no producer. `teaching_term` is
 *                              added beside it as its mirror, because the ledger
 *                              could say what a disciple owes and not what a
 *                              master does.
 *   upsertRelationship         WHERE THE TIE LIVES. One store, both directions.
 *   DAYS_PER_YEAR              HOW LONG A TERM IS.
 *
 * ── THE BOND IS SEALED BY AN ACT ─────────────────────────────────────────
 *
 * It is not a field being set. Somebody kneels, in front of whoever is standing
 * there, and that is the moment it becomes true. {@link whatABondOpens} returns
 * the sealing alongside the rows so a caller has one wording for it and hands it
 * to `aDeedEntersTheWorld` the way every other public act enters the world.
 * `WorldState` is deliberately not imported: this module stays pure, and the
 * caller that has a world is the one that files the fact.
 *
 * The word this genre uses for the weight of that act is already taken. `karma`
 * is a DOMAIN of comprehension here (`understanding.ts`, with `debt` as its
 * subject), so it is not reused for a tie, and there is no second one.
 *
 * ── AND SEVERING IS MUTUAL, WHICH IS THE HALF WORTH STORING ──────────────
 *
 * Three states, not two: taken, held, and broken-by-somebody. `former_master`
 * existed in the type and nothing wrote it, which means the type anticipated an
 * ending nobody built. Ending it does not delete the tie - a disciple who left
 * eleven years ago is still a fact about both of them, which is the same ruling
 * `how-near-you-stand-to-somebody.ts` already makes by keeping `former_` under
 * the same roof. What changes is the kind, and WHO ended it is carried, because
 * the difference between walking out and being cast out is the whole story.
 *
 * ── NOTHING HERE REFUSES A TAKING ON THE GROUND THAT IT IS UGLY ──────────
 *
 * Taking somebody who already answers to a master resolves. It is the version of
 * the act somebody uses to get ahead at another person's expense, it is ordinary
 * furniture in this genre, and a vocabulary that can only say the polite version
 * has taken a side. What it does is open a row for the master they were taken
 * from. The refusals below are all about whether the act is COHERENT.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { regardFor, type Regard } from '../cultivation/regard.js';
import {
    createGrudge,
    createOath,
    type ObligationRecord,
    type Severity
} from '../social/grudges.js';
import type { RelationshipKind } from '../world/npc-state.js';

/**
 * How far above a master stands, in rungs.
 *
 * `REGARD_BANDS` puts `assured` at a gap of 4 and this is that number read off
 * it rather than a second opinion about it. Below it the two of them are peers
 * who happen to be unequal, which the world already has words for.
 */
export const A_MASTER_STANDS_THIS_FAR_ABOVE = 4;

/**
 * The term, in years. A disciple's service and a master's teaching come due on
 * the same day, because they are two halves of one thing sworn once.
 */
export const A_TERM_RUNS_THIS_MANY_YEARS = 10;

/** Either end of the bond. */
export type BondEnd = 'master' | 'disciple';

/** Why a taking does not make sense. Never why it was not allowed. */
export type WhyNotTaken = 'themselves' | 'already_yours' | 'too_near';

/** The two people, at whatever grain the caller keeps them. */
export interface AsTheyStand {
    id: string;
    name: string;
    ordinal: number;
    factionId?: string | null;
    /** Who they already answer to as a master, when anybody. */
    masterId?: string | null;
}

/** A tie to write, in `upsertRelationship`'s own shape plus whose row it is. */
export interface TieToWrite {
    holderId: string;
    targetId: string;
    targetName: string;
    kind: RelationshipKind;
    standing: number;
    note: string;
}

export interface TakingRead {
    /** Whether the act is coherent. */
    may: boolean;
    why: WhyNotTaken | null;
    /** Factual, and it names the fact that would change the answer. */
    reason: string;
    /** The master they would be taken from, when there is one. */
    takenFrom: string | null;
    /** The gap, as the band table reads it. Carried for the caller. */
    regard: Regard;
}

/**
 * Whether these two can be master and disciple.
 *
 * The gap is read the same way every other pitched thing in the world is read,
 * from the STUDENT's side: `regardFor(theirs, yours)` asks what somebody at the
 * master's rung makes of the student's, which is the direction `dutyTermsFor`
 * already uses.
 */
export function whetherYouMayTake(master: AsTheyStand, student: AsTheyStand): TakingRead {
    const regard = regardFor(student.ordinal, master.ordinal);
    const gap = master.ordinal - student.ordinal;

    if (master.id === student.id) {
        return {
            may: false,
            why: 'themselves',
            reason: 'Nobody is their own master. A road is walked down by two people.',
            takenFrom: null,
            regard
        };
    }
    if (student.masterId === master.id) {
        return {
            may: false,
            why: 'already_yours',
            reason: `${student.name} already answers to you. There is nothing here to seal.`,
            takenFrom: null,
            regard
        };
    }
    if (gap < A_MASTER_STANDS_THIS_FAR_ABOVE) {
        return {
            may: false,
            why: 'too_near',
            reason:
                `${gap} rung${gap === 1 ? '' : 's'} is not a master and a disciple. It takes `
                + `${A_MASTER_STANDS_THIS_FAR_ABOVE} before there is a road to walk somebody `
                + 'down; under that the two of you are climbing the same stretch, and what you '
                + 'would be to them is a senior brother.',
            takenFrom: null,
            regard
        };
    }

    return {
        may: true,
        why: null,
        reason:
            `${gap} rungs between you, which is far enough that what you know is a road to them `
            + 'rather than an argument.',
        takenFrom: student.masterId ?? null,
        regard
    };
}

/**
 * The act that seals it, for the caller to file as a fact.
 *
 * Shaped and not written: this module has no `WorldState` and does not want one.
 */
export interface TheSealing {
    /** Named, for somebody who has a record for both of them. */
    summary: string;
    /** For everybody else, which is what attribution gating hands out. */
    unattributed: string;
    /** How much of a life was staked on it. `whatADeedLeaves` reads this. */
    cost: number;
    /** True where they were somebody else's when it happened. */
    overAnotherMastersHead: boolean;
}

export interface WhatABondOpens {
    ties: TieToWrite[];
    oaths: ObligationRecord[];
    /** One row for the master they were taken from. Empty where there was none. */
    grudges: ObligationRecord[];
    sealing: TheSealing;
    /** Absolute day both ends come due. */
    dueOnDay: number;
}

/**
 * Everything that becomes true when somebody kneels.
 *
 * Four rows and not one: the tie at each end, and the oath each end swore. The
 * two oaths are one promise recorded twice because the ledger is held per
 * person, and they come due on the same day for the same reason.
 */
export function whatABondOpens(input: {
    master: AsTheyStand;
    student: AsTheyStand;
    onDay: number;
    /** How many were standing there. Weight, not permission. */
    witnesses?: number;
    /** Years, where a caller has a reason for something other than the term. */
    years?: number;
}): WhatABondOpens {
    const { master, student, onDay } = input;
    const years = input.years ?? A_TERM_RUNS_THIS_MANY_YEARS;
    const dueOnDay = onDay + Math.round(years * DAYS_PER_YEAR);
    const takenFrom = student.masterId && student.masterId !== master.id
        ? student.masterId
        : null;

    const ties: TieToWrite[] = [
        {
            holderId: master.id,
            targetId: student.id,
            targetName: student.name,
            kind: 'disciple',
            standing: 0.5,
            note: `Took ${student.name} as their own on day ${onDay}.`
        },
        {
            holderId: student.id,
            targetId: master.id,
            targetName: master.name,
            kind: 'master',
            standing: 0.5,
            note: `Knelt to ${master.name} on day ${onDay}.`
        }
    ];

    const oaths: ObligationRecord[] = [
        createOath({
            holderId: student.id,
            subjectId: master.id,
            cause: 'service_term',
            severity: 'serious',
            onDay,
            dueOnDay,
            terms: `${years} years of service to ${master.name}.`,
            description:
                `${student.name} knelt to ${master.name} and was taken as their disciple.`,
            participants: [master.id]
        }),
        createOath({
            holderId: master.id,
            subjectId: student.id,
            cause: 'teaching_term',
            severity: 'serious',
            onDay,
            dueOnDay,
            terms: `${years} years of teaching owed to ${student.name}.`,
            description:
                `${master.name} took ${student.name} as their own and owes them the road.`,
            participants: [student.id]
        })
    ];

    const grudges: ObligationRecord[] = takenFrom
        ? [
            createGrudge({
                holderId: takenFrom,
                subjectId: master.id,
                cause: 'betrayal',
                severity: 'serious',
                onDay,
                description:
                    `${student.name} knelt to ${master.name} while still owing a term `
                    + 'elsewhere. Somebody else is teaching them now.',
                participants: [student.id]
            })
        ]
        : [];

    return {
        ties,
        oaths,
        grudges,
        dueOnDay,
        sealing: {
            summary: `${student.name} knelt to ${master.name} and was taken as their disciple.`,
            unattributed:
                'Somebody knelt in front of somebody else, in the open, and got back up as '
                + 'their disciple.',
            // A term of a life, capped the way `teaching-somebody-what-you-hold.ts`
            // caps the months it spends.
            cost: Math.min(1, (years * DAYS_PER_YEAR) / (DAYS_PER_YEAR * 100)),
            overAnotherMastersHead: takenFrom !== null
        }
    };
}

export interface WhatEndingLeaves {
    ties: TieToWrite[];
    grudges: ObligationRecord[];
    /** Which end ended it. The fact worth storing. */
    severedBy: BondEnd;
}

/**
 * What is left when it ends.
 *
 * The tie is not deleted. `how-near-you-stand-to-somebody.ts` keeps `former_`
 * under the same roof on purpose - *"a disciple who left eleven years ago still
 * knows what they saw"* - so what changes is the kind and the note, and both
 * rows say who ended it.
 *
 * A term served out leaves nothing against anybody. Walking out on one that was
 * still running is `broken_oath`, held by the end that did not walk, and how
 * heavily it is held is how much of the term was left.
 */
export function whatEndingABondLeaves(input: {
    master: AsTheyStand;
    student: AsTheyStand;
    onDay: number;
    walkedAway: BondEnd;
    /** Days still owed when it ended. Zero or less when it was served out. */
    termLeft: number;
}): WhatEndingLeaves {
    const { master, student, onDay, walkedAway, termLeft } = input;
    const byTheMaster = walkedAway === 'master';
    const how = byTheMaster
        ? `${master.name} cast them out on day ${onDay}.`
        : `${student.name} walked out on day ${onDay}.`;

    const ties: TieToWrite[] = [
        {
            holderId: master.id,
            targetId: student.id,
            targetName: student.name,
            kind: 'former_disciple',
            standing: byTheMaster ? -0.2 : -0.5,
            note: how
        },
        {
            holderId: student.id,
            targetId: master.id,
            targetName: master.name,
            kind: 'former_master',
            standing: byTheMaster ? -0.5 : -0.2,
            note: how
        }
    ];

    if (termLeft <= 0) {
        return { ties, grudges: [], severedBy: walkedAway };
    }

    const held = byTheMaster ? student : master;
    const against = byTheMaster ? master : student;
    return {
        ties,
        grudges: [
            createGrudge({
                holderId: held.id,
                subjectId: against.id,
                cause: 'broken_oath',
                severity: howHeavilyAWalkIsHeld(termLeft),
                onDay,
                description:
                    `${how} ${Math.round(termLeft / DAYS_PER_YEAR)} year`
                    + `${Math.round(termLeft / DAYS_PER_YEAR) === 1 ? '' : 's'} of the term was `
                    + 'still owed.',
                participants: []
            })
        ],
        severedBy: walkedAway
    };
}

/**
 * How badly a walk is taken, off how much of the term was left.
 *
 * Words rather than a float, on the ledger's own four-value scale, so nothing
 * downstream can do arithmetic on it. The last year of a term is nearly served;
 * the first is the whole of what was promised.
 */
function howHeavilyAWalkIsHeld(termLeft: number): Severity {
    const yearsLeft = termLeft / DAYS_PER_YEAR;
    if (yearsLeft >= A_TERM_RUNS_THIS_MANY_YEARS * 0.75) return 'grave';
    if (yearsLeft >= 1) return 'serious';
    return 'slight';
}

/**
 * What teaching somebody does, given whether they are yours.
 *
 * The bond doing work on a transaction that already existed rather than adding
 * one. Teaching a stranger is a kindness and opens a favour they owe you, which
 * is what `teaching-somebody-what-you-hold.ts` already writes at
 * `paidBy: 'actor'`. Teaching your own disciple opens nothing, because it was
 * already promised - it discharges the `teaching_term` sworn at the kneeling.
 *
 * A master who never teaches is therefore carrying an open oath with a due date
 * on it, which is the whole difference between a disciple and a headcount.
 */
export function whatTeachingYourOwnSettles(input: {
    teacherId: string;
    studentId: string;
    theyAreYours: boolean;
}): { opensAFavour: boolean; settles: 'teaching_term' | null; why: string } {
    if (input.theyAreYours) {
        return {
            opensAFavour: false,
            settles: 'teaching_term',
            why:
                'They are yours. You are not doing them a kindness, you are doing what you '
                + 'swore when they knelt, and nobody owes anybody a favour for it.'
        };
    }
    return {
        opensAFavour: true,
        settles: null,
        why:
            'They are nobody of yours. Months of your life went into somebody who had no claim '
            + 'on them, and that is a thing they now owe you.'
    };
}
