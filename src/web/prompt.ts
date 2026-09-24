/**
 * Narrator prompts - the one module to tune when the prose is wrong.
 */

import { readFileSync } from 'node:fs';
import { AN_AMBITION_IS_A_READ, LANE_NAMES, THE_LANES } from './the-lanes-a-sentence-can-go-down.js';
import { fileURLToPath } from 'node:url';

import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import {
    MAX_ORDINAL,
    rankName,
    realmForOrdinal,
    progressRequiredForOrdinal
} from '../engine/cultivation/realms.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { lifespanCeilingFor } from '../engine/cultivation/survival.js';
import { untreatedInjuryCount } from '../engine/cultivation/injuries.js';
import {
    ACTION_NAMES,
    PRESSING_SOMEBODY,
    THE_LABEL_THAT_REACHES_A_VERBS_READ,
    costsTheAskerNothing,
    type ActionName
} from './actions.js';
import { MOST_CALLS_IN_ONE_TURN } from './a-sentence-can-be-more-than-one-call.js';
import {
    composePlanSchemaFields
} from './what-each-verb-is-for-in-the-players-words.js';
import {
    describeAmbientPerceived,
    placeName,
    type Company,
    type EngineFacts
} from './facts.js';
import type { AwarenessRow } from './knowledge.js';
import type { Hearing, SpeakableName } from './hearsay.js';
import {
    HOW_THIS_GENRE_WRITES_A_SCENE,
    THE_STORYTELLER,
    THE_WORLD_THEY_TAKE_FOR_GRANTED,
    WORKED_TURNS,
    howTheyReadToYou,
    thePeopleHere,
    whoThePlayerNamed
} from './the-narrator-plays-the-world.js';

// ─────────────────────────────────────────────────────────────────────────
// TIER 1 - THE NARRATOR'S CONSTITUTION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where the assembled Tier 1 text lives.
 */
export const NARRATOR_CORE_PATH = 'docs/world/NARRATOR-CORE.md';

/**
 * The minimum that must survive the file being absent.
 */
const NARRATOR_CORE_FALLBACK = `# Narrator Core (fallback)

**Authority.** The AI narrates. The engine decides. You are not authoritative over
statistics, cultivation progress, realm changes, breakthrough outcomes, combat results,
inventory, currency, health, lifespan, death, world-state mutations, or event resolution.

**Do not invent state.** Never assert a fact about the world that a tool did not return.
If the engine has not said it, it has not happened, and "the record does not say" is a
legitimate thing to narrate.

**Only the acts the turn ran happened.** A turn spends at most one costly act, so a player's
sentence often holds clauses that did not run. The turn names them: not run, declined,
refused. Do not narrate one as having happened. Say what did run and say what did not.

**Every figure comes from a ruling.** A cost, a balance, a span of days, an amount gathered:
if no ruling this turn carries that number, do not put one in the prose.

**Never soften an engine outcome.** If the tool returned a torn meridian, narrate a torn
meridian. Do not cushion it, do not add a consolation, do not imply a second chance.

**Intention is not action.** What the player said they were trying to do is a label. The
outcome comes from state, never from the word the player used.

**Permanent death.** No reload, no save slot, no continue. Never quietly help the player,
and never manufacture drama to compensate.`;

let narratorCoreCache: { text: string; source: 'file' | 'fallback' } | null = null;

/**
 * Load the Tier 1 text, once.
 */
export function narratorCore(): { text: string; source: 'file' | 'fallback' } {
    if (narratorCoreCache) return narratorCoreCache;
    try {
        const path = fileURLToPath(new URL(`../../${NARRATOR_CORE_PATH}`, import.meta.url));
        const text = readFileSync(path, 'utf-8').trim();
        if (text.length === 0) throw new Error('empty');
        narratorCoreCache = { text, source: 'file' };
    } catch {
        narratorCoreCache = { text: NARRATOR_CORE_FALLBACK, source: 'fallback' };
    }
    return narratorCoreCache;
}

/**
 * The owner's voice doc, loaded rather than paraphrased: a hand copy is what drifted before.
 */
export const TONE_PATH = 'docs/world/writing/tone.md';

/** The ladder doc, whose ruling and register sections govern the prose at every height. */
export const LADDER_PATH = 'docs/world/writing/what-changes-as-the-ladder-is-climbed.md';

/**
 * The sections a narrator writes from, each with its subsections, in the order they reach it.
 * Not every tier-1 section: naming conventions are for authoring a new name, which a narrator
 * never does, and the whole of both docs put the system prompt past what a local model reads
 * well - measured at 22k tokens and 93s a narration on gemma4:31b.
 */
export const VOICE_SECTIONS: readonly (readonly [string, string])[] = [
    [TONE_PATH, '## The register'],
    [TONE_PATH, '## Humour is required, not optional'],
    [TONE_PATH, '## Guidance for the narrator'],
    [TONE_PATH, '## The prose is translated xianxia, not an English novel'],
    [TONE_PATH, '## The words this world uses for itself'],
    [TONE_PATH, '## Show, never explain'],
    [LADDER_PATH, '## One rule, and the rest falls out of it'],
    [LADDER_PATH, '## The prose register changes, and only in these ways']
];

/** A `##` section of a markdown doc, from its heading to the next `##` or `#`. */
function sectionOf(doc: string, heading: string): string | null {
    const lines = doc.split(/\r?\n/);
    const from = lines.findIndex(line => line.trim() === heading);
    if (from < 0) return null;
    let to = from + 1;
    while (to < lines.length && !/^#{1,2}\s/.test(lines[to]!)) to++;
    return lines.slice(from, to).join('\n').trim();
}

let voiceCache: string | null = null;

/**
 * The voice sections, as one block. A doc that cannot be read contributes nothing rather than
 * throwing, so a packaging change that loses `docs/` degrades to the storyteller alone.
 */
export function theVoiceDoc(): string {
    if (voiceCache !== null) return voiceCache;
    const docs = new Map<string, string>();
    const read = (path: string): string => {
        if (!docs.has(path)) {
            try {
                docs.set(path, readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf-8'));
            } catch {
                docs.set(path, '');
            }
        }
        return docs.get(path)!;
    };
    voiceCache = VOICE_SECTIONS
        .map(([path, heading]) => sectionOf(read(path), heading))
        .filter((section): section is string => section !== null)
        .join('\n\n');
    return voiceCache;
}

/**
 * THE THREE REGISTER BANDS, BY THEIR HEADINGS IN THE LADDER DOC.
 *
 * The prose for each band is in `what-changes-as-the-ladder-is-climbed.md` and
 * is tier 1, so all three reach the system prompt on every turn and the model
 * can read the contrast between them. What varies per turn is only WHICH of
 * them applies, which is this name. Keeping the prose out of here is the point:
 * a second copy in a template literal is the arrangement `TONE_PATH` records
 * having already drifted once.
 */
export const REGISTER_BANDS = [
    'At the bottom: a body in weather',
    'Through the middle: a room with a door to another room',
    'At the top: an act and the wave it makes'
] as const;

export type RegisterBand = (typeof REGISTER_BANDS)[number];

/**
 * Where a cultivator's acts stop carrying, as the band whose register fits.
 *
 * Keyed on the realm rather than on the ordinal so a renumbered ladder cannot
 * move a boundary silently. The two cuts are the two places the world's own
 * answer to somebody changes: a house stops recruiting and starts negotiating,
 * and then a house stops being the largest thing an act can reach.
 */
export function theRegisterAtThisHeight(realmOrdinal: number): RegisterBand {
    const key = realmForOrdinal(realmOrdinal).key;
    if (key === 'qi_condensation' || key === 'foundation_establishment') return REGISTER_BANDS[0];
    if (key === 'core_formation' || key === 'nascent_soul' || key === 'deity_transformation') {
        return REGISTER_BANDS[1];
    }
    return REGISTER_BANDS[2];
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 1 - INTENT CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * The verb list the classifier is choosing from, laid out for a prompt.
 */
/**
 * The lanes, laid out for the router.
 *
 * Generated from the lane table for the same reason `ACTION_GLOSSARY` is
 * generated from the action set: a second wording of a lane in a prompt string
 * is a wording that goes stale the first time somebody edits the table.
 */
const LANE_GLOSSARY = LANE_NAMES.map(lane => {
    const row = THE_LANES[lane];
    return `  ${lane} - ${row.says}\n      intents: ${Object.keys(row.intents).join(', ')}`;
}).join('\n');

/**
 * Which verbs cost the player something, composed rather than written down.
 *
 * THREE LISTS, BECAUSE THERE ARE THREE ANSWERS. `interact` was the only verb
 * anybody had noticed sitting on both sides, and it is one of twelve: naming
 * no thing at a cauldron is the recipe list and naming a formula spends the
 * herbs, asking what a house teaches is free and joining it is not. A prompt
 * that puts those in the FREE column is telling the model that joining a sect
 * costs nothing.
 */
function whichVerbsSpendSomething(): string {
    const free: ActionName[] = [];
    const spends: ActionName[] = [];
    const both: ActionName[] = [];
    for (const name of ACTION_NAMES) {
        if (name === 'interact') continue;
        if (THE_LABEL_THAT_REACHES_A_VERBS_READ[name] !== undefined) both.push(name);
        else (costsTheAskerNothing({ action: name }) ? free : spends).push(name);
    }
    const pressing = [...PRESSING_SOMEBODY].sort().join(', ');
    return [
        `FREE - these take no day, no stone and no risk, and you may chain as many as the`,
        `sentence needs: ${free.join(', ')}.`,
        `SPENDS - these take days, the purse or the body, and a turn does at most ONE:`,
        `${spends.join(', ')}.`,
        `BOTH, AND THE INTENT DECIDES - each of these has one read inside it that costs`,
        `nothing and spends on everything else: ${both.join(', ')}. When the sentence is`,
        `asking rather than doing, answer with the read.`,
        `"interact" is the same shape: free on talk, trade, apologise and the like, and it`,
        `SPENDS on ${pressing}.`
    ].join('\n');
}

/**
 * What a model is told about answering with a plan rather than a verb.
 */
export const A_SENTENCE_MAY_CONTAIN_A_PLAN = `A SENTENCE MAY CONTAIN A PLAN, AND YOU MAY ANSWER WITH ONE.

People in this world do several things in the time an incense takes to burn. "I take his
purse, hand it to the man beside him, and walk away" is three acts, not one, and the
interesting thing is none of the three - it is what they compose into. Somebody else is
holding stolen property and the player is elsewhere. Nothing frames anybody; the framing
falls out of the ORDER.

To answer with a plan, reply with {"steps": [ ... ]} where each entry is an action object
of the shape above, plus "said": the fragment of the player's own sentence that step is
for. One object with no "steps" is still a perfectly good answer and is what most
sentences deserve.

Rules, and they are enforced whatever you write:
- IN THE ORDER THEY SAID IT. The steps are resolved one at a time, each against the world
  the one before it left. Take-then-pass-then-leave is a frame-up; pass-then-take is
  nonsense. Never sort, never optimise, never move the cheap ones to the front.
- A STEP CAN FAIL BECAUSE THE ONE BEFORE IT DID. If the theft is seen, there is no purse
  to hand over and the plan stops there. That is a real outcome, not an error, and it is
  why you must not compose a plan whose later steps assume the earlier ones worked.
- CARRY OUT WHAT WAS SAID. Never add a step the player did not say. A theft does not imply
  fleeing, an approach does not imply an offer, and a fourth act you inferred is you
  deciding what somebody did with their life.
- PREFER THE SMALLER ACT. Where a sentence could be one big verb or two small ones the
  list already has, take the two. Small acts compose and big ones do not.
- A FREE READ IS NEVER THE POINT OF A SENTENCE. If somebody says "I look at the stalls and
  buy the cheapest manual", the buying is what they came to do and the looking is the frame
  around it. Answering with the read alone and dropping the act is the worst thing you can
  do here: they get a browse they did not ask for and never find out the purchase was
  ignored. List BOTH, in order, and let the engine spend the turn on the act.
- AT MOST ONE THAT SPENDS. Free reads chain; a turn does one costly act. If the sentence
  genuinely contains two, still list both.
- LIST THEM IN THE ORDER THE SENTENCE PUT THEM, and do not reorder them to make them work.
  If the order cannot work, that is the engine's answer to give and not yours to predict:
  "I break through and then cultivate for a year" is run as written and comes back with the
  barrier's own refusal. Reordering it would hide a mistake the player wants to see.
- EVERY CLAUSE THAT NAMES AN ACT GETS A STEP. Count the acts in the sentence before you
  answer, and answer with that many. A sentence with three commas in it and two steps in
  your reply has lost one, and the middle of a sentence is where it goes: measured, "I take
  his purse, press it into her hand, and walk away" came back as the taking and the walking
  with the handover missing, which is the one clause the other two were for.
- AT MOST ${MOST_CALLS_IN_ONE_TURN} STEPS.

${whichVerbsSpendSomething()}`;

/**
 * Phase 1 system prompt.
 */
export const INTENT_SYSTEM_PROMPT = `You are the intent router for a cultivation RPG engine. You do not narrate here and you
do not decide outcomes. You read one sentence from the player and say which action or actions
from a closed list they were reaching for.

Reply with a single JSON object and nothing else. No prose, no code fence, no explanation
outside the object.

Schema:
  {"lane": <one of: ${LANE_NAMES.join(' | ')}>,
   "intent": <one of the intents listed under that lane>,
${composePlanSchemaFields()}
   "reason": <one short sentence>}

Lanes. Pick the LANE first - what the player is doing - and then the intent inside it. You
are not choosing between ${ACTION_NAMES.length} engine routines; the engine works out which routine a
lane and an intent stand for. Choosing the right lane and a rough intent is worth far more
than agonising over the label.
${LANE_GLOSSARY}

Rules:
- If the player is broke, hungry, or asking how to get money or food, "work" and "market"
  are almost always what they meant. Never answer that with "cultivate": sitting still
  burns the food they do not have, and it is the one action that can kill them for asking.
- "lane" MUST be one of the listed lanes. If the intent you want is not listed under it, say
  the nearest one and the engine will take the lane's ordinary reading - a right lane with a
  rough intent is answerable, and a wrong lane is not.
- ${AN_AMBITION_IS_A_READ}
- WHERE TWO READINGS FIT, TAKE THE ONE THAT ANSWERS. A sentence that can be read two ways
  should be read as the simpler case rather than the edge case, so long as the simple reading
  is genuinely justified. Read as a question it answers; read as an act it may refuse for
  something the player has not got yet. Both are honest and only one gives them something.
  This is a tie-break and not a licence to answer a different question.
- THE CALLS MEASURED WRONG, and the rule each one teaches. These are the sentences a router
  gets wrong most often, so read them before you answer:
    "I want to join a sect"        -> house/join.  A wish that NAMES an act may be taken as
                                                   the act. Where they plainly cannot act on
                                                   it yet, the read is right too - both are
                                                   answers. What is wrong is reading it as a
                                                   list of names they already hold.
    "I want to get stronger"       -> a read.      A wish with no act in it is not one.
    "what would it take to get in" -> house.       Asking a house's price is about the house,
                                                   not about what you could acquire.
    "empty your pockets"           -> fight/force. A demand is coercion, not a blow. Nobody
                                                   has been struck.
    "is this place safe"           -> perceive.    Weighing a place is looking at it.
    "I sense the qi here"          -> perceive.    The ground, not a person.
    "I sit down"                   -> cultivate.   Sitting is how this world cultivates.
  The pronoun settles whose a thing is: a player says "I" and "my" about themselves and never
  "your", so "your purse" is somebody else's and the sentence is a demand.
- Anything asked ABOUT THE PLAYER THEMSELVES - what they are, what they carry, what they
  know, what they could learn, where they could go - is "consult". It is one lane on purpose:
  the player does not know which drawer the engine keeps a fact in, and neither do you.
- Problems in this world are meant to be solvable by negotiation, deception, alliances, escape,
  investigation, trading, faction politics, terrain, waiting, or finding someone stronger - not
  only by out-cultivating them. Route those through interact / investigate / move.
- "intent" is free text and it is only a label. It does not select an outcome; the engine
  resolves the interaction from state. Say what was attempted, not what succeeded.
- "target" must name something that actually exists in this world. If you are not sure the
  person or place is real, prefer "investigate" to find out over "interact" with an invention.
- A pointing phrase that means ONE person - "him", "the man", "whoever is nearest",
  "the strongest person here", "the oldest one" - means somebody under STANDING HERE.
  Bind it: answer with a name off that list rather than echoing the phrase back,
  because a phrase resolves to nobody and costs them the turn. A SUPERLATIVE IS ONE OF
  THESE. "who is the strongest person here" is a question about the people standing in
  front of them, so it is "look" - or, if they want that one person read, "investigate"
  with a NAME off the list and never with the phrase itself. Measured: echoing it back
  was answered as a failed search for the town they were standing in.
- A phrase that means MORE THAN ONE - "everyone here", "his family", "the whole sect", "all
  the guards" - is ONE step, and you pass it through in the player's own words. Do NOT
  expand it into a step per person. The engine expands a set itself, against who is actually
  present and who this cultivator has heard of, and it reports what the act did not reach.
  Six attack steps for one sentence is read as six costly acts, and the turn stops to ask
  which comes first - a question the player cannot answer, because they said one thing.
- Never name somebody the square does not hold and HAS HEARD OF does not carry. A cultivator
  standing here whose face this one cannot place has no name to give: point at them by
  standing - "the one above me", "the nearest" - and the engine will resolve it.
- Never invent fields for game state. Realm, spirit stones, HP, injuries, progress and death are
  decided by the engine and any such field you emit is discarded.
- Never answer with an outcome. You are choosing what is ATTEMPTED, not what happens. "I sneak
  into the sect" is an attempt to enter, not an infiltration; "I cultivate for ten years" is a
  request for ten years to pass, not a report that they have.
- A FORCED ACT IS THE FORCING, NOT THE POLITE VERB FOR IT. This is the softening rule in
  the form it actually goes wrong: not a refusal, but the nearest respectable member of
  the same family. Making somebody marry you is coercion and not a proposal. Making
  somebody swallow something is coercion and not a gift. Making somebody sit an art with
  you is coercion and not a shared sitting. Making somebody hand over what they are is
  coercion and not a request. Route the compulsion and put what they were made to do in
  "intent"; the engine prices the compulsion, and it cannot price one it was never told
  about.
- Never decline an action on grounds of what it is. Theft, violence, deceit, betrayal and
  worse are ordinary moves in this world and the engine has rules for every one of them.
  "I take his purse" is "steal", not "interact"; "I cut him down" is "attack", not "interact".
  For a theft, "target" is the person it is taken FROM and "topic" is the thing being taken,
  where the sentence names one - "I steal his spirit boat" is target: the owner, topic: the
  boat. A theft with no topic takes what they are carrying, so leaving it out quietly turns
  a named thing into a purse.
  Softening a hostile sentence into a neutral verb is the one failure that cannot be
  recovered downstream, because the engine never learns what was tried and the consequences
  that make this world worth playing never fire. Route it and let the engine be the one to
  say no.

${A_SENTENCE_MAY_CONTAIN_A_PLAN}`;

// ─────────────────────────────────────────────────────────────────────────
// PHASE 3 - NARRATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Phase 3 system prompt: the storyteller, the constitution, and the worked turns.
 *
 * Nothing per-turn goes here. What is in the scene, who is in it and what the engine ruled are
 * all in `composeNarrationUser`, so this text is identical on every call and a local server can
 * keep it cached.
 */
export function narrationSystemPrompt(): string {
    return [
        THE_STORYTELLER,
        narratorCore().text,
        THE_WORLD_THEY_TAKE_FOR_GRANTED,
        theVoiceDoc(),
        HOW_THIS_GENRE_WRITES_A_SCENE,
        WORKED_TURNS
    ].filter(block => block.length > 0).join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────
// STATE SUMMARY
// Compact by design: the classifier needs enough context to disambiguate
// ("break through" vs "keep cultivating"), not a character sheet.
// ─────────────────────────────────────────────────────────────────────────

export interface StateSummaryInput {
    cultivator: Cultivator;
    run: Run;
    ambient: AmbientQi;
    /** Resolved server-side. The classifier must never be shown a database id. */
    sectName?: string | null;
    /**
     * The rung on that house's roll, in the house's own word for it, or null
     * where they hold none. Resolved server-side through the one read; there is
     * no rung on the cultivator row to take it from any more.
     */
    sectRung?: string | null;
    /** Display names of the arts this cultivator actually knows. */
    knownTechniques?: readonly string[];
    /**
     * Everything this cultivator has heard of, and how.
     */
    awareness?: readonly AwarenessRow[];
    /**
     * Everybody standing in the square, right now.
     */
    present: Company;
    /**
     * What the world currently considers particularly actionable.
     *
     * NOT A MENU, AND THE BLOCK SAYS SO IN THE PROMPT. The design owner:
     *
     *   > get_affordances() doesn't mean "here are the only things you are
     *   > allowed to do." It means "here are the things the world currently
     *   > considers particularly actionable." The LLM still has a
     *   > general-purpose attempt_action.
     *
     * The universal verbs are already in the system prompt as `ACTION_NAMES`
     * and stay available whatever is in here - a cultivator standing in front
     * of a blacksmith may still try to assassinate him, and may still try to
     * fold space to the capital without knowing how. Whether either lands is
     * the engine's question and never this list's.
     *
     * Capped, because the reason this was not here already is real: a state
     * summary that grows without a bound is a classifier that reads less of it.
     */
    liveHere?: readonly AnAffordance[];
    /**
     * What is here to be pointed AT, and the phrases that reach each one.
     *
     * The other direction from `present`, which says who is here so a pointing
     * phrase can be bound. A reader that is only ever shown the roster has to
     * guess which phrases are nameable, and a guess that misses comes back as a
     * refusal the player reads as the game not following them. The houses on it
     * are here through somebody standing here, which is what separates naming a
     * house to its disciple's face from naming it across the map.
     */
    withinReach?: readonly ThingWithinReach[];
    /**
     * What the player typed, so the blocks that have to be capped can put what
     * this turn is about at the top of themselves and cut from the bottom.
     */
    said?: string;
}

/** One thing that can be named from here, and what reaches it. */
export interface ThingWithinReach {
    kind: string;
    name: string;
    alsoCalled: readonly string[];
    through: { name: string } | null;
}

/** One live thing, as much of it as the classifier needs. */
export interface AnAffordance {
    say: string;
    because: string;
    routesTo: string;
}

/**
 * The most live things the classifier is shown.
 *
 * Small on purpose, and separate from what a PLAYER is shown when they ask what
 * to do. A person reading a list picks from it; a classifier reading a list
 * starts writing sentences out of it, and a long one crowds out the sentence
 * that was actually typed.
 */
export const LIVE_THINGS_SHOWN_TO_THE_CLASSIFIER = 6;

/**
 * What the world is holding out, said as what it is: an offer, not a menu.
 */
export function describeWhatIsLive(live: readonly AnAffordance[]): string[] {
    if (live.length === 0) return [];
    return [
        '',
        'LIVE HERE (what this square and this body are currently holding out). '
            + 'THIS IS NOT A MENU AND IT IS NOT A LIMIT. Every action listed at the top of this '
            + 'prompt stays available wherever the cultivator is standing, and an action on '
            + 'neither list is still worth attempting - whether somebody can fold space, or kill '
            + 'a man five realms above them, is a question for the engine and not for you. What '
            + 'these are is what the world would answer FIRST:',
        ...live.slice(0, LIVE_THINGS_SHOWN_TO_THE_CLASSIFIER).map(one =>
            `  "${one.say}" (${one.routesTo}) - ${one.because}`)
    ];
}

/**
 * What can be named from here, said as what it is: what is at hand, not what is
 * permitted.
 *
 * The same standing rule the live block carries. A house a thousand miles off
 * can still be named and the engine will answer honestly about it; what being
 * on this list changes is that there is a body here to answer.
 */
export function describeWhatIsWithinReach(reach: readonly ThingWithinReach[]): string[] {
    if (reach.length === 0) return [];
    return [
        '',
        'WITHIN REACH (what is here to be acted on, and the other names each one answers '
            + 'to). THIS IS NOT A LIMIT ON WHAT MAY BE NAMED - anything the cultivator has '
            + 'heard of can be named and the engine will answer for it. What is on this list '
            + 'is what has a BODY here: a house is on it because somebody who answers to it '
            + 'is standing in this square, so naming that house is naming somebody present, '
            + 'and naming a house that is absent is talk:',
        ...reach.map(thing => {
            const names = thing.alsoCalled.length > 0
                ? ` - also "${thing.alsoCalled.join('", "')}"`
                : '';
            const via = thing.through ? ` (here through ${thing.through.name})` : '';
            return `  ${thing.name} [${thing.kind}]${via}${names}`;
        })
    ];
}

/**
 * WHAT THIS CULTIVATOR IS AND HOLDS, whatever the turn did.
 *
 * Not the sheet. `composeStateSummary` is the sheet and is phase 1's; this is
 * the short list of standing facts a sentence about the world can contradict.
 */
export interface WhereTheyStandNow {
    /** The rung, in the engine's own spelling. */
    rank: string;
    age: number;
    spiritStones: number;
    /** Books physically on them, by name. The fact that was inverted. */
    booksHeld: readonly string[];
    /** The cultivation methods they have actually sat down with. */
    methods: readonly string[];
    /** How many things are open inside and have not closed. */
    untreatedInjuries: number;
    /** House, and what they are called inside it. Null for nobody's. */
    house: string | null;
    /**
     * So that nobody in the scene calls a young woman "boy". Played: three new lives in a row
     * were all addressed as a boy, because the block said nothing and the model guessed.
     */
    sex?: 'female' | 'male';
    /**
     * Days since this run opened.
     *
     * SO THE WEATHER STOPS DRIFTING. The engine has no season and no time of
     * day, so every arrival invented light and weather fresh and nothing but
     * the turn before held it steady. A day is a thing the run has always
     * known; a season is one line of arithmetic on top of it, and it belongs
     * in this layer rather than in the engine, which has no use for one.
     */
    dayOfTheRun?: number;
    /**
     * The life ended this turn. Played: a curse at a square got the player beaten to nothing and
     * killed on the next day, the rulings said so in one line among thirty, and the narration
     * ended with them lying in the dirt while the square walked off. Nothing structural said
     * this turn was the last one, so nothing made it the last line.
     */
    dead?: boolean;
}

/**
 * The season on a day of the run, which begins in early spring.
 *
 * The engine models no seasons and has no use for one, so this is the prompt layer's own
 * reading of the run's day. It exists because a model handed no season writes a different one
 * every time somebody arrives somewhere: summer heat at a gate, frost at the next look. The
 * start is fixed rather than drawn, since all it has to be is the same every turn of a life.
 */
export function theSeasonOn(dayOfTheRun: number): string {
    const SEASONS = [
        'early spring', 'late spring', 'early summer', 'late summer',
        'early autumn', 'late autumn', 'early winter', 'late winter'
    ] as const;
    const dayOfTheYear = ((Math.floor(dayOfTheRun) % 365) + 365) % 365;
    return SEASONS[Math.min(SEASONS.length - 1, Math.floor(dayOfTheYear / (365 / SEASONS.length)))]!;
}

/**
 * What the player is and holds, as background to write FROM.
 *
 * Handed over because the model once told somebody carrying a manual that the manual was what
 * they lacked. Phrased as detail rather than report, because a standing condition handed over
 * every turn becomes the opening line of every turn unless the instruction rides beside it.
 */
export function whereTheyStandNow(state: WhereTheyStandNow | null | undefined): string[] {
    if (!state) return [];
    const carrying = state.booksHeld.length > 0
        ? `carrying ${state.booksHeld.join(', ')}`
        : 'carrying no books';
    const practising = state.methods.length > 0
        ? `has sat down with ${state.methods.join(', ')}`
        : 'has no cultivation method at all';
    const body = state.untreatedInjuries === 0
        ? 'meridians whole'
        : `${state.untreatedInjuries} thing${state.untreatedInjuries === 1 ? '' : 's'} open inside `
          + 'and not closing';
    return [
        'WHERE THEY STAND, standing background and NOT news. It is here so that the prose',
        'cannot contradict what they are holding or what they can do. Do not report it, do not',
        'open on it, do not list it back: unless the player asked about their own state, the',
        'state never becomes a line of its own. It becomes DETAIL:',
        '  a book on them - it knocks against the hip, a hand goes to it. NOT "you are carrying',
        '  the Lesser Qi-Gathering Manual".',
        '  a thin purse - the price is noticed, a hand closes over it. NOT "you have 24 spirit',
        '  stones".',
        '  torn meridians - a step is favoured, a breath comes short. NOT "your meridians are',
        '  damaged".',
        '  no method - the sitting yields nothing and they feel it. NOT "you have no cultivation',
        '  method".',
        '  no house - nobody\'s colours on them where everyone else is wearing some. NOT "you',
        '  serve no house".',
        `- ${state.sex ? `${state.sex === 'female' ? 'a woman' : 'a man'}, ` : ''}${state.rank}, `
            + `${state.age} years old, ${state.house ?? 'no house behind them'}`,
        `- ${state.spiritStones} spirit stone${state.spiritStones === 1 ? '' : 's'}, ${carrying}`,
        `- ${practising}; ${body}`
    ];
}

export function composeStateSummary(input: StateSummaryInput): string {
    const { cultivator, run, ambient } = input;
    const root = getSpiritRoot(cultivator.spiritRoot);
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    const untreated = untreatedInjuryCount(cultivator.injuries);
    // The BODY's ceiling, not the rung's. A physique can finish somebody at 35
    // where their rank would allow 100, and this told the narrator the rank's
    // figure - describing a Profound Yin cultivator as having years they do not.
    const lifespan = lifespanCeilingFor(cultivator);
    const arts = input.knownTechniques ?? [];

    return [
        `Cultivator: ${cultivator.name}`,
        // The ceiling is read off the ladder rather than written out. It was
        // written out here as 44, and it had been 46 for some time.
        `Rank: ${rankName(cultivator.realmOrdinal)} (ordinal ${cultivator.realmOrdinal} of ${MAX_ORDINAL})`,
        `Spirit root: ${root.name}`,
        `Attributes: Might ${cultivator.attributes.might}, Insight ${cultivator.attributes.insight}, Fortune ${cultivator.attributes.fortune}, Charm ${cultivator.attributes.charm}`,
        // Null above the Lid, where there is no next rank and no exchange rate
        // to quote. This used to print "/ null qi-units" straight into the
        // narrator's own state summary, which is the model being handed a
        // database artifact and asked to describe it.
        required === null
            ? 'Progress: not denominated in qi at this rank, and there is no rung above to spend it on'
            : `Progress: ${Math.round(cultivator.cultivationProgress)} / ${required} qi-units to the next rank`,
        `Age ${Math.floor(cultivator.age)} of a ${lifespan}-year ceiling; ${cultivator.yearsAtCurrentRealm.toFixed(1)} years at this realm`,
        `HP ${cultivator.hp}/${cultivator.maxHp}, satiety ${cultivator.satiety}/100, ${cultivator.spiritStones} spirit stones`,
        `Untreated meridian injuries: ${untreated}`,
        `Sect: ${input.sectName ?? 'unaffiliated'}${input.sectName && input.sectRung ? ` (${input.sectRung})` : ''}`,
        `Known techniques: ${arts.length ? arts.join(', ') : 'none'}`,
        `Location: ${placeName(cultivator)}`,
        `Ambient qi: ${ambient}`,
        `Run turn ${run.turn}, day ${Math.round(run.elapsedDays)}`,
        '',
        'STANDING HERE (everybody in the square; "everyone here", "them", "the man" and '
            + 'every other pointing phrase mean these people and nobody else):',
        ...describeWhoIsHere(input.present, cultivator.realmOrdinal),
        '',
        'HAS HEARD OF (the whole of this cultivator\'s world; everything else is unheard of):',
        ...describeAwareness(input.awareness ?? [], input.said ?? ''),
        ...describeWhatIsLive(input.liveHere ?? []),
        // AND WHAT HAS A BODY HERE TO ANSWER.
        //
        // This line was missing, and everything behind it has been running
        // every single turn since it was written:
        //
        //     turn-engine.ts   withinReach: this.reachFrom(cultivator).map(...)
        //     prompt.ts:760    withinReach?: readonly ThingWithinReach[]  <- arrives
        //     prompt.ts        describeWhatIsWithinReach(...)             <- never called
        //
        // So every turn the game resolved what was reachable, asked
        // `theWordsThisPersonAnswersTo` what each person and house present
        // answers to, built the `alsoCalled` list, put it on this input - and
        // told the narrator none of it. The forms-of-address table was on the
        // same wire and died at the same boundary.
        //
        // It is the difference between a narrator that knows an elder in this
        // square can be addressed as "Elder Fang", "the elder" or "Azure Dew's
        // man" and one that only has the row.
        ...describeWhatIsWithinReach(input.withinReach ?? [])
    ].join('\n');
}


/**
 * The most people the classifier is shown by name.
 */
export const PEOPLE_NAMED_TO_THE_CLASSIFIER = 12;

/**
 * Who is in the square, for a classifier that has to bind a pointing phrase.
 */
export function describeWhoIsHere(company: Company, yourOrdinal: number): string[] {
    if (company.total === 0) {
        return ['  nobody. This cultivator is alone here, and a pointing phrase in the '
            + 'sentence refers to nothing.'];
    }

    const named = company.named.slice(0, PEOPLE_NAMED_TO_THE_CLASSIFIER);
    // NAMES ARE NOT ENOUGH. A player types "the youngest woman here" and a
    // reader shown only names has no grounds to write that target: it does not
    // know which of them is a woman and it does not know which is young. Every
    // field here is one `a-target-can-be-a-description.ts` reads back, so a
    // phrase the reader can see the grounds for is a phrase the engine can
    // resolve - and nothing in it is anything somebody standing in the square
    // could not see for themselves.
    const lines = named.map(person => [
        `  ${person.name} - ${rankName(person.ordinal)}`,
        howTheyStand(person.ordinal, yourOrdinal),
        person.sex,
        Number.isFinite(person.age) ? `about ${Math.round(person.age)}` : null,
        person.rank
    ].filter((part): part is string =>
        typeof part === 'string' && part.length > 0).join(', '));

    const unlisted = company.named.length - named.length;
    if (unlisted > 0) {
        lines.push(`  and ${unlisted} more this cultivator can name, not listed here.`);
    }

    if (company.strangers.length > 0) {
        const above = company.strangers.filter(row => row.ordinal > yourOrdinal).length;
        const below = company.strangers.filter(row => row.ordinal < yourOrdinal).length;
        const level = company.strangers.length - above - below;
        const bands = [
            above > 0 ? `${above} above them` : null,
            level > 0 ? `${level} level with them` : null,
            below > 0 ? `${below} below them` : null
        ].filter((band): band is string => band !== null);
        lines.push(`  ${company.strangers.length} more whose faces this cultivator cannot `
            + `place, so they have no name to give (${bands.join(', ')}). They are still `
            + 'here and can still be pointed at, fought, robbed or spoken to.');
    }

    lines.push(`  ${company.total} people here in total.`);
    // AND WHAT MAY BE SAID ABOUT THEM. A target is a description in this
    // engine, so the reader is told it may write one rather than being left to
    // guess whether a name is the only address it is allowed.
    lines.push(
        '  A target may be a DESCRIPTION as well as a name, and the fields above are what a '
        + 'description reads: "the youngest woman here", "the oldest man", "the one nearest to '
        + 'me", "the elder", "senior brother", "you, void refinement cultivator", "a demonic '
        + 'cultivator". Pass the phrase the player used through as the target. Do not turn a '
        + 'description into a name and do not invent one.'
    );
    return lines;
}

/** Where somebody stands relative to the cultivator reading the square. */
function howTheyStand(theirs: number, yours: number): string {
    const apart = Math.abs(theirs - yours);
    if (apart === 0) return 'level with this cultivator';
    return `${apart} ${apart === 1 ? 'rung' : 'rungs'} ${theirs > yours ? 'above' : 'below'} them`;
}

/**
 * The awareness list, one line each, with provenance.
 */
export function describeAwareness(
    rows: readonly AwarenessRow[],
    /** What the player typed. Anything they named is never cut. */
    said = ''
): string[] {
    if (rows.length === 0) {
        return ['  nothing at all. This cultivator has heard of no person, faction or place.'];
    }

    const ordered = byWhatThisTurnIsAbout(rows, said);
    const shown = ordered.slice(0, AWARENESS_SHOWN_TO_THE_CLASSIFIER);
    const lines = shown.map(row =>
        `  ${row.name} (${row.kind}; ${row.stance}, ${row.sourceKind}` +
        `${row.sourceKind === 'overheard' ? ', CANNOT BE ADMITTED TO' : ''}` +
        `${row.sourceNote ? `: ${row.sourceNote}` : ''})`
    );

    const cut = ordered.length - shown.length;
    if (cut > 0) {
        // SAID, NOT SWALLOWED. The block above this one claims to be the whole
        // of what can be named, and a silent truncation would make that claim
        // false in the one direction that costs a turn - the classifier
        // refusing to bind a name the player actually holds.
        lines.push(`  and ${cut} more this cultivator can name, not listed here. A name they `
            + 'typed is always in the list above; anything else absent from it is absent for '
            + 'room and not because they have never heard of it.');
    }
    return lines;
}

/**
 * The most rows the classifier is shown.
 *
 * This list was UNBOUNDED, and it is the one block in the prompt that grows for
 * as long as a run lasts: every person, house and place a cultivator has ever
 * heard of, each with a provenance sentence. Measured at turn one it was
 * already the largest part of the state summary, and nothing capped it.
 */
export const AWARENESS_SHOWN_TO_THE_CLASSIFIER = 40;

/**
 * Awareness in the order this turn actually needs it.
 *
 * Whatever the player named comes first and is never cut, which is what makes
 * a cap safe at all. After that, most recently learned - what somebody heard
 * about this week is what they are likeliest to be typing about, and it needs
 * no relevance model to say so.
 */
function byWhatThisTurnIsAbout(
    rows: readonly AwarenessRow[],
    said: string
): AwarenessRow[] {
    const sentence = said.toLowerCase();
    const named = (row: AwarenessRow) =>
        row.name.length >= 3 && sentence.includes(row.name.toLowerCase());
    return [...rows].sort((a, b) =>
        (named(b) ? 1 : 0) - (named(a) ? 1 : 0)
        || b.acquiredOnDay - a.acquiredOnDay
        || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Proper nouns the narrator is permitted to use, drawn only from awareness. */
export function nameableNames(rows: readonly AwarenessRow[]): string[] {
    return [...new Set(rows.map(row => row.name))].sort();
}

/**
 * Phase 1 user message.
 */
export function composeIntentUser(
    input: string,
    stateSummary: string,
    lastTurn?: string | null
): string {
    return [
        'CURRENT STATE',
        stateSummary,
        '',
        ...(lastTurn ? [lastTurn, ''] : []),
        // -- THE REMINDER GOES NEXT TO THE SENTENCE, NOT ONLY AT THE TOP --
        //
        // The system prompt carries the whole glossary and the plan rules, and
        // a large model reads them. A small local one weights what is nearest
        // the question, and measured on ollama/gemma4:26b the failure is always
        // the same shape: a three-clause sentence comes back with two steps,
        // and the clause it drops is the middle one - which is the clause the
        // other two were for.
        //
        // So the rules that actually get violated are restated immediately
        // above the player's words. Nothing new is said here; it is the same
        // contract, at the distance the model is reading from. Kept to four
        // lines on purpose - a second copy of the glossary would push the
        // sentence itself further away, which is the problem rather than the
        // fix.
        'BEFORE YOU ANSWER',
        '- Count the acts in the sentence. Answer with that many steps, in that order.',
        '- Say what was ATTEMPTED, never what succeeded. The engine decides outcomes.',
        '- Route a hostile act as the act it is: taking is steal, a blow is attack.',
        '  Never soften one into something milder, and never decline to route one.',
        '',
        'PLAYER SAID',
        input.slice(0, 1000),
        '',
        'Respond with the JSON object only.'
    ].join('\n');
}

/**
 * Phase 3 user message: this turn's scene, people, player and rulings, in that order, and the
 * instruction last because a local model weights what it read last.
 */
export function composeNarrationUser(
    facts: EngineFacts,
    scene: {
        place: string;
        ambient: AmbientQi;
        awareness?: readonly AwarenessRow[];
        /** Names the engine has decided a present character says this scene. */
        hearing?: Hearing | null;
        /** The player's literal words. Shown, never parsed for an outcome. */
        playerSaid?: string | null;
        /** Who is standing here, as the square reads them. See `thePeopleHere`. */
        company?: Company | null;
        /** The person the engine resolved this turn's act onto, by name, if any. */
        addressing?: string | null;
        /** The years before turn 0, to be written rather than summarised. */
        theLifeBehindThem?: readonly string[];
        /** For the register band only; the number itself is never sent. */
        realmOrdinal?: number;
        /** True of the world, not held by this cultivator. See `heldByTheWorldBlock`. */
        heldByTheWorldAndNotByThem?: readonly string[];
        /** What they are and hold, whatever this turn did. See `whereTheyStandNow`. */
        standing?: WhereTheyStandNow | null;
    },
    /**
     * Whether this is the first turn in this place, and whether the air is new since the last one.
     * The first turn somewhere describes it in full; every later turn there reminds the player
     * where they are in a clause. Absent means first, which is the honest default for turn 0.
     */
    told: {
        arrived?: boolean;
        ambientIsNews?: boolean;
        /** The turn before this one, as the player saw it. See `theTurnBefore`. */
        previous?: { said: string | null; shown: string } | null;
        /** Who has already voiced what is on their mind in this place. See `thePeopleHere`. */
        alreadySaid?: ReadonlySet<string>;
        /** Who has already been on the page in this place, so their picture is spent. */
        alreadyShown?: ReadonlySet<string>;
    } = {}
): string {
    const nameable = nameableNames(scene.awareness ?? []);
    const addressing = scene.addressing ?? whoThePlayerNamed(scene.playerSaid, scene.company);
    const alone = scene.company?.total === 0;
    const somebodyToPlay = !alone && (scene.company?.named.length ?? 0) > 0;
    const arrived = told.arrived ?? told.ambientIsNews ?? true;

    return [
        'THE SCENE',
        `Place: ${scene.place}`,
        `The ground: ${describeAmbientPerceived(scene.ambient)}`
            + (!arrived && told.ambientIsNews === false ? ' (Unchanged since last turn.)' : ''),
        ...(scene.standing?.dayOfTheRun === undefined
            ? []
            : [`The season: ${theSeasonOn(scene.standing.dayOfTheRun)}. The weather and the light keep to it.`]),
        '',
        ...thePeopleHere(
            scene.company, scene.realmOrdinal ?? 0, scene.awareness ?? [], addressing, told.alreadySaid,
            told.alreadyShown
        ),
        '',
        ...whereTheyStandNow(scene.standing),
        '',
        // A PERMISSION, NOT MATERIAL. Played: asked what a new disciple should do first, a
        // townsman counted this whole list off on his fingers, twenty-six names in one breath.
        'NAMES YOU MAY USE in your own narration - a permission, not material. Nobody recites or lists them:',
        nameable.length > 0
            ? nameable.join(', ')
            : '(none; this cultivator has heard of nobody and nowhere but where they stand)',
        ...spokenBlock(scene.hearing ?? null),
        ...theLifeBehindThemBlock(scene.theLifeBehindThem ?? []),
        ...heldByTheWorldBlock(scene.heldByTheWorldAndNotByThem),
        ...theTurnBefore(told.previous ?? null),
        '',
        ...(scene.playerSaid ? [`THE PLAYER SAID, WORD FOR WORD: "${scene.playerSaid}"`, ''] : []),
        'WHAT THE ENGINE RULED. Every ruling is true and must reach the page; none of its wording may.',
        ...facts.lines.map(line => `- ${line}`),
        ...(facts.required && facts.required.length > 0
            ? [
                '',
                'SAY THESE WORD FOR WORD, as the last lines of the turn, after the scene - the player has',
                'to read them exactly. Whatever they decide - a gate that stops you, a refusal, a price paid -',
                'still happens IN the scene first, played in the story\'s own words; the exact lines only',
                'close it:',
                ...facts.required.map(line => `- ${line}`)
            ]
            : []),
        '',
        'Where a ruling answers what the player asked, the answer came: never write the question',
        'hanging in the air. Where no ruling answers it, nobody in the scene supplies an answer: people',
        'talk around it or about their own affairs, and the prose never remarks on what went unsaid. Where a ruling says',
        'somebody refused, it is closed - no question left in their mouth inviting another try.',
        '',
        ...theRegisterBlock(scene.realmOrdinal),
        theTurnToWrite(scene, addressing, alone, somebodyToPlay, arrived, howTheAddressedStand(scene, addressing))
    ].join('\n');
}

/** The most of the last turn's prose handed back. Its end is what this turn continues from. */
export const THE_TURN_BEFORE_CHARS = 1500;

/**
 * The turn before, so a conversation carries over. Its END is kept when it is long, because
 * that is where the last thing somebody said is.
 */
function theTurnBefore(previous: { said: string | null; shown: string } | null): string[] {
    if (!previous) return [];
    const shown = previous.shown.length > THE_TURN_BEFORE_CHARS
        ? `...${previous.shown.slice(-THE_TURN_BEFORE_CHARS)}`
        : previous.shown;
    return [
        '',
        'THE TURN BEFORE - already happened and already read. Continue from it; do not repeat it, and',
        'let anybody who spoke remember what they said.',
        ...(previous.said ? [`The player: "${previous.said}"`] : []),
        shown
    ];
}

/** The last thing the model reads: which of the three kinds of turn this is. */
/**
 * Where the person spoken to stands against the player, when it is a realm or more either way.
 *
 * Their card already says so, in its first line. Played at Core Formation: told to kneel, a
 * man two realms down answered "without a hint of hesitation" with a rant about his father,
 * because the ruling said he answered at length and the card was forty lines up. The gap is
 * what his answer is said THROUGH, so it rides on the last instruction too.
 */
function howTheAddressedStand(
    scene: { company?: Company | null; realmOrdinal?: number },
    addressing: string | null
): string | null {
    if (!addressing) return null;
    const person = scene.company?.named.find(somebody => somebody.name === addressing);
    if (!person) return null;
    const reads = howTheyReadToYou(person.ordinal, scene.realmOrdinal ?? 0);
    return reads.startsWith('far ') || reads.startsWith('so far ') ? reads : null;
}

function theTurnToWrite(
    scene: { theLifeBehindThem?: readonly string[]; standing?: WhereTheyStandNow | null },
    addressing: string | null,
    alone: boolean,
    somebodyToPlay: boolean,
    arrived: boolean,
    addressedStands: string | null = null
): string {
    const opening = scene.theLifeBehindThem && scene.theLifeBehindThem.length > 0;
    const setting = arrived
        ? 'The player has just arrived here, so open by describing the place in full: what it looks, '
            + 'sounds and smells like, what the ground and the weather are doing, who is about and what '
            + 'they are at. Several sentences.'
        : 'They have been here since last turn, so open with a brief reminder of where they are - a '
            + 'clause or a sentence, no more.';
    const who = opening
        ? 'Write the opening: the years first, then the place they are standing in now, and the people '
            + 'in it doing what their cards say.'
        : addressing
            ? `${setting} Then play ${addressing}: their answer, in their voice.`
                + (addressedStands
                    ? ` They stand ${addressedStands}: whatever the rulings have them say, they say it that way.`
                    : '')
                + ' Anybody else here may react too.'
            : alone
                ? `${setting} Then the player's act and what it does. Nobody is here to answer.`
                : somebodyToPlay
                    ? `${setting} Then the player's act and whoever it lands on. Said aloud to the room, `
                        + 'whoever is likeliest to answer does, each in their own voice; anything else, one '
                        + 'or two people react at most, and the rest are left out rather than listed carrying on.'
                    : `${setting} Then the player's act, and the crowd.`;
    // LAST, BECAUSE THIS MODEL WEIGHTS WHAT IT READ LAST. Played on gemma4:31b, both of these held
    // as rules higher up and broke anyway: "neither of them speaks" on nearly half of all turns, and
    // a run the engine ruled went nowhere narrated as an escape from town.
    return `NOW WRITE THE TURN. ${who} Present tense, "you" for the player. Keep every ruling - a `
        + 'blow in the rulings lands on the page, even on a turn the player spent looking or talking; '
        + 'add no outcome; reuse none of the clerk\'s wording. If a ruling says the location is '
        + 'unchanged or no time passed, the player went nowhere. Write what people do, never what '
        + 'they do not do or do not say: whoever has no part in this moment is left out. Never end '
        + 'on a list of what the player could do.'
        + (scene.standing?.dead
            ? ' THE PLAYER DIED THIS TURN. Their death is the last thing that happens: write it plainly, '
                + 'in the body, and end there. Nothing after it, and nothing about mending or what comes next.'
            : '');
}

/**
 * The opening, which is the one turn with a life behind it.
 *
 * Filed as a ruling as well, so a player with no model still reads their own past; this asks for
 * the same years as a life somebody lived. Handed to the narrator alone, turn 0 once came back as
 * the square and nothing else.
 */
function theLifeBehindThemBlock(life: readonly string[]): string[] {
    if (life.length === 0) return [];
    return [
        '',
        'THE LIFE BEHIND THIS CULTIVATOR. This is the first turn of the run, and the only one with',
        'sixteen years behind it. OPEN BY WRITING THOSE YEARS - the household, the ground that raised',
        'them, the faces they have known since before anybody was anybody, what they were told about',
        'the world and by whom - as short paragraphs of a life, not a summary. Invent no parent,',
        'sibling, teacher, master, parting or promise: every person and event in the life is below,',
        'and somebody on a card is part of it only as these lines say. Then bring them to where they',
        'are standing now, described in full.',
        ...life.map(line => `- ${line}`)
    ];
}

/**
 * FACTS THE WORLD HOLDS AND THIS CULTIVATOR DOES NOT.
 *
 * Dramatic irony: the reader may be shown them as a cutaway, and the character never perceives
 * one. What the character knows gates verbs in `knowledge.ts` and nothing written here adds to it.
 */
function heldByTheWorldBlock(held: readonly string[] | undefined): string[] {
    if (!held || held.length === 0) return [];
    return [
        '',
        'HELD BY THE WORLD, NOT BY THE PLAYER. True, and not theirs. You may show one to the reader as a',
        'cutaway - somebody else, somewhere else, a sentence or two - and never as something the player',
        'notices, is told, works out or acts on:',
        ...held.map(line => `- ${line}`)
    ];
}

/** Which register band this turn is in. The band name only: the rung is never sent. */
function theRegisterBlock(realmOrdinal: number | undefined): string[] {
    if (realmOrdinal === undefined) return [];
    return [
        `THE REGISTER FOR THIS TURN: ${theRegisterAtThisHeight(realmOrdinal)}. That is the heading of a`,
        'section above; write in the register it describes. Do not state the rung.',
        'THE PARAGRAPH IS THE PART THAT MOVES, and at the bottom it is the expansive one: take the room.',
        'THE SENTENCE DOES NOT CHANGE AND MUST NOT: short and plain, a person or a thing as its subject.',
        ''
    ];
}

/** The dialogue-only name licence. */
function spokenBlock(hearing: Hearing | null): string[] {
    if (!hearing || hearing.names.length === 0) return [];
    const listed = hearing.names.map((name: SpeakableName) => name.name).join(', ');
    return hearing.mode === 'overheard'
        ? [
            '',
            `SPOKEN HERE, OVERHEARD: ${listed}. Two people talking past a wall, not to the player and not`,
            'aware of them. These names appear only inside what they say, mid-conversation, assuming',
            'everything, and are never explained afterwards.'
        ]
        : [
            '',
            `SPOKEN HERE${hearing.speaker ? ` by ${hearing.speaker}` : ''}: ${listed}. These names appear only`,
            'inside dialogue, said flatly as though everybody knows them. Never in your description,',
            'never explained - not what it is, where it is, or why anybody goes there - never given',
            'weight, and never the answer to what the player asked unless a ruling makes it one.'
        ];
}
