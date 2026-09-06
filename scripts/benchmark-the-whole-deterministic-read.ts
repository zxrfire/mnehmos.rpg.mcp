/**
 * What does a player with no model behind them actually get?
 *
 *   npx tsx scripts/benchmark-the-whole-deterministic-read.ts
 *   npx tsx scripts/benchmark-the-whole-deterministic-read.ts --confusion
 *
 * ── WHY THIS EXISTS BESIDE THE OTHER ONE ──────────────────────────────────
 *
 * `benchmark-the-local-intent-layer.ts` calls `parseIntent` and measures the
 * PATTERN TABLE. That is a real thing to measure and it is not what a player
 * meets: `readTheSentence` in `narrator.ts` runs the table and then hands an
 * `unclear` to `verbForASentenceThePatternsMissed`, the exemplar tier. The
 * deterministic path is both halves.
 *
 * Measured the day this was written: the table alone scores 82.9% on the
 * corpus and the two together score 89.3%, rescuing fifteen sentences and
 * breaking none. Six and a half points of the reader had no number, so work
 * aimed at the table was being judged against a figure the player never sees.
 *
 * `--confusion` prints what each verb is actually mistaken for, which is the
 * input to widening `how-a-player-says-each-verb.ts`: an exemplar set is
 * widened against its NEIGHBOURS, and a phrasing that steals from the verb next
 * door costs more than the one it wins.
 */

import { parseIntent } from '../src/web/actions.js';
import {
    nearestVerbByMeaning,
    readyTheTier,
    verbForASentenceThePatternsMissed
} from '../src/web/reaching-a-verb-the-pattern-table-has-no-line-for.js';
import { CORPUS, type Command } from './a-corpus-of-things-players-actually-type.js';

const showConfusion = process.argv.includes('--confusion');

interface Row {
    readonly command: Command;
    readonly table: string;
    readonly whole: string;
}

await readyTheTier();

const rows: Row[] = [];
for (const command of CORPUS) {
    const table = parseIntent(command.said);
    const whole = await verbForASentenceThePatternsMissed(command.said, table);
    rows.push({ command, table: table.action, whole: whole.action });
}

function rate(of: readonly Row[], read: (row: Row) => string): string {
    if (of.length === 0) return '     -';
    const right = of.filter(row => read(row) === row.command.want).length;
    return `${String(right).padStart(3)}/${String(of.length).padEnd(3)} ${
        (100 * right / of.length).toFixed(1).padStart(5)}%`;
}

const tiers = ['plain', 'oblique'] as const;
console.log('                    table only        whole read');
console.log(`  ALL          ${rate(rows, r => r.table)}     ${rate(rows, r => r.whole)}`);
for (const tier of tiers) {
    const of = rows.filter(row => row.command.tier === tier);
    console.log(`  ${tier.padEnd(12)} ${rate(of, r => r.table)}     ${rate(of, r => r.whole)}`);
}

// WHAT THE TIER IS FOR, AS TWO COUNTS. A tier that rescues nothing is dead
// weight and a tier that breaks anything is worse than none, so both are said.
const rescued = rows.filter(r => r.table !== r.command.want && r.whole === r.command.want);
const broke = rows.filter(r => r.table === r.command.want && r.whole !== r.command.want);
console.log(`\n  the tier rescued ${rescued.length}, broke ${broke.length}`);
for (const row of rescued) console.log(`    rescued  ${row.command.want.padEnd(16)} "${row.command.said}"`);
for (const row of broke) console.log(`    BROKE    ${row.command.want.padEnd(16)} -> ${row.whole}  "${row.command.said}"`);

// ── WHAT IS STILL WRONG, SPLIT BY KIND ───────────────────────────────────
//
// A sentence that reaches NOTHING costs the player a turn. A sentence that
// reaches a MILDER verb costs them the act and the engine never learns what
// they meant. The corpus banner says the second cannot be recovered
// downstream, so the two are never summed into one number here.
const stillUnclear = rows.filter(r => r.whole === 'unclear');
const stillWrong = rows.filter(r => r.whole !== 'unclear' && r.whole !== r.command.want);
console.log(`\n  reached nothing: ${stillUnclear.length}   reached the wrong verb: ${stillWrong.length}`);
for (const row of stillWrong) {
    console.log(`    wrong    ${row.command.want.padEnd(16)} -> ${row.whole.padEnd(16)} "${row.command.said}"`);
}
for (const row of stillUnclear) {
    console.log(`    nothing  ${row.command.want.padEnd(16)} "${row.command.said}"`);
}

if (!showConfusion) {
    console.log('\n  --confusion for what each verb is mistaken for, and what the tier nearly said.');
    process.exit(0);
}

// ── WHAT EACH VERB IS MISTAKEN FOR ───────────────────────────────────────
//
// The input to widening the exemplar set. `nearestVerbByMeaning` is asked even
// where the table answered, because the question being asked is what the
// EXEMPLARS say - and where they say the wrong thing confidently, adding more
// of them to the verb next door is how the mistake gets worse.
console.log('\n  what the exemplars say, where the answer was not right:');
for (const row of rows) {
    if (row.whole === row.command.want) continue;
    const nearest = await nearestVerbByMeaning(row.command.said);
    const margin = nearest ? nearest.score - nearest.runnerUpScore : 0;
    console.log(
        `    want ${row.command.want.padEnd(16)} table ${row.table.padEnd(14)} `
        + `exemplars ${String(nearest?.action ?? 'none').padEnd(14)} `
        + `score ${(nearest?.score ?? 0).toFixed(3)} margin ${margin.toFixed(3)}  "${row.command.said}"`
    );
}
