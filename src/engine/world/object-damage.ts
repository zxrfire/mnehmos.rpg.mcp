/**
 * Whether a thing survives what was put through it, and what state it is left in.
 *
 * Durability here is DAMAGE, never wear (the owner: *"not the usage kind, the
 * partial damage kind"*). A force past what a thing is made for ends it or
 * holes it; a hole takes a rung off `power` and stays until `mend` closes it.
 * The forces that reach it in play: a fight's swings (`whatAFightMarked`, from
 * a war, a bout and the player's own fight) and a war year's force on a ward
 * it got past (`what-a-year-of-war-does-to-a-compound.ts`).
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

// ═════════════════════════════════════════════════════════════════════════
// WHAT A FIGHT LEFT ON WHAT CAME THROUGH IT
// ═════════════════════════════════════════════════════════════════════════

/**
 * One swing's answer, as the combat resolver hands it back: the same exposure
 * this file prices, and the sample that decided it.
 */
interface ASwingsAnswer {
    objectId: string;
    objectName: string;
    exposure: WeaponExposure;
    roll: number | null;
    broke: boolean;
}

/** A thing a fight put at risk that came out of it, and who was carrying it. */
interface AMarkAFightLeft {
    carrierId: string;
    /** Whose body it was swung into. */
    metById: string;
    swing: ASwingsAnswer;
}

/**
 * The things a fight marked without ending.
 *
 * A swing was rolled for only where the thing was outclassed past what it is
 * made for and short of certain, and a roll it came through is the case
 * {@link whatBecomesOfIt} answers `holed`. The resolver already drew that roll,
 * so this draws nothing.
 *
 * ONE MARK A FIGHT, not one a swing. Durability here is damage, not wear: a
 * fight is the force, and a blade that came through three exchanges against a
 * body too hard for it came through one fight too hard for it. A thing that
 * broke in the fight is the breaking's and is not here.
 */
export function whatAFightMarked(
    exchanges: readonly {
        attackerId: string;
        defenderId: string;
        result: { weapon: ASwingsAnswer | null };
    }[]
): AMarkAFightLeft[] {
    const broke = new Set<string>();
    for (const exchange of exchanges) {
        if (exchange.result.weapon?.broke) broke.add(exchange.result.weapon.objectId);
    }
    const marked = new Map<string, AMarkAFightLeft>();
    for (const exchange of exchanges) {
        const swing = exchange.result.weapon;
        if (!swing || swing.broke || swing.roll === null) continue;
        if (broke.has(swing.objectId) || marked.has(swing.objectId)) continue;
        marked.set(swing.objectId, {
            carrierId: exchange.attackerId,
            metById: exchange.defenderId,
            swing
        });
    }
    return [...marked.values()];
}

/**
 * Write what a fight left on the rows it reached, in place.
 *
 * `objects` is the world's own table. A thing with no row is a counted thing,
 * which carries no scar (see `theMark`), and is passed over.
 */
export function writeBackWhatAFightLeft(
    objects: ObjectRecord[],
    marks: readonly AMarkAFightLeft[],
    input: {
        onDay: number;
        /** The fight, in the words its caller uses for it. */
        fight: string;
        nameOf: (personId: string) => string;
    }
): { objectId: string; carrierId: string; state: ThingState; line: string }[] {
    const out: { objectId: string; carrierId: string; state: ThingState; line: string }[] = [];
    for (const mark of marks) {
        const at = objects.findIndex(o => o.id === mark.swing.objectId);
        if (at < 0) continue;
        const row = objects[at]!;
        const harmed = whatComingThroughLeft(row, mark.swing, {
            byId: mark.metById,
            byName: input.nameOf(mark.metById)
        });
        if (harmed.state === 'held') continue;
        const written = writeBack(row, harmed, {
            onDay: input.onDay,
            source: input.fight,
            note: describeTheLoss(harmed, row.name, input.fight)
        });
        if (written.row === null) continue;
        objects[at] = written.row;
        out.push({
            objectId: row.id,
            carrierId: mark.carrierId,
            state: harmed.state,
            line: written.lines[0] ?? ''
        });
    }
    return out;
}

/**
 * What coming through a swing left on the thing, off the answer already drawn.
 *
 * The same `theMark` a fresh force reaches, so a hole put in a blade in a
 * fight and a hole put in a hull by anything else are one state.
 */
function whatComingThroughLeft(
    thing: ThingUnderForce,
    swing: Pick<ASwingsAnswer, 'exposure' | 'roll' | 'broke'>,
    by: { byId: string | null; byName: string }
): ThingHarmed {
    const tier = keptAs(thing.significance);
    const scarsAlready = scarsOn(thing);
    const base = {
        exposure: swing.exposure,
        keptAs: tier,
        ratedBefore: thing.power,
        ownerId: null as string | null,
        ownerName: '',
        byId: by.byId,
        byName: by.byName,
        leavesPieces: false,
        piecePower: null as number | null
    };
    const spent = isRuined(thing as unknown as ObjectRecord) || isInert(thing);
    if (spent || swing.broke || swing.roll === null) {
        return {
            ...base,
            state: 'held',
            roll: swing.roll,
            ratedAfter: thing.power,
            scars: scarsAlready,
            mendable: scarsAlready > 0 && !spent,
            account: `${thing.name}: ${swing.exposure.cause}`
        };
    }
    return theMark(thing, base, swing.roll, scarsAlready, thing.power ?? UNRATED_STANDS_AT, tier);
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

/**
 * Rungs the open holes have taken off it: what it was made at, less what it
 * stands at. Zero for a whole thing. Every read that prices a thing off
 * `power` already pays this; a read that prices it off what it was MADE at
 * (a ward's answering rung) subtracts it here.
 */
export function rungsTheHolesTake(thing: Pick<ThingUnderForce, 'tags' | 'data' | 'power'>): number {
    if (!isHoled(thing)) return 0;
    const whole = ratedWhole(thing);
    return whole === null || thing.power === null ? 0 : Math.max(0, whole - thing.power);
}

/**
 * The condition a thing is in, as somebody holding it can see it. Null for a
 * whole thing, which says nothing.
 *
 * What a hole costs is the rung: a holed blade prices as a blade a rung lower
 * in a fight, a holed hull shelters against one rung less, a holed ward
 * answers a rung lower. Stated as the rung, because that is the one quantity
 * all of those read.
 */
export function theConditionItIsIn(
    thing: Pick<ThingUnderForce, 'tags' | 'data' | 'power'>
): string | null {
    if (thing.tags.includes('ruined')) return null;
    if (isInert(thing)) return 'the qi has gone out of it, and it is rated at nothing';
    if (!isHoled(thing)) return null;
    const scars = scarsOn(thing);
    const whole = ratedWhole(thing);
    return `holed ${scars === 1 ? 'once' : scars === 2 ? 'twice' : `${scars} times`}`
        + (whole !== null && thing.power !== null
            ? `, standing at ${thing.power} of the ${whole} it was made at; a hand at ${whole} or `
              + 'above can close a hole'
            : '');
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
