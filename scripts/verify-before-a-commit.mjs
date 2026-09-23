#!/usr/bin/env node
/**
 * Everything that has to be green before a commit sweep, in the one order that
 * works, one thing at a time.
 *
 *     node scripts/verify-before-a-commit.mjs [output directory]
 *
 * Start it and walk away. Every step writes its whole output to its own file,
 * so nothing ever has to be re-run just to read what it said - which is the
 * failure this script exists to prevent, along with the other one: two heavy
 * things on the machine at once. Steps run strictly in sequence and the script
 * STOPS AT THE FIRST FAILURE rather than ploughing on, because after a
 * typecheck error the rest of the run is noise about the same defect.
 *
 * ── THE ORDER, AND WHY IT IS THIS ORDER ──────────────────────────────────
 *
 *  0. NO CONTROL CHARACTER IN THE SOURCE, which is one second over the whole
 *     tree and goes before everything because its failure is unambiguous and
 *     its cause is never anywhere else.
 *
 *     A regex written through a shell heredoc or a script layer can lose its
 *     escape to that layer: `\b` arrives as the literal byte 0x08. The file
 *     parses, the typecheck passes, the suite is green, and the pattern matches
 *     NOTHING - because a backspace appears in no sentence anybody types. Five
 *     times now, twice in one night, once already landed in the working tree.
 *     No step below can tell anybody about it: a typecheck cannot see inside a
 *     string, and a test only catches it where somebody thought to assert the
 *     sentence.
 *
 *     Numbered zero rather than one so that no step's output file is renamed by
 *     its arrival. `tests/a-control-character-is-never-what-was-meant.test.ts`
 *     is the whole of it; nothing new was written to check this.
 *
 *  1. TYPECHECK the whole tree (`tsconfig.all.json`: src, tests, scripts and
 *     the configs). First of the heavy steps because it is the cheapest way to
 *     be told the tree is broken, and because every later step compiles or
 *     imports this code.
 *
 *  2. BUILD. `npm run build` is `tsc` emitting `dist/`. Second because step 6
 *     runs against `dist/` rather than against the sources, so a stale or
 *     missing build there would render yesterday's register and say nothing.
 *
 *  3. THE GENERATED SURFACES, which must be current before anybody commits or
 *     the ratchet tests in `tests/docs/` fail for a reason nobody caused:
 *       a. the verb surface (`docs/verbs.md`), CHECKED against the verb table
 *       b. the world index (`docs/world/INDEX.md`), CHECKED
 *       c. the house reading lists (`docs/world/BY-HOUSE.md`), REGENERATED
 *     a and b only report. c WRITES: `npm run docs:houses` rewrites BY-HOUSE.md
 *     from the catalogs and `docs/world/`, which is deliberate - it is
 *     generated from everything the sweep is about to commit, so it is rebuilt
 *     here rather than checked, and the rebuilt file is part of the sweep.
 *     After the docs, because it reads them.
 *
 *  4. THE SUITE, in one run. The heaviest step and the one that wants the
 *     machine to itself. Nothing else is running: that is the point of this
 *     script. The fork cap is the repo's own (`vitest.config.ts`), which is
 *     already set low for a machine several agents share.
 *
 *  5. THE PLAYTESTS, both of them, one after the other. They drive the real
 *     verbs through `game.act` in plain English, so they catch what a unit test
 *     cannot: a verb that is reachable and useless. After the suite, because a
 *     suite failure is a smaller thing to read than a playtest transcript.
 *
 *  6. THE HOSTED REGISTER, last. `render-register-full.mjs` imports from
 *     `dist/` - `dist/web/register.js`, `dist/web/register-prose.js`,
 *     `dist/storage/index.js` - so it can only be right after step 2, and it is
 *     last because it is the only step that produces something to look at
 *     rather than something to pass.
 *
 * ── WHAT IT LEAVES BEHIND ────────────────────────────────────────────────
 *
 * One directory, named on the first line of the run and again at the end, with
 * one file per step plus `summary.txt`. Nothing is written into the working
 * tree except BY-HOUSE.md in step 3c, which is intended.
 */

import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** A run's own directory, so two runs never overwrite each other's evidence. */
function defaultOutDir() {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        '-',
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
    ].join('');
    return path.join(os.tmpdir(), `rpg-mcp-verify-${stamp}`);
}

const OUT = path.resolve(process.argv[2] ?? defaultOutDir());
mkdirSync(OUT, { recursive: true });

const REGISTER_HTML = path.join(OUT, 'register.html');

/**
 * The steps, in the order the header argues for.
 *
 * `command` is a single shell line on purpose: `npm` and `npx` are batch files
 * on Windows and are not spawnable as bare executables there, and every one of
 * these is a command somebody would type by hand.
 */
const STEPS = [
    {
        name: 'no control character in the source',
        file: '0-control-characters.txt',
        command: 'npx vitest run tests/a-control-character-is-never-what-was-meant.test.ts '
            + 'tests/docs/no-control-characters.test.ts --reporter=basic',
        onFail: 'A raw control character is an escape eaten by a shell or a script layer - '
            + 'almost always `\\b` arriving as a backspace. The pattern it sits in matches '
            + 'nothing and says nothing about it. Fix the escape at the source; do not '
            + 'delete the character and leave the boundary missing.'
    },
    {
        name: 'typecheck (src, tests, scripts)',
        file: '1-typecheck.txt',
        command: 'npx tsc -p tsconfig.all.json --noEmit'
    },
    {
        name: 'build (emits dist/, which step 6 reads)',
        file: '2-build.txt',
        command: 'npm run build'
    },
    {
        name: 'verb surface is current',
        file: '3a-verb-surface.txt',
        command: 'node scripts/build-the-verb-surface.mjs --check',
        onFail: 'Run `npm run docs:verbs` to regenerate docs/verbs.md, and commit it '
            + 'with the verb change that caused it.'
    },
    {
        name: 'world index is current',
        file: '3b-world-index.txt',
        command: 'node scripts/build-world-index.mjs --check',
        onFail: 'Run `npm run docs:index` to regenerate docs/world/INDEX.md.'
    },
    {
        name: 'house reading lists regenerated (writes BY-HOUSE.md)',
        file: '3c-house-dossiers.txt',
        command: 'npm run docs:houses'
    },
    {
        name: 'the suite, one run',
        file: '4-suite.txt',
        command: 'npx vitest run --reporter=basic'
    },
    {
        name: 'playtest: everything',
        file: '5a-playtest-everything.txt',
        command: 'npx tsx scripts/playtest-everything.ts'
    },
    {
        name: 'playtest: scaling',
        file: '5b-playtest-scaling.txt',
        command: 'npx tsx scripts/playtest-scaling.ts'
    },
    {
        name: 'render the hosted register (reads dist/)',
        file: '6-register.txt',
        command: `node scripts/render-register-full.mjs "${REGISTER_HTML}"`
    }
];

/** The last few lines of a step's output, so a failure says why on screen. */
function tail(file, lines = 25) {
    try {
        const text = readFileSync(file, 'utf8').split(/\r?\n/);
        while (text.length > 0 && text[text.length - 1] === '') text.pop();
        return text.slice(-lines).join('\n');
    } catch {
        return '(no output was captured)';
    }
}

function hhmmss(ms) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

console.log(`Output for this run: ${OUT}`);
console.log(`${STEPS.length} steps, in sequence, stopping at the first failure.\n`);

const done = [];
let failed = null;

for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const file = path.join(OUT, step.file);
    const started = Date.now();
    process.stdout.write(`[${i + 1}/${STEPS.length}] ${step.name} ... `);

    // Straight to the file descriptor rather than through a buffer: a suite run
    // is megabytes of output and there is no reason for any of it to sit in
    // this process's memory.
    const fd = openSync(file, 'w');
    let result;
    try {
        result = spawnSync(step.command, {
            cwd: ROOT,
            shell: true,
            stdio: ['ignore', fd, fd]
        });
    } finally {
        closeSync(fd);
    }

    const took = Date.now() - started;
    const code = result.status === null ? 1 : result.status;
    const ok = code === 0 && !result.error;
    done.push({ name: step.name, file, took, code, ok });
    console.log(`${ok ? 'ok' : `FAILED (exit ${code})`}  ${hhmmss(took)}`);

    if (!ok) {
        failed = { step, file, code, error: result.error ?? null };
        break;
    }
}

const summary = [
    `verify-before-a-commit, ${new Date().toISOString()}`,
    `output: ${OUT}`,
    ''
];
for (const row of done) {
    summary.push(`${row.ok ? 'ok    ' : 'FAILED'}  ${hhmmss(row.took).padStart(7)}  ${row.name}`);
    summary.push(`                 ${row.file}`);
}
if (failed === null) {
    summary.push('', 'Every step passed.');
    if (done.some(row => row.name.startsWith('house reading lists'))) {
        summary.push('BY-HOUSE.md was regenerated and belongs in the sweep.');
    }
} else {
    summary.push('', `STOPPED AT: ${failed.step.name}`, `exit ${failed.code}`, `read: ${failed.file}`);
    if (failed.step.onFail) summary.push(failed.step.onFail);
    if (failed.error) summary.push(`the step could not be started: ${failed.error.message}`);
    summary.push('', 'Nothing after this step was run.');
}
const summaryFile = path.join(OUT, 'summary.txt');
writeFileSync(summaryFile, `${summary.join('\n')}\n`, 'utf8');

if (failed === null) {
    console.log(`\nEvery step passed. Summary: ${summaryFile}`);
    console.log(`The register is at ${REGISTER_HTML}.`);
    console.log('BY-HOUSE.md was regenerated by step 3c and belongs in the sweep.');
    process.exit(0);
}

console.log(`\nSTOPPED AT STEP: ${failed.step.name}`);
console.log(`Its whole output is in ${failed.file}. The last lines of it:\n`);
console.log(tail(failed.file));
if (failed.step.onFail) console.log(`\n${failed.step.onFail}`);
console.log(`\nNothing after this step was run. Summary: ${summaryFile}`);
process.exit(failed.code === 0 ? 1 : failed.code);
