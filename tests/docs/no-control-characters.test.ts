/**
 * No control characters in the source, and there are two of them.
 *
 * ── 0x08, THE EATEN WORD BOUNDARY ────────────────────────────────────────
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
 *
 * ── 0x00, WHICH THIS FILE USED TO BLESS ──────────────────────────────────
 *
 * This header used to say that a NUL sentinel was a string literal doing a
 * job, and let three files keep one. That was wrong, and the reason is not
 * about the byte at all.
 *
 * A file containing a NUL is BINARY to grep. `grep -rn` prints
 * `Binary file <path> matches` and NO LINE, so the match is invisible.
 * AGENTS.md prescribes exactly `grep -rn "yourExport" src/` as the ten second
 * reachability check, and says it has caught seven of the eight defects in
 * that section. That check silently returned nothing for anything declared in
 * these three files:
 *
 *   `the-phrase-that-opens-a-deposit.ts`   `sealPhrase`, and the whole seal
 *   `what-a-change-of-hands-leaves.ts`     `oneAccountEach`
 *   `acts-over-a-set.ts`                   `saidOnceForEverybodyItHappenedTo`
 *
 * So did any repo-wide rename that lists its targets by grep, which AGENTS.md
 * also prescribes. The instrument was blind and reported clean, which is the
 * same failure shape as the inert regexes above: a check that cannot fail.
 *
 * The sentinels themselves were legitimate. All three were separators, and
 * `0x1f` is the byte for that job - `common.ts` and `relationships.ts` were
 * already using it, and they stayed greppable throughout. The fix was to use
 * the same byte, and it changed no behaviour.
 *
 * `0x1f` is still allowed and deliberately so. It is not a word boundary that
 * was eaten, and it does not make a file binary.
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
 * Nothing in this codebase wants a BACKSPACE, and there is exactly one way it
 * arrives, which is a `\b` eaten on the way into the file.
 */
const A_WORD_BOUNDARY_THAT_WAS_EATEN = /\u0008/;

/** The byte that makes a file binary, and therefore invisible to the audit. */
const THE_BYTE_THAT_HIDES_A_FILE_FROM_GREP = /\u0000/;

/** Which tracked files contain a byte, as `path:line`. */
function filesContaining(pattern: RegExp): string[] {
    const offenders: string[] = [];
    for (const path of sourceFiles()) {
        let text: string;
        try {
            text = readFileSync(path, 'utf-8');
        } catch {
            continue;
        }
        if (!pattern.test(text)) continue;
        const line = text.split('\n').findIndex(row => pattern.test(row));
        offenders.push(`${path}:${line + 1}`);
    }
    return offenders;
}

describe('the source holds no control characters', () => {
    it('has no eaten word boundaries anywhere git tracks', () => {
        expect(
            filesContaining(A_WORD_BOUNDARY_THAT_WAS_EATEN),
            'A backspace here is a `\b` that was eaten writing the file. The regex still '
            + 'compiles and matches nothing.'
        ).toEqual([]);
    });

    it('has no NUL anywhere git tracks, because a NUL hides the file from grep', () => {
        expect(
            filesContaining(THE_BYTE_THAT_HIDES_A_FILE_FROM_GREP),
            'A NUL makes this file binary to grep, so `grep -rn` prints no line for anything '
            + 'declared in it and the reachability check AGENTS.md prescribes silently passes. '
            + 'Use `\u001f` for a separator, as `common.ts` and `relationships.ts` do.'
        ).toEqual([]);
    });

    /**
     * The fix has to stay the fix, and this states it as a rule rather than
     * as a headcount. Asserting that some file still holds a separator would
     * pin a census of the tree and go red the day the last one legitimately
     * went away. What must be true is narrower: a separator is not an
     * offence, so carrying one gets a file reported by neither check above.
     */
    it('does not flag a file for carrying a unit separator', () => {
        const carrying = filesContaining(/\u001f/).map(at => at.split(':')[0]);
        const flagged = new Set([
            ...filesContaining(A_WORD_BOUNDARY_THAT_WAS_EATEN),
            ...filesContaining(THE_BYTE_THAT_HIDES_A_FILE_FROM_GREP)
        ].map(at => at.split(':')[0]));
        expect(carrying.length).toBeGreaterThan(0);
        expect(carrying.filter(path => flagged.has(path))).toEqual([]);
    });
});
