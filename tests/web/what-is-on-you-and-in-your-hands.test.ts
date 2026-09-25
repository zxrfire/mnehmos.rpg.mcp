/**
 * What is on your body and what is in your hands, and the two families beside
 * it that had no road: giving in with no fight standing, and going to somebody's
 * aid.
 *
 * Every sentence below was measured reaching NOTHING on
 * `scripts/probe-what-a-plain-sentence-reaches.ts`:
 *
 *     I put on the robes     I draw my sword      I surrender
 *     I take off the robes   I drop the sword     I yield
 *     I help her             I save him           I kneel
 *
 * None of them is a new rule. The robes are read by `wearsTheRobesOf`, which
 * the gate and the lecture hall have consulted since the lamp file was written.
 * A drawn blade is read by `attack`'s `opening`, which already priced an ambush.
 * A surrender is what the ground demand's three answers already are. Going to
 * somebody's aid is priced by `whatSteppingInCosts`, which the world's own
 * duelling ground pays every time a bystander saves a loser.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';
import { makeGame, makeGameInWorld } from './harness.js';
import { hadAs, makeObject } from '../../src/engine/world/possessions.js';
import { whatIsInTheirHand } from '../../src/web/what-is-on-you-and-in-your-hands.js';
import { theirWeightIsPutAway } from '../../src/web/keeping-yourself-out-of-sight.js';
import { whetherAFaceIsRemarkable } from '../../src/engine/social/how-a-house-reads-a-face.js';

describe('what a sentence about your own body reaches', () => {
    it.each([
        ['I put on the robes', 'wear'],
        ['I put the robes on', 'wear'],
        ['I wear the sect robes', 'wear'],
        ['I take off the robes', 'take_off'],
        ['I draw my sword', 'draw'],
        ['I unsheathe my blade', 'draw'],
        ['I sheathe my blade', 'put_away'],
        ['I put my sword away', 'put_away'],
        ['I drop the sword', 'drop'],
        ['I throw down my weapon', 'drop']
    ])('%s -> carry/%s', (said, intent) => {
        const plan = parseIntent(said);
        expect(plan.action, said).toBe('carry');
        expect(plan.intent, said).toBe(intent);
    });

    it('says back what was named, and not the sentence around it', () => {
        // The first pass named a thing called "the i put on the robes": the
        // filler in front of the noun was allowed to contain spaces and ran
        // back to the start of the sentence.
        expect(parseIntent('I put on the robes').target).toBe('the robes');
        expect(parseIntent('I draw my jade sword').target).toBe('my jade sword');
    });

    it('leaves a blade aimed at somebody to the swing', () => {
        // `VIOLENCE_WITH_NO_OTHER_READING` owns "draw my sword on him", and the
        // whole of the difference is the word `on` with a person after it.
        expect(parseIntent('I draw my sword on him').action).toBe('attack');
        expect(parseIntent('I attack the bandit').action).toBe('attack');
    });

    it('leaves the pouch and the gift where they were', () => {
        // Two sentences the new rows sit next to and must not take.
        expect(parseIntent('I put the sword in my ring').action).toBe('inventory');
        expect(parseIntent('I give him my robes').action).toBe('give');
    });
});

describe('the blade is a fact, and something reads it', () => {
    /** A sword of their own, in their inventory: a weapon is had like anything else. */
    async function withASword(seed: string) {
        const { game } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        game.atHand!.objects.push(makeObject({
            id: `sword-${cultivator.id}`, name: 'an iron sword', kind: 'artifact', power: 2,
            possessorId: cultivator.id, ownerId: cultivator.id
        }));
        return { game, cultivator };
    }

    it('is in the hand until it is put away, and will not be drawn twice', async () => {
        const { game, cultivator } = await withASword('blade-in-hand');
        expect(whatIsInTheirHand(game.atHand!.objects, cultivator.id)).toBeNull();

        const drawn = await game.act('I draw my sword');
        expect(drawn.toolCalls.some(c => c.action === 'carry' && c.ok)).toBe(true);
        expect(whatIsInTheirHand(game.atHand!.objects, cultivator.id)?.what).toBe('an iron sword');

        // Drawing a sword that is already out is not an act; it is a sentence
        // about a state that already holds, and it says so.
        const again = await game.act('I draw my sword');
        expect(again.toolCalls.some(c => c.action === 'carry' && !c.ok)).toBe(true);

        const away = await game.act('I sheathe my blade');
        expect(away.toolCalls.some(c => c.action === 'carry' && c.ok)).toBe(true);
        expect(whatIsInTheirHand(game.atHand!.objects, cultivator.id)).toBeNull();
    }, 120_000);

    it('will not come out with both hands full, and says what is in them', async () => {
        const { game, cultivator } = await withASword('hands-full');
        for (const n of [1, 2]) {
            game.atHand!.objects.push(hadAs(makeObject({
                id: `chest-${n}`, name: `a lacquered chest ${n}`, kind: 'other', possessorId: cultivator.id
            }), 'held'));
        }
        const tried = await game.act('I draw my sword');
        expect(tried.toolCalls.some(c => c.action === 'carry' && !c.ok)).toBe(true);
        expect(tried.narration ?? '').toMatch(/hands are full/i);
        expect(whatIsInTheirHand(game.atHand!.objects, cultivator.id)).toBeNull();
    }, 120_000);

    it('will not draw a blade they do not have', async () => {
        const { game } = makeGame({ seed: 'no-blade' });
        await game.newRun('Ke Yan');
        const tried = await game.act('I draw my sword');
        expect(tried.toolCalls.some(c => c.action === 'carry' && !c.ok)).toBe(true);
    });

    it('says where robes come from rather than that the words failed', async () => {
        const { game } = makeGame({ seed: 'no-robes' });
        await game.newRun('Ke Yan');
        const worn = await game.act('I put on the robes');
        const said = [worn.narration ?? '', ...worn.toolCalls.map(c => c.summary)].join(' ');
        // The refusal names what would make it answerable - a house hands its
        // robes to its own at its seat - rather than reporting a blank look.
        expect(said.toLowerCase()).toMatch(/robes|seat|roll/);
        expect(worn.toolCalls.some(c => c.action === 'carry')).toBe(true);
    });

    it('will not put down what is not out', async () => {
        const { game } = makeGame({ seed: 'empty-hands' });
        await game.newRun('Ke Yan');
        const dropped = await game.act('I drop the sword');
        expect(dropped.toolCalls.some(c => c.action === 'carry' && !c.ok)).toBe(true);
    });
});

describe('giving in, with nothing swinging at you', () => {
    it.each(['I surrender', 'I yield', 'I give up', 'I kneel', 'I beg for mercy'])(
        '%s reaches the submission and not a swing',
        said => {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('attack');
            expect(plan.intent, said).toBe('give_in');
        }
    );

    it('leaves somebody else\'s knees to the coercion', () => {
        // `MAKING_SOMEBODY_ELSE_DO_IT`: "I make him kneel" shares every word
        // with a surrender and is the opposite act.
        expect(parseIntent('I make him kneel').action).toBe('coerce');
    });

    it('names who is pressing you, and there is nobody', async () => {
        const { game } = makeGame({ seed: 'nobody-pressing' });
        await game.newRun('Ke Yan');
        const gave = await game.act('I surrender');
        // The answer states what is so rather than that the words were not
        // understood: nobody is swinging and nobody is demanding.
        const said = [gave.narration ?? '', ...gave.toolCalls.map(c => c.summary)].join(' ');
        expect(said.toLowerCase()).toMatch(/pressing|demanding|swinging/);
        expect(gave.toolCalls.some(c => c.name === 'engine.parseIntent' && c.action === 'unclear'))
            .toBe(false);
    });
});

describe('going to somebody\'s aid', () => {
    it.each(['I help her', 'I save him', 'I protect her', 'I rescue Lin Yao'])(
        '%s reaches stepping in',
        said => {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('attack');
            expect(plan.intent, said).toBe('step_between');
        }
    );

    it('leaves a hand with the harvest to the work it is', () => {
        // The guard: aid is somebody being saved, not somebody being helped
        // WITH something.
        expect(parseIntent('I help him with the harvest').intent).not.toBe('step_between');
    });

    it('carries what stepping in would cost', async () => {
        const { game } = makeGame({ seed: 'nobody-to-save' });
        await game.newRun('Ke Yan');
        const stepped = await game.act('I save him');
        // A refusal carries the number. What getting between two people costs
        // is `whatSteppingInCosts`, which is what the world's own duelling
        // ground charges - read, never re-derived here.
        const said = [stepped.narration ?? '', ...stepped.toolCalls.map(c => c.summary)].join(' ');
        expect(said).toMatch(/whatSteppingInCosts|costs [0-9]/);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// AND GETTING OUT OF SIGHT, WHICH IS TWO ACTS SHARING A WORD
// ═════════════════════════════════════════════════════════════════════════

describe('what a sentence about not being seen reaches', () => {
    it.each([
        ['I hide', 'self'],
        ['I keep out of sight', 'self'],
        ['I lie low', 'self'],
        ['I hide behind the rocks', 'self'],
        ['I hide my cultivation', 'cultivation'],
        ['I conceal my aura', 'cultivation'],
        ['I mask my realm', 'cultivation'],
        ['I pass for a mortal', 'cultivation'],
        ['I stop hiding my cultivation', 'show'],
        ['I let my aura out', 'show']
    ])('%s -> conceal/%s', (said, intent) => {
        const plan = parseIntent(said);
        expect(plan.action, said).toBe('conceal');
        expect(plan.intent, said).toBe(intent);
    });

    it('leaves hiding FROM somebody to the flight', () => {
        // Who you are hiding from is a person you are getting away from, and
        // the flee row has owned that since it was written.
        const plan = parseIntent('I hide from them');
        expect(plan.action).toBe('move');
        expect(plan.intent).toBe('flee');
    });

    it('leaves a declaration that carries an act with its act', () => {
        // `what-you-are-not-showing.ts` reads a concealment as a MANNER on the
        // act beside it, and that reading is untouched: only the sentence that
        // is nothing but the declaration is this verb.
        expect(parseIntent('hiding my cultivation I ask him where the elder is').action)
            .toBe('interact');
        expect(parseIntent('I hide my cultivation and walk into the town').action).toBe('move');
    });

    it('no longer answers a concealment with a character sheet', () => {
        // The measured softening: `I hide my cultivation` reached `status`.
        expect(parseIntent('I hide my cultivation').action).not.toBe('status');
        expect(parseIntent('I mask my realm').action).not.toBe('status');
    });
});

describe('putting your weight away stands until you say otherwise', () => {
    it('sets one bit, will not set it twice, and takes it off again', async () => {
        const { game, db } = makeGame({ seed: 'weight-away' });
        const { cultivator } = await game.newRun('Ke Yan');

        expect(theirWeightIsPutAway(db, cultivator.id)).toBe(false);

        const away = await game.act('I hide my cultivation');
        expect(away.toolCalls.some(c => c.action === 'conceal' && c.ok)).toBe(true);
        expect(theirWeightIsPutAway(db, cultivator.id)).toBe(true);

        // It STANDS - which is the whole reason the bit exists. An ordinary
        // turn in between does not undo it.
        await game.act('I look around');
        expect(theirWeightIsPutAway(db, cultivator.id)).toBe(true);

        const again = await game.act('I conceal my aura');
        expect(again.toolCalls.some(c => c.action === 'conceal' && !c.ok)).toBe(true);

        const shown = await game.act('I stop hiding my cultivation');
        expect(shown.toolCalls.some(c => c.action === 'conceal' && c.ok)).toBe(true);
        expect(theirWeightIsPutAway(db, cultivator.id)).toBe(false);
    });

    it('will not put back what was never put away', async () => {
        const { game, db } = makeGame({ seed: 'nothing-hidden' });
        const { cultivator } = await game.newRun('Ke Yan');
        const shown = await game.act('I stop hiding my cultivation');
        expect(shown.toolCalls.some(c => c.action === 'conceal' && !c.ok)).toBe(true);
        expect(theirWeightIsPutAway(db, cultivator.id)).toBe(false);
    });

    it('answers hiding yourself with the room rather than with a stat', async () => {
        const { game } = makeGame({ seed: 'out-of-sight' });
        await game.newRun('Ke Yan');
        const hidden = await game.act('I hide');
        const said = [hidden.narration ?? '', ...hidden.toolCalls.map(c => c.summary)].join(' ');
        // Derived per looker, and it says how many were read rather than
        // producing a hidden-ness number.
        expect(hidden.toolCalls.some(c => c.action === 'conceal' && c.ok)).toBe(true);
        expect(said.toLowerCase()).toMatch(/nobody|place|sight|here/);
    });
});

describe('the engine does not show the player its own account of itself', () => {
    /**
     * The defect this pins, which shipped and was found by reading output
     * rather than by any test.
     *
     * `factsForToolResult(headline, lines, prose)` takes PROSE third, and both
     * of this session's new verb files handed it the STRUCTURE string. So every
     * successful answer printed the engine's account of itself to the player -
     * *"carry/draw: FLAG_BLADE_IN_HAND = "my sword" on turn 0. Read by
     * attack..."* - and left the operator's channel empty.
     *
     * It reaches the player on three live paths: no provider configured, the
     * provider unavailable, and the narration discarded for contradicting the
     * engine, where the fallback shown is `facts.prose`.
     *
     * Asserted on the PROSE rather than on the narration, because prose is the
     * field all three paths render and the one a mistake lands in.
     */
    const THE_ENGINE_TALKING_ABOUT_ITSELF =
        /FLAG_[A-Z_]+|carry\/|conceal\/|apparentOrdinal|whatTheyCanPlaceAbout|holdsTheTokenOf|Nothing was written|no day passed/;

    it.each([
        ['I draw my sword', 'carry'],
        ['I hide my cultivation', 'conceal'],
        ['I hide', 'conceal']
    ])('%s says what happened, not how it was recorded', async (said, verb) => {
        const { game } = makeGame({ seed: `channels-${verb}-${said.replace(/\W+/g, '-')}` });
        await game.newRun('Ke Yan');
        const turn = await game.act(said);
        expect(
            turn.narration,
            `the player was shown the engine's own account for "${said}"`
        ).not.toMatch(THE_ENGINE_TALKING_ABOUT_ITSELF);
        // And the operator's channel is not empty: the account has to be
        // somewhere, and the summary is where an operator reads it.
        const noted = turn.toolCalls.map(call => call.summary).join(' ');
        expect(noted.length, `nothing was filed for the operator on "${said}"`)
            .toBeGreaterThan(20);
    });
});

describe('a house reads a blade the way it reads the robes', () => {
    /**
     * The gate half of what `FLAG_BLADE_IN_HAND` was owed, and the header of
     * that flag asked for it in these words: a drawn blade is the same KIND of
     * fact as the robes, something a stranger sees without being told, and it
     * belongs beside `inTheRobes` rather than as a refusal of its own.
     *
     * Asserted on the ENGINE read rather than through a world, because what is
     * being pinned is the order of the clauses: a blade is remarkable above the
     * robes, because the robes are what somebody blends in with, and below a
     * known face, because "they know you" is the better answer when both hold.
     */
    const inTheRobesAndOrdinary = {
        registers: true,
        knowsThem: false,
        inTheRobes: true,
        takenForRung: 3,
        strongestOfTheHouse: 9,
        houseSize: 400,
        groundUnderDuress: false
    } as const;

    it('is ordinary in the robes with nothing in hand', () => {
        const read = whetherAFaceIsRemarkable({ ...inTheRobesAndOrdinary });
        expect(read.remarkable).toBe(false);
        expect(read.turnedOn).toBe('nobody_in_particular');
    });

    it('stands out with a blade out, robes or no robes', () => {
        const read = whetherAFaceIsRemarkable({ ...inTheRobesAndOrdinary, bladeInHand: true });
        expect(read.remarkable).toBe(true);
        expect(read.turnedOn).toBe('a_blade_in_the_hand');
        expect(read.because).toContain('blade');
    });

    it('still answers a known face with the face', () => {
        // Both hold, and the better reason is the one about the person.
        const read = whetherAFaceIsRemarkable({
            ...inTheRobesAndOrdinary, knowsThem: true, bladeInHand: true
        });
        expect(read.turnedOn).toBe('known');
    });

    it('does not read a sheathed blade as drawn', () => {
        // The field is optional and absent means sheathed, which is what
        // everybody is unless they have said otherwise.
        expect(whetherAFaceIsRemarkable({ ...inTheRobesAndOrdinary, bladeInHand: false }).turnedOn)
            .toBe('nobody_in_particular');
    });
});
