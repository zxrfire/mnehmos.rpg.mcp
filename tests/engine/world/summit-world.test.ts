/**
 * Summit capabilities must reach the world's people through its running clock.
 * These small worlds exercise the driver: an imperfect body leaves hostile ground,
 * a whole one remains, and practice leaves an ordinary object which can expire.
 * NPC presence and a visiting player use the same area, not the province's population.
 * Unrecorded receipt stocks also need bodies in the possession table; a missing register
 * entry cannot delete the medicine it says nobody has counted.
 */
import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { fixtureCatalog } from './fixtures';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { createNpc, setRealm, carryingWounds } from '../../../src/engine/world/npc-state';
import { createInjury } from '../../../src/engine/cultivation/injuries';
import { CultivationRNG, forStream } from '../../../src/engine/cultivation/rng';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms';
import { practiceAmongNeighbours } from '../../../src/engine/world/summit-world';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing';
import { findMedicineOnAnotherErrand } from '../../../src/engine/world/immortal-medicine';
import { SITES } from '../../../src/data/cultivation/inheritance-trials';
import { RECEIPT_HISTORIES } from '../../../src/data/cultivation/immortal-items';

const rung = (key: string) => REALM_TIERS.find(t => t.key === key)!.ordinalStart;
const fire = TECHNIQUES.find(t => t.element === 'fire')!;
function fixture() {
    const state = seedWorld({ seed: 'summit-world', catalog: fixtureCatalog(), population: 2 }).state;
    state.npcs = [];
    const ground = makeLocation({ id: 'ground', name: 'Ember Basin', kind: 'wilds', hazards: ['fire'],
        thresholds: { entry: 0, survival: 45, operational: 45, mastery: 45 } });
    const refuge = makeLocation({ id: 'refuge', name: 'Shelter', kind: 'cave' });
    linkLocations(ground, refuge, 'path', 1);
    state.locations.push(ground, refuge);
    return { state, ground, refuge };
}
function person(state: ReturnType<typeof fixture>['state'], id: string, ordinal: number, place: string) {
    const npc = setRealm(createNpc(state.seed, { id, bornOnDay: state.currentDay - 20 * 365,
        onDay: state.currentDay, locationId: place }), ordinal, state.currentDay);
    npc.cultivation.spiritRoot = 'single_fire';
    npc.cultivation.techniqueIds = [fire.id];
    return npc;
}
const step = (state: ReturnType<typeof fixture>['state'], days: number) =>
    advanceWorldForPlay(state, { days, pressure: { intensity: 0, maxEvents: 0 }, stopOnInterrupt: false });

describe('the summit on the world clock', () => {
    it('unrecorded opening stocks are held as individual possessions', () => {
        const { state } = fixture();
        for (const holding of RECEIPT_HISTORIES.filter(h => !h.countedByTheRegisters)) {
            const held = state.objects.filter(o => o.possessorId === holding.factionId && o.data.medicineId === holding.itemId);
            expect(held.length).toBe(holding.stillHeld.lower + holding.stillHeld.middle + holding.stillHeld.higher);
            expect(held.every(o => o.provenance[0]?.holderId === holding.factionId)).toBe(true);
        }
    });
    it('the imperfect body leaves when its stay expires, while the whole body can remain', () => {
        const { state, ground, refuge } = fixture();
        const full = person(state, 'whole', rung('tribulation_transcendence'), ground.id);
        const cracked = carryingWounds(person(state, 'cracked', full.cultivation.realmOrdinal, ground.id),
            [createInjury({ severity: 'crippling', source: 'failed_breakthrough', turn: 0,
                woundType: 'imperfect-tribulation-body' }, new CultivationRNG('cracked'))], state.currentDay);
        state.npcs = [full, cracked];
        step(state, 2);
        expect(state.npcs.find(n => n.id === full.id)?.locationId).toBe(ground.id);
        expect(state.npcs.find(n => n.id === cracked.id)?.locationId).toBe(refuge.id);
    });

    it('NPC practice leaves a lasting work, while an incomplete work expires', () => {
        const { state, refuge } = fixture();
        const full = person(state, 'maker', rung('grand_ascension'), refuge.id);
        full.activity = { kind: 'their_practice', note: 'Practising a fire art.', withIds: [], sinceDay: state.currentDay };
        const cracked = carryingWounds(person(state, 'brief-maker', full.cultivation.realmOrdinal, refuge.id),
            [createInjury({ severity: 'crippling', source: 'failed_breakthrough', turn: 0,
                woundType: 'unfulfilled-ascension' }, new CultivationRNG('brief'))], state.currentDay);
        cracked.activity = { ...full.activity };
        state.npcs = [full, cracked];
        step(state, 1);
        const permanent = state.objects.find(o => o.ownerId === full.id && o.tags.includes('elemental-work'))!;
        const brief = state.objects.find(o => o.ownerId === cracked.id && o.tags.includes('elemental-work'))!;
        expect(permanent.data.expiresOnDay).toBeNull();
        expect(Number(brief.data.expiresOnDay)).toBeGreaterThan(state.currentDay);
        state.npcs.forEach(n => { n.activity = null; });
        step(state, 366);
        expect(state.objects.find(o => o.id === permanent.id)?.tags).not.toContain('ruined');
        expect(state.objects.find(o => o.id === brief.id)?.tags).toContain('ruined');
    });

    it('trapped imperfect bodies keep taking harm after the tolerated stay', () => {
        const { state, ground } = fixture();
        ground.links = [];
        const cracked = carryingWounds(person(state, 'trapped', rung('tribulation_transcendence'), ground.id),
            [createInjury({ severity: 'crippling', source: 'failed_breakthrough', turn: 0,
                woundType: 'imperfect-tribulation-body' }, new CultivationRNG('trapped'))], state.currentDay);
        state.npcs = [cracked];
        step(state, 12);
        expect(state.npcs[0]!.cultivation.hp).toBe(0);
        expect(state.npcs[0]!.status).not.toBe('alive');
    });

    it('a visiting player and an NPC can each suppress the other in their own area', () => {
        const { state, refuge } = fixture();
        const lower = person(state, 'lower', 3, refuge.id);
        const higher = person(state, 'higher', rung('deity_transformation'), refuge.id);
        state.npcs = [lower, higher];
        expect(practiceAmongNeighbours(state, lower, state.currentDay)).toBeLessThan(1);
        state.npcs = [lower];
        const areaId = theAreasOf(state, refuge).whereIs.get(lower.id)!;
        expect(practiceAmongNeighbours(state, lower, state.currentDay,
            { person: higher, placeId: refuge.id, areaId })).toBeLessThan(1);
        expect(practiceAmongNeighbours(state, lower, state.currentDay,
            { person: higher, placeId: refuge.id, areaId: 'somewhere-else' })).toBe(1);
    });

    it('an incidental NPC find transfers the same grave dose once', () => {
        const { state, refuge } = fixture();
        const site = SITES.find(s => s.kind !== 'trial' && s.interior.contents.some(c => c.immortalItemId))!;
        const region = state.locations.find(l => l.kind === 'region')!;
        refuge.parentId = region.id;
        state.factions.push({ ...state.factions[0]!, id: site.factionIds[0]!, seatLocationId: refuge.id });
        const finder = person(state, 'finder', rung('core_formation'), refuge.id);
        state.npcs = [finder];
        const year = Array.from({ length: 1000 }, (_, n) => n)
            .find(n => forStream(state.seed, 'incidental-grave', region.id, n).chance(0.01))!;
        expect(year).toBeDefined();
        findMedicineOnAnotherErrand(state, region.id, year, state.currentDay);
        const dose = state.objects.find(o => o.data.siteId === site.id)!;
        expect(dose.possessorId).toBe(finder.id);
        expect(dose.provenance.at(-1)?.how).toBe('looted');
        const links = dose.provenance.length;
        findMedicineOnAnotherErrand(state, region.id, year, state.currentDay);
        expect(state.objects.find(o => o.id === dose.id)?.provenance).toHaveLength(links);
    });
});
