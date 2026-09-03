/**
 * A name this cultivator holds is not a place that has no such thing.
 *
 * ── THE TURN THIS WAS FOUND ON ───────────────────────────────────────────
 *
 * Played, one town from somebody known since childhood:
 *
 *   > I look at Fang Nuoshan
 *   "You go over Fourhands looking for it and it is not the kind of place that
 *    has one. Either it is somewhere else, or it is nowhere..."
 *   Unresolved subject "Fang Nuoshan": no knowledge record and nothing
 *   co-located. Known to this cultivator, or standing here: Liang Yaoru,
 *   Lu Suiyan, Fang Nuoshan, ...
 *
 * **The refusal denied a record it listed in its own next breath**, and
 * `what do I know of Fang Nuoshan` answered fully one command later.
 *
 * Two faults, and only the second is about resolution. `resolveCultivator`
 * searches the run's own roster plus whoever is standing here, so a world NPC
 * who is neither - anybody met once and walked away from, anybody merely heard
 * of, anybody DEAD - is unreachable however well the holder knows them. And the
 * refusal was place-shaped, about a person.
 *
 * ── WHAT IS ASSERTED, AND WHY IT IS NOT THE PROSE ────────────────────────
 *
 * Three engine facts, because all three have been got wrong here before:
 *
 *   the read is REFUSED       the look did not happen. They are not here.
 *   nothing is WRITTEN        reading your own memory does not put you in a
 *                             room with somebody. `noteEncounter` would promote
 *                             a whisper to `encountered` and quietly falsify the
 *                             reference axis the look read depends on.
 *   the stage does not MOVE   the same claim, checked against the row rather
 *                             than against the count.
 */

import { describe, expect, it } from 'vitest';

import { TIME_CONSUMING_ACTIONS } from '../../src/web/actions';
import { engineCalls, makeGameInWorld, planned, ScriptedProvider } from './harness';

/** Every name this cultivator holds for a person, with the id it is filed under. */
function namesHeld(db: any): Array<{ id: string; name: string }> {
    return (db.prepare(
        "SELECT claim_key, detail FROM knowledge_records WHERE claim_key LIKE 'exists:cultivator:%'"
    ).all() as Array<{ claim_key: string; detail: string }>).map(row => {
        const id = row.claim_key.split(':').slice(2).join(':');
        let name = '';
        try { name = JSON.parse(row.detail).name ?? ''; } catch { /* a row with no name is not one */ }
        return { id, name };
    }).filter(row => row.name.length > 0);
}

function knowledgeRows(db: any): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM knowledge_records').get() as { n: number }).n;
}

describe('a name they hold, whose bearer is not standing here', () => {
    it('answers out of their own rows, and writes nothing doing it', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'not-here', worldSeed: 'world-askscratch'
        });
        await game.newRun('Wen Shuyi');
        await game.act('I look around');

        const known = namesHeld(db);
        expect(known.length, 'nobody in the opening square to know').toBeGreaterThan(0);
        const who = known[0]!;

        // Standing in front of them, the ordinary read answers.
        const inFront = await game.act(`I look at ${who.name}`);
        expect(engineCalls(inFront).find(c => c.action === 'investigate')?.ok).toBe(true);

        // One town over, they are not here - and the read that used to be a
        // place-shaped denial of a record it listed is now about the person.
        await game.act('I travel to Fourhands');
        const before = knowledgeRows(db);
        const away = await game.act(`I look at ${who.name}`);

        const call = engineCalls(away).find(c => c.action === 'investigate');
        expect(call, 'did not reach the read at all').toBeDefined();
        // Refused: the look did not happen.
        expect(call!.ok).toBe(false);
        // And the refusal is about a person, out of the record, naming the stage
        // it was held at - never about the kind of place this is.
        expect(call!.summary).toMatch(/held as a knowledge record at stage/);
        expect(call!.summary).toMatch(/neither on the run's roster nor standing here/);
        expect(away.narration).toContain(who.name);
        expect(away.narration).not.toMatch(/kind of place/);
        // The reference axis, which is what a look at a face is worth, and its
        // ceiling. Both come off `whatALookAtSomebodyReaches`.
        expect(away.narration).toMatch(/not in a face/);

        // Nothing was learned by remembering. This is the guarantee: a
        // `witnessed` row here would promote the stage and falsify the axis.
        expect(knowledgeRows(db), 'a look at somebody absent wrote a record').toBe(before);
        expect(away.state.run.elapsedDays).toBe(1);
    }, 200_000);

    /**
     * The design owner's case, and the one that motivated the whole thing.
     *
     * A dead person is the same code path by construction - `npcsAt` filters on
     * `status === 'alive'`, and the run's own roster never held them - so the
     * only thing worth checking separately is that the engine does not
     * accidentally REPORT the death. Whether they are one town over or in the
     * ground is not something this cultivator has been told, and a look that
     * reached nothing cannot be the thing that says so.
     */
    it('says they are not here, and never that they are dead', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'the-dead', worldSeed: 'world-askscratch'
        });
        await game.newRun('Wen Shuyi');
        await game.act('I look around');

        const who = namesHeld(db)[0]!;
        expect(who).toBeDefined();

        db.prepare("UPDATE world_npcs SET status = 'dead' WHERE id = ?").run(who.id);
        const { resetCultivationWorlds } = await import('../../src/server/state/cultivation-world');
        resetCultivationWorlds();

        const before = knowledgeRows(db);
        const looked = await game.act(`I look at ${who.name}`);

        expect(engineCalls(looked).find(c => c.action === 'investigate')?.ok).toBe(false);
        expect(looked.narration).toContain(who.name);
        expect(looked.narration).not.toMatch(/\bdead\b|\bdied\b|\bkilled\b/i);
        expect(knowledgeRows(db)).toBe(before);
    }, 200_000);

    /**
     * And a word that reached nothing at all keeps its refusal - worded so it
     * does not confirm what kind of thing it was either. The branch above owns
     * every name the cultivator actually holds, so what is left here is a name
     * nobody has said, and saying "not the kind of PLACE that has one" about it
     * would tell the player what the engine took it for.
     */
    it('refuses a name nobody has said without saying what it took it for', async () => {
        const { game } = await makeGameInWorld({
            seed: 'never-said', worldSeed: 'world-askscratch'
        });
        await game.newRun('Wen Shuyi');

        const looked = await game.act('I look at Shellback');
        expect(engineCalls(looked).find(c => c.action === 'investigate')?.ok).toBe(false);
        expect(looked.narration).not.toMatch(/kind of place/);
        expect(looked.narration).toMatch(/nothing here answers to it/);
        // It must not confirm existence either way, so it says nothing about
        // whether Shellback is a person, a place or nobody at all.
        expect(looked.narration).not.toContain('Shellback');
        expect(looked.state.run.elapsedDays).toBe(0);
    }, 200_000);
});

/**
 * THE OWNER'S DESIGN POINT, TESTED RATHER THAN ASSERTED.
 *
 * > "inspect should apply to everything that can be inspected and not just
 * > room, right?"
 *
 * `investigate`'s glossary line already says so - *examine a place, a PERSON, a
 * record, an inscription, an object* - and this is that claim as a sweep. Every
 * row that passes is a kind the verb genuinely reaches; the kinds it does NOT
 * reach are recorded in the report rather than asserted here, because they are
 * a design question about the discovery gate and not a bug.
 */
describe('everything that can be inspected', () => {
    it('reaches a person here, a house, an art and the ground underfoot', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'inspectable', worldSeed: 'world-askscratch'
        });
        await game.newRun('Wen Shuyi');
        await game.act('I look around');

        const reached = async (said: string) => {
            const result = await game.act(said);
            const call = engineCalls(result).find(c => c.action === 'investigate');
            expect(call, `${said} did not reach the read`).toBeDefined();
            expect(call!.ok, `${said} was refused`).toBe(true);
            expect(result.state.run.elapsedDays, `${said} spent a day`).toBe(0);
            return call!.summary;
        };

        const who = namesHeld(db)[0]!;
        expect(await reached(`I look at ${who.name}`)).toMatch(/to cultivator /);
        expect(await reached('I examine the Gleaners Company')).toMatch(/to sect /);
        expect(await reached('I examine the Lesser Qi-Gathering Manual')).toMatch(/to technique /);
        expect(await reached('I examine this place')).toMatch(/to place /);
        // The asker themselves, which is its own kind and not a cultivator row.
        expect(await reached('I examine my meridians')).toMatch(/to self /);
    }, 200_000);
});

/**
 * AND THE OTHER HALF, WHICH IS NOT THE TABLE'S FAULT.
 *
 * The owner met this against ollama: `look at Shellback` returned the room with
 * the name on the front of it. Every phrasing of it reaches `investigate` with
 * the right target through the pattern table, so the parser is right - the
 * MODEL answered a sentence naming a person with the verb that reads the
 * surroundings, and `look` declares `takes: ['intent']`.
 *
 * The existing guard compares COST and both readings are free, so it waved it
 * through. This is the same shape as the giving-and-taking rule: a hard
 * boundary on one axis, checked separately, because the axis the cost rule
 * measures does not contain it.
 */
describe('a model may not answer a sentence about something with a read of the room', () => {
    /** A provider that answers `look` to everything, which is what ollama did. */
    const alwaysTheRoom = () => new ScriptedProvider(
        { plans: ['{"action":"look"}'], narrations: ['...'] },
        'ollama'
    );

    it('takes the reading that keeps the subject, and says it did', async () => {
        const { game } = await makeGameInWorld({
            seed: 'dropped', worldSeed: 'world-askscratch', provider: alwaysTheRoom()
        });
        await game.newRun('Wen Shuyi');

        for (const said of ['look at Shellback', 'I look at Shellback']) {
            const result = await game.act(said);
            const row = planned(result);
            expect(row!.summary, said).toMatch(/investigate\(target="Shellback"\)/);
            // Never silently: the routing row is the row that exists to say
            // where the verb came from, and it says what was declined.
            expect(row!.summary, said).toMatch(/nowhere to put a subject/);
            expect(result.state.run.elapsedDays, said).toBe(0);
        }
    }, 200_000);

    it('leaves a sentence that names nothing to the model', async () => {
        const { game } = await makeGameInWorld({
            seed: 'no-subject', worldSeed: 'world-askscratch', provider: alwaysTheRoom()
        });
        await game.newRun('Wen Shuyi');

        for (const said of ['I look around', 'what do I see', 'where am I']) {
            const row = planned(await game.act(said));
            expect(row!.summary, said).toMatch(/routed by the model to look/);
            expect(row!.summary, said).not.toMatch(/nowhere to put a subject/);
        }
    }, 200_000);

    /**
     * One-directional, like every other rule in this file: correcting a dropped
     * object may hand back a free read and may never start something. The table
     * reads "I attack Shellback" as a fight; a model calling it a look is
     * de-escalating, which has always been free.
     */
    it('never turns a room read into a fight', async () => {
        const { game } = await makeGameInWorld({
            seed: 'no-escalation', worldSeed: 'world-askscratch', provider: alwaysTheRoom()
        });
        await game.newRun('Wen Shuyi');

        expect(TIME_CONSUMING_ACTIONS).toContain('attack');
        const result = await game.act('I attack Shellback');
        const row = planned(result);
        expect(row!.summary).toMatch(/routed by the model to look/);
        expect(engineCalls(result).some(c => c.action === 'attack')).toBe(false);
        expect(result.state.run.elapsedDays).toBe(0);
    }, 200_000);
});
