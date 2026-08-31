/**
 * What comes back when the player asks somebody something.
 *
 * `docs/world/asking.md` is the specification and it is emphatic that none of
 * this is a mechanic: no roll, no unlock, no phrase the world checks for, and
 * nothing that varies run to run. What it does say is the division of labour
 * this file implements - "the engine holds the facts; the judgement is
 * narration."
 *
 * So the engine's whole job here is to answer three questions off real rows,
 * which asking.md is careful to call three separate limits:
 *
 *   1. what this person could know,
 *   2. what they are in a position to say,
 *   3. what saying it would cost them.
 *
 * The result is a `reach`, and the narrator is handed observable behaviour
 * rather than the reach. That split is the reason the two channels exist:
 * `lines` say what the person did, `structure` says which limit bit. A player
 * reads the first and learns to tell them apart over a run; a developer reads
 * the second and can see immediately whether the engine was right.
 *
 * Nothing here is random. The same person asked the same thing on the same day
 * answers the same way, because asking.md's one hard rule is that the world's
 * habits must be stable enough for the person playing to learn them.
 */

import type { Cultivator } from '../schema/cultivation.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { ResolvedEntity } from './entities.js';
import { WORKING_KNOWLEDGE_MARGIN } from './hearsay.js';

/**
 * How far the answer got. Named for what the player sees, not for the rule.
 *
 * `blank` and `deflects` are deliberately adjacent: asking.md wants ignorance
 * and evasion to be hard to tell apart at first and easy later, so the lines
 * for the two are built to rhyme and the difference is left in behaviour a
 * player can learn to read rather than in a label.
 */
export type Reach = 'answers' | 'partial' | 'guesses' | 'deflects' | 'blank';

export interface AskedInput {
    asker: Cultivator;
    asked: RosterEntry;
    /** What the question was about, when it resolved to something real. */
    subject: ResolvedEntity | null;
    /** What the player typed, when it resolved to nothing. */
    rawTopic: string;
    /**
     * Whether the asked person holds a record of the subject themselves.
     *
     * True is decisive. False is not: most people in this world hold no rows at
     * all, and treating an empty table as ignorance would make everyone a
     * fool. Absence falls through to the stratum reading below.
     */
    holdsIt: boolean;
    /**
     * How many times the player has dealt with this person before.
     *
     * asking.md calls this the cheapest lever in the game and it is available
     * to a cultivator with nothing: turning up twice counts, and it counts for
     * more than realm does.
     */
    priorDealings: number;
    /**
     * What to call them, or null when the player cannot name them yet.
     *
     * Standing in the same square is permission to see somebody, never to
     * know who they are. A stranger who answers a question has introduced
     * themselves and the caller writes that down; a stranger who shrugs has
     * not, and putting their name in the prose would hand the player an
     * acquisition the world declined to make.
     */
    speakerName: string | null;
}

export interface Answer {
    reach: Reach;
    /** Observable. What they did, and the substance when there was any. */
    lines: string[];
    /** Which of the three limits bit, and why. Inspector only. */
    structure: string[];
    /**
     * Whether the player has genuinely acquired the subject.
     *
     * Only true when something was actually said. A shrug teaches nothing, and
     * writing a knowledge record for a deflection would hand the player a name
     * the world declined to give them.
     */
    teaches: boolean;
    /**
     * Whether the player now knows who they were talking to.
     *
     * True when they actually said something. Being answered at length and
     * wrongly still counts - the carter told you his name while he was
     * telling you everything else.
     */
    introduces: boolean;
}

/**
 * Whether this person has a position to protect.
 *
 * asking.md's real rule: what closes a mouth is position, not power. A sect
 * rank is an account somebody has to give of themselves; having none is the
 * thing that makes a wandering expert forthcoming, and it is why the useful
 * person is usually two rungs below the one who actually knows.
 */
function attached(asked: RosterEntry): boolean {
    return asked.sectId !== null && asked.sectId.length > 0;
}

/**
 * Whether the subject is within this person's working knowledge.
 *
 * A carter asked about something above his stratum is not being cagey. He has
 * never needed the word.
 */
function withinStratum(asked: RosterEntry, subject: ResolvedEntity | null): boolean {
    if (!subject) return false;
    const ordinal = subjectOrdinal(subject);
    if (ordinal === null) return true;
    return ordinal <= asked.realmOrdinal + WORKING_KNOWLEDGE_MARGIN;
}

/**
 * The subject's standing, when the structure channel recorded one.
 *
 * Read off the inspector strings rather than re-derived, so there is one place
 * that decides what an ordinal is and this is not it.
 */
function subjectOrdinal(subject: ResolvedEntity): number | null {
    for (const line of subject.structure) {
        const match = /ordinal[^0-9-]{0,12}(-?\d+)/i.exec(line);
        if (match) return Number(match[1]);
    }
    return null;
}

/**
 * What came of asking.
 *
 * Reads as a sequence of gates rather than a score, because the three limits
 * are separate and a player should be able to work out which one they hit.
 */
export function askedAbout(input: AskedInput): Answer {
    const { asked, subject, holdsIt, priorDealings } = input;
    // How the prose refers to them. A name the player has earned, or the
    // shape of a person they have not.
    const who = input.speakerName ?? 'The one nearest to hand';
    const structure: string[] = [
        `Asked ${asked.name} (ordinal ${asked.realmOrdinal}, ` +
        `${attached(asked) ? `${asked.sectName ?? 'a sect'} as ${asked.sectRank ?? 'a member'}` : 'unattached'}).`
    ];

    // ── limit one: could they know ──
    const couldKnow = holdsIt || withinStratum(asked, subject);
    structure.push(
        holdsIt
            ? 'They hold a record of it themselves.'
            : subject
                ? `No record; subject ${couldKnow ? 'is within' : 'sits above'} their working knowledge ` +
                  `(margin ${WORKING_KNOWLEDGE_MARGIN}).`
                : 'The question resolved to nothing in the catalogs, so there is nothing they could be right about.'
    );

    // ── limit two: are they placed to say it ──
    const holdsPosition = attached(asked);
    // Turning up twice beats realm. Two prior dealings buys back exactly one
    // step of reticence, and no amount of it opens a mouth that a position has
    // closed - an official is not being difficult, he is being an official.
    const goodwill = Math.min(2, priorDealings);
    structure.push(
        `Position: ${holdsPosition ? 'has an account to give' : 'owes nobody an account'}. ` +
        `Prior dealings ${priorDealings} (counts ${goodwill}).`
    );
    // Charm is on the record because it moves the margin - how warm the refusal
    // is, whether one thing gets mentioned on the way out - and it is on the
    // inspector channel rather than in a conditional because it is not a key.
    structure.push(`Asker charm ${input.asker.attributes.charm}; margin only, never a gate.`);

    if (!couldKnow) {
        // Somebody with nothing to protect fills the gap. Somebody with a
        // position does not, which is why the confident wrong answer and the
        // useful one come from the same kind of person.
        if (holdsPosition) {
            return {
                reach: 'blank',
                lines: [
                    `${who} hears the question out and does not answer it, in the manner of ` +
                    'somebody who has answered a great many questions.'
                ],
                structure: [...structure, 'Reach: blank. Above their stratum, and placed to say nothing.'],
                teaches: false,
                introduces: false
            };
        }
        return {
            reach: 'guesses',
            lines: [
                `${who} answers straight away and at length, and none of it hangs together ` +
                'with anything else the player has been told.'
            ],
            structure: [...structure, 'Reach: guesses. Above their stratum, nothing to protect, so they fill it.'],
            teaches: false,
            introduces: true
        };
    }

    if (holdsPosition && goodwill < 2) {
        // Warm, useless, and not a refusal - a deflection has to be survivable
        // or the player learns to stop asking rather than learning who to ask.
        return {
            reach: 'deflects',
            lines: [
                `${who} gives an answer general enough to contain nothing, and moves the ` +
                'conversation somewhere easier.'
            ],
            structure: [...structure, 'Reach: deflects. Knows it; the account they owe costs more than the telling.'],
            teaches: false,
            introduces: false
        };
    }

    if (!subject) {
        return {
            reach: 'blank',
            lines: [`${who} does not follow the question, and says so.`],
            structure: [...structure, 'Reach: blank. Nothing was named that anybody could answer.'],
            teaches: false,
            // They engaged with the question, which is more than a shrug.
            introduces: true
        };
    }

    // ── a real answer, bounded by what they know ──
    //
    // The substance is the subject's own observable facts, unchanged. This
    // layer decides whether they were said, never what they are.
    const full = !holdsPosition || goodwill >= 2;
    const said = full ? subject.facts : subject.facts.slice(0, 1);

    return {
        reach: full ? 'answers' : 'partial',
        lines: [
            `${who} names ${subject.name}.`,
            ...said,
            ...(full ? [] : ['That is as far as it goes, and the next question does not get one.'])
        ],
        structure: [
            ...structure,
            `Reach: ${full ? 'answers' : 'partial'}. ${said.length} of ${subject.facts.length} facts said.`,
            ...subject.structure
        ],
        teaches: true,
        introduces: true
    };
}
