/**
 * What a house moves its people on: the rungs, what a house has of each, and the
 * very small number of craft that are objects with names.
 */

import { makeObject } from '../../engine/world/possessions.js';
import type { ObjectRecord } from '../../engine/world/possessions.js';
import type {
    Conveyance,
    ConveyanceRange
} from '../../engine/world/what-a-conveyance-does-to-a-journey.js';
import type {
    ConveyanceRecipe
} from '../../engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';

// ─────────────────────────────────────────────────────────────────────────
// THE RUNGS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every kind of conveyance in the world.
 */
export const CONVEYANCES: readonly Conveyance[] = [
    {
        id: 'conv-on-foot',
        name: 'On foot',
        grade: null,
        range: 'crossing',
        holding: 'none',
        heads: 1,
        crossesGroundThatCannotBeWalked: false,
        seenComing: false,
        drawnByBeast: false,
        description:
            'The floor, and where most parties in most houses in this world start and finish. '
            + 'It reaches anywhere there is ground, it costs nothing, and it is the single most '
            + 'legible thing about a delegation that arrives on it. Nobody chooses to be read '
            + 'that way and everybody at the gate does the reading anyway.'
    },
    {
        id: 'conv-sword-flight',
        // The art's grade, not a material. See `Conveyance.grade`.
        name: 'Flight on one\'s own blade',
        grade: 'earth',
        range: 'province',
        holding: 'personal',
        heads: 1,
        crossesGroundThatCannotBeWalked: true,
        seenComing: true,
        drawnByBeast: false,
        description:
            'One person, standing on their own sword, and the only row here that is not property. '
            + 'It cannot be bought, lent, inherited, moored, taken off a body or found abandoned, '
            + 'and it belongs to sword schools rather than to anybody who reached the rung - see '
            + '`couldFlyOnTheirOwnBlade`. A sword house too poor for a hull still outruns a '
            + 'richer neighbour, one messenger at a time, and cannot move a party at all.'
    },
    {
        id: 'conv-mount-mortal',
        name: 'A broken spirit beast',
        grade: 'mortal',
        range: 'province',
        holding: 'counted',
        heads: 2,
        crossesGroundThatCannotBeWalked: false,
        seenComing: false,
        drawnByBeast: true,
        description:
            'Something taken off ground the house already holds, broken to a saddle, and counted '
            + 'the way stock is counted. The cheapest real conveyance in the world because the '
            + 'only thing it costs is the hunt, which a poor house can afford in the one currency '
            + 'it has, and the reason a house with nothing still has something.'
    },
    {
        id: 'conv-mount-earth',
        name: 'A deep-drawn mount',
        grade: 'earth',
        range: 'province',
        holding: 'counted',
        heads: 2,
        crossesGroundThatCannotBeWalked: false,
        seenComing: false,
        drawnByBeast: true,
        description:
            'The same arrangement with a far more dangerous animal under it, which is the whole '
            + 'difference: what it costs is not stones, it is the party that has to go and take '
            + 'one, and houses lose people doing it every year.'
    },
    {
        id: 'conv-carriage-mortal',
        name: 'A drawn carriage',
        grade: 'mortal',
        range: 'district',
        holding: 'counted',
        heads: 4,
        crossesGroundThatCannotBeWalked: false,
        seenComing: false,
        drawnByBeast: true,
        description:
            'A box on wheels with a broken beast in the traces, and the commonest cultivator '
            + 'conveyance there is. Every house at every level of wealth keeps several, because '
            + 'everybody needs the short trip and nobody wants to be remarked on making it.'
    },
    {
        id: 'conv-carriage-earth',
        name: 'A shod carriage',
        grade: 'earth',
        range: 'province',
        holding: 'counted',
        heads: 6,
        crossesGroundThatCannotBeWalked: false,
        seenComing: false,
        drawnByBeast: true,
        description:
            'Built to hold together over a province rather than a district, with a core in the '
            + 'frame and a beast in the traces that most houses could not take. Still an amount '
            + 'rather than an object: a house has four of these and could not tell you which of '
            + 'them went to Iron Gate last spring.'
    },
    {
        id: 'conv-carriage-heaven',
        name: 'A named carriage',
        grade: 'heaven',
        range: 'district',
        holding: 'tracked',
        heads: 8,
        // Superbly made and still a road vehicle. The boat is the only thing in
        // the world that crosses water, and diluting that would take the whole
        // point out of owning one.
        crossesGroundThatCannotBeWalked: false,
        seenComing: true,
        drawnByBeast: true,
        description:
            'What a house that owns a hull ALSO owns, and the row that stops this table reading '
            + 'as a ladder. It is for the short trip, it is worth a war, and it exists because '
            + 'nobody takes the boat out to cross a district. A house holding one of these and '
            + 'no hull is a house that had a hull.'
    },
    {
        id: 'conv-spirit-boat',
        name: 'A spirit boat',
        grade: 'heaven',
        range: 'crossing',
        holding: 'tracked',
        heads: 30,
        crossesGroundThatCannotBeWalked: true,
        seenComing: true,
        drawnByBeast: false,
        description:
            'The only thing in the world that puts thirty people over open water, dead ground or '
            + 'a face nothing climbs, and it cannot do any of it quietly. Everybody between here '
            + 'and there knows what came past and whose it was, which is not a drawback bolted '
            + 'on: being unfakeable and being unhideable are the same property, and the second is '
            + 'the price of the first.'
    }
];

const CONVEYANCE_BY_ID: ReadonlyMap<string, Conveyance> =
    new Map(CONVEYANCES.map(c => [c.id, c]));

export function getConveyance(id: string): Conveyance | undefined {
    return CONVEYANCE_BY_ID.get(id);
}

export function requireConveyance(id: string): Conveyance {
    const c = CONVEYANCE_BY_ID.get(id);
    if (!c) throw new Error(`Unknown conveyance: ${id}`);
    return c;
}

export function conveyancesForRange(range: ConveyanceRange): readonly Conveyance[] {
    return CONVEYANCES.filter(c => c.range === range);
}

/** The two rows that are objects. Everything else is an amount or an art. */
export function trackedConveyanceKinds(): readonly Conveyance[] {
    return CONVEYANCES.filter(c => c.holding === 'tracked');
}

// WHAT A HOUSE HAS OF THE COUNTED ONES

/** The resource key a counted conveyance is held under. */
export function countedHoldingKey(conveyanceId: string): string {
    return `conveyance:${conveyanceId}`;
}

/**
 * How many of these a body has.
 */
export function countedHolding(
    resources: Readonly<Record<string, number>>,
    conveyanceId: string
): number {
    const kind = getConveyance(conveyanceId);
    if (kind && kind.holding !== 'counted') return 0;
    return Math.max(0, Math.floor(resources[countedHoldingKey(conveyanceId)] ?? 0));
}

/**
 * Move a count. Arithmetic, deliberately, and never a transfer.
 */
export function adjustCountedHolding(
    resources: Readonly<Record<string, number>>,
    conveyanceId: string,
    delta: number
): Record<string, number> {
    const key = countedHoldingKey(conveyanceId);
    const next = Math.max(0, (resources[key] ?? 0) + Math.floor(delta));
    return { ...resources, [key]: next };
}

/**
 * The counted conveyance a transport line on the price board actually is.
 */
export const CONVEYANCE_ON_THE_PRICE_BOARD: Readonly<Record<string, string>> = Object.freeze({
    'price-mule': 'conv-mount-mortal',
    'price-cart': 'conv-carriage-mortal'
});

export function conveyanceSoldAs(priceId: string): Conveyance | undefined {
    const id = CONVEYANCE_ON_THE_PRICE_BOARD[priceId];
    return id === undefined ? undefined : getConveyance(id);
}

/**
 * The words somebody actually says when they want one.
 */
const WHAT_PEOPLE_CALL_THEM: Readonly<Record<string, string>> = Object.freeze({
    horse: 'price-mule',
    mount: 'price-mule',
    mule: 'price-mule',
    donkey: 'price-mule',
    pony: 'price-mule',
    cart: 'price-cart',
    carriage: 'price-cart',
    wagon: 'price-cart',
    waggon: 'price-cart'
});

/**
 * The price row somebody meant, or undefined.
 */
export function priceRowForSomethingToRide(said: string): string | undefined {
    const words = said.toLowerCase().match(/[a-z]+/g) ?? [];
    for (const word of words) {
        const row = WHAT_PEOPLE_CALL_THEM[word];
        if (row !== undefined) return row;
    }
    return undefined;
}

/**
 * Everything counted this body holds, as conveyances.
 */
export function countedConveyancesHeld(
    resources: Readonly<Record<string, number>>
): readonly { conveyance: Conveyance; count: number }[] {
    return CONVEYANCES
        .filter(c => c.holding === 'counted')
        .map(conveyance => ({ conveyance, count: countedHolding(resources, conveyance.id) }))
        .filter(row => row.count > 0);
}

/**
 * What a house has, in the words somebody asking would get back.
 */
export function describeCountedHoldings(
    resources: Readonly<Record<string, number>>
): string {
    const held = CONVEYANCES
        .filter(c => c.holding === 'counted')
        .map(c => ({ c, n: countedHolding(resources, c.id) }))
        .filter(x => x.n > 0);
    if (held.length === 0) {
        return 'Nothing in the yard. Whatever this house sends anywhere, it sends on foot.';
    }
    return held
        .map(x => {
            // The catalog names carry their own article - "A shod carriage" -
            // so a count in front of one read "5 a shod carriages".
            const what = x.c.name.replace(/^an?\s+/i, '').toLowerCase();
            return `${x.n} ${what}${x.n === 1 ? '' : 's'} at ${x.c.grade} grade`;
        })
        .join(', ') + '.';
}

// THE BILLS OF MATERIALS

export const CONVEYANCE_RECIPES: readonly ConveyanceRecipe[] = [
    {
        id: 'build-carriage-mortal',
        name: 'A drawn carriage',
        producesConveyanceId: 'conv-carriage-mortal',
        grade: 'mortal',
        components: [
            { wants: 'hide and hardened plate for the box', grade: 'mortal', count: 6, mustBeCore: false },
            { wants: 'sinew for the harness and the spring', grade: 'mortal', count: 4, mustBeCore: false }
        ],
        workDays: 40,
        baseSuccessRate: 0.88
    },
    {
        id: 'build-carriage-earth',
        name: 'A shod carriage',
        producesConveyanceId: 'conv-carriage-earth',
        grade: 'earth',
        components: [
            { wants: 'plate and bone for a frame that will take a province', grade: 'earth', count: 16, mustBeCore: false },
            { wants: 'sinew that does not go slack over a month on the road', grade: 'earth', count: 8, mustBeCore: false },
            // A HEAVEN-GRADE CORE IN AN EARTH-GRADE CARRIAGE, AND IT IS NOT A
            // MISTAKE. Measured off `BEAST_MATERIALS`: there is no core below
            // heaven grade anywhere in the world, and there cannot be, because
            // `BEAST_CORE_ORDINAL` is 17 and a core is condensed cultivation rather
            // than a part of an animal. So the cheapest core obtainable is a
            // heaven-grade one, and every conveyance with a core in it is paying
            // that price whatever else it is made of.
            { wants: 'a core for the frame, so the whole of it answers as one thing', grade: 'heaven', count: 1, mustBeCore: true }
        ],
        workDays: 150,
        baseSuccessRate: 0.7
    },
    {
        id: 'build-carriage-heaven',
        name: 'A named carriage',
        producesConveyanceId: 'conv-carriage-heaven',
        grade: 'heaven',
        components: [
            { wants: 'bone long enough and sound enough to run the length of it', grade: 'heaven', count: 30, mustBeCore: false },
            { wants: 'hide and plate, in quantity, and none of it patched', grade: 'heaven', count: 14, mustBeCore: false },
            { wants: 'cores, one at each axle', grade: 'heaven', count: 2, mustBeCore: true }
        ],
        workDays: 700,
        baseSuccessRate: 0.5
    },
    {
        id: 'build-spirit-boat',
        name: 'A spirit boat',
        producesConveyanceId: 'conv-spirit-boat',
        grade: 'heaven',
        components: [
            { wants: 'bone for the keel and the ribs, and a great deal of it', grade: 'heaven', count: 80, mustBeCore: false },
            { wants: 'hide and plate for a hull that has nothing under it', grade: 'heaven', count: 40, mustBeCore: false },
            { wants: 'cores, and the middle one is what actually holds it up', grade: 'heaven', count: 6, mustBeCore: true }
        ],
        // Six and a half years for one pair of qualified hands, and there are a
        // few dozen such hands in the world. This is the number that makes a
        // hull an undertaking rather than a purchase, and it is why a house
        // building one is doing nothing else with its best elder.
        workDays: 2_400,
        baseSuccessRate: 0.4
    }
];

const RECIPE_BY_ID: ReadonlyMap<string, ConveyanceRecipe> =
    new Map(CONVEYANCE_RECIPES.map(r => [r.id, r]));

export function getConveyanceRecipe(id: string): ConveyanceRecipe | undefined {
    return RECIPE_BY_ID.get(id);
}

export function recipeForConveyance(conveyanceId: string): ConveyanceRecipe | undefined {
    return CONVEYANCE_RECIPES.find(r => r.producesConveyanceId === conveyanceId);
}

/**
 * Rungs of the ladder nobody builds.
 */
export function conveyancesNobodyBuilds(): readonly Conveyance[] {
    return CONVEYANCES.filter(c => recipeForConveyance(c.id) === undefined);
}

// THE CRAFT THAT ARE OBJECTS

function craft(init: {
    id: string;
    name: string;
    power: number;
    ownerId: string | null;
    ownerName: string;
    conveyanceId: string;
    mooredAt: string;
    builtYearsAgo: number;
    significance?: 'notable' | 'significant' | 'legendary';
    tags?: readonly string[];
    description: string;
}): ObjectRecord {
    const kind = requireConveyance(init.conveyanceId);
    return makeObject({
        id: init.id,
        name: init.name,
        kind: 'artifact',
        significance: init.significance ?? 'significant',
        power: init.power,
        ownerId: init.ownerId,
        ownerName: init.ownerName,
        possessorId: null,
        locationId: null,
        description: init.description,
        data: {
            conveyanceId: init.conveyanceId,
            range: kind.range,
            mooredAt: init.mooredAt,
            builtYearsAgo: init.builtYearsAgo
        },
        tags: ['conveyance', 'moored', kind.range, ...(init.tags ?? [])]
    });
}

export const TRACKED_CRAFT: readonly ObjectRecord[] = [
    craft({
        id: 'craft-the-long-answer',
        name: 'The Long Answer',
        power: 38,
        ownerId: 'sect-azure-cloud-pavilion',
        ownerName: 'Azure Cloud Pavilion',
        conveyanceId: 'conv-spirit-boat',
        mooredAt: 'the terraces above the Jade Gorge gorge',
        builtYearsAgo: 96,
        significance: 'legendary',
        tags: ['boat'],
        description:
            'The best hull in two provinces and the newest thing the Pavilion has built, which '
            + 'are the same sentence and are the whole of what a house wants said about it. Every '
            + 'delegation that has ever arrived on it was believed before anybody spoke, and the '
            + 'Pavilion has never once had to say what it cost.'
    }),
    craft({
        id: 'craft-the-rate-itself',
        name: 'The Rate Itself',
        power: 34,
        ownerId: 'sect-stonewright-consortium',
        ownerName: 'Stonewright Consortium',
        conveyanceId: 'conv-spirit-boat',
        mooredAt: 'the cutting houses at the head of the nine veins',
        builtYearsAgo: 210,
        significance: 'legendary',
        tags: ['boat'],
        description:
            'Named after the only thing the Consortium sells, and used for the only thing worth '
            + 'moving that fast: assayed stone, in quantity, arriving before the news that it '
            + 'was coming. It has never carried a fighting party and the Consortium points that '
            + 'out to everybody, at length, which is itself worth reading.'
    }),
    craft({
        id: 'craft-nothing-was-declared',
        name: 'Nothing Was Declared',
        power: 33,
        ownerId: 'sect-thousand-treasure-pavilion',
        ownerName: 'Thousand Treasure Pavilion',
        conveyanceId: 'conv-spirit-boat',
        mooredAt: 'the auction yard, behind the wall, where it is not shown',
        builtYearsAgo: 140,
        tags: ['boat'],
        description:
            'A hull owned by an auction house, which is a sentence with a consequence: everything '
            + 'that arrives at that yard by water arrived on this, and the house that consigned '
            + 'it can be worked out by anybody who watched the water. Two of its four visible '
            + 'routes are the reason the Pavilion is trusted and the other two are the reason it '
            + 'is not.'
    }),
    craft({
        id: 'craft-the-fourth-thing',
        name: 'The Fourth Thing the Forge Finished',
        power: 31,
        ownerId: 'sect-ashen-forge-clan',
        ownerName: 'Ashen Forge Clan',
        conveyanceId: 'conv-carriage-heaven',
        mooredAt: 'the compound yard, under the arc of dark nodes',
        builtYearsAgo: 340,
        tags: ['carriage'],
        description:
            'A named carriage and no hull, in a clan whose makers outnumber its fighters. The '
            + 'clan can build to this grade and has, four times, and has never once had six '
            + 'heaven-grade cores in the same yard in the same decade - so what it holds is the '
            + 'best short-range craft in the province and nothing that leaves it.'
    }),
    craft({
        id: 'craft-the-one-nobody-came-back-for',
        name: 'The One Nobody Came Back For',
        power: 29,
        // Null owner and null possessor. Somebody built it, somebody owned it,
        // and the chain has a hole where both of them should be - which is
        // `possessions.ts`'s whole reason for keeping the four layers apart.
        ownerId: null,
        ownerName: '',
        conveyanceId: 'conv-spirit-boat',
        mooredAt: 'a shingle bank two days off the Northern Capes, above the tide line',
        builtYearsAgo: 620,
        tags: ['boat', 'abandoned'],
        description:
            'A hull at the bottom of the rating that can hold one, sitting where it was left, '
            + 'above the tide line and therefore left on purpose. Nobody has claimed it in six '
            + 'centuries, which in a world where a hull is worth a war is not an oversight, and '
            + 'the interesting question about it is not who owned it but what the people who '
            + 'knew where it was decided was worth more than a boat.'
    })
];

const CRAFT_BY_ID: ReadonlyMap<string, ObjectRecord> =
    new Map(TRACKED_CRAFT.map(c => [c.id, c]));

export function getTrackedCraft(id: string): ObjectRecord | undefined {
    return CRAFT_BY_ID.get(id);
}

/** Everything a body owns outright. A null owner is nobody's and returns for none. */
export function craftOwnedBy(ownerId: string): readonly ObjectRecord[] {
    return TRACKED_CRAFT.filter(c => c.ownerId !== null && c.ownerId === ownerId);
}

/** Houses with a name to say. Sorted, so the list is stable to read. */
export function housesWithACraft(): readonly string[] {
    return [...new Set(
        TRACKED_CRAFT.map(c => c.ownerId).filter((id): id is string => id !== null)
    )].sort();
}

/**
 * The conveyance kind a tracked craft is an instance of.
 */
export function kindOfCraft(craftRow: ObjectRecord): Conveyance | undefined {
    const id = craftRow.data.conveyanceId;
    return typeof id === 'string' ? getConveyance(id) : undefined;
}

/** How old it is. The field a decline is read off. */
export function craftAgeInYears(craftRow: ObjectRecord): number {
    const years = craftRow.data.builtYearsAgo;
    return typeof years === 'number' ? years : 0;
}
