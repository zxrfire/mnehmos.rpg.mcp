/**
 * The last tier of intent reading: a sentence nobody wrote a pattern for.
 *
 * `parseIntent` in `actions.ts` is a table of regular expressions, and a table
 * only reaches the phrasings somebody thought to write down. Measured over 168
 * ordinary player sentences - written as a person types them, before any of
 * this existed - the table reached the intended verb 69 times. 81 of the
 * remaining 99 reached nothing at all: the player was told the sentence did not
 * resolve into anything, and lost the turn, for saying "I need money" instead
 * of "I look for work".
 *
 * That is what makes Local Mode feel like typing console commands at a state
 * machine rather than talking to a world, and it is the gap this closes.
 *
 * ── HOW ──────────────────────────────────────────────────────────────────
 *
 * A sentence model, vendored into this repository and run in this process, puts
 * the player's sentence and every exemplar in `how-a-player-says-each-verb.ts`
 * into the same space, and the nearest verb wins. The comparison is on MEANING:
 * "I need money" and "I look for work" share one short word and sit next to
 * each other, which is the class of sentence neither a regular expression nor a
 * bag of character n-grams can reach. An earlier build of this tier did exactly
 * that - hashed n-grams, no model - and it is worth knowing what that ceiling
 * looked like, because it is the honest baseline this is measured against:
 * 79.2% of the probe set, 73.8% on the half no threshold was fitted to.
 *
 * ── NO NETWORK, OF ANY KIND ──────────────────────────────────────────────
 *
 * Not the internet, not a loopback address, not a sidecar on the same machine.
 * The weights are a file in this repository and the arithmetic happens here.
 * See `the-sentence-model-this-repo-carries.ts` for why the model is assembled
 * by hand rather than taken from a library: a library with a hub client in it
 * is a thing that has to be configured shut, correctly, forever, and this has
 * no network path to disable in the first place.
 *
 * ── WHERE IT SITS, AND WHAT IT MAY NOT DO ────────────────────────────────
 *
 * Strictly below the pattern table and below the spelling repair, and it only
 * ever runs on a sentence that reached `unclear`. So a sentence the table
 * already reads keeps the verb it already got, byte for byte - the same safety
 * property the spelling repair holds, for the same reason: a fallback that can
 * move a working parse is not a fallback, it is a second parser.
 *
 * It chooses A VERB AND NOTHING ELSE. It never names a person, a place, an art
 * or an item, because a guessed target sends the engine looking for an object
 * that does not exist, and a refusal that names what would work is worth more
 * than a confident wrong answer. The one thing it carries across is a span of
 * time, and only through `durationAskedFor`, which is the engine's own reader.
 *
 * And it declines. Below the acceptance floor, or without enough daylight over
 * the runner-up, it returns the table's refusal and the player gets the
 * ordinary "say what you mean" answer with the live options under it. Guessing
 * wrongly is worse than not guessing: a wrong verb spends a turn and can spend
 * days.
 *
 * ── IT THROWS RATHER THAN DEGRADING ──────────────────────────────────────
 *
 * A fallback is for something outside your control. A file in this repository
 * is not that: if the weights or the vectors will not load, the build or the
 * checkout is broken, and a quieter mode that silently reads sentences worse is
 * strictly harder to notice than an error. Somebody would find out when a
 * sentence that used to work stopped working, which is the worst way to find
 * out anything.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
    ASKING_RATHER_THAN_DOING,
    FALLBACK_ACTION,
    TIMED_ACTIONS,
    TIME_CONSUMING_ACTIONS,
    durationAskedFor,
    theReadThatAnswersIt,
    type ActionName,
    type PlannedAction
} from './actions.js';
import { HOW_A_PLAYER_SAYS_EACH_VERB } from './how-a-player-says-each-verb.js';
import { ASKING_WHAT_IS_POSSIBLE } from './what-is-worth-doing-standing-here.js';
import {
    MODEL_DIRECTORY,
    embed,
    loadTheModel,
    modelsDirectory,
    similarity
} from './the-sentence-model-this-repo-carries.js';

/**
 * How near the nearest verb has to be, and how far clear of the second.
 *
 * Both fitted on half of a probe set of ordinary sentences and checked on the
 * other half, so the figures are not read off the run they are quoted from.
 * They are deliberately not generous: this tier answers a player who would
 * otherwise have been told nothing, and the cost of guessing wrong is a spent
 * turn, which is worse than the refusal it replaces.
 *
 * The numbers are much higher than the hashed build's 0.24 because a sentence
 * model puts everything in a narrower cone - two unrelated English sentences
 * still score around 0.5 against each other - so the floor is a floor on
 * MEANING THE SAME THING rather than on sharing words.
 */
const ACCEPT_AT = 0.70;
const CLEAR_OF_RUNNER_UP_BY = 0.01;

/**
 * A HIGHER BAR FOR ANYTHING THAT SPENDS THE PLAYER'S LIFE.
 *
 * A guess that lands on `market` costs a sentence. A guess that lands on
 * `seclude` costs years that do not come back, and `misparse.test.ts` exists
 * because a sentence about nothing once resolved to three months of sitting
 * still and killed a run. Different costs, different bars.
 *
 * RE-DERIVED FOR THE MODEL RATHER THAN CARRIED OVER. The hashed build needed a
 * structural rule here - a time-spending verb had to be named by two words the
 * corpus found rare - because character n-grams could not tell "I let it lie
 * for a decade and see" from an intention to sit in a cave; the shared words
 * were the clock. The model can, and the rule collapses to a number. Measured
 * over that file's seventeen unrecognised sentences, at the shipping floor:
 * a single bar of 0.70 lets four of them through onto a verb that spends
 * in-world time, and 0.76 lets none. The two-word rule is gone.
 */
const ACCEPT_TIME_SPENDING_AT = 0.76;

/**
 * A SENTENCE THAT NAMES NOTHING CANNOT MEAN SOMETHING.
 *
 * "I do the thing with the thing" reached `sell` at a score over the floor,
 * and it deserved to on the model's own terms: it is a well-formed English
 * sentence about a transaction-shaped event, and the vector says so. What it
 * is not is a sentence about anything. Every word in it is a function word or
 * a placeholder, so whatever it matched, it matched on shape.
 *
 * This is the one guard the score cannot supply, because the score measures
 * resemblance and resemblance is exactly what a contentless sentence has. It
 * is deliberately narrow: a single word outside this list satisfies it, so
 * "I do the thing with the sword" is content and passes to the ordinary bars.
 *
 * It replaces nothing. The floors still do the work on sentences that say
 * something and say it badly.
 */
const SAYS_NOTHING = new Set([
    'i', 'me', 'my', 'myself', 'we', 'us', 'our', 'you', 'your', 'it', 'its',
    'a', 'an', 'the', 'this', 'that', 'these', 'those',
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'doing', 'done',
    'go', 'goes', 'going', 'went', 'get', 'gets', 'getting', 'got',
    'have', 'has', 'had', 'having',
    'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must',
    'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'about',
    'and', 'or', 'but', 'so', 'then', 'than', 'as', 'if',
    'here', 'there', 'now', 'again', 'some', 'any', 'all', 'more', 'other',
    'thing', 'things', 'stuff', 'something', 'anything', 'nothing',
    'one', 'ones', 'bit', 'lot', 'way', 'ways',
    'up', 'down', 'out', 'over', 'off', 'around', 'through',
    'not', 'no', 'yes', 'ok', 'okay', 'please', 'just', 'really', 'very'
]);

/** Whether the sentence has a single word in it that is about anything. */
function saysSomething(input: string): boolean {
    for (const word of input.toLowerCase().match(/[a-z']+/g) ?? []) {
        if (!SAYS_NOTHING.has(word)) return true;
    }
    return false;
}

/**
 * What the corpus was when its vectors were computed.
 *
 * The vectors are built by `npm run verbs:embed` and committed beside the
 * weights, because embedding 232 exemplars at load costs seconds and this tier
 * has to be instant. That makes them a derived artifact, and a derived artifact
 * that nothing checks is a derived artifact that goes stale: somebody adds a
 * phrasing, the file on disk still holds the old ones, and the tier answers as
 * though the edit never happened. So the corpus is hashed into the file and
 * checked on load, and a mismatch is an error naming the command that fixes it.
 */
interface VerbVectorFile {
    readonly model: string;
    readonly width: number;
    readonly corpusHash: string;
    readonly rows: readonly { readonly action: ActionName; readonly count: number }[];
}

export function corpusFingerprint(): string {
    const hash = createHash('sha256');
    for (const [action, phrasings] of Object.entries(HOW_A_PLAYER_SAYS_EACH_VERB)) {
        hash.update(action);
        for (const phrasing of phrasings as readonly string[]) hash.update('\0').update(phrasing);
    }
    return hash.digest('hex').slice(0, 32);
}

export function verbVectorPaths(directory: string = MODEL_DIRECTORY): { index: string; vectors: string } {
    return {
        index: join(modelsDirectory(), directory, 'verb-corpus.json'),
        vectors: join(modelsDirectory(), directory, 'verb-corpus.f32')
    };
}

interface VerbIndex {
    readonly action: ActionName;
    readonly exemplars: readonly Float32Array[];
}

let index: readonly VerbIndex[] | null = null;
let loading: Promise<void> | null = null;

/**
 * Open the model and read the exemplar vectors. Paid once per process.
 *
 * Idempotent and safe to call concurrently: the first caller does the work and
 * everybody else waits on the same promise, so two turns arriving together do
 * not open the graph twice.
 */
export async function readyTheTier(directory: string = MODEL_DIRECTORY): Promise<void> {
    if (index !== null) return;
    if (loading !== null) return loading;
    loading = (async () => {
        await loadTheModel(directory);
        const paths = verbVectorPaths(directory);

        let manifest: VerbVectorFile;
        try {
            manifest = JSON.parse(readFileSync(paths.index, 'utf8')) as VerbVectorFile;
        } catch (err) {
            throw new Error(
                `The verb corpus vectors are missing at ${paths.index}. `
                + 'Run `npm run verbs:embed` to build them. '
                + `(${err instanceof Error ? err.message : String(err)})`
            );
        }

        const expected = corpusFingerprint();
        if (manifest.corpusHash !== expected) {
            throw new Error(
                'The verb corpus has changed since its vectors were built '
                + `(file ${manifest.corpusHash}, corpus ${expected}). `
                + 'Run `npm run verbs:embed`.'
            );
        }

        const raw = readFileSync(paths.vectors);
        const floats = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
        const built: VerbIndex[] = [];
        let offset = 0;
        for (const row of manifest.rows) {
            const exemplars: Float32Array[] = [];
            for (let i = 0; i < row.count; i++) {
                exemplars.push(floats.slice(offset, offset + manifest.width));
                offset += manifest.width;
            }
            built.push({ action: row.action, exemplars });
        }
        index = built;
    })();

    try {
        await loading;
    } finally {
        loading = null;
    }
}

export interface NearestVerb {
    readonly action: ActionName;
    readonly score: number;
    /** The second-placed verb and its score, for logs and for tuning. */
    readonly runnerUp: ActionName | null;
    readonly runnerUpScore: number;
}

/**
 * The verb this sentence means, or null when nothing is near enough.
 *
 * The nearest single exemplar decides it, and nothing is averaged. A centroid
 * was tried and is worse here: with a real model each exemplar is already a
 * point in meaning-space, so a verb covering two different situations - buying
 * a book and buying a night at an inn - has a centroid sitting between them
 * that is neither.
 */
export async function nearestVerbByMeaning(input: string): Promise<NearestVerb | null> {
    if (index === null) await readyTheTier();
    const verbs = index;
    if (verbs === null) return null;

    const query = await embed(input);

    let best: { action: ActionName; score: number } | null = null;
    let second: { action: ActionName; score: number } | null = null;

    for (const verb of verbs) {
        let nearest = -1;
        for (const exemplar of verb.exemplars) {
            const score = similarity(query, exemplar);
            if (score > nearest) nearest = score;
        }
        if (best === null || nearest > best.score) {
            second = best;
            best = { action: verb.action, score: nearest };
        } else if (second === null || nearest > second.score) {
            second = { action: verb.action, score: nearest };
        }
    }

    if (best === null) return null;
    return {
        action: best.action,
        score: best.score,
        runnerUp: second?.action ?? null,
        runnerUpScore: second?.score ?? 0
    };
}

/**
 * SOME OF WHAT REACHES `unclear` GOT THERE ON PURPOSE.
 *
 * The safety property above - "it only ever runs on a sentence that reached
 * `unclear`" - rests on `unclear` meaning THE TABLE DECLINED. For one family of
 * sentences it does not: `ASKING_WHAT_IS_POSSIBLE` is somebody stepping outside
 * the fiction to ask what there is to do, `game.ts` answers it at
 * `case 'unclear'` with the live-affordances read, and the table returning
 * `unclear` is how that answer is reached rather than a failure to reach one.
 *
 * Found by playing, and the shape of it is the whole argument. Nine ways of
 * asking the single most universal question in text games, all nine matched by
 * `ASKING_WHAT_IS_POSSIBLE`, and the tier sent six of them somewhere else:
 *
 *   "what can I do here"     -> market       43 lines of millet and ferry fares
 *   "what can be done here"  -> market       the same
 *   "what can I do"          -> work
 *   "what now"               -> look
 *   "what next"              -> destinations
 *   "what is there to do"    -> look
 *   "help"                       "what is live for you here", and the reasons
 *   "what is there to do here"   the same
 *   "I don't know what to do"    the same
 *
 * Three phrasings got the surface written for the question and six got a
 * plausible-looking answer to a different one, on a difference of two words. A
 * new player cannot tell those apart from a game that has no such surface.
 */
export function theTableMeantIt(input: string): boolean {
    return ASKING_WHAT_IS_POSSIBLE.test(input);
}

/**
 * The plan for a sentence the table could not read, or the refusal unchanged.
 *
 * `fromTable` is passed in rather than recomputed so this can never disagree
 * with what the table decided: it is returned untouched, as the same object,
 * unless the table itself said `unclear`.
 */
export async function verbForASentenceThePatternsMissed(
    input: string,
    fromTable: PlannedAction
): Promise<PlannedAction> {
    if (fromTable.action !== FALLBACK_ACTION) return fromTable;

    if (theTableMeantIt(input)) return fromTable;

    if (!saysSomething(input)) return fromTable;

    const nearest = await nearestVerbByMeaning(input);
    if (nearest === null) return fromTable;

    const spendsTime = (TIME_CONSUMING_ACTIONS as readonly ActionName[]).includes(nearest.action);
    if (nearest.score < (spendsTime ? ACCEPT_TIME_SPENDING_AT : ACCEPT_AT)) return fromTable;
    if (nearest.score - nearest.runnerUpScore < CLEAR_OF_RUNNER_UP_BY) return fromTable;

    const plan: PlannedAction = { action: nearest.action };

    // The one fact carried across from the sentence, and it is read by the
    // engine's own parser rather than by anything here. A verb that spends time
    // and is handed no span silently spends the default instead of the year the
    // player asked for, which is the sort of quiet substitution this build does
    // not do anywhere else.
    if ((TIMED_ACTIONS as readonly ActionName[]).includes(nearest.action)) {
        const days = durationAskedFor(input);
        if (days !== null) plan.days = Math.max(1, Math.round(days));
    }

    // ── AND THE MOOD IS DECIDED ON THE SENTENCE, NOT ON THE TABLE ────────
    //
    // A QUESTION ABOUT AN ACTION IS NOT THE ACTION. `readTheSentence` in
    // `actions.ts` states that as a post-pass over the whole sentence and says
    // why it is a post-pass: "a verb added tomorrow is covered without its
    // author having to know this rule exists". This tier chooses a verb AFTER
    // that pass has run, so it was the one verb in the game the rule did not
    // cover - and it reopened, one door over, exactly the defect
    // `asking-is-not-doing.test.ts` was written about.
    //
    // Measured on a fresh nobody, deterministic reader, no model:
    //
    //   "check my injuries"           -> treat         days and stones, spent
    //   "is there work here"          -> work          days, spent
    //   "how do I leave"              -> move          a journey, begun
    //   "can I leave"                 -> move          the same
    //   "should I leave"              -> move          the same
    //   "what happens if I leave"     -> move          the same
    //   "what would a breakthrough take" -> breakthrough   a roll that cripples
    //   "what would it take to heal"  -> sect
    //
    // The last two are the sharpest. A breakthrough can end a run, and the
    // player asked what one would take; the table refuses that phrasing by
    // name and the tier performed it. Running the tier's guess through the same
    // post-pass makes the rule complete again, and costs the phrasings that
    // command a verb nothing at all - `ASKING_RATHER_THAN_DOING` requires the
    // first person beside a modal, or an explicit "how do I".
    return ASKING_RATHER_THAN_DOING.test(input.toLowerCase())
        ? theReadThatAnswersIt(plan)
        : plan;
}
