#!/usr/bin/env node
/**
 * Build the exemplar vectors the intent tier compares against.
 *
 * `npm run verbs:embed` - after any edit to
 * `src/web/how-a-player-says-each-verb.ts`, and after changing which model the
 * build carries. The tier hashes the corpus and refuses to load against stale
 * vectors, so forgetting this is an error at startup rather than a silent
 * wrong answer.
 *
 * The vectors are committed. Embedding 232 exemplars costs seconds and the tier
 * has to answer a turn instantly, so the cost is paid here, once, by whoever
 * changed the corpus.
 *
 * Pass a model directory to build for one that is not the shipping model:
 *
 *     node scripts/embed-the-verb-corpus.mjs bge-small-en-v1.5
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { HOW_A_PLAYER_SAYS_EACH_VERB } = await import(
    new URL('../dist/web/how-a-player-says-each-verb.js', import.meta.url).href
);
const { embed, loadTheModel, MODEL_DIRECTORY } = await import(
    new URL('../dist/web/the-sentence-model-this-repo-carries.js', import.meta.url).href
);
const { corpusFingerprint, verbVectorPaths } = await import(
    new URL('../dist/web/reaching-a-verb-the-pattern-table-has-no-line-for.js', import.meta.url).href
);

const directory = process.argv[2] || MODEL_DIRECTORY;

const startedLoading = Date.now();
await loadTheModel(directory);
console.log(`[verbs] ${directory}: model open in ${Date.now() - startedLoading} ms`);

const rows = [];
const vectors = [];
let width = 0;

const startedEmbedding = Date.now();
for (const [action, phrasings] of Object.entries(HOW_A_PLAYER_SAYS_EACH_VERB)) {
    for (const phrasing of phrasings) {
        const vector = await embed(phrasing);
        width = vector.length;
        vectors.push(vector);
    }
    rows.push({ action, count: phrasings.length });
}
const embeddingMs = Date.now() - startedEmbedding;

const flat = new Float32Array(vectors.length * width);
vectors.forEach((vector, i) => flat.set(vector, i * width));

const paths = verbVectorPaths(directory);
writeFileSync(paths.vectors, Buffer.from(flat.buffer, flat.byteOffset, flat.byteLength));
writeFileSync(
    paths.index,
    `${JSON.stringify({ model: directory, width, corpusHash: corpusFingerprint(), rows }, null, 1)}\n`
);

console.log(
    `[verbs] ${vectors.length} exemplars, ${width} dimensions, ${embeddingMs} ms `
    + `(${(embeddingMs / vectors.length).toFixed(1)} ms each)`
);
console.log(`[verbs] wrote ${paths.index.slice(root.length + 1)} and ${paths.vectors.slice(root.length + 1)}`);
