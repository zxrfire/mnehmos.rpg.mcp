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
import { getOrigin } from '../engine/cultivation/origin.js';
import { rankName } from '../engine/cultivation/realms.js';
import type { AmbientQi } from '../schema/cultivation.js';

/** The bands in order, so two of them can be compared without a table. */
const HOW_MUCH_QI: readonly AmbientQi[] = ['thin', 'normal', 'dense', 'spirit_tide'];

/**
 * THE GROUND THEY STAND ON, AGAINST THE GROUND THAT RAISED THEM.
 *
 * Three corrections in one, all from the design owner.
 *
 * This first read `on ${band} ground`, and a model handed "normal ground" wrote
 * *"the air here has always felt heavy in the lungs, a thickness you have known
 * since childhood"* - humidity rather than spiritual density, and the wrong band
 * besides. *"Say thick with qi."* The word `ground` alone leaves a model to
 * guess what is thin or thick ABOUT it, and the guess is always physical.
 *
 * Then: *"xianxia doesn't talk about air."* So it does not. It talks about qi,
 * and about what a person can draw from where they are standing.
 *
 * And the one that made the line worth having at all: *"thicker versus the place
 * you came from."* A band on its own means nothing to somebody who has only
 * ever stood on one. What means something is the DIFFERENCE - a farm child from
 * a thin county standing on ordinary ground for the first time has something to
 * measure, and the engine knows both numbers. The old line even said the
 * opposite out loud, that they had nothing to compare it against, while holding
 * the comparison.
 */
function theQiHereAgainstHome(here: AmbientQi, home: AmbientQi): string {
    const step = HOW_MUCH_QI.indexOf(here) - HOW_MUCH_QI.indexOf(home);
    if (step > 1) return `ground so much thicker with qi than ${WHERE_THEY_GREW_UP[home]} `
        + 'that they have no measure for it';
    if (step === 1) return `ground thicker with qi than ${WHERE_THEY_GREW_UP[home]}, and they `
        + 'can feel the difference without being able to name it';
    // Still names qi. The same band as home is the commonest case by far, and
    // it was the one branch that said only “ground” - which is the exact word
    // that let a model reach for weather in the first place.
    if (step === 0) return `ground with the same qi in it as ${WHERE_THEY_GREW_UP[home]}, `
        + 'which is the only measure of it they have ever had';
    return `ground thinner with qi than ${WHERE_THEY_GREW_UP[home]}, which they noticed and `
        + 'have said nothing about';
}

/** What a band is, from the inside, for the half of the sentence about home. */
const WHERE_THEY_GREW_UP: Readonly<Record<string, string>> = Object.freeze({
    thin: 'the county that raised them',
    normal: 'the ground that raised them',
    dense: 'the rich ground that raised them',
    spirit_tide: 'the tide-ground that raised them'
});

/**
 * ═════════════════════════════════════════════════════════════════════════
 * NO AUTHORED CHILDHOOD. THE VARIABLES, AND THE NARRATOR WRITES THE STORY.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A first cut of this file carried tables of written childhoods and written
 * reasons for leaving - "they carried water up from a river that was a long way
 * down", and so on - drawn per origin tier. The design owner stopped it:
 *
 *   *"btw do not hardcode the exact starting story. Randomly generate the
 *    starting variables, parents, location, etc. That should already be there?
 *    And you have the LLM synthesize a story."*
 *   *"like birth house is already tracked?"*
 *
 * Right on both counts, and the second is the answer to the first. The birth
 * pass already draws every variable a childhood is made of: the origin tier and
 * its household, the place, the ground under it, the house the family belongs
 * to, whether that house's roll carries them and how, whether somebody spent a
 * word to put them there, what they were left holding, and every name they have
 * been told and by whom.
 *
 * So there is nothing to invent. Writing childhoods into this file was the
 * engine composing prose, which is the one thing it is not for - the same
 * defect as reciting a scoring rubric, arrived at from the pleasant direction.
 *
 * What goes below is variables. The narrator writes the sixteen years out of
 * them, and it can, because they are specific: a household, a house, a rung
 * that house stands at, a bar it admits at, and whether it would even have
 * them.
 */
function theHouseholdTheyCameOutOf(birth: Birth): string[] {
    const said: string[] = [];
    const house = birth.house;
    if (house === null) {
        said.push(
            'No house behind them at all, which is nine births in ten. Nobody is owed anything '
            + 'for where they are standing and nobody is going to ask after them.'
        );
        return said;
    }

    // The house itself, in the terms a house is measured in. Every one of these
    // is a drawn field, and together they are what a childhood near a house was
    // actually like.
    said.push(
        `The family stands with ${house.name}, whose strongest member is at `
        + `${rankName(house.powerOrdinal)}, and which admits at `
        + `${rankName(house.admissionOrdinal)}.`
    );
    said.push(house.recruits
        ? `${house.name} takes people in, which is how anybody near it comes to think it is `
          + 'possible.'
        : `${house.name} does not advertise for anybody, and never has.`);
    return said;
}

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
    const home = getOrigin(birth.origin).ground;
    lines.push(
        `${age} years old, standing in ${birth.place.name}, a `
        + `${birth.place.kind.replace(/_/g, ' ')}, on `
        + `${theQiHereAgainstHome(birth.ground, home)}.`
    );

    // ── WHOSE THEY ARE, AND WHY THEY ARE NOT THERE ───────────────────────
    lines.push(`What they came out of: ${birth.opening.name}.`);
    lines.push(...theHouseholdTheyCameOutOf(birth));

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
