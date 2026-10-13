/** A made token's trigger consumes its physical row, wherever it is held.
 * The caller owns the trigger, witnesses and any memory of the occurrence.
 * This helper keeps no archive and never decides which tokens have lapsed.
 */
import type { ObjectRecord } from './possessions.js';

export function madeTokensGoToDust(objects: ObjectRecord[], ids: ReadonlySet<string>): ObjectRecord[] {
    const dust: ObjectRecord[] = [];
    let kept = 0;
    for (const object of objects) {
        if (ids.has(object.id)) dust.push(object);
        else objects[kept++] = object;
    }
    objects.length = kept;
    return dust;
}

/** A fact about the item, suitable for the engine's own observation line. */
export function theTokenWentToDust(name: string, useless = false): string {
    return useless ? `${name} is now useless and has gone to dust.` : `${name} went to dust.`;
}
