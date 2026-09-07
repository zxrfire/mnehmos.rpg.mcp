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
 * `graves` never passed that test. `place-names.ts` carried FOUR_GRAVES as
 * `Four Graves` and the region catalog carried The Four Graves Terminal - and
 * the catalog has plenty more of the same shape: Glacial Tomb Slash, Sealed
 * Tomb Entrance, The Tended Tomb.
 *
 * So the fix is not a word. A category noun doing duty inside a PROPER NAME is
 * not that word being used as a category, and the anchor is asked of the
 * sentence with its names taken out. These hold that split rather than the
 * prose, so the parser can be rewritten and the split cannot be lost.
 *
 * ── AND THE TOWN WAS RENAMED AFTERWARDS, WHICH THIS FILE DOES NOT FOLLOW ──
 *
 * `PLACE.FOUR_GRAVES` is `Four Names` now. Belt and braces: the parser stopped
 * mis-reading the name, and then the name stopped carrying a game category at
 * all, because a category word in a place name is a coin-flip for the model
 * that classifies a sentence as well as for the table that parses it.
 *
 * `Four Graves` STAYS in the cases below, deliberately and as a retired name.
 * The rule under test is about the SHAPE of a sentence - two capitalised words
 * with a category noun among them - and swapping in the live name would leave
 * three cases that contain no category noun and therefore test nothing. The
 * catalog no longer supplies a name that fails this way, which is the point of
 * the rename; the regression still needs one, so it is kept here. The second
 * block below is the half that reads the live catalog and it needs no literal.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { PLACE_NAMES } from '../../src/data/cultivation/place-names';

describe('a town whose name carries a site noun', () => {
    // The retired name, kept on purpose. See the header: the live catalog has
    // no name that carries a category noun any more, and the rule still has to
    // hold for the next one somebody writes.
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
    it('and admits a ground phrase that names no place in the catalog', () => {
        // The other side of the same test. `old ground` was let in for passing
        // it; `graves` and `spirit veins` were kept out for failing it.
        //
        // `somewhere old` was found by playing: "I look for somewhere old to
        // explore" reached `investigate` carrying the subject "explore", and
        // the engine answered that nothing here answers to it - while the site
        // listing sat one word away. It names no place in the catalog, which is
        // asserted here rather than asserted once by hand and then trusted.
        for (const name of Object.values(PLACE_NAMES)) {
            if (typeof name !== 'string') continue;
            expect(name.toLowerCase(), `${name} would be eaten by the ground phrase`)
                .not.toMatch(/somewhere (?:old|ancient)/);
        }
        const asked = parseIntent('I look for somewhere old to explore');
        expect(asked.action).toBe('site');
        expect(asked.intent).toBe('approach');

        // And the verb on its own stays out. "explore" takes "I explore the
        // village", which is the greedy version this file has reverted once.
        expect(parseIntent('I explore the village').action).not.toBe('site');
    });

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

describe('and the class is retired, not the five names', () => {
    /**
     * The five that were MEASURED as broken, each against a different verb
     * family, kept here as retired names.
     *
     * They were all renamed - a place should not carry a game category, which
     * is a coin-flip for the model that classifies a sentence as well as for
     * the table that parses it. But renaming five names fixes five names. What
     * this holds is that the CLASS is gone: `outsideAnyName` is asked by every
     * branch that anchors on a category noun, so the next name somebody writes
     * cannot be eaten by one.
     *
     * If this file is ever the only thing standing between a rename and a
     * regression, that is the point of it.
     */
    it.each([
        ['Four Graves', 'graves', 'the inheritance-site listing'],
        ['Wind Market', 'market', 'the market board'],
        ['Stone Shadow', 'shadow', 'move/follow'],
        ['Knife Edge', 'knife', 'an attack on somebody called Edge'],
        ['The Iron Ridge Mission', 'mission', 'the errand board']
    ])('%s survives every travel phrasing (was eaten by %s -> %s)', name => {
        for (const verb of ['I travel to', 'I go to', 'I walk to', 'I head for', 'I journey to']) {
            const parsed = parseIntent(`${verb} ${name}`) as { action: string; intent?: string };
            expect(parsed.action, `${verb} ${name}`).toBe('move');
            expect(parsed.intent ?? 'travel', `${verb} ${name}`).toBe('travel');
        }
    });

    /**
     * AND THE CATEGORIES ARE UNTOUCHED, which is the half a blunt fix loses.
     * Every one of these is the same word being used as the category it is.
     */
    it.each([
        ['what graves are near', 'site'],
        ['what is on the market', 'interact'],
        ['I knife the guard', 'attack'],
        ['what missions are there', 'sect'],
        ['I follow him', 'interact']
    ])('%s still reaches %s', (said, action) => {
        expect((parseIntent(said) as { action: string }).action, said).toBe(action);
    });

    /** Every catalogued name, against every phrasing a player travels with. */
    it('leaves the whole catalog reachable, five phrasings deep', () => {
        const swallowed: string[] = [];
        for (const name of PLACE_NAMES) {
            if (typeof name !== 'string') continue;
            if (name.trim().split(/\s+/).length < 2) continue;
            for (const verb of ['I travel to', 'I go to', 'I walk to', 'I head for', 'I journey to']) {
                const parsed = parseIntent(`${verb} ${name}`) as { action: string };
                if (parsed.action !== 'move') swallowed.push(`${verb} ${name} -> ${parsed.action}`);
            }
        }
        expect(swallowed, 'a category noun ate a place name').toEqual([]);
    });
});
