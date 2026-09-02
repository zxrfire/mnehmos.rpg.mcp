/**
 * Nothing that names a theft comes back `unclear`.
 *
 * The owner's ruling, stated as a test: theft is an ordinary move with a
 * resolver, a price and consequences behind it, and **the engine has to be the
 * one that refuses it**. A reader that declines to route a hostile sentence
 * hands the whole turn to guesswork, and softens the act by omission - which is
 * the failure `AGENTS.md` names as worse than banning, because it is invisible.
 *
 * ── WHAT WAS MEASURED ────────────────────────────────────────────────────
 *
 * Seven ordinary ways of saying one thing, through `parseIntent`:
 *
 *   "I take Cao Antao's purse"                      -> unclear
 *   "I cut the purse off the nearest person's belt" -> unclear
 *   "I take the jade off him"                       -> unclear
 *   "I lift the pouch from his belt"                -> unclear
 *   "I steal his purse"    -> steal, target "his purse", which is not a person
 *   "I pick his pocket"    -> steal, no target at all
 *   "I rob the merchant"   -> steal, target "merchant"
 *
 * One of seven came out usable. Four returned nothing, and the two that routed
 * carried a target the resolver could not use, so the played sentences reached
 * whoever happened to be nearest with no record of who had been meant.
 *
 * ── AND THE VOCABULARY WAS ALREADY IN THE FILE ───────────────────────────
 *
 * `POCKET_PICKING` matches every idiom that failed and its only use was as a
 * veto in the foraging branch. One half of the file could recognise a cutpurse;
 * the half that routes could not. The steal row now reads that constant rather
 * than a second copy of it.
 *
 * ── THE NEIGHBOURS, WHICH ARE THE REASON THIS IS NARROW ──────────────────
 *
 * `take` is the commonest verb in the language and the widest in this file. The
 * row does not admit it: it admits take PLUS a possessive PLUS a portable
 * thing, which no other verb's sentence looks like. The second half of this
 * file is the proof, and it is the half to run when somebody widens this again.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent, POCKET_PICKING } from '../../src/web/actions';

describe('a theft is a sentence the engine answers', () => {
    it.each([
        "I take Cao Antao's purse",
        'I cut the purse off the nearest person\'s belt',
        'I take the jade off him',
        'I lift the pouch from his belt',
        'I steal his purse',
        'I pick his pocket',
        'I rob the merchant',
        'I pickpocket the stallholder',
        'I help myself to his stones'
    ])('routes it rather than refusing to read it: %s', said => {
        const plan = parseIntent(said);
        expect(plan.action).toBe('interact');
        expect(plan.intent).toBe('steal');
    });

    it('aims at the person, never at the thing being taken', () => {
        // `resolveAttempt` prices a theft against who it is taken FROM, so a
        // target of "his purse" is a resolution failure waiting to happen.
        expect(parseIntent("I take Cao Antao's purse").target).toBe('Cao Antao');
        expect(parseIntent('I steal the manual from Cao Antao').target).toBe('Cao Antao');
        expect(parseIntent('I rob the merchant').target).toBe('merchant');
    });

    it('names nobody where the sentence names nobody', () => {
        // "I steal his purse" genuinely does not name anybody, and `interact`
        // with no target already means whoever is at hand. A guessed name would
        // be a wrong guess, and a wrong guess is worse than a refusal.
        for (const said of ['I steal his purse', 'I pick his pocket', 'I take the jade off him']) {
            expect(parseIntent(said).target, said).toBeUndefined();
        }
    });

    it('reads the cutpurse idioms off the constant that already knew them', () => {
        for (const said of ['I cut his purse', 'I lift her sleeve', 'I pick his pocket']) {
            expect(POCKET_PICKING.test(said.toLowerCase()), said).toBe(true);
        }
    });
});

describe('and the verbs next door keep what they reach', () => {
    it.each([
        ['I take the road east', 'move'],
        ['I take work', 'work'],
        ['I take a job', 'work'],
        ['I take whatever work the village will give me for a season', 'work'],
        ['I go out and pick herbs', 'gather'],
        ['I pick the mushrooms', 'gather'],
        ['I pick a fight with him', 'attack'],
        ['I take up the method in this book', 'learn_technique'],
        ['I take a carriage to the market town', 'ride']
    ])('%s stays %s', (said, want) => {
        const got = parseIntent(said).action;
        // `move` is the one that is allowed to decline: "I take the road east"
        // names no place the world has, and refusing is the honest answer. What
        // it must never be is a theft.
        if (want === 'move') expect(got).not.toBe('interact');
        else expect(got).toBe(want);
    });

    it('does not turn every sentence with a purse in it into a theft', () => {
        expect(parseIntent('what is in my pouch').action).toBe('inventory');
        expect(parseIntent('I sell the sabre').action).toBe('sell');
        expect(parseIntent('I buy the manual').action).toBe('buy');
    });
});

/**
 * The same probe over the hostile verbs beside this one, because a row that
 * cannot read its commonest phrasing is unlikely to be the only one.
 *
 * Two more were found reaching `unclear` and are fixed here: `go at`, which is
 * one letter from `go for` and was already in the row, and putting a blade
 * through somebody, which is the exemplar corpus's own phrasing.
 */
describe('the hostile verbs beside it', () => {
    it.each([
        ['I go at him', 'attack'],
        ['I put a sword through Cao Antao', 'attack'],
        ['I run him through', 'attack'],
        // Both of these had the verb in the row already and missed their
        // commonest form, because the pronoun sits in the middle of the phrase.
        ['I cut him down', 'attack'],
        ['I draw my sword on him', 'attack'],
        ['I attack Cao Antao', 'attack'],
        ['I hit him', 'attack'],
        ['I kill the bandit', 'attack'],
        ['I threaten Cao Antao', 'interact'],
        // A threat said the way people say it. The word "threaten" was the only
        // phrasing that reached the one leverage that costs nothing to make.
        ['I make it clear what happens if he refuses', 'interact'],
        ['I lie to Cao Antao', 'interact']
    ])('%s -> %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });

    it('reads the shortest form of the most urgent verb in the game', () => {
        // "I run" reached nothing while "I run away" worked.
        expect(parseIntent('I run').intent).toBe('flee');
        expect(parseIntent('I run for it').intent).toBe('flee');
        expect(parseIntent('I get out of there').intent).toBe('flee');
        // And the two sentences that keep bare `run` anchored to the whole
        // input: one is a journey, the other is not a verb this parser owns.
        expect(parseIntent('I run to the mountain').intent).not.toBe('flee');
        expect(parseIntent('I run a stall').intent).not.toBe('flee');
    });
});

/**
 * A question about a verb is not the verb, and two of them were spending days.
 *
 * `ASKING_RATHER_THAN_DOING` is a post-pass over the whole sentence, so it
 * covers every verb without their authors knowing it exists - which is what
 * made these two worth adding there rather than beside the verbs they hit.
 */
describe('reads that were spending the player', () => {
    it('does not spend a week on a question about what is here', () => {
        // "what is left to gather here" -> gather, seven days bent over the
        // ground. The sentence contains no decision at all.
        expect(parseIntent('what is left to gather here').action).toBe('assess');
        expect(parseIntent('I go out and pick herbs').action).toBe('gather');
    });

    it('does not spend a month on a question about the sheet', () => {
        // "what am I cultivating" -> cultivate, thirty days. Somebody asking
        // which method they are on was sat down for a month to find out.
        expect(parseIntent('what am I cultivating').action).not.toBe('cultivate');
        expect(parseIntent('I sit down and cultivate').action).toBe('cultivate');
    });

    it('answers the plainest inventory question with the pouch', () => {
        // "what is in my pouch" reached the bequest-houses lecture, because
        // `my pouch` was a cache noun. A pouch is what you carry; the things in
        // it are what you might leave.
        expect(parseIntent('what is in my pouch').action).toBe('inventory');
        expect(parseIntent('who would hold my things after I die').action).toBe('legacy');
    });
});
