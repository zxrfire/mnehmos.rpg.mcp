#!/usr/bin/env node
/**
 * Catalogs in `src/data/cultivation/` that the Standing Register never shows.
 *
 * WHY THIS EXISTS
 * ---------------
 * The register is the one place a person can read what is in this world without
 * reading the code, and it goes stale in a way nothing catches: somebody authors
 * a catalog, wires it into the engine, tests it, and never adds a section - so
 * the sheet keeps rendering, keeps passing, and quietly describes a smaller
 * world than the one the game runs.
 *
 * Measured the day this was written: 28 of the 54 catalog modules were not
 * imported by any register module at all. Spirit beast materials, the
 * conveyance ladder and the artifact recipes were three of them, and the design
 * owner found all three by reading the published sheet and asking where they
 * were. That is the failure this is instrumented against.
 *
 *     node scripts/find-catalogs-the-register-does-not-show.mjs
 *     node scripts/find-catalogs-the-register-does-not-show.mjs --exports
 *     node scripts/find-catalogs-the-register-does-not-show.mjs --json
 *
 * TWO READINGS, BECAUSE ONE OF THEM IS TOO COARSE ALONE
 * -----------------------------------------------------
 * The MODULE reading asks whether any register module imports the file. It has
 * no false positives - a file nothing imports cannot be on the sheet - and it
 * is blunt: `beasts.ts` would clear it the moment one line of it was shown.
 *
 * The EXPORT reading asks, of every export that is a table of ROWS, whether a
 * register module names it. That is where the owner's complaint actually lived:
 * a catalog half shown reads as a catalog shown. It is a proxy rather than a
 * proof - a table reached through a reader function is reported unnamed - so it
 * is ratcheted rather than forbidden, and the allow-list in the test carries the
 * ones that are deliberate.
 *
 * A ROW HERE IS A QUESTION, NOT A TASK. Some of this is machinery a reader
 * should never be shown: a name pool the generator draws from is not content.
 * Say which it is in the test's allow-list, with the reason, or wire it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src/data/cultivation');
const WEB = path.join(ROOT, 'src/web');

/** Every register module's source, as one string. */
function registerText() {
    return fs.readdirSync(WEB)
        .filter(f => /^register.*\.ts$/.test(f))
        .map(f => fs.readFileSync(path.join(WEB, f), 'utf8'))
        .join('\n');
}

/** The catalog modules, without the barrel and without the region sub-tree. */
function catalogModules() {
    return fs.readdirSync(DATA)
        .filter(f => f.endsWith('.ts') && f !== 'index.ts');
}

const IMPORTED_CATALOG = /from '(?:\.{1,2}\/)+data\/cultivation\/([A-Za-z0-9._-]+)\.js'/g;
const RE_EXPORTED = /export\s[^;]*?from '\.\/([A-Za-z0-9._-]+)\.js'/g;

/**
 * Which catalog modules the register opens, re-exports followed.
 *
 * A barrel that re-exports a name has shown it: the register reads
 * `SECT_ANCESTRY` out of `sects.ts` and the rows live one file further down. A
 * reading that stopped at the import line would report that catalog as unshown
 * while a whole section of every faction entry is built out of it.
 */
export function modulesTheRegisterOpens() {
    const open = new Set(
        [...registerText().matchAll(IMPORTED_CATALOG)].map(m => `${m[1]}.ts`)
    );
    for (let moved = true; moved;) {
        moved = false;
        for (const file of [...open]) {
            const full = path.join(DATA, file);
            if (!fs.existsSync(full)) continue;
            const text = fs.readFileSync(full, 'utf8');
            for (const m of text.matchAll(RE_EXPORTED)) {
                const next = `${m[1]}.ts`;
                if (!open.has(next)) { open.add(next); moved = true; }
            }
        }
    }
    return open;
}

/** Catalog modules no register module opens. */
export function findCatalogsTheRegisterNeverOpens() {
    const open = modulesTheRegisterOpens();
    return catalogModules().filter(f => !open.has(f)).map(file => ({ file }));
}

/**
 * An export whose value is a table of rows.
 *
 * An array literal whose first element is an object or a factory call. A list
 * of ids, a threshold and a block of stated design all fail it, which is the
 * conservative direction: what is counted is what a reader would browse.
 *
 * `Object.freeze([...])` COUNTS, and it did not until a catalog wrote one. 27
 * authored marriages landed as `AUTHORED_MARRIAGES = Object.freeze([...])`, the
 * register showed none of them, and this reading was blind to it twice over -
 * `members.ts` was already opened for the roster, so the module count could not
 * see it either. Widening the pattern the day the section was written costs
 * nothing (measured: the same 68 rows, and that is the only frozen row-array in
 * the catalogs) and closes the hole for the next one.
 */
const ROW_ARRAY =
    /^export const ([A-Z][A-Z0-9_]*)\s*(?::[^=]*)?=\s*(?:Object\.freeze\(\s*)?\[\s*(?:\/\/[^\n]*\n\s*)*([^\s\]])/gm;

/** Row-catalogs no register module names. */
export function findRowCatalogsTheRegisterDoesNotName() {
    const register = registerText();
    const rows = [];
    for (const file of catalogModules()) {
        const text = fs.readFileSync(path.join(DATA, file), 'utf8');
        for (const m of text.matchAll(ROW_ARRAY)) {
            const [, name, first] = m;
            if (first === "'" || first === '"' || /[0-9]/.test(first)) continue;
            if (new RegExp(`\\b${name}\\b`).test(register)) continue;
            rows.push({ file, name });
        }
    }
    return rows;
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const modules = findCatalogsTheRegisterNeverOpens();
    const exports = findRowCatalogsTheRegisterDoesNotName();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify({ modules, exports }, null, 2));
    } else if (process.argv.includes('--exports')) {
        let last = '';
        for (const row of exports) {
            if (row.file !== last) { console.log(`\n${row.file}`); last = row.file; }
            console.log(`    ${row.name}`);
        }
        console.log(`\n${exports.length} row-catalogs no register module names.`);
    } else {
        for (const row of modules) console.log(`    ${row.file}`);
        console.log(
            `\n${modules.length} of ${catalogModules().length} catalog modules are `
            + 'never opened by any register module.'
        );
        console.log(`${exports.length} row-catalogs are not named. Pass --exports to list them.`);
    }
}
