/**
 * One-line doc comments that say what the field name already says.
 *
 *   npx tsx scripts/a-comment-that-restates-its-field.ts [--dir src] [--fix]
 *
 * AGENTS.md: *if a comment restates the code beneath it, delete the comment.*
 * `comments-earn-their-keep.ts` measures the ratio; this finds one shape of the
 * problem exactly, because a ratio tells you a file is bad and not which lines
 * to cut.
 *
 * THE TEST IS THE FIELD NAME'S OWN WORDS. A field called `taken` under
 * "What was taken out of them" carries no word the reader did not already have.
 * A field called `daysSince` under "How long ago the last of it was, in days -
 * not part of the feeling, because a grudge does not fade on a timer here" does,
 * and that comment stays: the second half is a design ruling nothing else says.
 *
 * So the rule is not length and it is not the presence of a comment. It is
 * whether every CONTENT word in the comment is already in the name.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv.includes('--dir')
    ? process.argv[process.argv.indexOf('--dir') + 1]!
    : 'src';
const fix = process.argv.includes('--fix');

/**
 * Words that carry nothing. A comment made only of these plus the field's own
 * name is a comment made of nothing.
 */
const CARRIES_NOTHING = new Set([
    'a', 'an', 'the', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'is', 'are',
    'was', 'were', 'be', 'been', 'it', 'its', 'this', 'that', 'these', 'those',
    'and', 'or', 'but', 'as', 'with', 'from', 'out', 'into', 'they', 'them',
    'their', 'theirs', 'he', 'she', 'him', 'her', 'his', 'we', 'us', 'our',
    'you', 'your', 'somebody', 'someone', 'anybody', 'anyone', 'thing',
    'things', 'what', 'which', 'who', 'whom', 'whose', 'how', 'where', 'when',
    'null', 'true', 'false', 'undefined', 'here', 'there', 'own', 'one', 'ones',
    'single', 'each', 'every', 'all', 'any', 'some', 'no', 'not', 'so', 'than',
    'then', 'up', 'down', 'over', 'under', 'about', 'per', 'via', 'set',
    'value', 'values', 'field', 'flag', 'number', 'string', 'boolean', 'list',
    'array', 'map', 'record', 'object', 'has', 'have', 'had', 'do', 'does',
    'did', 'made', 'make', 'makes', 'given', 'gives', 'give', 'taken', 'takes',
    'take', 'said', 'says', 'say', 'read', 'reads', 'reading', 'holds', 'hold',
    'held', 'carry', 'carries', 'carried', 'names', 'name', 'named', 'called',
    'if', 'else', 'only', 'just', 'still', 'already', 'yet', 'ever', 'never'
]);

/** The words a camelCase or snake_case identifier is made of. */
function wordsIn(identifier: string): string[] {
    return identifier
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
}

/** The content words of a comment: its own words, minus the ones that carry nothing. */
function contentWordsOf(comment: string): string[] {
    return comment
        .replace(/[^A-Za-z0-9' ]+/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 1 && !CARRIES_NOTHING.has(word));
}

/**
 * Whether this comment tells the reader anything the name did not.
 *
 * A word counts as already-known when it IS one of the name's words or contains
 * one - `worstTaken` covers "taken", and a comment about "the heaviest thing
 * taken" adds "heaviest", which is a real word about ordering and keeps it.
 */
function restatesTheName(comment: string, name: string): boolean {
    const known = wordsIn(name);
    const content = contentWordsOf(comment);
    if (content.length === 0) return true;
    return content.every(word =>
        known.some(part => word === part || word.startsWith(part) || part.startsWith(word)));
}

/**
 * Comments this catches and should not, each reviewed once.
 *
 * The word test cannot see a synonym or a range, so these read as restatement
 * and are not: a `0..1` on a `number` is a bound the type does not carry, a
 * `1 = river` is an encoding, `Set for \`theirs\`, and only then` says exactly
 * when a nullable field is null, and `What they take it to be. Never what it
 * is` is the belief-versus-truth ruling the whole knowledge layer rests on.
 *
 * Keyed by the comment's own text, so moving the field does not silently
 * re-allow it.
 */
const REVIEWED_AND_KEPT: readonly string[] = [
    'What they take it to be. Never what it is.',
    'What is left of the body, 0..1.',
    'Their own member, who did it.',
    'River map (1 = river, 0 = no river)',
    'Set for `theirs`, and only then.',
    'Days it takes, if it is taken.',
    'Days it takes, if taken.',
    'Set only where somebody has already taken it.'
];

/** A single-line doc immediately above a field or a parameter. */
const ONE_LINE_DOC = /^\s*\/\*\*(.+?)\*\/\s*$/;
const A_FIELD = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*[:(]/;

export interface ARestatement {
    path: string;
    line: number;
    comment: string;
    field: string;
}

/** Every one of them under `dir`, so a test can assert on the list. */
export function commentsRestatingTheirField(dir: string): ARestatement[] {
    const files: string[] = [];
    (function walk(at: string): void {
        for (const entry of readdirSync(at)) {
            const path = join(at, entry);
            if (statSync(path).isDirectory()) walk(path);
            else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) files.push(path);
        }
    })(dir);

    const found: ARestatement[] = [];
    for (const path of files) {
        const lines = readFileSync(path, 'utf-8').split(String.fromCharCode(10));
        for (let at = 0; at < lines.length - 1; at++) {
            const doc = ONE_LINE_DOC.exec(lines[at]!);
            if (!doc) continue;
            const field = A_FIELD.exec(lines[at + 1]!);
            if (!field) continue;
            if (!restatesTheName(doc[1]!, field[1]!)) continue;
            if (REVIEWED_AND_KEPT.includes(doc[1]!.trim())) continue;
            found.push({
                path,
                line: at + 1,
                comment: doc[1]!.trim(),
                field: lines[at + 1]!.trim()
            });
        }
    }
    return found;
}

// Run directly, this prints and can cut. Imported, it only measures.
if (process.argv[1]?.includes('a-comment-that-restates-its-field')) {
    const found = commentsRestatingTheirField(dir);
    for (const row of found.slice(0, 40)) {
        console.log(`${row.path}:${row.line}`);
        console.log(`     ${row.comment}  ->  ${row.field}`);
    }

    if (fix) {
        const byFile = new Map<string, Set<number>>();
        for (const row of found) {
            const at = byFile.get(row.path) ?? new Set<number>();
            at.add(row.line - 1);
            byFile.set(row.path, at);
        }
        for (const [path, drop] of byFile) {
            const lines = readFileSync(path, 'utf-8').split(String.fromCharCode(10));
            writeFileSync(
                path,
                lines.filter((_, at) => !drop.has(at)).join(String.fromCharCode(10)),
                'utf-8'
            );
        }
    }

    const files = new Set(found.map(row => row.path)).size;
    console.log(`${found.length} restating their own field, across ${files} files`
        + `${fix ? ' - REMOVED' : ''}`);
}