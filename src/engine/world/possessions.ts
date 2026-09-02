/**
 * Possession, ownership, claim, and where things came from.
 *
 * Four things are kept separable on anything that matters:
 *
 *   possession              who is physically holding it
 *   ownership               whose it actually is
 *   claim                   who asserts a right to it
 *   knowledge of ownership  who knows any of the above
 *
 * A player who finds an ancient artifact POSSESSES it. An extinct clan's
 * surviving descendant may hold a legitimate ancestral CLAIM. Neither may KNOW
 * about the other. That gap is a situation, and situations are what this engine
 * exists to produce. Collapsing the four into one `ownerId` field deletes every
 * one of them.
 *
 * ── Provenance ───────────────────────────────────────────────────────────
 *
 * Significant things carry where they came from - not every spirit stone
 * forever, but anything worth arguing about:
 *
 *   108 spirit stones   source: an abandoned mine    found: day 180
 *                       previous owner: unknown
 *
 *   an old sword        source: a dead cultivator    acquired: inheritance
 *                       previous owner: named, and remembered by their sect
 *
 * One append-only chain per object. It is what makes stolen goods, disputed
 * inheritances, faction claims, investigations and century-old consequences
 * possible without a separate system for each of them, and it is why a sect can
 * recognise its own missing artifact three hundred years later.
 *
 * ── What this module is not ──────────────────────────────────────────────
 *
 * It does not adjudicate. `isDisputed` reports that two parties assert rights;
 * it does not decide who is correct, and there is deliberately no function that
 * does. Who wins a dispute is a matter of force, politics and evidence, all of
 * which live elsewhere.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';

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

// ─────────────────────────────────────────────────────────────────────────
// CLAIMS
// ─────────────────────────────────────────────────────────────────────────

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
    | 'other';

/**
 * How much bookkeeping a thing deserves.
 *
 * `mundane` things do not get provenance at all, which is the point of the
 * field: the world does not track where every spirit stone came from, and
 * pretending otherwise makes the table useless and the queries slow.
 */
export type ObjectSignificance = 'mundane' | 'notable' | 'significant' | 'legendary';

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
     *
     * The fourth layer, and the one that makes the other three interesting. A
     * player holding a stolen artifact nobody can identify is in a completely
     * different situation from one holding an artifact the owning sect can name
     * on sight.
     */
    knownOwnershipBy: string[];

    /**
     * What it is worth in a fight, on the same ladder a person is measured on,
     * or null for the great majority of things that are not worth anything in
     * one.
     *
     * A generic field on a generic record, and deliberately so. A notched sabre
     * and an object an ascended founder sent back down are the same kind of row
     * with different numbers in this column - there is no separate table for
     * important artifacts, no tier that behaves differently, and nothing
     * anywhere that treats one holder's object as a special case. Whoever is
     * carrying it gets the number, and the resolver that reads it for a hired
     * sword is the resolver that reads it for the strongest object in the world.
     */
    power: number | null;

    /** Where it currently is, when it is not on a person. */
    locationId: string | null;
    tags: string[];
    data: Record<string, string | number | boolean | null>;
    nextClaimSeq: number;
}

/**
 * What is left of a broken object.
 *
 * One rung down, at every rung, for everything. A shattered sabre rated six
 * leaves pieces rated five; a shattered immortal weapon rated forty-six leaves
 * pieces rated forty-five. There is no special case at the top of the scale and
 * there must not be one - the dramatic consequences people draw from the high
 * end (that the only objects above the mortal ceiling anybody can hold are the
 * remains of something that failed up there) are consequences of this ordinary
 * rule meeting an ordinary boundary, not of a rule written for immortals.
 *
 * A piece is a real object: it has an owner, a provenance and a power, and it
 * can be broken again. Nothing stops a chain of that, which is most of why the
 * bottom of the artifact catalog is full of things nobody can name the maker of.
 */
export function shardPower(power: number | null): number | null {
    if (power === null) return null;
    return Math.max(0, power - 1);
}

/**
 * Break an object into pieces, as ordinary records.
 *
 * The pieces are objects. They inherit the provenance and lose a rung, and the
 * original is not returned - a thing that has been broken is not in the world
 * any more, which is the only part of this anybody argues about.
 *
 * ── WHEN THIS APPLIES, AND WHEN `ruin` DOES INSTEAD ──────────────────────
 *
 * Almost never. Ruled by the design owner: everything below the immortal grade
 * that comes apart is simply ruined, and mints nothing. A piece is a TRACKED
 * object - a row with a holder and a provenance chain - and a world where every
 * broken sabre leaves two of them is a ledger that fills with rubble, which is
 * `docs/world/things/items.md`'s counted-or-tracked line arriving at the answer rather
 * than being set aside for convenience. The top of the ladder is the only place
 * the pieces are individually worth remembering.
 *
 * `FRAGMENTS_AT_OR_ABOVE` in
 * `engine/cultivation/whether-a-weapon-survives-being-used.ts` is the rung, and
 * that module is where the argument for the number lives. Use `ruin` for
 * everything under it.
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
 *
 * The ordinary case, and the sibling of `shatter` above: a blade that comes
 * apart against something far past it is gone, and there is nothing on the
 * ground worth a row. No new objects are minted here, deliberately.
 *
 * ── SPENT IS NOT GONE ────────────────────────────────────────────────────
 *
 * What does NOT go is the record. `docs/world/things/items.md` states it as its own
 * section and the reason is that an object which vanishes cleanly from the
 * record is an object nobody can ever be asked about, and being asked about it
 * is most of what makes it matter. A house that cannot account for something
 * should have a record that says so.
 *
 * So the row stays, keeps its name, its owner, its claims and every link of its
 * provenance, and gains one more link saying where it ended and who was
 * standing there. What changes is that nobody is holding it, it is nowhere, it
 * is worth nothing in a fight, and it carries a `ruined` tag anything reading
 * the shelf can see. An inheritance two centuries later still finds the entry
 * and can still ask what happened to it.
 *
 * Ownership is deliberately NOT cleared. Whose it was is a fact about the past
 * and clearing it would delete the only party with standing to be aggrieved -
 * which for a sect artifact broken by an outsider is the entire situation.
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
        locationId: null,
        tags: [],
        data: {},
        nextClaimSeq: 1,
        ...init
    };
}

/**
 * A lot of a fungible resource with a story attached.
 *
 * Not every spirit stone forever - a lot is created when a specific quantity
 * came from somewhere worth remembering. The 108 stones out of an abandoned
 * mine are one row; the stones somebody was paid last week are not tracked at
 * all.
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
 *
 * Possession moves. Ownership moves only when the caller says so, which for
 * `stolen` and `looted` it never should. The provenance chain gains a link
 * either way, so the theft is on the record even while everyone involved
 * behaves as though it is not.
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
 *
 * A claim is recorded whether or not it is any good and whether or not anyone
 * else has heard it. Two claimants with incompatible bases is the normal state
 * of anything worth having.
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
