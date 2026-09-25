/**
 * The words that ask what somebody knows of a KIND rather than about one name: "which sects do I
 * know of", "what places do I know", "who do I know". Played: "sects" was looked up as a name,
 * matched no record, and the player was told nobody had ever said a house's name to them.
 */

import type { KnownEntityKind } from './knowledge.js';

/** The whole of what was asked about, and nothing else: "Sect Master Hu" is a name. */
const theWholeOf = (words: string) =>
    new RegExp(String.raw`^(?:the\s+|any\s+|all\s+)?(?:${words})(?:\s+(?:that\s+)?(?:i|do\s+i)\s+know(?:\s+of)?)?\s*[?.!]*$`, 'i');

export const WHICH_KIND_A_WORD_ASKS_FOR: ReadonlyArray<readonly [RegExp, KnownEntityKind]> = [
    [theWholeOf('sects?|houses?|orders?|schools?'), 'sect'],
    [theWholeOf('places?|towns?|cities|city|villages?|locations?'), 'place'],
    [theWholeOf('people|persons?|anyone|anybody|cultivators?'), 'cultivator']
];
