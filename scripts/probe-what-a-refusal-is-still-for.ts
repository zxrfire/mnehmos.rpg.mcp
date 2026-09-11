/**
 * What a played corpus still comes back refusing, by verb.
 *
 * The instrument behind the 348-turn audit in
 * `a-near-synonym-reaches-the-same-answer.test.ts`: play the sentences a
 * player actually types, in several situations and pinned worlds, and count
 * which verb was chosen and whether the turn answered.
 *
 * A refusal here is an engine call that came back `ok: false`, or the verb
 * `unclear`. Both are the player getting nothing back for a turn.
 *
 *   npx tsx scripts/probe-what-a-refusal-is-still-for.ts [out.json]
 */

import { makeGameInWorld } from '../tests/web/harness.js';
import { parseIntent } from '../src/web/actions.js';
import { SENTENCES } from './sentences-a-player-would-actually-type.js';

/** Sentences that are nothing but a reference to what the last turn listed. */
const NOTHING_BUT_A_REFERENCE = [
    'the second one', 'that one', 'the first one', 'I take it', 'the intake',
    'more', 'why', 'the last one', 'I take the first one', 'that'
];

/** Things said straight at a person, which is the verb that refused most. */
const AT_A_PERSON = [
    'I talk to the nearest cultivator',
    'I ask him about the sect',
    'I greet the elder',
    'I introduce myself',
    'I follow him',
    'I ask what he wants',
    'I ask around about work',
    'I have a word with the steward',
    'I bow to him',
    'I tell him my name'
];

const SAID: string[] = [
    ...SENTENCES.map(s => s.text),
    ...NOTHING_BUT_A_REFERENCE,
    ...AT_A_PERSON
];

interface Row {
    said: string;
    situation: string;
    world: string;
    verb: string;
    intent?: string;
    refused: boolean;
    why: string;
}

/** The lead-in each situation plays before the corpus, and its name. */
const SITUATIONS: ReadonlyArray<[string, readonly string[]]> = [
    ['town', []],
    ['after a listing', ['what do I know', 'I look at the wall']],
    ['on a roll', ['what sects are there', 'I join the nearest sect']]
];

async function main(): Promise<void> {
    const rows: Row[] = [];
    for (const worldSeed of ['refusal-audit-a', 'refusal-audit-b']) {
        for (const [situation, leadIn] of SITUATIONS) {
            const { game } = await makeGameInWorld({ seed: `${worldSeed}-${situation}`, worldSeed });
            await game.newRun('Prober');
            for (const line of leadIn) {
                try { await game.act(line); } catch { /* a lead-in that fails is still a situation */ }
            }
            for (const said of SAID) {
                const plan = parseIntent(said);
                let refused = true;
                let why = 'threw';
                try {
                    const turn = await game.act(said);
                    const declined = turn.toolCalls.filter(call => !call.ok);
                    refused = plan.action === 'unclear' || declined.length > 0;
                    why = plan.action === 'unclear'
                        ? 'unclear'
                        : declined.map(c => `${c.name}/${c.action}`).join(' ');
                } catch (err) {
                    why = `threw: ${(err as Error).message}`;
                }
                rows.push({
                    said, situation, world: worldSeed,
                    verb: plan.action, intent: (plan as { intent?: string }).intent,
                    refused, why
                });
            }
        }
    }

    const byVerb = new Map<string, { chosen: number; refused: number }>();
    for (const row of rows) {
        const tally = byVerb.get(row.verb) ?? { chosen: 0, refused: 0 };
        tally.chosen += 1;
        if (row.refused) tally.refused += 1;
        byVerb.set(row.verb, tally);
    }

    const total = rows.length;
    const refused = rows.filter(r => r.refused).length;
    console.log(`turns ${total}  refused ${refused}  ${((refused / total) * 100).toFixed(1)}%`);
    console.log('verb                 chosen refused  rate');
    for (const [verb, t] of [...byVerb].sort((a, b) => b[1].refused - a[1].refused)) {
        console.log(
            `${verb.padEnd(20)} ${String(t.chosen).padStart(6)} ${String(t.refused).padStart(7)}`
            + `  ${((t.refused / t.chosen) * 100).toFixed(0)}%`
        );
    }

    const out = process.argv[2];
    if (out) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(out, JSON.stringify({ total, refused, rows }, null, 1));
        console.log(`\nwrote ${out}`);
    }
}

await main();
