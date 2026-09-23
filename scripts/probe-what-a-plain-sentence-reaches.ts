/**
 * What the plainest way of saying a thing reaches.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 *
 * `I go` reached nothing, and the cause was the defect AGENTS.md opens with:
 * `goes?` matches "goe" and "goes" and never "go", exactly as `\bcultivat\b`
 * could never match "cultivate". A bare ordinary sentence reaching nothing is
 * worse than an exotic one failing - it is what somebody types when they are
 * not thinking about the parser - and four of them missing at once is unlikely
 * to be four isolated accidents.
 *
 * So this is a corpus of what a person actually types at a table, in three
 * shapes for each thing they might mean:
 *
 *   bare        the verb on its own: "I wait", "I flee", "I ask"
 *   plainest    the flattest full sentence: "I ask the elder about the manual"
 *   second      the next synonym anybody would reach for: "I speak to her"
 *
 * It is not a grammar sweep and is not trying to be exhaustive. Every row is a
 * sentence somebody would type.
 *
 * ── WHAT IT REPORTS ──────────────────────────────────────────────────────
 *
 *   reached nothing   `unclear`. The sentence was read and answered with a
 *                     blank look
 *   went elsewhere    it reached a verb, and not the one the sentence means.
 *                     The expectation in each row is a JUDGEMENT, written
 *                     before the run; a row flagged here is a question rather
 *                     than a defect
 *
 * A row's expectation may be a verb (`move`) or a verb and an intent
 * (`move/flee`). Rows expecting `?` are ones where the right verb is itself the
 * open question, and they are only ever reported as what they reached.
 *
 * Run: npx tsx scripts/probe-what-a-plain-sentence-reaches.ts
 */
import { parseIntent } from '../src/web/actions.js';
import { ASKING_WHAT_IS_POSSIBLE } from '../src/web/what-is-worth-doing-standing-here.js';
import { anActNothingAnswers } from '../src/web/an-act-nothing-in-the-world-answers.js';

/** A sentence, and what somebody typing it plainly means by it. */
type Row = readonly [said: string, expected: string];

const CORPUS: readonly Row[] = [
    // ── THE BARE VERB ────────────────────────────────────────────────────
    ['I wait', 'wait'],
    ['I rest', 'wait'],
    ['I look', 'look'],
    ['I look around', 'look'],
    ['I listen', '?'],
    ['I cultivate', 'cultivate'],
    ['I meditate', 'cultivate'],
    ['I train', '?'],
    ['I flee', 'move/flee'],
    ['I run', 'move/flee'],
    ['I go', 'move/flee'],
    ['I leave', 'move/flee'],
    ['I hide', '?'],
    ['I ask', '?'],
    ['I ask around', 'news'],
    ['I hunt', 'hunt'],
    ['I forage', 'gather'],
    ['I gather herbs', 'gather'],
    ['I eat', 'eat'],
    ['I sleep', 'wait'],
    ['I work', 'work'],
    ['I practise', '?'],
    ['I breakthrough', 'breakthrough'],
    ['I push through', 'breakthrough'],
    ['I check my inventory', 'inventory'],
    ['what am I carrying', 'inventory'],
    ['who am I', 'status'],
    ['how am I doing', 'status'],
    ['where am I', '?'],
    ['what can I do', '?'],
    ['what should I do', '?'],
    ['what now', '?'],
    ['help', '?'],
    ["I don't know what to do", '?'],
    ['I want to get stronger', '?'],
    ['what is around here', 'look'],
    ['who is here', 'look'],

    // ── THE PLAINEST FULL SENTENCE ───────────────────────────────────────
    ['I ask the elder about the manual', '?'],
    ['I ask him about the sect', '?'],
    ['I talk to the guard', 'interact'],
    ['I speak to her', 'interact'],
    ['I greet the old man', 'interact'],
    ['I thank him', '?'],
    ['I apologise to her', 'interact'],
    ['I bow to the elder', '?'],
    ['I give him my name', '?'],
    ['I follow the road north', 'move'],
    ['I walk to the village', 'move'],
    ['I go into the cave', '?'],
    ['I climb the mountain', 'move'],
    ['I search the body', '?'],
    ['I loot the corpse', '?'],
    ['I pick up the sword', '?'],
    ['I drop the sword', '?'],
    ['I put on the robes', '?'],
    ['I read the manual', '?'],
    ['I study the manual', '?'],
    ['I learn the technique', 'learn_technique'],
    ['I practise the sword form', '?'],
    ['I cultivate for a year', 'cultivate'],
    // Cultivation, and measured to be right: misparse.test.ts writes the ruling
    // down - sitting for a span is cultivating, and what makes it seclusion is
    // the door being shut ("I seal the cave for ten years").
    ['I sit in seclusion for ten years', 'cultivate'],
    ['I try to break through', 'breakthrough'],
    ['I take the pill', 'consume_pill'],
    ['I swallow a healing pill', 'consume_pill'],
    ['I treat my wounds', 'treat'],
    ['I rest until I am healed', '?'],
    ['I buy a sword', 'buy'],
    ['I sell my herbs', 'sell'],
    ['I haggle with the merchant', '?'],
    ['I ask the price', '?'],
    ['I steal the manual', '?'],
    ['I attack the bandit', 'attack'],
    ['I draw my sword', '?'],
    ['I surrender', '?'],
    ['I yield', '?'],
    ['I beg for mercy', '?'],
    ['I chase after him', '?'],
    ['I wait for him to come back', 'wait'],
    ['I hide from them', 'move/flee'],
    ['I join the sect', 'sect'],
    ['I ask to join the sect', 'sect'],
    ['I leave the sect', 'sect/leave'],
    ['I ask for a promotion', 'sect/promote'],
    ['I collect my stipend', 'sect/stipend'],
    ['I take a job from the board', 'sect/duty'],
    ['I look at the board', '?'],
    ['I ask my master for help', '?'],
    ['I kneel to him', '?'],
    ['I take him as my disciple', 'sect/recruit'],
    ['I tell her what happened', '?'],
    ['I lie to him', 'interact'],
    ['I threaten him', 'interact'],
    ['I bribe the guard', 'interact'],
    ['I offer him stones', '?'],
    ['I help her', '?'],
    ['I save him', '?'],
    ['I bury the body', '?'],
    ['I pray', '?'],
    ['I meditate on the dao', '?'],
    ['I think about what to do', '?'],
    ['I wait and see', 'wait']
];

interface Reached {
    said: string;
    expected: string;
    action: string;
    intent: string | null;
}

const read = ([said, expected]: Row): Reached => {
    const plan = parseIntent(said);
    return { said, expected, action: plan.action, intent: plan.intent ?? null };
};

const asSaid = (r: Reached) => `${r.action}${r.intent ? `/${r.intent}` : ''}`;
const matches = (r: Reached) =>
    r.expected === '?' || asSaid(r) === r.expected || r.action === r.expected;

/**
 * `unclear` IS NOT THE END OF THE ROAD, and reading it as one is how this probe
 * first over-counted by seven. Two families are answered inside the `unclear`
 * branch of the turn engine, before any refusal is composed:
 *
 *   the stuck question   `ASKING_WHAT_IS_POSSIBLE` -> the guidance answer
 *   an act alone         `anActNothingAnswers` -> it happened, nothing followed
 *
 * A sentence in either is answered. Only what falls past both reaches nothing.
 */
const alreadyAnswered = (said: string): string | null => {
    if (ASKING_WHAT_IS_POSSIBLE.test(said)) return 'the stuck-player answer';
    const alone = anActNothingAnswers(said);
    return alone === null ? null : `an act alone (${alone})`;
};

const all = CORPUS.map(read);
const blank = all.filter(r => r.action === 'unclear');
const answeredBelow = blank.filter(r => alreadyAnswered(r.said) !== null);
const nothing = blank.filter(r => alreadyAnswered(r.said) === null);
const elsewhere = all.filter(r => r.action !== 'unclear' && !matches(r));
const open = all.filter(r => r.expected === '?' && r.action !== 'unclear');

console.log(`${all.length} sentences.\n`);
console.log(`── REACHED NOTHING (${nothing.length}) ──`);
for (const r of nothing) console.log(`  ${r.said.padEnd(38)} expected ${r.expected}`);
console.log(`\n── UNCLEAR, AND ANSWERED BELOW IT (${answeredBelow.length}) ──`);
for (const r of answeredBelow) console.log(`  ${r.said.padEnd(38)} ${alreadyAnswered(r.said)}`);
console.log(`\n── WENT ELSEWHERE (${elsewhere.length}) ──`);
for (const r of elsewhere) console.log(`  ${r.said.padEnd(38)} ${asSaid(r).padEnd(22)} expected ${r.expected}`);
console.log(`\n── OPEN, AND WHAT THEY REACH (${open.length}) ──`);
for (const r of open) console.log(`  ${r.said.padEnd(38)} ${asSaid(r)}`);
