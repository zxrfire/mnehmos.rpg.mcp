/**
 * Is failure the expected outcome at the last crossing, and does that make
 * False Immortals rare?
 *
 * The setting makes two claims that constrain each other. The crossing from
 * forty-four is a wall almost nobody gets over - failure is what happens, and
 * completion is the exception even among the people who survive. And the world
 * holds a handful of False Immortals at any moment, one of whom anybody can
 * point to, with more the record does not model.
 *
 * Those are the same number seen from two ends. Make the crossing survivable
 * and the provinces fill up with the things; make it lethal enough and the
 * dated record of past crossings stops being possible. So this quotes the four
 * endings across candidates from the best anybody could assemble down to a worn
 * Transcender striking as a way of choosing how to die, and runs the measured
 * split through `immortalStock` to see what the world would actually hold.
 *
 *   npx tsx scripts/probe-the-last-crossing.ts
 */

import { assessLastCrossing } from '../src/engine/cultivation/breakthrough.js';
import { immortalStock, CROSSINGS_ATTEMPTED_PER_MILLENNIUM } from '../src/engine/world/ladder-odds.js';
import { LAST_CROSSING_ORDINAL, progressRequiredForOrdinal } from '../src/engine/cultivation/realms.js';
import { makeCultivator, makeInjuries } from '../tests/engine/cultivation/fixtures.js';
import type { Cultivator } from '../src/schema/cultivation.js';

const pct = (n: number) => `${(100 * n).toFixed(2)}%`.padStart(8);
const line = (s = '') => console.log(s);

const priced = progressRequiredForOrdinal(LAST_CROSSING_ORDINAL)!;

const CANDIDATES: { label: string; over: Partial<Cultivator> }[] = [
    {
        label: 'the best the world can assemble',
        over: {
            spiritRoot: 'mutated_lightning',
            attributes: { might: 3, insight: 4, fortune: 3, charm: 3 },
            foundationQuality: 'exceptional', age: 30_000
        }
    },
    {
        label: 'an apex chosen, well backed',
        over: {
            spiritRoot: 'single_fire',
            attributes: { might: 3, insight: 3, fortune: 2, charm: 2 },
            foundationQuality: 'stable', age: 55_000
        }
    },
    {
        label: 'a strong Transcender',
        over: {
            spiritRoot: 'dual_water_fire',
            attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
            age: 75_000
        }
    },
    {
        label: 'worn, late, and out of time',
        over: {
            spiritRoot: 'muddled_five_element',
            attributes: { might: 1, insight: 1, fortune: 0, charm: 1 },
            injuries: makeInjuries(6, 'serious'), age: 96_000
        }
    }
];

line();
line('  Standing at ordinal ' + LAST_CROSSING_ORDINAL + ', priced and ready to strike, on the best');
line('  ground anybody could stand on.');
line();
line('  candidate                            46       45     dead stranded   verdict');
line('  ' + '-'.repeat(88));

let best: ReturnType<typeof assessLastCrossing> | null = null;
for (const c of CANDIDATES) {
    const subject = makeCultivator({
        realmOrdinal: LAST_CROSSING_ORDINAL,
        cultivationProgress: priced,
        ...c.over
    });
    const a = assessLastCrossing(subject, 'sealed_vein');
    if (!best) best = a;
    line(`  ${c.label.padEnd(32)}${pct(a.trueImmortalChance)}${pct(a.falseImmortalChance)}`
        + `${pct(a.deathChance)}${pct(a.strandedChance)}   ${a.verdict}`);
}

line();
line('  WHAT THAT LEAVES STANDING IN THE WORLD');
line();
line('  Priced off the BEST candidate, which is the generous reading: nobody worse');
line('  than this improves the count, and most attempts are made by people worse.');
line();
const a = best!;
const stock = immortalStock({
    trueImmortal: a.trueImmortalChance,
    falseImmortal: a.falseImmortalChance,
    dead: a.deathChance,
    stranded: a.strandedChance
});
line(`  attempts per millennium, off the dated record: ${CROSSINGS_ATTEMPTED_PER_MILLENNIUM}`);
line(`  False Immortals produced per millennium:       ${stock.falseImmortalsPerMillennium.toFixed(2)}`);
line(`  True Immortals produced per millennium:        ${stock.trueImmortalsPerMillennium.toFixed(3)}`);
line(`  expected resident at any moment:               ${stock.expectedResident.toFixed(2)}`);
line();
line('  One resident anybody can point to, and others the record does not model, is');
line('  a residence figure of roughly one to three. Below about one half the setting');
line('  cannot support the man it already names; above about four the provinces have');
line('  more of them than they have apex sects.');
line();
