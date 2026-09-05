/**
 * A thing that acts where its owner is not.
 *
 * A flying sword sent across a province, a nascent soul out of the body, a
 * clone standing in a room its maker has never been in. The setting has always
 * had these and the engine had nowhere to put them: every act was performed by
 * a cultivator, at the cultivator's own location, and the only question a verb
 * ever asked was who was standing here.
 *
 * ── WHAT THIS CHANGES, AND IT IS ONE THING ───────────────────────────────
 *
 * A turn now has to answer WHICH BODY IS ACTING before it answers what the act
 * was. That is the whole of the design. Everything else - who gets hurt, who
 * finds out, what it costs - is the machinery that already exists, pointed at a
 * location that is not the one the owner is standing in.
 *
 * ── NOT THE PROXY `above.ts` MEANS, AND THE DIFFERENCE IS THE WHOLE POINT ─
 *
 * A True Immortal reaching into the world below sends an OBJECT AND A MESSAGE,
 * and what happens next is done by people who are not them and who will do what
 * they think was meant. There is no control in it; that is what makes it
 * interesting there, and the misreading is the mechanic.
 *
 * This is the opposite. A sword under its owner's will does what its owner
 * wants, exactly, at the far end of a province - nothing interprets it, nobody
 * decides what was meant, and the only thing between the intention and the act
 * is distance the art already covers. One is a message; this is a hand.
 *
 * ── THREE RULES, AND NONE OF THEM IS ABOUT SWORDS ────────────────────────
 *
 * REACH IS KNOWLEDGE. You cannot send a sword at somebody whose whereabouts you
 * do not hold. That is not a range check, it is the knowledge model doing what
 * it already does, and it is why `couldItBeSentAt` takes what the owner knows
 * rather than a distance: a cultivator who has no idea where their enemy is
 * cannot kill them from a province away, however far the art reaches.
 *
 * ATTRIBUTION IS RECOGNITION. A famous sword is a signature. Somebody who sees
 * it knows whose it is, and the deed enters the world with a name on it; an
 * anonymous one leaves the world holding that something happened and nobody
 * saying who. `aDeedEntersTheWorld` already takes both of those - `actors` and
 * `unattributed` - so this decides which and writes neither.
 *
 * WHAT IS SENT IS EXPOSED. A nascent soul out of the body leaves the body
 * behind it, and the body is a body: asleep, unguarded, and somewhere somebody
 * could walk. The cost of acting at a distance is that for as long as you are
 * doing it there are two of you to kill and you are only defending one.
 */

/** What kind of thing is standing in for its owner. */
export type ProxyKind =
    /** A blade sent out under its owner's will. Ordinary, and the far one. */
    | 'flying_sword'
    /**
     * The self, out of the body. Reaches further and thinks, which is the
     * point; it also leaves the body behind, which is the price.
     */
    | 'nascent_soul'
    /** A made body. Slower, dumber, and expendable in a way the other two are not. */
    | 'clone';

export interface ActingInYourPlace {
    readonly id: string;
    readonly kind: ProxyKind;
    readonly ownerId: string;
    /** Where it is, which is the fact this whole module exists to carry. */
    readonly locationId: string;
    /** Its own name, where it has one. A named blade is a signature. */
    readonly name: string | null;
    /**
     * Somebody who sees it knows whose it is.
     *
     * Never derived from fame here: the caller reads it off the object, because
     * whether a thing is recognisable is a fact about the thing and the world
     * that has seen it, and this module has neither.
     */
    readonly recognisable: boolean;
    /**
     * The rung it acts at. Never above its owner's, and usually below.
     */
    readonly ordinal: number;
}

/**
 * Everywhere this cultivator could act from, their own body included.
 *
 * The body is first and is always on it, which is the invariant that keeps this
 * from being a mode: a cultivator with three swords out is still standing
 * somewhere and can still do things with their hands.
 */
export function whereYouCanActFrom(input: {
    readonly ownerId: string;
    readonly standingAt: string;
    readonly proxies: readonly ActingInYourPlace[];
}): { id: string; what: 'yourself' | ProxyKind; locationId: string; name: string | null }[] {
    return [
        { id: input.ownerId, what: 'yourself' as const, locationId: input.standingAt, name: null },
        ...input.proxies
            .filter(one => one.ownerId === input.ownerId)
            .map(one => ({
                id: one.id,
                what: one.kind,
                locationId: one.locationId,
                name: one.name
            }))
    ];
}

/** Why a thing cannot be sent at somebody, or null where it can. */
export type WhyNot =
    /** The owner does not know where the target is. Not a range problem. */
    | 'you do not know where they are'
    /** Nothing of theirs is out there to do it with. */
    | 'nothing of yours is near them';

/**
 * Whether anything this cultivator has out could reach that person.
 *
 * `knownToBeAt` is the owner's own belief about where the target is, and null
 * where they hold none - which is the commonest answer and the one that makes
 * this a knowledge question rather than a distance one.
 */
export function couldItBeSentAt(input: {
    readonly knownToBeAt: string | null;
    readonly proxies: readonly ActingInYourPlace[];
    readonly standingAt: string;
}): { reach: ActingInYourPlace | 'yourself' | null; why: WhyNot | null } {
    if (input.knownToBeAt === null) {
        return { reach: null, why: 'you do not know where they are' };
    }
    if (input.knownToBeAt === input.standingAt) return { reach: 'yourself', why: null };

    const there = input.proxies.find(one => one.locationId === input.knownToBeAt);
    return there
        ? { reach: there, why: null }
        : { reach: null, why: 'nothing of yours is near them' };
}

/**
 * Whether a deed done by this thing has its owner's name on it.
 *
 * The answer the world writes down, and the reason a famous blade is a mixed
 * blessing: it does the work and it says who sent it.
 */
export function wouldTheyKnowWhoSentIt(proxy: ActingInYourPlace): boolean {
    return proxy.recognisable;
}

/**
 * What is left behind while this thing is out.
 *
 * Null where nothing is. A sword leaves its owner standing; a nascent soul
 * leaves a body that is not defending itself, and a clone is not the owner at
 * all so nothing of them is anywhere else.
 */
export function whatIsLeftUnguarded(proxy: ActingInYourPlace): string | null {
    return proxy.kind === 'nascent_soul'
        ? 'The body is where it was left, breathing and not doing anything else. '
          + 'Anybody who finds it does not have to be strong to end this.'
        : null;
}
