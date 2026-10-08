import { competitionBoardKey, witnessIndexFor } from './witness-reaction-index.js';
import { drawBackgroundIncidents, isPlayerInvolved, resolveWithPlayerPresent } from './background-incident-draw.js';
/** Open boards use the same realm brackets and power reading as closed gatherings. */
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { rankAField, type GatheringPlacing } from './gatherings.js';
import { theDayItFallsIn } from './a-competition-anybody-may-enter.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact, whoWasThere } from './who-was-there-when-it-happened.js';
import { isTheWorldsToMove, setLocation, type NpcRecord } from './npc-state.js';
import { howAnEntrantIsAnnounced } from './how-an-entrant-is-announced.js';
import { realmForOrdinal, realmIndexOf } from '../cultivation/realms.js';
import { theirFaceMoves, whatWinningIsWorth, whatLosingCosts } from './what-a-face-is-worth.js';
import { whatAContestIsWorthToThePeopleInIt } from './what-a-contest-is-worth-to-the-people-in-it.js';
import { regionCatalogIdOf } from './how-a-cultivator-comes-by-a-road.js';
import { getLocation, getNpc, indexById, type WorldState, type FactionRecord } from './world-state.js';
import { capitalCalendar, journeySelectedToHouseSeat } from './capital-missions-and-calendar.js';
import { theHouseWasSeenToWin } from './what-being-seen-to-do-well-is-worth.js';
import { feederHousesFor } from './what-a-house-answers-to.js';
import { handOverExchangeConsignment, hasExchangeConsignment } from './wares-at-a-capital-exchange.js';
import { vacanciesOnTheRolls } from './a-house-takes-in-one-of-its-own.js';
import { locationOnNpcJourney } from './places-on-the-way.js';
import { routeQueriesFor } from './locations.js';

function entriesFor(state: WorldState, hostId: string, day: number, venueId: string): HistoricalFact[] {
    const host = state.factions.find(h => h.id === hostId);
    const key = competitionBoardKey(hostId, day, venueId, venueId !== host?.seatLocationId);
    return [...witnessIndexFor(state).competitions.get(key)?.entries ?? []];
}

export function enterAnOpenCompetition(state: WorldState, host: FactionRecord, entrant: NpcRecord,
    contestDay: number, onDay: number, venueId = host.seatLocationId): HistoricalFact | null {
    if (!venueId || onDay > contestDay || entrant.status !== 'alive'
        || (venueId === host.seatLocationId && entrant.factionId !== host.id)) return null;
    if (witnessIndexFor(state).competitions.get(competitionBoardKey(host.id, contestDay, venueId,
        venueId !== host.seatLocationId))?.closed) return null;
    if (entriesFor(state, host.id, contestDay, venueId).some(f => f.actors.some(a => a.id === entrant.id))) return null;
    return recordEntry(state, host, entrant, contestDay, onDay, venueId);
}

function recordEntry(state: WorldState, host: FactionRecord, entrant: NpcRecord,
    contestDay: number, onDay: number, venueId: string,
    people?: readonly NpcRecord[]): HistoricalFact {
    const venueName = getLocation(state, venueId)?.name ?? host.name;
    const visibility = venueId === host.seatLocationId ? 'faction' : 'public';
    return appendWorldFact(state, makeFact({ day: onDay, kind: 'said_in_public', visibility,
        summary: `${entrant.name} entered the ${venueId === host.seatLocationId ? 'internal' : 'public'} competition at ${venueName}.`,
        actors: [{ id: entrant.id, name: entrant.name, role: 'entrant' }], factionIds: [host.id],
        locationId: venueId, data: { openCompetition: true, entry: true, hostId: host.id, contestDay,
            venueId, capitalCompetition: venueId !== host.seatLocationId },
        witnessIds: people ? whoWasThere(state, { day: onDay, locationId: venueId,
            actorIds: [entrant.id], visibility, factionIds: [host.id] }, people) : [] }));
}

/** Due boards and their entry records are world facts; reading a result never rerolls it. */
export function settleOpenCompetitions(state: WorldState, fromDay: number, toDay: number,
    playerAt?: { id: string; locationId: string | null }, scheduledHostId?: string): HistoricalFact[] {
    return resolveWithPlayerPresent(state, playerAt?.locationId ?? undefined,
        () => settleTheOpenCompetitions(state, fromDay, toDay, playerAt, scheduledHostId));
}

function settleTheOpenCompetitions(state: WorldState, fromDay: number, toDay: number,
    playerAt?: { id: string; locationId: string | null }, scheduledHostId?: string): HistoricalFact[] {
    const results: HistoricalFact[] = [];
    const key = (host: FactionRecord, day: number, venue: string) =>
        competitionBoardKey(host.id, day, venue, venue !== host.seatLocationId);
    const index = witnessIndexFor(state);
    const closed = new Set([...index.competitions].filter(([, board]) => board.closed).map(([board]) => board));
    const entries = new Map<string, HistoricalFact[]>();
    for (const board of index.pendingCompetitions) {
        const held = index.competitions.get(board)!;
        if (held.entries.length > 0) entries.set(board, [...held.entries]);
    }
    const pending = new Map<string, Map<string, { day: number; venueId: string }>>();
    for (const [board, rows] of entries) {
        if (closed.has(board)) continue;
        const host = String(rows[0]!.data.hostId);
        const day = Number(rows[0]!.data.contestDay);
        if (day > toDay) continue;
        const dates = pending.get(host) ?? new Map<string, { day: number; venueId: string }>();
        dates.set(board, { day, venueId: String(rows[0]!.data.venueId ?? state.factions.find(h => h.id === host)?.seatLocationId) });
        pending.set(host, dates);
    }
    const capitalDates = Array.from({ length: Math.floor(toDay / DAYS_PER_YEAR) - Math.floor(fromDay / DAYS_PER_YEAR) + 1 },
        (_, i) => capitalCalendar(state, Math.floor(fromDay / DAYS_PER_YEAR) + i)).flat();
    for (const host of state.factions) {
        if (host.dissolvedOnDay !== null || !host.seatLocationId
            || scheduledHostId !== undefined && host.id !== scheduledHostId) continue;
        const dates = pending.get(host.id) ?? new Map<string, { day: number; venueId: string }>();
        for (let year = Math.floor(fromDay / DAYS_PER_YEAR); year <= Math.floor(toDay / DAYS_PER_YEAR); year++) {
            for (const occasion of capitalDates) {
                if (occasion.kind === 'competition' && occasion.hostId === host.id
                    && Math.floor(occasion.onDay / DAYS_PER_YEAR) === year
                    && occasion.onDay >= fromDay && occasion.onDay <= toDay) {
                    dates.set(key(host, occasion.onDay, occasion.venueId), { day: occasion.onDay, venueId: occasion.venueId });
                }
            }
            const day = theDayItFallsIn(state.seed, host, year);
            if (day !== null && day >= fromDay && day <= toDay) dates.set(key(host, day, host.seatLocationId), { day, venueId: host.seatLocationId });
        }
        for (const { day, venueId } of dates.values()) {
            if (closed.has(key(host, day, venueId))) continue;
            const entryRows = entries.get(key(host, day, venueId)) ?? [];
            const capitalBoard = venueId !== host.seatLocationId;
            const venueName = state.locations.find(l => l.id === venueId)?.name ?? host.name;
            const registered = new Set(entryRows.flatMap(f => f.actors.map(a => a.id)));
            // The player row deliberately stands nowhere; the sheet supplies attendance after the span.
            if (!playerAt && state.npcs.some(n => !isTheWorldsToMove(n) && registered.has(n.id))) continue;
            const region = capitalBoard ? null : regionCatalogIdOf(state, host.seatLocationId);
            const regions = new Map<string | null, string | null>();
            const regionFor = (place: string | null) => {
                if (!regions.has(place)) regions.set(place, regionCatalogIdOf(state, place));
                return regions.get(place)!;
            };
            const attendance = new Map<string | null, boolean>();
            const routes = routeQueriesFor(state.locations);
            const positions = new Map<string, string | null>();
            const positionOf = (npc: NpcRecord) => {
                if (!positions.has(npc.id)) positions.set(npc.id, locationOnNpcJourney(state.locations, npc, day, routes));
                return positions.get(npc.id) ?? null;
            };
            const isHere = (npc: NpcRecord) => {
                let place = npc.id === playerAt?.id ? playerAt.locationId
                    : positionOf(npc);
                const stored = place;
                if (attendance.has(stored)) return attendance.get(stored)!;
                for (let hops = 0; place && hops < 8; hops++) {
                    if (place === venueId) { attendance.set(stored, true); return true; }
                    place = getLocation(state, place)?.parentId ?? null;
                }
                attendance.set(stored, false);
                return false;
            };
            const present = state.npcs.filter(n => n.status === 'alive' && isHere(n));
            const atVenue = state.npcs.filter(n => positionOf(n) === venueId);
            const candidates = capitalBoard
                ? present.filter(isTheWorldsToMove)
                : state.npcs.filter(n => isTheWorldsToMove(n) && n.status === 'alive'
                    && n.factionId === host.id && !n.activity
                    && region !== null && regionFor(n.locationId) === region);
            const rng = forStream(state.seed, 'competition-entrants', host.id, venueId, day);
            const rateFor = (npc: NpcRecord) => capitalBoard
                ? npc.goals.some(g => g.status === 'active' && g.kind === 'status') ? 0.7 : 0.35
                : 0.2;
            const exact = new Set(candidates.filter(n => isPlayerInvolved(state, n)));
            const entrants = playerAt && present.some(n => n.id === playerAt.id)
                ? candidates.filter(n => rng.chance(rateFor(n)))
                : [...exact].filter(n => forStream(state.seed, 'competition-exact-entrant', host.id, venueId, day, n.id).chance(rateFor(n)))
                    .concat(drawBackgroundIncidents(candidates.filter(n => !exact.has(n))
                        .map(value => ({ value, rate: rateFor(value) })), rng, 8));
            const arriving = new Set<string>();
            for (const npc of entrants) {
                if (registered.has(npc.id)) continue;
                entryRows.push(recordEntry(state, host, npc, day, day, venueId, atVenue));
                registered.add(npc.id);
                arriving.add(npc.id);
            }
            const field = [...registered].map(id => getNpc(state, id))
                .filter((n): n is NpcRecord => n !== null && n.status === 'alive'
                    && (capitalBoard || n.factionId === host.id)
                    && (isHere(n) || arriving.has(n.id)))
                .sort((a, b) => indexById(state.npcs, a.id) - indexById(state.npcs, b.id));
            const away = new Map(field.filter(isTheWorldsToMove).map(n => [n.id, n.locationId]));
            for (const npc of field.filter(isTheWorldsToMove)) {
                const at = indexById(state.npcs, npc.id);
                state.npcs[at] = setLocation(state.npcs[at]!, venueId, day);
            }
            const placings: GatheringPlacing[] = [];
            rankAField(state, field, forStream(state.seed, 'open-competition-board', host.id, day), placings);
            const spectators = [...new Map([...atVenue, ...field].map(n => [n.id, getNpc(state, n.id)!])).values()];
            const board = placings.map(p => ({ npcId: p.npcId, place: p.place,
                fieldSize: placings.filter(q => q.bracket === p.bracket).length }));
            const learned = whatAContestIsWorthToThePeopleInIt(board);
            if (capitalBoard) for (const houseId of new Set(placings.filter(p => p.place === 1
                && placings.filter(q => q.bracket === p.bracket).length > 1)
                .map(p => field.find(n => n.id === p.npcId)?.factionId).filter((id): id is string => !!id))) {
                theHouseWasSeenToWin(state, houseId, field.length, day);
            }
            for (const placing of placings) {
                const npc = getNpc(state, placing.npcId)!;
                const peers = field.filter(n => realmIndexOf(n.cultivation.realmOrdinal) === realmIndexOf(npc.cultivation.realmOrdinal));
                const winner = placings.find(p => p.bracket === placing.bracket && p.place === 1)!;
                const winnerNpc = getNpc(state, winner.npcId)!;
                if (peers.length > 1) theirFaceMoves(state, npc.id, placing.place === 1
                    ? whatWinningIsWorth({ winnerOrdinal: npc.cultivation.realmOrdinal,
                        loserOrdinal: peers.find(p => p.id !== npc.id)!.cultivation.realmOrdinal, witnesses: field.length })
                    : -whatLosingCosts({ loserOrdinal: npc.cultivation.realmOrdinal, winnerOrdinal: winnerNpc.cultivation.realmOrdinal, witnesses: field.length }), day);
                const at = indexById(state.npcs, npc.id);
                if (isTheWorldsToMove(npc)) state.npcs[at] = { ...state.npcs[at]!, cultivation: {
                    ...state.npcs[at]!.cultivation, accumulatingSinceDay: npc.cultivation.accumulatingSinceDay
                        - (learned.find(l => l.npcId === npc.id)?.days ?? 0) } };
                results.push(appendWorldFact(state, makeFact({ day, kind: 'gathering', scale: capitalBoard ? 'regional' : 'local',
                    summary: `${howAnEntrantIsAnnounced({ name: npc.name,
                        houseName: state.factions.find(f => f.id === npc.factionId)?.name ?? null })} placed ${placing.place} in the ${realmForOrdinal(npc.cultivation.realmOrdinal).name} board at ${venueName}.`,
                    locationId: venueId, factionIds: [...new Set([host.id, ...field.map(n => n.factionId).filter((id): id is string => id !== null)])],
                    visibility: capitalBoard ? 'public' : 'faction', magnitude: capitalBoard ? 0.45 : 0.2,
                    actors: [{ id: npc.id, name: npc.name, role: 'entrant' }],
                    witnessIds: whoWasThere(state, { day, locationId: venueId,
                        actorIds: [npc.id], visibility: capitalBoard ? 'public' : 'faction',
                        scale: capitalBoard ? 'regional' : 'local', factionIds: [host.id] }, spectators),
                    data: { openCompetition: true, result: true, hostId: host.id, contestDay: day, venueId, capitalCompetition: capitalBoard, internalCompetition: !capitalBoard,
                        place: placing.place, bracket: placing.bracket, fieldSize: peers.length,
                        trainingDays: learned.find(l => l.npcId === npc.id)?.days ?? 0 } })));
            }
            for (const [id, home] of away) {
                const at = indexById(state.npcs, id);
                state.npcs[at] = setLocation(state.npcs[at]!, home, day);
            }
            if (capitalBoard) {
                const clients = new Set(feederHousesFor(host, state.factions).map(home => home.id));
                const eligible = placings.filter(p => p.place === 1
                    && placings.filter(other => other.bracket === p.bracket).length > 1)
                    .map(p => state.npcs.find(n => n.id === p.npcId))
                    .filter((n): n is NpcRecord => n !== undefined && n.factionId !== null
                        && clients.has(n.factionId) && n.activity?.kind !== 'stationed');
                if (eligible.length > 0 && (vacanciesOnTheRolls(state, day).get(host.id) ?? 0) > 0) {
                    const chosen = eligible[forStream(state.seed, 'feeder-selection', host.id, venueId, day)
                        .int(0, eligible.length - 1)]!;
                    const homeId = chosen.factionId!;
                    const home = state.factions.find(h => h.id === homeId)!;
                    const at = state.npcs.findIndex(n => n.id === chosen.id);
                    const hasCargo = hasExchangeConsignment(state, chosen);
                    const missionOf = (person: NpcRecord) => person.activity?.capitalMissionId
                        ? index.byId.get(person.activity.capitalMissionId) : undefined;
                    const fellowFactor = hasCargo ? state.npcs.find(n => n.id !== chosen.id
                        && n.status === 'alive' && isTheWorldsToMove(n)
                        && n.factionId === homeId && n.activity
                        && (n.activity.kind === 'out_with_a_party' || n.activity.kind === 'stationed')
                        && (n.activity.returnTo === home.seatLocationId
                            || missionOf(n)?.data.publicMission === true
                                && (JSON.parse(String(missionOf(n)!.data.publicRoute)) as { fromId: string }[])[0]?.fromId
                                    === home.seatLocationId)
                        && positionOf(n) === venueId) : undefined;
                    const handedOff = fellowFactor
                        ? handOverExchangeConsignment(state, chosen, fellowFactor, day) : false;
                    const returnsCargoHome = hasCargo && !handedOff;
                    const member = state.npcs[at]!;
                    const taken = { ...member, factionId: host.id, factionRankIndex: 0,
                        tags: member.tags.filter(tag => tag !== 'chosen'),
                        updatedOnDay: day };
                    const homeward = returnsCargoHome && taken.activity?.capitalMissionId
                        ? taken
                        : returnsCargoHome && taken.activity?.returnTo === home.seatLocationId
                        && taken.activity.untilDay != null && taken.activity.untilDay > day
                        ? taken : returnsCargoHome ? journeySelectedToHouseSeat(state, home, taken, day) : null;
                    state.npcs[at] = isTheWorldsToMove(member)
                        ? returnsCargoHome ? homeward ?? taken
                            : journeySelectedToHouseSeat(state, host, taken, day) ?? taken
                        : taken;
                    results.push(appendWorldFact(state, makeFact({ day, kind: 'gathering',
                        visibility: 'public', scale: 'regional', magnitude: 0.5,
                        summary: `${chosen.name} was taken from ${home.name} into ${host.name} at its lowest rank.`,
                        locationId: venueId, factionIds: [homeId, host.id],
                        actors: [{ id: chosen.id, name: chosen.name, role: 'selected disciple' }],
                        witnessIds: whoWasThere(state, { day, locationId: venueId,
                            actorIds: [chosen.id], visibility: 'public', scale: 'regional' }, spectators),
                        data: { feederSelection: true, selectedId: chosen.id,
                            fromHouseId: homeId, toHouseId: host.id,
                            cargoReturnViaHome: returnsCargoHome,
                            stintDay: missionOf(member)?.day ?? member.activity?.sinceDay ?? null,
                            contestDay: day, venueId } })));
                }
            }
            for (const entry of entryRows) {
                const id = entry.actors[0]?.id;
                if (!id || field.some(n => n.id === id)) continue;
                results.push(appendWorldFact(state, makeFact({ day, kind: 'gathering', factionIds: [host.id],
                    summary: `${entry.actors[0]!.name} did not appear for the ${venueId === host.seatLocationId ? 'internal' : 'public'} competition at ${venueName}.`,
                    actors: entry.actors, data: { openCompetition: true, result: true,
                        hostId: host.id, contestDay: day, venueId, capitalCompetition: capitalBoard, absent: true } })));
            }
            if (field.length === 0) results.push(appendWorldFact(state, makeFact({ day, kind: 'gathering',
                summary: `${venueName} held its ${capitalBoard ? 'public' : 'internal'} competition with no entrants.`, factionIds: [host.id],
                data: { openCompetition: true, result: true, hostId: host.id, contestDay: day, venueId, capitalCompetition: capitalBoard } })));
            closed.add(key(host, day, venueId));
        }
    }
    return results;
}
