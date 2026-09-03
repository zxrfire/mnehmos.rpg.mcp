/**
 * What an elder is in charge of, and why they are an elder at all.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULINGS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on what a portfolio is:
 *
 *   > ALSO elders should own something in a sect, like punishment elder (you
 *   > control the jails) etc. (also that gives you a position ripe for bribes
 *   > and favors people can ASK OF YOU).
 *
 * On what makes somebody an elder rather than a chosen:
 *
 *   > the difference between an elder and a chosen (or conclave disciple) is
 *   > responsibility + ability to advance
 *   > like an elder is probably old and can't go further so they do management
 *   > a conclave disciple (for example), might be the same rank, young, and
 *   > with a future
 *
 * And the line that stops all of it being deterministic:
 *
 *   > and an elder still might, out of luck
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A PORTFOLIO IS A ROOM WITH A BAR ON IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Not a list of offices, and not the rank ladder. **`ranks` is a dead end for
 * this** and it was checked: every house names its tiers in its own idiom -
 * Sword Elder, Life Elder, Mountain Elder, Dew Elder - and all of them are the
 * elder rung wearing a costume. Not one of them names a domain.
 *
 * `architecture.ts` has the offices, and its own `roomsFor` docstring already
 * states the rule this module needed: *"Every line reads a column. Nothing here
 * is a per-faction table, and the variety comes from the fact that the columns
 * genuinely differ."* A house that takes no applicants has no dormitory; one
 * sitting on a vein has a chamber over it; one that answers to somebody has a
 * tribute room.
 *
 * So the criterion is `roomAuthorityOf(purpose).sealed`, and nothing else.
 * Nobody is Elder of the Forecourt. A room people walk through is not an
 * office; a room with a bar on it is a room somebody decides about.
 *
 * MEASURED BEFORE IT WAS BUILT, over a seeded world of 35 houses: 14.7 distinct
 * rooms per house, of which the sealed ones came to 2.06, against 2.3 people
 * standing at a deciding rung. **One portfolio per elder, with nothing tuned.**
 * Where a house has three sealed rooms and two elders, somebody holds two, and
 * that is truer than pretending to a bureaucracy.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * FIRST REFUSAL, WHICH IS NOT A SECOND AGGREGATOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A portfolio is a claim on a decision, not a decision procedure. Three shapes
 * were on the table and only one composes with the tiers that already exist:
 *
 *   A HEAVIER WEIGHT   makes the holder merely loud. The room can still
 *                      steamroll them, and nothing about the domain is
 *                      actually theirs - it fails "you control the jails".
 *   A VETO             makes them unoverrulable, which breaks the tier the
 *                      owner ruled explicitly: the head can overrule an elder.
 *   FIRST REFUSAL      their answer stands as the body's answer, unless
 *                      somebody escalates.
 *
 * First refusal is `whatTheBodyWants` with the room narrowed to the holder, and
 * then the ordinary tiers on top: their answer stands, the head can overrule
 * it, and a unanimous room can overrule the head. **There is no second
 * aggregation here and there must not be one** - this module decides WHO IS
 * ASKED and hands off.
 *
 * It also makes the bribery case sharp in the right way. Satisfy the elder who
 * holds the jails and it is done, with no vote at all; escalation is what a
 * rival does about it afterwards, and `WhereTheBodyLands.against` already
 * records who was overruled.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND WHY THEY ARE AN ELDER: THE CLIMB STOPPED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * An elder holds a room because they are not going any further. Management is
 * what you do when you have stopped rising, and that inverts the usual reward
 * shape: **a player still climbing should not want to be made an elder.**
 *
 * NOTHING NEW ANSWERS THIS. The world already keeps the whole of it:
 *
 *     stagnationYearsForOrdinal   what the ladder credits at this rung before
 *                                 the climb ends. `schema/cultivation.ts`.
 *     the settling clock          `NpcRecord.cultivation.lastAdvancedOnDay`,
 *                                 whose own docstring calls it "how long they
 *                                 have been stuck here at all, and a plateau
 *                                 longer than the realm allows ends the climb"
 *     yearsAtCurrentRealm         the player-side half, and `stagnationRemaining`
 *                                 in `survival.ts` already subtracts the two
 *
 * So {@link howFinishedTheyLook} is a subtraction over columns that exist, and
 * there is no `settled` flag anywhere. That is deliberate and it is the owner's
 * instruction: settling is a fact about a person - their years held against
 * what their rung credits - and the moment it becomes a field somebody sets, it
 * gets written on the wrong people.
 *
 * ── AND IT IS A BELIEF, NOT A CEILING ────────────────────────────────────
 *
 * **Nothing in this module gates an advancement, and nothing may.** *"An elder
 * still might, out of luck."* The house's reading that somebody is finished is
 * a reading OF them, and the world is entitled to disagree - the catalog
 * already carries the precedent one rung up, where The Severed's head stands at
 * 38 over a shelf that stops at 37 and the owner ruled that gap be documented
 * as luck rather than closed.
 *
 * If this reading ever refuses a rung, it has turned a belief into physics.
 * There is no export here that a breakthrough path could consult even by
 * accident: every function returns a description, none returns a permission,
 * and `tests/` asserts the reading has no consumer in the advancement path.
 *
 * What an elder who climbs anyway produces is not a rule but a question - do
 * they keep the room, when somebody else has been waiting for it - and that
 * question is `whatTheBodyWants`'s to answer, differently per house.
 *
 * ── ELDER AND CHOSEN ARE ONE HEIGHT WITH TWO READINGS ────────────────────
 *
 * The owner: *"a conclave disciple might be the same rank, young, and with a
 * future."* So this is a name at a height rather than a fork in the ladder.
 *
 * CHECKED AGAINST THE CATALOG, AND THE PAIRED VOCABULARY IS NOT THERE. No
 * house's `ranks` array carries an elder word and a rising word at one index.
 * Three near misses and nothing more: the Crimson Abyss Hall has `Chosen` as a
 * rung of its own, the Standing Grove fuses both into `Elder Disciple`, and the
 * Orchid Court runs two elder rungs (`Terrace Elder`, `Valley Elder`). So this
 * module does NOT invent a second title per house. It returns the house's own
 * word for the rung, plus the reading - which is the honest split, because the
 * word is the house's and the verdict is what differs.
 *
 * `chosen` itself is not modelled here either: it is an existing live tag on
 * `NpcRecord`, maintained yearly by `refreshChosen` and read by `chosenOf` in
 * `world/gatherings.ts`. A second notion of who a house favours would be a
 * second notion of who a house favours.
 *
 * Pure and total. No state, no I/O, no rolls, and no authority over anything.
 */

import type { RoomPurpose } from '../world/architecture.js';
import { roomAuthorityOf } from '../world/architecture.js';
import { stagnationYearsForOrdinal } from '../../schema/cultivation.js';
import { mayExercise } from '../cultivation/leadership.js';
import type { OnTheRoll, TheirSay, WhereTheBodyLands } from './what-a-body-wants-is-what-its-deciders-want.js';
import { whatTheBodyWants, whoDecidesIn } from './what-a-body-wants-is-what-its-deciders-want.js';

// ─────────────────────────────────────────────────────────────────────────
// HAS THE CLIMB STOPPED
// ─────────────────────────────────────────────────────────────────────────

/**
 * Share of what the rung credits that somebody has already spent standing on
 * it, past which a house reads them as finished.
 *
 * Not a new clock and not a new number in the balance sense - it is a fraction
 * of `stagnationYearsForOrdinal`, which is the span the ladder already credits
 * before a plateau ends the climb. Three quarters, because a house forms this
 * opinion well before the arithmetic runs out: somebody who has spent three
 * quarters of what their rung allows and not moved is somebody the people
 * around them have stopped expecting anything from, and the last quarter is
 * exactly where "an elder still might, out of luck" lives.
 */
export const READ_AS_FINISHED_AT = 0.75;

export interface HowFinishedTheyLook {
    /** Years they have stood at this rung without advancing. */
    yearsHeld: number;
    /** What the ladder credits at this rung before the climb ends. */
    yearsCredited: number;
    /** `yearsHeld / yearsCredited`, uncapped so a caller can see how far past. */
    spent: number;
    /**
     * Whether a house would read them as done.
     *
     * A BELIEF AND NEVER A CEILING. Nothing may refuse an advancement on this.
     */
    looksFinished: boolean;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * How finished somebody looks, from the two columns the world already keeps.
 *
 * Takes the years rather than the record, so the same function answers for a
 * player (`yearsAtCurrentRealm`) and for somebody on the roster (today minus
 * `lastAdvancedOnDay`) without either shape being named here.
 */
export function howFinishedTheyLook(input: {
    realmOrdinal: number;
    yearsHeld: number;
}): HowFinishedTheyLook {
    const credited = Math.max(1, stagnationYearsForOrdinal(input.realmOrdinal));
    const held = Math.max(0, input.yearsHeld);
    const spent = round4(held / credited);
    const looksFinished = spent >= READ_AS_FINISHED_AT;
    return {
        yearsHeld: held,
        yearsCredited: credited,
        spent,
        looksFinished,
        line: looksFinished
            ? `${Math.round(held)} years at this rung against the ${Math.round(credited)} it `
              + 'credits. The people around them have stopped expecting another one, which is '
              + 'a thing they believe and not a thing the ladder enforces.'
            : `${Math.round(held)} years at this rung against the ${Math.round(credited)} it `
              + 'credits. Nobody has written them off.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE HOUSE CALLS THEM
// ─────────────────────────────────────────────────────────────────────────

export type HowTheyAreHeld =
    /** Stopped, and holding a room. The ordinary elder. */
    | 'settled, and in charge of something'
    /**
     * Stopped, holding no room, and carried anyway.
     *
     * NOT THE BOTTOM OF A SCALE, and an earlier draft of this file had that
     * wrong. The design owner: *"an elder with no office should be rare, sects
     * don't typically want them, cuz it's bloat, unless you are good."* A house
     * paying a title and a stipend for somebody who administers nothing is
     * carrying them, and nobody is carried for being barely tolerable. The seat
     * is uncommon and it is EARNED.
     *
     * And it has real content rather than being an absence: *"you can take
     * disciples as an elder with no office tho and have the standing of one."*
     *
     * **It is STRICTLY WORSE than an office, not different from one**, and an
     * earlier draft of this file had that wrong too - it wrote the two as a
     * trade between a room and people. They do not trade: *"even an office
     * elder can take disciples too."* A room is additive, so nobody prefers to
     * go without one, and there is deliberately no balancing anywhere in this
     * module between a following and a portfolio.
     *
     * What survives is better than a trade-off, because the weight arithmetic
     * is untouched: following size IS the aggregation weight, so an office-less
     * elder with many disciples can still outweigh an office-holder with few.
     * Worse off in every other respect and still able to move the room - real
     * consolation, and not enough to make anybody want the seat.
     */
    | 'settled, carried for what they are'
    /** Still rising, at the same height. The house expects more. */
    | 'still rising';

export interface WhatTheHouseMakesOfThem {
    /** The house's own word for the rung. Never invented here. */
    title: string;
    is: HowTheyAreHeld;
    /**
     * THE OFFICE FIELD. Which sealed rooms they are over, deepest first.
     *
     * The design owner: *"so elders need to have an office field and it can be
     * empty."* Declared and possibly empty rather than absent, and that is the
     * point of it: without the slot there is no difference between *this elder
     * holds no office* and *nobody has worked out what this elder holds*, and
     * those are the two states the whole design turns on. **An absence needs a
     * slot to be absent from.** A null in a declared field is a fact; a missing
     * field is a question.
     *
     * It carries the ROOM and never a title. The house's own word for the rung
     * is `title`, off `ranks`, exactly as it already was - one fact, one place.
     *
     * ── THE TWO-SIDED INVARIANT, AND IT IS STRUCTURAL ────────────────────
     *
     * An elder may hold SEVERAL rooms - hence a list - and a room may have only
     * ONE holder, because a room two people both have first refusal on has no
     * first refusal at all. The second half is not enforced by a check here: it
     * is guaranteed by shape, because {@link APortfolio} is keyed by purpose and
     * {@link whoIsInChargeOfWhat} emits exactly one entry per sealed room. There
     * is nowhere for a second holder to be written.
     */
    holds: readonly RoomPurpose[];
    finished: HowFinishedTheyLook;
    /**
     * Whether the rung lets them take disciples under their own line.
     *
     * `leadership.ts`'s `recruit_disciples`, asked rather than restated - the
     * elder tier has held that power since before portfolios existed. **Every
     * elder has it, office or not**, which is what makes the office-less seat
     * strictly worse rather than a different bargain.
     *
     * It is still the interesting half of that seat, because
     * `distributeFollowing` sizes a following and `whatTheBodyWants` weighs a
     * decider by that same seniority number: a following is weight in every
     * question, where a room is first refusal in one.
     */
    mayTakeDisciples: boolean;
    line: string;
}

/**
 * What a house's own ladder calls somebody, and what that placement means.
 *
 * The three readings are the owner's, ordered by how good they are to receive:
 * still rising is the best, settled with a room is real power, and settled with
 * nothing is the worst of the three because it is a verdict and an absence at
 * once.
 */
export function whatTheHouseMakesOfThem(input: {
    ranks: readonly string[];
    rankIndex: number;
    realmOrdinal: number;
    yearsHeld: number;
    holds?: readonly RoomPurpose[];
}): WhatTheHouseMakesOfThem {
    const finished = howFinishedTheyLook(input);
    const holds = (input.holds ?? []).slice();
    const title = input.ranks[input.rankIndex] ?? '';
    const mayTakeDisciples =
        mayExercise('recruit_disciples', input.rankIndex, input.ranks.length);

    const is: HowTheyAreHeld = !finished.looksFinished
        ? 'still rising'
        : holds.length > 0
            ? 'settled, and in charge of something'
            : 'settled, carried for what they are';

    return {
        title,
        is,
        holds,
        finished,
        mayTakeDisciples,
        line: is === 'still rising'
            ? `${title}, and the house has not decided they are done - same height, and they are `
              + 'expected to go further. That is a better thing to be handed than a room, and '
              + 'they answer to the people at their own rung who have stopped.'
            : is === 'settled, and in charge of something'
                ? `${title}, holding ${holds.join(', ')}. They are not going further and they run `
                  + 'something, which is what the rung is actually for.'
                : `${title}, and no room under them. A house does not carry a title and a stipend `
                  + 'for somebody it merely tolerates, so this seat is uncommon and it was '
                  + `earned${mayTakeDisciples
                      ? ' - what they do instead of administering is take disciples, and a '
                        + 'following is weight in every question rather than first refusal in one'
                      : ''}.`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHO ANSWERS TO WHOM AT ONE HEIGHT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether one person may direct another who stands at the same rung.
 *
 * The design owner: *"an elder has authority over a conclave disciple as in i
 * can order them around."* That is the compensation for having stopped - you
 * cannot climb, and you can direct the people who still can.
 *
 * ── AND IT IS DELIBERATELY NOT THE RANK LADDER ───────────────────────────
 *
 * `leadership.ts`'s `canOrder` answers the ordinary question and answers it
 * correctly: you may order anybody BELOW you and nobody at or above. This is
 * the other question, at one height, and a single ordinal cannot carry it -
 * which is exactly why the owner's distinction is a name at a height rather
 * than a height.
 *
 * **No fractional rank bump, and there must never be one.** Giving elders a
 * nudged ordinal to make ordering fall out of `canOrder` would collapse this
 * back into the ladder it exists beside, and would then leak into every
 * comparison that reads a rank index for something else.
 *
 * So this is a second, narrow predicate: at the SAME rung, somebody the house
 * reads as finished may direct somebody it does not. Below or above, it defers
 * to the ladder and says nothing of its own.
 *
 * AND AN ORDER IS NOT OBEDIENCE. What this returns is standing to give one. A
 * conclave disciple can refuse, refusing is a deed with a name on it, and who
 * was right is a question for the room - `whoMovedIt` and `against` say who
 * backed whom, and a disciple with the room behind them has learned something
 * about their own future.
 */
export function mayDirectAtTheSameRung(
    giver: { rankIndex: number; looksFinished: boolean },
    receiver: { rankIndex: number; looksFinished: boolean }
): boolean {
    if (giver.rankIndex !== receiver.rankIndex) return false;
    return giver.looksFinished && !receiver.looksFinished;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO IS IN CHARGE OF WHAT
// ─────────────────────────────────────────────────────────────────────────

export interface APortfolio {
    purpose: RoomPurpose;
    /** Who holds it, or null where the house has nobody to hold it. */
    holderId: string | null;
    /** How far into the compound it sits. Deepest goes to the most senior. */
    depth: number;
}

/**
 * Hand a house's sealed rooms to the people who decide in it.
 *
 * Deterministic and dealt rather than drawn: rooms deepest-first, people
 * heaviest-voice-first, round robin. So the deepest room lands in the most
 * senior hands, and where there are more rooms than people the same person
 * takes a second - which is the ordinary case at 2.06 rooms against 2.3
 * deciders and is the honest picture of a house of nine.
 *
 * No RNG. A player has to be able to work out whose door to knock on before
 * knocking, and a drawn assignment would be unlearnable.
 */
export function whoIsInChargeOfWhat(input: {
    /** Every room the house has. Unsealed ones are dropped here. */
    rooms: readonly RoomPurpose[];
    /** The house's roll and ladder, read by the module that owns deciders. */
    roll: readonly OnTheRoll[];
    rankCount: number;
}): APortfolio[] {
    const sealed = [...new Set(input.rooms)]
        .map(purpose => ({ purpose, ...roomAuthorityOf(purpose) }))
        .filter(r => r.sealed)
        .sort((a, b) => b.depth - a.depth || a.purpose.localeCompare(b.purpose));

    const room = whoDecidesIn({ roll: input.roll, rankCount: input.rankCount });
    if (room.length === 0) {
        return sealed.map(r => ({ purpose: r.purpose, holderId: null, depth: r.depth }));
    }
    return sealed.map((r, i) => ({
        purpose: r.purpose,
        holderId: room[i % room.length].id,
        depth: r.depth
    }));
}

/** What this person is in charge of, deepest first. */
export function whatTheyHold(
    portfolios: readonly APortfolio[],
    personId: string
): RoomPurpose[] {
    return portfolios
        .filter(p => p.holderId === personId)
        .sort((a, b) => b.depth - a.depth || a.purpose.localeCompare(b.purpose))
        .map(p => p.purpose);
}

/** Who answers first about this room, or null where nobody holds it. */
export function whoAnswersAbout(
    portfolios: readonly APortfolio[],
    purpose: RoomPurpose
): string | null {
    return portfolios.find(p => p.purpose === purpose)?.holderId ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// FIRST REFUSAL
// ─────────────────────────────────────────────────────────────────────────

export interface WhoseCallItIs {
    /** The room the question is about. */
    purpose: RoomPurpose;
    /** Who answers first, or null where the whole room does. */
    holderId: string | null;
    /**
     * The answer, from the one aggregator.
     *
     * With a holder this is the body's answer with the room narrowed to them -
     * first refusal - and the ordinary tiers still apply on top, because the
     * head is in every room and a unanimous council can still take it back.
     * With no holder it is simply the body's answer.
     */
    answer: WhereTheBodyLands;
    /** True where one person answered rather than the room. */
    theirCallAlone: boolean;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Who answers a question about one room, and what they say.
 *
 * ── FIRST REFUSAL IS A NARROWING, NOT A PROCEDURE ────────────────────────
 *
 * The holder plus whoever stands above them, handed to `whatTheBodyWants`
 * unchanged. Everything the three tiers already do still happens: the holder's
 * answer stands, the head can overrule it, and a unanimous council can overrule
 * the head. Nothing about a portfolio is a new way of deciding - it is a
 * different set of people being asked.
 *
 * The head is kept in the narrowed room deliberately. A portfolio that put its
 * holder beyond their own head would be the veto the owner ruled out.
 */
export function whoseCallItIs(input: {
    purpose: RoomPurpose;
    portfolios: readonly APortfolio[];
    roll: readonly OnTheRoll[];
    rankCount: number;
    asking?: string | null;
    ledger?: Parameters<typeof whatTheBodyWants>[0]['ledger'];
    asOfDay?: number;
}): WhoseCallItIs {
    const holderId = whoAnswersAbout(input.portfolios, input.purpose);
    const everyone = whoDecidesIn({ roll: input.roll, rankCount: input.rankCount });
    const head = everyone.find((p: TheirSay) => p.isHead) ?? null;

    // Narrow to the holder and whoever stands above them. With no holder the
    // question was never anybody's in particular and the whole room answers.
    const narrowed: OnTheRoll[] = holderId === null
        ? input.roll.slice()
        : input.roll.filter(p => p.id === holderId || (head !== null && p.id === head.id));

    const answer = whatTheBodyWants({
        roll: narrowed,
        rankCount: input.rankCount,
        ...(input.asking === undefined ? {} : { asking: input.asking }),
        ...(input.ledger === undefined ? {} : { ledger: input.ledger }),
        ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
    });

    const theirCallAlone = holderId !== null && answer.settledBy === 'the elders';

    return {
        purpose: input.purpose,
        holderId,
        answer,
        theirCallAlone,
        line: holderId === null
            ? `Nobody in this house holds ${input.purpose}, so it is not one person's to answer `
              + 'and the room decides it like anything else.'
            : theirCallAlone
                ? `It is ${holderId}'s room. They answered, nobody above them took it off them, `
                  + 'and there was no vote because there did not need to be one.'
                : `It is ${holderId}'s room and it was taken out of their hands: `
                  + `${answer.settledBy}. Being overruled about your own room is a different `
                  + 'thing from losing a general argument, and the house saw it.'
    };
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}
