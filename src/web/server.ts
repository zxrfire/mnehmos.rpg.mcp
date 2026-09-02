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

import { getDbPath, useSingleUserDatabase } from '../storage/index.js';
import { ProviderFactory } from '../agent/provider/factory.js';
import {
    describeProviderConfiguration,
    resolveRuntimeProviderConfig,
    type ResolvedRuntimeProviderConfig
} from '../agent/provider/config.js';
import { GameError, GameService } from './game.js';
import {
    DeterministicNarrator,
    ProviderNarrator,
    openTheSentenceModel,
    type Narrator
} from './narrator.js';
import { ladderView, spiritRootsView } from './view.js';
import { buildRegister, renderRegisterHtml } from './register.js';
import { placesView } from './places.js';
import { clearProse, defaultProsePath, ensureProse, type GenerateOptions } from './register-prose.js';
import { announceMode, type PlayMode } from './which-mode-this-session-is-playing-in.js';

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
    /**
     * Which of the two ways of playing this is, as a mode rather than as a
     * missing environment variable.
     *
     * `configured` was already here and already correct, and the client
     * rendered it as "(not configured)" - true, and the wrong thing to tell
     * somebody, because it names an absence rather than the mode they are in.
     * Both are carried: the boolean for anything that needs the fact, and the
     * announcement for anything that shows it to a person.
     */
    mode: PlayMode;
    modeLabel: string;
    modeLine: string;
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
        const narrator = new DeterministicNarrator(describeProviderConfiguration(config.provider));
        return {
            narrator,
            status: {
                name: config.provider,
                model: config.model,
                configured: false,
                ...modeFields(narrator)
            }
        };
    }

    const narrator = new ProviderNarrator(provider, {
        model: config.model,
        timeoutMs: Number(process.env.NARRATOR_TIMEOUT_MS) || 30_000
    });
    return {
        narrator,
        status: {
            name: config.provider,
            model: config.model,
            configured: true,
            ...modeFields(narrator)
        }
    };
}

/** The mode, read off the narrator that was actually built rather than off config. */
function modeFields(narrator: Narrator): Pick<ProviderStatus, 'mode' | 'modeLabel' | 'modeLine'> {
    const announced = announceMode(narrator);
    return { mode: announced.mode, modeLabel: announced.label, modeLine: announced.line };
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
    /**
     * How the register writes its curated prose, and where it keeps it.
     *
     * Both optional, and absent is a supported state rather than a degraded
     * one: with no provider the register serves its tables with whatever prose
     * is already cached, marked behind. Same posture as the deterministic
     * narrator - an unconfigured model is a quieter page, never a broken one.
     */
    proseGen?: GenerateOptions | null;
    prosePath?: string;
}

/** An HTML document, for the endpoints an operator opens rather than fetches. */
function sendHtml(res: ServerResponse, status: number, body: string): void {
    res.writeHead(status, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'cache-control': 'no-store'
    });
    res.end(body);
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
    const proseGen = options.proseGen ?? null;
    const prosePath = options.prosePath ?? defaultProsePath(getDbPath());
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
                    // The sheet now carries who else is drawing on this ground,
                    // which needs the world. `state()` is synchronous and has
                    // dozens of call sites, so the endpoint warms the world
                    // instead - the read is on the sheet from the first paint
                    // rather than appearing after the first action.
                    await game.warmWorld();
                    sendJson(res, 200, game.state());
                    return;
                case '/api/ledger':
                    sendJson(res, 200, game.ledger());
                    return;
                // What a stretch of seclusion will cost to eat, asked BEFORE
                // it is entered. A pure read - no time passes, no stone moves,
                // nothing is written - and it runs the same arithmetic that
                // spends the stones at the cave mouth, so the picker cannot
                // quote a figure the seclusion then disagrees with.
                case '/api/seclusion/provisions': {
                    const asked = new URL(req.url ?? '/', 'http://localhost')
                        .searchParams.get('days');
                    sendJson(res, 200, game.provisionsForAStretch(Number(asked)));
                    return;
                }
                case '/api/admin/roster':
                    sendJson(res, 200, await game.roster());
                    return;
                case '/api/admin/ladder-odds':
                    sendJson(res, 200, await game.ladderOdds());
                    return;
                // The world map. A read over `WorldState.locations` and
                // nothing else - see `places.ts` for why it carries no
                // coordinates. Null world before a run is an answer, not a
                // failure, so this does not 404 on an empty database.
                case '/api/admin/places':
                    game.assertAdmin('the world map');
                    sendJson(res, 200, placesView(await game.loadWorld()));
                    return;
                // Two representations of one build. The JSON is for tooling;
                // the HTML is what an operator opens in a tab beside the game.
                case '/api/admin/register':
                    game.assertAdmin('the standing register');
                    sendJson(res, 200, buildRegister());
                    return;
                case '/api/admin/register.html': {
                    game.assertAdmin('the standing register');
                    const reg = buildRegister();
                    // ?refresh=1 discards the cache first, which is the only way
                    // to rewrite prose whose underlying facts have not moved.
                    if ((req.url ?? '').includes('refresh=1')) clearProse(prosePath);
                    const { cache } = await ensureProse(reg, prosePath, proseGen);
                    sendHtml(res, 200, renderRegisterHtml(reg, cache.blocks));
                    return;
                }
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
                    // `anyway` is the caller confirming a stretch the engine has
                    // already refused as returning exactly zero. See the zero
                    // -return gate in `runSeclusion`.
                    sendJson(res, 200, await game.cultivate(
                        requireNumber(body, 'days'),
                        { anyway: (body as { anyway?: unknown }).anyway === true }
                    ));
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

    // The world itself is owned by `src/server/state/cultivation-world.ts` and
    // is addressed by run rather than held here: it outlives its runs, and a
    // second copy of it living in this layer was exactly the duplication that
    // had to go.
    const game = new GameService({ db, narrator, adminMode: readAdminMode() });

    // The register writes its prose through the same provider the narrator uses,
    // resolved the same way. No provider means no generation, which the register
    // handles by serving its tables and saying the prose is behind.
    const proseFactory = new ProviderFactory();
    proseFactory.initialize();
    const proseProvider = proseFactory.tryGet(config.provider);
    const app = createApp({
        game,
        provider: status,
        version: readVersion(),
        proseGen: proseProvider ? { provider: proseProvider, model: config.model } : null
    });

    const port = Number(process.env.PORT) || DEFAULT_PORT;
    const host = process.env.HOST || '0.0.0.0';

    // Read the weights and the exemplar vectors now rather than on the first
    // sentence the pattern table cannot place. It is a fraction of a second and
    // the wrong moment to spend it is while somebody is watching a spinner. A
    // failure here is reported and not fatal: every sentence the table already
    // reaches still reaches it, which is most of them.
    void openTheSentenceModel().catch((err: unknown) => {
        console.error(`[web] the sentence model did not open: ${String(err)}`);
    });

    const server = createServer(app);
    server.listen(port, host, () => {
        console.error(`[web] cultivation engine listening on http://${host}:${port}`);
        console.error(`[web] ${status.modeLabel}` + (status.configured ? ` (${status.name} / ${status.model})` : ' - no provider configured, the engine narrates itself'));
        console.error(`[web] ${status.modeLine}`);
        console.error(`[web] admin mode: ${game.adminMode ? 'on' : 'off'}`);
        console.error('[web] world: rebuilt per run from its seed, in memory until world.repo lands.');
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
