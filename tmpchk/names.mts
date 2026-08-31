import { SECTS, SECT_ANCESTRY } from '../src/data/cultivation/sects.js';
import { IMMORTAL_CHANNELS } from '../src/data/cultivation/crossings.js';
import { HELD_INSTRUMENTS, UNOWNED_ANCESTORS } from '../src/data/cultivation/sealed-ancestors.js';
console.log('=== SECT_ANCESTRY ===');
for (const s of SECTS) {
  const a = (SECT_ANCESTRY as any)[s.id];
  if (!a) { console.log(`${s.id}: NO RECORD`); continue; }
  const names = a.ancestors.map((x: any) => `${x.name} [${x.fate}${x.claimIsTrue === false ? ' FALSE-CLAIM' : ''}]`);
  console.log(`${s.id}: ${names.join(' | ')}`);
}
console.log('\n=== IMMORTAL_CHANNELS ===');
for (const c of IMMORTAL_CHANNELS as any[]) console.log(c.factionId, '::', c.ancestorName ?? c.name ?? JSON.stringify(Object.keys(c)));
console.log('\n=== HELD ===');
for (const h of HELD_INSTRUMENTS) console.log(h.id, '::', h.name, '|', h.holderFactionId);
console.log('\n=== UNOWNED ===');
for (const u of UNOWNED_ANCESTORS) console.log(u.id, '::', u.name);
