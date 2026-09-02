/**
 * Guest studentship: what a house will teach somebody it has not taken.
 *
 * The sibling of `what-a-house-asks-of-somebody-it-cannot-order.ts`, at the
 * other end of the ladder. That file answers "the house has run out of rungs
 * for you and has to negotiate". This one answers the question underneath the
 * whole bottom of the world:
 *
 *   > A teacher is one of the two ways past a manual's ceiling, and a nobody
 *   > has nobody to ask.
 *
 * ── WHY A HOUSE DOES THIS, AND IT IS NOT CHARITY ─────────────────────────
 *
 * Two reasons, and both are load-bearing.
 *
 *   A PIPELINE. A house that admits by adoption cannot advertise, cannot hold
 *   an admission day and cannot find the once-in-a-century outsider who is
 *   extraordinary at exactly its principle. Letting people sit in is how it
 *   looks at them. An admission bar tells a house somebody's rung; a year of
 *   watching them work tells it what they are like.
 *
 *   AND IT COSTS THEM NOTHING, WHICH IS THE HALF THAT MAKES IT SAFE. A house
 *   can afford to teach an outsider its lower material precisely BECAUSE the
 *   deep material is behind membership. Nobody is afraid of a guest leaving.
 *   They were never shown the thing worth stealing.
 *
 * `docs/world/dao-houses.md` is why this is coherent rather than generous:
 * "Specialisation is not ownership". A house does not own its principle -
 * everyone else interacts with it clumsily and without noticing - so passing on
 * part of it gives away nothing the house could have kept.
 *
 * ── THE MECHANISM IS A ROLL THAT IS NOT THE HOUSE ROLL ───────────────────
 *
 * Not a membership tier, not a rung below Outer Disciple, and nothing that
 * touches `sect_members`. The shape already exists in this world and is
 * described in `false-immortals.ts` in one line - "entered on the station roll
 * and never on the house roll" - and `faction-roll.ts` already treats a Guest
 * as "a position outside the rungs, held by somebody the house cannot order",
 * filtering on `rankIndex === null` rather than on a faction id so that a
 * second body granting one needs no change.
 *
 * A guest therefore KEEPS THEIR OWN HOUSE. This is not a transfer, not a
 * secondment and not a defection, which is most of the complexity gone:
 * `docs/world/past-the-ceiling.md`'s departure economy - releases, oaths, what
 * you may never teach again - does not fire at all, because nothing is being
 * left. It is also why the arrangement is tolerated: an apex has no grievance
 * against a house that borrowed its disciple for a year and gave them back.
 *
 * ── WHAT A GUEST GETS, WHICH IS ACCESS AND NOTHING ELSE ──────────────────
 *
 * The house spends teaching time. It does not spend anything else. No
 * protection at a crossing, no backing in a quarrel, no standing, no stipend,
 * no rung, no liability. {@link WHAT_A_GUEST_PLACE_IS_NOT} is engine-authored
 * and is never empty, because the position has a specific and interesting
 * vulnerability that has to be legible BEFORE somebody accepts it: a guest is
 * away from their own protection, among people who owe them nothing. Somebody
 * who leans on a guest is not leaning on the house, and the house will treat it
 * as somebody else's disciple having a problem.
 *
 * That is the same fact as keeping your own house, read from the other side.
 * Your protection is still your own house because you are still theirs - and
 * your own house is not here.
 *
 * ── WHERE THE LINE BETWEEN SHALLOW AND DEEP COMES FROM ───────────────────
 *
 * Not from a policy and not from a number invented here. `copiesOf` in
 * `engine/world/manuals.ts` already bands a shelf by how many copies of each
 * book a house physically keeps, and it bands it steeply: eight to twenty of
 * the intake primer, three to seven of the ordinary working road, two or three
 * of the inner shelf, one at the top. So:
 *
 *   > A house lends a guest from what it holds in quantity, and never from what
 *   > it holds in ones.
 *
 * That is {@link WORKING_ROAD_CAP} doing the work, and it is a physical reason
 * rather than a tier - the same discipline AGENTS.md asks of any count. It also
 * means the deepest thing on a shelf is closed by construction, whatever that
 * shelf's height, so a house always keeps its best.
 *
 * ── AND THEREFORE NOT EVERY HOUSE TAKES GUESTS ───────────────────────────
 *
 * Taking guests is a fact about a house rather than a policy of the setting,
 * and it falls out of the same comparison with no flag and no branch: a house
 * takes guests when its shelf reaches ABOVE the line it can afford to show.
 * A house whose whole library sits at or below that line has nothing held back,
 * so opening anything opens everything, and it does not.
 *
 * Measured over the catalog, without any per-house authoring:
 *
 *     17 of 34 bodies would take a guest
 *      6 of the 7 dao houses would; the House of Held Names would not,
 *        because its entire shelf caps at 13 and there is nothing behind it
 *      the Hollow Court would not, having one book and it is the top of the
 *        world; the Kiln Wardens teach nothing at all
 *
 * A tenth house wanting a different arrangement changes a column. There is no
 * `if (factionId === ...)` below and there must never be one.
 *
 * ── THE HOME HOUSE HAS A VIEW, AND IT IS ALSO READ OFF COLUMNS ───────────
 *
 * Three answers from two existing columns, in {@link homeStanceOn}: a house
 * FORBIDS a guest place at somebody it is feuding with or contesting a claim
 * against; it SENDS somebody where it knows itself short of a book
 * (`production.waitingOn === 'shelf'`) and the host holds one; otherwise it
 * PERMITS, which is the ordinary answer and means indifference or confidence.
 * Going anyway against a forbid is a real act against your own house and the
 * grudge ledger owns the row - nothing here writes it.
 *
 * ── NOTHING HERE DECIDES ANYTHING, AND NOTHING HERE DRAWS ────────────────
 *
 * No RNG, no window, no write. It is a deterministic function of the catalog
 * and two integers, the way `dutyTermsFor` and `approachFrom` are. Whether a
 * house is standing in front of the player is somebody else's question.
 */

import {
    SECTS,
    getSect,
    intakeRouteOf,
    type SectEntry
} from '../../data/cultivation/sects.js';
import { getTechnique, classOf, capOf } from '../../data/cultivation/techniques.js';
import { getProductionTier } from '../../data/cultivation/faction-character.js';
import { WORKING_ROAD_CAP } from '../world/manuals.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE POSITION IS NOT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Everything a guest place does not carry, said before anybody accepts one.
 *
 * Engine-authored and constant, because it is constant: the house is spending
 * teaching time and nothing else, at every house, for every guest. A caller
 * must show this beside the offer rather than after it.
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
    'Whatever protection you have is wherever it already was, and it is not here.'
];

// ─────────────────────────────────────────────────────────────────────────
// THE SHELF, SPLIT
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * Roads only. An art with no cap carries nobody anywhere and cannot be the
 * measure of how much a house is holding back.
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
 *
 * One comparison. A house whose shelf runs past what it can afford to show has
 * a shallow end it can open at no cost; a house whose whole library sits at or
 * below that line would be showing everything, and does not open the door.
 *
 * A body that teaches nothing has nothing to hold back either, so `null` from
 * {@link shelfTopOf} is a no - which is the right answer for the two powers
 * that take no applicants and teach nobody.
 */
export function takesGuests(factionId: string): boolean {
    const top = shelfTopOf(factionId);
    return top !== null && top > WORKING_ROAD_CAP;
}

/**
 * What the house will show a guest.
 *
 * Two clauses and no third. A road is open when the house holds it in quantity
 * ({@link WORKING_ROAD_CAP}); an art with no cap is open when it is shallow
 * enough to be shown at the house's own door, which is what
 * `admissionOrdinal` already says. And the deepest thing on the shelf is never
 * open, whatever its height, because a house always keeps its best.
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
 *
 * The reason is read off the same two facts that closed it: a road above the
 * line is something the house holds in ones, and an art above the door is
 * something it shows people it has taken.
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

// ─────────────────────────────────────────────────────────────────────────
// HOW LONG THEY WATCH
// ─────────────────────────────────────────────────────────────────────────

/**
 * Years on the roll before the house has seen enough to decide about somebody.
 *
 * The term is not a price for the shelf - a guest may learn from the first day,
 * which is the whole of what is being offered. It is the pipeline: how long a
 * house looks at a person before it is willing to say anything about them.
 *
 * Read off how much is behind the door, because that is exactly what the house
 * is being careful about. A body sitting on the deepest library in the province
 * watches somebody for a generation; a body with an inner shelf and nothing
 * more makes its mind up in a decade.
 */
export function guestTermYears(factionId: string): number {
    const top = shelfTopOf(factionId);
    if (top === null) return 0;
    return Math.max(1, top - WORKING_ROAD_CAP);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT YOUR OWN HOUSE THINKS ABOUT IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Your own house's view of you studying somewhere else.
 *
 * Three answers, two columns, no enumeration. A house that is feuding with the
 * host, or that has a hand on the same contested claim, forbids it - not out of
 * policy but because the host is its problem. A house that knows itself short
 * of a book sends you, which makes the term an investment and leaves you owing
 * them for it. Everything else permits, which is the ordinary answer and covers
 * both indifference and confidence.
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

// ─────────────────────────────────────────────────────────────────────────
// THE PLACE ITSELF
// ─────────────────────────────────────────────────────────────────────────

export interface GuestPlace {
    factionId: string;
    factionName: string;
    /** How anybody gets onto the house roll here, which a guest is not doing. */
    intakeRoute: 'open' | 'adoption' | 'closed' | 'unknown';
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
 * What one house would offer somebody it has not taken, or null when it has
 * nothing to offer.
 *
 * Null in exactly two cases and both are honest: the house has nothing held
 * back, so a guest place would be its whole library; or it holds depth and
 * nothing shallow enough to show anybody.
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
 *
 * Sorted by how much is actually on the table for them, then by how much the
 * house is holding back - so a caller taking the head of the list gets the
 * place worth walking to rather than the alphabetically first one.
 * Deterministic; there is no draw here and no gating on what the player has
 * heard of. That gate belongs to the caller, which holds the knowledge rows.
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

// ─────────────────────────────────────────────────────────────────────────
// AND THEN ONE DAY SOMEBODY ASKS YOU TO CHOOSE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether the house has seen enough, and taken enough of an interest, to put
 * membership to a guest.
 *
 * Two conditions and both are things the guest did rather than things that
 * happened to them. The term has run, so the house has watched a whole stretch
 * of somebody's life; and they have taken up everything the house opened,
 * which is the moment there is nothing further to give them without taking
 * them in. Nothing random, nothing hidden, and no favour required.
 *
 * What the offer costs is not this function's business and is enormous: it is
 * leaving your own house, with everything `docs/world/past-the-ceiling.md` says
 * about releases, oaths and what you may never teach again. Part of what is
 * being offered on the other side is the thing a guest never had, which is
 * somebody answering when something happens to you.
 */
export function houseWouldOfferMembership(
    place: GuestPlace,
    heldTechniqueIds: readonly string[],
    yearsOnTheRoll: number
): boolean {
    if (yearsOnTheRoll < place.termYears) return false;
    if (place.opens.length === 0) return false;
    const held = new Set(heldTechniqueIds);
    return place.opens.every(o => held.has(o.techniqueId));
}
