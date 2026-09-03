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
