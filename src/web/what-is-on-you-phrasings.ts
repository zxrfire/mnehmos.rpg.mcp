/**
 * How a player says they are putting something on, drawing it, or letting it go.
 *
 * The reader for the `carry` verb. Kept out of `verb-pattern-table.ts` because
 * every one of these lists is a near-synonym set that will want widening, and
 * the table is the file four people are editing at once.
 *
 * ── THE TWO SENTENCES THESE MUST NOT TAKE ────────────────────────────────
 *
 * "I draw my sword ON him" is a blow, and `VIOLENCE_WITH_NO_OTHER_READING`
 * owns it. The guard is {@link AIMED_AT_SOMEBODY}: the word `on` or `at` with
 * anybody after it.
 *
 * "I drop my sword" said in a fight is a SURRENDER, and `THE_ANSWER_IS_TO_YIELD`
 * owns it. Nothing is needed here for that one, and that is worth saying:
 * `whatTheySaidInTheFight` reads the sentence before the table is ever asked, so
 * the same words are a surrender with a fight standing and a blade on the ground
 * without one - which is what they mean.
 */

/** The label the `carry` verb dispatches on. */
export type CarryIntent = 'wear' | 'take_off' | 'draw' | 'put_away' | 'drop' | 'show';

/** What a house puts on its own, and what anybody calls the rest of it. */
const WORN = '(?:robes?|uniform|habit|garb|gown|outfit|disguise|clothes|clothing)';

/** What comes out of a sheath. Not `weapon` alone - see the `staff` note below. */
const HELD = '(?:sword|blade|sabre|saber|knife|dagger|spear|staff|weapon|axe|whip|bow)';

/**
 * Aimed at somebody, which makes it a blow rather than a hand moving.
 *
 * Bare `on` is not enough: "I put on the robes" has one. It is `on` or `at`
 * with a person after it, which is what an attack's phrasing always has.
 */
const AIMED_AT_SOMEBODY =
    /\b(?:on|at|against|toward|towards)\s+(?:him|her|them|it|me|us|the\s+\w+|[A-Z]\w+)/i;

/**
 * A blow anywhere else in the same sentence.
 *
 * The second half of the guard above, and it was measured as a steal: the
 * corpus's own exemplar for `attack`, "I draw my blade AND GO FOR THE MAN",
 * came back as a hand moving. Drawing is how a swing is described as much as it
 * is an act of its own, and what settles which one a sentence is, is whether
 * anything in it lands on a body.
 */
const THE_SENTENCE_ALSO_THROWS_ONE =
    /\b(?:go(?:es)? for|went for|attack|attacks|strike|strikes|struck|hit|hits|cut|cuts|kill|kills|stab|stabs|swing|swings|slash|slashes|charge|charges|run (?:him|her|them) through|cut (?:him|her|them) down|finish (?:him|her|them))\b/i;

/** Putting it on: "I put on the robes", "I put the robes on", "I wear them". */
const PUTTING_IT_ON = new RegExp(
    String.raw`\b(?:put(?:s|ting)?\s+on|wear(?:s|ing)?|wore|don(?:s|ning)?|dress(?:es|ing)?\s+in|`
    + String.raw`change(?:s|ing)?\s+into|slip(?:s|ping)?\s+into|pull(?:s|ing)?\s+on)\s+`
    + String.raw`(?:the\s+|my\s+|a\s+|an\s+|some\s+|their\s+|his\s+|her\s+|its\s+)?[\w' -]{0,30}?${WORN}\b`
    + String.raw`|\bput(?:s|ting)?\s+(?:the|my|a|an|some|their|his|her|its)\s+[\w' -]{0,30}?${WORN}\s+on\b`,
    'i'
);

/** Taking it off. */
const TAKING_IT_OFF = new RegExp(
    String.raw`\b(?:take(?:s|n)?\s+off|took\s+off|taking\s+off|remove(?:s|d|ing)?|`
    + String.raw`strip(?:s|ping)?\s+(?:off|out\s+of)|shed(?:s|ding)?|get(?:s|ting)?\s+out\s+of|`
    + String.raw`change(?:s|ing)?\s+out\s+of)\s+`
    + String.raw`(?:the\s+|my\s+|a\s+|an\s+|some\s+|their\s+|his\s+|her\s+|its\s+)?[\w' -]{0,30}?${WORN}\b`
    + String.raw`|\btake(?:s|n)?\s+(?:the|my|a|an|some|their|his|her|its)\s+[\w' -]{0,30}?${WORN}\s+off\b`,
    'i'
);

/** Drawing it. */
const DRAWING_IT = new RegExp(
    String.raw`\b(?:draw(?:s|ing)?|drew|unsheathe?(?:s|d|ing)?|bare(?:s|d|ing)?|`
    + String.raw`pull(?:s|ing)?\s+(?:out|free)|ready(?:ing|s)?|raise(?:s|d|ing)?)\s+`
    + String.raw`(?:the\s+|my\s+|a\s+|an\s+|his\s+|her\s+|their\s+)?[\w' -]{0,20}?${HELD}\b`
    + String.raw`|\b(?:my|the)\s+${HELD}\s+(?:comes?|is)\s+out\b`,
    'i'
);

/** Putting it away. */
const PUTTING_IT_AWAY = new RegExp(
    String.raw`\b(?:sheathe?(?:s|d|ing)?|put(?:s|ting)?\s+(?:away|up)|lower(?:s|ing)?|`
    + String.raw`stow(?:s|ing)?)\s+`
    + String.raw`(?:the\s+|my\s+|a\s+|an\s+|his\s+|her\s+|their\s+)?[\w' -]{0,20}?${HELD}\b`
    + String.raw`|\bput(?:s|ting)?\s+(?:the|my|a|an|his|her|their)\s+[\w' -]{0,20}?${HELD}\s+(?:away|up)\b`,
    'i'
);

/**
 * Offering proof of what you are.
 *
 * The token, by every word anybody names it with. NOT the robes: those are
 * worn, which is `wear`'s read, and the whole ruling this verb serves is that
 * the robe is not the proof.
 */
const SHOWING_PROOF = new RegExp(
    String.raw`\b(?:show|shows|showing|showed|present|presents|presenting|offer|offers|offering|`
    + String.raw`hold\s+up|holds\s+up|produce|produces|producing|hand\s+over|flash|flashes)\s+`
    + String.raw`(?:him|her|them|it)?\s*(?:the\s+|my\s+|our\s+|his\s+|her\s+|their\s+)?`
    + String.raw`[\w' -]{0,20}?(?:identity\s+)?(?:tokens?|tallies|tally|seals?\s+of\s+office|`
    + String.raw`jade\s+tokens?|sect\s+tokens?|disciple\s+tokens?)\b`,
    'i'
);

/** Letting it go. */
const LETTING_IT_GO = new RegExp(
    String.raw`\b(?:drop(?:s|ping)?|dropped|let(?:s|ting)?\s+go\s+of|throw(?:s|ing)?\s+down|`
    + String.raw`threw\s+down|put(?:s|ting)?\s+down|set(?:s|ting)?\s+down|cast(?:s|ing)?\s+aside)\s+`
    + String.raw`(?:the\s+|my\s+|a\s+|an\s+|his\s+|her\s+|their\s+)?[\w' -]{0,20}?${HELD}\b`
    + String.raw`|\bthrow(?:s|ing)?\s+(?:the|my|a|an|his|her|their)\s+[\w' -]{0,20}?${HELD}\s+down\b`,
    'i'
);

/**
 * A word that is a verb or a particle rather than part of the name.
 *
 * Measured: without this "I put on the robes" came back naming a thing called
 * *the i put on the robes*, because the filler in front of the noun was allowed
 * to contain spaces and ran back to the start of the sentence.
 */
const NOT_PART_OF_THE_NAME =
    /^(?:i|put|puts|putting|wear|wears|wearing|don|dons|take|takes|taking|off|on|up|down|away|out|in|draw|draws|drawing|drop|drops|dropping|throw|throws|sheathe|sheathes|remove|removes|let|lets|go|of|the|a|an|my|his|her|their|some)$/i;

/** The thing named, for saying it back. Never used to decide anything. */
function theThingNamed(input: string, nouns: string): string | undefined {
    const said = [...input.matchAll(
        new RegExp(String.raw`\b(?:(my|the|a|an|his|her|their)\s+)?(\w+\s+)?(${nouns})\b`, 'gi')
    )];
    const last = said[said.length - 1];
    if (!last) return undefined;
    const filler = (last[2] ?? '').trim();
    const name = [
        (last[1] ?? 'the').trim(),
        NOT_PART_OF_THE_NAME.test(filler) ? '' : filler,
        last[3] ?? ''
    ].filter(word => word.length > 0).join(' ').toLowerCase();
    return name.length >= 2 ? name : undefined;
}

/**
 * What this sentence does to what is on the body, or null for every other
 * sentence.
 *
 * ORDER: the two ends of each pair are read before their opposites cannot be
 * told apart. `take off` before `put on` would be wrong for "I take off the
 * robes and put on my own", so the specific direction each pattern names is
 * what decides, and a sentence naming both reaches the first - which is the
 * act that comes first in the sentence anyway.
 */
export function aThingWornOrHeld(
    input: string
): { action: 'carry'; intent: CarryIntent; target?: string } | null {
    // OFFERING PROOF, read first because it shares `show` with nothing else
    // here and because a token is the one thing on a body that answers a
    // question rather than changing what is held.
    if (SHOWING_PROOF.test(input)) return { action: 'carry', intent: 'show' };
    const aimed = AIMED_AT_SOMEBODY.test(input);

    if (TAKING_IT_OFF.test(input)) {
        return { action: 'carry', intent: 'take_off', ...named(theThingNamed(input, WORN)) };
    }
    if (PUTTING_IT_ON.test(input)) {
        return { action: 'carry', intent: 'wear', ...named(theThingNamed(input, WORN)) };
    }
    // A blade aimed at somebody is a blow and belongs to the swing, whichever
    // of the three hand words the sentence used to say it - and so is a blade
    // drawn in a sentence that goes on to land one.
    if (aimed || THE_SENTENCE_ALSO_THROWS_ONE.test(input)) return null;
    if (PUTTING_IT_AWAY.test(input)) {
        return { action: 'carry', intent: 'put_away', ...named(theThingNamed(input, HELD)) };
    }
    if (LETTING_IT_GO.test(input)) {
        return { action: 'carry', intent: 'drop', ...named(theThingNamed(input, HELD)) };
    }
    if (DRAWING_IT.test(input)) {
        return { action: 'carry', intent: 'draw', ...named(theThingNamed(input, HELD)) };
    }
    return null;
}

/** A target field only where a name was said. */
function named(what: string | undefined): { target?: string } {
    return what === undefined ? {} : { target: what };
}
