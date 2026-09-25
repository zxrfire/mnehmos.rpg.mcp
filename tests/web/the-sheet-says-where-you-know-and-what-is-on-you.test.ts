/**
 * The sheet lists the places they know of and what is on them, so a player does not have to
 * remember either. The owner: "i need a list of known places otherwise the game is too hard to
 * play", shown by awareness level, and "add an inventory tab ... inventory, equipment".
 */
import { describe, expect, it } from 'vitest';

import { aStorageRing } from '../../src/engine/world/a-storage-ring.js';
import { hadAs, makeObject } from '../../src/engine/world/possessions.js';
import { makeGameInWorld } from './harness.js';

describe('the sheet', () => {
    it('lists a place heard of as heard, one stood in as been, and hides one never heard of', async () => {
        const { game } = await makeGameInWorld({ seed: 'a-sheet-of-places', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const [heard, been, unheard] = game.atHand!.locations
            .filter(place => place.kind === 'settlement' && place.name !== cultivator.location)
            .filter(place => !game.knowledge.isAwareOf(cultivator.id, 'place', place.name))
            .slice(0, 3);
        for (const [place, stage, sourceKind] of [[heard!, 'named', 'told'], [been!, 'encountered', 'witnessed']] as const) {
            game.knowledge.learn({ holderId: cultivator.id, kind: 'place', id: place.name, name: place.name,
                onDay: 0, sourceKind, stage });
        }

        const places = game.state().derived.places;
        expect(places[0]).toMatchObject({ name: cultivator.location, here: true, known: 'been' });
        expect(places.find(place => place.name === heard!.name)?.known).toBe('heard');
        expect(places.find(place => place.name === been!.name)?.known).toBe('been');
        expect(places.some(place => place.name === unheard!.name)).toBe(false);
    }, 180_000);

    it('shows what is worn, held, in the pouch and in a ring', async () => {
        const { game } = await makeGameInWorld({ seed: 'a-sheet-of-things', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const objects = game.atHand!.objects;
        objects.push(hadAs(aStorageRing({ id: 'ring', grade: 'earth', ownerId: cultivator.id, ownerName: 'Ke Yan', ownerOrdinal: 20 }), 'worn'));
        objects.push(makeObject({ id: 'gourd', name: 'a wine gourd', kind: 'other', volume: 2, possessorId: 'ring', ownerId: cultivator.id }));
        objects.push(hadAs(makeObject({ id: 'blade', name: 'a plain saber', kind: 'artifact', volume: 3,
            possessorId: cultivator.id, ownerId: cultivator.id }), 'held'));
        objects.push(makeObject({ id: 'chest', name: 'a lacquered chest', kind: 'other', volume: 10,
            possessorId: cultivator.id, ownerId: cultivator.id }));

        const things = game.state().derived.things!;
        expect(things.worn).toContain(objects.find(o => o.id === 'ring')!.name);
        expect(things.held).toEqual(['a plain saber']);
        expect(things.inventory).toContain('a lacquered chest');
        expect(things.rings[0]!.inside).toEqual(['a wine gourd']);
    }, 180_000);
});
