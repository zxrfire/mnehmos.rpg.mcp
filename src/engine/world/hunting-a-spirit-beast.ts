/**
 * Hunting a spirit beast - what is on this ground, whether it can be taken, and
 * what comes off the body.
 */

import {
    BEASTS,
    BEAST_CHANGE_ORDINAL,
    BEAST_CORE_ORDINAL,
    materialsOf,
    type Beast,
    type BeastAbility,
    type BeastMaterial
} from '../../data/cultivation/beasts.js';
import type { HerbBiome } from '../../data/cultivation/herbs.js';
import { MAX_ORDINAL, rankName } from '../cultivation/realms.js';
import {
    narrowToOffered,
    regardOf,
    steepestGap,
    type Regard
} from '../cultivation/regard.js';
import {
    makeObject,
    transferPossession,
    type ObjectRecord,
    type ObjectSignificance
} from './possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE GROUND
//
// `persistence` is the catalog's statement about where a thing survives the
// Late Age, and until now nothing read it. It is the difference between a
// province that has hares and a sealed chamber that has had something
// cultivating in it undisturbed since before the seal was cut.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the caller knows about the ground somebody is standing on.
 */
export interface GroundForBeasts {
    /** Narrows the draw when the caller knows it. Omitted means the whole map. */
    biome?: HerbBiome;
    /** Inside closed ground: a sealed ruin, an unopened chamber, a cut face. */
    sealed: boolean;
    /** The ground is a vein, or sits on one close enough to matter. */
    onAVein: boolean;
}

/**
 * What could be standing here at all, before anybody's realm is considered.
 */
export function beastsOnThisGround(ground: GroundForBeasts): readonly Beast[] {
    return BEASTS.filter(beast => {
        if (ground.biome && beast.biome !== ground.biome) return false;
        switch (beast.persistence) {
            case 'sealed_only':
                return ground.sealed;
            case 'vein_only':
                return ground.onAVein || ground.sealed;
            case 'open_world':
            case 'thin_remnant':
                return true;
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// THE DRAW
// ─────────────────────────────────────────────────────────────────────────

/**
 * Weighted draw over an already-filtered pool.
 */
function drawByFrequency(pool: readonly Beast[], sample: number): Beast | undefined {
    if (pool.length === 0) return undefined;
    const total = pool.reduce((sum, b) => sum + b.frequency, 0);
    let cursor = Math.max(0, Math.min(0.999999999, sample)) * total;
    for (const beast of pool) {
        cursor -= beast.frequency;
        if (cursor < 0) return beast;
    }
    return pool[pool.length - 1];
}

/**
 * What a hunter meets, and what was also here and is above them.
 */
export interface WhatIsOnThisGround {
    /** What the hunt actually turned up, or null for empty ground. */
    met: Beast | null;
    /** Everything here standing above the hunter. Never drawn, always said. */
    above: readonly Beast[];
    /** The worst of `above`, priced by the ordinary resolver. Null if clear. */
    worst: Regard | null;
}

export function whatIsOnThisGround(
    ground: GroundForBeasts,
    hunterOrdinal: number,
    sample: number
): WhatIsOnThisGround {
    const here = beastsOnThisGround(ground);
    const rung = clampOrdinal(hunterOrdinal);

    const reachable = here.filter(b => b.ordinal <= rung);
    const above = here.filter(b => b.ordinal > rung);

    // The same narrowing the catalog's own draw applies: a hare somebody is
    // twenty rungs past is not an encounter, it is a thing walked past. Where
    // nothing survives the narrowing the reachable set comes back, because
    // ground with only hares on it still has hares on it.
    const offered = narrowToOffered(reachable, rung);

    return {
        met: drawByFrequency(offered, sample) ?? null,
        above,
        worst: above.length > 0 ? steepestGap(above, rung) : null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHICH OF TWO SCENES THIS IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much the world bothers to remember about one of these.
 */
export type BeastBand = 'counted' | 'tracked' | 'person';

export function bandOf(beast: Beast): BeastBand {
    if (beast.ordinal >= BEAST_CHANGE_ORDINAL) return 'person';
    if (beast.ordinal >= BEAST_CORE_ORDINAL) return 'tracked';
    return 'counted';
}

/**
 * Whether this is somebody rather than something.
 */
export function readsAsSomebody(beast: Beast): boolean {
    return beast.speaks;
}

/** Whether a beast is at or past the rung where a core can exist at all. */
export function hasACore(beast: Beast): boolean {
    return beast.ordinal >= BEAST_CORE_ORDINAL;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SPECIES AXIS
//
// The rung gives what it gives everybody. This is what a thing can do because
// of what it IS, and no amount of cultivation confers it on a human.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far a species ability has come.
 */
export type AbilityTier = 'latent' | 'grown' | 'final';

export interface AbilityAt {
    tier: AbilityTier;
    name: string;
    kind: BeastAbility['kind'];
    /** The authored line, which describes the final form. */
    what: string;
    /** What this tier actually amounts to, stated once per tier. */
    atThisTier: string;
    /** Only the final form can put the beast shape on and take it off. */
    canTakeTheBeastForm: boolean;
}

const WHAT_A_TIER_AMOUNTS_TO: Record<AbilityTier, string> = {
    latent:
        'A weak version of it, and unmistakably the same thing. Enough that somebody who '
        + 'knows what they are looking at can name the species off it, and not enough to '
        + 'decide anything.',
    grown:
        'The working version. It is worth building a fight around, worth hiding, and worth '
        + 'somebody asking where it came from.',
    final:
        'The whole of it, and the beast shape available on request rather than worn. What '
        + 'is standing there looks like a person until it decides otherwise.'
};

export function abilityAt(beast: Beast): AbilityAt {
    const band = bandOf(beast);
    const tier: AbilityTier =
        band === 'person' ? 'final' : band === 'tracked' ? 'grown' : 'latent';
    return {
        tier,
        name: beast.ability.name,
        kind: beast.ability.kind,
        what: beast.ability.what,
        atThisTier: WHAT_A_TIER_AMOUNTS_TO[tier],
        canTakeTheBeastForm: tier === 'final'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// BLOODLINE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a child carries, read off both parents.
 */
export function bloodlineTierForChild(
    left: AbilityTier | null,
    right: AbilityTier | null
): AbilityTier | null {
    // Two carriers hold the line at the better of what they hold. Nothing here
    // asks whether they are related, or of the same house, or married within
    // anything - only what each of them carries.
    if (left && right) return STRONGER_OF[left][right];
    const only = left ?? right;
    if (!only) return null;
    return STEP_DOWN[only];
}

/**
 * A line, as a person carries it.
 */
/** Whether a stored value is a tier this build knows. */
export function isAbilityTier(value: unknown): value is AbilityTier {
    return value === 'latent' || value === 'grown' || value === 'final';
}

export interface Bloodline {
    /** A `Beast` id in `beasts.ts`. The ability itself is read from there. */
    speciesId: string;
    /** How strong it still is. `null` is not representable: gone is no line. */
    tier: AbilityTier;
}

/**
 * The child's line, read off both parents' whole records rather than two tiers.
 */
export function bloodlineForChild(
    left: Bloodline | null,
    right: Bloodline | null
): Bloodline | null {
    const tier = bloodlineTierForChild(left?.tier ?? null, right?.tier ?? null);
    if (!tier) return null;
    if (left && right) {
        const stronger = ORDER.indexOf(right.tier) > ORDER.indexOf(left.tier) ? right : left;
        return { speciesId: stronger.speciesId, tier };
    }
    const only = left ?? right;
    return only ? { speciesId: only.speciesId, tier } : null;
}

const ORDER: readonly AbilityTier[] = ['latent', 'grown', 'final'];

const STEP_DOWN: Record<AbilityTier, AbilityTier | null> = {
    final: 'grown',
    grown: 'latent',
    latent: null
};

const STRONGER_OF: Record<AbilityTier, Record<AbilityTier, AbilityTier>> =
    Object.fromEntries(ORDER.map(a => [
        a,
        Object.fromEntries(ORDER.map(b =>
            [b, ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b])) as Record<AbilityTier, AbilityTier>
    ])) as Record<AbilityTier, Record<AbilityTier, AbilityTier>>;

/**
 * WHAT IS DELIBERATELY NOT BUILT HERE, AND WHERE IT GOES.
 */
export const theChangedBelongAmongThePeople = true;

/**
 * The reading a cultivator gets across a valley, and the only one they get.
 */
export function readTheThing(beast: Beast, hunterOrdinal: number): string {
    const regard = regardOf(beast, clampOrdinal(hunterOrdinal));
    const height = `${beast.name}, at ${rankName(beast.ordinal)}`;
    if (readsAsSomebody(beast)) {
        // No anatomical tell, deliberately - see
        // `WHAT_GIVES_A_CHANGED_BEAST_AWAY`. The shape is correct and looking
        // harder is not the check. What is offered here is the rung and the
        // fact that it is a party; what would actually give it away is a
        // conversation nobody is having while deciding whether to swing.
        return `${height}. The shape is exactly right, and it is watching you have the `
            + `thought. Whatever else it is, it is a party to a conversation, and opening `
            + `with a sword is how that goes wrong.`;
    }
    return `${height}. ${regard.reaction}`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE HARVEST
//
// `items.md` governs this and nothing here decides it independently. The
// counted/tracked line is the one that document derives from production:
// a grade the standing population can restock is a quantity, a grade it
// cannot is a row with a history. Measured on a world of 587 living
// cultivators: 587 can work mortal, 89 can work earth, 30 can work heaven,
// and nobody at all above that.
// ─────────────────────────────────────────────────────────────────────────

export type HarvestShape = 'counted' | 'tracked';

/**
 * Which shape a material is stored in.
 */
export function howAMaterialIsStored(material: BeastMaterial): HarvestShape {
    return material.grade === 'mortal' || material.grade === 'earth'
        ? 'counted'
        : 'tracked';
}

/**
 * How much bookkeeping the world keeps on one of these.
 */
export function significanceOf(material: BeastMaterial): ObjectSignificance {
    if (howAMaterialIsStored(material) === 'counted') return 'mundane';
    return material.grade === 'heaven' ? 'significant' : 'legendary';
}

export interface TakenMaterial {
    material: BeastMaterial;
    shape: HarvestShape;
}

export interface LeftBehindMaterial {
    material: BeastMaterial;
    /** Why it stayed where it was. */
    because: 'realm' | 'no_body';
    /** The ordinal it wants, for the `realm` case. */
    needs: number;
}

export interface Harvest {
    taken: readonly TakenMaterial[];
    leftBehind: readonly LeftBehindMaterial[];
}

/**
 * What comes off, given a body and somebody to cut it.
 */
export function whatComesOffTheBody(input: {
    beast: Beast;
    takerOrdinal: number;
    /** Whether the thing is dead and the body is available. */
    killed: boolean;
}): Harvest {
    const rung = clampOrdinal(input.takerOrdinal);
    const taken: TakenMaterial[] = [];
    const leftBehind: LeftBehindMaterial[] = [];

    for (const material of materialsOf(input.beast.id)) {
        if (material.taking === 'kill' && !input.killed) {
            leftBehind.push({ material, because: 'no_body', needs: material.harvestOrdinal });
            continue;
        }
        if (material.harvestOrdinal > rung) {
            leftBehind.push({ material, because: 'realm', needs: material.harvestOrdinal });
            continue;
        }
        taken.push({ material, shape: howAMaterialIsStored(material) });
    }

    return { taken, leftBehind };
}

// ─────────────────────────────────────────────────────────────────────────
// THE OBJECT, AND WHAT ITS PROVENANCE SAYS ABOUT WHOEVER HOLDS IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * A tracked material as a real object with a real origin.
 */
export function objectForBeastMaterial(init: {
    id: string;
    material: BeastMaterial;
    beast: Beast;
    takerId: string;
    takerName: string;
    /** Where it was killed or gathered. Free text, goes in the provenance. */
    place: string;
    onDay: number;
}): ObjectRecord {
    const { material, beast } = init;
    const somebody = readsAsSomebody(beast);

    const blank = makeObject({
        id: init.id,
        name: material.name,
        kind: 'material',
        significance: significanceOf(material),
        description: material.description,
        // Not a weapon. A core is worth an enormous amount and is worth
        // nothing in a fight, and `power` is the fight column.
        power: null,
        locationId: null,
        tags: [
            'beast_material',
            `grade:${material.grade}`,
            `source:${beast.id}`,
            ...(material.core ? ['core'] : []),
            ...(somebody ? ['taken_from_something_that_spoke'] : [])
        ],
        data: {
            materialId: material.id,
            beastId: beast.id,
            beastOrdinal: beast.ordinal,
            grade: material.grade,
            value: material.value,
            core: material.core,
            spoke: somebody
        }
    });

    return transferPossession(blank, {
        onDay: init.onDay,
        toHolderId: init.takerId,
        toHolderName: init.takerName,
        how: 'looted',
        transfersOwnership: true,
        source: `Taken off a ${beast.name} at ${rankName(beast.ordinal)}, at ${init.place}`,
        note: somebody
            ? `Cut from something that had a shape and a voice and could have been `
              + `spoken to. It stood at ${rankName(beast.ordinal)}, which is the rung at `
              + `which that becomes true, and whoever holds this is holding the `
              + `${material.value} stones somebody else spent centuries becoming.`
            : `Taken off an animal at ${rankName(beast.ordinal)}. Nothing about it could `
              + `have answered.`
    });
}

// ─────────────────────────────────────────────────────────────────────────

function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}
