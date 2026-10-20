/**
 * On town-a/town-b's 200-year walk, a lost member's already-started road home
 * never arrived: the return pass refused the same missing-house mark that
 * arrival must clear. Other lost errands must still remain unclosed.
 * A person who left the roll could also be re-admitted before the next issue
 * pass, retaining their old robes and never receiving an entry journey. Their
 * accessible issued holdings return at departure. Remote holdings stay with
 * their actual carrier as house property owed, while other members keep theirs.
 * These probes reach the ordinary pressure/absence paths directly.
 * Legacy ordinary journeys could also reach an island by their due date alone.
 * The return pass now checks the canonical road projection before settling:
 * an unwalkable crossing ends on real ground without pay or service credit,
 * while a booked hull or a craft that crosses water can still arrive.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, theWorldLoses } from '../../../src/engine/world/npc-state.js';
import { linkLocations, makeLocation, walkingDaysFrom } from '../../../src/engine/world/locations.js';
import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { whatHousesLearnOfTheirOwn } from '../../../src/engine/world/when-somebody-does-not-come-back.js';
import { isLostTrackOf, theHouseLosesTrackOf } from '../../../src/engine/world/who-a-house-has-lost-track-of.js';
import { aUniformFor } from '../../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { SEA_LANES } from '../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { CONVEYANCES } from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { shipIdForLane } from '../../../src/engine/world/the-ship-on-a-lane.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';

const DAY = 100 * 365;
function bench(seed: string) {
    const state = createWorld({ seed, skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations = [
        makeLocation({ id: 'seat', name: 'The Hall', kind: 'sect_seat' }),
        makeLocation({ id: 'hills', name: 'The Hills', kind: 'wilds' }),
        makeLocation({ id: 'elsewhere', name: 'Another Hill', kind: 'wilds' })
    ];
    state.factions = [makeFaction({ id: 'house', name: 'The House', seatLocationId: 'seat',
        foundedOnDay: 0, ranks: ['Outer', 'Inner'] })];
    state.npcs = [createNpc(seed, { id: 'lost', bornOnDay: DAY - 20 * 365, onDay: DAY,
        factionId: 'house', factionRankIndex: 1, locationId: 'hills' })];
    return state;
}

describe('a lost person can finish the road home', () => {
    it.each(['afoot', 'hull', 'craft'] as const)('closes a legacy water journey on feasible ground: %s', passage => {
        const state = bench('a-legacy-water-journey');
        const lane = SEA_LANES.find(one => one.water)!;
        const water = makeLocation({ id: 'water', name: lane.water!, kind: 'region' });
        const from = state.locations.find(place => place.id === 'hills')!;
        const to = state.locations.find(place => place.id === 'seat')!;
        linkLocations(from, water, 'crossing', 4);
        linkLocations(water, to, 'crossing', 4);
        state.locations.push(water);
        const craft = CONVEYANCES.find(one => one.crossesGroundThatCannotBeWalked && one.holding !== 'personal')!;
        expect(craft, 'the craft control must use an existing capable conveyance').toBeDefined();
        const before = { ...state.npcs[0]!, spiritStones: 100,
            merit: [{ houseId: 'house', points: 7 }] };
        state.npcs[0] = { ...before, activity: {
            kind: 'travelling', note: 'Taking the road home.', withIds: [],
            sinceDay: DAY, untilDay: DAY + 60, fromLocationId: from.id, returnTo: to.id,
            ...(passage === 'hull' ? { seaLaneId: lane.id, vesselId: shipIdForLane(lane) } : {}),
            ...(passage === 'craft' ? { conveyanceId: craft.id } : {})
        } };
        const expected = passage === 'afoot' ? from.id : to.id;
        expect(locationOnNpcJourney(state.locations, state.npcs[0]!, DAY + 62)).toBe(expected);

        applyPressure(state, DAY + 61, DAY + 62, { intensity: 0 });
        const after = state.npcs[0]!;
        expect(after.locationId, 'a due date cannot put an ordinary walker across water').toBe(expected);
        expect(after.activity, 'the completed or impossible attempt must be closed').toBeNull();
        expect(after.merit, 'travelling is not service that earns contribution').toEqual(before.merit);
        expect(after.spiritStones, 'an impossible arrival cannot pay the traveller').toBe(before.spiritStones);
    });

    it('closes a due journey to their own seat, while another lost journey stays open', () => {
        const home = bench('a-lost-road-home');
        // Both arms have a real sixty-day road. This measures the missing-
        // house exception, not whether a due date invents an unlinked route.
        const hills = home.locations.find(place => place.id === 'hills')!;
        linkLocations(hills, home.locations.find(place => place.id === 'seat')!, 'path', 60);
        linkLocations(hills, home.locations.find(place => place.id === 'elsewhere')!, 'path', 60);
        expect(walkingDaysFrom(home.locations, hills.id).get('seat')).toBe(60);
        expect(walkingDaysFrom(home.locations, hills.id).get('elsewhere')).toBe(60);
        home.npcs[0]!.activity = { kind: 'travelling', note: 'Finding the way home.', withIds: [],
            sinceDay: DAY, untilDay: DAY + 60, fromLocationId: hills.id, returnTo: 'seat' };
        home.factions[0] = theHouseLosesTrackOf(home.factions[0]!, 'lost', DAY);
        const elsewhere = structuredClone(home);
        elsewhere.npcs[0]!.activity!.returnTo = 'elsewhere';
        for (const state of [home, elsewhere]) {
            applyPressure(state, DAY + 61, DAY + 62, { intensity: 0 });
            whatHousesLearnOfTheirOwn(state, DAY + 62);
        }
        expect(home.npcs[0]!.locationId).toBe('seat');
        expect(home.npcs[0]!.activity).toBeNull();
        expect(isLostTrackOf(home, home.npcs[0]!)).toBe(false);
        expect(elsewhere.npcs[0]!.locationId).toBe('hills');
        expect(elsewhere.npcs[0]!.activity?.returnTo).toBe('elsewhere');
        expect(isLostTrackOf(elsewhere, elsewhere.npcs[0]!)).toBe(true);
    });

    it('keeps remote issued robes owed when the lost person leaves the roll', () => {
        let departures = 0;
        for (let seed = 0; seed < 12; seed++) {
            const state = bench(`a-lost-person-leaves-${seed}`);
            state.npcs.push(createNpc(state.seed, { id: 'stays', bornOnDay: DAY - 20 * 365,
                onDay: DAY, factionId: 'house', factionRankIndex: 1, locationId: 'seat' }));
            state.objects = ['lost', 'stays'].map(memberId => aUniformFor({ memberId,
                houseId: 'house', houseName: 'The House', onDay: DAY }));
            state.npcs[0] = theWorldLoses(state.npcs[0]!, DAY, 'Lost in the hills.')!;
            const learned = whatHousesLearnOfTheirOwn(state, DAY);
            if (learned.wentTheirOwnWay === 0) continue;
            departures++;
            expect(state.npcs[0]!.factionId).toBeNull();
            const robes = state.objects.find(o => o.data.memberId === 'lost')!;
            expect(robes.possessorId).toBe('lost');
            expect(robes.ownerId).toBe('house');
            expect(state.obligations.some(word => word.kind === 'debt' && word.status === 'open'
                && word.holderId === 'lost' && word.subjectId === 'house'
                && word.tags.some(tag => tag.includes(robes.id)))).toBe(true);
            expect(state.objects.find(o => o.data.memberId === 'stays')!.possessorId).toBe('stays');
        }
        expect(departures, 'the control must actually leave the roll').toBeGreaterThan(0);
    });
});
