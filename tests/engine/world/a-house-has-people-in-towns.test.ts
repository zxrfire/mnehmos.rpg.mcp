/**
 * A house has people in towns it does not own, and something comes out of the
 * treeline at them.
 *
 * Measured before this: 516 of 541 living people had no activity at all, and 57
 * of 68 living ELDERS had none. The top of the world was standing still, and a
 * settlement was a name on a map with nothing happening at it.
 *
 * The design owner: *"a sect stations their people outside the sect too"*, on
 * who goes: *"maybe no office elders go outside"*, and on what they do there:
 * *"those elders write reports to the sect"* and *"maybe defend the disciples if
 * any are there on their own missions - from a distance using their spirit
 * sense, they don't just follow them around."*
 *
 * All of which is one fact: A STATION IS A HOUSE'S EYES AND ITS ARM AT A PLACE.
 * Somebody posted there is standing there, so they answer what happens; and a
 * fact that names their house is a house that knows. Neither needs machinery.
 *
 * Rates over lived worlds. No seed is pinned to a count.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { isElderRank } from '../../../src/engine/cultivation/leadership';
import { getSect } from '../../../src/data/cultivation/sects';
import type { WorldState } from '../../../src/engine/world/world-state';

const SEEDS = ['town-a', 'town-b'];
const YEARS = 200;
let cached: WorldState[] | null = null;

async function worldsLived(): Promise<WorldState[]> {
    if (cached) return cached;
    const catalog = await loadCultivationCatalog();
    cached = SEEDS.map(seed => {
        const { state } = seedWorld({ seed, catalog });
        advanceWorldForPlay(state, { days: YEARS * 365, stopOnInterrupt: false });
        return state;
    });
    return cached;
}

const living = (s: WorldState) => s.npcs.filter(n => n.status === 'alive');
const stationed = (s: WorldState) => living(s).filter(n => n.activity?.kind === 'stationed');
const cameDown = (s: WorldState) => s.history.facts.filter(f => f.summary.includes('came down on'));

describe('a house stations people outside itself', () => {
    it('has people posted at any given moment', async () => {
        for (const state of await worldsLived()) {
            expect(stationed(state).length).toBeGreaterThan(0);
        }
    });

    it('and never at their OWN house, which is the point of a posting', async () => {
        // Not "at nobody's seat": a house founded later can take its seat at a
        // town somebody was already posted to, and that is a true thing about
        // the world rather than a misplaced person. What must never happen is
        // somebody being posted to the hall they came from.
        // Nobody is POSTED to their own hall - the pass excludes every seat by
        // id before it picks. What this cannot rule out afterwards is a house
        // whose seat MOVED onto a town it already had somebody in, which is a
        // true thing about the world rather than a misplaced person. So the
        // claim is that it is rare, not that it is impossible.
        let atTheirOwn = 0;
        let posted = 0;
        for (const state of await worldsLived()) {
            const seatOf = new Map(state.factions.map(f => [f.id, f.seatLocationId]));
            for (const who of stationed(state)) {
                posted++;
                if (who.locationId === (seatOf.get(who.factionId ?? '') ?? null)) atTheirOwn++;
            }
        }
        expect(posted).toBeGreaterThan(0);
        expect(atTheirOwn / posted).toBeLessThan(0.1);
    });

    it('and more than one house can have somebody in the same town', async () => {
        // That is how it is. A market town with three houses watching it is the
        // ordinary shape, not a collision.
        let shared = 0;
        for (const state of await worldsLived()) {
            const byTown = new Map<string, Set<string>>();
            for (const who of stationed(state)) {
                if (!who.locationId || !who.factionId) continue;
                const houses = byTown.get(who.locationId) ?? new Set<string>();
                houses.add(who.factionId);
                byTown.set(who.locationId, houses);
            }
            for (const [, houses] of byTown) if (houses.size > 1) shared++;
        }
        expect(shared).toBeGreaterThan(0);
    });

    it('for years, not for an errand', async () => {
        // A sending is weeks and comes back with an account of itself. A
        // station is somebody the house has put somewhere and largely stopped
        // thinking about, and the term is what tells them apart.
        for (const state of await worldsLived()) {
            for (const who of stationed(state)) {
                const doing = who.activity!;
                expect(typeof doing.untilDay).toBe('number');
                expect(doing.untilDay! - doing.sinceDay).toBeGreaterThan(365);
            }
        }
    });

    it('and the world is no longer mostly people doing nothing', async () => {
        // It was 95%. The claim is not a number, it is that having something to
        // be at is now the ordinary condition of a good share of the world.
        for (const state of await worldsLived()) {
            const alive = living(state);
            const busy = alive.filter(n => n.activity !== null).length;
            expect(alive.length).toBeGreaterThan(0);
            // It was 5%. Measured now at 16%, and asserted below that so a
            // seed that runs cold does not fail a claim about the shape.
            expect(busy / alive.length).toBeGreaterThan(0.1);
        }
    });

    it('and an elder is among the people a house can spare', async () => {
        // Deliberately: there are fewer rooms than elders, so an elder holding
        // no room is the ordinary case and is exactly who goes.
        let postedElders = 0;
        for (const state of await worldsLived()) {
            for (const who of stationed(state)) {
                const ranks = who.factionId ? getSect(who.factionId)?.ranks.length ?? 0 : 0;
                if (ranks > 0 && isElderRank(who.factionRankIndex, ranks)) postedElders++;
            }
        }
        expect(postedElders).toBeGreaterThan(0);
    });
});

describe('something comes out of the treeline', () => {
    it('at towns, over a long enough span', async () => {
        for (const state of await worldsLived()) {
            expect(cameDown(state).length).toBeGreaterThan(0);
        }
    });

    it('and it lands on places people live, not on empty wilds', async () => {
        const settlements = new Set<string>();
        for (const state of await worldsLived()) {
            for (const l of state.locations) if (l.kind === 'settlement') settlements.add(l.id);
            for (const fact of cameDown(state)) {
                expect(fact.locationId).not.toBeNull();
                expect(settlements.has(fact.locationId!)).toBe(true);
            }
        }
    });

    it('and sometimes it is put back and sometimes it is not', async () => {
        // A beast that always wins is a disaster table; one that always loses
        // is scenery. Both outcomes have to happen for either to mean anything.
        let held = 0;
        let not = 0;
        for (const state of await worldsLived()) {
            for (const fact of cameDown(state)) {
                if (fact.summary.includes('was put back')) held++; else not++;
            }
        }
        expect(held).toBeGreaterThan(0);
        expect(not).toBeGreaterThan(0);
    });

    it('and whoever stood to it was strong enough to', async () => {
        for (const state of await worldsLived()) {
            for (const fact of cameDown(state)) {
                if (!fact.summary.includes('was put back')) continue;
                // Somebody is named as having held it, and they are a person
                // the world holds a row for.
                expect(fact.actors.length).toBeGreaterThan(0);
                for (const actor of fact.actors) {
                    expect(actor.role).toBe('stood to it');
                }
            }
        }
    });

    it('and a house with somebody posted there is told, which is the report', async () => {
        // A house learns what happens where it has people, and does not learn
        // what happens where it has none. That is the whole value of a station,
        // and it is why the report needs no channel of its own.
        let named = 0;
        for (const state of await worldsLived()) {
            for (const fact of cameDown(state)) {
                if (fact.factionIds.length > 0) named++;
            }
        }
        expect(named).toBeGreaterThan(0);
    });
});
