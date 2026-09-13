/**
 * Attribution, pooled across runs.
 *
 * The per-turn figure swings between 20 and 100 per cent because a turn holds
 * two to four spoken paragraphs. Pooling every spoken paragraph across several
 * runs is the only way to say whether the rule is being followed.
 */
import Database from 'better-sqlite3';
import { migrate } from '../src/storage/migrations.js';
import { GameService } from '../src/web/game.js';
import { ProviderNarrator } from '../src/web/narrator.js';
import { OllamaProvider } from '../src/agent/provider/ollama.js';
import { createWorld, resetCultivationWorlds } from '../src/server/state/cultivation-world.js';

const model = process.env.OLLAMA_MODEL ?? 'gemma4:31b-80k';
const SAID = /\b(?:says?|said|asks?|asked|repl(?:y|ies|ied)|answers?|answered|murmurs?|murmured|shouts?|shouted|calls?|called|adds?|added|whispers?|whispered|cries|cried|tells?|told|offers?|offered|snaps?|snapped|repeats?|repeated)\b/i;

let spoken = 0, attributed = 0, paras = 0, past = 0;
const PAST = /\b(?:was|were|had|did not|looked|turned|said|walked|stood|took)\b/;

for (const seed of ['pool-a', 'pool-b', 'pool-c']) {
    resetCultivationWorlds();
    const db = new Database(':memory:'); db.pragma('foreign_keys = ON'); migrate(db);
    const narrator = new ProviderNarrator(new OllamaProvider({ defaultModel: model }), { model, timeoutMs: 240_000 });
    const game: any = new GameService({ db, narrator, worldEnabled: true, adminMode: false, seedFactory: () => seed });
    resetCultivationWorlds();
    await createWorld({ seed: 'a-xianxia-run' });
    await game.newRun('Shen Wuyou');
    for (const said of ['I go to the market', 'I ask the stallholder how much for the manual']) {
        const turn = await game.act(said);
        for (const p of (turn.narration ?? '').split(/\n+/).map((x: string) => x.trim()).filter(Boolean)) {
            paras++;
            if (/["“]/.test(p)) { spoken++; if (SAID.test(p)) attributed++; }
            else if (PAST.test(p) && !/["“]/.test(p)) past++;
        }
    }
}
const pct = (n: number, d: number) => d === 0 ? '-' : (100 * n / d).toFixed(0) + '%';
console.log(`\nPOOLED over 3 runs x 2 turns`);
console.log(`  paragraphs        ${paras}`);
console.log(`  spoken            ${spoken}`);
console.log(`  attributed        ${attributed}  (${pct(attributed, spoken)})   corpus ~25%`);
console.log(`  narration w/ past ${past}  (${pct(past, paras - spoken)} of unspoken)  - rough tense check`);
