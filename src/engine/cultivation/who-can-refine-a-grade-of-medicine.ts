/**
 * What realm a body has to stand at before it can WORK the materials a grade of
 * medicine is made from.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING THIS IMPLEMENTS, AND THE ONE IT IS NOT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner's: **a cultivator cannot work with materials above their
 * realm, and that is what makes the higher grades rare.** Not price, not a
 * quota, not anybody choosing to write down a small number - *"a Qi
 * Condensation can't work with the materials to make a heaven grade pill,
 * that's what makes it rare."*
 *
 *     mortal     Qi Condensation
 *     earth      Core Formation
 *     heaven     Void Refinement
 *     immortal   nobody in this world
 *     chaos      nobody in this world
 *
 * ── IT IS A DIFFERENT QUESTION FROM WHAT A WOUND NEEDS ───────────────────
 *
 * There are two grade ladders in this engine and collapsing them would be
 * wrong. They ask different questions of different people:
 *
 *   THIS FILE          who may MAKE a grade.       Answered by the REFINER'S
 *                                                  realm.
 *   `what-grade-of-      what grade a WOUND needs.   Answered by the wound's
 *   medicine-a-wound-                               SEVERITY and the PATIENT'S
 *   needs.ts`                                       realm.
 *
 * A Core Formation alchemist may refine earth-grade medicine and may still be
 * carrying a crippling tear that only heaven grade closes. Neither fact says
 * anything about the other. Nothing in this file may ever be read as a
 * statement about treatment, and nothing in that one as a statement about
 * production.
 *
 * ── AND IT IS NOT `PILL_GRADE_REALM` EITHER ──────────────────────────────
 *
 * `PILL_GRADE_REALM` in `breakthrough.ts` says what realm a pill is PITCHED
 * AT - who it is FOR. This says who can MAKE one. Those are a customer and a
 * craftsman and they do not stand at the same height: mortal grade is pitched
 * at Foundation Establishment and made at Qi Condensation, heaven grade is
 * pitched at Nascent Soul and made at Void Refinement. The maker of the good
 * medicine stands ABOVE its intended patient, which is the ordinary shape of a
 * trade and is why a house that can treat its elders is a rarer thing than a
 * house that can buy for them.
 *
 * ── WHY "NOBODY" IS AN ORDINAL AND NOT A FLAG ────────────────────────────
 *
 * Immortal grade is not made below the Lid at all. The temptation is a boolean
 * beside the table saying so, and that is exactly the bespoke exception
 * AGENTS.md forbids: a rule that applies to one row, read by nothing that reads
 * the rest.
 *
 * So the requirement is stated in the same currency as every other row - a rung
 * on the ordinary ladder - and the rung is `TRUE_IMMORTAL_ORDINAL`. Everything
 * that makes it unreachable is already law in `realms.ts` and none of it is
 * written here:
 *
 *   - `isExpelledFromBelow(46)` is true. A True Immortal is a thing the lower
 *     realm is in the act of ejecting for the whole time it is present.
 *   - `BREATHS_IN_THE_LOWER_REALM` is ten to fifteen breaths. That is the whole
 *     window, and it holds for every immortal-grade medicine without exception.
 *   - Forty-five may stay and forty-six may not, which is why the world has
 *     False Immortals living in it and has never had a True one. A False
 *     Immortal at 45 therefore does NOT clear this bar, and that is deliberate:
 *     they never crossed, so they never had the materials.
 *
 * The consequence is that "nobody makes it" needs no special case anywhere. A
 * refiner is checked against an ordinal, the ordinal is 46, and the only hand
 * in the world that has ever satisfied it belonged to somebody who came down on
 * purpose and had a quarter of a minute to do it in. `docs/world/immortals.md`
 * calls that crossing catastrophically expensive and it is the same event here.
 *
 * TWO CATALOGS SAID THIS FIRST AND THIS FILE IS NOT A THIRD OPINION.
 * `structural-repair-medicine.ts` carries it for its own four objects as
 * `madeBelowTheLid`, with immortal grade marked *"Cannot be made here. Sent
 * down, and the number in the world is what has been sent."* And
 * `immortal-items.ts` states it for the things that came down: *"nobody below
 * the Lid can make, refine, repair or replace"* them, so the supply is finite
 * and shrinking and every one spent is one fewer forever. This file is that
 * sentence generalised to the whole medicine ladder, and the suite checks it
 * against the typed one rather than letting a second table grow beside it.
 *
 * ── ONE EXCEPTION, AND IT IS A DIFFERENT WORD ────────────────────────────
 *
 * `immortal-items.ts` also grades its objects higher/middle/lower, and THAT
 * grade is not this one: it *"is what an ancestor can afford to send"* - a fact
 * about the sender across the Lid, not about a maker's realm. It cannot be, of
 * course, since nothing below makes them at all. The two vocabularies share no
 * word and no type, and this file has nothing to say about that one. It is
 * named here only so the next reader does not try to reconcile them.
 *
 * Note also what that catalog is careful about and this file must not undo: it
 * has no price field and must never have one, because a price would imply the
 * economy reaches those objects. Nothing here quotes a figure for anything.
 *
 * ── WHAT THIS PRODUCES, WHICH IS THE COUNTED/TRACKED LINE ────────────────
 *
 * The gate is on the REFINER, so the supply of a grade is the size of the
 * population standing at its rung - a number you can count off a seeded world
 * rather than one anybody chose. `tests/engine/world/
 * how-many-people-can-make-a-grade-of-medicine.test.ts` counts it, and the
 * shape it finds is the population pyramid seen from the production side:
 * everybody can make mortal grade, about a fifth can make earth, a few per cent
 * can make heaven, and nobody at all can make what is above it.
 *
 * That is where `docs/world/items.md`'s counted/tracked line comes from, and
 * `buying-and-bartering-pills.ts` arrives at the same boundary from the price
 * side without knowing about this file. Only the bottom of the ladder has a
 * population large enough to produce indefinitely, so only the bottom is
 * fungible; above it a dose is a specific object with a history because the
 * number of hands that could have made it is small enough to name.
 *
 * Pure. No I/O, no database, no world types.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import {
    REALM_TIERS,
    TRUE_IMMORTAL_ORDINAL,
    isExpelledFromBelow,
    realmForOrdinal,
    type RealmKey
} from './realms.js';

/**
 * The realm a refiner must stand in to work a grade's materials at all.
 *
 * Read as realm KEYS rather than as rung numbers so the ladder can move without
 * this table lying, the same discipline `PILL_GRADE_REALM` keeps next door.
 *
 * `chaos` sits with `immortal` rather than getting a row of its own. The ruling
 * names four grades and stops, and chaos is the band ABOVE immortal in every
 * catalog that orders them - so whatever puts immortal grade out of reach puts
 * chaos further out. Reading it any other way would make the rarest medicine in
 * the world the only one an ordinary cultivator could refine.
 */
export const REFINING_REALM_BY_GRADE: Readonly<Record<TechniqueGrade, RealmKey>> = {
    mortal: 'qi_condensation',
    earth: 'core_formation',
    heaven: 'void_refinement',
    immortal: 'immortal',
    chaos: 'immortal'
};

/**
 * The rung a refiner must have reached to work this grade.
 *
 * The Immortal realm has two rungs and only its upper one ever crossed, so the
 * two sent-down grades resolve to `TRUE_IMMORTAL_ORDINAL` rather than to the
 * realm's first rung. A False Immortal stands at 45, may stay below the Lid
 * indefinitely, and has never been on the other side to bring anything back.
 */
export function refiningOrdinalFor(grade: TechniqueGrade): number {
    const key = REFINING_REALM_BY_GRADE[grade];
    if (key === 'immortal') return TRUE_IMMORTAL_ORDINAL;
    const tier = REALM_TIERS.find(t => t.key === key);
    // Unreachable while the table names real realms. A loud 0 rather than a
    // throw, because a bad edit here should fail a test and not a run.
    return tier?.ordinalStart ?? 0;
}

/**
 * Whether anybody who can live in the lower realm can make this grade.
 *
 * False exactly where the requirement is a rung the world below the Lid ejects.
 * Nothing is asserted here that `isExpelledFromBelow` does not already say.
 */
export function madeBelowTheLid(grade: TechniqueGrade): boolean {
    return !isExpelledFromBelow(refiningOrdinalFor(grade));
}

/** Every grade that is only ever sent down, never refined here. */
export function sentDownGrades(): TechniqueGrade[] {
    return (Object.keys(REFINING_REALM_BY_GRADE) as TechniqueGrade[])
        .filter(grade => !madeBelowTheLid(grade));
}

/**
 * The realm's own display name, for saying the requirement out loud.
 *
 * The REALM rather than the rung, because the requirement is the realm: any
 * rung of Core Formation works earth-grade materials, and quoting "Core
 * Formation Early" would read as a demand for that specific rung.
 */
export function refiningRealmNameFor(grade: TechniqueGrade): string {
    return realmForOrdinal(refiningOrdinalFor(grade)).name;
}

/** Whether a cultivator standing at this rung may attempt this grade at all. */
export function canRefineGrade(grade: TechniqueGrade, realmOrdinal: number): boolean {
    return realmOrdinal >= refiningOrdinalFor(grade);
}

/**
 * The best grade a cultivator at this rung can work, or null below the bottom
 * of the ladder - which nobody is, since mortal grade opens at ordinal zero.
 */
export function highestGradeRefinableAt(realmOrdinal: number): TechniqueGrade | null {
    let best: TechniqueGrade | null = null;
    // The table is written in ascending grade order and `>=` keeps the LATER of
    // two grades that share a rung. That matters for exactly one pair: immortal
    // and chaos both ask for the True Immortal rung, and the honest answer for
    // a hand that clears it is the higher of the two.
    for (const grade of Object.keys(REFINING_REALM_BY_GRADE) as TechniqueGrade[]) {
        if (!canRefineGrade(grade, realmOrdinal)) continue;
        if (best === null || refiningOrdinalFor(grade) >= refiningOrdinalFor(best)) best = grade;
    }
    return best;
}

/**
 * Why the cauldron will not take it, in words, or null where it will.
 *
 * A refusal is only finished when it names what WOULD work, so both branches
 * name the thing rather than the rule: the rung somebody would have to reach,
 * or - where no rung is enough - that the medicine exists and arrives by a
 * different road entirely. AGENTS.md: the fix is a price, a consequence, or a
 * refusal that names its cause, never a removed verb. Buying, bartering,
 * inheriting and digging one up are all still open and none of them run through
 * this file.
 */
export function whyTheCauldronRefuses(
    grade: TechniqueGrade,
    realmOrdinal: number
): string | null {
    if (canRefineGrade(grade, realmOrdinal)) return null;
    if (!madeBelowTheLid(grade)) {
        return `Nobody below the Lid refines ${grade}-grade medicine. The materials it wants `
            + 'do not occur on this side and no cultivator alive has hands that could hold them; '
            + 'every dose in the world was sent down by somebody who crossed, and stopped being '
            + 'made the day they stopped sending. One can still be found, bought with something '
            + 'other than money, inherited, or dug out of a sealed site. It cannot be refined.';
    }
    return `Working ${grade}-grade materials wants ${refiningRealmNameFor(grade)} or better. `
        + 'Below that the ingredients do not answer the hand holding them, and the cauldron '
        + 'takes the difference out of the alchemist.';
}
