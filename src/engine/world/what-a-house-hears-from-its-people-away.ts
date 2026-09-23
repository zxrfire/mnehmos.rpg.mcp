/**
 * What a house hears from its people away: the stacks it hands out, the person
 * it sends to look in on a posting, and the word that comes home on a
 * communication talisman.
 *
 * The design owner: *"people out on a sect have communication talismans"*, *"that
 * also gives a way for the people the sect stations out to report back"*, *"the
 * house sends people to give you more stack, check up on you, every once in a
 * while, if you are out in a posting"*, *"the recruiter burns a talisman and
 * informs the Internal Affairs Elder"*, and *"making them for the house IS a
 * meritous task"*.
 *
 * ── ONE PASS A YEAR, IN FOUR STEPS, EACH OFF SOMETHING ALREADY HERE ──────
 *
 *   (cut)        not here. A house whose treasury is below what it keeps posts
 *                cutting blanks on its board (`itsCommunicationTalismansRunLow`,
 *                and the reason's floor keeps it to Foundation or above).
 *                Somebody wholly free takes it as any notice and it lands when
 *                the term closes; and because it is a few days at home, somebody
 *                at the seat who is teaching or at the work of their rank can sit
 *                down to it too ({@link aSittingAtHomeIsTaken}), Internal Affairs
 *                disciples first. Either way the blanks land in the treasury
 *                through {@link whatCuttingForTheHouseLands}
 *   issued       whoever set out this year on a posting or with a party is cut
 *                pairs out of the treasury's blanks by somebody of the house at
 *                its seat who can cut: a half keyed to them, its twin to the hall
 *                where the lamps burn. With no blanks or nobody to cut them,
 *                somebody at Foundation or above cuts their own
 *   looked in on somebody on a posting, every
 *                {@link A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS} years from the
 *                day they were posted. One person the house can spare
 *                (`whatTheHouseCanSpare`, `whoTheHouseCanSend`) walks out on
 *                the ordinary `out_with_a_party` term, brings a fresh stack, and
 *                what they find is a fact the house holds: there and well, there
 *                and hurt, dead, or not there. That is how a house learns about
 *                somebody who never sent word
 *   reported     somebody away with a slip in reach sends word of what they saw
 *                before the house would otherwise have heard it
 *   recruits     a recruiter who owes the Internal Affairs Elder a report burns a
 *                slip to make it (`theHouseExpects`). One with no slip, or out
 *                of reach, owes it until they are home or a stack reaches them
 *
 * ── WHAT SOMEBODY AWAY SEES ──────────────────────────────────────────────
 *
 * Nothing new decides it. They were in it or saw it (`actors`, `witnessIds`), it
 * happened where they are standing, or it is being said out loud in their own
 * province on the day it could first have got to them (`isInTheAirFor` at
 * `DAYS_NEWS_TAKES`). And it is the house's business: {@link isThisHousesBusiness}.
 *
 * AND IT IS NEWS ONLY IF IT IS SOONER. The seat's own day is read the same way -
 * somebody of the house there saw it, it happened there, or it is in the air
 * there - and a slip is burnt only where the person away knows first. What
 * comes back from this pass says both days; the figures, over two seeds at two
 * hundred years, are in `scripts/probe-how-soon-a-house-hears-from-its-people-away.ts`.
 *
 * ── WHAT IS NOT HERE ─────────────────────────────────────────────────────
 *
 * A party's own dead are not reported early. `resolveSending` says who did not
 * come back and dates it the day the party is due, so there is no earlier day a
 * slip could carry. A call for help has nothing to answer it: `attemptRescue` in
 * `convergence.ts` exists and no pass calls it. The player is not looked in on by
 * this pass: their row stands nowhere, so their posting and its look-ins are read
 * after each turn instead (`a-house-posts-the-one-being-played.ts`).
 */

import {
    CUT_IN_A_SITTING,
    DAYS_A_SITTING_TAKES,
    THE_COMMUNICATION_TALISMAN,
    couldCutACommunicationTalisman
} from '../../data/cultivation/communication-talismans.js';
import { getSendingReason, type SendingReason } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { theReasonBehind, whatAHouseHasOnItsBoard } from '../encounters/what-a-house-has-on-its-board.js';
import {
    addToTheStack,
    burnACommunicationTalisman,
    howFarFromTheSeat,
    howManyTheHouseHas,
    isWordSentHome,
    takeAwayWhatAnswersToNobody,
    theStacksInHand,
    whoReadsTheHall,
    type TheStacksInHand
} from './a-communication-talisman-carries-word-home.js';
import { whereThisHouseBurnsItsLamps } from './a-recruit-is-given-their-lamp-at-the-house.js';
import {
    mastersGiveJadeToDisciplesTheyValue,
    theInternalAffairsElderMakesJadeForElders
} from './a-pair-of-communication-jade.js';
import { whatASlipIsWorth } from '../social-leverage/commissioning-a-craft.js';
import { THE_INTERNAL_AFFAIRS_ELDER } from './a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { theHouseExpects, theReportsTheyOwe } from './a-house-expects-somebody-it-took-on.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact, type HistoricalFact } from './history.js';
import { isBelowTheLid } from './layers.js';
import {
    isAwayOnSomething,
    isTheWorldsToMove,
    setLocation,
    whereTheyGoBackTo,
    type NpcRecord
} from './npc-state.js';
import { creditMerit, whatServiceIsWorth } from './what-a-house-counts-in-somebodys-favour.js';
import {
    DAYS_NEWS_TAKES,
    howFarOff,
    isInTheAirFor,
    regionOf,
    whereThisPersonIsStanding,
    type TellerStanding
} from './what-people-are-saying.js';
import {
    ALLIED_STANDING,
    RIVAL_STANDING,
    WENT_AND_CAME_BACK,
    WHERE_A_NEED_SENDS_YOU,
    WORTH_REPEATING,
    reasonsOpenTo,
    whatTheHouseCanSpare,
    whoTheHouseCanSend,
    type HouseAsItStands,
    type OnTheRollForAnErrand
} from './who-goes-out-for-a-house-and-what-comes-back.js';
import type { FactionRecord, WorldState } from './world-state.js';

/**
 * How many slips a house cuts for somebody when it sends them out, each a pair.
 *
 * Three: enough to send word more than once and not so many that a posting of
 * twelve years needs nobody to come and see them. What they run out of is what
 * the look-in brings.
 */
export const A_STACK_A_HOUSE_HANDS_OUT = 3;

/**
 * Years between one look-in on a posting and the next.
 *
 * Three. A posting runs six to twenty-four years (`A_POSTING_RUNS_FOR_YEARS`),
 * so everybody posted is looked in on at least twice, and three years is about
 * as long as three slips last somebody in a town where anything happens.
 * Measured over two seeds at two hundred years: 9,901 look-ins, 1,666 more due
 * with nobody the house could spare, and houses unable to answer their gate 7
 * with the pass and 9 without, because a look-in over by the end of the year
 * holds nobody away.
 */
export const A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS = 3;

/**
 * How many blanks a house keeps in its treasury: the pairs of a stack for
 * everybody on its roll, two blanks a slip.
 *
 * Off the roll rather than off standing, because what the stock is FOR is
 * cutting pairs for whoever goes out, and a house has as many people who might
 * go as it has people.
 */
export function whatAHouseKeepsInStock(onTheRoll: number): number {
    return 2 * A_STACK_A_HOUSE_HANDS_OUT * Math.max(1, Math.floor(onTheRoll));
}

/**
 * The disciples posted to a house's Internal Affairs office, who cut its slips.
 *
 * The design owner: *"Internal Affairs disciples cut them, for everyone including
 * elders."*
 *
 * READ OFF THE POSTING, which is what a posting is: somebody stationed
 * somewhere, and the somewhere is the room the roll is kept in rather than a
 * town. This returned an empty list and said in its own header that nothing
 * posts a disciple to an office; the list is now the stationed rows, so the day
 * anything posts one - the player's own road is
 * `src/web/holding-a-posting.ts` - they are here without this moving. The
 * world's own `applyPostings` stations people in TOWNS and never in a room, so
 * this is still empty for everybody the world posts, which is why nothing the
 * world does changes shape today.
 */
export function theDisciplesPostedToInternalAffairs(
    state: Pick<WorldState, 'npcs' | 'locations'>,
    houseId: string
): string[] {
    const hall = whereThisHouseBurnsItsLamps(state.locations, houseId);
    if (hall === null) return [];
    return state.npcs
        .filter(npc => npc.status === 'alive' && npc.factionId === houseId)
        .filter(npc => npc.activity?.kind === 'stationed' && npc.locationId === hall)
        .map(npc => npc.id)
        .sort();
}

/**
 * Who of a house at its seat cuts pairs for somebody it sends out: a disciple
 * posted to Internal Affairs, and with none posted, the most junior of its
 * people standing there who can cut at all. Null where nobody there can.
 */
export function whoCutsPairsAtTheSeat(
    state: Pick<WorldState, 'npcs' | 'locations'>,
    members: readonly NpcRecord[],
    seatLocationId: string
): NpcRecord | null {
    const able = members.filter(n => n.status === 'alive' && n.locationId === seatLocationId
        && couldCutACommunicationTalisman(n.cultivation.realmOrdinal));
    const posted = new Set(theDisciplesPostedToInternalAffairs(state, members[0]?.factionId ?? ''));
    const pool = able.some(n => posted.has(n.id)) ? able.filter(n => posted.has(n.id)) : able;
    return [...pool].sort((a, b) => a.factionRankIndex - b.factionRankIndex
        || a.cultivation.realmOrdinal - b.cultivation.realmOrdinal
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0] ?? null;
}

/** Whether a house's treasury is below the blanks it keeps. The column a board reads. */
export function itsCommunicationTalismansRunLow(
    state: Pick<WorldState, 'objects'>,
    houseId: string,
    onTheRoll: number
): boolean {
    return howManyTheHouseHas(state.objects, houseId) < whatAHouseKeepsInStock(onTheRoll);
}

const DAYS_PER_YEAR = 365;

function requireReason(id: string): SendingReason {
    const reason = getSendingReason(id);
    if (!reason) throw new Error(`No sending reason ${id}.`);
    return reason;
}

/** One report, as the pass made it. For measuring; nothing stores it. */
export interface AReportCameHome {
    houseId: string;
    reporterId: string;
    aboutFactId: string;
    aboutKind: HistoricalFact['kind'];
    /** The day the person away could first have known. */
    sawOn: number;
    /** The day the slip was burnt. */
    reportedOn: number;
    /** The day the house would have heard it at its own seat, or null for not by then. */
    seatWouldHaveHeardOn: number | null;
}

export interface WhatWordCameHome {
    handedOut: number;
    lookedIn: number;
    /** Look-ins that were due and had nobody the house could spare. */
    lookInsWithNobodyToSend: number;
    foundGone: number;
    reports: AReportCameHome[];
    recruitsReported: number;
    /** Reports a recruiter still owes at the end of the pass. */
    recruitsStillOwed: number;
}

/**
 * The yearly pass. Mutates `state`.
 *
 * IT READS THE YEAR SINCE ITS LAST RUN, and nothing about the span it was called
 * in. A first cut clamped that to the calling span's first day, so a world
 * advanced a year at a time never looked at what happened between the pass day
 * and the year's end, and sixty years in six calls came out a different history
 * from sixty in one (`driver.test.ts`, decomposability).
 */
export function wordFromThePeopleAway(
    state: WorldState,
    input: {
        /** The day the pass is reporting on. It reads the 365 days up to it. */
        day: number;
    }
): WhatWordCameHome {
    const day = Math.floor(input.day);
    const from = day - (DAYS_PER_YEAR - 1);
    const out: WhatWordCameHome = {
        handedOut: 0, lookedIn: 0, lookInsWithNobodyToSend: 0, foundGone: 0,
        reports: [], recruitsReported: 0, recruitsStillOwed: 0
    };
    const lookIn = requireReason('sending-to-look-in-on-a-posting');
    const howFar = howFarFromTheSeat(state.locations);
    // An ended house's slips go first, so the index below never holds them.
    takeAwayWhatAnswersToNobody(
        state.objects, new Set(state.factions.filter(h => h.dissolvedOnDay === null).map(h => h.id))
    );
    // Opened once, and closed once at the end. See `theStacksInHand`.
    const stacks = theStacksInHand(state.objects);

    const at = new Map<string, number>();
    const rolls = new Map<string, number[]>();
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        at.set(npc.id, i);
        if (npc.factionId === null) continue;
        const roll = rolls.get(npc.factionId);
        if (roll) roll.push(i); else rolls.set(npc.factionId, [i]);
    }

    // Who got fresh slips this pass, and on what day, so what they saw before
    // they had one is reported on the day they had one.
    const toppedUpOn = new Map<string, number>();
    const sentOut = new Set<string>();
    // Who reads each house's hall, asked once a house.
    const readers = new Map<string, { id: string; name: string } | null>();
    const readerOf = (houseId: string) => {
        if (!readers.has(houseId)) readers.set(houseId, whoReadsTheHall(state, houseId));
        return readers.get(houseId)!;
    };

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house) || house.seatLocationId === null) continue;
        const seat = house.seatLocationId;
        const hall = whereThisHouseBurnsItsLamps(state.locations, house.id) ?? seat;
        const members = (rolls.get(house.id) ?? []).map(i => state.npcs[i]!);
        const alive = members.filter(n => n.status === 'alive');
        const cutter = whoCutsPairsAtTheSeat(state, members, seat);
        const cutPairsFor = (npc: NpcRecord, onDay: number): number => {
            const fromTheTreasury = cutter === null ? 0 : stacks.cutPairsFor({
                houseId: house.id, houseName: house.name, toId: npc.id, toName: npc.name,
                upTo: A_STACK_A_HOUSE_HANDS_OUT, hallLocationId: hall, fromTheTreasury: true, onDay
            });
            if (fromTheTreasury > 0 || !couldCutACommunicationTalisman(npc.cultivation.realmOrdinal)) return fromTheTreasury;
            // Nobody to cut them or nothing to cut them from, and they can cut:
            // they cut their own before they go.
            return stacks.cutPairsFor({
                houseId: house.id, houseName: house.name, toId: npc.id, toName: npc.name,
                upTo: A_STACK_A_HOUSE_HANDS_OUT, hallLocationId: hall, fromTheTreasury: false, onDay
            });
        };

        // ── ISSUED, TO WHOEVER SET OUT THIS YEAR ─────────────────────────
        for (const npc of alive) {
            const doing = npc.activity;
            if (!doing || !isTheWorldsToMove(npc)) continue;
            if (doing.kind !== 'stationed' && doing.kind !== 'out_with_a_party') continue;
            if (doing.sinceDay < from || doing.sinceDay > day) continue;
            if (stacks.carriedAtFirst(npc.id, house.id) > 0) continue;
            const given = cutPairsFor(npc, doing.sinceDay);
            out.handedOut += given;
            if (given > 0) toppedUpOn.set(npc.id, doing.sinceDay);
        }

        // ── LOOKED IN ON ─────────────────────────────────────────────────
        for (const posted of members) {
            const doing = posted.activity;
            if (!doing || doing.kind !== 'stationed' || !isTheWorldsToMove(posted)) continue;
            const due = aLookInFallsDue(doing.sinceDay, doing.untilDay ?? null, from, day);
            if (due === null) continue;
            if (posted.status !== 'alive') {
                // Gone before the last look-in was due is gone news already.
                const goneOn = posted.diedOnDay ?? posted.updatedOnDay;
                if (goneOn <= due - A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS * DAYS_PER_YEAR) continue;
            }
            const roster: OnTheRollForAnErrand[] = alive
                .filter(n => isTheWorldsToMove(n) && n.id !== posted.id && !sentOut.has(n.id))
                .map(n => ({
                    id: n.id,
                    name: n.name,
                    ordinal: n.cultivation.realmOrdinal,
                    rankIndex: n.factionRankIndex,
                    locationId: n.locationId,
                    committedUntilDay: n.activity && isAwayOnSomething(n.activity.kind)
                        ? n.activity.untilDay ?? null
                        : null
                }));
            const spare = whatTheHouseCanSpare({
                roster, rankCount: house.ranks.length, seatLocationId: seat, onDay: due
            });
            const going = whoTheHouseCanSend(
                { ceilingOrdinal: lookIn.ceilingOrdinal, hands: lookIn.hands }, spare.free)[0];
            if (!going) {
                out.lookInsWithNobodyToSend++;
                continue;
            }
            const index = at.get(going.id);
            if (index === undefined) continue;
            sentOut.add(going.id);

            const town = posted.locationId;
            const walk = howFar(seat, town) ?? 0;
            const departs = Math.max(from, due - walk);
            const arrives = Math.min(day, departs + walk);
            const visitor = state.npcs[index]!;
            const term = 2 * walk + lookIn.days;
            // A look-in that is over by the day reported on is somebody who went
            // and is back: the service is theirs, priced as `bringHomeWhoeverIsDue`
            // prices a term served, and they are standing where they were. One
            // still on the road is out on the ordinary term and comes home the
            // ordinary way.
            state.npcs[index] = departs + term <= day
                ? creditMerit(visitor, whatServiceIsWorth(visitor.cultivation.realmOrdinal, term))
                : {
                    ...setLocation(visitor, town, departs),
                    activity: {
                        kind: 'out_with_a_party',
                        note: `Out for ${house.name}, looking in on ${posted.name}.`,
                        withIds: [],
                        sinceDay: departs,
                        untilDay: departs + term,
                        returnTo: whereTheyGoBackTo(visitor)
                    }
                };
            out.lookedIn++;

            const placeName = state.locations.find(l => l.id === town)?.name ?? 'where they were posted';
            const gone = posted.status !== 'alive';
            if (gone) out.foundGone++;
            const wounds = posted.cultivation.untreatedInjuries ?? 0;
            // THERE AND WELL IS NOT A ROW. The house expected it, and the stack
            // handed over is what the look-in changed. Measured over two seeds at
            // two hundred years: 10,494 look-ins, 262 of them finding somebody
            // gone. With a row for every one the advance took 58.7s against 41.8s
            // without the pass.
            if (gone || wounds > 0) appendWorldFact(state, makeFact({
                day: arrives,
                kind: lookIn.factKind,
                scale: lookIn.scale,
                visibility: 'faction',
                magnitude: gone ? 0.4 : 0.15,
                summary: gone
                    ? (posted.status === 'missing'
                        ? `${visitor.name} of ${house.name} came to ${placeName} to look in on `
                          + `${posted.name}, and ${posted.name} is not there.`
                        : `${visitor.name} of ${house.name} came to ${placeName} to look in on `
                          + `${posted.name}, and ${posted.name} is dead.`)
                    : `${visitor.name} of ${house.name} looked in on ${posted.name} at ${placeName}`
                      + (wounds > 0 ? `, who is carrying ${wounds} untreated wound${wounds === 1 ? '' : 's'}.` : '.'),
                actors: [
                    { id: visitor.id, name: visitor.name, role: WENT_AND_CAME_BACK },
                    { id: posted.id, name: posted.name, role: 'looked in on' }
                ],
                locationId: town,
                factionIds: [house.id],
                data: { lookedInOn: posted.id, status: posted.status }
            }), { bystanders: false, recur: false });

            // The visitor carries pairs cut for them at the seat.
            if (!gone && cutter !== null) {
                const given = stacks.cutPairsFor({
                    houseId: house.id, houseName: house.name, toId: posted.id, toName: posted.name,
                    upTo: A_STACK_A_HOUSE_HANDS_OUT, hallLocationId: hall, fromTheTreasury: true, onDay: arrives
                });
                out.handedOut += given;
                if (given > 0) toppedUpOn.set(posted.id, arrives);
            }
        }
    }

    out.reports.push(...whatThePeopleAwaySendWordOf(state, { day, from, toppedUpOn, howFar, rolls, stacks, readerOf }));

    // ── RECRUITS ─────────────────────────────────────────────────────────
    for (const npc of [...state.npcs]) {
        if (npc.status !== 'alive') continue;
        const owed = theReportsTheyOwe(npc);
        if (owed.length === 0) continue;
        for (const report of owed) {
            const house = state.factions.find(f => f.id === report.houseId && f.dissolvedOnDay === null);
            if (!house || house.seatLocationId === null) continue;
            // Standing in the compound, they say it. That is the other road and
            // it is not this pass's.
            if (npc.locationId === house.seatLocationId) continue;
            if (stacks.carriedAtFirst(npc.id, house.id) === 0 && !toppedUpOn.has(npc.id)) {
                out.recruitsStillOwed++;
                continue;
            }
            const onDay = Math.min(day, Math.max(report.takenOnDay, toppedUpOn.get(npc.id) ?? from));
            const burnt = burnACommunicationTalisman(state, {
                senderId: npc.id,
                senderName: npc.name,
                houseId: house.id,
                fromLocationId: npc.locationId,
                onDay,
                to: { kind: 'an_office', title: THE_INTERNAL_AFFAIRS_ELDER, holderId: readerOf(house.id)?.id ?? null },
                receivedBy: readerOf(house.id),
                says: `${report.personName} was taken on`
                    + (report.whereName ? ` at ${report.whereName}.` : '.'),
                aboutLocationId: house.seatLocationId,
                howFar,
                stacks
            });
            if (!burnt.sent) {
                out.recruitsStillOwed++;
                continue;
            }
            theHouseExpects(state, {
                houseId: house.id,
                person: { id: report.personId, name: report.personName },
                recruiter: { id: npc.id, name: npc.name },
                where: report.whereId === null ? null : { id: report.whereId, name: report.whereName ?? '' },
                takenOnDay: report.takenOnDay,
                reportedBy: { id: npc.id },
                onDay,
                addressedTo: THE_INTERNAL_AFFAIRS_ELDER
            });
            out.recruitsReported++;
        }
    }

    stacks.close();

    // ── AND THE MASTERS WHO HAVE COME TO VALUE A DISCIPLE ────────────────
    // A half of a communication jade, the twin kept. See
    // `mastersGiveJadeToDisciplesTheyValue`.
    mastersGiveJadeToDisciplesTheyValue(state, { day });
    // And the Internal Affairs Elder's for the house's elders.
    theInternalAffairsElderMakesJadeForElders(state, day);
    return out;
}

/**
 * The day in this span a look-in on a posting falls due, or null.
 *
 * Every {@link A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS} years from the day they
 * were posted, and not after the posting ends. Read off the posting's own dates,
 * so nothing records a look-in; one that nobody could be spared for is simply
 * not made, and the next falls due on its day.
 */
export function aLookInFallsDue(
    postedOn: number,
    postingEnds: number | null,
    from: number,
    to: number
): number | null {
    const every = A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS * DAYS_PER_YEAR;
    const first = Math.max(1, Math.ceil((from - postedOn) / every));
    const due = postedOn + first * every;
    if (due < from || due > to) return null;
    if (postingEnds !== null && due > postingEnds) return null;
    return due;
}

/** Who did a piece of work, as a landing needs to know them. */
export interface AMaker {
    alive: boolean;
    houseId: string | null;
    ordinal: number;
}

/** One of the world's people, as a maker. */
export function theMakerThisIs(npc: Pick<NpcRecord, 'status' | 'factionId' | 'cultivation'>): AMaker {
    return { alive: npc.status === 'alive', houseId: npc.factionId, ordinal: npc.cultivation.realmOrdinal };
}

// ─────────────────────────────────────────────────────────────────────────
// A SITTING BETWEEN OTHER WORK
// ─────────────────────────────────────────────────────────────────────────

/**
 * How long a piece of work at home can run and still fit between other work.
 *
 * A week. The owner, on cutting communication talismans: a few of them is a
 * day's sitting. Work at home no longer than this is taken by somebody at the
 * seat who is at something that keeps them there, without taking them off it.
 */
export const WORK_THAT_FITS_BETWEEN_OTHER_WORK_DAYS = 7;

/** Whether a notice is short work done at the house's own seat. */
export function isShortWorkAtHome(reason: SendingReason): boolean {
    return WHERE_A_NEED_SENDS_YOU[reason.needs] === 'home'
        && reason.days <= WORK_THAT_FITS_BETWEEN_OTHER_WORK_DAYS;
}

/**
 * Whether somebody is free for a sitting at home: free for this much work.
 *
 * At the house's own seat, and at nothing, or at something that keeps them there
 * and can be set down for a day - teaching the people in front of them, or the
 * ordinary work of their rank. Not away, not at a desk making something (a
 * `thingId`), not at board work already taken at home, and not in a scene,
 * seclusion or mending, which are every other activity.
 *
 * A BOARD TERM IS READ OFF THE ACTIVITY, not off the tag alone. The tag stays
 * until the term closes, and somebody the year's lessons have since put in front
 * of a class is teaching, not at the notice. Measured on two seeds over two
 * centuries, a house dry with a cutter at its seat: of 47 cutters, 12 were
 * teaching with a board term's tag still on them.
 */
export function freeForASittingAtHome(
    npc: Pick<NpcRecord, 'status' | 'tags' | 'locationId' | 'activity'>,
    seatLocationId: string | null
): boolean {
    if (npc.status !== 'alive' || !isTheWorldsToMove(npc)) return false;
    if (seatLocationId === null || npc.locationId !== seatLocationId) return false;
    const doing = npc.activity;
    if (doing === null) return true;
    if (typeof doing.thingId === 'string') return false;
    if (doing.kind === 'teaching') return true;
    return doing.kind === 'the_work_of_their_rank' && !npc.tags.some(t => t.startsWith('board-work|'));
}

/**
 * Short work at home, taken between other work. Mutates `state`. Returns how
 * many sat down to it.
 *
 * THE BOARD'S OWN NOTICES, READ BY WHOEVER IS FREE FOR THEM. The ordinary
 * readers of the wall are the wholly free (`freeToTakeWork`), and a notice that
 * is a week's work at home is also read by anybody {@link freeForASittingAtHome}
 * - which is how the people who can cut talismans come to cut them. Measured on
 * `afford-a` over a century before this: 945 house-years a house was short, the
 * notice taken 55 times, and the people at Foundation or above in those houses
 * teaching (1,685 person-years), at the work of their rank (1,113), out with a
 * party or posted, and wholly free in 67. At two hundred years 30 of 87 houses
 * had none; with this, 5 of 93. A notice the ordinary readers already filled is
 * not offered again.
 *
 * NOTHING THEY ARE AT IS INTERRUPTED. The sitting is recorded against them and
 * their activity is left as it was: service for the days of it, priced as a term
 * served is (`whatServiceIsWorth`), what the work makes lands at once
 * ({@link whatCuttingForTheHouseLands}), and they are paid for what landed
 * ({@link whatCuttingPays}). Lowest rung first, as the wall is read, and one
 * sitting each.
 */
export function aSittingAtHomeIsTaken(
    state: WorldState,
    input: {
        house: HouseAsItStands;
        seatLocationId: string | null;
        /** Indexes into `state.npcs` of the house's living roll. */
        roll: readonly number[];
        /** The highest rung the house has anybody on. */
        reach: number;
        day: number;
        /** How many have already taken this notice this year. */
        alreadyTaken: (entryId: string) => number;
    }
): number {
    if (!reasonsOpenTo(input.house).some(isShortWorkAtHome)) return 0;
    // Internal Affairs disciples first, and the house's Foundation members only
    // where none is posted.
    const posted = new Set(theDisciplesPostedToInternalAffairs(state, input.house.id));
    const free = input.roll.filter(i => freeForASittingAtHome(state.npcs[i]!, input.seatLocationId));
    const sitters = (free.some(i => posted.has(state.npcs[i]!.id)) ? free.filter(i => posted.has(state.npcs[i]!.id)) : free)
        .sort((a, b) => {
            const x = state.npcs[a]!, y = state.npcs[b]!;
            return x.factionRankIndex - y.factionRankIndex
                || x.cultivation.realmOrdinal - y.cultivation.realmOrdinal
                || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
        });
    const takenNow = new Map<string, number>();
    let sat = 0;
    for (const at of sitters) {
        const npc = state.npcs[at]!;
        const ordinal = npc.cultivation.realmOrdinal;
        for (const entry of whatAHouseHasOnItsBoard({
            house: input.house, ordinal, reachOfTheHouse: input.reach, reachOfTheRest: input.reach
        })) {
            const reason = theReasonBehind(entry.id);
            if (reason === null || !isShortWorkAtHome(reason)) continue;
            const had = input.alreadyTaken(entry.id) + (takenNow.get(entry.id) ?? 0);
            if (had >= reason.hands) continue;
            takenNow.set(entry.id, (takenNow.get(entry.id) ?? 0) + 1);
            const landed = reason.makes === null ? 0 : whatCuttingForTheHouseLands(state, theMakerThisIs(npc), {
                thingId: reason.makes, sinceDay: input.day, untilDay: input.day + reason.days
            });
            const credited = creditMerit(npc, whatServiceIsWorth(ordinal, reason.days));
            state.npcs[at] = {
                ...credited,
                spiritStones: (credited.spiritStones ?? 0) + whatCuttingPays(landed, ordinal),
                updatedOnDay: input.day
            };
            sat++;
            break;
        }
    }
    return sat;
}

/**
 * What cutting this many slips pays whoever cut them, in whole spirit stones.
 *
 * WHAT THEY ARE WORTH, AND NOT A STONE MORE. Each is its cutter's time share and
 * its materials (`whatASlipIsWorth`), rounded down, and it is paid for what
 * landed rather than for the term. A cutting notice used to pay the board's rate
 * for a term, whatever it cut: measured on `afford-a` over five hundred years,
 * 804 terms paid 39,375 stones, about five stones a slip against a worth of a
 * third of one, and the same for a term that landed one slip into a nearly full
 * drawer as for one that filled an empty one.
 */
export function whatCuttingPays(count: number, cutterOrdinal: number): number {
    const many = Math.max(0, Math.floor(count));
    if (many === 0) return 0;
    return Math.floor(many * whatASlipIsWorth(cutterOrdinal));
}

/**
 * What a term cutting blank communication talismans for the house lands as, when
 * it closes. Mutates `state.objects`. Returns how many went into the treasury.
 *
 * THE WORK IS THE BOARD'S, AND THIS IS ONLY WHAT IT MAKES. The notice is posted
 * while the house is short (`itsCommunicationTalismansRunLow`), taken like any
 * other (`a-disciple-takes-work-off-the-board.ts`) and paid in stones for what
 * lands ({@link whatCuttingPays}) rather than for the term, and carries what it
 * makes onto the worker as `thingId`. The close asks this. A cut sitting makes
 * `CUT_IN_A_SITTING` in `DAYS_A_SITTING_TAKES`, the term decides how many
 * sittings, and the house takes no more than it is short: nobody cuts paper
 * into a full drawer.
 *
 * ONE LANDING, WHOEVER DID THE WORK. The world's own close asks it of a person
 * (`bringHomeWhoeverIsDue`), a sitting between other work asks it of whoever sat
 * down ({@link aSittingAtHomeIsTaken}), and a player's finished duty asks it of
 * the player (`completeDuty`). All three say who made it as {@link AMaker}.
 *
 * Nothing lands for a hand under the floor, for somebody not of a standing
 * house, or for somebody dead before the term closed.
 */
export function whatCuttingForTheHouseLands(
    state: WorldState,
    maker: AMaker,
    doing: { thingId?: string | null; sinceDay: number; untilDay?: number | null }
): number {
    if (doing.thingId !== THE_COMMUNICATION_TALISMAN.id) return 0;
    if (!maker.alive || maker.houseId === null) return 0;
    if (!couldCutACommunicationTalisman(maker.ordinal)) return 0;
    const house = state.factions.find(f => f.id === maker.houseId && f.dissolvedOnDay === null);
    if (!house) return 0;
    const days = Math.max(DAYS_A_SITTING_TAKES, (doing.untilDay ?? doing.sinceDay) - doing.sinceDay);
    const couldCut = Math.floor(days / DAYS_A_SITTING_TAKES) * CUT_IN_A_SITTING;
    const onTheRoll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id).length;
    const short = whatAHouseKeepsInStock(onTheRoll) - howManyTheHouseHas(state.objects, house.id);
    const count = Math.max(0, Math.min(couldCut, short));
    if (count === 0) return 0;
    addToTheStack(state.objects, {
        houseId: house.id, houseName: house.name, holderId: null, count,
        locationId: house.seatLocationId,
        onDay: doing.untilDay ?? doing.sinceDay
    });
    return count;
}

/**
 * Whether a fact is this house's business: worth a slip to somebody of it.
 *
 * It names one of the house's own, whatever it weighs. Otherwise it has to be
 * heavy enough to repeat at all - `WORTH_REPEATING`, the bar a finished
 * sending's news clears - and to have reached past the people in it (`scale`
 * above `personal`). And then it is the ground's own news, a door, a tide, a
 * town taken by something, which names no house; or it is a house this one
 * stands toward as an ally or a rival (`ALLIED_STANDING`, `RIVAL_STANDING`).
 *
 * THE WEIGHT IS THE FACT'S OWN, so nothing here lists kinds. Measured over two
 * seeds at a century: a death weighs 0.66 and up, a door opening 0.55 and up, a
 * war mostly 0.50, a rival's elder promoted 0.40 to 0.49 and its head 0.53 - and
 * a master taken, which the ledger files as a promotion, 0.30. Before the bar,
 * 1,145 of 1,578 reports over two seeds and two hundred years were promotions,
 * nearly all of them that. Before the ally-or-rival clause, 966 of 1,057 over
 * thirty years on one seed were promotions in houses of no concern at all.
 */
export function isThisHousesBusiness(
    fact: Pick<HistoricalFact, 'actors' | 'factionIds' | 'scale' | 'magnitude'>,
    house: Pick<FactionRecord, 'standing'>,
    ours: ReadonlySet<string>
): boolean {
    if (fact.actors.some(a => ours.has(a.id))) return true;
    if (fact.magnitude < WORTH_REPEATING) return false;
    if (fact.scale === 'personal') return false;
    if (fact.factionIds.length === 0) return true;
    return fact.factionIds.some(id => {
        const regard = house.standing[id] ?? 0;
        return regard >= ALLIED_STANDING || regard <= RIVAL_STANDING;
    });
}

/**
 * Word sent home by the people away, off what they saw that their house had not
 * heard.
 */
function whatThePeopleAwaySendWordOf(
    state: WorldState,
    input: {
        day: number;
        from: number;
        toppedUpOn: ReadonlyMap<string, number>;
        howFar: (seatId: string, placeId: string | null) => number | null;
        rolls: ReadonlyMap<string, readonly number[]>;
        /** Opened before the hand-outs; whoever was handed a stack since is in `toppedUpOn`. */
        stacks: TheStacksInHand;
        /** Who reads each house's hall. */
        readerOf: (houseId: string) => { id: string; name: string } | null;
    }
): AReportCameHome[] {
    const { day, from } = input;
    const oldest = from - A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS * DAYS_PER_YEAR;

    // What has already been sent home, so nothing is said twice.
    const alreadyTold = new Set<string>();
    const candidates: HistoricalFact[] = [];
    for (const fact of state.history.facts) {
        if (isWordSentHome(fact)) {
            const about = fact.data.wordOf;
            if (typeof about === 'string') for (const h of fact.factionIds) alreadyTold.add(`${h}|${about}`);
            continue;
        }
        if (fact.day < oldest || fact.day > day) continue;
        if (fact.visibility === 'secret' || fact.locationId === null) continue;
        candidates.push(fact);
    }
    if (candidates.length === 0) return [];

    const region = new Map<string | null, string | null>();
    const regionFor = (id: string | null): string | null => {
        const had = region.get(id);
        if (had !== undefined) return had;
        const found = regionOf(state, id);
        region.set(id, found);
        return found;
    };
    const byRegion = new Map<string | null, HistoricalFact[]>();
    for (const fact of candidates) {
        const r = regionFor(fact.locationId);
        const bucket = byRegion.get(r);
        if (bucket) bucket.push(fact); else byRegion.set(r, [fact]);
    }

    const reports: AReportCameHome[] = [];
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house) || house.seatLocationId === null) continue;
        const seat = house.seatLocationId;
        const members = (input.rolls.get(house.id) ?? []).map(i => state.npcs[i]!);
        const ours = new Set(members.map(n => n.id));
        const atTheSeat = members.filter(n => n.status === 'alive' && n.locationId === seat);
        const seatTeller: TellerStanding = atTheSeat[0]
            ? whereThisPersonIsStanding(state, atTheSeat[0], regionFor)
            : {
                id: `${house.id}-hall`, name: house.name,
                realmOrdinal: Number(house.resources.power_ordinal ?? 0),
                locationId: seat, regionId: regionFor(seat), factionId: house.id
            };
        const atTheSeatIds = new Set(atTheSeat.map(n => n.id));

        const theSeatHeardOn = (fact: HistoricalFact): number | null => {
            if (fact.locationId === seat) return fact.day;
            if (fact.actors.some(a => atTheSeatIds.has(a.id)) || fact.witnessIds.some(id => atTheSeatIds.has(id))) {
                return fact.day;
            }
            const when = fact.day + DAYS_NEWS_TAKES[howFarOff(state, fact, seatTeller)];
            return isInTheAirFor(state, fact, seatTeller, when) ? when : null;
        };

        for (const npc of members) {
            const doing = npc.activity;
            if (npc.status !== 'alive' || !doing || !isTheWorldsToMove(npc)) continue;
            if (doing.kind !== 'stationed' && doing.kind !== 'out_with_a_party') continue;
            if (npc.locationId === seat) continue;
            if (input.stacks.carriedAtFirst(npc.id, house.id) === 0 && !input.toppedUpOn.has(npc.id)) continue;

            const toppedUp = input.toppedUpOn.get(npc.id) ?? null;
            // Before this span they had no slip, or they would have sent it
            // then. Only a stack come this span reaches back past it.
            const since = toppedUp === null ? Math.max(from, doing.sinceDay) : Math.max(oldest, doing.sinceDay);
            const teller = whereThisPersonIsStanding(state, npc, regionFor);
            const saw: { fact: HistoricalFact; sawOn: number; reportOn: number; seat: number | null }[] = [];
            for (const fact of byRegion.get(teller.regionId) ?? []) {
                if (fact.day < since) continue;
                if (fact.factionIds.includes(house.id)) continue;
                if (alreadyTold.has(`${house.id}|${fact.id}`)) continue;
                if (!isThisHousesBusiness(fact, house, ours)) continue;
                const far = howFarOff(state, fact, teller);
                const sawOn = fact.day + DAYS_NEWS_TAKES[far];
                if (sawOn > day) continue;
                if (far !== 'here' && !isInTheAirFor(state, fact, teller, sawOn)) continue;
                const seatOn = theSeatHeardOn(fact);
                if (seatOn !== null && seatOn <= sawOn) continue;
                const reportOn = toppedUp !== null && sawOn < toppedUp ? toppedUp : sawOn;
                if (seatOn !== null && seatOn <= reportOn) continue;
                saw.push({ fact, sawOn, reportOn, seat: seatOn });
            }
            saw.sort((a, b) => a.reportOn - b.reportOn || b.fact.magnitude - a.fact.magnitude
                || (a.fact.id < b.fact.id ? -1 : 1));

            for (const one of saw) {
                if (alreadyTold.has(`${house.id}|${one.fact.id}`)) continue;
                const place = state.locations.find(l => l.id === one.fact.locationId)?.name ?? 'where they are';
                const burnt = burnACommunicationTalisman(state, {
                    senderId: npc.id,
                    senderName: npc.name,
                    houseId: house.id,
                    fromLocationId: npc.locationId,
                    onDay: one.reportOn,
                    to: { kind: 'an_office', title: THE_INTERNAL_AFFAIRS_ELDER, holderId: input.readerOf(house.id)?.id ?? null },
                    receivedBy: input.readerOf(house.id),
                    says: `word of what happened at ${place}.`,
                    aboutFactId: one.fact.id,
                    aboutLocationId: one.fact.locationId,
                    howFar: input.howFar,
                    stacks: input.stacks
                });
                if (!burnt.sent) break;
                alreadyTold.add(`${house.id}|${one.fact.id}`);
                reports.push({
                    houseId: house.id,
                    reporterId: npc.id,
                    aboutFactId: one.fact.id,
                    aboutKind: one.fact.kind,
                    sawOn: one.sawOn,
                    reportedOn: one.reportOn,
                    seatWouldHaveHeardOn: one.seat
                });
            }
        }
    }
    return reports;
}
