/**
 * A shame on somebody's tags reaches the square as what they can be heard on.
 *
 * The fostering pass and giving away a piece of yourself both wrote `shame:`
 * tags, and nothing in play read one: somebody put out of their house in front
 * of it stood in the square like anybody else. The person carrying it is the one
 * who knows it, so it rides in the channel where they can be heard on it - the
 * narrator's card and the engine's own line - and never in what a stranger sees.
 *
 * The tag is written here by hand because the two passes that write it are slow
 * to reach in a test; both are live, and the tag is the whole of the interface.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, type Harness } from './harness';
import { worldLocationFor } from '../../src/web/entities';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { shameTag } from '../../src/engine/social/shame';

const WORLD = 'chew-a';
const RUN = 'somebody-who-ran';

/** An area of the opening town with somebody the player can name and nobody preoccupied. */
async function beside(harness: Harness) {
    const { cultivator } = await harness.game.newRun('Probe');
    const world = harness.game.atHand!;
    const place = worldLocationFor(world, cultivator.location)!;
    for (const area of theAreasOf(world, place).areas) {
        harness.repos.cultivators.standIn(cultivator.id, area.id);
        const me = harness.repos.cultivators.getById(cultivator.id)!;
        const named = harness.game.company(me).named;
        if (named.length > 0 && named.every(person => person.chewing == null)) return me;
    }
    return null;
}

describe('somebody carrying a shame', () => {
    it('is heard on it in the square, and nobody else takes it over', async () => {
        const harness = await makeGameInWorld({ seed: RUN, worldSeed: WORLD });
        const me = await beside(harness);
        expect(me, 'this world was pinned because its town has a quiet corner').not.toBeNull();

        const named = harness.game.company(me!).named;
        const them = harness.game.present(me!).find(row => row.name === named[0].name)!;
        const row = harness.game.atHand!.npcs.find(npc => npc.id === them.id)!;
        row.tags = [...row.tags, shameTag('fled_a_fight')];
        harness.game.theWorldMoved();

        const after = harness.game.company(me!).named.find(person => person.name === them.name)!;
        expect(after.chewing?.plainly).toMatch(/ran from a fight/);

        const turn = await harness.game.act('I look around');
        expect(turn.narration, turn.narration).toContain(after.chewing!.plainly);
    });
});
