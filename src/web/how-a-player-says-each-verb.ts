/**
 * How a player says each verb, in their own words.
 *
 * The exemplar set the model is compared against. A sentence the pattern table
 * has no line for is answered with the verb whose exemplars it means the same
 * thing as, so this file is the whole of what that tier knows - there is no
 * training, no weights of our own, and nowhere else for a bias to hide.
 *
 * Three rules for adding to it:
 *
 *   - A phrasing goes in because somebody would type it, not because it makes a
 *     number go up.
 *   - Keep them short and keep them distinct from each other. Five sentences
 *     that differ only in one noun narrow the verb rather than widening it.
 *   - Write the INTENTION, never the mood. "I do nothing for a while" was an
 *     exemplar for waiting and had to go: it is word for word how somebody
 *     types a non-answer, so waiting became the verb that swallowed every
 *     sentence that meant nothing - and a non-answer that spends in-world time
 *     is the failure `misparse.test.ts` exists because of.
 *
 * Editing this file changes what the tier knows, and the vectors beside the
 * model are computed from it. Run `npm run verbs:embed` afterwards or the
 * staleness guard in `reaching-a-verb-the-pattern-table-has-no-line-for.ts`
 * will refuse to load.
 *
 * `unclear` has no exemplars and never can: it is the answer when nothing here
 * is near enough.
 */

import type { ActionName } from './actions.js';

export const HOW_A_PLAYER_SAYS_EACH_VERB: Readonly<Record<Exclude<ActionName, 'unclear'>, readonly string[]>> = {
    interact: [
        'I speak to the woman by the well',
        'I want a word with him',
        'let me talk with the ferryman',
        'I go and introduce myself',
        'I get into conversation with the stallholder',
        'I try to make an acquaintance here',
        'I greet the man at the gate'
    ],
    investigate: [
        'I take a close look at the stone',
        'I examine the carving on the wall',
        'I want to know what that writing says',
        'I search through what is lying here',
        'I study the door for a while',
        'I poke about and see what I can find out',
        'there is something strange here and I want to understand it'
    ],
    move: [
        'I set out for the next town',
        'I travel to the mountain',
        'I leave this place and go elsewhere',
        'I take the road out of here',
        'I want to be somewhere else by evening',
        'I walk to the ford',
        'time to move on from this town',
        'I head for the peaks'
    ],
    ride: [
        'I ride to the next town',
        'I saddle a beast and go',
        'I take a carriage to the market town',
        'I hire a mount for the road',
        'I go by boat rather than walk it',
        'I fly there on my sword'
    ],
    fold: [
        'I fold space to the mountain',
        'I step across the distance in one go',
        'I cross to the far province without walking it',
        'I want to be there in a single step',
        'can I fold that far'
    ],
    passage: [
        'I buy passage to the far province',
        'what does the Span board say',
        'I want a ticket out of here',
        'what would it cost to be sent through',
        'is there a counter here that sells a crossing',
        'I book a place on the next span'
    ],
    oath: [
        'I swear an oath to them',
        'I give my word on it',
        'what oaths am I carrying',
        'I break the vow I gave',
        'I want out of the word I gave them',
        'who witnessed the oath I am under'
    ],
    attack: [
        'I strike at him',
        'I draw my blade and go for the man',
        'I attack the bandit',
        'I start a fight with him',
        'I mean to kill the thief',
        'I put a sword through him',
        'no more talking, I hit him',
        // Concealment is not a verb of its own - it is a way of opening this
        // one - so the exemplars carry it rather than a sixty-first member of
        // the enum. What the sentence changes is `opening`, read off the
        // sentence by the parser and never chosen by the model.
        'I sneak up on him and strike',
        'I wait until his back is turned and go for him'
    ],
    coerce: [
        // Hands, not words. Every one of these is somebody being MADE to do a
        // thing rather than being asked or warned - which is why none of them
        // belongs among the `interact` intents where threatening lives.
        'I force him to submit',
        'I make him kneel',
        'I coerce the merchant into handing it over',
        'I beat the truth out of him',
        'I strong-arm the steward into opening the gate',
        'I make her yield to me',
        // The same act with an animal on the other side, which is what taming
        // is. There is no taming subsystem and there must not be one.
        'I tame the beast',
        'I break the wolf in and make it mine'
    ],
    cultivate: [
        'I sit down and cultivate',
        'I circulate my qi for a while',
        'I spend some months breathing and refining',
        'I put in real practice at the method',
        'I want to build up my cultivation',
        'I meditate and take in the qi here',
        'I want to grow stronger by training',
        'I settle in and work at it for a year'
    ],
    seclude: [
        'I go into closed door cultivation',
        'I shut myself away and do not come out',
        'I seal myself in a cave for years',
        'nobody is to see me for a decade',
        'I retreat from the world entirely for a stretch'
    ],
    breakthrough: [
        'I attempt the breakthrough',
        'I try to break through to the next rank',
        'I push against the bottleneck',
        'I think I am ready to climb a rung',
        'I force my way up to the next layer',
        'I want to advance to the next stage'
    ],
    train_technique: [
        'I drill the palm art until it is smooth',
        'I practise the sword form',
        'I put hours into the technique I know',
        'I want to sharpen the art I already have',
        'I work at the method until it is better'
    ],
    refine: [
        'I refine a pill',
        'I make medicine at the furnace',
        'I brew something out of these herbs',
        'I want to try alchemy with what I have',
        'I cook a healing pill'
    ],
    gather: [
        'I go out and pick herbs',
        'I forage on the hillside',
        'I collect what grows out there',
        'I look for medicinal plants in the woods',
        'I go harvesting for anything useful'
    ],
    hunt: [
        'I hunt a spirit beast',
        'I go out after a beast worth killing',
        'I track something down for its core',
        'I take a spear into the hills after game',
        'I want to bring down a beast'
    ],
    eat: [
        'I eat something',
        'I have a meal',
        'I break out the rations and eat',
        'I am hungry and want food',
        'I get some food in me'
    ],
    provision: [
        'I buy provisions for the road',
        'I stock up on rations before sitting down',
        'I lay in enough food to last',
        'I need supplies for a long stretch',
        'I get grain in for the year'
    ],
    treat: [
        'I see a physician about my wounds',
        'I get my injuries treated',
        'I want these meridians seen to',
        'I find someone to close these wounds',
        'I go for care for what is torn'
    ],
    buy: [
        'I buy the manual',
        'I pay for the book',
        'I hand over the stones for it',
        'I purchase what he is selling',
        'I would like to take that off him for the price',
        'I want to buy a night at the inn'
    ],
    sell: [
        'I sell the sabre',
        'I want stones for what I am carrying',
        'I offer the pill for sale',
        'I part with it for whatever it fetches',
        'what would anybody pay me for this'
    ],
    inventory: [
        'what am I carrying',
        'what is in my pack',
        'let me see my belongings',
        'check the pouch',
        'what things do I have on me'
    ],
    consume_pill: [
        'I swallow the pill',
        'I take the medicine',
        'I use the elixir I am carrying',
        'I down the healing pill'
    ],
    list_techniques: [
        'what arts do I know',
        'which methods am I practising',
        'remind me what I have learned',
        'list the techniques I hold',
        'what have I actually been taught'
    ],
    learn_technique: [
        'I learn the art from the manual',
        'I take up the method in this book',
        'I study the canon properly',
        'I read the manual and commit it',
        'I want to pick up a new art'
    ],
    acquisition: [
        'how does somebody like me get hold of a manual',
        'what are the ways to come by an art',
        'where would I even find a book at all',
        'how do people without money get taught',
        'what are my options for getting a method'
    ],
    ceiling: [
        'how far will this method carry me',
        'is there a limit to what I know',
        'what is the highest this art goes',
        'where does what I am practising run out',
        'can this canon take me past the next realm'
    ],
    teacher: [
        'who would teach me',
        'is there anybody who would take me on',
        'I need a master',
        'who around here could show me anything',
        'I want somebody to study under',
        'is there a teacher for someone like me'
    ],
    destinations: [
        'where could I go from here',
        'what places are within reach',
        'what is near this town',
        'where else could I be',
        'what other ground is there'
    ],
    roads: [
        'how do I get to the mountain from here',
        'which way does the road run',
        'what is the route out of this place',
        'what road takes me there',
        'how far is it and by which way'
    ],
    // Deliberately none of these is a shrug. "I do nothing for a while" and
    // "I give it a month and see" were exemplars here and had to go: they are
    // word for word how somebody types a non-answer, so waiting became the
    // verb that swallowed every sentence that meant nothing, and a non-answer
    // that spends in-world time is the exact failure `misparse.test.ts` was
    // written for. An exemplar has to be an intention, not a mood.
    wait: [
        'I wait here',
        'I wait and see what happens',
        'I bide my time',
        'I stay put rather than act',
        'I pass the time until something changes'
    ],
    work: [
        'I look for work',
        'I need money and will take a job',
        'is there anything here I can do for pay',
        'I hire myself out for a season',
        'I take whatever labour is going'
    ],
    market: [
        'what is for sale here',
        'is anybody selling anything',
        'show me the stalls',
        'what can I get in this place',
        'what does this town have to trade'
    ],
    sect: [
        'what sects are there',
        'which houses take people',
        'I want to join a sect',
        'tell me about the houses near here',
        'can I sign on with one of them',
        'what would it take to be admitted'
    ],
    site: [
        'what ruins are there around here',
        'is there anything worth digging into nearby',
        'I go and look at the old gate',
        'I want to get inside the sealed place',
        'what old ground is there to search'
    ],
    legacy: [
        'I want to leave something behind for whoever comes after',
        'who gets my things when I die',
        'I set down what is to happen to what I hold',
        'I put my affairs in order before the end',
        'I leave an inheritance'
    ],
    petition: [
        'I put my case to the elders',
        'I take it up the chain to somebody who matters',
        'I ask the house for what I am owed',
        'I petition for a grant',
        'I want this heard higher up'
    ],
    posture: [
        'I make it plain I am not to be pushed',
        'I stand my ground where they can see it',
        'I declare where we stand',
        'I show strength so it is understood',
        'I set the terms between us openly'
    ],
    seal: [
        'I seal it shut',
        'I close the gate behind me and ward it',
        'I want to read what the seal says',
        'I try to wake what is sealed in there',
        'I put a seal on this place'
    ],
    offer: [
        'I make an offering',
        'I put something on the table in exchange',
        'I propose a trade to him',
        'I offer what I have for it',
        'I send an offering up'
    ],
    descend: [
        'I come back down',
        'I go down from up there',
        'I return to the ground below',
        'I step down off it',
        'I make the descent'
    ],
    look: [
        'I look around',
        'what does this place look like',
        'I take in my surroundings',
        'what is going on here',
        'I have a look about me',
        'what can I see from here'
    ],
    status: [
        'where do I stand',
        'how am I doing',
        'what am I',
        'tell me about myself',
        'what shape am I in',
        'what is my rank and condition'
    ],
    assess: [
        'how strong is he next to me',
        'could I take him in a fight',
        'I size the man up',
        'what is he worth against me',
        'I weigh up whether I would win'
    ],
    recall: [
        'what do I know about all this',
        'who have I heard of so far',
        'what have I worked out',
        'what is in my head about this',
        'what understanding have I come to'
    ],
    recognise: [
        'whose art is that',
        'do I know what school that comes from',
        'I have seen that form somewhere before',
        'is that their house style',
        'can I place the method he is using'
    ],
    news: [
        'what are people saying',
        'any word from elsewhere',
        'what is the talk here',
        'has anything happened in the world',
        'what rumours are going about'
    ],
    request: [
        'I ask him to teach me',
        'I beg her to take me as a disciple',
        'I ask him for the manual',
        'I want him to put in a word for me',
        'I ask her to let me into the house'
    ],
    propose: [
        'I propose a match to the Xu',
        'I ask them to marry me',
        'I want to marry into that house',
        'I offer their family a match for one of theirs',
        'I put a marriage to the head of the clan',
        'I accept the match they have offered',
        'I agree to the betrothal'
    ],
    decline: [
        'I refuse the match',
        'I turn down the proposal',
        'I will not go through with this marriage',
        'I say no to the betrothal',
        'I run from the marriage they arranged',
        'I walk out of the match my house made'
    ],
    child: [
        'we have a child together',
        'I want a child with them',
        'I spend twenty years raising the child',
        'I bring up my daughter myself',
        'I start a family here',
        'I place my son at the Azure Cloud Pavilion',
        'I call in a favour to get my child into that house'
    ]
};
