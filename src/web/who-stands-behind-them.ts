/**
 * WHO STANDS BEHIND THEM, AND WHETHER ANYBODY STILL ANSWERS.
 *
 * The question anybody in this genre asks before they move against a house, and
 * the engine had no sentence for it. `crossings.ts` carries the whole answer -
 * every crossing a house has ever produced, who it was, how long ago, whether
 * anything still comes down and at what grade, and what the count buys in
 * silences the house can survive - and seven of its readers had no caller:
 * `getLineageStanding`, `lineageTierFor`, `hasAnsweringChannel`,
 * `answeringChannels`, `standingsAreNotATotalOrder`, `ARCHIVE_AS_CLAIM`,
 * `PAVILION_SURPLUS`.
 *
 * ── THE GAP BETWEEN THE RECKONING AND THE SHELF IS THE WHOLE GAME ────────
 *
 * A house's TIER is public. It is a count of crossings run through a table
 * everybody uses, it does not move, and a founder who went up thirty-four
 * centuries ago counts exactly as much in it as somebody who went up last
 * century. Anybody can say it and everybody does.
 *
 * What is not public is whether anything still ARRIVES. The Storm Tyrant Court
 * is `supreme` on the table and its shelf is bare - *"famous for refusing, and
 * the refusal costs it nothing, which is a comfortable position until somebody
 * works out that the shelf behind it is bare. Nobody has, in thirty-four
 * hundred years, because nobody has had a reason to look."* The Azure Cloud
 * Pavilion is the lowest tier of any house that has one, and has the deepest
 * stock in the world and a channel that answers every nine to fourteen years.
 *
 * So this read is GATED, and the gate is the point rather than a difficulty
 * dial. A cultivator low on the ladder gets the public reckoning, which is what
 * everybody in the world would tell them and is TRUE - it is simply not the
 * thing that decides whether the house can answer. Somebody who has climbed
 * gets the depletion, the trend, and whether a channel is still open, which is
 * what the houses themselves reason from.
 *
 * Nobody gets certainty about a house's private position, because nobody in
 * the world has it - the Survey does not know whether two of its three channels
 * are quiet or finished, and says so.
 *
 * ── AND THERE IS NO SINGLE RANKING, WHICH IS ANSWERED RATHER THAN DODGED ─
 *
 * `standingsAreNotATotalOrder` says it: three questions, three different
 * orderings, no way to combine them, and *"anybody who produces a single
 * ranking has chosen an axis and not said so."* So "which house is greatest"
 * gets all three orderings and the reason there is no fourth. That is a better
 * answer than a number and it is the honest one.
 */

import {
    ARCHIVE_AS_CLAIM,
    IMMORTAL_CHANNELS,
    type LineageStanding,
    answeringChannels,
    getLineageStanding,
    hasAnsweringChannel,
    lineageTierFor,
    standingsAreNotATotalOrder
} from '../data/cultivation/crossings.js';

/**
 * How much of the answer somebody at this height gets.
 *
 * The bands are the ladder's own, not new ones: the public reckoning is what
 * anybody in a market can tell you, the depletion read is what somebody who
 * deals with houses knows, and the last band is what the houses reason from
 * about each other.
 */
export type HowMuchTheyKnow = 'the_public_reckoning' | 'what_still_arrives' | 'what_it_costs_them';

/** Where the ladder cuts. Read from the same tiers everything else reads. */
const KNOWS_WHAT_ARRIVES_AT = 15;
const KNOWS_WHAT_IT_COSTS_AT = 30;

export function howMuchTheyKnowAt(ordinal: number): HowMuchTheyKnow {
    if (ordinal >= KNOWS_WHAT_IT_COSTS_AT) return 'what_it_costs_them';
    if (ordinal >= KNOWS_WHAT_ARRIVES_AT) return 'what_still_arrives';
    return 'the_public_reckoning';
}

export interface WhoStandsBehindThem {
    factionId: string;
    houseName: string;
    /** Null where the house has never produced one, which is most houses. */
    standing: LineageStanding | null;
    reach: HowMuchTheyKnow;
    lines: string[];
    structure: string;
}

/**
 * What this cultivator can find out about who is above that house.
 */
export function whoStandsBehindThem(input: {
    factionId: string;
    houseName: string;
    readerOrdinal: number;
}): WhoStandsBehindThem {
    const standing = getLineageStanding(input.factionId) ?? null;
    const reach = howMuchTheyKnowAt(input.readerOrdinal);
    const lines: string[] = [];

    // ── NOBODY, AND THAT IS THE ORDINARY CASE ────────────────────────────
    //
    // Most houses in the world have never produced a crossing. Saying so
    // plainly is a real answer and the commonest true one - and it is what
    // makes the houses that HAVE one worth being careful about.
    if (!standing) {
        return {
            factionId: input.factionId,
            houseName: input.houseName,
            standing: null,
            reach,
            lines: [
                `Nobody stands behind ${input.houseName}. It has never put anybody across, `
                + 'which is true of almost every house in the world and is why the few that '
                + 'have are spoken of the way they are. What it has is what it has here.'
            ],
            structure: `getLineageStanding(${input.factionId}): no row. `
                + 'The house has no crossing on any record, which is the ordinary case.'
        };
    }

    // ── THE PUBLIC RECKONING, WHICH EVERYBODY HAS ────────────────────────
    const roll = standing.roll;
    const tier = lineageTierFor(standing.count);
    lines.push(
        `${input.houseName} is reckoned ${tier.replace(/_/g, ' ')}: `
        + `${standing.count} crossing${standing.count === 1 ? '' : 's'} in its whole history. `
        + (standing.mostRecentCrossingName
            ? `The last was ${standing.mostRecentCrossingName}, `
              + `${yearsInWords(standing.mostRecentCrossingYearsAgo)} ago. `
              + `${standing.mostRecentCrossingNote ?? ''}`
            : `The last was ${yearsInWords(standing.mostRecentCrossingYearsAgo)} ago and the `
              + 'house does not use a name for them.')
    );
    // The table is a COUNT and nothing else, which is worth saying to somebody
    // who is about to reason from it.
    if (roll.length > 1) {
        lines.push(
            `On the roll: ${roll.map(r => `${r.title} (${yearsInWords(r.yearsAgo)} ago)`).join('; ')}.`
        );
    }
    if (reach === 'the_public_reckoning') {
        lines.push(
            'That is the reckoning, and it is a count. What it does not say is whether any of '
            + 'them still answers, which is the part that would decide anything - and finding '
            + 'that out is not something anybody would tell somebody standing where you are.'
        );
        return {
            factionId: input.factionId,
            houseName: input.houseName,
            standing,
            reach,
            lines,
            structure: theStructure(standing, reach)
        };
    }

    // ── WHETHER ANYTHING STILL ARRIVES, AND ON WHAT TERMS ────────────────
    //
    // THREE CASES AND NOT TWO. `hasAnsweringChannel` answers a narrower
    // question than this one - it is true only of the kind that answers at
    // intervals measured in ages - and a house with a PERSONAL channel is not
    // covered by it and is the strongest position in the world. Reading the
    // boolean alone told the Azure Cloud Pavilion, whose channel answers every
    // nine to fourteen years and whose stock is rising, that nothing was
    // arriving, and then said the stock was rising in the next line.
    const channel = IMMORTAL_CHANNELS.find(row => row.factionId === input.factionId) ?? null;
    lines.push(channel?.kind === 'personal_channel'
        ? `Somebody up there answers them, and answers OFTEN, because what is at the far end `
          + `of it is a person rather than an institution. That is the strongest position `
          + `anybody holds and the most contingent: it lasts exactly as long as the reason `
          + `does.`
        : channel
            ? `Something still comes down to them, at intervals measured in ages. That is a `
              + `relationship rather than a hoard, and it is worth more than the count is: a `
              + `house with somebody at the far end of it is a house that can be answered for.`
            : standing.depletion === 'ended'
                ? `Nothing comes down to them any more, and has not within any record they `
                  + `keep. What they have is the name.`
                : `They hold what they hold. Nothing is arriving that anybody can point to.`);
    lines.push(
        `The stock is ${standing.trend}, ${standing.volume === 0
            ? 'and there is none of it'
            : `at ${standing.volume} object${standing.volume === 1 ? '' : 's'}`}`
        + `${standing.gradeCeiling === 'none'
            ? '.'
            : `, and the best grade they can reach for is ${standing.gradeCeiling}.`}`
    );

    if (reach === 'what_still_arrives') {
        return {
            factionId: input.factionId,
            houseName: input.houseName,
            standing,
            reach,
            lines,
            structure: theStructure(standing, reach)
        };
    }

    // ── AND WHAT THE POSITION ACTUALLY COSTS THEM ────────────────────────
    //
    // The house's own reasoning, which is what somebody at this height would
    // have heard from people who deal with them. Three fields, each written as
    // the specific rather than the general, and none of them summarised here.
    lines.push(standing.whatDepletionLooksLike);
    lines.push(standing.resilience);
    lines.push(standing.behaviour);

    // AND WHY A LOST NAME IS A CUT TIE. Said only where it bears: a house whose
    // record has gone is not being ignored, it has severed the thing that would
    // have made an answer happen, and that is not obvious.
    if (channel === null && standing.depletion !== 'ended') {
        lines.push(ARCHIVE_AS_CLAIM.bothDirections.upward);
    }

    return {
        factionId: input.factionId,
        houseName: input.houseName,
        standing,
        reach,
        lines,
        structure: theStructure(standing, reach)
    };
}

function theStructure(standing: LineageStanding, reach: HowMuchTheyKnow): string {
    return `getLineageStanding: count ${standing.count}, tier `
        + `${lineageTierFor(standing.count)}, depletion ${standing.depletion}, volume `
        + `${standing.volume}, ceiling ${standing.gradeCeiling}, trend ${standing.trend}. `
        + `hasAnsweringChannel ${hasAnsweringChannel(standing.factionId)} of `
        + `${answeringChannels().length} in the world. Reader saw ${reach.replace(/_/g, ' ')}; `
        + 'the tier is public and everything past it is not. Read only, nothing spent.';
}

/**
 * WHICH HOUSE STANDS HIGHEST, ANSWERED BY REFUSING TO PICK ONE.
 *
 * Three questions - who has the most ancestors, who holds the most, who can
 * reach the best grade - and they disagree. `standingsAreNotATotalOrder` says
 * why in its own words, and the honest answer is all three orderings plus that
 * sentence rather than a number nobody could defend.
 */
export function noHouseStandsHighest(nameOf: (factionId: string) => string): {
    lines: string[];
    structure: string;
} {
    const orders = standingsAreNotATotalOrder();
    return {
        lines: [
            'There is no answer to that, and the reason is worth having rather than being a '
            + 'dodge. Three questions get asked as one and they do not agree.',
            `By what still answers: ${orders.byChannel.map(nameOf).join(', then ')}.`,
            `By what is on the shelf: ${orders.byVolume.map(nameOf).join(', then ')}.`,
            `By the best grade anybody can reach: ${orders.byGrade.map(nameOf).join(', then ')}.`,
            orders.note
        ],
        structure: `standingsAreNotATotalOrder: ${orders.byChannel.length} house(s) ranked on `
            + 'three axes that disagree. No combined ordering is produced, deliberately. '
            + 'Read only, nothing spent.'
    };
}

/** Years, said the way somebody would say them rather than as a figure. */
function yearsInWords(years: number): string {
    if (years >= 1_000) {
        const thousands = Math.round(years / 100) / 10;
        return `about ${thousands} thousand years`;
    }
    if (years >= 100) return `about ${Math.round(years / 10) * 10} years`;
    return `${years} years`;
}
