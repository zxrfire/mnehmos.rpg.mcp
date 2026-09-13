/**
 * A house comes to hold a ruin, and every house that would have delved it
 * opens an account against it.
 *
 * ── WHAT `controllingFactionId` MEANS ON A RUIN ──────────────────────────
 *
 * Ground is public by agreement. A seat, a vein or a compound has an owner and
 * the column says who; a ruin has nobody, which is what made it a ruin, so the
 * same column on a ruin can only mean one thing - a house has shut something
 * everybody had a claim on. Nothing wrote it for a ruin before this (measured
 * over twelve pinned worlds: 0 of 144 at day 0, 0 of 445 at two hundred
 * years), so the column was free to take and carries no ordinary ownership to
 * be confused with.
 *
 * `whoTurnsYouAwayFrom` already reads it as somebody standing at the door, and
 * that is the whole downstream consequence: an unheld ruin is lethal and
 * unbarred, a held one turns you away.
 *
 * ── WHO IS ANGRY IS DERIVED, AND THE PROVINCE IS THE BOUND ───────────────
 *
 * The houses seated in the ruin's own province. A house four provinces away
 * loses nothing it was going to use, and the reading that decides who a house
 * sits down with (`circleCandidatesFor`) is the same rule with one filter
 * dropped: it drops anybody hostile either way, because you do not invite an
 * enemy to a competition. You do not have to invite one for it to hold a
 * grudge, so the hostility filter comes off and the province stays.
 *
 * ── WHAT IT TAKES ────────────────────────────────────────────────────────
 *
 * People standing on it. `sending-to-open-an-inheritance` is what the world
 * already says it takes to put a party on a find, and holding one against
 * everybody is at least that party, left there; the rung is the ground's own
 * bars, because somebody who cannot live there cannot be the door.
 *
 * ── WHAT IS NOT HERE ─────────────────────────────────────────────────────
 *
 * What an angry house DOES about it. `whatTheHouseDoesAboutIt` answers that
 * for a house and a PERSON it has caught, and a house answering a house is a
 * different set of parties; the accounts below are what it would read. Nor is
 * there a verb: nothing in `src/web/` reaches this yet.
 *
 * State in, deltas out. Nothing here writes a location, a ledger or a fact.
 */

import { SENDING_REASONS } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import type { ObligationInput, Severity } from '../social/grudges.js';
import { theProvinceAround } from './ground-holder.js';
import { makeFact, type PendingFact } from './history.js';
import { isBelowTheLid } from './layers.js';
import type { LocationPatch, LocationRecord } from './locations.js';
import { ordinaryBandFor } from './qi-scale.js';
import type { FactionRecord } from './world-state.js';

/** The tag every account opened by a monopoly carries. */
export const SHUT_TO_EVERYBODY_ELSE = 'monopoly';

/** Whether a record in the ledger is one of these. */
export function isAMonopolyAccount(record: { tags?: readonly string[] }): boolean {
    return (record.tags ?? []).includes(SHUT_TO_EVERYBODY_ELSE);
}

/** The house as this act needs it: a name, a seat, and who is on the road. */
export interface AHouseThatCouldShutIt {
    id: string;
    name: string;
    seatLocationId: string | null;
    /** Everybody it could leave standing there, by rung. */
    roster: readonly { id: string; name: string; ordinal: number }[];
}

export interface WhatItTakesToHoldIt {
    /** How many bodies, from the world's own price of putting a party on a find. */
    hands: number;
    /** The rung each of them has to stand at to be the door. */
    atOrdinal: number;
}

/**
 * The party it takes, off the ground's own bars and the catalog's own price.
 */
export function whatItTakesToHold(ruin: LocationRecord): WhatItTakesToHoldIt {
    const opening = SENDING_REASONS.find(r => r.needs === 'a_find');
    return {
        hands: opening?.hands ?? 1,
        // Living there and being the bar are two bars and the party needs both.
        atOrdinal: Math.max(ruin.thresholds.entry, ruin.thresholds.survival)
    };
}

export type WhyItCannotBeShut =
    /** Not a ruin, or already shut. You cannot monopolise a closed door. */
    | 'nothing_here_is_open'
    /** Somebody is already holding it, and that somebody may be you. */
    | 'somebody_already_holds_it'
    /** The house is seated somewhere else. You cannot watch a province away. */
    | 'it_is_not_in_your_province'
    /** Nobody on the roll can stand there long enough to turn anybody away. */
    | 'nobody_who_can_stand_there';

export interface ShuttingAPublicRuin {
    shut: boolean;
    /** Null when it was shut. */
    refusedBecause: WhyItCannotBeShut | null;
    /** What is here, why it is not yours, and what would change that. */
    reason: string;
    takes: WhatItTakesToHoldIt;
    /** Who the house would actually leave there. Empty on a refusal. */
    posted: readonly { id: string; name: string; ordinal: number }[];
    /** Houses that lose access, in the world's own order. */
    angered: readonly string[];
    /** How hard they take it. Empty on a refusal. */
    accounts: readonly ObligationInput[];
    /** Null on a refusal. Sets the column, and nothing else. */
    patch: LocationPatch | null;
    /** Null on a refusal. Public, because being quiet about it is not the act. */
    fact: PendingFact | null;
}

/**
 * The houses that lose access when this ground is shut.
 *
 * Asked on its own because it is the question a house asks BEFORE it shuts
 * anything, and because the answer is what the cost is made of.
 */
export function whoLosesAccessTo(
    ruin: LocationRecord,
    locations: readonly LocationRecord[],
    houses: readonly FactionRecord[],
    shutBy: string
): readonly FactionRecord[] {
    const province = theProvinceAround(locations, ruin.id);
    if (province === null) return [];
    return houses
        .filter(h =>
            h.id !== shutBy
            && h.dissolvedOnDay === null
            && isBelowTheLid(h)
            && theProvinceAround(locations, h.seatLocationId) === province)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * How hard a province takes it, off what it has left and what was taken.
 *
 * Two facts the record already holds and no third measure of anything: whether
 * there is other open ground within reach, and what this ground was worth. A
 * province with somewhere else to go is inconvenienced. A province with one
 * door and a spirit tide behind it is not.
 */
export function howBadlyItIsTaken(
    ruin: LocationRecord,
    locations: readonly LocationRecord[]
): Severity {
    const province = theProvinceAround(locations, ruin.id);
    const somewhereElse = province !== null && locations.some(l =>
        l.id !== ruin.id
        && l.kind === 'ruin'
        && !l.sealed
        && l.controllingFactionId === null
        && theProvinceAround(locations, l.id) === province);
    if (somewhereElse) return 'slight';
    switch (ordinaryBandFor(ruin.qiDensity)) {
        case 'spirit_tide': return 'unforgivable';
        case 'dense': return 'grave';
        default: return 'serious';
    }
}

/**
 * A house shuts a public ruin.
 */
export function shutAPublicRuin(input: {
    ruin: LocationRecord;
    house: AHouseThatCouldShutIt;
    locations: readonly LocationRecord[];
    houses: readonly FactionRecord[];
    onDay: number;
}): ShuttingAPublicRuin {
    const { ruin, house, locations, houses, onDay } = input;
    const takes = whatItTakesToHold(ruin);
    const refuse = (
        refusedBecause: WhyItCannotBeShut,
        reason: string
    ): ShuttingAPublicRuin => ({
        shut: false,
        refusedBecause,
        reason,
        takes,
        posted: [],
        angered: [],
        accounts: [],
        patch: null,
        fact: null
    });

    if (ruin.kind !== 'ruin' || ruin.sealed) {
        return refuse(
            'nothing_here_is_open',
            `${ruin.name} is not open ground anybody is walking into. `
            + 'A door already shut is nobody\'s to shut.'
        );
    }
    if (ruin.controllingFactionId !== null) {
        return refuse(
            'somebody_already_holds_it',
            `${ruin.name} already has somebody at the door. `
            + 'Taking it means taking it off them.'
        );
    }

    const province = theProvinceAround(locations, ruin.id);
    if (province === null || theProvinceAround(locations, house.seatLocationId) !== province) {
        return refuse(
            'it_is_not_in_your_province',
            `${ruin.name} is not in the province ${house.name} is seated in, `
            + 'and a watch that has to be walked to is not a watch.'
        );
    }

    const canStand = house.roster
        .filter(c => c.ordinal >= takes.atOrdinal)
        .sort((a, b) => b.ordinal - a.ordinal || (a.id < b.id ? -1 : 1));
    if (canStand.length < takes.hands) {
        return refuse(
            'nobody_who_can_stand_there',
            `Holding ${ruin.name} takes ${takes.hands} who can live at its door, `
            + `and ${house.name} has ${canStand.length}.`
        );
    }

    const posted = canStand.slice(0, takes.hands);
    const angered = whoLosesAccessTo(ruin, locations, houses, house.id);
    const severity = howBadlyItIsTaken(ruin, locations);
    const angeredIds = angered.map(h => h.id);
    const summary = `${house.name} closed ${ruin.name} to everybody else.`;

    return {
        shut: true,
        refusedBecause: null,
        reason: summary,
        takes,
        posted,
        angered: angeredIds,
        accounts: angered.map(other => ({
            kind: 'grudge' as const,
            holderId: other.id,
            subjectId: house.id,
            // What was actually done to them: the ground everybody advances on
            // is no longer ground they may walk onto.
            cause: 'blocked_advancement' as const,
            severity,
            onDay,
            description: summary,
            participants: angeredIds.filter(id => id !== other.id),
            tags: [SHUT_TO_EVERYBODY_ELSE, `ground:${ruin.id}`]
        })),
        patch: { controllingFactionId: house.id },
        fact: makeFact({
            day: onDay,
            kind: 'territory_changed',
            scale: 'regional',
            summary,
            locationId: ruin.id,
            factionIds: [house.id, ...angeredIds],
            // Everybody hears. A monopoly nobody knows about costs nothing,
            // and what makes this act expensive is that it is done in public.
            visibility: 'public',
            magnitude: 0.6,
            data: { hands: takes.hands, atOrdinal: takes.atOrdinal, angered: angeredIds.length }
        })
    };
}
