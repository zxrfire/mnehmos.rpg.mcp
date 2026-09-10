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
        'I greet the man at the gate',
        'I pull him aside for a quiet word',
        'I chat with the innkeeper for a bit',
        'I lie to the guard about who I am',
        'I apologise to her for what I did',
        'I flirt with the woman at the next table',
        'I try to recruit him to come with me'
    ],
    investigate: [
        'I take a close look at the stone',
        'I examine the carving on the wall',
        'I want to know what that writing says',
        'I search through what is lying here',
        // "I study the door for a while" was here and had to go. `the door` is
        // one of `site`'s threshold nouns by design - reading a sealed ground
        // from outside is a different act with a different refusal - and the
        // site block says so in its own comment, naming this exact sentence as
        // one it was written to take. Two files disagreeing about a phrasing is
        // the thing the sweep exists to find, and this is the case where the
        // table was right.
        'I study the carving for a while',
        'I poke about and see what I can find out',
        'there is something strange here and I want to understand it',
        'I inspect the body',
        'I go through the records',
        'tell me more about that statue'
    ],
    move: [
        'I set out for the next town',
        'I travel to the mountain',
        'I leave this place and go elsewhere',
        'I take the road out of here',
        'I want to be somewhere else by evening',
        'I walk to the ford',
        'time to move on from this town',
        'I head for the peaks',
        'I go on foot to the village',
        'I flee the town tonight',
        'I walk into the village',
        'I walk it myself however long it takes',
        'I return to the town I came from'
    ],
    ride: [
        'I ride to the next town',
        'I saddle a beast and go',
        'I take a carriage to the market town',
        'I hire a mount for the road',
        'I go by boat rather than walk it',
        'I fly there on my sword',
        'I take the spirit boat downriver',
        'I ride a crane over the range'
    ],
    fold: [
        'I fold space to the mountain',
        'I step across the distance in one go',
        'I cross to the far province without walking it',
        'I want to be there in a single step',
        'can I fold that far',
        'I tear space open and step through',
        'I teleport to the peak',
        'I blink across to the far ridge',
        'I fold to somewhere I have already stood',
        'I fold to the peak I can see from here'
    ],
    passage: [
        'I buy passage to the far province',
        'what does the Span board say',
        'I want a ticket out of here',
        'what would it cost to be sent through',
        'is there a counter here that sells a crossing',
        'I book a place on the next span',
        'what spans run from this town',
        'when does the next span leave'
    ],
    // A DAO OATH IS NOT AGREEING TO SOMETHING. The design owner: *nodding is
    // not an oath. that's just agreeing to an NPC proposal, or saying yes. a
    // dao oath is specifically like "I swear a dao oath" or something equal in
    // magnitude. it's serious.*
    //
    // "I give my word on it" was on this list, and it is the register of
    // somebody agreeing to meet on Tuesday. Measured against it, "I nod"
    // reached this verb. Every exemplar now names the oath, the house that
    // witnesses it, or the breaking of one, because those are the only
    // sentences that should.
    oath: [
        'I swear a dao oath to them',
        'I swear a dao oath before the Vermilion Seal Terrace',
        'what oaths am I carrying',
        'I break the dao oath I swore',
        'I want out of the oath I am under',
        'who witnessed the oath I am bound by',
        'we swear an oath of brotherhood',
        'I swear a dao oath never to speak of this',
        'what have I sworn and to whom',
        'I go back on the vow I made to him'
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
        'I wait until his back is turned and go for him',
        'I punch him in the face',
        'I break his arm',
        'I take a swing at the man',
        'I drive the man off this ground with blows',
        'I beat him in front of his disciples to shame him',
        'I challenge him to a duel'
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
        'I break the wolf in and make it mine',
        'I hold him against the wall until he hands it over',
        'I drag him back here by the collar'
    ],
    cultivate: [
        'I sit down and cultivate',
        'I circulate my qi for a while',
        'I spend some months breathing and refining',
        'I put in real practice at the method',
        'I want to build up my cultivation',
        'I meditate and take in the qi here',
        'I want to grow stronger by training',
        'I settle in and work at it for a year',
    ],
    seclude: [
        'I go into closed door cultivation',
        'I shut myself away and do not come out',
        'I seal myself in a cave for years',
        'nobody is to see me for a decade',
        'I retreat from the world entirely for a stretch',
        'I go into seclusion now',
        'I cut myself off from everyone for a century',
    ],
    breakthrough: [
        'I attempt the breakthrough',
        'I try to break through to the next rank',
        'I push against the bottleneck',
        'I think I am ready to climb a rung',
        'I force my way up to the next layer',
        'I want to advance to the next stage',
        'I break through now',
        'time to make my own crossing',
        'I go for the next realm',
        'my base is full, I make the attempt'
    ],
    train_technique: [
        'I drill the palm art until it is smooth',
        'I practise the sword form',
        'I put hours into the technique I know',
        'I want to sharpen the art I already have',
        'I work at the method until it is better',
        'I run through the form again and again',
        'more repetitions of the blade art',
        'I do the same movement a thousand times',
        'I train the sword art today'
    ],
    refine: [
        'I refine a pill',
        'I make medicine at the furnace',
        'I brew something out of these herbs',
        'I want to try alchemy with what I have',
        'I cook a healing pill',
        'I light the cauldron and start a batch',
        'can I turn this into medicine',
    ],
    // Every one of these names the thing. `build` and `make` on their own are
    // how somebody says half a dozen other intentions - making an offer, making
    // their way south - and an exemplar without the noun would pull all of them
    // in, which is the failure the header's third rule is about.
    craft: [
        'I build a carriage',
        'I lay down the keel of a spirit boat',
        'I put a cart together out of the hides I took',
        'I go back to the carriage on the stocks and work on it',
        'I want to finish the boat I started',
        'I abandon the boat half built',
        'I assemble the frame of the wagon',
        'I spend three months building the boat',
        'I set up at the bench and work on the wagon'
    ],
    gather: [
        'I go out and pick herbs',
        'I forage on the hillside',
        'I collect what grows out there',
        'I look for medicinal plants in the woods',
        'I go harvesting for anything useful',
        'I dig up roots and put them in my pouch',
        'I fill a basket with whatever grows here',
        'I cut herbs and carry them back',
        'I chip ore out of the rock face',
        'I harvest the spirit grass growing here'
    ],
    hunt: [
        'I hunt a spirit beast',
        'I go out after a beast worth killing',
        'I track something down for its core',
        'I take a spear into the hills after game',
        'I want to bring down a beast',
        'I go hunting',
        'I set snares for whatever comes through',
        'I want the hide and bones off a beast'
    ],
    eat: [
        'I eat something',
        'I have a meal',
        'I break out the rations and eat',
        'I am hungry and want food',
        'I get some food in me',
        'I want breakfast',
        'I am starving',
        'I stop for a bite',
        'I eat a bowl of rice',
        'I fill my belly',
        'let me eat first'
    ],
    provision: [
        'I buy provisions for the road',
        'I stock up on rations before sitting down',
        'I lay in enough food to last',
        'I need supplies for a long stretch',
        'I get grain in for the year',
        'I stock the larder',
        'I want a hundred days of food'
    ],
    treat: [
        'I see a physician about my wounds',
        'I get my injuries treated',
        'I want these meridians seen to',
        'I find someone to close these wounds',
        'I go for care for what is torn',
        'I am hurt and want it fixed',
        'I get myself healed',
        'I want the damage inside me repaired',
    ],
    buy: [
        'I buy the manual',
        'I pay for the book',
        'I hand over the stones for it',
        'I purchase what he is selling',
        'I would like to take that off him for the price',
        'I want to buy a night at the inn',
        'I spend my stones on the sword',
    ],
    sell: [
        'I sell the sabre',
        'I want stones for what I am carrying',
        'I offer the pill for sale',
        'I part with it for whatever it fetches',
        'what would anybody pay me for this',
        'I turn my haul into stones',
        'I put my herbs on the counter for stones',
        'I sell off everything in my pouch',
        'I find a buyer for what I gathered'
    ],
    // Every one of these is somebody parting with a thing for nothing. None of
    // them names a price, because a sentence that says what is wanted back is a
    // purchase or a trade and belongs to `buy` or `request` - which is the one
    // boundary this verb has to hold, and the tier reads it off these.
    give: [
        'I hand him the purse',
        'I give Shen Liefeng my manual',
        'I press it into her hand',
        'I pass it to him',
        'I put ten stones on the table',
        'I hand over what I am carrying to her',
        'I give him my spare pill and want nothing back',
        'I let him keep the blade',
        'I want her to have this'
    ],
    inventory: [
        'what am I carrying',
        'what is in my pack',
        'let me see my belongings',
        'check the pouch',
        'what things do I have on me',
        'show me my inventory',
        'how many spirit stones do I have left',
        'I take stock of what I own'
    ],
    consume_pill: [
        'I swallow the pill',
        'I take the medicine',
        'I use the elixir I am carrying',
        'I down the healing pill',
        'I take one of my pills',
        'time to take the pill',
        'I crack open the vial and drink it'
    ],
    list_techniques: [
        'what arts do I know',
        'which methods am I practising',
        'remind me what I have learned',
        'list the techniques I hold',
        'what have I actually been taught',
        'what can I learn',
        'what arts are open to me',
        'show me the arts I could learn',
        'is there anything I could learn with my spirit root'
    ],
    learn_technique: [
        'I learn the art from the manual',
        'I take up the method in this book',
        'I study the canon properly',
        'I read the manual and commit it',
        'I want to pick up a new art',
        'I begin the art this book teaches',
        'I want to learn this technique',
        'I start on the sword method for the first time',
        'I read the canon until I can actually use it'
    ],
    acquisition: [
        'how does somebody like me get hold of a manual',
        'what are the ways to come by an art',
        'where would I even find a book at all',
        'how do people without money get taught',
        'what are my options for getting a method',
        'is being taught the only way to a better art'
    ],
    ceiling: [
        'how far will this method carry me',
        'is there a limit to what I know',
        'what is the highest this art goes',
        'where does what I am practising run out',
        'can this canon take me past the next realm',
        'why is my progress stalled',
        'what is stopping me from getting stronger',
        'am I stuck',
        'what is my ceiling',
        'is it the manual or the ground that is failing me',
        'what has to change before I can climb again'
    ],
    teacher: [
        'who would teach me',
        'is there anybody who would take me on',
        'I need a master',
        'who around here could show me anything',
        'I want somebody to study under',
        'is there a teacher for someone like me',
        'who stands above me and might pass something on',
        'I need somebody further along to guide me'
    ],
    destinations: [
        'where could I go from here',
        'what places are within reach',
        'what is near this town',
        'where else could I be',
        'what other ground is there',
        'what options do I have if I leave here',
        'what is out there worth going to',
        'is there anywhere with better energy for cultivating',
        'what is on the other side of these mountains',
        // The five below were filed under `roads` and are about PHYSICAL
        // ROUTES, which is this verb's subject and not that one's. `roads`
        // reads what the ground within reach would teach; getting somewhere is
        // priced here, in days off the region connections, with the fold range
        // and the Shrinking Earth Pavilion counter under it. See
        // `a-route-question-is-not-a-dao-question.test.ts` for the measurement
        // that moved them and for what it cost to leave them where they were.
        'how do I get to the mountain from here',
        'which way does the road run',
        'what is the route out of this place',
        'what road takes me there',
        'how far is it and by which way'
    ],
    // Every one of these asks what somewhere would TEACH. The verb reads the
    // player's own knowledge rows joined to the dao-ground catalog and names no
    // place they could not already name, so a sentence asking how to reach
    // anywhere is not one of its own however much it sounds like the word.
    //
    // The last two are replacements rather than additions. Five of the eight
    // that were here went to `destinations` and took the word `road` with them,
    // so one line has to hold that word in ITS OTHER SENSE or "teach me a road"
    // sits nearer five route sentences than anything left behind. And the
    // comprehension phrasing is here because it was measured reaching nothing
    // at all - not the table, not the tier - while the verb it belongs to was
    // carrying five sentences it cannot answer.
    roads: [
        'what can this ground teach me',
        'is there ground around here that teaches a dao',
        'does this mountain teach anything',
        'what would I comprehend if I sat here',
        'is there anywhere near here that would teach me a road'
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
        'I pass the time until something changes',
        'I wait three days',
        'I wait for him to come back',
        'I wait for the storm to pass'
    ],
    work: [
        'I look for work',
        'I need money and will take a job',
        'is there anything here I can do for pay',
        'I hire myself out for a season',
        'I take whatever labour is going',
        'is anybody hiring around here',
        'I earn my keep somewhere',
        'I do odd jobs until I have some stones',
        'I hire on as a caravan hand'
    ],
    market: [
        'what is for sale here',
        'is anybody selling anything',
        'show me the stalls',
        'what can I get in this place',
        'what does this town have to trade',
        'what do the merchants have',
        'I want to know the prices here',
        'does anywhere here deal in pills'
    ],
    sect: [
        'what sects are there',
        'which houses take people',
        'I want to join a sect',
        'tell me about the houses near here',
        'can I sign on with one of them',
        'what would it take to be admitted',
        'I resign from the sect',
        'I take a duty off the sect board',
        'I draw my stipend',
        'I want a promotion inside the sect',
        'how does my own house see me',
        'what has the house called me in for',
        'I skim from the sect treasury',
        'I pay into the house ledger',
        'can I sit in at their house without joining'
    ],
    site: [
        'what ruins are there around here',
        'is there anything worth digging into nearby',
        'I go and look at the old gate',
        'I want to get inside the sealed place',
        'what old ground is there to search',
        'I go into the tomb',
        'I take whatever is behind the door',
        'I loot the tomb'
    ],
    legacy: [
        'I want to leave something behind for whoever comes after',
        'who gets my things when I die',
        'I set down what is to happen to what I hold',
        'I put my affairs in order before the end',
        'I leave an inheritance',
        'I bury my stones where nobody will find them',
        'I dig up the cache I left',
        'who would hold something for me for two hundred years',
    ],
    petition: [
        'I put my case to the elders',
        'I take it up the chain to somebody who matters',
        'I ask the house for what I am owed',
        'I petition for a grant',
        'I want this heard higher up',
        'I file a requisition for one of their pills',
        'I press my claim of descent with the registry',
        'I ask the sect for an exemption from this',
        'who do I write to for a dispensation'
    ],
    posture: [
        'I make it plain I am not to be pushed',
        'I stand my ground where they can see it',
        'I declare where we stand',
        'I show strength so it is understood',
        'I set the terms between us openly',
        'I declare war on their house',
        'I name them an enemy of my house',
        'I make peace with the other sect',
        'who is my house allied to',
        'I put our house under a bigger one',
        'I demand tribute from the smaller house',
        'I want the two houses to be allies'
    ],
    seal: [
        'I seal it shut',
        'I close the gate behind me and ward it',
        'I want to read what the seal says',
        'I try to wake what is sealed in there',
        'I put a seal on this place',
        'is there an ancestor sealed under our mountain',
        'what would waking the sealed ancestor cost us',
        'I wake the ancestor under our mountain',
        'I go and break the seal under their mountain'
    ],
    // ── THREE OF THESE WERE ABOUT A DIFFERENT VERB, AND IT MATTERED ──────
    //
    // `offer` is the channel through the Lid: an offering sent UP to an
    // ancestor who crossed, or an object sent DOWN a line somebody below is
    // holding. It is not barter. Three exemplars here described putting
    // something in front of a person in a market - "I put something on the
    // table in exchange", "I propose a trade to him", "I offer what I have for
    // it" - which is `request` with the `a_trade` kind, or `interact` with the
    // `trade` intent, and reaches neither.
    //
    // Found by sweeping the pattern table against this file: all three read as
    // a misroute, and the table was right about every one. The cost was not
    // only the sweep. This file IS what the model tier compares against, so
    // three barter sentences sitting under `offer` pulled every barter-shaped
    // sentence a player types towards the ancestor channel - and that tier
    // answers exactly the sentences the table cannot read, which is where a
    // player's own words land.
    offer: [
        'I make an offering',
        'I send an offering up',
        'I burn incense for the one who crossed',
        'I send a word down the line to them',
        'what is the line up to our ancestor',
        'I perform the rites for our ascended founder'
    ],
    // EVERY ONE OF THESE HAS TO NAME THE CROSSING. `DESCENT_UNAMBIGUOUS` in
    // `institution-phrasings.ts` already had the rule and said why - *nobody
    // says "I descend through the Lid" about a staircase* - and these did not
    // follow it. "I step down off it" and "I come back down" are sentences
    // about stepping off a rock, and measured against them "I step back" and
    // "I back away slowly" both reached this verb: nine strikes of the heaviest
    // tribulation in the game, off somebody backing away from an argument.
    descend: [
        'I go back down through the Lid',
        'I leave the immortal world and return to the province',
        'I go down to the mortal world myself',
        'I take the way I came, back below the Lid',
        'I make the descent back below',
        'I descend through the Lid in person',
        'I go down below the Lid rather than send anything',
        'I push down through the Lid to my old province',
        'I go down myself and take what the Lid costs'
    ],
    look: [
        'I look around',
        'what does this place look like',
        'I take in my surroundings',
        'what is going on here',
        'I have a look about me',
        'what can I see from here',
        'what place is this',
        'who else is standing here',
        'what is posted on the wall',
        'who holds this ground',
        'what happened in this place before I arrived',
        'is this place busy or empty'
    ],
    status: [
        'where do I stand',
        'how am I doing',
        'what am I',
        'tell me about myself',
        'what shape am I in',
        'what is my rank and condition',
        'what realm am I in',
        'am I strong yet',
        'how old am I'
    ],
    assess: [
        'how strong is he next to me',
        'could I take him in a fight',
        'I size the man up',
        'what is he worth against me',
        'I weigh up whether I would win',
        'what realm is she at',
        'is he above me or below me',
        'how dangerous is that beast',
        'is this place too much for me',
        'what would happen if I fought her'
    ],
    recall: [
        'what do I know about all this',
        'who have I heard of so far',
        'what have I worked out',
        'what is in my head about this',
        'what understanding have I come to',
        'what dao have I comprehended'
    ],
    recognise: [
        'whose art is that',
        'do I know what school that comes from',
        'I have seen that form somewhere before',
        'is that their house style',
        'can I place the method he is using',
        'where did he learn that',
        'is that technique from around here'
    ],
    news: [
        'what are people saying',
        'any word from elsewhere',
        'what is the talk here',
        'has anything happened in the world',
        'what rumours are going about',
        'what news is there',
        'I listen for rumours',
        'what have you heard'
    ],
    // The other direction of the same word, and the exemplars have to keep it
    // apart from `news` above and from `interact`'s ordinary conversation. Every
    // one of them names a second person AND says something was done to somebody:
    // a sentence with only one of those halves is one of the neighbours.
    tell: [
        'I tell him that Cao Antao killed his brother',
        'I let her know who killed her master',
        'I tell the elder what happened to his disciple',
        'I inform him that his brother is dead',
        'I tell him that I killed his brother',
        'I name the killer to his brother',
    ],
    request: [
        'I ask him to teach me',
        'I beg her to take me as a disciple',
        'I ask him for the manual',
        'I want him to put in a word for me',
        'I ask her to let me into the house',
        'I ask her to lend me her blade',
        'I ask the steward to introduce me to his master',
        'I ask him to trade me the pill for my herbs',
        'I ask her for the name of whoever sent him'
    ],
    guard: [
        'I stand guard while she crosses',
        'I watch over his breakthrough',
        'I protect her while she attempts it',
        'I act as her dao protector',
        'I keep watch over the crossing',
        'who would stand guard for me',
        'I stand over her while she takes the tribulation'
    ],
    propose: [
        'I propose a match to the Xu',
        'I ask them to marry me',
        'I want to marry into that house',
        'I offer their family a match for one of theirs',
        'I put a marriage to the head of the clan',
        'I accept the match they have offered',
        'I agree to the betrothal',
        'I send a matchmaker to the Xu house'
    ],
    decline: [
        'I refuse the match',
        'I turn down the proposal',
        'I will not go through with this marriage',
        'I say no to the betrothal',
        'I run from the marriage they arranged',
        'I walk out of the match my house made',
        'I break off the engagement',
    ],
    child: [
        'we have a child together',
        'I want a child with them',
        'I spend twenty years raising the child',
        'I bring up my daughter myself',
        'I start a family here',
        'I place my son at the Azure Cloud Pavilion',
        'I call in a favour to get my child into that house',
        'we try for a baby',
        'I adopt the orphan and raise her'
    ]
};
