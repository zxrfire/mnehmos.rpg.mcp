/**
 * Discipline, teaching and duelling rooms now serve members regardless of intake;
 * institutional craft rooms are conditional. Adding these rooms in the old list
 * would change later construction draws. A paired Oct10 run compared the former
 * and amended builders on all 40 catalog houses and saved these former draws.
 * A second paired baseline from cbe5a65b also protects the committed cauldron rooms.
 * Every surviving room and formation node must keep its construction. Links may
 * connect newly added rooms; only the former universal craft rooms may disappear.
 */
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { growCompound, type CompoundInput, type RoomPurpose } from '../../../src/engine/world/architecture.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { makeLocation } from '../../../src/engine/world/locations.js';

type KeptHouse = { houseId: string; rooms: { id: string; purpose: RoomPurpose | null; hash: string }[] };

it.each(['architecture-before-halls-20261010.json', 'architecture-before-seven-halls-cbe5a65b.json'])(
    'keeps every surviving room and formation node on its former construction draw (%s)', async fixture => {
    const kept = JSON.parse(readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), 'utf8')) as KeptHouse[];
    const catalog = await loadCultivationCatalog();
    let checked = 0;
    for (const prior of kept) {
        const faction = catalog.factions.find(row => row.id === prior.houseId);
        if (!faction) continue;
        const input: CompoundInput = { ...faction, factionId: faction.id, factionName: faction.name,
            inherited: faction.compoundInherited ?? false,
            formationNodesTotal: faction.formationNodesTotal ?? 0,
            formationNodesLit: faction.formationNodesLit ?? 0,
            preferredRoots: faction.preferredRoots ?? [], teachesElements: faction.teachesElements ?? [],
            specialities: faction.specialities ?? [] };
        const seat = makeLocation({ id: `seat:${faction.id}`, name: faction.name, kind: 'sect_seat', qiDensity: 40 });
        const rooms = growCompound(seat, input, { seed: 'halls-preserve-construction', presentDay: 1000 }).locations;
        const byId = new Map(rooms.map(room => [room.id, room]));
        for (const former of prior.rooms) {
            const room = byId.get(former.id);
            if (!room) {
                expect(fixture, former.id).toBe('architecture-before-halls-20261010.json');
                expect(['alchemy_hall', 'artifact_refining_hall', 'infirmary'], former.id).toContain(former.purpose);
                continue;
            }
            const hash = createHash('sha256').update(JSON.stringify({ ...room, links: [] })).digest('hex');
            expect(hash, `${faction.name}: ${former.purpose ?? 'formation node'}`).toBe(former.hash);
            checked++;
        }
    }
    expect(checked).toBeGreaterThan(0);
});
