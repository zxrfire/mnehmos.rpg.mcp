#!/usr/bin/env node
/**
 * Every exported name in `src/` that nothing in `src/` reads.
 *
 * WHY THIS EXISTS
 * ---------------
 * This repository's signature defect is not a bug, it is a **module nothing
 * calls**. It compiles, it typechecks, its tests pass, and it reads like
 * settled behaviour to the next person who finds it - so somebody re-derives a
 * system that was already written, or reasons about a rule the game has never
 * once applied.
 *
 * It has cost real work repeatedly. A marriage system was built on four pieces
 * that already existed with no caller anywhere: the binding that settles a
 * heavy account, the cost of walking out of one, the bloodline tier a child
 * inherits, and an oath cause nothing ever produced. The file that named the
 * gap said "there is no marriage system anywhere in this repository" - and it
 * was one caller away from being wrong.
 *
 * `docs/world/INDEX.md` already generates this for exported CONSTANTS in
 * `src/data/cultivation/`. That table is where the discipline started and it
 * covers about a fifth of the surface: it sees `export const NAME = {` in one
 * directory. The things that actually bite are exported FUNCTIONS in
 * `src/engine/`, and nothing was looking at those.
 *
 *     node scripts/find-unwired-exports.mjs            # the list
 *     node scripts/find-unwired-exports.mjs --count    # just the number
 *     node scripts/find-unwired-exports.mjs --json     # for a test to read
 *
 * READ THE OUTPUT AS A QUESTION, NOT A TASK LIST. An unwired export is one of
 * three things and only the first is a defect:
 *
 *   1. Behaviour somebody meant to reach and did not. Wire it.
 *   2. Design stated as data, deliberately, with nothing to plug into yet.
 *      Leave it, and make sure a comment says which it is.
 *   3. A seam held open on purpose - a public API, a thing tests drive.
 *      Leave it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/**
 * Files whose exports are the outside edge of the program.
 *
 * Nothing inside `src/` calls an MCP tool handler or an HTTP route - the
 * runtime does - so counting callers there measures nothing. A barrel is the
 * same case from the other side: re-exporting a name is not reading it.
 */
const EDGE = [
    /^src\/index\.ts$/,
    /^src\/server\/index\.ts$/,
    /\/index\.ts$/,
    /^src\/schema\//,
    /^src\/types\//
];

function sources(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!/node_modules|dist/.test(entry.name)) sources(full, out);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            out.push(full);
        }
    }
    return out;
}

const rel = f => path.relative(ROOT, f).split(path.sep).join('/');

/** `export function foo`, `export const FOO =`, `export async function foo`. */
const EXPORTED = /^export (?:async )?(?:function|const|class) ([A-Za-z_][A-Za-z0-9_]*)/gm;

/**
 * Three answers, not two, and only the first is the finding.
 *
 *   `dead`      nothing anywhere reads it - not the game, not a test. Design
 *               that has never once run, or behaviour somebody meant to reach.
 *   `testOnly`  a test reads it and the game does not. Usually a rule that was
 *               written, pinned, and never plugged in - the shape that has
 *               cost the most time here.
 *   `live`      the game reads it. Not reported.
 */
export function findUnwired() {
    const files = sources(SRC).map(f => ({ rel: rel(f), text: fs.readFileSync(f, 'utf8') }));
    const tests = sources(path.join(ROOT, 'tests'))
        .map(f => ({ rel: rel(f), text: fs.readFileSync(f, 'utf8') }));
    const rows = [];

    for (const file of files) {
        if (EDGE.some(re => re.test(file.rel))) continue;
        for (const m of file.text.matchAll(EXPORTED)) {
            const name = m[1];
            const word = new RegExp(`\\b${name}\\b`);

            // Used inside its own file is used. Such a name is exported more
            // widely than it needs to be, which is a tidiness question and not
            // this one: the thing being hunted here is design nothing anywhere
            // acts on, and a constant its own module reads is acted on.
            const here = (file.text.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length;
            if (here > 1) continue;

            let live = 0;
            for (const other of files) {
                if (other.rel === file.rel) continue;
                // A barrel re-exporting a name has not read it.
                if (/\/index\.ts$/.test(other.rel)) continue;
                if (word.test(other.text)) live++;
            }
            if (live > 0) continue;
            const byTest = tests.some(t => word.test(t.text));
            rows.push({ name, file: file.rel, state: byTest ? 'testOnly' : 'dead' });
        }
    }
    return rows.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const rows = findUnwired();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(rows, null, 2));
    } else if (process.argv.includes('--count')) {
        console.log(rows.length);
    } else {
        const dead = rows.filter(r => r.state === 'dead');
        const testOnly = rows.filter(r => r.state === 'testOnly');
        const byFile = new Map();
        for (const r of dead) {
            if (!byFile.has(r.file)) byFile.set(r.file, []);
            byFile.get(r.file).push(r.name);
        }
        for (const [file, names] of byFile) {
            console.log(`\n${file}`);
            for (const n of names) console.log(`    ${n}`);
        }
        console.log(`\n${dead.length} exported names nothing reads at all, across ${byFile.size} files.`);
        console.log(`${testOnly.length} more are read only by a test.`);
    }
}
