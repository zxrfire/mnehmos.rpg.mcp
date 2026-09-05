/**
 * Whether a weapon survives being used.
 *
 * The design owner's two examples - "their body is literally too hard" and "they
 * catch it with their fingers and break it type shit" - are explicitly
 * non-exhaustive, so they must not become a flavour field with two values. They
 * are the SAME subtraction against two different numerators.
 *
 * It does not decide who may hold what. There is no rule that a Core Formation
 * cultivator may not carry an object rated forty-five, and there must not be one:
 * the distribution is a CONSEQUENCE.
 */

import { MAX_ORDINAL, OBJECT_CEILING_BELOW_THE_LID, REALM_TIERS } from './realms.js';
import { shardPower } from '../world/possessions.js';

// TUNING

/**
 * The ladder's own step between realms, read off the ladder rather than typed.
 */
export const REALM_POWER_STEP: number =
    REALM_TIERS.length > 1
        ? REALM_TIERS[1].powerMultiplier / REALM_TIERS[0].powerMultiplier
        : 4;

/**
 * How far a weapon can be outclassed and still be FIT.
 */
export const FIT_WITHIN_REALMS = 1;

/**
 * How far a weapon can be outclassed before the answer stops being a chance and
 * becomes a certainty. Where the design owner's own example lands - "swing a sword
 * at someone two realms above and they shatter it" - which is the calibration
 * check for this number.
 */
export const CERTAIN_ABOVE_REALMS = 2;

/**
 * The rung at and above which a broken object leaves fragments worth tracking.
 */
export const FRAGMENTS_AT_OR_ABOVE = 45;

// THE GATE

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

// THE ONE QUANTITY

/**
 * How many realms one standing outclasses another by.
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
     * The same pricing used for `weaponStanding`, as a function, so the account can
     * name the rung that WOULD have held.
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
     */
    bodyAlone: boolean;
    /**
     * Which line of the breakdown carried the part the body alone did not.
     * Empty for the passive case, which is the point of it being empty.
     */
    carriedBy: string;
    /**
     * The rung an object would have had to be rated at to hold here, or null when
     * the caller supplied no way to search the ladder.
     */
    heldAt: number | null;
    /** Engine-authored, and it always names what would not have broken. */
    cause: string;
}

/**
 * Price a weapon against the body it was swung into.
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

// THE OUTCOME

export interface WeaponUnmade {
    exposure: WeaponExposure;
    /** Whether the weapon ended here. */
    broke: boolean;
    /**
     * The sample that decided it, or null when nothing was uncertain.
     */
    roll: number | null;
/**
 * Whether anything is left. Almost always false: ruled by the design owner,
 * everything below the immortal grade is simply ruined, because fragments are
 * TRACKED objects with holders and provenance and a world where every broken sabre
 * mints two rows is a ledger full of rubble.
 */
    leavesFragments: boolean;
    /** The rung of what is left, or null when nothing is. */
    fragmentPower: number | null;
    narrationHint: string;
}

/**
 * Decide it.
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
