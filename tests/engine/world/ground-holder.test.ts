/**
 * Who holds the ground somebody is standing on.
 *
 * The claim under test is not "the function returns a faction". It is that the
 * four ways the question can be answered stay four different answers - and in
 * particular that **ground nobody holds and ground nothing has recorded are
 * never the same row**. AGENTS.md names that conflation as the defect one size
 * smaller than an uncalled module: an unwritten field reads as a value, and the
 * code around it goes on answering with total confidence.
 *
 * The catalog cases are pinned against real rows rather than fixtures, because
 * the whole point of the prefecture read is that the register already answers
 * this and nothing in `src/` had ever asked it.
 */

import { describe, it, expect } from 'vitest';

import { makeLocation, type LocationRecord } from '../../../src/engine/world/locations';
import { whoHoldsTheGround } from '../../../src/engine/world/ground-holder';

function place(
    id: string,
    name: string,
    init: Partial<LocationRecord> = {}
): LocationRecord {
    return makeLocation({ id, name, kind: 'settlement', ...init });
}

describe('who holds the ground', () => {
    it('reads the holder off the column when the place itself carries one', () => {
        const ground = place('g', 'Azure Cloud Pavilion grounds', {
            kind: 'sect_seat',
            controllingFactionId: 'sect-azure-cloud-pavilion'
        });
        const read = whoHoldsTheGround([ground], 'g');

        expect(read.holding).toBe('held');
        expect(read.holderFactionId).toBe('sect-azure-cloud-pavilion');
        expect(read.alignment).toBe('righteous');
        expect(read.answeredAtId).toBe('g');
    });

    it('walks up to the compound, because a hall belongs to the house that holds it', () => {
        const ground = place('ground', 'Storm Tyrant Court grounds', {
            kind: 'sect_seat',
            controllingFactionId: 'sect-storm-tyrant-court'
        });
        const hall = place('hall', 'the forecourt', { kind: 'hall', parentId: 'ground' });
        const read = whoHoldsTheGround([ground, hall], 'hall');

        expect(read.holding).toBe('held');
        expect(read.alignment).toBe('demonic');
        // The place asked about is still the place asked about; only the answer
        // came from further up.
        expect(read.placeId).toBe('hall');
        expect(read.answeredAtId).toBe('ground');
        expect(read.why).toContain('Storm Tyrant Court');
    });

    it('falls through to the register for a town, which carries no holder of its own', () => {
        // Sweptground: `prefecture-sweptground`, held by the Sweptground Temple.
        const region = place('r', 'The Low Fall', { kind: 'region' });
        const town = place('t', 'Sweptground', { parentId: 'r' });
        const read = whoHoldsTheGround([region, town], 't');

        expect(town.controllingFactionId).toBeNull();
        expect(read.holding).toBe('held');
        expect(read.holderFactionId).toBe('sect-sweptground-temple');
        expect(read.alignment).toBe('righteous');
    });

    it('keeps "the register carries it with nobody\'s name" as its own answer', () => {
        // Scarwater: `prefecture-scarwater`, `heldByFactionId: null`,
        // `discrepancy: 'no_holder_of_record'`. Four of fifteen rows are this.
        const region = place('r', 'The Low Fall', { kind: 'region' });
        const town = place('t', 'Scarwater', { parentId: 'r' });
        const read = whoHoldsTheGround([region, town], 't');

        expect(read.holding).toBe('no_holder_of_record');
        expect(read.holderFactionId).toBeNull();
        expect(read.alignment).toBeNull();
    });

    it('reads a region that declares nobody holds it', () => {
        const region = place('r', 'The Drowned Reach', {
            kind: 'region',
            data: { politics: 'no_authority' }
        });
        const town = place('t', 'Bronze Bell Cape', { parentId: 'r' });
        const read = whoHoldsTheGround([region, town], 't');

        expect(read.holding).toBe('no_authority');
        expect(read.why).toContain('Drowned Reach');
    });

    it('never reports unrecorded ground as unheld', () => {
        const region = place('r', 'Somewhere', { kind: 'region' });
        const town = place('t', 'A Town Nobody Registered', { parentId: 'r' });
        const read = whoHoldsTheGround([region, town], 't');

        expect(read.holding).toBe('unrecorded');
        // The distinction the test exists for.
        expect(read.holding).not.toBe('no_holder_of_record');
        expect(read.holding).not.toBe('no_authority');
    });

    it('answers nothing for a place that is not on the record at all', () => {
        expect(whoHoldsTheGround([], 'nowhere').holding).toBe('unrecorded');
        expect(whoHoldsTheGround([], null).placeId).toBeNull();
    });

    it('survives a cycle in parentId rather than hanging on it', () => {
        const a = place('a', 'A', { parentId: 'b' });
        const b = place('b', 'B', { parentId: 'a' });
        expect(whoHoldsTheGround([a, b], 'a').holding).toBe('unrecorded');
    });
});
