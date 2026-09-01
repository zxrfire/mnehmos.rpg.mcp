/**
 * What does enforcing the dao requirement do to the standing population?
 *
 * The gate has shipped switched OFF since it was written, because the world it
 * would have been enforced against could not comprehend anything. The design
 * has now asked for it ON from the Nascent Soul crossing, rising with height,
 * so the question is no longer whether the curve is right - it is what the
 * curve costs the world, measured before and after rather than argued.
 *
 * THE NUMBER TO WATCH IS NOT THE TOTAL. It is the shape above Core Formation.
 * A gate at ordinal 20 that nobody can pass does not thin the upper bands, it
 * DELETES them, and a world with no elders fails the acceptance test whatever
 * its headcount says. So this reports the band histogram, and separately the
 * roads the population actually holds - because a requirement of N against a
 * population that holds zero is not a difficulty setting, it is a wall.
 *
 *   npx tsx scripts/probe-what-the-dao-gate-costs-the-world.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { REALM_TIERS, progressRequiredForOrdinal, realmForOrdinal } from '../src/engine/cultivation/realms.js';
import { woundsCarriedBy } from '../src/engine/world/npc-state.js';
import {
    canAttemptBreakthrough,
    DAO_GATE_FROM_ORDINAL,
    daoRequirementCurve,
    daoRequirementFor,
    roadsWalked
} from '../src/engine/cultivation/breakthrough.js';

const catalog = await loadCultivationCatalog();
const SEEDS = ['dao-cost-a', 'dao-cost-b', 'dao-cost-c'];
const YEARS = Number(process.env.YEARS ?? 300);

const line = (s = '') => console.log(s);

line();
line('  THE CURVE AS IT STANDS');
line();
line(`  DAO_GATE_FROM_ORDINAL = ${DAO_GATE_FROM_ORDINAL}` +
    (DAO_GATE_FROM_ORDINAL > 46 ? '  (above the ladder - the gate is INERT)' : '  (the gate is LIVE)'));
line();
line('  crossing from        into                        curve   enforced');
line('  ' + '-'.repeat(74));
for (const ordinal of [12, 16, 20, 24, 28, 32, 36, 40, 44]) {
    const into = ordinal >= 44 ? 'the last crossing' : realmForOrdinal(ordinal + 1).name;
    line('  ' + `${realmForOrdinal(ordinal).name} ${ordinal}`.padEnd(34) +
        into.padEnd(22) +
        String(daoRequirementCurve(ordinal)).padStart(5) +
        String(daoRequirementFor(ordinal)).padStart(11));
}
line();

// ── What the world actually holds ────────────────────────────────────────

interface Shape {
    bands: number[];
    alive: number;
    /** Distinct non-element roads held, summed over the living. */
    roadsHeld: number;
    withAnyRoad: number;
}

function shapeOf(state: Awaited<ReturnType<typeof seedWorld>>['state']): Shape {
    const bands = REALM_TIERS.map(() => 0);
    let alive = 0, roadsHeld = 0, withAnyRoad = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        alive++;
        const index = REALM_TIERS.indexOf(realmForOrdinal(npc.cultivation.realmOrdinal));
        bands[index]++;
        // Read the same way the gate reads it. An NPC record that carries no
        // insight field at all answers zero, which is the finding.
        const roads = roadsWalked((npc.cultivation as { insights?: [] }).insights);
        roadsHeld += roads;
        if (roads > 0) withAnyRoad++;
    }
    return { bands, alive, roadsHeld, withAnyRoad };
}

line(`  THE STANDING POPULATION AFTER ${YEARS} YEARS, ${SEEDS.length} SEEDS`);
line();
line('  seed            ' + REALM_TIERS.map(t => t.name.slice(0, 6).padStart(7)).join(''));
line('  ' + '-'.repeat(16 + 7 * REALM_TIERS.length));

const totals = REALM_TIERS.map(() => 0);
let totalAlive = 0, totalWithRoad = 0, totalRoads = 0;
const seedTotals = REALM_TIERS.map(() => 0);
for (const seed of SEEDS) {
    let { state } = seedWorld({ seed, catalog });
    shapeOf(state).bands.forEach((n, i) => { seedTotals[i] += n; });
    state = advanceWorldYears(state, YEARS).state;
    const shape = shapeOf(state);
    shape.bands.forEach((n, i) => { totals[i] += n; });
    totalAlive += shape.alive;
    totalWithRoad += shape.withAnyRoad;
    totalRoads += shape.roadsHeld;
    line('  ' + seed.padEnd(16) + shape.bands.map(n => String(n).padStart(7)).join(''));
}
line('  ' + 'AT SEEDING'.padEnd(16) + seedTotals.map(n => String(n).padStart(7)).join(''));
line('  ' + 'TOTAL'.padEnd(16) + totals.map(n => String(n).padStart(7)).join(''));
line();
line(`  alive ${totalAlive}, of whom ${totalWithRoad} hold at least one road besides their own`);
line(`  (${totalRoads} roads held in total across the whole living population)`);
line();
line('  Above Core Formation: ' +
    totals.slice(3).reduce((a, b) => a + b, 0) + ' of ' + totalAlive);
line();

// ── WHO THE GATE ACTUALLY STOPS ──────────────────────────────────────────
//
// The band histogram above is a weak instrument for this, and it is worth
// saying why rather than quietly using a better one: the upper bands are
// overwhelmingly SEEDED, so comparing them before and after mostly measures
// the seeder. This asks the gate directly instead. Every living NPC is priced
// the way `strikeAtTheWall` prices them - fully funded, standing at their wall
// with the price paid - and the refusal is read off `canAttemptBreakthrough`.

line('  WHO THE GATE ACTUALLY STOPS');
line();
line('  Every living NPC, handed the full price for their rung and asked whether');
line('  they may strike. This is the same subject `strikeAtTheWall` builds.');
line();

const reasons = new Map<string, number>();
let atOrAboveTheGate = 0;
for (const seed of SEEDS) {
    let { state } = seedWorld({ seed, catalog });
    state = advanceWorldYears(state, YEARS).state;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        const ordinal = npc.cultivation.realmOrdinal;
        const required = progressRequiredForOrdinal(ordinal);
        if (required === null) continue;
        if (daoRequirementCurve(ordinal) > 0) atOrAboveTheGate++;
        const check = canAttemptBreakthrough({
            realmOrdinal: ordinal,
            cultivationProgress: required,
            spiritRoot: npc.cultivation.spiritRoot,
            attributes: npc.cultivation.attributes,
            injuries: woundsCarriedBy(npc),
            alive: true
        });
        const key = check.eligible ? 'ELIGIBLE' : check.reason;
        reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
}
for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
    line('  ' + reason.padEnd(34) + String(n).padStart(6));
}
line();
line(`  ${atOrAboveTheGate} of them stand at a rung whose curve asks for a road at all.`);
line();

// ── HOW MANY NPCs ACTUALLY CLIMB INTO THE GATED REALMS ───────────────────
//
// The standing histogram cannot answer this, because the upper bands are
// seeded. This tracks each NPC by id from seeding to the end of the run and
// counts the ones who were below the Nascent Soul wall at the start and above
// it at the end. That is the population the gate can actually take away.

line('  HOW MANY CLIMB INTO THE GATED REALMS DURING THE RUN');
line();
let climbed = 0, survivedFromSeeding = 0;
for (const seed of SEEDS) {
    const seeded = seedWorld({ seed, catalog });
    const before = new Map<string, number>();
    for (const npc of seeded.state.npcs) before.set(npc.id, npc.cultivation.realmOrdinal);
    const after = advanceWorldYears(seeded.state, YEARS).state;
    for (const npc of after.npcs) {
        if (npc.status !== 'alive') continue;
        const was = before.get(npc.id);
        if (was === undefined) continue;
        survivedFromSeeding++;
        if (was < 21 && npc.cultivation.realmOrdinal >= 21) climbed++;
    }
}
line(`  ${climbed} of ${survivedFromSeeding} NPCs alive from seeding crossed from below Nascent Soul to at or above it`);
line(`  over ${YEARS} years, across ${SEEDS.length} seeds.`);
line();
