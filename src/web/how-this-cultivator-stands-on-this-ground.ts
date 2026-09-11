/**
 * Where this cultivator stands with whoever holds the ground under them.
 *
 * The two arguments `roomStageFor` and `evaluateAccess` want, built once so
 * that every read of an interior asks the same question of the same fields. A
 * second construction of these somewhere else is a second answer to *is this
 * person one of ours*, and the two would disagree the first time a house was
 * renamed or a rank ladder grew a rung.
 *
 * ── WHAT THE ENGINE CANNOT ANSWER YET ────────────────────────────────────
 *
 * `yearsInHouse` is what `roomStageFor` uses for the parts of a compound that
 * rank does not reach - the back stair a twenty-year outer disciple knows and a
 * two-year elder does not. **Nothing records the day a cultivator joined a
 * house in game days.** `sect_members.joined_at` is a wall-clock timestamp
 * written by SQLite's `datetime('now')`, which is the real time the row was
 * inserted and has no relation to the world clock.
 *
 * So this passes zero, and zero is honest for the case it is wrong about in the
 * cheapest direction: a member reaches the precincts at or below their rank
 * either way, and what they lose is the unobvious rooms that long service alone
 * would have opened. It is a gap, not a decision. Closing it is a `joined_on_day`
 * column and one line here.
 */

import type { ViewerStanding } from '../engine/world/architecture.js';
import type { AccessQuery, LocationRecord } from '../engine/world/locations.js';
import type { Cultivator } from '../schema/cultivation.js';

/** Enough of a membership row to answer whose house this is and how far up. */
export interface StandingInAHouse {
    sectId: string;
    rankIndex: number;
    /** How many rungs that house's own ladder has. */
    rankCount: number;
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
            yearsInHouse: 0,
            member
        },
        access: {
            realmOrdinal: input.cultivator.realmOrdinal,
            keyIds: input.keyIds ?? [],
            onDay: input.onDay
        }
    };
}
