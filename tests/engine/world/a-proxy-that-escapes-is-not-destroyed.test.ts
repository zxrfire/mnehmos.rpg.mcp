/**
 * Three proxy combat writers treated losing as destruction, including an actual
 * escape with body remaining. This ordinary background revenge attempt is
 * replayed through its existing fight stream. The surviving escape must retain
 * its charged body and sword; a body actually emptied must still be destroyed.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc, addGoal, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { sendAProxy, proxyCombatant, advanceSeparatedPresences } from '../../../src/engine/world/something-acting-in-your-place.js';
import { combatantOf } from '../../../src/engine/world/gatherings.js';
import { resolveConfrontation } from '../../../src/engine/cultivation/combat.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { AN_ORDINARY_SWING } from '../../../src/engine/cultivation/how-a-blow-was-thrown.js';
import { ambientForLocationOnDay } from '../../../src/engine/cultivation/ambient.js';

it('keeps a proxy that actually escaped and destroys only its emptied body', () => {
    let escapes = 0, destroyed = 0;
    for (let sample = 0; sample < 64; sample++) {
        const world = createWorld({ seed: `proxy-survives-flight-${sample}`, skipPriorAges: true, regionCount: 0 });
        world.currentDay = 1;
        const source = makeLocation({ id: 'source', name: 'A quiet village', kind: 'settlement' });
        const destination = makeLocation({ id: 'destination', name: 'A second village', kind: 'settlement' });
        world.locations.push(source, destination);
        const body = (id: string, locationId: string, ordinal = 15) => createNpc(world.seed, {
            id, name: id, bornOnDay: -30 * 365, onDay: 1, locationId,
            cultivation: { realmOrdinal: ordinal, spiritRoot: 'single_fire',
                attributes: { might: 2, insight: 2, fortune: 1, charm: 2 }, techniqueIds: [] }
        });
        const target = body('target', destination.id);
        const maker = addGoal(body('maker', source.id), { kind: 'revenge', text: 'Answer the person they hold it against.',
            targetId: target.id }, 1);
        const player = body('player', source.id, 0);
        player.tags.push(PLAYER_ROW_TAG);
        world.npcs.push(maker, target, player);
        world.objects.push(makeObject({ id: 'sent-sword', name: 'A carried sword', kind: 'artifact', power: 15,
            ownerId: maker.id, possessorId: maker.id, tags: ['sword'] }));
        world.objects.push(makeObject({ id: 'held-sword', name: 'A carried sword', kind: 'artifact', power: 15,
            ownerId: target.id, possessorId: target.id, tags: ['sword'] }));
        const sent = sendAProxy(world, maker, 'sword', destination.id);
        expect(sent.proxy, sent.line).not.toBeNull();
        const proxy = sent.proxy!;
        const full = proxyCombatant(world, proxy)!;
        proxy.data.hp = Math.floor(full.maxHp * (sample % 2 === 0 ? 0.24 : 0.01));
        const attacker = proxyCombatant(world, proxy)!;
        const ordinary = resolveConfrontation(attacker, combatantOf(target, world), {
            rng: forStream(world.seed, 'proxy-fight', proxy.id, target.id, world.currentDay),
            ambient: ambientForLocationOnDay(world.seed, destination.id, world.currentDay,
                { density: destination.environment.spiritualDensity }), turn: 1,
            intent: { thrown: AN_ORDINARY_SWING }
        });
        const escaped = ordinary.hp[proxy.id]! > 0 && ordinary.exchanges.some(exchange =>
            exchange.defenderId === proxy.id && exchange.flight?.escaped);
        const emptied = ordinary.hp[proxy.id]! <= 0;
        if (!escaped && !emptied) continue;
        advanceSeparatedPresences(world, 0);
        expect(proxy.data.hp).toBe(ordinary.hp[proxy.id]);
        if (escaped) {
            escapes++;
            expect(proxy.data.endedOnDay, 'a surviving escape is not destruction').toBeUndefined();
            expect(world.objects.find(object => object.id === 'sent-sword')!.tags).not.toContain('ruined');
        } else {
            destroyed++;
            expect(proxy.data.lost).toBe(true);
            expect(world.objects.find(object => object.id === 'sent-sword')!.tags).toContain('ruined');
        }
    }
    expect(escapes, 'native revenge fights must actually reach a surviving flight').toBeGreaterThan(0);
    expect(destroyed, 'native revenge fights must also empty a proxy body').toBeGreaterThan(0);
});
