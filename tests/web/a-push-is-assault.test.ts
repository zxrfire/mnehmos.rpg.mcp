/**
 * A push is assault. A stabbing is still an attack, just with a different thing.
 *
 * FOUND BY PLAYING, then ruled on directly. The verb table read an ENDING out
 * of the opening sentence: `ConfrontationIntent.goal` was one of
 * `kill | subdue | drive_off | humiliate | coerce`, and a regex picked between
 * them off the player's words, under a comment that said what it thought it was
 * doing - *"SAYING HOW IS SAYING HOW FAR"*.
 *
 * Measured against the real parser, fourteen sentences:
 *
 *     "i attack him"                 -> attack, drive_off
 *     "i run him through"            -> attack, drive_off
 *     "i stab him in the throat"     -> attack, drive_off
 *     "i stab him in the leg"        -> attack, drive_off
 *     "i push him"                   -> UNCLEAR
 *     "i shove him"                  -> UNCLEAR
 *     "i slap him"                   -> UNCLEAR
 *     "i grab him"                   -> UNCLEAR
 *     "i punch him"                  -> UNCLEAR
 *     "i kick him"                   -> UNCLEAR
 *     "i elbow him"                  -> UNCLEAR
 *     "i tackle him"                 -> UNCLEAR
 *
 * Three defects in one table. A killing thrust read as shooing somebody away.
 * A throat and a leg given the SAME answer, so where the blow landed was read
 * and then thrown away. And eight ways of laying hands on a person that the
 * game had no reading for at all - the commonest violence there is, and the
 * game told the player the sentence made no sense.
 *
 * The design owner:
 *
 *   *"just make attacks and drive away the same thing"* -
 *   *"like attacks have severity but it's all an attack"* -
 *   *"a push is assault"* - *"a stabbing is still attack"* -
 *   *"just with a different thing"* - *"it shouldn't be split"* -
 *   *"it depends on how you attack and how the NPC responds"* -
 *   *"do you stab them? where? how hard?"*
 *
 * And the bottom of the scale, which is the part a single severity number
 * cannot hold:
 *
 *   *"i slap his hand is an attack"* - *"and i poke probably gentlest"* -
 *   *"like probably 0 damage"* - *"but you might still annoy someone depending
 *   on relationship"*
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';
import {
    howTheySaidTheySwung,
    whereItWasAimed,
    whatWasInTheHand
} from '../../src/web/how-they-said-they-swung';
import {
    theWorstItCouldDo,
    theOffenceInIt,
    itActsOnTheBody,
    AN_ORDINARY_SWING
} from '../../src/engine/cultivation/how-a-blow-was-thrown';

/** What the parser made of a sentence, as `action` plus the swing. */
const read = (said: string) => {
    const parsed = parseIntent(said);
    return {
        action: parsed?.action,
        thrown: parsed?.thrown,
        target: parsed?.target,
        said: parsed?.thrown
            ? `${parsed.thrown.with}/${parsed.thrown.at}/${parsed.thrown.force}`
            : null
    };
};

describe('laying hands on somebody is an attack', () => {
    /**
     * THE EIGHT THAT REACHED NOTHING. Every one of these was `unclear`.
     */
    it.each([
        'i push him', 'i shove him', 'i slap him', 'i grab him',
        'i punch him', 'i kick him', 'i elbow him', 'i tackle him',
        'i poke him', 'i headbutt him', 'i wrestle him', 'i club him over the head'
    ])('routes %j to a fight rather than to nothing', said => {
        const got = read(said);
        expect(got.action).toBe('attack');
        // And it found the person, which is the half that would have turned an
        // `unclear` into "nothing to swing at" - a worse answer than the one it
        // replaced.
        expect(got.target).toBeTruthy();
    });

    /**
     * A POKE IS NOT A SHOVE IS NOT A PUNCH IS NOT A THRUST. One verb, and the
     * severity is the three fields rather than a different branch.
     */
    it.each([
        ['i poke him', 'open_hand/unstated/a_poke'],
        ['i shove him', 'open_hand/unstated/light'],
        ['i punch him', 'fist/unstated/committed'],
        ['i run him through', 'edge/unstated/everything'],
        ['i strangle him', 'open_hand/throat/everything'],
        ['i break his neck', 'open_hand/spine/everything'],
        ['i club him over the head', 'blunt/head/committed']
    ])('reads %j as one attack at its own severity', (said, expected) => {
        expect(read(said).said).toBe(expected);
    });

    /**
     * THE ONE THAT NAMED THE DEFECT. A throat and a leg were the same answer.
     */
    it('tells a throat from a leg, which the goal model could not', () => {
        expect(read('i stab him in the throat').said).toBe('edge/throat/committed');
        expect(read('i stab him in the leg').said).toBe('edge/limb/committed');
    });

    /**
     * AND THE BARE FORM IS A FIGHT, NOT A SHOOING.
     *
     * *"like if a player says i attack x, that's an attack"*. The old table
     * fell through to `drive_off` - the weakest ending it had - for every
     * sentence its three regexes did not recognise, which was most of them.
     */
    it('reads a bare attack as a committed swing with whatever is in hand', () => {
        expect(read('i attack him').thrown).toEqual(AN_ORDINARY_SWING);
        expect(read('i attack Bai Wanchen').thrown).toEqual(AN_ORDINARY_SWING);
    });
});

describe('who was struck, once the sentence is taken apart', () => {
    /**
     * FOUR SEPARATE TARGET DEFECTS, all measured, all in the same branch.
     */
    it.each([
        // The part was stripped and the preposition that pointed at it was not.
        ['i stab him in the throat', 'him'],
        // A verb split around the person left its own second half behind.
        ['i run him through', 'him'],
        // The adverb rode along on the name.
        ['i shove him hard', 'him'],
        // A force clause after the part shielded the part from the strip.
        ['i punch him in the face as hard as i can', 'him'],
        // A bare possessive resolved to nobody at all.
        ['i cut his throat', 'him'],
        ['i slap his hand', 'him'],
        ['i go for his throat', 'him'],
        // And a name still survives all of it.
        ['i stab Bai Wanchen in the gut', 'Bai Wanchen']
    ])('extracts the person from %j', (said, who) => {
        expect(read(said).target).toBe(who);
    });

    /**
     * AND THE INNOCENT READINGS SURVIVE.
     *
     * Every verb added here has one - you push through a bottleneck, grab a
     * manual, kick a door. `the manual` was a real regression caught by this
     * list: the person-noun alternation had no closing boundary, so `the man`
     * matched inside `the manual` and taking a book off a shelf became assault.
     */
    it.each(['i grab the manual', 'i kick the door'])(
        'leaves %j alone, because the object is not a person', said => {
            expect(read(said).action).not.toBe('attack');
        }
    );

    it('still reads pushing through a bottleneck as cultivation', () => {
        expect(read('i push through the bottleneck').action).toBe('breakthrough');
    });
});

describe('where it was aimed', () => {
    /**
     * THE INSTRUMENT IS NOT THE TARGET.
     *
     * Measured: *"i elbow him"* came back aimed at a LIMB, because `elbow` is
     * in the limb list. The same trap is set by `knee`, `shoulder`, `head`
     * (headbutt), `hand` and `back`: a bare part-word in a sentence is far more
     * often the thing doing the hitting than the thing being hit.
     */
    it.each(['i elbow him', 'i knee him', 'i headbutt him', 'i shoulder him'])(
        'does not read the instrument in %j as the target', said => {
            expect(whereItWasAimed(said)).toBe('unstated');
        }
    );

    it('reads a location when something actually points at one', () => {
        expect(whereItWasAimed('i stab him in the gut')).toBe('gut');
        expect(whereItWasAimed('i strike at his chest')).toBe('chest');
        expect(whereItWasAimed('i go for the throat')).toBe('throat');
    });

    /**
     * ONE WORD, TWO PLACES. `neck` is the only part whose meaning is set by the
     * verb in front of it, and the two readings are a different injury.
     */
    it('tells an opened neck from a broken one', () => {
        expect(whereItWasAimed('i cut his neck')).toBe('throat');
        expect(whereItWasAimed('i break his neck')).toBe('spine');
    });

    /** A strangling names its own target; nobody writes "by the throat". */
    it('knows a strangling is at the throat without being told', () => {
        expect(whereItWasAimed('i strangle him')).toBe('throat');
    });

    /** And nobody breaks a neck with the sword they happen to be holding. */
    it('knows a neck is broken with hands, not with what is in them', () => {
        expect(whatWasInTheHand('i break his neck', 'spine')).toBe('open_hand');
    });
});

describe('what a blow could do, and what it says', () => {
    /**
     * THE CEILING OF THE ACT. Not the outcome - the outcome is the engine's,
     * weighed against the body it landed on and the gap between the two of
     * them. This is what the swing itself was good for.
     */
    it.each([
        ['i poke him in the chest', 'nothing_at_all'],
        ['i shove him', 'a_bruise'],
        ['i punch him', 'a_beating'],
        ['i stab him in the leg', 'a_wound_that_stays'],
        ['i cut his throat', 'a_death'],
        ['i strangle him', 'a_death'],
        ['i club him over the head', 'a_death']
    ])('reads the worst %j could do', (said, worst) => {
        expect(theWorstItCouldDo(howTheySaidTheySwung(said))).toBe(worst);
    });

    /**
     * ZERO IS ZERO, BY CONSTRUCTION AND NOT BY DEGREE.
     *
     * *"i poke probably gentlest"* - *"like probably 0 damage"*. Which is why
     * the adverb cannot promote it: a poke thrown hard is still a poke, and
     * letting `hard` raise it would make the gentlest act in the game into a
     * real blow on one word.
     */
    it('keeps a poke at zero however it is described', () => {
        expect(itActsOnTheBody(howTheySaidTheySwung('i poke him'))).toBe(false);
        expect(itActsOnTheBody(howTheySaidTheySwung('i poke him hard'))).toBe(false);
    });

    /**
     * AND ZERO DAMAGE IS NOT ZERO CONSEQUENCE.
     *
     * *"but you might still annoy someone depending on relationship"* - so the
     * offence is a SECOND reading of the same blow, and it runs the other way
     * along most of the scale. The acts people kill each other over are near
     * the bottom of the damage range.
     *
     * What the offence is WORTH is not decided here: it is weighed against what
     * these two already are to each other, which lives with the relationships.
     * This is only how much is IN the act.
     */
    it('carries offence where it carries no damage at all', () => {
        const poke = howTheySaidTheySwung('i poke him');
        expect(itActsOnTheBody(poke)).toBe(false);
        expect(theOffenceInIt(poke)).not.toBe('none');
    });

    it('rates an open hand as the insult, and a committed blow as the violence', () => {
        // *"i slap his hand is an attack"* - and it is the most contemptuous
        // one in the list, which is exactly why somebody aims there.
        expect(theOffenceInIt(howTheySaidTheySwung('i slap his hand'))).toBe('contempt');
        // A punch treats them as a threat. A slap treats them as furniture.
        expect(theOffenceInIt(howTheySaidTheySwung('i punch him'))).toBe('none');
    });
});
