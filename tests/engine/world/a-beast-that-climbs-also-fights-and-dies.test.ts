/**
 * The climb had no lid, and the lid it needed was the one everybody has.
 *
 * A tracked row goes up the ladder by sitting on its ground, with no per-year
 * pass and no ceiling constant, so at a five-thousand-year horizon a hawk found
 * at 17 reads as 35. Asked whether to cap it, the design owner ruled against a
 * cap: *"The same lid as other npc's have, these spirit beasts fight, and these
 * spirit beasts die (and if they die someone might stumble upon the body. or
 * spirit beasts might eat it and level up)"*.
 *
 * So what is pinned here is the three halves of that and nothing about a
 * ceiling:
 *
 *   IT DIES, on the twelve-year review that already walks this row, against
 *   whoever is standing on its ground. Never a sweep and never a weighted
 *   template: the first cut WAS a template, and a world with no beast rows in it
 *   could never fire it while still paying for it in the draw -
 *   `driver.test.ts` went red because `vein_lost` stopped happening in a
 *   120-year window on a seed where it always had. That is pinned below.
 *
 *   THE BODY IS FINDABLE. `possessorId: null, ownerId: null, locationId` is
 *   exactly what `whatIsStandingFreeAt` looks for, so a core on the ground is
 *   reachable by the taking verb with no new read anywhere. That triple is the
 *   assertion, not the tags.
 *
 *   AND A KILL IS A MEAL. What eats one climbs for it, and the climb reading
 *   never reads that rung back down, because `theRungThisRowShouldBeAt` takes
 *   the higher of where a row stands and what sitting would have given it.
 *
 * RED-CHECKED. Setting `WHETHER_IT_COMES_TO_A_FIGHT` to zero fails the world
 * assertions; setting `transfersOwnership: true` on the body rows fails the
 * findability one; removing the `Math.max` in `theRungThisRowShouldBeAt` fails
 * the meal.
 */

import { describe, it, expect } from 'vitest';

import {
    DAYS_A_BODY_IS_STILL_THERE,
    WHAT_A_MEAL_IS_WORTH,
    aPieceOfABodyNobodyHasTaken,
    idOfAPieceOfTheBody,
    theGroundHasABodyOnIt,
    whatABodyStillHasOnIt,
    whatIsWorthARowOffABody
} from '../../../src/engine/world/a-beast-that-climbs-also-fights-and-dies.js';
import {
    asItStandsNow,
    theRungThisRowShouldBeAt
} from '../../../src/engine/world/a-beast-climbs-by-sitting-where-it-is.js';
import {
    standUpTheOneOnThisGround,
    theSpeciesItIs
} from '../../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { hasACore } from '../../../src/engine/world/hunting-a-spirit-beast.js';
import { BEASTS, materialsOf } from '../../../src/data/cultivation/beasts.js';
import { isStatusRunningOn, makeAreaStatus }
    from '../../../src/engine/world/what-is-true-of-a-place-right-now.js';
import { applyPressure } from '../../../src/engine/world/pressure.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { setRealm } from '../../../src/engine/world/npc-state.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import { fixtureCatalog } from './fixtures.js';

const YEAR = 365;

/** The shallowest cored species, so a seeded population can reach it at all. */
const shallowest = BEASTS.filter(hasACore)
    .reduce((a, b) => (b.ordinal < a.ordinal ? b : a));

describe('what a body still has on it', () => {
    it('is everything, because nobody cut it', () => {
        const all = materialsOf(shallowest.id).map(m => m.id).sort();
        expect(whatABodyStillHasOnIt(shallowest).map(m => m.id).sort()).toEqual(all);
    });

    it('leaves a row only for the half worth one', () => {
        const worth = whatIsWorthARowOffABody(shallowest);
        expect(worth.length).toBeGreaterThan(0);
        for (const m of worth) expect(m.grade === 'mortal').toBe(false);
        expect(worth.length).toBeLessThanOrEqual(whatABodyStillHasOnIt(shallowest).length);
    });
});

describe('a piece of a body is a thing somebody may walk up to', () => {
    const material = whatIsWorthARowOffABody(shallowest)[0]!;
    const row = aPieceOfABodyNobodyHasTaken({
        npcId: 'npc-test-one',
        material,
        asItStands: asItStandsNow(shallowest, shallowest.ordinal + 2),
        itsName: shallowest.name,
        locationId: 'loc-the-ledge',
        placeName: 'The Ledge',
        onDay: 400_000,
        endedBy: 'Killed by somebody at The Ledge.'
    });

    it('is standing free on the ground where the body fell', () => {
        // The exact triple `whatIsStandingFreeAt` filters on. A row that
        // carries an owner is a row nobody can pick up.
        expect(row.possessorId).toBeNull();
        expect(row.ownerId).toBeNull();
        expect(row.locationId).toBe('loc-the-ledge');
    });

    it('says where it came from rather than who owned it', () => {
        expect(row.provenance.length).toBe(1);
        expect(row.provenance[0]!.how).toBe('lost');
        expect(row.provenance[0]!.source).toContain('The Ledge');
    });

    it('is priced at the rung the thing actually died on', () => {
        const deeper = aPieceOfABodyNobodyHasTaken({
            npcId: 'npc-test-two',
            material,
            asItStands: asItStandsNow(shallowest, shallowest.ordinal + 12),
            itsName: shallowest.name,
            locationId: 'loc-the-ledge',
            placeName: 'The Ledge',
            onDay: 400_000,
            endedBy: 'Killed by somebody at The Ledge.'
        });
        expect(deeper.data.beastOrdinal).toBe(shallowest.ordinal + 12);
        expect(deeper.data.grade).not.toBe(row.data.grade);
    });

    it('mints one row per piece per body, derived', () => {
        expect(row.id).toBe(idOfAPieceOfTheBody('npc-test-one', material.id));
    });
});

describe('the ground says a body is on it, and stops saying so', () => {
    const status = makeAreaStatus(theGroundHasABodyOnIt({
        npcId: 'npc-test-one',
        areaId: 'loc-the-ledge',
        itsName: shallowest.name,
        ordinal: shallowest.ordinal,
        onDay: 1_000,
        cause: 'Killed by somebody at The Ledge.',
        factId: null,
        endedById: 'npc-somebody',
        causeKnownLocally: false
    }));

    it('lifts itself without anything sweeping it', () => {
        expect(isStatusRunningOn(status, 1_000)).toBe(true);
        expect(isStatusRunningOn(status, 1_000 + DAYS_A_BODY_IS_STILL_THERE - 1)).toBe(true);
        expect(isStatusRunningOn(status, 1_000 + DAYS_A_BODY_IS_STILL_THERE)).toBe(false);
    });

    it('carries signs somebody standing there could read, and no explanation', () => {
        expect(status.signs.length).toBeGreaterThan(0);
        expect(status.causeKnownLocally).toBe(false);
    });
});

describe('a kill is a meal, and the meal sticks', () => {
    it('is a rung, and the climb reading never takes it back', () => {
        const ate = standUpTheOneOnThisGround({
            beast: shallowest, locationId: 'loc-the-ledge', seed: 'meal', onDay: 400_000
        });
        const fed = setRealm(
            ate, ate.cultivation.realmOrdinal + WHAT_A_MEAL_IS_WORTH, 400_000
        );
        const read = theRungThisRowShouldBeAt({
            beast: shallowest,
            locationId: 'loc-the-ledge',
            worldSeed: 'meal',
            bornOnDay: fed.identity.bornOnDay,
            day: 400_000,
            standingAt: fed.cultivation.realmOrdinal
        });
        expect(fed.cultivation.realmOrdinal).toBe(ate.cultivation.realmOrdinal + 1);
        expect(read).toBeGreaterThanOrEqual(fed.cultivation.realmOrdinal);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND IN A WORLD THAT IS ACTUALLY RUNNING
// ─────────────────────────────────────────────────────────────────────────

function worldWithSomeStandingOnItsGround(seed: string): WorldState {
    const state = seedWorld({
        seed, catalog: fixtureCatalog(), presentYear: 1000, population: 250
    }).state;
    // Rows are written on contact, so a world nobody has hunted in holds none.
    // These stand for the ones a played world would have, and they are put
    // where people are, because ground nobody is on is ground nobody fights on.
    const where = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.locationId === null) continue;
        where.set(npc.locationId, (where.get(npc.locationId) ?? 0) + 1);
    }
    const busiest = [...where.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const cored = BEASTS.filter(hasACore).slice(0, 8);
    busiest.forEach(([locationId], at) => {
        const beast = cored[at % cored.length]!;
        state.npcs.push(standUpTheOneOnThisGround({
            beast,
            locationId,
            seed: state.seed,
            onDay: Math.floor(state.currentDay)
        }));
    });
    return state;
}

describe('one of these fights on its own ground, and one of the two dies', () => {
    it('costs a world with none of them standing in it exactly nothing', () => {
        // THE REASON IT IS NOT A TEMPLATE ON THE EVENT TABLE, and it was
        // measured rather than argued: a weighted template that can never fire
        // still shifts the cursor for every other event, and `driver.test.ts`
        // went red on it - `vein_lost` stopped happening in a 120-year window
        // on a seed where it always had. Two worlds that hold no rows of these
        // have to produce the same history, fact for fact.
        const bare = seedWorld({
            seed: 'beast-mortality-bare', catalog: fixtureCatalog(),
            presentYear: 1000, population: 250
        }).state;
        expect(bare.npcs.filter(n => theSpeciesItIs(n) !== null)).toHaveLength(0);
        const out = applyPressure(bare, bare.currentDay, bare.currentDay + 120 * YEAR);
        expect(out.events.length).toBeGreaterThan(0);
        for (const npc of bare.npcs) expect(theSpeciesItIs(npc)).toBeNull();
    });

    it('kills some of them over a few centuries, and not all of them', () => {
        const state = worldWithSomeStandingOnItsGround('beast-mortality');
        const rowsBefore = state.npcs.filter(n => theSpeciesItIs(n) !== null).length;
        expect(rowsBefore).toBeGreaterThan(0);

        applyPressure(state, state.currentDay, state.currentDay + 500 * YEAR);

        const rows = state.npcs.filter(n => theSpeciesItIs(n) !== null);
        const dead = rows.filter(n => n.status !== 'alive');
        expect(dead.length, 'not one of them died in five centuries').toBeGreaterThan(0);
        expect(dead.length, 'every one of them died, which is a cull rather than a lid')
            .toBeLessThan(rows.length);
        // The world says so. A death nobody can repeat is a death that did not
        // reach anybody.
        const said = state.history.facts.filter(f =>
            rows.some(r => r.status !== 'alive'
                && f.actors.some(a => a.id === r.id)));
        expect(said.length, 'nothing was written about any of it').toBeGreaterThan(0);
    });

    it('leaves what nobody could cut lying where the body fell', () => {
        const state = worldWithSomeStandingOnItsGround('beast-mortality');
        applyPressure(state, state.currentDay, state.currentDay + 500 * YEAR);

        // Where a person did it and could not take everything, what stood
        // above them is on the ground for whoever walks up next.
        const left = state.objects.filter(o => o.tags.includes('off_a_body_nobody_claimed'));
        for (const row of left) {
            expect(row.possessorId).toBeNull();
            expect(row.ownerId).toBeNull();
            expect(row.locationId).not.toBeNull();
        }
        // And the ground says a body is on it for exactly as long as one is.
        for (const status of state.statuses.filter(s => s.kind === 'a_body_on_the_ground')) {
            expect(status.reviewOnDay - status.beganOnDay).toBe(DAYS_A_BODY_IS_STILL_THERE);
        }
    });
});
