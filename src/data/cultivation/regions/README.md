<!-- tier: 3 -->

# Region catalogs

One file per region of the map, plus the tables that join them. A region's places, its
prefectures and its local material live with the region rather than in a comparative table -
[`provinces.ts`](./provinces.ts) explains where that line falls and why the six province rows
stayed together.

**Place names are not written here.** They are consts in
[`../place-names.ts`](../place-names.ts), and a name typed twice is the defect that file
exists to stop: a place is identified by its display string, and every lookup over it fails
OPEN, so a mismatch answers with the wrong province rather than throwing.

| file | what it is |
|---|---|
| [`arterials.ts`](./arterials.ts) | The four arterials: one per Surveyor, and the administrative spine under the Jade Gorge's grant book. |
| [`drowned-reach.ts`](./drowned-reach.ts) | The Drowned Sea: open water, no ground under it, so no vein under it, so nothing in the air. |
| [`local-rank-names.ts`](./local-rank-names.ts) | How a province relabels the one shared ladder, band for band. |
| [`low-fall.ts`](./low-fall.ts) | The Jade Gorge: the centre, the only province with a road to every other one, and the only one in the world with no ceiling on it. |
| [`map-by-bearing.ts`](./map-by-bearing.ts) | Reading the world as five columns instead of one list: what sits at each bearing, which houses are seated there, and where the apexes actually stand. |
| [`prefectures.ts`](./prefectures.ts) | What a prefecture is, and every prefecture in the world assembled from the two provinces that have any. |
| [`provinces.ts`](./provinces.ts) | The provinces as a political layer - who holds from whom, and where - plus every lookup over that layer and the prefectures and arterials beneath it. |
| [`quiet-marches.ts`](./quiet-marches.ts) | The Silent Cliffs: driven stone cut with tools, the last of the five driven provinces, and the one people leave. |
| [`rank-translation.ts`](./rank-translation.ts) | Who translates one province's rank vocabulary into another's, what they have riding on the answer, and what being wrong about it costs. |
| [`region-ids.ts`](./region-ids.ts) | The stable ids of every province and of the ground between them. |
| [`region-schema.ts`](./region-schema.ts) | The Region contract: every Zod shape a province row is built out of. |
| [`what-the-people-who-saw-it-call-it.ts`](./what-the-people-who-saw-it-call-it.ts) | Names for the generated half of the map: what a sealed compound and a scar get called, so that neither is called by its kind. |
| [`the-blown-ground.ts`](./the-blown-ground.ts) | The Burial Sands: a rich vein under loose cover that moves, in the wedge the four arms leave between them, held by nobody because nothing here lasts long enough to be granted. |
| [`the-map.ts`](./the-map.ts) | Regions - five of them, and the contrast between them is the content. |
| [`white-stair.ts`](./white-stair.ts) | The White Stair: the qi is in the ice and the ice is going. |
| [`wide-field.ts`](./wide-field.ts) | The Yellow Plain: flat, dug over, nine cities, and no high ground anybody could fortify. |

---

## Where else to look

- [`../README.md`](../README.md) - the rest of the catalog. Houses are seated in provinces, so
  `sects.ts`, `hierarchy.ts` and `what-each-house-makes-and-what-crosses-the-water.ts` are read
  alongside these files constantly.
- [`../../../engine/world/README.md`](../../../engine/world/README.md) - what a place becomes
  once a world is running: `locations.ts`,
  `the-ground-somebody-is-actually-standing-on.ts`, `what-is-built-on-this-ground.ts`,
  `being-on-their-ground.ts`, and `what-a-place-still-has-in-the-ground.ts`.
- [`../../../engine/worldgen/README.md`](../../../engine/worldgen/README.md) - the generated
  ground beneath the authored map. `what-the-people-who-saw-it-call-it.ts` here is what names
  the half that comes out of a seed.
- [`../../../../docs/world/places/README.md`](../../../../docs/world/places/README.md) - the
  prose for the same ground: ruins, closed ground, architecture.
- [`../../../web/README.md`](../../../web/README.md) - how ground reaches a player:
  `web/places.ts`, `web/what-can-be-reached-from-here.ts`,
  `web/where-this-cultivator-could-go.ts`, `web/what-you-can-tell-about-the-ground.ts`.
- [`../../../engine/spatial/README.md`](../../../engine/spatial/README.md) - the pathfinder
  waiting on this graph. It is written for a tile grid and this is a place graph, which is the
  gap between them.

