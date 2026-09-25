/**
 * A ship at sea between two ports: where it is, how far on, and sailing the rest of the way.
 *
 * WHERE THE PASSENGER IS. A voyage that stops part-way leaves them aboard, not ashore. They
 * stand on a row of open water: the stretch the lane names past its commit point (the Bitter
 * Crossing on the eastern passage), and otherwise the row of the province that is sea
 * (`openWater` in the catalog). Open water's areas are a hull's decks
 * (`where-in-a-place-somebody-is-standing.ts`), so the people the world has on it are read in
 * three at a time like anywhere else. No row is written for a voyage: a new row moves the
 * demography (`the-town-at-the-foot-of-a-house.ts`), and every lane is on the one sea.
 *
 * WHAT THE VOYAGE IS lives in a flag, like a stopped road: the port it sailed from, where it is
 * bound, the days sailed of the days the weather made of the passage (`resolveCrossing`), the
 * hull's rations and the crew left. It holds only while they stand on that water; leaving it any
 * other way (a fold) leaves the flag stale, and it is read as no voyage.
 *
 * TIME ABOARD IS TIME THE SHIP SAILS. Carrying on, waiting and sitting aboard all sail it, on the
 * hull's rations and then the pack's, through whatever the water puts in its way. It turns back
 * only when a stop costs it the crew before the commit point (`canTurnBack`).
 */

import { REGIONS, regionIdOfPlace } from '../data/cultivation/regions.js';
import { canTurnBack, commitDayOf, type SeaLane } from '../engine/world/what-a-sea-crossing-costs.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { readJsonFlag, writeFlag, clearFlag } from '../server/consolidated/cultivation-support.js';
import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import { factsForRefusal, placeName, shownWithNoModelAfter, type EngineFacts } from './facts.js';
import { loosePlaceKey } from './knowledge.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { WAITING_FOCUS } from './turn-constants.js';

export interface AVoyage {
    /** The port it sailed from. */
    from: string;
    /** Where it is bound, which is the port it sailed from once it has turned back. */
    bound: string;
    lane: SeaLane;
    /** Days sailed so far. */
    sailed: number;
    /** Days the whole passage takes, weather included. */
    days: number;
    /** Days the landing quoted. */
    quoted: number;
    /** Days the hull's rations cover, counted from the quay. */
    hullRationDays: number;
    /** The crew who would fight for the ship. Nought once a stop has cost it them. */
    crew: number;
}

type Db = Parameters<typeof readJsonFlag>[0];

const A_VOYAGE_UNDER_WAY = 'a_voyage_under_way';

/**
 * The open water a voyage is on: the stretch its lane names, once past the commit point, and
 * otherwise the open-water province at one of its ends.
 */
export function theWaterUnder(voyage: Pick<AVoyage, 'from' | 'bound' | 'lane' | 'sailed'>): string | null {
    if (voyage.lane.water && voyage.sailed >= commitDayOf(voyage.lane)) return voyage.lane.water;
    const ends = [regionIdOfPlace(voyage.from), regionIdOfPlace(voyage.bound)];
    const water = REGIONS.find(region => region.openWater === true && ends.includes(region.id))
        ?? REGIONS.find(region => region.openWater === true);
    return water?.name ?? null;
}

/** The voyage they are on, or null where they are not aboard a ship at sea. */
export function theVoyageUnderWay(db: Db, cultivator: Cultivator): AVoyage | null {
    const voyage = readJsonFlag<AVoyage>(db, cultivator.id, A_VOYAGE_UNDER_WAY);
    if (voyage === null) return null;
    const water = theWaterUnder(voyage);
    return water !== null && loosePlaceKey(placeName(cultivator)) === loosePlaceKey(water) ? voyage : null;
}

export function writeTheVoyage(db: Db, cultivatorId: string, voyage: AVoyage): void {
    writeFlag(db, cultivatorId, A_VOYAGE_UNDER_WAY, JSON.stringify(voyage));
}

export function endTheVoyage(db: Db, cultivatorId: string): void {
    clearFlag(db, cultivatorId, A_VOYAGE_UNDER_WAY);
}

/**
 * Days of the hull's rations left for somebody aboard a ship at sea, counted from the quay; 0
 * ashore. What eating aboard draws on before the pack.
 */
export function theRationsAboard(db: Db, cultivator: Cultivator): number {
    const voyage = theVoyageUnderWay(db, cultivator);
    return voyage ? Math.max(0, voyage.hullRationDays - voyage.sailed) : 0;
}

/** What the water is called. */
export function thePassageOf(lane: SeaLane): string {
    return lane.name ?? `the water between ${lane.fromPlace} and ${lane.toPlace}`;
}

/** Where the ship is, as the sheet and a look say it. */
export function whereTheShipIs(voyage: AVoyage): string {
    return `At sea on ${thePassageOf(voyage.lane)}, day ${voyage.sailed} of ${voyage.days}, bound for ${voyage.bound}.`;
}

/**
 * A look or the sheet, aboard: the place line becomes where the ship is, and where the facts
 * have no place line of their own, it goes first.
 */
export function sayWhereTheShipIs(facts: EngineFacts, where: string, voyage: AVoyage): void {
    const said = whereTheShipIs(voyage);
    const placeLine = `${where}.`;
    if (!facts.lines.includes(placeLine)) {
        facts.lines.unshift(said);
        facts.prose = facts.prose.length > 0 ? `${said}\n\n${facts.prose}` : said;
        return;
    }
    facts.lines = facts.lines.map(line => (line === placeLine ? said : line));
    if (facts.headline === placeLine) facts.headline = said;
    facts.prose = facts.prose.startsWith(placeLine) ? `${said}${facts.prose.slice(placeLine.length)}` : `${said}\n\n${facts.prose}`;
}

/**
 * The voyage after a span at sea: the days sailed, the crew, and whether it turns back. A ship
 * turns back only when it has to, which is a stop that cost it the crew while going back is
 * still the shorter way.
 */
export function theVoyageAfter(
    voyage: AVoyage,
    sailed: number,
    crewLost: boolean
): { voyage: AVoyage; turnedBack: boolean } {
    const on = { ...voyage, sailed, crew: crewLost ? 0 : voyage.crew };
    if (!crewLost || voyage.bound === voyage.from || !canTurnBack(voyage.lane, sailed)) {
        return { voyage: on, turnedBack: false };
    }
    return { voyage: { ...on, bound: voyage.from, days: sailed * 2 }, turnedBack: true };
}

/** Said where a sentence would take them off a ship at sea. */
export function stillAtSea(voyage: AVoyage, action: string): Execution {
    return refused('engine.theVoyageUnderWay', action, factsForRefusal(
        'You are at sea.',
        `${whereTheShipIs(voyage)} It puts in nowhere before ${voyage.bound}; time spent aboard is time it sails.`,
        `a-ship-at-sea: ${action} refused aboard, ${voyage.sailed} of ${voyage.days} day(s) sailed. Nothing spent.`
    ));
}

/** How the days aboard are spent. */
export type HowTheDaysAboardGo = 'carrying_on' | 'waiting' | 'sitting';

/**
 * The ship sails on: the rest of the way, or the days asked where that is fewer. Where more
 * days were asked than are left, the span ends in port and says so.
 */
export async function aShipSailsOn(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    voyage: AVoyage,
    asked: number | null,
    how: HowTheDaysAboardGo
): Promise<Execution> {
    const left = Math.max(1, voyage.days - voyage.sailed);
    const days = asked === null ? left : Math.max(1, Math.min(left, Math.floor(asked)));
    const sailed = await game.takeTheSeat(run, cultivator, {
        service: 'ship',
        to: voyage.bound,
        days,
        walkingDays: left,
        stones: 0,
        escort: voyage.crew,
        bought: `Aboard the ship bound for ${voyage.bound}, from day ${voyage.sailed} of ${voyage.days}.`,
        sea: voyage,
        ...(how === 'waiting' ? { focus: WAITING_FOCUS } : how === 'sitting' ? { focus: 1 } : {})
    });
    if (asked !== null && asked > left && sailed.outcome === 'executed'
        && loosePlaceKey(placeName(game.repos.cultivators.getById(cultivator.id) ?? cultivator))
            === loosePlaceKey(voyage.bound)) {
        shownWithNoModelAfter(sailed.facts, `${howMany(Math.floor(asked), 'day')} were asked for; the ship `
            + `put in at ${voyage.bound} after ${howMany(left, 'day')}, and the ${how === 'sitting' ? 'sitting' : 'wait'} `
            + 'ended there.');
    }
    return sailed;
}
