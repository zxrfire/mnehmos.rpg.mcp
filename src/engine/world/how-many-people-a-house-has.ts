/**
 * How many people a house has: the people on its roll, and a count of the rest.
 *
 * `a-house-and-who-is-in-it.md`: the roll is the slice a player could come to
 * know, and a sect is not a sect, it is the people in it. The people nobody
 * models individually are still people, and the owner's ruling is that they are
 * *"just a # that changes with time"*. The only figure the world held for them
 * was the dormitory the compound was built with, which never moved: a house
 * that lost nine tenths of its roll in a war still slept five hundred.
 *
 * SO WHAT IS STORED IS A COUNT OF PEOPLE, not a quantity of the house: the ones
 * the world does not model. The house's real size is the roll plus that count.
 *
 * SEEDED FROM THE DORMITORY. The catalog states no head count, and the
 * dormitory is cut by `architecture.ts` for the heads the compound was built
 * for, so the unmodelled start as whoever it sleeps beyond the roll. A house
 * with no dormitory takes nobody in and has nobody unmodelled: its roll is all
 * of its people, and nothing is stored for it.
 *
 * MOVED BY WHAT HAPPENS TO PEOPLE. The roll is a sample drawn from the same
 * people, so its own joining, dying and leaving is the only reading the world
 * has of what happened to the rest. Once a year the unmodelled count moves by
 * the share the roll grew or shrank since it was last counted. Somebody who
 * steps out of the count onto the roll (`a-house-takes-in-one-of-its-own.ts`)
 * moves one person across and is not a joining. Two bounds, both facts: never
 * below nobody, and never more than the quarters sleep beside the roll.
 *
 * THE SHARE IS TAKEN OVER A ROLL OF AT LEAST `A_ROLL_A_PLAYER_COULD_KNOW`. A
 * roll of two losing one is a sample of two, not half a house: read literally,
 * the last death on a short roll empties a compound of hundreds in a year.
 *
 * On `resources`, beside `halls_down`, where a house's durable counts live.
 */

import { A_ROLL_A_PLAYER_COULD_KNOW } from './a-house-raises-its-own.js';
import { compoundCapacityUnit, purposeOf } from './architecture.js';
import { getSect } from '../../data/cultivation/sects.js';
import { isBelowTheLid } from './layers.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** The house's people the world does not model one by one. */
export const PEOPLE_NOBODY_MODELS = 'people_nobody_models';

/** The roll as it stood when that count last moved. */
export const PEOPLE_ON_THE_ROLL_WHEN_COUNTED = 'people_on_the_roll';

/** What the house's quarters sleep, which is 0 for a house that has none. */
export function whatItsQuartersSleep(
    locations: WorldState['locations'],
    houseId: string
): number {
    let slept = 0;
    // A world with no places built sleeps nobody, which is also a fixture's.
    for (const place of locations ?? []) {
        if (place.data?.factionId !== houseId || purposeOf(place) !== 'dormitory') continue;
        slept += Math.max(0, Number(place.data?.capacity ?? 0));
    }
    return slept;
}

/**
 * What the catalog says this house's quarters were cut for, with no world open.
 *
 * The same number a seeded compound's dormitory carries - `growCompound` sizes
 * every room off `compoundCapacityUnit` and the dormitory's own `capacityPer`
 * is 1 - read straight off the catalog for a caller that has no world to look
 * at, which is the player's own house view in `sect-leadership.ts`. Null for a
 * house the catalog does not know.
 */
export function whatTheCatalogCutItsQuartersFor(houseId: string): number | null {
    const sect = getSect(houseId);
    if (!sect) return null;
    return compoundCapacityUnit({
        inherited: sect.compound.inherited,
        powerOrdinal: sect.powerOrdinal,
        admissionOrdinal: sect.admissionOrdinal
    });
}

function onTheRoll(npcs: WorldState['npcs'], houseId: string): number {
    let n = 0;
    for (const npc of npcs) if (npc.status === 'alive' && npc.factionId === houseId) n++;
    return n;
}

/**
 * How many of a house's people the world does not model.
 *
 * The count where the house has been counted; whoever the quarters sleep beyond
 * the roll where it has not; nobody where it has no quarters.
 */
export function howManyNobodyModels(
    world: Pick<WorldState, 'locations' | 'npcs'> & { factions?: WorldState['factions'] },
    houseId: string
): number {
    const slept = whatItsQuartersSleep(world.locations, houseId);
    if (slept <= 0) return 0;
    const counted = world.factions?.find(f => f.id === houseId)?.resources[PEOPLE_NOBODY_MODELS];
    if (typeof counted === 'number' && Number.isFinite(counted)) return Math.max(0, Math.round(counted));
    return Math.max(0, slept - onTheRoll(world.npcs, houseId));
}

/** How many people a house really has: its roll and everybody else. */
export function howManyPeopleAHouseHas(
    world: Pick<WorldState, 'locations' | 'npcs'> & { factions?: WorldState['factions'] },
    houseId: string
): number {
    return onTheRoll(world.npcs, houseId) + howManyNobodyModels(world, houseId);
}

/**
 * The unmodelled count moved by what the roll did. Pure over the numbers.
 */
export function theRestMoveWithTheRoll(input: {
    nobodyModels: number;
    rollThen: number;
    rollNow: number;
    quartersSleep: number;
}): number {
    const share = (input.rollNow - input.rollThen) / Math.max(input.rollThen, A_ROLL_A_PLAYER_COULD_KNOW);
    const moved = input.nobodyModels * (1 + share);
    return Math.min(Math.max(0, input.quartersSleep - input.rollNow), Math.max(0, moved));
}

/**
 * The yearly count, over every standing house with quarters. Mutates the
 * houses' `resources` in place, like the passes beside it.
 */
export function theHousesAreCounted(state: WorldState): void {
    const rolls = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === null) continue;
        rolls.set(npc.factionId, (rolls.get(npc.factionId) ?? 0) + 1);
    }
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house)) continue;
        countOne(state, house, rolls.get(house.id) ?? 0);
    }
}

function countOne(state: WorldState, house: FactionRecord, rollNow: number): void {
    const quartersSleep = whatItsQuartersSleep(state.locations, house.id);
    if (quartersSleep <= 0) return;
    const nobodyModels = house.resources[PEOPLE_NOBODY_MODELS];
    const rollThen = house.resources[PEOPLE_ON_THE_ROLL_WHEN_COUNTED];
    house.resources[PEOPLE_NOBODY_MODELS] = typeof nobodyModels === 'number' && typeof rollThen === 'number'
        ? theRestMoveWithTheRoll({ nobodyModels, rollThen, rollNow, quartersSleep })
        : Math.max(0, quartersSleep - rollNow);
    house.resources[PEOPLE_ON_THE_ROLL_WHEN_COUNTED] = rollNow;
}

/**
 * One of the unmodelled steps onto the roll: out of the count, and not a
 * joining, so the roll's next movement does not read them as one.
 */
export function oneOfTheRestIsNowSomebody(house: FactionRecord): void {
    const nobodyModels = house.resources[PEOPLE_NOBODY_MODELS];
    if (typeof nobodyModels === 'number') house.resources[PEOPLE_NOBODY_MODELS] = Math.max(0, nobodyModels - 1);
    const rollThen = house.resources[PEOPLE_ON_THE_ROLL_WHEN_COUNTED];
    if (typeof rollThen === 'number') house.resources[PEOPLE_ON_THE_ROLL_WHEN_COUNTED] = rollThen + 1;
}
