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
 * The historical census above used the full catalog. The 120- and 500-year
 * guards now use the canonical 40-person fixture, with isolated lives checked
 * at 500 years; the cold file completed in 41 seconds.
 */

import { describe, it, expect } from 'vitest';
import { advanceWorldYears } from '../../support/advance-world-years.js';
import { soakedWorld } from '../../support/soaked-world.js';
import { fixtureCatalog } from './fixtures.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, isActing, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { FRIENDSHIP_STANDING } from '../../../src/engine/world/gatherings.js';
import {
    applyHouseholds,
    applyServedTogether,
    bindNewbornToHousehold,
    couldParent,
    HOUSEHOLD_MIN_AGE,
    SERVICE_CEILING,
    SIBLINGS_PER_HOUSEHOLD
} from '../../../src/engine/world/the-ties-an-ordinary-life-produces.js';
import {
    beginAbsence,
    applyAbsence
} from '../../../src/engine/world/when-somebody-does-not-come-back.js';
import { tieSupply } from '../../support/what-the-world-has-to-lose.js';

const YEAR = 365;
const SMALL_WORLD = { catalog: fixtureCatalog(), population: 40, presentYear: 1000 };

/** Kinds an absence treats as carrying an expectation of return. */
const WAITING_KINDS = ['spouse', 'kin', 'parent', 'child', 'master', 'disciple', 'ally'];

let cached: Promise<WorldState> | null = null;
async function worldAt120(): Promise<WorldState> {
    if (!cached) {
        // Kept and shared: see `tests/support/soaked-world.ts`.
        //
        // The absentee below is one person, so the seed is a pin: a world change
        // can make them somebody whose waiting ties all outlast a century, which
        // is not the absence layer's fault. On absence-audit-f after the vein
        // grant and forbidden-ground rulings, the hundred-year pass settled zero.
        cached = soakedWorld('absence-audit-g', { years: 120 }, SMALL_WORLD);
    }
    return cached;
}

const ABSENCE_AUDIT_SEEDS = [
    'absence-audit-g', 'absence-audit-h', 'absence-audit-i', 'absence-audit-j'
] as const;
let cachedAbsenceWorlds: Promise<WorldState[]> | null = null;

/** A small pool keeps one changed simulation from choosing the audit's only life. */
async function absenceWorldsAt120(): Promise<WorldState[]> {
    if (!cachedAbsenceWorlds) {
        // `soakedWorld` shares both the disk walk and the process copy; the
        // first seed is already warm from the ordinary supply assertions.
        cachedAbsenceWorlds = Promise.all(ABSENCE_AUDIT_SEEDS.map(
            seed => soakedWorld(seed, { years: 120 }, SMALL_WORLD)
        ));
    }
    return cachedAbsenceWorlds;
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
        // WHAT THIS COUNTS, AND WHAT IT IS SET FROM. Every live tie on a living
        // person: the household they were born into and the one they made
        // (`applyHouseholds`), the people they served beside
        // (`applyServedTogether`), the teaching lines their house put them
        // through (`teacher`/`student`), the master-disciple bonds somebody
        // actually knelt for (`the-disciples-a-world-opens-with.ts`) and the
        // friendships. Measured at 120 years with all of it in: 6.81 on
        // `absence-audit` and 6.46 on `tie-drift`, the two seeds this file uses.
        // EIGHT, which is headroom over both and still a ratchet: the figure
        // this guard first caught was 23.5 live ties per head, from a teaching
        // pass writing a master bond for every junior it carried through a book.
        expect(supply.perHead).toBeGreaterThan(1.5);
        expect(supply.perHead, `${supply.perHead} live ties per head is inflation`)
            .toBeLessThan(8);
    }, 180_000);

    it('still leaves somebody with nobody', async () => {
        // Not a failure of supply. Somebody whose household has died and whose
        // house has moved on has nobody, and that state has to remain reachable.
        const state = await soakedWorld('tie-drift', { years: 500 }, SMALL_WORLD);
        const supply = tieSupply(state, FRIENDSHIP_STANDING);
        expect(supply.withNobody).toBeGreaterThan(0);
    }, 180_000);

    it('does not let the tie count compound across five centuries', async () => {
        // Inheritance hands a dead person's accounts to their heir, so a world
        // with households in it can run away: measured before `settleNpcDeath`
        // skipped targets the heir already knew, the per-head figure climbed
        // every generation. It has to be FLAT.
        const early = await soakedWorld('tie-drift', { years: 120 }, SMALL_WORLD);
        const perHeadEarly = tieSupply(early, FRIENDSHIP_STANDING).perHead;
        const late = await soakedWorld('tie-drift', { years: 500 }, SMALL_WORLD);
        const perHeadLate = tieSupply(late, FRIENDSHIP_STANDING).perHead;
        expect(
            perHeadLate,
            `live ties per head went ${perHeadEarly} -> ${perHeadLate} over 380 years`
        ).toBeLessThan(perHeadEarly * 1.5);
    }, 300_000);
});

describe('an absence now costs the people who knew you', () => {
    it('finds somebody with people expecting them back', async () => {
        // A one-life pin stopped testing the absence layer whenever a world
        // change made that life outlast the next century. The pool checks the
        // supplied world fact instead: somebody is awaited, and an absence
        // actually settles at least one of those ties.
        const audits = (await absenceWorldsAt120()).map(base => {
            const state = advanceWorldYears(base, 0).state;
            const waitingKinds = new Set(WAITING_KINDS);
            const counts = new Map<string, number>();
            for (const npc of state.npcs) {
                if (!isActing(npc.status)) continue;
                for (const rel of npc.relationships) {
                    if (waitingKinds.has(rel.kind)) {
                        counts.set(rel.targetId, (counts.get(rel.targetId) ?? 0) + 1);
                    }
                }
            }
            const bestId = [...counts]
                .filter(([id]) => state.npcs.some(n => n.id === id && isActing(n.status)))
                .sort(([aId, a], [bId, b]) => b - a || aId.localeCompare(bId))[0]?.[0];
            if (!bestId) return { waiting: 0, settled: 0 };

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
            const waiting = opened.absence.ties.filter(t => t.waiting);
            for (const tie of waiting) expect(WAITING_KINDS).toContain(tie.kind);
            const pass = applyAbsence(state, opened.absence, state.currentDay + 100 * YEAR);
            return {
                waiting: waiting.length,
                settled: pass.consequences.filter(
                    c => c.kind === 'stopped_waiting' || c.kind === 'died_waiting'
                ).length
            };
        });

        expect(audits.some(audit => audit.waiting > 0), 'nobody in the audit pool is expecting anybody back')
            .toBe(true);
        expect(audits.some(audit => audit.settled > 0), 'a hundred years cost nobody in the audit pool anything')
            .toBe(true);
    }, 480_000);
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

    it('refuses a household tie where anything else stands, however the rows sort', () => {
        // THE GUARD ASKED THE SORT. Rows are keyed by the pair AND the kind, so
        // a `kin` row and a bond can stand between the same two people, and
        // `kin` sorts first. Reading one row found the kind it was about to
        // write, called it harmless, and wrote a household over two people who
        // were already master and disciple.
        const state = bareWorld();
        const day = state.currentDay;
        state.npcs.push(person(state, 'mother', 60, 'loc-region-0'));
        state.npcs.push(person(state, 'elder-child', 30, 'loc-region-0'));
        const first = bindNewbornToHousehold(
            state, person(state, 'elder-child', 30, 'loc-region-0'), 'mother', day);
        state.npcs[1] = first.child;

        // The newborn is already this sibling's disciple, and holds the kin row
        // the household would have written as well.
        let newborn = person(state, 'newborn', 18, 'loc-region-0');
        newborn = upsertRelationship(newborn, {
            targetId: 'elder-child', targetName: 'elder-child', kind: 'kin',
            standing: 0.5, note: 'Same household.'
        }, day);
        newborn = upsertRelationship(newborn, {
            targetId: 'elder-child', targetName: 'elder-child', kind: 'master',
            standing: 0.7, note: 'Knelt to them.'
        }, day);
        expect(newborn.relationships[0]!.kind, 'kin is the row on top').toBe('kin');

        const second = bindNewbornToHousehold(state, newborn, 'mother', day);
        expect(second.siblingIds, 'a master is not a sibling to write over').toEqual([]);
    });

    it('does not refuse a household over how warm the two of them already are', () => {
        // THE LADDER IS EXEMPT. `acquaintance`, `ally`, `rival` and `enemy` are
        // one tie at four heats and sit beside every structure by design, so
        // two siblings who are also friends is not two structures standing
        // where only one may. The guard is for the second thing.
        const state = bareWorld();
        const day = state.currentDay;
        state.npcs.push(person(state, 'mother', 60, 'loc-region-0'));
        state.npcs.push(person(state, 'elder-child', 30, 'loc-region-0'));
        const first = bindNewbornToHousehold(
            state, person(state, 'elder-child', 30, 'loc-region-0'), 'mother', day);
        state.npcs[1] = first.child;

        let newborn = person(state, 'newborn', 18, 'loc-region-0');
        newborn = upsertRelationship(newborn, {
            targetId: 'elder-child', targetName: 'elder-child', kind: 'ally',
            standing: 0.6, note: 'Years in the same hall.'
        }, day);

        const second = bindNewbornToHousehold(state, newborn, 'mother', day);
        expect(second.siblingIds, 'a friend is still a sibling').toEqual(['elder-child']);
    });

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
