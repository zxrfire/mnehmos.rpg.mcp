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
| [`ruin-and-scar-names.ts`](./ruin-and-scar-names.ts) | Names for the generated half of the map: what a sealed compound and a scar get called, so that neither is called by its kind. |
| [`the-blown-ground.ts`](./the-blown-ground.ts) | The Burial Sands: a rich vein under loose cover that moves, in the wedge the four arms leave between them, held by nobody because nothing here lasts long enough to be granted. |
| [`the-map.ts`](./the-map.ts) | Regions - five of them, and the contrast between them is the content. |
| [`white-stair.ts`](./white-stair.ts) | The White Stair: the qi is in the ice and the ice is going. |
| [`wide-field.ts`](./wide-field.ts) | The Yellow Plain: flat, dug over, nine cities, and no high ground anybody could fortify. |
