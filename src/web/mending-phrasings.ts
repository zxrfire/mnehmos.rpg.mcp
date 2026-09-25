/**
 * The words that say a thing is being mended, for the pattern table and the
 * `craft` verb both. No imports, so the pattern table can read it without
 * pulling the verb's module in. See `mending-a-thing-you-hold.ts`.
 */

/** The words that make a craft sentence a mending one. */
export const MENDING_WORDS =
    /\b(?:mend|mends|mending|mended|repair|repairs|repairing|patch|patches|patching|fix|fixes|fixing)\b/i;

/**
 * Words that make a mending sentence about something other than a thing: a
 * wound is `treat`'s, and qi, a name or a gaze is not an object anybody holds.
 * A preposition means the verb was the other `fix` ("fix my eyes on him").
 */
const NOT_A_THING_YOU_HOLD =
    /\b(?:injur\w*|wounds?|meridians?|body|bones?|me|myself|him|her|them|flesh|dantian|foundation|core|arms?|legs?|hands?|qi|strength|energy|breath\w*|name|reputation|standing|face|gaze|eyes?|attention|mind|heart|relations?\w*|things|on|at|to|with|for|in|onto|upon|price|meal|dinner|food)\b/i;

/**
 * The thing a mending sentence names, or null where it names a wound or
 * nothing. Read by the pattern table, so the words live here once.
 */
export function whatIsBeingMended(input: string): string | null {
    const said = /\b(?:mend|mends|repair|repairs|patch up|patches up|patch|fix|fixes)\s+(?:up\s+)?((?:[\w'-]+\s*){1,6}?)[\s.!?]*$/i.exec(input);
    if (!said) return null;
    const noun = said[1]!.trim();
    if (noun.length === 0 || NOT_A_THING_YOU_HOLD.test(noun)) return null;
    return noun.replace(/^(?:my|the|this|that|our|his|her|their)\s+/i, '').trim() || null;
}
