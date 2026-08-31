/**
 * Terminology guard.
 *
 * The design once had an invented conceit: ambient qi was the settled remains
 * of ascended cultivators ("ash"), inside a sealed world with a proper name
 * ("the Vault"). It was cut. Qi is now simply qi - it pools in spiritual veins,
 * density varies by region, and the Late Age is thin because veins have been
 * drawn down and monopolised, not because energy degrades each time somebody
 * breathes it. The severance charged at a realm boundary is the Price of
 * Advancement; the mechanics never changed, only the framing.
 *
 * The same applies to `sleeper`, which was the working name for the sealed
 * ancestors before they were written as people rather than as instruments.
 *
 * The retired vocabulary is easy to reintroduce by accident, because it reads
 * like ordinary fantasy prose. This test walks the repository and fails if it
 * comes back, naming the file, the line, and the offending text.
 *
 * It also enforces the repo's hyphens-only convention (see AGENTS.md): no
 * em-dashes or en-dashes anywhere in the corpus. Box-drawing characters used in
 * comment banners are a different codepoint and are deliberately not flagged.
 *
 * `toll.ts` keeps its filename and `toll` / `Toll` survive as internal code
 * symbols on purpose - those are mechanics, not framing, and are not guarded.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

// ─────────────────────────────────────────────────────────────────────────
// CORPUS
// ─────────────────────────────────────────────────────────────────────────

/** Directories walked in full. */
const ROOTS = ['src', 'tests', 'web', 'docs'];

/** Individual files at the repository root that are part of the corpus. */
const ROOT_FILES = ['context.md', 'AGENTS.md', 'README.md'];

/** Never descended into. */
const SKIP_DIRS = new Set([
    'node_modules', 'dist', 'dist-bundle', '.git', 'coverage', '.vitest', 'build'
]);

/** Text formats worth reading. Anything else is skipped as binary or noise. */
const EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md',
    '.html', '.css', '.txt', '.sql', '.yml', '.yaml'
]);

/** Lockfiles are generated and enormous. */
const SKIP_FILES = new Set(['package-lock.json']);

// ─────────────────────────────────────────────────────────────────────────
// ALLOWLIST - keep this short, and justify every entry
// ─────────────────────────────────────────────────────────────────────────

/**
 * Files exempt from the vocabulary rules, as POSIX-style path prefixes.
 *
 * A new entry here is a claim that the retired vocabulary is genuinely correct
 * in that file. There are only two reasons that can be true: the file exists to
 * assert the vocabulary's absence (and so must name it), or the file is not
 * about this world at all.
 */
const VOCABULARY_ALLOWLIST: readonly string[] = [
    // This file. A guard has to spell out what it forbids.
    'tests/terminology.test.ts',

    // The content-catalog guard, which asserts the retired conceit is absent
    // from techniques, pills, herbs, encounters and sects. It has to name the
    // phrasings it is looking for.
    'tests/data/cultivation-content.test.ts',

    // The world-schema regression test, which asserts the retired `ash_density`
    // column is gone. It has to name the column to prove its absence.
    'tests/engine/world/world.test.ts',

    // Legacy Bastion campaign material inherited from the pre-fork D&D repo. A
    // different setting with its own crematorium ash and its own vaults; it has
    // nothing to do with the xianxia world and is not being migrated.
    'docs/bastion/'
];

/**
 * TEMPORARY exceptions, for subsystems mid-migration under another owner.
 *
 * Currently empty: the world subsystem finished its own sweep, including the
 * `ash_density` rename, so nothing needs shielding. Anything added here must
 * come with the reason and the condition for removing it; the last test in this
 * file fails once an entry stops suppressing anything, so it cannot rot
 * silently.
 */
const TEMPORARY_ALLOWLIST: readonly string[] = [];

/**
 * Files exempt from the `sleeper` rule only.
 *
 * The class was renamed to `sealed ancestors`; the vocabulary survives in three
 * places that are not the sealed-ancestor catalog and are owned elsewhere. Each
 * entry comes out when that owner renames, and none of them affects any other
 * rule - this list is deliberately separate from the temporary allowlist so it
 * cannot quietly weaken the dash guard.
 */
const SLEEPER_ALLOWLIST: readonly string[] = [
    // Owned by the sect-politics handler. `sleeperRank` is a response field on
    // a tool contract that `rpg-mcp-live` consumes over HTTP, so renaming it is
    // a breaking change and belongs to that owner, not to this catalog.
    'src/server/consolidated/sect-politics.ts',

    // The register renderer, owned by the web agent. Prose and a table header.
    'src/web/',

    // The beast catalog's own test, which quotes the beast by its proper name.
    'tests/data/cultivation-beasts.test.ts'
];

/** Files exempt from the hyphens rule. Same reasoning, same short list. */
const DASH_ALLOWLIST: readonly string[] = [
    'docs/bastion/',
    ...TEMPORARY_ALLOWLIST
];

// ─────────────────────────────────────────────────────────────────────────
// RULES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which fix a violation needs.
 *
 *   retired-vocabulary  the text leans on a conceit that was cut. Rewrite the
 *                       meaning, not just the word.
 *   style               the repo's hyphens-only convention.
 */
type RuleGroup = 'retired-vocabulary' | 'style';

interface Rule {
    readonly name: string;
    readonly group: RuleGroup;
    readonly pattern: RegExp;
    readonly allowlist: readonly string[];
    /** A line matching this is not a violation, wherever it appears. */
    readonly except?: RegExp;
}

/**
 * `ash` as a whole word, or as the leading component of an identifier
 * (`ashDensity`, `ash_density`, `AshDensity`, `ASH_DENSITY`).
 *
 * The boundaries are written by hand rather than with `\b` for two reasons:
 * `\b` treats `_` as a word character, which would miss `world_ash_density`,
 * and a trailing `\b` would flag every `trash`, `cash`, `hash`, `flash`,
 * `clash`, `ashore`, `ashen` and `ashfall` in the repository. Matching
 * precisely is what keeps this rule free of an exception list.
 */
const ASH = /(?<![A-Za-z0-9])(?:ash|Ash)(?![a-z0-9])|(?<![A-Za-z0-9])ASH(?![A-Z0-9])/;

/** The retired faction prefix. It is now the Stonewright Consortium. */
const ASHWRIGHT = /ashwright/i;

/** `Vault` as a standalone capitalised noun. A lowercase vault door is fine. */
const VAULT = /(?<![A-Za-z0-9])Vaults?(?![a-z0-9])/;

/** Prose that only makes sense under the discarded metaphysics. */
const RETIRED_PHRASING =
    /falling lives?|breathed before|unbreathed|settled remains of|what the crossing left/i;

/**
 * `sleeper` for the sealed-ancestor class. Retired: they are people under a
 * building with a name, a lineage and a claim on somebody, and the word made
 * them read as dormant hazards.
 *
 * `The Sleeper in the Cut Face` is a proper name - a beast, not an ancestor -
 * and stays, so the rule carries an exception for it and its material rather
 * than exempting the whole beast catalog.
 */
const SLEEPER = /(?<![A-Za-z0-9])[Ss]leepers?(?![a-z0-9])|(?<![A-Za-z0-9])sleeper(?=[-_A-Z])/;

/** The one proper name that keeps the word, plus its derived identifiers. */
const SLEEPER_PROPER_NAME = /[Ss]leeper[- ][Ii]n[- ][Tt]he[- ][Cc]ut|mat-sleeper-seam-core/;

/**
 * Em-dash (U+2014) and en-dash (U+2013), built from their codepoints so this
 * file does not contain the characters it forbids. U+2500 box drawing, used in
 * the comment banners above, is a different codepoint and is not matched.
 */
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

const VOCAB_EXEMPT = [...VOCABULARY_ALLOWLIST, ...TEMPORARY_ALLOWLIST];

const RULES: readonly Rule[] = [
    { name: "'ash' as a word or identifier component", group: 'retired-vocabulary', pattern: ASH, allowlist: VOCAB_EXEMPT },
    { name: "'Ashwright' (renamed to Stonewright)", group: 'retired-vocabulary', pattern: ASHWRIGHT, allowlist: VOCAB_EXEMPT },
    { name: "'Vault' as a proper noun", group: 'retired-vocabulary', pattern: VAULT, allowlist: VOCAB_EXEMPT },
    { name: 'prose from the discarded conceit', group: 'retired-vocabulary', pattern: RETIRED_PHRASING, allowlist: VOCAB_EXEMPT },
    {
        name: "'sleeper' (renamed to sealed ancestor)",
        group: 'retired-vocabulary',
        pattern: SLEEPER,
        allowlist: [...VOCAB_EXEMPT, ...SLEEPER_ALLOWLIST],
        except: SLEEPER_PROPER_NAME
    },

    { name: 'em-dash or en-dash (AGENTS.md: hyphens only)', group: 'style', pattern: DASH, allowlist: DASH_ALLOWLIST }
];

// ─────────────────────────────────────────────────────────────────────────
// WALK
// ─────────────────────────────────────────────────────────────────────────

function posix(path: string): string {
    return path.split(sep).join('/');
}

function collect(dir: string, out: string[]): void {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            collect(full, out);
            continue;
        }
        if (!entry.isFile()) continue;
        if (SKIP_FILES.has(entry.name)) continue;
        const dot = entry.name.lastIndexOf('.');
        if (dot < 0 || !EXTENSIONS.has(entry.name.slice(dot))) continue;
        out.push(full);
    }
}

function corpusFiles(): string[] {
    const out: string[] = [];
    for (const root of ROOTS) collect(join(REPO_ROOT, root), out);
    for (const name of ROOT_FILES) {
        const full = join(REPO_ROOT, name);
        try {
            if (statSync(full).isFile()) out.push(full);
        } catch {
            // A root document that does not exist is not this test's problem.
        }
    }
    return out;
}

interface Violation {
    readonly file: string;
    readonly line: number;
    readonly group: RuleGroup;
    readonly rule: string;
    readonly text: string;
}

/** One pass over the corpus; every rule is checked per line. */
function scan(): { violations: Violation[]; fileCount: number; usedAllowlist: Set<string> } {
    const violations: Violation[] = [];
    const usedAllowlist = new Set<string>();
    const files = corpusFiles();

    for (const full of files) {
        const rel = posix(relative(REPO_ROOT, full));
        const lines = readFileSync(full, 'utf-8').split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const rule of RULES) {
                const match = rule.pattern.exec(line);
                if (!match) continue;
                if (rule.except?.test(line)) continue;
                // An allowlisted file is scanned anyway, so an entry that is no
                // longer suppressing anything can be reported as dead weight.
                const exempting = rule.allowlist.find(
                    prefix => rel === prefix || rel.startsWith(prefix)
                );
                if (exempting) {
                    usedAllowlist.add(exempting);
                    continue;
                }
                const from = Math.max(0, match.index - 40);
                violations.push({
                    file: rel,
                    line: i + 1,
                    group: rule.group,
                    rule: rule.name,
                    text: line.slice(from, match.index + match[0].length + 40).trim()
                });
            }
        }
    }
    return { violations, fileCount: files.length, usedAllowlist };
}

/** What to do about each group, printed with the failures so nobody guesses. */
const REMEDY: Record<RuleGroup, string> = {
    'retired-vocabulary':
        'rewrite the meaning, not just the word: qi is qi, thin ground is drawn ' +
        'down or monopolised, and a realm boundary charges the Price of Advancement',
    style:
        'the repo uses plain hyphens (AGENTS.md)'
};

function report(violations: Violation[]): string {
    const shown = violations.slice(0, 40);
    const lines = shown.map(
        v => `  ${v.file}:${v.line}  [${v.group}: ${v.rule}]\n      ${v.text}`
    );
    if (violations.length > shown.length) {
        lines.push(`  ...and ${violations.length - shown.length} more`);
    }
    const groups = [...new Set(shown.map(v => v.group))]
        .map(g => `  ${g}: ${REMEDY[g]}`)
        .join('\n');
    return `\n${violations.length} terminology violation(s):\n${lines.join('\n')}\n\nFix:\n${groups}\n`;
}

// ─────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('banned vocabulary stays out of the repository', () => {
    const { violations, fileCount, usedAllowlist } = scan();
    const inGroup = (group: RuleGroup) => violations.filter(v => v.group === group);

    it('reads a corpus worth guarding', () => {
        // A walk that finds nothing would pass every rule below for free.
        expect(fileCount, 'the corpus walk found almost no files').toBeGreaterThan(200);
    });

    it('has no trace of the retired vocabulary', () => {
        const offences = inGroup('retired-vocabulary');
        expect(offences.length, report(offences)).toBe(0);
    });

    it('uses hyphens, never em-dashes or en-dashes', () => {
        const offences = inGroup('style');
        expect(offences.length, report(offences)).toBe(0);
    });

    it('keeps the temporary allowlist honest', () => {
        // Every temporary entry must still be earning its place. Once the
        // subsystem it shields is clean, this fails and the entry gets deleted
        // along with the block above it.
        const unused = TEMPORARY_ALLOWLIST.filter(prefix => !usedAllowlist.has(prefix));
        expect(
            unused,
            'these temporary allowlist entries are no longer suppressing anything ' +
            `and should be removed from tests/terminology.test.ts: ${unused.join(', ')}`
        ).toEqual([]);
    });
});
