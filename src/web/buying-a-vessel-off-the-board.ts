/**
 * Buying a cauldron or a refining furnace off the board.
 *
 * The board already priced medicine, a mule and a sword; a vessel to refine in
 * was the thing every formula names and no counter sold. What is on offer is
 * mortal and earth grade only, which is the schema's own restriction
 * (`WhatBuyingItGivesSchema`), so a heaven-grade vessel cannot reach this file.
 *
 * WHAT IS HANDED OVER is a row in the world carried by the buyer, because a
 * vessel is only worth anything to the one read that asks which vessel somebody
 * is carrying (`theBestVesselToHand`). Counted or tracked is the grade's own
 * answer: a clay pot is a lot of one, an earth-grade cauldron is a thing with a
 * record that starts at this counter.
 */

import { REFINING_VESSELS, whatACauldronIsWorthInAFight } from '../engine/cultivation/what-you-refine-in.js';
import {
    howMuchAGradeIsWorthTracking,
    keptAs,
    makeObject,
    makeResourceLot,
    transferPossession
} from '../engine/world/possessions.js';
import type { Price } from '../data/cultivation/mortal-world.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export async function buyAVesselOffTheBoard(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    price: Price,
    stones: number,
    /** What this costs here and why, as the board already says it. */
    quoted: readonly string[]
): Promise<Execution> {
    const gives = price.gives;
    if (gives.kind !== 'a_vessel') throw new Error(`${price.id} is not a vessel.`);
    if (cultivator.spiritStones < stones) {
        return refused('engine.localPrice', 'buy', factsForRefusal(
            'Not for what you are carrying.',
            `${quoted.join(' ')} You are carrying ${cultivator.spiritStones}, and it is not enough.`,
            `${price.id} at ${stones} stones against a purse of ${cultivator.spiritStones}. `
            + 'Nothing bought, nothing spent, no time passed.'
        ));
    }
    game.atHand = game.atHand ?? await game.loadWorld();
    const world = game.atHand;
    if (!world) {
        return refused('engine.possessions', 'buy', factsForRefusal(
            'Nowhere to put it.',
            `${price.name} is a thing in the world, and there is no world under this run to hold it.`,
            `${price.id}: no world loaded, so no row could be written. Nothing bought, nothing spent.`
        ));
    }

    const vessel = REFINING_VESSELS[gives.vessel];
    const day = Math.floor(run.elapsedDays);
    const id = `obj-bought-${gives.vessel}-${cultivator.id}-${day}-${world.objects.length}`;
    const significance = howMuchAGradeIsWorthTracking(gives.grade);
    const blank = keptAs(significance) === 'counted'
        ? (() => {
            const lot = makeResourceLot({
                id, resource: vessel.plainName, quantity: 1, source: 'a counter', acquiredOnDay: day,
                holderId: null, significance
            });
            lot.name = price.name;
            lot.tags = [vessel.tag];
            lot.provenance = [];
            return lot;
        })()
        : makeObject({
            id,
            name: price.name,
            kind: 'artifact',
            significance,
            description: `A ${gives.grade}-grade ${gives.vessel === 'cauldron' ? 'cauldron' : 'artifact furnace'}, bought.`,
            power: whatACauldronIsWorthInAFight(gives.grade),
            tags: [vessel.tag, 'defensive', `grade:${gives.grade}`],
            data: { grade: gives.grade }
        });
    const bought = transferPossession(blank, {
        onDay: day,
        toHolderId: cultivator.id,
        toHolderName: cultivator.name,
        how: 'bought',
        source: cultivator.location ?? 'a counter',
        transfersOwnership: true,
        note: `Bought for ${stones} spirit stone${stones === 1 ? '' : 's'}.`
    });

    game.repos.cultivators.update(cultivator.id, { spiritStones: cultivator.spiritStones - stones });
    world.objects.push(bought);
    game.theWorldMoved();
    const after = game.repos.cultivators.getById(cultivator.id)!;

    const facts = factsForToolResult(`${price.name} bought.`, [
        ...quoted,
        `${price.name} for ${stones} spirit stone${stones === 1 ? '' : 's'}. You are carrying `
        + `${after.spiritStones} now.`
    ]);
    facts.structure.push(
        `${bought.id}: ${gives.grade}-grade ${gives.vessel}, ${bought.significance}, carried by `
        + `${cultivator.id}; ${stones} stone(s) spent, ${after.spiritStones} left.`
    );
    const execution = game.freeAction(run, 'buy', facts);
    execution.calls = [{
        name: 'world.transferPossession',
        action: 'buy',
        summary: `${price.id} -> ${bought.id} (${gives.grade}-grade ${gives.vessel}) to ${cultivator.id}.`,
        ok: true
    }];
    return execution;
}
