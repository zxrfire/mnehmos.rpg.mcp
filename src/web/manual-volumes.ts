/**
 * Which volumes of a work a holder has.
 *
 * One question, asked from three places - what a purchase gets you, what a
 * road within reach would take, and what a sale hands over - so it is a module
 * rather than a private helper of whichever verb happened to ask first.
 */

/**
 * Which volumes of a work a holder has, for a work they already KNOW.
 *
 * All of them, and that is a statement rather than a stub. A scattered manual
 * is scattered at the point of ACQUISITION - the volumes are objects, they sit
 * in three different places, and finding them is the search. Nothing in the
 * learning path models that yet: `handleLearn` puts an id in `knownTechniques`
 * and there is no cultivator-side object table for a volume to live in, so the
 * only honest reading of "they know it" today is that they have the work.
 *
 * Asserting the opposite would be a silent nerf rather than a mechanic: exactly
 * one cultivation manual in the catalog is scattered, and pretending every
 * holder of it lacks every volume would quietly drop its ceiling by three rungs
 * for a reason no player could see or act on.
 *
 * When acquisition grows a volume model this becomes a read of it, and
 * `effectiveCapOf` already computes the unbroken run from a gapped set.
 */
export function wholeWorkVolumes(art: { volumes?: readonly string[] | null }): readonly string[] {
    return art.volumes ?? [];
}
