/**
 * A vehicle goes with its owner until it is left, and is reachable only when they are with it.
 * The owner: "when you buy it, you take it with you", riding needs it where you are "unless you
 * fit it in a storage ring", and it holds things the way a ring does.
 */
import { describe, expect, it } from 'vitest';

import {
    aVehicleOf,
    isWithThem,
    leaveItHere,
    takeItAlong,
    theVehiclesLeftElsewhere,
    theVehiclesTheyAreWith,
    WHAT_A_BERTH_TAKES
} from '../../../src/engine/world/a-vehicle.js';
import { WHAT_A_RING_HOLDS } from '../../../src/engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';

const cart = () => aVehicleOf({ id: 'cart', conveyanceId: 'conv-carriage-mortal', ownerId: 'you', ownerName: 'Ke Yan', at: 'market' });

describe('a vehicle', () => {
    it('goes with whoever bought it, wherever they are', () => {
        const objects = [cart()];
        expect(isWithThem(objects[0]!, 'you', 'market')).toBe(true);
        expect(isWithThem(objects[0]!, 'you', 'a-province-away')).toBe(true);
        expect(isWithThem(objects[0]!, 'somebody-else', 'market')).toBe(false);
    });

    it('stays where it was left, reachable only there, until it is taken along again', () => {
        const objects = [cart()];
        leaveItHere(objects, objects[0]!, 'inn-yard');
        expect(theVehiclesTheyAreWith(objects, 'you', 'far-road')).toEqual([]);
        expect(theVehiclesLeftElsewhere(objects, 'you', 'far-road').map(o => o.id)).toEqual(['cart']);
        expect(isWithThem(objects[0]!, 'you', 'inn-yard')).toBe(true);
        takeItAlong(objects, objects[0]!, 'you');
        expect(isWithThem(objects[0]!, 'you', 'far-road')).toBe(true);
    });

    it('is nobody\'s to ride while it is in a ring', () => {
        const objects = [{ ...cart(), possessorId: 'ring' }];
        expect(isWithThem(objects[0]!, 'you', 'market')).toBe(false);
    });

    it('takes a berth a head, so a heaven ring holds a spirit skiff', () => {
        const boat = aVehicleOf({ id: 'boat', conveyanceId: 'conv-spirit-boat', ownerId: 'you', ownerName: 'Ke Yan', at: null });
        expect(boat.volume).toBe(30 * WHAT_A_BERTH_TAKES);
        expect(boat.volume).toBeLessThanOrEqual(WHAT_A_RING_HOLDS.heaven);
    });
});
