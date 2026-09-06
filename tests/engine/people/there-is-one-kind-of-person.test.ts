/**
 * One square, one headcount.
 *
 * Measured in the play loop before this file: a square was counted two
 * different ways a few lines apart. `othersPresent` took the world's people AND
 * the stored cultivators; `groundFor` took the world's people and the asker and
 * no stored cultivators at all. So another played character standing beside you
 * was somebody you could speak to and simultaneously not somebody drawing on
 * the ground - and the crowding read feeds the largest multiplier in the
 * seclusion model.
 *
 * Every assertion is on the count and on the ordering, never on a rate constant.
 */

import { describe, expect, it } from 'vitest';
import {
    ageOf,
    everybodyDrawingHere,
    isAlive,
    personFromARun,
    personFromTheWorld
} from '../../../src/engine/people/there-is-one-kind-of-person';
import type { NpcRecord } from '../../../src/engine/world/npc-state';
import type { Cultivator } from '../../../src/schema/cultivation';

const DAY = 400_000;

function aWorldPerson(over: {
    id: string;
    ordinal: number;
    status?: NpcRecord['status'];
    bornOnDay?: number;
}): NpcRecord {
    return {
        id: over.id,
        name: over.id,
        status: over.status ?? 'alive',
        locationId: 'loc-here',
        identity: { bornOnDay: over.bornOnDay ?? DAY - 365 * 40 },
        cultivation: { realmOrdinal: over.ordinal }
    } as unknown as NpcRecord;
}

function aRunPerson(over: { id: string; ordinal: number; alive?: boolean }) {
    return {
        id: over.id,
        realmOrdinal: over.ordinal,
        alive: over.alive ?? true
    } as Pick<Cultivator, 'id' | 'realmOrdinal' | 'alive'>;
}

describe('everybody drawing on one piece of ground', () => {
    it('counts the world and the run sheets together', () => {
        const drawing = everybodyDrawingHere({
            inTheWorld: [aWorldPerson({ id: 'npc-a', ordinal: 5 })],
            onRunSheets: [aRunPerson({ id: 'me', ordinal: 12 })],
            onDay: DAY
        });
        expect(drawing).toEqual([5, 12]);
    });

    it('includes the asker, because a person standing on ground draws from it', () => {
        const drawing = everybodyDrawingHere({
            inTheWorld: [],
            onRunSheets: [aRunPerson({ id: 'me', ordinal: 12 })],
            onDay: DAY
        });
        expect(drawing).toEqual([12]);
    });

    it('counts a second played character, which the crowding read did not', () => {
        // The whole defect, in one assertion: two run sheets on one square used
        // to read as one head to the ground and two to the crowd.
        const drawing = everybodyDrawingHere({
            inTheWorld: [],
            onRunSheets: [
                aRunPerson({ id: 'me', ordinal: 12 }),
                aRunPerson({ id: 'them', ordinal: 30 })
            ],
            onDay: DAY
        });
        expect(drawing).toHaveLength(2);
        expect(drawing).toEqual([12, 30]);
    });

    it('does not count one person twice for having a row in both stores', () => {
        // The two id namespaces for one human. Counting them separately is how
        // four headcounts of one square produced three answers.
        const drawing = everybodyDrawingHere({
            inTheWorld: [aWorldPerson({ id: 'npc-me', ordinal: 99 })],
            onRunSheets: [aRunPerson({ id: 'me', ordinal: 12 })],
            onDay: DAY
        });
        expect(drawing).toEqual([12]);
    });

    it('and lets the run sheet win where they disagree about the rung', () => {
        // A run sheet is the authority about the person being played. The
        // world's copy of them is a stamp that may be behind.
        const drawing = everybodyDrawingHere({
            inTheWorld: [aWorldPerson({ id: 'npc-me', ordinal: 99 })],
            onRunSheets: [aRunPerson({ id: 'me', ordinal: 12 })],
            onDay: DAY
        });
        expect(drawing).not.toContain(99);
    });

    it('leaves the dead out of it, from either store', () => {
        const drawing = everybodyDrawingHere({
            inTheWorld: [
                aWorldPerson({ id: 'npc-gone', ordinal: 40, status: 'dead' }),
                aWorldPerson({ id: 'npc-here', ordinal: 8 })
            ],
            onRunSheets: [
                aRunPerson({ id: 'buried', ordinal: 50, alive: false }),
                aRunPerson({ id: 'me', ordinal: 12 })
            ],
            onDay: DAY
        });
        expect(drawing).toEqual([8, 12]);
    });

    it('and a soul preserved is not somebody standing in a square', () => {
        const drawing = everybodyDrawingHere({
            inTheWorld: [aWorldPerson({ id: 'npc-x', ordinal: 44, status: 'soul_preserved' })],
            onRunSheets: [aRunPerson({ id: 'me', ordinal: 12 })],
            onDay: DAY
        });
        expect(drawing).toEqual([12]);
    });

    it('gives the same list whatever order it was handed', () => {
        const one = everybodyDrawingHere({
            inTheWorld: [aWorldPerson({ id: 'npc-a', ordinal: 20 }), aWorldPerson({ id: 'npc-b', ordinal: 3 })],
            onRunSheets: [aRunPerson({ id: 'me', ordinal: 12 })],
            onDay: DAY
        });
        const other = everybodyDrawingHere({
            inTheWorld: [aWorldPerson({ id: 'npc-b', ordinal: 3 }), aWorldPerson({ id: 'npc-a', ordinal: 20 })],
            onRunSheets: [aRunPerson({ id: 'me', ordinal: 12 })],
            onDay: DAY
        });
        expect(one).toEqual(other);
    });

    it('is empty ground when nobody is standing on it', () => {
        expect(everybodyDrawingHere({ inTheWorld: [], onRunSheets: [], onDay: DAY })).toEqual([]);
    });
});

describe('one person, read the same way from either store', () => {
    it('derives an age the world never stored', () => {
        const npc = aWorldPerson({ id: 'npc-a', ordinal: 5, bornOnDay: DAY - 365 * 137 });
        expect(ageOf(npc, DAY)).toBe(137);
        expect(personFromTheWorld(npc, DAY).age).toBe(137);
    });

    it('never reports a negative age for somebody not yet born', () => {
        expect(ageOf(aWorldPerson({ id: 'npc-a', ordinal: 5, bornOnDay: DAY + 500 }), DAY)).toBe(0);
    });

    it('answers the same questions about a run sheet', () => {
        const person = personFromARun({
            id: 'me', name: 'Shen Ke', realmOrdinal: 12, age: 40, alive: true, location: 'loc-here'
        } as unknown as Cultivator);
        expect(person.realmOrdinal).toBe(12);
        expect(person.age).toBe(40);
        expect(person.alive).toBe(true);
        expect(person.from).toBe('a_run');
    });

    it('and says which store answered, for a caller that has to know', () => {
        expect(personFromTheWorld(aWorldPerson({ id: 'npc-a', ordinal: 5 }), DAY).from)
            .toBe('the_world');
    });
});

describe('whether somebody is standing', () => {
    it('reads a run sheet off its own boolean', () => {
        expect(isAlive({ alive: true })).toBe(true);
        expect(isAlive({ alive: false })).toBe(false);
    });

    it('and a world row off its status, where a soul preserved is not alive', () => {
        expect(isAlive({ status: 'alive' })).toBe(true);
        expect(isAlive({ status: 'dead' })).toBe(false);
        // Not dead, and not somebody you can talk to. The third state is why
        // this is not `status !== 'dead'`.
        expect(isAlive({ status: 'soul_preserved' })).toBe(false);
    });
});
