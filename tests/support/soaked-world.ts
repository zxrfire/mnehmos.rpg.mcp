/**
 * A seeded world walked some years, computed once and read by everybody.
 *
 * Simulating is most of what the suite costs: eight of every ten CPU-seconds
 * went to world tests walking seeded worlds forward, and many of them walked
 * the same seed over the same years a test file or a run apart. A seeded world
 * is a pure function of its seed, its years and the simulation's source -
 * walking 20 years twice is byte-identical to walking 40 once, through a JSON
 * round-trip too - so the walk is done once and kept on disk.
 *
 * ── WHAT THE KEY COVERS ──────────────────────────────────────────────────
 *
 * The content of every file the simulation imports, followed from its entry
 * points. Change any of them and every kept world is stale and walked again;
 * change a file the world never loads - `src/web`, `src/server`, most of the
 * engine's social reads - and nothing is. A kept world can therefore never
 * answer for code it was not made by.
 *
 * ── AND A LONGER WALK STARTS WHERE A SHORTER ONE STOPPED ─────────────────
 *
 * Asking for 1500 years of a seed already kept at 500 walks the other 1000.
 *
 * Every caller gets its own copy: tests change the worlds they are handed.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCultivationCatalog } from '../../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import type { WorldState } from '../../src/engine/world/world-state.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** What `walkIt` calls; everything the walk can run is imported from these. */
const WHERE_THE_SIMULATION_STARTS = [
    'src/engine/world/catalog.ts', 'src/engine/world/driver.ts', 'src/engine/world/seeding.ts'
];
const DAYS_PER_YEAR = 365;

let sourceHash: string | null = null;

/**
 * A hash over every file the simulation imports, followed from its entry
 * points. Once a process.
 *
 * The import graph and not the directories: two sessions share this tree, and
 * an edit to a file the world never loads was sending every kept world to be
 * walked again.
 */
function theSimulationsSource(): string {
    if (sourceHash !== null) return sourceHash;
    const IMPORTED = /(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
    const seen = new Set<string>();
    const pending = WHERE_THE_SIMULATION_STARTS.map(rel => path.join(ROOT, rel));
    while (pending.length > 0) {
        const file = pending.pop()!;
        if (seen.has(file) || !fs.existsSync(file)) continue;
        seen.add(file);
        const text = fs.readFileSync(file, 'utf8');
        for (const m of text.matchAll(IMPORTED)) {
            const target = path.resolve(path.dirname(file), m[1]!.replace(/\.js$/, '.ts'));
            if (target.endsWith('.ts')) pending.push(target);
            else pending.push(`${target}.ts`, path.join(target, 'index.ts'));
        }
    }
    const hash = createHash('sha256');
    for (const file of [...seen].sort()) {
        hash.update(path.relative(ROOT, file));
        hash.update(fs.readFileSync(file));
    }
    sourceHash = hash.digest('hex').slice(0, 16);
    return sourceHash;
}

let keptDir: string | null = null;

function keptAt(): string {
    if (keptDir !== null) return keptDir;
    const root = path.join(os.tmpdir(), 'mnehmos-worlds');
    keptDir = path.join(root, theSimulationsSource());
    fs.mkdirSync(keptDir, { recursive: true });
    throwAwayOldWorlds(root, keptDir);
    return keptDir;
}

/**
 * Every edit to the simulation leaves a folder of worlds nothing will read
 * again - a gigabyte or so each. Keep this one and the two most recently used
 * others (another checkout may be mid-run on them) and delete the rest.
 */
function throwAwayOldWorlds(root: string, current: string): void {
    const others = fs.readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && path.join(root, entry.name) !== current)
        .map(entry => ({ dir: path.join(root, entry.name), at: fs.statSync(path.join(root, entry.name)).mtimeMs }))
        .sort((a, b) => b.at - a.at);
    for (const stale of others.slice(2)) fs.rmSync(stale.dir, { recursive: true, force: true });
}

const aSafeName = (seed: string): string => seed.replace(/[^A-Za-z0-9_-]/g, c => `%${c.charCodeAt(0).toString(16)}`);
const fileFor = (seed: string, days: number): string => path.join(keptAt(), `${aSafeName(seed)}@${days}.json`);

/** The longest kept walk of this seed no longer than `days`, if any. */
function nearestKept(seed: string, days: number): { days: number; file: string } | null {
    const prefix = `${aSafeName(seed)}@`;
    let best: { days: number; file: string } | null = null;
    for (const name of fs.readdirSync(keptAt())) {
        if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
        const at = Number(name.slice(prefix.length, -'.json'.length));
        if (!Number.isFinite(at) || at > days || (best && best.days >= at)) continue;
        best = { days: at, file: path.join(keptAt(), name) };
    }
    return best;
}

function keep(file: string, text: string): void {
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, text);
    fs.renameSync(temp, file);
}

const inThisProcess = new Map<string, string>();

/**
 * `seed` walked `years`, as a fresh copy.
 *
 * `days` wins over `years` where a test counted in days.
 */
export async function soakedWorld(seed: string, walk: { years?: number; days?: number }): Promise<WorldState> {
    const days = walk.days ?? Math.round((walk.years ?? 0) * DAYS_PER_YEAR);
    const key = `${seed}@${days}`;
    const held = inThisProcess.get(key);
    if (held !== undefined) return JSON.parse(held) as WorldState;

    const file = fileFor(seed, days);
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : await walkIt(seed, days, file);
    inThisProcess.set(key, text);
    return JSON.parse(text) as WorldState;
}

async function walkIt(seed: string, days: number, file: string): Promise<string> {
    // ONE WALKER A WORLD. Another fork asking for the same walk waits for it
    // rather than doing it again; a lock older than the longest walk is taken
    // as abandoned.
    const lock = `${file}.lock`;
    for (;;) {
        try {
            fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
            break;
        } catch {
            if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
            const age = Date.now() - (fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? 0);
            if (age > 30 * 60_000) { fs.rmSync(lock, { force: true }); continue; }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    try {
        if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
        const from = nearestKept(seed, days);
        const state: WorldState = from
            ? JSON.parse(fs.readFileSync(from.file, 'utf8')) as WorldState
            : seedWorld({ seed, catalog: await loadCultivationCatalog() }).state;
        const walked = from?.days ?? 0;
        if (days > walked) advanceWorldForPlay(state, { days: days - walked, stopOnInterrupt: false });
        const text = JSON.stringify(state);
        keep(file, text);
        return text;
    } finally {
        fs.rmSync(lock, { force: true });
    }
}
