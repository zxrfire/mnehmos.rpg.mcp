/** The 8210cf97 source ratchet found the autonomous contract pass calling
 * markDead directly when a dao oath broke. A native decision must use the
 * world's ending authority; a refused ending must not emit a death receipt.
 * Identical ordinary/stated arms draw the same oath strike. Ordinary deaths
 * prove the fatal branch was reached, while the stated person still pays the
 * same bodily cost. No historical precondition or long walk is needed. */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { CATALOG_STATES_STANDING_TAG, createNpc, setRealm, theWorldMayEnd } from '../../../src/engine/world/npc-state.js';
import { MAX_ORDINAL, realmIndexOf } from '../../../src/engine/cultivation/realms.js';
import { TRIBULATION_LETHAL_STRIKES } from '../../../src/engine/cultivation/breakthrough.js';
import { strikesForABrokenDaoOath } from '../../../src/engine/cultivation/existence.js';
import { agreeOpenContract } from '../../../src/engine/social/open-contracts.js';
import { breakOpenContract } from '../../../src/engine/world/people-agree-open-contracts.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../../../src/engine/world/history.js';

const ordinal = Array.from({ length: MAX_ORDINAL + 1 }, (_, at) => at).find(at =>
    strikesForABrokenDaoOath(realmIndexOf(at)) >= TRIBULATION_LETHAL_STRIKES + 2)!;

function sworn(seed: string, stated: boolean) {
    const world = createWorld({ seed, presentYear: 0, regionCount: 0, skipPriorAges: true });
    const person = setRealm(createNpc(seed, { id: 'breaker', onDay: 0, bornOnDay: -20 * 365,
        tags: stated ? [CATALOG_STATES_STANDING_TAG] : [] }), ordinal, 0);
    expect(theWorldMayEnd(person), 'the ending authority recognises this starting body').toBe(!stated);
    const other = createNpc(seed, { id: 'other', onDay: 0, bornOnDay: -20 * 365 });
    world.npcs.push(person, other);
    const event = appendWorldFact(world, makeFact({ day: 0, kind: 'opportunity',
        summary: 'Two people agreed a dao oath.', visibility: 'secret',
        actors: [person, other].map(row => ({ id: row.id, name: row.name, role: 'agreed' })) }),
    { recur: false, bystanders: false });
    world.obligations.push(...agreeOpenContract({ firstId: person.id, secondId: other.id,
        firstTerms: 'Keep the word.', secondTerms: 'Keep the word.', binding: 'dao',
        firstConsents: true, secondConsents: true, end: { condition: 'Until released.' },
        day: 0, eventId: event.id }));
    const word = world.obligations.find(row => row.holderId === person.id)!;
    expect(breakOpenContract(world, person.id, word.id, 1)).toBe(true);
    return { world, person: world.npcs.find(row => row.id === person.id)! };
}

it('keeps a stated person alive without suppressing the same ordinary fatal strike', () => {
    let ordinaryDeaths = 0;
    for (let draw = 0; draw < 64; draw++) {
        const seed = `native-oath-ending-${draw}`;
        const ordinary = sworn(seed, false), stated = sworn(seed, true);
        const ended = ordinary.person.status === 'physically_dead';
        ordinaryDeaths += Number(ended);
        expect(ordinary.world.history.facts.filter(fact => fact.data.brokenDaoOath !== undefined)).toHaveLength(Number(ended));
        expect(stated.person.status).toBe('alive');
        expect(stated.world.history.facts.some(fact => fact.data.brokenDaoOath !== undefined)).toBe(false);
        expect(stated.person.cultivation.injuries).toEqual(ordinary.person.cultivation.injuries);
    }
    expect(ordinaryDeaths).toBeGreaterThan(0);
});
