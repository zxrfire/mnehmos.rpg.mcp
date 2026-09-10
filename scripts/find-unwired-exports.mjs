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
 * WHETHER AN EXPORTED CONST IS DESIGN STATED AS PROSE RATHER THAN CODE.
 *
 * The header above names three things an unwired export can be, and says only
 * the first is the finding. The second - *design deliberately stated as data*
 * - is a real category here: this repo writes arguments into the catalog as
 * objects of sentences, and `THE_CANDIDATE_REGISTER` is 5,396 characters of
 * text with no code in it at all. Counting those as unwired BEHAVIOUR made the
 * ratchet measure the wrong thing, so a tree could go over its ceiling by
 * writing down more of its reasoning.
 *
 * Measured when this was added: 42 of 567 test-only exports were prose. That
 * is a real correction and not an escape hatch, because it does not close the
 * gap on its own.
 *
 * The test: no function syntax, and overwhelmingly quoted text by volume. A
 * label or a small lookup fails the length floor and stays counted as code.
 */
function isDesignStatedAsProse(text, name) {
    const at = text.indexOf('export const ' + name);
    if (at < 0) return false;
    const eq = text.indexOf('=', at);
    if (eq < 0) return false;

    let i = eq + 1;
    // Space, newline, carriage return, tab, by codepoint: a literal escape
    // here does not survive every way this file gets edited.
    const BLANK = [32, 10, 13, 9];
    while (i < text.length && BLANK.indexOf(text.charCodeAt(i)) >= 0) i++;
    const open = text[i];
    let body;
    if (open === '{' || open === '[') {
        const close = open === '{' ? '}' : ']';
        let depth = 0;
        let j = i;
        for (; j < text.length; j++) {
            if (text[j] === open) depth++;
            else if (text[j] === close) { depth--; if (depth === 0) break; }
        }
        body = text.slice(i, j + 1);
    } else {
        body = text.slice(i, i + 400);
    }
    if (body.indexOf('=>') >= 0 || body.indexOf('function') >= 0) return false;

    // Characters sitting inside a string literal. A plain scanner rather than a
    // regex, because the escape for an escape does not survive every editor.
    const BACKSLASH = String.fromCharCode(92);
    let quoted = 0;
    for (let k = 0; k < body.length; k++) {
        const c = body[k];
        if (c !== "'" && c !== '"' && c !== '`') continue;
        k++;
        while (k < body.length && body[k] !== c) {
            if (body[k] === BACKSLASH) k++;
            quoted++;
            k++;
        }
    }
    return quoted > 200 && quoted / body.length > 0.7;
}

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
                // A barrel RE-EXPORTING a name has not read it. A barrel that
                // CALLS one has.
                //
                // This used to skip every `index.ts` outright, which is right
                // for the first case and wrong for the second - and the second
                // is real: several barrels in this repo are pipelines that
                // import their steps and run them. Those steps were all
                // reported unwired while being called from their own barrel,
                // which is the worst kind of false positive, because it points
                // at working code and says delete it.
                //
                // So the re-export STATEMENTS are removed and what is left of
                // the file is read normally. A name that survives that strip is
                // one the barrel actually does something with.
                const text = /\/index\.ts$/.test(other.rel)
                    ? other.text.replace(/^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+[^\n]*$/gm, '')
                    : other.text;
                if (word.test(text)) live++;
            }
            if (live > 0) continue;
            const byTest = tests.some(t => word.test(t.text));
            rows.push({
                name,
                file: file.rel,
                state: byTest ? 'testOnly' : 'dead',
                kind: isDesignStatedAsProse(file.text, name) ? 'prose' : 'code'
            });
        }
    }
    return rows.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
}

/**
 * ── THE SECOND SHAPE: DATA THE PLAYER HAS NO VERB FOR ────────────────────
 *
 * `findUnwired` answers one question - does anything import this name - and
 * that turns out to be the CHEAPEST shape of unreachable and the rarest one in
 * practice. It was green through every defect found in the sweep that produced
 * this function. What is expensive is a value going missing between two
 * functions that DO call each other, and a catalog nothing lets you act on.
 *
 * This is the second of those, and it is mechanical enough to measure: a table
 * in `src/data/` that the VERB LAYER never reads. `src/web/` is where the
 * player's sentences turn into acts, so a catalog no file there imports is a
 * catalog whose contents cannot be spent, taken, entered, bought or refused,
 * however much of the engine reads it.
 *
 * Measured when this landed: auction venues carry cadence, entry bonds and
 * floor protections, encounters announce sales with lots and reserves, and no
 * verb bids. Structural repair medicine has doses in every world, a reference
 * table, and no verb spends one.
 *
 * READING THE ENGINE IS NOT ENOUGH AND THAT IS THE POINT. A table the world
 * simulation consults is live for the WORLD and unreachable for the PLAYER,
 * and those are different findings. This reports the second.
 *
 * A row here is a question, not a task. Plenty of data is legitimately the
 * world's own - what a house is like, what a region grows - and the player
 * acts on its consequences rather than on the table. What the row asks is
 * whether anybody MEANT it to be actable.
 */
export function findDataWithNoVerb() {
    // THE ACT SURFACE IS TWO DIRECTORIES AND NOT ONE. `src/web/` turns a
    // player's sentence into a verb, and `src/server/` is where several of
    // those verbs actually run - `handleStanding` and `handleOrder` are as
    // much a player act as anything in `web`. Measured against `web` alone
    // this reported the dao-ground catalog unreachable, and the standing read
    // has been calling into it from `server/consolidated` all along.
    const verbs = [
        ...sources(path.join(SRC, 'web')),
        ...sources(path.join(SRC, 'server'))
    ]
        .map(f => fs.readFileSync(f, 'utf8'))
        .join(String.fromCharCode(10));

    const rows = [];
    for (const file of sources(path.join(SRC, 'data'))) {
        const relPath = rel(file);
        // The barrel is not data. It re-exports, which is how most of this
        // directory reaches a reader in the first place.
        if (/\/index\.ts$/.test(relPath)) continue;
        const text = fs.readFileSync(file, 'utf8');

        // BY NAME AND NEVER BY FILENAME. Almost every verb file imports from
        // `data/cultivation/index.js`, so asking whether the verb layer names
        // the MODULE reports live catalogs as unreachable - the barrel is the
        // whole point of the barrel. What settles it is whether any name the
        // module exports is written anywhere in the verb layer.
        const names = [...text.matchAll(EXPORTED)].map(m => m[1]);
        if (names.length === 0) continue;
        const read = names.filter(
            n => new RegExp(`\\b${n}\\b`).test(verbs)
        );
        if (read.length > 0) continue;
        rows.push({ file: relPath, exports: names.length });
    }
    return rows;
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
        // THE HEADLINE COUNTED PROSE AND THE RATCHET DOES NOT, so the two
        // disagreed by exactly the prose rows - the CLI said 154 and 487 where
        // `design-does-not-go-unwired.test.ts` pinned 144 and 445. Anybody
        // comparing them read the tree wrong, and the numbers a person quotes
        // are the ones the CLI printed.
        //
        // `isDesignStatedAsProse` is the split: a body with no function syntax
        // that is overwhelmingly quoted text is design SAID rather than design
        // RUN, and wiring it is a category error. Both halves are printed, and
        // the code half is named as the one the ratchet holds.
        const code = rows.filter(r => r.kind === 'code');
        const dead = code.filter(r => r.state === 'dead');
        const testOnly = code.filter(r => r.state === 'testOnly');
        const prose = rows.filter(r => r.kind === 'prose');

        const listing = process.argv.includes('--test-only') ? testOnly : dead;
        const byFile = new Map();
        for (const r of listing) {
            if (!byFile.has(r.file)) byFile.set(r.file, []);
            byFile.get(r.file).push(r.name);
        }
        for (const [file, names] of byFile) {
            console.log(`\n${file}`);
            for (const n of names) console.log(`    ${n}`);
        }
        console.log(
            `\n${dead.length} exported names nothing reads at all, across `
            + `${new Set(dead.map(r => r.file)).size} files.`
        );
        console.log(`${testOnly.length} more are read only by a test.`);
        console.log(
            `Both counts are the CODE half, which is what the ratchet holds. `
            + `${prose.length} further rows are design stated as prose and are not counted.`
        );
        if (!process.argv.includes('--test-only')) {
            console.log('Pass --test-only to list the test-only names instead of the dead ones.');
        }
    }
}
