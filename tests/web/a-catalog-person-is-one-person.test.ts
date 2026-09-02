/**
 * One human being, one knowledge claim.
 *
 * The catalogs describe a hundred and eighty-six named people and the world
 * seeder instantiates them, and the two halves were calling them different
 * things. `lore.ts` speaks of them by their CATALOG id - `member-yan-shuling`,
 * `hollow-court-shen-quan` - and `seedNamedFigures` puts them in the world as
 * `npc-` plus that id. `KnowledgeGate` keys existence claims by exact id, so
 * the record the hearsay channel wrote when somebody said her name in a market
 * and the question `company()` asks when she is standing in front of you were
 * about two different people.
 *
 * Measured on a seeded world before the fix: 203 lore people, 428 world NPCs,
 * ZERO ids in common. Standing on the Azure Cloud Pavilion's own ground, having
 * been told 175 catalog names through the ordinary overheard-and-told channel,
 * the player could name NONE of the nine catalog people in the square - every
 * one of whom they held a live knowledge record for.
 *
 * The guarantee this protects is stated on `personName` in
 * `engine/world/history.ts`: the knowledge system is keyed by id and everything
 * the player reads is keyed by NAME, so a name that reaches the player is a
 * name the player has. `personName` protects it from the duplicate-name end.
 * This protects it from the two-ids-for-one-person end.
 *
 * The world is pinned as well as the run, because who is standing where is a
 * property of the WORLD seed.
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { migrate } from '../../src/storage/migrations';
import { MEMBERS } from '../../src/data/cultivation/members';
import { npcsAt } from '../../src/engine/world/world-state';
import {
    catalogPersonBehind,
    theOneIdAPersonIsKnownBy,
    worldIdForCatalogPerson
} from '../../src/engine/world/a-catalog-person-and-their-world-row';
import { KnowledgeGate } from '../../src/web/knowledge';
import { castFor } from '../../src/web/encounters';
import { offerHearing, othersPresent, recordHearing } from '../../src/web/hearsay';
import { makeGameInWorld, makeDb } from './harness';

const WORLD_SEED = 'probe-told-then-met';

describe('the two ids one person is filed under resolve to one claim', () => {
    it('reads back under either id', () => {
        const db = makeDb();
        const gate = new KnowledgeGate(db);
        const person = MEMBERS[0];
        const worldId = worldIdForCatalogPerson(person.id);

        gate.learn({
            holderId: 'holder-1',
            kind: 'cultivator',
            id: person.id,
            name: person.name,
            onDay: 3,
            sourceKind: 'overheard'
        });

        expect(gate.isAwareOf('holder-1', 'cultivator', person.id)).toBe(true);
        expect(
            gate.isAwareOf('holder-1', 'cultivator', worldId),
            'the world row is the same person the market was talking about'
        ).toBe(true);

        // And the other direction: met first, asked after by catalog id.
        gate.learn({
            holderId: 'holder-2',
            kind: 'cultivator',
            id: worldIdForCatalogPerson(MEMBERS[1].id),
            name: MEMBERS[1].name,
            onDay: 3,
            sourceKind: 'witnessed'
        });
        expect(gate.isAwareOf('holder-2', 'cultivator', MEMBERS[1].id)).toBe(true);
    });

    it('carries one ladder rather than two', () => {
        const db = makeDb();
        const gate = new KnowledgeGate(db);
        const person = MEMBERS[0];

        // Overheard through a wall, then met. Before the fix these were two
        // claims and the second could not see the first, so a whisper was
        // never raised by an encounter - it was replaced beside it.
        gate.learn({
            holderId: 'h', kind: 'cultivator', id: person.id, name: person.name,
            onDay: 1, sourceKind: 'overheard', stage: 'whisper'
        });
        expect(gate.stageOf('h', 'cultivator', person.id)).toBe('whisper');

        gate.learnIfNew({
            holderId: 'h', kind: 'cultivator',
            id: worldIdForCatalogPerson(person.id), name: person.name,
            onDay: 40, sourceKind: 'witnessed', stage: 'encountered'
        });

        expect(gate.stageOf('h', 'cultivator', person.id)).toBe('encountered');
        expect(
            gate.provenanceOf('h', 'cultivator', worldIdForCatalogPerson(person.id)).length,
            'both acquisitions are kept - how somebody came to hold it twice is the record'
        ).toBe(2);
    });

    it('leaves every id that is not a catalog person exactly as it is', () => {
        // The strip must be on the CATALOG, never on the `npc-` prefix. A
        // procedural NPC is `npc-95` and an apex is `npc-apex-azure-dew-sect`;
        // prefix-stripping renames the first to `95` and invents a person.
        expect(theOneIdAPersonIsKnownBy('npc-95')).toBe('npc-95');
        expect(theOneIdAPersonIsKnownBy('npc-apex-azure-dew-sect'))
            .toBe('npc-apex-azure-dew-sect');
        expect(theOneIdAPersonIsKnownBy('npc-above-3')).toBe('npc-above-3');
        expect(theOneIdAPersonIsKnownBy('cultivator-abc')).toBe('cultivator-abc');
        expect(catalogPersonBehind('npc-95')).toBeNull();

        // And the Hollow Court, which is the reason a `member-` prefix rule
        // would have been wrong: ten of the catalog's people are filed under
        // `hollow-court-`, and they are the top of the world.
        const court = MEMBERS.filter(m => m.id.startsWith('hollow-court-'));
        expect(court.length).toBeGreaterThan(0);
        for (const seat of court) {
            expect(catalogPersonBehind(worldIdForCatalogPerson(seat.id))).toBe(seat.id);
        }
    });

    it('still resolves a record written under the old world-id key', () => {
        // Back-compat, and the whole reason this is a migration rather than a
        // change of key. A live save holds rows under BOTH forms already:
        // hearsay wrote the catalog id and meeting somebody wrote the world id.
        const db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        migrate(db);

        const person = MEMBERS[0];
        db.prepare(`
            INSERT INTO knowledge_records (
                id, holder_id, holder_kind, claim_key, stance, statement, detail,
                source_kind, source_note, acquired_on_day, confidence, tags, superseded
            ) VALUES (?, ?, 'character', ?, 'knows', ?, '{}', 'witnessed', '', 5, 1, '[]', 0)
        `).run(
            'legacy-row-1', 'old-holder',
            `exists:cultivator:${worldIdForCatalogPerson(person.id)}`,
            `${person.name} exists.`
        );

        migrate(db);

        const gate = new KnowledgeGate(db);
        expect(
            gate.isAwareOf('old-holder', 'cultivator', person.id),
            'a name the player earned before the fix is still a name they have'
        ).toBe(true);
        expect(
            gate.isAwareOf('old-holder', 'cultivator', worldIdForCatalogPerson(person.id))
        ).toBe(true);
    });
});

describe('a name you were told is a name you have when they are standing there', () => {
    it('names the catalog people in the square', async () => {
        const { db, game, repos } = await makeGameInWorld({
            worldSeed: WORLD_SEED,
            seed: 'told-then-met'
        });
        const { cultivator, run } = await game.newRun('Ke Yan');
        const world = (await game.loadWorld())!;

        // A house's own ground, because that is where the catalog's people
        // stand. `seedNamedFigures` places them at their faction's seat.
        const spot = world.locations
            .map(loc => ({ loc, people: npcsAt(world, loc.id) }))
            .filter(s => s.people.some(p => catalogPersonBehind(p.id) !== null))
            .sort((a, b) => b.people.length - a.people.length)[0];
        expect(spot, 'the world has to seat some of the catalog somewhere').toBeTruthy();

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(spot.loc.name, cultivator.id);
        const standing = repos.cultivators.getById(cultivator.id)!;

        const gate = new KnowledgeGate(db);
        const told = new Set<string>();

        // The fixture is written DIRECTLY rather than sourced from the
        // overheard channel, and it has to be.
        //
        // This test is about one thing: a person the player has been told about
        // and who is standing in front of them must be nameable, whichever of
        // their two ids anybody happens to be holding. WHO did the telling is
        // not part of that claim.
        //
        // It used to sweep `offerHearing` six hundred times and require a hit
        // on somebody present. That stopped being possible, correctly: the
        // overheard channel now excludes people who are in the square, because
        // catching a stranger's name through a wall while they stand next to
        // you is a leak rather than an introduction. `told` and `passing` are
        // deliberately not filtered - somebody naming a colleague while
        // speaking TO you is an introduction - but the sweep reached neither
        // reliably, and a fixture that depends on a channel's policy breaks
        // every time that policy is correctly tightened.
        const present = othersPresent(repos, standing, world);
        expect(present.length, 'somebody has to be standing here').toBeGreaterThan(0);

        for (const row of present) {
            gate.learnIfNew({
                holderId: standing.id,
                kind: 'cultivator',
                id: row.id,
                name: row.name,
                onDay: 0,
                sourceKind: 'told',
                sourceNote: 'Named to them by somebody who knew.',
                stage: 'named',
                confidence: 1,
                statement: `${row.name} was named to them.`
            });
            told.add(theOneIdAPersonIsKnownBy(row.id));
        }

        const cast = castFor({ repos, world, knowledge: gate } as never, standing);
        const stranger = cast.filter(person =>
            !person.known && told.has(theOneIdAPersonIsKnownBy(person.id)));

        expect(
            stranger.map(p => p.name),
            'told their name, standing in front of them, and still nobody'
        ).toEqual([]);
    }, 300_000);
});
