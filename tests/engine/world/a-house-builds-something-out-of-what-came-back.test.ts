/** The 8210cf97 small-catalog walk produced no launches, and its arranged
 * heaven yard promoted somebody who was not an appointed artifact worker.
 * Actual canonical century samples had15/14 attempts, with both outcomes.
 * Those samples keep the >10 attempts, success/failure, counted-stock and cap3
 * claims. A partial heaven berth and a real appointed wright define one shared
 * precondition. The actual drift24 berth has684work days but lacks its last
 * materials. The SAME scenario delivers a returned haul before the next build;
 * requiring the berth to be fully stocked at the checkpoint was a false premise.
 * Native writers arrange it; source-keyed24/25-year checkpoints
 * look for that actual state across two seeds, and the real instance runs the
 * SAME focused build scenario. The observed first drift carriage launched in
 * year24. This samples a reachable moment instead of walking five centuries. */
import { describe, expect, it } from 'vitest';
import { sampledWorld } from '../../support/sampled-world.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { upsertFaction, upsertNpc, type WorldState } from '../../../src/engine/world/world-state.js';
import { setRealm } from '../../../src/engine/world/npc-state.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { theHandsAtHouseCraftWork } from '../../../src/engine/world/the-people-posted-to-a-houses-halls.js';
import { canRefineGrade } from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { CONVEYANCE_RECIPES, countedHolding, adjustCountedHolding, describeCountedHoldings }
    from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { berthOnTheBooks, putBerthOnTheBooks, layDownKeel, deliver, workOn, readyToLaunch, conveyanceKeptAs }
    from '../../../src/engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import type { ObjectRecord } from '../../../src/engine/world/possessions.js';

const recipe = CONVEYANCE_RECIPES.find(row => row.producesConveyanceId === 'conv-carriage-heaven')!;
const samples = [['drift-guard', 24], ['demography', 24], ['drift-guard', 25], ['demography', 25]] as const;
const returnedHaul = [
    { id: 'returned-material', grade: 'heaven' as const, core: false, count: 44 },
    { id: 'returned-cores', grade: 'heaven' as const, core: true, count: 2 }
];
const buildDay = (world: WorldState) => {
    const day = Math.floor(world.currentDay / 365) * 365 + 178;
    return day > world.currentDay ? day : day + 365;
};

function isAHeavenBerthReadyForItsNextYear(world: WorldState, houseId: string): boolean {
    const house = world.factions.find(row => row.id === houseId && row.dissolvedOnDay === null);
    if (!house || countedHolding(house.resources, 'conv-carriage-mortal') < 2
        || countedHolding(house.resources, 'conv-carriage-earth') < 2
        || world.objects.some(object => object.ownerId === houseId && object.data.conveyanceId === recipe.producesConveyanceId)) return false;
    const hands = theHandsAtHouseCraftWork(world, 'artifact', buildDay(world)).get(houseId) ?? [];
    if (!hands.some(person => canRefineGrade(recipe.grade, person.cultivation.realmOrdinal))) return false;
    const berth = berthOnTheBooks(house.resources, recipe);
    return berth.workDaysDone > 0 && !readyToLaunch(berth, recipe)
        && readyToLaunch(workOn(deliver(berth, recipe, returnedHaul), recipe,
        { days: 365, hands: hands.map(person => person.cultivation.realmOrdinal) }).berth, recipe);
}

function aReadyHouse(world: WorldState): string | null {
    return world.factions.find(house => isAHeavenBerthReadyForItsNextYear(world, house.id))?.id ?? null;
}

async function arrangedBerth(seed: string): Promise<WorldState> {
    const world = seedWorld({ seed, catalog: await loadCultivationCatalog() }).state;
    const workers = theHandsAtHouseCraftWork(world, 'artifact', buildDay(world));
    const entry = [...workers].find(([, hands]) => hands.some(person => canRefineGrade(recipe.grade, person.cultivation.realmOrdinal)))
        ?? [...workers][0];
    expect(entry, 'the catalog supplies an actual appointed artifact worker').toBeDefined();
    const qualifiedOrdinal = Array.from({ length: MAX_ORDINAL + 1 }, (_, ordinal) => ordinal)
        .find(ordinal => canRefineGrade(recipe.grade, ordinal))!;
    const wright = entry![1].find(person => canRefineGrade(recipe.grade, person.cultivation.realmOrdinal)) ?? entry![1][0];
    Object.assign(world, upsertNpc(world, setRealm(wright, Math.max(wright.cultivation.realmOrdinal, qualifiedOrdinal), world.currentDay)));
    const house = world.factions.find(row => row.id === entry[0])!;
    let resources = { ...house.resources };
    for (const id of ['conv-carriage-mortal', 'conv-carriage-earth'])
        resources = adjustCountedHolding(resources, id, Math.max(0, 2 - countedHolding(resources, id)));
    const supplied = deliver(layDownKeel(recipe), recipe, [
        { id: 'returned-material', grade: 'heaven', core: false, count: 44 },
        { id: 'returned-cores', grade: 'heaven', core: true, count: 1 }
    ]);
    const partial = workOn(supplied, recipe, { days: 365,
        hands: [Math.max(wright.cultivation.realmOrdinal, qualifiedOrdinal)] }).berth;
    putBerthOnTheBooks(resources, partial);
    Object.assign(world, upsertFaction(world, { ...house, resources }));
    expect(isAHeavenBerthReadyForItsNextYear(world, house.id)).toBe(true);
    return world;
}

function buildingScenario(world: WorldState, houseId: string) {
    expect(isAHeavenBerthReadyForItsNextYear(world, houseId)).toBe(true);
    const startingHouse = world.factions.find(row => row.id === houseId)!;
    const resources = { ...startingHouse.resources };
    putBerthOnTheBooks(resources, deliver(berthOnTheBooks(resources, recipe), recipe, returnedHaul));
    Object.assign(world, upsertFaction(world, { ...startingHouse, resources }));
    const fromDay = world.currentDay, through = buildDay(world);
    advanceWorldForPlay(world, { days: through - world.currentDay, stopOnInterrupt: false });
    const attempts = world.history.facts.filter(fact => fact.day > fromDay
        && fact.data.conveyanceRecipe === recipe.id && fact.factionIds.includes(houseId));
    expect(attempts).toHaveLength(1);
    const launched = attempts[0]!.data.launched === 1;
    const craft = world.objects.filter(object => object.ownerId === houseId
        && object.tags.includes('own-build') && object.data.conveyanceId === recipe.producesConveyanceId);
    expect(craft.length).toBe(Number(launched));
    for (const row of craft) checkTrackedCraft(world, row);
    const house = world.factions.find(row => row.id === houseId)!;
    expect(berthOnTheBooks(house.resources, recipe).workDaysDone).toBe(0);
    return launched;
}

function checkTrackedCraft(world: WorldState, row: ObjectRecord): void {
    expect(conveyanceKeptAs(recipe.grade)).toBe('tracked');
    if (row.ownerId !== null)
        expect(world.factions.some(house => house.id === row.ownerId && house.dissolvedOnDay === null)).toBe(true);
    expect(row.possessorId).toBeNull();
    expect(row.provenance.length).toBeGreaterThan(0);
    expect(row.provenance[0]!.how).toBe('crafted');
}

let cached: Promise<WorldState[]> | null = null;
function centuries(): Promise<WorldState[]> {
    cached ??= (async () => {
        const worlds: WorldState[] = [];
        for (const seed of ['demography', 'drift-guard']) worlds.push(await sampledWorld(seed, { years: 100 }));
        return worlds;
    })();
    return cached;
}

describe('a house builds something out of what came back', () => {
    it('finds actual launch successes and losses across canonical century samples', async () => {
        const yard = (await centuries()).flatMap(world => world.history.facts.filter(fact => fact.data.conveyanceRecipe !== undefined));
        expect(yard.length).toBeGreaterThan(10);
        expect(yard.some(fact => fact.data.launched === 1)).toBe(true);
        expect(yard.some(fact => fact.data.launched === 0)).toBe(true);
        for (const world of await centuries()) {
            const actualBuilds = world.objects.filter(row => row.tags.includes('own-build'));
            expect(actualBuilds.length).toBeGreaterThan(0);
            for (const row of actualBuilds) {
                // A century-old craft may have changed hands; its creation still has an origin.
                expect(row.provenance.length).toBeGreaterThan(0);
                expect(row.provenance[0]!.how).toBe('crafted');
            }
        }
    }, 120_000);
    it('keeps counted craft in real yards and stops below the original cap', async () => {
        for (const world of await centuries()) {
            const live = world.factions.filter(house => house.dissolvedOnDay === null);
            expect(live.some(house => !/Nothing in the yard/.test(describeCountedHoldings(house.resources)))).toBe(true);
            for (const house of live) {
                expect(countedHolding(house.resources, 'conv-carriage-mortal')).toBeLessThanOrEqual(3);
                expect(countedHolding(house.resources, 'conv-carriage-earth')).toBeLessThanOrEqual(3);
            }
        }
    }, 120_000);
    it('reaches the shared partial-heaven-berth state in real walked worlds', async () => {
        const found: boolean[] = [];
        for (const [seed, years] of samples) found.push(aReadyHouse(await sampledWorld(seed, { years })) !== null);
        expect(found.some(Boolean)).toBe(true);
    }, 120_000);
    it('launches tracked craft from arranged native berths, with an actual crafted chain', async () => {
        let launched = 0;
        for (let seed = 0; seed < 8; seed++) {
            const world = await arrangedBerth('arranged-heaven-berth-' + seed);
            launched += Number(buildingScenario(world, aReadyHouse(world)!));
        }
        expect(launched).toBeGreaterThan(0);
    }, 300_000);
    it('passes a real partial berth into the same native build scenario', async () => {
        for (const [seed, years] of samples) {
            const world = await sampledWorld(seed, { years });
            const houseId = aReadyHouse(world);
            if (houseId === null) continue;
            buildingScenario(world, houseId);
            return;
        }
        throw new Error('No sampled berth satisfies the shared native build precondition.');
    }, 120_000);
});
