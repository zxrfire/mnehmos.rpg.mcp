/**
 * What a house nails to a wall in a town, and which houses nail up which kind.
 *
 * TWO CHANNELS IN ONE, AND RECRUITMENT IS THE SMALLER OF THEM. A bill for
 * disciples is posted only by the houses at the bottom of the field, and being
 * on a wall for that reason is itself the tell - `housesThatHaveToAdvertise`
 * derives it and `WHAT_THE_PAPER_GIVES_AWAY` says what it gives away.
 *
 * Everything else a house posts runs on the opposite rule: ANY house publishes
 * when it wants something from people who are not its own, and an apex that
 * would never hear an application still wants bone at mortal grade and still
 * answers for a road. That is the fix for the measured defect below and it is
 * the only honest answer to a rogue cultivator having nothing to do.
 *
 * MEASURED: one channel, one message. Before `noticesOnTheWall`, the whole of
 * what any house could ever publish outward was an intake, so somebody with no
 * house standing in a market town read that three failing houses would hear
 * them and learned nothing else about a world of thirty-six. The inner duty
 * board stays shut - that is a question about who may take a job. The wall
 * outside is a question about what is there to know, and the two are not the
 * same question.
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
     * Absolute day the intake opens.
     *
     * Fixed for the life of the paper, so reading the wall twice a month apart
     * gives one day a month closer rather than two different days. Once it has
     * fallen the paper names the next season's, so a bill is never advertising
     * something that has already happened.
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
        'The paper carries no address. Whoever wrote it has nowhere to tell you to come to, '
        + 'and a house with no ground has nothing to inherit and '
        + 'nothing to be thrown out of.',
    open_door:
        'The bar on it is the bottom of the ladder, which is not a bar at all. '
        + 'Whoever answers is taken.',
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
    house: { provinceId: string | null },
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
    const today = Math.floor(input.onDay);
    return drawn.map(house => {
        // THE DAY IS A PROPERTY OF THE PAPER, NOT OF WHOEVER IS READING IT.
        //
        // Anchored to `floor(onDay)` this drew a fresh future date on every
        // read, so the intake receded as anybody walked toward it: measured at
        // Green Water City, one house was 28 days off on day 0, 22 off on day
        // 20, and still a day off on day 89. `datedThingsHere` publishes every
        // bill as a thing to WAIT for, so that was a date the engine offered
        // and then moved.
        //
        // Rolling a spent day on by a whole window keeps the invariant the old
        // anchor was there for - never a date behind the reader - without the
        // drift. One jump at the moment the intake falls is the intake having
        // happened.
        const inTheWindow = windowStart + rng.int(1, A_BILL_STAYS_UP_FOR_DAYS);
        const opensOnDay = inTheWindow > today
            ? inTheWindow
            : inTheWindow + A_BILL_STAYS_UP_FOR_DAYS;
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
                + `${opensOnDay - today} days, and will hear ${takesFrom}.`
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

// ─────────────────────────────────────────────────────────────────────────
// EVERYTHING ELSE A HOUSE PUTS ON A WALL
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a house is asking a stranger for.
 *
 * Each shape carries FACTS and no wording. The wall writes the paper, because
 * the paper is engine-authored and a caller that composed its own sentence
 * would be a second voice for one channel.
 */
export type TheAsk =
    /**
     * One of its own, alive on the plate and not answering. Gated on the house
     * having plates at all - see `a-house-knows-its-own-by-a-plate-and-a-token.ts`,
     * where a house with nobody at Foundation is never told anything.
     */
    | { kind: 'missing'; who: string; unseenForDays: number }
    /** Work it would rather hire than send its own on. */
    | { kind: 'work'; what: string; days: number; hands: number }
    /** Ground it answers for, and what is happening on it. */
    | { kind: 'warning'; what: string };

export interface HouseWithSomethingToSay {
    id: string;
    name: string;
    provinceId: string | null;
    /** The same gate the intake uses. A body that cannot afford an address posts nothing. */
    postsInPublic: boolean;
    asks: readonly TheAsk[];
}

export type NoticeKind = 'intake' | TheAsk['kind'];

export interface Notice {
    kind: NoticeKind;
    houseId: string;
    houseName: string;
    placeName: string;
    /** What the paper says. Engine-authored fact, not narration. */
    saying: string;
    /**
     * What reading it does NOT buy, which is the half a blank wall never said.
     */
    andWhatItIsNot: string;
    /**
     * The absolute day the paper names, or null where it names none.
     *
     * A DATE THE WORLD STATES DOES NOT MOVE BECAUSE SOMEBODY LOOKED AT IT. The
     * intake learned this the expensive way - see the comment in
     * `billsOnTheWall` - and the cheapest way for the rest to keep it is to
     * state no date unless the paper genuinely has one.
     */
    onDay: number | null;
    /** The intake behind this notice, where it is one. */
    bill: RecruitingBill | null;
}

/**
 * What taking one of these does not get you, per kind.
 *
 * The wall's half of the rule the duty board broke: a stranger may read
 * everything here, and reading it does not put them on anybody's roll. Saying
 * so is content - it is the difference between a house that will not have you
 * and a house that has nothing.
 */
export const WHAT_A_NOTICE_DOES_NOT_BUY: Record<TheAsk['kind'], string> = {
    missing:
        'Bringing them back is paid and it is not a way in. The house is asking the province '
        + 'a question it cannot answer from inside its own walls.',
    work:
        'It is hired work and not a place on the roll. Nobody who takes it is of the house '
        + 'afterwards, and the board inside the compound is still shut to them.',
    warning:
        'It asks nothing of anybody. A house that holds ground says what is happening on it, '
        + 'and what somebody does about that is their own business.'
};

/** How the paper words one ask. */
function whatThePaperSays(house: HouseWithSomethingToSay, ask: TheAsk): string {
    switch (ask.kind) {
        case 'missing':
            return `${house.name} is asking after ${ask.who}, of their own, not seen for `
                + `${ask.unseenForDays} days. The plate cut for them is whole.`;
        case 'work':
            return `${house.name} is paying for hands and is not asking whose disciple you are. `
                + `${ask.what} About ${ask.days} days, and it wants ${ask.hands} of them.`;
        case 'warning':
            return `${house.name} answers for ground in this province and has put up a warning. `
                + ask.what;
    }
}

/**
 * Everything nailed up here today, of every kind.
 *
 * The intakes are `billsOnTheWall` unchanged, drawn on their own stream, so a
 * run that reads a wall gets the same houses it always did. The rest draw on a
 * stream of their own, which is what makes this file's arrival invisible to any
 * seeded run that never asks for it.
 */
export function noticesOnTheWall(input: WallInput & {
    speaking: readonly HouseWithSomethingToSay[];
}): Notice[] {
    const slots = BILLS_A_WALL_CARRIES[input.ground];
    if (slots <= 0) return [];

    const out: Notice[] = billsOnTheWall(input).map(bill => ({
        kind: 'intake' as const,
        houseId: bill.houseId,
        houseName: bill.houseName,
        placeName: bill.placeName,
        saying: bill.saying,
        andWhatItIsNot: WHAT_THE_PAPER_GIVES_AWAY[bill.why],
        onDay: bill.opensOnDay,
        bill
    }));

    // One paper per ask, so a house with two things to say takes two nails and
    // competes with itself for them like anybody else.
    const pool = input.speaking
        .filter(house => house.postsInPublic && reachesThisGround(house, input.placeProvinceId))
        .flatMap(house => house.asks.map(ask => ({ house, ask })))
        .sort((a, b) => a.house.id.localeCompare(b.house.id)
            || a.ask.kind.localeCompare(b.ask.kind));

    const window = Math.floor(Math.max(0, input.onDay) / A_BILL_STAYS_UP_FOR_DAYS);
    const rng = forStream(input.seed, 'wall_notices', input.placeName, window);

    const drawn: { house: HouseWithSomethingToSay; ask: TheAsk }[] = [];
    while (pool.length > 0) drawn.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);

    // ONE OF EACH KIND BEFORE A SECOND OF ANY, which is the same rule
    // `THE_SAME_TELL_AGAIN` keeps one layer up: a wall carrying three houses
    // all after beast bone tells a reader one thing three times. Thirty-six
    // houses want materials and nineteen hold ground, so a flat draw fills a
    // city wall with the commonest ask and the channel stops teaching
    // anything. The order inside each kind is still the seeded draw.
    const queues = new Map<NoticeKind, typeof drawn>();
    for (const row of drawn) {
        const held = queues.get(row.ask.kind);
        if (held) held.push(row);
        else queues.set(row.ask.kind, [row]);
    }
    const order: typeof drawn = [];
    while (order.length < drawn.length) {
        for (const queue of queues.values()) {
            const next = queue.shift();
            if (next) order.push(next);
        }
    }

    for (const { house, ask } of order.slice(0, slots)) {
        out.push({
            kind: ask.kind,
            houseId: house.id,
            houseName: house.name,
            placeName: input.placeName,
            saying: whatThePaperSays(house, ask),
            andWhatItIsNot: WHAT_A_NOTICE_DOES_NOT_BUY[ask.kind],
            // NO DATE. Not an omission: none of these three is an appointment.
            // An ask that grows one states it from the fact that produced it,
            // never from the day it was read.
            onDay: null,
            bill: null
        });
    }

    return out;
}

/**
 * The knowledge a notice grants, shaped for `KnowledgeGate.learnIfNew`.
 *
 * The same grant a bill makes, for the same reason: a house put its own name on
 * a public wall, which is a fact about the house and a name the reader now
 * holds from a source they can point at. An intake keeps `whatABillGrants`,
 * whose statement says what the house TAKES; nothing else on the wall does.
 */
export function whatANoticeGrants(notice: Notice): {
    kind: 'sect';
    id: string;
    name: string;
    sourceKind: 'read';
    sourceNote: string;
    stage: 'placed';
    statement: string;
} {
    if (notice.bill) return whatABillGrants(notice.bill);
    return {
        kind: 'sect',
        id: notice.houseId,
        name: notice.houseName,
        sourceKind: 'read',
        sourceNote:
            `A notice posted at ${notice.placeName}. The house put it there itself, which is a `
            + 'fact about the house.',
        stage: 'placed',
        statement: notice.saying
    };
}
