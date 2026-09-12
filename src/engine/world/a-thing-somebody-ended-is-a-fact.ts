/**
 * A thing stopped existing, and the world hears about it.
 *
 * ANYBODY CAN END A THING. The design owner, on who this is for: *"it's not
 * restricted to only me. it's ANYONE can destroy (including me)."* So this
 * takes an actor and is called from the simulation and from a typed sentence
 * on the same footing - a blade broken in a fight, a ward beaten down in the
 * fourth year of a siege, a hull somebody smashed on purpose. The player is one
 * caller of four, and not the subject of the rule.
 *
 * WHAT WAS MISSING, AND IT WAS THE WHOLE OF IT. `ruin` in `possessions.ts` has
 * been the destruction primitive since the possessions layer was written, and
 * it takes a `factId`. Not one of its callers supplied one. So every
 * destruction in this engine appended nothing to `state.history.facts`, which
 * is the only table `circulating` and `buildPlayerDigest` read - and a thing
 * being destroyed was, to everybody who was not standing there, something that
 * had not happened.
 *
 * HOW FAR THE NEWS GOES IS THE THING'S OWN SIZE, and nothing here decides it.
 * `howBadlyItsEndingIsTaken` reads the object's `significance`, which is the
 * field the world stamped when it was made; `aDeedEntersTheWorld` turns that
 * severity into a magnitude and a visibility; `channelFor` in `digest.ts` lets
 * `market` through above `MARKET_MAGNITUDE` and nothing below it. The cut
 * between what travels and what does not was drawn before any of this, and it
 * lands where the ruling put it: a heaven-grade thing is individually known and
 * reaches somebody who was nowhere near, and everything below it is talk among
 * the people who saw it.
 *
 * THE ORDER IS LOAD-BEARING. The fact is written first, so the provenance entry
 * `ruin` appends has an id to carry. The row and the rumour are then one event
 * seen from two ends, which is the reconciliation `aDeedEntersTheWorld`
 * documents for the obligation ledger, applied to an object.
 *
 * A COUNTED THING HAS NO ROW, and that is the other half of the ruling rather
 * than an omission: a pouch goes down by one, nothing survives that anybody
 * could ask about by name, and the people in the street still saw it.
 */

import { aDeedEntersTheWorld } from './a-deed-enters-the-world-as-a-fact.js';
import { howBadlyItsEndingIsTaken } from './what-a-change-of-hands-leaves.js';
import type { HistoricalActor, HistoricalFact } from './history.js';
import {
    isRuined,
    keptAs,
    ruin,
    type ObjectRecord,
    type ObjectSignificance
} from './possessions.js';
import type { Severity } from '../social/grudges.js';
import type { WorldState } from './world-state.js';

export interface ABreaking {
    /** Whoever ended it. A person, in the roles the ledger already uses. */
    actor: HistoricalActor;
    /**
     * The tracked row, when the thing had one. The caller does not write it
     * back - this does, in place, the way every write in this layer does.
     */
    object?: ObjectRecord;
    /**
     * What was ended, when it was a counted thing and there is no row.
     *
     * `itemId` is the catalog id the holder's pouch was keeping, carried onto
     * the fact so a later reader can say what KIND of thing it was without
     * there being an instance to point at.
     */
    counted?: { itemId: string; name: string; significance: ObjectSignificance };
    /** Absolute world day. */
    day: number;
    locationId: string | null;
    place?: string | null;
    /** Houses the event is on the books of. Their people are who a faction fact reaches. */
    factionIds?: readonly string[];
    /** Engine truth, one clause, for the provenance entry and the summary. */
    how: string;
    /** False where nobody could put a name to who did it. */
    workedOut?: boolean;
}

export interface TheThingIsGone {
    fact: HistoricalFact;
    weight: Severity;
    /** The ruined row, already written back into `state`. Null for a counted thing. */
    row: ObjectRecord | null;
    /** Whether this is a thing anybody can ask about by name afterwards. */
    addressable: boolean;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * End one thing, and put the ending into the world's own record.
 *
 * Mutates `state` in place. Returns null for a row that was already ruined -
 * a thing cannot end twice, and a caller that files a second fact about the
 * same wreck has written the world two events where there was one.
 */
export function aBreakingEntersTheWorld(
    state: WorldState,
    input: ABreaking
): TheThingIsGone | null {
    const at = input.object
        ? state.objects.findIndex(row => row.id === input.object!.id)
        : -1;
    if (input.object && at >= 0 && isRuined(state.objects[at])) return null;

    const name = input.object ? input.object.name : input.counted!.name;
    const significance = input.object
        ? input.object.significance
        : input.counted!.significance;
    const addressable = input.object !== undefined && keptAs(significance) === 'tracked';

    const deed = aDeedEntersTheWorld(state, {
        kind: 'object_destroyed',
        day: input.day,
        locationId: input.locationId,
        place: input.place ?? null,
        actors: [input.actor],
        factionIds: input.factionIds ?? [],
        weight: howBadlyItsEndingIsTaken({ significance }),
        summary: `${input.actor.name} destroyed ${name}: ${input.how}`,
        unattributed: addressable
            ? 'Something nobody alive can make another of has stopped existing, and the '
              + 'people who would know are not saying whose it was.'
            : 'Somebody broke something in the street and left the pieces where they fell.',
        ...(input.workedOut === false ? { workedOut: false } : {}),
        // READ BACK BY THE RUMOUR LAYER. `sentenceFor` composes what a teller
        // says out of the fact's own columns and never out of the summary, so
        // what was broken has to be a column or nobody can name it.
        data: {
            brokeWhat: name,
            ...(input.object
                ? { brokeObjectId: input.object.id }
                : { brokeItemId: input.counted!.itemId })
        }
    });

    let row: ObjectRecord | null = null;
    if (input.object && at >= 0) {
        state.objects[at] = ruin(state.objects[at], {
            onDay: input.day,
            source: input.actor.name,
            note: input.how,
            factId: deed.fact.id
        });
        row = state.objects[at];
    }

    return {
        fact: deed.fact,
        weight: deed.weight,
        row,
        addressable,
        line: addressable
            ? `${name} is finished. The row stays, ruined, and it carries the day and the name.`
            : `${name} is gone, and there is no row left for anybody to ask about.`
    };
}
