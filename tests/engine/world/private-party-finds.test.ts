/**
 * Owner correction, 2026-10-12: private finds are not automatically the
 * sponsor's. Equals keep what they actually took. An elder chooses through
 * the ordinary person resolver; keeping a lower find from its disciple costs
 * face, sharing earns face, and retaining usable things carries no shame.
 * Common sharing is measured across different people. Repeating one id across
 * world seeds repeats that person's traits and cannot measure a population.
 * A visiting pupil also receives an elder's allocation decision. Only taking
 * a lower find from the elder's own pupil incurs the owner's face penalty.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { collectPrivatePartyFinds, theyHaveOutgrownTheFind } from '../../../src/engine/world/private-party-finds.js';
import { LEFT_WITH_THE_PLACE } from '../../../src/engine/world/what-a-ruin-has-on-its-shelves.js';
import { faceOf } from '../../../src/engine/world/what-a-face-is-worth.js';
import { PILLS } from '../../../src/data/cultivation/pills.js';
import { pillBandOrdinal } from '../../../src/engine/cultivation/breakthrough.js';
import { REALM_TIERS, realmIndexOf } from '../../../src/engine/cultivation/realms.js';

it('a pill is useful in its actual pitched realm, which differs from the material grade band', () => {
    const pill = PILLS.find(pill => pill.grade === 'mortal')!;
    const state = fixture('actual-pill-pitch', 2, true), person = state.npcs[0];
    const object = makeObject({ id: 'pitched-dose', name: pill.name, kind: 'pill', data: { pillId: pill.id } });
    person.cultivation.realmOrdinal = pillBandOrdinal(pill.grade);
    expect(theyHaveOutgrownTheFind(person, object)).toBe(false);
    person.cultivation.realmOrdinal = REALM_TIERS[realmIndexOf(person.cultivation.realmOrdinal) + 1].ordinalStart;
    expect(theyHaveOutgrownTheFind(person, object)).toBe(true);
});

function fixture(seed: string, power: number, personal: boolean) {
    const state = createWorld({ seed, regionCount: 0, skipPriorAges: true });
    state.locations.push(makeLocation({ id: 'ground', kind: 'ruin', name: 'Found ground' }));
    let elder = createNpc(seed, { id: `${seed}:elder`, onDay: 0, bornOnDay: -30 * 365,
        spiritStones: 10000, locationId: 'ground', cultivation: { realmOrdinal: 20 } });
    let junior = createNpc(seed, { id: 'junior', onDay: 0, bornOnDay: -20 * 365, locationId: 'ground', cultivation: { realmOrdinal: 3 } });
    if (personal) {
        elder = upsertRelationship(elder, { targetId: junior.id, targetName: junior.name, kind: 'disciple', standing: 0.8 }, 0);
        junior = upsertRelationship(junior, { targetId: elder.id, targetName: elder.name, kind: 'master', standing: 0.8 }, 0);
    }
    state.npcs.push(elder, junior);
    state.objects.push(makeObject({ id: 'find', name: 'A found blade', kind: 'artifact', power,
        locationId: 'ground', tags: [LEFT_WITH_THE_PLACE] }));
    return state;
}

it('equals retain their actual pickups regardless of the other person standing higher', () => {
    let juniorFinds = 0;
    for (let seed = 0; seed < 50; seed++) {
        const state = fixture(`equal-find-${seed}`, 2, false);
        collectPrivatePartyFinds(state, 'ground', state.npcs, null, 10, 'venture');
        const finder = state.history.facts.find(fact => fact.data.privatePartyFind === 'venture')!.actors[0]!.id;
        expect(state.objects[0].ownerId).toBe(finder);
        expect(state.objects[0].possessorId).toBe(finder);
        expect(state.objects[0].provenance.some(entry => entry.how === 'found' && entry.holderId === finder)).toBe(true);
        if (finder === 'junior') juniorFinds++;
        expect(faceOf(state.npcs[0])).toBe(0);
    }
    expect(juniorFinds).toBeGreaterThan(0);
});

it('an elder can share or keep a disciple find and the lower find moves face in the corresponding direction', () => {
    let shared = 0, kept = 0;
    for (let seed = 0; seed < 100; seed++) {
        const state = fixture(`elder-find-${seed}`, 2, true);
        const elderId = state.npcs[0].id;
        collectPrivatePartyFinds(state, 'ground', state.npcs, elderId, 10, 'venture');
        const choice = state.history.facts.find(fact => fact.data.privateFindAllocation === 'venture');
        if (!choice) continue;
        if (choice.data.shared) shared++; else kept++;
        expect(state.objects[0].ownerId).toBe(choice.data.shared ? 'junior' : elderId);
        expect(Math.sign(faceOf(state.npcs[0]))).toBe(choice.data.shared ? 1 : -1);
    }
    expect(shared).toBeGreaterThan(kept); expect(kept).toBeGreaterThan(0);
});

it('an elder keeping a thing they can use incurs no shame, and another read cannot distribute it twice', () => {
    let kept = 0;
    for (let seed = 0; seed < 50; seed++) {
        const state = fixture(`usable-find-${seed}`, 20, true);
        const elderId = state.npcs[0].id;
        collectPrivatePartyFinds(state, 'ground', state.npcs, elderId, 10, 'venture');
        const choice = state.history.facts.find(fact => fact.data.privateFindAllocation === 'venture');
        if (choice?.data.shared === false) { kept++; expect(faceOf(state.npcs[0])).toBe(0); }
        const facts = state.history.facts.length, face = faceOf(state.npcs[0]);
        collectPrivatePartyFinds(state, 'ground', state.npcs, elderId, 10, 'venture');
        expect(state.history.facts).toHaveLength(facts); expect(faceOf(state.npcs[0])).toBe(face);
    }
    expect(kept).toBeGreaterThan(0);
});

it('an elder expedition decides visiting pupils and its own finds without inventing their personal master', () => {
    let keptFromVisitor = 0, shared = 0, elderFound = 0;
    for (let seed = 0; seed < 100; seed++) {
        const state = fixture(`visiting-pupil-find-${seed}`, 2, false), elder = state.npcs[0];
        state.npcs[1] = upsertRelationship(state.npcs[1], { targetId: 'their-own-master', targetName: 'Their own master',
            kind: 'master', standing: 0.8 }, 0);
        collectPrivatePartyFinds(state, 'ground', state.npcs, elder.id, 10, 'venture', true);
        const choice = state.history.facts.find(fact => fact.data.privateFindAllocation === 'venture')!;
        expect(choice).toBeDefined();
        if (choice.actors.some(actor => actor.id === elder.id && actor.role === 'finder')) elderFound++;
        if (choice.data.shared) shared++;
        else {
            if (choice.actors.some(actor => actor.id === 'junior' && actor.role === 'finder')) keptFromVisitor++;
            expect(faceOf(state.npcs[0])).toBe(0);
        }
        expect(state.npcs[1].relationships.some(tie => tie.targetId === 'their-own-master' && tie.kind === 'master')).toBe(true);
        expect(state.npcs[1].relationships.some(tie => tie.targetId === elder.id && tie.kind === 'master')).toBe(false);
    }
    expect(keptFromVisitor).toBeGreaterThan(0); expect(shared).toBeGreaterThan(0); expect(elderFound).toBeGreaterThan(0);
});
