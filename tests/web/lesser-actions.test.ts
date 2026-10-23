/**
 * Meals and local walks passed no time; the same people stood in each
 * square forever. Fractions now advance one run clock and move the world's
 * whole day at midnight with the player present. Scene light is perceived,
 * never a clock reading through rock. Fractional clauses add within a plan.
 * Replay R1/R3: an ordinary reply is not a three-hour wait. Talking stays at
 * the actual meeting time; meals and real walks still advance the clock.
 * Looking at visible buildings formerly spent a search's half-day. Its read
 * stays free; pricing a sought thing still requires the search's half-day.
 * Compare actual routine time with the run clock: world days may retain their
 * fractional part. Midnight changes the day, without requiring integer storage.
 */
import { describe, expect, it } from 'vitest';
import { ACTION_NAMES } from '../../src/web/action-set';
import { LESSER_ACTION_DAYS, lesserActionDays } from '../../src/web/lesser-action-costs';
import { ScriptedProvider, makeGameInWorld } from './harness';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { worldLocationFor } from '../../src/web/entities';
import { routineOf, routineTime } from '../../src/engine/world/npc-routines';
import { makeObject } from '../../src/engine/world/possessions';
import { standWhereThePeopleAre } from './standing-where-the-people-are';

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
    it('keeps visible ground reads free and prices a thorough search', () => {
        expect(lesserActionDays({ action: 'investigate', target: 'the buildings' })).toBe(0);
        expect(lesserActionDays({ action: 'investigate', target: 'the ground' })).toBe(0);
        expect(lesserActionDays({ action: 'investigate', target: 'a hidden cache' })).toBe(1 / 2);
    });

    it('reads a present body and the player themselves without spending search time', async () => {
        const { game, repos, db, town } = await open([
            { action: 'investigate', target: 'myself' },
            { action: 'investigate' },
            { action: 'investigate', target: 'the nearest person' }
        ]);
        try {
            const player = game.state().cultivator;
            const people = game.atHand!.npcs.filter(n => n.status === 'alive'
                && n.locationId === town.id);
            expect(await standWhereThePeopleAre({ game, repos }, player.id,
                new Set(people.map(n => n.id))), 'a visible body must be present').toBeGreaterThan(0);
            expect(game.present(game.state().cultivator).length,
                'the read must have somebody actually within sight').toBeGreaterThan(0);
            const before = repos.runs.getById(game.state().run.id)!.elapsedDays;
            for (const [sentence, resolvedKind] of [
                ['I examine my own condition', 'self'],
                ['I look around', null],
                ['I look at the nearest person', 'cultivator']
            ] as const) {
                const turn = await game.act(sentence);
                if (resolvedKind !== null) {
                    expect(turn.toolCalls.some(call => call.name === 'engine.readState'
                        && call.ok && call.summary.includes(`to a ${resolvedKind}`)),
                        'the read must actually resolve its body').toBe(true);
                }
                expect(repos.runs.getById(game.state().run.id)!.elapsedDays).toBe(before);
            }
        } finally { db.close(); }
    }, 180_000);

    it('spends half a day on a successful examination of a sought thing', async () => {
        const { game, repos, db } = await open([{ action: 'investigate', target: 'A folded note' }]);
        try {
            const player = game.state().cultivator;
            game.atHand!.objects.push(makeObject({ id: 'note-being-examined', name: 'A folded note',
                kind: 'other', significance: 'mundane', ownerId: player.id, possessorId: player.id }));
            game.theWorldMoved();
            const before = repos.runs.getById(game.state().run.id)!.elapsedDays;
            const turn = await game.act('I examine the folded note closely');
            expect(turn.toolCalls.some(call => call.name === 'engine.readState' && call.ok)).toBe(true);
            expect(repos.runs.getById(game.state().run.id)!.elapsedDays - before).toBeCloseTo(1 / 2);
        } finally { db.close(); }
    }, 180_000);
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
            const clock = routineTime(world);
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
                expect(Math.floor(game.atHand!.currentDay)).toBe(Math.floor(day));
                expect(routineTime(game.atHand!)).toBeCloseTo(clock + (i + 1) / 8);
            }
            expect(game.atHand!.currentHour).toBeCloseTo(23);
            expect(streetCount()).toBeLessThan(morning);
            repos.cultivators.applyDeltas(game.state().cultivator.id, { satiety: -50 });
            await game.act('I eat a meal');
            const after = repos.runs.getById(before.id)!;
            expect(after.elapsedDays - before.elapsedDays).toBeCloseTo(6 / 8);
            expect(game.atHand!.currentHour).toBeCloseTo(2);
            const record = game.atHand!.runs.find(r => r.id === before.id)!;
            expect(routineTime(game.atHand!)).toBeCloseTo(record.startedOnDay + after.elapsedDays);
            expect(Math.floor(game.atHand!.currentDay)).toBe(Math.floor(day) + 1);
        } finally { db.close(); }
    }, 180_000);

    it('a reply adds no hours to a meal, and scene and pouch reads stay free', async () => {
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
            expect(repos.runs.getById(game.state().run.id)!.elapsedDays - start, JSON.stringify(turn.toolCalls)).toBeCloseTo(1 / 8);
            for (const read of ['I look around', 'I check my inventory', 'I check my status']) await game.act(read);
            expect(repos.runs.getById(game.state().run.id)!.elapsedDays - start).toBeCloseTo(1 / 8);
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
