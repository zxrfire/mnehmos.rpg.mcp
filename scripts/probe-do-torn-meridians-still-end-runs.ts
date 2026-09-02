/**
 * Do torn meridians still end runs?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS MEASURES AND WHY IT IS SHAPED LIKE THIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The design owner's ruling: a torn meridian is a torn muscle. Very, VERY
 * annoying, and it does not put you in the ground. Before that ruling landed,
 * `untreated_injuries` was the dominant cause of death in this game - measured
 * on identical strategies varying only the length of each seclusion:
 *
 *   ten-year stretches     deaths 4/5    peaks 12,12,3,2,2
 *   twenty-year stretches  deaths 4/5    peaks 3,9,10,5,0
 *   thirty-year stretches  deaths 5/5    peaks 12,0,0,0,0
 *
 * This probe reproduces exactly that sample - one strategy, three stretch
 * lengths, the same seeds - and reports the death-cause histogram, median peak
 * ordinal and median age at death. It is the before-and-after instrument for
 * `docs/world/climbing/injuries.md`.
 *
 * ── HOW TO TAKE A HONEST BEFORE-AND-AFTER ────────────────────────────────
 *
 * Not by running it twice minutes apart. Several agents land changes on this
 * tree continuously and two readings across that gap are not a comparison
 * (AGENTS.md, "a number taken across a gap is worthless"). Take both arms
 * back-to-back in ONE command against ONE build: stash the engine files, run,
 * restore, run. Everything else moving underneath is then common to both arms.
 *
 * ── WHAT SUCCESS AND FAILURE LOOK LIKE ───────────────────────────────────
 *
 *   success  `untreated_injuries` gone as a cause, median age at death well up,
 *            and runs ending for reasons that are about the world.
 *   failure  everybody survives everything. If nothing ends a run any more the
 *            impairment is too weak, and that is as wrong as the lethality was.
 *
 * So the report prints what ended each run AND how far each got, because
 * "nothing kills anybody now" and "wounds stopped mattering" are the same
 * finding read two ways.
 */
import Database from 'better-sqlite3';
import { migrate } from '../src/storage/migrations.js';
import { GameService } from '../src/web/game.js';
import { DeterministicNarrator } from '../src/web/narrator.js';

/** Seeds per stretch length. Five reproduces the reported sample exactly. */
const RUNS = Number(process.env.RUNS ?? 5);
/** How many stretches to attempt before calling a surviving run survived. */
const STRETCHES = Number(process.env.STRETCHES ?? 12);

/**
 * The purse of the controlled arm.
 *
 * The sampled strategy runs on the starting stones, and on this tree that is
 * dominated by FOOD - "I buy 100 years of rations" buys about ten, and nine of
 * fifteen poor runs end on `starvation` before a wound gets the chance to be
 * the thing that ends anybody. That is a real finding about the poor case and
 * it is NOISE for the question being asked here, because a run that starved at
 * eighteen tells you nothing about what its meridians would have done.
 *
 * So both are reported. The poor arm is the run a player actually gets; the fed
 * arm is the only condition under which "do torn meridians end runs" is
 * answerable at all. Read the fed arm for the injury signal and the poor arm to
 * check the fix did not quietly move something else.
 */
const FED_PURSE = 4_000;

interface Ending {
    cause: string;
    peak: number;
    age: number;
    /** Open wounds still being carried when the run ended. The annoyance. */
    untreated: number;
    /** Wounds closed over the life. What the medicine ladder actually sold. */
    treated: number;
}

async function play(
    seed: string,
    stretchYears: number,
    purse: number | null,
    treat: boolean
): Promise<Ending> {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    const game = new GameService({
        db,
        narrator: new DeterministicNarrator(),
        // The harness default is `false` and the real service default is `true`.
        // Playing through the false one skips every guard that needs a world.
        worldEnabled: true,
        adminMode: false,
        seedFactory: () => seed
    });

    const { cultivator } = await game.newRun('Sample');
    const id = cultivator.id;
    if (purse !== null) {
        db.prepare('UPDATE cultivators SET spirit_stones = ? WHERE id = ?').run(purse, id);
    }
    const row = () => db.prepare(
        'SELECT status, death_cause, peak_ordinal FROM runs WHERE cultivator_id = ?'
    ).get(id) as { status: string; death_cause: string | null; peak_ordinal: number };
    const wounds = () => db.prepare(
        'SELECT SUM(CASE WHEN treated = 0 THEN 1 ELSE 0 END) AS open, '
        + 'SUM(CASE WHEN treated = 1 THEN 1 ELSE 0 END) AS closed '
        + 'FROM cultivator_injuries WHERE cultivator_id = ?'
    ).get(id) as { open: number | null; closed: number | null };
    const age = () => (db.prepare('SELECT age FROM cultivators WHERE id = ?')
        .get(id) as { age: number }).age;

    // A refusal from the engine is an answer, not a crash. Swallow it and go on
    // - a driver that dies on 409 replays one exhausted body and reports it as
    // many lives (AGENTS.md, "read state, not prose").
    const act = async (input: string) => {
        try { await game.act(input); } catch { /* an answer */ }
    };

    // THE STRATEGY, held identical across every arm. The only thing that varies
    // between arms is the number in the seclusion sentence. Deliberately does
    // NOT treat anything: this is the player who never learned the verb, which
    // is the population the death statistic was taken over.
    await act('I learn the Lesser Qi-Gathering Manual.');
    for (let i = 0; i < 6; i++) await act('I look for work');
    await act('I buy 100 years of rations.');

    const openWounds = () => (db.prepare(
        'SELECT COUNT(*) AS n FROM cultivator_injuries WHERE cultivator_id = ? AND treated = 0'
    ).get(id) as { n: number }).n;

    for (let i = 0; i < STRETCHES; i++) {
        await act(`I go into closed-door seclusion for ${stretchYears} years.`);
        if (row().status !== 'active') break;
        // THE CONTROL ARM. Identical in every other respect - same seed, same
        // strategy, same purse. The only difference is one sentence a player
        // types, which isolates "is the cure reachable and sufficient" from
        // everything else moving on this tree.
        if (treat && openWounds() > 0) {
            await act('I treat my injuries');
            if (row().status !== 'active') break;
        }
    }

    // Read everything BEFORE closing the handle.
    const finished = row();
    const endedAt = Math.round(age());
    const w = wounds();
    db.close();
    return {
        cause: finished.status === 'active' ? 'survived' : (finished.death_cause ?? 'unknown'),
        peak: finished.peak_ordinal,
        age: endedAt,
        untreated: w.open ?? 0,
        treated: w.closed ?? 0
    };
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function report(label: string, endings: Ending[]): void {
    const causes: Record<string, number> = {};
    for (const e of endings) causes[e.cause] = (causes[e.cause] ?? 0) + 1;
    const deaths = endings.filter(e => e.cause !== 'survived').length;
    console.log(`\n${label}  (${endings.length} runs)`);
    console.log(`  deaths        ${deaths}/${endings.length}`
        + `   untreated_injuries ${causes['untreated_injuries'] ?? 0}`);
    console.log('  causes        ' + Object.entries(causes)
        .sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', '));
    console.log('  peaks         ' + endings.map(e => e.peak).join(','));
    console.log('  ages          ' + endings.map(e => e.age).join(','));
    console.log(`  median peak ${median(endings.map(e => e.peak))}`
        + `   median age ${median(endings.map(e => e.age))}`);
    console.log(`  wounds carried at the end ${endings.map(e => e.untreated).join(',')}`
        + `   closed over the life ${endings.map(e => e.treated).join(',')}`);
}

const LENGTHS = [10, 20, 30];
const NAME: Record<number, string> = { 10: 'ten', 20: 'twenty', 30: 'thirty' };

const ARMS = [
    ['POOR, ignoring the wound (the sampled strategy verbatim)', null, false],
    ['POOR, answering the wound', null, true],
    [`FED (${FED_PURSE} stones), ignoring the wound`, FED_PURSE, false],
    [`FED (${FED_PURSE} stones), answering the wound`, FED_PURSE, true]
] as const;

for (const [armLabel, purse, treat] of ARMS) {
    console.log(`\n${'='.repeat(70)}\n${armLabel}\n${'='.repeat(70)}`);
    const pooled: Ending[] = [];
    for (const years of LENGTHS) {
        const endings: Ending[] = [];
        for (let n = 0; n < RUNS; n++) endings.push(await play(`sample-${n}`, years, purse, treat));
        report(`${NAME[years]}-year stretches`, endings);
        pooled.push(...endings);
    }
    // Pooled, because five runs is not a sample big enough to carry a claim
    // about a varied outcome and the fix for that is never a wider bar.
    report('POOLED across all three stretch lengths', pooled);
}
