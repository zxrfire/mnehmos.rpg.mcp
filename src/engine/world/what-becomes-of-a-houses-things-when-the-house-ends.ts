/**
 * A house ends. Its things do not stop existing, and they stop being its.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `faction_fell` marks the house dissolved, cuts every member loose, and leaves
 * the compound standing, empty and ruined. It says nothing whatever about what
 * the house OWNED, so every object in its treasury kept `ownerId` pointing at an
 * institution that no longer exists, for the rest of the world's life.
 *
 * The design owner, stating the rule: *"once a faction ends, their item
 * ownership is marked now as whoever is holding it (maybe a surviving
 * disciple). So in ruins that owners are long gone, no owner."*
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY IT IS THE WHOLE OF THE RULE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Ownership in this world is a live fact and not a label. Somebody owns a thing
 * because there is somebody to own it, and when there is not, there is not.
 * Those are the only two cases and the holder decides which:
 *
 *   - **Somebody is carrying it.** They walked out of a falling house with it
 *     in their hands and there is nobody left to say it is not theirs. So it is
 *     theirs, and the record says so rather than keeping a claim no one can
 *     press.
 *
 *   - **Nobody is carrying it.** It is in a room in a compound that is now on
 *     the map as ruined. It has no owner, and that is what makes a ruin a ruin.
 *
 * This is also why robbing a grave is a different act from robbing a house, and
 * the difference now falls out of the record instead of being asserted: there
 * is nobody on the row to be wronged. `duties-wired.test.ts` already puts it in
 * those words - *"the reason an unclaimed piece of ground is safe to rob is
 * structural: there is nobody on the row to notice"* - and until this existed,
 * the row said a dead house was still watching.
 */

/** A thing whose ownership is decided by who has it, once the house is gone. */
export interface AThingLeftBehind {
    id: string;
    ownerId: string | null;
    ownerName: string;
    possessorId: string | null;
}

/** Where a single thing's ownership lands. */
export interface WhoOwnsItNow {
    objectId: string;
    /** The holder, or null - which is what a ruin is made of. */
    ownerId: string | null;
    /** Blank where there is no owner, because there is nobody to name. */
    ownerName: string;
}

/**
 * WHAT BECOMES OF EVERYTHING A FALLING HOUSE OWNED.
 *
 * Pure: it decides, and the caller writes. Only things the house actually owned
 * are touched - a thing merely sitting in its compound that belonged to
 * somebody else is somebody else's problem and stays theirs.
 */
export function whoOwnsThemNow(
    objects: readonly AThingLeftBehind[],
    fallenHouseId: string,
    nameOf: (personId: string) => string | null
): WhoOwnsItNow[] {
    const landed: WhoOwnsItNow[] = [];
    for (const object of objects) {
        if (object.ownerId !== fallenHouseId) continue;

        const holder = object.possessorId;
        if (holder === null) {
            // Nobody walked out with it. It is in a ruin, and a ruin's
            // contents answer to nobody - which is the whole difference
            // between robbing one and robbing a house.
            landed.push({ objectId: object.id, ownerId: null, ownerName: '' });
            continue;
        }

        // Somebody has it, and there is no longer anybody who can say it is
        // not theirs. A name the world cannot resolve is treated as no owner
        // rather than as a claim nobody can press.
        const name = nameOf(holder);
        landed.push(name === null
            ? { objectId: object.id, ownerId: null, ownerName: '' }
            : { objectId: object.id, ownerId: holder, ownerName: name });
    }
    return landed;
}
