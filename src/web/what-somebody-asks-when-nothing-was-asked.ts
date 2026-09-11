/**
 * Somebody was walked up to and nothing was asked of them. What they ask back.
 *
 * Measured on a 744-turn replay: `interact` was chosen 162 times and refused
 * 150, while every verb that routes by an intent discriminator - `look`,
 * `status`, `inventory`, `assess`, `teacher`, `ceiling`, `work` - refused
 * nothing at all. Two of those 150 are what this file answers:
 *
 *   72  the sentence named nobody, in a square with people in it. The refusal
 *       said *nobody is co-located to have meant* and then listed who was.
 *   18  the sentence named somebody who resolved. Their rung, age, house, rank
 *       and whole open ledger were printed, and then *attempt recorded;
 *       outcome not resolvable yet*.
 *
 * Neither is a sentence a game master refuses; both are one they ask back.
 * `costOfTeaching` established the shape - a request that is coherent and
 * underspecified is a question, in the character's mouth, with the options in
 * a fixed order so the answer has somewhere to land.
 *
 * ── WHAT IS NOT SAID ─────────────────────────────────────────────────────
 *
 * Nothing about what they are carrying, what they want, or what they would
 * agree to. Somebody who has been walked up to has not been asked anything and
 * has no reason to volunteer any of it, and the engine knowing a thing is not
 * the same as its being perceivable. What goes out is what the square can see,
 * what the person was heard on, and the ways of asking, which are the engine's
 * own verb surface rather than anything about them.
 *
 * Pure. Names in, sentences out.
 */
/**
 * The ways of asking, in a fixed order.
 *
 * The engine's own verb surface said as a player would type it. A narrator that
 * invents an affordance costs the player a turn finding out the prose lied, and
 * `docs/verbs.md` is the only honest account of what may be pointed at.
 */
const THE_WAYS_OF_ASKING: readonly string[] = [
    'ask them about something by name',
    'ask them to teach you',
    'ask them to put you in front of somebody',
    'ask to be taken on',
    'put a deal to them'
];

/** Somebody who is standing there and has been walked up to. */
export interface WhoIsInFrontOfYou {
    readonly name: string;
    /**
     * What they were heard on, when the world gave them something to say.
     *
     * Hearable by construction: the hearing channel prints it in the same
     * breath, so offering it back as a thing to ask about discloses nothing.
     */
    readonly heardOn: string | null;
}

/** A question the engine asks, for the narrator to put in somebody's mouth. */
export interface AQuestionBack {
    readonly headline: string;
    readonly prose: string;
    readonly lines: string[];
    readonly structure: string;
}

/**
 * What the opening was, where the verb says something about it.
 *
 * `follow` and `approach` arrive from the movement table - following a PERSON
 * is social and following a road is travel - and neither is a request. What
 * happened is worth a sentence; what is missing is the same half as the rest.
 */
const WHAT_THE_OPENING_WAS: Readonly<Partial<Record<string, string>>> = {
    follow: 'Following starts when they go somewhere, and they have not gone anywhere.',
    approach: 'You are standing in front of them now.',
    apologise: 'An apology lands on a thing done. Name it and it is an apology.',
    trade: 'A trade needs the two halves of it named - what goes across, and what comes back.'
};

/**
 * Nothing was asked, so they ask.
 */
export function whatTheyAskWhenNothingWasAsked(
    them: WhoIsInFrontOfYou,
    intent: string
): AQuestionBack {
    const opening = WHAT_THE_OPENING_WAS[intent];
    const ways = [
        ...(them.heardOn === null ? [] : [`ask them about ${them.heardOn}`]),
        ...THE_WAYS_OF_ASKING
    ];
    return {
        headline: `${them.name} waits for the rest of it.`,
        prose: `${opening === undefined ? '' : `${opening} `}`
            + `${them.name} heard you and is waiting to hear what you want. Nothing has been `
            + 'asked, so nothing has been answered and nothing has moved.',
        lines: [`What ${them.name} could be asked, said the way you would say it:`, ...ways],
        structure: `Approached ${them.name}. No request was carried by the sentence, so the `
            + `resolver was not run: there is nothing to weigh. ${ways.length} ways of asking `
            + 'named, in a fixed order. No day passed, nothing was spent, and no record was '
            + 'written on either side.'
    };
}

/**
 * Somebody was addressed and nobody was named, with a square full of people.
 *
 * Naming them discloses nothing: a look prints exactly this list, and the
 * caller passes only the people it would print.
 */
export function whoOfThemDidYouMean(
    here: readonly string[],
    intent: string
): AQuestionBack {
    return {
        headline: 'Which of them.',
        prose: 'You get as far as opening your mouth before realising you had not picked '
            + 'anybody. They are in the order you would see them, so an ordinal answers this.',
        lines: here.map((name, at) => `${at + 1}. ${name}`),
        structure: `An ${intent} with no subject named, and ${here.length} people standing here `
            + 'to have meant. Printed in a fixed order so the next sentence can count against '
            + 'it. No day passed and nothing was spent.'
    };
}
