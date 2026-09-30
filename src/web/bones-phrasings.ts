/**
 * The words that take the bones off a body, for the pattern table and the
 * `gather` verb both. No imports, so the pattern table can read it without
 * pulling the verb's module in. See `taking-the-bones.ts`.
 *
 * The verb is `gather`, which already owns "harvest": this is its harvest of a
 * body rather than of the ground, and it is chosen by what is named.
 */

/** A taking verb aimed at bones, or a harvesting verb aimed at a body. */
const TAKING_THE_BONES = new RegExp(
    '\\b(?:take|takes|taking|took|strip|strips|stripping|stripped|harvest|harvests|harvesting|harvested|'
    + 'collect|collects|collecting|gather|gathers|gathering|cut|cuts|cutting|carve|carves|carving|'
    + 'pull|pulls|pulling|remove|removes|removing|salvage|salvages|salvaging)\\s+'
    + '(?:out\\s+|off\\s+)?(?:the\\s+|his\\s+|her\\s+|their\\s+|its\\s+|some\\s+|(?:[a-z]+\\s+){0,2}[a-z]+\'s\\s+)?'
    + '(?:bones?|skeletons?)\\b'
    + '|\\b(?:harvest|harvests|harvesting|harvested|butcher|butchers|butchering|butchered)\\s+'
    + '(?:the|his|her|their|that|this|a)\\s+(?:corpses?|body|bodies|remains|dead)\\b'
    + '|\\b(?:strip|strips|stripping|stripped)\\s+(?:the|his|her|their|that|this)\\s+'
    + '(?:corpses?|body|bodies|remains)\\s+of\\s+(?:its|his|her|their|the)\\s+bones\\b',
    'i'
);

/** A beast's parts are the hunt's, however they are said. */
const OFF_A_BEAST = /\b(?:beasts?|animals?|game|quarry|carcass(?:es)?|hides?|pelts?)\b/i;

/** Whether this sentence takes the bones off a dead person. */
export function takesTheBones(input: string): boolean {
    return TAKING_THE_BONES.test(input) && !OFF_A_BEAST.test(input);
}

/** What `gather` is handed that makes it a body's harvest rather than the ground's. */
export const NAMES_A_BODY = /\b(?:bones?|skeletons?|corpses?|body|bodies|remains)\b/i;
