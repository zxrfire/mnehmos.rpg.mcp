/**
 * WHO IS ENTITLED TO DO THIS, AND WHAT THE REFUSAL SAYS.
 *
 * The four verbs added alongside this file - `petition`, `posture`, `seal` and
 * `offer` - are all one shape: a party asking something of another party, of
 * the dead, or of somebody above the Lid. Almost every one of them is supposed
 * to be REFUSED, and a refusal that names its reason is the whole content.
 *
 * ── WHY THIS IS A FILE RATHER THAN FOUR IF-STATEMENTS ─────────────────────
 *
 * `sect-leadership.ts` already got this right and the gate it produces is the
 * best-written refusal in the project. Three properties make it good, and all
 * three are copied here verbatim rather than approximated:
 *
 *   1. THE REFUSAL STATES THE RUNG IT OPENS AT, IN THAT HOUSE'S OWN TITLE.
 *      Not "you lack authority" - "It opens at Sect Warden, and not before."
 *      A player learns the ladder by being refused on it, and the title comes
 *      out of `ranks[]` so it is right for every house with no special case.
 *
 *   2. SOMEBODY WITH NO HOUSE GETS A DIFFERENT REFUSAL FROM SOMEBODY JUNIOR
 *      IN ONE. The first is about position and the second is about rank, and
 *      collapsing them into one sentence loses the more useful half.
 *
 *   3. WHAT SUCCEEDS PRICES ITSELF IN THE SAME BREATH, out of the catalog,
 *      rather than in a rules note beside the outcome.
 *
 * ── RANK IS NOT REALM ─────────────────────────────────────────────────────
 *
 * The single most likely thing to get wrong here. `realmOrdinal` says how hard
 * somebody is to kill; `rankIndex` says whether anybody has to do what they
 * say, and the catalog is emphatic that the two come apart - the Long Cut ranks
 * by work and nothing else, so a Hand may be an apprentice of nineteen or an
 * Inner Face cultivator of four hundred. Every gate in this file is on the
 * RANK, and where a realm floor genuinely applies it is stated separately and
 * never as a substitute.
 *
 * ── NOTHING HERE IS BESPOKE ───────────────────────────────────────────────
 *
 * `authorityTier`, `isHeadOfHouse` and `elderRungOf` are the engine's, derived
 * from the length of a house's own ladder, so a four-rung court and a six-rung
 * pavilion are handled by the same two lines. There is no faction named
 * anywhere in this file.
 */

import type Database from 'better-sqlite3';

import {
    authorityTier,
    backlashLevel,
    clampStanding,
    elderRungOf,
    impliedHouseSize,
    isHeadOfHouse,
    shieldedCost,
    standingAfterYears,
    STANDING_ON_JOINING,
    type AuthorityTier,
    type BacklashLevel
} from '../engine/cultivation/leadership.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import {
    houseFlagKey,
    type HouseLedger
} from '../server/consolidated/sect-leadership.js';
import { readJsonFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';

// ─────────────────────────────────────────────────────────────────────────
// THE POSITION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where a cultivator actually stands inside a house.
 *
 * A view, assembled from the membership row and the house's own rank list. It
 * holds no opinion about what the position is worth - the verbs ask it
 * questions, and this only answers them.
 */
export interface HousePosition {
    sectId: string;
    sectName: string;
    /** The house's own ladder, bottom first. Titles, in its own words. */
    ranks: readonly string[];
    rankCount: number;
    /** The authority. An index into `ranks`, and nothing else grants it. */
    rankIndex: number;
    rankTitle: string;
    /** What promotion is actually paid for. Carried, never gated on here. */
    contribution: number;
    tier: AuthorityTier;
    /** True where this cultivator is the head of the house. */
    head: boolean;
}

/**
 * What THIS house calls the person at the top of it.
 *
 * "Seat" is the Hollow Court's word and nobody else's - it is literally the
 * fourth entry in that house's own `ranks[]`. A clan has a patriarch, a hall
 * has a hall master, an alliance has a head, a company has a master, and the
 * catalog has said so all along: `ranks[rankCount - 1]` is the title, authored
 * per house, and every one of the thirty-odd houses already carries it.
 *
 * So this is a lookup, not a vocabulary. The fallback is deliberately generic
 * and deliberately not a title - a house with no ladder has nobody at the top
 * of it to name, and "the head of the house" describes the position without
 * borrowing anybody's word for it.
 */
export function headTitleOf(position: HousePosition): string {
    return position.ranks[position.rankCount - 1] ?? 'the head of the house';
}

/**
 * The house this cultivator serves, or null.
 *
 * Null is a real answer with its own refusal, and the two must not be folded
 * together: somebody who serves nothing has a position problem, and somebody
 * standing on the bottom rung has a rank problem.
 */
export function positionIn(repos: CultivationRepos, cultivatorId: string): HousePosition | null {
    const membership = repos.sects.getMembership(cultivatorId);
    if (!membership) return null;

    const sect = repos.sects.getById(membership.sectId);
    if (!sect) return null;

    const rankCount = sect.ranks.length;
    return {
        sectId: sect.id,
        sectName: sect.name,
        ranks: sect.ranks,
        rankCount,
        rankIndex: membership.rankIndex,
        rankTitle: membership.rankTitle || (sect.ranks[membership.rankIndex] ?? ''),
        contribution: membership.contribution,
        tier: authorityTier(membership.rankIndex, rankCount),
        head: isHeadOfHouse(membership.rankIndex, rankCount)
    };
}

/**
 * What a house does about a decision, from the outside in.
 *
 * The four acts this file gates are not on `POWERS_BY_TIER`, and deliberately
 * so: that enum is what a rung may do to its own people, and these are what a
 * HOUSE does to somebody else. They are all the head of the house's, for one reason stated
 * once here rather than four times below - each of them commits the house to
 * something it cannot quietly walk back, and there is exactly one person in a
 * house entitled to do that.
 *
 * `elder` is carried as a separate answer rather than folded into the refusal
 * because an elder is not a bystander: they are the rung the head consults, and
 * telling them so is more useful than telling them no.
 */
export type HouseCommitment = 'posture' | 'seal' | 'offering';

/** The rung a commitment opens at. Always the head; stated once, derived once. */
export function opensAtRung(position: HousePosition): number {
    return Math.max(0, position.rankCount - 1);
}

export function mayCommitTheHouse(position: HousePosition): boolean {
    return position.head;
}

// ─────────────────────────────────────────────────────────────────────────
// THE REFUSALS
// Copied from `noAuthority` in sect-leadership.ts, sentence for sentence.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somebody who serves no house, and therefore speaks for nobody.
 *
 * `andSo` is the half that changes per verb, and it must name what the act
 * would actually require rather than restating that it was refused. A rogue at
 * the bottom of the ladder who declares war should be told what declaring war
 * takes, which is a thing they can then go and get.
 */
export function servesNoHouse(cultivatorName: string, andSo: string): string {
    return `${cultivatorName} serves no house, and ${andSo}`;
}

/**
 * The rank refusal, in the house's own titles.
 *
 * The second sentence is the one that teaches: naming the rung it opens at
 * turns a refusal into the shape of the ladder, and the title is read off
 * `ranks[]` so it is correct in a four-rung court and a six-rung pavilion
 * without a branch on either.
 */
export function rankDoesNotReach(position: HousePosition, opensAt: number): string {
    const title = position.ranks[opensAt] ?? 'a rank this house does not have';
    return `${position.rankTitle} does not do that in ${position.sectName}. `
        + `It opens at ${title}, and not before.`;
}

/**
 * What each of the four tiers is, in the words the tier exists to mean.
 *
 * `tier=elder` is a column value. "Takes disciples in under their own line" is
 * what the value is FOR, and it is the half a player can act on - so the
 * structure channel says both, once, on the row it applies to.
 *
 * The top tier takes the position rather than only the tier, for the reason
 * stated at the head of this file: the refusal names the rung IN THAT HOUSE'S
 * OWN TITLE. A player at the top of the Cinder Clan is its Clan Chief and a
 * player at the top of the Quiet Hall is its Abbot; telling either of them
 * they hold "the seat" hands them the Hollow Court's word for a house that
 * has never used it.
 */
function tierInWords(position: HousePosition): string {
    switch (position.tier) {
        case 'ordered': return 'the bottom rung, and it sends nobody anywhere';
        case 'ordering': return 'a rung that can send the rungs below it and do nothing else';
        case 'elder': return 'an elder rung, which sends below it and takes disciples in under its own line';
        case 'head': return `${headTitleOf(position)}, which does all of that and holds the standard, `
            + 'the methods, and who is an elder besides';
    }
}

/**
 * A rung in a house, named, with its index kept beside it.
 *
 * The house sibling of `rungAndOrdinal` in `facts.ts`, and it exists for the
 * same reason: `rank_index=2` is a column value, and six call sites in
 * `game.ts` were each deciding separately how to say it. Both halves are kept,
 * because they differ by one - a rank index counts from zero and a person in
 * the house counts from the bottom - and a reader handed only the index against
 * a house that lists five rungs cannot tell which end it started at.
 */
export function rankAndIndex(position: HousePosition): string {
    return `${position.rankTitle} of ${position.sectName}, rank ${position.rankIndex + 1} of `
        + `${position.rankCount} counting from the bottom (rank index ${position.rankIndex})`;
}

/**
 * The mechanical line that goes with either refusal above.
 *
 * On the structure channel rather than in the prose, on the same split every
 * other refusal in this package uses: the player is told what happened in the
 * world, and somebody reading the log is told which predicate said so.
 */
export function standingStructure(
    position: HousePosition | null,
    opensAt: number | null
): string {
    if (!position) {
        return 'This cultivator holds no membership in any house. Authority here is the rank '
            + 'index and there is no rank index. Nothing else grants it.';
    }
    return `They stand as ${rankAndIndex(position)}, which is ${tierInWords(position)}.`
        + (opensAt === null
            ? ''
            : ` The act opens at ${position.ranks[opensAt] ?? 'a rung this house does not have'}, `
              + `rank ${opensAt + 1} of ${position.rankCount} (rank index ${opensAt}).`);
}

/**
 * Where the elder rung sits in this house, for a refusal that wants to say who
 * the head of the house would have to be persuaded by.
 */
export function elderRungTitle(position: HousePosition): string | null {
    const rung = elderRungOf(position.rankCount);
    return position.ranks[rung] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// THE HOUSE'S CREDIT
// The same ledger `sect-leadership.ts` writes, read and written through the
// same key. Two ledgers per house would eventually disagree, and the
// disagreement would be a corrupted save rather than a failing test.
// ─────────────────────────────────────────────────────────────────────────

export interface HouseCredit {
    ledger: HouseLedger;
    /** Standing brought forward to today. Recovers with time served and nothing else. */
    standing: number;
    houseSize: number;
    ownFollowing: number;
    level: BacklashLevel;
}

/**
 * What the house currently thinks of this cultivator.
 *
 * The time accrual is duplicated from `loadHouse` on purpose and is the one
 * thing in this file that is: standing recovers per year served, a run that
 * skips forty years must not owe forty years of ticks, and reading the ledger
 * without bringing it forward would price every act against a stale figure.
 */
export function creditIn(
    repos: CultivationRepos,
    cultivatorId: string,
    position: HousePosition,
    elapsedDays: number,
    hasPatron: boolean
): HouseCredit {
    const stored = readJsonFlag<HouseLedger>(
        repos.db, cultivatorId, houseFlagKey(position.sectId)
    );
    const ledger: HouseLedger = stored ?? {
        standing: STANDING_ON_JOINING,
        accruedToDay: elapsedDays,
        ownFollowing: 0,
        expelled: [],
        departed: [],
        externalElders: [],
        admissionOrdinal: null,
        teaches: null,
        curriculumSetOnDay: null,
        membersAdded: 0,
        membersLost: 0,
        obstructions: 0,
        challengedTimes: 0
    };

    const elapsed = Math.max(0, elapsedDays - ledger.accruedToDay);
    const standing = elapsed > 0
        ? standingAfterYears(ledger.standing, elapsed / DAYS_PER_YEAR)
        : ledger.standing;

    const houseSize = Math.max(
        1,
        impliedHouseSize(position.rankCount) + ledger.membersAdded - ledger.membersLost
    );

    return {
        ledger,
        standing,
        houseSize,
        ownFollowing: ledger.ownFollowing,
        level: backlashLevel(standing, hasPatron && position.head)
    };
}

/**
 * Spend standing on a commitment, through the same arithmetic every other act
 * in the house runs on.
 *
 * `shieldedCost` is the discount a personal following buys and `clampStanding`
 * is the floor, both the engine's. Nothing here invents a curve; the caller
 * supplies the raw figure and says where it came from.
 */
export function spendStanding(
    repos: CultivationRepos,
    cultivatorId: string,
    position: HousePosition,
    credit: HouseCredit,
    rawCost: number,
    elapsedDays: number
): { spent: number; landedAt: number; level: BacklashLevel } {
    const spent = shieldedCost(rawCost, credit.ownFollowing, credit.houseSize);
    const landedAt = clampStanding(credit.standing - spent);
    const next: HouseLedger = {
        ...credit.ledger,
        standing: landedAt,
        accruedToDay: elapsedDays
    };
    writeFlag(repos.db, cultivatorId, houseFlagKey(position.sectId), JSON.stringify(next));
    return { spent, landedAt, level: backlashLevel(landedAt, position.head) };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A COMMITMENT HAS ALREADY BEEN MADE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Flag key for a house's declared stance toward another party.
 *
 * Keyed on both parties, because a house has a different posture toward every
 * other house and folding them into one field would make the second declaration
 * silently erase the first.
 */
export function postureKey(sectId: string, towardId: string): string {
    return `posture:${sectId}:${towardId}`;
}

/** Flag key recording that a house's seal has been spent. Once, permanently. */
export function sealKey(sectId: string): string {
    return `seal_spent:${sectId}`;
}

/** Flag key recording an offering sent up a house's channel. */
export function offeringKey(sectId: string): string {
    return `offering:${sectId}`;
}

export interface DeclaredPosture {
    stance: string;
    towardId: string;
    towardName: string;
    onDay: number;
    /** Whether it was said out loud. An alliance nobody can see is a conspiracy. */
    openly: boolean;
}

export interface SpentSeal {
    onDay: number;
    ancestorName: string;
    ordinal: number;
}

export interface SentOffering {
    onDay: number;
    stones: number;
    /** Null in every recorded case so far, which is the content rather than a gap. */
    response: string | null;
}

export function readPosture(
    db: Database.Database,
    cultivatorId: string,
    sectId: string,
    towardId: string
): DeclaredPosture | null {
    return readJsonFlag<DeclaredPosture>(db, cultivatorId, postureKey(sectId, towardId));
}

export function readSpentSeal(
    db: Database.Database,
    cultivatorId: string,
    sectId: string
): SpentSeal | null {
    return readJsonFlag<SpentSeal>(db, cultivatorId, sealKey(sectId));
}

export function readOffering(
    db: Database.Database,
    cultivatorId: string,
    sectId: string
): SentOffering | null {
    return readJsonFlag<SentOffering>(db, cultivatorId, offeringKey(sectId));
}
