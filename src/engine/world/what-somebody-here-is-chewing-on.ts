/**
 * What a person standing here has on their mind, which is what you overhear.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A played square read as a roster: it said what everybody was AT and never
 * what anybody was preoccupied WITH. Those are different things - an activity
 * makes a person furniture that moves, and a preoccupation makes them somebody.
 * The two cases the design asks for are a junior sister with her years running
 * out, and a senior brother boasting about a sword he has to give back.
 *
 * There is an overhearing channel already and it is not this. `hearsay.ts`
 * carries `names: SpeakableName[]` and exists to leak proper nouns a player has
 * not earned yet, which is why an overheard conversation reads as two nouns and
 * a shrug - *"the sealed part of the sorting-yard ruin" ... "The Bitter
 * Crossing Ping"*. It does its job. Nobody in it is a person.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS AND IS NOT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It states a FACT about their situation and never their mood, per the standing
 * rule that the engine states facts and the narrator writes prose. Sighing over
 * a bowl of noodles about it is the narrator's, and is what the fact is for.
 *
 * Which is why what comes back is a state and a sentence rather than one
 * string: see {@link WhatIsOnTheirMind}. The engine had six finished sentences
 * for a state the genre says in an unbounded number of ways, and a finished
 * sentence is prose.
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
 * `theOneThingWorthSayingAbout` states the rule this follows: most people say
 * nothing here, because a world where everybody is a character is a world where
 * nobody is. Three people in a square all audibly preoccupied is a soap opera,
 * and the third time a player reads one they stop reading them - which is how
 * the ambient qi line became wallpaper.
 *
 * THIS FILE ONCE CLAIMED THE BARS EXCLUDE THE ORDINARY CASE AND HAD NEVER
 * MEASURED IT. Four consecutive probed asks all came back on the same clause,
 * and counting the whole living population of three seeded worlds - 1,325
 * people - said why: `THE_ROAD_IS_RUNNING_OUT` at 0.55 sat BELOW the median
 * spend of 0.66, so 57.4% of everybody returned that one clause and 71.4%
 * returned something. The clause first in the order was also swallowing the
 * rest: 109 people were marked by a house and 24 were heard on it, 52 stood at
 * the bottom of a roll and 2 were heard on it.
 *
 * At the bar this file now carries, the same count gives 55.0% nothing and
 * 28.1% the road; on a world whose clock has moved ten years - which culls the
 * cohort the seeder places already past its allowance - 67.6% nothing, 12.1%
 * the borrowed thing and 10.9% the road. The caller surfaces at most one of
 * these per turn.
 */

import { lifespanForOrdinal } from '../cultivation/realms.js';

/**
 * How much of a rung's years have to be behind somebody before the road is
 * visibly running out.
 *
 * `lifespanForOrdinal` is the years the rung buys. Somebody most of the way
 * through them and still standing at the same wall is the genre's most common
 * background figure - which is exactly why the bar has to be high. Measured
 * across three seeded worlds: the median person has spent 0.66 of their rung's
 * years, and a world ten years further on has a median of 0.51 and a ninetieth
 * percentile of 0.90. So 0.90 is the top tenth of a world somebody has lived
 * in, and 0.55 - which this was - was the middle of it.
 */
export const THE_ROAD_IS_RUNNING_OUT = 0.9;

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
     * Nothing had to be invented for it. The possessions table separates
     * `ownerId` from `possessorId` precisely so a house can lend somebody a
     * thing, and `seeding.ts` lends disciples furnaces when it builds the
     * treasuries. A thing whose owner is a house and whose holder is a person
     * IS the borrowed sword, already, in the data.
     *
     * A COMMON NOUN AND NEVER THE THING'S NAME. What a person carries is
     * visible; what it is CALLED is a proper noun, and handing that over would
     * walk straight through the discovery gate. A blade is a blade to somebody
     * who has not been told otherwise.
     *
     * AND WHO LENT IT, because the two are different facts. A thing owed back
     * to a house is owed to a roll and a rule. A thing owed back to a person is
     * owed to somebody who will be standing there, and that is the one that
     * reads as a debt.
     */
    carriesForSomebodyElse: { noun: string; from: 'a house' | 'a person' } | null;
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
 * WHAT SOMEBODY IS PREOCCUPIED WITH, in the two forms the two channels need.
 *
 * ── WHY THIS IS NOT ONE STRING ───────────────────────────────────────────
 *
 * It was one, and the one was a finished English sentence. The genre says this
 * state in an unbounded number of ways - a lamp guttering, flames of life
 * burning out, an old cultivator who will die at the rung he is standing on,
 * a man who stopped talking about it - and the engine had six. Six canned
 * sentences buy a player six repetitions rather than one, and any of them reads
 * as a template on its fourth showing. Writing it is the narrator's job, and a
 * finished sentence is not a fact.
 *
 * The obstacle is measured and is in the other direction: the local model
 * reproduces engine wording close to verbatim rather than rewriting it, so an
 * instruction to rewrite does not produce a rewrite. What does is having
 * nothing to lift. `state` is a NOTE - a fragment, no subject, no agreement -
 * and pasting one into prose is visibly broken, which is the only lever the
 * engine has over a narrator that copies.
 *
 * `plainly` is the engine's own sentence and stays, because a run with no
 * narrator configured is a shipping mode and there this is the whole of what
 * the player reads.
 */
export interface WhatIsOnTheirMind {
    /**
     * The state, for the narrator. Not a sentence, deliberately.
     */
    readonly state: string;
    /**
     * The same fact as a predicate for `they`, for the channel with no narrator
     * behind it. The agreement is load-bearing: the renderer says
     * `they ${plainly}`, and clauses written to follow a NAME once printed
     * *"they has spent most of the years this rung allows"* into a scene.
     */
    readonly plainly: string;
}

/**
 * WHAT THEY WOULD BE HEARD ON, or null where there is nothing.
 *
 * Ordered, and the order is the point: the thing most likely to be on somebody's
 * mind is the thing with a clock on it. Running out of road beats everything,
 * because it is the only one that gets worse on its own. That priority is only
 * affordable while its bar stays rare - at 0.55 it took 57.4% of the population
 * and the four readings under it reached a fraction of the people they are
 * about: 109 marked by a house and 24 heard on it, 52 at the bottom of a roll
 * and 2 heard on it.
 */
export function whatTheyWouldBeHeardOnAbout(
    person: SomebodyWithSomethingOnTheirMind
): WhatIsOnTheirMind | null {
    const years = lifespanForOrdinal(person.ordinal);
    const spent = years > 0 ? person.age / years : 0;

    // ── THE ROAD RUNNING OUT ─────────────────────────────────────────────
    //
    // The junior sister: somebody who can see the end of what this rung bought
    // them and is still standing at the same wall. Said as the arithmetic, not
    // as despair.
    if (spent >= THE_ROAD_IS_RUNNING_OUT) {
        return {
            state: 'the years this rung allows, nearly all spent, and no rung gained by them',
            plainly:
                'have spent most of the years this rung allows and are still standing at the same wall'
        };
    }

    // ── A THING THAT IS NOT THEIRS ───────────────────────────────────────
    //
    // Second, above every reading about standing, because it is the most
    // concrete thing anybody here has and the only one with an object in it.
    // The register is a boast, and a boast about a borrowed thing lands because
    // everybody hearing it knows the terms: it is theirs while they are useful,
    // and it can be taken back.
    //
    // `?? null` rather than a bare comparison: a caller that omits the field
    // entirely must read as nobody carrying anything, not as somebody carrying
    // an undefined.
    const borrowed = person.carriesForSomebodyElse ?? null;
    if (borrowed !== null) {
        const noun = `${anOrA(borrowed.noun)} ${borrowed.noun}`;
        // A house wants its cauldron back through whoever keeps the roll. A
        // senior wants their blade back in person, and the junior has to keep
        // looking at them until they get it.
        return borrowed.from === 'a house'
            ? {
                state: `${noun} in their hands, owned by their house, on loan`,
                plainly: `carry ${noun} their house owns and they do not`
            }
            : {
                state: `${noun} in their hands, lent by somebody above them, owed back to them`,
                plainly: `carry ${noun} somebody above them lent out of their own hands`
            };
    }

    // ── AHEAD OF IT ──────────────────────────────────────────────────────
    //
    // The mirror, and deliberately harder to hit: young at a rung that takes
    // other people most of a life. A house's pick reads as this from outside
    // whether or not the house has said so out loud.
    if (spent <= AHEAD_OF_THE_ROAD && person.ordinal >= A_RUNG_WORTH_BEING_YOUNG_AT) {
        return {
            state: 'barely any of this rung\'s years spent, at a rung that takes most people a life',
            plainly: 'are young enough at this rung that the years are not the thing they worry about'
        };
    }

    // ── MARKED BY A HOUSE ────────────────────────────────────────────────
    //
    // Not a rung and not an age: a decision somebody else made about them,
    // which is a different thing to carry and a noisier one.
    if (person.chosen) {
        return {
            state: 'picked out by their house as the one it will spend on',
            plainly: 'carry a house\'s mark as the one it decided to spend on'
        };
    }

    // ── THE BOTTOM OF A ROLL ─────────────────────────────────────────────
    //
    // What a house asks of the people it asks most of. Last, because it is the
    // commonest and would otherwise drown the other three.
    if (person.rank !== null && THE_BOTTOM_OF_A_HOUSE.test(person.rank)) {
        return {
            state: 'the lowest rank their house gives out, and the work that goes with it',
            plainly: 'wear the lowest rank their house gives out, and are doing what that rank is for'
        };
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
        name?: string; kind: string; ownerId: string | null; possessorId: string | null;
    }[],
    personId: string,
    /**
     * Which ids name houses rather than people, exactly as `whoseThisIs` takes
     * it. Omitted, everything reads as a house, which is what this answered
     * before people could own anything.
     */
    houseIds: ReadonlySet<string> | null = null
): { noun: string; from: 'a house' | 'a person' } | null {
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
        return {
            noun: theCommonNounFor(object),
            from: houseIds === null || houseIds.has(object.ownerId) ? 'a house' : 'a person'
        };
    }
    return null;
}

/**
 * "a" or "an", off the noun that follows.
 *
 * Trivial, and it is here because the first cut said "carries a artifact",
 * which is the sort of thing that tells a reader a machine wrote the sentence
 * even when everything else about it is right.
 */
function anOrA(noun: string): string {
    return /^[aeiou]/i.test(noun.trim()) ? 'an' : 'a';
}

/**
 * WHAT A PERSON WOULD CALL THE THING, rather than what the schema calls it.
 *
 * `kind` is a storage category - `artifact`, `manual`, `formation` - and two of
 * those are words somebody might actually say while one is not. Measured on a
 * seeded world, every tracked thing out on loan read as "an artifact their
 * house owns", which is the engine reading its own column aloud.
 *
 * The last word of a thing's name is its noun, in this setting's naming
 * conventions and in general: The Severing Canon is a canon, A Sword Elder's
 * Tally is a tally, fired clay cauldrons are cauldrons. So the noun comes from
 * there, lowercased, with a plural brought back to one.
 *
 * AND ONLY THE LAST WORD, which is what keeps it inside the discovery gate. The
 * name is a proper noun a player may not have earned; its final common noun is
 * what anybody looking at the thing can see it is.
 */
function theCommonNounFor(object: { name?: string; kind: string }): string {
    const last = (object.name ?? '').trim().split(/\s+/).pop() ?? '';
    const word = last.replace(/[^A-Za-z-]/g, '').toLowerCase();
    if (word.length < 3) return object.kind.replace(/_/g, ' ');
    // One thing, not the lot it came out of. "ss" is not a plural ending.
    return word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}
