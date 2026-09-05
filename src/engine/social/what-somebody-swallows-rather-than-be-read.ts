/**
 * Whether somebody about to be read swallows the thing that stops it. Not a courage
 * roll and not despair: a search is worst from far above precisely because it is
 * easiest from there, so capture by somebody vastly stronger is not a risk of dying
 * but a certainty of telling them everything and living. The only question is
 * whether what they carry is worth more than they are.
 */

import { SOUL_QUENCHING_PILL_ID } from '../../data/cultivation/pills.js';
import {
    type AMemoryHeld,
    type TheStateOfASoul,
    whatASoulSearchTakes
} from './what-a-soul-search-takes.js';

/** Why they did or did not. Every value is a sentence somebody could say. */
export type WhyTheyDidOrDidNot =
    /** They are not carrying one. The ordinary case for almost everybody. */
    | 'has_none'
    /** Nothing in them anybody would cross a room for. */
    | 'nothing_worth_it'
    /** The reader could not have taken it. Nothing to forestall. */
    | 'the_search_would_have_failed'
    /** The soul is already out. There is nobody left to decide. */
    | 'already_gone'
    /** What they are carrying is worth more than they are. */
    | 'it_is_worth_more_than_they_are';

export interface WhetherTheySwallowIt {
    readonly swallowed: boolean;
    readonly why: WhyTheyDidOrDidNot;
    /** How many of their memories the search would otherwise have taken. */
    readonly wouldHaveLost: number;
}

export interface SomebodyAboutToBeRead {
    /** Item ids in their possession. The pill is a pouch row like any other. */
    readonly carrying: readonly string[];
    readonly ordinal: number;
    readonly soul: TheStateOfASoul;
    readonly holds: readonly AMemoryHeld[];
    /** The person who has taken them, and is about to read them. */
    readonly readerOrdinal: number;
}

/**
 * The one thing they hold that a house would send somebody to get. Read off the
 * rows and not off a "secret" flag nobody maintains: a memory at `known` with real
 * confidence is somebody who was THERE, a whisper is gossip.
 */
export function worthDyingToKeep(holds: readonly AMemoryHeld[]): AMemoryHeld[] {
    return holds.filter(row =>
        (row.stance === 'knows' || row.stance === 'believes')
        && (row.stage === 'known' || row.stage === 'placed')
        && row.confidence >= 0.7);
}

/** Whether they have one on them. */
export function carriesTheQuietPill(carrying: readonly string[]): boolean {
    return carrying.includes(SOUL_QUENCHING_PILL_ID);
}

/**
 * Decides it and does nothing. The CALLER swallows: removes the pouch row, sets
 * `soulState` to `fading` and `identityContinuity` to 0, and writes the death
 * through whatever handles every other death, because it is not special.
 */
export function wouldTheySwallowIt(who: SomebodyAboutToBeRead): WhetherTheySwallowIt {
    const search = whatASoulSearchTakes({
        searcherOrdinal: who.readerOrdinal,
        subjectOrdinal: who.ordinal,
        subject: who.soul,
        held: who.holds
    });
    const wouldHaveLost = search.took.length;
    const no = (why: WhyTheyDidOrDidNot): WhetherTheySwallowIt =>
        ({ swallowed: false, why, wouldHaveLost });

    // First, because the three below are all reasons a person WITH one
    // declines. Somebody carrying nothing is not making a decision at all.
    if (!carriesTheQuietPill(who.carrying)) return no('has_none');

    // A body already emptied cannot take another.
    if (search.why === 'nothing_left') return no('already_gone');

    // Asked rather than guessed: a peer who would hold, or a captor below the
    // line, takes nothing, and swallowing it then would spend a life for no
    // fact.
    if (!search.opened) return no('the_search_would_have_failed');

    // `took` is a copy carrying only what comes across, so whether it MATTERED
    // is asked of the originals.
    const taken = new Set(search.took.map(row => row.id));
    const grave = worthDyingToKeep(who.holds.filter(row => taken.has(row.id)));
    if (grave.length === 0) return no('nothing_worth_it');

    return { swallowed: true, why: 'it_is_worth_more_than_they_are', wouldHaveLost };
}
