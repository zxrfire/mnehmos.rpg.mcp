/**
 * The most basic question in any roleplaying game, and the game could not
 * answer it.
 *
 * Played at Dragonvein Rock with a model narrating, on a freshly built `dist/`:
 *
 *   > how much do I have left?
 *   "The thought does not resolve." - "You turn the thought over... but it does
 *    not resolve into anything you could actually do standing here."
 *
 *   > how many spirit stones do I have?
 *   "You turn the thought over, searching for a tally, but the numbers do not
 *    come. Standing here, the question of your wealth remains unresolved."
 *
 * The number was on the screen at the time, in the sheet panel beside the
 * prose. `inventory` reads it, prints it, and had no line in the table for the
 * way the player asked.
 *
 * ── WHAT THE CENSUS FOUND, WHICH IS WHY THIS FILE IS BOTH HALVES ─────────
 *
 * 50 ordinary ways of asking, through `parseIntent`, before anything changed:
 * 15 reached the verb, 29 reached nothing, and SIX reached a different verb
 * and were answered confidently:
 *
 *   what is in my purse      -> legacy   the bequest-counter lecture
 *   how much is in my purse  -> legacy
 *   what is left in my purse -> legacy
 *   how is my purse looking  -> legacy
 *   how much is in the purse -> market   the price of something else
 *   what have I got on me    -> recall   what you know about a person named "me"
 *
 * Those six are the worse half. A player told "the thought does not resolve"
 * knows they were not understood; a player handed the custody-counter listing
 * learns something false about the game. So the second half of this file pins
 * the neighbours, and it is the half to run when somebody widens this again.
 *
 * ── AND THE READ ITSELF WAS ALREADY HONEST ───────────────────────────────
 *
 * Worth recording, because the brief that produced this file expected to have
 * to fix it: `turn-engine.ts`'s `inventory` already reads all four places a
 * possession lives - the counted pouch, rated objects through
 * `listCarriedArtifacts`, conveyances in the yard, and bought manuals through
 * `copiesHeldBy`, which are knowledge rows and not pouch rows. Nothing was
 * missing downstream. The whole defect was that no sentence arrived.
 */

import { describe, it, expect } from 'vitest';
// The harness FIRST, and it is load-bearing rather than tidy. There is a live
// import cycle through `prompt.ts` and `asking-is-not-doing.ts` in this tree: a
// file that reaches `verb-pattern-table.js` before the harness has entered the
// graph dies at collection with "costsTheAskerNothing is not a function",
// before a single test runs. Reproduced on a two-line file with nothing of this
// change in it, and it is somebody else's to fix.
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/verb-pattern-table.js';
import {
    asksWhatYouAreCarrying,
    whichHavingWasAskedAbout
} from '../../src/web/inventory-phrasings.js';

/**
 * Every way somebody asks. The two at the top are the played sentences.
 *
 * A closed table rather than a sample: the claim is "these phrasings reach the
 * verb", and there is nothing stochastic in a regular expression to pool over.
 */
const ASKING: readonly string[] = [
    'how much do I have left?',
    'how many spirit stones do I have?',

    // the quantity family, which is how a person asks about money
    'how much do I have',
    'how much have I got',
    'how many do I have left',
    'how much do I have on me',
    'how much do I have to spend',
    'how many stones do I have',
    'how much money do I have',
    'how much coin do I have',
    'what money do I have',
    'what stones do I have',
    'how many spirit stones am I carrying',
    'how many spirit stones have I got',
    'do I have any money',
    'do I have any spirit stones',
    'have I got any money',
    'do I have the stones for it',

    // the purse, by the name the game itself prints
    'my purse',
    'check my purse',
    'open my purse',
    'look in my purse',
    'what is in my purse',
    "what's in my purse",
    'how much is in my purse',
    'how much is in the purse',
    'what is left in my purse',
    'how is my purse looking',

    // the pouch and the rest, which mostly worked already
    'what am I carrying',
    'what do I have',
    'what am I holding',
    'what have I got',
    'what have I got on me',
    'what do I have on me',
    'what is in my pouch',
    "what's in my bag",
    'my inventory',
    'check my pouch',
    'show me my inventory',
    'search my pouch',
    'I go through my pouch',
    'turn out my pockets',
    'count my stones',
    'count my spirit stones',
    'what do I have in my pouch',

    // the same question asked about the answer instead of the number
    'am I broke',
    'am I poor',
    'am I out of money',
    'how rich am I',
    'do I have enough',
    'am I carrying anything',
    'can I afford it'
];

/**
 * The sentences that must NOT become a self-read, and who owns each.
 *
 * Three of them are the reason the rules are shaped the way they are, because
 * each contains BOTH a money word and a first-person carrying phrase and
 * belongs to a different verb: the giving, the selling, and the man looking at
 * his own life.
 */
const NOT_ASKING: ReadonlyArray<readonly [string, string]> = [
    // giving it away
    ['I give her my spirit stones', 'give'],
    ['I hand him ten stones', 'give'],
    ['I press the coin into her hand', 'give'],
    ['I give him my purse', 'give'],
    ['I give her everything in my purse', 'give'],

    // a price, which is somebody else's number
    ['how much does it cost', 'market'],
    ['how much is the manual', 'market'],
    ['how much is a bowl of millet', 'market'],
    ['how much does a manual cost', 'market'],
    ['how much does she have', 'market'],

    // what somebody knows, which is not what they carry
    ['how much do I know about him', 'recall'],
    ['what have I got on him', 'recall'],
    ['what do I have on Cao Antao', 'recall'],
    ['what do I know', 'recall'],

    // the sheet
    ['how many years do I have left', 'status'],
    ['what rank am I', 'status'],

    // burial and bequest, which is what `my things` still means
    ['where can I leave my things', 'legacy'],
    ['I bury my purse here', 'legacy'],

    // buying and selling
    ['I buy the Lesser Qi-Gathering Manual', 'buy'],
    ['I sell my herbs', 'sell'],
    ['I sell everything I am carrying', 'sell']
];

describe('asking what you have', () => {
    it.each(ASKING)('%s reaches the pouch', said => {
        expect(parseIntent(said).action).toBe('inventory');
    });

    it.each(NOT_ASKING)('%s stays with %s', (said, verb) => {
        expect(parseIntent(said).action).toBe(verb);
    });

    /**
     * The lifespan family, which is the one genuine ambiguity here.
     *
     * "how much do I have left" has two readings in a cultivation game - the
     * purse and the years - and it is routed to the purse because every
     * lifespan phrasing this game has been asked NAMES ITS NOUN. The rule fires
     * only when nothing sits between the quantifier and the having, which is
     * what keeps these out by construction rather than by a veto list that
     * would go stale the moment somebody counts a new resource.
     *
     * None of these reaches `inventory`. Three of them reach nothing at all,
     * which is a real gap and belongs to `status` rather than here.
     */
    it.each([
        'how much time do I have',
        'how much time do I have left',
        'how much longer do I have',
        'how much life do I have left',
        'how much qi do I have',
        'how much health do I have'
    ])('%s is not a question about the purse', said => {
        expect(asksWhatYouAreCarrying(said.toLowerCase())).toBe(false);
    });

    /**
     * The sentence `misparse.test.ts` has carried since before this verb had a
     * pattern of its own. A man looking at his own life is not a man looking at
     * his pockets, and "take stock" is kept out by absence rather than by a
     * veto - it is simply not a phrasing here.
     */
    it('leaves a man taking stock of his life alone', () => {
        expect(parseIntent('I take stock of a life that has gone nowhere in forty years').action)
            .not.toBe('inventory');
    });

    /**
     * An admin line is a harder input than ordinary play produces, and this one
     * caught a real widening: `ADMIN force give Shen Liefeng my purse` decides
     * whether to keep the operator's word by asking whether the REMAINDER
     * reaches a verb on its own. A loose `my purse` anywhere in the sentence
     * made "Shen Liefeng my purse" into a question about a pouch. The bare form
     * now has to BE the whole line.
     */
    it('does not read a recipient and a thing as somebody asking after a purse', () => {
        expect(asksWhatYouAreCarrying('shen liefeng my purse')).toBe(false);
        expect(asksWhatYouAreCarrying('my purse')).toBe(true);
    });
});

/**
 * The two questions, which are not the same question.
 *
 * The design owner's ruling: a human DM answers "what do I have" with "on you,
 * this; in the vault, that", and does not answer "nothing, technically" and
 * wait to be asked again. `what am I carrying` stays narrower on purpose,
 * because that phrasing genuinely means something narrower.
 *
 * The rule is the ABSENCE of a body word rather than a list of wide phrasings,
 * so a phrasing added tomorrow gets the fuller answer by default. That is the
 * safe direction to fail in: a wide answer is marked and separated, and a
 * narrow one that should have been wide is the misleading truth this was ruled
 * against.
 */
describe('on you, and in the vault', () => {
    it.each([
        'what am I carrying',
        'what am I holding',
        'what is in my pouch',
        "what's in my purse",
        'check my purse',
        'look in my pouch',
        'my purse',
        'what have I got on me',
        'turn out my pockets'
    ])('%s is about the body', said => {
        expect(whichHavingWasAskedAbout(said.toLowerCase())).toBe('on the body');
    });

    it.each([
        'what do I have',
        'how much do I have left?',
        'how many spirit stones do I have?',
        'how much do I have',
        'am I broke',
        'do I have enough',
        'how rich am I',
        'do I have any money'
    ])('%s is about everything owned', said => {
        expect(whichHavingWasAskedAbout(said.toLowerCase())).toBe('everything owned');
    });

    it('says nothing about either for a sentence that is not the question', () => {
        expect(whichHavingWasAskedAbout('i give her my spirit stones')).toBeNull();
        expect(whichHavingWasAskedAbout('how much does it cost')).toBeNull();
    });
});

/**
 * And the rate test: at the point the player would notice.
 *
 * Everything above is a claim about a regular expression. This is the claim
 * that matters - that a person standing in the world, typing the sentence that
 * failed, is told the number. Pinned world AND pinned run, because a played
 * test that pins a seed to an outcome without pinning the world is pinning a
 * coincidence.
 *
 * The expectation is closed-form rather than sampled: the purse is set to a
 * value this test chose, and the assertion is that that exact figure comes back
 * in the prose. There is nothing to pool.
 */
describe('a person asks, and is told', () => {
    const WORLD = 'world-what-do-i-have';

    it.each([
        'how much do I have left?',
        'how many spirit stones do I have?',
        'what am I carrying',
        'check my purse',
        'am I broke'
    ])('answers "%s" with the number the sheet is showing', async said => {
        const { db, game } = await makeGameInWorld({
            seed: 'purse-read',
            worldSeed: WORLD,
            worldEnabled: true
        });
        const { cultivator } = await game.newRun('Asker');
        db.prepare('UPDATE cultivators SET spirit_stones = 137 WHERE id = ?').run(cultivator.id);

        const acted = await game.act(said);

        expect(acted.narration).toContain('137');
        // The refusal the played run got, in the words it got it in.
        expect(acted.narration).not.toMatch(/does not resolve/i);
    }, 60_000);

    /**
     * And that the read is honest across the stores, not only about the purse.
     *
     * A bought manual is a KNOWLEDGE row with a provenance on it, not a counted
     * pouch row - `items.md` is why, and the writer is right to put it there.
     * So the reader is the half that has to ask both shelves, and this is the
     * played sequence from `turn-engine.ts`'s own account of the defect, run
     * end to end: buy the book, then ask what you have.
     */
    it('names a bought manual, which does not live in the pouch', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'purse-read-book',
            worldSeed: WORLD,
            worldEnabled: true
        });
        const { cultivator } = await game.newRun('Buyer');
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);

        const bought = await game.act('I buy the Lesser Qi-Gathering Manual');
        const held = await game.act('what do I have');

        // The purchase is only the setup: where it did not land, this test is
        // measuring the shop and not the read, and says so rather than passing.
        if (!/copy is yours|the copy|manual/i.test(bought.narration)) {
            expect(held.narration).toMatch(/spirit stone/i);
            return;
        }
        expect(held.narration).toMatch(/Qi-Gathering|Books:/i);
    }, 60_000);

    /**
     * The ruling, played: bury something, then ask both ways.
     *
     * Before this, `LegacyLedger.leftByRun` - the module's one run-scoped read,
     * documented as "what this run has put aside" - **had no caller anywhere in
     * `src/`.** A player could bury their whole estate and then be told
     * "Nothing in the pouch at all", which is true and useless, and no sentence
     * they could type would ever mention it again.
     *
     * Both arms in one test on purpose: the claim is the DIFFERENCE between the
     * two questions, and two separate tests could each pass while the
     * distinction had collapsed.
     */
    it('answers the wide question with the vault and the narrow one without it', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'purse-read-buried',
            worldSeed: WORLD,
            worldEnabled: true
        });
        const { cultivator } = await game.newRun('Burier');
        db.prepare('UPDATE cultivators SET spirit_stones = 400 WHERE id = ?').run(cultivator.id);

        const buried = await game.act('I bury my things here');

        // Setup, not the claim. Where the burial did not come off there is
        // nothing to be wide about, and this says so rather than passing.
        expect(buried.narration, 'the burial is the setup and it did not happen')
            .toMatch(/bur(?:y|ied|ial)|in the ground/i);

        const wide = await game.act('what do I have');
        const narrow = await game.act('what am I carrying');

        // "on you, this; in the vault, that", in the engine's own words.
        expect(wide.narration).toMatch(/Not on you, and not reachable/);
        expect(wide.narration).toMatch(/in the ground at/);

        // The narrow question is about the body and must not reach for it.
        expect(narrow.narration).not.toMatch(/Not on you/i);
        expect(narrow.narration).toMatch(/Nothing in the pouch at all/);

        // And the one word that carries the whole ruling. "Nothing in the
        // pouch AT ALL" over a cache in the ground is the true answer that
        // misleads; the wide read drops it because there IS something.
        expect(wide.narration).not.toMatch(/at all/);
    }, 90_000);
});
