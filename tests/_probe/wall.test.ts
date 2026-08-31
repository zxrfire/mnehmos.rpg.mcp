import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { progressRequiredForOrdinal, lifespanForOrdinal } from '../../src/engine/cultivation/realms.js';
import { stagnationYearsForOrdinal } from '../../src/schema/cultivation.js';
import { computeCultivationRate, DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation.js';
import { formInsight, recordAchievement, discoverableInsights } from '../../src/engine/cultivation/understanding.js';
import { canAttemptBreakthrough } from '../../src/engine/cultivation/breakthrough.js';
import { withOriginAccess } from '../../src/engine/cultivation/origin.js';
import { CultivationRNG } from '../../src/engine/cultivation/rng.js';
import type { Insight } from '../../src/schema/cultivation.js';

describe('cumulative', () => {
    it('prints', () => {
        const a = recordAchievement({ kind: 'enlightenment', onDay: 1, turn: 1, summary: 'x' }, new CultivationRNG('a'));
        const ctx = withOriginAccess('great_house', { survived: 'tribulation', locationTags: ['deep_cave'] });
        const cands = discoverableInsights({ spiritRoot: 'single_fire' }, ctx);
        const insights: Insight[] = cands.map(c => formInsight(c, 5, a));
        const lines: string[] = [];
        for (const veinFrom of [0, 15, 25]) {
            let age = 16;
            let blocked = -1;
            for (let o = 0; o < 45; o++) {
                const amb = o >= veinFrom ? 'sealed_vein' : 'normal';
                const rate = computeCultivationRate(
                    { spiritRoot: 'single_fire', injuries: [], insights, foundationQuality: 'exceptional' },
                    amb as never, { focusMultiplier: 1, techniqueBonus: 1.3, sectBonus: 1.2 }
                ).perDay;
                const sub = canAttemptBreakthrough({ realmOrdinal: o, cultivationProgress: 0, spiritRoot: 'single_fire', insights, alive: true }).progressSubstituted;
                const need = Math.max(0, progressRequiredForOrdinal(o) - sub) / (rate * DAYS_PER_YEAR);
                if (need >= stagnationYearsForOrdinal(o)) { lines.push(`vein@${veinFrom} SETTLE at o=${o} need=${need.toFixed(0)} allow=${stagnationYearsForOrdinal(o).toFixed(0)}`); blocked = o; break; }
                if (age + need >= lifespanForOrdinal(o)) { lines.push(`vein@${veinFrom} LIFESPAN at o=${o} age=${age.toFixed(0)} need=${need.toFixed(0)} life=${lifespanForOrdinal(o)}`); blocked = o; break; }
                age += need;
                if (o >= 33) lines.push(`vein@${veinFrom} o=${o} age=${age.toFixed(0)} need=${need.toFixed(0)} life=${lifespanForOrdinal(o)}`);
            }
            if (blocked < 0) lines.push(`vein@${veinFrom} REACHED 45 at age ${age.toFixed(0)}`);
        }
        writeFileSync('wall.txt', lines.join('\n'));
    });
});
