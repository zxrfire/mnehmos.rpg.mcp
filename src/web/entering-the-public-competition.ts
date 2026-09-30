/** Entry at the host's gate keeps the named entrant on the board. */
import type { Cultivator, Run } from '../schema/cultivation.js';
import { whatThisHouseHasOnPaper } from '../engine/world/a-competition-anybody-may-enter.js';
import { enterAnOpenCompetition } from '../engine/world/entering-an-open-competition.js';
import { factsForToolResult } from './facts.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export function enterThePublicCompetition(game: GameService, run: Run, cultivator: Cultivator): Execution {
    const world = game.atHand;
    let place = world?.locations.find(l => l.id === game.worldPlaceOf(cultivator));
    let host = world?.factions.find(f => f.seatLocationId === place?.id);
    for (let hops = 0; !host && place?.parentId && hops < 8; hops++) {
        place = world?.locations.find(l => l.id === place!.parentId);
        host = world?.factions.find(f => f.seatLocationId === place?.id);
    }
    const day = Math.floor(world?.currentDay ?? 0);
    const paper = host && world ? whatThisHouseHasOnPaper(world.seed, host, day) : null;
    const npc = world?.npcs.find(n => n.id === cultivator.id);
    const registered = paper && host && world && npc
        ? enterAnOpenCompetition(world, host, npc, paper.onDay, day) : null;
    const line = !host ? 'Entry is taken at the house holding the competition.'
        : !paper ? `${host.name} has no public competition open for entry today.`
        : registered ? `You entered the public competition at ${host.name}, on day ${paper.onDay}. You must be there when the board is called.`
        : world?.history.facts.some(f => f.data.openCompetition === true && f.data.hostId === host.id
            && f.data.contestDay === paper.onDay && f.data.result === true)
            ? `${host.name}'s competition board has already been called.`
        : 'You are already entered in this competition.';
    if (registered) game.theWorldMoved();
    return { ...game.freeAction(run, 'sect', factsForToolResult(line, [line], line)),
        outcome: registered ? 'executed' : 'refused',
        events: [], timeSkip: null, breakthrough: null,
        facts: factsForToolResult(line, [line], `Public competition entry at world day ${day}; run ${run.id}.`),
        calls: [{ name: 'engine.enterAnOpenCompetition', action: 'sect', summary: line, ok: registered !== null }] };
}
