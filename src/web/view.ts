/**
 * Domain shapes to wire shapes.
 *
 * The browser is a display, not a second engine, so nothing here computes a
 * game value. Every field is either copied from a domain object or derived by
 * calling the engine's own function for it — `rankName`, `lifespanForOrdinal`,
 * `progressRequiredForOrdinal`, `canAttemptBreakthrough`. If a number appears
 * on the wire that this module invented, that number is a bug.
 *
 * The one thing this layer does own is *omission*: `run.seed` is not sent. It
 * is not a secret in a single-operator deployment, but nothing in the client
 * needs it and a value the client cannot use is a value it cannot be wrong
 * about.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import {
    MAX_ORDINAL,
    fullLadder,
    lifespanForOrdinal,
    progressRequiredForOrdinal,
    rankName,
    realmForOrdinal,
    type LadderEntry
} from '../engine/cultivation/realms.js';
import {
    ATTRIBUTES,
    SPIRIT_ROOTS,
    getSpiritRoot,
    rootProbability
} from '../engine/cultivation/spirit-roots.js';
import { canAttemptBreakthrough } from '../engine/cultivation/breakthrough.js';
import { untreatedInjuryCount } from '../engine/cultivation/injuries.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';

// ─────────────────────────────────────────────────────────────────────────
// REFERENCE
// ─────────────────────────────────────────────────────────────────────────

export interface LadderView {
    ranks: LadderEntry[];
}

/** All 45 rungs. Straight from the engine's own table. */
export function ladderView(): LadderView {
    return { ranks: fullLadder() };
}

export interface SpiritRootView {
    key: string;
    name: string;
    grade: string;
    elements: string[];
    /** Draw probability as a fraction of 1, from the engine's weight table. */
    probability: number;
    cultivationSpeed: number;
    description: string;
}

export interface AttributeView {
    key: string;
    name: string;
    min: number;
    max: number;
    description: string;
}

export interface SpiritRootsView {
    roots: SpiritRootView[];
    attributes: AttributeView[];
}

export function spiritRootsView(): SpiritRootsView {
    return {
        roots: SPIRIT_ROOTS.map(root => ({
            key: root.key,
            name: root.name,
            grade: root.grade,
            elements: [...root.elements],
            probability: Number(rootProbability(root.key).toFixed(6)),
            cultivationSpeed: root.cultivationSpeed,
            description: root.description
        })),
        attributes: ATTRIBUTES.map(attr => ({
            key: attr.key,
            name: attr.name,
            min: attr.min,
            max: attr.max,
            description: attr.description
        }))
    };
}

// ─────────────────────────────────────────────────────────────────────────
// RUN AND CULTIVATOR
// ─────────────────────────────────────────────────────────────────────────

export interface RunView {
    id: string;
    cultivatorId: string;
    status: Run['status'];
    turn: number;
    elapsedDays: number;
    startedAt: string;
    endedAt: string | null;
    deathCause: Run['deathCause'];
    deathDescription: string | null;
    peakOrdinal: number;
    peakRankName: string;
}

export function runView(run: Run): RunView {
    return {
        id: run.id,
        cultivatorId: run.cultivatorId,
        status: run.status,
        turn: run.turn,
        elapsedDays: run.elapsedDays,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        deathCause: run.deathCause,
        deathDescription: run.deathDescription,
        peakOrdinal: run.peakOrdinal,
        peakRankName: rankName(run.peakOrdinal)
    };
}

/**
 * The cultivator, unchanged.
 *
 * Passed through rather than re-shaped on purpose: the client's character sheet
 * shows exactly what the database holds, so a discrepancy between the two is
 * impossible by construction rather than by care.
 */
export function cultivatorView(cultivator: Cultivator): Cultivator {
    return cultivator;
}

export interface DerivedView {
    rankName: string;
    nextRankName: string | null;
    realmName: string;
    progressRequired: number;
    breakthroughReady: boolean;
    /** May be negative for a cultivator living past the realm's ceiling. */
    lifespanRemaining: number;
    untreatedInjuries: number;
    /**
     * The sect's display name, resolved server-side from `cultivator.sectId`.
     *
     * Null when unaffiliated, and null rather than the id when the id resolves
     * to nothing: a sheet showing `sect_azure` to a player is showing them a
     * database key, and a missing name is a smaller lie than a raw identifier.
     */
    sectName: string | null;
    /** What the rank is standing on. 'none' below Foundation Establishment. */
    foundationQuality: Cultivator['foundationQuality'];
    /** True once the Vault has taken the name. People have to be told it. */
    nameTaken: boolean;
}

export interface DerivedContext {
    sectName?: string | null;
    nameTaken?: boolean;
}

/** Everything the sheet needs that is a function of the cultivator, not a field of it. */
export function derivedView(cultivator: Cultivator, context: DerivedContext = {}): DerivedView {
    const ordinal = cultivator.realmOrdinal;
    return {
        rankName: rankName(ordinal),
        nextRankName: ordinal >= MAX_ORDINAL ? null : rankName(ordinal + 1),
        realmName: realmForOrdinal(ordinal).name,
        progressRequired: progressRequiredForOrdinal(ordinal),
        breakthroughReady: canAttemptBreakthrough(cultivator).eligible,
        lifespanRemaining: lifespanForOrdinal(ordinal) - cultivator.age,
        untreatedInjuries: untreatedInjuryCount(cultivator.injuries),
        sectName: context.sectName ?? null,
        foundationQuality: cultivator.foundationQuality,
        nameTaken: context.nameTaken ?? false
    };
}

// ─────────────────────────────────────────────────────────────────────────
// LEDGER AND ROSTER
// ─────────────────────────────────────────────────────────────────────────

export interface LedgerRowView {
    id: string;
    name: string;
    peakOrdinal: number;
    peakRankName: string;
    turn: number;
    elapsedDays: number;
    deathCause: Run['deathCause'];
    deathDescription: string | null;
    endedAt: string | null;
}

export function ledgerRowView(run: Run, name: string): LedgerRowView {
    return {
        id: run.id,
        name,
        peakOrdinal: run.peakOrdinal,
        peakRankName: rankName(run.peakOrdinal),
        turn: run.turn,
        elapsedDays: run.elapsedDays,
        deathCause: run.deathCause,
        deathDescription: run.deathDescription,
        endedAt: run.endedAt
    };
}

export interface RosterRowView extends RosterEntry {
    isPlayer: boolean;
    spiritRootName: string;
    rankName: string;
    realmName: string;
    lifespanYears: number;
}

/**
 * One roster row. The repository ships facts; the display names are added here,
 * which is where its own doc comment says they belong.
 */
export function rosterRowView(entry: RosterEntry, playerCultivatorId: string | null): RosterRowView {
    return {
        ...entry,
        isPlayer: entry.id === playerCultivatorId,
        spiritRootName: getSpiritRoot(entry.spiritRoot).name,
        rankName: rankName(entry.realmOrdinal),
        realmName: realmForOrdinal(entry.realmOrdinal).name,
        lifespanYears: lifespanForOrdinal(entry.realmOrdinal)
    };
}
