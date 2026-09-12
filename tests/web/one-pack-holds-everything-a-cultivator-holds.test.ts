/**
 * A book is held where a pill is held, and everything that acts on held things
 * reaches both.
 *
 * FOUND BY PLAYING, one turn after buying:
 *
 *     what am I carrying  ->  Books: Lesser Qi-Gathering Manual, ...
 *     I smash the manual  ->  "...You are carrying nothing."
 *
 * A counted pill destroyed correctly and a counted book did not, and the
 * refusal was not merely a refusal: it was a FALSE STATEMENT about the
 * player's own pack, one turn after the same engine had listed the book in it.
 *
 * The cause was not the destroy verb. Books lived in `manual_copies_held`, a
 * per-cultivator flag, and the pouch is a different store, so nothing written
 * against held things could see one. Three places in `src/web/` already record
 * the consequence against themselves - `sell` had no path to a held volume and
 * routed the sentence to the write-out-a-copy mechanic, `give` refuses a book
 * saying *"the taker has no flag to hold it in"*, and `travel-verbs.ts` notes
 * a bought mule that no sentence could see for the same shape of reason.
 *
 * THE RULING: *"they should be held in the same general inventory, not
 * bespoke."* So `cultivator_pouch` is the one store. It was already keyed on a
 * free-form `holder_id` rather than on a cultivator, which is what makes a
 * residence and an NPC able to hold things too.
 *
 * What these assertions pin is the PROPERTY rather than the table: a thing the
 * inventory read prints is a thing every verb over held things can reach.
 */

import { describe, expect, it } from 'vitest';

import { makeGame } from './harness.js';
import {
    copiesHeldBy,
    recordACopyHeld,
    theCopyLeftTheirHands
} from '../../src/server/consolidated/technique-manage.js';
import {
    everythingInThePouch,
    listPouch,
    listCarriedArtifacts
} from '../../src/server/consolidated/cultivation-support.js';
import { whatAllOfThatTakes } from '../../src/engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import { getTechnique } from '../../src/data/cultivation/techniques.js';

const A_MANUAL = 'lesser-qi-gathering-manual';
/** Typed back exactly as the catalog prints it: a name the game prints, it takes. */
const ITS_NAME = getTechnique(A_MANUAL)!.name;

describe('a book is in the pack the rest of the pack is in', () => {
    it('shows up as a row of the one inventory, not as a store of its own', async () => {
        const { game, db } = makeGame({ seed: 'one-pack-book', worldEnabled: false });
        const { cultivator } = await game.newRun('Reader');

        recordACopyHeld(db, cultivator.id, A_MANUAL);

        const all = everythingInThePouch(db, cultivator.id);
        expect(all.map(row => row.itemId)).toContain(A_MANUAL);
        expect(all.find(row => row.itemId === A_MANUAL)?.kind).toBe('manual');
    });

    it('is still not a reagent and still not a rated object', async () => {
        // The two filtered readers have jobs, and a book is in neither: the
        // alchemy reader must not offer a book as an ingredient and the yard
        // must not try to ride one.
        const { game, db } = makeGame({ seed: 'one-pack-filters', worldEnabled: false });
        const { cultivator } = await game.newRun('Reader');

        recordACopyHeld(db, cultivator.id, A_MANUAL);

        expect(listPouch(db, cultivator.id).map(r => r.itemId)).not.toContain(A_MANUAL);
        expect(listCarriedArtifacts(db, cultivator.id).map(r => r.itemId)).not.toContain(A_MANUAL);
    });

    it('takes up room and weighs something, because it is an object in a pack', async () => {
        const { game, db } = makeGame({ seed: 'one-pack-load', worldEnabled: false });
        const { cultivator } = await game.newRun('Reader');

        const empty = whatAllOfThatTakes(everythingInThePouch(db, cultivator.id));
        recordACopyHeld(db, cultivator.id, A_MANUAL);
        const carrying = whatAllOfThatTakes(everythingInThePouch(db, cultivator.id));

        expect(carrying.weight).toBeGreaterThan(empty.weight);
        expect(carrying.volume).toBeGreaterThan(empty.volume);
    });

    it('answers the copies question the same way it always did', async () => {
        const { game, db } = makeGame({ seed: 'one-pack-copies', worldEnabled: false });
        const { cultivator } = await game.newRun('Reader');

        expect(copiesHeldBy(db, cultivator.id)).not.toContain(A_MANUAL);
        recordACopyHeld(db, cultivator.id, A_MANUAL);
        expect(copiesHeldBy(db, cultivator.id)).toContain(A_MANUAL);
        // Buying a second copy of a book you own is not an event.
        recordACopyHeld(db, cultivator.id, A_MANUAL);
        expect(copiesHeldBy(db, cultivator.id).filter(id => id === A_MANUAL)).toHaveLength(1);
        expect(theCopyLeftTheirHands(db, cultivator.id, A_MANUAL)).toBe(true);
        expect(copiesHeldBy(db, cultivator.id)).not.toContain(A_MANUAL);
        expect(theCopyLeftTheirHands(db, cultivator.id, A_MANUAL)).toBe(false);
    });
});

describe('what the inventory prints, the breaking verb reaches', () => {
    it('breaks the book the read one turn earlier said was in the pack', async () => {
        const { game, db } = makeGame({ seed: 'one-pack-smash', worldEnabled: false });
        const { cultivator } = await game.newRun('Breaker');

        recordACopyHeld(db, cultivator.id, A_MANUAL);

        const turn = await game.act(`I smash the ${ITS_NAME}`);
        const said = turn.narration;

        // THE FALSE STATEMENT, pinned by its absence. The old refusal told
        // somebody holding a book that they were carrying nothing.
        expect(said).not.toContain('You are carrying nothing');
        expect(turn.toolCalls.some(call => call.action === 'destroy' && call.ok)).toBe(true);
        expect(copiesHeldBy(db, cultivator.id)).not.toContain(A_MANUAL);
    });

    it('names the book among what could be broken when nothing was named', async () => {
        const { game, db } = makeGame({ seed: 'one-pack-unnamed', worldEnabled: false });
        const { cultivator } = await game.newRun('Breaker');

        recordACopyHeld(db, cultivator.id, A_MANUAL);

        const turn = await game.act('I smash it');
        expect(turn.narration).toContain(ITS_NAME);
    });
});
