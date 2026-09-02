import Database from 'better-sqlite3';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { migrate } from '../../src/storage/migrations';
import type { LLMProvider, ProviderCallOpts, ProviderCallResult } from '../../src/agent/provider/types';
import type { ProviderName } from '../../src/agent/provider/config';
import { GameService } from '../../src/web/game';
import { DeterministicNarrator, ProviderNarrator } from '../../src/web/narrator';
import type { Narrator } from '../../src/web/narrator';
import { createApp, type ProviderStatus } from '../../src/web/server';
import { ensureCultivationDb, type CultivationRepos } from '../../src/server/consolidated/cultivation-support';
import { createWorld, resetCultivationWorlds } from '../../src/server/state/cultivation-world';

/** In-memory database with the real migrations, foreign keys on. */
export function makeDb(): Database.Database {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    return db;
}

export interface Script {
    /** Responses to phase-1 (intent routing) calls, in order. Last one repeats. */
    plans?: string[];
    /** Responses to phase-3 (narration) calls, in order. Last one repeats. */
    narrations?: string[];
}

/**
 * A provider that returns canned strings and never touches the network.
 *
 * The two phases are scripted separately because they are separately
 * interesting, and because a single queue would couple a test's phase-1
 * fixture to how many times the service happened to ask for prose (opening a
 * run narrates once before the player has typed anything).
 *
 * `calls` records every request, so a test can assert what the model was
 * actually shown - which is how "the model only ever sees engine facts" is
 * checked rather than assumed.
 */
export class ScriptedProvider implements LLMProvider {
    readonly name: ProviderName;
    readonly calls: ProviderCallOpts[] = [];

    private readonly plans: string[];
    private readonly narrations: string[];
    private planCursor = 0;
    private narrationCursor = 0;

    constructor(script: Script | string[], name: ProviderName = 'anthropic') {
        const normalised: Script = Array.isArray(script)
            ? { plans: script.slice(0, 1), narrations: script.slice(1) }
            : script;
        this.plans = normalised.plans ?? [];
        this.narrations = normalised.narrations ?? [];
        this.name = name;
    }

    async call(opts: ProviderCallOpts): Promise<ProviderCallResult> {
        this.calls.push(opts);
        const system = opts.messages.find(m => m.role === 'system')?.content ?? '';
        const isIntent = system.startsWith('You are the intent router');

        const queue = isIntent ? this.plans : this.narrations;
        const cursor = isIntent ? this.planCursor++ : this.narrationCursor++;
        const text = queue.length === 0 ? '' : queue[Math.min(cursor, queue.length - 1)];

        return { text, raw: text, durationMs: 0 };
    }
}

/** A provider that always fails, standing in for an unreachable Ollama. */
export class UnreachableProvider implements LLMProvider {
    readonly name: ProviderName = 'ollama';
    async call(): Promise<ProviderCallResult> {
        throw new Error('fetch failed ECONNREFUSED');
    }
}

export interface HarnessOptions {
    adminMode?: boolean;
    seed?: string;
    /**
     * Whether time passing for the cultivator passes for everyone else.
     *
     * Off by default in tests: seeding several hundred people costs real time
     * and almost no test is asserting anything about them.
     */
    worldEnabled?: boolean;
    /**
     * The world's own seed - the OTHER half of a reproducible run.
     *
     * `seed` above fixes the run. It does not fix the world the run is lived
     * in: an installation with no world mints one from `randomUUID()` on first
     * touch, so the same run seed against two fresh databases meets a
     * different several hundred people. Measured: `npc-0` was "Duan Fuyan" at
     * ordinal 10 in one and "Han Fulu" at ordinal 9 in the other, and "I
     * attack someone of my own rank" fought a different person each time.
     *
     * Set this and the world is created from a known seed before the run
     * opens, which is what lets a played test pin one seed to one outcome
     * instead of sweeping thirty and asserting a rate. Only
     * `makeGameInWorld` honours it, because creating a world is async.
     */
    worldSeed?: string;
    narrator?: Narrator;
    provider?: LLMProvider;
}

export interface Harness {
    db: Database.Database;
    game: GameService;
    narrator: Narrator;
    /** The same repository bundle the service and the MCP tools share. */
    repos: CultivationRepos;
}

export function makeGame(options: HarnessOptions = {}): Harness {
    // The world registry in `cultivation-world.ts` is module state, and a
    // vitest fork runs several test FILES in one process. Without this, a
    // `worldEnabled` game joins whatever world the previous file left behind -
    // built against a database this one has never seen - so its people, its
    // sellers and its prices are somebody else's. That is the whole of the
    // intermittent price failure that was read as flakiness for a long time:
    // the test passed alone and failed in company, which is the signature.
    //
    // Every harness game gets a fresh database, so there is no case where
    // inheriting the last file's world is what a caller wanted.
    resetCultivationWorlds();

    if (options.worldSeed !== undefined) {
        // Not silently ignored: a test that thinks it pinned the world and did
        // not is a test that pins a coincidence.
        throw new Error('worldSeed needs the async form - use `await makeGameInWorld({ ... })`.');
    }
    const db = makeDb();
    const narrator = options.narrator
        ?? (options.provider
            ? new ProviderNarrator(options.provider, { model: 'test-model', timeoutMs: 5000 })
            : new DeterministicNarrator());

    const game = new GameService({
        db,
        narrator,
        worldEnabled: options.worldEnabled ?? false,
        adminMode: options.adminMode ?? false,
        seedFactory: () => options.seed ?? 'test-seed'
    });

    return { db, game, narrator, repos: ensureCultivationDb() };
}

/**
 * A game whose WORLD is pinned as well as its run.
 *
 * `makeGame` is synchronous and 200-odd call sites depend on that, and
 * creating a world is not - it loads the catalog and seeds several hundred
 * people - so the pinned form is its own async function rather than a flag
 * that sometimes returns a promise.
 *
 * What it does is the whole of the fix: create the world from `worldSeed`
 * BEFORE the run opens. `activeWorld()` only mints a world when the
 * installation has none, so a world that already exists is the one the run
 * enters, and both halves of the outcome are then fixed - who is alive, at
 * what rung, standing where, and what the run's own streams draw.
 *
 * `worldEnabled` defaults to TRUE here, unlike `makeGame`: pinning a world a
 * test never advances is meaningless, and asking for one is saying you care.
 */
export async function makeGameInWorld(options: HarnessOptions = {}): Promise<Harness> {
    const { worldSeed, ...rest } = options;
    if (worldSeed === undefined) throw new Error('makeGameInWorld needs a worldSeed.');

    const harness = makeGame({ ...rest, worldEnabled: rest.worldEnabled ?? true });

    // The world layer's process caches are keyed by world id, and a world id
    // is `world-${seed}` - so two harnesses pinning the same seed produce the
    // same id, and a stale handle from the PREVIOUS harness's database would
    // otherwise be the one found. The worlds are in SQLite; dropping the
    // caches costs a reload and nothing else.
    resetCultivationWorlds();
    // `makeGame` has already pointed the ambient handle at this harness's
    // database - the `GameService` constructor does it - so this world is
    // created in the right place.
    await createWorld({ seed: worldSeed });

    return harness;
}

export const TEST_PROVIDER_STATUS: ProviderStatus = {
    name: 'ollama',
    model: 'test-model',
    configured: false
};

export interface HttpHarness {
    base: string;
    close(): Promise<void>;
    get(path: string): Promise<{ status: number; body: any }>;
    post(path: string, body?: unknown): Promise<{ status: number; body: any }>;
}

/** Start the real node:http app on an ephemeral port and talk to it over TCP. */
export async function startHttp(
    game: GameService,
    options: { provider?: ProviderStatus; webRoot?: string } = {}
): Promise<HttpHarness> {
    const app = createApp({
        game,
        provider: options.provider ?? TEST_PROVIDER_STATUS,
        version: '9.9.9',
        webRoot: options.webRoot ?? fileURLToPath(new URL('.', import.meta.url))
    });

    const server: Server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    const read = async (res: Response) => {
        const text = await res.text();
        try {
            return { status: res.status, body: text ? JSON.parse(text) : null };
        } catch {
            return { status: res.status, body: text };
        }
    };

    return {
        base,
        close: () => new Promise<void>(resolve => server.close(() => resolve())),
        get: async path => read(await fetch(`${base}${path}`)),
        post: async (path, body) => read(await fetch(`${base}${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body ?? {})
        }))
    };
}

interface HasToolCalls {
    toolCalls: Array<{ name: string; action: string; summary: string; ok: boolean; source?: string; note?: string }>;
}

/** The routing row: which verb was chosen, and by what. */
export function planned(result: HasToolCalls) {
    return result.toolCalls.find(call => call.name === 'narrator.plan')!;
}

/** Everything the engine itself did, with the two narrator rows removed. */
export function engineCalls(result: HasToolCalls) {
    return result.toolCalls.filter(call => !call.name.startsWith('narrator.'));
}

/** The engine call that declined to act, if there was one. */
export function refusedCall(result: HasToolCalls) {
    return engineCalls(result).find(call => !call.ok) ?? null;
}

/** Snapshot of the raw cultivator row - the ground truth for "nothing changed". */
export function cultivatorRow(db: Database.Database, id: string): Record<string, unknown> {
    return db.prepare('SELECT * FROM cultivators WHERE id = ?').get(id) as Record<string, unknown>;
}

export function injuryCount(db: Database.Database, id: string): number {
    const row = db.prepare('SELECT COUNT(*) AS n FROM cultivator_injuries WHERE cultivator_id = ?').get(id) as { n: number };
    return row.n;
}
