/** Explicit local cave entry asks the native doorway before and after real approach. */
import { pathTo, reachThrough } from '../engine/world/architecture.js';
import type { LocationRecord } from '../engine/world/locations.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { betweenRoadEndpoints } from './a-road-stopped-partway.js';
import { executionWithItsSpentSpan } from './an-execution-with-its-spent-span.js';
import { worldLocationFor } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { howThisCultivatorStandsInTheHouseHolding } from './how-this-cultivator-stands-on-this-ground.js';
import { LESSER_ACTION_DAYS } from './lesser-action-costs.js';
import { passHours } from './routine-invitations.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** Geographic arrival at a ruin remains outside its separate ruin_inside authority. */
export async function enteringAnActualLocalCave(game: GameService, run: Run,
    body: Cultivator, target: LocationRecord, intent: string | undefined): Promise<Execution | null> {
    const world = game.atHand;
    if (!world || intent !== 'enter' || target.kind !== 'cave'
        || theSeatOfTheCompound(world, target.id)) return null;
    const outside = worldLocationFor(world, body.location);
    if (!outside || target.parentId !== outside.id) return null;
    const refuse = (why: string): Execution => refused('engine.enterActualCave', 'move', factsForRefusal(
        `The doorway into ${target.name} does not admit this entry.`, why,
        'The actual outside ground and the cave stock remain unchanged.'));
    if (betweenRoadEndpoints(game.db, body)) return refuse('The actual body is between road endpoints, not at this doorway.');
    const cannotEnter = (state: WorldState, current: Cultivator): string | null => {
        if (!current.alive) return 'There is no living body to enter.';
        if (worldLocationFor(state, current.location)?.id !== outside.id
            || betweenRoadEndpoints(game.db, current)) return 'The actual body no longer stands at the outside parent of this cave.';
        const actual = state.locations.find(row => row.id === target.id);
        if (!actual || actual.kind !== 'cave' || actual.parentId !== outside.id) return 'The actual cave doorway is no longer here.';
        const access = howThisCultivatorStandsInTheHouseHolding({ ground: actual,
            cultivator: current, standing: null, objects: state.objects, onDay: routineTime(state) }).access;
        const reach = reachThrough(pathTo(state.locations, actual.id), access, { enteredAt: outside.id });
        return reach.stoppedAt !== null || reach.level === 'barred' ? reach.reason : null;
    };
    const initial = game.repos.cultivators.getById(body.id);
    if (!initial) return refuse('There is no actual body to enter.');
    const barred = cannotEnter(world, initial);
    if (barred) return refuse(barred);
    const finishPrepared = (actual: Execution): Execution => {
        const live = game.currentRun();
        if (live.cultivator.alive && live.run.status === 'active') {
            game.freeAction(live.run, 'move', actual.facts, live.run.turn < run.turn + 1);
        }
        actual.timeDisposition = 'approach_only';
        return actual;
    };
    const advanced = await passHours(game, run, initial, LESSER_ACTION_DAYS.move * 24,
        run.turn + 1, false, () => {
            const current = game.repos.cultivators.getById(body.id);
            return !current || !game.atHand ? 'The actual body or ground is unavailable.' : cannotEnter(game.atHand, current);
        });
    if (!advanced.finished) return finishPrepared(advanced.spent ?? refuse('The actual approach did not finish.'));
    game.atHand = await game.loadWorld();
    const current = game.repos.cultivators.getById(body.id);
    const after = game.atHand && current ? cannotEnter(game.atHand, current) : 'The actual body or ground is unavailable.';
    if (after) {
        const denied = finishPrepared(refuse(after));
        return advanced.spent ? executionWithItsSpentSpan(advanced.spent, denied, denied) : denied;
    }
    const live = game.currentRun();
    const actual = game.atHand!.locations.find(row => row.id === target.id)!;
    const entered = game.repos.cultivators.update(body.id, { location: actual.name })!;
    game.theyArrivedWithYou(entered, actual.name);
    game.noteEncounter(entered, live.run, { kind: 'place', id: actual.name, name: actual.name },
        'witnessed', 'Entered through the actual admitted local cave doorway.');
    const done = game.freeAction(live.run, 'move', factsForToolResult(`You are at ${actual.name}.`,
        ['The actual local approach finished before entry; the native doorway was reread at arrival.']),
        live.run.turn < run.turn + 1);
    done.timeDisposition = 'approach_only';
    return advanced.spent ? executionWithItsSpentSpan(advanced.spent, done, done) : done;
}
