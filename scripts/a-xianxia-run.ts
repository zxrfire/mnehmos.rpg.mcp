/**
 * Play a xianxia scenario end to end, and print what the player was actually
 * told.
 *
 *   npx tsx scripts/a-xianxia-run.ts [model] [--scenario NAME]
 *   npx tsx scripts/a-xianxia-run.ts --deterministic
 *
 * The other bench in this directory measures PHASE 1 - which verb a sentence
 * reached. That is the cheap half. This one plays whole turns, because a
 * sentence that routes correctly and then resolves to a shrug has still cost
 * the player their turn, and only a played turn can tell the two apart.
 *
 * Every scenario is a thing somebody would actually do in this genre, and the
 * set is deliberately half generous and half monstrous: an engine that reads
 * one better than the other has an opinion, and the epigraph says it must not.
 */
import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';

import { migrate } from '../src/storage/migrations.js';
import { GameService } from '../src/web/game.js';
import { DeterministicNarrator, ProviderNarrator } from '../src/web/narrator.js';
import { OllamaProvider } from '../src/agent/provider/ollama.js';
import { createWorld, resetCultivationWorlds } from '../src/server/state/cultivation-world.js';
import { SCENARIOS, type Scenario } from './xianxia-scenarios.js';

// argv is [node, script, ...ours]; slicing is the only reliable read - matching
// on `!== argv[1]` picked up the node executable path and silently benched the
// default model while reporting the one that was asked for.
const args = process.argv.slice(2);
const arg = args.find(a => !a.startsWith('--'));
const deterministic = process.argv.includes('--deterministic');
const model = deterministic ? 'deterministic (no model)' : (arg ?? 'gemma4:31b');
const only = process.argv.includes('--scenario')
    ? process.argv[process.argv.indexOf('--scenario') + 1]
    : null;
const WORLD = 'a-xianxia-run';

async function freshRun() {
    resetCultivationWorlds();
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    const narrator = deterministic
        ? new DeterministicNarrator()
        : new ProviderNarrator(new OllamaProvider({ defaultModel: model }), {
            model, timeoutMs: 90_000
        });
    const game = new GameService({
        db, narrator, worldEnabled: true, adminMode: false, seedFactory: () => 'xianxia'
    });
    resetCultivationWorlds();
    await createWorld({ seed: WORLD });
    await (game as any).newRun('Probe');
    return game as any;
}

/** The bits of state a player would notice moving. */
function snapshot(game: any) {
    const c = game.state().cultivator;
    return {
        day: Math.round(game.state().run.elapsedDays),
        hp: c.hp, stones: c.spiritStones, ordinal: c.realmOrdinal,
        injuries: (c.injuries ?? []).length, location: c.location
    };
}

function movedBetween(a: any, b: any): string {
    const bits: string[] = [];
    for (const k of ['day', 'hp', 'stones', 'ordinal', 'injuries']) {
        if (a[k] !== b[k]) bits.push(`${k} ${a[k]}->${b[k]}`);
    }
    if (a.location !== b.location) bits.push(`moved to ${b.location}`);
    return bits.join('  ');
}

const slug = (only ? `${model}-only-${only}` : model).replace(/[^a-z0-9]/gi, '-');
const out: string[] = [`model=${model}  world=${WORLD}`, ''];
let answered = 0, shrugged = 0, total = 0;
/** One row per turn, for the review page. */
const rows: Array<{
    scenario: string; sign: string; said: string; outcome: string;
    calls: string; moved: string; narration: string;
}> = [];

for (const scenario of SCENARIOS as Scenario[]) {
    if (only && scenario.name !== only) continue;
    const game = await freshRun();
    out.push('='.repeat(78), `SCENARIO: ${scenario.name}   [${scenario.sign}]`,
        `what should happen: ${scenario.hope}`, '='.repeat(78));

    for (const said of scenario.turns) {
        const before = snapshot(game);
        let narration = '', ran = '', refused = false;
        try {
            const r = await game.act(said) as any;
            narration = String(r.narration ?? '').trim();
            // WHAT RAN, not what moved. A held fight keeps its damage in the
            // fight state rather than on the row, so a real exchange leaves the
            // snapshot untouched - measuring deltas alone reported a working
            // confrontation as 'nothing moved'.
            const calls = (r.toolCalls ?? []) as Array<{ name?: string; ok?: boolean }>;
            ran = calls.map(c => c.name ?? '?').join(' ');
            refused = calls.some(c => c.ok === false);
        } catch (err) {
            narration = `THREW: ${err instanceof Error ? err.message : String(err)}`;
        }
        const after = snapshot(game);
        const shrug = /does not resolve into anything|thought does not resolve/i.test(narration);
        total++; if (shrug) shrugged++; else answered++;

        rows.push({
            scenario: scenario.name, sign: scenario.sign, said,
            outcome: shrug ? 'shrug' : refused ? 'refused' : 'ran',
            calls: ran, moved: movedBetween(before, after), narration
        });
        out.push('', `> ${said}`,
            `  [${shrug ? 'SHRUG' : refused ? 'refused' : 'ran'}] ${ran}`,
            `  state: ${movedBetween(before, after) || 'unchanged'}`,
            narration.split(String.fromCharCode(10)).map(l => `  | ${l}`).join(String.fromCharCode(10)).slice(0, 1400));
    }
    out.push('');
    // Written after EVERY scenario, not at the end. A run is 70 model calls and
    // a single stuck one used to make the whole thing indistinguishable from a
    // hang, with nothing on disk to show for forty minutes.
    save();
}

function save(): void {
    mkdirSync('llm-results', { recursive: true });
    writeFileSync(`llm-results/${slug}.txt`, out.join(String.fromCharCode(10)), 'utf-8');
    writeFileSync(`llm-results/${slug}.json`, JSON.stringify({
        model, world: WORLD, at: new Date().toISOString(), answered, shrugged, total, rows
    }, null, 1), 'utf-8');
}

out.push('', `answered ${answered}/${total}   shrugged ${shrugged}/${total}`);
save();
console.log(`answered ${answered}/${total}   shrugged ${shrugged}/${total}`);
console.log(`wrote llm-results/${slug}.txt and .json`);
