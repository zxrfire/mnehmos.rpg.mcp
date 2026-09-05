/**
 * The wrongs a world opens holding.
 *
 * THE UNIT TIER says what one seeded killing is: priced by the one pricer,
 * written by the one writer, done by somebody still standing there to somebody
 * whose people are still standing there, and indistinguishable from a deed a
 * player caused.
 *
 * THE RATE TIER says it happens at all, at a rate a world can carry, and
 * measured at the point a player would notice - which is not "the world has six
 * killings in it" but **of the settlements a run can open in, how many put
 * somebody who can be told in the room.**
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog, type WorldCatalog } from '../../../src/engine/world/catalog.js';
import { isActing } from '../../../src/engine/world/npc-state.js';
import { drawBirth } from '../../../src/engine/birth/birth.js';
import { OPEN_KILLINGS_PER_PROVINCE } from '../../../src/engine/world/the-wrongs-a-world-opens-holding.js';
import { SEVERITY_ORDER } from '../../../src/engine/social/grudges.js';
import type { HistoricalFact } from '../../../src/engine/world/history.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const BLOOD = new Set(['kin', 'spouse', 'parent', 'child']);
const SEEDS = ['wrong-a', 'wrong-b', 'wrong-c', 'wrong-d', 'wrong-e', 'wrong-f'];

let catalog: WorldCatalog;
async function world(seed: string): Promise<WorldState> {
    catalog ??= await loadCultivationCatalog();
    return seedWorld({ seed, catalog, population: 400 }).state;
}

/** The filter `what-a-telling-lands-on.ts` runs. Asked the same way here. */
function pricedIn(state: WorldState): HistoricalFact[] {
    return state.history.facts.filter(fact => fact.data && 'deedWeight' in fact.data);
}

function bereavedIn(state: WorldState) {
    const dead = new Set(state.npcs.filter(npc => !isActing(npc.status)).map(npc => npc.id));
    return state.npcs.filter(npc =>
        isActing(npc.status)
        && npc.relationships.some(r => BLOOD.has(r.kind) && dead.has(r.targetId)));
}

describe('the wrongs a world opens holding', () => {
    // ─────────────────────────────────────────────────────────────────────
    // THE UNIT TIER
    // ─────────────────────────────────────────────────────────────────────

    it('writes a priced deed the telling layer can actually find', async () => {
        const state = await world('wrong-a');
        const priced = pricedIn(state);
        expect(priced.length, 'a fresh world holds wrongs').toBeGreaterThan(0);

        const at = new Map(state.npcs.map(npc => [npc.id, npc]));
        for (const fact of priced) {
            // Priced, in the ledger's own vocabulary, by `whatADeedLeaves`.
            expect(SEVERITY_ORDER).toContain(fact.data.deedWeight);
            // The writer stamps this, and `doerOf` reads it. Without it the
            // telling layer falls back to actors[0] and a change of order
            // would silently make the victim the killer.
            expect(fact.data.deedDoerId, 'the doer is named on the row').toBeDefined();
            // A name-free line for anybody with no standing to be told, which is
            // required rather than optional for the reason the writer gives: a
            // fact without one reaches every stranger in the province as a shrug.
            expect(String(fact.data.unattributed).length).toBeGreaterThan(20);

            const doer = at.get(String(fact.data.deedDoerId))!;
            const victim = fact.actors.find(a => a.id !== doer.id)!;
            expect(doer, 'somebody the world holds did it').toBeDefined();
            expect(isActing(doer.status), 'and is still standing there').toBe(true);
            expect(isActing(at.get(victim.id)!.status), 'and the other one is dead')
                .toBe(false);
            // Written through `appendWorldFact`, so the people who were there
            // are on it - which is what makes the deed recoverable from the
            // person who did it rather than only from the person it was done to.
            expect(fact.witnessIds.length).toBeGreaterThan(0);
        }
    }, 120000);

    it('leaves somebody living holding a tie to the person it was done to', async () => {
        const state = await world('wrong-b');
        const priced = pricedIn(state);
        const bereaved = bereavedIn(state);
        expect(bereaved.length,
            'an account with nobody to hold it is not an account').toBeGreaterThan(0);

        // Every killing left somebody. That is the whole reason the families run
        // first, and it is the assertion that goes red if that order is swapped.
        const dead = new Set(state.npcs.filter(n => !isActing(n.status)).map(n => n.id));
        for (const fact of priced) {
            const victimId = fact.actors
                .find(a => a.id !== String(fact.data.deedDoerId))!.id;
            const holders = state.npcs.filter(npc =>
                isActing(npc.status)
                && npc.relationships.some(r => BLOOD.has(r.kind) && r.targetId === victimId));
            expect(holders.length, `${fact.summary} left nobody`).toBeGreaterThan(0);
            expect(dead.has(victimId)).toBe(true);
        }
    }, 120000);

    /**
     * Nobody the catalog wrote is on either side of one of these.
     *
     * A guard for something this pass was measured doing. The first version drew
     * the doer from everybody able, and produced *"The Storm Tyrant killed Lu
     * Zhenshi at Deep Snow Village"* and *"First Seat killed Shen Rongfeng"* - the seeder
     * writing an unsettled murder onto the record of the most heavily authored
     * people in the world, asserted by nothing in the catalog. A seeder does not
     * argue with the writing.
     */
    it('never puts a curated figure on either side of one', async () => {
        for (const seed of SEEDS) {
            const state = await world(seed);
            const at = new Map(state.npcs.map(npc => [npc.id, npc]));
            for (const fact of pricedIn(state)) {
                for (const actor of fact.actors) {
                    const npc = at.get(actor.id)!;
                    expect(npc.tags.some(t => t.startsWith('catalog:')),
                        `${actor.name} in "${fact.summary}"`).toBe(false);
                    expect(npc.id.startsWith('npc-line-'),
                        `${actor.name} in "${fact.summary}"`).toBe(false);
                }
            }
        }
    }, 300000);

    it('never kills the head of a house', async () => {
        for (const seed of SEEDS) {
            const state = await world(seed);
            for (const faction of state.factions) {
                const members = state.npcs.filter(npc => npc.factionId === faction.id);
                if (members.length === 0) continue;
                const strongest = members
                    .slice()
                    .sort((a, b) =>
                        b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
                        || b.factionRankIndex - a.factionRankIndex
                        || (a.id < b.id ? -1 : 1))[0];
                // A house's `power_ordinal` is priced on this person. Killing
                // them leaves the faction row claiming a dead leader.
                expect(isActing(strongest.status),
                    `${faction.name} lost ${strongest.name}`).toBe(true);
            }
        }
    }, 300000);

    // ─────────────────────────────────────────────────────────────────────
    // THE RATE TIER
    // ─────────────────────────────────────────────────────────────────────

    /**
     * The brake the design owner put on this, in one assertion.
     *
     * *A world where everybody has a dead brother is as broken as one where
     * nobody does.* The bound is stated per province because that is the unit
     * the rate is written in and the one a reader can check by walking around;
     * the share of the living is the consequence and is reported so a change in
     * it cannot pass unnoticed.
     */
    it('holds at most one open killing per province, and leaves under a fiftieth bereaved', async () => {
        let killings = 0;
        let living = 0;
        let bereaved = 0;
        const perWorld: string[] = [];
        for (const seed of SEEDS) {
            const state = await world(seed);
            const provinces = state.locations.filter(l => l.kind === 'region').length;
            const priced = pricedIn(state);
            expect(priced.length, `${seed}: one per province at most`)
                .toBeLessThanOrEqual(provinces * OPEN_KILLINGS_PER_PROVINCE);

            const alive = state.npcs.filter(npc => isActing(npc.status)).length;
            const lost = bereavedIn(state).length;
            killings += priced.length;
            living += alive;
            bereaved += lost;
            perWorld.push(`${seed} ${priced.length} killings / ${lost} bereaved of ${alive}`);
        }
        expect(killings, `the world holds some: ${perWorld.join(', ')}`).toBeGreaterThan(0);
        expect(bereaved / living, `pooled: ${perWorld.join(', ')}`).toBeLessThan(0.02);
    }, 300000);

    /**
     * Measured at the point a player would notice, which is the only measurement
     * that answers the question this work was for.
     *
     * A run opens in one of a small fixed set of settlements, drawn from the RUN
     * seed. So the question is not how many wrongs a world holds - it is how
     * often a player, on turn one, is standing in a room with somebody who lost
     * a relative to one.
     *
     * Both edges are asserted. Too low and the whole layer is unreachable
     * without days of travel and a reason to travel that nothing supplies. Too
     * high and every town in the world has an unavenged murder in it, which is
     * a theme rather than a setting.
     */
    it('puts a tellable hearer in the opening room about one run in six', async () => {
        catalog ??= await loadCultivationCatalog();
        const openings = new Set<string>();
        for (let i = 0; i < 400; i++) {
            openings.add((drawBirth(`sweep-${i}`) as { place: { name: string } }).place.name);
        }
        expect(openings.size, 'a run opens in a small fixed set of settlements')
            .toBeGreaterThan(8);

        let hits = 0;
        let pairs = 0;
        const perWorld: string[] = [];
        for (const seed of SEEDS) {
            const state = await world(seed);
            const nameOf = new Map(state.locations.map(l => [l.id, l.name]));
            const bereavedPlaces = new Set(
                bereavedIn(state).map(npc => nameOf.get(npc.locationId ?? '') ?? ''));
            let here = 0;
            for (const opening of openings) if (bereavedPlaces.has(opening)) here++;
            hits += here;
            pairs += openings.size;
            perWorld.push(`${seed} ${here}/${openings.size}`);
            expect(here, `${seed} has at least one opening with somebody to tell`)
                .toBeGreaterThan(0);
        }
        const share = hits / pairs;
        expect(share, `pooled: ${perWorld.join(', ')}`).toBeGreaterThan(0.05);
        expect(share, `pooled: ${perWorld.join(', ')}`).toBeLessThan(0.45);
    }, 300000);
});
