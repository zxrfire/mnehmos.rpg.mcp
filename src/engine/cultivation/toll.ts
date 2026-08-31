/**
 * The Toll - the Vault's instalment plan.
 *
 * > The Vault charges a toll, and the toll is paid downward.
 *
 * The world does not wait for ascension to start collecting. It takes an
 * instalment at every REALM BOUNDARY - never at a sub-rank step - and what it
 * takes is never a stat. It is a person who knew you and stops knowing you, a
 * memory you were using to stay yourself, a technique you had mastered gone as
 * if never learned, or in the worst cases your name.
 *
 * Two properties of this system are load-bearing and easy to get wrong:
 *
 *  1. IT IS ROLLED, NOT GUARANTEED. "The path is soaked in blood, but it is not
 *     evenly distributed blood." Some cultivators climb four realms and lose
 *     nothing and are insufferable about it. Others lose a brother at
 *     Foundation Establishment and never get another thing taken. A guaranteed
 *     toll would be a tax; a rolled one is a fear, and fear is the point.
 *
 *  2. THE CULTIVATOR NEVER CHOOSES. When the roll goes against you the engine
 *     selects from what the run ACTUALLY accumulated - real bonds with real
 *     NPCs, real memories, real techniques in the database - and then you are
 *     told. The horror is that it is legible: you can read the ledger and see
 *     the shape of who you used to be.
 *
 * The odds move, and they move on things the player can act on, which is what
 * makes the system a decision rather than a die roll:
 *
 *   Fortune           - the attribute that can legally come up zero decides
 *                       whether the Vault notices you on the way past.
 *   Sect protection   - a sect spending real resources on a disciple's
 *                       crossing. This is most of why anyone tolerates a sect,
 *                       and it is why sects let you know precisely what the
 *                       protection cost them.
 *   Preparation       - the right pill, a stable site, dense ash, an unhurried
 *                       crossing. Cultivators who break through in a cave they
 *                       chose live differently from cultivators who break
 *                       through in a ditch because something was chasing them.
 *   The Severed path  - paid in advance, on their own terms. They cross clean.
 *                       That is the whole argument of their path, and it works.
 *   Foundation        - the Vault reaches into structure. A foundation with
 *                       holes in it is easier to reach into.
 *
 * No I/O, no database, no LLM. The caller supplies candidates drawn from real
 * rows and applies whatever comes back.
 */

import {
    type AmbientQi,
    type Cultivator,
    type TollCandidate,
    type TollKind,
    type TollResult,
    type TollTaken
} from '../../schema/cultivation.js';
import {
    FOUNDATION_ORDINAL,
    MAX_ORDINAL,
    REALM_TIERS,
    isRealmBoundary,
    rankName,
    realmForOrdinal
} from './realms.js';
import { foundationEffect, foundationOf } from './foundation.js';
import type { CultivationRNG } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// BOUNDARY INDEXING
// ─────────────────────────────────────────────────────────────────────────

/** Ordinals a cultivator crosses FROM to change realm: 12, 16, 20, ... 40. */
export const TOLL_BOUNDARY_ORDINALS: readonly number[] = REALM_TIERS.slice(0, -1).map(
    t => t.ordinalEnd
);

/**
 * Which instalment this is, counting from 0 at the 12 -> 13 crossing into
 * Foundation Establishment. Returns -1 for an ordinal that is not a boundary.
 *
 * This is the number the world bible is quoting when it says a Void Refinement
 * cultivator "has crossed five boundaries and rolled five times".
 */
export function tollBoundaryIndex(fromOrdinal: number): number {
    return TOLL_BOUNDARY_ORDINALS.indexOf(fromOrdinal);
}

/** Whether crossing from this ordinal is charged at all. Sub-ranks are free. */
export function isTolled(fromOrdinal: number): boolean {
    return isRealmBoundary(fromOrdinal) && fromOrdinal < MAX_ORDINAL;
}

// ─────────────────────────────────────────────────────────────────────────
// TUNING
// Calibrated against the world bible's own arithmetic: a Void Refinement
// cultivator has rolled five times and "most do not" still have a family, so
// five unprotected rolls must usually take at least one thing. At the base
// curve below an unmodified cultivator faces 0.30 / 0.35 / 0.40 / 0.45 / 0.50
// across those five, which clears something roughly 89% of the time - while
// still leaving "some climb four realms and lose nothing" at about one run in
// eight. Both halves of that sentence have to be true.
// ─────────────────────────────────────────────────────────────────────────

/** Risk at the first boundary, 12 -> 13 into Foundation Establishment. */
export const TOLL_BASE_RISK = 0.3;
/** Added risk per boundary climbed. The Vault pays more attention higher up. */
export const TOLL_RISK_PER_BOUNDARY = 0.05;

/** Risk removed per point of Fortune. Zero Fortune buys nothing, by design. */
export const TOLL_FORTUNE_RELIEF = 0.08;
/** Risk removed by a sect spending everything it has on one crossing. */
export const MAX_SECT_PROTECTION = 0.3;
/** Risk removed by a perfectly prepared crossing. */
export const MAX_PREPARATION_RELIEF = 0.15;
/** Risk added by crossing under pressure, in a ditch, out of time. */
export const HURRIED_CROSSING_RISK = 0.15;

/** Ambient ash contribution to toll risk. Thin ash leaves you exposed. */
export const TOLL_AMBIENT_RISK: Record<AmbientQi, number> = {
    thin: 0.1,
    normal: 0,
    dense: -0.08,
    spirit_tide: -0.12
};

/**
 * Floor and ceiling. Never zero and never certain, for the same reason
 * breakthrough odds are clamped: the Vault is never merciful and never
 * exhaustive. The Severed path is the single documented exception and it
 * bypasses the clamp entirely, because crossing clean is the whole argument of
 * that path and it is supposed to work.
 */
export const MIN_TOLL_RISK = 0.02;
export const MAX_TOLL_RISK = 0.95;

/**
 * The first boundary at which the Vault can reach a cultivator's NAME.
 *
 * Crossing FROM 24 enters Deity Transformation - "Body and soul merge. You are
 * no longer human." Below that the name is still attached to something the
 * Vault can see as a person. This is the "rarely, and only at high boundaries"
 * clause, and it is why asking a Void Refinement cultivator what their mother's
 * name was tells you which kind you are talking to.
 */
export const NAME_ELIGIBLE_FROM_ORDINAL = 24;

/**
 * Selection weight the name carries once eligible, against the summed weights
 * of every bond, memory and technique the run has accumulated. Deliberately
 * small: a well-connected cultivator with forty bonds will almost never lose
 * their name, and a hollow one with two will lose it often. The Vault takes
 * what is there.
 */
export const NAME_BASE_WEIGHT = 1.5;
export const NAME_WEIGHT_PER_BOUNDARY = 1;

// ─────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────

/**
 * A candidate as callers hand it in. `weight` is optional here and defaults to
 * 1, so a caller with no opinion about relative mattering can simply list what
 * the run has; the schema's parsed `TollCandidate` requires it.
 */
export type TollCandidateInput = Omit<TollCandidate, 'weight'> & { weight?: number };

export interface TollConditions {
    /**
     * What the run actually accumulated, drawn from real rows. Order does not
     * matter; the selection sorts before weighting so a caller's query order
     * cannot change what is taken.
     */
    candidates?: TollCandidateInput[];
    /**
     * Resources a sect has committed to this crossing, 0..1. Formations, elders
     * holding the qi steady, pills nobody at this realm could afford. The
     * caller composes it from sect standing and what the sect actually spent.
     */
    sectProtection?: number;
    /** How well the crossing was prepared, 0..1. */
    preparation?: number;
    /** Crossed under pressure - pursued, ambushed, out of time. */
    hurried?: boolean;
    /**
     * The cultivator walks the Severed path and has already cut their own
     * bonds, memories and name in advance, on their own terms. They cross
     * clean. The caller is responsible for having actually removed what was
     * cut - this flag asserts the price was paid, it does not pay it.
     */
    severed?: boolean;
    /** The name is already gone; the Vault cannot take it twice. */
    nameAlreadyTaken?: boolean;
}

export interface TollContext extends TollConditions {
    rng: CultivationRNG;
    ambient: AmbientQi;
}

// ─────────────────────────────────────────────────────────────────────────
// EVALUATION
// ─────────────────────────────────────────────────────────────────────────

export interface TollModifier {
    source: string;
    delta: number;
}

/**
 * Charge the toll for a successful realm-boundary crossing.
 *
 * Consumes EXACTLY THREE samples from `ctx.rng` on every path - the risk roll,
 * the category roll and the item roll - whatever the outcome. The fixed sample
 * count is deliberate: it means a caller may hand this the same stream it used
 * for the breakthrough itself without the toll's outcome shifting anything
 * drawn afterwards, and it means adding a candidate category later will not
 * invalidate existing replays.
 *
 * Throws if asked to charge a sub-rank step. The Vault does not take
 * instalments on the small steps, and a caller that thinks otherwise has a bug.
 */
export function evaluateToll(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'attributes'> &
        Partial<Pick<Cultivator, 'foundationQuality' | 'name'>>,
    ctx: TollContext
): TollResult {
    const fromOrdinal = cultivator.realmOrdinal;
    if (!isTolled(fromOrdinal)) {
        throw new Error(
            `No toll is charged crossing from ${rankName(fromOrdinal)}: ` +
            'the Vault takes instalments at realm boundaries, not sub-rank steps.'
        );
    }

    const boundaryIndex = tollBoundaryIndex(fromOrdinal);
    const modifiers = computeTollModifiers(cultivator, ctx, boundaryIndex);
    const raw = modifiers.reduce((sum, m) => sum + m.delta, 0);

    // ── The Severed cross clean. ──
    // Booked as a line item that zeroes the running total rather than as an
    // early return, so `sum(modifiers) === risk` stays an exact identity on
    // every path and the UI can show the player precisely what their path
    // bought them.
    let risk: number;
    if (ctx.severed) {
        modifiers.push({ source: 'severed_path:prepaid', delta: -raw });
        risk = 0;
    } else {
        risk = Math.max(MIN_TOLL_RISK, Math.min(MAX_TOLL_RISK, raw));
        if (risk !== raw) {
            modifiers.push({
                source: risk > raw ? 'clamp:floor' : 'clamp:ceiling',
                delta: risk - raw
            });
        }
    }

    // Three samples, always, in a fixed order.
    const riskRoll = ctx.rng.next();
    const categoryRoll = ctx.rng.next();
    const itemRoll = ctx.rng.next();

    const toOrdinal = fromOrdinal + 1;
    const frame = { fromOrdinal, toOrdinal, boundaryIndex, risk, modifiers, roll: riskRoll };

    if (ctx.severed) {
        return {
            ...frame,
            outcome: 'prepaid',
            taken: null,
            narrationHint:
                `${rankName(fromOrdinal)} to ${rankName(toOrdinal)}. The Severed pay in advance, ` +
                'on their own terms. Nothing was taken at the crossing because there was nothing left owing.'
        };
    }

    if (riskRoll >= risk) {
        return {
            ...frame,
            outcome: 'clean',
            taken: null,
            narrationHint:
                `${rankName(fromOrdinal)} to ${rankName(toOrdinal)}. The Vault took nothing at this ` +
                `boundary. Risk was ${(risk * 100).toFixed(1)}%.`
        };
    }

    const taken = selectToll(cultivator, ctx, boundaryIndex, categoryRoll, itemRoll);

    if (taken === null) {
        // Nothing left worth taking. This is not a reprieve - it is the Hollow
        // Court condition arriving early, and it is the correct answer for a
        // cultivator who has already been emptied out.
        return {
            ...frame,
            outcome: 'nothing_left',
            taken: null,
            narrationHint:
                `${rankName(fromOrdinal)} to ${rankName(toOrdinal)}. The Vault reached in and found ` +
                'nothing worth taking. There was nothing left that mattered.'
        };
    }

    return {
        ...frame,
        outcome: 'taken',
        taken,
        narrationHint:
            `${rankName(fromOrdinal)} to ${rankName(toOrdinal)}. The Vault took ${describeTakenKind(taken.kind)}: ` +
            `${taken.label}. ${taken.reason}`
    };
}

function computeTollModifiers(
    cultivator: Pick<Cultivator, 'attributes'> & Partial<Pick<Cultivator, 'foundationQuality'>>,
    ctx: Omit<TollContext, 'rng'>,
    boundaryIndex: number
): TollModifier[] {
    const modifiers: TollModifier[] = [
        {
            source: `base:boundary_${boundaryIndex}`,
            delta: TOLL_BASE_RISK + boundaryIndex * TOLL_RISK_PER_BOUNDARY
        },
        {
            // Fortune is the only innate attribute that touches the toll, and
            // it is the one that can legally be zero. That is the design: for
            // most people the Vault simply notices.
            //
            // Normalised through `unsigned` so Fortune 0 books a clean 0 rather
            // than -0, which a UI would render as "-0.00" and read as a penalty.
            source: 'fortune',
            delta: unsigned(-cultivator.attributes.fortune * TOLL_FORTUNE_RELIEF)
        },
        {
            source: `ambient_ash:${ctx.ambient}`,
            delta: TOLL_AMBIENT_RISK[ctx.ambient]
        }
    ];

    const sectProtection = clamp01(ctx.sectProtection ?? 0);
    if (sectProtection > 0) {
        modifiers.push({
            source: 'sect_protection',
            delta: -sectProtection * MAX_SECT_PROTECTION
        });
    }

    const preparation = clamp01(ctx.preparation ?? 0);
    if (preparation > 0) {
        modifiers.push({
            source: 'preparation',
            delta: -preparation * MAX_PREPARATION_RELIEF
        });
    }

    if (ctx.hurried) {
        modifiers.push({ source: 'hurried_crossing', delta: HURRIED_CROSSING_RISK });
    }

    const foundation = foundationOf(cultivator);
    const foundationDelta = foundationEffect(foundation).tollModifier;
    if (foundationDelta !== 0) {
        modifiers.push({ source: `foundation:${foundation}`, delta: foundationDelta });
    }

    return modifiers;
}

// ─────────────────────────────────────────────────────────────────────────
// SELECTION
// What gets taken, and why that one.
// ─────────────────────────────────────────────────────────────────────────

const KIND_ORDER: readonly TollCandidate['kind'][] = ['bond', 'memory', 'technique'] as const;

/**
 * Choose what the Vault takes.
 *
 * Weighted by how much each thing mattered, because the world bible is
 * unambiguous that the toll "is always something that *mattered*". A higher
 * weight is MORE likely to be taken, not less - the Vault is not looking for
 * the cheapest item, it is looking for the one holding you together.
 *
 * Candidates are sorted by (kind, id) before weighting so that a caller's query
 * order - which is not part of game state - can never change the outcome.
 * Returns null when there is nothing left worth taking.
 */
function selectToll(
    cultivator: Partial<Pick<Cultivator, 'name'>>,
    ctx: TollContext,
    boundaryIndex: number,
    categoryRoll: number,
    itemRoll: number
): TollTaken | null {
    const candidates: TollCandidate[] = (ctx.candidates ?? [])
        .map(c => ({ ...c, weight: c.weight ?? 1 }))
        .filter(c => Number.isFinite(c.weight) && c.weight > 0)
        .sort(compareCandidates);

    const name = cultivator.name ?? '';
    const nameWeight = name.length > 0 ? nameSelectionWeight(ctx, boundaryIndex) : 0;

    // Category weights: the summed mattering of each kind, plus the name.
    const kindWeights = new Map<TollKind, number>();
    for (const kind of KIND_ORDER) {
        const total = candidates
            .filter(c => c.kind === kind)
            .reduce((sum, c) => sum + c.weight, 0);
        if (total > 0) kindWeights.set(kind, total);
    }
    if (nameWeight > 0) kindWeights.set('name', nameWeight);

    const totalWeight = [...kindWeights.values()].reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) return null;

    // Pick the category. Iteration order over KIND_ORDER + name is fixed.
    const orderedKinds: TollKind[] = [...KIND_ORDER, 'name'].filter(k =>
        kindWeights.has(k as TollKind)
    ) as TollKind[];

    let cursor = categoryRoll * totalWeight;
    let chosenKind: TollKind = orderedKinds[orderedKinds.length - 1];
    for (const kind of orderedKinds) {
        cursor -= kindWeights.get(kind)!;
        if (cursor < 0) {
            chosenKind = kind;
            break;
        }
    }

    if (chosenKind === 'name') {
        return {
            kind: 'name',
            id: null,
            label: name,
            reason:
                'Taken at a boundary above Deity Transformation, where there was no longer a person for it to be attached to. ' +
                'People will have to be told it, every time.'
        };
    }

    const pool = candidates.filter(c => c.kind === chosenKind);
    const poolWeight = pool.reduce((sum, c) => sum + c.weight, 0);
    let itemCursor = itemRoll * poolWeight;
    let chosen = pool[pool.length - 1];
    for (const candidate of pool) {
        itemCursor -= candidate.weight;
        if (itemCursor < 0) {
            chosen = candidate;
            break;
        }
    }

    return {
        kind: chosen.kind,
        id: chosen.id,
        label: chosen.label,
        reason: TAKEN_REASONS[chosen.kind]
    };
}

/**
 * Zero unless the boundary is high enough AND the name is still there. A caller
 * that did not supply a name has handed the engine nothing legible to take, and
 * the Vault does not take what it cannot read.
 */
function nameSelectionWeight(ctx: TollContext, boundaryIndex: number): number {
    if (ctx.nameAlreadyTaken) return 0;
    const eligibleIndex = tollBoundaryIndex(NAME_ELIGIBLE_FROM_ORDINAL);
    if (boundaryIndex < eligibleIndex) return 0;
    return NAME_BASE_WEIGHT + (boundaryIndex - eligibleIndex) * NAME_WEIGHT_PER_BOUNDARY;
}

/** Deterministic ordering, independent of however the caller queried. */
function compareCandidates(a: TollCandidate, b: TollCandidate): number {
    const kindDelta = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (kindDelta !== 0) return kindDelta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const TAKEN_REASONS: Record<TollCandidate['kind'], string> = {
    bond: 'They will not know the cultivator on sight again, and will not remember having known them.',
    memory: 'It is gone as if it had never been formed. The cultivator knows only that something was there.',
    technique: 'The art is gone as if never learned. The manual, if it still exists, will have to be studied again from the first page.'
};

function describeTakenKind(kind: TollKind): string {
    switch (kind) {
        case 'bond': return 'a person who knew them';
        case 'memory': return 'a memory';
        case 'technique': return 'a mastered technique';
        case 'name': return 'their name';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// INSPECTION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Toll risk without rolling, for a UI that wants to show a player what
 * crossing now would expose them to. Same arithmetic, no samples consumed.
 */
export function computeTollRisk(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'attributes'> &
        Partial<Pick<Cultivator, 'foundationQuality'>>,
    ctx: Omit<TollContext, 'rng'>
): { risk: number; modifiers: TollModifier[]; boundaryIndex: number } {
    const boundaryIndex = tollBoundaryIndex(cultivator.realmOrdinal);
    if (boundaryIndex < 0) {
        return { risk: 0, modifiers: [], boundaryIndex };
    }
    const modifiers = computeTollModifiers(cultivator, ctx, boundaryIndex);
    const raw = modifiers.reduce((sum, m) => sum + m.delta, 0);
    if (ctx.severed) {
        modifiers.push({ source: 'severed_path:prepaid', delta: -raw });
        return { risk: 0, modifiers, boundaryIndex };
    }
    const risk = Math.max(MIN_TOLL_RISK, Math.min(MAX_TOLL_RISK, raw));
    if (risk !== raw) {
        modifiers.push({
            source: risk > raw ? 'clamp:floor' : 'clamp:ceiling',
            delta: risk - raw
        });
    }
    return { risk, modifiers, boundaryIndex };
}

/**
 * How many instalments a cultivator standing at this ordinal has already been
 * charged. The number behind "a Void Refinement cultivator has crossed five
 * boundaries and rolled five times".
 */
export function boundariesCrossed(ordinal: number): number {
    if (ordinal < FOUNDATION_ORDINAL) return 0;
    return TOLL_BOUNDARY_ORDINALS.filter(b => b < ordinal).length;
}

/** The realm a cultivator lands in when this boundary is crossed. */
export function realmEnteredAt(fromOrdinal: number): string {
    return realmForOrdinal(Math.min(MAX_ORDINAL, fromOrdinal + 1)).name;
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

/** Collapse -0 to 0. Only ever cosmetic, and always worth it in a ledger. */
function unsigned(n: number): number {
    return n === 0 ? 0 : n;
}
