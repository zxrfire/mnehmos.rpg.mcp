/**
 * The world has to contain people who would notice you were gone.
 *
 * THE MEASUREMENT THIS PINS
 * -------------------------
 * `when-somebody-does-not-come-back.ts` was correct and inert. On a controlled
 * cast of four it gave up 63% of the ties across a forty-year absence; on a real
 * seeded world every run reported `0 of 4 ties expecting a return`. The reason
 * was measured and written down in `scripts/audit-absence.ts`: after 120 years
 * and 498 living people the world held 73 ties in total, six of them at or above
 * the friendship standing, and ZERO of kind spouse, kin, parent, child, master
 * or disciple - which is exactly the set `WAITING_KINDS` reads.
 *
 * The bar was deliberately not lowered to make the number move. These tests
 * guard the supply instead, and the last one guards the thing that would make
 * all of it worthless: the cost of producing it has to stay flat.
 */

import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, isActing, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { FRIENDSHIP_STANDING } from '../../../src/engine/world/gatherings.js';
import {
    applyHouseholds,
    applyServedTogether,
    bindNewbornToHousehold,
    couldParent,
    tieSupply,
    HOUSEHOLD_MIN_AGE,
    SERVICE_CEILING,
    SIBLINGS_PER_HOUSEHOLD
} from '../../../src/engine/world/the-ties-an-ordinary-life-produces.js';
import {
    beginAbsence,
    applyAbsence
} from '../../../src/engine/world/when-somebody-does-not-come-back.js';

const YEAR = 365;

/** Kinds an absence treats as carrying an expectation of return. */
const WAITING_KINDS = ['spouse', 'kin', 'parent', 'child', 'master', 'disciple', 'ally'];

let cached: Promise<WorldState> | null = null;
async function worldAt120(): Promise<WorldState> {
    if (!cached) {
        cached = (async () => {
            const catalog = await loadCultivationCatalog();
            const { state } = seedWorld({ seed: 'absence-audit', catalog });
            return advanceWorldYears(state, 120).state;
        })();
    }
    return cached;
}

describe('the world produces people who matter to each other', () => {
    it('holds households and teaching lines, which it used to hold none of', async () => {
        const state = await worldAt120();
        const supply = tieSupply(state, FRIENDSHIP_STANDING);
        // The four kinds the measurement reported as exactly zero.
        for (const kind of ['spouse', 'kin', 'master', 'disciple']) {
            expect(supply.byKind[kind] ?? 0, `no ${kind} ties in the whole world`)
                .toBeGreaterThan(0);
        }
    }, 180_000);

    it('gives most people a few ties rather than everybody twenty', async () => {
        const state = await worldAt120();
        const supply = tieSupply(state, FRIENDSHIP_STANDING);
        // A few. The old world was at 0.15 live ties per head; a world where
        // everybody has twenty friends is worse than one with six.
        expect(supply.perHead).toBeGreaterThan(1.5);
        expect(supply.perHead, `${supply.perHead} live ties per head is inflation`)
            .toBeLessThan(6);
    }, 180_000);

    it('still leaves somebody with nobody', async () => {
        // Not a failure of supply. Somebody whose household has died and whose
        // house has moved on has nobody, and that state has to remain reachable.
        const state = await worldAt120();
        const supply = tieSupply(state, FRIENDSHIP_STANDING);
        expect(supply.withNobody).toBeGreaterThan(0);
    }, 180_000);

    it('does not let the tie count compound across five centuries', async () => {
        // Inheritance hands a dead person's accounts to their heir, so a world
        // with households in it can run away: measured before `settleNpcDeath`
        // skipped targets the heir already knew, the per-head figure climbed
        // every generation. It has to be FLAT.
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'tie-drift', catalog });
        const early = advanceWorldYears(state, 120).state;
        const perHeadEarly = tieSupply(early, FRIENDSHIP_STANDING).perHead;
        const late = advanceWorldYears(early, 380).state;
        const perHeadLate = tieSupply(late, FRIENDSHIP_STANDING).perHead;
        expect(
            perHeadLate,
            `live ties per head went ${perHeadEarly} -> ${perHeadLate} over 380 years`
        ).toBeLessThan(perHeadEarly * 1.5);
    }, 300_000);
});

describe('an absence now costs the people who knew you', () => {
    it('finds somebody with people expecting them back', async () => {
        const base = await worldAt120();
        const state = advanceWorldYears(base, 0).state;

        // The absentee the audit picks: whoever the most people hold a tie to.
        const counts = new Map<string, number>();
        for (const npc of state.npcs) {
            if (!isActing(npc.status)) continue;
            for (const rel of npc.relationships) {
                counts.set(rel.targetId, (counts.get(rel.targetId) ?? 0) + 1);
            }
        }
        let bestId: string | null = null;
        let best = 0;
        for (const [id, n] of [...counts].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
            const npc = state.npcs.find(x => x.id === id);
            if (!npc || !isActing(npc.status)) continue;
            if (n > best) { best = n; bestId = id; }
        }
        expect(bestId).not.toBeNull();

        const npc = state.npcs.find(n => n.id === bestId)!;
        const told = state.npcs
            .filter(n => n.id !== npc.id && isActing(n.status) && n.locationId === npc.locationId)
            .filter(n => (n.relationships.find(r => r.targetId === npc.id)?.standing ?? 0) > 0)
            .map(n => n.id);

        const opened = beginAbsence(state, {
            absenteeId: npc.id,
            absenteeName: npc.name,
            onDay: state.currentDay,
            locationId: npc.locationId,
            toldIds: told
        });

        // THE NUMBER THAT WAS ZERO.
        const waiting = opened.absence.ties.filter(t => t.waiting);
        expect(waiting.length, 'nobody in this world is expecting anybody back')
            .toBeGreaterThan(0);
        for (const tie of waiting) expect(WAITING_KINDS).toContain(tie.kind);

        // And a long absence actually settles some of them.
        const pass = applyAbsence(state, opened.absence, state.currentDay + 100 * YEAR);
        const settled = pass.consequences.filter(
            c => c.kind === 'stopped_waiting' || c.kind === 'died_waiting'
        );
        expect(settled.length, 'a hundred years cost nobody anything').toBeGreaterThan(0);
    }, 240_000);
});

describe('the passes themselves', () => {
    function bareWorld(): WorldState {
        return createWorld({ seed: 'ties', presentYear: 1000, skipPriorAges: true, regionCount: 1 });
    }

    function person(state: WorldState, id: string, ageYears: number, locationId: string | null) {
        return createNpc(state.seed, {
            id, name: id, bornOnDay: state.currentDay - ageYears * YEAR,
            onDay: state.currentDay, locationId
        });
    }

    it('writes both halves of a household when a child is born', () => {
        const state = bareWorld();
        const day = state.currentDay;
        state.npcs.push(person(state, 'mother', 60, 'loc-region-0'));
        state.npcs.push(person(state, 'elder-child', 30, 'loc-region-0'));

        const first = bindNewbornToHousehold(
            state, person(state, 'elder-child', 30, 'loc-region-0'), 'mother', day);
        state.npcs[1] = first.child;

        const second = bindNewbornToHousehold(
            state, person(state, 'newborn', 18, 'loc-region-0'), 'mother', day);

        // Parent both ways.
        expect(second.child.relationships.find(r => r.targetId === 'mother')?.kind).toBe('parent');
        expect(
            state.npcs.find(n => n.id === 'mother')!.relationships
                .filter(r => r.kind === 'child').map(r => r.targetId).sort()
        ).toEqual(['elder-child', 'newborn']);

        // And the sibling already in the household, both ways.
        expect(second.siblingIds).toEqual(['elder-child']);
        expect(second.child.relationships.find(r => r.targetId === 'elder-child')?.kind).toBe('kin');
        expect(
            state.npcs.find(n => n.id === 'elder-child')!.relationships
                .find(r => r.targetId === 'newborn')?.kind
        ).toBe('kin');

        // Every one of them is a tie an absence would wait on.
        for (const rel of second.child.relationships) {
            expect(rel.standing).toBeGreaterThanOrEqual(FRIENDSHIP_STANDING);
            expect(WAITING_KINDS).toContain(rel.kind);
        }
    });

    it('stops offering a parent who already has a household full of children', () => {
        // An unbounded draw over three centuries makes one long-lived
        // cultivator the parent of forty people.
        const state = bareWorld();
        const day = state.currentDay;
        let mother = person(state, 'mother', 200, 'loc-region-0');
        for (let i = 0; i < SIBLINGS_PER_HOUSEHOLD; i++) {
            mother = upsertRelationship(mother, {
                targetId: `kid-${i}`, targetName: `kid-${i}`, kind: 'child', standing: 0.75
            }, day);
        }
        expect(couldParent([mother], 18, day)).toHaveLength(0);

        const young = person(state, 'young', HOUSEHOLD_MIN_AGE + 10, 'loc-region-0');
        // Old enough for a 20-year-old? No: needs to be 20 + 18 years old.
        expect(couldParent([young], 20, day)).toHaveLength(0);
    });

    it('pairs two unattached adults standing in the same place, and only there', () => {
        const state = bareWorld();
        state.npcs.push(person(state, 'a', 30, 'loc-region-0'));
        state.npcs.push(person(state, 'b', 30, 'loc-region-0'));
        state.npcs.push(person(state, 'far', 30, 'somewhere-else'));

        // The roll is per person per year, so run enough years to be sure.
        let made = 0;
        for (let year = 0; year < 400 && made === 0; year++) {
            made = applyHouseholds(state, year, state.currentDay);
        }
        expect(made).toBe(1);

        const a = state.npcs.find(n => n.id === 'a')!;
        const b = state.npcs.find(n => n.id === 'b')!;
        const far = state.npcs.find(n => n.id === 'far')!;
        expect(a.relationships.find(r => r.kind === 'spouse')?.targetId).toBe('b');
        expect(b.relationships.find(r => r.kind === 'spouse')?.targetId).toBe('a');
        // Nobody married across the province.
        expect(far.relationships).toHaveLength(0);
    });

    it('never marries somebody into their own household', () => {
        const state = bareWorld();
        const day = state.currentDay;
        let parent = person(state, 'parent', 60, 'loc-region-0');
        let child = person(state, 'child', 25, 'loc-region-0');
        parent = upsertRelationship(parent,
            { targetId: 'child', targetName: 'child', kind: 'child', standing: 0.75 }, day);
        child = upsertRelationship(child,
            { targetId: 'parent', targetName: 'parent', kind: 'parent', standing: 0.7 }, day);
        state.npcs.push(parent, child);

        for (let year = 0; year < 500; year++) applyHouseholds(state, year, day);
        for (const npc of state.npcs) {
            expect(npc.relationships.some(r => r.kind === 'spouse')).toBe(false);
        }
    });

    it('lets shared service make colleagues and never family', () => {
        const state = bareWorld();
        const day = state.currentDay;
        state.factions.push({
            id: 'house', name: 'house', kind: 'sect', alignment: 'neutral',
            seatLocationId: 'loc-region-0', ranks: ['outer', 'inner', 'elder'],
            resources: {}, standing: {}, description: '', foundedOnDay: 0,
            dissolvedOnDay: null, tags: [], memberIds: [], holdings: [], history: []
        } as unknown as WorldState['factions'][number]);
        for (const id of ['p', 'q']) {
            const npc = person(state, id, 40, 'loc-region-0');
            state.npcs.push({ ...npc, factionId: 'house', factionRankIndex: 0 });
        }

        for (let year = 0; year < 2000; year++) applyServedTogether(state, year, day);

        const p = state.npcs.find(n => n.id === 'p')!;
        const tie = p.relationships.find(r => r.targetId === 'q');
        expect(tie, 'two people in one hall for two thousand years never met').toBeTruthy();
        // It reaches the friendship line and stops well below the standing at
        // which somebody waits a lifetime.
        expect(tie!.standing).toBeLessThanOrEqual(SERVICE_CEILING + 1e-9);
        expect(['acquaintance', 'ally']).toContain(tie!.kind);
    });
});
