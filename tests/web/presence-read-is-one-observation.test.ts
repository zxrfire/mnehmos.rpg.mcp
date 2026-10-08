/**
 * The 2026-10-03 boarding profile found repeated full-world presence reads inside
 * one stateView (guide, neighbouring practice and live roster). A synchronous
 * scope may reuse that unchanged observation, but must never retain a living
 * face after a later death/movement, including when the previous read threw.
 * stateView's scope contains synchronous readers and no participating roster
 * mutation. Profiles carry performance evidence; these assertions pin only
 * visible people, area equivalence and freshness across scope boundaries.
 */
import { describe, expect, it } from 'vitest';
import { makeGame } from './harness.js';
import { createWorld } from '../../src/engine/world/world-state.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { createNpc, markDead } from '../../src/engine/world/npc-state.js';
import { othersPresent, peopleInThisPlace, withPresenceReadScope } from '../../src/web/hearsay.js';
import { aRoomOfTheirOwn } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';

describe('presence scope ends with the observation', () => {
    it.each([false, true])('reads fresh after the scope closes (throws=%s)', async throws => {
        const { game, db } = makeGame({ seed: 'presence-read', worldEnabled: false });
        try {
            await game.newRun('Observer');
            const place = makeLocation({ id: 'here', name: 'The observation ground', kind: 'region' });
            const world = createWorld({ seed: 'presence-read', skipPriorAges: true, regionCount: 0 });
            world.locations.push(place);
            world.currentHour = 8;
            const npc = createNpc('presence-read', { id: 'the-face', bornOnDay: -7300,
                onDay: 0, locationId: place.id });
            world.npcs.push(npc);
            db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
                .run(place.name, game.currentRun().cultivator.id);
            const observerId = game.currentRun().cultivator.id;
            game.repos.cultivators.standIn(observerId, null);
            // Changing only the ground is not a local walk. Read the actual
            // person's public area; a region has several such areas even with one resident.
            const arrival = peopleInThisPlace(game.repos, game.currentRun().cultivator, world, place);
            const npcArea = arrival.whereIs.get(npc.id);
            expect(npcArea).toBeDefined();
            game.repos.cultivators.standIn(observerId, npcArea!);
            const observer = game.currentRun().cultivator;
            const observation = () => withPresenceReadScope(() => {
                const first = othersPresent(game.repos, observer, world);
                expect(first.map(n => n.id)).toContain(npc.id);
                expect(othersPresent(game.repos, observer, world)).toEqual(first);
                // The explicit place reader shares the same underlying placement.
                const read = peopleInThisPlace(game.repos, observer, world, place);
                expect(read.people.map(n => n.id)).toContain(npc.id);
                if (throws) throw new Error('Observation failed');
            });
            if (throws) expect(observation).toThrow('Observation failed');
            else observation();
            world.npcs[0] = markDead(npc, 0, 'Died after the observation');
            expect(othersPresent(game.repos, observer, world).map(n => n.id)).not.toContain(npc.id);
            // Independent fixture arms also observe a changed area and changed ground.
            world.npcs = [npc];
            const inPrivateRoom = { ...observer, standingIn: aRoomOfTheirOwn(place, observer.id).id };
            expect(withPresenceReadScope(() => othersPresent(game.repos, inPrivateRoom, world))).toEqual([]);
            const outside = makeLocation({ id: 'outside', name: 'Outside', kind: 'region' });
            world.locations.push(outside);
            npc.locationId = outside.id;
            expect(withPresenceReadScope(() => othersPresent(game.repos, observer, world))).toEqual([]);
        } finally { db.close(); }
    });
});
