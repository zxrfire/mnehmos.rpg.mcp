/**
 * Supplied census: capitals/cities held 44/1,019 people at opening, 11 at ten
 * years, while sect grounds held 484 then 410. Posts chose towns in map order;
 * no city calendar sent delegations. The century measurement lives in
 * capital-missions-census.json; the routine acceptance walk shares demography's
 * canonical 0/10-year world and pins presence, diversity, residence and relief.
 * In the physical ten-year walk, Silver Island had 28 dated dispatches from
 * ten houses and Emerald Water City had 357. A flat 50-dispatch cutoff did
 * not describe both markets; repeated business and calendar sendings across
 * years accompany the exact presence band at each endpoint.
 * A mission's destination remains in its activity while its actual position
 * passes through the same road and city placement the player sees.
 * Crossing water requires a house craft or paid public berths in both
 * directions. Goods stay with the carrier until they reach the exchange.
 * A persistent public-route result was keyed by location count and change-row
 * count. Repricing an existing road changed neither, leaving a later journey
 * bound for the old dock. The dock test keeps the first passage unaffordable,
 * changes two roads in place, then checks the funded journey's actual first leg.
 * Paid departures include the actual room-to-dock walk. The public mission case
 * starts its selected members in lodging and keeps them there until that walk ends.
 * The former owned-hull case allowed ordinal-14 passengers to fly a spirit boat
 * without a pilot or an air receipt. Actual house flight is covered by the shuttle
 * controls; this file keeps the refusal and moves its cargo/fare/arrival checks
 * onto the admitted public mission. Capital travel has one actual itinerary.
 */
import { describe, expect, it } from 'vitest';
import { soakedWorld } from '../../support/soaked-world.js';
import { capitalPlaces } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { PROVINCIAL_CAPITALS } from '../../../src/data/cultivation/regions.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';

/** Native journey controls moved unchanged to capital-mission-journeys.test.ts.
 * This source-hash cached decade census remains excluded by the owner. */
describe('capital missions', () => {
    it('keeps every capital occupied by residents and several visiting houses over a decade', async () => {
        const opened = await soakedWorld('demography', { years: 0 });
        const lived = await soakedWorld('demography', { years: 10 });
        for (const state of [opened, lived]) {
            const alive = state.npcs.filter(n => n.status === 'alive');
            const placeOf = new Map(alive.map(n => [n.id,
                locationOnNpcJourney(state.locations, n, state.currentDay)]));
            const cities = capitalPlaces(state);
            expect(cities.map(c => c.name)).toEqual(expect.arrayContaining(Object.values(PROVINCIAL_CAPITALS)));
            const cityIds = new Set(cities.map(c => c.id));
            const seats = new Set(state.locations.filter(l => l.kind === 'sect_seat').map(l => l.id));
            const grounds = alive.filter(n => seats.has(placeOf.get(n.id) ?? ''));
            const members = alive.filter(n => n.factionId && state.factions.some(h => h.id === n.factionId && h.dissolvedOnDay === null));
            const home = members.filter(n => state.factions.find(h => h.id === n.factionId)?.seatLocationId === placeOf.get(n.id));
            expect(home.length / members.length, 'most members remain at home').toBeGreaterThan(0.5);
            expect(grounds.length, 'sect grounds remain the most populous group').toBeGreaterThan(
                alive.filter(n => cityIds.has(placeOf.get(n.id) ?? '')).length);

            for (const city of cities) {
                const present = alive.filter(n => placeOf.get(n.id) === city.id);
                expect(present.length, `${city.name}: people present`).toBeGreaterThanOrEqual(20);
                expect(present.length, `${city.name}: people present`).toBeLessThanOrEqual(80);
                expect(present.some(n => !n.factionId && n.cultivation.realmOrdinal < FOUNDATION_ORDINAL),
                    `${city.name}: own mortal residents`).toBe(true);
                const visitingHouses = new Set(present.filter(n => n.factionId &&
                    (n.activity?.kind === 'stationed' || n.activity?.kind === 'out_with_a_party'))
                    .map(n => n.factionId));
                expect(visitingHouses.size, `${city.name}: visiting houses`).toBeGreaterThanOrEqual(3);
                if (state === lived) {
                    const dispatches = state.history.facts.filter(f => f.data.destinationId === city.id &&
                        f.data.capitalMission === true && f.day >= opened.currentDay);
                    expect(new Set(dispatches.flatMap(f => f.factionIds)).size,
                        `${city.name}: houses sending missions`).toBeGreaterThanOrEqual(3);
                    const businessYears = new Set(dispatches.filter(f =>
                        ['trade and purchases', 'carrying the house report', 'escorting the house envoy']
                            .includes(String(f.data.reason)))
                        .map(f => Math.floor((f.day - opened.currentDay) / 365)));
                    const occasionYears = new Set(dispatches.filter(f =>
                        f.data.reason === 'the auction delegation' || f.data.reason === 'the inter-house competition')
                        .map(f => Math.floor((f.day - opened.currentDay) / 365)));
                    expect(businessYears.size, `${city.name}: business sent in separate years`).toBeGreaterThanOrEqual(2);
                    expect(occasionYears.size, `${city.name}: calendar delegations sent in separate years`).toBeGreaterThanOrEqual(2);
                }
            }
        }
    }, 900_000);
});
