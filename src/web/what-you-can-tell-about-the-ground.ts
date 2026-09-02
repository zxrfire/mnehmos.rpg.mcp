/**
 * READING A VEIN IS A SKILL, AND IT ARRIVES WITH THE LADDER.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   "at early levels its a feeling, as you go up then it becomes more clear -
 *    the grounds can support x and there's y people. you can't tell at qi
 *    condensation, you can just say the qi feels light or heavy etc."
 *
 * and, the other half:
 *
 *   "this is where a master can help tell you."
 *
 * `how-crowded-this-ground-is.ts` surfaced the largest lever in the game, which
 * was badly needed and is right. What it did not do is ask WHO IS READING. A Qi
 * Condensation cultivator was being handed "Low Fall comfortably carries a draw
 * of 30, and 10 are drawing on it" on turn one, which is a surveyor's figure in
 * the hands of somebody who has been cultivating for a year.
 *
 * This is `docs/world/houses/discovery.md`'s rule applied to a MEASUREMENT rather than
 * to a name: the sheet reports what this cultivator can perceive, and not what
 * the engine knows. It is expressed as a gate over the existing figures rather
 * than as a second set of strings, so there is no second table to drift.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LOW END MUST STILL BE ACTIONABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is the constraint that makes it a design and not a nerf, and it is the
 * one easy to get wrong. A beginner who can only feel the qi must still be able
 * to CHOOSE BETWEEN TWO PLACES. What they lose is the arithmetic; what they must
 * keep is the ability to act.
 *
 * So the feeling is not a description of the ambient band. It is a band over
 * `density x share` - the ground's own qi times the fraction of it still going
 * spare - which is the SAME PRODUCT the rate is computed from. A beginner
 * standing on thin ground nobody is on and then on rich ground with a crowd on
 * it feels the second one as WORSE, correctly, and can act on that without ever
 * seeing a number. That is the whole of the low end and it is enough to play
 * with.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHERE THE THRESHOLDS SIT, AND WHY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Off the realm ladder, at the two places the ladder itself already treats as
 * changes of kind rather than of degree.
 *
 *   A FEELING          below `FOUNDATION_ORDINAL`. Qi Condensation is where
 *                      somebody "can hold and circulate spiritual energy" and
 *                      is "still mortal in every way that matters". They feel
 *                      the ground and cannot survey it.
 *   THE CROWDING       from Foundation Establishment. A permanent foundation is
 *                      the first thing anybody has that is CONTINUOUSLY drawing,
 *                      so the first thing they can tell about other people is
 *                      that other people are drawing too - and whether it is
 *                      more than the ground likes. Still no capacity figure.
 *   THE FIGURES        from `core_formation`'s start. "Sects stop recruiting you
 *                      and start negotiating with you"; what the ground carries
 *                      and how many are on it is the arithmetic somebody at that
 *                      height is expected to do before they sit down.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND SOMEBODY WHO CAN READ IT WILL READ IT FOR YOU
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The better half of the design, and it pays for several things at once.
 *
 * A master is otherwise an abstraction - a multiplier on a rate nobody can see.
 * "My master says this vein carries thirty and eleven are on it" is a benefit
 * a disciple notices the day they get it, at the very bottom of the ladder.
 * It makes being unaffiliated worse in an INFORMATIONAL way, which is this
 * setting's own logic: a rogue is not merely poorer, nobody explains the world
 * to them. And it degrades correctly on its own - a student whose masters have
 * all died loses the reading along with everything else.
 *
 * The figures arrive ATTRIBUTED when they arrive this way, and that difference
 * is kept deliberately. Being told is not the same as knowing, and a player who
 * is reading somebody else's answer should be able to see that they are.
 */

import { QI_CARRYING_CAPACITY } from '../engine/cultivation/cultivation.js';
import { FOUNDATION_ORDINAL } from '../engine/cultivation/realms.js';
import type { CrowdingRead } from './how-crowded-this-ground-is.js';

/** Ordinal at which somebody starts reading a vein instead of feeling it. */
export const READS_A_VEIN = 17;

/** Ordinal at which somebody can tell that other people are drawing on it. */
export const FEELS_THE_OTHERS = FOUNDATION_ORDINAL;

/** How much of the ground a reader at a given height can actually make out. */
export type GroundReading = 'a_feeling' | 'the_crowding' | 'the_figures';

export interface GroundReader {
    realmOrdinal: number;
    /**
     * Somebody who can read ground and would say so, by name. Null when there
     * is nobody - which is the ordinary condition of a rogue, and is the whole
     * of what being unaffiliated costs here.
     */
    toldBy?: string | null;
}

/**
 * What this height can make out, before anybody is asked.
 *
 * Derived from the ladder rather than from a table of its own: the lower
 * threshold IS `FOUNDATION_ORDINAL`, so moving where a foundation begins moves
 * this with it. The upper one is stated once as `READS_A_VEIN`, and that it is
 * Core Formation's own start is asserted in the tests rather than imported -
 * a presentation module should depend on two numbers off the ladder and not on
 * the shape of the tier table.
 */
export function whatTheyCanTell(ordinal: number): GroundReading {
    if (ordinal >= READS_A_VEIN) return 'the_figures';
    if (ordinal >= FEELS_THE_OTHERS) return 'the_crowding';
    return 'a_feeling';
}

/**
 * How the ground feels, in five bands a person can rank against each other.
 *
 * Over `density x share`, which is what the rate is actually computed from, so
 * the ordering a beginner perceives is the ordering that is true. The words are
 * comparative on purpose - "picked over", "goes round", "nobody taking it" -
 * because a band that only described richness would leave a player unable to
 * tell rich-and-crowded from poor-and-empty, which is the one comparison the
 * whole feature is about.
 */
const HOW_IT_FEELS: readonly { above: number; said: string }[] = [
    { above: 0.60, said: 'What gets to you here is heavy enough to feel on the skin.' },
    { above: 0.34, said: 'What gets to you here comes easily, and there is plenty of it.' },
    { above: 0.18, said: 'What gets to you here is ordinary. It neither helps nor gets in the way.' },
    { above: 0.07, said: 'What gets to you here comes grudgingly, and has to be worked for.' },
    { above: -1, said: 'What gets to you here is thin enough that sitting in it is barely worth the days.' }
];

/**
 * What a cultivator standing here would actually be able to say about it.
 *
 * `CrowdingRead` stays the measurement and this is the only thing that decides
 * how much of it a given person gets. Callers that want the whole truth - the
 * inspector, the operator's log, a harness - read the fields off `CrowdingRead`
 * directly and are unaffected.
 */
export function groundAsPerceived(read: CrowdingRead, reader: GroundReader): string {
    const level = whatTheyCanTell(reader.realmOrdinal);
    if (level === 'the_figures') return read.line;

    const feeling = feelingFor(read);

    // Somebody else's eyes. Offered whenever this reader is short of the
    // figures, at every band below it, because a disciple at Qi Condensation is
    // exactly who most needs telling and is the case the ruling names.
    if (reader.toldBy) {
        return `${feeling} ${reader.toldBy} says ${quotedFigures(read)}`;
    }

    if (level === 'the_crowding') return `${feeling} ${crowdOnly(read)}`;
    return feeling;
}

/**
 * The read as this person holds it: the sentence they would say, and only the
 * figures they could have got.
 *
 * The nulls are load-bearing rather than tidy. The sheet renders a percentage
 * when `share` is a number and a bare headcount when it is not, so masking the
 * field is what stops a first-year disciple being shown "88% RATE" - without a
 * second rendering path, and without the client having to know anything about
 * the realm ladder.
 *
 * `heads` survives every band, and deliberately: counting the people standing
 * in a square is not a skill. Pricing them is.
 */
export function groundAsPerceivedRead(read: CrowdingRead, reader: GroundReader): CrowdingRead {
    const level = whatTheyCanTell(reader.realmOrdinal);
    const line = groundAsPerceived(read, reader);
    // Being told the figures is holding the figures. A student whose master has
    // read the vein for them can act on it exactly as somebody who read it
    // themselves - the difference is that the sentence says whose eyes it came
    // from, which is a fact about provenance and not about resolution.
    if (level === 'the_figures' || reader.toldBy) return { ...read, line };
    return { ...read, line, supported: null, drawing: null, share: null };
}

/** The band, over the product the rate itself uses. */
function feelingFor(read: CrowdingRead): string {
    const effective = effectiveQiOf(read);
    for (const band of HOW_IT_FEELS) {
        if (effective > band.above) return band.said;
    }
    return HOW_IT_FEELS[HOW_IT_FEELS.length - 1].said;
}

/**
 * The ground's qi times the fraction of it still going spare.
 *
 * Reconstructed from `supported` rather than taking a second density argument.
 * `carryingCapacityFor` is `round(density x QI_CARRYING_CAPACITY)`, so dividing
 * back out recovers the density the rate itself was computed from - one number
 * with one source, where a `density` field passed alongside is a field that can
 * disagree with the sentence next to it.
 *
 * The bands above are set against the ground the engine already calibrates on:
 * thin carries seven, an ordinary valley thirty, a rich vein fifty-six. So thin
 * ground with nobody on it and ordinary ground with a crowd on it land in
 * neighbouring bands, which is the comparison the whole low end exists to
 * support - a beginner who cannot count anybody can still tell which of two
 * places is worth forty years.
 */
function effectiveQiOf(read: CrowdingRead): number {
    // Reached only from the perceived path, which is handed the measurement
    // before anything is masked. A read whose figures have already been
    // stripped has nothing to band, and is reported as ordinary rather than as
    // thin - the direction that does not invent bad news about a place.
    if (read.supported === null || read.share === null) return 0.3;
    return (read.supported / QI_CARRYING_CAPACITY) * read.share;
}

/** That there are too many people on it, without saying how many it takes. */
function crowdOnly(read: CrowdingRead): string {
    if (read.share === null || read.share >= 1) {
        return 'Nothing about the way it comes suggests anybody else is in the way of it.';
    }
    return 'There are more drawing on this ground than it likes, and it is in the way of all of them.';
}

/** The surveyor's answer, in somebody else's mouth. */
function quotedFigures(read: CrowdingRead): string {
    const who = read.heads === 1 ? 'nobody else is on it' : `${read.heads} are on it`;
    const share = read.share === null || read.share >= 1
        ? 'and it is not being shared thin'
        : `and it is running at about ${Math.round(read.share * 100)}% of what it would give one person alone`;
    return `${read.placeName} carries a draw of about ${read.supported ?? 'they could not say how much'}, ${who}, ${share}.`
        + (read.barren ? ' And the ground itself is poor, however empty it gets.' : '');
}
