/**
 * The two doors out of a house's top chair that are not death.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE LADDER'S TOP, AS THE DESIGN OWNER STATES IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   head          for life, *"or retires into the grand elder seat when no
 *                 longer fit"* - *"I MEAN PATRIARCHS RETIRE INTO GRAND ELDERS."*
 *   grand elder   *"grand elders end at death."* One spot, and the only way out
 *                 of it is upward into the chair.
 *
 * `promotion-inside-a-house.ts:143` has described that seat as *"one spot only,
 * and it is where a head retires to"* for as long as anybody has looked at it,
 * and nothing has ever sent anybody there. This is the sender.
 *
 * ── 0. WHY HE GOES IS A FAMILY OF REASONS, NOT A CONDITION ───────────────
 *
 * The owner named four and said *"(non exhaustive)"*, which is the instruction:
 * near the end of a span, no longer fit, going to attempt a crossing, or a
 * disgrace the house cannot carry. {@link whyThisHeadWouldStepDown} returns
 * WHICH, and the departure carries it out of the chair on a tag, because the
 * rank write is identical for all four and a reader is not.
 *
 * ── 1. RETIREMENT IS A SWAP AND NOTHING ELSE ─────────────────────────────
 *
 * The sitting grand elder takes the chair; the patriarch takes the seat they
 * vacated. ONE SEAT EACH, BOTH STILL FILLED, NOBODY LEAVES THE HOUSE - which is
 * why it needs no vacancy, no promotion and no assent. Two rank writes.
 *
 * AND IT REQUIRES A GRAND ELDER TO SWAP WITH. With no step down from that seat,
 * a patriarch in a house whose grand elder chair is empty has nowhere to go, and
 * he holds on until he dies. That is not engineered around and it is not a
 * fallback waiting to be written: it is the old man at the top of a hollowing
 * house, and it falls out of two rules rather than being authored.
 *
 * ── 2. REMOVAL IS UNANIMOUS, AND IT IS NOT THE ROOM'S PUNISHMENT LADDER ──
 *
 * *"An unfit patriarch can still be kicked out if all the elders agree."* Every
 * elder, so ONE HOLDOUT KEEPS HIM IN THE CHAIR. Deliberately a high bar, and
 * deliberately not a weighted aggregate: {@link theRoomIsUnanimousAgainst} takes
 * no weights and asks a different question from the assent read in
 * `somebody-covers-a-house-with-no-head.ts`. Folding the two together would cost
 * more later than the line it saves.
 *
 * AND IT HAS TO MOVE A RANK, WHICH IS THE FINDING BEHIND THIS FILE. The room's
 * existing sentence `what the house gave is taken back` maps to *removed from
 * office*, and what that writes is a tag: the engine's own summary is *"keeps the
 * title and lost the office"*, and the owner's ruling in that file's header is
 * *"removed from office (title kept) or expelled."* Keeping the rank is intended
 * there. So the punishment ladder cannot reach a chair, and the rank write is
 * done here.
 *
 * HE IS NOT EXPELLED. *"Is removal from office permanent? ... depends on your
 * influence so not permanent."* He lands at the grand elder seat where it is
 * empty, and on the elder rung otherwise, and he stays on the roll. The road
 * back is `theRemovalTheyCarry`, whose decay is already measured - removals read
 * at a median 334 years behind when the doors were shut and 3 when they were
 * open - so THE EXISTING TAG IS REUSED and no second one is minted.
 *
 * ── WHAT THIS DOES NOT DO ────────────────────────────────────────────────
 *
 * No chronicle fact. The REASON is carried on a tag, which is state and cheap;
 * what the world remembers about a leadership changing hands is a separate
 * decision from whether it changed, and inventing a fact kind here would
 * duplicate somebody else's sentence. A narrator reading the tag has what it
 * needs to say which of the four happened.
 *
 * No absence door. *"You don't steal their chair if they are in seclusion"* and
 * *"i mean if nobody holds it."* A head who is away still holds the chair, and
 * `whoCoversTheChair` is right to test for anybody at the top rung.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { elderRungOf, isElderRank } from '../cultivation/leadership.js';
import { lifespanForOrdinal } from '../cultivation/realms.js';
import { whoDecidesIn } from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import { roadsWithinReachFromPractice } from './an-npc-striking-at-the-next-wall.js';
import { REMOVED_FROM_OFFICE } from './bringing-what-you-know-about-somebody-to-the-room.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { faceOf } from './what-a-face-is-worth.js';
import { howFitTheyAre } from './whether-a-house-thinks-its-head-is-still-fit.js';
import type { WorldState } from './world-state.js';
import type { ObligationRecord } from '../social/grudges.js';

/**
 * WHY A HEAD WOULD STEP DOWN. Four today, and the list is explicitly open - the
 * design owner named them and added *"(non exhaustive)"*.
 *
 * A REASON AND NOT A BOOLEAN, because the rank write is identical for all of
 * them and a reader is not. *"The patriarch stepped down to attempt his
 * breakthrough"* and *"the patriarch was made to go after what he did at the
 * conclave"* are different events to everybody except the ladder. Adding a fifth
 * must be one entry here and one branch in {@link whyThisHeadWouldStepDown},
 * never a rewrite.
 */
export type WhyTheyWouldGo =
    /** Their span is nearly spent and the house needs a head chosen, not inherited in a panic. */
    | 'near the end of their span'
    /** The same pressure through the other door: they go to strike at the next wall. */
    | 'to attempt a crossing'
    /** The body has failed. Rare today - see the note on the read. */
    | 'no longer fit'
    /** Their face has fallen past what a house can carry in its own chair. */
    | 'a disgrace the house cannot carry';

/**
 * The share of their realm's span past which a patriarch is planning his own
 * succession rather than expecting another century.
 *
 * NINE TENTHS, and the tenth left is the point. `lifeSpent` is already the
 * world's reading of how far through themselves somebody is - `pickByMortality`
 * weights a death by its square and then rolls acceptance against it flat - so
 * at 0.9 the world already considers this person to be dying soon. What the
 * remaining tenth buys is TIME TO HAND OVER IN: spans at the rungs that run
 * houses are centuries, so a tenth is decades, and a rule that fired at 0.99
 * would be a deathbed rather than succession planning.
 */
export const HOW_SPENT_A_SPAN_HAS_TO_BE = 0.9;

/**
 * How far a head's face has to have fallen before the chair is untenable.
 *
 * Read in the unit the face ledger already uses: `A_PUBLIC_WIN = 1`, one public
 * win over an equal in front of a roll's worth of people. So this is three
 * public defeats' worth of standing, and it mints no second number - a disgrace
 * already has one and this is it.
 */
export const THE_FACE_A_CHAIR_CANNOT_CARRY = -3;

/**
 * How far through their own span this person is, 0..1.
 *
 * MIRRORS `lifeSpent` in `the-world-changing-on-its-own.ts` and is not imported
 * from it: that function is private there, and that file is under hunk-by-hunk
 * review carrying two agents' uncommitted work, so it is not one to reach into
 * for an export today. Five lines and the same five. Collapse the two when that
 * file is settled.
 */
export function howSpentTheirSpanIs(npc: NpcRecord, day: number): number {
    const span = lifespanForOrdinal(npc.cultivation.realmOrdinal);
    if (!Number.isFinite(span) || span <= 0) return 1;
    const age = (day - npc.identity.bornOnDay) / DAYS_PER_YEAR;
    return Math.max(0, Math.min(1, age / span));
}

/**
 * Why this head would step down, or null where they would not.
 *
 * Pure. No RNG and no write.
 *
 * MORE THAN ONE CAN BE TRUE and the order below is which one gets recorded. A
 * disgraced patriarch at the end of his span goes for the disgrace, because that
 * is the thing that happened; the span was true for decades and did not move
 * anybody on its own.
 *
 * ── WHICH ARM DOES THE WORK ──────────────────────────────────────────────
 *
 * NEAR THE END OF A SPAN is the one that fires. `lifeSpent` is live and
 * well-populated - it is what `pickByMortality` weights every natural death by.
 *
 * NO LONGER FIT is expected to do NO WORK TODAY, and the reason is sharper than
 * a missing feature. `soulState` IS written - by
 * `what-goes-wrong-at-a-realm-boundary.ts`, `a-body-under-somebody-elses-hand.ts`
 * and `combat-verbs.ts` - and EVERY ONE OF THOSE IS ON THE PLAYED CHARACTER'S
 * PATH. No world pass damages a background NPC's soul, and a patriarch is
 * background until the player meets him. So the layer works and the simulation
 * does not use it: measured, `soulState` reads `intact` for every living person
 * in two worlds at seeding and at 200 years - 998/998, 1021/1021, 927/927,
 * 952/952 - and nobody in either world carries the two permanent wounds the
 * other half of the read asks for.
 *
 * IT IS KEPT BECAUSE IT IS CORRECT, not because it contributes: a head the
 * player has broken should step down, and this is what would notice. A zero on
 * this arm is the world's state and not a defect in the branch.
 *
 * TO ATTEMPT A CROSSING is the same pressure through the other door and is
 * deliberately not a separate trigger - the owner: *"it falls out of the above"*.
 * It is a man near the end of his span who still has somewhere to strike at,
 * which is read off the roads his own practice puts within reach. Whether he
 * then goes into seclusion is `an-npc-striking-at-the-next-wall.ts`'s business
 * and not written here; `readyToStrike` wants `WallConditions` - ambient qi, the
 * province multiplier, a guide, a manual ceiling - which this pass has no honest
 * way to assemble and must not half-assemble.
 *
 * A DISGRACE is read off `faceOf`, the one public-standing number this repo has.
 * See {@link THE_FACE_A_CHAIR_CANNOT_CARRY}.
 */
export function whyThisHeadWouldStepDown(npc: NpcRecord, day: number): WhyTheyWouldGo | null {
    if (!howFitTheyAre(npc).fit) return 'no longer fit';
    if (faceOf(npc) <= THE_FACE_A_CHAIR_CANNOT_CARRY) return 'a disgrace the house cannot carry';
    if (howSpentTheirSpanIs(npc, day) >= HOW_SPENT_A_SPAN_HAS_TO_BE) {
        return roadsWithinReachFromPractice(npc).length > 0
            ? 'to attempt a crossing'
            : 'near the end of their span';
    }
    return null;
}

/**
 * A short key per reason, for the tag. The prose form is the type above and is
 * what a reader sees; this is what survives a round trip through a string.
 */
export const WHAT_TO_CALL_IT: Readonly<Record<WhyTheyWouldGo, string>> = Object.freeze({
    'near the end of their span': 'span',
    'to attempt a crossing': 'crossing',
    'no longer fit': 'unfit',
    'a disgrace the house cannot carry': 'disgrace'
});

/** On a person: the day they left a house's chair, and what took them out of it. */
export const STEPPED_DOWN = 'stepped-down:';

/** The tag a head carries out of the chair. */
export function steppedDownTag(houseId: string, why: WhyTheyWouldGo, onDay: number): string {
    return `${STEPPED_DOWN}${houseId}:${WHAT_TO_CALL_IT[why]}:${Math.floor(onDay)}`;
}

/** Why this person left that house's chair, and when, or null where they never did. */
export function whyTheyLeftTheChair(
    npc: Pick<NpcRecord, 'tags'>,
    houseId: string
): { why: string; day: number } | null {
    const prefix = `${STEPPED_DOWN}${houseId}:`;
    for (const tag of npc.tags) {
        if (!tag.startsWith(prefix)) continue;
        const rest = tag.slice(prefix.length);
        const at = rest.lastIndexOf(':');
        if (at <= 0) continue;
        const day = Number(rest.slice(at + 1));
        if (!Number.isFinite(day)) continue;
        return { why: rest.slice(0, at), day };
    }
    return null;
}

export interface WhatChangedAtTheTop {
    /** Heads who stepped down into the grand elder seat, swapping with its holder. */
    retired: number;
    /** Heads the elders put out of the chair, unanimously. */
    removed: number;
    /** Heads with a reason to go who stayed, for want of a successor or a holdout elder. */
    heldOn: number;
    /** Every departure by the reason recorded for it. The narrator's half. */
    byReason: Record<WhyTheyWouldGo, number>;
}

/**
 * The yearly pass over every house's top chair.
 *
 * Runs AT OR BEFORE the promotions, never after: `coverTheEmptyChairs` reads the
 * chair at day 90.5 and a vacancy resolved later in the year would be covered
 * first and resolved second.
 */
export function theTopOfAHouseChangesHands(state: WorldState, day: number): WhatChangedAtTheTop {
    const onDay = Math.floor(day);
    const out: WhatChangedAtTheTop = {
        retired: 0,
        removed: 0,
        heldOn: 0,
        byReason: {
            'near the end of their span': 0,
            'to attempt a crossing': 0,
            'no longer fit': 0,
            'a disgrace the house cannot carry': 0
        }
    };

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        const rankCount = house.ranks.length;
        if (rankCount < 3) continue;
        const top = rankCount - 1;

        const members = state.npcs.filter(
            npc => npc.status === 'alive' && npc.factionId === house.id && npc.factionRankIndex >= 0
        );
        const head = members.find(npc => npc.factionRankIndex === top);
        // Nobody in the chair is the cover's question, not this one.
        if (head === undefined) continue;
        // The player's row is never moved by a world pass.
        if (!isTheWorldsToMove(head)) continue;
        const why = whyThisHeadWouldStepDown(head, onDay);
        if (why === null) continue;

        // AND THE SUCCESSOR HAS TO BE FIT THEMSELVES. Without this a house that
        // retires one patriarch hands the chair down and then, when the new head
        // fails in turn, hands it straight BACK to the unfit old man sitting in
        // the grand elder seat - the swap is symmetric and would happily run in
        // reverse. A retirement is somebody stepping down to somebody, not two
        // people trading a chair back and forth until they die.
        // AND THE SUCCESSOR HAS TO HAVE A REASON TO STAY. Handing the chair to
        // somebody who would himself step down for the same reason is two dying
        // men trading a seat: the fit check alone did not catch it once span
        // became the arm that fires, because the grand elder of an old patriarch
        // is usually old too.
        const grand = members.find(npc => npc.factionRankIndex === top - 1);
        if (grand !== undefined && isTheWorldsToMove(grand)
            && whyThisHeadWouldStepDown(grand, onDay) === null) {
            moveTo(state, head.id, top - 1, onDay);
            moveTo(state, grand.id, top, onDay);
            markSteppedDown(state, head.id, house.id, why, onDay);
            out.retired++;
            out.byReason[why]++;
            continue;
        }

        const roll = members.map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex }));
        if (theRoomIsUnanimousAgainst(head.id, { roll, rankCount, ledger: state.obligations ?? [] })) {
            // The grand elder seat is empty in this branch - that is why there
            // was no swap - so it is where he lands, unless this house's ladder
            // has no separate grand elder rung, in which case the elder rung is
            // the floor. Clamped below the chair either way.
            const grandSeat = top - 1;
            const landsAt = Math.min(
                grandSeat,
                isElderRank(grandSeat, rankCount) ? grandSeat : elderRungOf(rankCount)
            );
            moveTo(state, head.id, landsAt, onDay);
            markRemoved(state, head.id, house.id, onDay);
            markSteppedDown(state, head.id, house.id, why, onDay);
            out.removed++;
            out.byReason[why]++;
            continue;
        }
        out.heldOn++;
    }
    return out;
}

/**
 * Whether every elder would have him out.
 *
 * NO WEIGHTS AND NO AGGREGATE. `whoDecidesIn` reports a seniority weight and a
 * reading per elder, and every other consumer folds them together; this one must
 * not, because the owner's bar is *all* the elders and one holdout is a veto. A
 * weighted mean would let a heavy voice carry a room that does not agree.
 *
 * The head's own voice is excluded - nobody votes on their own removal - and a
 * room of nobody removes nobody, so a house whose only elder is the head keeps
 * him.
 */
export function theRoomIsUnanimousAgainst(
    headId: string,
    input: {
        roll: readonly { id: string; rankIndex: number }[];
        rankCount: number;
        ledger?: readonly ObligationRecord[];
    }
): boolean {
    const room = whoDecidesIn({
        roll: input.roll,
        rankCount: input.rankCount,
        asking: headId,
        ...(input.ledger === undefined ? {} : { ledger: input.ledger })
    }).filter(say => say.id !== headId);

    if (room.length === 0) return false;
    return room.every(say => say.reading < 0);
}

/** Whether this rung is one the elders sit on, for a caller outside this file. */
export function isAnElderSeat(rankIndex: number, rankCount: number): boolean {
    return isElderRank(rankIndex, rankCount) && rankIndex < rankCount - 1;
}

function moveTo(state: WorldState, npcId: string, rankIndex: number, onDay: number): void {
    const i = state.npcs.findIndex(n => n.id === npcId);
    if (i < 0) return;
    state.npcs[i] = { ...state.npcs[i], factionRankIndex: rankIndex, updatedOnDay: onDay } as NpcRecord;
}

function markSteppedDown(
    state: WorldState,
    npcId: string,
    houseId: string,
    why: WhyTheyWouldGo,
    onDay: number
): void {
    const i = state.npcs.findIndex(n => n.id === npcId);
    if (i < 0) return;
    const row = state.npcs[i]!;
    state.npcs[i] = {
        ...row,
        tags: Array.from(new Set([...row.tags, steppedDownTag(houseId, why, onDay)])),
        updatedOnDay: onDay
    };
}

function markRemoved(state: WorldState, npcId: string, houseId: string, onDay: number): void {
    const i = state.npcs.findIndex(n => n.id === npcId);
    if (i < 0) return;
    const row = state.npcs[i]!;
    state.npcs[i] = {
        ...row,
        tags: Array.from(new Set([...row.tags, `${REMOVED_FROM_OFFICE}${houseId}:${onDay}`])),
        updatedOnDay: onDay
    };
}
