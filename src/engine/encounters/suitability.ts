/**
 * Whether the thing you found is for you.
 */

import { regardFor } from '../cultivation/regard.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';

// THE TWO SIDES

/**
 * The person looking, reduced to the axes a fit is judged on.
 */
export interface Seeker {
    ordinal: number;
    /** Elements the root actually draws. Empty is legal and means elementless. */
    elements?: readonly string[];
    /** `single` | `dual` | `triple` | `quad` | `muddled` | `mutated`. */
    rootGrade?: string | null;
    foundationQuality?: string | null;
    /** Comprehension held, by domain key, as a degree. */
    insights?: Readonly<Record<string, number>>;
    yearsCultivated?: number;
}

export type FindKind = 'manual' | 'method' | 'pill' | 'inheritance' | 'object' | 'ground';

/**
 * The thing behind the door, reduced to what it demands.
 */
export interface Find {
    id: string;
    name: string;
    kind: FindKind;
    /** The rung it was made for. What it is worth, to somebody. */
    gradeOrdinal: number;
    /** Elements it is written in. Empty means it asks for none. */
    elements?: readonly string[];
    /** Comprehension domain it cannot be worked without. */
    domain?: string | null;
    /** Minimum degree in that domain. */
    domainDegree?: number;
    /** Root grades it will take at all. Empty means any. */
    rootGrades?: readonly string[];
    /**
     * Pill grade, for anything consumed rather than studied.
     */
    grade?: PillGrade;
    /**
     * Legacy hard band, in rungs, for a consumable with no grade stated.
     * Prefer `grade`.
     */
    band?: number;
}

/** Pill grades, weakest first. The cultivation layer owns these numbers. */
export type PillGrade = 'mortal' | 'earth' | 'heaven' | 'immortal' | 'chaos';

/**
 * Base potency factor per grade, against 1 for taking nothing.
 */
export const PILL_GRADE_FACTOR: Readonly<Record<PillGrade, number>> = {
    mortal: 1.35,
    earth: 1.25,
    heaven: 1.18,
    immortal: 1.12,
    chaos: 1.08
};

/** Rungs above its own realm at which a pill's benefit halves. */
export const PILL_HALVING_RUNGS = 8;

/**
 * What a pill is actually worth to somebody standing this far off its band.
 */
export function pillPotencyFor(
    grade: PillGrade,
    gradeOrdinal: number,
    seekerOrdinal: number
): number {
    const base = PILL_GRADE_FACTOR[grade] ?? 1;
    const above = Math.max(0, seekerOrdinal - gradeOrdinal);
    const excess = (base - 1) * Math.pow(0.5, above / PILL_HALVING_RUNGS);
    return 1 + excess;
}

/** How a find stands to a person. */
export type Fit =
    /** Every axis matched. This is what they went out for. */
    | 'suited'
    /** Some axis matched and some did not. Workable, slowly, badly. */
    | 'partly'
    /** It is a fine thing and it is not for them. The commonest answer. */
    | 'unsuited'
    /** Pitched so far above that fit is not yet the question. */
    | 'out_of_reach'
    /** So far below that there is nothing in it for them any more. */
    | 'outgrown';

export interface Suitability {
    fit: Fit;
    /** What the thing is, independent of who found it. */
    gradeOrdinal: number;
    /** Which axes matched, which missed, and which could not be told. */
    axes: FitAxis[];
    /**
     * Engine-authored and factual. Says plainly that a thing is good and is
     * not for them, because that sentence is the whole mechanic.
     */
    line: string;
}

export interface FitAxis {
    axis: 'reach' | 'element' | 'root' | 'comprehension' | 'band';
    verdict: 'match' | 'miss' | 'unknown';
    note: string;
}

// THE READING

/**
 * Does this fit this person. Reach is judged first and separately, because "too
 * far above you to attempt" and "not written for you" are different facts, and a
 * thing at your own rung that does not suit you is the discovery this whole
 * system exists to deliver - it must not be reported as merely too strong.
 */
export function assessFit(find: Find, seeker: Seeker): Suitability {
    const grade = clampOrdinal(find.gradeOrdinal);
    const axes: FitAxis[] = [];

    // reach
    const regard = regardFor(grade, seeker.ordinal);
    const reachMiss =
        regard.band === 'unreachable' || regard.band === 'overmatched'
            ? 'out_of_reach'
            : regard.band === 'dismissed'
                ? 'outgrown'
                : null;
    axes.push({
        axis: 'reach',
        verdict: reachMiss ? 'miss' : 'match',
        note: regard.reaction
    });

    // element
    const wants = normalise(find.elements);
    const draws = normalise(seeker.elements);
    let elementVerdict: FitAxis['verdict'] = 'match';
    let elementNote = 'It asks for no particular element.';
    if (wants.length > 0) {
        if (draws.length === 0) {
            elementVerdict = 'unknown';
            elementNote = `It is written for ${list(wants)} and what this cultivator draws is not on record.`;
        } else {
            const shared = wants.filter(e => draws.includes(e));
            if (shared.length === 0) {
                elementVerdict = 'miss';
                elementNote = `It is written for ${list(wants)}. This cultivator draws ${list(draws)}.`;
            } else if (shared.length < wants.length) {
                elementVerdict = 'unknown';
                elementNote = `It is written for ${list(wants)} and this cultivator draws ${list(shared)} of that.`;
            } else {
                elementNote = `It is written for ${list(wants)}, which is what this cultivator draws.`;
            }
        }
    }
    axes.push({ axis: 'element', verdict: elementVerdict, note: elementNote });

    // root grade
    const grades = normalise(find.rootGrades);
    if (grades.length > 0) {
        const held = (seeker.rootGrade ?? '').toLowerCase();
        const verdict: FitAxis['verdict'] = held.length === 0
            ? 'unknown'
            : grades.includes(held) ? 'match' : 'miss';
        axes.push({
            axis: 'root',
            verdict,
            note: verdict === 'miss'
                ? `The method was cut for a ${list(grades)} root. This one is ${held}.`
                : `Root grade ${held || 'unrecorded'} against ${list(grades)}.`
        });
    }

    // comprehension
    if (find.domain) {
        const need = find.domainDegree ?? 1;
        const held = seeker.insights?.[find.domain];
        const verdict: FitAxis['verdict'] = held === undefined
            ? 'miss'
            : held >= need ? 'match' : 'miss';
        axes.push({
            axis: 'comprehension',
            verdict,
            note: verdict === 'match'
                ? `It needs ${find.domain} and this cultivator has it.`
                : `It cannot be worked without ${find.domain}, which this cultivator does not hold` +
                  `${held === undefined ? '' : ' to the degree it asks'}.`
        });
    }

    // band, for anything consumed rather than studied
    if (find.kind === 'pill' && find.grade) {
        const potency = pillPotencyFor(find.grade, grade, seeker.ordinal);
        const base = PILL_GRADE_FACTOR[find.grade] ?? 1;
        // Half the grade's own excess is the line between "worth taking" and
        // "worth selling". Below it the pill still does something and the
        // something is not worth the rung it was refined at.
        const worthwhile = potency - 1 >= (base - 1) * 0.5;
        const above = Math.max(0, seeker.ordinal - grade);
        axes.push({
            axis: 'band',
            verdict: worthwhile ? 'match' : 'miss',
            note: worthwhile
                ? `${find.grade} grade, refined for rung ${grade}, and taken close enough ` +
                  `to it to be worth ${potency.toFixed(2)} against 1.`
                : `${find.grade} grade, refined for rung ${grade} and taken ${above} rungs ` +
                  `above that. Worth ${potency.toFixed(2)} against 1, which is near enough ` +
                  'to nothing that it does nothing.'
        });
    } else if (find.kind === 'pill' && typeof find.band === 'number') {
        const distance = Math.abs(seeker.ordinal - grade);
        const inside = distance <= find.band;
        axes.push({
            axis: 'band',
            verdict: inside ? 'match' : 'miss',
            note: inside
                ? 'Refined for this band and taken inside it.'
                : `Refined for ${grade} and taken ${distance} rungs off that. ` +
                  'Outside the band it does nothing.'
        });
    }

    const fit = verdictFrom(reachMiss, axes);
    return { fit, gradeOrdinal: grade, axes, line: lineFor(find, fit, axes) };
}

function verdictFrom(reachMiss: Fit | null, axes: readonly FitAxis[]): Fit {
    if (reachMiss) return reachMiss;
    const fitAxes = axes.filter(a => a.axis !== 'reach');
    if (fitAxes.some(a => a.verdict === 'miss')) {
        // One hard miss on element or band and the thing is inert. A miss on
        // comprehension alone is workable, badly, by somebody determined.
        const hard = fitAxes.some(
            a => a.verdict === 'miss' && (a.axis === 'element' || a.axis === 'band' || a.axis === 'root')
        );
        return hard ? 'unsuited' : 'partly';
    }
    if (fitAxes.some(a => a.verdict === 'unknown')) return 'partly';
    return 'suited';
}

/**
 * The sentence.
 */
function lineFor(find: Find, fit: Fit, axes: readonly FitAxis[]): string {
    const missed = axes.filter(a => a.axis !== 'reach' && a.verdict === 'miss');
    const why = missed.map(a => a.note).join(' ');

    switch (fit) {
        case 'suited':
            return `${find.name} is pitched at rung ${find.gradeOrdinal} and it fits this cultivator. ` +
                'There is nothing standing between them and it except the work.';
        case 'partly':
            return `${find.name} is pitched at rung ${find.gradeOrdinal} and it half fits. ` +
                `${why || 'Some of what it asks is not on record.'} ` +
                'It can be worked, slowly, and it will never be worked well.';
        case 'unsuited':
            return `${find.name} is pitched at rung ${find.gradeOrdinal} and it is sound. ` +
                `${why} It is not for this cultivator. Sitting with it will teach them nothing, ` +
                'however long they sit.';
        case 'out_of_reach':
            return `${find.name} is pitched at rung ${find.gradeOrdinal}, far enough above that ` +
                'whether it suits them is not yet a question anybody can answer.';
        case 'outgrown':
            return `${find.name} is pitched at rung ${find.gradeOrdinal}. There is nothing in it ` +
                'for somebody standing where this cultivator stands.';
    }
}

/**
 * The best of a haul, for whoever is holding it.
 */
export function bestFor(finds: readonly Find[], seeker: Seeker): { find: Find; suitability: Suitability } | null {
    let best: { find: Find; suitability: Suitability } | null = null;
    for (const find of finds) {
        const suitability = assessFit(find, seeker);
        if (!best || FIT_ORDER.indexOf(suitability.fit) < FIT_ORDER.indexOf(best.suitability.fit)) {
            best = { find, suitability };
        }
    }
    return best;
}

/** Best first. `out_of_reach` above `unsuited`: it may fit later. */
const FIT_ORDER: readonly Fit[] = ['suited', 'partly', 'out_of_reach', 'unsuited', 'outgrown'];

/**
 * Tags that mean "there is something here somebody could be suited to". Read off
 * the catalog's own tags: a market stall and a bandit do not hold a fit; a manual
 * in a lost grade, an inheritance trial, a refining method on a wall and a body
 * that was carrying a canon do.
 */
const FIT_BEARING_TAGS: readonly string[] = [
    'technique',
    'recipe',
    'inheritance',
    'ruin-only',
    'pills',
    // Route 3. `grave` is on five rows in the encounter catalog today and was
    // simply not being read. `corpse` is on none yet - the `corpses` and
    // `corpse_inventory` tables are storage-level and nothing in the encounter
    // catalog is tagged for a body found in the field. Listed here so the tag
    // works the day a row carries it, rather than being a second thing to
    // remember; reported to the data layer rather than authored across the
    // boundary.
    'corpse',
    'grave',
    // A person, rather than a shelf. Two rows carry it, and a teacher is an
    // access route to a method exactly as a ruin is - see `canTransmit` in
    // `acquisition.ts`.
    'transmission'
];

/**
 * Whether an encounter row can hold something a person could be suited to.
 */
export function mayHoldAFit(tags: readonly string[]): boolean {
    const set = new Set(tags);
    return FIT_BEARING_TAGS.some(tag => set.has(tag));
}


function normalise(values: readonly string[] | undefined): string[] {
    return (values ?? []).map(v => v.trim().toLowerCase()).filter(v => v.length > 0);
}

function list(values: readonly string[]): string {
    if (values.length === 0) return 'nothing in particular';
    if (values.length === 1) return values[0];
    return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}
