/**
 * Curated prose for the standing register, generated once and cached.
 *
 * WHY THIS IS SEPARATE FROM `register.ts`
 * --------------------------------------
 * `register.ts` authors nothing: it reads the catalogs and arranges them, which
 * is what lets an operator trust a figure on the sheet. Prose does not have that
 * property and cannot be given it, so it lives in its own file, is stored in its
 * own cache, and is rendered in its own visually distinct block. The reader can
 * always tell which half of the page is the catalog and which half is a model
 * talking about the catalog.
 *
 * THE RULE THE PROMPT ENFORCES
 * ----------------------------
 * The model is handed facts and nothing else, and is told it may not introduce a
 * name, number, date or relationship that is not in them. This is the same
 * discipline as `facts.ts` feeding phase 3 of the narrator: a model may describe
 * what the engine decided and may not decide anything. It will still occasionally
 * reach - which is exactly why the prose is cached, diffable, and separable from
 * the tables rather than woven through them.
 *
 * CACHING, AND WHAT STALE MEANS
 * -----------------------------
 * Generated lazily, on first request, and written next to the database so it
 * survives restarts and rebuilds. Every block stores a `fingerprint` of the
 * facts it was written from. On each request the fingerprint is recomputed:
 *
 *   match     serve the cached prose, no provider call
 *   mismatch  the catalog moved under it - regenerate that block only
 *   missing   generate it
 *
 * Blocks are fingerprinted individually, so editing one catalog does not invalidate
 * the whole sheet. If regeneration fails - no provider, no key, a timeout - the
 * stale text is served with a `stale` marker rather than being dropped. A sheet
 * with one dated paragraph is worth more to an operator than a sheet with a hole
 * in it, provided it says which paragraph.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { LLMProvider } from '../agent/provider/types.js';
import type { WorldRegister } from './register.js';

/** Bump when the prompt or the block set changes in a way that invalidates text. */
export const PROSE_SCHEMA_VERSION = 2;

export interface ProseBlock {
    /** Hash of the facts this text was written from. */
    fingerprint: string;
    text: string;
    generatedAt: string;
    model: string | null;
    /** True when the facts have moved since and regeneration has not succeeded. */
    stale?: boolean;
}

export interface ProseCache {
    version: number;
    blocks: Record<string, ProseBlock>;
}

export interface ProseSection {
    id: string;
    /** Shown above the paragraph so a reader knows what it is commenting on. */
    heading: string;
    /**
     * The facts this block may use, and the only thing sent to the model.
     * Anything absent here is not available to be written about.
     */
    facts: (reg: WorldRegister) => unknown;
    /** What the paragraph is for, in one line, given to the model as the task. */
    brief: string;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SECTIONS
//
// One block per section of the sheet that reads better with a sentence of
// orientation than without. Deliberately not one per table: the tables are the
// document, and prose that restates a table is worse than no prose.
// ─────────────────────────────────────────────────────────────────────────

export const PROSE_SECTIONS: readonly ProseSection[] = [
    {
        id: 'apexes',
        heading: 'On the apexes',
        facts: reg => reg.apexes,
        brief:
            'Orient a reader to the three apexes in one short paragraph. Say what separates them from each other, using only the heritage, ordinal, depth-below, stock and instability given. Do not list all three in order; say the thing a reader would otherwise have to work out by comparing rows.'
    },
    {
        id: 'register',
        heading: 'On the register',
        facts: reg => ({
            bands: reg.ladder,
            sealed: reg.sealed,
            spread: {
                highest: reg.rows[0],
                lowest: reg.rows[reg.rows.length - 1],
                withSealedCeiling: reg.rows.filter(r => r.sealedCeiling !== null).map(r => r.name),
                closedDoors: reg.rows.filter(r => !r.recruits).map(r => r.name),
                openDoors: reg.rows.filter(r => r.recruits && r.admissionOrdinal === 0).map(r => r.name)
            },
            governanceCounts: reg.rows.reduce<Record<string, number>>((acc, r) => {
                acc[r.governance] = (acc[r.governance] ?? 0) + 1;
                return acc;
            }, {})
        }),
        brief:
            'One short paragraph orienting a reader to the faction list. Two things worth saying together: what the admission column reveals that the ordinal column does not, and the pattern across the sealed ancestors, whose grade, publicity and strength correlate in a way a reader would otherwise assemble by opening every card.'
    },
    {
        id: 'items',
        heading: 'On what came down',
        facts: reg => ({ items: reg.items, holdings: reg.holdings }),
        brief:
            'One short paragraph on the immortal objects and who holds them. The distribution is the point: who has most, who has none, and what that implies about what each holder actually wants.'
    },
];

// ─────────────────────────────────────────────────────────────────────────
// FINGERPRINTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Stable hash of one section's facts.
 *
 * `JSON.stringify` is stable enough here because every input is built by
 * `buildRegister()` in a fixed order from ordered catalogs - there is no object
 * whose key order varies between calls. The schema version is folded in so a
 * change to the prompt invalidates every block without touching the catalogs.
 */
export function fingerprintFacts(facts: unknown): string {
    return createHash('sha256')
        .update(String(PROSE_SCHEMA_VERSION))
        .update(JSON.stringify(facts) ?? 'null')
        .digest('hex')
        .slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────
// CACHE FILE
// ─────────────────────────────────────────────────────────────────────────

const EMPTY: ProseCache = { version: PROSE_SCHEMA_VERSION, blocks: {} };

/** Beside the database, because it is cached state rather than authored content. */
export function defaultProsePath(dbPath: string): string {
    return join(dirname(dbPath), 'register-prose.json');
}

export function loadProse(path: string): ProseCache {
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf-8')) as ProseCache;
        if (parsed.version !== PROSE_SCHEMA_VERSION) return { ...EMPTY };
        return { version: parsed.version, blocks: parsed.blocks ?? {} };
    } catch {
        // Absent, unreadable or corrupt all mean the same thing to a cache.
        return { ...EMPTY };
    }
}

export function saveProse(path: string, cache: ProseCache): void {
    try {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, JSON.stringify(cache, null, 2), 'utf-8');
    } catch {
        // A cache that cannot be written is still a cache that worked once.
        // Failing the page over it would be the wrong trade.
    }
}

// ─────────────────────────────────────────────────────────────────────────
// GENERATION
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM = [
    'You are writing short orienting paragraphs for an internal reference sheet about a xianxia setting.',
    '',
    'HARD RULES, in order of importance:',
    '1. Use ONLY the facts given in the user message. Do not introduce any name, number, date, place or relationship that is not present in them.',
    '2. If the facts do not support an observation, do not make it. A shorter paragraph is correct.',
    '3. Do not restate the table. The reader can already see every figure. Say what the figures mean together.',
    '4. No headings, no lists, no markdown. One paragraph of plain prose, 40 to 80 words.',
    '',
    'REGISTER: plain declarative sentences that turn cruel without raising their voice. Let the point arrive in the content rather than in adjectives. No grandiosity. Never address the reader.'
].join('\n');

export interface GenerateOptions {
    provider: LLMProvider;
    model: string;
    /** Abort long generations rather than holding a request open forever. */
    signal?: AbortSignal;
}

async function writeBlock(
    section: ProseSection,
    facts: unknown,
    opts: GenerateOptions
): Promise<string> {
    const result = await opts.provider.call({
        model: opts.model,
        temperature: 0.7,
        maxTokens: 300,
        signal: opts.signal,
        messages: [
            { role: 'system', content: SYSTEM },
            {
                role: 'user',
                content: `TASK: ${section.brief}\n\nFACTS (the only material you may use):\n${JSON.stringify(facts, null, 2)}`
            }
        ]
    });
    return result.text.trim();
}

export interface EnsureResult {
    cache: ProseCache;
    generated: string[];
    failed: string[];
}

/**
 * Return prose for every section, generating only what is missing or stale.
 *
 * Never throws. A provider that is absent, refusing or slow produces a sheet
 * with stale or empty blocks and a note saying so, which is the behaviour an
 * operator wants from a reference page they opened mid-run.
 */
export async function ensureProse(
    reg: WorldRegister,
    path: string,
    opts: GenerateOptions | null
): Promise<EnsureResult> {
    const cache = loadProse(path);
    const generated: string[] = [];
    const failed: string[] = [];
    let dirty = false;

    for (const section of PROSE_SECTIONS) {
        const facts = section.facts(reg);
        const fingerprint = fingerprintFacts(facts);
        const existing = cache.blocks[section.id];

        if (existing && existing.fingerprint === fingerprint && !existing.stale) continue;

        if (!opts) {
            // No provider. Keep whatever is there and say it is behind.
            if (existing) {
                cache.blocks[section.id] = { ...existing, stale: true };
                dirty = true;
            }
            failed.push(section.id);
            continue;
        }

        try {
            const text = await writeBlock(section, facts, opts);
            if (!text) throw new Error('empty completion');
            cache.blocks[section.id] = {
                fingerprint,
                text,
                generatedAt: new Date().toISOString(),
                model: opts.model
            };
            generated.push(section.id);
            dirty = true;
        } catch {
            if (existing) {
                cache.blocks[section.id] = { ...existing, stale: true };
                dirty = true;
            }
            failed.push(section.id);
        }
    }

    if (dirty) saveProse(path, cache);
    return { cache, generated, failed };
}

/** Drop every block so the next request rewrites the sheet from scratch. */
export function clearProse(path: string): void {
    saveProse(path, { ...EMPTY, blocks: {} });
}
