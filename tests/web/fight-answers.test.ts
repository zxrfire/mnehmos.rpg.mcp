/**
 * The five sentences, and the rule that they only mean anything inside a fight.
 *
 * A probe of twenty-nine ordinary play sentences through `parseIntent` found
 * eleven that returned `unclear`. Five of them were one family:
 *
 *     "I block his sword"       "I let him hit me"      "I back off"
 *     "I call for help"         "I shout for the wardens"
 *
 * Every one is an answer to something already happening. These tests assert
 * both halves of that: they are read while a fight is standing, and they are
 * NOT verbs - nothing here is consulted when nobody is swinging, so none of
 * them can steal a turn from an ordinary sentence.
 */

import { describe, expect, it } from 'vitest';

import {
    SAY_TO_BREAK_OFF,
    SAY_TO_GUARD,
    SAY_TO_KEEP_SWINGING,
    SAY_TO_PRESS,
    SAY_TO_SHOUT,
    whatTheySaidInTheFight,
    whereTheyAreHeaded,
    whoTheyCalledFor
} from '../../src/web/fight-answers';
import { parseIntent } from '../../src/web/actions';

/** The five that started this, verbatim from the probe. */
const THE_FIVE = [
    'I block his sword',
    'I let him hit me',
    'I back off',
    'I call for help',
    'I shout for the wardens'
] as const;

describe('the five sentences that had nowhere to land', () => {
    it('every one of them now reads as a fight answer', () => {
        for (const said of THE_FIVE) {
            expect(whatTheySaidInTheFight(said), said).not.toBeNull();
        }
    });

    it('and each reads as the act it actually is', () => {
        expect(whatTheySaidInTheFight('I block his sword')!.kind).toBe('guard');
        expect(whatTheySaidInTheFight('I let him hit me')!.kind).toBe('press');
        expect(whatTheySaidInTheFight('I back off')!.kind).toBe('break_off');
        expect(whatTheySaidInTheFight('I call for help')!.kind).toBe('call_for_help');
        expect(whatTheySaidInTheFight('I shout for the wardens')!.kind).toBe('call_for_help');
    });

    it('is still what the verb table says outside a fight, unchanged', () => {
        // THE SAFETY PROPERTY. These are read only while a fight stands, so the
        // ordinary parse of each is untouched - and four of the five still reach
        // nothing from a standing start, which is correct: there is nothing to
        // block when nobody is swinging.
        expect(parseIntent('I block his sword').action).toBe('unclear');
        expect(parseIntent('I let him hit me').action).toBe('unclear');
        expect(parseIntent('I shout for the wardens').action).toBe('unclear');
    });
});

describe('how somebody actually says each of them', () => {
    // AGENTS.md: "if a near-synonym works, the phrasing that fails is a bug",
    // and the failing half is usually the more natural one. Each list below is
    // the three or four ways somebody would really type it.
    const cases: Array<[string, string[]]> = [
        ['guard', [
            'I block', 'I parry his blade', 'I deflect it', 'I get my guard up',
            'I brace for it', 'I defend myself', 'I dodge', 'I duck under it',
            'I try to catch the blow', 'I stay out of his reach'
        ]],
        ['press', [
            'I let him hit me', 'I take the hit', 'I eat the blow and swing',
            'I press in', 'I throw everything I have at him',
            'I ignore the pain and keep going', "I don't defend"
        ]],
        ['break_off', [
            'I back off', 'I back away', 'I break off', 'I disengage',
            'I withdraw', 'I retreat', 'I flee', 'I run for it', 'I give ground',
            'I pull back', 'I get out of here', 'this is not worth dying for'
        ]],
        ['call_for_help', [
            'I call for help', 'I shout for the wardens', 'I scream for help',
            'I yell for the guards', 'somebody help', 'I call for the elders',
            'I shout to my sect brothers', 'get help'
        ]],
        ['strike', [
            'I attack him', 'I hit him again', 'I swing at him', 'I cut at his arm',
            'I keep swinging', 'I finish him'
        ]]
    ];

    for (const [kind, sentences] of cases) {
        it(`${kind}`, () => {
            for (const said of sentences) {
                const read = whatTheySaidInTheFight(said);
                expect(read, said).not.toBeNull();
                expect(read!.kind, said).toBe(kind);
            }
        });
    }
});

describe('what is not a fight answer', () => {
    it('an ordinary sentence is left alone, and the round happens anyway', () => {
        // Not a refusal. The caller lets the round land and then does what was
        // asked, which is the "do not ban" rule applied to a bad idea.
        for (const said of [
            'I cultivate for ten years',
            'I look around',
            'I ask him what he wants',
            'I buy a pill'
        ]) {
            expect(whatTheySaidInTheFight(said), said).toBeNull();
        }
    });

    it('nothing at all is nothing at all', () => {
        expect(whatTheySaidInTheFight('')).toBeNull();
        expect(whatTheySaidInTheFight('   ')).toBeNull();
    });
});

describe('the order the five are read in', () => {
    // The order IS the correctness argument, and each of these is a sentence
    // that contains words from two of the lists.
    it('stepping back while blocking is still blocking', () => {
        // A defensive step is not a flight, and "step back" is deliberately not
        // in the break-off list: somebody leaving says so - "back off", "break
        // off", "run". Reading a step as an exit would end fights the player
        // meant to still be in, which is the more expensive of the two errors.
        expect(whatTheySaidInTheFight('I block and step back')!.kind).toBe('guard');
    });

    it('but somebody who backs off while blocking is leaving', () => {
        // Breaking off is checked first, because it is the one whose failure to
        // parse gets somebody killed.
        expect(whatTheySaidInTheFight('I block and back off')!.kind).toBe('break_off');
        expect(whatTheySaidInTheFight('I parry and run')!.kind).toBe('break_off');
    });

    it('taking the hit to swing is pressing, not guarding', () => {
        expect(whatTheySaidInTheFight('I take the hit and swing')!.kind).toBe('press');
    });

    it('shouting while fighting is shouting', () => {
        expect(whatTheySaidInTheFight('I shout for the wardens and keep swinging')!.kind)
            .toBe('call_for_help');
    });

    it('the panel controls say what a player would say', () => {
        expect(whatTheySaidInTheFight(SAY_TO_GUARD)!.kind).toBe('guard');
        expect(whatTheySaidInTheFight(SAY_TO_PRESS)!.kind).toBe('press');
        expect(whatTheySaidInTheFight(SAY_TO_BREAK_OFF)!.kind).toBe('break_off');
        expect(whatTheySaidInTheFight(SAY_TO_SHOUT)!.kind).toBe('call_for_help');
        expect(whatTheySaidInTheFight(SAY_TO_KEEP_SWINGING)!.kind).toBe('strike');
    });
});

describe('back off to where', () => {
    it('reads the place out of the sentence', () => {
        expect(whereTheyAreHeaded('I back off toward Scarwater')).toBe('Scarwater');
        expect(whereTheyAreHeaded('I run for the Nine Peaks')).toBe('Nine Peaks');
        expect(whereTheyAreHeaded('I retreat back to the ford')).toBe('ford');
    });

    it('does not turn a wish into a place', () => {
        // "somewhere safe" is not a road, and resolving it against the road
        // list would pick whichever name happened to contain the letters.
        expect(whereTheyAreHeaded('I back off to safety')).toBeNull();
        expect(whereTheyAreHeaded('I back away to cover')).toBeNull();
        expect(whereTheyAreHeaded('I back off')).toBeNull();
    });

    it('carries the destination into the answer', () => {
        const read = whatTheySaidInTheFight('I break off and run for Scarwater');
        expect(read).toEqual({ kind: 'break_off', toward: 'Scarwater' });
    });
});

describe('who the shout named', () => {
    it('reads a named party', () => {
        expect(whoTheyCalledFor('I shout for the wardens')).toBe('wardens');
        expect(whoTheyCalledFor('I call for the elders')).toBe('elders');
    });

    it('treats a shout into the air as naming nobody', () => {
        expect(whoTheyCalledFor('I call for help')).toBeNull();
        expect(whoTheyCalledFor('I scream for help')).toBeNull();
    });
});
