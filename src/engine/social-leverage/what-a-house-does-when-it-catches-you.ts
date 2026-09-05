/**
 * What a house does about somebody it has caught, once it can put a name to them.
 * Almost nothing here is new: `canPointAt` decides who has a name, `whatItWasWorth`
 * decides how heavy it was, `regardFor` decides how far apart they stand, `Reach`
 * decides where it goes, and every crippling is a `brokenStatusFor` status that
 * already exists. What this file adds is THE ORDER THE THREE QUESTIONS ARE ASKED
 * IN.
 */

import type { InjurySeverity, SectAlignment } from '../../schema/cultivation.js';
import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { brokenStatusFor } from '../cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { REGARD_BAND_ORDER, regardFor } from '../cultivation/regard.js';
import type { RegardBand } from '../../schema/cultivation.js';
import { canPointAt, type KnowingStage } from '../social/discovery.js';
import type { DayIndex } from '../social/common.js';
import { DAYS_PER_YEAR } from '../social/common.js';
import type { ObligationInput, Severity } from '../social/grudges.js';
import {
    WHAT_THE_END_OF_A_TERM_LEAVES,
    WHY_AN_INDENTURE_IS_TAKEN,
    isHeldWithoutEnd,
    termOfYearsFor,
    theOathwrightWouldWitnessFor,
    THE_OATHWRIGHT_HOUSE,
    tooLightToBeWorthTaking
} from '../../data/cultivation/what-an-indenture-is-and-what-happens-when-it-ends.js';
import { whatItWasWorth, type Deed, type Party, type Reach } from './what-a-deed-leaves.js';

/**
 * What the offender's house is worth to them, on this question only. Three values
 * and not a boolean because the middle one is the interesting position: somebody
 * nominally attached who cannot claim the protection is in the worst place of
 * anybody, visible enough to be worth a reprisal and unbacked enough to receive it
 * in person.
 */
export type Backing =
    /** Nobody answers for them. A rogue, and most of the player's peers. */
    | 'none'
    /** On a roll, and the house would not put its weight behind them. */
    | 'unclaimable'
    /** A house that would have to be dealt with before they are. */
    | 'backed';

/** Whether the party that wants to act has anything that can be made to pay. */
export interface SomethingToLose {
    /** The house that would carry the cost of what they do. Null for a rogue. */
    houseId: string | null;
    /**
     * They no longer care what it costs. A VARIABLE, not a status: it can be
     * true of an elder in good standing, who then reads as backed right up until
     * they act.
     */
    hasStoppedCaring?: boolean;
}

export function hasSomethingToLose(them: SomethingToLose): boolean {
    return them.houseId !== null && them.hasStoppedCaring !== true;
}

export type WhetherActingIsAvailable =
    /** Nothing about acting can be made to cost them. It lands on the person. */
    | 'they_can_act'
    /** It would cost them. The matter goes over the offender's head instead. */
    | 'it_goes_to_your_house';

/**
 * The first question, and it can remove the other two. NO RUNG APPEARS HERE:
 * this is not about who would win, and the strongest elder in the province
 * cannot act if their house would have to answer for it.
 */
export function canTheyBeMadeToPayForActing(input: {
    /** The party that has been wronged and wants to do something about it. */
    aggrieved: SomethingToLose;
    /** What the offender's house is worth to them. */
    backing: Backing;
}): WhetherActingIsAvailable {
    if (!hasSomethingToLose(input.aggrieved)) return 'they_can_act';
    return input.backing === 'backed' ? 'it_goes_to_your_house' : 'they_can_act';
}

/** The `Reach` this answer implies, in the ledger's own word for it. */
export function reachFor(available: WhetherActingIsAvailable): Reach {
    return available === 'it_goes_to_your_house' ? 'answerable' : 'unbacked';
}

/**
 * The small facts that make somebody worth spending something on. DERIVED AND
 * NOT A SCORE: anything richer than three counted booleans becomes a second
 * measure of a person beside the ladder, and the ladder is the measure.
 */
export interface WhatMakesThemWorthIt {
    /** They hold a thing the house wants: an object, a book, a name. */
    holdsSomethingWanted?: boolean;
    /** Their root or their rate is worth years of somebody's attention. */
    promising?: boolean;
    /** Somebody would ask after them: kin, a master, a house that would write. */
    wouldBeMissed?: boolean;
}

export function countsInTheirFavour(worth: WhatMakesThemWorthIt): number {
    return (worth.holdsSomethingWanted ? 1 : 0)
        + (worth.promising ? 1 : 0)
        + (worth.wouldBeMissed ? 1 : 0);
}

export type WhetherToBother =
    /** They stand above what this house could answer. Nothing is mounted. */
    | 'beyond_them'
    /** Not worth the rice. CONTEMPT rather than leniency, and a real outcome. */
    | 'beneath_notice'
    /** Worth answering. Axis 3 decides what kind of answer. */
    | 'worth_mounting';

/**
 * The band the house reads the offender at. ARGUMENT ORDER MATTERS:
 * `regardFor(gate, asker)` computes `asker - gate`, so the house goes in as the
 * asker and the offender as the gate, and the gap is how far the house stands
 * ABOVE the person it caught.
 */
export function howTheHouseReadsYou(input: {
    theirOrdinal: number;
    yourOrdinal: number;
}): RegardBand {
    return regardFor(input.yourOrdinal, input.theirOrdinal).band;
}

/**
 * Worth steps the band toward `matched` and NEVER PAST IT. Being worth something
 * makes a house look harder at somebody far below it; it does not make somebody
 * standing above the house into a smaller problem.
 */
export function bandAfterWorth(band: RegardBand, worthCount: number): RegardBand {
    const matched = REGARD_BAND_ORDER.indexOf('matched');
    const at = REGARD_BAND_ORDER.indexOf(band);
    if (at < 0 || at <= matched) return band;
    return REGARD_BAND_ORDER[Math.max(matched, at - Math.max(0, worthCount))] ?? band;
}

/**
 * The second question. The owner's calibration, which the existing band windows
 * already land on with nothing chosen to produce it: a Core Formation cultivator
 * who offends a Void Refinement elder reads `beneath` and is worth answering; a
 * Qi Condensation nobody reads `dismissed` and is not.
 */
export function whetherYouAreWorthTheTrouble(input: {
    theirOrdinal: number;
    yourOrdinal: number;
    worth?: WhatMakesThemWorthIt;
}): WhetherToBother {
    const raw = howTheHouseReadsYou(input);
    const band = bandAfterWorth(raw, countsInTheirFavour(input.worth ?? {}));
    if (band === 'unreachable' || band === 'overmatched') return 'beyond_them';
    if (band === 'dismissed') return 'beneath_notice';
    return 'worth_mounting';
}

/**
 * The structure this cultivator has built that could be broken. Derived with no
 * table of its own: the broken status of their most recent crossing.
 */
export function theStructureTheyHave(ordinal: number): string | null {
    const realm = realmForOrdinal(ordinal);
    if (realm.ordinalStart <= REALM_TIERS[0].ordinalStart) return null;
    return brokenStatusFor(realm.ordinalStart - 1);
}

export type WhatIsTaken =
    | 'nothing'
    /** An indenture. A term of years, or none, and always somebody's life. */
    | 'the years'
    /** The capability. What they climbed, removed, and it does not come back. */
    | 'the capability';

/**
 * What a house takes, once it has decided the person is worth answering. NOT
 * KEYED ON ALIGNMENT - both answers are available to every house, and which one
 * lands is an investment question: somebody worth keeping costs years of
 * feeding and watching, somebody not costs one afternoon.
 */
export function whatTheHouseTakes(input: {
    weight: Severity;
    worth?: WhatMakesThemWorthIt;
    /** Their rung, for whether there is a structure to break. */
    yourOrdinal: number;
}): WhatIsTaken {
    const worth = input.worth ?? {};
    const worthKeeping = Boolean(worth.promising || worth.holdsSomethingWanted);
    if (worthKeeping && !tooLightToBeWorthTaking(input.weight)) return 'the years';
    return theStructureTheyHave(input.yourOrdinal) === null ? 'nothing' : 'the capability';
}

/** The crippling, as the row it already is. */
export interface TheCapabilityTaken {
    /** A key in `WOUND_TYPES`. Permanent, and already carries its own cure. */
    woundKey: string;
    severity: InjurySeverity;
    line: string;
}

/** The indenture, as the contract shape the ledger already has. */
export interface TheYearsTaken {
    /** The oath to write. Held by the person bound, about the house. */
    oath: ObligationInput;
    /** Years, or null where the house writes no end into it. */
    termYears: number | null;
    /** The day it is discharged, or null where there is none. */
    dueOnDay: number | null;
    /** The house that would witness it, or null where the premier one will not. */
    witnessFactionId: string | null;
    /** The house's own word for what the years are for. Never a euphemism. */
    theHousesWord: string;
    /** What the day it ends leaves, which is answered rather than left open. */
    whenItEnds: string;
}

export interface WhatTheHouseDoes {
    /** Whether anybody can put a name to it. Nothing below runs if this is empty. */
    knownTo: readonly string[];
    acting: WhetherActingIsAvailable;
    /** `answerable` where it went over your head, `unbacked` where it did not. */
    reach: Reach;
    /** The house the complaint was handed to, or null. */
    redirectedTo: string | null;
    bother: WhetherToBother;
    /** What the deed was worth, from the one scoring function. */
    weight: Severity;
    takes: WhatIsTaken;
    cripples: TheCapabilityTaken | null;
    indenture: TheYearsTaken | null;
    /**
     * The reprisal itself, as a deed. Hand it to `whatADeedLeaves` and the loop
     * closes: a reprisal can be answered, and nothing had to be written to make
     * that true.
     */
    theReprisalAsADeed: Deed | null;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What the house does. `stages` is SUPPLIED, never derived - the knowledge layer
 * writes them and `stageCeilingFor` caps what each source can deliver. Anybody
 * absent is `unaware`, and if nobody has reached `placed` nothing below runs,
 * because there is no name to hold anything against.
 */
export function whatTheHouseDoesAboutIt(input: {
    deed: Deed;
    /** The person who did it. */
    offender: Party;
    /** The house or elder answering, and what it would cost them to act. */
    answering: Party & SomethingToLose;
    /** What the offender's house is worth to them on this question. */
    backing: Backing;
    /** Where each party stands on the ladder of knowing about this deed. */
    stages: ReadonlyMap<string, KnowingStage>;
    /** The answering party's rung. */
    theirOrdinal: number;
    /** The offender's rung. */
    yourOrdinal: number;
    worth?: WhatMakesThemWorthIt;
    onDay: DayIndex;
}): WhatTheHouseDoes {
    const knownTo: string[] = [];
    for (const [id, stage] of input.stages) if (canPointAt(stage)) knownTo.push(id);

    const weight = whatItWasWorth(input.deed);
    const acting = canTheyBeMadeToPayForActing({
        aggrieved: input.answering,
        backing: input.backing
    });
    const reach = reachFor(acting);

    const nothing = (line: string): WhatTheHouseDoes => ({
        knownTo,
        acting,
        reach,
        redirectedTo: acting === 'it_goes_to_your_house' ? input.offender.houseId : null,
        bother: 'beneath_notice',
        weight,
        takes: 'nothing',
        cripples: null,
        indenture: null,
        theReprisalAsADeed: null,
        line
    });

    if (knownTo.length === 0) {
        return {
            ...nothing(
                'Nobody can put a name to it. Something certainly happened and there is no '
                + 'account open, because there is nobody for one to be against.'
            ),
            bother: 'beneath_notice'
        };
    }

    if (acting === 'it_goes_to_your_house') {
        return {
            ...nothing(
                `${input.answering.name} does not lay a hand on ${input.offender.name}. Doing so `
                + `would start something ${input.answering.houseName ?? 'their house'} would have `
                + `to pay for, and they are not authorised to start it. The matter is put to `
                + `${input.offender.houseName ?? 'the house they answer to'} instead, over their `
                + 'head, and what happens to them now is that house\'s decision and not this one\'s.'
            ),
            bother: 'worth_mounting'
        };
    }

    const bother = whetherYouAreWorthTheTrouble({
        theirOrdinal: input.theirOrdinal,
        yourOrdinal: input.yourOrdinal,
        ...(input.worth ? { worth: input.worth } : {})
    });

    if (bother === 'beyond_them') {
        return {
            ...nothing(
                `${input.offender.name} stands where nothing ${input.answering.name} could do `
                + 'about it would reach. There is a record and there is no reprisal.'
            ),
            bother
        };
    }
    if (bother === 'beneath_notice') {
        return {
            ...nothing(
                `${input.offender.name} is not worth the rice. Feeding and watching them for `
                + 'years buys nothing, and going out to take something off them buys less. '
                + 'Whoever is standing there may put them out where they stand, and that is the '
                + 'whole of it - not mercy, and they are meant to be able to tell the difference.'
            ),
            bother
        };
    }

    const alignment = input.answering.alignment;
    const wanted = whatTheHouseTakes({
        weight,
        yourOrdinal: input.yourOrdinal,
        ...(input.worth ? { worth: input.worth } : {})
    });

    const indenture = wanted === 'the years'
        ? theYearsTaken({
            alignment,
            weight,
            offender: input.offender,
            houseId: input.answering.houseId,
            houseName: input.answering.houseName,
            onDay: input.onDay,
            deed: input.deed
        })
        : null;
    // A term is held BY a house, so somebody answering for nobody has nowhere to
    // put a person and the years are not available to them however worth keeping
    // the offender is.
    const cripples = wanted === 'the capability' || indenture === null
        ? theCapabilityTaken(input.offender.name, input.yourOrdinal)
        : null;
    const takes: WhatIsTaken = indenture !== null
        ? 'the years'
        : cripples !== null ? 'the capability' : 'nothing';

    return {
        knownTo,
        acting,
        reach,
        redirectedTo: null,
        bother,
        weight,
        takes,
        cripples,
        indenture,
        theReprisalAsADeed: takes === 'nothing' ? null : theReprisalAsADeed({
            takes,
            weight,
            offender: input.offender,
            answering: input.answering,
            onDay: input.onDay,
            knownTo,
            cripples,
            indenture
        }),
        line: takes === 'nothing'
            ? `${input.answering.name} would answer it and there is nothing to answer it with. `
              + `${input.offender.name} has built nothing worth taking and is no use kept.`
            : takes === 'the capability'
                ? `${cripples!.line} It is the exact capability that was misused, removed, and it `
                  + 'costs the house nothing to maintain afterwards.'
                : `${input.offender.name} is taken. ${indenture!.theHousesWord} ${indenture!.whenItEnds}`
    };
}

function theCapabilityTaken(name: string, ordinal: number): TheCapabilityTaken | null {
    const woundKey = theStructureTheyHave(ordinal);
    if (woundKey === null) return null;
    return {
        woundKey,
        // Every broken status in the table is authored at this severity and no
        // other. Nothing here decides it.
        severity: 'crippling',
        line: `What ${name} climbed is taken off them, and it does not come back.`
    };
}

function theYearsTaken(input: {
    alignment: SectAlignment | null;
    weight: Severity;
    offender: Party;
    houseId: string | null;
    houseName: string | null;
    onDay: DayIndex;
    deed: Deed;
}): TheYearsTaken | null {
    if (input.houseId === null) return null;
    const alignment = input.alignment ?? 'neutral';
    const reason = WHY_AN_INDENTURE_IS_TAKEN[alignment];
    const termYears = termOfYearsFor(alignment, input.weight);
    const dueOnDay = termYears === null
        ? null
        : input.onDay + Math.round(termYears * DAYS_PER_YEAR);
    const witnessFactionId = theOathwrightWouldWitnessFor(input.houseId)
        ? THE_OATHWRIGHT_HOUSE
        : null;

    return {
        termYears,
        dueOnDay,
        witnessFactionId,
        theHousesWord: reason.theHousesWord,
        whenItEnds: isHeldWithoutEnd(alignment)
            ? 'No day is written into it, and nobody is in a position to ask for one.'
            : WHAT_THE_END_OF_A_TERM_LEAVES.standing,
        oath: {
            kind: 'oath',
            // The person bound holds it: they are the one answerable, and the
            // house is who comes looking.
            holderId: input.offender.id,
            subjectId: input.houseId,
            cause: 'service_term',
            // Exactly as heavy as what it answers. A lighter oath would be
            // cheaper to break than the account it replaced.
            severity: input.weight,
            onDay: input.onDay,
            description:
                `${input.offender.name} is held by ${input.houseName ?? 'the house'} for a term. `
                + `${reason.whatTheYearsAreFor}`,
            terms:
                (termYears === null
                    ? 'No term is stated. '
                    : `${termYears} years, from day ${input.onDay}. `)
                + (witnessFactionId === null
                    ? 'Witnessed by somebody other than the premier oathwright, who will not put '
                      + 'its name to this house\'s paper.'
                    : 'Witnessed, with a penalty clause, and the penalty is structural rather '
                      + 'than punitive.')
                + ' They are held below every floor this house admits at, and the difference '
                + 'between them and a servant is not the work: a servant chose it and may leave.',
            dueOnDay,
            participants: witnessFactionId === null ? [] : [witnessFactionId],
            tags: [
                'indenture',
                `for:${alignment}`,
                ...(termYears === null ? ['no_term'] : [`years:${termYears}`]),
                ...(witnessFactionId === null ? ['unwitnessed_by_the_oathwright'] : [])
            ],
            triggeringEventId: input.deed.triggeringEventId ?? null
        }
    };
}

/**
 * The reprisal, as an ordinary deed the ordinary machinery can price. Handing it
 * to `whatADeedLeaves` opens the account the reprisal deserves, so no rule
 * anywhere had to say that a reprisal can be resented.
 */
function theReprisalAsADeed(input: {
    takes: WhatIsTaken;
    weight: Severity;
    offender: Party;
    answering: Party;
    onDay: DayIndex;
    knownTo: readonly string[];
    cripples: TheCapabilityTaken | null;
    indenture: TheYearsTaken | null;
}): Deed {
    const taken = input.takes === 'the capability';
    return {
        cause: taken ? 'crippled' : 'blocked_advancement',
        // The house is the actor and the offender the subject, so the offender
        // paid.
        paidBy: 'subject',
        cost: taken ? 1 : 0.6,
        irreversible: taken,
        onDay: input.onDay,
        description: taken
            ? `${input.answering.name} took what ${input.offender.name} had climbed.`
            : `${input.answering.name} holds ${input.offender.name} to a term of service.`,
        knownTo: input.knownTo,
        tags: [
            'reprisal',
            `takes:${input.takes.replace(/\s+/g, '_')}`,
            ...(input.cripples ? [`wound:${input.cripples.woundKey}`] : []),
            ...(input.indenture?.termYears !== undefined && input.indenture?.termYears !== null
                ? [`years:${input.indenture.termYears}`]
                : [])
        ]
    };
}

/**
 * The second call, when a matter went over somebody's head: the same three
 * questions with the parties moved along one. NOT A GENTLER PASS - a house given a
 * complaint about its own is being told one of its people cost it standing.
 */
export function theComplaintYourHouseReceives(
    answer: WhatTheHouseDoes,
    yourHouse: Party & SomethingToLose,
    theirOrdinal: number
): { answering: Party & SomethingToLose; theirOrdinal: number; backing: Backing } | null {
    if (answer.redirectedTo === null) return null;
    return {
        answering: yourHouse,
        theirOrdinal,
        // Your own house is not deterred by your own house. Nothing stands
        // between it and you, which is why a complaint is worse than a beating.
        backing: 'none'
    };
}

/**
 * What a house does about somebody it has caught at something it punishes.
 */
export type IfCaught = 'killed' | 'questioned_about_the_source' | 'priced' | 'nothing';

export function ifCaughtAtSomethingTheHousePunishes(input: {
    /** Whether this house has any claim on what was done. */
    theirsToPunish: boolean;
    alignment: SectAlignment | null;
}): IfCaught {
    if (!input.theirsToPunish) return 'nothing';
    switch (input.alignment) {
        case 'demonic': return 'killed';
        case 'righteous': return 'questioned_about_the_source';
        case 'neutral': return 'priced';
        // No house is no punisher: a wrong against nobody's claim is nobody's.
        default: return 'nothing';
    }
}

/**
 * The record a house opens about one of its OWN, as the offender. THE DIRECTION IS
 * THE WHOLE OF THIS: `what-a-deed-leaves.ts` makes a house a holder only when its
 * member is the VICTIM, and this is the mirror.
 */
export const AGAINST_THEIR_OWN = 'against_their_own';

export function whatYourOwnHouseOpensAboutYou(input: {
    /** The house. It is the holder, which is the point. */
    houseId: string;
    /** Their own member, who did it. */
    memberId: string;
    cause: ObligationInput['cause'];
    severity: Severity;
    onDay: DayIndex;
    description: string;
    /** What the house would do about it, from the switch above. */
    doing: IfCaught;
    knownTo?: readonly string[];
}): ObligationInput | null {
    // A house with no claim opens nothing. Being disapproved of is not a record.
    if (input.doing === 'nothing') return null;
    return {
        kind: 'grudge',
        holderId: input.houseId,
        subjectId: input.memberId,
        cause: input.cause,
        severity: input.severity,
        onDay: input.onDay,
        description: input.description,
        participants: [input.houseId],
        ...(input.knownTo === undefined ? {} : { knownTo: [...input.knownTo] }),
        tags: [AGAINST_THEIR_OWN, `house_does:${input.doing}`]
    };
}

/** Whether this row is a house holding something against somebody it houses. */
export function isYourOwnHouseHoldingIt(record: { tags?: readonly string[] }): boolean {
    return (record.tags ?? []).includes(AGAINST_THEIR_OWN);
}
