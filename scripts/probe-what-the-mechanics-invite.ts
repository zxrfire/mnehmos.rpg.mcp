/**
 * What a player says back once a mechanic has told them it is there.
 *
 * ── WHY THIS IS A DIFFERENT SWEEP ────────────────────────────────────────
 *
 * `probe-what-a-plain-sentence-reaches.ts` covers the general verbs - the
 * sentences somebody types at a table whatever is going on. This one covers the
 * sentences a MECHANIC INVITES: the screen says there is a lecture, a board, a
 * posting, a talisman, a challenge, and the player says the obvious thing back.
 *
 * A miss here is worse than a miss there. Somebody who types the obvious
 * sentence and is answered about something else has been told the mechanic is
 * not in the game, and that is the whole of what they learn.
 *
 * ── THE THREE READINGS ───────────────────────────────────────────────────
 *
 *   WENT ELSEWHERE   reached a verb, and not the one the sentence means. The
 *                    worst of the three and reported first.
 *   REACHED NOTHING  `unclear`, and not answered further down either - the
 *                    stuck-player read and the acts-alone read are both
 *                    consulted here, for the reason the other probe learnt.
 *   OPEN             the expectation is `?` because what it should reach is
 *                    the question. Reported as what they reach.
 *
 * Every expectation was written before the run.
 *
 * Run: npx tsx scripts/probe-what-the-mechanics-invite.ts
 */
import { parseIntent } from '../src/web/actions.js';
import { ASKING_WHAT_IS_POSSIBLE } from '../src/web/what-is-worth-doing-standing-here.js';
import { anActNothingAnswers } from '../src/web/an-act-nothing-in-the-world-answers.js';

type Row = readonly [said: string, expected: string, family: string];

const CORPUS: readonly Row[] = [
    // ── LECTURES ─────────────────────────────────────────────────────────
    ['I go to the lecture', 'teach/listen', 'lectures'],
    ['I attend the lecture', 'teach/listen', 'lectures'],
    ['I listen to the elder', 'teach/listen', 'lectures'],
    ['I sit in on it', 'teach/listen', 'lectures'],
    ['I sit in on the lecture', 'teach/listen', 'lectures'],
    ['I give a lecture', 'teach/lecture', 'lectures'],

    // ── POSTINGS AND THE BOARD ───────────────────────────────────────────
    // MEASURED, AND THE EXPECTATION WAS WRONG: a posting is put TO somebody and
    // saying yes to one is `sect/accept`. The board's own words - job, task,
    // duty, commission - are the other list, and `sect/duty` keeps them.
    ['I take the post', 'sect/accept', 'board'],
    ['I check the board', 'sect/duty', 'board'],
    ['I look at the board', 'sect/duty', 'board'],
    ['I take that task', 'sect/duty', 'board'],
    ['I take a job from the board', 'sect/duty', 'board'],
    ['I report back', '?', 'board'],
    ['I accept the posting', 'sect/accept', 'board'],

    // ── HANDING IN ───────────────────────────────────────────────────────
    ['I turn in the manual', 'sect/hand_in', 'handing in'],
    ['I hand it to the sect', 'sect/hand_in', 'handing in'],
    ['I hand the herb in to my sect', 'sect/hand_in', 'handing in'],
    ['I give the book to the elder', 'give', 'handing in'],

    // ── TALISMANS AND JADE ───────────────────────────────────────────────
    ['I send word to my master', '?', 'talismans'],
    ['I break the talisman', '?', 'talismans'],
    ['I use the jade', '?', 'talismans'],
    ['I send a message to the sect', '?', 'talismans'],
    ['I cut a talisman', '?', 'talismans'],

    // ── CHALLENGES AND DUELS ─────────────────────────────────────────────
    // MEASURED, AND THE EXPECTATION WAS WRONG: `challenge` is challenging
    // somebody's ACCOUNT of themselves. A duel between two people who agreed
    // to it is `attack` carrying `terms: 'agreed'`, which is what these are.
    ['I challenge him', 'attack', 'duels'],
    ['I accept the challenge', '?', 'duels'],
    ['I refuse the duel', '?', 'duels'],
    ['I step in', '?', 'duels'],
    ['I fight him to the death', 'attack', 'duels'],
    ['I challenge him to a duel', 'attack', 'duels'],

    // ── MASTER AND DISCIPLE ──────────────────────────────────────────────
    ['I ask him to teach me', 'request/teaching', 'master'],
    ['I ask to be his disciple', 'request/discipleship', 'master'],
    ['I kneel and ask', '?', 'master'],
    ['I end our bond', 'request/ending_a_bond', 'master'],
    ['I take her as my disciple', 'sect/recruit', 'master'],
    ['I ask her to take me on', 'request/discipleship', 'master'],

    // ── JOINING AND LEAVING A HOUSE ──────────────────────────────────────
    ['I ask to join', 'sect', 'house'],
    ['I ask to join the sect', 'sect/join', 'house'],
    ['I take the oath', '?', 'house'],
    ['I leave the sect', 'sect/leave', 'house'],
    ['I ask for the robes', '?', 'house'],

    // ── THE GATE AND THE COMPOUND ────────────────────────────────────────
    ['I go to the lecture hall', 'move', 'gate'],
    ['I find the punishment elder', '?', 'gate'],
    ['I show my token', '?', 'gate'],
    ['I sneak in', '?', 'gate'],
    ['I walk up to the gate', 'move', 'gate'],

    // ── CRAFT ────────────────────────────────────────────────────────────
    ['I commission a sword', '?', 'craft'],
    ['I ask him to make me a pill', '?', 'craft'],
    ['I work at the cauldron', '?', 'craft'],
    ['I refine a healing pill', 'refine', 'craft'],

    // ── MERIT AND RANK ───────────────────────────────────────────────────
    ['I ask for a promotion', 'sect/promote', 'merit'],
    ['I check my merit', '?', 'merit'],
    ['I ask what I am owed', '?', 'merit'],
    ['I collect my stipend', 'sect/stipend', 'merit']
];

interface Reached {
    said: string;
    expected: string;
    family: string;
    action: string;
    intent: string | null;
}

const read = ([said, expected, family]: Row): Reached => {
    const plan = parseIntent(said);
    return { said, expected, family, action: plan.action, intent: plan.intent ?? null };
};

const asSaid = (r: Reached) => `${r.action}${r.intent ? `/${r.intent}` : ''}`;
const matches = (r: Reached) =>
    r.expected === '?' || asSaid(r) === r.expected || r.action === r.expected;

/** The two families the `unclear` branch answers before any refusal. */
const answeredBelow = (said: string): string | null => {
    if (ASKING_WHAT_IS_POSSIBLE.test(said)) return 'the stuck-player answer';
    const alone = anActNothingAnswers(said);
    return alone === null ? null : `an act alone (${alone})`;
};

const all = CORPUS.map(read);
const blank = all.filter(r => r.action === 'unclear');
const nothing = blank.filter(r => answeredBelow(r.said) === null);
const elsewhere = all.filter(r => r.action !== 'unclear' && !matches(r));
const open = all.filter(r => r.expected === '?' && r.action !== 'unclear');
const right = all.filter(r => r.expected !== '?' && r.action !== 'unclear' && matches(r));

console.log(`${all.length} sentences, ${right.length} reaching what was expected.\n`);
console.log(`── WENT ELSEWHERE (${elsewhere.length}) ──`);
for (const r of elsewhere) {
    console.log(`  [${r.family}] ${r.said.padEnd(34)} ${asSaid(r).padEnd(22)} expected ${r.expected}`);
}
console.log(`\n── REACHED NOTHING (${nothing.length}) ──`);
for (const r of nothing) console.log(`  [${r.family}] ${r.said.padEnd(34)} expected ${r.expected}`);
console.log(`\n── OPEN, AND WHAT THEY REACH (${open.length}) ──`);
for (const r of open) console.log(`  [${r.family}] ${r.said.padEnd(34)} ${asSaid(r)}`);
