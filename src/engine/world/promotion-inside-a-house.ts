/**
 * Rising through a house's ranks, and finding out you cannot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `factionRankIndex` was written at seeding and at recruitment and never
 * advanced again. Every runtime write in the whole simulation set it to 0
 * (joining), -1 (expulsion), or a leadership succession. There was no promotion
 * anywhere, and `history.ts` had carried a `'promotion'` fact kind the entire
 * time with nothing to file it.
 *
 * Measured over five centuries:
 *
 *     seeding   in a house 314   ranks {0:115, 1:87, 2:37, 3:19, 4:32, 5:24}
 *     500y      in a house 364   ranks {0:340, 1:23, 5:1}
 *
 * The pyramid did not decay - it inverted into a slab. And because
 * `shelfReach(0, …)` entitles a rank-0 member to exactly one book however deep
 * their house's shelf is, 340 of 364 house members were permanently entitled to
 * the primer and nothing else. The book-ceiling histogram at year 500 was
 * `{0:239, 13:260, 17:3}`: nobody alive held a manual reaching past 17.
 *
 * This is the same failure as the one `refreshChosen` was written to fix, one
 * level up - a designation written only at world creation - and it was the real
 * reason the high band drained, not the shelf gaps.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PYRAMID IS SEATS, NOT A CURVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A house is not shaped like a pyramid because a distribution says so. It is
 * shaped like one because THERE ARE ONLY SO MANY SEATS at each rank, and the
 * seats are the constraint people actually feel. An outer disciple who has
 * earned promotion and cannot have it because the inner hall is full is in a
 * completely different situation from one who simply is not good enough, and
 * only the first of those produces a story.
 *
 * So promotion needs three things at once, and the interesting one is the last:
 *
 *   THE HEIGHT     `rankRealmBand` in `members.ts`, which is the EXISTING
 *                  authority on what a rank of a given house may stand at and
 *                  is already enforced against every seeded member by a catalog
 *                  test. It caps a rank at what the house can RELIABLY PRODUCE
 *                  plus a little headroom, not at what its strongest member
 *                  happens to be - which is the difference between a bar people
 *                  can clear and one they cannot.
 *   THE MERIT      among everybody who qualifies, the house takes the strongest.
 *                  Favour counts: the chosen are promoted over their seniors,
 *                  which is what being favoured MEANS.
 *   THE SEAT       and there has to be one. Ranks narrow sharply, and in a world
 *                  where a Nascent Soul elder lives eight hundred years, seats
 *                  at the top do not come free often. Nobody is promoted into a
 *                  full hall, however good they are.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THIS IS WHY YOU HAVE TO LEAVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The blockage is the point, not a side effect. A cultivator who has outgrown
 * their rank, cannot be promoted because the seats above them are held by people
 * who will not die for six centuries, and is therefore stuck on a book that
 * stopped carrying them years ago, has exactly one move: GO SOMEWHERE ELSE.
 *
 * That is the pressure the whole setting runs on. Staying where you were born
 * is the losing line, and it loses for a reason a player can see coming and act
 * on rather than a number quietly failing to rise. `blockedAt` reports it, so
 * the narrator can say it out loud before it costs somebody a century.
 */

import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import type { FactionRecord } from './world-state.js';
import type { WorldState } from './world-state.js';
import { rankRealmBand } from '../../data/cultivation/members.js';
import {
    howLoyalTheyAre,
    whatLoyaltyIsWorthHere
} from './how-loyal-somebody-is-to-their-house.js';
import { whatItCanPutOnTheGround } from './seeding.js';
import { meritWith } from './what-a-house-counts-in-somebodys-favour.js';
import { requiredContributionForRank } from '../cultivation/what-each-rung-of-a-house-ladder-requires.js';
import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { elderRungOf, isElderRank } from '../cultivation/leadership.js';
import { theRoomsThisHouseHas } from '../social-leverage/authority-for-an-order.js';
import { roomAuthorityOf } from './architecture.js';
import { howManyPeopleAHouseHas } from './how-many-people-a-house-has.js';
import { whoBrokeTheirWordTo } from './the-word-an-npc-gave.js';

/**
 * How many people a house will seat at each rank.
 *
 * Halving upward, floored at one. The top seat is exactly one, and filling it
 * when it stands empty is the succession.
 *
 * The bottom rank is uncapped. A house can always take another sweeper, and the
 * limit on its intake is what it can feed rather than how many stools it has.
 *
 * ── WHICH COUNT A RUNG IS SEATED AGAINST, WHICH IS TWO DIFFERENT RUNGS ───
 *
 * `a-house-and-who-is-in-it.md`: the bands are SAMPLED and the top is COMPLETE.
 * So the two halves of a ladder are not seated against the same number, and the
 * design owner ruled the distinction after it was measured both ways:
 *
 *   sampled rungs   outer, inner, core - the rungs the roll only samples. Their
 *                   seats come off the ROLL, because a slice of fifteen drawn
 *                   from a house of four hundred has to be seated against the
 *                   slice or nothing binds it. Measured with these reading the
 *                   real size instead (three seeds, 500 years): people on rung 0
 *                   fell 469 to 176 while rung 5 rose 105 to 452, and the wait
 *                   before promotion fell from 25 years to 4. The pyramid turned
 *                   over, because only realm and merit were left holding it.
 *   the elder band  and above - the rungs the roll holds COMPLETELY. These read
 *                   the house's real size (`how-many-people-a-house-has.ts`),
 *                   which is what a house of hundreds carrying nine elders
 *                   actually looks like, and in practice they are bound by the
 *                   house's offices anyway (`assessPromotions`).
 *
 * And the two chairs that are one person stay one person: the head, and the
 * grand elder where a house has one - `rosterByRung` says the same thing about
 * the same two rungs, and a narrowing that produced six grand elders was this
 * function disagreeing with it.
 */
export function seatsAtRank(
    rankIndex: number,
    rankCount: number,
    members: number,
    abundance = 0,
    peopleTheHouseHas = members
): number {
    if (rankIndex <= 0) return Number.MAX_SAFE_INTEGER;
    // THE TOP SEAT IS ONE SEAT, and a seat that is held has no room in it - so
    // this can never install a weaker head over a living master. It fills only
    // when the head is gone: a succession, by the strongest of the rung below
    // who clears the head's own bar. It was 0, on the grounds that "the
    // machinery for that lives elsewhere", and nothing anywhere did it. Measured
    // over 2,500 years on one seed: the head rung took in nobody by promotion,
    // lost about 0.18 people per house per century, and the 38 catalog houses
    // fell from 38 heads to 0 while every other rung held between 0.7 and 0.95
    // filled. Heads survived only in houses a splinter had just founded.
    if (rankIndex >= rankCount - 1) return rankIndex === rankCount - 1 ? 1 : 0;
    if (rankIndex >= rankCount) return 0;
    // THE GRAND ELDER IS ONE SPOT. `offices-and-succession.md`: first among
    // equals of the elders, one spot only, and it is where a head retires to.
    // `rosterByRung` has always seated it as one chair; the narrowing below
    // seated it as a share, which at the real size came out at six.
    if (rankIndex === rankCount - 2 && rankIndex > elderRungOf(rankCount)) return 1;
    // WHERE RESOURCES ARE NOT SCARCE, NEITHER IS PROMOTION.
    //
    // The pyramid is made of seats, and seats are scarce because the things
    // that fill them are: stipends, quarters, a share of the vein, a share of
    // an elder's attention. A house with an abundance of all of it has no
    // reason to cap its own inner ranks, and promotion there falls back on the
    // only remaining question, which is whether somebody is good enough.
    //
    // That is what makes the world's apex different from everybody else, and it
    // is not an exception written beside its name: it is the same formula
    // reading a much larger number. `abundance` runs 0..1 and comes off the
    // house's own production and holdings, so any house that got rich would
    // behave the same way, and any apex that lost its ground would stop.
    // Halving from a QUARTER of the house, not from half of it.
    //
    // Starting the narrowing at `2^rankIndex` let the first rank above the
    // bottom seat half the membership, which is not an inner circle, it is the
    // house. Measured with the correct promotion bar in place, rank 0 drained
    // below rank 1 - {0:69, 1:123, 2:71, ...} - a diamond rather than a
    // pyramid, because everybody qualified for the second rung and there was
    // room for them. The outer ranks have to stay the widest part of a house or
    // nothing is being selected for.
    const narrowing = Math.pow(2, (rankIndex + 1) * (1 - abundance));
    // The elder band is complete in the roll, so it is seated against the whole
    // house; every rung under it is a sample and is seated against the sample.
    const against = isElderRank(rankIndex, rankCount) ? peopleTheHouseHas : members;
    const share = against / narrowing;
    return Math.max(1, Math.floor(share));
}

/**
 * How far a house is from having to ration its own ranks, 0..1.
 *
 * What a house can put on the ground is the honest proxy, and a house whose own
 * people can make what it needs is not choosing between two disciples for one
 * stipend. Squared, so that abundance has to be near-total before it
 * meaningfully flattens a hierarchy - comfortable is not the same as limitless,
 * and only the very top of the world is limitless.
 *
 * This read `resources.production`, which was seeded at 0.5 for every house in
 * the world, so `abundance` was 0.3 everywhere and no house's hierarchy was
 * flatter than any other's - including the apexes this paragraph is about.
 */
export function abundanceOf(house: FactionRecord): number {
    const base = whatItCanPutOnTheGround(Number(house.resources.reliable_ordinal ?? 0));
    const veins = Number(house.resources.veins ?? 0);
    return Math.min(1, base * base * (veins > 0 ? 1.2 : 0.8));
}

/**
 * The height a rank expects, for a house the catalog does not know.
 *
 * FALLBACK ONLY - `rankRealmBand` is the authority for anything seeded. See
 * `whatAnInsiderMustStandAt`.
 *
 * Interpolated between what the house admits at and what its strongest member
 * actually stands at, so a high house's inner disciples are stronger than a
 * poor house's elders - which is true, is the reason anybody wants to move up,
 * and needs no table to say it.
 */
export function ordinalExpectedAt(
    rankIndex: number,
    rankCount: number,
    admissionOrdinal: number,
    powerOrdinal: number
): number {
    if (rankCount <= 1) return admissionOrdinal;
    const share = rankIndex / (rankCount - 1);
    return Math.round(admissionOrdinal + share * Math.max(0, powerOrdinal - admissionOrdinal));
}

/**
 * The height this rank of this house actually wants of somebody promoted to it
 * from inside: the world's own people in `assessPromotions`, and the player in
 * `handlePromote`, by the one rule.
 *
 * DEFERS TO `rankRealmBand`, which is the authority and was here first. I wrote
 * `ordinalExpectedAt` below without checking, and it was a second opinion beside
 * a complete system - the exact failure this project keeps having. Measured
 * across the whole catalog, 148 of 148 rank bars came out higher under mine,
 * by a mean of 8.8 rungs, and 33 of them landed ABOVE the authority's own
 * ceiling for that rank, so a promotion under my rule would have put somebody in
 * a state the catalog test rejects for seeded members.
 *
 * The substantive difference is which ceiling the ladder is stretched between.
 * Mine interpolated up to `powerOrdinal` - the house's strongest member -
 * where `rankRealmBand` stops at what the house can reliably PRODUCE. Those two
 * are twelve rungs apart on average, and the gap is a resource statement: a
 * house at 36 that can only make a 28 has the books and the master and cannot
 * supply the materials. Pricing its elder seats at 36 asks its disciples to
 * reach a height the house itself cannot take them to.
 *
 * Falls back to interpolation only for a faction the catalog does not know,
 * which is a runtime splinter rather than a seeded house.
 */
export function whatAnInsiderMustStandAt(
    factionId: string,
    rankIndex: number,
    rankCount: number,
    admissionOrdinal: number,
    powerOrdinal: number
): number {
    return rankRealmBand(factionId, rankIndex)?.minOrdinal
        ?? ordinalExpectedAt(rankIndex, rankCount, admissionOrdinal, powerOrdinal);
}

/**
 * How far past a rung's bar somebody from OUTSIDE must stand to be seated on it.
 *
 * Ruled by the design owner: *"the bar for hiring an external elder is higher
 * than an internal promotion."* An insider is promoted at the bar (`whatAnInsiderMustStandAt`)
 * with the rung's merit behind them (`meritNeededFor`). Somebody taken in above
 * the bottom rung has served this house not at all, so the height has to stand
 * in for the service: a realm's width of ordinals past the same bar.
 *
 * Asked only of the house's lowest elder rung in play: the owner ruled that
 * somebody from outside joins at the bottom or as an external elder, and
 * nothing between (`entry-offer.ts` for the door, `a-house-takes-in-an-elder-
 * from-outside.ts` for the world's own houses). Whether the house wants them at
 * all is the council's reading at the door and not a second figure here.
 */
export const AN_OUTSIDER_STANDS_PAST_THE_BAR_BY = 4;

/** The ordinal somebody from outside must stand at to be seated at this rung. 0 at the bottom. */
export function whatAnOutsiderMustStandAt(
    factionId: string,
    rankIndex: number,
    rankCount: number,
    admissionOrdinal: number,
    powerOrdinal: number
): number {
    if (rankIndex <= 0) return 0;
    return whatAnInsiderMustStandAt(factionId, rankIndex, rankCount, admissionOrdinal, powerOrdinal)
        + AN_OUTSIDER_STANDS_PAST_THE_BAR_BY;
}

export interface Promotion {
    npcId: string;
    factionId: string;
    fromRank: number;
    toRank: number;
    /**
     * What put them ahead of the first person left standing: a whole realm, the
     * house's count of their service, or only the rung. `uncontested` when
     * nobody who qualified was left behind.
     */
    decidedBy: 'realm' | 'merit' | 'loyalty' | 'ordinal' | 'uncontested';
    /** True for an elder seated past the house's offices. */
    withoutAnOffice: boolean;
}

/**
 * Why somebody who has outgrown their rank is still standing in it.
 *
 *   no_seat                  the rung is full and it does not grow
 *   outranked                there was a seat, and somebody ahead took it
 *   not_enough_merit         tall enough, and has not served the house enough
 *   no_room_without_office   good enough to be an elder with no office, and the
 *                            house already carries as many of those as it will
 */
export type BlockedReason =
    | 'no_seat' | 'outranked' | 'not_yet' | 'not_enough_merit' | 'no_room_without_office';

export interface Blocked {
    npcId: string;
    factionId: string;
    atRank: number;
    reason: BlockedReason;
    /**
     * The realm bar of the rung they cannot have, which they stand at or past.
     * How far past it is part of how hard being held back presses on somebody:
     * `being-held-back-in-a-house.ts`.
     */
    bar: number;
}

interface HouseView {
    house: FactionRecord;
    members: NpcRecord[];
    atRank: number[];
}

function viewOf(state: WorldState): Map<string, HouseView> {
    const byFaction = new Map<string, HouseView>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId || npc.factionRankIndex < 0) continue;
        let v = byFaction.get(npc.factionId);
        if (!v) {
            const house = state.factions.find(f => f.id === npc.factionId);
            if (!house || house.dissolvedOnDay !== null) continue;
            v = { house, members: [], atRank: new Array(house.ranks.length).fill(0) };
            byFaction.set(npc.factionId, v);
        }
        v.members.push(npc);
        const r = Math.min(npc.factionRankIndex, v.atRank.length - 1);
        v.atRank[r]++;
    }
    return byFaction;
}

/**
 * Everybody a house would raise this year, and everybody it cannot.
 *
 * Pure: it decides and reports, and the caller writes. Both halves are returned
 * because the ones it CANNOT raise are the more useful output - they are the
 * people about to leave.
 */
export function assessPromotions(state: WorldState): {
    promotions: Promotion[];
    blocked: Blocked[];
} {
    const promotions: Promotion[] = [];
    const blocked: Blocked[] = [];

    for (const { house, members, atRank } of viewOf(state).values()) {
        const rankCount = house.ranks.length;
        // The roll, once, for the loyalty read: who somebody serves beside is
        // what their ties to the house are read against.
        const roll = {
            memberIds: new Set(members.map(m => m.id)),
            // And who gave this house their word and did not keep it, which is
            // a ceiling on how loyal anybody reads to it. The world's ledger:
            // `the-word-an-npc-gave.ts`.
            brokeTheirWordToIt: whoBrokeTheirWordTo(state, house.id)
        };
        const admission = Number(house.resources.admission_ordinal ?? 0);
        const power = Number(house.resources.power_ordinal ?? admission);

        // Consider each rank from the top down, so a seat freed by promoting
        // somebody up is available to the person below them in the same pass.
        // A house does not wait a year between filling two links of one chain.
        const abundance = abundanceOf(house);
        // BOTH COUNTS, and `seatsAtRank` decides which rung reads which: the
        // sampled rungs against the roll, the elder band against the house.
        const peopleItHas = howManyPeopleAHouseHas(state, house.id);
        for (let rank = rankCount - 1; rank >= 1; rank--) {
            const seats = seatsAtRank(rank, rankCount, members.length, abundance, peopleItHas);
            const bar = whatAnInsiderMustStandAt(house.id, rank, rankCount, admission, power);

            const tall = members
                .filter(m => m.factionRankIndex === rank - 1)
                .filter(m => m.cultivation.realmOrdinal >= bar)
                // NOT THE PLAYER'S ROW. It holds a seat where it stands, but
                // the house raises the player only when asked, and
                // `applyPromotions` refuses to write it. Left in, a qualified
                // player took the room here, was never written, and the seat
                // stood empty that year while the next candidate was told they
                // had been outranked.
                .filter(m => isTheWorldsToMove(m));

            // THE TWO MINIMUMS ARE GATES, BEFORE ANY ORDER. Somebody a whole
            // realm up who has not served does not qualify at all.
            const needed = meritNeededFor(rank);
            for (const m of tall) {
                if (meritWith(m, house.id) >= needed) continue;
                blocked.push({ npcId: m.id, factionId: house.id, atRank: rank - 1, reason: 'not_enough_merit', bar });
            }
            const candidates = tall
                .filter(m => meritWith(m, house.id) >= needed)
                .sort((a, b) => byStanding(a, b, house.id, needed, roll));
            if (candidates.length === 0) continue;

            // ── THE ELDER BAND SEATS AS MANY WITH AN OFFICE AS THERE ARE OFFICES ──
            //
            // An office is an elder with a posting, and the postings are the
            // office rooms `whoIsInChargeOfWhat` deals, one to a person, among
            // everybody at an elder rung. So the band's seats with an office are
            // the rooms left after the posts above it. A house with no rooms
            // built (a splinter, before it has a compound) has nothing to count
            // and keeps the halving seats.
            const band = isElderBand(rank, rankCount);
            const offices = band ? officesOf(state, house.id) : 0;
            const aboveBand = band ? atRank.slice(rank + 1).reduce((n, x) => n + x, 0) : 0;
            const withOffice = band && offices > 0 ? Math.max(0, offices - aboveBand) : seats;
            const room = Math.max(0, withOffice - atRank[rank]);
            const withoutOffice = band && offices > 0 ? Math.max(0, atRank[rank] - withOffice) : 0;
            let roomWithoutOffice = band && offices > 0
                ? Math.max(0, noOfficeEldersAHouseCarries(offices) - withoutOffice)
                : 0;
            const barRealm = realmIndex(bar);

            for (let i = 0; i < candidates.length; i++) {
                const npc = candidates[i];
                const firstLeft = candidates[room] ?? null;
                if (i < room) {
                    promotions.push({
                        npcId: npc.id, factionId: house.id,
                        fromRank: rank - 1, toRank: rank,
                        decidedBy: whatDecidedIt(npc, firstLeft, house.id, needed, roll),
                        withoutAnOffice: false
                    });
                    atRank[rank]++;
                    atRank[rank - 1]--;
                    continue;
                }
                // REALLY GOOD: a whole major realm above the elder bar, with the
                // merit minimum already cleared above. Seated with no office,
                // up to what the house will carry.
                const reallyGood = band && offices > 0
                    && realmIndex(npc.cultivation.realmOrdinal) >= barRealm + 1;
                if (reallyGood && roomWithoutOffice > 0) {
                    promotions.push({
                        npcId: npc.id, factionId: house.id,
                        fromRank: rank - 1, toRank: rank,
                        decidedBy: 'realm',
                        withoutAnOffice: true
                    });
                    roomWithoutOffice--;
                    atRank[rank]++;
                    atRank[rank - 1]--;
                    continue;
                }
                blocked.push({
                    npcId: npc.id, factionId: house.id, atRank: rank - 1,
                    reason: reallyGood ? 'no_room_without_office' : room === 0 ? 'no_seat' : 'outranked',
                    bar
                });
            }
        }
    }
    return { promotions, blocked };
}

/**
 * The merit a rung asks for, in contribution: the same curve a player's
 * promotion reads, so one rule measures both.
 */
export function meritNeededFor(rankIndex: number): number {
    return requiredContributionForRank(rankIndex);
}

/**
 * How many elders with no office a house will carry, off how many offices it has.
 *
 * A house does not keep many of those - a title and a stipend for somebody it
 * does not put in charge of anything - so a quarter of its offices, and always
 * room for one exceptional person.
 */
export const NO_OFFICE_ELDERS_PER_OFFICE = 0.25;

export function noOfficeEldersAHouseCarries(offices: number): number {
    return Math.max(1, Math.floor(offices * NO_OFFICE_ELDERS_PER_OFFICE));
}

/** The office rooms a house has built. */
function officesOf(state: WorldState, houseId: string): number {
    return theRoomsThisHouseHas(state.locations, houseId)
        .filter(purpose => roomAuthorityOf(purpose).office).length;
}

/**
 * Whether this rung is the elder band: an elder rung below the posts.
 *
 * The posts are the head and, where the ladder has room for one above the
 * elders, the grand elder - the reading `rosterByRung` in `leadership.ts` takes.
 */
function isElderBand(rank: number, rankCount: number): boolean {
    if (!isElderRank(rank, rankCount) || rank >= rankCount - 1) return false;
    const grand = rankCount - 2;
    const hasGrand = grand > Math.min(elderRungOf(rankCount), rankCount - 1);
    return !(hasGrand && rank === grand);
}

function realmIndex(ordinal: number): number {
    return REALM_TIERS.indexOf(realmForOrdinal(ordinal));
}

/**
 * What being chosen is worth, as merit, within a realm.
 *
 * The house has already decided about them, which is worth a rung's service in
 * the order it takes people. It orders; it does not open the merit gate, which
 * is service, and it never lifts anybody over a whole realm.
 */
function standingMerit(npc: NpcRecord, houseId: string, needed: number): number {
    return meritWith(npc, houseId) + (npc.tags.includes('chosen') ? Math.max(1, needed) : 0);
}

/**
 * And what the house makes of them, which is the third thing it weighs and the
 * weakest: loyalty, worth half of what being chosen is, read off who they are
 * and how they stand with the people they serve beside. Never a gate - the two
 * gates are above, and a whole realm still wins over all of it. See
 * `how-loyal-somebody-is-to-their-house.ts`.
 */
function loyaltyMerit(npc: NpcRecord, house: HouseAndItsPeople, needed: number): number {
    return whatLoyaltyIsWorthHere(howLoyalTheyAre(npc, {
        membersOfTheHouse: house.memberIds,
        brokeTheirWord: house.brokeTheirWordToIt?.has(npc.id) ?? false
    }), needed);
}

/** A house's roll as the loyalty read wants it: the ids, once. */
export interface HouseAndItsPeople {
    memberIds: ReadonlySet<string>;
    /** Who broke an oath sworn to this house. Absent where nobody has. */
    brokeTheirWordToIt?: ReadonlySet<string>;
}

/** Realm first, a whole realm wins; then merit; then loyalty; then the rung; then the id. */
export function byStanding(
    a: NpcRecord, b: NpcRecord, houseId: string, needed: number, house: HouseAndItsPeople
): number {
    return realmIndex(b.cultivation.realmOrdinal) - realmIndex(a.cultivation.realmOrdinal)
        || standingMerit(b, houseId, needed) - standingMerit(a, houseId, needed)
        || loyaltyMerit(b, house, needed) - loyaltyMerit(a, house, needed)
        || b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
        || a.id.localeCompare(b.id);
}

function whatDecidedIt(
    winner: NpcRecord,
    firstLeft: NpcRecord | null,
    houseId: string,
    needed: number,
    house: HouseAndItsPeople
): Promotion['decidedBy'] {
    if (firstLeft === null) return 'uncontested';
    if (realmIndex(winner.cultivation.realmOrdinal) !== realmIndex(firstLeft.cultivation.realmOrdinal)) {
        return 'realm';
    }
    if (standingMerit(winner, houseId, needed) !== standingMerit(firstLeft, houseId, needed)) return 'merit';
    if (loyaltyMerit(winner, house, needed) !== loyaltyMerit(firstLeft, house, needed)) return 'loyalty';
    return 'ordinal';
}

/**
 * Has this cultivator run out of house?
 *
 * True when they have met the bar for the next rank and are not going to get it
 * - the hall above them is full of people who are not leaving. This is the
 * moment the setting is built around, and it should be legible to the player
 * BEFORE they spend another sixty years finding out the hard way.
 */
export function blockedAt(state: WorldState, npc: NpcRecord): Blocked | null {
    if (!npc.factionId || npc.factionRankIndex < 0) return null;
    const { blocked } = assessPromotions(state);
    return blocked.find(b => b.npcId === npc.id) ?? null;
}
