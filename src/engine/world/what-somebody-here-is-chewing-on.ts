/**
 * What a person standing here has on their mind, which is what you overhear.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on a played square: *"the world doesn't feel alive nor
 * narrative at all"*, with two examples of what would fix it - *"you could
 * overhear a junior sister eating ramen while sighing about how tough it is"*,
 * *"a senior brother monologue about how nice his borrowed sword is"*.
 *
 * The square already said what everybody was AT. What it never said was what
 * anybody was preoccupied WITH, and those are different things: an activity
 * makes a person furniture that moves, and a preoccupation makes them somebody.
 *
 * There is an overhearing channel already and it is not this. `hearsay.ts`
 * carries `names: SpeakableName[]` and exists to leak proper nouns a player has
 * not earned yet, which is why an overheard conversation reads as two nouns and
 * a shrug: *"the sealed part of the sorting-yard ruin" ... "The Bitter Crossing
 * Ping"*. It does its job. Nobody in it is a person.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS AND IS NOT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It states a FACT about their situation and never their mood, per the standing
 * rule that the engine states facts and the narrator writes prose. "Has spent
 * most of the years this rung allows and is still at it" is a fact. Sighing
 * over a bowl of noodles about it is the narrator's, and is what the fact is
 * for.
 *
 * Every reading is DERIVED from rows the world already keeps - age against the
 * years a rung buys, the rank they wear, whether a house has marked them. There
 * is no stored "preoccupation" field, no new RNG draw, and nothing here that an
 * onlooker in the square could not work out for themselves.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND MOST PEOPLE HAVE NOTHING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `theOneThingWorthSayingAbout` states the rule this follows: *"most people say
 * nothing here, which is correct: a world where everybody is a character is a
 * world where nobody is."* The same applies with more force to speech. Three
 * people in a square all audibly preoccupied is a soap opera, and the third
 * time a player reads one they stop reading them - which is exactly how the
 * ambient qi line became wallpaper.
 *
 * So the bars are set where they exclude the ordinary case, and the caller
 * surfaces at most one of these per turn.
 */

import { lifespanForOrdinal } from '../cultivation/realms.js';

/**
 * How much of a rung's years have to be behind somebody before the road is
 * visibly running out.
 *
 * `lifespanForOrdinal` is the years the rung buys. Somebody most of the way
 * through them and still standing at the same wall is the genre's most common
 * background figure, and the one the owner's first example is about.
 */
export const THE_ROAD_IS_RUNNING_OUT = 0.55;

/**
 * And the other end, which is rarer and reads as its opposite: this little of
 * the rung's years spent, at a rung that takes most people decades.
 */
export const AHEAD_OF_THE_ROAD = 0.12;

/** Below this, a rung is common enough that being young at it means nothing. */
export const A_RUNG_WORTH_BEING_YOUNG_AT = 13;

export interface SomebodyWithSomethingOnTheirMind {
    /** Their rung, which sets what their years are measured against. */
    ordinal: number;
    /** Years behind them. */
    age: number;
    /** The rank they wear inside a house, where they wear one. */
    rank: string | null;
    /** Whether their house has marked them as its pick. */
    chosen: boolean;
    /**
     * WHAT THEY CARRY THAT IS NOT THEIRS, as a common noun, or null.
     *
     * The owner's second example: *"a senior brother monologue about how nice
     * his borrowed sword is"*. Nothing had to be invented for it. The
     * possessions table separates `ownerId` from `possessorId` precisely so a
     * house can lend somebody a thing, and `seeding.ts` names that case in its
     * own words when it builds the treasuries - *"lending a disciple a
     * furnace"*. A thing whose owner is a house and whose holder is a person
     * IS the borrowed sword, already, in the data.
     *
     * A COMMON NOUN AND NEVER THE THING'S NAME. What a person carries is
     * visible; what it is CALLED is a proper noun, and handing that over would
     * walk straight through the discovery gate. A blade is a blade to somebody
     * who has not been told otherwise.
     */
    carriesForTheirHouse: string | null;
}

/**
 * The lowest rung of a house, in the words houses actually use for it.
 *
 * Read off the rank NAME rather than an index because the caller has the name
 * and not the roll, and because houses do not agree on how many rungs they
 * have. A junior is a junior in any of them.
 */
const THE_BOTTOM_OF_A_HOUSE = /\b(?:outer|junior|servant|menial|probation|unranked)\b/i;

/**
 * WHAT THEY WOULD BE HEARD ON, or null where there is nothing.
 *
 * Ordered, and the order is the point: the thing most likely to be on somebody's
 * mind is the thing with a clock on it. Running out of road beats everything,
 * because it is the only one that gets worse on its own.
 */
export function whatTheyWouldBeHeardOnAbout(
    person: SomebodyWithSomethingOnTheirMind
): string | null {
    const years = lifespanForOrdinal(person.ordinal);
    const spent = years > 0 ? person.age / years : 0;

    // ── THE ROAD RUNNING OUT ─────────────────────────────────────────────
    //
    // The owner's junior sister, and the commonest figure in the setting: a
    // person who can see the end of what this rung bought them and is still
    // standing at the same wall. Said as the arithmetic, not as despair.
    if (spent >= THE_ROAD_IS_RUNNING_OUT) {
        return 'has spent most of the years this rung allows and is still standing at the same wall';
    }

    // ── A THING THAT IS NOT THEIRS ───────────────────────────────────────
    //
    // Second, above every reading about standing, because it is the most
    // concrete thing anybody here has and the only one with an object in it.
    // The register the owner named is a boast, and the reason a boast about a
    // borrowed thing lands is that everybody hearing it knows the terms: it is
    // theirs while they are useful, and the house can take it back.
    // `?? null` rather than a bare comparison: a caller that omits the field
    // entirely must read as nobody carrying anything, not as somebody carrying
    // an undefined.
    const borrowed = person.carriesForTheirHouse ?? null;
    if (borrowed !== null) return `carries a ${borrowed} their house owns and they do not`;

    // ── AHEAD OF IT ──────────────────────────────────────────────────────
    //
    // The mirror, and deliberately harder to hit: young at a rung that takes
    // other people most of a life. A house's pick reads as this from outside
    // whether or not the house has said so out loud.
    if (spent <= AHEAD_OF_THE_ROAD && person.ordinal >= A_RUNG_WORTH_BEING_YOUNG_AT) {
        return 'is young enough at this rung that the years are not the thing they worry about';
    }

    // ── MARKED BY A HOUSE ────────────────────────────────────────────────
    //
    // Not a rung and not an age: a decision somebody else made about them,
    // which is a different thing to carry and a noisier one.
    if (person.chosen) {
        return 'carries a house\'s mark as the one it decided to spend on';
    }

    // ── THE BOTTOM OF A ROLL ─────────────────────────────────────────────
    //
    // What a house asks of the people it asks most of. Last, because it is the
    // commonest and would otherwise drown the other three.
    if (person.rank !== null && THE_BOTTOM_OF_A_HOUSE.test(person.rank)) {
        return 'wears the lowest rank their house gives out, and is doing what that rank is for';
    }

    return null;
}

/**
 * A THING SOMEBODY CARRIES THAT BELONGS TO SOMEBODY ELSE, as a common noun.
 *
 * `ownerId` and `possessorId` are separate columns on the possessions table for
 * exactly this: the house owns it, the disciple has it. `seeding.ts` names the
 * case when it fills the treasuries - *"lending a disciple a furnace"* - so
 * this reads a fact the world already writes rather than adding one.
 *
 * The KIND and never the name, because a name is a proper noun and the
 * discovery gate is the reason this game withholds those.
 */
export function whatTheyCarryForSomebodyElse(
    objects: readonly {
        kind: string; ownerId: string | null; possessorId: string | null;
    }[],
    personId: string
): string | null {
    for (const object of objects) {
        if (object.possessorId !== personId) continue;
        // Owned by nobody is a thing they simply have. Owned by THEM is the
        // same. What this is about is the third case, which is the only one
        // with terms attached to it.
        if (object.ownerId === null || object.ownerId === personId) continue;
        // AND A HOUSE PLATE IS NOT A LOAN. Every member of every house wears
        // one, so a reading that counted it would fire on ~29 of 415 people in
        // a seeded world and always say the same uninteresting thing. Measured
        // before the lending pass existed, that was the ONLY thing anybody in
        // this world carried for somebody else.
        if (object.kind === 'token') continue;
        return object.kind.replace(/_/g, ' ');
    }
    return null;
}
