/**
 * Formation construction and boundary damage had pure resolvers but no live
 * writer. A typed action must leave a stationary object and spend the art's
 * qi. Boundary damage must survive a repository read, compound on repetition,
 * and end a life when the burned years exhaust it. A binding settlement also
 * needs a reachable way to leave, including recovery of the original account.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import { whatAnArtCanRaiseTo } from '../../src/engine/world/a-formation-stands-at-the-lower-of-the-art-and-the-builder';
import { persistCrossingConsequence } from '../../src/server/consolidated/cultivation-support';
import { createGrudge } from '../../src/engine/social/grudges';
import { writeOneObligation, ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import type { BreakthroughResult } from '../../src/schema/cultivation';

async function player(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const created = await harness.game.newRun('Test Cultivator') as unknown as { cultivator: { id: string } };
    return { ...harness, id: created.cultivator.id };
}

describe('unwired mechanics leave live state', () => {
    it('raises a known formation through a typed sentence, and replaces its own work', async () => {
        const { game, repos, id } = await player('raising-a-domain');
        const art = TECHNIQUES.find(t => whatAnArtCanRaiseTo(t) !== null)!;
        expect(art).toBeTruthy();
        repos.techniques.upsert(art);
        repos.techniques.learn(id, art.id, 1);
        const builder = Math.max(art.requiredOrdinal, 20);
        repos.cultivators.update(id, { realmOrdinal: builder, qi: 100000, maxQi: 100000 });
        const before = (await game.loadWorld())!.objects.filter(o => o.ownerId === id && o.kind === 'formation');
        expect(before).toHaveLength(0);
        await game.act(`I raise a formation from ${art.name}`);
        const raised = (await game.loadWorld())!.objects.filter(o => o.ownerId === id && o.kind === 'formation');
        expect(raised).toHaveLength(1);
        expect(raised[0].possessorId).toBeNull();
        expect(raised[0].locationId).toBeTruthy();
        expect(raised[0].power).toBe(Math.min(builder, whatAnArtCanRaiseTo(art)!));
        expect(repos.cultivators.getById(id)!.qi).toBe(100000 - art.qiCost);
        await game.act(`I raise a formation from ${art.name}`);
        expect((await game.loadWorld())!.objects.filter(o => o.ownerId === id && o.kind === 'formation')).toHaveLength(1);
    }, 120000);

    it('does not build or spend qi from an art the holder has never practised', async () => {
        const { game, repos, id } = await player('unpractised-domain');
        const art = TECHNIQUES.find(t => whatAnArtCanRaiseTo(t) !== null)!;
        repos.techniques.upsert(art);
        repos.techniques.learn(id, art.id, 0);
        repos.cultivators.update(id, { realmOrdinal: art.requiredOrdinal, qi: 100000, maxQi: 100000 });
        await game.act(`I raise a formation from ${art.name}`);
        expect((await game.loadWorld())!.objects.some(o => o.ownerId === id && o.kind === 'formation')).toBe(false);
        expect(repos.cultivators.getById(id)!.qi).toBe(100000);
    }, 120000);

    it('cannot substitute its only known art for a named art it does not hold', async () => {
        const { game, repos, id } = await player('a-named-domain');
        const art = TECHNIQUES.find(t => whatAnArtCanRaiseTo(t) !== null)!;
        repos.techniques.upsert(art);
        repos.techniques.learn(id, art.id, 1);
        repos.cultivators.update(id, { realmOrdinal: art.requiredOrdinal, qi: 100000, maxQi: 100000 });
        await game.act('I raise a formation from an art I have not learned');
        expect((await game.loadWorld())!.objects.some(o => o.ownerId === id && o.kind === 'formation')).toBe(false);
        expect(repos.cultivators.getById(id)!.qi).toBe(100000);
    }, 120000);

    it('persists compound soul damage and burned lifespan, including death', async () => {
        const { repos, id } = await player('boundary-damage');
        repos.cultivators.update(id, { age: 20, soulState: 'fragmented', identityContinuity: 0.8 });
        const damage: NonNullable<BreakthroughResult['crossing']> = {
            trial: 'severing', outcome: 'partial', foundationQuality: null,
            yearsBurned: 5, soulStateFloor: 'damaged', identityContinuityFactor: 0.75, halted: false
        };
        persistCrossingConsequence(repos, id, damage, 1);
        persistCrossingConsequence(repos, id, damage, 2);
        const after = repos.cultivators.getById(id)!;
        expect(after.soulState).toBe('fragmented');
        expect(after.identityContinuity).toBeCloseTo(0.45);
        expect(after.age).toBe(30);
        persistCrossingConsequence(repos, id, { ...damage, yearsBurned: 1000000 }, 3);
        expect(repos.cultivators.getById(id)!.alive).toBe(false);
    }, 120000);
});

/** A house-beneficiary oath must be findable through its actual match partner. */
describe('a match can settle an account and leaving reopens it', () => {
    it('writes the oath only after acceptance and follows its link when the player leaves', async () => {
        const { game, repos, id } = await player('binding-settlement');
        const world = (await game.loadWorld())!;
        const partner = world.npcs.find(n => n.status === 'alive' && n.factionId
            && repos.sects.getById(n.factionId) && n.locationId)!;
        expect(partner).toBeTruthy();
        const place = world.locations.find(l => l.id === partner.locationId)!;
        const partnerArea = theAreasOf(world, place).whereIs.get(partner.id)!;
        expect(partnerArea, 'the proposed-to person has a current area').toBeDefined();
        repos.sects.addMember(partner.factionId!, id);
        repos.cultivators.update(id, { realmOrdinal: 44, location: place.name });
        // `standingIn` is a flag, not an update column.  Changing place clears
        // the old flag; persist the partner's actual area through its one
        // writer before asking the engine to resolve a match there.
        repos.cultivators.standIn(id, partnerArea);
        game.knowledge.learn({ holderId: id, kind: 'cultivator', id: partner.id,
            name: partner.name, onDay: 0, sourceKind: 'witnessed', stage: 'known' });
        const account = createGrudge({ holderId: partner.id, subjectId: id,
            cause: 'violated', severity: 'grave', onDay: 0, description: 'The offered settlement.' });
        writeOneObligation(game.db, account);
        game.atHand = world;
        const suitor = repos.cultivators.getById(id)!;
        expect(suitor.standingIn, 'the live sheet retained the proposed-to area').toBe(partnerArea);
        expect(game.worldPlaceOf(suitor), 'the live sheet retained the proposed-to place').toBe(place.id);
        expect(game.present(suitor).map(person => person.id),
            'the match is put to the named person in their actual area').toContain(partner.id);
        const attempted = await withTheAttemptLanding('propose', () => game.proposeAMatch(
            repos.runs.getActiveRun(id)!, suitor, 'normal',
            partner.name, 'protection', 'propose', undefined,
            `I offer this match to settle the account with ${partner.name}`
        ));
        // The forced decision is a receipt from the resolver, not a promise
        // made by the helper. If the scene cannot reach the person, this makes
        // that missing precondition visible before a later ledger assertion.
        expect(attempted.forced.reaches).toContain('an_approach_to_somebody');
        expect(attempted.forced.landed).toContain('an_approach_to_somebody');
        const decision = attempted.result.calls.find(call => call.name === 'engine.whatAHouseWouldTakeForAMatch');
        expect(decision, `the match did not reach a house decision: ${attempted.result.facts.structure.join(' ')}`)
            .toBeDefined();
        expect(decision!.ok, decision!.summary).toBe(true);
        expect(decision!.summary).toMatch(/attempt (taken|turned)/);
        const held = ledgerAbout(game.db, id);
        const oath = held.find(r => r.status === 'open' && r.cause === 'marriage_pact');
        expect(oath, 'the accepted settlement left no binding').toBeTruthy();
        expect(oath!.severity).toBe(account.severity);
        expect(oath!.tags).toContain(`closed:${account.id}`);
        expect(held.find(r => r.id === account.id)!.status).not.toBe('open');
        const declined = await game.act(`I decline the match with ${partner.name}`);
        const afterwards = ledgerAbout(game.db, id);
        const declineEvidence = JSON.stringify({
            calls: declined.toolCalls,
            narration: declined.narration,
            state: declined.state,
            current: repos.cultivators.getById(id),
            present: game.present(repos.cultivators.getById(id)!).map(person => ({ id: person.id, name: person.name })),
            partner: game.atHand?.npcs.find(person => person.id === partner.id)
        });
        expect(afterwards.find(r => r.id === account.id)!.status, declineEvidence).toBe('open');
        expect(afterwards.some(r => r.status === 'open' && r.cause === 'broken_oath'), declineEvidence).toBe(true);
    }, 120000);
});
