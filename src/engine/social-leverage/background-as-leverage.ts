/**
 * What the person in front of you weighs about you, when the sentence put
 * nothing on the table.
 *
 * The design owner: *"i mean, that's bespoke. your BACKGROUND is leverage.
 * whether ur from a demonic sect. whether ur way stronger."*
 *
 * ── WHAT WAS BESPOKE ──────────────────────────────────────────────────────
 *
 * `ApproachLeverage` was a label the CALLER picked, and the player path picked
 * a constant: every demand that named nothing went in as `name`, whoever was
 * making it. An elder of a house that answers for its own and a rogue two
 * realms below read identically, and the enum's own warning - *"leverage the
 * asker does not have is a lie the room will price"* - had no reader.
 *
 * Nothing here is new state. Every branch is a row somebody already keeps: the
 * ladder, the roll, the obligation ledger, and what a house does about one of
 * its own.
 *
 * ── WHAT IS DERIVED AND WHAT IS NOT ───────────────────────────────────────
 *
 * Only what you ARE. `coin`, `attachment` and `secret` are things the asker
 * DOES - a sum put down, an approach made, a thing produced - and the parser
 * already labels the act that does them. Deriving those off a background would
 * put money on the table that nobody spent.
 *
 * `force` is the one act read here, because a promise of harm is made in the
 * same sentence as the ask and nothing upstream splits the two.
 *
 * ── THE TWO HALVES OF A HOUSE, AND WHY THEY ARE NOT ONE ───────────────────
 *
 * A house is worth two different things and only the first is backing.
 * `whenItIsDoneToOneOfOurs` says whether it takes up what is done to its own;
 * where it does, the house is standing behind the ask and that is `sect`.
 * Where it does not, being one of theirs is still a fact about you that the
 * room knows - which is `name`, the asker's own reputation, and is the whole
 * of what "whether ur from a demonic sect" is worth at the moment of asking.
 * What it is worth afterwards is `howFarTheyWouldGo`'s question.
 *
 * ── AND A PROMISE FROM DOWN THERE IS NOT A PROMISE ────────────────────────
 *
 * `how-they-took-what-you-said.ts` settled this for utterances and the same
 * test decides it here, off the same constant: at the gap where a direct
 * confrontation stops being a fight, somebody with nobody behind them is not
 * threatening anyone. An unkeepable promise falls through to what they have.
 *
 * Pure. Rows in, one label out.
 */

import { HELPLESS_REALM_GAP } from '../cultivation/combat.js';
import type { WhatTheyCanPlace } from '../social/what-they-can-place-about-you.js';
import type { ApproachLeverage, SectAlignment } from '../../schema/cultivation.js';
import { SEVERITY_ORDER, severityRank, type ObligationRecord } from '../social/grudges.js';
import { whenItIsDoneToOneOfOurs } from './what-a-house-will-do-about-it.js';
import { severityOfTheWrong, type Wrong } from './what-somebody-does-about-being-wronged.js';

/**
 * The act named after *or I will*, in the world's own vocabulary of wrongs.
 *
 * A `Wrong` and never a verb, so the set of things that can be promised is the
 * set of things the world can already price, and there is no second list to
 * keep in step with the first.
 */
export interface ThePromiseYouMade {
    readonly wrong: Wrong;
    /** The wound the promise named, when it named one. `shapeOf`'s own input. */
    readonly woundKey?: string | null;
}

/** One side's house, as the roster and the catalog hold it. */
export interface TheHouseBehindSomebody {
    readonly alignment: SectAlignment | null;
    /** A rank the house has something invested in, not merely a badge. */
    readonly ranked: boolean;
    /** How high it reaches. `howHighTheirHouseReaches`'s own number. */
    readonly reaches: number;
}

export interface WhatIsActuallyBehindYou {
    readonly actorId: string;
    readonly subjectId: string;
    /** Major realms of the asker over the subject. Negative is looking up. */
    readonly realmsOverThem: number;
    readonly yourHouse: TheHouseBehindSomebody | null;
    readonly theirHouse: TheHouseBehindSomebody | null;
    /** The open ledger between these two, in either direction. */
    readonly ledger?: readonly ObligationRecord[];
    /** The act promised if they refuse, when the sentence promised one. */
    readonly promised?: ThePromiseYouMade | null;
    /**
     * What the person in front of you can place about what you ARE.
     *
     * Absent means everything about you is on show, which is the world's
     * default and is what every caller got before the field existed: a
     * cultivator's weight is on them unless they put it away.
     * `what-they-can-place-about-you.ts` is the one place that decides it, and
     * it decides the mirror question with the same call.
     */
    readonly asTheyReadYou?: WhatTheyCanPlace;
}

export interface WhatYouBringToBear {
    /** The heaviest true thing, as the enum the resolver already prices. */
    readonly leverage: ApproachLeverage;
    /**
     * The promise, kept only where they could make good on it - so a threat
     * nobody could keep reaches the resolver as nothing rather than as a
     * smaller number.
     */
    readonly promise: ThePromiseYouMade | null;
    /** Every true thing, heaviest first. Factual, for the mechanical channel. */
    readonly because: readonly string[];
}

/**
 * Whether the house behind somebody would answer for them.
 *
 * `whenItIsDoneToOneOfOurs` is the world's one answer to what a house does, and
 * this reads it from the end nobody had asked. The `ask` argument does not
 * reach `response` - it decides only a severity floor - so it is passed
 * neutrally, exactly as `ground-trust.ts` already passes it.
 */
function answersForItsOwn(house: TheHouseBehindSomebody | null): boolean {
    if (!house) return false;
    return whenItIsDoneToOneOfOurs({
        alignment: house.alignment,
        ranked: house.ranked,
        wasAnAttachment: false,
        ask: 'a_real_favour'
    }).response === 'taken_up';
}

/** Open records where the subject owes the actor, by kind. */
function theyOweYou(input: WhatIsActuallyBehindYou, kind: 'debt' | 'favor'): number {
    let count = 0;
    for (const record of input.ledger ?? []) {
        if (record.status !== 'open' || record.kind !== kind) continue;
        // A debt is owed by its holder; a favour is owed to them.
        const owed = kind === 'debt'
            ? record.holderId === input.subjectId && record.subjectId === input.actorId
            : record.holderId === input.actorId && record.subjectId === input.subjectId;
        if (owed) count++;
    }
    return count;
}

/**
 * The heaviest thing that is actually true, and why.
 *
 * The order is `LEVERAGE_TRIED_IN_THIS_ORDER` and is READ from it rather than
 * restated by the shape of a list here, because two statements of one order
 * drift: the constant is what a test pins against `APPROACH_LEVERAGE_PRESSURE`,
 * and a member whose pressure moves has to be moved in the place the loop
 * actually walks or the pin is over nothing.
 */
export function whatYouBringToBear(input: WhatIsActuallyBehindYou): WhatYouBringToBear {
    const because: string[] = [];

    // WHAT THEY CAN PLACE, WHICH IS WHAT IS WEIGHED.
    //
    // Not what you are. Everything below reads the rung they take you for and
    // the house they can put you in, and where a concealment held both of those
    // are somebody else's. One predicate covers the pair, because putting your
    // weight away is not a thing anybody half does - see the header of
    // `what-they-can-place-about-you.ts`.
    const read = input.asTheyReadYou;
    const hidden = read?.theyCanBePlaced === false;
    const yourHouse = hidden ? null : input.yourHouse;
    const over = read?.realmsTheyAreTakenToBeOver ?? input.realmsOverThem;
    if (hidden && read?.whyNot) because.push(read.whyNot);

    // Backing is the same question in both places: a house that would not take
    // up what is done to its own is not standing behind you here either.
    const yoursAnswers = answersForItsOwn(yourHouse);
    const keepable = input.promised != null
        && (over > -HELPLESS_REALM_GAP || yoursAnswers);

    if (input.promised != null && !keepable) {
        because.push(
            'A promise of harm from somebody who could not do it, with nobody who would '
            + 'answer for them. It is not what the other party is weighing.'
        );
    }

    const outreaches = yourHouse !== null
        && yourHouse.reaches >= (input.theirHouse?.reaches ?? 0);
    const debts = theyOweYou(input, 'debt');
    const favours = theyOweYou(input, 'favor');

    const whatIsTrue: Readonly<Partial<Record<ApproachLeverage, { holds: boolean; why: string }>>> = {
        force: {
            holds: keepable,
            why: input.promised
                ? `A promise of ${severityOfTheWrong(input.promised.wrong, input.promised.woundKey)}`
                  + ' harm, made by somebody in a position to keep it.'
                : ''
        },
        sect: {
            holds: yoursAnswers && outreaches,
            why: 'A house that takes up what is done to its own, reaching at least as high as '
                + 'whatever stands behind them.'
        },
        debt: {
            holds: debts > 0,
            why: `${debts} open debt${debts === 1 ? '' : 's'} of theirs they cannot deny.`
        },
        favour: {
            holds: favours > 0,
            why: `${favours} open favour${favours === 1 ? '' : 's'} they owe.`
        },
        name: {
            holds: over > 0 || yourHouse !== null,
            why: over > 0
                ? `${over} major realm${over === 1 ? '' : 's'} over them, and they can see it.`
                : 'A roll with their name on it, in a house that would not answer for them.'
        }
    };

    let chosen: ApproachLeverage | null = null;
    for (const leverage of LEVERAGE_TRIED_IN_THIS_ORDER) {
        const row = whatIsTrue[leverage];
        if (!row?.holds) continue;
        because.push(row.why);
        chosen ??= leverage;
    }

    if (chosen === null) {
        because.push(
            'Nothing stands behind the asking: no rung over them, no house, nothing owed.'
        );
        return { leverage: 'none', promise: null, because };
    }

    return {
        leverage: chosen,
        promise: chosen === 'force' ? input.promised ?? null : null,
        because
    };
}

/**
 * What a promise of harm is worth, on 0..1, off the world's own reading of how
 * heavy the wrong would be.
 *
 * A share of one ceiling rather than a table per wrong, so an eighth kind of
 * wrong needs no figure here. `oddsOf` owns the ceiling.
 */
export function howHeavyThePromiseIs(promise: ThePromiseYouMade): number {
    const rank = severityRank(severityOfTheWrong(promise.wrong, promise.woundKey));
    return (rank + 1) / SEVERITY_ORDER.length;
}

/**
 * The order `whatYouBringToBear` walks, heaviest first, and the only statement
 * of it. Exported so a test can pin it against `APPROACH_LEVERAGE_PRESSURE`.
 *
 * The four members that are NOT here are the point of the list: `coin`,
 * `attachment` and `secret` are things the asker DOES rather than IS, and
 * `none` is the absence of all of it.
 */
export const LEVERAGE_TRIED_IN_THIS_ORDER: readonly ApproachLeverage[] =
    Object.freeze(['force', 'sect', 'debt', 'favour', 'name']);
