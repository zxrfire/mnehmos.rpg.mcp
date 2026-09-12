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
import { anActNothingAnswers } from './an-act-nothing-in-the-world-answers.js';
import { HOW_A_PLAYER_SAYS_EACH_VERB } from './how-a-player-says-each-verb.js';
import { ASKING_WHAT_IS_POSSIBLE } from './what-is-worth-doing-standing-here.js';
import { theSentenceIsNothingButAPointer } from './last-turn-memory.js';
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
/**
 * HOW SURE THE TIER HAS TO BE, and neither half of it works alone.
 *
 * Three sentences were each patched individually before this - "I nod" reaching
 * `oath`, "I step back" reaching `descend`, "who are you" reaching `status` -
 * and patching the next one was not going to end. Measured over sentences whose
 * right answer is known, top score and how far clear of the runner-up:
 *
 *   I want to get stronger    cultivate 0.904  clear 0.177   right
 *   I have no food            eat       0.796  clear 0.106   right
 *   I need money              work      0.862  clear 0.083   right
 *   I have nothing left to sell market  0.750  clear 0.041   right
 *   how far will what I know take me
 *                             ceiling   0.809  clear 0.035   right
 *   ------------------------------------------------------------------
 *   I step back               descend   0.766  clear 0.031   wrong
 *   I am broke                petition  0.742  clear 0.029   wrong
 *   I nod                     posture   0.732  clear 0.022   wrong
 *   I stand up                posture   0.809  clear 0.018   wrong
 *   what is stopping me       seclude   0.684  clear 0.002   wrong
 *
 * NO FLOOR SEPARATES THESE: "I stand up" outscores "I have no food" and is
 * junk. NO DAYLIGHT FIGURE SEPARATES THEM EITHER: the ceiling sentence is clear
 * by 0.035 and "I step back" by 0.031. Only the two together do, which is the
 * honest reading of what they mean - a score says how good the match looks, and
 * the daylight says whether the model actually preferred it to anything else.
 *
 * `CLEAR_AIR_COUNTS_FOR` is what one point of daylight is worth against one
 * point of score. THE MARGIN IS THIN - 0.873 for the last right answer against
 * 0.863 for the first wrong one - and it is recorded rather than smoothed over,
 * because ten sentences is a small sample and the next person to move this
 * number should know how little room there is. The bias when it is wrong is
 * deliberate: this is the tier that runs with NO MODEL, it is expected to be
 * worse, and a refusal here costs a player one retyped sentence while a
 * confident wrong verb costs them a turn and sometimes a life.
 */
const CLEAR_AIR_COUNTS_FOR = 3;
const SURE_ENOUGH_TO_ACT_ON = 0.87;

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
 * WHO THE SENTENCE IS ABOUT, WHICH THE VECTOR CANNOT SEE.
 *
 * "who am i" and "who are you" are the same sentence to a sentence model: they
 * differ by one function word, function words carry almost no weight, and the
 * word is the entire meaning. Measured: `who are you`, addressed to somebody
 * standing in front of the player, came back as `status` - the game answering a
 * question about a stranger by printing the player's own character sheet.
 *
 * That is not a bad exemplar and it is not a threshold that needs raising. It is
 * a distinction the model is structurally unable to draw, so it has to be drawn
 * outside it: an act that only anybody performs ON THEMSELVES cannot answer a
 * sentence about somebody else, whatever it scores.
 *
 * Derived from the corpus rather than listed. An action counts as self-directed
 * when EVERY exemplar written for it is about the speaker, so `status`,
 * `inventory` and `ceiling` are covered without being named here, and a verb
 * added tomorrow is classified by the sentences its author wrote for it.
 */
const ABOUT_THE_SPEAKER = /\b(?:i|me|my|myself|mine)\b/i;
const ABOUT_SOMEBODY_ELSE = /\b(?:you|your|yours|he|him|his|she|her|hers|they|them|their|theirs)\b/i;

/** Actions every exemplar of which is the speaker asking about themselves. */
const ONLY_EVER_ABOUT_YOURSELF: ReadonlySet<string> = new Set(
    Object.entries(HOW_A_PLAYER_SAYS_EACH_VERB)
        .filter(([, phrasings]) => {
            const said = phrasings as readonly string[];
            return said.length > 0 && said.every(one =>
                ABOUT_THE_SPEAKER.test(one) && !ABOUT_SOMEBODY_ELSE.test(one));
        })
        .map(([action]) => action)
);



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
 * The verb both candidates settle to, when they settle to the same one.
 *
 * Null unless: there is a runner-up, both clear the ordinary floor, the two
 * settle to one verb under `theReadThatAnswersIt`, and that verb spends no
 * in-world time. See the call site for the finding and why it is not a lower
 * bar.
 */
function theSameAnswerTwice(nearest: NearestVerb): ActionName | null {
    if (nearest.runnerUp === null) return null;
    if (nearest.runnerUpScore < ACCEPT_AT) return null;

    const settled = theReadThatAnswersIt({ action: nearest.action }).action;
    if (settled !== theReadThatAnswersIt({ action: nearest.runnerUp }).action) return null;

    // A read, by construction - but asserted rather than assumed, because this
    // is the one path that acts on a score the daylight rule rejected.
    if ((TIME_CONSUMING_ACTIONS as readonly ActionName[]).includes(settled)) return null;
    return settled;
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

    // ── A POINTER HAS NO MEANING OF ITS OWN TO BE NEAR ANYTHING ──────────
    //
    // `saysSomething` reads the sentence for content words and lets these
    // through: `one`, `that` and `it` are on its list and `take` and `first`
    // are not. So `I take the first one`, one turn after a wall read, was
    // answered by the nearest verb in the space - measured as `consume_pill`,
    // which swallows something.
    //
    // What the sentence points AT is in the turn before it, which this tier
    // has no access to and no business guessing at. Declining hands it to
    // `theSentenceIsNothingButAPointer` at the turn layer, where the listing
    // is, and turns a guess by embedding distance into a lookup.
    if (theSentenceIsNothingButAPointer(input) !== null) return fromTable;

    // ── AN ACT PERFORMED ALONE HAS NO VERB TO BE NEAR ────────────────────
    //
    // Every exemplar in the corpus is somebody acting on the world, so a
    // sentence about nothing but the speaker's own body still lands on one of
    // them. Measured: `I stretch` reached `market` - millet and ferry fares for
    // somebody stretching - and `I say a prayer` reached `interact`/`talk`, a
    // person spoken to who was never named.
    //
    // The turn layer answers these at `case 'unclear'`, and the answer is that
    // the act was taken and nothing followed. Handing them to the nearest verb
    // instead is the one way that answer can be lost.
    if (anActNothingAnswers(input) !== null) return fromTable;

    const nearest = await nearestVerbByMeaning(input);
    if (nearest === null) return fromTable;

    // A THING YOU DO TO YOURSELF CANNOT ANSWER A SENTENCE ABOUT SOMEBODY ELSE.
    if (ONLY_EVER_ABOUT_YOURSELF.has(nearest.action)
        && ABOUT_SOMEBODY_ELSE.test(input)) return fromTable;

    const spendsTime = (TIME_CONSUMING_ACTIONS as readonly ActionName[]).includes(nearest.action);
    if (nearest.score < (spendsTime ? ACCEPT_TIME_SPENDING_AT : ACCEPT_AT)) return fromTable;
    const sure = nearest.score
        + CLEAR_AIR_COUNTS_FOR * (nearest.score - nearest.runnerUpScore);

    // ── AND SOMETIMES THE TWO CANDIDATES ARE ONE ANSWER ──────────────────
    //
    // FOUND BY PLAYING BLIND. `what techniques do i know`, on a cultivator
    // holding one manual, was answered with *"You turn the thought over and it
    // does not resolve into anything you could actually do standing here"* -
    // and then with a list of the people in the square, which is not what was
    // asked about at all. `what arts do i know` answers it.
    //
    // The measurement says why, and it is not that the tier had never met the
    // word:
    //
    //   what techniques do i know    list_techniques 0.835   learn_technique 0.831
    //
    // Two candidates four thousandths apart, so the daylight rule declined -
    // correctly, by its own terms, because the model did not prefer one. But
    // `theReadThatAnswersIt` already maps `learn_technique` to
    // `list_techniques`: the runner-up IS the winner once the engine's own
    // asking-is-not-doing rule has run on it. There was never a choice to make,
    // and the tier refused over an ambiguity that does not exist.
    //
    // WHAT KEEPS THIS FROM BEING A LOWER BAR. The answer taken is the READ both
    // verbs settle to, never the winner: two verbs that collapse the same way
    // do so BECAUSE one of them is a free read of the other, and it is the free
    // half that is unambiguous. So a sentence that is genuinely torn between
    // `learn_technique` and `list_techniques` gets the listing - it costs
    // nothing, names what the learning would take, and the next sentence
    // commits. Nothing here can reach a verb that spends.
    if (sure < SURE_ENOUGH_TO_ACT_ON) {
        const settled = theSameAnswerTwice(nearest);
        if (settled === null) return fromTable;
        return { action: settled };
    }

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
