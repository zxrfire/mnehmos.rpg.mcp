/**
 * NPC wall attempts omitted the obligation ledger and discarded a name toll.
 * The yearly pass must charge open accounts in either direction, stop charging
 * settled accounts, and retain a name actually taken across a SQLite restart.
 * Bodies and books are arranged; reviews and crossings run through the live driver.
 * Red-checked by dropping the supplied ledger and the taken-name write.
 */
import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { fixtureCatalog } from './fixtures';
import { createNpc } from '../../../src/engine/world/npc-state';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { createGrudge, settleObligation } from '../../../src/engine/social/grudges';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques';
import { NAME_ELIGIBLE_FROM_ORDINAL } from '../../../src/engine/cultivation/price-of-advancement';
import { cloneWorld } from '../../../src/engine/world/world-state';
import { makeDb } from '../../web/harness';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo';
import { readyToStrike } from '../../../src/engine/world/an-npc-striking-at-the-next-wall';

function atTheWall(seed: string, ordinal: number, count: number) {
    const state = seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population: 0 }).state;
    const place = state.locations.find(l => l.kind === 'settlement')!;
    place.data.localCeilingOrdinal = 44;
    place.data.ambientRateMultiplier = 1;
    place.ambient = 'dense';
    state.factions = [];
    state.schedule = [];
    state.populationTarget = 0;
    state.locations.forEach(l => { l.cycle = null; l.controllingFactionId = null; });
    const available = TECHNIQUES.filter(t => t.requiredOrdinal <= ordinal && (t.cap ?? 0) > ordinal);
    const books = [...new Map(available.map(t => [t.domain, t])).values()];
    expect(books.length).toBeGreaterThan(0);
    state.npcs = Array.from({ length: count }, (_, i) => {
        const npc = createNpc(seed, { id: `wall-person-${i}`, onDay: state.currentDay,
            bornOnDay: state.currentDay - 200 * 365, locationId: place.id,
            cultivation: { realmOrdinal: ordinal, techniqueIds: books.map(t => t.id) } });
        npc.cultivation.spiritRoot = 'single_fire';
        npc.cultivation.attributes = { might: 2, insight: 4, fortune: 0, charm: 2 };
        npc.cultivation.foundation = 'stable';
        const readiness = readyToStrike(npc, state.currentDay, { ambient: 'dense',
            rateMultiplier: 1, guideOrdinal: null, manualCeiling: Math.max(...books.map(t => t.cap ?? 0)) });
        const since = state.currentDay - Math.ceil(readiness.yearsNeeded * 365) - 1;
        npc.cultivation.lastAdvancedOnDay = since;
        npc.cultivation.accumulatingSinceDay = since;
        return npc;
    });
    return state;
}

const year = (state: ReturnType<typeof atTheWall>) => advanceWorldForPlay(state,
    { days: 365, pressure: { intensity: 0 } });

describe('NPC crossings in the running world', () => {
    it('charges the world ledger, with the same cost for owing and being owed, until settlement', () => {
        const open = atTheWall('npc-ledger', NAME_ELIGIBLE_FROM_ORDINAL, 24);
        const clean = cloneWorld(open);
        open.obligations = open.npcs.map((npc, i) => createGrudge({
            holderId: i % 2 === 0 ? npc.id : 'the-other-party',
            subjectId: i % 2 === 0 ? 'the-other-party' : npc.id,
            cause: 'robbery', severity: 'grave', onDay: open.currentDay,
            description: 'An unsettled taking.'
        }));
        const settled = cloneWorld(open);
        settled.obligations = settled.obligations.map(row => settleObligation(row,
            { resolution: 'forgiven', onDay: settled.currentDay, note: 'The holder settled it.' }));
        for (let i = 0; i < 12; i++) { year(open); year(clean); year(settled); }
        const crossing = (s: typeof open) => s.history.facts.filter(f => f.data.fromOrdinal === NAME_ELIGIBLE_FROM_ORDINAL);
        expect(crossing(open).length).toBeGreaterThan(0);
        expect(crossing(open).every(f => Number(f.data.daoHeartStrain) > 0)).toBe(true);
        expect(crossing(clean).every(f => f.data.daoHeartStrain === 0)).toBe(true);
        expect(crossing(settled).every(f => f.data.daoHeartStrain === 0)).toBe(true);
        expect(crossing(open).flatMap(f => f.actors).some(a =>
            open.obligations.find(o => o.holderId === a.id))).toBe(true);
        expect(crossing(open).flatMap(f => f.actors).some(a =>
            open.obligations.find(o => o.subjectId === a.id))).toBe(true);
    });

    it('stores the day a name was actually taken, and keeps it after loading the world', () => {
        const state = atTheWall('npc-name', NAME_ELIGIBLE_FROM_ORDINAL, 96);
        for (let i = 0; i < 12; i++) year(state);
        const taking = state.history.facts.find(f => String(f.data.tollTaken).split(' ').includes('name'));
        expect(taking, 'no name was taken in the live reviews').toBeDefined();
        const npc = state.npcs.find(n => n.id === taking!.actors[0]!.id)!;
        expect(npc.nameTakenOnDay).toBe(taking!.day);
        const db = makeDb();
        const repo = new WorldStateRepository(db);
        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id)!;
        expect(loaded.npcs.find(n => n.id === npc.id)!.nameTakenOnDay).toBe(taking!.day);
        for (let i = 0; i < 12; i++) year(loaded);
        expect(loaded.history.facts.filter(f => f.actors.some(a => a.id === npc.id)
            && String(f.data.tollTaken).split(' ').includes('name'))).toHaveLength(1);
        db.close();
    });
});
