/**
 * Asking about "the crossing" got you pointed at somebody who knows a movement
 * art, because the word turns up inside one's name.
 *
 * FOUND BY A SUITE FAILURE that only appeared once the crash in front of it was
 * fixed. `misparse.test.ts` asserts that asking a bystander a question reaches
 * `engine.askedAbout`; it reached `engine.whoTheyCouldPointYouAt` instead.
 *
 * ── WHAT THE MATCH WAS ───────────────────────────────────────────────────
 *
 * `whoTheyWouldSendYouTo` resolved the topic against the technique catalog with
 * `name.toLowerCase().includes(topic)` and a three-character floor. Measured
 * against the catalog as it stands:
 *
 *     "the"      ->  Sunfeather Conflagration
 *     "one"      ->  Dragonbone Severing Decree
 *     "war"      ->  Burning Heart Cinder Ward
 *     "air"      ->  Paired-Breath Canon
 *     "crossing" ->  Reed-Crossing Qinggong
 *
 * So a question about almost anything could reach the art-holder read, because
 * some three-letter run of it turned up INSIDE a proper name nobody had said.
 * The player is then told, in the game's own voice, where to find an art they
 * never asked about, and the name goes into their knowledge table.
 *
 * ── THREE RULES, ONE FOR EACH WAY IT WENT WRONG ──────────────────────────
 *
 * WORD BOUNDARIES, which kills `war` and `air` on their own. A fragment inside
 * a longer word is not a name.
 *
 * A FLOOR OF FOUR, which kills `the` and `one`. Both are whole words inside
 * several art names and neither means anything; no art in the catalog is named
 * by a word that short.
 *
 * AND THE GAME'S OWN VOCABULARY IS NOT A CATALOG ENTRY, which is the one that
 * matters and the same ruling `ASSESSING_THEMSELVES` keeps one verb over.
 * `crossing` is a real word in a real art's name and is also what everybody
 * calls a breakthrough; between the two readings the mechanic wins, because the
 * player who typed it meant the mechanic in every case anybody has played.
 *
 * An exact full-name match is exempt from all three: somebody who types
 * `Reed-Crossing Qinggong` has named the art and means it.
 */

import { describe, it, expect } from 'vitest';

import { TECHNIQUES } from '../../src/data/cultivation/techniques';

/**
 * The rule as the engine applies it, mirrored here because the method is
 * private and the thing worth pinning is the RULE rather than the call site.
 * `misparse.test.ts` holds the played end of it.
 */
const THE_GAMES_OWN_WORDS = new Set([
    'crossing', 'breakthrough', 'break through', 'barrier', 'bottleneck',
    'cultivation', 'cultivating', 'qi', 'the dao', 'dao', 'realm', 'rank',
    'progress', 'foundation', 'meridians', 'lifespan', 'seclusion'
]);

function anArtByThatName(topic: string): string | null {
    const wanted = topic.trim().toLowerCase();
    if (wanted.length === 0) return null;
    const exact = TECHNIQUES.find(entry => entry.name.toLowerCase() === wanted);
    if (exact) return exact.name;
    if (wanted.length < 4) return null;
    if (THE_GAMES_OWN_WORDS.has(wanted)) return null;
    const asAWord = new RegExp(
        `(?:^|[^a-z0-9])${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`,
        'i'
    );
    return TECHNIQUES.find(entry => asAWord.test(entry.name))?.name ?? null;
}

describe('the catalog no longer answers to a fragment', () => {
    /**
     * THE FIVE MEASURED MATCHES. Each is named so that a later loosening has to
     * explain which of them it is bringing back.
     */
    it.each(['the', 'one', 'sun', 'war', 'air'])('%s names no art', fragment => {
        expect(anArtByThatName(fragment)).toBeNull();
    });

    it('does not read the game\'s own word for a breakthrough as an art', () => {
        expect(anArtByThatName('crossing')).toBeNull();
        expect(anArtByThatName('breakthrough')).toBeNull();
        expect(anArtByThatName('the barrier')).toBeNull();
    });

    /**
     * AND EVERY ART IN THE CATALOG IS STILL REACHABLE BY ITS OWN NAME. This is
     * the assertion that makes the three rules a narrowing rather than a
     * removal: the verb exists so that somebody can be sent to a holder, and a
     * catalog nobody can name is the same as no catalog.
     */
    it('finds every art by its full name', () => {
        for (const art of TECHNIQUES) {
            expect(anArtByThatName(art.name), art.name).toBe(art.name);
            expect(anArtByThatName(art.name.toUpperCase()), art.name).toBe(art.name);
        }
    });

    /**
     * AND A REAL WORD OUT OF A REAL NAME STILL REACHES IT. A player naming an
     * art they have only heard spoken says a word of it, not the whole title,
     * and that is the case the loose match was written for.
     */
    it('still finds an art by a distinctive word of its name', () => {
        const sunfeather = TECHNIQUES.find(art => /sunfeather/i.test(art.name));
        expect(sunfeather, 'the catalog no longer holds the art this case was measured on')
            .toBeDefined();
        expect(anArtByThatName('sunfeather')).toBe(sunfeather!.name);
    });

    /** And nothing at all is not something. */
    it('names no art for an empty topic', () => {
        expect(anArtByThatName('')).toBeNull();
        expect(anArtByThatName('   ')).toBeNull();
    });
});
