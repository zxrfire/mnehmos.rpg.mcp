/**
 * How freely a particular person parts with what they have.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner:
 *
 *   > some people are greedy some generous, this should be part of their
 *   > character - kind elders exist just as greedy demonic cultivators exist.
 *
 * The second clause is the load-bearing one and it is a constraint on the
 * MODEL, not a flavour note. **Whatever this produces must not be predictable
 * from anybody's alignment.** The righteous/demonic axis in this world is about
 * method and permission - what a house will supply, what it will take up when
 * it is done to one of its own - and it is not about being nice. A model that
 * let a demonic robe imply a tight fist would flatten the most interesting
 * thing about the setting into a colour code, and it would do it invisibly,
 * because the result would look plausible every single time.
 *
 * So this function's whole input is a person's identity. It has never seen an
 * alignment, a faction, a rank or a rung, and it cannot: there is no parameter
 * to pass one through. `tests/engine/social-leverage/` measures the real member
 * catalog partitioned by its houses' alignments and requires the three arms to
 * be indistinguishable.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ONE NUMBER, AND NOTHING ANYWHERE SWITCHES ON A PERSONALITY
 * ═════════════════════════════════════════════════════════════════════════
 *
 * AGENTS.md: *"Model what somebody wants. Let the behaviour fall out. The
 * moment a list of NPC behaviours exists, the world has as many behaviours as
 * somebody remembered to write."* Greed and generosity are an EXAMPLE of a
 * disposition rather than the set of them, so the shape has to be one where a
 * tenth kind of person costs no code.
 *
 * The inversion that gets there: instead of asking *what kind of person is
 * this* and branching, ask *how heavily does what a thing costs them weigh with
 * them* and multiply. {@link openHandedness} is that, on -1..+1:
 *
 *     -1   nothing leaves their hands that they do not have to let go of
 *      0   the ordinary answer, which is most people
 *     +1   what it costs them is genuinely not the thing they are weighing
 *
 * Nothing in the engine reads a name, a label or a band. There is no
 * `switch (personality)` to invert because there is no personality enum to
 * switch on - a person is a scalar, and a new kind of person is a different
 * scalar with a different sentence attached.
 *
 * WHAT THIS IS NOT. It is a standing leaning, not a situation. Somebody whose
 * son is dying tonight will not part with the medicine at any figure and that
 * has nothing to do with their character - it is a present need, and AGENTS.md
 * keeps the two apart deliberately: *"A present need is a refusal. A reserved
 * future need is a price you have not met."* Disposition is what is left when
 * you take the circumstances away. The two are separate terms and must stay so,
 * because the whole point of the owner's ruling is that a generous person under
 * pressure still says no, and says it differently.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY IT IS DRAWN AND NOT AUTHORED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `MEMBERS` already carries `wants` and `fears` for a hundred and seventy-six
 * people, and they are good - "a smaller stone, and will die before he asks for
 * one", "to be allowed to touch a patient, once, under supervision". They are
 * free text and the engine must never parse them. They are also, read through,
 * almost entirely about STANDING, PLACE AND FEAR rather than about holding on
 * to things, so a drawn disposition does not contradict any of them; it answers
 * a question the catalog never asked.
 *
 * The draw is keyed on the person's own id and nothing else, which has three
 * consequences that are all wanted:
 *
 *   - `asking.md` requires that the world's habits be stable enough to learn -
 *     *"do not randomise across runs"* - and an id-keyed draw is the same
 *     answer forever, for the player and for the world simulation alike.
 *   - A catalog member is the same person in every world, the way their `wants`
 *     already are, so Yan Shuling is exactly as open-handed on a fresh database
 *     as on an old one.
 *   - Somebody the WORLD minted has a world-minted id, so a new world does draw
 *     a different several hundred people, with no seed plumbed through here.
 *
 * Pure, total, and deterministic. No I/O, no database, no LLM, and no argument
 * that is not the person themselves.
 */

import { forStream } from '../cultivation/rng.js';

// ─────────────────────────────────────────────────────────────────────────
// THE DRAW
// ─────────────────────────────────────────────────────────────────────────

/**
 * The stream name. A constant rather than a seed, because there is no world
 * seed in this function's arguments and there must not be one: the point of the
 * draw is that a person is themselves wherever they are met.
 */
const HOW_A_PERSON_HOLDS_WHAT_THEY_HAVE = 'disposition:open_handedness';

/**
 * Most people are ordinary and the ends are the interesting part.
 *
 * Two uniform draws averaged gives a triangular distribution on -1..+1 with its
 * peak at nought, which is the shape the world wants, and nobody has to write a
 * weight table to say so. Against the bands below it puts about 36% of people
 * somewhere worth remarking on and about 6% at an end - measured over four
 * thousand ids, and asserted in the tests.
 *
 * A single uniform would make every second person you meet an extreme. A sum of
 * three or more approaches a bell and pushes the ends so far out that a player
 * could go a whole run without meeting a generous elder, which is precisely the
 * person the ruling exists to put in the world.
 */
const DRAWS = 2;

/**
 * How open-handed this person is, on -1..+1.
 *
 * Deterministic in the id and total: any string answers, including one this
 * world has never seen, so a caller never has to guard.
 */
export function openHandednessOf(personId: string): number {
    const id = (personId ?? '').trim();
    if (id.length === 0) return 0;
    // The person goes in the SEED slot and the constant in the stream slot,
    // which is the reverse of how `forStream` usually reads. It is deliberate:
    // there is no run seed and no world seed in this question, and putting the
    // person where the seed goes says so. Do not "fix" the argument order - the
    // derived string differs, and every disposition in every world would move.
    const rng = forStream(id, HOW_A_PERSON_HOLDS_WHAT_THEY_HAVE);
    let total = 0;
    for (let i = 0; i < DRAWS; i++) total += rng.next();
    // Mean of the draws, recentred onto -1..+1.
    return round4((total / DRAWS) * 2 - 1);
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}

// ─────────────────────────────────────────────────────────────────────────
// SAYING IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where a reading stops being worth a sentence.
 *
 * Below this the person is simply ordinary about it, and saying so of everybody
 * would be noise. MEASURED AND MOVED: at 0.25 the triangular draw put 56% of
 * the world above the line, so a majority of everybody the player met came with
 * a sentence about their grip on their possessions - which is not a world where
 * some people are generous, it is a world where generosity is a stat block. At
 * 0.4 it is 36%, so most people are unremarkable about this and the ones who
 * are not are worth noticing.
 */
const WORTH_SAYING = 0.4;

/**
 * Where it is the first thing anybody would tell you about them.
 *
 * Also moved for the reason above: 0.6 marked one person in six, and "known for
 * it" has to be rarer than that to mean anything. At 0.75 it is about one in
 * sixteen - uncommon, and common enough that a run meets several.
 */
const MARKED = 0.75;

/**
 * The number said in words, or null when there is nothing to say.
 *
 * BANDS DESCRIBE A NUMBER; THEY DO NOT SELECT A BEHAVIOUR. Nothing in the
 * engine calls this, and nothing that calls it may branch on which sentence
 * came back - it exists so that a person whose arithmetic is unusual READS
 * unusual, which is the half of the ruling that a term in an odds breakdown
 * cannot carry on its own. A tenth kind of person needs a different number and
 * a different sentence, and no new branch anywhere.
 *
 * Written as what somebody would say about them rather than as a label,
 * because "greedy" and "generous" are the two examples the owner reached for
 * and not the set, and a word that names the axis invites somebody to build an
 * enum out of it later.
 */
export function howTheyHoldWhatTheyHave(openHandedness: number): string | null {
    if (!Number.isFinite(openHandedness)) return null;
    if (openHandedness >= MARKED) {
        return 'gives things away, and has been doing it long enough that people '
            + 'have stopped being surprised by it';
    }
    if (openHandedness >= WORTH_SAYING) {
        return 'parts with things more easily than most people do';
    }
    if (openHandedness <= -MARKED) {
        return 'does not let go of what is theirs, and is known for it';
    }
    if (openHandedness <= -WORTH_SAYING) {
        return 'holds on to what is theirs a little harder than most people do';
    }
    return null;
}

/**
 * The same fact from the other side: how a refusal from THIS person reads.
 *
 * The design owner's test for whether this landed is not the arithmetic - it is
 * that *"a generous elder should read as generous"*. The place that shows is a
 * no, because a no is the commonest thing a player hears and because a generous
 * person saying no is doing something a tight-fisted one is not: they are
 * refusing against their own grain, which means the reason is real.
 *
 * Null in the middle, so an ordinary person's refusal is left exactly as it was.
 */
export function whatTheirRefusalIsLike(openHandedness: number): string | null {
    if (!Number.isFinite(openHandedness)) return null;
    if (openHandedness >= MARKED) {
        return 'They are not a person who says no easily, and they said it anyway - so '
            + 'what stopped them was the thing itself and not the asking.';
    }
    if (openHandedness >= WORTH_SAYING) {
        return 'They part with things more readily than most, which makes this a no about '
            + 'what was asked rather than about you.';
    }
    if (openHandedness <= -MARKED) {
        return 'Nothing leaves their hands that does not have to. Anyone who has dealt with '
            + 'them twice would have expected this one.';
    }
    if (openHandedness <= -WORTH_SAYING) {
        return 'They hold on to what is theirs, and a no from them costs them nothing to say.';
    }
    return null;
}

/** Exported for tests and probes that pin the bands. */
export const DISPOSITION_BANDS = Object.freeze({ WORTH_SAYING, MARKED, DRAWS });
