/**
 * What a house sends to the houses it stands with under one apex: goods on a trade and credit
 * footing, carried by whoever takes the job off the wall.
 *
 * The owner: "you can imagine sects sending out delivery missions too, especially amongst sects
 * under the same apex", "they send out resources to each other (on some sorta trade/credit
 * relationship)", "you make it exist". And the ruling on taking one: "you can take any job, you
 * figure out how to do it. if you don't complete it by the deadline then you compensate some way.
 * maybe lose merit (if the goods are still there)? DEFINITELY lose face".
 *
 * So a delivery is posted whatever the reader could carry. Its size is a fact on the notice: a
 * case that goes on a back, bales that want a carriage, a season's stock that wants a spirit boat.
 * How it gets there is the carrier's to solve.
 */

import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import { chainToApex } from '../../data/cultivation/governance-and-water-rights.js';
import { provinceRoadDays } from '../../data/cultivation/regions.js';
import { clampOrdinal } from '../cultivation/realms.js';
import { forStream } from '../cultivation/rng.js';
import type { Severity } from '../social/grudges.js';
import { makeObject, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

/** How much a consignment asks of whoever carries it. */
export type WhatItWants = 'a back' | 'a carriage' | 'a spirit boat';

/**
 * The goods houses send one another. No word here is a verb the table acts on, one typo from
 * one, or a question word (AGENTS.md, the fifth naming rule).
 */
const GOODS: readonly { goods: string; volume: number; weight: number; wants: WhatItWants; worth: number }[] = [
    // "pills", "stones", "herbs", "season", "iron" and "sealed" are all words the table acts on,
    // and "I take the case of pills" swallowed one. So the goods are named for what they come
    // in, and what is inside is the house's business.
    { goods: 'a lacquered casket', volume: 12, weight: 8, wants: 'a back', worth: 1 },
    { goods: 'a banded strongbox', volume: 16, weight: 22, wants: 'a back', worth: 1 },
    { goods: 'bales of dried spirit grass', volume: 420, weight: 160, wants: 'a carriage', worth: 2 },
    { goods: 'sacks of spirit ore', volume: 260, weight: 640, wants: 'a carriage', worth: 2 },
    { goods: 'a beast\'s pelts, horn and sinew', volume: 1600, weight: 1300, wants: 'a spirit boat', worth: 4 },
    { goods: 'a granary\'s grain for the kitchens', volume: 4200, weight: 3400, wants: 'a spirit boat', worth: 4 }
];

export interface AConsignment {
    /** Stable for the house, the sister and the season. */
    id: string;
    fromHouseId: string;
    fromHouseName: string;
    toHouseId: string;
    toHouseName: string;
    /** The receiving house's seat, where it is handed over. */
    toPlace: string;
    goods: string;
    volume: number;
    weight: number;
    wants: WhatItWants;
    /** Walking days from the sending seat to the receiving one. */
    roadDays: number;
    /** Days allowed, the road with a margin. */
    days: number;
    contribution: number;
    stones: number;
}

/** A house's apex: the top of its chain, or itself where it answers to nobody. */
function theApexOf(houseId: string): string {
    const chain = chainToApex(houseId);
    return chain[chain.length - 1] ?? houseId;
}

/** The province a world row stands in, off its parents, as a catalog region id. */
function provinceOfRow(world: Pick<WorldState, 'locations'>, locationId: string | null): string | null {
    const byId = new Map(world.locations.map(row => [row.id, row]));
    for (let row = locationId ? byId.get(locationId) : undefined, steps = 0; row && steps < 12; steps++) {
        if (row.kind === 'region') return row.id.replace(/^loc-/, '');
        row = row.parentId ? byId.get(row.parentId) : undefined;
    }
    return null;
}

/** Days between two seats: the province road, or a short walk inside one. */
function daysBetween(world: Pick<WorldState, 'locations'>, fromSeat: string, toSeat: string): number {
    const from = provinceOfRow(world, fromSeat);
    const to = provinceOfRow(world, toSeat);
    if (from === null || to === null || from === to) return 2;
    return provinceRoadDays(from, to) ?? 2;
}

/** A season is ninety days: what a house sends changes with it, and not while you read. */
const A_SEASON = 90;

/**
 * What this house is sending its sisters this season: one or two consignments, each to a house
 * under the same apex, each a size and a road.
 */
export function whatAHouseSendsItsSisters(
    world: Pick<WorldState, 'locations' | 'factions'>,
    houseId: string,
    onDay: number
): AConsignment[] {
    const seated = (id: string) => world.factions.find(faction => faction.id === id && faction.dissolvedOnDay === null
        && faction.seatLocationId && world.locations.some(row => row.id === faction.seatLocationId && row.kind === 'sect_seat'));
    const house = seated(houseId);
    if (!house) return [];
    const apex = theApexOf(houseId);
    const sisters = world.factions
        .filter(faction => faction.id !== houseId && seated(faction.id) && theApexOf(faction.id) === apex)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (sisters.length === 0) return [];

    const season = Math.floor(onDay / A_SEASON);
    const draw = forStream(`${houseId}:${season}`, 'what-a-house-sends-its-sisters');
    const howMany = draw.next() < 0.5 ? 1 : 2;
    const out: AConsignment[] = [];
    for (let n = 0; n < howMany; n++) {
        const to = sisters[Math.floor(draw.next() * sisters.length)]!;
        const what = GOODS[Math.floor(draw.next() * GOODS.length)]!;
        const seat = world.locations.find(row => row.id === to.seatLocationId)!;
        const roadDays = daysBetween(world, house.seatLocationId!, to.seatLocationId!);
        const days = Math.ceil(roadDays * 1.5) + 3;
        out.push({
            id: `delivery-${houseId}-${to.id}-${season}-${n}`,
            fromHouseId: houseId,
            fromHouseName: house.name,
            toHouseId: to.id,
            toHouseName: to.name,
            toPlace: seat.name,
            goods: what.goods,
            volume: what.volume,
            weight: what.weight,
            wants: what.wants,
            roadDays,
            days,
            contribution: roadDays * 12 * what.worth,
            stones: roadDays * 2 * what.worth
        });
    }
    return out.filter((row, i) => out.findIndex(other => other.id === row.id) === i);
}

// ─────────────────────────────────────────────────────────────────────────
// ON THE WALL, SIGNED FOR, AND HANDED OVER
// ─────────────────────────────────────────────────────────────────────────

/** Whether a board entry is a delivery. */
export function isADelivery(entryId: string): boolean {
    return entryId.startsWith('delivery-');
}

/**
 * A consignment as a notice on the wall: what, where to, and what it asks of whoever carries it,
 * stated as a fact and never a bar. Pitched at the reader, since anybody may take it.
 */
export function aDeliveryAsAnOffer(consignment: AConsignment, readerOrdinal: number): EncounterEntry {
    const pitch = clampOrdinal(readerOrdinal);
    return {
        id: consignment.id,
        name: `${consignment.goods} to ${consignment.toHouseName} at ${consignment.toPlace}, `
            + `for ${consignment.fromHouseName}`,
        kind: 'sect_event',
        simEventKind: 'sect_event',
        weight: 1,
        minOrdinal: 0,
        maxOrdinal: clampOrdinal(pitch + 44),
        interrupts: false,
        threatOrdinal: pitch,
        summaryTemplate: `${consignment.fromHouseName} is sending ${consignment.goods} to `
            + `${consignment.toHouseName} at ${consignment.toPlace}, ${consignment.roadDays} days by road. `
            + `It wants ${consignment.wants} to carry it.`,
        tokens: [],
        tags: ['posted', 'delivery', 'errand', `wants:${consignment.wants}`, `from:${consignment.fromHouseId}`]
    } as EncounterEntry;
}

/** The goods themselves, signed for: the sending house's, in the carrier's charge. */
export function theGoodsSignedFor(input: {
    consignment: AConsignment;
    carrierId: string;
    oathId: string;
    dueOnDay: number;
    /** Where they land: on the carrier, or waiting where they were signed for. */
    possessorId: string | null;
    locationId: string | null;
}): ObjectRecord {
    const { consignment } = input;
    return makeObject({
        id: `consignment-${input.oathId}`,
        name: consignment.goods,
        kind: 'other',
        significance: 'notable',
        possessorId: input.possessorId,
        ownerId: consignment.fromHouseId,
        ownerName: consignment.fromHouseName,
        locationId: input.locationId,
        volume: consignment.volume,
        weight: consignment.weight,
        tags: ['consignment', `delivery-to:${consignment.toHouseId}`],
        data: {
            carrierId: input.carrierId,
            oathId: input.oathId,
            entryId: consignment.id,
            toHouseId: consignment.toHouseId,
            toHouseName: consignment.toHouseName,
            toPlace: consignment.toPlace,
            dueOnDay: input.dueOnDay,
            wants: consignment.wants,
            contribution: consignment.contribution,
            stones: consignment.stones
        }
    });
}

/**
 * THE FACE A FUMBLE COSTS, SCALED. The owner: "if you don't complete it by the deadline then you
 * compensate some way. maybe lose merit (if the goods are still there)? DEFINITELY lose face", and
 * "this is vicious of course scale, the larger the fumble the greater the loss of face". So the
 * size of the consignment sets how bad a late one is, and losing it outright is one step worse.
 */
const THE_FACE_A_LATE_DELIVERY_COSTS: Readonly<Record<WhatItWants, Severity>> = {
    'a back': 'slight',
    'a carriage': 'serious',
    'a spirit boat': 'grave'
};

/**
 * What a late handover takes back in merit: the whole of what it would have paid, and a share
 * more for every day past due, to at most twice the pay.
 */
const A_LATE_DAY_COSTS_OF_THE_PAY = 0.1;

export interface WhatALateDeliveryCosts {
    face: Severity;
    /** Contribution taken off the carrier. Zero on time. */
    contribution: number;
}

/** What a delivery handed over this many days past due costs. */
export function whatALateDeliveryCosts(goods: { wants: WhatItWants; contribution: number }, daysLate: number): WhatALateDeliveryCosts | null {
    if (daysLate <= 0) return null;
    const share = Math.min(1, daysLate * A_LATE_DAY_COSTS_OF_THE_PAY);
    return {
        face: THE_FACE_A_LATE_DELIVERY_COSTS[goods.wants],
        contribution: Math.round(goods.contribution * share)
    };
}

/** How long past due a house waits on a delivery before it writes it off. */
export const A_HOUSE_WAITS_ON_A_LATE_DELIVERY = 30;

/** Goods lost outright are one step worse than goods brought late. */
const ONE_STEP_GRAVER: Readonly<Record<Severity, Severity>> = {
    slight: 'serious', serious: 'grave', grave: 'grave', unforgivable: 'unforgivable'
};

export interface WhatAWrittenOffDeliveryCosts extends WhatALateDeliveryCosts {
    /** The goods are gone, not only late. */
    lost: boolean;
}

/**
 * What a delivery never handed over costs, once the house has stopped waiting on it: the whole
 * of the pay taken back, and face by the size of the load, a step worse where the goods are gone.
 * Null while the house still waits. The owner: "maybe lose merit (if the goods are still there)?
 * DEFINITELY lose face".
 */
export function whatAWrittenOffDeliveryCosts(
    goods: { wants: WhatItWants; contribution: number },
    daysLate: number,
    stillInHand: boolean
): WhatAWrittenOffDeliveryCosts | null {
    if (daysLate <= A_HOUSE_WAITS_ON_A_LATE_DELIVERY) return null;
    const late = whatALateDeliveryCosts(goods, daysLate)!;
    return { face: stillInHand ? late.face : ONE_STEP_GRAVER[late.face], contribution: late.contribution, lost: !stillInHand };
}

/**
 * The consignment a board entry was, found again from its id: the season and the draw are in it,
 * and the house that sent it is the oath's. For goods that are gone, where nothing else is left to
 * read their size off.
 */
export function theConsignmentOnTheEntry(
    world: Pick<WorldState, 'locations' | 'factions'>,
    fromHouseId: string,
    entryId: string
): AConsignment | null {
    const season = /-(\d+)-\d+$/.exec(entryId)?.[1];
    if (season === undefined) return null;
    return whatAHouseSendsItsSisters(world, fromHouseId, Number(season) * A_SEASON)
        .find(row => row.id === entryId) ?? null;
}
