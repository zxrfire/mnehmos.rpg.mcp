/**
 * The person standing there asks what you meant, out of what THEY know.
 *
 * A sentence the engine cannot place used to be answered by the narrator saying
 * so - *the thought does not resolve* - which is the game stepping outside
 * itself to report a parse failure. There is somebody standing in the square.
 * They heard it. The honest answer is the one they would give.
 *
 * The design owner's own example is the shape of it, rendered in this world:
 * a traveller asks the ferryman for Elder Yun and is offered the one who
 * keeps the weir, or Yun of the north road, or the Yun at the temple that
 * nobody calls Elder.
 *
 * ── AND IT IS NOT ONLY NAMES ─────────────────────────────────────────────
 *
 * The design owner, correcting a first cut that only handled people: *this
 * isn't only limited to names of course, it could be anything.* A sentence can
 * fail to place a house, a place, a thing in somebody's hand, or an art - and
 * it can fail on a WORD, which is the case with no candidate at all: *I end the
 * Hollow Court* is answered by somebody asking what you mean by end. All four
 * are one question with one shape, so this takes candidates of any kind and
 * says which kind it is offering.
 *
 * ── WHAT AN NPC KNOWS, GIVEN THAT NOTHING RECORDS IT ─────────────────────
 *
 * The knowledge table holds the PLAYER's awareness and nobody else's, so an
 * NPC's knowledge has to be derived rather than looked up. Two sources, both
 * facts about the world and neither invented:
 *
 *   - what is in front of them, because they can see it
 *   - what their own house would know, because they are on its roll
 *
 * That is the whole of it, and the limit is the point: somebody who serves
 * nobody and is standing alone with the player can offer exactly one name, and
 * a Hollow Court steward can place half the Court. Neither of them can offer a
 * thing they have no way of holding, which is what stops this becoming the
 * engine reading its own catalog out loud in a person's voice.
 */

/** What sort of thing the asker is offering back. Decides the words, not the rule. */
export type WhatKindOfThing = 'person' | 'house' | 'place' | 'thing' | 'art';

/** Somebody the asker could put a name to. */
export interface AName {
    readonly id: string;
    readonly name: string;
}

/** Anything the asker could place, of whatever kind. */
export interface AThing extends AName {
    readonly kind: WhatKindOfThing;
}

/**
 * What one person standing here is in a position to place.
 *
 * Both lists are supplied by the caller off the roster, so this module holds no
 * opinion about how a house is read and cannot reach past what it is handed.
 */
export interface WhatTheyCanPlace {
    /** Whatever is in front of them - people, ground, what is on it. */
    readonly inFrontOfThem: readonly AThing[];
    /** Whatever their own house would know: its roll, its ground, its arts. */
    readonly ownHouseWouldKnow: readonly AThing[];
}

/**
 * How a person refers to the kind of thing they are offering.
 *
 * A `Record` over the union so a kind added tomorrow does not compile until
 * somebody has said how it is spoken of, which is the same reason
 * `unresolved-attempt-denials.ts` gives for its own table.
 */
const WHAT_THEY_CALL_IT: Readonly<Record<WhatKindOfThing, string>> = {
    person: 'who you meant',
    house: 'which house you meant',
    place: 'where you meant',
    thing: 'which one you meant',
    art: 'which art you meant'
};

/**
 * How close a name has to be before somebody offers it as what you meant.
 *
 * Deliberately generous. The cost of offering the wrong name is a person saying
 * a name and being told no, which is a conversation; the cost of offering none
 * is the player being told their sentence did not resolve, which is not.
 */
export const CLOSE_ENOUGH_TO_OFFER = 0.34;

/** The most names anybody offers before it stops being a question. */
export const NAMES_ONE_PERSON_OFFERS = 2;

export interface WhatTheyAsk {
    /**
     * What they say. Engine truth for the narrator to voice in their mouth,
     * never the final prose - who is speaking is the whole point of it.
     */
    readonly said: string;
    /**
     * The names they put forward, in the order they said them. Empty where they
     * could not place it at all, which is a different sentence and not a
     * failure of this one.
     */
    readonly offered: readonly string[];
}

/**
 * What the person standing there says back.
 *
 * `likeness` is the caller's own name matcher, passed in rather than imported
 * so that one answer to "are these the same name" serves the resolver and this,
 * and the two can never drift into disagreeing about it.
 */
export function whatSomebodyHereWouldAsk(input: {
    /** The phrase the player used, as they typed it. */
    readonly askedFor: string;
    readonly asker: AName;
    readonly theyCanPlace: WhatTheyCanPlace;
    readonly likeness: (said: string, name: string) => number;
}): WhatTheyAsk {
    const asked = input.askedFor.trim();
    const seen = new Set<string>();
    const reachable: AThing[] = [];
    for (const who of [
        ...input.theyCanPlace.inFrontOfThem,
        ...input.theyCanPlace.ownHouseWouldKnow
    ]) {
        if (who.id === input.asker.id || seen.has(who.id)) continue;
        seen.add(who.id);
        reachable.push(who);
    }

    const near = reachable
        .map(who => ({ who, score: input.likeness(asked, who.name) }))
        .filter(one => one.score >= CLOSE_ENOUGH_TO_OFFER)
        .sort((a, b) => b.score - a.score)
        .slice(0, NAMES_ONE_PERSON_OFFERS);

    if (near.length > 0) {
        const names = near.map(one => one.who.name);
        const called = WHAT_THEY_CALL_IT[near[0]!.who.kind];
        return {
            said: names.length === 1
                ? `${input.asker.name} does not know it and offers the nearest thing they `
                  + `have: "${names[0]}?" They wait to be told whether that was ${called}.`
                : `${input.asker.name} does not know it and has two it could be. `
                  + `"${names[0]}?" they say. "Or ${names[1]}." They wait for you to pick one.`,
            offered: names
        };
    }

    // NOTHING THEY CAN PLACE, WHICH IS STILL AN ANSWER. What they can do is say
    // who IS here, because that is the one thing they are certain of, and it is
    // the sentence a person actually says: not that you are wrong, but that
    // this is what there is.
    const here = input.theyCanPlace.inFrontOfThem
        .filter(who => who.id !== input.asker.id)
        .map(who => who.name);

    // AND THE CASE WITH NO CANDIDATE OF ANY KIND, which is a word rather than a
    // thing. "I end the Hollow Court" is a sentence whose VERB is the unclear
    // part, and the answer is the one a person gives: what do you mean by that.
    if (here.length === 0) {
        return {
            said: `${input.asker.name} does not follow, and says so. They ask what you mean `
                + 'by it. There is nobody else standing here to put it to.',
            offered: []
        };
    }

    return {
        said: `${input.asker.name} does not follow, and asks what you mean by it. They tell `
            + `you what is here instead - ${theNames(here)} - and leave you to say which of `
            + 'it you meant, or that it was none of it.',
        offered: []
    };
}

/** A list, the way somebody says one out loud. */
function theNames(names: readonly string[]): string {
    if (names.length === 1) return names[0]!;
    if (names.length <= 3) {
        return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    }
    return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}
