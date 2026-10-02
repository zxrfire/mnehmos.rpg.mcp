/**
 * ADMIN could label a cultivator "girl transformed from a fox" without creating
 * a female changed beast, and a house name never put that person on its roll.
 * Trait requests now create ordinary world NPCs. Bare ordinal requests keep the
 * existing encounter; both readers are checked through ADMIN and persisted state.
 * Unknown houses, impossible bodies and absent rungs must leave the world alone.
 * A full area must not hide a local spawn. The operator stands with the new
 * person in the engine's assigned area, with at most three people present.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider, type Harness } from './harness.js';
import { worldForRun, forgetWorld } from '../../src/server/state/cultivation-world.js';
import { whereSomebodyStandsOnAHousesRoll } from '../../src/engine/world/where-somebody-stands-on-a-houses-roll.js';
import { npcsWhereTheyStand } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { readsAsSomebody } from '../../src/engine/world/hunting-a-spirit-beast.js';
import { whatItIsNow } from '../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { theSpeciesTheyMeant } from '../../src/engine/world/a-beast-that-took-a-shape-is-somebody.js';
import { howTheyHoldWhatTheyHave, openHandednessOf } from '../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { SECTS } from '../../src/data/cultivation/sects.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation.js';
import { carriesATokenAt, thisHouseCanIssue, tokenIdFor, lampIdFor } from '../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';

let adminBefore: string | undefined;
beforeEach(() => { adminBefore = process.env.ADMIN_MODE; process.env.ADMIN_MODE = 'true'; });
afterEach(() => {
    if (adminBefore === undefined) delete process.env.ADMIN_MODE;
    else process.env.ADMIN_MODE = adminBefore;
});

async function operating(provider?: ScriptedProvider): Promise<Harness> {
    const harness = await makeGameInWorld({ seed: 'admin-traits', worldSeed: 'admin-traits-world', provider });
    await harness.game.newRun('Op');
    return harness;
}

async function spawned(h: Harness, line: string) {
    const world = await worldForRun(h.repos.runs.getActiveRun()!);
    const before = new Set(world.npcs.map(n => n.id));
    const result = await h.game.act(line);
    const added = world.npcs.filter(n => !before.has(n.id));
    expect(added, result.narration).toHaveLength(1);
    const npc = added[0]!;
    expect(h.repos.cultivators.getById(npc.id)).toBeNull();
    const player = h.game.state().cultivator;
    const place = worldLocationFor(world, player.location)!;
    expect(npcsWhereTheyStand(world, place, player.standingIn, player).map(n => n.id)).toContain(npc.id);
    expect(h.game.present(player).map(n => n.id)).toContain(npc.id);
    expect(h.game.present(player).length).toBeLessThanOrEqual(3);
    // A reload reads the same row; a transient scene card is insufficient.
    forgetWorld(world.id);
    expect((await worldForRun(h.repos.runs.getActiveRun()!)).npcs.find(n => n.id === npc.id)).toEqual(npc);
    return { npc, result, world };
}

describe('ADMIN spawn reads traits into real people', () => {
    it('keeps a bare ordinal equivalent to the existing explicit command', async () => {
        const first = await operating();
        const world = await worldForRun(first.repos.runs.getActiveRun()!);
        const before = world.npcs.length;
        const result = await first.game.act('ADMIN: spawn an encounter ordinal 29');
        expect(result.narration).toMatch(/encounter spawned/i);
        expect(world.npcs).toHaveLength(before);
        const bare = first.repos.cultivators.list().find(c => c.kind === 'enemy')!;
        const second = await operating();
        await second.game.act('ADMIN spawn_encounter ordinal=29');
        const explicit = second.repos.cultivators.list().find(c => c.kind === 'enemy')!;
        expect({ name: bare.name, ordinal: bare.realmOrdinal, root: bare.spiritRoot, attributes: bare.attributes })
            .toEqual({ name: explicit.name, ordinal: explicit.realmOrdinal, root: explicit.spiritRoot, attributes: explicit.attributes });
        expect(bare.realmOrdinal).toBe(29);
    });

    it('creates the ordinal 29 girl transformed from a fox, without a model', async () => {
        const h = await operating();
        const { npc, result } = await spawned(h, 'ADMIN: spawn an encounter of an ordinal 29 girl transformed from a fox');
        expect(npc.identity.sex).toBe('female');
        expect(npc.cultivation.realmOrdinal).toBe(29);
        expect(npc.identity.bloodline).toEqual({ speciesId: theSpeciesTheyMeant('fox')!.id, tier: 'final' });
        expect(readsAsSomebody(whatItIsNow(npc)!.asItStands)).toBe(true);
        expect(result.narration).toMatch(/Sex: female/);
        expect(result.narration).not.toMatch(/Words not used/);
    });

    it('enters a male Hollow Court outer disciple on the real roll', async () => {
        const h = await operating();
        const { npc, world, result } = await spawned(h, 'ADMIN: spawn an encounter of a male hollow court outer disciple');
        expect(npc.identity.sex).toBe('male');
        const house = SECTS.find(s => s.id === 'sect-hollow-court')!;
        const roll = whereSomebodyStandsOnAHousesRoll({ world, rollRowFor: id => h.repos.sects.getMembership(id) }, npc.id);
        expect(roll?.factionId).toBe(house.id);
        expect(roll?.rungName.toLowerCase()).toBe('outer disciple');
        expect(world.objects.some(o => o.possessorId === npc.id && o.ownerId === house.id && o.tags.includes('uniform'))).toBe(true);
        // A token and lamp follow the same house and rung gates as seeded disciples.
        const canIssue = carriesATokenAt(roll!.rankIndex) && thisHouseCanIssue(world.npcs
            .filter(n => n.status === 'alive' && n.factionId === house.id).map(n => n.cultivation.realmOrdinal));
        expect(world.objects.some(o => o.id === tokenIdFor(npc.id))).toBe(canIssue);
        expect(world.objects.some(o => o.id === lampIdFor(npc.id))).toBe(canIssue);
        expect(result.narration).toContain(`House: ${house.name}`);
        expect(result.narration).not.toMatch(/Words not used/);
        expect(new KnowledgeGate(h.db).isAwareOf(h.game.state().cultivator.id, 'cultivator', npc.id)).toBe(false);
    });

    it('applies the configured model JSON and exposes the supported schema', async () => {
        const provider = new ScriptedProvider({ narrations: ['', JSON.stringify({
            ordinal: 29, sex: 'female', age: 37, species: 'fox', name: 'Su Yaoling', temperament: 'generous'
        }), ''] });
        const h = await operating(provider);
        const { npc } = await spawned(h, 'ADMIN spawn an encounter ordinal 29 of a generous vixen named Su Yaoling aged 37');
        expect(npc.name).toBe('Su Yaoling');
        expect(npc.identity.sex).toBe('female');
        expect(npc.cultivation.realmOrdinal).toBe(29);
        expect(npc.identity.bloodline?.speciesId).toBe(theSpeciesTheyMeant('fox')!.id);
        expect((npc.updatedOnDay - npc.identity.bornOnDay) / DAYS_PER_YEAR).toBe(37);
        expect(openHandednessOf(npc.id)).toBeGreaterThan(0);
        expect(howTheyHoldWhatTheyHave(openHandednessOf(npc.id))).toBeTruthy();
        const read = provider.calls.find(c => c.messages[0]?.content.startsWith('You read an ADMIN spawn'))!;
        expect(read.model).toBe('test-model');
        expect(read.messages[0]!.content).toContain('"additionalProperties":false');
        expect(read.messages[1]!.content).toContain('vixen');
    });

    it('states the words the engine did not use', async () => {
        const h = await operating();
        const { npc, result } = await spawned(h, 'ADMIN spawn an encounter ordinal 29 female mysterious');
        expect(npc.identity.sex).toBe('female');
        expect(result.narration).toMatch(/Words not used: mysterious\./);
    });

    it('falls back to supported words when the model returns malformed JSON', async () => {
        const h = await operating(new ScriptedProvider({ narrations: ['', '{bad json', ''] }));
        const { npc } = await spawned(h, 'ADMIN spawn an encounter ordinal 29 girl transformed from a fox');
        expect(npc.identity.sex).toBe('female');
        expect(npc.identity.bloodline?.speciesId).toBe(theSpeciesTheyMeant('fox')!.id);
    });

    it('gives a disciple the robes, token and lamp their house issues', async () => {
        const h = await operating();
        const world = await worldForRun(h.repos.runs.getActiveRun()!);
        const house = world.factions.find(f => f.ranks[1]?.toLowerCase() === 'outer disciple'
            && thisHouseCanIssue(world.npcs.filter(n => n.status === 'alive' && n.factionId === f.id)
                .map(n => n.cultivation.realmOrdinal)))!;
        expect(house).toBeTruthy();
        const { npc, world: after } = await spawned(h, `ADMIN spawn an encounter ordinal 10 female ${house.name} ${house.ranks[1]}`);
        expect(after.objects.find(o => o.id === tokenIdFor(npc.id))?.possessorId).toBe(npc.id);
        expect(after.objects.find(o => o.id === lampIdFor(npc.id))?.ownerId).toBe(house.id);
    });

    it('keeps an age from becoming an omitted house-member ordinal', async () => {
        const h = await operating();
        const { npc } = await spawned(h, 'ADMIN spawn an encounter male hollow court outer disciple aged 900');
        expect(npc.cultivation.realmOrdinal).toBeLessThan(900);
        expect((npc.updatedOnDay - npc.identity.bornOnDay) / DAYS_PER_YEAR).toBe(900);
    });

    it('accepts trait prose before an explicit ordinal pair', async () => {
        const h = await operating();
        const { npc } = await spawned(h, 'ADMIN spawn an encounter female ordinal=29');
        expect(npc.identity.sex).toBe('female');
        expect(npc.cultivation.realmOrdinal).toBe(29);
    });

    it.each([
        ['a male Unwritten Granite Court outer disciple', /No living house.*Unwritten Granite Court/i],
        ['ordinal 29 male Hollow Court core disciple', /has no rung.*Core Disciple/i],
        ['ordinal 999 girl', /ordinal/i],
        ['ordinal 12 girl transformed from a fox', /human form.*29/i],
        ['ordinal 0 female aged 5000', /lifespan/i]
    ])('refuses %s and creates nothing', async (spec, refusal) => {
        const h = await operating();
        const world = await worldForRun(h.repos.runs.getActiveRun()!);
        const before = world.npcs.length;
        const cultivatorsBefore = h.repos.cultivators.list().length;
        const result = await h.game.act(`ADMIN spawn an encounter of ${spec}`);
        expect(result.narration).toMatch(/refused/i);
        expect(result.narration).toMatch(refusal);
        expect(world.npcs).toHaveLength(before);
        expect(h.repos.cultivators.list()).toHaveLength(cultivatorsBefore);
    });
});
