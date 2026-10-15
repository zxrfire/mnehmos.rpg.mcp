/**
 * Moving02 moved an actual departure occasion before body time, then returned
 * an executed receipt without completing a living turn. Its outer executor
 * could charge lesser time anyway. Named account arrivals also stopped in text
 * without reaching the native standing/gap-settled fight authority: the escort
 * deliberately excludes an account from its bandit branch.
 *
 * These are front-door boarding controls on the real seeded road-world. Only
 * the rare account/summons arrival sample is controlled; the offered duty,
 * actual ledger, named actor, accepted driver/carriage/fare and fight/death
 * effects use their native factories/resolvers. No encounter row or successful
 * outcome is injected, no other random stream is changed, and the requested
 * complete advertised journey is retained. A house with only a weak or strong
 * delegate sends its actual remaining delegate through whoAHouseSends; this
 * reaches native gap settlement without inventing a phantom combatant.
 * Root focused09: summons, standing fight and native death passed; the
 * surviving settlement fixture stayed in a real fight because player9 and
 * actor0 are both Qi Condensation. Ordinal distance is not major-realm gap.
 * Its replacement reads native realmIndexOf and HELPLESS_REALM_GAP to arrange
 * an actually categorical body gap. The final transport merge then placed the
 * real driver beside the passenger: these are group fights, which correctly
 * bypass a duel's instant gap shortcut. Boarding still spends no unasked time.
 * The two categorical cases now request actual rounds before asserting the
 * native survival/death conclusion; the driver is neither removed nor ignored.
 * The strong attacker also uses setRealm: changing only its ordinal left
 * 30 HP in a 1,280 HP body. It correctly guarded while critically hurt, which was
 * a different arrangement from the healthy attacker this control requires.
 */
import { expect, it, vi } from 'vitest';
import { appendFileSync } from 'node:fs';
import { makeGameInWorld, engineCalls } from './harness.js';
import * as random from '../../src/engine/cultivation/rng.js';
import * as windows from '../../src/engine/encounters/window.js';
import { HELPLESS_REALM_GAP } from '../../src/engine/cultivation/combat.js';
import { REALM_TIERS, realmIndexOf, maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';
import { createNpc, setRealm } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { createObligation } from '../../src/engine/social/grudges.js';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo.js';
import { whetherYouAreWorthTheTrouble } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import { accountsComingDue, whoAHouseSends } from '../../src/web/who-comes-to-settle-an-account.js';
import { whatRunsFromHere } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { readFlag, writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { FLAG_RATIONS_HELD } from '../../src/web/flag-keys.js';
import { readPendingSummons } from '../../src/web/pending-summons.js';
import { SECTS } from '../../src/data/cultivation/sects.js';

for (const scenario of ['summons', 'standing_fight', 'settled_surviving', 'settled_death'] as const) {
    it('executes ' + scenario + ' at actual boarding without unasked body time, then resolves requested rounds', async () => {
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
            const line = whatRunsFromHere(game, body, game.currentRun().run.elapsedDays)
                .find(row => row.service === 'carriage' && row.runsFromDay === null)!;
            expect(line).toBeDefined();
            expect(line.days).toBeGreaterThan(0);
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
                const actor = setRealm(createNpc(world.seed, { id: 'departure-account-holder', name: 'Departure account holder',
                    bornOnDay: world.currentDay - 40 * 365, onDay: world.currentDay, locationId: from.id,
                    factionId: house?.id ?? null }),
                    scenario === 'standing_fight' ? 14 : scenario === 'settled_death' ? 30 : 0,
                    routineTime(world));
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
            vi.spyOn(windows, 'encountersAtChecks').mockImplementation(function* (input, cadence): ReturnType<typeof windows.encountersAtChecks> {
                expect(cadence?.departureOccasion).toBe(true);
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
            const done = await game.act('I hire a carriage to ' + line.to);
            // Preserve native outcomes if this arrangement is preempted by a real
            // occasion. The runner chooses the ignored diagnostic destination.
            if (process.env.TRANSPORT_DEPARTURE_OBSERVATIONS) appendFileSync(process.env.TRANSPORT_DEPARTURE_OBSERVATIONS,
                JSON.stringify({ scenario, line, departure, departureWorld, phases,
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
            const receipt = world.history.facts.find(fact => fact.data.publicPassage === true
                && fact.data.service === 'carriage' && fact.actors.some(actor => actor.id === body.id));
            expect(receipt).toBeDefined();
            expect(receipt!.data.arrivalDay).toBeGreaterThan(receipt!.data.departureDay as number);
            expect(receipt!.data.vesselId).toEqual(expect.any(String));
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
                expect(game.fight?.party.id).toBe(actorId);
                const allyId = game.fight?.foregroundParty?.ally.id;
                expect(world.npcs.some(person => person.id === allyId
                    && person.tags.includes('crew-of:' + receipt!.data.vesselId)),
                    'the actual carriage driver stands with the passenger').toBe(true);
                expect(after.cultivator.alive).toBe(true);
                expect(after.run.turn).toBe(atDeparture.run.turn + 1);
                expect(readFlag(db, body.id, FLAG_RATIONS_HELD)).toBe('6');
                expect(engineCalls(done).some(call => call.name.startsWith('combat'))).toBe(true);
                // The selected sample and departure iterator observations end
                // with boarding. Requested rounds use their ordinary clock checks.
                vi.restoreAllMocks();
                const budget = game.fight!.state.roundBudget;
                let rounds = 0;
                while (game.fight && rounds < budget) {
                    await game.act('I strike');
                    rounds++;
                }
                expect(rounds).toBeGreaterThan(0);
                expect(game.fight).toBeNull();
                const concluded = game.currentRun();
                if (scenario === 'settled_death') {
                    expect(concluded.cultivator.alive).toBe(false);
                    expect(concluded.run.status).not.toBe('active');
                } else {
                    expect(concluded.cultivator.alive).toBe(true);
                    expect(concluded.run.turn).toBe(atDeparture.run.turn + 1 + rounds);
                    expect(readFlag(db, body.id, FLAG_RATIONS_HELD)).toBe('6');
                }
            }
        } finally { vi.restoreAllMocks(); db.close(); }
    }, 200_000);
}
