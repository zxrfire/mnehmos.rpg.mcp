/**
 * A vehicle's hold is its heads' worth of cargo, not the berth it takes up. The owner: "a cart
 * isn't infinite storage tho", "like try something like 20 swords, you couldn't fit 20 on your
 * person but in a cart for sure", "once you max out a cart you gotta do a spirit boat", and "don't
 * forget to test loading a carriage and loading a spirit boat".
 */
import { describe, expect, it } from 'vitest';

import { A_SPIRIT_BOAT_ANSWERS_TO, aVehicleOf, leaveItHere, whatAVehicleHolds, whatIsInTheVehicle } from '../../src/engine/world/a-vehicle';
import { makeObject } from '../../src/engine/world/possessions';
import { whatABodyCanCarry, whatStopsThemCarryingIt } from '../../src/engine/world/what-a-body-can-carry-and-what-a-ring-holds';
import { whatTheirThingsTake } from '../../src/engine/world/what-somebody-is-carrying-takes';
import { whatTheVehicleDoes } from '../../src/web/your-vehicle';
import { makeGameInWorld } from './harness';

describe('what a carriage and a spirit boat hold', () => {
    it('takes twenty swords a body cannot, and turns away a carcass a boat takes', async () => {
        const { game } = await makeGameInWorld({ seed: 'a-cart-of-swords', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const objects = game.atHand!.objects;
        const here = game.worldPlaceOf(cultivator);
        for (let n = 0; n < 20; n++) {
            objects.push(makeObject({ id: `sword-${n}`, name: 'an iron sword', kind: 'artifact', power: 1,
                volume: 3, weight: 1.5, possessorId: cultivator.id, ownerId: cultivator.id }));
        }
        // Twenty swords are more than a person carries.
        expect(whatStopsThemCarryingIt(whatTheirThingsTake(objects, cultivator.id),
            whatABodyCanCarry(cultivator.realmOrdinal))).not.toBeNull();

        objects.push(aVehicleOf({ id: 'carriage', conveyanceId: 'conv-carriage-mortal',
            ownerId: cultivator.id, ownerName: 'Ke Yan', at: here }));
        // Said the way a player says it, once.
        await game.act('chuck a sword in the carriage');
        for (let n = 0; n < 20; n++) whatTheVehicleDoes(game, cultivator, 'load', 'sword', 'carriage');
        expect(whatIsInTheVehicle(game.atHand!.objects, 'carriage')).toHaveLength(20);

        // A spirit beast's carcass is more than a carriage's hold, and less than a boat's.
        const carcass = makeObject({ id: 'carcass', name: 'a horned boar carcass', kind: 'other',
            volume: 1500, weight: 1200, possessorId: cultivator.id, ownerId: cultivator.id });
        game.atHand!.objects.push(carcass);
        expect(carcass.volume).toBeGreaterThan(whatAVehicleHolds({ data: { conveyanceId: 'conv-carriage-mortal' } }).volume);
        const intoTheCarriage = whatTheVehicleDoes(game, cultivator, 'load', 'carcass', 'carriage');
        expect(intoTheCarriage.outcome).toBe('refused');

        game.atHand!.objects.push(aVehicleOf({ id: 'boat', conveyanceId: 'conv-spirit-boat',
            ownerId: cultivator.id, ownerName: 'Ke Yan', at: here }));
        const intoTheBoat = whatTheVehicleDoes(game, cultivator, 'load', 'carcass', 'boat');
        expect(intoTheBoat.outcome).toBe('executed');
        expect(whatIsInTheVehicle(game.atHand!.objects, 'boat').map(o => o.id)).toEqual(['carcass']);
    }, 180_000);

    /** The owner: "try piloting a spirit boat too / you burn spirit stones as fuel". */
    it('burns spirit stones to fly a spirit boat, and does not lift on an empty purse', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'a-boat-that-burns', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const here = game.worldPlaceOf(cultivator);
        game.atHand!.objects.push(aVehicleOf({ id: 'boat', conveyanceId: 'conv-spirit-boat',
            ownerId: cultivator.id, ownerName: 'Ke Yan', at: here }));
        const where = () => repos.cultivators.getById(cultivator.id)!;
        const from = where().location;
        // At the helm, somebody at the rank it answers to.
        repos.cultivators.update(cultivator.id, { realmOrdinal: A_SPIRIT_BOAT_ANSWERS_TO });

        repos.cultivators.update(cultivator.id, { spiritStones: 0 });
        const grounded = await game.act('I fly my spirit boat to Silver Island');
        expect(grounded.toolCalls.some(call => call.action === 'ride' && !call.ok)).toBe(true);
        expect(where().location).toBe(from);

        repos.cultivators.update(cultivator.id, { spiritStones: 100 });
        const flown = await game.act('I fly my spirit boat to Silver Island');
        expect(where().location).toBe('Silver Island');
        expect(flown.narration).toMatch(/\d+ spirit stones burned in its chest/);
        expect(where().spiritStones).toBeLessThan(100);
    }, 180_000);

    /** The owner: a spirit boat answers to "29", Void Tribulation. */
    it('will not lift for somebody below the rank a spirit boat answers to', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'a-boat-that-burns', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        game.atHand!.objects.push(aVehicleOf({ id: 'boat', conveyanceId: 'conv-spirit-boat',
            ownerId: cultivator.id, ownerName: 'Ke Yan', at: game.worldPlaceOf(cultivator) }));
        repos.cultivators.update(cultivator.id, { spiritStones: 100 });
        const from = repos.cultivators.getById(cultivator.id)!.location;

        const asked = await game.act('I fly my spirit boat to Silver Island');
        expect(asked.narration).toMatch(/answers only to somebody at Void Tribulation/);
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(from);
        expect(repos.cultivators.getById(cultivator.id)!.spiritStones).toBe(100);
    }, 180_000);

    /** Played in the test wave: "load it into my spirit boat" loaded into the carriage standing here. */
    it('never loads into the carriage here when the boat named is moored elsewhere', async () => {
        const { game } = await makeGameInWorld({ seed: 'a-boat-left-behind', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const objects = game.atHand!.objects;
        const here = game.worldPlaceOf(cultivator);
        const away = game.atHand!.locations.find(l => l.id !== here && l.kind === 'settlement')!.id;
        objects.push(aVehicleOf({ id: 'carriage', conveyanceId: 'conv-carriage-mortal', ownerId: cultivator.id, ownerName: 'Ke Yan', at: here }));
        const boat = aVehicleOf({ id: 'boat', conveyanceId: 'conv-spirit-boat', ownerId: cultivator.id, ownerName: 'Ke Yan', at: away });
        objects.push(boat);
        leaveItHere(objects, boat, away);
        objects.push(makeObject({ id: 'sack', name: 'a sack of millet', kind: 'other',
            volume: 2, weight: 2, possessorId: cultivator.id, ownerId: cultivator.id }));

        const out = whatTheVehicleDoes(game, cultivator, 'load', 'sack', 'my spirit boat');
        expect(out.outcome).toBe('refused');
        expect(whatIsInTheVehicle(objects, 'carriage')).toHaveLength(0);
        // "the cart" still finds the carriage it means.
        expect(whatTheVehicleDoes(game, cultivator, 'load', 'sack', 'the cart').outcome).toBe('executed');
    }, 180_000);

    /**
     * THE ONE THEY MEANT, WHERE IT IS. With a carriage left at one place and a
     * boat moored at another, "load it into the boat" was refused naming
     * whichever vehicle they owned first - the carriage. `theVehiclesLeftElsewhere`
     * had no caller; it is what finds the boat they named.
     */
    it('names the vehicle they meant when it is standing somewhere else', async () => {
        const { game } = await makeGameInWorld({ seed: 'a-boat-left-behind', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const objects = game.atHand!.objects;
        const here = game.worldPlaceOf(cultivator);
        const [one, two] = game.atHand!.locations
            .filter(l => l.id !== here && l.kind === 'settlement').map(l => l.id);
        const carriage = aVehicleOf({ id: 'carriage', conveyanceId: 'conv-carriage-mortal',
            ownerId: cultivator.id, ownerName: 'Ke Yan', at: one! });
        const boat = aVehicleOf({ id: 'boat', conveyanceId: 'conv-spirit-boat',
            ownerId: cultivator.id, ownerName: 'Ke Yan', at: two! });
        objects.push(carriage, boat);
        leaveItHere(objects, carriage, one!);
        leaveItHere(objects, boat, two!);
        objects.push(makeObject({ id: 'sack', name: 'a sack of millet', kind: 'other',
            volume: 2, weight: 2, possessorId: cultivator.id, ownerId: cultivator.id }));

        const out = whatTheVehicleDoes(game, cultivator, 'load', 'sack', 'boat');
        expect(out.outcome).toBe('refused');
        expect(out.facts.prose).toContain(boat.name);
        expect(out.facts.prose).not.toContain('carriage');
    }, 180_000);
});
