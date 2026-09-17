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
 * {@link SendingReason.factKind}. A reason wants a row and no code. One reusing
 * an existing `needs` key wants a row and no predicate.
 *
 * Held, on the three added for the escort occasions: the visit and the
 * competition are one new key and two rows, and the second row cost nothing at
 * all. A new key costs a predicate in `NEED_PREDICATES`, a column on
 * `HouseAsItStands` where the world has to answer it, and a destination in
 * `WHERE_A_NEED_SENDS_YOU` - three tables that will not compile until they are
 * filled, which is the point of them.
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
 * The first ten rows were what somebody could think of in one sitting, not an
 * enumeration of the ways a house can want something. The next must cost a row
 * and nothing else, and the moment a reader has to add a branch to add a
 * reason, this file has failed at the only thing it exists for.
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
import {
    THE_COMMUNICATION_TALISMAN,
    WHO_CAN_CUT_A_COMMUNICATION_TALISMAN
} from './communication-talismans.js';
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
 * ── AND NOT WITH A WORD THE LADDER ALREADY OWNS ──────────────────────────
 *
 * These read `First rank`, `Second rank` and `Third rank`, and the board line
 * that carries one also carries the RUNG the posting is pitched at. Found by
 * playing blind, at a sect board:
 *
 *     The Azure Dew Sect is seeking those at the second rank of Qi Condensation
 *     Layer 1.
 *
 * Two different things called a rank, one sentence apart. The tier is a
 * DIFFICULTY band - how far the work sits above whoever takes it - and the rung
 * is where the taker stands on the ladder; a player reading that line has no
 * way to know there are two scales in it, and the obvious reading is a rung of
 * a rung.
 *
 * So the tiers are named for what a board is actually advertising: how much
 * work it is. `rank`, `realm`, `layer` and `stage` all belong to the ladder and
 * none of them may appear here.
 */
export const TIER_NAMES: Record<RegardBand, string> = {
    unreachable: 'Standing posting',
    overmatched: 'Open posting',
    stretch: 'Hard going',
    matched: 'Fair going',
    assured: 'Light going',
    beneath: 'Errand',
    // NOT 'Not posted', which it said while this band was genuinely off the
    // wall. An elder reads the whole board now and may take a line far under
    // their own rung, so the work IS posted and takeable - and the board
    // printed the tier on every line, which had it telling a reader that the
    // thing they were about to take was not posted. It is the slightest work
    // a house has, which is what the name should say.
    dismissed: 'Odd job'
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
    'a_find',
    /** It stands over something sealed. `containmentHeldBy`, non-empty. */
    'a_containment',
    /**
     * A live house this one would sit down with: an ally, or a body seated in
     * the same province that neither side is hostile to. `sitsDownWith`.
     *
     * NOT `an_ally`. A house courts the bodies it is not yet allied with, and
     * at world open the only positive standing any house carries is toward its
     * own patron - so an errand keyed on an ally is an errand to your landlord.
     * The circle is who a house would receive and be received by, which is the
     * question a visit and a meet both ask.
     */
    'a_counterpart',
    /**
     * The world has closed ground in this house's own province.
     * `standsNearForbiddenGround`.
     */
    'forbidden_ground',
    /**
     * The house cannot pay its own people, and there is ground in its province
     * that would. `cannotPayItsPeople` and `knowsGroundThatWouldPayIt`, both.
     *
     * THE PREDICATE IS THE MOTIVE. A solvent house does not have this reason at
     * all, which is why there is no branch anywhere on whether a house is
     * desperate: `reasonsOpenTo` simply does not offer it one. See
     * `engine/world/what-a-house-does-when-it-cannot-pay.ts`.
     */
    'ground_that_pays_somebody_else',
    /**
     * Somebody of the house is out on a posting and is due to be looked in on.
     * `someoneIsDueALookIn`. Set only by the pass that keeps the cadence
     * (`what-a-house-hears-from-its-people-away.ts`), so no board offers it.
     */
    'somebody_out_on_a_posting',
    /**
     * The house's own stock of communication talismans is below what it keeps.
     * `itsCommunicationTalismansRunLow`. The work is done at the house.
     */
    'communication_talismans_running_low'
]);
export type ReasonNeed = z.infer<typeof ReasonNeedSchema>;

/**
 * What the house loses if the party does not come back.
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
     * The rung above which a house does not send anybody on this errand, or null
     * where there is no such rung.
     */
    ceilingOrdinal: z.number().int().min(0).max(MAX_ORDINAL).nullable(),
    /**
     * The rung below which nobody can do this work at all, or null where anybody
     * can. The other end of `ceilingOrdinal`: a ceiling is who a house would not
     * waste on it, a floor is who could not do it. A board does not offer it to
     * somebody under it.
     */
    floorOrdinal: z.number().int().min(0).max(MAX_ORDINAL).nullable(),
    /**
     * The catalog id of what the work makes, where it makes a thing, or null.
     * Carried onto the worker's activity as `thingId`, which is what the work
     * lands as when its term closes.
     */
    makes: z.string().min(1).nullable(),
    /** Days the party is gone. A term, not a computation. */
    days: z.number().int().min(1),
    /** How many the house puts on it when it is not short of anybody. */
    hands: z.number().int().min(1),
    atStake: AtStakeSchema,
    /**
     * The word the ledger files the result under.
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
 * The reasons a house puts people on the road.
 *
 * Three were added after the escort path landed, because every escort was an
 * errand: the occasion a senior is asked to take juniors out on is whatever the
 * house had on its board, so the spread of OCCASIONS is this list and nothing
 * else. Two of the three needed one new `needs` key between them and none of
 * them needed a branch.
 */
export const SENDING_REASONS: readonly SendingReason[] = [
    {
        id: 'sending-for-materials',
        name: 'After materials',
        what: 'Out after what is on the ground and in the bodies on it, because it '
            + 'is the one thing at that grade nobody already owns.',
        needs: 'nothing',
        ceilingOrdinal: BEAST_CHANGE_ORDINAL,
        floorOrdinal: null,
        makes: null,
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
        floorOrdinal: null,
        makes: null,
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
        floorOrdinal: null,
        makes: null,
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
        floorOrdinal: null,
        makes: null,
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
        floorOrdinal: null,
        makes: null,
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
        floorOrdinal: null,
        makes: null,
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
        floorOrdinal: null,
        makes: null,
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
        floorOrdinal: null,
        makes: null,
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
        floorOrdinal: null,
        makes: null,
        days: 70,
        hands: 5,
        atStake: 'the_grant',
        factKind: 'opportunity',
        scale: 'regional',
        weight: 5
    },
    {
        id: 'sending-to-dispel-a-leak',
        name: 'Dispelling a leak',
        what: 'Something sealed is letting go of what it holds, a little at a '
            + 'time, and the people posted over it walk it down before it reaches '
            + 'the perimeter.',
        needs: 'a_containment',
        // None. A leak does not read the rung of whoever answers it, and the
        // bodies posted over one run from a hill village to an apex's chosen.
        ceilingOrdinal: null,
        floorOrdinal: null,
        makes: null,
        days: 8,
        hands: 3,
        atStake: 'the_ground_itself',
        factKind: 'ruin_sealed',
        scale: 'local',
        // The heaviest of any reason here, and it is the only one that is not a
        // decision: the others are things a house CHOOSES to send people out
        // for. This is a rota.
        weight: 40
    },
    {
        id: 'sending-to-be-received',
        name: 'A visit to another house',
        what: 'Another house has said it will receive a party from this one, and '
            + 'the party is the house as far as anybody there is concerned.',
        needs: 'a_counterpart',
        ceilingOrdinal: null,
        floorOrdinal: null,
        makes: null,
        days: 60,
        hands: 5,
        atStake: 'standing_with_a_house',
        factKind: 'gathering',
        scale: 'regional',
        weight: 11
    },
    {
        id: 'sending-to-a-friendly-competition',
        name: 'A friendly competition',
        what: 'Another house is putting its juniors up against this one\'s, on a day '
            + 'both houses named, with the elders of both standing at the edge of it.',
        needs: 'a_counterpart',
        ceilingOrdinal: null,
        floorOrdinal: null,
        makes: null,
        days: 35,
        hands: 6,
        atStake: 'standing_with_a_house',
        // `gatherings.ts` holds the world's own version of this - a circle, a
        // host, cross-house boards, and `whoCouldHaveStoppedIt` deciding whether
        // a bout stops at a floored body. Its ledger word is `gathering` and
        // this files under the same one, so the meet a house was sent to and the
        // meet the world held read as one kind of event.
        factKind: 'gathering',
        scale: 'regional',
        weight: 9
    },
    {
        id: 'sending-to-the-edge-of-forbidden-ground',
        name: 'To the edge of forbidden ground',
        what: 'Ground in the province stopped being ground, and the house walks its '
            + 'own out to the line to see what is there before somebody walks into it.',
        needs: 'forbidden_ground',
        ceilingOrdinal: null,
        floorOrdinal: null,
        makes: null,
        days: 20,
        hands: 4,
        atStake: 'the_ground_itself',
        factKind: 'zone_forbidden',
        scale: 'local',
        // Low, and it is the only reason here whose availability is a property
        // of world TIME rather than of the house. Measured on twelve seeded
        // worlds: zero forbidden zones at day 0 and none at fifty years, five
        // and two at two hundred. The ground has to be spoiled before anybody
        // can be walked out to look at it.
        weight: 6
    },
    {
        id: 'sending-to-a-war',
        name: 'To a war',
        what: 'The house is at war, the list is everybody ranked, and the thing '
            + 'that was going to happen this decade is not going to happen.',
        needs: 'a_rival',
        ceilingOrdinal: null,
        floorOrdinal: null,
        makes: null,
        days: 720,
        hands: 40,
        atStake: 'the_ground_itself',
        factKind: 'war',
        scale: 'regional',
        weight: 4
    },
    {
        id: 'sending-to-take-the-ground-that-pays',
        name: 'Taking what pays',
        what: 'The house has not paid its own people this year, and the ground that '
            + 'would pay them is a fortnight away with somebody else standing on it.',
        needs: 'ground_that_pays_somebody_else',
        // None. A house that cannot make payroll sends whoever it has, and the
        // people it has are the ones it would ordinarily keep at home.
        ceilingOrdinal: null,
        floorOrdinal: null,
        makes: null,
        days: 90,
        hands: 8,
        atStake: 'the_ground_itself',
        factKind: 'resource_contested',
        scale: 'regional',
        // Heavy among the reasons a broke house has, and it is never weighed
        // against the others for anybody else: `NEED_PREDICATES` is what keeps
        // it off a solvent house's board, not this number.
        weight: 25
    },
    {
        id: 'sending-to-look-in-on-a-posting',
        name: 'Looking in on a posting',
        what: 'Somebody of the house has been in a town for years, and the house sends one person '
            + 'with a fresh stack of communication talismans to see how they are.',
        needs: 'somebody_out_on_a_posting',
        ceilingOrdinal: null,
        floorOrdinal: null,
        makes: null,
        // Days at the post. The road there and back is the map's, added by the
        // pass that sends them.
        days: 5,
        hands: 1,
        atStake: 'nothing_but_the_party',
        // What comes back is word of one person, said in the house's own hall.
        factKind: 'said_in_public',
        scale: 'personal',
        // Not drawn against the others. The cadence decides when, and the
        // weight is only here because every row carries one.
        weight: 1
    },
    {
        id: 'sending-to-cut-communication-talismans',
        name: 'Cutting communication talismans',
        what: 'The house has handed out more of its communication talismans than it has left, and '
            + 'somebody at Foundation or above sits down at the house and cuts more.',
        needs: 'communication_talismans_running_low',
        ceilingOrdinal: null,
        floorOrdinal: WHO_CAN_CUT_A_COMMUNICATION_TALISMAN,
        makes: THE_COMMUNICATION_TALISMAN.id,
        // A few days at it, which is short enough to fit between other work.
        days: 5,
        hands: 1,
        atStake: 'nothing_but_the_party',
        factKind: 'said_in_public',
        scale: 'personal',
        // A rota rather than a decision, like the leak: a house that is short
        // needs it done this year. Heavy enough to be taken when it is posted,
        // which is only while the stock is short.
        weight: 30
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
