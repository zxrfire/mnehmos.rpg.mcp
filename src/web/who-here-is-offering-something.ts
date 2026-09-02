/**
 * Who, in this square, would sell you something - the half that goes and looks.
 *
 * `engine/world/what-somebody-standing-here-would-part-with.ts` is the
 * arithmetic and is pure. This is the layer that knows the three things it
 * cannot: which people are actually standing where the player is, what the
 * shipped catalogs say about the books in their hands, and where the knowledge
 * rows go.
 *
 * ── WHY IT IS NOT A NEW DISCOVERY MECHANISM ──────────────────────────────
 *
 * Same one. Somebody who turns round and offers you a book has told you their
 * name in the ordinary way, so the grant goes through `KnowledgeGate.learnIfNew`
 * at `placed` with `told` provenance - the same route travellers, hearsay and
 * the recruiting wall already use, which
 * `what-is-posted-on-the-wall-here.ts` is the worked example of. There is no
 * flag that skips the gate and nothing is granted at a stage the source could
 * not carry. Somebody already known writes nothing and is not re-announced.
 *
 * A person the player still cannot name is not offered. That is not a
 * limitation bolted on - it is what the offer IS: an approach, from somebody
 * who has decided to speak to you. Nobody in the square is enumerated behind
 * their own back.
 *
 * ── WHY IT IS FREE ───────────────────────────────────────────────────────
 *
 * Hearing what somebody is asking costs nothing anywhere in the world. The
 * price is downstream, at the purchase, where it always was.
 *
 * ── WHY ONLY MANUALS, AND WHERE THE REST COMES FROM ──────────────────────
 *
 * A manual is not the interesting case. It is the only surplus an NPC can be
 * READ for: measured across five seeded worlds, 1370 objects, every one of them
 * on a faction and **none on a person**, and after two hundred years of
 * simulation on one of them, still none. An `NpcRecord` carries a purse and
 * `cultivation.techniqueIds` and nothing else.
 *
 * **The material now exists and the missing piece is a pouch on the roster.**
 * `hunting-a-spirit-beast.ts` made beasts a live supply, with the bands that
 * matter here: below `BEAST_CORE_ORDINAL` a kill yields counted material with
 * no identity, at or above it a tracked core that arrives already carrying
 * where it came from and what it was taken off, and above `BEAST_CHANGE_ORDINAL`
 * the thing could speak - which makes its core a different object from an
 * animal's, on `items.md`'s "holding is a signature" and not on a second rule.
 *
 * The engine side takes all of that unchanged. `AThingInSomebodysHands` wants
 * `usableFrom` (the grade it can be worked at), `usefulUntil`, a list price,
 * `copyable: false` - a core is one object and copying it is not a thing - and
 * `awkwardToHold` carrying whose it was. What is missing is only the column to
 * read it out of: NPCs have no pouch, so no NPC can be holding one yet.
 *
 * **A fighting art is priced as a book that crosses no realm**, which is
 * `monthsToCopy` evaluated at the honest inputs rather than a second price
 * rule; see {@link whatOneCopyIsWorth}. That matters more than it sounds:
 * unbacked cultivators hold arts and not manuals, and they are most of who is
 * standing in a market town.
 *
 * The tracked, above-the-line half already exists and is not duplicated here:
 * `what-a-holder-would-take-for-it.ts` prices what somebody would take for a
 * thing they will not sell, and a person's house's shelf is reached through
 * that. This is the cash tier - the tier a nobody standing in a market town can
 * actually reach.
 */

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
 *
 * A market is not a census, and the same cap `COMPANY_SHOWN` applies to a look
 * for the same reason: four people talking to you is a busy afternoon, and
 * fourteen is a wall of text nobody reads. The cut is by ask, cheapest first,
 * because the cheapest thing is the one a nobody can act on.
 */
export const SELLERS_SHOWN = 4;

/**
 * What one copy of a book is worth in spirit stones, whether or not a stall
 * carries it.
 *
 * `stallPriceStones` is the authority where a stall does carry it, so a book
 * on the board and the same book in somebody's hands cannot end up on two
 * scales. Where no stall carries it the SAME arithmetic is run - the copyist's
 * months, which is a fact about the book rather than about the counter it is
 * sold at - rather than a second table appearing here. Null when the catalog
 * offers nobody at that rung any work at all, which is the honest answer:
 * where nobody is hiring, nobody is copying books for a living either.
 */
export function whatOneCopyIsWorth(techniqueId: string): number | null {
    if (isSoldAtAStall(techniqueId)) return stallPriceStones(techniqueId);
    const row = getTechnique(techniqueId) as
        { class?: string; cap?: number | null; requiredOrdinal?: number } | undefined;
    if (!row) return null;
    const opens = row.requiredOrdinal ?? 0;
    const wage = copyistMonthlyCash(opens);
    if (wage === null) return null;
    // ── A FIGHTING ART IS A BOOK THAT CROSSES NO REALM ───────────────────
    //
    // `monthsToCopy` at (opens, opens) is not a second price rule, it is the
    // existing one evaluated at the honest inputs - and the case it already
    // anticipates in as many words: "a book carrying a reader through no realm
    // boundary at all is still a physical object somebody sat and wrote, so the
    // floor is one month rather than none". A fighting art teaches one thing at
    // one rung; nobody crosses anything on it.
    //
    // This is what puts the unbacked population on the market. They hold arts
    // and not manuals, they are most of who is standing in a market town, and
    // without this line the whole of the owner's *random cultivators* were
    // priced at nothing and shown to nobody.
    const carriesTo = row.cap == null ? opens : Number(row.cap);
    const cash = wage * monthsToCopy(opens, carriesTo);
    return Math.max(1, Math.ceil(cash / CASH_PER_STONE));
}

/**
 * The books in one person's hands, as the columns the engine reads.
 *
 * `whoseArt` gives every house that teaches it, and `betrayalOfSelling` wants
 * one. The holder's own house wins when it is on the list, because that is the
 * reading that matters - a disciple selling their own house's manual is the
 * betrayal proper and must not be softened into "somebody else's". Otherwise
 * the first owner is taken, which is the reading `betrayalOfSelling` treats
 * identically anyway: any house that is not yours prices the same.
 */
export function whatIsInTheirHands(
    /**
     * The holder, and it has to be the person rather than only their house.
     *
     * `copyable` is a fact about WHO IS HOLDING IT - writing an art out takes
     * having mastered it - so this cannot be answered off a faction id and a
     * list of ids. `masteryOfIt` is optional because an `NpcRecord` carries no
     * such column and a played cultivator does; see `couldWriteOutACopy`.
     */
    holder: {
        factionId: string | null;
        ordinal: number;
        masteryOfIt?: (techniqueId: string) => number | null;
    },
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
            // ── COPYABLE IS ABOUT THE PERSON, NOT ABOUT THE BOOK ─────────
            //
            // This line used to read `isCommonlyHeld(id)`, with a comment
            // insisting that `isCommonlyHeld` IS the copyable line and there
            // must not be a second one. Both halves were wrong, and they were
            // wrong in opposite directions.
            //
            // `isCommonlyHeld` answers whether a STALL stocks a thing. Its
            // first line returns true for everything without a `cap`, which is
            // every fighting art in the catalog - so twelve houses' signature
            // arts read as freely copyable by whoever was holding one, and
            // `betrayalOfSelling` (which opened with the same predicate)
            // priced selling them at nothing. The two could not disagree
            // because both were answering the wrong question.
            //
            // What decides whether a copy exists to sell is the owner's rule:
            // *"you'd have to master it, which would mean you are at sect
            // leader or higher"*. So the predicate takes the holder, and the
            // ownership question is `betrayalOfSelling`'s alone. A gathering
            // primer stays copyable by everybody and a house's sword by four
            // people in the world, out of one rule with no exceptions list.
            copyable: couldWriteOutACopy(
                {
                    realmOrdinal: holder.ordinal,
                    ...(holder.masteryOfIt
                        ? { masteryOfIt: holder.masteryOfIt(id) }
                        : {})
                },
                id
            ),
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
 *
 * The read half, split out because two callers want it and only one of them
 * has any business writing a knowledge row. The affordance panel - "what can I
 * do here" - has to know whether there is anybody trading in order to offer
 * the sentence, and a panel that quietly put four strangers' names into a
 * player's head every time it rendered would be a discovery bypass wearing a
 * user interface.
 *
 * Returns empty rather than refusing where nobody is trading, because "nobody
 * here has anything they would part with" is a fact about the place and the
 * caller decides whether it is worth a sentence.
 */
export function readWhatIsOnOfferHere(
    cultivator: Cultivator,
    world: WorldState | null | undefined,
    /**
     * Whether this cultivator already holds a copy of a thing.
     *
     * ── AN OFFER THAT CANNOT BE TAKEN MUST NOT BE PRINTED ────────────────
     *
     * Found by playing: a copy was bought off Kong Nuobo for five stones and
     * the next read still had Kong Nuobo offering it. The PURCHASE was already
     * guarded - a second attempt falls through to the stall - so nothing could
     * be bought twice, and that is exactly why this matters: the listing was
     * saying something the game would not honour, which is worse than a
     * refusal because a player has no way to find out except by trying.
     *
     * Optional, because the two callers differ: the affordance panel counts
     * sellers off the world and has no database in front of it, and a count
     * that is one too high is a smaller wrong than a panel reaching into
     * storage to render a number.
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

    const offers = read
        .flatMap(person => person.offers)
        .filter(offer => !(alreadyHolds?.(offer.thingId) ?? false))
        .sort((a, b) => a.askStones - b.askStones || a.thingId.localeCompare(b.thingId))
        .slice(0, SELLERS_SHOWN);

    return { offers, read, peopleHere: here.length };
}

/**
 * Everything anybody standing here would sell, what they are asking, and the
 * names that entered this player's world by being spoken to.
 *
 * The half that WRITES. Only a player who actually asked - who read the board,
 * or looked at the square - reaches this.
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
 *
 * `told` -> `placed`, which is what somebody who has addressed you about their
 * own business has given you: you can name them and go back to them, and you
 * know nothing else. `stageFromSource` clamps it, so there is no route through
 * here to a stage the source could not carry.
 *
 * Returns whether it was new, which is the signal every caller uses to decide
 * whether to say anything - the same one the recruiting wall uses to stop
 * reprinting a poster somebody has already read.
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
 *
 * Three facts per line and in this order: what it is and what they want for
 * it, then where it opens and stops, then WHY they are letting it go - because
 * the why is the part that tells a player whether this is a bargain, a warning
 * or a person in trouble, and it is the part a shop cannot have.
 */
export function linesForOffers(
    offers: readonly AnOfferStandingHere[],
    purseStones: number
): string[] {
    if (offers.length === 0) return [];

    // ── THE REASON IS A HEADING, NOT A REFRAIN ───────────────────────────
    //
    // The why is the part a stall cannot have and it is worth its length, and
    // it was appended to every single row. Measured in a played run: four
    // people in one market town, all four selling because they were short, and
    // the answer carried "They need the stones more than they need it, and they
    // are not pretending otherwise. The price is what somebody who has to sell
    // today asks." four times in nine lines. A player skims a block like that
    // and stops reading the rows as well, which costs them the one fact per
    // line that WAS different.
    //
    // So the offers are grouped by the situation that produced them: the
    // situation once, the people under it. Nothing is dropped - every offer
    // still carries its reason, it is simply stated where it applies to all of
    // them at once. The grouping is also the more useful shape, because "who
    // here is desperate" is the question a buyer is actually asking.
    const byReason = new Map<WhyTheyWouldPartWithIt, AnOfferStandingHere[]>();
    for (const offer of offers) {
        const group = byReason.get(offer.why);
        if (group) group.push(offer);
        else byReason.set(offer.why, [offer]);
    }

    const lines = ['Not everything here is on a stall. People are carrying things too.'];
    for (const [why, group] of byReason) {
        lines.push(WHY_THEY_ARE_SELLING[why]);
        lines.push(...rowsForOffers(group));
    }

    const within = offers.filter(o => o.askStones <= purseStones).length;
    lines.push(
        within === 0
            ? `The purse holds ${purseStones}, which is short of every one of those.`
            : within === offers.length
                ? `The purse holds ${purseStones}, which covers any of them.`
                : `The purse holds ${purseStones}: ${within} of those ${offers.length} `
                  + 'are within it.'
    );
    return lines;
}

/** One line each: who, what, what it costs, where it opens and stops. */
function rowsForOffers(offers: readonly AnOfferStandingHere[]): string[] {
    const lines: string[] = [];
    for (const offer of offers) {
        // ── WHOSE IT IS, SAID ONLY WHEN IT IS SOMEBODY'S ─────────────────
        //
        // `whoseArt` answers which houses TEACH a thing, and the commonest
        // arts are taught by two dozen of them - so naming a house on every
        // line would tell a player that a primer everybody has is somebody's
        // property, which is the opposite of what `manuals.md` says. The
        // awkwardness rung is the test, and it is the same one that decided
        // the price.
        const house = offer.awkwardToHold === 1 && offer.whoWouldWantAWord
            ? getSect(offer.whoWouldWantAWord)
            : null;
        // A thing that opens and stops at the same rung carries nobody
        // anywhere. Saying "as far as" about it reads as a bug rather than as
        // a fighting art.
        const reach = offer.usefulUntil > offer.usableFrom
            ? `It opens at ${rankName(offer.usableFrom)} and carries as far as `
              + `${rankName(offer.usefulUntil)}. `
            : `It opens at ${rankName(offer.usableFrom)} and carries nobody past it - it is one `
              + 'thing done well rather than a road. ';
        lines.push(
            `  ${offer.sellerName} would let a copy of ${offer.name} go for `
            + `${offer.askStones} spirit stone${offer.askStones === 1 ? '' : 's'}. `
            + reach.trimEnd()
            + (house
                ? ` It is the ${house.name}'s, and they are not one of theirs - somebody will `
                  + 'want to know where you got it.'
                : '')
        );
    }
    return lines;
}

/**
 * What the people here will not sell, and why, for somebody who asked.
 *
 * `AGENTS.md`: prefer a refusal that names a way out. All three reasons name
 * one and none of them is money, which is why this is worth printing at all.
 *
 * **Grouped by reason and counted, not listed per person.** Measured across
 * three seeded worlds: a settlement holds 430 people and produces zero offers,
 * because everybody there is at the bottom of the ladder walking the same
 * primer - so the ungrouped form printed the identical sentence once per body,
 * which reads as a bug rather than as a world. What is true and worth saying is
 * the SHAPE: how many are holding something, and what is stopping each kind of
 * holding from moving.
 *
 * Nobody is named here. A person who has not spoken to you has not told you
 * their name, and only the offer path - somebody turning round and addressing
 * you - grants one.
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
