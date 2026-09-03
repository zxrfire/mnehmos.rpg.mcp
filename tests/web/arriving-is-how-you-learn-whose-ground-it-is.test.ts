/**
 * Arrival is the honest trigger. `look` is the optional one.
 *
 * `being-on-their-ground.ts` landed with a single caller in the `look` path,
 * and the gap was reported at the time: a player who walks in and acts without
 * looking still holds nothing. It bit within the hour, on a verb the owner had
 * designed twenty minutes earlier. Standing on Azure Cloud Pavilion grounds,
 * with the house named to the player three times in the session - including
 * `whoHoldsTheGround: held by Azure Cloud Pavilion` in an engine ruling -
 * "I ask the elders to put my name forward" came back:
 *
 *   No such door.
 *   Unresolved faction "Azure Cloud Pavilion": no knowledge record.
 *
 * The nomination ask points at the player's OWN house, so the commonest case
 * for the whole verb was the one that could not resolve.
 */

import { makeGameInWorld } from './harness';
import { activeWorld } from '../../src/server/state/cultivation-world';
import { whoBeingHereIntroducesYouTo } from '../../src/engine/world/being-on-their-ground';

/** A run standing one step away from a seat somebody holds. */
async function aboutToArriveAtAHeldSeat(worldSeed: string) {
    const h = await makeGameInWorld({ seed: 'arr', worldSeed });
    const { cultivator } = await h.game.newRun('Walker');
    const w = await activeWorld();
    const seat = w.state.locations.find(l => l.controllingFactionId && l.kind === 'sect_seat')!;
    // Reachable by name, the way being told about a place makes it reachable.
    h.game.knowledge.learnIfNew({
        holderId: cultivator.id, kind: 'place', id: seat.name, name: seat.name,
        onDay: 0, sourceKind: 'told', sourceNote: 'told about it', stage: 'placed',
        statement: `${seat.name} is a place.`
    });
    return { ...h, cultivator, seat, house: seat.controllingFactionId! };
}

describe('walking onto a house\'s ground', () => {
    it('is how the house stops being a name nobody has said', async () => {
        const { game, cultivator, seat, house } = await aboutToArriveAtAHeldSeat('world-arr-1');
        expect(game.knowledge.stageOf(cultivator.id, 'sect', house)).toBe('unaware');

        // NO `look`. The whole point: the player arrives and acts.
        await game.act(`I travel to ${seat.name}`);

        expect(game.knowledge.isAwareOf(cultivator.id, 'sect', house)).toBe(true);
    });

    /**
     * `named` and no further. `noteEncounter` lets the source decide and
     * `witnessed` carries a ceiling of `known` - measured, that granted
     * `encountered`, which is somebody you have DEALT WITH rather than a name
     * you can say. Being somewhere tells you whose it is and nothing about
     * their politics, and both callers grant below their own ceiling for that
     * reason.
     */
    it('grants a name to say, not a dealing', async () => {
        const { game, cultivator, seat, house } = await aboutToArriveAtAHeldSeat('world-arr-1');
        await game.act(`I travel to ${seat.name}`);
        expect(game.knowledge.stageOf(cultivator.id, 'sect', house)).toBe('named');
    });

    /** And the refusal that blocked the designed verb is gone. */
    it('lets a sentence about the house resolve the house', async () => {
        const { game, seat } = await aboutToArriveAtAHeldSeat('world-arr-1');
        await game.act(`I travel to ${seat.name}`);
        const asked = await game.act('I ask the elders to put my name forward');
        expect(asked.narration).not.toMatch(/No such door/i);
        expect(asked.narration).not.toMatch(/Unresolved faction/i);
    });

    /**
     * IT STAYS NARROW, and getting this test right corrected my own premise.
     *
     * `controllingFactionId === null` is NOT unheld: `whoHoldsTheGround` also
     * reads the prefecture register, so a settlement with nothing on its own row
     * can still be held by the house that holds the district - and walking into
     * the district IS standing on their ground. So the destination is chosen
     * with the same predicate the writer uses, and the assertion is that ground
     * which introduces nobody writes nobody.
     *
     * Asserted on the ground's own statement rather than on a row count,
     * because a journey legitimately produces hearsay and a count cannot tell
     * the two apart.
     */
    it('writes nothing for ground that introduces nobody', async () => {
        const h = await makeGameInWorld({ seed: 'arr', worldSeed: 'world-arr-1' });
        const { cultivator } = await h.game.newRun('Walker');
        const w = await activeWorld();
        const open = w.state.locations.find(
            l => l.kind === 'settlement'
                && whoBeingHereIntroducesYouTo(w.state.locations, l.id) === null
        );
        // A world where every settlement is held is a legitimate world; there is
        // simply nothing to assert in it.
        if (!open) return;

        h.game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'place', id: open.name, name: open.name,
            onDay: 0, sourceKind: 'told', sourceNote: 'told about it', stage: 'placed',
            statement: `${open.name} is a place.`
        });
        await h.game.act(`I travel to ${open.name}`);

        const groundRows = h.game.knowledge.awareness(cultivator.id, 'sect')
            .filter(row => /you have stood on/.test(row.statement ?? ''));
        expect(groundRows).toHaveLength(0);
    });
});
