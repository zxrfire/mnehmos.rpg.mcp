/**
 * Remove the imports a move left behind.
 *
 * `noUnusedLocals` is on, so a family leaving `game.ts` takes its imports out
 * of use and the file stops compiling. Doing that by hand is where a move
 * commit acquires mistakes: the names are scattered through a nine-hundred-line
 * import block and there are usually a dozen of them.
 *
 *   node scripts/prune-imports-that-went-dead.mjs src/web/game.ts
 *
 * It reads tsc's own diagnostics rather than guessing - TS6133 and TS6196 name one
 * identifier, TS6192 says a whole statement is unused - and loops, because
 * deleting a name can make its statement wholly unused on the next pass.
 *
 * ── TWO THINGS IT GOT WRONG, BOTH FIXED, BOTH WORTH KNOWING ──────────────
 *
 * It REFORMATTED while pruning: `import { a, b }` came back as `import {a, b}`.
 * That compiles and is completely wrong for this job. A move commit's entire
 * value is that a reviewer can see nothing changed, and gratuitous whitespace
 * in the diff is exactly the noise that destroys it. Spacing is preserved.
 *
 * And deleting the only name from a multi-line import stranded `import {`
 * above and `} from '...';` below, which is a SYNTAX error rather than an
 * unused import - so it surfaced as "Declaration or statement expected" and
 * read like the move had corrupted the file. An import left with no names is
 * now deleted whole, in both the single-line and multi-line forms.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';

const CR = String.fromCharCode(13);

function read(path) {
    const raw = fs.readFileSync(path);
    const text = raw.toString('utf8');
    return { lines: text.split(CR + '\n').join('\n').split('\n'), crlf: text.includes(CR + '\n') };
}

function write(path, lines, crlf) {
    const text = lines.join('\n');
    fs.writeFileSync(path, crlf ? text.split('\n').join(CR + '\n') : text, 'utf8');
}

/**
 * tsc's report, or a thrown error - never silence.
 *
 * An earlier version returned '' when it could not capture stdout, and ''
 * contains no diagnostics, so it announced "clean, 0 errors" over a file with
 * thirty-eight. A tool that reports success when it cannot see is worse than
 * one that crashes, because the next step trusts it.
 */
function typecheck() {
    // The compiler is invoked through Node and the local package rather than
    // through `npx`, whose shim is not resolvable from every shell this repo
    // is driven from - and when it is not, it exits non-zero with no output at
    // all, which is indistinguishable from a clean tree to anything reading
    // stdout for diagnostics.
    const tsc = 'node_modules/typescript/bin/tsc';
    let out;
    try {
        out = execFileSync(process.execPath, [tsc, '--noEmit'],
            { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
    } catch (e) {
        out = [e.stdout, e.stderr].map(b => (b ?? Buffer.from('')).toString('utf8')).join('\n');
        // A non-zero exit with no diagnostics at all means tsc did not run.
        if (!out.includes('error TS')) {
            throw new Error(`tsc produced no diagnostics and exited non-zero:\n${out.trim() || '(no output)'}`);
        }
    }
    return out;
}

function diagnostics(out, target) {
    const rows = [];
    for (const raw of out.split('\n')) {
        const m = /^(.+?)\((\d+),(\d+)\): error (TS6133|TS6192|TS6196): (.*)$/.exec(raw.trim());
        if (!m) continue;
        if (!m[1].split('\\').join('/').endsWith(target)) continue;
        const named = /^'(.+?)' is declared/.exec(m[5]);
        rows.push({ line: Number(m[2]), code: m[4], name: named ? named[1] : null });
    }
    return rows;
}

/** Last line of the import statement that starts at or above `i`. */
function statementEnd(lines, i) {
    let j = i;
    while (j < lines.length && !/from '[^']+';\s*$/.test(lines[j])) j += 1;
    return j;
}

function statementStart(lines, i) {
    let j = i;
    while (j > 0 && !lines[j].trimStart().startsWith('import ')) j -= 1;
    return j;
}

function prunePass(path, target) {
    const out = typecheck();
    const rows = diagnostics(out, target);
    if (rows.length === 0) return { pruned: 0, out };

    const { lines, crlf } = read(path);
    rows.sort((a, b) => b.line - a.line);   // highest first, so edits do not shift
    const done = new Set();
    for (const { line, code, name } of rows) {
        if (done.has(line)) continue;
        done.add(line);
        const i = line - 1;
        if (code === 'TS6192') {
            lines.splice(i, statementEnd(lines, i) - i + 1);
            continue;
        }
        const text = lines[i];
        if (text.trimStart().startsWith('import ') && text.includes(' from ')) {
            const kept = [];
            const braces = /\{([^}]*)\}/.exec(text);
            if (braces) {
                for (const part of braces[1].split(',')) {
                    const p = part.trim();
                    if (p && p.split(/\s+/).pop() !== name) kept.push(p);
                }
            }
            // Spacing preserved on purpose: see the header.
            if (kept.length === 0) lines.splice(i, statementEnd(lines, i) - i + 1);
            else lines[i] = text.replace(/\{[^}]*\}/, `{ ${kept.join(', ')} }`);
            continue;
        }
        // A name inside a braced import that spans lines.
        //
        // COUNT NAMES, NOT LINES. An earlier version counted the lines between
        // the braces and treated "one line" as "one name", so a wrapped list -
        //     import {
        //         localPrice, canAdvanceHere, requireRegion, REGIONS
        //     } from '...';
        // - looked like a single-name import and the whole statement was
        // deleted because ONE of the four had gone unused. Three live imports
        // vanished and the file stopped compiling somewhere else entirely.
        const open = statementStart(lines, i);
        const end = statementEnd(lines, i);
        const inside = lines.slice(open + 1, end)
            .filter(l => l.trim() && !l.trimStart().startsWith('//'));
        const nameCount = inside.reduce(
            (n, l) => n + l.split(',').filter(p => p.trim()).length, 0);
        if (lines[open].trimEnd().endsWith('{') && nameCount === 1) {
            lines.splice(open, end - open + 1);
            continue;
        }
        // Several names share this line: take out the one, leave the rest.
        const parts = text.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
            const kept = parts.filter(p => p.split(/\s+/).pop() !== name);
            const indent = text.slice(0, text.length - text.trimStart().length);
            const trailing = text.trimEnd().endsWith(',') ? ',' : '';
            lines[i] = indent + kept.join(', ') + trailing;
            continue;
        }
        const hadComma = text.trimEnd().endsWith(',');
        lines.splice(i, 1);
        if (!hadComma && i > 0 && lines[i - 1].trimEnd().endsWith(',')) {
            lines[i - 1] = lines[i - 1].trimEnd().slice(0, -1);
        }
    }
    write(path, lines, crlf);
    return { pruned: done.size, out };
}

function main() {
    const path = process.argv[2];
    if (!path) {
        console.error('usage: prune-imports-that-went-dead.mjs <file>');
        process.exit(2);
    }
    const target = path.split('/').pop();
    for (let pass = 1; pass <= 12; pass += 1) {
        const { pruned, out } = prunePass(path, target);
        if (pruned === 0) {
            const left = out.split('\n').filter(l => l.includes('error TS'));
            console.log(`clean after ${pass - 1} pass(es); ${left.length} error(s) left in the project`);
            for (const l of left.slice(0, 20)) console.log('   ', l.trim());
            process.exit(left.length === 0 ? 0 : 1);
        }
        console.log(`pass ${pass}: pruned ${pruned}`);
    }
    console.error('gave up after 12 passes');
    process.exit(1);
}

main();
