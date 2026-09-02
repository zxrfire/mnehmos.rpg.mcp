/**
 * The phrasings a benchmark found dead, and the rulings that came with them.
 *
 * Every sentence below was measured as a miss by
 * `scripts/benchmark-the-local-intent-layer.ts` and each one had a working
 * twin: "weigh my chances" was answered and "what are my chances" was not,
 * "why is my cultivation stalled" reached `ceiling` and "why is my progress
 * stalled" reached a character sheet, "I go into seclusion" was seclusion and
 * "I seclude myself" was ordinary cultivation at a twelfth of the span. That
 * is this repository's standing rule about near-synonyms, and the failing half
 * was the more natural phrasing every single time.
 *
 * Kept as a test rather than left to the benchmark because the benchmark is a
 * measurement and this is a contract. The corpus can be rewritten; these
 * sentences must keep working.
 */

import { describe, expect, it } from 'vitest';

import { ACTION_NAMES, READ_ONLY_ACTIONS, parseIntent, theVerbsOwnName } from '../../src/web/actions';

describe('the plain way of saying it reaches the verb', () => {
    it.each([
        // assess - the widest single gap, 5 of 7 phrasings dead
        ['can I beat him', 'assess'],
        ['what are my chances', 'assess'],
        ['would I win that fight', 'assess'],
        ['is that a fight I can take', 'assess'],
        ['am I out of my depth', 'assess'],
        // recall - `remember` and `recall` were missing from a list holding
        // `know` and `heard`
        ['what do I remember', 'recall'],
        ['remind me what I know', 'recall'],
        // acquisition - somebody who has run out of book
        ['how do I get past this', 'acquisition'],
        ['what would let me advance', 'acquisition'],
        // legacy - the word the module is named after
        ['what legacies are there', 'legacy'],
        ['is there an inheritance to claim', 'legacy'],
        ['who left something behind', 'legacy'],
        // site
        ['what abandoned places are there', 'site'],
        // posture - `make` was already a declaration verb; only the noun was missing
        ['I make peace with the Azure Dew Sect', 'posture'],
        // ceiling - the same question with `progress` as its subject
        ['why is my progress stalled', 'ceiling'],
        // seclude - the verb did not answer to its own name
        ['I seclude myself for a year', 'seclude'],
        // train_technique - `method` was absent from every noun list an art
        // is named by
        ['I train my method', 'train_technique'],
        // market - `show` was not a market verb although `see` and `check` were
        ['show me the market', 'market'],
        ['what is on the stalls', 'market'],
        // look, breakthrough
        ['I take in my surroundings', 'look'],
        ['I push for the next realm', 'breakthrough']
    ])('%s -> %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });

    it('gives a seclusion its own default span rather than a month of sitting', () => {
        // The cost of the miss, and why it was not merely untidy: `seclude`
        // and `cultivate` are different bargains at wildly different spans,
        // and the wrong one was being bought silently.
        expect(parseIntent('I seclude myself').days).toBe(parseIntent('I go into seclusion').days);
    });
});

describe('what the phrase work must not have taken', () => {
    it.each([
        // The ruling already in `misparse.test.ts`: the sheet, not the pouch.
        ['what do I own', 'status'],
        // A posture that names nobody must not commit the house. This is in
        // the inert-fallback set and my first pass at `peace with` broke it.
        ['I make peace with it, in a manner of speaking, for a season', 'unclear'],
        // Somewhere to sit is not somewhere to dig. `destinations` owns the
        // quiet nouns and `site` must not take them by adding a bare `caves`.
        ['I look for a quiet cave in the mountains', 'destinations']
    ])('%s stays %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });

    it('lets no slope reach the verb that crosses the Lid', () => {
        // `descend` is taken once and ends the footing the whole run stands
        // on, and "I descend the mountain" means a walk to very nearly
        // everybody who types it. What it must not be is `descend`.
        //
        // It currently reaches `unclear`, which is a refusal that costs
        // nothing and names three things that would have worked. `move` would
        // be the better answer and is a real remaining gap - deliberately not
        // closed here, because the fix puts a Lid word into the movement table
        // and that is not an edit to make on the way past.
        expect(parseIntent('I descend the mountain').action).not.toBe('descend');
        expect(parseIntent('I walk down the mountain').action).not.toBe('descend');
    });

    it('gives a destinations question back to destinations', () => {
        // `from here` used to sit among the unambiguous exterior phrasings and
        // fired with no site in the sentence at all, so the plainest way of
        // asking what places there are was answered with the outside of a ruin.
        expect(parseIntent('where could I go from here').action).toBe('destinations');
        // And the reading it was split out to protect still works.
        expect(parseIntent('what does the tomb look like from here').action).toBe('site');
    });
});

describe('a verb answers to its own name', () => {
    it.each(['inventory', 'market', 'recall', 'teacher', 'ceiling', 'destinations', 'acquisition', 'news'])(
        '%s',
        word => {
            expect(parseIntent(word).action).toBe(word);
        }
    );

    it('only ever answers with a verb that costs nothing', () => {
        // The whole safety argument, asserted rather than described. If
        // somebody widens this rule to a verb that spends a day, a stone or a
        // life, this fails before the widening reaches a player.
        for (const name of ACTION_NAMES) {
            const reached = theVerbsOwnName(name.replace(/_/g, ' '));
            if (reached !== null) expect(READ_ONLY_ACTIONS).toContain(reached);
        }
    });

    it('refuses the bare name of anything irreversible', () => {
        // `descend` crosses the Lid; `seal` wakes a sealed ancestor; `move`
        // with no destination is the documented "I set out" failure; `sect`
        // cannot tell listing a house from joining one.
        for (const forbidden of ['descend', 'seal', 'move', 'sect', 'posture', 'offer']) {
            expect(theVerbsOwnName(forbidden)).toBeNull();
        }
    });

    it('does not fire when there is a second word in the sentence', () => {
        // Whole-input only, which is what makes it unable to swallow the verb
        // next door however early in the table it sits.
        expect(theVerbsOwnName('inventory of the vault')).toBeNull();
        expect(theVerbsOwnName('I check the market stalls')).toBeNull();
    });
});
