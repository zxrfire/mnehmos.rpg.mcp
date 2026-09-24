/**
 * A house's own people take work off its board, and are paid what the player
 * is paid for it.
 *
 * Ruled by the design owner: *"they ought to take them."* Merit came from
 * sendings, postings and teaching, which rarely reach the bottom of a roll, so
 * most outer disciples never earned any and stood held back.
 *
 * ONE BOARD AND ONE PRICE. Each reader reads `whatAHouseHasOnItsBoard` at their
 * own rung with the house's reach, exactly as a player does, and every notice
 * is priced by `dutyTermsFor`. Nothing here decides what work is worth.
 *
 * WHO READS IT. Somebody at nothing (`freeToTakeWork`: no running term, not
 * mending, not at a desk, not in a scene) whose own rung's work is wall work
 * (`howAnAskReaches`). Work at the top of a house comes by word of mouth, so the
 * readers are mostly the lower rungs without a rule about rungs. The house keeps
 * one host at its gate (`whatTheHouseCanSpare`).
 *
 * HOW MUCH. A notice puts `hands` people on the road (the reason's own column,
 * the one the summons path reads), so a house's work in a year is its notices
 * times their hands, lowest rungs served first. The board is generated per
 * read, so a notice is keyed by its id: two readers at one rung share it. It
 * holds no state across reads, so a notice taken here is not gone from the
 * player's board; nothing records a taking, and none is added for this.
 *
 * WHAT IT IS. An errand with a term, at the place the notice names (the same
 * draw the wall's own `placeFor` makes), with whoever took the same notice. A
 * notice whose place is the house's own seat is work done at the house - a
 * making - and nobody moves for it. The settled terms ride on a tag, as a
 * player's accepted duty carries its terms, and `bringHomeWhoeverIsDue` pays
 * them when the term closes, for either kind.
 *
 * DANGER. Read off the terms' own regard through `lostChance`, the reading a
 * sending uses, and ended through `theWorldLoses`. At the board's pitch rules a
 * notice is never pitched above its reader, so the chance is zero; the high-risk
 * tag on a rival's notice carries no rate anywhere and none is invented.
 *
 * MEASURED with `scripts/probe-do-disciples-take-work-off-the-board.ts`, seeds
 * shape-a, afford-a and demography, 500 years, both arms in one process, summed:
 *
 *                                        without        with
 *   outer disciples with 100+ merit        14%           71%
 *   outer disciples with any merit         39%           91%
 *   held back                             1031          1056
 *   walk-outs a century, bottom            185           125
 *                        middle            176           250
 *                        elder             185           189
 *   members on rungs 0 / 1 / 2       652/246/170   598/409/217
 *   elders per house                      2.80          2.68
 *   houses with an empty elder rung         58            76
 *   people above 29 / 35 / 41         64/29/11      73/31/15
 *
 * Both directions: the bottom now earns its first rung and fewer walk out, and
 * the rung above it fills and presses - held back does not fall and the middle
 * walks out more. The elder rungs thin slightly (62 to 66 empty at 300 years).
 */

import { forStream } from '../cultivation/rng.js';
import { dutyTermsFor, takeableOffAWall, type DutyTerms } from '../encounters/duties.js';
import { howAnAskReaches } from '../encounters/how-an-ask-reaches-somebody.js';
import {
    theReasonBehind,
    whatAHouseHasOnItsBoard
} from '../encounters/what-a-house-has-on-its-board.js';
import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import type { SendingReason } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { isGroundWithADoor, whatADoorAdmits } from './a-door-with-a-count-on-it.js';
import { circleCandidatesFor } from './gatherings.js';
import type { LocationRecord } from './locations.js';
import { isBelowTheLid } from './layers.js';
import {
    isAwayOnSomething,
    isTheWorldsToMove,
    setLocation,
    theWorldLoses,
    whereTheyGoBackTo,
    type NpcActivity,
    type NpcRecord
} from './npc-state.js';
import { howAHouseStandsForMoney } from './the-world-changing-on-its-own.js';
import { creditMerit, meritWith } from './what-a-house-counts-in-somebodys-favour.js';
import {
    isInTheAirFor,
    regionOf,
    whereThisPersonIsStanding,
    type TellerStanding
} from './what-people-are-saying.js';
import {
    aFindThisHouseCouldSendFor,
    forbiddenGroundInTheProvinceOf,
    groundAPartyCanBeSentTo,
    groundTheseHousesHold,
    lostChance,
    whatAHousesOwnErrandsBringBack,
    whatAnybodyCouldHaveOfTheGround,
    whatStandingOnItGives,
    whatTheAirCarriesOfTheGround,
    whatTheHouseCanSpare,
    whereASendingGoes,
    whereTheOpenGroundIs,
    whichHousesAReasonIsAbout,
    type HouseAsItStands,
    type OnTheRollForAnErrand
} from './who-goes-out-for-a-house-and-what-comes-back.js';
import type { FactionRecord, WorldState } from './world-state.js';
import {
    aSittingAtHomeIsTaken,
    freeForASittingAtHome,
    itsCommunicationTalismansRunLow,
    theDisciplesPostedToInternalAffairs
} from './what-a-house-hears-from-its-people-away.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SETTLED TERMS, AND PAYING THEM
// ─────────────────────────────────────────────────────────────────────────

const ON_BOARD_WORK = 'board-work|';

/** What was agreed when somebody took a notice: the house, the day it ends, the pay. */
export interface BoardWorkTerms {
    houseId: string;
    untilDay: number;
    contribution: number;
    stones: number;
}

function asTag(terms: BoardWorkTerms): string {
    return `${ON_BOARD_WORK}${terms.houseId}|${terms.untilDay}|${terms.contribution}|${terms.stones}`;
}

/** The board work this person is out on, ending on this day, or null. */
export function theBoardWorkTheyAreOn(
    npc: Pick<NpcRecord, 'tags'>,
    untilDay: number | null | undefined
): BoardWorkTerms | null {
    const tag = npc.tags.find(t => t.startsWith(ON_BOARD_WORK));
    if (!tag || untilDay === null || untilDay === undefined) return null;
    const [, houseId, until, contribution, stones] = tag.split('|');
    const terms: BoardWorkTerms = {
        houseId: houseId ?? '',
        untilDay: Number(until),
        contribution: Number(contribution),
        stones: Number(stones)
    };
    if (terms.untilDay !== untilDay || !Number.isFinite(terms.contribution) || !Number.isFinite(terms.stones)) {
        return null;
    }
    return terms;
}

/**
 * The row once a term of board work has closed: the terms paid where they are
 * still owed, and the tag gone. Null when this activity was not board work, so
 * the caller pays a term served its own way.
 *
 * Owed by the house the work was taken from. Somebody who has left it since is
 * owed nothing by the house they are in now.
 */
export function whatFinishingBoardWorkPays(npc: NpcRecord, doing: NpcActivity): NpcRecord | null {
    const terms = theBoardWorkTheyAreOn(npc, doing.untilDay);
    if (terms === null) return null;
    const cleared: NpcRecord = { ...npc, tags: npc.tags.filter(t => !t.startsWith(ON_BOARD_WORK)) };
    if (npc.factionId !== terms.houseId) return cleared;
    return {
        ...creditMerit(cleared, terms.contribution),
        spiritStones: Math.max(0, (cleared.spiritStones ?? 0) + terms.stones)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE HOUSE THE BOARD IS WRITTEN FROM
// ─────────────────────────────────────────────────────────────────────────

/** The ways a house's people could have come by the ground near them, built once a pass. */
interface HowTheGroundIsKnown {
    openGround: ReturnType<typeof whereTheOpenGroundIs>;
    knowsTheGround: (holderId: string, locationId: string) => ReturnType<ReturnType<typeof whatStandingOnItGives>>;
    cameBack: ReturnType<typeof whatAHousesOwnErrandsBringBack>;
}

function howTheGroundIsKnown(state: WorldState, day: number): HowTheGroundIsKnown {
    const region = new Map<string | null, string | null>();
    const regionFor = (locationId: string | null): string | null => {
        const had = region.get(locationId);
        if (had !== undefined) return had;
        const found = regionOf(state, locationId);
        region.set(locationId, found);
        return found;
    };
    const byId = new Map(state.npcs.map(n => [n.id, n] as const));
    const tellers = new Map<string, TellerStanding | null>();
    const tellerAt = (holderId: string): TellerStanding | null => {
        const had = tellers.get(holderId);
        if (had !== undefined) return had;
        const npc = byId.get(holderId);
        const built = npc ? whereThisPersonIsStanding(state, npc, regionFor) : null;
        tellers.set(holderId, built);
        return built;
    };
    return {
        openGround: whereTheOpenGroundIs(state.locations, day),
        knowsTheGround: whatAnybodyCouldHaveOfTheGround(
            whatStandingOnItGives(state.history.facts),
            whatTheAirCarriesOfTheGround({
                facts: state.history.facts,
                inTheAirFor: (fact, holderId) => {
                    const teller = tellerAt(holderId);
                    return teller !== null && isInTheAirFor(state, fact, teller, day);
                }
            })
        ),
        cameBack: whatAHousesOwnErrandsBringBack(state.history.facts)
    };
}

/**
 * The house, as the board a player reads takes it (`theHouseAsItStands` in
 * `src/web/encounters.ts`), and the find it knows of.
 */
function theHouseAsItStandsInTheWorld(
    state: WorldState,
    faction: FactionRecord,
    roll: readonly NpcRecord[],
    ground: HowTheGroundIsKnown
): { house: HouseAsItStands; findLocationId: string | null } {
    const find = aFindThisHouseCouldSendFor({
        ground: ground.openGround,
        houseId: faction.id,
        seatLocationId: faction.seatLocationId,
        roll: roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
        rankCount: faction.ranks.length,
        stageFor: ground.knowsTheGround,
        errands: ground.cameBack
    });
    return {
        house: {
            id: faction.id,
            name: faction.name,
            holdsGround: state.locations.some(l => l.controllingFactionId === faction.id),
            standing: faction.standing,
            hasAFind: find !== null,
            sitsDownWith: circleCandidatesFor(state, faction).map(f => f.id),
            standsNearForbiddenGround:
                forbiddenGroundInTheProvinceOf(state.locations, faction.seatLocationId),
            itsCommunicationTalismansRunLow: itsCommunicationTalismansRunLow(state, faction.id, roll.length),
            ...howAHouseStandsForMoney(state, faction)
        },
        findLocationId: find?.locationId ?? null
    };
}

/**
 * Where a notice sends whoever takes it: the draw the wall makes when it names
 * the place (`whereAPostingWouldSendThem` in `src/web/encounters.ts`), so the
 * people who took it are standing where it said.
 */
function whereTheNoticeSendsThem(
    state: WorldState,
    house: HouseAsItStands,
    seatLocationId: string | null,
    findLocationId: string | null,
    elsewhere: readonly string[],
    reason: SendingReason
): string | null {
    const about = whichHousesAReasonIsAbout(reason.needs, house);
    return whereASendingGoes({
        needs: reason.needs,
        fromLocationId: seatLocationId,
        theFind: findLocationId,
        seatsInPlay: about
            .map(id => state.factions.find(f => f.id === id && f.dissolvedOnDay === null)?.seatLocationId ?? null)
            .filter((id): id is string => id !== null),
        groundNearThem: groundTheseHousesHold(groundWorkCanTakeYouTo(state.locations), about),
        elsewhere,
        pick: count => forStream(house.id, 'posting_destination', reason.id)
            .int(0, Math.max(0, count - 1))
    });
}

/**
 * Everywhere but a door somebody is counting places at.
 *
 * At a held, counted door there is no going anyway (`whatADoorAdmits`): the
 * holder deals the places and a conclave picks who walks through. A notice off
 * a board is not a place, so work that drew such a door sent people through it
 * uncounted, from houses the holder dealt nothing to, and every one of them
 * read as a party the conclave chose. Measured on the conclave fixture in
 * `the-people-a-conclave-chose-walk-through.test.ts`: five people from the
 * house the holder refused, and three who went alone.
 */
function groundWorkCanTakeYouTo(locations: readonly LocationRecord[]): LocationRecord[] {
    return locations.filter(l => !isGroundWithADoor(l) || whatADoorAdmits({ ruin: l }).cell !== 'doled_out');
}

// ─────────────────────────────────────────────────────────────────────────
// WHO TAKES WHAT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Free to go and do something: on a roll and at nothing at all.
 *
 * Nothing, as `applyPostings` reads who a house can spare. Somebody at anything -
 * a term, a mending, a desk, a scene with somebody, their own practice, even
 * idling on purpose - is at it, and a house's errand does not pull them off it.
 * Measured on `shape-a`: at world open juniors are all at something; at fifty
 * years 166 of 258 on the bottom two rungs are at nothing.
 */
export function freeToTakeWork(npc: NpcRecord): boolean {
    if (npc.status !== 'alive' || !isBelowTheLid(npc) || !isTheWorldsToMove(npc)) return false;
    return npc.factionId !== null && npc.factionRankIndex >= 0 && npc.activity === null;
}

interface Taken {
    entry: EncounterEntry;
    reason: SendingReason;
    who: { at: number; terms: DutyTerms }[];
}

/**
 * The year's board work, taken. Returns how many people took a notice.
 */
export function peopleTakeWorkOffTheirHousesBoard(state: WorldState, year: number, day: number): number {
    const rolls = new Map<string, number[]>();
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (npc.status !== 'alive' || npc.factionId === null) continue;
        const roll = rolls.get(npc.factionId);
        if (roll) roll.push(i); else rolls.set(npc.factionId, [i]);
    }

    const elsewhere = groundAPartyCanBeSentTo(groundWorkCanTakeYouTo(state.locations));
    let ground: HowTheGroundIsKnown | null = null;
    let took = 0;

    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        const rankCount = faction.ranks.length;
        const roll = rolls.get(faction.id);
        if (rankCount === 0 || !roll) continue;
        const people = roll.map(i => state.npcs[i]!);

        let reach = 0;
        for (const n of people) reach = Math.max(reach, n.cultivation.realmOrdinal);

        const readers = roll.filter(i => {
            const npc = state.npcs[i]!;
            return freeToTakeWork(npc)
                && howAnAskReaches({ pitchOrdinal: npc.cultivation.realmOrdinal, reachOfTheHouse: reach }) === 'the_wall';
        });
        // A week's work at home is also read by whoever is free for that much.
        // See `aSittingAtHomeIsTaken`.
        if (readers.length === 0
            && !roll.some(i => freeForASittingAtHome(state.npcs[i]!, faction.seatLocationId))) continue;

        // NOT THE LAST HOST AT THE GATE. Asked of the whole roll, so somebody
        // who is staying anyway can be the one kept.
        const roster: OnTheRollForAnErrand[] = people
            .filter(n => isTheWorldsToMove(n))
            .map(n => ({
                id: n.id,
                name: n.name,
                ordinal: n.cultivation.realmOrdinal,
                rankIndex: n.factionRankIndex,
                locationId: n.locationId,
                committedUntilDay: n.activity && isAwayOnSomething(n.activity.kind)
                    ? n.activity.untilDay ?? null
                    : null
            }));
        const spare = new Set(whatTheHouseCanSpare({
            roster, rankCount, seatLocationId: faction.seatLocationId, onDay: day
        }).free.map(c => c.id));

        ground ??= howTheGroundIsKnown(state, day);
        const { house, findLocationId } = theHouseAsItStandsInTheWorld(state, faction, people, ground);

        // The lowest rungs first: they live on this work, and a notice's hands
        // run out on whoever comes to it last.
        const order = readers
            .filter(i => spare.has(state.npcs[i]!.id))
            .sort((a, b) => {
                const x = state.npcs[a]!, y = state.npcs[b]!;
                return x.factionRankIndex - y.factionRankIndex
                    || x.cultivation.realmOrdinal - y.cultivation.realmOrdinal
                    || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
            });

        const rng = forStream(state.seed, 'board-work', faction.id, year);
        const taken = new Map<string, Taken>();
        for (const at of order) {
            const npc = state.npcs[at]!;
            const ordinal = npc.cultivation.realmOrdinal;
            const membership = {
                factionId: faction.id,
                factionName: faction.name,
                rankIndex: npc.factionRankIndex,
                rankCount,
                contribution: meritWith(npc, faction.id)
            };
            // A wall reader is never the house's highest, so the rest of the
            // house reaches as far as the house does.
            const offers: { entry: EncounterEntry; reason: SendingReason; terms: DutyTerms }[] = [];
            for (const entry of whatAHouseHasOnItsBoard({
                house, ordinal, reachOfTheHouse: reach, reachOfTheRest: reach
            })) {
                const reason = theReasonBehind(entry.id);
                if (reason === null) continue;
                const terms = dutyTermsFor(entry, ordinal, membership, 'commission');
                if (howAnAskReaches({ pitchOrdinal: terms.pitchOrdinal, reachOfTheHouse: reach }) !== 'the_wall') continue;
                if (!takeableOffAWall(terms.regard.band)) continue;
                if ((taken.get(entry.id)?.who.length ?? 0) >= reason.hands) continue;
                // Cutting the house's slips is Internal Affairs work: its disciples
                // first, and anybody else able only where none is posted.
                if (reason.makes !== null) {
                    const posted = theDisciplesPostedToInternalAffairs(state, faction.id);
                    if (posted.length > 0 && !posted.includes(npc.id)) continue;
                }
                offers.push({ entry, reason, terms });
            }
            if (offers.length === 0) continue;

            const total = offers.reduce((sum, o) => sum + Math.max(0, o.entry.weight), 0);
            let roll = rng.next() * total;
            let chosen = offers[offers.length - 1]!;
            for (const offer of offers) {
                roll -= Math.max(0, offer.entry.weight);
                if (roll < 0) { chosen = offer; break; }
            }
            const had = taken.get(chosen.entry.id);
            if (had) had.who.push({ at, terms: chosen.terms });
            else taken.set(chosen.entry.id, { entry: chosen.entry, reason: chosen.reason, who: [{ at, terms: chosen.terms }] });
        }

        for (const { reason, who } of taken.values()) {
            const goingTo = whereTheNoticeSendsThem(
                state, house, faction.seatLocationId, findLocationId, elsewhere, reason);
            // WORK DONE AT THE HOUSE is a notice whose place is the house's own
            // seat: a making, not an errand. Nobody moves, the term is the work,
            // and the same close pays it.
            const atTheHouse = goingTo !== null && goingTo === faction.seatLocationId;
            const place = goingTo === null || atTheHouse
                ? null
                : state.locations.find(l => l.id === goingTo)?.name ?? null;
            const ids = who.map(w => state.npcs[w.at]!.id);
            const board = `the ${faction.name.replace(/^[Tt]he\s+/, '')}'s board`;
            for (const { at, terms } of who) {
                const row = state.npcs[at]!;
                const untilDay = day + terms.days;
                const moved = goingTo === null || atTheHouse ? row : setLocation(row, goingTo, day);
                const activity: NpcActivity = atTheHouse
                    ? {
                        kind: 'the_work_of_their_rank',
                        note: `At work taken off ${board}: ${reason.name.toLowerCase()}.`,
                        withIds: ids.filter(id => id !== row.id),
                        sinceDay: day,
                        untilDay,
                        // What the work makes, which is what it lands as at the close.
                        ...(reason.makes === null ? {} : { thingId: reason.makes })
                    }
                    : {
                        kind: 'out_with_a_party',
                        note: `Out on work off ${board}: `
                            + `${reason.name.toLowerCase()}${place === null ? '' : `, at ${place}`}.`,
                        withIds: ids.filter(id => id !== row.id),
                        sinceDay: day,
                        untilDay,
                        returnTo: whereTheyGoBackTo(row)
                    };
                state.npcs[at] = {
                    ...moved,
                    tags: [
                        ...moved.tags.filter(t => !t.startsWith(ON_BOARD_WORK)),
                        asTag({ houseId: faction.id, untilDay, contribution: terms.contribution, stones: terms.stones })
                    ],
                    activity,
                    updatedOnDay: day
                };
                took++;

                const lost = lostChance(terms.regard);
                if (lost > 0 && forStream(state.seed, 'board-work-lost', row.id, year).chance(lost)) {
                    const gone = theWorldLoses(
                        state.npcs[at]!, untilDay,
                        `Went out on ${reason.name.toLowerCase()} off the ${faction.name}'s board and did not come back.`
                    );
                    if (gone) state.npcs[at] = gone;
                }
            }
        }

        took += aSittingAtHomeIsTaken(state, {
            house, seatLocationId: faction.seatLocationId, roll, reach, day,
            alreadyTaken: entryId => taken.get(entryId)?.who.length ?? 0
        });
    }
    return took;
}
