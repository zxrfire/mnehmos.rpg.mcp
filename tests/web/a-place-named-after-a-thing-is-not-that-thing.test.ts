/**
 * A PLACE NAMED AFTER A THING IS NOT THAT THING.
 *
 * ── THE TURN THIS WAS FOUND ON ───────────────────────────────────────────
 *
 * Played: `I travel to Four Graves` never moved anybody. It came back as the
 * inheritance-site LISTING - eighteen catalogued grounds this cultivator could
 * name - because `graves` is a site noun and Four Graves is a town. Zero days
 * passed, the player stayed in Autumn Gate, and every turn after it reasoned
 * about the wrong square.
 *
 * It surfaced as a DIFFERENT test failing: `looking-at-somebody-who-is-not-here`
 * travels one town over and then expects a look at somebody to be refused. The
 * travel silently did not happen, so the person was still standing there, so
 * the look succeeded, so the test failed on an assertion about knowledge
 * records. Two subsystems away from the actual fault.
 *
 * ── WHY THIS IS THE GENERAL CASE AND NOT A WORD ──────────────────────────
 *
 * `site-phrasings.ts` already states the discipline that would have caught it.
 * `scars` and `spirit veins` were tried as site nouns and REVERTED, because
 * *"those words appear in the names and descriptions of places a player travels
 * to rather than walks into"*, and `old ground` was admitted only after passing
 * the test that *"it names no place in the catalog."*
 *
 * `graves` never passed that test. `place-names.ts` carries FOUR_GRAVES and the
 * region catalog carries The Four Graves Terminal - and the catalog has plenty
 * more of them: Glacial Tomb Slash, Sealed Tomb Entrance, The Tended Tomb.
 *
 * So the fix is not a word. A category noun doing duty inside a PROPER NAME is
 * not that word being used as a category, and the anchor is asked of the
 * sentence with its names taken out. These hold that split rather than the
 * prose, so the parser can be rewritten and the split cannot be lost.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { PLACE_NAMES } from '../../src/data/cultivation/place-names';

describe('a town whose name carries a site noun', () => {
    it.each([
        'I travel to Four Graves',
        'I go to Four Graves',
        'I head for Four Graves'
    ])('%s is movement, and carries the town', said => {
        const parsed = parseIntent(said);
        expect(parsed.action, said).toBe('move');
        expect(parsed.target, said).toBe('Four Graves');
    });

    /**
     * And the noun still works, which is the half a blunt fix would have lost.
     * Removing `graves` from the table would have made this reach nothing.
     */
    it.each([
        'what graves are near',
        'what ruins are near',
        'I look for a tomb',
        'I enter the ruin'
    ])('%s is still the site subsystem', said => {
        expect(parseIntent(said).action, said).toBe('site');
    });

    /**
     * The hard case, and the reason the rule is about NAMES rather than about
     * capitals: the same two words plus a category noun is a site again.
     */
    it('reads a named ground inside a town name as a ground', () => {
        const parsed = parseIntent('I travel to the Four Graves ruin');
        expect(parsed.action).toBe('site');
    });
});

describe('and no place in the catalog is swallowed by a category', () => {
    /**
     * The measure the site table set itself, applied to the whole catalog
     * rather than to the one word that failed it.
     *
     * ONLY SHRINK IT. A new site noun that eats a place name is the exact
     * regression this file exists for, and the list is here so that adding one
     * is a deliberate act with a name attached rather than a quiet breakage two
     * subsystems away.
     */
    it('leaves every catalogued place name reachable by travel', () => {
        const swallowed: string[] = [];
        for (const name of Object.values(PLACE_NAMES)) {
            if (typeof name !== 'string') continue;
            // Single-word names give a parser no signal to read and are a
            // different problem; see `outsideAnyName`'s stated limit.
            if (name.trim().split(/\s+/).length < 2) continue;
            const parsed = parseIntent(`I travel to ${name}`);
            if (parsed.action !== 'move') swallowed.push(`${name} -> ${parsed.action}`);
        }
        expect(swallowed, 'a category noun ate a place name').toEqual([]);
    });
});
