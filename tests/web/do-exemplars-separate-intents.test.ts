/**
 * Do exemplars separate intents whose frames overlap?
 *
 * The pilot behind `how-a-player-says-each-coercion.ts`, kept as a test so the
 * numbers are reproducible rather than remembered. It measures one verb. It
 * wires nothing: no vectors are committed, no staleness guard is added, and
 * `parseIntent` does not consult any of this.
 *
 * ── WHAT IT MEASURES, AND WHY TWO NUMBERS ────────────────────────────────
 *
 * LEAVE-ONE-OUT over the corpus: each exemplar classified against the other
 * twenty-four. This is the honest one. It is hard by construction, because the
 * corpus's own second rule is that exemplars must be DISTINCT from each other -
 * so removing one leaves four sentences deliberately unlike it.
 *
 * HELD OUT over sentences nobody wrote an exemplar for. This one is NOT
 * independent evidence and must not be read as if it were: the same person
 * wrote the corpus and the probes in one sitting, so a probe is a paraphrase of
 * an exemplar written minutes earlier. It scored 14/14 and that number is worth
 * roughly what that sentence says it is worth. It is here because the SHAPE of
 * its errors matters even when the count does not.
 *
 * ── THE RESULT, WHICH IS NOT AN ACCURACY NUMBER ──────────────────────────
 *
 * Measured on bge-base-en-v1.5, 5 intents, 25 exemplars:
 *
 *     leave-one-out   16/25
 *     held out        14/14  (see the caveat above)
 *
 * The interesting thing is not either figure. It is that the corpus splits
 * cleanly in two, and the nearest-neighbour matrix says why. Every intent's
 * similarity to its own other exemplars, against its closest neighbour:
 *
 *     swallow     own 0.850   nearest other 0.757 (tame)        separated
 *     tame        own 0.830   nearest other 0.770 (submit)      separated
 *     submit      own 0.812   nearest other 0.850 (talk)        NOT
 *     talk        own 0.796   nearest other 0.850 (submit)      NOT
 *     hand_over   own 0.762   nearest other 0.766 (talk)        NOT
 *
 * For three of the five, ANOTHER INTENT IS CLOSER THAN THEIR OWN EXEMPLARS
 * ARE. That is not a threshold to tune. It is the tier measuring something
 * other than the thing being asked.
 *
 * ── AND THE LINE THE SPLIT FALLS ON ──────────────────────────────────────
 *
 * `swallow` and `tame` are told apart by what is IN the sentence: a thing
 * going into somebody, an animal being broken. `submit`, `talk` and
 * `hand_over` describe the SAME PHYSICAL ACT - a person hitting another person
 * until they comply - and differ only in what the compliance was FOR. That
 * purpose is frequently not in the sentence at all, and sentence similarity
 * cannot recover what was never written.
 *
 * So the prediction this pilot makes about the other eighteen verbs is
 * specific, and it is checkable before anybody writes three hundred more
 * exemplars: intents distinguished by their OBJECT should separate, and
 * intents distinguished by their PURPOSE should not. `move`'s five
 * (travel/flee/approach/enter/follow) name different acts and should do well.
 * `sect`'s fourteen are mostly purposes and should not.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import {
    COERCIONS_NOBODY_WROTE_AN_EXEMPLAR_FOR,
    HOW_A_PLAYER_SAYS_EACH_COERCION,
    type CoercionIntent
} from '../../src/web/how-a-player-says-each-coercion.js';
import {
    HOW_A_PLAYER_SAYS_EACH_MOVE,
    HOW_A_PLAYER_SAYS_EACH_SECT_ASK
} from '../../src/web/how-a-player-says-each-intent.js';
import {
    embed,
    loadTheModel,
    MODEL_DIRECTORY,
    similarity
} from '../../src/web/the-sentence-model-this-repo-carries.js';

const LABELS = Object.keys(HOW_A_PLAYER_SAYS_EACH_COERCION) as CoercionIntent[];

/**
 * Above this, the corpus would be good enough to consider wiring, and the
 * decision not to would be stale. A tripwire rather than a target: if somebody
 * improves the corpus past it, this test fails and asks for the decision to be
 * taken again rather than silently inherited.
 */
const GOOD_ENOUGH_TO_RECONSIDER = 0.80;

type Bank = Record<CoercionIntent, { said: string; vector: Float32Array }[]>;
let bank: Bank;

beforeAll(async () => {
    await loadTheModel(MODEL_DIRECTORY);
    bank = {} as Bank;
    for (const label of LABELS) {
        bank[label] = [];
        for (const said of HOW_A_PLAYER_SAYS_EACH_COERCION[label]) {
            bank[label].push({ said, vector: await embed(said) });
        }
    }
}, 120_000);

/** Nearest single exemplar decides it - the rule `nearestVerbByMeaning` uses. */
function classify(vector: Float32Array, skip: string | null) {
    return LABELS
        .map(label => {
            let best = -1;
            for (const ex of bank[label]) {
                if (ex.said === skip) continue;
                const score = similarity(vector, ex.vector);
                if (score > best) best = score;
            }
            return { label, score: best };
        })
        .sort((a, b) => b.score - a.score);
}

describe('exemplars and intents that share a sentence frame', () => {
    /**
     * THE HYPOTHESIS, and the pair that prompted the whole question.
     *
     * `swallow` and `hand_over` are the same frame - somebody made to do a
     * thing with a thing - pointing in opposite directions. Every probe on
     * that pair lands on the correct side, by margins from 0.020 to 0.198.
     *
     * This is the one assertion worth keeping, because it is what a routing
     * layer would have to get right and it is where a pattern row got it
     * wrong: `force (him|her|them) (to|into)` claimed a pill sentence for
     * `hand_over` and robbed somebody with it.
     */
    it('separates a thing going in from a thing coming out', async () => {
        const pair = COERCIONS_NOBODY_WROTE_AN_EXEMPLAR_FOR
            .filter(p => p.means === 'swallow' || p.means === 'hand_over');
        expect(pair.length).toBeGreaterThanOrEqual(8);

        for (const probe of pair) {
            const scored = classify(await embed(probe.said), null);
            const swallow = scored.find(s => s.label === 'swallow')!.score;
            const handOver = scored.find(s => s.label === 'hand_over')!.score;
            const gap = probe.means === 'swallow' ? swallow - handOver : handOver - swallow;
            expect(gap, `"${probe.said}" wanted ${probe.means}`).toBeGreaterThan(0);
        }
    }, 120_000);

    /**
     * AND THE COUNTER-FINDING, which is the reason nothing is wired.
     *
     * Three of the five intents have another intent closer to them than their
     * own exemplars are. Pinned so that a later reader who sees the corpus and
     * assumes it works has to read this instead.
     */
    it('does not separate intents that differ only in what the compliance was for', () => {
        const nearestOwn = (label: CoercionIntent) => {
            let best = -1;
            for (const a of bank[label]) {
                for (const b of bank[label]) {
                    if (a.said === b.said) continue;
                    best = Math.max(best, similarity(a.vector, b.vector));
                }
            }
            return best;
        };
        const nearestOther = (label: CoercionIntent) => {
            let best = -1;
            for (const other of LABELS) {
                if (other === label) continue;
                for (const a of bank[label]) {
                    for (const b of bank[other]) best = Math.max(best, similarity(a.vector, b.vector));
                }
            }
            return best;
        };

        // The two told apart by what is in the sentence.
        for (const label of ['swallow', 'tame'] as const) {
            expect(nearestOwn(label), label).toBeGreaterThan(nearestOther(label));
        }
        // The three told apart only by purpose, which is often not written down.
        for (const label of ['submit', 'talk', 'hand_over'] as const) {
            expect(nearestOwn(label), label).toBeLessThan(nearestOther(label));
        }
    });

    /**
     * The honest accuracy, and the tripwire on the decision it supports.
     */
    it('is not yet good enough to wire, and says so in a number', () => {
        let right = 0;
        let total = 0;
        for (const label of LABELS) {
            for (const ex of bank[label]) {
                total++;
                if (classify(ex.vector, ex.said)[0].label === label) right++;
            }
        }
        const accuracy = right / total;
        expect(
            accuracy,
            `Leave-one-out reached ${right}/${total}. When this passes `
            + `${GOOD_ENOUGH_TO_RECONSIDER}, the decision not to wire the intent tier is stale `
            + 'and wants taking again rather than inheriting.'
        ).toBeLessThan(GOOD_ENOUGH_TO_RECONSIDER);
    });
});

/**
 * THE PREDICTION, RUN ON TWO VERBS NAMED BEFORE IT WAS MEASURED.
 *
 * The rule the `coerce` pilot produced: an intent distinguished by its OBJECT
 * is a parsing question; an intent distinguished by its PURPOSE is a situation
 * question and must not be asked of the sentence. `move`'s five were predicted
 * to separate, `sect`'s fourteen not to.
 *
 * ── THE NUMBERS, AND THE CONFOUND IN THE OBVIOUS ONE ─────────────────────
 *
 *     verb     intents  exemplars  leave-one-out  collapsed
 *     move           5         20      14/20  70%      2/5
 *     coerce         5         25      16/25  64%      3/5
 *     sect          14         56      16/56  29%     10/14
 *
 * Read raw, `sect` looks catastrophic. That reading is WRONG and the error is
 * worth more than the number: a fourteen-way choice has a chance baseline of
 * 7.1% where a five-way has 20%, so as lift over chance the three verbs are
 * 3.5x, 3.2x and 4.0x - and `sect` is marginally the BEST of them. Anybody
 * comparing accuracies across different class counts is comparing the class
 * counts.
 *
 * `collapsed` is the chance-independent measure - how many intents have some
 * other intent nearer to them than their own exemplars are - and it does order
 * the way the rule predicts: 2/5, 3/5, 10/14. But that is a far weaker signal
 * than the raw figures pretend, and on its own it would not carry the ruling.
 *
 * ── WHAT ACTUALLY DECIDES IT IS THE SHAPE OF THE MISSES ──────────────────
 *
 * `sect` fails by INVERSION. Its errors are not scattered; they land on the
 * opposite member of a shared frame:
 *
 *     join -> recruit      all four of them
 *     expel -> leave       both
 *     siphon -> donate     and donate -> siphon, both directions
 *
 * Joining a house and recruiting for it, leaving and expelling, taking from
 * the vault and paying into it - each pair is one act with the DIRECTION
 * reversed, and the direction is the purpose. The tier returns the wrong side
 * confidently.
 *
 * `move` fails by ADJACENCY. Its errors are `approach -> enter`,
 * `approach -> follow`, `travel -> flee` - neighbouring acts of the same kind,
 * never their own opposites.
 *
 * That is the distinction that matters for a router, and it is what makes the
 * rule a safety property rather than a quality one. An adjacency error gives a
 * player a slightly wrong read. An inversion error gives the player who asked
 * to JOIN a recruitment drive, and the player who asked to LEAVE somebody
 * else's expulsion. Where intents are wired to acts, that is a wrong act
 * reporting success - the same failure as a pattern row that read a pill
 * sentence as a robbery.
 *
 * ── AND THE PREDICTION IS NOT CLEAN ON THE GOOD SIDE ─────────────────────
 *
 * Two of `move`'s five collapsed. `approach` sits nearer to `enter` (0.852)
 * than to its own exemplars (0.746), because walking up to a gate and walking
 * through it are very nearly the same sentence. The rule survives on the shape
 * of the failures, not on a clean sweep, and pretending otherwise would be
 * choosing the tidier story.
 */
describe('object-distinguished and purpose-distinguished intents fail differently', () => {
    async function bankOf(corpus: Readonly<Record<string, readonly string[]>>) {
        const built: Record<string, { said: string; vector: Float32Array }[]> = {};
        for (const label of Object.keys(corpus)) {
            built[label] = [];
            for (const said of corpus[label]) built[label].push({ said, vector: await embed(said) });
        }
        return built;
    }

    const nearestIn = (
        built: Record<string, { said: string; vector: Float32Array }[]>,
        vector: Float32Array,
        skip: string
    ) => Object.keys(built)
        .map(label => {
            let best = -1;
            for (const ex of built[label]) {
                if (ex.said === skip) continue;
                best = Math.max(best, similarity(vector, ex.vector));
            }
            return { label, score: best };
        })
        .sort((a, b) => b.score - a.score)[0];

    const collapsedFraction = (built: Record<string, { said: string; vector: Float32Array }[]>) => {
        const labels = Object.keys(built);
        let collapsed = 0;
        for (const label of labels) {
            let own = -1;
            for (const a of built[label]) {
                for (const b of built[label]) {
                    if (a.said !== b.said) own = Math.max(own, similarity(a.vector, b.vector));
                }
            }
            let other = -1;
            for (const o of labels) {
                if (o === label) continue;
                for (const a of built[label]) {
                    for (const b of built[o]) other = Math.max(other, similarity(a.vector, b.vector));
                }
            }
            if (other > own) collapsed++;
        }
        return collapsed / labels.length;
    };

    /**
     * The chance-independent comparison. Deliberately NOT an accuracy
     * comparison - see the confound in the header.
     */
    it('collapses more of a purpose-split verb than an object-split one', async () => {
        const move = collapsedFraction(await bankOf(HOW_A_PLAYER_SAYS_EACH_MOVE));
        const sect = collapsedFraction(await bankOf(HOW_A_PLAYER_SAYS_EACH_SECT_ASK));
        expect(sect, `move ${move.toFixed(2)} vs sect ${sect.toFixed(2)}`).toBeGreaterThan(move);
    }, 180_000);

    /**
     * THE ONE THAT MATTERS. Three pairs in `sect` are one act with the
     * direction reversed, and the tier returns the opposite side.
     *
     * Pinned because it is a safety property: an intent wired to an act that
     * inverts is a wrong act reporting success, and no amount of exemplars
     * puts a direction into a sentence that never carried one.
     */
    it('returns the opposite side of a direction pair, confidently', async () => {
        const built = await bankOf(HOW_A_PLAYER_SAYS_EACH_SECT_ASK);
        const inversions: string[] = [];
        for (const [label, opposite] of [
            ['join', 'recruit'], ['expel', 'leave'], ['siphon', 'donate']
        ] as const) {
            for (const ex of built[label]) {
                if (nearestIn(built, ex.vector, ex.said).label === opposite) {
                    inversions.push(`${label} -> ${opposite}  "${ex.said}"`);
                }
            }
        }
        expect(
            inversions.length,
            'no direction pair inverted, which would weaken the rule this pins:\n'
            + inversions.join('\n')
        ).toBeGreaterThanOrEqual(4);
    }, 180_000);
});
