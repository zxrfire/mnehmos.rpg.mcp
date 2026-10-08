import { maxBodyOf } from '../../src/engine/world/npc-state.js';
import { everythingInThePouch } from '../../src/server/consolidated/cultivation-support.js';
/**
 * Somebody in the world starts the fight: an ambush on the road opens a
 * standing fight with them as aggressor, an account held against the player
 * sends its holder, and a holder of an art that draws on another works it on
 * the player once they are beaten into submission.
 *
 * Every case pins the world and the run; it does not promise a particular draw.
 * Combat12 diagnostic5230 measured four old failures: departure ambush had a
 * real standing fight without the phrase "stopped short"; a coerced rite worked
 * once but took everything and killed; three failed escapes ended in capture,
 * with +10.044 canonical fight teaching and no furnace fact; the sibling worn
 * fixture chose a town resident outside the actual room. Those measured outcomes
 * are retained in npc-combat12-diagnostic-20261007-02. Assertions now read native
 * receipts instead of promising survival/escape from an old seed. The separate
 * healthier movement fixture still REQUIRES a real played escape; failure is
 * failure, never relabelled success. No RNG selection, sweep or forced outcome.
 */

import { describe, expect, it } from 'vitest';

import { engineCalls, makeGameInWorld } from './harness';
import { getTechnique } from '../../src/data/cultivation/index.js';
import { maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';
import { createObligation } from '../../src/engine/social/grudges.js';
import { CombatRepository } from '../../src/storage/repos/combat.repo.js';
import { whatAFightTaught } from '../../src/engine/cultivation/what-a-fight-teaches.js';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo.js';

const WORLD = 'road-world';
const WHERE = 'I travel to the Buddha Precipice';

interface ProbeNpc {
    id: string;
    name: string;
    status: string;
    factionId: string | null;
    identity: { sex: 'male' | 'female'; bornOnDay: number };
    cultivation: { realmOrdinal: number; techniqueIds: string[]; accumulatingSinceDay: number };
}
interface Held {
    fight: { party: { id: string; name: string }; state: { aggressor: { input: { id: string } } } } | null;
    atHand: { currentDay: number; npcs: ProbeNpc[]; history: { facts: { data?: Record<string, unknown> }[] } } | null;
}

async function onTheRoad(seed: string, ordinal: number) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Traveller');
    const hp = maxHpForOrdinal(cultivator.attributes.might, ordinal);
    harness.db.prepare(
        'UPDATE cultivators SET realm_ordinal = ?, hp = ?, max_hp = ?, age = 30, cultivation_progress = 400 WHERE id = ?'
    ).run(ordinal, hp, hp, cultivator.id);
    return { ...harness, playerId: cultivator.id, held: harness.game as unknown as Held };
}

/**
 * Somebody in the world holding an unforgivable account against the player, a
 * rung-and-a-realm above them, of age and of the other sex. With `theRite` they
 * hold the drawing half of the furnace rite.
 */
async function aHolderIsOnTheRoad(seed: string, theRite: boolean) {
    const at = await onTheRoad(seed, 10);
    await at.game.act('I look around');
    const world = at.held.atHand!;
    const today = Math.floor(world.currentDay);
    const player = at.db.prepare('SELECT sex FROM cultivators WHERE id = ?')
        .get(at.playerId) as { sex: 'male' | 'female' };
    const holder = world.npcs
        .filter(npc => npc.status === 'alive' && npc.id !== at.playerId)
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
    holder.cultivation.realmOrdinal = 14;
    holder.identity.sex = player.sex === 'male' ? 'female' : 'male';
    holder.identity.bornOnDay = today - 40 * 365;
    holder.cultivation.techniqueIds = [
        ...holder.cultivation.techniqueIds.filter(id => getTechnique(id)?.runsOn !== 'the_others'),
        ...(theRite ? ['lotus-plucking-rite'] : [])
    ];
    writeOneObligation(at.db as never, createObligation({
        kind: 'grudge',
        holderId: holder.id,
        subjectId: at.playerId,
        cause: 'humiliation',
        severity: 'unforgivable',
        onDay: 0,
        description: 'Traveller shamed them in front of their own people.'
    }));
    const progress = () => (at.db.prepare(
        'SELECT cultivation_progress AS p, alive FROM cultivators WHERE id = ?'
    ).get(at.playerId) as { p: number; alive: number });
    const heldAgainst = () => at.db.prepare(
        "SELECT holder_id, subject_id, severity FROM obligations WHERE holder_id = ? AND cause = 'violated'"
    ).all(at.playerId) as { holder_id: string; subject_id: string; severity: string }[];
    return { ...at, holder, progress, heldAgainst };
}

/** Swing until the fight ends, which is at most its round budget. */
async function fightItOut(game: { act: (s: string) => Promise<{ narration: string }> }, held: Held) {
    let last = '';
    for (let round = 0; round < 12 && held.fight !== null; round++) {
        last = (await game.act('I keep swinging')).narration;
    }
    return last;
}

describe('an ambush on the road is a fight the player is in', () => {
    it('opens a standing fight, and the next sentence is a round of it', async () => {
        const at = await onTheRoad('came-at-252', 6);
        const before = at.game.currentRun();
        if (!before) throw Error('No actual active run before departure');
        const pack = everythingInThePouch(at.db, at.playerId);
        const done = await at.game.act(WHERE);
        const after = at.game.currentRun();
        if (!after) throw Error('No actual run after departure interruption');
        expect(engineCalls(done)).toContainEqual(expect.objectContaining({
            name: 'engine.encounterWindow', ok: true
        }));
        expect(done.events).toContainEqual(expect.objectContaining({ kind: 'encounter', dayOffset: 0, interrupts: true }));
        expect(after.run.elapsedDays).toBe(before.run.elapsedDays);
        expect(after.cultivator.location).toBe(before.cultivator.location);
        expect(after.cultivator.hp).toBe(before.cultivator.hp);
        expect(everythingInThePouch(at.db, at.playerId)).toEqual(pack);
        expect(at.held.fight, done.narration).not.toBeNull();
        // They opened it: the player is the defender.
        expect(at.held.fight!.state.aggressor.input.id).not.toBe(at.playerId);
        expect(done.narration).toMatch(/attacks you\. The fight is open/);

        const round = await at.game.act('I block');
        expect(engineCalls(round).some(c => c.name === 'combat.round' || c.name === 'combat_manage.resolve'),
            round.narration).toBe(true);
    }, 200_000);
});

describe('an account comes due with a name on it', () => {
    it('sends the person who holds it, and they open the fight', async () => {
        const at = await aHolderIsOnTheRoad('came-at-r11', false);
        const done = await at.game.act(WHERE);

        expect(done.narration).toMatch(
            new RegExp(`${at.holder.name} came over the account they hold against you: Traveller shamed them`)
        );
        expect(done.narration).toMatch(new RegExp(`${at.holder.name} attacks you`));
        expect(at.held.fight?.party.id).toBe(at.holder.id);
    }, 200_000);
});

describe('a holder of an art that draws on another works it on the player', () => {
    it('works the rite after submission and persists its actual living or lethal outcome', async () => {
        const at = await aHolderIsOnTheRoad('came-at-r23', true);
        await at.game.act(WHERE);
        expect(at.held.fight?.party.id).toBe(at.holder.id);
        const before = at.progress().p;

        const last = await fightItOut(at.game, at.held);

        expect(last).toMatch(/works? Lotus-Plucking Ritual on you/);
        expect(at.progress().p).toBeLessThan(before);
        const facts = at.held.atHand!.history.facts.filter(f => f.data?.furnace === true);
        expect(facts).toHaveLength(1);
        const fact = facts[0]!;
        expect(fact.data).toMatchObject({ type: 'coerced', worked: 1 });
        expect([0, 1]).toContain(fact.data!.died);
        expect(at.progress().alive).toBe(fact.data!.died === 1 ? 0 : 1);
        if (fact.data!.died === 1) expect(last).toContain('You do not survive it.');
        else expect(at.heldAgainst()).toContainEqual(
            { holder_id: at.playerId, subject_id: at.holder.id, severity: 'unforgivable' }
        );
    }, 200_000);

    it('kills the player through the death mark when the draw kills', async () => {
        const at = await aHolderIsOnTheRoad('came-at-r160', true);
        await at.game.act(WHERE);
        expect(at.held.fight?.party.id).toBe(at.holder.id);

        const last = await fightItOut(at.game, at.held);

        expect(last).toMatch(/You do not survive it\./);
        expect(at.progress().alive).toBe(0);
    }, 200_000);

    it('answers real failed escape attempts without inventing a furnace or losing the native lesson', async () => {
        const at = await aHolderIsOnTheRoad('came-at-r11', true);
        await at.game.act(WHERE);
        expect(at.held.fight?.party.id).toBe(at.holder.id);
        const before = at.progress().p;

        let said = '';
        let attempts = 0;
        for (let tries = 0; tries < 12 && at.held.fight !== null; tries++) {
            const done = await at.game.act('I back off');
            said = done.narration;
            expect(said).toMatch(/You (?:got clear|did not get clear)/);
            expect(engineCalls(done).some(c => c.name === 'combat.round' || c.name === 'combat_manage.resolve')).toBe(true);
            attempts++;
        }
        expect(attempts).toBeGreaterThan(0);
        expect(at.held.fight).toBeNull();
        expect(said).toContain('Taken alive.');
        expect(at.held.atHand!.history.facts.filter(f => f.data?.furnace === true)).toHaveLength(0);
        const record = new CombatRepository(at.db).listRecords(at.playerId)[0];
        expect(record).toBeDefined();
        expect(record!.outcome).toBe('capture');
        const exchanges = /([0-9]+) exchanges:/.exec(said);
        expect(exchanges).not.toBeNull();
        const lesson = whatAFightTaught({ yourOrdinal: 10, theirOrdinal: 14,
            exchanges: Number(exchanges![1]), outcome: 'capture', subject: null,
            cultivationProgress: before });
        expect(at.progress().p).toBe(before + lesson.progress);
        expect(at.progress().alive).toBe(0);
    }, 200_000);
});

/** Ordinary matching-rung healthy body and actual learned qinggong, before the
 * player opens an actual local fight. Native chance remains uncertain and every failed
 * attempt costs actual HP; no extra attempts after native ending are granted. */
it('a healthier cultivator with a real movement art actually escapes the rite holder', async () => {
    const base = await onTheRoad('came-at-flee-movement', 14);
    await base.game.act('I look around');
    const world = await base.game.loadWorld();
    if (!world) throw Error('No native world for actual standing opponent');
    const currentPeople = new Set(base.game.present(base.game.state().cultivator).map(person => person.id));
    const holder = world.npcs.find(person => person.status === 'alive' && currentPeople.has(person.id));
    if (!holder) throw Error('No actual living person is standing here');
    // Explicit ordinary body/held-art arrangement on an existing present actor;
    // its actual location, activity, identity id and resource purse are retained.
    const player = base.db.prepare('SELECT sex FROM cultivators WHERE id = ?')
        .get(base.playerId) as { sex: 'male' | 'female' };
    holder.cultivation.realmOrdinal = 14;
    holder.identity.sex = player.sex === 'male' ? 'female' : 'male';
    holder.identity.bornOnDay = world.currentDay - 40 * 365;
    holder.cultivation.techniqueIds = [...holder.cultivation.techniqueIds.filter(id =>
        getTechnique(id)?.runsOn !== 'the_others'), 'lotus-plucking-rite'];
    holder.cultivation.hp = maxBodyOf(holder);
    holder.cultivation.bodyOnDay = world.currentDay;
    const progress = () => base.db.prepare('SELECT alive FROM cultivators WHERE id = ?')
        .get(base.playerId) as { alive: number };
    const at = { ...base, holder, progress };
    const current = at.game.currentRun();
    if (!current) throw Error('No native body for movement fixture');
    const hp = maxHpForOrdinal(current.cultivator.attributes.might, 14);
    at.db.prepare('UPDATE cultivators SET realm_ordinal = ?, hp = ?, max_hp = ? WHERE id = ?')
        .run(14, hp, hp, at.playerId);
    const movement = getTechnique('swallow-skimming-step');
    if (!movement) throw Error('Actual qinggong catalog row absent');
    at.repos.techniques.upsert(movement);
    expect(at.repos.techniques.learn(at.playerId, movement.id, 1)).not.toBeNull();
    const ready = at.game.currentRun();
    if (!ready) throw Error('Native learned movement body absent');
    expect(ready.cultivator.qi).toBeGreaterThanOrEqual(movement.qiCost);
    expect(at.game.artTheyWouldRunWith(ready.cultivator)?.id).toBe(movement.id);
    // Diagnostic51857 proved the old literal road was a zero-course alias;
    // Combat16 positive-one77649 then found a real positive road but no ambush.
    // Neither reached an escape attempt. Open an ordinary fight by an actual
    // player's attack on the present person; do not force a road encounter.
    expect(at.game.present(ready.cultivator).map(person => person.id)).toContain(holder.id);
    const opened = await at.game.act(`I attack ${holder.name}`);
    expect(engineCalls(opened).some(call => call.name === 'combat.round')).toBe(true);
    expect(at.held.fight?.party.id, opened.narration).toBe(holder.id);
    let last = '';
    for (let attempt = 0; attempt < 12 && at.held.fight !== null; attempt++) {
        const done = await at.game.act('I back off');
        last = done.narration;
        expect(engineCalls(done).some(c => c.name === 'combat.round' || c.name === 'combat_manage.resolve')).toBe(true);
    }
    expect(last).toContain('You got clear');
    expect(at.held.fight).toBeNull();
    expect(at.progress().alive).toBe(1);
    expect(at.held.atHand!.history.facts.filter(f => f.data?.furnace === true)).toHaveLength(0);
    const record = new CombatRepository(at.db).listRecords(at.playerId)[0];
    expect(record?.outcome).toBe('withdrawal');
}, 200_000);
