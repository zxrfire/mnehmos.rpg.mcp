/**
 * Played: a sentence that refers to the turn before it.
 *
 * The two failures this file pins were both measured in real play, and between
 * them they blocked the commonest thing a player does:
 *
 *   > I stay where I am and keep at it for ten years
 *   "The thought does not resolve."
 *
 *   > The cheaper one leaves me something to eat with. I will take that one.
 *   "Not something anybody here sells."
 *
 * one turn after cultivating for a year, and one turn after the market had
 * listed two manuals with their prices.
 *
 * `worldEnabled: true` throughout - `AGENTS.md` is explicit that hand-playing
 * with the world off is playing a configuration where every guard that needs a
 * world is skipped - and the world seed is pinned, because a played test that
 * pins a run seed and not a world seed is pinning a coincidence.
 *
 * ── WHAT THE ASSERTIONS ARE ON ───────────────────────────────────────────
 *
 * State, never prose: the day counter, the purse, what is on the sheet. The one
 * place prose is asserted is the legibility line, which IS the feature - a
 * resolved back-reference has to say what it resolved to - and it is asserted
 * as a required fact rather than as writing.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import {
    theSentenceCarriesOn,
    whichOfTheNamedThings,
    withoutSayingTheSameThingTwice,
    type ThingNamed
} from '../../src/web/last-turn-memory.js';

/**
 * The world is pinned as well as the run, and the two prices are read off it
 * rather than assumed - which is what the header always claimed and the code
 * did not do. It named a figure: the Lesser Qi-Gathering Manual at 8 stones and
 * the Five-Breath Circulation Scripture at 13. Both moved, because what a stall
 * charges is the province times what is TRUE of the ground today, and the world
 * now has more happening in it. The NAMES are the fixture; the numbers are the
 * world's, and are parsed back out of the board the turn before.
 *
 * AND THE QUESTION HAS TO NAME TWO THINGS. It asked `what is for sale here`,
 * which reached two manuals when the catalog was smaller and now reaches
 * forty-three rows of provisions and materials - and "the cheaper one" is not a
 * question with an answer over forty-three things. Asking for the manuals is
 * the same situation the test was always describing.
 *
 * ── AND THEN "THE CHEAPER ONE" STOPPED HAVING AN ANSWER HERE EITHER ──────
 *
 * Every technique now carries its practitioner up a few rungs, so the stall
 * carries eight books where it carried two, and THREE OF THEM ARE PRICED THE
 * SAME. "The cheaper one" of three things that cost eighteen stones is not a
 * phrase with a referent, and `whichOfTheNamedThings` has always refused to
 * invent one - that refusal is the older half of this same feature, written
 * after a blind playtest handed somebody a book they could not open.
 *
 * So the pointer this file plays is an ORDINAL, which the same resolver reads
 * off the same listing in the order it was printed, and which does have an
 * answer on a board with ties in it. The comparative is still pinned, below,
 * as the case where the right answer is to put the listing back rather than to
 * choose - and that arm is why the tie is an improvement to the file and not a
 * workaround in it.
 */
const WORLD = 'backref-world';
const THE_CHEAPER_NAME = 'Lesser Qi-Gathering Manual';
const THE_DEARER_NAME = 'Five-Breath Circulation Scripture';
const WHAT_IS_ON_THE_STALL = 'what manuals are for sale here';

/**
 * What the board just quoted for one named thing, in stones.
 *
 * A CEILING AND NOT THE BILL. A stall does not always charge what it lists: a
 * seller who needs the stones more than the goods sells under the quote and
 * says so out loud - *"The price is what somebody who has to sell today asks."*
 * So the figure here is what tells the two books apart, which is all this file
 * is about.
 */
function quotedFor(narration: string | null | undefined, name: string): number {
    const found = new RegExp(`${name}, (\\d+) spirit stones`).exec(narration ?? '');
    if (!found) throw new Error(`the board did not quote ${name}: ${narration ?? ''}`);
    return Number(found[1]);
}

async function opening(seed: string) {
    const harness = await makeGameInWorld({ worldSeed: WORLD, seed });
    await harness.game.newRun('Probe');
    return harness;
}

/**
 * A cultivator who can actually sit down.
 *
 * Without a manual the engine refuses a seclusion outright - "there is no road
 * for the qi to take" - and a test of carrying on that meets THAT refusal is
 * measuring the manual gate. So the opening is played: read the stall, buy the
 * cheaper of what is on it, read it. Every one of those is a turn a player
 * takes, and the buying half is the second half of this feature.
 */
async function readyToSit(seed: string) {
    const harness = await opening(seed);
    // Said the way the pattern table reads it with nothing behind it. The
    // sentence-model tier is not present in a fresh checkout - its vectors are
    // gitignored by design - and a played test that only passes on a machine
    // where somebody has run `npm run verbs:embed` is measuring the checkout.
    await harness.game.act('what is for sale here');
    // BY NAME, because this is scaffolding and not the subject. The pointer is
    // played for real below; here all that is wanted is a cultivator holding a
    // road, and a pointer that stops resolving would silently turn every
    // seclusion assertion in this file into a test of the manual gate.
    await harness.game.act(`I buy the ${THE_CHEAPER_NAME}`);
    await harness.game.act('I read the Lesser Qi-Gathering Manual');
    return harness;
}

describe('carrying on with what you were just doing', () => {
    /**
     * The acceptance case, and it is asserted as a CONTROL ARM rather than as a
     * threshold: the same run, the same world, the same seed, played two ways.
     * One types the act out in full and one refers back to it, and if those two
     * ever come out differently then either the reference resolved to something
     * else or it was charged differently - which is the one thing this may
     * never do.
     */
    it('spends exactly what saying it out in full would have spent', async () => {
        const carried = await readyToSit('carry-on');
        const typed = await readyToSit('carry-on');

        const firstA = await carried.game.act('I cultivate for a year');
        const firstB = await typed.game.act('I cultivate for a year');
        expect(firstA.state.run.elapsedDays).toBe(firstB.state.run.elapsedDays);
        expect(firstA.state.run.elapsedDays).toBeGreaterThan(0);

        const back = await carried.game.act('I stay where I am and keep at it for ten years');
        const full = await typed.game.act('I cultivate for ten years');

        // The whole claim, in one line: a different way of naming the same act,
        // never a discount and never a different act.
        expect(back.state.run.elapsedDays).toBe(full.state.run.elapsedDays);
        expect(back.state.cultivator.realmOrdinal).toBe(full.state.cultivator.realmOrdinal);
        expect(back.state.cultivator.spiritStones).toBe(full.state.cultivator.spiritStones);
        // And it was a real stretch rather than a shrug.
        expect(back.state.run.elapsedDays).toBeGreaterThan(firstA.state.run.elapsedDays);
    }, 180000);

    it('says what it took the sentence to mean', async () => {
        const { game } = await readyToSit('carry-on-legible');
        await game.act('I cultivate for a year');
        const turn = await game.act('I stay where I am and keep at it for ten years');

        // WHERE A READING IS A JUDGEMENT CALL, SHOW IT. The player has to be
        // able to see that "keep at it" was taken to mean another decade, and
        // say otherwise if it was not.
        expect(turn.narration).toContain('Carrying on with');
        expect(turn.narration).toContain('keep at it for ten years');
        const row = turn.toolCalls.find(call => call.name === 'engine.carryingOn');
        expect(row?.action).toBe('cultivate');
        expect(row?.ok).toBe(true);
    }, 180000);

    /**
     * One turn back, not a transcript. The turn between the sitting and the
     * reference is an ordinary free read, and "keep at it" then means the
     * looking - not the decade before it. A memory that reached further would
     * have spent ten years here.
     */
    it('reaches exactly one turn back and no further', async () => {
        const { game } = await readyToSit('carry-on-depth');
        const sat = await game.act('I cultivate for a month');
        expect(sat.state.run.elapsedDays).toBeGreaterThan(0);

        const looked = await game.act('who is here');
        const after = await game.act('keep at it');

        // The free read is what was carried on with, so no day passed.
        expect(after.state.run.elapsedDays).toBe(looked.state.run.elapsedDays);
        expect(
            after.toolCalls.find(call => call.name === 'engine.carryingOn')?.action
        ).toBe('look');
    }, 180000);

    /**
     * A refused turn leaves nothing behind, and saying so plainly is the right
     * answer. It is also a free turn: nothing was spent finding out.
     */
    it('has nothing to repeat after a turn that was refused', async () => {
        const { game } = await opening('carry-on-refused');
        const refused = await game.act('I travel to Nowhereville');
        const again = await game.act('again');

        expect(again.state.run.elapsedDays).toBe(refused.state.run.elapsedDays);
        expect(again.narration).toContain('nothing to repeat');
        const row = again.toolCalls.find(call => call.name === 'engine.carryingOn');
        expect(row?.ok).toBe(false);
        // A refusal names a route, which is what a refusal owes anybody here.
        expect(again.narration).toContain('Say the thing itself');
    }, 180000);

    it('has nothing to carry on with on the first turn of a run', async () => {
        const { game } = await opening('carry-on-first');
        const turn = await game.act('keep at it');
        expect(turn.state.run.elapsedDays).toBe(0);
        expect(turn.narration).toContain('nothing to carry on with');
    }, 180000);
});

describe('the thing the last turn named', () => {
    /**
     * The deterministic tier, which is a shipping mode. No model is configured
     * here at all, and "the cheaper one" still resolves - because the vocabulary
     * is closed and the list is one list the engine itself printed.
     */
    it('resolves a pointer off the listing with no model in the room', async () => {
        const { game } = await opening('cheaper-deterministic');
        const board = await game.act(WHAT_IS_ON_THE_STALL);
        const before = board.state.cultivator.spiritStones;
        const cheaper = quotedFor(board.narration, THE_CHEAPER_NAME);
        const dearer = quotedFor(board.narration, THE_DEARER_NAME);

        // The second line of the board the engine just printed, which is what
        // an ordinal counts against.
        const bought = await game.act('I buy the second one');

        // The state, not the prose: the purse moved, by no more than the
        // cheaper of the two quotes, and therefore not by the dearer book -
        // which is the whole of what "the cheaper one" had to decide. Pinned as
        // a ceiling rather than an equality because a stall under pressure
        // sells under its own quote and says so.
        const spent = before - bought.state.cultivator.spiritStones;
        expect(spent).toBeGreaterThan(0);
        expect(spent).toBeLessThanOrEqual(cheaper);
        expect(cheaper).toBeLessThan(dearer);
        expect(bought.narration).toContain(THE_CHEAPER_NAME);
        const row = bought.toolCalls.find(call => call.name === 'engine.lastTurn');
        expect(row?.summary).toContain(THE_CHEAPER_NAME);
    }, 180000);

    /**
     * The played sentence, with a reader that answers the way the live one did:
     * the right verb, and the player's own demonstrative left in the target.
     * That is what came back as "Not something anybody here sells."
     */
    it('resolves a demonstrative the reader handed straight back', async () => {
        const provider = new ScriptedProvider({
            plans: [
                // THE SAME LISTING THE OTHER ARM READS. This scripted `market`
                // and the deterministic tier's stall read are two different
                // boards - one prices the provisions catalog, the other the
                // books beside the cooking pots - so the "control arm" was
                // comparing two squares and only agreed while one manual
                // happened to be the cheapest thing in the province. The stall
                // read is `buy` with no target, which is what the deterministic
                // tier resolves that question to.
                JSON.stringify({ action: 'buy' }),
                JSON.stringify({ action: 'buy', target: 'that one' })
            ],
            narrations: ['The moment passes.']
        });
        const { game } = await makeGameInWorld({
            worldSeed: WORLD,
            // The SAME run as the deterministic case above, so the pair is a
            // control arm: one situation, two readers, one outcome. What is on
            // the board is a property of the world and the run, and a test that
            // let those differ would be comparing two squares.
            seed: 'cheaper-deterministic',
            narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 })
        });
        await game.newRun('Probe');
        const board = await game.act(WHAT_IS_ON_THE_STALL);
        const before = board.state.cultivator.spiritStones;
        const bought = await game.act(
            'The second one leaves me something to eat with. I will take that one.'
        );

        // "that one" alone decides nothing between eight manuals. What decides
        // it is sitting in the player's own sentence one clause earlier.
        //
        // NO PRICE IS READ HERE, and it cannot be: the narration on this arm is
        // the scripted provider's, so the board's own words never reach it. The
        // subject of this arm is the READER, and the price is pinned by the
        // deterministic arm above against the same world and the same run seed.
        expect(before - bought.state.cultivator.spiritStones).toBeGreaterThan(0);
        expect(bought.narration).toContain(THE_CHEAPER_NAME);
    }, 180000);

    /**
     * AND THE OTHER HALF OF THE SAME RULE.
     *
     * A comparative over a tie has no referent, and the engine may not pick
     * one - that is the ruling `whichOfTheNamedThings` has held since a blind
     * playtest walked somebody off with a book five rungs above them. What was
     * missing was the answer: `resolvingAgainstTheLastTurn` takes an unbindable
     * reference OFF the field so the verb falls back to its own listing, and
     * `turn-engine` threw that away by reading the resolver's `resolutions`
     * instead of its plan. So the player got *"Not something anybody here
     * sells"*, followed by millet, an inn and a ferry crossing, over a board
     * they were reading.
     *
     * Nothing is spent and the board comes back, which is the answer to "which
     * one" that a stall can actually give.
     */
    it('puts the listing back when a comparative cannot settle', async () => {
        const { game } = await opening('cheaper-tied');
        const board = await game.act(WHAT_IS_ON_THE_STALL);
        const before = board.state.cultivator.spiritStones;

        // The premise of the arm, asserted rather than assumed: the cheapest
        // price on this board is shared. If the stall ever stops having a tie
        // this test is measuring nothing and should say so here.
        const quotes = [...(board.narration ?? '').matchAll(/, (\d+) spirit stones/g)]
            .map(m => Number(m[1]));
        expect(quotes.length).toBeGreaterThan(2);
        const cheapest = Math.min(...quotes);
        expect(quotes.filter(q => q === cheapest).length,
            'the board no longer ties at its cheapest price').toBeGreaterThan(1);

        const asked = await game.act('I buy the cheaper one');

        expect(asked.state.cultivator.spiritStones).toBe(before);
        expect(asked.narration).not.toContain('Not something anybody here sells');
        // The board, back, with the prices that made the phrase ambiguous.
        expect(asked.narration).toContain(THE_CHEAPER_NAME);
        expect(asked.narration).toContain('spirit stones');
    }, 180000);

    /**
     * The previous turn reaches phase 1 as its own block, composed fresh and
     * thrown away. It is information and not authority - what it changes is
     * that the reader can see what "it" refers to.
     */
    it('shows the reader one turn of what just happened, and only one', async () => {
        const provider = new ScriptedProvider({
            plans: [JSON.stringify({ action: 'market' }), JSON.stringify({ action: 'look' })],
            narrations: ['The moment passes.']
        });
        const { game } = await makeGameInWorld({
            worldSeed: WORLD,
            seed: 'prompt-block',
            narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 })
        });
        await game.newRun('Probe');

        const intents = () => provider.calls.filter(call =>
            (call.messages.find(m => m.role === 'system')?.content ?? '')
                .startsWith('You are the intent router'));
        const userText = (at: number) =>
            intents()[at]?.messages.find(m => m.role === 'user')?.content ?? '';

        await game.act('what is for sale here');
        // Nothing had happened yet, so the block is left out entirely rather
        // than sent as a header with "nothing" under it.
        expect(userText(0)).not.toContain('THE TURN BEFORE THIS ONE');

        await game.act('who is standing about');
        const second = userText(1);
        expect(second).toContain('THE TURN BEFORE THIS ONE');
        expect(second).toContain('Lesser Qi-Gathering Manual');
        // One turn, and it says so to the reader as well as being true.
        expect(second).toContain('one turn only');
    }, 180000);
});

describe('the vocabulary, which is closed and small', () => {
    it('reads the ways somebody says carry on', () => {
        for (const said of [
            'keep at it',
            'I keep at it',
            'I stay where I am and keep at it for ten years',
            'keep going',
            'carry on',
            'I carry on with it',
            'do it again',
            'again',
            'the same again',
            'more of the same',
            'I do the same thing again',
            'back to it',
            'stick with it',
            'press on',
            'I keep at it for another decade'
        ]) {
            expect(theSentenceCarriesOn(said), said).not.toBeNull();
        }
    });

    /**
     * The clause has to BE the phrase, give or take a span. "I keep going
     * north" is about going north, and swallowing it would steal a turn from
     * somebody who said where they were going.
     */
    it('leaves alone a sentence that only contains the words', () => {
        for (const said of [
            'I keep going north',
            'I keep my head down and work the water for a year',
            'I carry on down the road to Cloud Gate',
            'I stay at the inn',
            'I go on foot',
            'I attack him again'
        ]) {
            expect(theSentenceCarriesOn(said), said).toBeNull();
        }
    });

    const NAMED: ThingNamed[] = [
        { name: 'Lesser Qi-Gathering Manual', stones: 8 },
        { name: 'Five-Breath Circulation Scripture', stones: 13 }
    ];

    it('picks by price, by order, and by the sentence around a demonstrative', () => {
        expect(whichOfTheNamedThings('cheaper one', '', NAMED)?.stones).toBe(8);
        expect(whichOfTheNamedThings('the more expensive one', '', NAMED)?.stones).toBe(13);
        expect(whichOfTheNamedThings('the second one', '', NAMED)?.stones).toBe(13);
        expect(
            whichOfTheNamedThings('that one', 'the cheaper one leaves me something to eat with '
                + 'and I will take that one', NAMED)?.stones
        ).toBe(8);
    });

    /**
     * It never guesses. "That one" against two things with nothing to tell them
     * apart is refused, and the phrase goes to the resolver exactly as the
     * player typed it - picking one would be the reader deciding which manual
     * somebody bought.
     */
    it('refuses to choose where the player has not', () => {
        expect(whichOfTheNamedThings('that one', 'I will take that one', NAMED)).toBeNull();
        expect(whichOfTheNamedThings('cheaper one', '', [])).toBeNull();
        // A real name is not a reference and is never touched.
        expect(whichOfTheNamedThings('Lesser Qi-Gathering Manual', '', NAMED)).toBeNull();
    });

    /**
     * One book named twice at two prices is one book. Measured: a stall listing
     * a title at 13 and somebody in the square holding one at 8 made "the
     * cheaper one" resolve to the DEARER of the two titles the player had been
     * shown.
     */
    it('counts one thing once, at the price it was first quoted', () => {
        const kept = withoutSayingTheSameThingTwice([
            { name: 'Lesser Qi-Gathering Manual', stones: 8 },
            { name: 'Five-Breath Circulation Scripture', stones: 13 },
            { name: 'Five-Breath Circulation Scripture', stones: 8, from: 'a man in the square' }
        ]);
        expect(kept.map(thing => thing.stones)).toEqual([8, 13]);
        expect(whichOfTheNamedThings('the cheaper one', '', kept)?.name)
            .toBe('Lesser Qi-Gathering Manual');
    });
});
