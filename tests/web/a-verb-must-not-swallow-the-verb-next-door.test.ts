/**
 * Two collisions found by playing, and the guards against fixing them too hard.
 *
 * The habit both belong to: a rule matches on a bare verb, the bare verb is
 * also half of an idiom that means something completely different, and the
 * player who typed the idiom is charged for the other thing. This file asserts
 * both directions - the sentence that was being swallowed now escapes, and the
 * sentences next to it still reach what they always reached, because the
 * documented failure mode of every previous fix in this area was widening the
 * pattern until it stole from `investigate` and from place resolution.
 */

import { describe, it, expect } from 'vitest';
import {
    parseIntent,
    parseDuration,
    durationAskedFor,
    MAX_CULTIVATION_DAYS,
    TIME_CONSUMING_ACTIONS
} from '../../src/web/actions';

describe('a pocket is not a plant', () => {
    /**
     * `gather` matched on the bare verb `pick`, so a theft aimed at a named
     * person came back "Cloudcap Mushroom, pouched" and "7 days bent over the
     * ground around Iron Gate". Not a refusal, not the act, and irreversible.
     */
    it('does not route pocket-picking to foraging', () => {
        for (const text of [
            "I pick Xiao Suiya's pocket",
            'I pick her pocket',
            "I pick the merchant's purse",
            'I cut his purse',
            'I lift the guard’s purse',
            'I pickpocket the man at the stall'
        ]) {
            expect(parseIntent(text).action, text).not.toBe('gather');
        }
    });

    /**
     * ── WHAT THIS USED TO ASSERT, AND WHY IT CHANGED ─────────────────────
     *
     * "There is no theft-from-a-person action in the closed set, so the honest
     * answer is that the thought does not resolve - which costs no time, no
     * food and no roll. That is the whole point of the fix: the cost, not the
     * verb."
     *
     * The first clause stopped being true. `interact` carries a `steal` intent
     * that resolves through the same pressure model as any other attempt, and
     * its own note in `actions.ts` records that the engine has resolved a theft
     * off a person since that model was wired - only a MODEL could reach it,
     * because the table answered every phrasing with `unclear`.
     *
     * So the honest answer is no longer the refusal. The design owner's ruling
     * is that theft is an ordinary move and **the engine has to be the one that
     * refuses it**; a reader that declines to route it softens the act by
     * omission, which `AGENTS.md` names as the worse of the two failures
     * because it is invisible.
     *
     * The clause that still holds is the second one, and it is what this now
     * asserts: **the cost, not the verb.** Whatever this sentence reaches, it
     * must not be a verb that can spend the player's days. `interact` is in
     * neither `READ_ONLY_ACTIONS` nor `TIME_CONSUMING_ACTIONS` for exactly this
     * reason, and the seven pressing intents are priced by the resolver rather
     * than by the parse.
     */
    it('does not answer it with anything that spends the player\'s life', () => {
        const plan = parseIntent("I pick Xiao Suiya's pocket");
        expect(plan.action).toBe('interact');
        expect(plan.intent).toBe('steal');
        expect(TIME_CONSUMING_ACTIONS).not.toContain(plan.action);
    });

    it('still forages for everything a player would actually forage for', () => {
        for (const text of [
            'I pick herbs',
            'I pick the mushrooms by the stream',
            'I gather herbs around the village',
            'I pick up the roots I dropped',
            'I forage for reagents',
            'I harvest what is growing here'
        ]) {
            expect(parseIntent(text).action, text).toBe('gather');
        }
    });
});

describe('the ceiling on a seclusion is a fact the player is told', () => {
    /**
     * `parseDuration` clamps at MAX_CULTIVATION_DAYS and said nothing about
     * having done so, so "I cultivate for 100000 years" answered "Seclusion of
     * 100 years was intended" - a thousandfold correction that reads like the
     * engine agreeing with you.
     */
    it('clamps, as it must, and the clamp is now recoverable', () => {
        const asked = durationAskedFor('I cultivate for 100000 years');
        const granted = parseDuration('I cultivate for 100000 years');

        expect(granted).toBe(MAX_CULTIVATION_DAYS);
        expect(asked).toBe(100_000 * 365);
        expect(asked!).toBeGreaterThan(granted!);
    });

    it('reads the same as parseDuration on every span the engine will actually run', () => {
        for (const text of [
            'I cultivate for ninety days',
            'I cultivate for three years',
            'I sit for a decade',
            'I sit for half a year',
            'I cultivate for a season',
            'I wait a month'
        ]) {
            expect(durationAskedFor(text), text).toBe(parseDuration(text));
        }
    });

    it('is null on the same sentences parseDuration refuses', () => {
        for (const text of ['I strike the barrier 3 times', 'I look around', 'status']) {
            expect(durationAskedFor(text), text).toBeNull();
            expect(parseDuration(text), text).toBeNull();
        }
    });
});
