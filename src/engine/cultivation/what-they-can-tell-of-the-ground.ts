/**
 * ═══════════════════════════════════════════════════════════════════════════
 * A NOVICE CANNOT READ THE GROUND. THEY CAN ONLY COMPARE IT TO HOME.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE FIRST READ TAGGED WITH HOW IT IS KNOWN, and the one chosen to prove the
 * idea because the tag changes WHAT IS SAID and not merely how.
 *
 * `describeAmbientPerceived(ambient)` took the band and nothing else. It has no
 * idea who is standing there, so a sixteen-year-old at the first rung with no
 * method was handed the same reading as a Nascent Soul cultivator: the band,
 * named, correctly, every time. The engine knew and therefore the player knew,
 * which is AGENTS.md's perception rule broken in the ordinary way.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT A PERSON ACTUALLY GETS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two different faculties, and the ladder decides which one you have.
 *
 * BELOW THE FOUNDATION you have a body and a memory. What you can tell is
 * whether this ground gives back more or less than the ground you were raised
 * on - the design owner's own ruling on the opening, *"thicker versus the place
 * you came from"* - and that is all. You cannot name a band, you cannot tell
 * dense ground from a spirit tide, and if you were raised on thin ground and
 * are standing on thin ground you have nothing to say at all.
 *
 * That last case is the one worth having. `unknown` is a real answer: somebody
 * who cannot tell is told they cannot tell, and that is the sentence that makes
 * finding a person who CAN tell worth the walk.
 *
 * AT THE FOUNDATION AND ABOVE the senses themselves change - it is what the
 * realm is for - and the band is readable as a band.
 *
 * A SPIRIT TIDE IS THE EXCEPTION AND IS EXEMPT FROM ALL OF IT. The hair lifts
 * on the arms. Nobody needs a rung to notice that the world has changed in the
 * last hour, and everybody local is already moving.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND EVERY READING IS SAID TWICE, BECAUSE IT HAS TWO AUDIENCES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A narrator is told ABOUT a cultivator; a player IS one. One string served
 * both, so with no model configured the opening screen read *"They were raised
 * on ground like this"* about the player, two lines above a sentence that said
 * *"you"*. The ruling: to the player it says YOU.
 *
 * `value` and `because` stay third person and are the narrator's. `toThePlayer`
 * is the same fact addressed to the person standing on the ground, and both
 * come off one row so a reading cannot exist in one channel and not the other.
 */

import type { AmbientQi } from '../../schema/cultivation.js';
import {
    measured,
    perceived,
    unknown,
    type AnAnswer
} from '../social/how-an-answer-is-known.js';

/**
 * The rung at which the ground itself becomes readable.
 *
 * `ordinalStart` of Foundation Establishment. Not a new threshold: the ladder
 * already treats this as the first real one - it is where the body is rebuilt
 * rather than merely filled - and inventing a second opinion about where a
 * cultivator's senses change would be two answers to one question.
 */
export const READS_THE_GROUND_AT = 13;

/** The bands in order, so two of them can be compared without a table. */
const HOW_MUCH_QI: readonly AmbientQi[] = ['thin', 'normal', 'dense', 'spirit_tide'];

/** Where a band sits, with anything unlisted treated as ordinary. */
const depth = (band: AmbientQi): number => {
    const at = HOW_MUCH_QI.indexOf(band);
    // `sealed_vein` is off the end of the ordinary scale by construction - the
    // catalog gives it weight zero in the ambient roll, because it is found
    // rather than encountered.
    return at >= 0 ? at : HOW_MUCH_QI.length;
};

/**
 * What it is like to stand in a band, for anybody who can read one.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS QI, NOT AIR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every one of these opened on THE AIR - "the air here gives very little back",
 * "the air here is unremarkable". The design owner, ruling on the wording:
 *
 *   *"thick air is not very great, xianxia doesn't talk about air"* -
 *   *"say thick with qi"*
 *
 * And a model handed "the air here" writes humidity. Measured, one did: given
 * ORDINARY ground it produced *"the air here has always felt heavy in the
 * lungs, a thickness you have known since childhood"* - which is weather, and
 * the wrong band as well. The word `air` leaves a reader to guess what is thin
 * or thick ABOUT it, and the guess is always physical. `sealed_vein` keeps its
 * breath imagery because that one IS about air nobody has breathed, which is
 * the whole economy of exploration in one sensation and the reason people die
 * getting into rooms like that.
 *
 * THIS TABLE WAS KEPT TWICE, here and in `facts.ts`, and the two copies had
 * already drifted: the web copy's tide and sealed vein each carried a closing
 * clause this one had lost. One owner now, read through
 * `describeAmbientPerceived` by everything that wants the band named and by
 * the two branches below that nobody needs a rung for.
 */
const THE_BAND_AS_A_BAND: Record<AmbientQi, string> = {
    thin: 'The qi here gives very little back. A long sitting yields what a short one should, and everybody local has stopped remarking on it.',
    normal: 'The qi here is ordinary. It neither helps nor gets in the way, which is most places.',
    dense: 'The qi here is thick enough to feel on the first breath. Whatever is under this ground is close to the surface, and the ground shows signs of being worked.',
    spirit_tide: 'The hair lifts on the arms. The qi is running heavier than it was an hour ago, and it will not stay that way. Somewhere out of sight people are already moving.',
    sealed_vein: 'The air in here has not been breathed. The qi is thicker than anything outside and it does not move, and the first lungful is enough to understand why people die getting into rooms like this.'
};

/** What it is like to stand in it. The narration-safe rendering of a band. */
export function describeAmbientPerceived(ambient: AmbientQi): string {
    return THE_BAND_AS_A_BAND[ambient];
}

/** One reading, in the two persons its two channels take. */
interface Reading {
    /** About the cultivator, as the narrator is given it. */
    readonly text: string;
    /** The same fact addressed to the player. Omitted where nobody is named. */
    readonly toThePlayer?: string;
}

/**
 * A reading of the ground, for the writer and for the one standing on it.
 *
 * `value` and `because` are `AnAnswer`'s own and are the narrator's channel.
 * `toThePlayer` is what the engine prints when no model answers, and it is
 * populated whether or not there was anything to tell - where the answer is
 * `unknown`, saying so IS the answer.
 */
export interface WhatTheGroundSays extends AnAnswer<string | null> {
    readonly toThePlayer: string;
}

const bothWays = (said: Reading, answer: AnAnswer<string | null>): WhatTheGroundSays =>
    ({ ...answer, toThePlayer: said.toThePlayer ?? said.text });

/**
 * What somebody standing here can actually tell about the qi.
 *
 * Returns the SENTENCE they would arrive at, tagged with how they came by it -
 * and a `value` of `null` where the honest answer is that there is nothing to
 * say, which the type makes the caller handle rather than hope about.
 * `theyCanTell` narrows it.
 *
 * The caller renders; this decides whether there is anything to render.
 */
export function whatTheyCanTellOfTheGround(
    here: AmbientQi,
    theirOrdinal: number,
    /**
     * The ground that raised them, which is the only yardstick a novice has.
     *
     * Null where the run does not know - and then a novice on ordinary ground
     * genuinely has nothing to say, which is the honest answer rather than a
     * gap to be filled with the band.
     */
    home: AmbientQi | null
): WhatTheGroundSays {
    // ── THE TWO NOBODY NEEDS A RUNG FOR ──────────────────────────────────
    if (here === 'spirit_tide') {
        const said = { text: THE_BAND_AS_A_BAND.spirit_tide };
        return bothWays(said, perceived(
            said.text,
            'A tide is a change, and a change is felt by anybody who was here before it.'
        ));
    }
    if (here === 'sealed_vein') {
        const said = { text: THE_BAND_AS_A_BAND.sealed_vein };
        return bothWays(said, perceived(
            said.text,
            'Nothing has drawn on this. It does not take a trained sense to notice that.'
        ));
    }

    // ── THE TRAINED SENSE ────────────────────────────────────────────────
    if (theirOrdinal >= READS_THE_GROUND_AT) {
        const said = { text: THE_BAND_AS_A_BAND[here] };
        return bothWays(said, measured(said.text, 'The ground is readable from the Foundation up.'));
    }

    // ── AND THE ONLY YARDSTICK A NOVICE HAS ──────────────────────────────
    if (home === null) {
        const said = {
            text: 'They have nothing to measure this against and no sense trained to read it.',
            toThePlayer: 'You have nothing to measure this against and no sense trained to read it.'
        };
        return bothWays(said, unknown(said.text));
    }
    const step = depth(here) - depth(home);
    if (step === 0) {
        const said = {
            text: 'They were raised on ground like this. They have breathed nothing else and '
                + 'have nothing to set it against.',
            toThePlayer: 'You were raised on ground like this. You have breathed nothing else and '
                + 'have nothing to set it against.'
        };
        return bothWays(said, unknown(said.text));
    }
    const said = againstHome(step);
    return bothWays(said, perceived(
        said.text,
        'Below the Foundation the only reading anybody has is against where they came from.'
    ));
}

/** How this ground reads against the ground that raised them, and nothing finer. */
function againstHome(step: number): Reading {
    if (step > 1) return {
        text: 'The qi here is thicker than anything they have stood in. They have no measure '
            + 'for it.',
        toThePlayer: 'The qi here is thicker than anything you have stood in. You have no '
            + 'measure for it.'
    };
    if (step === 1) return {
        text: 'The qi here is better than the ground that raised them. They can feel the '
            + 'difference and cannot put a figure on it.',
        toThePlayer: 'The qi here is better than the ground that raised you. You can feel the '
            + 'difference and cannot put a figure on it.'
    };
    if (step < -1) return {
        text: 'The qi here is thinner than anything they have stood in, and a long sitting '
            + 'would show it.',
        toThePlayer: 'The qi here is thinner than anything you have stood in, and a long '
            + 'sitting would show it.'
    };
    return {
        text: 'The qi here is thinner than the ground that raised them.',
        toThePlayer: 'The qi here is thinner than the ground that raised you.'
    };
}
