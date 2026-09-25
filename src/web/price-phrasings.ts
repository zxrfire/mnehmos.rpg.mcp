/**
 * What somebody says about a price a house has put on a head: reading one,
 * taking one up, and bringing one in.
 *
 * `price` alone is the market's word ("what is the price of millet"), so it
 * counts here only as a price ON somebody. `bounty` is nothing else's.
 */

import type { PlannedAction } from './planned-action.js';

const A_PRICE_ON_SOMEBODY = String.raw`(?:bount(?:y|ies)\b|(?:price|purse|reward)s?\s+on\b)`;

const TAKING_ONE_UP = new RegExp(
    String.raw`\b(?:take|taking|took|accept|accepting|sign\s+(?:up\s+)?for|put\s+my\s+name\s+(?:down\s+)?(?:for|to))\s+`
    + String.raw`(?:up\s+)?(?:the\s+|a\s+|that\s+|this\s+)?${A_PRICE_ON_SOMEBODY}`,
    'i'
);

const BRINGING_ONE_IN = new RegExp(
    String.raw`\b(?:claim|claiming|collect|collecting|cash\s+in|cashing\s+in|redeem|bring\s+in|turn\s+in)\s+`
    + String.raw`(?:the\s+|a\s+|that\s+|this\s+|my\s+)?${A_PRICE_ON_SOMEBODY}`,
    'i'
);

// Asking is `bounty` alone, or a price on a HEAD: "what is the price on this
// sword" is the market's question and stays the market's.
const ASKING_WHAT_IS_UP = new RegExp(
    String.raw`\b(?:what|which|any|are\s+there|is\s+there|list|show)\b[^.?!]{0,30}\bbount(?:y|ies)\b`
    + String.raw`|\b(?:price|bounty|reward|purse)\s+on\s+[^.?!]{0,40}\bhead\b`,
    'i'
);

/** Who the price is on, out of "the bounty on Wen Shu" or "the price on Wen Shu's head". */
export function whoThePriceIsOn(input: string): string | undefined {
    const found = /\b(?:bounty|price|purse|reward)\s+(?:on|for)\s+(.+?)(?:'s\s+head|\s+head)?\s*[.!?]*$/i.exec(input.trim());
    const who = found?.[1]?.replace(/^(?:the|that|this)\s+/i, '').trim();
    return who && who.length >= 2 ? who : undefined;
}

/** A sentence about a price on somebody, or null for one that is not. */
export function aPriceOnSomebody(input: string): PlannedAction | null {
    const text = input.toLowerCase();
    if (BRINGING_ONE_IN.test(text)) {
        const who = whoThePriceIsOn(input);
        return { action: 'sect', intent: 'bounty', topic: 'claim', ...(who ? { target: who } : {}) };
    }
    if (TAKING_ONE_UP.test(text)) {
        const who = whoThePriceIsOn(input);
        return { action: 'sect', intent: 'bounty', ...(who ? { target: who } : {}) };
    }
    if (ASKING_WHAT_IS_UP.test(text)) return { action: 'look', intent: 'bills' };
    return null;
}
