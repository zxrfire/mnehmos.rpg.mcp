/**
 * Prose that exists twice, and can therefore drift.
 *
 * This world's design is written in two places at once - `docs/world/*.md` and
 * long comments and string constants in `src/data/cultivation/*.ts` - and the
 * cost of that is not duplication for its own sake. It is that two copies of a
 * rule diverge silently, and the next person to read one of them acts on a
 * version the rest of the repo has moved past. Tonight that happened six times
 * in one session, twice expensively.
 *
 * So this finds sentences of real substance appearing in more than one file,
 * normalised so that formatting differences cannot hide a copy. It is not a
 * plagiarism check. A short shared phrase is fine; a whole stated rule in two
 * files is a fact with two owners.
 *
 * What to do about a hit, in order of preference:
 *   1. Delete one copy and link to the other. A pointer costs a reader nothing.
 *   2. If both need the text, derive one from the other at build time.
 *   3. If they are genuinely different claims that happen to share wording,
 *      change the wording so the next reader is not misled.
 *
 * Run: node scripts/find-duplicated-prose.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Long enough to be a claim, short enough not to be a whole passage. */
const MIN = 70;
const MAX = 400;

/** Not duplication worth reporting. */
const BENIGN = [
    /^\[?\s*\.\.\/\.\.\/src/,          // a link to the same file from two docs
    /^see \[/,                          // a shared cross-reference line
];

function sourceFiles() {
    const out = [];
    const walk = (dir, ok) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const f = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (!/node_modules|\.git|dist|bastion/.test(f)) walk(f, ok);
            } else if (ok(e.name)) out.push(f);
        }
    };
    walk(path.join(ROOT, 'docs'), n => n.endsWith('.md') && n !== 'INDEX.md');
    walk(path.join(ROOT, 'src', 'data'), n => n.endsWith('.ts'));
    return out;
}

export function findDuplicates() {
    const seen = new Map();
    for (const f of sourceFiles()) {
        const rel = path.relative(ROOT, f).split(path.sep).join('/');
        const text = fs.readFileSync(f, 'utf8');
        for (const raw of text.split(/(?<=[.!?])\s+|\n/)) {
            const s = raw.replace(/[*_`>#|\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
            if (s.length < MIN || s.length > MAX) continue;
            if (!/[a-z]{4}/.test(s)) continue;
            if (BENIGN.some(re => re.test(s))) continue;
            if (!seen.has(s)) seen.set(s, new Set());
            seen.get(s).add(rel);
        }
    }
    return [...seen.entries()]
        .filter(([, where]) => where.size > 1)
        .map(([text, where]) => ({ text, files: [...where].sort() }))
        .sort((a, b) => b.text.length - a.text.length);
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const dupes = findDuplicates();
    console.log(`${dupes.length} passages appear in more than one file.\n`);
    for (const d of dupes) {
        console.log(d.files.join('  <->  '));
        console.log('   "' + d.text.slice(0, 140) + (d.text.length > 140 ? '...' : '') + '"\n');
    }
}
