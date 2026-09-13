import { lifespanForOrdinal } from '../src/engine/cultivation/realms.js';
import { gradeOfWhatItYielded } from '../src/engine/world/hunting-a-spirit-beast.js';
import { REGROWTH_YEARS_BY_GRADE } from '../src/engine/world/what-a-place-still-has-in-the-ground.js';
import { BEASTS, BEAST_MATERIALS } from '../src/data/cultivation/beasts.js';
import { whatTheyWillTakeFor } from '../src/engine/social-leverage/what-they-will-take-instead-of-money.js';

for (const o of [12, 20, 24, 29, 30, 33]) {
    console.log(o, 'lifespan', lifespanForOrdinal(o), 'grade', gradeOfWhatItYielded(o));
}
console.log('regrowth', REGROWTH_YEARS_BY_GRADE);
for (const g of ['mortal','earth','heaven','immortal','chaos'] as const) {
    const v = BEAST_MATERIALS.filter(m => m.grade === g).map(m => m.value).sort((a,b)=>a-b);
    console.log(g, 'n=', v.length, 'values', v);
}
for (const b of BEASTS.filter(b => b.speaks)) {
    console.log(b.id, b.ordinal, b.element, b.ability.kind, JSON.stringify(b.materialIds), b.disposition, b.persistence, b.biome);
    for (const ask of ['a_real_favour','against_their_interest','a_betrayal'] as const) {
        console.log('   ', ask, whatTheyWillTakeFor(b.id, { ask, hasACashPrice: false, theyNeedSomethingDone: false }));
    }
}
