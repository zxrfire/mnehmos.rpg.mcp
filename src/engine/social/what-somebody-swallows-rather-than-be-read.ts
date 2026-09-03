/**
 * Whether somebody about to be read swallows the thing that stops it.
 *
 * The mechanical half of this is small. The half that matters is that it is a
 * CHOICE somebody makes about their own death, and the engine's job is to
 * compute what follows from their situation rather than to decide what they
 * ought to value.
 *
 * ── WHAT IT IS FOR, WHICH DECIDES EVERY TERM BELOW ───────────────────────
 *
 * A soul search is a capability of the realm, not an art, so anybody above
 * the Nascent Soul can read anybody they take alive. And the search is worst
 * from far above precisely because it is EASIEST from far above: four realms
 * up takes everything and leaves the subject whole. Being captured by
 * somebody vastly stronger is not a risk of dying, it is a certainty of
 * telling them everything and living afterwards.
 *
 * So this is not a courage roll and it is not despair. It is somebody
 * answering one question: is what I am carrying worth more than I am?
 *
 * ── THREE THINGS DECIDE IT, ALL READ OFF STATE ───────────────────────────
 *
 *   DO THEY HAVE ONE. No pill, no decision. Most people do not carry one and
 *   the whole trope is that the ones who do were sent somewhere.
 *
 *   IS THERE ANYTHING TO PROTECT. Knowledge rows are keyed on the holder, so
 *   "does this person hold something somebody would want" is a query rather
 *   than a judgement. A farmhand with a pill in their sleeve does not take it
 *   because there is nothing in them worth the death.
 *
 *   WOULD THE SEARCH ACTUALLY GET IT. `whatASoulSearchTakes` already answers
 *   this exactly, and it is asked here rather than guessed. Somebody who
 *   would hold - a peer, or a reader below the line - has nothing to
 *   forestall, and swallowing it then would be the engine killing an NPC to
 *   no purpose.
 *
 * ── AND WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────
 *
 * NO ROLL. A person in this position either has a reason or does not, and a
 * die would make the same person answer differently on two runs of the same
 * seed for no fact about them.
 *
 * NO ALIGNMENT TEST. A righteous courier and a demonic one both swallow it,
 * for the same reason, and neither is braver. What differs is what their
 * houses put in them and how much - which this reads, through the rows.
 *
 * NO LOYALTY STAT. There is not one, and adding one to decide this would be
 * inventing a number to answer a question the ledger can already answer.
 *
 * 天道无情. What follows from swallowing it is the same either way: a body
 * with nothing in it. Nothing here records that they were brave, and the
 * grudge their house opens about their death is the same row it would open
 * for any other.
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
 * The one thing they hold that a house would send somebody to get.
 *
 * Read off the rows rather than off a "secret" flag nobody maintains. A
 * memory held at `known` with real confidence is somebody who was THERE; a
 * whisper is gossip, and nobody dies over gossip.
 *
 * Exported because the same test decides whether a house issues them a pill in
 * the first place, and two answers to "is this person carrying something"
 * would be two different people.
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
 * Decide it.
 *
 * Pure. The caller does the swallowing - removes the pouch row, sets
 * `soulState` to `fading` and `identityContinuity` to 0, and writes the death
 * through whatever handles every other death. Nothing about the aftermath is
 * decided here, because the aftermath is not special.
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

    // Asked first, because it is the answer for almost everybody and because
    // the three below are all reasons a person WITH one declines. Somebody
    // carrying nothing is not making a decision at all.
    if (!carriesTheQuietPill(who.carrying)) return no('has_none');

    // Nobody is in there to choose. A body already emptied - by a search that
    // went too far, or by a pill somebody already took - cannot take another.
    if (search.why === 'nothing_left') return no('already_gone');

    // THE SEARCH ASKED RATHER THAN GUESSED. A peer who would hold, or a
    // captor below the line, takes nothing - so there is nothing to forestall,
    // and swallowing it here would be the engine spending a life for no fact.
    if (!search.opened) return no('the_search_would_have_failed');

    // And whether any of what is about to be taken was worth the death. The
    // search decides how much comes across; this decides whether that much
    // mattered.
    // The rows the search would actually have taken, in their full shape.
    // `took` is a copy carrying only what comes across, so the question of
    // whether it MATTERED is asked of the originals.
    const taken = new Set(search.took.map(row => row.id));
    const grave = worthDyingToKeep(who.holds.filter(row => taken.has(row.id)));
    if (grave.length === 0) return no('nothing_worth_it');

    return { swallowed: true, why: 'it_is_worth_more_than_they_are', wouldHaveLost };
}
