/**
 * Being held back in a house, and how long it has been going on.
 *
 * `promotion-inside-a-house.ts` says what the whole setting runs on: a
 * cultivator who has outgrown their rank and cannot be promoted has exactly one
 * move, GO SOMEWHERE ELSE. `assessPromotions` has always computed who that is -
 * `blocked`, with the reason - and every year it was discarded except for the
 * one reason that names a rival. The only reason anybody walked out of a house
 * for being stuck was `nothing in the hall is theirs`, and its condition was
 * the bottom rung with an empty purse, so a strong elder with no chair, the
 * case the sentence describes, could never be moved by it.
 *
 * ── WHAT IS STORED, AND WHY ANYTHING IS ──────────────────────────────────
 *
 * How far past the bar somebody stands is derived fresh every year. How LONG
 * they have stood there is not derivable: the ledger writes a promotion only in
 * the upper half of a ladder, and nothing else dates a rung. So the day a house
 * first found it could not raise somebody is kept once, on the person, as a
 * tag - `held-back|<house>|<rung>|<since>|<realms past the bar>|<reason>` -
 * written by the yearly promotion pass that decides it and dropped the year it
 * stops being true. A tag rather than a column because tags already persist
 * with the row and already carry what the walk-out pass reads.
 *
 * ── HOW HARD IT PRESSES ──────────────────────────────────────────────────
 *
 * In the walk-out pass's own unit, a reason. It starts at nothing - a house that
 * could not raise somebody this year has not yet failed them - and grows with
 * the years they have waited, faster the further past the bar they stand, up to
 * what four separate grievances weigh. No rung appears anywhere in it: an outer
 * disciple and an elder with no chair are pressed by the same rule.
 *
 * ── MEASURED, AND WHAT IT DID NOT DO ─────────────────────────────────────
 *
 * `scripts/probe-does-being-held-back-walk-anybody-out.ts`, four seeds, 500
 * years, both arms in one process, summed. Most of a roll is held back at any
 * time - 330 to 420 of about 500 - because the realm bars are low and the seats
 * are few, which is the point of the header above.
 *
 *                                  without       with
 *   walk-outs a century, bottom       170          328
 *                        middle       115          205
 *                        elder        115          230
 *   elders on rolls                   404          392
 *   houses with an empty elder rung  75 of 144    80 of 145
 *   people above 29 / 35 / 41     81 / 39 / 15   103 / 42 / 15
 *
 * Twice the departures, at every rung and not only at the bottom, and the top of
 * the world did not thin further: the elder count and the empty elder rungs moved
 * inside the seeds' own spread (at 300 years they moved the other way, 408 to
 * 421 and 74 to 68), and more people stand above 29, because somebody who walks
 * out goes to a road a province away and `applyAdvancement` pays for being there.
 */

import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { NpcRecord } from './npc-state.js';
import type { Blocked, BlockedReason } from './promotion-inside-a-house.js';
import type { WorldState } from './world-state.js';

const HELD_BACK = 'held-back|';

export interface HeldBack {
    houseId: string;
    atRank: number;
    sinceDay: number;
    /** Whole realms their own stands past the bar of the rung they cannot have. */
    realmsPastTheBar: number;
    reason: BlockedReason;
}

function realmIndex(ordinal: number): number {
    return REALM_TIERS.indexOf(realmForOrdinal(ordinal));
}

function asTag(held: HeldBack): string {
    return `${HELD_BACK}${held.houseId}|${held.atRank}|${held.sinceDay}|${held.realmsPastTheBar}|${held.reason}`;
}

/**
 * Where this person is held back, today, or null. Null for a tag written about
 * another house or another rung, which is a year out of date rather than true.
 */
export function whereTheyAreHeldBack(
    npc: Pick<NpcRecord, 'tags' | 'factionId' | 'factionRankIndex'>
): HeldBack | null {
    const tag = npc.tags.find(t => t.startsWith(HELD_BACK));
    if (!tag) return null;
    const [, houseId, rank, since, realms, reason] = tag.split('|');
    const held: HeldBack = {
        houseId: houseId ?? '',
        atRank: Number(rank),
        sinceDay: Number(since),
        realmsPastTheBar: Number(realms),
        reason: reason as BlockedReason
    };
    if (held.houseId !== npc.factionId || held.atRank !== npc.factionRankIndex) return null;
    if (!Number.isFinite(held.sinceDay) || !Number.isFinite(held.realmsPastTheBar)) return null;
    return held;
}

/**
 * Whether the only rung above somebody is their house's head.
 *
 * NOT BEING HELD BACK. The head's chair is one seat, filled when it stands empty
 * (`seatsAtRank`), which is a succession and not a promotion anybody is denied.
 * Measured on `shape-a`: the Hollow Court's Second, Third and Fourth Seats stand
 * on the rung under the one chair, were stamped held back `no_seat` from the
 * first year, and all three had walked out within ninety years - "they had
 * outgrown their place in that hall" - the top of the world scattered into
 * splinters because a living First Seat was read as a house with no room.
 *
 * ── AND IT IS THE TOP RUNG ONLY, WHICH IT WAS NOT AT FIRST ───────────────
 *
 * The first version exempted `atRank + 1 >= rankCount - 1` - the rung under the
 * top AND the one under that - which was a generalisation nobody needed and it
 * took a whole population with it. `whoSplitsAHouse` wants somebody senior,
 * below the top, and CARRYING THE HELD-BACK TAG: in a seven-rung house that is
 * ranks four and five, and rank five had just stopped being tagged. A pass
 * written to found splinters stopped founding them.
 *
 * WHAT MAKES THIS WORTH A PARAGRAPH RATHER THAN A LINE. The evidence quoted for
 * that pass working - 2.4 foundings a century, ten live splinters at a thousand
 * years, measured 2026-09-22 - was true when it was taken and stopped being
 * true in the same session it was quoted, because of this function. A measured
 * claim with no date on it becomes folklore the moment the thing it measured
 * changes. Both numbers here carry theirs.
 */
export function waitingOnASuccession(blocked: Pick<Blocked, 'atRank'>, rankCount: number): boolean {
    return rankCount > 0 && blocked.atRank + 1 >= rankCount;
}

/**
 * Write this year's assessment onto the people it is about.
 *
 * Kept where it still holds, started where it is new, and dropped from anybody
 * the assessment no longer names - promoted, gone, or no longer tall enough. The
 * player's own row is left alone: what holds a player back is said to them by
 * `why-progress-has-stopped.ts`, and they decide what to do about it.
 */
export function noteWhoIsHeldBack(
    state: WorldState,
    blocked: readonly Blocked[],
    day: number,
    isTheWorldsToMove: (npc: NpcRecord) => boolean
): void {
    const rungsOf = new Map(state.factions.map(f => [f.id, f.ranks.length] as const));
    const byId = new Map(blocked
        .filter(b => !waitingOnASuccession(b, rungsOf.get(b.factionId) ?? 0))
        .map(b => [b.npcId, b]));
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        const had = npc.tags.find(t => t.startsWith(HELD_BACK)) ?? null;
        const now = npc.status === 'alive' && isTheWorldsToMove(npc) ? byId.get(npc.id) ?? null : null;
        if (now === null) {
            if (had !== null) state.npcs[i] = { ...npc, tags: npc.tags.filter(t => t !== had) };
            continue;
        }
        const before = whereTheyAreHeldBack(npc);
        const still = before !== null && before.houseId === now.factionId && before.atRank === now.atRank;
        const tag = asTag({
            houseId: now.factionId,
            atRank: now.atRank,
            sinceDay: still ? before!.sinceDay : Math.floor(day),
            realmsPastTheBar: Math.max(0, realmIndex(npc.cultivation.realmOrdinal) - realmIndex(now.bar)),
            reason: now.reason
        });
        if (tag === had) continue;
        state.npcs[i] = {
            ...npc,
            tags: [...npc.tags.filter(t => !t.startsWith(HELD_BACK)), tag]
        };
    }
}

/**
 * Years held back before it presses as hard as any one other reason, for somebody
 * standing just at the bar, in a life of {@link A_LIFE_THE_YEARS_ARE_COUNTED_IN}.
 * Every whole realm past the bar shortens it: a house that cannot find room for
 * somebody a realm above what the room asks is failing them faster.
 *
 * AND A YEAR IS A SHARE OF A LIFE. The design owner: *"people can leave but they
 * don't leave easily. Cultivators live a long time."* Twenty years is a fifth of
 * a mortal's hundred and a thousandth of a Tribulation Transcender's hundred
 * thousand, so the wait is read against the span the person actually has
 * (`lifespanForOrdinal`): a fifth of it, whatever it is.
 */
export const YEARS_BEFORE_IT_WEIGHS_LIKE_A_REASON = 20;

/** The life the figures above are stated in: a mortal's, `lifespanForOrdinal(0)`. */
export const A_LIFE_THE_YEARS_ARE_COUNTED_IN = 100;

/** As much as four separate grievances, and no more. */
export const BEING_HELD_BACK_WEIGHS_AT_MOST = 4;

/**
 * How many reasons' worth being held back is, today. Zero for somebody who is not.
 *
 * `lifespanYears` is the span of the person held back; omitted, the years are
 * a mortal's.
 */
export function howHardBeingHeldBackPresses(
    held: HeldBack | null,
    day: number,
    lifespanYears: number = A_LIFE_THE_YEARS_ARE_COUNTED_IN
): number {
    if (held === null) return 0;
    const years = Math.max(0, (day - held.sinceDay) / DAYS_PER_YEAR);
    const ofALife = A_LIFE_THE_YEARS_ARE_COUNTED_IN
        / Math.max(A_LIFE_THE_YEARS_ARE_COUNTED_IN, lifespanYears);
    return Math.min(
        BEING_HELD_BACK_WEIGHS_AT_MOST,
        (years * ofALife / YEARS_BEFORE_IT_WEIGHS_LIKE_A_REASON) * (1 + held.realmsPastTheBar)
    );
}
