/**
 * Does this branch build for somebody who does not have your working tree?
 *
 * Four times in one day the branch stopped compiling in the same way: an agent
 * committed a file that imports a module, and left the module itself untracked.
 * Everything builds perfectly from where that agent is standing, because the
 * module is right there on disk. It does not exist for anybody else - not for a
 * fresh clone, not for a detached worktree, not for the next agent trying to
 * take a measurement.
 *
 *   src/web/game.ts committed, importing ../engine/world/what-a-confrontation-
 *   does-to-somebody-the-world-holds.js, which was never added.
 *
 * AGENTS.md has said "a file you never committed is invisible to everyone else"
 * for some time, and it kept happening anyway. A rule that is only in prose gets
 * followed by whoever remembers to look; this is the same rule as a command, so
 * nobody has to remember.
 *
 * The invariant, and it is a narrow one on purpose:
 *
 *     EVERY RELATIVE IMPORT IN A TRACKED FILE MUST RESOLVE TO A TRACKED FILE.
 *
 * An untracked module by itself is fine and normal - that is just work in
 * progress. It only becomes everyone's problem the moment something committed
 * points at it. So this stays quiet while you build and speaks up exactly when
 * you are about to strand the branch.
 *
 *   node scripts/does-the-branch-build-without-your-tree.mjs
 *
 * Exits non-zero with the offending pairs, so it can gate a commit.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').map(l => l.trimEnd()).filter(Boolean);

/**
 * Everything committed AT HEAD, not everything in the working tree.
 *
 * This distinction is the whole point. Reading the working copy of a tracked
 * file reports every import an agent has added and not yet committed, which is
 * ordinary work in progress and not a problem for anybody. The question this
 * script exists to answer is narrower and harder: does the branch AS COMMITTED
 * stand up on its own? So both sides come from HEAD - the importers and the set
 * they are allowed to resolve into.
 */
const ref = process.argv[2] ?? 'HEAD';

const tracked = new Set(git(['ls-tree', '-r', '--name-only', ref]).map(p => p.replace(/\\/g, '/')));

/**
 * Relative specifiers only. A bare specifier is a package and node_modules is
 * not our problem; a path alias would need the tsconfig and there are none here.
 */
const SPECIFIER = /(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g;

/**
 * TypeScript source is written with .js specifiers under NodeNext, so the thing
 * on disk is almost never the thing in the quotes. Try what a bundler would.
 */
function candidatesFor(specifier, fromFile) {
    const base = normalize(join(dirname(fromFile), specifier)).replace(/\\/g, '/');
    const withoutJs = base.replace(/\.js$/, '');
    return [
        `${withoutJs}.ts`,
        `${withoutJs}.mts`,
        `${withoutJs}.tsx`,
        `${withoutJs}/index.ts`,
        base,                       // a real .json or .css sitting next door
        `${withoutJs}.d.ts`
    ];
}

const stranded = [];

/**
 * One pass over HEAD rather than `git show` per file - there are hundreds of
 * sources and the round trips dominate everything else.
 */
/**
 * `<ref>:<path>:<content>`. NOT with `-h` - that suppresses the filename, and
 * the first version of this script used it, matched nothing, and reported the
 * branch clean while a stranded import was sitting in it. A check that cannot
 * fail is worse than no check, because it is trusted.
 */
const REF_LINE = new RegExp(`^${ref}:([^:]+):(.*)$`);

let hits = [];
try {
    hits = git(['grep', '-I', '-E', "(from|import)[[:space:]]*\\(?[[:space:]]*['\"]\\.[^'\"]*['\"]",
        ref, '--', 'src', 'tests', 'scripts']);
} catch {
    // git grep exits 1 when nothing matches, which is a clean branch, not an error.
}

for (const raw of hits) {
    const parsed = REF_LINE.exec(raw);
    if (!parsed) continue;
    const [, file, text] = parsed;
    if (!/\.(ts|mts|tsx)$/.test(file)) continue;

    for (const match of text.matchAll(SPECIFIER)) {
        const specifier = match[1];
        const candidates = candidatesFor(specifier, file);

        // Committed at HEAD? Then this import is safe for everyone.
        if (candidates.some(c => tracked.has(c))) continue;

        // Absent from HEAD but sitting on your disk: the failure we are hunting.
        const onDisk = candidates.find(c => existsSync(join(root, c)));
        if (onDisk) {
            if (!stranded.some(s => s.file === file && s.specifier === specifier)) {
                stranded.push({ file, specifier, resolvesTo: onDisk });
            }
            continue;
        }

        // Absent from both: already broken for you too, and your own typecheck
        // will say so far more clearly than this script can.
    }
}

const line = (s = '') => console.log(s);

if (stranded.length === 0) {
    line('Every relative import in a tracked file resolves to a tracked file.');
    line('This branch builds for somebody who does not have your working tree.');
    process.exit(0);
}

line();
line('THIS BRANCH DOES NOT BUILD WITHOUT YOUR WORKING TREE');
line();
line(`${stranded.length} committed import(s) point at a file that was never added:`);
line();
for (const { file, specifier, resolvesTo } of stranded) {
    line(`  ${file}`);
    line(`    imports  ${specifier}`);
    line(`    which is ${resolvesTo}  - present on your disk, absent from the branch`);
    line();
}
line('Add them in the same commit as the importer:');
line();
line(`  git add ${stranded.map(s => s.resolvesTo).join(' ')}`);
line();
process.exit(1);
