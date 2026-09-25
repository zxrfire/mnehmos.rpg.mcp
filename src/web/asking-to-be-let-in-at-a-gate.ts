/**
 * "May I enter?" at a house's gate is asking to be let in, and the gate answers.
 *
 * Played at a gate: "may i enter?" came back as the 77-place destinations
 * listing, and "I enter the azure dew sect" reached `site`, which is for ruins
 * and sealed ground and answered that no site had been approached. The gate's
 * own read (`whatTheGateOfThisHouseSays`) already says which road in is open to
 * this person and what would open the others; this is the sentence that reaches
 * it.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { factsForToolResult, placeName } from './facts.js';
import {
    theHouseThisNameReaches,
    theHouseWhoseGateThisIs,
    whatTheGateOfThisHouseSays,
    type AHouseYouCouldWalkTo
} from './walking-up-to-a-house.js';

/** The house a typed name reaches, with or without its article. */
export function theHouseNamed(game: GameService, typed: string | undefined): AHouseYouCouldWalkTo | null {
    const world = game.atHand;
    const said = (typed ?? '').trim();
    if (!world || said.length < 3) return null;
    return theHouseThisNameReaches(world, said)
        ?? theHouseThisNameReaches(world, said.replace(/^the\s+/i, ''))
        ?? null;
}

/** The house whose gate this cultivator is standing at, or null. */
export function theGateYouAreAt(game: GameService, cultivator: Cultivator): AHouseYouCouldWalkTo | null {
    return game.atHand ? theHouseWhoseGateThisIs(game.atHand, placeName(cultivator)) : null;
}

/**
 * What the gate says when asked to be let in.
 *
 * Null where there is no gate to ask here and nothing was named, or a house was
 * named whose gate is somewhere else and `onlyAtItsGate` is set: the caller has
 * its own answer for those (the site read, or the road to the house).
 */
export function askingToBeLetIn(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    target: string | undefined,
    onlyAtItsGate: boolean
): Execution | null {
    const here = theGateYouAreAt(game, cultivator);
    const named = theHouseNamed(game, target);
    if ((target ?? '').trim().length >= 3 && named === null) return null;

    const house = named === null ? here : named.factionId === here?.factionId ? here : null;
    if (house === null) {
        if (named === null || onlyAtItsGate) return null;
        const away = factsForToolResult(
            `Not at the gate of the ${named.factionName}.`,
            [`You are not standing at the gate of the ${named.factionName}. Whether it lets you in `
                + 'is answered at its gate.']
        );
        away.structure.push(`askingToBeLetIn: ${named.factionId} named, standing at `
            + `${placeName(cultivator)}. Read only.`);
        return game.freeAction(run, 'look', away);
    }

    const gate = whatTheGateOfThisHouseSays(game, cultivator, house);
    const facts = factsForToolResult(`At the gate of the ${house.factionName}.`, gate.facts);
    facts.structure.push(gate.structure);
    const execution = game.freeAction(run, 'look', facts);
    execution.calls = [{
        name: 'engine.standingAtTheGateOf',
        action: 'look',
        summary: `Asked to be let in at the gate of the ${house.factionName}: ${gate.way}. ${gate.structure}`,
        ok: true
    }];
    return execution;
}
