/**
 * Which bodies are at the top, read off the data rather than off anybody's
 * description of it.
 *
 * The brief for the deep roads says "an apex power is a house whose road goes
 * to the top", which is circular while the roads are what is being decided. So
 * this prints the three things that are NOT circular - the standing an
 * institution holds, the rung its strongest member stands at, and how far its
 * own teach list carries - and the definition is drawn afterwards.
 *
 * Run: npx tsx scripts/probe-who-is-an-apex-power.ts
 */
import { SECTS } from '../src/data/cultivation/sects.js';
import { APEX_INSTITUTIONS, tierOf } from '../src/data/cultivation/governance-and-water-rights.js';
import { WITHDRAWN_POWERS } from '../src/data/cultivation/sects.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';
import { THE_DEEPEST_ROADS } from '../src/data/cultivation/roads-to-the-top-of-the-ladder.js';

const shelfTop = (teaches: readonly string[]): number => {
    let best = 0;
    for (const id of teaches) {
        const t = getTechnique(id) as { class?: string; cap?: number | null } | undefined;
        if (!t || t.class !== 'cultivation' || t.cap == null) continue;
        best = Math.max(best, Number(t.cap));
    }
    return best;
};

console.log('APEX INSTITUTIONS (governance-and-water-rights.ts)');
for (const a of APEX_INSTITUTIONS as readonly any[]) {
    console.log(`  ${a.id.padEnd(20)} power ${String(a.powerOrdinal).padStart(2)}  factionId=${a.factionId ?? 'null'}`);
}

console.log('\nWITHDRAWN POWERS (sects.ts)');
for (const [id, w] of Object.entries(WITHDRAWN_POWERS)) {
    console.log(`  ${id.padEnd(20)} seats ${w.seats.map(s => s.ordinal).join(',')}`);
}

console.log('\nEVERY FACTION, by strongest member who will answer');
const rows = (SECTS as readonly any[])
    .map(s => ({
        id: s.id,
        power: s.powerOrdinal,
        tier: tierOf(s.id),
        shelf: shelfTop(s.teaches ?? []),
        teaches: (s.teaches ?? []).length,
        deep: THE_DEEPEST_ROADS.some(r => r.factionId === s.id)
    }))
    .sort((a, b) => b.power - a.power || b.shelf - a.shelf);

console.log('power tier shelf teaches deep  id');
for (const r of rows) {
    console.log(
        String(r.power).padStart(5),
        String(r.tier).padStart(4),
        String(r.shelf).padStart(5),
        String(r.teaches).padStart(7),
        (r.deep ? ' yes' : '  - ').padStart(5),
        ' ' + r.id
    );
}

console.log('\nDEEP ROADS DECLARED, and whether the holder can actually teach it');
for (const r of THE_DEEPEST_ROADS) {
    const sect = (SECTS as readonly any[]).find(s => s.id === r.factionId);
    const listed = sect ? (sect.teaches ?? []).includes(r.techniqueId) : false;
    console.log(
        `  ${r.factionId.padEnd(26)} ${r.techniqueId.padEnd(32)} ` +
        `faction row: ${sect ? 'yes' : 'NO'}   on its teach list: ${listed ? 'yes' : 'NO'}`
    );
}
