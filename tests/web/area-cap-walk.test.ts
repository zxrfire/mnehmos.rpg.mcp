/**
 * The cap held on a fresh roster but companions and compound entry bypassed it.
 * Walk the live game through a busy town, markets, house rooms and a ship, then
 * advance several years. Every stop checks both the full placement and the
 * company handed to narration, including arrivals created after world seeding.
 * The body is raised to inedia after the voyage, letting the test
 * travel without starving. The final yearly checks drive the same world
 * advance as played spans; qi deviation during a long body wait does not
 * decide whether this spatial test reaches its third world year.
 * A voyage need not stop at sea because a particular seed once did. An actual
 * independently booked passenger now supplies the shared-hull contact, while
 * the rest of the world remains in place. Each continuation follows its real
 * accepted voyage, including the captain's ordinary turnback.
 */
import { describe, expect, it } from 'vitest';
import { DeterministicNarrator, type NarratorScene } from '../../src/web/narrator';
import type { EngineFacts } from '../../src/web/facts';
import { maxHpForOrdinal, REALM_TIERS } from '../../src/engine/cultivation/realms';
import { stillNeedsToEat } from '../../src/engine/cultivation/survival';
import { createNpc } from '../../src/engine/world/npc-state';
import { startNpcPassage } from '../../src/engine/world/places-on-the-way';
import { quotePublicPassage } from '../../src/engine/world/public-shipping';
import { commitNpcPublicPassage } from '../../src/engine/world/ship-crew';
import { routineTime } from '../../src/engine/world/npc-routines';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world';
import { finishTheAcceptedVoyage } from './finishing-an-accepted-voyage';
import { theWayThereIsByShip } from '../../src/web/the-way-there-is-by-ship';
import { isActing, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { npcsStandingIn, whereCompoundsAre } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { worldLocationFor } from '../../src/web/entities';
import { peopleInThisPlace } from '../../src/web/hearsay';
import { readWhatIsOnOfferHere } from '../../src/web/who-here-is-offering-something';
import { makeGameInWorld } from './harness';

class CheckingNarrator extends DeterministicNarrator {
    checked = 0;
    override async narrate(facts: EngineFacts, scene?: NarratorScene) {
        if (scene?.company) {
            expect(scene.company.total, scene.place).toBeLessThanOrEqual(3);
            expect(scene.company.named.length + scene.company.strangers.length).toBe(scene.company.total);
            const names = new Set(scene.company.named.map(person => person.name));
            for (const person of scene.company.named) {
                for (const name of person.withNames ?? []) expect(names.has(name), `off-area partner ${name}`).toBe(true);
            }
            this.checked++;
        }
        return super.narrate(facts);
    }
}

function cap(read: ReturnType<typeof theAreasOf>, label: string) {
    const counts = new Map<string, number>();
    for (const at of [...read.whereIs.values(), ...read.whereBodiesAre.values()]) counts.set(at, (counts.get(at) ?? 0) + 1);
    for (const area of read.areas) expect(counts.get(area.id) ?? 0, `${label}: ${area.name}`).toBeLessThanOrEqual(3);
}

describe('the area cap survives a played walk', () => {
    it('walks towns, markets, a compound and ship through three years without an overfull scene', async () => {
        const narrator = new CheckingNarrator();
        const h = await makeGameInWorld({ seed: 'sea-2', worldSeed: 'road-world', worldEnabled: true, adminMode: true, narrator });
        const { game, repos, db } = h;
        const { cultivator } = await game.newRun('Walker');
        let stops = 0;
        const check = async (wholeWorld = false) => {
            const world = (await game.loadWorld())!;
            const me = repos.cultivators.getById(cultivator.id)!;
            expect(me.alive, me.deathCause ?? 'alive').toBe(true);
            const place = worldLocationFor(world, me.location)!;
            const read = peopleInThisPlace(repos, me, world, place);
            cap(read, place.name);
            expect(game.present(me).length).toBeLessThanOrEqual(3);
            expect(game.company(me).total).toBeLessThanOrEqual(3);
            expect(readWhatIsOnOfferHere(me, world, undefined, game.present(me)).peopleHere).toBeLessThanOrEqual(3);
            if (wholeWorld) {
                const compounds = whereCompoundsAre(world);
                for (const row of world.locations) {
                    const placed = theAreasOf(world, row, compounds);
                    cap(placed, row.name);
                    expect(placed.whereIs.size, `${row.name}: an arrival is missing`).toBe(
                        npcsStandingIn(world, row.id, compounds).filter(n => !n.tags.includes(PLAYER_ROW_TAG)).length
                    );
                }
            }
            stops++;
        };
        db.prepare("UPDATE cultivators SET location = 'Emerald Water City', spirit_stones = 5000 WHERE id = ?").run(cultivator.id);
        const initial = game.currentRun();
        game.atHand = await prepareWorldClockForPreciseSpan(initial.run,initial.cultivator);
        const departureWorld = game.atHand!;
        const from = worldLocationFor(departureWorld,'Emerald Water City')!;
        const to = worldLocationFor(departureWorld,'Sweet Spring Island')!;
        repos.cultivators.standIn(cultivator.id,theAreasOf(departureWorld,from).areas.find(area=>area.for==='landing')!.id);
        const quote = quotePublicPassage(departureWorld,from.id,to.id,routineTime(departureWorld),1,[],
            `${initial.run.seed}:${Math.floor(initial.run.elapsedDays)}`);
        expect(quote,'The deck control needs a real bookable ship.').not.toBeNull();
        const passenger = createNpc(departureWorld.seed,{id:'area-control-passenger',name:'A travelling passenger',
            locationId:from.id,onDay:departureWorld.currentDay,bornOnDay:departureWorld.currentDay-20*365,
            spiritStones:quote!.fareStones+10});
        const booked = startNpcPassage(departureWorld.locations,passenger,{lane:quote!.lane,destinationId:to.id,
            onDay:quote!.departureDay,days:quote!.days,fareStones:quote!.fareStones,purpose:'Travelling to the island market.'})!;
        expect(booked.spiritStones).toBe(passenger.spiritStones-quote!.fareStones);
        departureWorld.npcs.push(booked);
        expect(commitNpcPublicPassage(departureWorld,booked)).toBe(true);
        game.theWorldMoved();
        await game.act('I take the ship to Sweet Spring Island');
        expect(repos.cultivators.getById(cultivator.id)!.standingIn).toContain('#deck#');
        expect(game.present(game.currentRun().cultivator).map(person=>person.id)).toContain(booked.id);
        expect(game.atHand!.npcs.some(n => n.id.startsWith('npc-crew-'))).toBe(true);
        await check(true);
        await game.act('look around');
        await finishTheAcceptedVoyage(game,to.name,true);
        await check();

        const ordinal = REALM_TIERS.find(realm => !stillNeedsToEat(realm.ordinalStart))!.ordinalStart;
        const hp = maxHpForOrdinal(cultivator.attributes.might, ordinal);
        repos.cultivators.update(cultivator.id, { realmOrdinal: ordinal, hp, maxHp: hp });
        for (let sailing=0;sailing<4 && game.currentRun().cultivator.location!==from.name;sailing++) {
            await game.act('I take the ship to Emerald Water City');
            await check();
            await finishTheAcceptedVoyage(game,from.name,true);
            await check();
        }
        expect(game.currentRun().cultivator.location,'The walking controls begin after an actual mainland return.').toBe(from.name);
        const world = game.atHand!;
        const walkingFrom=game.currentRun();
        const towns = world.locations.filter(row => row.kind === 'settlement' && !row.tags.includes('gate_town'))
            .filter(row=>theWayThereIsByShip(game,walkingFrom.cultivator,row.name,Math.floor(walkingFrom.run.elapsedDays))===null)
            .sort((a, b) => npcsStandingIn(world, b.id).length - npcsStandingIn(world, a.id).length).slice(0, 6);
        expect(towns).toHaveLength(6);
        expect(npcsStandingIn(world, towns[0]!.id).length).toBeGreaterThan(3);
        for (const town of towns) {
            game.knowledge.learnIfNew({ holderId: cultivator.id, kind: 'place', id: town.id, name: town.name,
                onDay: world.currentDay, sourceKind: 'told', stage: 'placed' });
            let journey;
            for (let leg = 0; leg < 12 && repos.cultivators.getById(cultivator.id)!.location !== town.name; leg++) {
                const before = game.atHand!.currentDay;
                journey = await game.act(`I travel to ${town.name}`);
                await check();
                if (game.atHand!.currentDay === before) break;
            }
            expect(repos.cultivators.getById(cultivator.id)!.location, journey?.narration).toBe(town.name);
            const stalls = theAreasOf(game.atHand!, town).areas.find(area => area.for === 'market')!;
            const market = await game.act(`I move to ${stalls.name}`);
            expect(repos.cultivators.getById(cultivator.id)!.standingIn,
                `${town.name}: ${market.narration}\n${JSON.stringify(market.toolCalls)}`).toContain('#market#');
            await check();
            await game.act('who is here');
            await game.act('I go to the inn');
            await game.act('I wait for a day');
            await check();
        }

        const compounds = whereCompoundsAre(game.atHand!);
        const compound = [...compounds.bySeat.values()].find(one => one.rooms.has('lecture_hall'))!;
        repos.sects.addMember(compound.houseId, cultivator.id, 0);
        repos.cultivators.update(cultivator.id, { sectId: compound.houseId, location: compound.seat.name });
        const yard = theAreasOf(game.atHand!, compound.seat).areas.find(area => area.for === 'forecourt')!;
        repos.cultivators.standIn(cultivator.id, yard.id);
        await game.act('I go to the lecture hall');
        expect(repos.cultivators.getById(cultivator.id)!.location).toBe(compound.rooms.get('lecture_hall')!.name);
        await check();
        await game.act('who is here');
        await game.act('I go back out to the forecourt');
        await check();
        await game.act('I go to my quarters');
        const start = game.atHand!.currentDay;
        for (let i = 0; i < 3; i++) {
            const now = game.currentRun();
            const beforeClock=routineTime(game.atHand!);
            repos.runs.advanceDays(now.run.id, 365);
            await game.advanceWorld(365, now.cultivator, repos.runs.getById(now.run.id)!);
            game.atHand = await game.loadWorld();
            await game.act('look around');
            const run = game.currentRun().run;
            expect(routineTime(game.atHand!)-beforeClock).toBeCloseTo(run.elapsedDays-now.run.elapsedDays);
            await check(true);
        }
        expect(game.atHand!.currentDay - start).toBeGreaterThanOrEqual(3 * 365);
        expect(stops).toBeGreaterThan(20);
        expect(narrator.checked).toBeGreaterThan(20);
        const living = game.atHand!.npcs.filter(n => isActing(n.status));
        expect(living.length).toBeGreaterThan(0);
        db.close();
    }, 300_000);
});
