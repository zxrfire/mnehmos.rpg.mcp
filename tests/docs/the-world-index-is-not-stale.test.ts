/**
 * `docs/world/INDEX.md` is the answer to "has somebody already decided this, and
 * where did they put it". An index that has gone stale is worse than none,
 * because it answers confidently and wrongly - which is the exact failure it
 * was built to stop.
 *
 * So the generated half is checked rather than trusted. A new section with a new
 * `trigger`, a renamed heading, or a new catalog file fails here with the one
 * command that fixes it.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INDEX = path.join(ROOT, 'docs', 'world', 'INDEX.md');

const { build, readTriggers } = await import(
    /* @vite-ignore */ path.join(ROOT, 'scripts', 'build-world-index.mjs')
) as { build: () => string; readTriggers: () => { trigger: string; file: string; tier: number }[] };

describe('the world index', () => {
    it('is current with the docs it indexes', () => {
        const current = fs.readFileSync(INDEX, 'utf8');
        expect(
            build(),
            'docs/world/INDEX.md is stale. Run: node scripts/build-world-index.mjs'
        ).toBe(current);
    });

    it('lists every trigger in docs/world', () => {
        const text = fs.readFileSync(INDEX, 'utf8');
        const missing = readTriggers()
            .map(r => r.trigger)
            .filter(t => !text.includes(t.replace(/\|/g, '\\|')));
        expect(missing, `triggers with no index row: ${missing.join(' / ')}`).toEqual([]);
    });

    it('has no tier-2 section without a trigger, because that section is unroutable', () => {
        const docs = path.join(ROOT, 'docs', 'world');
        const offenders: string[] = [];
        for (const file of fs.readdirSync(docs)) {
            if (!file.endsWith('.md')) continue;
            const lines = fs.readFileSync(path.join(docs, file), 'utf8').split(/\r?\n/);
            lines.forEach((l, i) => {
                if (/<!--\s*tier:\s*2\s*-->/.test(l)) offenders.push(`${file}:${i + 1}`);
            });
        }
        expect(offenders, 'a tier-2 marker without a trigger is a bug - see docs/world/README.md').toEqual([]);
    });
});
