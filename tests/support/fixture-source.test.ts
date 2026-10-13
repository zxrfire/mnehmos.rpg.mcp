/**
 * A pre-baked world is honest only if every dependency changes its key.
 * The previous walk regex omitted side-effect imports and dependency/runtime inputs.
 * These synthetic graphs exercise transitive, re-exported, lazy and side-effect leaves;
 * a computed import must fail closed instead of silently serving stale worlds.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureDependencies, hashFixtureSources } from './fixture-source.js';

describe('fixture source identity', () => {
    it('keys every reachable dependency and loader input, ignoring unrelated files', () => {
        const root = mkdtempSync(join(tmpdir(), 'speed-source-'));
        try {
            const put = (file: string, text: string) => writeFileSync(join(root, file), text);
            put('entry.ts', `import './side.js'; export { leaf } from './branch.js'; const later = () => import('./lazy.js'); import legacy = require('./legacy.js');`);
            put('side.ts', 'export const side = 1;');
            put('branch.ts', `export { leaf } from './leaf.js';`);
            put('leaf.ts', 'export const leaf = 1;');
            put('lazy.ts', 'export const lazy = 1;');
            put('legacy.ts', 'export const legacy = 1;');
            put('unrelated.ts', 'export const unrelated = 1;');
            put('package-lock.json', '{}');
            put('tsconfig.json', '{}');
            const before = hashFixtureSources(root, ['entry.ts']);
            put('unrelated.ts', 'export const unrelated = 2;');
            expect(hashFixtureSources(root, ['entry.ts'])).toBe(before);
            for (const file of ['side.ts', 'leaf.ts', 'lazy.ts', 'legacy.ts', 'package-lock.json', 'tsconfig.json']) {
                const prior = hashFixtureSources(root, ['entry.ts']);
                put(file, file.endsWith('.json') ? '{"changed":true}' : 'export const changed = true;');
                expect(hashFixtureSources(root, ['entry.ts']), file).not.toBe(prior);
            }
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
    it('refuses unresolved and computed dependencies', () => {
        const root = mkdtempSync(join(tmpdir(), 'speed-source-'));
        try {
            writeFileSync(join(root, 'entry.ts'), 'const x = import(path);');
            expect(() => fixtureDependencies(root, ['entry.ts'])).toThrow('must be explicit');
            writeFileSync(join(root, 'entry.ts'), `import './missing.js';`);
            expect(() => fixtureDependencies(root, ['entry.ts'])).toThrow('dependency missing');
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});
