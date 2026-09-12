/**
 * What is left between two people when a thing changes hands.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Three seeded worlds advanced two hundred years:
 *
 *     provenance links written in the span     314 / 252 / 292
 *     of those, a change of hands              90 / 31 / 72
 *     accounts the span opened                 723 / 425 / 566
 *     of those, about an object                0 / 0 / 0
 *
 * Every account any of those worlds ever opened was `killed_kin`,
 * `killed_sectmate`, `killed_master` or `crippled`. `robbery`,
 * `stolen_inheritance`, `gifted_resource` and `lent_resource` have been in
 * `GrudgeCause` and `FavorCause` since they were written, and nothing in the
 * world has ever written one. A house could lose its entire hold in a war and
 * hold nothing against the house that took it.
 *
 * Of `transferPossession`'s nineteen call sites, three open an account, and all
 * three are in `src/web/`. So the rule bound the player and not the world -
 * AGENTS.md's commonest defect with the caller count one instead of none.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT IS READ OFF THE LINK, NOT DECIDED HERE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `AcquisitionMode` already says how a thing changed hands, on every link
 * `transferPossession` writes. This is a read of a fact the chain already
 * carries rather than a second table anybody has to maintain - the same shape
 * `whoseThisIs` takes when it answers whether a house lent a thing or lost it,
 * and for the same reason it gives: a field would have to be written by every
 * path that moves a thing, and the one that forgot would turn a theft into a
 * gift.
 *
 * What is NOT here is what anybody does about it. `whatTheyDoAboutBeingWronged`
 * says what the wronged party does, `whatAHouseWillDoAboutIt` says what their
 * house does, and neither is a decision an object gets to make.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOBODY HOLDS AN ACCOUNT ABOUT SOMETHING THEY DO NOT KNOW HAPPENED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `knownToTheLoser` is a parameter and never a default, because whether
 * anybody noticed is a fact about the room rather than about the object. A war
 * settlement is watched by both sides and passes true. A shelf quietly one book
 * short is `whatTheHouseLearns`, which is the discovery half, lives in
 * `social-leverage/` and is not restated here.
 *
 * A gift and a loan are known to the recipient by construction - somebody put
 * the thing in their hands - so the gate is asked only of a taking.
 */

import type { ObligationInput } from '../social/grudges.js';
import { SEVERITY_ORDER, severityRank, type Severity } from '../social/grudges.js';
import type { AcquisitionMode, ObjectSignificance } from './possessions.js';

/**
 * How badly a party takes losing this, from what the row already says.
 *
 * `significance` is the world's own measure of how much a thing matters and it
 * is set where the object is made, so nothing is scored here - which is what
 * `grudges.ts` requires: severity is decided once, by whoever knows what was
 * done.
 *
 * It reads both ways, and deliberately: what a legendary thing is worth as a
 * grudge when it is taken is what it is worth as a favour when it is given.
 * Two scales would be two answers to one question about one object.
 *
 * Structurally typed rather than taking an `ObjectRecord`, so a caller holding
 * only the significance can ask.
 */
export function howBadlyThisIsMissed(
    object: { readonly significance: ObjectSignificance }
): Severity {
    switch (object.significance) {
        case 'legendary': return 'grave';
        case 'significant': return 'serious';
        default: return 'slight';
    }
}

/**
 * The same measure, for a thing that ended instead of changing hands.
 *
 * `ruin` writes a provenance entry whose holder is nobody, so an ending is a
 * change of hands with nothing on the far end of it - which is why it is scored
 * here and not somewhere new. One band heavier, for the one reason
 * `whatItWasWorth` already spends a step on: it does not come back. A stolen
 * blade is still in the world and can be got back; a broken one is not.
 *
 * That step is what decides how far the news goes, and it decides it through
 * machinery that was already there. `aDeedEntersTheWorld` turns a severity into
 * a magnitude, and `channelFor` in `digest.ts` only lets a fact reach somebody
 * with no connection at all once the magnitude clears `MARKET_MAGNITUDE`. So a
 * `significant` thing - heaven grade, the lowest grade the standing population
 * cannot restock - is the first one a stranger hears about, and everything
 * below it is talk among the people who were standing there.
 */
export function howBadlyItsEndingIsTaken(
    object: { readonly significance: ObjectSignificance }
): Severity {
    const step = severityRank(howBadlyThisIsMissed(object)) + 1;
    return SEVERITY_ORDER[Math.min(step, SEVERITY_ORDER.length - 1)];
}

/** A person or a house on one end of it. Both hold accounts in this engine. */
export interface PartyToIt {
    readonly id: string;
    readonly name: string;
}

/** One thing moving from one party to another, as the new link describes it. */
export interface AChangeOfHands {
    readonly objectId: string;
    readonly objectName: string;
    /** The mode on the link `transferPossession` just wrote. */
    readonly how: AcquisitionMode;
    readonly significance: ObjectSignificance;
    readonly onDay: number;
    /** Who it came off. Null for the ground, a grave, a thing nobody held. */
    readonly from: PartyToIt | null;
    /** Who has it now. Null where it went into the ground. */
    readonly to: PartyToIt | null;
    /**
     * Whether the party who lost it knows it is gone. Never assumed.
     *
     * Only consulted for a taking. A gift and a loan are known to both ends by
     * construction.
     */
    readonly knownToTheLoser: boolean;
    /**
     * Anybody else who lost by it and knows who has it.
     *
     * The case this exists for is a house breaking up and one member walking
     * out with a thing in front of the others: the others are not the party it
     * came off, they lost it all the same, and they can name who took it. Each
     * of them holds their own account, because an account is held by a person.
     */
    readonly othersWhoLostBy?: readonly PartyToIt[];
    /** The event on the record, when the caller has one. */
    readonly triggeringEventId?: string | null;
    /** What happened, for the row's own description. Engine truth, one line. */
    readonly note?: string;
}

/**
 * The accounts one change of hands opens.
 *
 * Empty is the commonest answer and is not a failure: a purchase is settled at
 * the table, an inheritance is not a favour anybody can call in, and a thing
 * picked up off the ground has nobody on the other end of it.
 */
export function whatAChangeOfHandsLeaves(change: AChangeOfHands): ObligationInput[] {
    const severity = howBadlyThisIsMissed(change);
    const what = `${change.objectName}`;
    const tags = [`took:${change.objectId}`, `how:${change.how}`];

    switch (change.how) {
        // ── TAKEN ────────────────────────────────────────────────────────
        //
        // The party it came off holds it against the party that has it. One
        // rule for all three words: a thief, a winner and a house confiscating
        // differ in whether the register moved, which `ownership-transfer.ts`
        // decides, and not in whether the loser minds.
        case 'stolen':
        case 'looted':
        case 'confiscated': {
            if (!change.to || !change.knownToTheLoser) return [];
            const losers = [
                ...(change.from ? [change.from] : []),
                ...(change.othersWhoLostBy ?? [])
            ].filter(party => party.id !== change.to!.id);
            return losers.map(loser => ({
                kind: 'grudge' as const,
                holderId: loser.id,
                subjectId: change.to!.id,
                cause: 'robbery' as const,
                severity,
                onDay: change.onDay,
                description: change.note
                    ?? `${change.to!.name} has ${what}, and it came off ${loser.name}.`,
                triggeringEventId: change.triggeringEventId ?? null,
                participants: [loser.id, change.to!.id],
                tags
            }));
        }

        // ── GIVEN ────────────────────────────────────────────────────────
        //
        // The one act in this engine that opens an account without leverage,
        // and `handOver` already says so about the counted tier. This is the
        // same sentence about the tracked one.
        //
        // THE GIVER HOLDS IT. A favour is owed TO its holder, which is the one
        // inversion in the ledger and is written down in `whichWayItPoints`.
        // This was authored the other way about, and so was `handOver` - the
        // two cite each other, which is how one mistake became two. Read back
        // through `whatStandsBetweenYouAndEverybody` it said *Owed by you to*
        // the person who had just been handed a gift.
        //
        // The title of this file's own test says the rule correctly: *what
        // somebody lost they hold against whoever has it; what they were handed
        // they owe for*. Whichever way a thing moves, the account weighs on
        // whoever ends up holding the thing.
        case 'gifted':
        case 'awarded': {
            if (!change.from || !change.to || change.from.id === change.to.id) return [];
            return [{
                kind: 'favor',
                holderId: change.from.id,
                subjectId: change.to.id,
                cause: 'gifted_resource',
                severity,
                onDay: change.onDay,
                description: change.note
                    ?? `${change.from.name} put ${what} into ${change.to.name}'s hands, `
                       + 'asking nothing for it.',
                triggeringEventId: change.triggeringEventId ?? null,
                participants: [change.from.id, change.to.id],
                tags
            }];
        }

        // ── LENT ─────────────────────────────────────────────────────────
        //
        // Its own cause and not `gifted_resource`, on the distinction
        // `AcquisitionMode` was given a `lent` row for: a lent thing is still
        // the lender's, and what the holder owes is the use of it rather than
        // the thing. `a-house-holds-its-own.ts` is emphatic that reading the
        // two alike reports somebody as freer than they are.
        //
        // The lender holds it, for the reason directly above. This comment's
        // own next sentence already says which way it points - *what the holder
        // owes is the use of it* - and the row was written so that the LENDER
        // owed the borrower for the loan.
        case 'lent': {
            if (!change.from || !change.to || change.from.id === change.to.id) return [];
            return [{
                kind: 'favor',
                holderId: change.from.id,
                subjectId: change.to.id,
                cause: 'lent_resource',
                severity,
                onDay: change.onDay,
                description: change.note
                    ?? `${change.from.name} let ${change.to.name} have the use of ${what}, `
                       + 'and can want it back.',
                triggeringEventId: change.triggeringEventId ?? null,
                participants: [change.from.id, change.to.id],
                tags
            }];
        }

        // Bought and sold are settled at the table. Inherited, found, crafted,
        // lost and unknown have nobody on the other end who is owed anything.
        default:
            return [];
    }
}

/**
 * Several changes of hands, collapsed to one account per pair and cause.
 *
 * A war settlement moves a whole hold in one afternoon and the loser does not
 * hold eleven separate grudges about it - they hold one, weighed by the worst
 * thing that went. This is `a-fact-that-keeps-happening-is-one-row.ts` applied
 * to the ledger, and it has to happen HERE rather than at the write: rows that
 * differ only in severity derive the same id, so the last one written would
 * win, and the last one is whichever object the loop reached last.
 *
 * Tags and participants union, so the collapsed row still names every object
 * that went.
 */
export function oneAccountEach(rows: readonly ObligationInput[]): ObligationInput[] {
    const pooled = new Map<string, ObligationInput>();
    for (const row of rows) {
        const key = [row.kind, row.holderId, row.subjectId ?? '', row.cause].join('');
        const held = pooled.get(key);
        if (!held) {
            pooled.set(key, { ...row, tags: [...(row.tags ?? [])], participants: [...(row.participants ?? [])] });
            continue;
        }
        pooled.set(key, {
            ...held,
            severity: worseOf(held.severity, row.severity),
            tags: union(held.tags, row.tags),
            participants: union(held.participants, row.participants)
        });
    }
    return [...pooled.values()];
}

function worseOf(a: Severity, b: Severity): Severity {
    return SEVERITY_ORDER[Math.max(severityRank(a), severityRank(b))]!;
}

function union(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] {
    return [...new Set([...(a ?? []), ...(b ?? [])])];
}
