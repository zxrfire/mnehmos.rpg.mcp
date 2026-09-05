/**
 * Putting things beyond your own death.
 *
 * Two routes with two different failure modes, one hard invariant, and one
 * secret the engine is not allowed to know. In order of how badly a defect
 * would hurt:
 *
 *  1. A CLAIM MUST NOT BE A REVIVAL. `applyGoods` is the only function in the
 *     package that writes to a cultivator off an inherited row, and the test
 *     for it diffs the whole cultivator row and demands that nothing but the
 *     purse and the pouch moved. If that ever passes for the wrong reason,
 *     permadeath has quietly become a save file.
 *
 *  2. THE PHRASE MUST NOT BE RECOVERABLE. Not from the row, not from the hint,
 *     not from any exported function. The test greps the persisted blob for the
 *     plaintext and for every substring of it long enough to matter.
 *
 *  3. NEITHER ROUTE MAY BE SAFE. A cache that always survives is a bank account
 *     with extra steps; a deposit that always pays out is worse, because it is
 *     also free of the walk. Both are asserted to lose sometimes, and to lose
 *     for different reasons.
 *
 *  4. A DEPOSIT MUST OUTLIVE THE RUN THAT MADE IT. Written under one run id and
 *     read back with that run gone from the runs table entirely.
 */

import { describe, it, expect } from 'vitest';

import Database from 'better-sqlite3';

import { migrate } from '../../src/storage/migrations';
import {
    LegacyLedger,
    applyGoods,
    counters,
    custodyBand,
    describeGoods,
    elapsedYears,
    groundOf,
    liftGoods,
    oddsGoneIn,
    oddsHolderFailsIn,
    readCache,
    readDeposit,
    recordWrongPhrase,
    resolveCustodian,
    sealPhrase,
    phraseOpens,
    vaultAsACache,
    handleLegacy,
    legacyStep,
    phraseIn,
    CUSTODIAN_PHRASES,
    DEFAULT_LEGACY_INTENT,
    type CacheRecord,
    type DepositRecord,
    type GoodsMover,
    type GoodStack,
    type LegacyDeps,
    type LegacyGoods
} from '../../src/web/leaving-things-for-the-next-life';
import {
    CUSTODY_TAKERS,
    A_DEPOSIT_IS_NOT_A_LIFE,
    custodyTermsFor,
    feeForTerm
} from '../../src/data/cultivation/institutions-that-hold-deposits-for-the-dead';
import { standingOf } from '../../src/engine/world/whether-a-house-still-honours-a-deposit';
import { getSect } from '../../src/data/cultivation/sects';
import { usedAsVerb } from '../../src/web/actions';
import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation';

const SEED = 'left-behind';

/**
 * The real migrations on an in-memory database.
 *
 * Deliberately NOT `harness.makeDb`, which reaches `game.ts` and therefore the
 * whole web package. Nothing under test here needs the service, and taking the
 * dependency would make this file fail whenever somebody else is mid-edit in a
 * module it never uses.
 */
function makeDb(): Database.Database {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    return db;
}

function goods(stones: number, items: LegacyGoods['items'] = []): LegacyGoods {
    return { spiritStones: stones, items };
}

function cache(overrides: Partial<CacheRecord> = {}): CacheRecord {
    return {
        kind: 'cache',
        id: 'cache::run-a::1',
        buriedByRunId: 'run-a',
        place: 'Iron Gate Ford',
        ground: 'waystation',
        burial: { ground: 'waystation', daysSpent: 7, burierOrdinal: 6, anchored: false, watchers: 0 },
        buriedOnWorldDay: 1_000,
        goods: goods(400, [{ itemId: 'pill-qi-gathering', kind: 'pill', quantity: 2 }]),
        liftedOnWorldDay: null,
        liftedByRunId: null,
        goneOnWorldDay: null,
        fromDepositId: null,
        ...overrides
    };
}

function deposit(overrides: Partial<DepositRecord> = {}): DepositRecord {
    const phrase = 'the third stone by the ford';
    return {
        kind: 'deposit',
        id: 'deposit::run-a::1',
        lodgedByRunId: 'run-a',
        factionId: 'house-ninefold-ledger',
        sealed: sealPhrase('deposit::run-a::1', phrase),
        wordCount: 6,
        lodgedOnWorldDay: 1_000,
        termYears: 300,
        feePaidStones: 6_300,
        wrongAttempts: 0,
        closed: false,
        goods: goods(900),
        collectedOnWorldDay: null,
        collectedByRunId: null,
        ...overrides
    };
}

// ═════════════════════════════════════════════════════════════════════════
// 1. A CLAIM IS NOT A REVIVAL
// ═════════════════════════════════════════════════════════════════════════

describe('objects cross and nothing else does', () => {
    /**
     * A mover backed by real rows, so the test is diffing the database rather
     * than a stub's idea of what the database would have done.
     */
    function moverFor(db: ReturnType<typeof makeDb>): GoodsMover {
        return {
            stones: (id, delta) =>
                db.prepare('UPDATE cultivators SET spirit_stones = MAX(0, spirit_stones + ?) WHERE id = ?')
                    .run(delta, id),
            add: (id, stack) =>
                db.prepare(`
                    INSERT INTO cultivator_pouch (cultivator_id, item_id, item_kind, quantity)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(cultivator_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity
                `).run(id, stack.itemId, stack.kind, stack.quantity),
            take: (id, stack) => {
                const held = db
                    .prepare('SELECT quantity FROM cultivator_pouch WHERE cultivator_id = ? AND item_id = ?')
                    .get(id, stack.itemId) as { quantity: number } | undefined;
                if (!held || held.quantity < stack.quantity) return false;
                db.prepare('UPDATE cultivator_pouch SET quantity = quantity - ? WHERE cultivator_id = ? AND item_id = ?')
                    .run(stack.quantity, id, stack.itemId);
                return true;
            }
        };
    }

    function seedCultivator(db: ReturnType<typeof makeDb>, id: string): void {
        db.prepare(`
            INSERT INTO cultivators (id, name, spirit_root, attributes,
                realm_ordinal, cultivation_progress, hp, max_hp, qi, max_qi, spirit_stones)
            VALUES (?, 'Claimant', 'single_metal', '{"might":2,"insight":2,"fortune":2,"charm":2}',
                4, 12.5, 40, 40, 30, 30, 12)
        `).run(id);
    }

    it('a claim moves the purse and the pouch, and moves nothing about the person', () => {
        const db = makeDb();
        seedCultivator(db, 'heir');
        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get('heir') as Record<string, unknown>;

        applyGoods(moverFor(db), 'heir', goods(900, [{ itemId: 'pill-qi-gathering', kind: 'pill', quantity: 3 }]));

        const after = db.prepare('SELECT * FROM cultivators WHERE id = ?').get('heir') as Record<string, unknown>;

        // Exactly one column moved, and it is the purse.
        const moved = Object.keys(after).filter(key => String(after[key]) !== String(before[key]));
        expect(moved, `columns that moved: ${moved.join(', ')}`).toEqual(['spirit_stones']);
        expect(after.spirit_stones).toBe(912);

        // And the pouch took the stock, which is the other half of "objects".
        const pouch = db
            .prepare('SELECT item_id, quantity FROM cultivator_pouch WHERE cultivator_id = ?')
            .all('heir') as { item_id: string; quantity: number }[];
        expect(pouch).toEqual([{ item_id: 'pill-qi-gathering', quantity: 3 }]);
    });

    it('the catalog states the invariant and names what may not cross', () => {
        // The rule is not enforced by discipline alone: it is written down, and
        // everything it forbids is a real column on the cultivator row.
        expect(A_DEPOSIT_IS_NOT_A_LIFE.whatCrosses.length).toBe(2);
        for (const forbidden of ['realm ordinal', 'standing', 'knowledge records']) {
            expect(A_DEPOSIT_IS_NOT_A_LIFE.whatDoesNotCross.join(' ')).toContain(forbidden);
        }
    });

    it('burying takes only what the cultivator actually holds', () => {
        const db = makeDb();
        seedCultivator(db, 'burier');
        // Twelve stones in the purse; a hundred is asked for.
        const taken = liftGoods(
            moverFor(db),
            { id: 'burier', spiritStones: 12 } as never,
            goods(100, [{ itemId: 'pill-nobody-has', kind: 'pill', quantity: 1 }])
        );
        expect(taken.spiritStones).toBe(12);
        // A stack the pouch was short of is not recorded as buried at all.
        expect(taken.items).toEqual([]);
        const row = db.prepare('SELECT spirit_stones FROM cultivators WHERE id = ?').get('burier') as { spirit_stones: number };
        expect(row.spirit_stones).toBe(0);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. THE PHRASE IS NOT IN THE DATABASE
// ═════════════════════════════════════════════════════════════════════════

describe('the phrase is the player\'s, not the engine\'s', () => {
    it('nothing persisted contains the phrase or any long part of it', () => {
        const db = makeDb();
        const ledger = new LegacyLedger(db);
        // No word here appears anywhere else in the row - a phrase that shared
        // a word with the holder's own id ("ninefold") would fail this check
        // for a reason that is about the fixture rather than about the seal.
        const phrase = 'willows at the drowned weir';
        const record = deposit({ sealed: sealPhrase('deposit::run-a::1', phrase), wordCount: 5 });
        ledger.write(record, 'A deposit', 1_000);

        const stored = db
            .prepare('SELECT contents FROM cultivation_sites WHERE id = ?')
            .get(record.id) as { contents: string };

        expect(stored.contents).not.toContain(phrase);
        // Every word of it, and every run of two words. A digest that leaked a
        // fragment would fail here rather than in somebody's play session.
        // Words of four letters and up, plus every adjacent pair. Short
        // function words are excluded because "at" turns up inside
        // "wrongAttempts" and a check that fires on that is measuring JSON key
        // names rather than the seal.
        const words = phrase.split(' ');
        const blob = stored.contents.toLowerCase();
        for (let i = 0; i < words.length; i += 1) {
            if (words[i].length >= 4) expect(blob).not.toContain(words[i]);
            if (i + 1 < words.length) expect(blob).not.toContain(`${words[i]} ${words[i + 1]}`);
        }
    });

    it('case, punctuation and spacing do not matter; word order does', () => {
        const sealed = sealPhrase('e1', 'The Third Stone, by the Ford.');
        expect(phraseOpens(sealed, 'e1', 'the third stone by the ford')).toBe(true);
        expect(phraseOpens(sealed, 'e1', '  THE   THIRD  STONE BY THE FORD  ')).toBe(true);
        expect(phraseOpens(sealed, 'e1', 'the ford by the third stone')).toBe(false);
        // And a digest cannot be moved between entries.
        expect(phraseOpens(sealed, 'e2', 'the third stone by the ford')).toBe(false);
    });

    it('the hint says what the book holds and never any part of the words', () => {
        const record = deposit();
        const terms = custodyTermsFor('house-ninefold-ledger')!;
        const { hintLines } = recordWrongPhrase(record, terms, 2_000);
        const said = hintLines.join(' ').toLowerCase();
        for (const word of ['third', 'stone', 'ford']) {
            expect(said).not.toContain(word);
        }
        // What it DOES say is the count and the day, which a clerk has.
        expect(said).toContain('6 words');
    });

    it('a house that keeps a book runs out of patience; one that does not, cannot count reliably', () => {
        const strict = custodyTermsFor('house-bound-word')!;
        const loose = custodyTermsFor('sect-thousand-treasure-pavilion')!;
        expect(strict.attemptsAllowed).toBeLessThan(loose.attemptsAllowed);
        expect(strict.keepsWrittenRecord).toBe(true);
        expect(loose.keepsWrittenRecord).toBe(false);

        // And running out closes the entry against everybody, not just the fraud.
        let record = deposit({ factionId: 'house-bound-word', wrongAttempts: 0 });
        for (let i = 0; i < strict.attemptsAllowed; i += 1) {
            record = recordWrongPhrase(record, strict, 2_000).record;
        }
        expect(record.closed).toBe(true);
        const reading = readDeposit(record, SEED, 2_000)!;
        expect(reading.refusal).toBe('entry_closed');
        expect(reading.payable).toBe(false);
    });

    it('a house with no book cannot read the day or the count back', () => {
        const loose = custodyTermsFor('sect-thousand-treasure-pavilion')!;
        const { hintLines } = recordWrongPhrase(deposit({ factionId: loose.factionId }), loose, 2_000);
        expect(hintLines.join(' ')).toContain('no book');
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. NEITHER ROUTE IS SAFE
// ═════════════════════════════════════════════════════════════════════════

describe('both routes lose, and they lose differently', () => {
    it('a cache in a city is far worse than a cache off the map', () => {
        const inTown = { ground: 'city' as const, daysSpent: 7, burierOrdinal: 6, anchored: false, watchers: 0 };
        const offMap = { ...inTown, ground: 'unplaceable' as const };
        expect(oddsGoneIn(inTown, 200)).toBeGreaterThan(oddsGoneIn(offMap, 200) * 3);
    });

    it('digging longer, standing higher and paying the Anchorhold all help', () => {
        const base = { ground: 'village' as const, daysSpent: 1, burierOrdinal: 0, anchored: false, watchers: 0 };
        expect(oddsGoneIn({ ...base, daysSpent: 60 }, 200)).toBeLessThan(oddsGoneIn(base, 200));
        expect(oddsGoneIn({ ...base, burierOrdinal: 30 }, 200)).toBeLessThan(oddsGoneIn(base, 200));
        expect(oddsGoneIn({ ...base, anchored: true }, 200)).toBeLessThan(oddsGoneIn(base, 200));
    });

    it('somebody watching you dig is the worst thing that can happen to a cache', () => {
        const base = { ground: 'hamlet' as const, daysSpent: 30, burierOrdinal: 20, anchored: true, watchers: 0 };
        expect(oddsGoneIn({ ...base, watchers: 1 }, 100)).toBeGreaterThan(oddsGoneIn(base, 100) * 2);
    });

    it('concealment decays, so a very good burial is not a permanent one', () => {
        const good = { ground: 'village' as const, daysSpent: 90, burierOrdinal: 30, anchored: false, watchers: 0 };
        const bare = { ...good, daysSpent: 1, burierOrdinal: 0 };
        // At fifty years the careful burial is worth a great deal.
        const earlyGap = oddsGoneIn(bare, 50) / oddsGoneIn(good, 50);
        // At a thousand it has been spent down and the ground is carrying it.
        const lateGap = oddsGoneIn(bare, 1_000) / oddsGoneIn(good, 1_000);
        expect(earlyGap).toBeGreaterThan(lateGap);
    });

    it('no cache is certain to survive a long enough wait', () => {
        const best = { ground: 'unplaceable' as const, daysSpent: 90, burierOrdinal: 45, anchored: true, watchers: 0 };
        expect(oddsGoneIn(best, 2_000)).toBeGreaterThan(0.1);
    });

    it('an old house is a better bet than a young one and the player can see it first', () => {
        const ledger = standingOf('house-ninefold-ledger', true)!;
        const pavilion = standingOf('sect-thousand-treasure-pavilion', false)!;
        expect(ledger.yearsStanding).toBeGreaterThan(3_000);
        expect(pavilion.yearsStanding).toBeNull();
        expect(oddsHolderFailsIn(ledger, 500)).toBeLessThan(oddsHolderFailsIn(pavilion, 500));

        // And the pre-deposit read orders them without printing a rate.
        const listed = counters();
        expect(listed.length).toBe(CUSTODY_TAKERS.length);
        const names = listed.map(view => view.houseName);
        expect(names.indexOf('The Ninefold Ledger')).toBeLessThan(names.indexOf('Thousand Treasure Pavilion'));
        for (const view of listed) {
            expect(['as safe as anything gets', 'sound', 'a risk', 'a bad bet']).toContain(view.band);
        }
    });

    it('no house is certain either, and the risk grows with time rather than sitting still', () => {
        const best = standingOf('house-measured-span', true)!;
        expect(oddsHolderFailsIn(best, 100)).toBeLessThan(oddsHolderFailsIn(best, 800));
        expect(oddsHolderFailsIn(best, 2_000)).toBeGreaterThan(0.1);
    });

    it('a house that has quietly stopped doing its job is a worse holder', () => {
        // The Pavilion carries a `quietlyStopped` line in the character catalog
        // and the hazard reads it rather than inventing a reliability figure.
        const pavilion = standingOf('sect-thousand-treasure-pavilion', false)!;
        expect(pavilion.hasQuietlyStopped).toBe(true);
        expect(custodyBand(pavilion)).not.toBe('as safe as anything gets');
    });

    it('the two routes fail for unrelated reasons', () => {
        // The same seed and the same id must not make one route's answer
        // predict the other's: they are different streams over different facts.
        const record = cache();
        const reading = readCache(record, SEED, 1_000 + 400 * DAYS_PER_YEAR);
        const dep = readDeposit(deposit(), SEED, 1_000 + 400 * DAYS_PER_YEAR)!;
        expect(reading.fate!.threshold).not.toBe(dep.fate!.threshold);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. IT OUTLIVES THE RUN
// ═════════════════════════════════════════════════════════════════════════

describe('a thing left behind outlives the life that left it', () => {
    it('a cache is readable with the run that buried it gone from the runs table', () => {
        const db = makeDb();
        const ledger = new LegacyLedger(db);
        ledger.write(cache(), 'A cache at Iron Gate Ford', 1_000);

        // There is no run row and there never has to be: `cultivation_sites`
        // carries no foreign key on run_id, on purpose.
        expect(db.prepare('SELECT COUNT(*) AS n FROM runs').get()).toEqual({ n: 0 });

        // And the read is not scoped to a run, which is the whole point.
        const found = ledger.cachesAt('the Iron Gate Ford');
        expect(found.length).toBe(1);
        expect(found[0].buriedByRunId).toBe('run-a');
    });

    it('a deposit is readable by a different run entirely', () => {
        const db = makeDb();
        const ledger = new LegacyLedger(db);
        ledger.write(deposit(), 'A deposit with the Ninefold Ledger', 1_000);

        expect(ledger.leftByRun('run-b')).toEqual([]);
        const theirs = ledger.depositsWith('house-ninefold-ledger');
        expect(theirs.length).toBe(1);
        expect(theirs[0].lodgedByRunId).toBe('run-a');
    });

    it('a buried cache is not a discovered site until somebody turns it up', () => {
        const db = makeDb();
        const ledger = new LegacyLedger(db);
        const record = ledger.write(cache(), 'A cache', 1_000) as CacheRecord;
        const before = db.prepare('SELECT discovered FROM cultivation_sites WHERE id = ?').get(record.id);
        expect(before).toEqual({ discovered: 0 });

        ledger.patch({ ...record, liftedOnWorldDay: 9_000, liftedByRunId: 'run-b' });
        const after = db.prepare('SELECT discovered FROM cultivation_sites WHERE id = ?').get(record.id);
        expect(after).toEqual({ discovered: 1 });
    });

    it('the trial ledger cannot see any of it', () => {
        const db = makeDb();
        const ledger = new LegacyLedger(db);
        ledger.write(cache(), 'A cache', 1_000);
        ledger.write(deposit(), 'A deposit', 1_000);
        // `SiteLedger` filters `discovered = 1` and discards ids that are not
        // catalog sites. Both rows fail both conditions.
        const visible = db
            .prepare("SELECT COUNT(*) AS n FROM cultivation_sites WHERE discovered = 1 AND run_id = 'run-a'")
            .get();
        expect(visible).toEqual({ n: 0 });
    });

    it('ids are deterministic and do not collide across runs', () => {
        const db = makeDb();
        const ledger = new LegacyLedger(db);
        const first = ledger.nextId('run-a', 'cache');
        ledger.write(cache({ id: first }), 'A cache', 1_000);
        expect(ledger.nextId('run-a', 'cache')).not.toBe(first);
        expect(ledger.nextId('run-b', 'cache')).toBe('cache::run-b::1');
    });
});

// ═════════════════════════════════════════════════════════════════════════
// THE READS
// ═════════════════════════════════════════════════════════════════════════

describe('reading a cache and a deposit', () => {
    it('the same cache read twice gives the same answer', () => {
        const record = cache();
        const day = 1_000 + 600 * DAYS_PER_YEAR;
        expect(readCache(record, SEED, day)).toEqual(readCache(record, SEED, day));
    });

    it('a cache that has gone stays gone as the clock runs on', () => {
        // A hopeless burial: a hole, in a city, with two people watching.
        const doomed = cache({
            ground: 'city',
            burial: { ground: 'city', daysSpent: 1, burierOrdinal: 0, anchored: false, watchers: 2 }
        });
        const early = readCache(doomed, SEED, 1_000 + 30 * DAYS_PER_YEAR);
        const late = readCache(doomed, SEED, 1_000 + 900 * DAYS_PER_YEAR);
        expect(early.recoverable).toBe(false);
        expect(late.recoverable).toBe(false);
        expect(late.fate!.foundAfterYears).toBe(early.fate!.foundAfterYears);
    });

    it('with no world clock nothing is deleted, and the read says so', () => {
        const homeless = cache({ buriedOnWorldDay: null });
        const reading = readCache(homeless, SEED, null);
        expect(reading.recoverable).toBe(true);
        expect(reading.years).toBeNull();
        expect(reading.structure).toContain('unmeasurable');
        expect(elapsedYears(null, 500)).toBeNull();
    });

    it('a term that has run out is a refusal even at a house that is still standing', () => {
        const short = deposit({ termYears: 25 });
        const reading = readDeposit(short, SEED, 1_000 + 100 * DAYS_PER_YEAR)!;
        expect(reading.lapsed).toBe(true);
        expect(reading.payable).toBe(false);
        expect(['term_lapsed', 'holder_failed']).toContain(reading.refusal);
    });

    it('the holder failing beats the term lapsing', () => {
        // A house that is certain to have failed over this span, on a term that
        // has also certainly run out. The claimant is told about the house.
        const doomed = deposit({ factionId: 'sect-thousand-treasure-pavilion', termYears: 25 });
        const reading = readDeposit(doomed, SEED, 1_000 + 5_000 * DAYS_PER_YEAR)!;
        expect(reading.fate!.fate).not.toBe('honoured');
        expect(reading.refusal).toBe('holder_failed');
    });
});

// ═════════════════════════════════════════════════════════════════════════
// THE BRIDGE
// ═════════════════════════════════════════════════════════════════════════

describe('a burned vault is a hole in the ground and not a third kind of thing', () => {
    it('only the destroyed fate produces a cache, and it carries the goods across', () => {
        const record = deposit();
        // Walk seeds until the manner comes back as the burned one, which is
        // the honest way to test a weighted draw: the weights are the subject,
        // not this particular seed.
        let converted: CacheRecord | null = null;
        for (let i = 0; i < 200 && converted === null; i += 1) {
            const reading = readDeposit(record, `burn-${i}`, 1_000 + 4_000 * DAYS_PER_YEAR);
            if (!reading?.fate || reading.fate.fate !== 'destroyed_vault_intact') continue;
            converted = vaultAsACache(record, reading.fate, 'Green Water City', 'cache::from-deposit::1');
        }
        expect(converted, 'no seed in 200 produced a burned vault').not.toBeNull();
        expect(converted!.kind).toBe('cache');
        expect(converted!.goods).toEqual(record.goods);
        expect(converted!.fromDepositId).toBe(record.id);
        // And it is now ground, so the spatial machinery owns it from here.
        expect(converted!.ground).toBe(groundOf('Green Water City'));
    });

    it('every other fate leaves nothing to dig', () => {
        const record = deposit();
        for (let i = 0; i < 60; i += 1) {
            const reading = readDeposit(record, `no-burn-${i}`, 1_000 + 4_000 * DAYS_PER_YEAR);
            if (!reading?.fate || reading.fate.fate === 'destroyed_vault_intact') continue;
            expect(vaultAsACache(record, reading.fate, 'Green Water City', 'x')).toBeNull();
        }
    });
});

// ═════════════════════════════════════════════════════════════════════════
// THE CATALOG DID NOT GET AN INVENTED FACTION
// ═════════════════════════════════════════════════════════════════════════

describe('nothing here is a body somebody made up', () => {
    it('every custody taker is a faction that already existed', () => {
        for (const terms of CUSTODY_TAKERS) {
            expect(getSect(terms.factionId), `${terms.factionId} is not in sects.ts`).toBeDefined();
        }
    });

    it('every custody is derived from a line the faction already carried', () => {
        // The check that this file is a reading of the catalog rather than an
        // addition to it: the sentence each entry cites has to actually be in
        // the catalog, verbatim.
        const source = getSectsSource();
        for (const terms of CUSTODY_TAKERS) {
            expect(source, `${terms.factionId}: derivedFrom is not in sects.ts`)
                .toContain(terms.derivedFrom);
        }
    });

    it('a sentence naming a house resolves to it, and an invented one resolves to nothing', () => {
        expect(resolveCustodian('the Ninefold Ledger')?.factionId).toBe('house-ninefold-ledger');
        expect(resolveCustodian('held names')?.factionId).toBe('house-held-names');
        expect(resolveCustodian('Lantern Hall')?.factionId).toBe('sect-lantern-hall');
        expect(resolveCustodian('the Bank of the Nine Provinces')).toBeNull();
        expect(resolveCustodian('')).toBeNull();
    });

    it('the free counter is free and the expensive one is expensive', () => {
        expect(feeForTerm(custodyTermsFor('sect-lantern-hall')!, 500)).toBe(0);
        expect(feeForTerm(custodyTermsFor('house-ninefold-ledger')!, 500)).toBeGreaterThan(1_000);
        // And nobody writes a term shorter than their own minimum.
        const held = custodyTermsFor('house-held-names')!;
        expect(feeForTerm(held, 1)).toBe(held.annualFeeStones * held.minimumTermYears);
    });

    it('ground is read off the region catalog, and an unknown name is not treated as busy', () => {
        expect(groundOf('somewhere nobody has ever named')).toBe('unplaceable');
        expect(groundOf('')).toBe('unplaceable');
    });

    it('goods describe themselves without a catalog miss becoming a blank', () => {
        expect(describeGoods(goods(0))).toBe('nothing');
        expect(describeGoods(goods(3))).toContain('3 spirit stones');
        expect(describeGoods(goods(0, [{ itemId: 'not-a-real-pill', kind: 'pill', quantity: 2 }])))
            .toContain('not-a-real-pill');
    });
});

// ═════════════════════════════════════════════════════════════════════════
// THE WHOLE LOOP, ACROSS TWO LIVES
//
// The only test here that exercises what a player actually does. One
// cultivator buries and lodges; that cultivator's run ends; a completely
// different cultivator in a completely different run digs and claims.
// ═════════════════════════════════════════════════════════════════════════

describe('one life puts it aside and another life collects it', () => {
    function harness(seed = SEED) {
        const db = makeDb();
        const ledger = new LegacyLedger(db);
        const pouches = new Map<string, GoodStack[]>();
        const purses = new Map<string, number>();
        const mover: GoodsMover = {
            stones: (id, delta) => purses.set(id, Math.max(0, (purses.get(id) ?? 0) + delta)),
            add: (id, stack) => pouches.set(id, [...(pouches.get(id) ?? []), stack]),
            take: (id, stack) => {
                const held = pouches.get(id) ?? [];
                const at = held.findIndex(s => s.itemId === stack.itemId && s.quantity >= stack.quantity);
                if (at < 0) return false;
                pouches.set(id, held.filter((_, i) => i !== at));
                return true;
            }
        };
        const deps = (over: Partial<LegacyDeps>): LegacyDeps => ({
            ledger,
            mover,
            cultivator: { id: 'a', spiritStones: 5_000, realmOrdinal: 24, name: 'A' } as never,
            here: 'Iron Gate Ford',
            worldSeed: seed,
            worldDay: 100_000,
            runId: 'run-a',
            watchers: 0,
            pouch: [],
            ...over
        });
        return { db, ledger, mover, deps, purses, pouches };
    }

    it('buries in one life and is dug up in the next', () => {
        const h = harness();
        h.purses.set('a', 5_000);

        const buried = handleLegacy(h.deps({}), 'bury', undefined, undefined, 60);
        expect(buried.refused).toBe(false);
        expect(buried.daysSpent).toBe(60);
        // The purse is emptied down to the floor and not below it.
        expect(h.purses.get('a')).toBe(2);

        // A different person, a different run, ten years later, standing on the
        // same ground because the PLAYER remembered where it was.
        h.purses.set('b', 0);
        const dug = handleLegacy(
            h.deps({
                cultivator: { id: 'b', spiritStones: 0, realmOrdinal: 1, name: 'B' } as never,
                runId: 'run-b',
                worldDay: 100_000 + 10 * DAYS_PER_YEAR
            }),
            'dig', undefined, undefined, 0
        );
        expect(dug.refused).toBe(false);
        expect(h.purses.get('b')).toBe(4_998);
        expect(dug.facts.headline).toContain('Lifted');

        // And it does not come up twice.
        const again = handleLegacy(
            h.deps({ cultivator: { id: 'c', spiritStones: 0 } as never, runId: 'run-c' }),
            'dig', undefined, undefined, 0
        );
        expect(again.facts.lines.join(' ')).toContain('already been back');
    });

    it('digging somewhere nobody buried anything finds nothing and costs a day', () => {
        const h = harness();
        const dug = handleLegacy(h.deps({ here: 'a ditch outside Nine Peaks' }), 'dig', undefined, undefined, 0);
        expect(dug.daysSpent).toBe(1);
        expect(dug.facts.headline).toContain('Nothing under');
    });

    it('lodges against a phrase and pays out to a stranger who has it', () => {
        const h = harness();
        h.purses.set('a', 60_000);

        const lodged = handleLegacy(
            h.deps({ cultivator: { id: 'a', spiritStones: 60_000, realmOrdinal: 24 } as never }),
            'lodge', 'the Ninefold Ledger', 'three crows on the weir', 0
        );
        expect(lodged.refused).toBe(false);
        // The fee came out and the rest went in.
        expect(h.purses.get('a')).toBe(2);
        // And the phrase is shown back exactly once, to the person who typed it.
        expect(lodged.facts.lines.join(' ')).toContain('three crows on the weir');
        // Never on the mechanical channel.
        expect(lodged.facts.structure.join(' ')).not.toContain('crows');

        h.purses.set('b', 0);
        const stranger = h.deps({
            cultivator: { id: 'b', spiritStones: 0, realmOrdinal: 2 } as never,
            runId: 'run-b',
            worldDay: 100_000 + 40 * DAYS_PER_YEAR
        });

        // Wrong words: refused, and the refusal says nothing about the words.
        const wrong = handleLegacy(stranger, 'claim', 'the Ninefold Ledger', 'four crows on the weir', 0);
        expect(wrong.refused).toBe(true);
        expect(h.purses.get('b')).toBe(0);
        expect(wrong.facts.lines.join(' ').toLowerCase()).not.toContain('crows');
        expect(wrong.calls[0].summary).not.toContain('crows');

        // Right words, said by somebody who is not the depositor.
        const right = handleLegacy(stranger, 'claim', 'the Ninefold Ledger', 'Three Crows On The Weir.', 0);
        expect(right.refused).toBe(false);
        expect(h.purses.get('b')).toBeGreaterThan(50_000);
        expect(right.facts.lines.join(' ')).toContain('not them');
    });

    it('a fraud who guesses badly enough destroys the entry for whoever could have collected it', () => {
        const h = harness();
        h.purses.set('a', 60_000);
        handleLegacy(
            h.deps({ cultivator: { id: 'a', spiritStones: 60_000, realmOrdinal: 24 } as never }),
            'lodge', 'the Bound Word', 'a boat with no name', 0
        );
        const terms = custodyTermsFor('house-bound-word')!;
        const fraud = h.deps({ cultivator: { id: 'f', spiritStones: 0 } as never, runId: 'run-f' });
        for (let i = 0; i < terms.attemptsAllowed; i += 1) {
            handleLegacy(fraud, 'claim', 'the Bound Word', `guess ${i} at the words`, 0);
        }
        // The right words, too late, said by somebody else entirely.
        const heir = h.deps({ cultivator: { id: 'h', spiritStones: 0 } as never, runId: 'run-h' });
        const late = handleLegacy(heir, 'claim', 'the Bound Word', 'a boat with no name', 0);
        expect(late.refused).toBe(true);
        expect(late.facts.lines.join(' ')).toContain('closed');
    });

    it('a phrase too short to be a secret is refused before anything is written', () => {
        const h = harness();
        h.purses.set('a', 60_000);
        const short = handleLegacy(
            h.deps({ cultivator: { id: 'a', spiritStones: 60_000 } as never }),
            'lodge', 'the Ninefold Ledger', 'dog', 0
        );
        expect(short.refused).toBe(true);
        expect(h.ledger.depositsWith('house-ninefold-ledger')).toEqual([]);
        expect(h.purses.get('a')).toBe(60_000);
    });

    it('a house that will not be paid does not take the goods', () => {
        const h = harness();
        h.purses.set('a', 10);
        const broke = handleLegacy(
            h.deps({ cultivator: { id: 'a', spiritStones: 10 } as never }),
            'lodge', 'the Ninefold Ledger', 'a phrase that is long enough', 0
        );
        expect(broke.refused).toBe(true);
        expect(h.purses.get('a')).toBe(10);
    });

    it('an unrecognised intent falls through to the listing and costs nothing', () => {
        const h = harness();
        const listed = handleLegacy(h.deps({}), DEFAULT_LEGACY_INTENT, undefined, undefined, 0);
        expect(listed.daysSpent).toBe(0);
        expect(listed.refused).toBe(false);
        expect(listed.facts.lines.join(' ')).toContain('two ways');
        // And naming no house at the counter lists rather than committing.
        const vague = handleLegacy(h.deps({}), 'lodge', 'somewhere safe', 'a phrase long enough', 0);
        expect(vague.daysSpent).toBe(0);
        expect(vague.facts.lines.join(' ')).toContain('two ways');
    });

    it('being watched is recorded at the moment of burial and never re-decided', () => {
        const h = harness();
        h.purses.set('a', 500);
        const buried = handleLegacy(h.deps({ watchers: 2 }), 'bury', undefined, undefined, 7);
        expect(buried.facts.lines.join(' ')).toContain('2 people were');
        const [row] = h.ledger.cachesAt('Iron Gate Ford') as CacheRecord[];
        expect(row.burial.watchers).toBe(2);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// THE SENTENCES
//
// The half most likely to hurt somebody else. Four of the five verbs here are
// already owned by another branch, so the tests that matter are the ones
// asserting that a sentence belonging to somebody else does NOT resolve to
// this. `usedAsVerb` is the real one out of `actions.ts`, so the position rule
// under test is the same one the rest of the table uses.
// ═════════════════════════════════════════════════════════════════════════

describe('what a player types to leave something behind', () => {
    const step = (text: string, days?: number) =>
        legacyStep(text.toLowerCase(), usedAsVerb, days);

    it('the four acts, said the ways somebody says them', () => {
        expect(step('I bury my things here')).toMatchObject({ intent: 'bury' });
        expect(step('I bury everything I have by the boundary stone')).toMatchObject({ intent: 'bury' });
        expect(step('I stash my stones in the ground')).toMatchObject({ intent: 'bury' });
        expect(step('I dig here')).toMatchObject({ intent: 'dig' });
        expect(step('I dig up my cache')).toMatchObject({ intent: 'dig' });
        expect(step('I dig where I buried it')).toMatchObject({ intent: 'dig' });
        expect(step('I leave my things with the Ninefold Ledger'))
            .toMatchObject({ intent: 'lodge', target: 'ninefold ledger' });
        expect(step('I deposit everything I have with the house of held names'))
            .toMatchObject({ intent: 'lodge' });
        expect(step('I claim my deposit at the ninefold ledger'))
            .toMatchObject({ intent: 'claim' });
        expect(step('I collect what is held for me at the lantern hall'))
            .toMatchObject({ intent: 'claim' });
    });

    it('the listing is what an unaimed question gets, and it is the cheap one', () => {
        expect(step('where can I leave things for the next life')).toMatchObject({ intent: 'counters' });
        expect(step('what happens to a cache if I bury one')?.intent).toBeDefined();
        expect(step('who would hold a deposit for me')).toMatchObject({ intent: 'counters' });
    });

    it('a burial carries the days the player asked for', () => {
        expect(step('I spend a season burying my things here', 90)).toMatchObject({ intent: 'bury', days: 90 });
    });

    it('does not take a sentence that belongs to somebody else', () => {
        // Every one of these is owned by a branch that sits above this block,
        // and every one contains a verb this block also matches on.
        for (const sentence of [
            'I leave the sect',
            'I leave the Azure Cloud Pavilion',
            'I leave for the Iron Gate Ford',
            'I dig for roots along the bank',
            'I claim the reward',
            'I collect my stipend',
            'I hide in the reeds until they pass',
            'I put away the sword and bow',
            'I withdraw from the fight',
            'I ask for a promotion'
        ]) {
            expect(step(sentence), `stole: ${sentence}`).toBeNull();
        }
    });

    it('a grave being robbed stays a grave being robbed', () => {
        // "dig up" is in `SITE_TAKE_VERBS` and the site block sits above this
        // one, so the protection is order. What this asserts is the other half:
        // with no cache noun and no "here", this block declines it as well, so
        // the ordering is a belt and the pattern is braces.
        expect(step('I dig up the grave of Shen Guyi')).toBeNull();
        expect(step('I rob the grave')).toBeNull();
    });

    it('a phrase is pulled out of what the player typed, never invented', () => {
        expect(phraseIn('I lodge it with the Ledger, the words are "three crows on the weir"'))
            .toBe('three crows on the weir');
        expect(phraseIn('I deposit it under the phrase three crows on the weir'))
            .toBe('three crows on the weir');
        expect(phraseIn("I claim it saying nine willows and a broken oar"))
            .toBe('nine willows and a broken oar');
        // And a sentence with no phrase in it produces none, rather than half
        // the sentence sealed against an entry nobody meant.
        expect(phraseIn('I lodge my things with the Ninefold Ledger')).toBeUndefined();
        expect(phraseIn('I bury my things here')).toBeUndefined();
    });

    it('every custodian phrase is long enough not to be a wildcard', () => {
        for (const phrase of CUSTODIAN_PHRASES) {
            expect(phrase.length, phrase).toBeGreaterThanOrEqual(6);
        }
    });
});

/** The catalog file as text, for the derivation check. */
function getSectsSource(): string {
    // Read through the module graph rather than the filesystem so the check
    // cannot pass against a stale copy on disk.
    return JSON.stringify(
        CUSTODY_TAKERS.map(t => {
            const house = getSect(t.factionId)!;
            return [
                house.description,
                house.territory,
                ...('services' in house ? (house as { services: readonly string[] }).services : []),
                ...('civilReach' in house ? (house as { civilReach: readonly string[] }).civilReach : [])
            ].join(' ');
        }).join(' ')
    );
}
