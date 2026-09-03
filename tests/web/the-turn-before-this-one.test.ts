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
 * The world is pinned as well as the run, and the two prices below are read off
 * it rather than assumed. In this world the copyist's stall at the opening
 * square lists the Lesser Qi-Gathering Manual at 8 spirit stones and the
 * Five-Breath Circulation Scripture at 13, which is what makes "the cheaper
 * one" a question with an answer.
 */
const WORLD = 'backref-world';
const THE_CHEAPER = { name: 'Lesser Qi-Gathering Manual', stones: 8 };

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
    await harness.game.act('what books are for sale');
    await harness.game.act('I buy the cheaper one');
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
    it('resolves "the cheaper one" with no model in the room', async () => {
        const { game } = await opening('cheaper-deterministic');
        const board = await game.act('what books are for sale');
        const before = board.state.cultivator.spiritStones;

        const bought = await game.act('I buy the cheaper one');

        // The state, not the prose: the purse moved by the cheaper of the two
        // prices the board had just quoted, and the cheaper book is on the
        // sheet.
        expect(bought.state.cultivator.spiritStones).toBe(before - THE_CHEAPER.stones);
        expect(bought.narration).toContain(THE_CHEAPER.name);
        const row = bought.toolCalls.find(call => call.name === 'engine.lastTurn');
        expect(row?.summary).toContain(THE_CHEAPER.name);
    }, 180000);

    /**
     * The played sentence, with a reader that answers the way the live one did:
     * the right verb, and the player's own demonstrative left in the target.
     * That is what came back as "Not something anybody here sells."
     */
    it('resolves a demonstrative the reader handed straight back', async () => {
        const provider = new ScriptedProvider({
            plans: [
                JSON.stringify({ action: 'market' }),
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
        const board = await game.act('what is for sale here');
        const before = board.state.cultivator.spiritStones;

        const bought = await game.act(
            'The cheaper one leaves me something to eat with. I will take that one.'
        );

        // "that one" alone decides nothing between two manuals. What decides it
        // is sitting in the player's own sentence one clause earlier.
        expect(bought.state.cultivator.spiritStones).toBe(before - THE_CHEAPER.stones);
        expect(bought.narration).toContain(THE_CHEAPER.name);
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
            'I carry on down the road to Ninewatch',
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
