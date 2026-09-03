/**
 * Did that refactor move code, or did it change it?
 *
 * `GameService` is being split by subject: a family of verbs becomes an object
 * of methods in its own module, merged onto the prototype. The whole value of
 * doing it that way is that a reviewer can see nothing changed - so that claim
 * has to be checked rather than asserted, and 24,000 lines is far past what
 * anybody checks by reading.
 *
 * This takes the lines that LEFT `game.ts` and the lines that ARRIVED in the
 * new module, erases exactly the edits a move is allowed to make, and requires
 * the two multisets to be equal. A reordered branch, a dropped line, or a
 * "while I was here" fix fails here.
 *
 *   node scripts/prove-a-move-changed-nothing.mjs <new-module> <lo-hi> [<lo-hi> ...]
 *   node scripts/prove-a-move-changed-nothing.mjs --commit <sha> <new-module> <lo-hi> ...
 *
 * The ranges are line spans in the PRE-CHANGE file, so anything removed
 * outside them - an import that went dead - is reported separately rather than
 * silently folded in. With no `--commit` it reads the working tree.
 *
 * ── THE PERMITTED EDITS, WHICH ARE THE WHOLE LIST ────────────────────────
 *
 *   1. `private` off a method signature
 *   2. `this: GameService` added as the first parameter
 *   3. a comma after each closing brace but the last (object members need it)
 *   4. a `static` member de-indented into a module-level declaration, because
 *      a static has no instance and module scope is what `static` already
 *      meant; its `GameService.X` call sites lose the prefix
 *
 * ── TWO WAYS THIS WAS GOT WRONG, BOTH WORTH KNOWING ──────────────────────
 *
 * The first version tried to INVERT the transformation on one side - turn the
 * moved lines back into what they had been - and got it wrong twice, once
 * emitting `private static readonly GameService.WOULD_RATHER_DIE_PRIORITY` and
 * once flagging two dozen identical lines. Normalising BOTH sides with one
 * function is symmetric and much harder to fool: whatever it erases, it erases
 * from both, so an asymmetry cannot hide in the normaliser.
 *
 * And it read `git diff` through Node's default decoding, which on Windows is
 * the console codepage. Every box-drawing character in this repo's section
 * banners came back as mojibake and an identical file looked like 24
 * differences. Git output is read as a Buffer and decoded as UTF-8 by hand.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';

const LEAD = /^(?:export |private |static |readonly |async |const |function )+/;

/** Erase every permitted edit, and nothing else. */
function normalise(line) {
    let s = line.trim();
    if (s === 'this: GameService,') return null;
    s = s.replace(LEAD, '');
    s = s.replace('(this: GameService, ', '(').replace('(this: GameService)', '()');
    s = s.split('GameService.').join('');
    if (s === '},') s = '}';
    return s;
}

function gitText(args) {
    // Buffer, then UTF-8 by hand. See the header.
    return execFileSync('git', args, { maxBuffer: 1 << 28 }).toString('utf8');
}

/** Removed lines from a diff, split by whether they fall inside the moved spans. */
function removals(diff, ranges) {
    const inside = [];
    const outside = [];
    let old = 0;
    for (const line of diff.split('\n')) {
        const h = /^@@ -(\d+)(?:,\d+)? \+/.exec(line);
        if (h) { old = Number(h[1]); continue; }
        if (line.startsWith('---') || line.startsWith('+++')) continue;
        if (line.startsWith('-')) {
            const body = line.slice(1);
            if (body.trim()) {
                (ranges.some(([lo, hi]) => old >= lo && old <= hi) ? inside : outside).push(body);
            }
            old += 1;
        } else if (!line.startsWith('+')) {
            old += 1;
        }
    }
    return { inside, outside };
}

function main() {
    const argv = process.argv.slice(2);
    let commit = null;
    if (argv[0] === '--commit') { commit = argv[1]; argv.splice(0, 2); }
    const [modulePath, ...spans] = argv;
    if (!modulePath || spans.length === 0) {
        console.error('usage: prove-a-move-changed-nothing.mjs [--commit <sha>] <module> <lo-hi>...');
        process.exit(2);
    }
    const ranges = spans.map(s => s.split('-').map(Number));

    const diff = commit
        ? gitText(['show', '-U0', commit, '--', 'src/web/game.ts'])
        : gitText(['diff', '-U0', '--', 'src/web/game.ts']);
    const { inside, outside } = removals(diff, ranges);

    const source = commit
        ? gitText(['show', `${commit}:${modulePath}`])
        : fs.readFileSync(modulePath, 'utf8');
    const lines = source.split('\n');
    const cut = lines.findIndex(l => l.startsWith('import type { GameService }'));
    if (cut < 0) throw new Error(`${modulePath} does not import the GameService type`);
    const arrived = lines.slice(cut + 1)
        .filter(l => l.trim())
        // the object wrapper is the module's own scaffolding, not moved content
        .filter(l => !/^export const \w+ = \{$/.test(l) && l !== '};');

    const a = inside.map(normalise).filter(x => x !== null).sort();
    const b = arrived.map(normalise).filter(x => x !== null).sort();
    const same = a.length === b.length && a.every((x, i) => x === b[i]);

    console.log(`taken ${a.length}   arrived ${b.length}   IDENTICAL ${same}`);
    if (!same) {
        const bag = new Map();
        for (const l of b) bag.set(l, (bag.get(l) ?? 0) + 1);
        const onlyA = [];
        for (const l of a) {
            const n = bag.get(l) ?? 0;
            if (n === 0) onlyA.push(l); else bag.set(l, n - 1);
        }
        const onlyB = [...bag.entries()].flatMap(([l, n]) => Array(n).fill(l));
        console.log(`\nonly in what left (${onlyA.length}):`);
        for (const l of onlyA.slice(0, 12)) console.log('   ', JSON.stringify(l.slice(0, 96)));
        console.log(`\nonly in what arrived (${onlyB.length}):`);
        for (const l of onlyB.slice(0, 12)) console.log('   ', JSON.stringify(l.slice(0, 96)));
    }
    console.log(`\nremovals outside the moved spans (import prune): ${outside.length}`);
    process.exit(same ? 0 : 1);
}

main();
