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
    /**
     * Where the world has them standing, read as the run opens. Null where it
     * holds no place for them, which is said rather than papered over.
     */
    readonly whereTheyAre: { readonly name: string } | null;
    /**
     * The household tie the world records, where there is one. A parent is not
     * one of the faces that was always at the well, and the two are said apart
     * for that reason.
     */
    readonly tie: string | null;
    /** Null while they are alive. There is no address for somebody who is not. */
    readonly diedYearsAgo: number | null;
    /**
     * Set where the world holds a killing this person was the victim of, with
     * the killer's name already put through the holder's knowledge gate - null
     * where this life has no way to say who it was.
     *
     * `byName` and not the world's own `killerName`, so that handing the raw
     * read from `who-a-life-like-this-grew-up-knowing.ts` straight through does
     * not typecheck. A name in this engine is earned; the caller has to have
     * asked whether this one was.
     */
    readonly killedBy?: {
        readonly byName: string | null;
        /**
         * Whether this life may open an account about it.
         *
         * The engine's own tier, not a second notion of closeness invented
         * here: `whoTheyCarryFor` answers whose killing somebody may carry, off
         * the ties the world wrote, and the caller asks it. A neighbour is a
         * name and a killing; kin is that and something the player can act on.
         */
        readonly yoursToCarry: boolean;
    } | null;
    /**
     * True where the life names them and claims nothing else - a mortal
     * household. Said with no whereabouts at all, which is not the same as
     * saying nobody knows where they are: nothing was ever claimed.
     */
    readonly aMentionOnly?: boolean;
}

/**
 * Somebody a heading cannot promise a whereabouts for.
 *
 * A heading promises only what the lines under it deliver, and there are two
 * ways a line has nothing to deliver: a mortal household, which claims nothing
 * because nothing tracks a mortal, and somebody who is dead, for whom there is
 * no address at all. "Nobody could say where they are standing now" is not one
 * of these - it answers the question.
 */
function noWhereaboutsToGive(face: AFaceFromBeforeTheRun): boolean {
    return face.aMentionOnly === true || face.diedYearsAgo !== null;
}

/**
 * Where to go looking for somebody, said as a fact about them and not as a
 * route.
 *
 * The design owner, on a quarter of runs opening in a square with fewer than
 * three people in it: *"even they aren't there, you know where to find them"*.
 * A name with no place attached is the half of an acquaintance that cannot be
 * acted on, and turn one is exactly when a player has nothing else to go on.
 *
 * One person for both channels, because none of these three says "you" or
 * "them" at all - the subject is the person being placed, not the holder.
 */
function whereToFindThem(face: AFaceFromBeforeTheRun, home: string): string {
    // SOMEBODY KILLED IS A DIFFERENT SENTENCE FROM SOMEBODY DEAD, and it is
    // said before every other branch including the mention.
    //
    // A world opens holding a few killings, drawn with no player in it, and a
    // life opens knowing a handful of people. Nothing asked whether those two
    // sets overlapped, so a childhood with a victim in it printed `Dead these
    // 12 years.` over a wrong the world is still carrying an open account for.
    //
    // Ahead of the mention rather than under it, because that rule is about
    // WHEREABOUTS going stale - nothing tracks a mortal, so a place named here
    // would be true only on the day it was printed. An ending does not go
    // stale. It already happened and it is not going to happen differently.
    if (face.diedYearsAgo !== null && face.killedBy) {
        const when = face.diedYearsAgo < 1 ? 'not a year ago' : `${face.diedYearsAgo} years ago`;
        // A stranger is the better sentence and it is also the commoner one.
        // The wrongs pass draws a killer from a whole province and a childhood
        // reaches one settlement, so the name is often not one this life has
        // ever been given - which is a motive rather than a hole in the record.
        const said = face.killedBy.byName === null
            ? `Killed ${when}, and nobody has put a name to who did it`
            : `Killed by ${face.killedBy.byName}, ${when}`;
        // AND WHAT IT ENTITLES THEM TO, WHICH IS THE ENGINE'S TIER AND NOT A
        // SECOND ONE. Somebody the world lets you carry for can take the
        // account to a house; a face from the same street cannot, and the
        // difference is `whoTheyCarryFor`'s to state. Said only where it is
        // true, because the absence is what makes a neighbour's killing read
        // as a neighbour's.
        return face.killedBy.yoursToCarry ? `${said}. The account is yours to carry.` : `${said}.`;
    }
    // A MENTION SAYS NOTHING ABOUT WHERE, and says nothing rather than saying
    // that nobody knows. Mortals are not tracked, so a place named here would
    // be true on the day it was printed and unmaintained ever after.
    if (face.aMentionOnly === true) return '';
    // The ending rather than the address, and said before the place is read at
    // all: a dead person's row keeps the location they died in, so asking where
    // first would send the player to a square to look for somebody who is not
    // going to be in it.
    if (face.diedYearsAgo !== null) {
        return face.diedYearsAgo < 1
            ? 'Dead, and not a year ago.'
            : `Dead these ${face.diedYearsAgo} years.`;
    }
    if (face.whereTheyAre === null) return 'Nobody could say where they are standing now.';
    // Terse where it is the place the recap opened by naming. Three or four
    // faces are usual and nearly all of them are standing here, so the long
    // form - "which is where you are standing" - was one clause repeated down
    // the block and read as a roster rather than as a life.
    if (face.whereTheyAre.name === home) return `Still in ${home}.`;
    return `In ${face.whereTheyAre.name} now.`;
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
                'No house behind them at all. Nobody is owed anything for where they are '
                + 'standing and nobody is going to ask after them.',
            // The odds used to sit on the narrator's copy, as a note about how
            // unremarkable this birth is. Measured against the local model: it
            // repeated them - "which is the way of it for nine births in ten" -
            // so the engine's own draw reached the player through the prose. A
            // fact the narrator may not say is a fact not worth handing over.
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
 * from, whose they are, what that left them holding, who they can already put a
 * name to and where each of those people is, and what they have been told about
 * anywhere.
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

    // THE PEOPLE BEFORE THE PLACES, because the question a life answers first
    // is who is in it. The two blocks were the other way round, and the count
    // line below - "what 16 years got you: 3 names" - was then the first answer
    // on the screen while holding nothing but places and houses. The design
    // owner read exactly that and said not one of them was a person.
    //
    // FAMILY BEFORE THE STREET, and said apart from it. A parent came back in
    // the same list as the woman at the well because a face was a face; the
    // household tie is on the row and it reads as family once it is used.
    const family = faces.filter(one => one.tie !== null);
    const theStreet = faces.filter(one => one.tie === null);
    // ── A NAME AND A LABEL UNDER IT IS NOT AN ACCOUNT OF A LIFE ──────────
    //
    // This printed `Lu Nuoming. Grew up on the same road. Still in Wind Turn.`
    // and the narrator wrote what it was shown: an opening that was a roll of
    // names, one line each, with dialogue hung on some of them. The design
    // owner, reading it - *"this isn't xianxia, you don't open with a list of
    // names and what they're saying"*, *"who are these randos?"*, and of the
    // one that came through in the passive, *"why the passive voice?"*.
    //
    // The notes are predicates now (`HOW_YOU_KNOW_THEM`), so the name goes in
    // front of one and the result is a sentence somebody could say out loud.
    // What a person IS to this cultivator is the substance; the label was the
    // defect. The household of one says so, because being the only person in
    // the house is the fact that gives the rest of the line its weight.
    const sayThem = (said: readonly AFaceFromBeforeTheRun[], aloneInTheHouse = false): void => {
        for (const one of said) {
            const where = whereToFindThem(one, birth.place.name);
            const only = aloneInTheHouse
                ? ' There has never been anybody else in the house.'
                : '';
            lines.push({
                text: `${one.name} ${one.sourceNote}${only} ${where}`.trimEnd()
            });
        }
    };

    if (family.length > 0) {
        lines.push({
            text: family.some(noWhereaboutsToGive)
                ? 'The household:'
                : 'The household, and where each of them is now:'
        });
        sayThem(family, family.length === 1);
    }
    if (theStreet.length > 0) {
        const knowing =
            'Knowing somebody is not the same as being owed anything by them:';
        // THE SAME RULE AS THE HOUSEHOLD'S, AND IT IS NOW REACHABLE FROM BOTH
        // BLOCKS. This heading could once only be true, because the street draw
        // took the living and nobody else. It takes somebody killed inside this
        // life's own years as well, and a dead person has no whereabouts at all
        // - so the clause goes when anybody under it cannot answer it.
        lines.push({
            text: theStreet.some(noWhereaboutsToGive)
                ? `People they can already put a name to. ${knowing}`
                : `People they can already put a name to, and where each of them is. ${knowing}`,
            toThePlayer: theStreet.some(noWhereaboutsToGive)
                ? `People you can already put a name to. ${knowing}`
                : `People you can already put a name to, and where each of them is. ${knowing}`
        });
        sayThem(theStreet);
    }

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
        // OF PLACES AND HOUSES, and the words are load-bearing. `birth.knowledge`
        // holds no people at all - the faces a childhood leaves are drawn off the
        // world and are the block above - so a bare "3 names" read as the whole
        // of what sixteen years came to, and every one of them was a place.
        const howMany = `${birth.knowledge.length} name${birth.knowledge.length === 1 ? '' : 's'}`
            + ' of places and houses';
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

    return {
        forTheNarrator: asToldToTheNarrator(lines),
        toldToThePlayer: asToldToThePlayer(lines.filter(line => line.behindTheirBack !== true))
    };
}
