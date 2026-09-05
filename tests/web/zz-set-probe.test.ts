import { describe, it } from 'vitest';

import { makeGameInWorld, engineCalls, planned } from './harness';

describe('probe: what a set-shaped target does today', () => {
    it('records it', async () => {
        const { game } = await makeGameInWorld({ seed: 'probe-run', worldSeed: 'probe-world' });
        const { cultivator } = await game.newRun('Ke Yan');
        const here = (game as any).present(cultivator);
        // eslint-disable-next-line no-console
        console.log('STANDING HERE:', here.map((r: any) =>
            `${r.name}/${r.id}/ord${r.realmOrdinal}/sect=${r.sectId ?? '-'}`).join(' | '));

        for (const typed of [
            'I kill everyone here',
            'I exterminate his family',
            'I kill the whole sect',
            'I attack all the guards',
            'I kill everyone in the village'
        ]) {
            const result: any = await game.act(typed);
            // eslint-disable-next-line no-console
            console.log('\n>>>', typed);
            // eslint-disable-next-line no-console
            console.log('  plan:', JSON.stringify(planned(result)?.summary));
            for (const call of engineCalls(result)) {
                // eslint-disable-next-line no-console
                console.log(`  ${call.name}/${call.action} ok=${call.ok}: ${call.summary}`);
            }
            // eslint-disable-next-line no-console
            console.log('  prose:', String(result.narration ?? result.error ?? '').slice(0, 300));
        }
    }, 120000);
});
