/**
 * You swing at somebody far above you. They decide what happens next.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A player at Qi Condensation Layer 1 attacked a cultivator five major realms
 * above them, at a power ratio of 2414 to 1. The engine **refused the swing**
 * and printed a menu of four things that would work instead.
 *
 * The design owner: *"it can't be refused. You swing at a cultivator way above
 * you... you break your arm, maybe you just die, or they laugh at your bravery
 * and give you something. This should fall out."*
 *
 * Refusing was the engine protecting a player from their own decision, which is
 * the one thing it must never do. A mortal who swings at an immortal is not
 * stopped by the world. The world consumes them, or is amused by them, and
 * either way something happens.
 *
 * `combat.ts` already had half the instinct and says so in its own words at the
 * gap branch - *"NOT NOTHING. The fight does not happen and the swing does"* -
 * and it shatters the sword. What it never did was let anything happen to the
 * person swinging, or let the person swung at do anything at all.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT IT FALLS OUT OF
 * ═════════════════════════════════════════════════════════════════════════
 *
 * *"This should fall out"* is the instruction, so nothing here is a new axis.
 * All three numbers are ones the world already derives about everybody:
 *
 *   `push`        how hard they go at things, from `whatSomebodyIsLike`
 *   `room`        how much they do it where it will be counted, same function
 *   `openHanded`  what they will spend on somebody, from `openHandednessOf`
 *
 * A `no_contest` verdict was already the right FRAME - its own description
 * calls it *"a decision the stronger party made alone"* - and the only thing
 * wrong with it was that the decision was always nothing. It is now read off
 * the person making it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE OUTCOMES ARE ONES THAT ALREADY EXISTED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `ConfrontationOutcome` already carries death, humiliation and the rest, and
 * every one of the four decisions below resolves to something on that list or
 * to an ordinary exchange run in the defender's favour. Nothing new is
 * invented; what changes is that a categorical gap now reaches them.
 */

/**
 * The three numbers the world already keeps about somebody, on -1..+1.
 *
 * Supplied by the caller, never derived here: this module is inside the pure
 * engine, and who somebody IS lives in the world layer. The same seam the
 * breakthrough toll uses.
 */
export interface WhatTheyAreLike {
    /** How hard they go at things. Higher means less inclined to let it pass. */
    push: number;
    /** How much they do it where it will be counted. */
    room: number;
    /** What they will spend on somebody who is nothing to them. */
    openHanded: number;
}

export type WhatTheyDo =
    /** They kill them. The commonest answer in the setting and the cheapest. */
    | 'kills'
    /** They hurt them and leave it there. A broken arm is a whole sentence. */
    | 'breaks'
    /** They put them down where it will be seen, and let them walk away. */
    | 'humiliates'
    /** They are amused, and somebody who is amused at that height gives things. */
    | 'indulges';

/**
 * How much open-handedness it takes before audacity reads as worth rewarding.
 *
 * Deliberately high. Being given something by somebody far above you is one of
 * the genre's turning points and it must stay one; a world where a third of
 * the people you attack hand you a treasure is a world with no danger in it.
 */
export const OPEN_HANDED_ENOUGH_TO_BE_AMUSED = 0.55;

/** Above this much push, letting it pass is not in them. */
export const PUSH_ENOUGH_TO_ANSWER_IT = 0.2;

/** And above this much of it, they do not stop at hurting. */
export const PUSH_ENOUGH_TO_FINISH_IT = 0.65;

/** Above this much room-playing, an answer is made where it will be counted. */
export const ROOM_ENOUGH_TO_MAKE_IT_PUBLIC = 0.3;

/**
 * WHAT THEY DO ABOUT IT.
 *
 * Ordered, and the order is the argument.
 *
 * Being amused is read first because it is the rarest and because it is a
 * decision about the PERSON rather than about the offence: somebody
 * open-handed enough to be delighted by a hopeless swing was going to be
 * delighted by it whatever else they are. It is also gated on them not being
 * the sort who answers everything, which is what keeps a generous killer a
 * killer.
 *
 * Then push, which is the axis about answering at all, and how far it goes
 * decides whether the answer is a wound or an ending. Then room, which is not
 * about whether to answer but about where: somebody who plays to a crowd puts
 * you down in front of one and lets you live to be the story.
 *
 * And the floor is `breaks`, not `nothing`. Somebody who takes a swing from a
 * stranger and does literally nothing about it is a person the setting does not
 * contain, and it is what this whole module exists to stop the engine saying.
 */
export function whatTheyDoAboutIt(them: WhatTheyAreLike): WhatTheyDo {
    if (them.openHanded >= OPEN_HANDED_ENOUGH_TO_BE_AMUSED
        && them.push < PUSH_ENOUGH_TO_FINISH_IT) {
        return 'indulges';
    }
    if (them.push >= PUSH_ENOUGH_TO_FINISH_IT) return 'kills';
    if (them.room >= ROOM_ENOUGH_TO_MAKE_IT_PUBLIC) return 'humiliates';
    if (them.push >= PUSH_ENOUGH_TO_ANSWER_IT) return 'breaks';
    return 'breaks';
}

/**
 * Whether the decision puts a hand on them at all.
 *
 * `humiliates` and `indulges` are both decisions to leave somebody standing,
 * and the difference between them is what the person walks away carrying.
 */
export function theyLayAHandOn(decision: WhatTheyDo): boolean {
    return decision === 'kills' || decision === 'breaks';
}

/**
 * Engine-authored and factual, for the record rather than the prose.
 */
export function whatTheyDecided(decision: WhatTheyDo): string {
    switch (decision) {
        case 'kills':
            return 'They answered it in full, and nothing about the distance made that hard.';
        case 'breaks':
            return 'They answered it once and stopped, which is the whole of what it was worth to them.';
        case 'humiliates':
            return 'They put them down where it would be seen and let them walk away from it.';
        case 'indulges':
            return 'They were amused, and somebody standing that far above and amused gives things.';
    }
}
