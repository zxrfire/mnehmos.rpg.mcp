#!/usr/bin/env node
/**
 * Regenerate the machine-written half of `docs/world/INDEX.md`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three separate agents in one evening failed to find design material that was
 * already written down, and each of them then wrote a second, invented answer.
 * One of them had personally read the correct passage an hour earlier. The
 * common cause was not carelessness: the world material is filed by NOUN - the
 * consequence of practising a stolen art lives in `items.md`, because a manual
 * is an object - and people search by QUESTION. Correct filing, useless
 * retrieval.
 *
 * The fix already existed and nothing surfaced it. Every section in
 * `docs/world/` carries a `<!-- tier: N trigger="..." -->` marker, and the
 * trigger is a plain-English description of the situation the section answers.
 * `items.md`'s reads "somebody is seen with, or practising, something that is
 * not theirs", which is exactly the sentence the agent could not find a file
 * for. There are around two hundred of them and they were readable only by
 * grepping for the marker syntax.
 *
 * So this script pulls every trigger into one table, keyed on the question, and
 * pulls the self-description out of every content catalog in
 * `src/data/cultivation/`, because a large part of the design record lives in
 * those files' header comments and no doc-search reaches a `.ts` file.
 *
 * It rewrites ONLY the regions between the GENERATED markers in INDEX.md. The
 * prose around them is hand-written and is not touched.
 *
 *     node scripts/build-world-index.mjs           # rewrite
 *     node scripts/build-world-index.mjs --check   # exit 1 if stale
 *
 * `tests/docs/the-world-index-is-not-stale.test.ts` runs the check, so a new
 * section without an index entry fails the suite rather than going quiet.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs', 'world');
const CATALOG = path.join(ROOT, 'src', 'data', 'cultivation');
const INDEX = path.join(DOCS, 'INDEX.md');

// ─── reading the docs ────────────────────────────────────────────────────

const MARKER = /<!--\s*tier:\s*(\d+)\s*(?:trigger="([^"]*)")?\s*-->/;

/** Every tier marker in docs/world, with the heading it sits under. */
export function readTriggers() {
    const rows = [];
    // Walks subfolders. docs/world was flat and is not any more - twenty-eight
    // files in one directory was itself a discoverability problem, so they sit
    // in climbing/, houses/, places/, things/, history/ and writing/ now. A
    // non-recursive read here indexed the four files left at the top and
    // called it the world: 199 situations became 2.
    const docFiles = [];
    const walk = (dir, prefix) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
            else if (entry.name.endsWith('.md') && rel !== 'INDEX.md') docFiles.push(rel);
        }
    };
    walk(DOCS, '');

    for (const file of docFiles) {
        const lines = fs.readFileSync(path.join(DOCS, file), 'utf8').split(/\r?\n/);
        let heading = null;
        let headingLine = 0;
        for (let i = 0; i < lines.length; i++) {
            const h = lines[i].match(/^(#{1,6})\s+(.*?)\s*$/);
            if (h) { heading = h[2]; headingLine = i + 1; continue; }
            const m = lines[i].match(MARKER);
            if (!m) continue;
            const trigger = m[2];
            if (!trigger) continue;            // tier 1 and tier 3 carry no trigger
            rows.push({
                file,
                tier: Number(m[1]),
                trigger,
                heading: heading ?? '(top of file)',
                line: headingLine || i + 1,
            });
        }
    }
    return rows;
}

/** GitHub's heading anchor, near enough for a relative link. */
function anchor(heading) {
    return heading
        .toLowerCase()
        .replace(/[`*_[\]()]/g, '')
        .replace(/[^a-z0-9 -]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

// ─── reading the catalogs ────────────────────────────────────────────────

/**
 * The first sentence of a catalog file's leading block comment.
 *
 * AGENTS.md's rule is that the filename should say the subject and that the
 * file's own header usually already says it. Where that holds, this is a free
 * one-line description of what design question the file answers; where it does
 * not, the blank row is itself a finding.
 */
/**
 * Every `.ts` under the catalog, subdirectories included, as a path relative
 * to the catalog root.
 *
 * Do not make this a bare `readdirSync` again. `regions/` holds sixteen files
 * and a non-recursive read indexed none of them, so the sixteen regional
 * catalogs were absent from the one table that exists to say where design is
 * written down. This is the same defect the doc walker above records fixing.
 */
function catalogFiles() {
    const out = [];
    const walk = (dir, prefix) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const rel = prefix ? `${prefix}/${e.name}` : e.name;
            if (e.isDirectory()) walk(path.join(dir, e.name), rel);
            else if (e.name.endsWith('.ts')) out.push(rel);
        }
    };
    walk(CATALOG, '');
    return out;
}

export function readCatalogHeaders() {
    const rows = [];
    for (const file of catalogFiles()) {
        const src = fs.readFileSync(path.join(CATALOG, file), 'utf8');
        const block = src.match(/^\/\*\*([\s\S]*?)\*\//);
        let summary = '';
        if (block) {
            const body = block[1]
                .split(/\r?\n/)
                .map(l => l.replace(/^\s*\*\s?/, '').trim())
                .filter(Boolean);
            // First paragraph, collapsed, cut at the first sentence end.
            const para = [];
            for (const l of body) {
                if (!l) break;
                para.push(l);
                if (/[.?!]$/.test(l) && para.join(' ').length > 40) break;
            }
            summary = para.join(' ').replace(/\s+/g, ' ');
            const stop = summary.search(/[.?!](\s|$)/);
            if (stop > 40) summary = summary.slice(0, stop + 1);
        }
        const lines = src.split(/\r?\n/).length;
        // The `/` in the character class is load-bearing. docs/world used to be
        // flat and every reference in the catalog now carries a folder -
        // `docs/world/things/items.md` - so the flat pattern matched none of
        // them and this column reported 0 catalogs naming a doc when twelve do.
        // The legend under the table reads an empty column as "this file is the
        // only written record", so the bug did not merely lose information, it
        // asserted the opposite of the truth for every row.
        const docLinks = [...new Set(
            (src.match(/docs\/world\/[a-z0-9/-]+\.md/g) ?? [])
        )].sort();
        rows.push({ file, lines, summary, docLinks });
    }
    return rows;
}

// ─── rendering ───────────────────────────────────────────────────────────

const esc = s => s.replace(/\|/g, '\\|');

function renderTriggers(rows) {
    const sorted = [...rows].sort((a, b) => a.trigger.localeCompare(b.trigger));
    const out = [
        `**${sorted.length} situations, from ${new Set(sorted.map(r => r.file)).size} files.**`,
        'Sorted by the situation, not by the file, because the file is the thing you do not know.',
        '',
        '| When this is true | Read | Section |',
        '|---|---|---|',
    ];
    for (const r of sorted) {
        const link = `[\`${r.file}\`](${r.file}#${anchor(r.heading)})`;
        out.push(`| ${esc(r.trigger)} | ${link} | ${esc(r.heading)} (tier ${r.tier}) |`);
    }
    return out.join('\n');
}

function renderCatalog(rows) {
    const withDocs = rows.filter(r => r.docLinks.length).length;
    const out = [
        `**${rows.length} catalog files, ${withDocs} of which name a doc.**`,
        'These are `.ts` files and no search of `docs/` reaches them. Where the',
        '"Also in" column is empty, this file is the only written record of what',
        'it describes.',
        '',
        '| File | What it answers | Lines | Also in |',
        '|---|---|---|---|',
    ];
    for (const r of rows) {
        const link = `[\`${r.file}\`](../../src/data/cultivation/${r.file})`;
        // INDEX.md sits at docs/world/, so the href is the path with that
        // prefix removed - a bare basename pointed at a file that has not been
        // at the top of docs/world since the folder split.
        const also = r.docLinks.length
            ? r.docLinks.map(d => `[\`${path.basename(d)}\`](${d.replace(/^docs\/world\//, '')})`).join(' ')
            : '-';
        out.push(`| ${link} | ${esc(r.summary || '_(no header comment)_')} | ${r.lines} | ${also} |`);
    }
    return out.join('\n');
}


// ─── design constants, and whether anything reads them ───────────────────
//
// A catalog file can hold a fully argued design as an exported constant that
// nothing in the engine ever looks at. That is this repo's signature defect -
// AGENTS.md calls it "a module nothing calls is not a feature" - and it is
// invisible, because a dead constant compiles, tests clean, and reads like
// settled design to the next person who finds it.
//
// AZURE_INTAKE is the case that prompted this: the complete three-way Azure
// sort, written out with its placements and its recall roll, consumed by
// nothing at all. The owner re-explained that design from memory because
// nobody could see it was already there.

const DESIGN_EXPORT = /^export const ([A-Z][A-Z0-9_]{3,}) *(?::[^=]+)?= *[{[]/gm;

function allSources() {
    const out = [];
    for (const dir of ['src', 'tests']) {
        const walk = d => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) walk(full);
                else if (e.name.endsWith('.ts')) out.push(full);
            }
        };
        walk(path.join(ROOT, dir));
    }
    return out.map(f => ({
        file: path.relative(ROOT, f).split(path.sep).join('/'),
        text: fs.readFileSync(f, 'utf8')
    }));
}

function readDesignExports() {
    const sources = allSources();
    const rows = [];
    for (const file of catalogFiles()) {
        const text = fs.readFileSync(path.join(CATALOG, file), 'utf8');
        const here = `src/data/cultivation/${file}`;
        for (const m of text.matchAll(DESIGN_EXPORT)) {
            const name = m[1];
            let live = 0, tests = 0;
            for (const s of sources) {
                if (s.file === here) continue;
                const n = (s.text.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
                if (!n) continue;
                if (s.file.startsWith('tests/')) tests += n;
                else if (/^src\/data\//.test(s.file)) continue; // a barrel re-export is not a reader
                else live += n;
            }
            rows.push({ name, file, live, tests });
        }
    }
    // Dead first: that is the actionable half.
    return rows.sort((a, b) => (a.live - b.live) || (a.tests - b.tests) || a.name.localeCompare(b.name));
}

function renderDesignExports(rows) {
    const dead = rows.filter(r => !r.live && !r.tests);
    const testOnly = rows.filter(r => !r.live && r.tests);
    const out = [
        `**${rows.length} design constants in the catalog. ${dead.length} are read by nothing at all,`,
        `and ${testOnly.length} more are read only by a test.**`,
        '',
        'A constant nothing reads is still design - it is often the best statement of a rule',
        'anywhere in the repo - but the game does not act on it, and nobody looking at the',
        'running behaviour will find it. **Read this table before designing something: the rule',
        'you are about to write may already be here, fully argued, and simply unplugged.**',
        '',
        '| Constant | In | Read by the game | By tests |',
        '|---|---|---|---|',
    ];
    for (const r of rows) {
        const link = `[\`${r.file}\`](../../src/data/cultivation/${r.file})`;
        out.push(`| \`${r.name}\` | ${link} | ${r.live ? r.live : '**nothing**'} | ${r.tests || '-'} |`);
    }
    return out.join('\n');
}

// ─── splicing ────────────────────────────────────────────────────────────

function splice(text, name, body) {
    const begin = `<!-- BEGIN GENERATED: ${name} -->`;
    const end = `<!-- END GENERATED: ${name} -->`;
    const i = text.indexOf(begin);
    const j = text.indexOf(end);
    if (i < 0 || j < 0) throw new Error(`INDEX.md is missing the ${name} markers`);
    return text.slice(0, i + begin.length) + '\n\n' + body + '\n\n' + text.slice(j);
}

export function build() {
    let text = fs.readFileSync(INDEX, 'utf8');
    text = splice(text, 'triggers', renderTriggers(readTriggers()));
    text = splice(text, 'catalog', renderCatalog(readCatalogHeaders()));
    text = splice(text, 'design-constants', renderDesignExports(readDesignExports()));
    return text;
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const next = build();
    const current = fs.readFileSync(INDEX, 'utf8');
    if (process.argv.includes('--check')) {
        if (next !== current) {
            console.error('docs/world/INDEX.md is stale. Run: node scripts/build-world-index.mjs');
            process.exit(1);
        }
        console.log('docs/world/INDEX.md is current.');
    } else {
        fs.writeFileSync(INDEX, next);
        console.log(next === current ? 'INDEX.md unchanged.' : 'INDEX.md rewritten.');
    }
}
