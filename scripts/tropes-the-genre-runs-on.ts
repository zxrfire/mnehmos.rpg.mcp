/**
 * The tropes the genre runs on, as sentences somebody would type.
 *
 *   "just play the game and try xianxia tropes ensure they fall out of what exists"
 *   "less blank looks, more fun, right?"
 *
 * ── WHAT THIS MEASURES THAT THE OTHER CORPUS DOES NOT ─────────────────────
 *
 * `xianxia-scenarios.ts` asks whether a VERB is reached: somebody takes, gives
 * or looks, and the question is whether the turn answered them. This asks
 * something harder and more specific - whether a scene the genre is MADE of
 * comes out of machinery that already exists, without anybody having written a
 * rule for that scene.
 *
 * The design owner's standing rule, repeated all session: *"THIS SHOULD NOT BE
 * BESPOKE"*, *"this should fall out"*, *"as should everything else"*. A trope
 * that needs its own branch is a trope this engine has not really got. So every
 * `hope` below is written as what should FALL OUT of parts that are already
 * there - the obligation ledger, the rumour mill, what a house does about its
 * own, what somebody can place about you - and not as a feature request.
 *
 * ── HOW TO READ A RUN ─────────────────────────────────────────────────────
 *
 * A SHRUG is the worst outcome and always a defect: the player typed a sentence
 * the genre is built out of and the turn cost them nothing and gave them
 * nothing. A REFUSAL may be correct - the engine does not grade, and naming the
 * honest route is a good answer - so refusals are read, not counted. A turn
 * that RAN is not automatically right either: the whole question is whether
 * what ran is the scene the trope is.
 */

import type { Scenario } from './xianxia-scenarios.js';

export const TROPES: Scenario[] = [
    // ── FACE, AND LOSING IT ───────────────────────────────────────────────
    {
        name: 'the-declaration-that-travels',
        sign: 'taking',
        asks: 'a_goal',
        hope: 'saying you will end a house, with none of that house present, is a thing the '
            + 'room hears and the world carries. It should reach the rumour mill as a fact '
            + 'that travels and gets distorted, not a flag on a faction. Nobody should draw. '
            + 'MEASURED AND IT DOES: the turn runs `world.aDeedEntersTheWorld` beside the '
            + 'posture read, and the deed is on the record whether or not the war was refused.',
        // NAME A HOUSE THIS CULTIVATOR HAS HEARD OF.
        //
        // This scenario said "the Hollow Court" and looked like an engine
        // failure: the turn reached `housePosture`, was refused for having no
        // house of your own, and no deed entered the world.
        //
        // The engine was right twice over, and the second reason is the real
        // one. I first wrote this comment saying the Hollow Court is a withdrawn
        // power the world does not hold - which is wrong, and the owner said so:
        // *"hollow court is not bespoke"*. It is not. `factionMeant` is
        // KNOWLEDGE-GATED, and a cultivator who has just opened their eyes has
        // never heard of it. Measured:
        //
        //     knows of it, fresh run        false
        //     I will end the Hollow Court   housePosture
        //     ADMIN grant_knowledge         true
        //     I will end the Hollow Court   housePosture, aDeedEntersTheWorld
        //
        // You cannot start a rumour about a house you have never heard of, and
        // that is the same rule for every house in the game. The scenario names
        // one the starting cultivator already knows, so the trope is measured
        // and not the knowledge gate.
        turns: ['who is here', 'I will end the Azure Cloud Pavilion']
    },
    {
        name: 'the-declaration-with-a-disciple-standing-there',
        sign: 'taking',
        asks: 'a_goal',
        hope: 'the same sentence, said where somebody of that house can hear it. The hearer '
            + 'decides what it was, and a disciple of the named house should take it as the '
            + 'insult it is. A drawn sword is the right answer and a shrug is not.',
        turns: ['who is here', 'I insult the sect of the strongest person here to his face']
    },
    {
        name: 'the-conceited-young-master',
        sign: 'taking',
        hope: 'somebody far below you demanding something of you. The engine should price it '
            + 'off what he can place about you, and he can place nothing, so he asks like a '
            + 'man who does not know. This is the iron plate, and it should need no rule.',
        turns: ['who is here', 'I tell the weakest person here to hand over everything he has']
    },
    {
        name: 'the-hidden-expert',
        sign: 'indifferent',
        hope: 'putting your weight away and then asking for something. What is weighed should '
            + 'be the person in the robe, not the one wearing it, and the odds should be '
            + 'measurably worse than the same ask made openly.',
        turns: ['who is here', 'hiding my cultivation, I ask the strongest one here what he wants']
    },

    // ── THE LEDGER, WHICH IS THE GENRE'S MEMORY ───────────────────────────
    {
        name: 'the-favour-called-in',
        sign: 'taking',
        hope: 'leaning on somebody with what they already owe you. The debt is on the ledger '
            + 'and `whatYouBringToBear` prices it, so naming it should not need a new verb.',
        turns: ['who is here', 'what am I owed', 'I remind him that he owes me']
    },
    {
        name: 'the-kin-who-come-after-you',
        sign: 'taking',
        hope: 'killing somebody with living relatives should open an account in their name, '
            + 'and asking who is holding something against you should return it. A killing '
            + 'nobody remembers is the failure.',
        turns: ['who is here', 'I kill the nearest man', 'who holds a grudge against me']
    },
    {
        name: 'a-word-given-and-what-it-costs',
        sign: 'giving',
        hope: 'swearing a dao oath is a serious act with a house behind it, and breaking one '
            + 'should reach the crossing punishment scaled to the rung. Nodding is not an oath.',
        turns: ['who is here', 'I swear a dao oath to him that I will not touch his sect',
            'what oaths am I bound by', 'I break my oath']
    },

    // ── WHAT SOMEBODY DOES WHEN A STRANGER SPEAKS ─────────────────────────
    {
        name: 'hello-whats-your-name',
        sign: 'indifferent',
        hope: 'the plainest opening in any game. It should reach somebody, and the answer '
            + 'should depend on who they are - a demonic cultivator telling you to go away '
            + 'is as good an answer as a name, and better than a blank look.',
        turns: ['hello, what is your name']
    },
    {
        name: 'asking-nobody-in-particular',
        sign: 'indifferent',
        hope: 'a question thrown at the room. The nearest person should answer it; the logic '
            + 'for who is nearest already exists.',
        turns: ['who is here', 'what is going on around here']
    },
    {
        name: 'senior-what-do-you-mean',
        sign: 'indifferent',
        asks: 'a_description',
        hope: 'a demand made of somebody who can tell exactly what is being asked and would '
            + 'rather not. Playing dumb is a legitimate answer and should be reachable.',
        turns: ['who is here', 'I ask the strongest one here for his sword']
    },

    // ── THE MASTER, THE DISCIPLE, AND THE ROAD ────────────────────────────
    {
        name: 'taking-a-disciple',
        sign: 'giving',
        hope: 'somebody standing in front of you becoming yours to teach. A two-sided tie on '
            + 'the record, not a sentence that reaches nothing.',
        turns: ['who is here', 'I take the youngest one here on as my disciple']
    },
    {
        name: 'finding-somebody-to-teach-you',
        sign: 'indifferent',
        hope: 'the other end of the same relation. Who here stands above me and would pass '
            + 'something on.',
        turns: ['who is here', 'I need somebody further along to teach me']
    },

    // ── WHAT THE WORLD DOES WHILE YOU ARE IN IT ───────────────────────────
    {
        name: 'the-price-of-a-bad-year',
        sign: 'indifferent',
        hope: 'asking what things cost, and being told a figure that has the ground in it. A '
            + 'province in trouble should not quote the same number as one at peace.',
        turns: ['what do things cost here', 'I buy a month of rations']
    },
    {
        name: 'your-stuff-for-their-stuff',
        sign: 'indifferent',
        hope: 'a swap with no coin named at all. It is one exchange and the direction is '
            + 'which side each thing is on.',
        turns: ['who is here', 'I trade my herbs for one of his pills']
    },
    {
        name: 'the-thing-money-will-not-buy',
        sign: 'taking',
        hope: 'asking a holder for something past the cash line. The refusal must name the '
            + 'door that is open - a favour, an art, something out of a hole - and the verb '
            + 'that reaches it.',
        turns: ['who is here', 'I ask him what he would take for his best pill']
    },

    // ── BEING OUTNUMBERED, WHICH THE GENRE DOES CONSTANTLY ────────────────
    {
        name: 'the-whole-square-at-once',
        sign: 'taking',
        asks: 'a_set',
        hope: 'one fight against many, not many fights against one. Numbers should tell.',
        turns: ['who is here', 'I fight everyone here at once']
    },
    {
        name: 'somebody-at-your-back',
        sign: 'giving',
        hope: 'asking somebody to stand with you, and having them actually be there. The '
            + 'guard verb exists for a crossing; standing together in a fight is the same '
            + 'shape.',
        turns: ['who is here', 'I ask the strongest one here to fight alongside me']
    },

    // ═════════════════════════════════════════════════════════════════════
    // AND THE SAME TROPES, HAPPENING TO YOU
    // ═════════════════════════════════════════════════════════════════════
    //
    // The design owner: *"also tropes can happen to you too. not necessarily
    // you doing it"*. Everything above is the player ACTING, and a corpus of
    // only that measures half a genre - the half where the protagonist is
    // always the subject of the sentence. The scenes people remember are the
    // ones done TO somebody: the demand you did not invite, the insult you did
    // not start, the summons that arrives.
    //
    // These are written as a player STANDING THERE and then answering. What is
    // being measured is whether the world puts anything in front of them worth
    // answering, and whether the answer reaches a verb. A run of these that is
    // all quiet is the finding: the world is not doing anything to anybody.
    {
        name: 'somebody-wants-something-from-you',
        sign: 'indifferent',
        hope: 'standing still long enough that the world comes to you. Somebody should want '
            + 'something - `whatTheyWantOfYou` is derived and read on every approach - and the '
            + 'player should be able to ask what that is and refuse it.',
        turns: ['who is here', 'what does he want from me', 'I tell him no']
    },
    {
        name: 'answering-for-what-you-did',
        sign: 'indifferent',
        hope: 'the other end of a grudge. After wronging somebody, standing there should '
            + 'eventually mean answering for it, and the player should be able to settle it '
            + 'or refuse to. The ledger is written; being ASKED about it is the missing half.',
        turns: ['who is here', 'I rob the nearest man', 'I wait a month',
            'what is held against me', 'I make amends to him']
    },
    {
        name: 'the-summons-you-did-not-ask-for',
        sign: 'indifferent',
        hope: 'a house sending for you. `pending-summons.ts` exists and answers one; the '
            + 'question is whether anything ever arrives, and whether refusing costs what '
            + 'refusing a house should.',
        turns: ['who is here', 'has anybody sent for me', 'I ignore it']
    },
    {
        name: 'being-looked-over-by-somebody-above-you',
        sign: 'indifferent',
        hope: 'an elder taking an interest. Being ASSESSED is the mirror of assessing, and '
            + 'the player should be able to ask what somebody above them makes of them.',
        turns: ['who is here', 'what does the strongest one here make of me']
    },
    {
        name: 'somebody-else-swears-at-you',
        sign: 'indifferent',
        hope: 'an oath sworn TO the player rather than BY them. The oath house takes both, '
            + 'and the ledger has a holder and a subject, so this should already be a row.',
        turns: ['who is here', 'I ask him to swear he will not follow me', 'what am I owed']
    },
    {
        name: 'a-fight-you-did-not-start',
        sign: 'indifferent',
        hope: 'being attacked. The player should be able to answer with the fight verbs, and '
            + 'breaking off should cost what breaking off costs. Nothing here is the player '
            + 'opening anything.',
        turns: ['who is here', 'I insult the strongest one here', 'I defend myself',
            'I break off and run']
    },
    {
        name: 'the-offer-you-should-refuse',
        sign: 'indifferent',
        hope: 'somebody offering the player something with a price on it. Declining is a verb '
            + 'and should leave a record on the other side.',
        turns: ['who is here', 'what is he offering', 'I refuse his offer']
    },

    // ── AND THE CONTROL ARM ───────────────────────────────────────────────
    {
        name: 'an-ordinary-morning',
        sign: 'indifferent',
        hope: 'the control. Plain acts must read at least as well as loaded ones, or the '
            + 'engine has an opinion about drama.',
        turns: ['I look around', 'what is my situation', 'I sit down and cultivate for a year']
    }
];
