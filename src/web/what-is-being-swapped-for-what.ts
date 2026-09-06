/**
 * What leaves this cultivator's hands and what arrives in them.
 *
 * The design owner: *"buying is selling"*, *"you give stones for a pill and you
 * give a pill for stones is just bartering"*, *"it's all bartering, if spirit
 * stones have value. no need to make it bespoke?"*
 *
 * ── WHY THE VERB WORD IS NOT THE DIRECTION ────────────────────────────────
 *
 * `part with` is in `SELLING_VERBS`, which is correct English and the wrong
 * reading: *"I part with some stones for a pill"* is a person BUYING A PILL,
 * and it reached `sell` because the words it is made of are selling words. The
 * mirror failure sits beside it - *"I take the herbs to a buyer"* is a person
 * SELLING HERBS and reached `buy`, because the noun `buyer` is a buying word.
 *
 * Both are the same mistake: reading the direction off the vocabulary instead
 * of off the goods. What decides a swap is which side of it each thing is on,
 * and that is what this reads.
 *
 * ── AND THERE IS ONLY ONE ACT UNDER BOTH VERBS ────────────────────────────
 *
 * Stones have value, so a trade is goods for goods however it is phrased, and
 * `buy` and `sell` are two names for which half of one exchange the speaker
 * happened to put first. This module is the half of that settlement that can be
 * made without moving the transaction itself: the SENTENCE now yields both
 * sides, in the player's own words, whichever verb it was built from.
 *
 * What is NOT settled here, and is the larger half: `buy` resolves against a
 * board and `sell` resolves against the pouch, so the engine still has two
 * transaction paths for one act, and `spiritStones` is a scalar column beside
 * the pouch rather than a thing in it. Collapsing those is a pass of its own -
 * five handlers and every reader of that column - and until it happens the
 * routing below chooses between the two existing paths rather than replacing
 * them.
 *
 * Pure. A sentence in, two sides out.
 */

/** The two halves of a swap, in the player's own words for them. */
export interface WhatIsBeingSwapped {
    /** What leaves their hands. Null where the sentence names only the other half. */
    readonly given: string | null;
    /** What arrives in them. Null where the sentence names only the other half. */
    readonly got: string | null;
}

/**
 * Verbs that put a thing down: whatever they take as an object is LEAVING.
 *
 * Deliberately not `SELLING_VERBS` itself. That list exists to decide which
 * gate a sentence enters and carries board-reading phrasings with it; this one
 * is only about which way a named thing travels.
 */
const HANDING_IT_OVER = new RegExp(
    String.raw`\b(?:sell|sells|selling|sold|offload|offloads|offloading|unload|unloads|unloading|hawk|hawks|hawking|peddle|peddles|peddling|part with|parts with|parting with|trade away|trades away|cash in|cashes in|give|gives|giving|hand over|hands over|put down|puts down|spend|spends|spending|pay|pays|paying)\b`,
    'i'
);

/** Verbs that take a thing up: whatever they take as an object is ARRIVING. */
const TAKING_IT_UP = new RegExp(
    String.raw`\b(?:buy|buys|buying|bought|purchase|purchases|purchasing|acquire|acquires|pick up|picks up|picking up|get|gets|getting|take|takes|taking|obtain|obtains)\b`,
    'i'
);

/**
 * Where a sentence splits one side of a swap from the other.
 *
 * `for` and `in exchange for` are the whole of it in practice. `with` is
 * deliberately absent: "I buy a pill with my last stones" reads the same way,
 * but "I go to the market with my brother" does not, and a preposition that
 * takes a companion cannot be trusted to take a price.
 */
const WHERE_THE_SWAP_TURNS =
    /\s+(?:in\s+exchange\s+for|in\s+return\s+for|in\s+trade\s+for|for)\s+/i;

/** Taking a thing somewhere, which is what makes a destination a swap. */
const CARRYING_IT_SOMEWHERE = new RegExp(
    String.raw`\b(?:take|takes|taking|took|carry|carries|carrying|carried|bring|brings|bringing|brought|haul|hauls|hauling|cart|carts|carting)\b`,
    'i'
);

/** Selling said as a destination: a buyer is who a thing goes TO. */
const CARRIED_TO_SOMEBODY_WHO_BUYS =
    /\b(?:to|at)\s+(?:a|the|some)?\s*(?:buyer|buyers|merchant|merchants|trader|traders|dealer|dealers|broker|brokers|pawnbroker|stall|stalls|shop|shops|market)\b/i;

/** Buying said as a source: a stall is where a thing comes FROM. */
const TAKEN_FROM_SOMEWHERE_THAT_SELLS =
    /\b(?:from|off)\s+(?:a|the|some)?\s*(?:stall|stalls|shop|shops|merchant|merchants|trader|traders|seller|sellers|vendor|vendors|market|counter|board|peddler|hawker)\b/i;

/** Trim the leading determiner and the trailing punctuation off a named thing. */
function tidy(said: string): string | null {
    const kept = said
        .replace(/^\s*(?:my|our|his|her|their|the|a|an|some|any|all|of)\s+/i, '')
        .replace(/[.,;!?]+\s*$/, '')
        .trim();
    return kept.length > 0 ? kept : null;
}

/**
 * The two sides of the swap this sentence describes, or null where it describes
 * no swap at all.
 *
 * Never decides which VERB the turn runs. A caller that wants that asks the
 * world which side this cultivator is actually holding, because that is a fact
 * about the pouch rather than about the words.
 */
export function whatIsBeingSwapped(input: string): WhatIsBeingSwapped | null {
    const said = input.trim();
    if (said.length === 0) return null;

    const turn = WHERE_THE_SWAP_TURNS.exec(said);

    // ── BOTH SIDES NAMED, WHICH IS THE CASE THE VOCABULARY GOT WRONG ─────
    if (turn) {
        const before = said.slice(0, turn.index);
        const after = said.slice(turn.index + turn[0].length);
        const near = tidy(before.replace(/^.*\b(?:i|we)\b\s*/i, '').replace(/^\s*\w+(?:\s+\w+)?\s+/, ''));
        const far = tidy(after);

        // Which side the NEAR thing is on is decided by the verb that took it,
        // and the FAR thing is always on the other side. So "part with stones
        // for a pill" gives up stones and gets a pill, and "buy a pill for
        // fifty stones" gets a pill and gives up fifty.
        if (HANDING_IT_OVER.test(before)) return { given: near, got: far };
        if (TAKING_IT_UP.test(before)) return { given: far, got: near };

        // No verb either way: "stones for a pill" is still a swap, and the
        // thing after `for` is what somebody is after.
        return { given: near, got: far };
    }

    // ── ONE SIDE NAMED, AND THE ROOM SAYS WHICH ──────────────────────────
    // A CARRYING VERB IS REQUIRED, because a destination alone is not a swap.
    // "I go to the market with my brother" names a market and hands over
    // nothing, and without this it read as parting with a brother.
    if (CARRIED_TO_SOMEBODY_WHO_BUYS.test(said) && CARRYING_IT_SOMEWHERE.test(said)) {
        const what = tidy(said.replace(CARRIED_TO_SOMEBODY_WHO_BUYS, ' ')
            .replace(/^.*?\b(?:take|takes|taking|carry|carries|carrying|bring|brings|bringing)\b\s*/i, ''));
        if (what) return { given: what, got: null };
    }
    if (TAKEN_FROM_SOMEWHERE_THAT_SELLS.test(said)) {
        const what = tidy(said.replace(TAKEN_FROM_SOMEWHERE_THAT_SELLS, ' ')
            .replace(/^.*?\b(?:buy|buys|buying|get|gets|getting|pick up|picks up|picking up|take|takes|taking|grab|grabs)\b\s*/i, ''));
        if (what) return { given: null, got: what };
    }

    return null;
}

/**
 * Whether this side of the swap is the coin rather than the goods.
 *
 * ── AND WHY THIS IS NOT THE BESPOKE THING ─────────────────────────────────
 *
 * The design owner's objection was to spirit stones being *tracked* specially:
 * a scalar column beside the pouch, two transaction paths, and a parser that
 * read direction off which verb-word appeared. None of that is fixed by
 * pretending the world has no medium of exchange. Stones ARE the medium - the
 * engine has to know that to put a price on anything at all - and saying so in
 * one predicate is the opposite of scattering the assumption everywhere.
 *
 * What it is used for is narrow: when somebody hands over a thing they are not
 * carrying, the sentence is a purchase said from the other end UNLESS what they
 * wanted back was the coin, in which case it was a sale they cannot make and
 * the honest answer is that they do not have the goods.
 */
export function namesTheCoin(side: string | null): boolean {
    if (side === null) return false;
    return /\b(?:spirit\s+)?(?:stones?|coin|coins|cash|money|silver|gold|payment)\b/i.test(side);
}
