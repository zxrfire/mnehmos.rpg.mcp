/** Disk fixtures contain bytes only; every caller receives a separate copy. */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFixtureSources } from './fixture-source.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hashes = new Map<string, string>();

/** Share the canonical walk's dependency reader rather than maintaining another import grammar. */
export function fixtureSourceHash(entries: string[], refresh = false): string {
    const key = JSON.stringify(entries);
    const held = hashes.get(key);
    if (held && !refresh) return held;
    const result = hashFixtureSources(ROOT, [...entries,
        'tests/support/serialized-fixture.ts', 'tests/support/fixture-source.ts']);
    hashes.set(key, result);
    return result;
}

const held = new Map<string, Promise<Buffer>>();

export function lockOwnerHasExited(lock: string): boolean {
    let owner: number;
    try { owner = Number(fs.readFileSync(lock, 'utf8')); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
        throw error;
    }
    if (!Number.isSafeInteger(owner) || owner <= 0) return false;
    try {
        process.kill(owner, 0);
        return false;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
}

export async function serializedFixture(
    namespace: string,
    entries: string[],
    key: unknown,
    build: () => Promise<Buffer>
): Promise<Buffer> {
    const hash = createHash('sha256').update(fixtureSourceHash(entries))
        .update(JSON.stringify(key)).digest('hex');
    const dir = path.join(os.tmpdir(), 'mnehmos-fixtures', namespace);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${hash}.snapshot`);
    let pending = held.get(file);
    if (!pending) {
        pending = readOrBuild(file, build);
        held.set(file, pending);
        // Coalesce builders without retaining every large snapshot in a fork.
        pending.then(() => held.delete(file), () => held.delete(file));
    }
    return Buffer.from(await pending);
}

async function readOrBuild(file: string, build: () => Promise<Buffer>): Promise<Buffer> {
    if (fs.existsSync(file)) return fs.readFileSync(file);
    const lock = `${file}.lock`;
    for (;;) {
        try {
            fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
            break;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            if (fs.existsSync(file)) return fs.readFileSync(file);
            const stat = fs.statSync(lock, { throwIfNoEntry: false });
            if (!stat) continue;
            // A long fixture may legitimately outlive thirty minutes. Age is
            // not proof its builder exited; starting another would duplicate
            // exactly the heavy walk the cache is intended to share.
            if (lockOwnerHasExited(lock)) {
                fs.rmSync(lock, { force: true });
                continue;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    const aside = `${file}.${randomUUID()}.tmp`;
    try {
        if (fs.existsSync(file)) return fs.readFileSync(file);
        const bytes = await build();
        fs.writeFileSync(aside, bytes);
        fs.renameSync(aside, file);
        return bytes;
    } finally {
        fs.rmSync(aside, { force: true });
        fs.rmSync(lock, { force: true });
    }
}
