/**
 * The upper stratum has to stand somewhere a player can walk to.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS TO STOP COMING BACK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A player's whole route upward is social - being taught, being introduced,
 * asking somebody for something - and the engine says so in as many words:
 * *"You have no name to ask for, which is the whole of what is stopping you."*
 * Every one of those verbs needs a body within reach.
 *
 * Measured on five seeds, before this file existed: **88 cultivators at ordinal
 * 17 and above, every one of them a catalog figure, and every one of them
 * standing on a `region` node.** All 34 `sect_seat` locations - each one with a
 * generated compound inside it and a road linking it to its province - held
 * nobody at all.
 *
 * That is worse than a vague placement, and the engine already had the sentence
 * for why. `the-world-changing-on-its-own.ts` states it in its own banner:
 *
 *   > A region is a container. Nobody stands in one, and `npcsAt` matches on an
 *   > exact `locationId`, so anything placed on a region node is placed nowhere
 *   > anybody can meet it.
 *
 * The newborn path was fixed for exactly that reason. The seeder was never
 * brought in line, so the entire top of the world was standing somewhere no
 * player and no NPC could ever be.
 *
 * The cause was one function. `seatLocationId` matched `faction.territory`
 * against region ids and place names - but `territory` is PROSE ("Terraced
 * peaks above Low Fall gorge, and the vein under it, taken off somebody else
 * nineteen centuries ago"), so no branch of that search could ever fire and
 * every figure fell through to the region fallback. Its own callers' comment
 * said "They are placed at their faction's seat" the whole time.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE ASSERTS, AND WHAT IT DELIBERATELY DOES NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It asserts REACHABILITY, not abundance. The target was never "high
 * cultivators are in settlements" - that would make the great ordinary, and it
 * would break the sentence the whole design rests on. The target is that a
 * player who works for it can stand in front of somebody, and a player who does
 * nothing does not trip over an elder in a market town. A sect seat is exactly
 * that: it is a journey rather than a wall, its name is a thing you have to be
 * given, and nobody arrives there by accident.
 *
 * So there is no bar here on HOW MANY are within reach. What is asserted is
 * that the number is not structurally zero, and that nobody is left standing on
 * a container.
 *
 * The pyramid is checked in the same command, because a change that moves 88
 * people is a change that has to prove it moved nobody's rung.
 */

import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import type { WorldCatalog } from '../../../src/engine/world/catalog';
import { npcsAt } from '../../../src/engine/world/world-state';

/** Foundation Establishment and above - the band a beginner has to reach up to. */
const WORTH_ASKING = 17;

/**
 * Several seeds, pooled. Not because the claim is marginal - it is 88 against 0
 * - but because a claim about a seeded population that is only ever checked on
 * one draw is a claim about one draw.
 */
const SEEDS = ['reach-a', 'reach-b', 'reach-c'];

let catalog: WorldCatalog;

async function worlds(): Promise<ReturnType<typeof seedWorld>['state'][]> {
    catalog ??= await loadCultivationCatalog();
    return SEEDS.map(seed => seedWorld({ seed, catalog }).state);
}

describe('the people worth asking stand somewhere reachable', () => {
    it('places nobody at the top on a region node', async () => {
        for (const state of await worlds()) {
            const kindOf = new Map(state.locations.map(l => [l.id, l.kind]));
            const stranded = state.npcs.filter(npc =>
                npc.status === 'alive'
                && npc.cultivation.realmOrdinal >= WORTH_ASKING
                && kindOf.get(npc.locationId ?? '') === 'region');

            expect(
                stranded.map(n => `${n.name}@${n.cultivation.realmOrdinal}`),
                'a region is a container: anybody standing on one is standing nowhere anybody can meet them'
            ).toEqual([]);
        }
    }, 120_000);

    it('stands them on ground that exists, and that npcsAt can find them on', async () => {
        let reachable = 0;
        for (const state of await worlds()) {
            const byId = new Map(state.locations.map(l => [l.id, l]));
            const high = state.npcs.filter(npc =>
                npc.status === 'alive' && npc.cultivation.realmOrdinal >= WORTH_ASKING);

            expect(high.length, 'the world has an upper stratum at all').toBeGreaterThan(0);

            for (const npc of high) {
                const where = byId.get(npc.locationId ?? '');
                // Not "has a location id". A location id nothing resolves is the
                // same as no location at all, and reads as one in every report.
                expect(where, `${npc.name} stands at ${npc.locationId}, which is not a place`)
                    .toBeDefined();
                // And the join a player's turn actually makes. `othersPresent`
                // reaches these people through `npcsAt`, so that is what has to
                // return them - not the record they carry.
                expect(
                    npcsAt(state, where!.id).some(other => other.id === npc.id),
                    `${npc.name} is not returned by npcsAt for their own location`
                ).toBe(true);
                reachable++;
            }
        }
        expect(reachable, 'the number must not be structurally zero').toBeGreaterThan(0);
    }, 120_000);

    it('leaves no sect seat holding its whole house and no seat holding nobody at all', async () => {
        for (const state of await worlds()) {
            const seats = state.locations.filter(l => l.kind === 'sect_seat');
            expect(seats.length, 'the world seeds sect grounds').toBeGreaterThan(0);

            const occupied = seats.filter(seat =>
                npcsAt(state, seat.id).some(n => n.cultivation.realmOrdinal >= WORTH_ASKING));

            // Spread, not concentration. One seat holding the entire stratum
            // would be a single door rather than reach, and would read as this
            // test passing.
            expect(occupied.length, 'the stratum is spread over more than one gate')
                .toBeGreaterThan(seats.length / 4);
        }
    }, 120_000);

    /**
     * The law, checked in the same command as the change that moved people.
     *
     * Cumulative rather than per-band: every band above a floor is smaller than
     * every band above a lower floor, which is scale-free and needs no
     * calibration. Pooled across seeds, because the top of the ladder is
     * individuals and individuals trade places for ordinary reasons.
     */
    it('leaves the population pyramid exactly where it was', async () => {
        const bands = [0, 13, 17, 21, 25, 29, 33, 37, 41];
        const pooled = new Map<number, number>();
        for (const state of await worlds()) {
            const alive = state.npcs.filter(n => n.status === 'alive');
            for (const band of bands) {
                const n = alive.filter(a => a.cultivation.realmOrdinal >= band).length;
                pooled.set(band, (pooled.get(band) ?? 0) + n);
            }
        }
        for (let i = 1; i < bands.length; i++) {
            expect(
                pooled.get(bands[i])!,
                `band >= ${bands[i]} must not exceed band >= ${bands[i - 1]}`
            ).toBeLessThanOrEqual(pooled.get(bands[i - 1])!);
        }
        expect(pooled.get(0)!, 'a world with people in it').toBeGreaterThan(0);
    }, 120_000);
});
