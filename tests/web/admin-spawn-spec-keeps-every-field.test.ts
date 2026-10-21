/** The hand-written model schema omitted disposition/alignment. Near words now map visibly,
 * without mistaking someone's disposition toward you for their durable temperament. */
import { describe, expect, it } from 'vitest';
import { readAdminSpawnSpec, adminSpawnJsonSchema, AdminSpawnSpecSchema, needsSpawnReading } from '../../src/web/admin-spawn-spec.js';
import { SpawnEncounterSchema } from '../../src/server/consolidated/admin-manage.js';
import { REALM_TIERS } from '../../src/engine/cultivation/realms.js';
import { ScriptedProvider } from './harness.js';

describe('all spoken spawn facts reach the reader', () => {
    it('supplies a meaning for every allowed enum value, including seal kinds', () => {
        const check = (node: unknown): void => {
            if (!node || typeof node !== 'object') return;
            const schema = node as { enum?: string[]; description?: string };
            for (const value of schema.enum ?? []) expect(schema.description).toContain(value);
            for (const child of Object.values(node)) check(child);
        };
        check(adminSpawnJsonSchema);
    });
    it('reads the description after ordinal=14 (finding 16)', () => {
        expect(needsSpawnReading('spawn_encounter ordinal=14 a cheerful young woman, my sworn sister',
            { ordinal: '14 a cheerful young woman, my sworn sister' })).toBe(true);
        expect(needsSpawnReading('spawn_encounter ordinal=14', { ordinal: 14 })).toBe(false);
        expect(needsSpawnReading('spawn_encounter ordinal=14 disposition=hostile', { ordinal: 14, disposition: 'hostile' })).toBe(true);
    });
    it('gives the reader the realm ladder and the real age default (findings 15, 18)', () => {
        const json = adminSpawnJsonSchema as { properties: Record<string, { description?: string }> };
        for (const tier of REALM_TIERS) expect(json.properties.ordinal.description).toContain(tier.name);
        expect(json.properties.age.description).toContain('20');
        expect(AdminSpawnSpecSchema.safeParse({ house: null }).success).toBe(true);
    });
    it('sends every spawn fact from the same Zod shape', () => {
        const json = adminSpawnJsonSchema as { properties: Record<string, unknown> };
        expect(Object.keys(json.properties).sort()).toEqual(Object.keys(AdminSpawnSpecSchema.shape).sort());
        for (const field of Object.keys(SpawnEncounterSchema.shape).filter(field => !['action', 'worldPerson'].includes(field)))
            expect(json.properties, field).toHaveProperty(field);
    });
    it.each([false, true])('reads the full request with a provider=%s', async withProvider => {
        const ordinal = REALM_TIERS.find(tier => tier.key === 'foundation_establishment')!.ordinalStart;
        const expected = { ordinal, disposition: 'friendly', temperament: 'generous', alignment: 'demonic',
            sex: 'female', seal: { kind: 'slave', holder: 'me' } };
        const provider = new ScriptedProvider({ narrations: [JSON.stringify(expected)] });
        const read = await readAdminSpawnSpec('a nice, generous demonic woman at Foundation, slave sealed to me',
            withProvider ? { provider, model: 'test' } : undefined);
        expect(read).toMatchObject(expected);
        if (withProvider) {
            const prompt = provider.calls[0].messages[0].content;
            expect(prompt).toContain('Generous describes temperament, not disposition');
            expect(prompt).toContain('best-guess');
        }
    });
    it('friendly changes no temperament', async () => {
        const read = await readAdminSpawnSpec('a friendly woman');
        expect(read.disposition).toBe('friendly');
        expect(read.temperament).toBeUndefined();
        expect(read.guesses).toBeUndefined();
    });
    it('an exact disposition wins over a nearby word', async () => {
        expect((await readAdminSpawnSpec('a nice hostile woman')).disposition).toBe('hostile');
        expect((await readAdminSpawnSpec('an evil righteous woman')).alignment).toBe('righteous');
        expect(await readAdminSpawnSpec('a generous woman named Friendly Li')).toMatchObject({ temperament: 'generous', name: 'Friendly Li' });
        expect((await readAdminSpawnSpec('a generous woman named Friendly Li')).disposition).toBeUndefined();
    });
    it('friendly stingy and generous enemy remain distinct', async () => {
        expect(await readAdminSpawnSpec('a friendly stingy elder')).toMatchObject({ disposition: 'friendly', temperament: 'stingy' });
        expect(await readAdminSpawnSpec('a generous enemy')).toMatchObject({ disposition: 'hostile', temperament: 'generous' });
    });
    it.each([['cheerful', 'temperament', 'expressive'], ['kind', 'disposition', 'friendly'],
        ['greedy', 'temperament', 'stingy'], ['haughty', 'temperament', 'proud'], ['quiet', 'temperament', 'reticent']])(
        'records the guess for %s', async (word, field, value) => {
            const read = await readAdminSpawnSpec(`a ${word} person`);
            expect(read).toHaveProperty(field, value);
            expect(read.guesses).toContainEqual({ word, field, value });
        });
    it('keeps no-fit facts and recognises each seal holder', async () => {
        expect((await readAdminSpawnSpec('a red robe and a scar')).unusedWords).toContain('scar');
        expect(await readAdminSpawnSpec('a qi sealed by Li Wei')).toMatchObject({ seal: { kind: 'qi', holder: 'Li Wei' } });
        expect(await readAdminSpawnSpec('an encounter whose qi I have sealed')).toMatchObject({ seal: { kind: 'qi', holder: 'me' } });
    });
    it('reads closeness toward a real named person', async () => {
        expect(await readAdminSpawnSpec('an old companion to Li Wei')).toMatchObject({ disposition: 'close', toward: 'Li Wei' });
        expect(await readAdminSpawnSpec('a sworn brother to me')).toMatchObject({ disposition: 'sworn_sibling', toward: 'me' });
    });
});
