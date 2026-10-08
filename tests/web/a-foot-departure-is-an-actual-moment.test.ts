/** Foot travel formerly selected its whole encounter window at departure,
 * then made even a day-zero interruption spend a day before resolving its fight.
 * These four controls reuse the already verified native public-passage zero
 * arrangements: only the rare account/summons arrival sample is controlled.
 * Actual houses, ledger accounts, named actors, body gap, fight/death and SQL
 * authority are unchanged. The admitted eight-day foot road remains whole;
 * its zero interruption retains the single physical cursor and historical
 * acceptance moment, with no body age, food, clock or duplicate turn charge.
 * A living settled fight must not remain standing; native death closes the run.
 * The actual zero-stopped summons then resumes that same crossing: a fresh
 * action must not replay its departure occasion. Candidate controls pending
 * root verification, no passing claim.
 */
import { expect, it, vi } from 'vitest';
import { appendFileSync } from 'node:fs';
import { makeGameInWorld, engineCalls } from './harness.js';
import * as random from '../../src/engine/cultivation/rng.js';
import * as windows from '../../src/engine/encounters/window.js';
import { HELPLESS_REALM_GAP } from '../../src/engine/cultivation/combat.js';
import { REALM_TIERS, realmIndexOf, maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { createObligation } from '../../src/engine/social/grudges.js';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo.js';
import { whetherYouAreWorthTheTrouble } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import { accountsComingDue, whoAHouseSends } from '../../src/web/who-comes-to-settle-an-account.js';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';
import { stoppedRoadFor } from '../../src/web/a-road-stopped-partway.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { readFlag, writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { FLAG_RATIONS_HELD } from '../../src/web/flag-keys.js';
import { readPendingSummons } from '../../src/web/pending-summons.js';
import { SECTS } from '../../src/data/cultivation/sects.js';

for (const scenario of ['summons', 'standing_fight', 'settled_surviving', 'settled_death'] as const) {
    it('executes ' + scenario + ' at actual foot departure without unasked body time or duplicate completion', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'departure-authority-control', worldSeed: 'road-world' });
        try {
            await game.newRun('Departure passenger');
            const initial = game.currentRun();
            const ordinal = scenario === 'settled_surviving'
                ? REALM_TIERS.find(tier => realmIndexOf(tier.ordinalStart) - realmIndexOf(0) >= HELPLESS_REALM_GAP)!.ordinalStart
                : 9;
            const hp = maxHpForOrdinal(initial.cultivator.attributes.might, ordinal);
            game.repos.cultivators.update(initial.cultivator.id, { realmOrdinal: ordinal, location: 'Emerald Water City',
                standingIn: null, hp: scenario === 'settled_death' ? 1 : hp, maxHp: hp, spiritStones: 1000 });
            game.atHand = await prepareWorldClockForPreciseSpan(game.currentRun().run, game.currentRun().cultivator);
            const world = game.atHand;
            const body = game.currentRun().cultivator;
            const from = worldLocationFor(world, body.location)!;
            expect(from).not.toBeNull();
            const to = makeLocation({ id: 'foot-zero-target', name: 'Plain destination', kind: 'wilds' });
            linkLocations(from, to, 'road', 8); world.locations.push(to);
            game.noteEncounter(body, game.currentRun().run, {kind:'place', id:to.name, name:to.name},
                'told', 'An actual eight-day road leads there.');
            writeFlag(db, body.id, FLAG_RATIONS_HELD, '6');
            let actorId: string | null = null;
            if (scenario === 'summons') {
                const sect = SECTS.filter(row => row.recruits && row.admissionOrdinal <= ordinal)
                    .sort((a, b) => a.admissionOrdinal - b.admissionOrdinal)[0]!;
                expect(sect).toBeDefined();
                game.repos.sects.addMember(sect.id, body.id, Math.floor(game.currentRun().run.elapsedDays));
                game.repos.cultivators.update(body.id, { sectId: sect.id });
            } else {
                const house = scenario === 'standing_fight' ? null : game.repos.sects.list().find(row =>
                    whetherYouAreWorthTheTrouble({ theirOrdinal: row.powerOrdinal, yourOrdinal: ordinal }) === 'worth_mounting');
                if (scenario !== 'standing_fight') expect(house).toBeDefined();
                // Arrange actual resources, rather than substituting a body in the fight resolver.
                if (house) for (const person of world.npcs) if (person.factionId === house.id) person.factionId = null;
                const actor = createNpc(world.seed, { id: 'departure-account-holder', name: 'Departure account holder',
                    bornOnDay: world.currentDay - 40 * 365, onDay: world.currentDay, locationId: from.id,
                    factionId: house?.id ?? null });
                actor.cultivation.realmOrdinal = scenario === 'standing_fight' ? 14 : scenario === 'settled_death' ? 30 : 0;
                actor.cultivation.techniqueIds = [];
                world.npcs.push(actor); actorId = actor.id;
                if (house) expect(whoAHouseSends(world, house.id, ordinal, body.id)?.id).toBe(actor.id);
                writeOneObligation(db as never, createObligation({ kind: 'grudge', holderId: house?.id ?? actor.id,
                    subjectId: body.id, cause: 'humiliation', severity: 'unforgivable',
                    onDay: Math.floor(game.currentRun().run.elapsedDays), description: 'An actual open account at departure.' }));
                expect(accountsComingDue(game, game.currentRun().cultivator).some(account => account.sent.id === actor.id)).toBe(true);
            }
            game.theWorldMoved();
            const nativeStream = random.forStream;
            vi.spyOn(random, 'forStream').mockImplementation((seed, stream, ...parts) => {
                const result = nativeStream(seed, stream, ...parts);
                if (parts[1] === 'occasion' && stream === (scenario === 'summons' ? 'enc.summons' : 'enc.account'))
                    vi.spyOn(result, 'next').mockReturnValue(0);
                return result;
            });
            const nativeChecks = windows.encountersAtChecks;
            let departure: ReturnType<typeof game.currentRun> | null = null;
            let departureWorld = -1;
            const phases: unknown[] = [];
            const admissions: (boolean | undefined)[] = [];
            vi.spyOn(windows, 'encountersAtChecks').mockImplementation(function* (input, cadence): ReturnType<typeof windows.encountersAtChecks> {
                admissions.push(cadence?.departureOccasion);
                if (admissions.length === 1) expect(cadence?.departureOccasion).toBe(true);
                departure = game.currentRun(); departureWorld = routineTime(game.atHand!);
                const iterator = nativeChecks(input, cadence);
                let next = iterator.next();
                while (!next.done) {
                    phases.push(next.value);
                    const reply: Parameters<typeof nativeChecks>[0] | undefined = yield next.value;
                    next = iterator.next(reply);
                }
                return next.value;
            });
            const done = await game.act('I travel to ' + to.name);
            if (scenario === 'settled_surviving') {
                const actualActor = game.atHand!.npcs.find(person => person.id === actorId);
                console.error('NATIVE_DEPARTURE_GAP', JSON.stringify({ scenario,
                    playerOrdinal: ordinal, playerRealm: realmIndexOf(ordinal),
                    actorOrdinal: actualActor?.cultivation.realmOrdinal,
                    actorRealm: actualActor ? realmIndexOf(actualActor.cultivation.realmOrdinal) : null,
                    requiredRealmGap: HELPLESS_REALM_GAP, fight: game.fight,
                    after: game.currentRun(), toolCalls: done.toolCalls }));
            }
            // Preserve native outcomes if this arrangement is preempted by a real
            // occasion. The runner chooses the ignored diagnostic destination.
            if (process.env.TRANSPORT_DEPARTURE_OBSERVATIONS) appendFileSync(process.env.TRANSPORT_DEPARTURE_OBSERVATIONS,
                JSON.stringify({ scenario, to: to.name, departure, departureWorld, phases,
                    after: game.currentRun(), worldNow: routineTime(game.atHand!), fight: game.fight,
                    receipts: world.history.facts.filter(fact => fact.data.publicPassage === true
                        && fact.actors.some(actor => actor.id === body.id)), toolCalls: done.toolCalls }) + '\n');
            expect(departure, JSON.stringify(done.toolCalls)).not.toBeNull();
            const atDeparture = departure as unknown as ReturnType<typeof game.currentRun>;
            const after = game.currentRun();
            expect(after.run.elapsedDays).toBe(atDeparture.run.elapsedDays);
            expect(routineTime(game.atHand!)).toBe(departureWorld);
            expect(after.cultivator.age).toBe(atDeparture.cultivator.age);
            expect(engineCalls(done).some(call => call.name === 'engine.lesserActionTime')).toBe(false);
            const cursor = stoppedRoadFor(db, after.cultivator);
            expect(cursor?.to).toBe(to.name);
            expect(cursor?.walked).toBe(0);
            expect(cursor?.position).toMatchObject({ kind:'place', locationId:from.id });
            expect(cursor?.acceptedMoment).toEqual({ runId:atDeparture.run.id,
                elapsedDays:atDeparture.run.elapsedDays, boardedOnDay:departureWorld });
            if (scenario === 'summons') {
                expect(readPendingSummons(game.repos, body.id)).not.toBeNull();
                expect(after.cultivator.alive).toBe(true);
                expect(after.run.turn).toBe(atDeparture.run.turn + 1);
                expect(readFlag(db, body.id, FLAG_RATIONS_HELD)).toBe('6');
            } else if (scenario === 'standing_fight') {
                expect(game.fight?.party.id).toBe(actorId);
                expect(after.cultivator.alive).toBe(true);
                expect(after.run.turn).toBe(atDeparture.run.turn + 1);
                expect(readFlag(db, body.id, FLAG_RATIONS_HELD)).toBe('6');
            } else {
                expect(game.fight).toBeNull();
                expect(engineCalls(done).some(call => call.name.startsWith('combat'))).toBe(true);
                if (scenario === 'settled_death') {
                    expect(after.cultivator.alive).toBe(false);
                    expect(after.run.status).not.toBe('active');
                } else {
                    expect(after.cultivator.alive).toBe(true);
                    expect(after.run.turn).toBe(atDeparture.run.turn + 1);
                    expect(readFlag(db, body.id, FLAG_RATIONS_HELD)).toBe('6');
                }
            }
            if (scenario === 'summons') {
                const firstMoment = cursor!.acceptedMoment;
                await game.act('I travel to ' + to.name);
                expect(admissions).toEqual([true, false]);
                // This second actual action continues the accepted zero-stopped
                // crossing. Its initial occasion is not replayed on the new turn.
                const onward = stoppedRoadFor(db, game.currentRun().cultivator);
                if (onward) expect(onward.acceptedMoment).toEqual(firstMoment);
            }
        } finally { vi.restoreAllMocks(); db.close(); }
    }, 200_000);
}
