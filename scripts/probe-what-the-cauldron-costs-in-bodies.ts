import { progressRequiredForOrdinal, REALM_TIERS, rankName } from '../src/engine/cultivation/realms.js';

/** Every qi-unit a body has spent to stand where it stands. */
function cultivationIn(ordinal: number): number {
    let total = 0;
    for (let i = 0; i < ordinal; i++) total += progressRequiredForOrdinal(i) ?? 0;
    return total;
}

const tier = (k: string) => REALM_TIERS.find(t => t.key === k)!;
const ns = tier('nascent_soul').ordinalStart;
const vr = tier('void_tribulation').ordinalStart;

const half = 10 * cultivationIn(ns);
const whole = 10 * cultivationIn(vr);

console.log(`one Nascent Soul    (ord ${ns}) carries ${cultivationIn(ns).toLocaleString()}`);
console.log(`one Void Refinement (ord ${vr}) carries ${cultivationIn(vr).toLocaleString()}`);
console.log(`HALF  = 10 Nascent Soul    = ${half.toLocaleString()}`);
console.log(`WHOLE = 10 Void Refinement = ${whole.toLocaleString()}`);
console.log('');
for (const ord of [1, 6, 12, 13, 16, 17, 20]) {
    const each = cultivationIn(ord);
    if (each === 0) { console.log(`ord ${ord} carries nothing yet`); continue; }
    console.log(`${rankName(ord).padEnd(26)} each=${each.toLocaleString().padStart(11)}  `
        + `HALF ${Math.ceil(half / each).toLocaleString().padStart(9)}  `
        + `WHOLE ${Math.ceil(whole / each).toLocaleString().padStart(11)}`);
}
