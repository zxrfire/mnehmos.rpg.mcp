/**
 * Whether a thing survives what was put through it, and what state it is left in.
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
 */
export const SCARS_BEFORE_THE_QI_GOES = 3;

/**
 * Where a thing with no rating stands on the ladder.
 */
export const UNRATED_STANDS_AT = 0;

// ═════════════════════════════════════════════════════════════════════════
// WHAT GOES IN
// ═════════════════════════════════════════════════════════════════════════

/**
 * Everything this resolver may see about a thing.
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
 */
export interface ForceApplied {
    /** The whole composite standing of it, on the combat scale. */
    standing: number;
    /**
     * The same thing's rung and body line ALONE, with nothing it brought.
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
 */
export function doesNotComeBack(state: ThingState): boolean {
    return state === 'ruined' || state === 'shattered' || state === 'gone' || state === 'inert';
}

/**
 * The words for what happened, for a ledger entry somebody reads in a century.
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
