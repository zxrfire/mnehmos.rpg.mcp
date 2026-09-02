/**
 * What the two narrators must share, now that "they read a sentence the same
 * way" has been measured and is false.
 *
 * `narrator.ts` used to say, above the composed reader: *"so the two narrators
 * read a sentence the same way. They must."* They do not. Measured on a real
 * run, deterministic reader against ollama gemma4:26b, the same sentence back
 * to back:
 *
 *   [deterministic] "I steal from Ji Wanniang"
 *      -> interact(steal). Refused, reached their house, reprisal, a serious
 *         wound, 20 of 40 health.
 *   [model]         "I steal from Ji Wanniang"
 *      -> attack(Ji Wanniang). combat_manage.resolve.
 *
 * Three samples of the same sentence gave three different verbs. But agreement
 * is the wrong invariant and `AGENTS.md` says why: the same act means different
 * things in different situations, the table cannot see the situation, and a
 * model that agreed with the table in every case would be a slower table.
 *
 * The invariant this file pins instead:
 *
 * > **The model may read a sentence any way it likes. What it may not do is be
 * > the reason a turn became dangerous.**
 *
 * One-directional. De-escalation is free, and so is any move between two verbs
 * the deterministic reader would already have called dangerous. The line is
 * `TIME_CONSUMING_ACTIONS`, which `actions.ts` already keeps as the floor on
 * what an unread sentence may reach - so nothing here is a second opinion about
 * what a verb costs.
 */

import { describe, expect, it } from 'vitest';

import { ProviderNarrator } from '../../src/web/narrator';
import { parseIntent, TIME_CONSUMING_ACTIONS, type ActionName } from '../../src/web/actions';
import { readyTheTier, verbForASentenceThePatternsMissed } from '../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for';
import { ScriptedProvider } from './harness';

function modelSaying(json: string) {
    return new ProviderNarrator(new ScriptedProvider({ plans: [json] }), { model: 'test' });
}

const dangerous = (action: ActionName) =>
    (TIME_CONSUMING_ACTIONS as readonly ActionName[]).includes(action);

describe('a model may read a sentence differently', () => {
    it('takes the model\'s verb when neither reading is dangerous', async () => {
        // The whole point of having a model: "I steal from X" is `interact` to
        // the table and the model called it a deception. Both are asks, both
        // resolve through the same machine at the same price, and the routing
        // row says which was chosen.
        const plan = await modelSaying('{"action":"interact","intent":"deceive"}')
            .plan('I steal from Ji Wanniang', '');
        expect(plan.action.action).toBe('interact');
        expect(plan.source).toBe('model');
    });

    it('takes the model\'s verb when the deterministic reading is dangerous too', async () => {
        // Nothing is being protected here: the reader with no model reaches a
        // verb that can already spend the player, so the model choosing a
        // different one of those costs nothing that was not already on the
        // table.
        const said = 'I go for him';
        expect(dangerous(parseIntent(said).action)).toBe(true);
        const plan = await modelSaying('{"action":"coerce"}').plan(said, '');
        expect(plan.action.action).toBe('coerce');
        expect(plan.source).toBe('model');
    });

    it('takes the model\'s verb when it is CHEAPER than the table\'s', async () => {
        // De-escalation is free and is often the better reading. `AGENTS.md`:
        // drawing a sword is a threat in a negotiation, an opening in a duel,
        // and a courtesy at a weapon-house gate.
        const said = 'I draw my blade';
        const plan = await modelSaying('{"action":"interact","intent":"threaten"}').plan(said, '');
        expect(plan.action.action).toBe('interact');
        expect(plan.source).toBe('model');
    });
});

describe('but it may not be why the turn became dangerous', () => {
    it('declines an ask read as a fight, and says so', async () => {
        // The measured case. The table reads this as `interact`, which cannot
        // spend a day or write a wound; the model called it a duel to humiliate.
        const said = 'I steal from Ji Wanniang';
        expect(dangerous(parseIntent(said).action)).toBe(false);

        const plan = await modelSaying('{"action":"attack","target":"Ji Wanniang","intent":"humiliate"}')
            .plan(said, '');

        expect(plan.action.action).toBe('interact');
        expect(plan.source).toBe('fallback');
        expect(plan.note).toMatch(/may not be the reason a turn became dangerous/);
        // And the refusal names a route, which is the floor at every rung.
        expect(plan.note).toMatch(/Say it plainly/);
    });

    it('declines a free read read as a decade in a cave', async () => {
        const plan = await modelSaying('{"action":"seclude","days":3650}')
            .plan('what is this place like now', '');
        expect(plan.action.action).toBe('look');
        expect(plan.source).toBe('fallback');
    });

    it('never lets model mode cost more than local mode for the same words', async () => {
        // The property behind the three cases above, swept over the verbs that
        // can spend the player. Whatever the model answers, the turn is never
        // dangerous unless the reader with no model behind it would have made
        // it dangerous too.
        await readyTheTier();
        const SAFE_TO_THE_READER = [
            'I steal from Ji Wanniang',
            'what is this place like now',
            'what is for sale here',
            'I speak to the woman by the well',
            'what am I carrying'
        ];
        for (const said of SAFE_TO_THE_READER) {
            const withoutAModel = await verbForASentenceThePatternsMissed(said, parseIntent(said));
            expect(dangerous(withoutAModel.action), `${said} is meant to be a safe read`).toBe(false);

            for (const verb of ['attack', 'coerce', 'seclude', 'breakthrough', 'descend'] as const) {
                const plan = await modelSaying(`{"action":"${verb}"}`).plan(said, '');
                expect(
                    dangerous(plan.action.action),
                    `"${said}" read as ${verb} by the model reached ${plan.action.action}`
                ).toBe(false);
            }
        }
    }, 120_000);
});
