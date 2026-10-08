/**
 * Oct7 audit: the current played hired-carriage seed encounters spirit wolves,
 * which cannot prove the owner's HUMAN-band deterrence rule. The existing
 * escort contract is catalogue count versus actual crew heads (more than2:1
 * attacks); it does not read an ordinal-based deterrence rule. Paid road crew
 * is the one real accepted driver, not three fictional guards.
 *
 * These SELECTED-OCCASION controls use a genuine advertised carriage commit,
 * its actual driver, the unmodified eligible human catalogue row, and the same
 * seeded fill/resolve factories as window.ts. They do NOT force a fight winner,
 * default random catalogue selection, or a persistent opposing NPC party.
 * Native seeded count preconditions remain explicit and UNVERIFIED until root
 * runs this candidate. The two existing played seeds are not swept or adjusted.
 * A nearby native castId is preserved, but is not the count-member party:
 * theRestOfTheFight still creates anonymous catalogue opponent combat bodies.
 * Existing pure escort boundary tests separately cover both2:1 sides.
 */
import { describe, expect, it } from 'vitest';
import { getEncounter } from '../../../src/data/cultivation/encounters.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { encounterPool } from '../../../src/engine/encounters/select.js';
import { fillTokens } from '../../../src/engine/encounters/tokens.js';
import { resolveOccurrence } from '../../../src/engine/encounters/resolve.js';
import { whatTheEscortMet } from '../../../src/engine/encounters/an-escort-on-the-road.js';
import type { EncounterPlace, EncounterRoll } from '../../../src/engine/encounters/types.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { addPlacesOnTheWay } from '../../../src/engine/world/places-on-the-way.js';
import { quotePublicCarriage, commitPublicCarriage, publicCarriagePassage } from '../../../src/engine/world/public-carriages.js';

function acceptedCarriage() {
    const world = createWorld({ seed: 'native-human-band-world', regionCount: 0, skipPriorAges: true });
    world.currentDay = 100; world.currentHour = 0;
    const from = makeLocation({ id: 'native-band-from', name: 'Band control departure', kind: 'settlement' });
    const to = makeLocation({ id: 'native-band-to', name: 'Band control destination', kind: 'settlement' });
    linkLocations(from, to, 'road', 8);
    world.locations = [from, to]; addPlacesOnTheWay(world.locations);
    const passenger = createNpc(world.seed, { id: 'native-band-passenger', name: 'Band control passenger',
        occupation: 'merchant', locationId: from.id, onDay: 100, bornOnDay: 80 });
    world.npcs = [passenger]; world.objects = [];
    const quote = quotePublicCarriage(world, { fromId: from.id, toId: to.id, day: 100,
        conveyanceId: 'conv-carriage-mortal', passengerIds: [passenger.id], fareStones: 12, hired: true });
    expect(quote).not.toBeNull();
    const receipt = commitPublicCarriage(world, quote!);
    expect(receipt).not.toBeNull();
    const actual = publicCarriagePassage(world, receipt!.id, passenger.id, 100)!;
    expect(actual).not.toBeNull(); expect(actual.driver.status).toBe('alive');
    expect(actual.driver.activity?.vesselId).toBe(actual.vehicle.id);
    expect(actual.locationId).toBe(from.id);
    return { actual, from, passenger };
}

describe('a real carriage driver and a selected native human band', () => {
    for (const seed of ['booth-0', 'hire-37']) it('reads the native human count against the actual driver: ' + seed, () => {
        const { actual, from, passenger } = acceptedCarriage();
        const place: EncounterPlace = { id: from.id, name: from.name, kind: from.kind, substrate: 'land' };
        const entry = getEncounter('enc-roadside-bandits')!;
        expect(encounterPool({ ordinal: 0, activity: 'travel', place }).some(row => row.entry === entry && row.weight > 0)).toBe(true);
        expect(entry.kind).toBe('bandits'); expect(entry.tags).not.toContain('beast');
        const cast = [{ id: actual.driver.id, name: actual.driver.name,
            realmOrdinal: actual.driver.cultivation.realmOrdinal, known: true }];
        const filled = fillTokens({ entry, ordinal: 0, place, cast, names: {}, absoluteDay: 100,
            threatGap: entry.threatOrdinal! - 0,
            rng: forStream(seed, 'enc.fill', 100, entry.id, passenger.id), spoken: true });
        const occurrence = resolveOccurrence({ entry, activity: 'travel', ordinal: 0, maxHp: 30,
            hp: 30, spiritStones: 40, absoluteDay: 100, dayOffset: 0, ...filled, cast, outcome: 'landed' });
        expect(occurrence.castIds).toEqual(filled.castIds);
        expect(occurrence.confrontation?.count).toBe(filled.values.count);
        expect(occurrence.confrontation?.count).toBeGreaterThanOrEqual(2);
        expect(occurrence.confrontation?.count).toBeLessThanOrEqual(9);
        expect(occurrence.deltas).toEqual({ hp: 0, spiritStones: 0, satiety: 0, rations: 0 });
        const roll: EncounterRoll = { occurrences: [occurrence], checks: 1, poolSize: 1,
            firstInterruptDay: occurrence.absoluteDay };
        // Same source crew selection as paidCarrierSource: one real accepted driver.
        const crew = [actual.driver];
        const met = whatTheEscortMet(roll, crew.length);
        const count = occurrence.confrontation!.count;
        console.log(JSON.stringify({ nativeHumanBandSeed: seed, count, actualDriver: actual.driver.id,
            castIds: occurrence.castIds, withdrew: met.withdrew.length, attacking: met.attacking?.entryId ?? null }));
        if (count <= 2) {
            expect(met.withdrew).toEqual([occurrence]); expect(met.attacking).toBeNull();
            expect(met.roll.occurrences).toEqual([]); expect(met.roll.firstInterruptDay).toBeNull();
        } else {
            expect(met.withdrew).toEqual([]); expect(met.attacking?.entryId).toBe(entry.id);
            expect(met.attacking?.confrontation?.count).toBe(count);
            expect(met.roll.firstInterruptDay).toBe(100);
        }
        // Going without the driver never becomes an escorted withdrawal.
        expect(whatTheEscortMet(roll, 0).attacking?.entryId).toBe(entry.id);
        // The escort decision is a read, not a casualty/arrival/receipt mutation.
        expect(actual.driver.status).toBe('alive'); expect(actual.locationId).toBe(from.id);
        expect(actual.receipt.data.arrivalDay).toBe(actual.leg.arrivalDay);
    });
});
