/**
 * The town below a house's gate: everybody who wants something from it and
 * cannot walk in.
 *
 * A compound with nothing outside it leaves a refused visitor standing nowhere.
 * Measured on three pinned worlds before this existed: 38 seated houses each,
 * and `I travel to <house>` reached 0 of them - the seat is a world row named
 * `<house> grounds`, the house's own name reached nothing, and there was no
 * third place between the province road and the wall.
 *
 * DERIVED, NEVER AUTHORED. Same shape as `growCompound`: the house's own
 * columns decide how big the town is and what trades in it. A house that
 * recruits has applicants and the people it refused; a house that makes things
 * sells its seconds; a house whose arrays have gone dark is being quietly
 * stripped by the people at its foot. There is no `if (factionId === ...)` here
 * and there must never be one.
 *
 * WHAT IS STORED IS THE HOUSE'S ID AND NOTHING ELSE. The trades are a function
 * of the catalog row, so they are computed on every read rather than written
 * into `data` where they would drift from the house they describe.
 */

import { getSect, type SectEntry } from '../../data/cultivation/sects.js';
import { getProductionTier } from '../../data/cultivation/faction-character.js';
import { makeEnvironment, makeLocation, makeThresholds, type LocationRecord } from './locations.js';
import { ordinaryBandFor } from './qi-scale.js';

/** What marks a settlement as the one at a house's gate, and whose gate it is. */
export const THE_TAG_A_FOOT_TOWN_CARRIES = 'foot_town';

/** Stable id, so the seat and the town can each find the other. */
export const footTownId = (factionId: string): string => `loc-${factionId}-town`;

/**
 * The house's own columns, reduced to what the town reads.
 *
 * A narrow input rather than `CompoundInput`, because the town is read at play
 * time from the catalog and the compound is grown once at seeding time from the
 * world's own faction rows. Both shapes satisfy this one.
 */
export interface WhatTheTownIsBelow {
    factionId: string;
    factionName: string;
    alignment: 'righteous' | 'neutral' | 'demonic';
    ranks: readonly string[];
    admissionOrdinal: number;
    powerOrdinal: number;
    recruits: boolean;
    /**
     * 0..1. What it can still reliably produce against what it peaked at, which
     * is `inheritanceGap` read as a fraction. A working house makes a surplus
     * and a house living on what it inherited has little to put on a table.
     */
    stillWorking: number;
    /** 0..1, how much of its own compound still runs. */
    formationIntegrity: number;
    specialities: readonly string[];
}

/** The town's reading of a house, off the catalog. Null for a house nobody has. */
export function whatTheTownIsBelow(factionId: string): WhatTheTownIsBelow | null {
    const house = getSect(factionId);
    return house ? theTownReadingOf(house) : null;
}

/**
 * How much of its own peak a house can still reach, 0..1.
 *
 * `inheritanceGap` is the documented read and this is that gap as a share, so
 * there is no second opinion about what a house can make. A house with no
 * production record has said nothing, and half is the honest reading of
 * nothing.
 */
function stillWorkingShareOf(factionId: string, powerOrdinal: number): number {
    const tier = getProductionTier(factionId);
    if (!tier || powerOrdinal <= 0) return 0.5;
    return Math.max(0, Math.min(1, tier.reliableOrdinal / powerOrdinal));
}

function theTownReadingOf(house: SectEntry): WhatTheTownIsBelow {
    const nodes = house.compound.formationNodesTotal;
    return {
        factionId: house.id,
        factionName: house.name,
        alignment: house.alignment,
        ranks: house.ranks,
        admissionOrdinal: house.admissionOrdinal,
        powerOrdinal: house.powerOrdinal,
        recruits: house.recruits,
        stillWorking: stillWorkingShareOf(house.id, house.powerOrdinal),
        formationIntegrity: nodes > 0 ? house.compound.formationNodesLit / nodes : 0,
        specialities: house.specialities
    };
}

// HOW BIG IT IS

/**
 * How many people live at the gate.
 *
 * Four reasons to be there and each one is a column. The household the compound
 * cannot feed itself is the floor; the rest is what the house draws in.
 */
export function howManyLiveBelow(input: WhatTheTownIsBelow): number {
    const household = Math.max(20, Math.round(input.powerOrdinal * 6));
    // People come to be taken, and most of them are not, and a share of those
    // stay. A house that takes nobody draws none of this.
    const hopefuls = input.recruits ? Math.round(input.powerOrdinal * 9) : 0;
    // What it makes, it sells, and somebody stands outside selling it.
    const trade = Math.round(input.stillWorking * 500);
    // A house whose arrays are dark is a house being stripped, and stripping is
    // work. The gap is the draw, not the integrity.
    const scavenging = Math.round((1 - input.formationIntegrity) * 90);
    return household + hopefuls + trade + scavenging;
}

/**
 * What the ground outside the wall is worth to cultivate on.
 *
 * The floor of the scale, and deliberately: the vein is inside, which is most
 * of why the wall is there.
 */
const TOWN_QI_DENSITY = 1;

/** Village, town, city. A gate town is rarely the third. */
export type TownSize = 'village' | 'town' | 'city';

const A_TOWN_RATHER_THAN_A_VILLAGE = 300;
const A_CITY_RATHER_THAN_A_TOWN = 1_100;

export function howBigTheTownBelowIs(input: WhatTheTownIsBelow): TownSize {
    const heads = howManyLiveBelow(input);
    if (heads >= A_CITY_RATHER_THAN_A_TOWN) return 'city';
    return heads >= A_TOWN_RATHER_THAN_A_VILLAGE ? 'town' : 'village';
}

// WHAT IT IS CALLED

/**
 * The qualifier off the house's own name, without its type noun.
 *
 * Two words where the name has three or more, so the Azure Cloud Pavilion's
 * town is Azure Cloud and not Azure - which is the family register
 * `place-names.md` blesses, a client house and its patron sharing a word.
 * The type noun itself is dropped rather than matched against a list, because
 * the list lives in the parser layer and this is the engine.
 */
export function theWordsATownTakesFromItsHouse(factionName: string): string {
    const words = factionName.trim().replace(/^the\s+/i, '').split(/\s+/).filter(Boolean);
    if (words.length <= 1) return words.join(' ') || 'Gate';
    return words.slice(0, Math.min(2, words.length - 1)).join(' ');
}

/** Nouns in the size order they are reached for, then the rest as fallbacks. */
const SETTLEMENT_NOUN: Readonly<Record<TownSize, string>> = {
    village: 'Village',
    town: 'Town',
    city: 'City'
};

const NOUNS_IN_ORDER: readonly string[] = ['Village', 'Town', 'City', 'Ford'];

/**
 * What the town is called, avoiding a name the map already carries.
 *
 * A collision is not cosmetic: `buildLore` dedupes every mentionable by name,
 * and `place-names.md` records a settlement called Orchid Court swallowing the
 * house of that name. `taken` is the loose keys of everywhere that already
 * exists, and the caller supplies it.
 */
export function theNameOfTheTownBelow(
    input: WhatTheTownIsBelow,
    taken: ReadonlySet<string> = new Set()
): string {
    const words = theWordsATownTakesFromItsHouse(input.factionName);
    const first = SETTLEMENT_NOUN[howBigTheTownBelowIs(input)];
    const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    for (const noun of [first, ...NOUNS_IN_ORDER]) {
        const name = `${words} ${noun}`;
        if (!taken.has(key(name))) return name;
    }
    return `${words} Ford`;
}

// WHAT TRADES THERE

/** One trade standing at the gate, and why it is standing there. */
export interface ATradeAtTheGate {
    id: string;
    name: string;
    /** Factual. What is on the table. Never a narrator's sentence. */
    what: string;
}

/**
 * What is being sold and done outside the wall.
 *
 * Every row reads a column. The first three are true of any seated house: the
 * compound does not farm, the people it will not admit have to sleep somewhere,
 * and a house that wants anything says so on a wall.
 */
export function whatTradesBelow(input: WhatTheTownIsBelow): ATradeAtTheGate[] {
    const out: ATradeAtTheGate[] = [
        {
            id: 'grain',
            name: 'the grain and salt market',
            what: 'What the compound eats and does not grow, carted up daily.'
        },
        {
            id: 'inn',
            name: 'the inn',
            what: 'Where a cultivator from elsewhere sleeps, not being able to sleep inside.'
        },
        {
            id: 'notice-wall',
            name: 'the notice wall',
            what: 'What the house wants done, posted where somebody not of it can read it.'
        }
    ];

    if (input.recruits) {
        out.push({
            id: 'petition-scribe',
            name: 'the petition scribes',
            what: 'Men who write an application in the wording the gate accepts, for a fee.'
        });
        out.push({
            id: 'root-reader',
            name: 'the root readers',
            what: 'A copper to be told what your root is before the house tells you for nothing.'
        });
    }

    if (input.stillWorking >= 0.4) {
        out.push({
            id: 'seconds',
            name: 'the seconds stalls',
            what: `What the ${input.factionName} made and would not put its own mark on.`
        });
    }

    const specialities = new Set(input.specialities.map(word => word.toLowerCase()));
    if (specialities.has('alchemy') || specialities.has('support') || specialities.has('cultivation')) {
        out.push({
            id: 'pill-stalls',
            name: 'the pill stalls',
            what: 'Low-grade medicine, some of it made here and some of it carried out.'
        });
    }
    if (specialities.has('sword') || specialities.has('offense') || specialities.has('defense')) {
        out.push({
            id: 'smiths',
            name: 'the repair smiths',
            what: 'Edges reground and armour restrapped for people who train all day.'
        });
    }

    if (input.powerOrdinal >= 25) {
        out.push({
            id: 'second-hand-manuals',
            name: 'the second-hand manual tables',
            what: 'What people who came a long way sell when they are told to go home.'
        });
    }

    if (input.formationIntegrity < 0.5) {
        out.push({
            id: 'salvage',
            name: 'the salvage yard',
            what: 'Array stone off the dead nodes, sold by people nobody has stopped.'
        });
    }

    if (input.alignment === 'demonic') {
        out.push({
            id: 'no-questions',
            name: 'the back tables',
            what: 'Goods bought without a question about where they came from.'
        });
    }

    return out;
}

/**
 * Who is permanently standing here and is on nobody's roll.
 *
 * The other half of what makes this a place rather than a market. Same rule:
 * every line is a column, and a house that does not have the column does not
 * get the line.
 */
export function whoWaitsBelow(input: WhatTheTownIsBelow): string[] {
    const out: string[] = [];
    if (input.recruits) {
        out.push('People who were refused at the gate and have not gone home.');
        out.push(`Rogue cultivators waiting on work the ${input.factionName} posts and will not `
            + 'give to one of its own.');
    } else {
        out.push(`People who came to ask the ${input.factionName} for something and were never `
            + 'told which day to come back.');
    }
    // An outer rung is a rung whose people are allowed out, and their families
    // live where they can be visited.
    if (input.ranks.length >= 2) {
        out.push('Families of the outer disciples, who are let out and not let in.');
    }
    out.push('Servants the house retired, who know the inside and are no longer in it.');
    if (input.stillWorking >= 0.4 || input.powerOrdinal >= 25) {
        out.push('Merchants who followed the money and stayed.');
    }
    return out;
}

// THE PLACE ITSELF

/** Read back: whether this row is a gate town, and whose. */
export function theHouseAboveThisTown(location: LocationRecord): string | null {
    if (!location.tags.includes(THE_TAG_A_FOOT_TOWN_CARRIES)) return null;
    const id = (location.data as { factionId?: unknown }).factionId;
    return typeof id === 'string' && id.length > 0 ? id : null;
}

/** The gate town of a house, or null where the world seeded none. */
export function theTownBelow(
    locations: readonly LocationRecord[],
    factionId: string
): LocationRecord | null {
    const id = footTownId(factionId);
    return locations.find(row => row.id === id) ?? null;
}

/**
 * How far a house's gate stands above its own town.
 *
 * A day, and the same day for everybody, because what varies between houses is
 * the town and not the climb.
 */
export const DAYS_FROM_THE_TOWN_TO_THE_GATE = 1;

export interface TownBelowInput {
    /** The seat this town sits under. Its region is the town's parent. */
    seat: LocationRecord;
    /** The province the seat hangs off, which is also the town's. */
    regionId: string | null;
    house: WhatTheTownIsBelow;
    /** Loose keys of every place that already exists, for the name. */
    taken?: ReadonlySet<string>;
    presentDay: number;
}

/**
 * Grow the town at a house's foot.
 *
 * Pure: a record in, a record out, ready to push onto world state. Its qi is
 * the province's and not the compound's - the vein is inside the wall, which is
 * most of why the wall is there.
 */
export function growTheTownBelow(input: TownBelowInput): LocationRecord {
    const { house, seat } = input;
    const name = theNameOfTheTownBelow(house, input.taken ?? new Set());
    const heads = howManyLiveBelow(house);
    const town = makeLocation({
        id: footTownId(house.factionId),
        name,
        kind: 'settlement',
        layer: seat.layer,
        parentId: input.regionId ?? seat.parentId,
        description:
            `The town at the ${house.factionName}'s gate: everybody who wants something from `
            + 'the house and is not on its roll, living within sight of a wall they do not go '
            + 'through.',
        // Ordinary ground. The gate is a day up the road and the vein is behind it.
        ambient: ordinaryBandFor(TOWN_QI_DENSITY),
        qiDensity: TOWN_QI_DENSITY,
        // Anybody may stand here. That is the whole point of it.
        thresholds: makeThresholds(0, 0, 0, 0),
        hazards: [],
        affinities: [],
        environment: makeEnvironment({
            spiritualDensity: 0.01,
            danger: house.alignment === 'demonic' ? 0.3 : 0.15,
            resources: ['food', 'lodging', 'trade'],
            politicalControl: house.factionName,
            specialRules: [`the ${house.factionName} is a day above it`],
            historicalScars: []
        }),
        // Held in the sense the catalog means: cause trouble here and you deal
        // with the house. It is not inside their wall.
        controllingFactionId: house.factionId,
        // A town is not a secret. Nobody has to be told a market exists.
        discovered: true,
        tags: [THE_TAG_A_FOOT_TOWN_CARRIES, 'sect_town', house.recruits ? 'recruits' : 'closed'],
        data: {
            factionId: house.factionId,
            populationWeight: Math.max(1, Math.round(heads / 20)),
            catalogRegionId: typeof seat.data.catalogRegionId === 'string'
                ? seat.data.catalogRegionId
                : ''
        }
    });
    town.origin.fromDay = input.presentDay;
    return town;
}
