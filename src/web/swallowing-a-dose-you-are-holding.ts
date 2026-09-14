/**
 * The road from a dose in a player's hands to `applyStructuralRepair`.
 *
 * THE MEDICINE WAS REAL AND THERE WAS NO WAY TO USE IT. Four grades, eleven
 * doses in the world, a price model, a holdings table, a live read of who is
 * carrying one, and a complete engine half - and `applyStructuralRepair` had no
 * caller anywhere outside its own tests, so a player who traded for a dose was
 * carrying an object no sentence could spend. The design owner, asked whether to
 * build the road: *"obviously yes you ought to be able to eat it"*.
 *
 * ── WHY THIS IS NOT A NEW VERB ───────────────────────────────────────────
 *
 * `swallow` already reaches `consume_pill`, and all four doses are called pills,
 * so `PILL_NOUNS` routes "I swallow the Soul-Seating Pill" without the pattern
 * table learning a word. What `consume_pill` could not do was FIND one: it reads
 * the pouch, and a dose is an `ObjectRecord` in `state.objects` rather than a
 * counted pouch row, because there is no counted tier for a thing there are
 * eleven of. So the difference between a dose and a pill is where it is kept and
 * nothing else, and this file is the read that looks in the other place.
 *
 * ── WHAT IT DECIDES, WHICH IS NOTHING ────────────────────────────────────
 *
 * `repairRefusalReason` is the whole rule and it is stated in the engine: a dose
 * mends a permanent PHYSICAL wound at or below its own rank, never a wound of
 * the mind and never a spent span. Nothing here restates any of that. This file
 * resolves which dose was named, asks the engine about each wound the body is
 * carrying, and reports - and where the engine says no, the refusal it hands
 * back is the engine's own sentence.
 *
 * The one thing worth saying twice, because it is what makes a bad answer
 * expensive: a dose that reaches nothing is gone for nothing. So the refusal
 * comes BEFORE the swallowing, names what this dose was made for, and leaves the
 * object in the player's hands.
 */

import type { Injury } from '../schema/cultivation.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import { isUnspentDose } from '../engine/world/who-holds-the-structural-repair-medicine.js';
import {
    getStructuralRepairMedicine,
    repairRefusalReason
} from '../engine/cultivation/what-structural-repair-medicine-can-reach.js';
import type { StructuralRepairMedicine } from '../data/cultivation/structural-repair-medicine.js';
import { currentWoundKey, getWoundType, isPermanentWound } from '../data/cultivation/wounds.js';
import { matchScore } from './entities.js';

/** How close a name has to be before it is the dose they meant. */
const CLOSE_ENOUGH = 60;

/** A dose in somebody's own hands, joined to the row that says what it does. */
export interface DoseInHand {
    row: ObjectRecord;
    medicine: StructuralRepairMedicine;
}

/**
 * Every unspent dose this person is the possessor of.
 *
 * Takes the rows rather than the world, so the caller passes the same
 * `whatYouAreCarrying().rows` every other read of a player's tracked tier uses
 * and no second definition of "yours" appears here.
 */
export function theDosesYouAreHolding(rows: readonly ObjectRecord[]): DoseInHand[] {
    const out: DoseInHand[] = [];
    for (const row of rows) {
        if (!isUnspentDose(row)) continue;
        const medicine = getStructuralRepairMedicine(
            typeof row.data?.medicineId === 'string' ? row.data.medicineId : null
        );
        if (medicine) out.push({ row, medicine });
    }
    return out;
}

/**
 * Which of them the words name, or null.
 *
 * The same threshold and the same scorer the `destroy` verb uses against the
 * things a player is holding, so two verbs reaching into the same hands agree
 * about which thing was meant.
 */
export function whichDoseTheyNamed(held: readonly DoseInHand[], said: string): DoseInHand | null {
    let best: { dose: DoseInHand; score: number } | null = null;
    for (const dose of held) {
        const score = matchScore(said, dose.medicine.name);
        if (score >= CLOSE_ENOUGH && (best === null || score > best.score)) {
            best = { dose, score };
        }
    }
    return best?.dose ?? null;
}

/** What swallowing this one would do to this body, or why it would do nothing. */
export type WhatADoseWouldDo =
    | { mends: Injury; woundKey: string }
    | { mends: null; why: string; consideredWoundKey: string | null };

/**
 * Ask the engine about every wound this body is carrying and keep the first
 * answer that is not a refusal.
 *
 * WHAT IT WAS MADE FOR COMES FIRST. A dose reaches everything permanent and
 * physical at or below its rank - the rank is the axis, not the named break -
 * but the `mends` column still says which wound the grade exists to answer, and
 * pointing a Second Pour Pill at a lost arm when the foundation it was refined
 * for is also broken would be spending it on the cheaper of two problems.
 *
 * The refusal handed back where nothing is reached is the engine's, verbatim,
 * for the wound that came closest: the one the dose was made for if the body has
 * it, otherwise the first permanent wound on the list, otherwise the answer for
 * a body carrying no permanent wound at all - which is the common case and the
 * one that would otherwise waste a dose.
 */
export function whatADoseWouldDo(
    medicine: StructuralRepairMedicine,
    injuries: readonly Injury[],
    atOrdinal: number
): WhatADoseWouldDo {
    const open = injuries.filter(injury => !injury.treated && injury.woundType !== null);
    const madeFor = (injury: Injury): boolean => {
        const key = currentWoundKey(injury.woundType);
        return key !== null
            && medicine.mends.some((named: string) => currentWoundKey(named) === key);
    };
    // What it was made for, then anything else that does not close on its own,
    // then the ordinary tears. The order decides which wound the refusal is
    // ABOUT when nothing is reached, and a player told why a dose will not
    // answer the break that halted them has been told something; told why it
    // will not answer a bruise, nothing.
    const permanent = (injury: Injury): boolean => isPermanentWound(injury.woundType);
    const ordered = [
        ...open.filter(madeFor),
        ...open.filter(injury => !madeFor(injury) && permanent(injury)),
        ...open.filter(injury => !madeFor(injury) && !permanent(injury))
    ];

    for (const injury of ordered) {
        const key = currentWoundKey(injury.woundType);
        if (key === null) continue;
        if (repairRefusalReason(medicine, key, atOrdinal) === null) {
            return { mends: injury, woundKey: key };
        }
    }

    const nearest = ordered[0] ?? null;
    const key = nearest === null ? null : currentWoundKey(nearest.woundType);
    return {
        mends: null,
        why: repairRefusalReason(medicine, key, atOrdinal)
            ?? 'It reaches nothing this body is carrying.',
        consideredWoundKey: key
    };
}

/**
 * What this dose was made for, as names rather than keys.
 *
 * Said before it is swallowed and not after, because a player who has spent one
 * of eleven objects in the world on the wrong wound cannot be told anything
 * useful afterwards.
 */
export function whatThisDoseAnswers(medicine: StructuralRepairMedicine): string {
    const names = medicine.mends
        .map((key: string) => (getWoundType(key)?.name ?? key).toLowerCase());
    const made = names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `${medicine.name} was refined for ${made}, and it reaches a break of any kind in a `
        + `body standing at rung ${medicine.reachesUpToOrdinal} or below. Nothing else.`;
}
