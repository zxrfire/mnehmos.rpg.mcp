/**
 * Regard - the one generic answer the world gives, keyed on how far above or
 * below a gate the asker stands.
 *
 * Measured, not guessed: across a sixteen-position by thirty-ask sweep,
 * twenty-three of the thirty asks returned an identical answer at every height on
 * the ladder. `I gather what herbs I can find` gave a False Immortal at ordinal
 * 45 exactly what it gave a beginner at ordinal 0, because every catalog was
 * using its rung column as a floor and for nothing else.
 *
 * The band carries every multiplier an ordinary resolver needs. There is no
 * per-catalog rule and there must never be one.
 */

import {
    APPROACH_LEVERAGE_PRESSURE,
    APPROACH_PATIENCE_EFFECT,
    APPROACH_PIERCING_AUDIENCES,
    APPROACH_PRESSURE_LIMIT,
    APPROACH_TONE_PRESSURE,
    REGARD_BANDS,
    type Approach,
    type RegardBand,
    type RegardBandRow,
    type RegardProfile
} from '../../schema/cultivation.js';
import { MAX_ORDINAL, clampOrdinal, rankName } from './realms.js';

// THE ASKER

/**
 * Who is standing there. A bare number is accepted everywhere a full asker is,
 * so no existing call site has to change shape to get the new behaviour.
 */
export interface RegardAsker {
    /** The rung they are actually at. The ground reads this and nothing else. */
    readonly ordinal: number;
    /** What the narrator said about the attempt. Optional in every case. */
    readonly approach?: Approach;
}

export type RegardAskerInput = number | RegardAsker;

function toAsker(input: RegardAskerInput): RegardAsker {
    return typeof input === 'number' ? { ordinal: input } : input;
}

// THE APPROACH, REDUCED TO TWO NUMBERS

/**
 * Whether a concealed rung survives the room.
 */
export function concealmentHolds(actualOrdinal: number, approach?: Approach): boolean {
    if (!approach?.concealed) return false;
    if (approach.presentedAs === undefined) return false;
    if (approach.presentedAs >= actualOrdinal) return false;
    if (approach.audience && APPROACH_PIERCING_AUDIENCES.includes(approach.audience)) return false;
    if (approach.witnessOrdinal !== undefined && approach.witnessOrdinal >= actualOrdinal) return false;
    return true;
}

/**
 * The rung the room believes it is dealing with. Equal to the real one unless
 * a concealment was declared and held.
 */
export function apparentOrdinal(actualOrdinal: number, approach?: Approach): number {
    const actual = clampOrdinal(actualOrdinal);
    return concealmentHolds(actual, approach)
        ? clampOrdinal(approach!.presentedAs!)
        : actual;
}

/**
 * Tone plus leverage, clamped to +/- two rungs.
 */
export function approachPressure(approach?: Approach): number {
    if (!approach) return 0;
    const tone = APPROACH_TONE_PRESSURE[approach.tone ?? 'plain'];
    const leverage = APPROACH_LEVERAGE_PRESSURE[approach.leverage ?? 'none'];
    const raw = tone + leverage;
    return Math.max(-APPROACH_PRESSURE_LIMIT, Math.min(APPROACH_PRESSURE_LIMIT, raw));
}

// THE GATE - the one column every catalog already has

/**
 * The gate columns, in the order they are believed.
 */
const GATE_COLUMNS = [
    'gateOrdinal',
    'requiredOrdinal',
    'harvestOrdinal',
    'minOrdinal',
    'admissionOrdinal',
    'ordinal',
    'threatOrdinal',
    'powerOrdinal'
] as const;

/** The `regard` column, when a record carries one. */
export function regardProfileOf(record: unknown): RegardProfile | undefined {
    if (!record || typeof record !== 'object') return undefined;
    const profile = (record as { regard?: unknown }).regard;
    return profile && typeof profile === 'object' ? (profile as RegardProfile) : undefined;
}

/**
 * What rung this record is pitched at, or null when it is not pitched at one.
 *
 * Reads `regard.gate` first so a record can override, then the domain columns
 * in `GATE_COLUMNS`. Nothing here branches on what kind of record it is.
 */
export function gateOrdinalOf(record: unknown): number | null {
    const profile = regardProfileOf(record);
    if (typeof profile?.gate === 'number') return clampOrdinal(profile.gate);
    if (!record || typeof record !== 'object') return null;
    const row = record as Record<string, unknown>;
    for (const column of GATE_COLUMNS) {
        const value = row[column];
        if (typeof value === 'number' && Number.isFinite(value)) return clampOrdinal(value);
    }
    return null;
}

// THE RESOLVER

export interface Regard {
    /** The rung the ask is pitched at. */
    readonly gate: number;
    /** Real ordinal minus gate, after `span`. What the ground reads. */
    readonly gap: number;
    /** Apparent ordinal minus gate, after `span` and pressure. What the room reads. */
    readonly socialGap: number;
    /** The band the room acts on. */
    readonly band: RegardBand;
    /** The band the ground acts on. Equal to `band` when nothing was concealed. */
    readonly physicalBand: RegardBand;
    /** Does the world put this forward unprompted. */
    readonly offered: boolean;
    /** Does the world decline to transact even when asked directly. */
    readonly refused: boolean;
    /** How much comes back, against a base of one. Physical, times patience. */
    readonly yieldMultiplier: number;
    /** How long it takes, against the base. Physical, times patience. */
    readonly durationMultiplier: number;
    /** What it costs to buy, against list. Social. */
    readonly priceMultiplier: number;
    /** What a fight or hazard here costs, against base. Physical. */
    readonly damageMultiplier: number;
    /** Engine-authored factual line, `{gap}` already filled. Never narration. */
    readonly reaction: string;
    /** True when a declared concealment survived the room. */
    readonly concealed: boolean;
    /** The rung the room believes. */
    readonly apparentOrdinal: number;
    /** The rung they are actually at. */
    readonly actualOrdinal: number;
    /** Rungs of influence the approach bought, in [-2, 2]. */
    readonly pressure: number;
    /** Echoed straight back so a narrator can see what it handed over. */
    readonly intent: string | null;
    readonly note: string | null;
}

function rowFor(gap: number): RegardBandRow {
    for (const row of REGARD_BANDS) {
        if (gap >= row.minGap && gap <= row.maxGap) return row;
    }
    // Unreachable: the windows cover the integer line. Kept as a loud default
    // rather than a non-null assertion so a bad edit to the table fails here.
    return REGARD_BANDS[REGARD_BANDS.length - 1];
}

/** Look a raw gap up in the table. Exported because tests pin the windows. */
export function bandForGap(gap: number): RegardBand {
    return rowFor(gap).band;
}

/**
 * `span` widens or narrows how far up the ladder a record keeps being taken
 * seriously. Applied by dividing the gap, and truncated toward zero so a
 * record never crosses the `matched` boundary through rounding alone.
 */
function scaleGap(gap: number, span: number | undefined): number {
    if (!span || span === 1) return gap;
    return Math.trunc(gap / span);
}

/**
 * The whole answer, for one asker against one gate.
 */
export function regardFor(
    gate: number | null,
    askerInput: RegardAskerInput,
    profile?: RegardProfile
): Regard {
    const asker = toAsker(askerInput);
    const approach = asker.approach;
    const actual = clampOrdinal(asker.ordinal);
    const apparent = apparentOrdinal(actual, approach);
    const concealed = apparent !== actual;
    const pressure = approachPressure(approach);
    const patience = APPROACH_PATIENCE_EFFECT[approach?.patience ?? 'normal'];

    const resolvedGate = gate === null ? null : clampOrdinal(gate);

    const rawGap = resolvedGate === null ? 0 : actual - resolvedGate;
    const rawSocialGap = resolvedGate === null ? 0 : apparent - resolvedGate + pressure;

    const gap = scaleGap(rawGap, profile?.span);
    const socialGap = scaleGap(rawSocialGap, profile?.span);

    const physicalRow = rowFor(gap);
    const socialRow = rowFor(socialGap);

    const offered = profile?.alwaysOffered === true
        ? true
        : profile?.neverOffered === true
            ? false
            : socialRow.offered;

    const reactionTemplate = profile?.reaction ?? socialRow.reaction;

    return {
        gate: resolvedGate ?? 0,
        gap,
        socialGap,
        band: socialRow.band,
        physicalBand: physicalRow.band,
        offered,
        refused: socialRow.refused && profile?.alwaysOffered !== true,
        yieldMultiplier: physicalRow.yieldMultiplier * patience.yield,
        durationMultiplier: physicalRow.durationMultiplier * patience.duration,
        priceMultiplier: socialRow.priceMultiplier,
        damageMultiplier: physicalRow.damageMultiplier,
        reaction: fillReaction(reactionTemplate, socialGap, apparent),
        concealed,
        apparentOrdinal: apparent,
        actualOrdinal: actual,
        pressure,
        intent: approach?.intent ?? null,
        note: approach?.note ?? null
    };
}

/**
 * Fill the factual slots. `{gap}` is stated as a magnitude because the band
 * name already carries the direction, and `{rank}` is how the room would name
 * the asker.
 */
function fillReaction(template: string, gap: number, apparent: number): string {
    const magnitude = Math.abs(gap);
    return template
        // THE NOUN GOES WITH THE NUMBER
        //
        // "Pitched 1 rungs from where they stand" - found in play, on a hunt.
        // `{gap} rungs` is one phrase and filling the number without the noun
        // reads as the engine's arithmetic showing through the prose, which is
        // the one thing a template like this exists to prevent.
        //
        // Fixed at the fill rather than by splitting every catalog line into a
        // singular and a plural form: the templates say what the band means and
        // English disagreeing with them in exactly one case is not a fact about
        // the bands. `ranks` is taken as well because the encounter catalog
        // words the same slot that way.
        .replace(
            /\{gap\}(\s+)(rungs|ranks)\b/g,
            (_whole, space: string, noun: string) =>
                magnitude === 1
                    ? `one${space}${noun.slice(0, -1)}`
                    : `${magnitude}${space}${noun}`
        )
        .replace(/\{gap\}/g, String(magnitude))
        .replace(/\{rank\}/g, rankName(clampOrdinal(apparent)));
}

/** Regard against a whole record, reading its own gate and its own column. */
export function regardOf(record: unknown, asker: RegardAskerInput): Regard {
    return regardFor(gateOrdinalOf(record), asker, regardProfileOf(record));
}

// POOL FILTERS - the shape every catalog draw wants

/**
 * What the world actually puts in front of this asker.
 */
export function offeredTo<T>(records: readonly T[], asker: RegardAskerInput): T[] {
    return records.filter(record => regardOf(record, asker).offered);
}

/** The complement, with each record's reason attached. */
export function refusalsFor<T>(
    records: readonly T[],
    asker: RegardAskerInput
): { record: T; regard: Regard }[] {
    const out: { record: T; regard: Regard }[] = [];
    for (const record of records) {
        const regard = regardOf(record, asker);
        if (!regard.offered) out.push({ record, regard });
    }
    return out;
}

/**
 * Offered where possible, everything reachable where not.
 */
export function narrowToOffered<T>(records: readonly T[], asker: RegardAskerInput): readonly T[] {
    const offered = offeredTo(records, asker);
    return offered.length > 0 ? offered : records;
}

/**
 * The single worst thing in a set, by how badly the asker is out-matched.
 * Used by anything that has to price a whole situation rather than one row.
 */
export function steepestGap(records: readonly unknown[], asker: RegardAskerInput): Regard | null {
    let worst: Regard | null = null;
    for (const record of records) {
        const regard = regardOf(record, asker);
        if (!worst || regard.gap < worst.gap) worst = regard;
    }
    return worst;
}

/** Bands in ladder order, low to high. Exported for tests and for display. */
export const REGARD_BAND_ORDER: readonly RegardBand[] = REGARD_BANDS.map(row => row.band);

/** The top of the ladder, restated from realms so callers need one import. */
export const REGARD_MAX_ORDINAL = MAX_ORDINAL;
