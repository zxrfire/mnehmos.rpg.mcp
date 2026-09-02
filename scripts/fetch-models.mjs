#!/usr/bin/env node
/**
 * Fetch the two sentence models the no-model tiers run on, plus the runtime
 * that executes them in a browser tab.
 *
 * WHY THIS IS A SCRIPT AND NOT A COMMIT
 * ------------------------------------
 * Carrying the weights in the repository is the better answer and it is not
 * available: this repository is a fork, and GitHub does not let a fork hold its
 * own large files - they would have to live in the upstream repository, which
 * is not ours to write to. So the weights are fetched once and the claim those
 * tiers make weakens from "works with nothing behind it" to "works with nothing
 * behind it, after one setup with a network". Everything at run time is
 * unchanged: no hub, no endpoint, no loopback, a file path and nothing else.
 *
 * Run once after cloning:
 *
 *     npm run models:fetch
 *
 * Then rebuild the exemplar vectors, which ARE derived from a file in this
 * repository and are therefore not fetched:
 *
 *     npm run build && npm run verbs:embed
 *
 * Nothing here is required to run the game with a model provider configured,
 * or to run any test that does not exercise the meaning tier.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, stat, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Where each file comes from and where it goes.
 *
 * The two models are the ONNX exports of BAAI's `bge-*-en-v1.5` sentence
 * encoders. Only the quantised weights and the WordPiece vocabulary are taken;
 * nothing else in those repositories is used or needed. `models/README.md`
 * records the sweep that chose these two over two others, and what replacing
 * one costs.
 */
const FILES = [
    // Rung 3, Node. The stronger of the two: 768 dimensions, 6.8 ms warm.
    ['Xenova/bge-base-en-v1.5', 'onnx/model_quantized.onnx', 'models/bge-base-en-v1.5/model_quantized.onnx'],
    ['Xenova/bge-base-en-v1.5', 'vocab.txt', 'models/bge-base-en-v1.5/vocab.txt'],
    ['Xenova/bge-base-en-v1.5', 'config.json', 'models/bge-base-en-v1.5/config.json'],
    ['Xenova/bge-base-en-v1.5', 'tokenizer_config.json', 'models/bge-base-en-v1.5/tokenizer_config.json'],

    // Rung 4, the browser. Smaller because a tab has to hold it: 384
    // dimensions, 1.5 ms warm, and it is served from the page's own origin,
    // which is why there is a second copy under `web/`.
    ['Xenova/bge-small-en-v1.5', 'onnx/model_quantized.onnx', 'models/bge-small-en-v1.5/model_quantized.onnx'],
    ['Xenova/bge-small-en-v1.5', 'vocab.txt', 'models/bge-small-en-v1.5/vocab.txt'],
    ['Xenova/bge-small-en-v1.5', 'config.json', 'models/bge-small-en-v1.5/config.json'],
    ['Xenova/bge-small-en-v1.5', 'tokenizer_config.json', 'models/bge-small-en-v1.5/tokenizer_config.json'],
    ['Xenova/bge-small-en-v1.5', 'onnx/model_quantized.onnx', 'web/tier/bge-small-en-v1.5/model_quantized.onnx'],
    ['Xenova/bge-small-en-v1.5', 'vocab.txt', 'web/tier/bge-small-en-v1.5/vocab.txt']
];

/** The WASM build of the runtime, which the browser rung loads from its own origin. */
const RUNTIME = [
    ['onnxruntime-web@1.24.3', 'dist/ort-wasm-simd-threaded.wasm', 'web/tier/ort/ort-wasm-simd-threaded.wasm'],
    ['onnxruntime-web@1.24.3', 'dist/ort-wasm-simd-threaded.mjs', 'web/tier/ort/ort-wasm-simd-threaded.mjs'],
    ['onnxruntime-web@1.24.3', 'dist/ort.wasm.bundle.min.mjs', 'web/tier/ort/ort.wasm.bundle.min.mjs']
];

const hugging = (repo, file) => `https://huggingface.co/${repo}/resolve/main/${file}`;
const unpkg = (pkg, file) => `https://unpkg.com/${pkg}/${file}`;

async function alreadyThere(target) {
    try {
        // A pointer file or a truncated download is not a model. Anything this
        // small is a failed previous run rather than something to keep.
        return (await stat(target)).size > 4096;
    } catch {
        return false;
    }
}

async function fetchTo(url, target) {
    const full = join(ROOT, target);
    if (await alreadyThere(target)) {
        console.log(`  have  ${target}`);
        return;
    }
    await mkdir(dirname(full), { recursive: true });
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok || !response.body) {
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }
    // Write to a temporary name and move it into place, so an interrupted run
    // leaves nothing that `alreadyThere` would later accept.
    const partial = `${full}.partial`;
    try {
        await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
        const { rename } = await import('node:fs/promises');
        await rename(partial, full);
    } catch (err) {
        await rm(partial, { force: true });
        throw err;
    }
    console.log(`  got   ${target}`);
}

async function main() {
    console.log('Fetching the sentence models. This is a one-time download of about 180 MB.\n');
    for (const [repo, file, target] of FILES) await fetchTo(hugging(repo, file), target);
    for (const [pkg, file, target] of RUNTIME) await fetchTo(unpkg(pkg, file), target);
    console.log('\nDone. Now build the exemplar vectors, which are derived from');
    console.log('`src/web/how-a-player-says-each-verb.ts` and are not downloaded:\n');
    console.log('    npm run build && npm run verbs:embed\n');
}

main().catch(err => {
    console.error(`\nfetch-models failed: ${String(err)}`);
    console.error('Nothing partial was left behind. Re-run to continue where it stopped.');
    process.exit(1);
});
