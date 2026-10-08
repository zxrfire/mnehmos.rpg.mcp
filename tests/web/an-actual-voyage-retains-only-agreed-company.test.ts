/**
 * Company05 compiler/native controls passed four authority seams, but they did
 * not play a voyage or read the narrator boundary. These successors keep that
 * distinction. Two real native modes each retain one previously agreed party
 * member and one fellow passenger on an advertised, existing route. Another
 * pair expires that agreement while its holder remains physically aboard.
 * Operator setup relocates existing living world people and records the prior
 * agreement through takeThemWithYou; it creates no person, route, room or bed.
 * The held craft is an ordinary aVehicleOf row. Boarding and every subsequent
 * span use canonical accepted passage and real fare/fuel/time authorities.
 * Call-through narration spies inspect real status facts and contact cards;
 * scripted routing is not actual-model prose acceptance.
 * Company07 full compiler reported TS2345: public newRun returns RunView, not
 * the native Run required by prepareWorldClockForPreciseSpan. An inadvertently
 * launched native reader arm then stopped at 8 failures / 1 pass: all five
 * new fixtures failed NOT NULL world_runs.seed before reaching behavior; the
 * original three intended reader failures and cancellation pass remained.
 * Company08 changes only that setup to currentRun(), preserving all runtime
 * drafts and every behavioral assertion. No07 failure is a runtime finding.
 * Root-owned Company08 full overlay compiler19629 then exited 0 with zero
 * diagnostics. Paired native35465 exited 0: exact reader-only red 6 failures /
 * 3 passes, independent-course guard-only red 1 failure / 8 passes, candidate
 * 9 passes. Real paid carriage and held craft both retained original company
 * through native fare/fuel/time/landfall; expired agreements did not stop their
 * bodies travelling. A member on another accepted actual hull retained their
 * complete row and history when the leader arrival hook ran. These controls
 * reached emitted status and local contact facts, not actual-model prose.
 * Company09 adds only this measured header; runtime and assertions are08.
 * Arrival01 adds factual delivery controls without changing prior assertions.
 * A booking and a party agreement cannot prove that a body reached landfall.
 * Six actual native carriage/held-craft/public-ship journeys write one arrival per
 * living body on their accepted course, including expired company. Before
 * arrival, there is no delivery proof. At actual landfall, proof reads every
 * individual fact and rejects a later assignment, death or absent charge.
 * Repeated projection must not duplicate arrival; a different hull remains
 * independent. These added controls are uncompiled/unrun, not prose acceptance.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { prepareWorldClockForPreciseSpan, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { routineOf, routineTime } from '../../src/engine/world/npc-routines.js';
import { setLocation, setRealm, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state.js';
import { takeThemWithYou, whoTheyAreOutWith } from '../../src/engine/world/who-is-on-the-road-with-you.js';
import { publicTransportFrom } from '../../src/engine/world/public-transport-at-a-place.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { walkingDaysFrom } from '../../src/engine/world/locations.js';
import { priceJourney } from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';
import { aVehicleOf, takeItAlong } from '../../src/engine/world/a-vehicle.js';
import { quotePublicCarriage, commitPublicCarriage, publicCarriagePassage } from '../../src/engine/world/public-carriages.js';
import { keepThePaidCarriage } from '../../src/web/a-paid-carriage-on-the-road.js';
import { acceptOwnedPassage, ownedCarrierAt } from '../../src/web/an-owned-passage.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { startNpcPassage } from '../../src/engine/world/places-on-the-way.js';
import { quotePublicPassage, onSponsoredPublicPassage, recordPublicPassage } from '../../src/engine/world/public-shipping.js';
import { writeTheVoyage } from '../../src/web/a-ship-at-sea.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { commitNpcPublicPassage } from '../../src/engine/world/ship-crew.js';
import { actualBodiesArrivedTogether, arrivalCourseOfFact, recordActualBodyArrival, sameActualArrivalCourse } from '../../src/engine/world/a-body-that-actually-arrived.js';

type Mode = 'carriage' | 'owned' | 'ship';
async function voyage(mode: Mode, expiresAboard: boolean) {
    const plans: string[] = [];
    const h = await makeGameInWorld({ seed: 'precise-owned-ocean', worldSeed: 'precise-owned-ocean-world',
        provider: new ScriptedProvider({ plans, narrations: [] }) });
    await h.game.newRun('Journey passenger');
    const opened = h.game.currentRun();
    h.game.atHand = await prepareWorldClockForPreciseSpan(opened.run, opened.cultivator);
    const world = h.game.atHand, day = routineTime(world);
    const service = mode === 'carriage' ? 'carriage' : 'ship';
    // Both endpoints and the offered fare are read from the actual public
    // catalogue. The owned boat's physical duration is quoted independently.
    const candidates = world.locations.filter(place => place.kind === 'settlement').flatMap(from =>
        publicTransportFrom(world, from.name, day).filter(line => line.service === service && line.runsFromDay === null)
            .flatMap(line => {
                const to = worldLocationFor(world, line.to);
                if (!to) return [];
                const walking = walkingDaysFrom(world.locations, from.id).get(to.id);
                if (walking === undefined || walking <= 0) return [];
                const craft = mode === 'owned' ? aVehicleOf({ id: 'company-voyage-held-hull', conveyanceId: 'conv-spirit-boat',
                    ownerId: opened.cultivator.id, ownerName: opened.cultivator.name, at: from.id }) : null;
                const quoted = mode === 'owned' ? priceJourney({ walkingDays: walking, conveyance: requireConveyance('conv-spirit-boat'),
                    power: craft!.power, heads: 3 }) : null;
                const duration = quoted?.daysOneWay ?? line.days;
                return duration > 2 && (!quoted || quoted.trips === 1) ? [{ from, to, line, walking, craft, quoted, duration }] : [];
            }));
    const route = candidates.sort((a, b) => a.duration - b.duration)[0];
    expect(route, 'the real world must supply an open actual route long enough to inspect company while aboard').toBeDefined();
    const { from, to, duration } = route!;
    const body = opened.cultivator;
    const hp = maxHpForOrdinal(body.attributes.might, 29);
    h.repos.cultivators.update(body.id, { location: from.name, standingIn: null, realmOrdinal: 29,
        hp, maxHp: hp, spiritStones: 100000 });
    const people = world.npcs.filter(npc => npc.status === 'alive' && !npc.tags.includes(PLAYER_ROW_TAG)).slice(0, 2);
    expect(people).toHaveLength(2);
    for (const person of people) {
        const at = world.npcs.findIndex(npc => npc.id === person.id);
        world.npcs[at] = { ...setRealm(setLocation(person, from.id, day), 29, day), activity: null };
    }
    const [member, fellow] = people;
    const until = expiresAboard ? day + duration / 3 : day + duration + 5;
    const agreed = takeThemWithYou(world.npcs, { party: [{ id: member!.id, name: member!.name }], leaderId: body.id,
        note: 'A previously agreed journey together.', onDay: day, untilDay: until })[0]!;
    world.npcs[world.npcs.findIndex(npc => npc.id === member!.id)] = agreed;
    const agreement = structuredClone(agreed.activity!);
    h.game.theWorldMoved();
    h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, member!);
    h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, fellow!);
    const narrated = vi.spyOn(h.narrator, 'narrate');
    async function card(expectedMember: boolean) {
        narrated.mockClear();
        plans.push(JSON.stringify({ action: 'status' }));
        await h.game.act('I check my status.');
        const calls = narrated.mock.calls;
        expect(calls.length, 'actual status must reach narration').toBeGreaterThan(0);
        const facts = calls.at(-1)![0];
        const partyLines = facts.lines.filter(line => line.includes('on the road with you'));
        if (expectedMember) {
            expect(partyLines.join('\n')).toContain(member!.name);
            expect(partyLines.join('\n')).toContain(agreement.note);
        } else expect(partyLines.join('\n')).not.toContain(member!.name);
        expect(partyLines.join('\n')).not.toContain(fellow!.name);
        const ids = h.game.whoIsWithYouOnTheRoad(h.game.currentRun().cultivator).map(npc => npc.id);
        expect(ids.includes(member!.id)).toBe(expectedMember);
        expect(ids).not.toContain(fellow!.id);
        const scene = calls.at(-1)![1];
        const present = h.game.present(h.game.currentRun().cultivator);
        for (const person of [member!, fellow!]) {
            expect(scene.company?.named.some(card => card.name === person.name) ?? false,
                'the narrator receives this known person exactly when native local presence supplies their card')
                .toBe(present.some(row => row.id === person.id));
        }
        return scene;
    }
    await card(true);
    const current = h.game.currentRun();
    const departure = routineTime(world);
    let receiptId: string, arrival: number;
    if (mode === 'carriage') {
        const quote = quotePublicCarriage(world, { fromId: from.id, toId: to.id, day: departure,
            conveyanceId: 'conv-carriage-mortal', passengerIds: [body.id, member!.id, fellow!.id],
            fareStones: route!.line.cashPerSeat * 3, hired: false,
            playedPassenger: { id: body.id, locationId: from.id, alive: true } });
        expect(quote).not.toBeNull();
        const receipt = commitPublicCarriage(world, quote!)!;
        expect(receipt).not.toBeNull();
        receiptId = receipt.id; arrival = quote!.arrivalDay;
        h.repos.cultivators.applyDeltas(body.id, { spiritStones: -quote!.fareStones });
        keepThePaidCarriage(h.db, body.id, receiptId);
    } else if (mode === 'owned') {
        const craft = route!.craft!;
        world.objects.push(craft); takeItAlong(world.objects, craft, body.id);
        receiptId = acceptOwnedPassage(h.game, current.run, current.cultivator, { vesselId: craft.id, pilotId: body.id,
            fromId: from.id, toId: to.id, walkingDays: route!.walking, days: route!.quoted!.daysOneWay,
            conveyanceId: 'conv-spirit-boat', power: craft.power, companions: [member!.id, fellow!.id] });
        arrival = departure + route!.quoted!.daysOneWay;
    } else {
        const quote = quotePublicPassage(world, from.id, to.id, departure, 3, [],
            `${current.run.seed}:${Math.floor(current.run.elapsedDays)}`);
        expect(quote).not.toBeNull();
        for (const person of [member!, fellow!]) {
            const index = world.npcs.findIndex(row => row.id === person.id);
            world.npcs[index] = onSponsoredPublicPassage(world, world.npcs[index]!, quote!, 'Their actual paid crossing.')!;
            expect(commitNpcPublicPassage(world, world.npcs[index]!)).toBe(true);
        }
        const accepted = recordPublicPassage(world, quote!, departure, from.id, [body.id]);
        // Shared native receipts may already exist for another booked body. Its
        // actor list does not replace individual arrival facts for this player.
        receiptId = accepted.id; arrival = quote!.arrivalDay;
        h.repos.cultivators.applyDeltas(body.id, { spiritStones: -quote!.fareStones });
        writeTheVoyage(h.db, body.id, { receiptId, from: from.name, bound: to.name,
            lane: quote!.lane, sailed: 0, days: quote!.days, quoted: route!.line.days,
            hullRationDays: quote!.provision.rationDaysAboard, crew: 0 });
    }
    h.game.theWorldMoved();
    const beganAt = h.game.currentRun().run.elapsedDays;
    const carrier = () => mode === 'carriage'
        ? publicCarriagePassage(h.game.atHand!, receiptId, body.id, routineTime(h.game.atHand!))
        : mode === 'owned' ? ownedCarrierAt(h.game.atHand!, receiptId, h.game.currentRun().cultivator, routineTime(h.game.atHand!))
        : shipPassengerAt(h.game.atHand!, receiptId, routineTime(h.game.atHand!));
    const spendUntil = async (target: number) => {
        for (let attempt = 0; attempt < 8 && !journeyTimeHasReached(routineTime(h.game.atHand!), target); attempt++) {
            const before = h.game.currentRun(), at = routineTime(h.game.atHand!);
            const advanced = await passHours(h.game, before.run, before.cultivator, (target - at) * 24);
            expect(advanced.spent?.outcome, JSON.stringify(advanced.spent)).toBe('executed');
            expect(routineTime(h.game.atHand!), 'retained actual carrier must make real progress').toBeGreaterThan(at);
            expect(h.game.currentRun().cultivator.alive).toBe(true);
        }
        expect(journeyTimeHasReached(routineTime(h.game.atHand!), target), 'actual carrier must reach the requested physical boundary').toBe(true);
    };
    return { ...h, plans, narrated, member: member!, fellow: fellow!, agreement, from, to, departure, arrival,
        receiptId, beganAt, card, carrier, spendUntil, expiresAboard };
}

it('an agreed member on a different actual hull keeps their physical course when the leader arrival hook runs', async () => {
    const h = await voyage('owned', false);
    try {
        const world = h.game.atHand!, day = routineTime(world);
        const offered = publicTransportFrom(world, h.from.name, day)
            .filter(line => line.service === 'ship' && line.runsFromDay === null)
            .map(line => worldLocationFor(world, line.to)).filter(place => place !== null)
            .map(place => quotePublicPassage(world, h.from.id, place!.id, day)).find(quote => quote !== null);
        expect(offered, 'the existing landing supplies a real independently accepted public hull').toBeDefined();
        const at = world.npcs.findIndex(npc => npc.id === h.member.id);
        const waiting = { ...world.npcs[at]!, spiritStones: Math.max(world.npcs[at]!.spiritStones, offered!.fareStones) };
        const independentlyBooked = startNpcPassage(world.locations, waiting, { lane: offered!.lane,
            destinationId: offered!.toId, onDay: day, days: offered!.days, fareStones: offered!.fareStones,
            purpose: 'The independently accepted public crossing.' });
        expect(independentlyBooked).not.toBeNull();
        world.npcs[at] = independentlyBooked!;
        expect(commitNpcPublicPassage(world, independentlyBooked!)).toBe(true);
        expect(independentlyBooked!.activity?.vesselId).not.toBe(world.history.facts.find(f => f.id === h.receiptId)!.data.vesselId);
        h.game.theWorldMoved();
        expect(h.game.whoIsWithYouOnTheRoad(h.game.currentRun().cultivator).some(npc => npc.id === h.member.id)).toBe(true);
        const before = structuredClone(world.npcs[at]!);
        const events = structuredClone(world.history.facts);
        // This is the native arrival-hook boundary, not a claim that a player
        // can request teleportation. A hook cannot settle somebody else's leg.
        const moved = h.game.theyArrivedWithYou(h.game.currentRun().cultivator, h.to.name);
        expect(moved?.names ?? []).not.toContain(h.member.name);
        expect(world.npcs[at]).toEqual(before);
        expect(world.history.facts).toEqual(events);
        expect(actualBodiesArrivedTogether(world, [
            { id: h.game.currentRun().cultivator.id, name: h.game.currentRun().cultivator.name, alive: true, locationId: h.to.id },
            { id: before.id, name: before.name, alive: true, locationId: h.to.id }
        ], h.to.id, h.departure)).toBe(false);
        expect(whoTheyAreOutWith(world.npcs[at]!, day)?.withIds).toContain(h.game.currentRun().cultivator.id);
    } finally { h.narrated.mockRestore(); h.db.close(); resetCultivationWorlds(); }
}, 180_000);

for (const mode of ['carriage', 'owned', 'ship'] as const) for (const expires of [false, true]) {
    it(`${mode}: actual voyage ${expires ? 'expires only the agreement while carrying its body' : 'retains established company through real landfall'}`, async () => {
        const h = await voyage(mode, expires);
        try {
            await h.spendUntil(h.departure + (h.arrival - h.departure) / 2);
            const world = h.game.atHand!, current = h.game.currentRun(), actual = h.carrier();
            expect(actual).not.toBeNull();
            const member = world.npcs.find(npc => npc.id === h.member.id)!;
            const fellow = world.npcs.find(npc => npc.id === h.fellow.id)!;
            const at = worldLocationFor(world, current.cultivator.location)!;
            expect(routineOf(world, member).locationId).toBe(at.id);
            expect(routineOf(world, fellow).locationId).toBe(at.id);
            expect(member.activity?.kind).toBe('travelling');
            expect(member.activity?.vesselId).toBe(fellow.activity?.vesselId);
            expect(whoTheyAreOutWith(fellow, routineTime(world))).toBeNull();
            expect(member.activity?.passageCompany).toEqual(h.agreement);
            await h.card(!expires);
            const accepted = world.history.facts.find(fact => fact.id === h.receiptId)!;
            const course = arrivalCourseOfFact(accepted)!;
            const arrivalFacts = () => h.game.atHand!.history.facts.filter(fact => fact.data.actualBodyArrival === true
                && sameActualArrivalCourse(arrivalCourseOfFact(fact)!, course));
            expect(arrivalFacts().filter(fact => [current.cultivator.id, member.id, fellow.id].includes(String(fact.data.bodyId)))).toHaveLength(0);
            expect(actualBodiesArrivedTogether(world, [
                { id: current.cultivator.id, name: current.cultivator.name, alive: true, locationId: at.id },
                { id: member.id, name: member.name, alive: true, locationId: member.locationId }
            ], h.to.id, h.departure)).toBe(false);
            await h.spendUntil(h.arrival);
            expect(h.game.currentRun().cultivator.location).toBe(h.to.name);
            const landed = h.game.atHand!.npcs.find(npc => npc.id === h.member.id)!;
            const fellowLanded = h.game.atHand!.npcs.find(npc => npc.id === h.fellow.id)!;
            expect(landed.locationId).toBe(h.to.id);
            expect(fellowLanded.locationId).toBe(h.to.id);
            expect(landed.locationId).not.toBe(h.agreement.returnTo);
            expect(landed.activity?.passageCompany).toBeUndefined();
            if (expires) expect(landed.activity).toBeNull();
            else expect(landed.activity).toEqual(h.agreement);
            expect(whoTheyAreOutWith(fellowLanded, routineTime(h.game.atHand!))).toBeNull();
            await h.card(!expires);
            const player = h.game.currentRun().cultivator;
            const bodies = [
                { id: player.id, name: player.name, alive: player.alive, locationId: h.to.id },
                { id: landed.id, name: landed.name, alive: landed.status === 'alive', locationId: landed.locationId },
                { id: fellowLanded.id, name: fellowLanded.name, alive: fellowLanded.status === 'alive', locationId: fellowLanded.locationId }
            ];
            for (const arrived of bodies) {
                const facts = arrivalFacts().filter(fact => fact.data.bodyId === arrived.id);
                expect(facts, 'every actually carried living body has its own landfall fact').toHaveLength(1);
                expect(facts[0]!.actors.some(actor => actor.id === arrived.id && actor.role === 'arrived')).toBe(true);
                expect(facts[0]!.locationId).toBe(h.to.id);
            }
            expect(actualBodiesArrivedTogether(h.game.atHand!, bodies, h.to.id, h.departure)).toBe(true);
            expect(actualBodiesArrivedTogether(h.game.atHand!, bodies, h.to.id, h.arrival)).toBe(false);
            expect(actualBodiesArrivedTogether(h.game.atHand!, [bodies[0]!, { ...bodies[1]!, alive: false }], h.to.id, h.departure)).toBe(false);
            const beforeRepeat = arrivalFacts().map(fact => fact.id);
            h.game.theWorldMoved();
            for (const arrived of bodies) recordActualBodyArrival(h.game.atHand!, arrived, course, routineTime(h.game.atHand!), accepted);
            expect(arrivalFacts().map(fact => fact.id)).toEqual(beforeRepeat);
            expect(h.game.currentRun().run.elapsedDays - h.beganAt).toBeCloseTo(h.arrival - h.departure, 8);
        } finally { h.narrated.mockRestore(); h.db.close(); resetCultivationWorlds(); }
    }, 180_000);
}
