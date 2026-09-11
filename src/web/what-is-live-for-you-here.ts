/**
 * What is live, timed and priced where this cultivator is standing.
 *
 * FOUND BY PLAYING, on turn 0. The opening read:
 *
 *     Clear River Ford. You were raised on ground like this.
 *     Gu Lanlin is here, looking at what is on a counter and not buying.
 *     Nothing is happening. Nothing happens here.
 *
 * At that moment the engine held: two houses running dated intakes in that
 * square, one in 26 days with a bar the player fails; no method, so nothing
 * accumulates however long they sit; a copy of the book that closes it on a
 * stall for 8 stones against a purse of 30. Every part already computed, none
 * of it said. The opening was selecting the square over what is live.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────────
 *
 * A selection, not a generator. Everything here is state the world already
 * holds where the player is standing, so density falls out of the place: a
 * hamlet with no wall, no stall and nobody on it produces one line about the
 * road out, and a sect town produces six. Nothing is spawned to fill a quiet
 * turn, and a quiet place stays quiet.
 *
 * It states facts and does not rank them into advice. `whatIsWorthDoingStandingHere`
 * is the advice reader and answers a different question - what could I type -
 * from the same `StandingHere`.
 *
 * ── TWO CHANNELS, AND A THIRD THING THAT IS ONLY ON ONE ───────────────────
 *
 * {@link LiveFact.notHeld} marks a fact the WORLD holds and this cultivator
 * does not. It reaches the narrator and never the player, so the prose can
 * lean toward a thing rather than naming it, and `FiledOutcome.onOfferAndNotHeld`
 * is the output-side check that it did not get named anyway. The same split
 * `the-life-behind-the-first-turn.ts` keeps with `behindTheirBack`.
 */

import { AMBIENT_QI_RATE_MULTIPLIER, type AmbientQi } from '../schema/cultivation.js';
import { rankName } from '../engine/cultivation/realms.js';
import { asToldToTheNarrator, asToldToThePlayer, type SaidToBoth } from './facts.js';

export interface LiveFact extends SaidToBoth {
    /**
     * Stable name for this fact, so a caller can tell whether it has already
     * said it. Never shown to anybody.
     */
    readonly key: string;
    /**
     * True where {@link SaidToBoth.text} names something the world holds and
     * this cultivator does not.
     *
     * It does NOT mean the fact is withheld. What the player perceives - the
     * colours, the bearing, the room being made - is said to them in
     * `toThePlayer`, and the name is the half that stays on the narrator's
     * channel. A `notHeld` fact without a `toThePlayer` has nothing perceivable
     * in it and is dropped from the player's channel entirely.
     */
    readonly notHeld?: boolean;
    /** A name in this fact the player does not hold, for the output-side audit. */
    readonly unheldName?: string;
}

/** One bill nailed up here, as the paper states it. */
export interface DatedDoor {
    houseName: string;
    /** What the paper says, verbatim from the engine that wrote it. */
    saying: string;
    /** Lowest rung the house will hear. */
    admissionOrdinal: number;
    /** Days until it opens, from the same clock the paper was written on. */
    inDays: number;
}

/** A book a stall on this ground copies out. */
export interface BookOnAStallHere {
    name: string;
    askStones: number;
    opensAtOrdinal: number;
    /** How far it carries a cultivator, or null where it carries them the whole way. */
    carriesToOrdinal: number | null;
}

export interface WhatIsLiveInput {
    ordinal: number;
    spiritStones: number;
    /** Whether anything accumulates at all. */
    practisesAMethod: boolean;
    /**
     * Why nothing accumulates, in the engine's own words, or null where
     * something does. `techniqueCeiling(...).line`, never restated here.
     */
    theBindingGate: string | null;
    /** Every bill on the wall where they are standing, soonest first. */
    doorsPostedHere: readonly DatedDoor[];
    /** What a stall here would sell that this body could open, cheapest first. */
    booksOnAStallHere: readonly BookOnAStallHere[];
    /** What people standing here would part with, cheapest ask first. */
    goodsOnOfferHere: readonly { name: string; askStones: number }[];
    /** How many of them there are, which is a different number from the offers. */
    sellersHere: number;
    /** Ground within reach worth more per year than this, best first. */
    thickerGroundWithinReach: readonly {
        name: string;
        ambient: AmbientQi;
        travelDays: number | null;
    }[];
    ambient: AmbientQi;
    peopleHere: number;
    /**
     * Houses whose colours are being worn in this square and whose names this
     * cultivator has never been told.
     *
     * The hook. Wearing a house's colours is a thing anybody standing there
     * sees; knowing whose they are is a thing you have to have been told. The
     * player is shown the first and not the second, which is what makes it
     * something to point a verb at rather than a name to be handed.
     */
    coloursHereTheyCannotPlace: readonly string[];
    /** Commission work this ground would put to somebody at this rung. */
    dutiesGoing: number;
    /**
     * Keys this reader already handed this player on this ground today.
     *
     * The one piece of memory here, and it is the whole of the answer to a
     * look that reprints what the player has just read. Keyed on place and day
     * by the caller, so walking to the next town states the situation there,
     * and waiting a day restates a door that is now a day nearer - which is a
     * different fact rather than the same one.
     */
    alreadySaidHereToday?: readonly string[];
}

export interface TheLiveSituation {
    /** Every fact, including the ones the player does not hold. */
    readonly forTheNarrator: readonly string[];
    /** What the player reads, whatever a model does or fails to do. */
    readonly toldToThePlayer: readonly string[];
    readonly structure: readonly string[];
    /** Names put in front of the model this turn that the player does not hold. */
    readonly namedAndNotHeld: readonly string[];
    /** What this read has now said, for the caller to remember. */
    readonly keysSaid: readonly string[];
}

/**
 * The most facts one read may hand over.
 *
 * A cap rather than a target. Six is what a busy provincial seat produces and
 * most ground produces one or two.
 */
const MOST_A_READ_CARRIES = 6;

function stones(n: number): string {
    return `${n} spirit stone${n === 1 ? '' : 's'}`;
}

/**
 * Where this body stands against a bar, said as two rungs rather than as a gap.
 *
 * Never an ordinal difference: nobody in this world perceives an ordinal, and
 * the two rung names are the whole of what a person reading a bill knows.
 */
function againstTheBar(ordinal: number, admissionOrdinal: number): LiveFact {
    const bar = rankName(admissionOrdinal);
    const standing = rankName(ordinal);
    if (ordinal >= admissionOrdinal) {
        return {
            key: 'bar',
            text: `The bar on the soonest of them is ${bar}, and they stand at ${standing}, `
                + 'which clears it.',
            toThePlayer: `The bar on the soonest of them is ${bar}. You stand at ${standing}, `
                + 'which clears it.'
        };
    }
    return {
        key: 'bar',
        text: `The bar on the soonest of them is ${bar}, and they stand at ${standing}. `
            + 'Nothing about the paper changes that.',
        toThePlayer: `The bar on the soonest of them is ${bar}. You stand at ${standing}. `
            + 'Nothing about the paper changes that.'
    };
}

/**
 * What is live standing here, most timed first.
 */
export function whatIsLiveForYouHere(input: WhatIsLiveInput): TheLiveSituation {
    const facts: LiveFact[] = [];
    const structure: string[] = [];

    // ── WHAT IS COMING, AND WHEN ─────────────────────────────────────────
    // Dated first, because a date is the one thing on this list that stops
    // being true on its own.
    const doors = [...input.doorsPostedHere].sort((a, b) => a.inDays - b.inDays);
    for (const door of doors) facts.push({ key: `door:${door.houseName}`, text: door.saying });
    if (doors.length > 0) {
        facts.push(againstTheBar(input.ordinal, doors[0].admissionOrdinal));
        structure.push(
            `${doors.length} door${doors.length === 1 ? '' : 's'} posted here, soonest in `
            + `${doors[0].inDays} days at ${rankName(doors[0].admissionOrdinal)}, against a `
            + `reader at ${rankName(input.ordinal)}.`
        );
    }

    // ── WHY NOTHING IS MOVING ────────────────────────────────────────────
    if (!input.practisesAMethod && input.theBindingGate !== null) {
        facts.push({
            key: 'gate',
            // The gate line is written to the player. A narrator is told about
            // somebody, so the pronoun is the one thing that changes.
            text: input.theBindingGate
                .replace(/\byou sit\b/g, 'they sit')
                .replace(/\byou\b/g, 'them')
                .replace(/\bYou are\b/g, 'They are'),
            toThePlayer: input.theBindingGate
        });
    }

    // ── AND WHAT WOULD CLOSE IT, PRICED AGAINST THE PURSE ────────────────
    const book = input.booksOnAStallHere[0] ?? null;
    if (book !== null) {
        const carries = book.carriesToOrdinal === null
            ? 'carries a cultivator the whole way'
            : `carries a cultivator as far as ${rankName(book.carriesToOrdinal)}`;
        const purse = `The purse holds ${stones(input.spiritStones)}.`;
        facts.push({
            key: `book:${book.name}`,
            text: `A stall here copies out ${book.name} for ${stones(book.askStones)}. It opens `
                + `at ${rankName(book.opensAtOrdinal)} and ${carries}. Their purse holds `
                + `${stones(input.spiritStones)}.`,
            toThePlayer: `A stall here copies out ${book.name} for ${stones(book.askStones)}. `
                + `It opens at ${rankName(book.opensAtOrdinal)} and ${carries}. ${purse}`
        });
        structure.push(
            `${book.name} at ${book.askStones} stones on a stall here, opening at `
            + `${rankName(book.opensAtOrdinal)}, against a purse of ${input.spiritStones}.`
        );
    }

    // ── AND WHAT SOMEBODY STANDING HERE WOULD PART WITH ──────────────────
    const offer = input.goodsOnOfferHere[0] ?? null;
    if (offer !== null && offer.name !== book?.name) {
        const who = input.sellersHere === 1
            ? 'Somebody here is'
            : `${input.sellersHere} people here are`;
        facts.push({
            key: `offer:${offer.name}`,
            text: `${who} carrying something they would rather have the stones for, and not `
                + `hiding it. A copy of ${offer.name} is going for ${stones(offer.askStones)}.`
        });
    }

    // ── AND WHAT IS BEING WORN THAT THEY CANNOT PLACE ────────────────────
    //
    // Shown, never told. The house is named to the narrator and marked, so the
    // prose can lean on the colours being unfamiliar rather than naming them,
    // and the audit catches it if the name gets written anyway.
    const colours = [...new Set(input.coloursHereTheyCannotPlace)];
    if (colours.length === 1) {
        facts.push({
            key: `colours:${colours[0]}`,
            text: `Somebody standing here is wearing ${colours[0]}'s colours. This cultivator `
                + 'has never been told whose they are.',
            toThePlayer: 'Somebody standing here is wearing a house\'s colours, and you cannot '
                + 'place them.',
            notHeld: true,
            unheldName: colours[0]
        });
    } else if (colours.length > 1) {
        facts.push({
            key: `colours:${colours.join('+')}`,
            text: `${colours.length} houses' colours are being worn in this square - `
                + `${colours.join(', ')} - and this cultivator can place none of them.`,
            toThePlayer: `${colours.length} sets of house colours are being worn in this square, `
                + 'and you can place none of them.',
            notHeld: true
        });
        for (const name of colours) structure.push(`Colours worn here and not held: ${name}.`);
    }
    for (const name of colours) {
        if (!structure.some(row => row.endsWith(`${name}.`))) {
            structure.push(`Colours worn here and not held: ${name}.`);
        }
    }

    // ── WHAT THE BOARD IS ASKING FOR ─────────────────────────────────────
    if (input.dutiesGoing > 0) {
        facts.push({
            key: 'duties',
            text: `${input.dutiesGoing} thing${input.dutiesGoing === 1 ? '' : 's'} on the board `
                + `here ${input.dutiesGoing === 1 ? 'is' : 'are'} being put to somebody at this `
                + 'rung, with what each pays.',
            toThePlayer: `${input.dutiesGoing} thing${input.dutiesGoing === 1 ? '' : 's'} on the `
                + `board here ${input.dutiesGoing === 1 ? 'is' : 'are'} being put to somebody at `
                + 'your rung, with what each pays.'
        });
    }

    // ── AND WHERE THE ROAD GOES ──────────────────────────────────────────
    //
    // Last on busy ground and the whole of the answer on empty ground. A
    // crossing with nobody on it and no wall is not padded: what is true there
    // is that nothing here will move anybody, and that there is a road.
    const better = input.thickerGroundWithinReach[0] ?? null;
    // Nothing about the GROUND, which is not the same as nothing at all: the
    // binding gate is a fact about the body and travels with it, so counting it
    // here would make a bare crossing read as somewhere with something on it.
    const groundIsBare = input.doorsPostedHere.length === 0
        && input.booksOnAStallHere.length === 0
        && input.goodsOnOfferHere.length === 0
        && colours.length === 0
        && input.dutiesGoing === 0
        && input.peopleHere === 0;
    if (better !== null && (groundIsBare || facts.length < MOST_A_READ_CARRIES)) {
        const gain =
            AMBIENT_QI_RATE_MULTIPLIER[better.ambient] / AMBIENT_QI_RATE_MULTIPLIER[input.ambient];
        const walk = better.travelDays === null
            ? 'The catalog prices no road to it, which puts it inside this province.'
            : `It is ${better.travelDays} day${better.travelDays === 1 ? '' : 's'} off.`;
        facts.push({
            key: `road:${better.name}`,
            text: `${better.name} is ${bandName(better.ambient)} against `
                + `${bandName(input.ambient)} here, which is ${gain.toFixed(1)}x what this square `
                + `gives back for the same year. ${walk}`
        });
    }
    if (groundIsBare && better === null) {
        facts.push({
            key: 'empty',
            text: 'Nobody is on this ground and nothing is posted on it.',
            toThePlayer: 'Nobody is on this ground and nothing is posted on it.'
        });
    }

    // ── AND NOT A SECOND TIME ON THE SAME GROUND ON THE SAME DAY ─────────
    //
    // FOUND BY PLAYING. `i look around` on turn one came back with the whole of
    // turn 0 word for word and then carried on. A player's first deliberate
    // action returning the text they have just read is a wasted turn, and the
    // cause was that the opening and the look verb compose the same read with
    // nothing between them that knows the opening happened.
    //
    // Keyed on the ground and the day by the caller, so this suppresses a
    // repeat and never a change: walking to the next town states that town,
    // and a door that was three days off and is now two is a different fact
    // under the same key on a different day.
    const said = new Set(input.alreadySaidHereToday ?? []);
    const kept = facts.filter(fact => !said.has(fact.key)).slice(0, MOST_A_READ_CARRIES);
    return {
        forTheNarrator: asToldToTheNarrator(kept),
        toldToThePlayer: asToldToThePlayer(
            kept.filter(fact => fact.notHeld !== true || fact.toThePlayer !== undefined)
        ),
        structure,
        namedAndNotHeld: kept
            .map(fact => fact.unheldName)
            .filter((name): name is string => name !== undefined),
        keysSaid: kept.map(fact => fact.key)
    };
}

/** The band as a surveyor writes it, with what it is worth attached. */
function bandName(band: AmbientQi): string {
    const rate = AMBIENT_QI_RATE_MULTIPLIER[band];
    const named = band.replace(/_/g, ' ');
    return rate === 1 ? `${named} qi, ordinary rate` : `${named} qi, ${rate}x ordinary ground`;
}
