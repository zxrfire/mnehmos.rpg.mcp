/**
 * The standing-post pass returned before reading the house's own hall whenever
 * there were no market towns or public crossing watches. An isolated compound
 * therefore left its Life Lamp Hall unstaffed despite an available disciple.
 * Hall work uses the existing posting authority and requires an actual available
 * member; an absent disciple is not recalled to make a daily check happen.
 * With Internal Affairs nominations the fixture also supplies the house's actual
 * head, rather than making its sole junior appoint themselves.
 */
import { describe, expect, it } from 'vitest';
import { applyPostings } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';

function build(available: boolean) {
    const state = createWorld({ seed: 'isolated-lamp-hall', skipPriorAges: true, regionCount: 0 });
    state.currentDay = 50;
    state.locations.push(
        makeLocation({ id: 'seat', name: 'Hill House', kind: 'sect_seat', data: { factionId: 'house' } }),
        makeLocation({ id: 'lamps', name: 'Life Lamp Hall', kind: 'hall', parentId: 'seat',
            data: { factionId: 'house', purpose: 'life_lamp_hall' } })
    );
    state.factions.push(makeFaction({ id: 'house', name: 'Hill House', seatLocationId: 'seat',
        foundedOnDay: 0, ranks: ['Servant', 'Disciple', 'Elder', 'Head'] }));
    const member = setRealm(createNpc(state.seed, { id: 'disciple', bornOnDay: -3650,
        onDay: 50, locationId: available ? 'seat' : null, occupation: 'disciple' }), 14, 50);
    state.npcs.push({ ...member, factionId: 'house', factionRankIndex: 1, activity: null });
    const head = setRealm(createNpc(state.seed, { id: 'head', bornOnDay: -7300,
        onDay: 50, locationId: 'seat', occupation: 'house head' }), 14, 50);
    state.npcs.push({ ...head, factionId: 'house', factionRankIndex: 3, activity: null });
    return state;
}

describe('an isolated house keeps its Life Lamp Hall', () => {
    it('posts an available member without requiring an outward destination', () => {
        const state = build(true);
        expect(applyPostings(state, 0, 50, { initialPlacement: true })).toBeGreaterThan(0);
        const clerk = state.npcs[0]!;
        expect(clerk.locationId).toBe('lamps');
        expect(clerk.activity?.kind).toBe('stationed');
        expect(clerk.activity?.note).toContain('roll');
        expect(clerk.activity?.returnTo).toBe('seat');
        expect(clerk.activity?.conveyanceId ?? null).toBeNull();
        expect(applyPostings(state, 0, 50, { initialPlacement: true })).toBe(0);
    });

    it('does not staff a hall with an absent member', () => {
        const state = build(false);
        expect(applyPostings(state, 0, 50, { initialPlacement: true })).toBe(0);
        expect(state.npcs[0]!.activity).toBeNull();
    });
});
