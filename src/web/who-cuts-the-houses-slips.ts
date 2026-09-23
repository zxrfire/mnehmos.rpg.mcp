/**
 * Who may cut a house's own communication talismans, and what a player would
 * have to be.
 *
 * What a slip is, against a pair of communication jade, is written once in
 * `src/engine/world/how-a-word-reaches-somebody-who-is-not-there.md`.
 *
 * The design owner: *"anyone foundation or above can just make them"*, *"each
 * communication talisman is marked with a house i assume, making them for the
 * house IS a meritous task"*, and *"the internal affairs elder crafts them, or
 * his disciples who work in internal affairs - probably his disciples craft them
 * for disciples, the elder crafts them for elders."*
 *
 * ── TWO ACTS, AND ONLY ONE OF THEM IS ANYBODY'S ──────────────────────────
 *
 *   for yourself   a pair, the half you carry and the twin your house's hall
 *                  keeps. Foundation or above and nothing else: no permission,
 *                  no merit, and this file does not touch it
 *   for the house  blanks into its treasury, which is the meritorious one - and
 *                  it is an OFFICE's work. A member who simply sits down to it
 *                  is not refused by the verb; nobody hands them the house's
 *                  seal, which is a fact about the house
 *
 * ── WHO THAT IS, READ AND NEVER STORED ───────────────────────────────────
 *
 * Three ways, all of them rows that already exist:
 *
 *   the office           whoever the house's own rooms are DEALT to, with the
 *                        player in the roll they are dealt over. Measured over
 *                        two seeds, every seated house with a life lamp hall has
 *                        a holder - 38 of 38 at world open, 32 of 32 at 500
 *                        years (`scripts/probe-who-runs-internal-affairs.ts`) -
 *                        so the office is not the thing that was missing. What
 *                        was missing was the player being IN the deal: reading
 *                        it off who stands at the hall could never name them,
 *                        because their row stands nowhere by design
 *   under the office     a disciple posted to Internal Affairs - the world's own
 *                        people by their `stationed` row
 *                        (`theDisciplesPostedToInternalAffairs`), the player by
 *                        the posting word they gave, since those are the two
 *                        stores the two kinds of person live in
 *   off the board        the house posts the work when its own stock runs low
 *                        (`sending-to-cut-communication-talismans`), and a
 *                        disciple who has taken that notice is serving under the
 *                        office for as long as the word stands
 *
 * ── AND THE JADE IS NOT HERE ─────────────────────────────────────────────
 *
 * A paired jade is the reusable one and the bar is higher again: it is earth
 * grade, so the hand that makes one is gated by `canRefineGrade` wherever it is
 * made - the Internal Affairs Elder for the house's elders, a master for a
 * disciple they value, or a maker the player commissions
 * (`a-commission-placed-with-a-maker.ts`). No verb lets a player make one
 * themselves, so there is no second gate to write here, and writing one would be
 * a door with nothing behind it.
 */

import { theDisciplesPostedToInternalAffairs } from '../engine/world/what-a-house-hears-from-its-people-away.js';
import { whoReadsTheHall } from '../engine/world/a-communication-talisman-carries-word-home.js';
import { whereThisHouseBurnsItsLamps } from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import {
    THE_INTERNAL_AFFAIRS_ELDER,
    THE_ROOM_THE_ROLL_IS_KEPT_IN
} from '../engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { portfoliosIn } from '../engine/social-leverage/authority-for-an-order.js';
import { whatTheyHold, whoAnswersAbout } from '../engine/social-leverage/what-an-elder-is-in-charge-of.js';
import { isAPosting, theTownOf, theirOpenPosting } from './holding-a-posting.js';
import { theReasonBehind } from '../engine/encounters/what-a-house-has-on-its-board.js';
import { ledgerAbout } from '../storage/repos/obligation.repo.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import type { DatabaseHandle } from './encounters.js';

/** The notice a house posts when its own stock of blanks runs low. */
export const THE_NOTICE_FOR_CUTTING = 'sending-to-cut-communication-talismans';

/** How somebody comes to be cutting the house's own slips. */
export type HowTheyCome = 'the office' | 'under the office' | 'off the board';

export interface WhetherTheyMayCut {
    /** Null where nobody has handed them the house's seal. */
    may: HowTheyCome | null;
    /** Who does it in this house, where the world has somebody. */
    whoDoes: { id: string; name: string } | null;
    /** Engine truth, one line. */
    structure: string;
}

/**
 * Whether this cultivator may cut slips marked with their house, and how.
 *
 * Read on every ask rather than kept: an office changes hands, a notice is
 * served out, and a stored answer would go on being true after either.
 */
export function whetherTheyMayCutForTheHouse(
    world: WorldState,
    repos: CultivationRepos,
    cultivatorId: string,
    houseId: string,
    /** Where they stand on the house's ladder, so the deal can see them in it. */
    rankIndex: number
): WhetherTheyMayCut {
    const house = world.factions.find(f => f.id === houseId && f.dissolvedOnDay === null);
    // THE DEAL WITH THE PLAYER IN IT. `whoReadsTheHall` answers who is AT the
    // hall, and the player's row stands nowhere by design - so reading the
    // office off it could never name them, however high they stood. The
    // portfolio read is the one the house's own rooms are dealt by, and the
    // player goes into the roll it is dealt over, the same way
    // `who-could-put-somebody-off-the-roll.ts` puts them into one.
    const roll = [
        ...world.npcs
            .filter(n => n.status === 'alive' && n.factionId === houseId && n.id !== cultivatorId)
            .map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
        { id: cultivatorId, rankIndex }
    ];
    const portfolios = house === undefined ? [] : portfoliosIn({
        locations: world.locations, sectId: houseId, roll, rankCount: house.ranks.length
    });
    const holds = whatTheyHold(portfolios, cultivatorId).includes(THE_ROOM_THE_ROLL_IS_KEPT_IN);
    const holderId = whoAnswersAbout(portfolios, THE_ROOM_THE_ROLL_IS_KEPT_IN);
    const named = holderId === null || holderId === cultivatorId
        ? null
        : world.npcs.find(n => n.id === holderId) ?? null;
    const whoDoes = named === null
        ? whoReadsTheHall(world, houseId)
        : { id: named.id, name: named.name };

    const posted = theDisciplesPostedToInternalAffairs(world, houseId);
    const underIt = posted.includes(cultivatorId) || theyAreUnderTheOffice(world, repos, cultivatorId, houseId);
    const board = ledgerAbout(repos.db as unknown as DatabaseHandle, cultivatorId).find(row =>
        row.status === 'open'
        && row.holderId === cultivatorId
        && row.tags.includes('duty')
        && row.tags.some(tag => theReasonBehind(tag)?.id === THE_NOTICE_FOR_CUTTING));

    const may: HowTheyCome | null = holds
        ? 'the office'
        : underIt
            ? 'under the office'
            : board !== undefined
                ? 'off the board'
                : null;
    return {
        may,
        whoDoes,
        structure:
            `cut for the house: ${cultivatorId} at ${houseId} - office=${holderId ?? 'nobody'}, `
            + `posted to internal affairs=${posted.length}, under it=${underIt}, `
            + `notice held=${board?.id ?? 'none'}. `
            + `${may === null ? 'Not theirs to cut.' : `Cutting as ${may}.`}`
    };
}

/**
 * Whether this cultivator's own open posting is the one under the office.
 *
 * The world's people are read off their `stationed` row
 * (`theDisciplesPostedToInternalAffairs`); the player's row stands nowhere, so
 * theirs is read off the word they gave - the posting oath, whose place is the
 * room the roll is kept in. One fact, two stores, because the two kinds of
 * person are held in two stores.
 */
function theyAreUnderTheOffice(
    world: WorldState,
    repos: CultivationRepos,
    cultivatorId: string,
    houseId: string
): boolean {
    const hall = whereThisHouseBurnsItsLamps(world.locations, houseId);
    if (hall === null) return false;
    const posting = theirOpenPosting({ repos }, cultivatorId);
    return posting !== null && posting.tags.some(tag => isAPosting(tag) && theTownOf(tag) === hall);
}

/**
 * What to say to somebody the house has not handed its seal to.
 *
 * Names who does it here, because a refusal that does not is a wall with no
 * door in it, and says what would put the work in their hands.
 */
export function whyTheHousesSlipsAreNotTheirsToCut(
    houseName: string,
    whoDoes: { id: string; name: string } | null
): string[] {
    return [
        `Cutting blanks marked with ${houseName} is ${THE_INTERNAL_AFFAIRS_ELDER}'s work, and the seal that `
        + 'marks them is not in your hands.'
        + (whoDoes === null
            ? ` Nobody of ${houseName} is at its hall to do it either.`
            : ` ${whoDoes.name} does it here.`),
        'What would put it in yours is holding that office, being posted to it, or taking the notice '
        + `${houseName} puts up when its own stock runs low. Cutting a pair for YOURSELF wants none of `
        + 'that: your own hand, and a foundation to put a voice into paper from.'
    ];
}
