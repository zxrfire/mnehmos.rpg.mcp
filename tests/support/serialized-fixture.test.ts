/** Concurrent fixture requests build once and never hand out shared buffers. */
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { describe, expect, it } from 'vitest';
import { serializedFixture } from './serialized-fixture.js';

describe('serialized fixtures', () => {
    it('lets only one fork build a snapshot', async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mnehmos-fixture-lock-'));
        const source = fileURLToPath(new URL('./serialized-fixture.ts', import.meta.url));
        const module = path.join(directory, 'fixture.mjs');
        const runner = path.join(directory, 'runner.mjs');
        const counter = path.join(directory, 'builds');
        fs.writeFileSync(module, transpileModule(fs.readFileSync(source, 'utf8'), {
            compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 }
        }).outputText);
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
