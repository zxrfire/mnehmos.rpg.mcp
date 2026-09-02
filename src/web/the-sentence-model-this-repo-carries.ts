/**
 * The sentence model, on disk, in this process, and unable to leave the machine.
 *
 * Turns a sentence into a vector whose direction is its MEANING rather than its
 * spelling. That is the whole of what it is for: "I need money" and "I look for
 * work" share almost no letters and sit near each other here, which is the
 * class of sentence a table of regular expressions and a bag of character
 * n-grams both structurally cannot reach.
 *
 * ── WHY IT IS ASSEMBLED BY HAND ──────────────────────────────────────────
 *
 * The obvious way to do this is a transformers library, and the reason not to
 * is the one rule this mode exists to keep: nothing may be fetched at run time,
 * and no inference may leave this process. Every such library has a hub client
 * in it that resolves a model name over the network on first use, and shipping
 * one means shipping a thing that has to be configured shut, correctly, forever,
 * by everybody who touches it.
 *
 * What is here instead has no network path to disable. `onnxruntime-node` runs
 * a graph and cannot fetch one; the tokenizer is eighty lines below; the
 * weights and the vocabulary are files in this repository, opened by absolute
 * path. There is no setting that would make this call out, which is a stronger
 * guarantee than a setting that says it will not.
 *
 * ── WHAT IS VENDORED ─────────────────────────────────────────────────────
 *
 * `models/<name>/model_quantized.onnx` and `models/<name>/vocab.txt`, both
 * committed. See `models/README.md` for which model, where it came from and how
 * to replace it.
 *
 * ── DETERMINISM ──────────────────────────────────────────────────────────
 *
 * The graph is fixed, the weights are fixed, the tokenizer is deterministic and
 * there is no sampling anywhere: the same string produces the same vector, in
 * any process, in any order, forever. Sequences are NOT padded to a common
 * length across a batch, because padding changes the pooled result in the last
 * bits and would make a sentence's vector depend on what it was asked alongside.
 * Each sentence is run on its own for that reason, and the batching that would
 * buy back is not worth a vector that moves.
 *
 * ── FAILURE ──────────────────────────────────────────────────────────────
 *
 * It throws. A fallback is for something outside your control, and a file in
 * this repository is not that - if the weights will not load, the build or the
 * checkout is broken, and a quieter mode that silently reads sentences worse is
 * strictly harder to notice than an error.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ort from 'onnxruntime-node';

/**
 * Which model this build carries.
 *
 * A directory name and nothing else. Everything about the shape - how many
 * dimensions, how many layers, what it cost to run - is read off the files, so
 * swapping this line and the directory beside it is the whole of a model
 * change. `models/README.md` records what each was measured at.
 */
export const MODEL_DIRECTORY = 'bge-base-en-v1.5';

/** Where the vendored models live, from this file rather than from the cwd. */
export function modelsDirectory(): string {
    return join(repositoryRoot(), 'models');
}

/** Longest sentence the model is shown, in word pieces, before it is cut. */
const MAX_PIECES = 256;

/** Repository root, from this file's location, so nothing depends on the cwd. */
function repositoryRoot(): string {
    // dist/web/<this file> and src/web/<this file> are both two below the root.
    return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

// ─────────────────────────────────────────────────────────────────────────
// THE TOKENIZER
//
// WordPiece, uncased, as every BERT-family sentence model in this family
// expects. Written out rather than depended on: it is the only part of the
// pipeline that is not a matrix multiply, it is eighty lines, and a tokenizer
// dependency is the usual way a hub client gets into a process.
// ─────────────────────────────────────────────────────────────────────────

let vocabulary: Map<string, number> | null = null;
let openedDirectory: string | null = null;

function vocab(): Map<string, number> {
    if (vocabulary !== null) return vocabulary;
    const text = readFileSync(
        join(modelsDirectory(), openedDirectory ?? MODEL_DIRECTORY, 'vocab.txt'),
        'utf8'
    );
    const map = new Map<string, number>();
    // Split on \n only: a vocabulary entry may legitimately be "\r".
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const token = lines[i].replace(/\r$/, '');
        if (token.length === 0 && i === lines.length - 1) continue;
        if (!map.has(token)) map.set(token, i);
    }
    return (vocabulary = map);
}

/**
 * Lowercase, strip accents, and cut into words and single punctuation marks.
 *
 * This is BERT's "basic tokenization" and it has to match, because the pieces
 * below are only in the vocabulary under these spellings.
 */
function basicTokens(text: string): string[] {
    const cleaned = text
        .normalize('NFD')
        // Combining marks. `do_lower_case` implies accent stripping in BERT.
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

    const out: string[] = [];
    let current = '';
    for (const character of cleaned) {
        if (/\s/.test(character)) {
            if (current) { out.push(current); current = ''; }
            continue;
        }
        // Every punctuation mark is a token of its own.
        if (/[!-/:-@[-`{-~]/.test(character)) {
            if (current) { out.push(current); current = ''; }
            out.push(character);
            continue;
        }
        current += character;
    }
    if (current) out.push(current);
    return out;
}

/** Greedy longest-match-first, with `##` on every piece after the first. */
function wordPieces(word: string, table: Map<string, number>): number[] {
    if (word.length > 100) return [table.get('[UNK]') as number];
    const ids: number[] = [];
    let start = 0;
    while (start < word.length) {
        let end = word.length;
        let found = -1;
        while (start < end) {
            const piece = start === 0 ? word.slice(start, end) : `##${word.slice(start, end)}`;
            const id = table.get(piece);
            if (id !== undefined) { found = id; break; }
            end--;
        }
        if (found === -1) return [table.get('[UNK]') as number];
        ids.push(found);
        start = end;
    }
    return ids;
}

/** `[CLS] pieces [SEP]`, cut to {@link MAX_PIECES}. */
export function tokenize(text: string): number[] {
    const table = vocab();
    const cls = table.get('[CLS]') as number;
    const sep = table.get('[SEP]') as number;
    const ids: number[] = [cls];
    for (const word of basicTokens(text)) {
        for (const id of wordPieces(word, table)) {
            if (ids.length >= MAX_PIECES - 1) break;
            ids.push(id);
        }
        if (ids.length >= MAX_PIECES - 1) break;
    }
    ids.push(sep);
    return ids;
}

// ─────────────────────────────────────────────────────────────────────────
// THE MODEL
// ─────────────────────────────────────────────────────────────────────────

let session: ort.InferenceSession | null = null;

/**
 * Open the graph. Costs a fifth of a second and is paid once per process.
 *
 * Synchronous callers cannot have it, so this is awaited once by whoever needs
 * the tier and the handle is kept.
 */
export async function loadTheModel(directory: string = MODEL_DIRECTORY): Promise<void> {
    if (session !== null && openedDirectory === directory) return;
    openedDirectory = directory;
    vocabulary = null;
    session = await ort.InferenceSession.create(
        join(modelsDirectory(), directory, 'model_quantized.onnx'),
        {
        // One thread. Not for speed - a sentence is short enough that thread
        // pool overhead is most of the cost either way - but because a
        // multi-threaded reduction sums in whatever order the threads finish
        // in, and this tier's answer must not depend on that.
        intraOpNumThreads: 1,
        interOpNumThreads: 1,
        executionMode: 'sequential',
        graphOptimizationLevel: 'all'
    }
    );
}

/** True once the weights are open. */
export function theModelIsOpen(): boolean {
    return session !== null;
}

/**
 * One sentence, one unit-length vector.
 *
 * Mean-pooled over the real tokens and normalised, which is what this family of
 * models is trained to be compared as - so a dot product between two of these
 * is their cosine similarity.
 */
export async function embed(text: string): Promise<Float32Array> {
    if (session === null) {
        throw new Error(
            'The sentence model has not been opened. Call loadTheModel() first; '
            + `it reads models/${MODEL_DIRECTORY}/ out of the repository.`
        );
    }

    const ids = tokenize(text);
    const length = ids.length;
    const big = (value: number) => BigInt(value);

    const feeds: Record<string, ort.Tensor> = {
        input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(big)), [1, length]),
        attention_mask: new ort.Tensor('int64', BigInt64Array.from(ids.map(() => big(1))), [1, length])
    };
    // Some graphs in this family declare it and some do not. Feeding an input
    // the graph has not got is an error, so ask the graph.
    if (session.inputNames.includes('token_type_ids')) {
        feeds.token_type_ids = new ort.Tensor('int64', BigInt64Array.from(ids.map(() => big(0))), [1, length]);
    }

    const result = await session.run(feeds);
    const hidden = result[session.outputNames[0]];
    const data = hidden.data as Float32Array;
    const width = hidden.dims[hidden.dims.length - 1];

    // Mean over tokens. Every token is real - nothing is padded - so the mask
    // is all ones and the mean is a plain average.
    const pooled = new Float32Array(width);
    for (let token = 0; token < length; token++) {
        const offset = token * width;
        for (let i = 0; i < width; i++) pooled[i] += data[offset + i];
    }
    for (let i = 0; i < width; i++) pooled[i] /= length;

    let sum = 0;
    for (let i = 0; i < width; i++) sum += pooled[i] * pooled[i];
    const norm = Math.sqrt(sum);
    if (norm > 0) for (let i = 0; i < width; i++) pooled[i] /= norm;
    return pooled;
}

/** Cosine similarity of two unit vectors, which is their dot product. */
export function similarity(a: Float32Array, b: Float32Array): number {
    let total = 0;
    for (let i = 0; i < a.length; i++) total += a[i] * b[i];
    return total;
}
