/**
 * The bill nailed to a wall, and which houses are reduced to nailing one up.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   "crappy sects should advertise actively" - "We're holding a recruiting
 *   event" posters.
 *
 * The reason this is the right shape and not merely a convenient one: it
 * INVERTS the discovery problem. Everywhere else in this world the player has
 * to go and find a name. Here the houses that need bodies come looking, which
 * is what a house short of members would actually do, and it is legible on the
 * face of it - **a house that has to advertise is telling you something true
 * about itself.** The great houses do not advertise. Being at the bottom and
 * needing people is a fact the player reads off the paper without anybody
 * explaining it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHO ADVERTISES IS DERIVED, NEVER LISTED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A hand-written list of "the crappy sects" would be a second standings table
 * living in a prose file, and it would drift from the real one the first time
 * anybody edited the catalog. So the field is derived, from two medians taken
 * over the houses that actually have an open door:
 *
 *   THE BAR IS NO HIGHER THAN THE MIDDLE OF THE FIELD. A house advertises
 *   because it will take people who would otherwise not come to it. A house
 *   that is selective is not short of applicants.
 *
 *   THE STANDING IS BELOW THE MIDDLE OF THE FIELD. This is the half that
 *   matters: it is not that the house is weak, it is that **its name does not
 *   do the recruiting for it.** A house in the top half of the field is spoken
 *   of, and being spoken of is the advertising.
 *
 * Both are relative to the catalog rather than absolute, and that is on
 * purpose. Advertising is competitive - it is about standing against the other
 * doors open to the same bodies - so a catalog of fifty great houses should
 * still have a bottom half that has to put up paper.
 *
 * ── WHAT WAS MEASURED AND REJECTED ───────────────────────────────────────
 *
 * The brief this was built from asked for a third condition: a THIN ROLL, on
 * the reasoning that a house short of members is the one that needs them. It
 * is not in the derivation, because it was measured and it says the opposite.
 * Live rosters, five seeds, 586 NPCs each:
 *
 *     Hollow Bell Wanderers   bar 0, power 20   19.6 members   LARGEST roster
 *     The Thousand Sail Harbour Rail      bar 0, power 21   14.0
 *     The Weir Office         bar 2, power 21   14.8
 *     ...
 *     The Longbough Grove     bar 13, power 27   4.0           SMALLEST roster
 *     House of Measured Span  bar 8,  power 34   4.0
 *
 * Roster size at seeding runs the WRONG WAY: the low-bar, low-standing houses
 * carry the biggest rolls, because they take anybody, and the selective houses
 * are small because they are selective. A house being full of people is not
 * evidence it stopped wanting more, and a thin roll at the top is a house
 * turning people away. So headcount is not a need signal in this world and is
 * not read here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHERE PAPER GOES UP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two facts decide it, both already in the catalogs.
 *
 *   FOOTFALL. Keyed on `RegionPlace['kind']`, the same field
 *   `whether-a-buried-cache-is-still-there.ts` prices ground with, and for the
 *   same underlying reason: how many people walk past. A hamlet is nine
 *   households and nobody passing; there is no point spending the paper. A
 *   wilderness is not a place with a wall.
 *
 *   WHETHER THE HOUSE HAS GROUND. `provinceForFaction` returns nothing for a
 *   house that holds no prefecture, and that is not missing data - it is the
 *   fact. A house with a seat advertises inside its own province, because that
 *   is the only place its name means anything. A house with no seat has no
 *   province to be from, and advertises wherever the road goes. The Hollow
 *   Bell Wanderers own nothing and the catalog already says how they signal:
 *   "a bell hung at a crossroads means members passed within the month".
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT A BILL IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It is a discovery channel and nothing else. It grants a name and a place
 * through the ordinary `learnIfNew` path at the ordinary `placed` stage, with
 * `read` provenance, exactly like every other source in `discovery.md`'s
 * ladder. There is no bypass flag, no admission, no introduction and no
 * standing. The bar on the paper is the bar, and the house is under no
 * obligation to like whoever turns up.
 *
 * It is also not a promise the house is any good. Reading one should leave the
 * player slightly suspicious, because in this world it should.
 */

import { forStream } from '../cultivation/rng.js';
import { realmForOrdinal } from '../cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// THE FIELD
// ─────────────────────────────────────────────────────────────────────────

/**
 * A house with an open door, reduced to the four facts this decides on.
 *
 * Supplied by the caller rather than read from the catalog here, so the same
 * derivation can be run against a trimmed field in a test and against a live
 * world that has lost houses since seeding.
 */
export interface DoorInTheField {
    id: string;
    name: string;
    /** Lowest realm ordinal the house will take. */
    admissionOrdinal: number;
    /** Realm ordinal of its strongest member. What its name is worth. */
    powerOrdinal: number;
    /**
     * The province its ground is in, or null where it holds none.
     *
     * Null is a fact and not an absence: a house with no seat is itinerant,
     * and the four in this catalog that read null are exactly the ones that
     * work a road rather than sit on a vein.
     */
    provinceId: string | null;
    /**
     * Whether this house can put its own name on a public wall at all.
     *
     * A bill is a public claim, and there is a class of house that cannot make
     * one - not because a rule forbids it, but because what a wall costs is an
     * address. The catalog states this body by body rather than as a category:
     * see `DEMONIC_STANDINGS` in
     * `data/cultivation/demonic-sects-and-what-they-are-willing-to-do.ts`,
     * where all six have a route in and not one of them is paper. The caller
     * supplies the answer; this module does not infer it from anything.
     *
     * It is deliberately NOT part of {@link housesThatHaveToAdvertise}. A house
     * that cannot post still needs bodies just as badly, and it belongs in the
     * field the medians are taken over; what it does not have is a wall. Its
     * recruiting happens by mouth, somewhere else, and that route is not this
     * module's to build.
     */
    postsInPublic: boolean;
}

/** Why this particular house is reduced to paper. Drives the wording, nothing else. */
export type WhyItIsUpThere =
    /** It owns no ground, so it has no gate for anybody to turn up at. */
    | 'no_seat'
    /** Its door is at the very bottom of the ladder. It will take anybody. */
    | 'open_door'
    /** It has a seat and its name does not carry past the province. */
    | 'no_name';

export interface AdvertisingHouse extends DoorInTheField {
    why: WhyItIsUpThere;
}

/** Middle value, low half first. Undefined for an empty field. */
function median(values: readonly number[]): number | undefined {
    if (values.length === 0) return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

/**
 * The houses that have to advertise, derived from the field they compete in.
 *
 * Deterministic and order-independent: the result is sorted by id, so a caller
 * that shuffles its input gets the same set back.
 */
export function housesThatHaveToAdvertise(
    field: readonly DoorInTheField[]
): AdvertisingHouse[] {
    const middleBar = median(field.map(h => h.admissionOrdinal));
    const middlePower = median(field.map(h => h.powerOrdinal));
    if (middleBar === undefined || middlePower === undefined) return [];

    return field
        .filter(h => h.admissionOrdinal <= middleBar && h.powerOrdinal < middlePower)
        .map(h => ({
            ...h,
            why: h.provinceId === null
                ? ('no_seat' as const)
                : h.admissionOrdinal === 0
                    ? ('open_door' as const)
                    : ('no_name' as const)
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

// ─────────────────────────────────────────────────────────────────────────
// WALLS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ground a bill can be posted on, which is `RegionPlace['kind']` verbatim plus
 * the honest eighth for ground the region catalog does not describe -
 * `Cultivator.location` is free text and always could be somewhere off the map.
 */
export type PostingGround =
    | 'city'
    | 'sect_town'
    | 'market_town'
    | 'village'
    | 'hamlet'
    | 'waystation'
    | 'site'
    | 'unplaceable';

/**
 * How many bills a wall here carries at once.
 *
 * Footfall, and whether there is a wall at all. The ordering is the same one
 * `CACHE_ANNUAL_DISCOVERY_HAZARD` uses because it is the same axis measured for
 * a different purpose: how many people walk past this spot in a season.
 *
 * A hamlet is nine households who all already know each other and nobody
 * passing through; paper there reaches nobody who was not going to hear it
 * said aloud anyway. A `site` is a named place with something buried at it and
 * no wall. Both are zero, and both are honest rather than stingy.
 */
export const BILLS_A_WALL_CARRIES: Record<PostingGround, number> = {
    city: 3,
    market_town: 2,
    sect_town: 2,
    waystation: 1,
    village: 1,
    hamlet: 0,
    site: 0,
    unplaceable: 0
};

/**
 * How long a bill stays up before the wall is a different wall.
 *
 * A season. Paper on an outside wall does not last a year, an intake that did
 * not fill gets reposted, and the practical effect is that a player who comes
 * back to the same town in a different season reads different names - which is
 * the property that makes this a channel rather than a one-off grant.
 */
export const A_BILL_STAYS_UP_FOR_DAYS = 90;

// ─────────────────────────────────────────────────────────────────────────
// THE BILL
// ─────────────────────────────────────────────────────────────────────────

export interface RecruitingBill {
    houseId: string;
    houseName: string;
    /** Where the paper is, which is also where the house will be. */
    placeName: string;
    /**
     * How the paper states its bar, which is not how the engine states it.
     *
     * A recruiting bill names a REALM and never a layer. Two reasons, and the
     * second is the load-bearing one:
     *
     *   Nobody writes "Layer 3" on a poster. A house advertising to strangers
     *   states the band it will hear, because it has no way of knowing what
     *   any particular reader is standing at and no reason to be precise
     *   before they turn up.
     *
     *   And the narrator must not read the character sheet back at the player.
     *   `tests/web/voice.test.ts` asserts exactly that, and it caught this
     *   line: a bill quoting a full rank name puts "Qi Condensation Layer 1"
     *   into ordinary prose, where it is indistinguishable from the game
     *   reciting the player's own rung at them.
     *
     * The exact figure has not been thrown away - it is {@link
     * RecruitingBill.admissionOrdinal}, one field along, for anything that
     * needs to compare rather than to say.
     */
    takesFrom: string;
    admissionOrdinal: number;
    why: WhyItIsUpThere;
    /**
     * Absolute day the intake opens. Inside the current posting window, so a
     * bill is never advertising something that has already happened.
     */
    opensOnDay: number;
    /** What the paper says. Engine-authored fact, not narration. */
    saying: string;
}

/**
 * What each kind of advertiser is actually admitting by being on a wall.
 *
 * Keyed on the derived category rather than on any house's id, so a house
 * added to the catalog is worded without an edit here. Each of these is a true
 * statement about the house that the player gets for free, which is the whole
 * argument for the mechanism.
 */
export const WHAT_THE_PAPER_GIVES_AWAY: Record<WhyItIsUpThere, string> = {
    no_seat:
        'There is no address on it. Whoever wrote this has nowhere to tell you to come to, '
        + 'which means they have no ground, which means there is nothing to inherit and '
        + 'nothing to be thrown out of.',
    open_door:
        'The bar on it is the bottom of the ladder, which is not a bar at all. A house that '
        + 'will hear anybody is a house that has run out of ways to be chosen.',
    no_name:
        'It states the terms carefully, in a good hand, as though the terms were the '
        + 'question. Nobody with a name people already say has to write any of this down.'
};

/**
 * The same tell, on the second and third paper.
 *
 * Three houses with no seat post on one wall often, and the reading above is
 * four clauses long - so `look around` opened with the identical paragraph
 * three times, and it is the first thing anybody reads in a new run. Measured
 * in a played run at Thirdwall on turn 1.
 *
 * These are not a shorter version of the reading. They are what somebody
 * NOTICES on the second paper, which is that it is the same paper: the whole
 * value of a repeat is the pattern, and the pattern is worth one clause rather
 * than four. Keyed the same way for the same reason, so a new category is
 * worded here and nowhere else.
 */
export const THE_SAME_TELL_AGAIN: Record<WhyItIsUpThere, string> = {
    no_seat: 'No address on this one either.',
    open_door: 'The same bar, which is to say none.',
    no_name: 'The same careful hand, and another name nobody has said to you.'
};

/**
 * Whose word reaches this ground.
 *
 * A house with a seat is known in its own province and nowhere else, which is
 * `discovery.md`'s rule applied to the house's side of it: recognition runs
 * backwards to prestige, and a small house two provinces away is a name nobody
 * local has a reference for. A house with no seat has no province to be
 * confined to and works whatever road it is on.
 */
export function reachesThisGround(
    house: DoorInTheField,
    placeProvinceId: string | null
): boolean {
    if (house.provinceId === null) return true;
    return placeProvinceId !== null && house.provinceId === placeProvinceId;
}

export interface WallInput {
    /** Everything with an open door anywhere in the world. */
    field: readonly DoorInTheField[];
    placeName: string;
    ground: PostingGround;
    /** Province the place is in, or null when the catalog does not place it. */
    placeProvinceId: string | null;
    /**
     * The day, on whatever clock the caller keeps.
     *
     * Only two properties are needed of it and both hold for elapsed run days
     * and for the world's own day alike: it does not go backwards, and two
     * reads on the same day agree. It is deliberately not required to be the
     * world's, so that a wall can be read on a run with no world loaded -
     * `makeGame` in the test harness defaults `worldEnabled: false`, and a
     * discovery channel that goes silent there is a channel nobody can test.
     */
    onDay: number;
    /**
     * Seed for the posting draw.
     *
     * Its own named stream, derived from the seed and the place and the window
     * and nothing else - so it consumes from no existing stream, cannot
     * perturb a draw that has already been played, and gives the same wall the
     * same paper however many times it is read on the same day.
     */
    seed: string;
}

/**
 * What is nailed up here today.
 *
 * Pure and idempotent. Two reads of the same wall on the same day return the
 * same bills in the same order; a read a season later returns a different set,
 * because the window moved and the houses reposted.
 */
export function billsOnTheWall(input: WallInput): RecruitingBill[] {
    const slots = BILLS_A_WALL_CARRIES[input.ground];
    if (slots <= 0) return [];

    const eligible = housesThatHaveToAdvertise(input.field)
        .filter(h => h.postsInPublic && reachesThisGround(h, input.placeProvinceId));
    if (eligible.length === 0) return [];

    const window = Math.floor(Math.max(0, input.onDay) / A_BILL_STAYS_UP_FOR_DAYS);
    const rng = forStream(input.seed, 'recruiting_bills', input.placeName, window);

    // Drawn without replacement: one house does not paper a wall with itself.
    const pool = [...eligible];
    const drawn: AdvertisingHouse[] = [];
    while (drawn.length < slots && pool.length > 0) {
        drawn.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    }

    const windowStart = window * A_BILL_STAYS_UP_FOR_DAYS;
    return drawn.map(house => {
        // Somewhere inside the window that has not already passed, so the paper
        // is never advertising a day that is behind the reader.
        const remaining = windowStart + A_BILL_STAYS_UP_FOR_DAYS - Math.floor(input.onDay);
        const opensOnDay = Math.floor(input.onDay) + rng.int(1, Math.max(1, remaining));
        const realm = realmForOrdinal(house.admissionOrdinal);
        // At the realm's own floor there is nothing above the band to qualify
        // for, so the bill says the band and stops. Above it, the bill has to
        // say that the band is not enough on its own - which is the whole
        // difference between a house that will hear anybody who has begun and
        // one that wants a few years of it first.
        const takesFrom = house.admissionOrdinal === realm.ordinalStart
            ? `anybody who has reached ${realm.name} at all`
            : `anybody who is some way into ${realm.name}, and not from the first rung of it`;
        return {
            houseId: house.id,
            houseName: house.name,
            placeName: input.placeName,
            takesFrom,
            admissionOrdinal: house.admissionOrdinal,
            why: house.why,
            opensOnDay,
            saying:
                `${house.name} is holding an intake at ${input.placeName} in `
                + `${opensOnDay - Math.floor(input.onDay)} days, and will hear ${takesFrom}.`
        };
    });
}

/**
 * The knowledge a bill grants, shaped for `KnowledgeGate.learnIfNew`.
 *
 * `placed`, and that stage is the whole of what a poster is worth: the reader
 * now knows the house exists and where to go, which is exactly what licenses
 * travel and an application, and is exactly not an introduction. Provenance is
 * `read`, because they read it off a wall and a wall is an interested party.
 */
export function whatABillGrants(bill: RecruitingBill): {
    kind: 'sect';
    id: string;
    name: string;
    sourceKind: 'read';
    sourceNote: string;
    stage: 'placed';
    statement: string;
} {
    return {
        kind: 'sect',
        id: bill.houseId,
        name: bill.houseName,
        sourceKind: 'read',
        sourceNote:
            `A recruiting bill posted at ${bill.placeName}. The house put it there itself, `
            + 'which is a fact about the house.',
        stage: 'placed',
        statement:
            `${bill.houseName} takes disciples - ${bill.takesFrom} - and was recruiting at `
            + `${bill.placeName}.`
    };
}
