/**
 * Play a scripted session through the whole game with the local model on both phases, and write
 * down what each turn was: how it was routed, who narrated it, what the engine ruled, and the prose.
 *
 *     npx tsx scripts/probe-play-a-session-through-the-model.ts <out.json> <worldSeed> <runSeed> <name> "turn" ...
 *
 * `{family}`, `{neighbour}` and `{other}` in a turn become names out of the opening's own record,
 * so one script reads in any world. ADMIN lines work. An instrument, not a test: it needs a model,
 * it costs about fifteen seconds a turn on gemma4:31b, and the prose moves between runs.
 *
 * Each turn also keeps `told`, the user message the narration call was sent, so a card or a block
 * the model misread can be seen rather than guessed at.
 *
 * Read `narrationSource` before reading the prose. A turn marked `fallback` is the engine's own
 * lines, and measuring those as the narrator is measuring nothing - which is how a whole played
 * session once read like a report while nobody had checked the model ever answered.
 */
import Database from 'better-sqlite3';
import { writeFileSync } from 'node:fs';
import { migrate } from '../src/storage/migrations.js';
import { GameService } from '../src/web/game.js';
import { ProviderNarrator } from '../src/web/narrator.js';
import { OllamaProvider } from '../src/agent/provider/ollama.js';
import { createWorld, resetCultivationWorlds } from '../src/server/state/cultivation-world.js';
import { narrationSystemPrompt } from '../src/web/prompt.js';
import type { ProviderCallOpts } from '../src/agent/provider/types.js';

const [out, worldSeed, runSeed, name, ...turns] = process.argv.slice(2);
if (!out || !worldSeed || !runSeed || !name) {
    console.error('usage: <out.json> <worldSeed> <runSeed> <name> "turn" ...');
    process.exit(1);
}
process.env.ADMIN_MODE = 'true';
const model = process.env.OLLAMA_MODEL ?? 'rpg-gemma4-31b';
const provider = new OllamaProvider({ defaultModel: model, keepAlive: '2h' });
let told: string | null = null;
const call = provider.call.bind(provider);
provider.call = (opts: ProviderCallOpts) => {
    if (opts.messages[0]?.content === narrationSystemPrompt()) told = String(opts.messages.at(-1)?.content ?? '');
    return call(opts);
};
const narrator = new ProviderNarrator(provider, { model, timeoutMs: 0 });

resetCultivationWorlds();
const db = new Database(':memory:'); db.pragma('foreign_keys = ON'); migrate(db);
const game: any = new GameService({ db, narrator, worldEnabled: true, adminMode: true, seedFactory: () => runSeed });
resetCultivationWorlds();
await createWorld({ seed: worldSeed });

const record: any = { model, worldSeed, runSeed, turns: [] };
const save = () => writeFileSync(out, JSON.stringify(record, null, 1));
let started = Date.now();
await game.newRun(name);
const opening = game.state().log;
record.turns.push({
    said: null,
    ms: Date.now() - started,
    engine: opening.filter((e: any) => e.role === 'engine').map((e: any) => e.text),
    narration: opening.filter((e: any) => e.role === 'narrator').map((e: any) => e.text).join('\n\n'),
    told
});

const recap: string = record.turns[0].engine.join('\n');
const namesAfter = (marker: string): string[] => {
    const at = recap.indexOf(marker);
    if (at < 0) return [];
    // A name leads its line, followed either by a label ("Kong Zhaolu. Family.") or by what they
    // are to the player ("Kong Zhaolu raised you.").
    return recap.slice(at).split('\n').slice(1)
        .map(line => /^([A-Z][a-z]+ [A-Z][a-z]+)[. ]/.exec(line)?.[1])
        .filter((name): name is string => name !== undefined);
};
const family = namesAfter('The household:')[0] ?? 'somebody';
const known = namesAfter('People you can already put a name to');
const fill = (line: string) => line
    .replaceAll('{family}', family)
    .replaceAll('{neighbour}', known[0] ?? family)
    .replaceAll('{other}', known[1] ?? known[0] ?? family);

for (const raw of turns) {
    const said = fill(raw);
    const before = game.state().log.length;
    started = Date.now();
    told = null;
    let turn: any;
    try { turn = await game.act(said); } catch (err) { turn = { narration: `THREW: ${(err as Error).message}`, toolCalls: [] }; }
    const log = game.state().log.slice(before);
    const routing = (turn.toolCalls ?? []).find((c: any) => c.name === 'narrator.plan');
    const narrated = (turn.toolCalls ?? []).find((c: any) => c.name === 'narrator.narrate');
    record.turns.push({
        said,
        ms: Date.now() - started,
        routing: routing ? { action: routing.action, source: routing.source, summary: routing.summary } : null,
        narrationSource: narrated?.source ?? null,
        narrationNote: narrated?.note ?? null,
        engine: log.filter((e: any) => e.role === 'engine').map((e: any) => e.text),
        narration: turn.narration,
        told
    });
    console.log(`${((Date.now() - started) / 1000).toFixed(1)}s  ${routing?.source}/${narrated?.source}  > ${said}`);
    save();
}

// The measures the corpus was taken on, over the narration only. Bands are per book across the
// reference corpus's first books: see `probe-does-the-prose-read-like-the-genre.ts`.
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const paragraphs = record.turns.slice(1).flatMap((t: any) => String(t.narration).split(/\n+/).map((p: string) => p.trim()).filter(Boolean));
const spoken = paragraphs.filter((p: string) => /["“]/.test(p));
const sorted = paragraphs.map(words).sort((a: number, b: number) => a - b);
const pct = (n: number, d: number) => d === 0 ? '-' : `${Math.round(100 * n / d)}%`;
const silent = record.turns.slice(1)
    .filter((t: any) => /says nothing|say a word|says a word|offers a word|offer a word|does not speak|do not speak|nobody speaks|neither speaks|is silent|are silent|in silence/i.test(t.narration)).length;
// Somebody described by an act they are not performing: "he does not look up". Counted outside
// quotation marks, per hundred words, the way the corpus figure below was taken.
const narration = paragraphs.join(' ').replace(/"[^"]*"/g, ' ');
const negations = (narration.match(/\b(?:does|do|did) not\b|\b(?:doesn|don|didn)'t\b/gi) ?? []).length;
console.log(`\nmodel narrated ${record.turns.slice(1).filter((t: any) => t.narrationSource === 'model').length}/${record.turns.length - 1}`
    + `   median paragraph ${sorted[Math.floor(sorted.length / 2)] ?? 0}w   speech ${pct(spoken.length, paragraphs.length)}`
    + `   loud speech ${pct(spoken.filter((p: string) => p.includes('!')).length, spoken.length)}`
    + `   turns with a silence line ${silent}`
    + `   not-doing ${(100 * negations / Math.max(1, words(narration))).toFixed(2)}/100w`);
console.log('corpus first books: median 32-40w, speech 24-35%, loud speech 31-52%, not-doing 0.19-0.32/100w');
save();
