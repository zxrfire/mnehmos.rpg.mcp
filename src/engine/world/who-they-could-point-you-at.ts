/**
 * Somebody who does not have the thing, telling you who does.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT, WHICH IS STRUCTURAL AND NOT A MISSING VERB
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on a fresh character standing in a square with nothing to
 * do: *"you have to know SOMETHING, else the game is just dead."* And the shape
 * of the answer: *"where can i find a dao partner", "where can i find a sword",
 * "where can i get a technique"* - then the one that names the mechanism:
 *
 *   *"you can imagine an elder telling you the patriarch teaches technique x.
 *    EVEN IF THEY DON'T HAVE IT."*
 *
 * Measured across the asking layer: **no answer in this game can name a third
 * party the player has not already heard of.** Everything a question answers
 * from goes through `resolveAnything`, which is filtered by the ASKER's own
 * knowledge gate before the person answering is consulted at all; and any
 * third-party names inside what comes back are collapsed to a count by
 * `knownNamesOnly` unless the player could already name them. The one channel
 * that does hand over a new proper noun draws it off a lore table keyed on the
 * speaker's rung and is blind to the topic: what you asked reaches the RNG
 * stream key and nothing else.
 *
 * So a person could be asked where to learn an art, know exactly who teaches
 * it, and structurally could not say. That is the whole of why asking around
 * felt dead.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE ENGINE ALREADY SAID THIS WAS THE GAP
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `whoWouldAsk` derives what a bystander can place - what is in front of them,
 * and what their own house would know - and its own comment names the missing
 * half in advance:
 *
 *   *"Their own house's roll. What a house teaches is knowable to its own
 *    people too, and is left out ONLY BECAUSE NOTHING HANDS THIS METHOD A
 *    CURRICULUM - not because they would not know it."*
 *
 * This is the curriculum. An art is on a world row against the person holding
 * it, and a house's roll is a filter on the same table, so who teaches what
 * inside a house is a query and not a new fact.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT KEEPS IT INSIDE THE DISCOVERY GATE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A pointer names somebody the player could not name a moment ago, which is
 * exactly what the gate exists to control. The rule that makes it safe is that
 * the SPEAKER has to be able to know it: they can name their own house's people
 * because they are on the roll with them, and they can name whoever is standing
 * in front of them because they can see them. Nothing else. A stranger in a
 * market cannot point at the patriarch of a house on the other side of the
 * province, and this returns null for them.
 *
 * The player then LEARNS the name, which is the point: being told is how
 * anybody in this setting comes to know anything.
 */

/** Somebody a speaker could name, and why they are in a position to. */
export interface SomebodyWhoHoldsIt {
    id: string;
    name: string;
    /**
     * How the speaker comes to know it. Not decoration: it is the whole
     * justification for naming somebody the player had never heard of, and it
     * is said out loud in the answer.
     */
    because: 'on their own roll' | 'standing right here';
    /** Their rung, for choosing whom it is worth naming. */
    ordinal: number;
    /** Where they stand on the house's ladder. Higher is more senior. */
    rankIndex: number;
}

/** The shape a world row has to have for this to read it. */
interface SomebodyTheWorldHolds {
    id: string;
    name: string;
    status: string;
    factionId: string | null;
    factionRankIndex: number;
    cultivation: { realmOrdinal: number; techniqueIds: readonly string[] };
}

/**
 * WHO THIS SPEAKER COULD SEND YOU TO FOR THIS ART.
 *
 * The most senior holder they could know, because that is who anybody actually
 * names - "the patriarch teaches it" is the answer, not "somebody in the outer
 * court has it too". Their own roll beats the square, since a house's own
 * people are what a member is sure of.
 *
 * Null when they know nobody who holds it, which is the common case and is a
 * real answer: the person shrugs, and the shrug is honest.
 */
export function whoTheyCouldPointYouAt(input: {
    /** The person being asked. Never pointed at themselves. */
    speakerId: string;
    speakerFactionId: string | null;
    /** Who is standing in this square, the asker included. */
    hereIds: ReadonlySet<string>;
    /** The art being asked after. */
    artId: string;
    /** Nobody worth pointing at: the asker, and anybody already known. */
    exclude: ReadonlySet<string>;
    npcs: readonly SomebodyTheWorldHolds[];
}): SomebodyWhoHoldsIt | null {
    const found: SomebodyWhoHoldsIt[] = [];

    for (const npc of input.npcs) {
        if (npc.status !== 'alive') continue;
        if (npc.id === input.speakerId || input.exclude.has(npc.id)) continue;
        if (!npc.cultivation.techniqueIds.includes(input.artId)) continue;

        const onTheRoll = input.speakerFactionId !== null
            && npc.factionId === input.speakerFactionId;
        const inTheSquare = input.hereIds.has(npc.id);
        if (!onTheRoll && !inTheSquare) continue;

        found.push({
            id: npc.id,
            name: npc.name,
            because: onTheRoll ? 'on their own roll' : 'standing right here',
            ordinal: npc.cultivation.realmOrdinal,
            rankIndex: npc.factionRankIndex
        });
    }
    if (found.length === 0) return null;

    // The one worth naming: their own house before the square, then the most
    // senior, then the deepest. Ties break on id so one seed always answers
    // with the same person.
    return found.sort((a, b) =>
        Number(b.because === 'on their own roll') - Number(a.because === 'on their own roll')
        || b.rankIndex - a.rankIndex
        || b.ordinal - a.ordinal
        || (a.id < b.id ? -1 : 1))[0];
}

/**
 * What the speaker says, as a fact rather than as dialogue.
 *
 * The narrator turns this into somebody speaking. Kept factual for the same
 * reason everything in this channel is: a line of invented dialogue is a
 * commitment the engine cannot keep.
 */
export function whatTheySayAboutWhoHoldsIt(
    them: SomebodyWhoHoldsIt,
    artName: string
): string {
    return them.because === 'on their own roll'
        ? `They do not hold ${artName}. ${them.name} does, and they are on the same roll, `
          + 'which is how they come to know it.'
        : `They do not hold ${artName}. ${them.name} is standing right here and does.`;
}

/**
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE SAME RULE FOR ANYTHING ELSE THEY KNOW
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on the version above: *"remember this is pointing you at
 * ANYTHING they know. That's the non-bespoke case."*
 *
 * Correct, and the art-holder above is one instance of it rather than the rule.
 * The rule is the inversion: **a question is answered out of what the SPEAKER
 * can reach, not out of what the asker already holds.** What a speaker can
 * reach was settled by `whoWouldAsk` long before this file existed - what is in
 * front of them, and what their own house would know - and everything below is
 * that same pair asked about a different kind of thing.
 *
 * So there is no list of question types here and no branch per noun. There is
 * one predicate, applied to whatever the topic turned out to name.
 */

/** A thing a question turned out to be about, whatever kind it is. */
export interface SomethingAskedAbout {
    id: string;
    name: string;
    /** The knowledge-layer kind, so the caller can write what was learned. */
    kind: 'cultivator' | 'sect' | 'place';
}

/** What a speaker turns out to be in a position to say about it. */
export interface TheyCanPlaceIt {
    subject: SomethingAskedAbout;
    /**
     * Why they are in a position to know, which is the whole justification for
     * naming something the player could not name a moment ago.
     */
    because: 'on their own roll' | 'standing right here' | 'their own house'
        | 'the ground they are standing on';
}

/**
 * WHETHER THIS SPEAKER CAN PLACE THE THING THAT WAS ASKED ABOUT.
 *
 * The asker's gate is deliberately not consulted: the caller has already
 * established that the player could not place it, which is why this is being
 * asked at all.
 *
 * Null is the ordinary answer and is honest. Most people cannot place most
 * things, and a shrug from somebody who genuinely does not know is a better
 * answer than a world where everybody knows everything.
 */
export function whatTheyCouldPlaceForYou(input: {
    subject: SomethingAskedAbout;
    speakerId: string;
    speakerFactionId: string | null;
    speakerFactionName: string | null;
    /** The ground the speaker is standing on. They can place that much. */
    hereName: string;
    /** Everybody in this square, by id. */
    hereIds: ReadonlySet<string>;
    /** Their own house's roll, by id. */
    ownRollIds: ReadonlySet<string>;
}): TheyCanPlaceIt | null {
    const { subject } = input;
    if (subject.id === input.speakerId) return null;

    if (subject.kind === 'cultivator') {
        if (input.ownRollIds.has(subject.id)) {
            return { subject, because: 'on their own roll' };
        }
        if (input.hereIds.has(subject.id)) {
            return { subject, because: 'standing right here' };
        }
        return null;
    }

    if (subject.kind === 'sect') {
        // Their own house, which is the one house anybody can always place.
        return subject.id === input.speakerFactionId
            || (input.speakerFactionName !== null && subject.name === input.speakerFactionName)
            ? { subject, because: 'their own house' }
            : null;
    }

    // A place, and the only one they are certain of is the one under them.
    return subject.name === input.hereName
        ? { subject, because: 'the ground they are standing on' }
        : null;
}

/** Engine-authored and factual, for the record beside the answer. */
export function howTheyComeToKnowIt(placed: TheyCanPlaceIt): string {
    switch (placed.because) {
        case 'on their own roll':
            return `${placed.subject.name} is on the same roll they are, which is how they come `
                + 'to know it.';
        case 'standing right here':
            return `${placed.subject.name} is standing right here, and they can see that much.`;
        case 'their own house':
            return `${placed.subject.name} is their own house.`;
        case 'the ground they are standing on':
            return `${placed.subject.name} is the ground under their feet.`;
    }
}
