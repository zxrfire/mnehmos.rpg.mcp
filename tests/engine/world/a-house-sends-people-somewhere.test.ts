/**
 * A sending goes somewhere, and the people on it are there.
 *
 * Measured before this: 74 of 76 NPCs who survived two hundred years never
 * changed location once. Two causes, both real. The only pass that moves
 * anybody filters `factionId === null`, so half the world - 299 of 602 - is in
 * a house and structurally cannot move. And the sending pass, which is the
 * thing in the engine that means "going out", posted its parties to
 * `faction.seatLocationId`: the hall they left from. `setLocation` had no caller
 * anywhere in the repository.
 *
 * So a disciple went out for their house, came back, and had stood in the same
 * square the whole time.
 *
 * Every assertion is a rate over lived worlds. No seed is pinned to a count.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { whereASendingGoes } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back';
import type { WorldState } from '../../../src/engine/world/world-state';

const SEEDS = ['sent-a', 'sent-b'];
const YEARS = 200;
let cached: { state: WorldState; before: Map<string, string | null> }[] | null = null;

async function worldsLived() {
    if (cached) return cached;
    const catalog = await loadCultivationCatalog();
    cached = SEEDS.map(seed => {
        const { state } = seedWorld({ seed, catalog });
        const before = new Map(state.npcs.map(n => [n.id, n.locationId]));
        advanceWorldForPlay(state, { days: YEARS * 365, stopOnInterrupt: false });
        return { state, before };
    });
    return cached;
}

describe('people go places', () => {
    it('and a real share of the long-lived are somewhere else right now', async () => {
        // NOT a claim about net displacement, which would be the wrong
        // measurement: a sending brings people BACK, so somebody who has been
        // out four times is standing exactly where they started. What changed
        // is that at any given moment a real number of people are not home.
        //
        // Before: 2 of 76 had ever been anywhere else, because nothing moved
        // anybody at all.
        for (const { state, before } of await worldsLived()) {
            let elsewhere = 0;
            let athome = 0;
            for (const npc of state.npcs) {
                if (npc.status !== 'alive') continue;
                const was = before.get(npc.id);
                if (was === undefined) continue;
                if (was === npc.locationId) athome++; else elsewhere++;
            }
            expect(athome + elsewhere).toBeGreaterThan(0);
            expect(elsewhere).toBeGreaterThan(0);
            // A fifth of the seeded survivors, rather than one in thirty-eight.
            expect(elsewhere / (athome + elsewhere)).toBeGreaterThan(0.1);
        }
    });

    it('and somebody is out at any given moment', async () => {
        for (const { state } of await worldsLived()) {
            const away = state.npcs.filter(n =>
                n.status === 'alive' && n.activity?.kind === 'mustering');
            expect(away.length).toBeGreaterThan(0);
        }
    });

    it('so a house member is not always at their house', async () => {
        for (const { state } of await worldsLived()) {
            const seats = new Set(state.factions.map(f => f.seatLocationId));
            const members = state.npcs.filter(n => n.status === 'alive' && n.factionId);
            const elsewhere = members.filter(n => n.locationId && !seats.has(n.locationId));
            expect(members.length).toBeGreaterThan(0);
            expect(elsewhere.length).toBeGreaterThan(0);
        }
    });

    it('and a party a house SENT is out for a stated term', async () => {
        // The seeder also writes `mustering` - somebody getting a group
        // together, with no term because nobody has left yet. A term is what
        // distinguishes a party that is gone, and it is what brings them home.
        let withATerm = 0;
        for (const { state } of await worldsLived()) {
            for (const npc of state.npcs) {
                const doing = npc.activity;
                if (!doing || doing.kind !== 'mustering') continue;
                if (doing.untilDay === null || doing.untilDay === undefined) continue;
                withATerm++;
                expect(doing.untilDay).toBeGreaterThan(doing.sinceDay);
            }
        }
        // A world where nothing was ever sent would pass every other assertion
        // here vacuously.
        expect(withATerm).toBeGreaterThan(0);
    });

    it('and nobody LIVING is still out long after their term ran out', async () => {
        for (const { state } of await worldsLived()) {
            for (const npc of state.npcs) {
                if (npc.status !== 'alive') continue;
                const doing = npc.activity;
                if (!doing || doing.kind !== 'mustering') continue;
                if (doing.untilDay === null || doing.untilDay === undefined) continue;
                // The pass brings them home before it sends anybody new, so a
                // living person out for more than a year past their own term is
                // somebody nothing is bringing home.
                expect(doing.untilDay).toBeGreaterThan(state.currentDay - 365);
            }
        }
    });

    it('but somebody who never came back keeps the errand that took them', async () => {
        // MEASURED, and kept rather than tidied away: a party member marked
        // missing still carries the sending on their record, decades later.
        // That is not a stale flag - it is the last thing anybody knows about
        // them, and clearing it would delete the only account of where they
        // went.
        let stillOut = 0;
        for (const { state } of await worldsLived()) {
            stillOut += state.npcs.filter(n =>
                n.status !== 'alive'
                && n.activity?.kind === 'mustering'
                && typeof n.activity.untilDay === 'number').length;
        }
        expect(stillOut).toBeGreaterThan(0);
    });

    it('and a party names each other, which is what makes it a party', async () => {
        for (const { state } of await worldsLived()) {
            const out = state.npcs.filter(n => n.activity?.kind === 'mustering');
            for (const npc of out) {
                expect(npc.activity!.withIds).not.toContain(npc.id);
            }
        }
    });
});

describe('where a sending goes', () => {
    const pickFirst = (): number => 0;

    it('never to the hall it left from', () => {
        const chosen = whereASendingGoes({
            needs: 'a_rival',
            fromLocationId: 'home',
            seatsInPlay: ['home', 'theirs'],
            elsewhere: ['home', 'a-region'],
            pick: pickFirst
        });
        expect(chosen).not.toBe('home');
    });

    it('to somebody else’s seat only where a house RECEIVES you', () => {
        for (const needs of ['an_ally', 'a_subsidiary', 'a_parent'] as const) {
            expect(whereASendingGoes({
                needs,
                fromLocationId: 'home',
                seatsInPlay: ['theirs'],
                elsewhere: ['a-region'],
                pick: pickFirst
            })).toBe('theirs');
        }
    });

    it('and NOT into a rival’s courtyard, which is not where a war is fought', () => {
        expect(whereASendingGoes({
            needs: 'a_rival',
            fromLocationId: 'home',
            seatsInPlay: ['theirs'],
            elsewhere: ['a-region'],
            pick: pickFirst
        })).toBe('a-region');
    });

    it('and out onto ground when the errand is not about a house', () => {
        for (const needs of ['nothing', 'a_find', 'ground'] as const) {
            expect(whereASendingGoes({
                needs,
                fromLocationId: 'home',
                seatsInPlay: ['theirs'],
                elsewhere: ['a-region'],
                pick: pickFirst
            })).toBe('a-region');
        }
    });

    it('falls back rather than posting somebody home', () => {
        // A house with a rival whose seat the world does not hold still sends
        // the party. The one answer that is certainly wrong is the hall it left.
        expect(whereASendingGoes({
            needs: 'a_rival',
            fromLocationId: 'home',
            seatsInPlay: [],
            elsewhere: ['a-region'],
            pick: pickFirst
        })).toBe('a-region');
    });

    it('and says nowhere when there is nowhere', () => {
        expect(whereASendingGoes({
            needs: 'nothing',
            fromLocationId: 'home',
            seatsInPlay: ['home'],
            elsewhere: ['home'],
            pick: pickFirst
        })).toBeNull();
    });
});
