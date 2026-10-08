/**
 * Root's 2026-10-03 boarding-live.cpuprofile sampled a 12-second state read:
 * 8.2 seconds inclusive in othersPresent and 2.06 seconds self in the proxy
 * objects.find. Each presence read asked every NPC to scan every world object.
 * One computed owner index now shares the existing dated-proxy predicate.
 * It must retain object-order first-match semantics and be recomputed after
 * time, ending or damage changes, without writing an active flag anywhere.
 */
import { describe, expect, it } from 'vitest';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { activeProxiesByOwner, whereYouCanActFrom } from '../../../src/engine/world/something-acting-in-your-place.js';

describe('one observation of active remote presences', () => {
    it('selects the first surviving owned proxy, excluding future, expired, ended and ruined objects', () => {
        const world = createWorld({ seed: 'proxy-read', skipPriorAges: true, regionCount: 0 });
        world.currentDay = 20;
        const proxy = (id: string, data = {}, tags = ['acting-proxy']) => makeObject({
            id, name: id, kind: 'artifact', ownerId: 'maker', tags,
            data: { madeOnDay: 10, lapsesOnDay: 30, ...data }
        });
        world.objects = [proxy('future', { madeOnDay: 21 }), proxy('expired', { lapsesOnDay: 20 }),
            proxy('ended', { endedOnDay: 20 }), proxy('ruined', {}, ['acting-proxy', 'ruined']),
            proxy('ordinary', {}, []), proxy('first', { endedOnDay: 21 }), proxy('second')];
        const unowned = proxy('unowned');
        unowned.ownerId = null;
        world.objects.unshift(unowned);
        const before = structuredClone(world);
        const read = activeProxiesByOwner(world);
        expect([...read.keys()]).toEqual(['maker']);
        expect(read.get('maker')!.id).toBe('first');
        expect(read.get('maker')).toBe(whereYouCanActFrom(world, 'maker'));
        expect(read.get('absent')).toBeUndefined();
        expect(world).toEqual(before);

        // A fresh observation sees the expired end and the now-made earlier row.
        world.currentDay = 21;
        expect(activeProxiesByOwner(world).get('maker')!.id).toBe('future');
        world.objects.find(o => o.id === 'future')!.tags.push('ruined');
        expect(activeProxiesByOwner(world).get('maker')!.id).toBe('second');
        expect(whereYouCanActFrom(world, 'maker')!.id).toBe('second');
        expect(activeProxiesByOwner(world, 30).has('maker')).toBe(false);
        expect(whereYouCanActFrom(world, 'maker', 30)).toBeNull();
    });
});
