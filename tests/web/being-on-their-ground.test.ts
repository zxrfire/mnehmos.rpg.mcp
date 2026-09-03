/**
 * Standing on a house's ground is hearing of them.
 *
 * FOUND BY PLAYING, standing inside the Azure Cloud Pavilion's own compound and
 * having been told in the same run that the ground was theirs. The player typed
 * "can I join this sect?" - a deictic, never the name - the reader resolved it
 * to the Pavilion correctly, and the engine answered "Not a name you hold",
 * which the narrator rendered as a sound that had never been introduced to the
 * place. To somebody standing in their courtyard.
 *
 * The guard that refused is right and is untouched here: naming a house off a
 * listing must not quietly enrol anybody. What was wrong is that nothing ever
 * wrote a knowledge row for BEING THERE, so the guard fired on a player who
 * genuinely held the name. It now stops firing on its own accord.
 */

import { makeGameInWorld } from './harness';
import { activeWorld } from '../../src/server/state/cultivation-world';
import {
    howStandingHerePutIt,
    whoBeingHereIntroducesYouTo
} from '../../src/engine/world/being-on-their-ground';

const HOUSE = 'sect-azure-cloud-pavilion';

describe('who standing here introduces you to', () => {
    const ground = (over: Record<string, unknown> = {}) => ([{
        id: 'loc-yard', name: 'Azure Cloud Pavilion grounds', kind: 'sect_seat',
        parentId: null, controllingFactionId: HOUSE, data: {}, tags: [], ...over
    }] as never);

    it('is the house that holds it', () => {
        const intro = whoBeingHereIntroducesYouTo(ground(), 'loc-yard');
        expect(intro?.factionId).toBe(HOUSE);
        expect(intro?.factionName).toBe('Azure Cloud Pavilion');
        expect(howStandingHerePutIt(intro!)).toContain('you have stood on it');
    });

    /** An empty province introduces nobody, which is most of the map. */
    it('is nobody where nobody holds the ground', () => {
        expect(whoBeingHereIntroducesYouTo(ground({ controllingFactionId: null }), 'loc-yard'))
            .toBeNull();
        expect(whoBeingHereIntroducesYouTo(ground(), 'loc-nowhere')).toBeNull();
    });

    /**
     * A row keyed to an id the player can never say back is a row that makes a
     * refusal look like a bug.
     */
    it('introduces nobody it cannot name', () => {
        expect(whoBeingHereIntroducesYouTo(ground({ controllingFactionId: 'sect-not-in-any-catalog' }), 'loc-yard'))
            .toBeNull();
    });
});

describe('the row it writes, played', () => {
    async function standingOn(kind: 'held' | 'unheld') {
        const h = await makeGameInWorld({ seed: 'join', worldSeed: 'world-join-1' });
        const { cultivator } = await h.game.newRun('Stander');
        const w = await activeWorld();
        const row = kind === 'held'
            ? w.state.locations.find(l => l.controllingFactionId && l.kind === 'sect_seat')!
            : w.state.locations.find(l => l.kind === 'region' && !l.controllingFactionId)!;
        h.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(row.name, cultivator.id);
        return { ...h, cultivator, row };
    }

    it('is not there before, and is there after a look', async () => {
        const { game, cultivator, row } = await standingOn('held');
        const house = row.controllingFactionId!;
        // The precondition the gate was reading, and it was empty.
        expect(game.knowledge.stageOf(cultivator.id, 'sect', house)).toBe('unaware');

        await game.act('I look around');

        expect(game.knowledge.isAwareOf(cultivator.id, 'sect', house)).toBe(true);
    });

    /**
     * `named` and no further. The source is `witnessed`, whose ceiling is
     * `known`, so this grants BELOW its own ceiling on purpose: being on
     * somebody's ground tells you whose it is and not their politics, their
     * arts, or who heads them.
     */
    it('grants a name to say, not an introduction', async () => {
        const { game, cultivator, row } = await standingOn('held');
        await game.act('I look around');
        expect(game.knowledge.stageOf(cultivator.id, 'sect', row.controllingFactionId!)).toBe('named');
    });

    /** And the refusal it was firing is gone, replaced by an answer on the merits. */
    it('lets a deictic reach the house whose yard the player is standing in', async () => {
        const { game } = await standingOn('held');
        await game.act('I look around');
        const asked = await game.act('can I join this sect?');
        expect(asked.narration).not.toMatch(/Not a name you hold/i);
        expect(asked.narration).toContain('Azure Cloud Pavilion');
    });

    /** Ground nobody holds introduces nobody, played as well as in the unit. */
    it('writes nothing where nobody holds the ground', async () => {
        const { game, cultivator } = await standingOn('unheld');
        const before = game.knowledge.awareness(cultivator.id, 'sect').length;
        await game.act('I look around');
        expect(game.knowledge.awareness(cultivator.id, 'sect').length).toBe(before);
    });
});
