#!/usr/bin/env node
/**
 * One-command launcher: `npm run play`.
 *
 * Brings up the whole game - compiles if needed, opens the database, starts the
 * web GUI and its backend, and points a browser at it. No Docker required, no
 * services to configure, no API key needed.
 *
 * This exists because the Docker path, while supported, is a heavier dependency
 * than this deployment deserves: the entire game is one Node process plus a
 * SQLite file. Docker is the alternative, not the requirement.
 */

import { spawn } from 'node:child_process';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const PORT = process.env.PORT ?? '8787';
const shouldOpen = !process.argv.includes('--no-open');
const forceBuild = process.argv.includes('--build');

function run(command, args, opts = {}) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, {
            cwd: root,
            stdio: 'inherit',
            // npm/npx are .cmd shims on Windows and are not directly executable.
            shell: platform === 'win32',
            ...opts
        });
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) resolvePromise();
            else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

/** Newest mtime under a directory tree, or 0 when it does not exist. */
function newestMtime(dir) {
    if (!existsSync(dir)) return 0;
    let newest = 0;
    const walk = current => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const full = join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else newest = Math.max(newest, statSync(full).mtimeMs);
        }
    };
    walk(dir);
    return newest;
}

/**
 * Rebuild only when the sources are actually newer than the output. A player
 * launching the game twice in a row should not pay for a TypeScript compile.
 */
function needsBuild() {
    if (forceBuild) return true;
    const entry = join(root, 'dist', 'web', 'server.js');
    if (!existsSync(entry)) return true;
    return newestMtime(join(root, 'src')) > newestMtime(join(root, 'dist'));
}

function openBrowser(url) {
    const [command, args] =
        platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
        : platform === 'darwin' ? ['open', [url]]
        : ['xdg-open', [url]];
    // Best-effort: a headless or restricted environment simply gets the URL
    // printed instead, which is not worth failing a launch over.
    try {
        spawn(command, args, { stdio: 'ignore', detached: true }).unref();
    } catch {
        /* ignored */
    }
}

async function main() {
    if (!existsSync(join(root, 'node_modules'))) {
        console.log('→ Installing dependencies (first run only)…');
        await run('npm', ['install']);
    }

    if (needsBuild()) {
        console.log('→ Compiling…');
        await run('npm', ['run', 'build']);
    }

    const url = `http://localhost:${PORT}`;
    console.log(`\n  The Cultivation Ladder is open at ${url}\n`);

    if (shouldOpen) {
        // Give the listener a moment before the browser races it.
        setTimeout(() => openBrowser(url), 1200);
    }

    await run('node', [join('dist', 'web', 'server.js')], {
        env: { ...process.env, PORT }
    });
}

main().catch(err => {
    console.error(`\n✗ ${err.message}\n`);
    process.exit(1);
});
