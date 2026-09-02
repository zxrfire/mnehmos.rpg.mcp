# The sentence models this repository runs on

Two models, one per non-LLM rung. They exist so a sentence nobody wrote a
regular expression for still reaches the verb the player meant.

**They are fetched, not committed, and that is a compromise rather than a
preference.** Carrying them here is the better answer - a checkout would work
on a machine that has never had a network - and it is not available: this
repository is a fork, and GitHub does not let a fork hold its own large files.
They would have to live in the upstream repository, which is not ours to write
to. So the claim these rungs make is *works with nothing behind it, after one
setup with a network* rather than the stronger thing.

    npm run models:fetch
    npm run build && npm run verbs:embed

**Nothing changes at run time.** No hub, no endpoint, no loopback address, no
sidecar - a file path and nothing else, which is the rule the next section is
about.

| directory | rung | used by | size |
|---|---|---|---|
| `bge-base-en-v1.5/` | 3 - Node | `src/web/the-sentence-model-this-repo-carries.ts` | 110 MB |
| `bge-small-en-v1.5/` | 4 - browser | `web/tier/reading-a-sentence-in-the-tab.js`, copied into `web/tier/` so the page serves it from its own origin | 34 MB |

## The rule these exist to keep

**No network of any kind.** Not the internet, not a loopback address, not a
sidecar on the same machine, not a hosted embedding endpoint. The Node side runs
`onnxruntime-node` on a file path; the browser side runs `onnxruntime-web` on
bytes fetched from its own origin the way a stylesheet is. Neither has a model
hub in it, which is a stronger guarantee than a hub that has been configured
shut - there is no setting to get wrong.

This is why no transformers library is used. Every one of them resolves a model
name over the network on first use, and shipping one means shipping a thing that
has to be pinned closed, correctly, forever, by everybody who touches it.

## What is in each directory

| file | what it is |
|---|---|
| `model_quantized.onnx` | the weights, int8 |
| `vocab.txt` | the WordPiece vocabulary, 30,522 entries |
| `verb-corpus.json` | which verb owns which rows of the vectors, and the corpus hash |
| `verb-corpus.f32` | the exemplar vectors, raw little-endian `Float32` |

`verb-corpus.*` is **derived** from `src/web/how-a-player-says-each-verb.ts` and
is rebuilt with `npm run verbs:embed`. The corpus is hashed into the JSON and
checked at load, so editing the corpus and forgetting to rebuild is an error
naming the command rather than a tier that quietly answers with yesterday's
phrasings.

## Provenance

Both are the ONNX exports published as `Xenova/bge-base-en-v1.5` and
`Xenova/bge-small-en-v1.5`, of BAAI's `bge-*-en-v1.5` sentence encoders. Only
`onnx/model_quantized.onnx` and `vocab.txt` are taken; nothing else in those
repositories is used or needed.

## Why these two, measured

Four candidates, every arm in one command, on this machine. **Accuracy is the
best zero-leak setting for each model** - that is, the acceptance floors swept
per model and only settings where none of `misparse.test.ts`'s seventeen
unrecognised sentences reach a verb that spends in-world time. The held-out
column is the half of the 168-sentence probe set no threshold was fitted to, and
it is the honest number.

| model | dims | warm | probe, all | probe, held out | size |
|---|---|---|---|---|---|
| `all-MiniLM-L6-v2` | 384 | 0.9 ms | 67.9% | 63.1% | 23 MB |
| `bge-small-en-v1.5` | 384 | 1.5 ms | 81.5% | 78.6% | 34 MB |
| **`bge-base-en-v1.5`** | 768 | 6.8 ms | **85.7%** | **81.0%** | 110 MB |
| `bge-large-en-v1.5` | 1024 | 23 ms | 84.5% | 81.0% | 337 MB |

**Bigger stopped paying at base.** `bge-large` is three times the size and three
and a half times the latency of `bge-base`, ties it on the held-out half and is
a point behind it overall - because its zero-leak floor has to sit higher, and a
higher floor refuses more sentences that were right. It is not carried.

For reference, the tier this replaced used hashed character n-grams and no model
at all: 79.2% overall and 73.8% held out. The pattern table alone reaches 41.1%
and 42.9%.

## Replacing one

1. Put the new export in `models/<name>/` with `model_quantized.onnx` and
   `vocab.txt`.
2. Point `MODEL_DIRECTORY` in `src/web/the-sentence-model-this-repo-carries.ts`
   at it (or `MODEL` in `web/tier/reading-a-sentence-in-the-tab.js` for the
   browser rung).
3. `npm run build && node scripts/embed-the-verb-corpus.mjs <name>`.
4. **Re-sweep the acceptance floors.** They are not portable between models: the
   cone every model puts sentences in is a different width, and a floor carried
   over from another model is a number that means nothing here. The two hard
   bars are 208/208 on `coverage.test.ts` and zero of the seventeen negatives
   spending in-world time.

The tokenizer is hand-written WordPiece and assumes a BERT-family uncased
vocabulary. A model with a different tokenizer needs that written too, and the
tell is an accuracy figure that collapses rather than an error.
