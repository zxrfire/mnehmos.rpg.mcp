/**
 * Whether a thing survives what was put through it, and what state it is left in.
 *
 * Durability here is DAMAGE, never wear (the owner: *"not the usage kind, the
 * partial damage kind"*). A force past what a thing is made for holes it, and
 * far enough past breaks it. A hole takes a rung off `power` and stays until
 * `mend` closes it. A break keeps the thing, at the rung it was made at,
 * working at `BROKEN_THING_WORKS_AT` of what it did: owner ruling 2026-09-25,
 * nothing is destroyed by a break. The forces that reach it in play: a fight's
 * swings (`whatAFightMarked`, from a war, a bout and the player's own fight)
 * and a war year's force on a ward it got past
 * (`what-a-year-of-war-does-to-a-compound.ts`).
 */

import {
    BROKEN_THING_WORKS_AT,
    canUnmake,
    weaponExposure,
    whatItStillDoes,
    type WeaponExposure
} from '../cultivation/whether-a-weapon-survives-being-used.js';
import { combatPowerForOrdinal } from '../cultivation/combat.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';
import {
    isRuined,
    keptAs,
    shardPower,
    type KeptAs,
    type ObjectRecord,
    type ObjectSignificance,
    type ProvenanceEntry
} from './possessions.js';

// ═════════════════════════════════════════════════════════════════════════
// TUNING
// ═════════════════════════════════════════════════════════════════════════

/**
 * How many holes a thing takes before the last one breaks it.
 */
export const SCARS_BEFORE_IT_BREAKS = 3;

/**
 * Where a thing with no rating stands on the ladder.
 */
export const UNRATED_STANDS_AT = 0;

/** The tag a broken thing carries. Stored, never inferred. */
const BROKEN_TAG = 'broken';

/** `BROKEN_THING_WORKS_AT` as a sheet says it. */
const WORKS_AT_SAID = BROKEN_THING_WORKS_AT === 0.5
    ? 'half'
    : `${Math.round(BROKEN_THING_WORKS_AT * 100)} in a hundred`;

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
    /** Scars, the `ruined` mark and the `broken` mark all live here. */
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
    /** Nothing happened to it: the gate refused, it was fit for this, or the draw missed. */
    | 'held'
    /** Worth a rung less, carrying a dated scar, and mendable. */
    | 'holed'
    /** Still there, still rated what it was made at, working at half. */
    | 'broken';

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
    /** The rung it stands at coming out. A broken thing stands at what it was made at. */
    ratedAfter: number | null;
    /** Scars it carries now, this one included. */
    scars: number;
    /** Whether a hand at the right rung could put it back. */
    mendable: boolean;
    byId: string | null;
    byName: string;
    /** Engine-authored. Names the thing, the cause, and what would have held. */
    account: string;
}

type Base = Omit<ThingHarmed, 'state' | 'roll' | 'ratedAfter' | 'scars' | 'mendable' | 'account'>;

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

    // A broken thing is at the floor and nothing takes it lower; a ruined row
    // was used up and is not there to be struck.
    const spent = isRuined(thing as unknown as ObjectRecord) || isBroken(thing);

    const base: Base = {
        exposure,
        keptAs: tier,
        ratedBefore,
        byId: force.byId,
        byName: force.byName
    };
    const unmarked = (roll: number | null, account: string): ThingHarmed => ({
        ...base,
        state: 'held',
        roll,
        ratedAfter: ratedBefore,
        scars: scarsAlready,
        mendable: scarsAlready > 0 && !spent,
        account
    });

    if (spent || exposure.chance <= 0) {
        return unmarked(null, spent
            ? `${thing.name} is already broken. ${exposure.cause}`
            : `${thing.name}: ${exposure.cause}`);
    }

    let roll: number | null = null;
    if (exposure.chance < 1) {
        // Preview. Nothing is drawn and nothing is decided.
        if (rng === null) return unmarked(null, `${thing.name}: ${exposure.cause} Nothing has been resolved.`);
        roll = rng.next();
        if (roll >= exposure.chance) return unmarked(roll, `${thing.name} came through it. ${exposure.cause}`);
    }

    if (exposure.breaksOutright) return theBreak(thing, base, roll, scarsAlready);
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
    holed: boolean;
}

/** A thing a fight put at risk that came out of it, and who was carrying it. */
interface AMarkAFightLeft {
    carrierId: string;
    /** Whose body it was swung into. */
    metById: string;
    swing: ASwingsAnswer;
}

/**
 * The things a fight holed without breaking. The combat resolver already drew
 * for them, so this draws nothing.
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
        if (!swing || !swing.holed) continue;
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
 * `objects` is the world's own table. A thing with no row is passed over.
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
    swing: Pick<ASwingsAnswer, 'exposure' | 'roll' | 'broke' | 'holed'>,
    by: { byId: string | null; byName: string }
): ThingHarmed {
    const tier = keptAs(thing.significance);
    const scarsAlready = scarsOn(thing);
    const base: Base = {
        exposure: swing.exposure,
        keptAs: tier,
        ratedBefore: thing.power,
        byId: by.byId,
        byName: by.byName
    };
    const spent = isRuined(thing as unknown as ObjectRecord) || isBroken(thing);
    if (spent || swing.broke || !swing.holed) {
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
 * It broke. It stays where it is, at the rung it was made at, and works at half.
 */
function theBreak(
    thing: ThingUnderForce,
    base: Base,
    roll: number | null,
    scars: number
): ThingHarmed {
    const madeAt = ratedWhole(thing);
    return {
        ...base,
        state: 'broken',
        roll,
        ratedAfter: madeAt,
        scars,
        mendable: false,
        account: `${thing.name} is broken. ${base.exposure.cause} It is still rated `
            + `${madeAt ?? 'nothing'} and works at ${WORKS_AT_SAID}.`
    };
}

/**
 * It took the blow and is worse for it.
 */
function theMark(
    thing: ThingUnderForce,
    base: Base,
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
        };
    }

    const scars = scarsAlready + 1;
    if (scars >= SCARS_BEFORE_IT_BREAKS) return theBreak(thing, base, roll, scars);

    const after = shardPower(standsAt);
    return {
        ...base,
        state: 'holed',
        roll,
        ratedAfter: after,
        scars,
        mendable: true,
        account: `${thing.name} is holed. ${base.exposure.cause} It stood at ${standsAt} and `
            + `stands at ${after}. A hand at its rung can close the hole.`
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

/** Whether it is broken. Stored, never inferred - as `isRuined`. */
export function isBroken(thing: Pick<ThingUnderForce, 'tags'>): boolean {
    return thing.tags.includes(BROKEN_TAG);
}

/**
 * Whether it is carrying a hole somebody could close.
 */
export function isHoled(thing: Pick<ThingUnderForce, 'tags' | 'data'>): boolean {
    return thing.tags.includes('holed')
        && scarsOn(thing) > 0
        && !isBroken(thing)
        && !thing.tags.includes('ruined');
}

/**
 * Rungs the open holes have taken off it: what it was made at, less what it
 * stands at. Zero for a whole thing.
 */
export function rungsTheHolesTake(thing: Pick<ThingUnderForce, 'tags' | 'data' | 'power'>): number {
    if (!isHoled(thing)) return 0;
    const whole = ratedWhole(thing);
    return whole === null || thing.power === null ? 0 : Math.max(0, whole - thing.power);
}

/** The highest rung worth no more than `worth` on the combat scale. */
function theRungWorth(worth: number): number {
    let rung = 0;
    while (rung < MAX_ORDINAL && combatPowerForOrdinal(rung + 1) <= worth + 1e-9) rung++;
    return rung;
}

/**
 * The rung a thing standing at `standsAt` and made at `madeAt` works at, for a
 * reader that answers in rungs (a ward, a hull): the same arithmetic a fight
 * prices a blade by (`whatItStillDoes`), read back onto the ladder.
 */
export function theRungItWorksAt(standsAt: number, madeAt: number, broken: boolean): number {
    const worth = whatItStillDoes({ power: standsAt, madeAt, broken }, combatPowerForOrdinal);
    return broken ? theRungWorth(worth) : Math.max(standsAt, theRungWorth(worth));
}

/** A row as a fight carries it: its rung, what it was made at, and whether it is broken. */
export function asCarried(row: Pick<ObjectRecord, 'id' | 'name' | 'power' | 'tags' | 'data'>): {
    id: string; name: string; power: number; madeAt?: number; broken?: boolean;
} {
    const power = row.power ?? 0;
    const whole = ratedWhole(row) ?? power;
    return {
        id: row.id,
        name: row.name,
        power,
        ...(whole !== power ? { madeAt: whole } : {}),
        ...(isBroken(row) ? { broken: true } : {})
    };
}

/**
 * The condition a thing is in, as somebody holding it can see it. Null for a
 * whole thing, which says nothing.
 */
export function theConditionItIsIn(
    thing: Pick<ThingUnderForce, 'tags' | 'data' | 'power'>
): string | null {
    if (thing.tags.includes('ruined')) return null;
    if (isBroken(thing)) return `broken, works at ${WORKS_AT_SAID}`;
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
    row: ObjectRecord;
    lines: string[];
}

/**
 * Break a row. It stays with whoever has it, at the rung it was made at, and a
 * link in its chain says when and by what.
 */
export function breakIt(
    object: ObjectRecord,
    input: { onDay: number; source: string; note?: string; factId?: string | null; scars?: number }
): ObjectRecord {
    const whole = ratedWhole(object);
    return {
        ...object,
        power: whole,
        tags: withTags(object.tags.filter(t => t !== 'holed'), ['damaged', BROKEN_TAG]),
        data: {
            ...object.data,
            scars: input.scars ?? scarsOn(object),
            ratedWhole: whole ?? null,
            brokenOnDay: input.onDay
        },
        provenance: object.provenance.concat(scarLink(object, input,
            `${object.name} broke. It works at ${WORKS_AT_SAID}.`))
    };
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
            return { row: object, lines: [] };

        case 'broken':
            return {
                row: breakIt(object, { ...input, note: input.note ?? harmed.account, scars: harmed.scars }),
                lines: [`${object.name} is broken, and works at ${WORKS_AT_SAID}.`]
            };

        case 'holed': {
            const whole = ratedWhole(object) ?? object.power;
            return {
                row: {
                    ...object,
                    power: harmed.ratedAfter,
                    tags: withTags(object.tags, ['damaged', 'holed']),
                    data: {
                        ...object.data,
                        scars: harmed.scars,
                        ratedWhole: whole ?? null,
                        lastHoledOnDay: input.onDay
                    },
                    provenance: object.provenance.concat(scarLink(object, input, harmed.account))
                },
                lines: [`${object.name} is holed.`]
            };
        }
    }
}

/**
 * The link a scar or a break leaves in the chain.
 */
function scarLink(
    object: ObjectRecord,
    input: { onDay: number; source: string; note?: string; factId?: string | null },
    account: string
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
        note: input.note ?? account
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
 * Close one hole: the rung gate and the write. The material it takes is the
 * caller's to spend.
 */
export function mend(
    object: ObjectRecord,
    input: { byOrdinal: number; onDay: number; byId: string | null; byName: string; note?: string }
): Mending {
    const scars = scarsOn(object);
    const whole = ratedWhole(object);

    if (isRuined(object)) {
        return refuse(object, scars, `${object.name} was used up. There is nothing to mend.`);
    }
    if (isBroken(object)) {
        return refuse(object, scars,
            `${object.name} is broken. A hole can be closed and a break cannot; it works at `
            + `${WORKS_AT_SAID}.`);
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
// THE RECORD
// ═════════════════════════════════════════════════════════════════════════

/**
 * The words for what happened, for a ledger entry somebody reads in a century.
 */
export function describeTheLoss(harmed: ThingHarmed, thingName: string, cause: string): string {
    const who = harmed.byName === '' ? 'Something' : harmed.byName;
    switch (harmed.state) {
        case 'held': return `${thingName} came through ${cause} unmarked.`;
        case 'holed': return `${who} holed ${thingName}, in ${cause}. It can be put back.`;
        case 'broken': return `${who} broke ${thingName}, in ${cause}. It works at ${WORKS_AT_SAID}.`;
    }
}
