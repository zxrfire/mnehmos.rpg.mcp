/**
 * What the cultivator standing next to you would part with, and why.
 *
 * The design owner's shape for a market: not a shopkeeper class and not a
 * stall inventory, but *random cultivators selling stuff they found or do not
 * need any more*. A market is what happens when several of those people are in
 * one place.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE WORLD ACTUALLY CONTAINS, WHICH IS WHY THIS READS PEOPLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Measured across five seeded worlds: 1370 objects, **every one of them on a
 * faction and none on a person**, 0 of 2135 NPCs holding anything - and after
 * two hundred years of ordinary simulation on one of them, 1107 people, 426
 * objects, still none on a person. Every object in this world belongs to an
 * institution.
 *
 * What people DO hold is on the roster: `spiritStones`, and
 * `cultivation.techniqueIds`. Of 1281 people over three worlds, 1249 hold a
 * book, 63 hold one they have climbed past, and 132 hold a working manual
 * belonging to a house that is not theirs. That last figure is the grey market
 * `manuals.md` describes, and nothing had ever asked for it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE REASONS ARE READINGS OF COLUMNS, NOT AN ENUM OF MERCHANT TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `AGENTS.md`: what NPCs do is emergent, and if a new case requires a new
 * branch the shape is wrong. Nobody is tagged a seller. Four different columns
 * are read, each answering a different question about the same act, which is
 * why they produce four different sentences and four different prices:
 *
 *   NOT THEIRS TO BE SEEN WITH   the thing is somebody's and the holder is not
 *                                that somebody. `items.md` - holding is a
 *                                signature - and the holder knows it.
 *   THEY NEED STONES             their purse against `earningsPerYear` at
 *                                their own rung.
 *   IT IS BEYOND THEM            it is pitched above where they stand. They
 *                                cannot use it and are in no hurry.
 *   THEY HAVE OUTGROWN IT        they have climbed past where it is any use.
 *
 * A tenth reason needs no code here. It needs a person with a different want.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTHING IN THIS FILE KNOWS WHAT KIND OF THING IT IS PRICING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * {@link AThingInSomebodysHands} is five columns and a name. A manual is one
 * caller; a beast core off a hunt is the next, and it needs no change here -
 * `usableFrom` is the rung it can be worked at, `usefulUntil` the rung past
 * which it does nothing for its holder, and {@link AThingInSomebodysHands.awkwardToHold}
 * carries the difference between a core off an animal and a core off something
 * that could speak the same way it carries the difference between a common
 * primer and a house's inner manual.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT KEEPS THIS FROM STOCKING WHAT THE WORLD HAS NOT GOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * {@link AThingInSomebodysHands.awkwardToHold}, which for a manual is
 * `betrayalOfSelling`'s existing four-rung scale:
 *
 *   0  nobody's property. Selling copies is how a poor cultivator eats.
 *   1  somebody's, and the holder is not one of theirs. Awkward, not fatal,
 *      and *"somebody will want to know where you got it"*.
 *   2  their OWN house's. The betrayal proper.
 *   3  the top of a shelf, or a thing nobody alive can reproduce.
 *
 * **Rungs 2 and 3 do not move, at any price, from anybody.** That single line
 * keeps the deep half of the world's shelf off the market, because the people
 * holding those books are overwhelmingly of the houses that own them. It is
 * the same function `game.ts` prices a player's own leak with, so the rule
 * binds the player too.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A PRESENT NEED IS STILL A REFUSAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `items.md`: a present need is a refusal; a reserved future need is a price
 * you have not met. {@link itIsTheThingTheyAreStillUsing} is the universal case
 * and is applied whether or not a caller passes anything. Anything further -
 * an open want with a date on it - comes off
 * `what-an-open-need-does-to-an-ask-and-to-a-price.ts`, which is the one model
 * of whose clock is running.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THERE IS NO PRICE TABLE HERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two numbers exist already and both are reused:
 *
 *   WHAT IT IS WORTH        the caller's, off the thing's own catalog. For a
 *                           manual, the copyist's months from
 *                           `what-a-copy-of-a-manual-costs-at-a-stall.ts`.
 *   WHAT A COUNTER GIVES    `quoteSale` in `engine/cultivation/market.ts`,
 *                           which already prices a person of a given rung
 *                           putting a thing of a given rung on a counter -
 *                           including the case that matters most here, where
 *                           somebody visibly unable to hold what they are
 *                           selling gets a fifth of list.
 *
 * A private ask sits between those two. Where in that band is the one number
 * this file decides; see {@link HOW_BADLY_THEY_WANT_IT_GONE}.
 */

import { quoteSale } from '../cultivation/market.js';
import { earningsPerYear } from '../cultivation/origin.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS BEING READ
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing in somebody's hands, as the columns that decide whether it moves.
 *
 * No catalog row is taken. This module is pure and holds no catalog; the web
 * layer resolves the thing and hands over the columns, the same way
 * `what-a-holder-would-take-for-it.ts` does for the barter tier.
 */
export interface AThingInSomebodysHands {
    id: string;
    name: string;
    /**
     * The rung from which this is any use to a holder at all.
     *
     * A manual's `requiredOrdinal`; a beast core's working grade. Below it the
     * holder cannot use the thing however much they want to, which is one of
     * the four reasons a sale happens.
     */
    usableFrom: number;
    /**
     * The rung past which it does nothing further for its holder.
     *
     * A manual's `cap` - where the crossing it teaches leaves a reader. Once
     * the holder stands at or beyond this, the thing is surplus.
     */
    usefulUntil: number;
    /**
     * What one of these is worth in spirit stones, before anybody's situation
     * is read into it. The caller's number, off the thing's own catalog.
     */
    listStones: number;
    /**
     * How uncomfortable this is to be seen holding. 0..3.
     *
     * `betrayalOfSelling`'s scale for a manual, and the same scale answers the
     * same question for anything else that carries a signature. Passed in
     * rather than computed: the answer depends on a shelf this module cannot
     * see, and the caller has already had to resolve the owner to ask it.
     */
    awkwardToHold: 0 | 1 | 2 | 3;
    /** Who would want a word about it, when anybody would. A faction id. */
    whoWouldWantAWord: string | null;
    /**
     * Whether the holder can make another and keep this one.
     *
     * The difference between an object and a book, and it changes which rules
     * apply. `manuals.md`: common books are copyable by anybody holding one,
     * which is what makes them plentiful, and *"selling copies is an ordinary
     * living for a cultivator who needs stones and has nothing else to trade"*.
     *
     * Two consequences, both of them the reason this column exists rather than
     * being folded into the awkwardness rung:
     *
     *   THE PRESENT-NEED RULE DOES NOT BIND IT. Somebody mid-book keeps the
     *   book. Nothing leaves their hands and their road is untouched, so the
     *   refusal that protects the road has nothing to protect.
     *   IT TAKES A REASON TO SIT DOWN AND WRITE ONE. Copying is months of
     *   somebody's life. A comfortable person does not spend them, which is
     *   why a copy is offered only by somebody whose purse is thin - which is
     *   `manuals.md`'s own sentence rather than a gate invented here.
     *
     * Measured, and it is why this exists: a settlement holds 430 people over
     * three seeded worlds and produced ZERO offers without it, because everyone
     * there is mid-primer or holds only a fighting art. The whole population
     * the owner asked for - random cultivators in a market town - was invisible.
     */
    copyable: boolean;
    /**
     * A need this thing answers that the caller knows about and this module
     * cannot see. A refusal at any figure.
     *
     * {@link itIsTheThingTheyAreStillUsing} is applied on top of whatever is
     * passed here, so a caller cannot forget the universal case.
     */
    theyStillNeedIt?: boolean;
}

/** The person holding it, as the three columns that decide their posture. */
export interface SomebodyStandingHere {
    id: string;
    name: string;
    ordinal: number;
    /** What is in their purse. On the roster for every person in the world. */
    spiritStones: number;
    /** Their house, or null. Decides whose signature is theirs to wear. */
    factionId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHY IT MOVES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why this particular person would let this particular thing go.
 *
 * Four readings of four different columns. The order they are tested in is the
 * order of how much each explains: somebody who should not be seen with a
 * thing is selling it for that reason whatever else is true of them, and a
 * thin purse explains a sale that the rung alone would not.
 */
export type WhyTheyWouldPartWithIt =
    | 'not_theirs_to_be_seen_with'
    | 'they_need_stones'
    | 'it_is_beyond_them'
    | 'they_have_outgrown_it';

/**
 * Why nobody is going to be selling you this one.
 *
 * A refusal that names a way out, which is this repo's pattern. All three have
 * one, and none of them is money.
 */
export type WhyItDoesNotMove =
    | 'it_is_their_own_house_s'
    | 'nobody_alive_could_replace_it'
    | 'they_are_going_to_need_it';

/**
 * How badly somebody wants a thing gone, as where their ask sits between what
 * a counter would give them and what the thing is worth.
 *
 * 1 means they take the counter's figure, which is what somebody who needs the
 * money today or wants the thing out of their hands actually does. 0 means
 * they hold out for what it is worth, because nothing is pressing them.
 *
 * The only invented number here is the 0.5, and it decides a midpoint and
 * nothing else: somebody who has merely outgrown a thing is under no pressure
 * in either direction, and splitting the difference is what a person with no
 * reason to hurry and no reason to hold does.
 */
export const HOW_BADLY_THEY_WANT_IT_GONE:
    Readonly<Record<WhyTheyWouldPartWithIt, number>> = Object.freeze({
        not_theirs_to_be_seen_with: 1,
        they_need_stones: 1,
        it_is_beyond_them: 0,
        they_have_outgrown_it: 0.5
    });

/**
 * How thin a purse has to be before it is a reason to sell something.
 *
 * One year of what somebody at their own rung earns. Not a wealth line, a
 * comfort line, and it moves with the ladder on its own because
 * `earningsPerYear` does: thirty stones is a different situation at Qi
 * Condensation and at Nascent Soul, and one flat number would say they were
 * the same.
 *
 * Measured on five seeded worlds: 1200 of 2135 living NPCs are under it, and
 * the median holding is 0.00 years of their own income - so this is a rule
 * about most of the world rather than an edge case. It nonetheless produces
 * NO offers in a fresh world, and the reason is worth knowing before anybody
 * "fixes" it: the people who hold surplus are the people who have climbed, and
 * the people who have climbed have money. It goes live the moment somebody can
 * hold a thing they did not climb for.
 */
export const A_YEAR_OF_THEIR_OWN_INCOME = 1;

/** True when the purse would not cover a year of what they earn. */
export function theirPurseIsThin(who: SomebodyStandingHere): boolean {
    return who.spiritStones < earningsPerYear(who.ordinal) * A_YEAR_OF_THEIR_OWN_INCOME;
}

/**
 * Whether this is the thing they are currently living on.
 *
 * The present-need rule, applied to a holding. Somebody standing inside the
 * range a thing covers - past the rung it becomes usable at, short of the rung
 * it stops helping at - is not holding surplus. For a manual that is the road
 * they are walking and their next two centuries depend on it, and **nobody
 * sells the road they are walking**: not to eat, and not because a stranger is
 * holding stones.
 *
 * Stated here rather than at the call site because getting it wrong is the
 * worst failure this module could have. Without it, a thin purse would put
 * every cultivator's working manual on the market and a request for a market
 * would have been answered by selling off the world.
 */
export function itIsTheThingTheyAreStillUsing(
    who: SomebodyStandingHere,
    thing: Pick<AThingInSomebodysHands, 'usableFrom' | 'usefulUntil'>
): boolean {
    return thing.usableFrom <= who.ordinal && who.ordinal < thing.usefulUntil;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ANSWER
// ─────────────────────────────────────────────────────────────────────────

export interface AnOfferStandingHere {
    sellerId: string;
    sellerName: string;
    thingId: string;
    name: string;
    why: WhyTheyWouldPartWithIt;
    /** What they are asking, in whole spirit stones. Never below one. */
    askStones: number;
    /** What the thing is worth before anybody's situation is read into it. */
    listStones: number;
    /** What a counter would have given them for it. The floor of the band. */
    counterStones: number;
    usableFrom: number;
    usefulUntil: number;
    /**
     * Who would want a word about it, when anybody would.
     *
     * Carried out of here because it is half the point: a buyer is entitled to
     * know they are about to be wearing somebody's signature, and it is not
     * the same sentence in the two cases.
     */
    whoWouldWantAWord: string | null;
    /** The awkwardness rung, for the record and for the provenance note. */
    awkwardToHold: 0 | 1;
}

export interface WhyThisOneStaysWhereItIs {
    thingId: string;
    name: string;
    why: WhyItDoesNotMove;
}

/**
 * Everything one person standing here would let go of, and everything they
 * would not.
 *
 * Both halves, because a refusal that names what would have worked is worth
 * more than an empty list, and because the second half carries the more
 * interesting sentences - *that one is his own house's, and no figure you can
 * name moves it.*
 */
export interface WhatThisPersonWouldDo {
    who: SomebodyStandingHere;
    offers: AnOfferStandingHere[];
    withheld: WhyThisOneStaysWhereItIs[];
}

/**
 * Read one person against everything in their hands.
 *
 * Pure, and total: a person holding nothing comes back with two empty lists
 * rather than null, so a caller never has to tell "nothing to sell" apart from
 * "not asked".
 */
export function whatThisPersonWouldPartWith(
    who: SomebodyStandingHere,
    holding: readonly AThingInSomebodysHands[]
): WhatThisPersonWouldDo {
    const offers: AnOfferStandingHere[] = [];
    const withheld: WhyThisOneStaysWhereItIs[] = [];
    const thinPurse = theirPurseIsThin(who);

    for (const thing of holding) {
        // ── THE THREE THAT DO NOT MOVE ───────────────────────────────────
        //
        // In this order, because each is a stronger fact than the one after
        // it. A thing nobody alive could make again is not for sale even by
        // somebody starving who owes its owner nothing; their own house's is
        // not for sale however little they want it; and a need that is running
        // now outranks any figure.
        if (thing.awkwardToHold === 3) {
            withheld.push({
                thingId: thing.id, name: thing.name, why: 'nobody_alive_could_replace_it'
            });
            continue;
        }
        if (thing.awkwardToHold === 2) {
            withheld.push({
                thingId: thing.id, name: thing.name, why: 'it_is_their_own_house_s'
            });
            continue;
        }
        // A COPY IS NOT A PARTING. Nothing leaves the holder's hands, so the
        // rule that protects the road they are walking has nothing to protect.
        // See {@link AThingInSomebodysHands.copyable}.
        if (!thing.copyable
            && (thing.theyStillNeedIt === true || itIsTheThingTheyAreStillUsing(who, thing))) {
            withheld.push({
                thingId: thing.id, name: thing.name, why: 'they_are_going_to_need_it'
            });
            continue;
        }

        const why = whyThisOneWouldGo(who, thing, thinPurse);
        if (why === null) continue;

        // ── THE BAND, AND WHERE IN IT ────────────────────────────────────
        //
        // `quoteSale` is asked the question it was written to answer: this
        // person, at this rung, putting this thing on a counter. Its figure is
        // the least anybody would take; list is the most anybody would ask.
        const counter = quoteSale({
            item: { requiredOrdinal: thing.usableFrom },
            listStones: thing.listStones,
            quantity: 1,
            seller: { ordinal: who.ordinal }
        });
        const eager = HOW_BADLY_THEY_WANT_IT_GONE[why];
        const ask = thing.listStones + (counter.offeredStones - thing.listStones) * eager;

        offers.push({
            sellerId: who.id,
            sellerName: who.name,
            thingId: thing.id,
            name: thing.name,
            why,
            askStones: Math.max(1, Math.round(ask)),
            listStones: thing.listStones,
            counterStones: counter.offeredStones,
            usableFrom: thing.usableFrom,
            usefulUntil: thing.usefulUntil,
            whoWouldWantAWord: thing.whoWouldWantAWord,
            awkwardToHold: thing.awkwardToHold as 0 | 1
        });
    }

    return { who, offers, withheld };
}

/**
 * Which of the four readings explains this sale, or null when none does.
 *
 * Null means the person is simply USING the thing. {@link whatThisPersonWouldPartWith}
 * withholds that case before it asks, so null is unreachable through the
 * ordinary path; it is kept because this function is also the readable
 * statement of the rule, and a caller asking it directly about somebody
 * mid-book must get "no" rather than a price. Inventing one would turn every
 * cultivator in the world into a stall.
 */
export function whyThisOneWouldGo(
    who: SomebodyStandingHere,
    thing: AThingInSomebodysHands,
    thinPurse: boolean
): WhyTheyWouldPartWithIt | null {
    if (thing.awkwardToHold === 1) return 'not_theirs_to_be_seen_with';
    // A copy costs the copyist months of their life. Somebody who does not
    // need the money does not spend them, whatever else is true of the thing -
    // so a comfortable holder of a copyable book is offering nothing, and the
    // three readings below are about a thing actually leaving somebody's hands.
    if (thing.copyable) return thinPurse ? 'they_need_stones' : null;
    if (thinPurse) return 'they_need_stones';
    if (thing.usableFrom > who.ordinal) return 'it_is_beyond_them';
    if (thing.usefulUntil <= who.ordinal) return 'they_have_outgrown_it';
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS SAID ABOUT IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The clause that explains the ask, in the seller's own situation.
 *
 * Engine-authored: the narrator dresses these and does not invent them, and an
 * operator with no model configured gets the same information. Each states the
 * fact that produced the price rather than describing a mood, because the fact
 * is what a player can act on - and the first is a warning the buyer is
 * entitled to before they pay rather than after.
 */
export const WHY_THEY_ARE_SELLING: Readonly<Record<WhyTheyWouldPartWithIt, string>> =
    Object.freeze({
        not_theirs_to_be_seen_with:
            'It is not theirs and they are not of the house it belongs to, which anybody who '
            + 'knows it can see at a glance. They are not asking much and they are not going to '
            + 'say where it came from.',
        they_need_stones:
            'They need the stones more than they need it, and they are not pretending otherwise. '
            + 'The price is what somebody who has to sell today asks.',
        it_is_beyond_them:
            'It is pitched above where they are standing, so it is worth nothing to them and '
            + 'they know it is worth something to somebody. They are in no hurry about it.',
        they_have_outgrown_it:
            'They have climbed past where it stops being any use, so it does nothing for them '
            + 'and they would rather have the stones. Nothing is pressing them either way.'
    });

/** Why this one is not moving, and what would have to be true instead. */
export const WHY_IT_STAYS_WHERE_IT_IS: Readonly<Record<WhyItDoesNotMove, string>> =
    Object.freeze({
        it_is_their_own_house_s:
            'It is their own house\'s. Selling it is not an expensive thing to do, it is the '
            + 'thing a house pursues somebody across a lifetime for, and no figure you can name '
            + 'changes that. The road to it is the house, not the seller.',
        nobody_alive_could_replace_it:
            'It sits at the top of a shelf, and once it is out it is out - no house can undo '
            + 'that and none of them forgive it. It will not be bought here or anywhere.',
        they_are_going_to_need_it:
            'They are going to need it themselves, and inside the year. A present need is not a '
            + 'price you have not met; it is a refusal. Coming back after their crossing is a '
            + 'different conversation.'
    });
