/** Manual source-write and ledger-growth audit. Ordinary suites skip it. */
import { it, expect, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../support/advance-world-years.js';
import * as intake from '../../../src/engine/world/a-house-takes-in-one-of-its-own.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

it.skipIf(!process.env.LONG_WORLD_AUDIT)('lists actual fostering writes and retained collection growth', async () => {
    const root = process.env.LONG_WORLD_AUDIT!;
    const growth = [500, 1000].filter(years => existsSync(join(root, `drift-guard@${years * 365}.json`))).map(years => {
        const state = JSON.parse(readFileSync(join(root, `drift-guard@${years * 365}.json`), 'utf8')) as WorldState;
        return { years, collections: Object.fromEntries(Object.entries(state).filter(([, value]) => Array.isArray(value))
            .map(([key, value]) => [key, { rows: (value as unknown[]).length, bytes: Buffer.byteLength(JSON.stringify(value)) }])),
            facts: { rows: state.history.facts.length, bytes: Buffer.byteLength(JSON.stringify(state.history.facts)) },
            memories: { rows: state.memories.records.length, bytes: Buffer.byteLength(JSON.stringify(state.memories.records)) } };
    });
    const writes: unknown[] = [], refused: unknown[] = [];
    const catalog = await loadCultivationCatalog();
    const original = intake.vacanciesForOrdinaryIntake;
    const spy = vi.spyOn(intake, 'vacanciesForOrdinaryIntake').mockImplementation((world, day) => {
        const map = original(world, day);
        return new Proxy(map, { get(target, key) {
            if (key !== 'get') { const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value; }
            return (id: string) => { const value = target.get(id);
                if (!(value! > 0) && new Error().stack?.includes('placeAChildTheirHouseWillNotKeep'))
                    refused.push({ day, houseId: id, vacancies: value, source: 'placeAChildTheirHouseWillNotKeep' });
                return value; };
        } });
    });
    try {
        for (const seed of ['a', 'b', 'c', 'd']) {
            const world = seedWorld({ seed, catalog }).state;
            const observe = () => {
                world.history.facts = new Proxy(world.history.facts, { set(target, key, value) {
                    if (typeof value === 'object' && value?.data?.fostering)
                        writes.push({ seed, day: value.day, write: 'history.facts', value });
                    return Reflect.set(target, key, value);
                } });
                world.npcs = new Proxy(world.npcs, { set(target, key, value) {
                    if (typeof value === 'object' && value?.tags?.includes('fostered') && !target[Number(key)]?.tags?.includes('fostered'))
                        writes.push({ seed, day: world.currentDay, write: 'npcs', value });
                    return Reflect.set(target, key, value);
                } });
            };
            for (let year = 0; year < 50; year++) { observe(); advanceWorldYears(world, 1, { stopOnInterrupt: false }); }
        }
    } finally { spy.mockRestore(); }
    writeFileSync(`.claude/fostering-writes-${process.env.LONG_WORLD_AUDIT_LABEL ?? 'before'}.json`, JSON.stringify({ growth, refused, writes }, null, 2));
    expect(writes.length + refused.length).toBeGreaterThan(0);
}, 900_000);
