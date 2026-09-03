/**
 * "Where should I start" is a direction question wearing the word `where`.
 *
 * Played by a fresh nobody in Sweetspring Isle: **"I've got thirty stones and no idea
 * what I'm doing. Where should I start?"** came back as a gazetteer - nine
 * places Sweetspring Isle could be left for, each with its qi rate. The player was not
 * asking for a destination.
 *
 * `ASKING_WHAT_IS_POSSIBLE` is the rule that already existed for this family,
 * and it is the rule that needed fixing rather than a new pattern beside it.
 * Two things were wrong with it: it had no vocabulary for the direction family,
 * and it was anchored so tightly that a person who says they are lost before
 * asking - which is how people ask this - fell out of it.
 *
 * MEASURED, and the number is why this is the rule rather than a pattern: 0 of
 * 12 ways of asking reached the surface before, and two of them reached
 * `ceiling`, the read about how far a MANUAL goes, which is a plausible-looking
 * answer to a question nobody asked.
 *
 * AND IT ALSO STOPS THE SEMANTIC TIER GUESSING. `theTableMeantIt` reads this
 * same pattern, so a sentence it covers is one tier 3 may not re-route. With
 * the tier live and this pattern unwidened, "where should I start" was answered
 * `market`; widened, it stays `unclear`, which is the route to the answer.
 */

import { ASKING_WHAT_IS_POSSIBLE, ABOUT_A_MANUAL } from '../../src/web/what-is-worth-doing-standing-here';

/** The predicate as `turn-engine.ts` actually applies it. */
const asksWhatThereIsToDo = (line: string) =>
    ASKING_WHAT_IS_POSSIBLE.test(line) && !ABOUT_A_MANUAL.test(line);

describe('asking what there is to do', () => {
    it('reaches the direction family, which had no line at all', () => {
        for (const line of [
            'Where should I start?',
            'where do I begin',
            'how do I get started',
            'where do I go from here',
            'what is worth doing here',
            'what should I be doing'
        ]) {
            expect(asksWhatThereIsToDo(line), line).toBe(true);
        }
    });

    /**
     * A person who is lost says so before they ask. The played line is two
     * sentences and the question is the second.
     */
    it('tolerates somebody saying they are lost first', () => {
        expect(asksWhatThereIsToDo(
            "I've got thirty stones and no idea what I'm doing. Where should I start?"
        )).toBe(true);
        expect(asksWhatThereIsToDo('I have no idea what I am doing')).toBe(true);
    });

    it('keeps everything it already answered', () => {
        for (const line of [
            'what can I do here', 'what can I do', 'what now', 'help',
            'what is there to do', 'what are my options'
        ]) {
            expect(asksWhatThereIsToDo(line), line).toBe(true);
        }
    });
});

/**
 * THE ANCHORS ARE THE NARROWNESS AND THEY STAY.
 *
 * The preamble is allowed only after a FINISHED sentence, which is what keeps
 * the widening from swallowing questions that merely start the same way.
 */
describe('and it takes nothing from the questions next door', () => {
    it('leaves a question with an object alone', () => {
        for (const line of [
            'what can I do about my torn meridian',
            'where should I go to find a teacher',
            'where do I buy a manual',
            'what should I do with the manual',
            'where should I travel',
            'what can I do for him'
        ]) {
            expect(asksWhatThereIsToDo(line), line).toBe(false);
        }
    });

    /** The manual read owns "my options at this ceiling", and keeps it. */
    it('leaves the manual read its own question', () => {
        expect(asksWhatThereIsToDo('what are my options at this ceiling')).toBe(false);
    });

    it('is not a statement of intent', () => {
        expect(asksWhatThereIsToDo('I start cultivating')).toBe(false);
    });
});
