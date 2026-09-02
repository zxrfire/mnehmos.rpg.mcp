/**
 * A player-command corpus with ground truth, for benchmarking the local
 * intent layer without a model.
 *
 * Written from the PLAYER's side: for each verb, the ways somebody would
 * actually say it, in two tiers.
 *
 *   plain    the obvious phrasing, and the near-synonyms of it. This is the
 *            "common commands" the 95% bar is about.
 *   oblique  natural, indirect, or conversational ways of asking for the same
 *            thing. Not exotic - things a person types on turn three when they
 *            have stopped writing commands and started talking.
 *
 * Deliberately NOT harvested from the test suite. Every sentence in
 * `coverage.test.ts` passes by construction, so a corpus built from the tests
 * measures nothing at all.
 */

export interface Command {
    said: string;
    want: string;
    tier: 'plain' | 'oblique';
}

const P = (want: string, ...said: string[]): Command[] =>
    said.map(s => ({ said: s, want, tier: 'plain' as const }));
const O = (want: string, ...said: string[]): Command[] =>
    said.map(s => ({ said: s, want, tier: 'oblique' as const }));

export const CORPUS: Command[] = [
    ...P('look', 'I look around', 'look', 'look around', 'I take in my surroundings', 'what is here', 'I glance about'),
    ...O('look', 'where am I', 'what does this place look like', 'I have a look at where I am', 'describe this place', 'I get my bearings'),

    ...P('status', 'what is my situation', 'status', 'what is my rank', 'what realm am I', 'how am I doing', 'what is my cultivation level'),
    ...O('status', 'tell me about myself', 'how strong am I', 'where do I stand', 'what am I right now', 'am I hurt'),

    ...P('cultivate', 'I cultivate for a month', 'I cultivate', 'cultivate for ten years', 'I sit and cultivate for a year', 'I meditate for a month', 'I circulate my qi for a year'),
    ...O('cultivate', 'I sit down and refine my energy for a decade', 'I spend a year on my cultivation', 'I want to cultivate', 'I settle in to train my qi for a month', 'I put in a year of practice'),

    ...P('seclude', 'I go into closed-door seclusion for a month', 'I enter seclusion for ten years', 'I seclude myself for a year', 'closed door seclusion for a decade'),
    ...O('seclude', 'I shut myself away for twenty years', 'I lock the door and do not come out for a decade', 'I go into retreat for a year'),

    ...P('breakthrough', 'I try to break through', 'I attempt a breakthrough', 'breakthrough', 'I push for the next realm', 'I try to advance a rank'),
    ...O('breakthrough', 'I force the bottleneck', 'I make my attempt at the next layer', 'time to break the barrier'),

    ...P('move', 'I travel to Low Fall', 'I go to Nine Peaks', 'travel to Halfwater', 'I head for the market town', 'I walk to Low Fall'),
    ...O('move', 'I set out for Nine Peaks', 'I leave for Halfwater', 'I make my way to Low Fall', 'take me to Nine Peaks'),

    ...P('interact', 'I talk to the nearest cultivator', 'I speak with the elder', 'I greet Liang Nuoru', 'I ask the merchant about the road'),
    ...O('interact', 'I strike up a conversation with the steward', 'I introduce myself to the elder', 'I have a word with Liang Nuoru'),

    ...P('investigate', 'I examine the stele', 'I investigate the shrine', 'I inspect the carving', 'I study the inscription', 'I search the ruin'),
    ...O('investigate', 'I take a closer look at the stele', 'I want to know more about that carving', 'I poke around the shrine'),

    ...P('train_technique', 'I train', 'I practise my technique', 'I drill my sword art', 'I train my method'),
    ...O('train_technique', 'I put my art through its paces', 'I rehearse the form', 'I work on my technique'),

    ...P('refine', 'I make a pill', 'I refine a pill', 'I concoct an elixir', 'I brew a pill'),
    ...O('refine', 'I put the herbs in the furnace', 'I try my hand at alchemy', 'I cook up some medicine'),

    ...P('gather', 'I look for herbs', 'I gather herbs', 'I forage for spirit grass', 'I collect ingredients'),
    ...O('gather', 'I go out looking for plants', 'I comb the hillside for anything useful', 'I pick what grows here'),

    ...P('work', 'I take whatever work there is', 'I look for work', 'I work for a year', 'I find a job', 'I take on labour'),
    ...O('work', 'I need money, I will do anything', 'I hire myself out for a season', 'I earn my keep for a year'),

    ...P('market', 'what can I buy', 'what is for sale', 'I go to the market', 'show me the market', 'what is on the stalls'),
    ...O('market', 'I want to see what the traders have', 'is there anywhere to shop', 'what do they sell here'),

    // "I buy a month of rations" is deliberately NOT here. It reaches
    // `provision`, which is right - buying rations IS provisioning - and
    // labelling it `buy` would have been the corpus reporting itself as an
    // engine defect. `probe-does-every-verb-say-what-happened.ts` carries it
    // under `buy`, and that list is wrong about this one.
    ...P('buy', 'I buy a healing pill', 'I purchase a sword'),
    ...O('buy', 'I pick up some food from the stall', 'I part with some stones for a pill'),

    ...P('eat', 'I eat', 'I eat a meal', 'I have something to eat'),
    ...O('eat', 'I am hungry', 'I break my fast', 'I get some food in me'),

    ...P('sell', 'I sell my herbs', 'I sell the sword', 'I offload my spirit grass'),
    ...O('sell', 'I take the herbs to a buyer', 'I trade away what I gathered'),

    ...P('learn_technique', 'I learn the Lesser Qi-Gathering Manual', 'I study the manual', 'I take up the Lesser Qi-Gathering Manual'),
    ...O('learn_technique', 'I open the book and start reading it properly', 'I begin on the manual I was given'),

    ...P('sect', 'what sects are there', 'I join the Azure Dew Sect', 'I donate 100 spirit stones to the sect', 'what sects can I join'),
    ...O('sect', 'is there a house that would take me', 'I want to join a sect', 'which schools are around here'),

    ...P('attack', 'I attack the nearest cultivator', 'I fight Xiao Wanping', 'I strike the bandit', 'I kill the disciple'),
    ...O('attack', 'I draw on him', 'I go for the bandit', 'I settle this with my fists'),

    ...P('assess', 'could I survive that', 'can I beat him', 'what are my chances', 'how dangerous is he'),
    ...O('assess', 'would I win that fight', 'is that a fight I can take', 'am I out of my depth'),

    ...P('inventory', 'what am I carrying', 'inventory', 'what do I have', 'what is in my bag'),
    ...O('inventory', 'let me check my things', 'what have I got on me', 'show me my possessions'),

    ...P('wait', 'I wait', 'I do nothing', 'I rest'),
    ...O('wait', 'I let some time pass', 'I sit tight for a while'),

    ...P('teacher', 'who can teach me', 'who could teach me', 'is there a teacher here', 'who would take me as a student'),
    ...O('teacher', 'I need somebody to show me how', 'who around here knows more than me'),

    ...P('ceiling', 'what is stopping me', 'why am I stuck', 'what is holding me back', 'why is my progress stalled'),
    ...O('ceiling', 'I am not getting anywhere, why', 'nothing is happening when I cultivate'),

    ...P('destinations', 'where can I go', 'what places can I travel to', 'where could I go from here'),
    ...O('destinations', 'what is nearby', 'what are my options for leaving'),

    ...P('site', 'what ruins are near', 'are there any ruins', 'what abandoned places are there'),
    ...O('site', 'is there anywhere old worth digging in', 'any lost caves around'),

    ...P('legacy', 'who holds deposits', 'what legacies are there', 'who left something behind'),
    ...O('legacy', 'is there an inheritance to claim'),

    ...P('petition', 'I petition the Azure Dew Sect', 'I ask the sect for a manual', 'I appeal to the elder'),
    ...O('petition', 'I put a request to the sect', 'I go to the elders and ask for help'),

    ...P('recall', 'what do I know', 'what have I learned', 'what do I remember'),
    ...O('recall', 'go over what I have picked up so far', 'remind me what I know'),

    ...P('treat', 'I treat my wounds', 'I see a healer', 'I get my injuries seen to', 'I bandage myself'),
    ...O('treat', 'I need a doctor', 'I do something about this wound'),

    ...P('provision', 'I buy provisions for a year', 'I buy 200 rations', 'I lay in supplies for a decade'),
    ...O('provision', 'I stock up before I sit down', 'I get enough food to last ten years'),

    ...P('consume_pill', 'I swallow a healing pill', 'I take a pill', 'I eat the elixir'),
    ...O('consume_pill', 'I down the medicine I bought', 'I use the pill on myself'),

    ...P('list_techniques', 'what arts can I learn', 'what techniques are available', 'what methods could I take up'),
    ...O('list_techniques', 'what is out there for someone like me to study'),

    ...P('acquisition', 'how do I get further', 'how do I get past this', 'what would let me advance'),
    ...O('acquisition', 'I have run out of manual, what now'),

    ...P('posture', 'I declare war on the Nine Abyss Flame Sect', 'I make peace with the Azure Dew Sect'),
    ...O('posture', 'we are enemies of the Nine Abyss Flame Sect from now on'),

    ...P('seal', 'I wake our sealed ancestor', 'I break the seal'),
    ...O('seal', 'I rouse the one sleeping under the mountain'),

    ...P('offer', 'I make an offering to our ascended ancestor', 'I offer incense at the shrine'),
    ...O('offer', 'I leave a tribute for the ancestor'),

    // "I descend the mountain" is deliberately NOT labelled `descend`, and
    // that is a correction to this corpus rather than a gap in the parser.
    // `descend` crosses the Lid: it is the most expensive sentence in the
    // game, taken once, and it ends the footing the whole run stands on.
    // Walking down a mountain is `move`, which is what somebody typing that
    // sentence almost always means - `actions.ts` says so in a banner, having
    // already ruled that a bare "I go down" must not be enough. Labelling it
    // `descend` reported a correct refusal as a defect, and acting on it could
    // have ended a run by accident.
    ...P('descend', 'I go back down', 'I go back down through the Lid'),
    ...O('descend', 'I return to the lower world')
];
