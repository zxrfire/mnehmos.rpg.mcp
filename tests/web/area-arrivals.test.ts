/**
 * The web roster used to cut a merged crowd at three while area reads and offers
 * still saw the people underneath it. Run sheets and remote presences now take
 * real space in the same placement. Overflow can be walked to, and offers and
 * narration use exactly the occupants the player can face there.
 */
import { describe, expect, it } from 'vitest';
import { NASCENT_SOUL_ORDINAL } from '../../src/engine/cultivation/existence';
import { sendAProxy } from '../../src/engine/world/something-acting-in-your-place';
import { peopleInThisPlace } from '../../src/web/hearsay';
import { worldLocationFor } from '../../src/web/entities';
import { readWhatIsOnOfferHere } from '../../src/web/who-here-is-offering-something';
import { handleAssess } from '../../src/server/consolidated/cultivation-perception';
import { makeGameInWorld } from './harness';

describe('arrivals take space in the played roster', () => {
    it('keeps visiting sheets, companions and remote presences in reachable capped areas', async () => {
        const { game, repos, db } = await makeGameInWorld({ seed: 'area-arrivals', worldSeed: 'road-world' });
        const { cultivator } = await game.newRun('Visitor');
        const world = game.atHand!;
        const place = worldLocationFor(world, cultivator.location)!;
        for (let i = 0; i < 5; i++) {
            repos.cultivators.create({ ...cultivator, id: `visitor-${i}`, name: `Visitor ${i}`,
                runId: undefined, kind: 'npc', standingIn: null });
        }
        const companions = world.npcs.filter(n => n.status === 'alive' && !n.tags.includes('the-player')).slice(0, 7);
        for (const npc of companions) {
            npc.locationId = place.id;
            npc.activity = { kind: 'talking', note: '', withIds: [cultivator.id],
                sinceDay: world.currentDay, untilDay: world.currentDay + 2 };
        }
        const remote = world.npcs.filter(n => n.status === 'alive' && n.locationId !== place.id
            && n.cultivation.realmOrdinal >= NASCENT_SOUL_ORDINAL).slice(0, 4);
        expect(remote).toHaveLength(4);
        for (const npc of remote) expect(sendAProxy(world, npc, 'soul', place.id).proxy).not.toBeNull();
        game.theWorldMoved();

        const read = peopleInThisPlace(repos, cultivator, world, place);
        for (const npc of [...companions, ...remote]) expect(read.whereIs.has(npc.id)).toBe(true);
        for (const area of read.areas) {
            const occupying = [...read.whereIs.values(), ...read.whereBodiesAre.values()].filter(id => id === area.id);
            expect(occupying.length, area.name).toBeLessThanOrEqual(3);
            repos.cultivators.standIn(cultivator.id, area.id);
            const me = repos.cultivators.getById(cultivator.id)!;
            const present = game.present(me);
            expect(present.length).toBeLessThanOrEqual(3);
            expect(game.company(me).total).toBe(present.length);
            const assessed = await handleAssess({ action: 'assess', against: 'place', cultivatorId: me.id });
            expect((assessed as { reach?: { heads: number } }).reach?.heads).toBe(present.length);
            const offers = readWhatIsOnOfferHere(me, world, undefined, present);
            for (const offer of offers.offers) expect(present.map(n => n.id)).toContain(offer.sellerId);
            await game.act('who is here');
        }
        // Overflow visitors remain visible when the player walks to their area.
        for (let i = 0; i < 5; i++) {
            const me = repos.cultivators.getById(cultivator.id)!;
            const placement = peopleInThisPlace(repos, me, world, place);
            const at = placement.whereIs.get(`visitor-${i}`)!;
            const area = placement.areas.find(one => one.id === at)!;
            if (me.standingIn !== at) await game.act(`I move to ${area.name}`);
            expect(repos.cultivators.getById(cultivator.id)!.standingIn).toBe(at);
            expect(game.present(repos.cultivators.getById(cultivator.id)!).map(n => n.id)).toContain(`visitor-${i}`);
        }
        db.close();
    }, 120_000);
});
