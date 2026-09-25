/**
 * The doors open in the world and the walls a house posts an intake on, read off
 * the catalog.
 *
 * Here and not in the web layer because the world's own intake reads the same
 * walls a player does: nobody joins a house out of thin air, and an intake a
 * notice named is one of the roads (`when-a-house-takes-people-on.ts`). Moved
 * from `src/web/what-is-posted-on-the-wall-here.ts`, which re-exports them.
 */

import { SECTS, intakeRouteOf } from '../../data/cultivation/sects.js';
import { demonicStandingOf } from '../../data/cultivation/demonic-sects-and-what-they-are-willing-to-do.js';
import { REGIONS, provinceForFaction, provinceForRegion } from '../../data/cultivation/regions.js';
import type { DoorInTheField, PostingGround } from './houses-that-have-to-advertise-for-disciples.js';

/**
 * Every door open anywhere, as the four facts the derivation reads.
 *
 * `intakeRouteOf` rather than the `recruits` boolean, because the three-valued
 * read is the one that matters here: a Dao house's route in is adoption, and
 * `docs/world/houses/dao-houses.md` states the consequence outright - "Adoption is
 * the only door, so a house cannot advertise". A house that takes nobody and a
 * house that takes only who it chose are both off the wall.
 *
 * `postsInPublic` is `demonicStandingOf`, and reading THAT rather than
 * `alignment` is the point. Alignment would be an inference; `DEMONIC_STANDINGS`
 * is the catalog stating, for each of the six bodies by name, how it actually
 * comes by people - and not one of the six does it by public notice:
 *
 *   The Severed          "no recruitment table and no approach to anybody
 *                        who has not walked in"
 *   Crimson Abyss Fortress   a table "outside somebody else's admission day", for
 *                        the people refused inside that morning
 *   Storm Tyrant Court   "collects rather than recruits"
 *   The Still Blade Pavilion        "no name given, no face seen twice"
 *   Bone Lantern Cult    "not posted anywhere. Mentioned to corpse carriers"
 *                        (`rogues.ts`)
 *   Nine Abyss Flame     open about what it is, which "the province reads as
 *                        recruitment" - and still not a bill on a wall
 *
 * So this is not a ban and not a moral judgement. Each of the six needs bodies
 * exactly as badly as any other house on the list and has a documented route
 * that is not paper, and the one thing a wall would cost every one of them is
 * an address. `DEMONIC_STANDINGS` had no reader in `src/` before this.
 *
 * The other side of the mechanic is corroborated by the catalog too: Verdant
 * Spring Hall's standing offer in `rogues.ts` is "posted at the gate at
 * admission season, when there are the most desperate cultivators standing in
 * front of it."
 */
export function openDoorsInTheWorld(): DoorInTheField[] {
    return SECTS
        .filter(sect => intakeRouteOf(sect.id) === 'open')
        .map(sect => ({
            id: sect.id,
            name: sect.name,
            admissionOrdinal: sect.admissionOrdinal,
            powerOrdinal: sect.powerOrdinal,
            provinceId: provinceForFaction(sect.id)?.id ?? null,
            postsInPublic: demonicStandingOf(sect.id) === undefined
        }));
}

/**
 * What kind of ground a free-text place name is standing on.
 *
 * The same join `groundOf` in `leaving-things-for-the-next-life.ts` makes, by
 * name, because the name is what both sides agree on. Kept separate rather
 * than shared because that one answers a different question - it collapses the
 * catalog's seven kinds onto a burial hazard - and a wall wants the kind
 * itself.
 */
export function postingGroundOf(place: string | null | undefined): PostingGround {
    const wanted = (place ?? '').trim().toLowerCase();
    if (wanted.length === 0) return 'unplaceable';
    for (const region of REGIONS) {
        for (const known of region.places) {
            if (known.name.trim().toLowerCase() === wanted) return known.kind;
        }
    }
    return 'unplaceable';
}

/** The province a free-text place name is inside, or null when it is off the map. */
export function provinceOfPlace(place: string | null | undefined): string | null {
    const wanted = (place ?? '').trim().toLowerCase();
    if (wanted.length === 0) return null;
    for (const region of REGIONS) {
        if (!region.places.some(p => p.name.trim().toLowerCase() === wanted)) continue;
        return provinceForRegion(region.id)?.id ?? null;
    }
    return null;
}
