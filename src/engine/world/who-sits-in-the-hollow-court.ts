/**
 * The Hollow Court's roster, which the world could not see.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The Court's four Seats are enumerated in `WITHDRAWN_POWERS` with their
 * ordinals, and `members.ts` says in its own header that this is deliberate -
 * the Seats are unnamed across the whole catalog and the register reads them
 * from there instead. Which is fine for the register and fatal for the world:
 * the seeder builds a faction's people out of `MEMBERS`, finds none for the
 * Court, and the apex of the setting ends up holding whatever incidental person
 * `seedFactionApex` happens to place. Measured, that is exactly one, and then
 * `faction_fell` reads a house with fewer than three members and dissolves it -
 * on every seed, inside three hundred years.
 *
 * So the strongest body in the world was empty because its roster lived in a
 * file the engine never opens. This is the third instance of that shape found
 * in one session: `carriesTo` and `teachersOf` are read by the catalog and the
 * register and by nothing in `src/engine/`, the whole living-transmission layer
 * likewise, and now this.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE COURT IS, WHICH DECIDES WHAT ITS PEOPLE ARE DOING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The Seats are not idle and they are not stalled. They are WAITING, on purpose,
 * in order to cross together with protectors rather than alone - a considered
 * strategy by people with tens of thousands of years to spend, and the reason
 * the Court looks sealed, hidden, static and unreachable from outside. It is
 * assembling a party, not staffing a sect.
 *
 * That is also why it admits at ordinal 29 AND age 250 or under. The age bar is
 * not a status check, it is a PREDICTION: reach Void Refinement that fast and
 * your trajectory ends above the Lid. So the Court's membership is by
 * construction the tail of the age distribution, selected on exactly the axis
 * that produces it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * CONDITION THE DRAW, DO NOT AUTHOR THE PEOPLE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Only two things here are fixed, and both are the institution stating its own
 * rules rather than this module inventing a person:
 *
 *   THE SEAT ORDINALS come from `WITHDRAWN_POWERS`, which already declares
 *   44, 43, 43 and 42. Nothing here chooses them.
 *
 *   THE LOWER RUNGS HOLD PRODIGIES, and prodigy is expressed the way this
 *   engine already expresses it - the `chosen` tag, which `shelfReach`,
 *   `assessPromotions` and `refreshChosen` all already read - plus an age
 *   inside the Court's own published bar, because a member who did not clear
 *   that bar could not have been admitted. That is the same move
 *   `what-root-a-seeded-house-member-has.ts` makes for roots and
 *   `where-the-seeded-population-was-born.ts` makes for origin: the seat
 *   implies a distribution, so draw from that distribution.
 *
 * Everything else - name, root, origin, attributes, exact ordinal, exact age -
 * is drawn as it is for anybody else. There are no authored individuals in this
 * file and there must not be.
 *
 * THE CATALOG WAS WRONG ABOUT THE LOWER RUNGS. `members.ts` and
 * `hollow-court-roster.ts` both say the three lower rungs have never been
 * occupied. They hold a few people each, and every one of them is a prodigy -
 * which is what gives the Seats the successors they need, since a survivor at
 * 42 has tens of thousands of years in which to raise a replacement and that is
 * what the Court does after a failed crossing.
 */

import { WITHDRAWN_POWERS } from '../../data/cultivation/sects.js';
import { clampOrdinal, lifespanForOrdinal } from '../cultivation/realms.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';

/**
 * The Court's own admission bar, in years. Stated in `past-the-ceiling.md` and
 * restated here because the draw has to satisfy it: somebody who took longer
 * than this to reach Void Refinement is somebody the Court has already declined.
 */
export const COURT_MAX_ADMISSION_AGE = 250;

/** The rung the Court admits from. Below this it takes nobody at all. */
export const COURT_ADMISSION_ORDINAL = 29;

/**
 * How many stand on each rung below the Seats.
 *
 * A few, and deliberately not many: the Court is a party being assembled, and
 * the whole world currently contains fourteen to seventeen people at Void
 * Refinement or above. Three, two and two is a body of seven under four Seats,
 * which is a succession rather than a school.
 */
export const COURT_LOWER_RUNG_COUNTS: readonly number[] = [3, 2, 2];

export interface CourtSeatPlan {
    /** Index into the faction's `ranks`, 0 at the bottom. */
    rankIndex: number;
    realmOrdinal: number;
    /** True for the lower rungs, which are prodigies by ruling. */
    prodigy: boolean;
    /** Upper bound on age at placement, in years. */
    maxAgeYears: number;
}

/**
 * Everybody the Hollow Court should have standing in it, as a plan rather than
 * as people. The caller draws the rest.
 *
 * The Seats take the top rank and their ordinals come straight from
 * `WITHDRAWN_POWERS`. The lower rungs are filled from the admission floor
 * upward, stopping below the lowest Seat, so the Court reads as a ladder
 * somebody could actually have climbed into rather than a wall of equals.
 */
export function planTheHollowCourt(rankCount: number): CourtSeatPlan[] {
    const withdrawn = WITHDRAWN_POWERS['sect-hollow-court'];
    if (!withdrawn || rankCount < 2) return [];

    const topRank = Math.max(0, rankCount - 1);
    const out: CourtSeatPlan[] = withdrawn.seats.map(seat => ({
        rankIndex: topRank,
        realmOrdinal: clampOrdinal(seat.ordinal),
        prodigy: false,
        // A Seat cleared the bar centuries ago; what binds them now is the
        // span their realm granted, not the door they came through.
        maxAgeYears: Math.floor(lifespanForOrdinal(clampOrdinal(seat.ordinal)) * 0.25)
    }));

    const lowestSeat = out.reduce((m, s) => Math.min(m, s.realmOrdinal), Infinity);
    const headroom = Math.max(1, lowestSeat - COURT_ADMISSION_ORDINAL);

    for (let rank = 0; rank < Math.min(topRank, COURT_LOWER_RUNG_COUNTS.length); rank++) {
        const count = COURT_LOWER_RUNG_COUNTS[rank];
        for (let i = 0; i < count; i++) {
            // Spread up the gap between the admission floor and the lowest
            // Seat, so rank 0 sits near the door and rank 2 sits just under the
            // Seats. Derived from the two numbers rather than tabulated.
            const share = (rank + 1) / (Math.min(topRank, COURT_LOWER_RUNG_COUNTS.length) + 1);
            out.push({
                rankIndex: rank,
                realmOrdinal: clampOrdinal(COURT_ADMISSION_ORDINAL + Math.floor(share * headroom)),
                prodigy: true,
                maxAgeYears: COURT_MAX_ADMISSION_AGE
            });
        }
    }
    return out;
}

/**
 * Whether this body is one whose people simply do not die on institutional
 * timescales, and therefore cannot be failing the way a house fails.
 *
 * `faction_fell` binds to whoever the economy has ruined, and reads a headcount
 * under three as one of its signals. That is right for an ordinary house and
 * wrong here in two directions at once: it fired on the Court because the
 * seeder never read its roster, and it would still be wrong on a Court that
 * legitimately held one person - a survivor at 42 has tens of thousands of
 * years left, and rebuilding after losing three Seats to a crossing is not an
 * institution dying, it is the institution doing the only thing it does.
 *
 * So the test is the span its people are standing on rather than how many of
 * them there are.
 */
export function standsOnAnUnreachableClock(state: WorldState, factionId: string): boolean {
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId !== factionId) continue;
        const remaining = (npc.cultivation.lifespanEndsOnDay - state.currentDay) / 365;
        if (remaining >= LIFESPAN_THAT_OUTLASTS_AN_INSTITUTION) return true;
    }
    return false;
}

/**
 * Years of remaining life beyond which a member is not somebody a house can
 * lose to time.
 *
 * Ten thousand, which is the span Body Integration grants - the rung at which
 * a person outlasts every ordinary institution around them and the point past
 * which counting heads stops being a measure of whether a body is dying.
 */
export const LIFESPAN_THAT_OUTLASTS_AN_INSTITUTION = 10_000;

/** The elements a drawn root supplies, for the specialties field. */
export function specialtiesFor(npc: NpcRecord): string[] {
    return getSpiritRoot(npc.cultivation.spiritRoot).elements.slice();
}
