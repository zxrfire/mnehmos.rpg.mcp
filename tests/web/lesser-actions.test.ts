/**
 * Meals, replies and local walks passed no time; the same people stood in each
 * square forever. Fractions now advance one run clock and move the world's
 * whole day at midnight with the player present. Scene light is perceived,
 * never a clock reading through rock. Fractional clauses add within a plan.
 */
import { describe, expect, it } from 'vitest';
import { ACTION_NAMES } from '../../src/web/action-set';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs';
import { ScriptedProvider, makeGameInWorld } from './harness';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { worldLocationFor } from '../../src/web/entities';
import { routineOf } from '../../src/engine/world/npc-routines';

async function open(plans: unknown[] = [{ action: 'eat' }]) {
    const provider = new ScriptedProvider({ plans: plans.map(p => JSON.stringify(p)), narrations: ['The scene.'] });
    const harness = await makeGameInWorld({ seed: 'lesser-actions', worldSeed: 'road-world', provider });
    const { cultivator } = await harness.game.newRun('Walker');
    const world = (await harness.game.loadWorld())!;
    const town = world.locations.filter(l => l.kind === 'settlement').sort((a, b) =>
        world.npcs.filter(n => n.status === 'alive' && n.locationId === b.id).length
        - world.npcs.filter(n => n.status === 'alive' && n.locationId === a.id).length)[0]!;
    harness.repos.cultivators.update(cultivator.id, { location: town.name, spiritStones: 100 });
    harness.repos.cultivators.standIn(cultivator.id, theAreasOf(world, town).areas.find(a => a.for === 'street')!.id);
    return { ...harness, provider, town };
}

describe('lesser acts spend the same clock', () => {
    it('prices every action explicitly and leaves sheet and scene reads free', () => {
        expect(Object.keys(LESSER_ACTION_DAYS).sort()).toEqual([...ACTION_NAMES].sort());
        for (const action of ['look', 'status', 'inventory', 'list_techniques', 'recall', 'ceiling'] as const) {
            expect(LESSER_ACTION_DAYS[action]).toBe(0);
        }
    });

    it('meals cross morning, night and midnight, moving routines and both clocks', async () => {
        const { game, repos, town, db } = await open();
        try {
            const before = repos.runs.getById(game.state().run.id)!;
            const world = game.atHand!;
            const day = world.currentDay;
            const streetCount = () => {
                const read = theAreasOf(game.atHand!, town);
                const streetIds = read.areas.filter(a => a.for === 'street').map(a => a.id);
                return [...read.whereIs.values()].filter(at => streetIds.includes(at)).length;
            };
            const morning = streetCount();
            for (let i = 0; i < 5; i++) {
                repos.cultivators.applyDeltas(game.state().cultivator.id, { satiety: -50 });
                await game.act('I eat a meal');
                expect(repos.runs.getById(before.id)!.elapsedDays - before.elapsedDays).toBeCloseTo((i + 1) / 8);
                expect(game.atHand!.currentDay).toBe(day);
            }
            expect(game.atHand!.currentHour).toBeCloseTo(23);
            expect(streetCount()).toBeLessThan(morning);
            repos.cultivators.applyDeltas(game.state().cultivator.id, { satiety: -50 });
            await game.act('I eat a meal');
            const after = repos.runs.getById(before.id)!;
            expect(after.elapsedDays - before.elapsedDays).toBeCloseTo(6 / 8);
            expect(game.atHand!.currentHour).toBeCloseTo(2);
            const record = game.atHand!.runs.find(r => r.id === before.id)!;
            expect(game.atHand!.currentDay).toBe(record.startedOnDay + Math.floor(after.elapsedDays));
            expect(game.atHand!.currentDay).toBe(day + 1);
        } finally { db.close(); }
    }, 180_000);

    it('a meal and a reply add, while look and checking the pouch are free', async () => {
        const { game, repos, db } = await open([
            { steps: [{ action: 'eat', said: 'I eat a meal' }, { action: 'interact', intent: 'talk', target: 'her', said: 'I greet her' }] },
            { action: 'look' }, { action: 'inventory' }, { action: 'status' }
        ]);
        try {
            const companion = game.atHand!.npcs.find(n => n.status === 'alive' && n.identity.sex === 'female'
                && n.locationId === game.worldPlaceOf(game.state().cultivator))!;
            expect(companion).toBeDefined();
            companion.activity = { kind: 'out_with_a_party', note: 'visiting', withIds: [game.state().cultivator.id],
                sinceDay: game.atHand!.currentDay, untilDay: null };
            game.theWorldMoved();
            const start = repos.runs.getById(game.state().run.id)!.elapsedDays;
            repos.cultivators.applyDeltas(game.state().cultivator.id, { satiety: -50 });
            const turn = await game.act('I eat a meal and I greet her');
            expect(repos.runs.getById(game.state().run.id)!.elapsedDays - start, JSON.stringify(turn.toolCalls)).toBeCloseTo(1 / 4);
            for (const read of ['I look around', 'I check my inventory', 'I check my status']) await game.act(read);
            expect(repos.runs.getById(game.state().run.id)!.elapsedDays - start).toBeCloseTo(1 / 4);
        } finally { db.close(); }
    }, 180_000);

    it('a played fight costs per exchange and checking the sheet between exchanges is free', async () => {
        const { game, repos, db } = await makeGameInWorld({ seed: 'open-1', worldSeed: 'w-open-1' });
        try {
            await game.newRun('Duellist');
            const before = repos.runs.getById(game.state().run.id)!.elapsedDays;
            const first = await game.act('I attack someone of my own rank');
            expect(first.toolCalls.some(c => c.name === 'combat.round')).toBe(true);
            expect(repos.runs.getById(game.state().run.id)!.elapsedDays - before).toBeCloseTo(1 / 8);
            expect(game.state().fight).not.toBeNull();
            await game.act('status');
            expect(repos.runs.getById(game.state().run.id)!.elapsedDays - before).toBeCloseTo(1 / 8);
            const next = await game.act('I block his sword');
            expect(next.toolCalls.some(c => c.name === 'combat.round')).toBe(true);
            expect(repos.runs.getById(game.state().run.id)!.elapsedDays - before).toBeCloseTo(1 / 4);
        } finally { db.close(); }
    }, 180_000);

    it('hands perceived daylight to the narrator outdoors and none in a cave', async () => {
        const { game, repos, provider, db } = await open([{ action: 'look' }]);
        try {
            await game.act('I look around');
            const daylight = provider.calls.at(-1)!.messages.map(m => m.content).join('\n');
            expect(daylight).toContain('morning sunlight');
            const cave = game.atHand!.locations.find(l => l.kind === 'cave')!;
            expect(cave).toBeDefined();
            repos.cultivators.update(game.state().cultivator.id, { location: cave.name });
            expect(worldLocationFor(game.atHand!, cave.name)?.kind).toBe('cave');
            await game.act('I look around');
            const dark = provider.calls.at(-1)!.messages.map(m => m.content).join('\n');
            expect(dark).not.toContain('morning sunlight');
            expect(dark).not.toMatch(/The hour:|Hour \d/);
            const night = { ...game.atHand!, currentHour: 22 };
            const worker = night.npcs.find(n => n.status === 'alive' && n.factionId === null
                && n.id !== game.currentRun().cultivator.id
                && routineOf(night, { ...n, activity: null }).activity?.kind === 'the_work_of_their_rank')!;
            expect(worker).toBeDefined();
            for (const person of night.npcs.filter(n => n.locationId === cave.id)) person.locationId = null;
            worker.locationId = cave.id;
            worker.activity = null;
            worker.cultivation.realmOrdinal = game.currentRun().cultivator.realmOrdinal;
            game.theWorldMoved();
            repos.runs.advanceDays(game.currentRun().run.id, (22 - game.atHand!.currentHour!) / 24);
            const atNight = (await game.loadWorld())!;
            const workerArea = theAreasOf(atNight, cave).whereIs.get(worker.id)!;
            expect(workerArea).toBeDefined();
            repos.cultivators.standIn(game.currentRun().cultivator.id, workerArea);
            await game.act('I look around');
            const company = game.company(game.currentRun().cultivator);
            expect([...company.named, ...company.strangers].map(person => person.at)).toContain('working');
            const nightInTheCave = provider.calls.at(-1)!.messages.map(m => m.content).join('\n');
            expect(nightInTheCave).not.toMatch(/working late|The hour:|Hour \d/);
        } finally { db.close(); }
    }, 180_000);

    it('repeats the same clock and placement for the same run and world seed', async () => {
        const arms: unknown[] = [];
        for (let i = 0; i < 2; i++) {
            const { game, repos, town, db } = await open();
            try {
                for (let n = 0; n < 5; n++) {
                    repos.cultivators.applyDeltas(game.state().cultivator.id, { satiety: -50 });
                    await game.act('I eat a meal');
                }
                const read = theAreasOf(game.atHand!, town);
                arms.push({ elapsed: repos.runs.getById(game.state().run.id)!.elapsedDays,
                    hour: game.atHand!.currentHour, people: [...read.whereIs].filter(([id]) => !id.includes('cultivator')) });
            } finally { db.close(); }
        }
        expect(arms[0]).toEqual(arms[1]);
    }, 180_000);
});
