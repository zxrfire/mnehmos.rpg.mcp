/* ══════════════════════════════════════════════════════════════════════
   THE FOURTH RUNG: the intent tier, in the tab.

   Same job as `src/web/reaching-a-verb-the-pattern-table-has-no-line-for.ts`
   and the same shape - a sentence model puts the player's words and the verb
   exemplars in one space, and the nearest verb wins - but running in the
   browser under WASM, on a model small enough for a tab to hold.

   WHY THERE ARE TWO. The ladder the owner named is Claude, then Ollama, then
   Node, then Browser, in that order of power, and the last two are the same
   idea at two sizes. The Node process is bounded only by a one-second warm
   budget and carries a 110MB model; a tab is bounded by what somebody will
   wait to download and what their machine will hold, and carries a 34MB one.
   Measured, the difference is smaller than the size gap suggests: see
   `models/README.md`.

   NO NETWORK OF ANY KIND, and in a tab that sentence needs care. The model,
   the vocabulary and the exemplar vectors are fetched from THIS origin, as
   page assets, the way a stylesheet is - there is no model hub, no CDN and no
   inference endpoint anywhere in this file. Once they are in memory the
   arithmetic is WASM in this tab and nothing leaves it.

   WHAT IT DOES NOT DO. It never touches narration. An embedding maps a
   sentence onto a verb; it cannot generate, and the prose a player reads on
   this rung is the engine's own, unrewritten. That is the deal: flatter
   writing, still playable.
   ══════════════════════════════════════════════════════════════════════ */

import * as ort from './ort/ort.wasm.bundle.min.mjs';

ort.env.wasm.wasmPaths = new URL('./ort/', import.meta.url).href;
// One thread. A short sentence is not worth a thread pool, and a
// multi-threaded reduction sums in whatever order the threads finish in -
// which would make the answer depend on the machine rather than the sentence.
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

const MODEL = 'bge-small-en-v1.5';
const MAX_PIECES = 256;

/* The same two bars as the Node tier, refitted for this model. `models/README.md`
   carries the sweep both were read off. */
const ACCEPT_AT = 0.68;
const ACCEPT_TIME_SPENDING_AT = 0.76;
const CLEAR_OF_RUNNER_UP_BY = 0.01;

/* Verbs that spend in-world time. Mirrors TIME_CONSUMING_ACTIONS in
   `src/web/actions.ts`. A guess that lands here costs years that do not come
   back, which is why it is held to the higher bar. */
const SPENDS_TIME = new Set([
  'cultivate', 'seclude', 'breakthrough', 'train_technique', 'move', 'gather',
  'hunt', 'wait', 'work', 'refine', 'eat', 'treat', 'attack', 'learn_technique',
  'consume_pill', 'descend', 'site', 'legacy', 'request'
]);

/* ─────────────────────────── the tokenizer ─────────────────────────── */
/* WordPiece, uncased. Line for line the same as the Node side, because two
   tokenizers that disagree are two models. */

let vocab = null;

function basicTokens(text) {
  const cleaned = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const out = [];
  let current = '';
  for (const ch of cleaned) {
    if (/\s/.test(ch)) { if (current) { out.push(current); current = ''; } continue; }
    if (/[!-/:-@[-`{-~]/.test(ch)) {
      if (current) { out.push(current); current = ''; }
      out.push(ch);
      continue;
    }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}

function wordPieces(word) {
  if (word.length > 100) return [vocab.get('[UNK]')];
  const ids = [];
  let start = 0;
  while (start < word.length) {
    let end = word.length;
    let found = -1;
    while (start < end) {
      const piece = start === 0 ? word.slice(start, end) : `##${word.slice(start, end)}`;
      const id = vocab.get(piece);
      if (id !== undefined) { found = id; break; }
      end--;
    }
    if (found === -1) return [vocab.get('[UNK]')];
    ids.push(found);
    start = end;
  }
  return ids;
}

function tokenize(text) {
  const ids = [vocab.get('[CLS]')];
  for (const word of basicTokens(text)) {
    for (const id of wordPieces(word)) {
      if (ids.length >= MAX_PIECES - 1) break;
      ids.push(id);
    }
    if (ids.length >= MAX_PIECES - 1) break;
  }
  ids.push(vocab.get('[SEP]'));
  return ids;
}

/* ────────────────────────────── the model ────────────────────────────── */

let session = null;
let verbs = null;
let opening = null;

async function fetchOrThrow(path) {
  const url = new URL(path, import.meta.url).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
  return res;
}

/**
 * Read the weights, the vocabulary and the exemplar vectors.
 *
 * It throws. A fallback is for something outside your control, and these are
 * files served from this origin alongside the page - if they are not there the
 * build or the deployment is broken, and a quieter mode that silently reads
 * sentences worse is harder to notice than an error.
 */
export function openTheTier() {
  if (opening) return opening;
  opening = (async () => {
    const [vocabText, weights, manifest, vectorBytes] = await Promise.all([
      (await fetchOrThrow(`./${MODEL}/vocab.txt`)).text(),
      (await fetchOrThrow(`./${MODEL}/model_quantized.onnx`)).arrayBuffer(),
      (await fetchOrThrow(`./${MODEL}/verb-corpus.json`)).json(),
      (await fetchOrThrow(`./${MODEL}/verb-corpus.f32`)).arrayBuffer()
    ]);

    vocab = new Map();
    vocabText.split('\n').forEach((line, i) => {
      const token = line.replace(/\r$/, '');
      if (!vocab.has(token)) vocab.set(token, i);
    });

    session = await ort.InferenceSession.create(weights, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });

    const floats = new Float32Array(vectorBytes);
    const width = manifest.width;
    let offset = 0;
    verbs = manifest.rows.map((row) => {
      const exemplars = [];
      for (let i = 0; i < row.count; i++) {
        exemplars.push(floats.subarray(offset, offset + width));
        offset += width;
      }
      return { action: row.action, exemplars };
    });
  })();
  return opening;
}

/** One sentence, one unit-length vector. Mean-pooled, then normalised. */
export async function embed(text) {
  if (!session) await openTheTier();
  const ids = tokenize(text);
  const n = ids.length;
  const big = BigInt64Array.from(ids, (v) => BigInt(v));
  const feeds = {
    input_ids: new ort.Tensor('int64', big, [1, n]),
    attention_mask: new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), [1, n])
  };
  if (session.inputNames.includes('token_type_ids')) {
    feeds.token_type_ids = new ort.Tensor('int64', BigInt64Array.from(ids, () => 0n), [1, n]);
  }
  const out = await session.run(feeds);
  const hidden = out[session.outputNames[0]];
  const data = hidden.data;
  const width = hidden.dims[hidden.dims.length - 1];

  const pooled = new Float32Array(width);
  for (let t = 0; t < n; t++) {
    const off = t * width;
    for (let i = 0; i < width; i++) pooled[i] += data[off + i];
  }
  let sum = 0;
  for (let i = 0; i < width; i++) { pooled[i] /= n; sum += pooled[i] * pooled[i]; }
  const norm = Math.sqrt(sum);
  if (norm > 0) for (let i = 0; i < width; i++) pooled[i] /= norm;
  return pooled;
}

/** The verb this sentence means, with the runner-up, or null. */
export async function nearestVerbByMeaning(text) {
  if (!verbs) await openTheTier();
  const query = await embed(text);
  let best = null;
  let second = null;
  for (const verb of verbs) {
    let nearest = -1;
    for (const exemplar of verb.exemplars) {
      let total = 0;
      for (let i = 0; i < query.length; i++) total += query[i] * exemplar[i];
      if (total > nearest) nearest = total;
    }
    if (!best || nearest > best.score) { second = best; best = { action: verb.action, score: nearest }; }
    else if (!second || nearest > second.score) second = { action: verb.action, score: nearest };
  }
  if (!best) return null;
  return {
    action: best.action,
    score: best.score,
    runnerUp: second ? second.action : null,
    runnerUpScore: second ? second.score : 0
  };
}

/**
 * The verb, or null to leave the sentence refused.
 *
 * The caller must only ever hand this a sentence the pattern table already
 * returned `unclear` for. That ordering is what makes the tier safe and it is
 * not this file's to relax.
 */
export async function verbForASentenceThePatternsMissed(text) {
  const nearest = await nearestVerbByMeaning(text);
  if (!nearest) return null;
  const floor = SPENDS_TIME.has(nearest.action) ? ACCEPT_TIME_SPENDING_AT : ACCEPT_AT;
  if (nearest.score < floor) return null;
  if (nearest.score - nearest.runnerUpScore < CLEAR_OF_RUNNER_UP_BY) return null;
  return nearest.action;
}
