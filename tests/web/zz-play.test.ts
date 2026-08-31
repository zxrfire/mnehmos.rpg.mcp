import { describe, it } from 'vitest';
import { makeGame } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';

describe('play', () => {
    it('stand in Sweptground and try to come away with a name', async () => {
        const { db, game } = makeGame({ seed: 'playtest-1', worldEnabled: true });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const before = new Set(gate.awareness(cultivator.id).map(r => r.name));
        console.log('START KNOWS:', [...before].join(' | '));
        console.log('LOCATION:', cultivator.location);

        const lines = [
            'I look around.',
            'I sit in the market and listen',
            'I listen to what people are saying',
            'I wait',
            'I look at who is about',
            'I ask around about the sects',
            'I buy a drink for someone'
        ];
        for (const said of lines) {
            const r = await game.act(said);
            console.log('\n> ' + said);
            console.log(r.narration.trim());
        }
        const after = gate.awareness(cultivator.id);
        console.log('\nEND KNOWS:', after.map(r => `${r.name} [${r.sourceKind}]`).join(' | '));
        console.log('NEW:', after.filter(r => !before.has(r.name)).map(r => r.name).join(' | ') || '(NOTHING)');
    });
});
