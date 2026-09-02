/**
 * A cure the engine calls purchasable has to be somewhere a player can buy it.
 *
 * ── WHAT THIS CAUGHT, AND HOW ────────────────────────────────────────────
 *
 * `treat_injury` now enforces the wound-grade ladder, so the medicine a torn
 * meridian needs rises with the body carrying it: mortal grade answers a novice
 * and earth grade answers the same tear once the patient is past Foundation
 * Establishment. The moment that gate closed, the earth-grade rung became a
 * medicine ordinary cultivators genuinely need - and the Marrow-Washing Pill
 * was on no price board in the world.
 *
 * Nothing about that was visible. `buying-and-bartering-pills.ts` computes that
 * earth grade is a COMMODITY, openly bought and sold; `what-would-close-this-
 * wound.ts` would have named it as the cure; and `buy` would have answered that
 * it is not sold here, because `buy` sells the board. Three surfaces, two
 * answers, and the player left holding a name and no counter.
 *
 * ── WHY THE GUARD IS HERE RATHER THAN A FALLBACK IN THE CODE ─────────────
 *
 * The tempting fix was for the cure-namer to fall back to the pill's catalog
 * value when the board is silent. That produces a quoted price for something no
 * counter will hand over, which is the same contradiction with a friendlier
 * face. The board is the single place a counter's price lives, so the invariant
 * belongs on the board: if the economy says a medicine is bought with money,
 * somewhere has to be selling it.
 *
 * Deliberately narrow. It asks only about the medicines a WOUND needs, because
 * those are the ones a refusal has to be able to name at a price. A commodity
 * pill nobody is ever told to go and get is not a broken promise.
 */

import { describe, expect, it } from 'vitest';

import { PILLS } from '../../src/data/cultivation/pills.js';
import { PRICES } from '../../src/data/cultivation/mortal-world.js';
import { pillTradeTier } from '../../src/engine/cultivation/buying-and-bartering-pills.js';

const TREATS_A_WOUND = PILLS.filter(pill => pill.effect === 'treat_injury');

describe('the board carries every medicine money can buy for a wound', () => {
    it('has a row for each commodity-tier treat-injury pill', () => {
        const unsold = TREATS_A_WOUND
            .filter(pill => pillTradeTier(pill) === 'commodity')
            .filter(pill => !PRICES.some(price => price.name === pill.name))
            .map(pill => `${pill.name} (${pill.grade}, ${pill.value} stones)`);
        expect(unsold).toEqual([]);
    });

    it('quotes none of the ones past the cash line', () => {
        // The mirror, and the more important half. A board price on a barter
        // pill would say the economy reaches it, and `immortal-items.ts` is
        // explicit that a price implies a rate and there is no rate.
        const quoted = TREATS_A_WOUND
            .filter(pill => pillTradeTier(pill) === 'barter')
            .filter(pill => PRICES.some(price => price.name === pill.name))
            .map(pill => pill.name);
        expect(quoted).toEqual([]);
    });

    it('prices each board row at the catalog value, so the two cannot drift', () => {
        for (const pill of TREATS_A_WOUND) {
            const row = PRICES.find(price => price.name === pill.name);
            if (!row) continue;
            // 100 cash to the stone, which is the rate the whole board uses.
            expect(Math.round(row.cash / 100), `${pill.name} board price`).toBe(pill.value);
        }
    });
});
