/**
 * What a house's room taking an office off somebody costs them, and for how long.
 *
 * The rule was that somebody a room had taken an office off was never dealt one
 * again: a gate, and the doc said so while noting the permanence was unruled.
 * The design owner ruled it: *"depends on your influence so not permanent"*.
 *
 * So it is a weight against them in the dealing rather than a gate in front of
 * it, and a weight can be outgrown. What is pinned here: the weight is real and
 * heavy, it is not time served, and what lifts it is what somebody is worth to
 * the house now.
 *
 * See `src/engine/world/bringing-what-you-know-about-somebody-to-the-room.ts`.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    REMOVED_FROM_OFFICE,
    WHAT_A_REMOVAL_WEIGHS,
    howHeavyTheirRemovalStillIs,
    theDayTheyLostTheOffice,
    theRemovalTheyCarry,
    theRoomWouldDealToThemAgain,
    whatThisHouseMakesOfADisgraceElsewhere,
    whatTheyAreWorthToTheirHouseNow
} from '../../../src/engine/world/bringing-what-you-know-about-somebody-to-the-room.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

async function world(): Promise<WorldState> {
    return seedWorld({ seed: 'afford-a', catalog: await loadCultivationCatalog() }).state;
}

describe('a room taken off somebody', () => {
    it('weighs against them from the day it is done, and the day is on the row', async () => {
        const state = await world();
        const house = state.factions.find(f => f.ranks.length > 1 && state.npcs.some(n => n.factionId === f.id))!;
        const member = state.npcs.find(n => n.factionId === house.id)!;
        const day = state.currentDay;

        const disgraced = {
            ...member,
            face: 0,
            merit: null,
            factionRankIndex: 0,
            tags: [...member.tags, `${REMOVED_FROM_OFFICE}${house.id}:${day}`]
        };

        expect(theDayTheyLostTheOffice(disgraced)).toBe(day);
        expect(howHeavyTheirRemovalStillIs(disgraced, day)).toBeCloseTo(WHAT_A_REMOVAL_WEIGHS, 5);
        // Somebody the room never took anything off carries no weight at all,
        // which is nearly everybody.
        expect(howHeavyTheirRemovalStillIs({ ...member, tags: [] }, day)).toBe(0);
        expect(theRoomWouldDealToThemAgain(state, { ...member, tags: [] }, house, day)).toBe(true);
    });

    it('is not lifted by waiting alone, and is lifted by being worth something to the house', async () => {
        const state = await world();
        const house = state.factions.find(f => f.ranks.length > 1 && state.npcs.some(n => n.factionId === f.id))!;
        const member = state.npcs.find(n => n.factionId === house.id)!;
        const day = state.currentDay;

        const nobody = {
            ...member,
            face: 0,
            merit: null,
            factionRankIndex: 0,
            // An elder's span, because the clock is the point of this one: a
            // fiftieth of a hundred thousand years is a long memory, and the
            // floor under it is what keeps a mortal-grade disgrace real.
            cultivation: { ...member.cultivation, realmOrdinal: 30 },
            tags: [...member.tags, `${REMOVED_FROM_OFFICE}${house.id}:${day}`]
        };
        // Nothing rebuilt: the room does not come back to them, and waiting is
        // not a way out of it. At an elder's span a whole century takes exactly
        // half of it - measured, not chosen - and the person is still short of
        // what the room wants.
        expect(theRoomWouldDealToThemAgain(state, nobody, house, day)).toBe(false);
        const aCenturyOn = day + 100 * 365;
        expect(howHeavyTheirRemovalStillIs(nobody, aCenturyOn))
            .toBeGreaterThanOrEqual(WHAT_A_REMOVAL_WEIGHS / 2);
        expect(theRoomWouldDealToThemAgain(state, nobody, house, aCenturyOn)).toBe(false);
        // And nobody's memory is shorter than the floor, however short a life is.
        const mortal = { ...nobody, cultivation: { ...nobody.cultivation, realmOrdinal: 1 } };
        expect(howHeavyTheirRemovalStillIs(mortal, day + 10 * 365))
            .toBeGreaterThan(WHAT_A_REMOVAL_WEIGHS * 0.8);

        // The same person, worth something again: face won in front of people,
        // service counted by their own house, and the rung they climbed back to.
        const rebuilt = {
            ...nobody,
            face: 4,
            factionRankIndex: house.ranks.length - 1,
            merit: [{ houseId: house.id, points: 400, updatedOnDay: day }]
        };
        expect(whatTheyAreWorthToTheirHouseNow(state, rebuilt, house))
            .toBeGreaterThan(howHeavyTheirRemovalStillIs(rebuilt, day));
        expect(theRoomWouldDealToThemAgain(state, rebuilt, house, day)).toBe(true);
    });

    /**
     * A DISGRACE FOLLOWS THE PERSON, AND IS READ BY WHOEVER IS LOOKING.
     *
     * The lookup was keyed on the carrier's current house, which was harmless
     * while nobody could move between houses and silently worth nothing once
     * they could: a tag naming the house that did it, read by a house asking
     * about itself, found nothing. What replaces it finds the removal wherever
     * it was earned and weighs it by what THIS house makes of another's ruling.
     */
    it('is found at whatever house did it, and weighed by who is reading it', async () => {
        const state = await world();
        const houses = state.factions.filter(f =>
            f.ranks.length > 1 && state.npcs.some(n => n.factionId === f.id));
        const [here, elsewhere] = houses;
        const member = state.npcs.find(n => n.factionId === here!.id)!;
        const day = state.currentDay;

        // Disgraced at one house, standing with another now.
        const moved = {
            ...member,
            face: 0,
            merit: null,
            factionRankIndex: 0,
            cultivation: { ...member.cultivation, realmOrdinal: 30 },
            tags: [...member.tags, `${REMOVED_FROM_OFFICE}${elsewhere!.id}:${day}`]
        };
        // Found at all, which is the defect: this read null before.
        expect(theRemovalTheyCarry(moved)?.houseId).toBe(elsewhere!.id);
        expect(howHeavyTheirRemovalStillIs(moved, day)).toBeCloseTo(WHAT_A_REMOVAL_WEIGHS, 5);

        // And what it is worth here depends on who is reading it. A demonic
        // house makes nothing of a ruling that is not its own; a righteous one
        // holds most of it against them.
        const demonic = { ...here!, alignment: 'demonic' as const };
        const righteous = { ...here!, alignment: 'righteous' as const };
        expect(whatThisHouseMakesOfADisgraceElsewhere(elsewhere!.id, demonic)).toBe(0);
        expect(whatThisHouseMakesOfADisgraceElsewhere(elsewhere!.id, righteous))
            .toBeGreaterThan(0.5);
        // Its own ruling is worth all of it, whoever it is.
        expect(whatThisHouseMakesOfADisgraceElsewhere(here!.id, righteous)).toBe(1);
    });
});
