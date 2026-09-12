/**
 * A residence holds things, and it holds them in the one inventory.
 *
 * The design owner, on the residence ruling he remembered: *"if a player gets
 * assigned a residence, then they can leave their stuff in the residence. so
 * give the residence an inventory system. true for npc's as well."*
 *
 * The last four words are what makes this cheap. `cultivator_pouch` is keyed
 * on a free-form `holder_id` - it stopped being keyed on a cultivator when a
 * death settlement needed a corpse's pills to go somewhere - so a residence
 * holds things by BEING a holder, and so does an NPC. There is no residence
 * inventory table, no NPC inventory table, and no new read: the same three
 * functions a pouch uses answer for all three.
 *
 * WHICH IS THE WHOLE POINT of bringing books into the pouch in the same pass.
 * A residence that could hold a pill and not a book would be the bespoke store
 * again, one level up.
 */

import { describe, expect, it } from 'vitest';

import { makeGame } from './harness.js';
import { createWorld, getNpc } from '../../src/engine/world/world-state.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import {
    theyTakeGroundAndMakeItTheirs,
    whereTheyKeepTheirThings
} from '../../src/engine/world/somewhere-that-is-theirs.js';
import {
    addToPouch,
    everythingInThePouch
} from '../../src/server/consolidated/cultivation-support.js';
import {
    copiesHeldBy,
    recordACopyHeld
} from '../../src/server/consolidated/technique-manage.js';

const DAY = 400_000;
const A_PILL = 'pill-minor-healing';
const A_MANUAL = 'lesser-qi-gathering-manual';

function somebodyWithAPlace(seed: string) {
    const state = createWorld({ seed, skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({
        id: 'loc-valley', name: 'The Valley', kind: 'settlement', qiDensity: 0.4
    }));
    state.npcs.push(createNpc(state.seed, {
        id: 'npc-settler',
        name: 'Settler',
        bornOnDay: DAY - 40 * 365,
        onDay: DAY,
        locationId: 'loc-valley',
        cultivation: { realmOrdinal: 14 }
    }));
    const settled = theyTakeGroundAndMakeItTheirs(state, {
        residentId: 'npc-settler',
        onDay: DAY
    });
    return { state: settled.state, pack: whereTheyKeepTheirThings(settled.state, 'npc-settler')! };
}

describe('a residence holds a pack', () => {
    it('keeps a pill and a book side by side, under the place', async () => {
        const { game, db } = makeGame({ seed: 'residence-pack', worldEnabled: false });
        await game.newRun('Settler');
        const { pack } = somebodyWithAPlace('residence-pack');

        addToPouch(db, pack, A_PILL, 'pill', 3);
        recordACopyHeld(db, pack, A_MANUAL);

        expect(everythingInThePouch(db, pack).map(row => row.itemId).sort())
            .toEqual([A_MANUAL, A_PILL].sort());
        expect(copiesHeldBy(db, pack)).toContain(A_MANUAL);
    });

    it('is the place and not the person, which is the whole reason to have one', async () => {
        const { game, db } = makeGame({ seed: 'residence-apart', worldEnabled: false });
        await game.newRun('Settler');
        const { state, pack } = somebodyWithAPlace('residence-apart');

        addToPouch(db, pack, A_PILL, 'pill', 3);

        // A thing left at home is not a thing on the body. Without that, a
        // residence is a second name for a pouch.
        expect(getNpc(state, 'npc-settler')).not.toBeNull();
        expect(everythingInThePouch(db, 'npc-settler')).toHaveLength(0);
        expect(everythingInThePouch(db, pack)).toHaveLength(1);
    });

    it('answers for an NPC with nothing in the storage layer knowing the difference', async () => {
        const { game, db } = makeGame({ seed: 'residence-npc', worldEnabled: false });
        await game.newRun('Visitor');
        const { pack } = somebodyWithAPlace('residence-npc');

        addToPouch(db, pack, A_PILL, 'pill', 2);

        // An NPC residence with things in it is the reason to walk to one.
        expect(everythingInThePouch(db, pack).map(row => row.quantity)).toEqual([2]);
    });
});
