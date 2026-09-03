/**
 * The other axis, and the guards that keep it honest.
 *
 * `costsTheAskerNothing` answers whether an act SPENDS - a turn, a day, or the
 * purse. Nothing in `src/` answered whether an act can HURT you, and the two
 * are different questions: buying a manual spends and is safe, and attacking
 * somebody spends no day and can end the run inside one turn.
 *
 * Measured before this existed, over three pinned worlds and 102 squares of the
 * web layer's suggestion strip: every square scored 1.000 on "does this square
 * offer at least one costly line", so the cut carried no information at all.
 * `HOW_EACH_VERB_CAN_END_BADLY` is the second axis, and these are the four
 * claims it has to keep true.
 */

import { describe, it, expect } from 'vitest';
import {
    ACTION_NAMES,
    READ_ONLY_ACTIONS,
    FALLBACK_ACTION,
    HOW_EACH_VERB_CAN_END_BADLY,
    INTERACT_SETTLES_NOTHING,
    canEndBadly,
    canHurtYou
} from '../../src/web/action-set';
import { PRESSING_SOMEBODY, costsTheAskerNothing } from '../../src/web/asking-is-not-doing';
import { WHAT_EACH_VERB_IS_FOR } from '../../src/web/what-each-verb-is-for-in-the-players-words';

describe('every verb has been classified', () => {
    /**
     * The compiler already refuses a missing key - the table is a full
     * `Record<ActionName, …>` - so this is the runtime half of the same claim,
     * and it is here to catch the other direction: a key that outlives the verb
     * it was written for.
     */
    it('says something about every action and nothing about anything else', () => {
        expect(Object.keys(HOW_EACH_VERB_CAN_END_BADLY).sort())
            .toEqual([...ACTION_NAMES].sort());
    });
});

describe('a free read can never reach the body', () => {
    /**
     * The invariant that makes the two axes safe to hold side by side. Every
     * channel in `HowAnActCanEndBadly` is behind a span, a resolver, a
     * tribulation, the deviation engine or the toxicity ledger, and a verb that
     * passes no time and changes no cultivator state reaches none of them.
     *
     * If this ever goes red, the finding is not here: something on
     * `READ_ONLY_ACTIONS` has started spending, which is exactly the defect
     * that put `interact` on the wrong list for months.
     */
    it('holds for all of READ_ONLY_ACTIONS', () => {
        for (const action of READ_ONLY_ACTIONS) {
            expect(canEndBadly(action), action).toEqual([]);
        }
    });

    /**
     * And for the one every misparse lands on, which is the floor the whole
     * parser rests on.
     */
    it('holds for the fallback', () => {
        expect(canHurtYou(FALLBACK_ACTION)).toBe(false);
    });
});

describe('the two axes are orthogonal', () => {
    /**
     * One case per occupied cell, so a change that quietly collapses harm into
     * cost goes red. The fourth cell - costs nothing AND can hurt you - is
     * empty on purpose and is asserted below.
     */
    it('costs something and cannot hurt you', () => {
        expect(costsTheAskerNothing({ action: 'buy' })).toBe(false);
        expect(canHurtYou('buy')).toBe(false);
    });

    it('costs nothing and cannot hurt you', () => {
        expect(costsTheAskerNothing({ action: 'look' })).toBe(true);
        expect(canHurtYou('look')).toBe(false);
    });

    it('costs something and can hurt you', () => {
        expect(costsTheAskerNothing({ action: 'site', intent: 'enter' })).toBe(false);
        expect(canHurtYou('site', 'enter')).toBe(true);
    });

    /**
     * THE EMPTY CELL, RECORDED RATHER THAN ASSUMED.
     *
     * Nothing a `PlannedAction` can express costs nothing and can still hurt
     * you: every channel is behind a verb that spends. `wait` is the sentence
     * that looks like the counterexample - sitting still, and the world can
     * still find you - and it is not one, because waiting spends its days like
     * anything else.
     *
     * What genuinely lands in that cell is not a plan at all. Inside a live
     * fight `I block` and `I keep swinging` are answered by `fight-answers.ts`
     * before the pattern table is reached, spend no day, and can end the run in
     * the round they are typed.
     */
    it('has nothing that costs nothing and can hurt you', () => {
        const free = ACTION_NAMES.filter(a => costsTheAskerNothing({ action: a }));
        expect(free.filter(a => canHurtYou(a))).toEqual([]);
        // And the verb that looks like the exception is not one.
        expect(costsTheAskerNothing({ action: 'wait' })).toBe(false);
        expect(canHurtYou('wait')).toBe(true);
    });
});

describe('the interact split does not drift', () => {
    /**
     * `INTERACT_SETTLES_NOTHING` is the complement of `PRESSING_SOMEBODY`, and
     * the two live in different modules because reversing the import would put
     * a cycle between the classification and the rule that reads it. A second
     * copy of a set is a drift risk, and `AGENTS.md` is explicit that the answer
     * is a test that goes red rather than a comment asking people to be careful.
     *
     * The verb surface declares all eleven intents, so a TWELFTH added on
     * neither side fails here too - which is the case a disjointness check alone
     * would miss.
     */
    it('partitions exactly the intents the verb surface declares', () => {
        const declared = [...(WHAT_EACH_VERB_IS_FOR.interact.intents ?? [])].sort();
        const both = [...PRESSING_SOMEBODY, ...INTERACT_SETTLES_NOTHING].sort();
        expect(both).toEqual(declared);
        expect(both.length).toBe(new Set(both).size);
    });

    it('calls every pressing intent dangerous and every settled one safe', () => {
        for (const intent of PRESSING_SOMEBODY) {
            expect(canHurtYou('interact', intent), intent).toBe(true);
        }
        for (const intent of INTERACT_SETTLES_NOTHING) {
            expect(canHurtYou('interact', intent), intent).toBe(false);
        }
    });

    /**
     * An `interact` with no intent at all is `talk` - `GameService.execute`
     * defaults it there - so the safe reading is the right one, and it matches
     * what `costsTheAskerNothing` already answers for the same plan.
     */
    it('reads a bare interact as the free branch, like the cost axis does', () => {
        expect(canHurtYou('interact')).toBe(false);
        expect(costsTheAskerNothing({ action: 'interact' })).toBe(true);
    });
});

describe('the harm reasoning already written into the cost list survives', () => {
    /**
     * `TIME_CONSUMING_ACTIONS` carries five members that are on it for harm
     * rather than for days, each saying so in its own comment. Promoting that
     * prose to a value is the whole of this table, so the five have to come back
     * dangerous or the promotion lost something.
     */
    it('keeps the five that are on the cost list for harm alone', () => {
        for (const action of ['attack', 'coerce', 'consume_pill', 'learn_technique', 'descend'] as const) {
            expect(canHurtYou(action), action).toBe(true);
        }
    });

    /**
     * And the two that reach `resolveExchange` with this cultivator's body on
     * one side of it name that channel rather than a span, because a fight needs
     * no time at all.
     */
    it('names force where force is what happens', () => {
        expect(canEndBadly('attack')).toEqual(['force']);
        expect(canEndBadly('coerce')).toEqual(['force']);
        expect(canEndBadly('hunt')).toContain('force');
        expect(canEndBadly('site')).toContain('force');
    });
});
