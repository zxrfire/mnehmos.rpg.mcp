/**
 * Who, in this square, would sell you something - the half that goes and looks.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHO SELLS WHAT, WHICH IS A RULE ABOUT THE SELLER AND NOT ABOUT THE SQUARE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner's split:
 *
 *   > "rando npcs only sell random mortal items"
 *   > "a cultivator only sells cultivator items"
 *
 * So what somebody deals in is decided by WHAT THEY ARE, not by where they are
 * standing or by what the last screen quoted. `whatTheyDealIn` is the whole of
 * it and it reads the rung, which is the line the ladder already draws; this
 * module asks it once per person and then asks a different question of each
 * half. It is NOT a filter on the thing - the same object in a cultivator's
 * hands and in a villager's is two different transactions, and a rule written
 * on the object cannot say so.
 *
 * WHAT WAS MISSING, measured over three seeded worlds: 647 people standing in
 * 81 squares, 4 of them offering anything at all, and 77 of the 81 squares with
 * nobody selling. Every one of those 4 was at or above Foundation Establishment
 * and nobody below it sold anything - so the split was already true of the
 * world and one side of it was simply empty. The mortal half was the gap, and
 * closing it is additive.
 *
 * AND ONE LIVE DEFECT THE SPLIT WOULD CLOSE, owned elsewhere.
 * `haggleOverAPrice` in `turn-engine.ts` falls back to a rate carried over from
 * an earlier screen and stamps the name of whoever is facing onto it, so a
 * person with standing offers of their own can be made to quote a book they do
 * not hold. The narrower cause is that "how much does X want for what they are
 * carrying" does not put X in `action.target`.
 */

import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import { getTechnique } from '../data/cultivation/techniques.js';
import { getSect } from '../data/cultivation/sects.js';
import {
    betrayalOfSelling,
    couldWriteOutACopy,
    whoseArt,
    yearsToWriteOutACopy
} from '../engine/world/manuals.js';
import {
    copyistMonthlyCash,
    stallPriceStones,
    isSoldAtAStall
} from '../engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import {
    CASH_PER_STONE,
    THE_MORTAL_BOARD,
    stonesForACashPrice
} from '../data/cultivation/mortal-world.js';
import { localPrice } from '../data/cultivation/regions.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    whatThisPersonWouldPartWith,
    whatThisPersonWouldSellOverACounter,
    whatTheyDealIn,
    WHY_THEY_ARE_SELLING,
    WHY_IT_STAYS_WHERE_IT_IS,
    type AThingInSomebodysHands,
    type AThingOnTheirCounter,
    type WhyTheyWouldPartWithIt,
    type AnOfferStandingHere,
    type SomebodyStandingHere,
    type WhatThisPersonWouldDo
} from '../engine/world/what-somebody-standing-here-would-part-with.js';
import { whetherTheyWouldLookUp } from '../engine/world/what-somebody-is-at-when-you-walk-up.js';
import { npcsWhereTheyStand } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import type { WorldState } from '../engine/world/world-state.js';
import { standingOf } from '../server/consolidated/where-a-cultivator-is-standing.js';
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
    // WHAT IS PAID FOR IS THE MASTER'S TIME, NOT THE PAPER. A book no stall
    // carries is written out from memory by somebody who finished it, and
    // `yearsToWriteOutACopy` is how long that takes: two months for a primer,
    // years for a deep road. The flat paper figure is the stall's.
    const years = yearsToWriteOutACopy(techniqueId);
    if (years === null) return null;
    const cash = wage * years * 12;
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

/**
 * The most rows one person has out in front of them.
 *
 * A barrow, not a warehouse. Three keeps a square of eight villagers from
 * printing twenty-four lines of millet, and keeps two people standing side by
 * side from looking like one shop.
 */
export const THINGS_ON_A_BARROW = 3;

/**
 * What one person on the mortal side of the split has out.
 *
 * Drawn off their own id so it is theirs rather than the square's: two people
 * at the same counter deal in different things, and the same person deals in
 * the same things every time somebody walks past. The price is the board's own
 * figure through the province multiplier, which is the call the market quote
 * already makes, so the person and the counter beside them cannot disagree
 * about what a bowl of millet costs.
 */
export function whatIsOnTheirCounter(
    who: { id: string },
    regionId: string,
    worldSeed: string
): AThingOnTheirCounter[] {
    const rng = forStream(worldSeed, 'a-barrow', who.id);
    const picked = new Map<string, AThingOnTheirCounter>();
    const wanted = rng.int(1, THINGS_ON_A_BARROW);
    for (let draw = 0; draw < wanted * 3 && picked.size < wanted; draw++) {
        const row = THE_MORTAL_BOARD[rng.int(0, THE_MORTAL_BOARD.length - 1)];
        if (!row || picked.has(row.id)) continue;
        picked.set(row.id, {
            id: row.id,
            name: row.name,
            askStones: stonesForACashPrice(localPrice(regionId, row.cash))
        });
    }
    return [...picked.values()];
}

export interface WhatIsBeingOfferedHere {
    /** The offers this square puts forward: both boards, cheapest first in each. */
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

    // The area of the place they stand in: a stall in the cloth row is not at the inn.
    const here = npcsWhereTheyStand(world, place, cultivator.standingIn, cultivator);
    const read: WhatThisPersonWouldDo[] = [];
    const regionId = standingOf(cultivator).regionId;

    for (const npc of here) {
        const who: SomebodyStandingHere = {
            id: npc.id,
            name: npc.name,
            ordinal: npc.cultivation.realmOrdinal,
            spiritStones: npc.spiritStones,
            factionId: npc.factionId
        };
        // ── THE SPLIT, ASKED ONCE, ABOUT THE PERSON ──────────────────────
        //
        // Not a filter applied to what came back. Which question gets put is
        // decided here, so a villager is never asked what arts they would part
        // with and somebody on the ladder is never asked what is on their
        // barrow - and neither answer has to be cleaned up afterwards.
        //
        // AND A COUNTER NOBODY IS BEHIND IS NOT A COUNTER. The gate is on the
        // mortal half alone and the asymmetry is real rather than convenient:
        // parting with a spare manual is a conversation somebody will have
        // whatever they were doing, and running a barrow is the thing they are
        // doing. `whetherTheyWouldLookUp` is the world's existing answer to
        // which of the two somebody is at, so a man losing a fight with
        // something out of the rocks is not also selling firewood.
        read.push(whatTheyDealIn(who) === 'the_mortal_board'
            ? whatThisPersonWouldSellOverACounter(
                who,
                npc.activity === null || whetherTheyWouldLookUp(npc.activity.kind)
                    ? whatIsOnTheirCounter(who, regionId, world.seed)
                    : [])
            : whatThisPersonWouldPartWith(
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
    //
    // AND A SQUARE SHOWS BOTH BOARDS. Sorted on price alone the mortal board
    // wins every slot - millet is one stone, a manual is hundreds, and a
    // settlement runs about eight people of whom seven stand below Foundation -
    // so the one art in the square is unreachable, which is the defect
    // AGENTS.md already records as "arts on a stall measured 0% reachable".
    // Putting the ladder first instead inverts it: a square with a dozen
    // cultivators in it then sells no food. The two boards take the slots in
    // turn, which needs neither figure to be tuned and holds at both extremes.
    const wanted = read
        .flatMap(person => person.offers)
        .filter(offer => !(alreadyHolds?.(offer.thingId) ?? false))
        .sort((a, b) => a.askStones - b.askStones || a.thingId.localeCompare(b.thingId));

    // AND A SELLER WITH ONE THING WAS SHOWN IT TWICE. The round-robin counted
    // how many times it had taken FROM a seller and then re-scanned the whole
    // flat list, so in round 1 a seller holding a single offer matched the
    // round again and that offer was pushed a second time. Invisible while the
    // only sellers were people carrying arts - a square rarely had four of
    // those - and immediately visible once every villager had a barrow: a ford
    // with two people in it printed both of them twice. Grouping first makes
    // the round an INDEX into what each seller has, which cannot repeat.
    const inTurn = (pool: readonly AnOfferStandingHere[]): AnOfferStandingHere[] => {
        const bySeller = new Map<string, AnOfferStandingHere[]>();
        for (const offer of pool) {
            const theirs = bySeller.get(offer.sellerId);
            if (theirs) theirs.push(offer);
            else bySeller.set(offer.sellerId, [offer]);
        }
        const taken: AnOfferStandingHere[] = [];
        for (let round = 0; taken.length < SELLERS_SHOWN; round++) {
            const before = taken.length;
            for (const theirs of bySeller.values()) {
                if (taken.length >= SELLERS_SHOWN) break;
                const offer = theirs[round];
                if (offer) taken.push(offer);
            }
            if (taken.length === before) break;
        }
        return taken;
    };

    const held = inTurn(wanted.filter(offer => !offer.fromTheMortalBoard));
    const board = inTurn(wanted.filter(offer => offer.fromTheMortalBoard));
    const offers: AnOfferStandingHere[] = [];
    for (let i = 0; i < Math.max(held.length, board.length); i++) {
        if (offers.length < SELLERS_SHOWN && i < held.length) offers.push(held[i]);
        if (offers.length < SELLERS_SHOWN && i < board.length) offers.push(board[i]);
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
    // WHAT ACTUALLY CHANGES HANDS. A book is written out and a sack of salt is
    // handed over, and "a copy of Salt" is the engine saying the wrong word
    // about half the square.
    const what = offer.fromTheMortalBoard ? offer.name : `a copy of ${offer.name}`;
    return knowledge.learnIfNew({
        holderId: cultivator.id,
        kind: 'cultivator',
        id: offer.sellerId,
        name: offer.sellerName,
        onDay,
        sourceKind: 'told',
        sourceNote: `Offered to sell ${what} at ${cultivator.location}.`,
        stage: 'placed',
        statement: `${offer.sellerName} is here and is selling ${what}.`
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

    // WHAT THE OPENER IS FOR is saying that these are PEOPLE rather than the
    // price board, and it was written when the only sellers were cultivators
    // carrying something. A square where every line is off the mortal board
    // opened on "not everything here is on a stall" and then listed a barrow.
    const lines = [offers.every(offer => offer.fromTheMortalBoard)
        ? 'What the people standing here have out in front of them:'
        : 'Not everything here is on a stall. People are carrying things too.'];
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
        // NOTHING ON THE MORTAL BOARD OPENS AT A RUNG. A rung clause on a bowl
        // of millet is the engine reading its own columns out loud.
        const reach = said || offer.fromTheMortalBoard
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
            // A BARROW LINE IS A PRICE, NOT A PARTING. "Would let a copy go
            // for" is the right sentence about a book somebody spent months
            // writing out and the wrong one about firewood, and turning it
            // round - the ask first, the thing after - also carries the rows
            // that are a trade rather than a good without reading as somebody
            // selling a physician.
            (offer.fromTheMortalBoard
                ? `  ${offer.sellerName} is asking `
                  + `${howMany(offer.askStones, 'spirit stone')} for ${offer.name}. `
                : `  ${offer.sellerName} would let a copy of ${offer.name} go for `
                  + `${howMany(offer.askStones, 'spirit stone')}. `)
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
