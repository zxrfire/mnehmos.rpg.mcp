/**
 * Company08 native reader/guard controls reached 9 green assertions and showed
 * established membership survives an actual hull. The next source audit found
 * new owned rides selected that canonical membership as if every body were at
 * departure: acceptOwnedPassage then replaced selected activities without a
 * physical availability preflight. This is a source-read gap, not yet a measured
 * played defect. These controls ask the real ride verb before fare/fuel/time,
 * preserve the entire member row/course/agreement on refusal, and also exercise
 * direct native acceptance. Fixtures arrange existing world bodies, an ordinary
 * held craft and a real advertised destination; they mint no person or route.
 * Operator knowledge setup records that actual route for the driver's navigation.
 * A current public course is actually booked through its quote/writer/crew path.
 * The separate Company09 landfall/card tests retain full physical voyage coverage.
 * Company12 reads the current game.atHand store after the played action for
 * row/course/history/craft assertions rather than retain setup object references.
 * At Company12 no alias failure had been measured; it kept the observer at the actual
 * emitted boundary. Runtime and asserted behavior are11; scripted routing proves
 * native behavior, not actual-model prose. Unrun draft.
 * Boarding14's strict paired red stopped at 4 failures / 10 passes instead of
 * the intended three availability failures. Its candidate-only five new tests
 * then passed four and failed only custody. Preserved diagnostic15 measured
 * worldAliasEqual=true and boatAliasEqual=false: takeItAlong had replaced the
 * object-table row, and the fixture changed only its earlier boat reference.
 * The current actual craft remained player-owned, so accepting it was correct.
 * Boarding16 changes only that setup to the current object-table row by real id;
 * expected refusal and unchanged-receipt assertions remain. Ownership rejection
 * requires no production repair. Actual retained custody data is not rewritten.
 * Boarding16 remains uncompiled/unrun; original14/15 evidence stays frozen.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { prepareWorldClockForPreciseSpan, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { setLocation, setRealm, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state.js';
import { takeThemWithYou, whoTheyAreOutWith } from '../../src/engine/world/who-is-on-the-road-with-you.js';
import { publicTransportFrom } from '../../src/engine/world/public-transport-at-a-place.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { walkingDaysFrom } from '../../src/engine/world/locations.js';
import { priceJourney } from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { aVehicleOf, takeItAlong, whoItIsWith } from '../../src/engine/world/a-vehicle.js';
import { acceptOwnedPassage, ownedPassageClaim } from '../../src/web/an-owned-passage.js';
import { startNpcPassage } from '../../src/engine/world/places-on-the-way.js';
import { quotePublicPassage } from '../../src/engine/world/public-shipping.js';
import { commitNpcPublicPassage } from '../../src/engine/world/ship-crew.js';

async function fixture() {
    const plans: string[] = [];
    const h = await makeGameInWorld({ seed: 'precise-owned-ocean', worldSeed: 'precise-owned-ocean-world',
        provider: new ScriptedProvider({ plans, narrations: [] }) });
    await h.game.newRun('Journey pilot');
    let now = h.game.currentRun();
    h.game.atHand = await prepareWorldClockForPreciseSpan(now.run, now.cultivator);
    const world = h.game.atHand, day = routineTime(world);
    const route = world.locations.filter(place => place.kind === 'settlement').flatMap(from =>
        publicTransportFrom(world, from.name, day).filter(line => line.service === 'ship' && line.runsFromDay === null)
            .map(line => ({ from, to: worldLocationFor(world, line.to), line }))).find(row => row.to !== null);
    expect(route, 'the actual world supplies an open native destination').toBeDefined();
    const from = route!.from, to = route!.to!;
    h.repos.cultivators.update(now.cultivator.id, { location: from.name, standingIn: null,
        realmOrdinal: 29, hp: 100000, maxHp: 100000, spiritStones: 100000 });
    now = h.game.currentRun();
    const member = world.npcs.find(npc => npc.status === 'alive' && !npc.tags.includes(PLAYER_ROW_TAG))!;
    expect(member).toBeDefined();
    const at = world.npcs.findIndex(npc => npc.id === member.id);
    const standing = { ...setRealm(setLocation(member, from.id, day), 29, day), activity: null };
    world.npcs[at] = takeThemWithYou([standing], { party: [{ id: standing.id, name: standing.name }],
        leaderId: now.cultivator.id, note: 'The existing agreement to travel together.', onDay: day, untilDay: day + 365 })[0]!;
    const boat = aVehicleOf({ id: 'actual-party-boarding-hull', conveyanceId: 'conv-spirit-boat',
        ownerId: now.cultivator.id, ownerName: now.cultivator.name, at: from.id });
    world.objects.push(boat); takeItAlong(world.objects, boat, now.cultivator.id);
    const walkingDays = walkingDaysFrom(world.locations, from.id).get(to.id)!;
    const quote = priceJourney({ walkingDays, conveyance: requireConveyance('conv-spirit-boat'), power: boat.power, heads: 2 });
    expect(quote.trips).toBe(1);
    for (const id of [to.id, to.name]) h.game.knowledge.learnIfNew({ holderId: now.cultivator.id, kind: 'place', id,
        name: to.name, onDay: now.run.elapsedDays, sourceKind: 'witnessed', stage: 'encountered' });
    h.game.theyGaveTheirName(now.cultivator, now.run, member);
    h.game.theWorldMoved();
    const input = { vesselId: boat.id, pilotId: now.cultivator.id, fromId: from.id, toId: to.id,
        walkingDays, days: quote.daysOneWay, conveyanceId: 'conv-spirit-boat', power: boat.power, companions: [member.id] };
    return { ...h, plans, world, member, at, boat, from, to, input };
}

for (const situation of ['absent', 'another accepted hull'] as const) {
    it(`the played owned ride refuses before cost when its agreed member is on ${situation}`, async () => {
        const h = await fixture();
        try {
            const day = routineTime(h.world);
            if (situation === 'absent') h.world.npcs[h.at] = setLocation(h.world.npcs[h.at]!, h.to.id, day);
            else {
                const quote = quotePublicPassage(h.world, h.from.id, h.to.id, day)!;
                expect(quote).not.toBeNull();
                const person = { ...h.world.npcs[h.at]!, spiritStones: Math.max(h.world.npcs[h.at]!.spiritStones, quote.fareStones) };
                h.world.npcs[h.at] = startNpcPassage(h.world.locations, person, { lane: quote.lane, destinationId: quote.toId,
                    onDay: day, days: quote.days, fareStones: quote.fareStones, purpose: 'Their accepted public passage.' })!;
                expect(commitNpcPublicPassage(h.world, h.world.npcs[h.at]!)).toBe(true);
            }
            h.game.theWorldMoved();
            const before = h.game.currentRun(), member = structuredClone(h.world.npcs[h.at]!), boat = structuredClone(h.boat);
            const facts = structuredClone(h.world.history.facts);
            expect(h.game.whoIsWithYouOnTheRoad(before.cultivator).some(person => person.id === h.member.id)).toBe(true);
            h.plans.push(JSON.stringify({ action: 'ride', target: h.to.name, topic: 'my spirit boat' }));
            const answer = await h.game.act('I ride my spirit boat to ' + h.to.name + ' with my party.');
            expect(answer.toolCalls.some(call => call.name === 'world.availableForOwnedBoarding' && !call.ok)).toBe(true);
            expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
            expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
            expect(h.game.currentRun().cultivator.location).toBe(before.cultivator.location);
            expect(h.game.atHand!.npcs.find(person => person.id === h.member.id)).toEqual(member);
            expect(h.game.atHand!.objects.find(object => object.id === h.boat.id)).toEqual(boat);
            expect(h.game.atHand!.history.facts).toEqual(facts);
            expect(ownedPassageClaim(h.db, before.cultivator.id)).toBeNull();
            expect(whoTheyAreOutWith(h.game.atHand!.npcs.find(person => person.id === h.member.id)!,
                routineTime(h.game.atHand!))?.withIds).toContain(before.cultivator.id);
        } finally { h.db.close(); resetCultivationWorlds(); }
    }, 180_000);
}

it('native owned acceptance cannot replace an unavailable body or write a receipt', async () => {
    const h = await fixture();
    try {
        h.world.npcs[h.at] = setLocation(h.world.npcs[h.at]!, h.to.id, routineTime(h.world));
        const member = structuredClone(h.world.npcs[h.at]!), facts = structuredClone(h.world.history.facts);
        const now = h.game.currentRun();
        expect(() => acceptOwnedPassage(h.game, now.run, now.cultivator, h.input)).toThrow(/not available to board/);
        expect(h.world.npcs[h.at]).toEqual(member);
        expect(h.world.history.facts).toEqual(facts);
        expect(ownedPassageClaim(h.db, now.cultivator.id)).toBeNull();
    } finally { h.db.close(); resetCultivationWorlds(); }
}, 180_000);

it('native owned acceptance reads existing custody before any receipt', async () => {
    const h = await fixture();
    try {
        const currentWorld = h.game.atHand!;
        const currentBoat = currentWorld.objects.find(row => row.id === h.input.vesselId)!;
        expect(currentBoat, 'custody setup must change the native current craft row').toBeDefined();
        currentBoat.ownerId = h.member.id;
        takeItAlong(currentWorld.objects, currentBoat, h.member.id);
        const actualCustody = currentWorld.objects.find(row => row.id === h.input.vesselId)!;
        expect(actualCustody.ownerId).toBe(h.member.id);
        expect(whoItIsWith(actualCustody)).toBe(h.member.id);
        const objects = structuredClone(h.world.objects), facts = structuredClone(h.world.history.facts);
        const now = h.game.currentRun();
        expect(() => acceptOwnedPassage(h.game, now.run, now.cultivator, h.input)).toThrow(/owner and held craft/);
        expect(h.world.objects).toEqual(objects);
        expect(h.world.history.facts).toEqual(facts);
        expect(ownedPassageClaim(h.db, now.cultivator.id)).toBeNull();
    } finally { h.db.close(); resetCultivationWorlds(); }
}, 180_000);

it('a physically available agreed member boards normally without acquiring a second membership', async () => {
    const h = await fixture();
    try {
        const now = h.game.currentRun(), agreement = structuredClone(h.world.npcs[h.at]!.activity);
        const receipt = acceptOwnedPassage(h.game, now.run, now.cultivator, h.input);
        expect(ownedPassageClaim(h.db, now.cultivator.id)?.receiptId).toBe(receipt);
        expect(h.world.npcs[h.at]!.activity?.kind).toBe('travelling');
        expect(h.world.npcs[h.at]!.activity?.vesselId).toBe(h.boat.id);
        expect(h.world.npcs[h.at]!.activity?.passageCompany).toEqual(agreement);
        expect(whoTheyAreOutWith(h.world.npcs[h.at]!, routineTime(h.world))?.withIds).toContain(now.cultivator.id);
    } finally { h.db.close(); resetCultivationWorlds(); }
}, 180_000);
