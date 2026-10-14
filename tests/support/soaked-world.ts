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
 * Cold walks publish a checkpoint every 25 years, so a worker ending before
 * the requested horizon does not discard everything it computed.
 *
 * Every caller gets its own copy: tests change the worlds they are handed.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadCultivationCatalog } from '../../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import type { SeedWorldOptions } from '../../src/engine/world/seeding.js';
import { fixtureSourceHash, serializedFixture } from './serialized-fixture.js';

/** What `walkIt` calls; everything the walk can run is imported from these. */
const WHERE_THE_SIMULATION_STARTS = [
    'src/engine/world/catalog.ts', 'src/engine/world/driver.ts', 'src/engine/world/seeding.ts'
];
const DAYS_PER_YEAR = 365;
const WALK_CHUNK_DAYS = 10 * DAYS_PER_YEAR;
const CHECKPOINT_DAYS = 25 * DAYS_PER_YEAR;

let sourceHash: string | null = null;

/** One source identity for the fixture loader's immutable module graph. */
function theSimulationsSource(): string {
    if (sourceHash !== null) return sourceHash;
    sourceHash = fixtureSourceHash([...WHERE_THE_SIMULATION_STARTS, 'tests/support/soaked-world.ts']).slice(0, 16);
    return sourceHash;
}

let keptDir: string | null = null;

function keptAt(): string {
    if (keptDir !== null) return keptDir;
    const root = path.resolve(process.env.MNEHMOS_WORLD_CACHE ?? path.join(os.tmpdir(), 'mnehmos-worlds'));
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
    for (const stale of others.slice(2)) {
        const target = path.resolve(stale.dir);
        if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Cache cleanup escaped its root');
        const building = fs.readdirSync(target).filter(name => name.endsWith('.lock'))
            .some(name => builderIsAlive(path.join(target, name)) !== false);
        if (!building) fs.rmSync(target, { recursive: true, force: true });
    }
}

const aSafeName = (seed: string): string => seed.replace(/[^A-Za-z0-9_-]/g, c => `%${c.charCodeAt(0).toString(16)}`);
const fileFor = (seed: string, days: number): string => path.join(keptAt(), `${aSafeName(seed)}@${days}.json`);

/** Read only a completed current-source checkpoint; measurement never starts an unnoticed cold walk. */
export function preBakedWorld(seed: string, years: number): WorldState | null {
    const file = fileFor(seed, Math.round(years * DAYS_PER_YEAR));
    return fs.existsSync(file) ? readKept(file) : null;
}

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

interface ChunkedWorld {
    canonicalChunks: 1;
    state: WorldState;
    arrays: { path: string[]; files: string[] }[];
}

let publication = 0;

/** Ledger growth must not require one string as large as the whole world. */
function keepWorld(file: string, state: WorldState): void {
    const fresh = fixtureSourceHash([...WHERE_THE_SIMULATION_STARTS, 'tests/support/soaked-world.ts'], true).slice(0, 16);
    if (fresh !== theSimulationsSource()) throw new Error('Simulation source changed during fixture generation; retry on the finished tree.');
    const directory = `${path.basename(file)}.${process.pid}.${publication++}.parts`;
    const parts = path.join(path.dirname(file), directory);
    fs.mkdirSync(parts);
    const shell = { ...state, history: { ...state.history }, memories: { ...state.memories } };
    const arrays: ChunkedWorld['arrays'] = [];
    const cut = (keys: string[], rows: unknown[]): void => {
        let target = shell as unknown as Record<string, unknown>;
        for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
        target[keys.at(-1)!] = [];
        const files: string[] = [];
        for (let offset = 0; offset < rows.length; offset += 1024) {
            const name = `${arrays.length}-${offset}.json`;
            fs.writeFileSync(path.join(parts, name), JSON.stringify(rows.slice(offset, offset + 1024)));
            files.push(path.join(directory, name));
        }
        arrays.push({ path: keys, files });
    };
    for (const [key, value] of Object.entries(state)) if (Array.isArray(value)) cut([key], value);
    cut(['history', 'facts'], state.history.facts);
    cut(['memories', 'records'], state.memories.records);
    keep(file, JSON.stringify({ canonicalChunks: 1, state: shell, arrays } satisfies ChunkedWorld));
}

function readKept(file: string): WorldState {
    const kept = JSON.parse(fs.readFileSync(file, 'utf8')) as WorldState | ChunkedWorld;
    if (!('canonicalChunks' in kept)) return kept;
    for (const chunk of kept.arrays) {
        let target = kept.state as unknown as Record<string, unknown>;
        for (const key of chunk.path.slice(0, -1)) target = target[key] as Record<string, unknown>;
        const rows = target[chunk.path.at(-1)!] as unknown[];
        for (const part of chunk.files) {
            const read = JSON.parse(fs.readFileSync(path.join(path.dirname(file), part), 'utf8')) as unknown[];
            for (const row of read) rows.push(row);
        }
    }
    return kept.state;
}

function walkInSpans(state: WorldState, days: number, stopOnInterrupt?: boolean,
    onCheckpoint?: (walked: number) => void): void {
    const fromDay = state.currentDay;
    while (state.currentDay - fromDay < days) {
        const walked = state.currentDay - fromDay;
        const part = Math.min(WALK_CHUNK_DAYS, days - walked,
            CHECKPOINT_DAYS - walked % CHECKPOINT_DAYS);
        const advanced = advanceWorldForPlay(state, { days: part, stopOnInterrupt });
        const total = state.currentDay - fromDay;
        if (advanced.daysAdvanced > 0 && total % CHECKPOINT_DAYS === 0) onCheckpoint?.(total);
        if (advanced.interrupted || advanced.daysAdvanced <= 0) break;
    }
}

/**
 * `seed` walked `years`, as a fresh copy.
 *
 * `days` wins over `years` where a test counted in days.
 */
export async function soakedWorld(
    seed: string,
    walk: { years?: number; days?: number },
    setup?: Pick<SeedWorldOptions, 'catalog' | 'population' | 'presentYear'>
): Promise<WorldState> {
    const days = walk.days ?? Math.round((walk.years ?? 0) * DAYS_PER_YEAR);
    // Canonical fixture catalogs keep their original population and starting age.
    // No observer, callback or altered pressure pass belongs in this cache.
    if (setup) {
        const bytes = await serializedFixture('fixture-walks', [
            ...WHERE_THE_SIMULATION_STARTS, 'tests/support/soaked-world.ts'
        ], { seed, days, setup }, async () => {
            const state = seedWorld({ seed, ...setup }).state;
            walkInSpans(state, days);
            return Buffer.from(JSON.stringify(state));
        });
        return JSON.parse(bytes.toString('utf8')) as WorldState;
    }
    const file = fileFor(seed, days);
    return fs.existsSync(file) ? readKept(file) : await walkIt(seed, days, file);
}

async function walkIt(seed: string, days: number, file: string): Promise<WorldState> {
    // ONE WALKER A WORLD. Another fork asking for the same walk waits for it
    // rather than doing it again; an exited builder's lock is abandoned.
    // Different horizons share one builder; the longer request resumes the
    // shorter request's publication instead of walking their overlap twice.
    const lock = path.join(keptAt(), `${aSafeName(seed)}.walk.lock`);
    for (;;) {
        try {
            fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
            break;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            if (fs.existsSync(file)) return readKept(file);
            const age = Date.now() - (fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? 0);
            const alive = builderIsAlive(lock);
            if (alive === false || alive === null && age > 30 * 60_000) {
                fs.rmSync(lock, { force: true });
                continue;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    try {
        if (fs.existsSync(file)) return readKept(file);
        const from = nearestKept(seed, days);
        const state: WorldState = from
            ? readKept(from.file)
            : seedWorld({ seed, catalog: await loadCultivationCatalog() }).state;
        const walked = from?.days ?? 0;
        if (days > walked) walkInSpans(state, days - walked, false, advanced => {
            const at = walked + advanced;
            if (at < days) keepWorld(fileFor(seed, at), state);
        });
        keepWorld(file, state);
        return readKept(file);
    } finally {
        fs.rmSync(lock, { force: true });
    }
}

function builderIsAlive(lock: string): boolean | null {
    try {
        const pid = Number(fs.readFileSync(lock, 'utf8'));
        if (!Number.isSafeInteger(pid) || pid <= 0) return null;
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return (error as NodeJS.ErrnoException).code === 'ESRCH' ? false : null;
        }
    } catch {
        return null;
    }
}
