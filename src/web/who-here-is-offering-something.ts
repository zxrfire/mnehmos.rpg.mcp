/**
 * Who, in this square, would sell you something - the half that goes and looks.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHO SELLS WHAT, WHICH IS A RULE ABOUT THE SELLER AND NOT ABOUT THE SQUARE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner's split, stated plainly and NOT YET IMPLEMENTED HERE:
 *
 *   > "rando npcs only sell random mortal items"
 *   > "a cultivator only sells cultivator items"
 *   > "that's the split"
 *
 * So what somebody deals in is decided by WHAT THEY ARE, not by where they are
 * standing or by what the last screen quoted. A villager behind a barrow sells
 * the things a village sells; somebody on the ladder sells arts, pills and
 * objects, and never maize. Two populations, one square, and a question put to
 * one of them must not be answered out of the other's stock.
 *
 * WHAT IS THERE NOW, measured: this module reads arts out of
 * `cultivation.techniqueIds` and prices them, so the CULTIVATOR half exists and
 * the mortal half does not - there is no barrow, and a mortal standing here
 * offers nothing rather than offering bread. The gap is therefore additive: a
 * mortal's stock is missing, not misfiled.
 *
 * AND ONE LIVE DEFECT THE SPLIT WOULD CLOSE. `haggleOverAPrice` in
 * `turn-engine.ts` falls back to a rate carried over from an earlier screen and
 * stamps the name of whoever is facing onto it, so a person with standing
 * offers of their own can be made to quote a book they do not hold. The
 * narrower cause is that "how much does X want for what they are carrying"
 * does not put X in `action.target`, so the person never becomes `facing` and
 * the offers are never narrowed to them. Fixing the target extraction is the
 * first half; the seller split above is what makes the answer right rather than
 * merely attributed to the correct mouth.
 *
 * DO NOT implement the split as a filter on the THING. It is a fact about the
 * person: the same object in a cultivator's hands and in a villager's is two
 * different transactions, and a rule written on the object cannot say so.
 */

import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import { getTechnique } from '../data/cultivation/techniques.js';
import { getSect } from '../data/cultivation/sects.js';
import {
    betrayalOfSelling,
    couldWriteOutACopy,
    whoseArt
} from '../engine/world/manuals.js';
import {
    copyistMonthlyCash,
    monthsToCopy,
    stallPriceStones,
    isSoldAtAStall
} from '../engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import { CASH_PER_STONE } from '../data/cultivation/mortal-world.js';
import {
    whatThisPersonWouldPartWith,
    WHY_THEY_ARE_SELLING,
    WHY_IT_STAYS_WHERE_IT_IS,
    type AThingInSomebodysHands,
    type WhyTheyWouldPartWithIt,
    type AnOfferStandingHere,
    type SomebodyStandingHere,
    type WhatThisPersonWouldDo
} from '../engine/world/what-somebody-standing-here-would-part-with.js';
import { npcsAt } from '../engine/world/world-state.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { worldLocationFor } from './entities.js';
import type { KnowledgeGate } from './knowledge.js';
import { rankName } from '../engine/cultivation/realms.js';

/**
 * The most sellers a square puts in front of anybody at once.
 */
export const SELLERS_SHOWN = 4;

/**
 * What one copy of a book is worth in spirit stones, whether or not a stall carries
 * it.
 */
export function whatOneCopyIsWorth(techniqueId: string): number | null {
    if (isSoldAtAStall(techniqueId)) return stallPriceStones(techniqueId);
    const row = getTechnique(techniqueId) as
        { class?: string; cap?: number | null; requiredOrdinal?: number } | undefined;
    if (!row) return null;
    const opens = row.requiredOrdinal ?? 0;
    const wage = copyistMonthlyCash(opens);
    if (wage === null) return null;
    // A FIGHTING ART IS A BOOK THAT CROSSES NO REALM
    const carriesTo = row.cap == null ? opens : Number(row.cap);
    const cash = wage * monthsToCopy(opens, carriesTo);
    return Math.max(1, Math.ceil(cash / CASH_PER_STONE));
}

/**
 * The books in one person's hands, as the columns the engine reads.
 */
export function whatIsInTheirHands(
    /**
     * The holder, and it has to be the person rather than only their house.
     */
    holder: { factionId: string | null; ordinal: number },
    techniqueIds: readonly string[]
): AThingInSomebodysHands[] {
    const npcFactionId = holder.factionId;
    const out: AThingInSomebodysHands[] = [];
    for (const id of techniqueIds) {
        const row = getTechnique(id) as
            { name?: string; class?: string; cap?: number | null; requiredOrdinal?: number }
            | undefined;
        if (!row) continue;
        const listStones = whatOneCopyIsWorth(id);
        if (listStones === null) continue;
        const owners = whoseArt(id);
        const ownerFactionId =
            npcFactionId && owners.includes(npcFactionId) ? npcFactionId : owners[0] ?? null;
        const opens = row.requiredOrdinal ?? 0;
        out.push({
            id,
            name: row.name ?? id,
            usableFrom: opens,
            // A fighting art carries a reader across nothing, so where it opens
            // is also where it stops. Nobody outgrows one and nobody is
            // mid-road on one; what moves it is `copyable` below.
            usefulUntil: row.cap == null ? opens : Number(row.cap),
            listStones,
            awkwardToHold: betrayalOfSelling({ factionId: npcFactionId }, id, ownerFactionId),
            whoWouldWantAWord: ownerFactionId,
            // COPYABLE IS ABOUT THE PERSON, NOT ABOUT THE BOOK
            copyable: couldWriteOutACopy({ realmOrdinal: holder.ordinal }, id),
            // A book and an art are both held rather than carried. Nothing
            // leaves the seller, which is why `copyable` is the gate on the
            // sale and the present-need rule is not.
            whatMovesIsACopy: true
        });
    }
    return out;
}

export interface WhatIsBeingOfferedHere {
    /** Every offer standing in this square, cheapest ask first. */
    offers: AnOfferStandingHere[];
    /** The people read, offers or not. Kept so a caller can say "nobody". */
    read: WhatThisPersonWouldDo[];
    /** Worded, ready for the narrator. Engine-authored; nothing invented. */
    lines: string[];
    /** Names that genuinely entered this player's world by being spoken to. */
    learned: string[];
    /** How many people were standing here at all, offering or not. */
    peopleHere: number;
}

/**
 * What is being offered here, WITHOUT anybody learning anything.
 */
export function readWhatIsOnOfferHere(
    cultivator: Cultivator,
    world: WorldState | null | undefined,
    /**
     * Whether this cultivator already holds a copy of a thing.
     */
    alreadyHolds?: (thingId: string) => boolean
): { offers: AnOfferStandingHere[]; read: WhatThisPersonWouldDo[]; peopleHere: number } {
    if (!world) return { offers: [], read: [], peopleHere: 0 };
    const place = worldLocationFor(world, cultivator.location);
    if (!place) return { offers: [], read: [], peopleHere: 0 };

    const here = npcsAt(world, place.id).filter(npc => npc.id !== cultivator.id);
    const read: WhatThisPersonWouldDo[] = [];

    for (const npc of here) {
        const who: SomebodyStandingHere = {
            id: npc.id,
            name: npc.name,
            ordinal: npc.cultivation.realmOrdinal,
            spiritStones: npc.spiritStones,
            factionId: npc.factionId
        };
        read.push(whatThisPersonWouldPartWith(
            who,
            whatIsInTheirHands(
                { factionId: npc.factionId, ordinal: npc.cultivation.realmOrdinal },
                npc.cultivation.techniqueIds ?? []
            )
        ));
    }

    // ── FOUR SELLERS, WHICH IS WHAT THE CONSTANT SAYS ────────────────────
    //
    // This flattened every offer, sorted by price and took four, so the cap
    // counted OFFERS while its name and its own doc line count SELLERS. One
    // cheap seller consumed the whole allowance and everybody else standing
    // there was invisible - measured on a square where a man held four things
    // and a second man's stock could not be reached at all.
    //
    // Cheapest-first still decides who is shown and in what order; what
    // changed is that a seller's second thing waits until every other seller
    // has had a first. So the square puts four PEOPLE in front of somebody,
    // which is what it says it does, and a crowded square stops looking like
    // one man's stall.
    const wanted = read
        .flatMap(person => person.offers)
        .filter(offer => !(alreadyHolds?.(offer.thingId) ?? false))
        .sort((a, b) => a.askStones - b.askStones || a.thingId.localeCompare(b.thingId));

    const offers: typeof wanted = [];
    const takenFrom = new Map<string, number>();
    for (let round = 0; offers.length < SELLERS_SHOWN; round++) {
        const before = offers.length;
        for (const offer of wanted) {
            if (offers.length >= SELLERS_SHOWN) break;
            if ((takenFrom.get(offer.sellerId) ?? 0) !== round) continue;
            offers.push(offer);
            takenFrom.set(offer.sellerId, round + 1);
        }
        if (offers.length === before) break;
    }

    return { offers, read, peopleHere: here.length };
}

/**
 * Everything anybody standing here would sell, what they are asking, and the names
 * that entered this player's world by being spoken to.
 */
export function whatIsBeingOfferedHere(
    knowledge: KnowledgeGate,
    cultivator: Cultivator,
    run: Run,
    world: WorldState | null | undefined,
    alreadyHolds?: (thingId: string) => boolean
): WhatIsBeingOfferedHere {
    const { offers, read, peopleHere } =
        readWhatIsOnOfferHere(cultivator, world, alreadyHolds);
    const onDay = Math.floor(run.elapsedDays);

    // ── AND ONLY NOW DOES ANYBODY LEARN A NAME ───────────────────────────
    //
    // After the cut, not before it. Reading the square must not put fourteen
    // names into somebody's head - what puts a name there is being spoken to,
    // and the people who spoke are exactly the ones whose asks survived.
    const learned: string[] = [];
    for (const offer of offers) {
        if (learnTheSeller(knowledge, cultivator, onDay, offer)) learned.push(offer.sellerName);
    }

    return {
        offers,
        read,
        lines: linesForOffers(offers, cultivator.spiritStones),
        learned,
        peopleHere
    };
}

/**
 * One seller's name, into the player's world, the ordinary way.
 */
export function learnTheSeller(
    knowledge: KnowledgeGate,
    cultivator: Cultivator,
    onDay: number,
    offer: AnOfferStandingHere
): boolean {
    return knowledge.learnIfNew({
        holderId: cultivator.id,
        kind: 'cultivator',
        id: offer.sellerId,
        name: offer.sellerName,
        onDay,
        sourceKind: 'told',
        sourceNote: `Offered to sell a copy of ${offer.name} at ${cultivator.location}.`,
        stage: 'placed',
        statement: `${offer.sellerName} is here and is selling a copy of ${offer.name}.`
    });
}

/**
 * The offers, worded.
 */
export function linesForOffers(
    offers: readonly AnOfferStandingHere[],
    purseStones: number
): string[] {
    if (offers.length === 0) return [];

    // THE REASON IS A HEADING, NOT A REFRAIN
    const byReason = new Map<WhyTheyWouldPartWithIt, AnOfferStandingHere[]>();
    for (const offer of offers) {
        const group = byReason.get(offer.why);
        if (group) group.push(offer);
        else byReason.set(offer.why, [offer]);
    }

    const lines = ['Not everything here is on a stall. People are carrying things too.'];
    // Carried across the reason groups, not reset with each: the same primer
    // sold by somebody who needs the money and by somebody who is leaving is
    // still one primer, and its reach is a fact about it.
    const alreadySaid = new Set<string>();
    for (const [why, group] of byReason) {
        lines.push(WHY_THEY_ARE_SELLING[why]);
        lines.push(...rowsForOffers(group, alreadySaid));
    }

    // THE PURSE IS SAID ONCE IN AN ANSWER, AND THE BOARD SAID IT.
    //
    // A market read renders the stall board first, which already opens with
    // what the purse holds and in what currency. This restated the figure with
    // no unit on it, so the same answer carried "The purse holds 40000 spirit
    // stones, which is 4000000 cash" and then "The purse holds 40000". What
    // this block knows that the board does not is how these particular offers
    // sit against it, so that is all it says.
    const within = offers.filter(o => o.askStones <= purseStones).length;
    lines.push(
        within === 0
            ? 'Every one of those is past what the purse holds.'
            : within === offers.length
                ? 'The purse covers any of them.'
                : `${within} of those ${offers.length} are within the purse.`
    );
    return lines;
}

/** One line each: who, what, what it costs, where it opens and stops. */
function rowsForOffers(
    offers: readonly AnOfferStandingHere[],
    // WHERE A THING OPENS AND STOPS IS A FACT ABOUT THE THING.
    //
    // Three people in a square carrying the same primer printed the same
    // sentence about it three times, once under each seller. It is said under
    // the first of them and not again, across the whole read.
    alreadySaid: Set<string>
): string[] {
    const lines: string[] = [];
    for (const offer of offers) {
        // WHOSE IT IS, SAID ONLY WHEN IT IS SOMEBODY'S
        const house = offer.awkwardToHold === 1 && offer.whoWouldWantAWord
            ? getSect(offer.whoWouldWantAWord)
            : null;
        // A thing that opens and stops at the same rung carries nobody
        // anywhere. Saying "as far as" about it reads as a bug rather than as
        // a fighting art.
        const said = alreadySaid.has(offer.name);
        alreadySaid.add(offer.name);
        const reach = said
            ? ''
            : offer.usefulUntil > offer.usableFrom
                ? `It opens at ${rankName(offer.usableFrom)} and carries as far as `
                  + `${rankName(offer.usefulUntil)}. `
                : `It opens at ${rankName(offer.usableFrom)} and carries nobody past it - it is `
                  + 'one thing done well rather than a road. ';
        // Trimmed at the end because the reach clause is dropped on a repeat
        // of the same thing, and the price segment before it ends in the space
        // that used to carry it.
        lines.push((
            `  ${offer.sellerName} would let a copy of ${offer.name} go for `
            + `${howMany(offer.askStones, 'spirit stone')}. `
            + reach.trimEnd()
            + (house
                // THE HOUSE OPENS THE CLAUSE, not `It is`. The ban in
                // `the-engine-does-not-close-on-the-weather` is on the dummy
                // opener, and the house is the thing this sentence is about
                // anyway - naming it first says the same fact and says it
                // harder.
                ? ` The ${house.name} owns that copy and they are not one of theirs - somebody `
                  + 'will want to know where you got it.'
                : '')
        ).trimEnd());
    }
    return lines;
}

/**
 * What the people here will not sell, and why, for somebody who asked.
 */
export function linesForWhatWillNotMove(read: readonly WhatThisPersonWouldDo[]): string[] {
    const counted = new Map<string, number>();
    for (const person of read) {
        for (const held of person.withheld) {
            counted.set(held.why, (counted.get(held.why) ?? 0) + 1);
        }
    }
    if (counted.size === 0) return [];

    const total = [...counted.values()].reduce((a, b) => a + b, 0);
    const lines = [
        `Nobody standing here is selling. ${total} of them ${total === 1 ? 'is' : 'are'} `
        + 'carrying something worth carrying, and all of it is spoken for:'
    ];
    for (const [why, n] of counted) {
        lines.push(
            `  ${n === 1 ? 'One of them' : `${n} of them`}: `
            + WHY_IT_STAYS_WHERE_IT_IS[why as keyof typeof WHY_IT_STAYS_WHERE_IT_IS]
        );
    }
    return lines;
}
