/**
 * Asking whether there is work, which is not taking any.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO MEASUREMENTS, AND THE SECOND ONE IS WHY THE LABEL EXISTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Found by playing at The Sounding, with a model reading the sentences:
 *
 *   "any work going?"              -> the MARKET read. Millet at one cash, a
 *                                     ferry crossing, manuals at six and nine.
 *   "is anyone hiring around here?" -> a STANDING read. "You are a Stray to the
 *                                     Hollow Bell Wanderers."
 *
 * Both answered confidently, about something else. That is worse than a
 * refusal: a player told the price of millet does not learn that the game
 * misread them, they learn there is no work here, which is false - and `work`
 * is the verb that feeds a starving cultivator.
 *
 * Measured on the deterministic reader, 13 of 18 ordinary ways of asking for a
 * job reached nothing at all.
 *
 * AND ROUTING THEM TO `work` AND STOPPING THERE IS WORSE THAN EITHER. Measured,
 * played, on a fresh run: `any work going?` spent NINETY DAYS as a Shipmaster.
 * Naming no trade is deliberately read as *take any work* - `WORK_UNSPECIFIED`
 * matches the empty string on purpose - so that "I take whatever the village
 * will give me" is not answered with a menu. A question that buys a season is
 * the sentence `misparse.test.ts` is named after.
 *
 * So the two readings are separated by a label, and this file pins both edges
 * of that separation: what must reach the free board, what must still take a
 * job, and what must not move at all.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';

/** Questions. Every one of these must cost nothing. */
const ASKING = [
    'any work going?',
    'any work going',
    'is anyone hiring around here?',
    'is anyone hiring',
    'is there work',
    'is there any work here',
    'is there paying work here',
    'what work is there',
    'who needs a hand',
    'can I earn something here'
];

/** Statements of intent. Every one of these is a request to be given work. */
const TAKING = [
    'looking for work',
    'I am looking for work',
    'I need a job',
    'I need work',
    'I want a job',
    'I ask around for work',
    'I look for work',
    'I take whatever work the village will give me'
];

/**
 * And what must keep the verb it already had.
 *
 * The two the model actually collided with are first: both reads are correct
 * for their own phrasings and widening `work` at their expense would be trading
 * one confident wrong answer for another.
 */
const NOT_ABOUT_WORK: readonly (readonly [string, string])[] = [
    ['what is for sale', 'market'],
    ['what is my standing', 'sect'],
    ['how am I regarded', 'sect'],
    ['what duties are there', 'sect'],
    ['I work on my technique', 'train_technique'],
    ['I ask him for work', 'request'],
    ['what news is there', 'news'],
    ['who is here', 'look']
];

describe('the ways a player asks for a job', () => {
    it('all reach the verb that feeds them', () => {
        const missed = [...ASKING, ...TAKING]
            .map(text => [text, parseIntent(text).action] as const)
            .filter(([, got]) => got !== 'work')
            .map(([text, got]) => `"${text}" -> ${got}`);
        expect(missed, `reached something else: ${missed.join('; ')}`).toEqual([]);
    });

    it('reads the board when it is a question, and never takes a job', () => {
        const taking = ASKING
            .map(text => [text, parseIntent(text)] as const)
            .filter(([, plan]) => plan.intent !== 'board')
            .map(([text, plan]) => `"${text}" -> intent ${plan.intent ?? 'none'}`);
        expect(taking, `a question that would take a job: ${taking.join('; ')}`).toEqual([]);
    });

    it('still takes a job when the sentence is a statement of need', () => {
        const listing = TAKING
            .map(text => [text, parseIntent(text)] as const)
            .filter(([, plan]) => plan.intent === 'board')
            .map(([text]) => text);
        expect(listing, `downgraded to a listing: ${listing.join('; ')}`).toEqual([]);
    });

    it('takes none of the verbs it collided with', () => {
        const moved = NOT_ABOUT_WORK
            .map(([text, expected]) => ({ text, got: parseIntent(text).action, expected }))
            .filter(row => row.got !== row.expected);
        expect(moved, 'the neighbouring reads keep their sentences').toEqual([]);
    });
});

/**
 * Played, because the whole point is what it COSTS, and a plan is not a cost.
 *
 * Measured at the point the player would notice: the run's own clock, before
 * and after. This is the assertion that would have caught the ninety days, and
 * no parse test ever could.
 */
describe('what asking about work costs', () => {
    it('costs nothing, and taking it costs the season', async () => {
        const { game } = await makeGameInWorld({
            seed: 'work-asked', worldSeed: 'tells-world', worldEnabled: true
        });
        await game.newRun('Prober');
        await game.act('I look around');

        for (const question of ['any work going?', 'is anyone hiring around here?', 'is there work']) {
            const before = (await game.state()).run!.elapsedDays;
            const said = await game.act(question);
            const after = (await game.state()).run!.elapsedDays;
            expect(after, `"${question}" spent ${after - before} days`).toBe(before);
            // And it answered about work rather than about the weather or the
            // price of millet, which is what it used to do.
            expect(said.narration, `"${question}"`).toMatch(/going|work|hiring|nobody/i);
        }

        // The other edge. A statement of need still buys the season, because
        // that is what somebody out of stones is asking for.
        const before = (await game.state()).run!.elapsedDays;
        await game.act('I need a job');
        expect((await game.state()).run!.elapsedDays).toBeGreaterThan(before);
    }, 300000);
});
