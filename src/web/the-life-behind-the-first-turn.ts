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
 * the rest of the engine uses. The engine does not get to invent a mother.
 *
 * And it does not open a second channel for the sheet. The numbers stay where
 * they were - `describeBirth` still files the mechanical line - because a
 * player who wants their attributes should not have to read a paragraph for
 * them.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * AND THEN IT WAS WRITTEN, HANDED TO A MODEL, AND NEVER SEEN AGAIN
 * ══════════════════════════════════════════════════════════════════════════
 *
 * FOUND BY PLAYING, a second time, with ollama narrating. The whole of turn 0:
 *
 *     Nine Peaks. The air here is thick enough to notice on the first breath.
 *     [...] Mo Wanming is here and has not looked up. [...] It is an ordinary
 *     day and it intends to stay one.
 *
 * The sixteen years were composed, unshifted onto `facts.lines`, and handed to
 * the narrator - which is to say handed to a model asked, four hundred lines
 * later, for *"two or three short paragraphs"*. Given a dozen facts of which
 * the last three are the square in front of it, a small model writes the
 * square. Nothing was broken; the recap simply had no channel of its own, and
 * the one it shared was a request for brevity.
 *
 * The design owner: *"WHERE IS THE RECAP OF MY LIFE TO THIS POINT? HAVE THE
 * ENGINE RETURN IT FOR THE FIRST TURN."*
 *
 * So it does, and the important half of that is WHICH channel. `required`
 * exists for lines a player must read whatever the narrator does, and is the
 * wrong tool here: it matches on the words appearing in the prose, and the
 * narration prompt orders the model to *"write it again from nothing"*. A
 * required recap would therefore be appended on exactly the turns the narrator
 * did its job. See the banner on `withRequiredLines`, which names this trap.
 *
 * The recap is a RECORD, so it is filed as one: its own turn 0 engine ruling,
 * beside the sheet, in both modes, before the narrator is asked for anything.
 * The narrator still receives every fact - it must not contradict a childhood -
 * and is told they are already on the player's screen, so it writes the scene
 * instead of the summary. Two channels, one set of rows, said once.
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

/** One person this life starts already able to put a name to. */
export interface AFaceFromBeforeTheRun {
    readonly name: string;
    /** How they come to be known, in the knowledge table's own register. */
    readonly sourceNote: string;
}

/**
 * One statement of the life so far, and who it is for.
 *
 * TWO AUDIENCES, WHICH IS WHY THIS IS A ROW AND NOT A STRING. The narrator is
 * handed everything, including the one thing the world holds and this person
 * does not. The player is handed what they could know about themselves, in the
 * register a ruling is written in. Both come off the same row, so the two
 * accounts cannot drift apart.
 */
interface LifeLine {
    /** The fact, as the narrator is given it. */
    readonly text: string;
    /** The same fact as the ENGINE says it to the player, where the two differ. */
    readonly toThePlayer?: string;
    /**
     * True where the WORLD holds this and the person it is about does not. It
     * reaches the narrator as context it must not contradict, and reaches the
     * player on no channel at all.
     */
    readonly behindTheirBack?: boolean;
}

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
function theHouseholdTheyCameOutOf(birth: Birth): LifeLine[] {
    const said: LifeLine[] = [];
    const house = birth.house;
    if (house === null) {
        said.push({
            text:
                'No house behind them at all, which is nine births in ten. Nobody is owed '
                + 'anything for where they are standing and nobody is going to ask after them.',
            // The odds are a note to the NARRATOR about how unremarkable this
            // is. To the person living it there are no odds, and an opening
            // that told the player their birth was the common one would be the
            // engine talking to them about its own draw.
            toThePlayer:
                'No house behind them at all. Nobody is owed anything for where they are '
                + 'standing and nobody is going to ask after them.'
        });
        return said;
    }

    // The house itself, in the terms a house is measured in. Every one of these
    // is a drawn field, and together they are what a childhood near a house was
    // actually like.
    said.push({
        text:
            `The family stands with ${house.name}, whose strongest member is at `
            + `${rankName(house.powerOrdinal)}, and which admits at `
            + `${rankName(house.admissionOrdinal)}.`
    });
    said.push({
        text: house.recruits
            ? `${house.name} takes people in, which is how anybody near it comes to think it is `
              + 'possible.'
            : `${house.name} does not advertise for anybody, and never has.`
    });
    return said;
}

/** How many of the names drawn at birth are worth saying in the opening. */
export const NAMES_WORTH_SAYING_AT_THE_START = 3;

/**
 * The life so far, on the two channels that carry it.
 *
 * THE ONE THE ENGINE OWES. `toldToThePlayer` is filed as a turn 0 ruling of its
 * own, beside the sheet, and is the reason this type has two fields rather than
 * being a list of strings. See the banner on the caller in `turn-engine.ts`.
 */
export interface TheLifeSoFar {
    /** Every fact, for the narrator, which must not contradict any of it. */
    readonly forTheNarrator: readonly string[];
    /** What the player reads, whatever a model does or fails to do. */
    readonly toldToThePlayer: readonly string[];
}

/**
 * WHAT THIS PERSON HAS BEHIND THEM, as facts the narrator can write a life out
 * of and the engine can file as a record.
 *
 * Ordered the way a life is: where they come from, whose they are, what that
 * left them holding, what they have been told about the world, and who they can
 * already put a name to. The last two are the ones the opening existed without,
 * and are the reason a player used to have nothing to act on.
 *
 * @param faces The people a childhood leaves behind, already drawn and written
 *   to the knowledge table by `who-a-life-like-this-grew-up-knowing.ts`. Passed
 *   in rather than read here, because this module knows nothing about a world.
 */
export function theLifeBehindTheFirstTurn(
    birth: Birth,
    age: number,
    faces: readonly AFaceFromBeforeTheRun[] = []
): TheLifeSoFar {
    const lines: LifeLine[] = [];

    // -- WHERE, AND WHAT SORT OF GROUND ----------------------------------
    //
    // Sixteen years of breathing it, which is why the band is said as a
    // lifetime rather than as a reading. Somebody raised on thin ground has
    // never known anything else and has no reason to remark on it.
    const home = getOrigin(birth.origin).ground;
    lines.push({
        text:
            `${age} years old, standing in ${birth.place.name}, a `
            + `${birth.place.kind.replace(/_/g, ' ')}, on `
            + `${theQiHereAgainstHome(birth.ground, home)}.`
    });

    // -- WHOSE THEY ARE, AND WHY THEY ARE NOT THERE -----------------------
    lines.push({ text: `What they came out of: ${birth.opening.name}.` });
    lines.push(...theHouseholdTheyCameOutOf(birth));

    const inside = birth.raisedInside;
    if (inside !== null) {
        lines.push({
            text: inside.onTheRoll === 'by blood'
                ? `They grew up inside ${inside.house.name}, on its roll from birth because its `
                  + 'roll is its family, and at no rank in it.'
                : inside.onTheRoll === 'by taking'
                    ? `They grew up inside ${inside.house.name}, on its roll because it took them `
                      + 'in, at no rank in it, and nobody has told them why.'
                    : `They grew up inside ${inside.house.name} without ever being put on its roll.`
        });
        if (inside.somebodyIsOwedForIt) {
            // The player does not know this and the world does. Stated for the
            // record rather than for the prose, and the narrator must not have
            // anybody say it out loud - which is now enforced here rather than
            // asked for, because the engine's own recap would otherwise print
            // to the player the one thing nobody is going to tell them.
            lines.push({
                text:
                    'Somebody spent a word to put them there and is carrying the debt for it. '
                    + 'They have not been told, and nobody here is going to tell them.',
                behindTheirBack: true
            });
        }
    } else if (birth.house !== null) {
        lines.push({
            text:
                `The family belongs to ${birth.house.name}, which is not a rank and not an `
                + 'admission. It is who they would go to, not somewhere they may go.'
        });
    }

    // -- WHAT THAT LEFT THEM HOLDING --------------------------------------
    const years = birth.opening.provisionedYears;
    lines.push({
        text:
            `They are standing here with ${birth.spiritStones} spirit stones, which is `
            + (years < 1
                ? 'not a year of sitting still.'
                : `about ${Math.round(years)} years of sitting still.`)
    });

    // -- AND WHAT THEY HAVE BEEN TOLD, WHICH IS THE HALF THAT WAS MISSING -
    //
    // Reported as "3 names known" and nothing else. Every one of these rows
    // already carried who said it and what they said.
    const told = birth.knowledge.slice(0, NAMES_WORTH_SAYING_AT_THE_START);
    if (told.length === 0) {
        lines.push({
            text:
                'Nobody has told them anything about anywhere. Whatever they learn, they learn '
                + 'by walking up to it.'
        });
    } else {
        // Honest about the count. The mechanical line files the total, and
        // saying "three names, in full" beside a sheet reading eight is the
        // engine disagreeing with itself on one screen.
        const rest = birth.knowledge.length - told.length;
        lines.push({
            text:
                `What ${age} years got them: ${birth.knowledge.length} `
                + `name${birth.knowledge.length === 1 ? '' : 's'}`
                + (rest > 0
                    ? `, of which these are the ones they would say first.`
                    : `, and this is where each came from.`)
        });
        for (const row of told) {
            // The statement often opens with the name, and "Three Walls.
            // Three Walls is where they are from" is the engine stuttering.
            const said = row.statement.trim();
            lines.push({
                text: said.toLowerCase().startsWith(row.name.toLowerCase())
                    ? `${said} ${row.sourceNote}`
                    : `${row.name}. ${said} ${row.sourceNote}`
            });
        }
    }

    // -- AND THE FACES, WHICH IS THE OTHER HALF OF THE SAME DEFECT --------
    //
    // FOUND BY PLAYING. The opening's suggestions read *"I ask Han Ronglu to
    // teach me"* and *"I look at Mo Wanming"*, and the run had introduced
    // neither: this recap covered `birth.knowledge`, which is places and
    // houses, while the PEOPLE a childhood leaves are drawn separately by
    // `who-a-life-like-this-grew-up-knowing.ts` and seeded straight into the
    // knowledge table. The design owner: *"it needs to explain these names at
    // the bottom otherwise a new player is very confused."*
    //
    // The same defect as "3 names known", one table over. Every row already
    // carried a note saying how this person comes to know them, and the opening
    // said none of it, so the first screen offered a verb pointed at somebody
    // it had never named.
    if (faces.length > 0) {
        lines.push({
            text:
                'People they can already put a name to. Knowing somebody is not the same as '
                + 'being owed anything by them:'
        });
        for (const face of faces) {
            lines.push({ text: `${face.name}. ${face.sourceNote}` });
        }
    }

    return {
        forTheNarrator: lines.map(line => line.text),
        toldToThePlayer: lines
            .filter(line => line.behindTheirBack !== true)
            .map(line => line.toThePlayer ?? line.text)
    };
}
