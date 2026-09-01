/**
 * Layers: the one point where progression is also geography.
 *
 * Everywhere else in this engine, getting stronger changes what you can
 * perceive and survive on a map that was always there. Ordinal 46 is the single
 * exception. Reaching True Immortal does not make somebody a louder version of
 * themselves in their starting province - it MOVES THEM, through the Lid, onto
 * a different layer of the same world.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A LAYER IS A PLACE, NOT A RANK
 * ═════════════════════════════════════════════════════════════════════════
 *
 * So `layer` is a field on locations, factions, NPCs and actors, exactly the
 * way `locationId` is. It is not a tag convention and not an inference from
 * where somebody happens to be standing: the engine has to be able to answer
 * "who is above the Lid" without a join, and has to keep answering it for a
 * person whose `locationId` is null.
 *
 * Everything else stays where it was. One roster, one history ledger, one
 * lineage graph, one object table, one clock. **What changes is access**, and
 * that is the whole of the difference - see `evaluateLayerCrossing` below.
 * Splitting the immortal world into its own containers would have been the
 * hard reset the design forbids: a person's descendants, grudges, debts and
 * provenance chains are all keyed by id, and half of them would have stopped
 * resolving the moment they crossed.
 *
 * ── ACCESS IS RESTRICTED IN BOTH DIRECTIONS ──────────────────────────────
 *
 * Upward, nothing below True Immortal can exist at that pressure, and nothing
 * goes through with the cultivator - which is what produces the world's entire
 * inheritance economy, because an ascending cultivator spends their last years
 * divesting.
 *
 * Downward, `BREATHS_IN_THE_LOWER_REALM` is the return half and it is why an
 * immortal cannot rule anything down here. Ten to fifteen breaths is enough to
 * end a faction and not enough to take one. The ceiling on any object that can
 * be HELD below is `OBJECT_CEILING_BELOW_THE_LID`, for the same reason: what a
 * True Immortal carries goes back up inside fifteen breaths, so nothing at that
 * rung is ever left behind, looted or inherited.
 *
 * A manual is the exception, and it is not an exception to the rule so much as
 * a consequence of it: paper does not let anybody strike at the rung it is
 * rated for. `MANUALS_MAY_EXCEED_THE_LID`.
 *
 * ── HIGHER LAYERS, LATER OR NEVER ────────────────────────────────────────
 *
 * The registry is an ordered array and every function here is written against
 * its index rather than against the literal keys, so a third layer would be a
 * data change. **Do not make one.** One mortal world plus one immortal world is
 * sufficient, and the world layer's governing constraint is that the world
 * gains depth rather than layers. A third exists only if this world's own
 * history ever produces a reason for it, and probably never.
 */

import {
    BREATHS_IN_THE_LOWER_REALM,
    FALSE_IMMORTAL_ORDINAL,
    MANUALS_MAY_EXCEED_THE_LID,
    OBJECT_CEILING_BELOW_THE_LID,
    TRUE_IMMORTAL_ORDINAL,
    isExpelledFromBelow
} from '../cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// THE REGISTRY
// ─────────────────────────────────────────────────────────────────────────

export type LayerKey = 'mortal' | 'immortal';

export interface WorldLayer {
    key: LayerKey;
    /** Position in the stack, lowest first. Nothing branches on the key. */
    index: number;
    name: string;
    /** Ordinal at which a cultivator belongs on this layer. */
    entryOrdinal: number;
    /**
     * Ordinal above which this layer stops being somewhere you can be. Null
     * when the layer expels nobody, which is the top of the stack by
     * definition - there is nowhere further for it to push anyone.
     */
    expelsAbove: number | null;
    description: string;
}

export const MORTAL_LAYER = 'mortal' as const;
export const IMMORTAL_LAYER = 'immortal' as const;

/**
 * Anything without a stated layer is below the Lid.
 *
 * Chosen so that every row written before this field existed reads correctly
 * rather than needing a backfill, and so that a caller who has never heard of
 * the immortal world keeps getting the answers it always got.
 */
export const DEFAULT_LAYER: LayerKey = MORTAL_LAYER;

export const WORLD_LAYERS: readonly WorldLayer[] = [
    {
        key: MORTAL_LAYER,
        index: 0,
        name: 'the lower world',
        entryOrdinal: 0,
        // Forty-five may stay. Forty-six gets ten to fifteen breaths.
        expelsAbove: FALSE_IMMORTAL_ORDINAL,
        description:
            'One enormous planet, late in its age, thin in qi and full of other ' +
            'people\'s failed runs. Everything the game weighs happens here.'
    },
    {
        key: IMMORTAL_LAYER,
        index: 1,
        name: 'the immortal world',
        entryOrdinal: TRUE_IMMORTAL_ORDINAL,
        expelsAbove: null,
        description:
            'The other side of the Lid. Qi at densities the lower world cannot ' +
            'produce, natural law that is not negotiable by a newcomer, ' +
            'civilisations older than the lower world\'s records, dangers ' +
            'calibrated for immortals, and politics that has been running ' +
            'uninterrupted for a very long time.'
    }
] as const;

/**
 * Why there is no third entry, stated where somebody would add one.
 *
 * The architecture permits `mortal -> immortal -> something further` and none
 * of it exists. Scale is not the thing this design is short of.
 */
export const HIGHER_LAYERS_LATER_OR_NEVER =
    'One mortal world plus one immortal world is sufficient. Additional layers are ' +
    'not a way to increase scale - the world gains depth instead, through geography, ' +
    'ancient history, hidden regions and information the player does not have. Add a ' +
    'third only if this world\'s own history ever produces a reason for it.';

export function isLayerKey(value: string): value is LayerKey {
    return WORLD_LAYERS.some(l => l.key === value);
}

export function layerFor(key: LayerKey): WorldLayer {
    const layer = WORLD_LAYERS.find(l => l.key === key);
    // Unreachable while `LayerKey` and the registry agree. The throw exists so
    // a future edit that adds a key without a row fails loudly here instead of
    // silently treating the new layer as the mortal one.
    if (!layer) throw new Error(`No world layer registered for '${key}'`);
    return layer;
}

/** Coerce a stored string, which may predate the field or be nonsense. */
export function toLayerKey(value: string | null | undefined): LayerKey {
    return value != null && isLayerKey(value) ? value : DEFAULT_LAYER;
}

/** Anything the world stores that sits on one layer or the other. */
export interface Layered {
    layer?: LayerKey;
}

export function layerOf(x: Layered | null | undefined): LayerKey {
    return x?.layer ?? DEFAULT_LAYER;
}

export function isBelowTheLid(x: Layered | null | undefined): boolean {
    return layerOf(x) === MORTAL_LAYER;
}

export function isAboveTheLid(x: Layered | null | undefined): boolean {
    return layerOf(x) !== MORTAL_LAYER;
}

export function layerIndex(key: LayerKey): number {
    return layerFor(key).index;
}

/** The layer above this one, or null at the top. Null is the normal answer. */
export function layerAbove(key: LayerKey): WorldLayer | null {
    return WORLD_LAYERS[layerFor(key).index + 1] ?? null;
}

/** The layer below this one, or null at the bottom. */
export function layerBelow(key: LayerKey): WorldLayer | null {
    const at = layerFor(key).index;
    return at <= 0 ? null : WORLD_LAYERS[at - 1] ?? null;
}

/**
 * Where somebody at this ordinal belongs.
 *
 * The highest layer whose entry ordinal they have reached. A False Immortal at
 * forty-five belongs below and may stay there; that one rung is the entire
 * practical difference between the two landings of the last crossing.
 */
export function layerForOrdinal(ordinal: number): WorldLayer {
    let found = WORLD_LAYERS[0];
    for (const layer of WORLD_LAYERS) {
        if (ordinal >= layer.entryOrdinal) found = layer;
    }
    return found;
}

/** True where this layer has stopped being somewhere this ordinal can be. */
export function expelsOrdinal(key: LayerKey, ordinal: number): boolean {
    const ceiling = layerFor(key).expelsAbove;
    return ceiling !== null && ordinal > ceiling;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT CROSSES THE LID
// ─────────────────────────────────────────────────────────────────────────

export type CrossingSubject = 'person' | 'object' | 'manual' | 'information';
export type CrossingDirection = 'up' | 'down';

export interface CrossingInput {
    subject: CrossingSubject;
    direction: CrossingDirection;
    /** Ordinal of the person crossing, or of whoever is carrying the thing. */
    ordinal: number;
    /** What the object or manual is rated at. Null for things worth nothing in a fight. */
    power?: number | null;
    /** True when the thing was made on the far side. Only those go up. */
    madeAbove?: boolean;
    /** A working line of enquiry through the Lid. Information needs one. */
    channel?: boolean;
}

export interface CrossingVerdict {
    permitted: boolean;
    /** Machine-readable refusal. Null when permitted. */
    reason: string | null;
    detail: string;
    /**
     * How long anything above the Lid may remain below it. Set only for a
     * descent; null everywhere else, because no other crossing has a clock.
     */
    breathsBelow: { min: number; max: number } | null;
    /**
     * Whether the crossing costs the crosser something they cannot get back.
     * Both person-crossings are ruinous. A message is not.
     */
    ruinous: boolean;
}

function permit(detail: string, extra: Partial<CrossingVerdict> = {}): CrossingVerdict {
    return { permitted: true, reason: null, detail, breathsBelow: null, ruinous: false, ...extra };
}

function refuse(reason: string, detail: string): CrossingVerdict {
    return { permitted: false, reason, detail, breathsBelow: null, ruinous: false };
}

/**
 * Price a passage through the Lid, for a person or for a thing.
 *
 * Pure. It states what the boundary permits and what it costs; it does not
 * roll, move anything, or charge anybody. `descend` and `sendAcross` in
 * `immortal-world.ts` are the write paths, and both consult this first so
 * there is exactly one statement of the rule.
 *
 * The asymmetry on objects is the load-bearing part and is easy to read as a
 * mistake. A thing made below may not go up, because nothing goes through the
 * Lid with an ascending cultivator - that refusal is what fills the world with
 * sealed caves. A thing made above may go up, because that is an immortal
 * taking their own property home, which happens automatically inside fifteen
 * breaths whether they intend it or not.
 */
export function evaluateLayerCrossing(input: CrossingInput): CrossingVerdict {
    const expelled = isExpelledFromBelow(input.ordinal);

    if (input.subject === 'person') {
        if (input.direction === 'up') {
            return expelled
                ? permit(
                    'A True Immortal belongs on that side. The crossing is the last one they make, ' +
                    'and nothing goes through it with them.',
                    { ruinous: true }
                )
                : refuse(
                    'crushed_beyond_the_lid',
                    'Nothing below True Immortal can exist at that pressure. Not long odds - the ' +
                    'body simply stops being able to hold together. Spending an irreplaceable ' +
                    'treasure to send somebody up destroys two things at once.'
                );
        }
        return expelled
            ? permit(
                'Coming down forces the Lid open inward, and the Lid does not distinguish that ' +
                'from any other breach. It is paid for out of cultivation condensed over ages, ' +
                'and it buys a quarter of a minute.',
                { ruinous: true, breathsBelow: { ...BREATHS_IN_THE_LOWER_REALM } }
            )
            : refuse('not_beyond_the_lid', 'There is nothing to come down from.');
    }

    if (input.subject === 'information') {
        return input.channel
            ? permit(
                'Information crosses. It is the only reliable channel between the two sides, and ' +
                'it carries what somebody chose to send.'
            )
            : refuse(
                'no_channel',
                'Nothing carries it. The artifacts through which knowledge passes the Lid are ' +
                'among the rarest objects in the world, and without one the two sides are silent.'
            );
    }

    const power = input.power ?? null;

    if (input.direction === 'up') {
        return input.madeAbove
            ? permit('It was made on the far side and it is going home with its holder.')
            : refuse(
                'nothing_goes_through_but_the_cultivator',
                'Nothing goes through the Lid except the cultivator. This is why the years before ' +
                'a crossing are spent divesting, and why the world is full of deliberately built ' +
                'inheritances behind deliberately calibrated doors.'
            );
    }

    // Downward. A manual is paper: it may be rated anywhere, because studying
    // an art above your rung leaves you exactly as strong as you were.
    if (input.subject === 'manual') {
        return permit(
            MANUALS_MAY_EXCEED_THE_LID
                ? 'A manual is paper. It may be rated above the Lid and still change nothing about ' +
                  'whoever holds it - the best art in the world at full mastery buys nothing across ' +
                  'the boundary.'
                : 'A manual crosses.',
            { ruinous: false }
        );
    }

    if (power !== null && power > OBJECT_CEILING_BELOW_THE_LID) {
        return refuse(
            'above_the_object_ceiling',
            `Nothing rated above ${OBJECT_CEILING_BELOW_THE_LID} can be held below the Lid. A weapon ` +
            'at that rung would let somebody at forty-four injure a True Immortal, and there is no ' +
            'such thing: what an immortal carries goes back up with them inside fifteen breaths, so ' +
            'it is never left behind, lost, looted or inherited.'
        );
    }

    return permit(
        'A thing made to be leavable, rated at a rung that can stay. This is the clean route and ' +
        'it is the rare one, because it requires somebody above the Lid to still care about a ' +
        'specific institution down here.',
        { ruinous: input.madeAbove === true }
    );
}

// ─────────────────────────────────────────────────────────────────────────
// THE RECORD OF A CROSSING
// ─────────────────────────────────────────────────────────────────────────

/**
 * What actually became of somebody who went through.
 *
 * The engine is allowed to know this and the world is not. There is no signal:
 * the Lid does not report deaths, the crossing is one-way for people, and the
 * few objects that carry information across carry what somebody chose to send.
 * A house whose channel still answers knows that somebody is picking up; a
 * house whose channel has gone quiet knows nothing at all, because silence is
 * equally consistent with death, with disinterest, with a war up there, and
 * with an object down here that stopped working.
 *
 * So a sect's claim to a living ancestor is a claim rather than a fact, and it
 * is frequently not a lie - the sect does not know either.
 */
export type AfterCrossing = 'still_above' | 'died_above';

export interface AscensionRecord {
    id: string;
    residentId: string;
    residentName: string;
    ascendedOnDay: number;
    /** Where they were standing when they went. */
    fromLocationId: string | null;
    /** The house they left. Its claim to an ascended ancestor is true. */
    fromFactionId: string | null;
    /** The run this life was, when the caller keeps a run ledger. */
    runId: string | null;
    /** Where they came out. */
    toLocationId: string;
    /**
     * The ambiguous fact the lower world got, if it got one. Its `truth` is
     * `unresolved` and it stays that way: crossed, died and in seclusion look
     * identical from below.
     */
    belowFactId: string | null;
    /** The engine's own answer. Never rendered to anybody below the Lid. */
    afterCrossing: AfterCrossing;
    diedAboveOnDay: number | null;
    endNoteAbove: string;
    /** The sealed cache they built on the way out, when they had anything to leave. */
    inheritanceLocationId: string | null;
    /** What the house got, when there was a house. */
    partingGiftObjectId: string | null;
}

export function makeAscensionRecord(
    init: Partial<AscensionRecord> &
        Pick<AscensionRecord, 'id' | 'residentId' | 'residentName' | 'ascendedOnDay' | 'toLocationId'>
): AscensionRecord {
    return {
        fromLocationId: null,
        fromFactionId: null,
        runId: null,
        belowFactId: null,
        afterCrossing: 'still_above',
        diedAboveOnDay: null,
        endNoteAbove: '',
        inheritanceLocationId: null,
        partingGiftObjectId: null,
        ...init
    };
}
