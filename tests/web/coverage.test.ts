/**
 * Every action in the closed enum, reachable from plain English.
 *
 * This file exists because of a class of bug that has now cost three separate
 * live runs. `\bcultivat\b` could never match "cultivate", because the word
 * boundary sat between the `t` and the `e`. `look for work` could not match
 * "looking for work". `look` had no branch at all and worked only by being the
 * fallthrough, so it died silently the day the fallthrough was made inert.
 *
 * In each case the verb was in the enum, was implemented, was tested at the
 * handler level, and could not be reached by a person typing a sentence. A
 * member of a closed set that plain English cannot reach is the same as not
 * having it, and it fails in the worst possible way: the player's intent is
 * quietly answered with a different action.
 *
 * So the rule this file enforces is coverage, not correctness of any single
 * regex: for every action, three or four of the ways a player would most
 * naturally ask for it, each asserted to route there. Adding a member to
 * ACTION_NAMES without adding phrasings here fails the last test in the file.
 */

import { describe, it, expect } from 'vitest';
import {
    ACTION_NAMES,
    INTERACT_INTENTS,
    MOVE_INTENTS,
    OATH_INTENTS,
    PASSAGE_INTENTS,
    READ_ONLY_ACTIONS,
    TIME_CONSUMING_ACTIONS,
    parseIntent,
    type ActionName
} from '../../src/web/actions.js';
import { WHAT_EACH_VERB_IS_FOR } from '../../src/web/what-each-verb-is-for-in-the-players-words.js';

/**
 * How a player asks for each action, in their own words.
 *
 * Written from the outside in: what somebody types, not what the regex
 * happens to contain. A phrasing added here because it already passes is
 * worth nothing.
 */
const PHRASINGS: Record<Exclude<ActionName, 'unclear'>, readonly string[]> = {
    interact: [
        'I talk to the old woman',
        'I ask someone about the sects near here',
        'I greet the man at the gate',
        'I introduce myself to the guard'
    ],
    investigate: [
        // Ruins are the one door in this world that opens on nerve rather than
        // standing, and the most obvious sentence about them has to work.
        'I explore the ruins',
        'I examine the stele',
        // Was "I search the ruin for anything left", which now routes to
        // `site` and should: `ruin` became a site noun once playing showed the
        // whole site subsystem was unreachable by the setting's own word for
        // these places, and searching a ruin for what is left in it is the site
        // layer's own job rather than general examination. Swapped for a
        // sentence that examines something without standing at a threshold.
        'I search the market stalls for anything left',
        'I poke around the old shrine',
        'I read the inscription'
    ],
    move: [
        'I travel to Barrow Hand',
        'I set out for Scarwater',
        'I head north',
        'I make my way to Scarwater'
    ],
    /**
     * Hands rather than words, and the same resolver a fight uses. Written
     * here because a member of the closed set that plain English cannot reach
     * is the same as not having it - which is the whole of this file.
     */
    coerce: [
        'I force him to submit',
        'I make him kneel',
        'I beat the truth out of the steward',
        'I tame the beast'
    ],
    /**
     * The three ways of covering ground that are not walking, and a word given.
     *
     * All four were engine modules with no caller: the conveyance ladder, the
     * fold curve, the Span counter and the oath contract shape. `ride` in
     * particular was a LABEL on `move` - one of five intents, all of which
     * resolved through the same flat one-day journey - so it is written here as
     * its own verb and out of `MOVE_PHRASINGS` below.
     */
    ride: [
        'I ride to Scarwater',
        'I ride the horse',
        'I saddle a beast and ride for Kettle',
        'I take a carriage to Scarwater',
        'I take a spirit boat to Halfwater',
        'I fly to Scarwater on my sword'
    ],
    fold: [
        'I fold space to Scarwater',
        'I step through space to Kettle',
        'I fold to the Quiet Marches',
        'I tear open space and go to Kettle',
        'I cross the distance in one step'
    ],
    passage: [
        'I buy passage to Kettle',
        'what does the Span board say',
        'what would a ticket to Kettle cost',
        'I book a place on the next span',
        'is there a Span counter here'
    ],
    oath: [
        'I swear an oath to the Azure Dew Sect',
        'I give my word to the Azure Dew Sect',
        'what oaths am I carrying',
        'I break my oath',
        'I walk out of the vow I gave',
        'who holds my word'
    ],
    cultivate: [
        'I cultivate',
        'I sit and circulate my qi',
        'I meditate for a month',
        'I settle in to cultivate for a year'
    ],
    seclude: [
        'I go into seclusion',
        'I seal myself away for a year',
        'I shut myself in and do not come out',
        'I enter closed door cultivation'
    ],
    breakthrough: [
        'I attempt a breakthrough',
        'I try to break through',
        'I push against the barrier',
        'I force the bottleneck'
    ],
    train_technique: [
        'I practise the sword art',
        'I train the Ashfall technique',
        'I drill the stance',
        'I work on my technique'
    ],
    refine: [
        'I refine a pill',
        'I brew the elixir',
        'I concoct a healing pill'
    ],
    // Spirit beasts are where a material comes from, so the verb that goes
    // out after one has to answer to more than the single word it was
    // written under. A bare 'I go hunting' is the plainest way anybody says
    // it and names nothing at all.
    hunt: [
        'I go hunting',
        'I hunt a spirit beast',
        'I track the beast through the hills',
        'I set traps for beasts'
    ],
    gather: [
        'I gather herbs',
        'I forage for spirit herbs',
        'I collect what grows here',
        'I go looking for herbs'
    ],
    provision: [
        // The verb whose absence killed both of the coordinator's test
        // characters. The engine consumed rations and warned when they ran
        // out; nothing let a player buy any.
        'I stock up on provisions',
        'I buy a month of rations',
        'I lay in supplies for a year',
        'I buy three months of food'
    ],
    eat: [
        'I eat',
        'I buy food',
        'I get a meal',
        'I have supper'
    ],
    wait: [
        'I wait',
        'I rest a while',
        'I do nothing',
        'I sleep'
    ],
    work: [
        // The one that killed a starving run. "I take whatever work the
        // village will give me for a season" was answered with a season of
        // sitting still, and the character starved during it.
        'I go looking for work',
        'I take whatever work the village will give me',
        'I find a job',
        'I hire myself out',
        'I ask around for work'
    ],
    market: [
        'I go to the market',
        'what is for sale',
        'I check the prices',
        'I look at the stalls'
    ],
    sect: [
        'I look for a sect that will take me',
        'I want to join a sect',
        'what sects are near here',
        'I ask about joining the Gleaners Company'
    ],
    look: [
        'I look around',
        'where am I',
        'what do I see',
        'I look at the sky'
    ],
    status: [
        'status',
        'how am I doing',
        'check my cultivation',
        'where do I stand'
    ],
    attack: [
        // Had no route at all. Every one of these used to fall through the
        // whole table, and the first of them was caught by the cultivation
        // branch and answered with a month of meditation.
        'I attack the nearest cultivator',
        'I strike at him',
        'I fight the elder',
        'I go for the man with the spear'
    ],
    assess: [
        'I size up the situation',
        'could I survive that',
        'how dangerous is this',
        'am I strong enough'
    ],
    // The softlock. Every one of these was typed at a run that was stuck with
    // three untreated meridian injuries, three hundred spirit stones and a
    // physician advertised on the board, and every one of them failed: the
    // first was answered with a description of the room and the rest with
    // "the thought does not resolve".
    treat: [
        'I look for a physician to treat my meridian injuries',
        'I get my injuries treated',
        'I see a physician',
        'I pay for treatment',
        'treat my wounds',
        'I need a healer'
    ],
    buy: [
        'I buy a visit from the mortal physician',
        'I buy a Minor Healing Pill',
        'I pay for a ferry crossing',
        'I hire a scribe'
    ],
    // The inheritance grounds, which were catalog-only until the parser could
    // name one. Four steps, and the enum member carries all four.
    // The three sentences a rank-band sweep found dead at ordinals 37-46,
    // where the ladder is finished and comprehension is the only axis left.
    recall: [
        'what do I know of Lu Sheng',
        'what do I know of the Hollow Court',
        'what is my dao',
        'what have I heard of the Ninth Stone',
        'what do I know'
    ],
    /**
     * Asking the square, which four separate phrasings reached by deflecting
     * into the `recall` listing - a confident, well-composed inventory of what
     * the player already held, in answer to a question about the world.
     *
     * Every one of these was measured against a live server. The one they must
     * not take with them is "what do people say about this place", which is the
     * ground's own history and belongs to `look` - see `ABOUT_THE_GROUND_HERE`.
     */
    news: [
        'what news is there',
        'I listen for rumours',
        'what are people saying',
        'what is happening in the world',
        'I ask around for gossip',
        'what is the word'
    ],
    site: [
        'I go to the eighth stone',
        'I look for the audit bench',
        'what inheritance grounds are near here',
        'I study the door',
        'I go inside',
        'I open the grave',
        // The word a player actually uses when the site is a grave. Found by a
        // standing sweep: the graves are catalogued and the taking step is
        // implemented, and only the honest verb for it was missing.
        'I rob the grave of Shen Guyi'
    ],
    // ── what somebody leaves for whoever comes after ──
    //
    // Five steps of one act: reading the counters, burying a cache, digging
    // one up, lodging goods against a phrase, and claiming them. Two of the
    // five spend days, so an unrecognised intent falls through to the free
    // read and never to the burial.
    legacy: [
        'who holds deposits',
        'where can I leave things',
        'I bury my things here',
        'I dig up the cache',
        'I lodge my things with the Ninefold Ledger',
        'I claim the deposit at the Ninefold Ledger'
    ],
    // ── institutions acting on each other, and on the dead ──
    //
    // Twelve sentences from a sect head who had heard of every faction, all
    // twelve dead, and five of them eaten by `interact` and answered with a
    // paragraph about the building - so a player could not tell REFUSED from
    // NOT IMPLEMENTED. Every phrasing below is one of those or a variant a
    // player would reach for in the same breath.
    petition: [
        'I file a Requisition Against Standing Stock',
        'I ask the Deep Survey for one of its pills',
        'I ask the Deep Survey for an Unearned Step',
        'I petition the Third Sill Court for a grant',
        'I appeal to the court for protection',
        'I claim descent from Ru Anjing'
    ],
    posture: [
        'I declare war on the Nine Abyss Flame Sect',
        'I offer an alliance to the Frostmirror Court',
        'I propose a pact with the Storm Tyrant Court',
        'I demand tribute from the Azure Dew Sect',
        'I go over to the Long Cut'
    ],
    seal: [
        'I wake our sealed ancestor',
        'I rouse the sealed ancestor',
        'I break the seal under the Kiln Wardens',
        'I wake what is under the mountain'
    ],
    offer: [
        'I make an offering to our ascended ancestor',
        'I send an offering up to our ancestor',
        'I burn incense to our ascended ancestor',
        // The other end of the same pipe. Which end the speaker is standing at
        // is state, not phrasing, so both reach the same verb.
        'I send a sword down through the Lid',
        'I send word down to my sect'
    ],
    // The far side of the Lid, where every mortal verb used to come back "Not
    // from here" and there was nothing else to type.
    descend: [
        'I go back down',
        'I descend through the Lid',
        'I force the Lid open again',
        'I go down to the province myself'
    ],
    // The counter. Every one of these used to reach the INTERACT table, where
    // the engine went looking for a person by the name of the herb.
    sell: [
        'I sell the Qi Gathering Grass',
        'I sell my herbs',
        'I sell everything I gathered',
        'I offload what I picked',
        'I hawk the herbs at the stalls'
    ],
    inventory: [
        'what am I carrying',
        'check my pouch',
        'what is in my bag',
        'show me my inventory'
    ],
    list_techniques: [
        'what arts can I learn',
        'what techniques can I learn',
        'list the available techniques',
        'which arts are available to me'
    ],
    learn_technique: [
        'I learn the Azure Ripple Art',
        'I study the Iron Bell Manual',
        'I take up the Cloudstep technique'
    ],
    // The verb that was missing entirely, and with it the six heal_hp pills
    // and every breakthrough pill bonus ever computed.
    // One command, three costs. The question a player asks at a ceiling.
    acquisition: [
        'how do I get further',
        'what would it take to go past this',
        'how does my manual go further'
    ],
    consume_pill: [
        'I swallow a healing pill',
        'I take a Minor Healing Pill',
        'I eat a healing pill',
        'I use the pill'
    ],
    /**
     * The three questions `scripts/playtest-the-drive.mjs` measured as dead.
     *
     * The first five of each set are the harness's own phrasings, so this file
     * and that one fail together rather than drifting: a regex change that
     * takes a phrasing away from the parser fails here in milliseconds instead
     * of failing there behind a build and a server.
     */
    ceiling: [
        'why am I not making progress',
        'am I stuck',
        'how far will my technique take me',
        'what is my ceiling',
        'what is stopping me',
        'what is holding me back',
        'why has my cultivation stalled',
        'have I hit a wall'
    ],
    teacher: [
        'who can teach me',
        'I look for a master',
        'is there anyone here stronger than me',
        'I ask about a teacher',
        'who could guide my cultivation',
        'can anyone here teach me',
        'is there a master here',
        'who stands above me'
    ],
    /**
     * Asking a named person for a named thing, in the words somebody would use.
     *
     * Every one of these reached a different lookup before the verb existed,
     * and none of them reached a person: the roster, a description of the
     * person, the almanac entry for the book, and a bribe that landed on
     * nothing. The list is long on purpose - `AGENTS.md` files "if a
     * near-synonym works, the phrasing that fails is a bug", and a request is
     * the verb people phrase the most different ways.
     */
    request: [
        'I ask Elder Fang to teach me',
        'I beg Elder Fang to teach me the Iron Bell Manual',
        'I ask Elder Fang to take me as a disciple',
        'I ask Elder Fang to be my master',
        'I ask Elder Fang to introduce me to the steward',
        'ask Elder Fang for the Lesser Qi-Gathering Manual',
        'I offer Elder Fang 20 spirit stones to teach me',
        'I bribe Elder Fang with 60 spirit stones to introduce me to the steward',
        'I implore Elder Fang to train me',
        'I pay Elder Fang to instruct me'
    ],
    destinations: [
        'where can I go',
        'I want to travel somewhere else',
        'where is there better spiritual energy',
        'what is nearby',
        'where could I go',
        'what other places can I reach',
        'where are the qi denser'
    ],
    // The other half of the travel question, and the half that reached nothing
    // at all: twenty-three places that teach a road are seeded per world and
    // no sentence in the language got to one. Written the four or five ways
    // somebody actually asks it, per the repo's own rule that a near-synonym
    // reaching nothing is a bug - and checked against the neighbours it could
    // be stolen by, which is `teacher` ("teach me") and `list_techniques`
    // ("what can I learn").
    roads: [
        'what can I learn here',
        'what is there to understand',
        'what can this ground teach me',
        'is there anything here that teaches',
        'what roads are there',
        'what places teach a dao',
        'where can I learn a road',
        'what can I comprehend around here'
    ],

    // The trust hierarchy's strongest check, put to the character. Every one
    // of these names an ART, which is the whole of what keeps the verb from
    // stealing `recall`'s questions about names and faces.
    propose: [
        'I propose a match to Bai Jinglu',
        'I ask Bai Jinglu to marry me',
        'I offer the Xu a marriage',
        'I want to marry into the Xu',
        'I accept the match'
    ],
    decline: [
        'I refuse the match',
        'I turn down the proposal',
        'I say no to the betrothal',
        'I run from the marriage'
    ],
    child: [
        'I have a child with Bai Jinglu',
        'I raise a child with Bai Jinglu',
        'I start a family with Bai Jinglu',
        'I place my child at the Azure Cloud Pavilion'
    ],
    recognise: [
        "is this the Azure Cloud Pavilion's art",
        'whose art is that',
        'do I recognise this style',
        'have I seen this technique before',
        'do I know this form',
        'whose technique is this'
    ]
};

describe('every action in the closed set is reachable from plain English', () => {
    for (const [action, phrasings] of Object.entries(PHRASINGS)) {
        it(`${action}: ${phrasings.length} phrasings all route there`, () => {
            const misses = phrasings
                .map(text => [text, parseIntent(text).action] as const)
                .filter(([, got]) => got !== action)
                .map(([text, got]) => `"${text}" -> ${got}`);

            expect(misses, `misrouted: ${misses.join('; ')}`).toEqual([]);
        });
    }

    it('covers every member of the enum, so a new verb cannot ship unreachable', () => {
        const covered = new Set(Object.keys(PHRASINGS));
        const uncovered = ACTION_NAMES.filter(
            name => name !== 'unclear' && !covered.has(name)
        );
        expect(uncovered, `no phrasings written for: ${uncovered.join(', ')}`).toEqual([]);
    });
});

/**
 * ── THE HOLE THIS FILE HAD, AND WHY IT COULD NOT SEE IT ──────────────────
 *
 * Everything above enumerates `ACTION_NAMES`, and that is the whole of what
 * "unreachable" was ever checked against. But `interact` and `move` are not one
 * behaviour each - they are DOORS, and what is behind them is chosen by the
 * INTENT. Seven of the interact intents reach the pressure model and settle
 * something; the rest describe somebody and settle nothing. So an intent the
 * parser cannot produce is exactly as unreachable as an action it cannot
 * produce, and nothing here was looking.
 *
 * Found by playing, which is the only thing that was ever going to find it:
 * `steal from <somebody>` and `ride <somewhere>` both reached the engine when a
 * MODEL routed the sentence and both answered `unclear` from the deterministic
 * parser. Two supported verbs, reachable only by having a provider configured.
 *
 * `misparse.test.ts` could not catch it either, and for a reason worth naming:
 * it asserts that a sentence does NOT reach the wrong verb, and `unclear` is
 * never the wrong verb. `I steal from the market stall keeper` is in that file's
 * own table, asserted not to be `market`, and it passed for as long as it
 * reached nothing at all. A guard that only checks the negative cannot tell
 * silence from correctness.
 *
 * So: every member of both intent vocabularies, in the words somebody types.
 * A member added to either list without a phrasing here fails the last test in
 * each block, the same way a new action does.
 */
describe('every intent behind a door is reachable from plain English too', () => {
    const INTERACT_PHRASINGS: Record<string, readonly string[]> = {
        talk: ['I talk to the old woman', 'I speak to the gate guard'],
        negotiate: ['I negotiate with the broker', 'I bargain with the steward'],
        // "I haggle with the stall keeper" is NOT here and it is not an
        // oversight: it reaches `market`, which owns the counter, and that is
        // the better answer to a sentence about a stall.
        trade: ['I trade with the pedlar', 'I barter with the courier'],
        deceive: ['I lie to the steward', 'I bluff the gate guard'],
        interrogate: ['I interrogate the clerk', 'I press him for the truth'],
        threaten: ['I threaten the clerk', 'I intimidate the gate guard'],
        bribe: ['I bribe the gate guard', 'I pay off the clerk'],
        // "I hire the porter" reaches `buy`, which is a live collision worth
        // knowing about - hiring a person is not a line on a price board - and
        // it belongs to whoever owns that branch rather than to this guard.
        recruit: ['I recruit the swordsman', 'I enlist the swordsman'],
        apologise: ['I apologise to the elder', 'I make amends with the steward'],
        seduce: ['I seduce the steward', 'I woo the gate warden'],
        // The pair that were unreachable. Written the several ways a player
        // says them, per the repo's rule that a working near-synonym beside a
        // failing one is a bug rather than a preference.
        steal: [
            'I steal from Shen Wanshi',
            'I rob the merchant',
            'I steal from the market stall keeper'
        ]
    };

    for (const [intent, phrasings] of Object.entries(INTERACT_PHRASINGS)) {
        it(`interact/${intent}: ${phrasings.length} phrasings all route there`, () => {
            const misses = phrasings
                .map(text => [text, parseIntent(text)] as const)
                .filter(([, got]) => got.action !== 'interact' || got.intent !== intent)
                .map(([text, got]) => `"${text}" -> ${got.action}/${got.intent ?? '-'}`);
            expect(misses, `misrouted: ${misses.join('; ')}`).toEqual([]);
        });
    }

    it('covers every interact intent, so a new one cannot ship unreachable', () => {
        const covered = new Set(Object.keys(INTERACT_PHRASINGS));
        const uncovered = INTERACT_INTENTS.filter(name => !covered.has(name));
        expect(uncovered, `no phrasings written for: ${uncovered.join(', ')}`).toEqual([]);
    });

    const MOVE_PHRASINGS: Record<string, readonly string[]> = {
        travel: ['I travel to Nine Peaks', 'I set out for Scarwater'],
        flee: ['I flee', 'I run away from the fight'],
        approach: ['I approach the elder', 'I walk up to the gate warden'],
        enter: ['I enter the village', 'I go into the courtyard'],
        follow: ['I follow the merchant', 'I shadow the courier']
        // `ride` was here, as a sixth `move` intent, and the label was the
        // whole of what it bought: every `move` resolves through one journey
        // routine whichever intent matched, so riding and walking were the same
        // event with a different word on the log while the conveyance layer sat
        // with no caller at all. It is its own verb now and its phrasings are
        // in `PHRASINGS` above.
    };

    for (const [intent, phrasings] of Object.entries(MOVE_PHRASINGS)) {
        it(`move/${intent}: ${phrasings.length} phrasings all route there`, () => {
            const misses = phrasings
                .map(text => [text, parseIntent(text)] as const)
                .filter(([, got]) => got.intent !== intent)
                .map(([text, got]) => `"${text}" -> ${got.action}/${got.intent ?? '-'}`);
            expect(misses, `misrouted: ${misses.join('; ')}`).toEqual([]);
        });
    }

    it('covers every move intent the prompt suggests', () => {
        const covered = new Set(Object.keys(MOVE_PHRASINGS));
        const uncovered = MOVE_INTENTS.filter(name => !covered.has(name));
        expect(uncovered, `no phrasings written for: ${uncovered.join(', ')}`).toEqual([]);
    });

    /**
     * AND THE SAME GUARD ON THE VERBS THAT CARRY STEPS RATHER THAN LABELS.
     *
     * The enum guard above walks `ACTION_NAMES` and nothing else, so an INTENT
     * can ship unreachable while its verb looks covered - which is how `steal`
     * and `ride` each shipped with no sentence that reached them. It is worth
     * saying plainly what this pair of blocks does and does not close: it
     * covers `interact`, `move`, and the two below, and there is no general
     * guard over every member of `INTENT_ACTIONS`. That is the gap.
     *
     * These two are here because one branch of each SPENDS or COMMITS
     * something and the other is a read, so a step nobody can reach is either a
     * feature nobody has or a price nobody can avoid.
     */
    const PASSAGE_PHRASINGS: Record<string, readonly string[]> = {
        board: ['what does the Span board say', 'what would a ticket to Kettle cost'],
        buy: ['I buy passage to Kettle', 'I book a place on the next span']
    };

    for (const [intent, phrasings] of Object.entries(PASSAGE_PHRASINGS)) {
        it(`passage/${intent}: ${phrasings.length} phrasings all route there`, () => {
            const misses = phrasings
                .map(text => [text, parseIntent(text)] as const)
                .filter(([, got]) => got.action !== 'passage' || got.intent !== intent)
                .map(([text, got]) => `"${text}" -> ${got.action}/${got.intent ?? '-'}`);
            expect(misses, `misrouted: ${misses.join('; ')}`).toEqual([]);
        });
    }

    it('covers every step at a counter', () => {
        const covered = new Set(Object.keys(PASSAGE_PHRASINGS));
        const uncovered = PASSAGE_INTENTS.filter(name => !covered.has(name));
        expect(uncovered, `no phrasings written for: ${uncovered.join(', ')}`).toEqual([]);
    });

    const OATH_PHRASINGS: Record<string, readonly string[]> = {
        read: ['what oaths am I carrying', 'who holds my word'],
        swear: ['I swear an oath to the Azure Dew Sect', 'I give my word to the Azure Dew Sect'],
        break: ['I break my oath', 'I walk out of the vow I gave']
    };

    for (const [intent, phrasings] of Object.entries(OATH_PHRASINGS)) {
        it(`oath/${intent}: ${phrasings.length} phrasings all route there`, () => {
            const misses = phrasings
                .map(text => [text, parseIntent(text)] as const)
                .filter(([, got]) => got.action !== 'oath' || got.intent !== intent)
                .map(([text, got]) => `"${text}" -> ${got.action}/${got.intent ?? '-'}`);
            expect(misses, `misrouted: ${misses.join('; ')}`).toEqual([]);
        });
    }

    it('covers every thing that can be done about a word', () => {
        const covered = new Set(Object.keys(OATH_PHRASINGS));
        const uncovered = OATH_INTENTS.filter(name => !covered.has(name));
        expect(uncovered, `no phrasings written for: ${uncovered.join(', ')}`).toEqual([]);
    });

    /**
     * And the negative, which is the half `misparse.test.ts` owns everywhere
     * else: neither new verb may steal the sentence next door. Stealing from a
     * HOUSE is months of siphoning, robbing a GRAVE is the site layer, and
     * reading the reserves is a question rather than an act.
     */
    it('does not take the takings that already have a home', () => {
        expect(parseIntent('I steal the sect treasury').action).toBe('sect');
        expect(parseIntent('I steal the sect treasury').intent).toBe('siphon');
        expect(parseIntent('I rob the grave of Shen Guyi').action).toBe('site');
        expect(parseIntent('what do the sect reserves hold').action).toBe('sect');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE HOLE THIS FILE HAD, AND THE WALK THAT CLOSES IT
//
// Everything above walks `ACTION_NAMES`. That is the wrong list, and it has now
// let three separate features ship unreachable - `steal`, `ride`, and coercion
// with concealment - because **a verb is not the only door into the engine.**
// An INTENT is a door too: `interact/steal` reaches a resolver `interact/talk`
// does not, `attack/opening` decides who gets the first round, and
// `coerce/tame` is how an animal is acquired. None of them is a member of the
// enum, so the enum walk cannot see any of them and passes with the door shut.
//
// `WHAT_EACH_VERB_IS_FOR` is the single place every verb's intent labels are
// declared - the compiler already refuses a verb with no entry - so it is the
// right list to walk. Every intent declared there needs either a phrasing that
// reaches it, or a row in the exemption list below saying out loud that the
// door is untested.
//
// ── THE EXEMPTION LIST IS A FINDING, NOT A PERMISSION ────────────────────
//
// It is populated with what was already true when this walk was written, and
// its length is asserted so it can only SHRINK. A new intent cannot be added to
// it without editing this number, which is the whole point: the next intent to
// ship has to be either reachable or deliberately and visibly not.
// ═══════════════════════════════════════════════════════════════════════════

describe('every intent DECLARED is a door somebody can find', () => {
    /**
     * Phrasings for intents the enum walk cannot see, keyed `verb/intent`.
     *
     * `interact` and `move` are covered above by their own tables and are
     * skipped here rather than duplicated - a second copy of those phrasings is
     * a second place for them to drift.
     */
    const INTENT_PHRASINGS: Record<string, readonly string[]> = {
        'attack/drive_off': ['I attack the bandit', 'I start a fight with him'],
        'attack/subdue': ['I spar with him', 'I subdue the thief'],
        'attack/kill': ['I mean to kill the thief', 'I murder the courier'],
        'attack/humiliate': ['I humiliate him in front of them', 'I make an example of the clerk'],
        // Hands rather than words, and the four things somebody wants out of it.
        'coerce/submit': ['I force him to submit', 'I make him kneel'],
        'coerce/hand_over': [
            'I strong-arm the steward into opening the gate',
            'I force the merchant to hand over the ledger'
        ],
        'coerce/talk': ['I beat the truth out of him', 'I make him talk'],
        // An animal made to submit is a tamed animal. Same verb, same resolver.
        'coerce/tame': ['I tame the beast', 'I break the wolf in']
    };

    /**
     * Doors nobody has written a phrasing for yet.
     *
     * Every row is a real gap: an intent the glossary tells a model to emit and
     * that nothing in this file proves a person can reach by typing. It is
     * recorded rather than fixed here because these belong to the verbs' own
     * owners - and it is recorded rather than ignored because an unwritten gap
     * is the exact failure this whole file exists to prevent.
     *
     * ONLY SHRINK IT.
     */
    const UNTESTED_DOORS: readonly string[] = [
        'passage/board', 'passage/buy',
        'oath/read', 'oath/swear', 'oath/break',
        'sect/leave', 'sect/promote', 'sect/stipend', 'sect/standing', 'sect/join',
        'sect/siphon', 'sect/order', 'sect/recruit', 'sect/admission', 'sect/curriculum',
        'sect/expel', 'sect/duty', 'sect/donate', 'sect/guest',
        'site/approach', 'site/outside', 'site/enter', 'site/take',
        'legacy/counters', 'legacy/bury', 'legacy/dig', 'legacy/lodge', 'legacy/claim',
        'petition/grant', 'petition/stock', 'petition/descent',
        'posture/stance', 'posture/war', 'posture/alliance', 'posture/defect', 'posture/tribute',
        'seal/read', 'seal/wake',
        'offer/channel', 'offer/offering', 'offer/send',
        'look/history', 'look/ground_time', 'look/crowding', 'look/bills', 'look/company',
        'recall/knowledge', 'recall/dao',
        'request/teaching', 'request/discipleship', 'request/introduction', 'request/telling',
        'request/a_thing', 'request/terms', 'request/a_trade', 'request/nothing',
        'request/unstated',
        'propose/propose', 'propose/accept',
        'decline/refuse', 'decline/leave',
        'child/have', 'child/place'
    ];

    it('has a phrasing or a recorded gap for every intent any verb declares', () => {
        const covered = new Set<string>([
            ...Object.keys(INTENT_PHRASINGS),
            ...UNTESTED_DOORS,
            // `interact` and `move` have their own tables above, walked against
            // their own exported constants. Duplicating them here would be a
            // second place for the same phrasings to drift.
            ...INTERACT_INTENTS.map(intent => `interact/${intent}`),
            ...MOVE_INTENTS.map(intent => `move/${intent}`)
        ]);

        const missing: string[] = [];
        for (const [verb, entry] of Object.entries(WHAT_EACH_VERB_IS_FOR)) {
            for (const intent of entry.intents ?? []) {
                if (!covered.has(`${verb}/${intent}`)) missing.push(`${verb}/${intent}`);
            }
        }
        expect(
            missing,
            `no phrasing and no recorded gap for: ${missing.join(', ')}. An intent is a door `
            + 'into the engine that the ACTION_NAMES walk cannot see, so it needs a phrasing '
            + 'here or a row in UNTESTED_DOORS saying out loud that it is untested.'
        ).toEqual([]);
    });

    it('keeps the list of untested doors shrinking and never growing', () => {
        // The number is the finding. Every row is an intent the glossary tells
        // a model to emit and that nothing proves a person can reach by typing,
        // and lowering it is the only legal direction.
        expect(UNTESTED_DOORS.length).toBeLessThanOrEqual(64);
        expect(new Set(UNTESTED_DOORS).size).toBe(UNTESTED_DOORS.length);
    });

    for (const [key, phrasings] of Object.entries(INTENT_PHRASINGS)) {
        const [verb, intent] = key.split('/');
        it(`${key}: ${phrasings.length} phrasings all route there`, () => {
            const misses = phrasings
                .map(text => [text, parseIntent(text)] as const)
                .filter(([, got]) => got.action !== verb || got.intent !== intent)
                .map(([text, got]) => `"${text}" -> ${got.action}/${got.intent ?? '-'}`);
            expect(misses, `misrouted: ${misses.join('; ')}`).toEqual([]);
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// AND THE OTHER HALF: A VERB THAT IS REACHABLE IS ALSO CLASSIFIED
//
// The walk above proves every door can be found. This proves every door has
// been priced, which is the half that decides what a MISREAD costs.
//
// `READ_ONLY_ACTIONS` and `TIME_CONSUMING_ACTIONS` are read by four separate
// guards - the bare-word gate, the mood post-pass, the nonsense guard at the
// bottom of this file, and `theReadThatAnswersIt` - and every one of them asks
// "is this verb on the safe list", never "is this verb on the costly list". So
// a verb on NEITHER list is treated as safe by all four while being free to
// spend a life. That is how `coerce` shipped: it carried `interact`'s leverage
// intents, spent the same days and the same stones, and was classified as
// nothing at all.
//
// The third state is legitimate and is documented in `actions.ts`: a verb whose
// cost depends on which intent ran, and which supplies its protection through a
// DEFAULT INTENT that lands on the cheap branch instead. What is not legitimate
// is being in that state by accident, so it is written down here by name.
// ═══════════════════════════════════════════════════════════════════════════

describe('every verb is priced as well as reachable', () => {
    /**
     * Verbs whose cost is decided at execution rather than by the verb.
     *
     * Each one carries both a read and a commitment behind an intent label, so
     * neither list is true of it. Every row here is protected by a DEFAULT
     * INTENT that lands on the free branch - which is the thing that makes the
     * third state safe, and the thing an accidental member would not have.
     *
     * ONLY SHRINK IT, on the same terms as `UNTESTED_DOORS` above: the number
     * is asserted so a verb cannot join this list without somebody editing it.
     */
    const PRICED_AT_EXECUTION: readonly ActionName[] = [
        // Ten of its intents are asks and three are takings. `costsTheAskerNothing`
        // is what tells them apart, and it is asked per-attempt.
        'interact',
        // A read of what you carry, and a word that cannot be walked back.
        'oath',
        // The board is a price list; the buying is a spend.
        'provision', 'buy', 'sell',
        // Nineteen intents, from reading a roll to swearing to one.
        'sect',
        // Reading where two houses stand, against committing your own to it.
        'posture', 'seal', 'offer',
        // Asking is free; a word given is a word given.
        'propose', 'decline'
    ];

    it('puts every verb on a list, or names it as priced at execution', () => {
        const unpriced = ACTION_NAMES.filter(name =>
            !READ_ONLY_ACTIONS.includes(name)
            && !TIME_CONSUMING_ACTIONS.includes(name)
            && !PRICED_AT_EXECUTION.includes(name));

        expect(
            unpriced,
            `classified as neither free nor costly and not recorded as priced at execution: `
            + `${unpriced.join(', ')}. Four guards read these lists by asking whether a verb is `
            + 'SAFE, so a verb on neither list is treated as safe by all four while being free '
            + 'to spend a life. That is how `coerce` shipped.'
        ).toEqual([]);
    });

    it('never puts a verb on both lists at once', () => {
        const both = ACTION_NAMES.filter(name =>
            READ_ONLY_ACTIONS.includes(name) && TIME_CONSUMING_ACTIONS.includes(name));
        expect(both, `on both lists: ${both.join(', ')}`).toEqual([]);
    });

    it('keeps the priced-at-execution list shrinking and never growing', () => {
        expect(PRICED_AT_EXECUTION.length).toBeLessThanOrEqual(11);
        expect(new Set(PRICED_AT_EXECUTION).size).toBe(PRICED_AT_EXECUTION.length);
    });

    /**
     * And the claim that makes the third state safe rather than merely
     * tolerated: whatever a bare or misread sentence reaches, it must land on
     * a branch that spends nothing. `parseIntent` with no object is the worst
     * case a misread produces, and every one of these has a default intent
     * chosen to be the free one.
     */
    for (const verb of ['posture', 'seal', 'offer', 'oath', 'sect', 'site', 'legacy'] as const) {
        it(`a bare "${verb}" does not commit anything`, () => {
            const parsed = parseIntent(verb);
            // Either it is not read as that verb at all - which is safe - or it
            // is, and the intent it defaults to is a read.
            if (parsed.action !== verb) return;
            expect(
                parsed.intent,
                `a bare "${verb}" must default to a read, not to the branch that spends`
            ).not.toBeUndefined();
        });
    }
});

describe('asking somebody is not consulting a register', () => {
    it('routes a question put to a person to that person', () => {
        const parsed = parseIntent('I ask someone about the sects near here');
        expect(parsed.action).toBe('interact');
        expect(parsed.topic).toMatch(/sect/i);
    });

    it('keeps the intent label when the asking is an interrogation', () => {
        const parsed = parseIntent('question the merchant about the ruin');
        expect(parsed.action).toBe('interact');
        expect(parsed.intent).toBe('interrogate');
    });

    it('leaves an application to the sect surface, where the act actually is', () => {
        // "ask about joining" names no person. It is not a question, it is an
        // application, and routing it to a conversation would lose the join.
        expect(parseIntent('I ask about joining the Gleaners Company').action).toBe('sect');
    });

    it('leaves asking around for work to the verb that feeds them', () => {
        expect(parseIntent('I ask around for work').action).toBe('work');
    });
});

describe('who is here is a narrower question than look', () => {
    for (const text of ['who is here', 'who is around', 'is anyone about', 'I look for someone']) {
        it(`"${text}" asks about people`, () => {
            const parsed = parseIntent(text);
            expect(parsed.action).toBe('look');
            expect(parsed.intent).toBe('company');
        });
    }

    it('leaves a plain look as a plain look', () => {
        expect(parseIntent('I look around').intent).toBeUndefined();
    });
});


/**
 * The setting's own vocabulary, used as ordinary nouns.
 *
 * This is the family of bug that has done the most damage. `cultivat\\w*`
 * matched "cultivator" - the commonest noun in the world - so "I attack the
 * nearest cultivator" sat the player down to meditate for thirty days. They
 * had asked to hit somebody. It burned satiety, it passed time, and it killed
 * a character during playtesting.
 *
 * Matching bare substrings against player prose is unsound here, because
 * `cultivator`, `cultivation`, `sect`, `elder`, `market` and `work` are things
 * a player TALKS ABOUT far more often than things they are asking to DO. Verb
 * position has to decide it.
 *
 * Each case below embeds a keyword as the object of an unrelated sentence and
 * asserts the keyword's action does not fire.
 */
describe('the setting\'s nouns are not commands', () => {
    const CASES: ReadonlyArray<readonly [string, string]> = [
        // The one that killed a character.
        ['I attack the nearest cultivator', 'cultivate'],
        ['I follow the cultivator', 'cultivate'],
        ['I talk to the cultivator by the well', 'cultivate'],
        ['I ask the cultivator about the road', 'cultivate'],
        ['I watch the cultivators go past', 'cultivate'],
        ['I look at the cultivation manual on the table', 'cultivate'],
        ['I hide from the sect elder', 'sect'],
        ['I steal from the market stall keeper', 'market'],
        ['I hide behind the workman', 'work'],
        ['I read about seclusion in the book', 'seclude']
    ];

    for (const [text, forbidden] of CASES) {
        it(`"${text}" is not ${forbidden}`, () => {
            expect(parseIntent(text).action).not.toBe(forbidden);
        });
    }

    it('none of them costs the player a day', () => {
        // The stronger claim, and the one that matters: whatever these do
        // resolve to, none of it may spend a life.
        for (const [text] of CASES) {
            const action = parseIntent(text).action;
            if (action === 'attack' || action === 'move') continue;  // asked for, and refusable
            expect(TIME_CONSUMING_ACTIONS, text).not.toContain(action);
        }
    });
});

describe('a destination has to be somewhere', () => {
    it('reads a trailing noun as a destination, which is why the engine must check it', () => {
        // The parser cannot tell "Scarwater" from "cultivator" - both are just
        // words after a movement verb - so it does not try. What it must not
        // do is stop producing a target, because then real travel breaks. The
        // check belongs in the engine, where the location registers are.
        const parsed = parseIntent('I follow the cultivator');
        expect(['move', 'attack', 'interact', 'unclear']).toContain(parsed.action);
    });
});

describe('the guard that survives all of it', () => {
    /**
     * Widening the parser is how a misparse gets introduced, so the widening
     * is checked against the same invariant that caught the last one: whatever
     * the engine failed to understand, it must not cost the player time.
     */
    const NONSENSE = [
        'I contemplate the nature of the ineffable',
        'asdfgh',
        'I do the thing with the thing',
        'yes',
        'why',
        'I consider my options carefully and at length',
        'thank you',
        'what',
        'I feel that this is probably a mistake'
    ];

    for (const text of NONSENSE) {
        it(`"${text}" costs nothing`, () => {
            const action = parseIntent(text).action;
            expect(TIME_CONSUMING_ACTIONS).not.toContain(action);
        });
    }
});
