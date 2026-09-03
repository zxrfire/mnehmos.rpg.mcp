/**
 * The pattern table: which verb a sentence reaches, with no model running.
 *
 * The words a player types, and the ordering that decides which verb claims a
 * phrasing. This is the whole of what was left in `actions.ts` after the sentence
 * reader, the closed action set, the plan object, the mood post-pass and four
 * verb families were split out of it by subject, and it is one subject: which
 * verb a phrasing reaches.
 *
 * ── THE VOCABULARY AND THE ORDERING ARE ONE PIECE ────────────────────────
 *
 * Do not split the phrase constants from `planIntent`. This file says in a dozen
 * of its own comments that widening a pattern steals sentences from the verb next
 * door, which means a phrasing fix edits the alternation AND its position in the
 * ordering, together, every time. Two files that never change apart are one file.
 * Where this table splits further it splits BY VERB, the way `legacyStep`,
 * `familyStep`, `siteStep`, `leadershipIntent` and `institutionalAct` already
 * have - a family's words plus its own step, with `planIntent` keeping a one-line
 * call.
 *
 * ── THE SELF-IMPORT, AND WHY THE PATH MATTERS ────────────────────────────
 *
 * The namespace import below is what the spelling repair harvests its dictionary
 * from, and it points at THIS module rather than at `actions.js` deliberately.
 * Every re-export the barrel carries is also carried here, so the two namespaces
 * hold the same names - and pointing it at the barrel would add a cycle through a
 * module that exists only to forward. Measured across the whole split: 204
 * exported names and 1497 harvested words, unchanged at every step.
 *
 * Anything moved out of here must be re-exported from `actions.ts` and from this
 * file, or it silently leaves the repair's dictionary. See the commit that split
 * `verb-day-costs.ts` for the check.
 */

import { z } from 'zod';
// The leverage enum the social resolver reads. Set by the parser so that
// nothing downstream has to translate a verb into a mechanic.
import { ApproachLeverageSchema } from '../schema/cultivation.js';

// The board's own titles, so any name the game prints is a name it accepts.
import { SUMMONS_ENTRIES, COMMISSION_ENTRIES } from '../engine/encounters/duties.js';
import { legacyStep } from './leaving-things-for-the-next-life.js';
import {
    A_TOPIC_ABOUT_THEMSELVES,
    whatIsBeingAskedAboutThem
} from '../engine/social/what-somebody-knows-about-themselves.js';
import {
    askingWhatSomebodyIsAfter,
    requestPutToSomebody
} from './what-a-request-asks-and-of-whom.js';
// The board's own trade names, so any job the listing prints is a job a player
// can take by naming it. See `tradeNamedIn`.
import { OCCUPATIONS } from '../data/cultivation/mortal-world.js';

// A namespace import of THIS module, read lazily and only to take the phrase
// patterns below back out as a spelling vocabulary. It is a live binding, so
// by the time anybody has typed a sentence every constant here is
// initialised. See the header of the spelling module for why the vocabulary
// is harvested from the patterns rather than written down beside them.
import * as thePatternsInThisFile from './verb-pattern-table.js';
import {
    harvestVocabulary,
    inThePlayersOwnSpelling,
    respellForTheVerbTable
} from './repairing-a-misspelt-word-before-the-verb-table-sees-it.js';

// The day counts each verb spends. Re-exported so the module namespace this
// file self-imports - and therefore the spelling repair's vocabulary - is
// unchanged by the move. See the header of `verb-day-costs.ts`.
export * from './verb-day-costs.js';
import {
    DEFAULT_CULTIVATION_DAYS,
    DEFAULT_SECLUSION_DAYS,
    DEFAULT_WORK_DAYS
} from './verb-day-costs.js';

// Reading the parts of a sentence: how many, how long, and where a name stops.
//
// Re-exported BY NAME rather than with `export *`, and that is load-bearing.
// The spelling repair harvests its dictionary out of this module's namespace,
// so a blanket re-export would put `ANYBODY` and `WORD_NUMBER_ALTERNATION` -
// private in this file until now - into the repair's vocabulary and change
// what the game understands. These eight are exactly the names that were
// public before the move, so the namespace is what it was.
export {
    parseDuration,
    durationAskedFor,
    parseCount,
    theNounPhrase,
    parseAsk,
    usedAsVerb,
    inTheCharactersThePatternsUse,
    isBareDuration
} from './sentence-parts.js';
import {
    WORD_NUMBER_ALTERNATION,
    parseDuration,
    parseCount,
    extractDestination,
    cleanPlace,
    ANYBODY,
    parseAsk,
    matchIntent,
    extractSubject,
    usedAsVerb,
    namedAfter,
    inTheCharactersThePatternsUse,
    isBareDuration
} from './sentence-parts.js';

// The closed action set and the six lists that class it. Everything here was
// already public, so a blanket re-export adds nothing to this module's
// namespace and the spelling repair's harvest is unchanged.
export * from './action-set.js';
import {
    theVerbsOwnName,
    FALLBACK_ACTION
} from './action-set.js';

// The object both paths hand the engine: the plan schema, the validator that
// checks a model's answer against it, and the pass that puts back what that
// answer cannot carry. Everything here was public already, so `export *` adds
// nothing to this module's namespace.
export * from './planned-action.js';
import type { PlannedAction } from './planned-action.js';

// A question about an act is not the act. The mood post-pass, and the guard on
// a quantity the engine could not read. Both were public already, so `export *`
// adds nothing to this module's namespace.
export * from './asking-is-not-doing.js';

// A match, and what comes of one: one verb family's words plus the step that
// routes them, the shape `legacyStep` already established. Re-exported BY NAME
// so `familyStep` - private before the move - stays out of this module's
// namespace and out of the spelling repair's dictionary.
export {
    A_MATCH_NOUN,
    MARRYING_VERBS,
    PROPOSING_VERBS,
    AGREEING_TO_A_MATCH,
    DECLINING_VERBS,
    CHILD_NOUNS,
    HAVING_A_CHILD,
    PLACING_A_CHILD,
    PROPOSE_SUBJECT_VERBS,
    WHAT_IS_BEING_OFFERED
} from './match-phrasings.js';
import { familyStep } from './match-phrasings.js';

// Inheritance grounds: a verb family's words plus the step that routes them.
// By name, so `siteStep` and `SITE_ANY_VERB` - private before the move - stay
// out of this module's namespace and out of the spelling repair's dictionary.
export {
    SITE_INTENTS,
    DEFAULT_SITE_INTENT,
    SITE_NOUNS,
    SITE_FACE_NOUNS,
    SITE_PRIZE_NOUNS,
    SITE_ENTER_VERBS,
    SITE_TAKE_VERBS,
    SITE_LOOK_VERBS,
    SITE_APPROACH_VERBS,
    SITE_FROM_OUTSIDE,
    SITE_FROM_HERE,
    SITE_QUESTION,
    WEIGHING_RATHER_THAN_GOING,
    siteNamed
} from './site-phrasings.js';
export type { SiteIntent } from './site-phrasings.js';
import { siteStep, siteNamed } from './site-phrasings.js';

// What a member says to their own house, and what a seat may order. By name,
// so `leadershipIntent` - private before the move - stays out of this module's
// namespace and out of the spelling repair's dictionary.
export {
    SECT_INTENT_UNAMBIGUOUS,
    SIPHON_PACE_PATTERNS,
    SIPHON_TAKING_VERBS,
    DEFAULT_SIPHON_PACE,
    SECT_ORDER_VERBS,
    SECT_SUBORDINATE_NOUNS,
    SENDING_A_MESSAGE,
    SECT_ERRAND_PATTERNS,
    DEFAULT_ERRAND,
    SECT_RECRUIT_VERBS,
    SECT_INTAKE_NOUNS,
    ASKING_TO_BE_TAKEN_IN,
    SECT_EXPEL_VERBS,
    SECT_ELDER_NOUN,
    SECT_ADMISSION_NOUNS,
    SECT_ADMISSION_VERBS,
    SECT_ADMISSION_QUESTION,
    SECT_CURRICULUM_NOUNS,
    SECT_CURRICULUM_VERBS,
    LEARNING_RATHER_THAN_DECREEING,
    SECT_CURRICULUM_SIDE
} from './sect-phrasings.js';
export type { SectIntent } from './sect-phrasings.js';
import {
    leadershipIntent,
    SECT_INTENT_UNAMBIGUOUS,
    SIPHON_PACE_PATTERNS,
    SIPHON_TAKING_VERBS,
    DEFAULT_SIPHON_PACE,
    SECT_ORDER_VERBS,
    SECT_SUBORDINATE_NOUNS,
    SENDING_A_MESSAGE,
    SECT_ERRAND_PATTERNS,
    DEFAULT_ERRAND
} from './sect-phrasings.js';
import type { SectIntent } from './sect-phrasings.js';

// Institutions acting on each other, and on the dead. By name, so
// `institutionalAct`, `matterAsked` and `isTheActItself` - private before the
// move - stay out of this module's namespace and out of the repair's dictionary.
export {
    PETITION_INTENTS,
    DEFAULT_PETITION_INTENT,
    PETITION_VERBS_ALONE,
    PETITION_VERBS,
    PETITION_ASKING_VERBS,
    PETITION_NOUNS,
    AN_INSTITUTION_IS_BEING_ASKED,
    REQUISITION_NAMED,
    IMMORTAL_ITEM_NAMED,
    STANDING_STOCK_NOUNS,
    DESCENT_VERBS,
    DESCENT_NOUNS,
    POSTURE_INTENTS,
    DEFAULT_POSTURE_INTENT,
    DECLARE_VERBS,
    WAR_NOUN,
    ALLIANCE_VERBS,
    ALLIANCE_NOUNS,
    TRIBUTE_VERBS,
    TRIBUTE_NOUNS,
    DEFECT_PATTERN,
    SEAL_INTENTS,
    DEFAULT_SEAL_INTENT,
    WAKE_VERBS,
    SEALED_NOUNS,
    NOT_THE_SEALED_ANCESTOR,
    OFFER_INTENTS,
    DEFAULT_OFFER_INTENT,
    OFFERING_VERBS,
    OFFERING_NOUNS,
    ASCENDED_NOUNS,
    SENDING_DOWN,
    SENDING_NOUNS,
    GOING_DOWN_VERBS,
    THE_WAY_BACK_DOWN,
    DESCENT_UNAMBIGUOUS
} from './institution-phrasings.js';
export type { PetitionIntent, PostureIntent, SealIntent, OfferIntent } from './institution-phrasings.js';
import { institutionalAct, matterAsked, IMMORTAL_ITEM_NAMED } from './institution-phrasings.js';
import {
    MALFORMED_QUANTITY,
    ASKING_RATHER_THAN_DOING,
    theReadThatAnswersIt
} from './asking-is-not-doing.js';

/**
 * The two steps at a Span counter, in the order they are tested.
 *
 * `board` is the discoverability half and is a read. `buy` moves a body across
 * a province for a fare, and it is the only one that spends anything.
 */
export type PassageIntent = 'buy' | 'board';

export const PASSAGE_INTENTS: readonly PassageIntent[] = ['buy', 'board'] as const;

/**
 * What a sentence about a counter means when it names no step.
 *
 * The board, which is the free one. Same construction as
 * {@link DEFAULT_SEAL_INTENT}: the cheapest branch the action has, so a
 * misparse that reaches `passage` reads a price list and pays nothing.
 */
export const DEFAULT_PASSAGE_INTENT: PassageIntent = 'board';

/**
 * The three things somebody can do about a word, in the order they are tested.
 *
 * `break` first, because a sentence about breaking one contains every word a
 * sentence about swearing one contains.
 */
export type OathIntent = 'break' | 'swear' | 'read';

export const OATH_INTENTS: readonly OathIntent[] = ['break', 'swear', 'read'] as const;

/**
 * What a sentence about an oath means when it names no step.
 *
 * Reading what is already carried. Nothing is sworn and nothing is broken by
 * ambiguity, which matters more here than anywhere: a broken word is the one
 * record in this game that opens a second account naming the person, and
 * `faction-character.ts` says the penalty is structural rather than punitive.
 */
export const DEFAULT_OATH_INTENT: OathIntent = 'read';

/**
 * Taking something off a person, which is not gathering.
 *
 * `gather` matches on the bare verb `pick`, which is the right word for a herb
 * and is also half of the commonest way anybody says this: "I pick her
 * pocket". Played live, "I pick Xiao Suiya's pocket" answered "Cloudcap
 * Mushroom, pouched" and charged seven days of foraging for it.
 *
 * Kept to the idiom on purpose. The lesson this file has learned twice is that
 * widening a pattern to cover the case you imagined steals sentences from the
 * verb next door - "I pick the mushrooms" and "I pick a fight" must both go on
 * reaching what they reached.
 */
/**
 * Whose it is: a pronoun, or a name with an apostrophe on the end of it.
 *
 * The apostrophe is what makes a name safe to admit here - "Cao Antao's purse"
 * says whose the purse is, and no other verb's sentence puts a possessive in
 * front of a portable object.
 */
// Lowercase, because the intent table is matched against the lowered sentence.
// The capitalisation that tells a NAME from a noun is used on the other side,
// in `whoATheftIsAimedAt`, which reads the input as the player typed it.
export const A_POSSESSIVE =
    "his|her|their|its|somebody's|someone's|(?:the )?[a-z]+(?:\\s+[a-z]+){0,2}(?:'s|s')";

// ─────────────────────────────────────────────────────────────────────────
// HANDING SOMEBODY A THING
//
// The owner's own sentence for the whole feature - "a person could steal and
// then hand it to someone else before running away" - has three acts in it and
// the middle one had no verb. Six phrasings of it reached `unclear`.
//
// Both halves are required and that is the whole of the safety: a PERSON and a
// THING THEY ARE CARRYING. `give` on its own is half of a dozen other
// sentences in this file - a donation to a house, an offering up the line, a
// word given as an oath - and every one of those is matched by a rule that runs
// above this one and carries its own noun.
// ─────────────────────────────────────────────────────────────────────────

/** The verbs that mean putting a thing into somebody else's hands. */
// ── `put` AND `leave` ARE NOT ON THIS LIST, AND THEY WERE ────────────────
//
// They cost three of the corpus's own exemplars on the first run of the sweep:
// "I put in real practice at the method" (cultivate), "I put hours into the
// technique I know" (train_technique) and "I put my case to the elders"
// (petition) all became gifts. `put` is one of the commonest verbs in English
// and `leave` belongs to `legacyStep` and to `move`. The one sentence `put` was
// wanted for is "I put ten stones on the table", which has its own shape below
// and its own verb list with the table in it.
// The two-word forms come FIRST, because a regex alternation takes the first
// branch that matches and not the longest. With `hand` ahead of `hand over`,
// "I hand over what I am carrying to her" handed somebody a thing called "over
// what I am carrying", and "handing over the ledger" found a person called
// "over".
export const HANDING_IT_OVER =
    'hand over|hands over|handing over|handed over|'
    + 'give|gives|giving|gave|hand|hands|handing|handed|pass|passes|passing|passed|'
    + 'press|presses|pressing|pressed|slip|slips|slipping|slipped';

/**
 * SOMEBODY MADE TO HAND IT OVER IS NOT SOMEBODY GIVING IT.
 *
 * "I threaten the steward into handing over the ledger" contains this verb, and
 * the whole of what makes it not a gift is that the hands are not the player's
 * and nothing was freely parted with. It is `interact/threaten`, it carries
 * `leverage: 'force'` that the social resolver reads, and taking it here lost
 * both - which `both-modes-hand-the-engine-the-same-action.test.ts` caught
 * immediately, because losing the leverage is the exact defect that file exists
 * for.
 *
 * The distinction is the one `AGENTS.md` draws between agency and softening: a
 * gift opens an account BECAUSE nothing was asked for, and a thing extracted
 * under threat opens the opposite one. They must never be the same verb.
 */
export const MADE_TO_HAND_IT_OVER =
    /\b(?:threaten|threatens|threatening|threatened|intimidate|intimidates|menace|coerce|coerces|coercing|force|forces|forcing|forced|strong-?arm|strong-?arms|extort|extorts|shake down|shakes down|beat it out of|make (?:him|her|them)|makes (?:him|her|them))\b/;

/** Putting a thing down where somebody can take it, which is still giving it. */
export const PUTTING_IT_DOWN =
    'put|puts|putting|lay|lays|laying|set|sets|setting|drop|drops|dropping|place|places|placing';

/**
 * An exchange is not a gift, and the difference is one word.
 *
 * "I give him ten stones for the manual" is a purchase and "I offer what I have
 * for it" is a trade put to somebody; both name a price and neither is this.
 * A gift has no `for`, which is exactly what makes it the one act in the game
 * that creates an obligation without leverage.
 */
export const A_PRICE_IS_NAMED = /\b(?:for|in exchange|in return|in trade|instead of)\b/;

/**
 * Putting a thing INTO somebody, which is never a question put to them.
 *
 * `press` is an asking verb - "I press him for an answer" - and the asking
 * branch sits high on purpose, so "I press it into her hand" came back as an
 * approach to somebody called "it into her hand". Vetoed on the preposition
 * rather than on the whole giving read, because the whole read also matches "can
 * I press Bai Jinglu about the Azure Dew Sect", which is a question and has to
 * stay one. `into <somebody's>` is the half that cannot be anything else.
 */
// A NAME takes a possessive too, and leaving it off cost the owner's own
// acceptance sentence. "press it into her hand" was vetoed and "press it into
// Shen Liefeng's hand" was not, so the phrasing with a person in it - the one
// anybody actually types - went to the asking branch and came back as an
// approach to somebody called "it into Shen Liefeng's hand".
export const PUTTING_IT_INTO_THEIR_HANDS =
    /\b(?:press|presses|pressed|pressing|put|puts|putting|slip|slips|slipped|slipping|push|pushes|pushed)\s+[^,;.!?]{1,40}?\s+into\s+(?:his|her|their|the|somebody's|someone's|[a-z]+(?:\s+[a-z]+)?(?:'s|s'))\b/;

/**
 * What is being handed over and to whom, or nothing.
 *
 * Two shapes, because people say it both ways round:
 *
 *   give/hand/pass <person> <thing>     "I hand him the purse"
 *   give/hand/press <thing> to <person> "I press it into her hand"
 *
 * The second names nobody in "I put ten stones on the table", and that is
 * correct and deliberate: `undefined` means whoever is at hand, which is what
 * `interact` already means by it and what the sentence actually says.
 */
export function whatIsBeingHandedOver(
    input: string
): { to?: string; thing: string; stones?: number } | null {
    const text = input.toLowerCase();
    if (A_PRICE_IS_NAMED.test(text)) return null;
    if (MADE_TO_HAND_IT_OVER.test(text)) return null;

    const stones = /\b(?:[0-9]+|[a-z]+)\s+(?:spirit\s+)?stones?\b/.test(text)
        ? parseCount(text) ?? undefined
        : undefined;

    // ── EVERY CAPTURE STOPS AT A COMMA ───────────────────────────────────
    //
    // `.{2,40}?` against `$` is lazy and still runs to the end of the string
    // when nothing else can close the match, so the recipient in the owner's
    // own acceptance sentence came out as "Shen Liefeng's hand, and walk away"
    // - and was read back to the player as "the approach to it into Shen
    // Liefeng's hand, and walk away". A clause boundary is a clause boundary:
    // nothing past a comma is part of who was handed what.
    const NOT_PAST_THE_CLAUSE = '[^,;.!?]';

    // Put down rather than handed to anybody: "I put ten stones on the table".
    // FIRST, because it also parses as `<person> <thing>` with "ten stones on"
    // as the person, which is how it was refused on the first play.
    const putDown = new RegExp(
        `\\b(?:${HANDING_IT_OVER}|${PUTTING_IT_DOWN})\\s+(${NOT_PAST_THE_CLAUSE}{1,60}?)\\s+`
        + '(?:on|onto)\\s+the\\s+(?:table|counter|floor|ground)\\b',
        'i'
    ).exec(input);
    if (putDown) {
        const thing = cleanPlace(putDown[1] ?? '') ?? '';
        if (thing.length >= 1) {
            return { thing, ...(stones !== undefined ? { stones } : {}) };
        }
    }

    // <thing> to/into <person>. Before the other shape, because "I press it
    // into her hand" also parses as `<person> <thing>` with "it" as the person.
    const toSomebody = new RegExp(
        `\\b(?:${HANDING_IT_OVER})\\s+(${NOT_PAST_THE_CLAUSE}{1,60}?)\\s+`
        + `(?:to|into|over to)\\s+(?:the\\s+)?(${NOT_PAST_THE_CLAUSE}{2,40}?)`
        + '\\s*(?:[,;.!?]|$)',
        'i'
    ).exec(input);
    if (toSomebody) {
        const thing = cleanPlace(toSomebody[1] ?? '') ?? '';
        const who = theirName(toSomebody[2] ?? '');
        if (thing.length >= 1) {
            return {
                thing,
                ...(who.length >= 2 && !ANYBODY.test(who) ? { to: who } : {}),
                ...(stones !== undefined ? { stones } : {})
            };
        }
    }

    // <person> <thing>.
    const personFirst = new RegExp(
        `\\b(?:${HANDING_IT_OVER})\\s+(${NOT_PAST_THE_CLAUSE}{2,40}?)\\s+`
        + `((?:my|the|a|an|his|her|their|some|all|[0-9]+|${WORD_NUMBER_ALTERNATION})`
        + `\\b${NOT_PAST_THE_CLAUSE}{1,60}?)\\s*(?:[,;.!?]|$)`,
        'i'
    ).exec(input);
    if (personFirst) {
        const who = theirName(personFirst[1] ?? '');
        const thing = cleanPlace(personFirst[2] ?? '') ?? '';
        if (NOT_A_PERSON.has(who.toLowerCase())) return null;
        if (who.length >= 2 && thing.length >= 1) {
            return {
                thing,
                ...(ANYBODY.test(who) ? {} : { to: who }),
                ...(stones !== undefined ? { stones } : {})
            };
        }
    }

    return null;
}

/**
 * The person out of the phrase that says where the thing went.
 *
 * "into Shen Liefeng's hand" names a person and a body part, and the body part
 * is not part of the name. The possessive goes with it: a target of "Shen
 * Liefeng's" resolves to nobody, which is the shape of every bug this parser
 * has produced - a phrase matched in the wrong role and answered confidently.
 */
/**
 * A PREPOSITION IS NOT A PERSON.
 *
 * `pass` is a handing verb and also how anybody says movement - "I pass through
 * the gate" - and the `<person> <thing>` shape reads that as handing "the gate"
 * to somebody called "through". The giving branch sits above `move` so that the
 * middle clause of the owner's own sentence is not eaten by `walk away`, which
 * puts this collision directly in its path.
 */
const NOT_A_PERSON = new Set([
    'through', 'over', 'out', 'in', 'on', 'by', 'up', 'down', 'along', 'past',
    'around', 'back', 'across', 'off', 'into', 'onto', 'under', 'behind', 'beyond',
    'away', 'here', 'there', 'and', 'then', 'it'
]);

function theirName(raw: string): string {
    const withoutTheHand = raw
        .replace(/\b(?:hand|hands|palm|palms|keeping|pocket|pouch|purse)\b\s*$/i, '')
        .trim()
        .replace(/(?:'s|s')\s*$/i, '')
        .trim();
    return cleanPlace(withoutTheHand) ?? '';
}

/**
 * A thing small enough to be taken off a person.
 *
 * Deliberately a short closed list of things somebody CARRIES. A road, a job, a
 * duty and a contract are all things people take and none of them is on it,
 * which is the whole of what keeps `take` safe in the theft row.
 */
export const A_PORTABLE_THING =
    'purse|purses|pouch|pouches|pocket|pockets|sleeve|sleeves|coin|coins|stones?|'
    + 'spirit stones?|jade|pendant|pendants|ring|rings|token|tokens|talisman|talismans|'
    + 'blade|sword|sabre|saber|dagger|manual|manuals|book|books|scroll|scrolls|'
    + 'pill|pills|elixir|elixirs|medicine|bag|bags|purseful|belongings|things';

/**
 * WHO A THEFT IS AIMED AT, WHICH IS NEVER THE THING BEING TAKEN.
 *
 * `resolveAttempt` prices a theft against the PERSON it is taken from - their
 * rung, their house, what they will do about it afterwards - so a target of
 * "his purse" is a resolution failure waiting to happen and reached nobody in
 * play. Measured: "I steal his purse" came out with target `"his purse"`, and
 * "I pick his pocket" with no target at all, so both were resolved against
 * whoever happened to be nearest with no record of who was meant.
 *
 * Two forms, and between them they cover how anybody says it. Somebody's name
 * with an apostrophe on it - "Cao Antao's purse" - and the thing taken off or
 * from a named person. Where the sentence names nobody, this returns nothing on
 * purpose: "I steal his purse" genuinely does not name anybody, and `interact`
 * with no target already means whoever is at hand, which is the honest reading.
 * A guessed name would be a wrong guess, and this file's rule is that a wrong
 * guess is worse than a refusal.
 */
export function whoATheftIsAimedAt(input: string): string | undefined {
    const owned = new RegExp(
        `\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)(?:'s|s')\\s+(?:${A_PORTABLE_THING})\\b`
    ).exec(input);
    if (owned) return owned[1];

    const off = /\b(?:off|from|out of)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/.exec(input);
    if (off) return off[1];

    return undefined;
}

/**
 * Whether what came out of the sentence is an object rather than somebody.
 *
 * Only consulted for a theft, and only to DROP a target: a subject carrying a
 * portable-thing word is the thing being taken, and handing it to a resolver
 * that is looking for a person produces "nobody by that name" about a purse.
 */
export function namesTheThingRatherThanThePerson(target: string | undefined): boolean {
    if (!target) return false;
    return new RegExp(`\\b(?:${A_PORTABLE_THING})\\b`, 'i').test(target);
}

export const POCKET_PICKING =
    /\b(?:pickpocket\w*|(?:pick|picks|picking|picked|lift|lifts|lifting|lifted|cut|cuts|cutting)(?!\s+up\b)\b[^.!?]{0,40}?\b(?:pocket|pockets|purse|purses|sleeve|sleeves))\b/;

/**
 * Asking what your standing entitles you to on your house's ground.
 *
 * Named rather than inline because two places need it: the read itself, and a
 * veto on the ask branch - "I ask for time on the vein" is not a question put
 * to a person, and `parseAsk` was taking "for time on the vein" as somebody's
 * name and putting the words to whoever was nearest.
 *
 * Ground is the largest multiplier in the model and houses allocate days on it
 * by rank, so this is the first concrete thing rank buys. Gated on a house word
 * beside the ground word, so "I travel to The Cut Face" stays a journey.
 */
export const GROUND_TIME_QUESTION = new RegExp([
    /\b(?:time on the (?:vein|ground|chamber)|my (?:allocation|allotment|days on)|how many days (?:do i get|am i allowed|on the))\b/,
    /\bwhere (?:can|do|should) i cultivate\b[^.?!]*\b(?:sect|house|here|in the)\b/
].map(r => r.source).join('|'));

/** The two-noun form: a chamber word, a house word, and something being asked. */
export function asksAfterGroundTime(text: string): boolean {
    if (GROUND_TIME_QUESTION.test(text)) return true;
    return /\b(?:chamber|vein|cave|ground|room)\b/.test(text)
        && /\b(?:sect|house|clan|school|order)\b/.test(text)
        && /\b(?:go to|use|ask for|request|time on|cultivate in|cultivate at|sit in|where|what|how much|am i allowed|can i)\b/.test(text);
}

export const SECT_THEFT_PATTERN =
    /\b(?:steal|stole|stealing|rob|robbing|loot|looting|plunder|pilfer|siphon\w*|skim\w*|embezzl\w*|divert\w*|make off with|help myself to|vault|treasury|strongroom|storehouse|coffers|reserves|take (?:a little|some|the|its|their|everything|all|what))\b/;

/**
 * The two that do. "I leave" on its own is movement and "where do I stand" is a
 * status read, so both of these want the noun before they mean a sect.
 */
/**
 * The house's mission board, which needs a branch of its own and not a row in
 * `SECT_INTENT_PATTERNS`.
 *
 * The sect block only runs on a sentence containing a sect noun, and half the
 * sentences that mean this one do not have one: "I take a commission", "what
 * duties are going", "I put my name down for the wall patrol". Worse, the two
 * that DO have one were already taken - "I look at the sect mission board" by
 * `look`, and "I do sect work for contribution" by `work`, which answered it
 * with the mortal job board that pays in cash and moves no standing at all.
 *
 * So it fires early, ahead of both, and it is deliberately narrow: either an
 * explicit board, or an institution word standing next to a work word.
 * `contribution` is on the list by itself because there is exactly one thing in
 * the game that pays in it.
 */
/**
 * Reading the wall for a house that is short of people.
 *
 * Deliberately narrow, and narrow in a specific way: it requires either a
 * PAPER noun or an INTERROGATIVE frame. That is what keeps it off
 * `sect_manage`'s intake verb, which owns "recruit disciples" said as an
 * instruction by somebody who runs a house. "I recruit two disciples" is a
 * decree; "who is recruiting" is a question about the world, and nobody with a
 * house to run asks it.
 *
 * It is not in `SECT_INTENT_PATTERNS` and must not be, for the same reason
 * `SECT_DUTY_PATTERN` is not: half the sentences that mean this carry no sect
 * noun at all. "What's posted here" and "is anybody taking disciples" are the
 * two most natural ways to ask and neither names an institution.
 *
 * `notice board` and `the board` are NOT here. They belong to
 * {@link SECT_DUTY_PATTERN}, which had them first and which is a member-only
 * surface - a collision worth knowing about but not worth stealing a working
 * phrase over.
 */
export const RECRUITING_BILL_PATTERN =
    /\b(?:recruit(?:ing|ment)|intake|admission)\s(?:bills?|notices?|posters?|events?|drives?|days?)\b|\b(?:read|reads|reading|look at|looks at|looking at|check|checks|checking|study|studies|studying)\b[^.!?]*\b(?:bills?|posters?|placards?|walls?)\b|\bwhat(?:'s| is| are)?\b[^.!?]*\b(?:posted|nailed|pinned)\b|\b(?:who|what|which|any|anyone|anybody|is there|are there|is anyone|is anybody)\b[^.!?]*\b(?:recruit(?:s|ing)?|taking (?:on )?(?:disciples|students|anybody|anyone|people))\b/;

export const SECT_DUTY_PATTERN =
    /\b(?:mission board|duty board|commission board|sect board|notice board|the board|sect work|sect dut(?:y|ies)|contribution)\b|\b(?:sect|house|order|clan|school)\b[^.!?]*\b(?:work|dut(?:y|ies)|commissions?|assignments?|errands?|missions?)\b|\b(?:commissions?|assignments?|missions?|tasks?|dut(?:y|ies))\b[^.!?]*\b(?:going|available|on offer|posted|open|are there)\b|\b(?:what|which)\b[^.!?]*\b(?:dut(?:y|ies)|missions?|commissions?|assignments?)\b|\b(?:volunteer for|sign up for|put my name down)\b/;

/**
 * Taking one, said without the institution.
 *
 * "I take a commission" names no sect and is unambiguously about the board,
 * because there is nothing else in this game called a commission. The verb has
 * to be in verb position, so "the commission was already taken" is not an
 * attempt to take it.
 */
export const DUTY_TAKING_VERBS =
    'take|takes|taking|accept|accepts|accepting|volunteer|volunteers|'
    + 'sign up|signs up|put my name';

/** The nouns that make a taking verb a duty rather than a purchase. */
export const DUTY_NOUNS = /\b(?:commissions?|assignments?|dut(?:y|ies)|missions?)\b/;

/**
 * Swallowing, which is not buying and is not eating.
 *
 * "I eat a healing pill" reached the meal branch; "I buy a healing pill"
 * correctly reached the board; nothing at all reached the swallow.
 */
export const PILL_TAKING_VERBS =
    'take|takes|taking|swallow|swallows|swallowing|eat|eats|eating|consume|consumes|'
    // A pill in this world is as often a draught as a tablet, and `drink` was
    // the one ordinary verb for putting one inside you that was missing.
    + 'drink|drinks|drinking|drank|'
    + 'consuming|use|uses|using|down|downs|dose|doses|dosing';

export const PILL_NOUNS = /\b(?:pills?|elixirs?|medicines?|tablets?|pellets?)\b/;

export const PILL_SUBJECT_VERBS = /take|swallow|eat|consume|use|down|dose/;

/**
 * Taking up an art for the first time.
 *
 * Narrow on purpose, because it carries the sentence WITHOUT a class noun -
 * see the branch for the measurement that made that necessary. Every verb here
 * in verb position is unambiguously about acquiring a method.
 */
export const LEARNING_VERBS =
    'learn|learns|learning|take up|takes up|master|masters|acquire|acquires';

/**
 * The ambiguous half, which still needs the noun.
 *
 * "study the formation" is an examination and "study the Iron Bell Manual" is
 * an acquisition, and the only thing separating them is what is being studied.
 * So `study` keeps the class-noun requirement and the four unambiguous verbs
 * above do not - which is the whole of what the relaxation had to be, and
 * broadening it further took "study the formation" away from `investigate`.
 */
export const LEARNING_VERBS_NEEDING_A_NOUN =
    // `pick up` is how somebody says it when they have not read the manual yet:
    // "I want to pick up a new art" is the exemplar corpus's own phrasing and it
    // reached `gather`, because `pick` carries the foraging branch. It belongs
    // on THIS side of the split rather than beside `learn` - "I pick up the
    // roots I dropped" is a herb and nothing else, and putting it with the
    // unambiguous verbs took that sentence away from foraging, which
    // `a-verb-must-not-swallow-the-verb-next-door.test.ts` caught immediately.
    'study|studies|studying|read|reads|reading|pick up|picks up|picking up';

export const TECHNIQUE_CLASS_NOUNS =
    /\b(?:arts?|techniques?|manuals?|methods?|scriptures?|canons?)\b/;

export const LEARNING_SUBJECT_VERBS = /learn|study|read|take up|pick up|master|acquire/;

/**
 * Asking how a manual goes further, by any route.
 *
 * Deliberately about the BOOK rather than about learning: these are the words
 * somebody uses at a ceiling, and every one of them presupposes a method they
 * already practise.
 */
export const ACQUISITION_PATTERN = new RegExp([
    /\bhow (?:do|can) i (?:get|go) (?:any )?further\b/,
    /\bwhat (?:are|is) my options\b/,
    /\bhow does (?:this|my) (?:manual|method|art|book) (?:go|get) further\b/,
    /\bnext volume\b/,
    /\bgo further with\b/,
    /\bcarry me further\b/,
    /\bwhat would (?:it )?take to (?:get|go) (?:past|further|beyond)\b/,
    /\bmy options at this (?:ceiling|wall)\b/,
    /\bhow do i pass this (?:ceiling|wall)\b/,
    // Measured as plain-tier misses. All three presuppose a method and a wall
    // in front of it, which is what keeps them here rather than on `ceiling`:
    // that verb answers "what is stopping the PERSON" and has to answer for
    // somebody holding no book at all, and these are asked by somebody who
    // already knows what they hold and has run out of it.
    /\bhow do i get past (?:this|it)\b/,
    /\bwhat would let me (?:advance|progress|go (?:further|higher)|get (?:further|past))\b/,
    /\b(?:run|ran|running) out of (?:manual|book|method|art|scripture)\b/
].map(r => r.source).join('|'));

export const ACQUISITION_SUBJECT_VERBS = /further with|with|past|beyond|of/;

// ─── THE THREE QUESTIONS A STUCK PLAYER ASKS ──────────────────────────────
//
// Written from the outside in: what a person types when they want something
// and cannot get it. Every phrasing here was either measured as dead by
// `scripts/playtest-the-drive.mjs` or is a neighbour of one that was.
//
// All three are QUESTION shapes rather than verb shapes, which is why they do
// not go through `usedAsVerb`: nobody commands "ceiling". The risk that rule
// guards against - a common noun in object position being read as a command -
// does not apply to a sentence that opens "why am I".

/**
 * Why nothing is accumulating.
 *
 * `ACQUISITION_PATTERN` is the neighbour of this one and they are deliberately
 * different questions: acquisition presupposes a method and asks how the BOOK
 * goes further, while this asks what is stopping the PERSON and has to answer
 * for somebody who holds no book at all. The two overlap on "how do I pass
 * this ceiling", and acquisition keeps it, because a player who says "ceiling"
 * has already worked out that they have one.
 */
export const CEILING_QUESTION = new RegExp([
    // the measured five
    /\bwhy (?:am i|are we|is my cultivation|am i still|can'?t i|cannot i|do i)\b[^.?!]*\b(?:not (?:making |getting )?(?:progress|anywhere|any further)|stuck|stalled|not advancing|not improving|no progress|not progressing|not getting anywhere|not moving)\b/,
    /\bam i (?:stuck|stalled|capped|blocked|at (?:a|my) (?:wall|ceiling|limit))\b/,
    /\bhow far (?:will|does|can)\b[^.?!]*\b(?:technique|manual|method|art|book|scripture|cultivation)\b[^.?!]*\b(?:take|carry|go|get)\b/,
    /\bwhat (?:is|'s) (?:my|the) (?:ceiling|limit|cap|wall)\b/,
    /\bwhat (?:is|'s) (?:stopping|blocking|holding) me\b/,
    // the neighbours a player reaches for next
    /\bwhat(?:'s| is) holding me back\b/,
    // The plainest form of the question, and it reached nothing. A player who
    // does not yet know the vocabulary asks this one first.
    /\bhow (?:do|can|would) i (?:get|become|grow) (?:stronger|more powerful|better)\b/,
    /\bwhat should i (?:do|be doing)\b/,
    /\bwhy (?:can'?t|cannot) i (?:break through|breakthrough|advance|progress|rise|go (?:any )?(?:further|higher))\b/,
    /\bwhy (?:has|have) my cultivation (?:stopped|stalled)\b/,
    // The same question with `progress` as its subject rather than
    // `cultivation`. It fell to `status`, which answers with a character
    // sheet and never says what is in the way.
    /\bwhy (?:is|has|have) my progress (?:stalled|stopped|halted|frozen)\b/,
    /\bwhy (?:is|am) (?:nothing|my progress) (?:happening|accumulating|moving)\b/,
    /\bhow far (?:does|will) my (?:manual|book|method|art) go\b/,
    /\bwhat (?:is|'s) (?:in my way|my bottleneck)\b/,
    /\b(?:am i|have i) (?:hit|reached|run into) (?:a|my|the) (?:wall|ceiling|limit|cap)\b/
].map(r => r.source).join('|'));

/**
 * Who stands above them and would teach.
 *
 * The teaching nouns are required rather than optional in most of these, and
 * that is what keeps it away from `sect`: "who would take me" is a house
 * question and "who would teach me" is a person question, and the difference
 * is the verb. `master` is the one word that leaks - it is also a LEARNING
 * verb ("master the Iron Bell Manual") - so every branch carrying it here
 * either puts it after a seeking verb or in front of a question word, never
 * bare.
 */
export const TEACHER_QUESTION = new RegExp([
    // The modal does not have to sit against `who`. "who around here could show
    // me anything" is the exemplar corpus's own phrasing for this question and
    // it reached the room description, because two words of location stood
    // between the two halves of the pattern. Bounded rather than free, so the
    // rule cannot reach across a whole sentence to find its second half.
    /\bwho\b[^.?!]{0,30}?\b(?:can|could|would|will|might|is (?:able|willing) to)\b[^.?!]*\b(?:teach|guide|instruct|train|tutor|mentor|show me|take me on|take me as)\b/,
    // Wanting one without using the word for one. `study under` with nobody
    // named is this question and not a guest place at a named house - the guest
    // rule owns the phrasing that names where.
    /\b(?:want|wants|wanting|need|needs|needing|look(?:ing)? for) (?:somebody|someone|anybody|anyone|a person) to (?:study|train|learn) (?:under|with|from)\b/,
    /\b(?:can|could|would|will) (?:anyone|anybody|somebody|someone) (?:here |about |around |nearby )?teach\b/,
    /\b(?:look|looking|looks|search|searching|seek|seeking|find|finding|want|wanted|need|needing) (?:for |out )?(?:a |an |any |some |the )?(?:master|teacher|mentor|tutor|instructor|shifu|sifu)\b/,
    /\b(?:ask|asking|asks|enquire|inquire) (?:about|after|for) (?:a |an |the |any )?(?:master|teacher|mentor|tutor|instructor)\b/,
    /\bis there (?:a |an |any )?(?:master|teacher|mentor|tutor|instructor)\b/,
    /\b(?:a|any) (?:master|teacher|mentor) (?:here|about|around|nearby|in this)\b/,
    // Somebody who already has one, asking who it is. Reached nothing, which
    // is a strange answer to give a disciple about their own teacher.
    /\bwho (?:is|was|are) my (?:master|teacher|mentor|shifu|sifu|instructor)\b/,
    /\bis there (?:anyone|anybody|somebody|someone)\b[^.?!]*\b(?:stronger|higher|deeper|above me|further along|more advanced|senior to me)\b/,
    /\bwho (?:is|are|stands?) (?:above|over) me\b/,
    /\bwho (?:here )?(?:is|are) (?:stronger|higher|deeper|more advanced) than me\b/,
    /\bwho could guide my cultivation\b/,
    /\bteach me\b/
].map(r => r.source).join('|'));

/**
 * Where they could go.
 *
 * Kept off bare `travel` and bare `go`, which belong to `move` and must
 * continue to: "I travel to Barrow Hand" names a place and is a journey, and
 * stealing it here would be the exact failure this block was written to fix,
 * pointed the other way. Every branch below either asks a question word or
 * names a NON-place ("somewhere else", "anywhere else"), which is precisely
 * the sentence `move` cannot resolve and answers badly.
 */
export const DESTINATIONS_QUESTION = new RegExp([
    /\bwhere (?:can|could|should|might|would) i (?:go|travel|head|walk)\b/,
    /\bwhere (?:else )?(?:is there|are there|could i)\b/,
    /\bwhat(?:'s| is| are)? ?(?:nearby|near here|near by|around here|close by|hereabouts)\b/,
    /\bwhat (?:other )?places?\b[^.?!]*\b(?:can|could|should) i\b/,
    /\bwhat (?:else )?is (?:there )?(?:nearby|around|out there|beyond)\b/,
    /\bwhere is (?:there|the)\b[^.?!]*\b(?:better|stronger|denser|thicker|richer|more)\b[^.?!]*\b(?:qi|spiritual energy|spirit energy|energy|cultivation)\b/,
    /\bwhere (?:is|are) the (?:qi|spiritual energy|spirit energy|energy) (?:better|stronger|denser|thicker|richer)\b/,
    /\b(?:travel|go|move|head) (?:somewhere|anywhere) (?:else|better|new)\b/,
    /\b(?:somewhere|anywhere) else to (?:go|cultivate|be)\b/,
    /\bwhat (?:are )?my (?:travel )?options\b[^.?!]*\bwhere\b/,
    /\bwhere (?:could|can) i cultivate (?:better|faster)\b/,
    /\bwhat (?:towns?|villages?|cities|regions?|provinces?) (?:are|can i reach)\b/,
    // ── SOMEWHERE QUIET TO SIT ───────────────────────────────────────────
    //
    // Every one of these was tried in play and every one of them failed:
    // "I seek an uninhabited place to cultivate" and "I go into the wilds to
    // find a secluded spot" did not resolve at all, and "I look for a quiet
    // cave in the mountains" came back with the room description. Meanwhile
    // the world held 34 caves, wilds and veins, all already discovered, 31 of
    // them with nobody on them and the best at nearly twice a market town's
    // density - and `move` would have accepted any of them by name, because it
    // resolves world locations directly. The player was never told the names.
    //
    // This is the question those sentences are asking, and `destinations` now
    // answers it: it lists that ground alongside the towns with the occupancy
    // of each. Narrow on the QUIET nouns rather than on the verb, because
    // `move` owns "I go into the wilds" as a journey and `gather` owns "I look
    // for" as a search, and neither may be stolen.
    /\b(?:quiet|uninhabited|unoccupied|empty|deserted|secluded|isolated|remote|uncrowded|undisturbed|lonely)\b[^.?!]*\b(?:place|places|spot|spots|cave|caves|ground|valley|mountain|mountains|wilds|wilderness|corner|somewhere)\b/,
    /\b(?:place|spot|cave|ground|somewhere)\b[^.?!]*\b(?:nobody|no one|no-one|nothing)\b[^.?!]*\b(?:else|around|there|nearby)\b/,
    /\b(?:away from|out of) (?:the )?(?:crowd|crowds|people|town|towns|everyone|everybody)\b/
].map(r => r.source).join('|'));

/**
 * Asking what there is to understand where you are standing.
 *
 * Sat AHEAD of the destinations question and behind the ceiling one, because
 * these sentences are about COMPREHENSION and the two neighbours are about
 * geography and about the ladder. Tried in the ways somebody actually says it,
 * per the repo's own rule that a near-synonym reaching nothing is a bug: "what
 * can I learn here", "is there anything here that teaches", "what roads are
 * there", "what is there to understand around here".
 *
 * Deliberately narrow on the two nouns that mean this and no others.
 * `learn` alone belongs to the manual verbs - "what arts can I learn" is
 * `list_techniques` and must stay there - so every branch below pins `learn` to
 * a PLACE word, and the ones that do not name a place pin on `understand`,
 * `comprehend`, `insight`, `dao` or `road`.
 */
export const ROADS_QUESTION = new RegExp([
    /\bwhat (?:can|could|might) i (?:learn|understand|comprehend|study)\b[^.?!]*\b(?:here|there|nearby|near here|around here|hereabouts|in this (?:place|province|region)|from this (?:place|ground))\b/,
    /\bwhat (?:is|'s) (?:there )?to (?:learn|understand|comprehend)\b/,
    /\bwhat (?:can|could) (?:this|the) (?:place|ground|land)\b[^.?!]*\b(?:teach|teaches)\b/,
    /\b(?:is|are) there (?:any ?)?(?:thing|where|place|places|ground)\b[^.?!]*\b(?:teach|teaches|teaching)\b/,
    /\bwhat (?:ground|places?|sites?)\b[^.?!]*\b(?:teach|teaches|teaching)\b/,
    /\bwhat (?:roads?|daos?|ways?) (?:are|is) (?:there|near|nearby|around|here)\b/,
    /\bwhere (?:can|could) i (?:learn|comprehend|understand) (?:a |an |the )?(?:road|dao|way|principle)\b/,
    /\bwhat (?:insights?|comprehensions?|understandings?)\b[^.?!]*\b(?:can|could) i\b/,
    /\bground that teaches\b/
].map(r => r.source).join('|'));

/** The verbs a line is taken off the board with. */
export const DUTY_SUBJECT_VERBS =
    /take|takes|taking|accept|accepts|accepting|sign up for|signs up for|volunteer for|put my name (?:down )?(?:for|to)|do/;

/**
 * Asking a house to let you sit in, in the ways somebody would actually ask.
 *
 * Every one of these is a sentence about a PLACE rather than about a book,
 * which is what keeps them out of `learn_technique`'s way. The last one is the
 * loosest and carries two guards: the preposition, because "I study the manual"
 * is the other verb, and the `my` exclusion, because "I study with my master"
 * and "I study my book" are both sentences about something the player already
 * has.
 *
 * The listing phrasings are here too - "who would take me as a guest", "where
 * could I study" - because a player who has not been told a house takes guests
 * cannot name one, and being shown the set is the sentence before the one that
 * takes a place.
 */
export const GUEST_STUDENT_PATTERNS: readonly RegExp[] = [
    /\bguest (?:student|studentship|pupil|disciple|place|places|roll|term)\b/,
    /\b(?:as|be|being|stay as|remain) an? guest\b/,
    /\bas a guest\b/,
    // ── THE PREPOSITION IS LOAD-BEARING AND WAS LEFT OFF ONCE ────────────
    //
    // A bare `sit in` took SIX web tests in one run, all of them seclusion:
    // "I sit in seclusion for ten years" is the commonest way anybody asks for
    // the single longest action in the game, and it contains the phrase. So
    // this asks for the preposition that makes it a place - sit in AT, WITH,
    // ON - and "sit in seclusion" goes back to the verb it has always meant.
    /\bsit(?:s|ting)? in (?:at|with|on)\b/,
    /\b(?:let|allow|permit)s? me (?:to )?sit in\b/,
    /\b(?:study|learn|train)(?:ing)?\b[^.?!]*\bwithout (?:joining|being (?:a )?(?:member|taken on)|membership)\b/,
    /\bteach me\b[^.?!]*\bwithout (?:joining|taking me on|membership)\b/,
    // WHERE, not WHO. The preposition has to be followed by something, because
    // a sentence that trails off after it names no house: "I want somebody to
    // study under" is the exemplar corpus's own phrasing for the teacher
    // question, and it was answered with a guest place at a hall called
    // "under". `study there` and `study them` keep their bare form - those two
    // point at somewhere already in the sentence.
    /\bstudy (?:there|them)\b|\bstudy (?:at|under|with)\s+(?!my\b)\S/
];

/** The verbs a guest place is asked for with, for pulling the house's name out. */
export const GUEST_SUBJECT_VERBS =
    /guest student (?:at|of|with)|guest (?:at|of|with)|study at|study under|study with|sit in (?:at|with|on)|attend at|attend|study|learn at|learn from/;

export const SECT_INTENT_PATTERNS: ReadonlyArray<[SectIntent, RegExp]> = [
    ['leave', /\b(?:leave|leaving|quit|resign|renounce|withdraw from|walk out (?:of|on)|abandon|defect|desert|break with)\b/],
    ['standing', /\b(?:standing|where do i stand|my rank|what rank|my position|my contribution|how (?:am i|do i) (?:doing|rate))\b/]
];

// ─── WHICH HOUSES WOULD TAKE SOMEBODY LIKE ME ─────────────────────────────
//
// The commonest ambition in the genre, and it had no sentence. Measured, in a
// played run, deterministic reader:
//
//   "I want to get into a sect. Which ones would even look at someone like
//    me?"                              -> sect(target="get into a sect")
//                                      -> "You have said a name and it is not
//                                         one anybody has said to you."
//   "who would take someone like me"   -> unclear
//
// Note what the first one is. The sentence's whole POINT is that it names no
// house - it is asking which ones there are - and `extractSubject` manufactured
// one out of the words around the verb, which the engine then correctly refused
// as a name nobody had said. A subject invented from a sentence that named
// nothing is the shape of most of this parser's bugs, and here it turned the
// one question the listing exists to answer into a refusal.
//
// THE READ IT IS OWED ALREADY EXISTS AND IS THE RIGHT ONE. `sect` with no
// target reaches `sect_manage.list` with `admissibleOnly`, which filters the
// register by the bar this cultivator actually clears, gates it on the names
// they hold, and says of each one whether it would take them as a disciple,
// as a guest, or not at all. Nothing had to be built; the sentences simply
// never arrived.
//
// AND IT IS DELIBERATELY NOT THE ASK-ABOUT-A-NAMED-THING ROUTE BELOW. This
// question names no thing. It asks about a SET, filtered by the asker, and
// handing it to a resolver that looks names up is exactly the failure that was
// measured. The two are next-door neighbours and they must stay two routes.

/**
 * Words that can appear in a joining sentence and are not part of a house's
 * name.
 *
 * The parser-side twin of `GENERIC_HOUSE_PHRASE` in `game.ts`, and it exists
 * because that one is anchored at the start: it catches "a sect" and "sect
 * that will take me" and cannot catch "get into a sect", where the category
 * noun is at the END of the phrase the extractor pulled out.
 *
 * Filler, not a blocklist of names. Every word here is a category noun, an
 * article, a pronoun or a verb somebody uses to say they want to be taken on.
 * If anything survives the sieve, the phrase named something and the name is
 * carried through.
 */
const NOT_PART_OF_A_HOUSE_NAME_IN_A_JOINING_SENTENCE = new Set([
    'a', 'an', 'the', 'any', 'some', 'one', 'ones', 'another', 'other', 'new',
    'good', 'strong', 'decent', 'nearby', 'local', 'nearest', 'best', 'soonest',
    'sect', 'sects', 'order', 'orders', 'school', 'schools', 'clan', 'clans',
    'house', 'houses', 'cult', 'cults', 'place', 'places', 'somewhere',
    'anywhere', 'here', 'there', 'near', 'around', 'about', 'else',
    'get', 'gets', 'getting', 'got', 'into', 'in', 'to', 'of', 'on', 'at',
    'for', 'with', 'and', 'or', 'that', 'which', 'what', 'who', 'whose',
    'join', 'joins', 'joining', 'joined', 'enter', 'entering', 'apply',
    'applying', 'enrol', 'enroll', 'want', 'wants', 'wanting', 'would', 'will',
    'could', 'might', 'should', 'can', 'am', 'is', 'are', 'was', 'were', 'be',
    'being', 'been',
    'take', 'takes', 'taking', 'taken', 'have', 'has', 'admit', 'admits',
    'accept', 'accepts', 'look', 'looking', 'looks', 'find', 'finding',
    'hear', 'hears', 'even', 'ever', 'still', 'me', 'us', 'my', 'our', 'myself',
    'i', 'it', 'its', 'their', 'them', 'they', 'like', 'someone', 'somebody',
    'anyone', 'anybody', 'people', 'nobody',
    'up', 'out', 'over', 'go', 'going',
    // ── AND THE WORDS A POSTED NOTICE IS POINTED AT BY ───────────────────
    //
    // "I take the intake at the house that posted the notice" is a sentence
    // that names no house: every word of it is a pointer at a row on a wall.
    // Without these the sieve let `posted` and `notice` through, read the
    // phrase as a name, and the sect surface refused a house that does not
    // exist. No house in the catalog is called any of them.
    'intake', 'intakes', 'notice', 'notices', 'bill', 'bills', 'poster',
    'posters', 'paper', 'wall', 'post', 'posts', 'posted', 'posting',
    'advertised', 'advertising', 'recruiting', 'recruitment', 'held',
    'holding', 'days', 'weeks', 'months', 'two', 'three', 'four', 'five',
    'six', 'seven', 'eight', 'nine', 'ten',
    // The verbs of turning up to one, for the same reason: "I present myself
    // at the Hollow Bell Wanderers intake" put four of them in front of the
    // name, and a capture anchored on the noun takes all of them.
    'attend', 'attends', 'attending', 'present', 'presents', 'presenting',
    'sign', 'signs', 'signed', 'signing', 'turn', 'turns', 'turned', 'show',
    'shows', 'showed', 'shown', 'walk', 'walks', 'walked', 'put', 'puts',
    'putting', 'forward', 'front', 'make', 'makes', 'made'
]);

/**
 * Whether a phrase pulled out of a joining sentence actually names a house.
 *
 * True when nothing distinctive survives the sieve above. The caller then
 * carries no target, and the sect surface answers with the listing - which is
 * what a sentence naming no house was asking for.
 */
export function namesNoHouse(phrase: string | undefined): boolean {
    if (!phrase) return true;
    return phrase
        .toLowerCase()
        .replace(/[^a-z0-9' -]+/g, ' ')
        .split(/[\s-]+/)
        .filter(word => word.length > 0
            && !/^\d+$/.test(word)
            && !NOT_PART_OF_A_HOUSE_NAME_IN_A_JOINING_SENTENCE.has(word.replace(/'s$/, '')))
        .length === 0;
}

/**
 * The house inside a phrase that also carries the words around it.
 *
 * The same shift-from-the-left that `houseClaimedIn` does for a possessive, and
 * for the same reason: a lazy capture anchored before a noun takes the whole
 * clause, so "I take the Hollow Bell intake" hands back "I take the Hollow
 * Bell", which resolves to nobody.
 */
function theHouseInside(phrase: string | undefined): string | undefined {
    if (!phrase) return undefined;
    const words = phrase.trim().split(/\s+/);
    while (words.length > 0 && NOT_PART_OF_A_HOUSE_NAME_IN_A_JOINING_SENTENCE.has(
        words[0].toLowerCase().replace(/[^a-z']/g, '').replace(/'s$/, ''))) {
        words.shift();
    }
    const name = words.join(' ').trim();
    return name.length >= 3 && !namesNoHouse(name) ? name.slice(0, 80) : undefined;
}

// ─── TAKING AN INTAKE THE GAME ITSELF JUST POSTED ─────────────────────────
//
// FOUND BY PLAYING, standing in Halfwater. The wall volunteered three bills
// unprompted - *"Three bills are tacked to the wall. Three of them state a bar
// you already clear. The soonest intake listed opens in seventeen days."* - and
// named all three with their houses, their places and their dates. Then:
//
//   > I take the intake at the house that posted the notice
//   The reserves: refused. The engine declined, and the reason it filed is
//   not a member.
//
// A sentence about being taken on by a house reached a read of that house's
// TREASURY and was refused for not belonging to it. `SECT_THEFT_PATTERN`
// carries `take (?:a little|some|the|...)`, which is right for "I take the
// treasury" and catches "I take the intake" on the way past; the sect-noun
// block it sits in fires because the sentence contains the word `house`.
//
// So the game advertised three open doors, told the player they cleared the bar
// for all three, gave the dates, and then answered the sentence that accepts
// one with a members-only read.
//
// ── TAKING AN INTAKE IS NOT JOINING, AND THIS DOES NOT MAKE IT ONE ───────
//
// An intake is an EVENT ON A DATE. The sentence is a decision to be somewhere
// when it happens, and the house still decides - so this routes to whatever
// `sect` already does about being taken on and lets that accept or refuse. It
// resolves nothing itself and writes nothing.
//
// Where the sentence names a house, the name is carried and the ordinary door
// answers. Where it points at the paper instead - "the house that posted the
// notice", "the soonest one" - {@link namesNoHouse} drops the pointer and the
// admissible listing answers, which names every door open to this cultivator
// rather than refusing about a house that does not exist. Resolving WHICH ROW
// of the posted wall was meant needs the wall, and the wall needs the run's
// day and seed, which live a layer above this file.

/** The nouns a posted intake is pointed at by. No house is named any of them. */
const A_POSTED_INTAKE =
    '(?:intakes?|recruiting (?:events?|days?|drives?)|admission days?|open days?'
    + '|recruit(?:ing|ment) (?:bills?|notices?|posters?))';

/**
 * Going to one, as opposed to reading about it.
 *
 * The same split `SIPHON_TAKING_VERBS` draws between standing in front of the
 * vault and opening it: a question about what is posted is
 * {@link RECRUITING_BILL_PATTERN} and stays the wall read, and a sentence with
 * one of these in verb position is somebody deciding to turn up.
 */
const GOING_TO_AN_INTAKE =
    'take|takes|taking|go to|goes to|going to|attend|attends|attending|'
    + 'sign up (?:at|for|with)|signs up (?:at|for|with)|signing up (?:at|for|with)|'
    + 'put myself (?:forward|in front of)|present myself (?:at|to|for)|'
    + 'turn up (?:at|to|for)|show up (?:at|to|for)|apply at|be there for|'
    + 'walk in at|walk into';

export const TAKING_A_POSTED_INTAKE = new RegExp(
    `\\b(?:${GOING_TO_AN_INTAKE})\\b[^.!?]{0,40}?\\b${A_POSTED_INTAKE}\\b`,
    'i'
);

/**
 * Which house's intake the sentence means, where it says.
 *
 * Three shapes, because a poster gets pointed at three ways: "the intake at the
 * Halfwater Rail", "the Halfwater Rail's intake", "the Hollow Bell intake".
 * Undefined is the ordinary answer and is not a failure - it means the sentence
 * pointed at the paper rather than at a name, and the listing answers it.
 */
export function whoseIntakeItIs(input: string): string | undefined {
    const after = new RegExp(
        `\\b${A_POSTED_INTAKE}\\s+(?:at|with|for|held by|run by|being held by)\\s+(.{3,60}?)\\s*[.!?]?$`,
        'i'
    ).exec(input);
    const before = new RegExp(
        `\\b(.{3,60}?)(?:'s|s')?\\s+${A_POSTED_INTAKE}\\b`,
        'i'
    ).exec(input);
    return theHouseInside(after?.[1]) ?? theHouseInside(before?.[1]);
}

/**
 * Asking who would have you, in a sentence that names no house at all.
 *
 * ── WHAT IT DELIBERATELY DOES NOT COVER ──────────────────────────────────
 *
 * Everything with a house noun in it. The join branch below already fires on a
 * house noun beside any question word, so "which sects would take me" and "what
 * houses would have me" were reaching the sect surface the whole time and only
 * the manufactured target was wrong - see {@link namesNoHouse}. Widening this
 * pattern to cover them too would buy nothing and cost a great deal: a first
 * draft did, and it took two sentences out of the corpus on the way past -
 * *"what things do I have on me"* and *"what road takes me there"*, both of
 * which put `me` a few words behind a verb this pattern was reading as
 * admission.
 *
 * So it covers exactly the two shapes that carry no noun at all:
 *
 *   the idiom      "who would take somebody like me", "which ones would even
 *                  look at someone like me". `<taking verb> somebody like me`
 *                  has no reading that is not about being taken on.
 *   the modal      "would anyone take me", "would anybody have me".
 *
 * Both pin the asker as the object, which is what says the question is about
 * admission rather than about anybody else.
 */
export const WHO_WOULD_TAKE_SOMEBODY_LIKE_ME = new RegExp(
    '\\b(?:take|takes|have|admit|admits|accept|accepts|look at|looks at|touch|want|wants)\\s+'
    + '(?:a\\s+)?(?:nobody|somebody|someone|anybody|anyone|people|rogue|stranger)\\s+like\\s+(?:me|us)\\b'
    + '|\\bwould\\s+(?:anyone|anybody|any\\s+of\\s+them|they)\\s+(?:even\\s+)?'
    + '(?:take|have|admit|accept|look at)\\s+(?:me|us)\\b'
);

// ─── WHY THE GROUND IS LIKE THIS ──────────────────────────────────────────
//
// `engine/world/locations.ts` has carried the whole of this from the start: a
// place is an origin, an append-only list of things done to it, and a current
// state that is the two folded together. A change records the day, what was
// done, whether the true cause is on record anywhere, and - separately, because
// they are not the same thing - the competing explanations the people here
// hold. The map does not grow, it scars.
//
// None of it could be reached by typing. There was no route from a sentence to
// asking why a place is a ruin, so the disagreement the locals are carrying was
// invisible to the only person who might have cared about it.
//
// The knowledge gate is the feature and not a limitation on it. A place whose
// cause is not on record answers with the disagreement and nothing else, and it
// must be impossible to tell from the answer whether a truth exists and is
// being withheld or whether there is none - the seeded ruins hold a cause fact
// id with `causeKnown: false`, which is exactly the state that must not leak.

/**
 * Asking what was done to a place, in the ways people actually ask it.
 *
 * Narrow on purpose. These fire ahead of `investigate` and `interact`, both of
 * which would otherwise take them - "find out about" is an examination and
 * "what do they say" contains a speech verb - and a wide pattern here would
 * take sentences that belong to those.
 */
export const PLACE_HISTORY_PATTERNS: readonly RegExp[] = [
    /\bwhat happened (?:here|to (?:this|the)\b)/,
    /\bwhat became of (?:this|the)\b/,
    /\bwhy is (?:this|it|the)\b.*\b(?:like this|a ruin|ruined|dead|abandoned|empty|sealed|the way it is)\b/,
    /\bwhat do (?:the )?(?:locals|people|villagers|folk|they) (?:say|think|believe|reckon)\b/,
    /\bwhat is said (?:about|of) (?:this|the)\b/,
    /\b(?:the )?(?:history|story|stories) of (?:this|the)\b/,
    /\bhow did (?:this|the)\b.*\b(?:end up|come to be|get like this|get this way|happen)\b/
];

/**
 * Asking who holds the ground somebody is standing on.
 *
 * One constant, because it is read twice: as the rule that routes the question,
 * and as a veto in the asking branch - which requires a person and had been
 * finding one inside "who holds this ground", so the commonest phrasing of all,
 * "I ask who holds this ground", was put to whoever happened to be nearest and
 * came back "a sentence with a hole in it".
 *
 * The known cost, and it is the one `GROUND_TIME_QUESTION` already accepts: a
 * sentence that DOES name somebody - "I ask the elder who holds this ground" -
 * is vetoed too, and answers the question rather than performing the social
 * act. That is a better failure than the one it replaces, and narrowing it
 * further needs `parseAsk` to be able to say whether it found a real person.
 */
export const WHO_ANSWERS_FOR_THIS_GROUND = new RegExp(
    [
        String.raw`\b(?:who (?:holds|owns|answers for|protects|guards)|whose)\b[^.?]*\b(?:this |the )?(?:ground|land|territory|patch)\b`,
        // `who(?: is|'s)` and not `who (?:is|'s)`. The contraction has no space
        // in front of the apostrophe, so the second form only ever matched
        // "who 's" - which nobody types - and "who's in charge here", the way
        // most people say this, fell through the whole pattern.
        String.raw`\bwho(?: is|'s) in charge (?:around |round )?(?:here|of this (?:ground|land|territory))\b`,
        // AND THE SAME QUESTION WITH NOTHING AFTER IT. Found by the design
        // owner, by typing it: "who's in charge?" bare reached nothing, because
        // every alternative above needs an object and this sentence has none.
        //
        // Anchored at the end, and that anchor is what makes it safe. The
        // narrowness one line up is right for the reason it gives - "who is in
        // charge of the Gleaners" is a sect question and must not be swallowed -
        // and a sentence with no object at all cannot be that question. With
        // nothing else in it, the only thing it can mean is HERE.
        String.raw`\bwho(?: is|'s) in charge\s*[?!.]*$`,
        String.raw`\bwho (?:do|would|can|could) i (?:complain|report|appeal) to\b`
    ].join('|')
);

/** Where such a question names a place rather than meaning the ground underfoot. */
export const PLACE_HISTORY_SUBJECT =
    'happened to|happened at|became of|history of|story of|stories of|said about|said of';

/**
 * ONE ROW PER SHAPE, NOT ONE ROW PER JOB.
 *
 * A trade name is printed as the person - "Water carrier", "Charcoal burner" -
 * and typed as the work - "I carry water", "I burn charcoal". Both have to
 * reach the same line on the board.
 *
 * The mapping is over the SHAPE of the name rather than over the catalog, so a
 * job added tomorrow is typeable without anybody editing this: any
 * `<thing> <agent>er` name yields its verb from this table, and a name whose
 * agent noun is not here simply keeps its printed form, which still works
 * because the listing prints exactly that. Nothing here can go stale against
 * `mortal-world.ts`; at worst it covers one shape fewer than it could.
 */
const AN_AGENT_NOUN_AND_ITS_VERB: ReadonlyArray<readonly [string, string]> = [
    ['carrier', 'carry'],
    ['burner', 'burn'],
    ['picker', 'pick'],
    ['digger', 'dig'],
    ['keeper', 'keep'],
    ['sitter', 'sit'],
    ['runner', 'run'],
    ['culler', 'cull'],
    ['gatherer', 'gather']
];

/**
 * Every way of naming a line on the mortal work board.
 *
 * Derived from `OCCUPATIONS` rather than written out, on the precedent
 * {@link siteNamed} already sets in this file: a phrase list that can drift
 * from the content it describes is a phrase list that will. What is derived is
 * the printed name with any parenthetical stripped - a player types "caravan
 * guard", not "Caravan guard (mortal)" - plus the activity form above.
 *
 * Longest first, so "herb gathering, guarded ground" is not answered by "herb".
 * The floor of four characters is the same guard `siteNamed` keeps: a
 * three-letter fragment buried in a sentence is not somebody naming a trade.
 */
/**
 * A TRADE NAME IS ALSO A PERSON, AND THAT COST FIVE TESTS ON THE FIRST TRY.
 *
 * `Courier`, `Physician (mortal)`, `Gleaner (burn zone)` are lines on a work
 * board AND people standing in front of you AND, in one case, half the name of
 * a faction. Matched on the noun alone, the first version of this branch took
 * "I barter with the courier" (a trade), "I shadow the courier" (following
 * somebody), "I ask about joining the Gleaners Company" (a sect application)
 * and "a conversation with a physician" - four verbs' sentences, from a list
 * that was meant to add one.
 *
 * That is the mistake `AGENTS.md` records about widening a pattern here, and
 * the split it forces is the honest one:
 *
 *   `activity`  a verb phrase - "carry water", "burn charcoal". Nobody says
 *               these about a person, so they stand on their own.
 *   `name`      a noun - "courier", "physician", "water carrier". A bare trade
 *               noun in a sentence is a PERSON until something says otherwise,
 *               so these need the sentence to be about taking or doing work.
 */
type TradePhraseKind = 'activity' | 'name';

/** What makes a trade NOUN a job rather than somebody standing there. */
const TAKING_IT_AS_WORK =
    /\b(?:takes?|taking|took|works?|working|hire|hires|hired|hiring|sign on|signs on|signed on|apply|applies|applied|applying|job|jobs|employment|wages?|paid|pay|pays|earn|earns|labour|labor)\b|\bas an?\b/;

interface TradePhrase {
    readonly said: string;
    readonly name: string;
    readonly kind: TradePhraseKind;
    /** The phrase as a whole-word test, with an optional plural on the end. */
    readonly matches: RegExp;
}

const TRADE_PHRASES: readonly TradePhrase[] = (() => {
    const rows: TradePhrase[] = [];
    const add = (said: string, name: string, kind: TradePhraseKind): void => {
        // Letters, spaces and apostrophes only. Every trade name in the catalog
        // is made of those, and sanitising rather than escaping means no regex
        // metacharacter can ever reach the pattern below.
        const key = said.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (key.length < 4 || rows.some(r => r.said === key)) return;
        // A hyphen is a space. `Spirit-beast culler` is printed with one and
        // typed either way, and the sanitiser above turns it into a space - so
        // without this the one trade name the catalog hyphenates was the one
        // name the parser would not accept back.
        const between = key.split(' ').join('[\\s-]+');
        rows.push({ said: key, name, kind, matches: new RegExp(`\\b${between}s?\\b`) });
    };
    for (const job of OCCUPATIONS) {
        const printed = job.name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
        add(printed, job.name, 'name');
        // "Herb gathering, guarded ground" - the clause after the comma says
        // WHERE, and nobody types it.
        const beforeTheComma = printed.split(',')[0]!.trim();
        add(beforeTheComma, job.name, 'name');

        const shaped = /^(.+?)\s+([a-z]+)$/i.exec(beforeTheComma);
        const verb = shaped
            ? AN_AGENT_NOUN_AND_ITS_VERB.find(([agent]) => agent === shaped[2]!.toLowerCase())
            : undefined;
        if (shaped && verb) add(`${verb[1]} ${shaped[1]!.toLowerCase()}`, job.name, 'activity');
    }
    return rows.sort((a, b) => b.said.length - a.said.length);
})();

/**
 * The trade a sentence names, or nothing.
 *
 * Returns the PRINTED name, because that is what `GameService.work` matches
 * against the board that is actually here - so this decides that a trade was
 * named and never which one is available.
 */
export function tradeNamedIn(text: string): string | undefined {
    const framed = TAKING_IT_AS_WORK.test(text);
    for (const row of TRADE_PHRASES) {
        if (row.kind === 'name' && !framed) continue;
        if (row.matches.test(text)) return row.name;
    }
    return undefined;
}

/**
 * The trade a WORK sentence half-names, for the handler to resolve.
 *
 * A looser read than {@link tradeNamedIn} and only safe because of where it is
 * called: inside the employment branch, on a sentence the table has already
 * decided is about taking work. "I take the charcoal work" names no trade this
 * catalog prints - the line is `Charcoal burner` - and one distinctive word out
 * of a trade's own name is enough to say which one was meant.
 *
 * Five characters, matched whole, against the words of the printed name. That
 * floor is what keeps `tax`, `bell`, `cave` and `quay` from firing on the
 * ordinary sentences they appear in, and the branch it runs in is what keeps
 * "I want a drink of water" from ever reaching it.
 *
 * Nothing here decides whether the trade is on offer HERE. `GameService.work`
 * matches the name against the board as it actually stands and refuses with the
 * board attached, which is the refusal that names a route.
 */
export function theKindOfWorkNamed(text: string): string | undefined {
    const words: readonly string[] = text.toLowerCase().match(/[a-z']+/g) ?? [];
    for (const row of TRADE_PHRASES) {
        for (const part of row.said.split(' ')) {
            if (part.length >= 5 && words.includes(part)) return row.name;
        }
    }
    return undefined;
}

/**
 * A commission or summons the player has NAMED, or undefined.
 *
 * The same shape as {@link siteNamed} and for the same rule: any name the game
 * prints is a name the game must accept. The board prints titles like "What a
 * Poor District Has Instead of Monsters", and typing one back reached nothing
 * at all - the duty branch needs a board noun and a title has none, so a
 * sentence made entirely of what the game had just said fell through to the
 * generic parser and out the bottom.
 *
 * That left the whole progression loop dead: the board lists work, prices it in
 * contribution, changes the payout when you join a house, and had no accepting
 * sentence of any kind. Contribution gates promotion and promotion gates the
 * shelf, so the sect member's entire path terminated at a wall they could read
 * and not touch.
 *
 * Longest first, so a title that contains another title matches the longer one.
 */
export function dutyNamed(text: string): string | undefined {
    for (const phrase of DUTY_PHRASES) {
        if (text.includes(phrase)) return phrase;
    }
    return undefined;
}

/**
 * Every commission and summons title, lowercased, longest first.
 *
 * Built from the catalogs the board itself draws from, so a title added to the
 * content files is typeable the day it lands and nobody has to remember to add
 * it here. Short titles are dropped: a two-word name is a phrase somebody might
 * use in an ordinary sentence, and stealing those is the failure mode this
 * file's own history is full of.
 */
const DUTY_PHRASES: readonly string[] = [...new Set(
    [...SUMMONS_ENTRIES, ...COMMISSION_ENTRIES].map(entry => entry.name.toLowerCase())
)]
    .filter(name => name.length >= 12)
    .sort((a, b) => b.length - a.length);

// ─── WHAT AM I CARRYING IN MY HEAD ────────────────────────────────────────
//
// The knowledge layer decides what may be said in front of this cultivator and
// the sheet shows what they have comprehended, and neither could be asked
// about in words. A rank-band sweep found it at the ceiling rather than the
// floor, which is the worst place for it: at the last two rungs the ladder is
// finished and comprehension is the only thing still moving, so "what is my
// dao" is close to the only question left and it parsed to nothing.
//
// The gate is the feature and this must not weaken it. Every pattern below
// reaches a read of the holder's OWN rows. There is no phrasing here that
// consults the world, so no phrasing here can teach anybody anything - being
// unable to name a sect until somebody says it in front of you stays exactly
// as true afterwards as before.

/** The two reads. `knowledge` is what they have heard; `dao` what they hold. */
export type RecallIntent = 'knowledge' | 'dao';

export const RECALL_INTENTS: readonly RecallIntent[] = ['knowledge', 'dao'] as const;

/** What an unrecognised recall intent means. Both are free; this is the wider. */
export const DEFAULT_RECALL_INTENT: RecallIntent = 'knowledge';

/**
 * Asking after a name they may or may not be carrying.
 *
 * Every one requires the first person. "what do the locals say about it" is
 * the ground's history and belongs to `look`, "what is said of the Gleaners"
 * is somebody else's talk, and neither is a question about what this
 * cultivator holds.
 */
export const RECALL_PATTERNS: readonly RegExp[] = [
    /\bwhat do(?:es)? i? ?know (?:of|about)\b/,
    /\bwhat do i (?:know|remember|recall) (?:of|about)\b/,
    /\bwhat have i (?:heard|been told|learned|learnt|got) (?:of|about|on)\b/,
    /\bwhat do i have on\b/,
    /\bremind me (?:what i (?:know|have heard) )?(?:of|about)\b/,
    /\bwhat i know (?:of|about)\b/,
    /\bhave i (?:ever )?heard (?:of|about)\b/,
    /\bdo i know (?:of|about|who|what)\b/
];

// ─────────────────────────────────────────────────────────────────────────
// WHOSE ART THAT WAS
//
// Deliberately narrow. Every pattern here names an ART - "art", "style",
// "technique", "method", "form" - because "do I recognise her" is a question
// about a face and belongs to `recall`, and the whole point of this verb is
// that faces tell nobody anything and arts do.
// ─────────────────────────────────────────────────────────────────────────

/** A noun that means somebody's way of moving rather than a person or a place. */
const AN_ART_NOUN = '(?:art|arts|style|technique|method|form|movement|footwork)';

/** "whose art is that", the question with no claim in it. */
export const WHOSE_ART_IS_THAT = new RegExp(
    `\\bwhose\\s+${AN_ART_NOUN}\\b|\\bwhat\\s+(?:house|sect|school)(?:'s|s')?\\s+${AN_ART_NOUN}\\b`
    // The same question with the art left implicit, which is how somebody asks
    // it about a thing they have just watched: "do I know what school that
    // comes from" is this verb's own exemplar and it reached `recall`, because
    // `do i know what` is one of the knowledge patterns and it is tested a few
    // lines below. Anchored on the house noun AND the coming-from, so "what
    // school takes people" is untouched.
    + `|\\bwhat\\s+(?:house|sect|school|style|line)\\s+(?:that|this|it|they|he|she)\\s+(?:comes?|came|is)\\s+(?:from|out of)\\b`,
    'i'
);

/**
 * "do I recognise this style", "have I seen this form before".
 *
 * The first person is required for the same reason `RECALL_PATTERNS` requires
 * it: "would anyone recognise this" is a question about the world.
 */
export const DO_I_RECOGNISE_IT = new RegExp(
    `\\b(?:do|can|could|would)\\s+i\\s+(?:recognis|recogniz)e\\b`
    + `|\\bi\\s+(?:recognis|recogniz)e\\b`
    + `|\\bhave\\s+i\\s+seen\\s+(?:this|that|it)\\b`
    + `|\\bdo\\s+i\\s+know\\s+(?:this|that)\\s+${AN_ART_NOUN}\\b`,
    'i'
);

/**
 * Words that can stand between the start of the sentence and the house's name.
 *
 * Stripped one at a time from the left rather than matched around, because a
 * lazy capture anchored at the start of the string takes the WHOLE clause:
 * `is this the Azure Cloud Pavilion's art` came out as
 * "is this the Azure Cloud Pavilion", which resolves to nobody. Measured on the
 * first played turn of this verb, which is exactly the failure the party
 * matchers elsewhere in this file carry their own notes about.
 */
const NOT_PART_OF_A_HOUSE_NAME = new Set([
    'is', 'are', 'was', 'were', 'be', 'whose', 'do', 'does', 'did', 'can', 'could',
    'would', 'should', 'i', 'this', 'that', 'it', 'he', 'she', 'they', 'them',
    'the', 'a', 'an', 'tell', 'me', 'if', 'whether', 'look', 'looks', 'like',
    'really', 'actually', 'even', 'some', 'any', 'one', 'of'
]);

/**
 * The house named in a possessive: "the Azure Cloud's art".
 *
 * Run against the original input rather than the lowercased text, because what
 * comes out is handed straight to a name matcher, and a matcher scores an exact
 * name higher than a lowercased one.
 */
export function houseClaimedIn(input: string): string | undefined {
    const found = new RegExp(`([A-Za-z][A-Za-z' -]{2,80}?)(?:'s|s')\\s+${AN_ART_NOUN}\\b`)
        .exec(input);
    if (!found) return undefined;
    const words = found[1].trim().split(/\s+/);
    while (words.length > 0 && NOT_PART_OF_A_HOUSE_NAME.has(words[0].toLowerCase())) words.shift();
    const name = words.join(' ').trim();
    return name.length >= 3 ? name.slice(0, 80) : undefined;
}

/**
 * A claim put to the check: "is this the Azure Cloud's art".
 *
 * The subject may be a pronoun, which is the ordinary case - somebody has just
 * moved and the player is asking about what they saw.
 */
export const IS_THIS_THEIR_ART = new RegExp(
    `\\bis\\s+(?:this|that|it|he|she|they|the\\s+\\w+)\\b[^.?!]*?(?:'s|s')\\s+${AN_ART_NOUN}\\b`,
    'i'
);

/**
 * Which art the sentence is about, when it names one.
 *
 * Undefined is the common answer and is not a failure: "is this the Azure
 * Cloud's art" names a house and no art, and the handler reads that as a
 * question about the house's signature - which is what the sentence means.
 */
export function artNamedIn(input: string): string | undefined {
    const named = /\b(?:recognis|recogniz)e\s+(?:the\s+)?([A-Za-z][\w' -]{2,60}?)\s*[.?!]?$/i.exec(input);
    const cleaned = (named?.[1] ?? '').trim();
    if (cleaned.length < 3) return undefined;
    // A pronoun is not a name, and neither is the bare noun. Both mean "the
    // thing I just watched", which this parser cannot resolve and must not
    // pretend to.
    if (new RegExp(`^(?:this|that|it|them|${AN_ART_NOUN})$`, 'i').test(cleaned)) return undefined;
    return cleaned.slice(0, 80);
}

/**
 * The whole holding, asked for at once. Names nobody on purpose.
 *
 * The `remember` and `recall` forms were missing, which is odd company for
 * `know` and `heard` and was measured as a plain-tier miss: "what do I
 * remember" reached nothing while "what do I know" was answered. So did
 * "remind me what I know" - `RECALL_PATTERNS` carries a `remind me` branch and
 * it requires an `of` or an `about` after it, so it answers the question with
 * a name in it and not the one without.
 */
export const RECALL_EVERYTHING = new RegExp([
    /\bwhat do i know\b\s*[.!?]?$/,
    /\bwhat do i know at all\b/,
    /\bwhat have i heard\b\s*[.!?]?$/,
    /\bwhat names do i (?:have|hold|know)\b/,
    /\bwhat have i learn(?:ed|t)\b\s*[.!?]?$/,
    /\bwhat do i (?:remember|recall)\b\s*[.!?]?$/,
    // `have learned` was here and had to go. "remind me what I have learned" is
    // `list_techniques`'s own exemplar - what a cultivator has been TAUGHT is
    // arts, not names heard - and this verb answered it with the knowledge
    // table. It is genuinely ambiguous between two free reads, so the table
    // leaves it alone rather than choosing confidently: it reaches `unclear`,
    // and the tier below reads it against the corpus, where it belongs to
    // exactly one verb.
    /\bremind me what i (?:know|hold|have heard)\b/,
    /\bgo over what i (?:know|hold|have (?:heard|picked up|learn(?:ed|t)))\b/
].map(r => r.source).join('|'));

/**
 * News, rumour, and what is being said - which in this world IS the holding.
 *
 * There was no verb for any of it: "what news is there" and "what is happening
 * in the world" resolved to nothing, and "I listen for rumours" became a
 * one-day wait. In a game whose entire knowledge model is names reaching you
 * through other people - `hearsay.ts`, the overheard channel, the whole
 * `whisper`/`named`/`placed`/`known` ladder - that is a large missing verb.
 *
 * It was routed to `recall` for a while, which lists everything that has
 * already reached this cultivator. That was defensible - there is no wire
 * service here - and it was answering a different question: `recall` reads the
 * holder's own head and structurally cannot teach them anything, so "what news
 * is there" came back as a well-composed inventory of what the player already
 * had. The failure mode `interact` was producing for the institutional verbs,
 * one layer over: it looks exactly like an answer.
 *
 * It goes to `news` now, which asks the people standing here. See
 * `asking-what-people-are-saying.ts`.
 */
export const NEWS_AND_RUMOUR =
    /\b(?:what news|any news|what(?:'s| is) the news|what(?:'s| is) happening (?:in the world|out there|elsewhere)|what(?:'s| is) going on (?:in the world|out there)|what are people saying|what do people say|listen for (?:rumours?|rumors?|news|talk)|any (?:rumours?|rumors?)|what (?:rumours?|rumors?)|catch up on the news|what have i heard lately)\b/;

/**
 * The same question in the words somebody would actually use.
 *
 * Every one of these was typed at the pattern above and reached nothing, which
 * is the failure this repo keeps relearning: a player cannot find the working
 * half except by guessing, and the failing half is usually the more natural
 * phrasing. "what is the word" and "what is the talk" are the two commonest
 * ways of asking this in the register the setting is written in, and neither
 * contains the word "news".
 *
 * `gossip` is here as a bare noun because it has no other reading. "what do
 * people say about this place" is deliberately NOT here - that is the ground's
 * history and belongs to `look`, and the whole rule for widening a pattern is
 * to check the sentence next door has not been swallowed.
 *
 * -- "WHAT DO PEOPLE AROUND HERE TALK ABOUT" ------------------------------
 *
 * Typed in play, and the word `about` was read as somebody's NAME: *"'about'
 * matched nobody: no knowledge record for that name and nobody standing here
 * it could have meant"*, and the words were then put to whoever was nearest.
 * It is the plainest way there is of asking this question and it reached a
 * person who does not exist.
 *
 * The end-anchor below is the whole of the boundary the paragraph above draws.
 * `talk about` with nothing after it is the general question; `talk about the
 * ruins` names a topic and has to go on reaching the topic. So it matches only
 * where the sentence stops there.
 */
export const ASKING_AFTER_THE_WORLD =
    /\b(?:what(?:'s| is) the (?:word|talk)|any word from|what have you heard|what do they say (?:out there|elsewhere|in the world)|ask(?:ing)? around for (?:news|word|talk)|gossip|hear anything|heard anything|what (?:do|are) (?:people|they|folk|everyone|the locals)(?: around here| round here| here| in this place)? (?:talk|talking) about(?=\s*[?.!]*$))\b/;

/**
 * The same question asked of the ground underfoot, which is a different verb.
 *
 * `NEWS_AND_RUMOUR` has carried a bare "what do people say" from before this
 * verb existed, and `PLACE_HISTORY_PATTERNS` carries the same words - so "what
 * do people say about this place" matched both, and the earlier branch won. It
 * was wrong before this change too (it went to the knowledge listing) and it is
 * this branch's to fix now, because this branch is the one taking it.
 *
 * The split is by what the question POINTS AT rather than by the verb in it:
 * pointed at the ground it is the ground's history, and pointed at nothing in
 * particular it is the world. Deliberately narrow - it names the deictics and
 * nothing else - because the last time a fix here was widened past what had
 * been demonstrated it stole sentences from two other verbs.
 */
export const ABOUT_THE_GROUND_HERE =
    /\b(?:about|of) (?:this|the) (?:place|ground|town|village|city|valley|mountain|ruin|road|hall|province|county)\b|\babout (?:here|it here)\b|\bhappened here\b|\bsay about here\b/;

/**
 * The other axis, and the one that matters at the ceiling.
 *
 * `DaoView.theOnlyAxisLeft` is read off the same predicate the engine gates a
 * re-attempt with, so for somebody whose ladder is shut this is not a flavour
 * question - it is the only account of what they are still doing.
 */
export const RECALL_DAO =
    // `what understanding have i come to` is here because `come to` is one of
    // `move`'s approach phrasings and `move` would otherwise take it: the
    // corpus's own wording for this read was answered by walking the player
    // towards somebody. It is the same question as "where has my understanding
    // got to", which was already here, said the other way round.
    /\b(?:my dao|my own dao|my understanding|my comprehensions?|my insights?|what have i comprehended|what have i understood|what do i understand|what road am i on|which road am i on|my road|where has my understanding got to|what understanding have i (?:come to|reached|arrived at))\b/;

/**
 * Putting the dao somewhere it will outlast you, which is the WRITE of what
 * `recall` reads - and which this engine cannot do.
 *
 * Vetoed rather than answered, and the veto is the honest half. "I carve my
 * dao into the stone" and "I teach the flying blade to a disciple" both
 * satisfy the read patterns above, and the read is a perfectly composed
 * paragraph about what the cultivator has comprehended - which looks exactly
 * like an answer and is not one. That is the same failure `interact` was
 * producing for the institutional sentences, and it is worse here, because a
 * player at the top of the ladder who has just been told what they understand
 * has no way to tell that the carving did not happen.
 *
 * There is no state behind it to reach. Nothing in the engine records a
 * carving, no disciple exists as a row that could be taught (an intake is a
 * count on a ledger, not a person), and `legacy.ts` writes a successor's
 * inheritance at death rather than by anybody's decision. So the sentence
 * falls through to `unclear`, which passes no time and claims nothing, and
 * this comment is where the next person looking for it will find out why.
 * See `src/web/README.md`, "What the write side would need".
 */
export const PUTTING_IT_SOMEWHERE_ELSE =
    /\b(?:carve|carves|carving|inscribe|inscribes|inscribing|engrave|engraves|engraving|cut it into|write (?:it |my dao )?(?:onto|into|on)|leave (?:it|my dao|my understanding) (?:to|for|behind)|pass (?:it|my dao|my understanding) (?:on|to|down)|hand (?:it|my dao) (?:on|to|down)|teach (?:it|my dao|my understanding|my road) to)\b/;

/** Where a recall question stops asking and starts naming. */
export const RECALL_SUBJECT =
    'know of|know about|remember of|remember about|recall of|recall about|'
    + 'heard of|heard about|been told of|been told about|learned of|learned about|'
    + 'learnt of|learnt about|have on|got on|remind me of|remind me about';

// ═══════════════════════════════════════════════════════════════════════════
// ASKING ABOUT A NAMED THING
//
// "tell me about <anything>" is the plainest sentence in the language for the
// commonest thing a player wants, and it reached nothing. Measured against a
// house, a place, a person and an art, deterministic reader:
//
//   tell me about the Gleaners' Company    -> interact(target="me about the …")
//   tell me about Halfwater                -> interact(target="me about …")
//   tell me about Shen Wanshi              -> interact(target="me about …")
//   tell me about the Lesser Qi-Gathering  -> interact(target="me about …")
//   what do you know about Shen Wanshi     -> unclear
//   who is Shen Wanshi                     -> unclear
//
// The first four all produced the same turn: *"You put the words to <whoever
// was nearest>. They look at you the way people look at a sentence with a hole
// in it."* `tell` is in the `talk` intent's verb list and in
// `INTERACT_SUBJECT_VERBS`, so the verb was swallowed and everything after it -
// `me about <X>` - became a person's name. It then fuzzy-matched the real
// subject often enough to reach the right ROW and put it to them as a
// conversation, which is worse than failing: the read printed, the interaction
// settled nothing, and the player could not tell which of the two had happened.
//
// ── WHY THIS IS NOT A NEW VERB ───────────────────────────────────────────
//
// Because the verb exists. `investigate` is free, is in
// {@link READ_ONLY_ACTIONS}, and its own glossary line says *examine a place, a
// PERSON, a record, an inscription, an object*; it resolves its subject through
// `resolveAnything`, which walks what the player holds, who is standing here,
// the houses and places they have heard of, and then the catalogs. That IS the
// general "ask about a named thing" route, and it has been the whole time. What
// was missing is a sentence that reaches it. A second verb onto one resolver is
// the duplication `AGENTS.md` forbids by name, and it would have bought a
// glossary entry, a coverage row and a regenerated `docs/verbs.md` for nothing.
//
// ── WHERE THE BOUNDARY IS, AND IT IS TIGHT ON BOTH SIDES ─────────────────
//
// `tell` is a wide word and `about` is wider, so every pattern here requires
// the indirect object to be the ASKER. "tell me about X" is a question; "I tell
// him I am from the Azure Dew Sect" and "I tell the elder my name" are things
// said TO somebody and stay with `interact`. The branch that reads these sits
// below `status` (which owns "tell me about myself"), below the sect listing
// (which owns "tell me about the houses near here"), below `look/history`
// (which owns "what do people say about this place") and below `news` - so
// every neighbour keeps its own sentence. `ASKING_AFTER_THE_WORLD` is not
// touched: its end-anchor is what keeps "what do people around here talk about"
// away from a topic, and "what have you heard about X" is deliberately left
// where it already goes.
//
// ── AND WHY "WHAT IS X" IS NOT HERE ──────────────────────────────────────
//
// "who is X" is a question about somebody, and it belongs to a name lookup.
// "what is X" is the DEFINITION question - "what is a spirit root", "what is qi
// deviation" - and this world's tone rule is that nobody explains how anything
// works. Routing it here would answer it by searching the roster, which is the
// deflection this whole block exists to remove. It stays unrouted, on purpose.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Where "tell me about" stops asking and starts naming.
 *
 * Every branch pins the asker as the one being told, which is the entire guard
 * against eating the sentences that are spoken TO somebody.
 */
const ASKED_ABOUT_PIVOT = new RegExp(
    '(?:'
    + 'tell me (?:more |a bit more |a little more |something |anything |what you know )?(?:about|of)'
    + '|tell me what (?:you|they) know (?:about|of)'
    + '|what can (?:you|anyone|anybody) tell me about'
    + '|what do(?:es)? (?:you|they|anyone|anybody) know (?:about|of)'
    + ')\\s+',
    'i'
);

/** "who is X" - the same question with the name in the subject position. */
const WHO_IS_THIS = /\bwho(?:'s|s| is| was| are| were)\s+/i;

/**
 * Words that are not a name, whatever position they turn up in.
 *
 * A pivot with one of these behind it is a sentence about nobody in
 * particular, and handing one to the resolver is how "about" once became a
 * person the engine went looking for.
 */
const NOT_A_NAME_AT_ALL = new RegExp(
    '^(?:'
    + 'me|myself|you|yourself|him|her|them|it|they|he|she|us|we'
    + '|this|that|these|those|here|there|anything|something|nothing|everything'
    + '|anyone|anybody|someone|somebody|everyone|everybody|nobody|no one'
    + '|people|folk|the locals|the people|things|stuff|it all|all of it'
    + '|what|which|who|where|when|why|how'
    + ')$',
    'i'
);

/**
 * The thing a sentence is asking about, or nothing.
 *
 * `raw` and not the lowercased text, because what comes back is handed to a
 * name matcher and a matcher scores an exact name above a lowercased one - the
 * same reason `houseClaimedIn` reads the original input.
 */
export function whatIsBeingAskedAbout(raw: string): string | undefined {
    const pivot = ASKED_ABOUT_PIVOT.exec(raw);
    if (pivot) {
        return aNameOrNothing(raw.slice(pivot.index + pivot[0].length));
    }
    const who = WHO_IS_THIS.exec(raw);
    if (!who) return undefined;
    const tail = raw.slice(who.index + who[0].length).replace(/[.!?]+\s*$/, '').trim();
    // ── A NAME IS EITHER WRITTEN AS ONE OR IS MORE THAN ONE WORD ─────────
    //
    // "who is" is the one pivot here with no `about` in it, so it is the one
    // that can be a bare question about the situation rather than about a
    // name - "who is left", "who is watching". Everything genuinely dangerous
    // is claimed higher up the table (`who is here`, `who is recruiting`,
    // `who leads`, `who is in charge`, `who am I`), and this is the guard for
    // the residue: a single lowercase word is not somebody's name.
    if (!/\s/.test(tail) && !/^[A-Z]/.test(tail)) return undefined;
    // And the two-word half of that rule needs its own floor, because a
    // preposition makes two words out of anything: "who is in charge" came out
    // of here as somebody called "in charge". Nothing in this world is named
    // after a preposition or a bare participle.
    if (A_TAIL_THAT_IS_NOT_A_NAME.test(tail)) return undefined;
    return aNameOrNothing(tail);
}

/**
 * Openings that mean the sentence is asking after a situation, not a name.
 *
 * Anchored at the start, so a name that merely contains one of these words is
 * untouched. Only reached by "who is", which is the one pivot here with no
 * `about` in it to say that a name is coming.
 */
const A_TAIL_THAT_IS_NOT_A_NAME = new RegExp(
    '^(?:'
    + 'in|on|at|to|for|with|from|by|of|about|after|before|over|under|behind'
    + '|still|left|next|last|out|up|down|around|about to|going|doing|coming'
    + '|watching|following|talking|standing|waiting|running|selling|buying'
    // ── AND THE DEICTICS, WHICH ARE THE FACES READ AND NOT A NAME ────────
    //
    // "who is the one who is out of reach" is the question the room's own
    // description invites - `describeStanding` writes that sentence - and it
    // belongs to `look/company`, which answers it honestly by not being able to
    // name a stranger either. It is two words, so the name-shape rule above
    // lets it through, and this is what stops it. Bare `the` is deliberately
    // absent: "who is the Storm Tyrant" is a name with an article on it.
    + '|the one|the other|the ones|that|this|these|those|he|she|they|them'
    + ')\\b',
    'i'
);

/** The tail of an asking sentence, cleaned, or nothing if it named nobody. */
function aNameOrNothing(tail: string): string | undefined {
    const cleaned = cleanPlace(tail.replace(/[.!?]+\s*$/, '').trim());
    if (!cleaned || cleaned.length < 3) return undefined;
    return NOT_A_NAME_AT_ALL.test(cleaned) ? undefined : cleaned;
}

// ─── GETTING A WOUND SEEN TO ──────────────────────────────────────────────
//
// The route out of the injury spiral, and it has to be wide, because the
// sentences a player types when the engine has just told them they are hurt
// are not a vocabulary they chose. Every phrasing below was typed at a real
// run that was stuck: "I look for a physician to treat my meridian injuries"
// went to `look` and got a description of the room, and "I get my injuries
// treated" went to `unclear`.
//
// Wide is safe here in a way it is not elsewhere. The worst a false positive
// does is quote a price and refuse, and the branch below cannot fire without
// either a wound in the sentence or somebody in it whose whole trade is
// wounds.

/** Wounds, in the words people use for them rather than the schema's. */
export const INJURY_NOUNS =
    /\b(?:injur\w*|wound\w*|meridians?|hurt|hurts|broken (?:bone|arm|leg|rib|ribs)|bones?|damage)\b/;

export const TREATMENT_VERBS =
    'treat|treats|treated|treating|heal|heals|healed|healing|mend|mends|mending|'
    + 'patch up|patch me up|patch myself up|bind|binds|bandage|bandages|tend|tends|'
    + 'see to|attend to|fix|fixes';

/** Somebody whose trade is wounds. Naming one is half the sentence. */
export const HEALER_NOUNS =
    /\b(?:physician|physicians|doctor|doctors|healer|healers|apothecary|apothecaries|medic|medics|surgeon|surgeons|infirmary)\b/;

/**
 * Going to get it done, as opposed to doing it.
 *
 * `talk`, `ask` and `speak` are deliberately absent: "I talk to the physician"
 * is a conversation and belongs to `interact`, and a player who wanted the
 * treatment says so.
 */
export const SEEKING_CARE_VERBS =
    'see|sees|seeing|find|finds|finding|look for|looks for|looking for|visit|visits|'
    + 'consult|consults|pay for|pays for|pay|hire|hires|get|gets|want|wants|need|needs|'
    // `go for` is the phrasing the attack block was taking. See
    // {@link GOING_FOR_CARE}: "I go for care for what is torn" is a wounded
    // player asking to be seen to, and it started a fight with somebody called
    // "care for what is torn".
    + 'go to|goes to|go for|goes for|head to|call for|send for';

export const TREATMENT_NOUNS =
    /\b(?:treatment|medical care|a course of care|course of care|first aid|the infirmary|care for)\b/;

/**
 * The phrasing where the treatment verb is a participle at the end of the
 * sentence rather than a verb at the front of it.
 *
 * "I get my injuries treated" is the single most natural way to ask for this
 * and `usedAsVerb` correctly refuses it, because "treated" there is not in
 * verb position. Matched whole instead.
 */
/**
 * Going FOR something rather than going for somebody.
 *
 * `go for` is an attack verb - "I go for the man at the gate" - and the attack
 * block sits above every care rule in the table, so it took the sentence a
 * wounded player types. Measured on a played run, deterministic reader, at 20
 * of 40 health:
 *
 *   > I go for care for what is torn
 *   attack(target="care for what is torn", intent=drive_off)
 *   engine.resolveParty: Unresolved party "care for what is torn"
 *
 * A refusal, this time, because nobody in the square is called that - but the
 * verb is `attack`, and against a square with a body in it the same words are a
 * fight. Vetoed rather than reordered, on the rule the attack block already
 * follows: a sentence about a fight is a fight first, and this is the narrow
 * statement that a sentence about care is not one.
 */
export const GOING_FOR_CARE =
    /\bgo(?:ing|es)? for\b[^.!?]*\b(?:care|treatment|help|medicine|a physician|a doctor|a healer|an apothecary|the infirmary)\b/;

/**
 * Working AT something that is not a job.
 *
 * The employment branch admits `work at`, `work the` and `work a` because "I
 * work at the mill", "I work the fields" and "I work a season at the forge" are
 * all how somebody takes paid labour. The same three words in front of a
 * practice noun or a bare pronoun are the opposite sentence - somebody putting
 * hours into their own cultivation - and the employment branch sits three
 * hundred lines above both verbs that own it.
 *
 * Deliberately a list of OBJECTS rather than a narrowing of the preposition:
 * the preposition is not what makes the difference, and taking `at` away would
 * cost the mill.
 */
/**
 * Somebody saying they are going to raise a number, not asking what it is.
 *
 * The status read owns `my rank`, `my realm`, `my progress` and `my
 * cultivation`, correctly - those are the four things a player asks after - and
 * it sits above the cultivation verb, so a sentence that names one of them as
 * the OBJECT of a raising verb was answered with the sheet. Measured on the
 * corpus's own phrasing: "I want to build up my cultivation" spent no day and
 * printed a character sheet.
 *
 * Narrow to the verbs that mean increasing it. Asking is unaffected, which is
 * every phrasing this branch was written for.
 */
export const RAISING_IT_RATHER_THAN_READING_IT =
    /\b(?:build up|building up|build|raise|raising|improve|improving|deepen|deepening|grow|growing|advance|advancing|push|pushing|increase|increasing|work on|working on) (?:up )?(?:my|the) (?:rank|realm|progress|cultivation)\b/;

export const WORKING_AT_A_PRACTICE = new RegExp([
    /\bwork(?:s|ing)? (?:at|the|a) (?:it|this|that|them)\b/,
    /\bwork(?:s|ing)? (?:at|on|the) (?:my |the |a |this |that |her |his |their )?(?:cultivation|method|methods|art|arts|technique|techniques|manual|manuals|form|forms|stance|stances|canon|scripture|dao|road|practice|training|breathing)\b/
].map(r => r.source).join('|'));

export const HAVING_IT_SEEN_TO =
    /\b(?:get|gets|getting|have|has|having|want|wants|wanting|need|needs|needing|would like|ask for|asking for)\b[^.!?]*\b(?:injur\w*|wounds?|meridians?|myself|me)\b[^.!?]*\b(?:treated|seen to|looked at|fixed|attended to|mended|patched up|bandaged|set)\b/;

// ─── BUYING A LINE OFF THE BOARD ──────────────────────────────────────────
//
// `market` prints twenty-two priced lines. Four verbs spent money before this
// existed and between them they covered three of those lines, so the board was
// advertising a physician, a ferry, a scribe, an inn and a course of care that
// no sentence could reach. The purchase itself is refused or resolved in
// `game.ts` against `PRICES`; all this has to do is stop the sentence being
// read as an approach to a person.

export const BUYING_VERBS =
    'buy|buys|buying|purchase|purchases|purchasing|pay for|pays for|order|orders|'
    + 'book|books|hire|hires|acquire|acquires|take passage|pay the';

/**
 * Paying somebody off, which is `interact` and not a line on a board.
 *
 * Vetoed rather than ordered around, because the sentence that needs it
 * satisfies the buying rule completely and means something else entirely.
 */
// ─── PUTTING SOMETHING ON THE COUNTER ─────────────────────────────────────
//
// The other direction, and the only one that existed was buying. Gathering
// prices every herb it turns up, `quoteSale` has priced a lot the whole time,
// and there was no sentence between the two.

export const SELLING_VERBS =
    'sell|sells|selling|offload|offloads|offloading|unload|unloads|unloading|'
    + 'hawk|hawks|hawking|peddle|peddles|peddling|part with|parts with|'
    + 'cash in|cashes in|trade in|trades in|trade away';

/** The same list as a pattern, for `extractSubject`, which reads `.source`. */
export const SELLING_SUBJECT_VERBS = new RegExp(`${SELLING_VERBS}|offer|offers|offering|put up`);

/**
 * Asking what a thing FETCHES rather than putting it down.
 *
 * Both are `sell` - a quote is a read of the same function - so this is not a
 * veto, it is here so that a question about the board as a whole still reaches
 * `market` and does not become an attempt to empty the pouch.
 */
export const SELLING_ASKED_AS_A_BOARD =
    /\b(?:what(?:'s| is) (?:for sale|on offer)|what can i buy|the prices?|(?:browse|visit|see|check|go to|head to) the (?:market|bazaar|stalls?)|(?:what|who)(?:'s| is| are)? (?:they|people|anybody|anyone|the others|everybody) (?:selling|trading)|who(?:'s| is| are)? (?:here )?(?:selling|trading))\b/;

export const BUYING_A_PERSON_OFF =
    /\b(?:bribe|bribes|bribing|pay off|pays off|grease|buy (?:his|her|their|the \w+'s) silence|pay (?:him|her|them) (?:off|to))\b/;

/**
 * What each verb actually puts on the table.
 *
 * The translation lives HERE rather than in `game.ts`, because the social
 * resolver reads `leverage` and never `intent` - that is the design, and it is
 * what stops seduction becoming a subsystem instead of a member of an enum.
 * Doing the mapping at the point the verb is recognised keeps the rule "nothing
 * downstream branches on the word the player typed" literally true.
 *
 * Intents with nothing behind them are absent rather than `none`: an absent key
 * is a sentence that put nothing on the table, and the resolver's own default
 * says so.
 */
const LEVERAGE_BEHIND_INTENT: Readonly<Partial<Record<string, z.infer<typeof ApproachLeverageSchema>>>> = {
    bribe: 'coin',
    threaten: 'force',
    // A theft is backed by the ability to take it, which is what `force` means
    // in this enum - so it says so, here, rather than falling through to
    // `WHAT_A_BARE_DEMAND_IS_BACKED_BY` and being priced as a polite request
    // backed by the asker's reputation. Measured before this: "asked steal with
    // nothing on the table but the asking", and the ground under it read as
    // whether a stranger is BELIEVED rather than as whether anybody would make
    // a thief pay.
    steal: 'force',
    // The asker themselves. Priced by the same machine as the other two.
    seduce: 'attachment'
};

// ─────────────────────────────────────────────────────────────────────────
// DETERMINISTIC INTENT PARSING
// The zero-configuration path, and the safety net under the model. It must be
// good enough to play the whole game with, because with no provider reachable
// it *is* the whole game.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a look was pointed AT, when it was pointed at anything.
 *
 * Requires the preposition, so "I look around" and "I look for someone" keep
 * the branches they already have and only a sentence with an object in it
 * produces one.
 */
const LOOKED_AT = /\blooks?(?:ing)?\s+(?:at|over|upon)\s+(.{2,80}?)\s*[.!?]?$/i;

/**
 * Words that name the scene rather than anything in it.
 *
 * "I look at the sky" is a look. It has an object in it grammatically and no
 * object in it as far as the world is concerned - there is no sky row, and
 * routing it to the verb that resolves entities would answer a moment of
 * atmosphere with "nothing here answers to it".
 *
 * A closed set, the same shape and for the same reason as `ANYBODY` and
 * `POINTING`: everything in it is scenery or a synonym for the surroundings, so
 * a name can never land in it. It is deliberately short - it exists to stop
 * {@link LOOKED_AT} stealing the sentences the room read already owns, not to
 * enumerate the sky.
 */
const THE_SCENE_ITSELF =
    /^(?:the\s+)?(?:sky|skies|stars?|moon|sun|clouds?|weather|horizon|view|scenery|landscape|surroundings|ground|earth|it all|everything|this place|the place|my surroundings)$/i;

/**
 * Intent tables for the deterministic parser.
 *
 * Note carefully what these do and do not do. They label what the player was
 * trying to do so the narrator can describe it; they never select an engine
 * path. Every `move` resolves through the same movement routine and every
 * `interact` through the same interaction routine, whichever label matched -
 * which is the whole reason the label is allowed to be an open string.
 */
const MOVE_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    // Bare `run` is admitted only as the WHOLE sentence, and `run for it` and
    // `get out of here` beside it. "I run" reached nothing while "I run away"
    // worked, which is this file's near-synonym rule failing on the shortest
    // form of the most urgent verb in the game. Anchored rather than added to
    // the alternation, because "I run to the mountain" is a journey and "I run
    // a stall" is not a verb this parser owns at all.
    // `walk away` is the third act of the owner's own acceptance sentence -
    // "steal, then hand it to someone else before running away" - and it
    // reached nothing. It is leaving the scene rather than naming a
    // destination, which is what this intent is for, and `move` says honestly
    // that it does not know where to.
    ['flee', /\b(?:flee|escape|run away|get away|disengage|retreat|break off|withdraw|hide from|run for it|get out of (?:here|there)|leg it|walks? away|walked away|walks? off|walk out on)\b|^\s*(?:i\s+)?runs?\s*[.!?]*$/],
    // `go into` was absent while `go inside` and `step into` were present, so
    // "I go into the village" reached nothing. The site rule takes this
    // sentence first when a site noun is in it, and movement gets it otherwise,
    // which is the correct order for both.
    ['enter', /\b(?:enter|go into|goes into|go inside|step into|climb into|breach|infiltrate|sneak into|slip into)\b/],
    ['approach', /\b(?:approach|draw near|walk up to|close on|come to)\b/],
    ['follow', /\b(?:follow|shadow|trail|tail)\b/],
    // `ride` was here, as a LABEL, and the label was the whole of what it
    // bought: every `move` resolves through one flat one-day journey whichever
    // intent matched, so "I ride to Nine Peaks" and "I walk to Nine Peaks" were
    // the same event with a different word on the log while a whole conveyance
    // layer sat with no caller. It is its own verb now - see {@link RIDING} -
    // and its branch is tested ahead of this table.
    ['travel', /\b(?:travel|go to|head (?:to|for|out|north|south|east|west|upriver|downriver|inland|back|on|home)|walk to|journey|set out|set off|press on|carry on to|depart|move to|leave for|make (?:my|his|her) way)\b/]
];

// ─────────────────────────────────────────────────────────────────────────
// THE THREE WAYS OF COVERING GROUND THAT ARE NOT WALKING
//
// Every pattern here is EXPORTED, and that is load-bearing rather than
// tidiness: the spelling repair harvests its vocabulary out of the patterns in
// this module, and a word it has never seen gets respelled to the nearest one
// it has. Measured before these existed - "I take a carriage to the next
// province" came back as `propose`, because `carriage` is one edit from
// `marriage` and the repair was the only tier that had an opinion about it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Putting something under you for the journey.
 *
 * `mount` as a bare noun is deliberately absent from the verb half. It does
 * not match "mountain", and it does match "I mount the steps", and there is no
 * demonstrated sentence needing it - but it IS accepted as the thing being
 * ridden, because "I ride a mount to Kettle" names one and nothing else in the
 * sentence could be meant.
 */
export const RIDING = new RegExp([
    '\\b(?:ride|rides|riding|rode|ridden)\\b',
    '\\b(?:saddle|saddles|saddling|saddled)\\b',
    '\\b(?:take|takes|taking|took|hire|hires|hiring|hired|board|boards|boarding)\\s+'
        + '(?:a\\s+|an\\s+|the\\s+|my\\s+|his\\s+|her\\s+)?'
        + '(?:spirit\\s+|drawn\\s+|shod\\s+|named\\s+|deep-?drawn\\s+|broken\\s+|river\\s+)*'
        + '(?:carriage|cart|coach|wagon|mount|beast|horse|boat|barge|craft|hull|litter|sedan)\\b',
    '\\b(?:by|on|aboard|astride)\\s+'
        + '(?:a\\s+|an\\s+|the\\s+|my\\s+|spirit\\s+|drawn\\s+|shod\\s+|named\\s+)*'
        + '(?:carriage|cart|coach|wagon|mount|beast|horse|boat|barge|craft|hull)\\b',
    // The destination can sit between the verb and what is under them - "I fly
    // to Scarwater on my sword" is how somebody actually says it - so the gap
    // is bounded rather than adjacent. Bounded and not free: `on my sword` has
    // to be in the same clause or the rule starts reading sentences that
    // mention a blade three ideas later.
    '\\b(?:fly|flies|flying|flew)\\b[^.!?]{0,40}?\\bon\\s+(?:my|his|her|the)\\s+(?:sword|blade)\\b',
    '\\b(?:fly|flies|flying|flew)\\s+(?:there\\s+)?on\\s+(?:my|his|her|the)\\s+(?:sword|blade)\\b',
    '\\bsword[- ]flight\\b'
].join('|'));

/** What is under them, when the sentence says. Matched against `CONVEYANCES`. */
export const WHAT_IS_BEING_RIDDEN =
    /\b(?:ride|rides|riding|rode|saddle|saddles|take|takes|taking|took|hire|hires|hired|board|boards|by|on|aboard|astride)\s+(?:a\s+|an\s+|the\s+|my\s+|his\s+|her\s+)?((?:spirit\s+|drawn\s+|shod\s+|named\s+|deep-?drawn\s+|broken\s+)*(?:carriage|cart|coach|wagon|mount|beast|horse|boat|barge|craft|hull|sword|blade))\b/i;

/**
 * Stepping across the distance rather than covering it.
 *
 * Every phrasing here needs BOTH a folding verb and the word for what is being
 * folded, or a phrase that can mean nothing else. "I fold the paper" reaches
 * nothing, which is correct: there is no paper in this game and there is no
 * reason to guess.
 */
export const FOLDING_SPACE = new RegExp([
    '\\b(?:fold|folds|folding|folded)\\s+(?:through\\s+|across\\s+|open\\s+|up\\s+)?space\\b',
    '\\bspace[- ]fold(?:s|ing|ed)?\\b',
    '\\bspatial\\s+fold(?:s|ing)?\\b',
    '\\b(?:step|steps|stepping|stepped)\\s+(?:through|across)\\s+(?:space|the\\s+distance)\\b',
    '\\b(?:tear|tears|tearing|tore)\\s+(?:through|open)\\s+space\\b',
    '\\b(?:fold|folds|folding|folded)\\s+(?:my\\s+way\\s+|myself\\s+)?(?:to|across|over|straight\\s+to)\\b',
    '\\b(?:cross|crosses|crossing|cover|covers|covering)\\s+the\\s+distance\\s+in\\s+one\\s+step\\b'
].join('|'));

/**
 * A counter, a board, and a place on somebody else's span.
 *
 * `board` on its own is not enough and must not be: the sect mission board owns
 * that noun, and `SECT_DUTY_PATTERN` had it first. Every phrasing here carries
 * either the house's name or the word for the thing being bought.
 */
export const A_SPAN_COUNTER = new RegExp([
    '\\b(?:passage|ticket|fare|berth)\\b',
    '\\b(?:measured\\s+)?span\\b',
    '\\b(?:gate\\s+station|terminal|waystation)\\b'
].join('|'));

/** Whether the sentence is about a journey at all, as against a house's board. */
export const A_COUNTER_NOT_A_MISSION_BOARD = new RegExp([
    '\\b(?:passage|ticket|fare|berth)\\b',
    '\\bspan\\b',
    '\\b(?:gate\\s+station|terminal)\\b'
].join('|'));

const PASSAGE_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    // Buying, first, because a sentence about buying one contains every word a
    // sentence about reading the board contains.
    ['buy', /\b(?:buy|buys|buying|bought|book|books|booking|booked|purchase|purchases|purchasing|pay for|pays for|take|takes|taking|took|get me|put me)\b/],
    ['board', /\b(?:board|boards|list|lists|what|which|where|read|reads|reading|check|checks|look|looks|see|sees|price|prices|cost|costs|much|run|runs|go|goes|departs?)\b/]
];

/**
 * A word given, carried or not kept.
 *
 * The NOUN is required in every branch. "I swear at him" is not an oath and
 * must never be read as one, which is why swearing on its own does not fire -
 * a sentence about giving your word says which word or says the noun.
 */
export const AN_OATH = new RegExp([
    '\\b(?:oath|oaths|oathwright|vow|vows|indenture|indentured)\\b',
    '\\b(?:my|our|his|her|their)\\s+word\\b',
    '\\bword\\s+of\\s+honou?r\\b',
    '\\bbound\\s+word\\b',
    '\\bterm\\s+of\\s+service\\b',
    '\\b(?:swear|swears|swearing|swore|sworn)\\s+(?:to|by|myself|it|that|before|brotherhood|an?\\b)',
    '\\b(?:sworn|blood)\\s+(?:brother|brotherhood|sister|siblings?)\\b',
    '\\bblood\\s+pact\\b',
    '\\bpledge\\s+(?:myself|my|to)\\b'
].join('|'));

/** Who the word is given to, or who holds the one being broken. */
export const OATH_SUBJECT_VERBS =
    /oath to|oath with|oath before|vow to|swear to|swears to|swore to|pledge myself to|pledge to|my word to|break (?:my |the |our )?(?:oath|vow|word) (?:to|with)|indenture to|bound to|sworn to/;

/** Where somebody is stepping, when the phrasing puts the place after the fold. */
export const FOLD_SUBJECT_VERBS =
    /fold space to|fold to|fold across to|step through space to|step across to|fold myself to|fold my way to|space to/;

const OATH_INTENT_PATTERNS: ReadonlyArray<[OathIntent, RegExp]> = [
    // Breaking, first, because every sentence about breaking one contains the
    // vocabulary of swearing one. The order is the order of `OATH_INTENTS`.
    ['break', /\b(?:break|breaks|breaking|broke|broken|renounce|renounces|renouncing|repudiate|repudiates|forswear|forswears|abandon|abandons|abandoning|go back on|goes back on|going back on|walk out of|walks out of|walk away from|run from|runs from|running from|will not keep|wont keep|do not keep|stop keeping)\b/],
    ['swear', /\b(?:swear|swears|swearing|swore|give my word|gives my word|giving my word|take an oath|takes an oath|taking an oath|make an oath|makes an oath|pledge|pledges|pledging|bind myself|binds myself|binding myself)\b/],
    ['read', /\b(?:what|which|who|where|how|read|reads|reading|carry|carries|carrying|hold|holds|holding|bound|owe|owes|owed|standing|check|checks)\b/]
];

/**
 * The nouns that are not people, however violent the verb in front of them.
 *
 * "Strike at the barrier" is the game's own phrase for a breakthrough attempt
 * and appears in its own UI, and the attack rule was matching it on "the [a-z]"
 * and sending the player after a person who is not there. Checked before the
 * attack rule rather than after it, because the attack rule has to stay first:
 * every sentence about a fight is full of other verbs' nouns.
 */
/**
 * Nouns that look like something to hit and are the bottleneck.
 *
 * Sole job: keep the attack branch off a sentence about the ladder. "I strike
 * at the barrier" is a breakthrough attempt and reads as assault.
 *
 * `wall` and `ceiling` were added when the drive harness measured "have I hit
 * a wall" routing to `attack` - `hit` is an attack verb and `usedAsVerb`
 * correctly found it in verb position, so the sentence was a fight against a
 * noun the object model does not contain. Nothing in this world is a wall or a
 * ceiling that anybody could swing at, so exempting both costs the attack verb
 * nothing and returns four phrasings of the commonest question in the game.
 */
const AIMED_AT_THE_LADDER =
    /\b(?:the )?(?:barrier|bottleneck|blockage|realm boundary|wall|ceiling|next (?:rank|realm))\b/;

const ATTACK_SUBJECT_VERBS = /attack|strike at|strike|hit|fight|kill|murder|assassinate|slay|cut down|draw on|swing at|go for|go at|put a sword through|put a blade through|set upon|set on|jump|ambush|assault|take on|put down|finish|sneak up on|creep up on|waylay|lie in wait for|cut|slit|slash|stab|knife|strangle|throttle|poison|cripple|break|snap|crush|sever|hack|tear|rip/;

/**
 * NOT EXPORTED, AND THAT IS LOAD-BEARING.
 *
 * `harvestVocabulary` walks this module's EXPORTS to build the spelling
 * repair's dictionary. Exporting the three patterns below put `strangle` into
 * it, and the repair promptly rewrote the corpus's own investigate exemplar -
 * *"there is something strange here and I want to understand it"* - into a
 * strangling. One word of new vocabulary took a whole verb's sentence.
 *
 * These are read only in this file, so they stay in it.
 */
/**
 * Violence done to a body, said the way people say it.
 *
 * ── ELEVEN OF THIRTEEN WAYS OF KILLING SOMEBODY REACHED NOTHING ──────────
 *
 * Probed after a played turn in which "I cut Gu Peiyan's throat" came back
 * `unclear`. The whole family went with it:
 *
 *   cut <name>'s throat    slit his throat        break her neck
 *   stab him               put my knife in his back
 *   cut off his arm        take his hand off      cripple his cultivation
 *   poison his tea         burn the house down with them in it
 *
 * Only "kill X" and "cut him down" worked, so the game answered the word
 * `kill` and nothing else. This catalog is emphatic that maiming is WORSE than
 * robbery, that crippling somebody's cultivation is its own kind of wrong, and
 * that what a person does about being wronged is most of the content - and
 * none of it was reachable by saying it.
 *
 * ── THE OBJECT IS THE SIGNAL, NOT THE VERB ───────────────────────────────
 *
 * This is its own pattern rather than more entries in the alternation above,
 * because `cut`, `break`, `open` and `take off` are ordinary words with
 * ordinary objects - cutting herbs, breaking camp, taking a day off - and
 * adding any of them there would steal sentences from four other verbs, which
 * is this file's most-repeated lesson.
 *
 * What makes it violence is WHAT IS BEING CUT: a part of somebody. So the body
 * part is the anchor, the verb is narrow around it, and the possessive between
 * them may be a pronoun or a name. "I cut the rope" cannot reach it and
 * neither can "I break camp".
 *
 * `stab`, `strangle` and `poison` are matched on the verb instead, for the
 * opposite reason: with a person on the end of them they have no innocent
 * reading, exactly as `murder` and `assassinate` already do not.
 */
const VIOLENCE_TO_A_BODY =
    // Something taken off, opened or broken, and it is part of a person.
    /\b(?:cut|cuts|cutting|slit|slits|slitting|slash|slashes|open|opens|break|breaks|breaking|snap|snaps|crush|crushes|hack|hacks|sever|severs|take|takes|taking|tear|tears|rip|rips)\s+(?:off\s+|out\s+|through\s+)?(?:the|his|her|their|its|my|[A-Z][a-z]+(?:'s)?(?:\s+[A-Z][a-z]+)?(?:'s)?)\s+(?:throat|neck|spine|skull|head|arm|arms|hand|hands|leg|legs|eye|eyes|ear|ears|tongue|fingers?|kneecaps?|ribs?|jaw|heart)\b/
    ;

/**
 * The part is not the person, and the resolver wants the person.
 *
 * `extractSubject` hands back everything after the verb, so "I cut Gu Peiyan's
 * throat" produced a target called `Gu Peiyan's throat`, which resolves against
 * nobody - the same failure `HOW_THE_FIGHT_OPENED_TAIL` was written for, one
 * noun along. Somebody's throat is not a second person standing next to them.
 *
 * Cuts at both ends, because the phrasings put the person in the middle: the
 * preposition that opens `cut OFF his arm` and `put my knife IN his back`, and
 * the part itself at the tail. `down` goes with it so "cut him down" resolves
 * to `him`.
 */
const THE_PART_IS_NOT_THE_PERSON = [
    /^(?:off|out|in|into|through|down)\s+/i,
    /(?:'s)?\s+(?:throat|neck|spine|skull|head|arms?|hands?|legs?|eyes?|ears?|tongue|fingers?|kneecaps?|ribs?|jaw|heart|back|cultivation|dantian|meridians|foundation|golden core|core|tea|cup|food|drink)\s*$/i,
    /\s+down\s*$/i
];

/** The verbs that have no innocent object once a person is on the end of them. */
const VIOLENCE_WITH_NO_OTHER_READING =
    /\b(?:stab|stabs|stabbing|stabbed|knife|knifes|knifing|gut|guts|disembowel|disembowels|strangle|strangles|throttle|throttles|smother|smothers|drown|drowns|poison|poisons|poisoning)\b|\bput (?:my|the|a) (?:knife|blade|dagger|sword|spear) (?:in|into|through)\b/;

/**
 * Taking somebody's cultivation off them, which this world holds to be worse
 * than killing them. `faction-character.ts` says a broken oath is structural
 * rather than punitive; so is this, and it is the sentence the reprisal
 * machinery already knows how to answer.
 */
const CRIPPLING_SOMEBODY =
    /\b(?:cripple|cripples|crippling|ruin|ruins|ruining|destroy|destroys|destroying|break|breaks|breaking)\s+(?:the|his|her|their|my|[A-Z][a-z]+(?:'s)?(?:\s+[A-Z][a-z]+)?(?:'s)?)\s+(?:cultivation|dantian|meridians|foundation|golden core|core)\b/;

/**
 * The fight was opened from cover, which is a different act from squaring up.
 *
 * Read off the SENTENCE and never from the model, for the reason `terms` is:
 * whether somebody was seen coming is a fact about what they did, and a model
 * choosing it would be a model deciding what a fight cost. It reaches
 * `resolveConfrontation`'s `opening`, which gives the first exchange the
 * ambush edge the table has always priced and takes the target's first swing
 * away - and nothing about what a blow does to a body changes.
 *
 * "from behind" is here because it was landing INSIDE the target string:
 * "I attack him from behind" resolved to a person called "him from behind"
 * and then to nobody, so the commonest phrasing of the commonest ambush in
 * the genre reached neither the verb nor a person.
 */
const OPENED_FROM_COVER = new RegExp(
    '\\b(?:'
    + 'sneak up on|sneaks up on|sneaking up on|creep up on|creeps up on|'
    + 'from behind|from cover|from the shadows|from hiding|from concealment|'
    + 'unseen|unnoticed|ambush|ambushes|ambushing|lie in wait|lying in wait|waylay|'
    + 'catch (?:him|her|them|it) (?:unawares|off guard|by surprise)|'
    + 'take (?:him|her|them|it) by surprise|by surprise|'
    + 'while (?:he|she|they|it) (?:is|are) (?:not looking|unaware|asleep|distracted|turned away)|'
    + 'while (?:he|she|they|it) sleeps|'
    + 'before (?:he|she|they|it) (?:sees|notices|knows|can react)|'
    + 'without being seen|without warning'
    + ')\\b'
);

/**
 * The tail of a sentence that says HOW a fight was opened, cut off the target.
 *
 * `extractSubject` takes everything after the verb, so the manner clause ended
 * up inside the name. Stripped rather than parsed around, because the manner is
 * already read by `OPENED_FROM_COVER` off the whole sentence.
 */
const HOW_THE_FIGHT_OPENED_TAIL =
    /\s+(?:from (?:behind|cover|the shadows|hiding|concealment)|by surprise|unseen|unnoticed|while (?:he|she|they|it)\b.*|before (?:he|she|they|it)\b.*|without (?:being seen|warning)|and (?:strike|strikes|hit|hits|attack|attacks|kill|kills|cut|go for)\b.*)\s*$/i;

/**
 * Making somebody do something, with hands rather than with words.
 *
 * Each row is a label for what the compliance was FOR, and nothing in the
 * engine branches on it - the goal handed to the resolver is `coerce` in every
 * case. It is carried so the record and the narrator can say what was wanted.
 *
 * Ordered most specific first. Two exclusions are load-bearing:
 *
 *   `threaten` and `intimidate` are NOT here. They are words, they already
 *   reach `interact`, and the whole distinction this verb exists for is that
 *   coercion is the point at which the target stops being talked to.
 *
 *   bare "force" is NOT here either. "I force my way up to the next layer" is
 *   a breakthrough, and every pattern below requires a person and a thing
 *   being complied with, so the ladder sentence cannot reach any of them.
 */
const COERCION_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    // An animal made to submit is a tamed animal. Same act, same resolver, and
    // `BEAST_CHANGE_ORDINAL` does all the differentiating on its own - above
    // it, what is standing there is a person and this is an indenture.
    // "break the wolf in" is how somebody says it and "break in the wolf" is
    // not, so the object sits inside the verb. Found by the intent walk.
    ['tame', /\b(?:tame|tames|taming|break(?:s|ing)?(?:\s+\S+){0,3}\s+in\b|bring (?:it|him|her|them) to heel|subjugate)\b/],
    ['talk', /\b(?:beat (?:it|the truth|an answer|the location|the name) out of|wring (?:it|the truth|an answer) (?:out )?(?:of|from)|make (?:him|her|them) talk|force (?:him|her|them) to talk|torture)\b/],
    ['hand_over', /\b(?:force|forces|forcing|strong-?arm|strong-?arms|strong-?arming|extort|extorts|extorting|shake down|shakes down)\b[^.!?]*\b(?:into (?:handing|giving|paying|opening)|to hand|to give|to pay|to open|out of (?:him|her|them))\b/],
    ['submit', /\b(?:coerce|coerces|coercing|browbeat|browbeats|browbeating)\b/],
    ['submit', /\b(?:force|forces|forcing|make|makes|making)\b\s+(?:\w+\s+){0,8}?(?:to\s+)?(?:submit|kneel|yield|bow|obey|comply|surrender|serve me|swear to me)\b/],
    ['submit', /\bmake (?:him|her|them|it) (?:mine|obey|kneel|submit|yield)\b/],
    ['hand_over', /\bforce (?:him|her|them|it) (?:to|into)\b/]
];

const COERCE_SUBJECT_VERBS =
    /coerce|coerces|coercing|browbeat|strong-?arm|extort|shake down|subjugate|tame|tames|taming|break|force|forces|forcing|make|makes|making|beat (?:it|the truth|an answer) out of|wring/;

/**
 * The tail of a coercion that says what the compliance was FOR, cut off the
 * target for the same reason the fight's manner clause is: "I force the
 * merchant to hand over the ledger" names a merchant, not a merchant-to-hand-
 * over-the-ledger.
 */
const WHAT_THE_COMPLIANCE_WAS_FOR_TAIL =
    /\s+(?:(?:to|into)\s+)?(?:submit|kneel|yield|bow|obey|comply|surrender|serve|swear|talk|mine|into|in\b|hand|give|pay|open)\b.*$/i;

const MOVE_SUBJECT_VERBS = /flee|escape|run|retreat|hide|withdraw|enter|infiltrate|sneak into|approach|follow|travel|go|head|walk|journey|depart|move|ride/;

const INTERACT_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['deceive', /\b(?:lie to|deceive|mislead|misdirect|bluff|pretend|disguise|pose as|feign|trick)\b/],
    /**
     * Ahead of `negotiate` so it does not eat "beg", and ahead of `talk`, which
     * would take every one of these as speech.
     *
     * `attachment` is already a member of `ApproachLeverageSchema`, priced by
     * the same machine that prices a purse or a threat, so seduction needs no
     * subsystem and gets none: what this row does is name the leverage, and
     * nothing downstream branches on the word the player typed.
     */
    ['seduce', /\b(?:seduce|seduces|seducing|court|courting|woo|charm|flirt|flatter|win (?:him|her|them) over|make (?:him|her|them) fond of me|get close to)\b/],
    // "I make it clear what happens if he refuses" is a threat said the way
    // people say it, and it reached nothing at all - so a promise of harm, the
    // one leverage in the game that costs its maker nothing until it is made
    // good on, had no phrasing outside the word itself. Every alternative added
    // names the consequence, which is what a threat is.
    ['threaten', /\b(?:threaten|intimidate|menace|warn (?:him|her|them)|make (?:him|her|them) afraid|make it clear what happens|tell (?:him|her|them) what happens if|say what happens if|let (?:him|her|them) know what happens if)\b/],
    /**
     * Taking it off a PERSON, which is not the same verb as taking it out of a
     * house's reserves.
     *
     * The sect branch above owns the reserves - it fires only on a sentence
     * carrying a house or treasury noun, and it runs earlier - so "I steal from
     * the sect treasury" is still a months-long siphon and "I steal from Shen
     * Wanshi" is this. The grave is likewise already claimed, by `site`.
     *
     * WHY IT HAS TO BE HERE AT ALL. The engine has resolved a theft off a
     * person since the pressure model was wired, through `interact`, and only a
     * MODEL could reach it: the deterministic parser answered every phrasing of
     * it with `unclear`. So the same sentence did something with a provider
     * configured and nothing without one, which `both-modes-hand-the-engine-
     * the-same-action.test.ts` exists to prevent and could not see, because it
     * compares the parser against itself.
     *
     * `pick ... pocket` is on the list because it is the plainest way anybody
     * says the small version, and `mug` and `rob` because they are what a
     * player types when they mean the large one.
     */
    /**
     * ── THE COMMONEST PHRASINGS OF THIS VERB DID NOT ROUTE AT ALL ────────
     *
     * Measured on the current tree, six ordinary ways of saying one thing:
     *
     *   "I take Cao Antao's purse"                     -> unclear
     *   "I cut the purse off the nearest person's belt" -> unclear
     *   "I take the jade off him"                       -> unclear
     *   "I lift the pouch from his belt"                -> unclear
     *   "I steal his purse"    -> steal, target "his purse", which is not a person
     *   "I pick his pocket"    -> steal, no target at all
     *   "I rob the merchant"   -> steal, target "merchant"
     *
     * One of seven came out usable, and `unclear` is the wrong answer to every
     * one of the four: theft is an ordinary move with a resolver, a price and
     * consequences behind it, and the engine has to be the one that refuses it.
     * A reader that declines to route it hands the whole turn to guesswork.
     *
     * ── THE VOCABULARY WAS ALREADY IN THIS FILE, WIRED TO THE WRONG THING ─
     *
     * {@link POCKET_PICKING} matches `cut ... purse`, `lift ... sleeve` and
     * `pick ... pocket` - every idiom that failed - and its only use was as a
     * VETO in the foraging branch. One half of the file could recognise a
     * cutpurse and the half that routes could not. It is read here rather than
     * copied, so the two cannot drift.
     *
     * ── AND `take`, WHICH IS THE DANGEROUS PART ──────────────────────────
     *
     * `take` is the commonest verb in the language for this and the widest in
     * the file: "I take the road east", "I take work", "I take a job" and "I
     * take the culling contract" all have to keep what they reach, and the
     * comment on {@link POCKET_PICKING} records what happened the last time
     * something here was widened to cover an imagined case. So this does not
     * admit `take`. It admits **take, plus a possessive or a person, plus a
     * portable thing** - which is what every one of the failing sentences is,
     * and which no other verb's sentence looks like.
     */
    ['steal', new RegExp([
        /\b(?:steal|steals|stealing|stole|rob|robs|robbing|mug|mugs|mugging|pickpocket)\b/,
        /\bhelp myself to (?:his|her|their)\b/,
        /\btake (?:it )?off (?:him|her|them)\b/,
        POCKET_PICKING,
        // take/lift/cut/slip <somebody's> <portable thing>
        new RegExp(
            '\\b(?:take|takes|taking|took|lift|lifts|lifting|lifted|cut|cuts|cutting|'
            + 'slip|slips|slipping|swipe|swipes|snatch|snatches|palm|palms)\\s+'
            + `(?:${A_POSSESSIVE})\\s+(?:${A_PORTABLE_THING})\\b`
        ),
        // take/lift/cut the <portable thing> off/from <somebody>
        new RegExp(
            '\\b(?:take|takes|taking|took|lift|lifts|lifting|lifted|cut|cuts|cutting|'
            + 'slip|slips|slipping|swipe|swipes|snatch|snatches|palm|palms)\\s+'
            + `(?:the |a |an |that |this )?(?:${A_PORTABLE_THING})\\b[^.!?]{0,30}?`
            + '\\b(?:off|from|out of)\\b'
        )
    ].map(r => r.source).join('|'))],
    ['bribe', /\b(?:bribe|pay off|grease|buy (?:his|her|their) silence)\b/],
    ['interrogate', /\b(?:interrogate|question|press (?:him|her|them)|demand to know|grill)\b/],
    ['trade', /\b(?:trade|buy|sell|purchase|barter|haggle|market|shop|price)\b/],
    ['negotiate', /\b(?:negotiate|bargain|make terms|come to terms|strike a deal|petition|ally|alliance|swear|join|apply to|seek protection|beg)\b/],
    ['recruit', /\b(?:recruit|hire|take on|enlist|bring (?:him|her|them) in)\b/],
    ['apologise', /\b(?:apologi[sz]e|make amends|beg (?:his|her|their) pardon)\b/],
    // Bowing is how somebody opens with an elder in this setting, and it was
    // the one courtesy with no line at all.
    ['talk', /\b(?:talk|speak|ask|greet|converse|say|tell|introduce myself|bows? to|bowing to|nods? to|pay my respects to|salutes?)\b/]
];

// `warn` is in the threaten intent and was not here, so "I warn him to stay
// away from her" fell through to `extractTarget`, which reads whatever follows
// `to` - and named a person "stay away from her".
const INTERACT_SUBJECT_VERBS = /interact with|warn|bow to|nod to|seduce|court|woo|charm|flirt with|flatter|deceive|mislead|bluff|pose as|trick|lie to|threaten|intimidate|bribe|interrogate|question|trade|buy|sell|barter|haggle|negotiate|bargain|petition|ally with|join|apply to|swear to|beg|recruit|hire|apologi[sz]e to|talk|speak|ask|greet|tell|steal from|steal|rob|mug|pickpocket/;

/**
 * Turn free text into one action, with no model involved.
 *
 * Order is significance-first, not frequency-first: "break through" contains
 * "through", "train" appears in both technique practice and cultivation,
 * "gather qi" is cultivating while "gather herbs" is foraging, and the specific
 * reading must win in each case. Anything unrecognised resolves to `unclear`,
 * which passes no time and changes nothing - an intent the engine did not
 * understand must never cost the player a year of their life. It used to
 * say `look` here, and it used to be true; a fallthrough that quietly
 * became `cultivate` is what this comment was describing when it was
 * wrong.
 */

export function parseIntent(rawInput: string): PlannedAction {
    const input = inTheCharactersThePatternsUse(rawInput);
    const plan = readTheSentence(input);
    if (plan.action !== FALLBACK_ACTION) return plan;

    // ── AND ONLY NOW, THE SPELLING ───────────────────────────────────────
    //
    // A second attempt, on a sentence whose misspelt words have been put
    // back. It runs HERE - after a full pass has reached nothing - and
    // nowhere else, which is the whole of what makes it safe: a sentence
    // that already found a verb keeps that verb, so no repair can move a
    // parse that works, and `misparse.test.ts` and the verb-swallowing guard
    // cannot be shifted by anything in the spelling module.
    //
    // The cost of not doing it, measured over the worked phrasings with one
    // typo each: 107 of 224 reached nothing at all. Half the sentences a
    // player fat-fingers cost them a turn, in a build whose whole claim is
    // that it is playable with no model at all.
    const respelt = respellForTheVerbTable(input, spellingVocabulary());
    if (respelt.text === input) return plan;

    const second = readTheSentence(respelt.text);
    // Still nothing is still nothing: the ORIGINAL refusal is returned, not
    // the respelt one, so the sentence the player is answered about is the
    // sentence they typed.
    if (second.action === FALLBACK_ACTION) return plan;

    // The respelling chose the VERB, and that is all it is allowed to choose.
    // Every string carrying on to the engine goes back into the player's own
    // spelling first, because the repair cannot tell a verb word from a name
    // and is only ever looking for verb words: `stele` is one edit from
    // `stole`, which IS in the vocabulary, and a target of "stole" sends the
    // engine looking for an object that does not exist. That is a wrong
    // guess, where avoiding one is the entire point of this path.
    if (second.target !== undefined) {
        second.target = inThePlayersOwnSpelling(second.target, respelt.restored);
    }
    if (second.topic !== undefined) {
        second.topic = inThePlayersOwnSpelling(second.topic, respelt.restored);
    }
    return second;
}

/** One full pass of the table, mood included. Run twice: as typed, then respelt. */
function readTheSentence(input: string): PlannedAction {
    const plan = planIntent(input);
    // The mood is decided last, on the whole sentence, rather than by a hundred
    // vetoes scattered through the table below. Doing it as a post-pass is what
    // makes it complete: a verb added tomorrow is covered without its author
    // having to know this rule exists.
    return ASKING_RATHER_THAN_DOING.test(input.toLowerCase())
        ? theReadThatAnswersIt(plan)
        : plan;
}

let vocabulary: ReadonlySet<string> | null = null;

/**
 * The parser's own words, taken off the patterns above on first use.
 *
 * Lazy rather than computed at module load, because the self-import it reads
 * is only fully populated once this module has finished evaluating.
 */
function spellingVocabulary(): ReadonlySet<string> {
    if (vocabulary === null) {
        vocabulary = harvestVocabulary(thePatternsInThisFile as unknown as Record<string, unknown>);
    }
    return vocabulary;
}

function planIntent(input: string): PlannedAction {
    const text = input.toLowerCase().trim();

    // Before everything, because every branch below that reads a number reads
    // it through a scanner that cannot see a sign.
    if (MALFORMED_QUANTITY.test(text)) {
        return { action: FALLBACK_ACTION };
    }

    // The whole sentence is a verb's own name. First, because it is the most
    // specific rule in the file - a second word anywhere and it does not fire -
    // and because two of the names it answers were being taken by branches
    // below it. Safe wherever it sits: `theVerbsOwnName` only ever returns a
    // verb that costs nothing.
    const named = theVerbsOwnName(text);
    if (named !== null) return { action: named };

    // A match, a refusal, or a child. High in the table because a sentence
    // about a match is full of other verbs' nouns - a house, a name, a purse,
    // a favour - and safe there because every branch of it needs both a verb
    // and its own noun. See `familyStep`.
    const family = familyStep(text, input);
    if (family !== null) return family;

    // ── ASKING SOMEBODY A PLAIN FACT ABOUT THEMSELVES ────────────────────
    //
    // FOUND BY PLAYING, and the parse was the first of two defects rather than
    // the second. Measured on the deterministic reader, from a fresh run
    // standing in a square with three people in it:
    //
    //   "are you a girl?"          reached NOTHING - the fallback shrug
    //   "how old are you?"         reached NOTHING
    //   "what is your name?"       reached the PLAYER'S OWN status screen,
    //                              because "your" read as the player's
    //   "who do you serve?"        reached the teacher listing
    //   "what house are you from?" reached the sect listing
    //
    // Five of the most ordinary sentences anybody says to a person in front of
    // them, and not one of them reached the person. Above the ordinary ask
    // because every branch below is looking for a noun these sentences are full
    // of - a house, a name, an order - and safe there because each phrasing
    // needs the second person AND its own noun, which no other verb's sentence
    // carries. The closed set and the reasoning are in
    // `engine/social/what-somebody-knows-about-themselves.ts`.
    //
    // No `target`, deliberately: these are said to whoever you are looking at,
    // and `interact` already answers a topic with no name by putting it to
    // whoever is at hand. Naming the person is still allowed and still works -
    // it comes through the ordinary ask with the same canonical topic.
    const ownFact = whatIsBeingAskedAboutThem(text);
    if (ownFact !== null) {
        return {
            action: 'interact',
            // The MOOD is still read off the sentence. "What is your name" is a
            // question and "I demand to know your name" is an attempt, and
            // flattening the second into the first would quietly remove the
            // price of having leaned on somebody - which is the softening the
            // agency rule forbids, reachable by choosing your words. The demand
            // path reads the same self-fact, so limit one does not bite there
            // either; what it adds is the resolver, the day and the marks.
            intent: matchIntent(text, INTERACT_INTENT_PATTERNS) ?? 'talk',
            topic: A_TOPIC_ABOUT_THEMSELVES[ownFact]
        };
    }

    // ── MAKING SOMEBODY DO SOMETHING, WITH HANDS ─────────────────────────
    //
    // ABOVE `attack`, and the order is the whole point. Coercion sentences
    // contain a person and an act of violence and would otherwise be read as a
    // plain fight - measured before this landed: "I coerce the merchant into
    // handing it over" reached NOTHING, from the table and from the meaning
    // tier both, and "I force him to submit" reached `request`, which is asking
    // somebody politely. That is worse than a refusal: the player spends a turn
    // asking nicely for a thing they meant to take.
    //
    // Safe above `attack` because every pattern needs a person AND something
    // they are being made to do. "I attack him" reaches none of them.
    {
        const wanted = COERCION_INTENT_PATTERNS.find(([, pattern]) => pattern.test(text));
        if (wanted && !AIMED_AT_THE_LADDER.test(text)) {
            const who = (extractSubject(input, COERCE_SUBJECT_VERBS) ?? '')
                .replace(WHAT_THE_COMPLIANCE_WAS_FOR_TAIL, '')
                .replace(HOW_THE_FIGHT_OPENED_TAIL, '')
                .trim();
            return {
                action: 'coerce',
                ...(who.length >= 2 ? { target: who } : {}),
                intent: wanted[0],
                // Coercion opened from cover is the same distinction a fight
                // opened from cover is, and it is read the same way.
                ...(OPENED_FROM_COVER.test(text) ? { opening: 'from_concealment' as const } : {})
            };
        }
    }

    // -- attacking somebody, which had no route at all --
    //
    // The engine has had combat the whole time: `resolveExchange`,
    // `resolveConfrontation`, `battlesSurvived` on the row. The parser had no
    // way to reach any of it, so "I attack the nearest cultivator" fell
    // through the whole table until the cultivation branch caught the noun.
    // First, because every sentence about a fight is full of other verbs' nouns.
    if (!AIMED_AT_THE_LADDER.test(text)
        && !GOING_FOR_CARE.test(text)
        && (usedAsVerb(text, 'attack|attacks|strike|strikes|hit|hits|fight|fights|kill|kills|'
            + 'cut down|draw on|swing at|go for|set (?:on|upon)|jump|ambush|assault|'
            // The words a player uses when the killing is the point rather than
            // the fight. Found by a standing sweep: "I murder a disciple of the
            // Nine Abyss Flame Sect" and "I assassinate the Third Lord" reached
            // NOTHING, while "I attack the Nine Abyss Flame Sect" was refused
            // properly at every position. A verb that answers the polite
            // phrasing and not the honest one teaches a player that the game is
            // small, when what is actually true is that the target is enormous.
            + 'murder|murders|murdering|assassinate|assassinates|assassinating|slay|slays|'
            + 'do away with|make an end of|'
            + 'take (?:him|her|them) on|put (?:him|her|them) down|finish (?:him|her|them)|'
            // ── THE INTENTS THAT HAD NO TRIGGER ──────────────────────────
            //
            // Found by the intent walk in `coverage.test.ts`, which is what
            // that walk exists for. `subdue` and `humiliate` were both readable
            // as intents ten lines below and reachable by NOBODY: the only way
            // into either was to say a different verb and hope the intent regex
            // caught the adverb. So `attack/humiliate` - the outcome the genre
            // is fondest of - was a label the engine could produce and a player
            // could not ask for.
            //
            // "start a fight" and "pick a fight" are here for the plainer
            // reason: they are how people say it, and the exemplar file has
            // said so since it was written while the table had no line for them.
            + 'subdue|subdues|pin|pins|restrain|restrains|humiliate|humiliates|'
            // Two more the same probe found reaching `unclear`. `go at` is one
            // letter from `go for`, which was already here; putting a blade
            // through somebody is the exemplar corpus's own phrasing for this
            // verb and there is nothing else either can mean.
            + 'go at|goes at|going at|put a sword through|put a blade through|'
            + 'puts a sword through|puts a blade through|run (?:him|her|them) through|'
            // The pronoun sits INSIDE the phrase in the way people actually say
            // these. `cut down` and `draw on` were both already here and both
            // missed their commonest form, because "cut him down" and "draw my
            // sword on him" put a word in the middle.
            + 'cut (?:him|her|them) down|cuts (?:him|her|them) down|'
            + 'draw (?:my|his|her|the) (?:sword|blade|sabre|saber|weapon|knife) on|'
            + 'draws (?:my|his|her|the) (?:sword|blade|sabre|saber|weapon|knife) on|'
            + 'start a fight|starts a fight|pick a fight|picks a fight|make an example of')
            || /\bstrike (?:at )?(?:him|her|them|the [a-z])/.test(text)
            // Said the way a person says it, where the body part is what makes
            // it violence rather than the verb. See `VIOLENCE_TO_A_BODY`.
            || VIOLENCE_TO_A_BODY.test(input)
            || VIOLENCE_WITH_NO_OTHER_READING.test(text)
            || CRIPPLING_SOMEBODY.test(input))) {
        return {
            action: 'attack',
            // The manner clause is cut off the name. "I attack him from behind"
            // resolved to a person called "him from behind" and then to nobody,
            // so the commonest ambush phrasing in the genre reached neither the
            // fight nor a person - the manner is read off the whole sentence by
            // `OPENED_FROM_COVER` and does not belong in the target.
            target: THE_PART_IS_NOT_THE_PERSON.reduce(
                (name, cut) => name.replace(cut, ''),
                (extractSubject(input, ATTACK_SUBJECT_VERBS) ?? '')
                    .replace(HOW_THE_FIGHT_OPENED_TAIL, '')
            ).trim() || undefined,
            ...(OPENED_FROM_COVER.test(text) ? { opening: 'from_concealment' as const } : {}),
            // ── SAYING HOW IS SAYING HOW FAR ─────────────────────────────
            //
            // A throat cut and a neck broken are not attempts to drive somebody
            // off, and `cut down` never matched its own commonest form because
            // "cut him down" puts a word in the middle. Measured before this:
            // every phrasing in `VIOLENCE_TO_A_BODY` came out `drive_off`,
            // so the engine was handed a brawl where the player had described
            // a killing - and `drive_off` is the one intent that stops early.
            intent: /\b(?:kill|murder|assassinate|slay|finish|cut down|put (?:him|her|them) down)\b/.test(text)
                || /\b(?:cut|cuts|slit|slits|slash|slashes|open|opens)\s+(?:[A-Za-z]+(?:'s)?\s+){1,3}throat\b/i.test(input)
                || /\b(?:break|breaks|snap|snaps|crush|crushes)\s+(?:[A-Za-z]+(?:'s)?\s+){1,3}(?:neck|spine|skull)\b/i.test(input)
                || /\b(?:cut|cuts|slit|slits)\s+(?:his|her|their|my|the)\s+throat\b/i.test(input)
                || /\b(?:disembowel|disembowels|strangle|strangles|throttle|throttles|smother|smothers|drown|drowns)\b/.test(text)
                || /\bcut (?:him|her|them) down\b/.test(text)
                ? 'kill'
                : /\b(?:subdue|pin|restrain|capture|take alive)\b/.test(text)
                    ? 'subdue'
                    : /\b(?:humiliate|shame|embarrass|make an example)\b/.test(text)
                        ? 'humiliate'
                        : 'drive_off'
        };
    }

    // ── A FIGHT SOMEBODY WOULD CHOOSE TO HAVE ────────────────────────────
    //
    // Every route into combat was either suicide or refused. Attacking resolves
    // only to whoever is NEAREST, who is usually far above; the categorical-gap
    // rule then correctly declines - "3 major realms is not a fight" - so a
    // player never got to fight anybody. Meanwhile a duel between equals is one
    // of the commonest things two cultivators do in this setting, it is how a
    // disciple measures themselves, and it is the only safe way to meet a
    // system that otherwise only appears when something much stronger has
    // decided to kill you.
    //
    // `subdue` rather than a new goal: an agreed bout ends when one party
    // yields, which is exactly what `subdue` already means to the resolver, and
    // it needs no change to the combat tool's closed set.
    //
    // The PEER phrase is carried through as the target so the handler can pick
    // somebody the gap rule will actually permit, rather than the nearest body.
    //
    // ── AND `terms`, WHICH THE WORD WAS BEING THROWN AWAY WITHOUT ────────
    //
    // "I spar with him" and "I pin him" both came out of here as `subdue` and
    // nothing downstream could tell them apart ever again, so a bout that
    // killed somebody was indistinguishable from a fight that did - which is
    // the exact softening AGENTS.md forbids, arrived at by omission rather than
    // by decision. `terms` is a CLOSED value set here, beside the verb, for the
    // same reason `leverage` is: `game.ts` passes it through and never
    // translates a word into a mechanic, and no line of engine code reads it to
    // pick an OUTCOME. It reaches the consequence layer alone, where the whole
    // of the difference between a spar and a duel lives.
    if (/\b(?:duel|spar|sparring|challenge)\b/.test(text)
        && /\b(?:with|against|to a duel|him|her|them|someone|somebody|anyone|anybody|a |the )\b/.test(text)) {
        // "I challenge him TO A DUEL" puts the challenge word after the person,
        // so the extracted subject came out as "him to a duel" and resolved to
        // nobody. The trailing form of the ask is not part of who was asked.
        const challenged = (extractSubject(
            input,
            /duel|spar with|spar against|sparring with|challenge/
        ) ?? '').replace(/\s+to\s+(?:a|an)\s+(?:duel|spar|bout|match|contest).*$/i, '').trim();
        return {
            action: 'attack',
            ...(challenged.length >= 2 ? { target: challenged } : {}),
            intent: 'subdue',
            terms: 'agreed'
        };
    }

    // Sect promotion and stipend, before anything that could read them as
    // asking a person a question or as going out to collect something.
    {
        const unambiguous = SECT_INTENT_UNAMBIGUOUS.find(([, pattern]) => pattern.test(text));
        if (unambiguous) return { action: 'sect', intent: unambiguous[0] };
    }

    // Sending the rung below, before `work` and `gather` - both of which used to
    // catch these sentences and answer them by spending the PLAYER's days. An
    // order is the one action in the game whose whole point is that it does not.
    if (usedAsVerb(text, SECT_ORDER_VERBS)
        && SECT_SUBORDINATE_NOUNS.test(text)
        && !SENDING_A_MESSAGE.test(text)) {
        const errand = matchIntent(text, SECT_ERRAND_PATTERNS) ?? DEFAULT_ERRAND;
        const days = parseDuration(text);
        return {
            action: 'sect',
            intent: 'order',
            topic: errand,
            ...(days ? { days } : {})
        };
    }

    // The four powers above `order`, in the same slot and for the same reason.
    // Ahead of `work` and `gather` because a sentence about the house's intake
    // is full of their vocabulary ("I take on new disciples to work the
    // fields"); ahead of `train_technique` because a sentence about what the
    // house teaches is not a sentence about practising it; and ahead of the
    // INTERACT table, whose `recruit` label matches the bare words "take on",
    // and of the sect LISTING, which fires on the noun plus any question word.
    {
        const led = leadershipIntent(text, input);
        if (led) return led;
    }

    // Inheritance grounds, ahead of everything that owns one of their verbs.
    //
    // This block has to sit here rather than lower down because four separate
    // branches below would take these sentences first and answer them with
    // something adjacent, which is worse than answering nothing. "I look for
    // the audit bench" was matched by the bare `look` rule and answered with
    // the weather; "I study the door" went to `investigate` and examined a
    // door as an object with no record behind it; "I go to the eighth stone"
    // went to `move` and sent the cultivator to a place called "the eighth
    // stone", which the engine stored, because a location is free text; and
    // "I size up the trial" went to `assess`, which prices an opponent.
    //
    // It sits BELOW the attack and sect blocks on purpose. A fight and an
    // errand are still a fight and an errand when they happen at a grave.
    {
        const step = siteStep(text, input);
        if (step) return step;
    }

    // ── what somebody leaves for whoever comes after ──
    //
    // Below the sect block and below the inheritance grounds, and both of
    // those orderings are load-bearing. "I leave the sect" is resigning and
    // "I dig up the grave of Shen Guyi" is grave-robbing, and each of them
    // contains a verb this block also matches on. Above `institutionalAct`,
    // because lodging goods with a house is not a petition, a posture, a seal
    // or an offering, and that block matches any sentence naming a faction.
    {
        const aside = legacyStep(text, usedAsVerb, parseDuration(text) ?? undefined);
        if (aside) return aside;
    }

    // ── institutions acting on each other, and on the dead ──
    //
    // High, and it has to be. Five of the twelve sentences that produced this
    // block did not fail: they were EATEN, four of them by the asking branch
    // and the INTERACT table two hundred lines below, and one by `recall`.
    // "I ask the Deep Survey for one of its pills" reached a bystander who
    // declined to answer; "I offer an alliance to the Frostmirror Court"
    // walked the player to the Court and described the building. Both look
    // like answers, and a player cannot tell an answer from a gap.
    //
    // It sits BELOW attack, the sect powers and the inheritance grounds on
    // purpose, for the reason the site block gives: a fight is still a fight
    // and an errand is still an errand when the sentence also mentions a
    // house. It sits ABOVE the asking branch because asking an INSTITUTION for
    // something it holds is not the same act as asking a person a question,
    // and the two have different answers from different tables.
    {
        const between = institutionalAct(text, input);
        if (between) return between;
    }

    // ── ASKING A PERSON FOR SOMETHING ────────────────────────────────────
    //
    // Above the three stuck-player reads, and that placement IS the fix. The
    // roster question owns `teach me`, correctly - "who can teach me" is one of
    // the three questions this game has to answer - and it was tested before
    // anything looked at whether a person had been named. So "I ask Jiang Anyi
    // to teach me", typed at somebody standing in the same square, was answered
    // with the register of everybody standing above the player. Four phrasings
    // of the request, four different lookups, and not one of them a person.
    //
    // NOTHING BELOW IS WIDENED, which is the whole point. `AGENTS.md` records
    // what happened the last time a pattern here was widened to catch a missing
    // sentence: it stole sentences from `investigate` and from ordinary place
    // resolution, and two tests caught it. `requestPutToSomebody` takes only
    // sentences that name somebody AND say what is wanted of them, and returns
    // null for everything else - so "who can teach me", "teach me", "I ask her
    // about the ruins" and "I bribe the gate steward" all reach exactly what
    // they reached before.
    //
    // Below the institutional block and the attack block for the reason those
    // give: a sentence that files a petition or starts a fight is still doing
    // that when somebody could also read it as asking for something.
    // ── WHAT SOMEBODY IS AFTER ───────────────────────────────────────────
    //
    // Above the request block, because "ask her what she wants" is a question
    // about her and not a request put to her, and below everything the request
    // block is below for the reasons that block gives.
    //
    // Free, and it reaches nothing else: every one of the three patterns
    // requires the word that names the wanting, so no sentence that used to go
    // somewhere goes here instead. Checked against "what does she know", "who
    // can teach me" and "what is she carrying", all unchanged.
    {
        const about = askingWhatSomebodyIsAfter(input);
        if (about) {
            return { action: 'request', intent: 'wants', target: about };
        }
    }

    {
        // ── PUTTING IT UP FOR SALE IS NOT ASKING ANYBODY FOR IT ──────────
        //
        // `offer` is a request verb and "for sale" turns the sentence round:
        // "I offer the pill for sale" is `sell`'s own exemplar and it was read
        // as a request put to a person called "the pill" for a thing called
        // "sale". Nobody is being asked for anything, and selling is the only
        // way a pouch becomes a purse - so the sentence that reaches it must
        // not be eaten three hundred lines above by the verb it looks like.
        const asked = /\bfor sale\b/.test(text) ? null : requestPutToSomebody(input);
        if (asked) {
            const leverage = LEVERAGE_BEHIND_INTENT[
                matchIntent(text, INTERACT_INTENT_PATTERNS) ?? ''
            ];
            return {
                action: 'request',
                target: asked.person,
                intent: asked.kind,
                ...(asked.object ? { topic: asked.object } : {}),
                ...(leverage ? { leverage } : {})
            };
        }
    }

    // ── the three questions a stuck player asks ──
    //
    // High in the table, and every one of them is free, which is what makes
    // that safe. They sit ABOVE `assess`, `status`, `look`, `move` and
    // `breakthrough` because those five are precisely what was eating these
    // sentences: "am I stuck" was answered by a senior's opinion of the
    // player, "who could guide my cultivation" by the character sheet, "I look
    // for a master" by the room, and "I want to travel somewhere else" by the
    // travel verb going looking for a place called "somewhere else". Each of
    // those is a good answer to a question nobody asked.
    //
    // They sit BELOW the institutional block and the attack block, on the same
    // reasoning those give: a sentence that files a petition or starts a fight
    // is still doing that when it also contains the word "teacher".
    if (CEILING_QUESTION.test(text)) {
        return { action: 'ceiling' };
    }

    // Ahead of the teacher question, which owns "teach me" and would otherwise
    // answer "what can this place teach me" with a list of people. A place is
    // not a person, and the two reads are the two halves of where anything is
    // comprehended from.
    if (ROADS_QUESTION.test(text)) {
        return { action: 'roads' };
    }

    if (TEACHER_QUESTION.test(text)) {
        return { action: 'teacher' };
    }

    if (DESTINATIONS_QUESTION.test(text)) {
        return { action: 'destinations' };
    }

    // ── what am I carrying in my head ──
    //
    // Ahead of the sect listing, which fires on the noun plus any question
    // word and would take "what do I know about the sect" and answer it with a
    // register of who would enrol the player. Ahead of `status`, whose sheet
    // read is a different question. Ahead of the place-history block, which
    // owns "what is said about this" - somebody else's talk about the ground,
    // rather than what this cultivator is holding.
    //
    // Behind nothing that costs anything, because it costs nothing.
    // The read only. A sentence that is trying to PUT the dao somewhere is not
    // a question about it, and answering it with the panel is the "looks like
    // an answer" failure this whole block exists to stop. See
    // {@link PUTTING_IT_SOMEWHERE_ELSE}.
    if (RECALL_DAO.test(text) && !PUTTING_IT_SOMEWHERE_ELSE.test(text)) {
        return { action: 'recall', intent: 'dao' };
    }
    // News and rumour, which is the world's talk rather than the holder's own
    // head. Ahead of the `recall` patterns below and behind `RECALL_DAO`,
    // because "what have I heard lately" is in both bags and the one that
    // teaches something is the one worth reaching.
    if ((NEWS_AND_RUMOUR.test(text) || ASKING_AFTER_THE_WORLD.test(text))
        && !ABOUT_THE_GROUND_HERE.test(text)) {
        return { action: 'news' };
    }
    // ── whose art that was ──
    //
    // Ahead of `recall`, and it has to be: "do I know this style" sits one word
    // from `do i know (of|about)`, and "have I seen this before" is a hair from
    // "have i heard of". Both of those recall patterns would answer with the
    // knowledge table, which is a true statement about what the holder is
    // carrying and not an answer to what they just watched.
    //
    // Narrow enough not to steal from it: every branch requires an art noun or
    // a possessive over one, so "what do I know of the Azure Cloud" is
    // untouched and still reaches `recall`.
    if (WHOSE_ART_IS_THAT.test(text)
        || IS_THIS_THEIR_ART.test(text)
        || (DO_I_RECOGNISE_IT.test(text) && new RegExp(AN_ART_NOUN, 'i').test(text))) {
        const owner = houseClaimedIn(input);
        const art = artNamedIn(input);
        return {
            action: 'recognise',
            ...(owner && owner.length >= 3 ? { target: owner } : {}),
            ...(art ? { topic: art } : {})
        };
    }

    if (RECALL_PATTERNS.some(pattern => pattern.test(text))) {
        const named = namedAfter(input, RECALL_SUBJECT);
        return { action: 'recall', intent: 'knowledge', ...(named ? { target: named } : {}) };
    }
    if (RECALL_EVERYTHING.test(text)) {
        return { action: 'recall', intent: 'knowledge' };
    }

    // ── getting a wound seen to ──
    //
    // Ahead of everything that owns one of these verbs, and it has to be:
    // "look for a physician" was taken by the bare `look` rule, "find a
    // healer" sits one word from the employment branch, and "see to my
    // injuries" is a hair from `investigate`. Ahead of the ASKING branch too,
    // which is the one deliberate cost: "I ask around for a physician" is
    // still a question put to people, and it stays one, because none of the
    // asking verbs are in `SEEKING_CARE_VERBS`.
    if (HAVING_IT_SEEN_TO.test(text)
        || (usedAsVerb(text, TREATMENT_VERBS)
            && (INJURY_NOUNS.test(text) || /\b(?:me|myself)\b/.test(text)))
        || (HEALER_NOUNS.test(text) && usedAsVerb(text, SEEKING_CARE_VERBS))
        || (TREATMENT_NOUNS.test(text)
            && usedAsVerb(text, `${SEEKING_CARE_VERBS}|${TREATMENT_VERBS}`))) {
        return { action: 'treat' };
    }

    // ── striking the barrier, and not everything with the word in it ──
    //
    // The bare word used to be enough, anywhere in the sentence, and this
    // branch sits above `refine`, `buy` and `gather` - so EVERY sentence about
    // the thing you take BEFORE a breakthrough was answered by attempting one
    // without it:
    //
    //   I refine a breakthrough pill  -> "The barrier does not move. Not enough
    //   I buy a breakthrough pill        has accumulated: 0 of 100 qi-units."
    //   I look for a pill that helps breakthrough
    //
    // That is the worst shape a misparse can have here. `MAX_PILL_BONUS` is
    // 0.35, the single largest modifier in the game and the intended mitigation
    // for the rungs that kill, and the three sentences that reach it were all
    // answered by walking into the barrier bare-handed. Two deaths at the 12->13
    // Foundation boundary, both funded and healthy, were spent finding out.
    //
    // `usedAsVerb` is the fix and it is exactly what it was written for: in
    // "a breakthrough pill" the word sits behind an article, where only a noun
    // can be, and in "I break through" it follows a subject. The phrasings that
    // are unambiguous whatever position they are in are listed separately,
    // because "attempt a breakthrough" is a noun and is still the attempt.
    if (usedAsVerb(text, 'break\\s*through|breakthrough|breaks through|breaking through')
        || /\b(?:strike (?:at )?the barrier|push (?:past|through|against) the (?:barrier|bottleneck)|force (?:the |my way through the )?(?:barrier|bottleneck)|assault the barrier|attempt the (?:next )?rank|advance a rank|(?:try|attempt|make|go for) (?:a |the |my |another )?break\s*through|(?:try|attempt|push|go) (?:to |for )?(?:the )?(?:next realm|next rank|next layer|advancement))\b/.test(text)) {
        return { action: 'breakthrough' };
    }

    // Closed-door seclusion before ordinary cultivation: it is the more
    // specific reading of the same sentence, and it is a different bargain -
    // sealed against encounters, and against opportunities with them.
    // `seclude` itself was not on this list, so "I seclude myself for a year"
    // fell to `cultivate` - a different bargain at a twelfth of the default
    // span, taken silently. The verb answering to every phrasing except its
    // own name is the near-synonym rule at its sharpest.
    // `retreat from the world` is here because the bare word belongs to
    // `move`'s `flee` intent and always will - "I retreat" in a fight is a
    // withdrawal - so the phrasing that means seclusion has to name the world
    // it is retreating from. "I retreat from the world entirely for a stretch"
    // is the corpus's own phrasing and it was answered by a journey.
    if (/\b(?:closed[- ]?door|seclude|secludes|secluding|seal (?:myself|the (?:cave|door))|sealed seclusion|enter seclusion|go into seclusion|shut myself)\b/.test(text)
        || /\b(?:retreat|retreats|retreating|withdraw|withdraws|withdrawing|cut myself off) (?:from|out of) (?:the world|everything|everyone|society|all of it)\b/.test(text)) {
        return { action: 'seclude', days: parseDuration(text) ?? DEFAULT_SECLUSION_DAYS };
    }

    // ── the house's own board, ahead of the mortal one ──
    //
    // `sect_members.contribution` had no earner, and this is the sentence that
    // earns it. It must beat `work` (which answers with the village job board,
    // paid in cash, moving no standing) and `look` (which answers with the
    // weather). Requires a board noun or an institution beside a work noun, so
    // "I take whatever work the village will give me" is untouched.
    // A title the board printed, taken by name. See `dutyNamed`: a commission
    // is called "What a Poor District Has Instead of Monsters" and contains no
    // board noun, so typing back exactly what the game had just said reached
    // nothing and the whole contribution loop had no accepting sentence.
    const namedDuty = usedAsVerb(text, DUTY_TAKING_VERBS) ? dutyNamed(text) : undefined;
    if (namedDuty) {
        return { action: 'sect', intent: 'duty', target: namedDuty };
    }

    // ── HOW MUCH CONTRIBUTION DO I HAVE ──────────────────────────────────
    //
    // `contribution` is a board noun in SECT_DUTY_PATTERN, on the sound
    // reasoning that exactly one thing in this game pays in it. That made a
    // question about the BALANCE return the list of jobs - not a refusal, a
    // confident wrong answer, which is the harder kind to notice because the
    // player reads it and moves on. Contribution gates promotion and the
    // promotion refusal quotes it correctly, so the number exists and was
    // reachable from everywhere except the sentence that asks for it.
    if (/\b(?:contribution|contributions)\b/.test(text)
        && /\b(?:how much|how many|what(?:'s| is)?|do i have|have i|my|balance|standing)\b/.test(text)
        && !usedAsVerb(text, DUTY_TAKING_VERBS)) {
        return { action: 'sect', intent: 'standing' };
    }

    // ── WHAT IS NAILED TO THE WALL ───────────────────────────────────────
    //
    // Ahead of the duty board because the two are adjacent and the duty board
    // is a MEMBER'S surface: somebody with no house asking what is posted in a
    // market town wants the recruiting bills, and answering them with a list of
    // sect chores they cannot take is the confident wrong answer rather than a
    // refusal. `SECT_DUTY_PATTERN` still owns every phrasing that names a
    // board, a duty, a commission or contribution, so the sentences it was
    // written for are untouched - this only catches the ones it never had.
    // ── AND TAKING WHAT IS NAILED THERE, WHICH IS AN ACT AND NOT A READ ──
    //
    // Ahead of the wall read, and ahead of the sect-noun block far below, which
    // was answering "I take the intake at the house that posted the notice"
    // with the house's TREASURY. The whole argument is on
    // {@link TAKING_A_POSTED_INTAKE}; the split here is the one the reserves
    // already draw, between asking what is there and going to it.
    if (TAKING_A_POSTED_INTAKE.test(text)) {
        const house = whoseIntakeItIs(input);
        return { action: 'sect', ...(house ? { target: house } : {}) };
    }
    if (RECRUITING_BILL_PATTERN.test(text)) {
        return { action: 'look', intent: 'bills' };
    }

    if (SECT_DUTY_PATTERN.test(text)
        || (usedAsVerb(text, DUTY_TAKING_VERBS) && DUTY_NOUNS.test(text))) {
        // A SUBJECT ONLY WHEN SOMETHING IS BEING TAKEN. Reading the wall and
        // signing for a line off it are the same sentence with one verb
        // changed, and the difference is an oath row with a due date on it. So
        // the target is attached only where a taking verb is actually in verb
        // position, and "I look at the sect mission board" carries none - which
        // routes it to the read, which is the cheap branch. Same rule `site`,
        // `petition`, `posture`, `seal` and `offer` all follow.
        const taking = usedAsVerb(text, DUTY_TAKING_VERBS);
        return {
            action: 'sect',
            intent: 'duty',
            ...(taking ? { target: extractSubject(input, DUTY_SUBJECT_VERBS) } : {})
        };
    }

    // ── how does this book go further ──
    //
    // ONE COMMAND, THREE COSTS. Ahead of the learning branch, because "how do I
    // get further with this manual" is not a request to learn a new one, and
    // ahead of the mortal-economy work rule, which takes "work out".
    if (ACQUISITION_PATTERN.test(text)) {
        return {
            action: 'acquisition',
            target: extractSubject(input, ACQUISITION_SUBJECT_VERBS)
        };
    }

    // ── the mortal economy, before anything that spends time ──
    //
    // Deliberately ahead of `eat`, `trade` and `cultivate`. A player with no
    // stones who types "take work for a season" is asking for the only action
    // that saves them, and every slower reading of that sentence is fatal.
    if ((/\b(?:take (?:any |whatever |some )?work|(?:look|looking|hunt|hunting|cast about|casting about|ask|asking) (?:around )?for (?:any |some |paid )?(?:work|a job|jobs|employment|hire)|find (?:me |myself |a |some )?(?:work|job|employment)|hire (?:myself|on|out)|take a job|get a job|odd jobs?|day labour|day labor|earn (?:some |a few |my )?(?:stones?|keep|coin|money|living|wages?)|work (?:for|in|at|the|a|as)|labour|labor|make myself useful|work off)\b/.test(text)
        // `work on` is practice, not employment. Without this guard
        // "I work on my technique" was answered with a season of hauling.
        || /^\s*(?:i\s+)?works?\b(?!\s+on\b)/.test(text)
        // ── SAYING IT WITHOUT THE WORD `work` IN IT ─────────────────────
        //
        // "is there anything here I can do for pay" names no job, no wage and
        // no employment - it names the PAY - and it reached the stagnation
        // read three hundred lines below, so a player with no stones asking
        // the one question that feeds them got a senior's opinion of their
        // progress. The anchor is the payment, which nothing else in this
        // table asks after.
        || /\b(?:i (?:can|could) do|anything|something|any(?:thing)? going)\b[^.?!]*\bfor (?:pay|wages|money|coin|stones|a wage)\b/.test(text)
        // ── A TAKING OF WORK IS A TAKING, HOWEVER IT IS QUALIFIED ────────
        //
        // `take (?:any |whatever |some )?work` admitted three adjectives and
        // nothing else, so the sentences somebody types when they are out of
        // stones reached nothing at all: "I take the best paying work", "I take
        // whatever pays best", "I take the charcoal work". The intent prompt
        // names this as the life-or-death case in its own words - if the player
        // is broke or hungry, `work` is almost always what they meant, and it
        // is the one action that can kill them for asking - and the table did
        // not honour it.
        //
        // Bounded rather than free: the taking verb and the word `work` in the
        // same clause. A question about work is untouched, because none of
        // these is a question and `ASKING_RATHER_THAN_DOING` runs over the
        // whole sentence afterwards regardless.
        || /\btakes?\b[^.?!]{0,30}?\bwork\b/.test(text)
        || /\b(?:whatever|anything|something)\b[^.?!]{0,20}\bpays?\b/.test(text)
        || /\bbest[- ]paying\b|\bpays? (?:the )?(?:best|most|fastest|quickest)\b/.test(text))
        // ── AND `work at` IS THE SAME WORD DOING THE SAME THING ──────────
        //
        // The guard above was written for `work on` and the alternation two
        // lines up admits `work at` and `work the`, so the identical sentence
        // with a different preposition still bought a season of hauling. Both
        // of the corpus's own phrasings went that way: "I settle in and work at
        // it for a year", which is `cultivate`, and "I work at the method until
        // it is better", which is `train_technique` - and both spend the
        // player's year on somebody else's fields instead.
        //
        // Narrow on WHAT is being worked at, not on the preposition, because
        // "I work at the mill" is a job and has to stay one. The objects are
        // the practice nouns the two verbs below already own, plus the bare
        // pronoun, which cannot be an employer.
        && !WORKING_AT_A_PRACTICE.test(text)) {
        return {
            action: 'work',
            days: parseDuration(text) ?? DEFAULT_WORK_DAYS,
            // `... as a porter` first, which is the shape the extractor reads.
            // Where the sentence names the trade some other way - "the charcoal
            // work" - the catalog answers instead. Undefined is not a failure
            // here: `GameService.work` reads an unnamed trade as "take any
            // work" and picks the best-paying line on the board that is
            // actually being put to them.
            target: extractSubject(input, /work as|hire (?:myself )?(?:out )?as|take work as|job as/)
                ?? theKindOfWorkNamed(text)
        };
    }

    // -- asking somebody, which is not the same as consulting a register --
    //
    // Requires a person: `someone`, `the old woman`, `around`, `the locals`.
    // Without one the sentence is a query about the world rather than a
    // question put to anybody, and the surfaces below answer it.
    //
    // And "I ask for time on the vein" is not a question put to anybody: it is
    // the house's own allocation, which has its own read below. `parseAsk`
    // takes "for time on the vein" as a person, fails to find one, and puts the
    // words to whoever is nearest - the same failure "tell me about myself"
    // already has a veto for.
    // `press` is an asking verb - "I press him for an answer" - and it is also
    // half of the commonest way anybody says a gift. "I press it into her hand"
    // came back as an approach to somebody called "it into her hand", which is
    // the shape of every bug this parser has produced: a phrase matched in the
    // wrong role and answered confidently. Vetoed rather than ordered around,
    // because the asking branch is high on purpose and the sentence that needs
    // the veto satisfies its rule completely. See {@link whatIsBeingHandedOver},
    // which needs a thing AND a recipient and so cannot fire on a question.
    const asked = /\b(?:ask|asking|asks|enquire|inquire|put it to|question|press)\b/.test(text)
        && !GROUND_TIME_QUESTION.test(text)
        && !PUTTING_IT_INTO_THEIR_HANDS.test(text)
        // "I ask who holds this ground" is a question about the ground, and
        // `parseAsk` was finding a person inside it. See
        // {@link WHO_ANSWERS_FOR_THIS_GROUND}.
        && !WHO_ANSWERS_FOR_THIS_GROUND.test(text)
        ? parseAsk(input)
        : null;
    if (asked && !/\bjoin(?:ing)?\b/.test(text)) {
        return {
            action: 'interact',
            intent: matchIntent(text, INTERACT_INTENT_PATTERNS) ?? 'talk',
            ...(asked.person ? { target: asked.person } : {}),
            ...(asked.topic ? { topic: asked.topic } : {})
        };
    }

    // ── what am I carrying ──
    //
    // Ahead of everything that could read "check" or "look" as a verb aimed at
    // the room. `alchemy_manage.inventory` answers it and nothing reached it.
    if (/\b(?:my (?:inventory|pouch|bag|pack|belongings|possessions)|what am i carrying|what do i (?:have|carry)|what(?:'s| is) in my (?:pouch|bag|pack)|check (?:my |the )?(?:inventory|pouch|bag|pack)|(?:show|list|open) (?:me )?(?:my |the )?(?:inventory|pouch|bag|pack)|turn out (?:my )?(?:pouch|pockets)|count (?:my|the) (?:stones?|spirit stones?|coins?|money|things|belongings)|check what i (?:am|'m) carrying|see what i (?:am|'m) carrying|what have i got on me)\b/.test(text)) {
        // "take stock" is deliberately absent. `misparse.test.ts` carries
        // "I take stock of a life that has gone nowhere in forty years",
        // which is a man looking at his own life and not at his pockets.
        return { action: 'inventory' };
    }

    // ── the arts, listed, before the art being learned ──
    //
    // The question form must win: "what can I learn" is a read of a catalog
    // and "I learn the Azure Ripple Art" is an act that can tear meridians.
    // Getting those the wrong way round costs a run.
    if (/\b(?:what|which)\b[^.!?]*\b(?:arts?|techniques?|manuals?|methods?)\b[^.!?]*\b(?:can i (?:learn|study|take up|pick up)|could i (?:learn|study)|are (?:there|available|open to me)|do i have access to|am i able to learn)\b/.test(text)
        || /\b(?:what (?:arts?|techniques?) can i learn|list (?:the )?(?:available )?(?:arts?|techniques?)|show (?:me )?(?:the )?(?:available )?(?:arts?|techniques?)|what (?:arts?|techniques?) are (?:available|going|about))\b/.test(text)
        // ── THE PHRASING THE GAME ITSELF PROMISES ────────────────────────
        //
        // Three refusals in this codebase tell the player, in these words, to
        // ask "what there is to learn" - and the sentence resolved to nothing.
        // The game was instructing players into a dead end, which is the
        // sharpest possible version of the deflection problem, because the
        // player is doing exactly what they were told.
        //
        // `list available techniques` is what actually answered, and no player
        // types that. Any phrasing the game prints is a phrasing the game must
        // accept - the same rule as a name on a board or a title on a wall.
        || /\b(?:what(?:'s| is)? there to learn|what is there to learn|what can i learn|anything to learn|is there anything to learn|what could i be taught|what am i able to learn)\b/.test(text)) {
        return { action: 'list_techniques' };
    }

    // ── swallowing a pill ──
    //
    // Ahead of `eat`, which took "I eat a healing pill" and answered it with a
    // meal, and beside `buy`, which owns the purchase and not the swallow.
    // `consume_pill` had no member in the closed set at all, so the six heal_hp
    // pills were purchasable and unusable - and `handleConsumePill` is the ONLY
    // writer of `FLAG_PENDING_PILL`, which means the breakthrough pill bonus,
    // the largest modifier in the game, had never once fired in play.
    // ── OR THE THING ITSELF, BY THE NAME THE GAME PRINTED ────────────────
    //
    // The class noun was required, and the same defect the learning branch
    // records was waiting here: most consumables in this world are not called
    // "pill". Measured after the Unearned Step became spendable and the game
    // began printing its name:
    //
    //   I take the Unearned Step      -> unclear
    //   I swallow the Unearned Step   -> unclear
    //   I take the pill               -> consume_pill
    //
    // So the only sentence that reached the effect was the one that did NOT
    // name the thing. `IMMORTAL_ITEM_NAMED` is built from the catalog and was
    // already in this file for the petition branch; reading it here costs
    // nothing and cannot go stale. The taking verb is still required, so a
    // sentence that merely mentions one is untouched.
    if (usedAsVerb(text, PILL_TAKING_VERBS)
        && (PILL_NOUNS.test(text) || IMMORTAL_ITEM_NAMED.test(text))) {
        return {
            action: 'consume_pill',
            target: extractSubject(input, PILL_SUBJECT_VERBS)
        };
    }

    // ── ASKING A HOUSE TO LET YOU SIT IN, which is not learning an art ───
    //
    // Must be tested ahead of `learn_technique` below, whose LEARNING_VERBS
    // contain "study" in verb position: without this, "I study at the Azure
    // Cloud Pavilion" resolved to learning an art called "at the Azure Cloud
    // Pavilion" and answered with the technique listing. The sentence is about
    // a place in a hall, not about a book.
    //
    // Narrow on the GUEST framing rather than on the verb, for the reason this
    // file has learned twice: a wide pattern here would take "I study the
    // Lesser Qi-Gathering Manual" and "I practise with my master", both of
    // which belong to the two verbs either side of it. `study my ...` is
    // excluded explicitly for that reason.
    if (GUEST_STUDENT_PATTERNS.some(p => p.test(text))) {
        const leaving = /\b(?:stop|stops|stopping|leave|leaves|leaving|end|ends|ending|quit|quits|give up|no longer)\b/.test(text);
        const taking = /\b(?:become|becomes|accept|accepts|take (?:the|a|them up on)|enrol|enroll|sign on|i will|yes)\b/.test(text);
        return {
            action: 'sect',
            intent: 'guest',
            ...(leaving ? { topic: 'depart' } : taking ? { topic: 'accept' } : {}),
            ...(leaving ? {} : { target: extractSubject(input, GUEST_SUBJECT_VERBS) })
        };
    }

    // ── learning one, which is not practising one ──
    //
    // `train_technique` raises mastery in something already held; this is the
    // first acquisition, and it is the only route to an art outside a site.
    // Ahead of `investigate`, whose verb list contains "study".
    //
    // THE CLASS NOUN IS NOT REQUIRED, and requiring it was a measured defect:
    // 92 of 103 catalog names fail "I learn the <name>" when the sentence also
    // has to contain "art", "manual" or "technique", because most arts are not
    // called any of those things - and the listing prints their names without
    // one. Most of the corridor above the middle of the ladder was therefore
    // unlearnable by typing its own name back at the game.
    //
    // The learning verbs carry it on their own: "learn", "study", "take up"
    // and "master" in VERB POSITION are not sentences about anything else this
    // parser owns. The subject is resolved against the technique catalog in
    // `GameService.learnTechnique`, so a sentence naming something that is not
    // an art is refused there with the listing attached rather than guessed at
    // here.
    if (usedAsVerb(text, LEARNING_VERBS)
        || (usedAsVerb(text, LEARNING_VERBS_NEEDING_A_NOUN) && TECHNIQUE_CLASS_NOUNS.test(text))) {
        return {
            action: 'learn_technique',
            target: extractSubject(input, LEARNING_SUBJECT_VERBS)
        };
    }

    // ── selling, which is the only way a pouch becomes a purse ──
    //
    // Ahead of `market` and far ahead of the INTERACT table. A player who
    // types "I sell the Qi Grass" is naming a thing they are carrying, and
    // every reading below this one looks for a person of that name. Ahead of
    // `market` too, because "I sell my herbs at the market" is a sale and not
    // a request to read the board - the board question is vetoed back out.
    if ((usedAsVerb(text, SELLING_VERBS)
        // `offer` and `put` are not selling verbs on their own - one is a
        // request and the other is half the sentences in this file - and with
        // "for sale" after them there is nothing else they can be.
        || /\b(?:offer|offers|offering|put|puts|putting)\b[^.?!]*\bfor sale\b/.test(text))
        && !SELLING_ASKED_AS_A_BOARD.test(text)) {
        return {
            action: 'sell',
            target: extractSubject(input, SELLING_SUBJECT_VERBS)
        };
    }

    // The noun `market` is a place people stand in and steal from and talk
    // about. Asking to SEE the board is a different sentence, and it is
    // either a question about what things cost or a verb aimed at a stall.
    // ── ASKING FOR A CATEGORY BY NAME ────────────────────────────────────
    //
    // "what pills are for sale" and "what medicine is for sale" both resolved
    // into NOTHING, which matters more than it sounds: untreated meridian
    // injuries are the leading cause of death in this game, the cure is on the
    // board, and the two sentences a dying player types to find it were the two
    // that did not work. `what is for sale` did work and then showed the eight
    // cheapest lines, all of them mortal goods, so the pills were invisible on
    // that route too.
    //
    // The category noun is left in the target on purpose: `GameService.market`
    // matches it against MARKET_CATEGORIES and filters the board, which is the
    // machinery that already existed and had no sentence pointing at it.
    if (/\b(?:what|which|any)\b[^.?!]*\b(?:pills?|medicines?|elixirs?|remed(?:y|ies)|healing|cures?)\b[^.?!]*\b(?:for sale|on offer|are sold|is sold|do they sell|can i buy|are there|available|here)\b/.test(text)
        || /\b(?:pill|medicine|apothecary|physician|healer)\b[^.?!]*\b(?:stall|shop|counter|board|prices?)\b/.test(text)) {
        return { action: 'market', target: 'medicine' };
    }

    // Two measured misses. `show` was not among the market verbs although
    // `see`, `check` and `visit` were, so "show me the market" fell through to
    // `interact` and walked the player over to talk to somebody. And nothing
    // read the counter itself: `stalls` was already a market NOUN, so "what is
    // on the stalls" satisfied half the rule and reached nothing.
    // `the prices` is PLURAL here, and the singular was a measured misroute.
    // "I would like to take that off him for the price" is somebody buying one
    // thing and it read as a request to see the board, because "for the price"
    // contains "the price". A board question asks after prices; a purchase
    // names one.
    if (/\b(?:what(?:'s| is) (?:for sale|on offer)|what can i buy|going rate|how much (?:is|are|does)|price of|cost of|the prices\b|what(?:'s| is) on (?:the )?(?:stalls?|counter|board))\b/.test(text)
        // What the place itself deals in, which is the board question asked
        // about the town rather than about a thing. "what does this town have
        // to trade" walked the player over to talk to somebody.
        || /\b(?:what|which) (?:does|do|has|have) (?:this|the|that) (?:town|place|village|city|settlement|market)\b[^.?!]*\b(?:have|sell|sells|trade|deal|offer|stock)\b/.test(text)
        || (usedAsVerb(text, 'browse|shop|buy|sell|barter|haggle|price|visit|check|see|show|find|go to|look at|look over|head to|walk to')
            && /\b(?:market|marketplace|bazaar|stalls?|prices?|shops?|traders?)\b/.test(text))
        // ── WHO, rather than WHAT ────────────────────────────────────────
        //
        // Measured by playing a fresh nobody in a market town. "what is for
        // sale" answered with a forty-three line board; "who is selling
        // anything" reached `unclear` and got the three prompts about
        // teachers. The board is the answer to both - the people standing
        // here are ON it now - and the sentence that asks after them was the
        // one that did not work, which is this file's own near-synonym rule.
        //
        // Narrow on the market sense of the words. `sell`, `trade` and
        // `buying` in verb position belong to the two rules above this one and
        // must keep doing so, which is why every alternative here is anchored
        // on an interrogative and a person-word rather than on a bare verb.
        || /\b(?:who(?:'s| is| are)?\s*(?:here\s+)?(?:is\s+)?(?:selling|trading|buying|dealing|got anything|has anything)|(?:is |are )?(?:there )?(?:any(?:body|one)|somebody|someone|people) (?:here )?(?:selling|trading|with (?:anything|something) to sell)|(?:who|what) (?:here )?(?:has|have) (?:anything|something) (?:for sale|to sell|to trade)|what (?:are|is) (?:they|people|anybody|the others) selling)\b/.test(text)) {
        return { action: 'market', target: extractSubject(input, /market for|price of|cost of|buy|sell/) };
    }

    // Stocking up comes before eating, because "buy food" is ambiguous and
    // the expensive reading of getting it wrong is one-directional: a
    // player who meant one meal and got a month of rations has lost some
    // stones, and a player who meant a month and got one meal starves.
    // "ten years of provisions" did not parse, because the count alternation
    // stopped at "three" and every larger number word fell through to `buy`
    // and died at `resolvePrice`. The whole word-number table is spliced in
    // instead of a hand-written list, so it cannot go stale against
    // `parseCount`, which already knows all of them.
    if (new RegExp(
        '\\b(?:stock up|lay in|load up|provision myself|buy provisions|'
        // A COUNT BEFORE THE NOUN. "buy rations" reached provisioning and
        // "buy 20 rations" did not - the clause had no numeric alternative, so
        // it fell through to the eat rule, which matches any `rations?` and
        // bought a single meal. A player who names a number and gets one meal
        // has had their number silently discarded, and if they were not hungry
        // they got a refusal that reads as though provisioning were impossible.
        + `buy (?:some |a |my |${WORD_NUMBER_ALTERNATION}|[0-9]+ )?(?:rations?|supplies|provisions)|`
        + `(?:buy|get|pick up|purchase) (?:a |one |${WORD_NUMBER_ALTERNATION}|[0-9]+ )?`
        + '(?:months?|weeks?|days?|years?|seasons?) (?:of |worth of )?'
        + '(?:food|rations?|provisions|supplies)|'
        + `(?:a |one |${WORD_NUMBER_ALTERNATION}|[0-9]+ )?(?:months?|weeks?|days?|years?|seasons?) `
        + '(?:of |worth of )(?:food|rations?|provisions|supplies)|'
        + 'provisions? for|rations? for|food for the (?:road|trip|journey|way))\\b'
    ).test(text)) {
        // A SPAN and a COUNT are different asks. "two years of rations" names
        // how long to be fed for; "twenty rations" names how many to carry, and
        // how long twenty lasts depends on the body carrying them - hunger
        // tapers by realm, so the same twenty are a season to a novice and years
        // to a Foundation cultivator. Only the span goes through
        // `parseDuration`; the count is passed as itself.
        const span = parseDuration(text);
        const namesASpan = /\b(?:months?|weeks?|days?|years?|seasons?)\b/.test(text);
        if (namesASpan) {
            return { action: 'provision', days: span ?? undefined };
        }
        const count = parseCount(text);
        return { action: 'provision', ...(count !== null ? { rations: count } : {}) };
    }

    if (/\b(?:eat|meal|dine|breakfast|supper|feed myself|buy food)\b/.test(text)
        || /\b(?:food|rations?)\b/.test(text)) {
        return { action: 'eat' };
    }

    // ── A WORD GIVEN, CARRIED, OR NOT KEPT ───────────────────────────────
    //
    // Ahead of the sect block, which owns the noun `house` and answered "I
    // swear an oath to the house" with a list of what would take you, and
    // ahead of `move`, whose `flee` intent owns "run from". Every branch needs
    // the oath NOUN, so a sentence that merely mentions a house cannot reach
    // it and "I swear at him" is not a contract.
    if (AN_OATH.test(text)) {
        const step = (OATH_INTENT_PATTERNS.find(([, p]) => p.test(text))?.[0]
            ?? DEFAULT_OATH_INTENT) as OathIntent;
        const sworn = matterAsked(input);
        return {
            action: 'oath',
            intent: step,
            // Who it is given to, or who holds it. Absent for a read, which is
            // about everything the swearer carries rather than about one party.
            ...(step === 'read'
                ? {}
                : { target: extractSubject(input, OATH_SUBJECT_VERBS) }),
            ...(sworn ? { topic: sworn } : {})
        };
    }

    // ── A COUNTER, A BOARD, AND SOMEBODY ELSE'S SPAN ─────────────────────
    //
    // Ahead of `buy`, which took "I buy passage at the Span counter" and
    // looked for a line on the price board called "passage at the Span
    // counter"; ahead of `interact`, which answered "what does the Span board
    // say" by walking the player over to talk to somebody; and ahead of
    // `move`, because every sentence about going somewhere by span contains a
    // destination.
    if (A_COUNTER_NOT_A_MISSION_BOARD.test(text)) {
        const step = (matchIntent(text, PASSAGE_INTENT_PATTERNS)
            ?? DEFAULT_PASSAGE_INTENT) as PassageIntent;
        const where = extractDestination(input);
        return {
            action: 'passage',
            intent: step,
            ...(where ? { target: where } : {})
        };
    }

    // ── buying a line off the board ──
    //
    // Deliberately BELOW `market`, `provision` and `eat`, all three of which
    // own a purchase of their own and all three of which work. What reaches
    // here is everything else the board advertises, which until now reached
    // the INTERACT table and was answered with "nobody by that name" - the
    // engine looking for a person called "visit from the mortal physician".
    //
    // No noun requirement, because the board is twenty-two lines of ordinary
    // English and any list written here would go stale against it. The subject
    // is resolved against `PRICES` in `game.ts` instead, and a purchase the
    // board never advertised is refused with the board attached, for free.
    // And not when what is being paid for is the thing that carries you.
    // `hire` is a buying verb and also the verb in {@link RIDING}, so "I hire a
    // mount for the road" - the exemplar corpus's own phrasing for `ride` - was
    // read as a line off the price board called "mount for the road" and
    // refused. The ride branch is two hundred lines below this one and cannot
    // be reached past it, so the veto is here, and it is exactly the pattern
    // that branch already keys on rather than a second list of conveyances.
    if ((usedAsVerb(text, BUYING_VERBS)
        // ── A PURCHASE SAID POLITELY ─────────────────────────────────────
        //
        // "I would like to take that off him for the price" is this verb's own
        // exemplar and it contains no buying word at all - it reached the
        // INTERACT table on the word "price" and was answered by describing the
        // man. Both halves are required, and it is the second that makes it a
        // purchase: taking a thing off somebody FOR THE PRICE is buying, and
        // taking it off them full stop is the `steal` intent, which owns the
        // bare phrasing and keeps it.
        || /\btake (?:it|that|this|them|those|one) off (?:him|her|them)\b[^.?!]{0,40}\bfor (?:the price|the asking|what (?:he|she|they) (?:wants?|asks?)|his price|her price|their price)\b/.test(text))
        && !BUYING_A_PERSON_OFF.test(text) && !RIDING.test(text)) {
        return {
            action: 'buy',
            target: extractSubject(input, /buy|purchase|pay for|order|book|hire|acquire|take passage on|pay the/)
        };
    }

    // ── what can I make ──
    //
    // The read that closes the alchemy loop, and it had no phrasing at all:
    // "what recipes do I know" and "what can I refine" both parsed to
    // `unclear`, so a player could not find out which formulas were within
    // their realm and therefore could not know which herbs to gather. Ahead of
    // the refining rule because it is the same verb asked as a question, and
    // the question must not be answered by working the cauldron.
    if (/\b(?:what|which)\b[^.!?]*\b(?:recipes?|formulae?|formulas?|pills?)\b[^.!?]*\b(?:do i (?:know|have)|can i (?:make|refine|brew|craft|attempt)|are (?:there|available)|could i make)\b/.test(text)
        // `craft` is here because a player types it and it reached nothing:
        // `refine`, `make` and `brew` all worked and "what can I craft" fell to
        // `unclear`, which is the near-synonym defect this file already has
        // three worked examples of.
        || /\b(?:what can i (?:make|refine|brew|craft|concoct)|what (?:recipes?|formulas?) do i know|list (?:my )?(?:recipes?|formulas?)|show (?:me )?(?:my )?(?:recipes?|formulas?))\b/.test(text)
        // Looking for a pill that does something is a question about the
        // catalog, not a verb aimed at the room. It used to reach the bare
        // `look` rule and come back with the weather.
        || (/\b(?:look|looking|search|searching|hunt|hunting|cast about) for\b/.test(text)
            && /\b(?:pills?|elixirs?|medicines?|formulae?|formulas?|recipes?)\b/.test(text))) {
        return { action: 'refine' };
    }

    // `make` earns its place here only because the second clause still demands
    // an alchemical noun. "I make a pill" is what a player types and it reached
    // nothing at all, while "I refine a pill" worked - not a distinction
    // anybody could be expected to guess.
    if (/\b(?:refine|concoct|brew|distil|distill|alchemy|cauldron|make|craft|cook)\b/.test(text)
        && /\b(?:pill|elixir|medicine|formula|recipe|cauldron|alchemy)\b/.test(text)) {
        return { action: 'refine', target: extractSubject(input, /refine|concoct|brew|distil|distill|make/) };
    }

    // ── GOING OUT AFTER SOMETHING ────────────────────────────────────────
    //
    // Placed after the work and alchemy rules and before gathering, which is
    // the only position that works. "I hunt for work" is employment and is
    // caught above; "I hunt for herbs" is foraging and is caught below on the
    // noun. What is left for this rule is the case where the object is an
    // animal, or where there is no object at all - and a bare "I go hunting"
    // has to land somewhere, because it is the plainest way anybody says it.
    //
    // The near-synonyms are here on purpose. "I hunt", "I go hunting", "I cull
    // beasts", "I look for a spirit beast", "I track something", "I take the
    // culling contract" are all the same intent, and a verb that only answers
    // to one phrasing is reachable only by guessing - which is how the whole
    // alchemy subsystem was once locked behind the word "refine".
    if ((/\b(?:hunt|hunting|cull|culling|track|tracking|stalk|stalking|traps?|trapping|snares?|snaring|poach\w*)\b/.test(text)
            || (/\b(?:look|looking|search|searching|go|going) (?:for|out after|after)\b/.test(text)
                && /\b(?:spirit beasts?|beasts?|game|quarry)\b/.test(text)))
        // An animal, or nothing named. A sentence naming work, a herb, a pill
        // or a person is somebody else's verb and it keeps it.
        && !/\b(?:work|a job|jobs|employment|hire|wages?)\b/.test(text)
        && !/\b(?:herbs?|roots?|plants?|ingredients?|reagents?|flowers?|mushrooms?|grasses|moss)\b/.test(text)
        && !/\b(?:pills?|elixirs?|medicines?|formulae?|formulas?|recipes?)\b/.test(text)
        && !/\b(?:manual|book|scripture|technique|art|teacher|master|sect|house)\b/.test(text)) {
        return {
            action: 'hunt',
            target: extractSubject(input, /hunt|hunting|cull|culling|track|tracking|stalk|stalking|traps?|trapping|snares?|snaring|look for|search for|go for|go out after|go after/)
        };
    }

    if ((/\b(?:gather|forage|harvest|pick|collect|dig up)\b/.test(text)
            || (/\b(?:look|looking|hunt|hunting|search|searching|out) for\b/.test(text)
                && /\b(?:herbs?|roots?|plants?|ingredients?|reagents?|flowers?|mushrooms?|grasses|moss)\b/.test(text)))
        && !/\bgather (?:qi|energy|my qi)\b/.test(text)
        // A pocket is not a plant. `pick` carried this branch, so "I pick Xiao
        // Suiya's pocket" - a theft aimed at a named person - came back
        // "Cloudcap Mushroom, pouched" and "7 days bent over the ground around
        // Kettle". The player attempted a crime against somebody and the engine
        // charged them a week of foraging for it, which is the worst answer
        // available: not a refusal, not the act, and irreversible.
        //
        // There is no theft-from-a-person action in the closed set, so this
        // falls through to `unclear`, which costs no time, no food and no roll.
        // Deliberately narrow - only the pocket-picking idiom, because `pick`
        // is the right verb for a herb and must keep working for one.
        && !POCKET_PICKING.test(text)) {
        return { action: 'gather', target: extractSubject(input, /gather|forage|harvest|pick|collect|dig up/) };
    }

    // ── A TRADE THE BOARD PRINTS IS A TRADE A PLAYER CAN NAME ────────────
    //
    // The named-trade half of `work` has been complete the whole time. It
    // matches what the player typed against `findWorkForOrdinal(ordinal,
    // settlementKind)` - the board as it actually is here - and it carries a
    // comment about eighteen consecutive attempts that starved a run. It would
    // have matched "water" against "Water carrier" on the day it was written.
    // No sentence ever reached it.
    //
    // Found by playing a character at 1 HP of 40 with 2 spirit stones, whom the
    // game had just advised, in its own prose: "Carrying water is the most
    // certain, yielding nearly a full month's worth of vitality." They typed
    // the game's own recommendation back at it:
    //
    //   > I carry water for a month
    //   The thought does not resolve.
    //
    // `AGENTS.md` has a rule for exactly this and it is the plainest one in the
    // file: THE PLAYER MUST BE ABLE TO TYPE BACK WHAT THE GAME PRINTED. The
    // listing prints `Water carrier`, `Charcoal burner`, `Miner`, `Herb picker`,
    // `Porter`, `Ferryman`, `Scribe`; the parser knew none of them.
    //
    // BELOW `gather`, `hunt` and `refine`, and that ordering is the whole of
    // what makes it safe. "I pick herbs" is foraging and has to stay foraging;
    // `Herb picker` is a job on a board and is reached by naming it. The verb
    // above owns the sentence and this only ever sees what fell past it.
    //
    // The target is the printed NAME, because that is what the handler matches
    // against - so nothing here decides which job, only that a job was named.
    {
        const trade = tradeNamedIn(text);
        if (trade) {
            return {
                action: 'work',
                days: parseDuration(text) ?? DEFAULT_WORK_DAYS,
                target: trade
            };
        }
    }

    // The bare forms, and `book`. "I practise", "I train", "I drill", "I spar"
    // and "I read my book" all reached nothing, because the rule demanded a
    // noun from a list that did not include the commonest word for the object.
    // A cultivator with one art and nothing else to do says "I train", and the
    // game had no answer for it.
    // `work at the method` is its own alternative rather than two words added
    // to the list above, and the difference is measurable. "I work at the
    // method until it is better" is this verb's own exemplar and it bought a
    // season of paid labour, because the employment branch three hundred lines
    // up takes `work at` and `method` was missing from the noun list here while
    // `ceiling`, `acquisition` and `learn_technique` all use it for the same
    // thing. Adding `method` to the list above instead ALSO took "I put in real
    // practice at the method", which is `cultivate` - one exemplar traded for
    // another. So the noun is admitted only for the two words that needed it.
    // Plurals, because a player drills "the sword forms" as often as "the sword
    // form" and a word boundary after `form` does not fall before an `s`. The
    // same one-letter miss that hid the whole sect listing behind `houses`.
    if (/\b(?:practi[cs]e|drill|rehearse|work on)\b.*\b(?:arts?|techniques?|manuals?|stances?|forms?|books?|scriptures?|canons?)\b/.test(text)
        || /\bwork(?:s|ing)? at\b[^.?!]*\b(?:art|technique|method|manual|stance|form|scripture|canon)\b/.test(text)
        || /\b(?:train|practi[cs]e)\s+(?:the\s+)?[a-z-]+\s+(?:art|technique|manual|stance|method|form)\b/.test(text)
        // "I train my method" reached nothing while "I train" worked, because
        // `method` was missing from every noun list an art is named by - and
        // it is the word `ceiling` and `acquisition` both use for the same
        // thing three hundred lines up.
        || /\b(?:train|practi[cs]e|drill|rehearse|work on)\s+my\s+(?:art|technique|method|manual|form|style|kata|stance)\b/.test(text)
        || /\b(?:read|study|go (?:over|through))\b[^.?!]*\bmy (?:book|manual|art|technique|scripture|canon)\b/.test(text)
        || /^(?:i\s+)?(?:practi[cs]e|train|drill|spar)\s*[.!?]?$/.test(text)
        // SPARRING WITH SOMEBODY is a core activity of the genre and the safe
        // way to meet the combat system, and "I spar with someone" resolved to
        // nothing. It is training - a drill against a partner - rather than an
        // attack: the categorical-gap rule already handles the dangerous
        // version, and routing this to `attack` would turn a practice bout into
        // a fight somebody could die in.
        || /\b(?:spar|sparring|practi[cs]e|train|drill) (?:with|against)\b/.test(text)) {
        return {
            action: 'train_technique',
            target: extractSubject(input, /practi[cs]e|train|drill|rehearse|work on/)
        };
    }

    // ── WHAT MY STANDING BUYS ME ON MY HOUSE'S GROUND ────────────────────
    //
    // The world allocates days on a house's chambers by standing, ground is the
    // largest multiplier in the model - ordinal 29 costs 317 years on ordinary
    // ground against 79 on a sealed vein - and every NPC was already getting
    // it. The player had no sentence that reached it: "I ask for time on the
    // vein" hit the interact dead end, "where can I cultivate in the sect"
    // answered about having no manual, and "I go to the sect cultivation
    // chamber" was refused as a name that is not a place, which is true and
    // useless when the chamber is real and their rank already entitles them
    // to days in it.
    //
    // Ahead of `move`, which owns going to a NAMED place, and gated on the
    // house: a chamber, vein or cave named beside a sect word is this question,
    // and "I travel to The Cut Face" remains a journey.
    if (asksAfterGroundTime(text)) {
        return { action: 'look', intent: 'ground_time' };
    }

    // ── STEPPING ACROSS THE DISTANCE ─────────────────────────────────────
    //
    // Ahead of `move`, which owns "to <a place>" and would otherwise answer a
    // fold with a walk. Nothing above this line owns the word `space`.
    if (FOLDING_SPACE.test(text)) {
        return {
            action: 'fold',
            target: extractDestination(input) ?? extractSubject(input, FOLD_SUBJECT_VERBS)
        };
    }

    // ── AND GETTING THERE ON SOMETHING ───────────────────────────────────
    //
    // Immediately ahead of `move`, and no higher. A sentence about riding to a
    // grave is a sentence about a grave first, so `siteStep` keeps it; what
    // this takes is what `move` would otherwise have taken and charged one
    // flat day for.
    if (RIDING.test(text)) {
        const mount = WHAT_IS_BEING_RIDDEN.exec(input);
        return {
            action: 'ride',
            target: extractDestination(input) ?? extractSubject(input, MOVE_SUBJECT_VERBS),
            ...(mount ? { topic: mount[1].trim().toLowerCase() } : {})
        };
    }

    // ── HANDING SOMEBODY A THING ─────────────────────────────────────────
    //
    // Ahead of `move` and of the INTERACT table, and it took two goes to land
    // it there. Ahead of INTERACT because that is this parser's broadest catch
    // for anything involving a person, and it took "I press it into her hand"
    // as an approach to somebody called "it into her hand". Ahead of `move`
    // because of the owner's own acceptance sentence: `walk away` had to become
    // a flee phrasing for its third act, and the moment it did, `move` took the
    // WHOLE sentence and the gift in the middle of it disappeared.
    //
    // What that ordering costs is one collision, and it is paid for in
    // `whatIsBeingHandedOver` rather than here: `pass` is a handing verb and
    // also how anybody says movement, so "I pass through the gate" read as
    // handing the gate to somebody called "through". See {@link NOT_A_PERSON}.
    //
    // Below everything that owns one of these words, and every one of them
    // carries its own noun: an offering up the line (`institutionalAct`),
    // lodging goods with a house (`legacyStep`), a word given as an oath, a
    // dowry put on the table for a match. The fifth is the sect donation, which
    // sits BELOW this one - so the house nouns are vetoed here rather than
    // ordered around, and "I give 100 stones to the sect" is still a donation.
    //
    // See {@link whatIsBeingHandedOver}: it needs the thing AND either a person
    // or a plain putting-down, and {@link A_PRICE_IS_NAMED} vetoes every
    // sentence that names what is wanted back - a gift with a price on it is a
    // purchase, and "I give him ten stones for the manual" reaches `request`.
    if (!/\b(?:sect|sects|house|houses|clan|clans|school|schools|order|orders|treasury|coffers|ancestor)\b/.test(text)) {
        const handed = whatIsBeingHandedOver(input);
        if (handed) {
            return {
                action: 'give',
                ...(handed.to ? { target: handed.to } : {}),
                topic: handed.thing,
                ...(handed.stones !== undefined ? { stones: handed.stones } : {})
            };
        }
    }

    // ── move: one action, several ways of going ──
    const moveIntent = matchIntent(text, MOVE_INTENT_PATTERNS);
    if (moveIntent) {
        const destination = extractDestination(input);

        // Following and approaching take a PERSON. "I follow the cultivator"
        // used to hand `cultivator` to the mover as a destination, and the
        // engine dutifully spent the travel days, wrote the location, and then
        // described the ambient qi of a place called `cultivator`. A verb
        // whose object is a person must not produce a place, so when no
        // destination preposition was used these go to the person instead -
        // where they cost nothing and can be refused honestly.
        // ── FOLLOWING A ROAD IS TRAVEL; FOLLOWING A PERSON IS SOCIAL ─────
        //
        // The intent is right for people and wrong for roads: "I follow the
        // road east" was answered by approaching somebody called "road east".
        // Anchored on the noun rather than on the verb, because the verb is
        // genuinely the same word for both acts.
        const aRoad = /\b(?:road|roads|way|path|paths|track|trail|river|coast|wall|the signs)\b/.test(text);
        if (!destination && !aRoad && (moveIntent === 'follow' || moveIntent === 'approach')) {
            return {
                action: 'interact',
                target: extractSubject(input, MOVE_SUBJECT_VERBS),
                intent: moveIntent
            };
        }

        return {
            action: 'move',
            target: destination ?? extractSubject(input, MOVE_SUBJECT_VERBS),
            intent: moveIntent
        };
    }

    // The four member verbs, which need the noun so that "I leave" on its own
    // is still a movement and "my standing" outside a sect is still a status.
    if (/\b(?:sect|order|school|clan|house|reserves?|treasur\w+|coffers)\b/.test(text)) {
        // Robbing the place is not resigning from it, and it is now its own
        // thing rather than a refusal: `siphon` takes from the reserves over
        // months, and the word "leave" inside a sentence about taking the
        // treasury must never reach the resignation branch.
        if (SECT_THEFT_PATTERN.test(text)) {
            const pace = SIPHON_PACE_PATTERNS.find(([, pattern]) => pattern.test(text));
            // Whether anybody is TAKING, as opposed to standing in front of the
            // vault talking about it. `SECT_THEFT_PATTERN` matches on the nouns
            // too - treasury, coffers, reserves - which is what makes "what do
            // the sect reserves hold" a sentence about theft; the verb position
            // is what separates the question from the act. An act with no pace
            // named runs at the safest one rather than at none: see the note on
            // DEFAULT_SIPHON_PACE for what "at none" was doing to players.
            const taking = usedAsVerb(text, SIPHON_TAKING_VERBS);
            const chosen = pace ? pace[0] : taking ? DEFAULT_SIPHON_PACE : undefined;
            return {
                action: 'sect',
                intent: 'siphon',
                ...(chosen ? { topic: chosen } : {}),
                ...(parseDuration(text) ? { days: parseDuration(text) as number } : {})
            };
        }
        const wanted = SECT_INTENT_PATTERNS.find(([, pattern]) => pattern.test(text));
        if (wanted) {
            return { action: 'sect', intent: wanted[0] };
        }
    }

    // The oath phrasings are here rather than in a verb of their own, and that
    // is the finding rather than a shortcut. "I swear an oath to the House of
    // the Bound Word" reached the INTERACT table and was answered by walking
    // the player over and describing them - and the act it names is JOINING.
    // The catalog says so in its own admission requirement, which for that
    // house reads "forty years of intended service, sworn in front of a Warden
    // of Terms before any training begins". The pattern held `swear to` and
    // missed `swear an oath to`, two words apart, so a sentence that was
    // already implemented had no route. Membership is exclusive in the
    // repository, so a seat-holder swearing to somebody else is a defection
    // and is answered as one - by the join path, out of real state, rather
    // than by a second verb that would have to decide the same thing again.
    // ── PAYING IN, instead of serving ────────────────────────────────────
    //
    // Missions were the only earner of contribution, so a player with stones
    // and no time had no route to a promotion at all - a rich cultivator and a
    // poor one had exactly the same one, which is not what money is for in this
    // setting. Ahead of the sect-noun rules, which would otherwise take it, and
    // ahead of `buy`, which owns "I buy" and not "I give".
    //
    // The amount is read here and defaults to nothing: a donation with no sum
    // named is a question about what the house would want, not an offer.
    if (/\b(?:donate|donation|give|gift|contribute|pay|hand over|offer)\b/.test(text)
        && /\b(?:sect|house|clan|school|order|contribution|treasury|coffers)\b/.test(text)
        && !usedAsVerb(text, SIPHON_TAKING_VERBS)) {
        const amount = parseCount(text);
        return {
            action: 'sect',
            intent: 'donate',
            ...(amount !== null ? { days: amount } : {})
        };
    }


    // ── WHO LEADS IT, which is not a request to be found one ─────────────
    //
    // The find-me-a-sect rule below fires on a sect noun beside any question
    // word, and `who` is one of them - so "who leads this sect", asked by a
    // member about their own house, was answered with the register of houses
    // that might take them on: "There is one name you have for this: Azure Dew
    // Sect. Knowing a name is not an introduction."
    //
    // This has to sit AHEAD of that rule rather than below it, which is where a
    // first attempt put it, and the reviewer caught the difference because the
    // standing read one command later happily names the head and their title.
    // Same shape as the curriculum question: reading a house is not being sent
    // to find one.
    // ── who answers for this ground ──
    //
    // Ahead of the sect standing rule below, which took "who is in charge here"
    // and answered about the PLAYER's own affiliation ("Unaffiliated. No
    // stipend, no array, no elder"), because `here` is in that rule's noun
    // list. Ahead of `destinations`, which took "who holds this ground" and
    // answered with the province's realm ceiling. Both measured on a fresh run
    // standing on The Blown Ground - the one province in the world where the
    // answer is nobody, and where a run opens.
    //
    // Deliberately narrow, and the narrowness is the point. "who is in charge"
    // needs `here`, the ground named after it, or NOTHING AFTER IT AT ALL,
    // because "who is in charge of my sect" is a different question and this
    // must not swallow it - and a sentence with no object cannot be that
    // question. The ground nouns stop at `ground`, `land`, `territory` and
    // `patch` rather than reaching `place`, because "who runs this place" is
    // what somebody says about a shop, a stall or an inn.
    //
    // `protects` and `guards` are in the verb list because on closed ground the
    // reason and the authority are one fact: a house turns you away from a ruin
    // BECAUSE it protects it. They inherit the ground-noun requirement, so
    // "who protects this place" is still somebody else's sentence.
    if (WHO_ANSWERS_FOR_THIS_GROUND.test(text)) {
        return { action: 'look', intent: 'holder' };
    }

    if (/\b(?:who (?:leads|heads|runs|founded|commands)|who is (?:the )?(?:head|leader|patriarch|matriarch|master|strongest)(?: of)?|who is in charge)\b/.test(text)
        && /\b(?:sect|house|clan|school|order|here|it|this|my|our)\b/.test(text)) {
        return { action: 'sect', intent: 'standing' };
    }

    if (/\b(?:join|joining|apply to|applying to|swear to|swear (?:an oath|my oath|myself|allegiance|fealty|service) to|give (?:my|our) (?:oath|word) to|bind myself to|take (?:the|their) oath|take me on|taken on|would (?:take|have) me|accept me|admit me|adopt me|take me in|be admitted)\b/.test(text)
        // `houses` was missing while every other noun here carried its plural,
        // so the two plainest ways of asking this question - "which houses take
        // people" and "tell me about the houses near here", both of them the
        // exemplar corpus's own phrasings - fell past the listing entirely. One
        // was answered by walking the player over to talk to somebody called
        // "me about the houses near here"; the other reached nothing at all. A
        // word boundary after `house` does not fall before an `s`.
        || (/\b(?:sects?|orders?|schools?|clans?|houses?)\b/.test(text) && /\b(?:look for|find|near|nearby|around here|what|which|who|tell me about)\b/.test(text))
        // Asking who would have you, in a sentence with no house noun in it at
        // all: "who would take someone like me". See
        // {@link WHO_WOULD_TAKE_SOMEBODY_LIKE_ME}.
        || WHO_WOULD_TAKE_SOMEBODY_LIKE_ME.test(text)) {
        // ── A SENTENCE THAT NAMES NO HOUSE MUST NOT ARRIVE CARRYING ONE ──
        //
        // `extractSubject` reads whatever follows the verb, and for the
        // commonest phrasing of this question that is not a name: "I want to
        // get into a sect. Which ones would even look at someone like me?"
        // arrived as `target="get into a sect"`, which the sect surface then
        // correctly refused as a name nobody had said to this cultivator. The
        // one question the admissible listing exists to answer was answered
        // with a refusal, and the refusal was about a house that does not
        // exist. See {@link namesNoHouse}.
        const said = extractSubject(input, /joining|join|applying to|apply to|swear (?:an oath|my oath|myself|allegiance|fealty|service) to|swear to|give (?:my|our) (?:oath|word) to|bind myself to|enter|find|look for/);
        return { action: 'sect', ...(namesNoHouse(said) ? {} : { target: said }) };
    }

    // ── who else is drawing on this ground ──
    //
    // Occupancy is the strongest environmental lever in the game - 4.5x
    // measured between the emptiest and busiest ground, wider than the whole
    // thin-to-normal ambient range - and there was no sentence that reached it.
    // "how crowded is it here" resolved into nothing at all.
    //
    // Ahead of the place-history read and of `look`, both of which would take
    // these: "what is this place like" is a look, and `crowded` appears in no
    // other pattern. Narrow on the nouns rather than on the verb, because the
    // question is asked as often with "how many" as with "how crowded".
    if (/\b(?:how crowded|how busy|how many (?:people|cultivators|others)|crowded here|too many people|who else is (?:here|drawing)|how contested|is it crowded|is this place crowded|how many are (?:here|drawing))\b/.test(text)
        || (/\b(?:crowd\w*|contested|occupancy|carrying capacity)\b/.test(text)
            && /\b(?:here|this place|this ground|the ground|is it|how)\b/.test(text))) {
        return { action: 'look', intent: 'crowding' };
    }

    // ── why the ground is like this ──
    //
    // Ahead of `investigate`, which owns "find out about" and "look into", and
    // ahead of `interact`, whose `talk` label matches the speech verb in "what
    // do the locals say". Behind the ASKING branch above on purpose: putting
    // the same question to a PERSON is a different act with a different answer,
    // because who you ask decides what you get.
    if (PLACE_HISTORY_PATTERNS.some(pattern => pattern.test(text))) {
        const where = namedAfter(input, PLACE_HISTORY_SUBJECT);
        return { action: 'look', intent: 'history', ...(where ? { target: where } : {}) };
    }

    // ── a master reading a student ──
    //
    // The same verb with the SUBJECT turned round, and it had no phrasing at
    // all. "Am I ready", "have I stopped", "am I stuck here" are questions
    // about the person asking - answered off their stagnation clock and off
    // who in their house is actually standing above them - and every one of
    // them either fell to the place read (answered with the weather) or to
    // `unclear`. Ahead of the general assess rule, and it carries no target,
    // which is what routes it to the student branch in `GameService.assess`.
    if (/\b(?:am i (?:ready|stuck|stalled|finished|done|going anywhere)|have i (?:stopped|stalled|stagnated|gone as far)|how am i doing here|is there anything (?:left |more )?(?:for me )?here|has this place got anything|what do (?:they|the elders|my seniors) (?:make of|think of|see in) me|am i wasting my time)\b/.test(text)) {
        return { action: 'assess' };
    }

    // ── assess: what happens if I try, which is not the same as looking ──
    //
    // The second pattern is the plain way people ask it, and it was the widest
    // single gap in `benchmark-the-local-intent-layer.ts`: 5 of 7 assess
    // phrasings reached nothing, "can I beat him" and "what are my chances"
    // among them. Every phrasing that worked used the vocabulary the parser
    // happened to have - `survive`, `size up`, `dangerous`, `stand a chance` -
    // and every phrasing that failed was shorter and more natural. That is
    // this repository's standing rule about near-synonyms, pointed at one verb.
    //
    // `chances` was already here inside "weigh my chances", so a player who
    // knew to say "weigh" was answered and one who said "what are my chances"
    // was not. That is the whole shape of the defect.
    //
    // These sit where assess always did, far below `site` and `attack`, so
    // "could I beat what is in that tomb" still reaches `site`. That is the
    // pre-existing reading and not a gap anybody has demonstrated; the veto
    // that would change it is `WEIGHING_RATHER_THAN_GOING`, and widening that
    // takes sentences away from a verb rather than giving them to one.
    if (/\b(?:size up|weigh (?:my|the) chances|assess|how dangerous|could i (?:survive|take|handle|manage)|what (?:would|will) happen if i|am i (?:strong|ready) enough|is it safe|do i stand a chance|judge the odds)\b/.test(text)
        || /\b(?:can i (?:beat|win against)|would i (?:win|beat|survive|last)|what (?:are|is) my chances|out of my depth|a fight i can (?:take|win)|am i (?:a )?match for)\b/.test(text)) {
        return {
            action: 'assess',
            target: extractSubject(input, /assess|size up|survive|take|handle|manage|against|enough for|beat|win|match for/)
        };
    }

    // ── investigate: examining, reading, searching a place ──
    if (/\b(?:investigate|examine|inspect|study|decipher|appraise|look into|find out about|go looking for|goes looking for|went looking for|search|scour|comb|explore|delve|survey|read the|check the|poke (?:about|around)|nose (?:about|around)|rummage|sift|pick through|dig through|dig about|look (?:over|through)|go through|walk the|climb (?:into|down into)|venture into|case the|scavenge|loot|salvage)\b/.test(text)) {
        return {
            action: 'investigate',
            target: extractSubject(input, /investigate|examine|inspect|study|decipher|appraise|look into|find out about|go looking for|goes looking for|went looking for|search|scour|comb|explore|delve|survey|read|check|poke (?:about|around)|nose (?:about|around)|rummage|sift|pick through|dig through|dig about|look over|look through|go through|walk|climb into|venture into|case|scavenge|loot|salvage/)
        };
    }

    // ── the cultivator asking about themselves ──
    //
    // This has to be tested BEFORE `interact`, because the ordinary English for
    // it is shaped exactly like addressing somebody: "tell me about myself" hit
    // the interact patterns, took `myself` as a person, failed to find one, and
    // put the words to whichever stranger was standing nearest. Played live it
    // read as: "You put the words to Bai Kekuan. They look at you the way
    // people look at a sentence with a hole in it."
    //
    // The rest were not misrouted, they were simply unrecognised - "what is my
    // situation", "who am I", "am I hungry" and "how is my health" all refused,
    // while "status" and "how am I doing" worked. A player cannot be expected
    // to guess which half of that they are in, and the ones that failed are the
    // words somebody actually types when they are hurt or starving.
    //
    // Deliberately narrow on the possessive: `tell me about myself` is here and
    // bare `about myself` is not, so "I ask her about myself" stays an interact.
    // `how long will I live` is in this list, and it took an embarrassing while
    // to get there. Lifespan is the central pressure of the whole game - the
    // ladder is a race against it, stagnation is measured against it, and the
    // sheet prints the number - and the sentence that asks for it directly fell
    // to `unclear` through several passes of fixing everything around it.
    if (/\b(?:who am i|what(?:'s| is) my (?:situation|condition|state)|how(?:'s| is) my (?:health|condition)|am i (?:hungry|starving|injured|hurt|wounded|bleeding|dying|healthy|ok|okay|alright|well)|my (?:health|condition|situation)|tell me about myself|describe myself|look at myself|check (?:myself|my condition))\b/.test(text)
        || /\b(?:how long (?:will|can|do|have) i (?:live|got|got left|have left)|how (?:long|much longer) have i got|how many years (?:do i have|have i got|are left|left)|what(?:'s| is) my (?:lifespan|life ?span|age)|how old am i|when (?:will|do) i die|years left)\b/.test(text)) {
        return { action: 'status' };
    }

    // ── ASKING ABOUT A NAMED THING ───────────────────────────────────────
    //
    // "tell me about <anything>" - the plainest sentence in the language for
    // the commonest thing a player wants, and it reached a stranger being
    // spoken at. The whole argument, the measurements and the boundary on both
    // sides are on {@link whatIsBeingAskedAbout} and the block above it.
    //
    // It routes to `investigate` rather than to a verb of its own, because
    // `investigate` is already the verb that reads a named subject through
    // `resolveAnything` and is already free. Placed HERE and nowhere else: below
    // `status`, which owns "tell me about myself"; below the sect listing, which
    // owns "tell me about the houses near here"; below the place-history read,
    // which owns "what do people say about this place"; below `news`, `recall`
    // and the asking branch, all of which own a question that only looks like
    // this one. Above `interact`, which is what was eating it.
    const askedAfter = whatIsBeingAskedAbout(input);
    if (askedAfter) {
        return { action: 'investigate', target: askedAfter };
    }

    // ── interact: everything done to or with a person or a faction ──
    const interactIntent = matchIntent(text, INTERACT_INTENT_PATTERNS);
    if (interactIntent) {
        const leverage = LEVERAGE_BEHIND_INTENT[interactIntent];
        const subject = extractSubject(input, INTERACT_SUBJECT_VERBS);
        // A theft is aimed at a PERSON, and the sentence is about a thing. See
        // `whoATheftIsAimedAt`: the owner where the sentence names one, and
        // nobody where it does not, rather than the purse.
        const target = interactIntent === 'steal'
            ? whoATheftIsAimedAt(input)
                ?? (namesTheThingRatherThanThePerson(subject) ? undefined : subject)
            : subject;
        return {
            action: 'interact',
            target,
            intent: interactIntent,
            ...(leverage ? { leverage } : {})
        };
    }

    // ── REPUTATION IS NOT THE CHARACTER SHEET ────────────────────────────
    //
    // "how am I regarded" and "what is my reputation" both returned the stat
    // block - spirit root, attributes, HP, satiety - which is the DEFLECTIONS
    // failure `scripts/playtest-the-drive.mjs` documents by name: returning the
    // sheet to a question about something else looks like an answer and is not
    // one. Regard is a real modelled system and standing is a real column.
    //
    // Routed to the house's own read, which answers both cases honestly: a
    // member gets their rank, contribution and what the next rung wants, and a
    // rogue gets "Unaffiliated. No stipend, no array, no elder, and nobody to
    // notice if this run ends badly" - which is exactly what a rogue's standing
    // in this world is, and a better answer than their Might score.
    //
    // Ahead of the status rule, and the status words are removed from it.
    if (/\b(?:my reputation|what(?:'s| is) my reputation|how am i regarded|how do (?:they|people|others) (?:see|regard|treat) me|what do people think of me|my standing|what is my standing|how am i seen)\b/.test(text)) {
        return { action: 'sect', intent: 'standing' };
    }

    // RAISING IT IS NOT READING IT. `my cultivation` is the sheet when
    // somebody asks after it and the act itself when somebody says they are
    // building it up, and this branch sits above the cultivation verb - so "I
    // want to build up my cultivation", the corpus's own phrasing, was
    // answered with the character sheet and no day was spent. The veto is on
    // the raising verbs rather than on the noun, because the noun is right.
    if (/\b(?:status|sheet|stats|how am i|my (?:rank|realm|progress|cultivation)|what rank am i|what realm am i|how old am i|what do i own|check myself|where do i stand)\b/.test(text)
        && !RAISING_IT_RATHER_THAN_READING_IT.test(text)) {
        return { action: 'status' };
    }

    // `cultivat\\w*` used to be the pattern here, and it matched
    // "cultivator" - the commonest noun in the setting. Any sentence about
    // another person became a month of seclusion. The verb forms are
    // enumerated now, and they must be in verb position; the noun forms
    // (`cultivator`, `cultivators`) are deliberately absent from the list.
    if (usedAsVerb(text, 'cultivate|cultivates|cultivating|meditate|meditates|meditating|'
        + 'seclude|secludes|circulate|circulates|circulating|absorb|absorbs|absorbing|'
        + 'breathe|breathes|breathing|sit|sits|settle|settles')
        || /\b(?:in seclusion|into seclusion|gather qi|refine qi|closed[- ]?door cultivation|my cultivation practice)\b/.test(text)) {
        return { action: 'cultivate', days: parseDuration(text) ?? DEFAULT_CULTIVATION_DAYS };
    }

    // ── AND THE LANGUAGE OF RECOVERY, WHICH IS NOT THE LANGUAGE OF SITTING ─
    //
    // Found by playing a character at 1 HP of 40 with two untreated injuries
    // and 2 spirit stones. The engine's own required line told them what to do
    // - "Sitting still mends it back, and a physician mends it faster" - the
    // physician was correctly refused for price, and then six ordinary ways of
    // saying the other half reached nothing at all:
    //
    //   "I lie up somewhere quiet"   "I lie low for a while"   "I recover"
    //   "I let it heal"              "I stay off it"           "I lie up and let it heal"
    //
    // A player following the game's own instruction, one hit from dead, with no
    // sentence that reaches the thing they were just told to do. `rest` and
    // `sleep` were already here and are why the two phrasings that did work
    // worked; the rest of the family was missing.
    //
    // WHY `wait` AND NOT `seclude`. They are different acts with different
    // costs, and the second is close to the worst answer available to somebody
    // who cannot afford food: sealing yourself in is a year of cultivation with
    // rations against it. Recovering is lying still. The boundary holds in the
    // other direction by ordering rather than by exclusion - the seclusion
    // branch sits above this one and matches only its own words, so "I shut
    // myself away", "I seal the door" and "I go into seclusion" are untouched.
    //
    // AND NO SPAN IS INVENTED. "until the wound has closed" is not a duration
    // any reader can measure, so `parseDuration` declines it and the turn costs
    // the one day a bare wait costs. Manufacturing a span the sentence does not
    // contain is the defect this file has been trimming elsewhere, and it would
    // be worst here: a guessed year, spent by somebody who cannot eat.
    if (/\b(?:wait|rest|sleep|pass the time|do nothing|linger|loiter|listen|listening|eavesdrop|hang about|hang around)\b/.test(text)
        || /\b(?:lie up|lies up|lying up|lie low|lies low|lying low|recover|recovers|recovering|recuperate|recuperates|recuperating|convalesce|stay off it|stay off my feet|keep off my feet|stay in bed|take it easy)\b/.test(text)
        || /\b(?:let|leave)\s+(?:it|them|the wound|the wounds|my wounds?|my meridians?)\s+(?:heal|mend|close|knit|settle)\b/.test(text)
        || /\buntil\s+(?:the\s+)?(?:wound|wounds|injury|injuries|meridians?)\b[^.!?]{0,20}\b(?:closed?|heals?|healed|mends?|mended|knits?)\b/.test(text)
        || /\buntil\s+i\s+can\s+(?:stand|walk|move|fight|travel)\b/.test(text)) {
        // Carry the duration when one is named. "I wait ten years" returned no
        // days at all, so the handler took its one-day default and the game
        // silently did a thousandth of what was asked - "Waiting of 1 day was
        // intended", to somebody who had just typed ten years. Bare "I wait"
        // still costs a day, so a misparse is no more expensive than before.
        const waited = parseDuration(text);
        return { action: 'wait', ...(waited !== null ? { days: waited } : {}) };
    }

    // ── look ──
    //
    // This branch used to not exist: `look` was reachable only as the
    // fallthrough, so the moment the fallback became inert, "I look around"
    // stopped working. A verb that is only reachable by accident is a verb
    // waiting to be deleted by an unrelated change.
    //
    // Two questions, one action, and they must not return the same
    // paragraph. Somebody scanning a square for a face is not asking about
    // the weather, and answering both with the room made the narrower
    // question pointless to ask.
    // The second half was added because the room description invites a
    // question the parser could not answer. `describeStanding` writes "one of
    // them is out of reach in a way that does not invite comparison", and a
    // player who asks which one got "The thought does not resolve." Narration
    // that prompts a question the engine cannot take is worse than narration
    // that says nothing, so the question routes to the same read - which
    // answers it honestly, by not being able to name a stranger either.
    if (/\b(?:who(?:'s| is| are)? (?:here|around|about|nearby)|is (?:anyone|anybody|somebody) (?:here|about|around)|look for (?:someone|somebody|anyone)|who else is|anybody about|see (?:anyone|anybody|who is here))\b/.test(text)
        || /\bwho (?:is|was|are|were)\s+(?:that|this|the one\b|he\b|she\b|they\b|them\b|these people|those people)/.test(text)) {
        return { action: 'look', intent: 'company' };
    }

    {
        // ── LOOKING AT SOMEBODY IS NOT LOOKING AROUND ────────────────────
        //
        // Measured in play: "I look at <a person standing here>" answered with
        // the weather, the ambient band and who else was about, because this
        // branch produced a bare `look` and threw the object of the sentence
        // away. The player had asked about a person and got the room - the
        // deflection failure this repo keeps finding, and worse than a refusal
        // because it reads like an answer.
        //
        // `investigate` is where reading a person already lives: it is the
        // verb the glossary defines as "examine a place, a PERSON, a record,
        // an inscription, an object", it is in `READ_ONLY_ACTIONS` so it
        // cannot spend a day on a misparse, and its own no-subject branch
        // falls back to exactly the room description this branch would have
        // given. So a named object routes there and a bare look does not, and
        // nothing that resolves to nothing costs anything.
        //
        // Deliberately NOT gated on whether the object is a person. The parser
        // cannot tell a face from a stele and must not guess; what it can do
        // is stop discarding the noun, and let the layer holding the roster
        // and the catalogs decide what was meant.
        //
        // Checked ahead of the room read rather than inside it, because the
        // room read is anchored on `^i looks?` and a pointed look is not always
        // at the head of the sentence - "looking at the stele" reached nothing
        // at all for as long as the two were one branch.
        const at = LOOKED_AT.exec(input);
        const named = at ? at[1].trim() : '';
        const looked = at && !THE_SCENE_ITSELF.test(named) ? cleanPlace(named) : undefined;
        if (looked) return { action: 'investigate', target: looked };
    }

    if (/\b(?:look (?:around|about|up|out)|have a look|glance (?:around|about)|survey|take (?:it|the place) in|take in (?:my|the) surroundings|where am i|what do i see|what is (?:here|around))\b/.test(text)
        || /^\s*(?:i\s+)?looks?\b/.test(text)) {
        return { action: 'look' };
    }

    // A duration and NOTHING ELSE - "ten years" - is a request for seclusion,
    // and it is the single most common thing a player types in this genre.
    //
    // The `nothing else` is load-bearing and was learned the hard way. This
    // used to fire on any sentence containing a duration, so "I take whatever
    // work the village will give me for a season" matched on "a season" and
    // became three months of cultivation. The player was five days from
    // starving, asked for the one action that earns food money, and was given
    // the one action that kills. The run closed permanently.
    if (isBareDuration(text)) {
        const bare = parseDuration(text);
        if (bare !== null) return { action: 'cultivate', days: bare };
    }

    // Nothing matched. The fallback is inert BY RULE: an action the engine is
    // not confident about must be the cheapest one available, never the most
    // expensive. No time passes, no food is eaten, nothing dies.
    return { action: FALLBACK_ACTION };
}

