/**
 * Whether the thing you found is for you.
 *
 * The axis the game was missing, and the one that makes going out to look the
 * rational core of it rather than a diversion from cultivating.
 *
 * ── The claim ────────────────────────────────────────────────────────────
 *
 * Comprehension and consumables are SUITED TO A PERSON. A manual you cannot
 * read teaches nothing however long you sit with it. A pill outside its band
 * does nothing. A cultivator sealed in a sect library with everything money
 * can buy still only climbs if they happen to be suited to what that library
 * holds - which is the province of the prodigy and is why everybody else goes
 * out. They are not looking for treasure. They are looking for a fit, and
 * nobody can tell them in advance whether a given door has one behind it.
 *
 * That single fact converts three things at once:
 *
 *   danger      a survival threshold stops being an obstacle and becomes a
 *               wager. You go in because what fits you might be in there
 *   a miss      finding something excellent and useless TO YOU is a real
 *               outcome and a good encounter, not a failed one
 *   rumour      "there is a fire-root manual three provinces over" is worth
 *               more than stones, and only to a fire root. Information becomes
 *               an economy rather than colour
 *
 * ── The miss must be legible ─────────────────────────────────────────────
 *
 * The single most important line in this file is the one that says a thing is
 * fine and is not for you. A player who walks out of a tomb with a heaven-grade
 * manual and no idea why nothing is happening has been cheated by the
 * interface, not by the world. So {@link assessFit} always returns a stated
 * reason per axis, and the summary says plainly which axis missed.
 *
 * ── Consumables and comprehension ────────────────────────────────────────
 *
 * `Find.grade` is aligned to the pill bands the cultivation layer ships -
 * mortal/earth/heaven/immortal/chaos at 1.35/1.25/1.18/1.12/1.08, each halving
 * every eight rungs above its own realm. `Find.domain` is a dao domain key,
 * matched against what the seeker holds, and should be one of the distinct
 * non-element domains that layer's `roadsWalked` counts. Both are restated
 * here rather than imported so this file stays free of the database; if the
 * two ever disagree, that layer is right and this one changes.
 *
 * ── What this file does NOT own ──────────────────────────────────────────
 *
 * It does not decide what a manual teaches, what a pill does, or whether a
 * breakthrough succeeds. Those are `src/engine/cultivation/`'s, and the dao
 * minimums and realm-banded pill falloff being built there are the mechanical
 * half of this same idea. This file answers one question - does this fit this
 * person - and it answers it the way every other catalog question is answered,
 * over columns that already exist. If the two ever disagree, the cultivation
 * layer is right and this one changes.
 */

import { regardFor } from '../cultivation/regard.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// THE TWO SIDES
// ─────────────────────────────────────────────────────────────────────────

/**
 * The person looking, reduced to the axes a fit is judged on.
 *
 * Structural, and every field optional except the rung, because a caller that
 * does not know somebody's insights should get an honest "cannot tell" on that
 * axis rather than a silent pass.
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
 *
 * Assembled by the caller from whatever catalog the find came out of -
 * `techniques.ts`, `pills.ts`, an inheritance trial's `age_and_talent` gate.
 * Nothing here is authored in this module; it is a shape, not a table.
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
     *
     * Aligned to the bands the cultivation layer now ships: each grade has a
     * base potency factor, and that factor HALVES every
     * `PILL_HALVING_RUNGS` above the realm the pill was refined for. So a
     * mortal-grade pill is worth a great deal at its own rung and nothing at
     * all eight realms up, which is why a cultivator cannot simply buy their
     * way up the ladder with cheap pills.
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
 *
 * Restated from the cultivation layer rather than re-derived. If the two ever
 * disagree, that layer is right and this table changes - it is here only so
 * that "is this pill any use to me" can be answered without a database.
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
 *
 * Returns a factor against 1. At its own rung it is the grade's full factor;
 * `PILL_HALVING_RUNGS` above, half the excess; and so on, so it approaches 1 -
 * which is "it does nothing" - rather than ever going negative.
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

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Does this fit this person.
 *
 * Reach is judged first and separately, because "too far above you to attempt"
 * and "not written for you" are different facts and collapsing them would lose
 * the one that matters: a thing at your own rung that does not suit you is the
 * discovery this whole system exists to deliver, and it must not be reported
 * as being merely too strong.
 */
export function assessFit(find: Find, seeker: Seeker): Suitability {
    const grade = clampOrdinal(find.gradeOrdinal);
    const axes: FitAxis[] = [];

    // ── reach ───────────────────────────────────────────────────────────
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

    // ── element ─────────────────────────────────────────────────────────
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

    // ── root grade ──────────────────────────────────────────────────────
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

    // ── comprehension ───────────────────────────────────────────────────
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

    // ── band, for anything consumed rather than studied ─────────────────
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
 *
 * `unsuited` is the one that had to be written carefully: it states that the
 * thing is good, states which axis missed, and states that sitting with it
 * will not help - because the failure mode this replaces is a player holding
 * something excellent and quietly concluding the game is broken.
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
 *
 * An expedition returns several things and the interesting question is not
 * what the pile is worth - it is whether ANY of it was for them. Returns null
 * for an empty haul, which is a real result.
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
 * Tags that mean "there is something here somebody could be suited to".
 *
 * `corpse` and `grave` were the omission. What somebody stronger was practising
 * is still on them, and a body carrying a canon holds a fit in exactly the way
 * a ruin's shelf does - it is the one acquisition route with no institutional
 * prerequisite whatsoever, which is why it is the rogue's road. Leaving it out
 * meant the whole of route 3 was invisible to the fit machinery.
 *
 * It is also the route where a miss is most instructive, and that is the reason
 * to surface it rather than a reason to hide it: the manual on a body was
 * written for the person who was carrying it. Killing somebody four rungs above
 * you and taking their canon is a wonderful afternoon that changes nothing, and
 * the fit assessment should say so in the same breath as the loot list.
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
 *
 * Read off the catalog's own tags. A market stall and a bandit do not hold a
 * fit; a manual in a lost grade, an inheritance trial, a refining method on a
 * wall and a body that was carrying a canon do, and those are exactly the rows
 * tagged for it.
 */
export function mayHoldAFit(tags: readonly string[]): boolean {
    const set = new Set(tags);
    return FIT_BEARING_TAGS.some(tag => set.has(tag));
}

// ─────────────────────────────────────────────────────────────────────────

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
