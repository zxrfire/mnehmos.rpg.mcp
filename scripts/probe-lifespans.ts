import { lifespanForOrdinal, rankName } from '../src/engine/cultivation/realms.js';
import { stagnationYearsForOrdinal } from '../src/schema/cultivation.js';
console.log('ord   lifespan   settling   rank');
for (const o of [0, 6, 12, 13, 16, 20, 24, 28, 32, 36, 40, 44, 45, 46]) {
    console.log(String(o).padStart(3) + String(lifespanForOrdinal(o)).padStart(11)
        + String(Math.round(stagnationYearsForOrdinal(o))).padStart(11) + '   ' + rankName(o));
}
