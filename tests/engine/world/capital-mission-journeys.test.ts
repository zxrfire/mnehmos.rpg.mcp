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
 * Cinnabar's exported-medicine fixtures include its actual alchemy hall under
 * the conditional-crafts ruling; passage payment does not establish a workshop.
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
 * Free members in lodging were excluded from delegation selection even though
 * the room belongs to the grounds. Selection reads containment; departure walks.
 * A direct pressure year selected somebody still carrying an expired departure
 * note from an earlier mission. A new paid intention begins its own real walk;
 * only the same binding can continue a previous walk.
 * A loaded consignment is offered at its intended exchange, never in lodging
 * while its carrier is still walking to the departure point.
 * The year30 demography census found a recruit stranded at Silver Island:
 * house purse0, personal purse21, fare24, and her actual recruiter held35.
 * Admission can use a member's own fare or that recruiter's sponsorship at
 * the same place. Neither payment invents money or grants a water route.
 */
import { LOCAL_WALK_DAYS } from '../../../src/engine/world/local-walking-cost.js';
import { describe, expect, it } from 'vitest';

import { advancePublicCapitalMission, journeySelectedToHouseSeat,
    sendCapitalDelegations } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { createWorld, makeFaction, npcsAt } from '../../../src/engine/world/world-state.js';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc, setRealm, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { applyPostings } from '../../../src/engine/world/the-world-changing-on-its-own.js';
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
import { meritWith, whatServiceIsWorth } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { theyOweTheHouseAReport } from '../../../src/engine/world/a-house-expects-somebody-it-took-on.js';

/** Walked controls concern people in the actual player's party. */
function foreground(state: ReturnType<typeof createWorld>): void {
    const player = createNpc(state.seed, { id: 'player', locationId: null,
        onDay: state.currentDay, bornOnDay: state.currentDay - 20 * 365 });
    player.tags.push(PLAYER_ROW_TAG);
    player.activity = { kind: 'idle', note: 'With the selected people.',
        withIds: state.npcs.map(person => person.id), sinceDay: state.currentDay, untilDay: null };
    state.npcs.push(player);
}

/** Bounded journey controls are separate from the excluded decade census. */
describe('capital missions', () => {
    it('a selected member already in a house room needs no geographic pickup',()=>{
        const state=createWorld({seed:'selected-member-already-home',skipPriorAges:true,regionCount:0});
        const seat=makeLocation({id:'home',name:'The grounds',kind:'sect_seat'});
        const room=makeLocation({id:'home-room',name:'The lodging',kind:'chamber',parentId:seat.id,tags:['interior']});
        state.locations.push(seat,room);
        const house=makeFaction({id:'home-house',name:'The house',seatLocationId:seat.id,resources:{spirit_stones:100}});
        state.factions.push(house);
        const member=createNpc(state.seed,{id:'selected-at-home',locationId:room.id,onDay:state.currentDay,
            bornOnDay:state.currentDay-20*365});
        state.npcs.push(member);
        const selected=journeySelectedToHouseSeat(state,house,member,state.currentDay);
        expect(selected?.locationId).toBe(room.id);
        expect(selected?.activity).toBeNull();
        expect(house.resources.spirit_stones).toBe(100);
        expect(state.history.facts).toHaveLength(0);
    });
    it('a newly paid mission starts its own walk after an earlier intention expired',()=>{
        const state=createWorld({seed:'new-departure-intention',skipPriorAges:true,regionCount:0});
        const from=makeLocation({id:'old-seat',name:'Cloud Pine grounds',kind:'sect_seat'});
        const room=makeLocation({id:'old-lodging',name:'The dwelling',kind:'chamber',parentId:from.id,tags:['interior']});
        const to=makeLocation({id:'new-seat',name:'Jade Reed grounds',kind:'sect_seat'});
        linkLocations(from,to,'road',3);state.locations.push(from,room,to);
        const day=state.currentDay;
        const house=makeFaction({id:'receiving-house',name:'Jade Reed House',seatLocationId:to.id,resources:{spirit_stones:100}});
        state.factions.push(house);
        const member=createNpc(state.seed,{id:'selected-traveller',locationId:from.id,onDay:day,bornOnDay:day-20*365});
        member.activity={kind:'travelling',note:'Walking to the departure point.',withIds:[],
            capitalMissionId:'earlier-intention',standingIn:room.id,fromLocationId:from.id,returnTo:from.id,
            sinceDay:day-1,untilDay:day-.75};state.npcs.push(member);
        foreground(state);
        const selected=journeySelectedToHouseSeat(state,house,member,day);
        expect(selected?.activity?.capitalMissionId).not.toBe('earlier-intention');
        expect(selected?.activity?.sinceDay).toBe(day);
        expect(selected?.activity?.untilDay).toBe(day+LOCAL_WALK_DAYS);
        expect(selected?.activity?.standingIn).toBe(room.id);
        expect(selected?.locationId).toBe(from.id);
    });
    it('a parked house hull supplies neither a captain nor an admitted route for a delegation', () => {
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
        state.locations.push(seat, water, city, makeLocation({ id: 'alchemy', name: 'Alchemy Hall',
            kind: 'hall', parentId: seat.id, data: { factionId: houseRow.id, purpose: 'alchemy_hall' } }));
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
        expect(state.npcs.some(n => n.activity?.capitalMissionId)).toBe(false);
        expect(state.objects.some(o => o.tags.includes('exchange'))).toBe(false);
        expect(state.factions.find(h => h.id === houseRow.id)!.resources.spirit_stones).toBe(1_000_000);
        expect(state.history.facts.some(f => f.data.airCourse === true || f.data.publicPassage === true)).toBe(false);
        expect(state.objects.find(o => o.id === 'house-hull')!.possessorId).toBeNull();
        expect(state.objects.find(o => o.id === 'house-hull')!.locationId).toBe(seat.id);
        linkLocations(seat,city,'road',2);
        sendCapitalDelegations(state,occasion);
        const mission=state.history.facts.find(fact=>fact.data.capitalMission===true)!;
        expect(mission,'an actual connected road admits the same delegation').toBeTruthy();
        expect(mission.data.publicFareStones).toBe(0);
        const factorId=mission.actors[0]!.id;
        expect(locationOnNpcJourney(state.locations,state.npcs.find(person=>person.id===factorId)!,0)).toBe(seat.id);
        state.currentDay=2;advancePublicCapitalMission(state,factorId,2);
        const served=state.npcs.find(person=>person.id===factorId)!;
        expect(served.locationId).toBe(city.id);expect(served.activity?.kind).toBe('out_with_a_party');
        expect(exchangeOffers(state,served).length).toBeGreaterThan(0);
        state.currentDay=served.activity!.untilDay!;advancePublicCapitalMission(state,factorId,state.currentDay);
        const home=state.npcs.find(person=>person.id===factorId)!;
        expect(locationOnNpcJourney(state.locations,home,state.currentDay)).toBe(city.id);
        state.currentDay=home.activity!.untilDay!;advancePublicCapitalMission(state,factorId,state.currentDay);
        expect(locationOnNpcJourney(state.locations,state.npcs.find(person=>person.id===factorId)!,state.currentDay)).toBe(seat.id);
        expect(state.history.facts.some(fact=>fact.data.airCourse===true||fact.data.publicPassage===true)).toBe(false);
        expect(state.objects.find(object=>object.id==='house-hull')!.locationId).toBe(seat.id);
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
        const lodging = makeLocation({id: 'delegates-lodging', name: 'The lodging', kind: 'chamber',
            parentId: seat.id, tags: ['interior']});
        linkLocations(seat, water, 'crossing', 10);
        linkLocations(water, island, 'crossing', 11);
        state.locations.push(seat, water, island, lodging, makeLocation({ id: 'alchemy', name: 'Alchemy Hall',
            kind: 'hall', parentId: seat.id, data: { factionId: houseRow.id, purpose: 'alchemy_hall' } }));
        state.factions.push(makeFaction({ id: houseRow.id, name: houseRow.name, seatLocationId: seat.id,
            ranks: ['servant', 'disciple', 'elder', 'head'], resources: { spirit_stones: 1_000_000 } }));
        for (let i = 0; i < 8; i++) state.npcs.push({ ...setRealm(createNpc(state.seed,
            { id: `public-member-${i}`, locationId: lodging.id, onDay: 0, bornOnDay: -30 * 365 }), 14, 0),
            factionId: houseRow.id, factionRankIndex: 1 });
        foreground(state);
        sendCapitalDelegations(state, occasion);
        const mission = state.history.facts.find(f => f.data.publicMission === true)!;
        expect(mission, 'the house can dispatch without owning a hull').toBeTruthy();
        expect(mission.data.publicFareStones).toBeGreaterThan(0);
        const factorId = mission.actors[0]!.id;
        expect(state.npcs.find(n => n.id === factorId)!.spiritStones).toBe(0);
        const assembling = state.npcs.find(n => n.id === factorId)!;
        expect(assembling.locationId).toBe(lodging.id);
        expect(assembling.activity?.note).toBe('Walking to the departure point.');
        const stock = state.objects.filter(o => o.tags.includes('exchange'));
        expect(stock.length).toBeGreaterThan(0);
        expect(stock.every(o => o.locationId === locationOnNpcJourney(state.locations, assembling, state.currentDay)
            && o.possessorId && o.ownerId === houseRow.id)).toBe(true);
        const goodsCost = stock.reduce((sum, object) => {
            const material = typeof object.data.materialId === 'string'
                ? whatAnIngredientIs(object.data.materialId) : null;
            const pill = typeof object.data.pillId === 'string' ? getPill(object.data.pillId) : undefined;
            return sum + (material?.value ?? (pill ? pillCashPrice(pill) ?? 0 : 0));
        }, 0);
        expect(state.factions.find(house => house.id === houseRow.id)!.resources.spirit_stones)
            .toBe(1_000_000 - goodsCost - Number(mission.data.publicFareStones));
        expect(exchangeOffers(state, assembling)).toEqual([]);
        const reserved = JSON.parse(String(mission.data.publicReservations)) as {departureDay: number}[];
        expect(reserved[0]!.departureDay).toBeGreaterThanOrEqual(assembling.activity!.untilDay!);
        const blocked=structuredClone(state);
        blocked.locations.find(place=>place.id===lodging.id)!.sealed=true;
        blocked.currentDay=assembling.activity!.untilDay!;
        const purse=blocked.factions.find(house=>house.id===houseRow.id)!.resources.spirit_stones;
        expect(()=>advancePublicCapitalMission(blocked,factorId,blocked.currentDay)).not.toThrow();
        expect(blocked.npcs.find(person=>person.id===factorId)!.locationId).toBe(lodging.id);
        expect(blocked.npcs.find(person=>person.id===factorId)!.activity?.vesselId).toBeUndefined();
        expect(blocked.factions.find(house=>house.id===houseRow.id)!.resources.spirit_stones).toBe(purse);
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
            if (now.locationId === island.id && now.activity?.kind === 'out_with_a_party')
                expect(exchangeOffers(state, now).length).toBeGreaterThan(0);
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
        selected.spiritStones = 0;
        foreground(state);
        expect(journeySelectedToHouseSeat(state, receiver, selected, 0),
            'the route can be found, but neither the house nor its member can pay').toBeNull();
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

    it('a member pays the ordinary passage home when their house cannot sponsor it', () => {
        const state = createWorld({seed:'personal-admission-fare',skipPriorAges:true,regionCount:0});
        const dock = makeLocation({id:'dock',name:PLACE.CLOUD_GATE,kind:'settlement'});
        const home = makeLocation({id:'home',name:PLACE.SWEETSPRING_ISLE,kind:'sect_seat'});
        state.locations.push(dock,home);
        const house = makeFaction({id:'house',name:'Receiving House',seatLocationId:home.id,
            resources:{spirit_stones:0}});
        state.factions.push(house);
        const member = createNpc(state.seed,{id:'member',locationId:dock.id,onDay:0,bornOnDay:-20*365});
        member.factionId=house.id;member.spiritStones=1_000_000;member.activity=null;state.npcs.push(member);
        const travelling=journeySelectedToHouseSeat(state,house,member,0)!;
        expect(travelling.activity?.capitalMissionId).toBeTruthy();
        const receipt=state.history.facts.find(fact=>fact.id===travelling.activity!.capitalMissionId)!;
        const fare=Number(receipt.data.publicFareStones);
        expect(fare).toBeGreaterThan(0);
        expect(travelling.spiritStones).toBe(1_000_000-fare);
        expect(house.resources.spirit_stones).toBe(0);
        expect(receipt.data.publicPayerId).toBe(member.id);
        advancePublicCapitalMission(state,member.id,Number(receipt.data.plannedArrivalDay));
        expect(state.npcs[0]!.locationId).toBe(home.id);
        expect(state.npcs[0]!.spiritStones).toBe(travelling.spiritStones);
    });

    it('the actual recruiter at the dock sponsors a penniless recruit from their own purse', () => {
        const state=createWorld({seed:'recruiter-admission-fare',skipPriorAges:true,regionCount:0});
        const dock=makeLocation({id:'dock',name:PLACE.CLOUD_GATE,kind:'settlement'});
        const home=makeLocation({id:'home',name:PLACE.SWEETSPRING_ISLE,kind:'sect_seat'});
        state.locations.push(dock,home);
        const house=makeFaction({id:'house',name:'Receiving House',seatLocationId:home.id,resources:{spirit_stones:0}});
        state.factions.push(house);
        for(const id of ['member','recruiter']){
            const person=createNpc(state.seed,{id,locationId:dock.id,onDay:0,bornOnDay:-20*365});
            person.factionId=house.id;person.spiritStones=id==='recruiter'?1_000_000:0;person.activity=null;state.npcs.push(person);
        }
        theyOweTheHouseAReport(state,'recruiter',{houseId:house.id,person:{id:'member',name:state.npcs[0]!.name},
            placeId:dock.id,onDay:0});
        const travelling=journeySelectedToHouseSeat(state,house,state.npcs[0]!,0)!;
        expect(travelling.activity?.capitalMissionId).toBeTruthy();
        const receipt=state.history.facts.find(fact=>fact.id===travelling.activity!.capitalMissionId)!;
        expect(receipt.data.publicPayerId).toBe('recruiter');
        expect(state.npcs[1]!.spiritStones).toBe(1_000_000-Number(receipt.data.publicFareStones));
        expect(state.npcs[0]!.spiritStones).toBe(0);
        expect(house.resources.spirit_stones).toBe(0);
        advancePublicCapitalMission(state,'member',Number(receipt.data.plannedArrivalDay));
        expect(state.npcs[0]!.locationId).toBe(home.id);
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
        foreground(state);
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

});

