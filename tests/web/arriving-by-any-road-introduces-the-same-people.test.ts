/**
 * Three of the four ways of arriving introduced nobody.
 *
 * `move` writes three facts on arriving - the place stops being a rumour, the
 * house that holds the ground is written, and the people of your OWN house
 * standing on it become nameable. `arriveAfterSpending`, which is the whole of
 * `ride`, `fold` and `passage`, wrote the first two and returned no `perceived`
 * at all, so none of the three callers could hand any to the turn. The same
 * disciple walking and buying passage to the same ground met different people.
 * That is the "Sword Elder who could not name one person in his own house"
 * defect the `move` comment cites, live on three of the four ways of arriving.
 *
 * ── AND THE FINDING NEXT TO IT WAS NOT ONE ───────────────────────────────
 *
 * The audit also reported `fold` as wrong for declaring its `FoldFix` as
 * `'stood'` or refusing, since `'seen'` has no producer anywhere in `src/`.
 * That is true and it is deliberate: `seen` derived from the sight horizon was
 * built once and measured wrong - the horizon dwarfs the fold range at every
 * rung on the curve, so the check is a no-op and anybody above the floor has a
 * fix on every name they have ever heard.
 * `getting-there-without-walking-it.test.ts` pins that and gives the figures.
 * The door is closed with the reason written on it, so it stays closed.
 * The old rider control chose the first unrelated world location, held no
 * road and owned no mount. It now rides an actual mount from its own house's
 * linked gate town, checking only the actual members it meets on arrival.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { aVehicleOf } from '../../src/engine/world/a-vehicle';

const HOUSE = 'sect-azure-cloud-pavilion';

/** How many of the house's own roll this cultivator can put a name to. */
function nameable(game: any, holderId: string): number {
    return game.atHand.npcs.filter((member: any) => member.factionId === HOUSE)
        .filter((member: any) => game.knowledge.isAwareOf(holderId, 'cultivator', member.id))
        .length;
}

describe('who an arrival introduces', () => {
    /**
     * Ridden rather than walked, which is the arrival that shares the helper
     * with `fold` and `passage` and had none of this.
     */
    it('introduces a rider to their own house the way a walk does', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'ride-introduces', worldSeed: 'world-ride-introduces'
        });
        const { cultivator } = await game.newRun('Rider');
        game.repos.sects.addMember(HOUSE, cultivator.id, 3);
        expect(nameable(game, cultivator.id), 'enrolled and already knows them').toBe(0);

        const world = game.atHand!;
        const seat = world.locations.find(row => row.kind === 'sect_seat' && row.data.factionId === HOUSE)!;
        const town = world.locations.find(row => row.kind === 'settlement' && row.data.gateId === seat.id
            && seat.links.some(link => link.toLocationId === row.id && link.open));
        expect(town, 'The rider needs the house\'s actual open gate road.').toBeDefined();
        game.repos.cultivators.update(cultivator.id, {location:town!.name,
            realmOrdinal:Number(seat.data.admissionOrdinal)});
        game.knowledge.learnIfNew({holderId:cultivator.id,kind:'place',id:seat.name,name:seat.name,
            onDay:world.currentDay,sourceKind:'read',stage:'placed',statement:`The gate road reaches ${seat.name}.`});
        world.objects.push(aVehicleOf({id:'arrival-control-mount',conveyanceId:'conv-mount-mortal',
            ownerId:cultivator.id,ownerName:cultivator.name,at:town!.id}));
        game.theWorldMoved();

        const arrival = await game.act(`I ride the mount to ${seat.name}`);

        const where = (db.prepare('SELECT location FROM cultivators WHERE id = ?')
            .get(cultivator.id) as { location: string }).location;
        expect(where, arrival.narration).toBe(seat.name);
        expect(world.history.facts.some(fact => fact.data.ownedPassage === true
            && fact.data.vesselId === 'arrival-control-mount' && fact.data.toLocationId === seat.id)).toBe(true);
        const membersHere = game.present(game.currentRun().cultivator).filter(row => row.sectId === HOUSE);
        expect(membersHere.length, arrival.narration).toBeGreaterThan(0);
        for (const person of membersHere)
            expect(game.knowledge.isAwareOf(cultivator.id,'cultivator',person.id),person.name).toBe(true);
        expect(nameable(game, cultivator.id)).toBeGreaterThan(0);
    }, 300_000);
});
