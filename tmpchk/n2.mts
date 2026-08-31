import { IMMORTAL_CHANNELS } from '../src/data/cultivation/crossings.js';
for (const c of IMMORTAL_CHANNELS as any[]) {
  console.log(`--- ${c.factionId} [${c.kind}] cadence=${c.cadence}`);
  console.log('ancestor:', c.ancestor);
  console.log('clock:', String(c.theClock).slice(0, 160));
}
