/**
 * Can a player with torn meridians and money actually get healed?
 *
 * The leading cause of death in statistical playtesting is
 * `untreated_injuries` - six of twelve rogue runs and five of six sect runs -
 * and the catalog holds a full ladder of `treat_injury` pills at every grade.
 * So the question is never "does a cure exist", it is "can somebody typing
 * ordinary English reach one".
 *
 * This drives the real `GameService` with `worldEnabled: true`, which is the
 * configuration the browser runs (AGENTS.md: the harness default of `false`
 * skips every guard that needs a world, and reads as bugs).
 */
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { migrate } from '../src/storage/migrations.js';
import { GameService } from '../src/web/game.js';
import { DeterministicNarrator } from '../src/web/narrator.js';

const PHRASES = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [
    'I treat my injuries',
    'what pills are for sale',
    'what medicine is for sale',
    'I buy a Clear Meridian Pill',
    'I buy a meridian-mending pill',
    'I ask the sect for medicine',
    'I look for a healer for my meridians',
    'I refine a Minor Healing Pill',
    'I refine a Clear Meridian Pill',
    'what can I craft',
    'what formulas do I know',
    'I gather herbs'
];

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
migrate(db);

const game = new GameService({
    db,
    narrator: new DeterministicNarrator(),
    worldEnabled: true,
    adminMode: false,
    seedFactory: () => 'torn-meridian-probe'
});

const { cultivator } = await game.newRun('Torn');
db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);
for (const [severity, description] of [
    ['crippling', 'Torn meridians.'],
    ['serious', 'Scorched channels.'],
    ['minor', 'Scorched channels.']
] as const) {
    db.prepare(
        `INSERT INTO cultivator_injuries
         (id, cultivator_id, severity, source, description, sustained_on_turn, treated,
          cultivation_penalty, breakthrough_penalty)
         VALUES (?, ?, ?, 'qi_deviation', ?, 1, 0, 0.1, 0.05)`
    ).run(randomUUID(), cultivator.id, severity, description);
}

const untreated = () => (db.prepare(
    'SELECT COUNT(*) AS n FROM cultivator_injuries WHERE cultivator_id = ? AND treated = 0'
).get(cultivator.id) as { n: number }).n;
const purse = () => (db.prepare(
    'SELECT spirit_stones AS s FROM cultivators WHERE id = ?'
).get(cultivator.id) as { s: number }).s;

console.log(`start: ${untreated()} untreated, ${purse()} stones\n`);

for (const phrase of PHRASES) {
    const beforeWounds = untreated(), beforeStones = purse();
    let line: string;
    try {
        const result: any = await game.act(phrase);
        const plan = result.toolCalls?.find((c: any) => c.name === 'narrator.plan');
        line = `[${plan?.action ?? '?'}] ${String(result.narration ?? result.error ?? '').replace(/\s+/g, ' ')}`;
    } catch (error) {
        line = `THREW ${(error as Error).message}`;
    }
    const dw = untreated() - beforeWounds, ds = purse() - beforeStones;
    console.log(`--- "${phrase}"  (wounds ${dw >= 0 ? '+' : ''}${dw}, stones ${ds >= 0 ? '+' : ''}${ds})`);
    console.log(line.slice(0, 1400));
    console.log();
    // Put the money and the wounds back so every phrasing is asked of the same
    // cultivator. A probe that lets one verb spend the purse is measuring order.
    db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);
    db.prepare('UPDATE cultivator_injuries SET treated = 0 WHERE cultivator_id = ?').run(cultivator.id);
}
