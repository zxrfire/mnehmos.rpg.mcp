/**
 * 灭门 has its own words, and the table could only say the singular one.
 *
 * Measured with the deterministic reader, which is the shipping mode with no
 * model configured:
 *
 *   I kill his family          -> attack("his family", kill)
 *   I exterminate his family   -> unclear
 *   I wipe out the Duan family -> unclear
 *
 * `AGENTS.md`, twice over. *"If a near-synonym works, the phrasing that fails
 * is a bug"* - a player cannot find the working half except by guessing. And
 * *"read the genre before you read the sentence"* - house extermination is the
 * setting's own set piece, and **a reader that can say the one-person version
 * of an act and not the many-person version has taken a side**, whatever the
 * code around it does.
 *
 * Kept in its own file because it lives in `verb-pattern-table.ts`, which
 * another agent holds. The mechanism these sentences now reach is
 * `acts-over-a-set.ts` and is tested in `an-act-over-a-set.test.ts`.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/verb-pattern-table';

describe('the words for killing more than one person', () => {
    // The harness is loaded first so the module graph initialises in the order
    // every other test in this directory initialises it; importing the table
    // ahead of it leaves `actions.ts` half-evaluated.
    it('routes them to the same verb and the same intent as `kill`', async () => {
        await makeGameInWorld({ seed: 'words', worldSeed: 'words' });

        for (const said of [
            'I exterminate his family',
            'I wipe out the Duan family',
            'I slaughter everyone here',
            'I massacre the whole sect'
        ]) {
            const read = parseIntent(said);
            expect(read.action, said).toBe('attack');
            expect(read.intent, said).toBe('kill');
            expect(read.target, said).toBeTruthy();
        }
    }, 120000);

    /**
     * The narrow-fix guard. These words are being added because two sentences
     * were measured failing, not because the table wanted more verbs - so an
     * ordinary sentence with `wipe` or `finish` in it must go on reaching what
     * it reached.
     */
    it('does not steal a sentence that is not about killing anybody', async () => {
        await makeGameInWorld({ seed: 'words-2', worldSeed: 'words-2' });

        expect(parseIntent('I wipe the sweat off my face').action).not.toBe('attack');
        expect(parseIntent('I finish the manual').action).not.toBe('attack');
    }, 120000);
});
