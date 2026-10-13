/**
 * The world had no closed-door activity, although routines claimed it had a calendar.
 * This checks the paid absence as a body at home, exact settlement once, and an
 * emergency's unspent provisions. A closed door must not become a vanishing rumour.
 * Removing only the payment debit made both conservation checks fail in the whole file.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, isAwayOnSomething } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { beginClosedDoorCultivation, inClosedDoorCultivation, settleClosedDoorCultivation,
    interruptClosedDoorCultivation, closedDoorCultivationThisYear } from '../../../src/engine/world/closed-door-cultivation.js';
import { routineOf } from '../../../src/engine/world/npc-routines.js';
import { whetherTheyWouldLookUp } from '../../../src/engine/world/what-somebody-is-at-when-you-walk-up.js';
import { STONES_PER_YEAR_OF_SECLUSION } from '../../../src/engine/cultivation/origin.js';
import { applyPressure, settlePracticeOnContact } from '../../../src/engine/world/the-world-changing-on-its-own.js';

function arrangement() {
    const world = createWorld({ seed: 'closed-door-world', skipPriorAges: true, regionCount: 0 });
    world.locations.push(makeLocation({ id: 'home', name: 'Private residence', kind: 'cave',
        tags: ['residence'], data: { heldById: 'cultivator' } }));
    world.npcs.push(createNpc(world.seed, { id: 'cultivator', bornOnDay: -30 * 365, onDay: 0,
        locationId: 'home', spiritStones: 10000, cultivation: { realmOrdinal: 20 } }));
    world.npcs[0].activity = null;
    return world;
}

describe('a person closes their door', () => {
    it('pays from their own purse and remains at home, unavailable for ordinary work', () => {
        const world = arrangement(), purse = world.npcs[0].spiritStones;
        expect(beginClosedDoorCultivation(world, 'cultivator', 0, 730)).toBe(true);
        expect(world.npcs[0].spiritStones).toBe(purse - STONES_PER_YEAR_OF_SECLUSION * 2);
        const read = routineOf({ ...world, currentDay: 300, currentHour: 12 }, world.npcs[0]);
        expect(read.home).toBe(true);
        expect(read.locationId).toBe('home');
        expect(read.activity?.kind).toBe('closed_door_cultivation');
        expect(whetherTheyWouldLookUp(read.activity!.kind)).toBe(false);
        expect(isAwayOnSomething(read.activity!.kind)).toBe(true);
        expect(beginClosedDoorCultivation(world, 'cultivator', 300, 365)).toBe(false);
    });

    it('reviews at the real end day once, with no second payment', () => {
        const world = arrangement(), reviews: number[] = [];
        beginClosedDoorCultivation(world, 'cultivator', 0, 730);
        const purse = world.npcs[0].spiritStones;
        expect(settleClosedDoorCultivation(world, 729, (_, day) => reviews.push(day))).toBe(0);
        expect(settleClosedDoorCultivation(world, 900, (_, day) => reviews.push(day))).toBe(1);
        expect(settleClosedDoorCultivation(world, 900, (_, day) => reviews.push(day))).toBe(0);
        expect(reviews).toEqual([730]);
        expect(world.npcs[0].spiritStones).toBe(purse);
        expect(inClosedDoorCultivation(world.npcs[0], 900)).toBe(false);
    });

    it('refuses a span the body or purse cannot supply, without charging', () => {
        const world = arrangement(), purse = world.npcs[0].spiritStones;
        expect(beginClosedDoorCultivation(world, 'cultivator', 0, Infinity)).toBe(false);
        expect(beginClosedDoorCultivation(world, 'cultivator', 0, world.npcs[0].cultivation.lifespanEndsOnDay + 1)).toBe(false);
        world.npcs[0].spiritStones = 1;
        expect(beginClosedDoorCultivation(world, 'cultivator', 0, 365)).toBe(false);
        expect(world.npcs[0].spiritStones).toBe(1);
        expect(purse).toBeGreaterThan(1);
    });

    it('returns unspent provisions when the house calls them out, once', () => {
        const world = arrangement(), purse = world.npcs[0].spiritStones;
        beginClosedDoorCultivation(world, 'cultivator', 0, 730);
        world.npcs[0].factionId = 'house';
        expect(interruptClosedDoorCultivation(world, 'house', 365, 'actual-war')).toBe(1);
        expect(world.npcs[0].spiritStones).toBeCloseTo(purse - STONES_PER_YEAR_OF_SECLUSION);
        expect(interruptClosedDoorCultivation(world, 'house', 365, 'actual-war')).toBe(0);
    });

    it('the live pressure and contact paths settle the actual deadline', () => {
        const world = arrangement();
        beginClosedDoorCultivation(world, 'cultivator', 0, 91);
        applyPressure(world, 0, 92, { intensity: 0 });
        expect(world.npcs[0].activity?.kind).not.toBe('closed_door_cultivation');
        expect(world.history.facts.some(fact => fact.data.closedDoorCultivationEnded === true && fact.day === 91)).toBe(true);
        const contact = arrangement();
        beginClosedDoorCultivation(contact, 'cultivator', 0, 91);
        contact.currentDay = 92;
        settlePracticeOnContact(contact, new Set(['cultivator']));
        expect(contact.npcs[0].activity?.kind).not.toBe('closed_door_cultivation');
        const fractional = arrangement();
        beginClosedDoorCultivation(fractional, 'cultivator', 0, 91.25);
        fractional.currentDay = 91; fractional.currentHour = 6;
        settlePracticeOnContact(fractional, new Set(['cultivator']));
        expect(fractional.npcs[0].activity?.kind).not.toBe('closed_door_cultivation');
    });

    it('the background rate reaches actual residents over years, without inventing homes', () => {
        let starts = 0;
        for (let year = 0; year < 80; year++) {
            const world = arrangement();
            starts += closedDoorCultivationThisYear(world, year, 0).length;
        }
        expect(starts).toBeGreaterThan(0);
        const world = arrangement();
        world.locations[0].data.heldById = 'someone-else';
        expect(beginClosedDoorCultivation(world, 'cultivator', 0, 365)).toBe(false);
    });
});
