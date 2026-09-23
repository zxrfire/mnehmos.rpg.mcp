/**
 * Ending a master-disciple bond, said plainly rather than asked for.
 *
 * `endTheBond` (`ending-a-bond-you-are-in.ts`) has done the act from either end
 * since it was written, and the only road to it was the request shape - "I ask
 * Elder Fang to end our bond". Measured through `parseIntent` before this file:
 *
 *     I cast Yun Zhi out                  unclear
 *     I disown my disciple                unclear
 *     I sever my ties with Elder Fang     unclear
 *     I renounce my master                unclear
 *     I am no longer his disciple         unclear
 *     I end our bond                      unclear
 *     I walk out on Elder Fang            move/flee
 *
 * Nine blank looks and one worse than blank: walking out on a master read as
 * running away. Nobody ASKS to be cast out, so the one shape that worked is the
 * one nobody would type.
 *
 * WHICH WORDS END A BOND IS NOT DECIDED HERE. {@link ENDING_A_BOND} is the one
 * list and this reads it; what this adds is WHO, which the request shape got
 * for nothing by having a person in front of the ask.
 *
 * AND IT IS NOT AN EXPULSION FROM A HOUSE. `sect/expel` is a house striking
 * somebody off its roll, and shares the word "expel" with this; a sentence that
 * names a house, a roll or a sect is that one and never this.
 */

import { ENDING_A_BOND } from './what-a-request-asks-and-of-whom.js';
import { A_HOUSE_IS_NAMED } from './what-a-house-is-called.js';

/** The house's own business, which this is not. */
const ABOUT_A_HOUSE = /\b(?:sect|sects|house|houses|clan|roll|order|hall|pavilion|court|from the (?:sect|house|clan|roll))\b/i;

/**
 * "Expel" is the HOUSE's word, and it is the one word these two acts share.
 *
 * Putting your own disciple down and a house striking somebody off its roll are
 * different acts with different holders, and `sect/expel` owns the second. The
 * word goes with the act it belongs to: a sentence carrying "expel" is the
 * house's business whatever else is in it, and a master putting their own
 * disciple down says it the way a person says it - cast out, disown, renounce.
 */
const THE_HOUSES_WORD = /\b(?:expels?|expelling|expelled)\b/i;

/** A word that names nobody: the resolver answers these off who was last addressed. */
const NAMES_NOBODY =
    /^(?:him|her|them|he|she|they|it|you|us|me|my|our|the|a|an|this|that|his|hers|theirs|all|everyone|everybody)$/i;

/** A tie word standing in for a person, kept when nothing follows it. */
const A_TIE_WORD =
    /^(?:my|our)\s+(?:master|teacher|shifu|shizun|mentor|disciple|student|pupil|apprentice)\b/i;

/** The ways the person is named in a sentence that ends a bond. */
const WHO_IT_IS_WITH: readonly RegExp[] = [
    /\bcast\s+(?:out\s+)?(.+?)(?:\s+out)?\s*$/i,
    /\b(?:renounce|disown|expel)s?\s+(.+?)\s*$/i,
    /\b(?:sever|cut|break|end)(?:s|ing)?\s+(?:my|our|the|all)?\s*(?:ties?|bonds?|relationship)\s+(?:with|to)\s+(.+?)\s*$/i,
    /\bno longer\s+(.+?)(?:'s|s')\s+(?:master|disciple|student)\b/i,
    /\bleave\s+(.+?)(?:'s)?\s+(?:service|side)\b/i,
    /\b(?:am|'m)\s+(?:leaving|done with)\s+(.+?)(?:'s)?\s+(?:service|tutelage)\b/i,
    /\bwalk(?:s|ing)?\s+out\s+on\s+(.+?)\s*$/i,
    /\b(?:end|ending)\s+(?:it|things)\s+with\s+(.+?)\s*$/i
];

/** The player's own words for the person, trimmed of what is not a name. */
function whoTheyNamed(input: string): string | undefined {
    for (const pattern of WHO_IT_IS_WITH) {
        const hit = pattern.exec(input);
        const said = hit?.[1]?.replace(/[.!?,]+\s*$/, '').trim();
        if (!said) continue;
        if (NAMES_NOBODY.test(said)) return undefined;
        // "my disciple Yun Zhi" is a name with a tie word in front of it, and a
        // name resolves where a description may not. Bare, the tie word IS the
        // description, and `a-target-can-be-a-description.ts` answers it.
        const tie = A_TIE_WORD.exec(said);
        if (tie) {
            const rest = said.slice(tie[0].length).replace(/^\s+/, '');
            return rest.length >= 2 ? rest : said;
        }
        return said;
    }
    return undefined;
}

export interface ABondBeingEnded {
    /** Who it is with, as the player named them. Absent where the sentence names nobody. */
    person?: string;
}

/**
 * Whether this sentence ends a bond, and who with, or null where it is not that.
 *
 * A sentence with no person in it is still this act: "I end our bond" said to
 * somebody's face is the commonest way of saying it, and who is being spoken to
 * is a fact the engine already holds.
 */
export function aBondBeingEnded(input: string): ABondBeingEnded | null {
    const text = input.trim();
    if (!ENDING_A_BOND.test(text)) return null;
    if (A_HOUSE_IS_NAMED.test(text) || ABOUT_A_HOUSE.test(text)) return null;
    if (THE_HOUSES_WORD.test(text)) return null;
    const person = whoTheyNamed(text);
    return person === undefined ? {} : { person };
}
