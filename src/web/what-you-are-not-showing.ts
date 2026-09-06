/**
 * Whether the sentence says you are putting your weight away.
 *
 * The design owner: *"like if ur a hidden expert from a demonic/righteous sect
 * in a nondescript robe and nobody knows. that should be the source of truth of
 * how you are reached too."*
 *
 * ── WHY IT IS READ OFF THE SENTENCE AND NOT HELD AS A STATE ───────────────
 *
 * `Approach.concealed` has existed since the regard bands were written, and
 * `resolveAttempt` has always passed it through to `regardFor`. Nothing in the
 * played path ever set it: the web caller builds an approach out of `intent`
 * and `leverage` and nothing else, so a player at the keyboard had no way to be
 * a hidden expert and the whole of `concealmentHolds` was reachable only from
 * an MCP caller that filled the field in by hand.
 *
 * Per sentence rather than per run, because that is the unit everything else in
 * this layer is decided in - `what-a-threat-promises.ts` reads a promise the
 * same way - and because a concealment is a thing you are DOING while you say
 * something, not a hat. Saying it again next turn costs one clause.
 *
 * ── WHAT IT DOES NOT DECIDE ───────────────────────────────────────────────
 *
 * Whether it works. `concealmentHolds` owns that and refuses it against a
 * witness at or above the real rung, which is why this returns a declaration
 * and never an outcome. Somebody announcing that they are hiding their
 * cultivation in front of somebody who outranks them has announced it and
 * nothing more.
 */

/**
 * Saying you are not showing what you are.
 *
 * Two shapes, and both of them have to name what is being hidden or what is
 * being worn - a bare *hide* is a person getting behind a rock, and the flee
 * row reads that. Every phrasing is one somebody would actually type.
 */
const PUTTING_IT_AWAY = new RegExp(
    [
        // Hiding the thing itself.
        String.raw`\b(?:hide|hiding|conceal|concealing|mask|masking|suppress|suppressing|`
        + String.raw`bank|banking|damp(?:en)?|dampening|veil|veiling|bury|burying|`
        + String.raw`keep(?:ing)?\s+(?:back|down|hidden|concealed))\s+`
        + String.raw`(?:my|our|his|her|their)\s+`
        + String.raw`(?:qi|aura|presence|cultivation|realm|rung|strength|power|`
        + String.raw`base|foundation|weight|breath|core)\b`,
        // The thing itself, hidden.
        String.raw`\b(?:my|our|his|her|their)\s+`
        + String.raw`(?:qi|aura|presence|cultivation|realm|rung|strength|power|`
        + String.raw`base|foundation|weight|breath|core)\s+`
        + String.raw`(?:is\s+|stays\s+|kept\s+|held\s+)?`
        + String.raw`(?:hidden|concealed|banked|veiled|masked|suppressed|down|away)\b`,
        // What is being worn instead, which is the same act from the outside.
        String.raw`\b(?:in|wearing|dressed\s+in|under)\s+`
        + String.raw`(?:a\s+|an\s+|my\s+|plain\s+|the\s+)*`
        + String.raw`(?:nondescript|plain|unmarked|ordinary|common|patched|grey|gray|`
        + String.raw`beggar'?s?|traveller'?s?|traveler'?s?|labourer'?s?|laborer'?s?)\s+`
        + String.raw`(?:robes?|clothes|cloth(?:ing)?|garb|dress)\b`,
        // Saying it in the plainest way there is.
        String.raw`\b(?:as|like)\s+(?:an?\s+)?`
        + String.raw`(?:ordinary|common|nobody|nameless|unremarkable|plain)\s+`
        + String.raw`(?:cultivator|traveller|traveler|man|woman|person|wanderer|labourer|laborer)\b`,
        String.raw`\b(?:showing|giving away|letting\s+(?:them|him|her|anyone)\s+see)\s+`
        + String.raw`(?:nothing|none)\s+of\s+(?:what|who)\s+(?:i|we)\s+(?:am|are)\b`,
        // Passing for less than you are, which is the same act said forwards.
        // `xianxia-scenarios.ts` has asked for this since the concealment
        // scenario was written - *"I pretend I am weaker than I am"* - and it
        // reached `deceive`, an act done TO somebody, rather than a manner.
        String.raw`\b(?:pretend|pretending|act|acting|appear|appearing|seem|seeming|look|looking)\s+`
        + String.raw`(?:that\s+)?(?:i\s+am\s+|i'?m\s+|to\s+be\s+|like\s+|as\s+)?(?:a\s+|an\s+)?`
        + String.raw`(?:weaker|weak|lesser|lower|ordinary|harmless|unremarkable|mortal|nobody)\b`,
        // `pass` is kept to its two idioms on purpose: a bare one would read
        // "I pass a mortal on the road" as putting your weight away.
        String.raw`\b(?:pass|passing)\s+(?:myself\s+off\s+)?(?:for|as)\s+(?:a\s+|an\s+)?`
        + String.raw`(?:weaker|weak|lesser|lower|ordinary|harmless|unremarkable|mortal|nobody|commoner)\b`
    ].join('|'),
    'i'
);

/** What the declaration looked like, for the mechanical channel. */
export interface WhatYouAreNotShowing {
    /** The clause, verbatim and capped. */
    readonly said: string;
}

/**
 * Whether this sentence declares a concealment, or null where it declares none.
 *
 * Null and not `false` for the same reason `whatAThreatPromises` returns null:
 * the absent case is the ordinary one, and a caller that has no reading should
 * not have to tell an absent declaration from a negative one.
 */
export function whatYouAreNotShowing(input: string): WhatYouAreNotShowing | null {
    const at = PUTTING_IT_AWAY.exec(input);
    if (!at) return null;
    return { said: at[0].trim().slice(0, 160) };
}

/**
 * Words that carry nothing on their own once the declaration is lifted out.
 *
 * Not a stop list for the language: only the joins and auxiliaries a person
 * puts around a declaration of this shape. A noun or a verb surviving here is
 * the point - it means the fragment was doing something else as well.
 */
const WHAT_IS_LEFT_IS_NOTHING =
    /\b(?:i|we|he|she|they|while|whilst|with|and|but|so|still|as|of|the|a|an|to|for|in|on|at|my|our|his|her|their|am|is|are|be|being|keep|keeping|kept|hold|holding|held|stay|staying|going|go|now|then)\b/gi;

/**
 * Whether this fragment is ONLY the declaration and no act besides.
 *
 * `theClausesOf` drops a fragment that qualifies the act beside it, and a
 * concealment is exactly that - a manner, not a second call. Measured before
 * this existed: *"hiding my cultivation, tell me where the elder is or I will
 * soul search you"* ran as two steps, the first of them a free `status()` read
 * out of the concealment, so the narrator was handed a character checking their
 * own realm in the middle of a threat.
 *
 * The whole-fragment test is the guard the other two members of that slot get
 * from being anchored patterns. This one can match mid-clause, so a fragment
 * that declares a concealment AND names an act - *"hiding my cultivation I
 * draw on him"* - keeps its act and is split as usual.
 */
export function theFragmentIsOnlyTheDeclaration(part: string): boolean {
    const at = PUTTING_IT_AWAY.exec(part);
    if (!at) return false;
    const left = (part.slice(0, at.index) + ' ' + part.slice(at.index + at[0].length))
        .replace(WHAT_IS_LEFT_IS_NOTHING, ' ')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim();
    return left.length === 0;
}
