/**
 * Inheritance grounds: the words a player uses about a site, and the step that
 * routes them.
 *
 * The second of the four verb families lifted out of the pattern table in
 * `actions.ts`, on the shape `leaving-things-for-the-next-life.ts` established
 * for `legacyStep`. Measured before the move: this block needed nothing from
 * the rest of that file, and the rest of it needed nothing here but `siteStep`.
 *
 * `planIntent` keeps its one-line call and the ordering around it. Nothing was
 * reordered, widened or rewritten.
 *
 * `siteNamed` comes with it and its three siblings did not. `tradeNamedIn`,
 * `theKindOfWorkNamed` and `dutyNamed` are the same shape - any name the game
 * prints is a name the game must accept - but they answer for the work board
 * and the duty board, which are not this verb. `dutyNamed`'s docstring still
 * points at `siteNamed` and now does so across a file boundary; the link reads
 * fine and the rule it cites is the same rule.
 *
 * Single reason to change: how a player says something about a site.
 */

import { PlannedAction } from './planned-action.js';
import { SITE_PHRASES } from './trials.js';
import { usedAsVerb, namedAfter } from './sentence-parts.js';

// ─── INHERITANCE GROUNDS ──────────────────────────────────────────────────
//
// `data/cultivation/inheritance-trials.ts` has carried twenty-odd sites, three
// unrelated kinds of gate and a fully written interior from the start, and the
// systems playtest reported the whole of it as unreachable: nothing in this
// parser named a site, so a player could not approach, assess or enter one.
//
// Four steps, and they must not eat each other or anybody else's sentences.
// The rule is the one the `order` branch established and the seat's powers
// inherited: A VERB IN VERB POSITION, PLUS A NOUN THAT SAYS WHAT IT IS AIMED
// AT. Both halves are required and both are load-bearing. "go to", "find",
// "open", "take" and "study" are five of the commonest verbs in any sentence a
// player types, and "grave", "trial" and "door" are ordinary nouns in this
// setting; either half alone would take sentences belonging to `move`,
// `investigate`, `work` and `gather`.
//
// The two exceptions are the two sentences that name nothing because they do
// not need to - "I go inside" and "what does it look like from out here" both
// mean the site the cultivator went to most recently, exactly the way "what
// happened here" means the ground underfoot. Those resolve against a row in
// `game.ts`, not against a guess here.

/** The four steps of taking an inheritance, in the order they happen. */
export type SiteIntent = 'approach' | 'outside' | 'enter' | 'take';

/**
 * The closed set, and the one that must fall through to the cheapest.
 *
 * `enter` is the only member that spends anything, so a model-planned `site`
 * carrying an intent nothing here recognises resolves to the LISTING and never
 * to the door. See `GameService.site`.
 */
export const SITE_INTENTS: readonly SiteIntent[] = ['approach', 'outside', 'enter', 'take'] as const;

/** What an unrecognised site intent means. The read that costs nothing. */
export const DEFAULT_SITE_INTENT: SiteIntent = 'approach';

/**
 * The generic nouns that mean an inheritance ground.
 *
 * `vault` is deliberately absent: `SECT_THEFT_PATTERN` owns it, and a sentence
 * about emptying a house's vault is a siphon rather than a grave-robbing. The
 * one site whose name contains it is reachable by that name instead.
 */
export const SITE_NOUNS =
    // `ruin` was missing, which is the word the setting itself uses: locations
    // carry `kind: 'ruin'`, the seeding layer talks about `ruin.opened`, and
    // there is a `docs/world/places/ruins.md`. So the parser knew about tombs and
    // crypts and inheritance grounds and not about the thing they are all
    // called. Found by playing: "what ruins are near" reached nothing, "I enter
    // the ruin" was read as travel, and "I look for a ruin" returned the room
    // description - while the whole site subsystem sat behind words a player
    // had to guess.
    //
    // A secret realm is here for the same reason and nothing else is. Adding
    // scars, sealed domains, forbidden zones and spirit veins as well was too
    // greedy: they stole sentences from `investigate` and from ordinary place
    // resolution, because those words appear in the names and descriptions of
    // places a player travels to rather than walks into. Fix the gap that was
    // demonstrated, not the one that was imagined.
    //
    // `abandoned` and `lost` are here on the same terms as `ruin` was, and
    // with the same restraint: both are ANCHORED to a noun that can only be a
    // ground. Bare `caves` is deliberately still absent, because
    // `DESTINATIONS_QUESTION` owns "a quiet cave in the mountains" - somewhere
    // to sit is not somewhere to dig, and taking the bare noun would be the
    // greedy version of this edit that had to be reverted once already.
    //
    // `old ground` is here on those same terms, and it is the phrase the
    // exemplar corpus uses: "what old ground is there to search" reached
    // `investigate` and searched the square the player was standing in. It is
    // two words, both anchored, and it names no place in the catalog - which is
    // the test `ruin` had to pass and `scars` and `spirit veins` failed.
    /\b(?:inheritance (?:ground|grounds|site|sites|trial|trials|cave|caves)|trials?|graves?|tombs?|crypts?|burial (?:ground|site|mound)|grave goods?|interment|ruins?|ruined (?:hall|compound|temple)|secret realms?|old ground|abandoned (?:place|places|site|sites|hall|halls|compound|compounds|temple|temples|seat|seats)|lost (?:cave|caves|tomb|tombs|hall|halls|temple|temples))\b/;

/**
 * The face of a site: what is physically at the threshold.
 *
 * Every one requires its article, which is what keeps "the gate" apart from
 * "the gate steward" and "the door" apart from a door in somebody's house. A
 * sentence about looking at one of these is a sentence about reading a site
 * from outside, which is the read that must never return the interior.
 */
export const SITE_FACE_NOUNS =
    // The adjective is admitted because a player says "the old gate", not "the
    // gate": measured against this parser's own exemplar corpus, "I go and look
    // at the old gate" reached `investigate` and examined a door as an object
    // with no record behind it, while "I go and look at the gate" - the same
    // sentence with one word removed - reached the exterior read it was written
    // for. A CLOSED set of adjectives rather than `the \w+ gate`, because that
    // form takes "the sect gate" and "the gate steward's door" with it, and
    // widening a pattern here is what `AGENTS.md` records as the mistake this
    // file makes when it is trying to be helpful.
    /\bthe (?:old |ancient |ruined |broken |sealed )?(?:door|doorway|gate frame|gateway|gate\b|threshold|marker|headstone|entrance|shaft|plate|standing stone)\b/;

/** What is behind the door, referred to without naming the site. */
export const SITE_PRIZE_NOUNS =
    // `the manuals` is PLURAL here, and the singular was a measured misroute.
    // A shelf of manuals behind a door is a prize; one manual is an object
    // somebody is carrying, and "I take the manual" - typed by a player who had
    // just bought one - was read as grave-robbing. Every other noun on this list
    // can only be the contents of something.
    /\b(?:what(?:'s| is) (?:behind|beyond|inside|under|on) |what(?:'s| is) (?:in there|left)|whatever(?:'s| is) (?:behind|inside|in there)|the prize|the inheritance|the grave goods|the contents|the manuals\b)/;

export const SITE_ENTER_VERBS =
    'enter|enters|entering|go inside|goes inside|step inside|steps inside|go in|goes in|'
    + 'step in|steps in|walk in|walks in|head inside|climb down into|descend into|descend|'
    // `go in` does not match "go into", because the boundary falls after `in`.
    // "I go into the ruins" reached nothing at all while "I go in" worked.
    + 'go into|goes into|get into|gets into|climb into|climbs into|venture into|ventures into|'
    + 'breach|open|opens|opening|unseal|unseals|break into|breaks into|attempt|attempts|'
    + 'attempting|try|tries|sit at|sit down at|put my hands on';

export const SITE_TAKE_VERBS =
    'take|takes|taking|claim|claims|claiming|collect|collects|lift|lifts|pocket|pockets|'
    + 'carry off|carries off|help myself to|strip|strips|recover|recovers|walk out with|'
    // What a player actually calls it when the site is a grave. Found by a
    // standing sweep: "I rob the grave of Shen Guyi" reached nothing at all,
    // while "I take what is in the grave of Shen Guyi" - the same act, said
    // politely - went through the whole four-step surface. The graves are
    // catalogued and the taking step is implemented; only the honest word for
    // it was missing.
    + 'rob|robs|robbing|loot|loots|looting|plunder|plunders|plundering|rifle|rifles|'
    + 'dig up|digs up|digging up|break into|breaks into|breaking into';

export const SITE_LOOK_VERBS =
    'study|studies|studying|size up|sizes up|sizing up|look at|looks at|look over|looks over|'
    + 'read|reads|reading|examine|examines|inspect|inspects|scout|scouts|eye|eyes|case|cases|'
    + 'weigh up|weighs up';

export const SITE_APPROACH_VERBS =
    'go to|goes to|head to|heads to|head for|heads for|walk to|walks to|travel to|make for|'
    + 'makes for|approach|approaches|find|finds|finding|look for|looks for|looking for|'
    + 'search for|searches for|seek out|seek|seeks|locate|locates';

/**
 * Reading it from where you are standing, with no name in the sentence.
 *
 * This is the phrasing that guarantees the structural gate holds in practice
 * rather than only in the type system: a player who has not gone in asking
 * what it looks like from out here must get `interior.outside` and nothing
 * else, however they phrase the question.
 */
export const SITE_FROM_OUTSIDE =
    /\bfrom (?:out here|outside|the outside|out front|where i(?:'m| am)? stand\w*)\b|\bwithout going in(?:side)?\b/;

/**
 * `from here`, which is a threshold only when there is a threshold in the
 * sentence.
 *
 * It used to sit in {@link SITE_FROM_OUTSIDE} beside the unambiguous ones, and
 * that constant fires with NO anchor - deliberately, because a player standing
 * outside a ground must get the exterior however they phrase it. Bare "from
 * here" is not that phrasing though, it is two of the commonest words in
 * English, and it was swallowing `destinations`: "where could I go from here"
 * is the plainest way to ask what places there are, and it was answered with
 * the outside of a ruin.
 *
 * Split out rather than deleted, because a player who says "what does the tomb
 * look like from here" means exactly what the exterior read is for. So the
 * unambiguous phrasings keep firing on their own, and this one needs a site
 * named, a site noun or a threshold noun in the sentence with it.
 */
export const SITE_FROM_HERE = /\bfrom here\b/;

/** Asking what grounds there are, which needs no verb at all. */
export const SITE_QUESTION =
    /\b(?:what|which|where|any|are there|is there|anything|know of|heard of)\b/;

/**
 * Sentences that are weighing an attempt rather than making one.
 *
 * "Could I survive that trial" and "is it safe to go in" are `assess`, and
 * they contain a site noun and an entering verb respectively. Vetoed rather
 * than ordered around, because `assess` sits far below this block and the
 * sentence that needs the veto satisfies the site rule completely.
 */
export const WEIGHING_RATHER_THAN_GOING =
    /\b(?:is it safe|could i (?:survive|take|handle|manage)|do i stand a chance|am i (?:strong|ready) enough|weigh (?:my|the) chances|how dangerous|what (?:would|will) happen if i)\b/;

/**
 * The site a sentence names, out of the catalog's own short forms.
 *
 * `SITE_PHRASES` is derived from the site ids rather than written here, so a
 * site added to the catalog becomes typeable with no edit to the parser. The
 * length floor keeps a two-character slug from ever becoming a wildcard.
 */

export function siteNamed(text: string): string | undefined {
    for (const phrase of SITE_PHRASES) {
        if (phrase.length >= 6 && text.includes(phrase)) return phrase;
    }
    return undefined;
}

/**
 * One of the four steps of taking an inheritance, or null.
 *
 * Order is specificity-first and it matters at every step. "I go inside the
 * grave" contains an approach verb and an entering one and is a sentence about
 * going in. "I take what is behind the plate" contains no site noun at all and
 * is still unambiguously the last step. And the whole block is vetoed for the
 * sentences that are weighing rather than doing, because those belong to
 * `assess` and always did.
 */

export function siteStep(text: string, input: string): PlannedAction | null {
    if (WEIGHING_RATHER_THAN_GOING.test(text)) return null;

    const named = siteNamed(text);
    const noun = SITE_NOUNS.test(text);
    const face = SITE_FACE_NOUNS.test(text);
    const anchored = named !== undefined || noun || face;
    const target = named ?? (anchored ? namedAfter(input, SITE_ANY_VERB) : undefined);

    // Going in. Ahead of everything, because an entering verb next to a site
    // is not ambiguous and every other step's verbs turn up in the same
    // sentence. The bare form is admitted only when nothing follows it: "I go
    // inside" means the place they went to, and "I go into the village" is
    // movement and must stay movement.
    if ((anchored && usedAsVerb(text, SITE_ENTER_VERBS))
        || (!anchored && /\b(?:i\s+)?(?:go|step|head|walk)\s+in(?:side)?\s*[.!?]?$/.test(text))) {
        return { action: 'site', intent: 'enter', ...(target ? { target } : {}) };
    }

    // Taking it. The prize nouns stand in for a name because a player who is
    // already inside says "what is behind the plate", not the name of the
    // ground they walked onto an hour ago.
    if (usedAsVerb(text, SITE_TAKE_VERBS) && (anchored || SITE_PRIZE_NOUNS.test(text))) {
        return { action: 'site', intent: 'take', ...(target ? { target } : {}) };
    }

    // Reading it from outside. This one must never be able to return the
    // interior, and it is phrased as its own step rather than folded into the
    // approach so that the refusal to go further is visible in the log.
    if (SITE_FROM_OUTSIDE.test(text)
        || (anchored && (SITE_FROM_HERE.test(text) || usedAsVerb(text, SITE_LOOK_VERBS)))) {
        return { action: 'site', intent: 'outside', ...(target ? { target } : {}) };
    }

    // Getting there, and the listing. A question with a site noun in it and no
    // verb aimed anywhere is somebody asking what there is, which is the
    // sentence before all of the above and the only one that names nothing on
    // purpose.
    if (anchored && usedAsVerb(text, SITE_APPROACH_VERBS)) {
        return { action: 'site', intent: 'approach', ...(target ? { target } : {}) };
    }
    if ((noun || named !== undefined) && SITE_QUESTION.test(text)) {
        return { action: 'site', intent: 'approach', ...(named ? { target: named } : {}) };
    }

    return null;
}

/** Every site verb, for pulling the noun phrase out of the sentence. */
const SITE_ANY_VERB =
    `${SITE_ENTER_VERBS}|${SITE_TAKE_VERBS}|${SITE_LOOK_VERBS}|${SITE_APPROACH_VERBS}`;
