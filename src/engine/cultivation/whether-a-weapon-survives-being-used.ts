/**
 * Whether a weapon survives being used.
 *
 * A weapon rated at a rung lets whoever holds it strike at that rung - that is
 * `realms.ts`'s reason for `OBJECT_CEILING_BELOW_THE_LID` and it is the whole
 * premise of the artifact catalog. This module is the other half of that
 * sentence: what happens to the object when the rung it is swung INTO is far
 * above the rung it was made at.
 *
 * It breaks.
 *
 * ── THE TWO LAYERS, AND KEEPING THEM APART ───────────────────────────────
 *
 * 1. REALM IS THE GATE, AND IT IS ABSOLUTE. You cannot unmake above your own
 *    rung. A Qi Condensation cultivator standing in front of an object rated
 *    forty-six does not have a bad chance of breaking it, they have no chance,
 *    and nothing carried, practised or rolled changes that. `canUnmake` is the
 *    gate and it is a hard predicate with no probability in it.
 *
 *    This is deliberately the SAME law that governs making. A cultivator
 *    cannot refine above their realm - `PILL_GRADE_REALM` and
 *    `pillBandOrdinal` in `breakthrough.ts` are that rule in the pill grades'
 *    own units, and `alchemy_manage` refuses with `realm_too_low` when the
 *    recipe's `requiredOrdinal` is above the alchemist. Breaking a thing is
 *    working with it. There is no second rule here, only the same one stated
 *    in the units artifacts use, which are rungs directly:
 *
 *        making    your rung must reach the grade's band     pillBandOrdinal
 *        unmaking  your rung must reach the object's rung    canUnmake
 *
 *    And it produces the immortal grade's most-quoted property without anybody
 *    writing it down: the immortal grade is made by nobody below the Lid, and
 *    it is unmade by nobody below the Lid, because both statements are
 *    `MAX ordinal anybody down here stands at < the rung of the thing`.
 *
 * 2. INSIDE THE GATE, ABILITY DECIDES. Two Void Refinement cultivators are not
 *    equally likely to break the same blade. What "ability" reads from is
 *    stated below and it is not a new stat.
 *
 * ── WHAT ABILITY READS FROM, AND WHY THAT AND NOT A NEW NUMBER ───────────
 *
 * The composite power `assessPower` already produces. It is the engine's one
 * answer to "how much is this person worth right now", and it already folds in
 * every candidate anybody would reach for: the rung, Might through the body
 * line, comprehension, the art and how well it is held, what they are
 * themselves carrying, battles survived, the ground under them, and their
 * condition - blood, qi and open wounds.
 *
 * So a superior opponent who is exhausted, badly hurt, fighting bare or
 * standing on ground that gives them nothing prices lower and breaks fewer
 * blades. That is the point: a stronger opponent is not a machine that deletes
 * your equipment, and the moment they are, the fight stops being worth playing.
 *
 * ── THE ONE QUANTITY ──────────────────────────────────────────────────────
 *
 * Everything below is one subtraction, taken twice.
 *
 *     realmsOutclassed = log_4( what it was swung into / what the weapon is worth )
 *
 * Both sides are on the ladder - `power` on an object is the same scale a
 * person stands on, which the artifact catalog states as its first design
 * claim - so the ratio of two of them is a number of realms, and the ladder's
 * own x4 step is the unit.
 *
 *     within a realm      the weapon is FIT. It does not break. This is what
 *                         makes a weapon of your own grade worth having and
 *                         a weapon above your grade worth wanting.
 *     one to two realms   it may break, and whether it does is who you are.
 *     two realms and up   it breaks.
 *
 * There is no table and no matchup enum. A tenth case is a tenth pair of
 * numbers and needs no branch.
 *
 * ── PASSIVE AND ACTIVE FALL OUT OF TAKING IT TWICE ───────────────────────
 *
 * The design owner's two examples - "their body is literally too hard" and
 * "they catch it with their fingers and break it type shit" - are explicitly
 * non-exhaustive, so they must not become a flavour field with two values.
 * They are not modelled as kinds. They are the SAME subtraction evaluated
 * against two different numerators:
 *
 *     passiveChance   the body ALONE: the rung, and the body line of the
 *                     breakdown, and nothing else. Nobody did anything. If
 *                     this reaches certainty the weapon is gone as a matter of
 *                     physics and no roll is taken, which is what the owner
 *                     means by too hard.
 *     chance          the WHOLE person, everything they are and brought.
 *
 * `chance - passiveChance` is exactly what their ability added, and the account
 * the engine writes reads off it. A third flavour is a third line in
 * `assessPower`'s breakdown - a new artifact, a new art - and it arrives with
 * no code here at all, named by `carriedBy` because that is read off whichever
 * factor happened to be largest.
 *
 * ── WHAT IS LEFT AFTERWARDS ───────────────────────────────────────────────
 *
 * Almost always nothing. Ruled by the design owner: everything below the
 * immortal grade is simply ruined, because fragments are TRACKED objects with
 * holders and provenance and a world where every broken sabre mints two rows is
 * a ledger full of rubble. That is `docs/world/things/items.md`'s counted-or-tracked
 * line doing its job rather than a simplification laid on top of it - the top
 * of the ladder is the only place the pieces are individually worth
 * remembering.
 *
 * What never goes is the RECORD. `items.md`'s "spent is not gone" applies in
 * full: a ruined weapon is a specific object with a provenance chain, and the
 * chain gains a link saying where it ended. See `ruin` in
 * `engine/world/possessions.ts`, which is the write half of this.
 *
 * ── WHAT THIS MODULE DOES NOT DO ──────────────────────────────────────────
 *
 * It does not decide who may hold what. There is no rule anywhere that a Core
 * Formation cultivator may not carry an object rated forty-five, and there must
 * not be one. The distribution is a CONSEQUENCE: a weapon far under the rung it
 * is used against breaks, so you want one at your own grade; one above your
 * grade is better and rare; and the reason somebody weak is not holding a great
 * one is that somebody strong wants it and will come. Nothing here enforces
 * that and nothing here should.
 */

import { MAX_ORDINAL, OBJECT_CEILING_BELOW_THE_LID, REALM_TIERS } from './realms.js';
import { shardPower } from '../world/possessions.js';

// ═════════════════════════════════════════════════════════════════════════
// TUNING
// ═════════════════════════════════════════════════════════════════════════

/**
 * The ladder's own step between realms, read off the ladder rather than typed.
 *
 * `REALM_TIERS` climbs 1, 4, 16, 64 ... so the ratio between adjacent realms is
 * the unit every number below is expressed in. Derived because a retune of the
 * ladder must move this with it; a 4 written here would go stale silently and
 * turn every threshold in this file into a different claim.
 */
export const REALM_POWER_STEP: number =
    REALM_TIERS.length > 1
        ? REALM_TIERS[1].powerMultiplier / REALM_TIERS[0].powerMultiplier
        : 4;

/**
 * How far a weapon can be outclassed and still be FIT.
 *
 * One realm. Under this, nothing happens to it at any odds - which is the
 * entire reason to carry a weapon at your own grade, and the reason a weapon
 * above your grade is worth wanting rather than merely worth more.
 *
 * It is one realm rather than zero because a weapon should be adequate against
 * the people you actually fight. Within a realm is where contested fights
 * happen - `assessGap` calls one realm `outmatched` and still a fight - and a
 * blade that shattered every time somebody slightly better looked at it would
 * make equipment a consumable rather than a possession.
 */
export const FIT_WITHIN_REALMS = 1;

/**
 * How far a weapon can be outclassed before the answer stops being a chance.
 *
 * Two realms, which is `HELPLESS_REALM_GAP` and not a coincidence: two realms
 * is the gap the whole setting calls categorical, where `assessGap` stops
 * returning a fight at all. An object two realms under what it is swung into is
 * in exactly the position a person two realms under is, and the engine says the
 * same thing about it.
 *
 * It is also where the design owner's own example lands - "swing a sword at
 * someone two realms above and they shatter it" - which is the calibration
 * check for this number.
 */
export const CERTAIN_ABOVE_REALMS = 2;

/**
 * The rung at and above which a broken object leaves fragments worth tracking.
 *
 * ── This number is a judgement and here is the argument for it ────────────
 *
 * The ruling is "weapons below immortal just get ruined". Grade is a band and
 * the artifact catalog stores rungs, so the boundary has to be stated as a
 * rung, and the honest candidates were 41 - the highest anything below the Lid
 * has ever been forged, stated in `artifacts.ts` - and 45, the rung at which an
 * object stops being something anybody here could have made at all.
 *
 * 45 is taken. `HOW_A_FORTY_FIVE_EXISTS.shattered` is the world's only
 * documented case of an object leaving pieces, and it is exactly this: a
 * forty-six came apart and what stayed was forty-fives. Setting the floor here
 * reproduces that sentence and nothing else in the catalog, which is the
 * property wanted - the ledger fills with rubble at any lower figure, and every
 * object anybody down here can actually swing is ruined outright.
 *
 * If a later ruling wants the Hollow Court's forty-threes to leave pieces too,
 * this is the one number to move and every consequence follows it.
 */
export const FRAGMENTS_AT_OR_ABOVE = 45;

// ═════════════════════════════════════════════════════════════════════════
// THE GATE
// ═════════════════════════════════════════════════════════════════════════

export interface UnmakingReach {
    /** Whether this rung reaches the object at all. */
    reaches: boolean;
    /** Where the would-be breaker stands. */
    standingAt: number;
    /** The rung the object is rated at, which is the rung needed to unmake it. */
    needs: number;
    /** Engine-authored account. Always names the cause, in both directions. */
    cause: string;
}

/**
 * Whether somebody at this rung can unmake an object at that rung, at all.
 *
 * Hard, absolute and unrolled. Your rung must reach the thing's rung, which is
 * the making rule read backwards and is stated in the module header. Nothing
 * about ability, luck, preparation or numbers appears here, deliberately: a
 * probability in this function would be a second way past a gate the setting
 * says has no way past it.
 */
export function canUnmake(standingAt: number, objectPower: number): UnmakingReach {
    const reaches = standingAt >= objectPower;
    return {
        reaches,
        standingAt,
        needs: objectPower,
        cause: reaches
            ? `A rung of ${standingAt} reaches a thing rated ${objectPower}. What is made at a rung ` +
              'can be unmade at it.'
            : `A rung of ${standingAt} does not reach a thing rated ${objectPower}. Nobody unmakes what ` +
              'they could not have made, and no amount of skill, preparation or luck is a substitute ' +
              `for standing at ${objectPower}.`
    };
}

// ═════════════════════════════════════════════════════════════════════════
// THE ONE QUANTITY
// ═════════════════════════════════════════════════════════════════════════

/**
 * How many realms one standing outclasses another by.
 *
 * A ratio on the power ladder read as a count of realms, because the ladder's
 * step is constant and a ratio is therefore a distance in rungs-of-realm.
 * Negative when the second is the larger, which is the ordinary case for a good
 * weapon and is why the thresholds below are one-sided.
 */
export function realmsBetween(higher: number, lower: number): number {
    if (!(higher > 0) || !(lower > 0)) return 0;
    return Math.log(higher / lower) / Math.log(REALM_POWER_STEP);
}

export interface WeaponExposureInput {
    /** The rung the weapon is rated at. `ObjectRecord.power`. */
    weaponPower: number;
    /**
     * What an object of that rung is worth on the combat scale.
     *
     * Supplied by the caller rather than computed here, because it has to be on
     * the same scale as `metBy` and only the caller knows that scale.
     * `combat.ts` passes `combatPowerForOrdinal(weaponPower)`, which is the
     * scale everything else in a fight is measured on.
     */
    weaponStanding: number;
    /** The whole composite power of the body it was swung into. */
    metBy: number;
    /**
     * That same body's rung and body line ALONE, with nothing they brought and
     * nothing they did. This is the numerator for the passive reading.
     */
    metByBodyAlone: number;
    /** Where the body it was swung into stands, for the gate. */
    metByOrdinal: number;
    /**
     * The breakdown lines of the body it was swung into, so the account can
     * name whichever one carried it. Optional and purely for the sentence.
     */
    factors?: readonly { source: string; factor: number }[];
    /**
     * The same pricing used for `weaponStanding`, as a function, so the account
     * can name the rung that WOULD have held.
     *
     * Optional; without it the sentence says what happened and not what would
     * not have. Supplied rather than derived because rungs are not linear in
     * power - realms have different numbers of sub-ranks - so converting a
     * distance in realms back into a rung by arithmetic is a unit error waiting
     * to be committed, and searching the actual ladder is not.
     */
    standingOf?: (ordinal: number) => number;
    /** Highest rung the search above will consider. `MAX_ORDINAL` by default. */
    ladderTop?: number;
}

export interface WeaponExposure {
    reach: UnmakingReach;
    weaponPower: number;
    /** Realms the weapon is outclassed by, counting the body alone. */
    realmsByBodyAlone: number;
    /** Realms the weapon is outclassed by, counting everything. */
    realmsInFull: number;
    /** Odds the body alone would break it with nobody doing anything, 0..1. */
    passiveChance: number;
    /** Odds this blow ends the weapon, 0..1. Zero whenever the gate refuses. */
    chance: number;
    /**
     * True when the body alone accounts for the whole of it.
     *
     * Nobody acted. The weapon met something harder than it was and that was
     * the entire event - which is the design owner's first example and reads as
     * a fact about what was swung rather than as an achievement of theirs.
     *
     * Not a kind and not a stored flavour: it is `passiveChance >= chance`, so
     * it moves on its own when a wound, an empty ground or an exhausted body
     * takes the rest of the person's contribution away.
     */
    bodyAlone: boolean;
    /**
     * Which line of the breakdown carried the part the body alone did not.
     * Empty for the passive case, which is the point of it being empty.
     */
    carriedBy: string;
    /**
     * The rung an object would have had to be rated at to hold here, or null
     * when the caller supplied no way to search the ladder.
     *
     * Above `OBJECT_CEILING_BELOW_THE_LID` is a real and useful answer: it means
     * nothing that can be held in this world would have survived, which is the
     * honest thing to tell somebody rather than pointing them at a better sword.
     */
    heldAt: number | null;
    /** Engine-authored, and it always names what would not have broken. */
    cause: string;
}

/**
 * Price a weapon against the body it was swung into.
 *
 * Reports; decides nothing. No RNG, so a caller may ask this to show a player
 * their odds before they swing - which is what every other gated-then-rolled
 * system in this engine does, and this should look like the rest of the game.
 */
export function weaponExposure(input: WeaponExposureInput): WeaponExposure {
    const reach = canUnmake(input.metByOrdinal, input.weaponPower);

    const realmsInFull = realmsBetween(input.metBy, input.weaponStanding);
    const realmsByBodyAlone = realmsBetween(input.metByBodyAlone, input.weaponStanding);

    const span = CERTAIN_ABOVE_REALMS - FIT_WITHIN_REALMS;
    const rawFull = clamp01((realmsInFull - FIT_WITHIN_REALMS) / span);
    const rawBody = clamp01((realmsByBodyAlone - FIT_WITHIN_REALMS) / span);

    const chance = reach.reaches ? rawFull : 0;
    const passiveChance = reach.reaches ? rawBody : 0;
    // Passive is "nothing they did contributed", which is a comparison and not
    // a threshold. Certainty is a separate property and lives in `chance`.
    const bodyAlone = chance > 0 && passiveChance >= chance;

    const carriedBy = bodyAlone || chance <= 0 ? '' : largestLine(input.factors);

    return {
        reach,
        weaponPower: input.weaponPower,
        realmsByBodyAlone,
        realmsInFull,
        passiveChance,
        chance,
        bodyAlone,
        carriedBy,
        heldAt: rungThatWouldHold(input),
        cause: describeExposure(input, reach, realmsInFull, chance, bodyAlone, carriedBy)
    };
}

/**
 * What the account says, and it always says what would NOT have broken.
 *
 * A consequence that does not name its cause is indistinguishable from a bug,
 * and somebody whose sword has just come apart is owed both halves: why this
 * one went, and what they would have had to be carrying instead. The second
 * half is a subtraction rather than a lookup - a weapon within
 * `FIT_WITHIN_REALMS` of what it was swung into is fit - so the sentence can
 * name the rung honestly instead of gesturing at a better sword.
 */
function describeExposure(
    input: WeaponExposureInput,
    reach: UnmakingReach,
    realmsInFull: number,
    chance: number,
    bodyAlone: boolean,
    carriedBy: string
): string {
    if (!reach.reaches) return reach.cause;

    if (chance <= 0) {
        return `Rated ${input.weaponPower} against something ${realmsInFull.toFixed(2)} realms above it. ` +
            `That is within ${FIT_WITHIN_REALMS} realm, which is what a weapon is for. It holds.`;
    }

    const held = rungThatWouldHold(input);
    const remedy =
        held === null
            ? ''
            : held > OBJECT_CEILING_BELOW_THE_LID
                ? ' Nothing that can be held in this world would have survived it.'
                : ` Something rated ${held} would have held.`;

    const gap =
        `Rated ${input.weaponPower} against something ${realmsInFull.toFixed(2)} realms above it. ` +
        `Past ${FIT_WITHIN_REALMS} realm a weapon starts coming apart, and at ${CERTAIN_ABOVE_REALMS} ` +
        `it is not a chance.` + remedy;

    if (bodyAlone) {
        return gap + ' Nothing was done to it: it met a body harder than it was, which is not an ' +
            'achievement of theirs and is entirely a fact about what was swung.';
    }
    return carriedBy === ''
        ? gap
        : gap + ` The body alone would not have done it - what did was ${carriedBy}.`;
}

/**
 * The lowest rung an object could be rated at and still hold here.
 *
 * Walked up the actual ladder rather than computed, because the ladder is not
 * linear in rungs - Qi Condensation is thirteen sub-ranks and every realm above
 * it is four - so any arithmetic that turns a distance in realms back into a
 * rung is wrong somewhere on the scale. Null when the caller gave no pricing.
 */
function rungThatWouldHold(input: WeaponExposureInput): number | null {
    const priced = input.standingOf;
    if (!priced) return null;
    const top = input.ladderTop ?? MAX_ORDINAL;
    for (let rung = Math.max(0, Math.floor(input.weaponPower)); rung <= top; rung++) {
        if (realmsBetween(input.metBy, priced(rung)) <= FIT_WITHIN_REALMS) return rung;
    }
    return top + 1;
}

function largestLine(factors: readonly { source: string; factor: number }[] | undefined): string {
    if (!factors || factors.length === 0) return '';
    let best = '';
    let bar = 1;
    for (const f of factors) {
        if (f.source === 'body') continue;
        if (f.factor > bar) {
            bar = f.factor;
            best = f.source;
        }
    }
    return best;
}

// ═════════════════════════════════════════════════════════════════════════
// THE OUTCOME
// ═════════════════════════════════════════════════════════════════════════

export interface WeaponUnmade {
    exposure: WeaponExposure;
    /** Whether the weapon ended here. */
    broke: boolean;
    /**
     * The sample that decided it, or null when nothing was uncertain.
     *
     * Null in both directions: a fit weapon is not rolled for and neither is a
     * body two realms past it. The engine only draws when the answer is
     * genuinely in doubt, which is also what keeps the passive case honest -
     * "no ability roll at all" is the literal behaviour, not a description of a
     * roll that could not fail.
     */
    roll: number | null;
    /**
     * Whether anything is left. Almost always false: everything below
     * `FRAGMENTS_AT_OR_ABOVE` is ruined outright and mints no rows.
     */
    leavesFragments: boolean;
    /** The rung of what is left, or null when nothing is. */
    fragmentPower: number | null;
    narrationHint: string;
}

/**
 * Decide it.
 *
 * The RNG is drawn from at most once and only inside the uncertain band, so a
 * caller who passes no weapon and a caller whose weapon is fit both leave the
 * stream exactly where they found it.
 */
export function resolveWeaponAgainstBody(
    input: WeaponExposureInput,
    rng: { next(): number }
): WeaponUnmade {
    const exposure = weaponExposure(input);

    let roll: number | null = null;
    let broke: boolean;
    if (exposure.chance <= 0) {
        broke = false;
    } else if (exposure.chance >= 1) {
        broke = true;
    } else {
        roll = rng.next();
        broke = roll < exposure.chance;
    }

    const leavesFragments = broke && input.weaponPower >= FRAGMENTS_AT_OR_ABOVE;
    const fragmentPower = leavesFragments ? shardPower(input.weaponPower) : null;

    return {
        exposure,
        broke,
        roll,
        leavesFragments,
        fragmentPower,
        narrationHint: broke
            ? exposure.cause +
              (leavesFragments
                  ? ` What is left is worth ${fragmentPower}, which is the ordinary rule for a piece of ` +
                    'anything, meeting the one band where a piece is still worth somebody writing down.'
                  : ' Nothing is left of it worth carrying away. The record of it stands; the object does not.')
            : exposure.cause
    };
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
