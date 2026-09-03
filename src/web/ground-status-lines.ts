/**
 * What is wrong with the ground somebody is standing on, in their own words.
 *
 * ── WHY THIS IS A MODULE AND NOT A BLOCK IN A VERB ───────────────────────
 *
 * The area-status layer (`engine/world/what-is-true-of-a-place-right-now.ts`)
 * was reached from exactly one verb. `investigate` read it, read it correctly,
 * and read it beautifully - the statement, how long it has run, and the signs -
 * and every other way of asking said nothing at all. Played on the seat of a
 * live war, with `stops: ['passage']`, `priceMultiplier: 2` and `dangerDelta:
 * 0.5` all standing, `I look around` ended:
 *
 *     It is an ordinary day and it intends to stay one.
 *
 * That is not a missing feature in `look`. It is the same read, wanted in two
 * places, written into one of them - so this is the block `investigate` already
 * carried, lifted out so both callers get the identical answer. **Adding a
 * second status read beside the first is the mistake this file exists to
 * prevent**: two readings of one layer disagree the first time either one
 * changes.
 *
 * ── THE STAGE RULE IS THE ONE ALREADY ARGUED OUT, NOT A NEW ONE ──────────
 *
 * Capped at `encountered` and floored at `encountered`, and both halves have
 * reasons that were settled where this code used to live:
 *
 *   CAPPED   being in a thing gives you the SIGNS. The CAUSE is `known`, and
 *            `known` has to be got from somebody who has it. Walking into a
 *            famine does not tell you why there is a famine.
 *   FLOORED  `encountered` is the ladder's own word for *they have been in it,
 *            so they have the signs*, and somebody looking at the ground under
 *            their own feet has been in it. Without the floor the read was
 *            gated on a knowledge row nothing grants for standing still, so a
 *            player could walk into a famine, look around, and be told nothing
 *            was wrong - over a status that was stopping the food, quadrupling
 *            the prices and adding to the danger the whole time.
 *
 * The floor applies ONLY where they are standing. Asking after somewhere else
 * is asking, and asking is what the ordinary ladder is for - which is why
 * `standingHere` is a caller's fact and is not derived here.
 *
 * What a status DOES has never depended on anybody knowing about it. This is
 * the half that does.
 *
 * PURE. Records in, lines out. No I/O, no DB, nothing stochastic.
 */

import { stageRank, type KnowingStage } from '../engine/social/discovery.js';
import type { LocationRecord } from '../engine/world/locations.js';
import {
    whatIsGoingOnHere,
    type AreaStatus
} from '../engine/world/what-is-true-of-a-place-right-now.js';

export interface GroundStatusReading {
    /** What this person can say about what is wrong here. Empty when nothing is. */
    lines: string[];
    /** The stage everything above was read at, for the inspector. */
    stage: KnowingStage;
    /** Statuses running over this place today, whatever the reader can say. */
    running: number;
}

export interface GroundStatusInput {
    statuses: readonly AreaStatus[];
    locations: readonly LocationRecord[];
    /** The place being asked about. Its whole containing chain is read. */
    locationId: string;
    day: number;
    /** What this cultivator already holds about this place, off the knowledge rows. */
    heldStage: KnowingStage;
    /** True when this is the ground under their feet rather than somewhere asked after. */
    standingHere: boolean;
}

/**
 * The stage a status read happens at, floored and capped as above.
 *
 * Exported because the inspector line names it and a caller should not have to
 * restate the rule to print it.
 */
export function stageForStatusRead(
    heldStage: KnowingStage,
    standingHere: boolean
): KnowingStage {
    const floored: KnowingStage = standingHere
        && stageRank(heldStage) < stageRank('encountered')
        ? 'encountered'
        : heldStage;
    return stageRank(floored) > stageRank('encountered') ? 'encountered' : floored;
}

/** Everything wrong with this ground that this person could say out loud. */
export function whatIsWrongWithThisGround(input: GroundStatusInput): GroundStatusReading {
    const stage = stageForStatusRead(input.heldStage, input.standingHere);
    const readings = whatIsGoingOnHere(
        input.statuses, input.locations, input.locationId, input.day, () => stage
    );
    return {
        lines: readings.flatMap(reading => reading.lines),
        stage,
        running: readings.length
    };
}
