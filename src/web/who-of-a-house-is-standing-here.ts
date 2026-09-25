/**
 * "Who is a disciple of the Azure Dew Sect?" asks who of that house is standing
 * here, and is answered with the people present, not with the house's record.
 *
 * Played: the question reached `investigate` on the house and came back with
 * its ranks and alignment. A face with no name the player holds stays a face:
 * it is counted, not named.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { factsForToolResult, placeName } from './facts.js';
import { theHouseNamed } from './asking-to-be-let-in-at-a-gate.js';

export function whoOfAHouseIsStandingHere(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    target: string | undefined
): Execution {
    const house = theHouseNamed(game, target);
    if (house === null) {
        const facts = factsForToolResult('No house by that name.', [
            `"${(target ?? '').trim()}" is not a house you can put to anybody standing here.`
        ]);
        facts.structure.push(`whoOfAHouseIsStandingHere: "${target ?? ''}" reached no house. Read only.`);
        return game.freeAction(run, 'look', facts);
    }

    const ofIt = game.present(cultivator).filter(row => row.sectId === house.factionId);
    const named = ofIt.filter(row => game.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id));
    const faces = ofIt.length - named.length;
    const listed = (names: readonly string[]): string => names.length === 1
        ? names[0]!
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

    const lines: string[] = [];
    if (ofIt.length === 0) {
        lines.push(`Nobody of the ${house.factionName} is standing here at ${placeName(cultivator)}.`);
        lines.push(game.knowledge.canPointAt(cultivator.id, 'place', house.seat.id)
            ? `Its people are found at its gate, at ${house.seat.name}.`
            : 'Its people are found at its gate, and you do not know the way there.');
    } else {
        if (named.length > 0) {
            lines.push(`Of the ${house.factionName}, standing here: ${listed(named.map(row =>
                row.sectRank ? `${row.name} (${row.sectRank})` : row.name))}.`);
            for (const row of named) game.nameWhatTheyGot(row.name);
        }
        if (faces > 0) {
            lines.push(`${faces} ${named.length > 0 ? 'more ' : ''}of the ${house.factionName} `
                + `${faces === 1 ? 'is' : 'are'} here whose name${faces === 1 ? '' : 's'} you do not have.`);
        }
    }

    const facts = factsForToolResult(`Of the ${house.factionName}, here.`, lines);
    facts.structure.push(`whoOfAHouseIsStandingHere: ${ofIt.length} of ${house.factionId} present, `
        + `${named.length} nameable. Read only.`);
    return game.freeAction(run, 'look', facts);
}
