/**
 * The listing promised a house would take you. The door is a roll.
 *
 * FOUND BY PLAYING BLIND, and the player acted on it - which is what makes it
 * worth a test rather than a reword. The sequence:
 *
 *     > i want to join a sect
 *     The Azure Dew Sect would take you as a Dew Servant.
 *     None of this has happened... this is what the doors would do if you
 *     walked up to them.
 *
 *     [a day's walk to the grounds]
 *
 *     > i ask to join the azure dew sect
 *     not_taken_on. Azure Dew Sect looked at Road Finder and did not take them.
 *
 * Two screens, one of them a forecast of the other, and they disagreed.
 *
 * ── WHY, AND IT IS NOT THE DOOR'S FAULT ──────────────────────────────────
 *
 * `admissible` is `recruits && ordinal >= admissionOrdinal && door !==
 * 'refused'` - three facts about the house's standing requirement and this
 * cultivator's root. It is a BAR.
 *
 * Whether somebody walking up is taken is a roll, weighted by rungs past that
 * bar, charm, whether the house has watched them leave once already, and how
 * their root reads at the door. The gate is good design and stays exactly as it
 * is: a house looking at a stranger and declining is the genre working.
 *
 * What was wrong is that the listing rendered a bar as an outcome - `would take
 * you` - and then closed with `this is what the doors would do if you walked up
 * to them`, which is a promise in as many words.
 *
 * ── AND THE TWO SCREENS NOW USE ONE VOCABULARY ───────────────────────────
 *
 * The refusal already said what moves it: *standing higher when you come back
 * moves it, and somebody putting you in front of them moves it more*. The
 * listing says the same two things in the same terms, so a player who reads
 * both is not being taught two different models of the same door.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';

describe('a listing states the bar and not the answer', () => {
    /**
     * THE PROMISE IS GONE. Asserted as an absence because the defect was a
     * sentence that should not exist, and because the phrasing that replaces it
     * is pinned by its own assertions below.
     */
    it('does not tell the player a house would take them', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'a-bar-is-not-an-answer' });
        await game.newRun('Road Finder');

        const listing = await game.act('i want to join a sect');
        expect(listing.narration).not.toMatch(/would take you/i);
        expect(listing.narration).not.toMatch(/what the doors would do/i);
    });

    it('says what it does know, which is the bar and the footing', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'a-bar-is-not-an-answer' });
        await game.newRun('Road Finder');

        const listing = await game.act('i want to join a sect');
        expect(listing.narration).toMatch(/takes people at your standing/i);
        // The rank is still named. It is settled by the bar, so it is the one
        // half of the old sentence that was never a forecast.
        expect(listing.narration).toMatch(/would seat you as/i);
    });

    /**
     * AND IT SAYS THE GATE CAN GO AGAINST YOU, in the refusal's own terms.
     *
     * This is the half that makes the change a fix rather than a hedge: a
     * player who is told only "this is their bar" still does not know that
     * walking up is a look they can fail, or what would improve it.
     */
    it('says walking up is a look, and what moves it', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'a-bar-is-not-an-answer' });
        await game.newRun('Road Finder');

        const listing = await game.act('i want to join a sect');
        const said = listing.narration.toLowerCase();
        expect(said).toContain('can go against you');
        expect(said).toContain('standing higher');
        expect(said).toContain('in front of them');
    });
}, 120_000);
