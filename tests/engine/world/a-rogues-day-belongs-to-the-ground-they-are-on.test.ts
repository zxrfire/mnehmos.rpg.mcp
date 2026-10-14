/**
 * The generic rogue fallback called a solitary hermit trading, and its errand
 * called the wilderness a town. A routine reads actual ground and an actual
 * residence; it never creates trade partners, a journey, or a new home. Timed
 * and shared acts keep their own authority. All reads are cheap and pure.
 * Closed-door cultivation remains the separate unbuilt lifecycle in entry 124.
  * Touched-test typechecking caught an invalid numeric resource map: locations
 * actually list gatherable resources as strings. Those real lists must permit
 * gathering and tending without a read changing their contents.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { theyTakeGroundAndMakeItTheirs } from '../../../src/engine/world/somewhere-that-is-theirs';
import { routineOf } from '../../../src/engine/world/npc-routines';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms';

function prepared() {
    const state = createWorld({ seed: 'rogue-day-ground', skipPriorAges: true, regionCount: 0 });
    const wild = makeLocation({ id: 'wild', name: 'Reed Hills', kind: 'wilds' });
    const market = makeLocation({ id: 'market', name: 'Reed Market', kind: 'settlement' });
    state.locations.push(wild, market);
    linkLocations(wild, market, 'road', 2);
    const npc = setRealm(createNpc(state.seed, { id: 'rogue', locationId: wild.id,
        occupation: 'unknown', bornOnDay: -7300, onDay: 0 }), FOUNDATION_ORDINAL, 0);
    npc.activity = null;
    npc.factionId = null;
    state.npcs.push(npc);
    return { state, wild, market, npc };
}

describe('a rogue lives the day on actual ground', () => {
    it('a hermit stays in their actual residence and has no imaginary market or town', () => {
        const h = prepared();
        const settled = theyTakeGroundAndMakeItTheirs(h.state, { residentId: h.npc.id, onDay: 0 });
        expect(settled.ok).toBe(true);
        const npc = settled.state.npcs.find(person => person.id === h.npc.id)!;
        const before = JSON.stringify(settled.state);
        for (const day of [1, 2, 3, 4, 5]) for (const hour of [7, 10, 12, 16, 19, 22]) {
            const clock = { ...settled.state, currentDay: day, currentHour: hour };
            const read = routineOf(clock, npc);
            expect(read.locationId).toBe(settled.residence!.id);
            expect(read.activity?.kind).not.toBe('trade');
            expect(read.activity?.note).not.toMatch(/town|trading/);
            expect(read.home).toBe(true);
            expect(routineOf(clock, npc)).toEqual(read);
        }
        expect(JSON.stringify(settled.state)).toBe(before);
    });

    it('the wilderness offers ground work rather than a solitary market transaction', () => {
        const h = prepared();
        h.wild.environment.resources = ['herbs'];
        const notes = new Set<string>();
        const kinds = new Set<string>();
        for (let day = 0; day < 30; day++) {
            const read = routineOf({ ...h.state, currentDay: day, currentHour: 10 }, h.npc);
            expect(read.locationId).toBe(h.wild.id);
            expect(read.activity?.kind).not.toBe('trade');
            expect(read.activity?.note).not.toMatch(/town|trading/);
            if (read.activity?.note) notes.add(read.activity.note);
            if (read.activity?.kind) kinds.add(read.activity.kind);
        }
        expect([...notes].some(note => /gather|hunt|search/i.test(note))).toBe(true);
        expect(kinds.has('gathering')).toBe(true);
    });

    it('only tends resources actually present on their residence ground', () => {
        const h = prepared();
        const settled = theyTakeGroundAndMakeItTheirs(h.state, { residentId: h.npc.id, onDay: 0 });
        const npc = settled.state.npcs.find(person => person.id === h.npc.id)!;
        const residence = settled.residence!;
        const notes = () => Array.from({ length: 30 }, (_, day) =>
            routineOf({ ...settled.state, currentDay: day, currentHour: 10 }, npc).activity?.note ?? '');
        expect(notes().some(note => /tending/i.test(note))).toBe(false);
        residence.environment.resources = ['herbs'];
        expect(notes().some(note => /tending/i.test(note))).toBe(true);
        expect(residence.environment.resources).toEqual(['herbs']);
    });

    it('a market can still trade and has work notices to read', () => {
        const h = prepared();
        h.npc.locationId = h.market.id;
        const notes: string[] = [];
        for (let day = 0; day < 30; day++) {
            const read = routineOf({ ...h.state, currentDay: day, currentHour: 10 }, h.npc);
            expect(read.locationId).toBe(h.market.id);
            if (read.activity?.note) notes.push(read.activity.note);
        }
        expect(notes.some(note => /trading/i.test(note))).toBe(true);
        expect(notes.some(note => /notices.*work/i.test(note))).toBe(true);
    });

    it('a private residence within a town is still home, rather than a solitary trade', () => {
        const h = prepared();
        h.npc.locationId = h.market.id;
        const settled = theyTakeGroundAndMakeItTheirs(h.state, { residentId: h.npc.id, onDay: 0 });
        const npc = settled.state.npcs.find(person => person.id === h.npc.id)!;
        npc.activity = { kind: 'trade', note: 'trading', withIds: [], sinceDay: 0, untilDay: null };
        for (let day = 0; day < 30; day++) {
            const read = routineOf({ ...settled.state, currentDay: day, currentHour: 10 }, npc);
            expect(read.locationId).toBe(settled.residence!.id);
            expect(read.home).toBe(true);
            expect(read.activity?.kind).not.toBe('trade');
        }
    });

    it('keeps an actual shared trade and an accepted dated journey', () => {
        const h = prepared();
        const partner = createNpc(h.state.seed, { id: 'other', locationId: h.wild.id,
            occupation: 'unknown', bornOnDay: -7300, onDay: 0 });
        h.state.npcs.push(partner);
        h.npc.activity = { kind: 'trade', note: 'Exchanging goods with a traveller.',
            withIds: [partner.id], sinceDay: 0, untilDay: null };
        expect(routineOf({ ...h.state, currentHour: 10 }, h.npc).activity).toBe(h.npc.activity);
        h.npc.activity = { kind: 'travelling', note: 'Walking to the market.', withIds: [],
            fromLocationId: h.wild.id, returnTo: h.market.id, sinceDay: 0, untilDay: 2 };
        const read = routineOf({ ...h.state, currentDay: 1, currentHour: 10 }, h.npc);
        expect(read.activity?.kind).toBe('travelling');
        expect(read.activity?.returnTo).toBe(h.market.id);
        expect(read.home).toBe(false);
    });
});
