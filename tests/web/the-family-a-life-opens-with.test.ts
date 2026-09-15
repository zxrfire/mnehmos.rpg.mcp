/**
 * A sixteen-year-old has a family, and the player was the one person who did not.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Across 80 lives on 20 pinned worlds, a player held ZERO rows in any tie
 * store. `bindNewbornToHousehold`, `applyTeachingLines` and `applyPassedOver`
 * write kin, master and rival ties for world people, and the player is not one
 * of them - so the only person a run opened knowing was a neighbour, and the
 * engine's own answer to "who is this person to anybody" was nobody.
 *
 * The design owner ruled on the three kinds separately:
 *
 *   > "the player needs to find a master, that doesn't change. but kin yes.
 *   > rival no. how can you have a rival as a mortal? you don't"
 *
 * So these tests pin KIN and pin the ABSENCE of the other two. A master is the
 * road the game is about and a rival is earned by being worth being rivals
 * with; neither is a gap to be closed later.
 *
 * Measured after, over 40 pinned worlds: 2 lives with no family at all, 19 with
 * one, 16 with two, 3 with three. All 60 kin alive, all standing somewhere the
 * move verb takes, all 60 ties still there after the world is dropped and read
 * back from SQLite. One life in 40 had a sibling who had died before it opened,
 * and `bindNewbornToHousehold` drops those on `isHere` - so the opening reads as
 * though he never existed. That is a gap written down, not an argued decision.
 *
 * AND SEEDING CULTIVATING MARRIAGES MOVED NONE OF IT. Only cultivators marry, and
 * nine births in ten are a thin county farm whose parents are mortals - so over 30
 * ordinary lives the distribution above did not change by one life. What it opened
 * is the case at the other end: a birth into a cultivating family can now draw a
 * married pair, which is the first time anybody in this engine has had two parents.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE ASSERTIONS ENCODE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * That the household comes from `bindNewbornToHousehold` and not from a second
 * notion of family, that the other half of every tie lands on the kin's own
 * world rows, and that an empty answer stays a legitimate one - a birthplace
 * with nobody old enough to have raised anybody is an orphan, and nobody is
 * invented to fill it.
 */

import { describe, it, expect } from 'vitest';

import { theFamilyThisLifeOpensWith } from '../../src/web/the-family-a-life-opens-with';
import { createWorld, type WorldState } from '../../src/engine/world/world-state';
import { createNpc, setRealm, upsertRelationship } from '../../src/engine/world/npc-state';
import { makeLocation } from '../../src/engine/world/locations';
import type { Cultivator } from '../../src/schema/cultivation';

const DAYS_PER_YEAR = 365;

/** A hamlet whose people are the ages given, in years, on the day it opens. */
function hamlet(ages: readonly number[], ordinals: readonly number[] = []): WorldState {
    const state = createWorld({ seed: 'family', skipPriorAges: true, regionCount: 0 });
    state.currentDay = 100 * DAYS_PER_YEAR;
    state.locations.push(makeLocation({
        id: 'home', name: 'Autumn Gate', kind: 'settlement', qiDensity: 0.4
    }));
    ages.forEach((age, i) => {
        let npc = createNpc(state.seed, {
            id: `npc-${i}`,
            name: `Villager ${i}`,
            bornOnDay: state.currentDay - age * DAYS_PER_YEAR,
            onDay: state.currentDay,
            locationId: 'home',
            occupation: 'disciple'
        });
        npc = setRealm(npc, ordinals[i] ?? 0, state.currentDay);
        state.npcs.push(npc);
    });
    return state;
}

const player = {
    id: 'pc', name: 'Probe', location: 'Autumn Gate', realmOrdinal: 0, age: 16
} as Cultivator;

const here = (world: WorldState) => world.npcs.filter(npc => npc.locationId === 'home');

describe('the family a life opens with', () => {
    it('binds a parent out of the people standing where the birth happened', () => {
        // At Foundation Establishment, so the household is bound rather than
        // mentioned - a mortal one writes nothing, deliberately.
        const world = hamlet([40, 16, 20], [20, 0, 0]);
        const kin = theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's', bornToCultivators: false
        });

        // Only the one old enough to have raised a sixteen-year-old. The bar is
        // `couldParent`'s and is not restated here.
        expect(kin.map(one => one.npc.name)).toEqual(['Villager 0']);
        expect(kin[0].kind).toBe('parent');
    });

    /**
     * THE OTHER HALF LANDS ON THE WORLD, which is the whole of why this routes
     * `bindNewbornToHousehold` rather than writing its own rows. The parent now
     * holds a child, and everything that reads a person's family reads it.
     */
    it('leaves the parent holding a child', () => {
        const world = hamlet([40], [20]);
        theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's', bornToCultivators: false
        });
        const parent = world.npcs.find(npc => npc.id === 'npc-0')!;
        const tie = parent.relationships.find(one => one.targetId === player.id);
        expect(tie, 'the parent does not know they have a child').toBeDefined();
        expect(tie!.kind).toBe('child');
    });

    it('gives the household its other children as siblings', () => {
        const world = hamlet([40, 22], [20, 18]);
        // The world already put one child in this household, which is what
        // makes the second one a sibling rather than a stranger.
        const at = world.npcs.findIndex(npc => npc.id === 'npc-0');
        world.npcs[at] = upsertRelationship(world.npcs[at], {
            targetId: 'npc-1', targetName: 'Villager 1', kind: 'child', standing: 0.75
        }, world.currentDay);

        const kin = theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's', bornToCultivators: false
        });
        expect(kin.map(one => one.kind)).toEqual(['parent', 'kin']);
        expect(kin.map(one => one.npc.id)).toEqual(['npc-0', 'npc-1']);
    });

    /**
     * AND NOBODY IS INVENTED TO FILL IT. A hamlet of children and
     * sixteen-year-olds has nobody who could have raised anybody, and the
     * honest answer is that this life has no family standing here.
     */
    it('is empty rather than invented when nobody could have raised them', () => {
        const world = hamlet([16, 18, 20]);
        expect(theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's', bornToCultivators: false
        })).toEqual([]);
    });

    /**
     * BOTH HALVES, WHENEVER THE WORLD HOLDS A ROW TO WRITE THE SECOND ONE ON.
     *
     * In `newRun` it does not: `seedTheFacesFromHome` runs before
     * `refreshThePlayerRow`, so today only the kin's half lands and the
     * player's own row carries nothing. That matters for exactly one reader -
     * `whoTheyCarryFor` decides whose killing somebody may open an account for
     * by reading the HEARER's own rows, so until the row carries the tie a
     * player whose parent is killed does not carry for them. (`rescuersFor`
     * reads the other direction and already works: a parent holding a child at
     * 0.75 clears the `kin` precondition and would come.)
     *
     * This pins the half that is ready, so moving that one call up is all the
     * change it takes.
     */
    it('writes the player their own half once the world holds a row for them', () => {
        // A cultivating household, because a mortal one writes no half at all.
        const world = hamlet([40], [20]);
        world.npcs.push(createNpc(world.seed, {
            id: player.id,
            name: player.name,
            bornOnDay: world.currentDay - 16 * DAYS_PER_YEAR,
            onDay: world.currentDay,
            occupation: 'the one being played'
        }));

        theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's', bornToCultivators: false
        });

        const me = world.npcs.find(npc => npc.id === player.id)!;
        const tie = me.relationships.find(one => one.targetId === 'npc-0');
        expect(tie, 'the player does not know who raised them').toBeDefined();
        expect(tie!.kind).toBe('parent');
    });

    /**
     * A CULTIVATING FAMILY'S CHILD IS BORN TO CULTIVATORS, and until this the
     * case could not happen at all.
     *
     * Measured over six `established_clan` births - a tier whose whole
     * description is a cultivating clan - the parent drawn was a Qi Condensation
     * townsman every single time, because a settlement holds far more of them
     * than it holds cultivators and the draw was uniform. `bornToCultivators` is
     * read by the caller off `familyHouse.standingFrom`, which `origin.ts` says
     * in as many words is the family's STANDING rather than its word.
     *
     * And the second parent follows from it: a spouse tie is only ever written
     * between two cultivators, so a mortal parent can never supply one.
     */
    it('puts a cultivator ahead of a townsman who already keeps a household', () => {
        // npc-0 is a cultivator with nothing else to recommend them; npc-1 is a
        // mortal who already has a child, which is the world's own marker for a
        // household and outranks a bare adult. Only the cultivating-family term
        // separates them, which is what makes this fixture worth anything.
        const withAChild = (world: WorldState) => {
            const at = world.npcs.findIndex(npc => npc.id === 'npc-1');
            world.npcs[at] = upsertRelationship(world.npcs[at], {
                targetId: 'npc-2', targetName: 'Villager 2', kind: 'child', standing: 0.75
            }, world.currentDay);
            return world;
        };
        const ages = [300, 280, 40];
        const ordinals = [20, 0, 0];

        const clan = theFamilyThisLifeOpensWith({
            world: withAChild(hamlet(ages, ordinals)), cultivator: player,
            candidates: here(withAChild(hamlet(ages, ordinals))),
            seed: 's', bornToCultivators: true
        });
        expect(clan.filter(one => one.kind === 'parent').map(one => one.npc.id))
            .toEqual(['npc-0']);

        // And a farm child in the same hamlet is born to whoever is on the farm.
        const farm = theFamilyThisLifeOpensWith({
            world: withAChild(hamlet(ages, ordinals)), cultivator: player,
            candidates: here(withAChild(hamlet(ages, ordinals))),
            seed: 's', bornToCultivators: false
        });
        expect(farm.filter(one => one.kind === 'parent').map(one => one.npc.id))
            .toEqual(['npc-1']);
    });

    /**
     * AND THE SECOND PARENT FOLLOWS FROM THE MARRIAGE, which is the case that
     * could not happen at all until cultivating households were seeded: a spouse
     * tie is only ever written between two cultivators, so a mortal parent can
     * never supply one.
     */
    it('gives a married cultivator household child both of its parents', () => {
        const world = hamlet([300, 280, 40], [20, 18, 0]);
        for (const [a, b] of [[0, 1], [1, 0]]) {
            const at = world.npcs.findIndex(npc => npc.id === `npc-${a}`);
            world.npcs[at] = upsertRelationship(world.npcs[at], {
                targetId: `npc-${b}`, targetName: `Villager ${b}`,
                kind: 'spouse', standing: 0.85
            }, world.currentDay);
        }

        const kin = theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's',
            bornToCultivators: true
        });
        expect(kin.filter(one => one.kind === 'parent').map(one => one.npc.id).sort())
            .toEqual(['npc-0', 'npc-1']);
    });

    /**
     * A HOUSEHOLD MAY NOT NAME SOMEBODY THE WORLD DOES NOT HOLD.
     *
     * The unit half of the ruling. The module's own header warns against the
     * shape this guards - *"a seeded list of catalog notables would have given
     * them names they could say and nobody they could reach"* - and
     * `a-catalog-person-and-their-world-row.ts` records that the population of
     * named-and-never-instantiated people is real: the guest elders, the
     * wanderers and the sealed ancestors are in the catalogs and in no world.
     * A tie pointing at one of them is dropped rather than handed over.
     */
    it('drops a tie that points at nobody the world holds', () => {
        const world = hamlet([300], [20]);
        world.npcs.push(createNpc(world.seed, {
            id: player.id, name: player.name,
            bornOnDay: world.currentDay - 16 * DAYS_PER_YEAR,
            onDay: world.currentDay, occupation: 'the one being played'
        }));
        // A household already bound to somebody the catalog names and the world
        // never instantiated.
        const at = world.npcs.findIndex(npc => npc.id === player.id);
        world.npcs[at] = upsertRelationship(world.npcs[at], {
            targetId: 'member-a-sealed-ancestor', targetName: 'Somebody In A Book',
            kind: 'parent', standing: 0.7
        }, world.currentDay);

        const kin = theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's',
            bornToCultivators: true
        });
        expect(kin.map(one => one.npc.id)).not.toContain('member-a-sealed-ancestor');
    });

    /**
     * A MORTAL HOUSEHOLD IS NAMED AND NOTHING IS WRITTEN FOR IT.
     *
     * The owner: *"if your parents are mortals they're just mentioned once and
     * you never really see them again. that's how xianxia works too. so that
     * wouldn't be a defect."* And the reason it must be a mention rather than a
     * thin tie: *"cuz we don't track mortals, so we don't have a choice"* - a
     * mortal bound to a row can die, move or be cleaned up and nothing will
     * ever tell the player, so the tie is a promise the engine cannot keep.
     *
     * The NAME is still a real villager, and that is not an inconsistency. Any
     * name this game prints is a name it has to accept, and the villager is
     * standing there whether or not this points at them. What is absent is the
     * tie and the whereabouts.
     */
    it('writes nothing at all for a mortal household, and still names it', () => {
        const world = hamlet([40, 22], [0, 0]);
        const at = world.npcs.findIndex(npc => npc.id === 'npc-0');
        world.npcs[at] = upsertRelationship(world.npcs[at], {
            targetId: 'npc-1', targetName: 'Villager 1', kind: 'child', standing: 0.75
        }, world.currentDay);
        world.npcs.push(createNpc(world.seed, {
            id: player.id, name: player.name,
            bornOnDay: world.currentDay - 16 * DAYS_PER_YEAR,
            onDay: world.currentDay, occupation: 'the one being played'
        }));

        const kin = theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's',
            bornToCultivators: false
        });

        // Named, and the household is the same people the bind path would have
        // found - `theOtherChildrenOf` is the one read both use.
        expect(kin.map(one => one.kind)).toEqual(['parent', 'kin']);
        for (const one of kin) expect(one.aMentionOnly).toBe(true);

        // And not one row anywhere. Not on the parent, not on the sibling, not
        // on the player.
        for (const npc of world.npcs) {
            for (const tie of npc.relationships) {
                expect(tie.targetId, `${npc.name} holds a tie to the player`)
                    .not.toBe(player.id);
            }
        }
        expect(world.npcs.find(npc => npc.id === player.id)!.relationships).toEqual([]);
    });

    it('is the same household on a second read of the same life', () => {
        const world = hamlet([40, 44, 50], [20, 18, 19]);
        const first = theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's', bornToCultivators: false
        });
        const again = theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's', bornToCultivators: false
        });
        expect(again.map(one => one.npc.id)).toEqual(first.map(one => one.npc.id));
    });

    /**
     * THE TWO KINDS THE RULING KEEPS OUT. Not an oversight to be closed later:
     * a master is what the game is about finding, and a rival is earned.
     */
    it('hands over no master and no rival', () => {
        const world = hamlet([40, 44], [20, 18]);
        const kin = theFamilyThisLifeOpensWith({
            world, cultivator: player, candidates: here(world), seed: 's', bornToCultivators: false
        });
        expect(kin.length).toBeGreaterThan(0);
        for (const one of kin) expect(['parent', 'kin']).toContain(one.kind);
        for (const npc of world.npcs) {
            for (const tie of npc.relationships) {
                if (tie.targetId !== player.id) continue;
                expect(['child', 'kin'], `the world handed the player a ${tie.kind}`)
                    .toContain(tie.kind);
            }
        }
    });
});
