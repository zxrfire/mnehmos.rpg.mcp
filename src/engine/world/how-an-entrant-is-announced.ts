/**
 * How somebody standing on a board is called out: their name, and what they are
 * standing for.
 *
 * The design owner, on what an open competition is for: *"like xya from the abc
 * sect"* - *"or abc rogue cultivator, no sect"*. Both, in one shape. The
 * announcer is the whole mechanism by which a reputation is made in public in
 * this genre, and the thing that makes a rogue cultivator's placing mean
 * anything is that it is said the same way as everybody else's. A board that
 * named houses and went quiet at somebody who had none would be the engine
 * deciding that a person without a house does not count, which is the one thing
 * it is not allowed to have an opinion about.
 *
 * ── DERIVED, WITH NOTHING STORED ─────────────────────────────────────────
 *
 * There is no announcement field and there must not be one. A placing already
 * carries the name and the house; what a crowd hears is a reading over that row
 * and drifts from it by construction rather than by two writers agreeing. This
 * is the same rule `what-people-are-saying.ts` keeps for rumour and
 * `a-house-knows-its-own-by-a-lamp-and-a-token.ts` keeps for a roll.
 *
 * ── AND IT IS THE ONE PLACE AN AFFILIATION IS LEGITIMATELY VISIBLE ───────
 *
 * AGENTS.md's rule is that a fact the record holds and the eye cannot reach must
 * not be handed to the narrator as an observation. Who somebody's house is is
 * exactly such a fact standing in a square - and an announcer is route two out
 * of the three ways out: somebody who knows says it out loud, in front of
 * everybody, because that is what the occasion is. Nothing here may be used to
 * describe a stranger in a market.
 */

/** Somebody about to be called out. */
export interface AnEntrant {
    name: string;
    /** The house they answer to, or null where they answer to none. */
    houseName: string | null;
}

/** One line of a board, as it is read out. */
export interface APlaceOnABoard extends AnEntrant {
    /** 1 is first on their own board. */
    place: number;
}

/**
 * What the announcer says for one entrant.
 *
 * ONE SHAPE, BOTH WAYS: name, comma, what they are standing for. The entrant
 * with no house is not given a shorter sentence, an apologetic one or a
 * different separator - they are given the same sentence with the other answer
 * in it, and that is the whole of the feature.
 */
export function howAnEntrantIsAnnounced(entrant: AnEntrant): string {
    return `${entrant.name}, ${entrant.houseName ?? 'no house'}`;
}

/**
 * A board, called out in order.
 *
 * The caller decides how much of a board is worth saying out loud and hands over
 * that much; this decides nothing about who is worth naming.
 */
export function theBoardAsItIsCalledOut(rows: readonly APlaceOnABoard[]): string {
    return rows
        .map(row => `${row.place}. ${howAnEntrantIsAnnounced(row)}`)
        .join(', ');
}
