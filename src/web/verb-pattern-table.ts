/**
 * The pattern table: which verb a sentence reaches, with no model running.
 */

import { z } from 'zod';
// The leverage enum the social resolver reads. Set by the parser so that
// nothing downstream has to translate a verb into a mechanic.
import { ApproachLeverageSchema } from '../schema/cultivation.js';

// The board's own titles, so any name the game prints is a name it accepts.
import { SUMMONS_ENTRIES, COMMISSION_ENTRIES } from '../engine/encounters/duties.js';
import { legacyStep } from './leaving-things-for-the-next-life.js';
import { asksWhatYouAreCarrying } from './inventory-phrasings.js';
// The other half of the word `tell`: carrying news of a wrong TO somebody,
// rather than asking to be told about something. Imported and not re-exported,
// like every other verb family's reader, so the harvested spelling vocabulary
// is unmoved. See `telling-a-wrong.ts`.
import { whatIsBeingTold } from './telling-a-wrong.js';
// Who a player named as sitting an art with them. The match's own vocabulary,
// because the words are the match's - see that file's own section header.
import { whoIsSittingWithThem } from './match-phrasings.js';
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
// `SITE_PRIZE_NOUNS` is imported as well as re-exported above: the taking row
// vetoes on it, and a re-export is not a binding in this module's scope.
import {
    siteStep,
    siteNamed,
    SITE_PRIZE_NOUNS,
    SITE_NOUNS,
    SITE_FACE_NOUNS
} from './site-phrasings.js';

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
 */
export const DEFAULT_OATH_INTENT: OathIntent = 'read';

/**
 * Taking something off a person, which is not gathering.
 */
/**
 * Whose it is: a pronoun, or a name with an apostrophe on the end of it.
 */
// Lowercase, because the intent table is matched against the lowered sentence.
// The capitalisation that tells a NAME from a noun is used on the other side,
// in `whoATheftIsAimedAt`, which reads the input as the player typed it.
export const A_POSSESSIVE =
    "his|her|their|its|somebody's|someone's|(?:the )?[a-z]+(?:\\s+[a-z]+){0,2}(?:'s|s')";

// HANDING SOMEBODY A THING

/** The verbs that mean putting a thing into somebody else's hands. */
// `put` AND `leave` ARE NOT ON THIS LIST, AND THEY WERE
export const HANDING_IT_OVER =
    'hand over|hands over|handing over|handed over|'
    + 'give|gives|giving|gave|hand|hands|handing|handed|pass|passes|passing|passed|'
    + 'press|presses|pressing|pressed|slip|slips|slipping|slipped';

/**
 * SOMEBODY MADE TO HAND IT OVER IS NOT SOMEBODY GIVING IT.
 */
export const MADE_TO_HAND_IT_OVER =
    /\b(?:threaten|threatens|threatening|threatened|intimidate|intimidates|menace|coerce|coerces|coercing|force|forces|forcing|forced|strong-?arm|strong-?arms|extort|extorts|shake down|shakes down|beat it out of|make (?:him|her|them)|makes (?:him|her|them))\b/;

/** Putting a thing down where somebody can take it, which is still giving it. */
export const PUTTING_IT_DOWN =
    'put|puts|putting|lay|lays|laying|set|sets|setting|drop|drops|dropping|place|places|placing';

/**
 * An exchange is not a gift, and the difference is one word.
 */
export const A_PRICE_IS_NAMED = /\b(?:for|in exchange|in return|in trade|instead of)\b/;

/**
 * Putting a thing INTO somebody, which is never a question put to them.
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

    // EVERY CAPTURE STOPS AT A COMMA
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
 */
/**
 * A PREPOSITION IS NOT A PERSON.
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
 */
export const A_PORTABLE_THING =
    'purse|purses|pouch|pouches|pocket|pockets|sleeve|sleeves|coin|coins|stones?|'
    + 'spirit stones?|jade|pendant|pendants|ring|rings|token|tokens|talisman|talismans|'
    + 'blade|sword|sabre|saber|dagger|manual|manuals|book|books|scroll|scrolls|'
    + 'pill|pills|elixir|elixirs|medicine|bag|bags|purseful|belongings|things|'
    // A CRAFT IS A THING, THOUGH NOBODY PUTS ONE IN A SLEEVE. What this list
    // actually answers is thing-or-person, which is the only question its two
    // readers ask - who a theft is aimed at, and whether the subject that came out
    // of the sentence is the object rather than the owner. A carriage and a hull
    // are the largest things anybody can be robbed of and they were the two the
    // list could not see, so "Wei Lanya's spirit boat" resolved to nobody and "the
    // spirit boat" was handed to a resolver looking for a face.
    + 'carriage|carriages|cart|carts|wagon|wagons|waggon|waggons|coach|coaches|'
    + 'boat|boats|ship|ships|barge|barges|skiff|skiffs|hull|hulls';

/**
 * WHO A THEFT IS AIMED AT, WHICH IS NEVER THE THING BEING TAKEN.
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
 */
export function namesTheThingRatherThanThePerson(target: string | undefined): boolean {
    if (!target) return false;
    return new RegExp(`\\b(?:${A_PORTABLE_THING})\\b`, 'i').test(target);
}

/**
 * The thing, without the owner attached: "the spirit boat from Cao Nuolin" becomes
 * "the spirit boat".
 */
export function theThingWithoutItsOwner(said: string): string {
    return said
        .replace(/\s+\b(?:from|off|out of|belonging to|owned by)\b.*$/i, '')
        .trim();
}

export const POCKET_PICKING =
    /\b(?:pickpocket\w*|(?:pick|picks|picking|picked|lift|lifts|lifting|lifted|cut|cuts|cutting)(?!\s+up\b)\b[^.!?]{0,40}?\b(?:pocket|pockets|purse|purses|sleeve|sleeves))\b/;

// A TAKING, WHICH IS NOT YET A THEFT

/**
 * Deliberately NOT `claim`, `pick`, `strip` or `recover`. Every one of those is
 * a site verb - a grave, a prize behind a door, an inheritance - and this row
 * runs above the site step, so admitting one would take a whole surface away.
 */
export const A_TAKING_VERB =
    'take|takes|taking|took|collect|collects|collecting|collected|'
    + 'pick up|picks up|picking up|picked up|scoop up|scoops up|gather up|gathers up|'
    + 'pocket|pockets|pocketing|pocketed|'
    + 'help myself to|helping myself to|make free with|making free with|made free with|'
    + 'walk off with|walks off with|walk out with|walks out with|'
    + 'carry off|carries off|carrying off|'
    + 'relieve|relieves|relieving|relieved';

/**
 * Somebody's, said in front of a noun.
 */
const A_TAKING_SAYS_SOMEBODY_ELSES = new RegExp(
    "\\b(?:his|her|their|its|hers|theirs|somebody(?: else)?'s|someone(?: else)?'s"
    + "|[a-z]+(?:'s|s'))\\s+\\w+"
);
const A_TAKING_SAYS_WHOSE = new RegExp(
    `${A_TAKING_SAYS_SOMEBODY_ELSES.source}|\\bmy (?:own )?(?:${A_PORTABLE_THING})\\b`
);

/**
 * Borrowing is not taking, and the not-giving-back is the whole of what makes this
 * one.
 */
const NOT_GIVING_IT_BACK =
    /\bborrow\w*\b[^.!?]{0,40}?\b(?:and|but)\b[^.!?]{0,20}?\b(?:do not|don'?t|never|no intention of)\b[^.!?]{0,20}?\b(?:giv\w+|hand\w*|bring\w*|return\w*|take\w* it back)\b/;

const A_TAKING = new RegExp([
    // Idioms that mean one thing and cannot be said about anything else.
    NOT_GIVING_IT_BACK,
    /\brelieve[sd]?\s+(?:him|her|them|\w+(?:\s+\w+)?)\s+of\b/,
    /\b(?:make|makes|making|made)\s+free\s+with\b/,
    /\bhelp(?:s|ing)?\s+myself\s+to\b/,
    // A taking verb over something the sentence says is somebody's.
    new RegExp(`\\b(?:${A_TAKING_VERB})\\b[^.!?]{0,30}?${A_TAKING_SAYS_WHOSE.source}`),
    // Or over something small enough to be carried, which is the closed list
    // that already keeps `take` safe in the theft row: a road, a job, a duty and
    // a contract are all things people take and none of them is on it.
    // Four words of slack rather than one, because a thing the game printed
    // arrives with its adjectives on: "the plain iron sword" is the name a
    // player types back, and it is three words before the noun.
    new RegExp(`\\b(?:${A_TAKING_VERB})\\s+(?:\\w+\\s+){0,4}(?:${A_PORTABLE_THING})\\b`)
].map(r => r.source).join('|'));

/**
 * What the sentence says is being taken, or null if it is not a taking.
 */
/**
 * The theft row out of the interact table, read rather than restated.
 */
function theTheftRow(): RegExp {
    return INTERACT_INTENT_PATTERNS.find(([name]) => name === 'steal')![1];
}

export function whatATakingNames(text: string, input: string): string | null {
    const borrowed = NOT_GIVING_IT_BACK.test(text);
    if (!borrowed && !usedAsVerb(text, A_TAKING_VERB)) return null;
    if (!A_TAKING.test(text)) return null;
    if (usedAsVerb(text, PILL_TAKING_VERBS)
        && (PILL_NOUNS.test(text) || IMMORTAL_ITEM_NAMED.test(text))) return null;
    // The site step claims a taking two ways: anchored to a site - a name, a
    // site noun, a face - which is a prize behind a door and defers to it; and
    // on a prize noun alone, which is a guess. "I help myself to what is on the
    // rack" is that guess, and what it produced was a refusal saying there was
    // no site by that name while a stallholder stood there holding the rack.
    if (siteNamed(text) !== undefined || SITE_NOUNS.test(text) || SITE_FACE_NOUNS.test(text)) {
        return null;
    }
    if (SITE_PRIZE_NOUNS.test(text) && !/\bwhat(?:'s| is) on\b/.test(text)) return null;
    // "I take the carriage to Iron Gate" is a journey, and {@link RIDING} owns
    // the whole shape of it. Deferred to explicitly rather than by ordering,
    // because that row runs below this one - except where the sentence says
    // whose the thing is, which is the one reading a journey never has.
    if (RIDING.test(text) && !A_TAKING_SAYS_SOMEBODY_ELSES.test(text)) return null;
    // Anything with a house in it. Two rows below own those and both run below this
    // one: `leadershipIntent` takes a thing off your own shelf, and the siphon
    // takes counted stock out of a treasury over months. Vetoed on the noun rather
    // than on either row's verbs, because between them they are the whole of what a
    // taking inside an institution is - and a taking off a house you are NOT on the
    // roll of is a sentence this engine does not have, which `object-theft.ts` says
    // in its own docstring.
    if (/\b(?:sect|house|clan|school|order|treasury|reserves|coffers|vault|library|archive|storehouse|granary)\b/.test(text)) {
        return null;
    }
    // "I'll take the manual" is said across a counter. {@link OFFERING_TO_BUY}
    // owns the offer forms and says in its own comment why `take` is not in
    // `BUYING_VERBS`; it runs below this row, so the deferral is explicit.
    if (OFFERING_TO_BUY.test(text)) return null;
    // And every sentence the theft row already reads. Those say what they are -
    // `steal`, `rob`, a cut purse, `take <somebody's> <thing>` - and have
    // reached the theft path since the pressure model was wired. This row is
    // for the class that says nothing; taking a working sentence off a working
    // row would be relabelling rather than fixing.
    if (theTheftRow().test(text)) return null;

    // "relieve him of his purse" puts the person between the verb and the
    // thing, which is the whole shape of the idiom and the reason it needs its
    // own read: `extractSubject` would hand back "him of his purse".
    const relieved = /\brelieve[sd]?\s+(?:\w+\s+){1,3}?of\s+(.+)$/i.exec(input);
    const said = relieved
        ? relieved[1]
        : extractSubject(input, new RegExp(borrowed ? 'borrow\\w*' : A_TAKING_VERB)) ?? '';
    // "the manual on my way out" names one thing and then says when. The when
    // is not part of the name, and left on it the whole phrase scores below
    // `matchScore`'s threshold against every row in the world.
    const thing = theThingWithoutItsOwner(said)
        .replace(/\s+\b(?:on (?:my|the) way|as i\b|while i\b|before i\b|after i\b|when i\b)\b.*$/i, '')
        .replace(/[.!?]+\s*$/, '')
        .trim();
    return thing.length >= 2 ? thing : null;
}

/**
 * Asking what your standing entitles you to on your house's ground.
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
 */
/**
 * Reading the wall for a house that is short of people.
 */
/**
 * The wall, and the question somebody with no house actually asks at it.
 */
export const RECRUITING_BILL_PATTERN =
    /\b(?:recruit(?:ing|ment)|intake|admission)\s(?:bills?|notices?|posters?|events?|drives?|days?)\b|\b(?:read|reads|reading|look at|looks at|looking at|check|checks|checking|study|studies|studying)\b[^.!?]*\b(?:bills?|posters?|placards?|walls?)\b|\bwhat(?:'s| is| are)?\b[^.!?]*\b(?:posted|nailed|pinned)\b|\b(?:who|what|which|any|anyone|anybody|is there|are there|is anyone|is anybody)\b[^.!?]*\b(?:recruit(?:s|ing)?|taking (?:on )?(?:disciples|students|anybody|anyone|people))\b/;

export const SECT_DUTY_PATTERN =
    /\b(?:mission board|duty board|commission board|sect board|notice board|the board|sect work|sect dut(?:y|ies)|contribution)\b|\b(?:sect|house|order|clan|school)\b[^.!?]*\b(?:work|dut(?:y|ies)|commissions?|assignments?|errands?|missions?)\b|\b(?:commissions?|assignments?|missions?|tasks?|dut(?:y|ies))\b[^.!?]*\b(?:going|available|on offer|posted|open|are there)\b|\b(?:what|which)\b[^.!?]*\b(?:dut(?:y|ies)|missions?|commissions?|assignments?)\b|\b(?:volunteer for|sign up for|put my name down)\b/;

/**
 * Taking one, said without the institution.
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
 */
export const LEARNING_VERBS =
    'learn|learns|learning|take up|takes up|master|masters|acquire|acquires';

/**
 * The ambiguous half, which still needs the noun.
 */
export const LEARNING_VERBS_NEEDING_A_NOUN =
    // `pick up` is how somebody says it when they have not read the manual yet: "I
    // want to pick up a new art" is the exemplar corpus's own phrasing and it
    // reached `gather`, because `pick` carries the foraging branch. It belongs on
    // THIS side of the split rather than beside `learn` - "I pick up the roots I
    // dropped" is a herb and nothing else, and putting it with the unambiguous
    // verbs took that sentence away from foraging, which
    // `a-verb-must-not-swallow-the-verb-next-door.test.ts` caught immediately.
    'study|studies|studying|read|reads|reading|pick up|picks up|picking up';

export const TECHNIQUE_CLASS_NOUNS =
    /\b(?:arts?|techniques?|manuals?|methods?|scriptures?|canons?)\b/;

export const LEARNING_SUBJECT_VERBS = /learn|study|read|take up|pick up|master|acquire/;

/**
 * Asking how a manual goes further, by any route.
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

// THE THREE QUESTIONS A STUCK PLAYER ASKS

/**
 * Why nothing is accumulating.
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
    // SOMEWHERE QUIET TO SIT
    /\b(?:quiet|uninhabited|unoccupied|empty|deserted|secluded|isolated|remote|uncrowded|undisturbed|lonely)\b[^.?!]*\b(?:place|places|spot|spots|cave|caves|ground|valley|mountain|mountains|wilds|wilderness|corner|somewhere)\b/,
    /\b(?:place|spot|cave|ground|somewhere)\b[^.?!]*\b(?:nobody|no one|no-one|nothing)\b[^.?!]*\b(?:else|around|there|nearby)\b/,
    /\b(?:away from|out of) (?:the )?(?:crowd|crowds|people|town|towns|everyone|everybody)\b/
].map(r => r.source).join('|'));

/**
 * Asking what there is to understand where you are standing.
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
 */
export const GUEST_STUDENT_PATTERNS: readonly RegExp[] = [
    /\bguest (?:student|studentship|pupil|disciple|place|places|roll|term)\b/,
    /\b(?:as|be|being|stay as|remain) an? guest\b/,
    /\bas a guest\b/,
    // THE PREPOSITION IS LOAD-BEARING AND WAS LEFT OFF ONCE
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

// WHICH HOUSES WOULD TAKE SOMEBODY LIKE ME

/**
 * Words that can appear in a joining sentence and are not part of a house's name.
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
    // AND THE WORDS A POSTED NOTICE IS POINTED AT BY
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

// TAKING AN INTAKE THE GAME ITSELF JUST POSTED

/** The nouns a posted intake is pointed at by. No house is named any of them. */
const A_POSTED_INTAKE =
    '(?:intakes?|recruiting (?:events?|days?|drives?)|admission days?|open days?'
    + '|recruit(?:ing|ment) (?:bills?|notices?|posters?))';

/**
 * Going to one, as opposed to reading about it.
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
 */
export const WHO_WOULD_TAKE_SOMEBODY_LIKE_ME = new RegExp(
    '\\b(?:take|takes|have|admit|admits|accept|accepts|look at|looks at|touch|want|wants)\\s+'
    + '(?:a\\s+)?(?:nobody|somebody|someone|anybody|anyone|people|rogue|stranger)\\s+like\\s+(?:me|us)\\b'
    + '|\\bwould\\s+(?:anyone|anybody|any\\s+of\\s+them|they)\\s+(?:even\\s+)?'
    + '(?:take|have|admit|accept|look at)\\s+(?:me|us)\\b'
);

// WHY THE GROUND IS LIKE THIS

/**
 * Asking what was done to a place, in the ways people actually ask it.
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
 */
export const WHO_ANSWERS_FOR_THIS_GROUND = new RegExp(
    [
        String.raw`\b(?:who (?:holds|owns|answers for|protects|guards)|whose)\b[^.?]*\b(?:this |the )?(?:ground|land|territory|patch)\b`,
        // `who(?: is|'s)` and not `who (?:is|'s)`. The contraction has no space
        // in front of the apostrophe, so the second form only ever matched
        // "who 's" - which nobody types - and "who's in charge here", the way
        // most people say this, fell through the whole pattern.
        String.raw`\bwho(?: is|'s) in charge (?:around |round )?(?:here|of this (?:ground|land|territory))\b`,
        // AND THE SAME QUESTION WITH NOTHING AFTER IT. Found by the design owner,
        // by typing it: "who's in charge?" bare reached nothing, because every
        // alternative above needs an object and this sentence has none.
        String.raw`\bwho(?: is|'s) in charge\s*[?!.]*$`,
        String.raw`\bwho (?:do|would|can|could) i (?:complain|report|appeal) to\b`
    ].join('|')
);

/** Where such a question names a place rather than meaning the ground underfoot. */
export const PLACE_HISTORY_SUBJECT =
    'happened to|happened at|became of|history of|story of|stories of|said about|said of';

/**
 * ONE ROW PER SHAPE, NOT ONE ROW PER JOB.
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
 */
/**
 * A TRADE NAME IS ALSO A PERSON, AND THAT COST FIVE TESTS ON THE FIRST TRY.
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
 */
export function dutyNamed(text: string): string | undefined {
    for (const phrase of DUTY_PHRASES) {
        if (text.includes(phrase)) return phrase;
    }
    return undefined;
}

/**
 * Every commission and summons title, lowercased, longest first.
 */
const DUTY_PHRASES: readonly string[] = [...new Set(
    [...SUMMONS_ENTRIES, ...COMMISSION_ENTRIES].map(entry => entry.name.toLowerCase())
)]
    .filter(name => name.length >= 12)
    .sort((a, b) => b.length - a.length);

// WHAT AM I CARRYING IN MY HEAD

/** The two reads. `knowledge` is what they have heard; `dao` what they hold. */
export type RecallIntent = 'knowledge' | 'dao';

export const RECALL_INTENTS: readonly RecallIntent[] = ['knowledge', 'dao'] as const;

/** What an unrecognised recall intent means. Both are free; this is the wider. */
export const DEFAULT_RECALL_INTENT: RecallIntent = 'knowledge';

/**
 * Asking after a name they may or may not be carrying.
 */
export const RECALL_PATTERNS: readonly RegExp[] = [
    /\bwhat do(?:es)? i? ?know (?:of|about)\b/,
    /\bwhat do i (?:know|remember|recall) (?:of|about)\b/,
    // "on" here means dirt on somebody - "what have I got on him". `on me` and
    // `on myself` are the pouch, and both of those were answered with the
    // knowledge table for a person called "me", which is the shape of every bug
    // this parser produces: a phrase matched in the wrong role and answered
    // confidently. See `inventory-phrasings.ts`, which owns the other reading.
    /\bwhat have i (?:heard|been told|learned|learnt|got) (?:of|about|on(?!\s+(?:me|myself)\b))\b/,
    /\bwhat do i have on\b(?!\s+(?:me|myself)\b)/,
    /\bremind me (?:what i (?:know|have heard) )?(?:of|about)\b/,
    /\bwhat i know (?:of|about)\b/,
    /\bhave i (?:ever )?heard (?:of|about)\b/,
    /\bdo i know (?:of|about|who|what)\b/
];

// WHOSE ART THAT WAS

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
 */
const NOT_PART_OF_A_HOUSE_NAME = new Set([
    'is', 'are', 'was', 'were', 'be', 'whose', 'do', 'does', 'did', 'can', 'could',
    'would', 'should', 'i', 'this', 'that', 'it', 'he', 'she', 'they', 'them',
    'the', 'a', 'an', 'tell', 'me', 'if', 'whether', 'look', 'looks', 'like',
    'really', 'actually', 'even', 'some', 'any', 'one', 'of'
]);

/**
 * The house named in a possessive: "the Azure Cloud's art".
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
 */
export const RECALL_EVERYTHING = new RegExp([
    /\bwhat do i know\b\s*[.!?]?$/,
    /\bwhat do i know at all\b/,
    /\bwhat have i heard\b\s*[.!?]?$/,
    /\bwhat names do i (?:have|hold|know)\b/,
    /\bwhat have i learn(?:ed|t)\b\s*[.!?]?$/,
    /\bwhat do i (?:remember|recall)\b\s*[.!?]?$/,
    // `have learned` was here and had to go. "remind me what I have learned" is
    // `list_techniques`'s own exemplar - what a cultivator has been TAUGHT is arts,
    // not names heard - and this verb answered it with the knowledge table. It is
    // genuinely ambiguous between two free reads, so the table leaves it alone
    // rather than choosing confidently: it reaches `unclear`, and the tier below
    // reads it against the corpus, where it belongs to exactly one verb.
    /\bremind me what i (?:know|hold|have heard)\b/,
    /\bgo over what i (?:know|hold|have (?:heard|picked up|learn(?:ed|t)))\b/
].map(r => r.source).join('|'));

/**
 * News, rumour, and what is being said - which in this world IS the holding.
 */
export const NEWS_AND_RUMOUR =
    /\b(?:what news|any news|what(?:'s| is) the news|what(?:'s| is) happening (?:in the world|out there|elsewhere)|what(?:'s| is) going on (?:in the world|out there)|what are people saying|what do people say|listen for (?:rumours?|rumors?|news|talk)|any (?:rumours?|rumors?)|what (?:rumours?|rumors?)|catch up on the news|what have i heard lately)\b/;

/**
 * The same question in the words somebody would actually use.
 */
export const ASKING_AFTER_THE_WORLD =
    /\b(?:what(?:'s| is) the (?:word|talk)|any word from|what have you heard|what do they say (?:out there|elsewhere|in the world)|ask(?:ing)? around for (?:news|word|talk)|gossip|hear anything|heard anything|what (?:do|are) (?:people|they|folk|everyone|the locals)(?: around here| round here| here| in this place)? (?:talk|talking) about(?=\s*[?.!]*$))\b/;

/**
 * The same question asked of the ground underfoot, which is a different verb.
 */
export const ABOUT_THE_GROUND_HERE =
    /\b(?:about|of) (?:this|the) (?:place|ground|town|village|city|valley|mountain|ruin|road|hall|province|county)\b|\babout (?:here|it here)\b|\bhappened here\b|\bsay about here\b/;

/**
 * The other axis, and the one that matters at the ceiling.
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
 */
export const PUTTING_IT_SOMEWHERE_ELSE =
    /\b(?:carve|carves|carving|inscribe|inscribes|inscribing|engrave|engraves|engraving|cut it into|write (?:it |my dao )?(?:onto|into|on)|leave (?:it|my dao|my understanding) (?:to|for|behind)|pass (?:it|my dao|my understanding) (?:on|to|down)|hand (?:it|my dao) (?:on|to|down)|teach (?:it|my dao|my understanding|my road) to)\b/;

/** Where a recall question stops asking and starts naming. */
export const RECALL_SUBJECT =
    'know of|know about|remember of|remember about|recall of|recall about|'
    + 'heard of|heard about|been told of|been told about|learned of|learned about|'
    + 'learnt of|learnt about|have on|got on|remind me of|remind me about';

// ASKING ABOUT A NAMED THING

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
 */
export function whatIsBeingAskedAbout(raw: string): string | undefined {
    const pivot = ASKED_ABOUT_PIVOT.exec(raw);
    if (pivot) {
        return aNameOrNothing(raw.slice(pivot.index + pivot[0].length));
    }
    const who = WHO_IS_THIS.exec(raw);
    if (!who) return undefined;
    const tail = raw.slice(who.index + who[0].length).replace(/[.!?]+\s*$/, '').trim();
    // A NAME IS EITHER WRITTEN AS ONE OR IS MORE THAN ONE WORD
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
 */
const A_TAIL_THAT_IS_NOT_A_NAME = new RegExp(
    '^(?:'
    + 'in|on|at|to|for|with|from|by|of|about|after|before|over|under|behind'
    + '|still|left|next|last|out|up|down|around|about to|going|doing|coming'
    + '|watching|following|talking|standing|waiting|running|selling|buying'
    // AND THE DEICTICS, WHICH ARE THE FACES READ AND NOT A NAME
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

// GETTING A WOUND SEEN TO

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
 * The phrasing where the treatment verb is a participle at the end of the sentence
 * rather than a verb at the front of it.
 */
/**
 * Going FOR something rather than going for somebody.
 */
export const GOING_FOR_CARE =
    /\bgo(?:ing|es)? for\b[^.!?]*\b(?:care|treatment|help|medicine|a physician|a doctor|a healer|an apothecary|the infirmary)\b/;

/**
 * Working AT something that is not a job.
 */
/**
 * Somebody saying they are going to raise a number, not asking what it is.
 */
export const RAISING_IT_RATHER_THAN_READING_IT =
    /\b(?:build up|building up|build|raise|raising|improve|improving|deepen|deepening|grow|growing|advance|advancing|push|pushing|increase|increasing|work on|working on) (?:up )?(?:my|the) (?:rank|realm|progress|cultivation)\b/;

export const WORKING_AT_A_PRACTICE = new RegExp([
    /\bwork(?:s|ing)? (?:at|the|a) (?:it|this|that|them)\b/,
    /\bwork(?:s|ing)? (?:at|on|the) (?:my |the |a |this |that |her |his |their )?(?:cultivation|method|methods|art|arts|technique|techniques|manual|manuals|form|forms|stance|stances|canon|scripture|dao|road|practice|training|breathing)\b/
].map(r => r.source).join('|'));

/**
 * Somebody else is to do the looking, which makes it a request for care.
 */
export const SOMEBODY_ELSE_TO_SEE_TO_IT =
    /\b(?:someone|somebody|anyone|anybody)\b[^.!?]*\b(?:look at|looks at|looking at|see to|sees to|treat|treats|close|closes|mend|mends|patch|patches|bind|binds|bandage|bandages|attend to|fix|fixes)\b[^.!?]*\b(?:injur\w*|wound\w*|meridians?|me|myself|this|these|it)\b/;

/**
 * Having it done to you, said in the passive.
 */
export const HAVING_IT_DONE_TO_YOU =
    /\b(?:get|gets|getting|got)\s+(?:myself\s+)?(?:patched up|seen to|treated|looked at|fixed up|bandaged|mended|stitched up)\b/;

export const HAVING_IT_SEEN_TO =
    /\b(?:get|gets|getting|have|has|having|want|wants|wanting|need|needs|needing|would like|ask for|asking for)\b[^.!?]*\b(?:injur\w*|wounds?|meridians?|myself|me)\b[^.!?]*\b(?:treated|seen to|looked at|fixed|attended to|mended|patched up|bandaged|set)\b/;

// BUYING A LINE OFF THE BOARD

export const BUYING_VERBS =
    'buy|buys|buying|purchase|purchases|purchasing|pay for|pays for|order|orders|'
    + 'book|books|hire|hires|acquire|acquires|take passage|pay the';

/**
 * An OFFER to buy, which is how English speakers actually buy things.
 */
export const OFFERING_TO_BUY = new RegExp([
    // A future, which is the offer form. "I'll take it", "we will take two".
    String.raw`\b(?:i|we)(?:'ll|ll| will| shall)\s+take\b`,
    // A request across a counter.
    String.raw`\blet me have\b`,
    // Polite, and it carries a buying word that the interact table was taking
    // first on the word "like".
    String.raw`\bi(?:'d| would)\s+like\s+to\s+(?:buy|take|have|purchase)\b`,
    // "get me that book". Scoped to a determiner so it cannot reach "get me
    // out of here", which is not a purchase and not this verb.
    String.raw`\bget me (?:the|that|a|an|one|two|another)\b`
].join('|'), 'i');

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
 */
export const SELLING_ASKED_AS_A_BOARD =
    /\b(?:what(?:'s| is) (?:for sale|on offer)|what can i buy|the prices?|(?:browse|visit|see|check|go to|head to) the (?:market|bazaar|stalls?)|(?:what|who)(?:'s| is| are)? (?:they|people|anybody|anyone|the others|everybody) (?:selling|trading)|who(?:'s| is| are)? (?:here )?(?:selling|trading)|what do(?:es)? (?:they|he|she|people|anybody|anyone|everybody|the \w+) (?:sell|trade|stock|have))\b/;

export const BUYING_A_PERSON_OFF =
    /\b(?:bribe|bribes|bribing|pay off|pays off|grease|buy (?:his|her|their|the \w+'s) silence|pay (?:him|her|them) (?:off|to))\b/;

/**
 * What each verb actually puts on the table.
 */
const LEVERAGE_BEHIND_INTENT: Readonly<Partial<Record<string, z.infer<typeof ApproachLeverageSchema>>>> = {
    bribe: 'coin',
    threaten: 'force',
    // A theft is backed by the ability to take it, which is what `force` means in
    // this enum - so it says so, here, rather than falling through to
    // `WHAT_A_BARE_DEMAND_IS_BACKED_BY` and being priced as a polite request backed
    // by the asker's reputation. Measured before this: "asked steal with nothing on
    // the table but the asking", and the ground under it read as whether a stranger
    // is BELIEVED rather than as whether anybody would make a thief pay.
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
 */
/**
 * "TELL" HAS TWO MEANINGS AND THE PARSER ONLY KNEW ONE.
 */
export const TELLING_APART_RATHER_THAN_TELLING_SOMEBODY =
    // THE PREPOSITION IS REQUIRED, and it is what separates the two senses.
    // Discernment takes one - *tell ABOUT him* - and speech takes an indirect
    // object instead: `what can I tell him` is somebody asking what they are
    // permitted to say, and it went to `investigate` until this was mandatory.
    /^\s*(?:so\s+)?what\s+(?:can|could|do|would)\s+(?:i|you|we|anyone|anybody|somebody)\s+(?:(?:tell|read|gather|glean)\s+(?:about|of|from)|make\s+of)\s+(.{2,80}?)\s*[.!?]*\s*$/i;

/** And the same question with the manner in front of the subject. */
export const WHAT_A_LOOK_ALONE_TELLS =
    /\b(?:can|could)\s+(?:i|you|we)\s+tell\s+(?:anything\s+)?(?:about\s+)?(.{2,60}?)\s+(?:just\s+)?(?:by|from)\s+(?:just\s+)?look/i;

/**
 * The manner clause a reading question trails, which is not the subject.
 *
 * "just by looking at him", "from a distance", "at a glance" - all of them say
 * HOW somebody is reading, and every one of them ended up inside the target.
 */
const HOW_THEY_ARE_LOOKING =
    /\s*(?:,\s*)?(?:just\s+)?(?:by|from|on|at)\s+(?:just\s+)?(?:look\w*|watch\w*|a\s+glance|a\s+distance|sight|the\s+look\s+of\s+\w+)\b.*$/i;

/**
 * What a sentence is asking to be read off somebody, or null.
 *
 * Null rather than a guess: this only fires on the two shapes above, and every
 * other use of `tell` stays with speech where it belongs.
 */
export function whatALookIsBeingAskedTo(input: string): string | null {
    const manner = WHAT_A_LOOK_ALONE_TELLS.exec(input);
    const plain = TELLING_APART_RATHER_THAN_TELLING_SOMEBODY.exec(input);
    const raw = (manner?.[1] ?? plain?.[1] ?? '').trim();
    if (raw.length < 2) return null;
    const subject = raw.replace(HOW_THEY_ARE_LOOKING, '').trim();
    // A sentence whose whole subject WAS the manner names nobody, and a read
    // with no subject is the room read, which owns its own phrasings.
    return subject.length >= 2 ? subject : null;
}

const LOOKED_AT = /\blooks?(?:ing)?\s+(?:at|over|upon)\s+(.{2,80}?)\s*[.!?]?$/i;

/**
 * Words that name the scene rather than anything in it.
 */
const THE_SCENE_ITSELF =
    /^(?:the\s+)?(?:sky|skies|stars?|moon|sun|clouds?|weather|horizon|view|scenery|landscape|surroundings|ground|earth|it all|everything|this place|the place|my surroundings)$/i;

/**
 * Intent tables for the deterministic parser.
 */
const MOVE_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    // Bare `run` is admitted only as the WHOLE sentence, and `run for it` and `get
    // out of here` beside it. "I run" reached nothing while "I run away" worked,
    // which is this file's near-synonym rule failing on the shortest form of the
    // most urgent verb in the game. Anchored rather than added to the alternation,
    // because "I run to the mountain" is a journey and "I run a stall" is not a
    // verb this parser owns at all. `walk away` is the third act of the owner's own
    // acceptance sentence - "steal, then hand it to someone else before running
    // away" - and it reached nothing. It is leaving the scene rather than naming a
    // destination, which is what this intent is for, and `move` says honestly that
    // it does not know where to.
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

// THE THREE WAYS OF COVERING GROUND THAT ARE NOT WALKING

/**
 * Putting something under you for the journey.
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
    // to Clear River Ford on my sword" is how somebody actually says it - so the gap
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

// THE YARD

/** The verbs that put a thing on the stocks. */
export const BUILDING_SOMETHING =
    /\b(?:build|builds|building|built|make|makes|making|made|craft|crafts|crafting|crafted|construct|constructs|constructing|constructed|assemble|assembles|assembling|assembled|lay down|lays down|laying down|put together|puts together|putting together)\b/;

/**
 * Going back to one that is already standing, or walking away from it.
 */
export const BACK_TO_THE_STOCKS =
    /\b(?:finish|finishes|finishing|finished|carry on with|carrying on with|go back to|going back to|goes back to|return to|returning to|work on|working on|works on|abandon|abandons|abandoning|abandoned|scrap|scraps|scrapping|scrapped|break up|breaks up|breaking up)\b/;

/** What a yard makes, in the words somebody standing in one uses. */
export const WHAT_A_YARD_MAKES =
    /\b(?:carriages?|carts?|wagons?|waggons?|coach|coaches|boats?|ships?|barges?|skiffs?|hulls?|keels?)\b/;

/**
 * Which bill, when the sentence names one. Matched against
 * `CONVEYANCE_RECIPES` by `whichBillTheyMeant`, which owns the grade words.
 */
export const WHAT_IS_BEING_BUILT =
    /\b(?:build|builds|building|built|make|makes|making|made|craft|crafts|crafting|crafted|construct|constructs|constructing|assemble|assembles|assembling|finish|finishes|finishing|go back to|going back to|return to|work on|working on|abandon|abandons|abandoning|scrap|scraps|scrapping|break up|breaking up)\s+(?:up\s+|on\s+|with\s+|to\s+)?(?:a\s+|an\s+|the\s+|my\s+|his\s+|her\s+)?((?:spirit\s+|drawn\s+|shod\s+|named\s+|earth-?grade\s+|heaven-?grade\s+|mortal-?grade\s+)*(?:carriage|cart|wagon|waggon|coach|boat|ship|barge|skiff|hull|keel))\b/i;

/**
 * Asking what a yard makes, which is free and names no noun.
 */
export const ASKING_WHAT_A_YARD_MAKES =
    /\b(?:what|which)\b[^.!?]*\b(?:can|could|might|should)\s+i\s+(?:build|construct)\b|\bwhat (?:can|could) be built\b|\bwhat does a yard make\b/;

/**
 * Stepping across the distance rather than covering it.
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
 */
/**
 * Nouns that look like something to hit and are the bottleneck.
 */
const AIMED_AT_THE_LADDER =
    /\b(?:the )?(?:barrier|bottleneck|blockage|realm boundary|wall|ceiling|next (?:rank|realm))\b/;

/**
 * `take on` is in `ATTACK_SUBJECT_VERBS` because it means picking a fight, and it
 * also means the opposite: taking somebody on AS something. Measured, "I take him
 * on as my disciple" reached `attack` - a giving act routed to violence, which is
 * the asymmetry the genre section of `AGENTS.md` is about.
 */
const TAKEN_ON_AS_SOMETHING = /\b(?:as|into) (?:a |an |my |his |her |their |our )?(?:disciple|apprentice|student|follower|junior|servant|retainer|ward)\b/i;

const ATTACK_SUBJECT_VERBS = /attack|strike at|strike|hit|fight|exterminate|wipe out|slaughter|massacre|kill|murder|assassinate|slay|cut down|draw on|swing at|go for|go at|put a sword through|put a blade through|set upon|set on|jump|ambush|assault|take on|put down|finish|sneak up on|creep up on|waylay|lie in wait for|cut|slit|slash|stab|knife|strangle|throttle|poison|cripple|break|snap|crush|sever|hack|tear|rip/;

/**
 * Phrases where an attack word is part of an idiom about something else.
 */
const AN_ATTACK_WORD_INSIDE_AN_IDIOM =
    /\bstrike(?:s|ing)? up\b|\bstrike(?:s|ing)? (?:a deal|a bargain|camp|it rich)\b|\bhit(?:s|ting)? it off\b/;

/**
 * NOT EXPORTED, AND THAT IS LOAD-BEARING.
 */
/**
 * Violence done to a body, said the way people say it.
 */
const VIOLENCE_TO_A_BODY =
    // Something taken off, opened or broken, and it is part of a person.
    /\b(?:cut|cuts|cutting|slit|slits|slitting|slash|slashes|open|opens|break|breaks|breaking|snap|snaps|crush|crushes|hack|hacks|sever|severs|take|takes|taking|tear|tears|rip|rips)\s+(?:off\s+|out\s+|through\s+)?(?:the|his|her|their|its|my|[A-Z][a-z]+(?:'s)?(?:\s+[A-Z][a-z]+)?(?:'s)?)\s+(?:throat|neck|spine|skull|head|arm|arms|hand|hands|leg|legs|eye|eyes|ear|ears|tongue|fingers?|kneecaps?|ribs?|jaw|heart)\b/
    ;

/**
 * The part is not the person, and the resolver wants the person.
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
 */
const HOW_THE_FIGHT_OPENED_TAIL =
    /\s+(?:from (?:behind|cover|the shadows|hiding|concealment)|by surprise|unseen|unnoticed|while (?:he|she|they|it)\b.*|before (?:he|she|they|it)\b.*|without (?:being seen|warning)|and (?:strike|strikes|hit|hits|attack|attacks|kill|kills|cut|go for)\b.*)\s*$/i;

/**
 * Making somebody do something, with hands rather than with words.
 */
/**
 * Somebody being MADE to do a thing, in the general.
 */
const SOMEBODY_WAS_MADE_TO =
    /\b(?:force|forces|forcing|forced|make|makes|making|made|compel|compels|compelling|coerce|coerces|coercing)\b|\bwhether (?:he|she|they|it) (?:wants?|likes?) (?:it|to) or not\b|\bagainst (?:his|her|their|its) will\b/i;

const COERCION_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    // An animal made to submit is a tamed animal. Same act, same resolver, and
    // `BEAST_CHANGE_ORDINAL` does all the differentiating on its own - above
    // it, what is standing there is a person and this is an indenture.
    // "break the wolf in" is how somebody says it and "break in the wolf" is
    // not, so the object sits inside the verb. Found by the intent walk.
    ['tame', /\b(?:tame|tames|taming|break(?:s|ing)?(?:\s+\S+){0,3}\s+in\b|bring (?:it|him|her|them) to heel|subjugate)\b/],
    ['talk', /\b(?:beat (?:it|the truth|an answer|the location|the name) out of|wring (?:it|the truth|an answer) (?:out )?(?:of|from)|make (?:him|her|them) talk|force (?:him|her|them) to talk|torture)\b/],
    // SOMETHING GOING INTO THEM
    ['swallow', /\b(?:force|forces|forcing|make|makes|making|push|pushes|pushing|hold|holds|holding)\b[^.!?]*\b(?:swallow|swallows|swallowing|drink|drinks|drinking|eat|eats|eating|take (?:the|a|an|this|that|his|her|their|my) (?:\w+ )?(?:pill|medicine|tablet|poison|elixir|draught)|down (?:his|her|their|its) throat|past (?:his|her|their) teeth)\b|\bforce(?:s|d)? (?:the |a )?(?:pill|tablet|medicine|it) down\b/],
    ['hand_over', /\b(?:force|forces|forcing|strong-?arm|strong-?arms|strong-?arming|extort|extorts|extorting|shake down|shakes down)\b[^.!?]*\b(?:into (?:handing|giving|paying|opening)|to hand|to give|to pay|to open|out of (?:him|her|them))\b/],
    // `make` is how somebody says this and the pattern had only `force`,
    // `strong-arm`, `extort` and `shake down` - so `hand_over` was a declared
    // intent with no phrasing that reached it, and the sentence a strip would offer
    // somebody standing over a person who had just knelt landed on `unclear`. Above
    // the `submit` rows, and told apart from them by WHAT the making is for:
    // kneeling and yielding are a submission, handing things over is this.
    ['hand_over', /\b(?:make|makes|making|force|forces|forcing)\b[^.!?]*\b(?:hand(?:s|ing)? (?:it |them |everything |the lot )?over|hand over|give (?:me |up )(?:everything|what|it|all|the lot)|turn out (?:his|her|their|the) (?:pockets|purse|pouch)|empty (?:his|her|their) (?:pockets|purse|pouch))\b/],
    // A MATCH SOMEBODY DID NOT AGREE TO
    ['marry', /\b(?:force|forces|forcing|forced|make|makes|making|made|compel|compels|compelling)\b[^.!?]*\b(?:marry|marries|marrying|wed|weds|wedding|take me as (?:his|her|their) (?:dao )?partner|be my (?:dao )?partner|into (?:a |the )?(?:match|marriage|betrothal|union))\b|\b(?:marry|marries|marrying|wed|weds)\b[^.!?]*(?:\bwhether (?:he|she|they) (?:wants?|likes?) (?:it|to) or not\b|\bagainst (?:his|her|their) will\b)/],
    // BEING SAT AS SOMEBODY ELSE'S FURNACE
    ['furnace', /\b(?:as|for) (?:a|my|his|her|their) (?:furnace|cauldron)\b|\bfurnace (?:art|arts|technique|techniques|method|methods|rite)\b|\bdraw(?:s|ing)? off (?:his|her|their) cultivation\b/],
    ['submit', /\b(?:coerce|coerces|coercing|browbeat|browbeats|browbeating)\b/],
    ['submit', /\b(?:force|forces|forcing|make|makes|making)\b\s+(?:\w+\s+){0,8}?(?:to\s+)?(?:submit|kneel|yield|bow|obey|comply|surrender|serve me|swear to me)\b/],
    ['submit', /\bmake (?:him|her|them|it) (?:mine|obey|kneel|submit|yield)\b/],
    // AND "force him to ..." IS NOT A ROW ON ITS OWN
    ['hand_over', /\bforce (?:him|her|them|it) (?:to|into)\b[^.!?]*\b(?:hand|hands|handing|give|gives|giving|pay|pays|paying|open|opens|opening|surrender|surrenders|surrendering|turn out|empty|part with|cough up)\b/]
];

const COERCE_SUBJECT_VERBS =
    /coerce|coerces|coercing|browbeat|strong-?arm|extort|shake down|subjugate|tame|tames|taming|break|force|forces|forcing|make|makes|making|beat (?:it|the truth|an answer) out of|wring|use|uses|using|draw off|draws off|drawing off/;

/**
 * The tail of a coercion that says what the compliance was FOR, cut off the target
 * for the same reason the fight's manner clause is: "I force the merchant to hand
 * over the ledger" names a merchant, not a merchant-to-hand- over-the-ledger.
 */
const WHAT_THE_COMPLIANCE_WAS_FOR_TAIL =
    /\s+(?:(?:to|into)\s+)?(?:submit|kneel|yield|bow|obey|comply|surrender|serve|swear|talk|mine|into|in\b|hand|give|pay|open|swallow|drink|eat|empty|turn|marry|wed|sit|cultivate|use|be|as)\b.*$/i;

const MOVE_SUBJECT_VERBS = /flee|escape|run|retreat|hide|withdraw|enter|infiltrate|sneak into|approach|follow|travel|go|head|walk|journey|depart|move|ride/;

const INTERACT_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['deceive', /\b(?:lie to|deceive|mislead|misdirect|bluff|pretend|disguise|pose as|feign|trick)\b/],
    /**
     * Ahead of `negotiate` so it does not eat "beg", and ahead of `talk`, which
     * would take every one of these as speech.
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
     */
    /**
     * ── THE COMMONEST PHRASINGS OF THIS VERB DID NOT ROUTE AT ALL ────────
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
    // Bowing is how somebody opens with an elder in this setting, and it was the
    // one courtesy with no line at all. `strike up a conversation` is here rather
    // than left to `converse`, because the words a player uses for opening politely
    // are the words the attack table also owns - see
    // `AN_ATTACK_WORD_INSIDE_AN_IDIOM`, which stops it swinging. Exempting it there
    // and not claiming it here would trade a wrong act for a refusal, which is
    // better and is not the answer.
    ['talk', /\b(?:talk|speak|ask|greet|converse|say|tell|introduce myself|strike(?:s|ing)? up a conversation|bows? to|bowing to|nods? to|pay my respects to|salutes?)\b/]
];

// `warn` is in the threaten intent and was not here, so "I warn him to stay
// away from her" fell through to `extractTarget`, which reads whatever follows
// `to` - and named a person "stay away from her".
/**
 * Asking what work is going, which is a question and must stay one.
 */
const ASKING_AFTER_WORK =
    /\b(?:is|are|any)\b[^.?!]{0,20}\b(?:any |some |paying |paid |other )?(?:work|jobs?|employment)\b[^.?!]{0,20}\b(?:going|about|around|here|to be had|available|on offer)\b|\b(?:is|are) there\b[^.?!]{0,20}\b(?:work|jobs?|employment)\b|\bwhat (?:work|jobs?) (?:is|are)\b|\b(?:who|anyone|anybody|someone|somebody)\b[^.?!]{0,20}\bhiring\b|\bwho(?:'s| is)? (?:hiring|taking on|looking for hands)\b|\bwho needs (?:a hand|hands|help with|workers?|labourers?|laborers?)\b|\b(?:can|could) i\b[^.?!]{0,15}\b(?:earn|make)\b[^.?!]{0,20}\b(?:here|anything|something|stones?|coin|money|a living|a wage)\b/;

// 护法: STANDING OVER SOMEBODY ELSE'S CROSSING

/** A word for the thing being stood over. Nothing here matches without one. */
const A_CROSSING_BEING_MADE =
    /\b(?:breakthrough|break(?:ing|s)? through|crossing|crosses|cross(?:es|ing)? (?:the |over)|attempt(?:s|ing)? (?:it|the (?:barrier|breakthrough|crossing|next rank))|the barrier|tribulation|closed[- ]door|seclusion|ascend(?:s|ing)?)\b/;

/** The two idioms that cannot mean anything but this. */
const STANDING_GUARD_IDIOM =
    /\b(?:stands? guard|standing guard|stood guard|keeps? watch|keeping watch|dao protector|dharma protector|act as (?:his|her|their|my|the|a) protector|be (?:his|her|their) protector)\b/;

/** A guarding phrase that needs a crossing word beside it to count. */
const A_GUARDING_PHRASE =
    /\b(?:guard|guards|guarding|guarded|protect|protects|protecting|protected|watch over|watches over|watching over|watched over|shield|shields|shielding|cover|covers|covering|look out for|stand over|stands over|standing over|stand by|see (?:him|her|them) through)\b/;

/**
 * Asking who would keep a watch over YOUR crossing, which names nobody.
 */
const WHO_WOULD_STAND_FOR_ME =
    /\b(?:who|anyone|anybody|someone|somebody|is there anyone)\b[^.?!]{0,40}\b(?:stand|stands|standing|guard|guards|protect|protects|watch|watches|keep|keeps)\b[^.?!]{0,40}\b(?:for me|over me|over my|my crossing|my breakthrough|my back|as my protector|my dao protector)\b|\b(?:do i have|have i got|is there)\b[^.?!]{0,20}\b(?:a )?(?:dao |dharma )?protector\b|\bwho would (?:stand|keep)\b[^.?!]{0,20}\b(?:guard|watch)\b(?!\s+over\s+\w)/;

/** Who the watch is being kept over. Trimmed at the clause saying WHILE. */
const A_WATCHED_PARTY = new RegExp(
    '\\b(?:stand guard|standing guard|stood guard|keep watch|keeping watch|guard|guards|'
    + 'guarding|protect|protects|protecting|watch over|watches over|watching over|shield|'
    + 'shields|cover|covers|stand over|stands over|standing over|see)\\s+'
    + '(?:over |for |after )?'
    + '(?:the |a |an |my )?'
    + '([a-z\'’][a-z\'’ -]{1,40}?)'
    + '(?:\'s|’s)?'
    + '\\s*(?:\\b(?:while|whilst|as|through|during|when|until|in|on|at|and|so)\\b.*)?[.!?]?$',
    'i'
);

/**
 * A person, or a pronoun that is not one.
 */
const NOT_SOMEBODY_BEING_GUARDED =
    /^(?:it|this|that|there|here|the barrier|the crossing|the breakthrough|the door|the gate|the cave|the room|myself|me)$/;

/**
 * The tail that says WHEN or HOW LONG rather than WHO.
 */
const WHEN_RATHER_THAN_WHO =
    /\s*\b(?:for|over|during|through|across|in)\s+(?:the\s+)?(?:a\s+|an\s+)?(?:next\s+)?[0-9]*\s*(?:day|days|week|weeks|month|months|year|years|decade|decades|season|seasons|while|stretch|span)\b.*$/i;

function whoIsBeingGuarded(input: string): string | undefined {
    const found = A_WATCHED_PARTY.exec(input);
    const name = (found?.[1] ?? '')
        .trim()
        .replace(WHEN_RATHER_THAN_WHO, '')
        .replace(/\b(?:breakthrough|crossing|attempt|tribulation|seclusion)$/i, '')
        .replace(/(?:'s|’s)$/i, '')
        .trim();
    if (name.length < 2) return undefined;
    // A clause word at the front means the sentence never named anybody - it
    // said when. Returning it would send the engine looking for a person
    // called "while she crosses"; returning nothing gets the refusal that
    // lists who IS standing here, which is a name the player can type back.
    if (/^(?:while|whilst|as|when|until|during|through|and|so|that|his|her|their|my|the)\b/i
        .test(name)) {
        const rest = name.replace(/^(?:his|her|their|my|the)\s+/i, '').trim();
        if (rest === name || rest.length < 2) return undefined;
        return NOT_SOMEBODY_BEING_GUARDED.test(rest.toLowerCase()) ? undefined : rest;
    }
    return NOT_SOMEBODY_BEING_GUARDED.test(name.toLowerCase()) ? undefined : name;
}

const INTERACT_SUBJECT_VERBS =/strike up a conversation with|interact with|warn|bow to|nod to|seduce|court|woo|charm|flirt with|flatter|deceive|mislead|bluff|pose as|trick|lie to|threaten|intimidate|bribe|interrogate|question|trade|buy|sell|barter|haggle|negotiate|bargain|petition|ally with|join|apply to|swear to|beg|recruit|hire|apologi[sz]e to|talk|speak|ask|greet|tell|steal from|steal|rob|mug|pickpocket/;

/**
 * Turn free text into one action, with no model involved.
 */

export function parseIntent(rawInput: string): PlannedAction {
    const input = inTheCharactersThePatternsUse(rawInput);
    const plan = readTheSentence(input);
    if (plan.action !== FALLBACK_ACTION) return plan;

    // AND ONLY NOW, THE SPELLING
    const respelt = respellForTheVerbTable(input, spellingVocabulary());
    if (respelt.text === input) return plan;

    const second = readTheSentence(respelt.text);
    // Still nothing is still nothing: the ORIGINAL refusal is returned, not
    // the respelt one, so the sentence the player is answered about is the
    // sentence they typed.
    if (second.action === FALLBACK_ACTION) return plan;

    // The respelling chose the VERB, and that is all it is allowed to choose. Every
    // string carrying on to the engine goes back into the player's own spelling
    // first, because the repair cannot tell a verb word from a name and is only
    // ever looking for verb words: `stele` is one edit from `stole`, which IS in
    // the vocabulary, and a target of "stole" sends the engine looking for an
    // object that does not exist. That is a wrong guess, where avoiding one is the
    // entire point of this path.
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
    // A COMPULSION IS NOT A PROPOSAL
    if (family !== null && !(family.action === 'propose' && SOMEBODY_WAS_MADE_TO.test(text))) {
        return family;
    }

    // 护法: STANDING OVER SOMEBODY ELSE'S CROSSING
    if (WHO_WOULD_STAND_FOR_ME.test(text)) {
        return { action: 'guard', intent: 'ask' };
    }
    if (STANDING_GUARD_IDIOM.test(text)
        || (A_GUARDING_PHRASE.test(text) && A_CROSSING_BEING_MADE.test(text))) {
        const who = whoIsBeingGuarded(input);
        return {
            action: 'guard',
            ...(who ? { target: who } : {}),
            // The span is the player's own and the protector module refuses to
            // invent one. A sentence with no duration in it reaches
            // `A_WATCH_WITH_NO_LENGTH_SAID`, in the verb rather than here.
            ...(parseDuration(text) !== null ? { days: parseDuration(text)! } : {})
        };
    }

    // ASKING SOMEBODY A PLAIN FACT ABOUT THEMSELVES
    const ownFact = whatIsBeingAskedAboutThem(text);
    if (ownFact !== null) {
        return {
            action: 'interact',
            // The MOOD is still read off the sentence. "What is your name" is a
            // question and "I demand to know your name" is an attempt, and
            // flattening the second into the first would quietly remove the price
            // of having leaned on somebody - which is the softening the agency rule
            // forbids, reachable by choosing your words. The demand path reads the
            // same self-fact, so limit one does not bite there either; what it adds
            // is the resolver, the day and the marks.
            intent: matchIntent(text, INTERACT_INTENT_PATTERNS) ?? 'talk',
            topic: A_TOPIC_ABOUT_THEMSELVES[ownFact]
        };
    }

    // MAKING SOMEBODY DO SOMETHING, WITH HANDS
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
    if (!AIMED_AT_THE_LADDER.test(text)
        // Taking somebody ON AS something is not taking them on. See the constant.
        && !TAKEN_ON_AS_SOMETHING.test(text)
        && !GOING_FOR_CARE.test(text)
        && !AN_ATTACK_WORD_INSIDE_AN_IDIOM.test(text)
        && (usedAsVerb(text, 'attack|attacks|strike|strikes|hit|hits|fight|fights|kill|kills|'
            + 'cut down|draw on|swing at|go for|set (?:on|upon)|jump|ambush|assault|'
            // The words a player uses when the killing is the point rather than the
            // fight. Found by a standing sweep: "I murder a disciple of the Nine
            // Abyss Flame Sect" and "I assassinate the Third Lord" reached NOTHING,
            // while "I attack the Nine Abyss Flame Sect" was refused properly at
            // every position. A verb that answers the polite phrasing and not the
            // honest one teaches a player that the game is small, when what is
            // actually true is that the target is enormous.
            + 'murder|murders|murdering|assassinate|assassinates|assassinating|slay|slays|'
            + 'do away with|make an end of|'
            // AND THE WORDS FOR KILLING MORE THAN ONE PERSON
            + 'exterminate|exterminates|exterminating|wipe out|wipes out|wiping out|'
            + 'slaughter|slaughters|slaughtering|massacre|massacres|massacring|'
            + 'take (?:him|her|them) on|put (?:him|her|them) down|finish (?:him|her|them)|'
            // THE INTENTS THAT HAD NO TRIGGER
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
            // SAYING HOW IS SAYING HOW FAR
            intent: /\b(?:kill|murder|assassinate|slay|finish|cut down|put (?:him|her|them) down|exterminate|wipe out|slaughter|massacre)\b/.test(text)
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

    // A FIGHT SOMEBODY WOULD CHOOSE TO HAVE
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

    // A TAKING, ROUTED TO THE RESOLVER THAT ASKS WHOSE IT IS
    {
        const taken = whatATakingNames(text, input);
        if (taken !== null) {
            const owner = whoATheftIsAimedAt(input);
            return {
                action: 'interact',
                intent: 'take',
                topic: taken,
                ...(owner ? { target: owner } : {})
            };
        }
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
    // Ahead of `work` and `gather` because a sentence about the house's intake is
    // full of their vocabulary ("I take on new disciples to work the fields");
    // ahead of `train_technique` because a sentence about what the house teaches is
    // not a sentence about practising it; and ahead of the INTERACT table, whose
    // `recruit` label matches the bare words "take on", and of the sect LISTING,
    // which fires on the noun plus any question word.
    {
        const led = leadershipIntent(text, input);
        if (led) return led;
    }

    // Inheritance grounds, ahead of everything that owns one of their verbs.
    {
        const step = siteStep(text, input);
        if (step) return step;
    }

    // what somebody leaves for whoever comes after
    {
        const aside = legacyStep(text, usedAsVerb, parseDuration(text) ?? undefined);
        if (aside) return aside;
    }

    // institutions acting on each other, and on the dead
    {
        const between = institutionalAct(text, input);
        if (between) return between;
    }

    // ASKING A PERSON FOR SOMETHING
    {
        const about = askingWhatSomebodyIsAfter(input);
        if (about) {
            return { action: 'request', intent: 'wants', target: about };
        }
    }

    {
        // PUTTING IT UP FOR SALE IS NOT ASKING ANYBODY FOR IT
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

    // the three questions a stuck player asks
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

    // what am I carrying in my head
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
    // whose art that was
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

    // getting a wound seen to
    if (HAVING_IT_SEEN_TO.test(text)
        // Another party named as the one who is to do it, and the passive form
        // where nobody is named at all. See both patterns for the word orders
        // `HAVING_IT_SEEN_TO` cannot reach.
        || SOMEBODY_ELSE_TO_SEE_TO_IT.test(text)
        || HAVING_IT_DONE_TO_YOU.test(text)
        || (usedAsVerb(text, TREATMENT_VERBS)
            && (INJURY_NOUNS.test(text) || /\b(?:me|myself)\b/.test(text)))
        || (HEALER_NOUNS.test(text) && usedAsVerb(text, SEEKING_CARE_VERBS))
        || (TREATMENT_NOUNS.test(text)
            && usedAsVerb(text, `${SEEKING_CARE_VERBS}|${TREATMENT_VERBS}`))) {
        return { action: 'treat' };
    }

    // striking the barrier, and not everything with the word in it
    if (usedAsVerb(text, 'break\\s*through|breakthrough|breaks through|breaking through')
        || /\b(?:strike (?:at )?the barrier|push (?:past|through|against) the (?:barrier|bottleneck)|force (?:the |my way through the )?(?:barrier|bottleneck)|assault the barrier|attempt the (?:next )?rank|advance a rank|(?:try|attempt|make|go for) (?:a |the |my |another )?break\s*through|(?:try|attempt|push|go) (?:to |for )?(?:the )?(?:next realm|next rank|next layer|advancement))\b/.test(text)) {
        return { action: 'breakthrough' };
    }

    // Closed-door seclusion before ordinary cultivation: it is the more specific
    // reading of the same sentence, and it is a different bargain - sealed against
    // encounters, and against opportunities with them. `seclude` itself was not on
    // this list, so "I seclude myself for a year" fell to `cultivate` - a different
    // bargain at a twelfth of the default span, taken silently. The verb answering
    // to every phrasing except its own name is the near-synonym rule at its
    // sharpest. `retreat from the world` is here because the bare word belongs to
    // `move`'s `flee` intent and always will - "I retreat" in a fight is a
    // withdrawal - so the phrasing that means seclusion has to name the world it is
    // retreating from. "I retreat from the world entirely for a stretch" is the
    // corpus's own phrasing and it was answered by a journey.
    if (/\b(?:closed[- ]?door|seclude|secludes|secluding|seal (?:myself|the (?:cave|door))|sealed seclusion|enter seclusion|go into seclusion|shut myself)\b/.test(text)
        || /\b(?:retreat|retreats|retreating|withdraw|withdraws|withdrawing|cut myself off) (?:from|out of) (?:the world|everything|everyone|society|all of it)\b/.test(text)) {
        return { action: 'seclude', days: parseDuration(text) ?? DEFAULT_SECLUSION_DAYS };
    }

    // the house's own board, ahead of the mortal one
    const namedDuty = usedAsVerb(text, DUTY_TAKING_VERBS) ? dutyNamed(text) : undefined;
    if (namedDuty) {
        return { action: 'sect', intent: 'duty', target: namedDuty };
    }

    // HOW MUCH CONTRIBUTION DO I HAVE
    if (/\b(?:contribution|contributions)\b/.test(text)
        && /\b(?:how much|how many|what(?:'s| is)?|do i have|have i|my|balance|standing)\b/.test(text)
        && !usedAsVerb(text, DUTY_TAKING_VERBS)) {
        return { action: 'sect', intent: 'standing' };
    }

    // WHAT IS NAILED TO THE WALL
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
        // signing for a line off it are the same sentence with one verb changed,
        // and the difference is an oath row with a due date on it. So the target is
        // attached only where a taking verb is actually in verb position, and "I
        // look at the sect mission board" carries none - which routes it to the
        // read, which is the cheap branch. Same rule `site`, `petition`, `posture`,
        // `seal` and `offer` all follow.
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

    // ASKING WHETHER THERE IS WORK, WHICH IS NOT TAKING ANY
    if (ASKING_AFTER_WORK.test(text)) {
        return { action: 'work', intent: 'board' };
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
        // SAYING IT WITHOUT THE WORD `work` IN IT
        || /\b(?:i (?:can|could) do|anything|something|any(?:thing)? going)\b[^.?!]*\bfor (?:pay|wages|money|coin|stones|a wage)\b/.test(text)
        // A TAKING OF WORK IS A TAKING, HOWEVER IT IS QUALIFIED
        || /\btakes?\b[^.?!]{0,30}?\bwork\b/.test(text)
        || /\b(?:whatever|anything|something)\b[^.?!]{0,20}\bpays?\b/.test(text)
        || /\bbest[- ]paying\b|\bpays? (?:the )?(?:best|most|fastest|quickest)\b/.test(text)
        // SAYING PLAINLY THAT YOU NEED ONE
        || /\bi (?:need|want|am after|could use|am looking for)\b[^.?!]{0,15}\b(?:a job|jobs|work|employment|wages?|paid work|paying work)\b/.test(text))
        // AND `work at` IS THE SAME WORD DOING THE SAME THING
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
    // The phrasings themselves are in `inventory-phrasings.ts`, which also owns
    // the money words `give` reads. This line keeps the ORDER and nothing else.
    if (asksWhatYouAreCarrying(text)) {
        return { action: 'inventory' };
    }

    // ── the arts, listed, before the art being learned ──
    //
    // The question form must win: "what can I learn" is a read of a catalog
    // and "I learn the Azure Ripple Art" is an act that can tear meridians.
    // Getting those the wrong way round costs a run.
    if (/\b(?:what|which)\b[^.!?]*\b(?:arts?|techniques?|manuals?|methods?)\b[^.!?]*\b(?:can i (?:learn|study|take up|pick up)|could i (?:learn|study)|are (?:there|available|open to me)|do i have access to|am i able to learn)\b/.test(text)
        || /\b(?:what (?:arts?|techniques?) can i learn|list (?:the )?(?:available )?(?:arts?|techniques?)|show (?:me )?(?:the )?(?:available )?(?:arts?|techniques?)|what (?:arts?|techniques?) are (?:available|going|about))\b/.test(text)
        // THE PHRASING THE GAME ITSELF PROMISES
        || /\b(?:what(?:'s| is)? there to learn|what is there to learn|what can i learn|anything to learn|is there anything to learn|what could i be taught|what am i able to learn)\b/.test(text)) {
        return { action: 'list_techniques' };
    }

    // swallowing a pill
    if (usedAsVerb(text, PILL_TAKING_VERBS)
        && (PILL_NOUNS.test(text) || IMMORTAL_ITEM_NAMED.test(text))) {
        return {
            action: 'consume_pill',
            target: extractSubject(input, PILL_SUBJECT_VERBS)
        };
    }

    // ASKING A HOUSE TO LET YOU SIT IN, which is not learning an art
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

    // learning one, which is not practising one
    if (usedAsVerb(text, LEARNING_VERBS)
        || (usedAsVerb(text, LEARNING_VERBS_NEEDING_A_NOUN) && TECHNIQUE_CLASS_NOUNS.test(text))) {
        return {
            action: 'learn_technique',
            target: extractSubject(input, LEARNING_SUBJECT_VERBS)
        };
    }

    // selling, which is the only way a pouch becomes a purse
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

    // The noun `market` is a place people stand in and steal from and talk about.
    // Asking to SEE the board is a different sentence, and it is either a question
    // about what things cost or a verb aimed at a stall. ASKING FOR A CATEGORY BY
    // NAME
    if (/\b(?:what|which|any)\b[^.?!]*\b(?:pills?|medicines?|elixirs?|remed(?:y|ies)|healing|cures?)\b[^.?!]*\b(?:for sale|on offer|are sold|is sold|do they sell|can i buy|are there|available|here)\b/.test(text)
        || /\b(?:pill|medicine|apothecary|physician|healer)\b[^.?!]*\b(?:stall|shop|counter|board|prices?)\b/.test(text)) {
        return { action: 'market', target: 'medicine' };
    }

    // Two measured misses. `show` was not among the market verbs although `see`,
    // `check` and `visit` were, so "show me the market" fell through to `interact`
    // and walked the player over to talk to somebody. And nothing read the counter
    // itself: `stalls` was already a market NOUN, so "what is on the stalls"
    // satisfied half the rule and reached nothing. `the prices` is PLURAL here, and
    // the singular was a measured misroute. "I would like to take that off him for
    // the price" is somebody buying one thing and it read as a request to see the
    // board, because "for the price" contains "the price". A board question asks
    // after prices; a purchase names one.
    if (/\b(?:what(?:'s| is) (?:for sale|on offer)|what can i buy|going rate|how much (?:is|are|does)|price of|cost of|the prices\b|what(?:'s| is) on (?:the )?(?:stalls?|counter|board))\b/.test(text)
        // What the place itself deals in, which is the board question asked
        // about the town rather than about a thing. "what does this town have
        // to trade" walked the player over to talk to somebody.
        || /\b(?:what|which) (?:does|do|has|have) (?:this|the|that) (?:town|place|village|city|settlement|market)\b[^.?!]*\b(?:have|sell|sells|trade|deal|offer|stock)\b/.test(text)
        || (usedAsVerb(text, 'browse|shop|buy|sell|barter|haggle|price|visit|check|see|show|find|go to|look at|look over|head to|walk to')
            && /\b(?:market|marketplace|bazaar|stalls?|prices?|shops?|traders?)\b/.test(text))
        // WHO, rather than WHAT
        || /\b(?:who(?:'s| is| are)?\s*(?:here\s+)?(?:is\s+)?(?:selling|trading|buying|dealing|got anything|has anything)|(?:is |are )?(?:there )?(?:any(?:body|one)|somebody|someone|people) (?:here )?(?:selling|trading|with (?:anything|something) to sell)|(?:who|what) (?:here )?(?:has|have) (?:anything|something) (?:for sale|to sell|to trade)|what (?:are|is) (?:they|people|anybody|the others) selling|what do(?:es)? (?:they|he|she|people|anybody|anyone|everybody|the \w+) (?:sell|trade|stock|have))\b/.test(text)) {
        return { action: 'market', target: extractSubject(input, /market for|price of|cost of|buy|sell/) };
    }

    // Stocking up comes before eating, because "buy food" is ambiguous and the
    // expensive reading of getting it wrong is one-directional: a player who meant
    // one meal and got a month of rations has lost some stones, and a player who
    // meant a month and got one meal starves. "ten years of provisions" did not
    // parse, because the count alternation stopped at "three" and every larger
    // number word fell through to `buy` and died at `resolvePrice`. The whole
    // word-number table is spliced in instead of a hand-written list, so it cannot
    // go stale against `parseCount`, which already knows all of them.
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

    // A WORD GIVEN, CARRIED, OR NOT KEPT
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

    // A COUNTER, A BOARD, AND SOMEBODY ELSE'S SPAN
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

    // buying a line off the board
    if ((usedAsVerb(text, BUYING_VERBS)
        // The offer forms, which carry no buying word at all. See
        // {@link OFFERING_TO_BUY} for the turn that found them.
        || OFFERING_TO_BUY.test(text)
        // A PURCHASE SAID POLITELY
        || /\btake (?:it|that|this|them|those|one) off (?:him|her|them)\b[^.?!]{0,40}\bfor (?:the price|the asking|what (?:he|she|they) (?:wants?|asks?)|his price|her price|their price)\b/.test(text))
        && !BUYING_A_PERSON_OFF.test(text) && !RIDING.test(text)) {
        return {
            action: 'buy',
            // The offer forms are in the splitter too, or the sentence
            // resolves to the right verb and hands it nothing to buy.
            target: extractSubject(
                input,
                /buy|purchase|pay for|order|book|hire|acquire|take passage on|pay the|take|have|get me/
            )
        };
    }

    // THE YARD
    if (WHAT_A_YARD_MAKES.test(text)
        && (BUILDING_SOMETHING.test(text) || BACK_TO_THE_STOCKS.test(text))) {
        const what = WHAT_IS_BEING_BUILT.exec(input);
        const span = parseDuration(text);
        return {
            action: 'craft',
            ...(what ? { target: what[1].trim().toLowerCase() } : {}),
            ...(span ? { days: span } : {})
        };
    }

    // And the read, which is free and is how anybody finds out a yard exists.
    // Separate from the rule above because it names no noun - "what could I
    // build" is exactly the question somebody with an empty pouch asks.
    if (ASKING_WHAT_A_YARD_MAKES.test(text)) {
        return { action: 'craft' };
    }

    // what can I make
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

    // GOING OUT AFTER SOMETHING
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
        // Suiya's pocket" - a theft aimed at a named person - came back "Cloudcap
        // Mushroom, pouched" and "7 days bent over the ground around Iron Gate".
        // The player attempted a crime against somebody and the engine charged them
        // a week of foraging for it, which is the worst answer available: not a
        // refusal, not the act, and irreversible.
        && !POCKET_PICKING.test(text)) {
        return { action: 'gather', target: extractSubject(input, /gather|forage|harvest|pick|collect|dig up/) };
    }

    // A TRADE THE BOARD PRINTS IS A TRADE A PLAYER CAN NAME
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

    // The bare forms, and `book`. "I practise", "I train", "I drill", "I spar" and
    // "I read my book" all reached nothing, because the rule demanded a noun from a
    // list that did not include the commonest word for the object. A cultivator
    // with one art and nothing else to do says "I train", and the game had no
    // answer for it. `work at the method` is its own alternative rather than two
    // words added to the list above, and the difference is measurable. "I work at
    // the method until it is better" is this verb's own exemplar and it bought a
    // season of paid labour, because the employment branch three hundred lines up
    // takes `work at` and `method` was missing from the noun list here while
    // `ceiling`, `acquisition` and `learn_technique` all use it for the same thing.
    // Adding `method` to the list above instead ALSO took "I put in real practice
    // at the method", which is `cultivate` - one exemplar traded for another. So
    // the noun is admitted only for the two words that needed it. Plurals, because
    // a player drills "the sword forms" as often as "the sword form" and a word
    // boundary after `form` does not fall before an `s`. The same one-letter miss
    // that hid the whole sect listing behind `houses`.
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

    // WHAT MY STANDING BUYS ME ON MY HOUSE'S GROUND
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

    // HANDING SOMEBODY A THING
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

        // Following and approaching take a PERSON. "I follow the cultivator" used
        // to hand `cultivator` to the mover as a destination, and the engine
        // dutifully spent the travel days, wrote the location, and then described
        // the ambient qi of a place called `cultivator`. A verb whose object is a
        // person must not produce a place, so when no destination preposition was
        // used these go to the person instead - where they cost nothing and can be
        // refused honestly. FOLLOWING A ROAD IS TRAVEL; FOLLOWING A PERSON IS
        // SOCIAL
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
            // vault talking about it. `SECT_THEFT_PATTERN` matches on the nouns too
            // - treasury, coffers, reserves - which is what makes "what do the sect
            // reserves hold" a sentence about theft; the verb position is what
            // separates the question from the act. An act with no pace named runs
            // at the safest one rather than at none: see the note on
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

    // The oath phrasings are here rather than in a verb of their own, and that is
    // the finding rather than a shortcut. "I swear an oath to the House of the
    // Bound Word" reached the INTERACT table and was answered by walking the player
    // over and describing them - and the act it names is JOINING. The catalog says
    // so in its own admission requirement, which for that house reads "forty years
    // of intended service, sworn in front of a Warden of Terms before any training
    // begins". The pattern held `swear to` and missed `swear an oath to`, two words
    // apart, so a sentence that was already implemented had no route. Membership is
    // exclusive in the repository, so a seat-holder swearing to somebody else is a
    // defection and is answered as one - by the join path, out of real state,
    // rather than by a second verb that would have to decide the same thing again.
    // PAYING IN, instead of serving
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


    // WHO LEADS IT, which is not a request to be found one
    if (WHO_ANSWERS_FOR_THIS_GROUND.test(text)) {
        return { action: 'look', intent: 'holder' };
    }

    if (/\b(?:who (?:leads|heads|runs|founded|commands)|who is (?:the )?(?:head|leader|patriarch|matriarch|master|strongest)(?: of)?|who is in charge)\b/.test(text)
        && /\b(?:sect|house|clan|school|order|here|it|this|my|our)\b/.test(text)) {
        return { action: 'sect', intent: 'standing' };
    }

    if (/\b(?:join|joining|apply to|applying to|swear to|swear (?:an oath|my oath|myself|allegiance|fealty|service) to|give (?:my|our) (?:oath|word) to|bind myself to|take (?:the|their) oath|take me on|taken on|would (?:take|have) me|accept me|admit me|adopt me|take me in|be admitted)\b/.test(text)
        // `houses` was missing while every other noun here carried its plural, so
        // the two plainest ways of asking this question - "which houses take
        // people" and "tell me about the houses near here", both of them the
        // exemplar corpus's own phrasings - fell past the listing entirely. One was
        // answered by walking the player over to talk to somebody called "me about
        // the houses near here"; the other reached nothing at all. A word boundary
        // after `house` does not fall before an `s`.
        || (/\b(?:sects?|orders?|schools?|clans?|houses?)\b/.test(text) && /\b(?:look for|find|near|nearby|around here|what|which|who|tell me about)\b/.test(text))
        // Asking who would have you, in a sentence with no house noun in it at
        // all: "who would take someone like me". See
        // {@link WHO_WOULD_TAKE_SOMEBODY_LIKE_ME}.
        || WHO_WOULD_TAKE_SOMEBODY_LIKE_ME.test(text)) {
        // A SENTENCE THAT NAMES NO HOUSE MUST NOT ARRIVE CARRYING ONE
        const said = extractSubject(input, /joining|join|applying to|apply to|swear (?:an oath|my oath|myself|allegiance|fealty|service) to|swear to|give (?:my|our) (?:oath|word) to|bind myself to|enter|find|look for/);
        return { action: 'sect', ...(namesNoHouse(said) ? {} : { target: said }) };
    }

    // who else is drawing on this ground
    if (/\b(?:how crowded|how busy|how many (?:people|cultivators|others)|crowded here|too many people|who else is (?:here|drawing)|how contested|is it crowded|is this place crowded|how many are (?:here|drawing))\b/.test(text)
        || (/\b(?:crowd\w*|contested|occupancy|carrying capacity)\b/.test(text)
            && /\b(?:here|this place|this ground|the ground|is it|how)\b/.test(text))) {
        return { action: 'look', intent: 'crowding' };
    }

    // why the ground is like this
    if (PLACE_HISTORY_PATTERNS.some(pattern => pattern.test(text))) {
        const where = namedAfter(input, PLACE_HISTORY_SUBJECT);
        return { action: 'look', intent: 'history', ...(where ? { target: where } : {}) };
    }

    // a master reading a student
    if (/\b(?:am i (?:ready|stuck|stalled|finished|done|going anywhere)|have i (?:stopped|stalled|stagnated|gone as far)|how am i doing here|is there anything (?:left |more )?(?:for me )?here|has this place got anything|what do (?:they|the elders|my seniors) (?:make of|think of|see in) me|am i wasting my time)\b/.test(text)) {
        return { action: 'assess' };
    }

    // assess: what happens if I try, which is not the same as looking
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

    // the cultivator asking about themselves
    if (/\b(?:who am i|what(?:'s| is) my (?:situation|condition|state)|how(?:'s| is) my (?:health|condition)|am i (?:hungry|starving|injured|hurt|wounded|bleeding|dying|healthy|ok|okay|alright|well)|my (?:health|condition|situation)|tell me about myself|describe myself|look at myself|check (?:myself|my condition))\b/.test(text)
        || /\b(?:how long (?:will|can|do|have) i (?:live|got|got left|have left)|how (?:long|much longer) have i got|how many years (?:do i have|have i got|are left|left)|what(?:'s| is) my (?:lifespan|life ?span|age)|how old am i|when (?:will|do) i die|years left)\b/.test(text)) {
        return { action: 'status' };
    }

    // TELLING SOMEBODY THAT A WRONG WAS DONE
    const told = whatIsBeingTold(input);
    if (told) {
        return { action: 'tell', target: told.person, topic: told.claim };
    }

    // ── WHAT A LOOK ALONE WOULD TELL ─────────────────────────────────────
    //
    // Above the asking read and well above `interact`, because `tell` is in
    // both of their verb lists and the discern sense has to be taken out of the
    // sentence before either of them sees it. See
    // {@link TELLING_APART_RATHER_THAN_TELLING_SOMEBODY}.
    const readOffThem = whatALookIsBeingAskedTo(input);
    if (readOffThem) {
        return { action: 'investigate', target: readOffThem };
    }

    // ASKING ABOUT A NAMED THING
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
        const takingAThing = interactIntent === 'steal'
            && namesTheThingRatherThanThePerson(subject);
        const target = interactIntent === 'steal'
            ? whoATheftIsAimedAt(input) ?? (takingAThing ? undefined : subject)
            : subject;
        return {
            action: 'interact',
            target,
            intent: interactIntent,
            // AND WHAT WAS NAMED, WHICH USED TO BE THROWN AWAY
            ...(takingAThing ? { topic: theThingWithoutItsOwner(subject!) } : {}),
            ...(leverage ? { leverage } : {})
        };
    }

    // REPUTATION IS NOT THE CHARACTER SHEET
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
        // -- AND WHETHER SOMEBODY IS SITTING IT WITH THEM -----------------
        const alongside = whoIsSittingWithThem(input);
        return {
            action: 'cultivate',
            days: parseDuration(text) ?? DEFAULT_CULTIVATION_DAYS,
            ...(alongside ? { target: alongside } : {})
        };
    }

    // AND THE LANGUAGE OF RECOVERY, WHICH IS NOT THE LANGUAGE OF SITTING
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

    // look
    if (/\b(?:who(?:'s| is| are)? (?:here|around|about|nearby)|is (?:anyone|anybody|somebody) (?:here|about|around)|look for (?:someone|somebody|anyone)|who else is|anybody about|see (?:anyone|anybody|who is here))\b/.test(text)
        || /\bwho (?:is|was|are|were)\s+(?:that|this|the one\b|he\b|she\b|they\b|them\b|these people|those people)/.test(text)) {
        return { action: 'look', intent: 'company' };
    }

    {
        // LOOKING AT SOMEBODY IS NOT LOOKING AROUND
        const at = LOOKED_AT.exec(input);
        const named = at ? at[1].trim() : '';
        const looked = at && !THE_SCENE_ITSELF.test(named) ? cleanPlace(named) : undefined;
        if (looked) return { action: 'investigate', target: looked };
    }

    if (/\b(?:look (?:around|about|up|out)|have a look|glance (?:around|about)|survey|take (?:it|the place) in|take in (?:my|the) surroundings|where am i|what do i see|what is (?:here|around))\b/.test(text)
        || /^\s*(?:i\s+)?looks?\b/.test(text)) {
        return { action: 'look' };
    }

    // A duration and NOTHING ELSE - "ten years" - is a request for seclusion, and
    // it is the single most common thing a player types in this genre.
    if (isBareDuration(text)) {
        const bare = parseDuration(text);
        if (bare !== null) return { action: 'cultivate', days: bare };
    }

    // Nothing matched. The fallback is inert BY RULE: an action the engine is
    // not confident about must be the cheapest one available, never the most
    // expensive. No time passes, no food is eaten, nothing dies.
    return { action: FALLBACK_ACTION };
}

