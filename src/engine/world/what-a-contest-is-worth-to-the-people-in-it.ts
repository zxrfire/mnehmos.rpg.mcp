/**
 * What standing up at a contest is worth to the person who stood up.
 *
 * `runCompetition` moved prestige, wrote ties and could take a champion off
 * another house's roll, and nobody was any better for having been there. A house
 * holds one FOR THE SAKE OF TRAINING ITS OWN DISCIPLES, and a mechanism that
 * produces a ranking and no training is a scoreboard rather than a school.
 *
 * What is paid is days of progress, credited by moving `accumulatingSinceDay`
 * back - the one clock `readyToStrike` reads - and paid by HOW FAR UP THE BOARD
 * SOMEBODY WAS PUSHED rather than by where they finished. A strong disciple who
 * walks through a weak field has learned nothing; somebody beaten by eleven
 * better people has been shown eleven things they cannot do yet. Winning is
 * already paid in prestige, and paying it twice would be paying for being strong
 * rather than for getting better.
 *
 * Two consequences fall out of that and both are wanted: a deep field teaches
 * more than a shallow one, so an open competition is worth more to attend than a
 * closed one, and the house at the top of a board gets least out of holding it,
 * which is why it invites anybody.
 *
 * THOSE TWO SENTENCES DESCRIBED SOMETHING THAT DID NOT EXIST, for as long as the
 * only board in the world was `gatherings.ts`'s - a circle of allied houses,
 * closed by construction, every attendee drawn from `chosenOf`. A header
 * describing a consequence of an absent mechanism is this repo's dominant defect
 * in its purest form, and it is recorded here rather than quietly deleted
 * because the reasoning was right and only the mechanism was missing.
 * `a-competition-anybody-may-enter.ts` is now the open half; it puts the date on
 * a wall and nothing enters it yet, so the first sentence is a claim about a
 * thing that exists and the second is still waiting on entrants.
 *
 * Pure. A board in, days out. The caller moves the clock.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';

/** What turning up and standing there is worth, in days, before anybody above. */
export const A_DAY_ON_THE_SAND = 30;

/** What each person above you on your own board is worth, in days. */
export const WHAT_SOMEBODY_BETTER_TEACHES_YOU = 91;

/**
 * The most one contest can be worth, in years.
 *
 * A contest is a fortnight and the credit is what was learned at it, not what
 * was lived through it. Three years is already generous against
 * `stagnationYearsForOrdinal` at the bottom of the ladder; uncapped, a board of
 * twelve would hand the last of them a decade for an afternoon.
 */
export const MOST_ONE_CONTEST_IS_WORTH_YEARS = 3;

/** One person's place on one board. */
export interface StoodOnABoard {
    npcId: string;
    /** 1 is first on their own board. */
    place: number;
    /** How many stood on that board, including them. */
    fieldSize: number;
}

export interface WhatTheyTookFromIt {
    npcId: string;
    /** Days of progress. Never negative; zero for a board of one. */
    days: number;
}

/**
 * What each person on a board took away from it.
 *
 * A board of one is nobody measuring themselves against anybody, and it pays
 * nothing - the same reading `runCompetition` already applies to prestige, where
 * a bracket with one person in it is somebody standing on a stage alone.
 */
export function whatAContestIsWorthToThePeopleInIt(
    board: readonly StoodOnABoard[]
): WhatTheyTookFromIt[] {
    const cap = MOST_ONE_CONTEST_IS_WORTH_YEARS * DAYS_PER_YEAR;
    return board.map(row => {
        if (row.fieldSize <= 1) return { npcId: row.npcId, days: 0 };
        const above = Math.max(0, row.place - 1);
        const days = A_DAY_ON_THE_SAND + above * WHAT_SOMEBODY_BETTER_TEACHES_YOU;
        return { npcId: row.npcId, days: Math.min(cap, days) };
    });
}
