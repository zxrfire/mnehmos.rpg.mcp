/**
 * Guest studentship: what a house will teach somebody it has not taken.
 *
 * AND IT COSTS THE HOUSE NOTHING, which is the half that makes it safe: a house
 * can afford to teach an outsider its lower material precisely BECAUSE the deep
 * material is behind membership. Nobody is afraid of a guest leaving - they were
 * never shown the thing worth stealing.
 *
 * A guest is on the station roll and never the house roll (`faction-roll.ts`
 * filters on `rankIndex === null` rather than on a faction id), and therefore
 * KEEPS THEIR OWN HOUSE: not a transfer, not a secondment, not a defection, so
 * `docs/world/climbing/past-the-ceiling.md`'s departure economy does not fire.
 *
 * *"A house lends a guest from what it holds in quantity, and never from what it
 * holds in ones."* That is {@link WORKING_ROAD_CAP} doing the work - a physical
 * reason rather than a tier - so the deepest thing on a shelf is closed by
 * construction and a house always keeps its best.
 *
 * Measured over the catalog with no per-house authoring: 17 of 34 bodies would
 * take a guest; 6 of the 7 dao houses would; the House of Held Names would not,
 * because its shelf caps at 13 and there is nothing behind it; the Hollow Court
 * would not, having one book and it is the top of the world; the Kiln Wardens
 * teach nothing at all. A tenth house wanting a different arrangement changes a
 * column - there is no `if (factionId === ...)` below and there must never be one.
 */

import {
    SECTS,
    getSect,
    intakeRouteOf,
    type SectEntry
} from '../../data/cultivation/sects.js';
import { getTechnique, classOf, capOf } from '../../data/cultivation/techniques.js';
import { getProductionTier } from '../../data/cultivation/faction-character.js';
import { favourStanceOf } from '../../data/cultivation/a-favour-skips-the-admission-bar.js';
import { doorsOf, housesWithTwoDoors } from '../birth/spending-a-word-to-place-a-child.js';
import { WORKING_ROAD_CAP } from '../world/manuals.js';

// WHAT THE POSITION IS NOT

/**
 * Everything a guest place does not carry, said before anybody accepts one. The
 * house spends teaching time and nothing else - no protection at a crossing, no
 * backing in a quarrel, no standing, stipend, rung or liability. Engine-authored
 * and never empty, because a guest is away from their own protection among people
 * who owe them nothing, and that has to be legible BEFORE somebody accepts.
 */
export const WHAT_A_GUEST_PLACE_IS_NOT: readonly string[] = [
    'No rung. You are on no ladder here and hold no rank, so nothing anybody '
    + 'says to you is an order and nothing you say to anybody is one either.',
    'No stipend and no contribution. Nothing accrues, and there is nothing to '
    + 'forfeit when you go.',
    'No protection. The house will not stand between you and a crossing, and it '
    + 'will not stand between you and anybody who wants something from you.',
    'No backing in a quarrel. Somebody who leans on you here is not leaning on '
    + 'the house, and the house will not read it as an insult - it will read it '
    + 'as somebody else\'s disciple having a problem.',
    // True whether or not they have a house, and it is the same sentence
    // either way: a guest place moves nobody's protection and creates none.
    'Whatever protection you have is wherever it already was, and it is not here.',
    // THE RESOURCE TAP, which is the half a guest most expects to be wrong
    // about. You are inside the walls and you are not drawing on what is in
    // them: not the stores, not the stones, not the ground they keep for their
    // own. What you are given is somebody's hours, which is the one thing a
    // house can spend on an outsider without spending anything it counts.
    "No share of the house's stores. You are inside and you are not drawing on "
    + "what is in there - what you are being given is somebody's hours and nothing "
    + 'off the shelves.'
];

// THE SHELF, SPLIT

/** One art the house would put in front of somebody it has not taken. */
export interface GuestOpening {
    techniqueId: string;
    name: string;
    /** The rung it carries to, or null for an art that carries nobody. */
    carriesTo: number | null;
    /** How high somebody must already stand to open it. */
    requiredOrdinal: number;
}

/** One art that stays behind the door, and what membership would change. */
export interface GuestWithholding {
    techniqueId: string;
    name: string;
    carriesTo: number | null;
    /** Factual, engine-authored. Never a narrator's sentence. */
    why: string;
}

interface ShelfEntry {
    id: string;
    name: string;
    cap: number | null;
    requiredOrdinal: number;
}

/** Everything on a house's teach list, in one shape, roads and arts together. */
function shelfEntriesOf(house: SectEntry): ShelfEntry[] {
    const out: ShelfEntry[] = [];
    for (const id of house.teaches) {
        const t = getTechnique(id);
        if (!t) continue;
        out.push({
            id: t.id,
            name: t.name,
            cap: classOf(t) === 'cultivation' ? (t.cap ?? capOf(t)) : null,
            requiredOrdinal: t.requiredOrdinal
        });
    }
    return out;
}

/**
 * The deepest rung anything on this house's shelf carries somebody to, or null
 * where it teaches no road at all.
 */
export function shelfTopOf(factionId: string): number | null {
    const house = getSect(factionId);
    if (!house) return null;
    let top: number | null = null;
    for (const entry of shelfEntriesOf(house)) {
        if (entry.cap === null) continue;
        if (top === null || entry.cap > top) top = entry.cap;
    }
    return top;
}

/**
 * Whether this house has anything to hold back, and therefore whether it takes
 * guests at all.
 */
export function takesGuests(factionId: string): boolean {
    // A house that PUBLISHES a door below its membership bar has already
    // answered this question in the catalog, and the catalog wins. The shelf
    // comparison is an inference about what a house could afford; a second door
    // is the house saying what it does.
    if (publishedDoorOf(factionId) !== null) return true;
    const top = shelfTopOf(factionId);
    return top !== null && top > WORKING_ROAD_CAP;
}

// THE HOUSE THAT PUBLISHES ITS GUEST DOOR

/**
 * A door a house states, below its membership bar - and it is this same position
 * under the catalog's older name.
 */
export interface PublishedDoor {
    /** The rung the house takes somebody in at. Zero, at the one that has one. */
    atOrdinal: number;
/**
 * WHAT PASSING COSTS, and it is not a second door. `docs/world/houses/origin.md`
 * settles it: the house has ONE door and it stands at the floor, and the figure
 * everybody quotes as its bar is the test at the far end of the probation. Read
 * off `SECT_ADMISSION.minOrdinal` through `doorsOf`.
 */
    membershipOrdinal: number;
    /**
     * Whether this is the only such door in the world. Counted, never asserted -
     * `a-favour-skips-the-admission-bar.ts` says it in prose and this is the
     * same claim read off the catalog, so the prose cannot go stale against it.
     */
    theOnlyOneInTheWorld: boolean;
    /**
     * Whether a word from somebody high enough moves anything here.
     */
    aFavourBuysNothingHere: boolean;
}

/** The door this house publishes below its membership bar, or null. */
export function publishedDoorOf(factionId: string): PublishedDoor | null {
    const doors = doorsOf(factionId);
    if (!doors || doors.guestFromOrdinal === null) return null;
    return {
        atOrdinal: doors.guestFromOrdinal,
        membershipOrdinal: doors.membershipOrdinal,
        theOnlyOneInTheWorld: housesWithTwoDoors().length === 1,
        aFavourBuysNothingHere: favourStanceOf(factionId)?.answer === 'no bar to speak of'
    };
}

/**
 * Every house whose guest door is advertised rather than arranged.
 */
export function housesWithAPublishedDoor(): string[] {
    return housesWithTwoDoors().map(d => d.factionId).sort();
}

/**
 * What the house will show a guest. Two clauses and no third: a road is open when
 * the house holds it in quantity ({@link WORKING_ROAD_CAP}); an art with no cap is
 * open when it is shallow enough to be shown at the house's own door. The deepest
 * thing on the shelf is never open, whatever its height.
 */
export function whatAHouseWillShowAGuest(factionId: string): GuestOpening[] {
    const house = getSect(factionId);
    if (!house || !takesGuests(factionId)) return [];
    const top = shelfTopOf(factionId);
    const out: GuestOpening[] = [];
    for (const entry of shelfEntriesOf(house)) {
        if (entry.cap === null) {
            if (entry.requiredOrdinal > house.admissionOrdinal) continue;
        } else {
            if (entry.cap > WORKING_ROAD_CAP) continue;
            if (top !== null && entry.cap >= top) continue;
        }
        out.push({
            techniqueId: entry.id,
            name: entry.name,
            carriesTo: entry.cap,
            requiredOrdinal: entry.requiredOrdinal
        });
    }
    // Shallowest first, which is the order somebody walking in would meet them.
    out.sort((a, b) => a.requiredOrdinal - b.requiredOrdinal || a.name.localeCompare(b.name));
    return out;
}

/**
 * What the house keeps, and why - so that a refusal at the far end names what
 * membership would change rather than saying no.
 */
export function whatAHouseKeepsBack(factionId: string): GuestWithholding[] {
    const house = getSect(factionId);
    if (!house) return [];
    const open = new Set(whatAHouseWillShowAGuest(factionId).map(o => o.techniqueId));
    const top = shelfTopOf(factionId);
    const out: GuestWithholding[] = [];
    for (const entry of shelfEntriesOf(house)) {
        if (open.has(entry.id)) continue;
        const why = entry.cap === null
            ? `${house.name} shows this to people it has taken. What membership would `
              + 'change is not the shelf - it is who is allowed to be walked up it.'
            : top !== null && entry.cap >= top
                ? `The deepest thing ${house.name} holds. A house keeps its best whatever `
                  + 'its height, and the only route to this one is being theirs.'
                : `${house.name} holds this in ones and knows where each copy is. It is `
                  + 'lent to its own and it goes back.';
        out.push({ techniqueId: entry.id, name: entry.name, carriesTo: entry.cap, why });
    }
    out.sort((a, b) => (a.carriesTo ?? 0) - (b.carriesTo ?? 0) || a.name.localeCompare(b.name));
    return out;
}

// HOW LONG THEY WATCH

/**
 * Years on the roll before the house has seen enough to decide about somebody.
 */
export function guestTermYears(factionId: string): number {
    const top = shelfTopOf(factionId);
    if (top === null) return 0;
    return Math.max(1, top - WORKING_ROAD_CAP);
}

// WHAT YOUR OWN HOUSE THINKS ABOUT IT

/**
 * Your own house's view of you studying somewhere else.
 */
export type GuestStance = 'sends' | 'permits' | 'forbids';

export function homeStanceOn(homeFactionId: string, hostFactionId: string): GuestStance {
    const home = getSect(homeFactionId);
    if (!home || homeFactionId === hostFactionId) return 'permits';

    if (home.rivals.includes(hostFactionId)) return 'forbids';
    if ((home.ambition?.contestedWith ?? []).includes(hostFactionId)) return 'forbids';

    // A house that has said, in its own production record, that what stands
    // between it and its next rung is a book. The host holding one it does not
    // is the case that record is describing.
    if (getProductionTier(homeFactionId)?.waitingOn === 'shelf') {
        const ours = shelfTopOf(homeFactionId) ?? 0;
        const theirs = shelfTopOf(hostFactionId) ?? 0;
        if (theirs > ours) return 'sends';
    }
    return 'permits';
}

// THE PLACE ITSELF

export interface GuestPlace {
    factionId: string;
    factionName: string;
    /** How anybody gets onto the house roll here, which a guest is not doing. */
    intakeRoute: 'open' | 'adoption' | 'closed' | 'unknown';
    /**
     * Set where the house publishes this door rather than arranging it, which
     * changes nothing about the status and three things about the entering.
     * See {@link PublishedDoor}.
     */
    publishedDoor: PublishedDoor | null;
    /** What the house will put in front of them, already filtered by their rung. */
    opens: readonly GuestOpening[];
    /** Shown but not reachable yet: the art is open, they are too low for it. */
    openedButOutOfReach: readonly GuestOpening[];
    /** What stays behind the door, with the reason attached. */
    withholds: readonly GuestWithholding[];
    /** Years on the roll before the house is willing to say anything. */
    termYears: number;
    /** Never empty. See {@link WHAT_A_GUEST_PLACE_IS_NOT}. */
    notOffered: readonly string[];
    /** Their own house's view, or null where they belong to nobody. */
    homeStance: GuestStance | null;
    homeFactionId: string | null;
    /**
     * Ids whose standing this costs if the place is taken against a forbid.
     * The home house, and nobody else - the host is not poaching and no third
     * party is owed anything.
     */
    costsStandingWith: readonly string[];
}

/**
 * What one house would offer somebody it has not taken, or null when it has nothing
 * to offer.
 */
export function guestPlaceAt(
    factionId: string,
    ordinal: number,
    homeFactionId: string | null = null
): GuestPlace | null {
    const house = getSect(factionId);
    if (!house || !takesGuests(factionId)) return null;

    const shown = whatAHouseWillShowAGuest(factionId);
    if (shown.length === 0) return null;

    const opens = shown.filter(o => o.requiredOrdinal <= ordinal);
    const outOfReach = shown.filter(o => o.requiredOrdinal > ordinal);

    const homeStance = homeFactionId ? homeStanceOn(homeFactionId, factionId) : null;

    return {
        factionId: house.id,
        factionName: house.name,
        intakeRoute: intakeRouteOf(house.id) ?? 'unknown',
        publishedDoor: publishedDoorOf(house.id),
        opens,
        openedButOutOfReach: outOfReach,
        withholds: whatAHouseKeepsBack(factionId),
        termYears: guestTermYears(factionId),
        notOffered: WHAT_A_GUEST_PLACE_IS_NOT,
        homeStance,
        homeFactionId,
        costsStandingWith: homeStance === 'forbids' && homeFactionId ? [homeFactionId] : []
    };
}

/**
 * Every house in the world that would let this person sit in.
 */
export function housesThatWouldTakeAGuest(
    ordinal: number,
    homeFactionId: string | null = null
): GuestPlace[] {
    const out: GuestPlace[] = [];
    for (const house of SECTS) {
        if (homeFactionId && house.id === homeFactionId) continue;
        const place = guestPlaceAt(house.id, ordinal, homeFactionId);
        if (place) out.push(place);
    }
    out.sort(
        (a, b) =>
            b.opens.length - a.opens.length ||
            b.termYears - a.termYears ||
            (a.factionId < b.factionId ? -1 : a.factionId > b.factionId ? 1 : 0)
    );
    return out;
}

// AND THEN ONE DAY SOMEBODY ASKS YOU TO CHOOSE

/**
 * Whether the house has seen enough, and taken enough of an interest, to put
 * membership to a guest.
 *
 * AND THE BAR BEHIND IT DOES NOT BEND. Elsewhere the end of a guest term is a
 * house deciding to take somebody its bar would have refused; here the house has
 * been carrying you so that you can MEET the bar, and it declines to move it in
 * the same words every time. What the offer costs is not this function's business
 * and is enormous - it is leaving your own house.
 */
export function houseWouldOfferMembership(
    place: GuestPlace,
    heldTechniqueIds: readonly string[],
    yearsOnTheRoll: number,
    ordinal: number | null = null
): boolean {
    if (yearsOnTheRoll < place.termYears) return false;
    if (place.opens.length === 0) return false;
    const held = new Set(heldTechniqueIds);
    if (!place.opens.every(o => held.has(o.techniqueId))) return false;

    // AND AT A HOUSE THAT PUBLISHES ITS DOOR, THE BAR IS STILL THE BAR
    //
    // The only branch in this file that reads a published door, and it is the
    // difference the catalog is most emphatic about. Everywhere else the end of
    // a term is a house deciding to take somebody its admission ordinal would
    // have refused - that is what the watching was FOR. Where the door is
    // published, it is not: the house has been carrying somebody for years
    // precisely so that they can meet the bar themselves, and it declines to
    // move that bar in the same words every time it is asked, for anybody.
    //
    // Wide intake, narrow conversion, and the narrow half is here. A caller
    // that cannot supply an ordinal gets the old behaviour, which is why the
    // parameter is nullable rather than required.
    if (place.publishedDoor !== null && ordinal !== null) {
        return ordinal >= place.publishedDoor.membershipOrdinal;
    }
    return true;
}
