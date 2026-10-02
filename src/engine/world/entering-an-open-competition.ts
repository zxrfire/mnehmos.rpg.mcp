import { witnessIndexFor } from './witness-reaction-index.js';
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
import { realmIndexOf } from '../cultivation/realms.js';
import { theirFaceMoves, whatWinningIsWorth, whatLosingCosts } from './what-a-face-is-worth.js';
import { whatAContestIsWorthToThePeopleInIt } from './what-a-contest-is-worth-to-the-people-in-it.js';
import { regionCatalogIdOf } from './how-a-cultivator-comes-by-a-road.js';
import { getLocation, getNpc, indexById, type WorldState, type FactionRecord } from './world-state.js';

function entriesFor(state: WorldState, hostId: string, day: number): HistoricalFact[] {
    return [...witnessIndexFor(state).competitions.get(`${hostId}|${day}`)?.entries ?? []];
}

export function enterAnOpenCompetition(state: WorldState, host: FactionRecord, entrant: NpcRecord,
    contestDay: number, onDay: number): HistoricalFact | null {
    if (onDay > contestDay || entrant.status !== 'alive') return null;
    if (witnessIndexFor(state).competitions.get(`${host.id}|${contestDay}`)?.closed) return null;
    if (entriesFor(state, host.id, contestDay).some(f => f.actors.some(a => a.id === entrant.id))) return null;
    return recordEntry(state, host, entrant, contestDay, onDay);
}

function recordEntry(state: WorldState, host: FactionRecord, entrant: NpcRecord,
    contestDay: number, onDay: number, people?: readonly NpcRecord[]): HistoricalFact {
    return appendWorldFact(state, makeFact({ day: onDay, kind: 'said_in_public', visibility: 'faction',
        summary: `${entrant.name} entered the public competition at ${host.name}.`,
        actors: [{ id: entrant.id, name: entrant.name, role: 'entrant' }], factionIds: [host.id],
        locationId: host.seatLocationId, data: { openCompetition: true, entry: true, hostId: host.id, contestDay },
        witnessIds: people ? whoWasThere(state, { day: onDay, locationId: host.seatLocationId,
            actorIds: [entrant.id], visibility: 'faction', factionIds: [host.id] }, people) : [] }));
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
    const key = (host: string, day: number) => `${host}|${day}`;
    const index = witnessIndexFor(state);
    const closed = { has: (board: string) => index.competitions.get(board)?.closed === true,
        add: (board: string) => { const held = index.competitions.get(board); if (held) held.closed = true; } };
    const entries = new Map<string, HistoricalFact[]>();
    for (const board of index.pendingCompetitions) {
        const held = index.competitions.get(board)!;
        if (held.entries.length > 0) entries.set(board, [...held.entries]);
    }
    const pending = new Map<string, Set<number>>();
    for (const [board, rows] of entries) {
        if (closed.has(board)) continue;
        const host = String(rows[0]!.data.hostId);
        const day = Number(rows[0]!.data.contestDay);
        if (day > toDay) continue;
        const dates = pending.get(host) ?? new Set<number>();
        dates.add(day);
        pending.set(host, dates);
    }
    for (const host of state.factions) {
        if (host.dissolvedOnDay !== null || !host.seatLocationId) continue;
        const dates = pending.get(host.id) ?? new Set<number>();
        for (let year = Math.floor(fromDay / DAYS_PER_YEAR); (scheduledHostId === undefined || host.id === scheduledHostId)
            && year <= Math.floor(toDay / DAYS_PER_YEAR); year++) {
            const day = theDayItFallsIn(state.seed, host, year);
            if (day !== null && day >= fromDay && day <= toDay) dates.add(day);
        }
        for (const day of dates) {
            if (closed.has(key(host.id, day))) continue;
            const entryRows = entries.get(key(host.id, day)) ?? [];
            const registered = new Set(entryRows.flatMap(f => f.actors.map(a => a.id)));
            // The player row deliberately stands nowhere; the sheet supplies attendance after the span.
            if (!playerAt && state.npcs.some(n => !isTheWorldsToMove(n) && registered.has(n.id))) continue;
            const region = regionCatalogIdOf(state, host.seatLocationId);
            const regions = new Map<string | null, string | null>();
            const regionFor = (place: string | null) => {
                if (!regions.has(place)) regions.set(place, regionCatalogIdOf(state, place));
                return regions.get(place)!;
            };
            const attendance = new Map<string | null, boolean>();
            const isHere = (npc: NpcRecord) => {
                let place = npc.id === playerAt?.id ? playerAt.locationId : npc.locationId;
                const stored = place;
                if (attendance.has(stored)) return attendance.get(stored)!;
                for (let hops = 0; place && hops < 8; hops++) {
                    if (place === host.seatLocationId) { attendance.set(stored, true); return true; }
                    place = getLocation(state, place)?.parentId ?? null;
                }
                attendance.set(stored, false);
                return false;
            };
            const present = playerAt ? state.npcs.filter(n => n.status === 'alive' && isHere(n)) : [];
            const atTheSeat = state.npcs.filter(n => n.locationId === host.seatLocationId);
            const candidates = state.npcs.filter(n => isTheWorldsToMove(n) && n.status === 'alive'
                && !n.activity
                && region !== null && regionFor(n.locationId) === region);
            const rng = forStream(state.seed, 'open-competition-entrants', host.id, day);
            const exact = new Set(candidates.filter(n => isPlayerInvolved(state, n)));
            const entrants = playerAt && present.some(n => n.id === playerAt.id)
                ? candidates.filter(() => rng.chance(0.2))
                : [...exact].filter(n => forStream(state.seed, 'open-competition-exact-entrant', host.id, day, n.id).chance(0.2))
                    .concat(drawBackgroundIncidents(candidates.filter(n => !exact.has(n))
                        .map(value => ({ value, rate: 0.2 })), rng, 8));
            for (const npc of entrants) {
                if (registered.has(npc.id)) continue;
                entryRows.push(recordEntry(state, host, npc, day, day, atTheSeat));
                registered.add(npc.id);
            }
            const field = [...registered].map(id => getNpc(state, id))
                .filter((n): n is NpcRecord => n !== null && n.status === 'alive'
                    && (isTheWorldsToMove(n) || present.some(p => p.id === n.id)))
                .sort((a, b) => indexById(state.npcs, a.id) - indexById(state.npcs, b.id));
            const away = new Map(field.filter(isTheWorldsToMove).map(n => [n.id, n.locationId]));
            for (const npc of field.filter(isTheWorldsToMove)) {
                const at = indexById(state.npcs, npc.id);
                state.npcs[at] = setLocation(state.npcs[at]!, host.seatLocationId, day);
            }
            const placings: GatheringPlacing[] = [];
            rankAField(state, field, forStream(state.seed, 'open-competition-board', host.id, day), placings);
            const spectators = [...new Map([...atTheSeat, ...field].map(n => [n.id, getNpc(state, n.id)!])).values()];
            const board = placings.map(p => ({ npcId: p.npcId, place: p.place,
                fieldSize: placings.filter(q => q.bracket === p.bracket).length }));
            const learned = whatAContestIsWorthToThePeopleInIt(board);
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
                results.push(appendWorldFact(state, makeFact({ day, kind: 'gathering', scale: 'local',
                    summary: `${howAnEntrantIsAnnounced({ name: npc.name,
                        houseName: state.factions.find(f => f.id === npc.factionId)?.name ?? null })} placed ${placing.place} in the ${placing.bracket} board at ${host.name}.`,
                    locationId: host.seatLocationId, factionIds: [host.id],
                    actors: [{ id: npc.id, name: npc.name, role: 'entrant' }],
                    witnessIds: whoWasThere(state, { day, locationId: host.seatLocationId,
                        actorIds: [npc.id], visibility: 'public', scale: 'local' }, spectators),
                    data: { openCompetition: true, result: true, hostId: host.id, contestDay: day,
                        place: placing.place, bracket: placing.bracket, fieldSize: peers.length,
                        trainingDays: learned.find(l => l.npcId === npc.id)?.days ?? 0 } })));
            }
            for (const [id, home] of away) {
                const at = indexById(state.npcs, id);
                state.npcs[at] = setLocation(state.npcs[at]!, home, day);
            }
            for (const entry of entryRows) {
                const id = entry.actors[0]?.id;
                if (!id || field.some(n => n.id === id)) continue;
                results.push(appendWorldFact(state, makeFact({ day, kind: 'gathering', factionIds: [host.id],
                    summary: `${entry.actors[0]!.name} did not appear for the public competition at ${host.name}.`,
                    actors: entry.actors, data: { openCompetition: true, result: true,
                        hostId: host.id, contestDay: day, absent: true } })));
            }
            if (field.length === 0) results.push(appendWorldFact(state, makeFact({ day, kind: 'gathering',
                summary: `${host.name} held its public competition with no entrants.`, factionIds: [host.id],
                data: { openCompetition: true, result: true, hostId: host.id, contestDay: day } })));
            closed.add(key(host.id, day));
        }
    }
    return results;
}
