/**
 * WHAT THE PERSON IN FRONT OF YOU IS AFTER, AND WHETHER YOU ARE PART OF IT.
 *
 * The player-facing half of the resolver term that had never been supplied.
 * `whatTheyWantThatYouCouldReach` decides whether somebody's open business
 * touches the person asking; this says it in sentences, and says what would
 * make it touch them when it does not.
 *
 * ── WHY THIS IS A VERB AND NOT ONLY A TERM ───────────────────────────────
 *
 * `asking.md` names the lever this is: *"someone who has reason to talk to you
 * - a master, a debtor, someone who wants something - gives a real answer"*,
 * and it is the one the file says is *"available to a cultivator with
 * nothing"*. A term the engine reads and the player cannot see is a term the
 * player cannot play toward, so the odds would move for reasons nobody could
 * act on. Wiring the term without the verb would be half the same defect.
 *
 * ── AND IT IS GATED, BECAUSE WANTING SOMETHING IS NOT PUBLIC ─────────────
 *
 * Nobody hands over their business to a stranger who asked. The gate is the
 * one row that already means "they have reason to deal with you": THEIR side
 * of the tie, which `resolveAttempt` writes only when an attempt has actually
 * landed - a drink stood, a visit paid, a favour done, a request agreed to.
 * The player's own side does not count and must not, because a player who has
 * noticed somebody is not somebody that person has dealt with.
 *
 * The refusal that follows from a missing tie names four acts, and every one
 * of them is a sentence `courtesyPaidTo` accepts. That is the rule this file
 * is written under - a refusal may only name a door that exists - and the
 * first draft of the asking refusals broke it by quoting the design document
 * at the player.
 *
 * Pure. Rows and a matched goal in, `EngineFacts` out. No repository, no
 * catalog, no I/O.
 */

import type {
    AWantYouCouldReach,
    SomebodyWithGoals
} from '../engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
import type { NpcGoal } from '../engine/world/npc-state.js';
import type { TheClocksSomebodyIsUnder } from '../engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
import {
    A_NEED_IS_PRESENT_WITHIN_DAYS,
    whenThisWantRunsOut
} from '../engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
import type { EngineFacts } from './facts.js';
import { rungAndOrdinal } from './facts.js';

// ─────────────────────────────────────────────────────────────────────────
// THE PIECES
// ─────────────────────────────────────────────────────────────────────────

/**
 * How long they have wanted it, which is most of what a goal means.
 *
 * "He has wanted this for forty years" is a fact about the world and not a
 * mood - `npc-state.ts` says so in its own header, and a goal row carries its
 * opening day precisely so this sentence can be true rather than atmospheric.
 */
function howLongTheyHaveWantedIt(goal: NpcGoal, today: number): string {
    const days = Math.max(0, today - goal.openedOnDay);
    const years = Math.floor(days / 365);
    if (years >= 1) {
        return `They have wanted it for ${years} year${years === 1 ? '' : 's'}`;
    }
    if (days >= 30) {
        const months = Math.floor(days / 30);
        return `They have wanted it for ${months} month${months === 1 ? '' : 's'}`;
    }
    return 'It is recent';
}

/**
 * How long they have left, which is the half that was missing entirely.
 *
 * Nothing in this world writes `deadlineOnDay`, so every want read as
 * open-ended and nobody was ever in a hurry. The date is derived from the
 * clocks they are under - the plateau the realm allows, and the body - so it
 * is true when it is read and cannot go stale on the row.
 *
 * Said in the two registers the answer actually has. A want with years on it
 * is a fact about somebody's life; a want with months on it is the thing they
 * will trade anything for, and a player who is not told which is which cannot
 * tell a negotiation from an emergency.
 */
function howLongTheyHaveLeft(
    goal: NpcGoal,
    holder: TheClocksSomebodyIsUnder | null,
    target: TheClocksSomebodyIsUnder | null,
    today: number
): string | null {
    const runsOut = whenThisWantRunsOut(goal, holder, target);
    if (runsOut === null) return null;
    const left = runsOut - today;
    if (left <= A_NEED_IS_PRESENT_WITHIN_DAYS) {
        return left <= 0
            ? 'And they are out of time for it. Whatever was going to happen has stopped '
              + 'being able to, which is a thing they know and have not said out loud.'
            : `And they have about ${Math.max(1, Math.round(left / 30))} month`
              + `${Math.round(left / 30) === 1 ? '' : 's'} left for it. Somebody with that much `
              + 'time is not negotiating; anything that reaches it, reaches them.';
    }
    const years = Math.round(left / 365);
    return `They have about ${years} year${years === 1 ? '' : 's'} before it stops being `
        + 'possible, which is long enough that they can afford to be difficult about how it '
        + 'happens.';
}

/** What the row says is in the way, in the words whoever opened it wrote. */
function whatIsInTheWay(goal: NpcGoal): string | null {
    const said = goal.obstacles.filter(line => line.trim().length > 0);
    if (said.length === 0) return null;
    return `What is in the way, as they tell it: ${said.join(' ')}`;
}

/**
 * Which row made the asker part of it, said as a thing they are carrying.
 *
 * Never "your realm", because the reading deliberately does not read one.
 */
const BECAUSE_OF: Readonly<Record<AWantYouCouldReach['because'], string>> = {
    it_is_about_you: 'and it is about you by name, which is as close to the thing as anybody '
        + 'gets',
    your_house: 'and the house you stand in is part of it',
    your_purse: 'and what you are carrying is a year of what somebody at their rung earns, '
        + 'which is money to them whatever it is to you',
    your_shelf: 'and you are carrying a road they have not walked'
};

/**
 * What WOULD make the asker part of it, when nothing does.
 *
 * One clause per reading the engine actually runs, so the advice cannot drift
 * from the predicate: each of these is the negation of a branch in
 * `whatTheyWantThatYouCouldReach` and there is nothing here that is not.
 */
function whatWouldReachIt(goal: NpcGoal, them: SomebodyWithGoals): string {
    switch (goal.kind) {
        case 'wealth':
        case 'debt':
            return 'Money would reach it, and the figure is a year of what somebody at '
                + `${rungAndOrdinal(them.ordinal)} earns rather than a sum that sounds large.`;
        case 'cultivation':
            return 'A road they have not walked would reach it. They are carrying '
                + `${them.holds.length} art${them.holds.length === 1 ? '' : 's'}, and anything `
                + 'on your sheet that is not on theirs is a thing they want.';
        case 'status':
            return 'A rank inside a house that is not theirs would reach it. Standing above '
                + 'them does not: what they are short of is somebody placed to speak for them, '
                + 'and that is a position rather than a rung.';
        default:
            return 'Nothing you are carrying reaches it, and nothing about your rung would. '
                + 'What moves this one is being the person it is about.';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// THE THREE ANSWERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The four acts that make somebody a person you have dealt with.
 *
 * Every one is a phrasing `courtesyPaidTo` matches, checked against it. They
 * cost a day and no stones, which `asking.md` requires: a price would make the
 * cheapest lever in the game false.
 */
const THE_FOUR_THINGS =
    'Buy them a drink, sit with them, do them a small favour, or turn up where they are. '
    + 'Each costs a day and nothing else, and each is the only thing in the game that moves '
    + 'a stranger toward telling you anything.';

/** They have never dealt with you, so their business is not yours to have. */
export function factsForSomebodyWhoWillNotSay(name: string): EngineFacts {
    const scene =
        `You could ask ${name} what they are after and they would tell you what anybody tells `
        + 'a stranger, which is the weather and a civil nothing. People do not hand over their '
        + `business because it was asked for. ${THE_FOUR_THINGS}`;
    return {
        headline: `${name} has no reason to tell you.`,
        lines: [scene],
        prose: scene,
        structure: [
            'No tie from them to the asker. Their side of the relationship is written only by '
            + 'an attempt that landed, so a courtesy that comes off is what opens this read - '
            + 'the player\'s own side of the tie is deliberately not the gate.'
        ]
    };
}

/** The record holds nothing about what they want. An honest absence. */
export function factsForSomebodyWithNoOpenBusiness(name: string): EngineFacts {
    const scene =
        `${name} talks to you readily enough and there is nothing they are chasing. Some `
        + 'people want a quiet decade and are having one. Nothing about them is a lever, and '
        + 'a request put to them will be answered on its own merits and on what the two of you '
        + 'already are.';
    return {
        headline: `${name} is not after anything.`,
        lines: [scene],
        prose: scene,
        structure: [
            'No open goal rows. The `wants` term of the attempt resolver reads zero for this '
            + 'person, and correctly.'
        ]
    };
}

/**
 * What they are after, said out.
 *
 * The reach is the payload: a player who is told that what they are carrying
 * is part of somebody's business has been handed the lever, and a player told
 * it is not has been told what would be.
 */
export function factsForWhatTheyAreAfter(
    name: string,
    them: SomebodyWithGoals,
    top: NpcGoal,
    reach: AWantYouCouldReach | null,
    today: number,
    /** The clocks of whoever the want points at, when it points at a person. */
    aboutSomebody: TheClocksSomebodyIsUnder | null = null
): EngineFacts {
    const lines: string[] = [
        `${name}, once they are talking, is after one thing more than the rest: ${top.text}`
    ];
    if (top.progress.trim().length > 0) {
        lines.push(`Where they have got to: ${top.progress.trim()}`);
    }
    const inTheWay = whatIsInTheWay(top);
    if (inTheWay) lines.push(inTheWay);
    lines.push(`${howLongTheyHaveWantedIt(top, today)}.`);
    const left = howLongTheyHaveLeft(top, them.clocks ?? null, aboutSomebody, today);
    if (left) lines.push(left);

    if (reach && reach.goal.id === top.id) {
        lines.push(
            `You are part of it ${BECAUSE_OF[reach.because]}. Somebody who can move the thing `
            + 'you are chasing is not somebody you refuse the way you refuse a stranger, and '
            + 'anything you ask them from here is asked with that behind it.'
        );
    } else if (reach) {
        lines.push(
            `That is not the one you are part of. ${reach.goal.text} is, `
            + `${BECAUSE_OF[reach.because]}, and it is the one carrying anything you ask them.`
        );
    } else {
        lines.push(whatWouldReachIt(top, them));
    }

    const others = them.goals.filter(goal => goal.id !== top.id).length;
    if (others > 0) {
        lines.push(
            `There ${others === 1 ? 'is' : 'are'} ${others} other thing${others === 1 ? '' : 's'} `
            + 'they are carrying, none of them as heavy as this.'
        );
    }
    lines.push('Nothing was asked of them. No day passed and nothing changed hands.');

    return {
        headline: `What ${name} is after.`,
        lines,
        prose: lines.join(' '),
        structure: [
            `${them.goals.length} open goal row${them.goals.length === 1 ? '' : 's'}, read at `
            + `priority ${top.priority.toFixed(2)}, kind "${top.kind}", opened on day `
            + `${top.openedOnDay}.`,
            (() => {
                const runsOut = whenThisWantRunsOut(top, them.clocks ?? null, aboutSomebody);
                return runsOut === null
                    ? 'No date on it and no clock under its holder, so it cannot be told from a '
                      + 'want with all the time in the world.'
                    : `Runs out on day ${runsOut}${top.deadlineOnDay === null
                        ? ', derived from the clocks they are under rather than stamped on the '
                          + 'row - the row carries no date, because nothing in this world writes '
                          + 'one'
                        : ', authored on the row itself'}.`;
            })(),
            reach === null
                ? 'The `wants` term of the attempt resolver reads zero against this asker: no '
                + 'goal row is pointed at them, at their house, at a purse worth a year of this '
                + 'person\'s earnings, or at a road this person has not walked.'
                : 'The `wants` term of the attempt resolver is carried by goal '
                + `"${reach.goal.id}" (${reach.because}), and every attempt put to them prices `
                + 'it.'
        ]
    };
}
