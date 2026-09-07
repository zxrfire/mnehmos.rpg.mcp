/**
 * The player is never shown a symbol out of this repository.
 *
 * PLAYED: `I assess myself` answered, in the narration,
 *
 *   Nothing here refuses an action for being unwise - only `attempt`
 *   refuses, and only for physical reasons. `regard` is the separate
 *   question of how far above or below this they are standing...
 *
 * Two fields of the tool's own result shape, in backticks, to somebody
 * standing in a market town. It reached there because a tool's `note` is read
 * by two audiences that want opposite things - an operator or a model driving
 * the MCP surface, and a person in the world - and `tool-result-prose.ts`
 * pushes it at the second.
 *
 * The note was fixed where it is written. This is the net, because that field
 * is read at three sites and filled by every tool in the game.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';

/** A symbol, a filename, or anything else only somebody with the source says. */
const SOURCE_IN_PROSE = /`[^`]+`|\b\w+\.(?:ts|md)\b|\bundefined\b|\[object Object\]/;

describe('nothing in the narration comes out of the source', () => {
    it('holds across a turn of every ordinary verb', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'no-source', worldSeed: 'no-source', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Reader');
        db.prepare('UPDATE cultivators SET spirit_stones = 3000, realm_ordinal = 6 WHERE id = ?')
            .run(cultivator.id);

        const offences: string[] = [];
        for (const said of [
            'I look around',
            'I assess myself',
            'I assess this place',
            'who is here',
            'what do I know',
            'what is for sale',
            'what can I learn',
            'who would teach me',
            'what is stopping me',
            'what are people saying',
            'I cultivate for 30 days',
            'what missions are there'
        ]) {
            const answer = await game.act(said) as unknown as { narration: string };
            const found = SOURCE_IN_PROSE.exec(answer.narration);
            if (found) offences.push(`${said} -> ${found[0]}`);
        }
        expect(offences, 'the player was shown a symbol from the source').toEqual([]);
    }, 600_000);
});
