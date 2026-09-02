/**
 * The player must be able to type back what the game printed, and the mortal
 * work board is where that failed hardest.
 *
 * ── THE THREE TURNS THAT PRODUCED THIS FILE ──────────────────────────────
 *
 * A character at 1 HP of 40, 2 spirit stones, and food for 37 days.
 *
 *   > I lie up somewhere quiet and rest until the wound has closed
 *   Seclusion broken after 44 days. HP 1 of 40, unchanged, and the last two
 *   stones spent on rations.
 *
 *   > I take whatever work pays fastest
 *   A listing. Nothing taken, no time passed. The prose then RECOMMENDED a
 *   trade: "Carrying water is the most certain, yielding nearly a full month
 *   of vitality."
 *
 *   > I carry water for a month
 *   "The thought does not resolve."
 *
 * The player quoted the game back at itself and the game did not recognise its
 * own recommendation. `AGENTS.md` has a rule for exactly that, and it is the
 * plainest one in the file: any name the game prints is a name the game must
 * accept.
 *
 * ── AND EVERY HALF OF IT EXCEPT THE SENTENCE ALREADY WORKED ──────────────
 *
 * `job-water-carrier` is in `mortal-world.ts` at `minOrdinal: 0`, available in
 * hamlets, the highest-paying line a Qi Condensation nobody can take. The
 * listing prints it. `GameService.work` has resolved a named trade against the
 * local board since it was written, with a comment about eighteen consecutive
 * attempts that starved a run. `WORK_UNSPECIFIED` has handled "take any work"
 * just as long. Nothing below the parser needed touching; no sentence reached
 * any of it. Played after the fix, standing where the trade is going:
 * **"30 days of Water carrier, and 3 spirit stones for it."**
 *
 * ── WHY A TRADE NAME NEEDS A FRAME AND AN ACTIVITY DOES NOT ──────────────
 *
 * The first version matched the printed names alone and took four other verbs'
 * sentences immediately: "I barter with the courier", "I shadow the courier",
 * "I ask about joining the Gleaners Company" and a conversation with a
 * physician. A trade name is also a person, and one of them is half a
 * faction's name. So a NOUN needs the sentence to be about taking or doing
 * work, and only a verb phrase - "carry water", "burn charcoal" - stands on its
 * own. The second half of this file is that boundary, and it is the half to run
 * when somebody widens this again.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent, tradeNamedIn, type ActionName } from '../../src/web/actions';
import { OCCUPATIONS } from '../../src/data/cultivation/mortal-world';

describe('a job is reachable by its own name', () => {
    it('takes the trade the game just recommended, in the words it used', () => {
        const plan = parseIntent('I carry water for a month');
        expect(plan.action).toBe('work');
        expect(plan.target).toBe('Water carrier');
        expect(plan.days).toBe(30);
    });

    it.each([
        ['I take the charcoal work', 'charcoal burner'],
        ['I burn charcoal for a season', 'charcoal burner'],
        ['I sign on as a ferryman', 'ferryman'],
        ['I take work as a herb picker', 'herb picker']
    ])('%s reaches %s', (said, want) => {
        const plan = parseIntent(said);
        expect(plan.action).toBe('work');
        expect(String(plan.target).toLowerCase()).toContain(want);
    });

    it('is derived from the catalog, so a job added tomorrow is typeable', () => {
        // Not a hand-written list. Every trade the board prints is reachable by
        // its printed name inside a work frame, which is the property that
        // cannot go stale against `mortal-world.ts`.
        for (const job of OCCUPATIONS) {
            const printed = job.name.replace(/\s*\([^)]*\)\s*/g, ' ').split(',')[0]!.trim();
            if (printed.length < 4) continue;
            expect(
                tradeNamedIn(`i take work as a ${printed.toLowerCase()}`),
                `"${printed}" is printed on the board and must be typeable`
            ).toBeTruthy();
        }
    });

    it('takes a taking of work however it is qualified', () => {
        // `take (?:any |whatever |some )?work` admitted three adjectives, so
        // the sentences somebody types when they are out of stones reached
        // nothing at all.
        for (const said of [
            'I take whatever work pays fastest',
            'I take the best paying work',
            'I take whatever pays best',
            'I take whatever work the village will give me'
        ]) {
            expect(parseIntent(said).action, said).toBe('work');
        }
    });
});

describe('and a trade name is also a person', () => {
    it.each([
        ['I barter with the courier', 'interact'],
        ['I shadow the courier', 'interact'],
        ['I go out and pick herbs', 'gather'],
        ['I pick herbs', 'gather'],
        ['I hunt a spirit beast', 'hunt'],
        ['I refine a pill', 'refine']
    ] as ReadonlyArray<readonly [string, ActionName]>)('%s stays %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });

    it('leaves a sentence with a trade noun and no work in it alone', () => {
        for (const said of [
            'I want a drink of water',
            'I look at the water',
            'I go to the mines',
            'I travel to the mines'
        ]) {
            expect(parseIntent(said).action, said).not.toBe('work');
        }
    });

    it('needs a work frame before a bare trade noun counts', () => {
        expect(tradeNamedIn('i speak to the courier')).toBeUndefined();
        expect(tradeNamedIn('i take work as a courier')).toBe('Courier');
        // A verb phrase is unambiguous on its own and needs no frame.
        expect(tradeNamedIn('i carry water')).toBe('Water carrier');
    });
});

/**
 * Recovering from a wound is not sealing yourself in to cultivate.
 *
 * Found on the same run. The engine's own required line told the player what to
 * do - "Sitting still mends it back, and a physician mends it faster" - the
 * physician was refused for price, and six ordinary ways of saying the other
 * half reached nothing at all. `rest` and `sleep` were already in the table and
 * are why the two phrasings that worked worked; the rest of the family was
 * missing.
 */
describe('the language of recovery', () => {
    it.each([
        'I lie up somewhere quiet',
        'I lie low for a while',
        'I recover',
        'I let it heal',
        'I stay off it',
        'I lie up and let it heal',
        'I rest until the wound has closed',
        'I rest until I can stand'
    ])('%s waits rather than secluding', said => {
        expect(parseIntent(said).action).toBe('wait');
    });

    it('never invents a span the sentence does not contain', () => {
        // "until the wound has closed" is not a duration any reader can
        // measure. A guessed year, spent by somebody who cannot eat, is the
        // worst version of the manufactured-span defect.
        expect(parseIntent('I rest until the wound has closed').days).toBeUndefined();
    });

    it('leaves the seclusion family exactly where it was', () => {
        for (const said of [
            'I shut myself away',
            'I seal the door',
            'I go into seclusion',
            'I go into closed door cultivation'
        ]) {
            expect(parseIntent(said).action, said).toBe('seclude');
        }
        expect(parseIntent('I sit down and cultivate').action).toBe('cultivate');
    });
});
