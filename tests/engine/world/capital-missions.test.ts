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
 * Both original horizons use canonical demography soakedWorld snapshots.
 * The focused factor scenario uses isAnActualCapitalFactor; reachability
 * samples demography at 10/100 and drift-guard at 100, and the contract sends
 * a real factor through that same offer scenario. No claim rewalks a century.
 * Each unchanged snapshot shares its route read for physical census placement.
 * Completed business dockets are swept after a year. The original/current-source
 * demography control observed business in 8-10 years per capital over a decade,
 * while both final ledgers retained only year nine's business. Count actual
 * dispatches at native world boundaries before that sweep; the original two-year
 * and three-house minima remain. This observer owns its short decade walk,
 * while all aged reachability and contract instances remain source-keyed samples.
 * Owner correction: the former majority-home assertion was the coordinator's
 * wording. Actual business may take many members away; an absence without an
 * activity is wrong. The full decade census checks every checkpoint's reasons.
 */
import { describe, expect, it } from 'vitest';
import { capitalDispatchesDuring } from '../../support/capital-dispatch-window.js';
import { sampledWorld } from '../../support/sampled-world.js';
import { capitalPlaces } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { PROVINCIAL_CAPITALS } from '../../../src/data/cultivation/regions.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';
import { routeQueriesFor } from '../../../src/engine/world/locations.js';
import { exteriorGroundOfDeparture } from '../../../src/engine/world/departure-approach.js';
import { isAnActualCapitalFactor } from '../../support/capital-precondition.js';
import { anActualCapitalFactorOffersItsCargo } from '../../support/capital-scenario.js';

/** Native journey controls moved unchanged to capital-mission-journeys.test.ts.
 * The cached decade census keeps its original assertions and canonical seed. */
describe('capital missions', () => {
    // Presence/diversity bands below remain the original acceptance. This
    // sampled reachability/contract pair connects them to the focused counter
    // scenario in a-capital-factor-offers-its-actual-cargo.test.ts.
    const samples = [['demography', 10], ['demography', 100], ['drift-guard', 100]] as const;
    it('finds real physically working visiting factors across cached ages and seeds', async () => {
        let reached = false;
        for (const [seed, years] of samples) {
            const state = await sampledWorld(seed, { years });
            reached ||= state.npcs.some(person => !!person.locationId && isAnActualCapitalFactor(state, person.id, person.locationId));
        }
        expect(reached).toBe(true);
    }, 3_600_000);

    it('passes a real visiting factor into the same focused offer scenario', async () => {
        for (const [seed, years] of samples) {
            const state = await sampledWorld(seed, { years });
            const factor = state.npcs.find(person => !!person.locationId && isAnActualCapitalFactor(state, person.id, person.locationId));
            if (!factor) continue;
            anActualCapitalFactorOffersItsCargo(state, factor.id, factor.locationId!);
            return;
        }
        throw new Error('No reachable actual capital factor');
    }, 120_000);

    it('keeps every capital occupied by residents and several visiting houses over a decade', async () => {
        const opened = await sampledWorld('demography', { years: 0 });
        const lived = await sampledWorld('demography', { years: 10 });
        const sentDuringDecade = capitalDispatchesDuring(await sampledWorld('demography', { years: 0 }), 10 * 365);
        for (const state of [opened, lived]) {
            const alive = state.npcs.filter(n => n.status === 'alive');
            const routes = routeQueriesFor(state.locations);
            const placeOf = new Map(alive.map(n => [n.id,
                locationOnNpcJourney(state.locations, n, state.currentDay, routes)]));
            const cities = capitalPlaces(state);
            expect(cities.map(c => c.name)).toEqual(expect.arrayContaining(Object.values(PROVINCIAL_CAPITALS)));
            const cityIds = new Set(cities.map(c => c.id));
            const seats = new Set(state.locations.filter(l => l.kind === 'sect_seat').map(l => l.id));
            const grounds = alive.filter(n => seats.has(placeOf.get(n.id) ?? ''));
            const members = alive.filter(n => n.factionId && state.factions.some(h => h.id === n.factionId && h.dissolvedOnDay === null));
            const awayWithoutAReason = members.filter(n =>
                state.factions.find(h => h.id === n.factionId)?.seatLocationId !==
                    exteriorGroundOfDeparture(state, placeOf.get(n.id)!, routes.places)?.id && !n.activity);
            expect(awayWithoutAReason, 'no member is stranded away without an activity').toEqual([]);
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
                    const dispatches = sentDuringDecade.filter(f => f.data.destinationId === city.id &&
                        f.data.capitalMission === true && f.day >= opened.currentDay);
                    expect(new Set(dispatches.flatMap(f => f.factionIds)).size,
                        `${city.name}: houses sending missions`).toBeGreaterThanOrEqual(3);
                    const businessYears = new Set(dispatches.filter(f =>
                        ['trade and purchases', 'carrying the house report', 'escorting the house envoy']
                            .includes(String(f.data.reason)))
                        .map(f => Math.floor((f.day - opened.currentDay) / 365)));
                    const occasionYears = new Set(dispatches.filter(f =>
                        ['the auction delegation', 'witnessing the auction', 'the inter-house competition'].includes(String(f.data.reason)))
                        .map(f => Math.floor((f.day - opened.currentDay) / 365)));
                    expect(businessYears.size, `${city.name}: business sent in separate years`).toBeGreaterThanOrEqual(2);
                    expect(occasionYears.size, `${city.name}: calendar delegations sent in separate years`).toBeGreaterThanOrEqual(2);
                }
            }
        }
    }, 1_800_000);
});
