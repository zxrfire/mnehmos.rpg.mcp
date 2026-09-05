/**
 * What does a model actually do with a sentence nobody wrote a pattern for?
 *
 *   npx tsx scripts/how-well-does-a-model-read-a-sentence.ts [model] [--full]
 *
 * Phase 1 only by default: the state summary is built once, every sentence is
 * read against it, and nothing is executed. That is the measurement worth
 * iterating on - executing a costly act changes the square for the sentence
 * after it, so a sweep that plays every line is measuring a drifting world.
 *
 * `--full` plays each sentence on a fresh run instead, which is what the
 * player actually meets and is roughly forty times slower.
 */
import Database from 'better-sqlite3';
import { writeFileSync } from 'node:fs';

import { migrate } from '../src/storage/migrations.js';
import { GameService } from '../src/web/game.js';
import { ProviderNarrator } from '../src/web/narrator.js';
import { composeStateSummary } from '../src/web/prompt.js';
import { OllamaProvider } from '../src/agent/provider/ollama.js';
import type {
    LLMProvider,
    ProviderCallOpts,
    ProviderCallResult
} from '../src/agent/provider/types.js';
import type { ProviderName } from '../src/agent/provider/config.js';
import { createWorld, resetCultivationWorlds } from '../src/server/state/cultivation-world.js';
import { stepsOfThePlan } from '../src/web/a-sentence-can-be-more-than-one-call.js';
import { ASKING_WHAT_IS_POSSIBLE } from '../src/web/what-is-worth-doing-standing-here.js';
import { PRESSING_SOMEBODY } from '../src/web/actions.js';
import { SENTENCES, type Said } from './sentences-a-player-would-actually-type.js';

const model = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'gemma4:26b';
const full = process.argv.includes('--full');
const why = process.argv.includes('--why');
const trace = process.argv.includes('--trace');
const traceFile = `intent-trace-${model.replace(/[^a-z0-9]/gi, '-')}.txt`;
const WORLD = 'probe-world';

/**
 * The provider, with every exchange kept.
 *
 * A wrapper rather than a flag on the real one: what is being measured is what
 * the model was ASKED and what it said back, and reading that off the provider
 * itself would mean the thing under test reporting on itself.
 */
class Recorded implements LLMProvider {
    readonly name: ProviderName;
    readonly exchanges: { sent: string; system: string; got: string; finish: string }[] = [];

    constructor(private readonly inner: LLMProvider) { this.name = inner.name; }

    async call(opts: ProviderCallOpts): Promise<ProviderCallResult> {
        const result = await this.inner.call(opts);
        this.exchanges.push({
            system: opts.messages.find(m => m.role === 'system')?.content ?? '',
            sent: opts.messages.find(m => m.role === 'user')?.content ?? '',
            got: result.text ?? '',
            finish: String(result.finishReason ?? '')
        });
        return result;
    }
}

async function makeGame() {
    resetCultivationWorlds();
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    const provider = new Recorded(new OllamaProvider({ defaultModel: model }));
    const narrator = new ProviderNarrator(provider, { model, timeoutMs: 120_000 });
    const game = new GameService({
        db, narrator, worldEnabled: true, adminMode: false, seedFactory: () => 'probe-c'
    });
    resetCultivationWorlds();
    await createWorld({ seed: WORLD });
    return { game, narrator, provider };
}

interface Row {
    said: Said;
    action: string;
    target: string;
    steps: string;
    intent: string;
    source: string;
    bound: boolean;
    note: string;
    exchanges: { sent: string; system: string; got: string; finish: string }[];
}

/**
 * Whether the target names somebody or something the turn could actually reach.
 *
 * People through the resolver the verbs use, places through the player's own
 * awareness. A target that is the place they are already standing in counts as
 * DEAD: `move` to where you are is a turn spent going nowhere.
 */
function binds(game: any, cultivator: any, target: string | undefined): boolean {
    const query = (target ?? '').trim();
    if (query.length === 0) return true;   // a verb that needs no subject
    if (game.somebodyAtHand(query, cultivator)) return true;

    const named = game.company(cultivator).named as { name: string }[];
    if (named.some(p => p.name.toLowerCase() === query.toLowerCase())) return true;

    const here = String(cultivator.location ?? '').toLowerCase();
    const rows = game.awarenessOf(cultivator) as { kind: string; name: string }[];
    return rows.some(row =>
        row.name.toLowerCase() === query.toLowerCase()
        && row.name.toLowerCase() !== here);
}

const { game, narrator, provider } = await makeGame();
const { cultivator } = await (game as any).newRun('Probe');
const g = game as any;

const summary = composeStateSummary({
    cultivator,
    run: g.state().run,
    ambient: 'thin',
    sectName: g.sectNameFor(cultivator),
    knownTechniques: g.knownTechniqueNames(cultivator),
    awareness: g.awarenessOf(cultivator),
    present: g.company(cultivator)
});

console.log(`model=${model}  world=${WORLD}  sentences=${SENTENCES.length}`);
console.log(summary.split('HAS HEARD OF')[0].split('STANDING HERE')[1]?.slice(0, 400) ?? '');

const rows: Row[] = [];
for (const said of SENTENCES) {
    const before = provider.exchanges.length;
    const plan = await narrator.plan(said.text, summary, null);
    const mine = provider.exchanges.slice(before);
    const steps = stepsOfThePlan(plan);
    const target = (plan.action as any).target ?? '';
    const intent = (plan.action as any).intent ?? '';
    rows.push({
        said,
        action: plan.action.action,
        target,
        steps: steps.length > 1 ? steps.map(s => s.action.action).join('>') : '',
        source: plan.source,
        bound: binds(g, cultivator, target),
        intent,
        note: (plan as any).note ?? '',
        exchanges: mine
    });
}

// `unclear` IS NOT ALWAYS A FAILURE, and counting it as one overstated the
// problem by four sentences. "What can I do" reaches `unclear` on purpose -
// `theTableMeantIt` sends that family there and the executor answers it with
// `guidance()`, the live list of what is worth doing standing here. A sentence
// that lands on a deliberate answer got an answer.
const answered = rows.filter(r =>
    r.action === 'unclear' && ASKING_WHAT_IS_POSSIBLE.test(r.said.text));
const unclear = rows.filter(r =>
    r.action === 'unclear' && !ASKING_WHAT_IS_POSSIBLE.test(r.said.text));

// ── THE FAILURE A RATE HIDES ─────────────────────────────────────────────
//
// A softened reading BINDS. It reaches a real verb against a real person and
// scores as a success everywhere above, and it is the one failure the phase-1
// prompt calls unrecoverable: the engine never learns force was used, so the
// account it would have opened is never opened. Counted on its own.
const HOSTILE_ENOUGH: readonly string[] = ['attack', 'coerce', ...PRESSING_SOMEBODY];
const softened = rows.filter(r =>
    r.said.hostile === true
    && r.action !== 'unclear'
    && !HOSTILE_ENOUGH.includes(r.action)
    && !(r.action === 'interact' && (r.intent === 'steal' || r.intent === 'threaten')));
const unbound = rows.filter(r => r.action !== 'unclear' && !r.bound);
const ok = rows.filter(r => r.action !== 'unclear' && r.bound);

for (const r of rows) {
    const mark = r.action === 'unclear'
        ? (ASKING_WHAT_IS_POSSIBLE.test(r.said.text) ? ' asked ' : 'SHRUG ')
        : r.bound ? '  ok  ' : 'UNBOUND';
    console.log(
        `${mark} ${r.action.padEnd(16)} ${(r.target || '-').padEnd(24)} `
        + `${r.steps.padEnd(22)} ${r.source.padEnd(9)} | ${r.said.text}`
    );
    if (why && r.note) console.log(`         ^ ${r.note}`);
}

// ── THE PARITY CHECK ─────────────────────────────────────────────────────
//
// 天道无情: the engine does not grade, so neither may the reader. A taking and
// a giving of the same shape must reach a verb at the same rate, and both must
// reach one at the rate an act with no charge at all does. The `indifferent`
// arm is the control - without it two numbers only say which is worse, never
// whether either is worse than reading badly.
//
// This measures the READER, not the engine. A gap here is a reader flinching,
// a vocabulary with more words for one than the other, or a model's own
// priors - and every one of those is a defect under the genre section of
// `AGENTS.md`.
const byKind = (want: string) => {
    const of = rows.filter(r => r.said.kind === want);
    const reached = of.filter(r => r.action !== 'unclear' && r.bound);
    return { n: of.length, reached: reached.length };
};

console.log('');
console.log(`reached a verb and bound it : ${ok.length}/${rows.length}`);
console.log(`asked what is possible, and was told : ${answered.length}/${rows.length}`);
console.log(`reached a verb, target dead : ${unbound.length}/${rows.length}`);
console.log(`shrugged                    : ${unclear.length}/${rows.length}`);
for (const kind of ['taking', 'giving', 'indifferent'] as const) {
    const { n, reached } = byKind(kind);
    if (n === 0) continue;
    const pct = Math.round((reached / n) * 100);
    console.log(`  ${kind.padEnd(12)} ${String(reached).padStart(3)}/${String(n).padEnd(3)}  ${pct}%`);
}
{
    const t = byKind('taking'), g = byKind('giving'), i = byKind('indifferent');
    const rate = (x: { n: number; reached: number }) => (x.n === 0 ? 0 : x.reached / x.n);
    const gap = Math.abs(rate(t) - rate(g));
    console.log(
        gap > 0.15
            ? `  ^ TAKING AND GIVING ARE ${Math.round(gap * 100)} POINTS APART. `
              + 'The reader has a view the engine does not.'
            : `  ^ taking and giving within ${Math.round(gap * 100)} points`
              + ` (control arm reads ${Math.round(rate(i) * 100)}%)`);
}

console.log(
    `SOFTENED (a taking read as something milder): ${softened.length}`
    + `/${rows.filter(r => r.said.hostile === true).length} hostile sentences`);
for (const r of softened) console.log(`    ${r.action.padEnd(12)} <- ${r.said.text}`);

// ── THE WHOLE EXCHANGE, FOR SOMEBODY READING IT BY HAND ──────────────────
//
// A rate tells you there is a problem. It does not tell you whose problem it
// is, and every failure in this layer has at least four candidates: the prompt
// did not say it, the model did not read it, the schema threw the answer away,
// or a guard downstream declined it. The only way to tell those apart is to
// read what was sent and what came back, so the run writes them out.
if (trace) {
    const out: string[] = [
        `model=${model}   world=${WORLD}   sentences=${SENTENCES.length}`,
        '',
        'THE SYSTEM PROMPT, SENT WITH EVERY SENTENCE',
        '='.repeat(78),
        rows[0]?.exchanges[0]?.system ?? '(none - nothing reached the provider)',
        '',
        'THE STATE SUMMARY, SENT WITH EVERY SENTENCE',
        '='.repeat(78),
        summary,
        ''
    ];

    for (const r of rows) {
        const verdict = r.action === 'unclear' ? 'SHRUGGED' : r.bound ? 'ok' : 'TARGET DID NOT BIND';
        out.push(
            '',
            '='.repeat(78),
            `SAID: ${r.said.text}`,
            `A FAIR ANSWER WOULD BE: ${r.said.fair}`,
            '-'.repeat(78),
            `GOT: ${r.action}${r.target ? ` -> ${r.target}` : ''}`
            + `${r.steps ? `   steps: ${r.steps}` : ''}   [${r.source}]   ${verdict}`
        );
        if (r.note) out.push(`WHY: ${r.note}`);
        if (r.exchanges.length === 0) {
            out.push('', 'NOTHING WAS SENT TO THE MODEL - read deterministically.');
        }
        r.exchanges.forEach((exchange, at) => {
            out.push(
                '',
                `--- call ${at + 1}: what was asked (state summary and system prompt omitted, `
                + 'both are printed once above) ---',
                exchange.sent.split('BEFORE YOU ANSWER')[1]
                    ? 'BEFORE YOU ANSWER' + exchange.sent.split('BEFORE YOU ANSWER')[1]
                    : exchange.sent,
                `--- call ${at + 1}: what came back (finishReason: ${exchange.finish}) ---`,
                exchange.got
            );
        });
    }

    writeFileSync(traceFile, out.join('\n'), 'utf-8');
    console.log(`\nfull exchange written to ${traceFile}`);
}
