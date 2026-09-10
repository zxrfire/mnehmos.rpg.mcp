/**
 * "I run him through" turned the player's back and had them flee.
 *
 * FOUND BY PLAYING, and it is the worst thing measured in `fight-answers.ts`.
 *
 * `THE_ANSWER_IS_TO_BREAK_OFF` is deliberately the widest list in that file,
 * and its own header says why: *"it is the answer somebody reaches for when
 * they are frightened and typing fast, and a flight that fails to parse is the
 * exact death the multi-turn fight exists to make answerable."*
 *
 * Both halves of that are right. What it did not account for is that its two
 * widest words - `run` and `escape` - are also the two that appear in the
 * commonest KILLING sentences the genre has. Ten sentences through the real
 * reader, seven of them wrong:
 *
 *     "I run him through"                        -> break_off
 *     "I run my blade through his chest"         -> break_off
 *     "I run him down"                           -> break_off
 *     "I strike him down before he can escape"   -> break_off
 *     "I cut off his escape"                     -> break_off
 *     "I block his escape route"                 -> break_off
 *     "I stop him running"                       -> break_off
 *
 * Every one is a player pressing an attack or closing off somebody else's way
 * out, and every one turned the player's own back inside a live fight. It is
 * the same failure the header describes, pointed the other way: not a flight
 * that fails to parse, but a KILLING that parses as a flight. The cost is the
 * same and it is a death.
 *
 * The distinction the word list could not draw is WHOSE movement is being
 * described. `run` with something on the end of it is transitive, and an escape
 * belonging to `him` is one you are preventing rather than taking. `my escape`
 * is deliberately outside that rule, because making your escape is precisely
 * what this reader exists for.
 *
 * BOTH DIRECTIONS ARE PINNED, and the second list matters more when somebody
 * tightens this later. A guard that narrows the flight list until a frightened
 * player cannot get out has done more damage than the bug it fixed.
 */

import { describe, it, expect } from 'vitest';

import { whatTheySaidInTheFight } from '../../src/web/fight-answers';

const kindOf = (said: string) => whatTheySaidInTheFight(said)?.kind ?? null;

describe('a killing is not a flight', () => {
    /**
     * THE SEVEN THAT FLED. None of these may come back `break_off`.
     *
     * What they come back as is deliberately not asserted here beyond that.
     * `null` is a correct answer and not a refusal - the reader's own doc says
     * so, and the caller then lets the round happen and does what was actually
     * asked, which for a swing at somebody you are already fighting is a strike
     * (`combat-verbs.ts`, "SWINGING AT SOMEBODY YOU ARE ALREADY FIGHTING").
     * Pinning an exact kind here would pin the route rather than the ruling.
     */
    it.each([
        'I run him through',
        'I run my blade through his chest',
        'I run him down',
        'I run Bai Wanchen through',
        'I strike him down before he can escape',
        'I cut off his escape',
        'I block his escape route',
        'I stop him running',
        'I cut off their retreat',
        'I head him off before he can run'
    ])('does not read %j as the player fleeing', said => {
        expect(kindOf(said)).not.toBe('break_off');
    });

    /**
     * AND THE FRIGHTENED TYPIST STILL GETS OUT.
     *
     * The list this guard sits in front of is wide on purpose. Every phrasing
     * here has to keep working, including the bare word and the one with a
     * parry in front of it - which was itself a measured defect once, because
     * an optional tail behind a mandatory space cannot match a bare `run`.
     */
    it.each([
        'I back off',
        'I break off',
        'I disengage',
        'I withdraw',
        'I retreat',
        'I flee',
        'I run',
        'I run away',
        'I run for it',
        'I run off',
        'I parry and run',
        'I escape',
        'I make my escape',
        'I try to get away',
        'I pull back',
        'I leg it',
        "I'm out of here",
        'not worth dying for',
        'I run to the treeline'
    ])('still reads %j as breaking off', said => {
        expect(kindOf(said)).toBe('break_off');
    });

    /**
     * THE ONE THAT DECIDES THE RULE.
     *
     * `my escape` is yours and `his escape` is his, and the possessive is the
     * whole of the difference. A guard written on the word `escape` alone would
     * have to choose one of these and get the other wrong.
     */
    it('tells your own escape from somebody else you are stopping', () => {
        expect(kindOf('I make my escape')).toBe('break_off');
        expect(kindOf('I cut off his escape')).not.toBe('break_off');
    });
});
