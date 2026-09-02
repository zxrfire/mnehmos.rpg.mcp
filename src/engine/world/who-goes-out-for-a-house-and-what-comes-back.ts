/**
 * Who goes out for a house, and what comes back.
 *
 * The resolution half of `data/cultivation/why-a-house-puts-a-party-on-the-road.ts`.
 * That file says why a house wants somebody on the road; this one binds a
 * reason to a house that actually has it, picks who can be spared, decides
 * what happened, and hands the world a fact it can gossip about.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE BRANCHES ON WHICH REASON IT IS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Grep the file: there is no `switch` on a reason id and no table keyed on
 * one. The three columns that carry a mechanical difference are read as
 * values - `needs` through {@link NEED_PREDICATES}, which is one entry per
 * KEY and not per reason; `ceilingOrdinal` as a filter on the roster; and
 * `factKind` copied straight onto the ledger row. Everything else - who is
 * strong enough, how long, whether they finish, whether anybody comes back,
 * what the news is worth - is one function of the gap between the rung the
 * posting is pitched at and the rung the party stands on.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE TIER IS THE REGARD BAND. THERE IS NO SECOND DIFFICULTY SCALE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A posting is pitched at a rung. Somebody stands at a rung. The difference is
 * the tier, and `REGARD_BANDS` has measured exactly that since it was written.
 * {@link IMPOSSIBLE_TIERS} is the two bands at the top of it, and the whole
 * ruling about a mission nobody is expected to come back from lives in the
 * relationship between this module and `encounters/duties.ts`:
 *
 *   `summonable` in duties.ts   a house does not SEND somebody against a
 *                               posting it expects to lose them to. Correct,
 *                               and unchanged.
 *   {@link IMPOSSIBLE_TIERS}    a board may POST one anyway, and somebody may
 *                               take it off the wall. Agency: do not ban, and
 *                               do not soften. Say what it costs.
 *
 * ── And what it costs is derived, not picked ─────────────────────────────
 *
 * One line, off `damageMultiplier`, which the band table already carries:
 *
 *     notFinished = max(0, 1 - 1 / damageMultiplier)
 *
 * which reads 0 at `matched` and below, 0.375 at `stretch`, 0.667 at
 * `overmatched` and 0.833 at `unreachable`. Then, of the attempts that did not
 * finish, the same number decides how much of the party stays out there:
 *
 *     lost = notFinished^2
 *
 * which is 0.14 at `stretch`, 0.44 at `overmatched` and 0.69 at `unreachable` -
 * the same statement made twice, because a gap that is hard to finish across is
 * disproportionately hard to retreat across.
 *
 * So a posting nine rungs above the party is finished about one attempt in six,
 * and the five that are not lose roughly seven of every ten people on them.
 * That is the "mad prestige" band and it is priced rather than gated. No
 * constant in this module was chosen; both lines fall out of a table that
 * already decides what a fight at this gap costs, so retuning `REGARD_BANDS`
 * retunes this and there is nothing to keep in step by hand.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NUMBERS BUY A WITNESS. THEY DO NOT BUY FORCE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * AGENTS.md records that whether a large number of people below the categorical
 * gap should be able to wear somebody down is an open design question, and that
 * it should be put to a person rather than settled quietly here. So party size
 * is deliberately kept out of whether the party FINISHES: `hands` moves exactly
 * one thing, which is whether anybody survives to report.
 *
 * That is not a consolation prize. It is the mechanism behind the sentence the
 * design owner asked for - somebody saw the thing and could not get to it - and
 * it means a house that sends six at something impossible learns where it is,
 * while a house that sends two learns nothing and loses two people.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS DOES NOT DO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * **It does not roll a fight.** No second combat resolver: what it decides is
 * whether the party was enough, which is a different question from who hit
 * whom. A sending the player is on goes through the ordinary resolver like
 * anything else.
 *
 * **It does not store prestige.** There is no score anywhere in this module.
 * The output is a fact with a magnitude, written into the ledger the whole
 * propagation layer already reads, and `whatIsSaidAbout` derives standing off
 * that and off the obligation ledger, as it always has. A hard sending
 * finished is a heavy fact that travels far; that is the entire mechanism, and
 * a second scoreboard beside it would immediately disagree with it.
 *
 * **It does not move anybody.** No conveyance, no travel time beyond the days
 * the reason states, no boats. Those are physical objects and they are
 * somebody else's.
 *
 * **It does not decide the outcome of a place being open.** `locations.ts`
 * owns opening cycles and this module only asks it when the ground next
 * stands open, so a sighting can carry a date.
 *
 * Pure. State in, deltas out, no I/O, and every draw comes off a stream the
 * caller owns.
 */

import {
    SENDING_REASONS,
    TIER_NAMES,
    type AtStake,
    type ReasonNeed,
    type SendingReason
} from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { getParentage, getSubsidiariesOf } from '../../data/cultivation/governance-and-water-rights.js';
import { regardFor, type Regard } from '../cultivation/regard.js';
import { clampOrdinal } from '../cultivation/realms.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import type { RegardBand } from '../../schema/cultivation.js';
import { makeFact, type PendingFact } from './history.js';
import { nextOpeningDay, type LocationRecord } from './locations.js';

// ─────────────────────────────────────────────────────────────────────────
// THE HOUSE, AS THE BINDING PASS NEEDS IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * What has to be true about a house before it can want anything.
 *
 * Declared structurally rather than as `FactionRecord` so this module can be
 * driven from a test, from the seeded catalog, or from a live world without
 * three shapes of the same question. A `FactionRecord` satisfies it as it
 * stands; `holdsGround` is `controlledLocationIds.length > 0` and `standing`
 * is the record's own map.
 */
export interface HouseAsItStands {
    id: string;
    name: string;
    /** True when it controls any location at all. */
    holdsGround: boolean;
    /** Standing toward other houses, -1..1. The record's own map. */
    standing: Readonly<Record<string, number>>;
    /**
     * Whether somebody has recently found something worth opening.
     *
     * Not a new store: the caller reads it off whatever it already has - an
     * unopened site in `locations`, a `treasure_buried` fact nobody has acted
     * on, a prospecting result. Passed in so this module takes no view about
     * which of those counts.
     */
    hasAFind: boolean;
}

/**
 * Standing above which a house is somebody's ally, and below which somebody's
 * rival.
 *
 * Not invented here. `gatherings.ts` uses 0.3 for allied and the yearly pass
 * deliberately opens sympathy just under it; this reads the same figure from
 * both ends so a house cannot be an ally and a rival of the same body.
 */
export const ALLIED_STANDING = 0.3;
export const RIVAL_STANDING = -0.3;

/**
 * One predicate per NEED KEY. Not one per reason.
 *
 * This map is the whole of why a reason is data. Ten rows in the catalog bind
 * through seven entries here, and an eleventh reason reusing a key adds
 * nothing to this file at all. Every predicate reads state the world already
 * stores and none of them knows which reason is asking.
 */
export const NEED_PREDICATES: Record<ReasonNeed, (house: HouseAsItStands) => boolean> = {
    nothing: () => true,
    ground: house => house.holdsGround,
    a_subsidiary: house => getSubsidiariesOf(house.id).length > 0,
    a_parent: house => getParentage(house.id)?.parentFactionId != null,
    an_ally: house => Object.values(house.standing).some(v => v >= ALLIED_STANDING),
    a_rival: house => Object.values(house.standing).some(v => v <= RIVAL_STANDING),
    a_find: house => house.hasAFind
};

/**
 * The reasons this house actually has right now.
 *
 * Empty is a legitimate answer and a caller should say nothing rather than
 * reach for a fallback. A house that holds no ground, is nobody's subsidiary,
 * has no subsidiary, no ally, no rival and nothing found still has three
 * reasons, which is the correct floor: everybody goes out after materials,
 * everybody escorts, and everybody needs disciples.
 */
export function reasonsOpenTo(house: HouseAsItStands): readonly SendingReason[] {
    return SENDING_REASONS.filter(r => NEED_PREDICATES[r.needs](house));
}

// ─────────────────────────────────────────────────────────────────────────
// THE POSTING
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two bands at which nobody is expected to come back.
 *
 * `duties.ts` will not offer these and is right not to - a house does not
 * spend its people on something it expects to lose them to. A board may still
 * carry one, and the difference between the two files is the whole of the
 * ruling: the house declines to send, and the world declines to stop you.
 */
export const IMPOSSIBLE_TIERS: readonly RegardBand[] = ['overmatched', 'unreachable'];

export function isImpossibleTier(band: RegardBand): boolean {
    return IMPOSSIBLE_TIERS.includes(band);
}

export interface Posting {
    reason: SendingReason;
    houseId: string;
    houseName: string;
    /** The rung the posting is pitched at. */
    pitchOrdinal: number;
    /** Days the party is gone if it goes as stated. */
    days: number;
    /** How many the house means to put on it. */
    hands: number;
    /** Above this nobody is sent. Null where the errand has no ceiling. */
    ceilingOrdinal: number | null;
    atStake: AtStake;
    /** The place, when the caller knows one. Carried for the sighting. */
    locationId: string | null;
}

/**
 * A posting off a reason and a rung.
 *
 * The pitch is the caller's, because what a sending is pitched at is a fact
 * about the errand rather than about the reason: a tribute round to a quiet
 * neighbour and a tribute round to one that has stopped answering are the same
 * reason at two different rungs. What the reason contributes is the ceiling,
 * the term, the hands and what is at stake.
 */
export function postingFor(input: {
    reason: SendingReason;
    house: HouseAsItStands;
    pitchOrdinal: number;
    locationId?: string | null;
}): Posting {
    return {
        reason: input.reason,
        houseId: input.house.id,
        houseName: input.house.name,
        pitchOrdinal: clampOrdinal(input.pitchOrdinal),
        days: input.reason.days,
        hands: input.reason.hands,
        ceilingOrdinal: input.reason.ceilingOrdinal,
        atStake: input.reason.atStake,
        locationId: input.locationId ?? null
    };
}

export interface Candidate {
    id: string;
    name: string;
    ordinal: number;
}

/**
 * Who the house may put on this, strongest first.
 *
 * The ceiling is applied here and nowhere else. On the two beast errands it
 * removes everybody the house's own strongest are standing among, which is why
 * those parties are juniors with one person on them who has seen it before -
 * `WHY_A_HOUSE_GOES_OUT_AFTER_BEASTS.whyItIsJuniorsWhoGo` argues that and this
 * function is where the argument becomes a filter.
 */
export function whoTheHouseCanSend(
    posting: Posting,
    roster: readonly Candidate[]
): readonly Candidate[] {
    const ceiling = posting.ceilingOrdinal;
    const eligible = ceiling === null
        ? [...roster]
        : roster.filter(c => c.ordinal <= ceiling);
    eligible.sort((a, b) => b.ordinal - a.ordinal || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return eligible.slice(0, posting.hands);
}

// ─────────────────────────────────────────────────────────────────────────
// THE TIER, AND WHAT IT COSTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rung the party is judged at.
 *
 * The strongest person on it, and not an average or a sum, because averaging
 * would let a crowd of juniors drag a posting into a band their best could
 * never reach - which is the "numbers buy force" claim the design has not
 * settled. See the header. An empty party is priced at the bottom of the
 * ladder, which is the honest answer for nobody having gone.
 */
export function partyOrdinal(party: readonly Candidate[]): number {
    let best = 0;
    for (const member of party) best = Math.max(best, clampOrdinal(member.ordinal));
    return best;
}

/** The tier, which is the regard band and nothing else. */
export function tierFor(posting: Posting, party: readonly Candidate[]): Regard {
    return regardFor(posting.pitchOrdinal, partyOrdinal(party));
}

/**
 * A board's own word for a tier.
 *
 * The only rendering step in this module, and it exists so a caller printing a
 * posting does not reach into the catalog map and quietly invent a seventh
 * rung. There is no scale here: the argument is the band, and the answer is
 * what a house would write at the top of the notice.
 */
export function tierNameFor(band: RegardBand): string {
    return TIER_NAMES[band];
}

/**
 * The share of attempts at this band that do not finish.
 *
 * Derived from `damageMultiplier`, so the only place this world says how much
 * a gap costs is the place it always said it. Zero at `matched` and below: a
 * posting at or beneath your rung is work, not a gamble.
 */
export function notFinishedChance(regard: Regard): number {
    const damage = regard.damageMultiplier;
    if (!Number.isFinite(damage) || damage <= 1) return 0;
    return Math.max(0, Math.min(1, 1 - 1 / damage));
}

/**
 * The share of an unfinished party that does not come back.
 *
 * A fraction of the party, not a probability of a total loss - whether ANYBODY
 * returns is the party-size draw in {@link resolveSending}, and this is how
 * many of them it costs. The square of the line above, which is the same
 * statement made twice: a gap that is hard to finish across is
 * disproportionately hard to retreat across. Nothing was chosen; if
 * `REGARD_BANDS` moves, both move together.
 */
export function lostChance(regard: Regard): number {
    const notFinished = notFinishedChance(regard);
    return notFinished * notFinished;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT COMES BACK
// ─────────────────────────────────────────────────────────────────────────

export type SendingOutcome =
    /** They did the thing. */
    | 'finished'
    /** They did not, and somebody came back to say what they saw. */
    | 'came_back_short'
    /** They did not, and nobody came back. */
    | 'did_not_come_back';

/**
 * What a party saw and could not take.
 *
 * The half of a sending that is easiest to leave out and is worth more than
 * the loot. A party that did not finish still went somewhere, and where they
 * got to, what they saw, and that they could not reach it are facts about the
 * world that outlive them.
 *
 * **It is not a consolation prize; it is the input to the next attempt.** A
 * sending at a thing nobody has ever seen is a survey. A sending at a thing a
 * named person watched from twenty paces, two openings ago, is a different
 * errand, and a house that knows that much prices it differently. On ground
 * that shuts, `opensAgainOnDay` is arithmetic off the location's own cycle
 * rather than anything anybody has to remember, so the house can send again at
 * the right time and somebody in a courtyard can say how long it has been
 * since anybody was close enough to look.
 *
 * **And it is how talk starts.** The record is an ordinary fact with an
 * ordinary magnitude, so the ordinary propagation reads it: those who were
 * there tell the people below them, it moves outward and downward, and it
 * arrives distorted like everything else in this world. The wrong name gets
 * attached about as often as the right one. That is `retell` doing its job
 * rather than a defect in the record.
 */
export interface Sighted {
    locationId: string | null;
    /** Absolute day the ground next stands open, or null when it never shuts. */
    opensAgainOnDay: number | null;
    /** Who got close enough to see it. Empty when nobody came back. */
    seenBy: readonly Candidate[];
}

export interface Sending {
    posting: Posting;
    party: readonly Candidate[];
    tier: Regard;
    outcome: SendingOutcome;
    /** Present on `came_back_short`. The whole point of that outcome. */
    sighted: Sighted | null;
    /** Who did not come back. Empty on `finished`. */
    lost: readonly Candidate[];
    /** The day the party is due back, whatever happened. */
    returnsOnDay: number;
}

/**
 * Resolve one sending.
 *
 * Two draws, in this order and off the caller's stream:
 *
 *   1. did they finish, off the band alone;
 *   2. if not, did anybody come back, off the size of the party alone.
 *
 * The second draw is where `hands` earns its place. One person on an
 * unfinished errand comes back about half the time; six come back nearly
 * always, and what they bring is the sighting. See the header for why party
 * size deliberately does not touch the first draw.
 */
export function resolveSending(input: {
    posting: Posting;
    party: readonly Candidate[];
    departsOnDay: number;
    rng: CultivationRNG;
    /** The ground, when the caller has the record. For the sighting's date. */
    location?: LocationRecord | null;
}): Sending {
    const { posting, party, departsOnDay, rng } = input;
    const tier = tierFor(posting, party);
    const returnsOnDay = departsOnDay + posting.days;

    if (!rng.chance(notFinishedChance(tier))) {
        return { posting, party, tier, outcome: 'finished', sighted: null, lost: [], returnsOnDay };
    }

    // Nobody went, so nobody came back. Not a special case: an empty party
    // cannot produce a witness and the arithmetic below would say so anyway.
    const anybodyBack = party.length > 0 && rng.chance(1 - Math.pow(0.5, party.length));
    if (!anybodyBack) {
        return {
            posting, party, tier, outcome: 'did_not_come_back',
            sighted: null, lost: party, returnsOnDay
        };
    }

    // Somebody is back. Who is lost is the same draw read differently: the
    // deeper the gap, the more of the party stays out there.
    const lostCount = Math.min(
        Math.max(0, party.length - 1),
        Math.round(party.length * lostChance(tier))
    );
    const lost = party.slice(party.length - lostCount);
    const returned = party.slice(0, party.length - lostCount);

    return {
        posting, party, tier, outcome: 'came_back_short',
        sighted: {
            locationId: posting.locationId,
            opensAgainOnDay: input.location
                ? nextOpeningDay(input.location, returnsOnDay)
                : null,
            seenBy: returned
        },
        lost,
        returnsOnDay
    };
}

// ─────────────────────────────────────────────────────────────────────────
// AND THEN PEOPLE TALK ABOUT IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * How heavy the fact is.
 *
 * `circulating` weights what people repeat by magnitude, so this is the whole
 * of "prestige" in this system: an impossible posting finished is a heavy fact
 * that travels a long way, and an errand three rungs below the party is one
 * nobody mentions twice. Derived off the same band figure as everything else,
 * so there is exactly one number in this module's arithmetic and it is
 * `damageMultiplier`.
 */
export function magnitudeOf(sending: Sending): number {
    const difficulty = notFinishedChance(sending.tier);
    const base = 0.2 + difficulty * 0.8;
    // What almost happened is talked about, and less than what did.
    const carried = sending.outcome === 'finished' ? 1 : 0.6;
    return Math.max(0, Math.min(1, base * carried));
}

/**
 * The ledger row for a sending, ready for `appendWorldFact`.
 *
 * Nothing about the reason is interpreted. `kind` is copied off the row,
 * `scale` is copied off the row, and the summary states what happened in the
 * engine's own factual register. Once this is in `state.history.facts` every
 * propagation system in the repository reads it for free - the digest, the
 * hearsay channel, `circulating`, `retell` with its six distortions, and
 * `whatIsSaidAbout` deriving what people think of the person who did it.
 *
 * `nearMiss` is set on `came_back_short`, which is the field the ledger has
 * always carried for a thing that almost happened. That is not a metaphor
 * here: a party that got close enough to see something and not close enough to
 * take it is precisely what the flag is for, and it is what a later sending is
 * built on.
 */
export function newsOfASending(sending: Sending, opts: {
    /** Absolute day the news is dated. Usually the party's return. */
    onDay?: number;
} = {}): PendingFact {
    const { posting, tier, outcome } = sending;
    const day = opts.onDay ?? sending.returnsOnDay;
    const impossible = isImpossibleTier(tier.band);

    // The board's own word for the tier, then the rung, then what happened.
    // Factual throughout: every clause is something the engine decided.
    const sent = `${posting.houseName} sent ${sending.party.length} on `
        + `${posting.reason.name.toLowerCase()}, a ${tierNameFor(tier.band).toLowerCase()} `
        + `at ordinal ${posting.pitchOrdinal}`;

    const what = outcome === 'finished'
        ? `${sent}, and it was done.`
        : outcome === 'came_back_short'
            ? `${sent}. ${sending.sighted!.seenBy.length} came back and `
                + `${sending.lost.length} did not. It was not finished.`
            : `${sent}. None of them came back.`;

    return makeFact({
        day,
        kind: posting.reason.factKind,
        scale: posting.reason.scale,
        summary: what,
        locationId: posting.locationId,
        factionIds: [posting.houseId],
        actors: sending.party.map(member => ({
            id: member.id,
            name: member.name,
            role: sending.lost.some(l => l.id === member.id) ? 'lost' : 'sent'
        })),
        // A house's ordinary errands are its own business. Something nobody
        // was expected to survive is not, whichever way it went.
        visibility: impossible ? 'public' : 'regional',
        magnitude: magnitudeOf(sending),
        nearMiss: outcome === 'came_back_short',
        nearMissNote: outcome === 'came_back_short'
            ? `Reached it and did not take it. ${sending.sighted!.seenBy.length} saw it.`
            : ''
    });
}
