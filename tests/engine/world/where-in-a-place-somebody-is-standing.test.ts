/**
 * A place is read into areas, and no area holds more than three of the world's people.
 *
 * The owner: "AT MOST 3 people per room, 3 NPCs", "for others, they can be in a diff room", a
 * room being any area of a place. Measured before this on `road-world`: the square a new run
 * opened on held 6, 11, 21 and 28 people, because a place was one square.
 *
 * What is pinned, over every place anybody stands in on three seeded worlds:
 *
 *   NOBODY LOST     everybody a row holds is in exactly one of its areas
 *   THREE AT MOST   no area holds more than three
 *   ONE SCENE       people in one activity together, three or fewer, are in one area
 *   THE GATE        a house's gate has the one on watch in its first area, and nobody of the
 *                   house stands outside the gate but them and whoever is in a scene with them
 *   THE WORLD       nobody's `locationId` moves: `npcsStandingIn` still answers for the whole row
 *
 * Red-checked: with the areas of a kind cut at twelve rather than three, the ceiling fails on a
 * city's street.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { seedWorld } from '../../../src/engine/world/seeding';
import type { WorldState } from '../../../src/engine/world/world-state';
import { npcsStandingIn, whereCompoundsAre } from '../../../src/engine/world/where-inside-a-house-somebody-is-standing';
import {
    theAreasOf,
    theOneOnWatchAtTheGate,
    whereInThisPlaceTheyStand
} from '../../../src/engine/world/where-in-a-place-somebody-is-standing';
import { WORLD_POPULATION } from '../../../src/server/state/cultivation-world';

const SEEDS = ['road-world', 'w-2', 'w-3'];
/** The owner's number, stated here rather than imported, so moving the constant fails this. */
const AT_MOST_IN_AN_AREA = 3;

let seeded: WorldState[] | null = null;
async function worlds(): Promise<WorldState[]> {
    if (seeded) return seeded;
    const catalog = await loadCultivationCatalog();
    seeded = SEEDS.map(seed => seedWorld({ seed, catalog, population: WORLD_POPULATION }).state);
    return seeded;
}

/** Every row somebody is standing in. */
function occupied(state: WorldState) {
    const held = new Set(state.npcs.filter(n => n.status === 'alive' && n.locationId !== null).map(n => n.locationId));
    const compounds = whereCompoundsAre(state);
    return state.locations.filter(row => held.has(row.id) || compounds.seatOf.has(row.id));
}

describe('a place is read into areas of at most three', () => {
    it('puts everybody a row holds in exactly one area, three at most, and a scene in one', async () => {
        const sizes: number[] = [];
        const rows: number[] = [];
        for (const state of await worlds()) {
            const compounds = whereCompoundsAre(state);
            const byId = new Map(state.npcs.map(n => [n.id, n]));
            for (const place of occupied(state)) {
                const people = npcsStandingIn(state, place.id, compounds);
                if (people.length === 0) continue;
                rows.push(people.length);
                const { areas, whereIs } = theAreasOf(state, place, compounds);
                expect(whereIs.size, `${place.name}: somebody lost or counted twice`).toBe(people.length);
                const count = new Map<string, number>();
                for (const at of whereIs.values()) count.set(at, (count.get(at) ?? 0) + 1);
                for (const area of areas) {
                    const n = count.get(area.id) ?? 0;
                    expect(n, `${place.name}: ${area.name}`).toBeLessThanOrEqual(AT_MOST_IN_AN_AREA);
                    if (n > 0) sizes.push(n);
                }
                for (const npc of people) {
                    const group = (npc.activity?.withIds ?? []).filter(id => whereIs.has(id));
                    if (group.length + 1 > AT_MOST_IN_AN_AREA) continue;
                    const untilDay = npc.activity?.untilDay;
                    if (untilDay !== null && untilDay !== undefined && untilDay < Math.floor(state.currentDay)) continue;
                    for (const id of group) {
                        expect(whereIs.get(id), `${npc.name} and ${byId.get(id)?.name} are in one scene`)
                            .toBe(whereIs.get(npc.id));
                    }
                }
            }
        }
        const share = (test: (n: number) => boolean) => `${Math.round(100 * sizes.filter(test).length / sizes.length)}%`;
        console.log(`[areas] ${rows.length} rows, largest ${Math.max(...rows)}; ${sizes.length} occupied areas: `
            + `1 ${share(n => n === 1)}, 2 ${share(n => n === 2)}, 3 ${share(n => n === 3)}`);
        expect(Math.max(...sizes)).toBeLessThanOrEqual(AT_MOST_IN_AN_AREA);
    }, 180_000);

    it('keeps the one on watch in the first area outside a house\'s gate, and the house\'s own inside', async () => {
        let watched = 0;
        for (const state of await worlds()) {
            const compounds = whereCompoundsAre(state);
            for (const seat of state.locations.filter(row => row.kind === 'sect_seat')) {
                const house = (seat.data as { factionId?: string }).factionId ?? seat.controllingFactionId;
                const { areas, whereIs } = theAreasOf(state, seat, compounds);
                const watch = theOneOnWatchAtTheGate(state, seat, compounds);
                if (watch !== null) {
                    watched++;
                    expect(whereIs.get(watch.id)).toBe(areas.find(area => area.for === 'gate')!.id);
                }
                for (const npc of npcsStandingIn(state, seat.id, compounds)) {
                    if (npc.factionId !== house || npc.id === watch?.id) continue;
                    // In a scene with the one on watch is at the gate with them.
                    if (watch && (npc.activity?.withIds.includes(watch.id) || watch.activity?.withIds.includes(npc.id))) continue;
                    expect(whereIs.get(npc.id)!, `${npc.name} of the house stands outside its gate`).toContain('#forecourt#');
                }
            }
        }
        expect(watched).toBeGreaterThan(0);
    }, 180_000);

    it('stands somebody where a road arrives unless they walked to another area of that place', async () => {
        const [state] = await worlds();
        const town = state!.locations.find(row => row.kind === 'settlement')!;
        const { areas } = theAreasOf(state!, town);
        expect(whereInThisPlaceTheyStand(state!, town, null, null).name).toBe('the street');
        const inn = areas.find(area => area.for === 'table')!;
        expect(whereInThisPlaceTheyStand(state!, town, inn.id, null).id).toBe(inn.id);
        // An area of some other place is not where they are.
        const other = state!.locations.filter(row => row.kind === 'settlement')[1]!;
        const elsewhere = theAreasOf(state!, other).areas.find(area => area.for === 'table')!;
        expect(whereInThisPlaceTheyStand(state!, town, elsewhere.id, null).name).toBe('the street');
        // A house's seat: its own come in to the forecourt, anybody else stands outside the gate.
        const seat = state!.locations.find(row => row.kind === 'sect_seat')!;
        const house = (seat.data as { factionId: string }).factionId;
        expect(whereInThisPlaceTheyStand(state!, seat, null, house).for).toBe('forecourt');
        expect(whereInThisPlaceTheyStand(state!, seat, null, null).for).toBe('gate');
    }, 180_000);
});
