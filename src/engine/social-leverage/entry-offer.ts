/**
 * What a house offers somebody joining it, and how badly it wants them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, QUANTIFIED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Played: a cultivator at ordinal 25 joined the Azure Cloud Pavilion, which
 * admits from 3 and has six ranks, and was seated as **Sword Elder** - the
 * fifth of six, over a house whose own Core Disciple stands at ordinal 20 and
 * got there by years inside it.
 *
 * That is `entryRankIndexFor` working exactly as written: the promotion ladder
 * read backwards, `admission + index * ORDINALS_PER_SECT_RANK`, head excluded.
 * It is a lookup, and what it looks up is the asker's rung and nothing else.
 *
 * Measured across the whole catalog - 442 probes, 337 of them at a rung where
 * the house has somebody of its own to compare against:
 *
 *   the lookup sits ABOVE this module's ordinary answer in  234 cases
 *   level in                                                 98
 *   below in                                                  5
 *   mean overshoot                                         0.89 ranks
 *
 * So entry has been systematically about one rank too generous, and that rank
 * is precisely the thing an outsider has not got.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE SCALE, FOUR OUTCOMES, NO BRANCH TABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The design owner's rulings, in their own words:
 *
 *   > "they might offer something one rung below what their own cultivators
 *   >  have at 29 though"        - "or 29 itself"
 *   > "or if you are renowned they might offer sword elder regardless"
 *   > "it might also give a closed door, depends how badly they want you"
 *   > "an elder with no office should be rare, sects don't typically want them
 *   >  right? cuz it's bloat, unless you are good. so no and barely are both NO"
 *
 * Which is not four rules. It is one question - **how badly do they want you**
 * - read at four depths:
 *
 *   not at all      a closed door
 *   barely          a closed door
 *   ordinarily      what their own people at your rung hold, LESS ONE
 *   well            level with their own
 *   a great deal    above it, and this is where a travelled name lands
 *
 * `whatTheBodyWants` already answers that question for everything else a body
 * decides, and it returns one number. Every row above is a band on it. That is
 * the whole design: nothing here enumerates an outcome, and a fifth would be a
 * fifth band rather than a fifth branch.
 *
 * NOTE WHAT COLLAPSED, BECAUSE IT WAS DRAFTED THE OTHER WAY. A rank in name
 * only was written here as the band above the door, and it is not: a house
 * carrying somebody with a title, a stipend and no room is carrying **bloat**,
 * and no house does that for somebody it is merely lukewarm about. Barely
 * wanting somebody is a refusal. See the section on office-less elders below
 * for where that position actually sits, which is the opposite end.
 *
 * THE MIDDLE ROW IS THE DEFAULT AND IS THE ONE THAT MATTERS. **An outsider has
 * the cultivation and not the standing.** Their Core Disciple at your rung
 * earned it inside the house; you did not, so you are placed just under your
 * peers. It is a real slight, it is legible, and it is something to climb out
 * of.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THE REFERENCE POINT IS THE ROSTER, NOT A BAND
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `rankRealmBand` was the obvious candidate and is the wrong instrument, which
 * was settled by measuring rather than by arguing. It answers *what band may
 * somebody at this rank stand in* - a permissive CEILING - so inverting it
 * returns the most generous rank whose floor the asker clears. Inverted at the
 * Azure Cloud Pavilion it hands **the Pavilion Master's seat to somebody at
 * ordinal 17**. It cannot be the reference and this module does not read it.
 *
 * What it reads is the house's own roll, which is what the ruling actually
 * says: *what their own cultivators have at 29*.
 *
 * ── TWO THINGS THE ROSTER FORCES, BOTH FOUND BY MEASURING ────────────────
 *
 *   THE MEDIAN, NEVER THE MAXIMUM. Rank is not monotone in ordinal inside a
 *   house, deliberately - Shi Weiran is a Sword Elder at ordinal 16 and Ru
 *   Anxi a Core Disciple at 20, because standing comes from years rather than
 *   from rung. A maximum lets one exceptional insider inflate every offer made
 *   at their height, which turns the reference point into noise.
 *
 *   THE HEAD IS NOT A PEER. The Sweptground Temple's Abbot stands at ordinal
 *   20, so any rule reading the whole roll makes the Abbot the reference for
 *   anybody at 21 and then offers the rank below the headship. `ranks.length -
 *   1` is excluded here for that reason, which is a different reason from the
 *   one `entryRankIndexFor` already had (a headship is a succession, not a
 *   promotion). Both are true; this one bites first.
 *
 * ── AND A SILENT ROSTER FORCES NOTHING ───────────────────────────────────
 *
 * A peer within two rungs exists in 65% of catalog cases and within four in
 * 76%; above ordinal 29 most houses have nobody at all. That silence was first
 * designed as an outcome - *the house has no place to put you* - and that was
 * wrong. It removes the ordinary REFERENCE POINT; it does not decide anything.
 *
 * So where the roster cannot answer, the leaning does all the work with
 * nothing to anchor it: a house that badly wants somebody it cannot rank will
 * find a title for them, and a house that does not - or barely does - shuts
 * the door. Both are the same rule. What the silence changes is only what the
 * rungs are counted from - see {@link EntryOffer.anchor} - and which silence
 * it was, which is worth telling a player because the two say opposite things
 * about the house.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ELDER WITH NO OFFICE IS OFF THIS SCALE, AND AT THE TOP OF IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * An office in this world is a sealed room - `kind: 'vault'`, measured at 2.06
 * rooms per house against 2.3 deciders - so an elder with no room is an elder
 * in name only by the ABSENCE of something rather than by a flag, and this
 * module creates no such flag.
 *
 * What it is NOT is a consolation prize. A house takes one because somebody is
 * good enough to be worth the bloat, which puts it at the wanted end of the
 * scale rather than the tolerated end. And it is a real position rather than
 * an empty title, because of the second half of the ruling:
 *
 *   > "you can take disciples as an elder with no office tho and have the
 *   >  standing of one"
 *
 * ELDER STANDING, AND THE RIGHT TO TAKE DISCIPLES - which is a different route
 * to power rather than a lesser one. A portfolio gives you a room; disciples
 * give you people. `leadership.ts` already models the whole of it and nothing
 * has to be built: every elder has a following, its size runs on
 * `(rankIndex + 1)` raised to the seniority exponent, a following discounts
 * what any order costs the holder through `followingShare`, and *elders leave
 * and take their followings with them*. Because that same number is the
 * aggregation weight in `whatTheBodyWants`, **somebody with no office and many
 * disciples can outweigh somebody with a sealed room and none.**
 *
 * Two existing systems meeting, and this module's only part in it is to hand
 * over the RUNG. Whether a room is attached is the portfolio layer's answer,
 * it can change later, and that is the arc.
 *
 * AND THE SAME RUNG IS TWO DIFFERENT VERDICTS. A conclave disciple stands at
 * an elder's height, young, with a future; an elder with no office stands
 * there on what they already are. That distinction is being built next door
 * and is deliberately not defined here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO AXES, AND NEITHER SUBSTITUTES FOR THE OTHER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   THE RUNG IS READ.      A house sizing up a newcomer does not need their old
 *                          house's title translated to know where they stand.
 *                          That is the whole reason the roster comparison here
 *                          is sound: *their own people near this rung* compares
 *                          CULTIVATIONS, never titles.
 *   THE TITLE IS DISPUTED. What a Keystone is worth against a Core Formation is
 *                          a live political fight - `TITLE_TRANSLATIONS` has the
 *                          Ninefold Ledger mapping band for band while the Weir
 *                          Office pushes bands upward because grant fees are
 *                          priced by rank. What is contested is what a title
 *                          ENTITLES you to, never who is stronger.
 *
 * So renown is not how a house learns somebody's rung; they can see it. Renown
 * is how a house learns WHAT SOMEBODY HAS DONE, which is why `whatIsSaidAbout`
 * is the right instrument and a reputation-derived rank would have been the
 * wrong one. The rung sets the peer comparison; the renown moves the leaning.
 *
 * ── AND SEEING IT IS NOT UNCONDITIONAL ───────────────────────────────────
 *
 * Within range you see their rung; beyond it you see that they are beyond you.
 * `presence-recognition.ts` and `REGARD_BANDS`' `unreachable` row are that
 * limit, and it is read here rather than restated - a peer who cannot make out
 * how high a candidate stands cannot be the reference for placing them. That
 * produces `beyond_reading`, which is the silent-roster case arriving from the
 * other side and is the sharpest of the three.
 *
 * WHAT THIS MODULE DOES NOT MODEL, DELIBERATELY: there are three routes to
 * somebody's rung and only one of them is looking. It is also askable - and
 * answering costs nothing, so it belongs at `a_courtesy`, the bottom of the ask
 * scale - and it travels by being told. **A gate on perceiving is not a gate on
 * knowing, because people talk.** A house appraising a candidate has all three
 * routes, which is why `beyond_reading` is a statement about what the ROSTER
 * can place and not a claim that the house is ignorant. Whether the ask surface
 * actually reaches a free question about somebody's own plain facts is a
 * question for that layer; `a_courtesy` exists and is where it should land.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RENOWN IS NOT A SCORE, AND THERE IS NO BRANCH ON IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The top row - *"if you are renowned they might offer sword elder
 * regardless"* - is the one that would most easily become a stat. It does not,
 * because this world already answers *has this person's name reached these
 * people*: `whatIsSaidAbout` in `src/engine/social/`, which computes and never
 * stores, and gives per observer what reached them and whether it was said
 * well or ill.
 *
 * So renown enters as `readingOf` on `whatTheBodyWants` - the same aggregate
 * that decides everything else - and the leaning does the rest.
 * {@link renownReading} is the adapter and it is four lines. There is no
 * renown field, no threshold on fame, and no `if (renowned)` anywhere.
 *
 * The same aggregate is why an elder who dislikes you can seat you lower, or
 * shut the door outright, and why `whoMovedIt` can name which elder did it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS DELIBERATELY DOES NOT DECIDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * AN OFFICE IS A SEALED ROOM - `kind: 'vault'`, measured at 2.06 rooms per
 * house against 2.3 deciders - so **an elder with no room is an elder in name
 * only by the absence of something rather than by a flag**, and this module
 * creates no such flag. {@link EntryOffer.band} says the offer was made at the
 * bottom of the scale so a caller can tell the player plainly what they are
 * being given; whether a room is attached is the portfolio layer's answer and
 * it can change later, which is the arc.
 *
 * AND THE SAME RUNG IS TWO DIFFERENT VERDICTS. A conclave disciple stands at
 * an elder's height, young, with a future; an elder in name only stands there
 * finished. That distinction is being built next door and is not defined here.
 * This module supplies the RUNG and the BAND it came from, which is what that
 * layer needs to tell the two apart, and nothing more.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND IT IS A READ, SO IT ANSWERS BEFORE ANYBODY JOINS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every input is something the world already holds and nothing here writes.
 * That is required rather than tidy: *"if they'll have me, I'll join"* has to
 * resolve to *"they would, at Core Disciple. Do you want to."* - and a
 * yes-or-no with no rung attached is a much weaker sentence than an offer.
 *
 * Pure. Roster in, an offer out. No repository, no I/O, no RNG.
 */

import { entryRankIndexFor } from '../cultivation/what-each-rung-of-a-house-ladder-requires.js';
import { heightAloneWouldHideThem } from '../social/presence-recognition.js';
import type { Standing } from '../social/what-is-said-about-somebody.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CALLER HAS TO HAVE READ ALREADY
// ─────────────────────────────────────────────────────────────────────────

/** One person already on the house's roll, as the roster holds them. */
export interface PeerOnTheRoll {
    rankIndex: number;
    realmOrdinal: number;
}

/**
 * How far either side of the asker's rung counts as "at your cultivation".
 *
 * Two, and it is measured rather than chosen: a peer within two rungs exists
 * in 65% of catalog cases against 76% within four, and widening it buys eleven
 * points of coverage by calling somebody a realm boundary away a peer. The
 * fallback handles the rest and says which reference answered, which is better
 * than a wide window quietly pretending the reference was close.
 */
export const NEAR_WINDOW = 2;

/**
 * Which silence left the offer with no ordinary reference point.
 *
 * Reported rather than acted on: neither value decides an outcome, and both
 * are worth telling a player because they say opposite things about the body.
 *
 *   NOBODY NEAR YOU    a house that cannot judge you. Its roll holds nobody
 *                      but the head, so there is no standard to measure a
 *                      newcomer against and any title is a guess.
 *   NOBODY UNDER YOU   a house where a title is all there is to give. Every
 *                      person on the roll stands above the asker, so there is
 *                      nobody for them to be placed over.
 *   BEYOND READING     a house that cannot see how high the candidate stands.
 *                      Everybody who might have been the reference is far
 *                      enough beneath them that the gap is all they can make
 *                      out. See the two-axes section in the header.
 */
export type SilentRoster = 'nobody_near_you' | 'nobody_under_you' | 'beyond_reading';

/**
 * How badly they wanted them, as the depths the owner named.
 *
 * A band on one number, never a branch. `closed_door` is the bottom of the
 * scale rather than a refusal the roster forced, and it covers both not
 * wanting somebody and barely wanting them - a house does not carry a titled
 * stranger it is lukewarm about.
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
     * The rung the bands count from: one under the peers, or - where the
     * roster is silent - the ladder's own arithmetic title.
     *
     * The old lookup is too generous everywhere the roster can judge and is
     * exactly right where it cannot, because a title with nothing under it
     * costs the house nothing to give.
     */
    baseline: number;
    /** What the house offers. Null only for a closed door. */
    offered: number | null;
    /** The council's reading, echoed so a caller can say why. */
    leaning: number | null;
    /** One factual line for the mechanical channel. Never narration. */
    line: string;
}

// ─────────────────────────────────────────────────────────────────────────
// RENOWN, AS A READING RATHER THAN A SCORE
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * Nothing is weighted by how famous somebody is, because there is no such
 * number: a decider who has heard nothing reads zero, one who has heard well
 * of them reads positive, one who has heard ill reads negative. A name that
 * reached the whole room well moves the mean; a name that reached nobody does
 * not move it at all, which is the correct answer for the overwhelming
 * majority of people who ever walk up to a gate.
 *
 * Deliberately not scaled by `heard` beyond having heard at all. Repetition is
 * how slander gets its confidence - `what-is-said-about-somebody.ts` is
 * emphatic that nothing upgrades a story by being retold - so counting volume
 * would make the loudest rumour the strongest recommendation.
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

// ─────────────────────────────────────────────────────────────────────────
// THE SCALE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where the bands sit on a leaning already normalised to -1..+1.
 *
 * NOT symmetric, and the asymmetry is the ruling. Anything at or below a mild
 * dislike is a closed door, because a house that only barely wants somebody
 * does not take them; but a mild WARMTH is only the ordinary offer, and it
 * takes real enthusiasm to be seated level with people who earned it. So the
 * scale is harsh at the bottom and slow at the top, which is what makes the
 * outsider's slight the common experience rather than a special case.
 *
 * The upper threshold is a half, which is the same split `whatTheBodyWants`
 * already produces between a room that mildly leans and one that has made its
 * mind up.
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

// ─────────────────────────────────────────────────────────────────────────
// THE OFFER
// ─────────────────────────────────────────────────────────────────────────

/**
 * What this house would seat this cultivator at, if they asked today.
 *
 * `leaning` comes from `whatTheBodyWants` and is optional: with none supplied
 * the answer is the ordinary offer, which is what a caller with no council to
 * read should get. It is never the old lookup unless the roster is silent.
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
    // The head is not a peer, and this is the line that stops the Sweptground
    // Temple's Abbot at ordinal 20 setting the reference for somebody at 21.
    const headIndex = Math.max(0, rankCount - 1);
    const topOffer = Math.max(0, headIndex - 1);
    const peers = input.roll.filter(p => p.rankIndex < headIndex);
    const leaning = input.leaning ?? null;
    const { band, rungs } = bandFor(leaning ?? 0);

    const near = peers.filter(
        p => Math.abs(p.realmOrdinal - input.askerOrdinal) <= NEAR_WINDOW
    );
    // The nearest below, and only ever one person: a fallback that took a
    // median of everybody underneath would be answering about the whole lower
    // half of the house rather than about the rung the asker stands on.
    // ── AND A REFERENCE HAS TO BE ABLE TO SEE THEM ───────────────────────
    //
    // A rung is observable rather than inferred, which is why comparing
    // cultivations works at all - a house does not need a newcomer's old title
    // translated to know where they stand. But it is observable WITHIN RANGE:
    // `REGARD_BANDS` calls a gap of nine or more `unreachable` and says such a
    // person "is not put in front of them", so somebody far enough beneath a
    // candidate makes out the gap and not the height.
    //
    // So a peer who cannot read the candidate cannot be the reference either.
    // Near peers are inside the window by construction and always can; this
    // only ever bites the fallback, and when it takes the last of them the
    // house is left unable to place the candidate at all.
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
        // There were people below and not one of them can see how high this
        // candidate stands. The sharpest of the three silences.
        anchor = 'beyond_reading';
    } else {
        anchor = peers.length === 0 ? 'nobody_near_you' : 'nobody_under_you';
    }

    // One under their peers - THE WHOLE RULE - or, where there is nobody to be
    // one under, the ladder's own arithmetic title. See `EntryOffer.anchor`.
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
