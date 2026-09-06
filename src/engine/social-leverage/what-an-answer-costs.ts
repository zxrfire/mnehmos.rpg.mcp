/**
 * What saying it would cost the person being asked.
 *
 * The design owner: *"you can ask for anything they can give, obviously"* - so
 * there is no list of askable things, and the weight of an ask cannot come from
 * a list either. It comes from what parting with the thing costs the person
 * holding it.
 *
 * ── WHAT WAS BESPOKE ──────────────────────────────────────────────────────
 *
 * `WHAT_A_WITHHELD_ANSWER_WEIGHS` was one constant for every answer anybody
 * ever withheld. Where a stranger's name is, and where the senior brother they
 * came up with is, were the same price - which made the whole of the demand
 * channel one number wide.
 *
 * ── AND THE FACT IT TURNS ON ALREADY EXISTED ──────────────────────────────
 *
 * `howNearTheyStand` answers how near one person stands to another, in six
 * bands, off ties and the roll. That is the whole of what a withheld answer
 * costs: naming a name you have heard costs the reticence, naming somebody you
 * came up under costs you them. So this file is the map between two ladders
 * that both already exist and nothing else.
 *
 * The ask is still what it costs THEM. Nothing here reads the words the
 * question was put in - `AskWeight`'s own rule, and the reason a price that
 * moved with the phrasing would be a price you could talk your way out of.
 *
 * Pure lookup.
 */

import type { Nearness } from '../social/how-near-you-stand-to-somebody.js';
import type { AskWeight } from './an-attempt-to-move-somebody.js';

export interface WhatAnAnswerCosts {
    readonly ask: AskWeight;
    /** Factual, for the mechanical channel. Never narration. */
    readonly because: string;
}

/**
 * How near the thing asked about stands to the person being asked, as what
 * saying it costs them.
 *
 * Six bands onto four weights, and the collapses are the interesting part:
 * a name heard once and a face in the same market are the same reticence, and
 * a tie of their own and their own roll are the same conflict. Only the roof
 * they live under is the one that ends them.
 */
const WHAT_NAMING_THEM_COSTS: Readonly<Record<Nearness, AskWeight>> = {
    distant: 'a_real_favour',
    nearby: 'a_real_favour',
    acquainted: 'a_real_favour',
    tied: 'against_their_interest',
    house: 'against_their_interest',
    household: 'a_betrayal'
};

const WHY_IT_COSTS_THAT: Readonly<Record<Nearness, string>> = {
    distant: 'A name they have heard and nothing more. What it costs them is the reticence.',
    nearby: 'Somebody on the same ground. What it costs them is the reticence and being the '
        + 'one who said it.',
    acquainted: 'Somebody they have met. Saying where they are is a word put in somewhere.',
    tied: 'Somebody they hold a standing tie to. They end up worse off and can see that while '
        + 'they are agreeing.',
    house: 'Somebody on their own roll. Informing on one of their own is against the interest '
        + 'of the house that feeds them.',
    household: 'Their own roof, their own blood, or their own master. There is no version of '
        + 'saying it that they survive with their position intact.'
};

/**
 * What it would cost them to answer.
 *
 * `theyWouldHaveSaidIt` is read first and settles it: a thing somebody was
 * going to volunteer costs them nothing whatever it is about, and pricing it
 * higher is what made leaning on a willing speaker look like a bargain.
 */
export function whatAnAnswerCosts(input: {
    readonly nearness: Nearness;
    readonly theyWouldHaveSaidIt: boolean;
}): WhatAnAnswerCosts {
    if (input.theyWouldHaveSaidIt) {
        return {
            ask: 'a_courtesy',
            because: 'They were going to say it for the asking, so it costs them nothing at all.'
        };
    }
    return {
        ask: WHAT_NAMING_THEM_COSTS[input.nearness],
        because: WHY_IT_COSTS_THAT[input.nearness]
    };
}
