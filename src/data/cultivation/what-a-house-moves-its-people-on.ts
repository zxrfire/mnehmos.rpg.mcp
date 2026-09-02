/**
 * What a house moves its people on: the rungs, what a house has of each, and
 * the very small number of craft that are objects with names.
 *
 * A sect puts parties on the road constantly - after beasts, to a marriage, to
 * a war, to collect tribute from a subsidiary, to find out why a subsidiary
 * stopped sending it. This file is how they get there, and it is one table
 * rather than a boat table beside a carriage table because the whole argument
 * is that they are the same kind of row with different numbers in it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE LINE THIS FILE IS ORGANISED AROUND, AND IT IS NOT A TRANSPORT RULE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `docs/world/things/items.md` decides how anything in this world is stored:
 * counted where nobody cares which one, tracked where the movement of this
 * specific object is an event somebody should be able to find out about two
 * centuries later. Conveyances obey it exactly, and the grade at which they
 * flip is the grade at which everything flips.
 *
 *   BELOW HEAVEN GRADE   a quantity. A line on the house: four at earth grade.
 *                        No id, no ordinal, no provenance, nothing to
 *                        recognise. Losing one is an expense.
 *   AT HEAVEN GRADE      an `ObjectRecord` with an id, an ordinal on the same
 *                        0..46 ladder a person stands on, a provenance chain,
 *                        and a name people say.
 *
 * **Most transport in this world carries no ordinal at all, and that is the
 * point.** If every row in this file were rated the common case would have been
 * made special, and the rating would say nothing. It says something precisely
 * because almost nothing has one.
 *
 * That is also why the boat works as a signal. `docs/world/houses/trust.md`
 * says a retinue of spirit boats is believed because assembling one is beyond
 * almost everybody - its strength is the cost of faking it, not any
 * verification. Read that section rather than this paragraph; what this file
 * adds is that the thing being signalled now exists, was built by somebody, and
 * can be lost.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RANGE IS AN AXIS AND NOT A RUNG
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Do not read this table worst-to-best. A house at the top of the world holds
 * a boat AND carriages, because the carriage is for getting across a district
 * without mounting an expedition to do it and nobody takes the expensive thing
 * out for the short trip. Owning a carriage is not evidence of poverty; owning
 * only carriages is. `range` and the ordinal are separate fields and neither
 * implies the other, and `unsuitedFor` in the engine is what says the wrong
 * choice costs something in both directions.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHERE THE ROWS COME FROM, WHICH IS MOSTLY NOT FROM HERE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Almost nothing in this file is new machinery, and the parts that would have
 * been the most tempting to invent were already built:
 *
 *   THE BEAST IN THE TRACES is a beast. `BEAST_CHANGE_ORDINAL` in `beasts.ts`
 *   is 29 and it does the whole of the work: below it an animal, at and above
 *   it somebody with a shape and a voice who can decline. So a mount or a
 *   draught beast is necessarily under 29, and there is no taming rule here
 *   reaching past that line. Riding something above it is either an arrangement
 *   between two parties or it is keeping a person, and a house that does the
 *   second has told you what it is.
 *
 *   THE MOUNT IS NOT BUILT. It is caught, by the party that goes out after it,
 *   through `engine/world/hunting-a-spirit-beast.ts`. It is the one rung of the
 *   ladder with no recipe and that is worth noticing rather than filling in.
 *
 *   WHO CAN BUILD ONE is `refiningOrdinalFor` in
 *   `engine/cultivation/who-can-refine-a-grade-of-medicine.ts` - the rule that
 *   a cultivator cannot work materials above their realm. Nothing about a hull
 *   is special-cased into it. Heaven grade wants Void Refinement, which is a
 *   few dozen hands in the world, and that is why tracked craft are rare: a
 *   number read off the population rather than one anybody chose.
 *
 *   WHAT A WRECK LEAVES is `shatter`/`ruin` in `engine/world/possessions.ts`
 *   and `FRAGMENTS_AT_OR_ABOVE` (45) in
 *   `engine/cultivation/whether-a-weapon-survives-being-used.ts`. Every craft
 *   in this file is under 45, so a wrecked one is RUINED - the row survives
 *   with its owner, its claims and its whole chain, and mints no salvage. There
 *   is no special rule for a broken boat and there must not be one.
 *
 *   FLIGHT ON A BLADE is `gale-riding-sword-flight` in `techniques.ts`, gated
 *   on `subject: 'sword'` and read by `couldFlyOnTheirOwnBlade`. It is in this
 *   table because it is a way of getting there and it is the only row that is
 *   nobody's property.
 *
 * A CRAFT IS MOORED, NEVER CARRIED. Every tracked row below has a null
 * `possessorId`, and that is load-bearing rather than tidy: `bestObjectHeldBy`
 * in `engine/world/gatherings.ts` arms an NPC with the highest-`power` object
 * they POSSESS, so a craft with a possessor would be a boat somebody swings in
 * a bout. Owned by a house, moored at a place, held by nobody.
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
 *
 * Eight rows and two of them are tracked. If a later pass makes that three out
 * of nine the signal has been diluted; if it makes it five out of nine the
 * signal is gone and `trust.md`'s expensive-signal section is aspirational
 * again.
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
            + 'them went to Kettle last spring.'
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT A HOUSE HAS OF THE COUNTED ONES
//
// A line on the entity and nothing else: an untracked thing is just an amount
// somebody has. Fully recorded, fungible, and with no story - any one is any
// other, there is nothing to recognise and nobody to ask about it.
//
// THIS IS NOT A SECOND COUNTER, AND MUST NOT BECOME ONE.
// `FactionRecord.resources` and `NpcRecord.resources` in
// `engine/world/world-state.ts` are already `Record<string, number>` with
// free-form keys and a stated convention, and this is four functions agreeing
// on a key over that map. No new field is added anywhere, and no count in this
// file goes near `transferPossession`.
//
// GRADE DECIDES THE SIDE, AND NOTHING MOVES IT. An earth-grade carriage is an
// earth-grade carriage for its whole existence. It does not become an
// individual by being old, by being famous, by surviving something or by
// belonging to somebody important; there is no earning your way across the
// line, and a build does not promote what went into it. Crafting CREATES, and
// the output's grade is the recipe's. The only grade movement anywhere in this
// world is downward, and it is `shardPower`.
//
// FOR WHOEVER LANDS THE GENERAL COUNTED-STOCK MODEL. What a conveyance needs
// from it is exactly holder, kind, grade and count - the same four fields
// everything else counted needs - and when that module exists these four
// functions are the adapter to delete, not a model to reconcile.
// ─────────────────────────────────────────────────────────────────────────

/** The resource key a counted conveyance is held under. */
export function countedHoldingKey(conveyanceId: string): string {
    return `conveyance:${conveyanceId}`;
}

/**
 * How many of these a body has.
 *
 * Returns 0 for a tracked kind rather than throwing, because the honest answer
 * to "how many named carriages does this house have as a quantity" is none:
 * those are rows, and they are counted by looking them up.
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
 *
 * `transferPossession` is for a singular thing that moves once and leaves a
 * link in a chain behind it. A carriage leaving a house is a number going down
 * by one, there is nothing to recognise and nobody to be asked about it, and
 * putting an amount through the tracked path is how a ledger fills with rubble.
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
 *
 * TWO CATALOGS THAT WERE ALWAYS ABOUT THE SAME OBJECTS, JOINED. `PRICES` in
 * `mortal-world.ts` has carried a mule at fourteen stones and a cart at thirty
 * since it was written - *the single largest purchase most mortals ever make* -
 * and this file has carried what a mount and a carriage DO to a road. Nothing
 * connected them, so buying the mule answered that there is no row in this
 * engine for holding one, and `whatTheyCouldRide` offered a tracked craft that
 * no player could come to own. Both halves existed; the join did not.
 *
 * A lookup against a closed catalog and nothing more. It reads no prose, it
 * decides no price, and a third transport row added to the board is either in
 * this table or it is not a thing you can put under you.
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
 *
 * AGENTS.md: if a near-synonym works, the phrasing that fails is a bug. The
 * board calls it a mule and the catalog calls it a broken spirit beast, and a
 * player says *I buy a horse* - which was refused with the look people give
 * somebody asking for a thing that is not sold, over an animal that is priced,
 * stocked and rideable.
 *
 * A closed list of words against a closed list of rows, which is the same kind
 * of lookup `resolvePrice` and `resolvePill` already are. It does not scan
 * prose and it decides nothing but which row was meant.
 *
 * DELIBERATELY NARROW. "beast" is not here, because it would take "I buy a
 * beast core" off the medicine board; nor is "trap". Every word in it has to
 * be one that means a thing you get on and nothing else, because this runs
 * ahead of the board's own fuzzy match - a whole word against a closed list is
 * stronger evidence than a prefix against a name, which is how "I buy a
 * carriage" was answering with the fixed rate for moving a corpse.
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
 *
 * Matches a whole word so "a cartographer" is not a cart and "the beast tide"
 * is not a mule, and it deliberately answers with a PRICE row rather than a
 * conveyance: what is being asked for is a purchase, and the purchase is the
 * board's business.
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
 *
 * The read half of {@link adjustCountedHolding}, for a caller asking what is
 * actually under somebody. A house and a person answer it the same way,
 * because both carry a free-form `Record<string, number>` and this is four
 * functions agreeing on a key over it.
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
 *
 * A count is only worth storing if it is answerable, and this is what makes it
 * answerable. The tracked craft are answerable differently - by name - and are
 * deliberately not in this sentence.
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

// ─────────────────────────────────────────────────────────────────────────
// THE BILLS OF MATERIALS
//
// A grade and a count per line, never a named material, because a hull wants
// bulk that holds under load and does not care which animal it came off. See
// the header of `building-a-conveyance-out-of-what-a-hunt-brings-back.ts` for
// why that is the whole difference between this and `recipes.ts`.
//
// The counts are a decision and are pinned by
// `tests/data/what-a-house-moves-its-people-on.test.ts`. What they are
// defending: a hull is a SCHEDULE, not an errand - a house works at one over
// years and hunts for it the whole time - and a core is the line that more of
// something else cannot meet.
// ─────────────────────────────────────────────────────────────────────────

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
            // `BEAST_CORE_ORDINAL` is 17 and a core is condensed cultivation
            // rather than a part of an animal. So the cheapest core obtainable
            // is a heaven-grade one, and every conveyance with a core in it is
            // paying that price whatever else it is made of.
            //
            // Which produces the shape the economy wants without anybody
            // choosing it: the step from a drawn carriage to a shod one is not
            // a step in material, it is the step at which a house has to send
            // people out after something that will kill them. Note also that
            // this does not promote the carriage - it is an earth-grade
            // carriage, counted, forever. Grade is the recipe's and never the
            // material's.
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
 *
 * Three of them, for three different reasons, and every one is a pointer at a
 * system that already exists rather than a gap: walking is not made, flight is
 * a technique in `techniques.ts`, and a mount is caught by a hunting party
 * through `engine/world/hunting-a-spirit-beast.ts`. The mount is the
 * interesting one - it is the only conveyance a house with nothing can acquire,
 * and it costs the one thing a poor house has, which is people willing to go
 * out.
 */
export function conveyancesNobodyBuilds(): readonly Conveyance[] {
    return CONVEYANCES.filter(c => recipeForConveyance(c.id) === undefined);
}

// ─────────────────────────────────────────────────────────────────────────
// THE CRAFT THAT ARE OBJECTS
//
// Ordinary `ObjectRecord`s from the ordinary factory, ordered by `power`
// descending exactly as `artifacts.ts` orders its own table, because the
// ordering is the argument here too: a house's hull and an apex's hull are the
// same row with different numbers in one column.
//
// `possessorId` is null on every one. A craft is moored, not carried.
// `data.builtYearsAgo` carries the age rather than an absolute day, because a
// catalog row cannot know what day it is and a seeder placing these can. A
// house whose best craft is its oldest is a house in decline, and that reading
// costs nothing to store.
// ─────────────────────────────────────────────────────────────────────────

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
        mooredAt: 'the terraces above the Low Fall gorge',
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
 *
 * Stored on `data` rather than derived from the name, because the name is the
 * thing people say and names drift. `undefined` where a row was written badly,
 * which the suite catches.
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
