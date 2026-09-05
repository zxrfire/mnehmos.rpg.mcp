/**
 * What comes back when the player asks somebody something.
 */

import type { Cultivator } from '../schema/cultivation.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { ResolvedEntity } from './entities.js';
import { WORKING_KNOWLEDGE_MARGIN } from './hearsay.js';
import type {
    WhatTheySayAboutThemselves
} from '../engine/social/what-somebody-knows-about-themselves.js';

/**
 * How far the answer got. Named for what the player sees, not for the rule.
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
     */
    holdsIt: boolean;
    /**
     * How many times the player has dealt with this person before.
     */
    priorDealings: number;
    /**
     * What to call them, or null when the player cannot name them yet.
     */
    speakerName: string | null;
    /**
     * Whether standing has already overridden their unwillingness.
     */
    compelled?: boolean;
    /**
     * What they were asked about THEMSELVES, when that is what was asked.
     */
    aboutThemselves?: WhatTheySayAboutThemselves | null;
}

export interface Answer {
    reach: Reach;
    /** Observable. What they did, and the substance when there was any. */
    lines: string[];
    /** Which of the three limits bit, and why. Inspector only. */
    structure: string[];
    /**
     * Whether the player has genuinely acquired the subject.
     */
    teaches: boolean;
    /**
     * Whether the player now knows who they were talking to.
     */
    introduces: boolean;
    /**
     * Whether limit one was passed: could this person know it at all.
     */
    couldKnow: boolean;
}

// WHAT THEY DID, IN WORDS

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
    //
    // Except when the question is about them, in which case the limit does not
    // apply rather than being passed generously. There is no knowledge record
    // behind a person's own name and there was never going to be one.
    const themselves = input.aboutThemselves ?? null;
    const couldKnow = themselves !== null || holdsIt || withinStratum(asked, subject);
    structure.push(
        themselves
            ? `Asked about themselves (${themselves.kind}). Limit one does not apply: self-knowledge `
              + 'is not world-knowledge and there is no record to hold. Limits two and three still run.'
            : holdsIt
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
            // Two different failures, and they used to be one
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

    // limit three, and the one a DEMAND can reach
    const aFactTheyCanKeep = themselves === null || themselves.theyMayKeepIt;
    if (aFactTheyCanKeep && holdsPosition && goodwill < 2 && !input.compelled) {
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

    // they know it, they are saying it, and it is about them
    if (themselves) {
        return {
            reach: 'answers',
            couldKnow: true,
            lines: [
                // A name the player already has is not news, and saying it back
                // at them in the form of an introduction reads as the engine
                // talking to itself. Every other fact is worth hearing twice.
                themselves.kind === 'name' && input.speakerName !== null
                    ? `${who} gives the same name you already had for them.`
                    : themselves.said.replace('{who}', who)
            ],
            structure: [
                ...structure,
                'Reach: answers. A fact about themselves, said.',
                themselves.whatWouldCheckIt === null
                    ? 'Nothing in the world checks this one. It is what they said and that is all it is.'
                    : `This is a CLAIM and not a finding. What would settle it: ${themselves.whatWouldCheckIt}.`
            ],
            // Nothing was taught ABOUT anything - there is no subject and no
            // record to write. What they did do is tell you who they are.
            teaches: false,
            introduces: true
        };
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

    // a real answer, bounded by what they know
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
