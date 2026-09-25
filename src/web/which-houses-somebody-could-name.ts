/**
 * Asking somebody which houses there are.
 *
 * Answered out of the houses THE PERSON ASKED knows of - their own, and what
 * `whatSomebodyKnowsOfTheLand` gives somebody from where they live - and never
 * out of the asker's own list. Played: "does anyone know the
 * strongest sect i may visit?" was answered with the player's own 38 known
 * houses, and nobody in the square was asked.
 */

import {
    A_HOUSE_NAME_IS_SAID,
    A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL
} from './what-a-house-is-called.js';

/**
 * The canonical topic the parser emits. Inside `[a-z ]` for the same reason the
 * self-fact topics are: the topic sanitiser strips anything else.
 */
export const A_TOPIC_ABOUT_THE_HOUSES_THEY_KNOW = 'which houses they know';

/** How many one person names. A person asked is not a register. */
export const HOUSES_ONE_PERSON_NAMES = 3;

/**
 * A kind of house rather than one: "a sect", "the strongest sect I may
 * visit", "sects around here". A tail after the noun must be about place or
 * purpose, so "the sect library" is not a question about houses.
 */
const A_KIND_OF_HOUSE = new RegExp(
    String.raw`^(?:(?:the|a|an|any|some|which|what|other|good|great|big|biggest|strong|stronger|strongest|best|powerful|most|famous|nearest|near|nearby|local|righteous|demonic|orthodox|few|many)\s+)*`
    + String.raw`(?:${A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL})`
    + String.raw`(?:\s+(?:around|near|nearby|here|close|about|in|of|i|we|to|that|which|worth|you|one|for|are|is|there)\b.*)?$`,
    'i'
);

/** Whether a topic asks which houses there are, rather than about one. */
export function asksWhichHousesTheyKnow(topic: string): boolean {
    const said = topic.trim().toLowerCase().replace(/[?.!]+$/, '').trim();
    if (said === A_TOPIC_ABOUT_THE_HOUSES_THEY_KNOW) return true;
    if (A_HOUSE_NAME_IS_SAID.test(said)) return false;
    return A_KIND_OF_HOUSE.test(said);
}

export interface AHouseTheyMightName {
    id: string;
    name: string;
    seatLocationId: string | null;
    controlledLocationIds: readonly string[];
}

export interface AHouseTheyNamed {
    id: string;
    name: string;
    because: 'their own house' | 'holds the ground they stand on' | 'heard of';
    /** `placed`: they can give the way to its gate. `named`: the name only. */
    stage: 'placed' | 'named';
}

/**
 * The houses this person names, their own first, then whoever holds the ground
 * under them, then the rest in the world's order. `whatTheyKnow` is the world's
 * read of what they know of a house; this decides only the order and the cap.
 */
export function theHousesTheyWouldName(input: {
    houses: readonly AHouseTheyMightName[];
    theirHouseId: string | null;
    standingOn: string | null;
    whatTheyKnow: (houseId: string) => 'placed' | 'named' | null;
    atMost?: number;
}): AHouseTheyNamed[] {
    const holdsWhereTheyStand = (house: AHouseTheyMightName): boolean =>
        input.standingOn !== null
        && (house.seatLocationId === input.standingOn
            || house.controlledLocationIds.includes(input.standingOn));
    const named: AHouseTheyNamed[] = [];
    for (const house of input.houses) {
        const own = house.id === input.theirHouseId;
        const stage = own ? 'placed' : input.whatTheyKnow(house.id);
        if (stage === null) continue;
        named.push({
            id: house.id,
            name: house.name,
            because: own ? 'their own house' : holdsWhereTheyStand(house) ? 'holds the ground they stand on' : 'heard of',
            stage
        });
    }
    const rank = { 'their own house': 0, 'holds the ground they stand on': 1, 'heard of': 2 };
    return named
        .map((house, at) => ({ house, at }))
        .sort((a, b) => rank[a.house.because] - rank[b.house.because]
            || (a.house.stage === b.house.stage ? 0 : a.house.stage === 'placed' ? -1 : 1)
            || a.at - b.at)
        .map(({ house }) => house)
        .slice(0, input.atMost ?? HOUSES_ONE_PERSON_NAMES);
}

/** The engine's lines for what they named. Facts, one per house worth a reason. */
export function whatTheySaidOfTheHouses(who: string, named: readonly AHouseTheyNamed[]): string[] {
    if (named.length === 0) return [`${who} cannot name any house.`];
    const listed = (names: readonly string[]): string => names.length === 1
        ? names[0]!
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    const own = named.find(house => house.because === 'their own house');
    const ground = named.find(house => house.because === 'holds the ground they stand on');
    const theWay = named.filter(house => house.because === 'heard of' && house.stage === 'placed');
    const nameOnly = named.filter(house => house.because === 'heard of' && house.stage === 'named');
    return [
        `${who} names ${named.length === 1 ? 'one house' : 'the houses they know of'}: `
            + `${listed(named.map(house => house.name))}.`,
        ...(own ? [`${own.name} is ${who}'s own house.`] : []),
        ...(ground ? [`${ground.name} holds the ground ${who} stands on.`] : []),
        ...(theWay.length > 0
            ? [`${who} gives the way to the gate${theWay.length > 1 ? 's' : ''} of `
                + `${listed(theWay.map(house => house.name))}.`]
            : []),
        ...(nameOnly.length > 0
            ? [`${who} knows ${listed(nameOnly.map(house => house.name))} by name only, and not the way.`]
            : [])
    ];
}
