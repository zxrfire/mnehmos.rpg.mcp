/**
 * Recording the day a wound was taken.
 *
 * A permanent ruined dantian is a day in somebody's life. It was a field on
 * their record: `injuries` carried the row, the catalog gave it a name, a
 * treatment and a presentation, and nothing anywhere said WHEN it happened or
 * what did it. So a cultivator could be met carrying a severed meridian that the
 * world had no account of, which is the same defect as a killing recoverable
 * only from a string on the corpse, pointing at the body instead of the ledger.
 *
 * ── Permanent wounds only, and that is the whole scope rule ──────────────
 *
 * A bruise is not a life event and a ledger full of them is the noise this
 * ledger was just cleared of. What goes in is what nothing in the world closes:
 * `isPermanentWound` is already the engine's own answer to "is this forever",
 * it is read rather than re-decided here, and it is exactly the set the catalog
 * wrote a `treatment` of "nothing" for.
 *
 * Crossings are excluded because they are already written. `recordCrossing`
 * names `arrivedBroken` and the wound the trial left inside the crossing's own
 * row, where it belongs - the wound and the wall are one event, and two rows
 * would be that event twice with the back-links split between them.
 */

import { isPermanentWound, getWoundType } from '../../data/cultivation/wounds.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { rankName } from '../cultivation/realms.js';
import { makeFact, type HistoricalFact } from './history.js';
import type { NpcRecord } from './npc-state.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';
import type { Injury } from '../../schema/cultivation.js';

/** What the wound came out of, in the words the world would use. */
const FROM: Record<string, string> = {
    combat: 'in a fight',
    qi_deviation: 'to a deviation',
    failed_breakthrough: 'at a wall',
    tribulation: 'under the lightning',
    poison: 'to poison',
    backlash: 'to their own technique',
    other: ''
};

/**
 * Write the permanent wounds out of a set somebody just took.
 *
 * Returns the rows written, which is usually none. Everything that heals is
 * left to the record, where the count already lives.
 */
export function recordPermanentWounds(
    state: WorldState,
    npc: NpcRecord,
    wounds: readonly Injury[],
    day: number
): HistoricalFact[] {
    const written: HistoricalFact[] = [];
    for (const wound of wounds) {
        if (!isPermanentWound(wound.woundType)) continue;
        const row = getWoundType(wound.woundType);
        if (!row) continue;
        const age = Math.max(0, Math.floor((day - npc.identity.bornOnDay) / DAYS_PER_YEAR));
        const how = FROM[wound.source] ?? '';

        written.push(appendWorldFact(state, makeFact({
            day,
            kind: 'injury',
            scale: 'personal',
            summary:
                `${npc.name} took ${row.name.toLowerCase()} at ${age}` +
                (how ? `, ${how}` : '') +
                `, at ${rankName(npc.cultivation.realmOrdinal)}. ${row.treatment}`,
            actors: [{ id: npc.id, name: npc.name, role: 'wounded' }],
            locationId: npc.locationId,
            factionIds: npc.factionId ? [npc.factionId] : [],
            visibility: 'faction',
            // A permanent wound at the top of the ladder removes somebody the
            // world was counting on. Read off the rung, like everything else.
            magnitude: Math.min(1, 0.25 + npc.cultivation.realmOrdinal * 0.015),
            causeKnown: true,
            data: {
                woundType: wound.woundType,
                severity: wound.severity,
                source: wound.source,
                realmOrdinal: npc.cultivation.realmOrdinal
            }
        // Two of the same maiming in one life are two days in it.
        }), { recur: false }));
    }
    return written;
}
