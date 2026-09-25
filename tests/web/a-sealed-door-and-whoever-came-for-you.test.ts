/**
 * A sealed door, and somebody who came to settle an account with whoever is behind it.
 *
 * The owner's ruling: they can break it depending on the material. Played end to
 * end: an account comes due during a closed-door seclusion, and what stands
 * between the two of them is the door the sitter shut - an inn's planks where
 * they are lodging, and where the ground is their own, a door they reinforced
 * themselves with a beast part they carried.
 *
 *   - somebody stronger than the door breaks it, the sitting stops, and the
 *     player is told who, and through what, and is in the fight that follows;
 *   - somebody the door stops, made to wait (forced, because waiting is a draw),
 *     is at the door when the sitting ends, and it is the same confrontation;
 *   - an inn's door is not the sitter's to reinforce, and says so.
 *
 * World and run are pinned: whether the account comes due inside the span is a
 * draw on the run seed. Which door breaks is not a draw at all.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { BEAST_MATERIALS, getBeast } from '../../src/data/cultivation/beasts.js';
import { maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';
import { createObligation } from '../../src/engine/social/grudges.js';
import { addToPouch } from '../../src/server/consolidated/cultivation-support.js';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo.js';

const WORLD = 'road-world';

interface ProbeNpc {
    id: string;
    name: string;
    status: string;
    locationId: string | null;
    cultivation: { realmOrdinal: number };
}
interface Held {
    fight: { party: { id: string } } | null;
    atHand: {
        npcs: ProbeNpc[];
        objects: { possessorId: string | null; power: number | null }[];
        locations: { id: string; name: string; kind: string; controllingFactionId: string | null; tags: string[]; data: Record<string, unknown> }[];
    } | null;
}

async function aSitterWithAnAccountAgainstThem(seed: string, ordinal: number, holderOrdinal: number,
    severity: 'grave' | 'unforgivable') {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Sitter');
    const hp = maxHpForOrdinal(cultivator.attributes.might, ordinal);
    harness.db.prepare(
        'UPDATE cultivators SET realm_ordinal = ?, hp = ?, max_hp = ?, age = 30, spirit_stones = 5000 WHERE id = ?'
    ).run(ordinal, hp, hp, cultivator.id);
    await harness.game.act('I look around');
    const held = harness.game as unknown as Held;
    const world = held.atHand!;
    // Somebody carrying nothing rated, so what they bring to a door is their rung.
    const armed = new Set(world.objects.filter(o => o.power !== null).map(o => o.possessorId));
    const holder = world.npcs
        .filter(npc => npc.status === 'alive' && npc.id !== cultivator.id && !armed.has(npc.id))
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
    holder.cultivation.realmOrdinal = holderOrdinal;
    writeOneObligation(harness.db as never, createObligation({
        kind: 'grudge',
        holderId: holder.id,
        subjectId: cultivator.id,
        cause: 'humiliation',
        severity,
        onDay: 0,
        description: 'Sitter shamed them in front of their own people.'
    }));
    return { ...harness, playerId: cultivator.id, held, holder };
}

describe('somebody stronger than the door', () => {
    it('breaks it, stops the sitting, and says who came through what', async () => {
        const at = await aSitterWithAnAccountAgainstThem('door-inn-2', 10, 14, 'grave');
        const out = await at.game.act('I go into closed-door seclusion for three years anyway.');

        expect(out.narration).toMatch(
            new RegExp(`${at.holder.name} broke through the plank door of an inn room to reach you\\.`)
        );
        expect(at.held.fight?.party.id, out.narration).toBe(at.holder.id);
    }, 200_000);
});

describe('the door an inn lets you', () => {
    it('is not yours to reinforce, and the refusal says whose it is', async () => {
        const at = await aSitterWithAnAccountAgainstThem('door-inn-2', 10, 14, 'grave');
        const out = await at.game.act('I reinforce the door with the hide I took');
        expect(out.narration).toMatch(/the plank door of an inn room, and it is the inn's, not yours/);
    }, 200_000);
});

describe('a door of your own, reinforced', () => {
    it('holds against somebody weaker, who waits outside and is there when the sitting ends', async () => {
        const at = await aSitterWithAnAccountAgainstThem('door-cave-1', 12, 10, 'unforgivable');
        const world = at.held.atHand!;
        const named = (name: string) => world.locations.filter(l => l.name === name).length;
        const cave = world.locations
            .filter(l => l.kind === 'cave' && !l.controllingFactionId && !l.tags.includes('residence'))
            .filter(l => named(l.name) === 1)
            .sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
        at.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(cave.name, at.playerId);

        const part = BEAST_MATERIALS
            .filter(m => (getBeast(m.sourceBeastId)?.ordinal ?? 0) >= 20)
            .sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
        addToPouch(at.db, at.playerId, part.id, 'herb', 1);

        const worked = await at.game.act(`I reinforce the cave door with the ${part.name}`);
        expect(worked.narration).toMatch(new RegExp(`You work the ${part.name} into the door yourself`));
        const standsAt = Number(at.held.atHand!.locations.find(l => l.id === cave.id)!.data.doorStandsAt);
        expect(standsAt).toBeGreaterThanOrEqual(11);
        // The part is spent.
        const left = at.db.prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
            .get(at.playerId, part.id) as { quantity: number } | undefined;
        expect(left?.quantity ?? 0).toBe(0);

        const sat = await withTheAttemptLanding('seclude',
            () => at.game.act('I go into closed-door seclusion for a year anyway.'));
        const said = sat.result.narration;
        expect(said).not.toMatch(new RegExp(`${at.holder.name} broke through`));
        expect(said).toMatch(
            new RegExp(`${at.holder.name} was waiting outside the door reinforced with beast parts when you came out\\.`)
        );
        expect(sat.forced.landed).toContain('somebody_waits_at_your_door');
    }, 200_000);
});
