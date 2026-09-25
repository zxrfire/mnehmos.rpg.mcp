/**
 * Every verb that has to be pointed at somebody points at the same somebody.
 *
 * ── The measurement ──────────────────────────────────────────────────────
 *
 * Five phrasings, one room, one turn, before this suite existed:
 *
 *   "who is here"                    49 people are about...          counted
 *   "I look for people"              49 people...                    counted
 *   "I ask someone for their name"   "The one nearest to hand..."     unnamed
 *   "I introduce myself to someone"  "You put the words to Mo Tianming"
 *   "I spar with someone here"       "There is nobody in front of you
 *                                     that the thought fits."
 *
 * Four notions of "who" in one room, and none of them handing back a person
 * the player could then use. The engine knew forty-nine people were standing
 * there the whole time.
 *
 * ── The cause, which was one thing ───────────────────────────────────────
 *
 * `POINTING` - the closed set of phrases that describe somebody rather than
 * naming them - did not contain `someone`. So the fight path asked the roster
 * for a cultivator called "someone here", got nothing, and refused; and the
 * conversation path fell through to a FUZZY NAME MATCH and silently landed on
 * a specific person, which is the `POINTING_AT_A_RANK` defect wearing a
 * different coat.
 *
 * These tests pin the shared resolver rather than any one verb, because the
 * failure was never in a verb.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { standWhereThePeopleAre } from './standing-where-the-people-are';
import { KnowledgeGate } from '../../src/web/knowledge';

/**
 * THE WORLD IS PINNED. `makeGame` minted a new world every run, so who was
 * standing where the run opened was a draw: sampled over twelve unpinned
 * worlds, the village a run opens in held between one and five people. A world
 * that put nobody there answers "nobody in front of you", which is correct and
 * a red here that has nothing to do with the resolver. The full suite at
 * fffe3cf6 drew one.
 */
const PINNED = 'world-probe-c';

/** The five that were measured, plus the two that share the resolver. */
const POINTED_AT_SOMEBODY = [
    'I spar with someone here',
    'I spar with someone',
    'I introduce myself to someone',
    'I talk to someone',
    'I bribe someone',
    'I threaten someone',
    'I spar with the nearest cultivator'
];

/**
 * The refusal that means the resolver found nobody.
 *
 * Matched on the engine's own sentence rather than on an outcome, because
 * every one of these verbs is allowed to go badly - a bout that is lost is the
 * resolver working. What must not happen is the moment going past.
 */
const FOUND_NOBODY = 'nobody in front of you that the thought fits';

describe('one notion of who is in the room', () => {
    it('finds somebody for every phrasing that points at nobody in particular', async () => {
        // A fresh run per line: several of these are fights, and a fight that
        // ends the run would make every later line a dead-run refusal rather
        // than a resolver failure. That is the game working and it would read
        // here as the feature broken.
        for (const line of POINTED_AT_SOMEBODY) {
            const { game } = await makeGameInWorld({ seed: 'probe-c', worldSeed: PINNED });
            await game.newRun('Probe');
            const said = await game.act(line) as { narration?: string };
            const text = said.narration ?? '';
            expect(text.length, line).toBeGreaterThan(0);
            expect(text.toLowerCase(), line).not.toContain(FOUND_NOBODY);
        }
    }, 300_000);

    it('answers "someone" with a face they can name rather than with the room\'s tallest', async () => {
        // The footgun this closes. The crowd order is deliberately arbitrary
        // and its last element is the deepest person present, so answering an
        // indefinite pointer with it hands a Qi Condensation disciple the
        // strongest body in the square to pick a fight with.
        const { db, game } = await makeGameInWorld({ seed: 'probe-c', worldSeed: PINNED });
        const { cultivator } = await game.newRun('Probe');
        const known = new KnowledgeGate(db)
            .awareness(cultivator.id)
            .filter(row => row.kind === 'cultivator')
            .map(row => row.name);
        expect(known.length).toBeGreaterThan(0);
        // Where a face they can name is: a place is read into areas of three at most.
        const knownIds = new Set(new KnowledgeGate(db).awareness(cultivator.id)
            .filter(row => row.kind === 'cultivator').map(row => row.id));
        await standWhereThePeopleAre({ game, repos: game.repos }, cultivator.id, knownIds);

        const said = await game.act('I introduce myself to someone') as { narration?: string };
        expect(known.some(name => (said.narration ?? '').includes(name))).toBe(true);
    }, 120_000);

    it('still refuses a name nobody has said, rather than pointing it at the room', async () => {
        // The gate this must never weaken. Widening `POINTING` is a statement
        // about DESCRIPTIONS; an invented name is still an invented name, and
        // it must not quietly become whoever is standing nearest.
        const { game } = await makeGameInWorld({ seed: 'probe-c', worldSeed: PINNED });
        await game.newRun('Probe');
        const said = await game.act('I spar with Nobody Of That Name') as { narration?: string };
        expect((said.narration ?? '').toLowerCase()).toContain(FOUND_NOBODY);
    }, 120_000);
});
