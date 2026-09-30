/**
 * The game told you about them one turn ago and then said it had never heard
 * of them.
 *
 * FOUND BY PLAYING, on turns one and two of a fresh run:
 *
 *   turn 1  "Azure Dew Sect is holding an intake at Clear River Ferry in 69
 *            days, and will hear anybody who has reached Qi Condensation at
 *            all."   (volunteered, unprompted)
 *
 *   turn 2  "I go to the azure dew sect"
 *           -> "No road goes there."
 *           -> 'Unresolved destination "Azure Dew Sect": matches no world
 *               location, no occupied place and NOTHING THIS CULTIVATOR HAS
 *               HEARD OF.'
 *
 * Both halves were doing their job, which is what made it worth a file.
 * `readTheWall` had written the house into the knowledge table through
 * `learnIfNew`, and `somewhereReal` looks for a PLACE. So the sect was known
 * and its ground was not, and the refusal reported the second as though it
 * were the first.
 *
 * The design owner: *"this needs fixing, esp cuz if its something you know it
 * should mention. like, you've heard the abc sect is recruiting."*
 * The catalog now includes landless advertisers. A known name keeps its
 * recruiting paper even when there is no seat to walk to.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/sects.js';
import { theHouseThisNameReaches } from '../../src/web/walking-up-to-a-house.js';

describe('a house you were told about stays known when you ask the way', () => {
    it('says what it told you, instead of saying it never told you', async () => {
        const { game } = await makeGameInWorld({
            seed: 'heard-of-them', worldSeed: 'heard-of-them', worldEnabled: true
        });
        await game.newRun('Wen Shu');

        // Read the house out of the game's own words. Any name the game prints
        // is a name the game must accept.
        //
        // THE WALL, ASKED FOR, rather than whatever a look happened to mention.
        // The house has to be one this cultivator holds BECAUSE OF A BILL - the
        // last assertion below is that the refusal repeats what the paper said -
        // and a look names houses from every source. It also stopped naming any
        // once the opening began reading the wall, because a wall already read
        // goes quiet; asking for it prints the whole wall either way.
        const posted = await game.act('what is posted here');
        const house = SECTS.find(row => posted.narration.includes(`${row.name} is holding an intake`))?.name;
        // A guard that skips the path it exists for is the defect it guards.
        expect(house, posted.narration.slice(0, 400)).toBeTruthy();

        const went = await game.act(`I go to the ${house}`);
        const said = `${went.narration} ${(went.state.log ?? [])
            .filter((row: { role: string }) => row.role === 'engine')
            .map((row: { text: string }) => row.text).join(' ')}`;

        // THE CONTRADICTION IS GONE.
        expect(said).not.toMatch(/nothing this cultivator has heard of/i);

        // AND THE SCENE DOES NOT EXPLAIN THE ENGINE'S OWN CATEGORIES. The
        // first cut said "a name you have been given and not a place you
        // have been given", which is the schema talking.
        expect(went.narration).not.toMatch(/not a (?:place|location) you have been given/i);
        // And it repeats what it actually told them, which is the whole point:
        // the intake is the thing they were asking about.
        expect(said).toMatch(/intake|recruit|will hear anybody/i);
        // A house with a seat has a road. A landless advertiser still has a
        // known name and its paper; promising arrival would invent its seat.
        const destination = game.atHand && theHouseThisNameReaches(game.atHand, house!);
        if (destination) {
            expect(said).not.toMatch(/You do not have the road/);
            expect(went.state.run.elapsedDays).toBeGreaterThan(0);
        } else {
            expect(said).toMatch(/You have the name/);
            expect(went.state.run.elapsedDays).toBe(0);
        }
    }, 300_000);

    /**
     * AND THE PLAIN REFUSAL IS STILL THERE for a name that is genuinely
     * nothing, because the register that catches a misparse must not be
     * loosened by this.
     */
    it('still refuses a name the world has never carried', async () => {
        const { game } = await makeGameInWorld({
            seed: 'heard-of-nobody', worldSeed: 'heard-of-nobody', worldEnabled: true
        });
        await game.newRun('Wen Shu');

        const went = await game.act('I go to the Ninefold Abyssal Vigil');
        const said = `${went.narration} ${(went.state.log ?? [])
            .filter((row: { role: string }) => row.role === 'engine')
            .map((row: { text: string }) => row.text).join(' ')}`;
        expect(said).toMatch(/no road goes there|matches no world location/i);
        expect(went.state.run.elapsedDays).toBe(0);
    }, 300_000);
});
