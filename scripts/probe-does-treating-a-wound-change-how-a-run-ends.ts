/**
 * Does answering a wound change how a run ends?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A CONTROLLED PAIR AND NOT A BEFORE-AND-AFTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The reported statistic is that untreated meridian injuries end more runs than
 * anything else - six of twelve rogue runs, five of six sect runs, median peak
 * ordinal 3 of 47, median age at death 22 - and the obvious way to check a fix
 * is to re-run that sample afterwards. That comparison is worthless on this
 * tree. Several agents are landing catalog and web changes continuously, so two
 * readings minutes apart differ for reasons that have nothing to do with any
 * fix (AGENTS.md, "a number taken across a gap is worthless").
 *
 * So both arms run in ONE process against ONE build, on the SAME SEEDS, and the
 * only difference between them is a single sentence the player types:
 *
 *   IGNORING   the sampled strategy exactly: learn a manual, work, buy
 *              rations, then twenty-year seclusions until something ends it.
 *   ANSWERING  the same, plus `I treat my injuries` on any stretch that comes
 *              back with an open wound.
 *
 * That isolates the question the death statistic was actually asking - is the
 * cure reachable, affordable and sufficient - from the state of the tree, and
 * it stays a valid measurement however much moves underneath it.
 *
 * The sampled strategy never treats anything. That is not a criticism of the
 * sample; it is the finding. A player who does not know the verb exists plays
 * the IGNORING arm, and the whole reachability problem is that the game gave
 * them no way to learn otherwise.
 */
import Database from 'better-sqlite3';
import { migrate } from '../src/storage/migrations.js';
import { GameService } from '../src/web/game.js';
import { DeterministicNarrator } from '../src/web/narrator.js';

const RUNS = Number(process.env.RUNS ?? 12);
const STRETCHES = 20;

interface Ending {
    cause: string;
    peak: number;
    age: number;
    stretches: number;
    treatments: number;
}

/**
 * The purse the run opens with.
 *
 * The sampled strategy runs on the starting thirty stones, and on this tree
 * that is dominated by FOOD: "I buy 100 years of rations" buys 9.6 years, the
 * second seclusion comes out at day 10 with nothing left to eat, and the run
 * ends at seventeen. A wound never gets the chance to be the thing that kills
 * anybody, so the treatment arm has nothing to act on and the comparison
 * measures hunger.
 *
 * So the pair is run twice: once poor, which is what a player actually starts
 * as, and once with the food problem bought off, which is the only condition
 * under which "does the cure reach the wound" is answerable at all. Both are
 * reported, because the poor case is the real one and the fed case is the
 * controlled one.
 */
const FED_PURSE = 4_000;

async function play(seed: string, answerTheWound: boolean, purse: number | null): Promise<Ending> {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    const game = new GameService({
        db,
        narrator: new DeterministicNarrator(),
        worldEnabled: true,
        adminMode: false,
        seedFactory: () => seed
    });

    const { cultivator } = await game.newRun('Sample');
    const id = cultivator.id;
    if (purse !== null) {
        db.prepare('UPDATE cultivators SET spirit_stones = ? WHERE id = ?').run(purse, id);
    }
    const untreated = () => (db.prepare(
        'SELECT COUNT(*) AS n FROM cultivator_injuries WHERE cultivator_id = ? AND treated = 0'
    ).get(id) as { n: number }).n;
    const row = () => db.prepare(
        'SELECT status, death_cause, peak_ordinal FROM runs WHERE cultivator_id = ?'
    ).get(id) as { status: string; death_cause: string | null; peak_ordinal: number };
    const age = () => (db.prepare('SELECT age FROM cultivators WHERE id = ?')
        .get(id) as { age: number }).age;

    const act = async (input: string) => { try { await game.act(input); } catch { /* a refusal is an answer */ } };

    await act('I learn the Lesser Qi-Gathering Manual.');
    for (let i = 0; i < 6; i++) await act('I look for work');
    await act('I buy 100 years of rations.');

    let stretches = 0;
    let treatments = 0;
    for (let i = 0; i < STRETCHES; i++) {
        await act('I go into closed-door seclusion for twenty years.');
        stretches++;
        if (row().status !== 'active') break;
        if (answerTheWound && untreated() > 0) {
            await act('I treat my injuries');
            treatments++;
            if (row().status !== 'active') break;
        }
    }

    // Read everything BEFORE closing. `age()` inside the returned literal ran
    // after `db.close()` and threw "the database connection is not open",
    // which reads like a service bug and is an ordering mistake in the probe.
    const finished = row();
    const endedAt = Math.round(age());
    db.close();
    return {
        cause: finished.status === 'active' ? 'alive' : (finished.death_cause ?? 'unknown'),
        peak: finished.peak_ordinal,
        age: endedAt,
        stretches,
        treatments
    };
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function report(label: string, endings: Ending[]): void {
    const causes: Record<string, number> = {};
    for (const e of endings) causes[e.cause] = (causes[e.cause] ?? 0) + 1;
    const injuries = causes['untreated_injuries'] ?? 0;
    console.log(`\n${label}  (${endings.length} runs)`);
    console.log('  causes        ' + Object.entries(causes)
        .sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', '));
    console.log(`  untreated_injuries  ${injuries}/${endings.length}`
        + `  (${Math.round(100 * injuries / endings.length)}% of endings)`);
    console.log('  peak ordinal  ' + endings.map(e => e.peak).sort((a, b) => a - b).join(','));
    console.log(`  median peak ${median(endings.map(e => e.peak))}`
        + `   median age ${median(endings.map(e => e.age))}`
        + `   treatments bought ${endings.reduce((n, e) => n + e.treatments, 0)}`);
}

const arms: Record<string, Ending[]> = {
    'POOR, ignoring the wound (the sampled strategy verbatim)': [],
    'POOR, answering the wound': [],
    [`FED (${FED_PURSE} stones), ignoring the wound`]: [],
    [`FED (${FED_PURSE} stones), answering the wound`]: []
};
const labels = Object.keys(arms);

for (let n = 0; n < RUNS; n++) {
    const seed = `sample-${n}`;
    // All four arms back to back on the same seed in the same process, so
    // nothing between the readings can move.
    arms[labels[0]].push(await play(seed, false, null));
    arms[labels[1]].push(await play(seed, true, null));
    arms[labels[2]].push(await play(seed, false, FED_PURSE));
    arms[labels[3]].push(await play(seed, true, FED_PURSE));
}

for (const label of labels) report(label, arms[label]);
