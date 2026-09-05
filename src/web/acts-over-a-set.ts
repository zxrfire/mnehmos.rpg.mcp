/**
 * An act aimed at a set of people, and what it did not reach.
 *
 * `docs/world/what-the-genre-does-and-whether-we-model-it.md`, "Acts over a
 * set", is the spec:
 *
 *   > The act completes over the reachable subset, and the turn says what it
 *   > did not reach. It is not refused, and it is not silently truncated.
 *
 * ── WHAT WAS MEASURED, AND IT IS WORSE THAN TRUNCATION ───────────────────
 *
 * Played on world seed `w-a`, standing in Old River Village with fifteen
 * people in the square, at Qi Condensation Layer 1:
 *
 *   > I kill everyone here
 *   "Brawler cannot reach Duan Ankuan. 5 major realms is not a fight."
 *
 * `attack` resolved "everyone here" through `POINTING`, which answers a
 * pointer with the last element of the crowd order - and the crowd order is
 * rank-ascending, so the last element is the DEEPEST body present. A set of
 * fifteen collapsed to the one member most certain to refuse, and fourteen
 * people the player could have reached were never considered. Silent
 * truncation to the worst element is what a set-shaped target did.
 *
 * ── THE TWO GATES, AND NEITHER IS MORAL ──────────────────────────────────
 *
 * Both already exist and nothing here adds a third.
 *
 *   CO-LOCATION   `attack` requires the target present. {@link Reachability}
 *                 asks it as `isPresent`.
 *   DISCOVERY     you can only name somebody you have heard of. Asked as
 *                 `hasHeardOf`, which is `knowledge.ts`'s `isAwareOf`.
 *
 * ── THE REMAINDER IS GATED BY THE SAME KNOWLEDGE THE ACT WAS ─────────────
 *
 * The design owner's correction to an earlier draft of the spec, and the part
 * that decides the shape of this file: *you may not know what it did not
 * reach.* Somebody who knows of four cousins and kills one can be told about
 * the other three. Somebody who knows of none is told **nothing**, and does
 * not find out whether they finished.
 *
 * So {@link TheSetAsKnown} has no field for the set as the world holds it, and
 * that absence is the enforcement rather than a rule written next to one. The
 * same device as `Sighting`, which has no name field: a change that wants the
 * census has to add a field and argue for it in review. A count taken from the
 * world hands somebody the census their own ignorance was supposed to deny
 * them, inside a sentence about a killing.
 *
 * ── ONE MECHANISM, FOUR WAYS OF SAYING A SET ─────────────────────────────
 *
 * A branch that fires for families and not for other sets is wrong, so the
 * recognition is over the SHAPE of the phrase and the expansion is one
 * function. What differs between "his family" and "all the guards" is which
 * candidates the caller hands in, never what is done with them.
 */

/** How a sentence named a set of people. */
export type SetShape =
    /** The square. Everybody here is by definition present. */
    | { readonly kind: 'everyone_here'; readonly word: string }
    /** Somebody's own people, as the relationship layer holds them. */
    | { readonly kind: 'kin_of'; readonly word: string; readonly anchor: string }
    /** A house, named. */
    | { readonly kind: 'members_of'; readonly word: string; readonly house: string }
    /** A rank, among the people standing here. */
    | { readonly kind: 'role_here'; readonly word: string; readonly role: string }
    /**
     * A LEANING rather than a house.
     *
     * The design owner: *i kill members of all righteous sects/demonic sects*.
     * That is not thirty-five separate sentences about thirty-five houses, and
     * it is the shape a campaign in this genre is actually declared in. The
     * word is the catalog's own `SectAlignment`, so nothing here decides what
     * righteous means.
     */
    | { readonly kind: 'of_alignment'; readonly word: string; readonly alignment: string };

/**
 * The whole square, however it is said.
 *
 * These are the phrases `POINTING` in `turn-engine.ts` already treats as
 * gestures at the crowd, kept apart from it because that reader answers with
 * ONE person and this one answers with all of them. Anchored at both ends: a
 * target is a whole phrase, and a substring match would take "everyone here"
 * out of "the elder everyone here defers to".
 */
const THE_WHOLE_SQUARE =
    /^(?:(?:all|every|each)\s+(?:one\s+)?of\s+(?:them|these|those|the\s+(?:people|rest|others|lot))|everyone|everybody|every ?one|all of them|them all|all the people|the lot of them|the rest of them|the whole crowd|the whole room|the others|everyone else|everybody else)(?:\s+(?:here|about|around|present|in the room|in the square|standing here))?$/i;

/**
 * The collective nouns for somebody's own people.
 *
 * `line`, `clan` and `house` are in the genre's ordinary vocabulary for the
 * same thing a `kin` tie names. `house` is ambiguous with a sect and is
 * resolved by the anchor: a house that resolves to a faction is a faction, and
 * the caller tries that first.
 */
const KIN_NOUN = '(?:family|families|kin|kinsfolk|kinfolk|household|clan|line|blood|people|relatives|relations)';

/** The quantifier a set-shaped phrase carries, when it carries one. */
const ALL_OF = '(?:the whole|the entire|every single|the rest of|all of|all|every|each|whole|entire)';

/**
 * Somebody's people: "his family", "the Duan family", "Cao Antao's whole clan".
 *
 * The anchor is captured and never resolved here - a target is a description
 * and resolution belongs to the engine, against what is actually here. What
 * this decides is only that a SET was named and whose.
 */
const SOMEBODYS_OWN_PEOPLE = new RegExp(
    `^(?:${ALL_OF}\\s+)?(?:of\\s+)?(?:the\\s+)?`
    + `(?:(?<possessive>[a-z' -]+?)(?:'s|s')\\s+`
    + `|(?<pronoun>his|her|their|its|your|my)\\s+`
    // "the Duan family" - a bare name in front of the noun, which is how a
    // house of people is usually said. Two characters at least, so the article
    // in "a family" cannot become somebody's name.
    + `|(?<bare>[a-z][a-z' -]{1,30}?)\\s+)?`
    + `(?:${ALL_OF}\\s+)?`
    + `(?<noun>${KIN_NOUN})`
    + `(?:\\s+of\\s+(?<of>[a-z' -]+))?$`,
    'i'
);

/**
 * A house named as a whole: "the whole sect", "all of Iron Gate Sect".
 *
 * The quantifier is required. "the sect" on its own is how a member refers to
 * their own house in an ordinary sentence and is not an act over everybody in
 * it.
 */
const A_WHOLE_HOUSE = new RegExp(
    `^${ALL_OF}\\s+(?:of\\s+)?(?:the\\s+)?(?<house>.+?)(?:\\s+(?:sect|house|clan|order|school|hall|court|pavilion))?$`,
    'i'
);

/** The rank words a square's people are picked out by. Matches `POINTING_AT_A_RANK`. */
/**
 * A leaning, said as a set: "all the righteous sects", "every demonic cultivator".
 *
 * The word itself is not listed here - `SectAlignment` owns it, and the caller
 * checks what came back against the catalog. What this decides is that a set
 * was named and by which word.
 */
const A_LEANING_IN_THE_PLURAL = new RegExp(
    `^(?:(?:members?|people|anyone|anybody|everyone|everybody)\\s+(?:of|from|in)\\s+)?` +
    `${ALL_OF}\\s+(?:of\\s+)?(?:the\\s+)?(?<leaning>[a-z]{4,20})` +
    `(?:\\s+(?:sects?|houses?|clans?|orders?|schools?|cultivators?|disciples?|people|ones?))$`,
    'i'
);

const A_RANK_IN_THE_PLURAL =
    /^(?:all|every|each|the whole|the entire|all of)\s+(?:of\s+)?(?:the\s+)?(?<role>elders?|disciples?|masters?|wardens?|heads?|guards?|servants?|attendants?)$/i;

/**
 * The set a target names, or null when it names one person.
 *
 * Pure and over the words alone. Order matters and is the only thing in here
 * that does: the square is checked first because "all of them" would otherwise
 * be read as a house called "them", and a rank in the plural is checked before
 * a house because "all the elders" is a set of people rather than a house
 * called "elders".
 */
export function theSetThisNames(query: string): SetShape | null {
    const wanted = query.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
    if (wanted.length === 0) return null;

    if (THE_WHOLE_SQUARE.test(wanted)) {
        return { kind: 'everyone_here', word: wanted };
    }

    const rank = A_RANK_IN_THE_PLURAL.exec(wanted);
    if (rank?.groups?.['role']) {
        return {
            kind: 'role_here',
            word: wanted,
            role: rank.groups['role'].replace(/s$/i, '')
        };
    }

    // A LEANING, BEFORE A HOUSE. "all the righteous sects" would otherwise be
    // read as a house called "righteous", which is a name no house has and a
    // set of thirty-five the player plainly meant.
    const leaning = A_LEANING_IN_THE_PLURAL.exec(wanted);
    if (leaning?.groups?.['leaning']) {
        return {
            kind: 'of_alignment',
            word: wanted,
            alignment: leaning.groups['leaning'].toLowerCase()
        };
    }

    const kin = SOMEBODYS_OWN_PEOPLE.exec(wanted);
    if (kin?.groups) {
        const anchor = kin.groups['of'] ?? kin.groups['possessive']
            ?? kin.groups['pronoun'] ?? kin.groups['bare'] ?? '';
        return { kind: 'kin_of', word: wanted, anchor: anchor.trim() };
    }

    const house = A_WHOLE_HOUSE.exec(wanted);
    if (house?.groups?.['house'] && house.groups['house'].trim().length >= 3) {
        return { kind: 'members_of', word: wanted, house: house.groups['house'].trim() };
    }

    return null;
}

/** One person a set might contain. Ids and names, because that is all a report needs. */
export interface ACandidate {
    readonly id: string;
    readonly name: string;
}

/** The two gates, as predicates the caller supplies from the live world. */
export interface Reachability {
    /** Co-location. `attack` already requires it; this asks the same question. */
    readonly isPresent: (id: string) => boolean;
    /** Discovery. `knowledge.ts`'s `isAwareOf`, for a person. */
    readonly hasHeardOf: (id: string) => boolean;
}

/**
 * The set as this cultivator holds it. **Never as the world holds it.**
 *
 * There is deliberately no `inTheWorld` count and no `total`. See the header:
 * the remainder is gated by the same knowledge the act was, and a field
 * carrying the world's own figure is the only way this could be got wrong
 * without anybody noticing.
 */
export interface TheSetAsKnown {
    /** Members standing here that this cultivator can name. The act runs over these. */
    readonly reached: readonly ACandidate[];
    /** Members they have heard of who are not standing here. The remainder. */
    readonly heardOfAndNotHere: readonly ACandidate[];
}

/**
 * Split a set into what the act reaches and what it does not.
 *
 * `presenceIsItsOwnDiscovery` is true for exactly one shape - the square -
 * because being able to see somebody is what makes them a member of "everyone
 * here". A face the player cannot name is still a face they can swing at, and
 * `whoTheNearestFaceIs` already resolves one. For every other shape the
 * discovery gate binds both halves: a cousin standing in front of you whom you
 * have never heard of is a stranger in the square, not a member of a set you
 * named.
 */
export function theSetAsThisCultivatorKnowsIt(input: {
    readonly members: readonly ACandidate[];
    readonly gates: Reachability;
    readonly presenceIsItsOwnDiscovery: boolean;
}): TheSetAsKnown {
    const known = input.presenceIsItsOwnDiscovery
        ? input.members
        : input.members.filter(one => input.gates.hasHeardOf(one.id));

    return {
        reached: known.filter(one => input.gates.isPresent(one.id)),
        heardOfAndNotHere: known.filter(one => !input.gates.isPresent(one.id))
    };
}

/** What the set is called in a sentence, for a report that reads as English. */
function theSetInWords(set: SetShape): string {
    switch (set.kind) {
        case 'everyone_here': return 'the people standing here';
        case 'kin_of': return set.anchor.length > 0 ? `${set.anchor}'s people` : 'their people';
        case 'members_of': return set.house;
        case 'of_alignment': return `the ${set.alignment} houses`;
        case 'role_here': return `the ${set.role}s`;
    }
}

/**
 * What the act did not reach, in the player's own terms - or nothing.
 *
 * **Null is the important return.** A cultivator who has heard of no other
 * member is told nothing at all: not that they finished, not that they did
 * not. Saying "that was all of them" would be the world's census arriving as a
 * reassurance, and saying "there are others" would be it arriving as a threat.
 * Both are the same leak.
 *
 * And it must not read as moral. "You cannot do that" is wrong. What is said
 * is a count and a place: what you know of, and where they were not.
 */
export function whatTheActDidNotReach(
    set: SetShape,
    reached: readonly ACandidate[],
    remainder: readonly ACandidate[]
): string | null {
    if (remainder.length === 0) return null;

    const known = reached.length + remainder.length;
    const named = remainder.slice(0, 4).map(one => one.name).join(', ');
    const rest = remainder.length > 4 ? `, and ${remainder.length - 4} more you can name` : '';

    return `You know of ${known} of ${theSetInWords(set)}. `
        + `${reached.length === 0 ? 'None of them were' : `${reached.length} of them ${reached.length === 1 ? 'was' : 'were'}`} standing here. `
        + `${named}${rest} ${remainder.length === 1 ? 'was' : 'were'} not, and where they are is not something you know.`;
}

/** The same fact for the engine channel, which may say how it was computed. */
export function howTheSetWasCounted(
    set: SetShape,
    known: TheSetAsKnown
): string {
    return `Set "${set.word}" read as ${set.kind}. `
        + `Reached ${known.reached.length}: ${known.reached.map(one => one.id).join(', ') || 'none'}. `
        + `Heard of and not co-located ${known.heardOfAndNotHere.length}: `
        + `${known.heardOfAndNotHere.map(one => one.id).join(', ') || 'none'}. `
        + 'Both counts are taken against this cultivator\'s knowledge records, never against '
        + 'the world roster - see the header.';
}
