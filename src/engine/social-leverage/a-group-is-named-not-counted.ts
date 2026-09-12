/**
 * How the engine refers to more than one person. The number is state.
 */

/**
 * A GROUP OF PEOPLE, AS A NOUN PHRASE, WITH NO FIGURE IN IT.
 *
 * Measured over the reference corpus, a group is referred to by what it is:
 * `everyone` 6744 times, `the others` 2461, `the surrounding` 1927, `the
 * people` 1283, `the group` 1093, `the crowd` 960, `a group` 543, `all around`
 * 313, `the onlookers` 266. None of the top constructions is a tally.
 *
 * And over 7,789 corpus paragraphs naming a group, the workhorse is a NAMED
 * PERSON with the rest folded in - "the Joy Lord and the others", "The Sect
 * Leader, Jin Yunshan, and all the others". That is the shape the engine
 * already holds: people the reader can put a name to, plus a nameless
 * remainder. So `named` is taken wherever a caller has one, and the figure the
 * caller was about to print goes into `facts.structure` instead.
 *
 * `plural` rather than a fixed number, because the ladder crosses agreement:
 * "the others are" and "the crowd is" are both right and a caller cannot guess
 * which it got.
 */
export interface AGroupOfPeople {
    /** The phrase, lower case, for a caller to place in a sentence. */
    readonly said: string;
    /** Whether it takes a plural verb. */
    readonly plural: boolean;
}

/**
 * The size at which a set of people stops being "the others" and becomes a
 * crowd. Not a threshold anybody perceives exactly - it is the point at which a
 * reader stops being able to hold the individuals in their head, which is the
 * only thing the change of word is claiming.
 */
export const A_CROWD_RATHER_THAN_A_FEW = 9;

export function aGroupOfPeople(over: {
    /** How many there are. Used to pick the word, never printed. */
    readonly howMany: number;
    /** One of them the reader can put a name to, where there is one. */
    readonly named?: string | null;
    /**
     * What they are, where the engine knows - "Dawn Sect disciples", "elders".
     * The design owner extended the rule past onlookers: a group is named by
     * what it is wherever that is on the row, and by a plain collective where
     * it is not.
     */
    readonly whatTheyAre?: string | null;
}): AGroupOfPeople {
    const howMany = Math.max(0, Math.round(over.howMany));
    const named = over.named?.trim() || null;
    const whatTheyAre = over.whatTheyAre?.trim() || null;

    if (howMany <= 0) return { said: 'nobody', plural: false };
    if (howMany === 1) {
        return named === null
            ? { said: whatTheyAre === null ? 'somebody else' : `one of the ${whatTheyAre}`, plural: false }
            : { said: named, plural: false };
    }
    if (named !== null) return { said: `${named} and the others`, plural: true };
    if (whatTheyAre !== null) return { said: `the ${whatTheyAre}`, plural: true };
    if (howMany < A_CROWD_RATHER_THAN_A_FEW) return { said: 'the others', plural: true };
    return { said: 'the crowd', plural: false };
}

/**
 * Sentence case, for a phrase that lands first.
 *
 * Takes the phrase rather than the row, because the same clauses are composed
 * into the middle of a sentence as often as the front of one, and a caller that
 * had to unwrap a row to capitalise anything else would write its own.
 */
export function toOpenASentence(said: string): string {
    return said.length === 0 ? said : said[0]!.toUpperCase() + said.slice(1);
}

/**
 * HOW MANY OF A GROUP DID SOMETHING, IN WORDS.
 *
 * The other half of the same rule, and the one the failing line got wrong
 * twice: *"2 of them answer, out loud"*. A share of a crowd is said the way
 * anybody says it, and the exact pair is in the structure channel.
 *
 * `one of them` stays a number in the sense that it is exact, and it is not a
 * headcount: a group of one is a person, and the genre says so.
 */
export function howManyOfThem(part: number, whole: number): AGroupOfPeople {
    const had = Math.max(0, Math.round(whole));
    const did = Math.min(had, Math.max(0, Math.round(part)));
    if (had <= 0 || did <= 0) return { said: 'none of them', plural: false };
    if (did >= had) {
        return had === 1
            ? { said: 'they', plural: true }
            : { said: 'every one of them', plural: false };
    }
    if (did === 1) return { said: 'one of them', plural: false };
    return did * 2 <= had
        ? { said: 'a few of them', plural: true }
        : { said: 'most of them', plural: true };
}
