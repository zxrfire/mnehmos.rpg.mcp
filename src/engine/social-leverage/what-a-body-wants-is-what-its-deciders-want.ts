/**
 * What a body wants, read off the people who decide in it - and off what the
 * person asking has already done to them.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner:
 *
 *   > the thing about sects applies to every organization. Sects are an
 *   > amalgamation of what their upper echelon thinks. same for families, some
 *   > can pressure or sell off their daughter, some won't. the same system
 *   > should apply for free, based on character traits, motivations.
 *
 * On how the tiers fit together:
 *
 *   > i agree. elders can not like it, a patriarch can overrule. and a
 *   > patriarch can only be overruled again when all the elders disagree (same
 *   > system as the elders denying immortal pills to even a sect patriarch).
 *
 * And on what it is for:
 *
 *   > obviously then this makes the bribery systems work. also when you promote
 *   > into those positions it gives you gameplay.
 *
 * The principle, stated once so the code can be tested against it: **an
 * institution has no preferences of its own. Its preferences are the aggregate
 * of the preferences of the people who decide in it.** A house that takes guest
 * disciples during a war and refuses them after has not changed a policy - its
 * deciders' priorities shifted.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * "FOR FREE" IS THE HARD CONSTRAINT, AND IT IS WHY THERE IS NO NEW FIELD
 * ═════════════════════════════════════════════════════════════════════════
 *
 * There is no column saying whether a family sells its daughters, and there
 * must never be one - a flag on a family row is the exact thing the ruling
 * forbids. Both terms below are read off things the world already writes.
 *
 * THE MEASUREMENT THAT CHOSE THE BASELINE IS WORTH RECORDING. The obvious
 * input was `NpcGoal.priority`, and it does not work: over a pinned world, 240
 * of 435 people carry a goal row and **not one of the 77 people at an elder
 * rung does** - the seeder writes goals bottom-up and stops before it reaches
 * anybody who decides anything (183/192 unaffiliated, 38/74 at rank 0, 16/52 at
 * rank 1, 3/38 at rank 2, and zero at ranks 3, 4 and 5). An aggregation over
 * goal priorities would have returned the identical answer for all 34 houses
 * while reading exactly like a working mechanism - AGENTS.md's *"an unwritten
 * field is not inert, it reads as a value"* at institution scale. That elders
 * want nothing is a real defect in the seeder; it is not this module's, and
 * when it is fixed, goals become a second axis by being PASSED IN, not by a
 * branch appearing here.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO TERMS, AND THE SECOND ONE IS THE WHOLE REASON A COUNCIL IS PLAYABLE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *     WHAT THEY ARE          `openHandednessOf`, drawn from the person's own id
 *     (the baseline)         and nothing else. Present for every decider in
 *                            every world with no seeder pass and no migration,
 *                            stable forever, and - measured across 34 houses -
 *                            it already spreads their elders from -0.61 to
 *                            +0.65 with no authoring.
 *
 *     WHAT HAS BEEN DONE     the obligation ledger between them and whoever is
 *     TO THEM (the sway)     asking. Zero on day one and filling through play.
 *
 * **The second term exists because the first one cannot move.** Everything good
 * about an id-derived leaning - always present, never stale, impossible to
 * forge - is the same fact as *nothing can ever change it*, and a council built
 * on the baseline alone is a council nobody can bribe, persuade or owe. That
 * would ship the ruling's point and then bolt it shut. So a decider's reading
 * is what they are PLUS what this particular person has already done to them,
 * and it is asked per asker: the same house answers differently to two people.
 *
 * It runs in both directions off the same rows, which is
 * `what-a-deed-leaves.ts`'s standing rule that kindness and harm are one
 * machinery pointed two ways:
 *
 *     a favour the decider OWES the asker      pulls them toward yes
 *     a wrong the decider HOLDS about them     pushes them away
 *
 * Note what this makes of an empty ledger at world creation. It is not a
 * defect - it is correct. Nobody owes anybody anything on day one, and a
 * house's answer drifting as its elders accumulate accounts with a player is
 * the system working rather than a column waiting to be filled.
 *
 * **No bribery verb is built here and none should be.** `resolveAttempt` and
 * `what-a-deed-leaves.ts` already decide what an approach does and what it
 * writes down. All this module does is make what they wrote legible to a
 * council, which is why the input is `ObligationRecord[]` and not an offer.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE PLAYER SITS IN THE ROOM, AND NOTHING HERE CAN TELL
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A decider is `{ id, rankIndex }` and there is no NPC type in this file, no
 * roster lookup, and no place to put one. That is load-bearing rather than
 * tidy: promotion into a seat is only gameplay if arriving there changes what
 * the house decides, so the player's own id goes in the same shape, their
 * `openHandednessOf` contributes at their own weight, and at the top rung they
 * get the overrule and become the person the unanimity tier can overrule. The
 * player's world row already carries the SAME ID as their cultivator sheet
 * (`PLAYER_ROW_TAG` in `world/npc-state.ts`), so the two never disagree, and
 * `openHandednessOf` is total over any string, so no caller has to guard.
 *
 * A caller that resolves deciders through an NPC-only lookup makes the player a
 * spectator at their own council. There is nothing in this file that would let
 * them; a test asserts an id the world has never seen answers identically.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE TIERS, AND THE THIRD IS WHY THIS IS A LOOP AND NOT A HIERARCHY
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   THE ELDERS      the weighted mean. The ordinary answer. Elders can dislike
 *                   a thing and be outvoted; that is what a mean is for.
 *
 *   THE SEAT        the head of the house overrules the mean. Reserved to the
 *                   seat alone, because one elder must not be able to stop a
 *                   house. It is not free, and this module does not price it:
 *                   `leadership.ts` owns what an act against the room costs in
 *                   standing, and {@link WhereTheBodyLands.against} names who
 *                   was overruled so the caller can charge it there.
 *
 *   ALL THE ELDERS  and the seat loses it back when it is ALONE. Not a
 *                   majority, not the mean pointing the other way - every elder
 *                   in the room on the far side of them. The interesting seat
 *                   to hold is not the strongest one, it is the one everybody
 *                   else has already agreed about.
 *
 * ── THE THIRD TIER IS NOT INVENTED. HERE IS THE EXISTING INSTANCE ────────
 *
 * `data/cultivation/immortal-items.ts` already carries a body holding a power
 * its own head cannot override: `releaseMode: 'collective_consent'` -
 * *"a body decides, and any member can refuse"* - with `anyoneMayRefuse`, and
 * `RecordedRefusal` holding who refused and the reason given at the time. Two
 * things are taken from it and one deliberately is not.
 *
 *   TAKEN: that a body's collective answer binds its own head. A patriarch
 *   refused a pill by his own elders is this file's third tier, sign flipped.
 *
 *   TAKEN: that a refusal NAMES WHO AND WHY. `refusedBy` is sixty characters of
 *   authored prose rather than a boolean, and that is why a player told no
 *   learns something. {@link WhereTheBodyLands.whoMovedIt} is the same idea at
 *   engine scale.
 *
 *   NOT TAKEN: the types, and not for convenience. `ReleaseModeSchema` names
 *   two ways a HOLDER parts with an OBJECT and its values are exclusive; the
 *   three tiers here are ways one answer is ARRIVED AT and they compose. And
 *   every field of `RecordedRefusal` is an authored historical fact with a
 *   minimum prose length - `yearsAgo`, `afterwards`, `probablyRight`,
 *   `costAnyway` - about a refusal that happened once, whereas this computes a
 *   fresh answer per call. Sharing the type would mean fabricating lore on
 *   every call or gutting a schema four catalog entries depend on.
 *
 * ── AND EVERY THRESHOLD IS BORROWED, NOT CHOSEN ─────────────────────────
 *
 * The weight is `(rankIndex + 1) ** FOLLOWING_SENIORITY_EXPONENT`, which is
 * `distributeFollowing`'s own weight, imported rather than restated: a voice
 * with more people behind it counts for more, and the world had already worked
 * out how many that is. Who counts as a decider is `isElderRank` and
 * `holdsTheSeat`, so a four-rung court and a six-rung pavilion mean the same
 * thing by "the elders" with no special case. What a ledger row is worth is
 * `WHAT_A_RECORD_COUNTS_FOR`, and what a run of them adds up to before it is
 * decisive is `WHAT_MAKES_IT_A_METHOD` - both `personal-alignment.ts`'s, both
 * imported. What counts as disagreeing with the seat is
 * `DISPOSITION_BANDS.WORTH_SAYING`, the bar the disposition module already sets
 * for a reading being worth a sentence: a disagreement big enough to take a
 * house off its patriarch should be one somebody would have mentioned.
 *
 * Pure and total. No state, no I/O, no ladder arithmetic of its own, and NO
 * RANDOMNESS - `openHandednessOf` owns its stream, none is added here, and
 * every world's draws are exactly where they were.
 */

import type { DayIndex } from '../social/common.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';
import {
    FOLLOWING_SENIORITY_EXPONENT,
    holdsTheSeat,
    isElderRank
} from '../cultivation/leadership.js';
import {
    DISPOSITION_BANDS,
    openHandednessOf
} from './how-freely-somebody-parts-with-what-they-have.js';
import {
    WHAT_A_RECORD_COUNTS_FOR,
    WHAT_MAKES_IT_A_METHOD
} from './personal-alignment.js';

// ─────────────────────────────────────────────────────────────────────────
// WHO IS IN THE ROOM
// ─────────────────────────────────────────────────────────────────────────

/**
 * One person on a body's roll.
 *
 * The two fields every roster in this engine already carries - `NpcRecord.id`
 * and `NpcRecord.factionRankIndex` - and deliberately nothing else. No NPC
 * type, no roster, no lookup: see the header on why the player has to be able
 * to sit in this list.
 *
 * A SECT'S ELDERS AND A FAMILY'S SENIORS ARE THIS SAME TYPE, and that is not a
 * convenience. A family in this world is a faction whose roll is entered by
 * blood - `intakeRouteOf` answers `'adoption'` for seven of thirty-four - on
 * the same rank ladder, with the same two fields on its members. There is no
 * second aggregation for families and there must not be one.
 */
export interface OnTheRoll {
    id: string;
    /** Their rung on this body's own ladder. Negative for somebody unaffiliated. */
    rankIndex: number;
}

/**
 * What the ledger between a decider and the asker has done to them, and what
 * it was.
 *
 * Reported rather than folded away, because the scalar is the least useful half
 * of this module's answer: a player's problem is which elder and what it would
 * take, and that is answered by seeing the two terms apart.
 */
export interface WhatMovedThem {
    /** Distinct favours this person owes the asker. */
    favoursOwed: number;
    /** Distinct wrongs this person holds about the asker. */
    wrongsHeld: number;
    /** The heaviest thing standing either way, or null. */
    heaviest: Severity | null;
}

/** One decider, read. */
export interface TheirSay {
    id: string;
    rankIndex: number;
    /** True for the head of the house. At most one person in a body. */
    holdsTheSeat: boolean;
    /** What they are, before anybody did anything to them. */
    baseline: number;
    /** What the asker has already done to them. Zero with no asker and no rows. */
    moved: number;
    /** `baseline + moved`, held to the axis. What the tiers actually weigh. */
    reading: number;
    /** What the sway was made of. Empty counts where nothing was done. */
    whatMovedThem: WhatMovedThem;
    /**
     * How heavily their voice counts. `distributeFollowing`'s own weight, so
     * the arithmetic that shares a house's disciples among its elders is the
     * arithmetic that decides whose opinion carries.
     *
     * The seat is weighed like anybody else at tier one: a head who agrees with
     * their elders has overruled nobody.
     */
    weight: number;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT HAS BEEN DONE TO THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * The axis this module's arithmetic assumes, and the range a reading is held
 * to. `openHandednessOf` is -1..+1 and a caller supplying another axis has to
 * be on the same scale, because the disagreement bar below is an absolute
 * distance rather than a fraction.
 */
const AXIS = 1;

/**
 * How much of the axis one decisive run of deeds is worth.
 *
 * `WHAT_MAKES_IT_A_METHOD` is the point at which `personal-alignment.ts` says a
 * run of deeds has stopped being events and become how somebody operates. That
 * is exactly the weight at which what you have done to a person should be able
 * to account for the whole of their answer, so it is the divisor rather than a
 * new constant: one `unforgivable` favour, or two `grave` ones, moves a decider
 * the entire width of the axis, and forty `slight` ones do too - which is the
 * honest shape, because a career of small kindnesses is a relationship.
 */
function swayFrom(bands: ReadonlyMap<string, Severity>): number {
    let sum = 0;
    for (const severity of bands.values()) sum += WHAT_A_RECORD_COUNTS_FOR[severity];
    return sum / WHAT_MAKES_IT_A_METHOD;
}

/**
 * What one person carries about another, off the ledger and nothing else.
 *
 * ── WHAT IS COUNTED, AND THE DIRECTIONS ARE THE LEDGER'S OWN ─────────────
 *
 *   OWED   `favor` rows where the ASKER is the holder and the DECIDER is the
 *          subject. `grudges.ts`: a favour is held by the person who paid, so
 *          this is the asker having paid for this decider. They owe.
 *   HELD   `grudge` and `blood_feud` where the DECIDER is the holder and the
 *          ASKER is the subject. A wrong is held about the person who did it.
 *
 * ── AND WHAT IS DELIBERATELY NOT ─────────────────────────────────────────
 *
 * `debt`, `oath` and `leverage` are silent here for `personal-alignment.ts`'s
 * reason: they are positions rather than deeds - a debt is owed, an oath binds,
 * a piece of leverage sits there - and none is a transfer anybody made. A
 * leverage row in particular is coercion, which `resolveAttempt` already
 * resolves and prices; reading it here would charge the same threat twice. An
 * oath BROKEN is a wrong and arrives as one, with a grudge on it.
 *
 * A wrong the ASKER holds about the DECIDER is also silent. What moves somebody
 * is what they carry, not what is carried about them.
 *
 * ── ONE DEED IS COUNTED ONCE ─────────────────────────────────────────────
 *
 * `whatADeedLeaves` opens a record for the person, one for each of their kin,
 * and one for their house, and `inheritOnDeath` copies each again to every
 * heir. Counting rows would price a decider's family size as the size of your
 * favour. So rows collapse onto the deed behind them - the triggering fact
 * where there is one, and the original holder, day and cause where there is not
 * - and the heaviest copy stands. This is `personal-alignment.ts`'s own
 * collapse, applied to a pair rather than to a person.
 *
 * Open records only, which also gives the road back for free: a wrong that was
 * avenged, repaid, forgiven or proven false carries a settlement, and the world
 * has stopped holding it against anybody.
 */
export function whatTheyCarryAbout(input: {
    deciderId: string;
    askerId: string;
    ledger: readonly ObligationRecord[];
    asOfDay?: DayIndex;
}): { moved: number; whatMovedThem: WhatMovedThem } {
    const owed = new Map<string, Severity>();
    const held = new Map<string, Severity>();

    for (const record of input.ledger) {
        if (record.status !== 'open') continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;

        const theyOweTheAsker =
            record.kind === 'favor'
            && record.holderId === input.askerId
            && record.subjectId === input.deciderId;
        const theyHoldAWrong =
            (record.kind === 'grudge' || record.kind === 'blood_feud')
            && record.holderId === input.deciderId
            && record.subjectId === input.askerId;
        if (!theyOweTheAsker && !theyHoldAWrong) continue;

        // A record and a deed are not the same thing. See above.
        const key = record.triggeringEventId
            ?? `${record.originHolderId}|${record.incurredOnDay}|${record.cause}`;
        const into = theyOweTheAsker ? owed : held;
        const standing = into.get(key);
        if (
            standing === undefined
            || WHAT_A_RECORD_COUNTS_FOR[record.severity] > WHAT_A_RECORD_COUNTS_FOR[standing]
        ) {
            into.set(key, record.severity);
        }
    }

    let heaviest: Severity | null = null;
    for (const severity of [...owed.values(), ...held.values()]) {
        if (
            heaviest === null
            || WHAT_A_RECORD_COUNTS_FOR[severity] > WHAT_A_RECORD_COUNTS_FOR[heaviest]
        ) {
            heaviest = severity;
        }
    }

    return {
        moved: round4(swayFrom(owed) - swayFrom(held)),
        whatMovedThem: { favoursOwed: owed.size, wrongsHeld: held.size, heaviest }
    };
}

/**
 * Everybody in a body who has a say, off its roll and its ladder.
 *
 * `rankCount` is the length of the body's own rank ladder, which is what makes
 * "the elders" mean the same thing in a four-rung court and a six-rung
 * pavilion. A body with no ladder has nobody who decides, which is the honest
 * answer for the two apexes that take no applicants and appoint instead.
 */
export function whoDecidesIn(input: {
    roll: readonly OnTheRoll[];
    rankCount: number;
    asking?: string | null;
    ledger?: readonly ObligationRecord[];
    readingOf?: (personId: string) => number;
    asOfDay?: DayIndex;
}): TheirSay[] {
    if (input.rankCount <= 0) return [];
    const readingOf = input.readingOf ?? openHandednessOf;
    const asker = input.asking ?? null;
    const ledger = input.ledger ?? [];

    const out: TheirSay[] = [];
    for (const person of input.roll) {
        if (person.rankIndex < 0) continue;
        if (!isElderRank(person.rankIndex, input.rankCount)) continue;

        const raw = readingOf(person.id);
        const baseline = Number.isFinite(raw) ? raw : 0;
        const sway = asker === null
            ? { moved: 0, whatMovedThem: { favoursOwed: 0, wrongsHeld: 0, heaviest: null } }
            : whatTheyCarryAbout({
                deciderId: person.id,
                askerId: asker,
                ledger,
                ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
            });

        out.push({
            id: person.id,
            rankIndex: person.rankIndex,
            holdsTheSeat: holdsTheSeat(person.rankIndex, input.rankCount),
            baseline: round4(baseline),
            moved: sway.moved,
            // Held to the axis: nobody is more than entirely willing. `moved`
            // is reported UNCLAMPED beside it, so a player can still see the
            // full weight of what they put in even once it stops buying more.
            reading: round4(Math.max(-AXIS, Math.min(AXIS, baseline + sway.moved))),
            whatMovedThem: sway.whatMovedThem,
            weight: Math.pow(person.rankIndex + 1, FOLLOWING_SENIORITY_EXPONENT)
        });
    }

    // Heaviest voice first, then by id. Deterministic, because a caller
    // rendering the room must show the same people in the same order twice.
    out.sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// WHERE THE BODY LANDS
// ─────────────────────────────────────────────────────────────────────────

/** Which of the three tiers produced the answer. */
export type SettledBy =
    /** The weighted mean of the room. The ordinary case. */
    | 'the elders'
    /** The head of the house, over a room that wanted something else. */
    | 'the seat'
    /** The room, unanimous, over a head who was alone in it. */
    | 'the elders, unanimous against the seat';

export interface WhereTheBodyLands {
    /**
     * The body's answer, on the axis's own scale.
     *
     * Null where nobody in this body decides anything - an empty roll, no
     * ladder, or nobody standing at an elder rung. A caller must read that as
     * "there is no house to ask" and not as neutrality, which is why it is
     * null rather than zero.
     */
    leaning: number | null;
    settledBy: SettledBy | null;
    /**
     * The one person the answer turned on, or null where nobody did.
     *
     * **The scalar is the least useful half of this answer.** Under three tiers
     * a player's problem is not what the house thinks, it is WHICH ELDER -
     * whether they are trying to buy the answer or to become it - so the answer
     * carries the person, at their weight, with what their own history did to
     * them. Same idea as `RecordedRefusal.refusedBy` naming who refused rather
     * than reporting a bare no.
     *
     * Which person it is depends on the tier, and each is the right answer for
     * its own tier rather than one formula stretched over three:
     *
     *   the elders     the elder pulling hardest on the mean, by
     *                  `weight * |reading - leaning|`. Take them out of the
     *                  room and the answer moves further than for anybody else.
     *   the seat       the head. They are the reason it is not the mean.
     *   unanimous      the elder standing furthest from the seat: the one who
     *                  most visibly would not have it, and the one somebody
     *                  asking around the house would be pointed at first.
     */
    whoMovedIt: TheirSay | null;
    /**
     * Who is on the losing side of an overrule, or empty.
     *
     * The elders the seat went against at tier two; the seat alone at tier
     * three. **This is what a caller charges for.** Nothing here spends
     * anything - `leadership.ts` owns what an act against the room costs in
     * standing, and pricing it again here would be a second governance system.
     * What this supplies is who was overruled, so the caller can hand the right
     * people to `resolveAct`.
     */
    against: readonly TheirSay[];
    /** Everybody who had a say, heaviest voice first. */
    theRoom: readonly TheirSay[];
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * How far from the seat an elder has to stand before they count as disagreeing.
 *
 * `DISPOSITION_BANDS.WORTH_SAYING` is the disposition module's own bar for a
 * reading being remarkable enough to say a sentence about, borrowed rather than
 * chosen. A second constant here would be a second opinion about what a large
 * gap is.
 */
export const A_REAL_DISAGREEMENT = DISPOSITION_BANDS.WORTH_SAYING;

/**
 * What a body wants, from the people who decide in it.
 *
 * ── UNANIMITY IS LITERAL ─────────────────────────────────────────────────
 *
 * Tier three fires when EVERY elder stands more than {@link A_REAL_DISAGREEMENT}
 * from the seat and ALL ON THE SAME SIDE of them. Both halves are needed: a
 * room split hard in both directions is not a room that agrees about anything,
 * and letting it overrule would make disagreement itself the winning move.
 *
 * There is no quorum minimum, because the owner's words are "all the elders"
 * and a minimum would be a rule this file invented. It does mean a body with
 * one elder can have its head overruled by that one person, which reads oddly
 * against tier two's rationale until you notice they are the same situation: a
 * house of two, where the seat is alone in the room. If that ever wants a
 * floor, it is a constant here and not a branch.
 */
export function whatTheBodyWants(input: {
    /** The body's roll. Only the ranks that decide are read. */
    roll: readonly OnTheRoll[];
    /** Length of the body's own rank ladder. */
    rankCount: number;
    /**
     * Who is asking. Omit for what the body wants of nobody in particular,
     * which is the baseline alone.
     */
    asking?: string | null;
    /** Everything the ledger holds between the asker and these deciders. */
    ledger?: readonly ObligationRecord[];
    /**
     * A person to a number, on whatever axis is being asked about. Defaults to
     * the one leaning this world writes for everybody. Must be on -1..+1.
     */
    readingOf?: (personId: string) => number;
    /** Ignore anything incurred after this day. Omit to read everything. */
    asOfDay?: DayIndex;
}): WhereTheBodyLands {
    const room = whoDecidesIn(input);
    if (room.length === 0) {
        return {
            leaning: null,
            settledBy: null,
            whoMovedIt: null,
            against: [],
            theRoom: [],
            line: 'Nobody in this body decides anything - there is no roll, no ladder, or '
                + 'nobody standing high enough on one. That is not the house being neutral, it '
                + 'is there being no house to ask.'
        };
    }

    const seat = room.find(p => p.holdsTheSeat) ?? null;
    const elders = room.filter(p => !p.holdsTheSeat);

    // ── TIER ONE. The weighted mean, and the seat is counted in it ───────
    //
    // A head who agrees with the room has overruled nobody, so they are one
    // more voice - the heaviest - and the answer is the room's.
    const mean = weightedMean(room);

    // With no seat, or no elders, the mean is the whole of it. A body whose
    // only decider is its head is a body whose head decides.
    if (seat === null || elders.length === 0) {
        return {
            leaning: mean,
            settledBy: 'the elders',
            whoMovedIt: pullingHardest(room, mean),
            against: [],
            theRoom: room,
            line: seat === null
                ? `The elders answer and there is nobody seated above them. Weighted across `
                  + `${room.length}, the body lands at ${mean.toFixed(3)}.`
                : 'Nobody stands at an elder rung, so the head of the house is the whole of the '
                  + `room and the body lands at ${mean.toFixed(3)}.`
        };
    }

    const elderMean = weightedMean(elders);
    const apart = elders.map(e => e.reading - seat.reading);

    // ── TIER THREE, ASKED BEFORE TIER TWO ────────────────────────────────
    //
    // The narrower condition, and it is tier two that gets taken back - so the
    // question is whether the seat's overrule survives, not whether it happens.
    const allBelow = apart.every(d => d <= -A_REAL_DISAGREEMENT);
    const allAbove = apart.every(d => d >= A_REAL_DISAGREEMENT);
    if (allBelow || allAbove) {
        return {
            leaning: elderMean,
            settledBy: 'the elders, unanimous against the seat',
            whoMovedIt: furthestFrom(elders, seat.reading),
            against: [seat],
            theRoom: room,
            line: `All ${elders.length} elders stand ${allAbove ? 'above' : 'below'} the head of `
                + `the house by more than ${A_REAL_DISAGREEMENT}. The seat is overruled and the `
                + `body lands at ${elderMean.toFixed(3)} rather than `
                + `${seat.reading.toFixed(3)}. A head who is alone in the room does not hold it.`
        };
    }

    // ── TIER TWO. The seat overrules, and somebody else charges for it ───
    if (Math.abs(seat.reading - elderMean) >= A_REAL_DISAGREEMENT) {
        const overruled = elders.filter(
            e => Math.abs(e.reading - seat.reading) >= A_REAL_DISAGREEMENT
        );
        return {
            leaning: seat.reading,
            settledBy: 'the seat',
            whoMovedIt: seat,
            against: overruled,
            theRoom: room,
            line: `The room would have landed at ${elderMean.toFixed(3)} and the head of the `
                + `house is at ${seat.reading.toFixed(3)}. They overrule it, over `
                + `${overruled.length} of ${elders.length} elders far enough away to mind, and `
                + 'what that costs them with those people is charged where standing is kept.'
        };
    }

    return {
        leaning: mean,
        settledBy: 'the elders',
        whoMovedIt: pullingHardest(room, mean),
        against: [],
        theRoom: room,
        line: 'The head of the house and the room are not far enough apart for anybody to be '
            + `overruling anybody. Weighted across ${room.length} people, the body lands at `
            + `${mean.toFixed(3)}.`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// PLUMBING
// ─────────────────────────────────────────────────────────────────────────

function weightedMean(people: readonly TheirSay[]): number {
    let total = 0;
    let weights = 0;
    for (const p of people) {
        total += p.reading * p.weight;
        weights += p.weight;
    }
    // Cannot happen - the weight is `(rankIndex + 1) ** 2` and `rankIndex` is
    // non-negative by here - but a division that could produce NaN is not left
    // resting on that argument.
    if (weights <= 0) return 0;
    return round4(total / weights);
}

/**
 * Whose voice the mean is standing where it is because of.
 *
 * `weight * |reading - mean|` rather than the largest weight or the most
 * extreme reading: a very senior elder who agrees with everybody has not moved
 * the answer, and a junior one at the far end of the scale has barely been
 * heard. What matters is both at once.
 */
function pullingHardest(people: readonly TheirSay[], mean: number): TheirSay | null {
    let best: TheirSay | null = null;
    let bestPull = -1;
    for (const p of people) {
        const pull = p.weight * Math.abs(p.reading - mean);
        if (pull > bestPull || (pull === bestPull && best !== null && p.id < best.id)) {
            best = p;
            bestPull = pull;
        }
    }
    return best;
}

/** The person standing furthest from a given reading. Ties broken by id. */
function furthestFrom(people: readonly TheirSay[], reading: number): TheirSay | null {
    let best: TheirSay | null = null;
    let bestGap = -1;
    for (const p of people) {
        const gap = Math.abs(p.reading - reading);
        if (gap > bestGap || (gap === bestGap && best !== null && p.id < best.id)) {
            best = p;
            bestGap = gap;
        }
    }
    return best;
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}
