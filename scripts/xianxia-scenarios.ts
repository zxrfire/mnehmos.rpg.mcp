/**
 * Xianxia scenarios, played end to end.
 *
 * Half generous and half monstrous ON PURPOSE. The engine does not grade, so a
 * reader that resolves one half better than the other has an opinion the engine
 * does not, and the only way to see that is to run both and compare.
 *
 * `sign` is for that comparison and for nothing else. Nothing in the engine
 * reads it, and no scenario is scored on whether the act was good.
 */
/**
 * How much a single sentence is asking the engine to do.
 *
 * The design owner, on which of these actually matters:
 *
 *   > run a more comprehensive test ... including ones that require multiple
 *   > MCP calls, cuz that's the big one, right? exactly like i kill their
 *   > entire family, think of more scenarios like that, cuz that's what people
 *   > type. i don't type "i touch the crosswalk button" i just type "i cross
 *   > the road safely"
 *
 * Read by the report and by nothing else. It exists so that a run can be split
 * on it: a reader that handles `one_act` perfectly and `a_set` badly is a
 * reader that has not understood the game, and one number over all the
 * scenarios hides that completely.
 */
export type HowMuchIsBeingAsked =
    /** One verb, one target. The floor. */
    | 'one_act'
    /** One verb over many people. `acts-over-a-set.ts` decomposes it. */
    | 'a_set'
    /** Two or more verbs in one sentence, in an order. */
    | 'several_acts'
    /** A goal with no verb in it at all. The reader has to decompose it. */
    | 'a_goal'
    /** The engine's act under a word from outside the setting. */
    | 'another_word_for_it'
    /** The target is a description rather than a name. */
    | 'a_description';

export interface Scenario {
    name: string;
    sign: 'taking' | 'giving' | 'indifferent';
    /**
     * How much the heaviest sentence in `turns` is asking for. Defaults to
     * `one_act` where a scenario does not say.
     */
    asks?: HowMuchIsBeingAsked;
    /** What a person would consider a fair answer. Read by a human, not asserted. */
    hope: string;
    turns: string[];
}

export const SCENARIOS: Scenario[] = [
    {
        name: 'kill-everyone-here',
        sign: 'taking',
        hope: 'a fight with somebody real, or a refusal that names who is actually here',
        turns: ['I look around', 'I kill everyone here']
    },
    {
        name: 'exterminate-his-family',
        sign: 'taking',
        hope: 'reaches the ones present and known; says nothing about kin it does not know of',
        turns: ['who is here', 'I kill the nearest man', 'I exterminate his family']
    },
    {
        name: 'the-polite-taking',
        sign: 'taking',
        hope: 'a theft, decided by whose the thing is, not by how politely it was said',
        turns: ['what is here', 'I relieve him of his purse', 'I take my own sword']
    },
    {
        name: 'forced-marriage',
        sign: 'taking',
        hope: 'coercion, never a proposal',
        turns: ['who is here', 'I force her to marry me']
    },
    {
        name: 'the-furnace',
        sign: 'taking',
        hope: 'reaches the furnace pipeline, with the house response it already models',
        turns: ['who is here', 'I use him as a furnace']
    },
    {
        name: 'the-furnace-needs-two',
        sign: 'taking',
        hope: 'FAILS, and for the right reason: the art answers between two people who are '
            + 'both cultivating it, so somebody who is not cannot be used as one. Making them '
            + 'cultivate their half first is the long sinister road, and it is not a sentence',
        turns: ['who is here', 'I use him as a furnace', 'I force him to cultivate the furnace art with me']
    },
    {
        name: 'rob-the-corpse',
        sign: 'taking',
        hope: 'a taking off the dead, or an honest account of why there is nothing to take',
        turns: ['I look around', 'I kill the nearest man', 'I take everything off him']
    },
    {
        name: 'give-it-away',
        sign: 'giving',
        hope: 'a real transfer, as consequential as a theft of the same size',
        turns: ['who is here', 'I give him my spirit stones']
    },
    {
        name: 'spare-him',
        sign: 'giving',
        hope: 'mercy that costs something, or an honest "there is no fight to stop"',
        turns: ['who is here', 'I attack the nearest man', 'I spare him']
    },
    {
        name: 'stand-guard',
        sign: 'giving',
        hope: 'reaches the guard mechanic, or says plainly nobody here is crossing',
        turns: ['who is here', 'I stand guard while he crosses']
    },
    {
        name: 'take-a-disciple',
        sign: 'giving',
        hope: 'a master-disciple tie, never an attack',
        turns: ['who is here', 'I take him on as my disciple']
    },
    // ── THE HOSTILE SET ──────────────────────────────────────────────────
    //
    // The design owner's own test, and the one that matters most: these are
    // GOALS, not verbs. A player does not type `bribe(target, item)`; they say
    // they want to find out whether somebody can be bought, and the mechanism
    // is exactly what they do not know yet.
    //
    // A pronoun preamble on purpose - this is how somebody actually plays, and
    // it exercises the binding as well as the reading.
    {
        name: 'can-he-be-bought',
        sign: 'indifferent',
        hope: 'a goal, not a verb. Should reach an approach or a read of what he wants - '
            + 'never a completed transfer, because the player has not decided to pay yet',
        turns: ['who is here', 'I want to see if he can be bought', 'I ask him what he wants']
    },
    {
        name: 'leverage-what-he-owes',
        sign: 'indifferent',
        hope: 'reads the ledger for what is actually owed, rather than inventing a debt',
        turns: ['who is here', 'I remind him that he owes me', 'what does he owe me']
    },
    {
        name: 'make-him-stop',
        sign: 'indifferent',
        hope: 'a goal with no named mechanism: what would make him stop obstructing me',
        turns: ['who is here', 'I want to find out what would make him stop obstructing me']
    },
    {
        name: 'trade-for-protection',
        sign: 'indifferent',
        hope: 'a conditional offer - an asset against a future behaviour, not a bare gift',
        turns: ['who is here', 'I will trade what I found in the tomb for his protection']
    },
    {
        name: 'hide-what-i-am',
        sign: 'indifferent',
        hope: 'concealment as an act. Cultivating unseen, and looking weaker than you are',
        turns: ['I want to cultivate without him finding out', 'I pretend I am weaker than I am']
    },
    {
        name: 'an-offer-he-cannot-refuse',
        sign: 'taking',
        hope: 'a threat dressed as an offer must route as the pressure it is, not as a gift',
        turns: ['who is here', 'I will make him an offer he cannot refuse']
    },
    {
        name: 'the-ordinary-life',
        sign: 'indifferent',
        hope: 'the control arm: plain acts must read at least as well as loaded ones',
        turns: ['I look around', 'I cultivate for a month', 'what is my situation', 'I look for work']
    },
    {
        name: 'the-lost-newcomer',
        sign: 'indifferent',
        hope: 'a first-time player who types what a person types is never stranded',
        turns: ['where am I', 'what should I do', 'I want to get stronger', 'I need money']
    },

    // ─────────────────────────────────────────────────────────────────────
    // SENTENCES THAT ARE MORE THAN ONE CALL
    //
    // *that's the big one, right?* Everything above is one verb and one
    // target, which is the floor. These are what somebody actually types: a
    // set, a sequence, or a goal with no verb in it at all.
    // ─────────────────────────────────────────────────────────────────────

    {
        name: 'their-entire-family',
        sign: 'taking',
        asks: 'a_set',
        hope: 'one sentence over many people: reaches the ones present and known, and says '
            + 'what it did not reach without handing over a census',
        turns: ['who is here', 'I kill their entire family']
    },
    {
        name: 'rob-the-whole-square',
        sign: 'taking',
        asks: 'a_set',
        hope: 'the set loop is not the fight\'s. Every person here is robbed, not the last of them',
        turns: ['I look around', 'I rob everyone here']
    },
    {
        name: 'all-the-righteous',
        sign: 'taking',
        asks: 'a_set',
        hope: 'a leaning is a set. Nobody of that leaning standing here is a real answer and '
            + 'must not read as a refusal to try',
        turns: ['I look around', 'I kill members of all righteous sects']
    },
    {
        name: 'threaten-all-the-elders',
        sign: 'taking',
        asks: 'a_set',
        hope: 'a rank in the plural is a set, and threatening is not attacking',
        turns: ['who is here', 'I threaten all the elders']
    },
    {
        name: 'give-everyone-here-something',
        sign: 'giving',
        asks: 'a_set',
        hope: 'the same machinery pointed the other way. A set of gifts, not a set of blows',
        turns: ['I look around', 'I give everyone here a spirit stone']
    },
    {
        name: 'go-and-gather',
        sign: 'indifferent',
        asks: 'several_acts',
        hope: 'two acts in the order the sentence gives. Whatever the engine does with the '
            + 'second, it must not silently drop the first',
        turns: ['where can I go', 'I go to Cold Peak and gather herbs']
    },
    {
        name: 'ask-then-lean',
        sign: 'taking',
        asks: 'several_acts',
        hope: 'a question and then pressure on the same person. The second act must land on '
            + 'whoever the first one was put to',
        turns: ['who is here', 'I ask the oldest man here who is in charge, then I threaten him']
    },
    {
        name: 'kill-and-loot',
        sign: 'taking',
        asks: 'several_acts',
        hope: 'the commonest pair in the genre. Looting is a taking and not a look',
        turns: ['who is here', 'I kill the nearest man and take everything he is carrying']
    },
    {
        name: 'buy-then-leave',
        sign: 'indifferent',
        asks: 'several_acts',
        hope: 'an errand: stock up and then travel. Neither half is loaded and both should run',
        turns: ['I stock up for a month, then I travel to Nine Peaks']
    },
    {
        name: 'starve-the-town',
        sign: 'taking',
        asks: 'a_goal',
        hope: 'a goal with no verb. Either it decomposes into acts the engine holds, or the '
            + 'refusal says what would actually do it - never a shrug',
        turns: ['where am I', 'I want this town to starve']
    },
    {
        name: 'kill-every-blacksmith',
        sign: 'taking',
        asks: 'a_goal',
        hope: 'a campaign, not a call. Somebody has to be located before anybody is killed, '
            + 'and the engine holds no blacksmiths - so an honest answer says which half failed',
        turns: ['I kill all the blacksmiths in the region']
    },
    {
        name: 'make-them-fear-me',
        sign: 'taking',
        asks: 'a_goal',
        hope: 'an end with no means named. What is asked back is which act, not whether',
        turns: ['who is here', 'I want everyone in this province to be afraid of me']
    },
    {
        name: 'get-strong-enough-to-kill-him',
        sign: 'taking',
        asks: 'a_goal',
        hope: 'a goal that spans years. The turn should start it rather than refuse it',
        turns: ['who is here', 'I need to get strong enough to kill the strongest one here']
    },
    {
        name: 'the-youngest-woman',
        sign: 'taking',
        asks: 'a_description',
        hope: 'the target is a description and the narrowing binds before the ordering: the '
            + 'youngest OF THE WOMEN, never the youngest person who happens to be one',
        turns: ['who is here', 'I rob the youngest woman here']
    },
    {
        name: 'the-one-nearest-to-me',
        sign: 'taking',
        asks: 'a_description',
        hope: 'a madman\'s sentence, and it must land on somebody rather than on nobody',
        turns: ['I look around', 'I kill the one nearest to me']
    },
    {
        name: 'you-void-refinement-cultivator',
        sign: 'indifferent',
        asks: 'a_description',
        hope: 'addressed by realm, which is the first thing anybody here says about a stranger',
        turns: ['who is here', 'you, void refinement cultivator, what do you want']
    },
    {
        name: 'senior-brother',
        sign: 'giving',
        asks: 'a_description',
        hope: 'a title is a position relative to the speaker, not a rank word. Somebody with '
            + 'no house has no ladder to read it against, and that is a real answer',
        turns: ['who is here', 'senior brother, will you teach me']
    },
    {
        name: 'teleport-to-the-capital',
        sign: 'indifferent',
        asks: 'another_word_for_it',
        hope: 'the engine holds a whole priced answer for this. A refusal must name the floor '
            + 'and the grant, never read as an unparseable sentence',
        turns: ['I teleport to Cold Peak']
    },
    {
        name: 'level-up',
        sign: 'indifferent',
        asks: 'another_word_for_it',
        hope: 'the word somebody brings from their last game. It is a breakthrough attempt',
        turns: ['I want to level up']
    },
    {
        name: 'make-camp-for-the-night',
        sign: 'indifferent',
        asks: 'another_word_for_it',
        hope: 'a cultivator does not sleep, they cultivate - and the player should not have to '
            + 'know that to say it',
        turns: ['I make camp for the night']
    },
    {
        name: 'loot-the-body',
        sign: 'taking',
        asks: 'another_word_for_it',
        hope: 'going through what somebody is carrying TAKES things. A look that takes nothing '
            + 'is the wrong answer, and was the answer for a long time',
        turns: ['who is here', 'I kill the nearest man', 'I loot the body']
    },
    {
        name: 'send-him-in-first',
        sign: 'taking',
        asks: 'several_acts',
        hope: 'the cannon-fodder trope. It needs somebody with you and a door - if either is '
            + 'missing the refusal should say which',
        turns: ['where can I go', 'I make the weakest one here go into the ruin ahead of me']
    },
    {
        name: 'take-her-primal-yin',
        sign: 'taking',
        asks: 'one_act',
        hope: 'a trope this genre is built on. Whatever the answer is, it is not a flinch and '
            + 'not a parse failure',
        turns: ['who is here', 'I take her primal yin']
    },
    {
        name: 'who-is-in-charge-here',
        sign: 'indifferent',
        asks: 'one_act',
        hope: 'asked of nobody in particular. The register may be silent, but if it says to '
            + 'ask somebody standing here, then asking one has to work',
        turns: ['who is in charge here', 'I ask the strongest one here who is in charge']
    }
];
