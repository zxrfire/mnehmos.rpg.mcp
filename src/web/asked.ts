/**
 * What comes back when the player asks somebody something.
 */

import type { Cultivator } from '../schema/cultivation.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { ResolvedEntity } from './entities.js';
import type { KnowledgeGate } from './knowledge.js';
import { rankName } from '../engine/cultivation/realms.js';
import { WORKING_KNOWLEDGE_MARGIN } from './hearsay.js';
import type {
    WhatTheySayAboutThemselves
} from '../engine/social/what-somebody-knows-about-themselves.js';
import type { WhatIsOnTheirMind } from '../engine/world/what-somebody-here-is-chewing-on.js';

/**
 * How far the answer got. Named for what the player sees, not for the rule.
 */
export type Reach = 'answers' | 'partial' | 'guesses' | 'deflects' | 'blank';

/**
 * Whether the person being asked holds a record of what was asked about.
 *
 * `AskedInput.holdsIt`, built in one place because it was built twice - once in
 * `askAround` and once in `demandOf` - and the two had to agree or a demand
 * would be refused at limit one for a reason the polite ask two lines away did
 * not have. Both listed the three kinds that had a gate read, so a question
 * about anything else was decided entirely by `withinStratum`.
 *
 * A pill is asked for as `thing`: that is the gate's word for a claim about
 * something out of a catalog, and `resolvePill`'s `kind` is the resolver's word
 * for which catalog it came from. Naming them apart is what lets an elder who
 * has heard of a medicine answer about it while the carter beside them cannot.
 */
export function whetherTheyHoldIt(
    gate: Pick<KnowledgeGate, 'isAwareOf'>,
    askedId: string,
    subject: ResolvedEntity | null
): boolean {
    if (subject === null) return false;
    switch (subject.kind) {
        case 'cultivator':
        case 'sect':
        case 'place':
            return gate.isAwareOf(askedId, subject.kind, subject.id);
        case 'pill':
            return gate.isAwareOf(askedId, 'thing', subject.id);
        default:
            return false;
    }
}

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
    /**
     * WHAT THEY HAVE ON THEIR MIND, in both its forms, or null.
     *
     * `whatTheyWouldBeHeardOnAbout`'s reading, unchanged. Read here because a
     * person asked about something they cannot place does not fall silent -
     * they talk about their own thing instead, which is what people do.
     *
     * Safe to say by construction and for two reasons. It is derived from rows
     * an onlooker in the square could work out, and it is routed through the
     * mouth of the person it is about, which is the second of the three ways
     * `AGENTS.md` allows a fact to reach the narrator. It carries no proper
     * noun: a borrowed blade is a blade until somebody names it.
     */
    onTheirMind?: WhatIsOnTheirMind | null;
}

export interface Answer {
    reach: Reach;
    /** Observable. What they did, and the substance when there was any. */
    lines: string[];
    /**
     * `lines` as a player with no narrator configured reads them, where any of
     * them is written differently for the two channels. Absent when they are
     * the same, which is every reach but the three that turn onto their own
     * subject.
     */
    linesToThePlayer?: string[];
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

// WHAT THEY DID, AS A FACT
//
// One plain line each: what happened, as the player could see it. HOW it is
// said is the narrator's. These sat under WHAT THE ENGINE RULED with a manner
// written into them - a look, a tone, an uncle - and a ruling is played every
// time, so one person opened five answers in seven with the same uncle.

/** Attached, and the question named something they are placed to say nothing about. */
const BLANK = '{who} does not answer the question.';

/** Attached, and the question landed on nothing they could place. */
const UNPLACEABLE = '{who} cannot place "{topic}" and says nothing about it.';

/** Attached, knows it, and the account they owe costs more than the telling. */
const DEFLECT = '{who} answers without saying anything about it.';

/** Unattached, above their stratum, and nothing at all stopping them. */
const GUESS = '{who} answers with confidence, and none of it matches anything you have been told.';

/** Unattached, and the question named nothing anybody could answer. */
const UNATTACHED_UNPLACEABLE = '{who} has not heard of "{topic}" and answers anyway, as if they had.';

function saying(line: string, who: string, topic: string): string {
    return line.replace('{who}', who).replace('{topic}', topic.trim() || 'it');
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
 * What came of asking, and what they talked about instead where nothing about
 * the question was said.
 */
export function askedAbout(input: AskedInput): Answer {
    return whatTheyTurnedItOnto(howFarTheAnswerGot(input), input);
}

/**
 * A question nothing about was answered leaves the person holding the floor,
 * and what comes out is whatever they already had.
 *
 * The three reaches below are the ones where nothing about the SUBJECT was
 * said - they could not place it, or they placed it and are not saying. What
 * they turn to is about themselves and discloses nothing about what was asked,
 * which is exactly why it is safe to say and why it teaches nothing.
 *
 * The square already prints this reading, as what you overhear. Standing in
 * front of the same person and asking them something could not reach it, so a
 * player who walked up to somebody the world had given something to say got
 * less out of the conversation than out of looking at them.
 */
function whatTheyTurnedItOnto(answer: Answer, input: AskedInput): Answer {
    const clause = input.onTheirMind ?? null;
    if (clause === null) return answer;
    if (answer.reach !== 'blank' && answer.reach !== 'deflects' && answer.reach !== 'guesses') {
        return answer;
    }
    const who = input.speakerName ?? 'The one nearest to hand';
    // The name leads. `who` is a PHRASE where the player cannot name them -
    // "The one nearest to hand" - and the first cut put it mid-sentence, where a
    // capitalised noun phrase reads as a machine having filled a slot. Every
    // other line in this file opens on `{who}` for the same reason.
    const turnedOnto = (said: string) =>
        `${who} does not stay on the question, and what comes out instead is their own: ${said}.`;
    return {
        ...answer,
        lines: [...answer.lines, turnedOnto(clause.state)],
        // AND THE SAME LINE AS A PLAYER WITH NO NARRATOR READS IT. `state` is a
        // note to write from and not a sentence, so it cannot be what is
        // printed when nothing is going to write from it. See
        // `WhatIsOnTheirMind` for why the two channels differ at all.
        linesToThePlayer: [...answer.lines, turnedOnto(`they ${clause.plainly}`)],
        structure: [
            ...answer.structure,
            'Turned onto their own subject: nothing about what was asked was said, so what they '
            + 'already had is what came out. Derived from their own rows, carries no name, and '
            + 'teaches nothing about the subject.'
        ]
    };
}

/**
 * How far the answer got.
 *
 * Reads as a sequence of gates rather than a score, because the three limits
 * are separate and a player should be able to work out which one they hit.
 */
function howFarTheAnswerGot(input: AskedInput): Answer {
    const { asked, subject, holdsIt, priorDealings } = input;
    // How the prose refers to them. A name the player has earned, or the
    // shape of a person they have not.
    const who = input.speakerName ?? 'The one nearest to hand';
    const structure: string[] = [
        `Asked ${asked.name} (${rankName(asked.realmOrdinal)}, ` +
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
                    lines: [saying(UNPLACEABLE, who, input.rawTopic)],
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
                lines: [saying(BLANK, who, input.rawTopic)],
                structure: [...structure, 'Reach: blank. Above their stratum, and placed to say nothing.'],
                teaches: false,
                introduces: false
            };
        }
        return {
            reach: 'guesses',
            couldKnow: false,
            lines: [saying(GUESS, who, input.rawTopic)],
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
            lines: [saying(DEFLECT, who, input.rawTopic)],
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
            lines: [saying(UNATTACHED_UNPLACEABLE, who, input.rawTopic)],
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
