/** The integrated travel clock cost 2.2-2.9 seconds per full-catalog year.
 * Distant people must use actual route dates without walked station scenes or
 * speculative berth records. Meeting one realizes their current native hull,
 * keeps their paid fare and dates, and makes subsequent travel exact through
 * the existing player-area/party reader. No persistent foreground flag exists.
 * These controls use the same contact settlement called before company cards. */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations, walkingDaysFrom } from '../../../src/engine/world/locations.js';
import { bookNpcPassageForRoute, locationOnNpcJourney, addPlacesOnTheWay } from '../../../src/engine/world/places-on-the-way.js';
import { startNpcJourney } from '../../../src/engine/world/dao-ground-stints.js';
import { publicShipLinesFrom } from '../../../src/engine/world/public-shipping.js';
import { settlePracticeOnContact } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { nextWorldClockBoundary } from '../../../src/engine/world/world-clock-boundaries.js';
import { isPlayerInvolved } from '../../../src/engine/world/background-incident-draw.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { sendCapitalDelegations } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

function passage() {
    const world = createWorld({ seed: 'background-contact-passage', regionCount: 0, skipPriorAges: true });
    world.populationTarget = 0;
    const from = makeLocation({ id: 'port', name: 'Emerald Water City', kind: 'settlement' });
    const to = makeLocation({ id: 'island', name: 'Sweet Spring Island', kind: 'settlement' });
    world.locations.push(from, to);
    const person = { ...createNpc(world.seed, { id: 'traveller', locationId: from.id,
        onDay: world.currentDay, bornOnDay: world.currentDay - 20 * 365 }), spiritStones: 100 };
    world.npcs.push(person);
    const line = publicShipLinesFrom(world, from.name, world.currentDay).find(row => row.to === to.name)!;
    expect(line).toBeTruthy();
    const travelling = bookNpcPassageForRoute(world, person, to.id, world.currentDay, 'Taking the public passage.')!;
    expect(travelling).toBeTruthy();
    world.npcs[0] = travelling;
    return { world, from, to, person, travelling, line };
}

it('a distant passage has its real calendar, duration and fare without a scene or hull booking', () => {
    const h = passage(), doing = h.travelling.activity!;
    expect(doing.departureApproach).toBeUndefined();
    expect(doing.vesselId).toBeUndefined();
    expect(doing.seaLaneId).toBe(h.line.lane.id);
    expect(doing.sinceDay).toBe(h.line.runsFromDay ?? h.world.currentDay);
    expect(doing.untilDay! - doing.sinceDay).toBe(h.line.days);
    expect(h.travelling.spiritStones).toBeLessThan(h.person.spiritStones);
    expect(h.world.objects).toHaveLength(0);
    expect(h.world.history.facts).toHaveLength(0);
    expect(nextWorldClockBoundary(h.world, h.world.currentDay, doing.untilDay! + 1,
        [], { intensity: 0 }, 'transport')?.sourceId).not.toBe(h.person.id);
});

it('contact realizes the actual ship once without moving the person or charging again', () => {
    const h = passage(), doing = h.travelling.activity!;
    h.world.currentDay = (doing.sinceDay + doing.untilDay!) / 2;
    const ground = locationOnNpcJourney(h.world.locations, h.travelling, h.world.currentDay);
    expect(settlePracticeOnContact(h.world, new Set([h.person.id]))).toBe(true);
    const exact = h.world.npcs.find(person => person.id === h.person.id)!;
    expect(exact.activity?.vesselId).toBeTruthy();
    expect(h.world.objects.some(object => object.id === exact.activity?.vesselId)).toBe(true);
    expect(exact.spiritStones).toBe(h.travelling.spiritStones);
    expect(exact.activity?.sinceDay).toBe(doing.sinceDay);
    expect(exact.activity?.untilDay).toBe(doing.untilDay);
    expect(locationOnNpcJourney(h.world.locations, exact, h.world.currentDay)).toBe(ground);
    expect(h.world.history.facts.some(fact => fact.data.actualBoarding === true
        && fact.actors.some(actor => actor.id === h.person.id))).toBe(true);
    const facts = h.world.history.facts.length;
    expect(settlePracticeOnContact(h.world, new Set([h.person.id]))).toBe(false);
    expect(h.world.history.facts).toHaveLength(facts);
    const player = createNpc(h.world.seed, { id: 'player', locationId: null,
        onDay: h.world.currentDay, bornOnDay: -20 * 365 });
    player.tags.push(PLAYER_ROW_TAG);
    player.activity = { kind: 'idle', note: 'With the traveller.', withIds: [exact.id],
        sinceDay: h.world.currentDay, untilDay: null };
    h.world.npcs.push(player);
    expect(isPlayerInvolved(h.world, exact)).toBe(true);
    expect(nextWorldClockBoundary(h.world, h.world.currentDay, doing.untilDay! + 1,
        [], { intensity: 0 }, 'transport')?.onDay).toBe(doing.untilDay);
});

it('a background walker uses the real road and remains on intermediate ground until arrival', () => {
    const h = passage();
    h.world.npcs[0] = h.person;
    linkLocations(h.from, h.to, 'road', 4);
    addPlacesOnTheWay(h.world.locations);
    // This connected land destination has no public sea lane from the departure.
    h.to.name = 'Pine Bridge';
    const walking = startNpcJourney(h.world, h.person, h.to.id, h.world.currentDay, 'Walking the road.');
    h.world.npcs[0] = walking;
    expect(walking.activity?.departureApproach).toBeUndefined();
    expect(walking.activity?.untilDay! - walking.activity!.sinceDay)
        .toBe(walkingDaysFrom(h.world.locations, h.from.id).get(h.to.id));
    const middle = locationOnNpcJourney(h.world.locations, walking, h.world.currentDay + 2);
    expect(middle).not.toBe(h.from.id);
    expect(middle).not.toBe(h.to.id);
    advanceWorldForPlay(h.world, { days: 4, pressure: { intensity: 0 }, stopOnInterrupt: false });
    expect(h.world.npcs.find(person => person.id === h.person.id)?.locationId).toBe(h.to.id);
});

it('capital appointments cap distant resolutions while keeping an involved house exact', () => {
    const seed = Array.from({ length: 100 }, (_, n) => `bounded-capital-${n}`).find(candidate =>
        Array.from({ length: 10 }, (_, n) => forStream(candidate, 'capital-delegation', 'city', 'auction', 20,
            `house-${n}`).chance(0.75)).filter(Boolean).length >= 6
        && forStream(candidate, 'capital-delegation', 'city', 'auction', 20, 'house-0').chance(0.75))!;
    expect(seed).toBeTruthy();
    const world = createWorld({ seed, regionCount: 0, skipPriorAges: true });
    const city = makeLocation({ id: 'city', name: 'Pine Bridge', kind: 'settlement', tags: ['city'] });
    world.locations.push(city);
    for (let house = 0; house < 10; house++) {
        const seat = makeLocation({ id: `seat-${house}`, name: `House ${house} grounds`, kind: 'sect_seat' });
        linkLocations(seat, city, 'road', 2);
        world.locations.push(seat);
        const faction = makeFaction({ id: `house-${house}`, name: `House ${house}`, seatLocationId: seat.id,
            ranks: ['servant', 'disciple', 'elder', 'head'], resources: { spirit_stones: 1000 } });
        world.factions.push(faction);
        for (let n = 0; n < 8; n++) world.npcs.push({ ...createNpc(seed, { id: `member-${house}-${n}`,
            locationId: seat.id, onDay: 0, bornOnDay: -20 * 365 }), factionId: faction.id, factionRankIndex: 1 });
    }
    const foreground = structuredClone(world);
    const player = createNpc(seed, { id: 'player', locationId: null, onDay: 0, bornOnDay: -20 * 365 });
    player.tags.push(PLAYER_ROW_TAG);
    player.activity = { kind: 'idle', note: 'With the first house party.',
        withIds: foreground.npcs.filter(person => person.factionId === 'house-0').map(person => person.id),
        sinceDay: 0, untilDay: null };
    foreground.npcs.push(player);
    const occasion = { venueId: city.id, hostId: 'house-0', kind: 'auction' as const,
        opensOnDay: 0, onDay: 20, endsOnDay: 27 };
    sendCapitalDelegations(world, occasion);
    sendCapitalDelegations(foreground, occasion);
    const sent = (state: typeof world) => new Set(state.history.facts.filter(fact => fact.data.publicMission === true)
        .flatMap(fact => fact.factionIds));
    expect(sent(world).size).toBe(4);
    expect(sent(foreground).size).toBe(5);
    expect(sent(foreground).has('house-0')).toBe(true);
});
