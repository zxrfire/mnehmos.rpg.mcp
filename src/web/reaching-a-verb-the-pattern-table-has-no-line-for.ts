/**
 * The last tier of intent reading: a sentence nobody wrote a pattern for.
 *
 * `parseIntent` in `actions.ts` is a table of regular expressions, and a table
 * only reaches the phrasings somebody thought to write down. Measured over 168
 * ordinary player sentences - written as a person would type them, before this
 * module existed - the table reached the intended verb 69 times. 81 of the
 * remaining 99 reached nothing at all: the player was told the sentence did not
 * resolve into anything, and lost the turn, for saying "I need money" instead
 * of "I look for work".
 *
 * That is what makes Local Mode feel like typing console commands at a state
 * machine rather than talking to a world, and it is the gap this closes. With
 * this tier under the table the same 168 sentences reach 133, and on the half
 * of them no threshold here was fitted against, 36 becomes 62. The 208
 * phrasings `coverage.test.ts` already reaches are unchanged, all 208.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────
 *
 * A text embedding, built here, with no dependency and no network call. Every
 * sentence - the player's, and a corpus of exemplar phrasings carried below -
 * becomes a fixed-length numeric vector; the player's sentence is answered with
 * the verb whose exemplars it points nearest to. Nothing is downloaded, nothing
 * is trained at run time, nothing is random, and the whole of it is arithmetic
 * over the string the player typed.
 *
 * The vector is a signed hashing of four kinds of feature - words, crude stems,
 * adjacent word pairs, and character four-grams inside each word - each scaled
 * by how rare it is across the corpus, then normalised to unit length. The
 * character grams are what make it robust to morphology and to a slip of the
 * fingers: `cultivating`, `cultivate` and `cultivat` share most of theirs.
 *
 * ── WHY NOT A NEURAL EMBEDDING ───────────────────────────────────────────
 *
 * A sentence-transformer would read further - it would put "I need money" near
 * "I look for work" through meaning rather than through shared letters. It also
 * costs a runtime and a weights file measured in tens of megabytes, fetched
 * from somewhere, in a mode whose entire claim is that it works with nothing
 * behind it. This is the largest thing that fits in that claim: zero bytes of
 * dependency, and the corpus below is the whole of its weights.
 *
 * Where it falls short is stated rather than hidden: two sentences that mean
 * the same thing in completely different words are not near each other here.
 * The corpus is what covers that, and it is meant to be added to - a phrasing
 * a player used that landed nowhere belongs in it.
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
 * the runner-up, it returns null and the player gets the ordinary "say what you
 * mean" refusal with the live options under it. Guessing wrongly is worse than
 * not guessing: a wrong verb spends a turn and can spend days.
 */

import {
    FALLBACK_ACTION,
    TIMED_ACTIONS,
    TIME_CONSUMING_ACTIONS,
    durationAskedFor,
    type ActionName,
    type PlannedAction
} from './actions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE CORPUS
//
// How a player says each verb, in their own words. Written from what the verb
// is for rather than from what the pattern table happens to contain: an
// exemplar copied off a regex teaches this nothing the regex did not already
// know.
//
// Two rules for adding to it:
//
//   - A phrasing goes in because somebody would type it, not because it makes
//     a number go up. This is the corpus AND the weights; there is nowhere
//     else for a bias to hide.
//   - Keep them short and keep them distinct from each other. Five sentences
//     that differ only in one noun narrow the verb rather than widening it.
//
// `unclear` has no exemplars and never can: it is the answer when nothing here
// is near enough.
// ─────────────────────────────────────────────────────────────────────────

const CORPUS: Readonly<Record<Exclude<ActionName, 'unclear'>, readonly string[]>> = {
    interact: [
        'I speak to the woman by the well',
        'I want a word with him',
        'let me talk with the ferryman',
        'I go and introduce myself',
        'I get into conversation with the stallholder',
        'I try to make an acquaintance here',
        'I greet the man at the gate'
    ],
    investigate: [
        'I take a close look at the stone',
        'I examine the carving on the wall',
        'I want to know what that writing says',
        'I search through what is lying here',
        'I study the door for a while',
        'I poke about and see what I can find out',
        'there is something strange here and I want to understand it'
    ],
    move: [
        'I set out for the next town',
        'I travel to the mountain',
        'I leave this place and go elsewhere',
        'I take the road out of here',
        'I want to be somewhere else by evening',
        'I walk to the ford',
        'time to move on from this town',
        'I head for the peaks'
    ],
    attack: [
        'I strike at him',
        'I draw my blade and go for the man',
        'I attack the bandit',
        'I start a fight with him',
        'I mean to kill the thief',
        'I put a sword through him',
        'no more talking, I hit him'
    ],
    cultivate: [
        'I sit down and cultivate',
        'I circulate my qi for a while',
        'I spend some months breathing and refining',
        'I put in real practice at the method',
        'I want to build up my cultivation',
        'I meditate and take in the qi here',
        'I want to grow stronger by training',
        'I settle in and work at it for a year'
    ],
    seclude: [
        'I go into closed door cultivation',
        'I shut myself away and do not come out',
        'I seal myself in a cave for years',
        'nobody is to see me for a decade',
        'I retreat from the world entirely for a stretch'
    ],
    breakthrough: [
        'I attempt the breakthrough',
        'I try to break through to the next rank',
        'I push against the bottleneck',
        'I think I am ready to climb a rung',
        'I force my way up to the next layer',
        'I want to advance to the next stage'
    ],
    train_technique: [
        'I drill the palm art until it is smooth',
        'I practise the sword form',
        'I put hours into the technique I know',
        'I want to sharpen the art I already have',
        'I work at the method until it is better'
    ],
    refine: [
        'I refine a pill',
        'I make medicine at the furnace',
        'I brew something out of these herbs',
        'I want to try alchemy with what I have',
        'I cook a healing pill'
    ],
    gather: [
        'I go out and pick herbs',
        'I forage on the hillside',
        'I collect what grows out there',
        'I look for medicinal plants in the woods',
        'I go harvesting for anything useful'
    ],
    hunt: [
        'I hunt a spirit beast',
        'I go out after a beast worth killing',
        'I track something down for its core',
        'I take a spear into the hills after game',
        'I want to bring down a beast'
    ],
    eat: [
        'I eat something',
        'I have a meal',
        'I break out the rations and eat',
        'I am hungry and want food',
        'I get some food in me'
    ],
    provision: [
        'I buy provisions for the road',
        'I stock up on rations before sitting down',
        'I lay in enough food to last',
        'I need supplies for a long stretch',
        'I get grain in for the year'
    ],
    treat: [
        'I see a physician about my wounds',
        'I get my injuries treated',
        'I want these meridians seen to',
        'I find someone to close these wounds',
        'I go for care for what is torn'
    ],
    buy: [
        'I buy the manual',
        'I pay for the book',
        'I hand over the stones for it',
        'I purchase what he is selling',
        'I would like to take that off him for the price',
        'I want to buy a night at the inn'
    ],
    sell: [
        'I sell the sabre',
        'I want stones for what I am carrying',
        'I offer the pill for sale',
        'I part with it for whatever it fetches',
        'what would anybody pay me for this'
    ],
    inventory: [
        'what am I carrying',
        'what is in my pack',
        'let me see my belongings',
        'check the pouch',
        'what things do I have on me'
    ],
    consume_pill: [
        'I swallow the pill',
        'I take the medicine',
        'I use the elixir I am carrying',
        'I down the healing pill'
    ],
    list_techniques: [
        'what arts do I know',
        'which methods am I practising',
        'remind me what I have learned',
        'list the techniques I hold',
        'what have I actually been taught'
    ],
    learn_technique: [
        'I learn the art from the manual',
        'I take up the method in this book',
        'I study the canon properly',
        'I read the manual and commit it',
        'I want to pick up a new art'
    ],
    acquisition: [
        'how does somebody like me get hold of a manual',
        'what are the ways to come by an art',
        'where would I even find a book at all',
        'how do people without money get taught',
        'what are my options for getting a method'
    ],
    ceiling: [
        'how far will this method carry me',
        'is there a limit to what I know',
        'what is the highest this art goes',
        'where does what I am practising run out',
        'can this canon take me past the next realm'
    ],
    teacher: [
        'who would teach me',
        'is there anybody who would take me on',
        'I need a master',
        'who around here could show me anything',
        'I want somebody to study under',
        'is there a teacher for someone like me'
    ],
    destinations: [
        'where could I go from here',
        'what places are within reach',
        'what is near this town',
        'where else could I be',
        'what other ground is there'
    ],
    roads: [
        'how do I get to the mountain from here',
        'which way does the road run',
        'what is the route out of this place',
        'what road takes me there',
        'how far is it and by which way'
    ],
    // Deliberately none of these is a shrug. "I do nothing for a while" and
    // "I give it a month and see" were exemplars here and had to go: they are
    // word for word how somebody types a non-answer, so waiting became the
    // verb that swallowed every sentence that meant nothing, and a non-answer
    // that spends in-world time is the exact failure `misparse.test.ts` was
    // written for. An exemplar has to be an intention, not a mood.
    wait: [
        'I wait here',
        'I wait and see what happens',
        'I bide my time',
        'I stay put rather than act',
        'I pass the time until something changes'
    ],
    work: [
        'I look for work',
        'I need money and will take a job',
        'is there anything here I can do for pay',
        'I hire myself out for a season',
        'I take whatever labour is going'
    ],
    market: [
        'what is for sale here',
        'is anybody selling anything',
        'show me the stalls',
        'what can I get in this place',
        'what does this town have to trade'
    ],
    sect: [
        'what sects are there',
        'which houses take people',
        'I want to join a sect',
        'tell me about the houses near here',
        'can I sign on with one of them',
        'what would it take to be admitted'
    ],
    site: [
        'what ruins are there around here',
        'is there anything worth digging into nearby',
        'I go and look at the old gate',
        'I want to get inside the sealed place',
        'what old ground is there to search'
    ],
    legacy: [
        'I want to leave something behind for whoever comes after',
        'who gets my things when I die',
        'I set down what is to happen to what I hold',
        'I put my affairs in order before the end',
        'I leave an inheritance'
    ],
    petition: [
        'I put my case to the elders',
        'I take it up the chain to somebody who matters',
        'I ask the house for what I am owed',
        'I petition for a grant',
        'I want this heard higher up'
    ],
    posture: [
        'I make it plain I am not to be pushed',
        'I stand my ground where they can see it',
        'I declare where we stand',
        'I show strength so it is understood',
        'I set the terms between us openly'
    ],
    seal: [
        'I seal it shut',
        'I close the gate behind me and ward it',
        'I want to read what the seal says',
        'I try to wake what is sealed in there',
        'I put a seal on this place'
    ],
    offer: [
        'I make an offering',
        'I put something on the table in exchange',
        'I propose a trade to him',
        'I offer what I have for it',
        'I send an offering up'
    ],
    descend: [
        'I come back down',
        'I go down from up there',
        'I return to the ground below',
        'I step down off it',
        'I make the descent'
    ],
    look: [
        'I look around',
        'what does this place look like',
        'I take in my surroundings',
        'what is going on here',
        'I have a look about me',
        'what can I see from here'
    ],
    status: [
        'where do I stand',
        'how am I doing',
        'what am I',
        'tell me about myself',
        'what shape am I in',
        'what is my rank and condition'
    ],
    assess: [
        'how strong is he next to me',
        'could I take him in a fight',
        'I size the man up',
        'what is he worth against me',
        'I weigh up whether I would win'
    ],
    recall: [
        'what do I know about all this',
        'who have I heard of so far',
        'what have I worked out',
        'what is in my head about this',
        'what understanding have I come to'
    ],
    recognise: [
        'whose art is that',
        'do I know what school that comes from',
        'I have seen that form somewhere before',
        'is that their house style',
        'can I place the method he is using'
    ],
    news: [
        'what are people saying',
        'any word from elsewhere',
        'what is the talk here',
        'has anything happened in the world',
        'what rumours are going about'
    ],
    request: [
        'I ask him to teach me',
        'I beg her to take me as a disciple',
        'I ask him for the manual',
        'I want him to put in a word for me',
        'I ask her to let me into the house'
    ]
};

// ─────────────────────────────────────────────────────────────────────────
// THE VECTORS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Vector width. Wide enough that hash collisions between the corpus's few
 * thousand features are rare, small enough that the whole index is a few
 * hundred kilobytes of doubles held once for the life of the process.
 */
const DIMENSIONS = 2048;

/** Feature weights before rarity scaling. A whole word says more than a gram of one. */
const WEIGHT_WORD = 1;
const WEIGHT_STEM = 0.7;
const WEIGHT_PAIR = 0.55;
const WEIGHT_GRAM = 0.3;

/** Character n-gram width inside a padded word. */
const GRAM = 4;

/**
 * How near the best verb has to be, and how far clear of the second.
 *
 * Fitted on half of a probe set of ordinary sentences and checked on the other
 * half, so the figures are not read off the run they are quoted from. They are
 * deliberately not generous: this tier answers a player who would otherwise
 * have been told nothing, and the cost of guessing wrong is a spent turn, which
 * is worse than the refusal it replaces.
 */
const ACCEPT_AT = 0.24;
const CLEAR_OF_RUNNER_UP_BY = 0.02;

/**
 * WHAT A VERB THAT SPENDS THE PLAYER'S LIFE HAS TO BE NAMED BY.
 *
 * One rare word the verb owns is enough to be answered with the price board. It
 * is not enough to be put in a cave for a decade. A guess that lands on
 * `market` costs a sentence; a guess that lands on `seclude` costs years that
 * do not come back, and `misparse.test.ts` exists because a sentence about
 * nothing once resolved to three months of sitting still and killed a run.
 *
 * So the asymmetry is in the evidence required, not in the score. Measured
 * against that file's own seventeen unrecognised sentences - somebody else's,
 * written for exactly this hazard - one shared word let two of them through
 * onto a verb that spends in-world time; two lets none through, and it costs
 * nothing. Swept across five acceptance floors and three margins in one
 * command: at two words every floor from 0.24 to 0.36 leaks nothing and reads
 * 73.8% of the held-out probe set, against 72.6% for the alternative of holding
 * the score itself to 0.42.
 */
const WORDS_A_TIME_SPENDING_VERB_MUST_BE_NAMED_BY = 2;

interface Vector {
    /** Bucket index to weight. Sparse: an exemplar touches a few dozen of 2048. */
    readonly cells: ReadonlyMap<number, number>;
}

/**
 * How rare a word has to be in the corpus to count as saying something.
 *
 * A share rather than a count, so it holds as the corpus grows. At 232
 * exemplars it comes out at six: `money`, `ground`, `need` and `somewhere` are
 * in; `with`, `do`, `here` and `want` are not.
 */
const INFORMATIVE_DF_SHARE = 0.025;

/** Near enough to an exemplar that the sentence is that exemplar in other clothes. */
const ALL_BUT_IDENTICAL = 0.7;

interface VerbIndex {
    readonly action: ActionName;
    readonly exemplars: readonly Vector[];
    readonly centroid: Vector;
    /**
     * The words and stems this verb owns that are rare across the whole corpus.
     *
     * A sentence has to share one of these before the verb may be chosen. The
     * hazard it closes: "I do the thing with the thing" scored 0.33 against
     * conversation, and every part of that score came from `do`, `with` and
     * `the` - grammar the exemplars happen to be written in. The player was
     * answered with "there is nobody about in Halfwater at all", which is a
     * worse answer than the refusal it replaced, because the refusal at least
     * lists what is live.
     *
     * Stated as a rule: a match carried entirely by words that appear all over
     * the corpus is a match on English, not on meaning.
     */
    readonly informative: ReadonlySet<string>;
}

let index: readonly VerbIndex[] | null = null;
let documentFrequency: ReadonlyMap<string, number> | null = null;
let corpusSize = 0;

/**
 * FNV-1a, 32 bit. Any stable hash would do; what matters is that it is the
 * same on every machine and every run, because the whole tier has to answer a
 * sentence identically forever.
 */
function hash(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * Words that say HOW LONG and never say WHAT.
 *
 * Stripped before anything is embedded, from the corpus and from the player's
 * sentence alike, because a span is read by `durationAskedFor` and reading it
 * twice is how the second reader goes wrong. Two jobs, two readers.
 *
 * It is worth being concrete about the failure this removes, because it is not
 * obvious from the outside. Half the exemplars for sitting still mention a
 * year or a decade, so the numbers and the unit nouns became the strongest
 * thing those verbs owned - and "I let it lie for a decade and see", a sentence
 * about nothing, scored higher against seclusion than most sentences that
 * actually ask for it. The classifier was reading the clock and calling it an
 * intention.
 */
const A_SPAN_RATHER_THAN_AN_INTENTION =
    /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|half|a|an|few|several|couple|next|some)?\s*\b(?:seconds?|minutes?|hours?|days?|weeks?|fortnights?|months?|seasons?|years?|decades?|centuries?|century|lifetimes?|whiles?)\b/g;

/** Punctuation out, case down, spans out, runs of space collapsed. */
function words(text: string): string[] {
    return text
        .toLowerCase()
        .replace(A_SPAN_RATHER_THAN_AN_INTENTION, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
}

/**
 * A crude stem, and crude is the point: it exists so `cultivating` and
 * `cultivate` share a feature, not so it is linguistically defensible. Anything
 * that would leave a stub shorter than four characters is left alone.
 */
function stem(word: string): string {
    for (const suffix of ['ings', 'ing', 'edly', 'ies', 'ed', 'es', 'ly', 's']) {
        if (word.length - suffix.length >= 4 && word.endsWith(suffix)) {
            return suffix === 'ies' ? `${word.slice(0, -3)}y` : word.slice(0, word.length - suffix.length);
        }
    }
    return word;
}

/** Every feature in a sentence, with its raw weight, before rarity scaling. */
function features(text: string): Map<string, number> {
    const found = new Map<string, number>();
    const add = (key: string, weight: number) => {
        found.set(key, (found.get(key) ?? 0) + weight);
    };

    const tokens = words(text);
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        add(`w:${token}`, WEIGHT_WORD);

        const root = stem(token);
        if (root !== token) add(`s:${root}`, WEIGHT_STEM);

        const padded = `#${token}#`;
        for (let j = 0; j + GRAM <= padded.length; j++) {
            add(`c:${padded.slice(j, j + GRAM)}`, WEIGHT_GRAM);
        }

        if (i + 1 < tokens.length) add(`p:${token}|${tokens[i + 1]}`, WEIGHT_PAIR);
    }
    return found;
}

/**
 * Rarity, from the corpus and from nowhere else.
 *
 * A feature the corpus has never seen gets the floor rather than the ceiling.
 * The textbook move is to treat an unseen term as maximally informative, and
 * here that is exactly backwards: an unseen word is a proper name or a piece of
 * scenery, it can match no exemplar, and weighting it heavily would do nothing
 * but shrink every real signal when the sentence is normalised.
 */
function rarity(feature: string): number {
    const df = documentFrequency?.get(feature) ?? 0;
    if (df === 0) return 1;
    return Math.log((corpusSize + 1) / (df + 1)) + 1;
}

/** Hash the features into buckets, sign them, and normalise to unit length. */
function embed(text: string): Vector {
    const cells = new Map<number, number>();
    for (const [feature, weight] of features(text)) {
        const h = hash(feature);
        const bucket = h % DIMENSIONS;
        // A sign bit taken from a different part of the hash than the bucket.
        // Two features that collide then cancel as often as they reinforce,
        // which keeps a collision from reading as agreement.
        const sign = (h >>> 20) & 1 ? -1 : 1;
        cells.set(bucket, (cells.get(bucket) ?? 0) + sign * weight * rarity(feature));
    }

    let sum = 0;
    for (const value of cells.values()) sum += value * value;
    const norm = Math.sqrt(sum);
    if (norm === 0) return { cells: new Map() };
    for (const [bucket, value] of cells) cells.set(bucket, value / norm);
    return { cells };
}

function cosine(a: Vector, b: Vector): number {
    // Both are unit length, so the dot product is the cosine. Walk the shorter.
    const [small, large] = a.cells.size <= b.cells.size ? [a.cells, b.cells] : [b.cells, a.cells];
    let total = 0;
    for (const [bucket, value] of small) {
        const other = large.get(bucket);
        if (other !== undefined) total += value * other;
    }
    return total;
}

function meanOf(vectors: readonly Vector[]): Vector {
    const cells = new Map<number, number>();
    for (const vector of vectors) {
        for (const [bucket, value] of vector.cells) cells.set(bucket, (cells.get(bucket) ?? 0) + value);
    }
    let sum = 0;
    for (const value of cells.values()) sum += value * value;
    const norm = Math.sqrt(sum);
    if (norm === 0) return { cells: new Map() };
    for (const [bucket, value] of cells) cells.set(bucket, value / norm);
    return { cells };
}

/**
 * Build the index once, on first use.
 *
 * Lazy rather than at module load so importing this file costs nothing until a
 * sentence actually falls through the table - and so a corpus that somehow
 * failed to build takes down one turn's fallback rather than the whole server.
 */
function ensureIndex(): readonly VerbIndex[] {
    if (index !== null) return index;

    const documents = Object.values(CORPUS).flatMap(phrasings => phrasings as readonly string[]);
    corpusSize = documents.length;

    const df = new Map<string, number>();
    for (const document of documents) {
        for (const feature of features(document).keys()) df.set(feature, (df.get(feature) ?? 0) + 1);
    }
    documentFrequency = df;

    const rareEnough = Math.max(2, Math.round(corpusSize * INFORMATIVE_DF_SHARE));

    index = (Object.entries(CORPUS) as [ActionName, readonly string[]][]).map(([action, phrasings]) => {
        const exemplars = phrasings.map(embed);
        const informative = new Set<string>();
        for (const phrasing of phrasings) {
            for (const feature of features(phrasing).keys()) {
                if (!feature.startsWith('w:') && !feature.startsWith('s:')) continue;
                if ((df.get(feature) ?? 0) <= rareEnough) informative.add(feature);
            }
        }
        return { action, exemplars, centroid: meanOf(exemplars), informative };
    });
    return index;
}

/** How many words the sentence and the verb share that actually say something. */
function wordsThisVerbOwns(input: string, verb: VerbIndex): number {
    let shared = 0;
    for (const feature of features(input).keys()) {
        if (!feature.startsWith('w:') && !feature.startsWith('s:')) continue;
        if (verb.informative.has(feature)) shared++;
    }
    return shared;
}

/**
 * How near a sentence sits to a verb.
 *
 * The nearest single exemplar dominates, because one phrasing that matches
 * closely is stronger evidence than a general resemblance to the whole set -
 * but the centroid gets a third of the weight, so a sentence that is vaguely
 * like everything a verb covers still beats one that clips a single outlier.
 */
const NEAREST_EXEMPLAR_SHARE = 0.65;

export interface NearestVerb {
    readonly action: ActionName;
    readonly score: number;
    /** The second-placed verb and its score, for logs and for tuning. */
    readonly runnerUp: ActionName | null;
    readonly runnerUpScore: number;
    /**
     * How many words the sentence shares with this verb that are rare enough
     * across the corpus to be saying something. One is a hint; two is the
     * sentence being about the thing.
     */
    readonly wordsOwned: number;
}

/**
 * The verb this sentence points at, or null when nothing is near enough.
 *
 * Pure and total: same string in, same answer out, no I/O, no clock, no draw.
 */
export function nearestVerbByMeaning(input: string): NearestVerb | null {
    // BEFORE the query is embedded, not after. `rarity` reads the corpus's
    // document frequencies, and until the index is built there are none - so
    // embedding the query first weighted every feature at the floor and the
    // very first sentence a process ever read got a different vector from the
    // same sentence asked again. Same input, two answers, decided by call
    // order: exactly the nondeterminism this tier is not allowed to have.
    const verbs = ensureIndex();

    const query = embed(input);
    if (query.cells.size === 0) return null;

    type Placed = { action: ActionName; score: number; wordsOwned: number };
    let best: Placed | null = null;
    let second: Placed | null = null;

    for (const verb of verbs) {
        let nearest = 0;
        for (const exemplar of verb.exemplars) {
            const score = cosine(query, exemplar);
            if (score > nearest) nearest = score;
        }

        // The rare-word requirement, and the one case it must stand aside for.
        // It exists to reject a score assembled out of grammar; a sentence that
        // is all but identical to an exemplar is not that, and holding it to
        // the rule loses the shortest questions - "what am I" is three words
        // and every one of them is common.
        const wordsOwned = wordsThisVerbOwns(input, verb);
        if (nearest < ALL_BUT_IDENTICAL && wordsOwned === 0) continue;

        const score = NEAREST_EXEMPLAR_SHARE * nearest
            + (1 - NEAREST_EXEMPLAR_SHARE) * cosine(query, verb.centroid);

        if (best === null || score > best.score) {
            second = best;
            best = { action: verb.action, score, wordsOwned };
        } else if (second === null || score > second.score) {
            second = { action: verb.action, score, wordsOwned };
        }
    }

    if (best === null) return null;
    return {
        action: best.action,
        score: best.score,
        runnerUp: second?.action ?? null,
        runnerUpScore: second?.score ?? 0,
        wordsOwned: best.wordsOwned
    };
}

/**
 * The plan for a sentence the table could not read, or the refusal unchanged.
 *
 * `fromTable` is passed in rather than recomputed so this can never disagree
 * with what the table decided: it is returned untouched unless the table
 * itself said `unclear`.
 */
export function verbForASentenceThePatternsMissed(
    input: string,
    fromTable: PlannedAction
): PlannedAction {
    if (fromTable.action !== FALLBACK_ACTION) return fromTable;

    const nearest = nearestVerbByMeaning(input);
    if (nearest === null) return fromTable;

    if (nearest.score < ACCEPT_AT) return fromTable;
    if (nearest.score - nearest.runnerUpScore < CLEAR_OF_RUNNER_UP_BY) return fromTable;

    const spendsTime = (TIME_CONSUMING_ACTIONS as readonly ActionName[]).includes(nearest.action);
    if (spendsTime && nearest.wordsOwned < WORDS_A_TIME_SPENDING_VERB_MUST_BE_NAMED_BY) {
        return fromTable;
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

    return plan;
}
