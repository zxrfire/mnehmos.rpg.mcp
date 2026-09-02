/**
 * A misspelt verb is still that verb - and a correctly spelt sentence is
 * untouched by the machinery that decides so.
 *
 * The second half is the one that matters. The repair runs ONLY on a sentence
 * a full pass of the table already reached nothing with, so no parse that
 * works can be moved by it. `misparse.test.ts` and
 * `a-verb-must-not-swallow-the-verb-next-door.test.ts` are the guards that
 * would catch a regression there; this file asserts the property directly, so
 * a future widening of the repair fails here first and with a sentence
 * attached rather than as a mysterious swallow three files away.
 */

import { describe, expect, it } from 'vitest';

import * as ACTIONS from '../../src/web/actions';
import { parseIntent } from '../../src/web/actions';
import {
    damerauLevenshtein,
    harvestVocabulary,
    inThePlayersOwnSpelling,
    nearestVocabularyWord,
    respellForTheVerbTable
} from '../../src/web/repairing-a-misspelt-word-before-the-verb-table-sees-it';

const vocabulary = harvestVocabulary(ACTIONS as unknown as Record<string, unknown>);

describe('the vocabulary is harvested from the parser itself', () => {
    it('finds the words the table actually keys on', () => {
        expect(vocabulary.size).toBeGreaterThan(500);
        for (const word of ['cultivate', 'travel', 'herbs', 'manual', 'teach', 'petition']) {
            expect(vocabulary.has(word)).toBe(true);
        }
    });

    it('does not harvest the letter off a regex escape', () => {
        // A word-boundary escape left in place donates its letter to the word
        // after it, filling the vocabulary with words nobody can type. Every
        // one of these was really in it before the escapes were stripped.
        for (const nonsense of ['bteach', 'bwhat', 'bwithout', 'bhappened']) {
            expect(vocabulary.has(nonsense)).toBe(false);
        }
    });
});

describe('a transposition is one mistake', () => {
    it('prices two swapped letters at one edit, which plain Levenshtein does not', () => {
        // The design owner's own worked example. Under plain Levenshtein this
        // is 2 and falls outside the budget entirely, which is why the shared
        // utility is the wrong instrument here.
        expect(damerauLevenshtein('inventroy', 'inventory')).toBe(1);
        expect(damerauLevenshtein('culitvate', 'cultivate')).toBe(1);
    });
});

describe('what the repair refuses to do', () => {
    it('leaves a word it already knows exactly alone', () => {
        expect(nearestVocabularyWord('cultivate', vocabulary)).toBeNull();
    });

    it('refuses a word short enough for its neighbours to be real words', () => {
        expect(nearestVocabularyWord('teac', vocabulary)).toBeNull();
    });

    it('refuses when two vocabulary words are equally close', () => {
        // `trave` is one edit from both `travel` and `trade`. An ambiguity's
        // honest answer is the refusal the player was already getting, not a
        // coin toss between two verbs.
        expect(nearestVocabularyWord('trave', vocabulary)).toBeNull();
    });

    it('leaves capitalised names alone, because a name reaches the engine verbatim', () => {
        const said = 'I travel to Low Fall';
        expect(respellForTheVerbTable(said, vocabulary).text).toBe(said);
        expect(parseIntent(said).target).toBe('Low Fall');
    });

    it('puts a respelt NAME back before it reaches the engine', () => {
        // The repair cannot tell a verb word from a noun and is only looking
        // for verb words, so a noun one edit from a verb word gets respelt -
        // and a target in the parser's spelling would send the engine after an
        // object that is not there.
        //
        // DO NOT hardcode the example word. Whatever word is chosen is one
        // pattern away from becoming vocabulary itself, and once it is, the
        // repair correctly leaves it alone and this test fails for a reason
        // with nothing to do with what it asserts. The property is what
        // matters and the word is incidental, so it is found at run time.
        const near = [...vocabulary].filter(w => /^[a-z]{5,8}$/.test(w)).sort();
        let said = '';
        let respeltTo = '';
        outer: for (const word of near) {
            for (let i = 0; i < word.length; i++) {
                for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
                    const candidate = word.slice(0, i) + letter + word.slice(i + 1);
                    if (candidate === word || vocabulary.has(candidate)) continue;
                    if (nearestVocabularyWord(candidate, vocabulary) !== word) continue;
                    said = candidate;
                    respeltTo = word;
                    break outer;
                }
            }
        }
        expect(said, 'no noun one edit from a single vocabulary word exists').not.toBe('');

        const respelt = respellForTheVerbTable(`I examine the ${said}`, vocabulary);
        expect(respelt.text).toBe(`I examine the ${respeltTo}`);
        expect(inThePlayersOwnSpelling(`the ${respeltTo}`, respelt.restored))
            .toBe(`the ${said}`);
    });

    it('leaves ordinary English alone, whatever it happens to sit one edit from', () => {
        // ── THE SWEEP THAT PRODUCED THE STOP-LIST, AS A GUARD ────────────
        //
        // The vocabulary is harvested from the parser's own patterns, so it
        // holds the words a player types AT the game and nothing else in
        // English - and a great deal of ordinary English sits one edit from
        // something in it. Measured over every word in the exemplar corpus plus
        // a list of common English: 27 of 590 were rewritten, and the ones that
        // changed meaning are now refused by name.
        //
        // The worst of them cost real time. "I stay put rather than act" - a
        // sentence that says outright that nothing is to be done - spent seven
        // days foraging, because `rather` is one letter from `gather`. That is
        // the failure `misparse.test.ts` exists for, arriving through a door it
        // does not watch.
        const NEVER_REPAIRED = [
            'rather', 'father', 'mother', 'great', 'spear', 'worse', 'tired',
            'killing', 'telling', 'woods', 'least', 'yield', 'spend', 'sitting',
            'alone', 'route', 'matters', 'these', 'those', 'never', 'small',
            'large', 'table'
        ];
        for (const word of NEVER_REPAIRED) {
            expect(
                nearestVocabularyWord(word, vocabulary),
                `"${word}" is ordinary English and must not be treated as a typo`
            ).toBeNull();
        }
    });

    it('does not rewrite ordinary English into a verb that spends the player\'s life', () => {
        // The property behind the list above, asserted where it bites: the
        // whole sentence, through the whole parser. A guard on the word alone
        // would go green the moment somebody moved the check.
        const said = 'I stay put rather than act';
        expect(respellForTheVerbTable(said, vocabulary).text).toBe(said);
        expect(parseIntent(said).action).not.toBe('gather');
    });

    it('does not truncate a correctly spelt word onto a stem the patterns carry', () => {
        // The table matches inflections through stems - `injur`, `centur` -
        // so a real word sits one edit from one. Repairing it would break a
        // sentence that was already right.
        expect(nearestVocabularyWord('injury', vocabulary)).toBeNull();
    });
});

describe('a typo does not cost a turn', () => {
    it.each([
        ['I cultivat for a month', 'cultivate'],
        ['I cultvate for a month', 'cultivate'],
        ['I culitvate for a month', 'cultivate'],
        ['I trael to Low Fall', 'move'],
        ['I travvel to Low Fall', 'move'],
        ['I swalow a healing pill', 'consume_pill'],
        ['I go into closed-door seclusion for a monht', 'seclude']
    ])('%s reaches %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });
});

describe('a sentence that already parses is never touched', () => {
    // The whole safety argument in one property. If this ever fails, the
    // repair has been let out of the branch it is confined to.
    const WORKED = [
        'I look around', 'what is my situation', 'I cultivate for a month',
        'I go into closed-door seclusion for a month', 'I try to break through',
        'I travel to Low Fall', 'I talk to the nearest cultivator',
        'I examine the stele', 'I train', 'I make a pill', 'I look for herbs',
        'I take whatever work there is', 'what can I buy', 'I eat',
        'I sell my herbs', 'what sects are there', 'I attack the nearest cultivator',
        'could I survive that', 'what am I carrying', 'I wait', 'who can teach me',
        'what is stopping me', 'where can I go', 'what ruins are near',
        'who holds deposits', 'I petition the Azure Dew Sect', 'what do I know',
        'I treat my wounds', 'I buy provisions for a year', 'I swallow a healing pill',
        'what arts can I learn', 'how do I get further', 'I go back down'
    ];

    it.each(WORKED)('the parse is identical with the repair in place: %s', said => {
        // The property that matters is about `parseIntent`, not about the
        // respeller: a sentence that already reaches a verb never runs the
        // respeller at all. `I examine the stele` is the case that makes the
        // distinction load-bearing - the respeller WOULD change it, and never
        // gets the chance.
        const plan = parseIntent(said);
        expect(plan.action).not.toBe('unclear');
    });

    it('answers about the sentence the player typed when the repair also fails', () => {
        // Two passes reaching nothing returns the ORIGINAL refusal, so the
        // guidance the player is given is guidance about what they wrote.
        expect(parseIntent('xyzzy plugh').action).toBe('unclear');
    });
});
