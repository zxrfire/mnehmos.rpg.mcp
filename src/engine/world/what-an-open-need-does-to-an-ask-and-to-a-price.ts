/**
 * ONE MOTIVATION MODEL. A NEED IS A LEVER IN AN ASK AND A PRICE IN A TRADE.
 */

import { earningsPerYear } from '../cultivation/origin.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { stagnationYearsForOrdinal } from '../../schema/cultivation.js';
import { activeGoals } from './npc-state.js';
import type { NpcGoal, NpcRecord } from './npc-state.js';
import type { ObjectSignificance } from './possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE TWO SIDES
// ─────────────────────────────────────────────────────────────────────────

/**
 * The person being asked, reduced to what deciding this needs.
 */
export interface SomebodyWithGoals {
    id: string;
    /** Their rung. Prices what a purse is worth TO THEM, and nothing else. */
    ordinal: number;
    factionId: string | null;
    /** Art ids they already hold. */
    holds: readonly string[];
    /** Open rows only. {@link goalsHeldBy} is the reader for an NPC record. */
    goals: readonly NpcGoal[];
    /**
     * The clocks they are under, for dating their wants.
     */
    clocks?: TheClocksSomebodyIsUnder | null;
}

/** What the person asking is actually carrying, as rows rather than as rank. */
export interface WhatTheAskerBrings {
    id: string;
    factionId: string | null;
    /** True when they hold a rank inside that house, not merely a badge. */
    ranked: boolean;
    /**
     * Spirit stones in the purse.
     */
    spiritStones: number;
    /** Art ids on their sheet. */
    holds: readonly string[];
}

/** Which row said so. Named rather than boolean, so a refusal can say why. */
export type WhyTheyWantIt =
    /** The goal points at the asker by id. Somebody's business IS them. */
    | 'it_is_about_you'
    /** The goal points at the asker's house, or wants one and they have one. */
    | 'your_house'
    /** They want money and the asker is carrying a year of their income. */
    | 'your_purse'
    /** They want to climb and the asker holds a road they do not. */
    | 'your_shelf';

export interface AWantYouCouldReach {
    goal: NpcGoal;
    because: WhyTheyWantIt;
}

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

/**
 * The goal rows an outsider could be part of, highest priority first.
 */
export function goalsHeldBy(npc: NpcRecord): readonly NpcGoal[] {
    return activeGoals(npc);
}

/**
 * Whether the asker is carrying enough for a goal about money to notice.
 */
function carriesRealMoneyToThem(them: SomebodyWithGoals, you: WhatTheAskerBrings): boolean {
    const theirYear = earningsPerYear(Math.max(0, them.ordinal));
    return theirYear > 0 && you.spiritStones >= theirYear;
}

/** An art the asker holds and the person being asked does not. */
function aRoadTheyHaveNot(them: SomebodyWithGoals, you: WhatTheAskerBrings): boolean {
    const theirs = new Set(them.holds);
    return you.holds.some(id => !theirs.has(id));
}

/**
 * The highest-priority open goal this asker is part of, or null.
 */
export function whatTheyWantThatYouCouldReach(
    them: SomebodyWithGoals,
    you: WhatTheAskerBrings
): AWantYouCouldReach | null {
    // Nobody is their own lever. A goal about yourself does not make you
    // easier to ask - it makes you the person asking.
    if (them.id === you.id) return null;

    for (const goal of them.goals) {
        // ── IT IS ABOUT YOU ──────────────────────────────────────────────
        //
        // The strongest reading and the one the world actually writes:
        // `openAmbition` opens "stand up to X and not be laughed at" with X on
        // the row, and the player is a row the world can invite. Somebody
        // whose open business is you has a reason to deal with you whatever
        // that business is - a grudge is priced separately and this is not it.
        if (goal.targetId !== null && goal.targetId === you.id) {
            return { goal, because: 'it_is_about_you' };
        }
        if (goal.targetId !== null && you.factionId !== null && goal.targetId === you.factionId) {
            return { goal, because: 'your_house' };
        }

        switch (goal.kind) {
            case 'wealth':
            case 'debt':
                if (carriesRealMoneyToThem(them, you)) {
                    return { goal, because: 'your_purse' };
                }
                break;
            case 'cultivation':
                if (aRoadTheyHaveNot(them, you)) {
                    return { goal, because: 'your_shelf' };
                }
                break;
            case 'status':
                // "Be taken seriously by somebody who matters locally." Being
                // placed inside a house is what makes somebody that, and it is
                // a row rather than a rung - which is why a ranked disciple
                // carries this and a wandering expert does not.
                if (you.ranked && you.factionId !== null && you.factionId !== them.factionId) {
                    return { goal, because: 'your_house' };
                }
                break;
            default:
                break;
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SAME NEED, SEEN FROM THE MARKET
//
// Everything below walks the same goal rows the reading above walks, in the
// same order, and asks the other question about them: what does this need do
// to what this person will pay, or refuse.
//
// ── THERE IS NO LIST OF REASONS HERE, AND THERE MUST NEVER BE ────────────
//
// `AGENTS.md`: "what NPCs do is emergent. Never enumerate it. Model what
// somebody wants and let the behaviour fall out. If a new case requires a new
// branch, the shape is wrong."
//
// The design owner's three illustrations - an injured son, a chosen disciple,
// a weapon that would carry somebody through a tribulation - are a MODEL and
// not cases. Every one of them is the same two rows: a person with an open
// want, and a singular object at a height that want is fought at. Nothing here
// knows what a son is. A tenth reason needs no code, only a person with a
// different want, and the sentence a player reads comes from the goal's own
// text, which was written by whoever opened it.
//
// The first draft of this file DID have the list - a table of which goal kinds
// each kind of object could answer - and it is worth saying why that was wrong
// even though it looked like data. It could not have produced a reason nobody
// had thought of, which is the whole thing a motivation model is for.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The object, reduced to the two fields the answer turns on.
 */
export interface ATrackedThing {
    /**
     * How much bookkeeping it deserves, which is the counted/tracked line.
     */
    significance: ObjectSignificance;
    /** The rung it is for. `power` on an object record; the band for a pill. */
    forOrdinal: number;
}

/**
 * The three things a need does to a price, and the third is the important one.
 */
export type WhatANeedDoesToAPrice =
    | 'pays_above_the_going_rate'
    | 'will_not_part_with_it_at_any_price'
    | 'held_against_a_need_not_yet_come'
    /**
     * THE FOURTH, AND IT IS NOT A NEED AT ALL.
     */
    | 'the_answer_is_not_theirs_to_give';

export interface ANeedAgainstAnObject {
    /**
     * The row it came off. Its `text` is what a refusal should say out loud.
     *
     * Null only for `the_answer_is_not_theirs_to_give`, where there is no want
     * involved and that is the whole of the finding.
     */
    goal: NpcGoal | null;
    effect: WhatANeedDoesToAPrice;
    /**
     * What they would go to, as a multiple of the going rate.
     */
    multiplier: number;
}

/**
 * The most a need bends a price.
 */
export const MOST_A_NEED_BENDS_A_PRICE = 2;

/**
 * How far beneath somebody a thing can be made and still answer a need.
 */
export const HOW_FAR_BENEATH_THEM_IT_MAY_BE = 8;

/**
 * How close a deadline has to be before a want is a PRESENT one.
 */
export const A_NEED_IS_PRESENT_WITHIN_DAYS = 365;

/**
 * AND A GAP FOUND BY PLAYING, WRITTEN DOWN RATHER THAN QUIETLY WORKED AROUND.
 */

/** Whether an object is the kind of thing a need can attach to at all. */
export function aNeedCanAttachTo(thing: ATrackedThing): boolean {
    return thing.significance !== 'mundane';
}

/**
 * A want an object could be part of, as opposed to one money answers.
 */
function aThingCouldBePartOfIt(goal: NpcGoal): boolean {
    return goal.kind !== 'wealth' && goal.kind !== 'debt';
}

/**
 * What this person's open business does to the price of this object.
 */
export function whatTheirNeedDoesToThePriceOf(
    them: SomebodyWithGoals,
    thing: ATrackedThing,
    holding: boolean,
    onDay: number,
    /**
     * Whether saying yes was ever theirs to say.
     */
    theAnswerIsTheirsToGive = true,
    /**
     * The clocks of whoever a want points at, when it points at a person.
     */
    theClocksOfWhoeverItIsAbout?: (goal: NpcGoal) => TheClocksSomebodyIsUnder | null
): ANeedAgainstAnObject | null {
    if (!aNeedCanAttachTo(thing)) return null;
    // Arithmetic rather than a lever. Said before the wants are walked,
    // because no want of theirs changes it and no price reaches it.
    if (holding && !theAnswerIsTheirsToGive) {
        return { goal: null, effect: 'the_answer_is_not_theirs_to_give', multiplier: 1 };
    }
    // Made for a height far beneath them. It answers nothing of theirs, and
    // somebody who thinks otherwise is about to be told so.
    if (thing.forOrdinal + HOW_FAR_BENEATH_THEM_IT_MAY_BE < them.ordinal) return null;

    for (const goal of them.goals) {
        if (!aThingCouldBePartOfIt(goal)) continue;

        if (!holding) {
            return {
                goal,
                effect: 'pays_above_the_going_rate',
                multiplier: 1
                    + Math.max(0, Math.min(1, goal.priority)) * (MOST_A_NEED_BENDS_A_PRICE - 1)
            };
        }

        // Derived, never read off the column directly. The column is empty in
        // every world this game has ever generated - see the banner below.
        const pressing = aWantThatCannotWait(
            goal, them.clocks ?? null, theClocksOfWhoeverItIsAbout?.(goal) ?? null, onDay
        );
        return {
            goal,
            effect: pressing
                ? 'will_not_part_with_it_at_any_price'
                : 'held_against_a_need_not_yet_come',
            multiplier: 1
        };
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHERE A DATE ON A WANT ACTUALLY COMES FROM
//
// ── A FIELD NOTHING WRITES ───────────────────────────────────────────────
//
// The present/reserved split above turns entirely on `deadlineOnDay`, and
// playing the game found that **nothing in this world has ever written one.**
// `goalFor` in `seeding.ts` gives every provincial one of five wants and none
// carries a day. `openAmbition` in `gatherings.ts` does not. The birth goal in
// `the-world-changing-on-its-own.ts` does not. The field has been on the row
// since the row was written, is documented there as "null for no deadline,
// which is common", and is written by nobody at all.
//
// So every want in the world read as RESERVED, every holder was negotiable,
// nobody was ever desperate, and the case the design owner cared about most -
// *my son is dying tonight and you have the medicine* - could not occur. The
// mechanism was correct and there was nothing to drive it.
//
// That is this project's oldest defect wearing a new coat. `AGENTS.md` files
// it as **a module nothing calls**; this is the same failure one size smaller:
// **a field nothing writes.** Worth looking for deliberately, because it reads
// even more like a finished feature than the other one does - the schema is
// right, the predicate is right, the tests pass, and the column is empty.
//
// ── AND THE FIX IS NOT TO GO AND WRITE ONE ───────────────────────────────
//
// A date stamped onto a goal row at seeding is a lie by the second year. The
// holder advances a rung and their settling clock resets; they are healed, or
// wounded, or the person the want was about dies. A stored deadline records
// what was true once and then quietly stops being true, which is worse than
// an empty column because nothing looks wrong.
//
// So nothing here writes the field. The date is DERIVED, at the moment it is
// asked for, from clocks the world already keeps and already moves:
//
//   THE SETTLING CLOCK   `lastAdvancedOnDay` plus the plateau the realm
//                        allows. Past it the climb is over - not the body, the
//                        CLIMB - and `stagnationYearsForOrdinal` is the
//                        world's own statement of how long that is. This is
//                        the clock the setting actually runs on: fifty years at
//                        the bottom, a thousand near the top.
//   THE LIFESPAN CLOCK   `lifespanEndsOnDay`. What a rung buys is time, and
//                        this is the row that says how much is left.
//   SOMEBODY ELSE'S      when the want points AT a person, their two clocks
//                        are the want's clocks. A want about a child is dated
//                        by the child.
//
// The soonest of those is the date. `goal.deadlineOnDay` still wins where
// somebody has authored one, because an authored fact should always beat a
// derived one - that is the only reason the field survives.
//
// ── AND THERE IS NO LIST OF URGENT WANTS ─────────────────────────────────
//
// `AGENTS.md` again: if a tenth kind of urgency needs a branch, the shape is
// wrong. Nothing below asks what the want IS. It asks whose want it is and who
// it is about, and reads their clocks. A want nobody has invented yet, held by
// somebody with four years of plateau left, is urgent here without a line of
// code - and the same want held by somebody who advanced last year is not.
//
// Which is also why every want ends up with a date and only a few are
// pressing. Being dated is ordinary; the date being CLOSE is the event, and
// {@link A_NEED_IS_PRESENT_WITHIN_DAYS} is the one threshold that decides it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two clocks a person carries, as absolute days.
 */
export interface TheClocksSomebodyIsUnder {
    /** Their rung. Decides how long a plateau the realm allows. */
    ordinal: number;
    /** Absolute day of their most recent advance. The settling clock starts here. */
    lastAdvancedOnDay: number;
    /** Absolute day the body runs out. */
    lifespanEndsOnDay: number;
}

/**
 * The day this person's climb ends if nothing changes.
 */
export function theDayTheClimbRunsOut(who: TheClocksSomebodyIsUnder): number {
    return who.lastAdvancedOnDay
        + stagnationYearsForOrdinal(Math.max(0, who.ordinal)) * DAYS_PER_YEAR;
}

/** The soonest of the clocks somebody is under. */
export function theDaySomethingRunsOutFor(who: TheClocksSomebodyIsUnder): number {
    return Math.min(theDayTheClimbRunsOut(who), who.lifespanEndsOnDay);
}

/**
 * When this want runs out of time, or null where nothing under it is running.
 */
export function whenThisWantRunsOut(
    goal: NpcGoal,
    holder: TheClocksSomebodyIsUnder | null,
    /** The clocks of whoever `targetId` names, when it names a person. */
    target: TheClocksSomebodyIsUnder | null = null
): number | null {
    if (goal.deadlineOnDay !== null) return goal.deadlineOnDay;
    const days = [holder, target]
        .filter((who): who is TheClocksSomebodyIsUnder => who !== null)
        .map(theDaySomethingRunsOutFor);
    return days.length === 0 ? null : Math.min(...days);
}

/**
 * Whether this want cannot wait.
 */
export function aWantThatCannotWait(
    goal: NpcGoal,
    holder: TheClocksSomebodyIsUnder | null,
    target: TheClocksSomebodyIsUnder | null,
    onDay: number
): boolean {
    const runsOut = whenThisWantRunsOut(goal, holder, target);
    return runsOut !== null && runsOut - onDay <= A_NEED_IS_PRESENT_WITHIN_DAYS;
}
