/** On-demand unscripted exploration. No assertions about a desired world shape. */
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const usage = `npm run explore -- [--seeds drift-guard,demography] [--start-years 100] [--years 1000] [--sample-years 10]
Run through heavy-run, sequentially. Process priority is reduced automatically.
Starts above ten years require a warm current-source checkpoint; see explore/README.md.
Reports: explore/reports/<local-date>-<seed>.md. Findings never change engine state.`;
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') { console.log(usage); process.exit(0); }
const options = new Map();
for (let i = 0; i < args.length; i += 2) {
    if (!['--seeds', '--start-years', '--years', '--sample-years'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--'))
        throw new Error(usage);
    if (options.has(args[i])) throw new Error(`Repeated option ${args[i]}\n${usage}`);
    options.set(args[i], args[i + 1]);
}
const seeds = [...new Set((options.get('--seeds') ?? 'drift-guard,demography').split(',').map(seed => seed.trim()))];
const startYears = Number(options.get('--start-years') ?? 100);
const years = Number(options.get('--years') ?? 1000);
const sampleYears = Number(options.get('--sample-years') ?? 10);
if (seeds.some(seed => !seed) || ![startYears, years, sampleYears].every(Number.isSafeInteger)
    || startYears < 0 || years < 1 || sampleYears < 1 || !Number.isSafeInteger((startYears + years) * 365)) throw new Error(usage);

os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
process.env.MNEHMOS_WORLD_CACHE ??= path.join(root, '.claude', 'world-cache');
const date = new Date();
const dateLabel = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const reports = path.join(root, 'explore', 'reports');
mkdirSync(reports, { recursive: true });
const harnessHash = createHash('sha256');
for (const file of ['explore/walk-worlds.mjs', 'explore/observe-world.ts']) harnessHash.update(file).update(readFileSync(path.join(root, file)));
const harnessSource = harnessHash.digest('hex');
const server = await createServer({ root, configFile: false, appType: 'custom',
    cacheDir: path.join(root, '.claude', 'vite-explore-cache'), optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const table = (columns, rows) => [columns.map(cell).join(' | '), columns.map(() => '---').join(' | '),
    ...rows.map(row => row.map(cell).join(' | '))].map(row => `| ${row} |`).join('\n');
const number = value => value == null ? 'none' : Number(value.toFixed(3));
const displaySpread = value => `${number(value.min)} / ${number(value.median)} / ${number(value.max)} (n=${value.n})`;
const measured = async work => {
    const began = performance.now(), cpu = process.cpuUsage();
    const result = await work();
    const used = process.cpuUsage(cpu);
    return { result, wall: (performance.now() - began) / 1000, cpu: (used.user + used.system) / 1e6 };
};
try {
    const { preBakedWorld, soakedWorld, soakedWorldSourceHash } = await server.ssrLoadModule('/tests/support/soaked-world.ts');
    const { advanceWorldForPlay } = await server.ssrLoadModule('/src/engine/world/driver.ts');
    const { inspectWorld, bodiesBefore, deadActorsInNewFacts, newPlagueWithoutFoodNeed, distributionReview, CHECKS, spread }
        = await server.ssrLoadModule('/explore/observe-world.ts');
    const source = soakedWorldSourceHash();
    const ensureSource = () => {
        if (soakedWorldSourceHash(true) !== source) throw new Error('Simulation source changed during exploration. Restart on the finished tree.');
    };
    for (const seed of seeds) {
        // Nonportable seed spellings get a digest, so two spellings cannot overwrite one report.
        const filename = /^[A-Za-z0-9_-]+$/.test(seed) ? seed
            : `${seed.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)}-${createHash('sha256').update(seed).digest('hex').slice(0, 10)}`;
        const reportFile = path.join(reports, `${dateLabel}-${filename}.md`);
        const samples = [], timings = [], findings = new Map();
        let status = 'loading', failure = null, world = null, first = null, startingDay = null, preparation = null;
        let plagueObservations = 0, boundaryReads = 0;
        const note = finding => {
            const row = findings.get(finding.rule) ?? { level: finding.level, count: 0, firstDay: finding.day, lastDay: finding.day, examples: [] };
            row.count++; row.firstDay = Math.min(row.firstDay, finding.day); row.lastDay = Math.max(row.lastDay, finding.day);
            if (row.examples.length < 5 && !row.examples.some(example => example.subject === finding.subject)) row.examples.push(finding);
            findings.set(finding.rule, row);
        };
        const writeReport = () => {
            const last = samples.at(-1) ?? first;
            const lines = [`# World exploration: ${cell(seed)}`, '', `Status: ${status}. Started: ${date.toISOString()}.`, '',
                `Simulation source key: ${source}. Harness SHA-256: ${harnessSource}. Runtime: ${process.version} ${process.platform}/${process.arch}.`, '',
                `Request: start at ${startYears} walked years, explore ${years} further years. Census every ${sampleYears} years; invariant reads every simulated year and at the starting checkpoint.`, '',
                `Cache root: ${cell(process.env.MNEHMOS_WORLD_CACHE)}. Priority: below normal. Seeds run sequentially.`, '',
                `Starting checkpoint: ${preparation ? `${preparation.warm ? 'warm' : 'cold bounded preparation'}; ${number(preparation.wall)}s wall / ${number(preparation.cpu)}s CPU` : 'not loaded'}.`, '',
                `Actual exploration: ${world && startingDay != null ? number((world.currentDay - startingDay) / 365) : 0} years. ${boundaryReads} native boundary reads for new plague courses; ${plagueObservations} newly contracted courses observed at their exact date.`, '',
                'These are diagnostic observations, not a verdict that every flagged state is a defect. Counts are rule observations across snapshots, not unique people. Each confirmed finding needs a small CI regression before a fix.', '',
                'Coverage: native unscripted world advancement without a player. Yearly snapshots can miss short-lived violations. New dead acts cover explicit buyer/seller/bidder/crafter/traveller roles and bodies retained across the interval. Plague checks require a new course at an observed native boundary; zero exposure is not evidence of immunity. Preserved souls and reconstruction are not classified as dead actors.', '',
                'Prices below are fixed catalog cash prices multiplied by the existing area-status dial, per good and unit. They are area-price distributions, not complete player quotes, tariffs or market transaction prices.', '',
                '## Checks', '', ...CHECKS.map(check => `- ${check}`), '', '## Findings', ''];
            if (!findings.size) lines.push('No invariant or budget candidates observed at these checkpoints.');
            for (const [rule, row] of findings) {
                lines.push(`### ${rule} (${row.level})`, '', `${row.count} observations; first day ${row.firstDay}; last day ${row.lastDay}. Up to five distinct subjects:`, '');
                for (const example of row.examples) lines.push(`- Day ${example.day}; ${cell(example.subject)}: ${cell(example.evidence)}`);
                lines.push('');
            }
            lines.push('', '## Distribution review', '', 'A doubling/halving is a review heuristic, not an engine limit. All series remain visible even when no heuristic fires.', '');
            const drift = first && last ? distributionReview(first, last) : [];
            lines.push(...(drift.length ? drift.map(line => `- ${cell(line)}`) : ['No doubling/halving review signal in the observed interval.']));
            lines.push('', '## Census', '', table(['walked age (years)', 'day', 'living', 'retained people', 'standing houses', 'objects', 'facts', 'locations', 'roll min/median/max', 'purse min/median/max'], samples.map(sample =>
                [number(startYears + (sample.day - startingDay) / 365), sample.day, sample.population, sample.people, sample.standingHouses,
                    sample.objects, sample.facts, sample.locations, displaySpread(sample.rollSizes), displaySpread(sample.purses)])));
            for (const [field, title] of [['populationByRealm', 'Living population by cultivation realm'], ['housesByStrongestRealm', 'Houses by strongest living member realm'],
                ['membersByHouseRung', 'Members by index on their own house ladder'], ['statuses', 'Active area statuses']]) {
                const keys = [...new Set(samples.flatMap(sample => Object.keys(sample[field])))].sort();
                lines.push('', `## ${title}`, '', table(['walked age', ...keys], samples.map(sample =>
                    [number(startYears + (sample.day - startingDay) / 365), ...keys.map(key => sample[field][key] ?? 0)])));
            }
            lines.push('', '## Area prices: cash per stated unit', '', table(['good', ...samples.map(sample => `${number(startYears + (sample.day - startingDay) / 365)}y min/median/max`)],
                Object.keys(first?.prices ?? {}).map(good => [good, ...samples.map(sample => displaySpread(sample.prices[good]))])));
            lines.push('', '## Native year cost', '', `Advance wall seconds min/median/max: ${displaySpread(spread(timings.map(row => row.wall)))}. Advance CPU: ${displaySpread(spread(timings.map(row => row.cpu)))}.`, '',
                'Inspection cost is separate from engine advancement. Boundary plague reads are included in advance time.', '',
                table(['ending walked age', 'actual days', 'advance wall s', 'advance CPU s', 'inspection wall s', 'inspection CPU s', 'new facts'],
                    timings.map(row => [row.age, row.days, number(row.wall), number(row.cpu), number(row.inspectWall), number(row.inspectCpu), row.events])));
            if (failure) lines.push('', '## Run error', '', cell(failure));
            writeFileSync(reportFile, `${lines.join('\n')}\n`);
        };
        try {
            ensureSource();
            preparation = await measured(async () => {
                const cached = preBakedWorld(seed, startYears);
                if (cached) return { state: cached, warm: true };
                if (startYears > 10) throw new Error(`Missing current-source checkpoint: ${seed} at ${startYears} years. Run the low-priority regenerator through heavy-run first (explore/README.md).`);
                return { state: await soakedWorld(seed, { years: startYears }), warm: false };
            });
            world = preparation.result.state; preparation.warm = preparation.result.warm;
            startingDay = world.currentDay;
            first = inspectWorld(world); first.findings.forEach(note); samples.push(first);
            status = 'running'; writeReport();
            console.log(JSON.stringify({ seed, source, startYears, preparation: preparation.warm ? 'warm' : 'bounded cold', reportFile }));
            for (let year = 1; year <= years; year++) {
                ensureSource();
                const fromDay = world.currentDay, before = bodiesBefore(world);
                const step = await measured(() => advanceWorldForPlay(world, { days: 365, stopOnInterrupt: false, atWorldBoundary(state) {
                    boundaryReads++;
                    for (const person of state.npcs) if (person.cultivation.plague?.contractedOnDay === state.currentDay) plagueObservations++;
                    newPlagueWithoutFoodNeed(state).forEach(note);
                } }));
                world = step.result.state;
                if (step.result.daysAdvanced !== 365 || world.currentDay - fromDay !== 365) throw new Error('The native year did not advance the requested 365 days.');
                const inspection = await measured(() => inspectWorld(world));
                inspection.result.findings.forEach(note);
                deadActorsInNewFacts(world, before, fromDay, step.result.events).forEach(note);
                const age = startYears + year;
                timings.push({ age, days: step.result.daysAdvanced, wall: step.wall, cpu: step.cpu,
                    inspectWall: inspection.wall, inspectCpu: inspection.cpu, events: step.result.events.length });
                if (year % sampleYears === 0 || year === years) {
                    samples.push(inspection.result); ensureSource(); writeReport();
                    console.log(JSON.stringify({ seed, age, living: inspection.result.population, findings: [...findings.values()].reduce((total, row) => total + row.count, 0), wall: step.wall }));
                }
            }
            ensureSource(); status = 'complete'; writeReport();
        } catch (error) {
            status = 'incomplete'; failure = error.stack ?? String(error); writeReport();
            throw error;
        }
    }
} finally { await server.close(); }
