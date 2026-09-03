/**
 * The families a world opens holding.
 *
 * Two tiers, which is the rule for anything whose value is a rate.
 *
 * THE UNIT TIER says what one household is: both halves of every tie, siblings
 * off the parent's existing children, the same standings the yearly pass writes,
 * and nothing overwritten that this pass did not put there.
 *
 * THE RATE TIER says the thing happens at all and at a sane rate, POOLED across
 * seeds, and it asserts the DISTRIBUTION rather than the total - because "39% of
 * the world has a blood tie" and "one household with two hundred people in it"
 * are the same number and only one of them is a world.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog, type WorldCatalog } from '../../../src/engine/world/catalog.js';
import { isActing, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import {
    BORN_TO_SOMEBODY_STANDING_HERE,
    seedTheFamiliesStandingInAPlace
} from '../../../src/engine/world/the-families-a-world-opens-holding.js';
import {
    CHILD_STANDING,
    PARENT_STANDING,
    SIBLING_STANDING,
    SIBLINGS_PER_HOUSEHOLD
} from '../../../src/engine/world/the-ties-an-ordinary-life-produces.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const BLOOD = new Set(['kin', 'spouse', 'parent', 'child']);
/** Enough seeds that a rate is a rate. One world is one draw. */
const SEEDS = ['fam-a', 'fam-b', 'fam-c', 'fam-d', 'fam-e', 'fam-f'];

let catalog: WorldCatalog;
async function world(seed: string): Promise<WorldState> {
    catalog ??= await loadCultivationCatalog();
    return seedWorld({ seed, catalog, population: 400 }).state;
}

function livingIn(state: WorldState): NpcRecord[] {
    return state.npcs.filter(npc => isActing(npc.status));
}

/** Households as the tie graph actually holds them, not as the pass counted them. */
function householdsOf(state: WorldState): number[] {
    const living = livingIn(state);
    const at = new Map(state.npcs.map(npc => [npc.id, npc]));
    const seen = new Set<string>();
    const sizes: number[] = [];
    for (const npc of living) {
        if (seen.has(npc.id)) continue;
        if (!npc.relationships.some(r => BLOOD.has(r.kind))) continue;
        const stack = [npc.id];
        let size = 0;
        while (stack.length > 0) {
            const id = stack.pop()!;
            if (seen.has(id)) continue;
            seen.add(id);
            size++;
            for (const tie of at.get(id)?.relationships ?? []) {
                if (BLOOD.has(tie.kind) && !seen.has(tie.targetId)) stack.push(tie.targetId);
            }
        }
        sizes.push(size);
    }
    return sizes;
}

describe('the families a world opens holding', () => {
    // ─────────────────────────────────────────────────────────────────────
    // THE UNIT TIER
    // ─────────────────────────────────────────────────────────────────────

    it('writes both halves of every tie, at the standings the yearly pass uses', async () => {
        const state = await world('fam-a');
        const living = livingIn(state);
        // Everybody, not only the living: `the-wrongs-a-world-opens-holding.ts`
        // kills a handful of these people, and a tie pointing at a grave is
        // deliberately kept - `tieSupply` says so and the whole telling layer
        // depends on it.
        const at = new Map(state.npcs.map(npc => [npc.id, npc]));

        let checked = 0;
        for (const child of living) {
            for (const tie of child.relationships) {
                if (tie.kind !== 'parent') continue;
                checked++;
                expect(tie.standing).toBe(PARENT_STANDING);
                const parent = at.get(tie.targetId)!;
                expect(parent, 'a parent tie points at somebody the world holds').toBeDefined();
                const back = parent.relationships.find(r => r.targetId === child.id)!;
                expect(back, 'and the parent holds their half of it').toBeDefined();
                expect(back.kind).toBe('child');
                expect(back.standing).toBe(CHILD_STANDING);
                // A household is people who live together. `applyHouseholds`'s
                // rule, and the one every consumer that asks who was standing
                // near somebody depends on.
                expect(parent.locationId).toBe(child.locationId);
                // And old enough to be one.
                expect(parent.identity.bornOnDay).toBeLessThan(child.identity.bornOnDay);
            }
        }
        expect(checked, 'the world has households in it at all').toBeGreaterThan(20);
    }, 120000);

    it('binds siblings to each other and caps a household', async () => {
        const state = await world('fam-b');
        const living = livingIn(state);
        const at = new Map(state.npcs.map(npc => [npc.id, npc]));

        let siblingPairs = 0;
        for (const npc of living) {
            const children = npc.relationships.filter(r => r.kind === 'child');
            expect(children.length,
                'nobody ends up the parent of a village').toBeLessThanOrEqual(SIBLINGS_PER_HOUSEHOLD);
            for (const one of children) {
                for (const other of children) {
                    if (one.targetId === other.targetId) continue;
                    const tie = at.get(one.targetId)!.relationships
                        .find(r => r.targetId === other.targetId)!;
                    expect(tie, 'two children of one parent know each other').toBeDefined();
                    expect(tie.kind).toBe('kin');
                    expect(tie.standing).toBe(SIBLING_STANDING);
                    siblingPairs++;
                }
            }
        }
        expect(siblingPairs, 'and some households have more than one child in them')
            .toBeGreaterThan(0);
    }, 120000);

    /**
     * The guard for a defect this pass caused and was measured doing.
     *
     * `bind` upserts on the target id, so binding somebody to the person
     * standing next to them as a child OVERWRITES whatever tie was already
     * there. `seedFactions` writes the only other ties in a fresh world - the
     * five people nearest the top of each house, one of them the rival who was
     * the other candidate for the seat - and before the guard, the world's 34
     * seeded rivals fell to 15 and its 99 allies to 84.
     */
    it('never eats a tie it did not write', async () => {
        const state = await world('fam-c');
        const before = new Map<string, { kind: string; note: string }>();
        for (const npc of state.npcs) {
            for (const tie of npc.relationships) {
                if (tie.note === 'Was the other candidate.' || tie.note === 'Serves under.') {
                    before.set(`${npc.id}->${tie.targetId}`, { kind: tie.kind, note: tie.note });
                }
            }
        }
        expect(before.size, 'the seeder writes these and nothing else does')
            .toBeGreaterThan(50);

        // Run the pass again over the same world. Idempotent, and it must not
        // rewrite anything - which is the same question asked twice over.
        seedTheFamiliesStandingInAPlace(state, state.currentDay);
        for (const npc of state.npcs) {
            for (const tie of npc.relationships) {
                const held = before.get(`${npc.id}->${tie.targetId}`);
                if (held) expect(tie.kind, `${npc.id}->${tie.targetId}`).toBe(held.kind);
            }
        }
        const rivals = state.npcs
            .flatMap(npc => npc.relationships)
            .filter(tie => tie.note === 'Was the other candidate.');
        expect(rivals.length, 'every seeded rivalry survives').toBe(
            [...before.values()].filter(v => v.note === 'Was the other candidate.').length);
    }, 120000);

    it('gives nobody two parents where nobody is married', async () => {
        const state = await world('fam-d');
        for (const npc of livingIn(state)) {
            const parents = npc.relationships.filter(r => r.kind === 'parent');
            // `bindNewbornToHousehold` adds the second parent only off a spouse
            // tie, and `applyHouseholds` - the only writer of one - does not run
            // at creation. Two here would mean this pass had invented a
            // household, which is the thing it is not allowed to do.
            expect(parents.length).toBeLessThanOrEqual(1);
        }
    }, 120000);

    // ─────────────────────────────────────────────────────────────────────
    // THE RATE TIER
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Measured at the point the player would notice: how much of the world a
     * layer that reads blood ties can reach at all.
     *
     * The band is wide on purpose and both edges are real failures. Below it,
     * `whoTheyCarryFor`, the absence pass and the inherited grudge are back to
     * reaching almost nobody. Above it, everybody in the world has a family
     * standing beside them, which is not a world people migrate through - and
     * "nobody would notice I was gone" stops being a state a person can be in.
     *
     * Pooled, because six worlds are six draws and a band asserted on one is a
     * band that goes red when the population shifts by twenty people.
     */
    it('puts between a quarter and a half of the world in a family', async () => {
        let living = 0;
        let inAFamily = 0;
        const perWorld: string[] = [];
        for (const seed of SEEDS) {
            const state = await world(seed);
            const alive = livingIn(state);
            const withBlood = alive.filter(
                npc => npc.relationships.some(r => BLOOD.has(r.kind)));
            living += alive.length;
            inAFamily += withBlood.length;
            perWorld.push(`${seed} ${withBlood.length}/${alive.length}`);
        }
        const share = inAFamily / living;
        expect(share, `pooled over ${SEEDS.length} worlds: ${perWorld.join(', ')}`)
            .toBeGreaterThan(0.25);
        expect(share, `pooled over ${SEEDS.length} worlds: ${perWorld.join(', ')}`)
            .toBeLessThan(0.5);
    }, 300000);

    /**
     * And the distribution, which is the claim the share above cannot make.
     *
     * A household here is a handful of people. Nothing in this pass connects two
     * households, so a component of thirty would mean the eighteen-year bar or
     * the sibling cap had stopped binding and one settlement had become a single
     * family tree.
     */
    it('produces households of a few people, never one enormous one', async () => {
        let households = 0;
        let smallOnes = 0;
        let biggest = 0;
        for (const seed of SEEDS) {
            for (const size of householdsOf(await world(seed))) {
                households++;
                if (size <= 4) smallOnes++;
                if (size > biggest) biggest = size;
            }
        }
        expect(households, 'there are households at all').toBeGreaterThan(300);
        expect(biggest, `biggest household across ${SEEDS.length} worlds`)
            .toBeLessThanOrEqual(SIBLINGS_PER_HOUSEHOLD * 3);
        expect(smallOnes / households, 'and the ordinary one is two or three people')
            .toBeGreaterThan(0.85);
    }, 300000);

    /**
     * The conditional, stated so the constant can be read against something.
     *
     * {@link BORN_TO_SOMEBODY_STANDING_HERE} is the chance for one person who HAS
     * an eligible parent standing beside them, and the realised share is far
     * below it - because most people are not standing anywhere their family is.
     * If those two numbers ever converge, the eligibility has stopped biting and
     * the pass has become a sweep.
     */
    it('realises well under its own conditional, because most people are elsewhere', async () => {
        const state = await world('fam-a');
        const alive = livingIn(state);
        const withParent = alive.filter(
            npc => npc.relationships.some(r => r.kind === 'parent'));
        expect(withParent.length / alive.length).toBeLessThan(BORN_TO_SOMEBODY_STANDING_HERE);
    }, 120000);
});
