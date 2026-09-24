/**
 * A bond ends when one of the two ends it, from either end.
 *
 * The design owner: *"the master neglect thing, get rid of it. Either they
 * terminate the relationship or they don't."* So there is no clock that ends a
 * bond and no penalty for one that has gone quiet; there is an act, and both
 * directions of it have to be reachable.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   the player casts out somebody who knelt to them, and walks out on somebody
 *   they knelt to, and each leaves a `former_` tie at both ends and a broken
 *   oath against whoever ended it
 *   ending nothing says so and writes nothing
 *   the words for it read as ending a bond and not as asking to be taken on
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { endTheBond } from '../../src/web/ending-a-bond-you-are-in.js';
import { requestPutToSomebody } from '../../src/web/what-a-request-asks-and-of-whom.js';
import { upsertRelationship } from '../../src/engine/world/npc-state.js';

const WORLD = 'a-bond-put-down';

/** A player and one NPC, with a bond written on the world rows at `end`. */
async function bonded(seed: string, end: 'master' | 'disciple') {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Walker');
    const world = harness.game.atHand!;
    const other = world.npcs.find(n => n.status === 'alive')!;
    const day = Math.floor(world.currentDay) - 40 * 365;

    // The player's own world row - the run may already have written one - and
    // the two halves of the bond on it.
    let playerAt = world.npcs.findIndex(n => n.id === cultivator.id);
    if (playerAt < 0) {
        world.npcs.push({ ...other, id: cultivator.id, name: cultivator.name, relationships: [] });
        playerAt = world.npcs.length - 1;
    }
    const otherAt = world.npcs.findIndex(n => n.id === other.id);
    const mine = end === 'master' ? 'disciple' : 'master';
    const theirs = end === 'master' ? 'master' : 'disciple';
    world.npcs[playerAt] = upsertRelationship(world.npcs[playerAt]!, {
        targetId: other.id, targetName: other.name, kind: mine, standing: 0.5, note: ''
    }, day);
    world.npcs[otherAt] = upsertRelationship(world.npcs[otherAt]!, {
        targetId: cultivator.id, targetName: cultivator.name, kind: theirs, standing: 0.5, note: ''
    }, day);

    return { harness, cultivator, other, world };
}

describe('the player ends a bond', () => {
    it('casts out somebody who knelt to them, and both ends keep a former tie', async () => {
        const { harness, cultivator, other, world } = await bonded('bond-cast-out', 'master');
        const left = endTheBond({
            world,
            repos: harness.repos,
            player: { id: cultivator.id, name: cultivator.name, ordinal: cultivator.realmOrdinal },
            other: { id: other.id, name: other.name, ordinal: other.cultivation.realmOrdinal },
            onDay: Math.floor(world.currentDay)
        })!;
        expect(left.endedBy).toBe('master');
        expect(left.lines.join(' ')).toMatch(/cast/i);

        const mine = world.npcs.find(n => n.id === cultivator.id)!;
        const theirs = world.npcs.find(n => n.id === other.id)!;
        expect(mine.relationships.find(r => r.targetId === other.id)!.kind).toBe('former_disciple');
        expect(theirs.relationships.find(r => r.targetId === cultivator.id)!.kind).toBe('former_master');
        // The one who was cast out holds it harder than the one who did it.
        expect(theirs.relationships.find(r => r.targetId === cultivator.id)!.standing)
            .toBeLessThan(mine.relationships.find(r => r.targetId === other.id)!.standing);
    }, 120_000);

    it('walks out on somebody they knelt to, and it is held against them', async () => {
        const { harness, cultivator, other, world } = await bonded('bond-walk-out', 'disciple');
        const left = endTheBond({
            world,
            repos: harness.repos,
            player: { id: cultivator.id, name: cultivator.name, ordinal: cultivator.realmOrdinal },
            other: { id: other.id, name: other.name, ordinal: other.cultivation.realmOrdinal },
            onDay: Math.floor(world.currentDay)
        })!;
        expect(left.endedBy).toBe('disciple');
        expect(left.structure).toMatch(/broken oath/);
        const mine = world.npcs.find(n => n.id === cultivator.id)!;
        expect(mine.relationships.find(r => r.targetId === other.id)!.kind).toBe('former_master');
    }, 120_000);

    it('and ending nothing writes nothing', async () => {
        const harness = await makeGameInWorld({ seed: 'bond-none', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Nobody');
        const world = harness.game.atHand!;
        const other = world.npcs.find(n => n.status === 'alive')!;
        expect(endTheBond({
            world,
            repos: harness.repos,
            player: { id: cultivator.id, name: cultivator.name, ordinal: cultivator.realmOrdinal },
            other: { id: other.id, name: other.name, ordinal: other.cultivation.realmOrdinal },
            onDay: Math.floor(world.currentDay)
        })).toBeNull();
    }, 120_000);
});

describe('the words for it', () => {
    it('read as ending a bond, from either end, and not as asking to be taken on', () => {
        for (const said of [
            'I ask Elder Ru to end our bond',
            'I ask Elder Ru to sever our ties',
            'I ask Bai Wanchen to accept that she is no longer my disciple'
        ]) {
            expect(requestPutToSomebody(said)?.kind, said).toBe('ending_a_bond');
        }
        expect(requestPutToSomebody('I ask Elder Ru to take me as his disciple')?.kind)
            .toBe('discipleship');
    });
});
