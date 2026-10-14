/** Measure one native year and real played actions on current-source pre-baked checkpoints. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { Session } from 'node:inspector/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const value = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
const seed = value('--seed', 'drift-guard');
const years = value('--years', '10,100,1000').split(',').map(Number);
const output = value('--output', '.claude/aged-world-cost.json');
const arm = value('--arm', 'current');
const actions = args.includes('--native-only') ? [] : value('--actions', 'look,wait,seclude,move,walk').split(',');
if (actions.some(action => !['look', 'wait', 'seclude', 'move', 'walk'].includes(action))) throw new Error('Invalid actions');
const snapshotRoot = value('--snapshot-root', null);
if (!['current', 'before'].includes(arm)) throw new Error('Unknown source arm');
if (years.some(year => !Number.isSafeInteger(year) || year < 0)) throw new Error('Invalid ages');
const originals = new Map();
const overridden = new Set();
if (arm === 'before') for (const file of ['src/engine/world/a-capital-auction.ts', 'src/engine/world/the-business-the-world-still-keeps.ts']) {
    const read = spawnSync('git', ['-c', 'safe.directory=*', 'show', `056c7114:${file}`], { cwd: root, encoding: 'utf8' });
    if (read.status !== 0) throw new Error(read.stderr);
    originals.set(path.resolve(root, file).replaceAll('\\', '/'), read.stdout);
}
// Explicit diagnostic arms never build/publish cache worlds. Only their two
// named source changes differ; both read the same labelled pre-baked input.
const server = await createServer({ root, configFile: false, appType: 'custom',
    cacheDir: path.join(root, '.claude', 'vite-speed-cache'), optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: 'explicit-source-arm', enforce: 'pre', load(id) {
        const file = id.split('?')[0].replaceAll('\\', '/');
        if (originals.has(file)) { overridden.add(file); return originals.get(file); }
    } }],
    server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
const report = [];
try {
    const { preBakedWorld } = await server.ssrLoadModule('/tests/support/soaked-world.ts');
    const { advanceWorldForPlay } = await server.ssrLoadModule('/src/engine/world/driver.ts');
    const { makeGame, ScriptedProvider } = await server.ssrLoadModule('/tests/web/harness.ts');
    const { WorldStateRepository } = await server.ssrLoadModule('/src/storage/repos/world-state.repo.ts');
    const { activeWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } = await server.ssrLoadModule('/src/server/state/cultivation-world.ts');
    const { maxHpForOrdinal, maxQiForOrdinal } = await server.ssrLoadModule('/src/engine/cultivation/realms.ts');
    const { walkingDaysFrom } = await server.ssrLoadModule('/src/engine/world/locations.ts');
    const { metricGroundRead } = await server.ssrLoadModule('/src/engine/world/the-metric-ground-under-a-journey.ts');
    const { quoteAnAirJourney, conveyanceOfPersonalFlight } = await server.ssrLoadModule('/src/engine/world/what-an-air-journey-takes.ts');
    const { worldLocationFor } = await server.ssrLoadModule('/src/engine/world/place-lookup.ts');
    const { getTechnique } = await server.ssrLoadModule('/src/data/cultivation/techniques.ts');
    const { routineTime } = await server.ssrLoadModule('/src/engine/world/npc-routines.ts');
    if (arm === 'before' && overridden.size !== originals.size) throw new Error('The before source overrides were not loaded');
    const measure = async (work) => {
        const cpu = process.cpuUsage(), start = performance.now();
        const result = await work();
        const used = process.cpuUsage(cpu);
        return { seconds: (performance.now() - start) / 1000, cpuSeconds: (used.user + used.system) / 1e6, result };
    };
    for (const age of years) {
        const read = () => {
            let world;
            if (snapshotRoot) {
                const dir = `${snapshotRoot}-year${age}`;
                const kept = JSON.parse(readFileSync(`${dir}/shell.json`, 'utf8'));
                for (const chunk of kept.arrays) {
                    let target = kept.state;
                    for (const key of chunk.path.slice(0, -1)) target = target[key];
                    target[chunk.path.at(-1)] = JSON.parse(readFileSync(path.join(dir, chunk.file), 'utf8'));
                }
                world = kept.state;
            } else world = preBakedWorld(seed, age);
            if (world && world.seed !== seed) throw new Error('Snapshot seed differs from the measurement seed');
            if (!world) throw new Error(`Missing current-source ${seed}@${age}; run regenerate-world-fixtures.mjs first.`);
            return world;
        };
        const loaded = read();
        const row = { seed, age, arm, protocol: 'aged-actions-v2-useful-method-and-physical-routes', input: snapshotRoot ?? 'current-source canonical checkpoint',
            rows: { npcs: loaded.npcs.length, facts: loaded.history.facts.length, objects: loaded.objects.length }, actions: [] };
        report.push(row);
        const session = new Session(); session.connect(); await session.post('Profiler.enable'); await session.post('Profiler.start');
        row.nativeYear = await measure(() => {
            const result = advanceWorldForPlay(loaded, { days: 365, stopOnInterrupt: false });
            if (result.daysAdvanced !== 365) throw new Error('Short native year');
            return { actualDays: result.daysAdvanced };
        });
        const { profile } = await session.post('Profiler.stop'); session.disconnect();
        writeFileSync(`${output}.year${age}.cpuprofile`, JSON.stringify(profile));
        if (args.includes('--decade')) row.nativeDecade = await measure(() => {
            const result = advanceWorldForPlay(read(), { days: 3650, stopOnInterrupt: false });
            if (result.daysAdvanced !== 3650) throw new Error('Short native decade');
            return { actualDays: result.daysAdvanced };
        });
        for (const action of actions) {
            // Fresh in-memory SQLite and the same aged checkpoint for each action.
            // The legal higher body removes hunger as a short-span artefact;
            // routing is scripted while state, interruption and travel are real.
            const plans = [], h = makeGame({ seed: `speed-aged-${action}-0`, worldEnabled: true,
                provider: new ScriptedProvider({ plans, narrations: ['The measured turn has ended.'] }) });
            try {
                new WorldStateRepository(h.db).saveWorld(read()); resetCultivationWorlds();
                await h.game.newRun('Time Reader');
                const current = h.game.currentRun(), person = current.cultivator;
                h.repos.cultivators.update(person.id, { realmOrdinal: 29, age: 20, yearsAtCurrentRealm: 0,
                    hp: maxHpForOrdinal(person.attributes.might, 29), maxHp: maxHpForOrdinal(person.attributes.might, 29),
                    qi: maxQiForOrdinal(person.attributes.insight, 29), maxQi: maxQiForOrdinal(person.attributes.insight, 29),
                    spiritStones: 1_000_000, cultivationProgress: 0, injuries: [], sectId: null });
                const manual = getTechnique('single-road-treatise');
                if (!manual) throw new Error('Catalog cultivation method absent');
                h.repos.techniques.upsert(manual);
                if (!h.repos.techniques.learn(person.id, manual.id, 1)) throw new Error('Actual method lesson failed');
                h.repos.cultivators.update(person.id, { knownTechniques: [manual.id] });
                const world = (await activeWorld()).state;
                // Select actual catalog ground. Historical settlements without
                // metric coordinates cannot supply an accepted air course.
                const ground = metricGroundRead(world.locations);
                const origin = world.locations.find(place => place.kind === 'settlement' && !place.sealed
                    && ground.point(place.id) && worldLocationFor(world, place.name)?.id === place.id);
                if (!origin) throw new Error('No ordinary metric settlement for this checkpoint');
                h.repos.cultivators.update(person.id, { location: origin.name });
                h.repos.cultivators.standIn(person.id, null);
                const prepared = h.game.currentRun();
                h.game.atHand = await prepareWorldClockForPreciseSpan(prepared.run, prepared.cultivator);
                row.origin = origin.name;
                let plan = { action }, input = 'I look around.';
                if (action === 'wait' || action === 'seclude') {
                    plan.days = 10 * 365;
                    input = action === 'wait' ? 'I wait for 10 years.' : 'I seclude for 10 years anyway.';
                }
                if (action === 'move') {
                    const from = worldLocationFor(world, h.game.currentRun().cultivator.location);
                    if (!from) throw new Error('The actual player opening location is absent');
                    const conveyance = conveyanceOfPersonalFlight(null);
                    const selected = world.locations.map(to => ({ to, quote: quoteAnAirJourney(world.locations,
                        from.id, to.id, conveyance, null, 1) })).filter(row => row.to.kind === 'settlement'
                        && row.to.id !== from.id && !row.to.sealed && !row.to.tags.includes('interior')
                        && worldLocationFor(world, row.to.name)?.id === row.to.id && row.quote?.daysOneWay > 0)
                        .sort((a, b) => b.quote.daysOneWay - a.quote.daysOneWay)[0];
                    if (!selected) throw new Error('No actual metric air journey');
                    const destination = selected.to;
                    h.game.noteEncounter(h.game.currentRun().cultivator, h.game.currentRun().run,
                        { kind: 'place', id: destination.id, name: destination.name }, 'told',
                        'Operator measurement: the actual destination and its directions are known.');
                    plan.action = 'ride'; plan.target = destination.name; plan.topic = 'body flight';
                    input = `I fly to ${destination.name}.`;
                    row.journey = { from: from.name, to: destination.name, quotedDays: selected.quote.daysOneWay };
                }
                if (action === 'walk') {
                    const reach = walkingDaysFrom(world.locations, origin.id);
                    const destination = world.locations.filter(place => place.kind === 'settlement'
                        && place.id !== origin.id && !place.sealed && ground.point(place.id)
                        && worldLocationFor(world, place.name)?.id === place.id && (reach.get(place.id) ?? 0) > 0)
                        .sort((a, b) => reach.get(b.id) - reach.get(a.id))[0];
                    if (!destination) throw new Error('No actual long walking route');
                    h.game.noteEncounter(h.game.currentRun().cultivator, h.game.currentRun().run,
                        { kind: 'place', id: destination.id, name: destination.name }, 'told',
                        'Operator measurement: the actual walking destination and directions are known.');
                    plan.action = 'move'; plan.target = destination.name;
                    input = `I walk to ${destination.name}.`;
                    row.walkingJourney = { from: origin.name, to: destination.name, quotedDays: reach.get(destination.id) };
                }
                plans.push(JSON.stringify(plan));
                const before = h.game.currentRun().run.elapsedDays, beforeWorld = routineTime(world);
                const actionProfile = new Session(); actionProfile.connect();
                await actionProfile.post('Profiler.enable'); await actionProfile.post('Profiler.start');
                const timed = await measure(async () => {
                    const result = await h.game.act(input);
                    const after = h.game.currentRun();
                    return { actualDays: after.run.elapsedDays - before,
                        worldDays: routineTime((await activeWorld()).state) - beforeWorld,
                        alive: after.cultivator.alive, location: after.cultivator.location, source: result.toolCalls.find(call => call.name === 'narrator.plan')?.source,
                        ordinal: after.cultivator.realmOrdinal, runSeed: after.run.seed,
                        cultivationProgress: after.cultivator.cultivationProgress,
                        method: manual.id,
                        calls: result.toolCalls, narration: result.narration };
                });
                const { profile } = await actionProfile.post('Profiler.stop'); actionProfile.disconnect();
                writeFileSync(`${output}.year${age}.${action}.cpuprofile`, JSON.stringify(profile));
                row.actions.push({ action, ...timed });
                if (action === 'look') row.warmLook = await measure(async () => {
                    const result = await h.game.act(input);
                    return { actualDays: h.game.currentRun().run.elapsedDays - before, calls: result.toolCalls };
                });
                writeFileSync(output, JSON.stringify(report, null, 2));
                console.log(JSON.stringify({ age, action, seconds: timed.seconds, actualDays: timed.result.actualDays }));
            } finally { resetCultivationWorlds(); h.db.close(); }
        }
        writeFileSync(output, JSON.stringify(report, null, 2));
    }
} finally { await server.close(); }

