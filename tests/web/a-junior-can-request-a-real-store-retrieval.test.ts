/**
 * Review-only played regression, 2026-10-03. The direct store loan could work
 * only after an operator put a junior inside the sealed store. Retrieval must
 * instead begin through game.act at a real outside meeting with a real working
 * authorized member, then run through ordinary passHours at actual edge dates.
 * No test calls the leaf continuation or injects a successful final boundary.
 *
 * Arrangement is explicit: actual living rank-zero membership, a below-Lid
 * operator body, an existing receiver working at the accessible outside parent,
 * and existing house keys placed in that receiver's custody. It mints no actor,
 * key, object, room, approval or service. The store remains sealed; the player
 * never holds its key. The real finite object and canonical decision are chosen
 * from the generated world. This is not natural key-acquisition evidence.
 *
 * Successor fixture ruling, 2026-10-03: native stock diagnostics found 128
 * approved objects before the former inward-only >.125 filter. That filter
 * excluded 96 of 101 real store paths whose inward edge is .1 day. A .1 inward
 * + .1 return path is a real finite retrieval: pickup may occur during asking,
 * but .2-day delivery cannot complete in the .125-day request. Selection now
 * requires positive finite actual inward/return routes with their total above
 * the request span. No stock/approval/key/access or delivery assertion changes.
 * Diagnostic provenance: retrieval7-store-stock-route-diagnostic-runtime-
 * 20261003-01.log. This successor itself has not been compiled or run.
 *
 * These proposed checks require the reviewed common actual-clock adapter to be
 * integrated first. Scripted planning supplies the player's exact request only;
 * it cannot move stock or decide approval. Fresh SQLite location/standing must
 * govern delivery after time, including when the player leaves the meeting.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { pathTo, purposeOf, reachThrough } from '../../src/engine/world/architecture.js';
import { isTheWorldsToMove } from '../../src/engine/world/npc-state.js';
import { isRuined, isTracked, transferPossession } from '../../src/engine/world/possessions.js';
import { FALSE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { invitationEndsAt, routineOf, routineTime } from '../../src/engine/world/npc-routines.js';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { walkingRouteFrom } from '../../src/engine/world/locations.js';
import { theDoorKeysTheyActuallyCarry } from '../../src/web/the-door-keys-they-actually-carry.js';
import { readHouseStoreRequest, decisionForTheHouseStoreRequest } from '../../src/web/reading-a-house-store-request.js';
import { theRollsOf } from '../../src/web/walking-up-to-a-house.js';
import { passHours } from '../../src/web/routine-invitations.js';

async function atAnOutsideMeeting(seed: string) {
    const diagnostics: Record<string, number> = {};
    const note = (stage: string) => { diagnostics[stage] = (diagnostics[stage] ?? 0) + 1; };
    const plans: string[] = [];
    const h = await makeGameInWorld({ seed, worldSeed: 'ordinary-store-requests',
        provider: new ScriptedProvider({ plans, narrations: ['The actual scene.'] }) });
    const born = await h.game.newRun('Store Requester');
    const world = (await h.game.loadWorld())!;
    for (const house of world.factions.filter(f => f.dissolvedOnDay === null && h.repos.sects.getById(f.id))) {
        note('house');
        h.repos.sects.addMember(house.id, born.cultivator.id, 0);
        h.repos.cultivators.update(born.cultivator.id, { realmOrdinal: FALSE_IMMORTAL_ORDINAL });
        const playerRow = world.npcs.find(n => n.id === born.cultivator.id)!;
        playerRow.factionId = house.id;
        playerRow.factionRankIndex = 0;
        for (const store of world.locations.filter(r => r.controllingFactionId === house.id
            && r.sealed && typeof r.data.keyId === 'string' && purposeOf(r) !== null && r.parentId)) {
            note('sealed_store');
            const meeting = world.locations.find(r => r.id === store.parentId)!;
            if (reachThrough(pathTo(world.locations, meeting.id), {
                realmOrdinal: FALSE_IMMORTAL_ORDINAL, onDay: world.currentDay, keyIds: []
            }).stoppedAt !== null) continue;
            note('public_parent_access');
            const route = walkingRouteFrom(world.locations, meeting.id, store.id);
            const returnRoute = walkingRouteFrom(world.locations, store.id, meeting.id);
            const inward = route?.at(-1)?.days;
            const outward = returnRoute?.at(-1)?.days;
            // Pickup may legitimately occur during the .125-day request. The
            // actual finite round trip, not one inward edge, must remain unfinished.
            if (inward === undefined || outward === undefined || !Number.isFinite(inward)
                || !Number.isFinite(outward) || inward <= 0 || outward <= 0
                || inward + outward <= 0.125) continue;
            note('timed_route');
            const reading = readHouseStoreRequest(world, house, born.cultivator.id, purposeOf(store)!, theRollsOf(h.game));
            const object = world.objects.find(o => o.ownerId === house.id && o.locationId === store.id
                && o.possessorId === null && isTracked(o) && !isRuined(o) && o.data.spent !== true
                && (o.kind === 'artifact' || o.kind === 'manual') && !o.tags.includes('never-carried')
                && !o.tags.includes('conveyance') && !o.tags.includes('single-use')
                && decisionForTheHouseStoreRequest(reading, o, 'use_it_and_return_it', undefined, world.currentDay).allowed);
            if (!object) continue;
            note('native_permitted_object');
            for (const receiver of world.npcs.filter(n => n.status === 'alive' && reading.receivers.has(n.id))) {
                const hour = Array.from({ length: 24 }, (_, i) => i).find(i => {
                    world.currentHour = i;
                    const work = routineOf(world, receiver);
                    return !work.home && work.activity?.kind === 'the_work_of_their_rank'
                        && !receiver.activity?.redirect && !work.activity.thingId && !work.activity.withIds.length;
                });
                if (hour === undefined) continue;
                note('actual_working_receiver');
                const keyIds = pathTo(world.locations, store.id).filter(r => r.sealed)
                    .map(r => r.data.keyId).filter((id): id is string => typeof id === 'string');
                const keys = keyIds.map(id => world.objects.find(o => o.kind === 'key' && !isRuined(o)
                    && o.ownerId === house.id && (o.id === id || o.data.keyId === id)));
                if (keys.some(k => !k)) continue;
                note('existing_keys');
                if (reachThrough(pathTo(world.locations, store.id), { realmOrdinal: receiver.cultivation.realmOrdinal,
                    onDay: world.currentDay, keyIds }).stoppedAt !== null) continue;
                note('dated_keyed_access');
                for (const key of keys) {
                    const at = world.objects.findIndex(o => o.id === key!.id);
                    world.objects[at] = transferPossession(key!, { onDay: world.currentDay, toHolderId: receiver.id,
                        toHolderName: receiver.name, how: 'lent', transfersOwnership: false,
                        source: 'explicit operator fixture', factId: null });
                }
                receiver.locationId = meeting.id;
                h.repos.cultivators.update(born.cultivator.id, { location: meeting.name });
                h.repos.cultivators.standIn(born.cultivator.id, null);
                const area = theAreasOf(world, meeting).whereIs.get(receiver.id);
                expect(area, 'the actual working receiver occupies the accessible meeting').toBeDefined();
                h.repos.cultivators.standIn(born.cultivator.id, area!);
                h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(hour / 24, born.run.id);
                world.currentHour = hour;
                h.game.theWorldMoved();
                await h.game.loadWorld();
                // Refresh the normal played projection/known house after operator setup.
                await h.game.act('I look around');
                const body = h.repos.cultivators.getById(born.cultivator.id)!;
                expect(h.game.present(body).some(n => n.id === receiver.id)).toBe(true);
                expect(theDoorKeysTheyActuallyCarry(world.objects, body.id)).not.toContain(String(store.data.keyId));
                expect(reachThrough(pathTo(world.locations, store.id), { realmOrdinal: body.realmOrdinal,
                    onDay: world.currentDay, keyIds: [] }).stoppedAt).not.toBeNull();
                plans.push(JSON.stringify({ action: 'petition', intent: 'stock', target: house.name, topic: object.name }));
                return { ...h, house, store, meeting, object, receiver, body };
            }
        }
        h.repos.sects.removeMember(house.id, born.cultivator.id);
    }
    console.error('RETRIEVAL_PLAYED_NATIVE_SEARCH', JSON.stringify(diagnostics));
    throw new Error('No generated permissive store/receiver/key/public-parent arrangement was found.');
}

async function finishThroughOrdinaryTime(h: Awaited<ReturnType<typeof atAnOutsideMeeting>>) {
    // No synthetic leaf call, manual world clock, or arbitrary iteration cap.
    for (;;) {
        const world = h.game.atHand!;
        const carrier = world.npcs.find(n => n.id === h.receiver.id)!;
        if (!carrier.activity?.retrievalRequestId) return;
        const due = carrier.activity.untilDay;
        expect(due, 'this arranged readable-recipient journey has a real next boundary').not.toBeNull();
        const now = routineTime(world);
        expect(due!, 'next real edge must advance the actual clock').toBeGreaterThan(now);
        const current = h.game.currentRun();
        const result = await passHours(h.game, current.run,
            h.repos.cultivators.getById(h.body.id)!, (due! - now) * 24);
        expect(result.finished, result.spent?.facts.headline).toBe(true);
    }
}

it('a junior asks outside the sealed store and receives that same loan only after actual travel', async () => {
    const h = await atAnOutsideMeeting('outside-store-loan');
    const count = h.game.atHand!.objects.length;
    const turn = await h.game.act(`I ask ${h.house.name} to fetch ${h.object.name} for me to borrow`);
    expect(turn.toolCalls.some(c => c.name === 'world.physicalStoreRetrieval' && c.ok), turn.narration).toBe(true);
    expect(h.game.atHand!.objects.find(o => o.id === h.object.id)!.possessorId).not.toBe(h.body.id);
    await finishThroughOrdinaryTime(h);
    const same = h.game.atHand!.objects.find(o => o.id === h.object.id)!;
    expect(same.possessorId).toBe(h.body.id);
    expect(same.ownerId).toBe(h.house.id);
    expect(same.provenance.at(-1)?.how).toBe('lent');
    expect(h.game.atHand!.objects.length).toBe(count);
    expect(h.repos.cultivators.getById(h.body.id)!.location).toBe(h.meeting.name);
}, 120_000);

it('a fresh SQLite departure after acceptance prevents handover and stock physically returns', async () => {
    const h = await atAnOutsideMeeting('outside-store-left');
    const turn = await h.game.act(`I ask ${h.house.name} to fetch ${h.object.name} for me to borrow`);
    expect(turn.toolCalls.some(c => c.name === 'world.physicalStoreRetrieval' && c.ok), turn.narration).toBe(true);
    // Authoritative operator move after acceptance; no old Cultivator is passed to time.
    const elsewhere = h.game.atHand!.locations.find(r => r.id === h.house.seatLocationId)!;
    expect(elsewhere.id).not.toBe(h.meeting.id);
    h.repos.cultivators.update(h.body.id, { location: elsewhere.name });
    h.repos.cultivators.standIn(h.body.id, null);
    await finishThroughOrdinaryTime(h);
    const same = h.game.atHand!.objects.find(o => o.id === h.object.id)!;
    expect(same.possessorId).toBeNull();
    expect(same.ownerId).toBe(h.house.id);
    expect(same.locationId).toBe(h.store.id);
    expect(same.provenance.at(-1)?.note).toContain('Returned');
}, 120_000);


// Revision 7: these are real GameService spending paths, not calls to the
// retrieval leaf. A single held action crosses every inward/pickup/return
// deadline before it ends. A refusal or interruption remains diagnostic,
// rather than being replaced by a fabricated successful endpoint.
for (const activity of ['waiting', 'cultivating', 'seclusion'] as const) {
    it(`the same finite loan can arrive during ordinary ${activity}`, async () => {
        const h = await atAnOutsideMeeting(`store-during-${activity}`);
        const accepted = await h.game.act(`I ask ${h.house.name} to fetch ${h.object.name} for me to borrow`);
        expect(accepted.toolCalls.some(c => c.name === 'world.physicalStoreRetrieval' && c.ok), accepted.narration).toBe(true);
        const world = h.game.atHand!;
        const route = walkingRouteFrom(world.locations, h.meeting.id, h.store.id)!;
        const days = route.at(-1)!.days * 2 + 1;
        const current = h.game.currentRun();
        const fresh = h.repos.cultivators.getById(h.body.id)!;
        const before = current.run.elapsedDays;
        const ambient = h.game.ambientFor(fresh, current.run);
        const spent = activity === 'waiting'
            ? await h.game.shortSkip(current.run, fresh, ambient, 0, 'Waiting', days)
            : await h.game.runSeclusion(current.run, fresh, ambient, days,
                { sealed: activity === 'seclusion', acknowledged: true });
        expect(spent.outcome, spent.facts.headline).toBe('executed');
        expect(spent.cutShort, spent.facts.headline).toBeNull();
        expect(spent.timeSkip?.simulatedDays).toBeGreaterThan(0);
        const after = h.repos.runs.getById(current.run.id)!;
        expect(after.elapsedDays - before).toBeCloseTo(spent.timeSkip!.simulatedDays);
        const same = h.game.atHand!.objects.find(o => o.id === h.object.id)!;
        expect(same.possessorId).toBe(h.body.id);
        expect(same.ownerId).toBe(h.house.id);
        expect(same.provenance.at(-1)?.how).toBe('lent');
        expect(h.repos.cultivators.getById(h.body.id)!.location).toBe(h.meeting.name);
    }, 120_000);
}

// The real return reached the right precinct but its edge area, while the
// recipient remained in the accepted primary area (delivery-trace.json,
// retrieval7-delivery-boundaries-diagnostic-20261003; original16: 12 pass,
// four failed normal deliveries). Geography is not local co-location. These
// additional controls require the SAME canonical .25-day local movement,
// with custody retained until arrival and a fresh recipient-area read then.
// Original eleven pure and five played controls above remain unchanged.
async function reachTheActualLocalApproach(h: Awaited<ReturnType<typeof atAnOutsideMeeting>>) {
    for (;;) {
        const world = h.game.atHand!;
        const actor = world.npcs.find(n => n.id === h.receiver.id)!;
        const activity = actor.activity;
        expect(activity?.retrievalRequestId, 'a real carried loan must remain pending before approach').toBeTruthy();
        if (activity?.fromLocationId === h.meeting.id && activity.returnTo === h.meeting.id
            && activity.redirect?.standingIn) {
            expect(activity.untilDay! - activity.sinceDay).toBeCloseTo(LESSER_ACTION_DAYS.move);
            expect(world.objects.find(o => o.id === h.object.id)!.possessorId).toBe(actor.id);
            return { untilDay: activity.untilDay!, areaId: activity.redirect.standingIn };
        }
        const due = activity?.untilDay;
        expect(due, 'inward and return edges retain actual finite deadlines').not.toBeNull();
        expect(due!).toBeGreaterThan(routineTime(world));
        const current = h.game.currentRun();
        const advanced = await passHours(h.game, current.run, h.repos.cultivators.getById(h.body.id)!,
            (due! - routineTime(world)) * 24);
        expect(advanced.finished, advanced.spent?.facts.headline).toBe(true);
    }
}

it('same-ground delivery still carries the loan through a finite local approach before handover', async () => {
    const h = await atAnOutsideMeeting('outside-store-loan');
    const accepted = await h.game.act(`I ask ${h.house.name} to fetch ${h.object.name} for me to borrow`);
    expect(accepted.toolCalls.some(c => c.name === 'world.physicalStoreRetrieval' && c.ok), accepted.narration).toBe(true);
    const approach = await reachTheActualLocalApproach(h);
    const start = routineTime(h.game.atHand!);
    const current = h.game.currentRun();
    const half = await passHours(h.game, current.run, h.repos.cultivators.getById(h.body.id)!,
        (approach.untilDay - start) * 12);
    expect(half.finished, half.spent?.facts.headline).toBe(true);
    expect(h.game.atHand!.objects.find(o => o.id === h.object.id)!.possessorId).toBe(h.receiver.id);
    expect(routineTime(h.game.atHand!)).toBeLessThan(approach.untilDay);
    await finishThroughOrdinaryTime(h);
    const same = h.game.atHand!.objects.find(o => o.id === h.object.id)!;
    expect(same).toMatchObject({ possessorId: h.body.id, ownerId: h.house.id });
    expect(same.provenance.at(-1)?.how).toBe('lent');
}, 120_000);

it('a recipient moving to another actual area during the local approach receives no remote loan', async () => {
    const h = await atAnOutsideMeeting('outside-store-loan');
    const accepted = await h.game.act(`I ask ${h.house.name} to fetch ${h.object.name} for me to borrow`);
    expect(accepted.toolCalls.some(c => c.name === 'world.physicalStoreRetrieval' && c.ok), accepted.narration).toBe(true);
    const approach = await reachTheActualLocalApproach(h);
    const other = theAreasOf(h.game.atHand!, h.meeting).areas.find(a => a.id !== approach.areaId && a.for !== 'room');
    expect(other, 'the real approach precinct has another public area').toBeDefined();
    // Explicit operator movement of the authoritative SQL body during walking;
    // no captured body or world membership row stands in for current presence.
    h.repos.cultivators.standIn(h.body.id, other!.id);
    await finishThroughOrdinaryTime(h);
    expect(h.game.atHand!.objects.find(o => o.id === h.object.id)).toMatchObject({
        possessorId: null, ownerId: h.house.id, locationId: h.store.id
    });
}, 120_000);


it('an actually full accepted area cannot grant remote delivery or displace its current occupants', async () => {
    const h = await atAnOutsideMeeting('outside-store-loan');
    const accepted = await h.game.act(`I ask ${h.house.name} to fetch ${h.object.name} for me to borrow`);
    expect(accepted.toolCalls.some(c => c.name === 'world.physicalStoreRetrieval' && c.ok), accepted.narration).toBe(true);
    const world = h.game.atHand!;
    const recipient = h.repos.cultivators.getById(h.body.id)!;
    const area = recipient.standingIn!;
    expect(area).toBeTruthy();
    const carrier = world.npcs.find(n => n.id === h.receiver.id)!;
    expect(carrier.activity?.fromLocationId).not.toBe(carrier.activity?.returnTo);
    // Operator fixture: three EXISTING living ordinary people are arranged at
    // the actual public meeting before the carrier arrives. No new NPC/service,
    // key, approval, stock or area is minted. Ordering is selected only to let
    // the normal existing-occupant selector place these arrivals before this
    // carrier; the assertion below proves the actual three-person arrangement.
    const present = world.npcs.filter(n => n.status === 'alive' && n.id !== h.body.id
        && n.id !== h.receiver.id && n.id.localeCompare(h.receiver.id) < 0
        && isTheWorldsToMove(n))
        .sort((a, b) => a.id.localeCompare(b.id)).slice(0, 3);
    expect(present).toHaveLength(3);
    const ids = new Set(present.map(n => n.id));
    const now = routineTime(world);
    const until = invitationEndsAt({ currentDay: Math.floor(now + 1),
        currentHour: ((now + 1) - Math.floor(now + 1)) * 24 });
    world.npcs = world.npcs.map(n => !ids.has(n.id) ? n : { ...n, locationId: h.meeting.id,
        activity: { kind: 'the_work_of_their_rank', note: 'Operator fixture: present at the actual meeting.',
            withIds: [], sinceDay: now, redirect: { until, previous: null, standingIn: area } } });
    const before = theAreasOf(world, h.meeting);
    expect([...before.whereIs].filter(([id, at]) => ids.has(id) && at === area)).toHaveLength(3);
    h.game.theWorldMoved();
    await finishThroughOrdinaryTime(h);
    expect(h.game.atHand!.objects.find(o => o.id === h.object.id)).toMatchObject({
        possessorId: null, ownerId: h.house.id, locationId: h.store.id
    });
    const after = theAreasOf(h.game.atHand!, h.meeting);
    expect([...after.whereIs].filter(([id, at]) => ids.has(id) && at === area)).toHaveLength(3);
}, 120_000);
