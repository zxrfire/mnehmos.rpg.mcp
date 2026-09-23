/**
 * What the player is actually TOLD, for the sentences that now reach a verb.
 *
 * ── THE OTHER HALF OF PLAYABILITY ────────────────────────────────────────
 *
 * Two sweeps tonight asked whether a sentence is understood. Neither asked
 * whether the answer is worth reading. A verb that resolves and then says
 * nothing a person would want to read is reachable and useless, which is the
 * failure a unit test cannot see: it passes.
 *
 * So this plays each sentence through the real turn and prints everything the
 * player and the operator get - the narration, and the tool-call summaries that
 * carry the engine's own account - so a reader can judge four things:
 *
 *   THE NUMBER       a refusal that says no without saying how much, how many,
 *                    or how far is a hedge wearing a refusal's clothes.
 *   SAID TWICE       the structure line repeating the prose, which is the one
 *                    thing the narrator cannot fix and the player sees.
 *   CORRECT AND USELESS   a bare "nothing happens", a restatement of the
 *                    question, an answer about a different subject.
 *   AND THE WORST    naming a thing without naming the road to it: "somebody
 *                    could teach you" with no way to find out who.
 *
 * ── HOW IT IS RUN ────────────────────────────────────────────────────────
 *
 * A FRESH RUN PER SENTENCE. The alternative is one run played down the list,
 * and then turn twelve inherits the days, the stones and the standing fight of
 * everything before it - which is the defect `AGENTS.md` records under "a
 * corpus is a set, not a sequence". The world is off: it costs minutes to seed
 * and the sentences that need one are marked, so what they produce is read as
 * "no world" rather than as an answer.
 *
 * Run: npx tsx scripts/probe-is-the-answer-worth-reading.ts
 */
import { makeGame } from '../tests/web/harness.js';

/** A sentence, and the family it belongs to, for grouping the output. */
type Said = readonly [said: string, family: string];

const CORPUS: readonly Said[] = [
    // The verbs built tonight.
    ['I put on the robes', 'carry'],
    ['I draw my sword', 'carry'],
    ['I drop the sword', 'carry'],
    ['I sheathe my blade', 'carry'],
    ['I show my token', 'carry'],
    ['I hide', 'conceal'],
    ['I hide my cultivation', 'conceal'],
    ['I stop hiding my cultivation', 'conceal'],
    ['I surrender', 'submission'],
    ['I save him', 'aid'],
    ['I help her', 'aid'],
    // The mechanics sweep's sentences.
    ['I report back', 'talismans'],
    ['I break the talisman', 'talismans'],
    ['I use the jade', 'talismans'],
    ['I commission a sword', 'craft'],
    ['I take the post', 'postings'],
    ['I check the board', 'board'],
    ['I check my merit', 'merit'],
    ['I turn in the manual', 'handing in'],
    ['I hand it to the sect', 'handing in'],
    ['I listen to the elder', 'lectures'],
    ['I sit in on the lecture', 'lectures'],
    ['I ask to be his disciple', 'master'],
    ['I take her as my disciple', 'master'],
    ['I end our bond', 'master'],
    ['I take her as a wife', 'match'],
    ['I propose to her', 'match'],
    ['I refuse the duel', 'duels'],
    ['I challenge him', 'duels'],
    ['I sneak in', 'gate'],
    // And the plain ones, which are what somebody types first.
    ['I go', 'plain'],
    ['I leave', 'plain'],
    ['I ask around', 'plain'],
    ['I push through', 'plain'],
    ['I chase him', 'plain'],
    ['what can I do', 'plain'],
    ['I wait', 'plain'],
    ['I look', 'plain']
];

const line = '─'.repeat(74);

for (const [said, family] of CORPUS) {
    const { game } = makeGame({ seed: `worth-reading-${said.replace(/\W+/g, '-')}` });
    await game.newRun('Ke Yan');
    let turn;
    try {
        turn = await game.act(said);
    } catch (error) {
        console.log(`\n${line}\n[${family}] ${JSON.stringify(said)}\n  THREW: ${String(error).slice(0, 200)}`);
        continue;
    }
    console.log(`\n${line}\n[${family}] ${JSON.stringify(said)}`);
    console.log(`  SAID TO THE PLAYER:\n    ${(turn.narration || '(nothing)').replace(/\n/g, '\n    ')}`);
    for (const call of turn.toolCalls) {
        console.log(`  ${call.ok ? 'ok ' : 'NO '} ${call.name} [${call.action}]`);
        console.log(`      ${String(call.summary ?? '').replace(/\n/g, ' ').slice(0, 400)}`);
    }
}
