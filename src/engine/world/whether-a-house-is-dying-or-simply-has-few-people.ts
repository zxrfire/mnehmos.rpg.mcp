/**
 * Whether a house is failing, when counting heads is the wrong instrument.
 *
 * ── WHAT THIS FILE USED TO BE ────────────────────────────────────────────
 *
 * `who-sits-in-the-hollow-court.ts`, and it held a seating plan for one
 * faction. That plan is gone and it should be, for two reasons that are the
 * same reason.
 *
 * It was a SECOND CODE PATH for a question the seeder already answers - who is
 * standing in this house - and it existed only because the Court's roster lived
 * in a file `MEMBERS` did not include. It does now, so the plan has nothing
 * left to do. And what it produced while it existed was worse than nothing:
 * eleven anonymous drawn bodies at the Court, standing beside a register that
 * printed eleven named ones. Two mechanisms, two populations, one house.
 *
 * The plan's own header said the catalog was wrong about the Court's lower
 * rungs being empty. It was right about that and it fixed it in the wrong
 * place: the correction belonged in the catalog, where it now is.
 *
 * ── WHAT SURVIVES, AND WHY IT IS NOT ABOUT ANY ONE HOUSE ─────────────────
 *
 * One predicate, and it was always general even while it lived in a file named
 * after a faction. `faction_fell` binds to whoever the economy has ruined and
 * reads a headcount under three as one of its signals. That is right for an
 * ordinary house and wrong for anybody whose people do not die on institutional
 * timescales - and rebuilding after losing three of four to a crossing is not
 * an institution dying, it is the institution doing the only thing it does.
 *
 * So the test is the span its people are standing on rather than how many of
 * them there are, and it applies to any body that ever holds somebody at that
 * height.
 */

import type { WorldState } from './world-state.js';

/**
 * Years of remaining life beyond which a member is not somebody a house can
 * lose to time.
 *
 * Ten thousand, which is the span Body Integration grants - the rung at which
 * a person outlasts every ordinary institution around them and the point past
 * which counting heads stops being a measure of whether a body is dying.
 */
export const LIFESPAN_THAT_OUTLASTS_AN_INSTITUTION = 10_000;

/**
 * Whether this body is one whose people simply do not die on institutional
 * timescales, and therefore cannot be failing the way a house fails.
 */
export function standsOnAnUnreachableClock(state: WorldState, factionId: string): boolean {
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId !== factionId) continue;
        const remaining = (npc.cultivation.lifespanEndsOnDay - state.currentDay) / 365;
        if (remaining >= LIFESPAN_THAT_OUTLASTS_AN_INSTITUTION) return true;
    }
    return false;
}
