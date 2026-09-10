import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from '../web/harness';

describe('probe: a shattered foundation on the played path', () => {
    it('says rebuilt, records nothing', async () => {
        let found = false;
        for (let attempt = 0; attempt < 40 && !found; attempt++) {
            const h = await makeGameInWorld({
                worldSeed: `zzq-fdn-${attempt}`,
                seed: `zzq-fdn-seed-${attempt}`
            });
            const opened = await h.game.newRun('Shen Wu');
            const id = opened.cultivator.id;

            // Stand at Foundation Establishment Perfection, on a real foundation,
            // with the accumulation to strike at the wall.
            h.repos.cultivators.update(id, {
                realmOrdinal: 16,
                cultivationProgress: 1_000_000
            } as never);
            h.repos.cultivators.establishFoundation(id, 'exceptional');

            for (let strike = 0; strike < 12 && !found; strike++) {
                const before = h.game.state().cultivator;
                if (before.realmOrdinal !== 16) break;
                h.repos.cultivators.update(id, { cultivationProgress: 1_000_000 } as never);
                const { narration } = await h.game.act('I break through');
                const after = h.game.state().cultivator;
                if (/foundation is now/i.test(narration)) {
                    found = true;
                    console.log('=== NARRATION ===');
                    console.log(narration);
                    console.log('=== BEFORE foundationQuality:', before.foundationQuality);
                    console.log('=== AFTER  foundationQuality:', after.foundationQuality);
                    console.log('=== AFTER  age:', after.age, ' BEFORE age:', before.age);
                    console.log('=== AFTER  realmOrdinal:', after.realmOrdinal);
                    console.log('=== fromDb:', JSON.stringify({
                        f: h.repos.cultivators.getById(id)?.foundationQuality,
                        age: h.repos.cultivators.getById(id)?.age,
                        soul: (h.repos.cultivators.getById(id) as any)?.soulState,
                        ic: (h.repos.cultivators.getById(id) as any)?.identityContinuity
                    }));
                }
                if (after.hp <= 0) break;
            }
        }
        expect(found, 'never produced a foundation-damaging failure').toBe(true);
    }, 300_000);
});
