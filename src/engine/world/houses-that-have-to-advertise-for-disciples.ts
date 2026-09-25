/**
 * What a house nails to a wall in a town, and which houses nail up which kind.
 *
 * TWO CHANNELS IN ONE, AND RECRUITMENT IS THE SMALLER OF THEM. A bill for
 * disciples is posted only by the houses at the bottom of the field, and being
 * on a wall for that reason is itself the tell - `housesThatHaveToAdvertise`
 * derives it and `WHAT_THE_PAPER_GIVES_AWAY` says what it gives away.
 *
 * Everything else a house posts runs on the opposite rule: a house publishes
 * when it wants something from people who are not its own. Which houses that
 * leaves is decided in one place - `housesWithSomethingToSay` - and is not
 * restated here.
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
import { placeSeedKey } from '../../data/cultivation/place-names.js';
import { realmForOrdinal } from '../cultivation/realms.js';
// A house's calendar is a function of the seed, the house and the year, the same
// way an intake's season is - so it is derived where the seed and the day already
// are rather than passed in by a caller that would have to be edited to carry it.
import type { WhatTheHouseWants } from './a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { whatThisHouseHasOnPaper } from './a-competition-anybody-may-enter.js';

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
 *
 * STANDING BUSINESS ONLY, which used to be the same thing as "everything on the
 * wall" and stopped being when the wall grew an appointment. An intake gets this
 * budget, the asks get it again, and a dated open-competition notice gets
 * {@link A_DATED_PAPER_TAKES_ONE_NAIL} on top - see `noticesOnTheWall` for the
 * measurement that ruled out sharing. A hamlet at zero still carries nothing at
 * all, because zero slots is a place with no wall rather than a small one.
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

/**
 * Nails a wall keeps for paper with a day on it, beyond its standing budget.
 *
 * ONE, and one is the whole argument: a wall carrying three competition notices
 * is a wall that has stopped being about anything else. What this buys is that a
 * dated notice never displaces the standing business a rogue reads a wall for,
 * and what it costs is that a wall with something pending holds one more sheet
 * than it did. A place with no wall at all - `BILLS_A_WALL_CARRIES` at zero -
 * gets none of it, which `noticesOnTheWall` enforces by returning early.
 */
export const A_DATED_PAPER_TAKES_ONE_NAIL = 1;

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
    const window = Math.floor(Math.max(0, input.onDay) / A_BILL_STAYS_UP_FOR_DAYS);
    const today = Math.floor(input.onDay);
    return drawnOnThisWall(input, window).map(({ house, inTheWindow }) => {
        // THE DAY IS A PROPERTY OF THE PAPER, NOT OF WHOEVER IS READING IT.
        //
        // Anchored to `floor(onDay)` this drew a fresh future date on every
        // read, so the intake receded as anybody walked toward it: measured at
        // Emerald Water City, one house was 28 days off on day 0, 22 off on day
        // 20, and still a day off on day 89. `datedThingsHere` publishes every
        // bill as a thing to WAIT for, so that was a date the engine offered
        // and then moved.
        //
        // Rolling a spent day on by a whole window keeps the invariant the old
        // anchor was there for - never a date behind the reader - without the
        // drift. One jump at the moment the intake falls is the intake having
        // happened.
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
 * The houses a wall carries paper for in one window, and the day each intake is
 * held. The one draw both {@link billsOnTheWall} and {@link anIntakeHeldHere}
 * read, in the order it was always taken.
 */
function drawnOnThisWall(
    input: WallInput,
    window: number
): { house: AdvertisingHouse; inTheWindow: number }[] {
    const slots = BILLS_A_WALL_CARRIES[input.ground];
    if (slots <= 0 || window < 0) return [];

    const eligible = housesThatHaveToAdvertise(input.field)
        .filter(h => h.postsInPublic && reachesThisGround(h, input.placeProvinceId));
    if (eligible.length === 0) return [];

    const rng = forStream(input.seed, 'recruiting_bills', placeSeedKey(input.placeName), window);

    // Drawn without replacement: one house does not paper a wall with itself.
    const pool = [...eligible];
    const drawn: AdvertisingHouse[] = [];
    while (drawn.length < slots && pool.length > 0) {
        drawn.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    }
    const windowStart = window * A_BILL_STAYS_UP_FOR_DAYS;
    return drawn.map(house => ({ house, inTheWindow: windowStart + rng.int(1, A_BILL_STAYS_UP_FOR_DAYS) }));
}

/**
 * The intake this house is holding at this place on this day, where its paper
 * named one here and it has not yet closed: open from the day on the paper for
 * `runsForDays`. Null otherwise. Both days a paper can name count: the day in
 * its window, and the same day a window on, which is what the paper says once
 * the first has passed (see `billsOnTheWall`). A player who waited for the day on
 * the paper finds the intake held.
 */
export function anIntakeHeldHere(
    input: WallInput,
    houseId: string,
    runsForDays: number
): { opensOnDay: number; closesOnDay: number } | null {
    const today = Math.floor(input.onDay);
    const window = Math.floor(Math.max(0, today) / A_BILL_STAYS_UP_FOR_DAYS);
    const reach = 1 + Math.ceil(runsForDays / A_BILL_STAYS_UP_FOR_DAYS);
    for (let w = window; w >= window - reach; w--) {
        const held = drawnOnThisWall(input, w).find(row => row.house.id === houseId);
        if (!held) continue;
        for (const opensOnDay of [held.inTheWindow, held.inTheWindow + A_BILL_STAYS_UP_FOR_DAYS]) {
            const closesOnDay = opensOnDay + runsForDays - 1;
            if (opensOnDay <= today && today <= closesOnDay) return { opensOnDay, closesOnDay };
        }
    }
    return null;
}

/**
 * The houses holding an intake at this place on any day between two days: the
 * same draw {@link anIntakeHeldHere} reads, over a span rather than a day, for a
 * caller whose clock is a year. Both days a paper can name count.
 */
export function intakesHeldHereBetween(
    input: Omit<WallInput, 'onDay'>,
    fromDay: number,
    toDay: number,
    runsForDays: number
): Set<string> {
    const held = new Set<string>();
    const first = Math.floor(Math.max(0, fromDay - runsForDays) / A_BILL_STAYS_UP_FOR_DAYS) - 1;
    const last = Math.floor(Math.max(0, toDay) / A_BILL_STAYS_UP_FOR_DAYS);
    for (let w = Math.max(0, first); w <= last; w++) {
        for (const row of drawnOnThisWall({ ...input, onDay: w * A_BILL_STAYS_UP_FOR_DAYS }, w)) {
            for (const opensOnDay of [row.inTheWindow, row.inTheWindow + A_BILL_STAYS_UP_FOR_DAYS]) {
                if (opensOnDay <= toDay && opensOnDay + runsForDays - 1 >= fromDay) held.add(row.house.id);
            }
        }
    }
    return held;
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
     * One of its own, alive by their lamp and not answering. Gated on the house
     * having lamps at all - see `a-house-knows-its-own-by-a-lamp-and-a-token.ts`,
     * where a house with nobody at Foundation is never told anything.
     */
    | {
        kind: 'missing';
        who: string;
        unseenForDays: number;
        /**
         * What is asked for, graded off the lamp: the person while it burns,
         * what is left of them once it is out. Two searches, not one errand.
         */
        wants: WhatTheHouseWants;
    }
    /** Work it would rather hire than send its own on. */
    | { kind: 'work'; what: string; days: number; hands: number }
    /** Ground it answers for, and what is happening on it. */
    | { kind: 'warning'; what: string }
    /**
     * A competition it is holding that anybody may enter, of any house or none.
     *
     * THE ONE ASK THAT IS AN APPOINTMENT, which is why `Notice.onDay` stops
     * being null the moment one of these is on a wall. The day comes off
     * `whatThisHouseHasOnPaper` and never off the day the paper was read.
     */
    | { kind: 'open_competition'; onDay: number }
    /**
     * A price the house has put on somebody. Only the world holds one, so it
     * arrives through `alsoAsking` like a search does. See
     * `a-house-puts-a-price-on-somebody.ts`.
     */
    | {
        kind: 'wanted';
        /** Who the paper names, by id, so a reader can tell it is them. */
        whoId: string;
        who: string;
        purseStones: number;
        /** What the house pays on. */
        proof: string;
        /** What the house says it is for. */
        forWhat: string;
    };

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
    /** The person a price names, where the notice is one. */
    wantedId?: string;
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
        + 'and what somebody does about that is their own business.',
    open_competition:
        'Standing up is not a place on the roll and winning is not either. What an open '
        + 'competition hands out is a placing, said out loud in front of everybody, and what '
        + 'that is worth afterwards is whatever the people who heard it make of it.',
    wanted:
        'The purse is what the paper says, and whether it is paid is between the house and '
        + 'whoever brings it what it asks for. Taking it up puts nobody on the roll.'
};

/** How the paper words one ask. */
export function whatThePaperSays(
    house: HouseWithSomethingToSay,
    ask: TheAsk,
    /** The day the wall is being read, for the one ask that is an appointment. */
    onDay: number
): string {
    switch (ask.kind) {
        case 'missing':
            return `${house.name} is asking after ${ask.who}, of their own, not seen for `
                + `${ask.unseenForDays} days. `
                + (ask.wants === 'them'
                    ? 'The lamp lit for them still burns.'
                    : 'The lamp lit for them has gone out, and the house wants '
                        + 'what is left of them brought back.');
        case 'work':
            return `${house.name} is paying for hands and is not asking whose disciple you are. `
                + `${ask.what} About ${ask.days} days, and it wants ${ask.hands} of them.`;
        case 'warning':
            return `${house.name} answers for ground in this province and has put up a warning. `
                + ask.what;
        case 'wanted':
            return `${house.name} will pay ${ask.purseStones} spirit stones for ${ask.who}, `
                + `${ask.forWhat}. It pays on ${ask.proof}.`;
        case 'open_competition':
            // ANNOUNCED BY NAME AND BY AFFILIATION, INCLUDING NONE, which is the
            // whole of what an open competition is for and is therefore what the
            // paper states. `how-an-entrant-is-announced.ts` is the reading that
            // does it when somebody actually stands up.
            return `${house.name} is holding an open competition at its own gate in `
                + `${Math.max(0, ask.onDay - onDay)} days. Anybody may enter, of any house or `
                + 'none, and everybody who stands up is called out by their name and by who '
                + 'they answer to. The boards are run one to a realm, so you stand against '
                + 'people at your own height.';
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

    const reaching = input.speaking
        .filter(house => house.postsInPublic && reachesThisGround(house, input.placeProvinceId));

    // One paper per ask, so a house with two things to say takes two nails and
    // competes with itself for them like anybody else. A price is not in the
    // pool: see the nails of its own below.
    const pool = reaching
        .flatMap(house => house.asks.filter(ask => ask.kind !== 'wanted').map(ask => ({ house, ask })))
        .sort((a, b) => a.house.id.localeCompare(b.house.id)
            || a.ask.kind.localeCompare(b.ask.kind));

    const window = Math.floor(Math.max(0, input.onDay) / A_BILL_STAYS_UP_FOR_DAYS);
    const rng = forStream(input.seed, 'wall_notices', placeSeedKey(input.placeName), window);

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
            saying: whatThePaperSays(house, ask, input.onDay),
            andWhatItIsNot: WHAT_A_NOTICE_DOES_NOT_BUY[ask.kind],
            // A DATE ONLY WHERE THE PAPER GENUINELY HAS ONE. Three of the four
            // asks are not appointments and carry none; the open competition
            // states the day off the fact that produced it, never off the day it
            // was read, which is what keeps a wall read twice a month apart
            // naming one day a month closer rather than two different days.
            onDay: ask.kind === 'open_competition' ? ask.onDay : null,
            bill: null
        });
    }

    // ── AND THE DATED PAPER, ON ONE NAIL OF ITS OWN ──────────────────────
    //
    // MEASURED, AND THE MEASUREMENT IS WHY THIS IS AN EXTRA NAIL RATHER THAN A
    // SHARED ONE. Three arrangements were tried:
    //
    //   in the ask pool        the pool emits one of each kind before a second
    //                          of any, so a fourth kind made the kinds
    //                          outnumber the three nails and WHICH one was
    //                          dropped became a property of the seeded draw.
    //                          `a-house-puts-on-a-wall-what-it-wants-from-
    //                          strangers` went red on a wall that had stopped
    //                          posting work - the exact defect that module was
    //                          written against.
    //   a budget of its own    fixed that and broke the other invariant beside
    //                          it: non-intake paper at most
    //                          `BILLS_A_WALL_CARRIES[ground]`, which is what
    //                          keeps a village wall from reading like a city.
    //   leftover nails only    the conservative option, and it measured DEAD.
    //                          Swept over every city on the shipped map across
    //                          three years: zero competitions ever reached a
    //                          wall, because a real province has enough houses
    //                          wanting hands and holding ground to fill every
    //                          nail on every day. A test fixture with three
    //                          kinds and three nails is not the tight case - the
    //                          shipped world is tighter.
    //
    // So there is no arrangement that adds a fourth kind without either
    // enlarging the wall or taking a nail off the three, and the two invariants
    // are not worth the same: one protects how much paper a wall holds, and the
    // other protects a rogue seeing anything at all besides an intake. ONE extra
    // nail, for at most one dated paper, is the smallest thing that keeps the
    // second - and it is defensible on its own terms rather than as a
    // concession, because `BILLS_A_WALL_CARRIES` budgets STANDING business,
    // which is why `A_BILL_STAYS_UP_FOR_DAYS` sits beside it. A competition
    // notice goes up and comes down inside `A_NOTICE_GOES_UP_DAYS` and is gone.
    //
    // AND IT IS DERIVED HERE RATHER THAN PASSED IN, which is what routes it.
    // `alsoAsking` exists for asks only a world can answer - a missing disciple
    // is a fact about today's roll - and a house's calendar is not one of those:
    // it is a function of the seed, the house and the year, exactly as an
    // intake's season is. Deriving it where the seed and the day already are
    // means every caller of `readTheWall` carries it without one of them being
    // edited. A caller that DOES hold better facts can still supply one through
    // `alsoAsking`, where it takes an ordinary nail; the ask has one shape and
    // two doors.
    const dated = reaching
        .flatMap(house => {
            const holding = whatThisHouseHasOnPaper(input.seed, house, input.onDay);
            return holding === null ? [] : [{ house, onDay: holding.onDay }];
        })
        // Soonest first, and only one. A wall carrying three competition
        // notices is a wall that has stopped being about anything else, and the
        // nearest is the one somebody standing here could still get to.
        .sort((a, b) => a.onDay - b.onDay || a.house.id.localeCompare(b.house.id))
        .slice(0, A_DATED_PAPER_TAKES_ONE_NAIL);

    // ── AND THE PRICES, ON NAILS OF THEIR OWN ────────────────────────────
    //
    // A house that puts a price on somebody nails it on every wall it reaches
    // itself; it is not drawn against the standing business for a slot, which
    // is the same reason the dated paper is not. As many as the wall carries
    // standing business, largest purse first - measured on two seeded worlds
    // over a century, a whole world stands between none and nine at once, so a
    // province's wall rarely carries more than one.
    const prices = reaching
        .flatMap(house => house.asks.flatMap(ask => ask.kind === 'wanted' ? [{ house, ask }] : []))
        .sort((a, b) => b.ask.purseStones - a.ask.purseStones
            || a.house.id.localeCompare(b.house.id) || a.ask.whoId.localeCompare(b.ask.whoId))
        .slice(0, slots);
    for (const { house, ask } of prices) {
        out.push({
            kind: ask.kind,
            houseId: house.id,
            houseName: house.name,
            placeName: input.placeName,
            saying: whatThePaperSays(house, ask, input.onDay),
            andWhatItIsNot: WHAT_A_NOTICE_DOES_NOT_BUY[ask.kind],
            onDay: null,
            bill: null,
            wantedId: ask.whoId
        });
    }

    for (const { house, onDay } of dated) {
        const ask: TheAsk = { kind: 'open_competition', onDay };
        out.push({
            kind: ask.kind,
            houseId: house.id,
            houseName: house.name,
            placeName: input.placeName,
            saying: whatThePaperSays(house, ask, input.onDay),
            andWhatItIsNot: WHAT_A_NOTICE_DOES_NOT_BUY[ask.kind],
            onDay,
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
