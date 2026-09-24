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

/**
 * A second sweep, of the plainest thing a person types rather than of a
 * benchmark corpus: the bare verb on its own, and the second synonym anybody
 * reaches for. Measured by
 * `scripts/probe-what-a-plain-sentence-reaches.ts` over 101 sentences.
 *
 * The one that names the class: `I go` reached nothing, because the flee row
 * spelt it `goes?` - which matches "goe" and "goes" and never "go", exactly as
 * `\bcultivat\b` could never match "cultivate". A bare ordinary sentence
 * reaching nothing is worse than an exotic one failing.
 */
describe('the bare verb on its own', () => {
    it.each([
        // The `goes?` defect, and the three sentences that sat behind it.
        ['I go', 'move'],
        ['I leave', 'move'],
        ['I back off', 'move'],
        ['I walk away', 'move'],
        // `break through` answered to every phrasing but the one a cultivator
        // uses out loud.
        ['I push through', 'breakthrough'],
        // Asking around was only readable with a subject attached to it.
        ['I ask around', 'news']
    ])('%s -> %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });

    it('goes after somebody by the word for it, and names who', () => {
        // `follow` had `follow`, `shadow`, `trail` and `tail` and none of the
        // three words anybody uses when the person is already walking off.
        for (const said of ['I chase him', 'I run after him', 'I pursue him']) {
            const parsed = parseIntent(said);
            expect(parsed.action, said).toBe('interact');
            expect(parsed.intent, said).toBe('follow');
            // The person, not a place called "after him". Widening the row
            // without widening the subject read is how that happens.
            expect(parsed.target, said).toBe('him');
        }
    });

    it('still drives somebody off rather than following them', () => {
        // The trap on the other side of that row: `chase off` and `run him
        // out` are a blow, and the row that owns those keeps them.
        expect(parseIntent('I chase him off').intent).not.toBe('follow');
        expect(parseIntent('I run him out of the village').intent).not.toBe('follow');
    });
});

describe('what the bare-verb work must not have taken', () => {
    it.each([
        // Leaving a HOUSE is not leaving a room, and the bare arms above sit
        // under the row that owns this.
        ['I leave the sect', 'sect'],
        // A subject after `ask around` is a conversation, which is where it
        // was already going.
        ['I ask around about the sect', 'interact'],
        // Sitting for a span is cultivation; what makes it seclusion is the
        // door. The ruling is `misparse.test.ts`'s and a `sit in seclusion`
        // arm was tried against it and taken out again.
        ['I sit in seclusion for ten years', 'cultivate'],
        ['I seal the cave for ten years', 'seclude'],
        // The stuck question is answered in the engine's `unclear` branch,
        // before any refusal is composed. It must stay unread by the table:
        // `what now` is in the inert-fallback set and `what should I do` is
        // the ceiling question.
        ['what now', 'unclear'],
        ['what should I do', 'ceiling']
    ])('%s stays %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
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

/**
 * A third sweep, of the sentences a MECHANIC invites rather than of the general
 * verbs: the screen says there is a lecture, a board, a posting, a talisman, a
 * challenge, and the player says the obvious thing back. Measured by
 * `scripts/probe-what-the-mechanics-invite.ts` over 52 sentences.
 *
 * Reaching the WRONG thing is the worst of the three readings and every one
 * below was one: a player who types the obvious sentence and is answered about
 * something else has been told the mechanic is not in the game.
 */
describe('the sentence a mechanic invites', () => {
    it('does not open a duel for somebody who just refused one', () => {
        // The worst reading found: the word `duel` was in the sentence and
        // nothing looked at what was being done about it, so "I refuse the
        // duel" swung at the person the player had declined to fight, with
        // terms agreed.
        for (const said of ['I refuse the duel', 'I decline the challenge']) {
            expect(parseIntent(said).action, said).not.toBe('attack');
        }
        // And the ask itself still opens one.
        expect(parseIntent('I challenge him').action).toBe('attack');
        expect(parseIntent('I challenge him to a duel').terms).toBe('agreed');
        expect(parseIntent('I spar with him').terms).toBe('agreed');
    });

    it('does not burn a slip by destroying it', () => {
        // Breaking a communication talisman is how one is USED. Read as
        // `destroy` it ended the slip and sent nothing, which is the one
        // outcome the player cannot recover and did not ask for.
        const broken = parseIntent('I break the talisman');
        expect(broken.action).toBe('tell');
        expect(broken.intent).toBe('send_word');
        // And an ordinary thing broken is still broken.
        expect(parseIntent('I break my sword').action).toBe('destroy');
    });

    it('does not sit a player down for a season when they answered a summons', () => {
        // Said the way somebody says it when a house has sent for them by name.
        for (const said of ['I take the summons', 'I take the sending', 'I take the errand']) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('sect');
            expect(plan.intent, said).toBe('accept');
            expect(plan.days, said).toBeUndefined();
        }
        // AND `posting` IS NOT ONE OF THESE WORDS, whatever this test asserted
        // for one sweep. It is the board's, in this genre and in this repo:
        // `a-board-you-can-read-and-cannot-answer` pins "i take the posting" to
        // `work`, and a wall cannot send for anybody by name.
        expect(parseIntent('I take the job').action).toBe('work');
        expect(parseIntent('I take the posting').action).toBe('work');
    });

    it('does not spend days waiting when a player listens to somebody', () => {
        // "I listen to the elder" reached `wait`; "I listen to the lecture"
        // reached the lecture. The word after `to` was doing nothing.
        const heard = parseIntent('I listen to the elder');
        expect(heard.action).toBe('teach');
        expect(heard.intent).toBe('listen');
        expect(heard.target).toBe('elder');
        expect(parseIntent('I listen to Lin Yao').target).toBe('Lin Yao');
        // A thing listened to is not a person. The capital is the whole signal
        // for a name, which is why it cannot live in a case-insensitive row.
        expect(parseIntent('I listen to the rumours').action).not.toBe('teach');
    });

    it('reads the same intake whichever pronoun it is said with', () => {
        // One word moved it: "I take HIM as my disciple" reached `sect/recruit`
        // and "I take HER as my disciple" reached a theft, because `her` is
        // also a possessive and the taking reader found a thing belonging to
        // her.
        for (const said of ['I take him as my disciple', 'I take her as my disciple']) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('sect');
            expect(plan.intent, said).toBe('recruit');
        }
        // And an ordinary taking is still one.
        expect(parseIntent('I take the manual').intent).toBe('take');
    });

    it('lets somebody break in rather than talking to a person called in', () => {
        // "I sneak in" reached `interact/talk` with a target of `in`.
        for (const said of ['I sneak in', 'I slip in', 'I sneak in through the gate']) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('move');
            expect(plan.intent, said).toBe('enter');
        }
    });

    it('reads kneeling to ask as an ask', () => {
        // The genre's posture for asking to be taken on. The submission row
        // took it, which is the opposite act.
        expect(parseIntent('I kneel and ask').intent).not.toBe('give_in');
        expect(parseIntent('I kneel and ask him to teach me').intent).toBe('teaching');
        // A bare kneel is still a submission.
        expect(parseIntent('I kneel').intent).toBe('give_in');
    });

    /**
     * AND A COURTESY AIMED WITH A PRONOUN IS STILL A COURTESY.
     *
     * Played, on the biggest beat an opening has - saying goodbye to whoever
     * raised you: *"I go back to He Xuxue and kneel before him. Grandfather, I
     * leave with the caravan tomorrow."* `A_COURTESY_TO_SOMEBODY` held titles
     * and capitalised names and not `him`, so the sentence fell past it to the
     * yield, and a cultivator taking leave of the man who raised them was read
     * as a beaten one giving up.
     *
     * Safe for the reason the yield's own guard states: the table only ever
     * sees these outside a fight, because `whatTheySaidInTheFight` takes a real
     * yield before the table is asked.
     */
    it.each([
        'I go back to He Xuxue and kneel before him. Grandfather, I leave with the caravan tomorrow.',
        'I kneel in the mud and bow to her three times',
        'I kneel before him',
        'I bow to them'
    ])('does not read a courtesy aimed at a pronoun as giving up: %j', said => {
        const plan = parseIntent(said);
        expect(plan.action, said).toBe('interact');
        expect(plan.intent, said).not.toBe('give_in');
    });

    it.each(['I kneel', 'I yield', 'I give up', 'I submit'])(
        'still gives up from %j', said => {
            expect(parseIntent(said).intent, said).toBe('give_in');
        });

    it.each([
        // The board names a task and the player says it back.
        ['I take that task', 'sect'],
        // Handing a thing TO your house is handing it in. The two particle
        // verbs wanted the word `in`.
        ['I hand it to the sect', 'sect'],
        // `merit` is the word the screen prints; only the schema's word
        // (`contribution`) was readable.
        ['I check my merit', 'sect'],
        // Asking to be taken on, said with the person named.
        ['I ask Lin Yao to let me be her disciple', 'request']
    ])('%s reaches %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });

    it('leaves the gift to a person where it was', () => {
        // The handing-in widening runs only where the far end is the house.
        const given = parseIntent('I give the book to the elder');
        expect(given.action).toBe('give');
        expect(given.target).toBe('elder');
    });
});

/**
 * The seven rulings that came back from the mechanics sweep.
 *
 * Each one was a sentence a mechanic invites, and each was measured reaching
 * nothing or reaching something else. The rulings are the design owner's
 * through the coordinator; what is asserted here is only that the sentence
 * arrives where the ruling puts it.
 */
describe('the rulings the mechanics sweep asked for', () => {
    it('sends word home when somebody reports back', () => {
        // The owner's ruling on how word reaches a house is the slip. Reporting
        // back is sending word and never was anything else.
        const back = parseIntent('I report back');
        expect(back.action).toBe('tell');
        expect(back.intent).toBe('send_word');
        expect(back.target).toBe('my sect');
        expect(parseIntent('I report back to my master').target).toBe('my master');
    });

    it('names the person somebody sneaks in behind', () => {
        // The last of the particle defect: the target came back as `in behind
        // him`, which is a person read as a place with two words in front.
        expect(parseIntent('I sneak in behind him').target).toBe('him');
    });

    it('offers proof with the token, which is what the robe is not', () => {
        for (const said of ['I show my token', 'I show them my token', 'I produce my sect token']) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('carry');
            expect(plan.intent, said).toBe('show');
        }
        // Robes are worn, not shown: `wear` owns that read and keeps it.
        expect(parseIntent('I put on the robes').intent).toBe('wear');
    });

    it('speaks into a jade without being asked which jade', () => {
        // A pair has exactly one other half by construction, so a sentence that
        // names nobody has left nothing open. The handler resolves the partner.
        for (const said of ['I use the jade', 'I speak into the jade', 'I break the jade']) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('tell');
            expect(plan.intent, said).toBe('send_word');
        }
    });

    it('separates a commission placed from a commission taken', () => {
        // You commission a THING and you take a POSTING.
        const placed = parseIntent('I commission a sword');
        expect(placed.action).toBe('request');
        expect(placed.intent).toBe('a_making');
        expect(placed.topic).toBe('sword');
        // Named hands are kept rather than swallowed into the thing's name.
        const withSmith = parseIntent('I order a sword from the smith');
        expect(withSmith.target).toBe('smith');
        expect(withSmith.topic).toBe('sword');
        // And the board's sense of the word is untouched.
        expect(parseIntent('I take the commission').action).toBe('sect');
        expect(parseIntent('I accept the commission').action).toBe('sect');
        // `of` joins two nouns and does not place a commission.
        expect(parseIntent('I order a cup of tea').target).not.toBe('tea');
    });

    it('takes the possessive as the person, and only for a role', () => {
        // "His" in that slot names whoever was last spoken of.
        const asked = parseIntent('I ask to be his disciple');
        expect(asked.action).toBe('request');
        expect(asked.intent).toBe('discipleship');
        expect(asked.target).toBe('his');
        expect(parseIntent('I ask to be her disciple').target).toBe('her');
        // AND THE GUARD: a possessive owning a THING must not become an ask put
        // to the thing. A manual is not somebody.
        expect(parseIntent('I ask to see his manual').action).not.toBe('request');
        expect(parseIntent('I ask for a sword').action).not.toBe('request');
    });

    it('reads taking somebody as a spouse as the proposal it is', () => {
        const taken = parseIntent('I take her as a wife');
        expect(taken.action).toBe('propose');
        expect(taken.target).toBe('her');
        expect(parseIntent('I take him as my husband').action).toBe('propose');
        // The plainest phrasing there is, which reached nothing.
        expect(parseIntent('I propose to her').action).toBe('propose');
        // An ordinary taking is still one, and so is taking somebody on.
        expect(parseIntent('I take the sword').intent).toBe('take');
        expect(parseIntent('I take her as my disciple').intent).toBe('recruit');
    });
});
