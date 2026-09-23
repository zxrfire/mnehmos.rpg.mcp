/**
 * The disciples a world opens with.
 *
 * The design owner: catalog elders and seated masters open the world with
 * disciples from their own house's people; *"some have no master"*, and *"most
 * outer and inner disciples don't"*, the share rising toward the rung under the
 * elders; *"a master can also be looking for a disciple"*, *"very normal"* and
 * *"not too common"*; and *"unless you are a heavenly seedling"*, whom masters
 * compete for.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   the share taken rises by rung and is small at the bottom
 *   a seeded world opens with bonds written both ways at the standings a bond
 *   opens at, dated and attended the day the world opens; with jade for some;
 *   and with masters looking
 *   a master looking takes a junior who fits what they want, in their own time,
 *   and stops looking; passes over somebody who fits nothing however long they
 *   stand there; and a master not looking takes nobody ordinary this way, but
 *   does take a heavenly seedling standing in front of them
 *
 * Measured at world open on `afford-a` and `demography`: 69 and 61 bonds in 33
 * and 35 houses, at most 5 in one; 28 and 31 of 129 masters and elders past
 * Foundation looking (22% and 24%); 49 and 50 jade pairs. Ordinary juniors with a
 * master: 4% and 3% of the first disciple rung, 19% and 10% of the middle rungs,
 * 45% and 46% of the rung under the elders. Heavenly seedlings: every one of the
 * 30 and 25, with 53 and 42 other masters wanting one somebody else took. Nobody
 * was added.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { DISCIPLE_STANDING, MASTER_STANDING } from '../../../src/engine/world/the-ties-an-ordinary-life-produces.js';
import { isAJadeHalf } from '../../../src/engine/world/a-pair-of-communication-jade.js';
import { elderRungOf } from '../../../src/engine/cultivation/leadership.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import {
    A_MASTER_LOOKING,
    aBondSomebodyEnds,
    A_MASTER_WANTS_A_SEEDLING,
    HIGHEST_SHARE,
    isAHeavenlySeedling,
    LOWEST_SHARE,
    searchingMastersTakeADisciple,
    theShareTakenAt,
    theirSearchForADisciple,
    whatTheyLookFor
} from '../../../src/engine/world/the-disciples-a-world-opens-with.js';
import { addGoal, createNpc, setRealm, upsertRelationship, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';

describe('the share of a rung taken as somebody\'s disciple', () => {
    it('is nothing for servants and elders, small at the first disciple rung, and rises to the rung under the elders', () => {
        const ranks = 6;
        expect(theShareTakenAt(0, ranks)).toBe(0);
        expect(theShareTakenAt(1, ranks)).toBe(LOWEST_SHARE);
        expect(theShareTakenAt(2, ranks)).toBeGreaterThan(theShareTakenAt(1, ranks));
        expect(theShareTakenAt(2, ranks)).toBe(HIGHEST_SHARE);
        expect(theShareTakenAt(3, ranks), 'the elder rung takes disciples, it is not one').toBe(0);
    });
});

describe('a seeded world opens with disciples', () => {
    it('written both ways, attended the day it opens, with jade for some and masters looking', async () => {
        const { state } = seedWorld({ seed: 'afford-a', catalog: await loadCultivationCatalog() });
        const open = Math.floor(state.currentDay);
        const byId = new Map(state.npcs.map(n => [n.id, n] as const));

        const seeded = state.npcs.flatMap(master => master.relationships
            .filter(r => r.kind === 'disciple' && r.sinceDay === open)
            .map(r => ({ master, tie: r })));
        expect(seeded.length).toBeGreaterThan(20);
        for (const { master, tie } of seeded) {
            expect(tie.standing).toBe(DISCIPLE_STANDING);
            expect(tie.lastAttentionOnDay).toBe(open);
            const disciple = byId.get(tie.targetId)!;
            expect(disciple.factionId).toBe(master.factionId);
            const back = disciple.relationships.find(r => r.targetId === master.id)!;
            expect(back).toMatchObject({ kind: 'master', standing: MASTER_STANDING });
        }
        expect(state.objects.filter(isAJadeHalf).length).toBeGreaterThan(0);

        // Looking is a regular minority of the masters, not most of them.
        const ranks = new Map(state.factions.map(f => [f.id, f.ranks.length] as const));
        const masters = state.npcs.filter(n => n.status === 'alive' && n.factionId !== null
            && n.cultivation.realmOrdinal >= FOUNDATION_ORDINAL && n.factionRankIndex >= elderRungOf(ranks.get(n.factionId) ?? 0));
        const looking = state.npcs.filter(n => theirSearchForADisciple(n) !== null);
        expect(looking.length / masters.length).toBeGreaterThan(0.1);
        expect(looking.length / masters.length).toBeLessThan(0.4);
        expect(theirSearchForADisciple(looking[0]!)!.text).toMatch(/^Looking for a disciple/);

        // Most of the first disciple rung has no master; every heavenly seedling does.
        const onRung = (pred: (n: NpcRecord) => boolean) => state.npcs.filter(n => n.status === 'alive' && n.factionId !== null
            && n.factionRankIndex >= 1 && n.factionRankIndex < elderRungOf(ranks.get(n.factionId) ?? 0) && pred(n));
        const hasMaster = (n: NpcRecord) => n.relationships.some(r => r.kind === 'master');
        const firstRung = onRung(n => n.factionRankIndex === 1 && !isAHeavenlySeedling(n));
        expect(firstRung.filter(hasMaster).length / firstRung.length).toBeLessThan(0.1);
        const seedlings = onRung(isAHeavenlySeedling);
        expect(seedlings.length).toBeGreaterThan(0);
        expect(seedlings.filter(hasMaster).length).toBe(seedlings.length);
        expect(state.npcs.some(n => n.goals.some(g => g.note === A_MASTER_WANTS_A_SEEDLING)),
            'masters who did not get a seedling want them').toBe(true);
    }, 120_000);
});

describe('a bond one of the two puts down', () => {
    it('ends when it has gone cold, from either end, and leaves a former tie on both', () => {
        // The design owner: *"either they terminate the relationship or they
        // don't"*. Nothing ends a warm bond and no clock ends any bond; what
        // ends one is somebody deciding to, once it has gone cold.
        const state = createWorld({ seed: 'a-bond-put-down', skipPriorAges: true, regionCount: 0 });
        state.currentDay = 200 * 365;
        state.locations.push(makeLocation({ id: 'seat', name: 'The Hall', kind: 'sect_seat' }));
        state.factions.push(makeFaction({ id: 'h', name: 'The House', seatLocationId: 'seat', foundedOnDay: 0, ranks: ['S', 'O', 'I', 'E', 'G', 'H'] }));
        const make = (id: string, rank: number, ordinal: number): NpcRecord => ({
            ...setRealm(createNpc(state.seed, { id, bornOnDay: 0, onDay: state.currentDay, locationId: 'seat', occupation: 'disciple' }), ordinal, state.currentDay),
            name: id, factionId: 'h', factionRankIndex: rank, activity: null
        });
        state.npcs.push(make('master', 4, 20), make('junior', 2, 8));
        const cold = (a: string, b: string, kind: 'master' | 'disciple') => {
            const at = state.npcs.findIndex(n => n.id === a);
            state.npcs[at] = upsertRelationship(state.npcs[at]!, {
                targetId: b, targetName: b, kind, standing: 0, note: ''
            }, state.currentDay - 100 * 365);
        };
        cold('master', 'junior', 'disciple');
        cold('junior', 'master', 'master');

        let ended = 0;
        for (let year = 0; year < 400 && ended === 0; year++) {
            ended = aBondSomebodyEnds(state, state.currentDay + year * 365);
        }
        expect(ended, 'a cold bond is eventually put down').toBe(1);
        const master = state.npcs.find(n => n.id === 'master')!;
        const junior = state.npcs.find(n => n.id === 'junior')!;
        expect(master.relationships.find(r => r.targetId === 'junior')!.kind).toBe('former_disciple');
        expect(junior.relationships.find(r => r.targetId === 'master')!.kind).toBe('former_master');
        expect(state.history.facts.some(f => f.data?.endedBy !== undefined)).toBe(true);
    });

    it('and leaves a warm one alone, for as long as it stays warm', () => {
        const state = createWorld({ seed: 'a-bond-kept', skipPriorAges: true, regionCount: 0 });
        state.currentDay = 200 * 365;
        state.locations.push(makeLocation({ id: 'seat', name: 'The Hall', kind: 'sect_seat' }));
        state.factions.push(makeFaction({ id: 'h', name: 'The House', seatLocationId: 'seat', foundedOnDay: 0, ranks: ['S', 'O', 'I', 'E', 'G', 'H'] }));
        const make = (id: string, rank: number, ordinal: number): NpcRecord => ({
            ...setRealm(createNpc(state.seed, { id, bornOnDay: 0, onDay: state.currentDay, locationId: 'seat', occupation: 'disciple' }), ordinal, state.currentDay),
            name: id, factionId: 'h', factionRankIndex: rank, activity: null
        });
        state.npcs.push(make('master', 4, 20), make('junior', 2, 8));
        const at = state.npcs.findIndex(n => n.id === 'master');
        state.npcs[at] = upsertRelationship(state.npcs[at]!, {
            targetId: 'junior', targetName: 'junior', kind: 'disciple', standing: DISCIPLE_STANDING, note: ''
        }, state.currentDay);
        for (let year = 0; year < 400; year++) {
            expect(aBondSomebodyEnds(state, state.currentDay + year * 365)).toBe(0);
        }
    });
});

describe('a master looking for a disciple', () => {
    function aYard(looking: boolean) {
        const state = createWorld({ seed: 'a-master-looking', skipPriorAges: true, regionCount: 0 });
        state.currentDay = 50 * 365;
        state.locations.push(makeLocation({ id: 'seat', name: 'The Hall', kind: 'sect_seat' }));
        state.factions.push(makeFaction({ id: 'h', name: 'The House', seatLocationId: 'seat', foundedOnDay: 0, ranks: ['S', 'O', 'I', 'E', 'G', 'H'] }));
        const person = (id: string, rank: number, ordinal: number): NpcRecord => ({
            ...setRealm(createNpc(state.seed, { id, bornOnDay: 0, onDay: state.currentDay, locationId: 'seat', occupation: 'disciple' }), ordinal, state.currentDay),
            name: id, factionId: 'h', factionRankIndex: rank, activity: null
        });
        let master = person('master', 4, 20);
        if (looking) master = addGoal(master, { kind: 'other', text: whatTheyLookFor(master), note: A_MASTER_LOOKING }, state.currentDay);
        const junior = person('junior', 2, 8);
        state.npcs.push(master, { ...junior, cultivation: { ...junior.cultivation, spiritRoot: 'single_metal' } });
        return state;
    }

    it('takes a promising junior standing in front of them, in their own time, and stops looking', () => {
        // The design owner: *"a master doesn't necessarily take the best one they
        // found within a year"*. The same junior stands in the same yard every
        // year; what decides it is the master's own disposition, so the bond can
        // be one year away or fifty.
        const state = aYard(true);
        let made = 0;
        let waited = 0;
        for (let year = 0; year < 200 && made === 0; year++) {
            made = searchingMastersTakeADisciple(state, state.currentDay + year * 365);
            waited = year;
        }
        expect(made, `nobody was taken in 200 years of looking (waited ${waited})`).toBe(1);
        const master = state.npcs.find(n => n.id === 'master')!;
        expect(master.relationships.find(r => r.targetId === 'junior')?.kind).toBe('disciple');
        expect(state.npcs.find(n => n.id === 'junior')!.relationships.find(r => r.targetId === 'master')?.kind).toBe('master');
        expect(theirSearchForADisciple(master)).toBeNull();
        expect(master.goals.find(g => g.note === A_MASTER_LOOKING)?.status).toBe('achieved');
        expect(searchingMastersTakeADisciple(state, state.currentDay + 40 * 365), 'not looking any more').toBe(0);
    });

    it('passes over somebody who fits nothing they want, however many years they stand there', () => {
        // Not a ranking of the roll: a junior with no element of the master's
        // root, none of their arts, and no talent worth the years is somebody
        // the master nods to for a century.
        const state = aYard(true);
        const set = (id: string, root: 'single_fire' | 'triple_metal_wood_earth') => {
            const at = state.npcs.findIndex(n => n.id === id);
            state.npcs[at] = { ...state.npcs[at]!, cultivation: { ...state.npcs[at]!.cultivation, spiritRoot: root, techniqueIds: [] } };
        };
        set('master', 'single_fire');
        set('junior', 'triple_metal_wood_earth');
        for (let year = 0; year < 100; year++) {
            expect(searchingMastersTakeADisciple(state, state.currentDay + year * 365)).toBe(0);
        }
        expect(theirSearchForADisciple(state.npcs.find(n => n.id === 'master')!), 'still looking').not.toBeNull();
    });

    it('and a master who is not looking takes nobody ordinary this way', () => {
        const state = aYard(false);
        for (let year = 0; year < 30; year++) {
            expect(searchingMastersTakeADisciple(state, state.currentDay + year * 365)).toBe(0);
        }
    });

    it('but a heavenly seedling in front of them draws a master who was not looking', () => {
        const state = aYard(false);
        const at = state.npcs.findIndex(n => n.id === 'junior');
        state.npcs[at] = { ...state.npcs[at]!, cultivation: { ...state.npcs[at]!.cultivation, spiritRoot: 'mutated_ice' } };
        expect(isAHeavenlySeedling(state.npcs[at]!)).toBe(true);
        expect(searchingMastersTakeADisciple(state, state.currentDay)).toBe(1);
        expect(state.npcs.find(n => n.id === 'master')!.relationships.find(r => r.targetId === 'junior')?.kind).toBe('disciple');
    });
});
