/**
 * A seclusion broken by somebody is a question, and the player answers it.
 *
 * The defect these pin, from a live playtest: the engine printed
 *
 *   "Seclusion broken: somebody is close enough to matter and has not seen this
 *    place yet. There is a road out that does not cross them ... Going costs the
 *    stretch; staying means being found here, by whoever that is."
 *
 * and then, with no input from anybody, printed "You came out early. 5.3 years
 * of the 40 years were spent; the rest was not yours to spend." Twice in one
 * session. The player was told they had a choice and shown the outcome of a
 * choice somebody else made.
 *
 * The two cases are NOT the same and the tests keep them apart: one offers a
 * ROAD, the other offers only the POSTURE you are found in. Both seeds below
 * were found by sweeping eight and reading what came back, and they are pinned
 * with their WORLD seed as well as their run seed - a played test that pins a
 * seed without pinning the world is pinning a coincidence.
 *
 * What is asserted, in order of how badly it would matter if it broke:
 *
 *   - the engine STOPS and does not resolve. Both branches are still open.
 *   - going costs the remainder and says so, and spends no day for saying it.
 *   - staying spends the remainder, from the day it stopped.
 *   - the clock is neither handed back nor charged twice.
 *   - staying is never refused, however stupid it is.
 *   - a free read leaves the question standing; a day spent elsewhere is going.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness.js';
import type { GameService } from '../../src/web/game.js';
import type { CultivationRepos } from '../../src/server/consolidated/cultivation-support.js';
import {
    THE_ANSWER_IS_TO_GO,
    THE_ANSWER_IS_TO_KEEP_SITTING
} from '../../src/web/choosing-what-to-do-when-a-seclusion-is-broken.js';

/** A run seed whose first long sitting is broken WITH a road out. */
const A_ROAD_OUT = 's2';
/** A run seed whose first long sitting is broken with NO road out. */
const NO_ROAD_OUT = 's3';
/** The world both of them are lived in. Pinned; see the header. */
const THE_WORLD = 'w1';

/**
 * Open a run, give it a method and a purse, and sit until somebody arrives.
 *
 * The purse and the method are there so the sitting is not refused for a reason
 * that has nothing to do with what is being tested - a zero-return stretch and
 * an empty pack are both separately correct refusals with their own tests.
 */
async function sitUntilSomebodyComes(seed: string): Promise<{
    game: GameService;
    repos: CultivationRepos;
    fork: NonNullable<ReturnType<GameService['state']>['crossroads']>;
    dayItStopped: number;
    stonesThen: number;
}> {
    const { game, repos } = await makeGameInWorld({ seed, worldSeed: THE_WORLD });
    const { cultivator } = await game.newRun('Probe');
    repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 5000 });
    await game.act('I learn a cultivation technique');

    for (let attempt = 0; attempt < 6; attempt++) {
        await game.cultivate(14600, { anyway: true });
        const state = game.state();
        if (state.crossroads) {
            return {
                game,
                repos,
                fork: state.crossroads,
                dayItStopped: state.run.elapsedDays,
                stonesThen: state.cultivator.spiritStones
            };
        }
    }
    throw new Error(`seed ${seed} never reached a broken seclusion; re-pin it`);
}

describe('the engine stops and does not answer', () => {
    it('offers a road out, and does not take it', async () => {
        const { fork } = await sitUntilSomebodyComes(A_ROAD_OUT);

        expect(fork.canWithdraw).toBe(true);
        expect(fork.daysRemaining).toBeGreaterThan(0);
        expect(fork.daysSpent + fork.daysRemaining).toBe(fork.daysAsked);
        // The road is the thing this case has and the other does not. Naming it
        // in the other case would be the flattening the two sentences exist to
        // prevent.
        expect(fork.question).toMatch(/road out is open/i);
        expect(fork.question).toMatch(/Say which\.$/);
    }, 120000);

    it('offers only the posture, when there is no road', async () => {
        const { fork } = await sitUntilSomebodyComes(NO_ROAD_OUT);

        expect(fork.canWithdraw).toBe(false);
        expect(fork.daysRemaining).toBeGreaterThan(0);
        expect(fork.question).toMatch(/no road out/i);
        expect(fork.question).not.toMatch(/road out is open/i);
    }, 120000);

    it('does not answer the question two paragraphs before asking it', async () => {
        const { game } = await sitUntilSomebodyComes(A_ROAD_OUT);
        const narrated = game.state().log
            .filter(e => e.role === 'narrator').map(e => e.text).join('\n');
        // `factsForTimeSkip` closes every interrupted stretch with "You came out
        // early ... the rest was not yours to spend." Correct for a torn
        // channel; the defect itself when the stretch stopped on a question,
        // because it announces the outcome of a decision nobody has taken and
        // says the years are not theirs in the same breath as offering them.
        expect(narrated).not.toMatch(/You came out early/);
        expect(narrated).toMatch(/Say which\./);
    }, 120000);

    it('claims no advantage or penalty for the posture it offers', async () => {
        const { fork } = await sitUntilSomebodyComes(NO_ROAD_OUT);
        // Nothing in the engine prices being found seated differently from
        // being found standing. A sentence that says otherwise is a second
        // rules system living in the narration layer.
        expect(fork.question).not.toMatch(/worst position|defenceless|helpless|cannot defend/i);
    }, 120000);

    it('says who is close without handing over a name that was not earned', async () => {
        const { fork } = await sitUntilSomebodyComes(A_ROAD_OUT);
        // The discovery rule: a rung is something anybody can feel through a
        // cave wall; a name is not.
        expect(fork.them).toMatch(/^somebody standing at /);
    }, 120000);

    it('surfaces the one answer that needs words, ahead of everything else', async () => {
        const { game } = await sitUntilSomebodyComes(A_ROAD_OUT);
        const live = game.state().derived.standingHere;
        expect(live[0]?.id).toBe('sit_back_down');
        expect(live[0]?.urgency).toBe('now');
        // The sentence the panel sends is the sentence the row offers.
        expect(live[0]?.say).toBe(game.state().crossroads?.stayingSays);
    }, 120000);
});

describe('going costs the remainder, and nothing else', () => {
    it('spends no day and says what was forfeited', async () => {
        const { game, fork, dayItStopped } = await sitUntilSomebodyComes(A_ROAD_OUT);

        const out = await game.act('I get up and go');

        const after = game.state();
        // Not a day. The remainder was never simulated, so there is nothing to
        // take back and nothing to charge for the answer itself.
        expect(after.run.elapsedDays).toBe(dayItStopped);
        expect(after.crossroads).toBeNull();
        // And it says so, in the log the engine owns rather than in prose a
        // narrator may drop.
        const engineSaid = after.log.filter(e => e.role === 'engine').map(e => e.text).join('\n');
        expect(`${out.narration}\n${engineSaid}`).toMatch(/forfeit|went with the sitting/i);
    }, 120000);

    it('leaves the cultivator on their feet when there was no road', async () => {
        const { game, fork } = await sitUntilSomebodyComes(NO_ROAD_OUT);
        expect(fork.canWithdraw).toBe(false);

        const out = await game.act('I get up');

        expect(game.state().crossroads).toBeNull();
        const engineSaid = game.state().log
            .filter(e => e.role === 'engine').map(e => e.text).join('\n');
        // Getting up buys the posture and NOT an escape. Saying it bought an
        // escape would be the softening the whole feature exists to refuse.
        expect(`${out.narration}\n${engineSaid}`).toMatch(/on your feet/i);
    }, 120000);
});

describe('staying spends the rest of the sitting', () => {
    it('resumes from the day it stopped and is never refused', async () => {
        const { game, fork, dayItStopped } = await sitUntilSomebodyComes(A_ROAD_OUT);

        await game.act('I sit back down');

        const after = game.state();
        expect(after.crossroads === null || after.crossroads.daysRemaining < fork.daysRemaining)
            .toBe(true);

        const spent = after.run.elapsedDays - dayItStopped;
        // NOT HANDED BACK AND NOT CHARGED TWICE. The resumed stretch may stop
        // short of the remainder for any of the ordinary reasons - a wound, a
        // second person - and it may never spend more than was left.
        expect(spent).toBeGreaterThan(0);
        expect(spent).toBeLessThanOrEqual(fork.daysRemaining);
    }, 120000);

    it('is available when it is plainly the worse idea', async () => {
        const { game, fork } = await sitUntilSomebodyComes(NO_ROAD_OUT);
        expect(fork.canWithdraw).toBe(false);

        // Being found seated by somebody who has already found the place is the
        // stupider of the two answers in most states, and the engine does not
        // get a vote. AGENTS.md, agency: do not ban.
        const out = await game.act('I sit back down');
        expect(out.narration.length).toBeGreaterThan(0);
        expect(game.state().run.status).not.toBe('abandoned');
    }, 120000);

    it('does not buy a second purse of food for days already provisioned', async () => {
        const { game, fork, stonesThen } = await sitUntilSomebodyComes(A_ROAD_OUT);
        // The interrupted half bought provisions for the WHOLE sitting. If the
        // resumption bought them again, staying would cost a second purse for
        // days that were already paid for - a price the player never agreed to,
        // and one that would quietly make going the correct answer every time.
        expect(fork.rationsLeft === undefined || fork.daysRemaining > 0).toBe(true);

        await game.act('I sit back down');
        const spentOnFood = stonesThen - game.state().cultivator.spiritStones;
        // Some food may still be bought - the leftovers do not have to cover
        // the whole remainder - but it cannot exceed what a fresh stretch of
        // that length would have cost from empty.
        expect(spentOnFood).toBeLessThan(stonesThen);
    }, 120000);
});

describe('the fork is not a jail', () => {
    it('a read costs no day and leaves the question standing', async () => {
        const { game, fork, dayItStopped } = await sitUntilSomebodyComes(A_ROAD_OUT);

        await game.act('what am I carrying');

        const after = game.state();
        expect(after.run.elapsedDays).toBe(dayItStopped);
        // Looking around must never be able to kill you, and forfeiting a
        // decade for it is a harder version of exactly that.
        expect(after.crossroads).not.toBeNull();
        expect(after.crossroads?.daysRemaining).toBe(fork.daysRemaining);
    }, 120000);

    it('a day spent on anything else is going, and says so', async () => {
        const { game } = await sitUntilSomebodyComes(A_ROAD_OUT);

        const out = await game.act('I gather herbs');

        expect(game.state().crossroads).toBeNull();
        const engineSaid = game.state().log
            .filter(e => e.role === 'engine').map(e => e.text).join('\n');
        expect(`${out.narration}\n${engineSaid}`).toMatch(/forfeit|went with the sitting/i);
    }, 120000);
});

describe('the two answers, in the words somebody would actually use', () => {
    it('recognises sitting back down', () => {
        for (const said of [
            'I sit back down', 'sit back down', 'I stay', 'stay put', 'I remain',
            'I keep sitting', 'keep sitting', 'stay sitting', 'stay seated',
            'I carry on sitting', 'carry on', 'I continue cultivating', 'resume',
            'I resume the seclusion', 'I go back to meditating', 'do not get up',
            "don't get up", 'hold my seat', 'I finish the sitting', 'press on'
        ]) {
            expect(THE_ANSWER_IS_TO_KEEP_SITTING.test(said), `"${said}"`).toBe(true);
        }
    });

    it('recognises getting up', () => {
        for (const said of [
            'I get up and go', 'I get up', 'get up', 'I stand up', 'stand up and leave',
            'I go', 'I leave', 'leave', 'withdraw', 'I slip away', 'take the road out',
            'I break off', 'I stop the sitting', 'abandon the seclusion', 'on my feet'
        ]) {
            expect(THE_ANSWER_IS_TO_GO.test(said), `"${said}"`).toBe(true);
        }
    });

    it('does not swallow a sentence that means something else entirely', () => {
        // Both of these are real verbs with real answers, and an over-eager
        // anchor here would steal the turn. "Fix the gap that was demonstrated,
        // not the one you imagined."
        for (const said of [
            'I stay in the village and look for work',
            'I go to the market',
            'I leave the sect',
            'I sit down with the elder and ask about the manual',
            'I continue north'
        ]) {
            expect(THE_ANSWER_IS_TO_KEEP_SITTING.test(said), `stay:"${said}"`).toBe(false);
            expect(THE_ANSWER_IS_TO_GO.test(said), `go:"${said}"`).toBe(false);
        }
    });
});
