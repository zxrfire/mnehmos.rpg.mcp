/**
 * No control characters in the source, and the one that keeps arriving is 0x08.
 *
 * A regex written through a shell heredoc loses its escapes: `\b` becomes a
 * literal BACKSPACE, and the result is still a valid regular expression. It
 * compiles, it runs, and it matches nothing it was written to match.
 *
 * Four of them were in the tree at once when this test was written, and every
 * one was silent:
 *
 *   `PUTTING_THE_QUESTION_TO_SOMEBODY`  a routing guard that never fired
 *   `WHERE_WE_STAND`                    a whole subsystem read, unreachable
 *   `/blinks?\b/i`                      a beast-vocabulary assertion, inert
 *   `/\b0\.\d+ spirit stones/`          a display assertion, inert
 *
 * Two of them were assertions, which is the worst case: a test that cannot
 * fail looks maintained and is not.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Everything git tracks that a person writes by hand. */
function sourceFiles(): string[] {
    return execSync('git ls-files', { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })
        .split('\n')
        .map(line => line.trim())
        .filter(path => /\.(ts|tsx|js|mjs|md|json)$/.test(path));
}

/**
 * ONE BYTE, AND IT IS THE ONE THE ACCIDENT PRODUCES.
 *
 * Not every control character is a mistake - `0x1f` is a deliberate join
 * delimiter in `common.ts` and `relationships.ts`, and `the-phrase-that-opens-a-
 * deposit.ts` uses a NUL sentinel. Those are string literals doing a job.
 * BACKSPACE is different: nothing in this codebase wants one, and there is
 * exactly one way it arrives, which is a `\\b` eaten on the way into the file.
 */
const A_WORD_BOUNDARY_THAT_WAS_EATEN = /\u0008/;

describe('the source holds no control characters', () => {
    it('has no eaten word boundaries anywhere git tracks', () => {
        const offenders: string[] = [];
        for (const path of sourceFiles()) {
            let text: string;
            try {
                text = readFileSync(path, 'utf-8');
            } catch {
                continue;
            }
            if (!A_WORD_BOUNDARY_THAT_WAS_EATEN.test(text)) continue;
            const line = text.split('\n').findIndex(row => A_WORD_BOUNDARY_THAT_WAS_EATEN.test(row));
            offenders.push(`${path}:${line + 1}`);
        }
        expect(
            offenders,
            'A backspace here is a `\\b` that was eaten writing the file. The regex still '
            + 'compiles and matches nothing.'
        ).toEqual([]);
    });
});
