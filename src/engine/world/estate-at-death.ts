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
 *
 * ── AND WHAT COMES OFF IS MARKED BY WHERE THE BODY FELL ──────────────────
 *
 * The second half of the module, and the reason it is here rather than beside
 * manuals: a thing's condition is decided where somebody died, and this is
 * already the one place that knows what was on the body and where the body is.
 * See {@link howAPlaceMarksWhatComesOffABody}.
 */

import type { DeathCause } from '../../schema/cultivation.js';
import { contiguousRun } from '../cultivation/acquisition.js';
import { forStream } from '../cultivation/rng.js';
import type { LocationRecord } from './locations.js';
import { ratedWhole } from './object-damage.js';
import {
    makeObject,
    ruin,
    shardPower,
    transferPossession,
    type ObjectKind,
    type ObjectRecord,
    type ObjectSignificance,
    type ProvenanceEntry
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
// WHAT THE PLACE DOES TO WHAT IT IS GIVEN
// ─────────────────────────────────────────────────────────────────────────

/** Where they fell, as much of it as a settlement needs to know. */
export interface WhereTheyFell {
    id: string;
    name: string;
    /** `LocationEnvironment.danger`, 0..1. The world's own figure, unscaled. */
    danger: number;
}

/** The place as a settlement reads it, so no caller retypes `environment.danger`. */
export function whereTheyFell(
    location: Pick<LocationRecord, 'id' | 'name' | 'environment'> | null | undefined
): WhereTheyFell | null {
    if (!location) return null;
    return { id: location.id, name: location.name, danger: location.environment.danger };
}

/** What state a thing was in when it came off the body. */
export type ConditionAtDeath = 'unchanged' | 'damaged' | 'ruined';

/**
 * The share of an ordered work that has to survive from the beginning for what
 * is left to be worth carrying at all.
 *
 * Damaged and ruined are not two kinds of loss. They are one measurement either
 * side of this line: a work whose surviving run from the beginning is at least
 * this share of it is a real book somebody would carry, capped lower; anything
 * under it is routed to `ruin`. A book missing its opening is not a damaged
 * book, it is a dead one, and `contiguousRun` already says so by returning
 * zero - the player-facing category agrees with the arithmetic rather than
 * offering somebody a row that looks salvageable and is not.
 *
 * A quarter is chosen so that the interesting outcome is the common one: of
 * everything a place marks, three parts in four survive as something readable.
 */
export const NOTHING_USABLE_BELOW = 0.25;

/** How often a place leaves a thing in each of the three states. */
export interface MarkWeights {
    unchanged: number;
    damaged: number;
    ruined: number;
}

/**
 * What a place does to what comes off a body in it.
 *
 * ONE MAPPING, exported, and the only place danger becomes a probability.
 *
 * A place marks what comes off a body exactly as often as its own `danger`
 * says - the field already means "how likely the place is to hurt somebody who
 * belongs here", and a corpse belongs to a place more completely than anybody
 * living does, so it is read straight rather than through a curve nobody could
 * justify. What it marks then splits on {@link NOTHING_USABLE_BELOW}.
 *
 * "Died in a sect, passed down unchanged" is not a branch anywhere. A righteous
 * house's ground is 0.1 in `architecture.ts`, so nine deaths in ten inside one
 * leave everything whole, and the tenth is the story. Worked ground in
 * `how-the-world-keeps-finding-more-ruins.ts` reaches 0.8, where two things in
 * ten come out untouched and six of the remaining eight come out readable and
 * short - which is the inheritance the genre actually runs on.
 *
 * ONE THING NARROWS THE DAMAGED BAND IN PRACTICE. A thing with no rung and no
 * ordered parts cannot be worth less than whole, so for it the damaged band
 * reads as unchanged - which is `theMark`'s existing ruling in
 * `object-damage.ts` (no rung, nothing to lose) rather than a second answer to
 * it. The ruined band still reaches it: a token can stop existing.
 */
export function howAPlaceMarksWhatComesOffABody(danger: number): MarkWeights {
    const marked = Math.min(1, Math.max(0, danger));
    return {
        unchanged: 1 - marked,
        damaged: marked * (1 - NOTHING_USABLE_BELOW),
        ruined: marked * NOTHING_USABLE_BELOW
    };
}

/**
 * The cause a mark at death writes into the chain.
 *
 * Exported rather than spelled out at each site because the destruction and
 * gossip layer reads causes back off the chain, and a cause that names a place
 * is what makes one repeatable. Import it; never retype the sentence.
 */
export function whatThePlaceDidToIt(placeName: string): string {
    return `${OFF_A_BODY_IN} ${placeName}`;
}

const OFF_A_BODY_IN = 'taken off a body in';

/**
 * The same read backwards: whether a place marked this row, and which place.
 *
 * Forward is "what does a mark say"; backward is "was this thing marked, and
 * where". The backward half is the one anything downstream actually asks -
 * a war wanting to know whether it broke a thing or the ground did, a house
 * wanting to know why its property came back short - and without it every
 * caller would match the sentence itself, which is four copies of a format
 * string waiting to drift.
 */
export function whereTheGroundGotIt(
    object: Pick<ObjectRecord, 'provenance'>
): string | null {
    for (let i = object.provenance.length - 1; i >= 0; i--) {
        const source = object.provenance[i].source;
        if (source.startsWith(`${OFF_A_BODY_IN} `)) return source.slice(OFF_A_BODY_IN.length + 1);
    }
    return null;
}

/** What the place did to one row. One entry per tracked thing, in input order. */
export interface MarkAtDeath {
    itemId: string;
    condition: ConditionAtDeath;
    /**
     * For a part of an ordered work, what became of the WORK. A part inside the
     * surviving head is itself `unchanged` while the work is `damaged`, and
     * that distinction is the whole of the tail rule.
     */
    theWork: ConditionAtDeath | null;
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
    /**
     * The ordered ids of every part of the work this row is one of, or null
     * where it stands alone. `CappedManual.volumes` is exactly this list.
     *
     * It is what makes the tail rule possible: a place takes the END off a work
     * rather than a part at random, so the caller has to say what the order IS.
     * Without it a row is a single thing and loses a rung instead.
     */
    partOfWork?: readonly string[] | null;
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
    /**
     * The world's id for where the goods END UP.
     *
     * Not the same fact as {@link EstateInput.fell}, and the difference is
     * load-bearing rather than an oversight: the player path settles onto a
     * grave row that `enshrineRun` creates as a CHILD of the death site, with
     * its own danger figure standing for how hard the grave is to rob. What
     * marked the goods is the ground the body hit.
     */
    locationId: string | null;
    /**
     * Where the body fell, and how bad the ground there is.
     *
     * Null where the world is not running or cannot name the place, and then
     * nothing is marked - a settlement with no world behind it has no danger
     * figure and must not invent one.
     */
    fell?: WhereTheyFell | null;
    /**
     * The world seed, for the one draw this makes.
     *
     * Its own stream, keyed on the dead and on the work, so nothing else's
     * draws move and so two bodies in one place do not share a roll. Absent
     * means no draw happens at all and everything comes off whole.
     */
    seed?: string;
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
    /** What the place did to each tracked row, in the order they were passed. */
    marks: MarkAtDeath[];
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

    const marks = whatThePlaceLeft(input);
    const objects: ObjectRecord[] = [];
    for (const [at, thing] of input.tracked.entries()) {
        objects.push(moveOneThing(thing, input, destination, taker, marks[at].condition));
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
        marks,
        structure:
            `${input.dead.name} (${input.dead.id}) died on world day ${input.onDay}: ${input.causeNote} `
            + `${counted.spiritStones} stone(s) and ${counted.stock.length} counted stack(s) went `
            + `${destination}${taker ? ` with ${taker.name} (${taker.id})` : ''}. `
            + `${objects.length} tracked row(s) moved`
            + (objects.length > 0 ? `: ${objects.map(o => o.id).join(', ')}` : '')
            + `. ${input.standingOver.length} person(s) were standing over the body.`
            + (marks.some(m => m.condition !== 'unchanged' || m.theWork === 'damaged')
                ? ` ${input.fell?.name ?? 'the ground'} marked what came off: `
                    + marks.map(m => `${m.itemId} ${m.condition}`
                        + (m.theWork === 'damaged' ? ' (the work lost its end)' : '')).join(', ')
                    + '.'
                : '')
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROLL, AT DEATH
// ─────────────────────────────────────────────────────────────────────────

/**
 * What state the place left each thing in.
 *
 * ── IT IS ROLLED HERE AND STORED, NOT ROLLED WHEN SOMEBODY FINDS IT ──────
 *
 * Two people who dig up the same book have to be holding the same book. Rolling
 * a condition at discovery gives them two, and no read anywhere could tell
 * which was true, so the condition is settled at the moment of death and lives
 * on the row from then on.
 *
 * ── ONE DRAW PER WORK, NOT PER ROW ───────────────────────────────────────
 *
 * A work carried in three volumes is one thing that one place did one thing to.
 * Drawing per row would let the same corpse yield a first and third volume and
 * no second, which is precisely the hole-in-the-middle result the tail rule
 * exists to prevent. So the stream is keyed on the WORK where there is one and
 * on the row where there is not, and a body carrying more or fewer other things
 * does not move any of it.
 */
function whatThePlaceLeft(input: EstateInput): MarkAtDeath[] {
    const danger = input.fell?.danger ?? 0;
    const unmarked = (): MarkAtDeath[] =>
        input.tracked.map(t => ({ itemId: t.itemId, condition: 'unchanged', theWork: null }));

    if (!input.seed || danger <= 0) return unmarked();

    // Null is "the place did not touch it". Otherwise it is the share of the
    // thing that survived, and one work drawn once however many parts of it
    // were on the body - see the note above.
    const drawn = new Map<string, number | null>();
    const shareThatSurvived = (thing: TrackedThing): number | null => {
        const key = thing.partOfWork?.join('|') ?? thing.itemId;
        if (!drawn.has(key)) {
            const rng = forStream(input.seed!, 'what-a-place-leaves-on-a-body', input.dead.id, key);
            drawn.set(key, rng.next() < danger ? rng.next() : null);
        }
        return drawn.get(key)!;
    };

    return input.tracked.map(thing => {
        const share = shareThatSurvived(thing);
        const parts = thing.partOfWork ?? null;
        const whole: MarkAtDeath = { itemId: thing.itemId, condition: 'unchanged', theWork: null };
        if (share === null) return whole;

        // ONE COMPARISON, and it decides both categories for both kinds of
        // thing. Below the line nothing worth carrying is left, which includes
        // every way of losing the opening of a work: `contiguousRun` would
        // return zero for those anyway, so the category agrees with the
        // arithmetic instead of offering a row that looks salvageable.
        if (share < NOTHING_USABLE_BELOW) {
            return { itemId: thing.itemId, condition: 'ruined', theWork: parts ? 'ruined' : null };
        }

        // PAGES COME OFF THE END. The head survives and the tail is gone, so
        // what a later holder has is an unbroken run from the beginning, which
        // is the only shape `contiguousRun` can measure and `effectiveCapOf`
        // can price. At least one part survives by definition: that is what
        // being above the line MEANS.
        if (parts) {
            const kept = parts.slice(0, Math.max(1, Math.floor(share * parts.length)));
            const survived = contiguousRun(parts, new Set(kept)) > parts.indexOf(thing.itemId);
            return {
                itemId: thing.itemId,
                condition: survived ? 'unchanged' : 'ruined',
                theWork: 'damaged'
            };
        }

        // NO RUNG, NOTHING TO LOSE - which is `theMark`'s own ruling in
        // `object-damage.ts` for exactly this case, not a second answer to it.
        // A token or a key that came through a bad place came through it.
        const stands = thing.worldRow?.power ?? thing.power;
        return stands === null || stands <= 0
            ? whole
            : { itemId: thing.itemId, condition: 'damaged', theWork: null };
    });
}

/**
 * The mark a place leaves on a rated thing: one rung, and a line in the chain.
 *
 * `shardPower` and nothing else, because it is this repo's single statement of
 * what a thing is worth when it is not whole, and a second arithmetic here
 * would be a second answer to that question. `ratedWhole` is read rather than
 * assumed so that a thing already holed by `object-damage.ts` records what it
 * stood at when it was new, not what it stood at last week.
 *
 * Deliberately NOT holed: a hole is something a hand at the right rung can
 * close, and what a bad place does to a thing left lying on a corpse is not.
 */
function markedByThePlace(object: ObjectRecord, input: EstateInput): ObjectRecord {
    const whole = ratedWhole(object) ?? object.power;
    const link: ProvenanceEntry = {
        onDay: input.onDay,
        holderId: input.dead.id,
        holderName: input.dead.name,
        how: 'unknown',
        source: whatThePlaceDidToIt(input.fell?.name ?? 'nowhere anybody named'),
        previousHolderId: object.possessorId,
        previousHolderName: object.possessorId ? object.ownerName || null : null,
        factId: null,
        note: 'It was on a body for as long as it was, in the sort of place it was in.'
    };
    return {
        ...object,
        power: shardPower(object.power),
        tags: object.tags.includes('damaged') ? object.tags : object.tags.concat('damaged'),
        data: { ...object.data, ratedWhole: whole ?? null },
        provenance: object.provenance.concat(link)
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
    taker: NamedParty | null,
    condition: ConditionAtDeath
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

    // Link two: what the place did to it. Before it moves, because it happened
    // before anybody picked it up - and a thing nothing usable is left of never
    // reaches link three at all, whoever was standing there.
    if (destination === 'gone with the body') {
        return ruin(onTheBody, {
            onDay: input.onDay,
            source: `the death of ${input.dead.name}`,
            note: input.causeNote
        });
    }
    if (condition === 'ruined') {
        return ruin(onTheBody, {
            onDay: input.onDay,
            source: whatThePlaceDidToIt(input.fell?.name ?? 'nowhere anybody named'),
            note: input.causeNote
        });
    }
    const marked = condition === 'damaged' ? markedByThePlace(onTheBody, input) : onTheBody;

    // Link three: where it went.
    if (taker) {
        // `looted` and not `inherited`. Nobody left this to anybody: somebody
        // went through a body. Ownership deliberately does NOT move, which is
        // `transferPossession`'s own default and the reason it has one - the
        // dead cultivator's house can still say whose it was.
        const took = transferPossession(marked, {
            onDay: input.onDay,
            toHolderId: taker.id,
            toHolderName: taker.name,
            how: 'looted',
            source: `off the body of ${input.dead.name}`,
            note: input.causeNote
        });
        return { ...took, locationId: null };
    }

    const left = transferPossession(marked, {
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
