/**
 * A place has one name, in one place, and nothing else retypes it.
 *
 * WHY THIS IS A GUARD AND NOT A UNIT TEST
 * ---------------------------------------
 * `RegionPlaceSchema` has no id, so a place is identified by its display
 * string. Every lookup that resolves one - `regionIdOfPlace`,
 * `declaredAmbientAt`, `prefectureCarrying` - matches on that string and FAILS
 * OPEN: an unmatched name returns `undefined` and the caller falls back to the
 * home province or a default qi band. So a name typed one way in the catalog
 * and another way in a route table does not throw and does not fail a unit
 * test. It answers, with the wrong province.
 *
 * That is a class of defect no test of any single behaviour can see, which is
 * what AGENTS.md means by a rate test: it asserts a property of the whole tree
 * rather than the outcome of one call. It was written after a census found 53
 * place-name literals in `src/` outside the catalog, at a moment when every
 * place in the world was about to be renamed.
 *
 * WHAT IS DELIBERATELY NOT CHECKED
 * --------------------------------
 * Authored PROSE that mentions a place - a `note`, a rumour's `saying`, a
 * design comment, `docs/world/` - is a sentence and not a reference. It cannot
 * import a const and a rename has to sweep it. Comments are masked out below
 * for exactly that reason, and `tests/` is not scanned at all: a test that
 * types a place name is usually pinning one on purpose.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { REGIONS } from '../../src/data/cultivation/regions.js';
import {
    PLACE,
    PLACE_NAMES,
    REGION_NAME,
    REGION_NAMES
} from '../../src/data/cultivation/place-names.js';

const SRC = resolve(__dirname, '../../src');
/** The one file allowed to spell a place name out. */
const THE_SOURCE = 'data/cultivation/place-names.ts';

/**
 * The one field that spells a name out on purpose, and why.
 *
 * `aboutName` on a rumour is documented in its own file as "the name as the
 * speaker actually says it, which is frequently not the name in the catalog" -
 * people clip, mishear and substitute, and the player doing the join is the
 * reward. Six of the rows happen to say a place name correctly, and pointing
 * those at a const would be worse than leaving them: the `saying` beside each
 * one repeats the name INSIDE a sentence, where no const can reach. A rename
 * would then move `aboutName` and leave the sentence behind, splitting one row
 * across two mechanisms. Both halves are prose and both get swept together.
 *
 * This is a list of one, and it should stay that way. Anything added here has
 * to carry an argument of the same kind: not "it is awkward to import", but
 * "this string is a sentence rather than a reference".
 */
const SAYS_THE_NAME_ON_PURPOSE: readonly { file: string; field: string }[] = [
    { file: 'data/cultivation/rumours-and-what-they-get-wrong.ts', field: 'aboutName' }
];

describe('the catalog and the name table cannot disagree', () => {
    const catalogPlaces = REGIONS.flatMap(region => region.places.map(place => place.name));

    it('every place in the catalog is named by a const', () => {
        const missing = catalogPlaces.filter(name => !(PLACE_NAMES as readonly string[]).includes(name));
        expect(missing, 'add these to PLACE in src/data/cultivation/place-names.ts').toEqual([]);
    });

    it('every const names a place that exists', () => {
        const orphans = PLACE_NAMES.filter(name => !catalogPlaces.includes(name));
        expect(orphans, 'these consts name no place in REGIONS').toEqual([]);
    });

    it('no two places share a name, and no two consts share a value', () => {
        expect(new Set(catalogPlaces).size).toBe(catalogPlaces.length);
        expect(new Set(PLACE_NAMES).size).toBe(PLACE_NAMES.length);
        expect(new Set(Object.keys(PLACE)).size).toBe(Object.keys(PLACE).length);
    });

    it('every province is named by a const, and every const by a province', () => {
        const catalogRegions = REGIONS.map(region => region.name);
        expect([...REGION_NAMES].sort()).toEqual([...catalogRegions].sort());
        expect(new Set(Object.values(REGION_NAME)).size).toBe(REGION_NAMES.length);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE RATE TEST
// ─────────────────────────────────────────────────────────────────────────

/** Blank out comments so a name discussed in a docstring is not a reference. */
function maskComments(src: string): string {
    const out = src.split('');
    let i = 0;
    let mode: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = 'code';
    while (i < src.length) {
        const c = src[i];
        const next = src[i + 1];
        if (mode === 'code') {
            if (c === '/' && next === '/') { mode = 'line'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
            if (c === '/' && next === '*') { mode = 'block'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
            if (c === '\'') { mode = 'sq'; i++; continue; }
            if (c === '"') { mode = 'dq'; i++; continue; }
            if (c === '`') { mode = 'tpl'; i++; continue; }
            i++; continue;
        }
        if (mode === 'line') {
            if (c === '\n') { mode = 'code'; i++; continue; }
            out[i] = ' '; i++; continue;
        }
        if (mode === 'block') {
            if (c === '*' && next === '/') { out[i] = ' '; out[i + 1] = ' '; mode = 'code'; i += 2; continue; }
            if (c !== '\n') out[i] = ' ';
            i++; continue;
        }
        if (c === '\\') { i += 2; continue; }
        if ((mode === 'sq' && c === '\'') || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) {
            mode = 'code'; i++; continue;
        }
        i++;
    }
    return out.join('');
}

function everyTsFileUnder(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) everyTsFileUnder(path, found);
        else if (entry.endsWith('.ts')) found.push(path);
    }
    return found;
}

describe('no place name is retyped anywhere in src', () => {
    it('every place-name string literal outside the name table is gone', () => {
        // A whole string literal equal to a place name is a REFERENCE - a home
        // town, a route end, a fallback. A name inside a longer string is
        // prose, and is left alone.
        const patterns = PLACE_NAMES.map(name => ({
            name,
            re: new RegExp(`(['"\`])\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, '\\\\?\'')}\\s*\\1`)
        }));

        const offenders: string[] = [];
        for (const file of everyTsFileUnder(SRC)) {
            const rel = relative(SRC, file).replace(/\\/g, '/');
            if (rel === THE_SOURCE) continue;
            const lines = maskComments(readFileSync(file, 'utf8')).split(/\r?\n/);
            const exempt = SAYS_THE_NAME_ON_PURPOSE.filter(entry => entry.file === rel);
            for (const [index, line] of lines.entries()) {
                if (exempt.some(entry => new RegExp(`\\b${entry.field}: `).test(line))) continue;
                for (const { name, re } of patterns) {
                    if (re.test(line)) offenders.push(`src/${rel}:${index + 1}  ${name}  ${line.trim().slice(0, 100)}`);
                }
            }
        }

        expect(
            offenders,
            'import PLACE from src/data/cultivation/place-names.js instead of retyping the name'
        ).toEqual([]);
    });
});
