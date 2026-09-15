/**
 * The cultivating households a world opens holding.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Four fresh worlds, seeds `census-0..3`, before this pass:
 *
 *     living people                      451 - 453
 *     of them at Foundation or above     126 - 128   (28%)
 *     holding a spouse tie                 0
 *     holding two parents                  0
 *
 * `the-families-a-world-opens-holding.ts` says in its own header why: spouses
 * are `applyHouseholds`'s and that pass only runs as the world is simulated
 * forward. So no world anybody had ever opened contained a marriage, and no
 * child in one had ever had two parents.
 *
 * The design owner: **"seed this"**, and then, narrowing it: *"your parents can
 * be mortal and don't bother. but if they're cultivators, seed this
 * relationship."*
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE ASSERTIONS ENCODE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * TWO CULTIVATORS OR NOBODY. A village of farmers pairing off is below the
 * resolution this engine works at; two cultivators married to each other is a
 * cultivating household, which several passes already care about.
 *
 * ACCUMULATED, NOT PERFORMED AT MIDNIGHT. The marriages in a fresh world are of
 * every length its people could have kept one - measured, a median of 43 to 70
 * years and a longest of 230 to 338.
 *
 * AND NOT EVERYBODY. Measured after: 48 to 60 spouse ties over 126 to 128
 * cultivators, so a little under half of them keep a household and a clear
 * majority do not. Both edges are real failures - nought is where this started,
 * and everybody is a census rather than a place.
 */

import { describe, expect, it } from 'vitest';

import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog, type WorldCatalog } from '../../../src/engine/world/catalog.js';
import { createNpc, markDead, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import {
    bindNewbornToHousehold,
    SPOUSE_STANDING
} from '../../../src/engine/world/the-ties-an-ordinary-life-produces.js';
import {
    everFormedOne,
    NEVER_KEEPS_A_HOUSEHOLD,
    seedTheMarriagesStandingInAPlace
} from '../../../src/engine/world/the-marriages-a-world-opens-holding.js';

const DAYS_PER_YEAR = 365;
const SEEDS = ['wed-a', 'wed-b', 'wed-c', 'wed-d'];

let catalog: WorldCatalog;
async function world(seed: string): Promise<WorldState> {
    catalog ??= await loadCultivationCatalog();
    return seedWorld({ seed, catalog, population: 400 }).state;
}

const spouses = (state: WorldState) =>
    state.npcs.filter(npc => npc.relationships.some(r => r.kind === 'spouse'));

// ─────────────────────────────────────────────────────────────────────────
// A WORLD SMALL ENOUGH TO REASON ABOUT
// ─────────────────────────────────────────────────────────────────────────

/** A place holding people at the ordinals and ages given. */
function town(people: readonly { ordinal: number; age: number; dead?: boolean }[]): WorldState {
    const state = createWorld({ seed: 'wed', skipPriorAges: true, regionCount: 0 });
    state.currentDay = 400 * DAYS_PER_YEAR;
    state.locations.push(makeLocation({
        id: 'home', name: 'Autumn Gate', kind: 'settlement', qiDensity: 0.4
    }));
    people.forEach((one, i) => {
        let npc = createNpc(state.seed, {
            id: `npc-${i}`,
            name: `Person ${i}`,
            bornOnDay: state.currentDay - one.age * DAYS_PER_YEAR,
            onDay: state.currentDay,
            locationId: 'home',
            occupation: 'disciple'
        });
        npc = setRealm(npc, one.ordinal, state.currentDay);
        if (one.dead) npc = markDead(npc, state.currentDay - 20 * DAYS_PER_YEAR, 'Old age.');
        state.npcs.push(npc);
    });
    return state;
}

const tieBetween = (state: WorldState, from: string, to: string) =>
    state.npcs.find(npc => npc.id === from)!.relationships.find(r => r.targetId === to);

describe('the marriages a world opens holding', () => {
    it('binds both halves, at the standing the yearly pass writes', () => {
        const state = town([
            { ordinal: 20, age: 300 }, { ordinal: 18, age: 280 }
        ]);
        const made = seedTheMarriagesStandingInAPlace(state, state.currentDay);
        expect(made.households).toBe(1);

        for (const [from, to] of [['npc-0', 'npc-1'], ['npc-1', 'npc-0']]) {
            const tie = tieBetween(state, from, to);
            expect(tie, `${from} does not hold ${to}`).toBeDefined();
            expect(tie!.kind).toBe('spouse');
            // The standing and the note are the shared rule's, not this pass's -
            // a seeded marriage has to be indistinguishable from a lived one.
            expect(tie!.standing).toBeCloseTo(SPOUSE_STANDING, 5);
            expect(tie!.note).toBe('Their household.');
        }
    });

    /**
     * THE NARROWING, AND THE WHOLE OF IT. A mortal household is not modelled,
     * and a cultivator married to a mortal is not recorded from either side -
     * a tie written from one end only is the half-fact that goes stale.
     */
    it('marries cultivators and nobody else', () => {
        const below = FOUNDATION_ORDINAL - 1;
        const state = town([
            { ordinal: below, age: 90 }, { ordinal: below, age: 80 },
            { ordinal: below, age: 70 }, { ordinal: below, age: 60 }
        ]);
        expect(seedTheMarriagesStandingInAPlace(state, state.currentDay).households).toBe(0);
        expect(spouses(state)).toEqual([]);

        // And one cultivator among mortals marries none of them.
        const mixed = town([
            { ordinal: FOUNDATION_ORDINAL, age: 200 },
            { ordinal: below, age: 90 }, { ordinal: below, age: 80 }
        ]);
        expect(seedTheMarriagesStandingInAPlace(mixed, mixed.currentDay).households).toBe(0);
    });

    /**
     * A WIDOW IS A HOUSEHOLD WITH A HISTORY, and this arranges the one thing a
     * fresh world does not supply.
     *
     * The candidate pool is every cultivator the world holds standing in a
     * place, alive or not, and a marriage to somebody who has since died is
     * dated before they died. Measured on four fresh worlds it never fires: a
     * new world holds three to five dead people and NOT ONE is a cultivator,
     * because the only deaths it contains are the killings
     * `the-wrongs-a-world-opens-holding.ts` writes and those fall on mortals.
     * So this is the path's only producer today, and whether prior ages should
     * leave dead cultivators standing anywhere belongs to whoever owns
     * `seedPriorAges`.
     */
    it('lets a cultivator be married to somebody who has since died', () => {
        const state = town([
            { ordinal: 20, age: 300 }, { ordinal: 18, age: 280, dead: true }
        ]);
        expect(seedTheMarriagesStandingInAPlace(state, state.currentDay).widowed).toBe(1);

        const tie = tieBetween(state, 'npc-0', 'npc-1')!;
        expect(tie.kind).toBe('spouse');
        // Dated before the death, because a marriage that began afterwards did
        // not happen.
        expect(tie.sinceDay).toBeLessThanOrEqual(
            state.npcs.find(npc => npc.id === 'npc-1')!.diedOnDay!);
    });

    /**
     * AND THE CHILD OF ONE IS TOLD. `bindNewbornToHousehold` used to take the
     * second parent only where the spouse was still alive, so a widowed
     * household produced a child with one parent and no record that there had
     * ever been another - the world holding a fact about somebody that they
     * alone could not be told.
     */
    it('gives a widowed household child both parents, one of them dead', () => {
        const state = town([
            { ordinal: 20, age: 300 }, { ordinal: 18, age: 280, dead: true }
        ]);
        seedTheMarriagesStandingInAPlace(state, state.currentDay);

        let child = createNpc(state.seed, {
            id: 'child', name: 'The Child',
            bornOnDay: state.currentDay - 16 * DAYS_PER_YEAR,
            onDay: state.currentDay, locationId: 'home', occupation: 'disciple'
        });
        state.npcs.push(child);
        const household = bindNewbornToHousehold(state, child, 'npc-0', state.currentDay);
        child = household.child;

        expect(household.parentIds).toEqual(['npc-0', 'npc-1']);
        expect(child.relationships.filter(r => r.kind === 'parent')).toHaveLength(2);
    });

    it('is the same world on the same seed', () => {
        const one = town([{ ordinal: 20, age: 300 }, { ordinal: 18, age: 280 }]);
        const two = town([{ ordinal: 20, age: 300 }, { ordinal: 18, age: 280 }]);
        seedTheMarriagesStandingInAPlace(one, one.currentDay);
        seedTheMarriagesStandingInAPlace(two, two.currentDay);
        expect(tieBetween(two, 'npc-0', 'npc-1')!.sinceDay)
            .toBe(tieBetween(one, 'npc-0', 'npc-1')!.sinceDay);
    });

    /**
     * THE RATE IS A STATEMENT, NOT A CURVE. The exposure term saturates at the
     * ages this population has - a median cultivator is 224 and has had two
     * hundred adult years of a three-percent roll - so the term that decides is
     * the share who never keep one.
     */
    it('asks the yearly rate, accumulated, and then the share who never do', () => {
        expect(everFormedOne(0)).toBe(0);
        // Rises with the adult years somebody has had.
        expect(everFormedOne(200)).toBeGreaterThan(everFormedOne(20));
        // And saturates against the share who never keep one, never past it.
        expect(everFormedOne(10_000)).toBeLessThanOrEqual(1 - NEVER_KEEPS_A_HOUSEHOLD);
        expect(everFormedOne(10_000)).toBeCloseTo(1 - NEVER_KEEPS_A_HOUSEHOLD, 3);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE RATE TIER, ON WORLDS THE SEEDER ACTUALLY BUILDS
// ─────────────────────────────────────────────────────────────────────────

describe('what a seeded world holds', () => {
    it('opens holding marriages, and leaves most cultivators keeping none', async () => {
        const said: string[] = [];
        let cultivators = 0;
        let married = 0;

        for (const seed of SEEDS) {
            const state = await world(seed);
            const alive = state.npcs.filter(npc => npc.status === 'alive');
            const cults = alive.filter(npc =>
                npc.cultivation.realmOrdinal >= FOUNDATION_ORDINAL);
            const wed = cults.filter(npc => npc.relationships.some(r => r.kind === 'spouse'));
            cultivators += cults.length;
            married += wed.length;
            said.push(`${seed} ${wed.length}/${cults.length}`);

            // Nobody outside that population was touched.
            for (const npc of state.npcs) {
                if (!npc.relationships.some(r => r.kind === 'spouse')) continue;
                expect(npc.cultivation.realmOrdinal,
                    `${seed}: ${npc.name} is married and is not a cultivator`)
                    .toBeGreaterThanOrEqual(FOUNDATION_ORDINAL);
            }
        }

        const share = married / cultivators;
        // Pooled, because four worlds are four draws. The band is wide and both
        // edges are real failures: nought is where this started, and a world
        // where every cultivator is paired is a census.
        expect(share, `married share ${share.toFixed(2)} - ${said.join(' ')}`)
            .toBeGreaterThan(0.2);
        expect(share, `married share ${share.toFixed(2)} - ${said.join(' ')}`)
            .toBeLessThan(0.7);
    }, 120_000);

    /**
     * A FRESH WORLD IS NOT A NEWLY CREATED ONE. Marriages performed at midnight
     * on day zero would all be nought years old, and a world of them reads as a
     * mass wedding rather than as a place people have been living in.
     */
    it('holds marriages of every length its people could have kept one', async () => {
        const state = await world(SEEDS[0]);
        const lengths = state.npcs
            .flatMap(npc => npc.relationships.filter(r => r.kind === 'spouse'))
            .map(tie => Math.floor((state.currentDay - tie.sinceDay) / DAYS_PER_YEAR));
        expect(lengths.length).toBeGreaterThan(0);

        // Nothing is dated in the future, and the oldest is a long marriage.
        for (const years of lengths) expect(years).toBeGreaterThanOrEqual(0);
        expect(Math.max(...lengths)).toBeGreaterThan(50);
        // And they are not all the same age, which is the whole claim.
        expect(new Set(lengths).size).toBeGreaterThan(5);
    }, 120_000);

    /**
     * THE CASE THAT COULD NOT HAPPEN AT ALL. A child gets a second parent off
     * `bindNewbornToHousehold` reading a spouse tie, so before this pass ran
     * nobody in any world had two parents. That is why the marriages are seeded
     * BEFORE the families in `seedWorld`.
     */
    it('puts somebody in the world with two parents', async () => {
        let withTwo = 0;
        for (const seed of SEEDS) {
            const state = await world(seed);
            withTwo += state.npcs.filter(npc =>
                npc.relationships.filter(r => r.kind === 'parent').length >= 2).length;
        }
        expect(withTwo, 'no child in four worlds has two parents').toBeGreaterThan(0);
    }, 120_000);
});
