/**
 * What a house offers somebody joining it, and how badly it wants them. The design
 * owner: *"they might offer something one rung below what their own cultivators
 * have at 29... or if you are renowned they might offer sword elder regardless...
 * it might also give a closed door, depends how badly they want you"*, and *"an
 * elder with no office should be rare... so no and barely are both NO."*
 */

import { getMembersOf } from '../../data/cultivation/members.js';
import { getSect } from '../../data/cultivation/sects.js';
import { entryRankIndexFor } from '../cultivation/what-each-rung-of-a-house-ladder-requires.js';
import { heightAloneWouldHideThem } from '../social/presence-recognition.js';
import type { Standing } from '../social/what-is-said-about-somebody.js';

/** One person already on the house's roll, as the roster holds them. */
export interface PeerOnTheRoll {
    rankIndex: number;
    realmOrdinal: number;
}

/**
 * How far either side of the asker's rung counts as "at your cultivation".
 * MEASURED, not chosen: a peer within two rungs exists in 65% of catalog cases
 * against 76% within four, and the extra eleven points are bought by calling
 * somebody a realm boundary away a peer.
 */
export const NEAR_WINDOW = 2;

/**
 * Which silence left the offer with no ordinary reference point. REPORTED, never
 * acted on: none of the three decides an outcome, and all three are worth telling a
 * player because they say opposite things about the house.
 */
export type SilentRoster = 'nobody_near_you' | 'nobody_under_you' | 'beyond_reading';

/**
 * How badly they wanted them. `closed_door` covers both NOT wanting somebody and
 * BARELY wanting them - a house does not carry a titled stranger it is lukewarm
 * about, so a rank in name only sits at the other end of the scale entirely.
 */
export type OfferBand =
    | 'closed_door'
    | 'under_their_own'
    | 'level_with_their_own'
    | 'above_their_own';

export interface EntryOffer {
    band: OfferBand;
    /** Median rank of the house's own people at the asker's rung. Null if silent. */
    peerRank: number | null;
    /** Which reference answered, or which silence there was instead. */
    anchor: 'peers_near' | 'nearest_below' | SilentRoster;
    /** How many of the house's own people the reference was taken from. */
    peerCount: number;
    /**
     * The rung the bands count from: one under the peers, or where the roster is
     * silent the ladder's own arithmetic title. The lookup is too generous
     * everywhere the roster can judge and exactly right where it cannot, because
     * a title with nothing under it costs the house nothing to give.
     */
    baseline: number;
    /** What the house offers. Null only for a closed door. */
    offered: number | null;
    /** The council's reading, echoed so a caller can say why. */
    leaning: number | null;
    /** One factual line for the mechanical channel. Never narration. */
    line: string;
}

/** What one decider has heard about the asker, off `whatIsSaidAbout`. */
export interface WhatADeciderHasHeard {
    deciderId: string;
    /** How many tellings naming the asker reached them. Zero is the common case. */
    heard: number;
    /** What those tellings add up to. Speech only, never checked against fact. */
    saidToBe: Standing;
}

/**
 * How well a name has travelled, as the `readingOf` term the council takes.
 */
export function renownReading(
    heardBy: readonly WhatADeciderHasHeard[]
): (personId: string) => number {
    const byId = new Map(heardBy.map(h => [h.deciderId, h]));
    return (personId: string): number => {
        const h = byId.get(personId);
        if (!h || h.heard === 0) return 0;
        return h.saidToBe === 'well spoken of' ? 1
            : h.saidToBe === 'ill spoken of' ? -1
                : 0;
    };
}

/**
 * Where the bands sit on a leaning normalised to -1..+1. NOT SYMMETRIC, and the
 * asymmetry is the ruling: anything at or below a mild dislike is a closed door,
 * while a mild warmth is only the ordinary offer. Harsh at the bottom and slow
 * at the top, which is what makes the outsider's slight the common experience.
 */
const BANDS: readonly { upTo: number; band: OfferBand; rungs: number }[] = [
    { upTo: -0.15, band: 'closed_door', rungs: 0 },
    { upTo: 0.15, band: 'under_their_own', rungs: 0 },
    { upTo: 0.5, band: 'level_with_their_own', rungs: 1 },
    { upTo: Infinity, band: 'above_their_own', rungs: 2 }
];

function bandFor(leaning: number): { band: OfferBand; rungs: number } {
    for (const row of BANDS) if (leaning <= row.upTo) return row;
    return BANDS[BANDS.length - 1];
}

function median(xs: readonly number[]): number {
    const sorted = [...xs].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

/**
 * What this house would seat this cultivator at, if they asked today. `leaning`
 * is optional: with none supplied the answer is the ordinary offer, and it is
 * never the arithmetic lookup unless the roster is silent.
 */
export function entryOfferFor(input: {
    /** The house's own rank ladder. Its last entry is the head. */
    ranks: readonly string[];
    /** The rung the house admits at, for the arithmetic title. */
    admissionOrdinal: number;
    /** The whole roll. The head's rank is filtered out here, not by the caller. */
    roll: readonly PeerOnTheRoll[];
    askerOrdinal: number;
    /** `WhereTheBodyLands.leaning`, when the caller has read the council. */
    leaning?: number | null;
}): EntryOffer {
    const rankCount = input.ranks.length;
    // The head is not a peer. This line stops the Burnt Earth Temple's Abbot at
    // ordinal 20 setting the reference for somebody at 21.
    const headIndex = Math.max(0, rankCount - 1);
    const topOffer = Math.max(0, headIndex - 1);
    const peers = input.roll.filter(p => p.rankIndex < headIndex);
    const leaning = input.leaning ?? null;
    const { band, rungs } = bandFor(leaning ?? 0);

    const near = peers.filter(
        p => Math.abs(p.realmOrdinal - input.askerOrdinal) <= NEAR_WINDOW
    );
    // The nearest below, and only ever ONE person: a median of everybody underneath
    // would answer about the whole lower half of the house rather than about the
    // rung the asker stands on.
    const canRead = (p: PeerOnTheRoll): boolean =>
        !heightAloneWouldHideThem(input.askerOrdinal, p.realmOrdinal);
    const anyBelow = peers.filter(p => p.realmOrdinal < input.askerOrdinal);
    const below = anyBelow.filter(canRead);
    const nearest = below.length > 0
        ? below.reduce((a, b) => (b.realmOrdinal > a.realmOrdinal ? b : a))
        : null;

    let peerRank: number | null = null;
    let anchor: EntryOffer['anchor'];
    let peerCount = 0;
    if (near.length > 0) {
        peerRank = median(near.map(p => p.rankIndex));
        anchor = 'peers_near';
        peerCount = near.length;
    } else if (nearest !== null) {
        peerRank = nearest.rankIndex;
        anchor = 'nearest_below';
        peerCount = 1;
    } else if (anyBelow.length > 0) {
        // People below, and not one can see how high the candidate stands.
        anchor = 'beyond_reading';
    } else {
        anchor = peers.length === 0 ? 'nobody_near_you' : 'nobody_under_you';
    }

    // One under their peers - THE WHOLE RULE - or, with nobody to be one under,
    // the ladder's own arithmetic title.
    const baseline = peerRank !== null
        ? Math.max(0, peerRank - 1)
        : Math.min(topOffer, entryRankIndexFor(
            input.ranks, input.admissionOrdinal, input.askerOrdinal
        ));

    const offered = band === 'closed_door'
        ? null
        : Math.min(topOffer, Math.max(0, baseline + rungs));

    const reference = peerRank !== null
        ? `${peerCount} of the house's own ${anchor === 'peers_near'
            ? `within ${NEAR_WINDOW} rungs of ordinal ${input.askerOrdinal}`
            : `below ordinal ${input.askerOrdinal}, the nearest of them,`} hold rank `
          + `${peerRank} (${input.ranks[peerRank] ?? '?'}) by the median, so the ordinary `
          + `offer is one under that at ${baseline} (${input.ranks[baseline] ?? '?'}) - `
          + 'the cultivation without the standing.'
        : `${anchor === 'nobody_near_you'
            ? 'The roll holds nobody but whoever heads it, so this house has no standard of '
              + 'its own to measure a newcomer against'
            : anchor === 'beyond_reading'
                ? `All ${anyBelow.length} on this roll who stand beneath ordinal `
                  + `${input.askerOrdinal} are far enough beneath it to make out the gap and `
                  + 'not the height, so nobody here can place this candidate by looking'
                : `All ${peers.length} on the roll stand above ordinal ${input.askerOrdinal}, so `
                  + 'there is nobody here for them to be placed over'}`
          + `. With no reference the rungs are counted from the ladder's own arithmetic at `
          + `${baseline} (${input.ranks[baseline] ?? '?'}), which costs the house nothing to `
          + 'give because there is nothing behind it.';

    return {
        band,
        peerRank,
        anchor,
        peerCount,
        baseline,
        offered,
        leaning,
        line:
            `${reference} ${leaning === null
                ? 'No council was read, so the ordinary offer stands.'
                : `The body reads them at ${leaning.toFixed(2)}, which is ${band}`}`
            + `${offered === null
                ? ' and the door does not open.'
                : `, seating them at ${offered} (${input.ranks[offered] ?? '?'}).`}`
    };
}

/**
 * What this house would seat this cultivator at, off the catalog roster. THE ONLY
 * THING IN THIS FILE THAT READS A CATALOG.
 */
export function offerAtTheDoorOf(
    factionId: string,
    askerOrdinal: number,
    leaning?: number | null
): EntryOffer | null {
    const sect = getSect(factionId);
    if (!sect) return null;
    return entryOfferFor({
        ranks: sect.ranks,
        admissionOrdinal: sect.admissionOrdinal,
        roll: getMembersOf(factionId).map(m => ({
            rankIndex: m.rankIndex,
            realmOrdinal: m.realmOrdinal
        })),
        askerOrdinal,
        leaning
    });
}
