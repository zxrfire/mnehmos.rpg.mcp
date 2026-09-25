/**
 * A nomination: the instrument for a body that has no door to skip.
 *
 * The sibling of `a-favour-skips-the-admission-bar.ts` and deliberately not a
 * second copy of it. A favour moves an ADMISSION BAR. Two bodies in this world
 * have no bar, because nobody applies to them - people stand there because
 * somebody decided it about them, elsewhere - so there is nothing for a favour
 * to move and the catalog says so in both their entries. What puts somebody
 * there is a nomination, and the two instruments differ in every part:
 *
 *                      a favour                    a nomination
 *   what it moves      a stated bar                nothing. There is no bar
 *   who is asked       somebody high enough        a body the apex listens to
 *   who decides        the house with the bar      the apex, about you, elsewhere
 *   who pays           the asker, in an obligation THE NOMINATOR, and not to you
 *   what a no means    the bar did not move        your name was not in the room
 *
 * THE PRICE, WHICH IS THE HALF THAT IS ACTUALLY DIFFERENT
 * ------------------------------------------------------
 * A favour's price is an obligation the asker carries afterwards, held by the
 * person who was asked. It is paid between the two people in the room.
 *
 * A nomination is paid by the nominator to people who are not in the room, and
 * in two currencies the world already has:
 *
 *   - THE FRIENDSHIP THAT SUPPLIED IT. A house nominates because the apex takes
 *     its names, and it takes its names because the house is under it on good
 *     terms or friendly to it. Spending a name draws on the one thing that makes
 *     another name possible. That is `Parentage.standing` and the relationship
 *     layer, read rather than restated - see {@link howFarANameGoes}.
 *   - THE PEOPLE IT DID NOT GO TO. The seats are counted: the Kiln takes four.
 *     A name that goes up is a name that did not go to somebody who expected it,
 *     and the catalog already records what that leaves - two untraced grievances
 *     in the Buddha Precipice, one of them inherited twice. `blocked_advancement`
 *     is the row the ledger already has for it, and it is held against the
 *     NOMINATOR rather than against the person whose name went up.
 *
 * So: a favour costs you a debt. A nomination costs somebody else a grudge, and
 * the somebody else is the person who said yes to you. That is why it is a
 * harder thing to be given and a stranger thing to be granted.
 *
 * WHAT THIS DOES NOT DECIDE
 * ------------------------
 * Whether they say yes. That is `resolveAttempt` in
 * `an-attempt-to-move-somebody.ts` and it is untouched: this says who could be
 * asked at all, what the ask weighs, and what it would cost them - the things
 * that have to be true before the odds are worth computing. Nothing here rolls.
 *
 * WHAT IS NOT BUILT, SAID PLAINLY RATHER THAN LEFT TO BE FOUND
 * ----------------------------------------------------------
 * {@link aNameGoesUp} writes the rows a granted nomination produces and has no
 * caller. That is a gap and not a decision: being posted is not a state a run
 * can be in - there is no Warden rank a player holds and no term to serve - so
 * there is nothing for a granted nomination to change yet. What would call it is
 * a `request` at a person inside a nominating house coming back `taken`. Routed
 * in OPEN-QUESTIONS.md against the act that would call it.
 *
 * AND NOTHING HERE IS A TABLE. Every list below is derived from the parentage
 * chain, the standing figure and the relationship layer, so a house that changes
 * patrons changes what its name reaches without this file being edited. That is
 * the schism this world already had: one of these two postings has changed
 * apexes once, and a per-house list would have been wrong the day it did.
 */

import {
    COURTS,
    FACTION_PARENTAGE,
    chainToApex,
    getApexInstitution,
    getCourt,
    getParentage
} from '../../data/cultivation/governance-and-water-rights.js';
import { relationshipsOf } from '../../data/cultivation/faction-relationships.js';
import {
    SECTS,
    SECT_ADMISSION,
    getSect
} from '../../data/cultivation/sects.js';
import { thereIsNoDoorAt } from '../../data/cultivation/a-favour-skips-the-admission-bar.js';
import { rankName } from '../cultivation/realms.js';
import type { DayIndex } from '../social/common.js';
import { createGrudge, type ObligationRecord } from '../social/grudges.js';
import type { KnowledgeInput } from '../social/knowledge.js';
import {
    whatTheyWillTakeFor,
    type WhatTheyWillTake
} from './what-they-will-take-instead-of-money.js';
import type { AskWeight } from './an-attempt-to-move-somebody.js';

// ─────────────────────────────────────────────────────────────────────────
// THE POSTINGS THEMSELVES
// ─────────────────────────────────────────────────────────────────────────

/**
 * What being asked for a nomination costs the body that gives one.
 *
 * `against_their_interest` and not `a_real_favour`: the seats are counted, so a
 * name spent on you is a name not spent on somebody the house would rather have
 * placed, and the nominator can see that clearly while agreeing to it. That is
 * the definition of the rung, and it is the reason coin is not the medium here -
 * `PURSE_REACH` puts this weight at the cash line and `whatTheyWillTakeFor`
 * reads it off the same number.
 */
export const A_NOMINATION_WEIGHS: AskWeight = 'against_their_interest';

/**
 * One posting, and what standing there in fact requires.
 *
 * `theWorkRequires` is NOT a bar and must never be described as one. It is the
 * lowest rung anybody is actually standing on - read off the roster where there
 * is one, and off the body's own stated figure where the only thing the catalog
 * carries is a number. The distinction is the whole of what makes this a
 * posting: a bar is a thing you clear, and this is a thing the work needs, which
 * is why nobody is ever refused on it and nobody is ever admitted by meeting it.
 */
export interface APosting {
    bodyId: string;
    bodyName: string;
    /** The apex that appoints into it, today. One of these has changed once. */
    appointingApexId: string;
    appointingApexName: string;
    /** The lowest rung anybody posted here in fact stands on. */
    theWorkRequires: number;
    /**
     * How many people stand there, where the catalog says. Null where it does
     * not - and a null is a fact about the record rather than an empty body.
     */
    seats: number | null;
}

/** What the roster says, where there is one. */
function rosterFloorOf(bodyId: string): { floor: number; seats: number } | null {
    const court = getCourt(bodyId);
    if (!court || court.roster.length === 0) return null;
    return {
        floor: court.roster.reduce((low, o) => Math.min(low, o.realmOrdinal), Infinity),
        seats: court.roster.length
    };
}

/** What the body's own row says, where it has one. */
function statedFloorOf(bodyId: string): number | null {
    const sect = getSect(bodyId);
    if (!sect) return null;
    return SECT_ADMISSION[bodyId]?.minOrdinal ?? sect.admissionOrdinal;
}

function nameOfBody(id: string): string {
    return getSect(id)?.name ?? getCourt(id)?.name ?? getApexInstitution(id)?.name ?? id;
}

/**
 * The apex that appoints into this body.
 *
 * A court says so on its own row; a body that is a posting without being a court
 * says so through its parentage. Both are one field, read in the two places the
 * catalog keeps them, and neither is restated here.
 */
function appointingApexOf(bodyId: string): string | null {
    const court = getCourt(bodyId);
    if (court) return court.apexId;
    const parentage = getParentage(bodyId);
    if (parentage?.parentFactionId && getApexInstitution(parentage.parentFactionId)) {
        return parentage.parentFactionId;
    }
    return null;
}

/**
 * Every body somebody is posted into rather than admitted to.
 *
 * Derived from `thereIsNoDoorAt`, which is the field that already carries the
 * distinction, rather than from a list of two ids - a third posting appearing in
 * the catalog is a fact about the catalog and not a change to this module.
 */
export function thePostings(): APosting[] {
    const ids = new Set<string>([
        ...COURTS.map(c => c.id),
        ...Object.keys(FACTION_PARENTAGE),
        ...SECTS.map(s => s.id)
    ]);
    const out: APosting[] = [];
    for (const id of ids) {
        if (!thereIsNoDoorAt(id) && !postingRecordOf(id)) continue;
        const apexId = appointingApexOf(id);
        if (apexId === null) continue;
        const roster = rosterFloorOf(id);
        const stated = statedFloorOf(id);
        const requires = roster?.floor ?? stated;
        if (requires === null || requires === undefined) continue;
        out.push({
            bodyId: id,
            bodyName: nameOfBody(id),
            appointingApexId: apexId,
            appointingApexName: nameOfBody(apexId),
            theWorkRequires: requires,
            seats: roster?.seats ?? null
        });
    }
    return out.sort((a, b) => a.bodyId.localeCompare(b.bodyId));
}

/** The `posting` block, wherever the catalog keeps it for this body. */
function postingRecordOf(bodyId: string): unknown {
    return getCourt(bodyId)?.posting ?? getParentage(bodyId)?.posting ?? null;
}

export function thePostingAt(bodyId: string): APosting | undefined {
    return thePostings().find(p => p.bodyId === bodyId);
}

// ─────────────────────────────────────────────────────────────────────────
// WHOSE NAME IS TAKEN
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far a name goes, which is a fact about whose mouth it comes out of.
 *
 * Five answers and the first is not a nomination at all: an apex appointing into
 * its own posting is doing the thing a nomination is asking it to do, and
 * collapsing the two would make the apex a body you could petition for a favour,
 * which is the exact confusion this instrument exists to undo.
 */
export type HowFarAName =
    /** The apex's own. It is an appointment, and nobody nominated anybody. */
    | 'it is an appointment, not a nomination'
    /** The body holding the posting, naming into its own roll. Never declined. */
    | 'never declined'
    /** A house the apex takes names from. Read, and often enough taken. */
    | 'read'
    /** Read, and owed no answer: the friendship is thinner or is in arrears. */
    | 'read, and they are owed no answer'
    /** No standing with the apex at all. There is nothing to put a name on. */
    | 'nothing to put up';

const HOW_FAR_ORDER: readonly HowFarAName[] = [
    'it is an appointment, not a nomination',
    'never declined',
    'read',
    'read, and they are owed no answer',
    'nothing to put up'
];

export interface CanPutANameUp {
    nominatorId: string;
    nominatorName: string;
    intoBodyId: string;
    howFar: HowFarAName;
    /** Why this body's name carries what it carries, in the world's terms. */
    why: string;
}

/**
 * Whether this body's names are taken by this apex, and how far they go.
 *
 * THE ONE PLACE THE ANSWER IS DECIDED, and everything else in this file asks it.
 * Three readings, in order, and all three are off fields that already exist:
 *
 *   1. The apex itself, and the posting naming into its own roll. Both are
 *      structural - `appointingApexOf` for the first, the body carrying a
 *      `posting` block under that same apex for the second.
 *   2. Under the apex: `chainToApex` contains it. How far the name goes is then
 *      `Parentage.standing`, which is the figure the catalog already keeps for
 *      exactly this - what terms a body is on with the house above it.
 *   3. Not under it but friendly to it: a relationship with the apex at `warm`
 *      or `civil`. The catalog's own sentence is "a sect under it or friendly to
 *      it", and this is the second half of it read off the relationship layer.
 *
 * An apex is never a nominator to another apex's posting. The catalog says SECT
 * both times it states this rule, and an apex putting a name into a peer's
 * posting is not a nomination, it is a negotiation between two apexes and has
 * nothing to do with this instrument.
 */
export function howFarANameGoes(nominatorId: string, intoBodyId: string): HowFarAName {
    const posting = thePostingAt(intoBodyId);
    if (!posting) return 'nothing to put up';

    if (nominatorId === posting.appointingApexId) return 'it is an appointment, not a nomination';

    // The body naming into its own roll. This is the Deeproot Court's whole
    // influence and the catalog states the consequence directly: the Course
    // Keepers have never once declined one of its names.
    if (nominatorId === intoBodyId) return 'never declined';

    // An apex does not nominate into somebody else's posting.
    if (getApexInstitution(nominatorId)) return 'nothing to put up';

    if (chainToApex(nominatorId).includes(posting.appointingApexId)) {
        switch (getParentage(nominatorId)?.standing) {
            case 'good':
            case 'not_applicable':
                return 'read';
            case 'strained':
            case 'probationary':
                return 'read, and they are owed no answer';
            // A lapsed grant is a house the apex has stopped answering. There
            // is no friendship left to spend and the name goes nowhere.
            case 'lapsed':
                return 'nothing to put up';
            default:
                return 'read, and they are owed no answer';
        }
    }

    const toward = relationshipsOf(nominatorId)
        .find(r => r.otherId === posting.appointingApexId);
    if (toward && (toward.warmth === 'warm' || toward.warmth === 'civil')) {
        // Friendly, and holding nothing from them. The names are read because
        // the friendship is worth keeping, and nothing is owed in either
        // direction - which is exactly what makes the friendship worth keeping.
        return 'read, and they are owed no answer';
    }

    return 'nothing to put up';
}

const WHY: Readonly<Record<HowFarAName, string>> = Object.freeze({
    'it is an appointment, not a nomination':
        'It appoints into this posting. Asking it to nominate somebody is asking it to do the '
        + 'thing itself, and it does not need anybody to put a name in front of it.',
    'never declined':
        'It holds the posting. A name put up from inside the roll goes under nine hundred years '
        + 'of names, and the apex has never declined one.',
    read:
        'It holds from the apex on good terms, and a house on good terms has its names taken. '
        + 'That is what being friendly to an apex is actually worth, and it is why it is kept up.',
    'read, and they are owed no answer':
        'Its name is read and nothing obliges anybody to act on it. A body in arrears, on '
        + 'probation, or friendly without holding anything can put a name forward and has no '
        + 'standing to ask twice.',
    'nothing to put up':
        'The apex does not take names from it. There is no arrangement between them for one to '
        + 'travel along, so what would be sent is a letter rather than a nomination.'
});

/**
 * Every body whose name this posting's apex would read, strongest first.
 */
export function whoCouldNominateInto(intoBodyId: string): CanPutANameUp[] {
    const posting = thePostingAt(intoBodyId);
    if (!posting) return [];

    const candidates = new Set<string>([
        posting.appointingApexId,
        intoBodyId,
        ...SECTS.map(s => s.id),
        ...COURTS.map(c => c.id),
        ...Object.keys(FACTION_PARENTAGE)
    ]);

    const out: CanPutANameUp[] = [];
    for (const id of candidates) {
        const howFar = howFarANameGoes(id, intoBodyId);
        if (howFar === 'nothing to put up') continue;
        out.push({
            nominatorId: id,
            nominatorName: nameOfBody(id),
            intoBodyId,
            howFar,
            why: WHY[howFar]
        });
    }
    return out.sort((a, b) =>
        HOW_FAR_ORDER.indexOf(a.howFar) - HOW_FAR_ORDER.indexOf(b.howFar)
        || a.nominatorName.localeCompare(b.nominatorName));
}

/**
 * The same read backwards: what one house's name reaches.
 *
 * Every read runs both ways. `whoCouldNominateInto` answers "given a posting,
 * whose names are taken"; a house standing in a province wants the other one,
 * and so does a player deciding who to go and ask. Filtered through
 * {@link howFarANameGoes} rather than rebuilt, so the two cannot disagree.
 */
export function whatThisHousesNameReaches(factionId: string): CanPutANameUp[] {
    return thePostings()
        .map(p => ({ posting: p, howFar: howFarANameGoes(factionId, p.bodyId) }))
        .filter(x => x.howFar !== 'nothing to put up')
        .map(x => ({
            nominatorId: factionId,
            nominatorName: nameOfBody(factionId),
            intoBodyId: x.posting.bodyId,
            howFar: x.howFar,
            why: WHY[x.howFar]
        }));
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT WOULD TAKE, AND WHERE IT DOES NOT REACH
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why no nomination reaches, when none does.
 *
 * Refusals are data, and each of these names a road rather than closing one -
 * the precedent file's discipline, and the reason it is worth copying is that
 * two of these five are about the ASKER and three are about the arrangement, and
 * a player is entitled to know which.
 */
export type NoNominationReaches =
    /** Not a posting. There is a door there and a favour is the instrument. */
    | 'there is a door there'
    /** The catalog has never heard of this body. */
    | 'no such body'
    /** This house's names are not read by that apex. */
    | 'they have no name to put up here'
    /** The asker is below what the work in fact requires, by some rungs. */
    | 'the work stands further up than they do';

export interface WhatANominationWouldTake {
    intoBodyId: string;
    intoBodyName: string;
    nominatorId: string;
    nominatorName: string;
    howFar: HowFarAName;
    /** What the ask costs the body giving it. Never `a_courtesy`. */
    weighs: AskWeight;
    /**
     * What the person carrying it will take for carrying it, read off the
     * ladder the world already prices asks on. Never `stones` at this weight,
     * which is the point: a posting is not bought.
     */
    theyWillTake: WhatTheyWillTake;
    /** The lowest rung anybody standing there holds. Not a bar. */
    theWorkRequires: number;
    /** How far under it the asker is. Zero or less where they are not. */
    rungsShort: number;
    /** What this costs the nominator, said once, in the world's terms. */
    andWhatItCostsThem: string;
}

export interface ANominationIsAsked {
    askerId: string;
    askerOrdinal: number;
    /** The house being asked to put the name up. */
    nominatorId: string;
    /** The person in that house who would actually carry it. */
    askedOfId: string;
    /** The posting. */
    intoBodyId: string;
    /**
     * An open need of the person asked that the asker could serve, which is the
     * one thing that turns a price into a service. Passed through to
     * `whatTheyWillTakeFor` unchanged rather than decided here.
     */
    theyNeedSomethingDone?: boolean;
}

/**
 * What this nomination would take, or why none reaches.
 *
 * Decides nothing about the answer. What it settles is whether there is an ask
 * to make at all, what it weighs, and what the body giving it would be spending -
 * so a caller can hand `resolveAttempt` an ask it has no business inventing, and
 * can hand a narrator a refusal that names the road instead of the wall.
 */
export function whatANominationWouldTake(
    input: ANominationIsAsked
): WhatANominationWouldTake | NoNominationReaches {
    const posting = thePostingAt(input.intoBodyId);
    if (!posting) {
        const known = getSect(input.intoBodyId)
            ?? getCourt(input.intoBodyId)
            ?? getApexInstitution(input.intoBodyId);
        // A house with a door is not a thing anybody nominates into, and the
        // honest answer points at the other instrument rather than refusing
        // twice. This is the inverse read of the precedent file and it is the
        // half a player actually asks for: they say "nominate me" at a sect.
        return known ? 'there is a door there' : 'no such body';
    }

    const howFar = howFarANameGoes(input.nominatorId, input.intoBodyId);
    if (howFar === 'nothing to put up') return 'they have no name to put up here';

    const rungsShort = posting.theWorkRequires - input.askerOrdinal;
    if (rungsShort > 0) return 'the work stands further up than they do';

    return {
        intoBodyId: posting.bodyId,
        intoBodyName: posting.bodyName,
        nominatorId: input.nominatorId,
        nominatorName: nameOfBody(input.nominatorId),
        howFar,
        weighs: A_NOMINATION_WEIGHS,
        theyWillTake: whatTheyWillTakeFor(input.askedOfId, {
            ask: A_NOMINATION_WEIGHS,
            // A posting has no price on a board anywhere, and no figure is the
            // honest answer for it rather than a large one.
            hasACashPrice: false,
            theyNeedSomethingDone: input.theyNeedSomethingDone ?? false
        }),
        theWorkRequires: posting.theWorkRequires,
        rungsShort: 0,
        andWhatItCostsThem: costsThemLine(posting, howFar)
    };
}

function costsThemLine(posting: APosting, howFar: HowFarAName): string {
    if (howFar === 'it is an appointment, not a nomination') {
        return `${posting.appointingApexName} spends nothing. It is the body that appoints, and `
            + 'what it would be doing is the appointment itself.';
    }
    const seats = posting.seats === null
        ? 'The seats are counted'
        : `There are ${posting.seats} of these seats`;
    return `${seats}, so a name that goes up is a name that did not go to somebody who expected `
        + `it, and that is held against the house that put it up rather than against the person `
        + `whose name it was. And the friendship with ${posting.appointingApexName} is what makes `
        + 'a name readable at all - it is drawn on here and is not replaced by anything that '
        + 'happens afterwards.';
}

/**
 * How far short the asker is, said as rungs and as the two rung names.
 *
 * WHAT A PLAYER IS OWED WHEN THE ANSWER IS NO. A refusal that says only "not
 * you" is the empty board this repo keeps finding: the distance is a real fact
 * about a real ladder, the ladder is climbable, and saying the number is the
 * difference between a road and a wall. It is deliberately not softened - a
 * player at the bottom of the ladder is twenty-odd rungs under the lowest person
 * standing at either of these gates, and pretending otherwise would be the
 * engine having an opinion about what they deserve.
 */
export function howFarShortOfThePosting(
    intoBodyId: string,
    askerOrdinal: number
): { rungsShort: number; theyStandAt: string; theWorkStandsAt: string } | undefined {
    const posting = thePostingAt(intoBodyId);
    if (!posting) return undefined;
    return {
        rungsShort: Math.max(0, posting.theWorkRequires - askerOrdinal),
        theyStandAt: rankName(askerOrdinal),
        theWorkStandsAt: rankName(posting.theWorkRequires)
    };
}

/**
 * What would actually put this reader there, said to somebody who cannot be.
 *
 * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING NOTHING.
 * The board already tells a reader that a nomination is the road; a road with no
 * names on it is a wall with better manners. This is the half that makes it a
 * road: how far off the work stands, which bodies the apex takes names from, and
 * whether the reader's own house is one of them.
 *
 * `namesTheReaderKnows` is a filter and never a gate on the first two facts. A
 * caller that knows what this person has been told passes it and the houses they
 * have never heard of are left out; a caller that does not pass nothing and gets
 * the arrangement as the province knows it. Either way the DISTANCE is always
 * said, because it is a fact about the reader rather than about anybody else.
 */
export function whatWouldPutYouThere(input: {
    intoBodyId: string;
    readerOrdinal: number;
    /** The reader's own house, where they serve one. */
    readerHouseId?: string | null;
    /** Faction ids this reader has been told about. Undefined means no filter. */
    namesTheReaderKnows?: readonly string[];
}): string[] {
    const posting = thePostingAt(input.intoBodyId);
    if (!posting) return [];

    const out: string[] = [];

    const short = howFarShortOfThePosting(posting.bodyId, input.readerOrdinal)?.rungsShort ?? 0;
    out.push(short > 0
        ? `The lowest rung anybody posted there in fact stands on is `
          + `${rankName(posting.theWorkRequires)}. You are at ${rankName(input.readerOrdinal)}, `
          + `which is ${short} rung${short === 1 ? '' : 's'} under it. That is not a bar - there `
          + 'is no bar - it is what the work needs, and a name that far under the work is not a '
          + 'name anybody is choosing between.'
        : `You stand at ${rankName(input.readerOrdinal)}, and the lowest rung anybody posted `
          + `there holds is ${rankName(posting.theWorkRequires)}. The distance is not what is `
          + 'between you and it.');

    const carriers = whoCouldNominateInto(posting.bodyId)
        .filter(c => c.howFar !== 'it is an appointment, not a nomination');
    const known = input.namesTheReaderKnows === undefined
        ? carriers
        : carriers.filter(c => input.namesTheReaderKnows?.includes(c.nominatorId));

    if (known.length === 0) {
        out.push(`${posting.appointingApexName} appoints into it, and takes names from houses `
            + 'under it and friendly to it. Which houses those are is not something you have been '
            + 'told.');
    } else {
        out.push(`${posting.appointingApexName} appoints into it, and the bodies whose names it `
            + `reads are ${known.map(c => c.nominatorName).join(', ')}. One of those putting your `
            + 'name up is the whole of the road, and there is no second one.');
    }

    const mine = input.readerHouseId
        ? carriers.find(c => c.nominatorId === input.readerHouseId)
        : undefined;
    if (mine) {
        out.push(`Your own house is one of them: a name from ${mine.nominatorName} is `
            + `${mine.howFar}. ${mine.why}`);
    } else if (input.readerHouseId) {
        out.push(`${nameOfBody(input.readerHouseId)} is not one of them, so serving it further is `
            + 'not a road to this. Standing with a house whose names are read is.');
    }

    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A NAME GOING UP LEAVES BEHIND
// ─────────────────────────────────────────────────────────────────────────

export interface ANameWentUp {
    intoBodyId: string;
    nominatorId: string;
    askerId: string;
    howFar: HowFarAName;
    /**
     * The price, and the whole of what makes this instrument different from a
     * favour: it is a GRUDGE rather than a debt, it is held by somebody who was
     * not in the room, and its subject is the nominator and not the nominee.
     *
     * Null where the caller named nobody who expected the seat, which is a fact
     * about what the caller knows rather than a claim that nobody did.
     */
    whatItCostThem: ObligationRecord | null;
    /** Who is told. The person asked, and the person passed over. */
    told: KnowledgeInput[];
}

export interface ANameGoesUpInput {
    askerId: string;
    nominatorId: string;
    intoBodyId: string;
    /** The person in the nominating house who carried it. */
    askedOfId: string;
    onDay: DayIndex;
    /**
     * Somebody in the nominating house who expected the seat. The catalog's own
     * account of these postings is that being passed over happens far more often
     * than being chosen, and that the grievance is specific, dated and
     * inheritable - which is exactly what an obligation row is for.
     */
    passedOverId?: string;
    /** What was actually said. Narrator prose, never parsed. */
    note?: string;
}

/**
 * The rows one nomination produces, for the ledgers that own them.
 *
 * Writes nothing. The counterpart of `spendAWord`, and the differences are the
 * design: no `createFavor`, because nothing is owed to the nominator by the
 * person whose name went up; no `client` tie, because a nomination is not
 * patronage of a person; and a `blocked_advancement` grudge whose SUBJECT is the
 * house that nominated, held by whoever was passed over.
 */
export function aNameGoesUp(input: ANameGoesUpInput): ANameWentUp | NoNominationReaches {
    const posting = thePostingAt(input.intoBodyId);
    if (!posting) return 'no such body';

    const howFar = howFarANameGoes(input.nominatorId, input.intoBodyId);
    if (howFar === 'nothing to put up') return 'they have no name to put up here';

    const description = input.note
        ?? `${input.askerId} was put forward for ${posting.bodyName} by ${input.nominatorId}, `
        + 'and the seat went to them.';

    const whatItCostThem = input.passedOverId
        ? createGrudge({
            holderId: input.passedOverId,
            // THE NOMINATOR, not the person who got the seat. Somebody passed
            // over holds it against whoever chose, and the catalog says the
            // reason plainly: there is never an explanation given to any of
            // them, so there is nothing to hold against the appointee except
            // that they went.
            subjectId: input.nominatorId,
            cause: 'blocked_advancement',
            severity: 'serious',
            onDay: input.onDay,
            description,
            participants: [input.askerId, posting.bodyId],
            tags: ['nomination', `posting:${posting.bodyId}`],
            terms: null,
            dueOnDay: null
        })
        : null;

    const told: KnowledgeInput[] = [
        {
            holderId: input.askedOfId,
            holderKind: 'character',
            claimKey: `nomination:${input.askerId}`,
            stance: 'knows',
            statement: description,
            onDay: input.onDay,
            source: { kind: 'witnessed', note: 'Carried the name.' },
            detail: {
                intoBodyId: posting.bodyId,
                nominatorId: input.nominatorId,
                howFar
            },
            confidence: 1,
            tags: ['nomination']
        }
    ];
    if (input.passedOverId) {
        told.push({
            holderId: input.passedOverId,
            holderKind: 'character',
            claimKey: `nomination:${input.askerId}`,
            stance: 'knows',
            // What a passed-over candidate in fact knows is that somebody else
            // went, and nothing else. No explanation is ever given, which is
            // what makes the grievance keep.
            statement: `The seat at ${posting.bodyName} went to ${input.askerId}. No reason was `
                + 'given, and none was going to be.',
            onDay: input.onDay,
            source: { kind: 'told', note: 'Heard whose name went up.' },
            detail: { intoBodyId: posting.bodyId, nominatorId: input.nominatorId },
            confidence: 1,
            tags: ['nomination', 'passed_over']
        });
    }

    return {
        intoBodyId: posting.bodyId,
        nominatorId: input.nominatorId,
        askerId: input.askerId,
        howFar,
        whatItCostThem,
        told
    };
}

/** Whether a call to {@link aNameGoesUp} came back with a nomination. */
export function aNameWasPutUp(result: ANameWentUp | NoNominationReaches): result is ANameWentUp {
    return typeof result !== 'string';
}
