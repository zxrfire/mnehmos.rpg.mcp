/** A local hull area is reached after the existing finite native approach, never before it. */
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import type { AnAreaOfAPlace } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { actualCarrierScene, areasOfActualCarrier, type ActualCarrierScene } from './the-actual-carrier-scene.js';
import { passHours } from './routine-invitations.js';
import { LESSER_ACTION_DAYS } from './lesser-action-costs.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import { executionWithItsSpentSpan } from './an-execution-with-its-spent-span.js';

export async function walkOnTheActualCarrier(game: GameService, run: Run, body: Cultivator,
    carrier: ActualCarrierScene, before: AnAreaOfAPlace, destination: AnAreaOfAPlace): Promise<Execution> {
    const resolvesOnTurn = run.turn + 1;
    const finish = (result: Execution): Execution => {
        const live = game.currentRun();
        if (live.cultivator.alive && live.run.status === 'active')
            game.freeAction(live.run, 'move', result.facts, live.run.turn < resolvesOnTurn);
        result.timeDisposition = 'approach_only';
        return result;
    };
    const cannotContinue = (): string | null => {
        const live = game.repos.cultivators.getById(body.id);
        const current = live && game.atHand ? actualCarrierScene(game.repos, live, game.atHand, routineTime(game.atHand)) : null;
        return current?.key === carrier.key ? null : 'The actual hull or course no longer carries this local approach.';
    };
    const advanced = await passHours(game, run, body, LESSER_ACTION_DAYS.move * 24,
        resolvesOnTurn, false, cannotContinue);
    if (!advanced.finished) return finish(advanced.spent ?? refused('engine.walkAcrossThePlace', 'move',
        factsForRefusal('The local approach did not finish.', 'No destination area was entered.',
            cannotContinue() ?? 'The native span was interrupted.')));
    const live = game.currentRun();
    const current = live.cultivator.alive && game.atHand
        ? actualCarrierScene(game.repos, live.cultivator, game.atHand, routineTime(game.atHand)) : null;
    const read = current && current.key === carrier.key
        ? areasOfActualCarrier(game.atHand!, current, live.cultivator) : null;
    const reached = read?.areas.find(area => area.for === destination.for && area.name === destination.name);
    if (!reached) {
        const denied = finish(refused('engine.walkAcrossThePlace', 'move', factsForRefusal(
            'That area is no longer on this actual hull.', 'The spent approach remains spent; the destination was not entered.',
            cannotContinue() ?? 'The freshly read accepted hull no longer offers that area.')));
        return advanced.spent ? executionWithItsSpentSpan(advanced.spent, denied, denied) : denied;
    }
    game.repos.cultivators.standIn(body.id, reached.id);
    const arrived = game.freeAction(live.run, 'move', factsForToolResult(
        `You walk from ${before.name} to ${reached.name}.`,
        ['The local approach finished aboard the same accepted hull and course.']), live.run.turn < resolvesOnTurn);
    arrived.timeDisposition = 'approach_only';
    arrived.calls.push({name:'world.walkAcrossThePlace',action:'move',
        summary:`${body.name} reached ${reached.name} aboard the same actual hull.`,ok:true});
    return advanced.spent ? executionWithItsSpentSpan(advanced.spent, arrived, arrived) : arrived;
}
