/**
 * Original acceptance charter (the walk now belongs to the fixture builder):
 *
 *   > Start as a nobody, run 500 years, and confirm the resulting world is
 *   > recognisably descended from the world you started in.
 *
 * Concretely: factions risen and fallen, people dead and inherited from,
 * grudges live and passed to descendants, history accumulated with discoverable
 * causes, locations changed and carrying their scars, and nothing incoherent.
 *
 * Run as one advance rather than five hundred so the test also demonstrates
 * that the cost of a century is not a function of how many days are in it.
 */
/** Build the original cumulative native run outside CI; readers never start it. */
import { CAME_TO_LIGHT } from '../../src/engine/world/what-comes-to-light-about-a-killing.js';
import { fixtureCatalog } from '../engine/world/fixtures.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { simpleAccess } from '../../src/engine/world/digest.js';
import { advanceWorldYears } from './advance-world-years.js';
import { worldShape } from './the-shape-of-a-world.js';
import { existingSerializedFixture, serializedFixture, fixtureSourceHash } from './serialized-fixture.js';

const NAMESPACE = 'native-five-century-acceptance';
const ENTRIES = ['tests/support/driver-acceptance-sample.ts'];
const KEY = { seed: 'soak-500', years: 500, population: 400, format: 2 };

export interface DriverAcceptanceSample {
    before: ReturnType<typeof worldShape>;
    after: ReturnType<typeof worldShape>;
    run: ReturnType<typeof advanceWorldYears>;
    elapsedMs: number;
    cpuMs: number;
    source: string;
    hiddenKillings: { boundaryReads: number; written: { id: string; onDay: number }[];
        discoveries: { id: string; onDay: number }[]; observedThroughDay: number };
}

function decode(bytes: Buffer): DriverAcceptanceSample {
    const sample = JSON.parse(bytes.toString('utf8')) as DriverAcceptanceSample;
    if (sample.source !== fixtureSourceHash(ENTRIES)) throw new Error('Driver acceptance fixture has a different source identity.');
    return sample;
}

export function readDriverAcceptanceSample(): DriverAcceptanceSample {
    const bytes = existingSerializedFixture(NAMESPACE, ENTRIES, KEY);
    if (!bytes) throw new Error('Missing current-source driver acceptance fixture. Run node scripts/regenerate-driver-fixture.mjs through the shared heavy runner.');
    return decode(bytes);
}

export async function regenerateDriverAcceptanceSample() {
    let built = false;
    const bytes = await serializedFixture(NAMESPACE, ENTRIES, KEY, async () => {
        built = true;
        const source = fixtureSourceHash(ENTRIES);
        const seeded = seedWorld({ seed: KEY.seed, catalog: fixtureCatalog(), presentYear: 1000, population: KEY.population });
        const before = worldShape(seeded.state);
        const written = new Map<string, number>(), discoveries = new Map<string, number>();
        const openingDay = seeded.state.currentDay;
        let boundaryReads = 0;
        const began = performance.now(), cpu = process.cpuUsage();
        const run = advanceWorldYears(seeded.state, KEY.years, {
            access: simpleAccess({ actorId: 'pc', locationId: 'loc-region-low-fall', knownFactionIds: ['sect-azure-cloud'] }),
            observer: { id: 'pc', bornOnDay: 1000 * 365 },
            // Observe the full creation/discovery cohort, independent of later retention.
            atWorldBoundary: world => {
                boundaryReads++;
                for (const fact of world.history.facts) {
                    if (fact.data.hidden !== true || fact.day < openingDay) continue;
                    written.set(fact.id, fact.day);
                    const onDay = fact.data[CAME_TO_LIGHT];
                    if (typeof onDay === 'number') discoveries.set(fact.id, onDay);
                }
            }
        });
        const used = process.cpuUsage(cpu), elapsedMs = performance.now() - began;
        const sample: DriverAcceptanceSample = { before, after: worldShape(run.state), run,
            elapsedMs, cpuMs: (used.user + used.system) / 1000, source,
            hiddenKillings: { boundaryReads, written: [...written].map(([id, onDay]) => ({ id, onDay })),
                discoveries: [...discoveries].map(([id, onDay]) => ({ id, onDay })), observedThroughDay: run.toDay } };
        if (fixtureSourceHash(ENTRIES, true) !== source)
            throw new Error('Simulation source changed during driver fixture generation; nothing was published.');
        return Buffer.from(JSON.stringify(sample));
    });
    const sample = decode(bytes);
    return { source: sample.source, built, bytes: bytes.length, years: KEY.years,
        elapsedMs: sample.elapsedMs, cpuMs: sample.cpuMs,
        hiddenKillings: { written: sample.hiddenKillings.written.length, discovered: sample.hiddenKillings.discoveries.length, boundaryReads: sample.hiddenKillings.boundaryReads } };
}
