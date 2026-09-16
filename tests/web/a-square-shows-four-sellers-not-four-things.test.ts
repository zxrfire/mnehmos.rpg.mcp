/**
 * A crowded square puts four PEOPLE in front of somebody, not four prices.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * `SELLERS_SHOWN` is documented in its own file as *"the most sellers a square
 * puts in front of anybody at once"*, and the read flattened every person's
 * offers, sorted the lot by price, and took four. So the cap counted OFFERS
 * while its name counted SELLERS, and one cheap seller consumed the whole
 * allowance.
 *
 * Found by playing: a square where one man held several cheap things answered
 * *"Nothing here prices..."* for a thing a second man was standing there
 * holding. A person in front of you with something you could buy was not
 * merely ranked low - they were absent.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 *
 * Cheapest-first still decides who is shown and in what order. What changed is
 * that a seller's SECOND thing waits until every other seller has had a first.
 * So a square with four sellers shows four sellers, and a square with one
 * seller still fills the board from them.
 */

import { describe, it, expect } from 'vitest';

import { readWhatIsOnOfferHere, SELLERS_SHOWN } from '../../src/web/who-here-is-offering-something.js';
import { createWorld, type WorldState } from '../../src/engine/world/world-state.js';
import { createNpc, setRealm, type NpcRecord } from '../../src/engine/world/npc-state.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';
import { makeCultivator } from '../engine/cultivation/fixtures.js';

/**
 * Arts a seller standing at `SELLER_RUNG` has actually finished.
 *
 * WHAT MOVES IS A COPY, AND A COPY TAKES MASTERY. `whatThisPersonWouldPartWith`
 * withholds anything the holder could not write out, and writing one out means
 * having taken the art to its end. A fixture whose sellers stand below their
 * own books offers nothing at all - which is how the first draft of this file
 * measured an empty square and briefly looked like a defect in the read.
 */
const SELLER_RUNG = 20;
const SELLABLE = TECHNIQUES
    .filter(t => t.cap !== null && t.cap !== undefined && t.cap <= SELLER_RUNG)
    .map(t => t.id);

/**
 * A square holding the given people, each carrying the arts named.
 *
 * Everybody stands at the same place and carries stones, because what is
 * being measured is which of them the read SHOWS rather than whether any of
 * them would part with a thing.
 */
function aSquareHolding(carrying: readonly (readonly string[])[]): WorldState {
    const state = createWorld({ seed: 'stalls', skipPriorAges: true, regionCount: 0 });
    state.locations.push(makeLocation({
        id: 'square', name: 'The Square', kind: 'settlement', qiDensity: 0.3
    }));
    carrying.forEach((arts, index) => {
        let npc: NpcRecord = createNpc(state.seed, {
            id: `seller-${index}`,
            name: `Seller ${index}`,
            bornOnDay: state.currentDay - 365 * 40,
            onDay: state.currentDay,
            locationId: 'square',
            occupation: 'merchant'
        });
        npc = setRealm(npc, SELLER_RUNG, state.currentDay);
        state.npcs.push({
            ...npc,
            spiritStones: 500,
            cultivation: { ...npc.cultivation, techniqueIds: [...arts] }
        });
    });
    return state;
}

const standingThere = makeCultivator({ location: 'square' });

describe('a square shows four sellers, not four things', () => {
    it('gives every seller a place before any seller gets a second', () => {
        // ONE MAN HOLDING FOUR, AND THREE MEN HOLDING ONE EACH. Sorted purely
        // by price the first man could take the whole board; the rule is that
        // he does not.
        const state = aSquareHolding([
            SELLABLE.slice(0, 4),
            [SELLABLE[4]],
            [SELLABLE[5]],
            [SELLABLE[6]]
        ]);

        const { offers } = readWhatIsOnOfferHere(standingThere, state);
        const sellers = new Set(offers.map(o => o.sellerId));

        expect(offers.length, 'the board is not full').toBe(SELLERS_SHOWN);
        expect(
            sellers.size,
            'one seller took slots that belonged to people standing right there'
        ).toBe(4);
    });

    it('still fills the board from one seller when there is only one', () => {
        // THE CAP IS NOT A QUOTA. A square with one merchant in it should show
        // what he has, not one thing and three blanks.
        const state = aSquareHolding([SELLABLE.slice(0, 6)]);

        const { offers } = readWhatIsOnOfferHere(standingThere, state);

        expect(offers.length).toBe(SELLERS_SHOWN);
        expect(new Set(offers.map(o => o.sellerId)).size).toBe(1);
    });

    it('shows the cheapest thing each seller has, not an arbitrary one', () => {
        // Within a seller, the first thing shown is still their cheapest -
        // ordering by price is what was right about the old read and it is
        // kept.
        const state = aSquareHolding([SELLABLE.slice(0, 3), SELLABLE.slice(3, 6)]);

        const { offers, read } = readWhatIsOnOfferHere(standingThere, state);

        for (const seller of read) {
            const shown = offers.filter(o => o.sellerId === seller.who.id);
            if (shown.length === 0 || seller.offers.length === 0) continue;
            const cheapest = Math.min(...seller.offers.map(o => o.askStones));
            expect(
                shown[0].askStones,
                `${seller.who.name} was shown something dearer than their cheapest`
            ).toBe(cheapest);
        }
    });
});
