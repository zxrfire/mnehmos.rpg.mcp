/**
 * SELF-KNOWLEDGE IS NOT WORLD-KNOWLEDGE, AND MUST NOT ROUTE THROUGH THE SAME GATE.
 */

import type { Sex } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';

/**
 * The four. Named for the fact rather than the question, because a fact is what
 * the person holds and a question is only one way of reaching it.
 */
export type SelfFactKind = 'name' | 'age' | 'sex' | 'house';

export const SELF_FACT_KINDS: readonly SelfFactKind[] =
    Object.freeze(['name', 'age', 'sex', 'house']);

/** Enough of a person to answer about themselves. Nothing else is read. */
export interface WhoIsBeingAsked {
    name: string;
    age: number;
    sex: Sex;
    /** What they would call their house, or null when they answer to nobody. */
    houseName: string | null;
    /** The house's own title for their rung there, where they hold one. */
    rankName: string | null;
}

export interface WhatTheySayAboutThemselves {
    kind: SelfFactKind;
    /**
     * Their words, in the third person because the narrator is reporting them.
     * Phrased as something SAID rather than something true for all four: a person
     * can be wrong or lying about any of them.
     */
    said: string;
    /**
     * Whether this is a fact a person might decline to give.
     */
    theyMayKeepIt: boolean;
    /**
     * The instrument that would check the claim, or null where there is none.
     * Not a probability and not a suspicion, but a fact about what this world
     * holds. Only the house has one, and it is a token.
     */
    whatWouldCheckIt: string | null;
}

/**
 * The canonical topic each fact travels under. The parser emits one and
 * `askedAbout`'s caller reads it back, so the two ends of the wire agree by
 * construction. Kept inside `[a-z ]` because the topic sanitiser in
 * `actions.ts` strips anything else.
 */
export const A_TOPIC_ABOUT_THEMSELVES: Readonly<Record<SelfFactKind, string>> = Object.freeze({
    name: 'their own name',
    age: 'their own age',
    sex: 'their own sex',
    house: 'whose they are'
});

const KIND_BY_TOPIC: ReadonlyMap<string, SelfFactKind> = new Map(
    SELF_FACT_KINDS.map(kind => [A_TOPIC_ABOUT_THEMSELVES[kind], kind])
);

/**
 * The phrasings, per fact.
 */
const HOW_SOMEBODY_ASKS: Readonly<Record<SelfFactKind, readonly RegExp[]>> = Object.freeze({
    name: [
        /\byour name\b/,
        /\bwhat (?:should|do|shall) i call you\b/,
        /\bwho am i (?:talking|speaking) to\b/
    ],
    age: [
        /\bhow old are you\b/,
        /\byour age\b/,
        /\bwhat age are you\b/
    ],
    sex: [
        /\byour sex\b/,
        /\bare you an? (?:girl|boy|woman|man|lady|male|female)\b/,
        /\bare you male or female\b/
    ],
    house: [
        /\bwho do you (?:serve|answer to|belong to)\b/,
        /\bwhose (?:are you|man are you|disciple are you)\b/,
        /\bwh(?:at|ich) (?:house|sect|clan|order|court) (?:are|do) you\b/,
        // "I demand to know what house you are from" - a demand puts the
        // pronoun the other way round, and it is the phrasing somebody reaches
        // for exactly when they have decided to lean on the answer.
        /\bwh(?:at|ich) (?:house|sect|clan|order|court) you (?:are|serve|belong)\b/,
        /\byour (?:house|sect|clan|order)\b/
    ]
});

/**
 * Which fact about themselves this sentence is asking for, or null. Order is
 * `SELF_FACT_KINDS`' and is stable, so a sentence that somehow matched two
 * reads the same way every time; none of them overlap, and an overlap would be
 * the bug rather than the ordering.
 */
export function whatIsBeingAskedAboutThem(sentence: string): SelfFactKind | null {
    const text = sentence.toLowerCase();
    // A question about oneself is not a question about them. "What is my name"
    // is the status screen and reaches it, and this must never take it.
    if (/\bmy (?:name|age|sex|house|sect)\b/.test(text)) return null;
    for (const kind of SELF_FACT_KINDS) {
        if (HOW_SOMEBODY_ASKS[kind].some(pattern => pattern.test(text))) return kind;
    }
    return null;
}

/** The fact a canonical topic carries, or null for any other topic. */
export function selfFactFromTopic(topic: string): SelfFactKind | null {
    return KIND_BY_TOPIC.get(topic.trim().toLowerCase()) ?? null;
}

/**
 * What they say, when they say it. Decides nothing about WHETHER they say it -
 * that is `asked.ts`'s second and third limits. This is only the words.
 */
export function whatTheySayAboutThemselves(
    kind: SelfFactKind,
    who: WhoIsBeingAsked
): WhatTheySayAboutThemselves {
    switch (kind) {
        case 'name':
            return {
                kind,
                said: `{who} gives their name as ${who.name}.`,
                theyMayKeepIt: false,
                whatWouldCheckIt: null
            };
        case 'age':
            return {
                kind,
                said: `{who} puts their own age at ${Math.max(0, Math.round(who.age))}.`,
                theyMayKeepIt: false,
                whatWouldCheckIt: null
            };
        case 'sex':
            return {
                kind,
                // The plainest sentence available, deliberately: a fact
                // somebody states, which the world does nothing else with.
                said: `{who} says they are ${who.sex === 'female' ? 'a woman' : 'a man'}.`,
                theyMayKeepIt: false,
                whatWouldCheckIt: null
            };
        case 'house':
            return {
                kind,
                said: who.houseName === null
                    ? '{who} says they answer to nobody, and that nobody is owed anything by them.'
                    : who.rankName === null
                        ? `{who} says they are of the ${who.houseName}.`
                        : `{who} says they are of the ${who.houseName}, as ${who.rankName}.`,
                // The only one of the four a position has any interest in.
                theyMayKeepIt: true,
                // The one of the four this world can settle.
                whatWouldCheckIt: who.houseName === null
                    ? null
                    : `a token of the ${who.houseName}, which is the only thing that says it `
                      + 'rather than claims it'
            };
    }
}
