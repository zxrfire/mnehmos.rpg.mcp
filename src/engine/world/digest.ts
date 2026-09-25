/**
 * What the player actually learns.
 *
 * `docs/world/houses/discovery.md` states the rule this module makes mechanical:
 *
 *   > Never reference an entity the player has no knowledge record for.
 *
 * and the consequence that makes it a design rather than a restriction:
 *
 *   > It can still act. The consequence arrives without attribution: a road is
 *   > closed, a price moves, a village is empty, a body is found. The world may
 *   > act on a player who cannot name what acted.
 *
 * So a returning player does not get a newsfeed of everything the world did.
 * They get what would plausibly have reached them, through a channel they
 * actually have, rendered at the level of attribution their knowledge supports.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO GATES, IN ORDER
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   1. CHANNEL - did this reach them at all?
 *      Their sect tells them. They can see it. A friend mentions it. The market
 *      is talking about it. If none of those, they never hear, and the event is
 *      counted in `unheard` and not reported. That count is deliberately
 *      exposed: a player who missed forty things is in a different position
 *      from one who missed none, even though neither can name any of them.
 *
 *   2. ATTRIBUTION - what may be said about it?
 *      `named`         every faction and person in the fact is one they have
 *                      heard of. The engine's own summary is safe to hand over.
 *      `partial`       some are known. The unattributed consequence is handed
 *                      over, plus the ids they may name, so a narrator can say
 *                      "your sect lost something to somebody" without naming
 *                      the somebody.
 *      `unattributed`  none are known. Only the consequence, which is authored
 *                      name-free at the pressure template.
 *
 * The safety property, and the one the tests assert: `DigestLine.text` never
 * contains a name the player has no record for. That is enforced structurally -
 * for `named` lines the text is the summary and every name in it is known; for
 * the other two the text comes from the fact's authored `unattributed` phrase,
 * which contains no names at all.
 *
 * ── What this module does not do ─────────────────────────────────────────
 *
 * It does not write prose. `unattributed` phrases are authored in
 * `pressure.ts` beside the event that produces them, because the person who
 * decides that a vein changing hands looks like a closed road is the person
 * writing the event. This module selects and gates; the narrator writes.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { HistoricalEventKind, HistoricalFact } from './history.js';
import { lastOccurrenceOf, occurrencesOf } from './a-fact-that-keeps-happening-is-one-row.js';

// ─────────────────────────────────────────────────────────────────────────
// ACCESS
// ─────────────────────────────────────────────────────────────────────────

/**
 * One person's standing to know things.
 *
 * The `knows*` predicates are the knowledge layer's, passed in rather than
 * imported: `src/web/knowledge.ts` backs them with `knowledge_records`, and a
 * test backs them with a set. Neither this module nor the engine gets to decide
 * what somebody has heard of.
 */
export interface PlayerAccess {
    actorId: string;
    /** Where they are, or were, while the span ran. */
    locationId: string | null;
    /** Locations they would notice things in: where they are, and next door. */
    visibleLocationIds?: readonly string[];
    factionId: string | null;
    knowsFaction(id: string): boolean;
    knowsNpc(id: string): boolean;
    knowsPlace(id: string): boolean;
    /** People they would actually hear from. Defaults to anyone they know of. */
    confidantIds?: readonly string[];
}

export type ReportChannel = 'sect' | 'visible' | 'friend' | 'market' | 'witnessed';
export type ReportForm = 'named' | 'partial' | 'unattributed';

export interface DigestLine {
    factId: string;
    /**
     * How many events of the same kind this line stands for.
     *
     * Unattributed consequences repeat: five sects losing five veins over a
     * century all reach a nobody as the same closed road. Reporting the line
     * five times is noise that reads as a bug, and dropping four of them loses
     * the scale, so they collapse into one line that knows how many.
     */
    occurrences: number;
    day: number;
    year: number;
    kind: HistoricalEventKind;
    /** How it reached them. */
    channel: ReportChannel;
    form: ReportForm;
    /**
     * What may be said. Contains no name the player lacks a record for.
     * For `named` this is the engine's summary; otherwise the authored
     * consequence.
     */
    text: string;
    /** Ids the narrator is permitted to name in this line. May be empty. */
    namableFactionIds: string[];
    namableNpcIds: string[];
    magnitude: number;
}

export interface PlayerDigest {
    fromDay: number;
    toDay: number;
    lines: DigestLine[];
    /** World events in the span that reached them by no channel at all. */
    unheard: number;
    /** How many arrived without anybody's name on them. */
    unattributed: number;
    /** One line the narrator can open on, with no names in it. */
    headline: string;
}

// ─────────────────────────────────────────────────────────────────────────
// TUNING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Magnitude at which something is simply being talked about.
 *
 * Deliberately high. Below this the only way to hear about something is to have
 * been there, to be in the sect it happened to, or to know somebody involved -
 * which is how information actually moves in a world without newspapers.
 */
export const MARKET_MAGNITUDE = 0.6;
/** Magnitude below which even a sect does not bother telling its outer disciples. */
export const SECT_MAGNITUDE = 0.25;

export interface DigestOptions {
    /** Cap on reported lines, highest magnitude first. */
    limit?: number;
    /**
     * Rank index at or above which the sect tells them the awkward things.
     * An outer disciple is told what everyone knows; an elder is told more.
     */
    factionRankIndex?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE FILTER
// ─────────────────────────────────────────────────────────────────────────

/**
 * Emit the full truth to world state; emit to the player only what they have
 * access to know.
 *
 * `facts` is the world's own record for the span - everything that happened,
 * named and dated. What comes back is one person's account of the same span,
 * and the difference between the two is the game.
 */
export function buildPlayerDigest(
    facts: readonly HistoricalFact[],
    access: PlayerAccess,
    fromDay: number,
    toDay: number,
    opts: DigestOptions = {}
): PlayerDigest {
    const lines: DigestLine[] = [];
    let unheard = 0;
    let unattributed = 0;

    const visible = new Set<string>(
        access.visibleLocationIds ?? (access.locationId ? [access.locationId] : [])
    );

    for (const fact of facts) {
        if (fact.day < fromDay || fact.day > toDay) continue;

        const channel = channelFor(fact, access, visible, opts);
        if (!channel) {
            unheard++;
            continue;
        }

        const knownFactions = fact.factionIds.filter(id => access.knowsFaction(id));
        const knownActors = fact.actors.filter(a => access.knowsNpc(a.id));
        const allFactionsKnown = knownFactions.length === fact.factionIds.length;
        const allActorsKnown = knownActors.length === fact.actors.length;

        const consequence = unattributedTextOf(fact);
        let form: ReportForm;
        let text: string;

        if (allFactionsKnown && allActorsKnown) {
            form = 'named';
            text = fact.summary;
        } else if (knownFactions.length > 0 || knownActors.length > 0) {
            form = 'partial';
            text = consequence;
            unattributed++;
        } else {
            form = 'unattributed';
            text = consequence;
            unattributed++;
        }

        lines.push({
            factId: fact.id,
            // A row that kept happening is ONE row, and it says how many times
            // (`a-fact-that-keeps-happening-is-one-row.ts`). Counted only where
            // every occurrence falls inside this span: past its end the row
            // cannot say how many were in it, and one is the honest floor.
            occurrences: lastOccurrenceOf(fact) <= toDay ? occurrencesOf(fact) : 1,
            day: fact.day,
            year: fact.year,
            kind: fact.kind,
            channel,
            form,
            text,
            namableFactionIds: form === 'named' ? fact.factionIds.slice() : knownFactions.slice(),
            namableNpcIds: form === 'named'
                ? fact.actors.map(a => a.id)
                : knownActors.map(a => a.id),
            magnitude: fact.magnitude
        });
    }

    lines.sort((a, b) => a.day - b.day || (a.factId < b.factId ? -1 : 1));
    collapseRepeats(lines);
    const limited = opts.limit != null
        ? lines.slice().sort((a, b) => b.magnitude - a.magnitude).slice(0, opts.limit)
            .sort((a, b) => a.day - b.day || (a.factId < b.factId ? -1 : 1))
        : lines;

    return {
        fromDay,
        toDay,
        lines: limited,
        unheard,
        unattributed,
        headline: headlineFor(limited, unheard, fromDay, toDay)
    };
}

/**
 * Did this reach them, and how.
 *
 * Checked in order of directness. A secret stays secret unless they were in it;
 * everything else needs a real channel, and having no channel is the common
 * case for most of what the world does.
 */
function channelFor(
    fact: HistoricalFact,
    access: PlayerAccess,
    visible: Set<string>,
    opts: DigestOptions
): ReportChannel | null {
    if (fact.witnessIds.includes(access.actorId)) return 'witnessed';

    // A secret is a secret. Being in the right sect does not help.
    if (fact.visibility === 'secret') {
        return fact.actors.some(a => a.id === access.actorId) ? 'witnessed' : null;
    }

    if (visible.size > 0 && fact.locationId && visible.has(fact.locationId)) return 'visible';

    if (
        access.factionId &&
        fact.factionIds.includes(access.factionId) &&
        fact.magnitude >= sectThreshold(opts)
    ) {
        return 'sect';
    }

    const confidants = access.confidantIds;
    const heardFromSomebody = fact.actors.some(a =>
        confidants ? confidants.includes(a.id) : access.knowsNpc(a.id)
    );
    if (heardFromSomebody) return 'friend';

    // Public, and big enough that the market is talking about it. This is the
    // channel that carries unattributed consequence to somebody with no
    // standing at all, and it is why a nobody still notices a war.
    if (fact.visibility === 'public' && fact.magnitude >= MARKET_MAGNITUDE) return 'market';

    return null;
}

/**
 * Fold consecutive identical unattributed lines together.
 *
 * Only the nameless ones, and only when the text matches exactly: a named
 * report is about a specific thing and must never be merged with another. The
 * first line keeps its date, which is when the player first noticed, and the
 * count says how often it kept happening.
 */
function collapseRepeats(lines: DigestLine[]): void {
    let write = 0;
    for (let read = 0; read < lines.length; read++) {
        const line = lines[read];
        const prev = write > 0 ? lines[write - 1] : null;
        if (
            prev &&
            prev.form !== 'named' &&
            line.form !== 'named' &&
            prev.text === line.text &&
            prev.channel === line.channel
        ) {
            prev.occurrences++;
            prev.magnitude = Math.max(prev.magnitude, line.magnitude);
            continue;
        }
        lines[write++] = line;
    }
    lines.length = write;
}

function sectThreshold(opts: DigestOptions): number {
    const rank = opts.factionRankIndex ?? 0;
    // An elder is told the awkward things; an outer disciple hears the notices.
    return Math.max(0.05, SECT_MAGNITUDE - rank * 0.05);
}

/**
 * The name-free consequence.
 *
 * Authored on the fact by whatever produced it. The fallbacks exist so that a
 * fact from somewhere that has not been taught to write one still cannot leak a
 * name - they are deliberately vague, because a vague true line is a better
 * failure than a specific invented one.
 */
export function unattributedTextOf(fact: HistoricalFact): string {
    const authored = fact.data.unattributed;
    if (typeof authored === 'string' && authored.length > 0) return authored;
    return FALLBACK[fact.kind] ?? 'Something happened that nobody will explain.';
}

const FALLBACK: Partial<Record<HistoricalEventKind, string>> = {
    war: 'The roads are not safe and the caravans have stopped.',
    faction_fallen: 'A compound up the valley has been empty for a season.',
    faction_founded: 'There is new building going on, and nobody will say who for.',
    territory_changed: 'The people collecting the tax are wearing a different colour.',
    resource_contested: 'The road up the gorge is closed to anyone without a token.',
    death: 'A house has been in white for a month.',
    gave_up_waiting: 'Somebody has taken a name off a door.',
    presumed_dead: 'A name has been struck out of a register at the hall.',
    ruin_opened: 'There is a new track up to the old compound.',
    ruin_sealed: 'The way in has been walled and nobody says by whom.',
    technique_lost: 'A formation has stopped working and nobody can restart it.',
    object_destroyed: 'Something that could not be replaced has been broken.',
    zone_forbidden: 'The animals will not go in, and neither will anyone sensible.',
    migration: 'Two of the hamlets on the low road are empty.',
    opportunity: 'Prices have moved and nobody can say why.',
    said_in_public: 'Somebody said something in a full room, and it is still being repeated.',
    catastrophe: 'Something was heard a long way off, and the birds went.',
    spirit_tide: 'For a few days everything was easier, and then it was not.',
    ascension: 'The sky did something people are still arguing about.'
};

function headlineFor(
    lines: readonly DigestLine[],
    unheard: number,
    fromDay: number,
    toDay: number
): string {
    const years = Math.round((toDay - fromDay) / DAYS_PER_YEAR);
    if (lines.length === 0) {
        // Still say how much went past. A player who missed forty things is in
        // a different position from one who missed none, even though neither
        // can name any of them.
        const missed = unheard > 0
            ? ` ${unheard} thing${unheard === 1 ? '' : 's'} did not reach you at all.`
            : '';
        return (years >= 1
            ? `${years} years passed and nothing reached you.`
            : 'Nothing reached you.') + missed;
    }
    const named = lines.filter(l => l.form === 'named').length;
    const vague = lines.length - named;
    return (
        `${years >= 1 ? `${years} years passed. ` : ''}` +
        `${lines.length} thing${lines.length === 1 ? '' : 's'} reached you` +
        `${vague > 0 ? `, ${vague} of them without a name attached` : ''}` +
        `${unheard > 0 ? `. ${unheard} more did not reach you at all` : ''}.`
    );
}

// ─────────────────────────────────────────────────────────────────────────
// COMING OUT AND FINDING WHAT ARRIVED
//
// A digest answers what reached somebody who was THERE. Somebody who sat behind
// a door for twenty years was not, and the machinery for that half was wired
// with no far end: the unheard events go onto `pendingArrivals`, which only ever
// re-entered as an interruption during a LATER sitting. There was no waking up
// to a stack of post. Measured on a one-year sitting: "nothing reached this
// cultivator. 166 event(s) passed unheard."
//
// THE GATE IS STANDING AND NOT DISTANCE, and the zero is the design. A house
// posts its notices, an office generates business that piles up, your own
// disciples write, and a seat is a door somebody can knock on. A rogue alone on
// thin ground has none of those and hears nothing, which is what makes the
// silence mean something rather than read as a defect.
//
// Whether the world happening NEXT to somebody breaks their sitting is a
// different question with a different answer - it is not gated on standing at
// all - and it lives with the encounter window, not here.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What makes somebody a person the world delivers things to.
 *
 * Structural rather than a cultivator, because nothing here is about a
 * cultivator: an NPC elder coming out of a hundred-year sitting is owed exactly
 * the same post and by exactly the same reasoning.
 */
export interface StandingThingsAreSentTo {
    /** On a house's roll at all. */
    inAHouse: boolean;
    /**
     * Where they stand in it. `AuthorityTier` as a string, to avoid the import.
     * Null for somebody on no roll.
     */
    tier: 'ordered' | 'ordering' | 'elder' | 'head' | null;
    /** How many people answer to this name personally. */
    ownFollowing: number;
    /** A place of their own that somebody could come to the door of. */
    hasASeat: boolean;
}

/**
 * Cap on how much one waking hands over.
 *
 * A stack of post is a scene; a newsfeed is an interface. The digest limit above
 * exists for the same reason and this is deliberately smaller than it, because
 * what is being handed over here is the half that did NOT reach them - it is
 * belated by definition, and the belated half should never outweigh the half
 * they actually lived through.
 */
export const MOST_A_WAKING_DELIVERS = 5;

/** What each tier is worth in things somebody bothers to bring you. */
const WHAT_A_RUNG_GENERATES: Readonly<Record<
    NonNullable<StandingThingsAreSentTo['tier']>, number
>> = Object.freeze({
    ordered: 0,
    ordering: 1,
    elder: 2,
    head: 3
});

/**
 * How many things find their way to somebody who was not there to hear them.
 *
 * Zero is the common answer and is not a failure. Each term is a REASON somebody
 * would carry something to this person, so the sum is a count of reasons rather
 * than a score: no reason, no delivery.
 */
export function howMuchWouldBeDeliveredTo(standing: StandingThingsAreSentTo): number {
    let letters = 0;
    // The house posts what it decides, and being on the roll is being told.
    if (standing.inAHouse) letters += 1;
    if (standing.tier !== null) letters += WHAT_A_RUNG_GENERATES[standing.tier];
    // Your own people write, and the second one writing does not double it.
    if (standing.ownFollowing > 0) letters += Math.min(2, standing.ownFollowing);
    // Somebody is at the door once they work out you have woken.
    if (standing.hasASeat) letters += 1;
    return Math.min(MOST_A_WAKING_DELIVERS, letters);
}

/** One thing that was waiting. The shape `arrivableFromUnheard` produces. */
export interface SomethingThatWasWaiting {
    factId: string;
    day: number;
    magnitude: number;
    /** Already attribution-gated. Contains no name they lack a record for. */
    text: string;
}

export interface WhatWasWaiting<F extends SomethingThatWasWaiting> {
    /** What somebody actually brought them, oldest first. */
    delivered: F[];
    /** What is still nobody's business to carry. Stays pending. */
    stillWaiting: F[];
    /** One line per delivered item, in the same order. Never narration. */
    lines: string[];
    /**
     * What was kept and by how much, in one line. Empty when nothing came.
     *
     * The same job `headlineFor` does above: a count of what reached somebody is
     * a fact and it is the one a reader needs before a stack of consequences
     * makes sense. It says a thing was carried and never who felt what about it.
     */
    headline: string;
}

/**
 * Hand over what arrived while somebody was not listening.
 *
 * Chosen biggest first, because what somebody bothers to carry is what mattered,
 * and then SAID oldest first, because that is the order a person reads a stack of
 * post in. The two orders are different on purpose and the tests pin both.
 */
export function whatWasDeliveredWhileTheyWereSitting<F extends SomethingThatWasWaiting>(
    waiting: readonly F[],
    standing: StandingThingsAreSentTo
): WhatWasWaiting<F> {
    const room = howMuchWouldBeDeliveredTo(standing);
    if (room <= 0 || waiting.length === 0) {
        return { delivered: [], stillWaiting: [...waiting], lines: [], headline: '' };
    }

    const taken = [...waiting]
        .sort((a, b) => b.magnitude - a.magnitude || a.day - b.day
            || (a.factId < b.factId ? -1 : 1))
        .slice(0, room);
    const took = new Set(taken.map(f => f.factId));
    const delivered = taken.sort((a, b) => a.day - b.day || (a.factId < b.factId ? -1 : 1));

    return {
        delivered,
        stillWaiting: waiting.filter(f => !took.has(f.factId)),
        // The consequence verbatim. It was authored name-free at the event and
        // gated through `unattributedTextOf` before it ever got here, so framing
        // it again would be this layer writing prose - which the header above
        // says it does not do.
        lines: delivered.map(f => f.text),
        headline: `${delivered.length} thing${delivered.length === 1 ? '' : 's'} had been kept `
            + `for this cultivator while the door was shut, and ${
                waiting.length - delivered.length} had not.`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// BUILDING AN ACCESS FROM A SET
// ─────────────────────────────────────────────────────────────────────────

export interface SimpleAccessInput {
    actorId: string;
    locationId?: string | null;
    visibleLocationIds?: readonly string[];
    factionId?: string | null;
    knownFactionIds?: Iterable<string>;
    knownNpcIds?: Iterable<string>;
    knownPlaceIds?: Iterable<string>;
    confidantIds?: readonly string[];
}

/**
 * A `PlayerAccess` over plain sets.
 *
 * For tests, and for any caller that already has the awareness rows in hand.
 * Production wires the predicates straight to `KnowledgeGate.isAwareOf`, which
 * is the same shape backed by `knowledge_records`.
 */
export function simpleAccess(input: SimpleAccessInput): PlayerAccess {
    const factions = new Set(input.knownFactionIds ?? []);
    const npcs = new Set(input.knownNpcIds ?? []);
    const places = new Set(input.knownPlaceIds ?? []);
    return {
        actorId: input.actorId,
        locationId: input.locationId ?? null,
        visibleLocationIds: input.visibleLocationIds,
        factionId: input.factionId ?? null,
        confidantIds: input.confidantIds,
        knowsFaction: id => factions.has(id),
        knowsNpc: id => npcs.has(id),
        knowsPlace: id => places.has(id)
    };
}

