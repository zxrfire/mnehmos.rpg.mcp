/**
 * What a band on the road does when what it would stop has an escort: it watches and withdraws, unless it is big enough to take the escort on.
 *
 * The owner: bandits "see and they scurry off" a carriage or a ship, and "you go
 * alone, you risk it". So on a paid trip a bandit row, or any hostile row that
 * comes looking for somebody, is read against the escort. A band that outnumbers
 * the escort by more than {@link A_BAND_TAKES_ON_AN_ESCORT_IT_OUTNUMBERS} to one
 * attacks; any smaller band withdraws and never becomes a fight. The size is the
 * draw's own `count`, so the answer is the seeded roll's and nothing new is drawn.
 * Everything else on the road - travellers, merchants, a house party - still
 * happens.
 *
 * PURE. A roll in, the roll the trip actually meets out.
 */

import { ENCOUNTERS } from '../../data/cultivation/encounters.js';
import type { EncounterOccurrence, EncounterRoll } from './types.js';

/** A band attacks an escort only when it is more than this many to one. */
export const A_BAND_TAKES_ON_AN_ESCORT_IT_OUTNUMBERS = 2;

/** Whether this occurrence is a band, or somebody hostile, that would stop what it found on the road. */
function wouldStopWhatItFound(occurrence: EncounterOccurrence): boolean {
    if (occurrence.source !== 'catalog' || occurrence.account || occurrence.duty || occurrence.scene) return false;
    const tags = ENCOUNTERS.find(row => row.id === occurrence.entryId)?.tags ?? [];
    if (tags.includes('reward')) return false;
    return occurrence.kind === 'bandits' || (tags.includes('hostile') && occurrence.confrontation !== null);
}

export interface WhatTheEscortMet {
    /** The roll with every band that withdrew taken out of it. */
    roll: EncounterRoll;
    withdrew: EncounterOccurrence[];
    /** The first band big enough to take the escort on, or null. */
    attacking: EncounterOccurrence | null;
}

/**
 * The roll a trip with this many escorts actually meets.
 */
export function whatTheEscortMet(roll: EncounterRoll, escortHeads: number): WhatTheEscortMet {
    const withdrew: EncounterOccurrence[] = [];
    let attacking: EncounterOccurrence | null = null;
    const kept: EncounterOccurrence[] = [];
    for (const occurrence of roll.occurrences) {
        if (!wouldStopWhatItFound(occurrence)) {
            kept.push(occurrence);
            continue;
        }
        const band = occurrence.confrontation?.count ?? 1;
        if (attacking === null && band > escortHeads * A_BAND_TAKES_ON_AN_ESCORT_IT_OUTNUMBERS) {
            attacking = { ...occurrence, interrupts: true };
            kept.push(attacking);
        } else {
            withdrew.push(occurrence);
        }
    }
    return {
        roll: { ...roll, occurrences: kept, firstInterruptDay: attacking ? attacking.absoluteDay : null },
        withdrew,
        attacking
    };
}
