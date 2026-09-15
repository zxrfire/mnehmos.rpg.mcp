/**
 * WHETHER A NAMED HOUSE WOULD HAVE YOU, WHICH IS ASKED BEFORE CROSSING A PROVINCE.
 *
 * Every fact in the answer was already computed and none of it could be asked
 * for about ONE house. `sect_manage.list` derives, per house, whether the bar is
 * cleared, which rank the asker would be seated at, whether the second door is
 * open and how their root reads at it - and the only sentence that reached it
 * was the bare `would they take me`, which answers about every house the asker
 * has heard of at once.
 *
 * ── "IT NEEDS ADJACENCY" WAS AN ASSUMPTION, AND THE PATTERN WAS THE GATE ─────
 *
 * The bar is catalog: `admissionOrdinal`, `getSectAdmission`, the house's own
 * shelf, and the asker's rung and root. Not one of those reads where anybody is
 * standing. What the engine does gate is KNOWLEDGE - `resolveSect` refuses a
 * name nobody has said in front of you - and that gate is kept here, unchanged.
 *
 * The adjacency that actually blocked the sentence was in a regular expression.
 * `would (?:take|have) me` requires the two words to sit next to each other, and
 * `WHO_WOULD_TAKE_SOMEBODY_LIKE_ME` lists the four pronouns that can go between
 * them - anyone, anybody, any of them, they. A house's NAME between "would" and
 * "take" matched neither, so `would the Azure Dew Sect take me` reached nothing
 * for all 38 houses while `would they take me` reached the listing.
 *
 * ── AND IT MAY NOT GO TO THE JOIN PATH ───────────────────────────────────────
 *
 * `{ action: 'sect', target: <house> }` RESOLVES AND JOINS. Routing the question
 * there would answer "would they take me" by walking up to the gate and getting
 * an answer that is permanent either way, which is the asking-is-not-doing rule
 * with the largest possible price on it. So this is a `look`, it is free, and it
 * states the bar.
 *
 * ── CLEARING A BAR IS NOT BEING TAKEN ────────────────────────────────────────
 *
 * The same ruling the listing already keeps, for the same measured reason: the
 * listing once said "the Azure Dew Sect would take you as a Dew Servant", the
 * player walked a day on it, and the door came back `not_taken_on`. Whether
 * somebody is TAKEN is a roll at the gate off rungs past the bar, charm, and
 * whether the house has watched them leave once already. So this read states
 * what the house asks for and never what it will answer.
 */

import { rankName } from '../engine/cultivation/realms.js';

/** How an asker's own root reads at a house's door. */
export type RootAtTheDoor = 'welcome' | 'weighted' | 'refused';

export interface WhatTheirDoorAsks {
    houseName: string;
    /** The rung the house's published bar sits at. */
    admitsFrom: number;
    /** Where the asker stands, which is the other half of the comparison. */
    standsAt: number;
    /** Whether the house takes people on at all. */
    recruits: boolean;
    /**
     * Whether the bar is cleared. Null where the caller could not read the
     * asker's rung, which is not the same as a closed door and never said as one.
     */
    clearsTheBar: boolean | null;
    /** The rank the bar seats them at, where it is cleared. */
    wouldEnterAtRank: string | null;
    /** How the asker's own root reads at that door, or null where unread. */
    rootAtTheDoor: RootAtTheDoor | null;
    /** The catalog's own entrance requirement, in the catalog's own words. */
    requirement: string | null;
    /** The second door: an intake that carries people below the bar. */
    guestDoorOpen: boolean;
    /**
     * A floor that is not a rung and never becomes one, in the words the house
     * states it in, or null. See `theDoorIsShutTo`.
     */
    shutToThem: string | null;
    lines: string[];
    structure: string;
}

export function whatTheirDoorAsks(input: {
    houseName: string;
    admitsFrom: number;
    standsAt: number;
    recruits: boolean;
    clearsTheBar: boolean | null;
    wouldEnterAtRank: string | null;
    rootAtTheDoor: RootAtTheDoor | null;
    requirement: string | null;
    guestDoorOpen: boolean;
    shutToThem: string | null;
}): WhatTheirDoorAsks {
    const lines: string[] = [];

    lines.push(
        `${input.houseName} admits from ${rankName(input.admitsFrom)}. `
        + `You stand at ${rankName(input.standsAt)}.`
    );

    // A FLOOR THAT IS NOT A RUNG COMES FIRST, because every sentence under it
    // would be about a bar that is not the thing stopping them. Said in the
    // house's own words, which is where the reason lives.
    if (input.shutToThem !== null) {
        lines.push(input.shutToThem);
        lines.push(
            'That is not a bar that rises with rank, and standing higher does not move it.'
        );
        return finish(input, lines);
    }

    if (!input.recruits) {
        lines.push(
            `${input.houseName} is not taking people on. There is a bar and there is nobody `
            + 'behind it; whatever the rung says, the door is not the thing to work on.'
        );
        return finish(input, lines);
    }

    if (input.rootAtTheDoor === 'refused') {
        lines.push(
            `${input.houseName} teaches one road and it is not one your root walks. A spirit `
            + 'root is rolled once, so this is not a door that opens later - the house has no '
            + 'second book to put you on.'
        );
        return finish(input, lines);
    }

    if (input.clearsTheBar === true) {
        lines.push(
            input.wouldEnterAtRank === null
                ? 'You stand above their bar.'
                : 'You stand above their bar, and it seats somebody at your standing as '
                  + `${input.wouldEnterAtRank}.`
        );
    } else if (input.clearsTheBar === false) {
        const short = input.admitsFrom - input.standsAt;
        lines.push(
            short > 0
                ? `You are ${short === 1 ? 'one rung' : `${short} rungs`} short of it.`
                : 'You do not clear it as you stand.'
        );
    }

    // THE SECOND DOOR IS SAID EVEN WHERE THE FIRST IS OPEN, because a house
    // that would take somebody on either footing has told them two different
    // things about what the next century costs.
    if (input.guestDoorOpen) {
        lines.push(
            'Their intake is open to you now. That is not membership and it is not a discount '
            + 'on the bar - they take people at the floor, carry them, and decide about them '
            + 'later, and the bar is still waiting at the far end of it.'
        );
    }

    if (input.rootAtTheDoor === 'weighted') {
        lines.push(
            'Yours is not the root they look for. It is not a refusal and it is weighed '
            + 'against you at the gate.'
        );
    }

    if (input.requirement !== null && input.requirement.trim().length > 0) {
        lines.push(`What they ask for: ${input.requirement.trim()}`);
    }

    lines.push(
        'None of this has happened. This is their bar, not their answer - walking up '
        + 'unannounced is a look and it can go against you, and somebody putting you in front '
        + 'of them moves it more than standing higher does.'
    );

    return finish(input, lines);
}

function finish(
    input: Parameters<typeof whatTheirDoorAsks>[0],
    lines: string[]
): WhatTheirDoorAsks {
    return {
        houseName: input.houseName,
        admitsFrom: input.admitsFrom,
        standsAt: input.standsAt,
        recruits: input.recruits,
        clearsTheBar: input.clearsTheBar,
        wouldEnterAtRank: input.wouldEnterAtRank,
        rootAtTheDoor: input.rootAtTheDoor,
        requirement: input.requirement,
        guestDoorOpen: input.guestDoorOpen,
        shutToThem: input.shutToThem,
        lines,
        structure:
            `whatTheirDoorAsks(${input.houseName}): admits from ${input.admitsFrom}, asker at `
            + `${input.standsAt}; clears=${input.clearsTheBar ?? 'unread'}, `
            + `recruits=${input.recruits}, root=${input.rootAtTheDoor ?? 'unread'}, `
            + `guestDoor=${input.guestDoorOpen}, shut=${input.shutToThem !== null}. `
            + 'Read only, nothing spent, nobody asked.'
    };
}
