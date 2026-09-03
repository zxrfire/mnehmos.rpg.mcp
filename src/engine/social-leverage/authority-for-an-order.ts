/**
 * On what authority an order is given, and whether the house recognises it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `handleOrder` tested one thing: `powersAt(rankIndex, rankCount)` includes
 * `order`, and `canOrder(giver, receiver)` puts the receiver lower on the
 * ladder. Both are correct and neither is the question a person asks when
 * somebody tells them to do something, which is **who says so**.
 *
 * So every order in the game was the same order. An elder who held the
 * punishment hall and an elder who held nothing gave identical instructions at
 * identical prices, and *"on what authority?"* had no answer because nothing
 * had been claimed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PLAYER'S OWN WORDS DECIDE WHICH QUESTION IS ASKED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * There is no legitimacy table here and there must not be one. What the engine
 * tests is the CLAIM the sentence makes:
 *
 *     "I order you to sweep the yard"        a personal order. The claim is
 *                                            rank, and the ladder answers it.
 *     "By order of the Sect, sweep the yard"  a delegated order. The claim is
 *                                            an office, and the house's own
 *                                            portfolios answer it.
 *
 * Which means a player who claims nothing is never caught out, a player who
 * claims something they hold is obeyed, and a player who claims something they
 * do not hold has said a specific false thing in front of people who can check.
 * That last case is the whole point: it is only available because they reached
 * for it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO FIELDS ARE CALLED "OFFICE". READING THE WRONG ONE IS A LEAK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **HARD RULE, and it is the reason this comment is here rather than only in a
 * report.** Jurisdiction is `APortfolio` in
 * `what-an-elder-is-in-charge-of.ts`, derived from `roomsFor` and dealt
 * deterministically. It is a fact about who runs which room, and members know
 * it - `whoIsInChargeOfWhat` says so outright: *"a player has to be able to
 * work out whose door to knock on before knocking."*
 *
 * `Sect.office` in `schema/cultivation.ts` is a DIFFERENT FIELD ENTIRELY. It is
 * the Protector's chair, it sits off the ladder, and the design owner ruled
 * that a member does not know whether their house has one or who it is:
 *
 *   > anything that shows a house's people to a player reads `ranks` and must
 *   > NOT read this field... the ordinary member genuinely does not know...
 *   > an empty chair and a filled one look identical from inside the house.
 *
 * So **nothing in this file, and nothing that answers "on what authority?",
 * may read `Sect.office`.** Doing so would tell a member whether their house
 * has a Protector, which is precisely the thing they are not told. The next
 * person here will see two fields with the same word on them and reach for the
 * wrong one; this paragraph is what stands between them and that.
 */

import { type RoomPurpose, purposeOf } from '../../engine/world/architecture.js';
import type { LocationRecord } from '../../engine/world/locations.js';
import type { OnTheRoll } from './what-a-body-wants-is-what-its-deciders-want.js';
import {
    type APortfolio,
    whatTheyHold,
    whoAnswersAbout,
    whoIsInChargeOfWhat
} from './what-an-elder-is-in-charge-of.js';

/**
 * What a sentence claimed.
 *
 * `personal` is the default everywhere, because it is what an order is unless
 * somebody reaches for something bigger, and because the cheap branch has to be
 * the one an unrecognised label falls through to.
 */
export type AuthorityClaim = 'personal' | 'delegated';

/**
 * The rooms a house has, read off the rooms it actually has.
 *
 * `seedSectLibraries`' neighbour `growCompound` already builds every house's
 * interior at world creation and pushes each room into `state.locations`, so
 * the compound is not something to recompute - it is something to look up.
 * Each room stores `data.purpose` and `purposeOf` is the existing reader for
 * it; `data.factionId` says whose it is.
 *
 * Reading state rather than rebuilding it is the point. A recomputation would
 * need `CompoundInput`, which only `seeding.ts` knows how to project and only
 * privately, and a second projection of eight columns is exactly how two
 * sources of truth start disagreeing. This way a house that has lost a room, or
 * gained one, answers with what it has.
 */
export function theRoomsThisHouseHas(
    locations: readonly LocationRecord[],
    sectId: string
): RoomPurpose[] {
    const seen: RoomPurpose[] = [];
    for (const location of locations) {
        if (location.data?.factionId !== sectId) continue;
        const purpose = purposeOf(location);
        if (purpose !== null && !seen.includes(purpose)) seen.push(purpose);
    }
    return seen;
}

/** Who runs what in this house, off its own rooms and its own roll. */
export function portfoliosIn(input: {
    locations: readonly LocationRecord[];
    sectId: string;
    roll: readonly OnTheRoll[];
    rankCount: number;
}): APortfolio[] {
    return whoIsInChargeOfWhat({
        rooms: theRoomsThisHouseHas(input.locations, input.sectId),
        roll: input.roll,
        rankCount: input.rankCount
    });
}

export interface AuthorityForAnOrder {
    claim: AuthorityClaim;
    /** True where the house would recognise the order as given. */
    legitimate: boolean;
    /** Every room this person actually runs, deepest first. */
    held: RoomPurpose[];
    /** The room claimed, where one was. */
    under: RoomPurpose | null;
    /** Who actually answers about that room, where somebody does. */
    heldInstead: string | null;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Whether this person may give this order, on the authority they claimed.
 *
 * Pure. It decides nothing about rank - `canOrder` and `powersAt` are the
 * ladder's and are checked by the caller as they always were. What this adds is
 * the second question, which the ladder cannot answer and which is the one a
 * person actually asks.
 *
 * ── A PERSONAL ORDER IS ALWAYS LEGITIMATE, AND THAT IS NOT A LOOPHOLE ────
 *
 * Somebody senior telling somebody junior to do something IS a thing they may
 * do; the ladder already priced it and `resolveAct` already charges for it. The
 * asymmetry this introduces is only that a personal order buys less - it is one
 * person's word rather than the house's - and that claiming the house's word
 * without holding it is a thing that can be checked.
 */
export function whetherTheyMayGiveThisOrder(input: {
    claim: AuthorityClaim;
    giverId: string;
    portfolios: readonly APortfolio[];
    /** The room the order is given under, where the sentence named one. */
    under?: RoomPurpose | null;
}): AuthorityForAnOrder {
    const held = whatTheyHold(input.portfolios, input.giverId);
    const under = input.under ?? null;

    if (input.claim === 'personal') {
        return {
            claim: 'personal',
            legitimate: true,
            held,
            under: null,
            heldInstead: null,
            line: 'Given as themselves. The ladder is the only claim being made and the ladder '
                + 'has already answered it.'
        };
    }

    // ── DELEGATED, WHICH IS A CLAIM ABOUT A ROOM ─────────────────────────
    //
    // Holding nothing is the commonest case and is not a failure of rank: most
    // people on a house's roll run no room, and an elder can hold a rung and no
    // portfolio. What makes this illegitimate is not seniority, it is that the
    // sentence said something specific and untrue.
    if (held.length === 0) {
        return {
            claim: 'delegated',
            legitimate: false,
            held,
            under,
            heldInstead: under === null ? null : whoAnswersAbout(input.portfolios, under),
            line: 'Claimed the house\'s authority and holds none of it. They run no room, so '
                + 'there is no part of the house they speak for.'
        };
    }

    // A claim with no room named is a claim to whatever they run, which is a
    // true statement when they run anything. Somebody who holds the punishment
    // hall saying "by order of the sect" has not overreached.
    if (under === null) {
        return {
            claim: 'delegated',
            legitimate: true,
            held,
            under: null,
            heldInstead: null,
            line: `Speaks for ${held.join(', ')}, and named no room in particular.`
        };
    }

    const holder = whoAnswersAbout(input.portfolios, under);
    const theirs = holder === input.giverId;
    return {
        claim: 'delegated',
        legitimate: theirs,
        held,
        under,
        heldInstead: theirs ? null : holder,
        line: theirs
            ? `${under} is theirs to answer for.`
            : holder === null
                ? `Nobody in this house holds ${under}, so nobody speaks for it and this one `
                  + 'does not either.'
                : `${under} is ${holder}'s room, not theirs. Claiming somebody else's office is `
                  + 'a different thing from exceeding your own.'
    };
}
