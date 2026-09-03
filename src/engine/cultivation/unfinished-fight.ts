/**
 * A fight that has started and has not ended: the state between two rounds.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `resolveConfrontation` settles a whole fight in one call, which is right for
 * two people meeting on a road at the far end of a time skip and wrong for the
 * person playing. The design owner's ruling:
 *
 *   > combat should also of course resolve across multiple turns to give the
 *   > player agency (fleeing, how, to where, using what ability, or item?). if
 *   > you fought and it resolves in one turn and you died it would be
 *   > unsatisfying cuz there's nothing you can do about it.
 *
 * The complaint is precise and it is not about fairness. A death you could not
 * have seen coming and could not have run from is unsatisfying; a death you
 * walked into with the numbers in front of you is the game working. So this
 * module holds a fight open, shows the state that lets somebody know they are
 * losing BEFORE they have lost, and makes getting out a real and priced act.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT IS NOT A SECOND COMBAT SYSTEM, AND THAT IS THE WHOLE CONSTRAINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Every number here comes out of `combat.ts` through the same functions the
 * one-call resolver uses:
 *
 *   whether there is a fight  `theGapDecidesItAlone` - the categorical gap,
 *                             asked before anything is rolled, in both
 *                             directions, exactly as `resolveConfrontation`
 *                             asks it.
 *   the blows                 `resolveConfrontationRound`, which is the body of
 *                             `resolveConfrontation`'s own loop. There is one
 *                             copy of the physics and both entrances call it.
 *   getting away              `attemptFlight`, which has had real arithmetic
 *                             since it was written and had no caller anywhere
 *                             in `src/engine/` or `src/web/`.
 *   what the ending meant     `concludeConfrontation` and `stalemate`, so a
 *                             fight carried over six turns ends in the same
 *                             vocabulary as one settled in a single call, and
 *                             the tradition still decides whether a destroyed
 *                             body was an ending.
 *
 * Nothing in this file decides an outcome. It decides WHOSE TURN IT IS, which
 * is the only thing the two entrances legitimately differ about.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE PLAYER IS NOT THE ONLY ONE WHO CHOOSES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * AGENTS.md: a rule that binds the player and not NPCs is the same defect as
 * one that binds NPCs and not the player. So the other side picks a posture
 * too, out of the same three, through {@link howTheyAreFighting} - and it is
 * derived from what they WANT rather than chosen off a list of behaviours.
 * Somebody nearly finished covers up; somebody about to finish it commits.
 * A third reason to press needs no code, only a different want.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * DETERMINISM
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Each round draws from its OWN named sub-stream, `fight` keyed on the fight's
 * id and the round index - which is what `rng.ts` built named streams for. Two
 * consequences, both wanted:
 *
 *   - No existing draw anywhere moves, because nothing else has ever used this
 *     stream name. A new draw on an existing stream is a regression until
 *     proved otherwise; this is not one.
 *   - Round four is the same round four whether the player took it immediately
 *     or thought about it for a week, and whether they guarded or pressed on
 *     round three. The posture changes the arithmetic, never which numbers came
 *     up.
 *
 * It also means a fight taken a round at a time is NOT byte-identical to the
 * same pairing put through `resolveConfrontation`, and it must not be: they are
 * different streams because they are different events. What is identical is the
 * function that turns two priced bodies and a roll into a wound.
 *
 * Pure. No database, no clock, no I/O. The caller owns the row it is stored in.
 */

import type { AmbientQi, Injury, Technique } from '../../schema/cultivation.js';
import {
    MAX_EXCHANGES,
    WITHDRAW_HP_FRACTION,
    assessGap,
    assessPower,
    attemptFlight,
    concludeConfrontation,
    resolveConfrontationRound,
    stalemate,
    theGapDecidesItAlone,
    type AttackVector,
    type CombatantInput,
    type CombatantPower,
    type ConfrontationIntent,
    type ConfrontationResult,
    type Edge,
    type ExchangeRecord,
    type FleeResult,
    type GapAssessment,
    type PowerContext,
    type RoundAct
} from './combat.js';
import { forStream, type CultivationRNG } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// THE GROUND, WHICH IS WHAT "BACK OFF TO WHERE" IS ASKING ABOUT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somewhere a flight could carry you, as the world already knows it.
 *
 * Supplied by the caller off real place rows. This module never invents one:
 * an empty list is a legitimate and important state - it is a fight in the
 * middle of nowhere - and the honest answer to "back off to where" is then
 * "away from them, and that is all you know".
 */
export interface WayOut {
    id: string;
    name: string;
    /** Walking days, as the road catalog states them. */
    days: number;
}

export interface FightGround {
    locationId: string;
    locationName: string;
    waysOut: readonly WayOut[];
}

// ─────────────────────────────────────────────────────────────────────────
// THE FIGHT
// ─────────────────────────────────────────────────────────────────────────

/** One side of an unfinished fight, and what they brought to it. */
export interface FightSide {
    input: CombatantInput;
    /**
     * What they BROUGHT, fixed for the duration. A posture is chosen every
     * round and is not in here - see `RoundAct` in `combat.ts` for why the two
     * are priced separately.
     */
    edges: readonly Edge[];
    vector: AttackVector;
    /** A movement art, for `attemptFlight`. Null when they have none ready. */
    movement: Technique | null;
    movementMastery: number;
}

/**
 * A fight in progress. Holds no functions, so a caller may serialise it.
 *
 * DELIBERATELY NOT A DATABASE ROW HERE. Where an unfinished fight is kept is
 * the caller's decision and it is a real one.
 *
 * ── TWO UNFINISHED THINGS, ONE SHAPE, TWO LIFETIMES ──────────────────────
 *
 * This repository now has two kinds of undertaking that outlive a turn, and
 * they want the same TYPE and opposite storage:
 *
 *   a build on the stocks   `web/half-built-craft.ts` keeps it in
 *                           `cultivator_flags`, a durable per-cultivator
 *                           document. Correct: you lay a keel, find you are
 *                           four hides short, go and hunt for a season, and
 *                           come back to the same hull.
 *   a fight                 in memory on the service, the treatment
 *                           `SeclusionCrossroads` gets and for the same reason.
 *                           A fight is happening NOW. Persisting one would let
 *                           a player walk out mid-swing, cultivate for ten
 *                           years, and come back to find the same person still
 *                           standing there with their arm raised - which is not
 *                           a fight, it is a saved game.
 *
 * The shared discipline is the one thing worth copying between them: the state
 * is a plain serialisable record with no functions and no live object
 * references in it, so where it is kept is a decision the caller makes rather
 * than one the type forces. Losing an in-memory fight costs the player nothing
 * they were not already losing, because losing it is the fight ending where it
 * stood.
 */
export interface UnfinishedFight {
    /** Stable for the life of the fight. Half of every round's stream key. */
    id: string;
    /** The run's own seed. The other half of the stream key. */
    seed: string;
    /** Rounds already fought. The next one is this index. */
    roundsFought: number;
    /**
     * Rounds before it is called a stalemate.
     *
     * `MAX_EXCHANGES`, which is the same budget `resolveConfrontation` runs on
     * and is set where it is so that an even fight only just runs out. A fight
     * carried across turns must not last longer than the same fight settled in
     * one call, or a player who is losing could simply keep typing.
     */
    roundBudget: number;
    aggressor: FightSide;
    defender: FightSide;
    /** Running totals, keyed by combatant id. Written every round. */
    hp: Record<string, number>;
    injuries: Record<string, Injury[]>;
    /** What each of them stood on when it opened, for "was the winner touched". */
    hpAtOpening: Record<string, number>;
    exchanges: ExchangeRecord[];
    brokenObjects: ConfrontationResult['brokenObjects'];
    intent: ConfrontationIntent;
    /** Whose fight this is from the player's side. One of the two ids. */
    playerId: string;
    ground: FightGround;
    /** The turn the fight opened on, stamped onto wounds. */
    openedOnTurn: number;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PLAYER SAYS BACK
// ─────────────────────────────────────────────────────────────────────────

/**
 * The answers a person standing in a fight can give.
 *
 * Every one of them is a sentence somebody types rather than a control they
 * click, and each maps onto something the engine could already price. There is
 * no `wait` and no `do nothing`: a round is spent whatever happens, and an
 * answer that spends it on nothing would be a worse `guard`.
 */
export type FightAnswer =
    /** Swing. The ordinary round, and what happens when nobody chose. */
    | { kind: 'strike'; vector?: AttackVector }
    /** "I block his sword." Spend the round on not being hit. */
    | { kind: 'guard' }
    /** "I let him hit me." Spend the round on the blow and wear what comes. */
    | { kind: 'press'; vector?: AttackVector }
    /** "I back off." Turn your back, at a price, toward somewhere or nowhere. */
    | { kind: 'break_off'; toward?: string | null }
    /** "I shout for the wardens." Spend the round on a shout. */
    | { kind: 'call_for_help'; to?: string | null };

/** The three postures, mapped. Breaking off and shouting are not postures. */
const POSTURE_OF: Readonly<Record<'strike' | 'guard' | 'press', RoundAct>> = Object.freeze({
    strike: 'strike', guard: 'guard', press: 'press'
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE OTHER SIDE IS DOING
// ─────────────────────────────────────────────────────────────────────────

/**
 * How somebody who is not the player fights this round.
 *
 * MODELLED AS A WANT, NOT AS A TABLE OF BEHAVIOURS. Two facts about the
 * situation decide it, and both are already on the running totals:
 *
 *   they are nearly done      cover up. Below the floor at which this engine
 *                             already says a fight ends, somebody is trying to
 *                             still be there at the end of the round.
 *   they are nearly finishing  commit. When the other body is under that same
 *                             floor, the round that ends it is worth taking a
 *                             blow for.
 *
 * One threshold, read from both sides, and it is `WITHDRAW_HP_FRACTION` - the
 * number this engine already uses for "the price has stopped being worth it".
 * Nothing new is tuned here, and a third reason to press would need a different
 * want rather than another branch.
 *
 * `willWithdraw` on the intent still decides whether they break off outright;
 * this is only what they do while they are still in it.
 */
export function howTheyAreFighting(
    theirHp: number,
    theirMaxHp: number,
    otherHp: number,
    otherMaxHp: number
): RoundAct {
    const cornered = theirHp < theirMaxHp * WITHDRAW_HP_FRACTION;
    const closing = otherHp < otherMaxHp * WITHDRAW_HP_FRACTION;
    // Cornered wins over closing: somebody about to go down does not trade.
    if (cornered) return 'guard';
    if (closing) return 'press';
    return 'strike';
}

// ─────────────────────────────────────────────────────────────────────────
// WHO WOULD COME IF YOU SHOUTED
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somebody standing close enough to hear, and what they are to you.
 *
 * Built by the caller off records the world already keeps. There is no
 * would-they-come number anywhere in this engine and there must not be one, for
 * the same reason `ConfrontationIntent.yields` gives about submission: whether
 * somebody answers is a fact about who they are, and every fact about who
 * somebody is already lives somewhere.
 */
export interface CouldBeCalled {
    id: string;
    name: string;
    realmOrdinal: number;
    /**
     * What they already are to the caller, -1..1, off the relationship row.
     *
     * Not a friendliness stat invented for this: it is the same standing the
     * rest of the world reads, and somebody who owes you nothing and likes you
     * no better than anyone else sits at 0 and does not come.
     */
    standing: number;
    /** True when this is somebody whose job is the ground - a house's people here. */
    answersForThisGround: boolean;
}

/**
 * What a shout is worth: whether anybody comes, and what it leaves you owing.
 *
 * TWO GATES AND NEITHER IS NEW.
 *
 *   CAN THEY   the categorical gap, from `combat.ts`, read the other way round.
 *              Somebody who prices as `helpless` against the person on top of
 *              you has nothing to offer but company, and this world's whole
 *              thesis is that willingness does not close a realm.
 *   WILL THEY  `PATRON_STANDING` is the number the world already uses for "a
 *              relationship worth answering a call on", and this is the same
 *              question at the level of a person. Somebody whose job is this
 *              ground answers regardless of what they think of you, because
 *              they are not answering you.
 *
 * What it costs: the round, always, because shouting is not swinging. And an
 * obligation, when somebody actually comes - `REAL_OPTIONS` has said "seek
 * protection, and accept the debt" since before there was any way to do it.
 */
export interface WhoAnswered {
    /** Everybody who heard, with what each of them could and would do. */
    heard: Array<{
        who: CouldBeCalled;
        /** Whether they could matter against the person on top of you. */
        couldMatter: boolean;
        /** Whether they would come. */
        wouldCome: boolean;
        because: string;
    }>;
    /** The one who actually stepped in, if anybody did. */
    answered: CouldBeCalled | null;
    /**
     * Whether their arrival ends it.
     *
     * True only when the answerer prices the ATTACKER as helpless - the same
     * `assessGap` verdict, from the third party's side. Somebody who merely
     * outclasses the attacker makes it a fight the attacker may still want;
     * somebody two realms over makes it not a fight at all, and the attacker
     * leaves. Nothing else stops a fight here, because nothing else should.
     */
    endsIt: boolean;
    line: string;
}

/** Standing at which a person answers a call. See `PATRON_STANDING` in the world layer. */
export const WOULD_ANSWER_A_CALL = 0.3;

export function whoAnsweredTheShout(
    candidates: readonly CouldBeCalled[],
    attacker: CombatantPower,
    ctx: PowerContext,
    priceThem: (who: CouldBeCalled) => CombatantPower
): WhoAnswered {
    void ctx;
    const heard = candidates.map(who => {
        const theirs = priceThem(who);
        const againstTheAttacker = assessGap(theirs, attacker);
        const couldMatter = againstTheAttacker.verdict !== 'helpless';
        const wouldCome = who.answersForThisGround || who.standing >= WOULD_ANSWER_A_CALL;
        return {
            who,
            couldMatter,
            wouldCome,
            because: who.answersForThisGround
                ? `${who.name} answers for this ground, which is not the same as answering you.`
                : wouldCome
                    ? `${who.name} stands at ${who.standing.toFixed(2)} toward you.`
                    : `${who.name} stands at ${who.standing.toFixed(2)} toward you, which is `
                      + `under ${WOULD_ANSWER_A_CALL} and is nothing.`
        };
    });

    // The strongest person who both could and would. Ties broken by id so the
    // answer does not depend on the order the caller happened to build the list.
    const willing = heard
        .filter(h => h.couldMatter && h.wouldCome)
        .sort((a, b) =>
            b.who.realmOrdinal - a.who.realmOrdinal || (a.who.id < b.who.id ? -1 : 1));
    const answered = willing[0]?.who ?? null;

    const endsIt = answered !== null
        && assessGap(attacker, priceThem(answered)).verdict === 'helpless';

    return {
        heard,
        answered,
        endsIt,
        line: answered === null
            ? candidates.length === 0
                ? 'You shout and there is nobody within the sound of it. The round is gone.'
                : `You shout. ${heard.length} could hear it and not one of them is both able `
                  + 'and willing. The round is gone.'
            : endsIt
                ? `${answered.name} comes, and what they are is not something the person in `
                  + 'front of you is going to argue with. It stops here, and you are owing.'
                : `${answered.name} comes. It is still a fight and it is no longer only yours, `
                  + 'and you are owing.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// ONE TURN OF A FIGHT
// ─────────────────────────────────────────────────────────────────────────

/** What one turn of a held-open fight did. */
export interface FightTurn {
    /** The fight as it now stands. Null once it has ended. */
    fight: UnfinishedFight | null;
    /** Set once the fight is over, in the same vocabulary a one-call fight ends in. */
    finished: ConfrontationResult | null;
    /** What the player did with the round, as the engine took it. */
    playerAct: FightAnswer['kind'];
    /** What the other side did with theirs. */
    theirAct: RoundAct;
    /** The exchanges this round threw, in order. */
    exchanges: ExchangeRecord[];
    /** Set when the player tried to get away. */
    flight: FleeResult | null;
    /** Where they were making for, when they named anywhere. */
    fleeingToward: WayOut | null;
    /** Set when the player shouted. */
    shout: WhoAnswered | null;
    /** Engine-authored, factual. Phase 3 dresses it; it never invents it. */
    line: string;
}

export interface FightTurnContext {
    ambient: AmbientQi;
    turn: number;
    /**
     * Who is standing close enough to hear a shout, and how to price them.
     *
     * Absent means the caller has no world loaded, in which case shouting is
     * honestly answered with "there is nobody within the sound of it" rather
     * than with a refusal - the same treatment the crossroads gives an unnamed
     * person outside the cave.
     */
    couldBeCalled?: readonly CouldBeCalled[];
    priceThem?: (who: CouldBeCalled) => CombatantPower;
}

/**
 * Open a fight and hold it.
 *
 * Returns a finished result when the gap settles it before anything is rolled,
 * because that is not a fight and holding it open would be a lie about what the
 * engine did. Otherwise the fight is standing and the player has a turn.
 */
export function openFight(input: {
    id: string;
    seed: string;
    aggressor: FightSide;
    defender: FightSide;
    intent: ConfrontationIntent;
    playerId: string;
    ground: FightGround;
    turn: number;
    ambient: AmbientQi;
}): { fight: UnfinishedFight | null; settled: ConfrontationResult | null; gap: GapAssessment } {
    const powerCtx: PowerContext = { ambient: input.ambient };
    const aggressor = assessPower(input.aggressor.input, powerCtx);
    const defender = assessPower(input.defender.input, powerCtx);
    const gap = assessGap(aggressor, defender);

    const hp: Record<string, number> = {
        [input.aggressor.input.id]: input.aggressor.input.hp,
        [input.defender.input.id]: input.defender.input.hp
    };
    const injuries: Record<string, Injury[]> = {
        [input.aggressor.input.id]: [],
        [input.defender.input.id]: []
    };

    // The same question `resolveConfrontation` asks first, asked first here.
    // A fight nobody can have must not be held open for eight turns of the
    // player typing at it.
    const settled = theGapDecidesItAlone(
        input.aggressor.input, input.defender.input, aggressor, defender, gap,
        { rng: forStream(input.seed, 'fight', input.id, 'gap'), ambient: input.ambient,
            turn: input.turn, intent: input.intent },
        hp, injuries
    );
    if (settled) return { fight: null, settled, gap };

    return {
        fight: {
            id: input.id,
            seed: input.seed,
            roundsFought: 0,
            roundBudget: MAX_EXCHANGES,
            aggressor: input.aggressor,
            defender: input.defender,
            hp,
            injuries,
            hpAtOpening: { ...hp },
            exchanges: [],
            brokenObjects: [],
            intent: input.intent,
            playerId: input.playerId,
            ground: input.ground,
            openedOnTurn: input.turn
        },
        settled: null,
        gap
    };
}

/**
 * Take one turn of a fight that is standing.
 *
 * The player answers; the other side answers for itself; the round resolves
 * through the same function `resolveConfrontation` uses. Nothing here softens
 * anything: an answer that was a bad idea is resolved as the bad idea it was.
 */
export function takeAFightTurn(
    fight: UnfinishedFight,
    answer: FightAnswer,
    ctx: FightTurnContext
): FightTurn {
    const powerCtx: PowerContext = { ambient: ctx.ambient };
    const rng = forStream(fight.seed, 'fight', fight.id, fight.roundsFought);

    const playerIsAggressor = fight.playerId === fight.aggressor.input.id;
    const mine = playerIsAggressor ? fight.aggressor : fight.defender;
    const theirs = playerIsAggressor ? fight.defender : fight.aggressor;

    const minePower = assessPower(mine.input, powerCtx);
    const theirPower = assessPower(theirs.input, powerCtx);

    const theirAct = howTheyAreFighting(
        fight.hp[theirs.input.id], theirs.input.maxHp,
        fight.hp[mine.input.id], mine.input.maxHp
    );

    // ── BREAKING OFF ─────────────────────────────────────────────────────
    //
    // The load-bearing answer, and the one the whole ruling is about. It is
    // `attemptFlight`, which has priced this since it was written and which
    // nothing in the running game has ever called: a base chance, the realm gap
    // cutting the ONE way it ever helps the weaker party, a movement art worth
    // more than anything else you could be carrying, and a price paid whether
    // or not it works.
    if (answer.kind === 'break_off') {
        const flight = attemptFlight(minePower, theirPower, {
            rng,
            turn: ctx.turn,
            maxHp: mine.input.maxHp,
            movementTechnique: mine.movement,
            movementMastery: mine.movementMastery,
            edges: mine.edges
        });
        fight.hp[mine.input.id] = Math.max(0, fight.hp[mine.input.id] - flight.damage);
        if (flight.injury) fight.injuries[mine.input.id].push(flight.injury);

        const toward = wayOut(fight.ground, answer.toward ?? null);

        if (flight.escaped) {
            // They got out. That is a withdrawal, which is what this engine has
            // always called somebody breaking off - and the person left standing
            // holds the grudge, exactly as they would have from the one-call path.
            return {
                fight: null,
                finished: concludeFrom(fight, theirs.input.id, mine.input.id, 'withdrew', ctx),
                playerAct: 'break_off',
                theirAct,
                exchanges: [],
                flight,
                fleeingToward: toward,
                shout: null,
                line: `${flight.narrationHint}`
                    + (toward
                        ? ` The road toward ${toward.name} is the one you took; it is `
                          + `${toward.days} days.`
                        : ' Away from them, which is as much as you know about where you are going.')
            };
        }

        // They did not get clear, and turning your back cost them the round. The
        // other side gets its blow with nothing in the way of it.
        const caught = resolveConfrontationRound(
            asRound(playerIsAggressor ? fight.aggressor : fight.defender, minePower, 'guard'),
            asRound(playerIsAggressor ? fight.defender : fight.aggressor, theirPower, theirAct),
            fight.hp, fight.injuries,
            roundCtx(fight, ctx, rng)
        );
        return afterRound(fight, caught, 'break_off', theirAct, ctx, {
            flight,
            fleeingToward: toward,
            preamble: flight.narrationHint
        });
    }

    // ── SHOUTING ─────────────────────────────────────────────────────────
    //
    // Costs the round whatever happens, which is the whole of what makes it a
    // decision rather than a free extra. Whether anybody comes is read off the
    // world the caller handed in.
    if (answer.kind === 'call_for_help') {
        const shout = ctx.couldBeCalled && ctx.priceThem
            ? whoAnsweredTheShout(ctx.couldBeCalled, theirPower, powerCtx, ctx.priceThem)
            : whoAnsweredTheShout([], theirPower, powerCtx, () => theirPower);

        if (shout.endsIt) {
            // The person on top of you priced the arrival as somebody they
            // cannot fight, which is `assessGap`'s own verdict and not a mercy.
            // They break off; the fight is over and you were not the one who
            // ended it.
            return {
                fight: null,
                finished: concludeFrom(fight, mine.input.id, theirs.input.id, 'withdrew', ctx),
                playerAct: 'call_for_help',
                theirAct,
                exchanges: [],
                flight: null,
                fleeingToward: null,
                shout,
                line: shout.line
            };
        }

        // Nobody who ends it. The round was still spent on a shout, so the
        // other side swings into somebody who is not swinging back.
        const shouted = resolveConfrontationRound(
            asRound(playerIsAggressor ? fight.aggressor : fight.defender, minePower, 'guard'),
            asRound(playerIsAggressor ? fight.defender : fight.aggressor, theirPower, theirAct),
            fight.hp, fight.injuries,
            roundCtx(fight, ctx, rng)
        );
        return afterRound(fight, shouted, 'call_for_help', theirAct, ctx, {
            shout,
            preamble: shout.line
        });
    }

    // ── THE THREE POSTURES ───────────────────────────────────────────────
    const act = POSTURE_OF[answer.kind];
    const vector = answer.kind === 'strike' || answer.kind === 'press'
        ? answer.vector ?? mine.vector
        : mine.vector;

    const round = resolveConfrontationRound(
        asRound(fight.aggressor, playerIsAggressor ? minePower : theirPower,
            playerIsAggressor ? act : theirAct,
            playerIsAggressor ? vector : fight.aggressor.vector),
        asRound(fight.defender, playerIsAggressor ? theirPower : minePower,
            playerIsAggressor ? theirAct : act,
            playerIsAggressor ? fight.defender.vector : vector),
        fight.hp, fight.injuries,
        roundCtx(fight, ctx, rng)
    );

    return afterRound(fight, round, answer.kind, theirAct, ctx, {});
}

// ─────────────────────────────────────────────────────────────────────────
// PLUMBING
// ─────────────────────────────────────────────────────────────────────────

function asRound(
    side: FightSide,
    power: CombatantPower,
    act: RoundAct,
    vector?: AttackVector
): Parameters<typeof resolveConfrontationRound>[0] {
    return { input: side.input, power, act, edges: side.edges, vector: vector ?? side.vector };
}

function roundCtx(
    fight: UnfinishedFight,
    ctx: FightTurnContext,
    rng: CultivationRNG
): Parameters<typeof resolveConfrontationRound>[4] {
    return {
        rng,
        ambient: ctx.ambient,
        turn: ctx.turn,
        opening: fight.roundsFought === 0,
        fromConcealment: fight.intent.opening === 'from_concealment',
        willWithdraw: fight.intent.willWithdraw ?? true
    };
}

/**
 * Fold a resolved round back into the fight and say what it left.
 *
 * The budget is checked LAST, so a round that finished somebody still finishes
 * them on the final one. A fight that runs out is a stalemate in exactly the
 * sense `resolveConfrontation` means it - neither could finish it - which is
 * why it goes through the same function rather than a second ending.
 */
function afterRound(
    fight: UnfinishedFight,
    round: ReturnType<typeof resolveConfrontationRound>,
    playerAct: FightAnswer['kind'],
    theirAct: RoundAct,
    ctx: FightTurnContext,
    extra: { flight?: FleeResult; fleeingToward?: WayOut | null; shout?: WhoAnswered; preamble?: string }
): FightTurn {
    const stamped: ExchangeRecord[] = round.exchanges.map((e, i) => ({
        ...e, index: fight.exchanges.length + i
    }));
    fight.exchanges.push(...stamped);
    fight.brokenObjects.push(...round.brokenObjects);
    fight.aggressor = { ...fight.aggressor, input: round.aggressor.input };
    fight.defender = { ...fight.defender, input: round.defender.input };
    fight.roundsFought += 1;

    const base = {
        playerAct,
        theirAct,
        exchanges: stamped,
        flight: extra.flight ?? null,
        fleeingToward: extra.fleeingToward ?? null,
        shout: extra.shout ?? null
    };
    const preamble = extra.preamble ? `${extra.preamble} ` : '';

    if (round.winnerId !== null) {
        return {
            ...base,
            fight: null,
            finished: concludeFrom(fight, round.winnerId, round.loserId!, round.ending!, ctx),
            line: preamble + stamped.map(e => e.result.narrationHint).join(' ')
        };
    }

    if (fight.roundsFought >= fight.roundBudget) {
        return {
            ...base,
            fight: null,
            finished: stalemate(
                assessPower(fight.aggressor.input, { ambient: ctx.ambient }),
                assessPower(fight.defender.input, { ambient: ctx.ambient }),
                assessGap(
                    assessPower(fight.aggressor.input, { ambient: ctx.ambient }),
                    assessPower(fight.defender.input, { ambient: ctx.ambient })
                ),
                fight.exchanges, fight.hp, fight.injuries,
                fight.aggressor.input, fight.defender.input, fight.brokenObjects
            ),
            line: preamble + 'Neither of you could finish it inside what either of you had left.'
        };
    }

    return {
        ...base,
        fight,
        finished: null,
        line: preamble + stamped.map(e => e.result.narrationHint).join(' ')
    };
}

/** End the fight the way a one-call fight ends. There is one endgame. */
function concludeFrom(
    fight: UnfinishedFight,
    winnerId: string,
    loserId: string,
    endedBy: 'down' | 'withdrew',
    ctx: FightTurnContext
): ConfrontationResult {
    const powerCtx: PowerContext = { ambient: ctx.ambient };
    const aggressor = assessPower(fight.aggressor.input, powerCtx);
    const defender = assessPower(fight.defender.input, powerCtx);
    return concludeConfrontation({
        aggressorInput: fight.aggressor.input,
        defenderInput: fight.defender.input,
        aggressor,
        defender,
        gap: assessGap(aggressor, defender),
        ctx: {
            rng: forStream(fight.seed, 'fight', fight.id, 'conclude'),
            ambient: ctx.ambient,
            turn: ctx.turn,
            intent: fight.intent,
            vector: fight.aggressor.vector
        },
        exchanges: fight.exchanges,
        hp: fight.hp,
        injuries: fight.injuries,
        brokenObjects: fight.brokenObjects,
        winnerId,
        loserId,
        endedBy,
        // The fight may have opened on a body that was already hurt. Reading the
        // input rows here would say the winner was untouched because they came in
        // wounded, which is the exact defect the winner-was-hurt line exists for.
        hpAtOpening: fight.hpAtOpening
    });
}

/**
 * Which way out the player meant.
 *
 * A description, never an id, because that is the rule for every other target
 * in this game. An unrecognised name is not a refusal: they are running, and
 * running toward somewhere they cannot name is still running.
 */
export function wayOut(ground: FightGround, named: string | null): WayOut | null {
    if (ground.waysOut.length === 0) return null;
    if (!named) {
        // Nowhere named. The nearest is where somebody actually running goes.
        return [...ground.waysOut].sort((a, b) => a.days - b.days || (a.id < b.id ? -1 : 1))[0];
    }
    const wanted = named.trim().toLowerCase();
    return ground.waysOut.find(w =>
        w.name.toLowerCase() === wanted
        || w.id.toLowerCase() === wanted
        || w.name.toLowerCase().includes(wanted)
        || wanted.includes(w.name.toLowerCase())) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PLAYER IS OWED BEFORE THEY ANSWER
// ─────────────────────────────────────────────────────────────────────────

/**
 * The state a player needs to know they are losing before they have lost.
 *
 * This is the other half of the ruling and it is not decoration. "If you fought
 * and it resolves in one turn and you died it would be unsatisfying cuz there's
 * nothing you can do about it" is a complaint about INFORMATION as much as
 * about turns: a turn you cannot see is worth no more than no turn at all.
 *
 * Every figure here is one the engine already computed. Nothing is rounded into
 * a mood word, and the flight chance is stated as the number rather than as
 * "you could probably get away", because the whole claim of this game is that
 * the numbers are the honest part.
 */
export function whereThisFightStands(
    fight: UnfinishedFight,
    ambient: AmbientQi,
    seed = fight.seed
): {
    yourHp: number; yourMaxHp: number;
    theirHp: number; theirMaxHp: number;
    roundsLeft: number;
    /** What getting out would cost and how likely it is, before choosing it. */
    flight: FleeResult;
    line: string;
} {
    const powerCtx: PowerContext = { ambient };
    const playerIsAggressor = fight.playerId === fight.aggressor.input.id;
    const mine = playerIsAggressor ? fight.aggressor : fight.defender;
    const theirs = playerIsAggressor ? fight.defender : fight.aggressor;

    // Rolled on a stream nobody fights from, so LOOKING at the odds cannot move
    // the fight. The chance and the itemised modifiers are the answer; the roll
    // in it is discarded by the caller and is not the one a real flight uses.
    const preview = attemptFlight(
        assessPower(mine.input, powerCtx),
        assessPower(theirs.input, powerCtx),
        {
            rng: forStream(seed, 'fight-preview', fight.id, fight.roundsFought),
            turn: fight.openedOnTurn,
            maxHp: mine.input.maxHp,
            movementTechnique: mine.movement,
            movementMastery: mine.movementMastery,
            edges: mine.edges
        }
    );

    const yourHp = fight.hp[mine.input.id];
    const theirHp = fight.hp[theirs.input.id];
    const roundsLeft = Math.max(0, fight.roundBudget - fight.roundsFought);

    return {
        yourHp,
        yourMaxHp: mine.input.maxHp,
        theirHp,
        theirMaxHp: theirs.input.maxHp,
        roundsLeft,
        flight: preview,
        line:
            `You are on ${yourHp} of ${mine.input.maxHp}; ${theirs.input.name} is on ${theirHp} `
            + `of ${theirs.input.maxHp}. ${roundsLeft} round${roundsLeft === 1 ? '' : 's'} before `
            + `neither of you can finish it. Breaking off would come off at `
            + `${(preview.chance * 100).toFixed(0)}%, and turning your back costs something `
            + 'either way.'
    };
}
