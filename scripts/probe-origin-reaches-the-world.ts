/**
 * Does the resource axis reach the ongoing world at all?
 *
 * `deriveLife` takes an origin, spends its stones on pills, and the whole
 * "origin buys inputs, never rank" design rests on that. `applyAdvancement` in
 * `the-world-changing-on-its-own.ts` calls `deriveOrdinal` WITHOUT one, so every
 * living NPC re-derives every year as a thin-county farm child holding thirty
 * spirit stones - whatever they were actually born into, and whatever they are
 * actually holding.
 *
 * This measures the size of that, at the ceilings the world actually hands out.
 */
import { deriveLife } from '../src/engine/world/seeding.js';
import { rollAttributes, rollSpiritRoot } from '../src/engine/cultivation/spirit-roots.js';
import { rollOrigin } from '../src/engine/cultivation/origin.js';
import { forStream } from '../src/engine/cultivation/rng.js';

const SAMPLE = 6000;

function sweep(label: string, ceiling: number, age: number, useOrigin: boolean) {
    const peaks: number[] = [];
    for (let i = 0; i < SAMPLE; i++) {
        const r = forStream('origin-reach', 'life', i);
        const root = rollSpiritRoot(r.next());
        const attributes = rollAttributes([r.next(), r.next(), r.next(), r.next()]);
        const origin = rollOrigin(r.next());
        const life = deriveLife(root.key, attributes, age, 1, ceiling,
            forStream('origin-reach', 'walk', i),
            useOrigin ? { origin: origin.key } : {});
        peaks.push(life.ordinal);
    }
    const at = (lo: number) => peaks.filter(p => p >= lo).length;
    console.log('  ' + label.padEnd(34)
        + `${at(13)}`.padStart(8) + `${at(17)}`.padStart(7) + `${at(21)}`.padStart(9)
        + (at(13) > 0 ? `1 in ${(SAMPLE / at(13)).toFixed(0)}` : 'none').padStart(12)
        + (peaks.reduce((s, p) => s + p, 0) / SAMPLE).toFixed(2).padStart(9));
}

console.log(`ORIGIN PASSED VERSUS ORIGIN DROPPED - ${SAMPLE} lives each`);
console.log('  ' + 'case'.padEnd(34) + 'found'.padStart(8) + 'core'.padStart(7)
    + 'nascent'.padStart(9) + 'found rate'.padStart(12) + 'mean'.padStart(9));
for (const [ceiling, age] of [[20, 100], [20, 60], [13, 100], [16, 100], [44, 300]] as const) {
    sweep(`ceiling ${ceiling}, age ${age}, origin`, ceiling, age, true);
    sweep(`ceiling ${ceiling}, age ${age}, NO origin`, ceiling, age, false);
}
