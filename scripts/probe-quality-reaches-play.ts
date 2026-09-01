/**
 * Does manual quality actually change anything in the PLAYED game?
 *
 * The dominant-strategy sweep found that `game.ts` computed four rate terms and
 * never sent `techniqueQuality` or `techniqueSpan`, so every manual in the web
 * path cultivated at identical speed - discarding what `manual-quality.ts`
 * calls the largest non-realm term in the game. The MCP path had always passed
 * quality, so the two front ends disagreed about the same book.
 *
 * Adding fields to a return type is not the same as them arriving, so this asks
 * the rate function directly with what the web path now produces.
 */
import { computeCultivationRate } from '../src/engine/cultivation/cultivation.js';
import type { ManualQuality } from '../src/schema/cultivation.js';

const base = {
    cultivator: { spiritRoot: 'single_fire' as const, injuries: [], realmOrdinal: 8 },
    ambient: 'normal' as const
};

console.log('QUALITY, with everything else held still');
console.log('  tier'.padEnd(14) + 'perDay'.padStart(12) + 'vs sound'.padStart(11));
let sound = 0;
for (const q of ['corrupt', 'crude', 'sound', 'refined', 'pristine'] as ManualQuality[]) {
    const r = computeCultivationRate(base.cultivator, base.ambient, {
        techniqueBonus: 1.2, sectBonus: 1, locationBonus: 1, focusMultiplier: 1,
        techniqueQuality: q
    }).perDay;
    if (q === 'sound') sound = r;
    console.log('  ' + q.padEnd(12) + r.toFixed(4).padStart(12)
        + (sound ? `${(r / sound).toFixed(2)}x`.padStart(11) : ''.padStart(11)));
}

console.log('\nSPAN, the counterweight');
console.log('  the book covers'.padEnd(18) + 'perDay'.padStart(12));
for (const cap of [12, 20, 28, 44]) {
    const r = computeCultivationRate(base.cultivator, base.ambient, {
        techniqueBonus: 1.2, sectBonus: 1, locationBonus: 1, focusMultiplier: 1,
        techniqueQuality: 'sound',
        techniqueSpan: { requiredOrdinal: 5, cap, opening: null }
    }).perDay;
    console.log('  ' + `5 to ${cap}`.padEnd(18) + r.toFixed(4).padStart(12));
}
