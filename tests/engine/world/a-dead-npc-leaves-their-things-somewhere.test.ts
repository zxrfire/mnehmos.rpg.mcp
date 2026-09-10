/**
 * Two hundred years of deaths left zero loot and zero graves.
 *
 * FOUND BY AUDIT and confirmed by living a world. `settleNpcDeath` moved goals
 * and relationships and TOUCHED NO OBJECT AND NO STONE, so every grave in the
 * repo was hand-authored and nothing a dead NPC was carrying ever went
 * anywhere. The comment in that function already said what should happen -
 * *"an estate that went somewhere is a fact about the world, and it is the one
 * a descendant three centuries later is standing on"* - and then wrote only the
 * fact.
 *
 * `settleEstate` existed, was tested, and had exactly ONE caller: the player's
 * own death, in `src/web/`. Every rule about what happens to a dead
 * cultivator's things had been ruled on and was reachable by one person in the
 * world. That is the asymmetry AGENTS.md calls a defect outright, and this is
 * the cheapest one in the repo to close: `deathHandoffs` already collects every
 * NPC death.
 *
 * THE SECOND HALF IS THE PURSE. `applyFactionEconomy` charged every house
 * `members * 45` a year in upkeep and credited NOBODY, so the payroll of every
 * house in the world simply left it. `NpcRecord.spiritStones` was written once
 * at seeding and never again - while being read, four thousand lines away, as a
 * live gate on whether somebody can be leaned on with money. The gate was
 * asking about a number that had not moved in two centuries.
 *
 * MEASURED OVER A LIVED WORLD, 200 years, seed `estate-a`:
 *
 *     objects        1456 -> 1602      (things entering the world from bodies)
 *     in the ground   931 ->  896      (and things coming back out of it)
 *     purses moved    240 of 606
 *     median             0             (as seeded: most people have nothing)
 *     p90             1845
 *     richest        25612
 *
 * Rates over lived worlds. No seed is pinned to a count.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import type { WorldState } from '../../../src/engine/world/world-state';

/**
 * MISSING IS NOT DEAD, and getting this wrong is how the first cut of this file
 * failed. `status !== 'alive'` looked like the right predicate and is not:
 * `isUnadjudicated` says outright that `missing` and `unknown` are the states
 * *"in which the engine genuinely does not know what happened"*.
 *
 * Measured, it mattered: 74 of the rows this file first flagged as corpses
 * still holding stones were people who *"went into the hills and was not seen
 * again"* or *"went out for Storm Tyrant Court on looking for disciples and did
 * not come back"*. They keep their purse and their sword because they might
 * walk back in, and settling an estate on somebody who is merely overdue would
 * be the world deciding they are dead on their behalf.
 */
const theyAreDead = (npc: { status: string }) => npc.status === 'physically_dead';

const SEEDS = ['estate-a', 'estate-b'];
const YEARS = 200;

interface Lived {
    state: WorldState;
    pursesAtSeeding: Map<string, number>;
    objectsAtSeeding: number;
}

let cached: Lived[] | null = null;

async function worldsLived(): Promise<Lived[]> {
    if (cached) return cached;
    const catalog = await loadCultivationCatalog();
    cached = SEEDS.map(seed => {
        const { state } = seedWorld({ seed, catalog });
        const pursesAtSeeding = new Map(state.npcs.map(n => [n.id, n.spiritStones]));
        const objectsAtSeeding = state.objects.length;
        advanceWorldForPlay(state, { days: YEARS * 365, stopOnInterrupt: false });
        return { state, pursesAtSeeding, objectsAtSeeding };
    });
    return cached;
}

describe('a dead NPC leaves their things somewhere', () => {
    it('has deaths in it at all, which everything below rests on', async () => {
        for (const { state } of await worldsLived()) {
            expect(state.npcs.filter(theyAreDead).length).toBeGreaterThan(0);
        }
    });

    /**
     * THINGS ENTER THE WORLD FROM BODIES. A tracked row that was on somebody
     * when they died is either on whoever went through them or in the ground
     * where they fell, and either way it is a row that did not exist before.
     */
    it('puts things into the world that nobody authored', async () => {
        for (const { state, objectsAtSeeding } of await worldsLived()) {
            expect(state.objects.length).toBeGreaterThan(objectsAtSeeding);
        }
    });

    /**
     * AND WHAT A CORPSE STILL HOLDS IS FINDABLE.
     *
     * The obvious invariant to write here is "nothing is left in a dead hand",
     * and it is WRONG - `legacy.ts` deliberately mints grave goods with the
     * deceased as possessor and the grave as their location, and that is what
     * makes a grave searchable. A thing on a body in the ground is on a body in
     * the ground.
     *
     * The real rule is the one that was actually broken: a row held by somebody
     * dead must be SOMEWHERE. A tracked thing whose holder is a corpse and
     * whose location is null cannot be found by anybody, ever, and
     * `possessions.ts` is explicit that a thing which vanishes cleanly from the
     * record is a thing nobody can be asked about.
     */
    it('leaves nothing in a dead hand that nobody could ever find', async () => {
        for (const { state } of await worldsLived()) {
            const dead = new Set(state.npcs.filter(theyAreDead).map(n => n.id));
            const lost = state.objects.filter(o =>
                o.possessorId !== null && dead.has(o.possessorId) && o.locationId === null);
            expect(lost.map(o => `${o.id} held by the dead and nowhere`)).toEqual([]);
        }
    });

    /**
     * THE PURSE HAS NO SUCH EXCEPTION. What was buried with somebody is
     * recorded on the grave; a corpse ALSO carrying it is the same stones
     * counted twice, once where a player can dig them up and once on a row
     * nothing ever reads again.
     *
     * Measured before this: 74 corpses were still carrying stones two centuries
     * on, from the three death sites that call `markDead` and never reach
     * `settleNpcDeath`.
     */
    it('leaves no stones in a dead purse', async () => {
        for (const { state } of await worldsLived()) {
            const rich = state.npcs.filter(n =>
                theyAreDead(n)
                // Above the Lid is out of scope and deliberately so: nothing
                // crosses it, so an estate up there settles to nobody the world
                // below can ever reach. `killAbove` is the one death site left
                // unsettled, and it is unsettled on purpose.
                && (n.layer ?? 'below') !== 'immortal'
                && n.spiritStones > 0);
            expect(rich.map(n => `${n.name} died holding ${n.spiritStones}`)).toEqual([]);
        }
    });
});

describe('and a purse that moves', () => {
    it('pays the payroll to somebody rather than out of the world', async () => {
        for (const { state, pursesAtSeeding } of await worldsLived()) {
            const moved = state.npcs.filter(n => pursesAtSeeding.has(n.id)
                && n.spiritStones !== pursesAtSeeding.get(n.id));
            expect(moved.length).toBeGreaterThan(0);
        }
    });

    /**
     * AND THE GATE THAT READS IT CAN NOW TELL PEOPLE APART.
     *
     * `LEVERAGE_PURSE` decides whether money is on the table when somebody
     * leans on somebody. Before this it was reading a column written once at
     * seeding, so the answer for any given person was fixed for the life of the
     * world. What is asserted is that the world contains people on BOTH sides
     * of that line - not where any particular person falls.
     */
    it('leaves the world with both rich and poor people in it', async () => {
        for (const { state } of await worldsLived()) {
            const alive = state.npcs.filter(n => n.status === 'alive');
            expect(alive.some(n => n.spiritStones >= 200)).toBe(true);
            expect(alive.some(n => n.spiritStones < 200)).toBe(true);
        }
    });

    /**
     * AND NOBODY BECOMES RICH BY SORT ORDER.
     *
     * A real defect the first cut had, and it only showed up on a lived world.
     * Who goes through a body was decided by sorting the people standing there
     * by id - which is stable, so the SAME person was first at that location
     * every time and went through every body that fell there for two centuries.
     * The richest NPC in a 600-person world came out on 45,934 stones: not a
     * rich cultivator, a serial looter created by a sort order.
     *
     * Reaching the body first is chance now, drawn on a stream keyed to the
     * deceased. What is pinned is the SHAPE - that the top purse is not an
     * order of magnitude clear of the rest of the field - because pinning a
     * number here would pin the seed.
     */
    it('does not hand one person everything that ever fell', async () => {
        for (const { state } of await worldsLived()) {
            const purses = state.npcs
                .filter(n => n.status === 'alive')
                .map(n => n.spiritStones)
                .sort((a, b) => b - a);
            const richest = purses[0] ?? 0;
            const tenth = purses[9] ?? 0;
            expect(richest).toBeGreaterThan(0);
            // The tail is allowed to be long. It is not allowed to be one
            // person with a hundred times what the tenth-richest has.
            expect(richest).toBeLessThan(Math.max(1, tenth) * 100);
        }
    });
});
