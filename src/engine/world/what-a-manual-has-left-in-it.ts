/**
 * How many times the art can be taken off a manual before there is no manual.
 *
 * Ruled by the design owner: a heaven-grade manual has a finite number of uses
 * and the lesser grades are unlimited, at "heaven+" - so heaven, immortal and
 * chaos run out and mortal and earth do not.
 *
 * THE CUT IS THE LINE THE WORLD ALREADY DREW, AND THAT IS DELIBERATE. It is one
 * rule wearing two names, not two rules that happen to agree - confirmed by the
 * design owner, who drew both: *"this is on purpose by me btw."* `items.md`, on
 * damage: "Counted things cannot be damaged. They stop existing. There is
 * nowhere to write the scar." A spent use IS a scar, so a thing that can run
 * out is exactly a thing with somewhere to write that it has - and
 * `howAGradeIsStored` already answers which grades are an amount and which are
 * a row with a history: counted at mortal and earth, tracked at heaven and
 * above.
 *
 * So do not read the two sets as parallel lists to keep in step. Read the
 * storage as the CAUSE: a manual runs out because it is the kind of thing the
 * world keeps a history for, and the lesser grades are unlimited because there
 * is nowhere to record the spending. `a-heaven-grade-manual-runs-out.test.ts`
 * holds them together so a change to either is made knowing it moves both.
 *
 * WHAT CONSUMES A USE: one person taking the whole art off the page, and
 * nothing else. Practising an art already held takes nothing out of the book -
 * it is already in the reader. Being taught by somebody who knows it takes
 * nothing out of the book either; the master carries the method and
 * `canTransmit` in `../encounters/acquisition.ts` is the rule for that, with
 * the book not necessarily in the room. Writing out a copy comes out of a
 * master's memory - `couldWriteOutACopy` requires full mastery - which is why
 * it is not a second door into this counter.
 *
 * So the scarcity bites exactly where the setting says it does: a house cannot
 * hand its inner art to forty people, and the most tempting object in any
 * compound is the one it cannot replace.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { copyCount } from './manuals.js';
import { isRuined, ruin, type ObjectRecord } from './possessions.js';

/**
 * How many times the art comes off a manual of this grade. Null is unlimited.
 *
 * THE ONE PLACE the cut and the numbers live. Everything else asks.
 *
 * Three for heaven: `copiesOf` gives an inner or elders shelf one to three
 * copies, so three a copy is a handful of people founded on a house's own art
 * before somebody has to write it out again.
 *
 * One for immortal and one for chaos, and the SAME one: `possessions.ts` has
 * it that nothing below the Lid makes either grade, that there is a finite
 * number in the world and no process that adds another. A book like that is
 * inherited once. They tie because `GRADE_ORDINAL_BANDS` makes the top two
 * grades peers and `GRADE_ORDER` says outright that it is not a power
 * ordering - a ladder here would be this file inventing one.
 */
export const USES_A_MANUAL_OF_THIS_GRADE_HOLDS: Readonly<Record<TechniqueGrade, number | null>> = {
    mortal: null,
    earth: null,
    heaven: 3,
    immortal: 1,
    chaos: 1
} as const;

/** Whether anything at all stops a manual of this grade. */
export function aManualOfThisGradeRunsOut(grade: TechniqueGrade): boolean {
    return USES_A_MANUAL_OF_THIS_GRADE_HOLDS[grade] !== null;
}

/** Where the count is kept. One field, written only by `takeTheArtOffThePage`. */
const USES_SPENT = 'usesSpent';

export interface ManualUses {
    /** Whether anything stops this book. False and the rest is unlimited. */
    runsOut: boolean;
    /** Times the art comes off this ROW in total, copies counted. Null: no limit. */
    allowed: number | null;
    /** Times it already has. */
    spent: number;
    /** Times it still can. Null where nothing stops it. */
    left: number | null;
    /** Exactly one left. The fact worth stating before somebody spends it. */
    onItsLastUse: boolean;
    /** None left, or the row has already been ruined. */
    isSpent: boolean;
    /** Engine-authored and factual. */
    line: string;
}

/** How many uses this row has already given up. */
export function usesSpentOn(object: Pick<ObjectRecord, 'data'>): number {
    const n = Number(object.data?.[USES_SPENT] ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** What is left in this book. */
export function whatIsLeftIn(
    object: Pick<ObjectRecord, 'name' | 'data' | 'tags'>,
    grade: TechniqueGrade
): ManualUses {
    const title = object.name;
    const per = USES_A_MANUAL_OF_THIS_GRADE_HOLDS[grade];
    const spent = usesSpentOn(object);

    if (per === null) {
        return {
            runsOut: false,
            allowed: null,
            spent,
            left: null,
            onItsLastUse: false,
            isSpent: isRuined(object as ObjectRecord),
            line: `${title} does not run out.`
        };
    }

    const allowed = per * Math.max(1, copyCount(object as ObjectRecord));
    const left = Math.max(0, allowed - spent);
    const isSpent = left === 0 || isRuined(object as ObjectRecord);

    return {
        runsOut: true,
        allowed,
        spent,
        left,
        onItsLastUse: left === 1,
        isSpent,
        line: isSpent
            ? `The art has come off ${title} ${allowed} time${allowed === 1 ? '' : 's'}, which is `
              + 'all it held. There is nothing left on the pages.'
            : left === 1
                ? `${title} holds one more. The next person to take the art off it takes the `
                  + 'last of it, and there is no book afterwards.'
                : `The art can be taken off ${title} ${allowed} times. ${spent} `
                  + `${spent === 1 ? 'is' : 'are'} spent and ${left} are left.`
    };
}

export interface TheArtTakenOffThePage {
    /** The row afterwards. The caller writes it back. */
    object: ObjectRecord;
    /** False when there was nothing left to take. */
    took: boolean;
    before: ManualUses;
    after: ManualUses;
    /** True when this taking was the last one and the book ended here. */
    ruined: boolean;
    /** Engine-authored and factual. */
    line: string;
}

/**
 * One person takes the whole art off this book.
 *
 * Pure: a row in, a row out, no mutation of the input. A book that runs out
 * ends at `ruin`, which is this world's one way for a thing to stop existing -
 * the row stays, the power goes, the provenance says it was lost. "Spent is
 * not gone": that this house held this book and read it to the end is exactly
 * the sort of thing somebody should be able to find out two centuries later.
 */
export function takeTheArtOffThePage(
    object: ObjectRecord,
    input: { grade: TechniqueGrade; byId: string; onDay: number }
): TheArtTakenOffThePage {
    const before = whatIsLeftIn(object, input.grade);

    if (before.isSpent) {
        return {
            object,
            took: false,
            before,
            after: before,
            ruined: false,
            line: before.line
        };
    }

    // NOTHING IS WRITTEN DOWN WHERE THERE IS NOWHERE TO WRITE IT. A mortal or
    // earth manual is a counted thing, and a count of how often a counted
    // thing has been read out is the scar `items.md` says such a row cannot
    // carry. The art comes off it and the row is untouched.
    if (!before.runsOut) {
        return { object, took: true, before, after: before, ruined: false, line: before.line };
    }

    const counted: ObjectRecord = {
        ...object,
        data: { ...object.data, [USES_SPENT]: before.spent + 1 }
    };
    const after = whatIsLeftIn(counted, input.grade);
    if (!after.isSpent) {
        return { object: counted, took: true, before, after, ruined: false, line: after.line };
    }

    const ended = ruin(counted, {
        onDay: input.onDay,
        source: input.byId,
        note: `The art came off ${object.name} for the ${before.allowed}th and last time.`
    });
    return {
        object: ended,
        took: true,
        before,
        after: whatIsLeftIn(ended, input.grade),
        ruined: true,
        line: `${after.line} ${object.name} does not exist any more.`
    };
}

/**
 * The manual this person is holding of this art, or null.
 *
 * A different question from `aTakenCopyOf` in `src/web/house-property-theft.ts`,
 * which asks how a copy came to a hand because the learn gate needs a
 * provenance. This asks only whether there is a book here to spend, so it is
 * indifferent to how it was got and refuses a book that has already ended.
 */
export function theManualInThisHandFor(
    objects: readonly ObjectRecord[],
    holderId: string,
    techniqueId: string
): ObjectRecord | null {
    return objects.find(object =>
        object.kind === 'manual'
        && object.possessorId === holderId
        && object.data?.techniqueId === techniqueId
        && !isRuined(object)) ?? null;
}
