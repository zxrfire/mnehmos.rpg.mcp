/**
 * The two verbs with opposite signs on every consequence in the game.
 *
 * ── WHAT WAS MEASURED ────────────────────────────────────────────────────
 *
 * Played in the UI against ollama:
 *
 *   > I hand Shen Liefeng my two spirit stones
 *
 *   Shen Liefeng: countered.
 *   The approach was labelled "steal"...
 *   Reprisal: injured. Weighed as serious robbery against Shen Kuo.
 *   No possession moved. This wrong takes nothing by its nature; what it
 *   leaves is the reprisal and the grudge.
 *
 * A player tried to hand somebody money. They were charged with robbery, took a
 * wound for it, and came away carrying a grudge from the person they were being
 * generous to. Nothing moved either way, so the entire outcome of the turn was
 * punishment for a reading nobody asked for.
 *
 * ── WHY THE COST GUARD CANNOT SEE THIS ───────────────────────────────────
 *
 * `theModelIsNotWhyThisTurnIsDangerous` compares COST: a model may not turn a
 * turn that could not spend the player into one that can. Both readings here
 * are `interact`-priced - neither is on `TIME_CONSUMING_ACTIONS` - so on that
 * axis they are identical and the guard waves it through.
 *
 * The axis that matters is SIGN. One opens a favour; the other opens a grudge,
 * a reprisal and a wound. A near-miss between them is worse than no match at
 * all, and it is worse in the one direction that punishes somebody for
 * generosity.
 *
 * ── AND IT IS A BOUNDARY RATHER THAN A PRIORITY ──────────────────────────
 *
 * It does not matter which reading is cheaper or which the table reached first.
 * If the sentence reads as a gift with no model in it, no model may turn it
 * into a taking. The reverse is deliberately allowed and is the harmless
 * direction: a model reading a theft as a gift declines the taking and hands
 * the player the reading that costs nobody anything, which the ordinary rule -
 * a model may read a sentence any way it likes - already permits.
 */

import { describe, expect, it } from 'vitest';

import { ProviderNarrator } from '../../src/web/narrator';
import { parseIntent } from '../../src/web/actions';
import { ScriptedProvider } from './harness';

function modelSaying(json: string) {
    return new ProviderNarrator(new ScriptedProvider({ plans: [json] }), { model: 'test' });
}

const A_GIFT = 'I hand Shen Liefeng my two spirit stones';

describe('a gift the model reads as a taking', () => {
    it('reads as a gift with no model in it', () => {
        expect(parseIntent(A_GIFT).action).toBe('give');
    });

    it.each([
        '{"action":"interact","intent":"steal","target":"Shen Liefeng"}',
        '{"action":"coerce","target":"Shen Liefeng"}',
        '{"action":"attack","target":"Shen Liefeng"}'
    ])('is declined: %s', async json => {
        const plan = await modelSaying(json).plan(A_GIFT, '');
        expect(plan.action.action).toBe('give');
        expect(plan.action.intent).not.toBe('steal');
        expect(plan.source).toBe('fallback');
        expect(plan.note).toMatch(/opposite acts/);
        // A refusal names a route, at every rung.
        expect(plan.note).toMatch(/Say it plainly/);
    });

    it('leaves the model alone when it reads the gift as a gift', async () => {
        const plan = await modelSaying('{"action":"give","target":"Shen Liefeng"}').plan(A_GIFT, '');
        expect(plan.action.action).toBe('give');
        expect(plan.source).toBe('model');
    });
});

describe('and the other direction is left alone', () => {
    it('lets a model read a theft as a gift, which costs nobody anything', async () => {
        // Not symmetrical, on purpose. Declining a taking hands the player the
        // harmless reading; declining a gift hands them a grudge.
        const plan = await modelSaying('{"action":"give","target":"Shen Liefeng"}')
            .plan('I steal from Shen Liefeng', '');
        expect(plan.action.action).toBe('give');
        expect(plan.source).toBe('model');
    });

    it('lets a theft stay a theft', async () => {
        const plan = await modelSaying('{"action":"interact","intent":"steal"}')
            .plan('I steal from Shen Liefeng', '');
        expect(plan.action.action).toBe('interact');
        expect(plan.action.intent).toBe('steal');
        expect(plan.source).toBe('model');
    });
});

/**
 * The owner's own acceptance sentence for the whole feature, verbatim.
 *
 * *"I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk
 * away"* - three acts, `steal` then `give` then `move`. Measured before this
 * pass, it produced three faults in one line: the second clause read as
 * `interact` rather than `give`, the recipient came out as "Shen Liefeng's hand,
 * and walk away" - the whole remainder of the sentence, read back to the player
 * as "the approach to it into Shen Liefeng's hand, and walk away" - and the
 * third clause reached nothing at all.
 *
 * Pinned CLAUSE BY CLAUSE. How many steps a model splits it into is the model's
 * to decide - `stepsInTheResponse` reads back whatever it returns - so what is
 * asserted here is the thing this package owns: whatever the split, each clause
 * reads as the act it names.
 */
describe('the owner\'s sentence, one clause at a time', () => {
    it.each([
        ["I take Cao Antao's purse", 'interact', 'steal'],
        ["press it into Shen Liefeng's hand", 'give', undefined],
        ['and walk away', 'move', 'flee']
    ] as ReadonlyArray<readonly [string, string, string | undefined]>)(
        '%s -> %s', (said, verb, intent) => {
            const plan = parseIntent(said);
            expect(plan.action).toBe(verb);
            if (intent !== undefined) expect(plan.intent).toBe(intent);
        }
    );

    it('names the person and not the rest of the sentence', () => {
        // The capture ran to the end of the string, because a lazy `.{2,40}?`
        // against `$` still reaches it when nothing else closes the match. A
        // clause boundary is a clause boundary.
        const whole = "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away";
        const plan = parseIntent(whole);
        expect(plan.target).not.toMatch(/walk away/);
        expect(parseIntent("press it into Shen Liefeng's hand").target).toBe('Shen Liefeng');
    });

    it('takes the possessive off the name, because a name is not a possessive', () => {
        // A target of "Shen Liefeng's" resolves to nobody, which is the shape
        // of every bug this parser has produced.
        expect(parseIntent("I hand the purse to Shen Liefeng's hand").target).toBe('Shen Liefeng');
    });
});
