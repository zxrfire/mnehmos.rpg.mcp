/** Every observed primary purse reach succeeded on 8210cf97. Successful
 * samples do not make failure impossible: the generic resolver reads actual
 * party strength against the pitch. Select an eligible underweight party for
 * the paying-ground reason, then require real failures and named lost members.
 * Motive, real reached states and on/off map changes remain in the parent
 * acceptance file. This immediate mechanism needs no historical setup. */
import { expect, it } from 'vitest';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { getSendingReason } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { postingFor, resolveSending, whoThisErrandIsPitchedFor }
    from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';

it('can fail and lose actual dispatched people when taking paying ground is a stretch', () => {
    const reason = getSendingReason('sending-to-take-the-ground-that-pays')!;
    const posting = postingFor({ reason, house: { id: 'short-purse', name: 'Reed House' }, pitchOrdinal: 40 });
    const roster = [38, 37, 36].map(ordinal => ({ id: 'hand-' + ordinal, name: 'Hand ' + ordinal, ordinal }));
    const party = whoThisErrandIsPitchedFor(posting, roster);
    expect(party.length).toBeGreaterThan(0);
    let failed = 0, lost = 0;
    for (let draw = 0; draw < 400; draw++) {
        const result = resolveSending({ posting, party, departsOnDay: 1000,
            rng: forStream('a-paying-ground-stretch', 'errand', draw) });
        failed += Number(result.outcome !== 'finished');
        lost += result.lost.length;
        for (const person of result.lost) expect(party.some(member => member.id === person.id)).toBe(true);
    }
    expect(failed).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
});
