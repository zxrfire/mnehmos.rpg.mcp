/**
 * A room at an inn: paid by the night, a meal with each night, and a roof while you stay in the place.
 *
 * Which places keep an inn is the occupation catalog's answer (`job-innkeeper`
 * and the settlements it lists), not a second list. The price is the board's
 * bed (a night, or a month) and a hot meal each night, priced the way `buy`
 * prices any board row, so a famine moves the meal up and the bed down. The
 * lodging is one flag, the place and the run day it is paid through; leaving the
 * place ends it (`endTheLodgingOnLeaving`). Who keeps the inn is read off the
 * people standing here (`who-keeps-a-counter-here.ts`).
 */

import { SATIETY_MAX, type Cultivator, type Run } from '../schema/cultivation.js';
import { getOccupation, getPrice, stonesForACashPrice } from '../data/cultivation/mortal-world.js';
import { localPrice, placesNextTo } from '../data/cultivation/regions.js';
import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import { standingOf } from '../server/consolidated/where-a-cultivator-is-standing.js';
import {
    clearFlag,
    readJsonFlag,
    writeFlag
} from '../server/consolidated/cultivation-support.js';
import { factsForRefusal, factsForToolResult, placeName } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { theKeeperAsTheyAreKnown, whoKeepsTheCounter, type ACounter } from './who-keeps-a-counter-here.js';

const FLAG_LODGED_AT = 'lodged_at';

interface Lodging {
    place: string;
    /** The first run day the room is no longer paid for. */
    paidThroughDay: number;
}

/** A phrase naming the inn or a room in it. */
export const AT_THE_INN = /\b(?:inns?|a room|the room|rooms? for the night|lodging|lodgings)\b/i;

/** Whether this place keeps an inn, by the settlements the innkeeper's trade lists. */
export function anInnIsKeptHere(cultivator: Cultivator): boolean {
    const kind = standingOf(cultivator).settlementKind;
    const trade = getOccupation('job-innkeeper');
    return kind !== null && trade !== undefined && (trade.settlements as readonly string[]).includes(kind);
}

/**
 * The inn as a look round sees it, with its price, or null where none is kept.
 * Played: "is there like an inn or somewhere i can crash tonight" was a look, and
 * the look never mentioned the inn standing in the square.
 */
export function theInnAsSeenHere(game: GameService, cultivator: Cultivator): string | null {
    if (!anInnIsKeptHere(cultivator)) return null;
    const bed = whatTheBedCostsHere(game, cultivator, 'price-inn-night');
    return `There is an inn here: a room is ${bed.cash} cash a night, and a meal ${bed.mealCash}.`;
}

/** The counters kept where they stand, for "the innkeeper" and "the clerk" to be read against. */
export function theCountersHere(cultivator: Cultivator): ACounter[] {
    return anInnIsKeptHere(cultivator) ? ['inn'] : [];
}

/** The lodging here, or null where they have none or it is somewhere they have left. */
export function whereTheyAreLodged(game: GameService, cultivator: Cultivator): Lodging | null {
    const lodging = readJsonFlag<Lodging>(game.db, cultivator.id, FLAG_LODGED_AT);
    return lodging && lodging.place === placeName(cultivator) ? lodging : null;
}

/** Leaving the place ends the lodging. */
export function endTheLodgingOnLeaving(game: GameService, cultivatorId: string, nowAt: string): void {
    const lodging = readJsonFlag<Lodging>(game.db, cultivatorId, FLAG_LODGED_AT);
    if (!lodging || lodging.place === nowAt) return;
    game.db.transaction(() => clearFlag(game.db, cultivatorId, FLAG_LODGED_AT))();
}

/** The two ways the board sells a bed, and the nights each is for. */
type ABed = 'price-inn-night' | 'price-month-lodging';
const NIGHTS_IN: Readonly<Record<ABed, number>> = { 'price-inn-night': 1, 'price-month-lodging': 30 };

/**
 * What the bed costs here, the way `buy` prices a board row (local rate, then the
 * ground's term), and the meal each night comes with, priced the same way.
 */
function whatTheBedCostsHere(game: GameService, cultivator: Cultivator, bed: ABed) {
    const regionId = standingOf(cultivator).regionId;
    const row = getPrice(bed)!;
    const meal = getPrice('price-meal')!;
    const ground = game.groundPriceMultiplier(cultivator, row.category);
    const cash = Math.max(1, Math.round(localPrice(regionId, row.cash) * ground));
    return {
        nights: NIGHTS_IN[bed],
        cash,
        mealCash: Math.max(1, Math.round(
            localPrice(regionId, meal.cash) * game.groundPriceMultiplier(cultivator, meal.category))),
        quote: game.whatThisCostsAndWhy(row, cash, stonesForACashPrice(cash), ground)
    };
}

/** The nearest place by road that does keep an inn, for a refusal to point at. */
function theNearestInnByRoad(cultivator: Cultivator): string | null {
    for (const next of placesNextTo(placeName(cultivator))) {
        if (anInnIsKeptHere({ ...cultivator, location: next.name })) {
            return `${next.name}, ${howMany(next.travelDays, 'day')} away, keeps one.`;
        }
    }
    return null;
}

/**
 * Take a room here for this many nights, paid now, with a meal each night.
 *
 * Nights already paid for are not paid again: a room taken for three nights on
 * a room held through tomorrow buys the two it lacks.
 */
export function takeARoom(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    nightsWanted: number,
    /**
     * `andTheTurn` false where the room is bought on the way into a stay that
     * counts the turn itself; `bed` is the board row it was asked for by.
     */
    options: { andTheTurn?: boolean; bed?: ABed } = {}
): Execution {
    const here = placeName(cultivator);
    if (!anInnIsKeptHere(cultivator)) {
        const nearest = theNearestInnByRoad(cultivator);
        return refused('engine.anInnIsKeptHere', 'buy', factsForRefusal(
            `There is no inn at ${here}.`,
            `${here} keeps no inn: nobody here lets a room by the night.${nearest ? ` ${nearest}` : ''}`,
            `a-room-at-an-inn: ${standingOf(cultivator).settlementKind ?? 'no settlement'} at ${here}; `
            + 'an inn is kept where job-innkeeper lists the settlement. Nothing spent, no time passed.'
        ));
    }

    const today = Math.floor(run.elapsedDays);
    const nights = Math.max(1, Math.floor(nightsWanted));
    const held = whereTheyAreLodged(game, cultivator);
    const paidFrom = Math.max(today, held?.paidThroughDay ?? today);
    const toBuy = Math.max(0, today + nights - paidFrom);
    const bed = whatTheBedCostsHere(game, cultivator, options.bed ?? 'price-inn-night');
    const cash = bed.cash * Math.ceil(toBuy / bed.nights) + bed.mealCash * toBuy;
    const stones = toBuy > 0 ? stonesForACashPrice(cash) : 0;
    const keeper = whoKeepsTheCounter(game, cultivator, 'inn', ['inn']);

    // ALREADY PAID FOR, AND SAID SO. Played: "crash for the night" bought "0 night(s)
    // for 0 cash" under a purchase headline, and the narrator slept the night that
    // never passed.
    if (toBuy === 0 && held !== null) {
        const facts = factsForToolResult('The room is already yours.', [
            `The room at the inn at ${here} is already yours through day ${held.paidThroughDay}; `
            + 'nothing more is bought.'
        ]);
        facts.structure.push(
            `a-room-at-an-inn: already paid through run day ${held.paidThroughDay}. `
            + 'Nothing bought, no time passed.'
        );
        return game.freeAction(run, 'buy', facts);
    }

    if (cultivator.spiritStones < stones) {
        return refused('engine.whatTheBedCostsHere', 'buy', factsForRefusal(
            'Not for what you are carrying.',
            `${bed.quote.join(' ')} A meal each night is ${bed.mealCash} cash. `
            + `${howMany(toBuy, 'night')} is ${cash} cash, which comes to ${howMany(stones, 'spirit stone')}; `
            + `you are carrying ${cultivator.spiritStones}.`,
            `a-room-at-an-inn: ${toBuy} night(s), ${cash} cash, against ${cultivator.spiritStones} stones. `
            + 'Nothing spent, no time passed.'
        ));
    }

    const paidThroughDay = paidFrom + toBuy;
    const fed = game.db.transaction((): Cultivator => {
        writeFlag(game.db, cultivator.id, FLAG_LODGED_AT, JSON.stringify({ place: here, paidThroughDay }));
        const updated = game.repos.cultivators.applyDeltas(cultivator.id, {
            spiritStones: -stones,
            satiety: SATIETY_MAX - cultivator.satiety,
            starvationTurns: -cultivator.starvationTurns
        });
        if (options.andTheTurn !== false) game.repos.runs.incrementTurn(run.id, 1);
        return updated ?? cultivator;
    })();

    const lines = [
        ...bed.quote,
        toBuy > 0
            ? `A room at the inn at ${here} for ${howMany(toBuy, 'night')}, with a meal each night at `
              + `${bed.mealCash} cash: ${cash} cash, ${howMany(stones, 'spirit stone')} paid, ${fed.spiritStones} left.`
            : `The room at the inn at ${here} is already paid for those nights.`,
        `The room is yours through day ${paidThroughDay} while you stay in ${here}. You have eaten; `
        + `the belly is at ${fed.satiety} of ${SATIETY_MAX}.`,
        ...(keeper ? [`${capitalised(theKeeperAsTheyAreKnown(game, cultivator, keeper, 'inn'))} keeps the inn and took the money.`] : [])
    ];
    const facts = factsForToolResult(`A room at ${here}.`, lines);
    facts.structure.push(
        `a-room-at-an-inn: ${toBuy} night(s) bought for ${cash} cash (the bed at ${bed.cash} for ${bed.nights} night(s), a meal at ${bed.mealCash}, local and ground terms), `
        + `${stones} stone(s); lodged at ${here} through run day ${paidThroughDay}. `
        + `Kept by ${keeper ? keeper.id : 'nobody standing here'}.`
    );
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{
            name: 'engine.takeARoom',
            action: 'buy',
            summary: `${toBuy} night(s) at ${here} for ${stones} stone(s); paid through day ${paidThroughDay}.`,
            ok: true
        }]
    };
}

function capitalised(said: string): string {
    return said.charAt(0).toUpperCase() + said.slice(1);
}
