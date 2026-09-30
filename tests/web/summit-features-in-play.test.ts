/**
 * Six documented summit features had no played consumers. These arrange bodies and ground,
 * then type the player's sentences. World and run seeds are both pinned. The assertions
 * cover harm, clocks, circulation, visible works, the Lid, and actual possession transfers.
 */
import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { REALM_TIERS } from '../../src/engine/cultivation/realms';
import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import { SITES } from '../../src/data/cultivation/inheritance-trials';
import { ARTIFACTS } from '../../src/data/cultivation/artifacts';
import { addToPouch } from '../../src/server/consolidated/cultivation-support';
import { makeLocation } from '../../src/engine/world/locations';
import { setRealm } from '../../src/engine/world/npc-state';
import { immortalHoldings } from '../../src/engine/world/immortal-medicine';
import { buildRegister } from '../../src/web/register';
import { makeObject, transferPossession } from '../../src/engine/world/possessions';

const rung = (key: string) => REALM_TIERS.find(t => t.key === key)!.ordinalStart;
const fire = TECHNIQUES.find(t => t.element === 'fire' && t.category === 'attack')!;

async function arranged(seed: string, ordinal: number) {
    const h = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await h.game.newRun('Traveller');
    h.repos.cultivators.update(cultivator.id, { realmOrdinal: ordinal, spiritRoot: 'single_fire',
        knownTechniques: [fire.id], hp: 10000, maxHp: 10000, qi: 10000, maxQi: 10000 });
    h.repos.techniques.learn(cultivator.id, fire.id, 1);
    await h.game.act('I look around');
    const world = h.game.atHand!;
    return { ...h, world, id: cultivator.id };
}

describe('summit capabilities in play', () => {
    it('a tribulation body reduces the harm in a fight across played rounds', async () => {
        const h = await arranged('trib-fight', rung('tribulation_transcendence'));
        const me = h.game.currentRun().cultivator;
        const present = h.game.present(me)[0]!;
        const at = h.world.npcs.findIndex(n => n.id === present.id);
        const opponent = setRealm(h.world.npcs[at]!, me.realmOrdinal, h.world.currentDay);
        opponent.cultivation.techniqueIds = [fire.id];
        h.world.npcs[at] = opponent;
        h.game.theWorldMoved();
        const opened = await h.game.act('I attack someone of my own rank');
        expect(opened.toolCalls.some(c => c.name === 'combat.round')).toBe(true);
        expect(opened.narration).toContain('tribulation body reduced');
        const next = await h.game.act('I let him hit me');
        expect(next.narration).toContain('tribulation body reduced');
    }, 120000);

    it('the imperfect elemental stay expires and hands the player back the turn', async () => {
        const h = await arranged('elemental-clock', rung('tribulation_transcendence'));
        const ground = makeLocation({ id: 'fixture-elemental-ground', name: 'Ember Basin', kind: 'wilds',
            hazards: ['fire'], thresholds: { entry: 0, survival: 45, operational: 45, mastery: 45 } });
        h.world.locations.push(ground);
        h.repos.cultivators.update(h.id, { location: ground.name });
        h.repos.cultivators.addInjury(h.id, { severity: 'crippling', source: 'failed_breakthrough',
            description: 'The tribulation body did not set.', sustainedOnTurn: 0, woundType: 'imperfect-tribulation-body' });
        h.game.theWorldMoved();
        expect((await h.game.act('I look around')).narration).toContain('1 days of tolerance');
        const sat = await h.game.act('I seclude for 10 days anyway');
        expect(sat.narration).toMatch(/tolerance|Ember Basin/);
        expect(h.game.currentRun().run.elapsedDays).toBeLessThan(10);
        expect(h.game.currentRun().cultivator.hp).toBeLessThan(10000);
    }, 120000);

    it('matching Grand presence changes practice and leaves a work on the ground', async () => {
        const h = await arranged('grand-work', rung('grand_ascension'));
        const me = h.game.currentRun().cultivator;
        const person = h.game.present(me)[0]!;
        const at = h.world.npcs.findIndex(n => n.id === person.id);
        h.world.npcs[at] = setRealm(h.world.npcs[at]!, me.realmOrdinal, h.world.currentDay);
        h.world.npcs[at]!.cultivation.techniqueIds = [fire.id];
        h.game.theWorldMoved();
        expect(h.game.rateTermsFor(me).locationBonus).toBeGreaterThan(1);
        expect((await h.game.act('I look around')).narration).toContain('matching element');
        const made = await h.game.act('I craft an elemental work');
        expect(made.narration).toContain('remains after you leave');
        const work = h.world.objects.find(o => o.ownerId === h.id && o.tags.includes('elemental-work'))!;
        expect(work.locationId).toBe(h.game.worldPlaceOf(me));
        expect(work.possessorId).toBeNull();
        expect(work.data.expiresOnDay).toBeNull();
    }, 120000);

    it('lesser practice is suppressed and perception reaches the Lid only at the right realm', async () => {
        const h = await arranged('presence-lid', rung('foundation_establishment'));
        const me = h.game.currentRun().cultivator;
        const person = h.game.present(me)[0]!;
        const at = h.world.npcs.findIndex(n => n.id === person.id);
        h.world.npcs[at] = setRealm(h.world.npcs[at]!, rung('deity_transformation'), h.world.currentDay);
        h.game.theWorldMoved();
        expect(h.game.rateTermsFor(me).locationBonus).toBeLessThan(1);
        expect((await h.game.act('I look around')).narration).toContain('slows your circulation');
        expect((await h.game.act('I look at the Lid')).narration).toContain('does not reach');
        h.repos.cultivators.update(h.id, { realmOrdinal: rung('grand_ascension') });
        expect((await h.game.act('I look at the Lid')).narration).toContain('Lid and its seams');
    }, 120000);

    it('a carried above-ceiling artifact takes its holder through the Lid', async () => {
        const h = await arranged('forced-lid', 1);
        const object = ARTIFACTS.find(o => (o.power ?? 0) > 45)!;
        addToPouch(h.db, h.id, object.id, 'artifact', 1);
        const result = await h.game.act('I look around');
        expect(result.narration).toContain('carried you through the Lid');
        expect(h.game.currentRun().cultivator.alive).toBe(false);
        const leftAt = h.world.objects.find(o => o.id === object.id)?.locationId;
        expect(h.world.locations.find(l => l.id === leftAt)?.layer).toBe('immortal');
    }, 120000);

    it('taking a grave moves a dose once, and swallowing spends that same dose', async () => {
        const h = await arranged('grave-dose', rung('foundation_establishment') - 1);
        const site = SITES.find(s => s.kind !== 'trial' && s.interior.contents.some(c => c.immortalItemId))!;
        const dose = h.world.objects.find(o => o.data.siteId === site.id)!;
        h.game.knowledge.learn({ holderId: h.id, kind: 'place', id: site.id, name: site.name,
            onDay: 0, sourceKind: 'witnessed', stage: 'known' });
        h.game.sites.write(h.game.currentRun().run.id, site, 0, { enteredOnDay: 0 });
        const taken = await h.game.act('I take the contents');
        expect(taken.toolCalls.some(c => c.name === 'engine.possessions'), taken.narration).toBe(true);
        expect(h.world.objects.find(o => o.id === dose.id)?.possessorId).toBe(h.id);
        const swallowed = await h.game.act(`I swallow the ${dose.name}`);
        expect(swallowed.narration).toContain('without an attempt and without a roll');
        expect(h.game.currentRun().cultivator.realmOrdinal).toBe(rung('foundation_establishment'));
        expect(h.world.objects.find(o => o.id === dose.id)?.data.spent).toBe(true);
        expect(h.world.objects.filter(o => o.data.siteId === site.id && o.data.spent !== true)).toHaveLength(0);
    }, 120000);

    it('a rated manual stays below, while a tracked artifact forces a crossing during a fight', async () => {
        const h = await arranged('tracked-forced-lid', 1);
        const art = ARTIFACTS.find(o => (o.power ?? 0) > 45)!;
        h.world.objects.push(makeObject({ id: 'fixture-high-manual', name: 'a rated manual', kind: 'manual',
            power: art.power, possessorId: h.id }));
        h.game.theWorldMoved();
        await h.game.act('I look around');
        expect(h.game.currentRun().cultivator.alive).toBe(true);
        const opened = await h.game.act('I attack someone of my own rank');
        expect(opened.toolCalls.some(c => c.name === 'combat.round')).toBe(true);
        h.world.objects.push(makeObject({ id: 'fixture-high-artifact', name: art.name, kind: 'artifact',
            power: art.power, possessorId: h.id }));
        h.game.theWorldMoved();
        const crossed = await h.game.act('I let him hit me');
        expect(crossed.narration).toContain('carried you through the Lid');
        expect(h.game.currentRun().cultivator.alive).toBe(false);
    }, 120000);

    it('a house and its register lose the singular medicine when it is transferred', async () => {
        const h = await arranged('holding-count', 1);
        const dose = h.world.objects.find(o => o.tags.includes('immortal-medicine') && o.possessorId)!;
        const holder = dose.possessorId!;
        const before = immortalHoldings(h.world, holder).find(r => r.itemId === dose.data.medicineId)!.count;
        const at = h.world.objects.findIndex(o => o.id === dose.id);
        h.world.objects[at] = transferPossession(dose, { toHolderId: h.id, toHolderName: 'Traveller', onDay: 0,
            how: 'gifted', source: holder, transfersOwnership: true });
        expect(immortalHoldings(h.world, holder).find(r => r.itemId === dose.data.medicineId)!.count).toBe(before - 1);
        expect(buildRegister(h.world).holdings.find(r => r.factionId === holder && r.itemId === dose.data.medicineId)?.count)
            .toBe(before - 1);
    }, 120000);
});
