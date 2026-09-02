/**
 * One extractor bug, six sentences.
 *
 * Every target extractor in `actions.ts` captures `(.{2,80}?)` against `$`.
 * Lazy against an end anchor still runs to the end of the string when nothing
 * else can close the match, so the "name" was everything the player said after
 * the verb. Measured over ordinary play sentences:
 *
 *   "I warn him to stay away from her"  -> "stay away from her"   (should be him)
 *   "I read the manual again"           -> "manual again"
 *   "I practise <an art> for a year"    -> "<an art> for a year"
 *   "I ask about the ruins"             -> a PERSON called "about the ruins"
 *   "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away"
 *                                       -> "it into Shen Liefeng's hand, and walk away"
 *
 * Each one then reaches a resolver that looks the whole phrase up against a
 * catalog, fails, and refuses in terms of the phrase - *"the approach to it
 * into Shen Liefeng's hand, and walk away"*. **A wrong name is worse than no
 * name, because the refusal is then about something the player did not say.**
 *
 * `theNounPhrase` cuts only the tail, and only where the tail cannot be part of
 * a name: a clause boundary, a purpose clause, a second act, a span, a bare
 * adverb. Nothing in any catalog in this world contains a comma, and nothing is
 * named "... for a year" or "... again". The cuts are anchored to the END, so a
 * name that genuinely contains one of these words keeps it.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent, theNounPhrase } from '../../src/web/actions';

describe('a name stops where the name stops', () => {
    it.each([
        ['I warn him to stay away from her', 'him'],
        ['I read the manual again', 'manual'],
        ['I practise the Azure Ripple Art for a year', 'Azure Ripple Art'],
        ['I travel to Nine Peaks', 'Nine Peaks'],
        ['I attack the bandit', 'bandit'],
        ['I sell the Qi Gathering Grass', 'Qi Gathering Grass']
    ])('%s names %s', (said, want) => {
        expect(parseIntent(said).target).toBe(want);
    });

    it('names nobody where the sentence names nobody', () => {
        // `ASK_PIVOT` needs whitespace on both sides and `rest` is trimmed, so
        // a sentence going straight to the topic had no pivot to find and the
        // topic became a PERSON. The player was told nobody by that name was
        // here.
        const plan = parseIntent('I ask about the ruins');
        expect(plan.target).toBeUndefined();
        expect(plan.topic).toBe('ruins');
    });

    it('still names both when the sentence names both', () => {
        const plan = parseIntent('I ask Jiang Anyi about the ruins');
        expect(plan.target).toBe('Jiang Anyi');
        expect(plan.topic).toBe('ruins');
    });

    it('never reaches past a clause boundary', () => {
        const whole = "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away";
        expect(parseIntent(whole).target).not.toMatch(/walk away/);
    });

    it('leaves a name that contains one of the cut words alone', () => {
        // The cuts are anchored to the end of the phrase, so a word that is
        // part of a name survives being one of them.
        expect(theNounPhrase('The Gate Frame With No Gate In It'))
            .toBe('The Gate Frame With No Gate In It');
        expect(theNounPhrase('Nine Peaks')).toBe('Nine Peaks');
        expect(theNounPhrase('Formation hand')).toBe('Formation hand');
    });

    it('does not cut a span that is the whole of what was said', () => {
        // A duration still reaches `parseDuration`, which reads it off the
        // WHOLE sentence and never off the target.
        expect(parseIntent('I cultivate for ten years').days).toBe(3650);
        expect(parseIntent('I go into seclusion for ten years').days).toBe(3650);
    });
});

/**
 * Vocabulary in verbs that already existed, from the same probe.
 *
 * `I check what I am carrying` is worth naming: it was the THIRD distinct
 * phrasing of the pouch question to fail in one day, after "what is in my
 * pouch" reached the bequest-houses lecture and "what am I carrying" answered
 * over an empty pouch. Three agents reached the same question from three
 * directions, which is what a near-synonym gap looks like from the outside.
 */
describe('sentences that reached nothing', () => {
    it.each([
        ['I count my stones', 'inventory'],
        ['I check what I am carrying', 'inventory'],
        ['I drink the pill', 'consume_pill'],
        ['I practise the sword forms', 'train_technique'],
        ['I bow to the elder', 'interact'],
        ['I go looking for the cave', 'investigate']
    ])('%s -> %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });

    it('bows as a greeting rather than as nothing', () => {
        expect(parseIntent('I bow to the elder').intent).toBe('talk');
    });

    it('drills the plural as well as the singular', () => {
        // A word boundary after `form` does not fall before an `s` - the same
        // one-letter miss that hid the sect listing behind `houses`.
        expect(parseIntent('I practise the sword form').action).toBe('train_technique');
        expect(parseIntent('I practise the sword forms').action).toBe('train_technique');
    });

    it('keeps `look for` where its four owners already had it', () => {
        // Only `go looking for` was added. Bare `look for` belongs to the
        // who-is-here read, to `work`, to `teacher` and to `treat`, and taking
        // it cost three tests on the first try.
        expect(parseIntent('I look for someone').intent).toBe('company');
        expect(parseIntent('I look for work').action).toBe('work');
        expect(parseIntent('I look for a master').action).toBe('teacher');
    });
});

/**
 * Following a road is travel; following a person is social.
 *
 * The intent is right for people and wrong for roads: "I follow the road east"
 * was answered by approaching somebody called "road east". Anchored on the noun
 * rather than on the verb, because the verb is genuinely the same word.
 */
describe('what is being followed', () => {
    it('follows a road as a journey', () => {
        const plan = parseIntent('I follow the road east');
        expect(plan.action).toBe('move');
    });

    it('follows a person as an approach', () => {
        expect(parseIntent('I follow the cultivator').action).toBe('interact');
    });
});
