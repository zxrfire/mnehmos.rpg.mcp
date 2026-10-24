/** Replay2 N1: the narrator gave a held slave an outright refusal. The private
 * speaker card must carry actual compulsion, scoped to its living holder. */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { writeActualPersonSeal } from '../../src/web/person-seals-at-the-actual-body.js';
import { thePeopleHere } from '../../src/web/the-narrator-plays-the-world.js';

it('voices compulsion only under the player\'s live slave seal', async () => {
    const h = await makeGameInWorld({ seed: 'reading3-voice', worldSeed: 'reading3-orders-world' });
    try {
        const { cultivator } = await h.game.newRun('Holder');
        const world = h.game.atHand!, day = routineTime(world);
        const place = worldLocationFor(world, cultivator.location)!;
        const area = theAreasOf(world, place).areas.find(area => area.for === 'street')!;
        const person = createNpc(world.seed, { id: 'reading3-voice-person', name: 'The Listener',
            onDay: day, bornOnDay: day - 25 * 365, locationId: place.id });
        person.activity = { kind: 'stationed', note: 'Standing here.', withIds: [], sinceDay: day, untilDay: null, standingIn: area.id };
        world.npcs.push(person);
        h.repos.cultivators.standIn(cultivator.id, area.id);
        h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, person);
        for (const binding of ['held', 'other', 'expired', 'qi'] as const) {
            writeActualPersonSeal(h.game, person.id, { kind: binding === 'qi' ? 'qi' : 'slave',
                byId: binding === 'other' ? 'another-holder' : cultivator.id, sinceDay: day - 1,
                liftsOnDay: binding === 'expired' ? day : null, note: 'Actual body effect.' }, day);
            const company = h.game.company(h.game.currentRun().cultivator);
            const card = thePeopleHere(company, cultivator.realmOrdinal, [], person.name).join('\n');
            expect(card.includes('Compelled by the player\'s slave seal'), binding).toBe(binding === 'held');
            if (binding === 'held') {
                expect(card).toContain('Resentment is possible; refusal is not');
                expect(card).toContain('Only engine-resolved acts have happened');
            }
        }
    } finally { h.db.close(); }
});
