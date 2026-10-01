/** Disk fixtures contain bytes only; every caller receives a separate copy. */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hashes = new Map<string, string>();

/** Follow relative imports and re-exports, as the soaked-world cache does. */
export function fixtureSourceHash(entries: string[]): string {
    const key = JSON.stringify(entries);
    const held = hashes.get(key);
    if (held) return held;
    const seen = new Set<string>();
    const pending = entries.map(entry => path.resolve(ROOT, entry));
    const imports = /(?:from\s+|import\s*(?:\(\s*)?)['"](\.{1,2}\/[^'"]+)['"]/g;
    while (pending.length) {
        const file = pending.pop()!;
        if (seen.has(file) || !fs.existsSync(file)) continue;
        seen.add(file);
        for (const match of fs.readFileSync(file, 'utf8').matchAll(imports)) {
            const target = path.resolve(path.dirname(file), match[1]!.replace(/\.js$/, '.ts'));
            if (path.extname(target)) pending.push(target);
            else pending.push(`${target}.ts`, path.join(target, 'index.ts'));
        }
    }
    const hash = createHash('sha256');
    // Fixtures also depend on the installed runtime and dependency versions.
    hash.update(`${process.platform}:${process.arch}:${process.versions.modules}`);
    for (const file of [...seen, path.join(ROOT, 'package-lock.json')].sort()) {
        if (!fs.existsSync(file)) continue;
        hash.update(path.relative(ROOT, file).replaceAll('\\', '/'));
        hash.update(fs.readFileSync(file));
    }
    const result = hash.digest('hex');
    hashes.set(key, result);
    return result;
}

const held = new Map<string, Promise<Buffer>>();

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
            if (Date.now() - stat.mtimeMs > 30 * 60_000) {
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
