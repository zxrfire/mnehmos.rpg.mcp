/** The broad investigation read scans words inside its target: speaking to
 * Study Keeper or Search Keeper became an investigation, and Trade Elder
 * became a trade. An explicit conversation must keep its named listener and
 * topic. Actual investigation and trade retain their ordinary readers. */
import { expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';
import { theClausesOf } from '../../src/web/a-sentence-can-be-more-than-one-call.js';

it('reads the speaking verb instead of acting on a word in the listener name', () => {
    for (const name of ['Study Keeper', 'Search Keeper', 'Trade Elder']) {
        for (const verb of ['I speak with', 'I talk to']) {
            expect(parseIntent(`${verb} ${name}`), name)
                .toMatchObject({ action: 'interact', intent: 'talk', target: name });
        }
    }
});

it('retains the conversation topic and leaves a later action separate', () => {
    const input = 'I speak with Study Keeper about the manuscript';
    expect(parseIntent(input)).toMatchObject({ action: 'interact', intent: 'talk',
        target: 'Study Keeper', topic: 'manuscript' });
    expect(theClausesOf(`${input} and then I leave`)).toEqual([input, 'I leave']);
});

it('retains real study and trade as their own acts', () => {
    expect(parseIntent('I inspect the manuscript')).toMatchObject({ action: 'investigate', target: 'manuscript' });
    expect(parseIntent('I trade with Study Keeper')).toMatchObject({ action: 'interact', intent: 'trade', target: 'Study Keeper' });
});
