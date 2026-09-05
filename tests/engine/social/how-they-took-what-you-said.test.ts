/**
 * The same sentence, in six squares, taken six ways.
 *
 * *I am from the Dawn Sect* is an introduction, a deterrent, a boast, a claim
 * on hospitality, and a threat, and the words never change. What changes is who
 * is standing there and what has passed between them, so every case below is
 * the SAME `wrongInTheAct` with a different world around it.
 */

import { describe, expect, it } from 'vitest';

import { howTheyTookIt } from '../../../src/engine/social/how-they-took-what-you-said';

/** The sentence, said by somebody standing level with the person hearing it. */
const said = {
    wrongInTheAct: null,
    aboutThem: true,
    feeling: 'nothing_either_way' as const,
    realmsOverTheSpeaker: 0,
    speakerIsBacked: false
};

describe('the same words, and what the hearer makes of them', () => {
    it('is nothing at all to somebody they are not about', () => {
        expect(howTheyTookIt({ ...said, aboutThem: false }).took).toBeNull();
    });

    /** A stranger with no history hears an introduction, and that is all. */
    it('is nothing to a stranger with no history', () => {
        expect(howTheyTookIt(said).took).toBeNull();
    });

    /**
     * The half the words cannot carry. Nothing in the sentence is a wrong; the
     * person hearing it buried somebody over this speaker, and hears it
     * through that.
     */
    it('is a threat to somebody who already has cause', () => {
        expect(howTheyTookIt({ ...said, feeling: 'bitter' }).took).toBe('threatened');
        expect(howTheyTookIt({ ...said, feeling: 'despondent' }).took).toBe('threatened');
    });

    /** Warmth is not cause, and the same sentence lands as nothing again. */
    it('is not a threat from somebody they are grateful to', () => {
        expect(howTheyTookIt({ ...said, feeling: 'grateful' }).took).toBeNull();
    });
});

describe('and who it came from, which the hearer settles before anything else', () => {
    /**
     * *I WILL END THE DAWN SECT* from somebody who cannot reach them, with
     * nobody behind him. The engine does not hear a threat, because there is
     * nothing there to be threatened by - which is the difference between being
     * warned off and being laughed at, and both used to come back as a warning.
     */
    it('is not a threat from somebody who could not do it', () => {
        const declared = { ...said, wrongInTheAct: 'threatened' as const };
        expect(howTheyTookIt({ ...declared, realmsOverTheSpeaker: 3 }).took).toBeNull();
    });

    /** The same words, from a peer, and now there is somebody to answer. */
    it('is a threat from somebody standing level with them', () => {
        expect(howTheyTookIt({ ...said, wrongInTheAct: 'threatened' })
            .took).toBe('threatened');
    });

    /**
     * AND WHAT IS BEHIND HIM COUNTS. The gap did not move; somebody in the
     * square answers for him, and that is the whole of what makes the same
     * sentence land.
     */
    it('is a threat from somebody small with people behind them', () => {
        expect(howTheyTookIt({
            ...said,
            wrongInTheAct: 'threatened',
            realmsOverTheSpeaker: 3,
            speakerIsBacked: true
        }).took).toBe('threatened');
    });

    /**
     * The hearer's own situation is asked BEFORE the ledger, so somebody who
     * has every reason to hate this speaker still does not take a threat from
     * somebody who cannot reach them.
     */
    it('settles who it came from before what it is owed', () => {
        expect(howTheyTookIt({
            ...said,
            feeling: 'despondent',
            realmsOverTheSpeaker: 4
        }).took).toBeNull();
    });
});

describe('and what the hearer themselves did', () => {
    /**
     * The NPC killed three Dawn Sect disciples. The player, who has done
     * nothing to him and holds nothing against him, says *I am from the Dawn
     * Sect*, and means it as an introduction. He does not hear one.
     */
    it('hears a reckoning in an introduction, when they have something to answer for', () => {
        expect(howTheyTookIt({ ...said, theyHaveSomethingToAnswerFor: true }).took)
            .toBe('threatened');
    });

    /** And the man beside him, who killed nobody, hears an introduction. */
    it('is an introduction to the man beside him who did nothing', () => {
        expect(howTheyTookIt({ ...said, theyHaveSomethingToAnswerFor: false }).took)
            .toBeNull();
    });

    /** Guilt is not fear either, from somebody who could not act on it. */
    it('is not a reckoning from somebody who could not bring one', () => {
        expect(howTheyTookIt({
            ...said, theyHaveSomethingToAnswerFor: true, realmsOverTheSpeaker: 4
        }).took).toBeNull();
    });
});

describe('a reader that got it wrong', () => {
    /**
     * The point of the split. A reader calling a boast a threat has not made it
     * one, and a reader missing a threat has not unmade it: both come back to
     * what the person standing there was in a position to take it for.
     */
    it('cannot invent a threat out of somebody who cannot reach them', () => {
        expect(howTheyTookIt({
            ...said,
            wrongInTheAct: 'threatened',
            realmsOverTheSpeaker: 5
        }).took).toBeNull();
    });

    it('cannot unmake one the hearer already had cause for', () => {
        expect(howTheyTookIt({ ...said, wrongInTheAct: null, feeling: 'bitter' }).took)
            .toBe('threatened');
    });
});
