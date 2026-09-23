/**
 * No source file carries a raw control character.
 *
 * WHY THIS IS WORTH A TEST. A control character in source is never intended,
 * and the way it gets in is always the same: a tool writing `\b` into a file
 * through a language that reads `\b` as U+0008. It does not look wrong. The
 * file still compiles, because a backspace is a legal character inside a
 * string or a template literal.
 *
 * What it does is silently change meaning. Caught here three times in one
 * session, and the third had already landed in the working tree: a verb
 * pattern meant to end in a word boundary ended in a literal backspace, so
 * `what did i promise` and `what have i sworn` both stopped reading the oath
 * ledger and came back as a blank look. An earlier one left an attribution
 * metric reporting 0% on prose that attributed nearly every line, which is a
 * measurement that lies rather than fails.
 *
 * A word boundary is the common victim because `\b` is the one regex escape
 * that is also a real character.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The ones that are never intentional, listed rather than inferred.
 *
 * NOT a blanket ban on control characters, which was this test's first cut
 * and was wrong: `src/engine/social/common.ts` joins hash-key fields on
 * U+001F, the ASCII UNIT SEPARATOR, chosen exactly because it cannot occur in
 * the data it separates. The separators (U+001C-U+001F) are a deliberate tool
 * and seven call sites use them correctly. What is never deliberate is a
 * mangled escape, and those land as one of these five.
 */
const NEVER_MEANT: Record<number, string> = {
    0x00: 'NUL',
    0x08: 'backspace, almost always a mangled word boundary',
    0x0b: 'vertical tab',
    0x0c: 'form feed',
    0x1b: 'escape'
};

function sourceFilesUnder(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...sourceFilesUnder(path));
        else if (/\.(ts|tsx|mjs|cjs|js|md|json)$/.test(entry)) out.push(path);
    }
    return out;
}

/**
 * The files at the top of the repository, which this test did not read for its
 * whole life until now.
 *
 * ── THE HOLE, AND WHERE IT WAS ───────────────────────────────────────────
 *
 * The walk below took four directories and never the root, so `AGENTS.md`,
 * `README.md`, `package.json` and fifteen other files at the top of the tree
 * were unchecked from the day this test was written. It was found the fifth
 * time this defect bit, by a whole-tree scan run to answer a different
 * question - which is to say it was found by accident and not by the guard.
 *
 * It is the worst place in the repository to have had a hole: `AGENTS.md` is
 * where the process rules live, including the one that tells everybody to run
 * this check after editing a pattern. A rule written in a file the guard cannot
 * read is a rule that can be corrupted by the exact fault it warns about.
 *
 * Not recursive on purpose. Every directory worth walking is either walked
 * below or is build output, and a recursive root walk would read `node_modules`
 * and `dist-bundle` on every run.
 */
function sourceFilesAtTheRoot(): string[] {
    return readdirSync('.')
        .filter(entry => /\.(ts|tsx|mjs|cjs|js|md|json)$/.test(entry))
        .filter(entry => statSync(entry).isFile());
}

describe('a control character is never what was meant', () => {
    it('appears in no source file under src, tests, scripts, docs or the root', () => {
        const found: string[] = [];
        const everywhere = [
            ...['src', 'tests', 'scripts', 'docs'].flatMap(sourceFilesUnder),
            // The top of the tree, which was outside this walk until the fifth
            // time the defect bit. See `sourceFilesAtTheRoot`.
            ...sourceFilesAtTheRoot()
        ];
        {
            for (const path of everywhere) {
                const text = readFileSync(path, 'utf-8');
                // Counted as we go rather than recomputed per hit. The line
                // number was being interpolated from a name that was never
                // declared, so the one moment this test had something to say -
                // a hit - was the moment it threw a ReferenceError instead of
                // reporting one. Nothing found it because nothing had found a
                // control character since.
                let line = 1;
                for (let i = 0; i < text.length; i++) {
                    if (text[i] === '\n') line++;
                    const why = NEVER_MEANT[text.charCodeAt(i)];
                    if (why === undefined) continue;
                    found.push(`${path}:${line} - ${why}`);
                }
            }
        }
        expect(found, `a raw control character, which is always a mangled escape:\n${found.join('\n')}`)
            .toEqual([]);
    });
});
