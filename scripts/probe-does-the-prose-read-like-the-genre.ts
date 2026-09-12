/**
 * Does a narrated turn read like the genre, measured rather than eyeballed.
 *
 *   npx tsx scripts/probe-does-the-prose-read-like-the-genre.ts "I go to the market" ...
 *   SHOW=1 ... to print every paragraph with its word count.
 *
 * An instrument, not a test: it needs a model, it costs minutes, and the
 * numbers move. The three it reports are the three that separated our prose
 * from the corpus - paragraph length, how often anybody speaks, and how often
 * a paragraph is one short line. The corpus figures at the bottom are measured
 * off the reference material and are what the prompt is aimed at.
 *
 * PER TURN, NOT POOLED. Turn 0 hid behind the average for a long time: every
 * played turn was inside the corpus band while the opening was at twice the
 * paragraph length with nobody speaking, and the mean of the two looked fine.
 */
import Database from 'better-sqlite3';
import { migrate } from '../src/storage/migrations.js';
import { GameService } from '../src/web/game.js';
import { ProviderNarrator } from '../src/web/narrator.js';
import { OllamaProvider } from '../src/agent/provider/ollama.js';
import { createWorld, resetCultivationWorlds } from '../src/server/state/cultivation-world.js';

const model = process.env.OLLAMA_MODEL ?? 'gemma4:31b-80k';
resetCultivationWorlds();
const db = new Database(':memory:'); db.pragma('foreign_keys = ON'); migrate(db);
const narrator = new ProviderNarrator(new OllamaProvider({ defaultModel: model }), { model, timeoutMs: 180_000 });
const game: any = new GameService({ db, narrator, worldEnabled: true, adminMode: false, seedFactory: () => 'xianxia' });
resetCultivationWorlds();
await createWorld({ seed: 'a-xianxia-run' });
await game.newRun('Shen Wuyou');

const words = (s: string) => s.split(/\s+/).length;
const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const pct = (n: number, d: number) => (100 * n / d).toFixed(0) + '%';
const rows: string[] = [];
function measure(label: string, text: string) {
    const ps = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const sp = ps.filter(p => /["“]/.test(p)).length;
    const one = ps.filter(p => (p.match(/[.!?]/g) ?? []).length <= 1 && words(p) <= 14).length;
    rows.push(`${label.padEnd(34)} paras=${String(ps.length).padStart(2)}  med=${String(med(ps.map(words))).padStart(3)}w  max=${String(Math.max(...ps.map(words))).padStart(3)}w  speech=${pct(sp, ps.length).padStart(4)}  1-liners=${pct(one, ps.length).padStart(4)}`);
    if (process.env.SHOW) ps.forEach(p => console.log('   ' + String(words(p)).padStart(3) + 'w ' + (/["“]/.test(p) ? 'S ' : '. ') + p.slice(0, 100)));
}
for (const e of game.state().log) if (e.role === 'narrator') measure('TURN 0 (opening)', e.text);
for (const said of process.argv.slice(2)) {
    const turn = await game.act(said);
    if (turn.narration) measure('> ' + said.slice(0, 30), turn.narration);
}
console.log('\n' + rows.join('\n'));
// Turn 0 is deliberately NOT held to the opening figure. A novel's first
// chapter is a scene and is talkier than average; ours is an account of who
// the player is, which the design owner has ruled the one exception - so its
// speech share is expected low and only its paragraph length is comparable.
console.log('\nCORPUS overall (every played turn)       med= 30w         speech= 31%  1-liners= 17%');
console.log('CORPUS opening scene (not turn 0)        med= 31w         speech= 37%  1-liners= 12%');
