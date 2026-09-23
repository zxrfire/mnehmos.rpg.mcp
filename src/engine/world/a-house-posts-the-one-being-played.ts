/**
 * A house puts the player on a posting, looks in on them there, and tops up
 * their slips.
 *
 * The world's own people are posted by `applyPostings` and looked in on by
 * `wordFromThePeopleAway`, and both skip the player's row by design: that row
 * stands nowhere, and the passes that decide something FOR a cultivator do not
 * decide it for the one being played (`the-player-as-a-row-the-world-can-invite.ts`).
 * So nothing ever put the player on a posting, and the talisman pass said so in
 * its own header: *"The player is never looked in on, because nothing puts the
 * player on a posting."*
 *
 * ── A POST IS RELIEVED, NOT INVENTED ─────────────────────────────────────
 *
 * The house doc's ruling on a rotation: *"it's one but not necessarily the same
 * one... they never advance cuz they get swapped out for the next disciple."*
 * The post is the continuous thing. So the posts a house can put the player on
 * are the posts it already keeps, read off the people it has stationed, and
 * the player is sent to relieve somebody whose tour is running out. Nothing
 * here re-derives which towns a house keeps somebody in; the stationed rows are
 * that answer. A tour's length is the tour being relieved, for the same reason.
 *
 * WHO IS SPARED is the rule `applyPostings` reads: somebody who holds no room of
 * the house. And a posting is the exception among juniors - *"most outer and
 * inner disciples don't, only few do"* - so the house picks the player as one
 * of the members it could spare, once per tour that ends, off a stream keyed to
 * that tour.
 *
 * ── THE LOOK-IN ──────────────────────────────────────────────────────────
 *
 * On the cadence the world's people are looked in on (`aLookInFallsDue`), with
 * the visitor chosen by the same two reads (`whatTheHouseCanSpare`,
 * `whoTheHouseCanSend`) over the `sending-to-look-in-on-a-posting` reason, and
 * the slips cut from the treasury's blanks by somebody at the seat who can cut
 * (`whoCutsPairsAtTheSeat`). The visitor is put where the player is posted, out
 * on the ordinary term, so they can be talked to.
 *
 * ── NOT HANDLED HERE, AND SAID ───────────────────────────────────────────
 *
 * `applyPostings` counts a post as held by who is `stationed` there, and it
 * reads the whole roll - the player's world row included. So a post the player
 * holds counts as held the moment their own row says they are standing at it,
 * which is {@link theOneBeingPlayedStandsAtThisPost}. The caller that puts them
 * on the posting writes it; nothing in the world's own passes moves the player's
 * row (`isTheWorldsToMove`), so nothing takes it off them either.
 */

import { getSendingReason } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { theRoomsThisHouseHas } from '../social-leverage/authority-for-an-order.js';
import { whoIsInChargeOfWhat } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { keepTheTwins, takeOffTheStack, howManyTheHouseHas } from './a-communication-talisman-carries-word-home.js';
import { whereThisHouseBurnsItsLamps } from './a-recruit-is-given-their-lamp-at-the-house.js';
import {
    isAwayOnSomething,
    isTheWorldsToMove,
    setLocation,
    whereTheyGoBackTo,
    type NpcRecord
} from './npc-state.js';
import {
    A_STACK_A_HOUSE_HANDS_OUT,
    theDisciplesPostedToInternalAffairs,
    whoCutsPairsAtTheSeat
} from './what-a-house-hears-from-its-people-away.js';
import {
    whatTheHouseCanSpare,
    whoTheHouseCanSend,
    type OnTheRollForAnErrand
} from './who-goes-out-for-a-house-and-what-comes-back.js';
import { stagnationYearsForOrdinal } from '../../schema/cultivation.js';
import {
    A_CONTEST_EVERY,
    NEVER_OFTENER_THAN_YEARS
} from './a-conclave-seat-is-won-in-a-tournament.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** The posting a house would put the player on, relieving somebody at it. */
export interface APostToTakeOver {
    houseId: string;
    houseName: string;
    townId: string;
    townName: string;
    /** Empty for a post nobody is standing in, which is what an office's is. */
    relievedId: string;
    relievedName: string;
    /** The day the tour being relieved runs out, which is when the post needs somebody. */
    wantedByDay: number;
    /** Days a tour at this post runs: the one being relieved. */
    termDays: number;
    /** True where the post is a room of the house's own compound rather than a town. */
    insideTheWalls: boolean;
}

/**
 * How long a junior's tour under an office runs.
 *
 * The house doc's rule for a junior is that they leave a posting by OUTGROWING
 * it, so the term is read off the ladder rather than chosen: a quarter of the
 * years the ladder credits at their own rung, which is the same fraction and the
 * same reason the conclave's cycle uses (`A_CONTEST_EVERY` - four of them inside
 * a career at that height), floored the same way so nothing becomes a season.
 */
export function howLongATourUnderAnOfficeRuns(ordinal: number): number {
    const credited = stagnationYearsForOrdinal(ordinal);
    return Math.max(NEVER_OFTENER_THAN_YEARS, Math.round(credited * A_CONTEST_EVERY)) * DAYS_PER_YEAR;
}

/**
 * The house's own Internal Affairs, where it keeps a roll and nobody serves
 * under the office. A post inside the walls: the disciples of that office are
 * what cut the house's slips for its disciples, and there are none anywhere.
 */
function theOfficeItHasNobodyUnder(
    state: Pick<WorldState, 'npcs' | 'factions' | 'locations'>,
    house: FactionRecord,
    input: { playerId: string; ordinal: number; today: number }
): APostToTakeOver | null {
    const hall = whereThisHouseBurnsItsLamps(state.locations, house.id);
    if (hall === null) return null;
    if (theDisciplesPostedToInternalAffairs(state, house.id).length > 0) return null;
    const room = state.locations.find(l => l.id === hall);
    if (!room) return null;
    const termDays = howLongATourUnderAnOfficeRuns(input.ordinal);
    return {
        houseId: house.id,
        houseName: house.name,
        townId: room.id,
        townName: room.name,
        relievedId: '',
        relievedName: '',
        // Answered by the day the tour would have run to, which is what every
        // other duty's due day is (`dutyFromOffer`).
        wantedByDay: input.today + termDays,
        termDays,
        insideTheWalls: true
    };
}

/**
 * The post this house would send the player to today, or null.
 *
 * Null where the player holds a room, where no tour at any of the house's posts
 * runs out within the year, or where the house picks somebody else to relieve
 * it. The pick is one draw per tour, so asking every turn asks the same question.
 */
export function aPostTheHouseWouldSendThemTo(
    state: Pick<WorldState, 'seed' | 'npcs' | 'factions' | 'locations'>,
    input: { houseId: string; playerId: string; rankIndex: number; ordinal: number; today: number }
): APostToTakeOver | null {
    const house = state.factions.find(f => f.id === input.houseId && f.dissolvedOnDay === null);
    if (!house || house.seatLocationId === null || house.ranks.length === 0) return null;
    const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id && n.id !== input.playerId);

    const idle = roll.filter(n => n.activity === null && isTheWorldsToMove(n));
    const rooms = whoIsInChargeOfWhat({
        rooms: theRoomsThisHouseHas(state.locations, house.id),
        roll: [...idle, { id: input.playerId, factionRankIndex: input.rankIndex }]
            .map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
        rankCount: house.ranks.length
    });
    const holding = new Set(rooms.map(r => r.holderId).filter((id): id is string => id !== null));
    if (holding.has(input.playerId)) return null;

    const spareNow = idle.filter(n => !holding.has(n.id)).length;
    const due = roll
        .filter(n => n.activity?.kind === 'stationed' && n.locationId !== null)
        .filter(n => {
            const until = n.activity!.untilDay;
            return until !== null && until !== undefined && until > input.today && until - input.today <= DAYS_PER_YEAR;
        })
        .sort((a, b) => a.activity!.untilDay! - b.activity!.untilDay! || (a.id < b.id ? -1 : 1))[0];

    // ── A RELIEF COMES FIRST, BECAUSE IT HAS A DAY ON IT ─────────────────
    //
    // A town's watch needs somebody by the day its tour ends. The office's own
    // vacancy has no date - nobody is under it in any house in the world - so it
    // is what the house puts to a spare member when nothing else is pressing,
    // and it is drawn once a year rather than every turn for the same reason the
    // relief is drawn once a tour: asking again is not a second question.
    if (!due) {
        const year = Math.floor(input.today / DAYS_PER_YEAR);
        if (forStream(state.seed, 'a-posting-under-an-office', house.id, year).next() >= 1 / (spareNow + 1)) {
            return null;
        }
        return theOfficeItHasNobodyUnder(state, house, {
            playerId: input.playerId, ordinal: input.ordinal, today: input.today
        });
    }

    const spare = spareNow;
    const until = due.activity!.untilDay!;
    if (forStream(state.seed, 'a-posting-for-the-one-being-played', house.id, due.id, until).next() >= 1 / (spare + 1)) {
        return null;
    }
    const town = state.locations.find(l => l.id === due.locationId);
    if (!town) return null;
    return {
        houseId: house.id,
        houseName: house.name,
        townId: town.id,
        townName: town.name,
        relievedId: due.id,
        relievedName: due.name,
        wantedByDay: until,
        termDays: Math.max(DAYS_PER_YEAR, until - due.activity!.sinceDay),
        insideTheWalls: false
    };
}

/**
 * The person relieved goes home: their tour ends today, and the world's own
 * pass brings them back and counts what they served. False where they are no
 * longer at that post.
 */
export function theyAreRelieved(state: WorldState, input: { relievedId: string; townId: string; today: number }): boolean {
    const at = state.npcs.findIndex(n => n.id === input.relievedId);
    const npc = state.npcs[at];
    const doing = npc?.activity;
    if (!npc || npc.status !== 'alive' || !doing || doing.kind !== 'stationed' || npc.locationId !== input.townId) return false;
    if (doing.untilDay !== null && doing.untilDay !== undefined && doing.untilDay <= input.today) return false;
    state.npcs[at] = { ...npc, activity: { ...doing, untilDay: input.today }, updatedOnDay: input.today };
    return true;
}

/**
 * The player's world row stands at the post they took.
 *
 * WHAT IT IS FOR: `applyPostings` fills a post nobody is stationed at, and the
 * player's row stood wherever it stood - so the world posted one of the house's
 * own people to a town the player was already holding, and the house paid for
 * two. Written by whoever hands the player the posting, and cleared by
 * {@link theOneBeingPlayedLeavesThePost} when the tour ends.
 */
export function theOneBeingPlayedStandsAtThisPost(
    state: WorldState,
    input: { playerId: string; townId: string; houseId: string; sinceDay: number; untilDay: number }
): boolean {
    const at = state.npcs.findIndex(n => n.id === input.playerId);
    const npc = state.npcs[at];
    if (!npc || npc.status !== 'alive' || npc.factionId !== input.houseId) return false;
    state.npcs[at] = {
        ...setLocation(npc, input.townId, input.sinceDay),
        activity: {
            kind: 'stationed',
            note: 'On a posting for their house.',
            withIds: [],
            sinceDay: input.sinceDay,
            untilDay: input.untilDay,
            returnTo: whereTheyGoBackTo(npc)
        },
        updatedOnDay: input.sinceDay
    };
    return true;
}

/** And the post is theirs no longer: the tour ended, or they walked off it. */
export function theOneBeingPlayedLeavesThePost(
    state: WorldState,
    input: { playerId: string; today: number }
): boolean {
    const at = state.npcs.findIndex(n => n.id === input.playerId);
    const npc = state.npcs[at];
    if (!npc || npc.activity?.kind !== 'stationed') return false;
    state.npcs[at] = { ...npc, activity: null, updatedOnDay: input.today };
    return true;
}

/**
 * Pairs cut for the player from the house's blanks, and their twins put in the
 * hall. Returns how many pairs; the caller puts the halves in the pouch.
 *
 * Up to a stack, less what they already carry, and only where somebody at the
 * seat can cut and the treasury has the blanks.
 */
export function pairsCutForThem(
    state: WorldState,
    input: { houseId: string; holderId: string; holderName: string; carrying: number; today: number }
): number {
    const house = state.factions.find(f => f.id === input.houseId && f.dissolvedOnDay === null);
    if (!house || house.seatLocationId === null) return 0;
    const members = state.npcs.filter(n => n.factionId === house.id);
    if (whoCutsPairsAtTheSeat(state, members, house.seatLocationId) === null) return 0;
    const short = Math.max(0, A_STACK_A_HOUSE_HANDS_OUT - input.carrying);
    const pairs = Math.min(short, Math.floor(howManyTheHouseHas(state.objects, house.id) / 2));
    if (pairs === 0) return 0;
    takeOffTheStack(state.objects, { houseId: house.id, holderId: null, count: 2 * pairs });
    keepTheTwins(state.objects, {
        houseId: house.id,
        houseName: house.name,
        senderId: input.holderId,
        senderName: input.holderName,
        count: pairs,
        hallLocationId: whereThisHouseBurnsItsLamps(state.locations, house.id) ?? house.seatLocationId,
        onDay: input.today
    });
    return pairs;
}

/**
 * Somebody the house can spare walks out to where the player is posted, and is
 * standing there. Null where it has nobody to send, which is the same answer the
 * world's own look-in gives and is not made up for later.
 */
export function theHouseSendsSomebodyToLookIn(
    state: WorldState,
    input: { houseId: string; postedId: string; postedName: string; townId: string; today: number }
): NpcRecord | null {
    const house = state.factions.find(f => f.id === input.houseId && f.dissolvedOnDay === null);
    const reason = getSendingReason('sending-to-look-in-on-a-posting');
    if (!house || house.seatLocationId === null || !reason) return null;
    const roster: OnTheRollForAnErrand[] = state.npcs
        .filter(n => n.status === 'alive' && n.factionId === house.id && isTheWorldsToMove(n) && n.id !== input.postedId)
        .map(n => ({
            id: n.id,
            name: n.name,
            ordinal: n.cultivation.realmOrdinal,
            rankIndex: n.factionRankIndex,
            locationId: n.locationId,
            committedUntilDay: n.activity && isAwayOnSomething(n.activity.kind) ? n.activity.untilDay ?? null : null
        }));
    const spare = whatTheHouseCanSpare({
        roster, rankCount: house.ranks.length, seatLocationId: house.seatLocationId, onDay: input.today
    });
    const going = whoTheHouseCanSend({ ceilingOrdinal: reason.ceilingOrdinal, hands: reason.hands }, spare.free)[0];
    if (!going) return null;
    const at = state.npcs.findIndex(n => n.id === going.id);
    const visitor = state.npcs[at];
    if (!visitor) return null;
    state.npcs[at] = {
        ...setLocation(visitor, input.townId, input.today),
        activity: {
            kind: 'out_with_a_party',
            note: `Out for ${house.name}, looking in on ${input.postedName}.`,
            withIds: [],
            sinceDay: input.today,
            untilDay: input.today + reason.days,
            returnTo: whereTheyGoBackTo(visitor)
        }
    };
    return state.npcs[at]!;
}
