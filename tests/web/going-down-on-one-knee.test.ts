/**
 * The player can yield, which they could not.
 *
 * `spare` has existed since the fight engine did: the player stops, with the
 * other one alive, because they chose to. It had no other side. An NPC can go
 * down on one knee in front of the player - `wouldTheyKneel` decides it, and
 * the square then offers to make them turn out their pockets - and the player
 * could not do it back.
 *
 * Measured before this: "I kneel" reached `coerce`, because every phrasing of
 * kneeling anywhere in the corpus was about making somebody ELSE do it.
 */

import { describe, expect, it } from 'vitest';

import { whatTheySaidInTheFight } from '../../src/web/fight-answers';

const kindOf = (said: string): string | undefined =>
    whatTheySaidInTheFight(said)?.kind;

describe('saying it', () => {
    it('reads every ordinary way of giving in', () => {
        for (const said of [
            'I kneel',
            'I yield',
            'I surrender',
            'I beg for mercy',
            'I give up',
            'I throw down my sword',
            'I am beaten',
            'you win'
        ]) {
            expect(kindOf(said), said).toBe('yield');
        }
    });

    /**
     * The three it has to stay clear of are all in the same file and share its
     * words. Breaking off is leaving where this is staying; guarding spends the
     * round; and `spare` is this act from the other end.
     */
    it('is none of the answers next door', () => {
        expect(kindOf('I back off')).toBe('break_off');
        expect(kindOf('I block his sword')).toBe('guard');
        expect(kindOf('I spare him')).toBe('spare');
        expect(kindOf('I let him hit me')).toBe('press');
        expect(kindOf('I keep swinging')).toBe('strike');
    });

    /**
     * AND WHOSE KNEES. "I make him kneel" is a coercion and read as a surrender
     * until the guard was there: the sentence is about kneeling and nothing in
     * it said whose.
     */
    it('never reads putting somebody else down as going down', () => {
        expect(kindOf('I make him kneel')).not.toBe('yield');
        expect(kindOf('I beat him until he kneels')).not.toBe('yield');
        expect(kindOf('I force them to submit')).not.toBe('yield');
    });
});
