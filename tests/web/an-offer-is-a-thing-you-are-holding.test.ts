/**
 * A SWAP THE ENGINE WROTE ON THE HOLDER'S END AND NOT ON THE PLAYER'S.
 *
 * `whatWouldItTake` binds the holder's side of a barter to the world and always
 * has. It finds an unspent row on their house shelf, refuses when there is not
 * one and names who else in the province is holding one, prices what their own
 * open needs do to it, and moves the row with a provenance line when the trade
 * lands.
 *
 * The PLAYER's side was a string. `whatIsBeingPutDown` priced whatever was typed
 * against four catalogs, nothing checked that the player held it, and the branch
 * that closed the trade took nothing off them. So:
 *
 *     offer Ru Yanzhi the Heaven-Ascending Golden Pill for The Hidden Edge
 *
 * typed by somebody who has never seen one, priced at the ceiling its grade
 * permits, cleared almost any bar in the world, moved a tracked object onto the
 * player, and wrote a record saying what it was given for. Nothing left the
 * player. A named blade, a pill never owned, the best object in the world -
 * any of them, every turn, for nothing.
 *
 * ── THE TWO HALVES, AND WHY BOTH ARE NEEDED ──────────────────────────────
 *
 * `heldByYou` is the gate: an offer of a thing nobody is carrying is refused
 * before anybody's shelf is read. That alone closes the free lunch.
 *
 * `whatTheOfferCost` is the mirror of `transferPossession`: what was put down
 * leaves the player when the trade lands. Without it the gate would only mean a
 * thing has to be yours ONCE - you could then offer the same pill every day
 * forever, which is the same exploit wearing a hat.
 *
 * ── AND WHAT IS DELIBERATELY NOT GATED ───────────────────────────────────
 *
 * The open medium. An oath, a service, a name, a placement, information - the
 * pricing's last clause is *what the person offering it is worth*, and it is
 * the one branch that keeps a tenth medium from needing code. Nobody CARRIES an
 * undertaking, so there is nothing to look for and a refusal there would close
 * the branch. An art is gated but not taken: you cannot pass on a road you have
 * never walked, and the teacher still knows the art afterwards.
 */

import { describe, expect, it } from 'vitest';

import {
    type WhatYouAreCarrying,
    heldByYou,
    nameOfHeld,
    whatIsBeingPutDown,
    whatTheOfferNames
} from '../../src/web/what-a-holder-would-take-for-it';
import { makeGameInWorld } from './harness';

const EMPTY: WhatYouAreCarrying = { stones: 0, pouch: [], artIds: [], rows: [] };

function carrying(some: Partial<WhatYouAreCarrying>): WhatYouAreCarrying {
    return { ...EMPTY, ...some };
}

describe('what the words name, asked once', () => {
    /**
     * The pricing and the gate ask two different questions of the same words,
     * and a second matcher is how two readers come to disagree about which
     * thing somebody meant.
     */
    it('reaches every catalog a thing could come out of', () => {
        expect(whatTheOfferNames('500 spirit stones').medium).toBe('stones');
        expect(whatTheOfferNames('Azure Dew Gathering Canon').medium).toBe('an_art');
        expect(whatTheOfferNames('The Hidden Edge').medium).toBe('a_thing');
        expect(whatTheOfferNames('a higher Heaven-Ascending Golden Pill').medium)
            .toBe('from_above');
    });

    /** And what no catalog answers for stays the open medium. */
    it('leaves an undertaking as an undertaking', () => {
        expect(whatTheOfferNames('my protection').medium).toBe('an_undertaking');
        expect(whatTheOfferNames('a name in the capital').medium).toBe('an_undertaking');
        expect(whatTheOfferNames('three years of service').medium).toBe('an_undertaking');
    });

    /**
     * THE PRICING DID NOT MOVE. Every branch above was inlined in
     * `whatIsBeingPutDown` before the matcher was lifted out of it, and the one
     * thing that must not change is what an offer is worth.
     */
    it('prices exactly as it did before the matcher was lifted out', () => {
        const blade = whatIsBeingPutDown('The Hidden Edge', 4, []);
        expect(blade.carriesThemTo).toBe(46);
        expect(whatIsBeingPutDown('500 spirit stones', 4, []).carriesThemTo).toBe(0);
        expect(whatIsBeingPutDown('500 spirit stones', 4, []).singular).toBe(false);
        // The open medium, still worth what the person offering it is worth.
        expect(whatIsBeingPutDown('my protection', 4, []).carriesThemTo).toBe(4);
        expect(whatIsBeingPutDown('my protection', 29, []).carriesThemTo).toBe(29);
    });
});

describe('whether it is in your hands', () => {
    /** The whole of the exploit, in one assertion. */
    it('refuses a thing nobody is carrying', () => {
        const answer = heldByYou('The Hidden Edge', EMPTY);
        expect(answer.holds).toBe(false);
        expect(answer).toMatchObject({ why: 'not_in_your_hands', name: 'The Hidden Edge' });
    });

    /** Counted stock. The pouch is where a player's medicines actually are. */
    it('takes a pill out of the pouch and says which lot moves', () => {
        const answer = heldByYou('Meridian Rebirth Pill', carrying({
            pouch: [{ itemId: 'pill-meridian-rebirth', kind: 'pill', quantity: 2 }]
        }));
        expect(answer.holds).toBe(true);
        expect(answer).toMatchObject({
            medium: 'a_thing',
            counted: { itemId: 'pill-meridian-rebirth', quantity: 2 },
            tracked: null
        });
    });

    /**
     * A TRACKED ROW, WHICH IS THE TIER THE GENRE'S BEST TRADES RUN ON. A blade
     * lifted off somebody, or taken off a corpse, sits in `state.objects` with
     * the player as possessor and has never been in a pouch. Before this it
     * could not be put on a table at all - and a blade nobody held could.
     */
    it('takes a tracked row the player is the possessor of', () => {
        const row = {
            id: 'carried-the-hidden-edge',
            name: 'The Hidden Edge',
            possessorId: 'me',
            data: {},
            provenance: []
        } as never;
        const answer = heldByYou('The Hidden Edge', carrying({ rows: [row] }));
        expect(answer.holds).toBe(true);
        expect(answer).toMatchObject({ medium: 'a_thing', counted: null });
    });

    /** A swallowed one is a record and not stock, which is the shelf's rule too. */
    it('does not count a spent row', () => {
        const spent = {
            id: 'carried-the-hidden-edge',
            name: 'The Hidden Edge',
            possessorId: 'me',
            data: { spent: true },
            provenance: []
        } as never;
        expect(heldByYou('The Hidden Edge', carrying({ rows: [spent] })).holds).toBe(false);
    });

    /**
     * MONEY IS NOT GATED, FOR THE REASON IT IS NOT PRICED.
     *
     * A sum contributes nothing to the bar however large it is, because above
     * the cash line money is not the medium. So there is no free lunch here to
     * close - an offer of stones nobody has buys exactly what an offer of
     * stones somebody has buys, which is nothing - and refusing on the purse
     * would swap a good answer for a false one. The good answer is the one this
     * verb already gives, and `reaching-a-cure-that-is-not-for-sale.ts` pins
     * it: four hundred thousand stones is *nothing anybody could hold*, and
     * *name what you have, not what you can pay*. A player told instead that
     * they cannot afford it has been told the wrong thing about why.
     */
    it('lets an empty purse make an offer money could never have made', () => {
        expect(heldByYou('400000 spirit stones', carrying({ stones: 0 })))
            .toMatchObject({ holds: true, medium: 'stones' });
        expect(heldByYou('40 spirit stones', carrying({ stones: 40 })))
            .toMatchObject({ holds: true, medium: 'stones' });
        // Which is the same thing the pricing says, in its own units.
        expect(whatIsBeingPutDown('400000 spirit stones', 4, []).carriesThemTo).toBe(0);
    });

    /** A road you have never walked is not yours to hand anybody. */
    it('will not pass on an art nobody knows', () => {
        const said = 'Azure Dew Gathering Canon';
        expect(heldByYou(said, EMPTY)).toMatchObject({ why: 'you_do_not_walk_it' });
        expect(heldByYou(said, carrying({ artIds: ['azure-dew-gathering-canon'] })))
            .toMatchObject({ holds: true, medium: 'an_art' });
    });

    /**
     * AND THE OPEN MEDIUM IS NOT GATED, which is the branch that matters most:
     * it is what lets a tenth medium need no code.
     */
    it('lets somebody offer what nobody carries', () => {
        for (const said of ['my protection', 'a word with my master', 'three years of service']) {
            expect(heldByYou(said, EMPTY), said)
                .toMatchObject({ holds: true, medium: 'an_undertaking' });
        }
    });

    /**
     * The pouch keeps an immortal medicine as `<id>:<grade>` - the convention
     * `theUnearnedStepIn` reads - because the catalog holds one row and three
     * grades on it. Any grade of one is one of them.
     */
    it('finds a medicine from above under the id the pouch files it by', () => {
        const held = carrying({
            pouch: [{
                itemId: 'immortal-heaven-ascending-golden-pill:lower',
                kind: 'artifact',
                quantity: 1
            }]
        });
        expect(heldByYou('a higher Heaven-Ascending Golden Pill', held).holds).toBe(true);
        expect(heldByYou('a higher Heaven-Ascending Golden Pill', EMPTY).holds).toBe(false);
    });
});

describe('naming what a player is holding', () => {
    /**
     * A refusal that lists what somebody IS carrying has to be right about all
     * three kinds. `nameOfStack` reads anything that is not a herb as a pill,
     * which would put a blade's name in a list of medicines.
     */
    it('reads a name off whichever catalog the row came from', () => {
        expect(nameOfHeld('carried-the-hidden-edge')).toBe('The Hidden Edge');
        expect(nameOfHeld('immortal-heaven-ascending-golden-pill:lower'))
            .toBe('The Heaven-Ascending Golden Pill');
        expect(nameOfHeld('nothing-is-called-this')).toBe('nothing-is-called-this');
    });
});

describe('played', () => {
    /**
     * THE SENTENCE THAT USED TO BE A FREE LUNCH.
     *
     * A fresh cultivator, carrying nothing, offering the best object in the
     * world. What must come back is a refusal that costs no day, and it must
     * arrive without the engine having gone looking at anybody's shelf.
     */
    it('refuses an offer of a thing the player has never owned', async () => {
        const { game } = await makeGameInWorld({
            seed: 'offer-what-you-lack', worldSeed: 'world-offer-what-you-lack'
        });
        const { cultivator } = await game.newRun('Liar');
        await game.act('I look around');

        const here = (game as unknown as { present(c: unknown): { name: string }[] })
            .present(cultivator);
        expect(here.length, 'nobody in the opening square to trade with').toBeGreaterThan(0);
        const who = here[0]!.name;

        const said = await game.act(
            `offer ${who} a higher Heaven-Ascending Golden Pill for The Hidden Edge`
        );
        const heard = said.error ?? said.narration ?? '';
        expect(heard).toMatch(/hands are empty of it/i);
        // And the trade did not happen by any other route.
        expect(heard).not.toMatch(/takes what you offered/i);
        // Nor did the day: a refusal that costs a turn is the thing this file
        // exists to prevent, one layer down.
        expect(said.narration ?? '').not.toMatch(/days? pass/i);
    }, 200_000);

    /**
     * AND AN UNDERTAKING STILL REACHES THE TABLE. The refusal above must not
     * have closed the open medium: a promise is priced at what the person
     * making it is worth, and that is a real offer even from somebody carrying
     * nothing at all.
     */
    it('still lets somebody put down a thing nobody carries', async () => {
        const { game } = await makeGameInWorld({
            seed: 'offer-a-promise', worldSeed: 'world-offer-a-promise'
        });
        const { cultivator } = await game.newRun('Promiser');
        await game.act('I look around');

        const here = (game as unknown as { present(c: unknown): { name: string }[] })
            .present(cultivator);
        const who = here[0]!.name;

        const said = await game.act(`offer ${who} my protection for The Hidden Edge`);
        const heard = said.error ?? said.narration ?? '';
        expect(heard).not.toMatch(/hands are empty of it/i);
    }, 200_000);
});
