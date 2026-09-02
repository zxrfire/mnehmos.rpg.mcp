/**
 * What each verb is for, said the way a player would ask for it.
 *
 * ── WHY THIS IS A MODULE AND NOT A PROMPT STRING ─────────────────────────
 *
 * A narrator that does not know the verb list invents affordances. It writes
 * "you could try climbing the wall" where there is no climb verb, and the
 * player spends a turn discovering that the prose lied. The engine's own action
 * set is the only honest account of what somebody may be pointed at, so the
 * account has to be generated from the action set rather than remembered
 * alongside it.
 *
 * This file is the one place that account is written. Two things read it and
 * neither paraphrases it:
 *
 *   `prompt.ts`      composes the phase-1 glossary out of it, through
 *                    {@link composeActionGlossary}. There is no second wording
 *                    of a verb in the prompt.
 *   `docs/verbs.md`  is generated from it by
 *                    `scripts/build-the-verb-surface.mjs`, which joins it to
 *                    the code: where each verb is declared, where it resolves,
 *                    and whether plain English reaches it without a model.
 *
 * That is the `NARRATOR-CORE.md` precedent with the direction reversed, and
 * deliberately. Tier 1 is prose a human wrote, so the file is the source and
 * the runtime loads it. This is a projection of a TypeScript enum, so the
 * TypeScript is the source and the document is the projection - which also
 * keeps the narrator off a disk read that `docs/` is not guaranteed to satisfy:
 * see the note on {@link NARRATOR_CORE_PATH}, where a Docker image without
 * `docs/` in it is the live case, not a hypothetical one.
 *
 * ── THE GUARANTEE ────────────────────────────────────────────────────────
 *
 * {@link WHAT_EACH_VERB_IS_FOR} is a `Record<ActionName, …>`, so a verb added
 * to `ACTION_NAMES` does not compile until somebody has said what a player is
 * asking for when they say it. A verb cannot ship undocumented, and the check
 * is `tsc` rather than a reviewer's memory.
 *
 * ── HOW TO WRITE AN ENTRY ────────────────────────────────────────────────
 *
 * `says` is addressed to a classifier reading one sentence a player typed, so:
 *
 *   - Say what the PLAYER is asking for, not what the engine does about it.
 *     The design rationale for the verb belongs beside the verb, in
 *     `actions.ts`; it is written for whoever maintains the enum and it is the
 *     wrong register here.
 *   - Name the neighbours it is confused with, and say which way to go. Most of
 *     the damage a glossary does is a verb quietly eating a sentence that
 *     belonged to the verb next door - `interact` answering a petition by
 *     walking the player over and describing the building is the worked case.
 *   - Say what it COSTS when the cost is what decides between two verbs: days
 *     spent, stones spent, and whether it can be unsaid.
 *
 * Wrapping and indentation are not yours to choose - both consumers re-wrap -
 * so write plain sentences and let {@link composeActionGlossary} lay them out.
 */

import {
    ACTION_NAMES,
    MAX_CULTIVATION_DAYS,
    type ActionName
} from './actions.js';
import type { RequestKind } from './what-a-request-asks-and-of-whom.js';

/**
 * The fields of a plan this verb reads.
 *
 * `leverage` is deliberately not on this list at all. It is set by the parser
 * at the point the verb is recognised and never by a model - that is what keeps
 * "what was put on the table" a mechanic rather than a word.
 */
export type PlanField = 'days' | 'target' | 'intent' | 'topic' | 'rations' | 'terms' | 'opening';

/**
 * The fields a MODEL may fill in, which is not all of them.
 *
 * Everything else `PlanField` carries is read by the engine and absent from the
 * phase-1 schema on purpose: `carryWhatOnlyTheSentenceKnows` fills those off the
 * player's own sentence once the two paths agree on the verb. Teaching a model
 * to emit them would be a model deciding how an approach is priced, whether a
 * killing was also a broken word, and who struck first. The document says which
 * fields a verb reads and which of those the sentence supplies; the prompt is
 * shown only these.
 */
export const MODEL_MAY_SET = ['days', 'target', 'intent', 'topic'] as const satisfies readonly PlanField[];

export interface VerbSurfaceEntry {
    /** Which fields this verb reads. */
    takes: readonly PlanField[];
    /** What a player is asking for when they say this. */
    says: string;
    /**
     * The intent labels this verb actually dispatches on, where it has any.
     *
     * Listed here rather than harvested from the parser because they are not
     * all declared in one shape: some are exported constants in `actions.ts`,
     * some are a union type, and three verbs set them inline in the branch that
     * recognises the sentence. `tests/docs/the-verb-surface-is-not-stale.test.ts`
     * asserts these against the exported constants wherever one exists, so the
     * only entries carrying any drift risk are the ones with nothing to compare
     * against - `attack`, `propose`, `decline`, `child` and `look`, all of which
     * name their branch in `says`.
     *
     * An open label set - `move` and `interact` - lists the suggestions and
     * says in `says` that the field is free text.
     */
    intents?: readonly string[];
}

/**
 * Every kind of thing a `request` can ask for.
 *
 * A mapped type rather than an array literal so the compiler refuses a list
 * that is missing one: `RequestKind` has no exported constant to compare
 * against, and this is the cheapest way to get the same guarantee.
 */
const EVERY_REQUEST_KIND: Record<RequestKind, true> = {
    teaching: true,
    discipleship: true,
    introduction: true,
    telling: true,
    a_thing: true,
    terms: true,
    a_trade: true,
    nothing: true,
    unstated: true
};

const REQUEST_KINDS = Object.keys(EVERY_REQUEST_KIND) as readonly RequestKind[];

/**
 * What a player is asking for, verb by verb.
 *
 * Ordered as `ACTION_NAMES` is ordered, because the glossary and the document
 * both render in that order and a reader comparing the three should not have to
 * re-sort one of them.
 */
export const WHAT_EACH_VERB_IS_FOR: Readonly<Record<ActionName, VerbSurfaceEntry>> = {
    interact: {
        takes: ['target', 'intent', 'topic'],
        intents: [
            'talk', 'negotiate', 'trade', 'deceive', 'interrogate',
            'threaten', 'bribe', 'recruit', 'apologise', 'seduce', 'steal'
        ],
        says: `anything done to or with a PERSON or a FACTION. "target" names them; "intent"
            says what was being attempted - negotiate, trade, deceive, interrogate, threaten,
            bribe, recruit, apologise, talk, or any other short label that fits. Use this
            rather than asking for a verb that is not on this list. NOT for a request made OF
            an institution - see petition, posture, seal and offer below. This action walks
            the player over and describes the party, and answering "I file a Requisition" or
            "I offer an alliance" with that is worse than answering nothing, because it looks
            like an answer.`
    },
    investigate: {
        takes: ['target'],
        says: `examine a place, a person, a record, an inscription, an object; search a ruin.
            "target" names what is being examined.`
    },
    move: {
        takes: ['target', 'intent'],
        intents: ['travel', 'flee', 'approach', 'enter', 'follow'],
        says: `go somewhere on foot. "target" is the destination; "intent" is how - travel,
            flee, approach, enter, follow.`
    },
    ride: {
        takes: ['target', 'topic'],
        says: `go somewhere ON something: a mount, a drawn carriage, a spirit boat, or flight
            on the cultivator's own blade. "target" is the destination; "topic" names what is
            under them when the player said. The engine picks what actually suits the road out
            of what they can put under them, charges the walking days the catalog states, and
            says what the arrival reads as.`
    },
    fold: {
        takes: ['target'],
        says: `step across the distance instead of covering it. "target" is the destination.
            Void Refinement and above, and only to ground the cultivator has stood on or can
            see; the engine says so when they cannot.`
    },
    passage: {
        takes: ['target', 'intent'],
        intents: ['board', 'buy'],
        says: `a Measured Span counter. "intent" is "board" to read what runs from here and
            what each costs, or "buy" to take a place on one; "target" is where to. Reading
            the board is free and is how somebody who has never left their province finds out
            there are others.`
    },
    oath: {
        takes: ['target', 'intent', 'topic'],
        intents: ['read', 'swear', 'break'],
        says: `a word given, carried or not kept. "intent" is "swear", "read" or "break";
            "target" is who it is given to; "topic" is what is being sworn, in the player's own
            words. Breaking one is permanent and opens an account naming them, so never choose
            it for a question.`
    },
    attack: {
        takes: ['target', 'intent', 'terms', 'opening'],
        intents: ['drive_off', 'subdue', 'kill', 'humiliate'],
        says: `hit somebody. "target" names them; "intent" is what the player is trying to end
            up with - drive_off, subdue, kill, humiliate - and "terms" is "agreed" when both
            sides said this was a bout (a spar, a duel, a challenge) and "open" when nobody
            promised anybody anything. The blows land the same either way. What the agreement
            changes is what a killing MEANT and who is owed something afterwards, which is why
            it must be set from what the player said rather than guessed. "opening" is
            "from_concealment" when the fight was opened from cover rather than by squaring
            up, which decides who gets the first round and nothing about what a blow does.`
    },
    coerce: {
        takes: ['target', 'intent', 'opening'],
        intents: ['submit', 'hand_over', 'talk', 'tame'],
        says: `MAKE somebody do something, with hands rather than with words. Not the same as
            interact/threaten, which is a promise of harm and costs the target nothing yet -
            this is the point at which they stop being somebody being talked to. "target"
            names them; "intent" says what the compliance was for - submit, hand_over, talk,
            or tame. It resolves through the confrontation engine, so it fails the way a fight
            fails: somebody stronger does not decline, they answer. An animal made to submit
            is a tamed animal and reaches this same verb.`
    },
    cultivate: {
        takes: ['days'],
        says: `sit and gather qi. "days" (1-\${MAX_CULTIVATION_DAYS}); "ten years" is 3650,
            default 30.`
    },
    seclude: {
        takes: ['days'],
        says: `deliberate closed-door seclusion: safe from encounters, and from every
            opportunity that would have found you. "days", default 365.`
    },
    breakthrough: {
        takes: [],
        says: `attempt to advance one rank right now.`
    },
    train_technique: {
        takes: ['target'],
        says: `practise a specific art the cultivator already knows. "target" names it.`
    },
    refine: {
        takes: ['target'],
        says: `work the cauldron. "target" names the formula or the pill wanted.`
    },
    gather: {
        takes: ['target'],
        says: `forage for herbs and materials. "target" may name what is wanted.`
    },
    hunt: {
        takes: ['target'],
        says: `go out after a beast. "target" may name what is being looked for. Distinct from
            gather, which digs up things that do not move, and from attack, which is a person.
            What comes back is a body worth something at a counter, which is the other half of
            where high-grade material in this world comes from - and what is out there can be
            far above the person looking for it.`
    },
    eat: {
        takes: [],
        says: `buy and eat a meal.`
    },
    provision: {
        takes: ['days', 'rations'],
        says: `lay in food BEFORE it is needed, which is the correct opening move and the one a
            model reaches for last. "rations" is a count if the player named one, "days" is a
            span if they named that instead. Satiety burns against a hundred at about two a
            day, so a stretch of seclusion longer than the pouch is a way to starve on
            schedule. Distinct from eat, which buys one meal and refuses when they are not
            already hungry.`
    },
    treat: {
        takes: [],
        says: `get a wound seen to. Untreated meridian injuries never heal on their own, they
            raise the odds of the next one, and this is the only route out of that. Choose it
            whenever the player says they are hurt and wants it dealt with, whether or not they
            name a physician. Costs stones and a month.`
    },
    buy: {
        takes: ['target'],
        says: `buy one line off the mortal price board by name. "target" is the thing: a pill, a
            physician's visit, a course of care, a ferry crossing. Use this rather than
            "interact" for anything with a price on it - a purchase is not an approach to a
            person.`
    },
    sell: {
        takes: ['target'],
        says: `put something on the counter. "target" names one thing in the pouch; omit it (or
            say "everything") to price the whole pouch at once. This is the ONLY way a gathered
            herb becomes spirit stones, so it is the right answer whenever the player wants
            money and is carrying something. A buyer pays less than list, and how much less
            depends on the ladder. Passes no time.`
    },
    inventory: {
        takes: [],
        says: `what is in the pouch: pills, herbs, stones, accumulated pill toxicity. Passes no
            time.`
    },
    consume_pill: {
        takes: ['target'],
        says: `swallow a pill they are carrying. "target" names it. A pill bought and never
            taken does nothing, and this is the only verb that takes one - including the
            breakthrough pill, which has to be swallowed BEFORE the attempt for the attempt to
            know about it. Toxicity accumulates on the body whether or not anybody wanted it
            to.`
    },
    list_techniques: {
        takes: [],
        says: `the arts this cultivator could actually be taught, filtered by realm, spirit
            root, dao standing and what has surfaced in this life at all. Passes no time. Use
            it for "what can I learn".`
    },
    learn_technique: {
        takes: ['target'],
        says: `take up an art for the first time. "target" names it. NOT the same as
            train_technique, which practises one already held. An art that fights the spirit
            root is learnable and can tear meridians on the spot, so choose this only when the
            player plainly asked to learn something.`
    },
    acquisition: {
        takes: ['target'],
        says: `how a manual could go further, priced by every route there is at once: finding
            the next volume, being taught it, or writing it yourself. "target" names the art.
            Passes no time and costs nothing, which is the point of it - the comparison is the
            decision, so it must not itself cost a decade. Use it for "how do I get past this
            book".`
    },
    ceiling: {
        takes: [],
        says: `why nothing is accumulating, with the binding gate named: the manual, the
            province, the seat, the qi, or the settling clock. Passes no time. This is the
            right answer to "why am I not making progress", "am I stuck", "what is my ceiling"
            and "what is stopping me" - NOT status, which is the sheet, and NOT assess, which
            is somebody else's opinion of them.`
    },
    teacher: {
        takes: [],
        says: `who stands above this cultivator and would teach, with what each one will not
            say. Passes no time. Names only people they already hold a record for; "nobody you
            know of" is a real answer. Use it for "who can teach me", "I look for a master" and
            "is there anyone here stronger than me" - NOT status and NOT look, both of which
            answer a different question entirely.`
    },
    destinations: {
        takes: [],
        says: `where they could go, with what the journey costs, what the qi is like there and
            how far that province carries anybody. Passes no time. Use it for "where can I go",
            "what is nearby" and "where is there better spiritual energy". Distinct from
            recall, which reads their own head; distinct from move, which goes somewhere they
            have already named.`
    },
    roads: {
        takes: [],
        says: `the dao grounds within reach: ground that teaches something, what each one
            teaches, and precisely what the cultivator is short by where it will not have them.
            Passes no time, reads only what they have heard of, and cannot teach them a name.
            The other half of destinations - that one is where they could go, this one is what
            standing there would be worth. Use it for "where can I comprehend something" and
            "what roads are open to me".`
    },
    wait: {
        takes: ['days'],
        says: `let a day go by doing nothing in particular.`
    },
    work: {
        takes: ['days', 'target'],
        says: `take an occupation for a span, for wages. "days" (default 90); "target" may name
            the kind of work. This is how somebody with no stones eats, and it is the right
            answer far more often than a model expects.`
    },
    market: {
        takes: [],
        says: `what is for sale where they are standing, and at what price. Passes no time.`
    },
    sect: {
        takes: ['intent', 'target', 'topic'],
        intents: [
            'leave', 'promote', 'stipend', 'standing', 'join', 'siphon', 'order',
            'recruit', 'admission', 'curriculum', 'expel', 'duty', 'donate', 'guest'
        ],
        says: `anything to do with a house: getting into one, and everything a member or an
            officer of one can do. "intent" is the step - "join" to be taken in, "standing" to
            read where they stand, "stipend" to draw one, "promote" to ask for a rung, "duty"
            to take something off the mission board, "donate" to pay into the ledger, "guest"
            to sit in at a house that has not taken you, "leave" to resign, and "siphon",
            "order", "recruit", "admission", "curriculum" and "expel" for what the rungs above
            a disciple buy. Default to the read - "standing" - unless the player plainly asked
            for a step, because joining is a life's worth of allegiance and cannot be unsaid.`
    },
    site: {
        takes: ['target', 'intent'],
        intents: ['approach', 'outside', 'enter', 'take'],
        says: `an inheritance ground: a trial somebody built to be inherited from, or a grave
            that was arranged for nobody. "target" names it; "intent" is one of approach (get
            to it, or ask what there is), outside (read it from the threshold without going
            in), enter (go in - this SPENDS DAYS and can kill), take (carry out what is behind
            the door). Choose "outside" when the player is looking rather than going, and
            "enter" only when they plainly said so.`
    },
    legacy: {
        takes: ['intent', 'target', 'days'],
        intents: ['counters', 'bury', 'dig', 'lodge', 'claim'],
        says: `putting things beyond your own death, and collecting what somebody else put
            beyond theirs. "intent" is "counters" to read who would hold a thing and on what
            terms, "bury" to put a cache in the ground (spends days), "dig" to go and get one
            back, "lodge" to leave something with a named house against a phrase, "claim" to
            collect one. "target" names the house for the last two. Default to "counters" when
            the player is asking rather than doing.`
    },
    petition: {
        takes: ['target', 'intent', 'topic'],
        intents: ['grant', 'stock', 'descent'],
        says: `ask an INSTITUTION for something: a grant, an object off its standing stock,
            recognition of a line. "target" names the body; "topic" is what is being asked for,
            in the player's own words, and is carried verbatim onto the form. "intent" is
            "stock" for an application against something a body is holding and cannot reorder
            (a Requisition, a schedule amendment, a request for one of its pills), "descent"
            for a claim of an ancestral line, "grant" for everything else that goes upward.
            Nearly always refused, and the refusal is the answer - it comes back in the
            instrument's own terms. Passes no time.`
    },
    posture: {
        takes: ['target', 'intent'],
        intents: ['stance', 'war', 'alliance', 'defect', 'tribute'],
        says: `what one HOUSE is to another. Only the head of a house can do three of these,
            and the refusal for everybody else names the rung it opens at. "target" names the
            other party; "intent" is "war", "alliance", "defect" (change who the house holds
            from), "tribute" (call in a payment), or "stance" to READ where the two already
            stand. Default to "stance" unless the player plainly declared something - the other
            four cannot be unsaid.`
    },
    seal: {
        takes: ['target', 'intent'],
        intents: ['read', 'wake'],
        says: `the sealed ancestor a house keeps under its mountain. "target" names the house,
            or omit it for the player's own. "intent" is "read" for the condition and the cost,
            "wake" to actually do it. Waking your own house's is the head's decision and
            changes the house permanently, once; waking somebody else's is not a decision at
            all, it is a theft. Default to "read".`
    },
    offer: {
        takes: ['target', 'intent', 'topic'],
        intents: ['channel', 'offering', 'send'],
        says: `the channel through the Lid, from whichever end the player is standing at. Below
            it: an offering sent up to an ancestor who crossed - "target" names the house, or
            omit it for the player's own, and "intent" is "channel" to read what the line is or
            "offering" to make one, which costs a decade of the house's principal and is the
            head's decision. Above it: "send", which puts an object or a word DOWN a line
            somebody below is holding, with "topic" as what is said with it. Which end they are
            at is decided by the engine, not by the label. Default to "channel".`
    },
    descend: {
        takes: ['target'],
        says: `a True Immortal going back down through the Lid, in person. "target" names where
            they are forcing it open. This is the most expensive action in the game: nine
            strikes of the heaviest tribulation there is, then ten to fifteen breaths on the
            ground, then the pressure puts them back. Choose it only when the player has
            plainly said they are going themselves - "send" is the other answer to the same
            intention and costs nothing.`
    },
    look: {
        takes: ['intent'],
        intents: ['history', 'ground_time', 'crowding', 'bills', 'company'],
        says: `observe the surroundings. Passes no time. "intent" narrows what is being looked
            at: "history" for what people say has happened HERE (not news, which is elsewhere),
            "ground_time" for how long this ground would take somebody, "crowding" for how many
            are already drawing on it, "bills" for what is posted on the wall, "company" for
            who else is standing here. Omit it for the plain read.`
    },
    status: {
        takes: [],
        says: `report the cultivator's own condition. Passes no time.`
    },
    assess: {
        takes: ['target'],
        says: `what would happen if they tried something: the odds, not the attempt. "target"
            names the place or the opponent.`
    },
    recall: {
        takes: ['target', 'intent'],
        intents: ['knowledge', 'dao'],
        says: `what this cultivator is carrying in their own head. "target" names a person, a
            faction or a subject they may have heard of; omit it for everything they hold.
            "intent" is "dao" for what they have comprehended, "knowledge" otherwise. Passes no
            time, and it CANNOT teach them anything - it reads their own records and never the
            world, so a name they have not been told comes back as nothing. Use it for "what do
            I know of X".`
    },
    recognise: {
        takes: ['target'],
        says: `whose art that was. The cultivator watching somebody move and drawing on what
            they already hold - "target" names the person or the art. Passes no time, is never
            refused, and the answer is graded by what they have a reference for and how far
            they have climbed: somebody with no reference is told they would not know, and
            somebody with a reference and too low a rung is told it matches what they have
            heard and that they could not tell a good imitation. It says where an art was
            learned and never whom anybody serves.`
    },
    news: {
        takes: [],
        says: `what the people standing HERE say is happening somewhere else. No target and no
            intent. Passes no time. Use it for "what news is there", "what is happening in the
            world", "I listen for rumours", "what is the word" and "what have you heard". The
            opposite verb to recall: that one reads their own head, this one asks other people,
            and what comes back may be wrong. NOT for "what do people say about this place",
            which is the ground's own history and belongs to look.`
    },
    request: {
        takes: ['target', 'intent', 'topic'],
        intents: REQUEST_KINDS,
        says: `ASK A NAMED PERSON FOR A NAMED THING, which is not the same as interact and must
            not be routed there. "target" is who it is put to; "intent" is what kind of thing is
            being asked for - teaching (be taught an art, or handed its book), discipleship (be
            taken on), introduction (be put in front of somebody), telling (be told something
            they know), a_thing (be given, lent or sold an object), terms (what would it take -
            the price asked before it is paid), a_trade (something put down for it that is not
            money), nothing (ask for NOTHING - buy them a drink, sit with them, call on them, do
            them a small favour; costs a day and no stones, and it is the only thing that makes
            a stranger somebody who will do you a favour later); "topic" is what was named - the
            art, the person, the thing. This is the ONLY route to being taught by a person,
            which the engine says repeatedly is one of the two ways past a manual's ceiling. It
            spends days and can spend the purse, so choose it only when the player is actually
            asking somebody for something rather than asking about them.`
    },
    propose: {
        takes: ['target', 'intent', 'topic'],
        intents: ['propose', 'accept'],
        says: `put a match on the table, or agree to one that has been put to you. "target" is
            who, or whose house; "topic" is what is being offered with it, in the player's own
            words, and the list of what may go there is open; "intent" is "propose" when they
            are asking and "accept" when they are answering. Nothing anywhere branches on
            gender, on who asked, or on which side of it the player is.`
    },
    decline: {
        takes: ['target', 'intent'],
        intents: ['refuse', 'leave'],
        says: `say no to a match, or leave one already made. "intent" is "refuse" for the answer
            and "leave" for the walk-out. Neither is free and neither is automatic: what it
            costs is priced by what the asking side staked. Use it whenever the player is
            turning something down or getting out of it - NOT interact, which would describe
            the family instead of answering them.`
    },
    child: {
        takes: ['days', 'target', 'intent'],
        intents: ['have', 'place'],
        says: `have a child, or place one. "intent" is "have" - "target" names the other parent
            and "days" the stretch being spent - or "place", where "target" names the house a
            child is being put to on somebody's word. The engine spends the years the way it
            spends years everywhere; what the player is choosing here is to spend them.`
    },
    unclear: {
        takes: [],
        says: `DO NOT CHOOSE THIS. It is the deterministic parser's fallback for a sentence it
            could not read. If you are unsure, choose "look" or "investigate".`
    }
};

// ─────────────────────────────────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────────────────────────────────

/** Column the description starts in, wide enough for `train_technique`. */
const NAME_COLUMN = 17;

/** Where the description wraps. `NAME_COLUMN` plus this is the line length. */
const PROSE_WIDTH = 78;

/** One paragraph, however the source happened to be indented. */
function oneParagraph(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * The values a `says` string may interpolate.
 *
 * Balance numbers are imported and never retyped, here as everywhere. The
 * document generator resolves the same placeholders out of `actions.ts`, which
 * is why they are written as literal `${…}` in the source rather than as real
 * template substitutions: one spelling, read two ways.
 */
const NUMBERS: Readonly<Record<string, number>> = {
    MAX_CULTIVATION_DAYS
};

/** Substitute the balance numbers a description quotes. */
function withNumbers(text: string): string {
    return text.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (whole, name: string) =>
        name in NUMBERS ? String(NUMBERS[name]) : whole);
}

function wrap(text: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        if (line.length === 0) line = word;
        else if (line.length + 1 + word.length <= width) line += ` ${word}`;
        else { lines.push(line); line = word; }
    }
    if (line.length > 0) lines.push(line);
    return lines;
}

/**
 * The phase-1 glossary, laid out as a two-column table.
 *
 * Composed rather than written out, so the classifier is told about every
 * member of the closed set. The hand-maintained version it replaces had fallen
 * twelve verbs behind the enum - the model was being handed the whole list of
 * names to choose from and the meaning of only some of them - and nothing
 * failed for as long as that was true.
 */
export function composeActionGlossary(): string {
    const out: string[] = [];
    for (const verb of ACTION_NAMES) {
        const body = wrap(withNumbers(oneParagraph(WHAT_EACH_VERB_IS_FOR[verb].says)), PROSE_WIDTH);
        out.push(`${verb.padEnd(NAME_COLUMN)}${body[0] ?? ''}`);
        for (const line of body.slice(1)) out.push(`${' '.repeat(NAME_COLUMN)}${line}`);
    }
    return out.join('\n');
}

/** Every verb that reads this field, in enum order. */
export function verbsTaking(field: PlanField): readonly ActionName[] {
    return ACTION_NAMES.filter(verb => WHAT_EACH_VERB_IS_FOR[verb].takes.includes(field));
}

/**
 * What each field a model may set is, in the phase-1 schema block.
 *
 * `target` is the one that names no verbs: half the set takes one, and a list
 * that long stops being a constraint and becomes noise. The other three are
 * narrow enough that the list IS the instruction.
 */
const FIELD_IN_THE_SCHEMA: Readonly<Record<
    typeof MODEL_MAY_SET[number],
    { what: string; enumerate: boolean }
>> = {
    days: { what: 'integer', enumerate: true },
    target: {
        what: 'short string naming a real person, faction, place, art, formula or herb',
        enumerate: false
    },
    intent: { what: 'short label', enumerate: true },
    topic: { what: 'short string', enumerate: true }
};

/**
 * The `days | target | intent | topic` lines of the phase-1 schema block.
 *
 * Generated for the same reason the glossary is. The hand-written version said
 * `days` was "only for cultivate | seclude" while five other verbs read one,
 * and a classifier told a field does not apply will not fill it in - so "I wait
 * a year" and "I bury this for a century" arrived with a defaulted span and
 * nobody could see where the year went.
 */
export function composePlanSchemaFields(): string {
    return MODEL_MAY_SET.map(field => {
        const spec = FIELD_IN_THE_SCHEMA[field];
        const only = spec.enumerate ? `, only for ${verbsTaking(field).join(' | ')}` : '';
        const body = wrap(`<${spec.what}${only}>,`, PROSE_WIDTH);
        const head = `   ${`"${field}":`.padEnd(10)}`;
        return body
            .map((line, i) => (i === 0 ? head + line : ' '.repeat(head.length) + line))
            .join('\n');
    }).join('\n');
}
