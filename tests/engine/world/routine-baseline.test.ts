import { it, vi, expect } from 'vitest';
/** Both arms read one pinned world; the old placement is a frozen test fixture. */
import * as placement from '../../../src/engine/world/where-in-a-place-somebody-is-standing';
import * as routines from '../../../src/engine/world/npc-routines';

import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { seedWorld } from '../../../src/engine/world/seeding';
import { WORLD_POPULATION } from '../../../src/server/state/cultivation-world';
import { theAreasOf as after } from '../../../src/engine/world/where-in-a-place-somebody-is-standing';
import { theAreasOf as before } from './routine-placement-before';
it('measures both town placement arms on one seeded world', async () => {
 const world = seedWorld({ seed: 'road-world', catalog: await loadCultivationCatalog(), population: WORLD_POPULATION }).state;
 const town = world.locations.filter(l => l.kind === 'settlement').sort((a,b) =>
 world.npcs.filter(n => n.locationId === b.id && n.status === 'alive').length - world.npcs.filter(n => n.locationId === a.id && n.status === 'alive').length)[0]!;
 for (const hour of [8,12,22]) {
  const clock = {...world,currentHour:hour};
  for (const [label,read] of [['before',before(clock,town)],['after',after(clock,town)]] as const) {
   const sizes=read.areas.map(area=>[...read.whereIs.values()].filter(at=>at===area.id).length);
   console.log(`[histogram] ${town.name} ${town.id} seed road-world day ${world.currentDay} hour ${hour} ${label}: `+[0,1,2,3].map(n=>`${n}:${sizes.filter(k=>k===n).length}`).join(' '));
   expect(Math.max(...sizes)).toBeLessThanOrEqual(3);
  }
 }
});

it('measures a year without adding hourly world steps', async () => {
 const opening=seedWorld({seed:'road-world',catalog:await loadCultivationCatalog(),population:WORLD_POPULATION}).state;
 const originalRoutine=routines.routineOf;
 const readings: Record<string,number[]>={before:[],after:[]};
 for(const round of [0,1,2,3,4,5,6,7,8,9,10]) for(const label of (round%2 ? ['after','before'] : ['before','after'])) {
  const world=structuredClone(opening);
  if(label==='before') {
   vi.spyOn(placement,'theAreasOf').mockImplementation(before);
   vi.spyOn(routines,'routineOf').mockImplementation((_state,npc)=>({activity:npc.activity,home:false,standingIn:null,locationId:npc.locationId}));
  }
  let reads=0;
  if(label==='after')vi.spyOn(routines,'routineOf').mockImplementation((...args)=>{reads++;return originalRoutine(...args);});
  const start=performance.now();
  const result=applyPressure(world,world.currentDay,world.currentDay+365);
  const ms=performance.now()-start;
  vi.restoreAllMocks();
  if(round>0)readings[label]!.push(ms);
  console.log(`[year-cost] ${label} round ${round} ${ms.toFixed(1)}ms ${result.yearsStepped} years ${reads} routine reads`);
 }
 console.log('[year-cost] measured '+JSON.stringify(readings));
},180_000);

