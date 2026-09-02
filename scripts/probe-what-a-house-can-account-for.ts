/**
 * What a house DECLARES it has, against what it actually holds.
 *
 * `powerOrdinal` is a number somebody wrote down. This prints it beside the
 * four things a house's strength could be read off instead - its roll, its
 * shelf, its objects and its channel - so the disagreements are visible rather
 * than smoothed over.
 *
 * Run: npx tsx scripts/probe-what-a-house-can-account-for.ts
 */

import { SECTS } from '../src/data/cultivation/sects.js';
import { rollOf } from '../src/data/cultivation/faction-roll.js';
import { manualsOf } from '../src/engine/world/manuals.js';
import { artifactsOwnedBy } from '../src/data/cultivation/artifacts.js';
import { IMMORTAL_HOLDINGS } from '../src/data/cultivation/immortal-items.js';
import { getChannel } from '../src/data/cultivation/crossings.js';

interface Row {
    id: string;
    declared: number;
    roll: number;
    rollSize: number;
    shelf: number;
    items: number;
    channel: boolean;
}

const rows: Row[] = SECTS.map(sect => {
    const roll = rollOf(sect.id);
    const shelf = manualsOf(sect.id);
    const objects = artifactsOwnedBy(sect.id);
    const immortal = IMMORTAL_HOLDINGS.filter(h => h.factionId === sect.id);
    return {
        id: sect.id,
        declared: sect.powerOrdinal,
        roll: roll.reduce((m, r) => Math.max(m, r.realmOrdinal), -1),
        rollSize: roll.length,
        shelf: shelf.reduce((m, s) => Math.max(m, s.cap), -1),
        items: objects.reduce((m, o) => Math.max(m, o.power ?? -1), -1),
        channel: getChannel(sect.id) != null || immortal.length > 0
    };
});

const pad = (s: string | number, n: number) => String(s).padEnd(n);
console.log(pad('faction', 38), pad('declared', 9), pad('roll(max/n)', 12),
    pad('shelf', 6), pad('items', 6), 'channel');
for (const r of rows.sort((a, b) => b.declared - a.declared)) {
    console.log(
        pad(r.id, 38), pad(r.declared, 9), pad(`${r.roll}/${r.rollSize}`, 12),
        pad(r.shelf, 6), pad(r.items, 6), r.channel ? 'yes' : '-');
}

// ── The gaps, stated as gaps. ──
console.log('\nDECLARED ABOVE EVERYTHING IT HOLDS (declared > roll, shelf and items):');
let unaccounted = 0;
for (const r of rows) {
    const best = Math.max(r.roll, r.shelf, r.items);
    if (r.declared > best) {
        unaccounted++;
        console.log(`  ${pad(r.id, 38)} declares ${r.declared}, best held ${best} (gap ${r.declared - best})`);
    }
}
console.log(`  ${unaccounted} of ${rows.length} houses`);

console.log('\nHOLDS SOMEBODY ABOVE WHAT IT DECLARES:');
for (const r of rows) {
    if (r.roll > r.declared) console.log(`  ${pad(r.id, 38)} declares ${r.declared}, roll reaches ${r.roll}`);
}

console.log('\nSHELF AGAINST DECLARED (a house cannot carry anybody past its deepest road):');
let teachesBelow = 0;
for (const r of rows) if (r.shelf >= 0 && r.shelf < r.declared) teachesBelow++;
console.log(`  ${teachesBelow} of ${rows.length} houses teach below their own declared ordinal`);
