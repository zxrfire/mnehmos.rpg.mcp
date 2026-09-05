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
export interface Scenario {
    name: string;
    sign: 'taking' | 'giving' | 'indifferent';
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
    }
];
