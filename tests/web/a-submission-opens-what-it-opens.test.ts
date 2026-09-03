/**
 * A submission is a scenario, and the strip has to change on it.
 *
 * Somebody kneeling in front of you can be made to turn out what they carry.
 * That is closed at every other moment and open at this one, and the strip was
 * still offering travel and a reading list.
 *
 * The state it needs did not exist: a submission ENDS the confrontation, so the
 * fight row is gone by the time anything could read it and the fact lived for
 * one turn's prose and then nowhere. It is a flag now, and what makes it lapse
 * is PRESENCE - somebody who yielded and then walked off is not yielding to
 * anybody - so there is no timer and must not be one.
 */

import { makeGameInWorld } from './harness';
import { writeFlag } from '../../src/server/consolidated/cultivation-support';
import { FLAG_YIELDING_TO_YOU } from '../../src/web/flag-keys';
import { parseIntent } from '../../src/web/actions';

const ids = (list: readonly unknown[]) => list.map(a => (a as { id: string }).id);

async function standingOverSomebody() {
    const h = await makeGameInWorld({ seed: 'strip', worldSeed: 'world-strip-1' });
    const { cultivator } = await h.game.newRun('Stander');
    const run = h.game.state().run;
    const here = h.game.present(cultivator);
    return { ...h, cultivator, run, here };
}

describe('standing over somebody who has yielded', () => {
    it('is not offered when nobody has', async () => {
        const at = await standingOverSomebody();
        expect(ids(at.game.affordancesFor(at.cultivator, at.run))).not.toContain('hand_over');
    }, 60_000);

    it('is offered, first and by name, once somebody has', async () => {
        const at = await standingOverSomebody();
        if (at.here.length === 0) return;
        writeFlag(at.db, at.cultivator.id, FLAG_YIELDING_TO_YOU, `${at.here[0].id}:${at.run.turn}`);

        const strip = at.game.affordancesFor(at.cultivator, at.run);
        const offered = strip.find(a => (a as { id: string }).id === 'hand_over') as
            { say: string; urgency: string } | undefined;

        expect(offered, 'the strip did not change on the scenario').toBeTruthy();
        expect(offered!.urgency, 'a person on their knees does not keep').toBe('now');
        expect(offered!.say).toContain(at.here[0].name);
    }, 60_000);

    /**
     * A strip that offers a sentence the reader cannot answer is worse than one
     * that offers nothing, so the phrasing is checked rather than assumed.
     */
    it('offers a sentence that reaches the act it names', async () => {
        const at = await standingOverSomebody();
        if (at.here.length === 0) return;
        writeFlag(at.db, at.cultivator.id, FLAG_YIELDING_TO_YOU, `${at.here[0].id}:${at.run.turn}`);

        const offered = at.game.affordancesFor(at.cultivator, at.run)
            .find(a => (a as { id: string }).id === 'hand_over') as { say: string };
        const plan = parseIntent(offered.say) as { action: string; intent?: string; target?: string };

        expect(plan.action).toBe('coerce');
        expect(plan.intent).toBe('hand_over');
        expect(plan.target).toBe(at.here[0].name);
    }, 60_000);

    /** Presence is what makes it lapse, and a note about somebody absent is nothing. */
    it('lapses when they are no longer in the room', async () => {
        const at = await standingOverSomebody();
        writeFlag(at.db, at.cultivator.id, FLAG_YIELDING_TO_YOU, `nobody-who-is-here:${at.run.turn}`);
        expect(ids(at.game.affordancesFor(at.cultivator, at.run))).not.toContain('hand_over');
    }, 60_000);
});

/**
 * `hand_over` was a declared intent with no phrasing that reached it: the
 * pattern had `force`, `strong-arm`, `extort` and `shake down` and not `make`,
 * which is how somebody says it.
 */
describe('making somebody hand over what they carry', () => {
    const read = (line: string) => parseIntent(line) as { action: string; intent?: string };

    it('reaches the intent that was declared for it', () => {
        for (const line of [
            'I make him hand it over',
            'I make them hand over what they carry',
            'I force him to hand over everything',
            'I make him give me everything'
        ]) {
            expect(read(line).intent, line).toBe('hand_over');
        }
    });

    /** Told apart from the others by WHAT the making is for. */
    it('takes nothing from the other things somebody is made to do', () => {
        expect(read('I make him kneel').intent).toBe('submit');
        expect(read('I force him to submit').intent).toBe('submit');
        expect(read('I make her yield to me').intent).toBe('submit');
        expect(read('I make him talk').intent).toBe('talk');
        expect(read('I beat the truth out of him').intent).toBe('talk');
        expect(read('I tame the beast').intent).toBe('tame');
    });
});
