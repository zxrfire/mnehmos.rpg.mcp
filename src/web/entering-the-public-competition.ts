/** Entry at the host's gate keeps the named entrant on the board. */
import type { Cultivator, Run } from '../schema/cultivation.js';
import { theDayItFallsIn } from '../engine/world/a-competition-anybody-may-enter.js';
import { enterAnOpenCompetition } from '../engine/world/entering-an-open-competition.js';
import { capitalCalendar } from '../engine/world/capital-missions-and-calendar.js';
import { factsForToolResult } from './facts.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export function enterThePublicCompetition(game: GameService, run: Run, cultivator: Cultivator): Execution {
    const world = game.atHand;
    let place = world?.locations.find(l => l.id === game.worldPlaceOf(cultivator));
    const arrival = place;
    let host = world?.factions.find(f => f.seatLocationId === place?.id);
    for (let hops = 0; !host && place?.parentId && hops < 8; hops++) {
        place = world?.locations.find(l => l.id === place!.parentId);
        host = world?.factions.find(f => f.seatLocationId === place?.id);
    }
    const day = Math.floor(world?.currentDay ?? 0);
    const capital = world && arrival ? [Math.floor(day / 365), Math.floor(day / 365) + 1]
        .flatMap(year => capitalCalendar(world, year)).find(o => o.venueId === arrival.id
            && o.kind === 'competition' && o.opensOnDay <= day && o.onDay >= day) : undefined;
    if (capital && world) host = world.factions.find(h => h.id === capital.hostId);
    const closedDay = host && world ? [Math.floor(day / 365), Math.floor(day / 365) + 1]
        .map(year => theDayItFallsIn(world.seed, host!, year))
        .find(date => date !== null && date >= day && date - day <= 90) : null;
    const paper = capital ? { onDay: capital.onDay } : closedDay != null ? { onDay: closedDay } : null;
    if (!capital && host && cultivator.sectId !== host.id) {
        const line = `${host.name}'s internal contests are for its members. Open competitions are held in the capitals.`;
        return { ...game.freeAction(run, 'sect', factsForToolResult(line, [line])), outcome: 'refused',
            calls: [{ name: 'engine.enterAnOpenCompetition', action: 'sect', summary: line, ok: false }] };
    }
    const venueName = capital ? arrival!.name : host?.name;
    const npc = world?.npcs.find(n => n.id === cultivator.id);
    if (npc) npc.factionId = cultivator.sectId ?? null;
    const registered = paper && host && world && npc
        ? enterAnOpenCompetition(world, host, npc, paper.onDay, day, capital?.venueId) : null;
    const line = !host ? 'Entry is taken at the house holding the competition.'
        : !paper ? `${venueName} has no ${capital ? 'public' : 'internal'} competition open for entry today.`
        : registered ? `You entered the ${capital ? 'public' : 'internal'} competition at ${venueName}, on day ${paper.onDay}. You must be there when the board is called.`
        : world?.history.facts.some(f => f.data.openCompetition === true && f.data.hostId === host.id
            && f.data.contestDay === paper.onDay && f.data.result === true)
            ? `${host.name}'s competition board has already been called.`
        : 'You are already entered in this competition.';
    if (registered) game.theWorldMoved();
    const facts = factsForToolResult(line, [line]);
    return { ...game.freeAction(run, 'sect', facts),
        outcome: registered ? 'executed' : 'refused',
        events: [], timeSkip: null, breakthrough: null,
        facts,
        calls: [{ name: 'engine.enterAnOpenCompetition', action: 'sect', summary: line, ok: registered !== null }] };
}
