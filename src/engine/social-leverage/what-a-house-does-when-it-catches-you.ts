/**
 * What a house does about somebody it has caught, once it can put a name to
 * them.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ALMOST NOTHING HERE IS NEW, AND THE LIST IS THE ARGUMENT
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   "IF THEY CATCH YOU"   `canPointAt` and `REACHABLE_FROM` in
 *                         `social/discovery.ts`. A record is held AGAINST
 *                         somebody, so opening one needs a name, and the ladder
 *                         of knowing already has the rung where a name arrives.
 *                         There is no witness system here and there must not be
 *                         one. `Deed.knownTo` is the field, and a deed nobody
 *                         has worked out already answers *"nobody has worked it
 *                         out"* on its own.
 *   HOW HEAVY IT WAS      `whatItWasWorth` in `what-a-deed-leaves.ts`. What it
 *                         cost against what they had, whether it comes back,
 *                         whether a word was given first. Never what it was
 *                         called.
 *   HOW FAR APART THEY    `regardFor` and `REGARD_BANDS`. The vocabulary this
 *   ARE                   world already uses for the distance between two
 *                         parties, read here in the one direction that matters:
 *                         the house looking down at the person.
 *   WHERE IT GOES         `Reach` in `what-a-deed-leaves.ts`. `answerable` is
 *                         the redirect - the account goes between houses rather
 *                         than landing on the person - and it was already the
 *                         field for it.
 *   THE CRIPPLING         `brokenStatusFor` and `WOUND_TYPES`. Every crippling
 *                         this can inflict is a broken status that already
 *                         exists, already has a presentation, and already has a
 *                         medicine that almost nobody ever sees.
 *   THE INDENTURE         `service_term` on `OathCause`, which has been in the
 *                         ledger since it was written and which nothing has
 *                         ever produced. See
 *                         `data/cultivation/what-an-indenture-is-and-what-
 *                         happens-when-it-ends.ts`.
 *
 * What this file adds is the order the three questions are asked in.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE AXES, ASKED IN THIS ORDER, AND CROSSING THEM IS THE FAILURE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   1. CAN THE OFFENDED PARTY BE MADE TO PAY FOR ACTING?
 *      Asked first because it can remove the other two. An elder inside a house
 *      is constrained by that house's interests, and laying hands on an apex's
 *      disciple starts something their own house pays for. So they complain.
 *
 *   2. ARE YOU WORTH THE TROUBLE?
 *      Taking somebody means feeding, housing and watching them for decades.
 *      Crippling somebody means going and doing it. Neither is free, and a
 *      house does neither for a nobody who gave offence.
 *
 *   3. WHAT KIND OF HOUSE CAUGHT YOU?
 *      And this decides the KIND, never the severity. The magnitude is what the
 *      deed was worth, which the engine already computes.
 *
 * **Getting 2 and 3 crossed produces a punishment table where righteous is mild
 * and demonic is severe, which is exactly what this design is not.** Righteous,
 * neutral and demonic do not punish harder or softer than each other. Sixty
 * years of somebody's life taken by a house that sincerely believes it is
 * correcting them is not a lighter thing than a cracked core.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE FIRST AXIS IS NOT "WHO BACKS YOU"
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It is CAN THE PERSON WHO WANTS TO ACT BE MADE TO PAY FOR IT. Backing is how
 * that is usually true and rogueness is how it is usually false, and naming the
 * axis the other way invites a special case for every unaffiliated party in the
 * world. The design owner's sentence, and it is the good world rule in here:
 *
 *   > BACKING PROTECTS YOU FROM EXACTLY THE PEOPLE WHO HAVE SOMETHING TO LOSE.
 *   > IT IS WORTH NOTHING AGAINST SOMEBODY WHO HAS NOTHING.
 *
 * So an apex house's disciple is safest among institutions and least safe on an
 * empty road. Their name works on anybody reachable through a house and does
 * nothing whatever to somebody who is not. `rogues.ts` is where the unaffiliated
 * are written and it says the same thing from the other side: no protection and
 * nobody to complain to are one fact, not two, and so are a rogue's freedom to
 * act and a rogue's exposure to being acted on.
 *
 * AND "DOES NOT CARE" IS A VARIABLE RATHER THAN A STATUS. Somebody nominally
 * inside a house who has decided they no longer care what it costs is, for this
 * question, a rogue - and a far more dangerous one, because they read as backed
 * right up until they act. It is {@link SomethingToLose.hasStoppedCaring} and
 * it is supplied by the caller, because whether a person has stopped caring is
 * a fact about them and not a rung.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE REDIRECT IS `Reach`, AND WHAT YOUR HOUSE THEN DOES IS THIS FUNCTION
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A complaint is not you getting away with it. It is the matter being handed to
 * the one party with a genuine right to punish you, and that party may well be
 * harsher, because what you cost them is standing. It should read as an adult
 * settling something over a child's head, which is more humiliating and more
 * dangerous than a beating.
 *
 * And what your own house does about the complaint needs no branch here: it is
 * the same three questions asked again with your house standing where the
 * offended house stood. {@link theComplaintYourHouseReceives} builds that second
 * call. **The redirect is recursion, not a second mechanism**, which is also
 * what stops it becoming a chain of bespoke rules one level down.
 *
 * Pure. No state, no rolls, no I/O.
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

// ─────────────────────────────────────────────────────────────────────────
// AXIS 1 - CAN THEY BE MADE TO PAY FOR ACTING
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the offender's house is actually worth to them, on this question only.
 *
 * Three values rather than a boolean because the middle one is the interesting
 * position and this world already draws it: somebody nominally attached who
 * cannot claim the house's protection is in the worst place of anybody -
 * visible enough to be worth a reprisal, unbacked enough to receive it in
 * person.
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
     * They have decided they no longer care what it costs.
     *
     * A variable and not a status: it is a fact about a person's state rather
     * than about their position, it can be true of an elder in good standing,
     * and it is the single most dangerous thing about the person carrying it.
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
 * The first question, and it can remove the other two.
 *
 * Note there is no rung anywhere in here. This is not about who would win - it
 * is about whether starting something is a thing the aggrieved party is in a
 * position to do, and the strongest elder in the province is not, if their house
 * would have to answer for it.
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

// ─────────────────────────────────────────────────────────────────────────
// AXIS 2 - ARE YOU WORTH THE TROUBLE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The small facts that make somebody worth spending something on.
 *
 * DERIVED AND NOT A SCORE. Three booleans the caller already holds, counted,
 * and used to step the regard band. Anything richer than this becomes a second
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
    /**
     * Not worth the rice.
     *
     * **Contempt rather than leniency, and it is a real outcome to be able to
     * come back from.** Being beneath a reprisal is information about where you
     * stand, and a player who can genuinely get away with something because
     * nobody thought them worth the trouble has learned more about this world
     * than a scaling punishment could have told them.
     */
    | 'beneath_notice'
    /** Worth answering. Axis 3 decides what kind of answer. */
    | 'worth_mounting';

/**
 * The band the house reads the offender at.
 *
 * `regardFor(gate, asker)` computes `asker - gate`, so the house is the asker
 * and the offender is the gate: the gap is how far the house stands above the
 * person it has caught, and the band names it in the world's existing
 * vocabulary. `dismissed` and `beneath` are the two the owner's ruling turns on
 * and they already mean the right things - *"so far below them it is not put to
 * them at all"* and *"not treated as a thing being attempted"*.
 */
export function howTheHouseReadsYou(input: {
    theirOrdinal: number;
    yourOrdinal: number;
}): RegardBand {
    return regardFor(input.yourOrdinal, input.theirOrdinal).band;
}

/**
 * Worth steps the band toward `matched` and never past it.
 *
 * Being worth something makes a house look harder at somebody far below it. It
 * does not make somebody standing ABOVE the house into a smaller problem, which
 * is why the clamp is there: what is above you is above you whatever it is
 * holding.
 */
export function bandAfterWorth(band: RegardBand, worthCount: number): RegardBand {
    const matched = REGARD_BAND_ORDER.indexOf('matched');
    const at = REGARD_BAND_ORDER.indexOf(band);
    // At or above them already. Worth has nothing to say about somebody the
    // house is looking up at, in either direction.
    if (at < 0 || at <= matched) return band;
    return REGARD_BAND_ORDER[Math.max(matched, at - Math.max(0, worthCount))] ?? band;
}

/**
 * The second question.
 *
 * The owner's calibration, and the table already lands on it: a Core Formation
 * cultivator who offends a Void Refinement elder reads `beneath` and is worth
 * answering; a Qi Condensation nobody reads `dismissed` and is not. Nothing in
 * here was chosen to produce that - it is where the existing band windows fall.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT THERE IS TO TAKE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The structure this cultivator has built that could be broken, or null.
 *
 * Derived, with no table of its own: the broken status of the crossing they
 * most recently completed. A Core Formation cultivator has a core, and the row
 * for a core that will not open again is `cracked-core`, which already exists,
 * already carries its own presentation and already has a medicine that almost
 * nobody ever sees.
 *
 * NULL AT QI CONDENSATION, and that is the whole of the owner's point about
 * crippling. Somebody who has crossed nothing has built nothing, so there is
 * nothing to remove and no house gains anything by going and removing it.
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
 * What a house takes, given that it has decided the person is worth answering.
 *
 * NOT KEYED ON ALIGNMENT. Both answers are available to every house in the
 * world, and which one lands is an investment question asked one level down
 * from the last one:
 *
 *   WORTH KEEPING       There is something in them the house can use for years -
 *                       a root, a rate, a thing they hold. Feeding and watching
 *                       them buys that. It takes the years.
 *   NOT WORTH KEEPING   They had something worth removing and nothing worth
 *                       keeping. It takes the capability, which costs the house
 *                       one afternoon and nothing afterwards.
 *   NEITHER             They had nothing to take and are no use kept. There is
 *                       no answer here worth a house's time, whatever it feels.
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

// ─────────────────────────────────────────────────────────────────────────
// THE ANSWER
// ─────────────────────────────────────────────────────────────────────────

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
     * The reprisal itself, as a deed.
     *
     * A house crippling somebody is a transfer like any other and is priced by
     * the same call a gift is: they paid, it does not come back, and they hold a
     * record about the house afterwards. Null where nothing was done. **Hand it
     * to `whatADeedLeaves` and the loop closes** - a reprisal can be answered,
     * and nothing had to be written to make that true.
     */
    theReprisalAsADeed: Deed | null;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What the house does, in the order the argument runs.
 *
 * `stages` is where every party stands on the ladder of knowing about THIS
 * DEED, supplied and never derived - the knowledge layer writes stages from
 * whatever source it had, and `stageCeilingFor` already caps what each source
 * can deliver. Anybody absent is `unaware`. If nobody has reached `placed`,
 * nothing below runs, because there is no name to hold anything against.
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
    // A term is held BY a house. Somebody answering for nobody has nowhere to
    // put a person and no one to watch them, so the years are not available to
    // them however worth keeping the offender is - which is the same investment
    // logic one step further down and needs no rule of its own.
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

// ─────────────────────────────────────────────────────────────────────────
// THE TWO THINGS A HOUSE TAKES
// ─────────────────────────────────────────────────────────────────────────

function theCapabilityTaken(name: string, ordinal: number): TheCapabilityTaken | null {
    const woundKey = theStructureTheyHave(ordinal);
    if (woundKey === null) return null;
    return {
        woundKey,
        // Every broken status in the table is authored at this severity and at
        // no other. The row says so; nothing here decides it.
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
            // The person bound holds it. Same direction as `settleItWithABinding`:
            // they are the one answerable, and the house is who comes looking.
            holderId: input.offender.id,
            subjectId: input.houseId,
            cause: 'service_term',
            // Exactly as heavy as what it is answering. A lighter oath would be
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
 * The reprisal, as an ordinary deed the ordinary machinery can price.
 *
 * The offender paid, it does not come back, and the house holds nothing
 * afterwards except somebody who has a reason. Handing this to `whatADeedLeaves`
 * with the two parties reversed opens the account the reprisal itself deserves,
 * and no rule anywhere had to say that a reprisal can be resented.
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
        // The house is the actor and the offender is the subject, so the
        // offender paid. Same field, same direction, no second expression of it.
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

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT YOUR OWN HOUSE DOES ABOUT THE COMPLAINT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The second call, when a matter went over somebody's head.
 *
 * Your house is now the answering party and you are the one it has caught, so
 * the same three questions run with the parties moved along one. It is not a
 * gentler pass: a house given a complaint about its own is being told that one
 * of its people cost it standing, and what it does about that is its own
 * decision on its own terms.
 *
 * Returns null where there was no redirect, so a caller can chain unconditionally.
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
        // Your own house is not deterred by your own house. There is nothing
        // between it and you, which is the whole of why a complaint is worse
        // than a beating.
        backing: 'none'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHEN THE PERSON CAUGHT IS ONE OF YOUR OWN
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a house does about somebody it has caught at something it punishes.
 *
 * ── THIS IS `ifCaughtPractising` GENERALISED, NOT A SECOND FUNCTION ──────
 *
 * `world/manuals.ts` has answered this since long before portfolios existed,
 * scoped to exactly one offence - practising an art off somebody's shelf - and
 * the answer was already the right shape: one switch on alignment turning into
 * three genuinely different situations, with no branch on any faction's name.
 * What was wrong with it was only its reach.
 *
 * So the switch is lifted here unchanged and the offence-specific half becomes
 * a parameter. `ifCaughtPractising` now calls this and supplies the property
 * question it always asked; anything else a house punishes supplies its own.
 * **There is no second punishment table and there must not be one** - a tenth
 * offence is a caller, not a case.
 *
 * The three readings, in the words `manuals.ts` wrote for them:
 *
 *   A DEMONIC HOUSE     may simply kill you. There is no process to fail and
 *                       nobody to explain yourself to.
 *   A RIGHTEOUS HOUSE   asks where you got it. There is a conversation, it has
 *                       a right answer, and you may walk away having given up
 *                       somebody else.
 *   A NEUTRAL HOUSE     prices it. Which of a loss and a lever it becomes
 *                       depends on what you are worth to them.
 *
 * `theirsToPunish` is the whole of the offence-specific half, and it is a
 * PROPERTY question rather than a moral one: does this house have a claim on
 * the thing at all. A house does not punish somebody for a thing that was never
 * its business, whatever it thinks of them.
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
        // No house is no punisher. A wrong against nobody's claim is nobody's
        // to answer, which is the same answer the property question gives.
        default: return 'nothing';
    }
}

/**
 * The record a house opens about one of its OWN, as the offender.
 *
 * ── THE DIRECTION IS THE WHOLE OF THIS ───────────────────────────────────
 *
 * `what-a-deed-leaves.ts` already makes a house a holder - `holderId:
 * subject.houseId` - but only in one direction: the house is aggrieved when its
 * member is the VICTIM, and it takes their part. Nothing anywhere wrote the
 * mirror, where the house holds a record about its member as the one who did
 * it. Both are two strings and nothing guarded either.
 *
 * What makes it a different thing from an ordinary grudge is not the weight and
 * not the cause. It is that **the party with a claim on you is the party you
 * serve**, and a player has to be able to tell that at a glance - so the row
 * carries `AGAINST_THEIR_OWN` and the holder is the house rather than a person.
 * `theComplaintYourHouseReceives` above already says why it is worse: your own
 * house is not deterred by your own house, there is nothing standing between it
 * and you, and that is the whole of why a complaint beats a beating.
 *
 * Severity is the caller's, exactly as `grudges.ts` requires - it is decided
 * once, by whoever knows what was done. Nothing is scored here.
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
