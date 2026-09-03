#!/usr/bin/env node
/**
 * Which files in `docs/world/` lead a reader to the design written in
 * `src/data/cultivation/`, and which leave them to find it or re-derive it.
 *
 * WHY THIS EXISTS
 * ---------------
 * A large part of this project's design is written in the catalog, in header
 * comments and in exported constants, and no search of `docs/` reaches a `.ts`
 * file. The failure that follows is not that the bible is silent - it is worse
 * than that. The bible frequently holds a SECOND, shallower copy of a ruling
 * with no link in either direction, so a reader finds the shallow copy, has no
 * signal the deeper one exists, and re-derives what was already settled.
 *
 * The worked case: `THE_OFFICE` in `false-immortals.ts` is fifteen keys of
 * argued design about a house's Protector. `immortals.md` had the same subject
 * as prose, pointing nowhere, with three of the rulings already drifted out of
 * it - including one that had anticipated and answered the exact confusion the
 * next reader fell into.
 *
 * So the rule this measures is: **a doc that has a catalog behind it names it.**
 * Not a summary of it - a pointer. The index shows where a thing is; it does
 * not restate it.
 *
 *     node scripts/bible-catalog-pointers.mjs        # list the queue
 *
 * A doc with genuinely no catalog behind it says so in place, with a reason:
 *
 *     <!-- no-catalog: authoring guidance; the register it governs is prose -->
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs', 'world');
const CATALOG = path.join(ROOT, 'src', 'data', 'cultivation');

/**
 * Not part of the routing surface.
 *
 * INDEX.md and BY-HOUSE.md are generated FROM the corpus rather than written
 * against it. NARRATOR-CORE.md is Tier 1: it is loaded whole into every turn's
 * prompt and is never searched, so a pointer in it would be tokens spent on
 * every turn to answer a question nobody asks there.
 */
const GENERATED = new Set(['INDEX.md', 'BY-HOUSE.md', 'NARRATOR-CORE.md']);

const NO_CATALOG = /<!--\s*no-catalog:\s*([^>]*?)\s*-->/;

function walk(dir, prefix, out, keep) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) walk(path.join(dir, e.name), rel, out, keep);
        else if (keep(e.name)) out.push(rel);
    }
    return out;
}

/** Every catalog basename, subdirectories included. */
export function catalogNames() {
    return new Set(
        walk(CATALOG, '', [], n => n.endsWith('.ts')).map(f => path.basename(f))
    );
}

export function surveyBible() {
    const names = catalogNames();
    // Longest first so `regions.ts` cannot shadow a longer name ending in it.
    const ordered = [...names].sort((a, b) => b.length - a.length);
    const rows = [];

    for (const file of walk(DOCS, '', [], n => n.endsWith('.md'))) {
        if (GENERATED.has(path.basename(file))) continue;
        const text = fs.readFileSync(path.join(DOCS, file), 'utf8');

        const exempt = text.match(NO_CATALOG);
        const points = ordered.filter(n => text.includes(n));
        // A link to the catalog's own README leads a reader there just as well
        // as naming a file in it, and several docs point that way deliberately.
        if (/src\/data\/cultivation\//.test(text)) points.push('src/data/cultivation/');

        rows.push({
            file,
            points,
            exempt: exempt ? (exempt[1] || '(no reason given)') : null,
            ok: points.length > 0 || Boolean(exempt),
        });
    }
    return rows;
}

/** The queue: docs naming no catalog and claiming no exemption. */
export function docsWithNoPointer() {
    return surveyBible().filter(r => !r.ok).map(r => r.file);
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const rows = surveyBible();
    const missing = rows.filter(r => !r.ok);
    console.log(`${rows.length} bible files. ${rows.length - missing.length} point at the catalog, ${missing.length} do not.\n`);
    for (const r of missing) console.log(`  NO POINTER  ${r.file}`);
    const exempt = rows.filter(r => r.exempt);
    if (exempt.length) {
        console.log('');
        for (const r of exempt) console.log(`  exempt      ${r.file}  - ${r.exempt}`);
    }
}
