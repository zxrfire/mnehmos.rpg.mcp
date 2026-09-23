/**
 * How a member says they are handing a thing in to their own house.
 *
 * MEASURED BEFORE THIS EXISTED, through `parseIntent`:
 *
 *     I hand this core in to the sect        unclear
 *     I turn in the manual                   unclear
 *     I turn the core in to my sect          unclear
 *     I give the treasury the jade           sect/donate
 *     I give the core to the sect            sect/donate
 *     I hand over the manual to the sect     sect/donate
 *
 * Three blank looks, and three sentences about a THING answered by the
 * machinery for paying money in, which buys no contribution and names no
 * thing. The engine half was already built - `whatTheHouseMakesOf` and
 * `turnItInToTheHouse` in `what-a-house-gives-merit-for.ts` - and no sentence
 * reached it.
 *
 * WHAT TELLS THE TWO APART IS WHAT IS BEING HANDED OVER, and nothing else.
 * Stones, a figure, money, or nothing named at all is paying in and stays
 * `donate`. Anything else is a thing, and a thing goes to the house through
 * this door whatever verb carried it. The engine resolves the name against
 * what the player is holding and says so when it is nothing of theirs.
 */

import { A_HOUSE_BY_NAME_OR_KIND } from './what-a-house-is-called.js';

/** Where a house keeps what it is handed, said the way a member says it. */
const WHERE_A_HOUSE_KEEPS_IT = 'treasury|coffers|stores|storehouse|vault|library|scripture pavilion';

/** Somebody or somewhere of the house, as the far end of a handing over. */
const THE_HOUSE_AS_RECIPIENT =
    `(?:the\\s+|my\\s+|our\\s+|this\\s+|its\\s+)?(?:(?:${A_HOUSE_BY_NAME_OR_KIND})(?:'s)?\\s+)?`
    + `(?:${A_HOUSE_BY_NAME_OR_KIND}|${WHERE_A_HOUSE_KEEPS_IT})`;

/** The two particle verbs, which are the house's own words for it and need no recipient. */
const HAND_OR_TURN = '(?:hand|hands|handed|handing|turn|turns|turned|turning)';

/** Verbs that hand a thing to a house only when the house is said. */
const GIVING_TO_A_HOUSE =
    '(?:give|gives|gave|giving|donate|donates|donated|donating|contribute|contributes|contributed|'
    + 'contributing|present|presents|presented|presenting|hand over|hands over|handed over|handing over|'
    // BARE `hand`, WHICH NEEDS THE HOUSE SAID AND HAS IT. Measured on the
    // mechanics sweep: "I hand it to the sect" reached nothing, because the two
    // particle verbs above want the word `in` and the giving list had only
    // `hand over`. Handing a thing TO your house is handing it in, and this
    // list only ever fires where the far end is the house itself - so the
    // sentence that names a person ("I give the book to the elder") is
    // untouched and stays an ordinary gift.
    + 'hand|hands|handed|handing|'
    + 'turn over|turns over|turned over|turning over)';

/** "I turn in for the night" is going to bed, and nothing is being handed anywhere. */
const GOING_TO_BED = /^(?:for the (?:night|day|evening)|early|now|to (?:bed|sleep)|at \w+)\b/;

/**
 * A reflexive is somebody presenting themselves, which is a visit and not a
 * handing in; a resignation handed in is leaving, which has its own door.
 */
const ONESELF = /^(?:(?:my|our)\s+)?(?:myself|ourselves|himself|herself|themselves|me|resignation|notice)\b/;

// Case-blind, because the catalog's names are written with capitals and the
// sentence is read lowered.
const THE_PARTICLE_FIRST = new RegExp(
    `\\b${HAND_OR_TURN}\\s+in\\s+(.+?)(?:\\s+(?:to|into|at)\\s+${THE_HOUSE_AS_RECIPIENT}\\b.*)?$`,
    'i'
);
const THE_PARTICLE_AFTER = new RegExp(
    `\\b${HAND_OR_TURN}\\s+(?!in\\b|over\\b)(.+?)\\s+in(?:\\s+(?:to|at)\\s+${THE_HOUSE_AS_RECIPIENT}\\b.*|\\s+to\\s+.*)?$`,
    'i'
);
const THE_HOUSE_FIRST = new RegExp(
    `\\b${GIVING_TO_A_HOUSE}\\s+${THE_HOUSE_AS_RECIPIENT}\\s+(?!with\\b|\\d)(.+)$`,
    'i'
);
const THE_THING_FIRST = new RegExp(
    `\\b${GIVING_TO_A_HOUSE}\\s+(.+?)\\s+(?:to|into|for)\\s+${THE_HOUSE_AS_RECIPIENT}\\b`,
    'i'
);

/** A determiner is how a thing is pointed at, and is not part of its name. */
function withoutTheDeterminer(thing: string): string {
    return thing
        .replace(/[.!?]+$/, '')
        .replace(/^(?:this|that|these|those|the|my|our|a|an|one|its|his|her|their)\s+/, '')
        .replace(/^(?:this|that|the|my|our)\s+/, '')
        .trim();
}

/**
 * Whether what is being handed over is money, which is paying in and not a thing.
 *
 * Only a phrase that is wholly money: a figure, stones, coin. A herb with a
 * stone in its name is still a herb.
 */
export function isOnlyMoney(thing: string): boolean {
    const said = withoutTheDeterminer(thing.toLowerCase());
    return /^(?:\d[\d,]*|some|all|a few|a hundred|a thousand|several|many)?\s*(?:of\s+(?:my|our)\s+)?(?:(?:high|low|mid|middle|top)[- ]grade\s+)?(?:spirit\s+)?(?:stones?|coins?|money|silver|gold|taels?|funds?|dues|tithes?)$/
        .test(said)
        || /^\d[\d,]*$/.test(said);
}

/**
 * The thing a member is handing in to their house, as they named it, or
 * undefined where the sentence is not that.
 *
 * Undefined for paying in (money, or nothing named), for going to bed, and for
 * somebody presenting themselves.
 */
export function theThingBeingHandedIn(input: string): string | undefined {
    const text = input.toLowerCase().replace(/[.!?]+\s*$/, '').trim();
    const said = THE_PARTICLE_FIRST.exec(text)?.[1]
        ?? THE_PARTICLE_AFTER.exec(text)?.[1]
        ?? THE_HOUSE_FIRST.exec(text)?.[1]
        ?? THE_THING_FIRST.exec(text)?.[1];
    if (said === undefined) return undefined;
    if (GOING_TO_BED.test(said) || ONESELF.test(said)) return undefined;
    const thing = withoutTheDeterminer(said);
    if (thing.length < 2 || isOnlyMoney(thing)) return undefined;
    return thing;
}
