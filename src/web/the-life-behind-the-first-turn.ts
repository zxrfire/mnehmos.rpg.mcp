/**
 * Sixteen years, said before the first turn asks anything of them.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A run opened like this, and this was the whole of it:
 *
 *     shen wuyou I begins at Qi Condensation Layer 1, age 16. Born in Clear
 *     River Ford, a market town on thin ground. A farm in a thin county. 30
 *     spirit stones, under a year of seclusion. 3 NAMES KNOWN. Metal-Wood Dual
 *     Root; Might 3, Insight 3, Fortune 3, Charm 2.
 *
 *     Clear River Ford. The air here gives very little back.
 *     The day asks nothing in particular.
 *
 * A character sheet, and then an empty square. The design owner: *"if you start
 * in a place with 0 people, say it, like the beginning should narrate your life
 * up to that point"*, and, on the same screen: *"you have to know SOMETHING,
 * else the game is just dead."*
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE MATERIAL WAS ALREADY THERE, WHICH IS THE PART THAT MATTERS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * "3 names known" is the line that gives it away. `BirthKnowledge` carries, per
 * row: the NAME, a `statement` of what this person believes about it, a
 * `sourceNote` saying who they got it from, a `stance`, and a `confidence`. All
 * five were drawn, written into the knowledge table, and then reported to the
 * player as the digit three.
 *
 * So the answer to "you have to know something" was not a system that needed
 * building. It was already drawn at birth and thrown away at the point of
 * printing.
 *
 * The same holds for the rest: `whoTheyAre` knows whether a house's roll
 * carries them and whether somebody is owed for it, `opening.name` names the
 * household they came out of, and `place` and `ground` say what sort of ground
 * they have been breathing for sixteen years.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS NOT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It is not prose. Every line is a fact with a row behind it, in the register
 * the rest of the engine uses, and the narrator writes the childhood out of
 * them. The engine does not get to invent a mother.
 *
 * And it does not open a second channel for the sheet. The numbers stay where
 * they were - `describeBirth` still files the mechanical line - because a
 * player who wants their attributes should not have to read a paragraph for
 * them.
 */

import type { Birth } from '../engine/birth/birth.js';

/** How many of the names drawn at birth are worth saying in the opening. */
export const NAMES_WORTH_SAYING_AT_THE_START = 3;

/**
 * WHAT THIS PERSON HAS BEHIND THEM, as facts the narrator can write a life out
 * of.
 *
 * Ordered the way a life is: where they come from, whose they are, what that
 * left them holding, and what they have been told about the world. The last is
 * the one the opening existed without, and is the reason a player used to have
 * nothing to act on.
 */
export function theLifeBehindTheFirstTurn(birth: Birth, age: number): string[] {
    const lines: string[] = [];

    // ── WHERE, AND WHAT SORT OF GROUND ───────────────────────────────────
    //
    // Sixteen years of breathing it, which is why the band is said as a
    // lifetime rather than as a reading. Somebody raised on thin ground has
    // never known anything else and has no reason to remark on it.
    lines.push(
        `${age} years in ${birth.place.name}, a ${birth.place.kind.replace(/_/g, ' ')}, `
        + `on ${birth.ground.replace(/_/g, ' ')} ground. That is the air they have breathed `
        + 'their whole life, and they have nothing to compare it against.'
    );

    // ── WHOSE THEY ARE ───────────────────────────────────────────────────
    lines.push(`What they came out of: ${birth.opening.name}.`);

    const inside = birth.raisedInside;
    if (inside !== null) {
        lines.push(
            inside.onTheRoll === 'by blood'
                ? `They grew up inside ${inside.house.name}, on its roll from birth because its `
                  + 'roll is its family, and at no rank in it.'
                : inside.onTheRoll === 'by taking'
                    ? `They grew up inside ${inside.house.name}, on its roll because it took them `
                      + 'in, at no rank in it, and nobody has told them why.'
                    : `They grew up inside ${inside.house.name} without ever being put on its roll.`
        );
        if (inside.somebodyIsOwedForIt) {
            // The player does not know this and the world does. Stated for the
            // record rather than for the prose, and the narrator must not have
            // anybody say it out loud.
            lines.push(
                'Somebody spent a word to put them there and is carrying the debt for it. '
                + 'They have not been told, and nobody here is going to tell them.'
            );
        }
    } else if (birth.house !== null) {
        lines.push(
            `The family belongs to ${birth.house.name}, which is not a rank and not an admission. `
            + 'It is who they would go to, not somewhere they may go.'
        );
    }

    // ── WHAT THAT LEFT THEM HOLDING ──────────────────────────────────────
    const years = birth.opening.provisionedYears;
    lines.push(
        `They are standing here with ${birth.spiritStones} spirit stones, which is `
        + (years < 1
            ? 'not a year of sitting still.'
            : `about ${Math.round(years)} years of sitting still.`)
    );

    // ── AND WHAT THEY HAVE BEEN TOLD, WHICH IS THE HALF THAT WAS MISSING ─
    //
    // Reported as "3 names known" and nothing else. Every one of these rows
    // already carried who said it and what they said.
    const told = birth.knowledge.slice(0, NAMES_WORTH_SAYING_AT_THE_START);
    if (told.length === 0) {
        lines.push(
            'Nobody has told them anything about anywhere. Whatever they learn, they learn by '
            + 'walking up to it.'
        );
    } else {
        // Honest about the count. The mechanical line files the total, and
        // saying “three names, in full” beside a sheet reading eight is the
        // engine disagreeing with itself on one screen.
        const rest = birth.knowledge.length - told.length;
        lines.push(
            `What ${age} years got them: ${birth.knowledge.length} `
            + `name${birth.knowledge.length === 1 ? '' : 's'}`
            + (rest > 0
                ? `, of which these are the ones they would say first.`
                : `, and this is where each came from.`)
        );
        for (const row of told) {
            // The statement often opens with the name, and “Three Walls.
            // Three Walls is where they are from” is the engine stuttering.
            const said = row.statement.trim();
            lines.push(said.toLowerCase().startsWith(row.name.toLowerCase())
                ? `${said} ${row.sourceNote}`
                : `${row.name}. ${said} ${row.sourceNote}`);
        }
    }
    return lines;
}
