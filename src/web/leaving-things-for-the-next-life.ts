/**
 * Putting things beyond your own death, and collecting what somebody else put
 * beyond theirs.
 *
 * The played surface for two acts the world already had the machinery for and
 * no player could reach: burying a cache in the ground, and lodging a deposit
 * with a house against a phrase. `trials.ts` is this module's sibling and its
 * precedent - the same shape of thing, a narrow layer deciding WHICH row a
 * sentence meant and what the world says about it, with `game.ts` owning the
 * writes.
 *
 * ── Why this is not a new subsystem ──────────────────────────────────────
 *
 * The whole inheritance-site layer already exists and is already about finding
 * what dead cultivators left behind. `cultivation_sites` already carries a
 * comment saying that a site outlives the run that turned it up and that its
 * `run_id` deliberately has no foreign key, because "the map is pocked with
 * other people's ambitions". A buried cache is an inheritance site with a
 * known depositor and a very small interior. It goes in that table, with
 * `kind = 'cache'`, and no schema change was required for any of this - which
 * is the strongest evidence available that it belongs there.
 *
 * A deposit is not ground and goes in the same table for a different reason: a
 * house that fails with its vault intact leaves exactly a hole with things in
 * it, and the engine converts the row rather than moving it between systems.
 * One table, two kinds, one conversion. See
 * `engine/world/whether-a-house-still-honours-a-deposit.ts`.
 *
 * ── Isolation from the trial ledger ──────────────────────────────────────
 *
 * `SiteLedger` in `trials.ts` reads the same table and cannot see any of this:
 * it discards any row whose id does not resolve to a catalog site, and it
 * filters on `discovered = 1`, which a buried cache is not. Nothing here
 * touches a row it did not write. The two ledgers are neighbours in one table
 * and have no shared keys.
 *
 * ── `discovered` means what it says ──────────────────────────────────────
 *
 * A cache is written with `discovered = 0`, because a thing nobody has found is
 * not a discovered site. It flips to 1 when it is turned up - by a later run
 * with a spade, or by the world getting there first. That is the column doing
 * its documented job rather than a flag repurposed, and it keeps caches out of
 * `siteTagsAt`, which grants comprehension off discovered ground and must not
 * grant it off a hole somebody is standing over.
 *
 * ── The clock ────────────────────────────────────────────────────────────
 *
 * Everything about both routes turns on how long it has been, and a run's
 * `elapsedDays` restarts at zero every life. So the day recorded against a
 * cache or a deposit is the WORLD day - `WorldState.currentDay`, which is
 * continuous across runs and is the only clock that can measure the gap between
 * one cultivator burying something and another digging it up. Where no world
 * is running the day is recorded as null and the elapsed span is reported as
 * unmeasurable rather than guessed at; see {@link elapsedYears}.
 *
 * ── What crosses ─────────────────────────────────────────────────────────
 *
 * Stones and pouch stock. Nothing else, ever, by any route:
 * `A_DEPOSIT_IS_NOT_A_LIFE` states it and `applyGoods` is the only function in
 * this module that writes to a cultivator, so there is exactly one place to
 * check.
 */

import type Database from 'better-sqlite3';

import type { Cultivator } from '../schema/cultivation.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import {
    CUSTODY_TAKERS,
    ANCHORING_A_CACHE,
    custodyTermsFor,
    custodyTakers,
    feeForTerm,
    type CustodyTerms
} from '../data/cultivation/institutions-that-hold-deposits-for-the-dead.js';
import {
    fateOfACache,
    groundFor,
    cumulativeDiscoveryOdds,
    GROUND_READS,
    type BurialGround,
    type CacheBurial,
    type CacheFate
} from '../engine/world/whether-a-buried-cache-is-still-there.js';
import {
    fateOfADeposit,
    standingOf,
    cumulativeFailureOdds,
    leavesAHoleInTheGround,
    type DepositFate,
    type HolderStanding
} from '../engine/world/whether-a-house-still-honours-a-deposit.js';
import {
    hintFor,
    phraseIsWritable,
    phraseOpens,
    sealPhrase,
    whatWasWrittenDown,
    wordCountOf,
    type SealedPhrase
} from '../engine/world/the-phrase-that-opens-a-deposit.js';
import { REGIONS } from '../data/cultivation/regions.js';
import { getSect } from '../data/cultivation/sects.js';
import { getPill } from '../data/cultivation/pills.js';
import { getHerb } from '../data/cultivation/herbs.js';
import { loosePlaceKey } from './knowledge.js';
import { matchScore, MATCH_THRESHOLD } from './entities.js';
import { rungAndOrdinal, type EngineFacts } from './facts.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT CAN BE PUT ASIDE
// ─────────────────────────────────────────────────────────────────────────

export type GoodKind = 'pill' | 'herb';

export interface GoodStack {
    itemId: string;
    kind: GoodKind;
    quantity: number;
}

/**
 * The set of things that can be left behind, and it is short on purpose.
 *
 * Stones and pouch stock are the two things this engine models a cultivator
 * physically holding. Techniques are not: a known art is a row against the
 * PERSON and there is no manual object on a cultivator to put in a hole, which
 * is the same gap `takeFromSite` reports honestly for immortal items rather
 * than faking. Nothing here pretends otherwise - the refusal at the counter
 * says what cannot be lodged and why, which is more useful than a silent
 * omission and is the only correct way to report a hole.
 */
export interface LegacyGoods {
    spiritStones: number;
    items: GoodStack[];
}

export function goodsAreEmpty(goods: LegacyGoods): boolean {
    return goods.spiritStones <= 0 && goods.items.every(i => i.quantity <= 0);
}

/** What the pouch holds, as stacks. Read straight, no catalog join. */
export function pouchStacks(db: Database.Database, cultivatorId: string): GoodStack[] {
    const rows = db
        .prepare('SELECT item_id, item_kind, quantity FROM cultivator_pouch WHERE cultivator_id = ? AND quantity > 0')
        .all(cultivatorId) as { item_id: string; item_kind: string; quantity: number }[];
    return rows
        .filter(r => r.item_kind === 'pill' || r.item_kind === 'herb')
        .map(r => ({ itemId: r.item_id, kind: r.item_kind as GoodKind, quantity: r.quantity }));
}

/** A stack, as a person would say it. */
export function nameOfStack(stack: GoodStack): string {
    const name = stack.kind === 'pill'
        ? getPill(stack.itemId)?.name ?? stack.itemId
        : getHerb(stack.itemId)?.name ?? stack.itemId;
    return stack.quantity === 1 ? name : `${name} x${stack.quantity}`;
}

export function describeGoods(goods: LegacyGoods): string {
    const parts: string[] = [];
    if (goods.spiritStones > 0) {
        parts.push(`${goods.spiritStones} spirit stone${goods.spiritStones === 1 ? '' : 's'}`);
    }
    for (const stack of goods.items) {
        if (stack.quantity > 0) parts.push(nameOfStack(stack));
    }
    return parts.length === 0 ? 'nothing' : parts.join(', ');
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROWS
// ─────────────────────────────────────────────────────────────────────────

export interface CacheRecord {
    kind: 'cache';
    /** Row id in `cultivation_sites`. Also the stream key for the fate. */
    id: string;
    /** The run that buried it. Never a foreign key - the run is over. */
    buriedByRunId: string;
    /** The place name as the burier wrote it. This is the secret for this route. */
    place: string;
    ground: BurialGround;
    burial: CacheBurial;
    /** World day. Null where no world was running and the span is unmeasurable. */
    buriedOnWorldDay: number | null;
    goods: LegacyGoods;
    /** World day it was lifted by somebody who knew about it. */
    liftedOnWorldDay: number | null;
    liftedByRunId: string | null;
    /**
     * Set once the world has been asked and answered that somebody else got
     * there first. Written so the answer is not recomputed against a moved
     * clock and so the finding is a fact in the world rather than a query.
     */
    goneOnWorldDay: number | null;
    /** Set where this hole is a house's burned vault rather than somebody's spade. */
    fromDepositId: string | null;
}

export interface DepositRecord {
    kind: 'deposit';
    id: string;
    lodgedByRunId: string;
    /** An id in `sects.ts`. Never a body invented for this. */
    factionId: string;
    sealed: SealedPhrase;
    /** Words agreed, counted by the clerk. Not part of the seal. */
    wordCount: number;
    lodgedOnWorldDay: number | null;
    termYears: number;
    feePaidStones: number;
    wrongAttempts: number;
    /** True once the attempts ran out. The entry is dead to everybody. */
    closed: boolean;
    goods: LegacyGoods;
    collectedOnWorldDay: number | null;
    collectedByRunId: string | null;
}

export type LegacyRecord = CacheRecord | DepositRecord;

/** Years between two world days, or null where either is unknown. */
export function elapsedYears(fromDay: number | null, toDay: number | null): number | null {
    if (fromDay === null || toDay === null) return null;
    return Math.max(0, (toDay - fromDay) / DAYS_PER_YEAR);
}

// ─────────────────────────────────────────────────────────────────────────
// THE LEDGER
// ─────────────────────────────────────────────────────────────────────────

interface Row {
    id: string;
    run_id: string | null;
    kind: string;
    name: string;
    location: string | null;
    contents: string;
    discovered: number;
    created_on_day: number;
}

const CACHE_PREFIX = 'cache::';
const DEPOSIT_PREFIX = 'deposit::';

/**
 * Everything one campaign's cultivators have put aside, across every run.
 *
 * Reads are NOT scoped to a run, and that is the entire point: a cache buried
 * two lives ago is exactly what a later run is looking for. Writes record which
 * run did it, so the world knows whose ambition it is looking at, and nothing
 * anywhere joins that back to the living cultivator.
 */
export class LegacyLedger {
    private readonly insertStmt: Database.Statement;
    private readonly updateStmt: Database.Statement;
    private readonly byIdStmt: Database.Statement;
    private readonly cachesAtStmt: Database.Statement;
    private readonly depositsAtStmt: Database.Statement;
    private readonly mineStmt: Database.Statement;

    constructor(db: Database.Database) {
        this.insertStmt = db.prepare(`
            INSERT INTO cultivation_sites
                (id, run_id, kind, name, ordinal, location, contents, discovered, created_on_day)
            VALUES (@id, @runId, @kind, @name, 0, @location, @contents, @discovered, @onDay)
            ON CONFLICT(id) DO UPDATE SET
                contents = excluded.contents,
                discovered = excluded.discovered,
                location = excluded.location
        `);
        this.updateStmt = db.prepare(
            'UPDATE cultivation_sites SET contents = @contents, discovered = @discovered WHERE id = @id'
        );
        this.byIdStmt = db.prepare('SELECT * FROM cultivation_sites WHERE id = ?');
        // Deliberately unscoped by run. A cache buried by somebody else's life
        // is the thing a later run is standing over.
        this.cachesAtStmt = db.prepare(
            "SELECT * FROM cultivation_sites WHERE kind = 'cache' AND location IS NOT NULL"
        );
        this.depositsAtStmt = db.prepare("SELECT * FROM cultivation_sites WHERE kind = 'deposit'");
        this.mineStmt = db.prepare(
            "SELECT * FROM cultivation_sites WHERE run_id = ? AND kind IN ('cache','deposit')"
        );
    }

    private static parse(row: Row): LegacyRecord | null {
        try {
            const blob = JSON.parse(row.contents) as Partial<LegacyRecord> & { kind?: string };
            if (blob.kind === 'cache' || blob.kind === 'deposit') {
                return { ...(blob as LegacyRecord), id: row.id };
            }
            return null;
        } catch {
            // Same reasoning as `SiteLedger.parse`: a row this layer cannot read
            // is a row this layer did not write. Treated as absent.
            return null;
        }
    }

    get(id: string): LegacyRecord | null {
        const row = this.byIdStmt.get(id) as Row | undefined;
        return row ? LegacyLedger.parse(row) : null;
    }

    /**
     * Caches under a place name, whoever buried them and whenever.
     *
     * Matched on `loosePlaceKey` rather than on the raw string, because a
     * location is free text and "the Reed Ford" and "Reed Ford" are the same
     * ground. That comparison is the same one the destinations read uses.
     */
    cachesAt(place: string): CacheRecord[] {
        const wanted = loosePlaceKey(place);
        const out: CacheRecord[] = [];
        for (const row of this.cachesAtStmt.all() as Row[]) {
            const parsed = LegacyLedger.parse(row);
            if (parsed?.kind !== 'cache') continue;
            if (loosePlaceKey(parsed.place) !== wanted) continue;
            out.push(parsed);
        }
        return out.sort((a, b) => (a.buriedOnWorldDay ?? 0) - (b.buriedOnWorldDay ?? 0));
    }

    /** Every deposit at a house, whoever lodged it. */
    depositsWith(factionId: string): DepositRecord[] {
        const out: DepositRecord[] = [];
        for (const row of this.depositsAtStmt.all() as Row[]) {
            const parsed = LegacyLedger.parse(row);
            if (parsed?.kind !== 'deposit') continue;
            if (parsed.factionId !== factionId) continue;
            out.push(parsed);
        }
        return out.sort((a, b) => (a.lodgedOnWorldDay ?? 0) - (b.lodgedOnWorldDay ?? 0));
    }

    /** What this run has put aside. The only run-scoped read in the module. */
    leftByRun(runId: string): LegacyRecord[] {
        const out: LegacyRecord[] = [];
        for (const row of this.mineStmt.all(runId) as Row[]) {
            const parsed = LegacyLedger.parse(row);
            if (parsed) out.push(parsed);
        }
        return out;
    }

    /** Next free id for a run's nth cache or deposit. Deterministic, not random. */
    nextId(runId: string, kind: 'cache' | 'deposit'): string {
        const prefix = kind === 'cache' ? CACHE_PREFIX : DEPOSIT_PREFIX;
        let seq = 1;
        while (this.byIdStmt.get(`${prefix}${runId}::${seq}`) !== undefined) seq += 1;
        return `${prefix}${runId}::${seq}`;
    }

    write(record: LegacyRecord, name: string, onWorldDay: number | null): LegacyRecord {
        const location = record.kind === 'cache' ? record.place : null;
        const discovered = record.kind === 'cache'
            ? (record.liftedOnWorldDay !== null || record.goneOnWorldDay !== null ? 1 : 0)
            : 0;
        this.insertStmt.run({
            id: record.id,
            runId: record.kind === 'cache' ? record.buriedByRunId : record.lodgedByRunId,
            kind: record.kind,
            name,
            location,
            contents: JSON.stringify(record),
            discovered,
            onDay: Math.max(0, Math.floor(onWorldDay ?? 0))
        });
        return record;
    }

    /** Update in place. Used for attempts, lifts and the world getting there first. */
    patch(record: LegacyRecord): LegacyRecord {
        const discovered = record.kind === 'cache'
            ? (record.liftedOnWorldDay !== null || record.goneOnWorldDay !== null ? 1 : 0)
            : 0;
        this.updateStmt.run({
            id: record.id,
            contents: JSON.stringify(record),
            discovered
        });
        return record;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// READING A CACHE THE WORLD HAS HAD ITS HANDS ON
// ─────────────────────────────────────────────────────────────────────────

export interface CacheReading {
    record: CacheRecord;
    /** Null where the world day is unknown and no span can be measured. */
    years: number | null;
    fate: CacheFate | null;
    /** True where anything at all is still under the ground. */
    recoverable: boolean;
    /** The mechanical line. Odds, thresholds, years. Never narrated. */
    structure: string;
}

/**
 * What the ground actually holds now.
 *
 * The fate is asked of the engine and then WRITTEN BACK if it comes back bad,
 * so a cache that has gone stays gone rather than being re-derived against a
 * clock that has moved. The engine's answer is monotone so re-derivation would
 * agree anyway; persisting it is about the finding being a fact in the world
 * that other systems can read, not about the arithmetic.
 */
export function readCache(
    record: CacheRecord,
    worldSeed: string,
    worldDay: number | null
): CacheReading {
    if (record.liftedOnWorldDay !== null) {
        return {
            record,
            years: elapsedYears(record.buriedOnWorldDay, record.liftedOnWorldDay),
            fate: null,
            recoverable: false,
            structure: `${record.id}: lifted on world day ${record.liftedOnWorldDay} by run ${record.liftedByRunId ?? 'unknown'}. Nothing under it.`
        };
    }
    if (record.goneOnWorldDay !== null) {
        return {
            record,
            years: elapsedYears(record.buriedOnWorldDay, record.goneOnWorldDay),
            fate: null,
            recoverable: false,
            structure: `${record.id}: recorded gone on world day ${record.goneOnWorldDay}. Somebody else reached it first.`
        };
    }

    const years = elapsedYears(record.buriedOnWorldDay, worldDay);
    if (years === null) {
        // No clock, so no elapsed span, so no hazard. The conservative
        // direction: an unmeasurable span never deletes anybody's property.
        return {
            record,
            years: null,
            fate: null,
            recoverable: true,
            structure:
                `${record.id}: no world clock recorded at burial or at reading, so the elapsed span is `
                + 'unmeasurable and no discovery hazard was applied. Reported rather than guessed.'
        };
    }

    const fate = fateOfACache(worldSeed, record.id, record.burial, years);
    return {
        record,
        years,
        fate,
        recoverable: fate.stillThere,
        structure:
            `${record.id}: ${years.toFixed(1)} years under ${record.ground} ground. `
            + `Cumulative discovery odds ${(fate.oddsItWouldBeGone * 100).toFixed(1)}% against a dealt `
            + `threshold of ${fate.threshold.toFixed(4)}. `
            + (fate.stillThere
                ? 'Still there.'
                : `Turned up after about ${fate.foundAfterYears} years.`)
    };
}

/** The odds a cache in this ground with this burial is gone in `years`. */
export function oddsGoneIn(burial: CacheBurial, years: number): number {
    return cumulativeDiscoveryOdds(burial, years);
}

// ─────────────────────────────────────────────────────────────────────────
// READING A DEPOSIT
// ─────────────────────────────────────────────────────────────────────────

export type ClaimRefusal =
    | 'wrong_phrase'
    | 'entry_closed'
    | 'term_lapsed'
    | 'holder_failed'
    | 'already_collected';

export interface DepositReading {
    record: DepositRecord;
    terms: CustodyTerms;
    standing: HolderStanding | null;
    years: number | null;
    fate: DepositFate | null;
    /** True where the entry could still be paid out to somebody with the words. */
    payable: boolean;
    /** Why not, where not. Null where the only remaining question is the phrase. */
    refusal: ClaimRefusal | null;
    /** True where the term has run out and the house's lapse policy has applied. */
    lapsed: boolean;
    structure: string;
}

export function readDeposit(
    record: DepositRecord,
    worldSeed: string,
    worldDay: number | null
): DepositReading | null {
    const terms = custodyTermsFor(record.factionId);
    if (!terms) return null;
    const standing = standingOf(record.factionId, terms.keepsWrittenRecord);
    const years = elapsedYears(record.lodgedOnWorldDay, worldDay);

    if (record.collectedOnWorldDay !== null) {
        return {
            record, terms, standing, years, fate: null,
            payable: false, refusal: 'already_collected', lapsed: false,
            structure: `${record.id}: collected on world day ${record.collectedOnWorldDay}. The entry is discharged.`
        };
    }
    if (record.closed) {
        return {
            record, terms, standing, years, fate: null,
            payable: false, refusal: 'entry_closed', lapsed: false,
            structure: `${record.id}: closed after ${record.wrongAttempts} wrong phrase(s) against an allowance of ${terms.attemptsAllowed}.`
        };
    }

    if (years === null || standing === null) {
        // Same reasoning as the cache. No clock or no house in the catalog
        // means no elapsed hazard, and the conservative direction is that the
        // entry stands.
        return {
            record, terms, standing, years, fate: null,
            payable: true, refusal: null, lapsed: false,
            structure:
                `${record.id}: ${years === null ? 'no world clock recorded, so no elapsed span' : 'holder not in the catalog'}`
                + '; no institutional hazard applied. Reported rather than guessed.'
        };
    }

    const lapsed = years > record.termYears;
    const fate = fateOfADeposit(worldSeed, record.id, standing, years);
    const failed = fate.fate !== 'honoured';

    const structure =
        `${record.id}: ${years.toFixed(1)} years with ${standing.name} on a ${record.termYears}-year term. `
        + `Cumulative holder-failure odds ${(fate.oddsItWouldHaveFailed * 100).toFixed(1)}% against a dealt `
        + `threshold of ${fate.threshold.toFixed(4)}. Fate: ${fate.fate}`
        + (fate.failedAfterYears !== null ? ` after about ${fate.failedAfterYears} years` : '')
        + `. Term ${lapsed ? 'LAPSED' : 'live'}.`;

    // Order matters. The holder failing beats the term lapsing, because a house
    // that burned down four hundred years ago did not subsequently decide
    // anything about your term.
    const refusal: ClaimRefusal | null = failed ? 'holder_failed' : lapsed ? 'term_lapsed' : null;

    return { record, terms, standing, years, fate, payable: !failed && !lapsed, refusal, lapsed, structure };
}

/** The odds a house has stopped honouring claims in `years`. For the pre-read. */
export function oddsHolderFailsIn(standing: HolderStanding, years: number): number {
    return cumulativeFailureOdds(standing, years);
}

// ─────────────────────────────────────────────────────────────────────────
// RESOLUTION
// ─────────────────────────────────────────────────────────────────────────

/** Which custody house a sentence meant, out of the six that take deposits. */
export function resolveCustodian(query: string | undefined): CustodyTerms | null {
    const wanted = (query ?? '').trim();
    if (wanted.length < 3) return null;

    let winner: CustodyTerms | null = null;
    let winning = 0;
    for (const terms of CUSTODY_TAKERS) {
        const house = getSect(terms.factionId);
        if (!house) continue;
        const score = Math.max(
            matchScore(wanted, house.name),
            // The distinctive short form, the way `trials.ts` scores an id slug:
            // "the ledger", "held names", "the pavilion".
            matchScore(wanted, terms.factionId.replace(/^(?:house|sect)-/, '').replace(/-/g, ' '))
        );
        if (score > winning) {
            winner = terms;
            winning = score;
        }
    }
    return winning >= MATCH_THRESHOLD ? winner : null;
}

/**
 * Every phrase a player could type to mean a custody house, longest first.
 *
 * A view over the catalog rather than a written list, on the `SITE_PHRASES`
 * precedent, so a seventh taker becomes typeable with no edit to the parser.
 */
export const CUSTODIAN_PHRASES: readonly string[] = [
    ...new Set(CUSTODY_TAKERS.flatMap(terms => {
        const house = getSect(terms.factionId);
        return house
            ? [
                house.name.toLowerCase().replace(/^(?:the|a|an)\s+/, ''),
                terms.factionId.replace(/^(?:house|sect)-/, '').replace(/-/g, ' ')
            ]
            : [];
    }))
].sort((a, b) => b.length - a.length);

/** The ground under a place name, out of the region catalog. */
export function groundOf(place: string | null | undefined): BurialGround {
    const wanted = loosePlaceKey((place ?? '').trim());
    if (wanted === 'unnamed') return 'unplaceable';
    for (const region of REGIONS) {
        for (const known of region.places) {
            if (loosePlaceKey(known.name) === wanted) return groundFor(known.kind);
        }
    }
    return groundFor(null);
}

// ─────────────────────────────────────────────────────────────────────────
// THE PRE-DEPOSIT READ
//
// "The player should be able to tell the difference BEFORE depositing, at
// least roughly, because choosing where to leave it is the decision." So this
// is a read, it is free, and it costs no days. What it must NOT do is print a
// hazard rate: a percentage is a thing a player optimises against and it would
// turn a judgement about institutions into arithmetic. It prints the catalog's
// own facts - how long the house has stood, whether there is a book, what it
// does with a lapse, what it will not do - and a coarse band, and lets the
// player decide.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Four bands and no numbers.
 *
 * Derived by putting the house's own hazard against a two-hundred-year horizon,
 * which is the span a settled cultivator actually cares about - long enough for
 * a whole life to be lived and lost after theirs, short enough that a house
 * failing inside it is a real prospect.
 */
export type CustodyBand = 'as safe as anything gets' | 'sound' | 'a risk' | 'a bad bet';

export const CUSTODY_HORIZON_YEARS = 200;

export function custodyBand(standing: HolderStanding): CustodyBand {
    const odds = cumulativeFailureOdds(standing, CUSTODY_HORIZON_YEARS);
    if (odds < 0.08) return 'as safe as anything gets';
    if (odds < 0.16) return 'sound';
    if (odds < 0.30) return 'a risk';
    return 'a bad bet';
}

export interface CounterView {
    terms: CustodyTerms;
    houseName: string;
    standing: HolderStanding;
    band: CustodyBand;
    /** What a hundred years costs here. */
    centuryFeeStones: number;
}

/** The six counters, ordered by how well they would hold a thing. */
export function counters(): CounterView[] {
    const out: CounterView[] = [];
    for (const { terms, house } of custodyTakers()) {
        const standing = standingOf(terms.factionId, terms.keepsWrittenRecord);
        if (!standing) continue;
        out.push({
            terms,
            houseName: house.name,
            standing,
            band: custodyBand(standing),
            centuryFeeStones: feeForTerm(terms, 100)
        });
    }
    return out.sort((a, b) =>
        cumulativeFailureOdds(a.standing, CUSTODY_HORIZON_YEARS)
        - cumulativeFailureOdds(b.standing, CUSTODY_HORIZON_YEARS));
}

/** One counter as a line a player reads before choosing. No percentages. */
export function describeCounter(view: CounterView): string {
    const stood = view.standing.yearsStanding === null
        ? 'It does not state a founding, which for a commercial house usually means there is not one worth stating'
        : `It has stood ${view.standing.yearsStanding.toLocaleString()} years`;
    const book = view.terms.keepsWrittenRecord
        ? 'There is a book, and the entry goes in it.'
        : 'There is no book. Nothing about your entry is written anywhere a later clerk could read.';
    const fee = view.terms.annualFeeStones === 0
        ? 'It charges nothing.'
        : `${view.terms.annualFeeStones} stones a year, minimum ${view.terms.minimumTermYears} years, paid in advance.`;
    return `${view.houseName}. ${stood}. ${fee} ${book} ${view.terms.whatTheyWillNotDo} Judged over two centuries: ${view.band}.`;
}

// ─────────────────────────────────────────────────────────────────────────
// FACTS
//
// Built here rather than in `facts.ts` so that adding this surface to the game
// is one import and one switch arm. Everything below returns the same
// `EngineFacts` shape every other action produces, and every line in it came
// out of a row or a catalog entry.
// ─────────────────────────────────────────────────────────────────────────

function facts(headline: string, lines: string[], structure: string[]): EngineFacts {
    return { headline, lines, structure, prose: lines.join('\n\n') };
}

/**
 * Why a cultivator is standing at this counter, where the engine can say.
 *
 * "For settling" is what this whole surface was asked for, and settling is not
 * a mood: it is `stagnationRemaining` running down at a rung the cultivator is
 * not going to leave, or a lifespan doing the same. Passed in rather than read
 * here so this module keeps no opinion about survival, which `survival.ts`
 * owns. Absent means the question was asked by somebody who is fine, which is
 * also a legitimate time to bury something.
 */
export interface OutOfRoad {
    /** Years of the settling allowance left at this rung, where one is known. */
    settlingYearsLeft: number | null;
    /** Years of life left, where one is known. */
    lifespanYearsLeft: number | null;
}

/** The listing: what a settled cultivator's two options actually are. */
export function factsForCounters(here: string, road?: OutOfRoad): EngineFacts {
    const views = counters();
    const shortest = road
        ? [road.settlingYearsLeft, road.lifespanYearsLeft]
            .filter((y): y is number => y !== null)
            .sort((a, b) => a - b)[0] ?? null
        : null;
    const lines = [
        shortest !== null && shortest < 100
            ? `You have about ${Math.round(shortest)} years, and it is worth being clear that the road ending is what makes this worth doing. Nothing you put aside is coming back to you.`
            : 'Whatever you put aside is not coming back to you. It is for whoever is standing here afterwards, and that will not be you.',
        'There are two ways to put a thing beyond your own death, and they fail differently.',
        `You can put it in the ground. That costs nothing but the days and needs nobody's permission, and it is at risk from one thing: somebody finding it. What that turns on is where you dig. ${GROUND_READS[groundOf(here)]}`,
        'Or you can lodge it with a house against a form of words, and whoever says the words collects. That is not safe either. It is at risk from the house - from the house being absorbed, or burned, or still standing and simply refusing - and the risk grows the longer you leave it.',
        ...views.map(describeCounter),
        `The Anchorhold will anchor a burial for ${ANCHORING_A_CACHE.feeStones} stones. ${ANCHORING_A_CACHE.whatItBuys} ${ANCHORING_A_CACHE.whatItDoesNotBuy}`
    ];
    return facts('What can be left behind, and to whom.', lines, [
        `${views.length} custody counters, ordered by cumulative failure odds over ${CUSTODY_HORIZON_YEARS} years. `
        + `Ground here reads as '${groundOf(here)}'. Bands are coarse by design; no rate is shown to the player.`
    ]);
}

export function factsForBuried(
    cultivator: Cultivator,
    record: CacheRecord,
    watchers: number
): EngineFacts {
    const lines = [
        `${describeGoods(record.goods)}, in the ground at ${record.place}.`,
        `${record.burial.daysSpent} day${record.burial.daysSpent === 1 ? '' : 's'} of work went into putting it there. ${GROUND_READS[record.ground]}`,
        record.burial.anchored
            ? `The Anchorhold has it on the survey of record. ${ANCHORING_A_CACHE.counterLine}`
            : 'Nothing is on any survey. What holds it is the ground and how well you covered it, and neither of those improves with time.',
        watchers > 0
            ? `${watchers === 1 ? 'Somebody was' : `${watchers} people were`} standing close enough to see what you were doing, and did not leave.`
            : 'Nobody was near enough to see.',
        'You will have to remember where this is. Nothing in your head goes any further than you do, and the next person to stand here will be somebody else.'
    ];
    return facts(`Buried at ${record.place}.`, lines, [
        `${record.id} is written into cultivation_sites as a cache, undiscovered, against run `
        + `${record.buriedByRunId}, on `
        + (record.buriedOnWorldDay === undefined || record.buriedOnWorldDay === null
            ? 'a world day the run did not record'
            : `world day ${record.buriedOnWorldDay}`)
        + `. It went into ${record.ground.replace(/_/g, ' ')} ground over `
        + `${record.burial.daysSpent} day(s) of work by somebody standing at `
        + `${rungAndOrdinal(record.burial.burierOrdinal)}, and `
        + (record.burial.anchored
            ? 'the Anchorhold holds it on the survey of record.'
            : 'nothing anchors it anywhere.'),
        `${watchers} ${watchers === 1 ? 'person was' : 'people were'} close enough to see it done. `
        + `Cultivator ${cultivator.id} was debited ${record.goods.spiritStones} stone(s) and `
        + `${record.goods.items.length} stack(s) to fill it.`
    ]);
}

export function factsForDugUp(place: string, readings: readonly CacheReading[]): EngineFacts {
    if (readings.length === 0) {
        return facts(`Nothing under ${place}.`, [
            `You work the ground at ${place} and turn up soil, stone, roots and the ordinary rubbish of a place people have lived in. Nobody put anything here, or nobody put it here where you are standing.`
        ], [`No cache rows at loose place key for '${place}'.`]);
    }

    const lines: string[] = [];
    const structure: string[] = [];
    let took = 0;
    for (const reading of readings) {
        structure.push(reading.structure);
        if (reading.recoverable) {
            took += 1;
            lines.push(
                `Something is down there, and it comes up whole: ${describeGoods(reading.record.goods)}. `
                + `It has been in this ground ${reading.years === null ? 'longer than anyone can put a figure on' : `about ${Math.round(reading.years)} years`}, `
                + 'and whoever put it there is not coming for it.'
            );
        } else if (reading.fate && !reading.fate.stillThere) {
            lines.push(
                `The hole is here. The shape of it is here, and the marks. What was in it is not. `
                + `${reading.fate.foundBy} About ${reading.fate.foundAfterYears} years after it went in, by the look of the ground.`
            );
        } else {
            lines.push('The hole is here and it is empty. Somebody has already been back for this one.');
        }
    }
    return facts(
        took > 0 ? `Lifted at ${place}.` : `Emptied, at ${place}.`,
        lines,
        structure
    );
}

export function factsForLodged(record: DepositRecord, view: CounterView, wroteDown: string): EngineFacts {
    const lines = [
        `${view.terms.counterLine}`,
        `${describeGoods(record.goods)}, lodged with ${view.houseName} for ${record.termYears} years, ${record.feePaidStones === 0 ? 'at no charge' : `for ${record.feePaidStones} stones paid in advance`}.`,
        wroteDown,
        record.termYears > 0
            ? `The term runs ${record.termYears} years from today. ${lapseLine(view.terms)}`
            : '',
        `${view.terms.whatTheyWillNotDo}`
    ].filter(line => line.length > 0);
    return facts(`Lodged with ${view.houseName}.`, lines, [
        `${record.id} is written into cultivation_sites as a deposit, against run `
        + `${record.lodgedByRunId}, held by ${record.factionId}, on `
        + (record.lodgedOnWorldDay === undefined || record.lodgedOnWorldDay === null
            ? 'a world day the run did not record'
            : `world day ${record.lodgedOnWorldDay}`)
        + `. The term is ${record.termYears} year(s) and the fee paid in advance was `
        + `${record.feePaidStones} stone(s).`,
        `${record.wordCount} word(s) were sealed as the form of words that collects it. The phrase `
        + 'itself is not stored: only a salted digest, and there is no function anywhere that '
        + 'reverses it.'
    ]);
}

function lapseLine(terms: CustodyTerms): string {
    switch (terms.lapse) {
        case 'absorbed_and_recorded':
            return 'After that the goods are the house\'s. The entry stays in the book and stays readable, so somebody arriving late learns what was here and who has it, which is a lead and not a refund.';
        case 'absorbed_and_struck':
            return 'After that the goods are the house\'s and the entry is struck. Nobody afterwards can establish that there was ever anything here at all.';
        case 'published':
            return 'After that the entry is published in the open register. The goods stay where they are and everybody can read that they are there.';
    }
}

export function factsForClaim(
    reading: DepositReading,
    outcome: { paid: boolean; refusal: ClaimRefusal | null; hintLines: string[]; attemptsLeft: number }
): EngineFacts {
    const houseName = reading.standing?.name ?? reading.record.factionId;
    const lines: string[] = [];

    if (outcome.paid) {
        lines.push(
            `The words are the words. ${houseName} does not ask who you are, does not appear to wonder, and produces the entry: ${describeGoods(reading.record.goods)}.`,
            'Whoever lodged this is dead and you are not them. What you are carrying out of here is their property and nothing else of theirs - not what they knew, not what they were, and not where they stood with anybody.'
        );
    } else {
        switch (outcome.refusal) {
            case 'holder_failed':
                lines.push(reading.fate?.whereTheGoodsWent ?? 'The house cannot help you.');
                break;
            case 'term_lapsed':
                lines.push(
                    `The term ran out. ${lapseLine(reading.terms)}`,
                    reading.terms.lapse === 'absorbed_and_struck'
                        ? 'There is nothing here to argue with. The clerk is not being obstructive; there is no entry.'
                        : 'The entry is legible and the goods are not yours.'
                );
                break;
            case 'entry_closed':
                lines.push(
                    'The entry is closed. Somebody stood here before you and said the wrong thing too many times, and this house does not reopen an entry for anybody once it has been marked.'
                );
                break;
            case 'already_collected':
                lines.push('Somebody collected this. The entry is discharged and the house has nothing further on it.');
                break;
            case 'wrong_phrase':
            default:
                lines.push('That is not what was agreed.', ...outcome.hintLines);
                break;
        }
    }

    return facts(
        outcome.paid ? `Collected from ${houseName}.` : `${houseName} declines.`,
        lines,
        [reading.structure, `Outcome: ${outcome.paid ? 'paid' : outcome.refusal ?? 'refused'}, attempts left ${outcome.attemptsLeft}.`]
    );
}

// ─────────────────────────────────────────────────────────────────────────
// WRITES
//
// The only two functions in this module that change a cultivator, and the only
// place `A_DEPOSIT_IS_NOT_A_LIFE` has to be checked. Neither of them touches
// realmOrdinal, cultivationProgress, foundationQuality, insights, achievements,
// sectId, knowledge or anything else that is part of WHO somebody is.
// ─────────────────────────────────────────────────────────────────────────

export interface GoodsMover {
    /** Add or subtract stones. Signed. */
    stones(cultivatorId: string, delta: number): void;
    /** Add stock to the pouch. */
    add(cultivatorId: string, stack: GoodStack): void;
    /** Take stock out. Returns false and writes nothing when short. */
    take(cultivatorId: string, stack: GoodStack): boolean;
}

/**
 * Take the goods off the cultivator. Returns what was actually taken, which is
 * what gets recorded - a stack the pouch was short of is not recorded as
 * buried, because burying something you do not have is how a ledger and a world
 * come apart.
 */
export function liftGoods(
    mover: GoodsMover,
    cultivator: Cultivator,
    wanted: LegacyGoods
): LegacyGoods {
    const stones = Math.max(0, Math.min(cultivator.spiritStones, Math.floor(wanted.spiritStones)));
    if (stones > 0) mover.stones(cultivator.id, -stones);
    const items: GoodStack[] = [];
    for (const stack of wanted.items) {
        if (stack.quantity <= 0) continue;
        if (mover.take(cultivator.id, stack)) items.push(stack);
    }
    return { spiritStones: stones, items };
}

/** Put the goods on the cultivator. Stones and stock. Nothing else. */
export function applyGoods(mover: GoodsMover, cultivatorId: string, goods: LegacyGoods): void {
    if (goods.spiritStones > 0) mover.stones(cultivatorId, goods.spiritStones);
    for (const stack of goods.items) {
        if (stack.quantity > 0) mover.add(cultivatorId, stack);
    }
}

/**
 * Record a wrong phrase against an entry, and say what the counter says.
 *
 * Pure over the record: returns the next record rather than mutating, so the
 * caller decides whether to persist it. The count is persisted at a house that
 * keeps a book and equally at one that does not, because the ENGINE has to
 * count in order to close the entry - what differs is that a house with no book
 * allows so many attempts that the count rarely matters, which is the whole of
 * the trade rather than a special case in the code.
 */
export function recordWrongPhrase(
    record: DepositRecord,
    terms: CustodyTerms,
    worldDay: number | null
): { record: DepositRecord; hintLines: string[]; attemptsLeft: number; closed: boolean } {
    const next: DepositRecord = { ...record, wrongAttempts: record.wrongAttempts + 1 };
    const hint = hintFor({
        wordCount: next.wordCount,
        lodgedOnDay: next.lodgedOnWorldDay ?? worldDay ?? 0,
        termYears: next.termYears,
        wrongAttempts: next.wrongAttempts,
        attemptsAllowed: terms.attemptsAllowed,
        keepsWrittenRecord: terms.keepsWrittenRecord
    });
    return {
        record: { ...next, closed: hint.closed },
        hintLines: [terms.hintOnFailure, ...hint.lines],
        attemptsLeft: hint.attemptsLeft,
        closed: hint.closed
    };
}

/**
 * Convert a deposit whose house burned into a cache at that house's seat.
 *
 * The single bridge between the two routes, and the reason they are one system.
 * The new row is an ordinary cache with `fromDepositId` set, buried in the seat
 * town's ground, with a burial that reflects what a collapsed vault actually is:
 * nobody concealed it, it is under a great deal of masonry, and it has been
 * sitting there since the house went.
 */
export function vaultAsACache(
    deposit: DepositRecord,
    fate: DepositFate,
    seatPlace: string,
    newId: string
): CacheRecord | null {
    if (!leavesAHoleInTheGround(fate.fate)) return null;
    const failedOnDay = deposit.lodgedOnWorldDay !== null && fate.failedAfterYears !== null
        ? deposit.lodgedOnWorldDay + fate.failedAfterYears * DAYS_PER_YEAR
        : null;
    return {
        kind: 'cache',
        id: newId,
        buriedByRunId: deposit.lodgedByRunId,
        place: seatPlace,
        ground: groundOf(seatPlace),
        burial: {
            ground: groundOf(seatPlace),
            // A vault is not a concealment. What protects it is the weight on
            // top, which is why the days figure is high and the ordinal is the
            // house's own rather than anybody's cleverness.
            daysSpent: 30,
            burierOrdinal: 0,
            anchored: false,
            watchers: 0
        },
        buriedOnWorldDay: failedOnDay,
        goods: deposit.goods,
        liftedOnWorldDay: null,
        liftedByRunId: null,
        goneOnWorldDay: null,
        fromDepositId: deposit.id
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE SENTENCES
//
// Kept here rather than in `actions.ts` so that wiring this in is one import
// and a four-line block, on the `SITE_PHRASES` precedent. The rule is the one
// the site block established and for the same reason: A VERB IN VERB POSITION,
// PLUS A NOUN THAT SAYS WHAT IT IS AIMED AT. "dig", "leave", "claim" and
// "collect" are four of the commonest verbs a player types and three of them
// are already owned by something - `dig up` by grave-robbing, `leave` by
// resigning from a sect, `claim` by taking a prize - so none of them fires
// here on its own.
//
// This block must sit BELOW the sect block and BELOW `siteStep`. A sentence
// about leaving a sect is about leaving a sect, and a sentence about digging
// up a named grave is grave-robbing, and both of those read as this one if
// they are tested in the wrong order.
// ─────────────────────────────────────────────────────────────────────────

/** What is being put aside, said in the ways a player says it. */
export const LEGACY_NOUNS =
    // `hoard` is deliberately absent. The Moving Hoard is a faction, so a bare
    // `hoard` made "what do I have on the Moving Hoard" - a recall question
    // about what somebody knows of a house - into a question about deposit
    // counters. Caught by the parser coverage tests on the first integration.
    // The other nouns here are not the names of anything in the catalog.
    //
    // `legacy`, `legacies`, `inheritance` and `bequest` were missing, which is
    // the word this module is named after. "what legacies are there" and "is
    // there an inheritance to claim" both reached nothing while "who holds
    // deposits" was answered, so a player had to guess the accounting word to
    // reach the thing the fiction calls an inheritance.
    //
    // Safe alongside the caution above because none of them names anything in
    // the catalog either, and because the listing branch they feed
    // additionally requires a question word. An inheritance GROUND - a ruin
    // somebody digs - is a different noun and belongs to `site`, which owns
    // "inheritance ground" explicitly and is checked ahead of this.
    //
    // `what i am carrying` had to go, and it is the same caution one size
    // smaller. It is `inventory`'s own first exemplar, word for word, and it is
    // how somebody names the pouch when they are selling out of it: "I want
    // stones for what I am carrying" - `sell`'s own phrasing - was answered
    // with a list of custody counters. `everything i am carrying` stays,
    // because putting all of it somewhere IS this verb.
    //
    // `my pouch` went with it, one word over. A pouch is the container somebody
    // CARRIES; the things in it are what they might leave, and the words for
    // those - my things, my goods, my stones, my estate - are all still here.
    // Measured: "what is in my pouch" was answered with the bequest-houses
    // lecture, which is the plainest inventory question in the game.
    /\b(?:cache|caches|stash|deposit|deposits|strongbox|safekeeping|legacy|legacies|inheritances?|bequests?|my (?:things|goods|possessions|stones|purse|wealth|savings|estate)|everything i (?:have|own|am carrying)|for (?:the next life|whoever comes after|whoever comes next))\b/;

/** Verbs that mean burying and nothing else, so they need no noun beside them. */
export const LEGACY_BURY_VERBS_ALONE = 'bury|buries|burying|cache|caches|caching|inter|inters';

/** Verbs that could mean six other things, so they do need one. */
export const LEGACY_BURY_VERBS_ANCHORED =
    'stash|stashes|stashing|hide|hides|hiding|conceal|conceals|concealing|put away|puts away|sink|sinks';

/**
 * A burial word anywhere in the sentence. Only ever consulted alongside a
 * cache noun or a standing-here phrase, which is what makes it safe: on its
 * own it would fire on half the funerals in the world.
 */
export const LEGACY_BURY_ANYWHERE = /\b(?:bury|burying|cache|caching|stashing|concealing)\b/;

export const LEGACY_DIG_VERBS =
    'dig|digs|digging|dig up|digs up|digging up|unearth|unearths|unearthing|uncover|uncovers|turn over|turns over';

export const LEGACY_LODGE_VERBS =
    'lodge|lodges|lodging|deposit|deposits|depositing|leave|leaves|leaving|entrust|entrusts|entrusting|'
    + 'consign|consigns|bank|banks|banking|put on deposit|place with|hand over to';

export const LEGACY_CLAIM_VERBS =
    'claim|claims|claiming|collect|collects|collecting|withdraw|withdraws|withdrawing|redeem|redeems|'
    + 'call in|calls in|ask for|asks for|present myself|say the words';

/** Standing where the thing is, said without naming it. */
export const LEGACY_HERE =
    /\b(?:here|at (?:this|the) (?:spot|place|ground|stone)|where i (?:buried|left|hid|put) it|in the ground)\b/;

/** Asking what the options are, which needs no verb. */
export const LEGACY_QUESTION =
    /\b(?:what|which|where|who|how|can i|could i|is there|are there)\b/;

/** The custody house a sentence names, or undefined. */
export function custodianNamed(text: string): string | undefined {
    for (const phrase of CUSTODIAN_PHRASES) {
        if (phrase.length >= 6 && text.includes(phrase)) return phrase;
    }
    return undefined;
}

/**
 * The form of words in a sentence, where the player put one in.
 *
 * Pulled out of the RAW INPUT rather than out of a planned action's `topic`,
 * deliberately and for two reasons. A model asked to fill a `topic` field will
 * paraphrase, and a paraphrased phrase is a phrase that does not open the
 * entry. And this way the phrase is never something a model produced, which
 * keeps it on the same footing as everything else the engine treats as
 * authoritative.
 *
 * Quotes first, because a player who quotes has been explicit and should get
 * exactly what they typed, spaces and all. Then the markers a person actually
 * uses. Never falls back to "the rest of the sentence": a lodge with no phrase
 * in it must be refused rather than sealed against half a sentence the player
 * did not mean.
 */
export function phraseIn(input: string): string | undefined {
    const quoted = /["“']([^"”']{3,200})["”']/.exec(input);
    if (quoted) return quoted[1].trim();

    const marked = new RegExp(
        '\\b(?:the (?:words?|phrase|passphrase|password|form of words) (?:are|is)'
        + '|under the (?:phrase|words|password)|with the words|against the (?:phrase|words)'
        + '|the words[:,]|password[:,]?|saying)\\s+(.{3,200}?)\\s*[.!?]?$',
        'i'
    ).exec(input);
    const found = marked?.[1]?.trim();
    return found && found.length >= 3 ? found : undefined;
}

/** What `actions.ts` returns for this surface. Assignable to `PlannedAction`. */
export interface LegacyPlan {
    action: 'legacy';
    intent: LegacyIntent;
    target?: string;
    days?: number;
}

/**
 * One of the five steps, or null.
 *
 * `usedAsVerb` is passed in rather than imported so this module does not depend
 * on `actions.ts` and the two cannot form a cycle. `actions.ts` already exports
 * it, and passing it keeps the position rule - a verb counts in verb position
 * and not behind an article - identical to every other branch in the table.
 */
export function legacyStep(
    text: string,
    usedAsVerb: (text: string, verbs: string) => boolean,
    days: number | undefined
): LegacyPlan | null {
    const house = custodianNamed(text);
    const noun = LEGACY_NOUNS.test(text);
    const here = LEGACY_HERE.test(text);

    // Burying, said plainly. First, because "I bury my things here" contains a
    // noun the lodge branch would also accept and an adverbial the dig branch
    // would.
    if (usedAsVerb(text, LEGACY_BURY_VERBS_ALONE)) {
        return { action: 'legacy', intent: 'bury', ...(days !== undefined ? { days } : {}) };
    }

    // Digging. Needs the noun or the standing-here phrasing, so that "I dig for
    // roots" stays with gathering and "I dig up the grave of Shen Guyi" has
    // already been taken by the site block above.
    //
    // Ahead of the anchored burial branch below, and that ordering is
    // load-bearing: "I dig where I buried it" contains a burial word AND the
    // standing-here phrasing, and it is unambiguously a sentence about digging.
    if (usedAsVerb(text, LEGACY_DIG_VERBS) && (noun || here)) {
        return { action: 'legacy', intent: 'dig' };
    }

    // Burying, said the way people actually say it.
    //
    // "I spend a season burying my things here" puts the verb behind a noun
    // phrase, so `usedAsVerb` correctly declines it - the position rule is
    // protecting every other branch and is doing its job. What rescues this one
    // is the anchor: with a cache noun or a standing-here phrase in the
    // sentence there is nothing else it could be about, so the burial word is
    // accepted wherever it sits. Found by writing out the sentences somebody
    // would type rather than the one shape the parser happened to accept.
    if ((noun || here)
        && (usedAsVerb(text, LEGACY_BURY_VERBS_ANCHORED) || LEGACY_BURY_ANYWHERE.test(text))) {
        return { action: 'legacy', intent: 'bury', ...(days !== undefined ? { days } : {}) };
    }

    // Lodging. Needs a named house, because "I leave" without one is resigning
    // from a sect and that branch sits above this.
    if (house !== undefined && usedAsVerb(text, LEGACY_LODGE_VERBS)) {
        return { action: 'legacy', intent: 'lodge', target: house };
    }

    // Collecting. Same requirement, same reason: "I claim it" with no house
    // named is the prize behind a door.
    if (house !== undefined && usedAsVerb(text, LEGACY_CLAIM_VERBS)) {
        return { action: 'legacy', intent: 'claim', target: house };
    }

    // The listing, which is the sentence before all four and names nothing on
    // purpose. A question with the noun in it, or somebody asking outright
    // where a thing could be left.
    if ((noun || house !== undefined) && LEGACY_QUESTION.test(text)) {
        return { action: 'legacy', intent: 'counters', ...(house ? { target: house } : {}) };
    }
    if (/\b(?:where (?:can|could|should) i (?:leave|lodge|bury|put|keep)|who (?:would|will) hold)\b/.test(text)) {
        return { action: 'legacy', intent: 'counters' };
    }
    // Asking after the dead rather than after the counter. Measured as a
    // plain-tier miss: "who left something behind" reached nothing, and it is
    // the question somebody asks before they know the word `deposit`. Narrow
    // to the past tense and to the leaving-behind phrasing, so that "I leave
    // my things with the Iron Bell" stays a lodgement and "who will hold this
    // for me" stays the branch above.
    if (/\bwho (?:else )?(?:left|has left|had left)\b[^.?!]*\bbehind\b/.test(text)) {
        return { action: 'legacy', intent: 'counters' };
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// THE HANDLER
//
// The five steps, assembled here rather than in `game.ts` so that adding this
// surface to the played game is an import, a field and one switch arm. Every
// write goes through the injected `LegacyDeps`, so this module opens no
// database handle of its own and can be tested against a fake.
//
// `game.ts` owns the writes in the sense that matters: it supplies the mover,
// the ledger and the clock, and it decides how many days the turn costs. What
// is here is which of the five happened and what the world says about it.
// ─────────────────────────────────────────────────────────────────────────

/** Mirrors `ToolCallRecord` in `game.ts`, structurally, to avoid a cycle. */
export interface LegacyCall {
    name: string;
    action: string;
    summary: string;
    ok: boolean;
}

export type LegacyIntent = 'counters' | 'bury' | 'dig' | 'lodge' | 'claim';

/** What an unrecognised intent means. The read that costs nothing. */
export const DEFAULT_LEGACY_INTENT: LegacyIntent = 'counters';

export const LEGACY_INTENTS: readonly LegacyIntent[] = ['counters', 'bury', 'dig', 'lodge', 'claim'] as const;

export interface LegacyDeps {
    ledger: LegacyLedger;
    mover: GoodsMover;
    cultivator: Cultivator;
    /** Where they are standing, which is the only place they can bury or dig. */
    here: string;
    /** `WorldState.seed`. Null where no world is running. */
    worldSeed: string | null;
    /** `WorldState.currentDay`. Null where no world is running. */
    worldDay: number | null;
    runId: string;
    /** People at hand who could see what is being done. From `othersPresent`. */
    watchers: number;
    /** What the pouch holds, as stacks. */
    pouch: GoodStack[];
    road?: OutOfRoad;
}

export interface LegacyOutcome {
    facts: EngineFacts;
    calls: LegacyCall[];
    /** True where the engine declined to act. Maps to `outcome: 'refused'`. */
    refused: boolean;
    /** Days the turn cost. Zero for every read and for every refusal. */
    daysSpent: number;
}

/** No world, no seed. Everything still works; nothing decays. */
const NO_WORLD_SEED = 'no-world';

function read(facts: EngineFacts, calls: LegacyCall[]): LegacyOutcome {
    return { facts, calls, refused: false, daysSpent: 0 };
}

function decline(headline: string, scene: string, mechanical: string): LegacyOutcome {
    return {
        facts: { headline, lines: [scene], structure: [mechanical], prose: scene },
        calls: [{ name: 'engine.legacyLedger', action: 'legacy', summary: mechanical, ok: false }],
        refused: true,
        daysSpent: 0
    };
}

/**
 * The whole surface, in one call.
 *
 * `days` is the burial effort and is ignored by every other intent.
 * `phrase` carries the form of words for `lodge` and `claim` and is never
 * logged, never put in a `structure` line, and never returned.
 */
export function handleLegacy(
    deps: LegacyDeps,
    intent: LegacyIntent,
    target: string | undefined,
    phrase: string | undefined,
    days: number
): LegacyOutcome {
    const seed = deps.worldSeed ?? NO_WORLD_SEED;

    switch (intent) {
        case 'bury':
            return bury(deps, days);
        case 'dig':
            return dig(deps, seed);
        case 'lodge':
            return lodge(deps, target, phrase);
        case 'claim':
            return claim(deps, seed, target, phrase);
        case 'counters':
        default:
            return read(factsForCounters(deps.here, deps.road), [{
                name: 'engine.legacyLedger',
                action: 'legacy',
                summary: `Listed ${CUSTODY_TAKERS.length} custody counters and the ground at '${groundOf(deps.here)}'. Read only.`,
                ok: true
            }]);
    }
}

/**
 * Everything the cultivator is carrying goes in.
 *
 * Deliberately all-or-nothing rather than itemised. A player choosing exactly
 * which four herbs to bury is a spreadsheet, and the act being modelled is
 * somebody who is finished putting their things in the ground. What they keep
 * back is what they buy food with, so the purse is left with enough for a month
 * of rations - burying yourself to death on the way home is a comedy the engine
 * should not be writing.
 */
export const KEPT_BACK_STONES = 2;

function bury(deps: LegacyDeps, days: number): LegacyOutcome {
    const place = deps.here.trim();
    if (place.length < 2) {
        return decline(
            'Nowhere to bury it.',
            'You look for somewhere to put it and cannot say where you are well enough to find this again.',
            'This cultivator has no location on record, so a cache row would carry no place key and could never be dug up again.'
        );
    }

    const wanted: LegacyGoods = {
        spiritStones: Math.max(0, deps.cultivator.spiritStones - KEPT_BACK_STONES),
        items: deps.pouch
    };
    if (goodsAreEmpty(wanted)) {
        return decline(
            'Nothing to bury.',
            `You have ${deps.cultivator.spiritStones} stone${deps.cultivator.spiritStones === 1 ? '' : 's'} and an empty pouch. There is no version of this that is worth the digging.`,
            `Nothing above the ${KEPT_BACK_STONES}-stone floor and no pouch stock. No row written.`
        );
    }

    const taken = liftGoods(deps.mover, deps.cultivator, wanted);
    const ground = groundOf(place);
    const spent = Math.max(1, Math.floor(days));
    const record: CacheRecord = {
        kind: 'cache',
        id: deps.ledger.nextId(deps.runId, 'cache'),
        buriedByRunId: deps.runId,
        place,
        ground,
        burial: {
            ground,
            daysSpent: spent,
            burierOrdinal: deps.cultivator.realmOrdinal,
            anchored: false,
            watchers: deps.watchers
        },
        buriedOnWorldDay: deps.worldDay,
        goods: taken,
        liftedOnWorldDay: null,
        liftedByRunId: null,
        goneOnWorldDay: null,
        fromDepositId: null
    };
    deps.ledger.write(record, `A cache at ${place}`, deps.worldDay);

    const facts = factsForBuried(deps.cultivator, record, deps.watchers);
    return {
        facts,
        calls: [{ name: 'engine.legacyLedger', action: 'legacy', summary: facts.structure[0], ok: true }],
        refused: false,
        daysSpent: spent
    };
}

function dig(deps: LegacyDeps, seed: string): LegacyOutcome {
    const place = deps.here.trim();
    const here = deps.ledger.cachesAt(place);
    const readings = here.map(record => readCache(record, seed, deps.worldDay));

    for (const reading of readings) {
        if (reading.recoverable) {
            applyGoods(deps.mover, deps.cultivator.id, reading.record.goods);
            deps.ledger.patch({
                ...reading.record,
                liftedOnWorldDay: deps.worldDay ?? 0,
                liftedByRunId: deps.runId
            });
        } else if (reading.fate && !reading.fate.stillThere && reading.record.goneOnWorldDay === null) {
            // The world got there first, and the finding is written down so it
            // is a fact about the ground rather than a query somebody reruns.
            deps.ledger.patch({ ...reading.record, goneOnWorldDay: deps.worldDay ?? 0 });
        }
    }

    const facts = factsForDugUp(place, readings);
    return {
        facts,
        // A day with a spade. Cheap enough that a player may look anywhere and
        // expensive enough that looking everywhere is not a strategy.
        daysSpent: 1,
        refused: false,
        calls: readings.length === 0
            ? [{ name: 'engine.legacyLedger', action: 'legacy', summary: facts.structure[0], ok: false }]
            : readings.map(r => ({
                name: 'engine.legacyLedger', action: 'legacy', summary: r.structure, ok: r.recoverable
            }))
    };
}

function lodge(deps: LegacyDeps, target: string | undefined, phrase: string | undefined): LegacyOutcome {
    const terms = resolveCustodian(target);
    if (!terms) {
        return {
            ...read(factsForCounters(deps.here, deps.road), [{
                name: 'engine.legacyLedger',
                action: 'legacy',
                summary: `No custody house resolved from '${target ?? ''}'. Listed the counters instead, which is the cheapest branch.`,
                ok: false
            }])
        };
    }
    const view = counters().find(c => c.terms.factionId === terms.factionId);
    if (!view) {
        return decline(
            'Nobody at that counter.',
            'The house is not taking deposits.',
            `${terms.factionId} has custody terms but no standing in the catalog.`
        );
    }

    const rejection = phraseIsWritable(phrase ?? '');
    if (rejection !== null) {
        return decline(
            `${view.houseName} needs a form of words.`,
            rejection === 'too_short'
                ? 'The clerk waits with the pen down. A word or two is a thing somebody guesses on a wet afternoon, and the house will not write it. Say something longer, and something you will still have in your head in a hundred years.'
                : 'The clerk stops writing partway through and asks for something shorter. A paragraph is not a form of words, and nobody is going to recite it correctly at this counter in three centuries.',
            `Phrase rejected: ${rejection}. Nothing written. The attempted phrase is not logged.`
        );
    }

    const term = Math.max(terms.minimumTermYears, terms.minimumTermYears);
    const fee = feeForTerm(terms, term);
    if (deps.cultivator.spiritStones < fee) {
        return decline(
            `${view.houseName} wants ${fee} stones in advance.`,
            `The fee is ${fee} stones for ${term} years, payable now, and you are carrying ${deps.cultivator.spiritStones}. The clerk does not offer terms and does not appear to have the authority to.`,
            `Fee ${fee} for ${term}y at ${terms.annualFeeStones}/y; purse holds ${deps.cultivator.spiritStones}. Nothing written.`
        );
    }

    if (fee > 0) deps.mover.stones(deps.cultivator.id, -fee);
    const goods = liftGoods(deps.mover, deps.cultivator, {
        spiritStones: Math.max(0, deps.cultivator.spiritStones - fee - KEPT_BACK_STONES),
        items: deps.pouch
    });

    const id = deps.ledger.nextId(deps.runId, 'deposit');
    const record: DepositRecord = {
        kind: 'deposit',
        id,
        lodgedByRunId: deps.runId,
        factionId: terms.factionId,
        sealed: sealPhrase(id, phrase ?? ''),
        wordCount: wordCountOf(phrase ?? ''),
        lodgedOnWorldDay: deps.worldDay,
        termYears: term,
        feePaidStones: fee,
        wrongAttempts: 0,
        closed: false,
        goods,
        collectedOnWorldDay: null,
        collectedByRunId: null
    };
    deps.ledger.write(record, `A deposit with ${view.houseName}`, deps.worldDay);

    const facts = factsForLodged(record, view, whatWasWrittenDown(phrase ?? ''));
    return {
        facts,
        calls: [{ name: 'engine.legacyLedger', action: 'legacy', summary: facts.structure[0], ok: true }],
        refused: false,
        daysSpent: 0
    };
}

function claim(
    deps: LegacyDeps,
    seed: string,
    target: string | undefined,
    phrase: string | undefined
): LegacyOutcome {
    const terms = resolveCustodian(target);
    if (!terms) {
        return read(factsForCounters(deps.here, deps.road), [{
            name: 'engine.legacyLedger',
            action: 'legacy',
            summary: `No custody house resolved from '${target ?? ''}'. Listed the counters instead.`,
            ok: false
        }]);
    }

    const entries = deps.ledger.depositsWith(terms.factionId);
    const readings = entries
        .map(entry => readDeposit(entry, seed, deps.worldDay))
        .filter((r): r is DepositReading => r !== null);

    if (readings.length === 0) {
        return decline(
            `${getSect(terms.factionId)?.name ?? terms.factionId} has nothing on that.`,
            'The clerk hears you out, checks, and tells you there is no entry here answering to anything you have said. There is no suggestion that you are lying and no suggestion that you are not.',
            `No deposit rows for ${terms.factionId} in this campaign.`
        );
    }

    // The claimant says the words once and the house checks every entry it is
    // holding, which is what a counter would actually do. A phrase that opens
    // nothing is one wrong attempt against every LIVE entry, which is the
    // reason a fraud is expensive rather than free.
    for (const reading of readings) {
        if (!phrase || !phraseOpens(reading.record.sealed, reading.record.id, phrase)) continue;
        if (!reading.payable) {
            return {
                facts: factsForClaim(reading, {
                    paid: false, refusal: reading.refusal, hintLines: [], attemptsLeft: 0
                }),
                calls: [{ name: 'engine.legacyLedger', action: 'legacy', summary: reading.structure, ok: false }],
                refused: true,
                daysSpent: 0
            };
        }
        applyGoods(deps.mover, deps.cultivator.id, reading.record.goods);
        deps.ledger.patch({
            ...reading.record,
            collectedOnWorldDay: deps.worldDay ?? 0,
            collectedByRunId: deps.runId
        });
        return {
            facts: factsForClaim(reading, { paid: true, refusal: null, hintLines: [], attemptsLeft: 0 }),
            calls: [{ name: 'engine.legacyLedger', action: 'legacy', summary: reading.structure, ok: true }],
            refused: false,
            daysSpent: 0
        };
    }

    // Nothing opened. Charge the attempt against every entry still open.
    const live = readings.filter(r => r.payable || r.refusal === null);
    let hintLines: string[] = [];
    let attemptsLeft = 0;
    for (const reading of live) {
        const outcome = recordWrongPhrase(reading.record, reading.terms, deps.worldDay);
        deps.ledger.patch(outcome.record);
        hintLines = outcome.hintLines;
        attemptsLeft = outcome.attemptsLeft;
    }

    const shown = readings[0];
    return {
        facts: factsForClaim(shown, {
            paid: false,
            refusal: live.length > 0 ? 'wrong_phrase' : shown.refusal,
            hintLines,
            attemptsLeft
        }),
        calls: [{
            name: 'engine.legacyLedger',
            action: 'legacy',
            summary:
                `Wrong phrase at ${terms.factionId}. ${live.length} live entry/entries charged one attempt; `
                + `${attemptsLeft} left. The attempted phrase is not logged.`,
            ok: false
        }],
        refused: true,
        daysSpent: 0
    };
}

// Re-exported so `game.ts` reaches the whole surface through one import, on the
// `trials.ts` precedent.
export {
    phraseIsWritable,
    phraseOpens,
    sealPhrase,
    wordCountOf,
    feeForTerm,
    ANCHORING_A_CACHE,
    CUSTODY_TAKERS
};
export type { CustodyTerms, CacheBurial, HolderStanding, SealedPhrase };
