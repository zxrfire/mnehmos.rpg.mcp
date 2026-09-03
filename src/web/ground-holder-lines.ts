/**
 * Who answers for the ground somebody is standing on, in their own words.
 *
 * ── THE GAP THIS EXISTS TO CLOSE ─────────────────────────────────────────
 *
 * `whoHoldsTheGround` had exactly two callers in `src/`, both of them inside
 * the NPC simulation. The played game never asked it, so **the one thing that
 * makes unheld ground different was live for every NPC and invisible to the
 * player** - and it was not inert, because `ground-trust.ts` was already moving
 * the player's odds off it. Somebody was being priced on a fact the game would
 * not tell them.
 *
 * Measured, on a fresh run that opens at the Meet on The Blown Ground. Five
 * phrasings, five wrong answers, none of them the one true sentence:
 *
 *   "I ask who holds this ground"  routed to an NPC, and the resolve failed:
 *                                  "a sentence with a hole in it"
 *   "who holds this ground"        routed to `destinations`, which answered
 *                                  with the province's realm ceiling
 *   "whose ground is this"         the same
 *   "who is in charge here"        routed to `sect`, and answered about the
 *                                  PLAYER's affiliation. "Unaffiliated."
 *   "who do I complain to here"    unclear
 *
 * The second is the one worth naming: it printed *"You are in The Meet, The
 * Blown Ground"* and then said what the ground carries, standing on the one
 * province in the world where the answer to who holds it is nobody.
 *
 * ── WHAT IS VOLUNTEERED, AND WHAT ONLY ANSWERS ───────────────────────────
 *
 * AGENTS.md: *the world volunteers.* But it volunteers a FACT ABOUT THE WORLD,
 * never a fact about the paperwork - so `lines` is non-empty for exactly the
 * two readings where nobody holds the ground, and empty for the two where
 * somebody does or where the register merely has nothing to say. Standing in a
 * ruin and being told the survey never described it is the engine talking to
 * itself in front of the player, and it would print over most of the map:
 * measured on a seeded world, 113 of 435 people stand on `unrecorded` ground.
 *
 * `answer` is always present, because somebody who ASKED is owed the answer
 * whichever of the four it is. That asymmetry is the whole design here.
 *
 * ── AND EVERY ANSWER NAMES A ROUTE ───────────────────────────────────────
 *
 * A lower number with no sentence attached is the defect this repository keeps
 * finding. What each reading buys is stated as *what you do about being wronged
 * here*, which is the same axis `ground-trust.ts` prices on - so the prose and
 * the arithmetic cannot drift, because both are keyed on `GroundRecourse`.
 *
 * PURE. Records in, lines out. No I/O, no DB, nothing stochastic.
 */

import {
    theGroundUnderYou,
    type GroundRecourse
} from '../engine/social-leverage/ground-trust.js';
import {
    whoHoldsTheGround,
    type GroundHolding
} from '../engine/world/ground-holder.js';
import type { LocationRecord } from '../engine/world/locations.js';

export interface GroundHolderInput {
    locations: readonly LocationRecord[];
    /** The place being asked about. Its whole containing chain is read. */
    locationId: string;
    /** True when this is the ground under their feet rather than somewhere asked after. */
    standingHere: boolean;
}

export interface GroundHolderReading {
    holding: GroundHolding;
    /** Null for every reading but `held`, and for a holder nothing can place. */
    holderName: string | null;
    placeName: string | null;
    /** What `look` adds without being asked. Empty when there is nothing to say. */
    lines: string[];
    /** What somebody who asked gets. Always said, whichever of the four it is. */
    answer: string;
    /** One factual line for the mechanical channel. */
    structure: string;
}

/**
 * What each reading means for somebody who is wronged here, and what they do
 * about it.
 *
 * Keyed on {@link GroundRecourse} and not on the holding, because the route out
 * of being wronged is the same question `ground-trust.ts` prices - so a fifth
 * answer tomorrow needs one row here and one number there, and the two cannot
 * describe different worlds.
 */
const WHAT_TO_DO_ABOUT_IT: Readonly<Record<GroundRecourse, string>> = {
    taken_up:
        'Take a wrong to them and it stops being your problem alone.',
    collected:
        'Take a wrong to them and it goes in the book, which is a thing you can point at '
        + 'later rather than a thing anybody will act on.',
    the_member_is_priced:
        'What you have instead is whoever already knows you.',
    unheld_inside_a_province:
        'So take it to whoever keeps the place running, and expect to be asking a favour '
        + 'rather than invoking a right.',
    the_record_does_not_say:
        'Ask somebody standing here. The silence is the register\'s and not the ground\'s.',
    none:
        'What is worth anything here is somebody who already knows you.'
};

/**
 * Which readings the world says out loud without being asked.
 *
 * The two where nobody holds the ground, and only those. See the header: an
 * absent register is a fact about paper and volunteering it everywhere would
 * be a dump over most of the map.
 */
const VOLUNTEERED: ReadonlySet<GroundHolding> = new Set<GroundHolding>([
    'no_authority',
    'no_holder_of_record'
]);

/** Who answers for this ground, and what a person standing on it could say. */
export function whoAnswersForThisGround(input: GroundHolderInput): GroundHolderReading {
    const holding = whoHoldsTheGround(input.locations, input.locationId);
    const ground = theGroundUnderYou(holding);
    const route = WHAT_TO_DO_ABOUT_IT[ground.recourse];

    const volunteers = input.standingHere && VOLUNTEERED.has(holding.holding);

    return {
        holding: holding.holding,
        holderName: holding.holderName,
        placeName: holding.placeName,
        lines: volunteers ? [holding.why, route] : [],
        answer: `${ground.why} ${route}`,
        structure:
            `whoHoldsTheGround: ${holding.holding}`
            + (holding.holderName ? ` by ${holding.holderName}` : '')
            + (holding.answeredAtId ? `, answered at ${holding.answeredAtId}` : '')
            + `. Recourse ${ground.recourse}.`
    };
}
