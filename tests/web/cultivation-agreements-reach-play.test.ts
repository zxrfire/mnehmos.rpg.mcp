import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
/**
 * The feature audit found willing rites, primal essence, demonic victim pricing,
 * and beast contracts described without live effects. These sentences run through
 * the turn engine and assert the resource, progress, rank, and oath changes.
 * A declined offer moves nothing; a once-only resource cannot pay twice.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, engineCalls } from './harness';
import { getSect, getTechnique } from '../../src/data/cultivation/index.js';
import { BEASTS } from '../../src/data/cultivation/beasts.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { upsertRelationship } from '../../src/engine/world/npc-state.js';
import { primalEssenceOf } from '../../src/engine/world/primal-essence.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import type { GameService } from '../../src/web/turn-engine.js';
import { parseIntent } from '../../src/web/verb-pattern-table.js';

async function room(seed: string) {
    const at = await makeGameInWorld({ seed, worldSeed: 'cultivation-agreements-world', adminMode: true });
    const { cultivator } = await at.game.newRun('Lin Zhaoyi');
    at.db.prepare('UPDATE cultivators SET realm_ordinal = 29, hp = 9000, max_hp = 9000, age = 30, cultivation_progress = 1000 WHERE id = ?')
        .run(cultivator.id);
    await at.game.act('I look around');
    const service = at.game as unknown as GameService;
    const world = service.atHand!;
    const player = at.repos.cultivators.getById(cultivator.id)!;
    const shown = service.present(player);
    const other = world.npcs.find(row => row.id === shown[0]!.id)!;
    other.identity.sex = player.sex === 'male' ? 'female' : 'male';
    other.identity.bornOnDay = world.currentDay - 30 * 365;
    other.cultivation.accumulatingSinceDay = world.currentDay - 2000;
    other.tags = other.tags.filter(tag => tag !== 'primal-essence-spent');
    other.relationships = upsertRelationship(other, { targetId: player.id, targetName: player.name, kind: 'ally', standing: 1, note: 'A trusted ally.' }, world.currentDay).relationships;
    const self = world.npcs.find(row => row.id === player.id)!;
    self.tags = self.tags.filter(tag => tag !== 'primal-essence-spent');
    const live = () => world.npcs.find(row => row.id === other.id)!;
    const progress = () => at.repos.cultivators.getById(player.id)!.cultivationProgress;
    const teach = (id: string) => { at.repos.techniques.upsert(getTechnique(id)!); at.repos.techniques.learn(player.id, id, 0.5); };
    // Choose the offer's own stream before playing, rather than pinning a stranger's name.
    const consent = (stream: string, threshold: number) => {
        const run = at.repos.runs.getActiveRun(player.id)!;
        let candidate = 0;
        while (forStream(run.seed, stream, other.id, candidate).next() >= threshold) candidate++;
        at.db.prepare('UPDATE runs SET turn = ? WHERE id = ?').run(candidate, run.id);
    };
    return { ...at, service, world, player, other, live, progress, teach, consent };
}

describe('offered rites and a personal once-only resource', () => {
    it('accepts a willing subject, drains progress, and consumes primal essence only once', async () => {
        const at = await room('willing-rite');
        at.teach('lotus-plucking-rite');
        at.other.cultivation.techniqueIds = ['lotus-nurturing-canon'];
        at.consent('furnace-offer', 0.8);
        const before = at.progress();
        const since = at.live().cultivation.accumulatingSinceDay;
        const first = await at.game.act(`I ask ${at.other.name} to willingly be my furnace`);
        expect(engineCalls(first).some(call => call.name === 'furnace.useFurnaceTechnique'), first.narration + JSON.stringify(engineCalls(first))).toBe(true);
        expect(at.progress()).toBeGreaterThan(before);
        const firstDrain = at.live().cultivation.accumulatingSinceDay - since;
        expect(firstDrain).toBeGreaterThan(0);
        expect(primalEssenceOf(at.live())).toBeNull();
        expect(primalEssenceOf(at.world.npcs.find(row => row.id === at.player.id)!)).toBeNull();
        at.consent('furnace-offer', 0.8);
        await at.game.act(`I ask ${at.other.name} to willingly be my furnace`);
        expect(at.live().cultivation.accumulatingSinceDay - since - firstDrain).toBe(firstDrain / 2);
        expect(at.db.prepare("SELECT * FROM obligations WHERE cause = 'violated' AND subject_id = ?").all(at.player.id)).toHaveLength(0);
        expect(at.world.history.facts.filter(fact => fact.data.furnace === true).every(fact => fact.data.type === 'offered')).toBe(true);
        const stored = new WorldStateRepository(at.db).loadWorld(at.world.id)!;
        expect(primalEssenceOf(stored.npcs.find(row => row.id === at.other.id)!)).toBeNull();
    }, 200_000);

    it('allows the player to offer their own half to a rite holder', async () => {
        const at = await room('willing-self');
        at.teach('lotus-nurturing-canon');
        at.other.cultivation.techniqueIds = ['lotus-plucking-rite'];
        at.consent('furnace-offer', 0.8);
        const before = at.progress();
        const since = at.live().cultivation.accumulatingSinceDay;
        const result = await at.game.act(`I offer myself as a cultivation furnace to ${at.other.name}`);
        expect(engineCalls(result).some(call => call.name === 'furnace.useFurnaceTechnique'), result.narration + JSON.stringify(engineCalls(result))).toBe(true);
        expect(at.progress()).toBeLessThan(before);
        expect(at.live().cultivation.accumulatingSinceDay).toBeLessThan(since);
        expect(primalEssenceOf(at.world.npcs.find(row => row.id === at.player.id)!)).toBeNull();
    }, 200_000);

    it('a willing marriage consumes the same property before any rite', async () => {
        const at = await room('marriage-primal');
        at.other.factionId = null;
        const result = await withTheAttemptLanding('propose', () => at.game.act(`I offer my protection for a match with ${at.other.name}`));
        expect(engineCalls(result.result).some(call => call.name === 'engine.whatAMatchChanges' && call.ok), result.result.narration).toBe(true);
        expect(primalEssenceOf(at.live())).toBeNull();
        expect(primalEssenceOf(at.world.npcs.find(row => row.id === at.player.id)!)).toBeNull();
    }, 200_000);

    it('a forced marriage after submission also consumes the property', async () => {
        const at = await room('forced-marriage-primal');
        const result = await at.game.act(`I force ${at.other.name} to marry me`);
        expect(engineCalls(result).some(call => call.name === 'marriage.afterSubmission' && call.ok), result.narration).toBe(true);
        expect(at.live().relationships.some(tie => tie.targetId === at.player.id && tie.kind === 'spouse')).toBe(true);
        expect(primalEssenceOf(at.live())).toBeNull();
    }, 200_000);

    it('refuses a willing rite with no spending half without consuming anything', async () => {
        const at = await room('willing-no-half');
        at.teach('lotus-plucking-rite');
        at.other.cultivation.techniqueIds = [];
        const before = at.progress();
        const result = await at.game.act(`I ask ${at.other.name} to willingly be my furnace`);
        expect(engineCalls(result).some(call => call.name === 'furnace.useFurnaceTechnique')).toBe(false);
        expect(at.progress()).toBe(before);
        expect(primalEssenceOf(at.live())).not.toBeNull();
    }, 200_000);
});

describe('a demonic house prices its own surviving victim', () => {
    it('lowers the victim on its roll and opens no revenge account', async () => {
        const at = await room('demonic-victim');
        at.teach('lotus-plucking-rite');
        const house = at.world.factions.find(row => getSect(row.id)?.alignment === 'demonic')!;
        at.other.factionId = house.id;
        at.other.factionRankIndex = 1;
        const run = at.repos.runs.getActiveRun(at.player.id)!;
        let seed = 0;
        while (forStream(`demonic-victim-${seed}`, 'furnace-death', at.other.id, Math.floor(run.elapsedDays)).next() < 0.1) seed++;
        at.db.prepare('UPDATE runs SET seed = ? WHERE id = ?').run(`demonic-victim-${seed}`, run.id);
        const result = await at.game.act(`I make ${at.other.name} my furnace`);
        expect(at.live().status, result.narration).toBe('alive');
        expect(at.live().factionRankIndex).toBe(0);
        expect(at.db.prepare('SELECT * FROM obligations WHERE holder_id = ? AND subject_id = ?').all(house.id, at.player.id)).toHaveLength(0);
        expect(result.narration).toContain('lowers');
    }, 200_000);
});

describe('a beast cultivation agreement is lived after the conversation', () => {
    it('shares qi while cultivating, persists progress, then ends with its penalty', async () => {
        const at = await room('beast-contract');
        at.teach('first-and-last-breath-canon');
        at.other.tags.push(`beast:${BEASTS[0]!.id}`);
        at.other.cultivation.realmOrdinal = 29;
        at.other.locationId = at.service.worldPlaceOf(at.player);
        at.consent('beast-contract-consent', 0.65);
        const agreed = await at.game.act(`I make a beast cultivation contract with ${at.other.name} sharing 25% of my qi`);
        expect(engineCalls(agreed).some(call => call.name === 'beast.agreeContract' && call.ok), agreed.narration + JSON.stringify(engineCalls(agreed))).toBe(true);
        const bond = at.world.obligations.find(row => row.kind === 'oath' && row.subjectId === at.player.id
            && row.tags.includes('beast-cultivation-contract'))!;
        expect(bond.tags).toContain('witnessed');
        const sitting = await at.game.act('I cultivate for 1 day');
        const earned = at.live().cultivation.bondedCultivationDays ?? 0;
        expect(earned, sitting.narration + JSON.stringify(engineCalls(sitting)) + JSON.stringify(at.world.obligations.find(row => row.id === bond.id))).toBeGreaterThan(0);
        await at.game.act('I cultivate for 1 day');
        expect(at.live().cultivation.bondedCultivationDays).toBeGreaterThan(earned);
        const stored: WorldState = new WorldStateRepository(at.db).loadWorld(at.world.id)!;
        expect(stored.npcs.find(row => row.id === at.other.id)!.cultivation.bondedCultivationDays).toBe(at.live().cultivation.bondedCultivationDays);
        const ended = await at.game.act(`I end my beast cultivation contract with ${at.other.name}`);
        expect(engineCalls(ended).some(call => call.name === 'beast.endContract' && call.ok), ended.narration).toBe(true);
        expect(at.world.obligations.find(row => row.id === bond.id)!.status).toBe('settled');
        expect(at.world.obligations.some(row => row.cause === 'broken_oath' && row.subjectId === at.player.id && row.holderId === at.other.id)).toBe(true);
        const retained = at.live().cultivation.bondedCultivationDays;
        await at.game.act('I cultivate for 1 day');
        expect(at.live().cultivation.bondedCultivationDays).toBe(retained);
    }, 200_000);

    it('the share comes out of the cultivator rather than creating extra qi', async () => {
        const gained: number[] = [];
        for (const bonded of [false, true]) {
            const at = await room('beast-share-control');
            at.teach('first-and-last-breath-canon');
            at.other.tags.push(`beast:${BEASTS[0]!.id}`);
            at.other.cultivation.realmOrdinal = 29;
            at.other.locationId = at.service.worldPlaceOf(at.player);
            at.consent('beast-contract-consent', 0.65);
            if (bonded) {
                const agreed = await at.game.act(`I make a beast cultivation contract with ${at.other.name} sharing 25% of my qi`);
                expect(engineCalls(agreed).some(call => call.name === 'beast.agreeContract' && call.ok), agreed.narration).toBe(true);
            } else await at.game.act('I look around');
            const before = at.progress();
            const sitting = await at.game.act('I cultivate for 1 day');
            expect(engineCalls(sitting).some(call => call.ok), sitting.narration).toBe(true);
            gained.push(at.progress() - before);
        }
        expect(gained[0]).toBeGreaterThan(0);
        expect(gained[1]).toBeCloseTo(gained[0]! * 0.75, 6);
    }, 200_000);

    it('a party outgrowing the agreed realm is released without a broken oath', async () => {
        const at = await room('beast-outgrown');
        at.other.tags.push(`beast:${BEASTS[0]!.id}`);
        at.other.cultivation.realmOrdinal = 29;
        at.other.locationId = at.service.worldPlaceOf(at.player);
        at.consent('beast-contract-consent', 0.65);
        const agreed = await at.game.act(`I make a beast cultivation contract with ${at.other.name}`);
        expect(engineCalls(agreed).some(call => call.name === 'beast.agreeContract' && call.ok), agreed.narration).toBe(true);
        at.db.prepare('UPDATE cultivators SET realm_ordinal = 33 WHERE id = ?').run(at.player.id);
        await at.game.act('I look around');
        const bond = at.world.obligations.find(row => row.kind === 'oath' && row.subjectId === at.player.id
            && row.tags.includes('beast-cultivation-contract'))!;
        expect(bond.status).toBe('settled');
        expect(at.world.obligations.some(row => row.cause === 'broken_oath' && row.subjectId === at.player.id)).toBe(false);
    }, 200_000);

    it('routes the explicit agreement sentences', () => {
        expect(parseIntent('I make a beast cultivation contract with Lin Zhaoyi sharing 25% of my qi')).toMatchObject({ action: 'oath', target: 'Lin Zhaoyi', topic: '25' });
        expect(parseIntent('I end my beast cultivation contract with Lin Zhaoyi')).toMatchObject({ action: 'oath', intent: 'end_beast_contract', target: 'Lin Zhaoyi' });
    });
});
