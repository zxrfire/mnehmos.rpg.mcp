/**
 * Why a house puts a party on the road.
 *
 * A sending is a party, a destination, a REASON, a cost in time, a rung band
 * it is survivable at, and a thing that happens to the house if it goes wrong.
 * This file is the reason column, and the whole of the design is one line:
 *
 * > **The reason is a field. Nothing branches on which reason it is except
 * > where the reason genuinely changes the mechanics.**
 *
 * There are exactly three places in this file where a reason changes a
 * mechanic, and every one of them is a column rather than a case:
 * {@link SendingReason.ceilingOrdinal}, {@link SendingReason.needs} and
 * {@link SendingReason.factKind}. A tenth reason wants a row and no code. An
 * eleventh reusing an existing `needs` key wants a row and no predicate.
 *
 * ── What was already here, and is therefore not here ─────────────────────
 *
 * Most of this system existed before the reason did, and the reason is the
 * only thing that was missing. Do not rebuild any of the following:
 *
 *   the two beast reasons     `WHY_A_HOUSE_GOES_OUT_AFTER_BEASTS` in
 *                             `beasts.ts` argues both of them in full - why a
 *                             core is the one high-grade thing nobody owns,
 *                             and why ground answers for what it draws. It
 *                             also says outright that they are two reasons of
 *                             many. This file is the many. It does not restate
 *                             either argument and must not.
 *   the player's half         `engine/encounters/duties.ts`. A summons and a
 *                             commission, priced off an `ENCOUNTERS` row and
 *                             the taker's standing, with refusal terms in the
 *                             obligation ledger's own vocabulary. Live, and
 *                             reached from `src/web/actions.ts`.
 *   the situations            `encounters.ts`. There is no second table of
 *                             things that happen on a road here, for the
 *                             reason `duties.ts` states in its own header.
 *   the tier                  `REGARD_BANDS` in `src/schema/cultivation.ts`.
 *                             A mission tier is how far the posting is pitched
 *                             from the person taking it, which is the one
 *                             thing regard already measures. {@link TIER_NAMES}
 *                             is a board's word for each band and nothing else:
 *                             there is no second difficulty scale in this repo.
 *   prestige                  `engine/social/what-is-said-about-somebody.ts`.
 *                             It is DERIVED from the ledger and from what is in
 *                             circulation, and there is deliberately no stored
 *                             score. A hard sending finished is a heavy fact
 *                             that travels, not a number going up.
 *   who carries the party     spirit boats. Physical, ordinal-rated, craftable
 *                             objects, owned elsewhere. Nothing here is a
 *                             conveyance and nothing here should become one.
 *   places that shut          `LocationRecord.cycle` with `nextOpeningDay`,
 *                             `nextClosingDay` and `openingsBetween` in
 *                             `engine/world/locations.ts`. Ground that opens
 *                             and closes on a schedule is already modelled, so
 *                             a sending timed to one is wiring.
 *
 * ── The list is not closed, and that is the ruling ───────────────────────
 *
 * Ten rows is what somebody could think of in one sitting, not an enumeration
 * of the ways a house can want something. The eleventh must cost a row and
 * nothing else, and the moment a reader has to add a branch to add a reason,
 * this file has failed at the only thing it exists for.
 *
 * The failure to watch for is therefore not a missing reason. It is a reader
 * who wants to add one and finds they have to add a case with it. Every column
 * below exists so that the answer to "what is different about this reason" is
 * a value. **If a new reason cannot be expressed in the existing columns, add
 * a COLUMN and fill it in for every row**, so the next reason gets it free.
 *
 * WHAT IS GENUINELY DIFFERENT: exactly three things, and all three are fields.
 * What the house must already have for the reason to arise at all; whether the
 * errand has a ceiling above which nobody is sent; and which word the ledger
 * files the result under, because the digest and the rumour layer read that
 * word and nothing else about the errand.
 *
 * WHAT IS NOT: who is strong enough, how long the party is gone, whether they
 * finish, whether anybody comes back, and what the news of it is worth. None
 * of those consult the reason. They are one function of the gap between the
 * rung the posting is pitched at and the rung the person taking it stands on,
 * which is what regard has always measured.
 *
 * ── No arithmetic here ───────────────────────────────────────────────────
 *
 * Rows state terms - days, hands, what is at stake. They do not decide who
 * wins, how likely anybody is to come back, or what the news of it is worth.
 * `engine/world/who-goes-out-for-a-house-and-what-comes-back.ts` does all of
 * that, off `REGARD_BANDS`, and it is the only place those numbers are made.
 */

import { z } from 'zod';

import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { BEAST_CHANGE_ORDINAL } from './beasts.js';
import type { RegardBand } from '../../schema/cultivation.js';
// Type-only, so no module edge is created in either direction. The world's
// ledger owns the vocabulary for what a thing WAS, and a reason that produced
// an event has to file it under a word the ledger already understands or the
// digest and the rumour layer cannot read it.
import type { EventScale, HistoricalEventKind } from '../../engine/world/history.js';

// ─────────────────────────────────────────────────────────────────────────
// THE TIER
// ─────────────────────────────────────────────────────────────────────────

/**
 * A mission tier is a regard band, named the way a board would name it.
 *
 * The owner's ruling is that missions have tiers, that the tier is what moves
 * standing, and that the top of the scale must be genuinely out of reach for
 * the person taking it or the whole thing is a wage. All three are satisfied
 * by the band that already exists, and none of them wants a second scale:
 * `REGARD_BANDS` measures precisely "how far is this pitched from where you
 * stand", which is the only sense in which one posting is harder than another.
 *
 * Note which two bands are named here that `duties.ts` will not offer. That is
 * not an oversight in either file. A house does not SEND somebody against
 * something it expects to lose them to - `summonable` is correct - but a board
 * may post one, and somebody may take it off the wall. Agency: the engine's
 * job is not to decide what is allowed, it is to say what it cost.
 */
export const TIER_NAMES: Record<RegardBand, string> = {
    unreachable: 'Standing posting',
    overmatched: 'Open posting',
    stretch: 'First rank',
    matched: 'Second rank',
    assured: 'Third rank',
    beneath: 'Errand',
    dismissed: 'Not posted'
} as const;

// What a party brings back that is not materials - a sighting, and the day the
// ground next opens - is an engine concept rather than a catalog one, and the
// argument for it lives on `Sighted` in
// `engine/world/who-goes-out-for-a-house-and-what-comes-back.ts`.

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the house must already have for this reason to be available to it.
 *
 * The binding key, and the reason a reason is data rather than a branch. Each
 * key has exactly one predicate in the engine, over state the world already
 * stores, and a new reason that reuses a key needs no new code at all. A house
 * with no subsidiary never has a tribute round to send anybody on, and nothing
 * anywhere has to say so.
 */
export const ReasonNeedSchema = z.enum([
    /** Any standing house has this reason. Nothing has to be true first. */
    'nothing',
    /** The house holds ground. `controlledLocationIds`, non-empty. */
    'ground',
    /** Something holds a vein from it. `getSubsidiariesOf`, non-empty. */
    'a_subsidiary',
    /** It holds its own ground from somebody. `getParentage().parentFactionId`. */
    'a_parent',
    /** A positive standing edge toward a live house. */
    'an_ally',
    /** A negative standing edge toward a live house. */
    'a_rival',
    /** Somebody has just found something: a site, a cache, a seat. */
    'a_find'
]);
export type ReasonNeed = z.infer<typeof ReasonNeedSchema>;

/**
 * What the house loses if the party does not come back.
 *
 * The people are not on this list because the people are always at stake, and
 * a column whose every row reads the same is a column that says nothing. This
 * is what ELSE goes, and it is what makes one sending worth arguing about in a
 * hall and another worth a nod.
 */
export const AtStakeSchema = z.enum([
    /** Only the party. Bad, and survivable, and the house recruits again. */
    'nothing_but_the_party',
    /** What was carried, what was owed, or what the errand was to fetch. */
    'stones',
    /** A house that was watching now knows something about this house. */
    'standing_with_a_house',
    /** The ground itself. A district walked through twice stops being cover. */
    'the_ground_itself',
    /** The instrument. A grant not collected on is a grant somebody renegotiates. */
    'the_grant'
]);
export type AtStake = z.infer<typeof AtStakeSchema>;

export const SendingReasonSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    /** What the party is for. One line, factual, no adjectives. */
    what: z.string().min(60),
    needs: ReasonNeedSchema,
    /**
     * The rung above which a house does not send anybody on this errand, or
     * null where there is no such rung.
     *
     * ONE OF THE THREE PLACES A REASON CHANGES A MECHANIC, and the only one
     * with a number in it. The beast errands stop at `BEAST_CHANGE_ORDINAL`
     * because nobody hunts a person and nothing that speaks arrives in a tide -
     * `WHY_A_HOUSE_GOES_OUT_AFTER_BEASTS.whyItIsJuniorsWhoGo` argues it in
     * full and this comment does not repeat it. Every other errand has no
     * ceiling at all: a marriage party or a war party can be anybody, up to and
     * including the person at the top of the house.
     *
     * Imported, never retyped. If the beast constant moves, this moves with it.
     */
    ceilingOrdinal: z.number().int().min(0).max(MAX_ORDINAL).nullable(),
    /** Days the party is gone. A term, not a computation. */
    days: z.number().int().min(1),
    /** How many the house puts on it when it is not short of anybody. */
    hands: z.number().int().min(1),
    atStake: AtStakeSchema,
    /**
     * The word the ledger files the result under.
     *
     * THE SECOND PLACE A REASON CHANGES A MECHANIC, and it is not decoration:
     * `digest.ts` and `circulating` in `what-people-are-saying.ts` read `kind`
     * and nothing else about where a fact came from. A sending filed under a
     * word the world does not use is a sending nobody ever hears about.
     *
     * Four rows read `opportunity` and that is honest rather than lazy. The
     * ledger's kinds say what a thing WAS, and four of these errands are a
     * party going somewhere and something coming of it, which is the whole
     * content of that word.
     */
    factKind: z.custom<HistoricalEventKind>(v => typeof v === 'string' && v.length > 0),
    /** How far the news of it reaches at the time. */
    scale: z.custom<EventScale>(v => typeof v === 'string' && v.length > 0),
    /** Relative weight among the reasons a house currently has. */
    weight: z.number().int().min(1)
});
export type SendingReason = z.infer<typeof SendingReasonSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE REASONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ten reasons a house puts people on the road.
 *
 * Read the `needs` column down the page and the texture falls out without
 * anybody authoring it: a landless house sends escorts and recruiters and goes
 * after materials, and does not stand to a tide because it holds no ground to
 * stand on. A house at the bottom of a grant chain answers calls it cannot
 * refuse and never collects tribute. A house with subsidiaries does both, and
 * one day sends somebody to find out why the second one has gone quiet.
 *
 * Nothing produces that. It is what the column says.
 */
export const SENDING_REASONS: readonly SendingReason[] = [
    {
        id: 'sending-for-materials',
        name: 'After materials',
        what: 'Out after what is on the ground and in the bodies on it, because it '
            + 'is the one thing at that grade nobody already owns.',
        needs: 'nothing',
        ceilingOrdinal: BEAST_CHANGE_ORDINAL,
        days: 40,
        hands: 5,
        atStake: 'stones',
        factKind: 'treasure_found',
        scale: 'local',
        weight: 30
    },
    {
        id: 'sending-to-stand-to',
        name: 'Standing to',
        what: 'Something is moving toward the settlements under the vein, and the '
            + 'house that holds the vein is the only body that can read the ground.',
        needs: 'ground',
        ceilingOrdinal: BEAST_CHANGE_ORDINAL,
        days: 25,
        hands: 12,
        atStake: 'the_ground_itself',
        factKind: 'spirit_tide',
        scale: 'regional',
        weight: 12
    },
    {
        id: 'sending-to-recruit',
        name: 'Looking for disciples',
        what: 'Two people walking village rolls and county assessments for anybody '
            + 'worth the cost of feeding for forty years.',
        needs: 'nothing',
        ceilingOrdinal: null,
        days: 150,
        hands: 2,
        atStake: 'nothing_but_the_party',
        factKind: 'opportunity',
        scale: 'local',
        weight: 18
    },
    {
        id: 'sending-an-escort',
        name: 'An escort',
        what: 'Somebody or something has to arrive somewhere, and the house has '
            + 'said it will arrive.',
        needs: 'nothing',
        ceilingOrdinal: null,
        days: 60,
        hands: 4,
        atStake: 'standing_with_a_house',
        factKind: 'opportunity',
        scale: 'local',
        weight: 16
    },
    {
        id: 'sending-to-collect-tribute',
        name: 'Collecting on a grant',
        what: 'A subsidiary owes what its terms say it owes, and somebody has to '
            + 'go down and be the person the terms are collected by.',
        needs: 'a_subsidiary',
        ceilingOrdinal: null,
        days: 45,
        hands: 3,
        atStake: 'the_grant',
        factKind: 'grant_renewed',
        scale: 'local',
        weight: 14
    },
    {
        id: 'sending-to-open-an-inheritance',
        name: 'Opening what was found',
        what: 'Somebody has found a door, a cache or a seat, and the house is going '
            + 'to be the body that opens it rather than the body that hears about it.',
        needs: 'a_find',
        ceilingOrdinal: null,
        days: 120,
        hands: 6,
        atStake: 'stones',
        factKind: 'inheritance',
        scale: 'regional',
        weight: 8
    },
    {
        id: 'sending-to-answer-a-call',
        name: 'Answering a call',
        what: 'Something above the house has asked for people, and the house holds '
            + 'what it holds on terms that make refusing a different conversation.',
        needs: 'a_parent',
        ceilingOrdinal: null,
        days: 180,
        hands: 10,
        atStake: 'standing_with_a_house',
        factKind: 'war',
        scale: 'regional',
        weight: 7
    },
    {
        id: 'sending-to-a-marriage',
        name: 'To a marriage',
        what: 'A match between two houses, and the party is the half of it that '
            + 'travels, with everything the house wants seen travelling alongside.',
        needs: 'an_ally',
        ceilingOrdinal: null,
        days: 90,
        hands: 6,
        atStake: 'standing_with_a_house',
        factKind: 'marriage',
        scale: 'regional',
        weight: 6
    },
    {
        id: 'sending-after-a-quiet-subsidiary',
        name: 'Finding out why it went quiet',
        what: 'A body below has stopped sending what it sends, and nobody at this '
            + 'house knows whether that is a refusal or a funeral.',
        needs: 'a_subsidiary',
        ceilingOrdinal: null,
        days: 70,
        hands: 5,
        atStake: 'the_grant',
        factKind: 'opportunity',
        scale: 'regional',
        weight: 5
    },
    {
        id: 'sending-to-a-war',
        name: 'To a war',
        what: 'The house is at war, the list is everybody ranked, and the thing '
            + 'that was going to happen this decade is not going to happen.',
        needs: 'a_rival',
        ceilingOrdinal: null,
        days: 720,
        hands: 40,
        atStake: 'the_ground_itself',
        factKind: 'war',
        scale: 'regional',
        weight: 4
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const BY_ID: ReadonlyMap<string, SendingReason> =
    new Map(SENDING_REASONS.map(r => [r.id, r]));

export function getSendingReason(id: string): SendingReason | undefined {
    return BY_ID.get(id);
}

/**
 * Reasons grouped by what a house must already have.
 *
 * Built once from the rows, so a new row joins its group without anybody
 * touching this. The engine's binding pass walks the keys.
 */
export const SENDING_REASONS_BY_NEED: ReadonlyMap<ReasonNeed, readonly SendingReason[]> =
    (() => {
        const map = new Map<ReasonNeed, SendingReason[]>();
        for (const need of ReasonNeedSchema.options) map.set(need, []);
        for (const reason of SENDING_REASONS) map.get(reason.needs)!.push(reason);
        return map;
    })();

/** Every reason with a ceiling above which nobody is sent. */
export const CAPPED_SENDINGS: readonly SendingReason[] =
    SENDING_REASONS.filter(r => r.ceilingOrdinal !== null);
