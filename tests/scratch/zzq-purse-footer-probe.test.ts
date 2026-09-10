import { describe, it } from 'vitest';
import { makeGameInWorld } from '../web/harness';
import type { LLMProvider } from '../../src/agent/provider/types';

function recording(seen: string[], plan: Record<string, unknown>): LLMProvider {
    return {
        name: 'recording',
        async call(req: { messages: Array<{ role: string; content: string }> }) {
            const user = req.messages.find(m => m.role === 'user')?.content ?? '';
            const isIntent = user.includes('Respond with the JSON object only');
            if (!isIntent) seen.push(user);
            return { text: isIntent ? JSON.stringify(plan) : 'PROSE.' };
        }
    } as unknown as LLMProvider;
}

function practising(db: import('better-sqlite3').Database, id: string): void {
    db.prepare('UPDATE cultivators SET known_techniques = ? WHERE id = ?')
        .run(JSON.stringify(['lesser-qi-gathering-manual']), id);
}

describe('probe: the exact two sentences', () => {
    it('shows footer and status on one screen', async () => {
        for (const worldSeed of ['s12', 's8', 's3']) {
            const seen: string[] = [];
            const { db, game } = await makeGameInWorld({
                worldSeed,
                seed: worldSeed,
                provider: recording(seen, { action: 'cultivate', days: 3650 })
            });
            const { cultivator } = await game.newRun('Mo Qianshu');
            practising(db, cultivator.id);
            db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);

            seen.length = 0;
            await game.act('I cultivate for ten years');
            const whole = seen[seen.length - 1] ?? '';
            const st = await game.state();
            console.log(`\n##### ${worldSeed}  db=${st.cultivator?.spiritStones} #####`);
            for (const line of whole.split('\n')) {
                if (/stones left|a change of|spirit stones\.|Standing afterwards/i.test(line)) {
                    console.log('  | ' + line.trim());
                }
            }
        }
    }, 900_000);
});
