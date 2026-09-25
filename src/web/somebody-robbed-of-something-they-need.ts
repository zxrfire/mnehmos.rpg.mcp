/**
 * Somebody who had a thing they need taken off them does something about it.
 *
 * The owner, on a disciple robbed of their robes: the first move is getting something to wear,
 * how depends on the person, a disciple who reports it gets new official robes and one who does
 * not "will find a way". The engine takes the action and the narrator writes it. And none of it is
 * special to robes: "this is the same boat if you robbed their sword, or their identity token ...
 * it's just funnier if it's clothes, but it's not bespoke".
 *
 * A thing serves a NEED: what somebody wears, what they fight with, what proves who they are.
 * Losing it leaves them short only when nothing else they hold serves the same need.
 *
 * And the engine rules the replacement only where it is possible: "if you rob them very far away
 * from a sect, they can't easily get another set". Their house issues another only inside its
 * compound, and only to somebody who reports the loss. Among people, a settlement or a house's
 * seat, a plain one can be come by, except proof of who you are, which only a house can cut.
 * Anywhere else they go without. It happens when they are next seen, a day or more after.
 *
 * What they do is `whatTheyDoAboutALoss`, drawn off their face trait. What follows a report (the
 * punishment hall, the leak, what their merit buys them) and somebody coming after you as they are
 * both need the world's people to act on their own, and are not done here.
 */

import { forStream } from '../engine/cultivation/rng.js';
import { whatTheyDoAboutALoss } from '../engine/social-leverage/what-somebody-does-about-a-loss.js';
import { realmIndexOf, whatTheyCanDoAboutIt } from '../engine/social-leverage/what-somebody-does-about-being-wronged.js';
import { isInsideTheCompound } from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import type { LocationRecord } from '../engine/world/locations.js';
import { isAWeapon } from '../engine/world/what-somebody-fights-with.js';
import { hadAs, makeObject, type ObjectRecord } from '../engine/world/possessions.js';
import { isAGarment, theClothesTheyStandUpIn, whatTheyHaveOn } from '../engine/world/what-somebody-stands-up-in.js';
import type { WorldState } from '../engine/world/world-state.js';

/** What a thing is FOR, to the person it belongs to. */
export type ANeed = 'something_to_wear' | 'something_to_fight_with' | 'proof_of_who_they_are';

/** The need a thing serves, or null for a thing nobody is short of for losing. */
export function theNeedItServes(object: Pick<ObjectRecord, 'tags' | 'power' | 'kind'>): ANeed | null {
    if (isAGarment(object)) return 'something_to_wear';
    if (object.tags.includes('token')) return 'proof_of_who_they_are';
    if (isAWeapon(object)) return 'something_to_fight_with';
    return null;
}

/** Whether this is theirs: owned by them, or issued to them by a house. */
function theirs(object: ObjectRecord, personId: string): boolean {
    return object.ownerId === personId || object.tags.includes(`member:${personId}`);
}

/** Whether something else they hold serves the same need. */
function stillServed(objects: readonly ObjectRecord[], personId: string, need: ANeed): boolean {
    if (need === 'something_to_wear') return whatTheyHaveOn(objects, personId).length > 0;
    return objects.some(object => object.possessorId === personId && theNeedItServes(object) === need);
}

/**
 * What was taken off somebody that has left them short, need by need: things of theirs in
 * somebody else's hands, where nothing else they hold serves the need. Empty for nearly everybody.
 */
export function whatALossLeftThemShortOf(
    objects: readonly ObjectRecord[],
    personId: string
): { need: ANeed; taken: ObjectRecord[] }[] {
    const byNeed = new Map<ANeed, ObjectRecord[]>();
    for (const object of objects) {
        // In somebody else's hands. A thing of theirs lying on the ground, or kept at home, has
        // not been taken off them.
        if (object.possessorId === null || object.possessorId === personId || !theirs(object, personId)) continue;
        const need = theNeedItServes(object);
        if (need === null || stillServed(objects, personId, need)) continue;
        byNeed.set(need, [...(byNeed.get(need) ?? []), object]);
    }
    return [...byNeed].map(([need, taken]) => ({ need, taken }));
}

/** The kinds of place with people and goods around. */
const AMONG_PEOPLE = new Set(['settlement', 'sect_seat']);

/** How far up from a room a place is looked at: room, precinct, seat, the settlement round it. */
const HOPS_UP = 4;

function amongPeople(byId: ReadonlyMap<string, LocationRecord>, locationId: string | null): boolean {
    let at = locationId;
    for (let hops = 0; hops <= HOPS_UP && at !== null; hops++) {
        const place = byId.get(at);
        if (place === undefined) return false;
        if (AMONG_PEOPLE.has(place.kind)) return true;
        at = place.parentId;
    }
    return false;
}

/** Somebody who comes after you as they are still sees to it, after this many days. */
const AS_THEY_ARE_FOR = 3;

/** The data keys on the thing they came by: on which run day, and how. */
const CAME_BY_IT_ON = 'cameByItOnRunDay';
const CAME_BY_IT_HOW = 'cameByItHow';

/** A plain one of what a need wants, to be come by among people, or null where there is none. */
function aPlainOne(need: ANeed, person: { id: string; name: string }, onDay: number, among: readonly ObjectRecord[]): ObjectRecord | null {
    if (need === 'something_to_wear') {
        return theClothesTheyStandUpIn({ personId: person.id, personName: person.name, onDay, among });
    }
    if (need === 'something_to_fight_with') {
        return makeObject({
            id: `plain-blade-${person.id}-${Math.floor(onDay)}`,
            name: 'a plain blade',
            kind: 'artifact',
            significance: 'mundane',
            // The lowest a made blade is rated: something to fight with, and no more.
            power: 1,
            possessorId: person.id,
            ownerId: person.id,
            ownerName: person.name
        });
    }
    // Proof of who you are is cut by a house and nowhere else.
    return null;
}

/** Another of the same thing, from the house that issued the first. */
function anotherFromTheHouse(taken: ObjectRecord, personId: string, onDay: number): ObjectRecord {
    const again = hadAs({ ...taken, provenance: [], possessorId: personId }, isAGarment(taken) ? 'worn' : 'inventory');
    return { ...again, id: `${taken.id}-reissued-${Math.floor(onDay)}` };
}

/**
 * What somebody short of a thing does, the first time they are seen a day or more after losing
 * it. Writes what they came by into `world.objects`, and returns true when it wrote anything.
 */
export function theyDoSomethingAboutWhatTheyLost(input: {
    world: WorldState;
    person: { id: string; name: string; realmOrdinal: number; houseId: string | null; locationId: string | null };
    /** The rung of whoever took it, for what the gap lets them do about it. */
    takenByOrdinal: number;
    /** The run's day, the clock a theft is written on. */
    today: number;
}): boolean {
    const byId = new Map(input.world.locations.map(place => [place.id, place]));
    const house = input.person.houseId === null
        ? null
        : input.world.factions.find(faction => faction.id === input.person.houseId) ?? null;
    let wrote = false;
    for (const { need, taken } of whatALossLeftThemShortOf(input.world.objects, input.person.id)) {
        const theftDay = Math.max(...taken.map(object => object.provenance.at(-1)?.onDay ?? 0));
        if (input.today <= theftDay) continue;
        // A token is re-cut by its house's own yearly pass, which takes the stolen one out of
        // the thief's hands everywhere at once (`a-house-knows-its-own-by-a-lamp-and-a-token.ts`).
        if (need === 'proof_of_who_they_are') continue;
        const done = whatTheyDoAboutALoss({
            theirId: input.person.id,
            houseId: input.person.houseId,
            canDo: whatTheyCanDoAboutIt(realmIndexOf(input.person.realmOrdinal) - realmIndexOf(input.takenByOrdinal)),
            rng: forStream(input.person.id, `after-a-loss:${taken[0]!.id}`)
        });
        // Somebody with no face to lose comes as they are, and sees to it in their own time.
        if (!done.coverFirst && input.today - theftDay < AS_THEY_ARE_FOR) continue;
        // WHAT IS POSSIBLE WHERE THEY STAND.
        const houseIssued = taken.find(object => house !== null && (object.ownerId === house.id || object.tags.includes(`house:${house.id}`)));
        const fromTheirHouse = done.replacedFrom === 'their_house' && house !== null && houseIssued !== undefined
            && house.seatLocationId !== null && isInsideTheCompound(byId, input.person.locationId, house.seatLocationId);
        const came = fromTheirHouse
            ? anotherFromTheHouse(houseIssued!, input.person.id, input.world.currentDay)
            : amongPeople(byId, input.person.locationId)
                ? aPlainOne(need, input.person, input.world.currentDay, input.world.objects)
                : null;
        if (came === null) continue;
        input.world.objects.push({
            ...came,
            data: {
                ...came.data,
                [CAME_BY_IT_ON]: input.today,
                [CAME_BY_IT_HOW]: fromTheirHouse && house !== null
                    ? `reported the loss to ${house.name}, which issued them another`
                    : 'came by another'
            }
        });
        wrote = true;
    }
    return wrote;
}

/** The card's lines for somebody short of a thing, and for what they came by on the day they did. */
export function whatTheCardSaysOfALoss(objects: readonly ObjectRecord[], personId: string, today: number): string[] {
    const lines: string[] = [];
    for (const { need, taken } of whatALossLeftThemShortOf(objects, personId)) {
        // "their iron sword", not "their an iron sword": catalogue names carry their own article.
        const names = taken.map(object => object.name.replace(/^(?:an?|the)\s+/i, '')).join(' and ');
        lines.push(need === 'something_to_wear'
            ? `Has nothing on: their ${names} were taken off them.`
            : need === 'something_to_fight_with'
                ? `Has nothing to fight with: their ${names} was taken off them.`
                : `Has nothing to prove who they are: their ${names} was taken off them.`);
    }
    for (const object of objects) {
        const how = object.data?.[CAME_BY_IT_HOW];
        if (object.possessorId === personId && object.data?.[CAME_BY_IT_ON] === today && typeof how === 'string') {
            lines.push(`Since something of theirs was taken off them, they ${how}: ${object.name}.`);
        }
    }
    return lines;
}
