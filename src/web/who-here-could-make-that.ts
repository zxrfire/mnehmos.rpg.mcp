/**
 * A commission with no maker named, answered with the hands that are here.
 *
 * ── THE COLLISION, AND HOW THE GENRE SETTLES IT ──────────────────────────
 *
 * `commission` is two words in this game. A commission PLACED WITH somebody is
 * a making - you ask a pair of hands for a thing, and `request/a_making`
 * resolves it. A commission TAKEN OFF A BOARD is a job, and `sect/duty` owns
 * it. The preposition and the object separate them: you commission a THING, and
 * you take a POSTING. Nothing here reads the board's sense; the table sends it
 * to the board, as it always did.
 *
 * ── AND WHY THIS IS NOT A GUESS AT A MAKER ───────────────────────────────
 *
 * Measured: "I commission a sword" reached nothing at all. The sentence names
 * the thing and leaves the hands open, and there are two wrong answers to that
 * - picking somebody, which decides for the player who they are dealing with,
 * and a blank look, which pretends the engine cannot tell them anything.
 *
 * What it can tell them is exactly what the ask would turn on:
 * `highestGradeRefinableAt` is the ceiling of a pair of hands, and it is
 * already what `commissioning-a-craft.ts` reads when a maker IS named. So the
 * answer is the list of people standing here with the grade each could reach,
 * and the player names one. A refusal carrying the number rather than a hedge.
 *
 * Nothing is spent, nothing is written, and no day passes.
 */

import { highestGradeRefinableAt } from '../engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { gradeAskedFor } from './what-somebody-was-asked-to-make.js';
import type { Cultivator } from '../schema/cultivation.js';
import { factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** What a pair of hands at this rung could reach, said the way a player reads it. */
function asFarAs(realmOrdinal: number): string {
    const grade = highestGradeRefinableAt(realmOrdinal);
    return grade === null ? 'nothing worth commissioning' : `${grade} grade`;
}

/**
 * Who is standing here who could make the named thing, and how high each reaches.
 */
export function whoHereCouldMakeThat(
    game: GameService,
    cultivator: Cultivator,
    named: string
): Execution {
    const here = game.present(cultivator);
    const wanted = gradeAskedFor(named);

    if (here.length === 0) {
        // AND WHERE HANDS ARE, which is the half a player standing alone on a
        // mountainside actually needs. Without it this degrades to a bare no:
        // the refusal was built to carry the grades of who is here, and with
        // nobody here it carried nothing at all.
        return refused('engine.whoCouldMakeThat', 'request', factsForRefusal(
            'There is nobody here to make it.',
            // THE PLAYER'S WORDS IN QUOTES, not glued into a sentence that
            // needs an article they did not type. `named` is whatever they
            // wrote, and *"You want sword made"* is what gluing it produces.
            `You asked for "${named}" and there is nobody standing here to make it. A commission is `
            + 'placed with a pair of hands, and the hands have to be in front of you: a market town, '
            + 'a house\'s own workshop, or anybody you are travelling with. "where can I go" names the '
            + `roads out of here, and ${wanted} grade is the bar this one would have to clear.`,
            `request/a_making with no maker named and nobody present. Wanted grade: ${wanted}. `
            + 'Nothing was spent and no day passed.'
        ));
    }

    // Highest first, because the one question a player is asking is who can
    // reach what they want.
    const hands = [...here]
        .sort((a, b) => b.realmOrdinal - a.realmOrdinal)
        .slice(0, 6)
        .map(row => `${row.name} (${asFarAs(row.realmOrdinal)})`);

    // `chaos` is a grade the catalog has and no pair of hands reaches, so it
    // sits off the end of this ladder rather than on it: unknown to `GRADES`
    // reads as beyond anybody, which is what it is.
    const howHigh = (grade: string | null): number =>
        grade === null ? -1 : GRADES.indexOf(grade as typeof GRADES[number]);
    const couldReachIt = here.filter(row =>
        howHigh(highestGradeRefinableAt(row.realmOrdinal)) >= howHigh(wanted));

    return refused('engine.whoCouldMakeThat', 'request', factsForRefusal(
        'Commissioned from whom?',
        `You asked for "${named}" and have not said whose hands. Standing here: ${hands.join(', ')}. `
        + (couldReachIt.length === 0
            ? `Nobody here reaches ${wanted} grade, which is what that would take.`
            : `${couldReachIt.length} of them could reach ${wanted} grade. `)
        + `Name one: "I ask ${here[0]!.name} to make me ${named}".`,
        `request/a_making with no maker named. Wanted grade ${wanted}; `
        + `${here.length} present, ${couldReachIt.length} at or above it by `
        + 'highestGradeRefinableAt. Nothing was spent and no day passed.'
    ));
}

/** Low to high, so one grade can be weighed against another. */
const GRADES = ['mortal', 'earth', 'heaven', 'immortal'] as const;
