/**
 * A landed theft moves something out of one purse and into another.
 *
 * The verb resolved, wrote a grudge and drew a reprisal for a while before it
 * moved any value at all, which made every consequence downstream of it a
 * consequence of nothing. Rich and poor are both here because the deed is
 * priced on what the loss was against what they had, so the same number taken
 * from two people is two different wrongs.
 */
import { makeGameInWorld, engineCalls } from './harness';

describe('steal takes something', () => {
    it('rich and poor', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'lift', worldSeed: 'world-lift' });
        const { cultivator } = await game.newRun('Wen Shuyi');
        db.prepare('UPDATE cultivators SET realm_ordinal = 40, spirit_stones = 0, hp = 90000, max_hp = 90000 WHERE id = ?').run(cultivator.id);

        const world = (await game.loadWorld())!;
        const alive = [...world.npcs].filter(n => n.status === 'alive' && n.spiritStones > 0)
            .sort((a, b) => b.spiritStones - a.spiritStones);
        const rich = alive[0];
        const poor = alive.filter(n => n.spiritStones > 0 && n.spiritStones < 40 && n.cultivation.realmOrdinal <= 2 && n.name !== 'Wen Shuyi')[0];

        for (const target of [rich, poor]) {
            const place = world.locations.find(l => l.id === target.locationId);
            db.prepare('UPDATE cultivators SET location = ?, spirit_stones = 0 WHERE id = ?').run(place?.name ?? target.locationId, cultivator.id);
            await game.act('I look around');
            const had = target.spiritStones;
            let landed = false;
            for (let i = 0; i < 10 && !landed; i++) {
                const r = await game.act(`I steal from ${target.name}`);
                const att = engineCalls(r).find(c => c.name === 'engine.resolveAttempt');
                landed = /they agreed/.test(att?.summary ?? '');
                if (landed) {
                    const after = (db.prepare('SELECT spirit_stones FROM cultivators WHERE id = ?').get(cultivator.id) as any).spirit_stones;
                    console.log(`\n===== ${target.name} (ord ${target.cultivation.realmOrdinal}) had ${had}; my purse is now ${after}`);
                    console.log(r.narration.slice(0, 1200));
                    console.log('CALLS:\n  ' + engineCalls(r).filter(c => /Obligation|recordTie/.test(c.name)).map(c => `${c.name}: ${c.summary.slice(0, 600)}`).join('\n  '));
                    console.log('STRUCT:', r.toolCalls.filter(c => /Lift:/.test(c.summary)).map(c => c.summary));
                }
            }
            if (!landed) console.log(`no landing on ${target.name} in 10`);
        }
    }, 300000);
});
