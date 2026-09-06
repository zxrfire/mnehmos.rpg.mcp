/**
 * The house words were written out by hand in six files and no two agreed.
 *
 * Measured through the parser before this, with the catalog holding six Courts,
 * three Halls, three Pavilions, two Temples, a Cult, an Alliance and a Grove:
 *
 *   I resign from the sect        sect/leave
 *   I resign from the hall        unclear
 *   I donate to the sect          sect/donate
 *   I donate to the court         unclear
 *   what does my sect teach       sect/curriculum
 *   what does my hall teach       unclear
 *   what does the sect want of me sect/summons
 *   what does the hall want of me request/wants, target "hall"
 *   I ask the Azure Dew Sect …    petition/grant
 *   I ask the Bone Lantern Cult … request/a_thing, at a PERSON of that name
 *   I kill all the demonic sects  the six demonic houses
 *   I kill all the demonic cults  one house called "demonic cults", refused
 *
 * `what-a-house-is-called.ts` is the one list. This is the proof the callers
 * ask it, which `the-nouns-a-house-ends-with.test.ts` cannot see: that test
 * checks the list against the catalog, and every one of the sentences above
 * passed it while failing.
 *
 * THE OTHER HALF IS A REGRESSION GUARD. The whole list dropped into these
 * gates took `tell me about the valley` off `investigate` and `I leave the
 * market` off the market, because the map has an Orchid Valley and a Wind
 * Market on it. A word a player says bare has to mean a body; a house whose
 * name ends in ground is reached by its NAME.
 */

import { parseIntent } from '../../src/web/actions';
import { theSetThisNames } from '../../src/web/acts-over-a-set';
import { makeGame, planned } from './harness';

/** What the verb and intent came out as, in one string, for a table. */
const read = (sentence: string): string => {
    const plan = parseIntent(sentence);
    return plan.intent ? `${plan.action}/${plan.intent}` : plan.action;
};

describe('a house that is not called a Sect', () => {
    it.each([
        ['I resign from the hall', 'sect/leave'],
        ['I leave the cult', 'sect/leave'],
        ['I leave the court', 'sect/leave'],
        ['I leave the alliance', 'sect/leave'],
        ['I donate to the hall', 'sect/donate'],
        ['I donate to the court', 'sect/donate'],
        ['I donate to the pavilion', 'sect/donate'],
        ['where do I stand in the pavilion', 'sect/standing'],
        ['who is in charge of the court', 'sect/standing'],
        ['what does my hall teach', 'sect/curriculum'],
        ['what does my court teach', 'sect/curriculum'],
        ['what does my cult teach', 'sect/curriculum'],
        ['what does the hall want of me', 'sect/summons'],
        ['what does the cult want of me', 'sect/summons']
    ])('reaches the same verb for %s', (sentence, expected) => {
        expect(read(sentence)).toBe(expected);
    });

    /** The plural, which is how somebody with no house asks what there is. */
    it.each(['which courts take people', 'tell me about the courts near here'])(
        'lists houses for %s', sentence => {
            expect(parseIntent(sentence).action).toBe('sect');
        });

    /**
     * A house whose name ends in ground is reached by the name, because the
     * bare word belongs to the map. Both halves of that are load-bearing.
     */
    it.each([
        ['I resign from Crimson Abyss Fortress', 'sect/leave'],
        ['I leave Verdant Spring Valley', 'sect/leave'],
        ['I resign from Silver Island Market', 'sect/leave'],
        ['who is in charge of Clearwater Ward', 'sect/standing']
    ])('reaches the house named in %s', (sentence, expected) => {
        expect(read(sentence)).toBe(expected);
    });

    it.each([
        ['tell me about the valley', 'investigate'],
        ['I leave the market', 'interact/trade'],
        ['I travel to the valley', 'move/travel'],
        ['I search the grove', 'investigate']
    ])('leaves the map its own sentence: %s', (sentence, expected) => {
        expect(read(sentence)).toBe(expected);
    });

    /** Asking a BODY for something is a petition however the body is styled. */
    it.each([
        'I ask the Azure Dew Sect for a manual',
        'I ask the Clear River Alliance for a manual',
        'I ask the Burnt Earth Temple for a manual',
        'I ask the Bone Lantern Cult for a manual',
        'I ask the Ancient Bough Grove for a manual'
    ])('files a petition for %s', sentence => {
        expect(parseIntent(sentence).action).toBe('petition');
    });

    /** And ending one is an ending, not a conversation with it. */
    it.each([
        'I end the Bone Lantern Cult',
        'I disband the Burnt Earth Temple',
        'I destroy the Clear River Alliance'
    ])('reads %s as an act against the house', sentence => {
        expect(parseIntent(sentence).action).toBe('posture');
    });

    /**
     * A leaning said with any house word is a leaning. `demonic cults` was read
     * as ONE house of that name, and the Bone Lantern Cult, the Burnt Earth
     * Temple and the Crimson Abyss Fortress were standing in the set it asked
     * for.
     */
    it.each(['all the demonic cults', 'every demonic temple', 'all the righteous temples'])(
        'reads %s as a leaning rather than a house of that name', phrase => {
            expect(theSetThisNames(phrase)?.kind).toBe('of_alignment');
        });

    /** And the type noun comes off the end whatever it is, so one house resolves. */
    it('asks the catalog about the name and not the type noun', () => {
        expect(theSetThisNames('all of the Bone Lantern Cult'))
            .toMatchObject({ kind: 'members_of', house: 'Bone Lantern' });
        expect(theSetThisNames('all of the Azure Dew Sect'))
            .toMatchObject({ kind: 'members_of', house: 'Azure Dew' });
    });
});

describe('played, in a house whose name ends in Hall', () => {
    /**
     * The whole point: a member types the ordinary sentence about their own
     * body and the engine answers about that body. Before this the same person
     * had to know to call it a sect.
     */
    it('answers a member of Lantern Hall who says hall', async () => {
        const { game } = makeGame({ seed: 'hall-member', worldEnabled: true });
        const { cultivator } = await game.newRun('Hallman');
        game.repos.sects.addMember('sect-lantern-hall', cultivator.id, 2);

        const stood = await game.act('where do I stand in the hall');
        expect(planned(stood).action).toBe('sect');
        expect(stood.narration).toMatch(/Lantern Hall/);

        // `planned` reports the verb the planner chose and not the intent
        // inside it, so the resignation is asserted on the parser and on what
        // the house actually said back.
        expect(read('I resign from the hall')).toBe('sect/leave');
        const left = await game.act('I resign from the hall');
        expect(planned(left).action).toBe('sect');
        expect(left.narration).toMatch(/Lantern Hall/);
    }, 120_000);
});
