/**
 * Possession, ownership, claim, and where things came from.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// PROVENANCE
// ─────────────────────────────────────────────────────────────────────────

/** How a thing changed hands. `stolen` and `looted` are stored, not inferred. */
export type AcquisitionMode =
    | 'found'
    | 'inherited'
    | 'bought'
    | 'sold'
    | 'stolen'
    | 'looted'
    | 'gifted'
    /**
     * Handed over, and not handed away.
     *
     * The design owner: *"there does need a distinction between borrowing and
     * stealing."* Without this row there was none. A house furnace in a
     * disciple's hands and a house furnace somebody walked off with are the
     * same two fields - `ownerId` a house, `possessorId` a person - and the
     * only thing that could ever tell them apart is whether the house handed
     * it over. That is a fact about an EVENT, so it belongs on the chain of
     * events rather than on the object.
     *
     * Distinct from `gifted` and `awarded`, which MOVE the ownership. A lent
     * thing is still the house's, which is the whole point of it.
     */
    | 'lent'
    | 'crafted'
    | 'awarded'
    | 'confiscated'
    | 'lost'
    | 'unknown';

export interface ProvenanceEntry {
    /** Absolute day this link in the chain happened. */
    onDay: number;
    /** Who held it after this. Null when it went into the ground or was lost. */
    holderId: string | null;
    holderName: string;
    how: AcquisitionMode;
    /** Where it came from: a place, a person, a mine, a grave. Free text. */
    source: string;
    /** Who held it before, when anyone knows. Null is the common case. */
    previousHolderId: string | null;
    previousHolderName: string | null;
    /** Ledger fact id, when the transfer is on the historical record. */
    factId: string | null;
    note: string;
}

// CLAIMS

/** On what grounds a right is asserted. Several may be valid at once. */
export type ClaimBasis =
    | 'ancestral'
    | 'purchase'
    | 'conquest'
    | 'gift'
    | 'sect_property'
    | 'finder'
    | 'debt'
    | 'oath'
    | 'theft_recovery';

export interface OwnershipClaim {
    id: string;
    claimantId: string;
    claimantName: string;
    basis: ClaimBasis;
    assertedOnDay: number;
    /**
     * How good the claim is, 0..1, as a stored judgement rather than a computed
     * one. A weak claim loudly asserted and a strong claim nobody has heard is
     * a real and common shape, so strength and publicity are separate fields.
     */
    strength: number;
    /** Parties who accept it. A claim nobody acknowledges is still a claim. */
    acknowledgedByIds: string[];
    /** Ledger facts supporting it. What an investigation turns up. */
    evidenceFactIds: string[];
    note: string;
    /** Withdrawn or settled. Kept, never deleted: old claims resurface. */
    active: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// OBJECTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * A GRADE IS WHAT A MATERIAL IS. AN ORDINAL IS WHAT A FINISHED THING STANDS AT.
 *
 * They are two different measurements and neither converts into the other.
 *
 * A GRADE - mortal, earth, heaven, immortal, chaos - says what the stuff is. It
 * cannot say what a thing made out of it is worth, because that depends on the
 * hand that worked it: the same heaven-grade ore is a heaven-grade sword in one
 * pair of hands and scrap in another, and `who-can-refine-a-grade-of-medicine.ts`
 * is the table that decides which. So a material carries a grade and no ordinal.
 *
 * AN ORDINAL is one rung on the ladder people are measured on, and it is what a
 * FINISHED artifact carries. A finished thing has already had a maker's hand
 * applied to it, so "how strong is this sword" has exactly one answer, and
 * `combat.ts` prices it as a body of that rank standing beside its holder.
 *
 * Two consequences, both of which have been broken here:
 *
 *   AN ORDINAL ON A MATERIAL is a claim the world cannot make. What a lot of ore
 *   becomes is not known until somebody works it.
 *   NULL ON A FINISHED ARTIFACT is a defect, not a statement that the thing is
 *   harmless. Measured in a seeded world: 91 of 235 artifacts carried none, all
 *   of them departure talismans, priced null because they are no use in a fight
 *   - which is a different question from what rung the thing is. A row with no
 *   ordinal reads as an unfinished thing to everything that looks at it.
 *
 * Null is still the right answer for a great many rows, and each for a reason
 * this rule already gives: a material has a grade instead; a pill, a coin and a
 * manual are not finished artifacts; and a ruined or spent thing no longer
 * stands anywhere - see `ruin` and `shardPower`.
 */
export type ObjectKind =
    | 'artifact'
    | 'manual'
    | 'pill'
    | 'material'
    | 'currency'
    | 'token'
    | 'key'
    | 'corpse'
    | 'territory'
    /**
     * A made thing that stands where it was made, and is never carried.
     */
    | 'formation'
    | 'other';

/**
 * How much bookkeeping a thing deserves.
 */
export type ObjectSignificance = 'mundane' | 'notable' | 'significant' | 'legendary';

/** A holder and a number, or a row with a history. The one line in `items.md`. */
export type KeptAs = 'counted' | 'tracked';

/**
 * Which of the two stored tiers a thing is in.
 */
export function keptAs(significance: ObjectSignificance): KeptAs {
    return significance === 'mundane' ? 'counted' : 'tracked';
}

/**
 * HOW MUCH A THING OF THIS GRADE IS WORTH BOOKKEEPING.
 *
 * A grade is a fact about the STUFF, so this reads the grade and nothing else.
 * What a finished thing made from it stands at is the other measurement and is
 * not derivable from here - see the rule above `ObjectKind`.
 *
 * The design owner, on the shape the rule should have: *"the pill logic (esp
 * the immortal pill logic) should fall out of its IMPORTANCE."*
 *
 * So it falls out, here, once, for every noun in the world. A pill, a manual, a
 * cauldron, a sword and a lot of ore are all objects, they are all graded on
 * one five-step ladder, and how much of a record each deserves is a function of
 * that grade and of nothing else. There is no pill rule, no manual rule and no
 * cauldron rule, and the moment there is one of those the other twelve nouns
 * start needing theirs.
 *
 * WHY THE TOP TWO ARE NOT A BAND BUT A FACT. Immortal and chaos are the grades
 * nothing below the Lid makes - `who-can-refine-a-grade-of-medicine.ts` decides
 * that, off the realm a hand has to stand in to work the materials at all - so
 * every one of them down here came down or came out of something sealed. There
 * is a finite number in the world and no process that adds another. A thing
 * like that is never a stack with a quantity on it; asking whose it was and
 * where it has been is the ONLY interesting question about it, and `legendary`
 * is how this file says a row must be able to answer that.
 */
/**
 * Whether a thing of this grade is an AMOUNT or a ROW WITH A HISTORY.
 *
 * `items.md` derives this line from production and not from taste: a grade the
 * standing population can restock is a quantity, a grade it cannot is a thing
 * whose provenance is the only interesting question about it. Measured on a
 * world of 587 living cultivators - 587 can work mortal, 89 can work earth, 30
 * can work heaven, and nobody at all above that.
 *
 * The design owner, on a commissioned talisman: *"depends on the level of
 * talisman. a commissioned talisman is counted if its not heaven rank."* Which
 * is this line exactly, said about a different noun - and it is one line for
 * every noun on purpose. `hunting-a-spirit-beast.ts` asked it about a beast
 * material and answered it privately; there is no beast rule and no talisman
 * rule, and the moment there is one of those the other twelve nouns start
 * needing theirs.
 */
export function howAGradeIsStored(grade: TechniqueGrade): 'counted' | 'tracked' {
    return grade === 'mortal' || grade === 'earth' ? 'counted' : 'tracked';
}

export function howMuchAGradeIsWorthTracking(grade: TechniqueGrade): ObjectSignificance {
    switch (grade) {
        // Roadside. You buy another one and nobody writes it down.
        case 'mortal':
            return 'mundane';
        // Made by somebody, for somebody, and both are answerable.
        case 'earth':
            return 'notable';
        case 'heaven':
            return 'significant';
        case 'immortal':
        case 'chaos':
            return 'legendary';
    }
}

/**
 * Whether this is a thing somebody raises in a fight.
 *
 * Stated as what it is NOT, because the list of things that are weapons is
 * open and the list of things that are certainly not is short and knowable.
 */
export function isSomethingYouWouldSwing(object: {
    tags: readonly string[];
    kind: string;
}): boolean {
    // A CARRIAGE IS NOT A WEAPON, and neither is a boat.
    if (object.tags.includes('conveyance')) return false;
    // A THING BURNED ONCE IS NOT A WEAPON SLOT. It is used and it is gone,
    // which is a different move from carrying it into every exchange.
    if (object.tags.includes('single-use') || object.tags.includes('talisman')) return false;
    // AND A THING THAT STANDS WHERE IT WAS MADE is never in anybody's hands.
    if (object.kind === 'formation' || object.kind === 'territory') return false;
    return true;
}

/** Whether this row carries a provenance anybody can be asked about. */
export function isTracked(object: Pick<ObjectRecord, 'significance'>): boolean {
    return keptAs(object.significance) === 'tracked';
}

export interface ObjectRecord {
    id: string;
    name: string;
    kind: ObjectKind;
    significance: ObjectSignificance;
    description: string;

    /** Who is physically holding it. Null when it is in the ground or lost. */
    possessorId: string | null;
    /**
     * Whose it actually is, as the world would judge it. Null is a real answer
     * and often the correct one: nobody's, or nobody living, or unresolved.
     */
    ownerId: string | null;
    ownerName: string;

    claims: OwnershipClaim[];
    provenance: ProvenanceEntry[];

    /**
     * Who knows anything about where this came from.
     */
    knownOwnershipBy: string[];

    /**
     * WHAT IT STANDS AT: one rung on the ladder a person is measured on.
     *
     * The name says power and the field is an ordinal - `combat.ts` reads it as
     * `ratedOrdinal` and hands it to `combatPowerForOrdinal`, and `object-damage.ts`
     * calls it `standsAt`, which is the repo's word for this. Renaming it is
     * pending on `src/web/turn-engine.ts` being free to edit.
     *
     * Required on a finished artifact. Null where the thing has a grade instead,
     * is not a finished artifact, or has been ruined or spent. See the
     * grade-and-ordinal rule above `ObjectKind`.
     */
    power: number | null;

    /**
     * HOW MUCH ROOM IT TAKES AND WHAT IT WEIGHS.
     *
     * The design owner: *"objects have volume and weight"*, *"how much you can
     * carry is limited by volume and weight by cultivation level."*
     *
     * Litres and kilograms, on every object in the world, because the two bind
     * differently and a single "encumbrance" number would hide the interesting
     * half: a purse of spirit stones is heavy and small, a bundle of dried
     * herbs is light and enormous, and which of them stops you is a different
     * problem with a different answer. See
     * `what-a-body-can-carry-and-what-a-ring-holds.ts`.
     *
     * Defaulted rather than optional, so nothing anywhere has to handle an
     * object that does not take up space. A row nobody has measured is a small
     * carried thing, which is what the overwhelming majority of them are.
     */
    volume: number;
    weight: number;

    /** Where it currently is, when it is not on a person. */
    locationId: string | null;
    tags: string[];
    data: Record<string, string | number | boolean | null>;
    nextClaimSeq: number;
}

/**
 * What is left of a broken object.
 */
export function shardPower(power: number | null): number | null {
    if (power === null) return null;
    return Math.max(0, power - 1);
}

/**
 * Break an object into pieces, as ordinary records.
 */
export function shatter(object: ObjectRecord, pieces = 2): ObjectRecord[] {
    return Array.from({ length: Math.max(2, pieces) }, (_, i) => makeObject({
        ...object,
        id: `${object.id}-shard-${i + 1}`,
        name: `A piece of ${object.name}`,
        power: shardPower(object.power),
        significance: object.significance === 'legendary' ? 'significant' : object.significance,
        possessorId: null,
        claims: [],
        tags: [...object.tags.filter(t => t !== 'never-carried'), 'shard', `from:${object.id}`]
    }));
}

/**
 * End an object without leaving anything to pick up.
 */
export function ruin(
    object: ObjectRecord,
    input: { onDay: number; source: string; note?: string; factId?: string | null }
): ObjectRecord {
    const entry: ProvenanceEntry = {
        onDay: input.onDay,
        holderId: null,
        holderName: 'nobody',
        how: 'lost',
        source: input.source,
        previousHolderId: object.possessorId,
        previousHolderName: object.possessorId ? currentHolderName(object) : null,
        factId: input.factId ?? null,
        note: input.note ?? ''
    };
    return {
        ...object,
        possessorId: null,
        locationId: null,
        power: null,
        tags: object.tags.includes('ruined') ? object.tags : object.tags.concat('ruined'),
        provenance: object.provenance.concat(entry)
    };
}

/** Whether this row is a thing that used to exist. Stored, never inferred. */
export function isRuined(object: ObjectRecord): boolean {
    return object.tags.includes('ruined');
}

export function makeObject(
    init: Partial<ObjectRecord> & Pick<ObjectRecord, 'id' | 'name' | 'kind'>
): ObjectRecord {
    return {
        significance: 'notable',
        description: '',
        power: null,
        possessorId: null,
        ownerId: null,
        ownerName: '',
        claims: [],
        provenance: [],
        knownOwnershipBy: [],
        // A thing somebody carries in one hand. The commonest object in the
        // world, and the right default for a row nobody has measured.
        volume: WHAT_A_CARRIED_THING_TAKES,
        weight: WHAT_A_CARRIED_THING_WEIGHS,
        locationId: null,
        tags: [],
        data: {},
        nextClaimSeq: 1,
        ...init
    };
}

/** Litres a thing takes up when nobody has said. A sword, a book, a jar. */
export const WHAT_A_CARRIED_THING_TAKES = 2;

/** Kilos the same thing weighs. */
export const WHAT_A_CARRIED_THING_WEIGHS = 1.5;

/**
 * A lot of a fungible resource with a story attached.
 */
export function makeResourceLot(init: {
    id: string;
    resource: string;
    quantity: number;
    source: string;
    acquiredOnDay: number;
    holderId: string | null;
    holderName?: string;
    how?: AcquisitionMode;
    previousHolderName?: string | null;
    significance?: ObjectSignificance;
}): ObjectRecord {
    const record = makeObject({
        id: init.id,
        name: `${init.quantity} ${init.resource}`,
        kind: 'currency',
        significance: init.significance ?? 'notable',
        possessorId: init.holderId,
        data: { resource: init.resource, quantity: init.quantity }
    });
    record.provenance.push({
        onDay: init.acquiredOnDay,
        holderId: init.holderId,
        holderName: init.holderName ?? init.holderId ?? 'nobody',
        how: init.how ?? 'found',
        source: init.source,
        previousHolderId: null,
        previousHolderName: init.previousHolderName ?? null,
        factId: null,
        note: ''
    });
    return record;
}

// ─────────────────────────────────────────────────────────────────────────
// TRANSFERS
// ─────────────────────────────────────────────────────────────────────────

export interface TransferInput {
    onDay: number;
    toHolderId: string | null;
    toHolderName: string;
    how: AcquisitionMode;
    source?: string;
    factId?: string | null;
    note?: string;
    /**
     * Move legal ownership as well. False by default, which is the entire
     * point: taking a thing does not make it yours.
     */
    transfersOwnership?: boolean;
}

/**
 * Move a thing.
 */
export function transferPossession(object: ObjectRecord, input: TransferInput): ObjectRecord {
    const entry: ProvenanceEntry = {
        onDay: input.onDay,
        holderId: input.toHolderId,
        holderName: input.toHolderName,
        how: input.how,
        source: input.source ?? '',
        previousHolderId: object.possessorId,
        previousHolderName: object.possessorId ? currentHolderName(object) : null,
        factId: input.factId ?? null,
        note: input.note ?? ''
    };
    return {
        ...object,
        possessorId: input.toHolderId,
        ownerId: input.transfersOwnership ? input.toHolderId : object.ownerId,
        ownerName: input.transfersOwnership ? input.toHolderName : object.ownerName,
        provenance: object.provenance.concat(entry)
    };
}

/** Set who it actually belongs to, without moving it. */
export function setOwnership(
    object: ObjectRecord,
    ownerId: string | null,
    ownerName = ''
): ObjectRecord {
    return { ...object, ownerId, ownerName };
}

export interface ClaimInput {
    claimantId: string;
    claimantName: string;
    basis: ClaimBasis;
    assertedOnDay: number;
    strength?: number;
    evidenceFactIds?: string[];
    note?: string;
}

/**
 * Somebody asserts a right.
 */
export function assertClaim(object: ObjectRecord, input: ClaimInput): ObjectRecord {
    const existing = object.claims.findIndex(
        c => c.claimantId === input.claimantId && c.basis === input.basis
    );
    const claim: OwnershipClaim = {
        id: `${object.id}-cl${object.nextClaimSeq}`,
        claimantId: input.claimantId,
        claimantName: input.claimantName,
        basis: input.basis,
        assertedOnDay: input.assertedOnDay,
        strength: clamp01(input.strength ?? 0.5),
        acknowledgedByIds: [],
        evidenceFactIds: input.evidenceFactIds ?? [],
        note: input.note ?? '',
        active: true
    };
    if (existing >= 0) {
        const claims = object.claims.slice();
        claims[existing] = { ...claims[existing], ...claim, id: claims[existing].id, active: true };
        return { ...object, claims };
    }
    return {
        ...object,
        claims: object.claims.concat(claim),
        nextClaimSeq: object.nextClaimSeq + 1
    };
}

export function withdrawClaim(object: ObjectRecord, claimId: string): ObjectRecord {
    return {
        ...object,
        claims: object.claims.map(c => (c.id === claimId ? { ...c, active: false } : c))
    };
}

export function acknowledgeClaim(
    object: ObjectRecord,
    claimId: string,
    byId: string
): ObjectRecord {
    return {
        ...object,
        claims: object.claims.map(c =>
            c.id === claimId && !c.acknowledgedByIds.includes(byId)
                ? { ...c, acknowledgedByIds: c.acknowledgedByIds.concat(byId).sort() }
                : c
        )
    };
}

/** Somebody learned where this came from. The fourth layer, written to. */
export function revealOwnership(object: ObjectRecord, knowerId: string): ObjectRecord {
    if (object.knownOwnershipBy.includes(knowerId)) return object;
    return { ...object, knownOwnershipBy: object.knownOwnershipBy.concat(knowerId).sort() };
}

// ─────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────

export function currentHolderName(object: ObjectRecord): string {
    for (let i = object.provenance.length - 1; i >= 0; i--) {
        if (object.provenance[i].holderId === object.possessorId) return object.provenance[i].holderName;
    }
    return object.possessorId ?? 'nobody';
}

export function activeClaims(object: ObjectRecord): OwnershipClaim[] {
    return object.claims
        .filter(c => c.active)
        .sort((a, b) => b.strength - a.strength || a.assertedOnDay - b.assertedOnDay || (a.id < b.id ? -1 : 1));
}

/**
 * Two or more live claims, or a holder who is not the owner.
 *
 * Reports the situation. Does not resolve it: who wins is a matter of force,
 * politics and evidence, none of which are this module's business.
 */
export function isDisputed(object: ObjectRecord): boolean {
    if (activeClaims(object).length > 1) return true;
    return object.ownerId !== null && object.possessorId !== null && object.ownerId !== object.possessorId;
}

/** Whether the chain contains a taking. Stored, never guessed. */
export function isStolen(object: ObjectRecord): boolean {
    return object.provenance.some(p => p.how === 'stolen' || p.how === 'looted');
}

/** The last taking in the chain, for an investigation to start from. */
export function lastTheft(object: ObjectRecord): ProvenanceEntry | null {
    for (let i = object.provenance.length - 1; i >= 0; i--) {
        const p = object.provenance[i];
        if (p.how === 'stolen' || p.how === 'looted') return p;
    }
    return null;
}

/** Whether this party could recognise the thing for what it is. */
export function knowsOwnership(object: ObjectRecord, partyId: string): boolean {
    return object.knownOwnershipBy.includes(partyId);
}

/** How long the current holder has had it. "Three hundred years" is an argument. */
export function heldForYears(object: ObjectRecord, onDay: number): number {
    for (let i = object.provenance.length - 1; i >= 0; i--) {
        if (object.provenance[i].holderId === object.possessorId) {
            return Math.floor((onDay - object.provenance[i].onDay) / DAYS_PER_YEAR);
        }
    }
    return 0;
}

export interface ObjectQuery {
    kinds?: readonly ObjectKind[];
    possessorId?: string;
    ownerId?: string;
    claimantId?: string;
    locationId?: string;
    minSignificance?: ObjectSignificance;
    stolenOnly?: boolean;
    disputedOnly?: boolean;
    tags?: readonly string[];
    limit?: number;
}

const SIGNIFICANCE_ORDER: Record<ObjectSignificance, number> = {
    mundane: 0,
    notable: 1,
    significant: 2,
    legendary: 3
};

export function queryObjects(
    objects: readonly ObjectRecord[],
    q: ObjectQuery = {}
): ObjectRecord[] {
    const kinds = q.kinds ? new Set(q.kinds) : null;
    const minSig = q.minSignificance ? SIGNIFICANCE_ORDER[q.minSignificance] : -1;
    const rows = objects.filter(o => {
        if (kinds && !kinds.has(o.kind)) return false;
        if (q.possessorId && o.possessorId !== q.possessorId) return false;
        if (q.ownerId && o.ownerId !== q.ownerId) return false;
        if (q.locationId && o.locationId !== q.locationId) return false;
        if (minSig >= 0 && SIGNIFICANCE_ORDER[o.significance] < minSig) return false;
        if (q.claimantId && !o.claims.some(c => c.active && c.claimantId === q.claimantId)) return false;
        if (q.stolenOnly && !isStolen(o)) return false;
        if (q.disputedOnly && !isDisputed(o)) return false;
        if (q.tags && !q.tags.every(t => o.tags.includes(t))) return false;
        return true;
    });
    rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return q.limit != null ? rows.slice(0, q.limit) : rows;
}

/**
 * A compact account of an object's four layers.
 *
 * Written for a prompt: it states possession, ownership, every live claim, and
 * who knows any of it, with no attempt to reconcile them.
 */
export function describeObject(object: ObjectRecord, onDay: number): string {
    const parts: string[] = [`${object.name}.`];
    parts.push(
        object.possessorId
            ? `Held by ${currentHolderName(object)} for ${heldForYears(object, onDay)} years.`
            : `Held by nobody.`
    );
    parts.push(
        object.ownerId
            ? `Owned by ${object.ownerName || object.ownerId}.`
            : `Ownership unresolved.`
    );
    const claims = activeClaims(object);
    if (claims.length > 0) {
        parts.push(
            `${claims.length} standing claim${claims.length === 1 ? '' : 's'}: ` +
            claims.map(c => `${c.claimantName} (${c.basis})`).join(', ') + '.'
        );
    }
    if (isStolen(object)) {
        const theft = lastTheft(object);
        parts.push(`It was taken from ${theft?.previousHolderName ?? 'somebody'} in year ${Math.floor((theft?.onDay ?? 0) / DAYS_PER_YEAR)}.`);
    }
    parts.push(
        object.knownOwnershipBy.length === 0
            ? `Nobody can say where it came from.`
            : `${object.knownOwnershipBy.length} part${object.knownOwnershipBy.length === 1 ? 'y knows' : 'ies know'} where it came from.`
    );
    return parts.join(' ');
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
