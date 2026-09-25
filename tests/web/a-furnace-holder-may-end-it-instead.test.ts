/**
 * Somebody holding an art that draws on another beats the player into
 * submission, and ends it instead of keeping them - unless somebody steps in.
 *
 * The owner: of course some kill instead of drain - they do not want to wait for
 * you to cultivate, or the pairing does not match what the art needs. And:
 * somebody can step in, before you die; after that it is too late. Whoever does
 * earns the holder's grudge.
 *
 * Which of keeping and ending it happens is a draw (`furnace-kill-or-keep.ts`,
 * whose odds are pinned in its own engine test), so every case here FORCES it
 * the way an operator would, and asserts what follows: the kill is the rite's own
 * killing draw landed and goes through the ordinary death; a pairing the art does
 * not answer between is a killing with nothing drawn; a kinsman standing there
 * and a realm above the holder gets between them, the player lives, and the
 * holder now holds a grudge against the kinsman.
 *
 * Seeds and world are the road test's own, so the fight that gets the player to
 * their knees is the same one `somebody-comes-at-you-on-the-road.test.ts` plays.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { getTechnique } from '../../src/data/cultivation/index.js';
import { maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';
import { createObligation } from '../../src/engine/social/grudges.js';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo.js';

const WORLD = 'road-world';
const WHERE = 'I travel to the Buddha Precipice';

interface ProbeNpc {
    id: string;
    name: string;
    status: string;
    locationId: string | null;
    factionId: string | null;
    identity: { sex: 'male' | 'female'; bornOnDay: number };
    cultivation: { realmOrdinal: number; techniqueIds: string[] };
    relationships: Record<string, unknown>[];
}
interface Held {
    fight: { party: { id: string } } | null;
    atHand: { currentDay: number; npcs: ProbeNpc[] } | null;
    worldPlaceOf(cultivator: unknown): string | null;
    state(): { cultivator: unknown };
}

async function aRiteHolderCameForYou(seed: string, sameSex = false) {
    const at = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await at.game.newRun('Traveller');
    const hp = maxHpForOrdinal(cultivator.attributes.might, 10);
    at.db.prepare(
        'UPDATE cultivators SET realm_ordinal = 10, hp = ?, max_hp = ?, age = 30, cultivation_progress = 400 WHERE id = ?'
    ).run(hp, hp, cultivator.id);
    await at.game.act('I look around');
    const held = at.game as unknown as Held;
    const world = held.atHand!;
    const today = Math.floor(world.currentDay);
    const player = at.db.prepare('SELECT sex FROM cultivators WHERE id = ?')
        .get(cultivator.id) as { sex: 'male' | 'female' };
    const holder = world.npcs
        .filter(npc => npc.status === 'alive' && npc.id !== cultivator.id)
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
    holder.cultivation.realmOrdinal = 14;
    holder.identity.sex = sameSex ? player.sex : player.sex === 'male' ? 'female' : 'male';
    holder.identity.bornOnDay = today - 40 * 365;
    holder.cultivation.techniqueIds = [
        ...holder.cultivation.techniqueIds.filter(id => getTechnique(id)?.runsOn !== 'the_others'),
        'lotus-plucking-rite'
    ];
    writeOneObligation(at.db as never, createObligation({
        kind: 'grudge',
        holderId: holder.id,
        subjectId: cultivator.id,
        cause: 'humiliation',
        severity: 'unforgivable',
        onDay: 0,
        description: 'Traveller shamed them in front of their own people.'
    }));
    const alive = () => (at.db.prepare('SELECT alive FROM cultivators WHERE id = ?')
        .get(cultivator.id) as { alive: number }).alive;
    return { ...at, held, holder, playerId: cultivator.id, playerName: cultivator.name, alive };
}

/** Swing until the fight ends, with the holder's choice and any step-in forced. */
async function fightItOutForced(game: { act: (s: string) => Promise<{ narration: string }> }, held: Held) {
    const ran = await withTheAttemptLanding('attack', async () => {
        let last = '';
        for (let round = 0; round < 12 && held.fight !== null; round++) {
            last = (await game.act('I keep swinging')).narration;
        }
        return last;
    });
    return ran;
}

describe('a rite holder who takes everything at once', () => {
    it('kills the player with the rite, through the ordinary death, when nobody steps in', async () => {
        const at = await aRiteHolderCameForYou('came-at-r23');
        await at.game.act(WHERE);
        expect(at.held.fight?.party.id).toBe(at.holder.id);

        const ran = await fightItOutForced(at.game, at.held);

        expect(ran.result).toMatch(new RegExp(
            `${at.holder.name} does not keep you\\. They work Lotus-Plucking Rite on you and take everything at once`
        ));
        expect(ran.result).toMatch(/You do not survive it\./);
        expect(at.alive()).toBe(0);
        expect(ran.forced.landed).toContain('a_rite_holder_takes_everything');
    }, 200_000);

    it('ends a player the art does not answer between them and draws nothing', async () => {
        const at = await aRiteHolderCameForYou('came-at-r23', true);
        await at.game.act(WHERE);
        expect(at.held.fight?.party.id).toBe(at.holder.id);

        const ran = await fightItOutForced(at.game, at.held);

        expect(ran.result).toMatch(new RegExp(
            `Lotus-Plucking Rite does not answer between you and ${at.holder.name}, and ${at.holder.name} does not keep you`
        ));
        expect(ran.result).not.toMatch(/draws off|take everything at once/);
        expect(at.alive()).toBe(0);
    }, 200_000);

    it('is stopped by kin standing there a realm above the holder, who now holds the grudge', async () => {
        const at = await aRiteHolderCameForYou('came-at-r23');
        await at.game.act(WHERE);
        expect(at.held.fight?.party.id).toBe(at.holder.id);

        const here = at.held.worldPlaceOf(at.held.state().cultivator);
        const world = at.held.atHand!;
        const kin = world.npcs
            .filter(npc => npc.status === 'alive' && npc.id !== at.playerId && npc.id !== at.holder.id)
            .sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
        kin.locationId = here;
        kin.cultivation.realmOrdinal = 24;
        kin.relationships.push({
            targetId: at.playerId, targetName: at.playerName, kind: 'kin', standing: 1,
            note: 'Blood.', sinceDay: 0, lastChangedDay: 0, factIds: [], inheritedFromId: null
        });

        const ran = await fightItOutForced(at.game, at.held);

        expect(ran.result).toMatch(new RegExp(`${kin.name} gets between you before it lands`));
        expect(at.alive()).toBe(1);
        const grudge = at.db.prepare(
            "SELECT severity FROM obligations WHERE holder_id = ? AND subject_id = ? AND kind = 'grudge'"
        ).all(at.holder.id, kin.id) as { severity: string }[];
        expect(grudge).toEqual([{ severity: 'serious' }]);
        expect(ran.forced.landed).toContain('somebody_steps_in');
    }, 200_000);
});
