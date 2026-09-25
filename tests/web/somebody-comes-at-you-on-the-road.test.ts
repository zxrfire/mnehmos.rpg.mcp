/**
 * Somebody in the world starts the fight: an ambush on the road opens a
 * standing fight with them as aggressor, an account held against the player
 * sends its holder, and a holder of an art that draws on another works it on
 * the player once they are beaten into submission.
 *
 * Every case pins the world and the run: whether the road stops, and who
 * stops it, is a draw.
 */

import { describe, expect, it } from 'vitest';

import { engineCalls, makeGameInWorld } from './harness';
import { getTechnique } from '../../src/data/cultivation/index.js';
import { maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';
import { createObligation } from '../../src/engine/social/grudges.js';
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
        const done = await at.game.act(WHERE);

        expect(done.narration).toMatch(/stopped short/i);
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
    it('drains the player once they are beaten into submission, and the player holds it', async () => {
        const at = await aHolderIsOnTheRoad('came-at-r23', true);
        await at.game.act(WHERE);
        expect(at.held.fight?.party.id).toBe(at.holder.id);
        const before = at.progress().p;

        const last = await fightItOut(at.game, at.held);

        expect(last).toMatch(new RegExp(`${at.holder.name} works Lotus-Plucking Ritual on you and draws off \\d+ days`));
        expect(at.progress().p).toBeLessThan(before);
        expect(at.progress().alive).toBe(1);
        expect(at.heldAgainst()).toContainEqual(
            { holder_id: at.playerId, subject_id: at.holder.id, severity: 'unforgivable' }
        );
        const fact = at.held.atHand!.history.facts.find(f => f.data?.furnace === true);
        expect(fact, 'no world fact for the rite').toBeDefined();
    }, 200_000);

    it('kills the player through the death mark when the draw kills', async () => {
        const at = await aHolderIsOnTheRoad('came-at-r160', true);
        await at.game.act(WHERE);
        expect(at.held.fight?.party.id).toBe(at.holder.id);

        const last = await fightItOut(at.game, at.held);

        expect(last).toMatch(/You do not survive it\./);
        expect(at.progress().alive).toBe(0);
    }, 200_000);

    it('lets the player get away before it comes to that', async () => {
        const at = await aHolderIsOnTheRoad('came-at-r11', true);
        await at.game.act(WHERE);
        expect(at.held.fight?.party.id).toBe(at.holder.id);
        const before = at.progress().p;

        let said = '';
        for (let tries = 0; tries < 12 && at.held.fight !== null; tries++) {
            said = (await at.game.act('I back off')).narration;
        }

        expect(said).not.toMatch(/works Lotus-Plucking Ritual on you/);
        expect(at.progress().p).toBe(before);
        expect(at.progress().alive).toBe(1);
    }, 200_000);
});
