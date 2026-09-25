/**
 * Who sells what is decided by what they are.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * The design owner: *"rando npcs only sell random mortal items"*, *"a
 * cultivator only sells cultivator items"*. So a person's stock comes off the
 * board their rung puts them on, and `FOUNDATION_ORDINAL` is the line - the one
 * the ladder already draws, in the words of the module that owns it: below it a
 * mortal with a party trick, above it a cultivator.
 *
 * ── WHAT WAS WRONG, MEASURED ─────────────────────────────────────────────
 *
 * Three seeded worlds, 647 people standing in 81 settlement squares:
 *
 *   offering anything        4 of 647 (0.6%), 0.05 per square
 *   squares with no seller   77 of 81 (95%)
 *   sellers below Foundation 0
 *
 * The split was therefore already true of the world and one half of it was
 * simply empty: every seller was on the ladder, and the several hundred people
 * below it stood in a market square with nothing to say. After the mortal half
 * was connected, the same sweep gives 647 of 647 offering, 0 empty squares, and
 * the four sellers on the ladder still reach the board rather than being priced
 * off it by bread.
 *
 * ── WHAT IS PINNED HERE ──────────────────────────────────────────────────
 *
 * The rule, over a population swept across the whole ladder rather than two
 * hand-built people: NOBODY DEALS IN BOTH BOARDS, and which one they deal in is
 * read off them and not off what happens to be in their hands. Every person in
 * the sweep is handed the same arts, so an assertion that holds is an assertion
 * about the seller.
 *
 * Every assertion below was red-checked by making `readWhatIsOnOfferHere` ask
 * one question of everybody.
 */

import { describe, it, expect } from 'vitest';

import {
    readWhatIsOnOfferHere,
    whatIsOnTheirCounter,
    SELLERS_SHOWN,
    THINGS_ON_A_BARROW
} from '../../src/web/who-here-is-offering-something.js';
import { createWorld, type WorldState } from '../../src/engine/world/world-state.js';
import { createNpc, setRealm, type NpcRecord } from '../../src/engine/world/npc-state.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { TECHNIQUES, getTechnique } from '../../src/data/cultivation/techniques.js';
import {
    PRICES,
    THE_MORTAL_BOARD,
    getPrice,
    whoseCounterThisSitsAt
} from '../../src/data/cultivation/mortal-world.js';
import { FOUNDATION_ORDINAL, MAX_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { makeCultivator } from '../engine/cultivation/fixtures.js';

const SQUARE = 'The Square';

/**
 * One list of arts, handed to everybody in the sweep.
 *
 * WHAT MOVES IS A COPY AND A COPY TAKES MASTERY, so the list is the shallowest
 * end of the world's shelf: anybody at or above where these books stop can
 * write one out, and anybody below carries the same book and cannot. A sweep
 * handed the deepest books instead would measure an empty square and read as a
 * defect in the split.
 *
 * AND THE SHALLOWEST END OF THE SHELF STOPS AT FOUNDATION ESTABLISHMENT. Not a
 * fixture convenience - measured across the catalog, the lowest `cap` on any of
 * the 149 arts that have one is 13, which is `FOUNDATION_ORDINAL` exactly. So
 * the mortal side of the split was ALREADY true of the world for a second and
 * unrelated reason, and that is why the sweep below can only show a mortal
 * carrying arts and offering none rather than a mortal who could have copied
 * one and does not.
 */
const SHARED_ARTS = TECHNIQUES
    .filter(t => t.cap !== null && t.cap !== undefined && Number(t.cap) <= FOUNDATION_ORDINAL)
    .map(t => t.id)
    .slice(0, 6);

/**
 * One square holding a person at every rung of the ladder, all carrying the
 * same books, so a difference in what they offer is a difference in them.
 */
function aSquareAcrossTheWholeLadder(): WorldState {
    const state = createWorld({ seed: 'the-split', skipPriorAges: true, regionCount: 0 });
    state.locations.push(makeLocation({
        id: 'square', name: SQUARE, kind: 'settlement', qiDensity: 0.3
    }));
    for (let rung = 0; rung <= MAX_ORDINAL; rung++) {
        let npc: NpcRecord = createNpc(state.seed, {
            id: `standing-${rung}`,
            name: `Standing ${rung}`,
            bornOnDay: state.currentDay - 365 * 40,
            onDay: state.currentDay,
            locationId: 'square'
        });
        npc = setRealm(npc, rung, state.currentDay);
        state.npcs.push({
            ...npc,
            spiritStones: 500,
            cultivation: { ...npc.cultivation, techniqueIds: [...SHARED_ARTS] }
        });
    }
    return state;
}

/** A thin square: two people below Foundation and nobody else. */
function aSquareHoldingTwoMortals(pair: number): WorldState {
    const state = createWorld({ seed: 'a-thin-square', skipPriorAges: true, regionCount: 0 });
    state.locations.push(makeLocation({
        id: 'square', name: SQUARE, kind: 'settlement', qiDensity: 0.3
    }));
    for (const half of [0, 1]) {
        const npc = createNpc(state.seed, {
            id: `thin-${pair}-${half}`,
            name: `Thin ${pair}${half}`,
            bornOnDay: state.currentDay - 365 * 40,
            onDay: state.currentDay,
            locationId: 'square'
        });
        state.npcs.push(npc);
    }
    return state;
}

const isARowOfTheBoard = (thingId: string): boolean => getPrice(thingId) !== undefined;
const isAnArt = (thingId: string): boolean => getTechnique(thingId) !== undefined;

describe('the split is a rule about the seller', () => {
    const state = aSquareAcrossTheWholeLadder();
    const { read } = readWhatIsOnOfferHere(makeCultivator({ location: SQUARE }), state);
    const rungOf = new Map(state.npcs.map(n => [n.id, n.cultivation.realmOrdinal]));
    const standsBelow = (id: string): boolean => (rungOf.get(id) ?? 0) < FOUNDATION_ORDINAL;

    /**
     * Every offer either side of the line, flattened.
     *
     * AND EACH LIST IS ASSERTED NON-EMPTY WHERE IT IS USED, not once in a guard
     * test of its own. Red-checked: with the split removed and everybody asked
     * the cultivator's question, every mortal offers nothing - so a loop over
     * their offers has nothing to iterate and passes while saying nothing. An
     * empty list is exactly the failure these tests exist to catch.
     */
    const fromMortals = read
        .filter(person => standsBelow(person.who.id))
        .flatMap(person => person.offers);
    const fromTheLadder = read
        .filter(person => !standsBelow(person.who.id))
        .flatMap(person => person.offers);

    it('gives a mortal the mortal board and never an art', () => {
        expect(fromMortals.length, 'nobody below Foundation is selling anything').toBeGreaterThan(0);
        for (const offer of fromMortals) {
            expect(
                isARowOfTheBoard(offer.thingId),
                `${offer.sellerName} is selling ${offer.thingId}, which is not on the board`
            ).toBe(true);
            expect(
                isAnArt(offer.thingId),
                `${offer.sellerName} stands below Foundation and is selling an art`
            ).toBe(false);
        }
    });

    it('gives somebody on the ladder arts and never maize', () => {
        expect(fromTheLadder.length, 'nobody on the ladder is selling anything').toBeGreaterThan(0);
        for (const offer of fromTheLadder) {
            expect(
                isAnArt(offer.thingId),
                `${offer.sellerName} is selling ${offer.thingId}, which is not an art`
            ).toBe(true);
            expect(
                isARowOfTheBoard(offer.thingId),
                `${offer.sellerName} is on the ladder and is selling off the mortal board`
            ).toBe(false);
        }
    });

    it('holds even though everybody in the sweep was handed the same arts', () => {
        // THE POINT OF THE SWEEP. The people below Foundation are carrying the
        // same books as the people above them, and none of those books reaches
        // a counter - so what decided the stock was the person.
        const mortalsCarryingArts = state.npcs.filter(n =>
            standsBelow(n.id) && n.cultivation.techniqueIds.length > 0);
        expect(mortalsCarryingArts.length).toBeGreaterThan(0);
        expect(fromMortals.length, 'the mortals in the sweep sold nothing').toBeGreaterThan(0);
        expect(fromMortals.filter(offer => isAnArt(offer.thingId))).toEqual([]);
    });

    it('marks which board each offer came off, so nothing has to re-derive it', () => {
        expect(fromMortals.length).toBeGreaterThan(0);
        expect(fromTheLadder.length).toBeGreaterThan(0);
        for (const offer of fromMortals) expect(offer.fromTheMortalBoard).toBe(true);
        for (const offer of fromTheLadder) expect(offer.fromTheMortalBoard).toBe(false);
    });
});

describe('a square is no longer mute', () => {
    it('puts somebody in front of a player where four rungs of people stand', () => {
        const state = aSquareAcrossTheWholeLadder();
        const { offers } = readWhatIsOnOfferHere(makeCultivator({ location: SQUARE }), state);
        expect(offers.length).toBeGreaterThan(0);
    });

    it('does not let bread price an art off the board', () => {
        // Sorted on price alone the mortal board wins every slot - millet is one
        // stone and a manual is hundreds - and the one thing in the square a
        // cultivator came for becomes unreachable. Somebody on the ladder is
        // shown first and the board fills in behind them.
        const state = aSquareAcrossTheWholeLadder();
        const { offers } = readWhatIsOnOfferHere(makeCultivator({ location: SQUARE }), state);
        expect(offers.some(offer => offer.fromTheMortalBoard), 'no bread in the square').toBe(true);
        expect(offers.some(offer => !offer.fromTheMortalBoard), 'bread took every slot').toBe(true);
    });

    it('shows a thing once however few things are in the square', () => {
        // FOUND BY READING A SQUARE. The round-robin counted how many times it
        // had taken from a seller and then re-scanned the flat list, so a
        // seller holding one thing matched round 1 as well and was printed
        // twice - a ford with two people in it listed both of them twice. The
        // defect predates the mortal board and was invisible while a square
        // rarely held four sellers at all.
        let thinSquares = 0;
        for (let pair = 0; pair < 12; pair++) {
            const state = aSquareHoldingTwoMortals(pair);
            const { offers } = readWhatIsOnOfferHere(makeCultivator({ location: SQUARE }), state);
            const seen = offers.map(offer => `${offer.sellerId}:${offer.thingId}`);
            expect(new Set(seen).size, 'the same offer was shown twice').toBe(seen.length);
            if (offers.length < SELLERS_SHOWN) thinSquares++;
        }
        // Non-vacuity: a square that fills all four slots on the first pass
        // never reaches the round the defect lived in.
        expect(thinSquares, 'every square swept was full, so nothing was proved')
            .toBeGreaterThan(0);
    });
});

describe('a barrow is drawn off the person and not off the square', () => {
    it('gives two people standing together different stock', () => {
        const mine = whatIsOnTheirCounter({ id: 'npc-a' }, 'region-low-fall', 'seed');
        const theirs = whatIsOnTheirCounter({ id: 'npc-b' }, 'region-low-fall', 'seed');
        expect(mine.length).toBeGreaterThan(0);
        expect(mine.map(r => r.id)).not.toEqual(theirs.map(r => r.id));
    });

    it('gives the same person the same stock every time somebody walks past', () => {
        const first = whatIsOnTheirCounter({ id: 'npc-a' }, 'region-low-fall', 'seed');
        const again = whatIsOnTheirCounter({ id: 'npc-a' }, 'region-low-fall', 'seed');
        expect(again).toEqual(first);
    });

    it('is a barrow rather than a warehouse', () => {
        for (const id of ['npc-a', 'npc-b', 'npc-c', 'npc-d', 'npc-e']) {
            const stock = whatIsOnTheirCounter({ id }, 'region-low-fall', 'seed');
            expect(stock.length).toBeGreaterThanOrEqual(1);
            expect(stock.length).toBeLessThanOrEqual(THINGS_ON_A_BARROW);
            expect(new Set(stock.map(r => r.id)).size).toBe(stock.length);
            for (const row of stock) expect(row.askStones).toBeGreaterThanOrEqual(1);
        }
    });
});

describe('the mortal board is derived from the price list, not written twice', () => {
    it('is a subset of the catalog every other surface prices from', () => {
        const priced = new Set(PRICES.map(p => p.id));
        expect(THE_MORTAL_BOARD.length).toBeGreaterThan(0);
        for (const row of THE_MORTAL_BOARD) expect(priced.has(row.id)).toBe(true);
    });

    it('carries nothing an alchemist made and nothing bought elsewhere', () => {
        for (const row of THE_MORTAL_BOARD) {
            expect(row.gives.kind, `${row.id} is a pill, which is a cultivator's stock`)
                .not.toBe('pill');
            expect(row.gives.kind, `${row.id} says in its own words it is not bought at a counter`)
                .not.toBe('quoted_only');
        }
    });

    /**
     * AND NOTHING AN INSTITUTION OWNS.
     *
     * Three rows on the board are a named house's own counter - an entry on the
     * Jade Register Hall's register, an oath witnessed by the Vermilion Sigil
     * Terrace, a realm placement by the Ninefold Karma Palace - and a villager
     * behind a barrow was drawing them like millet. Measured over three seeded
     * worlds (81 settlement squares, 633 villagers with a barrow out, 1,252
     * offers): **145 of those offers were one of the three**, 37 / 55 / 53. On
     * the same three worlds and the same draw afterwards: 1,252 offers, 0 of
     * them, and the same 22 distinct ordinary rows across the same 80 squares.
     *
     * A scribe really does write letters and a bell keeper really does ring the
     * bell, which is why those rows stay: what separates them is that a house
     * says in its own `services` array that the other three are its trade. See
     * `a-house-keeps-its-own-counter.test.ts`.
     *
     * Swept over barrows rather than over the board, because the board being
     * right is the cause and a villager's stock is what a player sees.
     */
    it('puts no house\'s own counter on anybody\'s barrow', () => {
        const offered = new Set<string>();
        for (let i = 0; i < 400; i++) {
            for (const row of whatIsOnTheirCounter({ id: `barrow-${i}` }, 'region-low-fall', 'sweep')) {
                offered.add(row.id);
            }
        }
        expect(offered.size, 'the sweep drew too few rows to say anything')
            .toBeGreaterThan(THE_MORTAL_BOARD.length - 2);
        for (const id of offered) {
            const row = getPrice(id)!;
            expect(whoseCounterThisSitsAt(row), `${id} is a house's own counter`).toBeNull();
        }
    });
});
