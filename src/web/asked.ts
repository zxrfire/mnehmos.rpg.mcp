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
    /**
     * Whether standing has already overridden their unwillingness.
     *
     * The one hook a DEMAND has into this file, and it is deliberately the
     * smallest one that could work. asking.md's three limits are what a person
     * asked politely runs into; a demand is the same question with weight
     * behind it, and weight can only ever move the SECOND and THIRD of them -
     * what they are placed to say and what saying it would cost.
     *
     * It cannot move the first, and the guarantee is structural rather than
     * remembered: limit one is tested above the branch this flag is read in, so
     * a compelled answer from somebody who does not know the answer is not a
     * case anybody has to think about. It cannot be reached.
     *
     *   > "Somebody who does not know the answer cannot be made to know it,
     *   >  however far above them you stand."
     *
     * Set by `making-somebody-tell-you.ts` off a landed `resolveAttempt`, and
     * by nothing else. This file decides nothing about whether the demand
     * worked - it is told.
     */
    compelled?: boolean;
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
    /**
     * Whether limit one was passed: could this person know it at all.
     *
     * Exposed because a demand has to be able to tell the two refusals apart
     * before it spends anybody's day on an attempt. Leaning on somebody who is
     * withholding is a thing that can work; leaning on somebody who has never
     * heard of it is not, and the two must not read alike.
     */
    couldKnow: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THEY DID, IN WORDS
//
// asking.md's one hard rule about variation: "Do not randomise across runs.
// The world's habits should be stable enough to learn." So these are picked by
// a stable hash of who was asked and what about, never by a roll. The same
// person asked the same thing answers the same way for ever, and two different
// questions to the same person do not come back byte-identical - which is what
// made ignorance and evasion impossible to tell apart at any point in a run
// rather than merely at first.
// ─────────────────────────────────────────────────────────────────────────

/** Attached, and the question named something they are placed to say nothing about. */
const BLANK_LINES: readonly string[] = [
    '{who} hears the question out and does not answer it, with the ease of somebody who ' +
    'has been asked a great many things.',
    '{who} lets the question sit, looks at something behind you, and does not pick it up.',
    '{who} waits until it is clear no answer is coming, and then asks what you wanted here.'
];

/** Attached, and the question landed on nothing they could place. */
const UNPLACEABLE_LINES: readonly string[] = [
    '{who} turns "{topic}" over once, says something true about the weather on that road, ' +
    'and lets it go.',
    '{who} says they could not tell you, in the tone of somebody who could tell you a great ' +
    'deal about something adjacent, and does not.',
    '{who} asks who told you that, does not wait for the answer, and moves the conversation ' +
    'somewhere easier.'
];

/** Attached, knows it, and the account they owe costs more than the telling. */
const DEFLECT_LINES: readonly string[] = [
    '{who} gives an answer general enough to contain nothing, and moves the conversation ' +
    'somewhere easier.',
    '{who} agrees that it is a good question, agrees that people do ask it, and has finished ' +
    'speaking.',
    '{who} answers a slightly different question, thoroughly, and looks pleased to have helped.'
];

/** Unattached, above their stratum, and nothing at all stopping them. */
const GUESS_LINES: readonly string[] = [
    '{who} answers straight away and at length, and none of it sits with anything else you ' +
    'have been told.',
    '{who} has a view on it, delivers the whole view, and is quite certain throughout.',
    '{who} starts with what their uncle said, and by the end of it has settled several things ' +
    'nobody asked about.'
];

/** Unattached, and the question named nothing anybody could answer. */
const UNATTACHED_UNPLACEABLE_LINES: readonly string[] = [
    '{who} has never heard "{topic}" said before, and answers anyway, at some length.',
    '{who} is fairly sure they know what you mean by "{topic}", and is not.',
    '{who} takes "{topic}" for something else entirely and tells you about that instead.'
];

/**
 * Which line this person gives, decided once and for ever.
 *
 * A hash rather than a roll: nothing here consumes an RNG stream, nothing
 * varies between runs, and the same question to the same person is the same
 * answer in a replay. That is the whole of asking.md's stability rule, and the
 * reason the person playing can learn the world's habits at all.
 */
function pick(lines: readonly string[], who: string, topic: string, askedId: string): string {
    let hash = 2166136261;
    for (const text of [askedId, topic.trim().toLowerCase()]) {
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        hash ^= 0x5f;
    }
    const chosen = lines[Math.abs(hash) % lines.length];
    return chosen
        .replace('{who}', who)
        .replace('{topic}', topic.trim() || 'it');
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
            // ── Two different failures, and they used to be one ──
            //
            // A question that resolved to something ABOVE this person is a wall:
            // they are placed to say nothing and they say nothing, and that is
            // asking.md's official who is not being difficult.
            //
            // A question that resolved to NOTHING is a different situation
            // entirely, and collapsing the two is what made the asking surface
            // useless. Almost every question a new cultivator asks resolves to
            // nothing, because they have no names to ask with - so the stratum
            // test could never pass, every attached speaker returned `blank`,
            // and `blank` is the one reach that can never deposit a name. Two
            // entirely different questions came back byte-identical, forever,
            // and a player learned that asking does not work. It was the single
            // largest hole in the discovery layer.
            //
            // What actually happens when somebody with a position is asked
            // something they cannot place is that they say something warm and
            // empty and move it along - which is `deflects`, and a deflection
            // is worth sitting through precisely because it can still drop the
            // one thing on the way out.
            if (!subject) {
                return {
                    reach: 'deflects',
                    couldKnow: false,
                    lines: [pick(UNPLACEABLE_LINES, who, input.rawTopic, asked.id)],
                    structure: [
                        ...structure,
                        'Reach: deflects. Nothing in the question they could place, and a position ' +
                        'that makes guessing at it a bad idea.'
                    ],
                    teaches: false,
                    introduces: false
                };
            }
            return {
                reach: 'blank',
                couldKnow: false,
                lines: [pick(BLANK_LINES, who, input.rawTopic, asked.id)],
                structure: [...structure, 'Reach: blank. Above their stratum, and placed to say nothing.'],
                teaches: false,
                introduces: false
            };
        }
        return {
            reach: 'guesses',
            couldKnow: false,
            lines: [pick(GUESS_LINES, who, input.rawTopic, asked.id)],
            structure: [...structure, 'Reach: guesses. Above their stratum, nothing to protect, so they fill it.'],
            teaches: false,
            introduces: true
        };
    }

    // ── limit three, and the one a DEMAND can reach ──
    //
    // They know it and the account they owe costs more than the telling. That
    // is a judgement about what saying it is worth to them, and a judgement is
    // exactly the kind of thing weight moves - which is the whole of what
    // `compelled` is for. Note where the flag is read: BELOW limit one, so it
    // has already been established that there is something here to be got out
    // of them. Somebody who does not know cannot be leaned into knowing, and
    // that is enforced by the position of this branch rather than by a rule.
    if (holdsPosition && goodwill < 2 && !input.compelled) {
        // Warm, useless, and not a refusal - a deflection has to be survivable
        // or the player learns to stop asking rather than learning who to ask.
        return {
            reach: 'deflects',
            couldKnow: true,
            lines: [pick(DEFLECT_LINES, who, input.rawTopic, asked.id)],
            structure: [...structure, 'Reach: deflects. Knows it; the account they owe costs more than the telling.'],
            teaches: false,
            introduces: false
        };
    }
    if (input.compelled) {
        structure.push(
            'Compelled: the account they owe was outweighed, so limit two did not bite. '
            + 'Limit one was passed before this was read - nothing here can make somebody know '
            + 'a thing they do not.'
        );
    }

    if (!subject) {
        // Unattached, and asked about something that named nothing. They engage,
        // get nowhere, and fill the space - which is the carter answering
        // confidently and wrongly, and it is `guesses` rather than `blank`
        // because something came out of their mouth and the player has no way
        // to tell that it was worthless.
        return {
            reach: 'guesses',
            couldKnow: true,
            lines: [pick(UNATTACHED_UNPLACEABLE_LINES, who, input.rawTopic, asked.id)],
            structure: [
                ...structure,
                'Reach: guesses. Nothing was named that anybody could answer, and nothing ' +
                'stops them answering anyway.'
            ],
            teaches: false,
            // They engaged with the question, which is more than a shrug.
            introduces: true
        };
    }

    // ── a real answer, bounded by what they know ──
    //
    // The substance is the subject's own observable facts, unchanged. This
    // layer decides whether they were said, never what they are.
    //
    // `compelled` is deliberately absent from this line, and the consequence is
    // worth having rather than an oversight: somebody with a position who was
    // MADE to answer lands on `partial` - the first fact and no more, and "that
    // is as far as it goes". So a demand that works still gets less out of
    // somebody than turning up twice does. You can make a person tell you, and
    // what you get is the least they can get away with saying.
    const full = !holdsPosition || goodwill >= 2;
    const said = full ? subject.facts : subject.facts.slice(0, 1);

    return {
        reach: full ? 'answers' : 'partial',
        couldKnow: true,
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
