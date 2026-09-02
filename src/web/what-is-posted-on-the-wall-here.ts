/**
 * Reading the wall: the player's side of a recruiting bill.
 *
 * The engine half is
 * `engine/world/houses-that-have-to-advertise-for-disciples.ts`, which decides
 * which houses are reduced to putting up paper and what a given wall is
 * carrying today. This is the layer that knows the three things that one
 * cannot: which place the free-text `Cultivator.location` actually is, what the
 * shipped catalog holds, and where the knowledge rows go.
 *
 * ── Why it is not a new discovery mechanism ──────────────────────────────
 *
 * It is the same one. A bill goes through `KnowledgeGate.learnIfNew` at
 * `placed` with `read` provenance, alongside hearsay, travellers, ruins and
 * archives. There is no flag that skips the gate, nothing is granted at a
 * stage a source cannot carry, and a house already known at `placed` or better
 * writes nothing and is not announced - so a wall the player has read before
 * goes quiet on its own without anything remembering that they read it.
 *
 * ── Why it is free ───────────────────────────────────────────────────────
 *
 * Looking at a wall costs nothing anywhere in the world and it should not cost
 * anything here. The price is downstream, at the door, where it always was:
 * the bill states a bar, and the bar is real.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { SECTS, intakeRouteOf } from '../data/cultivation/sects.js';
import { demonicStandingOf } from '../data/cultivation/demonic-sects-and-what-they-are-willing-to-do.js';
import {
    REGIONS,
    provinceForFaction,
    provinceForRegion
} from '../data/cultivation/regions.js';
import {
    billsOnTheWall,
    whatABillGrants,
    WHAT_THE_PAPER_GIVES_AWAY,
    THE_SAME_TELL_AGAIN,
    type DoorInTheField,
    type PostingGround,
    type RecruitingBill
} from '../engine/world/houses-that-have-to-advertise-for-disciples.js';
import type { KnowledgeGate } from './knowledge.js';

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
 *   Crimson Abyss Hall   a table "outside somebody else's admission day", for
 *                        the people refused inside that morning
 *   Storm Tyrant Court   "collects rather than recruits"
 *   The Quiet Cut        "no name given, no face seen twice"
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

export interface WallReading {
    bills: RecruitingBill[];
    /**
     * Every bill on the wall, worded. What somebody who went and looked sees.
     *
     * Engine-authored; nothing in it is invented and nothing in it names
     * anything the reader does not now hold a record for.
     */
    lines: string[];
    /**
     * Only the bills that put a name into this player's world just now.
     *
     * The split exists because the two callers want different halves. Looking
     * round a town every day for a season must not reprint the same two
     * posters, so ambient noticing takes this; asking deliberately what is
     * posted takes {@link WallReading.lines}, because somebody who walked over
     * to the wall gets the whole wall whether or not they knew the names.
     */
    newLines: string[];
    /** Houses whose names genuinely entered this player's world just now. */
    learned: string[];
}

/**
 * Read whatever is nailed up where this cultivator is standing.
 *
 * Writes the grants and hands back what the narrator may say. Returns an empty
 * reading rather than a refusal when there is no wall, because "there is
 * nothing posted here" is a fact about the place and the caller decides
 * whether it is worth a sentence.
 */
export function readTheWall(
    knowledge: KnowledgeGate,
    cultivator: Cultivator,
    run: Run
): WallReading {
    const placeName = (cultivator.location ?? '').trim();
    const onDay = Math.floor(run.elapsedDays);
    const bills = billsOnTheWall({
        field: openDoorsInTheWorld(),
        placeName,
        ground: postingGroundOf(placeName),
        placeProvinceId: provinceOfPlace(placeName),
        onDay,
        seed: run.seed
    });

    const learned: string[] = [];
    const lines: string[] = [];
    const newLines: string[] = [];
    // The reading is said in full the first time its kind appears on this wall
    // and shortened after that. Tracked separately for the two lists, because
    // a caller may render either one on its own and neither may be missing the
    // full reading for a kind it contains.
    const saidInFull = new Set<string>();
    const saidInFullAmongTheNew = new Set<string>();
    const readingFor = (why: string, said: Set<string>): string => {
        const full = !said.has(why);
        said.add(why);
        return full
            ? WHAT_THE_PAPER_GIVES_AWAY[why as keyof typeof WHAT_THE_PAPER_GIVES_AWAY]
            : THE_SAME_TELL_AGAIN[why as keyof typeof THE_SAME_TELL_AGAIN];
    };

    for (const bill of bills) {
        const grant = whatABillGrants(bill);
        const isNew = knowledge.learnIfNew({
            holderId: cultivator.id,
            onDay,
            ...grant
        });
        lines.push(`${bill.saying} ${readingFor(bill.why, saidInFull)}`);
        if (!isNew) continue;
        learned.push(bill.houseName);
        newLines.push(`${bill.saying} ${readingFor(bill.why, saidInFullAmongTheNew)}`);
    }

    return { bills, lines, newLines, learned };
}
