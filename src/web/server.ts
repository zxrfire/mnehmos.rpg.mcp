/**
 * The web server: static GUI plus the JSON API, on node:http and nothing else.
 *
 * No express, no router library, no middleware stack. The surface is ten
 * endpoints and one static directory, and a dependency-free implementation of
 * that is shorter than the configuration a framework would need.
 *
 * Deployment shape (see docker-compose.yml): this process is single-operator.
 * It opens ONE database through `useSingleUserDatabase`, deliberately not the
 * multi-tenant `getDb()` path, which resolves a campaign from a signed tenant
 * header that this deployment has nowhere to get.
 *
 * Errors never leak. Every handler failure becomes `{ error }` with a status,
 * and anything that is not a GameError becomes a flat 500 with a generic
 * sentence - the stack goes to stderr, where the operator can read it, and
 * never to the browser.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { useSingleUserDatabase } from '../storage/index.js';
import { ProviderFactory } from '../agent/provider/factory.js';
import {
    describeProviderConfiguration,
    resolveRuntimeProviderConfig,
    type ResolvedRuntimeProviderConfig
} from '../agent/provider/config.js';
import { GameError, GameService } from './game.js';
import { createWorldSession, setWorldSession, type WorldSession } from './world.js';
import { DeterministicNarrator, ProviderNarrator, type Narrator } from './narrator.js';
import { ladderView, spiritRootsView } from './view.js';

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_PORT = 8787;
/** Largest JSON body accepted. Every legitimate request here is under a kilobyte. */
const MAX_BODY_BYTES = 64 * 1024;

export interface ProviderStatus {
    name: string;
    model: string;
    /** True when the provider was actually constructible - key present, or local. */
    configured: boolean;
}

/**
 * ADMIN mode, per context.md: it lifts content gates, never the authority rule.
 * The only thing it unlocks in this server is a read-only roster.
 */
export function readAdminMode(env: NodeJS.ProcessEnv = process.env): boolean {
    const raw = (env.ADMIN_MODE ?? '').trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

/**
 * Build the narrator from configuration.
 *
 * Note what is absent: any branch on which provider was selected. The name is
 * resolved by `resolveRuntimeProviderConfig`, the instance is built by
 * `ProviderFactory`, and this function only asks whether one came back. An
 * unconfigured or unreachable provider is not an error - it is the
 * deterministic path, which is a first-class way to play this game.
 */
export function buildNarrator(
    config: ResolvedRuntimeProviderConfig = resolveRuntimeProviderConfig(),
    factory: ProviderFactory = new ProviderFactory()
): { narrator: Narrator; status: ProviderStatus } {
    factory.initialize();
    const provider = factory.tryGet(config.provider);

    if (!provider) {
        return {
            narrator: new DeterministicNarrator(describeProviderConfiguration(config.provider)),
            status: { name: config.provider, model: config.model, configured: false }
        };
    }

    return {
        narrator: new ProviderNarrator(provider, {
            model: config.model,
            timeoutMs: Number(process.env.NARRATOR_TIMEOUT_MS) || 30_000
        }),
        status: { name: config.provider, model: config.model, configured: true }
    };
}

/** Package version, for /api/health. Best effort - a missing file is not fatal. */
export function readVersion(): string {
    try {
        const path = fileURLToPath(new URL('../../package.json', import.meta.url));
        const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { version?: string };
        return parsed.version ?? '0.0.0';
    } catch {
        return '0.0.0';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// STATIC FILES
// ─────────────────────────────────────────────────────────────────────────

const MIME_TYPES: Readonly<Record<string, string>> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8'
};

/** The GUI directory. `web/` sits beside `dist/`, and beside `src/` in dev. */
export function defaultWebRoot(): string {
    if (process.env.WEB_ROOT) return resolve(process.env.WEB_ROOT);
    return fileURLToPath(new URL('../../web/', import.meta.url));
}

/**
 * Resolve a URL path to a file inside `root`, or null.
 *
 * The containment check is on the *resolved* path rather than the raw one, so
 * `..`, encoded `..`, and absolute paths all fail the same way: they resolve
 * outside the root and are refused. There is no allowlist to keep in sync.
 */
function resolveStaticPath(root: string, urlPath: string): string | null {
    let decoded: string;
    try {
        decoded = decodeURIComponent(urlPath);
    } catch {
        return null;
    }
    if (decoded.includes('\0')) return null;

    const relative = normalize(decoded).replace(/^([/\\])+/, '');
    const candidate = resolve(root, relative === '' ? 'index.html' : relative);

    const rootWithSep = resolve(root).endsWith(sep) ? resolve(root) : resolve(root) + sep;
    if (candidate !== resolve(root) && !candidate.startsWith(rootWithSep)) return null;

    try {
        const stat = statSync(candidate);
        if (stat.isDirectory()) {
            const index = join(candidate, 'index.html');
            return statSync(index).isFile() ? index : null;
        }
        return stat.isFile() ? candidate : null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// REQUEST HANDLING
// ─────────────────────────────────────────────────────────────────────────

export interface AppOptions {
    game: GameService;
    provider: ProviderStatus;
    version: string;
    webRoot?: string;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'cache-control': 'no-store'
    });
    res.end(body);
}

function sendError(res: ServerResponse, status: number, message: string): void {
    sendJson(res, status, { error: message });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of req) {
        const buf = chunk as Buffer;
        size += buf.length;
        if (size > MAX_BODY_BYTES) throw new GameError('Request body too large.', 413);
        chunks.push(buf);
    }

    if (size === 0) return {};

    let parsed: unknown;
    try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    } catch {
        throw new GameError('Request body is not valid JSON.', 400);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new GameError('Request body must be a JSON object.', 400);
    }
    return parsed as Record<string, unknown>;
}

function requireString(body: Record<string, unknown>, field: string): string {
    const value = body[field];
    if (typeof value !== 'string') throw new GameError(`"${field}" must be a string.`, 400);
    return value;
}

function requireNumber(body: Record<string, unknown>, field: string): number {
    const value = body[field];
    const asNumber = typeof value === 'string' ? Number(value) : value;
    if (typeof asNumber !== 'number' || !Number.isFinite(asNumber)) {
        throw new GameError(`"${field}" must be a number.`, 400);
    }
    return asNumber;
}

/**
 * The whole API, as one function.
 *
 * Routing is an explicit method+path table rather than a pattern matcher: there
 * are ten routes, none of them have parameters, and a table you can read top to
 * bottom is worth more here than an abstraction.
 */
export function createApp(options: AppOptions): (req: IncomingMessage, res: ServerResponse) => void {
    const { game, provider, version } = options;
    const webRoot = options.webRoot ?? defaultWebRoot();

    return (req, res) => {
        handle(req, res).catch(err => {
            if (!res.headersSent) {
                if (err instanceof GameError) sendError(res, err.status, err.message);
                else {
                    console.error('[web] unhandled request failure:', err);
                    sendError(res, 500, 'The engine failed to handle that request.');
                }
            } else {
                res.destroy();
            }
        });
    };

    async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const method = (req.method ?? 'GET').toUpperCase();
        const path = (req.url ?? '/').split('?')[0];

        if (!path.startsWith('/api/')) {
            if (method !== 'GET' && method !== 'HEAD') {
                sendError(res, 405, 'Method not allowed.');
                return;
            }
            serveStatic(res, webRoot, path, method === 'HEAD');
            return;
        }

        // ── GET ──
        if (method === 'GET') {
            switch (path) {
                case '/api/health':
                    sendJson(res, 200, {
                        ok: true,
                        version,
                        provider,
                        adminMode: game.adminMode
                    });
                    return;
                case '/api/reference/ladder':
                    sendJson(res, 200, ladderView());
                    return;
                case '/api/reference/spirit-roots':
                    sendJson(res, 200, spiritRootsView());
                    return;
                case '/api/state':
                    sendJson(res, 200, game.state());
                    return;
                case '/api/ledger':
                    sendJson(res, 200, game.ledger());
                    return;
                case '/api/admin/roster':
                    sendJson(res, 200, game.roster());
                    return;
                case '/api/admin/ladder-odds':
                    sendJson(res, 200, game.ladderOdds());
                    return;
                default:
                    sendError(res, 404, 'No such endpoint.');
                    return;
            }
        }

        // ── POST ──
        if (method === 'POST') {
            switch (path) {
                case '/api/run/new': {
                    const body = await readJsonBody(req);
                    sendJson(res, 201, await game.newRun(requireString(body, 'name')));
                    return;
                }
                case '/api/act': {
                    const body = await readJsonBody(req);
                    sendJson(res, 200, await game.act(requireString(body, 'input')));
                    return;
                }
                case '/api/cultivate': {
                    const body = await readJsonBody(req);
                    sendJson(res, 200, await game.cultivate(requireNumber(body, 'days')));
                    return;
                }
                case '/api/breakthrough':
                    sendJson(res, 200, await game.breakthrough());
                    return;
                default:
                    sendError(res, 404, 'No such endpoint.');
                    return;
            }
        }

        sendError(res, 405, 'Method not allowed.');
    }
}

function serveStatic(res: ServerResponse, root: string, path: string, headOnly: boolean): void {
    const file = resolveStaticPath(root, path);
    if (!file) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
    }

    const type = MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    // The GUI is served from the same volume it is deployed with and changes
    // only on redeploy, so it is not cached: a stale app.js against a new API
    // is a far more expensive problem than re-sending 60 KB.
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    if (headOnly) {
        res.end();
        return;
    }

    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
}

// ─────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────

export async function startServer(): Promise<ReturnType<typeof createServer>> {
    const db = useSingleUserDatabase(process.env.RPG_MCP_DB_PATH);
    const config = resolveRuntimeProviderConfig();
    const { narrator, status } = buildNarrator(config);

    // The world is built once, here, because seeding loads the content
    // catalogs asynchronously and every path downstream of it is synchronous.
    // It is installed as the process world so the MCP tool surface reaches the
    // same one: two front doors onto one save must not be two worlds.
    let world: WorldSession | null = null;
    try {
        world = await createWorldSession();
        setWorldSession(world);
    } catch (err) {
        // A world that failed to seed is a degraded deployment, not a dead one:
        // the cultivation engine, the narrator and every endpoint still work,
        // and the only thing missing is that the world does not move.
        console.error('[web] world seeding failed; the world will not advance:', err);
    }

    const game = new GameService({ db, narrator, world, adminMode: readAdminMode() });
    const app = createApp({ game, provider: status, version: readVersion() });

    const port = Number(process.env.PORT) || DEFAULT_PORT;
    const host = process.env.HOST || '0.0.0.0';

    const server = createServer(app);
    server.listen(port, host, () => {
        console.error(`[web] cultivation engine listening on http://${host}:${port}`);
        console.error(`[web] narrator: ${narrator.kind}` + (status.configured ? ` (${status.name} / ${status.model})` : ' - no provider configured, the engine narrates itself'));
        console.error(`[web] admin mode: ${game.adminMode ? 'on' : 'off'}`);
        console.error(world
            ? `[web] world: ${world.stats.npcs} people, ${world.stats.factions} factions, ` +
              `${world.stats.locations} places, day ${world.day}. In memory only until world.repo lands.`
            : '[web] world: none. Time passes for the cultivator and for nobody else.');
    });

    const shutdown = (signal: string) => {
        console.error(`[web] ${signal} received, closing.`);
        server.close(() => process.exit(0));
        // A hung keep-alive connection must not hold the container open.
        setTimeout(() => process.exit(0), 5_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
}

// Started only when run directly, so importing this module in a test does not
// bind a port.
const invokedDirectly = process.argv[1] !== undefined
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    startServer().catch(err => {
        console.error('[web] failed to start:', err);
        process.exit(1);
    });
}
