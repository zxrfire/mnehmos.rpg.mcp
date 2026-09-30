/** Open boards use the same realm brackets and power reading as closed gatherings. */
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { rankAField, type GatheringPlacing } from './gatherings.js';
import { theDayItFallsIn } from './a-competition-anybody-may-enter.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { isTheWorldsToMove, setLocation, type NpcRecord } from './npc-state.js';
import { howAnEntrantIsAnnounced } from './how-an-entrant-is-announced.js';
import { realmIndexOf } from '../cultivation/realms.js';
import { theirFaceMoves, whatWinningIsWorth, whatLosingCosts } from './what-a-face-is-worth.js';
import { whatAContestIsWorthToThePeopleInIt } from './what-a-contest-is-worth-to-the-people-in-it.js';
import { regionCatalogIdOf } from './how-a-cultivator-comes-by-a-road.js';
import type { WorldState, FactionRecord } from './world-state.js';

function entriesFor(state: WorldState, hostId: string, day: number): HistoricalFact[] {
    return state.history.facts.filter(f => f.data.openCompetition === true && f.data.hostId === hostId
        && f.data.contestDay === day && f.data.entry === true);
}

export function enterAnOpenCompetition(state: WorldState, host: FactionRecord, entrant: NpcRecord,
    contestDay: number, onDay: number): HistoricalFact | null {
    if (onDay > contestDay || entrant.status !== 'alive') return null;
    if (state.history.facts.some(f => f.data.openCompetition === true && f.data.hostId === host.id
        && f.data.contestDay === contestDay && f.data.result === true)) return null;
    if (entriesFor(state, host.id, contestDay).some(f => f.actors.some(a => a.id === entrant.id))) return null;
    return recordEntry(state, host, entrant, contestDay, onDay);
}

function recordEntry(state: WorldState, host: FactionRecord, entrant: NpcRecord,
    contestDay: number, onDay: number): HistoricalFact {
    return appendWorldFact(state, makeFact({ day: onDay, kind: 'said_in_public', visibility: 'faction',
        summary: `${entrant.name} entered the public competition at ${host.name}.`,
        actors: [{ id: entrant.id, name: entrant.name, role: 'entrant' }], factionIds: [host.id],
        locationId: host.seatLocationId, data: { openCompetition: true, entry: true, hostId: host.id, contestDay } }));
}

/** Due boards and their entry records are world facts; reading a result never rerolls it. */
export function settleOpenCompetitions(state: WorldState, fromDay: number, toDay: number,
    playerAt?: { id: string; locationId: string | null }): HistoricalFact[] {
    const results: HistoricalFact[] = [];
    const key = (host: string, day: number) => `${host}|${day}`;
    const closed = new Set<string>();
    const entries = new Map<string, HistoricalFact[]>();
    for (const fact of state.history.facts) {
        if (fact.data.openCompetition !== true || typeof fact.data.hostId !== 'string'
            || typeof fact.data.contestDay !== 'number') continue;
        const board = key(fact.data.hostId, fact.data.contestDay);
        if (fact.data.result === true) closed.add(board);
        if (fact.data.entry === true) {
            const rows = entries.get(board) ?? [];
            rows.push(fact);
            entries.set(board, rows);
        }
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
        for (let year = Math.floor(fromDay / DAYS_PER_YEAR); year <= Math.floor(toDay / DAYS_PER_YEAR); year++) {
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
            const isHere = (npc: NpcRecord) => {
                let place = npc.id === playerAt?.id ? playerAt.locationId : npc.locationId;
                for (let hops = 0; place && hops < 8; hops++) {
                    if (place === host.seatLocationId) return true;
                    place = state.locations.find(l => l.id === place)?.parentId ?? null;
                }
                return false;
            };
            const present = state.npcs.filter(n => n.status === 'alive' && isHere(n));
            const candidates = state.npcs.filter(n => isTheWorldsToMove(n) && n.status === 'alive'
                && !n.activity
                && region !== null && regionCatalogIdOf(state, n.locationId) === region);
            const rng = forStream(state.seed, 'open-competition-entrants', host.id, day);
            for (const npc of candidates) {
                if (!rng.chance(0.2) || registered.has(npc.id)) continue;
                entryRows.push(recordEntry(state, host, npc, day, day));
                registered.add(npc.id);
            }
            const field = state.npcs.filter(n => registered.has(n.id) && n.status === 'alive'
                && (isTheWorldsToMove(n) || present.some(p => p.id === n.id)));
            const away = new Map(field.filter(isTheWorldsToMove).map(n => [n.id, n.locationId]));
            for (const npc of field.filter(isTheWorldsToMove)) {
                const at = state.npcs.findIndex(n => n.id === npc.id);
                state.npcs[at] = setLocation(state.npcs[at]!, host.seatLocationId, day);
            }
            const placings: GatheringPlacing[] = [];
            rankAField(state, field, forStream(state.seed, 'open-competition-board', host.id, day), placings);
            const board = placings.map(p => ({ npcId: p.npcId, place: p.place,
                fieldSize: placings.filter(q => q.bracket === p.bracket).length }));
            const learned = whatAContestIsWorthToThePeopleInIt(board);
            for (const placing of placings) {
                const npc = state.npcs.find(n => n.id === placing.npcId)!;
                const peers = field.filter(n => realmIndexOf(n.cultivation.realmOrdinal) === realmIndexOf(npc.cultivation.realmOrdinal));
                const winner = placings.find(p => p.bracket === placing.bracket && p.place === 1)!;
                const winnerNpc = state.npcs.find(n => n.id === winner.npcId)!;
                if (peers.length > 1) theirFaceMoves(state, npc.id, placing.place === 1
                    ? whatWinningIsWorth({ winnerOrdinal: npc.cultivation.realmOrdinal,
                        loserOrdinal: peers.find(p => p.id !== npc.id)!.cultivation.realmOrdinal, witnesses: field.length })
                    : -whatLosingCosts({ loserOrdinal: npc.cultivation.realmOrdinal, winnerOrdinal: winnerNpc.cultivation.realmOrdinal, witnesses: field.length }), day);
                const at = state.npcs.findIndex(n => n.id === npc.id);
                if (isTheWorldsToMove(npc)) state.npcs[at] = { ...state.npcs[at]!, cultivation: {
                    ...state.npcs[at]!.cultivation, accumulatingSinceDay: npc.cultivation.accumulatingSinceDay
                        - (learned.find(l => l.npcId === npc.id)?.days ?? 0) } };
                results.push(appendWorldFact(state, makeFact({ day, kind: 'gathering', scale: 'local',
                    summary: `${howAnEntrantIsAnnounced({ name: npc.name,
                        houseName: state.factions.find(f => f.id === npc.factionId)?.name ?? null })} placed ${placing.place} in the ${placing.bracket} board at ${host.name}.`,
                    locationId: host.seatLocationId, factionIds: [host.id],
                    actors: [{ id: npc.id, name: npc.name, role: 'entrant' }],
                    data: { openCompetition: true, result: true, hostId: host.id, contestDay: day,
                        place: placing.place, bracket: placing.bracket, fieldSize: peers.length,
                        trainingDays: learned.find(l => l.npcId === npc.id)?.days ?? 0 } })));
            }
            for (const [id, home] of away) {
                const at = state.npcs.findIndex(n => n.id === id);
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
