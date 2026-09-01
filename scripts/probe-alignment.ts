/**
 * Who is demonic, who stands at the top, and what "chaos" grade currently means.
 */
import { SECTS } from '../src/data/cultivation/sects.js';
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';

const byAlign = new Map<string, string[]>();
for (const s of SECTS as any[]) {
    const a = String(s.alignment ?? 'unknown');
    (byAlign.get(a) ?? byAlign.set(a, []).get(a)!).push(`${s.name} (${s.powerOrdinal})`);
}
for (const [a, names] of [...byAlign].sort()) {
    console.log(`${a.toUpperCase()} (${names.length})`);
    for (const n of names) console.log('   ' + n);
}

console.log('\nTHE TOP OF THE WORLD');
for (const s of (SECTS as any[]).slice().sort((a, b) => (b.powerOrdinal ?? 0) - (a.powerOrdinal ?? 0)).slice(0, 5)) {
    console.log(`  ${String(s.powerOrdinal).padStart(2)}  ${s.name.padEnd(30)} ${s.alignment}  recruits=${s.recruits}`);
}

console.log('\nCHAOS-GRADE TECHNIQUES');
const chaos = (TECHNIQUES as any[]).filter(t => t.grade === 'chaos');
for (const t of chaos) {
    console.log(`  ${String(t.name).padEnd(38)} class=${t.class}  cap=${t.cap ?? '-'}  `
        + `req=${t.requiredOrdinal}  provenance=${t.provenance ?? '-'}`);
}
const taught = new Map<string, string[]>();
for (const s of SECTS as any[]) for (const id of (s.teaches ?? []) as string[]) {
    const t: any = (TECHNIQUES as any[]).find(x => x.id === id);
    if (t?.grade === 'chaos') (taught.get(t.name) ?? taught.set(t.name, []).get(t.name)!).push(`${s.name} [${s.alignment}]`);
}
console.log('\n  taught by:');
for (const [name, houses] of taught) console.log(`    ${name}: ${houses.join(', ')}`);
if (taught.size === 0) console.log('    (no house teaches a chaos-grade art)');
console.log(`\n  grade counts: ` + ['mortal','earth','heaven','immortal','chaos']
    .map(g => `${g} ${(TECHNIQUES as any[]).filter(t => t.grade === g).length}`).join('   '));
