/**
 * The bill nailed to a wall, and which houses are reduced to nailing one up.
 */

import { forStream } from '../cultivation/rng.js';
import { realmForOrdinal } from '../cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// THE FIELD
// ─────────────────────────────────────────────────────────────────────────

/**
 * A house with an open door, reduced to the four facts this decides on.
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
     */
    provinceId: string | null;
    /**
     * Whether this house can put its own name on a public wall at all.
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
 */
export const THE_SAME_TELL_AGAIN: Record<WhyItIsUpThere, string> = {
    no_seat: 'No address on this one either.',
    open_door: 'The same bar, which is to say none.',
    no_name: 'The same careful hand, and another name nobody has said to you.'
};

/**
 * Whose word reaches this ground.
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
     */
    onDay: number;
    /**
     * Seed for the posting draw.
     */
    seed: string;
}

/**
 * What is nailed up here today.
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
