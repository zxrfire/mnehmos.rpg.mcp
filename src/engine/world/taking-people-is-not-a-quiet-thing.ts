/**
 * How loud it is to take a number of people, and the two records it leaves.
 *
 * The design owner, on feeding the Root Cauldron: *"if you started doing this,
 * people would know."* That is a rule about absences rather than about
 * cauldrons, and the news layer already has the axes to carry it. What was
 * missing was anything that turned a HEAD COUNT into them, so ten people gone
 * and a valley gone entered the world identically.
 *
 * THE DESIGN IS ONE LINE: **the price of a working is paid in bodies, and the
 * number of bodies decides whether it can be done in the dark.**
 *
 * TWO RECORDS, AND THE GAP BETWEEN THEM IS THE POINT. A body that sentences
 * somebody reads the sentence out, which is ordinary and says nothing about
 * what became of them. The taking itself leaves a hole. Both are ordinary facts
 * in the same ledger, so the sentences can be read end to end and the holes can
 * be counted - and whether those two accounts reconcile is a question only
 * somebody who knows what the sentences are FOR can even ask.
 *
 * The engine states both and never states the conclusion. Reading a sentence
 * out is a CONVENTION and not a lock: a body can decline, which is one person
 * with a portfolio deciding not to, and the inference belongs to whoever is
 * playing rather than to a string.
 *
 * Nothing here is about any particular object. Anything that removes people in
 * quantity should enter the world through this rather than choosing its own
 * scale.
 */

import { aDeedEntersTheWorld, type TheWorldNowHoldsIt } from './a-deed-enters-the-world-as-a-fact.js';
import type { EventScale, HistoricalActor } from './history.js';
import type { Severity } from '../social/grudges.js';
import type { WorldState } from './world-state.js';

/**
 * The bands, in heads.
 *
 * Read as "what would have to be true for nobody to notice". A handful can go
 * missing inside one house's walls; a few hundred cannot leave a prefecture
 * without the roads knowing; past a few thousand there is no arrangement of
 * secrecy that survives the next harvest count.
 */
export const A_ROOM_HOLDS = 20;
export const A_PREFECTURE_HOLDS = 500;
export const A_PROVINCE_HOLDS = 20_000;

/** What a taking is worth, on the two axes the news layer already reads. */
export interface HowLoud {
    weight: Severity;
    scale: EventScale;
}

/**
 * How far the taking of this many people carries.
 *
 * The same shape as `howFarACrossingCarries`: one table, argued with in one
 * place, and no second opinion about what the news layer's terms mean.
 */
export function howLoudTakingPeopleIs(heads: number): HowLoud {
    const taken = Math.max(0, Math.floor(heads));
    if (taken <= A_ROOM_HOLDS) return { weight: 'grave', scale: 'local' };
    if (taken <= A_PREFECTURE_HOLDS) return { weight: 'unforgivable', scale: 'local' };
    if (taken <= A_PROVINCE_HOLDS) return { weight: 'unforgivable', scale: 'regional' };
    return { weight: 'unforgivable', scale: 'continental' };
}

/**
 * Whether this many could be taken without the world working out that they were.
 *
 * The useful read for anybody deciding HOW to pay a price rather than whether
 * to: the same working has a quiet road and a loud one, and which is available
 * is a fact about the count and not about the care taken.
 */
export function couldBeDoneInTheDark(heads: number): boolean {
    return Math.max(0, Math.floor(heads)) <= A_ROOM_HOLDS;
}

export interface ATaking {
    heads: number;
    /** Absolute WORLD day. Not the run's elapsed days. */
    day: number;
    /** What the record says happened, in the ledger's voice. */
    summary: string;
    locationId?: string | null;
    place?: string | null;
    /** Who did it, where anybody can say. Empty is nobody knowing. */
    actors?: readonly HistoricalActor[];
    factionIds?: readonly string[];
}

/**
 * The hole a taking leaves.
 *
 * `causeKnown` is false by default because an absence is not a report: what
 * reaches the world is that people are gone, and almost never what took them.
 * That is the whole reason a player can find one end of this and have to walk
 * to the other.
 */
export function aTakingEntersTheWorld(
    state: WorldState,
    input: ATaking
): TheWorldNowHoldsIt {
    const loud = howLoudTakingPeopleIs(input.heads);
    return aDeedEntersTheWorld(state, {
        kind: 'catastrophe',
        day: input.day,
        locationId: input.locationId ?? null,
        place: input.place ?? null,
        actors: [...(input.actors ?? [])],
        factionIds: [...(input.factionIds ?? [])],
        weight: loud.weight,
        scale: loud.scale,
        summary: input.summary,
        workedOut: false,
        // What a stranger has to go on: people are not where they were. Never
        // what took them, which is the whole reason one end of this can be
        // found and the other has to be walked to.
        unattributed: 'People are gone from where they were, and nobody who is left can say who came for them.',
        data: { heads: Math.max(0, Math.floor(input.heads)) }
    });
}

/**
 * The sentence a body reads out, where it reads one out.
 *
 * WHAT IS ANNOUNCED IS A SENTENCE AND NOT A USE. Somebody was caught and is to
 * be put to death: entirely ordinary, entirely true, and complete as far as it
 * goes. Where the body then went is not in the notice and is not in this
 * record, which is why the public half of any such arrangement stays boring
 * and stays available to anybody.
 *
 * `said_in_public` is the ledger's word for an utterance and it is the right
 * one: what is recorded is that a list was read out, not what became of the
 * people on it. A body that declines to read one out simply never calls this,
 * which is what makes the convention a convention and not a lock.
 */
export function anAnnouncementEntersTheWorld(
    state: WorldState,
    input: {
        day: number;
        /** The names read out. Carried through; nothing here reads them. */
        names: readonly string[];
        /** Who read them. By convention the holder of the punishment portfolio. */
        readOutBy: HistoricalActor;
        summary: string;
        locationId?: string | null;
        place?: string | null;
        factionIds?: readonly string[];
    }
): TheWorldNowHoldsIt {
    return aDeedEntersTheWorld(state, {
        kind: 'said_in_public',
        day: input.day,
        locationId: input.locationId ?? null,
        place: input.place ?? null,
        actors: [input.readOutBy],
        factionIds: [...(input.factionIds ?? [])],
        // An announcement is meant to carry. That is what it is for.
        weight: 'grave',
        scale: 'regional',
        summary: input.summary,
        unattributed: 'A sentence was read out in public and the names were read with it.',
        // The COUNT rather than the names: `data` holds scalars, and who was on
        // the list is in the summary where a reader can find it.
        data: { named: input.names.length, announced: true }
    });
}
