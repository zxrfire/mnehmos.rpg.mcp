/**
 * The audit found offer-shaped Dao reads with no transaction, scout lore with
 * no children placed, and rumours with no planner. The scheduled passes run on
 * their actual dates; a person in the affected area is considered exactly,
 * while distant world business is a bounded background draw. These arrangements
 * put the player beside the visitor or decider, then isolate the records each
 * foreground pass owes.
 * The run3 trace found whole-day mortal spans omitting opening-clock promotion:
 * unobserved catch-up then crossed the admission date. The shared span now
 * prepares that clock, and these fixtures use its real dated area. Manual,
 * purse, admission and probation assertions remain unchanged.
 * Talent remains the child's rolled fact; probation is not membership.
 * Removing the three yearly writers made all four tests fail. Restoring those
 * writes passed in the same command against the same pinned world.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { createNpc, isTheWorldsToMove } from '../../src/engine/world/npc-state.js';
import { groundAtLocation, daoGroundsAround, daoGroundsInReachOf, standingOfNpc, DAO_GROUND_TAG } from '../../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import { feeForSittingOn, whatTheyCouldWriteOutForAHouse } from '../../src/engine/world/what-a-house-asks-of-somebody-not-of-it.js';
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';
import { roadsWalkedBy } from '../../src/engine/cultivation/what-a-road-in-reach-costs-to-walk.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { makeFact, fillConsequences } from '../../src/engine/world/history.js';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { whereCompoundsAre, whereTheyAreStanding } from '../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { isPlayerInvolved, resolveWithPlayerPresent } from '../../src/engine/world/background-incident-draw.js';
import { circulating, circulationLookup, whereThisPersonIsStanding } from '../../src/engine/world/what-people-are-saying.js';
import { portfoliosIn } from '../../src/engine/social-leverage/authority-for-an-order.js';
import { whatTheyHold } from '../../src/engine/social-leverage/what-an-elder-is-in-charge-of.js';

async function game(seed: string) {
    const h = await makeGameInWorld({ seed, worldSeed: 'documented-world-plans' });
    const opened = await h.game.newRun('Observer');
    return { ...h, ...opened, world: h.game.atHand! };
}

/** The next actual annual task date; day one is not a task from every opening clock. */
function nextAnnualTaskDay(worldDay: number, dayInYear = 1): number {
    const year = Math.floor(worldDay / 365);
    const thisYear = year * 365 + dayInYear;
    return thisYear > worldDay ? thisYear : thisYear + 365;
}

/**
 * Put the live player in the exact area the scheduled person will occupy when
 * the pass runs. Native task dates include their actual hour; an integer
 * date is midnight, rather than the opening's previous08:00 snapshot.
 */
function standWith(
    h: Awaited<ReturnType<typeof game>>,
    person: { id: string; locationId: string | null },
    onDay: number
) {
    const world = h.game.atHand!;
    const taskState = { ...world, currentDay: onDay, currentHour: (onDay - Math.floor(onDay)) * 24 };
    const scheduledPerson = taskState.npcs.find(row => row.id === person.id)!;
    const compounds = whereCompoundsAre(taskState);
    const actualPlaceId = whereTheyAreStanding(taskState, compounds, scheduledPerson,
        new Set(taskState.npcs.map(row => row.id)));
    const place = taskState.locations.find(row => row.id === actualPlaceId);
    expect(place, 'the scheduled person has no actual place').toBeDefined();
    const area = theAreasOf(taskState, place!).whereIs.get(scheduledPerson.id);
    expect(area, 'the scheduled person has no actual area').toBeDefined();
    h.repos.cultivators.update(h.cultivator.id, { location: place!.name });
    // `standingIn` is its own persisted flag.  A place change clears it, so
    // write the actual area through the flag's single owner before the
    // foreground scheduled pass reads the player.
    h.repos.cultivators.standIn(h.cultivator.id, area!);
    return { taskState, place: place!, areaId: area! };
}

describe('the yearly pass reached by waiting', () => {
    it('delivers an ordinary manual as barter rather than treating a known art as an admission', async () => {
        const h = await game('a-bartering-visitor');
        const worldDayBeforeWait = Math.floor(h.world.currentDay);
        const runDayBeforeWait = h.game.currentRun().run.elapsedDays;
        const place = h.world.locations.find(l => groundAtLocation(l)?.admits === 'a copy')!;
        const ground = groundAtLocation(place)!;
        const ordinal = Math.max(20, ground.fromOrdinal);
        const art = TECHNIQUES.find(t => whatTheyCouldWriteOutForAHouse(ground.heldByFactionId!, ordinal, [t.id])
            && !roadsWalkedBy({ knownTechniques: [t.id], age: 30 }).some(r => r.domain === ground.domain))!;
        expect(art).toBeDefined();
        const visitor = createNpc(h.world.seed, { id: 'bartering-visitor', name: 'Copyist',
            bornOnDay: h.world.currentDay - 30 * 365, onDay: h.world.currentDay });
        visitor.locationId = place.id;
        visitor.cultivation.realmOrdinal = ordinal;
        visitor.cultivation.techniqueIds = [art.id];
        const keeper = createNpc(h.world.seed, { id: 'barter-keeper', name: 'Keeper',
            bornOnDay: h.world.currentDay - 30 * 365, onDay: h.world.currentDay });
        keeper.factionId = ground.heldByFactionId;
        keeper.locationId = h.world.factions.find(f => f.id === ground.heldByFactionId)!.seatLocationId;
        keeper.cultivation.realmOrdinal = 3;
        keeper.factionRankIndex = 0;
        keeper.activity = { kind: 'the_work_of_their_rank', note: 'Receiving visitors at the gate.',
            withIds: [], sinceDay: h.world.currentDay, untilDay: null };
        const player = h.world.npcs.find(npc => npc.id === h.cultivator.id)!;
        expect(player, 'the world retains the played person for exact foreground work').toBeDefined();
        h.world.npcs = [player, visitor, keeper];
        h.world.locations = h.world.locations.filter(l => l.id === place.id || !l.tags.includes(DAO_GROUND_TAG));
        expect(daoGroundsInReachOf(h.world, visitor).some(g => g.sourceId === place.id)).toBe(false);
        h.game.theWorldMoved();
        const taskDay = nextAnnualTaskDay(worldDayBeforeWait);
        const atTask = standWith(h, visitor, taskDay);
        expect(resolveWithPlayerPresent(atTask.taskState, {
            person: atTask.taskState.npcs.find(npc => npc.id === h.cultivator.id)!,
            placeId: atTask.place.id, areaId: atTask.areaId
        }, () => isPlayerInvolved(atTask.taskState,
            atTask.taskState.npcs.find(npc => npc.id === visitor.id)!), taskDay),
        'the visitor is exact at the dated road-comprehension pass').toBe(true);
        // Road comprehension owns admission on day 1. The later day-121 dao
        // stint ends a visit; it does not admit one.
        const waited = await h.game.act('I wait one day');
        // An act reloads the persisted world before advancing it.  The fixture
        // object above is the pre-wait world, so read the year's receipts from
        // the engine's current world rather than a second, stale copy.
        const after = h.game.atHand!;
        const receipt = after.history.facts.find(f => f.data.daoAdmission === true && f.data.visitorId === visitor.id)!;
        expect(receipt, JSON.stringify({
            worldDayBeforeWait, worldDayAfterWait: Math.floor(after.currentDay),
            runDayBeforeWait, runDayAfterWait: h.game.currentRun().run.elapsedDays,
            nextRoadTaskDay: nextAnnualTaskDay(worldDayBeforeWait),
            waitCalls: waited.toolCalls, visitor: after.npcs.find(n => n.id === visitor.id)
        })).toBeDefined();
        const copy = after.objects.find(o => o.data.writtenOutBy === visitor.id && o.data.techniqueId === art.id)!;
        expect(copy.kind).toBe('manual');
        expect(copy.possessorId).toBe(ground.heldByFactionId);
        expect(copy.data.copies).toBe(1);
        expect(after.npcs.find(n => n.id === visitor.id)!.cultivation.techniqueIds).toContain(art.id);
        expect(receipt.data.stones).toBe(0);
    }, 120_000);

    it('charges an NPC visitor and credits the other house before admitting them to Dao ground', async () => {
        const h = await game('a-paid-visitor');
        const worldDayBeforeWait = Math.floor(h.world.currentDay);
        const runDayBeforeWait = h.game.currentRun().run.elapsedDays;
        const today = h.world.currentDay;
        const place = h.world.locations.find(l => groundAtLocation(l)?.admits === 'a fee')!;
        const ground = groundAtLocation(place)!;
        const house = h.world.factions.find(f => f.id === ground.heldByFactionId)!;
        const fee = feeForSittingOn(ground.fromOrdinal);
        expect(fee, 'this ground actually admits visitors for a fee').not.toBeNull();
        const visitor = { ...createNpc(h.world.seed, { id: 'paid-visitor', name: 'Guest',
            bornOnDay: today - 20 * 365, onDay: today }), locationId: place.id,
            spiritStones: fee! + 1 };
        visitor.cultivation.realmOrdinal = ground.fromOrdinal;
        visitor.cultivation.techniqueIds = [];
        const keeper = createNpc(h.world.seed, { id: 'fee-keeper', name: 'Keeper', bornOnDay: today - 30 * 365, onDay: today });
        keeper.factionId = house.id;
        keeper.locationId = house.seatLocationId;
        keeper.cultivation.realmOrdinal = 3;
        keeper.factionRankIndex = 0;
        keeper.activity = { kind: 'the_work_of_their_rank', note: 'Receiving visitors at the gate.',
            withIds: [], sinceDay: today, untilDay: null };
        const player = h.world.npcs.find(npc => npc.id === h.cultivator.id)!;
        expect(player, 'the world retains the played person for exact foreground work').toBeDefined();
        h.world.npcs = [player, visitor, keeper];
        const gate = daoGroundsAround(h.world, standingOfNpc(h.world, visitor))
            .find(row => row.sourceId === place.id)!;
        expect(gate.standing).toEqual(expect.objectContaining({
            // The gate judges an offered fee from the purse in hand.  Admission
            // remains a recorded transaction below; this says the visitor can
            // genuinely offer its exact price, rather than being made eligible
            // by the test after the fact.
            knowsWhereItIs: true, inReach: true, shortBy: null
        }));
        expect(keeper.locationId, 'the receiving person is at the house seat').toBe(house.seatLocationId);
        expect(keeper.activity?.kind, 'the receiver is not away on a journey').toBe('the_work_of_their_rank');
        const walletBefore = house.resources.spirit_stones ?? 0;
        expect(daoGroundsInReachOf(h.world, visitor).some(g => g.sourceId === place.id)).toBe(false);
        h.game.theWorldMoved();
        const taskDay = nextAnnualTaskDay(worldDayBeforeWait);
        const atTask = standWith(h, visitor, taskDay);
        expect(resolveWithPlayerPresent(atTask.taskState, {
            person: atTask.taskState.npcs.find(npc => npc.id === h.cultivator.id)!,
            placeId: atTask.place.id, areaId: atTask.areaId
        }, () => isPlayerInvolved(atTask.taskState,
            atTask.taskState.npcs.find(npc => npc.id === visitor.id)!), taskDay),
        'the visitor is exact at the dated road-comprehension pass').toBe(true);
        // The admission pass is scheduled before the later day-121 stint.
        const waited = await h.game.act('I wait one day');
        const after = h.game.atHand!;
        const receipt = after.history.facts.find(f => f.data.daoAdmission === true && f.data.visitorId === visitor.id)!;
        expect(receipt, JSON.stringify({
            worldDayBeforeWait, worldDayAfterWait: Math.floor(after.currentDay),
            runDayBeforeWait, runDayAfterWait: h.game.currentRun().run.elapsedDays,
            nextRoadTaskDay: nextAnnualTaskDay(worldDayBeforeWait),
            waitCalls: waited.toolCalls,
            visitor: after.npcs.find(n => n.id === visitor.id),
            receiver: after.npcs.find(n => n.id === keeper.id)
        })).toBeDefined();
        expect(receipt.data.stones).toBe(feeForSittingOn(ground.fromOrdinal));
        expect(after.npcs.find(n => n.id === visitor.id)!.spiritStones).toBeLessThan(visitor.spiritStones);
        expect(after.factions.find(f => f.id === house.id)!.resources.spirit_stones)
            .toBe(walletBefore + fee!);
        expect(daoGroundsInReachOf(after, after.npcs.find(n => n.id === visitor.id)!, receipt.day))
            .toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: place.id })]));
        expect(daoGroundsInReachOf(after, after.npcs.find(n => n.id === visitor.id)!, Number(receipt.data.untilDay)))
            .not.toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: place.id })]));
    }, 120_000);

    it('places a talented child from a poor origin below membership and carries their actual probation start', async () => {
        const h = await game('a-scouted-child');
        const today = h.world.currentDay;
        const house = h.world.factions.find(f => f.id === 'sect-azure-cloud-pavilion')!;
        const market = h.world.locations.find(l => l.kind === 'settlement' && l.discovered && !l.sealed
            && l.thresholds.entry === 0 && l.thresholds.survival === 0)!;
        const scouts = Array.from({ length: 6 }, (_, index) => {
            const n = createNpc(h.world.seed, { id: `scout-${index}`, name: `Scout ${index}`,
                bornOnDay: today - 30 * 365, onDay: today });
            return { ...n, locationId: house.seatLocationId, factionId: house.id, factionRankIndex: 1,
                cultivation: { ...n.cultivation, realmOrdinal: FOUNDATION_ORDINAL }, activity: null };
        });
        let id = '';
        for (let index = 0; !id; index++) {
            const candidate = `scout-child-${index}`;
            if (forStream(h.world.seed, 'pavilion-scout', candidate, Math.floor(today / 365)).chance(0.03)) id = candidate;
        }
        const child = createNpc(h.world.seed, { id, name: 'Child', bornOnDay: today - 9 * 365, onDay: today });
        child.locationId = market.id;
        child.identity.origin = 'thin_county';
        child.cultivation.spiritRoot = 'single_metal';
        child.cultivation.realmOrdinal = 0;
        child.cultivation.techniqueIds = [];
        h.world.npcs = [...scouts, child];
        house.resources.spirit_stones = 100_000;
        h.game.theWorldMoved();
        await h.game.act('I wait one day');
        const after = h.game.atHand!;
        const placed = after.npcs.find(n => n.id === id)!;
        expect(placed.tags.some(t => t.startsWith('scouted-probation|'))).toBe(true);
        expect(placed.factionId).toBeNull();
        expect(placed.factionRankIndex).toBe(-1);
        expect(placed.locationId).toBe(house.seatLocationId);
        expect(placed.cultivation.spiritRoot).toBe(child.cultivation.spiritRoot);
        const paper = after.history.facts.find(f => f.data.scoutPlacement === true && f.data.probation === true)!;
        expect(paper.data.age).toBeGreaterThanOrEqual(7);
        expect(paper.data.age).toBeLessThanOrEqual(14);
        expect(placed.tags).toContain(`scouted-probation|${paper.data.sinceDay}|${market.id}`);
        expect(h.repos.sects.getMembership(id)).toBeNull();
    }, 120_000);

    it('turns a rumour the house can hear into a decider’s investigation goal without making the claim true', async () => {
        const h = await game('rumour-planning');
        const today = h.world.currentDay;
        const worldDayBeforeWait = Math.floor(today);
        const runDayBeforeWait = h.game.currentRun().run.elapsedDays;
        const compounds = whereCompoundsAre(h.world);
        const people = new Set(h.world.npcs.map(person => person.id));
        const planned = h.world.factions.filter(house => house.seatLocationId !== null).map(house => {
            const roll = h.world.npcs.filter(person => isTheWorldsToMove(person)
                && person.status === 'alive' && person.factionId === house.id);
            const decider = [...roll].sort((a, b) => b.factionRankIndex - a.factionRankIndex)[0];
            const offices = portfoliosIn({ npcs: h.world.npcs, locations: h.world.locations, sectId: house.id,
                roll: roll.map(person => ({ id: person.id, rankIndex: person.factionRankIndex })),
                rankCount: house.ranks.length });
            return { house, roll, decider, offices,
                holds: decider ? whatTheyHold(offices, decider.id) : [],
                actualPlaceId: decider
                    ? whereTheyAreStanding(h.world, compounds, decider, people)
                    : null };
        }).find(row => row.decider !== undefined && row.decider.locationId === row.house.seatLocationId
            && row.decider.activity?.kind === 'the_work_of_their_rank' && row.holds.length > 0
            && h.world.locations.some(place => place.id === row.actualPlaceId && place.tags.includes('interior')));
        expect(planned, 'the world has a seated working decider who actually holds a room').toBeDefined();
        const { house, roll, holds } = planned!;
        const decider = planned!.decider!;
        const seat = h.world.locations.find(l => l.id === house.seatLocationId)!;
        const ruin = h.world.locations.find(l => l.kind === 'ruin' && l.discovered && !l.sealed)!;
        ruin.parentId = seat.parentId;
        // The first task on this same day sends idle Azure Cloud Foundation
        // members scouting. This decider already has a real active duty and
        // actual office above, so the later rumour pass reaches the selected
        // person where the world places them.
        const player = h.world.npcs.find(npc => npc.id === h.cultivator.id)!;
        expect(player, 'the world retains the played person for exact foreground work').toBeDefined();
        h.world.npcs = [player, ...roll];
        const selected = h.world.npcs.filter(person => isTheWorldsToMove(person)
            && person.status === 'alive' && person.factionId === house.id)
            .sort((a, b) => b.factionRankIndex - a.factionRankIndex)[0];
        expect(selected?.id, 'the pass gives its personal goal to its actual selected decider').toBe(decider.id);
        expect(holds, 'the selected decider holds an actual room').not.toHaveLength(0);
        const rumour = appendWorldFact(h.world, makeFact({ day: today - 365, kind: 'treasure_found', scale: 'regional',
            visibility: 'regional', magnitude: 1, locationId: ruin.id, summary: 'A traveller reported a buried archive.',
            consequences: fillConsequences({ rumours: ['An unclaimed archive lies beneath the ruin.'] }) }));
        h.game.theWorldMoved();
        const taskDay = nextAnnualTaskDay(worldDayBeforeWait);
        const atTask = standWith(h, decider, taskDay);
        const scheduledDecider = atTask.taskState.npcs.find(person => person.id === decider.id)!;
        const exact = resolveWithPlayerPresent(atTask.taskState, {
            person: atTask.taskState.npcs.find(npc => npc.id === h.cultivator.id)!,
            placeId: atTask.place.id, areaId: atTask.areaId
        }, () => isPlayerInvolved(atTask.taskState, scheduledDecider), taskDay);
        expect(exact, 'the selected decider is exact work, not a background draw').toBe(true);
        const lookup = { ...circulationLookup(atTask.taskState, taskDay), candidates: [rumour] };
        expect(circulating(atTask.taskState, whereThisPersonIsStanding(atTask.taskState, scheduledDecider), taskDay, 24, lookup)
            .map(fact => fact.id), 'the selected decider can hear this aged, same-region report').toContain(rumour.id);
        const waited = await h.game.act('I wait one day');
        const after = h.game.atHand!;
        const goal = after.npcs.find(n => n.id === decider.id)!.goals.find(g => g.note === `rumour-plan:${rumour.id}`)!;
        expect(goal, JSON.stringify({
            worldDayBeforeWait, worldDayAfterWait: Math.floor(after.currentDay),
            runDayBeforeWait, runDayAfterWait: h.game.currentRun().run.elapsedDays,
            nextRumourTaskDay: nextAnnualTaskDay(worldDayBeforeWait),
            waitCalls: waited.toolCalls,
            decider: after.npcs.find(n => n.id === decider.id),
            rumour: after.history.facts.find(f => f.id === rumour.id)
        })).toBeDefined();
        expect(goal.targetId).toBe(ruin.id);
        expect(goal.text).toContain('Verify the report');
        expect(after.history.facts.find(f => f.data.rumourPlan === true)!.causes).toContain(rumour.id);
        expect(after.history.facts.find(f => f.id === rumour.id)!.summary).toBe(rumour.summary);
    }, 120_000);
});
