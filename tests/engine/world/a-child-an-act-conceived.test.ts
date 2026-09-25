/**
 * A conception an act caused is carried to term and counted by the world's own
 * demography, with both parents on the record.
 *
 * The furnace rite rolled `conceived` and nothing took the roll: nothing in the
 * world made a child from outside the demography draw. `aChildIsConceived` is
 * the one entry point, and these drive the world tick past the due day and the
 * day the child is counted, and go looking for the person.
 */

import { describe, expect, it } from 'vitest';

import {
    DAYS_A_CHILD_IS_CARRIED,
    THE_AGE_A_CHILD_IS_COUNTED_AT,
    aChildIsConceived
} from '../../../src/engine/world/a-child-an-act-conceived.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { parentsOf } from '../../../src/engine/world/lineage.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc, markDead, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

/** A bare world with two adults standing in one of its settlements. */
function twoPeopleInAWorld(seed: string) {
    const world = createWorld({ seed, skipPriorAges: true, regionCount: 0, presentYear: 0 });
    world.locations.push(makeLocation({ id: 'loc-province', name: 'The Province', kind: 'region', qiDensity: 0.4 }));
    const place = makeLocation({
        id: 'town-here', name: 'The Town', kind: 'settlement', parentId: 'loc-province', qiDensity: 0.4
    });
    world.locations.push(place);
    const today = Math.floor(world.currentDay);
    const adult = (id: string, name: string, sex: 'male' | 'female'): NpcRecord => createNpc(world.seed, {
        id, name, sex,
        bornOnDay: today - 30 * YEAR,
        onDay: today,
        locationId: place.id,
        occupation: 'unknown'
    });
    const carrier = adult('npc-carrier', 'Wen Lihua', 'female');
    const other = adult('npc-other', 'Gao Shen', 'male');
    world.npcs.push(carrier, other);
    return { world, place, today, carrier, other };
}

function childrenOf(world: WorldState, parentId: string): NpcRecord[] {
    const ids = new Set(world.lineages.flatMap(line =>
        line.edges.filter(e => e.parentId === parentId && e.relation === 'descendant')
            .map(e => e.childId)));
    return world.npcs.filter(n => ids.has(n.id));
}

function bloodParentsOf(world: WorldState, childId: string): string[] {
    return world.lineages
        .flatMap(line => parentsOf(line, childId))
        .filter(e => e.relation === 'descendant')
        .map(e => e.parentId)
        .sort();
}

describe('a child an act conceived', () => {
    it('is born on the due day and counted at sixteen, with both parents recorded', () => {
        const { world, place, today, carrier, other } = twoPeopleInAWorld('conceived-and-counted');
        const due = today + DAYS_A_CHILD_IS_CARRIED;
        expect(aChildIsConceived(world, {
            carrierId: carrier.id, otherParentId: other.id, dueOnDay: due
        })).toBe(true);

        // Past the due day: the birth is on the record and nobody is counted yet.
        advanceWorldForPlay(world, { days: 2 * YEAR });
        const birth = world.history.facts.find(f =>
            f.kind === 'birth' && f.actors.some(a => a.id === carrier.id));
        expect(birth, 'no birth on the record').toBeDefined();
        expect(birth!.day).toBe(due);
        expect(birth!.actors.map(a => a.id).sort()).toEqual([carrier.id, other.id].sort());
        expect(childrenOf(world, carrier.id)).toHaveLength(0);

        // Past the day they are counted: a person, born on the due day.
        advanceWorldForPlay(world, { days: (THE_AGE_A_CHILD_IS_COUNTED_AT + 1) * YEAR });
        const [child, ...more] = childrenOf(world, carrier.id);
        expect(child, 'no child in the world').toBeDefined();
        expect(more).toHaveLength(0);
        expect(child!.identity.bornOnDay).toBe(due);
        expect(bloodParentsOf(world, child!.id)).toEqual([carrier.id, other.id].sort());
        expect(child!.locationId).toBe(place.id);
        // Raised by the one who carried them, through the ordinary household.
        expect(child!.relationships.some(r => r.targetId === carrier.id && r.kind === 'parent'))
            .toBe(true);
        // And delivered once.
        advanceWorldForPlay(world, { days: 2 * YEAR });
        expect(childrenOf(world, carrier.id)).toHaveLength(1);
    });

    it('is not born to somebody who died before the due day', () => {
        const { world, today, carrier, other } = twoPeopleInAWorld('carrier-died-first');
        aChildIsConceived(world, {
            carrierId: carrier.id, otherParentId: other.id, dueOnDay: today + DAYS_A_CHILD_IS_CARRIED
        });
        const at = world.npcs.findIndex(n => n.id === carrier.id);
        world.npcs[at] = markDead(world.npcs[at]!, today + 30, 'Died.');

        advanceWorldForPlay(world, { days: (THE_AGE_A_CHILD_IS_COUNTED_AT + 2) * YEAR });
        expect(world.history.facts.some(f =>
            f.kind === 'birth' && f.actors.some(a => a.id === other.id))).toBe(false);
        expect(childrenOf(world, other.id)).toHaveLength(0);
    });

    it('still comes of age when the one who carried them died after the birth', () => {
        const { world, today, carrier, other } = twoPeopleInAWorld('carrier-died-after');
        const due = today + DAYS_A_CHILD_IS_CARRIED;
        aChildIsConceived(world, { carrierId: carrier.id, otherParentId: other.id, dueOnDay: due });
        advanceWorldForPlay(world, { days: 2 * YEAR });
        const at = world.npcs.findIndex(n => n.id === carrier.id);
        world.npcs[at] = markDead(world.npcs[at]!, Math.floor(world.currentDay), 'Died.');

        advanceWorldForPlay(world, { days: (THE_AGE_A_CHILD_IS_COUNTED_AT + 1) * YEAR });
        const [child] = childrenOf(world, other.id);
        expect(child, 'the child was lost with the carrier').toBeDefined();
        expect(child!.identity.bornOnDay).toBe(due);
    });

    it('has nowhere to come from when the world holds neither parent', () => {
        const { world, today } = twoPeopleInAWorld('nobody-held');
        expect(aChildIsConceived(world, {
            carrierId: 'nobody-a', otherParentId: 'nobody-b', dueOnDay: today + DAYS_A_CHILD_IS_CARRIED
        })).toBe(false);
    });
});
