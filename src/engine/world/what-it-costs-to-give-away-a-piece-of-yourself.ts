/**
 * What something that speaks can hand over, and what handing it over costs it.
 *
 * A beast past the change holds no STOCK. Where the catalog carries no rows for
 * one - `materialIds: []` on the entries nobody has ever taken - `coreOf`
 * states the reason: no grade, no price and no assay standard. So asking one
 * for its material is not a purchase. There is nothing on a shelf. There is a
 * creature that can pull a piece off itself, which MINTS the material in the
 * moment. Where the catalog does carry rows, the same thing is still true of
 * the ones that need it dead, and what is left is read rather than minted.
 *
 * Three things follow, and none of them is new machinery:
 *
 *   it hurts       `CreateInjuryParams` at a severity off `INJURY_SEVERITY_ORDER`,
 *                  with a wound key out of `wounds.ts`. `isPermanentWound` is
 *                  then the authority on whether it comes back, rather than a
 *                  second boolean here saying the same thing.
 *   it is seen     `ShameInput` - this world's own face-and-standing record.
 *                  Its `heldBy` is the whole of why the act is only POSSIBLY
 *                  embarrassing: a piece pulled out with nobody watching costs
 *                  a body and no standing.
 *   it stays gone  `REGROWTH_YEARS_BY_GRADE` against `lifespanForOrdinal`. One
 *                  ladder for how long material of a grade takes to come back,
 *                  whether it is coming back out of ground or out of a body,
 *                  and the creature's own span is what makes 150 years an
 *                  inconvenience to one thing and most of a life to another.
 *
 * ── WHAT COMES BACK AND WHAT DOES NOT ARE TWO QUESTIONS ─────────────────
 *
 * This module answered them with one number and got both half right. A share
 * of the giver's span decided severity AND permanence, so a piece was
 * permanent only where the regrowth ladder was long enough to eat a quarter of
 * a lifespan - which is the immortal grade and nothing else. Nothing below the
 * top band could be maimed by this at all, and the ruling is that a wound is
 * permanent at any realm.
 *
 * So permanence is read off the PART:
 *
 *   a covering    fur, feathers, a scute, a plate. The body is already in the
 *                 business of making another, and `REGROWTH_YEARS_BY_GRADE`
 *                 counts how long that takes. Slow, painful, never given
 *                 lightly, and it does come back. Wound: `stripped-flesh`.
 *   a part        a limb, an eye, a fang, marrow, a gland. Nothing the body
 *                 does puts one back, at any rung, so there is no number of
 *                 years to state and the share arithmetic does not run.
 *                 Wound: `severed-flesh`, `permanent: true`.
 *
 * The two thresholds below survive as the dial for the first kind ONLY.
 *
 * And the wounds used to be `torn-meridians` and `severed-meridian` - the
 * channel family, borrowed because it was the only permanent physical row in
 * the catalog. A pulled tuft of fur is not a channel injury. The flesh family
 * is authored in `wounds.ts` now and this reads it.
 *
 * ── THE MEDICINE IS THE ONE THAT MENDS A BROKEN CULTIVATOR ──────────────
 *
 * It was written here that it is not, on the reading that
 * `structural-repair-medicine.ts` answers a structure that did not SET at a
 * realm wall and refuses everything else in as many words - which is what
 * `repairRefusalReason` used to say. The design owner overruled it: a dose
 * repairs every permanent injury at its rank, and missing flesh is one. So
 * `severed-flesh` is answered by whichever rung reaches the body carrying it,
 * and above the rank ladder by the chaos rung, which reaches any rank and
 * chooses the wound itself.
 *
 * ── WHAT IT COULD PART WITH IS READ, NEVER AUTHORED ─────────────────────
 *
 * No per-species table of parts, and no branch on an id. Two reads, in order:
 *
 *   1. The catalog's own rows for this creature, minus the ones that need it
 *      dead - a core is the whole of its cultivation and `taking: 'kill'` says
 *      a corpse is how the thing is got. What is left is what comes off a
 *      living body: a shed scute, a plastron. This is where a tortoise's shell
 *      lives, and its grade is what makes it the extreme case rather than any
 *      rule about tortoises.
 *   2. Where that set is empty - which is what the contract above MEANS - one
 *      piece is minted from the row: the part its ability lives in, at the
 *      grade its rung yields, worth what the catalog pays at that grade.
 *
 * `element` is carried into the description as data and never branched on,
 * which the beast schema requires in as many words.
 */

import {
    BEAST_MATERIALS,
    materialsOf,
    type Beast,
    type BeastMaterial,
    type MaterialTaking
} from '../../data/cultivation/beasts.js';
import { INJURY_SEVERITY_ORDER, type CreateInjuryParams } from '../cultivation/injuries.js';
import { isPermanentWound } from '../../data/cultivation/wounds.js';
import { lifespanForOrdinal } from '../cultivation/realms.js';
import { SEVERITY_ORDER, type Severity } from '../social/grudges.js';
import type { ShameInput } from '../social/shame.js';
import type { InjurySeverity, TechniqueGrade } from '../../schema/cultivation.js';
import { REGROWTH_YEARS_BY_GRADE } from './what-a-place-still-has-in-the-ground.js';
import { gradeOfWhatItYielded } from './hunting-a-spirit-beast.js';
import type { AskWeight } from '../social-leverage/an-attempt-to-move-somebody.js';

/**
 * Where an ability sits in a body.
 *
 * Keyed on the capability axis the schema already carries, for the reason
 * `howThisOneDealsWithPeople` keys a manner there: a new species gets a part
 * for free, and two creatures that do the same thing are made of the same
 * stuff. Not `element`, which the schema forbids branching on and which says
 * what a thing is made of rather than which piece of it does the work.
 */
const WHERE_AN_ABILITY_LIVES: Record<Beast['ability']['kind'], APartAnAbilityLivesIn> = {
    // The two outer coverings, and the only two rows here a body makes another
    // of. These are the tuft of fur and the tortoise's shell: given slowly,
    // painfully and never lightly, and given BACK by the body eventually.
    defence: { part: 'Plate', theBodyPutsItBack: true },
    concealment: { part: 'Pelt', theBodyPutsItBack: true },
    // Interior. Taking one out is taking a piece out of the body, and nothing
    // the body does replaces it at any rung on the ladder.
    movement: { part: 'Sinew', theBodyPutsItBack: false },
    breath: { part: 'Gland', theBodyPutsItBack: false },
    perception: { part: 'Eye', theBodyPutsItBack: false },
    endurance: { part: 'Marrow', theBodyPutsItBack: false },
    strength: { part: 'Fang', theBodyPutsItBack: false }
};

interface APartAnAbilityLivesIn {
    /** The noun, which becomes half the minted material's name. */
    part: string;
    /** Whether the body makes another. See the banner: it is not a band. */
    theBodyPutsItBack: boolean;
}

/**
 * Whether a body puts back a CATALOGUED part, keyed on how that part comes off.
 *
 * A row the catalog calls `shed` is a moulted or cast thing by definition, and
 * a `scavenge` row is found rather than taken off anything living, so both are
 * things a body is already making another of. `kill` needs a corpse and is
 * filtered out before this is asked.
 *
 * A MINTED piece is stamped `shed` because a living thing pulled it out itself,
 * which is what that column records - so its answer is the parts table's above
 * and not this one. One field may not carry both questions: see the banner, and
 * see the `sealed` row in AGENTS.md for what it costs when one does.
 */
const A_BODY_MAKES_ANOTHER: Readonly<Record<MaterialTaking, boolean>> = {
    shed: true,
    scavenge: true,
    kill: false
};

/**
 * What the catalog pays for material of a grade, which is the only honest
 * figure for a thing nobody has ever assayed.
 *
 * The median rather than the top: a minted piece is a piece, and the top of
 * each band is held by the whole hide or the whole shell. Read off the catalog
 * so a new row moves it, rather than typed here where it would drift.
 */
function whatTheCatalogPaysAt(grade: TechniqueGrade): number {
    const values = BEAST_MATERIALS
        .filter(m => m.grade === grade)
        .map(m => m.value)
        .sort((a, b) => a - b);
    if (values.length === 0) return 1;
    return values[Math.floor((values.length - 1) / 2)];
}

/** One thing a creature could take off itself and hand over. */
export interface APieceOfItself {
    material: BeastMaterial;
    /**
     * True where the catalog carries this row. False where it was minted, which
     * is the ordinary case for anything that speaks and is the contract rather
     * than a gap.
     */
    inTheCatalog: boolean;
    /**
     * Whether the body makes another one of these.
     *
     * The answer to "does it come back at all", which is a different question
     * from "how long does it take", and the whole reason a wound taken here can
     * be permanent at Qi Condensation. Read off the catalog for a catalog row
     * and off the parts table for a minted one.
     */
    theBodyPutsItBack: boolean;
}

/**
 * The piece a creature with no catalog rows can still produce.
 *
 * `harvestOrdinal` is 0 because nothing is being harvested. The field means
 * the rung below which TAKING this off a body kills you, and a thing handed
 * over was not taken off anything - the cost is on the other side of the
 * table, which is the whole of what this module computes.
 */
function mintedPieceOf(beast: Beast): BeastMaterial {
    const grade = gradeOfWhatItYielded(beast.ordinal);
    const { part } = WHERE_AN_ABILITY_LIVES[beast.ability.kind];
    return {
        id: `mat-given-${beast.id}-${part.toLowerCase()}`,
        name: `${beast.ability.name} ${part}`,
        grade,
        sourceBeastId: beast.id,
        // It came off a living thing by that thing's own act, which is what
        // shedding is. Nothing died and nothing was scavenged.
        taking: 'shed',
        core: false,
        value: whatTheCatalogPaysAt(grade),
        rarityWeight: 1,
        harvestOrdinal: 0,
        description:
            `The ${part.toLowerCase()} ${beast.ability.name} works out of, `
            + `${beast.element === null ? 'of no element in particular' : `${beast.element} all through`}. `
            + 'Pulled out by the thing it belonged to rather than cut off anything, and there '
            + 'is no assay standard for one because nobody has ever had one to assay.'
    };
}

/**
 * Everything this creature could hand over.
 *
 * Ordered cheapest first, so a caller that has to pick one picks the one it
 * would actually offer.
 */
export function whatItCouldPartWith(beast: Beast): readonly APieceOfItself[] {
    const offALivingBody = materialsOf(beast.id)
        .filter(m => !m.core && m.taking !== 'kill')
        .sort((a, b) => a.value - b.value);
    if (offALivingBody.length > 0) {
        return offALivingBody.map(material => ({
            material,
            inTheCatalog: true,
            theBodyPutsItBack: A_BODY_MAKES_ANOTHER[material.taking]
        }));
    }
    return [{
        material: mintedPieceOf(beast),
        inTheCatalog: false,
        theBodyPutsItBack: WHERE_AN_ABILITY_LIVES[beast.ability.kind].theBodyPutsItBack
    }];
}

/**
 * The piece the sentence actually named, and nothing where it named none.
 *
 * The strict half, for a caller that has not yet established that a piece of
 * a body is what is being asked for at all. A generic ask - to be taught, to
 * be travelled with - names no piece, and a reader that fell back to the
 * cheapest one would answer every question put to a creature as a question
 * about its fur.
 */
export function thePieceTheyNamed(
    beast: Beast,
    named: string | null
): APieceOfItself | null {
    const wanted = (named ?? '').trim().toLowerCase();
    if (wanted.length < 2) return null;
    return whatItCouldPartWith(beast).find(p =>
        p.material.name.toLowerCase().includes(wanted)
        || wanted.includes(p.material.name.toLowerCase())
        || wanted.split(/\s+/).some(word =>
            word.length >= 3 && p.material.name.toLowerCase().includes(word))) ?? null;
}

/** The piece somebody named, or the cheapest one when they named nothing. */
export function thePieceTheyAskedFor(
    beast: Beast,
    named: string | null
): APieceOfItself | null {
    return thePieceTheyNamed(beast, named) ?? whatItCouldPartWith(beast)[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT COSTS THE THING THAT GIVES IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two thresholds, as a share of the span the giver has left to spend.
 *
 * THEY GRADE A COVERING THAT COMES BACK, AND NOTHING ELSE. They used to decide
 * permanence as well - above a quarter of a span the wound was permanent - and
 * that made permanence a fact about the giver's rung, because a mortal-grade
 * piece is one year against a hundred wherever it is standing and an immortal
 * one is three thousand against five. Nothing below the top band could be
 * maimed by this. A wound is permanent at any realm; see the banner.
 *
 * Measured off the catalog and the ladder rather than picked: at ordinal 29 a
 * span is 5,000 years and a heaven-grade covering is 150 of them - three
 * percent, a real wound and not a maiming. An earth-grade shed piece off
 * something at 24 is 12 years of 1,000, which is the band a creature would
 * actually agree to.
 *
 * The same covering therefore costs a longer-lived creature less, which is
 * correct: how long a thing takes to come back is a fact about the material,
 * and what that length MEANS is a fact about who is waiting.
 */
const A_COVERING_IS_A_SCRATCH_BELOW = 0.02;
const A_COVERING_IS_CRIPPLING_ABOVE = 0.25;

/** What the giver is left with, stated in the machinery that already says it. */
export interface WhatGivingItCost {
    /**
     * Years before the body has it again, off the one regrowth ladder - or
     * null where it never does. Null is the answer callers must not soften: a
     * very large number of years is still a number somebody could wait out,
     * and this is not that.
     */
    growsBackInYears: number | null;
    /**
     * That length against the span the giver has to spend it out of, or null
     * where there is no length to weigh.
     */
    shareOfTheirSpan: number | null;
    /** The wound, ready for `createInjury`. Not written anywhere by this module. */
    wound: CreateInjuryParams;
    /**
     * Whether anything in the world closes it, asked of the wound key rather
     * than decided twice.
     */
    doesNotComeBack: boolean;
    /**
     * What it costs in standing, IF anybody was there. Null where nobody was,
     * which is the case the design turns on: the pain is unconditional and the
     * embarrassment is not.
     */
    shame: ShameInput | null;
    /** One factual line for the mechanical channel. */
    note: string;
}

/**
 * The flesh family, and which of the two this act produced.
 *
 * These were `torn-meridians` and `severed-meridian` - the CHANNEL family,
 * borrowed because it held the only permanent physical row the catalog had. A
 * tuft of fur pulled out is not a channel injury and an arm taken off is not a
 * parted meridian. `wounds.ts` authors the flesh pair now and this reads it.
 */
const A_COVERING_COMES_BACK = 'stripped-flesh';
const A_PART_DOES_NOT = 'severed-flesh';

export function whatGivingItCosts(input: {
    beast: Beast;
    piece: APieceOfItself;
    /**
     * Whose body it came off - the ONE standing on this ground, not the
     * species. A shame is held about a person, and the person here is the
     * individual `idOfTheOneOnThisGround` names.
     */
    subjectId: string;
    turn: number;
    onDay: number;
    /** Who is standing there. Empty is the private case and costs no standing. */
    seenBy: readonly string[];
}): WhatGivingItCost {
    const { beast, piece } = input;
    const span = Math.max(1, lifespanForOrdinal(beast.ordinal));
    const growsBackInYears = piece.theBodyPutsItBack
        ? REGROWTH_YEARS_BY_GRADE[piece.material.grade]
        : null;
    const share = growsBackInYears === null ? null : growsBackInYears / span;

    // A PART THAT IS GONE IS A MAIMING AT EVERY RUNG. There is no length of
    // time to weigh against a span, so the arithmetic below has nothing to say
    // about one and does not run. What decides is which part came off.
    const severity: InjurySeverity = share === null
        ? 'crippling'
        : share < A_COVERING_IS_A_SCRATCH_BELOW ? 'minor'
            : share < A_COVERING_IS_CRIPPLING_ABOVE ? 'serious'
                : 'crippling';
    const woundType = piece.theBodyPutsItBack ? A_COVERING_COMES_BACK : A_PART_DOES_NOT;

    const wound: CreateInjuryParams = {
        severity,
        // Nothing struck it and nothing backfired. `other` is the honest row
        // and the table's own catch-all for a body damaged by something the
        // six named sources do not cover.
        source: 'other',
        turn: input.turn,
        woundType,
        description:
            `${beast.name} pulled ${piece.material.name} out of itself. `
            + (growsBackInYears === null
                ? 'It does not come back. The body has the '
                  + `${span} years its rung grants without it.`
                : `${growsBackInYears} year${growsBackInYears === 1 ? '' : 's'} before the body `
                  + `has it again, against the ${span} it has to spend.`)
    };

    // ONE RUNG ON THE OTHER LADDER. The two scales have different lengths and
    // different names, and mapping by INDEX rather than by a table means a
    // fourth injury severity or a fifth shame band cannot silently disagree
    // with this.
    const standing: Severity =
        SEVERITY_ORDER[Math.min(SEVERITY_ORDER.length - 1, INJURY_SEVERITY_ORDER.indexOf(severity))];

    return {
        growsBackInYears,
        shareOfTheirSpan: share,
        wound,
        doesNotComeBack: isPermanentWound(woundType),
        shame: input.seenBy.length === 0 ? null : {
            subjectId: input.subjectId,
            cause: 'gave_up_part_of_themselves',
            severity: standing,
            onDay: input.onDay,
            description:
                `${beast.name} took ${piece.material.name} off its own body in front of `
                + `${input.seenBy.length} `
                + `${input.seenBy.length === 1 ? 'person' : 'people'}, because it was asked.`,
            heldBy: input.seenBy,
            common: false
        },
        note:
            `${piece.material.name} (${piece.material.grade}, `
            + `${piece.inTheCatalog ? 'catalog row' : 'minted'}) off ${input.subjectId} at ordinal `
            + `${beast.ordinal}: `
            + (share === null || growsBackInYears === null
                ? `the body makes no other, ${span}y span`
                : `${growsBackInYears}y regrowth / ${span}y span = ${(share * 100).toFixed(1)}%`)
            + ` -> ${severity}, ${woundType}, permanent=`
            + `${isPermanentWound(woundType)}. Seen by ${input.seenBy.length}.`
    };
}

/**
 * How heavy the ask is, which the offer ladder then reads.
 *
 * `against_their_interest` is the vocabulary's own row for *they end up worse
 * off, and they can see that while agreeing*, and that is the whole of this
 * ask whether the piece grows back in twelve years or never. What the
 * permanence changes is what it COSTS them, above, and not what the asking is.
 *
 * `a_betrayal` is deliberately not used. It means a thing that ends them if it
 * is found out, and this is the opposite: an act that costs most precisely
 * because it is done where people can see.
 */
export function theAskThisIs(): AskWeight {
    return 'against_their_interest';
}

/**
 * What is on the counter, for a haggle where the counter is a body.
 *
 * A figure exists and it is worth stating: a player may ask what it would
 * take, and being quoted a number is the mildest thing that can happen at a
 * table. It is also never how this closes - the ask sits below the cash line,
 * so the offer ladder refuses money before the arithmetic is reached.
 */
export function whatAPieceIsPricedAt(piece: APieceOfItself): number {
    return piece.material.value;
}
