/**
 * SELF-KNOWLEDGE IS NOT WORLD-KNOWLEDGE, AND MUST NOT ROUTE THROUGH THE SAME
 * GATE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, VERBATIM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Somebody typed `are you a girl?` at a person standing in front of them and
 * the engine answered:
 *
 *   > "fox meets your gaze with the particular blankness of someone being
 *   >  pressed for an answer to a thing they have never heard of."
 *
 * and said so through `asked.ts`'s first limit - *could they know* - which is
 * `docs/world/houses/asking.md`'s question about **a rumour, a location, a
 * house's business, somebody else's art**. It is the right gate and it was
 * being applied to the wrong class of fact.
 *
 * **Somebody knows their own name, their own age, their own sex, and who they
 * answer to, by definition and without a knowledge record.** Asking them is the
 * most ordinary thing in the game. So these four pass limit one, always, and
 * the passing is structural rather than remembered: `askedAbout` is handed the
 * fact and never asks whether they could have heard of themselves.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS DOES **NOT** DO, AND IT IS THE HALF THAT MATTERS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Passing limit one is not asserting the answer is true.** Three separate
 * questions, and collapsing any two of them is the failure this file exists to
 * avoid:
 *
 *   1  do they KNOW it            - yes, by definition. That is all this file
 *                                   settles.
 *   2  will they SAY it           - `asked.ts`'s limits two and three, unchanged
 *                                   and still applied. Somebody with a position
 *                                   to protect can decline, and a deflection is
 *                                   a different event from a blank.
 *   3  is what they say SO        - **not answered here and not answered
 *                                   anywhere yet.** See below.
 *
 * The first question is what was broken. The third is where the interesting
 * game is, and it is deliberately left open rather than closed the easy way.
 *
 * ── THE ANSWER IS WHAT THEY SAID, NEVER A FACT ABOUT THE WORLD ──────────
 *
 * Every one of these comes back as a sentence somebody spoke, and
 * {@link WhatTheySayAboutThemselves} says so in its shape rather than in a
 * comment: `said` is their words and `whatWouldCheckIt` names the instrument
 * that would settle it, where one exists.
 *
 * For three of the four there is no instrument, and that is honest - nothing in
 * this world checks a stated age. **For the house there is one, and it is
 * already designed**: `docs/world/houses/trust.md` is entirely this subject,
 * its central claim is that being believed is not the same as being right, and
 * a house's token is the check. A token is expensive, it shatters on death, and
 * taking one means taking somebody alive - which is why a claimed affiliation
 * is cheap and a token is not.
 *
 * So a claimed house is exactly the kind of thing `deceive` already prices as
 * one of the four wrongs, and `KnowingStage` already decides whether the player
 * could contradict it. **None of that machinery is wired to this yet.** What
 * this file guarantees is that it CAN be: the claim arrives as a claim, with
 * the instrument named, rather than as a fact the engine has vouched for.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND WHAT A CHANGED BEAST CONSIDERS ITSELF TO BE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The person in the transcript was one - *"I am fox"* - so the question was
 * live. **The answer needs no machinery at all: the same as anybody, off the
 * same row.**
 *
 * A beast at `BEAST_CHANGE_ORDINAL` and above is a person and belongs among the
 * people, holding what any cultivator holds, and `hunting-a-spirit-beast.ts`
 * says outright that a branch on "is this a beast" anywhere near a social
 * question means the design has gone wrong. So there is no branch here. It
 * cultivated into a human body, the shape is exactly right, and the row says
 * what every row says - asked its sex it answers off the row, asked its name it
 * gives the name it goes by.
 *
 * What a changed beast lacks is not self-knowledge. It is **records for
 * ordinary life** - `KnowingStage` at `unaware`, which is a state it shares
 * with a sealed ancestor and somebody four provinces over - and
 * `WHAT_GIVES_A_CHANGED_BEAST_AWAY` is emphatic that this is caught by talking
 * and never by looking, with no anatomical tell and nothing uncanny. Its self
 * is the one thing it is not short of.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A CLOSED SET, READ AS A LOOKUP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Four facts, listed, with the phrasings for each listed beside them. This is
 * the shape `admin-manage.ts` records as the safe one - resolving a value
 * against a closed catalog is a lookup, and scanning loose prose for a word
 * that might be a meaning is not - and it is why there is no cleverness here.
 * A fifth fact would be a fifth row and a fifth set of phrasings.
 *
 * The bar for adding one: **could the person answer it without consulting
 * anything, and would they be right?** A person's own rung passes that and is
 * deliberately absent anyway, because `look` already reads a rung across a
 * valley and a second answer to it would be a second answer.
 */

import type { Sex } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';

/**
 * The four. Named for the fact rather than for the question, because a fact is
 * what the person holds and a question is only one way of reaching it.
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
     *
     * Phrased as something SAID rather than as something true, always, and for
     * all four. A person can be wrong or lying about any of them; what differs
     * between the four is whether anything in the world could settle it.
     *
     * Carries `{who}` where the speaker goes, which is `asked.ts`'s existing
     * convention for the same reason it has one: whether the player can put a
     * name to this person is that file's question, not this one's, and a
     * stranger who has just told you their name is named in the same breath.
     */
    said: string;
    /**
     * Whether this is a fact a person might decline to give.
     *
     * **Three of the four cost nothing to say**, and that is the reason they
     * cannot be withheld here rather than a kindness: `asked.ts`'s third limit
     * is *what saying it would cost them*, and a name, an age and a sex cost an
     * official exactly as little as they cost a carter. A deflection on one of
     * those would be the engine claiming an account was owed that nobody owes.
     *
     * **The fourth is different in kind and the difference is the content.**
     * Whose you are is a fact about your STANDING, it is the one of the four a
     * position has any interest in, and it is the one where being asked and
     * answering truthfully come apart - see `whatWouldCheckIt`. So it runs the
     * ordinary limits, and somebody with a house to protect can decline it and
     * be worn down the ordinary way: by turning up twice, or by being leaned
     * on.
     */
    theyMayKeepIt: boolean;
    /**
     * The instrument that would check the claim, or null where there is none.
     *
     * Not a probability and not a suspicion - a fact about what this world
     * holds. The only one with an answer is the house, and the answer is a
     * token, because a token is the thing a claim cannot fake.
     */
    whatWouldCheckIt: string | null;
}

/**
 * The canonical topic each fact travels under.
 *
 * The parser emits one of these and `askedAbout`'s caller reads it back, so the
 * two ends of the wire agree by construction rather than by both matching the
 * player's own words twice. Kept inside `[a-z ]` because the topic sanitiser in
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
 *
 * Every one requires the sentence to be addressed to THEM - `you` or `your` -
 * because that is what makes it a question about the person in front of you
 * rather than about the world. Without it, "what is the name" is a question
 * about a thing and belongs to the ordinary ask.
 *
 * Deliberately narrow. `AGENTS.md`: fix the gap that was demonstrated, not the
 * one you imagined - a table entry that guesses at context is worse than no
 * entry, and every phrasing here means one thing wherever it is said.
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
 * Which fact about themselves this sentence is asking for, or null.
 *
 * Order is `SELF_FACT_KINDS`' and is stable, so a sentence that somehow matched
 * two reads the same way every time. In practice none of them overlap - each
 * carries its own noun - and if two ever did, the overlap is the bug rather
 * than the ordering.
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
 * What they say, when they say it.
 *
 * Pure, and it decides nothing about WHETHER they say it - that is `asked.ts`'s
 * second and third limits and they are applied in the ordinary way. This is
 * only the words.
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
                // The plainest sentence available, deliberately. This is a fact
                // somebody states about themselves and the world does nothing
                // else with it.
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
                // The one of the four this world can settle, and the reason
                // `trust.md` exists. A house's token is the check because a
                // token cannot be said - it has to be held, it shatters on
                // death, and taking one means taking somebody alive.
                whatWouldCheckIt: who.houseName === null
                    ? null
                    : `a token of the ${who.houseName}, which is the only thing that says it `
                      + 'rather than claims it'
            };
    }
}
