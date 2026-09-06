/**
 * WHAT IS MADE HERE, AND WHAT LEAVES ON THE WATER.
 *
 * `what-each-house-makes-and-what-crosses-the-water.ts` is a whole trade layer
 * - who makes what, three named lanes with weather and landfalls on them, six
 * cargoes with a maker and a carrier and a buyer, and four operators who
 * disagree about what they are doing - and NOTHING IN THE GAME REACHED ANY OF
 * IT. Every reader in that file had no caller outside the catalog's own index:
 * `artisansOf`, `cargoMadeBy`, `cargoCarriedBy`, `cargoOnLane`, `getSeaLane`,
 * `housesWithAWrittenCraft`, `lanesTouchingWater`, `whatEachProvinceMakes`.
 *
 * That file's own header says the trade layer exists so that goods have a
 * SOURCE - *merchants who conjure stock out of nowhere would be exactly the
 * parallel-system mistake AGENTS.md warns about* - and a player standing in a
 * market could not ask where a single thing on the counter came from. The
 * derivation was written, argued, and unreachable.
 *
 * ── WHAT THIS IS AND IS NOT ──────────────────────────────────────────────
 *
 * A READ. Nothing here moves a good, prices one, or spends a day: the market
 * verbs price things and this says where they come from. It is the same kind
 * of answer `whoAnswersForThisGround` gives about a claim - the world already
 * knows, and the player had no sentence for asking.
 *
 * It is deliberately NOT a shipping simulation, on the file's own warning:
 * *if a later change starts wanting a quantity per season, that is the moment
 * to stop and ask whether a second economy is being built.* There is no
 * quantity here and no season.
 *
 * ── THE FALLBACK IS THE ANSWER AND NOT A SHORTFALL ───────────────────────
 *
 * `artisansOf` returns a written row where a house's craft is specific and the
 * PROVINCE'S export list where it is not, and marks which it did. That is the
 * design made executable - *a Yellow Plain house with no row makes what the
 * Yellow Plain exports, because that is what there is to make on that ground
 * with those materials* - so a derived answer is reported as one rather than
 * being dressed up as a written craft or withheld.
 */

import {
    SEA_CARGO,
    SEA_TRADERS,
    artisansOf,
    cargoCarriedBy,
    cargoMadeBy,
    getSeaLane,
    housesWithAWrittenCraft,
    lanesTouchingWater,
    whatEachProvinceMakes
} from '../data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';

/** One workshop's answer, whether the row was written or derived. */
export interface AWorkshopHere {
    factionId: string;
    houseName: string;
    craft: string;
    makes: readonly string[];
    /** True where this is the province's list rather than a written row. */
    derivedFromProvince: boolean;
}

/** One thing that crosses the water, with the whole of why. */
export interface SomethingThatCrosses {
    what: string;
    /** The house whose artisans made it, or null for what the ground gives. */
    madeBy: string | null;
    carriedBy: string;
    direction: 'outbound' | 'inbound';
    laneName: string;
    days: number;
    /** How many places there are to stop. Zero is the thing that matters. */
    landfalls: number;
    boughtBy: string;
    whyByWater: string;
}

export interface WhatThisGroundMakes {
    provinceId: string | null;
    provinceName: string | null;
    /** The province's own export list, which is the artisan fallback. */
    makes: readonly string[];
    workshops: AWorkshopHere[];
    crossings: SomethingThatCrosses[];
    /** The operators on the water anybody here would name. */
    carriers: { houseName: string; whatKindOfOperator: string; whereItWillNotGo: string }[];
}

/** What the caller has to hand, so this opens no handle and reads no database. */
export interface GroundToRead {
    provinceId: string | null;
    provinceName: string | null;
    /** Every province's export list, so a caller can pass a test's own. */
    exports: readonly string[];
    /** Houses with a seat in this province, in the order they should be said. */
    housesHere: readonly { id: string; name: string }[];
    /** What a house is called, for the makers and carriers named on a cargo. */
    nameOfHouse: (factionId: string) => string;
}

/**
 * Everything this ground answers about what it makes and what leaves it.
 */
export function whatThisGroundMakes(ground: GroundToRead): WhatThisGroundMakes {
    const workshops: AWorkshopHere[] = [];
    for (const house of ground.housesHere) {
        const craft = artisansOf(house.id);
        if (!craft) continue;
        workshops.push({
            factionId: house.id,
            houseName: house.name,
            craft: craft.craft,
            makes: craft.makes,
            derivedFromProvince: craft.derivedFromProvince
        });
    }

    // What crosses on account of somebody standing here - either one of these
    // houses made it, or one of them is carrying it. A province with neither
    // is inland, which is a true and useful answer rather than an empty one.
    const mine = new Set(ground.housesHere.map(h => h.id));
    const crossings: SomethingThatCrosses[] = [];
    for (const cargo of SEA_CARGO) {
        const theirs = (cargo.madeByFactionId !== null && mine.has(cargo.madeByFactionId))
            || mine.has(cargo.carriedByFactionId);
        if (!theirs) continue;
        const lane = getSeaLane(cargo.laneId);
        crossings.push({
            what: cargo.what,
            madeBy: cargo.madeByFactionId === null
                ? null
                : ground.nameOfHouse(cargo.madeByFactionId),
            carriedBy: ground.nameOfHouse(cargo.carriedByFactionId),
            direction: cargo.direction,
            laneName: lane ? `${lane.fromPlace} to ${lane.toPlace}` : cargo.laneId,
            days: lane?.expectedDays ?? 0,
            landfalls: lane?.intermediateLandfallDays.length ?? 0,
            boughtBy: cargo.boughtBy,
            whyByWater: cargo.whyByWater
        });
    }

    const carriers = SEA_TRADERS
        .filter(t => mine.has(t.factionId))
        .map(t => ({
            houseName: ground.nameOfHouse(t.factionId),
            whatKindOfOperator: t.whatKindOfOperator,
            whereItWillNotGo: t.whereItWillNotGo
        }));

    return {
        provinceId: ground.provinceId,
        provinceName: ground.provinceName,
        makes: ground.exports,
        workshops,
        crossings,
        carriers
    };
}

/** The province's own list, for a caller that has only an id. */
export function whatAProvinceMakes(provinceId: string | null): readonly string[] {
    if (provinceId === null) return [];
    return whatEachProvinceMakes().find(p => p.regionId === provinceId)?.makes ?? [];
}

/**
 * The answer as a player hears it.
 *
 * ORDER IS THE POINT: the ground first, then who works it, then what leaves.
 * A player asking this is standing somewhere and wants to know what somewhere
 * is, and a list of hulls before a list of workshops answers a question they
 * did not ask.
 */
export function theLinesForWhatIsMadeHere(read: WhatThisGroundMakes): string[] {
    const lines: string[] = [];
    const where = read.provinceName ?? 'This ground';

    if (read.makes.length === 0) {
        lines.push(
            `${where} sends nothing anywhere that anybody has written down. What is here is `
            + 'consumed here, which is most ground in the world and is not a poverty.'
        );
    } else {
        // ONE PER LINE, BECAUSE AN EXPORT ROW IS A SENTENCE. The province list
        // is not a list of nouns - `regions.ts` writes each entry as a claim
        // with its own commas in it - so joining them with commas produces one
        // unreadable run. Said as separate lines they read as what they are.
        lines.push(
            `${where} makes ${read.makes.length} thing${read.makes.length === 1 ? '' : 's'} `
            + 'anybody would come for, and this is the province\'s own list. It is what a house '
            + 'here makes unless it makes something more particular.'
        );
        for (const made of read.makes) lines.push(`- ${made}`);
    }

    const written = read.workshops.filter(w => !w.derivedFromProvince);
    const derived = read.workshops.filter(w => w.derivedFromProvince);
    for (const shop of written) {
        lines.push(`${shop.houseName}: ${shop.craft}`);
    }
    if (derived.length > 0) {
        // NAMED UP TO A POINT. A busy province seats fifteen houses and every
        // one of them has kitchens; listing all fifteen is a wall that says
        // nothing, and saying none of them hides that most of the ground is
        // ordinary. The count carries what the names would have.
        const named = derived.slice(0, HOUSES_WORTH_NAMING).map(d => d.houseName);
        const rest = derived.length - named.length;
        lines.push(
            `${asAList(named)}${rest > 0 ? ` and ${rest} other house${rest === 1 ? '' : 's'}` : ''} `
            + `${derived.length === 1 ? 'has' : 'have'} workshops the way they have kitchens. `
            + 'Nothing particular comes out of them - what does is the province\'s list, which is '
            + 'what there is to make on this ground.'
        );
    }

    if (read.crossings.length === 0) {
        lines.push(
            'Nothing here goes by water. Whatever leaves this province leaves on a road, and '
            + 'pays whoever holds the road.'
        );
    }
    for (const crossing of read.crossings) {
        lines.push(
            `${crossing.direction === 'outbound' ? 'Out' : 'In'} on the water: ${crossing.what}. `
            + `${crossing.madeBy === null ? 'The ground gives it' : `${crossing.madeBy} makes it`}, `
            + `${crossing.carriedBy} carries it, ${crossing.days} days ${crossing.landfalls === 0
                ? 'with nowhere to stop'
                : `with ${crossing.landfalls} place${crossing.landfalls === 1 ? '' : 's'} to stop`}. `
            + `${crossing.whyByWater}`
        );
    }

    for (const carrier of read.carriers) {
        lines.push(`${carrier.houseName}, on the water: ${carrier.whatKindOfOperator} `
            + `Where it will not go: ${carrier.whereItWillNotGo}`);
    }

    return lines;
}

/** The mechanical line, which says which readings answered and which did not. */
export function theStructureOfWhatIsMadeHere(read: WhatThisGroundMakes): string {
    const written = read.workshops.filter(w => !w.derivedFromProvince).length;
    return `whatThisGroundMakes: province ${read.provinceId ?? 'none'}, `
        + `${read.makes.length} export(s); ${read.workshops.length} house(s) here, `
        + `${written} with a written craft and ${read.workshops.length - written} derived from `
        + `the province; ${read.crossings.length} cargo row(s) and ${read.carriers.length} `
        + `carrier(s). ${housesWithAWrittenCraft().length} house(s) in the world have a written `
        + `craft, and ${lanesTouchingWater().length} named lane(s) cross this water.`;
}

/** What one named house makes, wherever it is. Asked ABOUT rather than AT. */
export function whatThisHouseMakes(factionId: string, houseName: string): string[] {
    const craft = artisansOf(factionId);
    if (!craft) {
        return [`Nothing on the record says what ${houseName} makes, or where it sits to make it.`];
    }
    const made = cargoMadeBy(factionId);
    const carried = cargoCarriedBy(factionId);
    const lines = [`${houseName}: ${craft.craft}`];
    if (craft.makes.length > 0 && !craft.derivedFromProvince) {
        lines.push(`What comes out of it: ${asAList(craft.makes)}.`);
    }
    for (const cargo of made) {
        lines.push(`On the water under their mark: ${cargo.what}. ${cargo.boughtBy}`);
    }
    for (const cargo of carried) {
        lines.push(`They carry it: ${cargo.what}. ${cargo.whyByWater}`);
    }
    return lines;
}

/**
 * How many ordinary houses to name before counting the rest.
 *
 * Four, because that is about as many names as a person says in one breath
 * before the listener stops hearing them as names.
 */
const HOUSES_WORTH_NAMING = 4;

/** A list a person would say out loud. */
function asAList(items: readonly string[]): string {
    if (items.length === 0) return 'nothing';
    if (items.length === 1) return items[0]!;
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]!}`;
}
