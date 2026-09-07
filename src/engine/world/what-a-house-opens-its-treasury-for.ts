/**
 * WHAT A HOUSE OPENS ITS TREASURY FOR.
 *
 * Measured before this file: the treasury moved from exactly three places -
 * rebuilding a flattened compound and two player-facing takes. Two of the
 * reasons `WhyItMoved` declares had no producer at all. A house could be driven
 * to its last hall without once reaching for the money that would have bought a
 * defence, and no house ever rewarded anybody out of it.
 *
 * ── AND THIS FILE ADDS ONE FACT AND NO MACHINERY ─────────────────────────
 *
 * The first cut had a table of shares keyed on how the war was going, and its
 * own approval path for arming disciples. Both were bespoke, which is the thing
 * this engine is built to avoid: opening a vault derives from the house's upper
 * leadership - the elder and patriarch decision process - and not from anything
 * the treasury knows about itself. It is a fact about the PEOPLE in the room,
 * and that is true of everything, not of treasuries.
 *
 * So the decision is `whetherItLeavesTheStore`, unchanged and unwrapped: the
 * same counted/tracked routing, the same offices, the same room that can
 * already refuse its own patriarch. Handing out swords is a loan of tracked
 * things, which that function has always routed to the whole body.
 *
 * The ONE fact added here is that a war moves the people. An elder who would
 * ask what for in a quiet year votes to empty the vault when half the compound
 * is down, and it enters through `readingOf` - the same door the ledger enters
 * by. Nothing downstream knows there is a war on.
 *
 * The three bands fall out rather than being written. Measured over 2000
 * houses of four, at a thousand stones held:
 *
 *   at peace        7% open, 7 stones - rare
 *   at war         83% open, 258 stones - moderate
 *   about to lose 100% open, 593 stones - liberal, and ruinous
 *
 * ── AND TWO GRAINS, WHICH ARE NOT THE SAME EVENT ─────────────────────────
 *
 * Stones leaving for a war are a RATE, and not discrete: nobody remembers the
 * year the house paid for arrows. A house taking its good weapons out of the
 * vault and putting them in disciples' hands is a discrete act by the people
 * who decided it, it is a LOAN, and everybody who was there remembers it.
 */

import type { ObligationRecord } from '../social/grudges.js';
import {
    whatTheBodyWants,
    type OnTheRoll,
    type WhereTheBodyLands
} from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import { openHandednessOf } from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import type { WhyItMoved } from './a-house-holds-its-own.js';
import { HOW_MANY_HALLS_A_COMPOUND_IS } from './what-a-year-of-war-does-to-a-compound.js';
import {
    isSomethingYouWouldSwing,
    transferPossession,
    type ObjectRecord
} from './possessions.js';
import {
    whetherItLeavesTheStore
} from '../social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import type { APortfolio } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { whereInTheHouseItSits } from './what-a-house-keeps-in-its-treasury.js';

/**
 * How a war is going for one house, from its own side.
 *
 * Three states and not a number, because what it changes is what a ROOM OF
 * PEOPLE will agree to, and a room does not read a war as 0.63.
 */
export type HowTheWarGoes =
    /** No war. A house still has bills, and they are not war bills. */
    | 'at_peace'
    /** At war, and it could go either way. */
    | 'at_war'
    /** At war and losing. Reserves kept past this point are reserves lost. */
    | 'about_to_lose';

/** What the house would be opening it for. */
export type WhatItWouldBeFor =
    /** Walls, wards, arrows, indemnities. The rate, not an event. */
    | 'the_war'
    /** One person the house has decided is owed something extra. */
    | 'a_reward'
    /** The good weapons out of the vault and into disciples' hands. An event. */
    | 'arming_its_own';

/**
 * How much of a compound has to be down before a house reads itself as losing.
 *
 * Half. A third down is a bad year; half is watching the thing end.
 */
export const WHEN_A_HOUSE_IS_LOSING = 0.5;

/**
 * How the war is going, off what the world already records.
 *
 * Derived, so nothing has to remember to set a war-footing flag. `HALLS_DOWN`
 * is already counted by what a year of war does to a compound.
 */
export function howTheWarGoesFor(input: {
    /** True where any war names this house. */
    atWar: boolean;
    /** Halls of its own compound already down. */
    hallsDown: number;
    /** Halls a whole compound is. Defaults to the one figure the world uses. */
    hallsInAll?: number;
}): HowTheWarGoes {
    if (!input.atWar) return 'at_peace';
    const inAll = input.hallsInAll ?? HOW_MANY_HALLS_A_COMPOUND_IS;
    if (inAll <= 0) return 'at_war';
    return input.hallsDown / inAll >= WHEN_A_HOUSE_IS_LOSING ? 'about_to_lose' : 'at_war';
}

/**
 * How far the question moves the person being asked.
 *
 * Added to what each decider already is, so the room's own character survives:
 * a mean room at war is still meaner than an open-handed one, and the war moves
 * both by the same amount rather than replacing either.
 *
 * ARMING IS THE COLDEST ASK AT PEACE and nearly the warmest when losing, which
 * is the widest swing in the table and is the point of it. Handing the house's
 * tracked weapons to disciples in a quiet year is giving away the things that
 * make the house what it is; doing it with half the compound down is the last
 * card there is.
 *
 * A REWARD RUNS THE OTHER WAY. A house at peace can afford to be generous to
 * one person. A house losing a war has uses for that money, and the room says
 * so.
 */
export const WHAT_THE_ASK_MOVES_A_ROOM: Readonly<
    Record<WhatItWouldBeFor, Readonly<Record<HowTheWarGoes, number>>>
> = {
    the_war: { at_peace: -0.5, at_war: 0.3, about_to_lose: 0.9 },
    a_reward: { at_peace: 0.15, at_war: -0.15, about_to_lose: -0.5 },
    arming_its_own: { at_peace: -0.75, at_war: 0.15, about_to_lose: 0.85 }
};

/**
 * The war, as a reading of one person.
 *
 * This is the whole of what this file contributes to a decision. Everything
 * else about opening a vault was already written and already tested.
 */
export function howAWarReadsToADecider(input: {
    what: WhatItWouldBeFor;
    how: HowTheWarGoes;
    base?: (personId: string) => number;
}): (personId: string) => number {
    const base = input.base ?? openHandednessOf;
    const shift = WHAT_THE_ASK_MOVES_A_ROOM[input.what][input.how];
    return id => Math.max(-AXIS, Math.min(AXIS, base(id) + shift));
}

/** The axis every reading is held to. */
const AXIS = 1;

export interface WhetherTheVaultOpens {
    /** Where the room landed. A null leaning means there was no room to ask. */
    answer: WhereTheBodyLands;
    /** Whether it opens at all. */
    opened: boolean;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Whether the house opens it, and who said so.
 *
 * Everything about the war enters through `readingOf`. Nothing downstream of
 * `whatTheBodyWants` knows there is a war on, which is what keeps this one
 * governance system rather than a second one wearing war paint.
 */
export function whetherTheVaultOpens(input: {
    what: WhatItWouldBeFor;
    how: HowTheWarGoes;
    roll: readonly OnTheRoll[];
    rankCount: number;
    asking?: string | null;
    ledger?: readonly ObligationRecord[];
    asOfDay?: number;
    /** How open-handed each decider is. Defaults to the world's own reading. */
    readingOf?: (personId: string) => number;
}): WhetherTheVaultOpens {
    const answer = whatTheBodyWants({
        roll: input.roll,
        rankCount: input.rankCount,
        readingOf: howAWarReadsToADecider({
            what: input.what,
            how: input.how,
            ...(input.readingOf === undefined ? {} : { base: input.readingOf })
        }),
        ...(input.asking === undefined ? {} : { asking: input.asking }),
        ...(input.ledger === undefined ? {} : { ledger: input.ledger }),
        ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
    });
    const opened = (answer.leaning ?? 0) > 0;
    return {
        answer,
        opened,
        line: answer.leaning === null
            ? `${input.what}: no room to ask, so the vault stays shut.`
            : `${input.what} while ${input.how}: the room settled it ${answer.settledBy}, `
              + `leaning ${answer.leaning.toFixed(2)}. ${opened ? 'Opened.' : 'Shut.'}`
    };
}

/**
 * The share a room in total agreement would part with.
 *
 * Deliberately not 1. A house that spends literally everything cannot pay its
 * people the following month, and a body that stops paying its people has lost
 * a different way. The figure is ruinous, not total.
 */
export const WHAT_A_ROOM_IN_FULL_AGREEMENT_WILL_PART_WITH = 0.75;

/**
 * What actually leaves, in stones.
 *
 * Straight off the room's leaning, so a grudging yes is a grudging sum. Zero
 * for a room that refused, and zero for a house nobody decides in.
 */
export function whatItWouldSpend(input: {
    held: number;
    answer: WhereTheBodyLands;
}): number {
    const leaning = input.answer.leaning ?? 0;
    if (leaning <= 0) return 0;
    const held = Math.max(0, Math.floor(input.held));
    return Math.min(
        held,
        Math.floor(held * leaning * WHAT_A_ROOM_IN_FULL_AGREEMENT_WILL_PART_WITH)
    );
}

/**
 * Why the money left, for the ledger.
 *
 * War money in a quiet year is upkeep - walls and wards and patrols - and in a
 * loud one it is the war itself. These are the two rows `WhyItMoved` declared
 * and nothing produced; they were waiting.
 */
export function whyItLeftTheTreasury(input: {
    what: WhatItWouldBeFor;
    how: HowTheWarGoes;
}): WhyItMoved {
    if (input.what === 'a_reward') return 'reward';
    return input.how === 'at_peace' ? 'upkeep' : 'indemnity';
}

// ═════════════════════════════════════════════════════════════════════════
// AND THE ONE THAT IS AN EVENT
// ═════════════════════════════════════════════════════════════════════════

/** One weapon out of the vault and into one pair of hands. */
export interface HandedOut {
    objectId: string;
    objectName: string;
    toId: string;
    toName: string;
}

export interface TheHouseArmedItsOwn {
    opened: boolean;
    /** Where the last room landed, or null where nobody was ever asked. */
    answer: WhereTheBodyLands | null;
    /** Empty where the room refused, or the vault held nothing to hand out. */
    lent: readonly HandedOut[];
    /** The rows, moved. Same objects, with the loan on their chain. */
    objects: readonly ObjectRecord[];
    line: string;
}

/**
 * A house opening the vault and arming its own.
 *
 * LENT AND NEVER GIVEN. `transferPossession` with `how: 'lent'` and ownership
 * untouched, which is what `whoseThisIs` reads to answer `lent_by_their_house`
 * - so the house can call every one of them back in, and the disciple carrying
 * a house sword knows exactly what that is worth to them.
 */
export function armItsOwn(input: {
    how: HowTheWarGoes;
    roll: readonly OnTheRoll[];
    rankCount: number;
    /** Who holds which room, so the offices answer. Empty for a house with none. */
    portfolios?: readonly APortfolio[];
    /** What the house holds. What may go out is not this function's to decide. */
    holds: readonly ObjectRecord[];
    /** Who could carry one. Any order. */
    takers: readonly { id: string; name: string; ordinal: number }[];
    houseName: string;
    onDay: number;
    asking?: string | null;
    ledger?: readonly ObligationRecord[];
    readingOf?: (personId: string) => number;
}): TheHouseArmedItsOwn {
    const reading = howAWarReadsToADecider({
        what: 'arming_its_own',
        how: input.how,
        ...(input.readingOf === undefined ? {} : { base: input.readingOf })
    });

    // The good ones, best first. A house arming its people reaches past the
    // rack of iron swords for the things it keeps a record of - and WHETHER
    // each one may go is the ordinary question, asked of the ordinary room.
    // WHAT A HOUSE PUTS IN SOMEBODY'S HANDS IS TWO THINGS, and they are handed
    // for two different reasons: something to fight with, and something to come
    // home with. Both are in the vault and only the first is a weapon, so
    // sorting the vault by rung and taking the top would hand out neither
    // reliably - a slip stands at the rung of the hand that cut it and would
    // outrank the swords.
    const inTheVault = input.holds.filter(o => o.possessorId === null);
    const weapons = inTheVault
        .filter(o => (o.power ?? 0) > 0 && isSomethingYouWouldSwing(o))
        .sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
    // The best slip first for the same reason as the best sword: a house that
    // is losing does not hand out its worst paper.
    const slips = inTheVault
        .filter(o => o.tags.includes('talisman') && o.data?.spent !== true)
        .sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
    const offered = weapons;
    // And the strongest hands first, because a house does not put its best
    // sword in the weakest grip it has.
    const hands = [...input.takers].sort((a, b) => b.ordinal - a.ordinal);

    const lent: HandedOut[] = [];
    const objects: ObjectRecord[] = [];
    const refusals: string[] = [];
    let lastAnswer: WhereTheBodyLands | null = null;

    for (const arm of offered) {
        const hand = hands[lent.length];
        if (hand === undefined) break;
        const said = whetherItLeavesTheStore({
            significance: arm.significance,
            // A house arming its own is lending, and a loan is a thing that
            // comes back. That is what routes a tracked sword to the body.
            meaning: 'use_it_and_return_it',
            room: whereInTheHouseItSits(arm.kind, arm.significance, arm.tags),
            portfolios: input.portfolios ?? [],
            roll: input.roll,
            rankCount: input.rankCount,
            readingOf: reading,
            asOfDay: input.onDay,
            ...(input.asking === undefined ? {} : { askerId: input.asking }),
            ...(input.ledger === undefined ? {} : { ledger: input.ledger })
        });
        lastAnswer = said.answer ?? lastAnswer;
        if (!said.allowed) {
            refusals.push(said.line);
            continue;
        }
        objects.push(transferPossession(arm, {
            onDay: input.onDay,
            toHolderId: hand.id,
            toHolderName: hand.name,
            how: 'lent',
            source: `${input.houseName} armed its own`,
            note: `Opened while ${input.how}.`
        }));
        lent.push({ objectId: arm.id, objectName: arm.name, toId: hand.id, toName: hand.name });
    }

    // AND A SLIP EACH, to as many hands as there is paper for. Not gated on
    // having been given a sword: the person a house most wants to come back is
    // not always the person it armed.
    for (let at = 0; at < Math.min(slips.length, hands.length); at++) {
        const slip = slips[at];
        const hand = hands[at];
        if (slip === undefined || hand === undefined) continue;
        objects.push(transferPossession(slip, {
            onDay: input.onDay,
            toHolderId: hand.id,
            toHolderName: hand.name,
            how: 'lent',
            source: `${input.houseName} armed its own`,
            note: `Opened while ${input.how}.`
        }));
        lent.push({ objectId: slip.id, objectName: slip.name, toId: hand.id, toName: hand.name });
    }

    return {
        opened: lent.length > 0,
        answer: lastAnswer,
        lent,
        objects,
        line: lent.length > 0
            ? `arming while ${input.how}: ${lent.length} out of the vault, lent.`
            : `arming while ${input.how}: nothing left the vault. `
              + (refusals[0] ?? 'There was nothing in it to hand out.')
    };
}
