import { HOUSE_HALLS } from '../world/house-halls.js';
import { roomForHouseWork } from '../world/where-a-house-does-its-work.js';
import { whoDecidesIn } from './what-a-body-wants-is-what-its-deciders-want.js';
import { responsibilitiesFor } from '../world/a-house-gives-one-elder-each-hall.js';
import type { NpcRecord } from '../world/npc-state.js';
import { roomAuthorityOf } from '../world/architecture.js';
/**
 * On what authority an order is given, and whether the house recognises it.
 *
 * `handleOrder` tested only `powersAt` and `canOrder`, which are both correct and
 * neither is the question a person asks when told to do something: **who says
 * so**. So every order in the game was the same order, and an elder who held the
 * punishment hall and an elder who held nothing gave identical instructions at
 * identical prices.
 *
 * There is no legitimacy table here. What is tested is the CLAIM the sentence
 * makes:
 *
 *     "I order you to sweep the yard"        a personal order. The claim is
 *                                            rank, and the ladder answers it.
 *     "By order of the Sect, sweep the yard"  a delegated order. The claim is
 *                                            an office, and the house's own
 *                                            portfolios answer it.
 *
 * TWO FIELDS ARE CALLED "OFFICE", AND READING THE WRONG ONE IS A LEAK.
 * **HARD RULE.** Jurisdiction is `APortfolio` in `what-an-elder-is-in-charge-of.ts`
 * and members know it. `Sect.office` in `schema/cultivation.ts` is a DIFFERENT
 * FIELD: the Protector's chair, off the ladder, and the design owner ruled that a
 * member does not know whether their house has one or who it is:
 *
 *   > anything that shows a house's people to a player reads `ranks` and must
 *   > NOT read this field... the ordinary member genuinely does not know...
 *   > an empty chair and a filled one look identical from inside the house.
 *
 * So **nothing that answers "on what authority?" may read `Sect.office`.** The
 * next person here will see two fields with the same word on them and reach for
 * the wrong one; this paragraph is what stands between them and that.
 */

import { type RoomPurpose, purposeOf } from '../../engine/world/architecture.js';
import type { LocationRecord } from '../../engine/world/locations.js';
import type { OnTheRoll } from './what-a-body-wants-is-what-its-deciders-want.js';
import {
    type APortfolio,
    whatTheyHold,
    whoAnswersAbout
} from './what-an-elder-is-in-charge-of.js';

/**
 * What a sentence claimed. `personal` is the default everywhere, because it is
 * what an order is unless somebody reaches for something bigger, and because the
 * cheap branch has to be the one an unrecognised label falls through to.
 */
export type AuthorityClaim = 'personal' | 'delegated';

/**
 * The rooms a house has, read off the rooms it actually has.
 *
 * Read state rather than rebuild it: a recomputation would need `CompoundInput`,
 * which only `seeding.ts` knows how to project and only privately, and a second
 * projection of eight columns is how two sources of truth start disagreeing. This
 * way a house that has lost a room, or gained one, answers with what it has.
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
    npcs: readonly NpcRecord[];
}): APortfolio[] {
    const rooms = theRoomsThisHouseHas(input.locations, input.sectId);
    const responsibilities = responsibilitiesFor({ ...input, rooms });
    const portfolios: APortfolio[] = responsibilities.map(read => ({
        purpose: read.room, holderId: read.holderId, hallId: read.hall.id,
        depth: roomAuthorityOf(read.room).depth, actingId: read.covering ? read.holderId : null
    }));
    const headId = whoDecidesIn(input)[0]?.id;
    if (headId && portfolios.length) {
        // Missing rooms do not remove ordinary work or create another hall.
        portfolios[0]!.coveringWork = HOUSE_HALLS
            .filter(hall => !responsibilities.some(read => read.hall.id === hall.id))
            .flatMap(hall => hall.rooms.filter(purpose => !hall.serviceOnly?.includes(purpose)
                && roomForHouseWork(input.locations, input.sectId, purpose))
                .map(purpose => ({ purpose, holderId: purpose === 'infirmary'
                    ? responsibilities.find(read => read.hall.id === 'internal-affairs')?.holderId ?? headId
                    : headId })));
    }
    return portfolios;
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
 * It decides nothing about rank - `canOrder` and `powersAt` are the ladder's and
 * are checked by the caller as they always were.
 *
 * A PERSONAL ORDER IS ALWAYS LEGITIMATE, AND THAT IS NOT A LOOPHOLE. Somebody
 * senior telling somebody junior to do something IS a thing they may do. The
 * asymmetry is only that a personal order buys less, and that claiming the
 * house's word without holding it is a thing that can be checked.
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

    // Holding nothing is the commonest case and is not a failure of rank: most
    // people on a house's roll run no room, and an elder can hold a rung and no
    // portfolio. What makes this illegitimate is not seniority, it is that the
    // sentence said something specific and untrue.
    if (held.length === 0 && (under === null || whoAnswersAbout(input.portfolios, under) !== input.giverId)) {
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
    // true statement when they run anything.
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
