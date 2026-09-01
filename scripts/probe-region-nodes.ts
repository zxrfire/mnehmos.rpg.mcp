/**
 * Does the count of people standing on region CONTAINER nodes fall over time?
 *
 * `demography.test.ts` asserts fewer than 20 at year 250. The number is a proxy
 * for the real invariant, which the test states in its own comment: anybody on a
 * container is a survivor of the original placement rather than a new birth, so
 * THE COUNT MUST FALL AND NEVER CLIMB. Promotion raises ordinals, longer
 * ordinals grant longer lifespans, and more of the seeded cohort therefore
 * survives to any given year - which moves the proxy without touching what it
 * was proxying for. This checks the invariant directly.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'demography', catalog });
const regionIds = new Set(state.locations.filter(l => l.kind === 'region').map(l => l.id));
const onContainers = () =>
    state.npcs.filter(n => n.status === 'alive' && n.locationId && regionIds.has(n.locationId)).length;

console.log(`seeding   on region nodes: ${onContainers()}`);
let last = onContainers();
let climbed = false;
for (const [label, step] of [['100y', 100], ['250y', 150], ['400y', 150], ['600y', 200]] as const) {
    state = advanceWorldYears(state, step).state;
    const n = onContainers();
    if (n > last) climbed = true;
    console.log(`${label.padEnd(9)} on region nodes: ${n}${n > last ? '   CLIMBED' : ''}`);
    last = n;
}
console.log(climbed
    ? '\nThe count climbed: newborns are being placed on containers, which is the real defect.'
    : '\nThe count only ever falls: containers hold survivors of the original placement and '
      + 'nothing new is being put there.');
