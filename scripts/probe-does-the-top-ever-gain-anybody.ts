/**
 * Over a long horizon, does anything ever ARRIVE in the upper bands?
 *
 * WHY THE WINDOW HAS TO BE LONG. A Tribulation Transcendence cultivator carries
 * a lifespan in the tens of thousands of years, so the correct behaviour at the
 * top of the ladder is stock rather than flow: somebody arrives very rarely and
 * then stays for longer than the whole simulated history. Under that model,
 * measuring zero arrivals across five hundred years proves very little - it is
 * an ordinary sample of a process whose true rate might be one per few
 * centuries, and near-identical band shares a few centuries apart are what a
 * HEALTHY top would look like too.
 *
 * So stability is not the discriminator and neither is a small count. The
 * question is whether anything ever arrives at all, which needs a window long
 * enough to contain an event.
 *
 * An arrival here means CLIMBED INTO: somebody seen standing in a lower band
 * before they were seen in this one. Being seeded straight into a band is not an
 * arrival and counting it as one is how this has been got wrong before.
 *
 * Run: npx tsx scripts/probe-does-the-top-ever-gain-anybody.ts [years] [step]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const YEARS = Number(process.argv[2] ?? 2000);
const STEP = Number(process.argv[3] ?? 50);
const catalog = await loadCultivationCatalog();

const BANDS: [string, number, number][] = [
    ['0-12', 0, 12], ['13-16', 13, 16], ['17-20', 17, 20], ['21-24', 21, 24],
    ['25-28', 25, 28], ['29-32', 29, 32], ['33-44', 33, 44]
];
const idx = (o: number): number => BANDS.findIndex(b => o >= b[1] && o <= b[2]);

let state = seedWorld({ seed: 'long-horizon', catalog }).state as any;
/** npcId -> lowest band index ever seen standing in. */
const lowestSeen = new Map<string, number>();
/** cumulative climbed arrivals per band index. */
const arrivals = new Array(BANDS.length).fill(0);
const counted = new Set<string>();

function sample(): void {
    for (const n of state.npcs as any[]) {
        if (n.status !== 'alive') continue;
        const i = idx(n.cultivation.realmOrdinal);
        const low = lowestSeen.get(n.id);
        if (low === undefined) { lowestSeen.set(n.id, i); continue; }
        if (i < low) { lowestSeen.set(n.id, i); continue; }
        // Standing above the lowest band we have ever seen them in means they
        // climbed. Count each person once per band they climb into.
        for (let b = low + 1; b <= i; b++) {
            const key = n.id + ':' + b;
            if (counted.has(key)) continue;
            counted.add(key);
            arrivals[b]++;
        }
    }
}

sample();
console.log('year   alive   ' + BANDS.map(b => b[0].padStart(6)).join('') + '   climbed-into 25-28 / 29-32 / 33-44');
for (let y = STEP; y <= YEARS; y += STEP) {
    state = advanceWorldYears(state, STEP).state;
    sample();
    if (y % 250 !== 0 && y !== YEARS) continue;
    const alive = (state.npcs as any[]).filter(n => n.status === 'alive');
    const counts = BANDS.map(b => alive.filter(n =>
        n.cultivation.realmOrdinal >= b[1] && n.cultivation.realmOrdinal <= b[2]).length);
    console.log(
        String(y).padStart(5),
        String(alive.length).padStart(6),
        '  ' + counts.map(c => String(c).padStart(6)).join(''),
        '        ' + [4, 5, 6].map(i => String(arrivals[i]).padStart(4)).join(' /')
    );
}

console.log('\nCUMULATIVE CLIMBED ARRIVALS OVER ' + YEARS + ' YEARS');
for (let i = 1; i < BANDS.length; i++) {
    console.log(`  into ${BANDS[i][0].padEnd(7)} ${String(arrivals[i]).padStart(5)}` +
        (arrivals[i] === 0 ? '   <- nothing ever arrives here' : ''));
}
