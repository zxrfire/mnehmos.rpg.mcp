/**
 * What somebody does after a thing is taken off them: first what the loss left them short of,
 * then what they do about you.
 *
 * The owner, on a disciple whose robes were stolen: their first move is getting something to
 * wear, they start with nothing, furious and mortified; and then it depends on the person. Some
 * say nothing to save face, some come after you privately, which includes getting the thing
 * back, and some report the loss to the punishment hall, where it always leaks and the one who
 * reported it loses face. And somebody with no face to lose may not stop to dress before coming
 * after you. None of this is special to robes.
 *
 * "Depends on personality" is `faceOf`, a trait that reads every fact and not this one alone;
 * see AGENTS.md, "A trait reads every fact".
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import { faceOf } from './how-much-their-face-matters.js';
import { REPRISAL_ORDER, type Reprisal } from './what-somebody-does-about-being-wronged.js';

/** What they do once they have covered what the loss left them short of. */
export type AfterALoss =
    /** Nothing, to anybody. The loss is theirs and so is the grudge. */
    | 'says_nothing'
    /** They come after you themselves, and getting the thing back is part of it. */
    | 'settles_it_themselves'
    /** They take it to their house's punishment hall. It cancels the thing's use and it leaks. */
    | 'reports_it';

export interface WhatTheyDoAboutALoss {
    /** Whether they cover what the loss left them short of before anything else. */
    coverFirst: boolean;
    then: AfterALoss;
    /** Where what they are short of comes from: their house, or whatever is to hand. */
    replacedFrom: 'their_house' | 'whatever_is_to_hand';
    /** Whether the story gets round their house, costing the one who lost it face. */
    itLeaks: boolean;
    /** Engine truth, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What they do about it, drawn: the trait moves the odds and does not decide (AGENTS.md, "A trait
 * reads every fact"). The prouder they are, the likelier silence or settling it themselves and
 * the less likely a report; the less face they have, the likelier a report, and the likelier
 * they come for you as they are. `canDo` is what the rung gap lets them do to you
 * (`whatTheyCanDoAboutIt`): somebody who cannot so much as drive you off rarely tries.
 */
export function whatTheyDoAboutALoss(input: {
    theirId: string;
    /** Their house, or null: with nobody to report it to, a report is not on the table. */
    houseId: string | null;
    canDo: Reprisal;
    rng: CultivationRNG;
}): WhatTheyDoAboutALoss {
    const face = faceOf(input.theirId);
    const canReachYou = REPRISAL_ORDER.indexOf(input.canDo) >= REPRISAL_ORDER.indexOf('driven_off');
    const weights: [AfterALoss, number][] = [
        ['says_nothing', 1 + Math.max(0, face) * 2],
        ['settles_it_themselves', canReachYou ? 1 + Math.abs(face) : 0.1],
        ['reports_it', input.houseId === null ? 0 : 1.5 * (1 - face)]
    ];
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    let roll = input.rng.next() * total;
    let then: AfterALoss = 'says_nothing';
    for (const [answer, weight] of weights) {
        if (roll < weight) { then = answer; break; }
        roll -= weight;
    }
    // Somebody with no face to lose, going after you, may not stop to dress first.
    const coverFirst = !(then === 'settles_it_themselves' && input.rng.next() < Math.max(0, -face));
    return {
        coverFirst,
        then,
        replacedFrom: then === 'reports_it' ? 'their_house' : 'whatever_is_to_hand',
        itLeaks: then === 'reports_it',
        line: `After a loss: face ${face.toFixed(2)}, ${canReachYou ? 'can' : 'cannot'} reach the one who took it, `
            + `${input.houseId === null ? 'no house' : `house ${input.houseId}`}. Drew ${then}`
            + `${coverFirst ? '' : ', as they are'}.`
    };
}
