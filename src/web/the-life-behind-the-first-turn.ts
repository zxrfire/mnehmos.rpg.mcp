/**
 * Sixteen years, said before the first turn asks anything of them.
 *
 * The opening was a character sheet and then a look at the square, and "3 names
 * known" was the tell: every one of those rows already carried the name, what
 * this person believes about it and who told them, drawn at birth and reported
 * as a digit. Nothing here is invented; it is the birth pass, printed.
 *
 * TWO CHANNELS, AND THE SPLIT IS THE POINT. `toldToThePlayer` is filed as its
 * own turn 0 engine ruling. It was once unshifted onto `facts.lines` instead,
 * which is to say handed to a model that is asked in the same prompt for "two
 * or three short paragraphs" - and measured with ollama narrating, the whole of
 * turn 0 came back as the square. Do not move it back onto the narrator's
 * channel, and do not reach for `required` either: that matches on the words
 * surviving into the prose, and the narration prompt orders the model to write
 * every fact again from nothing, so a required recap appends on exactly the
 * turns the narrator did its job.
 */

import type { Birth } from '../engine/birth/birth.js';
import { getOrigin } from '../engine/cultivation/origin.js';
import { rankName } from '../engine/cultivation/realms.js';
import type { AmbientQi } from '../schema/cultivation.js';
import { asToldToThePlayer, asToldToTheNarrator, type SaidToBoth } from './facts.js';

/** The bands in order, so two of them can be compared without a table. */
const HOW_MUCH_QI: readonly AmbientQi[] = ['thin', 'normal', 'dense', 'spirit_tide'];

/**
 * The ground they stand on, against the ground that raised them.
 *
 * Every branch names QI. This read `on ${band} ground`, and a model handed
 * "normal ground" wrote about heavy air in the lungs: the word `ground` alone
 * leaves a model to guess what is thin or thick about it and the guess is
 * always weather. The comparison against home is what makes the band mean
 * anything to somebody who has only ever stood on one.
 */
function theQiHereAgainstHome(here: AmbientQi, home: AmbientQi): SaidToBoth {
    const step = HOW_MUCH_QI.indexOf(here) - HOW_MUCH_QI.indexOf(home);
    const raised = WHAT_RAISED[home];
    const [them, you] = [`${raised} them`, `${raised} you`];
    if (step > 1) return {
        text: `ground so much thicker with qi than ${them} that they have no measure for it`,
        toThePlayer: `ground so much thicker with qi than ${you} that you have no measure for it`
    };
    if (step === 1) return {
        text: `ground thicker with qi than ${them}, and they can feel the difference without `
            + 'being able to name it',
        toThePlayer: `ground thicker with qi than ${you}, and you can feel the difference `
            + 'without being able to name it'
    };
    // The commonest case by far, and the one branch that used to say only
    // "ground" - the exact word that let a model reach for weather.
    if (step === 0) return {
        text: `ground with the same qi in it as ${them}, which is the only measure of it they `
            + 'have ever had',
        toThePlayer: `ground with the same qi in it as ${you}, which is the only measure of `
            + 'it you have ever had'
    };
    return {
        text: `ground thinner with qi than ${them}, which they noticed and have said nothing `
            + 'about',
        toThePlayer: `ground thinner with qi than ${you}, which you noticed and have said `
            + 'nothing about'
    };
}

/**
 * What a band is, from the inside, for the half of the sentence about home.
 *
 * Open at the end, because the person changes with the audience and the noun
 * does not - one table rather than a second one with `you` typed into it.
 */
const WHAT_RAISED: Readonly<Record<string, string>> = Object.freeze({
    thin: 'the county that raised',
    normal: 'the ground that raised',
    dense: 'the rich ground that raised',
    spirit_tide: 'the tide-ground that raised'
});

/** One person this life starts already able to put a name to. */
export interface AFaceFromBeforeTheRun {
    readonly name: string;
    /** How they come to be known, in the knowledge table's own register. */
    readonly sourceNote: string;
}

/** One statement of the life so far, drawn once and rendered for two audiences. */
interface LifeLine extends SaidToBoth {
    /**
     * True where the WORLD holds this and the person it is about does not. A
     * field rather than an instruction to the narrator, because the engine now
     * prints this channel and an instruction would not have held.
     */
    readonly behindTheirBack?: boolean;
}

/**
 * The house, as drawn fields rather than as a story about them.
 *
 * No authored childhoods here. The birth pass already draws every variable one
 * is made of, so tables of written upbringings drawn per origin tier - an
 * earlier cut of this file - were the engine composing prose.
 */
function theHouseholdTheyCameOutOf(birth: Birth): LifeLine[] {
    const said: LifeLine[] = [];
    const house = birth.house;
    if (house === null) {
        said.push({
            text:
                'No house behind them at all, which is nine births in ten. Nobody is owed '
                + 'anything for where they are standing and nobody is going to ask after them.',
            // The odds are for the narrator. To the person living it there are
            // none, and telling a player their birth was the common one is the
            // engine talking to them about its own draw.
            toThePlayer:
                'No house behind you at all. Nobody is owed anything for where you are '
                + 'standing and nobody is going to ask after you.'
        });
        return said;
    }

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

export interface TheLifeSoFar {
    /** Every fact, for the narrator, which must not contradict any of it. */
    readonly forTheNarrator: readonly string[];
    /** What the player reads, whatever a model does or fails to do. */
    readonly toldToThePlayer: readonly string[];
}

/**
 * What this person has behind them, ordered the way a life is: where they come
 * from, whose they are, what that left them holding, what they have been told,
 * and who they can already put a name to.
 *
 * @param faces Drawn and seeded by `who-a-life-like-this-grew-up-knowing.ts`.
 *   Passed in rather than read here, because this module knows no world.
 */
export function theLifeBehindTheFirstTurn(
    birth: Birth,
    age: number,
    faces: readonly AFaceFromBeforeTheRun[] = []
): TheLifeSoFar {
    const lines: LifeLine[] = [];

    // Said as a lifetime rather than as a reading. Somebody raised on thin
    // ground has never known anything else and has no reason to remark on it.
    const home = getOrigin(birth.origin).ground;
    const ground = theQiHereAgainstHome(birth.ground, home);
    const standingIn =
        `${age} years old, standing in ${birth.place.name}, a `
        + `${birth.place.kind.replace(/_/g, ' ')}, on `;
    lines.push({
        text: `${standingIn}${ground.text}.`,
        toThePlayer: `${standingIn}${ground.toThePlayer ?? ground.text}.`
    });

    lines.push({
        text: `What they came out of: ${birth.opening.name}.`,
        toThePlayer: `What you came out of: ${birth.opening.name}.`
    });
    lines.push(...theHouseholdTheyCameOutOf(birth));

    const inside = birth.raisedInside;
    if (inside !== null) {
        lines.push(inside.onTheRoll === 'by blood'
            ? {
                text: `They grew up inside ${inside.house.name}, on its roll from birth because `
                    + 'its roll is its family, and at no rank in it.',
                toThePlayer: `You grew up inside ${inside.house.name}, on its roll from birth `
                    + 'because its roll is its family, and at no rank in it.'
            }
            : inside.onTheRoll === 'by taking'
                ? {
                    text: `They grew up inside ${inside.house.name}, on its roll because it took `
                        + 'them in, at no rank in it, and nobody has told them why.',
                    toThePlayer: `You grew up inside ${inside.house.name}, on its roll because it `
                        + 'took you in, at no rank in it, and nobody has told you why.'
                }
                : {
                    text: `They grew up inside ${inside.house.name} without ever being put on its `
                        + 'roll.',
                    toThePlayer: `You grew up inside ${inside.house.name} without ever being put `
                        + 'on its roll.'
                });
        if (inside.somebodyIsOwedForIt) {
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
                + 'admission. It is who they would go to, not somewhere they may go.',
            toThePlayer:
                `The family belongs to ${birth.house.name}, which is not a rank and not an `
                + 'admission. It is who you would go to, not somewhere you may go.'
        });
    }

    const years = birth.opening.provisionedYears;
    const whatTheStonesBuy = years < 1
        ? 'not a year of sitting still.'
        : `about ${Math.round(years)} years of sitting still.`;
    lines.push({
        text: `They are standing here with ${birth.spiritStones} spirit stones, which is `
            + whatTheStonesBuy,
        toThePlayer: `You are standing here with ${birth.spiritStones} spirit stones, which is `
            + whatTheStonesBuy
    });

    const told = birth.knowledge.slice(0, NAMES_WORTH_SAYING_AT_THE_START);
    if (told.length === 0) {
        lines.push({
            text:
                'Nobody has told them anything about anywhere. Whatever they learn, they learn '
                + 'by walking up to it.',
            toThePlayer:
                'Nobody has told you anything about anywhere. Whatever you learn, you learn '
                + 'by walking up to it.'
        });
    } else {
        // The true total, because the sheet files it too and "three names, in
        // full" beside a sheet reading eight is one screen disagreeing with
        // itself.
        const rest = birth.knowledge.length - told.length;
        const howMany = `${birth.knowledge.length} name${birth.knowledge.length === 1 ? '' : 's'}`;
        lines.push({
            text: `What ${age} years got them: ${howMany}`
                + (rest > 0
                    ? ', of which these are the ones they would say first.'
                    : ', and this is where each came from.'),
            toThePlayer: `What ${age} years got you: ${howMany}`
                + (rest > 0
                    ? ', of which these are the ones you would say first.'
                    : ', and this is where each came from.')
        });
        for (const row of told) {
            // "Three Walls. Three Walls is where they are from" is the engine
            // stuttering because two fields happen to agree.
            const said = row.statement.trim();
            lines.push({
                text: said.toLowerCase().startsWith(row.name.toLowerCase())
                    ? `${said} ${row.sourceNote}`
                    : `${row.name}. ${said} ${row.sourceNote}`
            });
        }
    }

    // The same defect as "3 names known", one table over: the opening offered
    // "I ask Han Ronglu to teach me" over a run that had never named him,
    // because the faces a childhood leaves live in a different table from
    // `birth.knowledge` and this said only the latter.
    if (faces.length > 0) {
        lines.push({
            text:
                'People they can already put a name to. Knowing somebody is not the same as '
                + 'being owed anything by them:',
            toThePlayer:
                'People you can already put a name to. Knowing somebody is not the same as '
                + 'being owed anything by them:'
        });
        for (const face of faces) {
            lines.push({ text: `${face.name}. ${face.sourceNote}` });
        }
    }

    return {
        forTheNarrator: asToldToTheNarrator(lines),
        toldToThePlayer: asToldToThePlayer(lines.filter(line => line.behindTheirBack !== true))
    };
}
