/**
 * Hollowing had a writer and no reader: company still rolled for agreement,
 * and letting go treated the held body as somebody who could owe a favour.
 * A holder's instruction bypasses agreement. Taking the hand off leaves the
 * hollowing and its account intact. Read fresh rows after every act: the world
 * replaces records when it writes the fight's aftermath.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, engineCalls } from './harness';
import { standWhereThePeopleAre } from './standing-where-the-people-are';
import { addToPouch } from '../../src/server/consolidated/cultivation-support.js';
import { HOLLOWING_PILL_ID } from '../../src/data/cultivation/pills.js';
import { tagForHolder, takeTheHandOff, whoseHandThisBodyIsUnder } from '../../src/engine/social/a-body-under-somebody-elses-hand.js';

async function withSomebodyHollowed() {
    const harness = await makeGameInWorld({
        seed: 'under-your-hand', worldSeed: 'world-under-your-hand', adminMode: true,
        worldEnabled: true
    });
    const { db, game, repos } = harness;
    const { cultivator, run } = await game.newRun('Lin Zhaoyi');
    db.prepare('UPDATE cultivators SET realm_ordinal = 29, hp = 9000, max_hp = 9000 WHERE id = ?')
        .run(cultivator.id);
    await standWhereThePeopleAre(harness, cultivator.id);
    const me = repos.cultivators.getById(cultivator.id)!;
    const here = game.present(me);
    const rows = here.map(person => game.atHand!.npcs.find(npc => npc.id === person.id))
        .filter(npc => npc !== undefined);
    expect(rows.length, 'somebody with a world row must be present').toBeGreaterThan(0);
    const mark = rows[0]!;
    for (const person of here) {
        game.knowledge.learn({
            holderId: me.id, kind: 'cultivator', id: person.id, name: person.name,
            onDay: 0, sourceKind: 'told', stance: 'knows', confidence: 1
        });
    }
    addToPouch(db, me.id, HOLLOWING_PILL_ID, 'pill', 1);
    await game.act(`I make ${mark.name} swallow the Hollowing Pill`);
    const live = () => game.atHand!.npcs.find(npc => npc.id === mark.id)!;
    expect(whoseHandThisBodyIsUnder(live().tags)).toBe(me.id);
    const account = () => db.prepare(
        "SELECT id FROM obligations WHERE holder_id = ? AND subject_id = ? AND cause = 'violated' AND status = 'open'"
    ).all(mark.id, me.id);
    return { game, repos, run, live, me, account };
}

describe('a body under your hand', () => {
    it('comes with you without asking for agreement', async () => {
        const { game, live, me } = await withSomebodyHollowed();
        const went = await game.act(`I ask ${live().name} to come with me`);
        expect(engineCalls(went).some(c => c.name === 'social.whatAHeldBodyDoesWith')).toBe(true);
        expect(engineCalls(went).some(c => c.name === 'engine.resolveAttempt')).toBe(false);
        expect(live().activity?.kind).toBe('out_with_a_party');
        expect(live().activity?.withIds).toContain(me.id);
    });

    it('cannot give an introduction out of an emptied soul', async () => {
        const { game, live } = await withSomebodyHollowed();
        const asked = await game.act(`I ask ${live().name} to introduce me to their master`);
        expect(asked.narration).toMatch(/cannot answer that request|cannot provide teaching or introductions/i);
        expect(engineCalls(asked).some(c => c.name === 'engine.resolveAttempt')).toBe(false);
    });

    it('can be asked what company would take without being sent anywhere', async () => {
        const { game, live, repos, run, me } = await withSomebodyHollowed();
        const before = live().activity;
        const currentRun = repos.runs.getById(run.id)!;
        const currentMe = repos.cultivators.getById(me.id)!;
        // A phase-one read is arranged; the price is the engine's answer.
        const asked = await game.request(currentRun, currentMe, game.ambientFor(currentMe, currentRun),
            live().name, 'weigh', undefined, undefined, `I ask ${live().name} to come with me`);
        expect(asked.facts.prose).toMatch(/under your hand|requires no agreement/);
        expect(live().activity).toEqual(before);
    });

    it('does not take the instruction of somebody other than its holder', async () => {
        const { game, live } = await withSomebodyHollowed();
        live().tags = [...takeTheHandOff(live()).tags, tagForHolder('another-holder')];
        game.theWorldMoved();
        const asked = await game.act(`I ask ${live().name} to come with me`);
        expect(asked.narration).toMatch(/does not answer you|somebody else's hand/);
        expect(live().activity?.kind ?? null).not.toBe('out_with_a_party');
    });

    it('is let go of without restoring the soul or settling the account', async () => {
        const { game, live, account } = await withSomebodyHollowed();
        const before = account();
        expect(before.length).toBeGreaterThan(0);
        const done = await game.act('I let him go');
        expect(engineCalls(done).some(c => c.name === 'social.takeTheHandOff')).toBe(true);
        expect(whoseHandThisBodyIsUnder(live().tags)).toBeNull();
        expect(live().soulState).toBe('fragmented');
        expect(live().identityContinuity).toBe(0);
        expect(account()).toEqual(before);
    });

    it('never lets go of a different body when the plan names somebody absent', async () => {
        const { game, repos, run, me, live } = await withSomebodyHollowed();
        const refused = game.letThemGo(repos.runs.getById(run.id)!,
            repos.cultivators.getById(me.id)!, 'let_them_go', 'Nobody Present');
        expect(refused.outcome).toBe('refused');
        expect(whoseHandThisBodyIsUnder(live().tags)).toBe(me.id);
    });
});
