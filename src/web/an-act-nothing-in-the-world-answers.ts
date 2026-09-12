/**
 * An act a body performs alone, which the engine has no rule for and needs
 * none for.
 *
 * `unclear` tells the player their sentence *"does not resolve into anything
 * you could actually do standing here"*, and for a whole family that is false.
 * Singing resolves. So does praying, or napping. Having no RULE for an act is
 * not the same as not reading it, and both were getting the second answer.
 *
 * Measured on the 744-turn refusal probe: of what it classed as the engine
 * failing to understand, nine sentences were ordinary acts a person can
 * perform - praying, singing, climbing, napping, showing off, causing a scene,
 * and three kinds of arson and vandalism.
 *
 * ── THE LINE, AND IT IS DRAWN AGAINST FAKING MECHANICS ───────────────────
 *
 * Two conditions, both required:
 *
 *   THE SENTENCE NAMES NOTHING OUTSIDE THE SPEAKER. "I smash the stall" fails
 *   here and stays refused.
 *
 *   THE VERB IS ONE A BODY OR A VOICE DOES BY ITSELF, with nobody on the other
 *   end of it. A closed class because of what it MEANS: the tail of unmodelled
 *   acts is unbounded, the tail of acts whose whole extent is the speaker is
 *   short.
 *
 * So the answered half is acts nothing could follow from. *"You set fire to
 * the inn. Nothing came of it"* is worse than a refusal, because the player
 * will believe the inn burned.
 *
 * Out on the second condition rather than the first: shouting and screaming
 * (aimed at a square, whose attention is modelled), showing off and causing a
 * scene (need an audience, and standing is modelled), bowing and nodding
 * (aimed at somebody, and `I bow to him` is a sentence the table reads),
 * climbing and digging (they move a body through ground the world describes).
 *
 * Three of the nine are answered here - praying, singing, napping. Over the
 * same 2232-turn probe that gives 15.2% the engine could not answer, that is
 * 12.8%, with the other three verdicts unchanged to the turn.
 *
 * Nothing is recorded. `aDeedEntersTheWorld` is for acts the world notices,
 * and by construction nothing here has anybody on the other end of it - filing
 * a deed would commit the engine to a reaction it has no rule to produce.
 */

import { observable, type EngineFacts } from './facts.js';

/**
 * What a body does with nobody on the other end of it, and the noun each takes
 * when a player writes it as a thing rather than as a verb.
 *
 * The nouns are AGENTS.md's near-synonym rule: without them "I sing" is
 * answered and "I sing a song" is refused, and nothing tells the player which
 * is which. An empty list is a verb whose noun form belongs on the refusing
 * side - "a cry" is a shout, and a shout is aimed.
 */
const A_BODY_ACTING_ALONE: Readonly<Record<string, readonly string[]>> = {
    sing: ['song', 'songs', 'tune'],
    hum: ['tune', 'song'],
    whistle: ['tune'],
    pray: ['prayer', 'prayers'],
    laugh: ['laugh'],
    chuckle: ['chuckle'],
    smile: ['smile'],
    grin: ['grin'],
    frown: ['frown'],
    scowl: ['scowl'],
    cry: [],
    weep: [],
    sob: ['sob'],
    sigh: ['sigh'],
    yawn: ['yawn'],
    stretch: ['stretch'],
    shiver: ['shiver'],
    shudder: ['shudder'],
    shrug: ['shrug'],
    sulk: [],
    fidget: [],
    pace: [],
    dance: ['dance', 'jig'],
    nap: ['nap'],
    doze: ['doze'],
    daydream: []
};

/** Verbs carrying no meaning of their own in front of one of those nouns. */
const CARRIES_THE_NOUN = [
    'take', 'takes', 'have', 'has', 'say', 'says', 'let out', 'lets out',
    'give', 'gives', 'crack', 'catch', 'sing', 'hum', 'whistle', 'pray', 'dance'
];

/**
 * Adverbs and addressees that add nothing the world contains.
 *
 * `to the heavens` is here rather than refused because there is no heaven in
 * this world for the sentence to be about: it is the same private act as
 * `to myself`, written the way a player writes it.
 */
const ADDS_NOTHING_BEFORE = /^(?:just|quietly|softly|slowly|simply|briefly|only)\s+/;
const ADDS_NOTHING_AFTER = new RegExp('\\s+(?:'
    + 'to myself|to no one|to nobody|to the heavens|to heaven|to the sky|to the gods'
    + '|quietly|softly|out loud|aloud|a little|a bit|for a while|for a bit'
    + '|for a moment|under my breath|in my head|off|again)$');

/** Every spelling of every verb in the class, back to the verb. */
const SPELT: ReadonlyMap<string, string> = (() => {
    const forms = new Map<string, string>();
    for (const verb of Object.keys(A_BODY_ACTING_ALONE)) {
        forms.set(verb, verb);
        forms.set(`${verb}s`, verb);
        forms.set(`${verb}ing`, verb);
        if (verb.endsWith('e')) forms.set(`${verb.slice(0, -1)}ing`, verb);
        // A single vowel between consonants doubles: hum, nap, sob, shrug.
        if (/[^aeiou][aeiou][^aeiouwxy]$/.test(verb)) {
            forms.set(`${verb}${verb.slice(-1)}ing`, verb);
        }
    }
    return forms;
})();

/** Every noun in the table, back to the verb it belongs to. */
const NAMED_AS_A_THING: ReadonlyMap<string, string> = (() => {
    const nouns = new Map<string, string>();
    for (const [verb, said] of Object.entries(A_BODY_ACTING_ALONE)) {
        for (const noun of said) if (!nouns.has(noun)) nouns.set(noun, verb);
    }
    return nouns;
})();

const CARRIED = new RegExp(
    `^(?:${CARRIES_THE_NOUN.join('|')})\\s+(?:a|an|the|my|some)\\s+([a-z]+)$`
);

/**
 * The verb this sentence performs, when it is one of these and nothing else.
 *
 * Null for every other sentence, including every sentence naming anything the
 * world holds. A question is never one of these: the closing mark is the
 * design owner's own signal that no act was decided on.
 */
export function anActNothingAnswers(said: string): string | null {
    if (said.includes('?')) return null;

    let rest = said.toLowerCase().trim()
        .replace(/[.!;,\s]+$/, '')
        .replace(/\s+/g, ' ')
        .replace(/^i\s+/, '')
        .replace(/^(?:am|was)\s+/, '');
    if (rest.length === 0) return null;

    rest = rest.replace(ADDS_NOTHING_BEFORE, '');
    // Repeated because "I sing quietly to myself" carries two of them, and one
    // pass leaves the sentence looking like it named something.
    for (let pass = 0; pass < 3; pass++) rest = rest.replace(ADDS_NOTHING_AFTER, '');

    const plainly = SPELT.get(rest);
    if (plainly !== undefined) return plainly;

    const asAThing = CARRIED.exec(rest);
    if (asAThing === null) return null;
    return NAMED_AS_A_THING.get(asAThing[1]) ?? null;
}

/**
 * That the act was taken and that nothing follows from it.
 *
 * Those two facts and no more; the narrator writes it. No affordance list
 * rides along - a list of what WOULD work is what a refusal says, and this is
 * not one.
 */
export function factsForAnActNothingAnswers(verb: string): EngineFacts {
    const said = `You ${verb}. Nothing follows from it.`;
    return observable(said, [said], said, [
        'No day passed, nothing was spent and no state changed. '
        + 'There is no rule behind this act; the sentence was read.'
    ]);
}
