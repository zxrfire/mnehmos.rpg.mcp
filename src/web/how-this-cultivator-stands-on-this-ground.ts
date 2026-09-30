/**
 * Interior knowledge reads rank and years since the stored game-day join date.
 * Tenure reveals unobvious rooms; it never grants permission to enter them.
 */

import type { ViewerStanding } from '../engine/world/architecture.js';
import type { AccessQuery, LocationRecord } from '../engine/world/locations.js';
import type { Cultivator } from '../schema/cultivation.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';

/** Enough of a membership row to answer whose house this is and how far up. */
export interface StandingInAHouse {
    sectId: string;
    rankIndex: number;
    /** How many rungs that house's own ladder has. */
    rankCount: number;
    joinedOnDay?: number;
}

export function howThisCultivatorStandsInTheHouseHolding(input: {
    ground: LocationRecord;
    cultivator: Cultivator;
    standing: StandingInAHouse | null;
    keyIds?: readonly string[];
    onDay?: number;
}): { viewer: ViewerStanding; access: AccessQuery } {
    // `controllingFactionId` and not the compound's `data.factionId`: the
    // question is who holds the ground, and a house can be standing on somebody
    // else's after a war.
    const holder = input.ground.controllingFactionId
        ?? (typeof input.ground.data.factionId === 'string' ? input.ground.data.factionId : null);
    const member = input.standing !== null
        && holder !== null
        && input.standing.sectId === holder;

    return {
        viewer: {
            rankIndex: member ? input.standing!.rankIndex : -1,
            rankCount: member ? Math.max(1, input.standing!.rankCount) : 1,
            yearsInHouse: member && input.onDay !== undefined && input.standing!.joinedOnDay !== undefined
                ? Math.max(0, input.onDay - input.standing!.joinedOnDay!) / DAYS_PER_YEAR : 0,
            member
        },
        access: {
            realmOrdinal: input.cultivator.realmOrdinal,
            keyIds: input.keyIds ?? [],
            onDay: input.onDay
        }
    };
}
