/**
 * Does the world actually run manoeuvres on people, and does anybody ever work
 * one out?
 *
 * The claim this probe exists to check is the one AGENTS.md says is broken
 * most often: a system built for the simulation that never reaches the played
 * game, or the reverse. `leverage_applied` and `leverage_understood` are in
 * TEMPLATES, but a template that returns null every firing is not a system -
 * it is a weight in a table.
 *
 * Run:  npx tsx scripts/probe-does-anybody-actually-work-on-anybody.ts
 */

import { fixtureCatalog } from '../tests/engine/world/fixtures.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import { applyPressure } from '../src/engine/world/pressure.js';

const YEAR = 365;
const CENTURIES = 5;

for (const seed of ['probe-a', 'probe-b', 'probe-c']) {
    const { state } = seedWorld({
        seed, catalog: fixtureCatalog(), presentYear: 1000, population: 250
    });
    const out = applyPressure(state, state.currentDay, state.currentDay + CENTURIES * 100 * YEAR);

    const counts = new Map<string, number>();
    for (const event of out.events) {
        counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
    }

    const applied = counts.get('leverage_applied') ?? 0;
    const understood = counts.get('leverage_understood') ?? 0;
    const killings = counts.get('killing') ?? 0;

    // How many ties are sitting in the state with the instrumental shape:
    // one side attached, the other never having returned it. Split by each
    // gate the discovery template applies, so a zero says WHICH gate closed.
    let oneWay = 0;
    let tagged = 0;
    let taggedAndStrong = 0;
    let discoverable = 0;
    let strongest = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        for (const tie of npc.relationships) {
            const isTagged = tie.factIds.some(id =>
                state.history.facts.find(f => f.id === id)?.data?.pressure === 'leverage_applied');
            if (isTagged) {
                tagged++;
                strongest = Math.max(strongest, tie.standing);
                if (tie.standing >= 0.45) taggedAndStrong++;
            }
            if (tie.standing < 0.45) continue;
            const other = state.npcs.find(n => n.id === tie.targetId);
            if (!other) continue;
            const back = other.relationships.find(r => r.targetId === npc.id);
            if (!back || back.standing < 0.3) {
                oneWay++;
                if (isTagged && other.status === 'alive') discoverable++;
            }
        }
    }
    console.log(
        `    gates: tagged ties ${tagged}, of those >=0.45 ${taggedAndStrong}, ` +
        `fully discoverable ${discoverable}, strongest tagged tie ${strongest.toFixed(2)}`
    );

    console.log(
        `${seed}  over ${CENTURIES} centuries:  ` +
        `applied ${applied} (${(applied / CENTURIES).toFixed(1)}/century)  ` +
        `understood ${understood}  ` +
        `killings ${killings}  ` +
        `one-way ties standing ${oneWay}`
    );

    const sample = out.events.find(e => e.kind === 'leverage_understood')
        ?? out.events.find(e => e.kind === 'leverage_applied');
    if (sample) console.log(`    e.g. ${sample.fact.summary}`);
}
