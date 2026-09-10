/**
 * A fight somebody would actually choose to have.
 *
 * Combat worked and no player could ever meet it. `attack` resolves only to
 * whoever is NEAREST, who is usually far above, and the categorical-gap rule
 * then correctly declines - "3 major realms is not a fight". So every route
 * into combat was suicide or a refusal, in a setting where a bout between
 * equals is how a disciple measures themselves. Measured before this: attacking
 * the nearest cultivator took a fresh character from 40 HP to 6 in twelve
 * exchanges, and the second attempt killed them.
 *
 * `challenge`, `duel` and `spar with` reached nothing at all.
 */

import { parseIntent } from '../../src/web/actions';
import { makeGame, makeGameInWorld, cultivatorRow } from './harness';

describe('asking for a bout', () => {
    it('resolves the phrasings a player uses', () => {
        for (const text of [
            'I challenge someone of my own realm to a duel',
            'I challenge him to a duel',
            'I duel the nearest cultivator',
            'I spar with someone of my own rank'
        ]) {
            expect(parseIntent(text).action, text).toBe('attack');
        }
    });

    /**
     * A BOUT IS A SWING, NOT A DECLARED ENDING.
     *
     * This asserted `intent === 'subdue'` on a duel and `'kill'` on a killing,
     * and the comment above it read *"an agreed bout ends when one party
     * yields, which is what `subdue` already means to the resolver."* Both were
     * the goal model: the aggressor announced how it would end, and the engine
     * delivered that ending.
     *
     * Which made a spar unable to go wrong - and a spar going wrong is the one
     * thing the genre does with them constantly. It is also flatly contradicted
     * by this repo's own measurement: 2,666 replayed friendly bouts, 115 of
     * them ending with somebody's bar at zero (`nobody-is-invincible.ts`).
     *
     * What separates a bout from a killing now is what the two of them THROW.
     * Two people finding out where they stand use bare hands, meant, at nothing
     * in particular; somebody who means to end it does not hold anything back.
     * The agreement itself is carried by `terms`, where it always belonged, and
     * that is what decides what a killing MEANT rather than whether one is
     * possible.
     */
    it('opens a bout with a bout swing, and a killing with everything', () => {
        expect(parseIntent('I challenge him to a duel').thrown)
            .toEqual({ with: 'fist', at: 'unstated', force: 'committed' });
        expect(parseIntent('I duel the nearest cultivator').thrown)
            .toEqual({ with: 'fist', at: 'unstated', force: 'committed' });
        // And the thing that makes it a bout is the agreement, not a ceiling
        // on what the blows can do.
        expect(parseIntent('I challenge him to a duel').terms).toBe('agreed');

        // A stated killing keeps nothing back, and where that lands is the
        // engine's to settle.
        expect(parseIntent('I kill the nearest cultivator').thrown?.force).toBe('everything');
        expect(parseIntent('I kill the nearest cultivator').terms).not.toBe('agreed');
    });

    /**
     * "I challenge him TO A DUEL" puts the ask after the person, so the subject
     * came out as "him to a duel" and resolved to nobody.
     */
    it('does not take the form of the ask as the name of the person', () => {
        expect(parseIntent('I challenge him to a duel').target).toBe('him');
        expect(parseIntent('I challenge someone of my own realm to a duel').target)
            .toBe('someone of my own realm');
    });

    /**
     * Drilling alone and crossing hands with somebody are different acts, and
     * the parser keeps them apart. Bare `I spar` is practice.
     */
    it('leaves drilling alone alone', () => {
        expect(parseIntent('I spar').action).toBe('train_technique');
        expect(parseIntent('I practise').action).toBe('train_technique');
    });
});

describe('who a peer phrase resolves to', () => {
    /**
     * The real blocker. A peer phrase names a HEIGHT rather than a person, and
     * answering it with whoever is nearest is what made every duel either
     * suicide or a refusal. It picks the closest match on the ladder among the
     * people actually present, and never invents anybody.
     */
    /**
     * WITH THE WORLD PINNED, not merely turned on.
     *
     * `makeGame({ worldEnabled: true })` mints a world from `randomUUID()`, so
     * this test met a different several hundred people every run - a different
     * cast, at different rungs, standing in different places - and the outcome
     * it asserts was being drawn afresh each time. `AGENTS.md`: a played test
     * that pins a seed to an outcome without pinning the world is pinning a
     * coincidence. `makeGameInWorld` creates the world from `worldSeed` before
     * the run opens, which fixes who the peer phrase can possibly find.
     */
    it('finds somebody near the player rather than the nearest body', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'peer-target',
            worldSeed: 'peer-target-world'
        });
        const { cultivator } = await game.newRun('Duellist');
        db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);
        await game.act('I look around');

        const acted = await game.act('I challenge someone of my own realm to a duel');

        // It resolved into a real exchange rather than the "nothing to swing
        // at" refusal or the gap rule's decline.
        //
        // SAID POSITIVELY AS WELL, which is what pinning the world buys. The
        // three negatives below pass on an empty square - "nobody in front of
        // you" matches none of them - so with the cast drawn afresh every run
        // this could and sometimes did assert nothing at all. Against a fixed
        // world there is a fixed answer, and the answer is a bout.
        //
        // WHAT THIS USED TO MATCH, AND WHY IT MOVED. It read `/\d+ exchanges/`,
        // which was the one-call resolver's summary of a whole fight. A fight is
        // held open across turns now, so one act is one ROUND and there is no
        // exchange count to report yet - the claim the comment always made is
        // that a fight HAPPENED, and what says so now is a blow landing and the
        // state of the fight coming back with it.
        expect(acted.narration).toMatch(/You (?:land|reach) /);
        expect(acted.narration).toMatch(/rounds? before neither of you can finish it/);
        expect(acted.narration).not.toMatch(/the moment goes past you/);
        expect(acted.narration).not.toMatch(/is not a fight/);
        expect(acted.narration).not.toMatch(/nobody in front of you/i);
        // And the run is still going, which is the whole point of a bout with
        // an equal rather than with whoever happened to be standing closest.
        expect(cultivatorRow(db, cultivator.id).alive).toBeTruthy();
    }, 120_000);

    /**
     * An empty square still refuses, in the words it already used. The peer
     * phrase asks for a height among the people present; it does not conjure
     * one.
     */
    it('still refuses when there is nobody to ask', async () => {
        const { game } = makeGame({ seed: 'peer-empty', worldEnabled: false });
        await game.newRun('Alone');
        const acted = await game.act('I challenge someone of my own realm to a duel');
        expect(acted.narration).toMatch(/the moment goes past you|nobody in front of you/i);
    }, 120_000);
});
