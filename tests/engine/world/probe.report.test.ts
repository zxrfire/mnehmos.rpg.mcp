import { it } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldYears, worldShape } from '../../../src/engine/world/driver.js';
import { simpleAccess } from '../../../src/engine/world/digest.js';

it('probe', () => {
    const s = seedWorld({ seed: 'soak-500', catalog: fixtureCatalog(), presentYear: 1000, population: 400 });
    console.log('SEED', JSON.stringify(s.stats));
    const before = worldShape(s.state);
    const t = Date.now();
    const run = advanceWorldYears(s.state, 500, {
        access: simpleAccess({ actorId: 'pc', locationId: 'loc-region-low-fall', knownFactionIds: ['sect-azure-cloud'] }),
        observer: { id: 'pc', bornOnDay: 365000 }
    });
    const ms = Date.now() - t;
    const after = worldShape(run.state);
    console.log('MS', ms);
    console.log('BEFORE', JSON.stringify(before));
    console.log('AFTER', JSON.stringify(after));
    console.log('DEATHS', run.deaths.length, 'BORN', run.born, 'PRESSURE', run.pressure.length);
    const kinds: Record<string, number> = {};
    for (const e of run.pressure) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
    console.log('KINDS', JSON.stringify(kinds));
    console.log('DIGEST lines', run.digest!.lines.length, 'unheard', run.digest!.unheard, 'unattributed', run.digest!.unattributed);
    console.log('HEADLINE', run.digest!.headline);
    console.log('SAMPLE', run.digest!.lines.slice(0, 3).map(l => `[${l.form}/${l.channel}] ${l.text}`).join(' || '));
});
