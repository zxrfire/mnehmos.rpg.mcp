/**
 * A family is the people you are kin to, and not the people who share your name.
 *
 * `seedLineages` bucketed the world by surname and chained everybody to the
 * nearest earlier namesake eighteen years up, so an elder of one house inherited
 * from a wanderer of another because both were called Lu, and the nine people
 * the catalog authors as ONE family shared their record with twenty-odd
 * strangers who had drawn the name.
 *
 * Measured over three seeded worlds, before and after:
 *
 *     lineage records            43        ->  175-180
 *     people in one              893-928   ->  519-567
 *     biggest family             52-65     ->  11-13
 *     edges joining two people
 *       with no kinship at all   833-875   ->  6-17
 *
 * What is asserted here is the rule rather than those numbers: an edge is
 * kinship the world wrote, a record is one connected family, and the authored
 * line is its own.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog, type WorldCatalog } from '../../../src/engine/world/catalog.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import { isKinship, lineagesFromTheKinTheWorldWrote } from '../../../src/engine/world/a-family-is-the-people-you-are-kin-to.js';
import { aChildTakesTheirParentsLine } from '../../../src/engine/world/a-child-takes-their-parents-line.js';
import { createNpc, upsertRelationship, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createLineageRecord } from '../../../src/engine/world/lineage.js';
import { rosterOf } from '../../../src/engine/world/the-ties-an-ordinary-life-produces.js';
import { THE_LINE_AT_OLD_RIVER } from '../../../src/data/cultivation/a-family-that-came-down-from-a-changed-beast.js';

describe('a seeded world\'s families', () => {
    let state: WorldState;
    beforeAll(async () => {
        const catalog: WorldCatalog = await loadCultivationCatalog();
        state = seedWorld({ seed: 'a-family-is-kinship', catalog }).state;
    }, 120_000);

    it('joins people the world wrote kinship between, and hardly anybody else', () => {
        const byId = new Map(state.npcs.map(n => [n.id, n]));
        const kin = (a: string, b: string) => byId.get(a)?.relationships
            .some(r => r.targetId === b && isKinship(r.kind)) ?? false;
        let edges = 0;
        let strangers = 0;
        for (const lineage of state.lineages) {
            for (const edge of lineage.edges) {
                edges++;
                if (!kin(edge.parentId, edge.childId) && !kin(edge.childId, edge.parentId)) strangers++;
            }
        }
        expect(edges, 'no families were written at all').toBeGreaterThan(100);
        // Not zero: the world drops the mortal dead after the families are
        // built, which leaves an edge whose other end the roster no longer
        // holds. A tenth of a percent of that is the residue; a surname chain
        // was 98 per cent.
        expect(strangers / edges).toBeLessThan(0.1);
    });

    it('keeps a family small enough to be one, rather than every namesake in the province', () => {
        const biggest = Math.max(...state.lineages.map(l => l.memberIds.length));
        expect(state.lineages.length).toBeGreaterThan(100);
        expect(biggest, 'a family the size of a surname').toBeLessThan(30);
    });

    it('holds the authored line as one family, and does not put strangers in it', () => {
        const theirs = state.npcs.filter(n => n.id.startsWith('npc-line-'));
        expect(theirs.length, 'the line was not seeded').toBe(THE_LINE_AT_OLD_RIVER.people.length);
        const lineage = state.lineages.find(l => l.memberIds.includes(theirs[0]!.id));
        expect(lineage, 'the authored line holds no family record').toBeDefined();
        // All of them in the one record: the ladder the catalog reads down from
        // the one who came out of the water is one family.
        for (const person of theirs) {
            expect(lineage!.memberIds, `${person.id} was split off the line`).toContain(person.id);
        }
        // And a namesake who is not kin to them is not in it. Somebody the
        // households pass married or bore into the family IS - that is kinship
        // the world wrote, and is the point.
        const byId = new Map(state.npcs.map(n => [n.id, n]));
        const namesakes = state.npcs.filter(n => !n.id.startsWith('npc-line-')
            && n.name.startsWith(`${THE_LINE_AT_OLD_RIVER.surname} `));
        const strangers = namesakes.filter(n => lineage!.memberIds.includes(n.id)
            && !n.relationships.some(r => isKinship(r.kind) && byId.get(r.targetId) !== undefined
                && lineage!.memberIds.includes(r.targetId)));
        expect(strangers.map(n => n.id), 'namesakes with no kinship are in the line').toEqual([]);
        // And they are kin in the relationship layer too, which is what every
        // other reader of "who are their people" asks.
        expect(theirs.some(n => n.relationships.some(r => isKinship(r.kind)))).toBe(true);
    });
});

describe('a family built from kinship', () => {
    /** Two people who share a surname and nothing else, and a real parent. */
    function aWorldOfNamesakes(): WorldState {
        const state = createWorld({ seed: 'namesakes', skipPriorAges: true, regionCount: 0 });
        const make = (id: string, name: string, age: number): NpcRecord =>
            createNpc('namesakes', { id, name, bornOnDay: state.currentDay - 365 * age, onDay: state.currentDay });
        const stranger = make('npc-stranger', 'Lu Wenxi', 200);
        let parent = make('npc-parent', 'Lu Anjing', 60);
        let child = make('npc-child', 'Lu Shen', 20);
        parent = upsertRelationship(parent, { targetId: child.id, targetName: child.name, kind: 'child', standing: 0.7 }, 0);
        child = upsertRelationship(child, { targetId: parent.id, targetName: parent.name, kind: 'parent', standing: 0.7 }, 0);
        state.npcs.push(stranger, parent, child);
        return state;
    }

    it('leaves the namesake out of it', () => {
        const state = aWorldOfNamesakes();
        const lineages = lineagesFromTheKinTheWorldWrote(state);
        expect(lineages.length).toBe(1);
        expect(lineages[0]!.memberIds.sort()).toEqual(['npc-child', 'npc-parent']);
    });

    it('puts a newborn in their own parent\'s line and not in a namesake\'s', () => {
        const state = aWorldOfNamesakes();
        // A record of the same surname, founded by somebody the parent is not kin to.
        state.lineages.push(createLineageRecord({
            id: 'lin-lu', surname: 'Lu', founderId: 'npc-stranger', foundedOnDay: 0
        }));
        state.lineages.push(...lineagesFromTheKinTheWorldWrote(state));
        const parent = state.npcs.find(n => n.id === 'npc-parent')!;
        const baby = createNpc('namesakes', { id: 'npc-baby', name: 'Nobody Yet', bornOnDay: state.currentDay, onDay: state.currentDay });
        state.npcs.push(baby);

        const born = aChildTakesTheirParentsLine(state, baby, parent, rosterOf(state));
        const theirs = state.lineages.find(l => l.memberIds.includes(born.id))!;
        expect(theirs.memberIds).toContain('npc-parent');
        expect(theirs.memberIds, 'the newborn joined a stranger of the same name')
            .not.toContain('npc-stranger');
    });
});
