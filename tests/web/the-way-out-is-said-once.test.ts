/**
 * The same 120 words, three screens running, and on two of them it was most of
 * what there was to read.
 *
 * FOUND BY PLAYING BLIND. A fresh cultivator picked a fight with somebody
 * standing on the grounds, who turned out to be a Sect Warden of two hundred
 * and sixty years, three major realms up. Every round came back ending on this:
 *
 *     What works against Shu Wanping is not a better swing. It is one of these:
 *
 *     "I get out of here" - the first thing that works, and the only one that
 *     works while they are looking at you...
 *     "I talk to them" - somebody who can end you without effort has no reason
 *     to and might have a reason not to...
 *     "I call on somebody who owes me" - not willingness - reach...
 *     "I go and cultivate" - the gap is realms rather than nerve...
 *
 * Word for word, three times. The block is appended to `facts.required`, which
 * is the channel that exists to reach the player VERBATIM, so nothing upstream
 * of it could collapse or vary it.
 *
 * ── WHY THIS IS A DEFECT AND NOT A LIST DOING ITS JOB ────────────────────
 *
 * Nothing is wrong with the routes. They are the best writing in the combat
 * layer and `gap-routes.ts` earns them: every one is a sentence the player can
 * actually type, and the five options with no verb behind them are deliberately
 * not printed.
 *
 * What is wrong is that the realm gap does not move between rounds, so neither
 * do the routes - and this repo has already ruled on exactly this shape. From
 * `composeNarrationUser`'s `ambientIsNews`: *a STANDING CONDITION narrated as
 * if it were news. A player who has read it four times is not being given
 * atmosphere any more.* Same defect, one subject over.
 *
 * ── AND IT IS NOT WITHHELD, WHICH IS THE OTHER HALF ──────────────────────
 *
 * A player who has stopped reading the list is still owed the fact that
 * swinging is not on it, so the second telling still says so. What changes is
 * that it is one line rather than five, which is the same remedy the ambient
 * reading got: volunteered when it is new, stated as standing when it is not.
 *
 * ── AND A SECOND FIGHT IS A SECOND SITUATION ─────────────────────────────
 *
 * The flag lives on the fight rather than on the service. Walking into a new
 * hopeless fight is not the same as swinging again in this one, and somebody
 * who gets the short line about an opponent they have never met is being
 * pointed at a list they were never shown.
 */

import { describe, it, expect } from 'vitest';

import { routesOutOfAGap, sayingWhatWouldWork } from '../../src/web/gap-routes';
import { summariseToolBody } from '../../src/web/tool-result-prose';
import { REAL_OPTIONS } from '../../src/engine/cultivation/combat';

/**
 * The engine's own list, imported rather than retyped. `routesOutOfAGap` keys
 * on the opening word of each entry, so a copy of the strings in this file
 * would let the mapping and the test drift apart and still both pass.
 */
const AS_THE_ENGINE_SAYS_THEM = REAL_OPTIONS;

describe('the ways out of a hopeless fight are said once', () => {
    const routes = routesOutOfAGap(AS_THE_ENGINE_SAYS_THEM);

    it('names them in full the first time', () => {
        const said = sayingWhatWouldWork(routes, 'Shu Wanping');
        expect(said[0]).toContain('not a better swing');
        // One lead sentence and one line per route that survived the mapping.
        expect(said.length).toBe(routes.length + 1);
        expect(routes.length).toBeGreaterThan(0);
    });

    /**
     * THE DEFECT, AS AN INEQUALITY. Asserted against the first telling rather
     * than against a word count, so rewording either one cannot quietly make
     * them the same block again.
     */
    it('does not say them all again on the next round', () => {
        const first = sayingWhatWouldWork(routes, 'Shu Wanping');
        const again = sayingWhatWouldWork(routes, 'Shu Wanping', true);
        expect(again).not.toEqual(first);
        expect(again.length).toBe(1);
        expect(again.join(' ').length).toBeLessThan(first.join(' ').length / 2);
    });

    /**
     * AND STILL SAYS THE ONE THING THAT MATTERS. The short form is a reminder,
     * not a silence: a player who reads only this line still learns that
     * hitting them again is not on the list.
     */
    it('still says that swinging is not one of them', () => {
        const again = sayingWhatWouldWork(routes, 'Shu Wanping', true).join(' ');
        expect(again.toLowerCase()).toContain('swing');
        expect(again).toContain('Shu Wanping');
    });

    /**
     * AND NOTHING IS SAID AT ALL WHERE NOTHING IS CARRIED. Unchanged by this,
     * and asserted because the short form is a new way for a route-less gap to
     * acquire a sentence it should not have.
     */
    it('says nothing when no route survived the mapping', () => {
        expect(sayingWhatWouldWork([], 'Shu Wanping')).toEqual([]);
        expect(sayingWhatWouldWork([], 'Shu Wanping', true)).toEqual([]);
    });
});

/**
 * AND NOT TO SOMEBODY WHO IS NOT GOING TO GET ANOTHER TURN.
 *
 * Played. Foundation Establishment against a Void Tribulation, third attack,
 * dead. The narration ended on the death - *"your eyes stay open, but the
 * village, the woman, and the sobbing man are already gone"* - which is what
 * the death line asks for, and under it the player read four ways out of a
 * life that was over.
 *
 * The list is four things to TYPE NEXT. On a turn there is no next turn it is
 * not advice about anything, and `required` puts it in front of the player
 * whatever the narrator does. `died` is the survival layer's word and it is
 * the player's, which is how both callers read it.
 */
describe('the ways out are not offered to somebody whose run just closed', () => {
    const afterTheFight = (died: boolean) => ({
        outcome: 'no_contest',
        exchanges: [],
        opponent: { id: 'them', name: 'A Void Tribulation cultivator' },
        gap: { options: AS_THE_ENGINE_SAYS_THEM },
        died
    });

    it('offers them while there is a turn left to take one', () => {
        expect(summariseToolBody(afterTheFight(false)).join(' '))
            .toContain('not a better swing');
    });

    it('says nothing about them on the turn the player dies', () => {
        const said = summariseToolBody(afterTheFight(true)).join(' ');
        expect(said).not.toContain('not a better swing');
        expect(said).not.toContain('I get out of here');
    });
});
