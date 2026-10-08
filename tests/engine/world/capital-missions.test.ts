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
 */
import { describe, expect, it } from 'vitest';
import { soakedWorld } from '../../support/soaked-world.js';
import { advancePublicCapitalMission, capitalPlaces, journeySelectedToHouseSeat,
    sendCapitalDelegations } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { createWorld, makeFaction, npcsAt } from '../../../src/engine/world/world-state.js';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { applyPostings } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { PROVINCIAL_CAPITALS } from '../../../src/data/cultivation/regions.js';
import { addPlacesOnTheWay, locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { exchangeOffers } from '../../../src/engine/world/wares-at-a-capital-exchange.js';
import { SEA_LANES } from '../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { PLACE } from '../../../src/data/cultivation/place-names.js';
import { SECTS } from '../../../src/data/cultivation/sects.js';
import { whatAnIngredientIs } from '../../../src/engine/cultivation/what-a-cauldron-will-take.js';
import { getPill } from '../../../src/data/cultivation/pills.js';
import { pillCashPrice } from '../../../src/engine/cultivation/buying-and-bartering-pills.js';
import { requireConveyance } from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { priceJourney } from '../../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { meritWith, whatServiceIsWorth } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';

describe('capital missions', () => {
    it('sends no goods over water without a craft and opens carried stock only on arrival', () => {
        const houseRow = SECTS.find(h => h.id === 'sect-cinnabar-crucible-sect')!;
        const occasion = { venueId: 'city', hostId: houseRow.id, kind: 'auction' as const,
            opensOnDay: 0, onDay: 20, endsOnDay: 27 };
        const seed = Array.from({ length: 100 }, (_, i) => `sea-capital-${i}`).find(candidate =>
            forStream(candidate, 'capital-delegation', occasion.venueId, occasion.kind,
                occasion.onDay, houseRow.id).chance(0.75))!;
        const state = createWorld({ seed, skipPriorAges: true, regionCount: 0 });
        const seat = makeLocation({ id: 'seat', name: 'Grounds', kind: 'sect_seat' });
        const water = makeLocation({ id: 'water', name: SEA_LANES.find(l => l.water)!.water!, kind: 'region' });
        const city = makeLocation({ id: 'city', name: 'City', kind: 'settlement', tags: ['city'] });
        linkLocations(seat, water, 'crossing', 4);
        linkLocations(water, city, 'crossing', 4);
        state.locations.push(seat, water, city);
        state.factions.push(makeFaction({ id: houseRow.id, name: houseRow.name, seatLocationId: seat.id,
            ranks: ['servant', 'disciple', 'elder', 'head'], resources: { spirit_stones: 1_000_000 } }));
        for (let i = 0; i < 8; i++) state.npcs.push({ ...setRealm(createNpc(state.seed,
            { id: `sea-member-${i}`, locationId: seat.id, onDay: 0, bornOnDay: -30 * 365 }), 14, 0),
            factionId: houseRow.id, factionRankIndex: 1 });
        const withoutCraft = structuredClone(state);
        sendCapitalDelegations(withoutCraft, occasion);
        expect(withoutCraft.history.facts.some(f => f.data.capitalMission === true)).toBe(false);
        expect(withoutCraft.objects.some(o => o.tags.includes('exchange'))).toBe(false);
        expect(withoutCraft.factions.find(h => h.id === houseRow.id)!.resources.spirit_stones).toBe(1_000_000);

        state.objects.push(makeObject({ id: 'house-hull', name: 'House hull', kind: 'artifact',
            ownerId: houseRow.id, ownerName: houseRow.name, locationId: seat.id,
            power: 30, data: { conveyanceId: 'conv-spirit-boat' } }));
        sendCapitalDelegations(state, occasion);
        const delegate = state.npcs.find(n => n.activity?.kind === 'out_with_a_party')!;
        expect(delegate, 'an owned craft makes the sending feasible').toBeTruthy();
        expect(delegate.activity?.conveyanceId).toBe('conv-spirit-boat');
        const stock = state.objects.filter(o => o.tags.includes('exchange'));
        expect(stock.length).toBeGreaterThan(0);
        expect(stock.every(o => o.locationId === seat.id && o.possessorId)).toBe(true);
        const goodsCost = stock.reduce((sum, object) => {
            const material = typeof object.data.materialId === 'string'
                ? whatAnIngredientIs(object.data.materialId) : null;
            const pill = typeof object.data.pillId === 'string' ? getPill(object.data.pillId) : undefined;
            return sum + (material?.value ?? (pill ? pillCashPrice(pill) ?? 0 : 0));
        }, 0);
        const heads = state.npcs.filter(n => n.activity?.kind === 'out_with_a_party').length;
        const quote = priceJourney({ walkingDays: 8, conveyance: requireConveyance('conv-spirit-boat'),
            power: 30, heads, crossesGroundThatCannotBeWalked: true });
        expect(state.factions.find(h => h.id === houseRow.id)!.resources.spirit_stones)
            .toBe(1_000_000 - goodsCost - 2 * quote.stonesBurned);
        expect(exchangeOffers(state, delegate)).toEqual([]);
        state.currentDay = 20;
        expect(locationOnNpcJourney(state.locations, delegate, 20)).toBe(city.id);
        expect(exchangeOffers(state, delegate).length).toBeGreaterThan(0);
    });

    it('places an actual dispatched hand on the road, at the city, then home', () => {
        const state = createWorld({ seed: 'capital-passage', skipPriorAges: true, regionCount: 0 });
        const seat = makeLocation({ id: 'seat', name: 'Grounds', kind: 'sect_seat' });
        const city = makeLocation({ id: 'city', name: 'City', kind: 'settlement', tags: ['city'] });
        linkLocations(seat, city, 'road', 10);
        state.locations.push(seat, city);
        addPlacesOnTheWay(state.locations);
        state.npcs.push({ ...createNpc(state.seed, { id: 'delegate', locationId: city.id,
            onDay: 0, bornOnDay: -30 * 365 }), activity: { kind: 'out_with_a_party',
            note: 'On house business at City.', withIds: [], fromLocationId: seat.id,
            sinceDay: 0, untilDay: 40, returnTo: seat.id } });
        const stop = state.locations.find(l => l.tags.includes('route-stop')
            && l.links.some(edge => edge.toLocationId === seat.id)
            && l.links.some(edge => edge.toLocationId === city.id))!;
        for (const [day, place] of [[0, seat], [5, stop], [10, city], [30, city], [35, stop], [40, seat]] as const) {
            state.currentDay = day;
            expect(npcsAt(state, place.id).map(n => n.id), `day ${day} at ${place.name}`).toContain('delegate');
            if (place.id !== city.id) expect(npcsAt(state, city.id)).toEqual([]);
        }
    });

    it('buys public berths for a water mission and returns its factor after service', () => {
        const houseRow = SECTS.find(h => h.id === 'sect-cinnabar-crucible-sect')!;
        const occasion = { venueId: 'island', hostId: houseRow.id, kind: 'auction' as const,
            opensOnDay: 100, onDay: 200, endsOnDay: 207 };
        const seed = Array.from({ length: 100 }, (_, i) => `public-capital-${i}`).find(candidate =>
            forStream(candidate, 'capital-delegation', occasion.venueId, occasion.kind,
                occasion.onDay, houseRow.id).chance(0.2))!;
        const state = createWorld({ seed, skipPriorAges: true, regionCount: 0 });
        const seat = makeLocation({ id: 'seat', name: PLACE.CLOUD_GATE, kind: 'sect_seat' });
        const water = makeLocation({ id: 'water', name: SEA_LANES[0]!.water!, kind: 'region' });
        const island = makeLocation({ id: 'island', name: PLACE.SWEETSPRING_ISLE,
            kind: 'settlement', tags: ['city'] });
        linkLocations(seat, water, 'crossing', 10);
        linkLocations(water, island, 'crossing', 11);
        state.locations.push(seat, water, island);
        state.factions.push(makeFaction({ id: houseRow.id, name: houseRow.name, seatLocationId: seat.id,
            ranks: ['servant', 'disciple', 'elder', 'head'], resources: { spirit_stones: 1_000_000 } }));
        for (let i = 0; i < 8; i++) state.npcs.push({ ...setRealm(createNpc(state.seed,
            { id: `public-member-${i}`, locationId: seat.id, onDay: 0, bornOnDay: -30 * 365 }), 14, 0),
            factionId: houseRow.id, factionRankIndex: 1 });
        sendCapitalDelegations(state, occasion);
        const mission = state.history.facts.find(f => f.data.publicMission === true)!;
        expect(mission, 'the house can dispatch without owning a hull').toBeTruthy();
        expect(mission.data.publicFareStones).toBeGreaterThan(0);
        const factorId = mission.actors[0]!.id;
        expect(state.npcs.find(n => n.id === factorId)!.spiritStones).toBe(0);
        let sawIsland = false;
        for (let leg = 0; leg < 8; leg++) {
            const factor = state.npcs.find(n => n.id === factorId)!;
            if (!factor.activity) break;
            const due = factor.activity.untilDay!;
            state.currentDay = due;
            advancePublicCapitalMission(state, factorId, due);
            const now = state.npcs.find(n => n.id === factorId)!;
            sawIsland ||= locationOnNpcJourney(state.locations, now, due) === island.id
                && now.activity?.kind === 'out_with_a_party';
        }
        const factor = state.npcs.find(n => n.id === factorId)!;
        expect(sawIsland, 'the factor works at the island exchange').toBe(true);
        expect(locationOnNpcJourney(state.locations, factor, state.currentDay)).toBe(seat.id);
        expect(state.history.facts.some(f => f.data.publicPassage === true)).toBe(true);

        const host = makeFaction({ id: 'receiving-house', name: 'Receiving House',
            seatLocationId: island.id, resources: { spirit_stones: 1_000_000 } });
        state.factions.push(host);
        const at = state.npcs.findIndex(n => n.id === factorId);
        state.npcs[at] = { ...factor, factionId: host.id, factionRankIndex: 0, activity: null };
        const selected = journeySelectedToHouseSeat(state, host, state.npcs[at]!, state.currentDay)!;
        expect(selected.activity?.capitalMissionId, 'the receiving house funds an actual route').toBeTruthy();
        expect(selected.spiritStones).toBe(factor.spiritStones);
        for (let leg = 0; leg < 8; leg++) {
            const traveller = state.npcs[at]!;
            if (!traveller.activity?.capitalMissionId) break;
            state.currentDay = traveller.activity.untilDay!;
            advancePublicCapitalMission(state, factorId, state.currentDay);
        }
        expect(locationOnNpcJourney(state.locations, state.npcs[at]!, state.currentDay)).toBe(island.id);
        expect(state.npcs[at]!.factionId).toBe(host.id);
    });

    it('takes the newly shorter dock when roads change between sponsored journeys', () => {
        const state = createWorld({ seed: 'changed-capital-road', skipPriorAges: true, regionCount: 0 });
        const grounds = makeLocation({ id: 'grounds', name: 'Grounds', kind: 'sect_seat' });
        const cloud = makeLocation({ id: 'cloud', name: PLACE.CLOUD_GATE, kind: 'settlement' });
        const emerald = makeLocation({ id: 'emerald', name: PLACE.GREEN_FALL, kind: 'settlement' });
        const island = makeLocation({ id: 'island', name: PLACE.SWEETSPRING_ISLE, kind: 'sect_seat' });
        linkLocations(grounds, cloud, 'road', 1);
        linkLocations(grounds, emerald, 'road', 100);
        state.locations.push(grounds, cloud, emerald, island);
        const receiver = makeFaction({ id: 'receiver', name: 'Receiving House', seatLocationId: island.id,
            resources: { spirit_stones: 0 } });
        state.factions.push(receiver);
        state.npcs.push(setRealm(createNpc(state.seed, { id: 'selected', name: 'Selected Hand',
            locationId: grounds.id, onDay: 0, bornOnDay: -30 * 365 }), 14, 0));
        const selected = state.npcs[0]!;
        expect(journeySelectedToHouseSeat(state, receiver, selected, 0),
            'the route can be found, but the house cannot yet pay its fare').toBeNull();
        expect(state.locations.every(place => place.changes.length === 0)).toBe(true);
        linkLocations(grounds, cloud, 'road', 100);
        linkLocations(grounds, emerald, 'road', 1);
        receiver.resources.spirit_stones = 1_000_000;
        const travelling = journeySelectedToHouseSeat(state, receiver, selected, 0);
        expect(travelling, 'the newly funded house can send the selected hand').toBeTruthy();
        expect(travelling!.activity?.kind).toBe('travelling');
        expect(travelling!.activity?.returnTo, 'the first leg reaches the newly nearer dock').toBe(emerald.id);
        expect(locationOnNpcJourney(state.locations, travelling!, 1)).toBe(emerald.id);
    });

    it('relieves a city posting before the member’s own grounds', () => {
        const state = createWorld({ seed: 'capital-return', skipPriorAges: true, regionCount: 0 });
        const province = makeLocation({ id: 'province', name: 'Province', kind: 'region' });
        const seat = makeLocation({ id: 'seat', name: 'Grounds', kind: 'sect_seat', parentId: 'province' });
        const city = makeLocation({ id: 'city', name: 'City', kind: 'settlement',
            parentId: 'province', tags: ['city'], data: { populationWeight: 60 } });
        linkLocations(seat, city, 'road', 2);
        state.locations.push(province, seat, city);
        addPlacesOnTheWay(state.locations);
        state.factions.push(makeFaction({ id: 'house', name: 'House', seatLocationId: 'seat',
            ranks: ['servant', 'disciple', 'elder', 'head'], resources: { power_ordinal: 7 } }));
        for (let i = 0; i < 8; i++) state.npcs.push({ ...setRealm(createNpc(state.seed,
            { id: `member-${i}`, locationId: 'seat', onDay: 0, bornOnDay: -30 * 365 }), 14, 0),
            factionId: 'house', factionRankIndex: 1 });
        applyPostings(state, 0, 0);
        const posted = state.npcs.find(n => n.activity?.kind === 'stationed')!;
        expect(posted, 'the house must actually send somebody').toBeTruthy();
        expect(posted.locationId).toBe('city');
        expect(posted.activity?.returnTo).toBe('seat');
        const meritBefore = meritWith(posted, 'house');
        state.objects.push(makeObject({ id: 'post-stock', name: 'Stored stock', kind: 'material',
            ownerId: 'house', ownerName: 'House', possessorId: posted.id,
            locationId: city.id, tags: ['exchange'] }));
        posted.activity!.untilDay = 5;
        const longSpan = structuredClone(state);
        advanceWorldForPlay(longSpan, { days: 10, pressure: { intensity: 0 }, stopOnInterrupt: false });
        expect(longSpan.history.facts.find(f => f.data.postRelief === true
            && f.data.outgoingId === posted.id)?.day).toBe(7);
        expect(longSpan.npcs.find(n => n.id === posted.id)?.activity).toBeNull();
        expect(longSpan.objects.find(o => o.id === 'post-stock')?.possessorId).toBeNull();
        advanceWorldForPlay(state, { days: 5, pressure: { intensity: 0 }, stopOnInterrupt: false });
        expect(state.history.facts.some(f => f.data.postRelief === true && f.data.outgoingId === posted.id),
            'a replacement on the road cannot relieve the post').toBe(false);
        const replacementOnTheRoad = state.npcs.find(n => n.id !== posted.id
            && n.activity?.kind === 'stationed' && n.locationId === city.id)!;
        expect(replacementOnTheRoad).toBeTruthy();
        expect(locationOnNpcJourney(state.locations, replacementOnTheRoad, 5)).toBe(seat.id);
        advanceWorldForPlay(state, { days: 2, pressure: { intensity: 0 }, stopOnInterrupt: false });
        const relief = state.history.facts.find(f => f.data.postRelief === true && f.data.outgoingId === posted.id)!;
        expect(relief, 'replacement has arrived before the old hand leaves').toBeTruthy();
        expect(relief.day).toBe(7);
        expect(relief.data.servedSinceDay).toBe(0);
        expect(relief.data.servedUntilDay).toBe(8);
        expect(state.npcs.find(n => n.id === posted.id)!.locationId).toBe('city');
        const replacement = state.npcs.find(n => n.id === relief.data.replacementId)!;
        expect(locationOnNpcJourney(state.locations, replacement, 7)).toBe(city.id);
        advanceWorldForPlay(state, { days: 1, pressure: { intensity: 0 }, stopOnInterrupt: false });
        const returningOnTheRoad = state.npcs.find(n => n.id === posted.id)!;
        expect(returningOnTheRoad.activity?.kind).toBe('travelling');
        expect(locationOnNpcJourney(state.locations, returningOnTheRoad, 8)).not.toBe(seat.id);
        expect(meritWith(returningOnTheRoad, 'house')).toBe(meritBefore);
        expect(state.objects.find(o => o.id === 'post-stock')?.possessorId).toBe(posted.id);
        advanceWorldForPlay(state, { days: 2, pressure: { intensity: 0 }, stopOnInterrupt: false });
        const returned = state.npcs.find(n => n.id === posted.id)!;
        expect(returned.locationId).toBe('seat');
        expect(returned.activity).toBeNull();
        expect(meritWith(returned, 'house') - meritBefore).toBe(Math.round(whatServiceIsWorth(14, 8)));
        expect(state.objects.find(o => o.id === 'post-stock')?.possessorId).toBeNull();
        advanceWorldForPlay(state, { days: 1, pressure: { intensity: 0 }, stopOnInterrupt: false });
        expect(meritWith(state.npcs.find(n => n.id === posted.id)!, 'house') - meritBefore)
            .toBe(Math.round(whatServiceIsWorth(14, 8)));
    });

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
