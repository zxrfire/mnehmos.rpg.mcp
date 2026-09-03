/**
 * Somebody made to kneel and told to hand over their things hands them over.
 *
 * FOUND BY PLAYING, on the row this engine itself offers. A coercion reached a
 * submission, the strip put *"I make X hand over what they carry"* at the top
 * of what is live here, and typing that exact sentence produced a turn that
 * said they yielded and moved nothing. Two failures were stacked in it:
 *
 *   THE INTENT WAS DROPPED. The table reads the sentence as
 *   `{coerce, hand_over}` and always has. With a narrator running, phase 1
 *   answered a bare `coerce`, and `carryWhatOnlyTheSentenceKnows` carried
 *   `leverage`, `terms`, `opening`, `rations` and `stones` but never `intent`.
 *
 *   AND `hand_over` DID NOTHING ANYWAY. `wanted` was a label carried for the
 *   narrator and read by no conditional - the same shape `steal` had before it
 *   was wired - so even the correct intent moved nothing.
 *
 * The second is the one that matters, and it is why these tests are played
 * rather than parsed: a row that routes to a verb which then does nothing is
 * worse than a row that fails to parse, because the turn reports success. The
 * prose says they yielded, nothing moves, and a player cannot tell that from a
 * robbery that worked.
 *
 * WHAT IS PINNED HERE is therefore the WORLD and not the wording: stones off
 * their row and onto yours, the tracked thing reassigned by the one function
 * that reassigns things, ownership deliberately NOT moved, and a grudge open
 * on the ledger.
 *
 * THE WORLD IS PINNED AS WELL AS THE RUN. `makeGameInWorld({worldSeed})` or
 * the same run seed meets a different several hundred people every execution.
 *
 * AND THE PURSE IS SEEDED, which is scaffolding rather than the thing measured.
 * Measured on this world: 196 of 442 people carry any stones at all, so who is
 * standing in the square when the run opens decides whether there is anything
 * to take. That is the world being the world; it is not what these tests are
 * about, so they say what the target is carrying instead of hoping.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, engineCalls } from './harness';
import { parseIntent } from '../../src/web/verb-pattern-table.js';
import { carryWhatOnlyTheSentenceKnows } from '../../src/web/planned-action.js';
import { makeObject } from '../../src/engine/world/possessions.js';

const SEED = 'a-yielding-hands-over';

interface ProbeNpc {
    id: string;
    name: string;
    spiritStones: number;
    locationId: string | null;
}
interface ProbeObject {
    id: string;
    name: string;
    significance: string;
    possessorId: string | null;
    ownerId: string | null;
    provenance: { how: string; holderId: string | null }[];
}
interface OpenWorld {
    atHand: { npcs: ProbeNpc[]; objects: ProbeObject[] } | null;
}

/**
 * Who is standing here, asked of the engine rather than read off the prose.
 *
 * `present` is the same roster the verb itself resolves a target against, so a
 * test that picks its mark out of it cannot pick somebody the verb would not
 * have found - and it does not go stale when a room's wording changes.
 */
interface AsksItsOwnRoster {
    present: (cultivator: unknown) => { id: string; name: string }[];
}

/**
 * A run standing over everybody, with one person in front of them who has
 * something on them and one tracked thing in their hands.
 *
 * The rung gap is what makes the submission arrive without a contest - see the
 * resolver's own line, "resolved in one action with nothing contested" - so
 * nothing here forces an outcome. It arranges who is standing there and what
 * they are carrying, and the verb does the rest.
 */
async function somebodyWithSomethingToLose() {
    const { db, game } = await makeGameInWorld({
        seed: SEED, worldSeed: `world-${SEED}`, adminMode: true
    });
    const { cultivator } = await game.newRun('Lin Zhaoyi');
    db.prepare(
        'UPDATE cultivators SET realm_ordinal = 29, spirit_stones = 0, hp = 9000, '
        + 'max_hp = 9000 WHERE id = ?'
    ).run(cultivator.id);

    await game.act('I look around');

    const world = (game as unknown as OpenWorld).atHand;
    expect(world, 'the world was not loaded').not.toBeNull();
    const here = (game as unknown as AsksItsOwnRoster).present(cultivator);
    const mark = here
        .map(row => world!.npcs.find(npc => npc.id === row.id))
        .find((npc): npc is ProbeNpc => npc !== undefined);
    expect(mark, `nobody with a world row was standing here on ${SEED}`).toBeDefined();

    mark!.spiritStones = 4000;
    // Minted through the world's own constructor rather than as a literal, so
    // a row this test invents cannot be a shape the engine never sees.
    world!.objects.push(makeObject({
        id: 'probe-jade-token',
        name: 'A Jade Token',
        kind: 'artifact',
        significance: 'significant',
        possessorId: mark!.id,
        ownerId: mark!.id,
        ownerName: mark!.name
    }) as unknown as ProbeObject);

    return { db, game, world: world!, mark: mark!, playerId: cultivator.id };
}

const purseOf = (db: { prepare: (q: string) => { get: (...a: unknown[]) => unknown } }, id: string) =>
    (db.prepare('SELECT spirit_stones AS s FROM cultivators WHERE id = ?').get(id) as { s: number }).s;

describe('the sentence the strip offers reaches hand_over', () => {
    /**
     * The table has read this correctly the whole time, which is why the defect
     * looked like a parser bug and was not one. Pinned so the phrasing the
     * strip emits cannot drift away from the pattern that catches it.
     */
    it('reads the strip row as a coercion for the goods', () => {
        for (const said of [
            'I make Qiu Wanbo hand over what they carry',
            'I make him hand over everything',
            'I force him to turn out his pockets'
        ]) {
            expect(parseIntent(said), said).toMatchObject({
                action: 'coerce', intent: 'hand_over'
            });
        }
    });

    /**
     * THE FIRST FAILURE. A model that answers a bare `coerce` used to strip the
     * intent off the sentence that was typed, and the strip is exactly the
     * route that goes through a model.
     */
    it('puts back an intent the model left empty', () => {
        const said = 'I make Qiu Wanbo hand over what they carry';
        const fromAModel = { action: 'coerce' as const, target: 'Qiu Wanbo' };
        expect(carryWhatOnlyTheSentenceKnows(fromAModel, said).intent).toBe('hand_over');
    });

    /** And never over the top of one it did answer. */
    it('leaves an intent the model did name alone', () => {
        const said = 'I make Qiu Wanbo hand over what they carry';
        const fromAModel = { action: 'coerce' as const, target: 'Qiu Wanbo', intent: 'talk' };
        expect(carryWhatOnlyTheSentenceKnows(fromAModel, said).intent).toBe('talk');
    });
});

describe('a yielding hands something over', () => {
    it('moves the purse, the thing and the ledger', async () => {
        const { db, game, world, mark, playerId } = await somebodyWithSomethingToLose();
        const had = mark.spiritStones;

        const acted = await game.act(`I make ${mark.name} hand over everything`);

        // It reached a submission rather than a beating, which is the state
        // this whole verb branch is about.
        const bout = engineCalls(acted).find(c => c.name === 'combat_manage.resolve');
        expect(bout?.summary, 'this did not end in a submission').toMatch(/yielded|kneel/i);

        // THE PURSE MOVED. Off their row and onto the player's, which is the
        // half a player can see without opening anything.
        expect(mark.spiritStones).toBeLessThan(had);
        const took = had - mark.spiritStones;
        expect(took).toBeGreaterThan(0);
        expect(purseOf(db, playerId)).toBe(took);

        // AND THE THING MOVED, through the one function that moves a row.
        const token = world.objects.find(row => row.id === 'probe-jade-token')!;
        expect(token.possessorId).toBe(playerId);
        expect(token.provenance.at(-1)?.how).toBe('stolen');

        // AND OWNERSHIP DID NOT. Taking a thing at knifepoint does not make it
        // yours, and the record has to go on saying whose it is.
        expect(token.ownerId).toBe(mark.id);

        // AND THE LEDGER OPENED. Somebody beaten and then robbed has been
        // wronged twice, and this is the second row.
        const held = db.prepare(
            'SELECT holder_id, subject_id, cause, kind, status FROM obligations WHERE subject_id = ?'
        ).all(playerId) as { holder_id: string; cause: string; kind: string; status: string }[];
        const robbery = held.find(row => row.cause === 'robbery');
        expect(robbery, 'nothing on the ledger about the robbery').toBeDefined();
        expect(robbery!.kind).toBe('grudge');
        expect(robbery!.status).toBe('open');
        expect(robbery!.holder_id).toBe(mark.id);

        // And the turn said what came across, by name. The defect this closes
        // was a turn that read as a success and moved nothing, so the prose has
        // to be the place a player can tell the two apart.
        expect(acted.narration).toMatch(new RegExp(`${mark.name} hands over`));
        expect(acted.narration).toMatch(/A Jade Token/);
    }, 200_000);

    /**
     * AND AN EMPTY PERSON IS NOT A ROBBERY.
     *
     * 246 of the 442 people in this world carry nothing at all, so this is the
     * commonest outcome rather than an edge. Nothing moved, so no robbery is
     * written - the beating already left its own record, and a second row about
     * an event that did not happen is how a ledger stops meaning anything.
     */
    it('says so and opens nothing when there is nothing on them', async () => {
        const { db, game, world, mark, playerId } = await somebodyWithSomethingToLose();
        mark.spiritStones = 0;
        world.objects.splice(world.objects.findIndex(row => row.id === 'probe-jade-token'), 1);

        const acted = await game.act(`I make ${mark.name} hand over everything`);

        expect(acted.narration).toMatch(/turns out their sleeves/);
        expect(purseOf(db, playerId)).toBe(0);
        const robbery = (db.prepare(
            'SELECT cause FROM obligations WHERE subject_id = ?'
        ).all(playerId) as { cause: string }[]).filter(row => row.cause === 'robbery');
        expect(robbery, 'a robbery was written about an empty purse').toEqual([]);
    }, 200_000);
});
