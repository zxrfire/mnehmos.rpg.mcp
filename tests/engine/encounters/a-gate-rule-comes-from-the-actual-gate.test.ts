/**
 * Wiring follower checks exposed Registration at the Gate at an unrelated
 * settlement: it picked Crimson Abyss Fortress from a global faction pool and
 * stated a nine-stone registration and a closed gate. The built Jade Register
 * authority instead charges its actual three-stone annual price at its real
 * capital shopfront and records unpaid entry too. That standing rule is not a
 * randomly drawn gate. Retiring the placeholder must leave native gates intact.
 */
import { expect, it } from 'vitest';
import { ENCOUNTERS } from '../../../src/data/cultivation/encounters';
import { encounterPool } from '../../../src/engine/encounters/select';

it('a random catalog cannot supply a gate or registration authority', () => {
    expect(ENCOUNTERS.some(entry => entry.id === 'enc-held-names-registration')).toBe(false);
    for (const kind of ['settlement', 'wilderness', 'sect', 'ruin']) {
        const pool = encounterPool({ ordinal: 1, activity: 'travel', locatability: 'public',
            place: { id: 'actual-ground', name: 'The reached ground', kind, danger: 0.5,
                controllingFactionId: 'an-ordinary-house' } });
        expect(pool.some(row => row.entry.id === 'enc-held-names-registration')).toBe(false);
    }
});
