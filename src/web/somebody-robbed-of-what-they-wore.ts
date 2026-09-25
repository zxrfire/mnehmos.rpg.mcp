/**
 * Somebody who had what they wore taken off them does something about it.
 *
 * The owner: their first move is getting something to wear; how depends on the person, and a
 * robbed disciple who reports it gets new official robes, while one who does not "will find a
 * way". The engine takes the action and the narrator writes it: "gemma says they have nothing on
 * and the NPCs take an action to get something". Whether the player sees it depends on whether
 * they are there, so it happens when the person is next seen, a day or more after the theft.
 *
 * What they do is `whatTheyDoAboutALoss`, drawn off their face trait. What follows the report (the
 * punishment hall, the leak, what their merit buys them) and a person who comes after you as they
 * are both need the world's people to act on their own, and are not done here.
 */

import { forStream } from '../engine/cultivation/rng.js';
import { whatTheyDoAboutALoss } from '../engine/social-leverage/what-somebody-does-about-a-loss.js';
import { realmIndexOf, whatTheyCanDoAboutIt } from '../engine/social-leverage/what-somebody-does-about-being-wronged.js';
import { aUniformFor } from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import {
    theClothesTakenOffThem,
    theClothesTheyStandUpIn,
    whatTheyHaveOn
} from '../engine/world/what-somebody-stands-up-in.js';
import type { WorldState } from '../engine/world/world-state.js';

/** Somebody who comes after you as they are still covers up, after this many days. */
const AS_THEY_ARE_FOR = 3;

/** The data keys on the garment they came by: on which run day, and how. */
const CAME_BY_IT_ON = 'cameByItOnRunDay';
const CAME_BY_IT_HOW = 'cameByItHow';

/**
 * What somebody robbed of what they wore does, the first time they are seen a day or more after
 * it. Writes the garment they came by into `world.objects` and returns true when it did.
 */
export function theyDoSomethingAboutWhatTheyWore(input: {
    world: WorldState;
    person: { id: string; name: string; realmOrdinal: number; houseId: string | null };
    /** The rung of whoever took it, for what the gap lets them do about it. */
    takenByOrdinal: number;
    /** The run's day, the clock a theft is written on. */
    today: number;
}): boolean {
    const taken = theClothesTakenOffThem(input.world.objects, input.person.id);
    if (taken === null) return false;
    const theftDay = Math.max(...taken.map(object => object.provenance.at(-1)?.onDay ?? 0));
    if (input.today <= theftDay) return false;
    const done = whatTheyDoAboutALoss({
        theirId: input.person.id,
        houseId: input.person.houseId,
        canDo: whatTheyCanDoAboutIt(realmIndexOf(input.person.realmOrdinal) - realmIndexOf(input.takenByOrdinal)),
        rng: forStream(input.person.id, `after-a-loss:${taken[0]!.id}`)
    });
    // Somebody with no face to lose comes as they are, and covers up in their own time.
    if (!done.coverFirst && input.today - theftDay < AS_THEY_ARE_FOR) return false;
    const house = input.person.houseId === null
        ? null
        : input.world.factions.find(faction => faction.id === input.person.houseId) ?? null;
    const came: ObjectRecord = done.replacedFrom === 'their_house' && house !== null
        ? aUniformFor({ memberId: input.person.id, houseId: house.id, houseName: house.name, onDay: input.world.currentDay })
        : theClothesTheyStandUpIn({
            personId: input.person.id,
            personName: input.person.name,
            onDay: input.world.currentDay,
            among: input.world.objects
        });
    // A set handed out on a day a set was already handed out is a set of its own.
    const again = input.world.objects.filter(object => object.id === came.id || object.id.startsWith(`${came.id}-again`)).length;
    input.world.objects.push({
        ...came,
        id: again === 0 ? came.id : `${came.id}-again-${again}`,
        data: {
            ...came.data,
            [CAME_BY_IT_ON]: input.today,
            [CAME_BY_IT_HOW]: done.replacedFrom === 'their_house' && house !== null
                ? `reported the loss to ${house.name}, which issued them fresh robes`
                : 'found something to wear'
        }
    });
    return true;
}

/**
 * What the card says about it on the day it happened, or null. Off the garment itself, so the
 * scene built twice in a turn says it both times and a later day says nothing.
 */
export function whatTheyDidAboutWhatTheyWore(
    objects: readonly ObjectRecord[],
    personId: string,
    today: number
): string | null {
    for (const object of whatTheyHaveOn(objects, personId)) {
        const how = object.data?.[CAME_BY_IT_HOW];
        if (object.data?.[CAME_BY_IT_ON] === today && typeof how === 'string') {
            return `Since what they wore was taken off them, they ${how}: they have on ${object.name}.`;
        }
    }
    return null;
}
