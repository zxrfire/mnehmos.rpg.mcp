/**
 * A residence is a place with a pack, and it is one notion at every height.
 *
 * THE RULING WAS ALREADY WRITTEN DOWN, in
 * `docs/world/climbing/capability-gaps-by-realm.md`, twice:
 *
 *     A permanent cultivation residence | absent | `settleAbode` exists and is
 *     immortal-layer only. Below the Lid a cultivator has nowhere that is
 *     theirs, no place to store anything, nothing to defend. The generic
 *     machinery is all present - locations have owners, objects have
 *     `locationId`, `evaluateAccess` gates a door - so this is a CALL SITE,
 *     not a subsystem.
 *
 * and, in the ranked list of what to build next: *"A residence below the Lid.
 * `settleAbode` generalised off the immortal layer. Gives Foundation
 * Establishment a place, a store, and something to lose."*
 *
 * So this file pins two things and no more.
 *
 * ONE NOTION. `residenceOf` answers for an immortal's abode and for a
 * Foundation cultivator's cave by the same read, because they are the same
 * thing at two heights. A second read for the layer below would be the second
 * copy of a fact this repo keeps paying for.
 *
 * AND A PACK RATHER THAN A STORE OF ITS OWN. `cultivator_pouch` is keyed on a
 * free-form `holder_id`, which is what the ruling means by "a call site": a
 * residence holds things by BEING a holder, and every read written over what
 * somebody is carrying answers for it unchanged. NPCs get one for the same
 * reason - the design owner said so in as many words - and an NPC residence
 * with things in it is the reason to visit somebody else's.
 */

import { describe, expect, it } from 'vitest';

import { createWorld, getLocation, getNpc } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import {
    residenceOf,
    theyTakeGroundAndMakeItTheirs,
    whereTheyKeepTheirThings
} from '../../../src/engine/world/somewhere-that-is-theirs.js';

const SEED = 'a-place-of-their-own';
const DAY = 400_000;

function aWorldAndSomebodyInIt() {
    const state = createWorld({ seed: SEED, skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({
        id: 'loc-valley', name: 'The Valley', kind: 'settlement', qiDensity: 0.4
    }));
    const npc = createNpc(state.seed, {
        id: 'npc-settler',
        name: 'Settler',
        bornOnDay: DAY - 40 * 365,
        onDay: DAY,
        locationId: 'loc-valley',
        cultivation: { realmOrdinal: 14 }
    });
    state.npcs.push(npc);
    return { state, npc };
}

describe('somewhere that is theirs', () => {
    it('gives somebody below the Lid a place, where there was none', () => {
        const { state, npc } = aWorldAndSomebodyInIt();

        expect(residenceOf(state, npc.id)).toBeNull();

        const settled = theyTakeGroundAndMakeItTheirs(state, {
            residentId: npc.id,
            onDay: state.currentDay
        });

        expect(settled.ok).toBe(true);
        expect(settled.created).toBe(true);
        expect(settled.residence).not.toBeNull();
        expect(residenceOf(settled.state, npc.id)?.id).toBe(settled.residence!.id);
    });

    it('settling twice is settling once', () => {
        const { state, npc } = aWorldAndSomebodyInIt();

        const first = theyTakeGroundAndMakeItTheirs(state, {
            residentId: npc.id,
            onDay: state.currentDay
        });
        const again = theyTakeGroundAndMakeItTheirs(first.state, {
            residentId: npc.id,
            onDay: state.currentDay + 400
        });

        expect(again.ok).toBe(true);
        expect(again.created).toBe(false);
        expect(again.residence?.id).toBe(first.residence?.id);
        expect(again.state.locations.filter(l => l.id === first.residence!.id)).toHaveLength(1);
    });

    it('is held by the person, and the world says whose it is', () => {
        const { state, npc } = aWorldAndSomebodyInIt();

        const settled = theyTakeGroundAndMakeItTheirs(state, {
            residentId: npc.id,
            onDay: state.currentDay
        });
        const here = getLocation(settled.state, settled.residence!.id)!;

        expect(here.data.heldById).toBe(npc.id);
        expect(getNpc(settled.state, npc.id)?.locationId).toBe(here.id);
    });

    it('refuses a person the world does not have', () => {
        const { state } = aWorldAndSomebodyInIt();

        const settled = theyTakeGroundAndMakeItTheirs(state, {
            residentId: 'npc-nobody-at-all',
            onDay: state.currentDay
        });

        expect(settled.ok).toBe(false);
        expect(settled.residence).toBeNull();
    });

    it('names the pack it keeps, and it is the one everything else is kept in', () => {
        const { state, npc } = aWorldAndSomebodyInIt();

        expect(whereTheyKeepTheirThings(state, npc.id)).toBeNull();

        const settled = theyTakeGroundAndMakeItTheirs(state, {
            residentId: npc.id,
            onDay: state.currentDay
        });

        // The holder key IS the place. There is no residence-inventory table,
        // which is the whole of the ruling: a residence is a place with a pack.
        expect(whereTheyKeepTheirThings(settled.state, npc.id))
            .toBe(settled.residence!.id);
    });
});

