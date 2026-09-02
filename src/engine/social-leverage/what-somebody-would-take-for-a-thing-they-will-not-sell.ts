/**
 * WHAT SOMEBODY WOULD TAKE FOR A THING THEY WILL NOT SELL.
 *
 * The verb the design owner asked for, in their own words:
 *
 *   *"just be like: I need xyz, what's your price?"*
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────
 *
 * Found by playing, at a crippling meridian tear. `see a physician` answered
 * correctly and completely:
 *
 *   What closes a crippling tear is a Meridian Rebirth Pill, heaven grade.
 *   Nobody sells one of these for stones. Not at a high price, not at an
 *   absurd one: anybody holding one is already past caring what a purse is
 *   worth, and what they will listen to is a favour owed, something out of a
 *   hole nobody else has been down, or an art.
 *
 * That refusal is right, and `asking.md` names the standard it meets - *"a
 * refusal may only name a door that exists"* - and then the game had no door.
 * **Nothing in it accepted that sentence.** There was no way to state a need
 * and ask what it would take, and no way to put down something that was not
 * money. So every heaven-grade and above cure in the catalog was unobtainable
 * in play, and the refusal that said so was the closest the game came to
 * admitting it.
 *
 * ── WHY THERE IS NO LIST OF CURRENCIES IN HERE ───────────────────────────
 *
 * `AGENTS.md`: *"model what somebody wants and let the behaviour fall out. If a
 * new case requires a new branch, the shape is wrong."* The tempting design is
 * a table of media - a favour, an artifact, an oath, a service, a name,
 * information, a placement for a child - each with a rule for how much it is
 * worth. That table is wrong twice: it is always smaller than the world, and a
 * tenth medium means editing it.
 *
 * **So nothing here knows what is on the table.** {@link OnTheTable} carries a
 * string nothing branches on and one number, and that number is the only
 * question this module ever asks about anything:
 *
 *     HOW HIGH DOES IT CARRY THE PERSON RECEIVING IT?
 *
 * An art carries somebody to the rung it tops out at. A pill carries them to
 * its band. A favour owed by a Nascent Soul cultivator carries them to Nascent
 * Soul, because that is the height of what can be asked for with it. A place
 * for their child in a house is worth the house's reach. Information is worth
 * the height of what it opens. Every one of those is the same field, and the
 * tenth medium needs no code at all - only somebody who can say how high it
 * carries.
 *
 * ── AND THE TEST FOR WHETHER AN OFFER WORKS IS ONE SENTENCE ──────────────
 *
 * The design owner's, and it is the whole resolver:
 *
 *   > **Does it serve their need better than the thing does?**
 *
 * Which is answerable because both sides are on the one scale above. What the
 * thing does for its holder is carry somebody to its own band. What is put down
 * does for them whatever it carries them to. So an offer moves the thing when
 * it reaches at least as high as the thing reaches, and the bar is not a price
 * anybody chose - it is the object's own rung, read off the same field the
 * resolver, the seeder and the register all read.
 *
 * `items.md` is where that arithmetic comes from rather than from tuning:
 * *"An obligation from somebody at a height your house cannot reach is worth
 * more than any price, and it is worth it exactly once."* A house holding
 * something pitched above its own head is holding it precisely for that trade,
 * so the height of the thing IS the asking price, stated in the only unit this
 * world has for it.
 *
 * ── A PRESENT NEED IS A REFUSAL. A RESERVED ONE IS A PRICE ───────────────
 *
 * `AGENTS.md`, from the owner: *"Somebody whose son is dying tonight is not a
 * seller at any figure. Somebody holding medicine against a disciple they may
 * one day take is holding an asset."* That distinction arrives here as one
 * boolean - {@link HowTheyAreHoldingIt.theirClaimCanWait} - and deliberately
 * not as a reason, because the reason is somebody else's subject and there are
 * two live models of it already:
 *
 *   `whyNotSold` in `world/single-use-dao-comprehension-materials.ts` answers
 *   it for a HOUSE sitting on something beyond its own reach, and is written
 *   onto every barter pill row in every seeded world.
 *
 *   `what-an-open-need-does-to-an-ask-and-to-a-price.ts` answers it for a
 *   PERSON holding what they intend to use, off their open goal rows and the
 *   clocks they are under.
 *
 * Both collapse onto the four facts in {@link HowTheyAreHoldingIt}, which is
 * why this module takes those and not a reason. A third model of why somebody
 * holds a thing would be a third source of truth; a third mapping onto four
 * booleans is not a model at all.
 *
 * ── WHAT THIS MODULE DOES NOT DECIDE ─────────────────────────────────────
 *
 * **It never says no.** It says what the price is and whether what is on the
 * table meets it. Whether they actually agree is `resolveAttempt`'s, with its
 * floor and its ceiling and its reading of who these two people are - because
 * `AGENTS.md` is explicit that nothing in this world is a wall and that
 * *"typically does not"* is not *"never"*. A holder with a dying son is priced
 * here as somebody nothing reaches, and the resolver still leaves the door open
 * at two percent, which is the correct shape for both rules at once.
 *
 * Pure. Rows in, an answer out. No catalog, no repository, no I/O, no RNG.
 */

import type { WhatANeedDoesToAPrice } from '../world/what-an-open-need-does-to-an-ask-and-to-a-price.js';

// ─────────────────────────────────────────────────────────────────────────
// THE ONE SCALE
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing put down, priced by the only question this module asks.
 *
 * THE MEDIUM IS NOT A FIELD HERE AND MUST NEVER BECOME ONE. `what` is a label
 * for the sentence to say out loud and no conditional anywhere reads it. What
 * decides everything is {@link carriesThemTo}, which any medium can answer -
 * and a medium that cannot answer it is not something anybody would trade a
 * singular object for.
 */
export interface OnTheTable {
    /**
     * What it is, in whatever words the caller has for it.
     *
     * Echoed into the line so a player can see what the engine weighed. Read by
     * no conditional in this file or anywhere downstream.
     */
    what: string;
    /**
     * How high it carries the person receiving it, as a rung on the ladder.
     *
     * The whole of the pricing. An art's ceiling, a pill's band, the rung of
     * whoever would owe the favour, the reach of the house that would take
     * their child. Below zero is treated as zero rather than rejected: a thing
     * that carries nobody anywhere is on the table and is worth nothing, which
     * is a truthful answer and not an error.
     */
    carriesThemTo: number;
    /**
     * Whether it is theirs afterwards, and theirs alone.
     *
     * `items.md`'s counted/tracked line, arriving on the offer side: *"a thing
     * is cash-priced exactly where it is fungible and barter-only exactly where
     * it is singular."* Above the cash line the whole reason money fails is
     * that anybody can have more of it, so a fungible offer is priced at
     * nothing here however large it is - which is the same statement
     * `PURSE_REACH` makes in the resolver, and the two must not disagree.
     *
     * That is not a ban on offering money. It is money being worth what it is
     * worth, which above this line is nothing, and the resolver still prices a
     * purse separately and still leaves the door open.
     */
    singular: boolean;
}

/**
 * How the holder is holding it, as the four facts that decide the answer.
 *
 * Deliberately not a reason. See the banner: two live models already answer
 * WHY, they answer it about different kinds of holder, and both collapse onto
 * these four. A tenth reason to hold something needs no line here.
 */
export interface HowTheyAreHoldingIt {
    /**
     * Whether their own claim on it can wait.
     *
     * False is a present need - the son dying tonight, the wound blocking their
     * own path, the crossing they are about to attempt - and a present need is
     * a refusal at any figure. True is a store put by against something that
     * has not come, which is an asset, and an asset has a price.
     */
    theirClaimCanWait: boolean;
    /**
     * Whether saying yes was ever theirs to say.
     *
     * `immortal-items.ts` describes the case and calls it *"arithmetic rather
     * than a lever"*: a body that counts an unreplenishable stock to the unit
     * and needs a quorum to touch it has not refused anybody, and *"there is no
     * version of the problem where the player finds the right person and
     * applies enough pressure."* A player has to be able to tell that apart
     * from a price they have not met, or they spend a run looking for a lever
     * that does not exist.
     */
    theirsToGive: boolean;
    /**
     * How high the thing itself carries whoever ends up with it.
     *
     * The asking price, in the only unit that works. `power` on an object row,
     * `forOrdinal` on a seeded pill, the band on a catalog row - one field, read
     * everywhere else in the engine for the same purpose.
     */
    itCarriesTo: number;
    /**
     * How high its holder can actually reach.
     *
     * Read only to say whether the thing is above their own head, which is what
     * makes a trade thinkable at all: a holder who can use the thing wants the
     * thing. It does not move the price - the price is the object's rung
     * whoever is holding it, because that is what anybody else would give for
     * it.
     */
    theyReachTo: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ANSWER
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why what is on the table does not move it.
 *
 * Four, and every one of them names something the player can do differently
 * except the two that name something they cannot - which is the point of
 * separating them. `asking.md`: a refusal that names a door nobody built is
 * worse than a refusal that says something narrower and true.
 */
export type WhyItDoesNotMove =
    /** A present need. No figure reaches it, and none should. */
    | 'they_need_it_themselves'
    /** Arithmetic rather than a lever. Nobody is being refused. */
    | 'the_answer_is_not_theirs_to_give'
    /** Nothing singular was put down. Money is not the medium up here. */
    | 'nothing_was_put_down'
    /** Something was, and it does not reach as high as the thing does. */
    | 'what_was_put_down_does_not_reach';

export interface WhatItWouldTake {
    /** Whether the trade is one they would entertain. Never whether they agree. */
    itIsATrade: boolean;
    /**
     * The height an offer has to reach, which is the thing's own rung.
     *
     * Stated even where nothing would move it, because a player told the price
     * of something they cannot have is better served than one told only no -
     * and because on a present need the price is real and the timing is not.
     */
    theHeightToReach: number;
    /** The best thing on the table, at what it carries them to. Zero for nothing. */
    theBestOnTheTable: number;
    /** The label of whatever that was, for the sentence. Null when nothing was. */
    theBestPutDown: string | null;
    /** Null exactly when {@link itIsATrade} is true. */
    why: WhyItDoesNotMove | null;
    /**
     * Engine-authored and factual. Never narration.
     *
     * Every branch of it names what would work, which is the standard
     * `items.md` sets for a refusal about medicine and `asking.md` sets for a
     * refusal about a person.
     */
    line: string;
}

/**
 * What the holder would take, and whether this is it.
 *
 * The order of the tests is the order of how little the player can do about the
 * answer, hardest first, so the sentence a player gets is the truest one
 * available rather than the first one that happens to fire. Somebody whose own
 * need is present is not told they were short.
 */
export function whatItWouldTake(
    holding: HowTheyAreHoldingIt,
    table: readonly OnTheTable[]
): WhatItWouldTake {
    const bar = Math.max(0, holding.itCarriesTo);

    // Priced before anything is refused, because the price is a fact about the
    // object and stays true when the timing does not.
    let best: OnTheTable | null = null;
    for (const item of table) {
        if (!item.singular) continue;
        const carries = Math.max(0, item.carriesThemTo);
        if (best === null || carries > Math.max(0, best.carriesThemTo)) best = item;
    }
    const offered = best === null ? 0 : Math.max(0, best.carriesThemTo);
    const put = best?.what ?? null;

    const shape = {
        theHeightToReach: bar,
        theBestOnTheTable: offered,
        theBestPutDown: put
    };

    // Nobody is refusing. There is nothing here to reach.
    if (!holding.theirsToGive) {
        return {
            ...shape,
            itIsATrade: false,
            why: 'the_answer_is_not_theirs_to_give',
            line: 'Whoever is holding this does not decide where it goes. It is counted, it is '
                + 'owed somewhere, and releasing one is a decision somebody else takes - so there '
                + 'is no price here and no person to put one to. What would work is finding one '
                + 'held by somebody who can simply say yes.'
        };
    }

    // A present need, and it is not a bargaining position. `AGENTS.md`: not a
    // seller at any figure.
    if (!holding.theirClaimCanWait) {
        return {
            ...shape,
            itIsATrade: false,
            why: 'they_need_it_themselves',
            line: 'They are not holding this against a day that may come. They need it, and they '
                + `need it now, so there is no figure and no trade - what it would take is for `
                + 'that to stop being true, or for the thing to be found somewhere else.'
        };
    }

    // From here the answer is a price, and the only question is whether it has
    // been met.
    if (best === null) {
        return {
            ...shape,
            itIsATrade: false,
            why: 'nothing_was_put_down',
            line: `They would part with it, and not for money. What it would take is something `
                + `singular that carries somebody to ${rung(bar)} or better - an art nobody else `
                + 'teaches, a thing out of a hole nobody else has been down, a debt from '
                + 'somebody standing that high, or a service only you could do. Name what you '
                + 'have, not what you can pay.'
        };
    }

    if (offered < bar) {
        return {
            ...shape,
            itIsATrade: false,
            why: 'what_was_put_down_does_not_reach',
            line: `${best.what} carries somebody to ${rung(offered)}, and what they are holding `
                + `carries somebody to ${rung(bar)}. They can do that arithmetic while you are `
                + 'still talking. What would work is something that reaches at least as high as '
                + 'the thing you are asking for.'
        };
    }

    return {
        ...shape,
        itIsATrade: true,
        why: null,
        line: `${best.what} carries somebody to ${rung(offered)} and what they are holding `
            + `carries somebody to ${rung(bar)}, so what you have put down serves them at least `
            + 'as well as keeping it does. That is a trade they would entertain, which is not the '
            + 'same as one they have agreed to.'
    };
}

/**
 * A rung said as a number, and nothing else.
 *
 * Deliberately not a realm name. `AGENTS.md` is explicit that ladder bounds
 * live in `realms.ts` and that restating them is how they go stale, and a
 * caller that wants the realm's name has `realms.ts` and this module's number.
 */
function rung(ordinal: number): string {
    return `rung ${Math.max(0, Math.round(ordinal))}`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE ATTEMPT IS THEN MADE OF
// ─────────────────────────────────────────────────────────────────────────

/**
 * How heavy an ask this is, once the price is known.
 *
 * Returned as the two the caller needs and not as an `AskWeight` string, so
 * that this module never imports the resolver's vocabulary and the resolver
 * never imports this one's. The caller joins them, which is where the joining
 * belongs.
 *
 * The mapping is the design in one line. **A trade whose price has been met is
 * an ordinary favour**; they end up no worse off and they can see it. **A trade
 * whose price has not been met is against their interest**, because agreeing
 * would mean handing over something worth more than what came back - and the
 * resolver's own definition of that weight is *"they end up worse off, and they
 * can see that while agreeing"*, which is exactly the position somebody is
 * being put in.
 *
 * Nothing is ever refused outright here. `AGENTS.md` forbids the removed verb
 * and requires the priced one: a player may put down a pebble for the best
 * thing in the province, and the answer is a very bad number rather than a
 * closed door.
 */
export interface HowHeavyThisAskIs {
    /** True where the price was met. The caller maps this to its ask weight. */
    thePriceWasMet: boolean;
    /**
     * Whether the holder has something in front of them that they want.
     *
     * The resolver's `theyWantSomethingFromYou` term, which had no caller at
     * all when this was written. It is true exactly when something singular was
     * put down that reaches them - not when the player merely turned up, and
     * not when they put money on a table money does not reach.
     */
    theyWantWhatIsInFrontOfThem: boolean;
}

/**
 * The two facts the resolver needs, off one answer.
 *
 * Kept beside {@link whatItWouldTake} rather than in the caller because the
 * mapping is a design statement and not plumbing, and a second caller deriving
 * it its own way is how two callers come to disagree about what a met price is.
 */
export function howHeavyThisAskIs(answer: WhatItWouldTake): HowHeavyThisAskIs {
    return {
        thePriceWasMet: answer.itIsATrade,
        // Somebody holding a thing they cannot use, looking at something that
        // reaches as high as it does, wants what is in front of them. Somebody
        // whose own need is present does not - they want the thing they have.
        theyWantWhatIsInFrontOfThem: answer.itIsATrade
    };
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHERE THE TWO FACTS ABOUT THE HOLDER COME FROM
//
// ── THIS MODULE CANNOT ANSWER "WHAT DO THEY NEED", BY CONSTRUCTION ───────
//
// There is exactly one model of what somebody needs in this engine and it is
// not here. `what-an-open-need-does-to-an-ask-and-to-a-price.ts` reads open
// goal rows, derives a date for each want off the settling clock, the lifespan
// clock and the clocks of whoever the want points at, and answers what that
// need does to a price. It is the authority and it is the whole of the
// authority.
//
// Two modules that each decide whether a need is pressing would drift, and the
// drift would be invisible, because both would look right read on their own.
// So {@link howTheyAreHoldingIt} is the ONLY way to build the input to
// {@link whatItWouldTake} from a real holder, and its argument is the other
// module's own return type. There is no second reading of a goal row here, no
// deadline arithmetic, and nothing that could produce an answer that module
// would disagree with - because there is nothing here that produces an answer
// about a need at all.
//
// The split, stated once so the next person does not have to derive it:
//
//   THEIRS   what this person needs, how urgently, and therefore whether they
//            would part with the thing.
//   THIS     what it would take, whether what is on the table meets it, and
//            what a refusal should say - which is a proposal rather than a yes
//            or a no, and is the outcome the resolver did not have.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The holder's side, built from the one model that decides it.
 *
 * `need` is `whatTheirNeedDoesToThePriceOf`'s answer for this holder and this
 * object, and `null` is its ordinary answer - most people want things no object
 * in front of them touches, and somebody with no need bound up in a thing is
 * holding an ordinary asset that an ordinary trade moves.
 *
 * `pays_above_the_going_rate` cannot reach here in practice, because it is the
 * answer for somebody who does NOT hold the thing, and this whole file is about
 * somebody who does. It is mapped rather than thrown on, as the case where the
 * caller has asked about the wrong side of a transaction: they are not holding
 * it, so nothing of theirs is stopping the trade.
 */
export function howTheyAreHoldingIt(
    need: { effect: WhatANeedDoesToAPrice } | null,
    itCarriesTo: number,
    theyReachTo: number
): HowTheyAreHoldingIt {
    return {
        theirClaimCanWait: need?.effect !== 'will_not_part_with_it_at_any_price',
        theirsToGive: need?.effect !== 'the_answer_is_not_theirs_to_give',
        itCarriesTo,
        theyReachTo
    };
}

/** Exported so a probe and a test can pin the shape without resolving one. */
export const WHAT_IT_WOULD_TAKE_CONSTANTS = Object.freeze({
    /**
     * There is no threshold in this module and that is the point.
     *
     * The bar is the object's own rung, read off the world. Anything that
     * appeared here would be a price somebody chose, which is the thing
     * `items.md` says scarcity must never be.
     */
    theBarIsTheObjectsOwnRung: true
});
