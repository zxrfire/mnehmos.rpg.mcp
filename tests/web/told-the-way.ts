/**
 * Being told the way somewhere, as a fixture.
 *
 * The owner, 2026-10-03 and 10-06: a name the player knows from another run may guide an attempt,
 * but it never grants the character the route. A journey to somewhere the character cannot place is
 * refused with "You can ask somebody here for directions". A played test whose subject is what
 * happens AT a place, not how the way there was learned, writes the one row asking would write.
 */
import { KnowledgeGate } from '../../src/web/knowledge';
import type { Harness } from './harness';

/** Tells the current run's character the way to these places (by name or by id). */
export async function toldTheWayTo(harness: Pick<Harness, 'game' | 'db'>, ...places: string[]): Promise<void> {
    const world = harness.game.atHand ?? await harness.game.loadWorld();
    if (!world) return;
    const me = harness.game.currentRun().cultivator;
    const gate = new KnowledgeGate(harness.db);
    for (const wanted of places) {
        const key = wanted.toLowerCase().replace(/^the\s+/, '');
        const rows = world.locations.filter(l => l.id === wanted || l.name.toLowerCase() === key
            || l.name.toLowerCase() === `${key} town` || l.data.gateOf !== undefined
            && world.factions.some(f => f.id === l.data.gateOf && f.name.toLowerCase() === key));
        for (const row of rows) gate.learnIfNew({ holderId: me.id, kind: 'place', id: row.id, name: row.name,
            onDay: 0, sourceKind: 'told', stage: 'placed', sourceNote: 'Somebody gave directions.' });
    }
}
