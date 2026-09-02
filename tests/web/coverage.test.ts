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
import { ACTION_NAMES, TIME_CONSUMING_ACTIONS, parseIntent, type ActionName } from '../../src/web/actions.js';

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
