/**
 * Whether a thing survives what was put through it, and what state it is left
 * in.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING THIS FILE EXISTS TO ENFORCE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, asked how a spirit boat comes apart when two houses fight:
 *
 *   > no bespoke logic, the same way that a sword breaks.
 *
 * So there is ONE function that answers "is this thing damaged, and how
 * badly", and it does not know what the thing is. A hull, a sabre, a carriage,
 * a formation plate, a spirit tool and a manual all reach it, and every one of
 * them is priced off the same three numbers.
 *
 * The enforcement is in the TYPE, not in a comment. {@link ThingUnderForce}
 * deliberately does not carry `ObjectKind`. An `ObjectRecord` passes straight
 * in - the field is simply not visible on the other side - so a branch on
 * boat-versus-sword cannot be written here without somebody first widening the
 * input, which is a change a reviewer can see. `breakSpiritBoat` is not a
 * function that was left out; it is a function this signature makes
 * unwriteable.
 *
 * Everything specific to a boat comes off the boat's own row: its `power`, its
 * `significance`, its owner, its scars. Take the row away and there is no boat
 * logic left over anywhere.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ARITHMETIC IS NOT HERE, AND THAT IS THE POINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `engine/cultivation/whether-a-weapon-survives-being-used.ts` already owns the
 * whole quantity: a gate on the rung, then one subtraction on the ladder taken
 * twice. This file adds no second opinion about how hard it is to break
 * something. It calls `weaponExposure` verbatim and answers a different
 * question with the result: not "did the weapon end" but "what state is the
 * thing in now".
 *
 * What that module names `weaponPower` and `metBy`, this one names `the thing`
 * and `the force`, because they were never about weapons and bodies - they are
 * a rung on the ladder and another rung on the ladder, and the ratio of two
 * rungs is a number of realms whatever is standing at either end.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * BREAKING IS NOT BINARY
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The catalog already talks about three different ruined things and they are
 * genuinely different states, so `broke: boolean` cannot carry them:
 *
 *   SHATTERED  it ended and the pieces are worth a row each. `shatter`.
 *   RUINED     it ended and there is nothing on the ground worth carrying
 *              away. `ruin`. The ordinary case, by a long way.
 *   HOLED      it took the blow, it is worth less than it was, and it can be
 *              mended. A scar with a date and a cause on it.
 *   INERT      *a spirit tool with the qi long gone out of it* - the phrase is
 *              `encounters.ts`'s and `the-late-age.md`'s. Still an object,
 *              still on somebody's shelf, and no longer worth anything. This
 *              is where a thing nobody mended ends up.
 *   GONE       it stopped existing and left no record, because it never had
 *              one.
 *
 * None of those five is a kind of object. Which one a thing lands in is
 * decided by two numbers - how far it was outclassed, and how many scars it is
 * already carrying - and by one property of the row: whether there is a row.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT `power` MEANS, BECAUSE EVERYTHING HERE IS READ OFF IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `ObjectRecord.power` is WHAT A THING CONTRIBUTES TO FORCE, on the same ladder
 * a person stands on. Ruled by the design owner, and it is narrower than it
 * looks:
 *
 *   A WEAPON has one. It lets whoever holds it strike at its rung, which is the
 *   artifact catalog's founding claim.
 *   A HULL has one. Being inside it puts a rated thing between you and what is
 *   coming - see `sheltering.ts`, where that is `canUnmake` and not a bonus.
 *   A MEDICINE HAS NONE. *The pill itself doesn't make you stronger, it stores
 *   hp* - and taking one is an ACT, worth a round you were not guarding in,
 *   which is the fight's business and not this column's.
 *   A SINGLE-USE DAO MATERIAL HAS NONE. It is worth an enormous amount and none
 *   of it is worth anything in a fight.
 *
 * So a row whose `power` is really *the rung this thing is FOR* is writing a
 * different quantity into the column, and everything in this file, in
 * `sheltering.ts` and in the confrontation will read it as force. `data.forOrdinal`
 * is where that number belongs and two catalogs already carry it there as well.
 * Nothing here compensates for the confusion, deliberately: this module reads
 * the field as documented, and a row that means something else by it is the
 * row's defect.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * COUNTED THINGS CANNOT BE DAMAGED, AND THAT IS NOT A SIMPLIFICATION
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `docs/world/things/items.md` splits the world's things into what is a number on
 * a holder's row and what is one object with a history. A COUNTED CARRIAGE
 * CANNOT BE HOLED, because there is nowhere to write the scar: the holder has
 * three carriages, not three carriages one of which has a hole in it. So the
 * only two answers available to it are `held` and `gone`, and `gone` writes
 * nothing anywhere - the caller decrements a line.
 *
 * A TRACKED hull can carry a scar with a date and a cause on it, be mended,
 * and be asked about in two hundred years. Both answers are correct and they
 * are not the same answer, which is why {@link keptAs} is consulted rather
 * than smoothed over. It is also the ONLY place this file branches, and note
 * what it branches on: whether the world keeps a history of this thing, never
 * what the thing is.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A BROKEN THING IS A WRONG DONE TO A PERSON
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Whose it was and who broke it are carried out of here on every result, and
 * {@link whatItCostThem} turns the loss into the one number
 * `engine/social-leverage/what-a-deed-leaves.ts` reads: what it cost against
 * what they had. Breaking the only rated thing a poor house owns and breaking
 * one of an apex's forty are the same deed and different weights, which is
 * that file's own thesis arriving here with no new machinery.
 *
 * Nothing in this file branches on the cause. `ForceApplied.cause` is carried
 * through untouched and never read, exactly as `Deed.cause` is - a tenth way
 * for a thing to get broken needs a tenth caller and no code here.
 *
 * PURE. State in, deltas out, no mutation of inputs, at most one draw and only
 * where the answer is genuinely in doubt.
 */

import {
    CERTAIN_ABOVE_REALMS,
    FIT_WITHIN_REALMS,
    FRAGMENTS_AT_OR_ABOVE,
    weaponExposure,
    type WeaponExposure
} from '../cultivation/whether-a-weapon-survives-being-used.js';
import {
    canUnmake
} from '../cultivation/whether-a-weapon-survives-being-used.js';
import {
    isRuined,
    keptAs,
    ruin,
    shardPower,
    shatter,
    type KeptAs,
    type ObjectRecord,
    type ObjectSignificance,
    type ProvenanceEntry
} from './possessions.js';

// ═════════════════════════════════════════════════════════════════════════
// TUNING
// ═════════════════════════════════════════════════════════════════════════

/**
 * How many holes a thing takes before the qi goes out of it.
 *
 * ── This number is a judgement and here is the argument for it ────────────
 *
 * Every scar costs a rung, because a rung down is the ONLY movement this world
 * allows a thing's rating - `shardPower` in `possessions.ts`, and nothing else
 * anywhere moves a grade in either direction. So the question is only how many
 * rungs a thing gives up before it stops answering at all.
 *
 * One is wrong: a thing that dies of the first hole makes mending pointless,
 * and mending is the whole reason `holed` is a state rather than a step on the
 * way to `ruined`. Ten is wrong the other way: the Late Age is FULL of tools
 * with the qi long gone out of them - a child's toy is one - and that only
 * happens if it happens on a human timescale.
 *
 * Three, which is a thing that has been holed more often than anybody has
 * bothered to mend it. Move this and the population of dead spirit tools moves
 * with it; nothing else reads it.
 */
export const SCARS_BEFORE_THE_QI_GOES = 3;

/**
 * Where a thing with no rating stands on the ladder.
 *
 * `power` is null on most rows and it means *worth nothing in a fight* rather
 * than *made of paper*, so an unrated thing is not exempt from the arithmetic -
 * it is at the bottom of it. Rung zero, and then the ordinary subtraction
 * applies with no special case: anybody at a real rung outclasses zero by
 * several realms, which is a mortal sword against a cultivator and is the
 * correct answer.
 *
 * It also means an unrated thing can never be HOLED - `shardPower(0)` is 0, so
 * there is no rung for a scar to take - and it goes straight to the end state.
 * That falls out of the arithmetic rather than being written down as a rule.
 */
export const UNRATED_STANDS_AT = 0;

// ═════════════════════════════════════════════════════════════════════════
// WHAT GOES IN
// ═════════════════════════════════════════════════════════════════════════

/**
 * Everything this resolver may see about a thing.
 *
 * NOTE WHAT IS ABSENT: `kind`. An `ObjectRecord` satisfies this type, so every
 * caller passes the whole row and this side sees only the four fields that are
 * true of a hull, a sabre and a manual alike. Widening it is how a boat branch
 * would get written, so widening it is the thing to argue about in review.
 */
export interface ThingUnderForce {
    id: string;
    name: string;
    /** The rung it is rated at, or null for the great majority of things. */
    power: number | null;
    /** Which of the two stored tiers it is in. Read through {@link keptAs}. */
    significance: ObjectSignificance;
    /** Scars, the `ruined` mark and the `inert` mark all live here. */
    tags: readonly string[];
    /** Where the scar count and the rung it was whole at are kept. */
    data: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * What is being put through it, in the only terms the ladder has.
 *
 * The three numbers are exactly what `weaponExposure` asks for and they are
 * deliberately not "a person". A house's strongest hand in a war supplies
 * them; so does a formation coming down, a sea, a beast, or a mountain moving.
 * Whatever can be priced on the ladder can break something, and nothing here
 * needs to know which it was.
 */
export interface ForceApplied {
    /** The whole composite standing of it, on the combat scale. */
    standing: number;
    /**
     * The same thing's rung and body line ALONE, with nothing it brought.
     *
     * Passive versus active, kept for the same reason `weaponExposure` keeps
     * it: a hull that came apart because the sea it was in was too much for it
     * and a hull somebody took apart are different sentences, and the
     * difference is a subtraction rather than a flavour field.
     */
    bare: number;
    /** The rung behind it. The gate, and the gate is absolute. */
    ordinal: number;
    /** Who did it, or null when nobody did - weather, a collapse, the sea. */
    byId: string | null;
    byName: string;
    /**
     * What it was, in the caller's own words. DATA. Carried onto the record
     * and the account and never read by anything in this file. Grep it: there
     * is no `switch (cause)` here and there must not be one.
     */
    cause: string;
    /** Breakdown lines, so the account can name whichever one carried it. */
    factors?: readonly { source: string; factor: number }[];
    /**
     * The pricing used for `standing`, so the account can name the rung that
     * WOULD have held. `combatPowerForOrdinal` at every live call site.
     */
    standingOf?: (ordinal: number) => number;
}

// ═════════════════════════════════════════════════════════════════════════
// WHAT COMES OUT
// ═════════════════════════════════════════════════════════════════════════

/**
 * What state the thing is in afterwards.
 *
 * Five words rather than a boolean, and none of them is a kind of object. See
 * the header for what each one is and which of the catalog's own sentences it
 * comes from.
 */
export type ThingState =
    /** Nothing happened to it. The gate refused, or it was fit for this. */
    | 'held'
    /** Worth a rung less, carrying a dated scar, and mendable. */
    | 'holed'
    /** Still an object; the qi has gone out of it. Rated nothing, forever. */
    | 'inert'
    /** It ended. The row and the whole provenance chain stay. */
    | 'ruined'
    /** It ended and left pieces, each an ordinary object one rung down. */
    | 'shattered'
    /** It stopped existing. There was no row, so there is no record of it. */
    | 'gone';

/** Whether this state is one the thing came out the other side of. */
export function stillExists(state: ThingState): boolean {
    return state === 'held' || state === 'holed' || state === 'inert';
}

export interface ThingHarmed {
    /** The one quantity, unchanged and unwrapped, so a caller can show it. */
    exposure: WeaponExposure;
    state: ThingState;
    /** Which tier decided which answers were available at all. */
    keptAs: KeptAs;
    /**
     * The sample that decided it, or null when nothing was in doubt.
     *
     * Null in both directions and for the same reason `resolveWeaponAgainstBody`
     * keeps it null: a fit thing is not rolled for and neither is one two
     * realms under what came at it. A caller that passes no stream at all gets
     * the certain answers and `held` everywhere else, which is what a preview
     * wants.
     */
    roll: number | null;
    /** The rung it stood at going in, with any earlier scars already off it. */
    ratedBefore: number | null;
    /** The rung it stands at coming out. Null once the qi has gone. */
    ratedAfter: number | null;
    /** Scars it carries now, this one included. */
    scars: number;
    /** Whether a hand at the right rung could put it back. */
    mendable: boolean;
    /** True only at `shattered`. Almost never - see `FRAGMENTS_AT_OR_ABOVE`. */
    leavesPieces: boolean;
    piecePower: number | null;
    /** Whose it was. The party with standing to be aggrieved. */
    ownerId: string | null;
    ownerName: string;
    /** Who did it, when anybody did. */
    byId: string | null;
    byName: string;
    /** Engine-authored. Names the thing, the cause, and what would have held. */
    account: string;
}

// ═════════════════════════════════════════════════════════════════════════
// THE ONE RESOLVER
// ═════════════════════════════════════════════════════════════════════════

/**
 * What becomes of a thing that has had something put through it.
 *
 * One call, one answer, and no knowledge of what it was handed. Reads three
 * numbers off the thing's own row and three off the force, and every sentence
 * about spirit boats in the setting is this function meeting a row whose
 * `power` came out of a shipwright's yard.
 *
 * `rng` may be null, in which case nothing uncertain is resolved and the
 * uncertain band answers `held`. That is a PREVIEW rather than a resolution -
 * `exposure.chance` is the honest number to show somebody before they swing,
 * and every other gated-then-rolled system in this engine shows its odds
 * first.
 */
export function whatBecomesOfIt(
    thing: ThingUnderForce,
    force: ForceApplied,
    rng: { next(): number } | null
): ThingHarmed {
    const tier = keptAs(thing.significance);
    const ratedBefore = thing.power;
    const standsAt = ratedBefore ?? UNRATED_STANDS_AT;
    const scarsAlready = scarsOn(thing);

    const exposure = weaponExposure({
        weaponPower: standsAt,
        weaponStanding: force.standingOf
            ? force.standingOf(standsAt)
            : Math.max(1e-9, standsAt),
        metBy: force.standing,
        metByBodyAlone: force.bare,
        metByOrdinal: force.ordinal,
        factors: force.factors,
        standingOf: force.standingOf
    });

    // A thing already ended, or already emptied, is not broken again. Said
    // here rather than left to the caller because every caller would otherwise
    // have to remember it, and one of them would not.
    const spent = isRuined(thing as unknown as ObjectRecord) || isInert(thing);

    const base = {
        exposure,
        keptAs: tier,
        ratedBefore,
        ownerId: null as string | null,
        ownerName: '',
        byId: force.byId,
        byName: force.byName,
        leavesPieces: false,
        piecePower: null as number | null
    };

    if (spent || exposure.chance <= 0) {
        return {
            ...base,
            state: 'held',
            roll: null,
            ratedAfter: ratedBefore,
            scars: scarsAlready,
            mendable: scarsAlready > 0 && !spent,
            account: spent
                ? `${thing.name} is already past being broken. ${exposure.cause}`
                : `${thing.name}: ${exposure.cause}`
        };
    }

    let roll: number | null = null;
    let ended: boolean;
    if (exposure.chance >= 1) {
        ended = true;
    } else if (rng === null) {
        // Preview. Nothing is drawn and nothing is decided.
        return {
            ...base,
            state: 'held',
            roll: null,
            ratedAfter: ratedBefore,
            scars: scarsAlready,
            mendable: scarsAlready > 0,
            account: `${thing.name}: ${exposure.cause} Nothing has been resolved.`
        };
    } else {
        roll = rng.next();
        ended = roll < exposure.chance;
    }

    if (ended) return theEnd(thing, base, roll, scarsAlready, standsAt, tier);
    return theMark(thing, base, roll, scarsAlready, standsAt, tier);
}

/**
 * It did not come out the other side.
 *
 * Three answers, and the one that applies is decided by the tier and by the
 * rung. Nothing about what the thing was for.
 */
function theEnd(
    thing: ThingUnderForce,
    base: Omit<ThingHarmed, 'state' | 'roll' | 'ratedAfter' | 'scars' | 'mendable' | 'account'>,
    roll: number | null,
    scarsAlready: number,
    standsAt: number,
    tier: KeptAs
): ThingHarmed {
    // A counted thing has no row, so it has no ending anybody can be asked
    // about. It stops existing and the holder's line goes down by one.
    if (tier === 'counted') {
        return {
            ...base,
            state: 'gone',
            roll,
            ratedAfter: null,
            scars: scarsAlready,
            mendable: false,
            account: `${thing.name} is not there any more. ${base.exposure.cause} `
                + 'There is no row for it and there never was, so nothing is left to ask about: '
                + 'what the holder had was a number, and the number is one lower.'
        };
    }

    const leavesPieces = standsAt >= FRAGMENTS_AT_OR_ABOVE;
    const piecePower = leavesPieces ? shardPower(standsAt) : null;
    return {
        ...base,
        state: leavesPieces ? 'shattered' : 'ruined',
        roll,
        ratedAfter: null,
        scars: scarsAlready,
        mendable: false,
        leavesPieces,
        piecePower,
        account: `${thing.name} did not survive it. ${base.exposure.cause}`
            + (leavesPieces
                ? ` What is left is worth ${piecePower}, which is the ordinary rule for a piece of `
                  + 'anything meeting the one band where a piece is still worth writing down.'
                : ' Nothing is left of it worth carrying away. The record of it stands; '
                  + 'the object does not.')
    };
}

/**
 * It took the blow and is worse for it.
 *
 * The near miss, which used to be nothing at all. A thing that was outclassed
 * far enough to be at risk and came through anyway has still been through
 * something, and the whole of the difference between a possession and a
 * consumable is that the world can say so on the row.
 */
function theMark(
    thing: ThingUnderForce,
    base: Omit<ThingHarmed, 'state' | 'roll' | 'ratedAfter' | 'scars' | 'mendable' | 'account'>,
    roll: number | null,
    scarsAlready: number,
    standsAt: number,
    tier: KeptAs
): ThingHarmed {
    // No row, no scar. A counted carriage that came through is a carriage.
    // No rung, nothing to lose. `shardPower(0)` is 0 either way.
    if (tier === 'counted' || standsAt <= 0) {
        return {
            ...base,
            state: 'held',
            roll,
            ratedAfter: base.ratedBefore,
            scars: scarsAlready,
            mendable: false,
            account: `${thing.name} came through it. ${base.exposure.cause}`
                + (tier === 'counted'
                    ? ' Nothing is written down about it, because nothing about it is written down.'
                    : '')
        };
    }

    const scars = scarsAlready + 1;
    if (scars >= SCARS_BEFORE_THE_QI_GOES) {
        return {
            ...base,
            state: 'inert',
            roll,
            ratedAfter: null,
            scars,
            mendable: false,
            account: `The qi has gone out of ${thing.name}. ${base.exposure.cause} `
                + `It has been holed ${scars} times and mended fewer, and a thing that far under `
                + 'what it was made at stops answering the hand holding it. The object is still '
                + 'there. It is worth nothing.'
        };
    }

    const after = shardPower(standsAt);
    return {
        ...base,
        state: 'holed',
        roll,
        ratedAfter: after,
        scars,
        mendable: true,
        account: `${thing.name} is holed but not finished. ${base.exposure.cause} `
            + `It stood at ${standsAt} and stands at ${after}, which is a rung, which is the only `
            + 'distance anything in this world ever moves. A hand that reaches its rung can put '
            + 'it back.'
    };
}

// ═════════════════════════════════════════════════════════════════════════
// WHAT THE ROW SAYS AFTERWARDS
// ═════════════════════════════════════════════════════════════════════════

/** Holes this row has taken and nobody has closed. Stored, never inferred. */
export function scarsOn(thing: Pick<ThingUnderForce, 'data'>): number {
    const n = Number(thing.data?.scars ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** The rung it was rated at before anything happened to it. */
export function ratedWhole(thing: Pick<ThingUnderForce, 'data' | 'power'>): number | null {
    const n = Number(thing.data?.ratedWhole ?? NaN);
    return Number.isFinite(n) ? n : thing.power;
}

/** Whether the qi has gone out of it. Stored, never inferred - as `isRuined`. */
export function isInert(thing: Pick<ThingUnderForce, 'tags'>): boolean {
    return thing.tags.includes('inert');
}

/**
 * Whether it is carrying a hole somebody could close.
 *
 * The marks accumulate rather than replacing each other, so a thing that was
 * holed twice and then ended still carries `holed`. That is correct on the row
 * - the holes happened, and the chain says when - and it is the wrong answer to
 * this question, which is about what could be mended NOW. So the two later
 * states are excluded here rather than by rewriting history.
 */
export function isHoled(thing: Pick<ThingUnderForce, 'tags' | 'data'>): boolean {
    return thing.tags.includes('holed')
        && scarsOn(thing) > 0
        && !isInert(thing)
        && !thing.tags.includes('ruined');
}

export interface WrittenBack {
    /**
     * The row afterwards, or null where there is no row - a counted thing that
     * stopped existing. The caller decrements its line.
     */
    row: ObjectRecord | null;
    /** Pieces minted, which is almost never. Ordinary objects, one rung down. */
    pieces: ObjectRecord[];
    lines: string[];
}

/**
 * Write what happened onto the thing's own history.
 *
 * Being broken and being mended are events in an object's chain exactly as
 * being stolen is - `items.md`'s *spent is not gone* applies to a hole as much
 * as to an ending, and for the same reason: a house that cannot account for
 * the state of what it holds should have a record that says so.
 *
 * `power` is written down rather than shadowed, deliberately. Every reader of
 * a rating in this engine - `bestObjectHeldBy`, the confrontation, the exposure
 * this file just called - looks at `ObjectRecord.power` and nothing else, so a
 * holed hull is worth less to all of them the moment this returns, with no
 * edit anywhere. What is kept beside it is `ratedWhole`, which is the only
 * thing {@link mend} needs and the only thing that could not be recovered.
 */
export function writeBack(
    object: ObjectRecord,
    harmed: ThingHarmed,
    input: { onDay: number; source: string; note?: string; factId?: string | null }
): WrittenBack {
    switch (harmed.state) {
        case 'held':
            return { row: object, pieces: [], lines: [] };

        case 'gone':
            return {
                row: null,
                pieces: [],
                lines: [`${object.name} is not there any more.`]
            };

        case 'ruined':
            return {
                row: ruin(object, input),
                pieces: [],
                lines: [`${object.name} did not survive it.`]
            };

        case 'shattered': {
            const ended = ruin(object, input);
            return {
                row: ended,
                pieces: shatter(object),
                lines: [`${object.name} came apart, and the pieces are worth writing down.`]
            };
        }

        case 'holed':
        case 'inert': {
            const whole = ratedWhole(object) ?? object.power;
            const tag = harmed.state === 'inert' ? 'inert' : 'holed';
            return {
                row: {
                    ...object,
                    power: harmed.ratedAfter,
                    tags: withTags(object.tags, ['damaged', tag]),
                    data: {
                        ...object.data,
                        scars: harmed.scars,
                        ratedWhole: whole ?? null,
                        lastHoledOnDay: input.onDay
                    },
                    provenance: object.provenance.concat(scarLink(object, harmed, input))
                },
                pieces: [],
                lines: [
                    harmed.state === 'inert'
                        ? `The qi has gone out of ${object.name}.`
                        : `${object.name} is holed.`
                ]
            };
        }
    }
}

/**
 * The link a scar leaves in the chain.
 *
 * The holder does not change, which is the whole difference between this and
 * every other entry: `AcquisitionMode` is about how a thing changed hands and
 * a hole changes nobody's hands. `unknown` is the honest member for "this link
 * is not a handover" and the `note` carries what it actually was, in the
 * engine's own words, so somebody reading the chain in two centuries gets the
 * day, the cause and the rung it dropped to.
 */
function scarLink(
    object: ObjectRecord,
    harmed: ThingHarmed,
    input: { onDay: number; source: string; note?: string; factId?: string | null }
): ProvenanceEntry {
    return {
        onDay: input.onDay,
        holderId: object.possessorId,
        holderName: object.ownerName || 'unknown',
        how: 'unknown',
        source: input.source,
        previousHolderId: object.possessorId,
        previousHolderName: object.ownerName || null,
        factId: input.factId ?? null,
        note: input.note ?? harmed.account
    };
}

function withTags(tags: readonly string[], add: readonly string[]): string[] {
    const out = tags.slice();
    for (const t of add) if (!out.includes(t)) out.push(t);
    return out;
}

// ═════════════════════════════════════════════════════════════════════════
// PUTTING IT BACK
// ═════════════════════════════════════════════════════════════════════════

export interface Mending {
    row: ObjectRecord;
    mended: boolean;
    /** The rung it stands at afterwards. */
    ratedAfter: number | null;
    /** Scars still open. */
    scars: number;
    /** Engine-authored, and it names the bar when the answer is no. */
    account: string;
}

/**
 * Close one hole.
 *
 * ── THE GATE IS THE SAME GATE, AND THERE IS NOT A SECOND RULE ─────────────
 *
 * Mending is working with the thing, so the bar is `canUnmake`: your rung must
 * reach the rung it was made at. That is the same predicate that decides who
 * can refine a grade of medicine and who can break an object, stated in the
 * units artifacts use. A separate "repair rung" would be a third opinion about
 * the ladder and it would drift from the other two.
 *
 * One scar per call and one rung back per scar, bounded by `ratedWhole`.
 * NOTHING EVER GOES ABOVE WHAT IT WAS MADE AT - `items.md`'s *nothing moves up*
 * is enforced here rather than trusted, because a repair that overshoots is the
 * one route by which a grade could climb, and there is no such route.
 *
 * A thing whose qi has gone is not refused out of pessimism. It is refused
 * because it is no longer rated at anything, so there is no rung for the gate
 * to check and nothing for a rung to give back. If a later ruling wants that
 * to be answerable, what it wants is a way to put qi INTO an object, which is
 * a different act with a different price and does not belong in a repair.
 */
export function mend(
    object: ObjectRecord,
    input: { byOrdinal: number; onDay: number; byId: string | null; byName: string; note?: string }
): Mending {
    const scars = scarsOn(object);
    const whole = ratedWhole(object);

    if (isRuined(object)) {
        return refuse(object, scars, `${object.name} ended. There is nothing to mend.`);
    }
    if (isInert(object)) {
        return refuse(object, scars,
            `The qi has gone out of ${object.name}. It is rated at nothing, so there is no rung `
            + 'to give back to it and nothing a hand at any rung can do about that.');
    }
    if (scars === 0 || object.power === null || whole === null) {
        return refuse(object, scars, `${object.name} has nothing open on it.`);
    }

    const reach = canUnmake(input.byOrdinal, whole);
    if (!reach.reaches) {
        return refuse(object, scars,
            `${object.name} was made at ${whole}. ${reach.cause}`);
    }

    const after = Math.min(whole, object.power + 1);
    const left = scars - 1;
    return {
        row: {
            ...object,
            power: after,
            tags: left > 0
                ? object.tags
                : object.tags.filter(t => t !== 'holed' && t !== 'damaged'),
            data: { ...object.data, scars: left, ratedWhole: whole, mendedOnDay: input.onDay },
            provenance: object.provenance.concat({
                onDay: input.onDay,
                holderId: object.possessorId,
                holderName: object.ownerName || 'unknown',
                how: 'unknown',
                source: input.byName,
                previousHolderId: object.possessorId,
                previousHolderName: object.ownerName || null,
                factId: null,
                note: input.note
                    ?? `${input.byName}, standing at ${input.byOrdinal}, closed a hole in it. `
                       + `It stands at ${after} of ${whole}, with ${left} still open.`
            })
        },
        mended: true,
        ratedAfter: after,
        scars: left,
        account: `${object.name} stands at ${after} of the ${whole} it was made at`
            + (left > 0 ? `, with ${left} hole${left === 1 ? '' : 's'} still open.` : ', whole again.')
    };
}

function refuse(object: ObjectRecord, scars: number, why: string): Mending {
    return { row: object, mended: false, ratedAfter: object.power, scars, account: why };
}

// ═════════════════════════════════════════════════════════════════════════
// WHAT IT COST THE PERSON IT BELONGED TO
// ═════════════════════════════════════════════════════════════════════════

/**
 * What losing this was worth to whoever owned it, against what they had.
 *
 * `Deed.cost` in `social-leverage/what-a-deed-leaves.ts` is relative on
 * purpose - *a hundred stones off a beggar and a hundred stones off a house
 * treasury are not the same deed* - and this is that field for a thing rather
 * than for a purse. A house whose only rated possession was the hull answers 1;
 * an apex that owns forty answers almost nothing, and neither of those is a
 * rule about houses.
 *
 * Priced on the combat scale rather than by counting rows, because rungs are
 * not linear: an object at 40 and an object at 20 are not two objects, they are
 * one object and a rounding error, and counting them as two is the arithmetic
 * error that makes an apex's loss look like a peasant's.
 *
 * A hole costs the share of the rung it took, not the whole thing, which is
 * how the same function prices *he holed my boat* and *he broke my boat*
 * without knowing which happened.
 */
export function whatItCostThem(
    lost: { ratedBefore: number | null; ratedAfter: number | null },
    stillHeld: readonly (number | null)[],
    standingOf: (ordinal: number) => number
): number {
    const before = lost.ratedBefore === null ? 0 : standingOf(lost.ratedBefore);
    const after = lost.ratedAfter === null ? 0 : standingOf(lost.ratedAfter);
    const taken = Math.max(0, before - after);
    if (taken <= 0) return 0;
    // The denominator is WHAT THEY HAD, which includes the whole of this thing
    // and not merely the part of it that was taken. Otherwise a hole in the
    // only rated thing a house owns prices identically to losing it outright,
    // and the distinction the state vocabulary exists to carry is thrown away
    // at the last step.
    const rest = stillHeld.reduce<number>(
        (sum, p) => sum + (p === null ? 0 : standingOf(p)), 0
    );
    const had = before + Math.max(0, rest);
    return had <= 0 ? 0 : Math.max(0, Math.min(1, taken / had));
}

/**
 * Whether this is a thing that does not come back.
 *
 * `Deed.irreversible` in one line, and it is exactly the question this file
 * already answered: a hole can be closed and an ending cannot. Nothing here
 * decides whether anybody WILL mend it - that is a person with a want, and
 * `how-many-of-the-broken-are-ever-mended.ts` is the world's own answer about
 * how rarely anybody does.
 */
export function doesNotComeBack(state: ThingState): boolean {
    return state === 'ruined' || state === 'shattered' || state === 'gone' || state === 'inert';
}

/**
 * The words for what happened, for a ledger entry somebody reads in a century.
 *
 * Not a branch on the cause and not a branch on the thing: it reads the state,
 * which is the only thing that varies, and drops the caller's own `cause`
 * straight in beside it.
 */
export function describeTheLoss(harmed: ThingHarmed, thingName: string, cause: string): string {
    const who = harmed.byName === '' ? 'Something' : harmed.byName;
    switch (harmed.state) {
        case 'held': return `${thingName} came through ${cause} unmarked.`;
        case 'holed': return `${who} holed ${thingName}, in ${cause}. It can be put back.`;
        case 'inert': return `${who} put the last of the qi out of ${thingName}, in ${cause}.`;
        case 'ruined': return `${who} ended ${thingName}, in ${cause}.`;
        case 'shattered': return `${who} broke ${thingName} apart, in ${cause}, and the pieces are worth having.`;
        case 'gone': return `${thingName} did not come out of ${cause}.`;
    }
}

// Re-exported so a caller reading this file's answers does not have to reach
// into the cultivation layer for the two thresholds the answers are built on.
export { CERTAIN_ABOVE_REALMS, FIT_WITHIN_REALMS, FRAGMENTS_AT_OR_ABOVE };
