/**
 * The MCP current-check port originally returned before its asynchronous scene
 * read finished. The next held body portion could therefore use its opening
 * terms after a real repository consequence had changed those terms.
 * This controlled boundary is an operator arrangement, not a claim that this
 * seed naturally teaches an art. A real eligible catalog art is learned at
 * mastery0, then its canonical mastery row changes once at the native midpoint.
 * Synchronous and asynchronously delivered consequences must produce the same
 * native progress; both must differ from leaving the actual mastery unchanged.
 * All arms run in one invocation with the same body/world seeds. They use the
 * same held body, native world advance, rate reader and repository—no copied
 * progression formula, manufactured encounter, extra RNG stream or model.
 */
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { PLAYER_ROLL_IDENTITY } from '../../src/web/encounters.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { spendAnOrdinarySpanAtTheActualClock } from '../../src/web/spending-an-ordinary-span-at-the-actual-clock.js';

async function arm(mode: 'synchronous' | 'asynchronous' | 'unchanged') {
    const h = await makeGameInWorld({ seed: 'fresh-native-portion', worldSeed: 'fresh-native-world', worldEnabled: true });
    try {
        await h.game.newRun('A current native portion');
        const opened = h.game.currentRun();
        h.game.repos.cultivators.update(opened.cultivator.id, { realmOrdinal: 0,
            cultivationProgress: 0, satiety: 12, spiritStones: 100, injuries: [] });
        const art = TECHNIQUES.find(row => row.category === 'cultivation' && row.requiredOrdinal <= 0);
        if (!art) throw new Error('The actual catalog has no eligible opening cultivation art.');
        // The ordinary techniques repository stores materialized catalog rows;
        // an opening harness need not already own a manual. Use its real catalog
        // row through the native repository before the explicit operator lesson.
        h.game.repos.techniques.upsert(art);
        expect(h.game.repos.techniques.learn(opened.cultivator.id, art.id, 0)).not.toBeNull();
        const before = h.game.currentRun();
        h.game.atHand = await prepareWorldClockForPreciseSpan(before.run, before.cultivator);
        const start = routineTime(h.game.atHand);
        const initialTerms = h.game.rateTermsFor(before.cultivator);
        let delivered = false;
        const change = () => {
            if (delivered) return;
            delivered = true;
            if (mode !== 'unchanged') {
                expect(h.game.repos.techniques.setMastery(before.cultivator.id, art.id, 1)).not.toBeNull();
                const live = h.game.currentRun().cultivator;
                expect(h.game.rateTermsFor(live).techniqueBonus).toBeGreaterThan(initialTerms.techniqueBonus);
            }
        };
        const afterBoundary = mode === 'asynchronous' ? async () => {
            // Genuine async delivery; do not replace the native scene with a
            // precomputed multiplier or manually resume its body iterator.
            await Promise.resolve();
            change();
        } : change;
        const spent = await spendAnOrdinarySpanAtTheActualClock(h.game, before.run,
            before.cultivator, .125, { seed: before.run.seed, rollIdentity: PLAYER_ROLL_IDENTITY,
                turn: before.run.turn, startDay: before.run.elapsedDays,
                locationId: before.cultivator.location ?? 'unknown',
                options: { ...initialTerms, ground: h.game.groundFor(before.cultivator), focusMultiplier: 1 },
                randomEvents: false, autoBreakthrough: false, rations: 0 },
            'reserved', undefined, before.run.turn + 1, undefined,
            { dates: [start + .0625], afterBoundary, stop: () => null });
        expect(delivered).toBe(true);
        expect(spent.skip.simulatedDays).toBe(.125);
        expect(spent.applied.run.elapsedDays).toBe(before.run.elapsedDays + .125);
        expect(spent.applied.run.turn).toBe(before.run.turn + 1);
        const afterWorld = await h.game.loadWorld();
        if (!afterWorld) throw new Error('The native current check lost its world.');
        expect(routineTime(afterWorld) - start).toBe(.125);
        return { progress: spent.applied.cultivator.cultivationProgress,
            lived: spent.applied.run.elapsedDays - before.run.elapsedDays,
            turns: spent.applied.run.turn - before.run.turn,
            satiety: spent.applied.cultivator.satiety, age: spent.applied.cultivator.age };
    } finally { h.db.close(); }
}

it('awaits current consequences before calculating the next native body portion', async () => {
    const synchronous = await arm('synchronous');
    const asynchronous = await arm('asynchronous');
    const unchanged = await arm('unchanged');
    expect(asynchronous).toEqual(synchronous);
    expect(asynchronous.progress).toBeGreaterThan(unchanged.progress);
    expect(asynchronous.lived).toBe(unchanged.lived);
    expect(asynchronous.turns).toBe(unchanged.turns);
});
