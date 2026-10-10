/**
 * Source audit 2026-10-07: the played public counter quoted one head and only
 * the player id, even when canonical company named another actual body. Native
 * carriage and sponsored ship writers already accept real passengers and retain
 * their agreement; the played purchase did not ask them for the party. A later
 * ordinary arrival hook could then move an unbooked companion without a seat.
 * These are unrun behavioral controls, not measured acceptance. Existing world
 * bodies are arranged at an existing advertised counter, with an actual prior
 * finite agreement. Fellow passengers independently accept the native provider;
 * they do not join the party. The player buys through game.act. Real fare,
 * capacity, current physical course, retained membership and actual landfall
 * are observed from the current store. No minted NPC, vessel capacity, route,
 * bed, ownership or model prose is claimed. Boarding14's shared physical-body
 * availability helper is a frozen dependency, not a cloned filter.
 * Root-owned Public02 compiler passed. Native79713 stopped before its candidate
 * arm: unchanged public-carriages/public-shipping imports were required by a
 * coverage observer which recorded only overlay loads. The actual red reached
 * 4 failures / 14 passes, but the ship-positive failure was not boarding:
 * 'I buy seats on the ship' parsed ordinary buy, and the existing safety check
 * rejected the model passage route. Public03 keeps every runtime/assertion,
 * uses the existing supported 'I take the ship to <actual destination>' form,
 * and records actual transforms of the two unchanged pinned reader modules.
 * Its new red must reach genuine boarding before claiming a regression control.
 * Public03 remains uncompiled/unrun; original01/02 evidence stays frozen.
 * Public04 root-owned native80877 reached the intended four boarding failures
 * in red (4 failures / 14 passes); green reached 17 passes / 1 failure solely
 * on the capacity control's whole NPC equality. Public05 native30905 measured
 * selected NPC0 changing only historyFactIds, with physical company/course,
 * ground, life and currency intact; ordinary knowledge facts legitimately
 * enter that history. Public06 native98603 proved the real capacity boundary:
 * at the same departure instant and actual origin, the one-player native quote
 * succeeded and the actual two-body quote failed. Four native heads include
 * the actual driver and two independently booked passengers: one passenger
 * place remains, while this party requires two. The generic null summary had
 * incorrectly described that refusal as a vehicle elsewhere, without counts.
 * Public07 keeps the native seat/source calculations and exposes capacity
 * counts from their same pure resolver. It asserts the actual numbered refusal
 * and physical agreement/position/life/currency, rather than perception-history
 * bookkeeping. No reservation, fare, clock, ownership or boarding rule changes.
 * Public07's historical runner was unrun. These controls now run under plain
 * vitest. Bodies start at the actual counter before independently booking the
 * same imminent departure; walking to the counter is covered separately.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { prepareWorldClockForPreciseSpan, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { setLocation, setRealm, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state.js';
import { takeThemWithYou, whoTheyAreOutWith } from '../../src/engine/world/who-is-on-the-road-with-you.js';
import { publicTransportFrom } from '../../src/engine/world/public-transport-at-a-place.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { quotePublicCarriage, commitPublicCarriage, publicCarriagePassage } from '../../src/engine/world/public-carriages.js';
import { quotePublicPassage, onSponsoredPublicPassage } from '../../src/engine/world/public-shipping.js';
import { commitNpcPublicPassage } from '../../src/engine/world/ship-crew.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { stonesFor } from '../../src/engine/world/the-fare-and-calendar-of-a-passage.js';
import { journeyTimeHasReached, locationOnNpcJourney } from '../../src/engine/world/places-on-the-way.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';

async function scene(service: 'ship' | 'carriage', fellowCount: number, needsIndependentShip = false) {
    const plans: string[] = [];
    const h = await makeGameInWorld({ seed: 'precise-owned-ocean', worldSeed: 'precise-owned-ocean-world',
        provider: new ScriptedProvider({ plans, narrations: [] }) });
    await h.game.newRun('Journey passenger');
    const opened = h.game.currentRun();
    h.game.atHand = await prepareWorldClockForPreciseSpan(opened.run, opened.cultivator);
    const world = h.game.atHand, day = routineTime(world);
    const routes = world.locations.filter(place => place.kind === 'settlement').flatMap(from =>
        publicTransportFrom(world, from.name, day).filter(line => line.service === service && line.runsFromDay === null)
            .map(line => ({ from, to: worldLocationFor(world, line.to), line })));
    const route = routes.filter(row => row.to !== null && row.line.days > 2
        && (!needsIndependentShip || publicTransportFrom(world, row.from.name, day)
            .some(line => line.service === 'ship' && line.runsFromDay === null)))
        .sort((a, b) => a.line.days - b.line.days)[0];
    expect(route, 'existing world must supply the advertised native route').toBeDefined();
    const from = route!.from, to = route!.to!, line = route!.line;
    h.repos.cultivators.update(opened.cultivator.id, { location: from.name, standingIn: null,
        realmOrdinal: 29, hp: 100000, maxHp: 100000, spiritStones: 100000 });
    const body = h.game.currentRun().cultivator;
    const people = world.npcs.filter(npc => npc.status === 'alive' && !npc.tags.includes(PLAYER_ROW_TAG)).slice(0, fellowCount + 1);
    expect(people).toHaveLength(fellowCount + 1);
    for (const person of people) world.npcs[world.npcs.findIndex(row => row.id === person.id)] = {
        ...setRealm(setLocation(person, from.id, day), 29, day), activity: null };
    const member = people[0]!, fellows = people.slice(1);
    const memberAt = world.npcs.findIndex(row => row.id === member.id);
    world.npcs[memberAt] = takeThemWithYou(world.npcs, { party: [{ id: member.id, name: member.name }],
        leaderId: body.id, note: 'An existing agreement to travel together.', onDay: day, untilDay: day + 365 })[0]!;
    // Everybody who catches this exact departure is already at its real counter.
    const area=theAreasOf(world,from).areas.find(one=>one.for===(service==='ship'?'landing':'carriage_station'))!;
    expect(area).toBeDefined();h.repos.cultivators.standIn(body.id,area.id);
    for(const person of people){const at=world.npcs.findIndex(one=>one.id===person.id);
        world.npcs[at]={...world.npcs[at]!,activity:{kind:'idle',note:'At the boarding counter.',withIds:[],sinceDay:day,untilDay:null,
            ...world.npcs[at]!.activity,standingIn:area.id}};}
    for (const person of people) h.game.theyGaveTheirName(body, h.game.currentRun().run, person);
    if (fellows.length > 0) {
        if (service === 'carriage') {
            const quote = quotePublicCarriage(world, { fromId: from.id, toId: to.id, day,
                conveyanceId: 'conv-carriage-mortal', passengerIds: fellows.map(person => person.id),
                fareStones: stonesFor(line.cashPerSeat) * fellows.length, hired: false });
            expect(quote).not.toBeNull(); expect(commitPublicCarriage(world, quote!)).not.toBeNull();
        } else {
            const quote = quotePublicPassage(world, from.id, to.id, day, fellows.length, [],
                `${opened.run.seed}:${Math.floor(opened.run.elapsedDays)}`);
            expect(quote).not.toBeNull();
            for (const person of fellows) {
                const at = world.npcs.findIndex(row => row.id === person.id);
                world.npcs[at] = onSponsoredPublicPassage(world, world.npcs[at]!, quote!, 'Their independently paid public passage.')!;
                expect(commitNpcPublicPassage(world, world.npcs[at]!)).toBe(true);
            }
        }
    }
    h.game.theWorldMoved();
    return { ...h, plans, from, to, line, member, fellows };
}

for (const service of ['carriage', 'ship'] as const) it(`the played ${service} counter books two agreed bodies beside actual fellow passengers`, async () => {
    const h = await scene(service, service === 'carriage' ? 1 : 2);
    const narrated = vi.spyOn(h.narrator, 'narrate');
    const nativeMoved = h.game.theWorldMoved.bind(h.game);
    const acceptedBodies: { receiptId: string; vesselId: unknown; body: unknown; member: unknown; party: string[] }[] = [];
    const movedBoundary = vi.spyOn(h.game, 'theWorldMoved').mockImplementation(() => {
        const world = h.game.atHand!;
        const receipt = world.history.facts.find(fact => fact.data.publicPassage === true
            && fact.data.runId === h.game.currentRun().run.id && fact.actors.some(actor => actor.id === h.member.id));
        const member = world.npcs.find(person => person.id === h.member.id)!;
        if (receipt && member.activity?.kind === 'travelling') acceptedBodies.push({ receiptId: receipt.id,
            vesselId: receipt.data.vesselId, body: structuredClone(h.game.currentRun().cultivator),
            member: structuredClone(member), party: h.game.whoIsWithYouOnTheRoad(h.game.currentRun().cultivator).map(person => person.id) });
        return nativeMoved();
    });
    try {
        const before = h.game.currentRun();
        h.plans.push(JSON.stringify({ action: 'passage', intent: 'buy', target: h.to.name, topic: service }));
        const result = await h.game.act(service === 'ship'
            ? `I take the ship to ${h.to.name}.` : `I buy seats on the carriage to ${h.to.name}.`);
        expect(result.toolCalls.some(call => !call.ok && !call.name.startsWith('narrator.')), JSON.stringify(result.toolCalls)).toBe(false);
        // Arriving at a city that matters, the Jade Register enters you at its gate for the year's fee.
        const atTheGate = h.game.atHand!.history.facts.filter(fact => fact.data.gateRegistrant === before.cultivator.id)
            .reduce((sum, fact) => sum + Number(fact.data.stones ?? 0), 0);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones - stonesFor(h.line.cashPerSeat) * 2 - atTheGate);
        const world = h.game.atHand!;
        const receipt = world.history.facts.find(fact => fact.data.publicPassage === true && fact.data.runId === before.run.id
            && fact.data.fromLocationId === h.from.id && fact.data.toLocationId === h.to.id
            && fact.actors.some(actor => actor.id === h.member.id));
        expect(receipt, 'the played booking accepts the actual agreed body').toBeDefined();
        const admitted = acceptedBodies.find(row => row.receiptId === receipt!.id);
        expect(admitted, 'before spending the journey, the accepted native body is physically on this hull').toBeDefined();
        const boarded = admitted!.member as typeof h.member;
        expect(boarded.activity?.vesselId).toBe(receipt!.data.vesselId);
        expect(boarded.activity?.fromLocationId).toBe(h.from.id);
        expect(boarded.activity?.returnTo).toBe(h.to.id);
        expect(boarded.activity?.sinceDay).toBe(receipt!.data.departureDay);
        expect(boarded.activity?.untilDay).toBe(receipt!.data.arrivalDay);
        expect(admitted!.party).toContain(h.member.id); for (const fellow of h.fellows) expect(admitted!.party).not.toContain(fellow.id);
        const arrival = Number(receipt!.data.arrivalDay);
        for (let attempts = 0; attempts < 8 && !journeyTimeHasReached(routineTime(h.game.atHand!), arrival); attempts++) {
            const now = h.game.currentRun();
            const moved = await passHours(h.game, now.run, now.cultivator, (arrival - routineTime(h.game.atHand!)) * 24);
            expect(moved.spent?.outcome, JSON.stringify(moved.spent)).toBe('executed');
        }
        expect(journeyTimeHasReached(routineTime(h.game.atHand!), arrival)).toBe(true);
        const current = h.game.currentRun(), actual = h.game.atHand!, day = routineTime(actual);
        const carrier = service === 'carriage' ? publicCarriagePassage(actual, receipt!.id, current.cultivator.id, day)
            : shipPassengerAt(actual, receipt!.id, day);
        expect(carrier?.arrived).toBe(true);
        expect(current.cultivator.location).toBe(h.to.name);
        const member = actual.npcs.find(person => person.id === h.member.id)!;
        expect(member.status).toBe('alive'); expect(locationOnNpcJourney(actual.locations, member, day)).toBe(h.to.id);
        expect(whoTheyAreOutWith(member, day)?.withIds).toContain(current.cultivator.id);
        const ids = h.game.whoIsWithYouOnTheRoad(current.cultivator).map(person => person.id);
        expect(ids).toContain(h.member.id);
        for (const fellow of h.fellows) expect(ids).not.toContain(fellow.id);
        narrated.mockClear(); h.plans.push(JSON.stringify({ action: 'status' })); await h.game.act('I check my status.');
        const facts = narrated.mock.calls.at(-1)![0];
        const party = facts.lines.filter(line => line.includes('on the road with you')).join('\n');
        expect(party).toContain(h.member.name); for (const fellow of h.fellows) expect(party).not.toContain(fellow.name);
    } finally { movedBoundary.mockRestore(); narrated.mockRestore(); h.db.close(); resetCultivationWorlds(); }
}, 180_000);

it('an actual carriage with two independently booked passengers refuses two more agreed bodies before payment', async () => {
    const h = await scene('carriage', 2);
    try {
        const before = h.game.currentRun(), member = structuredClone(h.game.atHand!.npcs.find(person => person.id === h.member.id)!);
        const receipts = h.game.atHand!.history.facts.filter(fact => fact.data.publicPassage === true).map(fact => fact.id);
        h.plans.push(JSON.stringify({ action: 'passage', intent: 'buy', target: h.to.name, topic: 'carriage' }));
        const result = await h.game.act(`I buy seats on the carriage to ${h.to.name}.`);
        expect(result.toolCalls.some(call => call.name === 'engine.publicCarriage' && !call.ok)).toBe(true);
        const capacity = result.toolCalls.find(call => call.name === 'engine.publicCarriage' && !call.ok)!;
        expect(capacity.summary, 'the actual refusal names the native remaining capacity').toContain('1 passenger place');
        expect(capacity.summary, 'the actual refusal names both requested bodies').toContain('2 passengers');
        expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        const afterMember = h.game.atHand!.npcs.find(person => person.id === h.member.id)!;
        expect({ activity: afterMember.activity, locationId: afterMember.locationId, status: afterMember.status,
            spiritStones: afterMember.spiritStones, cultivation: afterMember.cultivation,
            bodyId: afterMember.bodyId, soulState: afterMember.soulState, diedOnDay: afterMember.diedOnDay })
            .toEqual({ activity: member.activity, locationId: member.locationId, status: member.status,
                spiritStones: member.spiritStones, cultivation: member.cultivation,
                bodyId: member.bodyId, soulState: member.soulState, diedOnDay: member.diedOnDay });
        expect(h.game.atHand!.history.facts.filter(fact => fact.data.publicPassage === true).map(fact => fact.id)).toEqual(receipts);
    } finally { h.db.close(); resetCultivationWorlds(); }
}, 180_000);

it('a played public carriage booking cannot summon an agreed body from their independently accepted ship', async () => {
    const h = await scene('carriage', 0, true);
    try {
        const world = h.game.atHand!, day = routineTime(world);
        const at = world.npcs.findIndex(person => person.id === h.member.id);
        const route = publicTransportFrom(world, h.from.name, day).filter(line => line.service === 'ship' && line.runsFromDay === null)
            .map(line => worldLocationFor(world, line.to)).flatMap(to => to ? [quotePublicPassage(world, h.from.id, to.id, day)] : [])
            .find(quote => quote !== null);
        expect(route, 'the existing counter has a real independent hull').toBeDefined();
        world.npcs[at] = onSponsoredPublicPassage(world, world.npcs[at]!, route!, 'Their independent actual ship passage.')!;
        expect(commitNpcPublicPassage(world, world.npcs[at]!)).toBe(true); h.game.theWorldMoved();
        const before = h.game.currentRun(), member = structuredClone(world.npcs[at]!);
        const receipts = world.history.facts.filter(fact => fact.data.publicPassage === true).map(fact => fact.id);
        h.plans.push(JSON.stringify({ action: 'passage', intent: 'buy', target: h.to.name, topic: 'carriage' }));
        const result = await h.game.act(`I buy seats on the carriage to ${h.to.name}.`);
        expect(result.toolCalls.some(call => call.name === 'engine.actualPartyBoarding' && !call.ok)).toBe(true);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(h.game.atHand!.npcs.find(person => person.id === h.member.id)).toEqual(member);
        expect(h.game.atHand!.history.facts.filter(fact => fact.data.publicPassage === true).map(fact => fact.id)).toEqual(receipts);
    } finally { h.db.close(); resetCultivationWorlds(); }
}, 180_000);
