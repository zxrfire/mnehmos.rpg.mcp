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
    // ATTRIBUTION IS A FLOOR, NOT A RATE. This counts a closed list of
    // speech verbs, and a narrator writing "a voice drifts from the crowd"
    // is attributing in a way no list catches - so read a LOW number as
    // meaning something and a high one as meaning what it says. It is here
    // because it is what separated our dialogue from the corpus: measured,
    // three quarters of this genre's speech paragraphs carry no speech verb
    // at all, and the single-line paragraphs follow from that rather than
    // from any rule about rhythm - stated three ways in three positions,
    // they would not move until attribution did.
    const said = new RegExp('\\b(?:say|says|said|ask|asks|asked|repl(?:y|ies|ied)|answers?|answered|murmurs?|murmured|shouts?|shouted|calls?|called|adds?|added|whispers?|whispered|cries|cried|tells?|told|offers?|offered)\\b', 'i');
    const spoken = ps.filter(p => /["“]/.test(p));
    const attributed = spoken.filter(p => said.test(p)).length;
    rows.push(`${label.padEnd(34)} paras=${String(ps.length).padStart(2)}  med=${String(med(ps.map(words))).padStart(3)}w  max=${String(Math.max(...ps.map(words))).padStart(3)}w  speech=${pct(sp, ps.length).padStart(4)}  1-liners=${pct(one, ps.length).padStart(4)}  attributed=${spoken.length ? pct(attributed, spoken.length).padStart(4) : '   -'}`);
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
// RANGES, NOT TARGETS, because two of these three are not targets. Measured
// per book over 24 books, front and back matter trimmed and site stamps
// dropped: %-SPEECH is a real invariant (pooled 30.9, median of books 30.8,
// spread 23.7-38.3). Paragraph length is reasonably stable. ONE-LINERS ARE
// NOT A TARGET - 5.9% to 30.0% by book, and the pooled 16.7% is the longest
// books pulling an average. An earlier cut printed 17% as a single figure and
// it was chased three times. Read a row as in-band or out, never as near to
// or far from one number.
console.log('\nCORPUS, per book   median words 21-40   speech 24-38%   one-liners 7-15%');
// One-liners: 7-15% per book, median 9%. The 30% outlier is one work by a
// DIFFERENT AUTHOR and is excluded - its composition matches the rest, it
// simply breaks paragraphs more often, so it is an author's habit and not
// this register. Of the one-liners, two thirds are a flat act or reveal, a
// fifth a line of speech alone, an eighth the body doing one thing.
console.log('CORPUS, pooled     median words   31   speech    31%   one-liners   17%');
console.log('CORPUS paragraph mix    1 sentence 29%   2 sentences 27%   3 sentences 19%   4+ 25%');
// Sampled per book at beginning, middle and end (N=250 each). Length and
// one-liners are flat across a book; DIALOGUE THINS TOWARD THE END, so a
// measurement taken at one position is wrong about speech.
console.log('CORPUS by position  begin 35w/35% speech   middle 34w/32%   end 32w/25%');
