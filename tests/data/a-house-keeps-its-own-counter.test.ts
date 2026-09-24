/**
 * A row an institution owns is not a row a villager sells.
 *
 * ── WHAT WAS WRONG, AND HOW IT WAS SEEN ──────────────────────────────────
 *
 * The seller split landed: a villager's barrow is drawn from `THE_MORTAL_BOARD`,
 * which is `PRICES` with the rows that say in their own words they are reached
 * another way taken off it. It closed a real hole - 95% of settlement squares
 * had nobody selling anything and afterwards none did - and it let through three
 * rows that are not goods at all:
 *
 *   price-gate-registration   an entry on the Jade Register Hall's register
 *   price-oath-witness        an oath witnessed by the Vermilion Seal Terrace
 *   price-placement           a realm placement by the Ninefold Karma Palace
 *
 * Measured over three seeded worlds - 81 settlement squares, 640 people, 633 of
 * them with a barrow out and 1,252 offers between them - **145 of those offers
 * were one of the three**: 37 villagers offering gate registration, 55 offering
 * to witness an oath, 53 offering to place a foreign cultivator inside a realm.
 * A farmhand at a barrow cannot put you on a register held at nine city gates,
 * and the difference from "a letter written" is not fussiness: a scribe really
 * does write letters, and this is a person claiming to be an institution.
 *
 * ── WHERE THE OWNERS CAME FROM ───────────────────────────────────────────
 *
 * Nothing was written down to get them. Each of the three houses already
 * advertises the service in its own `services` array in `sects.ts`, and the
 * price row's display NAME is the head of that sentence word for word. Over the
 * whole catalog that is true of 3 rows out of 43 and of nothing else, and
 * nothing matches loosely that does not match exactly - so the read is the fact
 * rather than a heuristic that landed.
 *
 * ── WHAT THIS FILE IS FOR ────────────────────────────────────────────────
 *
 * Deriving cannot drift, but it CAN go quiet: rename either side and
 * `whoseCounterThisSitsAt` returns null, a villager starts selling oath
 * witnessing again, and nothing fails. This is the ratchet. It names the three,
 * so a rename that breaks the link goes red here - which is the repo's
 * rename-across-the-whole-tree rule doing its job, and is why the fact is not
 * kept twice.
 *
 * Red-checked, both arms run and reverted: removing the owner clause from
 * `THE_MORTAL_BOARD`'s filter fails 2 of the 6, and matching on the first word
 * of a row's name instead of the whole of it fails 3 - it hands eleven rows to
 * a house, which is what a derive going loose looks like.
 *
 * Matching on `includes` rather than `startsWith` does NOT go red, and that is
 * recorded rather than hidden: nothing in the catalog today matches loosely and
 * not exactly, which the third test asserts outright. It is a ratchet against
 * the row somebody adds next year whose name a house's prose happens to
 * mention, and it cannot fail on the catalog as it stands.
 */

import { describe, it, expect } from 'vitest';

import {
    PRICES,
    THE_MORTAL_BOARD,
    whereThisIsActuallyDone,
    whoseCounterThisSitsAt
} from '../../src/data/cultivation/mortal-world.js';
import { DAO_HOUSES, getDaoHouse } from '../../src/data/cultivation/sects.js';

/**
 * The three, by id and by the house the catalog hands back.
 *
 * The HOUSE is asserted and the sentence is not: the sentence is the house's
 * own prose and belongs to whoever is writing that house, while which house
 * sells a realm placement is the thing this file is about.
 */
const OWNED: Readonly<Record<string, string>> = {
    'price-gate-registration': 'house-jade-register',
    'price-oath-witness': 'house-vermilion-seal',
    'price-placement': 'house-ninefold-karma'
};

describe('whose counter a price row sits at', () => {
    it('reads the three owners off the houses own words, and names no others', () => {
        const owned = new Map(
            PRICES
                .map(row => [row.id, whoseCounterThisSitsAt(row)] as const)
                .filter((pair): pair is readonly [string, NonNullable<ReturnType<typeof whoseCounterThisSitsAt>>] =>
                    pair[1] !== null)
        );
        expect([...owned.keys()].sort()).toEqual(Object.keys(OWNED).sort());
        for (const [priceId, factionId] of Object.entries(OWNED)) {
            expect(owned.get(priceId)?.factionId, priceId).toBe(factionId);
        }
    });

    /**
     * The check `institutions-that-hold-deposits-for-the-dead.ts` runs on its
     * own `derivedFrom`: the line handed back has to really be in the named
     * house's catalog entry, or this file has invented an institution.
     */
    it('hands back a line the house really carries', () => {
        for (const [priceId, factionId] of Object.entries(OWNED)) {
            const row = PRICES.find(p => p.id === priceId)!;
            const read = whoseCounterThisSitsAt(row)!;
            const house = getDaoHouse(factionId)!;
            expect(house.services, `${factionId} does not say it sells ${priceId}`)
                .toContain(read.saysItSells);
            expect(read.name).toBe(house.name);
        }
    });

    /**
     * NOT A SUBSTRING MATCH. `includes` would let any house whose prose happens
     * to mention a row's name anywhere become its owner, which is how a derive
     * quietly becomes a guess. The row's name is the HEAD of the service line.
     */
    it('matches the head of a service line and not a mention inside one', () => {
        for (const priceId of Object.keys(OWNED)) {
            const row = PRICES.find(p => p.id === priceId)!;
            const read = whoseCounterThisSitsAt(row)!;
            expect(read.saysItSells.toLowerCase().startsWith(row.name.toLowerCase())).toBe(true);
        }
        // And nothing else in the catalog is even a loose match, so the strict
        // read is not hiding a row that ought to be owned and is phrased
        // differently.
        const loose = PRICES.filter(row => whoseCounterThisSitsAt(row) === null
            && DAO_HOUSES.some(house => house.services.some(
                service => service.toLowerCase().includes(row.name.toLowerCase()))));
        expect(loose.map(row => row.id)).toEqual([]);
    });

    /**
     * THE FIELD POINTS SOMEWHERE RATHER THAN DELETING THE ROW. A player in a
     * town with no Jade Register Hall in it must learn that gate registration
     * exists, costs three stones a year, and is done at a counter that is not
     * here. `NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING
     * NOTHING`, applied to a place instead of to a rung.
     */
    it('leaves an owned row on the price board and says whose counter it is', () => {
        const priced = new Set(PRICES.map(p => p.id));
        for (const [priceId, factionId] of Object.entries(OWNED)) {
            expect(priced.has(priceId), `${priceId} vanished from the board`).toBe(true);
            const said = whereThisIsActuallyDone(PRICES.find(p => p.id === priceId)!);
            expect(said).not.toBeNull();
            expect(said).toContain(getDaoHouse(factionId)!.name);
        }
        // And the common case stays the common case: a row at nobody's counter
        // says nothing about a counter at all.
        const unowned = PRICES.filter(row => whoseCounterThisSitsAt(row) === null);
        expect(unowned.length).toBeGreaterThan(PRICES.length - 6);
        for (const row of unowned) expect(whereThisIsActuallyDone(row)).toBeNull();
    });

    it('keeps an owned row off the board a person behind a barrow deals in', () => {
        expect(THE_MORTAL_BOARD.length).toBeGreaterThan(0);
        for (const row of THE_MORTAL_BOARD) {
            expect(whoseCounterThisSitsAt(row), `${row.id} is a house's own counter`).toBeNull();
        }
        for (const priceId of Object.keys(OWNED)) {
            expect(THE_MORTAL_BOARD.some(row => row.id === priceId), priceId).toBe(false);
        }
    });

    /**
     * AND THE ORDINARY ROWS ARE UNTOUCHED. The board lost exactly three rows
     * and nothing else: a scribe still writes a letter and a bell keeper still
     * rings the bell, and neither of those has a house's name against it.
     */
    it('takes three rows off the board and no more', () => {
        // An earth-grade vessel is never on a barrow either, which is a rule about
        // the grade rather than about whose counter a row sits at.
        const wouldHaveBeen = PRICES.filter(
            row => row.gives.kind !== 'quoted_only' && row.gives.kind !== 'pill'
                && !(row.gives.kind === 'a_vessel' && row.gives.grade !== 'mortal'));
        expect(wouldHaveBeen.length - THE_MORTAL_BOARD.length).toBe(Object.keys(OWNED).length);
        const gone = new Set(THE_MORTAL_BOARD.map(row => row.id));
        expect(wouldHaveBeen.filter(row => !gone.has(row.id)).map(row => row.id).sort())
            .toEqual(Object.keys(OWNED).sort());
    });
});
