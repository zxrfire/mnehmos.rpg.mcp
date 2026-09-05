/**
 * Does any verb come back as "It is done. Nothing about it drew attention."?
 *
 * The web layer turns a tool result into prose in `summariseToolBody`, which
 * is a list of branches keyed on what the result carries - `worked`, `joined`,
 * `consumed`, `petitioned` and the rest. A verb whose result shape has no
 * branch does not fail: it falls through to the last-resort line, which says
 * nothing and reads as if the engine had shrugged.
 *
 * That line exists for a reason and is a reasonable floor. What it must never
 * be is the answer to a verb the engine handled perfectly well, and it has
 * been exactly that three times in one session:
 *
 *   combat     "Broken off. Both parties are worse than they were" and no
 *              mention of the two thirds of the HP it took or the wound
 *   work       wages reported for four years while untreated wounds piled up
 *   petition   the whole journey of a petition - how far it climbed, every
 *              stop, the names learned carrying it - reduced to "It is done."
 *
 * Each was found by playing rather than by testing, because a fallback that
 * reads as ordinary English is invisible to anything except a person reading
 * it and asking "and then what happened?". This is the cheap version of that
 * person: one plain sentence per verb, and a check that the answer is not the
 * shrug.
 *
 * It is a probe rather than a test because the phrasings below are one
 * reasonable sentence each, not a contract - `tests/web/coverage.test.ts` owns
 * the question of whether a verb is reachable at all.
 *
 *   npx tsx scripts/probe-does-every-verb-say-what-happened.ts
 */

import { makeGame } from '../tests/web/harness.js';
import { ACTION_NAMES } from '../src/web/actions.js';

/** The lines that mean "a branch was missing", in either of their forms. */
const SHRUG = /It is done\. Nothing about it drew attention\.|the engine resolved it/i;

/** One plain sentence per verb. `unclear` is the fallback and has no phrasing. */
const SAY: Record<string, string> = {
    look: 'I look around',
    status: 'what is my situation',
    cultivate: 'I cultivate for a month',
    seclude: 'I go into closed-door seclusion for a month',
    breakthrough: 'I try to break through',
    move: 'I travel to Green Water City',
    interact: 'I talk to the nearest cultivator',
    investigate: 'I examine the stele',
    train_technique: 'I train',
    refine: 'I make a pill',
    gather: 'I look for herbs',
    work: 'I take whatever work there is',
    market: 'what can I buy',
    buy: 'I buy a month of rations',
    eat: 'I eat',
    sell: 'I sell my herbs',
    learn_technique: 'I learn the Lesser Qi-Gathering Manual',
    sect: 'what sects are there',
    attack: 'I attack the nearest cultivator',
    assess: 'could I survive that',
    inventory: 'what am I carrying',
    wait: 'I wait',
    teacher: 'who can teach me',
    ceiling: 'what is stopping me',
    destinations: 'where can I go',
    site: 'what ruins are near',
    legacy: 'who holds deposits',
    petition: 'I petition the Azure Dew Sect',
    recall: 'what do I know',
    treat: 'I treat my wounds',
    provision: 'I buy provisions for a year',
    // Taken from `tests/web/coverage.test.ts`, which already owns one worked
    // phrasing per verb - no reason for two lists to drift apart.
    consume_pill: 'I swallow a healing pill',
    list_techniques: 'what arts can I learn',
    acquisition: 'how do I get further',
    posture: 'I declare war on the Nine Abyss Flame Sect',
    seal: 'I wake our sealed ancestor',
    offer: 'I make an offering to our ascended ancestor',
    descend: 'I go back down'
};

const line = (s = '') => console.log(s);
const shrugged: string[] = [];
const unphrased: string[] = [];

// The world is ON, because that is how the game runs. With it off, half the
// guards that make an answer specific are skipped - see AGENTS.md.
for (const name of ACTION_NAMES as readonly string[]) {
    const phrase = SAY[name];
    if (!phrase) { unphrased.push(name); continue; }

    const { game } = makeGame({ seed: `verbs-${name}`, worldEnabled: true });
    await game.newRun('Probe Subject');
    const result = await game.act(phrase);
    const said = (result.narration
        ?? (result as unknown as { error?: string }).error
        ?? '').trim();

    if (said.length === 0) shrugged.push(`${name.padEnd(16)} EMPTY`);
    else if (SHRUG.test(said)) shrugged.push(`${name.padEnd(16)} ${said.slice(0, 70)}`);
}

line();
if (unphrased.length > 0) {
    line(`  No phrasing for: ${unphrased.join(', ')}`);
    line('  (`unclear` is the fallback action and correctly has none.)');
    line();
}

if (shrugged.length === 0) {
    line('  Every verb says what happened. None falls through to the last-resort line.');
} else {
    line('  THESE VERBS SHRUG. The engine handled them and the player was told nothing:');
    line();
    for (const s of shrugged) line('    ' + s);
    line();
    line('  Each wants a branch in `summariseToolBody` reading the fields its handler');
    line('  already returns. The result is rich in every case found so far; only the');
    line('  sentence was missing.');
}
line();
