/**
 * Sift proposed additions to the exemplar corpus before they go in.
 *
 *   npx tsx scripts/sift-proposed-verb-exemplars.ts <candidates.json>
 *
 * ── WHY A SIFT AND NOT A JUDGEMENT ────────────────────────────────────────
 *
 * `how-a-player-says-each-verb.ts` is the whole of what the intent tier knows,
 * and its header sets three rules for adding to it. Two of the three can be
 * checked by machine and one cannot:
 *
 *   short, and distinct from each other      -> checkable
 *   plain ASCII, the repo's own ban          -> checkable
 *   somebody would actually type it          -> not checkable, and stays a
 *                                               judgement somebody makes
 *
 * The published pipeline for generating intent exemplars with a model adds one
 * more step this implements: classify each generated sample with the model you
 * already have, and treat a sample that lands in a DIFFERENT class from the one
 * it was written for as noise. See the augmentation literature on filtering
 * synthetic utterances by agreement with the seed class.
 *
 * ── AND WHY THAT ONE IS A FLAG AND NOT A DROP ─────────────────────────────
 *
 * Applied strictly it would throw away the exemplars most worth having. The
 * corpus is being widened BECAUSE some sentences reach the wrong verb, so a
 * phrasing written for `ceiling` that currently sits nearest `cultivate` may be
 * the very phrasing that fixes "nothing is happening when I cultivate". Dropping
 * everything that lands next door would leave only the phrasings that change
 * nothing.
 *
 * So a cross-verb landing is reported, loudly, and the decision is made by the
 * end-to-end number in `benchmark-the-whole-deterministic-read.ts`. That is the
 * ground truth and it is cheap to run.
 *
 * The candidates file is `[{ "verb": "ceiling", "keep": ["...", "..."] }]`,
 * which is the shape the widening workflow returns.
 */

import { readFileSync } from 'node:fs';

import { HOW_A_PLAYER_SAYS_EACH_VERB } from '../src/web/how-a-player-says-each-verb.js';
import { embed, loadTheModel } from '../src/web/the-sentence-model-this-repo-carries.js';

const file = process.argv[2];
if (!file) {
    console.error('usage: sift-proposed-verb-exemplars.ts <candidates.json>');
    process.exit(1);
}

interface Candidate { verb: string; keep?: string[]; phrasings?: string[] }

const proposed = JSON.parse(readFileSync(file, 'utf-8')) as Candidate[];
const existing = HOW_A_PLAYER_SAYS_EACH_VERB as Readonly<Record<string, readonly string[]>>;

/** Cosine on unit vectors, which is what the tier itself uses. */
function cosine(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

/** Anything the repo's own bans would catch, plus the length rule. */
const NON_ASCII = /[^\x20-\x7E]/;
const TOO_LONG_IN_WORDS = 14;

await loadTheModel();

// Every exemplar already in the file, embedded once, keyed by its verb.
const known: { verb: string; said: string; vector: Float32Array }[] = [];
for (const [verb, phrasings] of Object.entries(existing)) {
    for (const said of phrasings) known.push({ verb, said, vector: await embed(said) });
}

const clean: Record<string, string[]> = {};
const dropped: string[] = [];
const flagged: string[] = [];
let seen = 0;

for (const entry of proposed) {
    const verb = entry.verb;
    const phrasings = entry.keep ?? entry.phrasings ?? [];
    if (!(verb in existing)) {
        dropped.push(`  ${verb}: NOT A VERB IN THE FILE, whole entry dropped`);
        continue;
    }
    const already = new Set((existing[verb] ?? []).map(s => s.toLowerCase().trim()));
    const takenThisRun = new Set<string>();

    for (const said of phrasings) {
        seen++;
        const trimmed = said.trim();
        const key = trimmed.toLowerCase();

        if (NON_ASCII.test(trimmed)) { dropped.push(`  ${verb}: non-ASCII  "${trimmed}"`); continue; }
        if (trimmed.split(/\s+/).length > TOO_LONG_IN_WORDS) {
            dropped.push(`  ${verb}: too long  "${trimmed}"`); continue;
        }
        if (already.has(key) || takenThisRun.has(key)) {
            dropped.push(`  ${verb}: duplicate  "${trimmed}"`); continue;
        }

        // WHERE IT LANDS AGAINST WHAT IS ALREADY THERE.
        const vector = await embed(trimmed);
        let best = known[0];
        let bestScore = -1;
        for (const row of known) {
            const score = cosine(vector, row.vector);
            if (score > bestScore) { bestScore = score; best = row; }
        }
        // A near-copy of something already in the file widens nothing.
        if (best.verb === verb && bestScore > 0.95) {
            dropped.push(`  ${verb}: says nothing new (${bestScore.toFixed(3)} from "${best.said}")  "${trimmed}"`);
            continue;
        }
        if (best.verb !== verb) {
            flagged.push(
                `  ${verb}: lands on ${best.verb} (${bestScore.toFixed(3)}, "${best.said}")  "${trimmed}"`
            );
        }

        takenThisRun.add(key);
        (clean[verb] ??= []).push(trimmed);
    }
}

const kept = Object.values(clean).reduce((n, v) => n + v.length, 0);
console.error(`considered ${seen}, kept ${kept}, dropped ${dropped.length}, flagged ${flagged.length}`);
if (dropped.length > 0) console.error(`\ndropped:\n${dropped.join('\n')}`);
if (flagged.length > 0) {
    console.error(
        `\nflagged - these land nearer another verb than their own. That is not`
        + `\nautomatically wrong: a phrasing written to FIX a confusion has to land`
        + `\nin the territory of the verb it is taking the sentence back from. The`
        + `\nend-to-end benchmark decides.\n${flagged.join('\n')}`
    );
}

// stdout is the artifact, so this pipes into the next step.
console.log(JSON.stringify(clean, null, 1));
