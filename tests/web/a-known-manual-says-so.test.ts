/**
 * Gemma finding 11: learning an already learned book printed only "refused"
 * and the code "already known". The handler's actual explanation and next
 * step must survive the played receipt; declining cannot consume more time.
 */
import { expect, it } from 'vitest';
import { makeGame } from './harness.js';
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';

it('says which manual is already known and how to practise it', async () => {
    const h = makeGame({ seed: 'reading-known-manual' });
    try {
        await h.game.newRun('Reader');
        const body = h.game.currentRun().cultivator;
        const art = TECHNIQUES.find(art => art.requiredOrdinal === 0 && art.category === 'cultivation')!;
        h.repos.techniques.upsert(art);
        h.repos.techniques.learn(body.id, art.id, 1);
        h.repos.cultivators.update(body.id, { knownTechniques: [art.id] });
        const before = h.game.currentRun().run.elapsedDays;
        const turn = await h.game.act(`I learn ${art.name}`);
        const receipt = turn.toolCalls.find(call => call.name === 'technique_manage.learn');
        expect(receipt).toBeDefined();
        expect(receipt!.summary).toContain(`already knows ${art.name}`);
        expect(receipt!.summary).toContain('practise');
        expect(turn.narration).toContain(`already knows ${art.name}`);
        expect(h.game.currentRun().run.elapsedDays).toBe(before);
    } finally { h.db.close(); }
});
