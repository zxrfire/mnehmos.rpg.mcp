/** Concurrent fixture requests build once; dead builders do not hold later tests. */
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { fixtureSourceHash, serializedFixture, existingSerializedFixture } from './serialized-fixture.js';

describe('serialized fixtures', () => {
    it('reads only completed bytes and leaves a missing sample missing', async () => {
        const key = randomUUID(), entries = ['tests/support/serialized-fixture.ts'];
        expect(existingSerializedFixture('read-only-cache-test', entries, key)).toBeNull();
        await serializedFixture('read-only-cache-test', entries, key, async () => Buffer.from('completed'));
        const first = existingSerializedFixture('read-only-cache-test', entries, key)!;
        first.fill(0);
        expect(existingSerializedFixture('read-only-cache-test', entries, key)!.toString()).toBe('completed');
    });
    it('waits for a live builder even when its lock is older than thirty minutes', async () => {
        const key = randomUUID(), entries = ['tests/support/serialized-fixture.ts'];
        const hash = createHash('sha256').update(fixtureSourceHash(entries)).update(JSON.stringify(key)).digest('hex');
        const lock = path.join(os.tmpdir(), 'mnehmos-fixtures', 'cache-test', `${hash}.snapshot.lock`);
        fs.mkdirSync(path.dirname(lock), { recursive: true });
        fs.writeFileSync(lock, String(process.pid));
        fs.utimesSync(lock, new Date(0), new Date(0));
        let released = false;
        const release = setTimeout(() => { released = true; fs.rmSync(lock, { force: true }); }, 50);
        try {
            const bytes = await serializedFixture('cache-test', entries, key, async () => {
                expect(released, 'the earlier live builder still owns its lock').toBe(true);
                return Buffer.from('after release');
            });
            expect(bytes.toString()).toBe('after release');
        } finally { clearTimeout(release); fs.rmSync(lock, { force: true }); }
    });

    it('takes a lock left by an exited builder', async () => {
        const key = randomUUID();
        const entries = ['tests/support/serialized-fixture.ts'];
        const hash = createHash('sha256').update(fixtureSourceHash(entries))
            .update(JSON.stringify(key)).digest('hex');
        const lock = path.join(os.tmpdir(), 'mnehmos-fixtures', 'cache-test', `${hash}.snapshot.lock`);
        fs.mkdirSync(path.dirname(lock), { recursive: true });
        fs.writeFileSync(lock, '999999');
        try {
            const bytes = await serializedFixture('cache-test', entries, key,
                async () => Buffer.from('recovered'));
            expect(bytes.toString()).toBe('recovered');
            expect(fs.existsSync(lock)).toBe(false);
        } finally {
            fs.rmSync(lock, { force: true });
        }
    });

    it('lets only one fork build a snapshot', async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mnehmos-fixture-lock-'));
        const source = fileURLToPath(new URL('./serialized-fixture.ts', import.meta.url));
        const module = path.join(directory, 'fixture.mjs');
        const runner = path.join(directory, 'runner.mjs');
        const counter = path.join(directory, 'builds');
        // The cache's dependency reader is part of the child module too. Bundle
        // that reader so both forks execute the same real locking implementation.
        const require = createRequire(import.meta.url);
        await build({ entryPoints: [source], outfile: module, bundle: true,
            platform: 'node', format: 'esm',
            define: { 'import.meta.url': JSON.stringify(pathToFileURL(source).href) },
            plugins: [{ name: 'installed-fixture-compiler', setup(b) {
                b.onResolve({ filter: /^typescript$/ }, () => ({
                    path: pathToFileURL(require.resolve('typescript')).href, external: true }));
            } }] });
        fs.writeFileSync(runner, `
            import fs from 'node:fs';
            import { pathToFileURL } from 'node:url';
            const [module, source, counter, key] = process.argv.slice(2);
            const { serializedFixture } = await import(pathToFileURL(module));
            const bytes = await serializedFixture('cache-test', [source], key, async () => {
                fs.appendFileSync(counter, 'built\\n');
                await new Promise(resolve => setTimeout(resolve, 250));
                return Buffer.from('complete');
            });
            process.stdout.write(bytes);
        `);
        try {
            const args = [runner, module, source, counter, randomUUID()];
            const run = promisify(execFile);
            const results = await Promise.all([run(process.execPath, args), run(process.execPath, args)]);
            expect(results.map(result => result.stdout)).toEqual(['complete', 'complete']);
            expect(fs.readFileSync(counter, 'utf8')).toBe('built\n');
        } finally {
            if (path.dirname(directory) !== path.resolve(os.tmpdir())) throw new Error('Unexpected fixture directory');
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });

    it('coalesces concurrent builds and copies each result', async () => {
        let built = 0;
        const key = randomUUID();
        const build = async () => {
            built++;
            await Promise.resolve();
            return Buffer.from('original');
        };
        const entries = ['tests/support/serialized-fixture.ts'];
        const [a, b] = await Promise.all([
            serializedFixture('cache-test', entries, key, build),
            serializedFixture('cache-test', entries, key, build)
        ]);
        a.fill(0);
        expect(b.toString()).toBe('original');
        expect(built).toBe(1);
        expect((await serializedFixture('cache-test', entries, key, build)).toString()).toBe('original');
        expect(built).toBe(1);
    });

    it('retries a failed builder instead of caching the failure', async () => {
        const key = randomUUID();
        const entries = ['tests/support/serialized-fixture.ts'];
        await expect(serializedFixture('cache-test', entries, key, async () => {
            throw new Error('unfinished');
        })).rejects.toThrow('unfinished');
        expect((await serializedFixture('cache-test', entries, key, async () => Buffer.from('complete')))
            .toString()).toBe('complete');
    });
});
