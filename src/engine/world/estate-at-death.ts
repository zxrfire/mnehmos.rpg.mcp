/**
 * What comes off a body, and where it goes.
 *
 * A death is a transfer event. Somebody was carrying things a moment ago and is
 * not carrying them now, and the only question the world has to answer is who
 * has them instead - which is the question `transferPossession` already exists
 * to record. Nothing here is an inheritance system: there are no wills, no
 * heirs and no contested estates, because a body on the ground does not have
 * any of those. It has whatever was in its pouch and whoever is standing over
 * it.
 *
 * ── THE TWO TIERS GO TO DIFFERENT PLACES, AND THAT IS THE WHOLE DESIGN ───
 *
 * `docs/world/things/items.md` draws the line and this module is one of the
 * places it decides something:
 *
 *   COUNTED  stones, pills, herbs. A number on a holder. It has no identity and
 *            no past, so there is nothing to record about THIS bowl of pills -
 *            only that some are now in the ground here, or that whoever went
 *            through the body has them. It goes into the ground as a cache at
 *            the place they fell, which is a row the digging verb already
 *            reads.
 *
 *   TRACKED  a rated object. One row, one identity, one chain. Its next line is
 *            who has it now, and the dead cultivator's name is in that line
 *            forever. This is the half that makes a sect able to recognise its
 *            own property on somebody else's belt three centuries later.
 *
 * ── A GRAVE NEVER REFUSES YOU ────────────────────────────────────────────
 *
 * `docs/world/things/economy.md` rules on what a grave is, against an
 * inheritance: involuntary, holding whatever they happened to be carrying,
 * protected only by whatever settled or grew up around it since, and
 * indifferent to who turns up. Nothing here gates anything. What stands between
 * a later cultivator and the goods is the hazard the cache route already
 * applies - somebody else may have got there first - and nothing else.
 *
 * ── IT AGREES WITH `war-spoils.ts` ABOUT WHAT A LINK LOOKS LIKE ─────────
 *
 * Both paths write `how: 'looted'` with a source, a note and the day, which is
 * the same link. They differ on ONE field and the difference is the field's
 * whole reason for existing:
 *
 *   a war        `transfersOwnership: true`. A house that lost a war does not
 *                still own what it lost, and conquest is a `ClaimBasis` the
 *                world recognises.
 *   a body       `transfersOwnership: false`, which is `transferPossession`'s
 *                own default and its own stated rule for a taking. Going
 *                through somebody's pockets does not confer title, and leaving
 *                ownership where it was is what gives the dead cultivator's
 *                house standing to want the thing back.
 *
 * So they are not two conventions. They are one convention, parameterised, and
 * anything reading a chain can tell a conquest from a robbery without knowing
 * which module wrote the link.
 *
 * ── WHO GETS IT IS NOT ADJUDICATED HERE ──────────────────────────────────
 *
 * Where several people are standing over the body, the first of them takes it,
 * and "first" means the order the caller passed. That is not a ruling about
 * force or seniority: `possessions.ts` says outright that it does not decide
 * who wins a dispute, and this does not either. The caller knows who was there;
 * if the order should mean something, that is a decision for the layer that
 * builds the list.
 *
 * WHO COUNTS AS STANDING OVER SOMEBODY is the ruling that matters, and it is
 * {@link somebodyDidThis}. Read it before passing a list.
 */

import type { DeathCause } from '../../schema/cultivation.js';
import {
    makeObject,
    ruin,
    transferPossession,
    type ObjectKind,
    type ObjectRecord,
    type ObjectSignificance
} from './possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// WHO IS STANDING OVER SOMEBODY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether somebody was doing this to them.
 *
 * ── WHY THIS IS NOT "IS ANYBODY HERE" ────────────────────────────────────
 *
 * It was, and it was wrong, and playing said so within one run. `present`
 * means AT THE SAME NAMED PLACE, and a named place is a market town or a
 * stretch of wild ground rather than a body's length of dirt. Measured on a
 * seeded world: seven people at one stretch of wilds, four at another, four in
 * the birth town, and nothing anywhere with nobody in it that a life could
 * also be spent in. So "somebody is here" is true essentially always, every
 * death was a robbery, and nothing was ever left in the ground.
 *
 * Which contradicts the setting outright. `docs/world/history/the-late-age.md`
 * and `legacy.ts`'s own header rest on the world being full of what other
 * people's failed runs left where they fell; a world where a bystander two
 * streets away empties every corpse has no graves in it.
 *
 * So the ground is the default and being taken is the exception, and the thing
 * that makes it an exception is that SOMEBODY WAS DOING IT TO THEM. A person
 * who kills you is standing over you by definition. A person who happened to
 * be in the same town when you starved in an alley is not, whatever
 * `othersPresent` says, and the engine has no business pretending they went
 * through your pockets.
 *
 * ── AND IT IS ONE CAUSE, NOT A LIST THAT WILL GROW ───────────────────────
 *
 * Every other way to die in this game is something that happened to a body:
 * hunger, a lifespan running out, a rung that would not come, a channel that
 * turned, lightning. Nobody is over you for any of them. If a future cause
 * genuinely involves another party, it belongs here - and it should be added
 * because of what the cause IS, never because a test wanted a looter.
 */
export function somebodyDidThis(cause: DeathCause): boolean {
    return cause === 'combat_defeat';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT WAS ON THE BODY
// ─────────────────────────────────────────────────────────────────────────

/** A counted stack, as the pouch holds it. No identity, no history. */
export interface StockStack {
    itemId: string;
    kind: 'pill' | 'herb';
    quantity: number;
}

/** Stones and stock. Everything the world stores as a number on a holder. */
export interface CountedGoods {
    spiritStones: number;
    stock: StockStack[];
}

/**
 * A rated object on the body, and the world's row for it where one exists.
 *
 * `worldRow` is the object as the world already holds it. Passing it is what
 * makes a death move the ONE object rather than mint a second copy of a
 * singular thing - the mistake `possessions.ts` calls the parallel-catalog
 * error. Null means the world has no row and one is created.
 */
export interface TrackedThing {
    /** Catalog id, which is also the world row's id where there is one. */
    itemId: string;
    name: string;
    kind: ObjectKind;
    significance: ObjectSignificance;
    power: number | null;
    description?: string;
    worldRow?: ObjectRecord | null;
}

/** Somebody the world can name. The dead, and whoever is standing over them. */
export interface NamedParty {
    id: string;
    name: string;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SETTLEMENT
// ─────────────────────────────────────────────────────────────────────────

/** Where what was on the body ended up. One word, for the record. */
export type EstateDestination = 'taken' | 'in the ground' | 'gone with the body';

export interface EstateInput {
    dead: NamedParty;
    /** World day. The chain is dated on the clock that runs between lives. */
    onDay: number;
    /** The world's id for where they fell, when it has one. */
    locationId: string | null;
    counted: CountedGoods;
    tracked: readonly TrackedThing[];
    /** People close enough to go through the body. Order is the caller's. */
    standingOver: readonly NamedParty[];
    /** How it ended, in the engine's words. Goes on the chain as the source. */
    causeNote: string;
    /**
     * Whether there is a body at all.
     *
     * A failed crossing at the top of the ladder leaves a scar and nothing to
     * search. False means the counted goods are simply gone and the tracked
     * rows are ruined in place - kept, because `possessions.ts` is explicit
     * that a thing which vanishes cleanly from the record is a thing nobody
     * can ever be asked about.
     */
    leavesBody?: boolean;
}

export interface EstateAtDeath {
    destination: EstateDestination;
    /** Who went through the body, where anybody did. */
    taker: NamedParty | null;
    /**
     * Counted goods to put in the ground where they fell, or null.
     *
     * Null where somebody took them and null where there was no body. Never an
     * empty bundle: a hole with nothing in it is not worth a row.
     */
    buried: CountedGoods | null;
    /** Counted goods a living person walked off with. */
    taken: CountedGoods | null;
    /** Every tracked row this death moved, in its post-death state. */
    objects: ObjectRecord[];
    /** The mechanical line. Never narrated. */
    structure: string;
}

function countedIsEmpty(goods: CountedGoods): boolean {
    return goods.spiritStones <= 0 && goods.stock.every(s => s.quantity <= 0);
}

/** Only what is really there. A stack of zero is not a thing on a body. */
function tidy(goods: CountedGoods): CountedGoods {
    return {
        spiritStones: Math.max(0, Math.floor(goods.spiritStones)),
        stock: goods.stock.filter(s => s.quantity > 0).map(s => ({ ...s, quantity: Math.floor(s.quantity) }))
    };
}

/**
 * The id a tracked thing gets when the world had no row for it.
 *
 * Keyed on the dead cultivator as well as the catalog entry, because two
 * cultivators dying holding the same kind of thing are two objects and the
 * world has to be able to tell them apart. Where the world DID have a row, this
 * is never reached and the object keeps the identity it already had.
 */
export function estateObjectId(deadId: string, itemId: string): string {
    return `obj-estate-${deadId}-${itemId}`;
}

/**
 * Settle what was on a body.
 *
 * Pure: it reads its input, mints or moves object rows, and returns them. The
 * caller does the writing - the world row, the cache in the ground, and taking
 * it off the corpse.
 */
export function settleEstate(input: EstateInput): EstateAtDeath {
    const leavesBody = input.leavesBody ?? true;
    const counted = tidy(input.counted);
    const taker = leavesBody ? input.standingOver[0] ?? null : null;

    const destination: EstateDestination = !leavesBody
        ? 'gone with the body'
        : taker
            ? 'taken'
            : 'in the ground';

    const objects: ObjectRecord[] = [];
    for (const thing of input.tracked) {
        objects.push(moveOneThing(thing, input, destination, taker));
    }

    const anythingCounted = !countedIsEmpty(counted);
    const buried = destination === 'in the ground' && anythingCounted ? counted : null;
    const taken = destination === 'taken' && anythingCounted ? counted : null;

    return {
        destination,
        taker,
        buried,
        taken,
        objects,
        structure:
            `${input.dead.name} (${input.dead.id}) died on world day ${input.onDay}: ${input.causeNote} `
            + `${counted.spiritStones} stone(s) and ${counted.stock.length} counted stack(s) went `
            + `${destination}${taker ? ` with ${taker.name} (${taker.id})` : ''}. `
            + `${objects.length} tracked row(s) moved`
            + (objects.length > 0 ? `: ${objects.map(o => o.id).join(', ')}` : '')
            + `. ${input.standingOver.length} person(s) were standing over the body.`
    };
}

/**
 * One tracked object's next line in its own chain.
 *
 * Two links go on, not one, and the first is the point of the whole module: it
 * says the object was on this person when they died. Without it, a thing that
 * passed through somebody's hands at the moment of their death reads as having
 * been picked up out of nowhere, and the dead cultivator - the only party with
 * a story attached - is not in the chain at all.
 */
function moveOneThing(
    thing: TrackedThing,
    input: EstateInput,
    destination: EstateDestination,
    taker: NamedParty | null
): ObjectRecord {
    const base = thing.worldRow ?? makeObject({
        id: estateObjectId(input.dead.id, thing.itemId),
        name: thing.name,
        kind: thing.kind,
        significance: thing.significance,
        power: thing.power,
        description: thing.description ?? ''
    });

    // Link one: it was on them. Ownership moves with it, because a thing
    // somebody was carrying at their death is a thing the world will treat as
    // having been theirs - and where it was not, the party who says otherwise
    // has a claim, which `assertClaim` is for and this is not.
    const onTheBody = transferPossession(base, {
        onDay: input.onDay,
        toHolderId: input.dead.id,
        toHolderName: input.dead.name,
        how: 'found',
        source: `carried by ${input.dead.name}`,
        note: 'On the body at the moment of death.',
        transfersOwnership: true
    });

    // Link two: where it went.
    if (destination === 'gone with the body') {
        return ruin(onTheBody, {
            onDay: input.onDay,
            source: `the death of ${input.dead.name}`,
            note: input.causeNote
        });
    }

    if (taker) {
        // `looted` and not `inherited`. Nobody left this to anybody: somebody
        // went through a body. Ownership deliberately does NOT move, which is
        // `transferPossession`'s own default and the reason it has one - the
        // dead cultivator's house can still say whose it was.
        const took = transferPossession(onTheBody, {
            onDay: input.onDay,
            toHolderId: taker.id,
            toHolderName: taker.name,
            how: 'looted',
            source: `off the body of ${input.dead.name}`,
            note: input.causeNote
        });
        return { ...took, locationId: null };
    }

    const left = transferPossession(onTheBody, {
        onDay: input.onDay,
        toHolderId: null,
        toHolderName: 'nobody',
        how: 'lost',
        source: `the grave of ${input.dead.name}`,
        note: 'Nobody was there. It went into the ground with them.'
    });
    return { ...left, locationId: input.locationId };
}

/**
 * Whether this death put anything anywhere a later life could reach.
 *
 * The one predicate worth having: a settlement that moved nothing is a death
 * that left nothing, and the caller should say so rather than reporting a
 * grave with an empty hole under it.
 */
export function leftSomething(estate: EstateAtDeath): boolean {
    return estate.buried !== null || estate.taken !== null || estate.objects.length > 0;
}
