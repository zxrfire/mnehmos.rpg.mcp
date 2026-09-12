/**
 * A volume somebody is carrying could be bought and could not be sold.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS PLAYED
 * ═════════════════════════════════════════════════════════════════════════
 *
 *     > I buy the Lesser Qi-Gathering Manual
 *     6 spirit stones of the 30 you had, and the copy is yours. 24 left.
 *
 *     > what is in my pouch
 *     Books: Lesser Qi-Gathering Manual, which carries as far as Foundation
 *     Establishment Early.
 *
 *     > I sell the manual
 *     Writing a method out is not copying a shape off a page... There is
 *     nothing in your hand to sell.
 *
 * The last line is false to the player's face, and the read two turns earlier
 * said so. A game master sells the book.
 *
 * ── THE CAUSE ────────────────────────────────────────────────────────────
 *
 * `sell` ran `sellACopyOfAnArt` first. That is a different mechanic - you know
 * an art, you spend months writing out a copy, you sell the copy - and it
 * refused on never having been taught. Its guard for exactly this class, *a
 * name that is also in the pouch is the pouch's*, could not fire because a held
 * volume is not in the pouch: books are in `FLAG_MANUAL_COPIES_HELD` and the
 * pouch is a different store.
 *
 * So widening that guard would only have moved the wrong answer: the pouch path
 * cannot see a volume either. Selling a held book was a MISSING MECHANIC rather
 * than a misrouted one, and `sellAVolumeYouAreHolding` is it.
 *
 * ── WHAT THE ASSERTIONS ENCODE ───────────────────────────────────────────
 *
 * The stones move, the book leaves, the art is untouched, and the player is
 * told where they stand with a book they had not finished. No name, price or
 * rung is pinned: those are the catalog's and the region's, and a test that
 * pinned one would be measuring somebody else's sweep.
 */

import { describe, expect, it } from 'vitest';

import { makeGame } from './harness';
import { copiesHeldBy } from '../../src/server/consolidated/technique-manage';

const RUN = 'a-book-in-hand';

/** A player standing where a stall is, with enough for the cheapest book. */
async function withABookOnThem() {
    const harness = makeGame({ seed: RUN });
    const { cultivator } = await harness.game.newRun('Buyer');
    harness.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 500 });

    const shelf = await harness.game.act('I buy a manual');
    const title = /  ([^,]+), \d+ spirit stones/.exec(shelf.narration)?.[1];
    expect(title, shelf.narration).toBeTruthy();

    await harness.game.act(`I buy the ${title}`);
    const held = copiesHeldBy(harness.db, cultivator.id);
    expect(held.length, 'the buy path should have put a copy on them').toBe(1);

    return { ...harness, cultivator, title: title!, bookId: held[0] };
}

describe('a book somebody is carrying', () => {
    it('can be sold, and the stones arrive', async () => {
        const { game, db, repos, cultivator, title, bookId } = await withABookOnThem();
        const before = repos.cultivators.getById(cultivator.id)!.spiritStones;

        const sold = await game.act(`I sell the ${title}`);

        expect(sold.narration, sold.narration).not.toMatch(/nothing in your hand to sell/);
        expect(repos.cultivators.getById(cultivator.id)!.spiritStones).toBeGreaterThan(before);
        expect(copiesHeldBy(db, cultivator.id)).not.toContain(bookId);
    });

    /**
     * "the manual" is a category and not a name, and it is what the played
     * transcript actually typed. With one book on them there is nothing else it
     * could mean.
     */
    it('answers the words a player actually types for it', async () => {
        const { game, db, cultivator, bookId } = await withABookOnThem();

        const sold = await game.act('I sell the manual');

        expect(sold.narration, sold.narration).not.toMatch(/nothing in your hand to sell/);
        expect(copiesHeldBy(db, cultivator.id)).not.toContain(bookId);
    });

    /**
     * Allowed rather than warned off - this world does not protect people from
     * themselves - but the state they are in is stated, because it is a fact
     * the player may not have in mind when they say it.
     */
    it('says where an unopened book leaves them', async () => {
        const { game, title } = await withABookOnThem();

        const sold = await game.act(`I sell the ${title}`);

        expect(sold.narration, sold.narration).toMatch(/never sat down with it/);
    });

    /**
     * And the other mechanic is untouched. Somebody who holds NO copy and knows
     * no art still gets the transcription refusal, because writing out a method
     * you were never taught is a different thing to refuse.
     */
    it('leaves writing out a copy of an art you were never taught refusing as before', async () => {
        const harness = makeGame({ seed: `${RUN}-untaught` });
        await harness.game.newRun('Empty');

        const said = await harness.game.act('I sell the Lesser Qi-Gathering Manual');

        expect(said.narration, said.narration).toMatch(/never been taught|nothing in your hand to sell/);
    });
});
