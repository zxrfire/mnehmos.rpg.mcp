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
import { makeGame, cultivatorRow } from './harness';

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
     * An agreed bout ends when one party yields, which is what `subdue` already
     * means to the resolver - so this needed no change to the combat tool's
     * closed set of goals.
     */
    it('asks for a yield rather than a killing', () => {
        expect(parseIntent('I challenge him to a duel').intent).toBe('subdue');
        expect(parseIntent('I duel the nearest cultivator').intent).toBe('subdue');
        // And a stated killing is still a killing.
        expect(parseIntent('I kill the nearest cultivator').intent).toBe('kill');
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
    it('finds somebody near the player rather than the nearest body', async () => {
        const { db, game } = makeGame({ seed: 'peer-target', worldEnabled: true });
        const { cultivator } = await game.newRun('Duellist');
        db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);
        await game.act('I look around');

        const acted = await game.act('I challenge someone of my own realm to a duel');

        // It resolved into a real exchange rather than the "nothing to swing
        // at" refusal or the gap rule's decline.
        expect(acted.narration).not.toMatch(/the moment goes past you/);
        expect(acted.narration).not.toMatch(/is not a fight/);
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
