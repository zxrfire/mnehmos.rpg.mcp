/**
 * Whether the body you left it with is still going to hand it over.
 *
 * The institutional half of what a cultivator can leave behind. A deposit is
 * not the safe option with the buried cache as the risky one; it is a different
 * risk with a different shape. A cache is at risk of being FOUND, which is a
 * question about ground and traffic. A deposit is at risk of the HOLDER, which
 * is a question about who you trusted and how long you left it - and the answer
 * gets worse the longer it sits, because staff turn over, seats burn, houses
 * are absorbed, and at some distance nobody alive has any reason to believe a
 * stranger's phrase means anything.
 *
 * ── Nothing here is a reliability number ─────────────────────────────────
 *
 * Every input is a figure the catalog already keeps for its own reasons:
 *
 *   foundedYearsAgo              how long it has already stood
 *   powerOrdinal                 whether it can hold its own vault
 *   rivals.length                how many bodies would take it
 *   production.yearsSinceLastPeak  whether it is going up or coming down
 *   FACTION_CHARACTER.quietlyStopped  whether it has already stopped doing the
 *                                thing it is defined by, without saying so
 *
 * A `reliability: 0.9` written next to a house would be a second model of that
 * house living in a data file, and it would drift from the real one inside a
 * month. See AGENTS.md, "Nothing in the lore is bespoke".
 *
 * ── Lindy, and why an old house is a better bet ──────────────────────────
 *
 * The base hazard is `1 / foundedYearsAgo`: a body that has already stood four
 * thousand years is, absent any other information, about as likely to fail in a
 * given year as one in four thousand. That is not a law of nature, it is the
 * only honest prior available, and it puts the Measured Span at five thousand
 * years and the Thousand Treasure Pavilion - a commercial house with no
 * founding date in the catalog at all - a very long way apart, which is the
 * distinction the player is being asked to make.
 *
 * ── Six ways it goes wrong, and one of them is a hole in the ground ──────
 *
 * A house that fails does not simply lose the goods. `HouseFate` has six
 * members, four of them failures with something left to do about it, and the
 * weights between them come off the same catalog facts:
 *
 *   honoured                 the counter pays out.
 *   absorbed_and_honoured    a larger body took the book and honours it.
 *   absorbed_and_repudiated  a larger body took the assets and disclaims the
 *                            obligations, which is what a body without a book
 *                            of its own does with somebody else's promises.
 *   destroyed_vault_intact   the seat burned and the vault did not. The deposit
 *                            becomes a CACHE at the seat, and everything in
 *                            `whether-a-buried-cache-is-still-there.ts` takes
 *                            over from there. This is the one place the two
 *                            routes meet, and it is the reason they are one
 *                            system rather than two.
 *   standing_and_refusing    the house is there, the book is intact, and they
 *                            will not pay. The sharpest one, because there is
 *                            somebody to argue with.
 *   ledger_lost              nobody can establish that there was ever anything,
 *                            and a phrase means nothing to the person at the
 *                            counter.
 *
 * ── Fate is dealt, not rolled ────────────────────────────────────────────
 *
 * The same construction as the cache: one uniform threshold derived from
 * (world seed, deposit id), never stored, and the deposit fails at the first
 * year the cumulative hazard climbs past it. So the answer is monotone,
 * reproducible, and identical however many times anybody asks.
 */

import { forStream } from '../cultivation/rng.js';
import { getSect, DESTROYED_DAO_HOUSES } from '../../data/cultivation/sects.js';
import { getFactionCharacter } from '../../data/cultivation/faction-character.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A HOUSE IS, FOR THIS PURPOSE
// ─────────────────────────────────────────────────────────────────────────

export interface HolderStanding {
    factionId: string;
    name: string;
    /** Years it has already stood. Null where the catalog states no founding. */
    yearsStanding: number | null;
    powerOrdinal: number;
    /** Bodies with a standing feud, which is who would take it. */
    rivalCount: number;
    /** Years since it last produced anybody at its own historical peak. */
    yearsSinceLastPeak: number;
    /** Whether it has already stopped doing the thing it is defined by. */
    hasQuietlyStopped: boolean;
    /** Whether the custody terms say there is a book. */
    keepsWrittenRecord: boolean;
    /** Who would absorb it: the first rival the catalog names, or null. */
    successorId: string | null;
    successorName: string | null;
    /** Whether that successor keeps a book, which decides honour from repudiation. */
    successorKeepsRecord: boolean;
}

/**
 * A house with no stated founding is treated as five hundred years old.
 *
 * Not a guess dressed as a fact. The regional sects in the catalog carry no
 * `foundedYearsAgo` - only the dao houses do - and a commercial body with
 * auction floors in every city is not comparable to a four-thousand-year book
 * hall. Five hundred is the shortest span in the catalog that still reads as an
 * institution rather than a business, and it puts the two undated takers at the
 * bottom of the ranking, which is the honest place for them.
 */
export const UNDATED_HOUSE_YEARS = 500;

/**
 * Whether a house keeps a book is decided by its custody terms, which is why
 * that flag is passed in rather than read here: this module knows about
 * institutions failing and nothing about custody products.
 */
export function standingOf(
    factionId: string,
    keepsWrittenRecord: boolean
): HolderStanding | null {
    const house = getSect(factionId);
    if (!house) return null;

    const character = getFactionCharacter(factionId);
    const founded = 'foundedYearsAgo' in house
        ? (house as { foundedYearsAgo: number }).foundedYearsAgo
        : null;

    // Who takes it. The first rival the catalog names, which is where the
    // three destroyed dao houses' own `destroyedBy` entries point: every one of
    // them was ended by a body with an interest, and two were replaced by it.
    const successorId = house.rivals[0] ?? null;
    const successor = successorId ? getSect(successorId) : undefined;

    return {
        factionId,
        name: house.name,
        yearsStanding: founded,
        powerOrdinal: house.powerOrdinal,
        rivalCount: house.rivals.length,
        yearsSinceLastPeak: character?.production.yearsSinceLastPeak ?? 0,
        hasQuietlyStopped: character?.quietlyStopped !== undefined,
        keepsWrittenRecord,
        successorId: successor ? successorId : null,
        successorName: successor?.name ?? null,
        // A successor that keeps records honours what it took over; one that
        // does not cannot honour it even in good faith, because there is
        // nothing to honour it against. Read off whether the catalog gives that
        // body a `civilReach` at all, which only the record-keeping houses have.
        successorKeepsRecord: successor !== undefined && 'civilReach' in successor
    };
}

/** How many destroyed houses the catalog holds. The precedent, counted. */
export const HOUSES_THE_CATALOG_HAS_ALREADY_LOST = DESTROYED_DAO_HOUSES.length;

// ─────────────────────────────────────────────────────────────────────────
// HAZARD
// ─────────────────────────────────────────────────────────────────────────

/** Years of decline past which a house is treated as failing rather than late. */
export const DECLINE_IS_VISIBLE_AFTER_YEARS = 300;

/**
 * The chance in a given year that this house stops honouring claims.
 *
 * Four terms, all multiplicative on the Lindy base:
 *
 *   power      A body at ordinal 35 keeps its vault. One at 27 is a commercial
 *              house that has "far too much to lose", in the catalog's own
 *              words about the Pavilion. Worth about a factor of two across the
 *              range these houses actually occupy.
 *   rivals     Every rival is a party that would take the seat. The three
 *              destroyed dao houses were all ended by a named body.
 *   decline    Centuries since the last peak is the shape of a house running
 *              on what it inherited.
 *   stopped    A `quietlyStopped` line means the house has ALREADY ceased doing
 *              the thing it is defined by. That is not a risk, it is a
 *              condition, and it doubles the rate.
 */
export function annualFailureHazard(standing: HolderStanding): number {
    const years = standing.yearsStanding ?? UNDATED_HOUSE_YEARS;
    const base = 1 / Math.max(1, years);

    // Ordinal 27 -> 1.4, ordinal 35 -> 1.0. Below 27 it keeps climbing.
    const power = Math.max(0.8, 1 + (35 - standing.powerOrdinal) * 0.05);
    const rivals = 1 + standing.rivalCount * 0.15;
    const decline = 1 + Math.max(0, standing.yearsSinceLastPeak - DECLINE_IS_VISIBLE_AFTER_YEARS) / 1_000;
    const stopped = standing.hasQuietlyStopped ? 2 : 1;

    return Math.min(1, base * power * rivals * decline * stopped);
}

/** The chance the house has stopped honouring claims by the end of `years`. */
export function cumulativeFailureOdds(standing: HolderStanding, years: number): number {
    const hazard = annualFailureHazard(standing);
    return 1 - Math.pow(1 - hazard, Math.max(0, Math.floor(years)));
}

// ─────────────────────────────────────────────────────────────────────────
// FATE
// ─────────────────────────────────────────────────────────────────────────

export type HouseFate =
    | 'honoured'
    | 'absorbed_and_honoured'
    | 'absorbed_and_repudiated'
    | 'destroyed_vault_intact'
    | 'standing_and_refusing'
    | 'ledger_lost';

/**
 * How this particular house comes apart, given that it does.
 *
 * Weights off the same facts, and every one of them argues for itself:
 *
 *   absorbed          Weak bodies are taken over rather than destroyed. Weight
 *                     falls with `powerOrdinal`, and is zero where the catalog
 *                     names no rival to take it.
 *   destroyed         Strong bodies with enemies are attacked. Weight rises
 *                     with `powerOrdinal` and with `rivalCount`.
 *   refusing          A house that has already quietly stopped doing what it is
 *                     for. Weight is almost entirely the `quietlyStopped` flag.
 *   ledger_lost       A house with no book has nothing that survives the people
 *                     who worked there.
 */
export function fateWeights(standing: HolderStanding): Record<HouseFate, number> {
    const canBeAbsorbed = standing.successorId !== null;
    const absorbed = canBeAbsorbed ? Math.max(0.2, (36 - standing.powerOrdinal) * 0.25) : 0;

    return {
        // Never selected by the weighted draw: reaching this function at all
        // means the house has failed. Present so the record is exhaustive over
        // the union and a future caller cannot forget a member.
        honoured: 0,
        absorbed_and_honoured: standing.successorKeepsRecord ? absorbed : absorbed * 0.2,
        absorbed_and_repudiated: standing.successorKeepsRecord ? absorbed * 0.3 : absorbed,
        destroyed_vault_intact: 0.5 + standing.rivalCount * 0.3 + Math.max(0, standing.powerOrdinal - 28) * 0.1,
        standing_and_refusing: standing.hasQuietlyStopped ? 3 : 0.6,
        ledger_lost: standing.keepsWrittenRecord ? 0.4 : 2.5
    };
}

export interface DepositFate {
    fate: HouseFate;
    /** Years after the deposit the house stopped honouring. Null if it has not. */
    failedAfterYears: number | null;
    /** Where the goods are now, in the world's terms. Null while honoured. */
    whereTheGoodsWent: string | null;
    /** Who to argue with, where there is anybody. Null where there is not. */
    counterpartyId: string | null;
    oddsItWouldHaveFailed: number;
    threshold: number;
}

/**
 * What has happened to a deposit at this house after `years`.
 *
 * `honoured` is not a guarantee that the claimant gets it: the phrase still has
 * to be produced, and the term still has to have been paid for. Those are two
 * separate refusals owned elsewhere, and keeping them separate is what lets a
 * player be told which one they ran into.
 */
export function fateOfADeposit(
    worldSeed: string,
    depositId: string,
    standing: HolderStanding,
    years: number
): DepositFate {
    const threshold = forStream(worldSeed, 'deposit-holder', depositId).next();
    const horizon = Math.max(0, Math.floor(years));
    const odds = cumulativeFailureOdds(standing, horizon);

    if (odds <= threshold) {
        return {
            fate: 'honoured',
            failedAfterYears: null,
            whereTheGoodsWent: null,
            counterpartyId: null,
            oddsItWouldHaveFailed: odds,
            threshold
        };
    }

    const hazard = annualFailureHazard(standing);
    let failedAfterYears = horizon;
    for (let year = 1; year <= horizon; year += 1) {
        if (1 - Math.pow(1 - hazard, year) > threshold) {
            failedAfterYears = year;
            break;
        }
    }

    // A second, independent stream so that WHEN it failed and HOW it failed do
    // not correlate: a house is not more likely to burn because it failed late.
    const how = forStream(worldSeed, 'deposit-holder-manner', depositId)
        .weighted(fateWeights(standing));

    return {
        fate: how,
        failedAfterYears,
        whereTheGoodsWent: whereTheGoodsWent(how, standing),
        counterpartyId: counterpartyFor(how, standing),
        oddsItWouldHaveFailed: odds,
        threshold
    };
}

/** What happened to the property, said plainly and without a mechanic in it. */
export function whereTheGoodsWent(fate: HouseFate, standing: HolderStanding): string | null {
    const successor = standing.successorName ?? 'whoever took the seat';
    switch (fate) {
        case 'honoured':
            return null;
        case 'absorbed_and_honoured':
            return `${standing.name} is a wing of ${successor} now. The book went with the building and the entries in it are still being honoured, which is not universal and is why anybody deals with ${successor} at all.`;
        case 'absorbed_and_repudiated':
            return `${successor} took the seat, the vault and the stock, and took the position that it did not take the promises. The entries were not destroyed. They were simply not adopted, and there is a difference that matters to lawyers and to nobody standing at the counter.`;
        case 'destroyed_vault_intact':
            return `The seat burned. The vault did not - vaults rarely do - and what was in it is under what is left of the building, in ground nobody has cleared, which makes it a hole with things in it and no longer a deposit at all.`;
        case 'standing_and_refusing':
            return `${standing.name} is still there, the book is intact, the entry is in it, and the answer is no. Nobody at the counter will say why and the refusal is not appealable inside the house.`;
        case 'ledger_lost':
            return `The house stands and the record does not. Whatever was written against the entry went with a fire, a flooding, a succession that reorganised the stack room, or four generations of clerks who each assumed the volume was somebody else's business.`;
    }
}

/** The body a claimant would have to deal with, where there is one. */
export function counterpartyFor(fate: HouseFate, standing: HolderStanding): string | null {
    switch (fate) {
        case 'absorbed_and_honoured':
        case 'absorbed_and_repudiated':
            return standing.successorId;
        case 'standing_and_refusing':
        case 'ledger_lost':
            return standing.factionId;
        // Nobody. That is the whole character of it: a burned seat has no
        // counter and no clerk, and what is left is ground.
        case 'destroyed_vault_intact':
        case 'honoured':
            return null;
    }
}

/**
 * Whether this fate leaves something a later party could physically dig.
 *
 * The one bridge between the two routes. True for exactly one member of the
 * union, and the web layer uses it to convert the deposit row into a cache row
 * at the failed house's seat rather than writing a second kind of thing.
 */
export function leavesAHoleInTheGround(fate: HouseFate): boolean {
    return fate === 'destroyed_vault_intact';
}
