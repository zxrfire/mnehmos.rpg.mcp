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
    const db = makeDb();
    const narrator = options.narrator
        ?? (options.provider
            ? new ProviderNarrator(options.provider, { model: 'test-model', timeoutMs: 5000 })
            : new DeterministicNarrator());

    const game = new GameService({
        db,
        narrator,
        adminMode: options.adminMode ?? false,
        seedFactory: () => options.seed ?? 'test-seed'
    });

    return { db, game, narrator, repos: ensureCultivationDb() };
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
