/**
 * The derived artifact beside the model has to match the file it was derived
 * from, and this is where somebody finds out that it does not.
 *
 * `how-a-player-says-each-verb.ts` is source; `verb-corpus.json` and
 * `verb-corpus.f32` are built from it by `npm run verbs:embed` and are
 * gitignored. The tier hashes the corpus and refuses to load against stale
 * vectors, which is right - a tier answering out of vectors for a corpus that
 * no longer exists is worse than one that will not start.
 *
 * WHAT THIS FILE IS FOR is where that refusal LANDS. Before it, the refusal
 * landed in a player's turn:
 *
 *   > what is this place like now
 *   !!! THREW: The verb corpus has changed since its vectors were built
 *   (file 0b7898..., corpus 9292...). Run `npm run verbs:embed`.
 *
 * A build instruction, in the second person, to somebody with no checkout to
 * run it in. `narrator.ts` now catches that inside a turn and gives the player
 * the table's own refusal instead - which is what they were already getting,
 * because the tier only ever runs on a sentence the table declined. That is
 * only defensible if the failure still arrives, loudly, somewhere a person can
 * act on it. This is one of those places, and it is deliberately the cheapest:
 * it hashes the corpus and reads a small JSON file, and never opens the model.
 *
 * The measurement that made it worth a file of its own: on one commit, with a
 * single `npm run verbs:embed` between the two runs, the suite went from 11
 * failing tests to 5. Five whole test FILES were this one staleness arriving
 * as an unrelated error, in files that ask nothing about the corpus. One
 * failure that names the command is worth more than five that do not.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
    corpusFingerprint,
    verbVectorPaths
} from '../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for.js';

describe('the verb corpus vectors', () => {
    it('were built from the corpus that is on disk now', () => {
        const paths = verbVectorPaths();

        let manifest: { corpusHash?: string };
        try {
            manifest = JSON.parse(readFileSync(paths.index, 'utf8')) as { corpusHash?: string };
        } catch (err) {
            throw new Error(
                `The verb corpus vectors are missing at ${paths.index}. `
                + 'Run `npm run build && npm run verbs:embed`. They are gitignored by design, '
                + 'so a fresh clone has to build them once. '
                + `(${err instanceof Error ? err.message : String(err)})`
            );
        }

        expect(
            manifest.corpusHash,
            'how-a-player-says-each-verb.ts has changed since the vectors beside the model were built. '
            + 'Run `npm run build && npm run verbs:embed`.'
        ).toBe(corpusFingerprint());
    });
});
