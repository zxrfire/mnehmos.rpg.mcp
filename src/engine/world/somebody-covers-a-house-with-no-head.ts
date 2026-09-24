/**
 * A house whose head is dead, and the elder who answers for it until somebody
 * can properly take the chair.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE OUTCOMES, AND THE FIRST ONE IS ALREADY BUILT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner: *"in a pinch they take someone temporarily, or no one and
 * they operate as is. that's normal, right? someone unqualified fills for lack
 * of better qualified successor."*
 *
 *   1  SOMEBODY QUALIFIES    `assessPromotions` seats them. It reads the rung's
 *                            contribution bar and the head's realm band, and it
 *                            is CORRECT TO REFUSE - measured over 200 years on
 *                            two seeds, three and five people crossed into the
 *                            head rung, after a median 71 and 58 years below it.
 *                            *"much slower to promote to elder/patriarch (if at
 *                            all)"* is the shape, and nothing here changes it.
 *   2  NOBODY QUALIFIES      an elder covers. This module.
 *   3  NOR IS THERE AN ELDER the chair stays empty and the house carries on.
 *                            Also this module, by returning null.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE COVER IS NOT DRAWN FROM THE RUNG BELOW THE HEAD
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Because that rung is usually empty. `seatsAtRank` gives the grand elder
 * exactly ONE chair, and a measured world carries 29-30 grand elders across
 * 42-46 houses. Every one of the 19 head chairs standing empty at year 200 had
 * NOBODY on the rung below it - not a bench short of merit, not a bench short of
 * the realm bar, an empty bench. A rule that drew from there would be a branch
 * that never fires, which is the same defect as a rule that fires always.
 *
 * So the cover is drawn from the whole elder band (`isElderRank`), which carries
 * 89-100 people and is healthy. The owner said *"if nobody is at the next rung,
 * SOMEBODY fills it"* - someone, not someone from the next rung.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE ROOM HAS TO AGREE, WHICH IS A THING THAT ALREADY EXISTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `whatTheRoomDecides` is NOT this. It is a punishment ladder - rebuke, fine,
 * taken back, sealed, crippled, death - and withholding a chair is not on it.
 * It is the right name for the wrong event and nothing here calls it.
 *
 * `whoDecidesIn` is this. It returns everybody at an elder rung with a reading
 * of what they make of the person asking, already weighted by seniority. So the
 * room agreeing is the room's own weighted reading coming out above zero, which
 * needs no new field and no new currency.
 *
 * ── AND WHAT THAT READING IS MADE OF, EXACTLY ────────────────────────────
 *
 * `openHandednessOf(decider)` - a fixed disposition per person - MOVED by what
 * the OBLIGATION LEDGER says that decider carries about the candidate: distinct
 * favours owed to them, distinct wrongs held against them, weighted by severity.
 * It does NOT read `NpcRelationship.standing`. Both are true readings of a room
 * toward a person and they are not the same one, so a later change that wants
 * the ties rather than the ledger is a change of currency and should say so.
 *
 * ── THE THREE THINGS CALLED STANDING, BECAUSE THIS WILL BE RE-CONFUSED ───
 *
 *   `NpcRelationship.standing`   how two people stand with each other. On every
 *                                NPC, world-side. `howLoyalTheyAre` aggregates
 *                                it, and `byStanding` already orders candidates
 *                                by it - so it decides WHO is asked about here,
 *                                while the ledger decides whether the room says
 *                                yes.
 *   `HouseLedger.standing`       the PLAYER's credit with a house, held as a db
 *                                flag in `src/web/standing.ts`, recovering with
 *                                years served. NPCs have none. The world
 *                                simulation cannot see it.
 *   `standingCost`               a price denominated in the second, which is why
 *                                `externalElderCost` is a thing a house pays and
 *                                not a thing an NPC has.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A COVER IS NOT A PROMOTION AND DOES NOT MOVE ANYBODY'S RUNG
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The house doc's vacancy already runs in three steps for an OFFICE - the holder
 * dies or leaves, somebody senior covers (`APortfolio.actingId`), the house
 * fills the chair - and this is the same three steps for the head's chair. So
 * the covering elder keeps their own rung and carries a tag. The chair stays
 * formally empty, `seatsAtRank` keeps offering it, and the moment somebody
 * clears the contribution bar the ordinary promotion seats them properly. Write
 * the cover as a rank and that could never happen: the chair would read filled
 * and the house would stop looking for a real head forever.
 */

import { isElderRank } from '../cultivation/leadership.js';
import { whoDecidesIn } from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import type { WorldState } from './world-state.js';
import type { ObligationRecord } from '../social/grudges.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { byStanding, meritNeededFor, type HouseAndItsPeople } from './promotion-inside-a-house.js';

/** The tag a covering elder carries, suffixed with the house they cover. */
export const COVERING_THE_CHAIR = 'covering-the-chair';

/** The tag this person would carry while covering for this house. */
export function coveringTag(houseId: string): string {
    return `${COVERING_THE_CHAIR}:${houseId}`;
}

export interface AnElderWhoCouldCover {
    id: string;
    rankIndex: number;
}

export interface WhoCovers {
    /** The elder covering, or null where nobody does and the house carries on. */
    npcId: string | null;
    /** How many of the band the room was asked about before one was agreed. */
    considered: number;
}

/**
 * Who covers a house with nobody in the chair.
 *
 * `band` is handed in ALREADY ORDERED by the caller, in the order the house's
 * own promotion pass ranks people - realm, then contribution, then loyalty. This
 * does not re-rank them, because a second ordering here would be a second
 * opinion about who a house prefers, and the house has one.
 *
 * Pure. No RNG and no write.
 */
export function whoCoversTheChair(input: {
    /** Everybody alive on the house's roll, with their rung. */
    roll: readonly AnElderWhoCouldCover[];
    rankCount: number;
    /** The elder band, already ordered by the house's own preference. */
    band: readonly AnElderWhoCouldCover[];
    ledger?: readonly ObligationRecord[];
}): WhoCovers {
    const top = input.rankCount - 1;
    if (top < 1) return { npcId: null, considered: 0 };
    // Somebody is in the chair. Nothing to cover.
    if (input.roll.some(p => p.rankIndex >= top)) return { npcId: null, considered: 0 };

    let considered = 0;
    for (const candidate of input.band) {
        if (candidate.rankIndex >= top) continue;
        if (!isElderRank(candidate.rankIndex, input.rankCount)) continue;
        considered++;
        if (theRoomAgreesTo(candidate.id, input)) {
            return { npcId: candidate.id, considered };
        }
    }
    // Outcome 3. Either the band is empty or the room would have none of them,
    // and a house with no head is a house that operates as is.
    return { npcId: null, considered };
}

/**
 * Whether the room would have this person answer for the house.
 *
 * The candidate's own voice is left out - somebody agreeing to their own
 * elevation is not assent - and the rest are weighted as `whoDecidesIn` weights
 * them, by seniority.
 *
 * ── AND A HOUSE WITH ONE ELDER LEFT HAS NO ROOM TO CONVENE ───────────────
 *
 * So that elder takes it. The design owner: *"if there's nobody else, well,
 * they're in charge... but as the sole elder they make the calls, lol."*
 * Refusing here read "the room declined" off a room that does not exist, which
 * is a different sentence and a false one. Assent means something only where
 * there is somebody else to give it.
 *
 * The people on the rungs below do have opinions about it, and nothing in this
 * tree currently turns that into a grievance - there is no pass watching who
 * answers for a house. Left undone deliberately rather than invented here.
 */
export function theRoomAgreesTo(
    candidateId: string,
    input: {
        roll: readonly AnElderWhoCouldCover[];
        rankCount: number;
        ledger?: readonly ObligationRecord[];
    }
): boolean {
    const room = whoDecidesIn({
        roll: input.roll,
        rankCount: input.rankCount,
        asking: candidateId,
        ...(input.ledger === undefined ? {} : { ledger: input.ledger })
    }).filter(say => say.id !== candidateId);

    // The sole elder. Nobody to convene, so they are in charge.
    if (room.length === 0) return true;

    let weighted = 0;
    let weight = 0;
    for (const say of room) {
        weighted += say.reading * say.weight;
        weight += say.weight;
    }
    return weight > 0 && weighted / weight > 0;
}

/**
 * The yearly pass: every house with nobody in the chair finds a cover, or does
 * not.
 *
 * Runs after the promotions, because outcome 2 is only reached where outcome 1
 * produced nobody - a house that just seated a proper head has no empty chair
 * for this to read.
 *
 * Returns how many houses are being covered after the pass, which is the number
 * worth watching: it should be a minority of houses and it should move.
 */
export function coverTheEmptyChairs(state: WorldState, day: number): number {
    const onDay = Math.floor(day);
    let covering = 0;

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        const rankCount = house.ranks.length;
        if (rankCount < 2) continue;

        const members = state.npcs.filter(
            npc => npc.status === 'alive' && npc.factionId === house.id && npc.factionRankIndex >= 0
        );
        const roll = members.map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex }));

        // The house's own preference, not a second opinion. `needed` is read at
        // the HEAD's rung because that is the chair being covered, and it scales
        // the loyalty term the same way the promotion pass scales it.
        const forTheLoyaltyRead: HouseAndItsPeople = {
            memberIds: new Set(members.map(m => m.id)),
            brokeTheirWordToIt: new Set((state.obligations ?? [])
                .filter(o => o.kind === 'oath' && o.subjectId === house.id
                    && o.settlement?.resolution === 'broken')
                .map(o => o.holderId))
        };
        const needed = meritNeededFor(rankCount - 1);
        // THE GRAND ELDER FIRST, THEN THE HOUSE'S OWN ORDER. The grand elder is
        // the designated successor and the seat below the chair, so they are the
        // obvious hand - and measurement says they are usually the person
        // promotion just refused, being short of the head's contribution bar
        // while standing directly under it. That is this pass's whole case: the
        // successor, not yet qualified, holding things together until they are.
        // Everybody below them keeps the `byStanding` order exactly.
        const grandSeat = rankCount - 2;
        const band = [...members]
            .filter(npc => isTheWorldsToMove(npc))
            .sort((a, b) =>
                Number(b.factionRankIndex === grandSeat) - Number(a.factionRankIndex === grandSeat)
                || byStanding(a, b, house.id, needed, forTheLoyaltyRead))
            .map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex }));

        const decided = whoCoversTheChair({ roll, rankCount, band, ledger: state.obligations ?? [] });
        if (decided.npcId !== null) covering++;
        writeTheCover(state, house.id, members, decided.npcId, onDay);
    }
    return covering;
}

/**
 * Put the tag on whoever covers and take it off everybody else in this house.
 *
 * Both halves every year, because a cover ENDS - the house seats a real head, or
 * the coverer dies, or the room turns against them - and a tag that is only ever
 * written leaves a house with two people answering for it and no year in which
 * that became true.
 */
function writeTheCover(
    state: WorldState,
    houseId: string,
    members: readonly NpcRecord[],
    coverId: string | null,
    onDay: number
): void {
    const tag = coveringTag(houseId);
    for (const npc of members) {
        const has = npc.tags.includes(tag);
        const should = npc.id === coverId;
        if (has === should) continue;
        if (!isTheWorldsToMove(npc)) continue;
        const i = state.npcs.findIndex(n => n.id === npc.id);
        if (i < 0) continue;
        state.npcs[i] = {
            ...state.npcs[i],
            tags: should
                ? [...state.npcs[i].tags, tag]
                : state.npcs[i].tags.filter(t => t !== tag),
            updatedOnDay: onDay
        };
    }
}
