/**
 * What a deed leaves behind, priced by what it was worth rather than by what it was
 * called. KINDNESS AND HARM ARE THE SAME MACHINERY POINTED TWO WAYS: one scoring
 * function, both directions through it, a favour owed and a grudge held weighed
 * identically.
 */

import type { SectAlignment } from '../../schema/cultivation.js';
import type { DayIndex } from '../social/common.js';
import type {
    InheritanceRelation,
    ObligationCause,
    ObligationInput,
    ObligationKind,
    Severity
} from '../social/grudges.js';
import { SEVERITY_ORDER } from '../social/grudges.js';
import type { ShameInput } from '../social/shame.js';
import { severityWithHouse, whenItIsDoneToOneOfOurs } from './what-a-house-will-do-about-it.js';
import { NO_NAME_ON_IT, NO_NAME_TAG } from '../social/accounts-with-no-name.js';

/**
 * Which side of it paid: `actor` is a kindness, `subject` is a wrong. The entire
 * direction of the system, in one field.
 */
export type WhoPaid = 'actor' | 'subject';

/**
 * How far the wronged side can get at the person who did it. Not a rank and not
 * a judgement about strength - a fact about whether there is anybody to take it
 * to, which is what keeps the ladder out of the consequence layer entirely.
 */
export type Reach =
    /** They answer to nobody. Whatever is done about it can be done directly. */
    | 'unbacked'
    /** They answer to a body the aggrieved side deals with. It goes between houses. */
    | 'answerable'
    /**
     * Nobody could be made to answer, now or soon. The account is written as a
     * `blood_feud` - a thing to be CARRIED, because there is no settlement
     * available to the people it happened to.
     */
    | 'beyond';

/** Who somebody is, for the purpose of deciding who else ends up carrying this. */
export interface Party {
    id: string;
    name: string;
    /** The house they answer to, or null for somebody who answers to nobody. */
    houseId: string | null;
    houseName: string | null;
    alignment: SectAlignment | null;
    /**
     * Whether the house has anything invested in them. THE WEAK MEMBER OF A
     * STRONG HOUSE IS STILL RANKED - being low is not being nothing.
     */
    ranked: boolean;
    /** Blood and household. Who carries it when the principal cannot. */
    kin?: readonly { id: string; relation: InheritanceRelation }[];
    /** Houses this party's house stands with. Named on the record, never holders. */
    alliedHouseIds?: readonly string[];
}

/**
 * One thing somebody did to somebody. Everything the engine reads is here and none
 * of it is the deed's name.
 */
export interface Deed {
    /** The ledger's own word for it. DATA, carried onto the record and never read. */
    cause: ObligationCause;
    paidBy: WhoPaid;
    /**
     * What it cost the payer, 0..1, AGAINST WHAT THEY HAD. Relative and not
     * absolute: a hundred stones off a beggar and off a house treasury are not
     * the same deed, in either sign.
     */
    cost: number;
    /** True when what was taken or given does not come back. */
    irreversible?: boolean;
    /** True when a word was given first and not kept. Weighs one step. */
    promised?: boolean;
    onDay: DayIndex;
    /** Plain words for the ledger. Written by the caller; never parsed. */
    description: string;
    /**
     * Who can put a NAME to it. Omit and everybody involved can.
     */
    knownTo?: readonly string[];
    /**
     * True when what happened reads as something other than a deed at all - a
     * poisoning that reads as a qi deviation, a false pill that reads as a body
     * which could not take the medicine.
     */
    deniable?: boolean;
    /** How many people could see it. Carried as a tag, never as a weight. */
    witnesses?: number;
    /** Anybody else the event touched, so the record is findable from them. */
    participants?: readonly string[];
    /** Free handles on top of the ones this file adds. */
    tags?: readonly string[];
    /** Ground-truth fact id, when the caller has one. */
    triggeringEventId?: string | null;
    /** True when the record rests on a belief rather than a confirmed fact. */
    fromBelief?: boolean;
}

/** Two cost thresholds and nothing else, so the whole scale stays legible. */
const A_REAL_COST = 0.4;
const MOST_OF_WHAT_THEY_HAD = 0.75;

/**
 * How heavy a record this deed deserves: a monotone walk up {@link SEVERITY_ORDER},
 * one step per fact that is true. A fifth consideration is a step, not a table
 * edit, and a tenth kind of deed is nothing at all.
 */
export function whatItWasWorth(deed: Deed): Severity {
    let steps = 0;
    if (deed.cost >= A_REAL_COST) steps++;
    if (deed.cost >= MOST_OF_WHAT_THEY_HAD) steps++;
    if (deed.irreversible) steps++;
    if (deed.promised) steps++;

    // A KINDNESS NOBODY WOULD HAVE KNOWN ABOUT IS WORTH MORE. The one place the two
    // directions are deliberately asymmetric: public virtue is already paid for by
    // reputation, so unwitnessed help tells the recipient something no amount of
    // public generosity could.
    if (deed.paidBy === 'actor' && (deed.witnesses ?? 0) === 0) steps++;

    return SEVERITY_ORDER[Math.min(steps, SEVERITY_ORDER.length - 1)];
}

/** True at `grave` and above. The band at which other people start carrying it. */
export function isHeavy(severity: Severity): boolean {
    return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf('grave');
}

/**
 * How far past the two of them it got. Describes WHO IS CARRYING IT, never what
 * anybody intends to do - what a house does about a thing it carries is the
 * narrator's to answer from the record.
 */
export type HowFarItReached =
    /**
     * Nobody who could open an account knows a deed was done. Not "nothing
     * happened": the shame exists, and somebody working it out later is a dated
     * event that costs MORE for the delay, not less.
     */
    | 'nobody has worked it out'
    | 'the two of them'
    | 'their people'
    | 'the houses';

export interface WhatADeedLeaves {
    weight: Severity;
    /** Every record the deed opens. `[0]` is always the principal's own. */
    opens: ObligationInput[];
    /**
     * What the actor now carries among the people near them. `heldBy` is
     * deliberately the short list rather than the world: this is how somebody is
     * exactly what their own house knows them to be and perfectly respectable
     * two provinces away.
     */
    shame: ShameInput | null;
    reached: HowFarItReached;
    /** Nobody involved can settle it and it is written to descend. */
    willDescend: boolean;
    /** One factual line for the mechanical channel. Never narration. */
    note: string;
}

/** Read a deed and say what the world now holds about it. */
export function whatADeedLeaves(input: {
    deed: Deed;
    actor: Party;
    subject: Party;
    /** How far the aggrieved side can get at the actor. Ignored for a kindness. */
    reach?: Reach;
    /**
     * The principal is dead or gone. Their people hold it from day one rather
     * than inheriting it later.
     */
    principalCannotHoldIt?: boolean;
}): WhatADeedLeaves {
    const { deed, actor, subject } = input;
    const aKindness = deed.paidBy === 'actor';
    const personal = whatItWasWorth(deed);

    // A favour is held BY the person who paid it; a wrong is held by the person
    // it was done to. One expression, both directions.
    const principal = aKindness ? actor : subject;
    const other = aKindness ? subject : actor;

    const verdict = whenItIsDoneToOneOfOurs({
        alignment: (aKindness ? subject : subject).alignment,
        ranked: subject.ranked,
        wasAnAttachment: false,
        ask: isHeavy(personal) ? 'against_their_interest' : 'a_courtesy'
    });

    // A house floors a WRONG only. It cannot decide its member is more grateful
    // than they are - that would be an institution manufacturing a debt.
    const weight = aKindness ? personal : severityWithHouse(personal, verdict.severityFloor);

    const reach: Reach = aKindness ? 'unbacked' : (input.reach ?? 'unbacked');
    const heavy = isHeavy(weight);
    const houseIsAParty = subject.ranked && subject.houseId !== null
        && (heavy || verdict.houseIsAParty);
    const willDescend = !aKindness && heavy && reach === 'beyond';

    const baseTags = [
        `deed:${aKindness ? 'given' : 'taken'}`,
        `cost:${bandOf(deed.cost)}`,
        ...(deed.irreversible ? ['irreversible'] : []),
        ...(deed.promised ? ['promised'] : []),
        ...((deed.witnesses ?? 0) > 0 ? ['witnessed'] : []),
        ...(aKindness ? [] : [`reach:${reach}`]),
        ...(deed.tags ?? [])
    ];

    const commonToAll = {
        cause: deed.cause,
        onDay: deed.onDay,
        triggeringEventId: deed.triggeringEventId ?? null,
        fromBelief: deed.fromBelief ?? false
    };

    const opens: ObligationInput[] = [];
    const kin = principal.kin ?? [];
    const carriedForThem = Boolean(input.principalCannotHoldIt);

    // Nobody opens an account against a name they have not got.
    const knows = (id: string): boolean =>
        deed.knownTo === undefined || deed.knownTo.includes(id);

    // The personal account. The dead hold nothing, so where they cannot hold it
    // their nearest people hold it from day one.
    if (!carriedForThem && knows(principal.id)) {
        opens.push({
            ...commonToAll,
            kind: kindFor(aKindness, willDescend),
            holderId: principal.id,
            subjectId: other.id,
            severity: weight,
            description: deed.description,
            participants: dedupe([
                ...(deed.participants ?? []),
                ...(houseIsAParty && subject.houseId ? [subject.houseId] : [])
            ]),
            tags: baseTags
        });
    }

    // Kin, at the SAME weight: inheritance does not discount, so the brother
    // holds what the brother holds.
    if (heavy || carriedForThem) {
        for (const relative of kin) {
            if (relative.id === other.id) continue;
            // Somebody who cannot name it still holds it. The design owner:
            // *the ledger is not empty before being told, it is there, they
            // just don't have an outlet for their anger.* What being told
            // supplies is not the wrong, it is the TARGET - so the account
            // opens either way and only the name differs. The exception is a
            // deniable deed, where nothing says anybody did it at all.
            const named = knows(relative.id);
            if (!named && (aKindness || deed.deniable)) continue;
            opens.push({
                ...commonToAll,
                kind: kindFor(aKindness, willDescend),
                holderId: relative.id,
                subjectId: named ? other.id : NO_NAME_ON_IT,
                severity: weight,
                description: named
                    ? `${deed.description} ${principal.name} was theirs.`
                    : `${deed.description} ${principal.name} was theirs, and nobody has put a `
                      + 'name to it.',
                participants: dedupe([
                    principal.id,
                    ...(deed.participants ?? []),
                    ...(houseIsAParty && subject.houseId ? [subject.houseId] : [])
                ]),
                tags: [
                    ...baseTags,
                    `carried:${relative.relation}`,
                    ...(named ? [] : [NO_NAME_TAG])
                ]
            });
        }
    }

    // What the house ends up holding. The only thing deciding how far it goes is
    // whether the house had anything invested and whether there is anybody to
    // take it to.
    if (houseIsAParty && subject.houseId && knows(subject.houseId)) {
        const actorsHouse = reach === 'answerable' && actor.houseId && actor.houseId !== subject.houseId
            ? [actor.houseId]
            : [];
        opens.push({
            ...commonToAll,
            kind: kindFor(aKindness, willDescend),
            holderId: subject.houseId,
            // Where the actor answers to a house, the account names the HOUSE.
            subjectId: aKindness ? actor.id : (actorsHouse[0] ?? actor.id),
            severity: weight,
            description:
                `${deed.description} ${subject.name} was ${subject.houseName ?? 'the house'}'s.`,
            participants: dedupe([
                actor.id,
                subject.id,
                ...actorsHouse,
                // Allies are NAMED, never made holders: the engine does not get
                // to decide on their behalf that they care.
                ...(subject.alliedHouseIds ?? [])
            ]),
            tags: [...baseTags, 'institutional']
        });
    }

    const reached: HowFarItReached = opens.length === 0
        ? 'nobody has worked it out'
        : opens.some(o => o.holderId === subject.houseId)
            ? 'the houses'
            : opens.length > 1 || carriedForThem
                ? 'their people'
                : 'the two of them';

    return {
        weight,
        opens,
        shame: aKindness ? null : shameFor(deed, actor, weight, subject),
        reached,
        willDescend,
        note: noteFor({ aKindness, weight, reached, willDescend, reach, actor, subject, verdict })
    };
}

/**
 * Which of the ledger's kinds this is. `blood_feud` is not a heavier grudge: it
 * runs between lines, is expected to be inherited, and everyone knows it is
 * running - all true of a grave wrong nobody can be made to answer for.
 */
function kindFor(aKindness: boolean, willDescend: boolean): ObligationKind {
    if (aKindness) return 'favor';
    return willDescend ? 'blood_feud' : 'grudge';
}

/**
 * What the actor now carries among the people near them. The join to `shame.ts`.
 */
function shameFor(
    deed: Deed,
    actor: Party,
    weight: Severity,
    subject: Party
): ShameInput | null {
    if (!isHeavy(weight)) return null;
    return {
        subjectId: actor.id,
        cause: 'known_for_a_grave_deed',
        severity: weight,
        onDay: deed.onDay,
        description: deed.description,
        // The people who were there, plus the person it was done to. Nothing
        // here widens it: telling is the gossip layer's business.
        heldBy: dedupe([subject.id, ...(deed.participants ?? [])]),
        // A thing a crowd saw is not a thing a short list holds.
        common: (deed.witnesses ?? 0) >= A_CROWD
    };
}

/** The point at which a room stops being a list of people who were there. */
const A_CROWD = 6;

function noteFor(input: {
    aKindness: boolean;
    weight: Severity;
    reached: HowFarItReached;
    willDescend: boolean;
    reach: Reach;
    actor: Party;
    subject: Party;
    verdict: ReturnType<typeof whenItIsDoneToOneOfOurs>;
}): string {
    if (input.aKindness) {
        return input.reached === 'the houses'
            ? `${input.subject.houseName ?? 'The house'} is owed something on behalf of one of `
              + 'its own, and a house that is owed something is a door that opens without a '
              + 'price on it.'
            : input.reached === 'their people'
                ? 'It is not only theirs. The people around them hold it too, and they will '
                  + 'still hold it when the person it was done for is gone.'
                : 'One person owes another person something. That is worth more than money in '
                  + 'this world and it is not written anywhere they can see.';
    }
    if (input.willDescend) {
        return 'There is nobody who can be made to answer for it, so it is not written down as '
            + 'a thing to be settled. It is written down as a thing to be carried, and it will '
            + 'reach people who were not born when it happened.';
    }
    if (input.reached === 'the houses') {
        return input.reach === 'answerable'
            ? `It stopped being between two people. ${input.subject.houseName ?? 'The house'} `
              + 'holds it, and the name on it is a house rather than a person. ' + input.verdict.note
            : `${input.subject.houseName ?? 'The house'} holds it, and the name on it is the `
              + 'person who did it, who answers to nobody. ' + input.verdict.note;
    }
    return input.reached === 'their people'
        ? 'They are in no position to hold it themselves. The people nearest them hold it '
          + 'instead, from the day it happened rather than from the day they died.'
        : 'It stays between the two of them. Nobody else has been told and nobody else is '
          + 'carrying it.';
}

function bandOf(cost: number): string {
    if (cost >= MOST_OF_WHAT_THEY_HAD) return 'most_of_what_they_had';
    if (cost >= A_REAL_COST) return 'real';
    return 'small';
}

function dedupe(ids: readonly string[]): string[] {
    return [...new Set(ids.filter(id => id.length > 0))];
}

/** Exported so a probe can print the bands without restating them. */
export const DEED_CONSTANTS = Object.freeze({
    A_REAL_COST,
    MOST_OF_WHAT_THEY_HAD,
    A_CROWD
});
