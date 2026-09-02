/**
 * Does a verb answer to its own name?
 *
 * The cheapest thing a player types, and usually the first: the bare word.
 * Measured while the spelling repair was being written, and it is the reason
 * the design owner's own worked example did not work end to end - `inventroy`
 * respells to `inventory` correctly, and `inventory` typed on its own reached
 * nothing at all. The typo was never the problem there.
 *
 *     17 of 40  before `theVerbsOwnName`
 *     26 of 40  after, and every remaining miss is a refusal
 *
 * Both the numerator and the denominator move as verbs are added, and that is
 * the rule working rather than the measurement rotting. `recognise` arrived on
 * another branch while this was being written and answered to its own name the
 * moment it landed, because it is on `READ_ONLY_ACTIONS` and nothing else was
 * required of its author. A verb that needs a target or spends something will
 * show up here as a miss instead, which is the correct answer for it.
 *
 * The second number is the honest ceiling of the safe fix rather than a
 * stopping point chosen for convenience. `theVerbsOwnName` answers a bare word
 * only when the verb it names is on `READ_ONLY_ACTIONS`, so it can never cost
 * a day, a stone or a life - and the fourteen it declines are declined because
 * they take something, or need a target a single word cannot supply. Two of
 * them, `descend` and `seal`, must never be reachable this way at all.
 *
 * What DID change for all fourteen: none of them is swallowed any more.
 * `seclude` used to reach `cultivate` and `market` used to reach `interact`,
 * so a bare word silently bought a different action; now every miss is
 * `unclear`, which costs nothing and names three things that would have
 * worked.
 *
 * This is the sibling of `probe-does-every-verb-say-what-happened.ts`: that
 * one asks whether a verb SAYS anything, this one asks whether a player can
 * get to it by naming it. Neither is a test - `coverage.test.ts` owns whether
 * a verb is reachable by SOME phrasing, and every one of them is. What this
 * measures is whether the most obvious phrasing is among them, which is the
 * standing rule in AGENTS.md: if a near-synonym works, the phrasing that
 * fails is a bug, and the failing half is usually the more natural one.
 *
 * A miss here is not automatically something to fix, and this must not be
 * swept. Some of these words are genuinely ambiguous - a bare `offer`, `seal`
 * or `move` sits next to several verbs - and a bare word that swallows the
 * verb next door is worse than one that refuses and names three things that
 * would have worked. Read the list; take them one at a time.
 *
 *   npx tsx scripts/probe-does-every-verb-answer-to-its-own-name.ts
 */

import { ACTION_NAMES, parseIntent } from '../src/web/actions.js';

const playable = ACTION_NAMES.filter(name => name !== 'unclear');
const missed: string[] = [];

for (const name of playable) {
    // The name as a player would type it: `train_technique` is "train technique".
    const bare = name.replace(/_/g, ' ');
    const reached = parseIntent(bare).action;
    if (reached !== name) missed.push(`${bare.padEnd(17)} -> ${reached}`);
}

console.log(
    `\n  ${playable.length - missed.length} of ${playable.length} action names `
    + 'reach their own verb when typed bare.\n'
);

if (missed.length === 0) {
    console.log('  Every verb answers to its own name.\n');
} else {
    console.log('  These do not:\n');
    for (const line of missed) console.log(`    ${line}`);
    console.log(
        '\n  A `-> unclear` costs the player a turn and answers with three things that\n'
        + '  would have worked, which is the safe failure. A `-> some other verb` is\n'
        + '  the one to look at first: there the bare word is being swallowed.\n'
    );
}
