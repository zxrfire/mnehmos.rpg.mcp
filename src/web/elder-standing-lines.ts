/**
 * An elder asking where they stand hears what the house makes of them - still
 * expected to climb, done and over an office, or done and over nothing - and how
 * many of the house's other elders are done and over nothing. Below the elder
 * line this says nothing.
 *
 * The two reads are `whatTheHouseMakesOfThem` and `officePressureIn`, fed from the
 * world's roll with the asker on it. Years at a rung are the player's
 * `yearsAtCurrentRealm` and, for everybody else, the days since
 * `lastAdvancedOnDay`.
 */

import type { Cultivator } from '../schema/cultivation.js';
import { elderRungOf } from '../engine/cultivation/leadership.js';
import { theRoomsThisHouseHas } from '../engine/social-leverage/authority-for-an-order.js';
import {
    officePressureIn,
    whatTheHouseMakesOfThem,
    whatTheyHold,
    whoIsInChargeOfWhat
} from '../engine/social-leverage/what-an-elder-is-in-charge-of.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { HousePosition } from './standing.js';

const DAYS_PER_YEAR = 365;

export function elderStandingLines(
    world: Pick<WorldState, 'npcs' | 'locations' | 'currentDay'>,
    cultivator: Pick<Cultivator, 'id' | 'realmOrdinal' | 'yearsAtCurrentRealm'>,
    held: Pick<HousePosition, 'sectId' | 'ranks' | 'rankIndex'>
): { lines: string[]; structure: string[] } {
    const rankCount = held.ranks.length;
    if (rankCount === 0 || held.rankIndex < elderRungOf(rankCount)) return { lines: [], structure: [] };

    const others = world.npcs.filter(npc =>
        npc.status === 'alive' && npc.factionId === held.sectId && npc.id !== cultivator.id);
    const roll = [
        ...others.map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex })),
        { id: cultivator.id, rankIndex: held.rankIndex }
    ];
    const yearsHeldById: Record<string, number> = { [cultivator.id]: cultivator.yearsAtCurrentRealm };
    const realmOrdinalById: Record<string, number> = { [cultivator.id]: cultivator.realmOrdinal };
    for (const npc of others) {
        yearsHeldById[npc.id] =
            Math.max(0, (world.currentDay - npc.cultivation.lastAdvancedOnDay) / DAYS_PER_YEAR);
        realmOrdinalById[npc.id] = npc.cultivation.realmOrdinal;
    }

    const rooms = theRoomsThisHouseHas(world.locations, held.sectId);
    const them = whatTheHouseMakesOfThem({
        ranks: held.ranks,
        rankIndex: held.rankIndex,
        realmOrdinal: cultivator.realmOrdinal,
        yearsHeld: cultivator.yearsAtCurrentRealm,
        holds: whatTheyHold(whoIsInChargeOfWhat({ rooms, roll, rankCount }), cultivator.id)
    });
    const pressure = officePressureIn({ rooms, roll, rankCount, yearsHeldById, realmOrdinalById });

    const over = them.holds.map(room => `the ${room.replace(/_/g, ' ')}`).join(' and ');
    const lines = [
        them.is === 'still rising'
            ? 'The house still expects you to climb further.'
            : them.is === 'settled, and in charge of something'
                ? `You are over ${over}, and the house no longer expects you to climb further.`
                : 'You are over no office, and the house no longer expects you to climb further.'
                  + (them.mayTakeDisciples ? ' You may take disciples.' : '')
    ];
    const waiting = pressure.whoIsWaiting.filter(id => id !== cultivator.id).length;
    if (waiting > 0) {
        lines.push(`${waiting === 1 ? 'One other elder' : `${waiting} other elders`} of the house `
            + `${waiting === 1 ? 'is' : 'are'} done climbing and over no office.`);
    }
    return {
        lines,
        structure: [
            `elder-standing: ${them.line} ${them.finished.line}`,
            `elder-standing: ${pressure.line}`
        ]
    };
}
