/**
 * Design guards for the name that did not survive phase 1.
 *
 * Reported from play, with the target standing in the square:
 *
 *     > ADMIN encounter claire ordinal=29
 *     ADMIN · ENCOUNTER SPAWNED   Opponent: claire   Standing at: Cloud Gate
 *     > I coerce claire to hand over her stuff, all of it
 *     Nobody in particular.
 *     Unresolved party: no subject named for a confrontation.
 *
 * The owner read that as people not persisting between turns, which is the
 * right thing to read it as from a chair: you put somebody in front of the
 * player and the game then behaves as though nobody is there. Nothing had
 * been forgotten - the verb arrived with an empty target.
 */

import { describe, it, expect } from 'vitest';

import {
    theNameTheVerbDropped,
    type SomebodyStandingHere
} from '../../src/web/the-name-the-verb-dropped.js';

const claire: SomebodyStandingHere = { id: 'npc-claire', name: 'claire' };
const bai: SomebodyStandingHere = { id: 'npc-bai', name: 'Bai Minping' };
const ru: SomebodyStandingHere = { id: 'npc-ru', name: 'Ru' };
const anwei: SomebodyStandingHere = { id: 'npc-anwei', name: 'Ru Anwei' };

describe('the name the verb dropped', () => {
    it('finds the person the reported sentence named', () => {
        expect(theNameTheVerbDropped(
            'I coerce claire to hand over her stuff, all of it', [claire, bai]
        )).toEqual(claire);
    });

    it('does not care about case, because a player does not capitalise', () => {
        expect(theNameTheVerbDropped('i attack CLAIRE', [claire])).toEqual(claire);
        expect(theNameTheVerbDropped('I attack Claire', [claire])).toEqual(claire);
    });

    it('survives a possessive, which is how a target is usually named', () => {
        // "I take claire's purse" is the commonest shape of all.
        expect(theNameTheVerbDropped("I take claire's purse", [claire])).toEqual(claire);
    });

    it('survives ordinary punctuation around the name', () => {
        expect(theNameTheVerbDropped('claire, hand it over', [claire])).toEqual(claire);
        expect(theNameTheVerbDropped('I hit claire.', [claire])).toEqual(claire);
    });

    it('matches whole words only, so a short name is not found inside a longer one', () => {
        // The reason the padding exists: on a large roster this is not
        // hypothetical, and resolving it would act on somebody unnamed.
        const an: SomebodyStandingHere = { id: 'npc-an', name: 'An' };
        expect(theNameTheVerbDropped('I attack Chan', [an])).toBeNull();
    });

    it('takes the longest name, so a full name beats a given name standing beside it', () => {
        expect(theNameTheVerbDropped('I attack Ru Anwei', [ru, anwei])).toEqual(anwei);
    });

    it('refuses when two different people are named, rather than picking one', () => {
        // Two names is a sentence the engine has no business choosing a victim
        // out of. It stays refused and the player says which.
        expect(theNameTheVerbDropped('I set claire on Bai Minping', [claire, bai])).toBeNull();
    });

    it('returns nothing when the person named is not standing here', () => {
        expect(theNameTheVerbDropped('I attack claire', [bai])).toBeNull();
    });

    it('returns nothing for an empty or missing sentence', () => {
        expect(theNameTheVerbDropped(undefined, [claire])).toBeNull();
        expect(theNameTheVerbDropped('   ', [claire])).toBeNull();
    });

    it('returns nothing when nobody is standing here at all', () => {
        expect(theNameTheVerbDropped('I attack claire', [])).toBeNull();
    });

    it('does not guess at a near miss, because the target was never named', () => {
        // `best()` handles approximate spelling on the path where a target IS
        // present. Here there is none, so a close match would be an act
        // against somebody the player did not mention.
        expect(theNameTheVerbDropped('I attack clair', [claire])).toBeNull();
        expect(theNameTheVerbDropped('I attack somebody', [claire])).toBeNull();
    });
});
