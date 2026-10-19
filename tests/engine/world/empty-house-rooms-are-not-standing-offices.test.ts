/** Certification counted 18 observations of an empty Lantern Hall as standing
 * offices. In the saved drift-guard 600-year checkpoint all seven holder fields
 * were null. A surviving treasury room is architecture; the roll supplies the
 * institution. The explorer must not turn an empty building into a holder. */
import { expect, it } from 'vitest';
import { inspectWorld } from '../../../explore/observe-world.js';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { portfoliosIn } from '../../../src/engine/social-leverage/authority-for-an-order.js';

it('lets an empty house retain a physical treasury without reporting a standing office', () => {
    const state = createWorld({ seed: 'empty-rooms', skipPriorAges: true, regionCount: 0 });
    const house = makeFaction({ id: 'house', name: 'Empty House', seatLocationId: 'ground' });
    state.factions.push(house);
    state.locations.push(makeLocation({ id: 'ground', name: 'Ground', kind: 'sect_seat' }),
        makeLocation({ id: 'treasury', name: 'Treasury', kind: 'hall', parentId: 'ground',
            controllingFactionId: house.id, data: { factionId: house.id, purpose: 'treasury', hallHolderId: null } }));
    expect(portfoliosIn({ locations: state.locations, npcs: state.npcs, sectId: house.id,
        roll: [], rankCount: house.ranks.length }).every(office => office.holderId === null && office.actingId === null)).toBe(true);
    expect(inspectWorld(state).findings.filter(finding => finding.subject === house.id)).toEqual([]);
});
