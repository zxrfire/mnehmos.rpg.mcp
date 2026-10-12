/**
 * A played stranger standing outside a house asked to go to the gate and
 * received the nearby inheritance grounds. The site parser treated the bare
 * gate noun as an inheritance-site approach. An ordinary local gate walk must
 * reach movement; inspecting an old gate keeps the existing exterior read.
 */
import { expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';

for (const sentence of ['I go to the gate', 'I walk to the gate', 'I head to the gate']) {
    it(`routes ${sentence} through ordinary movement`, () => {
        expect(parseIntent(sentence)).toMatchObject({ action: 'move', target: 'gate' });
    });
}

it('retains the exterior read of an old gate', () => {
    expect(parseIntent('I go and look at the old gate')).toMatchObject({ action: 'site', intent: 'outside' });
});
