import { whoAnswersAbout } from '../engine/social-leverage/what-an-elder-is-in-charge-of.js';
/** Extracted existing store authority; direct/fetched requests share it. */
import { portfoliosIn } from '../engine/social-leverage/authority-for-an-order.js';
import { whoStaffsWhat } from '../engine/social-leverage/who-works-in-an-elders-hall.js';
import { whetherItLeavesTheStore, type WhatTheyMeanToDo } from '../engine/social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import { rankIndexOnAHousesRoll, type TheRollsToRead } from '../engine/world/where-somebody-stands-on-a-houses-roll.js';
import { routineOf } from '../engine/world/npc-routines.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import type { RoomPurpose } from '../engine/world/architecture.js';

/** Fresh single decision read, discarded before the next clock/world boundary. */
export function readHouseStoreRequest(world: WorldState, house: WorldState['factions'][number],
    requesterId: string, purpose: RoomPurpose, rolls: TheRollsToRead) {
    const roll = world.npcs.filter(n => n.status === 'alive' && n.factionId === house.id && n.id !== requesterId)
        .map(n => ({ id: n.id, rankIndex: rankIndexOnAHousesRoll(rolls, n.id, house.ranks.length) }))
        .filter(n => n.rankIndex >= 0);
    const playerRank = rankIndexOnAHousesRoll(rolls, requesterId, house.ranks.length);
    if (playerRank >= 0) roll.push({ id: requesterId, rankIndex: playerRank });
    const portfolios = portfoliosIn({ npcs: world.npcs, locations: world.locations, sectId: house.id, roll, rankCount: house.ranks.length });
    const posts = whoStaffsWhat({ portfolios, roll, rankCount: house.ranks.length });
    const receivers = new Set([whoAnswersAbout(portfolios, purpose),
        ...posts.filter(p => p.purpose === purpose).map(p => p.personId)]);
    return { roll, portfolios, receivers, rankCount: house.ranks.length, purpose, requesterId };
}

/** Caller supplies actual same-area presence; this never summons an absent mouth. */
export function receivesTheStoreRequestWhileWorking(world: WorldState, houseId: string, personId: string,
    reading: ReturnType<typeof readHouseStoreRequest>, carriedBy: string | null): boolean {
    if (carriedBy !== null ? personId !== carriedBy : !reading.receivers.has(personId)) return false;
    const npc = world.npcs.find(n => n.id === personId && n.status === 'alive');
    if (!npc || npc.factionId !== houseId || npc.activity?.redirect) return false;
    const work = routineOf(world, npc);
    return !work.home && work.activity?.kind === 'the_work_of_their_rank'
        && !work.activity.thingId && work.activity.withIds.length === 0;
}

export function decisionForTheHouseStoreRequest(reading: ReturnType<typeof readHouseStoreRequest>,
    object: ObjectRecord, meaning: WhatTheyMeanToDo,
    ledger: Parameters<typeof whetherItLeavesTheStore>[0]['ledger'], onDay: number) {
    return whetherItLeavesTheStore({ significance: object.significance, meaning, room: reading.purpose,
        portfolios: reading.portfolios, roll: reading.roll, rankCount: reading.rankCount,
        askerId: reading.requesterId, ledger, asOfDay: onDay });
}
