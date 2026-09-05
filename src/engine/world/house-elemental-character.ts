/**
 * What element a house is, read off the books on its shelf.
 *
 * There is no `element` field on a sect and there must not be one. A house that
 * wants fire roots wants them because its manuals are fire manuals, so the
 * element is a reading over `teaches` and the strength of it is a reading over
 * the same list. A field would be the bespoke version of a fact the catalog
 * already states.
 *
 * ── THE TWO STRENGTHS BEHAVE DIFFERENTLY ────────────────────────────────
 *
 * The Storm Tyrant Court's own admission line is "A mutated lightning root.
 * Everyone else the Court speaks to is not an applicant." That was authored
 * prose in `SECT_ADMISSION.requirement` and nothing in `src/` gated on it. The
 * Cinnabar Crucible Guild wants fire and takes wood and water anyway. Both are
 * real and they are not the same door, so `stance` separates them:
 *
 *   requires  every road it has is the one element, that road is most of the
 *             shelf, and nothing it says about roots reaches past it. A root
 *             the element does not carry has nothing here to climb.
 *   prefers   the element is what it is known for and there is somewhere else
 *             to go. Weights; never refuses.
 *   open      no road survives `admissionOrdinal`. Most of the catalog, and
 *             correctly - eleven houses teach nothing elemental at all.
 *
 * ── A ROAD THAT STOPS AT THE DOOR IS NOT A ROAD ─────────────────────────
 *
 * `cap` is the rung a manual carries somebody to, and it is 0 on a great many
 * bottom-rung arts. Counting those made the Thousand Treasure Pavilion - an
 * auction house with three elementless books and one fire art nobody rises on -
 * a house that turned away every root but fire. So a manual is a road only when
 * it carries past the rung the house admits at, which is `admissionOrdinal` and
 * not a threshold invented here.
 *
 * ── STATED ROOTS WIDEN AND NEVER NARROW ─────────────────────────────────
 *
 * `SECT_ADMISSION.preferredRoots` is authored, and `architecture.ts` measured
 * what happens when it is read as a bar: the Azure Cloud Pavilion's whole
 * elemental shelf is metal, but it says out loud that it takes metal-wood duals
 * and puts uncultivated mortals on probation to find out what they are, so
 * reading its shelf alone makes it absolutist and it is not. A house that names
 * a root its books do not carry has told you the door is wider than the shelf.
 *
 * ── NOTHING HERE BRANCHES ON WHICH ELEMENT ──────────────────────────────
 *
 * Elements are compared to each other and counted. There is no switch on one,
 * and a `element === 'fire'` anywhere downstream of this means the design went
 * wrong rather than that a case was missed.
 *
 * Pure. Deterministic. No RNG - a house's element is a fact about its library.
 */

import type { Element, SpiritRoot } from '../cultivation/spirit-roots.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';

export type HouseElementStance = 'requires' | 'prefers' | 'open';

export interface HouseElementalCharacter {
    /** The element its deepest surviving road carries. Null when `open`. */
    element: Element | null;
    stance: HouseElementStance;
    /** Manuals on that road, and everything else on the shelf. */
    onTheElement: number;
    onTheRest: number;
}

/** What this module needs off a house, and nothing more. */
export interface HouseShelf {
    /** Every manual it teaches: element, and the rung that book carries to. */
    manuals: readonly { element: string | null; cap: number }[];
    /** The rung the house admits at. A road stopping at or below it is filler. */
    admissionOrdinal: number;
    /** Roots the house names, where it names any. Widens the door, never shuts it. */
    statedRoots?: readonly string[];
}

const OPEN: HouseElementalCharacter = {
    element: null, stance: 'open', onTheElement: 0, onTheRest: 0
};

/**
 * The house's element and how hard it holds it.
 *
 * Defensive on every field: a faction assembled by hand carries none of them,
 * and a house we know nothing about must read as a house with no element rather
 * than throw inside a seeder.
 */
export function houseElementalCharacterOf(shelf: HouseShelf): HouseElementalCharacter {
    const manuals = Array.isArray(shelf?.manuals) ? shelf.manuals : [];
    const door = Number.isFinite(shelf?.admissionOrdinal) ? shelf.admissionOrdinal : 0;

    const roads = manuals.filter(m => m?.element != null && Number(m.cap ?? 0) > door);
    if (roads.length === 0) return OPEN;

    // Deepest road wins. Ties go to the road with more books behind it, then to
    // the name, so two houses with identical shelves read identically in every
    // world rather than in whichever order the catalog happens to list them.
    const depth = new Map<string, number>();
    const books = new Map<string, number>();
    for (const road of roads) {
        const key = road.element as string;
        depth.set(key, Math.max(depth.get(key) ?? 0, Number(road.cap ?? 0)));
        books.set(key, (books.get(key) ?? 0) + 1);
    }
    const element = [...depth.keys()].sort((a, b) =>
        (depth.get(b)! - depth.get(a)!)
        || ((books.get(b)! - books.get(a)!))
        || a.localeCompare(b)
    )[0] as Element;

    // THE BULK IS COUNTED OVER THE WHOLE SHELF AND NOT OVER THE SURVIVING ROADS.
    // `cap` decides which element the house is; how much of the house that
    // element is has to be counted against every book it owns, low ones
    // included. Counting only the surviving roads was measured and gave zero
    // houses a requirement - the Storm Tyrant Court teaches seven lightning
    // manuals of which two carry past its own door, and comparing those two
    // against all eleven books read as a house that mostly does something else.
    const onTheElement = manuals.filter(m => m.element === element).length;
    const onTheRest = manuals.length - onTheElement;

    // Three conditions, and each one is a way the house has somewhere else to
    // put somebody: a second road, a shelf that is mostly not this road, or its
    // own statement that it takes a root this road does not carry.
    const soleRoad = depth.size === 1;
    const theBulkOfTheShelf = onTheElement > onTheRest;
    const statedReachesPast = (shelf.statedRoots ?? []).some(key => {
        const root = getSpiritRoot(key as never);
        const carried = root?.elements ?? [];
        return carried.length > 0 && carried.some(e => e !== element);
    });

    return {
        element,
        stance: soleRoad && theBulkOfTheShelf && !statedReachesPast ? 'requires' : 'prefers',
        onTheElement,
        onTheRest
    };
}

/**
 * What this house's door does about this root.
 *
 * `weighted` is the whole of what a preference is: the applicant is not refused
 * and is not the person the house was hoping for. Whoever holds the door
 * decides what that costs; this says only which of the three cases it is.
 */
export type RootAtTheDoor = 'welcome' | 'weighted' | 'refused';

export function rootAtTheDoor(
    house: HouseElementalCharacter,
    root: SpiritRoot | undefined
): RootAtTheDoor {
    if (house.stance === 'open' || house.element === null) return 'welcome';
    if (!root) return house.stance === 'requires' ? 'refused' : 'weighted';
    if (root.elements.includes(house.element)) return 'welcome';
    return house.stance === 'requires' ? 'refused' : 'weighted';
}
