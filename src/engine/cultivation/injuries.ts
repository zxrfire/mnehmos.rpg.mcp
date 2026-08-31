/**
 * Meridian injuries - the game's ratchet.
 *
 * Injuries do not heal on their own. There is no long rest, no hit dice, no
 * overnight recovery. An injury stays untreated until a pill, a healer or a
 * long seclusion clears it, and while untreated it drags on both cultivation
 * rate and breakthrough odds. That is the whole point: a run does not end
 * because one bad roll killed you, it ends because five months ago you took a
 * torn meridian, kept cultivating anyway, and every roll since has been worse
 * than the last.
 *
 * The lethal rule this module owns the predicate for is the blunt one:
 * three or more untreated meridian injuries, and forcing another fight kills
 * you. This module reports the *state*; `survival.ts` decides the *death*.
 */

import {
    INJURY_WEIGHTS,
    LETHAL_UNTREATED_INJURIES,
    type Cultivator,
    type Injury,
    type InjurySeverity,
    type InjurySource
} from '../../schema/cultivation.js';
import type { CultivationRNG } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// PENALTY CEILINGS
// Penalties stack additively, which without a ceiling means four crippling
// injuries produce a 200% cultivation penalty and a negative rate. Rather than
// let the arithmetic go absurd we cap: an injured cultivator is crippled, not
// mathematically inverted. The caps are deliberately brutal but survivable, so
// that "treat your injuries" stays a live decision instead of the run simply
// being over.
// ─────────────────────────────────────────────────────────────────────────

/** Maximum fraction of cultivation rate that injuries can strip. */
export const MAX_INJURY_CULTIVATION_PENALTY = 0.9;
/** Maximum flat breakthrough-odds penalty injuries can contribute. */
export const MAX_INJURY_BREAKTHROUGH_PENALTY = 0.6;

/** Severity ordering, mildest first. Used for "treat the worst one" triage. */
export const INJURY_SEVERITY_ORDER: readonly InjurySeverity[] = [
    'minor', 'serious', 'crippling'
] as const;

function severityRank(severity: InjurySeverity): number {
    return INJURY_SEVERITY_ORDER.indexOf(severity);
}

// ─────────────────────────────────────────────────────────────────────────
// CREATION
// ─────────────────────────────────────────────────────────────────────────

export interface CreateInjuryParams {
    severity: InjurySeverity;
    source: InjurySource;
    /** Turn on which the injury was sustained. */
    turn: number;
    /**
     * Optional override for the factual description. When omitted a default is
     * composed from severity and source - engine-authored, narrator-rendered.
     */
    description?: string;
}

/**
 * Mint an injury with its penalties taken from INJURY_WEIGHTS.
 *
 * Penalties are copied onto the record rather than looked up by severity at
 * read time, so a future balance pass to INJURY_WEIGHTS does not retroactively
 * rewrite the wounds in a save file. What you took is what you carry.
 *
 * The id comes from the supplied seeded RNG, never from `crypto.randomUUID`:
 * injuries surface inside BreakthroughResult and TimeSkipResult, and those
 * objects must be byte-identical across replays of the same seed.
 */
export function createInjury(params: CreateInjuryParams, rng: CultivationRNG): Injury {
    const weights = INJURY_WEIGHTS[params.severity];
    return {
        id: rng.uuid(),
        severity: params.severity,
        source: params.source,
        description: params.description ?? defaultInjuryDescription(params.severity, params.source),
        sustainedOnTurn: Math.max(0, Math.floor(params.turn)),
        treated: false,
        cultivationPenalty: weights.cultivationPenalty,
        breakthroughPenalty: weights.breakthroughPenalty
    };
}

const SOURCE_PHRASES: Record<InjurySource, string> = {
    combat: 'taken in combat',
    qi_deviation: 'torn by qi deviation',
    failed_breakthrough: 'torn by a failed breakthrough',
    tribulation: 'burned by heavenly tribulation',
    poison: 'eroded by poison',
    backlash: 'torn by technique backlash',
    other: 'sustained'
};

const SEVERITY_PHRASES: Record<InjurySeverity, string> = {
    minor: 'A minor meridian injury',
    serious: 'A serious meridian injury',
    crippling: 'A crippling meridian injury'
};

/** Factual, non-flowery. The narrator supplies the flourish. */
export function defaultInjuryDescription(severity: InjurySeverity, source: InjurySource): string {
    return `${SEVERITY_PHRASES[severity]}, ${SOURCE_PHRASES[source]}.`;
}

/**
 * Roll a severity from a seeded stream.
 *
 * `escalate` shifts the distribution upward and is how the engine expresses
 * "this went wrong at a realm boundary" or "this is the fourth lightning
 * strike" without needing a separate table per caller.
 */
export function rollInjurySeverity(rng: CultivationRNG, escalate = false): InjurySeverity {
    const roll = rng.next();
    if (escalate) {
        if (roll < 0.35) return 'minor';
        if (roll < 0.8) return 'serious';
        return 'crippling';
    }
    if (roll < 0.65) return 'minor';
    if (roll < 0.94) return 'serious';
    return 'crippling';
}

// ─────────────────────────────────────────────────────────────────────────
// QUERYING
// ─────────────────────────────────────────────────────────────────────────

export function untreatedInjuries(injuries: readonly Injury[]): Injury[] {
    return injuries.filter(i => !i.treated);
}

export function untreatedInjuryCount(injuries: readonly Injury[]): number {
    let count = 0;
    for (const injury of injuries) if (!injury.treated) count++;
    return count;
}

export interface InjuryPenalties {
    /** Fraction of cultivation rate lost, in [0, MAX_INJURY_CULTIVATION_PENALTY]. */
    cultivationPenalty: number;
    /** Flat breakthrough-odds penalty, in [0, MAX_INJURY_BREAKTHROUGH_PENALTY]. */
    breakthroughPenalty: number;
    untreatedCount: number;
    /** Multiplier form of `cultivationPenalty`, ready to fold into a rate. */
    cultivationMultiplier: number;
    /** True once the count reaches the lethal-if-you-fight threshold. */
    lethalThresholdReached: boolean;
}

/**
 * Sum the penalties of every untreated injury, clamped to the ceilings.
 *
 * Treated injuries are kept on the record - they are scar tissue and run
 * history - but contribute nothing.
 */
export function aggregateInjuryPenalties(injuries: readonly Injury[]): InjuryPenalties {
    let cultivation = 0;
    let breakthrough = 0;
    let untreatedCount = 0;

    for (const injury of injuries) {
        if (injury.treated) continue;
        untreatedCount++;
        cultivation += injury.cultivationPenalty;
        breakthrough += injury.breakthroughPenalty;
    }

    const cultivationPenalty = Math.min(cultivation, MAX_INJURY_CULTIVATION_PENALTY);
    const breakthroughPenalty = Math.min(breakthrough, MAX_INJURY_BREAKTHROUGH_PENALTY);

    return {
        cultivationPenalty,
        breakthroughPenalty,
        untreatedCount,
        cultivationMultiplier: 1 - cultivationPenalty,
        lethalThresholdReached: untreatedCount >= LETHAL_UNTREATED_INJURIES
    };
}

/**
 * Whether this cultivator is in the "one more fight and you die" state:
 * LETHAL_UNTREATED_INJURIES or more untreated meridian injuries.
 *
 * Note this is a STATE predicate, not a death check. Standing here is legal and
 * survivable - you can crawl to a healer. It only kills when the cultivator
 * forces another fight anyway, which `evaluateDeathConditions` decides.
 */
export function isLethalInjuryState(cultivator: Pick<Cultivator, 'injuries'>): boolean {
    return untreatedInjuryCount(cultivator.injuries) >= LETHAL_UNTREATED_INJURIES;
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPERING - EXPERIENCE AS A FORM OF POWER
//
// The charter requires that surviving hardship produce a mechanical
// consequence rather than being pure loss. The cleanest expression of that
// inside this layer is already sitting in the data: a TREATED injury is a
// wound that was taken, survived, and paid to close. That is scar tissue, and
// it is worth something. A cultivator who has torn their meridians three times
// and knitted them back knows exactly what the onset of a bad breakthrough
// feels like. A cultivator who has never been hurt does not.
//
// Read carefully, because this is close to a rule the charter forbids:
//
//   - It is NOT rubber-banding. Nothing here fires because a run is going
//     badly. It fires because the player spent scarce pills, spirit stones or
//     months of seclusion closing wounds - a real cost, paid in advance, that
//     could have been spent on something else.
//   - It is symmetric. Any NPC with the same history gets the same benefit
//     from the same function.
//   - UNTREATED injuries still only ever hurt. The ratchet is untouched. The
//     loop is get hurt -> pay to heal -> the scar is worth a little, which is
//     the charter's "loss branches rather than subtracts" rather than a
//     consolation prize for failing.
//   - It is capped hard, at a few percentage points. It is judgement, not a
//     second talent stat, and it can never out-earn the spirit root you were
//     dealt.
//
// The broader charter items under "experience is power" - enemies made,
// reputation, changed relationships, combat judgement - are not modelled here.
// They belong to the social and combat layers, which own that state.
// ─────────────────────────────────────────────────────────────────────────

/** Tempering earned per closed wound, by how badly it went. */
export const TEMPERING_PER_SCAR: Record<InjurySeverity, number> = {
    minor: 0.005,
    serious: 0.012,
    crippling: 0.02
};

/** Hard ceiling on tempering, as a flat probability. Judgement, not talent. */
export const MAX_TEMPERING = 0.06;

export interface Tempering {
    /** Number of treated injuries on the record. */
    scars: number;
    /** Flat bonus to breakthrough odds, in [0, MAX_TEMPERING]. */
    breakthroughBonus: number;
    /**
     * Reduction in per-check qi-deviation risk. Half the breakthrough figure:
     * recognising the onset is worth less than having been through it.
     */
    deviationRelief: number;
}

/**
 * What a cultivator's closed wounds are worth.
 *
 * Counts only TREATED injuries. An open wound is not experience, it is an open
 * wound, and it is priced by `aggregateInjuryPenalties` instead.
 */
export function scarTempering(injuries: readonly Injury[]): Tempering {
    let scars = 0;
    let raw = 0;
    for (const injury of injuries) {
        if (!injury.treated) continue;
        scars++;
        raw += TEMPERING_PER_SCAR[injury.severity];
    }
    const breakthroughBonus = Math.min(raw, MAX_TEMPERING);
    return {
        scars,
        breakthroughBonus,
        deviationRelief: breakthroughBonus / 2
    };
}

// ─────────────────────────────────────────────────────────────────────────
// TREATMENT
// Pure: every function returns a new array; the input is never mutated.
// ─────────────────────────────────────────────────────────────────────────

/** Mark one injury treated by id. Unknown ids are a no-op, not an error. */
export function treatInjury(injuries: readonly Injury[], injuryId: string): Injury[] {
    return injuries.map(injury =>
        injury.id === injuryId && !injury.treated ? { ...injury, treated: true } : injury
    );
}

export interface TriageResult {
    injuries: Injury[];
    /** The injury that was treated, or null if there was nothing to treat. */
    treated: Injury | null;
}

/**
 * Treat the single worst untreated injury - the sensible use of one scarce
 * pill. Ties break toward the oldest wound, because a wound that has been open
 * longer has had longer to do damage.
 */
export function treatWorstInjury(injuries: readonly Injury[]): TriageResult {
    let worst: Injury | null = null;
    for (const injury of injuries) {
        if (injury.treated) continue;
        if (
            worst === null ||
            severityRank(injury.severity) > severityRank(worst.severity) ||
            (severityRank(injury.severity) === severityRank(worst.severity) &&
                injury.sustainedOnTurn < worst.sustainedOnTurn)
        ) {
            worst = injury;
        }
    }
    if (worst === null) return { injuries: [...injuries], treated: null };
    const treatedInjury: Injury = { ...worst, treated: true };
    return {
        injuries: injuries.map(i => (i.id === treatedInjury.id ? treatedInjury : i)),
        treated: treatedInjury
    };
}

/**
 * Treat up to `count` injuries, worst first. Models a long seclusion or a
 * healer's course of treatment rather than a single pill.
 */
export function treatWorstInjuries(injuries: readonly Injury[], count: number): TriageResult & { treatedCount: number } {
    let current = [...injuries];
    let treatedCount = 0;
    let last: Injury | null = null;
    for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
        const step = treatWorstInjury(current);
        if (step.treated === null) break;
        current = step.injuries;
        last = step.treated;
        treatedCount++;
    }
    return { injuries: current, treated: last, treatedCount };
}
